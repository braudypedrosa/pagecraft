<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use JsonException;
use RuntimeException;
use stdClass;

/**
 * Minimal RFC 8785-compatible encoder for Pagecraft manifests.
 *
 * Release manifests deliberately forbid floating-point numbers. That avoids cross-runtime
 * number-format ambiguity while retaining canonical UTF-8 strings, arrays, objects, integers,
 * booleans, and null.
 */
final class CanonicalJson
{
    public static function encode(mixed $value): string
    {
        if ($value === null) {
            return 'null';
        }
        if ($value === true) {
            return 'true';
        }
        if ($value === false) {
            return 'false';
        }
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value)) {
            throw new RuntimeException('Floating-point values are not allowed in release manifests.');
        }
        if (is_string($value)) {
            return self::encodeString($value);
        }
        if ($value instanceof stdClass) {
            return self::encodeObject(get_object_vars($value));
        }
        if (is_array($value)) {
            if (!array_is_list($value)) {
                return self::encodeObject($value);
            }
            return '[' . implode(',', array_map([self::class, 'encode'], $value)) . ']';
        }
        throw new RuntimeException('Unsupported canonical JSON value.');
    }

    /**
     * Decode canonical JSON and reject alternative serializations.
     */
    public static function decode(string $json): stdClass
    {
        try {
            $decoded = json_decode($json, false, 128, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new RuntimeException('Manifest JSON is invalid.', 0, $error);
        }
        if (!$decoded instanceof stdClass) {
            throw new RuntimeException('Manifest root must be an object.');
        }
        if (!hash_equals(self::encode($decoded), $json)) {
            throw new RuntimeException('Manifest JSON is not canonical.');
        }
        return $decoded;
    }

    /** @param array<string,mixed> $value */
    private static function encodeObject(array $value): string
    {
        uksort($value, [self::class, 'compareKeys']);
        $pairs = [];
        foreach ($value as $key => $item) {
            if (!is_string($key)) {
                throw new RuntimeException('Canonical JSON object keys must be strings.');
            }
            $pairs[] = self::encodeString($key) . ':' . self::encode($item);
        }
        return '{' . implode(',', $pairs) . '}';
    }

    private static function compareKeys(string $left, string $right): int
    {
        if (function_exists('mb_convert_encoding')) {
            return strcmp((string) mb_convert_encoding($left, 'UTF-16BE', 'UTF-8'), (string) mb_convert_encoding($right, 'UTF-16BE', 'UTF-8'));
        }
        if (function_exists('iconv')) {
            $a = iconv('UTF-8', 'UTF-16BE', $left);
            $b = iconv('UTF-8', 'UTF-16BE', $right);
            if (is_string($a) && is_string($b)) {
                return strcmp($a, $b);
            }
        }
        return strcmp($left, $right);
    }

    private static function encodeString(string $value): string
    {
        try {
            return json_encode(
                $value,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR
            );
        } catch (JsonException $error) {
            throw new RuntimeException('Manifest contains invalid UTF-8.', 0, $error);
        }
    }
}
