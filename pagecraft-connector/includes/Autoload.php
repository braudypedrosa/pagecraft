<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Autoload
{
    public static function register(): void
    {
        spl_autoload_register(static function (string $class): void {
            $prefix = __NAMESPACE__ . '\\';
            if (!str_starts_with($class, $prefix)) {
                return;
            }

            $relative = substr($class, strlen($prefix));
            if ($relative === false || preg_match('/[^A-Za-z0-9_\\\\]/', $relative)) {
                return;
            }

            $file = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
            if (is_file($file)) {
                require_once $file;
            }
        });
    }
}
