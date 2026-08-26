<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Stager;
use ReflectionMethod;

final class StagerFilenameTest extends ConnectorTestCase
{
    public function test_max_contract_asset_name_is_content_addressed_and_filesystem_safe(): void
    {
        $method = new ReflectionMethod(Stager::class, 'stagedAssetFilename');
        $assetId = 'asset-' . str_repeat('a', 44);
        $hash = str_repeat('b', 64);
        $long = str_repeat('photo-', 25) . '世界世界世界.webp';

        $component = $method->invoke(new Stager(), $assetId, $hash, $long);

        $this->assertIsString($component);
        $this->assertLessThanOrEqual(240, strlen($component));
        $this->assertStringStartsWith($assetId . '-' . substr($hash, 0, 12) . '-', $component);
        $this->assertStringEndsWith('.webp', $component);
        $this->assertSame(1, preg_match('//u', $component));
        $this->assertStringNotContainsString('/', $component);
    }

    public function test_short_safe_filename_remains_stable(): void
    {
        $method = new ReflectionMethod(Stager::class, 'stagedAssetFilename');
        $component = $method->invoke(new Stager(), 'hero', str_repeat('c', 64), 'homepage-hero.webp');

        $this->assertSame('hero-' . str_repeat('c', 12) . '-homepage-hero.webp', $component);
    }

    public function test_utf8_truncation_never_splits_a_multibyte_character(): void
    {
        $method = new ReflectionMethod(Stager::class, 'truncateUtf8Bytes');
        $truncated = $method->invoke(new Stager(), 'photo-世界.webp', 10);

        $this->assertSame('photo-世', $truncated);
        $this->assertSame(1, preg_match('//u', $truncated));
        $this->assertLessThanOrEqual(10, strlen($truncated));
    }
}
