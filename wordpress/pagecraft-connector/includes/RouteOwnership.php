<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/** Resolves whether a target-local WordPress route is already owned. */
final class RouteOwnership
{
    private readonly ?\Closure $resolver;

    public function __construct(?\Closure $resolver = null)
    {
        $this->resolver = $resolver;
    }

    /** @return array<string,mixed>|\WP_Error|null */
    public function owner(string $route): array|\WP_Error|null
    {
        $route = Support::normalizeRoute($route);
        if ($this->resolver) {
            $owner = ($this->resolver)($route);
            return is_array($owner) ? $this->normalizeOwner($owner) : $owner;
        }
        $reserved = $this->reservedOwner($route);
        if ($reserved !== null) {
            return $reserved;
        }

        $postId = function_exists('url_to_postid') ? (int) url_to_postid(home_url($route)) : 0;
        if ($postId > 0) {
            $post = get_post($postId);
            if ($post instanceof \WP_Post && get_post_meta($postId, '_pagecraft_managed', true) !== '1') {
                $postType = (string) $post->post_type;
                return $this->normalizeOwner([
                    'owner_type' => $postType === 'page' ? 'page' : 'post-single',
                    'label' => $post->post_title !== '' ? $post->post_title : sprintf('WordPress %s #%d', $postType, $postId),
                    'object_id' => $postId,
                    'post_id' => $postId,
                    'post_type' => $postType,
                    'replaceable' => $postType === 'page',
                    'ambiguous' => false,
                ]);
            }
        }

        $pagePath = trim($route, '/');
        if ($pagePath !== '' && function_exists('get_page_by_path')) {
            $page = get_page_by_path($pagePath, OBJECT, 'page');
            if ($page instanceof \WP_Post && get_post_meta($page->ID, '_pagecraft_managed', true) !== '1') {
                return $this->normalizeOwner([
                    'owner_type' => 'page', 'label' => $page->post_title ?: 'WordPress page',
                    'object_id' => $page->ID, 'post_id' => $page->ID, 'post_type' => 'page',
                    'replaceable' => true, 'ambiguous' => false,
                ]);
            }
        }

        $prefix = $this->publicRewriteOwner($route);
        if ($prefix !== null) {
            return $prefix;
        }
        return $this->rewriteOwner($route);
    }

    /** @return array<string,mixed>|null */
    private function reservedOwner(string $route): ?array
    {
        if (preg_match('#^/(?:wp-admin(?:/|$)|wp-login\.php$|wp-json(?:/|$)|xmlrpc\.php$|wp-cron\.php$|wp-comments-post\.php$|wp-content(?:/|$)|wp-includes(?:/|$)|\.well-known(?:/|$))#i', $route)) {
            return $this->system('system', 'WordPress reserved endpoint');
        }
        if (preg_match('#^/(?:robots\.txt|favicon\.ico|wp-sitemap\.xml|sitemap(?:_index)?\.xml)$#i', $route)) {
            return $this->system('system', 'WordPress system endpoint');
        }
        if (preg_match('#/(?:feed|rss|rss2|atom)/?$#i', $route) || $route === '/comments/feed/') {
            return $this->system('feed', 'WordPress feed route');
        }
        return null;
    }

    /** @return array<string,mixed>|null */
    private function publicRewriteOwner(string $route): ?array
    {
        if (function_exists('get_post_types')) {
            $types = get_post_types(['public' => true], 'objects');
            foreach (is_array($types) ? $types : [] as $type) {
                if (!is_object($type) || in_array((string) ($type->name ?? ''), ['post', 'page', 'attachment'], true)) {
                    continue;
                }
                $rewrite = $type->rewrite ?? false;
                $slug = is_array($rewrite) ? trim((string) ($rewrite['slug'] ?? ''), '/') : '';
                if ($slug === '' || !$this->hasPrefix($route, '/' . $slug . '/')) {
                    continue;
                }
                $archive = function_exists('get_post_type_archive_link') ? get_post_type_archive_link((string) $type->name) : false;
                $archiveRoute = is_string($archive) ? $this->routeFromUrl($archive) : '';
                return $this->normalizeOwner([
                    'owner_type' => $archiveRoute !== '' && $archiveRoute === $route ? 'post-type-archive' : 'post-type-rewrite',
                    'label' => sprintf('WordPress %s route', (string) ($type->label ?? $type->name)),
                    'post_type' => (string) $type->name,
                    'replaceable' => false,
                    'ambiguous' => $archiveRoute !== $route,
                ]);
            }
        }
        if (function_exists('get_taxonomies')) {
            $taxonomies = get_taxonomies(['public' => true], 'objects');
            foreach (is_array($taxonomies) ? $taxonomies : [] as $taxonomy) {
                if (!is_object($taxonomy)) {
                    continue;
                }
                $rewrite = $taxonomy->rewrite ?? false;
                $slug = is_array($rewrite) ? trim((string) ($rewrite['slug'] ?? ''), '/') : '';
                if ($slug === '' || !$this->hasPrefix($route, '/' . $slug . '/')) {
                    continue;
                }
                $termSlug = basename(trim(substr($route, strlen('/' . $slug . '/')), '/'));
                $term = $termSlug !== '' && function_exists('get_term_by')
                    ? get_term_by('slug', $termSlug, (string) $taxonomy->name)
                    : false;
                return $this->normalizeOwner([
                    'owner_type' => is_object($term) ? 'term' : 'taxonomy-rewrite',
                    'label' => is_object($term) && isset($term->name)
                        ? (string) $term->name
                        : sprintf('WordPress %s route', (string) ($taxonomy->label ?? $taxonomy->name)),
                    'object_id' => is_object($term) ? (int) ($term->term_id ?? 0) : 0,
                    'taxonomy' => (string) $taxonomy->name,
                    'replaceable' => false,
                    'ambiguous' => !is_object($term),
                ]);
            }
        }

        global $wp_rewrite;
        $authorBase = is_object($wp_rewrite) ? trim((string) ($wp_rewrite->author_base ?? 'author'), '/') : 'author';
        if ($authorBase !== '' && $this->hasPrefix($route, '/' . $authorBase . '/')) {
            $slug = basename(trim(substr($route, strlen('/' . $authorBase . '/')), '/'));
            $user = $slug !== '' && function_exists('get_user_by') ? get_user_by('slug', $slug) : false;
            return $this->normalizeOwner([
                'owner_type' => is_object($user) ? 'author' : 'author-rewrite',
                'label' => is_object($user) && isset($user->display_name) ? (string) $user->display_name : 'WordPress author route',
                'object_id' => is_object($user) ? (int) ($user->ID ?? 0) : 0,
                'replaceable' => false,
                'ambiguous' => !is_object($user),
            ]);
        }
        return null;
    }

    /** @return array<string,mixed>|\WP_Error|null */
    private function rewriteOwner(string $route): array|\WP_Error|null
    {
        global $wp_rewrite;
        if (!is_object($wp_rewrite) || !method_exists($wp_rewrite, 'wp_rewrite_rules')) {
            return null;
        }
        $rules = $wp_rewrite->wp_rewrite_rules();
        if (!is_array($rules)) {
            return null;
        }
        $request = ltrim(rawurldecode($route), '/');
        foreach ($rules as $regex => $query) {
            $matched = @preg_match('#^' . str_replace('#', '\\#', (string) $regex) . '#', $request, $matches);
            if ($matched === false) {
                return new \WP_Error('pagecraft_route_rewrite_invalid', 'WordPress contains an invalid rewrite rule, so route ownership cannot be proven safely.');
            }
            if ($matched !== 1) {
                continue;
            }
            $expanded = preg_replace_callback('/\$matches\[(\d+)\]/', static fn (array $match): string => rawurlencode((string) ($matches[(int) $match[1]] ?? '')), (string) $query);
            $expanded = (string) preg_replace('#^index\.php\??#', '', (string) $expanded);
            parse_str($expanded, $variables);
            if (isset($variables['feed']) || isset($variables['withcomments'])) {
                return $this->system('feed', 'WordPress feed rewrite');
            }
            if (isset($variables['author_name']) || isset($variables['author'])) {
                return $this->system('author', 'WordPress author archive');
            }
            if (isset($variables['s']) || isset($variables['year']) || isset($variables['monthnum']) || isset($variables['day'])) {
                return $this->system('archive', 'WordPress query archive');
            }
            if (isset($variables['pagename']) || isset($variables['name']) || isset($variables['attachment'])) {
                // A standard singular catch-all with no resolved object is free;
                // url_to_postid() already handled every real public single above.
                $known = array_diff(array_keys($variables), ['pagename', 'name', 'attachment', 'page', 'post_type']);
                if ($known === []) {
                    return null;
                }
            }
            return $this->normalizeOwner([
                'owner_type' => 'rewrite',
                'label' => 'WordPress rewrite-owned route',
                'rewrite_query' => (string) $query,
                'replaceable' => false,
                'ambiguous' => true,
            ]);
        }
        return null;
    }

    /** @return array<string,mixed> */
    private function system(string $type, string $label): array
    {
        return $this->normalizeOwner(['owner_type' => $type, 'label' => $label, 'replaceable' => false, 'ambiguous' => false]);
    }

    /** @param array<string,mixed> $owner @return array<string,mixed> */
    private function normalizeOwner(array $owner): array
    {
        return [
            'owner_type' => sanitize_key((string) ($owner['owner_type'] ?? 'rewrite')),
            'label' => sanitize_text_field((string) ($owner['label'] ?? 'WordPress route')),
            'object_id' => max(0, (int) ($owner['object_id'] ?? 0)),
            'post_id' => max(0, (int) ($owner['post_id'] ?? 0)),
            'post_type' => sanitize_key((string) ($owner['post_type'] ?? '')),
            'taxonomy' => sanitize_key((string) ($owner['taxonomy'] ?? '')),
            'rewrite_query' => sanitize_text_field((string) ($owner['rewrite_query'] ?? '')),
            'replaceable' => ($owner['replaceable'] ?? false) === true,
            'ambiguous' => ($owner['ambiguous'] ?? false) === true,
        ];
    }

    private function hasPrefix(string $route, string $prefix): bool
    {
        return $route === $prefix || str_starts_with($route, $prefix);
    }

    private function routeFromUrl(string $url): string
    {
        $path = wp_parse_url($url, PHP_URL_PATH);
        $homePath = wp_parse_url(home_url('/'), PHP_URL_PATH);
        $path = is_string($path) ? $path : '/';
        $homePath = is_string($homePath) ? rtrim($homePath, '/') : '';
        if ($homePath !== '' && str_starts_with($path, $homePath)) {
            $path = substr($path, strlen($homePath)) ?: '/';
        }
        return Support::normalizeRoute($path);
    }
}
