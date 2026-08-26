<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseRepository;
use ReflectionMethod;

final class SvgImportTest extends ConnectorTestCase
{
    public function test_valid_static_svg_enters_media_library_without_changing_signed_bytes(): void
    {
        $bytes = <<<'SVG'
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs><linearGradient id="paint"><stop offset="0" stop-color="#111311"/></linearGradient></defs>
  <rect width="32" height="32" fill="url(#paint)"/>
</svg>
SVG;
        $source = $this->temporarySvg($bytes);
        $asset = [
            'assetId' => 'safe-logo',
            'filename' => 'safe-logo.svg',
            'mime' => 'image/svg+xml',
            'bytes' => strlen($bytes),
            'hash' => hash('sha256', $bytes),
            'title' => 'Safe logo',
            'alt' => 'Pagecraft logo',
        ];

        $attachment = (new ReflectionMethod(Mapper::class, 'importAttachment'))->invoke(
            new Mapper(new ReleaseRepository()),
            $asset,
            $source
        );

        $this->assertIsInt($attachment, is_wp_error($attachment) ? $attachment->get_error_message() : '');
        $record = $GLOBALS['pagecraft_test_attachments'][$attachment];
        $this->assertSame('image/svg+xml', $record['args']['post_mime_type']);
        $this->assertSame('pagecraft_staged', $record['args']['post_status']);
        $this->assertNotSame($source, $record['file']);
        $this->assertSame($bytes, file_get_contents((string) $record['file']));
        $this->assertSame(hash_file('sha256', $source), hash_file('sha256', (string) $record['file']));
        $this->assertSame('1', $GLOBALS['pagecraft_test_post_meta'][$attachment]['_pagecraft_managed']);
        $this->assertSame('safe-logo', $GLOBALS['pagecraft_test_post_meta'][$attachment]['_pagecraft_asset_id']);
    }

    /** @dataProvider maliciousSvgProvider */
    public function test_malicious_or_externally_loaded_svg_is_rejected_before_import(string $bytes, string $expectedCode): void
    {
        $source = $this->temporarySvg($bytes);
        $result = (new ReflectionMethod(Mapper::class, 'importAttachment'))->invoke(
            new Mapper(new ReleaseRepository()),
            [
                'assetId' => 'malicious-vector',
                'filename' => 'malicious-vector.svg',
                'mime' => 'image/svg+xml',
                'bytes' => strlen($bytes),
                'hash' => hash('sha256', $bytes),
            ],
            $source
        );

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame($expectedCode, $result->get_error_code());
        $this->assertSame([], $GLOBALS['pagecraft_test_attachments']);
    }

    /** @return iterable<string,array{string,string}> */
    public static function maliciousSvgProvider(): iterable
    {
        yield 'script' => ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'pagecraft_svg_active_element'];
        yield 'foreign object' => ['<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>HTML</div></foreignObject></svg>', 'pagecraft_svg_active_element'];
        yield 'remote image' => ['<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/pixel"/></svg>', 'pagecraft_svg_active_element'];
        yield 'numeric event handler' => ['<svg xmlns="http://www.w3.org/2000/svg"><path o&#x6e;load="alert(1)" d="M0 0"/></svg>', 'pagecraft_svg_event'];
        yield 'remote paint URL' => ['<svg xmlns="http://www.w3.org/2000/svg"><path fill="url(https://evil.example/p.svg#x)"/></svg>', 'pagecraft_svg_url'];
        yield 'executable style' => ['<svg xmlns="http://www.w3.org/2000/svg"><path style="behavior:url(#x)"/></svg>', 'pagecraft_svg_css'];
        yield 'DTD entity' => ['<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>', 'pagecraft_svg_xml'];
    }

    public function test_svg_import_rejects_signed_hash_or_byte_count_drift(): void
    {
        $bytes = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
        $source = $this->temporarySvg($bytes);
        $mapper = new Mapper(new ReleaseRepository());
        $method = new ReflectionMethod(Mapper::class, 'importAttachment');
        $asset = [
            'assetId' => 'drifted-vector', 'filename' => 'drifted.svg', 'mime' => 'image/svg+xml',
            'bytes' => strlen($bytes), 'hash' => str_repeat('0', 64),
        ];

        $hash = $method->invoke($mapper, $asset, $source);
        $this->assertInstanceOf(\WP_Error::class, $hash);
        $this->assertSame('pagecraft_asset_hash', $hash->get_error_code());

        $asset['hash'] = hash('sha256', $bytes);
        $asset['bytes']++;
        $length = $method->invoke($mapper, $asset, $source);
        $this->assertInstanceOf(\WP_Error::class, $length);
        $this->assertSame('pagecraft_asset_bytes', $length->get_error_code());
    }

    public function test_local_filename_extension_is_derived_from_signed_mime(): void
    {
        $mapper = new Mapper(new ReleaseRepository());
        $method = new ReflectionMethod(Mapper::class, 'safeAssetFilename');

        $this->assertSame('hero-photo.png', $method->invoke($mapper, 'hero-photo.jpg', 'image/png', 'hero'));
        $this->assertSame('hero-photo.webp', $method->invoke($mapper, 'hero-photo', 'image/webp', 'hero'));
        $this->assertSame('hero-photo.svg', $method->invoke($mapper, 'hero-photo.png', 'image/svg+xml', 'hero'));

        $bytes = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
        $source = $this->temporarySvg($bytes);
        $attachment = (new ReflectionMethod(Mapper::class, 'importAttachment'))->invoke($mapper, [
            'assetId' => 'no-extension-vector',
            'filename' => 'signed-vector-without-extension',
            'mime' => 'image/svg+xml',
            'bytes' => strlen($bytes),
            'hash' => hash('sha256', $bytes),
        ], $source);
        $this->assertIsInt($attachment, is_wp_error($attachment) ? $attachment->get_error_message() : '');
        $this->assertStringEndsWith('.svg', (string) $GLOBALS['pagecraft_test_attachments'][$attachment]['file']);
        $this->assertSame($bytes, file_get_contents((string) $GLOBALS['pagecraft_test_attachments'][$attachment]['file']));
    }

    private function temporarySvg(string $bytes): string
    {
        $directory = trailingslashit((string) $GLOBALS['pagecraft_test_uploads']) . 'signed';
        wp_mkdir_p($directory);
        $file = trailingslashit($directory) . hash('sha256', $bytes . microtime(true)) . '.svg';
        file_put_contents($file, $bytes);
        return $file;
    }
}
