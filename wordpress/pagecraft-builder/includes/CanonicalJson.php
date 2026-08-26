<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class CanonicalJson
{
    public static function decodeObject(string $source, string $label): \stdClass
    {
        try {
            $value = json_decode($source, false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new PackageException($label . ' is not valid JSON: ' . $error->getMessage());
        }

        if (!$value instanceof \stdClass) {
            throw new PackageException($label . ' must be a JSON object.');
        }
        if (self::encode($value) !== $source) {
            throw new PackageException($label . ' is not canonical JSON.');
        }

        return $value;
    }

    public static function encode(mixed $value): string
    {
        if ($value instanceof \stdClass) {
            $properties = get_object_vars($value);
            ksort($properties, SORT_STRING);
            $fields = [];
            foreach ($properties as $key => $child) {
                $fields[] = self::scalarString((string) $key) . ':' . self::encode($child);
            }
            return '{' . implode(',', $fields) . '}';
        }
        if (is_array($value)) {
            $items = [];
            foreach ($value as $child) {
                $items[] = self::encode($child);
            }
            return '[' . implode(',', $items) . ']';
        }
        if (is_string($value)) {
            return self::scalarString($value);
        }
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value)) {
            if (!is_finite($value)) {
                throw new PackageException('Canonical JSON does not allow non-finite numbers.');
            }
            if ($value == 0.0) {
                return '0';
            }
            $encoded = json_encode($value, JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
            return str_ends_with($encoded, '.0') ? substr($encoded, 0, -2) : $encoded;
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if ($value === null) {
            return 'null';
        }

        throw new PackageException('Canonical JSON contains an unsupported value.');
    }

    private static function scalarString(string $value): string
    {
        return json_encode(
            $value,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
    }
}
