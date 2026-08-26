<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/** Builds immutable, non-public WordPress candidates for a deployment. */
final class Mapper
{
    private const DECISIONS_OPTION = 'pagecraft_route_decisions';
    private const CONFLICTS_OPTION = 'pagecraft_route_conflicts';
    private static bool $applying = false;
    private readonly RouteOwnership $ownership;

    public function __construct(private readonly ReleaseRepository $releases, ?RouteOwnership $ownership = null)
    {
        $this->ownership = $ownership ?? new RouteOwnership();
    }

    public function hooks(): void
    {
        add_action('init', [$this, 'registerContentTypes'], 5);
        add_action('init', [$this, 'registerMeta'], 6);
    }

    public static function isApplying(): bool
    {
        return self::$applying;
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    public function preflight(array $manifest): bool|\WP_Error
    {
        $translations = $this->routeTranslations($manifest);
        if (is_wp_error($translations)) {
            update_option(self::CONFLICTS_OPTION, [], false);
            return $translations;
        }
        $redirects = $this->translateRedirects((array) ($manifest['redirects'] ?? []), $translations);
        if (is_wp_error($redirects)) {
            update_option(self::CONFLICTS_OPTION, [], false);
            return $redirects;
        }
        $conflicts = [];
        foreach ((array) ($manifest['pages'] ?? []) as $page) {
            if (!is_array($page)) {
                continue;
            }
            $route = Support::normalizeRoute((string) ($page['path'] ?? $page['route'] ?? '/'));
            $translation = $translations[$route] ?? null;
            if (!is_array($translation) || $translation['target'] === null) {
                continue;
            }
            $choice = (string) $translation['decision'];
            $candidateRoute = (string) $translation['target'];
            $owner = $this->ownership->owner($candidateRoute);
            if (is_wp_error($owner)) {
                $owner = [
                    'owner_type' => 'rewrite', 'label' => $owner->get_error_message(), 'object_id' => 0,
                    'post_id' => 0, 'post_type' => '', 'taxonomy' => '', 'rewrite_query' => '',
                    'replaceable' => false, 'ambiguous' => true,
                ];
            }
            if (!is_array($owner)) {
                continue;
            }
            $resolved = $choice === 'keep' && $candidateRoute === $route;
            $resolved = $resolved || ($choice === 'replace'
                && $candidateRoute === $route
                && ($owner['replaceable'] ?? false) === true);
            if (!$resolved) {
                $conflicts[$route] = [
                    'route' => $route,
                    'mapped_route' => $candidateRoute,
                    'post_id' => (int) ($owner['post_id'] ?? 0),
                    'object_id' => (int) ($owner['object_id'] ?? 0),
                    'title' => (string) ($owner['label'] ?? 'WordPress route'),
                    'owner_type' => (string) ($owner['owner_type'] ?? 'rewrite'),
                    'post_type' => (string) ($owner['post_type'] ?? ''),
                    'taxonomy' => (string) ($owner['taxonomy'] ?? ''),
                    'replace_allowed' => ($owner['replaceable'] ?? false) === true && $candidateRoute === $route,
                    'ambiguous' => ($owner['ambiguous'] ?? false) === true,
                ];
            }
        }
        update_option(self::CONFLICTS_OPTION, $conflicts, false);
        return $conflicts === []
            ? true
            : new \WP_Error('pagecraft_route_decision_required', 'One or more Pagecraft routes conflict with unmanaged WordPress pages. Choose Keep, Replace, or Map elsewhere in Pagecraft Operate.');
    }

    /**
     * Build the target-local release projection after the signed manifest and
     * artifact have been verified. Source paths remain recorded for audit, but
     * every WordPress consumer receives the same translated route table.
     *
     * @param array<string,mixed> $manifest
     * @return array<string,mixed>|\WP_Error
     */
    public function localizeManifest(array $manifest): array|\WP_Error
    {
        $translations = $this->routeTranslations($manifest);
        if (is_wp_error($translations)) {
            return $translations;
        }
        $targetPath = $this->targetPath((string) ($manifest['targetPath'] ?? '/'));

        $pages = [];
        foreach ((array) ($manifest['pages'] ?? []) as $page) {
            if (!is_array($page)) {
                return new \WP_Error('pagecraft_page_invalid', 'A release page entry is invalid.');
            }
            $source = Support::normalizeRoute((string) ($page['path'] ?? $page['route'] ?? '/'));
            $translation = $translations[$source] ?? null;
            if (!is_array($translation)) {
                return new \WP_Error('pagecraft_route_translation_missing', 'A Pagecraft route has no target-local translation.');
            }
            $page['_sourcePath'] = $source;
            $page['_routeDecision'] = (string) $translation['decision'];
            $page['_pagecraftSkip'] = $translation['target'] === null;
            if ($translation['target'] !== null) {
                $target = (string) $translation['target'];
                $page['path'] = $target;
                $page['route'] = $target;
                foreach (['bodyHtml', 'headHtml'] as $htmlKey) {
                    if (is_string($page[$htmlKey] ?? null)) {
                        $page[$htmlKey] = $this->translateHtmlRoutes((string) $page[$htmlKey], $translations, $targetPath);
                    }
                }
                if (is_array($page['_shared'] ?? null)) {
                    foreach (['headerHtml', 'footerHtml'] as $htmlKey) {
                        if (is_string($page['_shared'][$htmlKey] ?? null)) {
                            $page['_shared'][$htmlKey] = $this->translateHtmlRoutes((string) $page['_shared'][$htmlKey], $translations, $targetPath);
                        }
                    }
                }
                if (is_array($page['seo'] ?? null)) {
                    $page['seo'] = $this->translateSeo((array) $page['seo'], $translations);
                }
                if (isset($page['parentPath']) && is_string($page['parentPath'])) {
                    $page['parentPath'] = $this->translateRouteReference($page['parentPath'], $translations);
                }
            }
            $pages[] = $page;
        }
        $manifest['pages'] = $pages;

        $forms = $this->translateRoutedDefinitions((array) ($manifest['forms'] ?? []), $translations);
        if (is_wp_error($forms)) {
            return $forms;
        }
        $manifest['forms'] = $forms;
        if (is_array($manifest['entities'] ?? null)) {
            $manifest['entities']['forms'] = $forms;
            $entityPages = [];
            foreach ((array) ($manifest['entities']['pages'] ?? []) as $entity) {
                if (!is_array($entity)) {
                    continue;
                }
                $source = Support::normalizeRoute((string) ($entity['path'] ?? $entity['route'] ?? '/'));
                $target = $translations[$source]['target'] ?? null;
                if ($target === null) {
                    continue;
                }
                $entity['_sourcePath'] = $source;
                $entity['path'] = (string) $target;
                $entityPages[] = $entity;
            }
            $manifest['entities']['pages'] = $entityPages;
        }

        $placeholders = $this->translateRoutedDefinitions((array) ($manifest['placeholders'] ?? []), $translations);
        if (is_wp_error($placeholders)) {
            return $placeholders;
        }
        $manifest['placeholders'] = $placeholders;
        $redirects = $this->translateRedirects((array) ($manifest['redirects'] ?? []), $translations);
        if (is_wp_error($redirects)) {
            return $redirects;
        }
        $manifest['redirects'] = $redirects;
        if (is_array($manifest['nativeOps'] ?? null)) {
            $manifest['nativeOps'] = $this->translateStructuredRoutes($manifest['nativeOps'], $translations);
        }
        $manifest['_routeTranslations'] = $translations;
        return $manifest;
    }

    /** @return array<string,array<string,mixed>> */
    public function conflicts(): array
    {
        $value = get_option(self::CONFLICTS_OPTION, []);
        return is_array($value) ? $value : [];
    }

    public function setDecision(string $route, string $decision, string $path = ''): bool
    {
        $scope = $this->currentDecisionScope();
        if ($scope === null) {
            return false;
        }
        $route = Support::normalizeRoute($route);
        if (!in_array($decision, ['keep', 'replace', 'map'], true)) {
            return false;
        }
        if ($decision === 'replace') {
            $owner = $this->ownership->owner($route);
            if (!is_array($owner) || ($owner['replaceable'] ?? false) !== true) {
                return false;
            }
        }
        if ($decision === 'map') {
            $path = Support::normalizeRoute($path);
            if ($path === '/' || $path === $route || strlen($path) > 191 || $this->hasHtmlPathSegment($path)) {
                return false;
            }
        }
        $stored = get_option(self::DECISIONS_OPTION, []);
        $stored = is_array($stored) && $this->decisionScopeMatches($stored['scope'] ?? null, $scope)
            ? $stored
            : ['version' => 2, 'scope' => $scope, 'routes' => []];
        $decisions = is_array($stored['routes'] ?? null) ? $stored['routes'] : [];
        $decisions[$route] = ['decision' => $decision, 'path' => $decision === 'map' ? $path : '', 'updated_at' => Support::utcNow(), 'user_id' => get_current_user_id()];
        $stored['version'] = 2;
        $stored['scope'] = $scope;
        $stored['routes'] = $decisions;
        update_option(self::DECISIONS_OPTION, $stored, false);
        return true;
    }

    /**
     * @param array<string,mixed> $manifest
     * @return array<string,array{source:string,target:?string,decision:string}>|\WP_Error
     */
    private function routeTranslations(array $manifest): array|\WP_Error
    {
        $sources = [];
        foreach ((array) ($manifest['pages'] ?? []) as $page) {
            if (!is_array($page)) {
                return new \WP_Error('pagecraft_page_invalid', 'A release page entry is invalid.');
            }
            $source = Support::normalizeRoute((string) ($page['path'] ?? $page['route'] ?? '/'));
            if (strlen($source) > 191 || isset($sources[$source])) {
                return new \WP_Error('pagecraft_route_source_duplicate', sprintf('The signed release declares the Pagecraft route %s more than once.', $source));
            }
            $sources[$source] = true;
        }

        $profile = (string) ($manifest['profile'] ?? '');
        $translations = [];
        foreach (array_keys($sources) as $source) {
            $decision = $this->decision($source);
            $choice = (string) ($decision['decision'] ?? '');
            if ($profile === 'existing-theme' && $source === '/') {
                $translations[$source] = ['source' => $source, 'target' => null, 'decision' => 'keep'];
                continue;
            }
            if ($choice === 'keep') {
                $translations[$source] = ['source' => $source, 'target' => null, 'decision' => 'keep'];
                continue;
            }
            if ($choice === 'map') {
                $target = Support::normalizeRoute((string) ($decision['path'] ?? ''));
                if ($target === '/' || $target === $source || strlen($target) > 191 || $this->hasHtmlPathSegment($target)) {
                    return new \WP_Error('pagecraft_route_map_invalid', sprintf('The local map for %s has an invalid destination.', $source));
                }
                $translations[$source] = ['source' => $source, 'target' => $target, 'decision' => 'map'];
                continue;
            }
            $translations[$source] = ['source' => $source, 'target' => $source, 'decision' => $choice === 'replace' ? 'replace' : 'default'];
        }

        // Mapping a parent carries its route subtree unless a child has its own
        // explicit decision. This keeps hierarchical permalinks, navigation,
        // forms, redirects and SEO on one deterministic target-local topology.
        $mappedParents = array_filter($translations, static fn (array $item): bool => $item['decision'] === 'map');
        uksort($mappedParents, static fn (string $a, string $b): int => strlen($b) <=> strlen($a));
        foreach ($translations as $source => $translation) {
            if ($translation['decision'] !== 'default') {
                continue;
            }
            foreach ($mappedParents as $parentSource => $parent) {
                if ($parentSource !== '/' && str_starts_with($source, $parentSource)) {
                    $translations[$source]['target'] = rtrim((string) $parent['target'], '/') . '/' . ltrim(substr($source, strlen($parentSource)), '/');
                    $translations[$source]['target'] = Support::normalizeRoute((string) $translations[$source]['target']);
                    $translations[$source]['decision'] = 'map-inherited';
                    break;
                }
            }
        }

        $targets = [];
        foreach ($translations as $source => $translation) {
            $target = $translation['target'];
            if ($target === null) {
                continue;
            }
            if ($target === '' || strlen($target) > 191 || Support::normalizeRoute($target) !== $target || $this->hasHtmlPathSegment($target)) {
                return new \WP_Error(
                    $this->hasHtmlPathSegment($target) ? 'pagecraft_route_html_target' : 'pagecraft_route_target_invalid',
                    $this->hasHtmlPathSegment($target)
                        ? sprintf('Pagecraft route %s resolves to a forbidden public .html path after applying local route mappings.', $source)
                        : sprintf('Pagecraft route %s resolves to an invalid target path after applying local route mappings.', $source)
                );
            }
            if (isset($targets[$target])) {
                return new \WP_Error(
                    'pagecraft_route_target_duplicate',
                    sprintf('Pagecraft routes %s and %s both resolve to %s on this WordPress target.', $targets[$target], $source, $target)
                );
            }
            $targets[$target] = $source;
        }
        return $translations;
    }

    private function hasHtmlPathSegment(string $path): bool
    {
        return (bool) preg_match('#(?:^|/)[^/]*\.html(?:/|$)#i', Support::normalizeRoute($path));
    }

    /**
     * @param list<mixed> $definitions
     * @param array<string,array{source:string,target:?string,decision:string}> $translations
     * @return list<array<string,mixed>>|\WP_Error
     */
    private function translateRoutedDefinitions(array $definitions, array $translations): array|\WP_Error
    {
        $translated = [];
        foreach ($definitions as $definition) {
            if (!is_array($definition)) {
                return new \WP_Error('pagecraft_route_definition_invalid', 'A signed routed definition is invalid.');
            }
            if (!isset($definition['routePath']) || !is_string($definition['routePath'])) {
                return new \WP_Error('pagecraft_route_definition_invalid', 'A signed routed definition has no valid route path.');
            }
            /* Shared header/footer occurrences are target-neutral by definition. They
               belong to every localized route and therefore must not be looked up as a
               Pagecraft page route. Staging still validates the exact shared occurrence. */
            if ($definition['routePath'] === '*') {
                $translated[] = $definition;
                continue;
            }
            $source = Support::normalizeRoute($definition['routePath']);
            if (!isset($translations[$source])) {
                return new \WP_Error('pagecraft_route_definition_orphan', sprintf('A signed definition refers to unknown Pagecraft route %s.', $source));
            }
            $target = $translations[$source]['target'];
            if ($target === null) {
                continue;
            }
            $definition['_sourceRoutePath'] = $source;
            $definition['routePath'] = $target;
            $translated[] = $definition;
        }
        return $translated;
    }

    /**
     * @param list<mixed> $redirects
     * @param array<string,array{source:string,target:?string,decision:string}> $translations
     * @return list<array<string,mixed>>|\WP_Error
     */
    private function translateRedirects(array $redirects, array $translations): array|\WP_Error
    {
        $translated = [];
        $seen = [];
        foreach ($redirects as $redirect) {
            if (!is_array($redirect) || !is_string($redirect['from'] ?? null) || !is_string($redirect['to'] ?? null)) {
                return new \WP_Error('pagecraft_redirect_invalid', 'A signed redirect is invalid.');
            }
            $from = $this->translateRouteReference($redirect['from'], $translations, true);
            $to = $this->translateRouteReference($redirect['to'], $translations);
            if ($from === '' || $to === '' || $from === $to) {
                continue;
            }
            if (strlen(Support::normalizeRoute($from)) > 191 || strlen(Support::normalizeRoute($to)) > 191) {
                return new \WP_Error(
                    'pagecraft_redirect_target_invalid',
                    'A target-local Pagecraft redirect exceeds the WordPress route storage boundary after applying local route mappings.'
                );
            }
            $key = $from . "\0" . $to;
            if (isset($seen[$key])) {
                continue;
            }
            $redirect['_sourceFrom'] = $redirect['from'];
            $redirect['_sourceTo'] = $redirect['to'];
            $redirect['from'] = $from;
            $redirect['to'] = $to;
            $translated[] = $redirect;
            $seen[$key] = true;
        }
        return $translated;
    }

    /**
     * Rewrite only URL-bearing HTML attributes. Script/style text and ordinary
     * content are never globally substituted.
     *
     * @param array<string,array{source:string,target:?string,decision:string}> $translations
     */
    private function translateHtmlRoutes(string $html, array $translations, string $targetPath = '/'): string
    {
        $length = strlen($html);
        $cursor = 0;
        $output = '';
        while ($cursor < $length) {
            $opening = strpos($html, '<', $cursor);
            if ($opening === false) {
                $output .= substr($html, $cursor);
                break;
            }
            $output .= substr($html, $cursor, $opening - $cursor);
            if (substr($html, $opening, 4) === '<!--') {
                $commentEnd = strpos($html, '-->', $opening + 4);
                if ($commentEnd === false) {
                    $output .= substr($html, $opening);
                    break;
                }
                $commentEnd += 3;
                $output .= substr($html, $opening, $commentEnd - $opening);
                $cursor = $commentEnd;
                continue;
            }
            $tagEnd = $this->htmlTagEnd($html, $opening);
            if ($tagEnd === null) {
                $output .= substr($html, $opening);
                break;
            }
            $tag = substr($html, $opening, $tagEnd - $opening + 1);
            $tagName = '';
            if (preg_match('/^<\s*([A-Za-z][A-Za-z0-9:-]*)\b/', $tag, $tagMatch)) {
                $tagName = strtolower((string) $tagMatch[1]);
                $tag = $this->translateOpeningTag($tag, $translations, $targetPath);
            }
            $output .= $tag;
            $cursor = $tagEnd + 1;

            // Browser raw-text/RCDATA contents are not markup. Skip them as a
            // single token so comments, code, JSON, and textarea examples that
            // contain URL-looking tags can never be rewritten accidentally.
            if (in_array($tagName, ['script', 'style', 'title', 'textarea'], true)) {
                $closing = stripos($html, '</' . $tagName, $cursor);
                if ($closing === false) {
                    $output .= substr($html, $cursor);
                    break;
                }
                $output .= substr($html, $cursor, $closing - $cursor);
                $cursor = $closing;
            }
        }
        return $output;
    }

    private function htmlTagEnd(string $html, int $opening): ?int
    {
        $quote = '';
        $length = strlen($html);
        for ($index = $opening + 1; $index < $length; $index++) {
            $character = $html[$index];
            if ($quote !== '') {
                if ($character === $quote) {
                    $quote = '';
                }
                continue;
            }
            if ($character === '"' || $character === "'") {
                $quote = $character;
                continue;
            }
            if ($character === '>') {
                return $index;
            }
        }
        return null;
    }

    /**
     * Rewrite semantic attribute values in one real opening tag. Attribute-like
     * text nested inside a quoted value is never scanned as another attribute.
     *
     * @param array<string,array{source:string,target:?string,decision:string}> $translations
     */
    private function translateOpeningTag(string $tag, array $translations, string $targetPath): string
    {
        if (!preg_match('/^<\s*[A-Za-z][A-Za-z0-9:-]*/', $tag, $tagMatch)) {
            return $tag;
        }
        $urlAttributes = ['href', 'src', 'poster', 'cite', 'action', 'formaction'];
        $listAttributes = ['srcset', 'imagesrcset'];
        $cursor = strlen((string) $tagMatch[0]);
        $length = strlen($tag);
        $replacements = [];
        while ($cursor < $length) {
            while ($cursor < $length && preg_match('/\s/', $tag[$cursor])) {
                $cursor++;
            }
            if ($cursor >= $length || $tag[$cursor] === '>' || $tag[$cursor] === '/') {
                break;
            }
            $nameStart = $cursor;
            while ($cursor < $length && !preg_match('/[\s=\/>]/', $tag[$cursor])) {
                $cursor++;
            }
            if ($cursor === $nameStart) {
                $cursor++;
                continue;
            }
            $name = strtolower(substr($tag, $nameStart, $cursor - $nameStart));
            while ($cursor < $length && preg_match('/\s/', $tag[$cursor])) {
                $cursor++;
            }
            if ($cursor >= $length || $tag[$cursor] !== '=') {
                continue;
            }
            $cursor++;
            while ($cursor < $length && preg_match('/\s/', $tag[$cursor])) {
                $cursor++;
            }
            if ($cursor >= $length) {
                break;
            }
            $quote = '';
            if ($tag[$cursor] === '"' || $tag[$cursor] === "'") {
                $quote = $tag[$cursor];
                $cursor++;
            }
            $valueStart = $cursor;
            if ($quote !== '') {
                while ($cursor < $length && $tag[$cursor] !== $quote) {
                    $cursor++;
                }
            } else {
                while ($cursor < $length && !preg_match('/[\s>]/', $tag[$cursor])) {
                    $cursor++;
                }
            }
            $valueEnd = $cursor;
            $raw = substr($tag, $valueStart, $valueEnd - $valueStart);
            $value = html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $translated = $value;
            if (in_array($name, $urlAttributes, true)) {
                $translated = $this->translateRouteReference($value, $translations);
                $translated = $this->prefixTargetPath($translated, $targetPath);
            } elseif (in_array($name, $listAttributes, true)) {
                $translated = $this->translateUrlList($value, $translations, $targetPath);
            }
            if ($translated !== $value) {
                $encoded = esc_attr($translated);
                $replacements[] = [$valueStart, $valueEnd, $quote === '' ? '"' . $encoded . '"' : $encoded];
            }
            if ($quote !== '' && $cursor < $length && $tag[$cursor] === $quote) {
                $cursor++;
            }
        }
        for ($index = count($replacements) - 1; $index >= 0; $index--) {
            [$start, $end, $replacement] = $replacements[$index];
            $tag = substr($tag, 0, $start) . $replacement . substr($tag, $end);
        }
        return $tag;
    }

    /** Localize root-relative candidates while preserving descriptors/order. */
    private function translateUrlList(string $value, array $translations, string $targetPath): string
    {
        $segments = preg_split('/(,)/', $value, -1, PREG_SPLIT_DELIM_CAPTURE);
        if (!is_array($segments)) {
            return $value;
        }
        $dataPayload = false;
        foreach ($segments as $index => $segment) {
            if ($segment === ',') {
                continue;
            }
            $trimmed = ltrim($segment);
            if ($dataPayload) {
                $dataPayload = false;
                continue;
            }
            if (str_starts_with(strtolower($trimmed), 'data:')) {
                $dataPayload = true;
                continue;
            }
            if (!preg_match('/^(\s*)(\/(?!\/)[^\s,]+)([\s\S]*)$/', $segment, $match)) {
                continue;
            }
            $url = $this->translateRouteReference((string) $match[2], $translations);
            $url = $this->prefixTargetPath($url, $targetPath);
            $segments[$index] = (string) $match[1] . $url . (string) $match[3];
        }
        return implode('', $segments);
    }

    /** Prefix a target-neutral public URL with the exact WordPress home path. */
    private function prefixTargetPath(string $reference, string $targetPath): string
    {
        if ($reference === ''
            || $targetPath === '/'
            || str_starts_with($reference, '#')
            || str_starts_with($reference, '%%PAGECRAFT_')
            || str_starts_with($reference, 'pc-asset://')) {
            return $reference;
        }
        $parts = wp_parse_url($reference);
        if (!is_array($parts)
            || isset($parts['scheme'])
            || isset($parts['host'])
            || !str_starts_with($reference, '/')
            || str_starts_with($reference, '//')) {
            return $reference;
        }
        $path = (string) ($parts['path'] ?? '/');
        $base = rtrim($targetPath, '/');
        if ($path === $base || str_starts_with($path, $base . '/')) {
            return $reference;
        }
        $path = $path === '/' ? $base . '/' : $base . '/' . ltrim($path, '/');
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';
        $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';
        return $path . $query . $fragment;
    }

    private function targetPath(string $value): string
    {
        $value = '/' . trim($value, '/');
        return $value === '/' ? '/' : $value . '/';
    }

    /**
     * @param array<string,array{source:string,target:?string,decision:string}> $translations
     */
    private function translateRouteReference(string $reference, array $translations, bool $translateAlias = false): string
    {
        if ($reference === '' || str_starts_with($reference, '#') || str_starts_with($reference, '%%PAGECRAFT_')) {
            return $reference;
        }
        $parts = wp_parse_url($reference);
        if (!is_array($parts) || isset($parts['scheme']) || isset($parts['host']) || !str_starts_with($reference, '/')) {
            return $reference;
        }
        $path = (string) ($parts['path'] ?? '/');
        $ordered = $translations;
        uksort($ordered, static fn (string $a, string $b): int => strlen($b) <=> strlen($a));
        foreach ($ordered as $source => $translation) {
            $target = $translation['target'];
            if ($target === null || $target === $source) {
                continue;
            }
            $normalizedPath = Support::normalizeRoute($path);
            if ($normalizedPath === $source) {
                $path = (string) $target;
                break;
            }
            if ($source !== '/' && str_starts_with($normalizedPath, $source)) {
                $path = rtrim((string) $target, '/') . '/' . ltrim(substr($normalizedPath, strlen($source)), '/');
                break;
            }
            if ($translateAlias) {
                $sourceBase = rtrim($source, '/');
                if ($path === $sourceBase . '.html' || $path === $sourceBase . '/index.html') {
                    $suffix = str_ends_with($path, '/index.html') ? '/index.html' : '.html';
                    $path = rtrim((string) $target, '/') . $suffix;
                    break;
                }
            }
        }
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';
        $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';
        return $path . $query . $fragment;
    }

    /**
     * @param array<string,mixed> $seo
     * @param array<string,array{source:string,target:?string,decision:string}> $translations
     * @return array<string,mixed>
     */
    private function translateSeo(array $seo, array $translations): array
    {
        foreach (['canonical', 'ogUrl'] as $key) {
            if (is_string($seo[$key] ?? null)) {
                $seo[$key] = $this->translateRouteReference($seo[$key], $translations);
            }
        }
        if (is_array($seo['og'] ?? null) && is_string($seo['og']['url'] ?? null)) {
            $seo['og']['url'] = $this->translateRouteReference($seo['og']['url'], $translations);
        }
        foreach (['structuredData', 'schema'] as $key) {
            if (!isset($seo[$key])) {
                continue;
            }
            if (is_string($seo[$key])) {
                $decoded = json_decode($seo[$key], true);
                if (is_array($decoded)) {
                    $seo[$key] = Support::json($this->translateStructuredRoutes($decoded, $translations));
                }
            } elseif (is_array($seo[$key])) {
                $seo[$key] = $this->translateStructuredRoutes($seo[$key], $translations);
            }
        }
        return $seo;
    }

    /**
     * @param array<mixed> $value
     * @param array<string,array{source:string,target:?string,decision:string}> $translations
     * @return array<mixed>
     */
    private function translateStructuredRoutes(array $value, array $translations): array
    {
        $urlKeys = ['url', '@id', 'path', 'route', 'routePath', 'parentPath', 'from', 'to', 'href', 'action'];
        foreach ($value as $key => $child) {
            if (is_array($child)) {
                $value[$key] = $this->translateStructuredRoutes($child, $translations);
            } elseif (is_string($child) && in_array((string) $key, $urlKeys, true)) {
                $value[$key] = $this->translateRouteReference($child, $translations, in_array((string) $key, ['from', 'to'], true));
            }
        }
        return $value;
    }

    public function registerContentTypes(): void
    {
        foreach (['pagecraft_staged', 'pagecraft_retained'] as $status) {
            register_post_status($status, [
                'label' => $status === 'pagecraft_staged' ? __('Pagecraft candidate', 'pagecraft-connector') : __('Pagecraft retained', 'pagecraft-connector'),
                'public' => false,
                'internal' => true,
                'protected' => true,
                'exclude_from_search' => true,
                'show_in_admin_all_list' => false,
                'show_in_admin_status_list' => false,
            ]);
        }
        register_post_type('pagecraft_entry', [
            'labels' => [
                'name' => __('Pagecraft CMS', 'pagecraft-connector'),
                'singular_name' => __('Pagecraft entry', 'pagecraft-connector'),
                'edit_item' => __('Review Pagecraft entry', 'pagecraft-connector'),
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'pagecraft',
            'show_in_rest' => true,
            'supports' => ['revisions'],
            'rewrite' => false,
            'capability_type' => 'post',
            'map_meta_cap' => true,
            'capabilities' => ['create_posts' => 'do_not_allow'],
        ]);
        register_taxonomy('pagecraft_collection', ['pagecraft_entry'], [
            'labels' => ['name' => __('Collections', 'pagecraft-connector'), 'singular_name' => __('Collection', 'pagecraft-connector')],
            'public' => false,
            'show_ui' => false,
            'show_in_rest' => false,
            'meta_box_cb' => false,
            'hierarchical' => false,
            'rewrite' => false,
        ]);
    }

    public function registerMeta(): void
    {
        register_post_meta('pagecraft_entry', 'pagecraft_fields', [
            'type' => 'object',
            'single' => true,
            'show_in_rest' => false,
            'sanitize_callback' => static fn (mixed $value): array => is_array($value)
                ? array_map(static fn (mixed $item): string => sanitize_textarea_field((string) $item), $value)
                : [],
            'auth_callback' => static fn (): bool => current_user_can('edit_posts'),
        ]);
        register_post_meta('pagecraft_entry', '_pagecraft_collection_schema', [
            'type' => 'object',
            'single' => true,
            'show_in_rest' => false,
            'sanitize_callback' => static fn (mixed $value): array => is_array($value) ? $value : [],
            'auth_callback' => static fn (): bool => current_user_can('edit_posts'),
        ]);
    }

    /**
     * @param array<string,mixed> $manifest
     * @param array<string,string> $files Signed relative path to staged file.
     * @return list<array<string,mixed>>|\WP_Error
     */
    public function apply(array $manifest, array $files): array|\WP_Error
    {
        $deploymentId = (string) ($manifest['deploymentId'] ?? '');
        if (!Support::validIdentifier($deploymentId, 160)) {
            return new \WP_Error('pagecraft_deployment_identity', 'The deployment has no valid target identity.');
        }
        self::$applying = true;
        try {
            $assetUrls = $this->mapAssets($manifest, $files);
            if (is_wp_error($assetUrls)) {
                return $assetUrls;
            }
            if (is_wp_error($failed = $this->checkpoint('assets', $manifest))) {
                return $failed;
            }

            $pages = $manifest['pages'] ?? [];
            if (!is_array($pages)) {
                return new \WP_Error('pagecraft_pages_invalid', 'The release page map is invalid.');
            }
            $routes = [];
            $postByPage = [];
            $pageByRoute = [];
            foreach ($pages as $page) {
                if (!is_array($page)) {
                    return new \WP_Error('pagecraft_page_invalid', 'A release page entry is invalid.');
                }
                if (($page['_pagecraftSkip'] ?? false) === true) {
                    continue;
                }
                $page['_profile'] = (string) ($manifest['profile'] ?? '');
                $page['_deploymentId'] = $deploymentId;
                $page['_artifactHash'] = (string) ($manifest['artifactHash'] ?? '');
                $hydrated = $this->hydratePage($page, $files, $assetUrls);
                if (is_wp_error($hydrated)) {
                    return $hydrated;
                }
                $originalRoute = Support::normalizeRoute((string) ($page['_sourcePath'] ?? $hydrated['route_path']));
                $choice = (string) ($page['_routeDecision'] ?? ($this->decision($originalRoute)['decision'] ?? 'default'));
                if ($choice === 'replace') {
                    $path = trim($originalRoute, '/');
                    $collision = $path !== '' ? get_page_by_path($path, OBJECT, 'page') : null;
                    if ($collision instanceof \WP_Post && get_post_meta($collision->ID, '_pagecraft_managed', true) !== '1') {
                        $hydrated['_replace_post_id'] = $collision->ID;
                    }
                }
                $currentOwner = $this->ownership->owner((string) $hydrated['route_path']);
                if (is_wp_error($currentOwner)) {
                    return $currentOwner;
                }
                if (is_array($currentOwner)
                    && !($choice === 'replace'
                        && ($currentOwner['replaceable'] ?? false) === true
                        && (string) $hydrated['route_path'] === $originalRoute)) {
                    return new \WP_Error('pagecraft_route_collision_changed', sprintf(
                        'WordPress route ownership at %s changed after preflight (%s).',
                        (string) $hydrated['route_path'],
                        (string) ($currentOwner['owner_type'] ?? 'rewrite')
                    ));
                }
                if (($manifest['profile'] ?? '') === 'pagecraft-theme' && (string) $hydrated['route_path'] === '/') {
                    $hydrated['post_id'] = null;
                    $routes[] = $hydrated;
                    continue;
                }
                $postId = $this->mapPage($manifest, $hydrated);
                if (is_wp_error($postId)) {
                    return $postId;
                }
                $pageId = (string) $hydrated['page_id'];
                $postByPage[$pageId] = $postId;
                $pageByRoute[(string) $hydrated['route_path']] = $pageId;
                $hydrated['post_id'] = $postId;
                $routes[] = $hydrated;
            }
            if (is_wp_error($failed = $this->checkpoint('pages', $manifest))) {
                return $failed;
            }
            $parents = $this->mapPageParents($manifest, $routes, $postByPage, $pageByRoute);
            if (is_wp_error($parents)) {
                return $parents;
            }
            if (is_wp_error($failed = $this->checkpoint('parents', $manifest))) {
                return $failed;
            }
            $cms = $this->mapCms($manifest);
            if (is_wp_error($cms)) {
                return $cms;
            }
            if (is_wp_error($failed = $this->checkpoint('cms', $manifest))) {
                return $failed;
            }
            return $routes;
        } finally {
            self::$applying = false;
        }
    }

    /** @param array<string,mixed> $manifest @param array<string,string> $files @return array<string,string>|\WP_Error */
    private function mapAssets(array $manifest, array $files): array|\WP_Error
    {
        $urls = [];
        $assets = $manifest['assets'] ?? [];
        if (!is_array($assets)) {
            return new \WP_Error('pagecraft_assets_invalid', 'The release asset map is invalid.');
        }
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                return new \WP_Error('pagecraft_asset_invalid', 'A release asset entry is invalid.');
            }
            $sourceId = (string) ($asset['assetId'] ?? $asset['id'] ?? '');
            $path = (string) ($asset['file'] ?? $asset['path'] ?? '');
            $hash = strtolower((string) ($asset['sha256'] ?? $asset['hash'] ?? $this->fileHashFromManifest($manifest, $path)));
            if (!Support::validIdentifier($sourceId) || !isset($files[$path]) || !preg_match('/^[a-f0-9]{64}$/', $hash)) {
                return new \WP_Error('pagecraft_asset_mapping', 'A release asset cannot be mapped safely.');
            }
            $candidate = $this->deploymentMapping('asset', $sourceId, (string) $manifest['deploymentId']);
            $active = $this->activeMapping('asset', $sourceId);
            if ($candidate && hash_equals((string) $candidate['object_hash'], $hash) && get_post((int) $candidate['object_id'])) {
                $attachmentId = (int) $candidate['object_id'];
            } elseif ($active && hash_equals((string) $active['object_hash'], $hash) && get_post((int) $active['object_id'])) {
                $attachmentId = (int) $active['object_id'];
            } else {
                $attachmentId = $this->importAttachment($asset, $files[$path]);
                if (is_wp_error($attachmentId)) {
                    return $attachmentId;
                }
            }
            $saved = $this->saveMapping($manifest, 'asset', $sourceId, $attachmentId, $hash, 'inherit');
            if (is_wp_error($saved)) {
                return $saved;
            }
            $url = wp_get_attachment_url($attachmentId);
            if (!is_string($url) || $url === '') {
                return new \WP_Error('pagecraft_attachment_url', 'WordPress could not resolve an imported Pagecraft asset.');
            }
            $urls[$sourceId] = $url;
        }
        return $urls;
    }

    /** @param array<string,mixed> $asset @return int|\WP_Error */
    private function importAttachment(array $asset, string $source): int|\WP_Error
    {
        $declared = strtolower(trim((string) ($asset['mime'] ?? '')));
        $filename = $this->safeAssetFilename((string) ($asset['filename'] ?? basename($source)), $declared, (string) ($asset['assetId'] ?? $asset['id'] ?? 'asset'));
        if (is_wp_error($filename)) {
            return $filename;
        }
        if (!is_file($source) || !is_readable($source)) {
            return new \WP_Error('pagecraft_asset_source', sprintf('The signed bytes for %s are unavailable.', $filename));
        }
        $expectedHash = strtolower((string) ($asset['hash'] ?? $asset['sha256'] ?? ''));
        $actualHash = hash_file('sha256', $source);
        if (!preg_match('/^[a-f0-9]{64}$/', $expectedHash)
            || !is_string($actualHash)
            || !hash_equals($expectedHash, $actualHash)) {
            return new \WP_Error('pagecraft_asset_hash', sprintf('The signed bytes for %s no longer match the release.', $filename));
        }
        if (isset($asset['bytes']) && (!is_int($asset['bytes']) || $asset['bytes'] < 0 || filesize($source) !== $asset['bytes'])) {
            return new \WP_Error('pagecraft_asset_bytes', sprintf('The signed byte count for %s no longer matches the release.', $filename));
        }
        if ($declared === 'image/svg+xml') {
            $safe = self::validateSafeStaticSvgFile($source);
            if (is_wp_error($safe)) {
                return $safe;
            }
            $attachment = $this->importSafeSvg($asset, $source, $filename);
            if (is_wp_error($attachment)) {
                return $attachment;
            }
            $this->markAttachment((int) $attachment, $asset);
            return (int) $attachment;
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $checked = wp_check_filetype_and_ext($source, $filename);
        $mime = (string) ($checked['type'] ?? '');
        if ($mime === '' || !in_array($mime, get_allowed_mime_types(), true)) {
            return new \WP_Error('pagecraft_asset_mime', sprintf('WordPress does not allow the asset type for %s.', $filename));
        }
        if ($declared === '' || $declared !== strtolower($mime)) {
            return new \WP_Error('pagecraft_asset_mime_mismatch', sprintf('The MIME type for %s does not match its signed manifest.', $filename));
        }
        $temporary = wp_tempnam($filename);
        if (!$temporary || !copy($source, $temporary)) {
            return new \WP_Error('pagecraft_asset_copy', 'WordPress could not prepare a Pagecraft asset for the Media Library.');
        }
        $attachment = media_handle_sideload(
            ['name' => $filename, 'tmp_name' => $temporary],
            0,
            sanitize_text_field((string) ($asset['title'] ?? pathinfo($filename, PATHINFO_FILENAME))),
            ['post_content' => sanitize_textarea_field((string) ($asset['caption'] ?? ''))]
        );
        if (is_wp_error($attachment)) {
            if (is_file($temporary)) {
                wp_delete_file($temporary);
            }
            return $attachment;
        }
        $this->markAttachment((int) $attachment, $asset);
        return (int) $attachment;
    }

    /** @return string|\WP_Error */
    private function safeAssetFilename(string $original, string $mime, string $assetId): string|\WP_Error
    {
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/avif' => 'avif',
            'image/svg+xml' => 'svg',
        ];
        $extension = $extensions[$mime] ?? '';
        if ($extension === '') {
            return new \WP_Error('pagecraft_asset_mime', 'The signed Pagecraft asset MIME type is not supported.');
        }
        $safe = sanitize_file_name(basename($original));
        $stem = sanitize_file_name((string) pathinfo($safe, PATHINFO_FILENAME));
        if ($stem === '') {
            $stem = sanitize_file_name($assetId);
        }
        if ($stem === '') {
            return new \WP_Error('pagecraft_asset_filename', 'A Pagecraft asset has no safe filename.');
        }
        return $stem . '.' . $extension;
    }

    /**
     * Import compiler-approved static SVG bytes without asking WordPress to
     * transform them. Core intentionally excludes SVG from the default MIME
     * allowlist, so this narrow path is available only after a second local
     * validation of the exact signed bytes.
     *
     * @param array<string,mixed> $asset
     * @return int|\WP_Error
     */
    private function importSafeSvg(array $asset, string $source, string $filename): int|\WP_Error
    {
        $uploads = wp_upload_dir();
        if (!is_array($uploads) || !empty($uploads['error'])) {
            return new \WP_Error('pagecraft_svg_uploads', 'WordPress could not resolve a safe uploads directory for the Pagecraft SVG.');
        }
        $directory = (string) ($uploads['path'] ?? $uploads['basedir'] ?? '');
        if ($directory === '' || !wp_mkdir_p($directory)) {
            return new \WP_Error('pagecraft_svg_uploads', 'WordPress could not create the uploads directory for the Pagecraft SVG.');
        }
        $unique = wp_unique_filename($directory, $filename);
        if ($unique === '' || strtolower((string) pathinfo($unique, PATHINFO_EXTENSION)) !== 'svg') {
            return new \WP_Error('pagecraft_svg_filename', 'WordPress could not allocate a safe SVG filename.');
        }
        $destination = trailingslashit($directory) . $unique;
        if (!copy($source, $destination)) {
            return new \WP_Error('pagecraft_svg_copy', 'WordPress could not copy the exact signed SVG bytes into the Media Library.');
        }
        $sourceHash = hash_file('sha256', $source);
        $destinationHash = hash_file('sha256', $destination);
        if (!is_string($sourceHash)
            || !is_string($destinationHash)
            || !hash_equals($sourceHash, $destinationHash)
            || filesize($source) !== filesize($destination)) {
            wp_delete_file($destination);
            return new \WP_Error('pagecraft_svg_copy_mismatch', 'The imported SVG bytes changed while entering the Media Library.');
        }
        $attachment = wp_insert_attachment([
            'post_mime_type' => 'image/svg+xml',
            'post_title' => sanitize_text_field((string) ($asset['title'] ?? pathinfo($filename, PATHINFO_FILENAME))),
            'post_content' => sanitize_textarea_field((string) ($asset['caption'] ?? '')),
            'post_status' => 'pagecraft_staged',
        ], $destination, 0, true);
        if (is_wp_error($attachment)) {
            wp_delete_file($destination);
            return $attachment;
        }
        return (int) $attachment;
    }

    /** @param array<string,mixed> $asset */
    private function markAttachment(int $attachmentId, array $asset): void
    {
        global $wpdb;
        $wpdb->update($wpdb->posts, ['post_status' => 'pagecraft_staged'], ['ID' => $attachmentId], ['%s'], ['%d']);
        clean_post_cache($attachmentId);
        update_post_meta($attachmentId, '_wp_attachment_image_alt', sanitize_text_field((string) ($asset['alt'] ?? '')));
        update_post_meta($attachmentId, '_pagecraft_managed', '1');
        update_post_meta($attachmentId, '_pagecraft_asset_id', sanitize_text_field((string) ($asset['assetId'] ?? $asset['id'] ?? '')));
        update_post_meta($attachmentId, '_pagecraft_source_hash', sanitize_text_field((string) ($asset['hash'] ?? $asset['sha256'] ?? '')));
    }

    /** @return true|\WP_Error */
    public static function validateSafeStaticSvgFile(string $source): bool|\WP_Error
    {
        $bytes = file_get_contents($source);
        if (!is_string($bytes) || $bytes === '' || strlen($bytes) > 10 * MB_IN_BYTES || preg_match('//u', $bytes) !== 1) {
            return new \WP_Error('pagecraft_svg_encoding', 'A Pagecraft SVG must be non-empty UTF-8 under 10 MB.');
        }
        $trimmed = trim(str_starts_with($bytes, "\xEF\xBB\xBF") ? substr($bytes, 3) : $bytes);
        if ($trimmed === '' || preg_match('/<!DOCTYPE\b|<!ENTITY\b|<\?xml-stylesheet\b|<!\[CDATA\[/i', $trimmed)) {
            return new \WP_Error('pagecraft_svg_xml', 'Pagecraft SVG declarations, entities, stylesheets, and CDATA are not supported.');
        }
        $document = preg_replace('/<!--[\s\S]*?-->/', '', $trimmed);
        if (!is_string($document) || preg_match('/<!--|-->/', $document)) {
            return new \WP_Error('pagecraft_svg_comment', 'A Pagecraft SVG contains a malformed XML comment.');
        }
        $document = trim((string) preg_replace('/^<\?xml\b[^?]*\?>\s*/i', '', $document));
        if (!preg_match('/^<svg(?:\s|>)[\s\S]*<\/svg>$/i', $document)
            || preg_match('/<\?(?!xml\b)/i', $document)) {
            return new \WP_Error('pagecraft_svg_root', 'A Pagecraft SVG must contain one complete SVG root and no processing instructions.');
        }
        if (preg_match('/<\s*\/?\s*(?:[A-Za-z_][\w.-]*:)?(?:script|foreignObject|iframe|object|embed|audio|video|style|a|image|animate|animateMotion|animateTransform|set)\b/i', $document)) {
            return new \WP_Error('pagecraft_svg_active_element', 'Active or externally loaded SVG elements are not supported.');
        }
        preg_match_all('/<[^!?][^>]*>/', $document, $tags);
        foreach ((array) ($tags[0] ?? []) as $rawTag) {
            $tag = self::decodeSvgNumericReferences((string) $rawTag);
            if (is_wp_error($tag)) {
                return $tag;
            }
            if (preg_match('/\s(?:[A-Za-z_][\w.-]*:)?on[a-z0-9_.:-]*\s*=/i', $tag)) {
                return new \WP_Error('pagecraft_svg_event', 'SVG event-handler attributes are not supported.');
            }
            if (preg_match('/\sstyle\s*=\s*(?:["\'][\s\S]*?(?:@import|expression\s*\(|behavior\s*:|-moz-binding)[\s\S]*?["\']|[^\s>]*(?:@import|expression\s*\(|behavior\s*:|-moz-binding)[^\s>]*)/i', $tag)) {
                return new \WP_Error('pagecraft_svg_css', 'Executable SVG CSS is not supported.');
            }
            preg_match_all('/(?:^|\s)(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $tag, $hrefs, PREG_SET_ORDER);
            foreach ($hrefs as $href) {
                $value = trim((string) ($href[1] !== '' ? $href[1] : ($href[2] !== '' ? $href[2] : ($href[3] ?? ''))));
                if (!preg_match('/^#[A-Za-z_][\w:.-]*$/', $value)) {
                    return new \WP_Error('pagecraft_svg_href', 'Only local fragment SVG href references are supported.');
                }
            }
            preg_match_all('/(?:^|\s)(xmlns(?::xlink)?)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $tag, $namespaces, PREG_SET_ORDER);
            foreach ($namespaces as $namespace) {
                $value = (string) ($namespace[2] !== '' ? $namespace[2] : ($namespace[3] !== '' ? $namespace[3] : ($namespace[4] ?? '')));
                $expected = strtolower((string) $namespace[1]) === 'xmlns:xlink'
                    ? 'http://www.w3.org/1999/xlink'
                    : 'http://www.w3.org/2000/svg';
                if ($value !== $expected) {
                    return new \WP_Error('pagecraft_svg_namespace', 'A Pagecraft SVG contains an unexpected XML namespace.');
                }
            }
            preg_match_all('/url\(\s*(["\']?)([^)"\']+)\1\s*\)/i', $tag, $references, PREG_SET_ORDER);
            foreach ($references as $reference) {
                if (!preg_match('/^#[A-Za-z_][\w:.-]*$/', trim((string) ($reference[2] ?? '')))) {
                    return new \WP_Error('pagecraft_svg_url', 'Only local fragment SVG URL references are supported.');
                }
            }
            $withoutNamespaces = (string) preg_replace('/\sxmlns(?::xlink)?\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $tag);
            if (preg_match('/(?:javascript|vbscript|data|https?|file|ftp)\s*:/i', $withoutNamespaces)) {
                return new \WP_Error('pagecraft_svg_uri', 'External or executable SVG URI schemes are not supported.');
            }
        }
        if (!class_exists(\DOMDocument::class)) {
            return new \WP_Error('pagecraft_svg_validator_unavailable', 'Static SVG import requires the PHP DOM extension.');
        }
        $previous = libxml_use_internal_errors(true);
        $xml = new \DOMDocument();
        $loaded = $xml->loadXML($trimmed, LIBXML_NONET | LIBXML_NOBLANKS | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (!$loaded || !$xml->documentElement || strtolower($xml->documentElement->localName) !== 'svg') {
            return new \WP_Error('pagecraft_svg_xml', 'A Pagecraft SVG must be well-formed XML with one SVG root.');
        }
        return true;
    }

    /** @return string|\WP_Error */
    private static function decodeSvgNumericReferences(string $tag): string|\WP_Error
    {
        $invalid = false;
        $decoded = preg_replace_callback('/&#(?:x([0-9a-f]+)|([0-9]+));/i', static function (array $match) use (&$invalid): string {
            $digits = (string) (($match[1] ?? '') !== '' ? $match[1] : ($match[2] ?? ''));
            $base = ($match[1] ?? '') !== '' ? 16 : 10;
            if ($digits === '' || strlen($digits) > ($base === 16 ? 6 : 7)) {
                $invalid = true;
                return '';
            }
            $point = intval($digits, $base);
            if ($point < 0 || $point > 0x10ffff || ($point >= 0xd800 && $point <= 0xdfff)) {
                $invalid = true;
                return '';
            }
            if ($point <= 0x7f) {
                return chr($point);
            }
            if ($point <= 0x7ff) {
                return chr(0xc0 | ($point >> 6)) . chr(0x80 | ($point & 0x3f));
            }
            if ($point <= 0xffff) {
                return chr(0xe0 | ($point >> 12)) . chr(0x80 | (($point >> 6) & 0x3f)) . chr(0x80 | ($point & 0x3f));
            }
            return chr(0xf0 | ($point >> 18)) . chr(0x80 | (($point >> 12) & 0x3f)) . chr(0x80 | (($point >> 6) & 0x3f)) . chr(0x80 | ($point & 0x3f));
        }, $tag);
        if ($invalid || !is_string($decoded)) {
            return new \WP_Error('pagecraft_svg_reference', 'A Pagecraft SVG contains an invalid numeric character reference.');
        }
        return $decoded;
    }

    /** @param array<string,mixed> $page @param array<string,string> $files @param array<string,string> $assetUrls @return array<string,mixed>|\WP_Error */
    private function hydratePage(array $page, array $files, array $assetUrls): array|\WP_Error
    {
        $pageId = (string) ($page['pageId'] ?? $page['id'] ?? '');
        $route = Support::normalizeRoute((string) ($page['route'] ?? $page['path'] ?? '/'));
        if (!Support::validIdentifier($pageId) || strlen($route) > 191) {
            return new \WP_Error('pagecraft_page_identity', 'A release page has an invalid identity or route.');
        }
        $head = (string) ($page['headHtml'] ?? '');
        $profile = (string) ($page['_profile'] ?? '');
        $shared = is_array($page['_shared'] ?? null) ? $page['_shared'] : [];
        if (($page['bodyKind'] ?? '') !== 'content-fragment') {
            return new \WP_Error('pagecraft_content_fragment_missing', 'The route is not a signed content fragment.');
        }
        if (($page['headOrder'] ?? '') !== 'css-before-runtime') {
            return new \WP_Error('pagecraft_head_order', 'The route does not declare the supported CSS-before-runtime head order.');
        }
        $fragment = (string) ($page['bodyHtml'] ?? '');
        $body = $profile === 'pagecraft-theme'
            ? (string) ($shared['headerHtml'] ?? '') . $fragment . (string) ($shared['footerHtml'] ?? '')
            : $fragment;
        foreach (['headFile' => 'head', 'bodyFile' => 'body'] as $key => $target) {
            $file = (string) ($page[$key] ?? '');
            if ($file !== '' && isset($files[$file])) {
                ${$target} = (string) file_get_contents($files[$file]);
            }
        }
        $htmlFile = (string) ($page['htmlFile'] ?? $page['file'] ?? '');
        if (($body === '' || $head === '') && $htmlFile !== '' && isset($files[$htmlFile])) {
            $html = (string) file_get_contents($files[$htmlFile]);
            if ($head === '' && preg_match('#<head[^>]*>([\s\S]*?)</head>#i', $html, $match)) {
                $head = $match[1];
            }
            if ($body === '' && preg_match('#<body[^>]*>([\s\S]*?)</body>#i', $html, $match)) {
                $body = $match[1];
            }
            $body = $body !== '' ? $body : $html;
        }
        if ($body === '') {
            return new \WP_Error('pagecraft_page_body', sprintf('Pagecraft page %s has no renderable body.', $pageId));
        }
        $releaseMarker = Support::releaseMarker(
            (string) ($page['_deploymentId'] ?? ''),
            (string) ($page['_artifactHash'] ?? '')
        );
        if ($releaseMarker === '') {
            return new \WP_Error('pagecraft_release_marker_invalid', 'The route cannot be bound to an exact Pagecraft deployment marker.');
        }
        $body = $profile === 'existing-theme'
            ? Support::existingThemeBody($body, $releaseMarker)
            : '<div class="pagecraft-root" data-pagecraft-release-root="' . esc_attr($releaseMarker) . '">' . $body . '</div>';
        $css = implode("\n", array_filter([(string) ($shared['css'] ?? ''), (string) ($page['css'] ?? '')], static fn (string $value): bool => $value !== ''));
        foreach ($assetUrls as $assetId => $url) {
            $quoted = preg_quote($assetId, '#');
            $pattern = '#(?:pc-asset://' . $quoted . '|\{\{pagecraft-asset:' . $quoted . '\}\})#';
            $body = (string) preg_replace($pattern, addcslashes($url, '\\$'), $body);
            $head = (string) preg_replace($pattern, addcslashes($url, '\\$'), $head);
            $css = (string) preg_replace($pattern, addcslashes($url, '\\$'), $css);
        }
        $seo = is_array($page['seo'] ?? null) ? $this->hydrateAssetValue($page['seo'], $assetUrls) : [];
        $declarations = is_array($page['scripts'] ?? null) ? $page['scripts'] : [];
        if ($css !== '') {
            // The v1 compiler permits a consolidated CSS stream only when all
            // executable head occurrences follow it. Prepending this signed
            // style block preserves that explicit contract during marker
            // substitution in both WordPress rendering profiles.
            $style = '<style data-pagecraft-route>' . str_replace('</style', '<\\/style', $css) . '</style>';
            $head = $style . ($head !== '' ? "\n" . $head : '');
        }
        $scripts = $this->normalizeRuntimeScripts((string) ($page['runtime'] ?? ''), $declarations, $assetUrls, 'route');
        if (is_wp_error($scripts)) {
            return $scripts;
        }
        $sharedScripts = $this->normalizeRuntimeScripts(
            (string) ($shared['runtime'] ?? ''),
            is_array($shared['scripts'] ?? null) ? $shared['scripts'] : [],
            $assetUrls,
            'shared'
        );
        if (is_wp_error($sharedScripts)) {
            return $sharedScripts;
        }
        $scripts = ScriptOccurrences::compose($scripts, $sharedScripts, $profile);
        if (is_wp_error($scripts)) {
            return $scripts;
        }
        $signedHash = strtolower((string) ($page['sourceHash'] ?? hash('sha256', Support::json($page))));
        $sourceHash = hash('sha256', $signedHash . "\0" . $route . "\0" . $profile . "\0" . $head . "\0" . $body);
        return [
            'route_path' => $route,
            'page_id' => $pageId,
            'title' => sanitize_text_field((string) ($page['title'] ?? $page['name'] ?? 'Untitled')),
            'description' => sanitize_textarea_field((string) ($page['description'] ?? $page['desc'] ?? '')),
            'head_html' => $head,
            'body_html' => $body,
            'content_hash' => hash('sha256', $head . "\0" . $body),
            'source_hash' => $sourceHash,
            'status' => ($page['status'] ?? 'publish') === 'draft' ? 'draft' : 'publish',
            'seo' => $seo,
            'scripts' => $scripts,
        ];
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $page @return int|\WP_Error */
    private function mapPage(array $manifest, array $page): int|\WP_Error
    {
        $sourceId = (string) $page['page_id'];
        $deploymentId = (string) $manifest['deploymentId'];
        $sourceHash = (string) $page['source_hash'];
        $candidate = $this->deploymentMapping('page', $sourceId, $deploymentId);
        $active = $this->activeMapping('page', $sourceId);
        if ($candidate && hash_equals((string) $candidate['object_hash'], $sourceHash) && get_post((int) $candidate['object_id'])) {
            return (int) $candidate['object_id'];
        }
        if ($active && hash_equals((string) $active['object_hash'], $sourceHash) && get_post((int) $active['object_id'])) {
            $saved = $this->saveMapping($manifest, 'page', $sourceId, (int) $active['object_id'], $sourceHash, (string) $page['status']);
            return is_wp_error($saved) ? $saved : (int) $active['object_id'];
        }
        $path = trim((string) $page['route_path'], '/');
        $collision = $path !== '' ? get_page_by_path($path, OBJECT, 'page') : null;
        $replacePostId = (int) ($page['_replace_post_id'] ?? 0);
        if ($collision instanceof \WP_Post && get_post_meta($collision->ID, '_pagecraft_managed', true) !== '1' && $collision->ID !== $replacePostId) {
            return new \WP_Error('pagecraft_route_collision', sprintf('The Pagecraft route %s conflicts with an unmanaged WordPress page.', $page['route_path']));
        }
        if ($replacePostId > 0) {
            $replaced = get_post($replacePostId);
            if (!$replaced instanceof \WP_Post || get_post_meta($replacePostId, '_pagecraft_managed', true) === '1') {
                return new \WP_Error('pagecraft_route_collision_changed', 'The WordPress page selected for replacement changed before staging.');
            }
            $snapshotHash = hash('sha256', Support::json(['id' => $replacePostId, 'status' => $replaced->post_status, 'name' => $replaced->post_name]));
            $saved = $this->saveMapping($manifest, 'collision', hash('sha256', (string) $page['route_path']), $replacePostId, $snapshotHash, $replaced->post_status);
            if (is_wp_error($saved)) {
                return $saved;
            }
        }
        $slug = $path === '' ? 'pagecraft-home' : sanitize_title((string) basename($path));
        $postId = wp_insert_post([
            'post_type' => 'page',
            'post_title' => (string) $page['title'],
            'post_name' => $slug,
            'post_excerpt' => (string) $page['description'],
            'post_content' => "<!-- wp:html -->\n" . wp_kses_post((string) $page['body_html']) . "\n<!-- /wp:html -->",
            'post_status' => 'pagecraft_staged',
            'comment_status' => 'closed',
            'ping_status' => 'closed',
        ], true);
        if (is_wp_error($postId)) {
            return $postId;
        }
        global $wpdb;
        $wpdb->update($wpdb->posts, ['post_name' => $slug], ['ID' => (int) $postId], ['%s'], ['%d']);
        clean_post_cache((int) $postId);
        update_post_meta($postId, '_pagecraft_managed', '1');
        update_post_meta($postId, '_pagecraft_page_id', $sourceId);
        update_post_meta($postId, '_pagecraft_release_id', (string) $manifest['releaseId']);
        update_post_meta($postId, '_pagecraft_deployment_id', $deploymentId);
        update_post_meta($postId, '_pagecraft_source_hash', $sourceHash);
        update_post_meta($postId, '_pagecraft_route', (string) $page['route_path']);
        $saved = $this->saveMapping($manifest, 'page', $sourceId, (int) $postId, $sourceHash, (string) $page['status']);
        return is_wp_error($saved) ? $saved : (int) $postId;
    }

    /** @param list<mixed> $declarations @param array<string,string> $assetUrls @return list<array<string,mixed>>|\WP_Error */
    private function normalizeRuntimeScripts(string $runtime, array $declarations, array $assetUrls = [], string $scope = 'route'): array|\WP_Error
    {
        $ordered = ScriptOccurrences::parse($runtime, $declarations, $scope);
        if (is_wp_error($ordered)) {
            return $ordered;
        }
        $scripts = [];
        foreach ($ordered as $declaration) {
            $html = (string) $declaration['template_html'];
            $localized = (string) $this->hydrateAssetValue($html, $assetUrls);
            $scripts[] = $declaration + [
                'html' => $localized,
            ];
        }
        return $scripts;
    }

    /** @param array<string,string> $assetUrls */
    private function hydrateAssetValue(mixed $value, array $assetUrls): mixed
    {
        if (is_array($value)) {
            foreach ($value as $key => $child) {
                $value[$key] = $this->hydrateAssetValue($child, $assetUrls);
            }
            return $value;
        }
        if (!is_string($value)) {
            return $value;
        }
        foreach ($assetUrls as $assetId => $url) {
            $quoted = preg_quote($assetId, '#');
            $value = (string) preg_replace('#(?:pc-asset://' . $quoted . '|\{\{pagecraft-asset:' . $quoted . '\}\})#', addcslashes($url, '\\$'), $value);
        }
        return $value;
    }

    /** @param array<string,mixed> $manifest @param list<array<string,mixed>> $routes @param array<string,int> $postByPage @param array<string,string> $pageByRoute @return true|\WP_Error */
    private function mapPageParents(array $manifest, array &$routes, array $postByPage, array $pageByRoute): bool|\WP_Error
    {
        foreach ($routes as $route) {
            $path = trim((string) $route['route_path'], '/');
            if ($path === '' || !str_contains($path, '/')) {
                continue;
            }
            $parentPath = '/' . dirname($path) . '/';
            $parentPage = $pageByRoute[$parentPath] ?? '';
            $parentId = $parentPage !== '' ? ($postByPage[$parentPage] ?? 0) : 0;
            $postId = (int) $route['post_id'];
            $mapping = $this->deploymentMapping('page', (string) $route['page_id'], (string) $manifest['deploymentId']);
            if ($parentId > 0 && $postId > 0 && $mapping && get_post_status($postId) === 'pagecraft_staged') {
                $updated = wp_update_post(['ID' => $postId, 'post_parent' => $parentId], true);
                if (is_wp_error($updated)) {
                    return $updated;
                }
            }
        }
        return true;
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    private function mapCms(array $manifest): bool|\WP_Error
    {
        $cms = is_array($manifest['cms'] ?? null) ? $manifest['cms'] : [];
        $collections = $cms['collections'] ?? [];
        if (!is_array($collections)) {
            return new \WP_Error('pagecraft_cms_invalid', 'The release CMS map is invalid.');
        }
        $schemas = $this->normalizeCollectionSchemas($collections);
        if (is_wp_error($schemas)) {
            return $schemas;
        }
        foreach ($collections as $collection) {
            if (!is_array($collection)) {
                return new \WP_Error('pagecraft_collection_invalid', 'A Pagecraft collection is invalid.');
            }
            $collectionId = (string) ($collection['collectionId'] ?? $collection['id'] ?? '');
            if (!Support::validIdentifier($collectionId)) {
                return new \WP_Error('pagecraft_collection_id', 'A Pagecraft collection ID is invalid.');
            }
            $schema = $schemas[$collectionId] ?? null;
            if (!is_array($schema)) {
                return new \WP_Error('pagecraft_collection_schema', 'A Pagecraft collection has no valid signed field schema.');
            }
            $term = $this->collectionTerm($collectionId, (string) ($collection['name'] ?? 'Collection'), (string) ($collection['slug'] ?? ''));
            if (is_wp_error($term)) {
                return $term;
            }
            foreach ((array) ($collection['items'] ?? []) as $item) {
                if (!is_array($item)) {
                    return new \WP_Error('pagecraft_item_invalid', 'A Pagecraft CMS item is invalid.');
                }
                $mapped = $this->mapCmsItem($manifest, $collectionId, (int) $term, $item, $schema);
                if (is_wp_error($mapped)) {
                    return $mapped;
                }
            }
        }
        return true;
    }

    /**
     * @param list<mixed> $collections
     * @return array<string,array<string,mixed>>|\WP_Error
     */
    private function normalizeCollectionSchemas(array $collections): array|\WP_Error
    {
        if (count($collections) > 100) {
            return new \WP_Error('pagecraft_collection_schema_count', 'A release contains too many CMS collections.');
        }
        $schemas = [];
        $rawById = [];
        $types = ['text', 'rich', 'image', 'link', 'number', 'date', 'option', 'bool', 'ref'];
        foreach ($collections as $collection) {
            if (!is_array($collection)) {
                return new \WP_Error('pagecraft_collection_schema', 'A Pagecraft collection schema is invalid.');
            }
            $collectionId = (string) ($collection['collectionId'] ?? $collection['id'] ?? '');
            $rawFields = $collection['fields'] ?? null;
            if (!Support::validIdentifier($collectionId)
                || isset($schemas[$collectionId])
                || !is_array($rawFields)
                || $rawFields === []
                || count($rawFields) > 100) {
                return new \WP_Error('pagecraft_collection_schema', 'A Pagecraft collection has an invalid or duplicate signed field schema.');
            }
            $fields = [];
            $seen = [];
            foreach ($rawFields as $rawField) {
                if (!is_array($rawField)) {
                    return new \WP_Error('pagecraft_collection_field', 'A signed Pagecraft CMS field is invalid.');
                }
                $fieldId = (string) ($rawField['fieldId'] ?? $rawField['id'] ?? '');
                $type = (string) ($rawField['type'] ?? '');
                $name = sanitize_text_field((string) ($rawField['name'] ?? $fieldId));
                if (!Support::validIdentifier($fieldId, 64)
                    || isset($seen[$fieldId])
                    || !in_array($type, $types, true)
                    || $name === '') {
                    return new \WP_Error('pagecraft_collection_field', 'A signed Pagecraft CMS field has an invalid ID, type, name, or duplicate.');
                }
                $choices = [];
                if ($type === 'option') {
                    $rawChoices = $rawField['options'] ?? $rawField['opts'] ?? [];
                    if (is_string($rawChoices)) {
                        $rawChoices = preg_split('/\s*,\s*/', trim($rawChoices), -1, PREG_SPLIT_NO_EMPTY) ?: [];
                    }
                    if (!is_array($rawChoices) || count($rawChoices) > 100) {
                        return new \WP_Error('pagecraft_collection_field_options', 'A signed Pagecraft option field has invalid choices.');
                    }
                    foreach ($rawChoices as $choice) {
                        $value = is_array($choice) ? (string) ($choice['value'] ?? '') : (string) $choice;
                        $label = is_array($choice) ? (string) ($choice['label'] ?? $value) : $value;
                        if ($value === '' || strlen($value) > 500 || strlen($label) > 500 || isset($choices[$value])) {
                            return new \WP_Error('pagecraft_collection_field_options', 'A signed Pagecraft option field has invalid or duplicate choices.');
                        }
                        $choices[$value] = sanitize_text_field($label);
                    }
                }
                $reference = $type === 'ref' ? (string) ($rawField['ref'] ?? '') : '';
                if ($type === 'ref' && !Support::validIdentifier($reference)) {
                    return new \WP_Error('pagecraft_collection_field_reference', 'A signed Pagecraft reference field has no valid target collection.');
                }
                $fields[] = [
                    'id' => $fieldId,
                    'name' => $name,
                    'type' => $type,
                    'required' => ($rawField['required'] ?? false) === true || (int) ($rawField['required'] ?? 0) === 1,
                    'choices' => $choices,
                    'ref' => $reference,
                ];
                $seen[$fieldId] = true;
            }
            $schemas[$collectionId] = [
                'format' => 'pagecraft.collection-schema.v1',
                'collectionId' => $collectionId,
                'name' => sanitize_text_field((string) ($collection['name'] ?? $collectionId)),
                'fields' => $fields,
            ];
            $rawById[$collectionId] = $collection;
        }

        foreach ($schemas as &$schema) {
            foreach ($schema['fields'] as &$field) {
                if ($field['type'] !== 'ref') {
                    continue;
                }
                $target = $rawById[$field['ref']] ?? null;
                if (!is_array($target)) {
                    return new \WP_Error('pagecraft_collection_field_reference', 'A signed Pagecraft reference field points to an unknown collection.');
                }
                $choices = [];
                foreach ((array) ($target['items'] ?? []) as $item) {
                    if (!is_array($item)) {
                        return new \WP_Error('pagecraft_collection_reference_item', 'A referenced Pagecraft CMS item is invalid.');
                    }
                    $itemId = (string) ($item['itemId'] ?? $item['id'] ?? '');
                    if (!Support::validIdentifier($itemId) || isset($choices[$itemId])) {
                        return new \WP_Error('pagecraft_collection_reference_item', 'A referenced Pagecraft CMS item has an invalid or duplicate ID.');
                    }
                    $values = is_array($item['values'] ?? null) ? $item['values'] : [];
                    $label = (string) ($values['title'] ?? $values['name'] ?? $item['slug'] ?? $itemId);
                    $choices[$itemId] = sanitize_text_field($label !== '' ? $label : $itemId);
                }
                $field['choices'] = $choices;
            }
            unset($field);
        }
        unset($schema);
        return $schemas;
    }

    /** @return int|\WP_Error */
    private function collectionTerm(string $sourceId, string $name, string $slug): int|\WP_Error
    {
        $existing = get_terms(['taxonomy' => 'pagecraft_collection', 'hide_empty' => false, 'meta_key' => '_pagecraft_collection_id', 'meta_value' => $sourceId, 'number' => 1, 'fields' => 'ids']);
        if (is_wp_error($existing)) {
            return $existing;
        }
        if (is_array($existing) && $existing !== []) {
            return (int) $existing[0];
        }
        $created = wp_insert_term(sanitize_text_field($name), 'pagecraft_collection', ['slug' => sanitize_title($slug ?: $name)]);
        if (is_wp_error($created)) {
            return $created;
        }
        $termId = (int) $created['term_id'];
        update_term_meta($termId, '_pagecraft_collection_id', $sourceId);
        return $termId;
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $item @return int|\WP_Error */
    private function mapCmsItem(array $manifest, string $collectionId, int $termId, array $item, array $schema): int|\WP_Error
    {
        $sourceId = (string) ($item['itemId'] ?? $item['id'] ?? '');
        if (!Support::validIdentifier($sourceId)) {
            return new \WP_Error('pagecraft_item_id', 'A Pagecraft CMS item ID is invalid.');
        }
        $assetIds = [];
        foreach ((array) ($manifest['assets'] ?? []) as $asset) {
            if (is_array($asset)) {
                $assetId = (string) ($asset['assetId'] ?? $asset['id'] ?? '');
                if (Support::validIdentifier($assetId)) {
                    $assetIds[$assetId] = true;
                }
            }
        }
        $values = $this->validateCmsValues($item['values'] ?? null, $schema, $assetIds);
        if (is_wp_error($values)) {
            return $values;
        }
        // Collection schema is part of the immutable candidate identity. A
        // schema-only release therefore creates a versioned candidate instead
        // of mutating metadata on the active native object during staging.
        $sourceHash = hash('sha256', CanonicalJson::encode(json_decode(Support::json(['item' => $item, 'schema' => $schema]))));
        $status = !empty($item['draft']) ? 'draft' : 'publish';
        $candidate = $this->deploymentMapping('cms', $sourceId, (string) $manifest['deploymentId']);
        $active = $this->activeMapping('cms', $sourceId);
        if ($candidate && hash_equals((string) $candidate['object_hash'], $sourceHash) && get_post((int) $candidate['object_id'])) {
            return (int) $candidate['object_id'];
        }
        if ($active && hash_equals((string) $active['object_hash'], $sourceHash) && get_post((int) $active['object_id'])) {
            $saved = $this->saveMapping($manifest, 'cms', $sourceId, (int) $active['object_id'], $sourceHash, $status);
            return is_wp_error($saved) ? $saved : (int) $active['object_id'];
        }
        $title = (string) ($item['title'] ?? $values['title'] ?? $values['name'] ?? 'Untitled');
        $postId = wp_insert_post([
            'post_type' => 'pagecraft_entry',
            'post_title' => sanitize_text_field($title),
            'post_name' => sanitize_title((string) ($item['slug'] ?? $title)),
            'post_excerpt' => sanitize_textarea_field((string) ($item['excerpt'] ?? '')),
            'post_content' => isset($values['body']) ? wp_kses_post((string) $values['body']) : '',
            'post_status' => 'pagecraft_staged',
        ], true);
        if (is_wp_error($postId)) {
            return $postId;
        }
        wp_set_object_terms((int) $postId, [$termId], 'pagecraft_collection', false);
        update_post_meta($postId, 'pagecraft_fields', $values);
        update_post_meta($postId, '_pagecraft_collection_schema', $schema);
        update_post_meta($postId, '_pagecraft_managed', '1');
        update_post_meta($postId, '_pagecraft_item_id', $sourceId);
        update_post_meta($postId, '_pagecraft_collection_id', $collectionId);
        update_post_meta($postId, '_pagecraft_is_draft', !empty($item['draft']) ? '1' : '0');
        update_post_meta($postId, '_pagecraft_release_id', (string) $manifest['releaseId']);
        update_post_meta($postId, '_pagecraft_deployment_id', (string) $manifest['deploymentId']);
        update_post_meta($postId, '_pagecraft_source_hash', $sourceHash);
        $saved = $this->saveMapping($manifest, 'cms', $sourceId, (int) $postId, $sourceHash, $status);
        return is_wp_error($saved) ? $saved : (int) $postId;
    }

    /** @param array<string,mixed> $schema @return array<string,string>|\WP_Error */
    private function validateCmsValues(mixed $rawValues, array $schema, array $assetIds = []): array|\WP_Error
    {
        if (!is_array($rawValues) || !is_array($schema['fields'] ?? null)) {
            return new \WP_Error('pagecraft_cms_values', 'A Pagecraft CMS item has no valid signed values map.');
        }
        $fields = [];
        foreach ($schema['fields'] as $field) {
            if (is_array($field) && isset($field['id'])) {
                $fields[(string) $field['id']] = $field;
            }
        }
        foreach ($rawValues as $fieldId => $value) {
            if (!is_string($fieldId) || !isset($fields[$fieldId]) || !is_scalar($value)) {
                return new \WP_Error('pagecraft_cms_values', 'A Pagecraft CMS item contains an unknown or non-scalar field value.');
            }
        }
        $values = [];
        foreach ($fields as $fieldId => $field) {
            $value = array_key_exists($fieldId, $rawValues) ? (string) $rawValues[$fieldId] : '';
            if ($value !== '') {
                $type = (string) $field['type'];
                $choices = is_array($field['choices'] ?? null) ? $field['choices'] : [];
                $valid = match ($type) {
                    'number' => is_numeric($value),
                    'date' => (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value),
                    'bool' => in_array(strtolower($value), ['0', '1', 'true', 'false', 'yes', 'no'], true),
                    'option', 'ref' => array_key_exists($value, $choices),
                    'image' => (bool) preg_match('/^asset:([A-Za-z0-9._:-]+)(?:@\d+)?$/', $value, $imageMatch)
                        && isset($assetIds[(string) ($imageMatch[1] ?? '')]),
                    default => true,
                };
                if (!$valid) {
                    return new \WP_Error('pagecraft_cms_value_type', sprintf('Pagecraft CMS field %s has a value that does not match its signed type.', $fieldId));
                }
            }
            $values[$fieldId] = $value;
        }
        return $values;
    }

    /** @return array<string,mixed>|null */
    private function deploymentMapping(string $type, string $sourceId, string $deploymentId): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}pagecraft_objects WHERE deployment_id = %s AND source_type = %s AND source_id = %s LIMIT 1", $deploymentId, $type, $sourceId), ARRAY_A);
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    private function activeMapping(string $type, string $sourceId): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}pagecraft_objects WHERE source_type = %s AND source_id = %s AND state = 'active' ORDER BY id DESC LIMIT 1", $type, $sourceId), ARRAY_A);
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed> */
    private function decision(string $route): array
    {
        $scope = $this->currentDecisionScope();
        $stored = get_option(self::DECISIONS_OPTION, []);
        if ($scope === null
            || !is_array($stored)
            || !$this->decisionScopeMatches($stored['scope'] ?? null, $scope)
            || !is_array($stored['routes'] ?? null)) {
            return [];
        }
        return is_array($stored['routes'][$route] ?? null) ? $stored['routes'][$route] : [];
    }

    /** @return array{site_id:string,installation_id:string,profile:string,environment:string}|null */
    private function currentDecisionScope(): ?array
    {
        $connection = get_option('pagecraft_connection', []);
        $installationId = (string) get_option('pagecraft_installation_id', '');
        if (!is_array($connection)
            || !Support::validIdentifier($connection['site_id'] ?? null)
            || !Support::validIdentifier($installationId, 160)
            || !in_array((string) ($connection['profile'] ?? ''), ['existing-theme', 'pagecraft-theme'], true)
            || !in_array((string) ($connection['environment'] ?? ''), ['staging', 'production'], true)) {
            return null;
        }
        return [
            'site_id' => (string) $connection['site_id'],
            'installation_id' => $installationId,
            'profile' => (string) $connection['profile'],
            'environment' => (string) $connection['environment'],
        ];
    }

    /** @param mixed $stored @param array<string,string> $current */
    private function decisionScopeMatches(mixed $stored, array $current): bool
    {
        if (!is_array($stored)) {
            return false;
        }
        foreach (['site_id', 'installation_id', 'profile', 'environment'] as $field) {
            if (!is_string($stored[$field] ?? null) || !hash_equals($current[$field], (string) $stored[$field])) {
                return false;
            }
        }
        return true;
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    private function saveMapping(array $manifest, string $type, string $sourceId, int $objectId, string $hash, string $targetStatus): bool|\WP_Error
    {
        global $wpdb;
        $deploymentId = (string) $manifest['deploymentId'];
        $table = $wpdb->prefix . 'pagecraft_objects';
        $existing = $this->deploymentMapping($type, $sourceId, $deploymentId);
        $data = [
            'deployment_id' => $deploymentId,
            'release_id' => (string) $manifest['releaseId'],
            'source_type' => $type,
            'source_id' => $sourceId,
            'object_id' => $objectId,
            'object_hash' => $hash,
            'target_status' => $targetStatus,
            'state' => 'staged',
            'updated_at' => Support::utcNow(),
        ];
        $ok = $existing
            ? $wpdb->update($table, $data, ['id' => (int) $existing['id']], ['%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s'], ['%d'])
            : $wpdb->insert($table, $data, ['%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s']);
        return $ok === false ? new \WP_Error('pagecraft_mapping_store', 'WordPress could not stage a versioned Pagecraft object mapping.') : true;
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    private function checkpoint(string $step, array $manifest): bool|\WP_Error
    {
        do_action('pagecraft_connector_mapper_step', $step, (string) $manifest['deploymentId']);
        $failure = apply_filters('pagecraft_connector_mapper_failure', false, $step, $manifest);
        if (is_wp_error($failure)) {
            return $failure;
        }
        return $failure === true ? new \WP_Error('pagecraft_mapper_injected_failure', sprintf('Mapper failure injected after %s.', $step)) : true;
    }

    /** @param array<string,mixed> $manifest */
    private function fileHashFromManifest(array $manifest, string $path): string
    {
        foreach ((array) ($manifest['files'] ?? []) as $file) {
            if (is_array($file) && (string) ($file['path'] ?? '') === $path) {
                return (string) ($file['sha256'] ?? '');
            }
        }
        return '';
    }
}
