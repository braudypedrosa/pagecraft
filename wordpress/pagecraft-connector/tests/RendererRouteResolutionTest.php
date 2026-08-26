<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Forms;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\Renderer;
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\Seo;

final class RendererRouteResolutionTest extends ConnectorTestCase
{
    public function test_existing_theme_resolves_a_nested_signed_route_without_a_native_parent_page(): void
    {
        $renderer = $this->renderer('existing-theme');
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['REQUEST_URI'] = '/nested/about/';
        $query = new \WP_Query(true);

        $renderer->resolveExistingThemeRoute($query);

        $this->assertSame(42, $query->get('page_id'));
        $this->assertSame('page', $query->get('post_type'));
        $this->assertSame('', $query->get('pagename'));
        $this->assertTrue($query->is_page);
        $this->assertTrue($query->is_singular);
        $this->assertFalse($query->is_home);
        $this->assertFalse($query->is_404);
        $this->assertSame(
            'http://localhost:8088/nested/about/',
            $renderer->managedPageLink('http://localhost:8088/about/', 42, false)
        );
        $this->assertFalse($renderer->preserveManagedRequestUrl(
            'http://localhost:8088/about/',
            'http://localhost:8088/nested/about/'
        ));
    }

    public function test_unknown_and_non_main_requests_keep_native_wordpress_routing(): void
    {
        $renderer = $this->renderer('existing-theme');
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['REQUEST_URI'] = '/unknown/';
        $query = new \WP_Query(true);
        $renderer->resolveExistingThemeRoute($query);
        $this->assertNull($query->get('page_id'));
        $this->assertTrue($query->is_404);
        $this->assertSame(
            'http://localhost:8088/native/',
            $renderer->preserveManagedRequestUrl('http://localhost:8088/native/', 'http://localhost:8088/unknown/')
        );

        $_SERVER['REQUEST_URI'] = '/nested/about/';
        $secondary = new \WP_Query(false);
        $renderer->resolveExistingThemeRoute($secondary);
        $this->assertNull($secondary->get('page_id'));
    }

    private function renderer(string $profile): Renderer
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-route-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = ['profile' => $profile];
        $GLOBALS['pagecraft_test_post_meta'][42]['_pagecraft_managed'] = '1';
        $GLOBALS['wpdb']->routeRows = [[
            'id' => 1,
            'release_id' => 'deployment-route-unit',
            'route_path' => '/nested/about/',
            'page_id' => 'page-about',
            'post_id' => 42,
            'title' => 'About',
            'description' => '',
            'head_html' => '',
            'body_html' => '<div>About</div>',
            'content_hash' => str_repeat('a', 64),
            'source_hash' => str_repeat('b', 64),
            'status' => 'publish',
            'seo_json' => '{}',
            'scripts_json' => '{}',
        ]];
        $connection = new Connection();
        $releases = new ReleaseRepository();
        return new Renderer(
            $releases,
            new ScriptApprovals(),
            new Forms($connection),
            new Seo($releases, $connection),
            $connection
        );
    }
}
