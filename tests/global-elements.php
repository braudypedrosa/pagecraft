<?php

declare(strict_types=1);

if ($argc < 2) {
    throw new RuntimeException('Package fixture path is required.');
}

define('ABSPATH', __DIR__ . '/');
define('OBJECT', 'OBJECT');
define('PAGECRAFT_BUILDER_DIR', dirname(__DIR__) . '/pagecraft-builder/');

$GLOBALS['pc_global_posts'] = [];
$GLOBALS['pc_global_meta'] = [];
$GLOBALS['pc_global_revisions'] = [];
$GLOBALS['pc_global_next'] = 700;
$GLOBALS['pc_global_uploads'] = sys_get_temp_dir() . '/pagecraft-globals-' . substr(hash('sha256', $argv[1]), 0, 16);

final class WP_Error
{
    public function __construct(private string $message) {}
    public function get_error_message(): string { return $this->message; }
}

function is_wp_error(mixed $value): bool { return $value instanceof WP_Error; }
function current_user_can(string $capability, mixed ...$args): bool { return true; }
function sanitize_text_field(string $value): string { return trim(strip_tags($value)); }
function sanitize_file_name(string $value): string
{
    return trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '-', basename($value)), '-');
}
function esc_attr(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function esc_url_raw(string $value): string { return filter_var($value, FILTER_VALIDATE_URL) ? $value : ''; }
function wp_slash(mixed $value): mixed { return is_string($value) ? addslashes($value) : $value; }
function pc_global_unslash(mixed $value): mixed
{
    if (is_array($value)) return array_map('pc_global_unslash', $value);
    return is_string($value) ? stripslashes($value) : $value;
}
function wp_kses(string $html, array $allowed, array $protocols): string { return $html; }
function wp_upload_dir(): array
{
    return [
        'basedir' => $GLOBALS['pc_global_uploads'],
        'baseurl' => 'https://example.test/wp-content/uploads',
        'error' => false,
    ];
}
function wp_mkdir_p(string $directory): bool { return is_dir($directory) || mkdir($directory, 0777, true); }
function get_page_by_path(string $path, string $output, string $postType): object|null
{
    foreach ($GLOBALS['pc_global_posts'] as $post) {
        if (($post['post_name'] ?? '') === $path && ($post['post_type'] ?? '') === $postType) return (object) $post;
    }
    return null;
}
function wp_insert_post(array $post, bool $wpError = false): int|WP_Error
{
    $post = pc_global_unslash($post);
    $id = $GLOBALS['pc_global_next']++;
    $meta = $post['meta_input'] ?? [];
    unset($post['meta_input']);
    $post['ID'] = $id;
    $GLOBALS['pc_global_posts'][$id] = $post;
    $GLOBALS['pc_global_meta'][$id] = $meta;
    return $id;
}
function wp_insert_attachment(array $post, string $file, int $parent = 0, bool $wpError = false): int|WP_Error
{
    $post['post_type'] = 'attachment';
    $post['post_parent'] = $parent;
    $id = wp_insert_post($post, $wpError);
    if (is_int($id)) {
        $GLOBALS['pc_global_meta'][$id]['_attached_file'] = $file;
        $GLOBALS['pc_global_meta'][$id]['_attachment_url'] = 'https://example.test/wp-content/uploads/' . basename($file);
    }
    return $id;
}
function wp_update_post(array $post, bool $wpError = false): int|WP_Error
{
    $post = pc_global_unslash($post);
    $id = (int) ($post['ID'] ?? 0);
    if (!isset($GLOBALS['pc_global_posts'][$id])) return new WP_Error('missing post');
    $GLOBALS['pc_global_posts'][$id] = array_merge($GLOBALS['pc_global_posts'][$id], $post);
    return $id;
}
function update_post_meta(int $postId, string $key, mixed $value): int
{
    $GLOBALS['pc_global_meta'][$postId][$key] = pc_global_unslash($value);
    return 1;
}
function get_post_meta(int $postId, string $key, bool $single = false): mixed
{
    if (isset($GLOBALS['pc_global_revisions'][$postId]['meta'])) {
        return $GLOBALS['pc_global_revisions'][$postId]['meta'][$key] ?? '';
    }
    return $GLOBALS['pc_global_meta'][$postId][$key] ?? '';
}
function get_posts(array $args): array
{
    $types = (array) ($args['post_type'] ?? 'post');
    $ids = [];
    foreach ($GLOBALS['pc_global_posts'] as $id => $post) {
        if (!in_array(($post['post_type'] ?? ''), $types, true)) continue;
        if (($post['post_type'] ?? '') === 'attachment') {
            $key = (string) ($args['meta_key'] ?? '');
            $value = (string) ($args['meta_value'] ?? '');
            if ($key !== '' && (string) ($GLOBALS['pc_global_meta'][$id][$key] ?? '') !== $value) continue;
        }
        $ids[] = (int) $id;
    }
    if (in_array('revision', $types, true)) {
        $ids = array_merge($ids, array_map('intval', array_keys($GLOBALS['pc_global_revisions'])));
    }
    $metaQuery = $args['meta_query'][0] ?? null;
    if (is_array($metaQuery)) {
        $ids = array_values(array_filter($ids, static function (int $id) use ($metaQuery): bool {
            return str_contains((string) get_post_meta($id, (string) $metaQuery['key'], true), (string) $metaQuery['value']);
        }));
    }
    return $ids;
}
function wp_upload_bits(string $name, ?string $deprecated, string $bytes): array
{
    $directory = $GLOBALS['pc_global_uploads'] . '/media';
    if (!wp_mkdir_p($directory)) return ['error' => 'directory failed'];
    $path = $directory . '/' . sanitize_file_name($name);
    $info = pathinfo($path);
    $suffix = 1;
    while (is_file($path)) {
        $path = $info['dirname'] . '/' . $info['filename'] . '-' . $suffix++
            . (isset($info['extension']) ? '.' . $info['extension'] : '');
    }
    file_put_contents($path, $bytes);
    return ['file' => $path, 'url' => 'https://example.test/wp-content/uploads/' . basename($path), 'error' => false];
}
function get_attached_file(int $attachmentId): string|false
{
    return $GLOBALS['pc_global_meta'][$attachmentId]['_attached_file'] ?? false;
}
function wp_get_attachment_url(int $attachmentId): string|false
{
    return $GLOBALS['pc_global_meta'][$attachmentId]['_attachment_url'] ?? false;
}
function wp_generate_attachment_metadata(int $attachmentId, string $file): array
{
    return ['width' => 1, 'height' => 1];
}
function wp_update_attachment_metadata(int $attachmentId, array $metadata): bool
{
    $GLOBALS['pc_global_meta'][$attachmentId]['_wp_attachment_metadata'] = $metadata;
    return true;
}
function wp_get_attachment_image_srcset(int $attachmentId, string|array $size = 'medium'): string|false
{
    $url = wp_get_attachment_url($attachmentId);
    return is_string($url) ? $url . ' 1w' : false;
}
function wp_get_attachment_image_sizes(int $attachmentId, string|array $size = 'medium'): string|false
{
    return wp_get_attachment_url($attachmentId) ? '100vw' : false;
}
function wp_delete_attachment(int $attachmentId, bool $force = false): object|false
{
    if (($GLOBALS['pc_global_posts'][$attachmentId]['post_type'] ?? '') !== 'attachment') return false;
    $file = get_attached_file($attachmentId);
    if (is_string($file) && is_file($file)) unlink($file);
    $deleted = (object) $GLOBALS['pc_global_posts'][$attachmentId];
    $deleted->ID = $attachmentId;
    unset($GLOBALS['pc_global_posts'][$attachmentId], $GLOBALS['pc_global_meta'][$attachmentId]);
    return $deleted;
}
function post_type_supports(string $postType, string $feature): bool
{
    return $postType === 'pagecraft_global' && $feature === 'revisions';
}
function get_post(int $postId): ?object
{
    return isset($GLOBALS['pc_global_posts'][$postId]) ? (object) $GLOBALS['pc_global_posts'][$postId] : null;
}
function wp_revisions_enabled(?object $post): bool { return $post !== null; }
function wp_save_post_revision(int $postId): int|WP_Error
{
    if (!isset($GLOBALS['pc_global_posts'][$postId])) return new WP_Error('missing post');
    $id = 5000 + count($GLOBALS['pc_global_revisions']);
    $GLOBALS['pc_global_revisions'][$id] = [
        'post' => $GLOBALS['pc_global_posts'][$postId],
        'meta' => $GLOBALS['pc_global_meta'][$postId],
    ];
    return $id;
}
function pc_global_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

require dirname(__DIR__) . '/pagecraft-builder/includes/Autoload.php';
\Pagecraft\Builder\Autoload::register();

$package = \Pagecraft\Builder\PortablePagePackage::fromFile($argv[1]);
$repository = new \Pagecraft\Builder\GlobalElement();
$headerId = $repository->import($package, 'header');
$footerId = $repository->import($package, 'footer');

$globalPosts = array_filter(
    $GLOBALS['pc_global_posts'],
    static fn (array $post): bool => ($post['post_type'] ?? '') === 'pagecraft_global'
);
$attachments = array_filter(
    $GLOBALS['pc_global_posts'],
    static fn (array $post): bool => ($post['post_type'] ?? '') === 'attachment'
);
pc_global_assert(count($globalPosts) === 2, 'Global import did not create exactly two native entities.');
pc_global_assert(count($attachments) === 1, 'Global import did not localize package media exactly once.');
$attachmentId = (int) array_key_first($attachments);
pc_global_assert(
    ($GLOBALS['pc_global_meta'][$headerId]['_pagecraft_media_attachments'] ?? '') === '["' . $attachmentId . '"]'
        && ($GLOBALS['pc_global_meta'][$footerId]['_pagecraft_media_attachments'] ?? '') === '["' . $attachmentId . '"]',
    'Global elements did not retain their native media relationships.'
);
pc_global_assert(
    \Pagecraft\Builder\MediaLibrary::preventReferencedDeletion(null, (object) ['ID' => $attachmentId], true) === false,
    'A global-element media reference was not protected from deletion.'
);
pc_global_assert(
    str_contains($GLOBALS['pc_global_posts'][$headerId]['post_content'], 'data-nav'),
    'The Pagecraft global header markup was not preserved.'
);
pc_global_assert(
    !str_contains(strtolower($GLOBALS['pc_global_posts'][$headerId]['post_content']), '<header'),
    'The stored header contains a nested landmark instead of leaving landmark ownership to the theme.'
);
pc_global_assert(
    !str_contains($GLOBALS['pc_global_posts'][$headerId]['post_content'], '.html')
        && str_contains($GLOBALS['pc_global_posts'][$headerId]['post_content'], 'href="/"'),
    'The global header retained a static .html URL instead of a clean WordPress route.'
);
pc_global_assert(
    str_contains($GLOBALS['pc_global_posts'][$footerId]['post_content'], 'Pagecraft global footer'),
    'The Pagecraft global footer markup was not preserved.'
);
pc_global_assert(
    ($GLOBALS['pc_global_meta'][$headerId]['_pagecraft_global_kind'] ?? '') === 'header'
        && ($GLOBALS['pc_global_meta'][$footerId]['_pagecraft_global_kind'] ?? '') === 'footer',
    'Global entity kinds are not stable.'
);
$globalCss = $GLOBALS['pc_global_meta'][$headerId]['_pagecraft_global_css_path'] ?? '';
pc_global_assert(
    $globalCss !== '' && $globalCss === ($GLOBALS['pc_global_meta'][$footerId]['_pagecraft_global_css_path'] ?? ''),
    'Header and footer did not deduplicate the shared global stylesheet.'
);
pc_global_assert(
    is_file($GLOBALS['pc_global_uploads'] . '/' . $globalCss),
    'The global stylesheet was not stored outside the installed theme.'
);
pc_global_assert(
    preg_match('#^pagecraft/runtime-[a-f0-9]{64}\.js$#', $GLOBALS['pc_global_meta'][$headerId]['_pagecraft_runtime_path'] ?? '') === 1,
    'Interactive global navigation did not retain the trusted runtime.'
);

$oldHeader = $GLOBALS['pc_global_posts'][$headerId]['post_content'];
$sameHeaderId = $repository->import($package, 'header');
pc_global_assert($sameHeaderId === $headerId, 'Updating the global header created a duplicate entity.');
pc_global_assert(count($GLOBALS['pc_global_revisions']) === 1, 'Updating the global header did not create a revision.');
$revision = reset($GLOBALS['pc_global_revisions']);
pc_global_assert($revision['post']['post_content'] === $oldHeader, 'The global header revision is not recoverable.');

foreach (glob($GLOBALS['pc_global_uploads'] . '/pagecraft/*') ?: [] as $asset) unlink($asset);
if (is_dir($GLOBALS['pc_global_uploads'] . '/pagecraft')) rmdir($GLOBALS['pc_global_uploads'] . '/pagecraft');
foreach (glob($GLOBALS['pc_global_uploads'] . '/media/*') ?: [] as $asset) unlink($asset);
if (is_dir($GLOBALS['pc_global_uploads'] . '/media')) rmdir($GLOBALS['pc_global_uploads'] . '/media');
if (is_dir($GLOBALS['pc_global_uploads'])) rmdir($GLOBALS['pc_global_uploads']);

echo "Revision-backed Pagecraft global elements and generated assets are valid.\n";
