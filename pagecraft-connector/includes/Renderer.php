<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Renderer
{
    /** @var array<string,true> */
    private array $printedScripts = [];

    public function __construct(
        private readonly ReleaseRepository $releases,
        private readonly ScriptApprovals $scripts,
        private readonly Forms $forms,
        private readonly Seo $seo,
        private readonly Connection $connection
    ) {
    }

    public function hooks(): void
    {
        add_filter('the_content', [$this, 'filterContent'], 99);
        add_filter('body_class', [$this, 'bodyClasses']);
        add_action('wp_head', [$this, 'renderHead'], 20);
        add_action('wp_head', fn (): mixed => $this->renderScripts('head'), 99);
        add_action('wp_footer', fn (): mixed => $this->renderScripts('body'), 99);
        add_action('pre_get_posts', [$this, 'resolveExistingThemeRoute'], 1);
        add_filter('pre_handle_404', [$this, 'claimManagedRoute'], 10, 2);
        add_filter('page_link', [$this, 'managedPageLink'], 99, 3);
        add_filter('redirect_canonical', [$this, 'preserveManagedRequestUrl'], 99, 2);
        add_filter('render_block_core/post-title', [$this, 'suppressManagedThemeTitle'], 99, 3);
        add_action('template_redirect', [$this, 'redirect'], 0);
    }

    /**
     * Existing Theme still renders through a native page, but a signed route
     * does not require every intermediate path segment to be a WordPress page.
     * Resolve the exact active route to its versioned post before SQL runs.
     */
    public function resolveExistingThemeRoute(\WP_Query $query): void
    {
        if (is_admin()
            || !$query->is_main_query()
            || $this->connection->profile() !== 'existing-theme'
            || !in_array(strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')), ['GET', 'HEAD'], true)) {
            return;
        }
        $request = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';
        $route = $this->releases->route(Support::requestRoute($request));
        $postId = is_array($route) ? (int) ($route['post_id'] ?? 0) : 0;
        if ($postId < 1 || get_post_meta($postId, '_pagecraft_managed', true) !== '1') {
            return;
        }
        $query->set('page_id', $postId);
        $query->set('post_type', 'page');
        $query->set('pagename', '');
        $query->set('name', '');
        $query->set('error', '');
        $query->is_page = true;
        $query->is_singular = true;
        $query->is_home = false;
        $query->is_posts_page = false;
        $query->is_404 = false;
    }

    /** Return the exact signed route for native APIs and canonical redirects. */
    public function managedPageLink(string $link, int $postId, bool $sample = false): string
    {
        if ($sample || $this->connection->profile() !== 'existing-theme') {
            return $link;
        }
        $route = $this->releases->routeForPost($postId);
        return $route && get_post_meta($postId, '_pagecraft_managed', true) === '1'
            ? home_url((string) $route['route_path'])
            : $link;
    }

    /** Never canonicalize an exact managed request back to its storage slug. */
    public function preserveManagedRequestUrl(mixed $redirect, mixed $requested): mixed
    {
        if ($this->connection->profile() !== 'existing-theme' || !is_string($requested)) {
            return $redirect;
        }
        $route = $this->releases->route(Support::requestRoute($requested));
        return $route && (int) ($route['post_id'] ?? 0) > 0 ? false : $redirect;
    }

    /**
     * Pagecraft Theme owns signed routes that do not need a native wp_posts
     * row. Claim only an exact active route before core finalizes a 404.
     */
    public function claimManagedRoute(bool $preempt, \WP_Query $query): bool
    {
        if ($preempt
            || is_admin()
            || $this->connection->profile() !== 'pagecraft-theme'
            || !in_array(strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')), ['GET', 'HEAD'], true)) {
            return $preempt;
        }
        $request = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';
        if (!$this->releases->route(Support::requestRoute($request))) {
            return $preempt;
        }
        $query->is_404 = false;
        status_header(200);
        return true;
    }

    public function redirect(): void
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if (!in_array($method, ['GET', 'HEAD'], true)) {
            return;
        }
        $request = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';
        $redirect = $this->releases->redirect(Support::requestRoute($request));
        if (!$redirect) {
            return;
        }
        $query = wp_parse_url($request, PHP_URL_QUERY);
        $target = home_url((string) $redirect['to']);
        if (is_string($query) && $query !== '') {
            $target .= '?' . $query;
        }
        wp_safe_redirect($target, (int) $redirect['status'], 'Pagecraft Connector');
        exit;
    }

    public function renderRoute(?string $path = null): ?string
    {
        if ($this->connection->profile() === 'existing-theme') {
            $route = is_singular() && get_post_meta((int) get_queried_object_id(), '_pagecraft_managed', true) === '1'
                ? $this->releases->routeForPost((int) get_queried_object_id())
                : null;
        } else {
            $route = $this->releases->route($path === null ? Support::requestRoute() : Support::normalizeRoute($path));
        }
        if (!$route) {
            return null;
        }
        do_action('pagecraft_before_managed_content', $route);
        $body = (string) $route['body_html'];
        if ($this->connection->profile() === 'existing-theme') {
            $body = Support::existingThemeBody($body);
        }
        $html = $this->forms->prepareHtml($body, (string) $route['route_path']);
        $html = (string) apply_filters('pagecraft_render_route', $html, $route);
        $html = $this->injectRuntimeMarkers($html, $route, $this->bodyRuntimeRegions());
        do_action('pagecraft_after_managed_content', $route);
        return $html;
    }

    public function renderManagedContent(?int $postId = null): string
    {
        $postId ??= (int) get_the_ID();
        $route = $this->releases->routeForPost($postId);
        if (!$route) {
            return '';
        }
        do_action('pagecraft_before_managed_content', $route);
        $body = (string) $route['body_html'];
        if ($this->connection->profile() === 'existing-theme') {
            $body = Support::existingThemeBody($body);
        }
        $html = $this->forms->prepareHtml($body, (string) $route['route_path']);
        $html = (string) apply_filters('pagecraft_managed_content', $html, $route, $postId);
        $html = $this->injectRuntimeMarkers($html, $route, $this->bodyRuntimeRegions());
        do_action('pagecraft_after_managed_content', $route);
        return $html;
    }

    public function filterContent(string $content): string
    {
        if (is_admin() || !is_singular() || !in_the_loop() || !is_main_query()) {
            return $content;
        }
        $managed = $this->renderManagedContent((int) get_the_ID());
        return $managed !== '' ? $managed : $content;
    }

    /**
     * Block themes render the native post title outside the_content. The
     * signed Pagecraft fragment already owns its heading, so remove only the
     * queried managed post's core/post-title block and leave related loops and
     * all native WordPress titles untouched.
     *
     * @param array<string,mixed> $block
     */
    public function suppressManagedThemeTitle(string $content, array $block, \WP_Block $instance): string
    {
        $postId = (int) ($instance->context['postId'] ?? 0);
        if (is_admin()
            || $this->connection->profile() !== 'existing-theme'
            || !is_singular()
            || $postId < 1
            || $postId !== (int) get_queried_object_id()
            || get_post_meta($postId, '_pagecraft_managed', true) !== '1'
            || !$this->releases->routeForPost($postId)) {
            return $content;
        }
        return '';
    }

    /** @param list<string> $classes @return list<string> */
    public function bodyClasses(array $classes): array
    {
        $active = $this->releases->active();
        if (!$active) {
            return $classes;
        }
        $classes[] = 'pagecraft-connected';
        $route = $this->currentRoute();
        if ($route) {
            $classes[] = 'pagecraft-managed';
            $classes[] = 'pagecraft-route-' . sanitize_html_class(trim(str_replace('/', '-', (string) $route['route_path']), '-') ?: 'home');
        }
        $classes[] = 'pagecraft-release-' . sanitize_html_class(substr((string) $active['release_id'], 0, 20));
        return array_values(array_unique($classes));
    }

    public function renderHead(): void
    {
        $route = $this->currentRoute();
        if (!$route) {
            return;
        }
        $head = $this->seo->stripOwnedTags((string) $route['head_html']);
        // SEO schema has one owner (fallback, Yoast, or Rank Math). Raw script
        // elements are invalid defense-in-depth; signed marker occurrences are
        // sanitized around and injected at their exact original head position.
        $head = (string) preg_replace('#<script\b(?:[^>"\']+|"[^"]*"|\'[^\']*\')*>[\s\S]*?</script\s*>#i', '', $head);
        $head = $this->injectRuntimeMarkers(
            $head,
            $route,
            ['route-head'],
            fn (string $chunk): string => wp_kses($chunk, $this->headAllowlist())
        );
        echo "\n" . $head . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- every non-runtime chunk passed through wp_kses; runtime is signed and approved.
    }

    /** @return array<string,array<string,bool>> */
    private function headAllowlist(): array
    {
        return [
            'meta' => ['charset' => true, 'name' => true, 'content' => true, 'property' => true, 'http-equiv' => true],
            'link' => [
                'rel' => true,
                'href' => true,
                'as' => true,
                'type' => true,
                'media' => true,
                'crossorigin' => true,
                'hreflang' => true,
                'sizes' => true,
                'color' => true,
                'imagesrcset' => true,
                'imagesizes' => true,
                'fetchpriority' => true,
                'referrerpolicy' => true,
            ],
            'style' => ['id' => true, 'media' => true, 'data-pagecraft-route' => true],
            'noscript' => [],
        ];
    }

    public function renderScripts(string $placement): void
    {
        $route = $this->currentRoute();
        if (!$route || !is_array($route['scripts'] ?? null)) {
            return;
        }
        $valid = ScriptOccurrences::validateComposed($route['scripts'], $this->connection->profile());
        if (is_wp_error($valid)) {
            return;
        }
        foreach ($route['scripts'] as $script) {
            if (!is_array($script)) {
                continue;
            }
            $where = (string) $script['placement'];
            $html = (string) ($script['html'] ?? '');
            $template = (string) ($script['template_html'] ?? $html);
            $fingerprint = strtolower((string) ($script['fingerprint'] ?? $script['hash'] ?? ''));
            $occurrence = (string) ($script['occurrenceId'] ?? '');
            $occurrenceKey = $this->occurrenceKey($route, $occurrence);
            if ($where !== $placement
                || (string) ($script['region'] ?? '') !== 'route-tail'
                || isset($this->printedScripts[$occurrenceKey])
                || !preg_match('/^[a-f0-9]{64}$/', $fingerprint)
                || !hash_equals($fingerprint, hash('sha256', $template))
                || !$this->scripts->isApproved($fingerprint)
                || !preg_match('#^<script\b[^>]*>[\s\S]*?</script\s*>$#i', trim($html))) {
                continue;
            }
            $this->printedScripts[$occurrenceKey] = true;
            echo "\n" . $html . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- signed and explicitly approved exact fingerprint.
        }
    }

    /** @return list<string> */
    private function bodyRuntimeRegions(): array
    {
        return $this->connection->profile() === 'pagecraft-theme'
            ? ['shared-header', 'route-body', 'shared-footer']
            : ['route-body'];
    }

    /**
     * @param array<string,mixed> $route
     * @param list<string> $regions
     * @param callable(string):string|null $sanitize
     */
    private function injectRuntimeMarkers(
        string $html,
        array $route,
        array $regions,
        ?callable $sanitize = null
    ): string {
        $scripts = is_array($route['scripts'] ?? null) ? $route['scripts'] : [];
        $valid = ScriptOccurrences::validateComposed($scripts, $this->connection->profile());
        $markers = is_wp_error($valid)
            ? $valid
            : ScriptOccurrences::validateMarkerStream($html, $scripts, $regions);
        if (is_wp_error($markers)) {
            return $this->stripRuntimeMarkers($sanitize ? $sanitize($html) : $html);
        }
        $byToken = [];
        foreach ($scripts as $script) {
            if (is_array($script) && in_array((string) ($script['region'] ?? ''), $regions, true)) {
                $byToken[(string) $script['token']] = $script;
            }
        }
        $parts = preg_split(
            '/(<!--%%PAGECRAFT_RUNTIME:script-[a-f0-9]{32}%%-->)/',
            $html,
            -1,
            PREG_SPLIT_DELIM_CAPTURE
        );
        if (!is_array($parts)) {
            return $this->stripRuntimeMarkers($sanitize ? $sanitize($html) : $html);
        }
        $rendered = '';
        foreach ($parts as $part) {
            if (!preg_match('/^<!--(%%PAGECRAFT_RUNTIME:script-[a-f0-9]{32}%%)-->$/', $part, $match)) {
                $rendered .= $sanitize ? $sanitize($part) : $part;
                continue;
            }
            $script = $byToken[$match[1]] ?? null;
            if (!is_array($script)) {
                continue;
            }
            $fingerprint = strtolower((string) ($script['fingerprint'] ?? $script['hash'] ?? ''));
            $occurrenceKey = $this->occurrenceKey($route, (string) $script['occurrenceId']);
            if (isset($this->printedScripts[$occurrenceKey]) || !$this->scripts->isApproved($fingerprint)) {
                continue;
            }
            $this->printedScripts[$occurrenceKey] = true;
            $rendered .= (string) $script['html'];
        }
        return $rendered;
    }

    private function stripRuntimeMarkers(string $html): string
    {
        return (string) preg_replace(
            '/<!--\s*%%PAGECRAFT_RUNTIME:[\s\S]*?%%\s*-->|%%PAGECRAFT_RUNTIME:[^%<]*%%/',
            '',
            $html
        );
    }

    /** @param array<string,mixed> $route */
    private function occurrenceKey(array $route, string $occurrenceId): string
    {
        return hash('sha256', implode("\0", [
            (string) ($route['release_id'] ?? ''),
            (string) ($route['route_path'] ?? ''),
            $occurrenceId,
        ]));
    }

    /** @return array<string,mixed>|null */
    private function currentRoute(): ?array
    {
        if (is_singular()) {
            $route = $this->releases->routeForPost((int) get_queried_object_id());
            if ($route) {
                return $route;
            }
        }
        if ($this->connection->profile() === 'existing-theme') {
            return null;
        }
        $request = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';
        return $this->releases->route(Support::requestRoute($request));
    }
}
