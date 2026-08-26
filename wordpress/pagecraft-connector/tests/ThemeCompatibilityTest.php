<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Preflight;
use ReflectionClass;

final class ThemeCompatibilityTest extends ConnectorTestCase
{
    public function test_pagecraft_theme_blocks_published_builder_or_theme_dependencies(): void
    {
        $GLOBALS['pagecraft_test_theme_dependency_ids'] = [12, 12, 29];
        $preflight = (new ReflectionClass(Preflight::class))->newInstanceWithoutConstructor();

        $result = $preflight->pagecraftThemeCompatibility('pagecraft-theme');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_preflight_theme_content_dependencies', $result->get_error_code());
        $this->assertStringContainsString('2 published item(s)', $result->get_error_message());
    }

    public function test_existing_theme_allows_the_same_content_without_mutating_it(): void
    {
        $GLOBALS['pagecraft_test_theme_dependency_ids'] = [12, 29];
        $before = $GLOBALS['pagecraft_test_theme_dependency_ids'];
        $preflight = (new ReflectionClass(Preflight::class))->newInstanceWithoutConstructor();

        $this->assertTrue($preflight->pagecraftThemeCompatibility('existing-theme'));
        $this->assertSame($before, $GLOBALS['pagecraft_test_theme_dependency_ids']);
    }
}
