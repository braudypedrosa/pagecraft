<?php

declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');
define('OBJECT', 'OBJECT');

$GLOBALS['pc_theme_filters'] = [];
$GLOBALS['pc_theme_actions'] = [];
$GLOBALS['pc_theme_styles'] = [];
$GLOBALS['pc_theme_scripts'] = [];
$GLOBALS['pc_theme_post'] = 42;
$GLOBALS['pc_theme_title_calls'] = 0;
$GLOBALS['pc_theme_uploads'] = sys_get_temp_dir() . '/pagecraft-theme-' . bin2hex(random_bytes(6));

$sharedCss = '.pagecraft-global{display:block}';
$pageCss = '.pagecraft-main{display:block}';
$runtime = '(function(){window.pagecraftRuntime=true;}());';
$sharedHash = hash('sha256', $sharedCss);
$pageHash = hash('sha256', $pageCss);
$runtimeHash = hash('sha256', $runtime);
$assetDirectory = $GLOBALS['pc_theme_uploads'] . '/pagecraft';
mkdir($assetDirectory, 0777, true);
file_put_contents($assetDirectory . '/global-' . $sharedHash . '.css', $sharedCss);
file_put_contents($assetDirectory . '/page-' . $pageHash . '.css', $pageCss);
file_put_contents($assetDirectory . '/runtime-' . $runtimeHash . '.js', $runtime);

$GLOBALS['pc_theme_meta'] = [
    42 => [
        '_pagecraft_document' => '{"schemaVersion":13}',
        '_pagecraft_compiled_css' => '.legacy{display:none}',
        '_pagecraft_global_css_path' => 'pagecraft/global-' . $sharedHash . '.css',
        '_pagecraft_global_css_hash' => $sharedHash,
        '_pagecraft_page_css_path' => 'pagecraft/page-' . $pageHash . '.css',
        '_pagecraft_page_css_hash' => $pageHash,
        '_pagecraft_runtime_path' => 'pagecraft/runtime-' . $runtimeHash . '.js',
        '_pagecraft_runtime_hash' => $runtimeHash,
    ],
    80 => [
        '_pagecraft_global_css_path' => 'pagecraft/global-' . $sharedHash . '.css',
        '_pagecraft_global_css_hash' => $sharedHash,
        '_pagecraft_runtime_path' => 'pagecraft/runtime-' . $runtimeHash . '.js',
        '_pagecraft_runtime_hash' => $runtimeHash,
    ],
    81 => [
        '_pagecraft_global_css_path' => 'pagecraft/global-' . $sharedHash . '.css',
        '_pagecraft_global_css_hash' => $sharedHash,
    ],
];

function add_filter(string $hook, callable $callback, int $priority = 10): void
{
    $GLOBALS['pc_theme_filters'][$hook][] = $callback;
}
function add_action(string $hook, callable $callback, int $priority = 10): void
{
    $GLOBALS['pc_theme_actions'][$hook][] = $callback;
}
function get_queried_object_id(): int { return $GLOBALS['pc_theme_post']; }
function get_the_ID(): int { return $GLOBALS['pc_theme_post']; }
function the_ID(): void { echo (string) $GLOBALS['pc_theme_post']; }
function get_post_type(int $postId): string { return $postId === 42 ? 'page' : 'pagecraft_global'; }
function get_post_meta(int $postId, string $key, bool $single = false): string
{
    return $GLOBALS['pc_theme_meta'][$postId][$key] ?? '';
}
function get_page_by_path(string $path, string $output, string $postType): object|null
{
    return match ($path) {
        'pagecraft-header' => (object) ['ID' => 80],
        'pagecraft-footer' => (object) ['ID' => 81],
        default => null,
    };
}
function get_post_field(string $field, int $postId): string
{
    return match ($postId) {
        80 => '<nav data-nav aria-label="Primary"><button data-nav-t type="button">Menu</button></nav>',
        81 => '<p>Stored Pagecraft footer</p>',
        default => '',
    };
}
function esc_attr(string $value): string { return htmlspecialchars($value, ENT_QUOTES); }
function sanitize_title(string $value): string { return strtolower(preg_replace('/[^a-z0-9_-]+/i', '-', trim($value)) ?? ''); }
function sanitize_html_class(string $value, string $fallback = ''): string
{
    $clean = preg_replace('/[^A-Za-z0-9_-]/', '', $value) ?? '';
    return $clean !== '' ? $clean : $fallback;
}
function get_nav_menu_locations(): array { return ['primary' => 90]; }
function wp_nav_menu(array $args): string
{
    return str_replace('%3$s', '<li class="menu-item"><a href="/native-page/">Native page</a></li>', $args['items_wrap']);
}
function wp_upload_dir(): array
{
    return [
        'basedir' => $GLOBALS['pc_theme_uploads'],
        'baseurl' => 'https://example.test/wp-content/uploads',
        'error' => false,
    ];
}
function trailingslashit(string $value): string { return rtrim($value, '/\\') . '/'; }
function wp_enqueue_style(
    string $handle,
    string|false $source = '',
    array $dependencies = [],
    string|bool|null $version = false
): void {
    $GLOBALS['pc_theme_styles']['enqueued'][$handle] = [$source, $version];
}
function wp_register_style(string $handle, string|false $source, array $dependencies = [], string|bool|null $version = false): bool
{
    $GLOBALS['pc_theme_styles']['registered'][$handle] = [$source, $version];
    return true;
}
function wp_add_inline_style(string $handle, string $css): bool
{
    $GLOBALS['pc_theme_styles']['inline'][$handle] = $css;
    return true;
}
function wp_enqueue_script(
    string $handle,
    string $source = '',
    array $dependencies = [],
    string|bool|null $version = false,
    array|bool $args = false
): void {
    $GLOBALS['pc_theme_scripts'][$handle] = [$source, $version, $args];
}
function post_class(string $class): void { echo 'class="' . htmlspecialchars($class, ENT_QUOTES) . '"'; }
function the_content(): void { echo '<div data-pagecraft-fallback="1">Still visible</div>'; }
function the_title(string $before = '', string $after = ''): void
{
    $GLOBALS['pc_theme_title_calls']++;
    echo $before . 'Duplicate title' . $after;
}
function has_post_thumbnail(): bool { return false; }
function pc_theme_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

require dirname(__DIR__) . '/pagecraft-theme/inc/pagecraft-integration.php';

pc_theme_assert(pagecraft_theme_is_managed_page(42), 'Theme did not recognize managed metadata without the plugin.');
$classes = ($GLOBALS['pc_theme_filters']['body_class'][0])([]);
pc_theme_assert(in_array('pagecraft-theme-managed', $classes, true), 'Managed body class is missing.');
($GLOBALS['pc_theme_actions']['wp_enqueue_scripts'][0])();
pc_theme_assert(count($GLOBALS['pc_theme_styles']['enqueued'] ?? []) === 2, 'Theme did not load exactly the shared and current-page styles.');
pc_theme_assert(count($GLOBALS['pc_theme_scripts']) === 1, 'Theme did not deduplicate the trusted runtime.');
pc_theme_assert(($GLOBALS['pc_theme_styles']['inline'] ?? []) === [], 'A file-backed import fell back to inline CSS.');
$loadedStyles = array_values($GLOBALS['pc_theme_styles']['enqueued']);
pc_theme_assert(
    str_contains((string) $loadedStyles[0][0], '/global-') && str_contains((string) $loadedStyles[1][0], '/page-'),
    'Page-only CSS did not load after the active global presentation.'
);

$GLOBALS['pc_theme_post'] = 43;
$GLOBALS['pc_theme_styles'] = [];
$GLOBALS['pc_theme_scripts'] = [];
pagecraft_theme_enqueue_generated_assets();
pc_theme_assert(count($GLOBALS['pc_theme_styles']['enqueued'] ?? []) === 1, 'An ordinary WordPress route loaded Pagecraft page-only CSS.');
pc_theme_assert(count($GLOBALS['pc_theme_scripts']) === 1, 'The active global navigation runtime was not retained on an ordinary route.');
$GLOBALS['pc_theme_post'] = 42;

ob_start();
pc_theme_assert(pagecraft_theme_render_global('header'), 'Stored Pagecraft header was not found.');
$header = (string) ob_get_clean();
pc_theme_assert(str_contains($header, '<header') && str_contains($header, 'data-nav'), 'Stored header lacks its landmark or markup.');
pc_theme_assert(
    str_contains($header, 'data-pagecraft-menu-location="primary"')
        && str_contains($header, 'href="/native-page/"'),
    'Stored Pagecraft navigation did not render the native menu assigned to Primary navigation.'
);
ob_start();
pc_theme_assert(pagecraft_theme_render_global('footer'), 'Stored Pagecraft footer was not found.');
$footer = (string) ob_get_clean();
pc_theme_assert(str_contains($footer, '<footer') && str_contains($footer, 'Stored Pagecraft footer'), 'Stored footer lacks its landmark or markup.');

ob_start();
require dirname(__DIR__) . '/pagecraft-theme/template-parts/content-page.php';
$rendered = (string) ob_get_clean();
pc_theme_assert(str_contains($rendered, 'Still visible'), 'Managed fallback content became blank.');
pc_theme_assert($GLOBALS['pc_theme_title_calls'] === 0, 'Managed fallback duplicated the Pagecraft title.');
pc_theme_assert(str_contains($rendered, 'pagecraft-managed-content'), 'Managed fallback wrapper is missing.');

foreach (glob($assetDirectory . '/*') ?: [] as $asset) unlink($asset);
rmdir($assetDirectory);
rmdir($GLOBALS['pc_theme_uploads']);

echo "Pagecraft Theme generated-asset and plugin-disabled fallback contract is valid.\n";
