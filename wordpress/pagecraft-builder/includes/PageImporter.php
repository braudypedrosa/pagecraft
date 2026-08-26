<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class PageImporter
{
    /**
     * @param array{
     *   status?: string,
     *   author?: int,
     *   featured_image?: int,
     *   replace_post_id?: int,
     *   confirm_replace?: bool
     * } $options
     */
    public function import(PortablePagePackage $package, array $options = []): PageImportResult
    {
        if (!current_user_can(Capabilities::IMPORT)) {
            throw new PackageException('You are not allowed to import Pagecraft pages.');
        }

        $content = FallbackCompiler::content($package);
        $globalCss = FallbackCompiler::globalCss($package);
        $pageCss = FallbackCompiler::pageCss($package);
        $assets = new GeneratedAssetStore();
        $globalCssAsset = $globalCss !== '' ? $assets->writeCss('global', $globalCss) : null;
        $pageCssAsset = $pageCss !== '' ? $assets->writeCss('page', $pageCss) : null;
        $runtimeAsset = FallbackCompiler::needsRuntime($content) ? $assets->writeRuntime() : null;
        $metadata = ManagedPage::metadata(
            $package,
            $content,
            implode("\n", array_filter([$globalCss, $pageCss], static fn (string $part): bool => $part !== '')),
            $globalCssAsset,
            $pageCssAsset,
            $runtimeAsset
        );
        $replacePostId = (int) ($options['replace_post_id'] ?? 0);
        if ($replacePostId > 0) {
            return $this->replace($replacePostId, $content, $metadata, !empty($options['confirm_replace']));
        }

        return $this->create($package, $content, $metadata, $options);
    }

    /** @param array<string, string> $metadata */
    private function replace(int $postId, string $content, array $metadata, bool $confirmed): PageImportResult
    {
        if (!$confirmed) {
            throw new PackageException('Replacing a WordPress page requires explicit confirmation.');
        }
        if (!current_user_can('edit_post', $postId)) {
            throw new PackageException('You are not allowed to replace this WordPress page.');
        }
        if (get_post_type($postId) !== 'page') {
            throw new PackageException('Only a native WordPress page can be replaced.');
        }
        if (!ManagedPage::isManaged($postId)) {
            throw new PackageException(
                'This is not a Pagecraft-managed page. Convert and back it up through the explicit editor flow first.'
            );
        }
        if (!post_type_supports('page', 'revisions') || !wp_revisions_enabled(get_post($postId))) {
            throw new PackageException('WordPress revisions must be enabled before replacing a Pagecraft page.');
        }

        $revision = wp_save_post_revision($postId);
        if (is_wp_error($revision)) {
            throw new PackageException('WordPress could not create the safety revision: ' . $revision->get_error_message());
        }
        $revisionId = is_int($revision) && $revision > 0 ? $revision : $this->latestRevisionId($postId);
        if ($revisionId === null) {
            throw new PackageException('WordPress did not create a recoverable revision, so the page was not replaced.');
        }

        $updated = wp_update_post([
            'ID' => $postId,
            'post_content' => wp_slash($content),
        ], true);
        if (is_wp_error($updated)) {
            throw new PackageException('WordPress could not replace the Pagecraft page: ' . $updated->get_error_message());
        }
        foreach ($metadata as $key => $value) {
            update_post_meta($postId, $key, wp_slash($value));
        }

        return new PageImportResult($postId, true, $revisionId);
    }

    /**
     * @param array<string, string> $metadata
     * @param array<string, mixed> $options
     */
    private function create(
        PortablePagePackage $package,
        string $content,
        array $metadata,
        array $options
    ): PageImportResult {
        $page = $package->page();
        $status = (string) ($options['status'] ?? 'draft');
        if (!in_array($status, ['draft', 'pending', 'publish', 'private'], true)) {
            throw new PackageException('The requested WordPress page status is not supported.');
        }
        if (in_array($status, ['publish', 'private'], true) && !current_user_can('publish_pages')) {
            throw new PackageException('You are not allowed to publish Pagecraft pages.');
        }
        $author = (int) ($options['author'] ?? get_current_user_id());
        if ($author <= 0 || !get_userdata($author)) {
            throw new PackageException('The requested WordPress page author does not exist.');
        }
        if ($author !== get_current_user_id() && !current_user_can('edit_others_pages')) {
            throw new PackageException('You are not allowed to assign this Pagecraft page to another author.');
        }

        $title = sanitize_text_field((string) (($page->name ?? '') ?: ($page->title ?? 'Pagecraft page')));
        $slug = sanitize_title((string) (($page->slug ?? '') ?: $title));
        if ($title === '' || $slug === '') {
            throw new PackageException('The Pagecraft page needs a valid native title and slug.');
        }
        $featuredImage = (int) ($options['featured_image'] ?? 0);
        if ($featuredImage > 0
            && (get_post_type($featuredImage) !== 'attachment' || !wp_attachment_is_image($featuredImage))) {
            throw new PackageException('The selected featured image is not a WordPress image attachment.');
        }
        $postId = wp_insert_post([
            'post_type' => 'page',
            'post_status' => $status,
            'post_title' => $title,
            'post_name' => $slug,
            'post_author' => $author,
            'post_content' => wp_slash($content),
            'meta_input' => array_map('wp_slash', $metadata),
        ], true);
        if (is_wp_error($postId)) {
            throw new PackageException('WordPress could not create the Pagecraft page: ' . $postId->get_error_message());
        }

        if ($featuredImage > 0) {
            set_post_thumbnail((int) $postId, $featuredImage);
        }

        return new PageImportResult((int) $postId, false, null);
    }

    private function latestRevisionId(int $postId): ?int
    {
        $revisions = wp_get_post_revisions($postId, [
            'posts_per_page' => 1,
            'order' => 'DESC',
            'orderby' => 'date ID',
            'check_enabled' => false,
        ]);
        $latest = reset($revisions);
        return is_object($latest) && isset($latest->ID) ? (int) $latest->ID : null;
    }
}
