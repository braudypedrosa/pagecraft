<?php

declare(strict_types=1);

/** Build a production connector ZIP with an offline-provisioned root public key. */

$source = dirname(__DIR__);
$options = getopt('', ['root-public-key-file:', 'output::']);
$keyFile = isset($options['root-public-key-file']) ? (string) $options['root-public-key-file'] : '';
$encodedKey = (string) (getenv('PAGECRAFT_PACKAGE_ROOT_PUBLIC_KEY') ?: '');
if ($keyFile !== '') {
    if (!is_file($keyFile) || !is_readable($keyFile)) {
        fwrite(STDERR, "Root public-key file is not readable.\n");
        exit(2);
    }
    $encodedKey = trim((string) file_get_contents($keyFile));
}
if ($encodedKey === '' || preg_match('/[^A-Za-z0-9_-]/', $encodedKey)) {
    fwrite(STDERR, "Provide a raw Ed25519 root public key as base64url via --root-public-key-file or PAGECRAFT_PACKAGE_ROOT_PUBLIC_KEY.\n");
    exit(2);
}
$padding = (4 - strlen($encodedKey) % 4) % 4;
$decodedKey = base64_decode(strtr($encodedKey . str_repeat('=', $padding), '-_', '+/'), true);
if (!is_string($decodedKey) || strlen($decodedKey) !== 32) {
    fwrite(STDERR, "The Pagecraft root public key must decode to exactly 32 bytes.\n");
    exit(2);
}
if (!class_exists('ZipArchive')) {
    fwrite(STDERR, "PHP ZipArchive is required to build the connector package.\n");
    exit(2);
}

$pluginFile = $source . '/pagecraft-connector.php';
$pluginSource = (string) file_get_contents($pluginFile);
if (!preg_match('/^ \* Version:\s*([^\s]+)$/m', $pluginSource, $versionMatch)) {
    fwrite(STDERR, "Could not read the connector version.\n");
    exit(2);
}
$version = $versionMatch[1];
$output = isset($options['output']) && is_string($options['output']) && $options['output'] !== ''
    ? $options['output']
    : $source . '/dist/pagecraft-connector-' . $version . '.zip';
if (!str_ends_with(strtolower($output), '.zip')) {
    fwrite(STDERR, "Package output must be a .zip path.\n");
    exit(2);
}
$outputDirectory = dirname($output);
if (!is_dir($outputDirectory) && !mkdir($outputDirectory, 0755, true) && !is_dir($outputDirectory)) {
    fwrite(STDERR, "Could not create the package output directory.\n");
    exit(2);
}

$files = [$pluginFile, $source . '/readme.txt', $source . '/LICENSE'];
foreach ([$source . '/includes', $source . '/assets'] as $directory) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $item) {
        if ($item->isFile() && !$item->isLink()) {
            $files[] = $item->getPathname();
        }
    }
}
sort($files, SORT_STRING);

$marker = '@@PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL@@';
$zip = new ZipArchive();
if ($zip->open($output, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "Could not create the connector package.\n");
    exit(2);
}
$rootFound = false;
$packageRoot = 'pagecraft-connector/';
$timestamp = max(315532800, (int) (getenv('SOURCE_DATE_EPOCH') ?: 315532800));
foreach ($files as $file) {
    $relative = ltrim(str_replace('\\', '/', substr($file, strlen($source))), '/');
    $contents = file_get_contents($file);
    if (!is_string($contents)) {
        $zip->close();
        @unlink($output);
        fwrite(STDERR, "Could not read {$relative}.\n");
        exit(2);
    }
    if ($relative === 'includes/RootTrust.php') {
        if (substr_count($contents, $marker) !== 1) {
            $zip->close();
            @unlink($output);
            fwrite(STDERR, "RootTrust.php must contain exactly one packaging marker.\n");
            exit(2);
        }
        $contents = str_replace($marker, $encodedKey, $contents);
        $rootFound = true;
    }
    if (str_contains($contents, $marker)) {
        $zip->close();
        @unlink($output);
        fwrite(STDERR, "Unprovisioned root marker remains in {$relative}.\n");
        exit(2);
    }
    $name = $packageRoot . $relative;
    if (!$zip->addFromString($name, $contents)) {
        $zip->close();
        @unlink($output);
        fwrite(STDERR, "Could not add {$relative} to the package.\n");
        exit(2);
    }
    if (method_exists($zip, 'setMtimeName')) {
        $zip->setMtimeName($name, $timestamp);
    }
}
if (!$rootFound || !$zip->close()) {
    @unlink($output);
    fwrite(STDERR, "The connector package could not be finalized with pinned root trust.\n");
    exit(2);
}

$archive = new ZipArchive();
if ($archive->open($output) !== true) {
    @unlink($output);
    fwrite(STDERR, "The connector package could not be reopened for validation.\n");
    exit(2);
}
$rootContents = $archive->getFromName($packageRoot . 'includes/RootTrust.php');
$archive->close();
if (!is_string($rootContents) || str_contains($rootContents, $marker) || !str_contains($rootContents, $encodedKey)) {
    @unlink($output);
    fwrite(STDERR, "Package validation refused an unprovisioned root-trust build.\n");
    exit(2);
}

fwrite(STDOUT, json_encode([
    'path' => realpath($output) ?: $output,
    'slug' => 'pagecraft-connector',
    'version' => $version,
    'license' => 'GPL-3.0-or-later',
    'packageBytes' => filesize($output),
    'packageHash' => hash_file('sha256', $output),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
