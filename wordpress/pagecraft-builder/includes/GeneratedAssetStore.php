<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

/**
 * Writes immutable generated assets outside the plugin and theme directories.
 *
 * The relative path is the persistence contract. A theme can reconstruct its URL from
 * wp_upload_dir() even while Pagecraft Builder is deactivated.
 */
final class GeneratedAssetStore
{
    public const DIRECTORY = 'pagecraft';
    public const MAX_CSS_BYTES = 8388608;
    public const MAX_RUNTIME_BYTES = 2097152;

    /** @return array{path:string,hash:string,bytes:int} */
    public function writeCss(string $scope, string $css): array
    {
        if (!in_array($scope, ['global', 'page'], true)) {
            throw new PackageException('The generated stylesheet scope is invalid.');
        }
        if (strlen($css) > self::MAX_CSS_BYTES) {
            throw new PackageException('The generated Pagecraft stylesheet exceeds the WordPress limit.');
        }

        return $this->write($scope, 'css', $css);
    }

    /** @return array{path:string,hash:string,bytes:int} */
    public function writeRuntime(): array
    {
        $source = @file_get_contents(PAGECRAFT_BUILDER_DIR . 'assets/pagecraft-runtime.js');
        if (!is_string($source) || $source === '' || strlen($source) > self::MAX_RUNTIME_BYTES) {
            throw new PackageException('The trusted Pagecraft runtime asset is missing or invalid.');
        }

        return $this->write('runtime', 'js', $source);
    }

    /** @return array{path:string,hash:string,bytes:int} */
    private function write(string $scope, string $extension, string $source): array
    {
        $hash = hash('sha256', $source);
        $filename = $scope . '-' . $hash . '.' . $extension;
        $uploads = wp_upload_dir();
        if (!is_array($uploads) || !empty($uploads['error'])
            || !is_string($uploads['basedir'] ?? null) || $uploads['basedir'] === '') {
            throw new PackageException('WordPress could not resolve its uploads directory.');
        }
        $directory = rtrim($uploads['basedir'], '/\\') . DIRECTORY_SEPARATOR . self::DIRECTORY;
        if (!is_dir($directory) && !wp_mkdir_p($directory)) {
            throw new PackageException('WordPress could not create the Pagecraft generated-assets directory.');
        }
        $target = $directory . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($target)) {
            $temporary = tempnam($directory, '.pagecraft-');
            if ($temporary === false) {
                throw new PackageException('WordPress could not stage a generated Pagecraft asset.');
            }
            $written = @file_put_contents($temporary, $source, LOCK_EX);
            if ($written !== strlen($source) || !@chmod($temporary, 0644) || !@rename($temporary, $target)) {
                @unlink($temporary);
                throw new PackageException('WordPress could not store a generated Pagecraft asset.');
            }
        }
        if (!is_readable($target) || hash_file('sha256', $target) !== $hash) {
            throw new PackageException('A generated Pagecraft asset failed integrity verification.');
        }

        return [
            'path' => self::DIRECTORY . '/' . $filename,
            'hash' => $hash,
            'bytes' => strlen($source),
        ];
    }
}
