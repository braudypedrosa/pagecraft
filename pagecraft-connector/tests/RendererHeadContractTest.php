<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Renderer;
use ReflectionClass;
use ReflectionMethod;

final class RendererHeadContractTest extends ConnectorTestCase
{
    public function test_supported_signed_link_semantics_are_in_the_render_head_allowlist(): void
    {
        $renderer = (new ReflectionClass(Renderer::class))->newInstanceWithoutConstructor();
        $allowlist = (new ReflectionMethod(Renderer::class, 'headAllowlist'))->invoke($renderer);

        foreach (['rel', 'href', 'as', 'type', 'media', 'crossorigin', 'hreflang', 'sizes', 'color', 'imagesrcset', 'imagesizes', 'fetchpriority', 'referrerpolicy'] as $attribute) {
            $this->assertTrue($allowlist['link'][$attribute] ?? false, $attribute);
        }
        $source = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Renderer.php');
        $this->assertStringContainsString('fn (string $chunk): string => wp_kses($chunk, $this->headAllowlist())', $source);
        $this->assertStringContainsString('(?:[^>"\\\']+|"[^"]*"|\\\'[^\\\']*\\\')*', $source);
    }
}
