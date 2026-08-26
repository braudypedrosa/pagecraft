<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class ManagedPage
{
    public const DOCUMENT = '_pagecraft_document';
    public const SCHEMA_VERSION = '_pagecraft_schema_version';
    public const RENDERER_VERSION = '_pagecraft_renderer_version';
    public const SOURCE_PROJECT_ID = '_pagecraft_source_project_id';
    public const SOURCE_PAGE_ID = '_pagecraft_source_page_id';
    public const SOURCE_ORIGIN = '_pagecraft_source_origin';
    public const SOURCE_VERSION = '_pagecraft_source_version';
    public const PROVENANCE = '_pagecraft_provenance';
    public const IMPORTED_AT = '_pagecraft_imported_at';
    public const COMPILED_HASH = '_pagecraft_compiled_hash';
    public const COMPILED_CSS = '_pagecraft_compiled_css';
    public const GLOBAL_CSS_PATH = '_pagecraft_global_css_path';
    public const GLOBAL_CSS_HASH = '_pagecraft_global_css_hash';
    public const PAGE_CSS_PATH = '_pagecraft_page_css_path';
    public const PAGE_CSS_HASH = '_pagecraft_page_css_hash';
    public const RUNTIME_PATH = '_pagecraft_runtime_path';
    public const RUNTIME_HASH = '_pagecraft_runtime_hash';
    public const PACKAGE_HASH = '_pagecraft_package_hash';

    /** @return list<string> */
    public static function keys(): array
    {
        return [
            self::DOCUMENT,
            self::SCHEMA_VERSION,
            self::RENDERER_VERSION,
            self::SOURCE_PROJECT_ID,
            self::SOURCE_PAGE_ID,
            self::SOURCE_ORIGIN,
            self::SOURCE_VERSION,
            self::PROVENANCE,
            self::IMPORTED_AT,
            self::COMPILED_HASH,
            self::COMPILED_CSS,
            self::GLOBAL_CSS_PATH,
            self::GLOBAL_CSS_HASH,
            self::PAGE_CSS_PATH,
            self::PAGE_CSS_HASH,
            self::RUNTIME_PATH,
            self::RUNTIME_HASH,
            self::PACKAGE_HASH,
        ];
    }

    public static function register(): void
    {
        foreach (self::keys() as $key) {
            register_post_meta('page', $key, [
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

    public static function isManaged(int $postId): bool
    {
        return $postId > 0
            && get_post_type($postId) === 'page'
            && get_post_meta($postId, self::DOCUMENT, true) !== '';
    }

    /** @return array<string, string> */
    public static function metadata(
        PortablePagePackage $package,
        string $content,
        string $css,
        ?array $globalCss,
        ?array $pageCss,
        ?array $runtime
    ): array
    {
        $provenance = $package->provenance();
        return [
            self::DOCUMENT => $package->documentJson(),
            self::SCHEMA_VERSION => (string) $package->manifest()->schemaVersion,
            self::RENDERER_VERSION => (string) $package->manifest()->rendererVersion,
            self::SOURCE_PROJECT_ID => (string) $provenance->sourceId,
            self::SOURCE_PAGE_ID => (string) $package->manifest()->entryPageId,
            self::SOURCE_ORIGIN => (string) $provenance->origin,
            self::SOURCE_VERSION => (string) $provenance->sourceVersion,
            self::PROVENANCE => CanonicalJson::encode($provenance),
            self::IMPORTED_AT => gmdate('c'),
            self::COMPILED_HASH => hash('sha256', $content),
            self::COMPILED_CSS => $css,
            self::GLOBAL_CSS_PATH => $globalCss['path'] ?? '',
            self::GLOBAL_CSS_HASH => $globalCss['hash'] ?? '',
            self::PAGE_CSS_PATH => $pageCss['path'] ?? '',
            self::PAGE_CSS_HASH => $pageCss['hash'] ?? '',
            self::RUNTIME_PATH => $runtime['path'] ?? '',
            self::RUNTIME_HASH => $runtime['hash'] ?? '',
            self::PACKAGE_HASH => $package->packageHash(),
        ];
    }
}
