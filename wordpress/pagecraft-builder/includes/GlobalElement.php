<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class GlobalElement
{
    public const POST_TYPE = 'pagecraft_global';
    public const KIND = '_pagecraft_global_kind';
    public const DOCUMENT = '_pagecraft_global_document';
    public const SCHEMA_VERSION = '_pagecraft_schema_version';
    public const RENDERER_VERSION = '_pagecraft_renderer_version';
    public const SOURCE_PROJECT_ID = '_pagecraft_source_project_id';
    public const SOURCE_VERSION = '_pagecraft_source_version';
    public const CSS_PATH = '_pagecraft_global_css_path';
    public const CSS_HASH = '_pagecraft_global_css_hash';
    public const RUNTIME_PATH = '_pagecraft_runtime_path';
    public const RUNTIME_HASH = '_pagecraft_runtime_hash';
    public const MEDIA_ATTACHMENTS = '_pagecraft_media_attachments';
    public const UPDATED_AT = '_pagecraft_imported_at';

    /** @return list<string> */
    public static function keys(): array
    {
        return [
            self::KIND,
            self::DOCUMENT,
            self::SCHEMA_VERSION,
            self::RENDERER_VERSION,
            self::SOURCE_PROJECT_ID,
            self::SOURCE_VERSION,
            self::CSS_PATH,
            self::CSS_HASH,
            self::RUNTIME_PATH,
            self::RUNTIME_HASH,
            self::MEDIA_ATTACHMENTS,
            self::UPDATED_AT,
        ];
    }

    public static function register(): void
    {
        register_post_type(self::POST_TYPE, [
            'labels' => [
                'name' => __('Pagecraft global elements', 'pagecraft-builder'),
                'singular_name' => __('Pagecraft global element', 'pagecraft-builder'),
            ],
            'public' => false,
            'show_ui' => false,
            'show_in_rest' => false,
            'rewrite' => false,
            'query_var' => false,
            'supports' => ['title', 'editor', 'revisions', 'custom-fields'],
            'map_meta_cap' => true,
            'capability_type' => ['page', 'pages'],
        ]);

        foreach (self::keys() as $key) {
            register_post_meta(self::POST_TYPE, $key, [
                'type' => 'string',
                'single' => true,
                'show_in_rest' => false,
                'revisions_enabled' => true,
                'sanitize_callback' => static fn (mixed $value): string => is_string($value) ? $value : '',
                'auth_callback' => static function (bool $allowed, string $metaKey, int $postId): bool {
                    return $allowed || current_user_can('edit_post', $postId);
                },
            ]);
        }
    }

    public function import(PortablePagePackage $package, string $kind): int
    {
        if (!current_user_can(Capabilities::MANAGE)) {
            throw new PackageException('You are not allowed to update Pagecraft global elements.');
        }
        self::assertKind($kind);
        $media = (new MediaLibrary())->import($package);
        try {
            $content = $media->rewriteHtml(FallbackCompiler::globalContent($package, $kind));
            $css = $media->rewrite(FallbackCompiler::globalCss($package));
            $assets = new GeneratedAssetStore();
            $cssAsset = $css !== '' ? $assets->writeCss('global', $css) : null;
            $runtimeAsset = FallbackCompiler::needsRuntime($content) ? $assets->writeRuntime() : null;
            $document = $media->rewrite(CanonicalJson::encode($package->document()->{$kind}));
            $provenance = $package->provenance();
            $metadata = [
                self::KIND => $kind,
                self::DOCUMENT => $document,
                self::SCHEMA_VERSION => (string) $package->manifest()->schemaVersion,
                self::RENDERER_VERSION => (string) $package->manifest()->rendererVersion,
                self::SOURCE_PROJECT_ID => (string) $provenance->sourceId,
                self::SOURCE_VERSION => (string) $provenance->sourceVersion,
                self::CSS_PATH => $cssAsset['path'] ?? '',
                self::CSS_HASH => $cssAsset['hash'] ?? '',
                self::RUNTIME_PATH => $runtimeAsset['path'] ?? '',
                self::RUNTIME_HASH => $runtimeAsset['hash'] ?? '',
                self::MEDIA_ATTACHMENTS => $media->attachmentIdsJson(),
                self::UPDATED_AT => gmdate('c'),
            ];

            $existing = get_page_by_path(self::slug($kind), OBJECT, self::POST_TYPE);
            $postId = is_object($existing) && isset($existing->ID) ? (int) $existing->ID : 0;
            if ($postId > 0) {
                if (!post_type_supports(self::POST_TYPE, 'revisions') || !wp_revisions_enabled(get_post($postId))) {
                    throw new PackageException('WordPress revisions must be enabled for Pagecraft global elements.');
                }
                $revision = wp_save_post_revision($postId);
                if (is_wp_error($revision)) {
                    throw new PackageException('WordPress could not revise the Pagecraft ' . $kind . ': ' . $revision->get_error_message());
                }
                $saved = wp_update_post([
                    'ID' => $postId,
                    'post_content' => wp_slash($content),
                ], true);
            } else {
                $saved = wp_insert_post([
                    'post_type' => self::POST_TYPE,
                    'post_status' => 'publish',
                    'post_title' => $kind === 'header' ? 'Pagecraft Header' : 'Pagecraft Footer',
                    'post_name' => self::slug($kind),
                    'post_content' => wp_slash($content),
                    'meta_input' => array_map('wp_slash', $metadata),
                ], true);
            }
            if (is_wp_error($saved)) {
                throw new PackageException('WordPress could not store the Pagecraft ' . $kind . ': ' . $saved->get_error_message());
            }
            $postId = (int) $saved;
            foreach ($metadata as $key => $value) {
                update_post_meta($postId, $key, wp_slash($value));
            }

            return $postId;
        } catch (\Throwable $error) {
            $media->rollback();
            throw $error;
        }
    }

    private static function assertKind(string $kind): void
    {
        if (!in_array($kind, ['header', 'footer'], true)) {
            throw new PackageException('The Pagecraft global element kind is invalid.');
        }
    }

    private static function slug(string $kind): string
    {
        return 'pagecraft-' . $kind;
    }
}
