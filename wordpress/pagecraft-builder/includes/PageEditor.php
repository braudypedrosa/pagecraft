<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class PageEditor
{
    public const SCHEMA_VERSION = 13;
    public const MAX_DOCUMENT_BYTES = 8388608;
    public const MAX_HTML_BYTES = 12582912;

    /** @return array{document:?array<string,mixed>,version:int} */
    public function load(int $postId): array
    {
        $this->assertEditablePage($postId);
        $raw = get_post_meta($postId, ManagedPage::DOCUMENT, true);
        if (!is_string($raw) || $raw === '') {
            return ['document' => null, 'version' => 0];
        }
        try {
            $document = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new PackageException('The stored Pagecraft document is invalid: ' . $error->getMessage());
        }
        if (!is_array($document)) {
            throw new PackageException('The stored Pagecraft document is not an object.');
        }

        return [
            'document' => $document,
            'version' => max(1, (int) get_post_meta($postId, ManagedPage::DOCUMENT_VERSION, true)),
        ];
    }

    /**
     * @param array<string,mixed> $input
     * @return array{version:int,revisionId:?int}
     */
    public function save(int $postId, array $input): array
    {
        $this->assertEditablePage($postId);
        $managed = ManagedPage::isManaged($postId);
        $conversionRevision = (int) get_post_meta($postId, ManagedPage::CONVERSION_REVISION, true);
        if (!$managed && $conversionRevision === 0) {
            throw new PackageException('Start the explicit Pagecraft conversion first so WordPress can back up this page.');
        }

        $currentVersion = $managed
            ? max(1, (int) get_post_meta($postId, ManagedPage::DOCUMENT_VERSION, true))
            : 0;
        $clientVersion = filter_var($input['version'] ?? null, FILTER_VALIDATE_INT);
        if ($clientVersion === false || $clientVersion !== $currentVersion) {
            throw new EditorConflict($clientVersion === false ? -1 : (int) $clientVersion, $currentVersion);
        }

        $document = $input['document'] ?? $input['doc'] ?? null;
        if (!is_array($document)) {
            throw new PackageException('The Pagecraft document payload is missing.');
        }
        $schemaVersion = filter_var($document['schemaVersion'] ?? $document['v'] ?? null, FILTER_VALIDATE_INT);
        if ($schemaVersion === false || $schemaVersion <= 0) {
            throw new PackageException('The Pagecraft document has no valid schema version.');
        }
        if ($schemaVersion > self::SCHEMA_VERSION) {
            throw new PackageException(
                'This document uses Pagecraft schema ' . $schemaVersion . ', but this plugin supports schema '
                . self::SCHEMA_VERSION . '. Upgrade Pagecraft Builder before saving.'
            );
        }
        $documentJson = CanonicalJson::encode($document);
        if (strlen($documentJson) > self::MAX_DOCUMENT_BYTES) {
            throw new PackageException('The Pagecraft document exceeds the WordPress editor limit.');
        }

        $compiled = $input['compiled'] ?? null;
        if (!is_array($compiled)) {
            throw new PackageException('The compiled WordPress fallback is missing.');
        }
        $html = $this->boundedString($compiled['html'] ?? null, self::MAX_HTML_BYTES, 'compiled page');
        $globalCss = FallbackCompiler::safeCssSource(
            $this->boundedString($compiled['globalCss'] ?? '', GeneratedAssetStore::MAX_CSS_BYTES, 'global stylesheet', true)
        );
        $pageCss = FallbackCompiler::safeCssSource(
            $this->boundedString($compiled['pageCss'] ?? '', GeneratedAssetStore::MAX_CSS_BYTES, 'page stylesheet', true)
        );
        $content = FallbackCompiler::contentFromHtml($html);
        $assets = new GeneratedAssetStore();
        $globalAsset = $globalCss !== '' ? $assets->writeCss('global', $globalCss) : null;
        $pageAsset = $pageCss !== '' ? $assets->writeCss('page', $pageCss) : null;
        $runtimeAsset = FallbackCompiler::needsRuntime($content) ? $assets->writeRuntime() : null;

        $revisionId = null;
        if ($managed) {
            $savedRevision = wp_save_post_revision($postId);
            if (is_wp_error($savedRevision)) {
                throw new PackageException('WordPress could not create the safety revision: ' . $savedRevision->get_error_message());
            }
            if (is_int($savedRevision) && $savedRevision > 0) {
                $revisionId = $savedRevision;
            }
        } else {
            $revisionId = $conversionRevision > 0 ? $conversionRevision : null;
        }

        $updated = wp_update_post([
            'ID' => $postId,
            'post_content' => wp_slash($content),
        ], true);
        if (is_wp_error($updated)) {
            throw new PackageException('WordPress could not save the Pagecraft page: ' . $updated->get_error_message());
        }

        $nextVersion = $currentVersion + 1;
        $metadata = [
            ManagedPage::DOCUMENT => $documentJson,
            ManagedPage::DOCUMENT_VERSION => (string) $nextVersion,
            ManagedPage::SCHEMA_VERSION => (string) $schemaVersion,
            ManagedPage::RENDERER_VERSION => PAGECRAFT_BUILDER_VERSION,
            ManagedPage::COMPILED_HASH => hash('sha256', $content),
            ManagedPage::COMPILED_CSS => implode("\n", array_filter([$globalCss, $pageCss])),
            ManagedPage::GLOBAL_CSS_PATH => $globalAsset['path'] ?? '',
            ManagedPage::GLOBAL_CSS_HASH => $globalAsset['hash'] ?? '',
            ManagedPage::PAGE_CSS_PATH => $pageAsset['path'] ?? '',
            ManagedPage::PAGE_CSS_HASH => $pageAsset['hash'] ?? '',
            ManagedPage::RUNTIME_PATH => $runtimeAsset['path'] ?? '',
            ManagedPage::RUNTIME_HASH => $runtimeAsset['hash'] ?? '',
        ];
        foreach ($metadata as $key => $value) {
            update_post_meta($postId, $key, wp_slash($value));
        }

        return ['version' => $nextVersion, 'revisionId' => $revisionId];
    }

    /** @return list<array{id:string,version:int,createdAt:string,author:array{id:string,name:string},current:bool}> */
    public function revisions(int $postId): array
    {
        $loaded = $this->load($postId);
        $rows = [];
        foreach (wp_get_post_revisions($postId, ['posts_per_page' => 50, 'check_enabled' => false]) as $revision) {
            $id = (int) ($revision->ID ?? 0);
            $document = $id > 0 ? get_post_meta($id, ManagedPage::DOCUMENT, true) : '';
            if (!is_string($document) || $document === '') {
                continue;
            }
            $author = get_userdata((int) ($revision->post_author ?? 0));
            $rows[] = [
                'id' => (string) $id,
                'version' => max(1, (int) get_post_meta($id, ManagedPage::DOCUMENT_VERSION, true)),
                'createdAt' => get_post_time('c', true, $revision),
                'author' => [
                    'id' => (string) ($author->ID ?? ''),
                    'name' => (string) ($author->display_name ?? __('WordPress user', 'pagecraft-builder')),
                ],
                'current' => false,
            ];
        }
        array_unshift($rows, [
            'id' => 'current',
            'version' => $loaded['version'],
            'createdAt' => get_post_modified_time('c', true, $postId),
            'author' => ['id' => '', 'name' => __('Current WordPress draft', 'pagecraft-builder')],
            'current' => true,
        ]);
        return $rows;
    }

    /** @return array{document:array<string,mixed>,version:int} */
    public function restore(int $postId, int $revisionVersion, int $currentVersion): array
    {
        $loaded = $this->load($postId);
        if ($loaded['version'] !== $currentVersion) {
            throw new EditorConflict($currentVersion, $loaded['version']);
        }
        $matched = null;
        foreach (wp_get_post_revisions($postId, ['posts_per_page' => 100, 'check_enabled' => false]) as $revision) {
            $id = (int) ($revision->ID ?? 0);
            if ((int) get_post_meta($id, ManagedPage::DOCUMENT_VERSION, true) === $revisionVersion) {
                $matched = $revision;
                break;
            }
        }
        if (!is_object($matched) || !isset($matched->ID, $matched->post_content)) {
            throw new PackageException('That Pagecraft revision is no longer available in WordPress.');
        }
        $safety = wp_save_post_revision($postId);
        if (is_wp_error($safety)) {
            throw new PackageException('WordPress could not protect the current draft before restoring it.');
        }
        $updated = wp_update_post(['ID' => $postId, 'post_content' => wp_slash((string) $matched->post_content)], true);
        if (is_wp_error($updated)) {
            throw new PackageException('WordPress could not restore the selected Pagecraft revision.');
        }
        foreach (ManagedPage::keys() as $key) {
            if (in_array($key, [ManagedPage::DOCUMENT_VERSION, ManagedPage::CONVERSION_REVISION], true)) {
                continue;
            }
            $value = get_post_meta((int) $matched->ID, $key, true);
            if (is_string($value)) {
                update_post_meta($postId, $key, wp_slash($value));
            }
        }
        $nextVersion = $currentVersion + 1;
        update_post_meta($postId, ManagedPage::DOCUMENT_VERSION, (string) $nextVersion);
        $restored = $this->load($postId);
        if (!is_array($restored['document'])) {
            throw new PackageException('The selected revision has no Pagecraft document.');
        }
        return ['document' => $restored['document'], 'version' => $nextVersion];
    }

    private function assertEditablePage(int $postId): void
    {
        if ($postId <= 0 || get_post_type($postId) !== 'page' || !current_user_can('edit_post', $postId)
            || !current_user_can(Capabilities::EDIT)) {
            throw new PackageException('You are not allowed to edit this Pagecraft page.');
        }
    }

    private function boundedString(mixed $value, int $limit, string $label, bool $allowEmpty = false): string
    {
        if (!is_string($value) || (!$allowEmpty && $value === '')) {
            throw new PackageException('The ' . $label . ' payload is missing.');
        }
        if (strlen($value) > $limit) {
            throw new PackageException('The ' . $label . ' exceeds the WordPress editor limit.');
        }
        return $value;
    }
}
