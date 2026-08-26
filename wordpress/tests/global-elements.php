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

pc_global_assert(count($GLOBALS['pc_global_posts']) === 2, 'Global import did not create exactly two native entities.');
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
if (is_dir($GLOBALS['pc_global_uploads'])) rmdir($GLOBALS['pc_global_uploads']);

echo "Revision-backed Pagecraft global elements and generated assets are valid.\n";
