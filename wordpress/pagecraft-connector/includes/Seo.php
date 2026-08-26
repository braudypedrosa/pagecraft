<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Seo
{
    /** @var array<string,mixed>|null */
    private ?array $bufferedSeo = null;

    public function __construct(
        private readonly ReleaseRepository $releases,
        private readonly Connection $connection
    )
    {
    }

    public function hooks(): void
    {
        add_filter('pagecraft_connector_preflight', [$this, 'preflight'], 10, 3);
        add_action('template_redirect', [$this, 'beginManagedHeadOwnership'], 1);
        add_action('wp_head', [$this, 'fallbackHead'], 1);
        add_action('wp', [$this, 'claimCoreOwnership']);
        add_filter('wpseo_title', fn (mixed $value): string => $this->value('title', $value));
        add_filter('wpseo_metadesc', fn (mixed $value): string => $this->value('description', $value));
        add_filter('wpseo_canonical', fn (mixed $value): string => $this->value('canonical', $value));
        add_filter('wpseo_robots', [$this, 'robotsValue']);
        add_filter('wpseo_opengraph_title', fn (mixed $value): string => $this->value('og.title', $value));
        add_filter('wpseo_opengraph_desc', fn (mixed $value): string => $this->value('og.description', $value));
        add_filter('wpseo_opengraph_image', fn (mixed $value): string => $this->value('og.image', $value));
        add_filter('wpseo_opengraph_url', fn (mixed $value): string => $this->value('canonical', $value));
        add_filter('wpseo_schema_graph', [$this, 'schemaGraph'], 20);
        add_filter('rank_math/frontend/title', fn (mixed $value): string => $this->value('title', $value));
        add_filter('rank_math/frontend/description', fn (mixed $value): string => $this->value('description', $value));
        add_filter('rank_math/frontend/canonical', fn (mixed $value): string => $this->value('canonical', $value));
        add_filter('rank_math/frontend/robots', [$this, 'rankMathRobots']);
        add_filter('rank_math/opengraph/facebook/title', fn (mixed $value): string => $this->value('og.title', $value));
        add_filter('rank_math/opengraph/facebook/description', fn (mixed $value): string => $this->value('og.description', $value));
        add_filter('rank_math/opengraph/facebook/image', fn (mixed $value): string => $this->value('og.image', $value));
        add_filter('rank_math/opengraph/facebook/url', fn (mixed $value): string => $this->value('canonical', $value));
        add_filter('rank_math/json_ld', [$this, 'schemaGraph'], 20);
        add_filter('wp_robots', [$this, 'coreRobots'], 20);
        add_filter('pre_get_document_title', fn (mixed $value): string => $this->adapter() === 'fallback' ? $this->value('title', $value) : (is_scalar($value) ? (string) $value : ''), 20);
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $artifact */
    public function preflight(mixed $result, array $manifest, array $artifact): mixed
    {
        return $this->adapter() === 'conflict'
            ? new \WP_Error('pagecraft_seo_conflict', 'Yoast SEO and Rank Math are both active. Deactivate one before activating this Pagecraft release.')
            : $result;
    }

    public function adapter(): string
    {
        $yoast = defined('WPSEO_VERSION') || class_exists('WPSEO_Options');
        $rankMath = defined('RANK_MATH_VERSION') || class_exists('RankMath');
        if ($yoast && $rankMath) {
            return 'conflict';
        }
        if ($yoast) {
            return 'yoast';
        }
        return $rankMath ? 'rank-math' : 'fallback';
    }

    /** @return array{adapter:string,ok:bool,error_code:?string} */
    public function status(): array
    {
        $adapter = $this->adapter();
        return ['adapter' => $adapter, 'ok' => $adapter !== 'conflict', 'error_code' => $adapter === 'conflict' ? 'pagecraft_seo_conflict' : null];
    }

    public function fallbackHead(): void
    {
        if ($this->adapter() !== 'fallback' || !($seo = $this->currentSeo())) {
            return;
        }
        $tags = [];
        $this->meta($tags, 'name', 'description', $this->read($seo, 'description'));
        $canonical = $this->read($seo, 'canonical');
        if ($canonical !== '') {
            $tags[] = '<link rel="canonical" href="' . esc_url($canonical) . '">';
        }
        foreach ([
            ['property', 'og:title', 'og.title'], ['property', 'og:description', 'og.description'],
            ['property', 'og:image', 'og.image'], ['property', 'og:image:secure_url', 'og.image_secure_url'],
            ['property', 'og:type', 'og.type'], ['property', 'og:url', 'og.url'],
            ['name', 'twitter:card', 'twitter.card'], ['name', 'twitter:title', 'twitter.title'],
            ['name', 'twitter:description', 'twitter.description'], ['name', 'twitter:image', 'twitter.image'],
        ] as [$attribute, $name, $path]) {
            $this->meta($tags, $attribute, $name, $this->read($seo, $path));
        }
        echo "\n" . implode("\n", $tags) . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        $schema = $this->schemaData($seo);
        if ($schema !== null) {
            echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }
    }

    /**
     * Yoast and Rank Math may emit only a subset of tags until configured.
     * Buffer only a managed frontend document, remove all competing owned tags
     * from its head, then insert one complete connector-owned signed set.
     */
    public function beginManagedHeadOwnership(): void
    {
        if (is_admin() || wp_doing_ajax() || is_feed() || is_trackback() || ($this->bufferedSeo = $this->currentSeo()) === null) {
            return;
        }
        ob_start([$this, 'normalizeManagedDocumentHead']);
    }

    public function normalizeManagedDocumentHead(string $document): string
    {
        $seo = $this->bufferedSeo;
        $this->bufferedSeo = null;
        $bounds = $this->headBounds($document);
        if (!$seo || $bounds === null) {
            return $document;
        }
        $head = substr($document, $bounds['open_end'], $bounds['close_start'] - $bounds['open_end']);
        $head = $this->stripOwnedTags($head);
        return substr($document, 0, $bounds['open_end'])
            . $head . "\n" . $this->ownedHeadHtml($seo) . "\n"
            . substr($document, $bounds['close_start']);
    }

    /**
     * Locate the explicit document head using raw-text and quote-aware token
     * boundaries. A literal </head> inside JSON, script/style text, comments,
     * or a quoted attribute is data, never the document boundary.
     *
     * @return array{open_end:int,close_start:int}|null
     */
    private function headBounds(string $document): ?array
    {
        $length = strlen($document);
        $position = 0;
        $openEnd = null;
        while ($position < $length) {
            $start = strpos($document, '<', $position);
            if ($start === false) {
                return null;
            }
            if (substr($document, $start, 4) === '<!--') {
                $commentEnd = strpos($document, '-->', $start + 4);
                if ($commentEnd === false) {
                    return null;
                }
                $position = $commentEnd + 3;
                continue;
            }
            $end = $this->htmlTagEnd($document, $start);
            if ($end === null) {
                return null;
            }
            $tag = substr($document, $start, $end - $start + 1);
            if (!preg_match('/^<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)\b/', $tag, $tagMatch)) {
                $position = $end + 1;
                continue;
            }
            $closing = (string) $tagMatch[1] === '/';
            $name = strtolower((string) $tagMatch[2]);
            if ($openEnd === null) {
                if (!$closing && $name === 'head') {
                    $openEnd = $end + 1;
                }
                $position = $end + 1;
                continue;
            }
            if ($closing && $name === 'head') {
                return ['open_end' => $openEnd, 'close_start' => $start];
            }
            if (!$closing && in_array($name, ['script', 'style', 'title', 'textarea'], true)) {
                if (!preg_match('#</\s*' . preg_quote($name, '#') . '\s*>#i', $document, $rawClose, PREG_OFFSET_CAPTURE, $end + 1)) {
                    return null;
                }
                $position = (int) $rawClose[0][1] + strlen((string) $rawClose[0][0]);
                continue;
            }
            $position = $end + 1;
        }
        return null;
    }

    private function htmlTagEnd(string $document, int $start): ?int
    {
        $quote = '';
        $length = strlen($document);
        for ($position = $start + 1; $position < $length; $position++) {
            $character = $document[$position];
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
                return $position;
            }
        }
        return null;
    }

    public function claimCoreOwnership(): void
    {
        if ($this->currentSeo() && $this->adapter() === 'fallback') {
            remove_action('wp_head', 'rel_canonical');
        }
    }

    /** @param array<string,bool> $robots @return array<string,bool> */
    public function coreRobots(array $robots): array
    {
        if ($this->adapter() !== 'fallback' || !($seo = $this->currentSeo())) {
            return $robots;
        }
        $value = strtolower($this->read($seo, 'robots'));
        if ($value === '') {
            return $robots;
        }
        $owned = [];
        foreach (array_map('trim', explode(',', $value)) as $directive) {
            if ($directive !== '') {
                $owned[$directive] = true;
            }
        }
        return $owned;
    }

    public function robotsValue(mixed $value): mixed
    {
        $seo = $this->currentSeo();
        return $seo && $this->read($seo, 'robots') !== '' ? $this->read($seo, 'robots') : $value;
    }

    /** @return array<string,string>|mixed */
    public function rankMathRobots(mixed $value): mixed
    {
        $seo = $this->currentSeo();
        $robots = $seo ? $this->read($seo, 'robots') : '';
        if ($robots === '') {
            return $value;
        }
        $result = [];
        foreach (array_map('trim', explode(',', $robots)) as $directive) {
            if ($directive !== '') {
                $result[$directive] = $directive;
            }
        }
        return $result;
    }

    /** @param array<mixed> $graph @return array<mixed> */
    public function schemaGraph(array $graph): array
    {
        $seo = $this->currentSeo();
        return $seo ? $this->rebaseSchema($graph, (string) $seo['canonical']) : $graph;
    }

    /** Remove tags owned by the selected adapter before signed head extras render. */
    public function stripOwnedTags(string $html): string
    {
        $ranges = $this->ownedTagRanges($html);
        if ($ranges === null) {
            return $html;
        }
        foreach (array_reverse($ranges) as $range) {
            $html = substr_replace($html, '', $range['start'], $range['length']);
        }
        return $html;
    }

    /**
     * Scan actual head tokens instead of matching tag-shaped text globally.
     * This preserves hydration JSON, CSS, comments, and RCDATA byte-for-byte.
     *
     * @return list<array{start:int,length:int}>|null
     */
    private function ownedTagRanges(string $html): ?array
    {
        $ranges = [];
        $cursor = 0;
        $length = strlen($html);
        while ($cursor < $length) {
            $opening = strpos($html, '<', $cursor);
            if ($opening === false) {
                break;
            }
            if (substr($html, $opening, 4) === '<!--') {
                $commentEnd = strpos($html, '-->', $opening + 4);
                if ($commentEnd === false) {
                    return null;
                }
                $cursor = $commentEnd + 3;
                continue;
            }
            $candidate = substr($html, $opening, 96);
            if (!preg_match('/^<\s*\/?\s*[A-Za-z][A-Za-z0-9:-]*(?=[\s\/>])/', $candidate)
                && !str_starts_with($candidate, '<!')
                && !str_starts_with($candidate, '<?')) {
                $cursor = $opening + 1;
                continue;
            }
            $tagEnd = $this->htmlTagEnd($html, $opening);
            if ($tagEnd === null) {
                return null;
            }
            $markup = substr($html, $opening, $tagEnd - $opening + 1);
            if (!preg_match('/^<\s*([A-Za-z][A-Za-z0-9:-]*)(?=[\s\/>])/', $markup, $match)) {
                $cursor = $tagEnd + 1;
                continue;
            }
            $tagName = strtolower((string) $match[1]);
            $cursor = $tagEnd + 1;
            if ($tagName === 'plaintext') {
                break;
            }
            if (in_array($tagName, ['script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed', 'noframes'], true)) {
                $rawEnd = $this->rawTextElementEnd($html, $tagName, $cursor);
                if ($rawEnd === null) {
                    return null;
                }
                if ($tagName === 'title') {
                    $ranges[] = ['start' => $opening, 'length' => $rawEnd - $opening];
                } elseif ($tagName === 'script') {
                    $tag = $this->tagSemantics($markup);
                    $attributes = is_array($tag['attributes'] ?? null) ? $tag['attributes'] : [];
                    $type = strtolower(trim((string) ($attributes['type'] ?? '')));
                    $type = trim((string) strtok($type, ';'));
                    if ($type === 'application/ld+json') {
                        $ranges[] = ['start' => $opening, 'length' => $rawEnd - $opening];
                    }
                }
                $cursor = $rawEnd;
                continue;
            }
            if ($tagName === 'link') {
                $tag = $this->tagSemantics($markup);
                $attributes = is_array($tag['attributes'] ?? null) ? $tag['attributes'] : [];
                $relations = preg_split('/\s+/', strtolower(trim((string) ($attributes['rel'] ?? '')))) ?: [];
                if (in_array('canonical', $relations, true)) {
                    $ranges[] = ['start' => $opening, 'length' => $tagEnd - $opening + 1];
                }
            } elseif ($tagName === 'meta') {
                $tag = $this->tagSemantics($markup);
                $attributes = is_array($tag['attributes'] ?? null) ? $tag['attributes'] : [];
                foreach (['property', 'name'] as $ownerAttribute) {
                    $owner = strtolower(trim((string) ($attributes[$ownerAttribute] ?? '')));
                    if (in_array($owner, ['description', 'robots', 'canonical'], true)
                        || str_starts_with($owner, 'og:')
                        || str_starts_with($owner, 'twitter:')) {
                        $ranges[] = ['start' => $opening, 'length' => $tagEnd - $opening + 1];
                        break;
                    }
                }
            }
        }
        return $ranges;
    }

    private function rawTextElementEnd(string $html, string $tagName, int $offset): ?int
    {
        if (!preg_match(
            '#</\s*' . preg_quote($tagName, '#') . '(?=[\s/>])#i',
            $html,
            $match,
            PREG_OFFSET_CAPTURE,
            $offset
        )) {
            return null;
        }
        $closing = (int) $match[0][1];
        $tagEnd = $this->htmlTagEnd($html, $closing);
        return $tagEnd === null ? null : $tagEnd + 1;
    }

    /**
     * Read the browser-relevant tag and attributes. WordPress core's HTML tag
     * processor is authoritative when available; the compact fallback handles
     * the same legal quoted/unquoted attribute forms for isolated unit use.
     *
     * @return array{tag:string,attributes:array<string,string>}
     */
    private function tagSemantics(string $markup): array
    {
        return Support::htmlTagSemantics($markup, ['rel', 'name', 'property', 'type']);
    }

    private function value(string $path, mixed $fallback): string
    {
        $seo = $this->currentSeo();
        $value = $seo ? $this->read($seo, $path) : '';
        return $value !== '' ? $value : (is_scalar($fallback) ? (string) $fallback : '');
    }

    /** @return array<string,mixed>|null */
    private function currentSeo(): ?array
    {
        $route = null;
        if (is_singular()) {
            $route = $this->releases->routeForPost((int) get_queried_object_id());
        }
        if (!$route && $this->connection->profile() !== 'existing-theme') {
            $route = $this->releases->route(Support::requestRoute());
        }
        if (!$route || !is_array($route['seo'] ?? null)) {
            return null;
        }
        $seo = $route['seo'];
        $seo['_route_path'] = (string) $route['route_path'];
        return $this->normalize($seo);
    }

    /** @param array<string,mixed> $seo @return array<string,mixed> */
    private function normalize(array $seo): array
    {
        $seo['og'] = is_array($seo['og'] ?? null) ? $seo['og'] : [];
        $seo['twitter'] = is_array($seo['twitter'] ?? null) ? $seo['twitter'] : [];
        foreach (['Title' => 'title', 'Description' => 'description', 'Image' => 'image', 'ImageSecureUrl' => 'image_secure_url', 'Type' => 'type', 'Url' => 'url'] as $suffix => $key) {
            if (!isset($seo['og'][$key]) && isset($seo['og' . $suffix])) {
                $seo['og'][$key] = $seo['og' . $suffix];
            }
        }
        foreach (['Card' => 'card', 'Title' => 'title', 'Description' => 'description', 'Image' => 'image'] as $suffix => $key) {
            if (!isset($seo['twitter'][$key]) && isset($seo['twitter' . $suffix])) {
                $seo['twitter'][$key] = $seo['twitter' . $suffix];
            }
        }
        $routePath = Support::normalizeRoute((string) ($seo['_route_path'] ?? '/'));
        $seo['canonical'] = home_url($routePath);
        $seo['og']['url'] = $seo['canonical'];
        return $seo;
    }

    /** @param array<string,mixed> $seo */
    private function read(array $seo, string $path): string
    {
        $value = $seo;
        foreach (explode('.', $path) as $part) {
            if (!is_array($value) || !array_key_exists($part, $value)) {
                return '';
            }
            $value = $value[$part];
        }
        return is_scalar($value) ? trim((string) $value) : '';
    }

    /** @param list<string> $tags */
    private function meta(array &$tags, string $attribute, string $name, string $value): void
    {
        if ($value !== '') {
            $tags[] = '<meta ' . $attribute . '="' . esc_attr($name) . '" content="' . esc_attr($value) . '">';
        }
    }

    /** @param array<string,mixed> $seo */
    private function schemaData(array $seo): mixed
    {
        $schema = $seo['structuredData'] ?? $seo['schema'] ?? null;
        if (is_string($schema) && $schema !== '') {
            $schema = json_decode($schema, true);
        }
        if (!is_array($schema)) {
            return null;
        }
        foreach ($schema as $value) {
            if (is_string($value) && str_contains($value, '<script')) {
                return null;
            }
        }
        return $this->rebaseSchema($schema, (string) $seo['canonical']);
    }

    /** @param array<string,mixed> $seo */
    private function ownedHeadHtml(array $seo): string
    {
        $tags = [];
        $title = $this->read($seo, 'title');
        if ($title !== '') {
            $tags[] = '<title>' . esc_html($title) . '</title>';
        }
        $this->meta($tags, 'name', 'description', $this->read($seo, 'description'));
        $robots = $this->read($seo, 'robots');
        if ($robots !== '') {
            $this->meta($tags, 'name', 'robots', $robots);
        }
        $canonical = $this->read($seo, 'canonical');
        if ($canonical !== '') {
            $tags[] = '<link rel="canonical" href="' . esc_url($canonical) . '">';
        }
        foreach ([
            ['property', 'og:title', 'og.title'], ['property', 'og:description', 'og.description'],
            ['property', 'og:image', 'og.image'], ['property', 'og:image:secure_url', 'og.image_secure_url'],
            ['property', 'og:type', 'og.type'], ['property', 'og:url', 'og.url'],
            ['name', 'twitter:card', 'twitter.card'], ['name', 'twitter:title', 'twitter.title'],
            ['name', 'twitter:description', 'twitter.description'], ['name', 'twitter:image', 'twitter.image'],
        ] as [$attribute, $name, $path]) {
            $this->meta($tags, $attribute, $name, $this->read($seo, $path));
        }
        $schema = $this->schemaData($seo);
        if ($schema !== null) {
            $tags[] = '<script type="application/ld+json">' . wp_json_encode($schema, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) . '</script>';
        }
        return implode("\n", $tags);
    }

    private function rebaseSchema(mixed $value, string $canonical, string $key = ''): mixed
    {
        if (is_array($value)) {
            foreach ($value as $childKey => $child) {
                $nextKey = is_int($childKey) ? $key : (string) $childKey;
                $value[$childKey] = $this->rebaseSchema($child, $canonical, $nextKey);
            }
            return $value;
        }
        $urlKeys = [
            '@id', 'url', 'mainEntityOfPage', 'image', 'logo', 'contentUrl',
            'thumbnailUrl', 'embedUrl', 'sameAs', 'target', 'urlTemplate',
        ];
        if (!is_string($value) || !in_array($key, $urlKeys, true) || $value === '' || str_starts_with($value, '#')) {
            return $value;
        }
        $parts = wp_parse_url($value);
        if (!is_array($parts) || isset($parts['host']) || isset($parts['scheme']) || !str_starts_with($value, '/')) {
            return $value;
        }
        $path = (string) ($parts['path'] ?? '/');
        $rebased = home_url(Support::normalizeRoute($path));
        if (isset($parts['query']) && is_string($parts['query']) && $parts['query'] !== '') {
            $rebased .= '?' . $parts['query'];
        }
        if (isset($parts['fragment']) && is_string($parts['fragment']) && $parts['fragment'] !== '') {
            $rebased .= '#' . $parts['fragment'];
        }
        return $rebased;
    }
}
