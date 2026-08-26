<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\Updater;
use ReflectionMethod;

final class UpdaterArchiveTest extends ConnectorTestCase
{
    public function test_signed_theme_package_slug_installs_to_runtime_stylesheet_root(): void
    {
        if (!class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('ZIP support is unavailable.');
        }
        $valid = $this->archive(['pagecraft/style.css' => "/*\nTheme Name: Pagecraft\n*/\n"]);
        $legacyMismatch = $this->archive(['pagecraft-theme/style.css' => "/*\nTheme Name: Pagecraft\n*/\n"]);
        $connection = new Connection();
        $method = new ReflectionMethod(Updater::class, 'validateArchive');
        $updater = new Updater($connection, new HttpClient($connection));

        try {
            $this->assertTrue($method->invoke($updater, $valid, 'pagecraft-theme'));
            $blocked = $method->invoke($updater, $legacyMismatch, 'pagecraft-theme');
            $this->assertInstanceOf(\WP_Error::class, $blocked);
            $this->assertSame('pagecraft_package_root', $blocked->get_error_code());
        } finally {
            wp_delete_file($valid);
            wp_delete_file($legacyMismatch);
        }
    }

    /** @param array<string,string> $entries */
    private function archive(array $entries): string
    {
        $file = tempnam(sys_get_temp_dir(), 'pagecraft-package-root-');
        if (!is_string($file)) {
            throw new \RuntimeException('Could not create a package fixture.');
        }
        $zip = new \ZipArchive();
        if ($zip->open($file, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Could not open a package fixture.');
        }
        foreach ($entries as $name => $contents) {
            $zip->addFromString($name, $contents);
        }
        $zip->close();
        return $file;
    }
}
