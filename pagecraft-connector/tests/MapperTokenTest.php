<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\Support;
use ReflectionClass;
use ReflectionMethod;

final class MapperTokenTest extends ConnectorTestCase
{
    public function test_only_typed_asset_tokens_are_substituted(): void
    {
        $mapper = (new ReflectionClass(Mapper::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(Mapper::class, 'hydratePage');
        $page = [
            'pageId' => 'page-unit',
            'path' => '/managed/',
            'title' => 'Managed',
            'bodyKind' => 'content-fragment',
            'headOrder' => 'css-before-runtime',
            'headHtml' => '<meta content="pc-asset://asset-unit">',
            'bodyHtml' => '<img src="{{pagecraft-asset:asset-unit}}"><p>asset-unit</p><img src="assets/original.png">',
            'runtime' => '',
            'scripts' => [],
            'sourceHash' => str_repeat('a', 64),
            '_profile' => 'existing-theme',
            '_deploymentId' => 'deployment-unit:target:1',
            '_artifactHash' => str_repeat('b', 64),
        ];

        $result = $method->invoke($mapper, $page, [], ['asset-unit' => 'https://wp.test/uploads/local.webp']);
        $this->assertIsArray($result);
        $this->assertStringContainsString('https://wp.test/uploads/local.webp', $result['head_html']);
        $this->assertStringContainsString('https://wp.test/uploads/local.webp', $result['body_html']);
        $this->assertStringContainsString('<p>asset-unit</p>', $result['body_html']);
        $this->assertStringContainsString('assets/original.png', $result['body_html']);
        $marker = Support::releaseMarker('deployment-unit:target:1', str_repeat('b', 64));
        $this->assertTrue(Support::bodyHasReleaseMarker($result['body_html'], $marker));
    }

    public function test_release_marker_rejects_generic_and_stale_cached_release_html(): void
    {
        $current = Support::releaseMarker('deployment-current:target:9', str_repeat('c', 64));
        $previous = Support::releaseMarker('deployment-previous:target:8', str_repeat('d', 64));

        $this->assertNotSame($current, $previous);
        $this->assertFalse(Support::bodyHasReleaseMarker('<div class="pagecraft-root" data-pagecraft-release-root>Old</div>', $current));
        $this->assertFalse(Support::bodyHasReleaseMarker('<div class="pagecraft-root" data-pagecraft-release-root="' . $previous . '">Old</div>', $current));
        $this->assertTrue(Support::bodyHasReleaseMarker('<div data-pagecraft-release-root="' . $current . '" class="shell pagecraft-root">Current</div>', $current));

        $sync = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Sync.php');
        $this->assertStringContainsString('Support::bodyHasReleaseMarker($body, $expectedMarker)', $sync);
    }

    public function test_existing_theme_keeps_only_the_signed_main_inner_content(): void
    {
        $legacyShell = '<header><p>Pagecraft header</p></header><main id="pagecraft-main"><h1>Managed title</h1><p>Body</p></main><footer>Pagecraft footer</footer>';
        $normalized = Support::existingThemeBody($legacyShell);

        $this->assertSame(1, substr_count($normalized, 'pagecraft-root'));
        $this->assertSame(0, substr_count(strtolower($normalized), '<main'));
        $this->assertSame(0, substr_count(strtolower($normalized), '<header'));
        $this->assertSame(0, substr_count(strtolower($normalized), '<footer'));
        $this->assertSame(1, substr_count(strtolower($normalized), '<h1'));
        $this->assertStringContainsString('<h1>Managed title</h1><p>Body</p>', $normalized);

        $this->assertSame(
            $normalized,
            Support::existingThemeBody('<div class="pagecraft-root" data-pagecraft-release-root>' . $legacyShell . '</div>')
        );
    }
}
