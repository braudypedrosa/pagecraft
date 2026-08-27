<?php

declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');

$GLOBALS['pagecraft_test_actions'] = [];
$GLOBALS['pagecraft_test_activation'] = null;
$GLOBALS['pagecraft_test_caps'] = [];
$GLOBALS['pagecraft_test_options'] = [];
$GLOBALS['pagecraft_test_meta'] = [];
$GLOBALS['pagecraft_test_routes'] = [];
$GLOBALS['pagecraft_test_can'] = true;

final class WP_REST_Request implements ArrayAccess
{
    public function __construct(private array $values = []) {}
    public function offsetExists(mixed $offset): bool { return isset($this->values[$offset]); }
    public function offsetGet(mixed $offset): mixed { return $this->values[$offset] ?? null; }
    public function offsetSet(mixed $offset, mixed $value): void { $this->values[$offset] = $value; }
    public function offsetUnset(mixed $offset): void { unset($this->values[$offset]); }
}

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

function add_filter(string $hook, callable $callback, int $priority = 10, int $acceptedArgs = 1): void
{
    $GLOBALS['pagecraft_test_actions']['filter:' . $hook][] = $callback;
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

function __(string $text, string $domain): string
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

function register_post_meta(string $post_type, string $key, array $args): bool
{
    $GLOBALS['pagecraft_test_meta'][$post_type . ':' . $key] = [$post_type, $key, $args];
    return true;
}

function register_post_type(string $post_type, array $args): object
{
    $GLOBALS['pagecraft_test_post_types'][$post_type] = $args;
    return (object) $args;
}

function current_user_can(string $capability, mixed ...$args): bool
{
    return $GLOBALS['pagecraft_test_can'];
}

function register_rest_route(string $namespace, string $route, array $args): bool
{
    $GLOBALS['pagecraft_test_routes'][$namespace . $route] = $args;
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
foreach ($GLOBALS['pagecraft_test_actions']['init'] ?? [] as $callback) {
    $callback();
}
foreach ($GLOBALS['pagecraft_test_actions']['rest_api_init'] ?? [] as $callback) {
    $callback();
}

$loaded = array_filter(
    $GLOBALS['pagecraft_test_actions']['fired'] ?? [],
    static fn (array $action): bool => $action[0] === 'pagecraft_builder_loaded' && $action[1] === ['0.2.0']
);
pagecraft_test_assert($loaded !== [], 'Builder did not publish its local boot action.');
pagecraft_test_assert(isset($GLOBALS['pagecraft_test_actions']['rest_api_init']), 'Builder REST routes were not registered.');
pagecraft_test_assert(isset($GLOBALS['pagecraft_test_actions']['admin_menu']), 'Pagecraft top-level admin menu was not registered.');
pagecraft_test_assert(isset($GLOBALS['pagecraft_test_actions']['wp_ajax_pagecraft_editor_frame']), 'Secure editor frame was not registered.');
pagecraft_test_assert(isset($GLOBALS['pagecraft_test_actions']['admin_post_pagecraft_add_page_to_menu']), 'Explicit Add to menu action was not registered.');
pagecraft_test_assert(isset($GLOBALS['pagecraft_test_actions']['filter:page_row_actions']), 'Native Pages row actions were not registered.');
$documentRoute = $GLOBALS['pagecraft_test_routes']['pagecraft/v1/pages/(?P<id>\d+)/document'] ?? null;
pagecraft_test_assert(is_array($documentRoute) && count($documentRoute) === 2, 'Document load/save REST route is incomplete.');
$menusRoute = $GLOBALS['pagecraft_test_routes']['pagecraft/v1/menus'] ?? null;
$menuRoute = $GLOBALS['pagecraft_test_routes']['pagecraft/v1/menus/(?P<id>\d+)'] ?? null;
pagecraft_test_assert(is_array($menusRoute) && is_array($menuRoute) && count($menuRoute) === 2, 'Native menu REST routes are incomplete.');
$GLOBALS['pagecraft_test_can'] = false;
pagecraft_test_assert(
    $documentRoute[0]['permission_callback'](new WP_REST_Request(['id' => 42])) === false
        && $documentRoute[1]['permission_callback'](new WP_REST_Request(['id' => 42])) === false,
    'Unauthorized users can load or save Pagecraft documents.'
);
pagecraft_test_assert(
    $menusRoute['permission_callback']() === false
        && $menuRoute[0]['permission_callback']() === false
        && $menuRoute[1]['permission_callback']() === false,
    'Unauthorized users can read or write native WordPress menus.'
);
$GLOBALS['pagecraft_test_can'] = true;
pagecraft_test_assert(pagecraft_builder_is_managed_page(42), 'Pagecraft document metadata was not recognized.');
pagecraft_test_assert(!pagecraft_builder_is_managed_page(43), 'An empty page was incorrectly marked as Pagecraft-managed.');
pagecraft_test_assert(!pagecraft_builder_is_managed_page(99), 'A non-page post was incorrectly marked as Pagecraft-managed.');

$expected_meta = [
    '_pagecraft_document', '_pagecraft_schema_version', '_pagecraft_renderer_version',
    '_pagecraft_source_project_id', '_pagecraft_source_page_id', '_pagecraft_source_origin',
    '_pagecraft_source_version', '_pagecraft_provenance', '_pagecraft_imported_at',
    '_pagecraft_compiled_hash', '_pagecraft_compiled_css', '_pagecraft_global_css_path',
    '_pagecraft_global_css_hash', '_pagecraft_page_css_path', '_pagecraft_page_css_hash',
    '_pagecraft_runtime_path', '_pagecraft_runtime_hash', '_pagecraft_package_hash',
    '_pagecraft_document_version', '_pagecraft_conversion_revision',
];
sort($expected_meta);
$registered_page_meta = [];
foreach ($GLOBALS['pagecraft_test_meta'] as [$post_type, $key, $args]) {
    if ($post_type === 'page') $registered_page_meta[] = $key;
}
sort($registered_page_meta);
pagecraft_test_assert($registered_page_meta === $expected_meta, 'Managed-page metadata contract is incomplete.');
foreach ($GLOBALS['pagecraft_test_meta'] as [$post_type, $key, $args]) {
    pagecraft_test_assert(in_array($post_type, ['page', 'pagecraft_global'], true), 'Pagecraft metadata escaped its native entities.');
    pagecraft_test_assert(($args['revisions_enabled'] ?? false) === true, 'Pagecraft metadata is not revision-enabled.');
}
pagecraft_test_assert(
    ($GLOBALS['pagecraft_test_post_types']['pagecraft_global']['supports'] ?? []) === ['title', 'editor', 'revisions', 'custom-fields'],
    'Global header/footer entities are not revision-capable native records.'
);
foreach ($GLOBALS['pagecraft_test_meta'] as [$post_type, $key, $args]) {
    if ($post_type !== 'page') continue;
    pagecraft_test_assert($post_type === 'page', 'Pagecraft metadata was registered outside native pages.');
}

$activation = $GLOBALS['pagecraft_test_activation'];
pagecraft_test_assert(is_callable($activation), 'Builder activation callback is missing.');
$activation();

$expected_caps = ['edit_pagecraft_pages', 'import_pagecraft_pages', 'manage_pagecraft_settings'];
sort($expected_caps);
sort($GLOBALS['pagecraft_test_caps']);
pagecraft_test_assert($GLOBALS['pagecraft_test_caps'] === $expected_caps, 'Builder capabilities do not match the native ownership contract.');
pagecraft_test_assert(($GLOBALS['pagecraft_test_options']['pagecraft_builder_version'] ?? null) === '0.2.0', 'Builder version option was not recorded.');

echo "Pagecraft Builder native ownership contract is valid.\n";
