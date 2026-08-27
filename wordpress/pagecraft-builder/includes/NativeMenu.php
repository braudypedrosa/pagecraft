<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

/**
 * Native WordPress menu ownership for Pagecraft navigation components.
 *
 * WordPress owns labels, destinations, order and hierarchy. Pagecraft documents retain the
 * stable theme location plus presentation controls, and receive a fresh native snapshot each
 * time the editor opens.
 */
final class NativeMenu
{
    public const MENU_KEY = '_pagecraft_menu_key';
    public const ITEM_KEY = '_pagecraft_menu_item_key';
    public const ITEM_ANCHOR = '_pagecraft_menu_anchor';

    /** @return array<string,string> */
    public static function locations(): array
    {
        return [
            'primary' => __('Primary navigation', 'pagecraft-builder'),
            'footer' => __('Footer navigation', 'pagecraft-builder'),
            'utility' => __('Utility navigation', 'pagecraft-builder'),
        ];
    }

    /** @return list<array<string,mixed>> */
    public function list(): array
    {
        $this->assertManageable();
        $locations = get_nav_menu_locations();
        $menus = wp_get_nav_menus(['hide_empty' => false]);
        return array_values(array_map(
            fn (object $menu): array => $this->payload($menu, $locations),
            is_array($menus) ? $menus : []
        ));
    }

    /** @return array<string,mixed> */
    public function get(int $menuId): array
    {
        $this->assertManageable();
        $menu = wp_get_nav_menu_object($menuId);
        if (!is_object($menu) || !isset($menu->term_id)) {
            throw new PackageException('That WordPress menu does not exist.');
        }
        return $this->payload($menu, get_nav_menu_locations());
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function save(int $menuId, array $input): array
    {
        $this->assertManageable();
        $menu = wp_get_nav_menu_object($menuId);
        if (!is_object($menu) || !isset($menu->term_id)) {
            throw new PackageException('That WordPress menu does not exist.');
        }
        $name = sanitize_text_field((string) ($input['name'] ?? $menu->name ?? ''));
        if ($name === '') {
            throw new PackageException('A WordPress menu needs a name.');
        }
        if ($name !== (string) ($menu->name ?? '')) {
            $updated = wp_update_nav_menu_object($menuId, ['menu-name' => $name]);
            if (is_wp_error($updated)) {
                throw new PackageException('WordPress could not rename the menu: ' . $updated->get_error_message());
            }
        }

        $items = $input['items'] ?? null;
        if (!is_array($items)) {
            throw new PackageException('The WordPress menu item list is missing.');
        }
        $this->saveItems($menuId, $items);

        $location = sanitize_key((string) ($input['location'] ?? ''));
        if ($location !== '') {
            $this->assignLocation($menuId, $location);
        }
        return $this->get($menuId);
    }

    /**
     * Replace bound navigation snapshots with the current WordPress records.
     *
     * @param array<string,mixed> $document
     * @return array<string,mixed>
     */
    public function hydrateDocument(array $document): array
    {
        if (!current_user_can('edit_theme_options')) {
            return $document;
        }
        $this->ensureDocumentBindings($document);
        $locations = get_nav_menu_locations();
        $this->walkDocument($document, function (array &$node) use ($locations): void {
            if (($node['type'] ?? '') !== 'nav' || !is_array($node['props'] ?? null)) {
                return;
            }
            $location = sanitize_key((string) ($node['props']['menuLocation'] ?? ''));
            $menuId = $location !== '' ? (int) ($locations[$location] ?? 0) : 0;
            if ($menuId <= 0) {
                return;
            }
            $menu = wp_get_nav_menu_object($menuId);
            if (!is_object($menu)) {
                return;
            }
            $payload = $this->payload($menu, $locations);
            $node['props']['nativeMenuId'] = (string) $menuId;
            $node['props']['items'] = array_map([$this, 'documentItem'], $payload['items']);
        });
        return $document;
    }

    /**
     * Synchronize native menus and run the page commit as one recoverable operation.
     *
     * WordPress does not expose a transaction spanning posts, terms and metadata. Capture the
     * assigned menu records first so either side can fail without leaving the editor document
     * and native navigation on different versions.
     *
     * @template T
     * @param array<string,mixed> $document
     * @param callable():T $commit
     * @return T
     */
    public function synchronizeAndRun(array $document, callable $commit): mixed
    {
        if (!current_user_can('edit_theme_options')) {
            return $commit();
        }
        $this->ensureDocumentBindings($document);
        $this->validateDocument($document);
        $checkpoint = $this->checkpoint();
        $created = [];
        try {
            $this->synchronizeDocumentInternal($document, $created);
            return $commit();
        } catch (\Throwable $error) {
            $this->restoreCheckpoint($checkpoint, $created);
            throw $error;
        }
    }

    /** @param array<string,mixed> $document */
    public function synchronizeDocument(array $document): void
    {
        $this->synchronizeAndRun($document, static fn () => null);
    }

    /** @param array<string,mixed> $document */
    public function validateDocument(array $document): void
    {
        $this->ensureDocumentBindings($document);
        $this->walkDocument($document, function (array &$node) use ($document): void {
            if (($node['type'] ?? '') !== 'nav' || !is_array($node['props'] ?? null)) {
                return;
            }
            $items = is_array($node['props']['items'] ?? null) ? $node['props']['items'] : [];
            $this->validateItems($this->nativeItemsFromDocument(
                $document,
                $items,
                [],
                (string) ($node['id'] ?? 'nav')
            ));
        });
    }

    /** @param array<string,mixed> $document @param list<int> $created */
    private function synchronizeDocumentInternal(array $document, array &$created): void
    {
        $locations = get_nav_menu_locations();
        $handled = [];
        $knownMenus = [];
        foreach (wp_get_nav_menus(['hide_empty' => false]) as $menu) {
            if (is_object($menu) && isset($menu->term_id)) {
                $knownMenus[(int) $menu->term_id] = true;
            }
        }
        $this->walkDocument($document, function (array &$node) use (
            $document,
            &$locations,
            &$handled,
            &$created,
            &$knownMenus
        ): void {
            if (($node['type'] ?? '') !== 'nav' || !is_array($node['props'] ?? null)) {
                return;
            }
            $location = sanitize_key((string) ($node['props']['menuLocation'] ?? ''));
            if (!isset(self::locations()[$location]) || isset($handled[$location])) {
                return;
            }
            $menuId = (int) ($locations[$location] ?? 0);
            if ($menuId <= 0) {
                $menuId = $this->ensureMenu($location, 'editor-' . (string) ($node['id'] ?? $location));
                if (!isset($knownMenus[$menuId])) {
                    $created[] = $menuId;
                    $knownMenus[$menuId] = true;
                }
                $locations[$location] = $menuId;
                $this->assignLocation($menuId, $location);
            }
            $items = is_array($node['props']['items'] ?? null) ? $node['props']['items'] : [];
            $this->saveItems($menuId, $this->nativeItemsFromDocument($document, $items));
            $handled[$location] = true;
        });
    }

    /**
     * Convert Pagecraft global navigation after an explicit full-site/global import.
     *
     * @param array<string,mixed> $document
     * @param array<string,int> $pageMap Pagecraft page id to WordPress page id.
     * @return array<string,int> Location to native menu id.
     */
    public function importDocument(array $document, array $pageMap, bool $confirmed): array
    {
        $this->assertManageable();
        if (!$confirmed) {
            throw new PackageException('Importing global navigation requires explicit confirmation.');
        }
        $bindings = [];
        $headerCount = 0;
        $footerCount = 0;
        foreach (['header', 'footer'] as $region) {
            $nodes = is_array($document[$region] ?? null) ? $document[$region] : [];
            $this->walkNodes($nodes, function (array &$node) use (
                $document,
                $pageMap,
                $region,
                &$headerCount,
                &$footerCount,
                &$bindings
            ): void {
                if (($node['type'] ?? '') !== 'nav' || !is_array($node['props'] ?? null)) {
                    return;
                }
                if ($region === 'header') {
                    $location = $headerCount++ === 0 ? 'primary' : 'utility';
                } else {
                    $location = $footerCount++ === 0 ? 'footer' : '';
                }
                $declared = sanitize_key((string) ($node['props']['menuLocation'] ?? ''));
                if (isset(self::locations()[$declared])) {
                    $location = $declared;
                }
                if ($location === '' || isset($bindings[$location])) {
                    return;
                }
                $key = $this->documentMenuKey($document, $location, (string) ($node['id'] ?? $location));
                $menuId = $this->ensureMenu($location, $key);
                $items = is_array($node['props']['items'] ?? null) ? $node['props']['items'] : [];
                $native = $this->nativeItemsFromDocument($document, $items, $pageMap, (string) ($node['id'] ?? 'nav'));
                $this->saveItems($menuId, $native);
                $this->assignLocation($menuId, $location);
                $bindings[$location] = $menuId;
            });
        }
        return $bindings;
    }

    public function addPageToLocation(int $postId, string $location): int
    {
        $this->assertManageable();
        if (get_post_type($postId) !== 'page' || !current_user_can('edit_post', $postId)) {
            throw new PackageException('You are not allowed to add that page to navigation.');
        }
        $location = sanitize_key($location);
        if (!isset(self::locations()[$location])) {
            throw new PackageException('Choose a valid Pagecraft Theme menu location.');
        }
        $locations = get_nav_menu_locations();
        $menuId = (int) ($locations[$location] ?? 0);
        if ($menuId <= 0) {
            $menuId = $this->ensureMenu($location, 'manual-' . $location);
            $this->assignLocation($menuId, $location);
        }
        $current = $this->get($menuId);
        foreach ($current['items'] as $item) {
            if (($item['objectType'] ?? '') === 'page' && (int) ($item['objectId'] ?? 0) === $postId) {
                return $menuId;
            }
        }
        $items = $current['items'];
        $items[] = [
            'id' => 'new-' . $postId,
            'label' => get_the_title($postId),
            'url' => get_permalink($postId),
            'objectType' => 'page',
            'objectId' => (string) $postId,
            'parentId' => null,
            'classes' => [],
            'target' => '',
            'rel' => '',
            'anchor' => '',
            'order' => count($items) + 1,
        ];
        $this->saveItems($menuId, $items);
        return $menuId;
    }

    /** @param list<array<string,mixed>> $items */
    private function saveItems(int $menuId, array $items): void
    {
        $this->validateItems($items);
        $existingRows = wp_get_nav_menu_items($menuId, ['post_status' => 'any']);
        $existing = [];
        foreach (is_array($existingRows) ? $existingRows : [] as $row) {
            $existing[(int) $row->ID] = $row;
        }
        $sourceIds = [];
        foreach ($existing as $id => $row) {
            $key = (string) get_post_meta($id, self::ITEM_KEY, true);
            if ($key !== '') {
                $sourceIds[$key] = $id;
            }
        }

        $resolved = [];
        $retained = [];
        foreach (array_values($items) as $index => $raw) {
            if (!is_array($raw)) {
                throw new PackageException('A WordPress menu item is malformed.');
            }
            $clientId = (string) ($raw['id'] ?? 'new-' . $index);
            $sourceKey = sanitize_text_field((string) ($raw['sourceKey'] ?? ''));
            $itemId = ctype_digit($clientId) && isset($existing[(int) $clientId])
                ? (int) $clientId
                : (int) ($sourceIds[$sourceKey] ?? 0);
            $args = $this->itemArguments($raw, $index + 1);
            $saved = wp_update_nav_menu_item($menuId, $itemId, $args);
            if (is_wp_error($saved)) {
                throw new PackageException('WordPress could not save a menu item: ' . $saved->get_error_message());
            }
            $savedId = (int) $saved;
            $resolved[$clientId] = $savedId;
            $retained[$savedId] = true;
            update_post_meta($savedId, self::ITEM_ANCHOR, sanitize_title((string) ($raw['anchor'] ?? '')));
            if ($sourceKey !== '') {
                update_post_meta($savedId, self::ITEM_KEY, $sourceKey);
            }
        }

        foreach (array_values($items) as $index => $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $clientId = (string) ($raw['id'] ?? 'new-' . $index);
            $parent = (string) ($raw['parentId'] ?? '');
            $savedId = (int) ($resolved[$clientId] ?? 0);
            $parentId = (int) ($resolved[$parent] ?? (ctype_digit($parent) ? $parent : 0));
            if ($savedId <= 0 || $parentId === $savedId || ($parentId > 0 && !isset($retained[$parentId]))) {
                $parentId = 0;
            }
            $updated = wp_update_nav_menu_item($menuId, $savedId, [
                'menu-item-parent-id' => $parentId,
                'menu-item-position' => $index + 1,
            ] + $this->itemArguments($raw, $index + 1));
            if (is_wp_error($updated)) {
                throw new PackageException('WordPress could not preserve menu hierarchy: ' . $updated->get_error_message());
            }
        }

        foreach (array_keys($existing) as $itemId) {
            if (!isset($retained[$itemId])) {
                wp_delete_post($itemId, true);
            }
        }
    }

    /** @param list<array<string,mixed>> $items */
    private function validateItems(array $items): void
    {
        $parents = [];
        foreach (array_values($items) as $index => $item) {
            if (!is_array($item)) {
                throw new PackageException('A WordPress menu item is malformed.');
            }
            $id = (string) ($item['id'] ?? 'new-' . $index);
            if ($id === '' || isset($parents[$id])) {
                throw new PackageException('Every WordPress menu item needs a unique identity.');
            }
            $parents[$id] = (string) ($item['parentId'] ?? '');
            $this->itemArguments($item, $index + 1);
        }
        foreach (array_keys($parents) as $id) {
            $seen = [$id => true];
            $parent = $parents[$id];
            while ($parent !== '' && isset($parents[$parent])) {
                if (isset($seen[$parent])) {
                    throw new PackageException('WordPress menu items cannot contain a parent cycle.');
                }
                $seen[$parent] = true;
                $parent = $parents[$parent];
            }
        }
    }

    /** @return array{locations:array<string,int>,menus:array<int,array<string,mixed>>} */
    private function checkpoint(): array
    {
        $locations = get_nav_menu_locations();
        $menus = [];
        foreach (array_keys(self::locations()) as $location) {
            $menuId = (int) ($locations[$location] ?? 0);
            if ($menuId <= 0 || isset($menus[$menuId])) {
                continue;
            }
            $menu = wp_get_nav_menu_object($menuId);
            if (is_object($menu)) {
                $menus[$menuId] = $this->payload($menu, $locations);
            }
        }
        return ['locations' => $locations, 'menus' => $menus];
    }

    /** @param array{locations:array<string,int>,menus:array<int,array<string,mixed>>} $checkpoint @param list<int> $created */
    private function restoreCheckpoint(array $checkpoint, array $created): void
    {
        foreach ($checkpoint['menus'] as $menuId => $payload) {
            if (!is_object(wp_get_nav_menu_object((int) $menuId))) {
                continue;
            }
            $this->saveItems((int) $menuId, is_array($payload['items'] ?? null) ? $payload['items'] : []);
            $name = sanitize_text_field((string) ($payload['name'] ?? ''));
            if ($name !== '') {
                wp_update_nav_menu_object((int) $menuId, ['menu-name' => $name]);
            }
        }
        foreach (array_unique($created) as $menuId) {
            if (!isset($checkpoint['menus'][$menuId])) {
                wp_delete_nav_menu($menuId);
            }
        }
        set_theme_mod('nav_menu_locations', $checkpoint['locations']);
    }

    /** @param array<string,mixed> $item @return array<string,mixed> */
    private function itemArguments(array $item, int $position): array
    {
        $label = sanitize_text_field((string) ($item['label'] ?? ''));
        if ($label === '') {
            throw new PackageException('Every WordPress menu item needs a label.');
        }
        $classes = array_values(array_filter(array_map(
            static fn (string $class): string => sanitize_html_class($class),
            is_array($item['classes'] ?? null)
                ? array_map('strval', $item['classes'])
                : (preg_split('/\s+/', trim((string) ($item['cls'] ?? ''))) ?: [])
        )));
        $objectType = (string) ($item['objectType'] ?? 'custom');
        $objectId = (int) ($item['objectId'] ?? 0);
        $postBacked = in_array($objectType, ['page', 'post'], true)
            && $objectId > 0 && get_post_type($objectId) === $objectType;
        $args = [
            'menu-item-title' => $label,
            'menu-item-status' => 'publish',
            'menu-item-position' => max(1, (int) ($item['order'] ?? $position)),
            'menu-item-parent-id' => 0,
            'menu-item-target' => ($item['target'] ?? '') === '_blank' ? '_blank' : '',
            'menu-item-classes' => implode(' ', $classes),
            'menu-item-xfn' => sanitize_text_field((string) ($item['rel'] ?? '')),
        ];
        if ($postBacked) {
            return $args + [
                'menu-item-type' => 'post_type',
                'menu-item-object' => $objectType,
                'menu-item-object-id' => $objectId,
            ];
        }
        $url = esc_url_raw((string) ($item['url'] ?? $item['href'] ?? ''));
        if (str_starts_with((string) ($item['url'] ?? $item['href'] ?? ''), '#')) {
            $url = '#' . sanitize_title(substr((string) ($item['url'] ?? $item['href']), 1));
        }
        if ($url === '') {
            throw new PackageException('Every custom WordPress menu item needs a valid destination.');
        }
        return $args + [
            'menu-item-type' => 'custom',
            'menu-item-object' => 'custom',
            'menu-item-object-id' => 0,
            'menu-item-url' => $url,
        ];
    }

    /** @param array<string,mixed> $document @param list<array<string,mixed>> $items @param array<string,int> $pageMap @return list<array<string,mixed>> */
    private function nativeItemsFromDocument(
        array $document,
        array $items,
        array $pageMap = [],
        string $nodeId = 'nav'
    ): array {
        $pagesBySlug = [];
        foreach (is_array($document['pages'] ?? null) ? $document['pages'] : [] as $page) {
            if (is_array($page) && is_string($page['slug'] ?? null) && is_string($page['id'] ?? null)) {
                $pagesBySlug[$page['slug']] = $page['id'];
            }
        }
        if ($pageMap === []) {
            $pageMap = $this->wordpressPageMap();
        }
        $output = [];
        foreach (array_values($items) as $index => $item) {
            if (!is_array($item)) {
                continue;
            }
            $href = trim((string) ($item['href'] ?? ''));
            $objectType = (string) ($item['objectType'] ?? '');
            $objectId = (int) ($item['objectId'] ?? 0);
            $anchor = sanitize_title((string) ($item['anchor'] ?? ''));
            if ($objectId <= 0) {
                [$slug, $parsedAnchor] = $this->internalDestination($href);
                if ($anchor === '') {
                    $anchor = $parsedAnchor;
                }
                $sourceId = $slug !== '' ? (string) ($pagesBySlug[$slug] ?? '') : '';
                if ($sourceId !== '' && isset($pageMap[$sourceId])) {
                    $objectType = 'page';
                    $objectId = (int) $pageMap[$sourceId];
                } else {
                    $nativePath = $slug === 'index' ? '/' : '/' . trim($slug, '/') . '/';
                    $nativeCandidate = $slug !== '' ? url_to_postid(home_url($nativePath)) : 0;
                    if ($nativeCandidate > 0 && get_post_type($nativeCandidate) === 'page') {
                        $objectType = 'page';
                        $objectId = $nativeCandidate;
                    }
                    $reference = $this->parseWordPressReference($href);
                    if ($objectId <= 0 && $reference !== null) {
                        $candidate = url_to_postid(home_url($reference['path']));
                        if ($candidate > 0 && in_array(get_post_type($candidate), ['page', 'post'], true)) {
                            $objectType = (string) get_post_type($candidate);
                            $objectId = $candidate;
                        }
                    }
                }
            }
            $id = (string) ($item['id'] ?? 'source-' . $index);
            $output[] = [
                'id' => $id,
                'sourceKey' => $nodeId . ':' . ($id !== '' ? $id : hash('sha256', $index . '|' . $href)),
                'label' => (string) ($item['label'] ?? ''),
                'url' => $href,
                'objectType' => in_array($objectType, ['page', 'post'], true) && $objectId > 0 ? $objectType : 'custom',
                'objectId' => $objectId > 0 ? (string) $objectId : '',
                'parentId' => (string) ($item['parentId'] ?? ''),
                'classes' => preg_split('/\s+/', trim((string) ($item['cls'] ?? ''))) ?: [],
                'target' => ($item['target'] ?? '') === '_blank' ? '_blank' : '',
                'rel' => (string) ($item['rel'] ?? ''),
                'anchor' => $anchor,
                'order' => $index + 1,
            ];
        }
        return $output;
    }

    /** @param array<string,mixed> $item @return array<string,mixed> */
    private function documentItem(array $item): array
    {
        $href = (string) ($item['url'] ?? '');
        if (in_array($item['objectType'] ?? '', ['page', 'post'], true)) {
            $path = (string) wp_parse_url($href, PHP_URL_PATH);
            $href = $this->wordpressReference((string) $item['objectType'], $path);
            if ((string) ($item['anchor'] ?? '') !== '') {
                $href = $path . '#' . (string) $item['anchor'];
            }
        }
        return [
            'id' => (string) ($item['id'] ?? ''),
            'label' => (string) ($item['label'] ?? ''),
            'href' => $href,
            'parentId' => (string) ($item['parentId'] ?? ''),
            'cls' => implode(' ', is_array($item['classes'] ?? null) ? $item['classes'] : []),
            'target' => ($item['target'] ?? '') === '_blank' ? '_blank' : '',
            'rel' => (string) ($item['rel'] ?? ''),
            'objectType' => (string) ($item['objectType'] ?? 'custom'),
            'objectId' => (string) ($item['objectId'] ?? ''),
            'anchor' => (string) ($item['anchor'] ?? ''),
        ];
    }

    /** @param object $menu @param array<string,int> $locations @return array<string,mixed> */
    private function payload(object $menu, array $locations): array
    {
        $menuId = (int) ($menu->term_id ?? 0);
        $location = '';
        foreach ($locations as $slug => $assigned) {
            if ((int) $assigned === $menuId && isset(self::locations()[$slug])) {
                $location = $slug;
                break;
            }
        }
        $items = wp_get_nav_menu_items($menuId, ['post_status' => 'any']);
        $output = [];
        foreach (is_array($items) ? $items : [] as $item) {
            $type = ($item->type ?? '') === 'post_type' && in_array($item->object ?? '', ['page', 'post'], true)
                ? (string) $item->object : 'custom';
            $output[] = [
                'id' => (string) $item->ID,
                'label' => (string) $item->title,
                'url' => (string) $item->url,
                'parentId' => (int) $item->menu_item_parent > 0 ? (string) $item->menu_item_parent : null,
                'classes' => array_values(array_filter(array_map('strval', (array) ($item->classes ?? [])))),
                'target' => ($item->target ?? '') === '_blank' ? '_blank' : '',
                'rel' => (string) ($item->xfn ?? ''),
                'objectType' => $type,
                'objectId' => $type !== 'custom' ? (string) ($item->object_id ?? '') : '',
                'anchor' => (string) get_post_meta((int) $item->ID, self::ITEM_ANCHOR, true),
                'order' => max(1, (int) ($item->menu_order ?? count($output) + 1)),
            ];
        }
        return [
            'id' => (string) $menuId,
            'name' => (string) ($menu->name ?? ''),
            'location' => $location,
            'items' => $output,
        ];
    }

    private function ensureMenu(string $location, string $key): int
    {
        $terms = get_terms([
            'taxonomy' => 'nav_menu',
            'hide_empty' => false,
            'meta_key' => self::MENU_KEY,
            'meta_value' => $key,
            'number' => 1,
        ]);
        if (!is_wp_error($terms) && is_array($terms) && isset($terms[0]->term_id)) {
            return (int) $terms[0]->term_id;
        }
        $label = self::locations()[$location] ?? ucfirst($location) . ' navigation';
        $created = wp_create_nav_menu('Pagecraft ' . $label);
        if (is_wp_error($created)) {
            throw new PackageException('WordPress could not create the Pagecraft menu: ' . $created->get_error_message());
        }
        $menuId = (int) $created;
        update_term_meta($menuId, self::MENU_KEY, $key);
        return $menuId;
    }

    private function assignLocation(int $menuId, string $location): void
    {
        if (!isset(self::locations()[$location])) {
            throw new PackageException('The Pagecraft Theme menu location is invalid.');
        }
        $locations = get_nav_menu_locations();
        $locations[$location] = $menuId;
        set_theme_mod('nav_menu_locations', $locations);
    }

    /** @param array<string,mixed> $document */
    private function documentMenuKey(array $document, string $location, string $nodeId): string
    {
        $project = is_array($document['meta'] ?? null)
            ? (string) ($document['meta']['id'] ?? $document['meta']['name'] ?? 'site') : 'site';
        return 'pagecraft:' . hash('sha256', $project . '|' . $location . '|' . $nodeId);
    }

    /** @return array<string,int> */
    private function wordpressPageMap(): array
    {
        $map = [];
        $ids = get_posts([
            'post_type' => 'page',
            'post_status' => ['draft', 'pending', 'publish', 'private'],
            'posts_per_page' => -1,
            'fields' => 'ids',
            'meta_key' => ManagedPage::SOURCE_PAGE_ID,
        ]);
        foreach (is_array($ids) ? $ids : [] as $id) {
            $source = (string) get_post_meta((int) $id, ManagedPage::SOURCE_PAGE_ID, true);
            if ($source !== '') {
                $map[$source] = (int) $id;
            }
        }
        return $map;
    }

    /** @param array<string,mixed> $document */
    private function ensureDocumentBindings(array &$document): void
    {
        $headerCount = 0;
        if (is_array($document['header'] ?? null)) {
            $this->walkNodes($document['header'], function (array &$node) use (&$headerCount): void {
                if (($node['type'] ?? '') !== 'nav' || !is_array($node['props'] ?? null)) {
                    return;
                }
                $declared = sanitize_key((string) ($node['props']['menuLocation'] ?? ''));
                if (!isset(self::locations()[$declared])) {
                    $node['props']['menuLocation'] = $headerCount === 0 ? 'primary' : 'utility';
                }
                $headerCount++;
            });
        }
        $footerCount = 0;
        if (is_array($document['footer'] ?? null)) {
            $this->walkNodes($document['footer'], function (array &$node) use (&$footerCount): void {
                if (($node['type'] ?? '') !== 'nav' || !is_array($node['props'] ?? null)) {
                    return;
                }
                $declared = sanitize_key((string) ($node['props']['menuLocation'] ?? ''));
                if (!isset(self::locations()[$declared]) && $footerCount === 0) {
                    $node['props']['menuLocation'] = 'footer';
                }
                $footerCount++;
            });
        }
    }

    /** @return array{0:string,1:string} */
    private function internalDestination(string $href): array
    {
        if (!preg_match('~^(?:\.\./|\./|/)*([A-Za-z0-9][A-Za-z0-9/_-]*?)(?:\.html)?(?:#([A-Za-z0-9_-]+))?$~', $href, $match)) {
            return ['', ''];
        }
        $slug = trim((string) $match[1], '/');
        if ($slug === '' || $slug === 'index') {
            $slug = 'index';
        } elseif (str_ends_with($slug, '/index')) {
            $slug = substr($slug, 0, -strlen('/index')) ?: 'index';
        }
        return [$slug, sanitize_title((string) ($match[2] ?? ''))];
    }

    private function wordpressReference(string $objectType, string $path): string
    {
        $type = in_array($objectType, ['page', 'post'], true) ? $objectType : 'page';
        $path = '/' . ltrim($path, '/');
        if ($path !== '/' && !str_ends_with($path, '/')) {
            $path .= '/';
        }
        return 'pagecraft:wordpress-content:' . $type . ':' . rtrim(strtr(base64_encode($path), '+/', '-_'), '=');
    }

    /** @return array{objectType:string,path:string}|null */
    private function parseWordPressReference(string $reference): ?array
    {
        if (!preg_match('/^pagecraft:wordpress-content:(page|post):([A-Za-z0-9_-]+)$/', $reference, $match)) {
            return null;
        }
        $encoded = strtr($match[2], '-_', '+/');
        $padding = strlen($encoded) % 4;
        if ($padding > 0) {
            $encoded .= str_repeat('=', 4 - $padding);
        }
        $path = base64_decode($encoded, true);
        if (!is_string($path) || !str_starts_with($path, '/') || preg_match('/[?#\\\x00-\x1f\x7f]/', $path)) {
            return null;
        }
        return ['objectType' => $match[1], 'path' => $path];
    }

    /** @param array<string,mixed> $document @param callable(array<string,mixed>&):void $visit */
    private function walkDocument(array &$document, callable $visit): void
    {
        foreach (['header', 'footer'] as $region) {
            if (is_array($document[$region] ?? null)) {
                $this->walkNodes($document[$region], $visit);
            }
        }
        foreach (is_array($document['pages'] ?? null) ? $document['pages'] : [] as &$page) {
            if (is_array($page) && is_array($page['tree'] ?? null)) {
                $this->walkNodes($page['tree'], $visit);
            }
        }
    }

    /** @param list<array<string,mixed>> $nodes @param callable(array<string,mixed>&):void $visit */
    private function walkNodes(array &$nodes, callable $visit): void
    {
        foreach ($nodes as &$node) {
            if (!is_array($node)) {
                continue;
            }
            $visit($node);
            if (is_array($node['children'] ?? null)) {
                $this->walkNodes($node['children'], $visit);
            }
        }
    }

    private function assertManageable(): void
    {
        if (!current_user_can(Capabilities::MANAGE) || !current_user_can('edit_theme_options')) {
            throw new PackageException('You are not allowed to manage WordPress menus.');
        }
    }
}
