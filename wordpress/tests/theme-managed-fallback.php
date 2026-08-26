<?php

declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');

$GLOBALS['pc_theme_filters'] = [];
$GLOBALS['pc_theme_actions'] = [];
$GLOBALS['pc_theme_styles'] = [];
$GLOBALS['pc_theme_post'] = 42;
$GLOBALS['pc_theme_title_calls'] = 0;

function add_filter(string $hook, callable $callback, int $priority = 10): void
{
    $GLOBALS['pc_theme_filters'][$hook][] = $callback;
}

function add_action(string $hook, callable $callback, int $priority = 10): void
{
    $GLOBALS['pc_theme_actions'][$hook][] = $callback;
}

function get_queried_object_id(): int
{
    return $GLOBALS['pc_theme_post'];
}

function get_the_ID(): int
{
    return $GLOBALS['pc_theme_post'];
}

function the_ID(): void
{
    echo (string) $GLOBALS['pc_theme_post'];
}

function get_post_type(int $postId): string
{
    return $postId === 42 ? 'page' : 'post';
}

function get_post_meta(int $postId, string $key, bool $single = false): string
{
    if ($postId !== 42) {
        return '';
    }
    return match ($key) {
        '_pagecraft_document' => '{"schemaVersion":13}',
        '_pagecraft_compiled_css' => '.pagecraft-main{display:block}',
        default => '',
    };
}

function wp_register_style(string $handle, string|false $source, array $dependencies = [], string|bool|null $version = false): bool
{
    $GLOBALS['pc_theme_styles']['registered'][$handle] = [$source, $version];
    return true;
}

function wp_enqueue_style(string $handle): void
{
    $GLOBALS['pc_theme_styles']['enqueued'][] = $handle;
}

function wp_add_inline_style(string $handle, string $css): bool
{
    $GLOBALS['pc_theme_styles']['inline'][$handle] = $css;
    return true;
}

function post_class(string $class): void
{
    echo 'class="' . htmlspecialchars($class, ENT_QUOTES) . '"';
}

function the_content(): void
{
    echo '<div data-pagecraft-fallback="1">Still visible</div>';
}

function the_title(string $before = '', string $after = ''): void
{
    $GLOBALS['pc_theme_title_calls']++;
    echo $before . 'Duplicate title' . $after;
}

function has_post_thumbnail(): bool
{
    return false;
}

function pc_theme_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

require dirname(__DIR__) . '/pagecraft-theme/inc/pagecraft-integration.php';

pc_theme_assert(pagecraft_theme_is_managed_page(42), 'Theme did not recognize managed metadata without the plugin.');
$classes = ($GLOBALS['pc_theme_filters']['body_class'][0])([]);
pc_theme_assert(in_array('pagecraft-theme-managed', $classes, true), 'Managed body class is missing.');
($GLOBALS['pc_theme_actions']['wp_enqueue_scripts'][0])();
pc_theme_assert(
    ($GLOBALS['pc_theme_styles']['inline']['pagecraft-managed-page'] ?? '') === '.pagecraft-main{display:block}',
    'Theme did not retain compiled styling without the plugin.'
);

ob_start();
require dirname(__DIR__) . '/pagecraft-theme/template-parts/content-page.php';
$rendered = (string) ob_get_clean();
pc_theme_assert(str_contains($rendered, 'Still visible'), 'Managed fallback content became blank.');
pc_theme_assert($GLOBALS['pc_theme_title_calls'] === 0, 'Managed fallback duplicated the Pagecraft title.');
pc_theme_assert(str_contains($rendered, 'pagecraft-managed-content'), 'Managed fallback wrapper is missing.');

echo "Pagecraft Theme plugin-disabled fallback contract is valid.\n";
