<?php

declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');
define('PAGECRAFT_BUILDER_DIR', dirname(__DIR__) . '/pagecraft-builder/');

$GLOBALS['pc_menu_terms'] = [];
$GLOBALS['pc_menu_term_meta'] = [];
$GLOBALS['pc_menu_items'] = [];
$GLOBALS['pc_menu_meta'] = [];
$GLOBALS['pc_menu_locations'] = [];
$GLOBALS['pc_menu_next_term'] = 50;
$GLOBALS['pc_menu_next_item'] = 1000;
$GLOBALS['pc_menu_posts'] = [
    101 => ['post_type' => 'page', 'post_title' => 'Home', 'post_name' => ''],
    102 => ['post_type' => 'page', 'post_title' => 'About', 'post_name' => 'about'],
    103 => ['post_type' => 'page', 'post_title' => 'Contact', 'post_name' => 'contact'],
];
$GLOBALS['pc_menu_source'] = [101 => 'page-home', 102 => 'page-about', 103 => 'page-contact'];

final class WP_Error
{
    public function __construct(private string $message) {}
    public function get_error_message(): string { return $this->message; }
}

function __(string $value, string $domain = ''): string { return $value; }
function is_wp_error(mixed $value): bool { return $value instanceof WP_Error; }
function current_user_can(string $capability, mixed ...$args): bool { return true; }
function sanitize_key(string $value): string { return strtolower(preg_replace('/[^a-z0-9_-]/i', '', $value) ?? ''); }
function sanitize_text_field(string $value): string { return trim(strip_tags($value)); }
function sanitize_title(string $value): string { return trim(strtolower(preg_replace('/[^a-z0-9_-]+/i', '-', $value) ?? ''), '-'); }
function sanitize_html_class(string $value): string { return preg_replace('/[^A-Za-z0-9_-]/', '', $value) ?? ''; }
function esc_url_raw(string $value): string
{
    if (str_starts_with($value, '#')) return $value;
    return filter_var($value, FILTER_VALIDATE_URL) ? $value : '';
}
function home_url(string $path = ''): string { return 'https://example.test/' . ltrim($path, '/'); }
function wp_parse_url(string $url, int $component = -1): mixed { return parse_url($url, $component); }
function get_post_type(int $id): string { return $GLOBALS['pc_menu_posts'][$id]['post_type'] ?? 'nav_menu_item'; }
function get_the_title(int|object $post): string
{
    $id = is_object($post) ? (int) $post->ID : $post;
    return $GLOBALS['pc_menu_posts'][$id]['post_title'] ?? '';
}
function get_permalink(int $id): string
{
    $slug = $GLOBALS['pc_menu_posts'][$id]['post_name'] ?? '';
    return home_url($slug === '' ? '/' : $slug . '/');
}
function get_posts(array $args): array
{
    if (($args['fields'] ?? '') === 'ids' && ($args['meta_key'] ?? '') === '_pagecraft_source_page_id') {
        return array_keys($GLOBALS['pc_menu_source']);
    }
    return [];
}
function url_to_postid(string $url): int
{
    $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
    foreach ($GLOBALS['pc_menu_posts'] as $id => $post) {
        if (($post['post_name'] ?? '') === $path || ($path === '' && ($post['post_name'] ?? '') === '')) return $id;
    }
    return 0;
}
function get_post_meta(int $id, string $key, bool $single = false): string
{
    if ($key === '_pagecraft_source_page_id') return $GLOBALS['pc_menu_source'][$id] ?? '';
    return $GLOBALS['pc_menu_meta'][$id][$key] ?? '';
}
function update_post_meta(int $id, string $key, mixed $value): int
{
    $GLOBALS['pc_menu_meta'][$id][$key] = (string) $value;
    return 1;
}
function get_nav_menu_locations(): array { return $GLOBALS['pc_menu_locations']; }
function set_theme_mod(string $name, mixed $value): void
{
    if ($name === 'nav_menu_locations') $GLOBALS['pc_menu_locations'] = $value;
}
function wp_get_nav_menus(array $args = []): array { return array_values($GLOBALS['pc_menu_terms']); }
function wp_get_nav_menu_object(int $id): object|false { return $GLOBALS['pc_menu_terms'][$id] ?? false; }
function wp_create_nav_menu(string $name): int
{
    $id = $GLOBALS['pc_menu_next_term']++;
    $GLOBALS['pc_menu_terms'][$id] = (object) ['term_id' => $id, 'name' => $name];
    return $id;
}
function wp_update_nav_menu_object(int $id, array $args): int|WP_Error
{
    if (!isset($GLOBALS['pc_menu_terms'][$id])) return new WP_Error('missing menu');
    $GLOBALS['pc_menu_terms'][$id]->name = $args['menu-name'];
    return $id;
}
function update_term_meta(int $id, string $key, mixed $value): int
{
    $GLOBALS['pc_menu_term_meta'][$id][$key] = (string) $value;
    return 1;
}
function get_terms(array $args): array
{
    $matches = [];
    foreach ($GLOBALS['pc_menu_terms'] as $id => $term) {
        if (($GLOBALS['pc_menu_term_meta'][$id][$args['meta_key']] ?? '') === ($args['meta_value'] ?? '')) $matches[] = $term;
    }
    return array_slice($matches, 0, (int) ($args['number'] ?? count($matches)));
}
function wp_update_nav_menu_item(int $menuId, int $itemId, array $args): int|WP_Error
{
    if (!isset($GLOBALS['pc_menu_terms'][$menuId])) return new WP_Error('missing menu');
    if ($itemId <= 0) $itemId = $GLOBALS['pc_menu_next_item']++;
    $existing = $GLOBALS['pc_menu_items'][$itemId] ?? [];
    $objectType = (string) ($args['menu-item-object'] ?? $existing['object'] ?? 'custom');
    $objectId = (int) ($args['menu-item-object-id'] ?? $existing['object_id'] ?? 0);
    $type = (string) ($args['menu-item-type'] ?? $existing['type'] ?? 'custom');
    $url = $type === 'post_type' && $objectId > 0
        ? get_permalink($objectId)
        : (string) ($args['menu-item-url'] ?? $existing['url'] ?? '');
    $GLOBALS['pc_menu_items'][$itemId] = array_merge($existing, [
        'ID' => $itemId,
        'menu_id' => $menuId,
        'title' => (string) ($args['menu-item-title'] ?? $existing['title'] ?? ''),
        'url' => $url,
        'menu_item_parent' => (int) ($args['menu-item-parent-id'] ?? $existing['menu_item_parent'] ?? 0),
        'classes' => is_array($args['menu-item-classes'] ?? null)
            ? array_values($args['menu-item-classes'])
            : (preg_split('/\s+/', trim((string) ($args['menu-item-classes'] ?? ''))) ?: []),
        'target' => (string) ($args['menu-item-target'] ?? ''),
        'xfn' => (string) ($args['menu-item-xfn'] ?? ''),
        'type' => $type,
        'object' => $objectType,
        'object_id' => $objectId,
        'menu_order' => (int) ($args['menu-item-position'] ?? 0),
    ]);
    return $itemId;
}
function wp_get_nav_menu_items(int $menuId, array $args = []): array
{
    $rows = array_filter($GLOBALS['pc_menu_items'], static fn (array $item): bool => $item['menu_id'] === $menuId);
    usort($rows, static fn (array $a, array $b): int => $a['menu_order'] <=> $b['menu_order']);
    return array_map(static function (array $item): object {
        if ($item['type'] === 'post_type' && $item['object_id'] > 0) $item['url'] = get_permalink($item['object_id']);
        return (object) $item;
    }, $rows);
}
function wp_delete_post(int $id, bool $force = false): bool
{
    unset($GLOBALS['pc_menu_items'][$id], $GLOBALS['pc_menu_meta'][$id]);
    return true;
}
function wp_delete_nav_menu(int $id): bool
{
    unset($GLOBALS['pc_menu_terms'][$id], $GLOBALS['pc_menu_term_meta'][$id]);
    foreach ($GLOBALS['pc_menu_items'] as $itemId => $item) {
        if ($item['menu_id'] === $id) wp_delete_post((int) $itemId, true);
    }
    return true;
}
function pc_menu_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

require dirname(__DIR__) . '/pagecraft-builder/includes/Autoload.php';
\Pagecraft\Builder\Autoload::register();

$document = [
    'schemaVersion' => 13,
    'meta' => ['id' => 'site-fixture', 'name' => 'Menu fixture'],
    'header' => [[
        'id' => 'header', 'type' => 'section', 'props' => [], 'children' => [[
            'id' => 'main-nav', 'type' => 'nav', 'props' => ['items' => [
                ['id' => 'home-link', 'label' => 'Home', 'href' => 'index.html', 'cls' => 'home-link'],
                ['id' => 'about-link', 'label' => 'About us', 'href' => 'about.html#team', 'parentId' => 'home-link', 'cls' => 'about-link featured', 'target' => '_blank', 'rel' => 'nofollow'],
                ['id' => 'external-link', 'label' => 'External', 'href' => 'https://outside.example/path', 'cls' => 'external'],
            ]], 'children' => [],
        ]],
    ]],
    'footer' => [],
    'pages' => [
        ['id' => 'page-home', 'name' => 'Home', 'slug' => 'index', 'tree' => []],
        ['id' => 'page-about', 'name' => 'About', 'slug' => 'about', 'tree' => []],
    ],
];

$menus = new \Pagecraft\Builder\NativeMenu();
try {
    $menus->importDocument($document, ['page-home' => 101, 'page-about' => 102], false);
    throw new RuntimeException('Unconfirmed global navigation import was accepted.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_menu_assert(str_contains($error->getMessage(), 'explicit confirmation'), 'The global-navigation confirmation error is not actionable.');
}
$bindings = $menus->importDocument($document, ['page-home' => 101, 'page-about' => 102], true);
pc_menu_assert(isset($bindings['primary']), 'The first header navigation was not bound to Primary navigation.');
$primary = $bindings['primary'];
pc_menu_assert(count($GLOBALS['pc_menu_terms']) === 1, 'The first native import did not create exactly one menu.');
pc_menu_assert(($GLOBALS['pc_menu_locations']['primary'] ?? 0) === $primary, 'The native menu was not assigned to the theme location.');
$first = $menus->get($primary);
pc_menu_assert(count($first['items']) === 3, 'The native menu did not preserve every Pagecraft link.');
pc_menu_assert($first['items'][0]['objectType'] === 'page' && $first['items'][0]['objectId'] === '101', 'Home is not a page-backed WordPress menu item.');
pc_menu_assert($first['items'][1]['objectType'] === 'page' && $first['items'][1]['objectId'] === '102', 'About is not a page-backed WordPress menu item.');
pc_menu_assert($first['items'][1]['parentId'] === $first['items'][0]['id'], 'Native menu nesting was not preserved.');
pc_menu_assert($first['items'][1]['anchor'] === 'team' && $first['items'][1]['target'] === '_blank', 'Anchor or target data was lost.');
pc_menu_assert($first['items'][1]['classes'] === ['about-link', 'featured'] && $first['items'][1]['rel'] === 'nofollow', 'Classes or relationship data was lost.');
pc_menu_assert($first['items'][2]['objectType'] === 'custom' && $first['items'][2]['url'] === 'https://outside.example/path', 'External URL was not preserved as a custom item.');

$firstIds = array_column($first['items'], 'id');
$menus->importDocument($document, ['page-home' => 101, 'page-about' => 102], true);
$second = $menus->get($primary);
pc_menu_assert(count($GLOBALS['pc_menu_terms']) === 1, 'Full-site reimport created a duplicate menu.');
pc_menu_assert(array_column($second['items'], 'id') === $firstIds, 'Full-site reimport duplicated native menu items.');

$GLOBALS['pc_menu_posts'][102]['post_name'] = 'company';
$slugged = $menus->get($primary);
pc_menu_assert($slugged['items'][1]['url'] === 'https://example.test/company/', 'A WordPress slug change did not update the page-backed menu URL.');

$hydrated = $menus->hydrateDocument($document);
$nativeProps = $hydrated['header'][0]['children'][0]['props'];
pc_menu_assert($nativeProps['menuLocation'] === 'primary' && $nativeProps['nativeMenuId'] === (string) $primary, 'The Pagecraft component did not retain its stable native binding.');
pc_menu_assert($nativeProps['items'][1]['parentId'] === $nativeProps['items'][0]['id'], 'Native hierarchy did not round-trip into Pagecraft.');
$nativeProps['items'][0]['label'] = 'Homepage';
$nativeProps['items'][0]['cls'] = 'home-link selected';
$hydrated['header'][0]['children'][0]['props'] = $nativeProps;
$menus->synchronizeDocument($hydrated);
$edited = $menus->get($primary);
pc_menu_assert($edited['items'][0]['label'] === 'Homepage' && $edited['items'][0]['classes'] === ['home-link', 'selected'], 'Pagecraft did not edit the same native menu records.');

$cycle = $menus->hydrateDocument($hydrated);
$cycleItems = &$cycle['header'][0]['children'][0]['props']['items'];
$cycleItems[0]['parentId'] = $cycleItems[1]['id'];
$cycleItems[1]['parentId'] = $cycleItems[0]['id'];
try {
    $menus->synchronizeDocument($cycle);
    throw new RuntimeException('A cyclic Pagecraft menu hierarchy was accepted.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_menu_assert(str_contains($error->getMessage(), 'parent cycle'), 'The cyclic-menu error is not actionable.');
}
pc_menu_assert($menus->get($primary)['items'][0]['label'] === 'Homepage', 'Rejected cyclic navigation changed the native menu.');

$rollback = $menus->hydrateDocument($hydrated);
$rollback['header'][0]['children'][0]['props']['items'][0]['label'] = 'Should roll back';
try {
    $menus->synchronizeAndRun($rollback, static function (): never {
        throw new RuntimeException('Simulated page save failure.');
    });
} catch (RuntimeException $error) {
    pc_menu_assert($error->getMessage() === 'Simulated page save failure.', 'The page-save failure was not preserved.');
}
pc_menu_assert($menus->get($primary)['items'][0]['label'] === 'Homepage', 'A failed page save left the native menu ahead of the document.');

$footer = $menus->addPageToLocation(103, 'footer');
$menus->addPageToLocation(103, 'footer');
pc_menu_assert(count($menus->get($footer)['items']) === 1, 'The explicit Add to menu action created a duplicate page item.');
pc_menu_assert(count($GLOBALS['pc_menu_terms']) === 2, 'The explicit single-page action altered an unrelated menu.');

echo "Native WordPress menu conversion, ownership and idempotency are valid.\n";
