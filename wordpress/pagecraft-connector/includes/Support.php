<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use JsonException;
use RuntimeException;

final class Support
{
    public static function base64UrlEncode(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    public static function base64UrlDecode(string $encoded): string
    {
        if ($encoded === '' || preg_match('/[^A-Za-z0-9_-]/', $encoded)) {
            throw new RuntimeException('Invalid base64url value.');
        }
        $padding = (4 - strlen($encoded) % 4) % 4;
        $decoded = base64_decode(strtr($encoded . str_repeat('=', $padding), '-_', '+/'), true);
        if ($decoded === false) {
            throw new RuntimeException('Invalid base64url value.');
        }
        return $decoded;
    }

    /** @return array<string,mixed> */
    public static function decodeObject(string $json): array
    {
        try {
            $value = json_decode($json, true, 128, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new RuntimeException('Invalid JSON: ' . $error->getMessage(), 0, $error);
        }
        if (!is_array($value)) {
            throw new RuntimeException('Expected a JSON object.');
        }
        return $value;
    }

    public static function json(mixed $value): string
    {
        try {
            return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new RuntimeException('Could not encode JSON.', 0, $error);
        }
    }

    public static function normalizeOrigin(string $origin): string
    {
        $parts = wp_parse_url(trim($origin));
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return '';
        }
        $scheme = strtolower((string) $parts['scheme']);
        $host = strtolower(rtrim((string) $parts['host'], '.'));
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            return '';
        }
        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        return $scheme . '://' . $host . $port;
    }

    public static function normalizeRoute(?string $path): string
    {
        if ($path === null) {
            $path = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';
        }
        $parsed = wp_parse_url($path, PHP_URL_PATH);
        $path = is_string($parsed) ? $parsed : '/';
        $path = preg_replace('#/+#', '/', '/' . ltrim($path, '/')) ?: '/';
        if ($path !== '/' && !str_contains(basename($path), '.') && !str_ends_with($path, '/')) {
            $path .= '/';
        }
        return $path;
    }

    /**
     * Convert an incoming WordPress request URI to Pagecraft's target-neutral
     * route namespace. Only the exact home path boundary is stripped, so a
     * /subdir install never mistakes /subdirectory for its own prefix.
     */
    public static function requestRoute(?string $requestUri = null): string
    {
        $requestUri ??= isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';
        $requestPath = wp_parse_url($requestUri, PHP_URL_PATH);
        $requestPath = is_string($requestPath) ? preg_replace('#/+#', '/', '/' . ltrim($requestPath, '/')) : '/';
        $requestPath = is_string($requestPath) && $requestPath !== '' ? $requestPath : '/';
        $homePath = wp_parse_url(home_url('/'), PHP_URL_PATH);
        $homePath = is_string($homePath) ? '/' . trim($homePath, '/') : '/';
        if ($homePath !== '/') {
            if ($requestPath === $homePath || $requestPath === $homePath . '/') {
                $requestPath = '/';
            } elseif (str_starts_with($requestPath, $homePath . '/')) {
                $requestPath = substr($requestPath, strlen($homePath));
            }
        }
        return self::normalizeRoute($requestPath);
    }

    public static function validIdentifier(mixed $value, int $max = 96): bool
    {
        return is_string($value)
            && $value !== ''
            && strlen($value) <= $max
            && (bool) preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]*$/', $value);
    }

    public static function utcNow(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    public static function environmentAllowsHttp(?string $url = null): bool
    {
        $environmentAllows = function_exists('wp_get_environment_type')
            && in_array(wp_get_environment_type(), ['local', 'development'], true);
        $testAllows = defined('PAGECRAFT_CONNECTOR_ALLOW_INSECURE_LOOPBACK')
            && PAGECRAFT_CONNECTOR_ALLOW_INSECURE_LOOPBACK === true;
        if (!$environmentAllows && !$testAllows) {
            return false;
        }
        if ($url === null || $url === '') {
            // Callers that need a transport exception must pass the exact URL.
            // The parameterless form remains useful only for local root setup.
            return $environmentAllows;
        }
        $parts = wp_parse_url($url);
        if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'http') {
            return false;
        }
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        return in_array($host, ['localhost', '127.0.0.1', '::1'], true);
    }

    public static function hashEquals(string $expected, string $actual): bool
    {
        return strlen($expected) === strlen($actual) && hash_equals(strtolower($expected), strtolower($actual));
    }

    public static function signatureVerifierAvailable(): bool
    {
        return function_exists('sodium_crypto_sign_verify_detached') || class_exists('ParagonIE_Sodium_Compat');
    }

    /**
     * Existing Theme owns the document shell and its main landmark. Releases
     * contain main-inner content, but normalize older/full-shell candidates as
     * well so a retained release cannot reintroduce nested landmarks.
     */
    public static function existingThemeBody(string $html, string $releaseMarker = ''): string
    {
        $html = trim($html);
        if ($html === '') {
            return '';
        }

        $rootOpen = $releaseMarker !== ''
            ? '<div class="pagecraft-root" data-pagecraft-release-root="' . esc_attr($releaseMarker) . '">'
            : '<div class="pagecraft-root" data-pagecraft-release-root>';
        $inner = $html;
        if (preg_match('#\A(<div\b[^>]*\bdata-pagecraft-release-root(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+))?[^>]*>)([\s\S]*)</div\s*>\z#i', $html, $root)) {
            if ($releaseMarker === '') {
                $rootOpen = (string) $root[1];
            }
            $inner = trim((string) $root[2]);
        }

        // Compatibility for a previously stored full Pagecraft shell.
        if (preg_match('#\A<header\b[^>]*>[\s\S]*?</header\s*>\s*<main\b[^>]*>([\s\S]*)</main\s*>\s*<footer\b[^>]*>[\s\S]*?</footer\s*>\z#i', $inner, $shell)) {
            $inner = trim((string) $shell[1]);
        } elseif (preg_match('#\A<main\b[^>]*>([\s\S]*)</main\s*>\z#i', $inner, $main)) {
            $inner = trim((string) $main[1]);
        }

        return $rootOpen . $inner . '</div>';
    }

    public static function releaseMarker(string $deploymentId, string $artifactHash): string
    {
        $artifactHash = strtolower($artifactHash);
        if (!self::validIdentifier($deploymentId, 160) || !preg_match('/^[a-f0-9]{64}$/', $artifactHash)) {
            return '';
        }
        return hash('sha256', "pagecraft-release-root-v1\0" . $deploymentId . "\0" . $artifactHash);
    }

    public static function bodyHasReleaseMarker(string $html, string $expected): bool
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $expected)) {
            return false;
        }
        if (class_exists('WP_HTML_Tag_Processor')) {
            $processor = new \WP_HTML_Tag_Processor($html);
            while ($processor->next_tag(['tag_name' => 'DIV'])) {
                $classes = preg_split('/\s+/', trim((string) $processor->get_attribute('class'))) ?: [];
                $marker = $processor->get_attribute('data-pagecraft-release-root');
                if (in_array('pagecraft-root', $classes, true)
                    && is_string($marker)
                    && hash_equals($expected, strtolower($marker))) {
                    return true;
                }
            }
            return false;
        }

        if (!preg_match_all('#<div\b[^>]*>#i', $html, $tags)) {
            return false;
        }
        foreach ($tags[0] as $tag) {
            $hasClass = preg_match('#\bclass\s*=\s*(?:"[^"]*\bpagecraft-root\b[^"]*"|\'[^\']*\bpagecraft-root\b[^\']*\'|[^\s>]*\bpagecraft-root\b[^\s>]*)#i', $tag) === 1;
            $hasMarker = preg_match('#\bdata-pagecraft-release-root\s*=\s*(?:"' . preg_quote($expected, '#') . '"|\'' . preg_quote($expected, '#') . '\'|' . preg_quote($expected, '#') . ')(?:\s|/?>)#i', $tag) === 1;
            if ($hasClass && $hasMarker) {
                return true;
            }
        }
        return false;
    }

    /**
     * Read browser-relevant HTML tag attributes. Core's tokenizer is
     * authoritative in WordPress; the fallback covers legal quoted/unquoted
     * forms for isolated verification and unit runtimes.
     *
     * @param list<string> $knownAttributes
     * @return array{tag:string,attributes:array<string,string>}
     */
    public static function htmlTagSemantics(string $markup, array $knownAttributes): array
    {
        $knownAttributes = array_values(array_unique(array_map('strtolower', $knownAttributes)));
        $allAttributes = in_array('*', $knownAttributes, true);
        $knownAttributes = array_values(array_filter($knownAttributes, static fn (string $name): bool => $name !== '*'));
        if (class_exists('WP_HTML_Tag_Processor')) {
            $processor = new \WP_HTML_Tag_Processor($markup);
            if ($processor->next_tag()) {
                $attributes = [];
                $names = $allAttributes && method_exists($processor, 'get_attribute_names_with_prefix')
                    ? $processor->get_attribute_names_with_prefix('')
                    : $knownAttributes;
                foreach (is_array($names) ? $names : [] as $attribute) {
                    $attribute = strtolower((string) $attribute);
                    $value = $processor->get_attribute($attribute);
                    if (is_string($value) || $value === true) {
                        $attributes[$attribute] = html_entity_decode(is_string($value) ? $value : '', ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    }
                }
                return ['tag' => strtolower((string) $processor->get_tag()), 'attributes' => $attributes];
            }
        }
        if (!preg_match('/^<\s*([A-Za-z][A-Za-z0-9:-]*)\b/', $markup, $tagMatch, PREG_OFFSET_CAPTURE)) {
            return ['tag' => '', 'attributes' => []];
        }
        $tag = strtolower((string) $tagMatch[1][0]);
        $offset = (int) $tagMatch[1][1] + strlen((string) $tagMatch[1][0]);
        $attributes = [];
        $length = strlen($markup);
        while ($offset < $length) {
            while ($offset < $length && preg_match('/\s/', $markup[$offset])) {
                $offset++;
            }
            if ($offset >= $length || $markup[$offset] === '>') {
                break;
            }
            if ($markup[$offset] === '/' && ($markup[$offset + 1] ?? '') === '>') {
                break;
            }
            if (!preg_match('/\G([^\s=\/>]+)/A', $markup, $nameMatch, 0, $offset)) {
                $offset++;
                continue;
            }
            $attribute = strtolower((string) $nameMatch[1]);
            $offset += strlen((string) $nameMatch[0]);
            while ($offset < $length && preg_match('/\s/', $markup[$offset])) {
                $offset++;
            }
            $value = '';
            if (($markup[$offset] ?? '') === '=') {
                $offset++;
                while ($offset < $length && preg_match('/\s/', $markup[$offset])) {
                    $offset++;
                }
                $quote = $markup[$offset] ?? '';
                if ($quote === '"' || $quote === "'") {
                    $offset++;
                    $end = strpos($markup, $quote, $offset);
                    $end = $end === false ? $length : $end;
                    $value = substr($markup, $offset, $end - $offset);
                    $offset = min($length, $end + 1);
                } elseif (preg_match('/\G([^\s>]+)/A', $markup, $valueMatch, 0, $offset)) {
                    $value = (string) $valueMatch[1];
                    $offset += strlen((string) $valueMatch[0]);
                }
            }
            if (!array_key_exists($attribute, $attributes) && ($allAttributes || in_array($attribute, $knownAttributes, true))) {
                $attributes[$attribute] = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        }
        return ['tag' => $tag, 'attributes' => $attributes];
    }
}
