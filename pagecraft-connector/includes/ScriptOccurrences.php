<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/**
 * Validates and composes the signed executable occurrence stream.
 *
 * Approval remains fingerprint-based, but execution identity and ordering are
 * occurrence-based so copied widgets and cross-region scripts keep the exact
 * behavior of the Pagecraft release.
 */
final class ScriptOccurrences
{
    /** @var array<string,int> */
    private const ROUTE_REGIONS = [
        'route-head' => 0,
        'route-body' => 1,
        'route-tail' => 2,
    ];

    /** @var array<string,int> */
    private const SHARED_REGIONS = [
        'shared-header' => 0,
        'shared-footer' => 1,
    ];

    /** @return list<array<string,mixed>>|\WP_Error */
    public static function parse(string $runtime, mixed $declarations, string $scope): array|\WP_Error
    {
        if (!in_array($scope, ['route', 'shared'], true)) {
            return self::error('The executable occurrence scope is invalid.');
        }
        if (!is_array($declarations) || !array_is_list($declarations)) {
            return self::error('The signed executable occurrence index must be a list.');
        }
        if ($runtime === '') {
            return $declarations === []
                ? []
                : self::error('Executable occurrences were declared without signed runtime bytes.');
        }
        if (!preg_match_all('#<script\b[^>]*>[\s\S]*?</script\s*>#i', $runtime, $matches)
            || trim((string) preg_replace('#<script\b[^>]*>[\s\S]*?</script\s*>#i', '', $runtime)) !== '') {
            return self::error('Pagecraft runtime must contain only complete script elements.');
        }
        if (count($declarations) !== count($matches[0])) {
            return self::error('The signed runtime and ordered executable occurrence index do not match.');
        }

        $regions = $scope === 'route' ? self::ROUTE_REGIONS : self::SHARED_REGIONS;
        $nextOrder = [];
        $lastRank = -1;
        $occurrenceIds = [];
        $parsed = [];
        foreach ($matches[0] as $index => $template) {
            $declaration = $declarations[$index] ?? null;
            if (!is_array($declaration)) {
                return self::error('A signed executable occurrence is malformed.');
            }
            $occurrenceId = (string) ($declaration['occurrenceId'] ?? '');
            $region = (string) ($declaration['region'] ?? '');
            $placement = (string) ($declaration['placement'] ?? '');
            $kind = (string) ($declaration['kind'] ?? '');
            $order = $declaration['order'] ?? null;
            $token = (string) ($declaration['token'] ?? '');
            $hash = strtolower((string) ($declaration['hash'] ?? ''));
            if (!preg_match('/^script-[a-f0-9]{32}$/', $occurrenceId)
                || isset($occurrenceIds[$occurrenceId])) {
                return self::error('Executable occurrence IDs must be unique canonical Pagecraft identifiers.');
            }
            if (!hash_equals('%%PAGECRAFT_RUNTIME:' . $occurrenceId . '%%', $token)) {
                return self::error('An executable occurrence has an invalid signed runtime token.');
            }
            if (!array_key_exists($region, $regions)) {
                return self::error('An executable occurrence is assigned to an invalid document region.');
            }
            $expectedPlacement = $region === 'route-head' ? 'head' : 'body';
            if ($placement !== $expectedPlacement) {
                return self::error('An executable occurrence placement disagrees with its document region.');
            }
            if (!is_int($order) || $order < 0 || $order !== ($nextOrder[$region] ?? 0)) {
                return self::error('Executable occurrence order must be contiguous within each document region.');
            }
            $rank = $regions[$region];
            if ($rank < $lastRank) {
                return self::error('Executable occurrence regions are not in signed document order.');
            }
            if (!in_array($kind, ['generated', 'authored'], true)
                || !preg_match('/^[a-f0-9]{64}$/', $hash)
                || !hash_equals($hash, hash('sha256', (string) $template))) {
                return self::error('An executable occurrence fingerprint or kind is invalid.');
            }
            $occurrenceIds[$occurrenceId] = true;
            $nextOrder[$region] = $order + 1;
            $lastRank = $rank;
            $declaration['hash'] = $hash;
            $declaration['fingerprint'] = $hash;
            $declaration['template_html'] = (string) $template;
            $parsed[] = $declaration;
        }
        return $parsed;
    }

    /**
     * @param list<array<string,mixed>> $route
     * @param list<array<string,mixed>> $shared
     * @return list<array<string,mixed>>|\WP_Error
     */
    public static function compose(array $route, array $shared, string $profile): array|\WP_Error
    {
        if (!in_array($profile, ['existing-theme', 'pagecraft-theme'], true)) {
            return self::error('The executable occurrence rendering profile is invalid.');
        }
        $selected = $profile === 'pagecraft-theme' ? array_merge($route, $shared) : $route;
        $byRegion = [];
        $seen = [];
        foreach ($selected as $occurrence) {
            $occurrenceId = is_array($occurrence) ? (string) ($occurrence['occurrenceId'] ?? '') : '';
            $region = is_array($occurrence) ? (string) ($occurrence['region'] ?? '') : '';
            if (!preg_match('/^script-[a-f0-9]{32}$/', $occurrenceId) || isset($seen[$occurrenceId])) {
                return self::error('Executable occurrence IDs must remain unique across the rendered route.');
            }
            if (!array_key_exists($region, self::ROUTE_REGIONS + self::SHARED_REGIONS)) {
                return self::error('The rendered route contains an unknown executable region.');
            }
            $seen[$occurrenceId] = true;
            $byRegion[$region][] = $occurrence;
        }

        $ordered = [];
        foreach (['route-head', 'shared-header', 'route-body', 'shared-footer', 'route-tail'] as $region) {
            if ($profile === 'existing-theme' && str_starts_with($region, 'shared-')) {
                continue;
            }
            foreach ((array) ($byRegion[$region] ?? []) as $occurrence) {
                $ordered[] = $occurrence;
            }
        }
        $valid = self::validateComposed($ordered, $profile);
        return is_wp_error($valid) ? $valid : $ordered;
    }

    /** @param list<array<string,mixed>> $occurrences */
    public static function validateComposed(array $occurrences, string $profile): bool|\WP_Error
    {
        $ranks = $profile === 'pagecraft-theme'
            ? ['route-head' => 0, 'shared-header' => 1, 'route-body' => 2, 'shared-footer' => 3, 'route-tail' => 4]
            : ($profile === 'existing-theme'
                ? ['route-head' => 0, 'route-body' => 1, 'route-tail' => 2]
                : []);
        if ($ranks === [] || !array_is_list($occurrences)) {
            return self::error('The rendered executable occurrence stream is invalid.');
        }
        $seen = [];
        $nextOrder = [];
        $lastRank = -1;
        foreach ($occurrences as $occurrence) {
            if (!is_array($occurrence)) {
                return self::error('A rendered executable occurrence is malformed.');
            }
            $occurrenceId = (string) ($occurrence['occurrenceId'] ?? '');
            $region = (string) ($occurrence['region'] ?? '');
            $placement = $occurrence['placement'] ?? null;
            $kind = $occurrence['kind'] ?? null;
            $order = $occurrence['order'] ?? null;
            $token = (string) ($occurrence['token'] ?? '');
            $fingerprint = strtolower((string) ($occurrence['fingerprint'] ?? $occurrence['hash'] ?? ''));
            $template = $occurrence['template_html'] ?? null;
            $html = $occurrence['html'] ?? null;
            if (!preg_match('/^script-[a-f0-9]{32}$/', $occurrenceId)
                || isset($seen[$occurrenceId])
                || !array_key_exists($region, $ranks)
                || !hash_equals('%%PAGECRAFT_RUNTIME:' . $occurrenceId . '%%', $token)
                || !is_int($order) || $order !== ($nextOrder[$region] ?? 0)
                || !in_array($kind, ['generated', 'authored'], true)
                || !is_string($placement)
                || $placement !== ($region === 'route-head' ? 'head' : 'body')
                || !preg_match('/^[a-f0-9]{64}$/', $fingerprint)
                || !is_string($template)
                || !hash_equals($fingerprint, hash('sha256', $template))
                || !is_string($html)
                || !preg_match('#^<script\b[^>]*>[\s\S]*?</script\s*>$#i', trim($html))) {
                return self::error('A rendered executable occurrence violates its signed contract.');
            }
            $rank = $ranks[$region];
            if ($rank < $lastRank) {
                return self::error('Rendered executable occurrences are not in document order.');
            }
            $seen[$occurrenceId] = true;
            $nextOrder[$region] = $order + 1;
            $lastRank = $rank;
        }
        return true;
    }

    /** @param list<array<string,mixed>> $occurrences */
    public static function validateMarkers(string $html, array $occurrences, string $region): bool|\WP_Error
    {
        return self::validateMarkerStream($html, $occurrences, [$region]);
    }

    /** @param list<array<string,mixed>> $occurrences @param list<string> $regions */
    public static function validateMarkerStream(string $html, array $occurrences, array $regions): bool|\WP_Error
    {
        $expected = [];
        foreach ($occurrences as $occurrence) {
            if (is_array($occurrence) && in_array((string) ($occurrence['region'] ?? ''), $regions, true)) {
                $expected[] = (string) ($occurrence['token'] ?? '');
            }
        }
        preg_match_all('/%%PAGECRAFT_RUNTIME:script-[a-f0-9]{32}%%/', $html, $raw);
        preg_match_all('/<!--(%%PAGECRAFT_RUNTIME:script-[a-f0-9]{32}%%)-->/', $html, $comments);
        $rawTokens = array_values((array) ($raw[0] ?? []));
        $commentTokens = array_values((array) ($comments[1] ?? []));
        if ((str_contains($html, '%%PAGECRAFT_RUNTIME:') && $rawTokens === [])
            || $rawTokens !== $commentTokens
            || $rawTokens !== $expected) {
            return self::error('Runtime occurrence markers must match their signed region exactly and positionally.');
        }
        return true;
    }

    private static function error(string $message): \WP_Error
    {
        return new \WP_Error('pagecraft_script_occurrence_invalid', $message);
    }
}
