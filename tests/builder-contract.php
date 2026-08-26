<?php

declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');

$GLOBALS['pagecraft_test_actions'] = [];
$GLOBALS['pagecraft_test_activation'] = null;
$GLOBALS['pagecraft_test_caps'] = [];
$GLOBALS['pagecraft_test_options'] = [];

function plugin_dir_path(string $file): string
{
    return dirname($file) . '/';
}

function plugin_dir_url(string $file): string
{
    return 'https://example.test/wp-content/plugins/' . basename(dirname($file)) . '/';
}

function plugin_basename(string $file): string
{
    return basename(dirname($file)) . '/' . basename($file);
}

function register_activation_hook(string $file, callable $callback): void
{
    $GLOBALS['pagecraft_test_activation'] = $callback;
}

function add_action(string $hook, callable $callback): void
{
    $GLOBALS['pagecraft_test_actions'][$hook][] = $callback;
}

function do_action(string $hook, mixed ...$args): void
{
    $GLOBALS['pagecraft_test_actions']['fired'][] = [$hook, $args];
}

function is_multisite(): bool
{
    return false;
}

function get_bloginfo(string $field): string
{
    return $field === 'version' ? '6.6' : '';
}

function esc_html__(string $text, string $domain): string
{
    return $text;
}

function load_plugin_textdomain(string $domain, bool $deprecated = false, string $path = ''): bool
{
    return true;
}

function get_the_ID(): int
{
    return 42;
}

function get_post_type(int $post_id): string
{
    return in_array($post_id, [42, 43], true) ? 'page' : 'post';
}

function get_post_meta(int $post_id, string $key, bool $single): string
{
    return $post_id === 42 && $key === '_pagecraft_document' ? '{"schemaVersion":1}' : '';
}

function get_role(string $role): ?object
{
    if ($role !== 'administrator') {
        return null;
    }

    return new class {
        public function add_cap(string $capability): void
        {
            $GLOBALS['pagecraft_test_caps'][] = $capability;
        }
    };
}

function update_option(string $name, mixed $value, bool $autoload = true): bool
{
    $GLOBALS['pagecraft_test_options'][$name] = $value;
    return true;
}

function deactivate_plugins(string $plugin): void
{
    throw new RuntimeException('Compatible test runtime must not deactivate the plugin: ' . $plugin);
}

function wp_die(string $message): never
{
    throw new RuntimeException($message);
}

function pagecraft_test_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

require dirname(__DIR__) . '/pagecraft-builder/pagecraft-builder.php';

pagecraft_test_assert(defined('PAGECRAFT_BUILDER_VERSION'), 'Builder version constant is missing.');
pagecraft_test_assert(PAGECRAFT_BUILDER_VERSION === '0.2.0', 'Unexpected Builder version.');
pagecraft_test_assert(!defined('PAGECRAFT_CONNECTOR_VERSION'), 'Retired Connector constant was loaded.');
pagecraft_test_assert(!class_exists('Pagecraft\\Connector\\Sync'), 'Retired Connected Sync class was loaded.');

foreach ($GLOBALS['pagecraft_test_actions']['plugins_loaded'] ?? [] as $callback) {
    $callback();
}

$loaded = array_filter(
    $GLOBALS['pagecraft_test_actions']['fired'] ?? [],
    static fn (array $action): bool => $action[0] === 'pagecraft_builder_loaded' && $action[1] === ['0.2.0']
);
pagecraft_test_assert($loaded !== [], 'Builder did not publish its local boot action.');
pagecraft_test_assert(pagecraft_builder_is_managed_page(42), 'Pagecraft document metadata was not recognized.');
pagecraft_test_assert(!pagecraft_builder_is_managed_page(43), 'An empty page was incorrectly marked as Pagecraft-managed.');
pagecraft_test_assert(!pagecraft_builder_is_managed_page(99), 'A non-page post was incorrectly marked as Pagecraft-managed.');

$activation = $GLOBALS['pagecraft_test_activation'];
pagecraft_test_assert(is_callable($activation), 'Builder activation callback is missing.');
$activation();

$expected_caps = ['edit_pagecraft_pages', 'import_pagecraft_pages', 'manage_pagecraft_settings'];
sort($expected_caps);
sort($GLOBALS['pagecraft_test_caps']);
pagecraft_test_assert($GLOBALS['pagecraft_test_caps'] === $expected_caps, 'Builder capabilities do not match the native ownership contract.');
pagecraft_test_assert(($GLOBALS['pagecraft_test_options']['pagecraft_builder_version'] ?? null) === '0.2.0', 'Builder version option was not recorded.');

echo "Pagecraft Builder native ownership contract is valid.\n";
