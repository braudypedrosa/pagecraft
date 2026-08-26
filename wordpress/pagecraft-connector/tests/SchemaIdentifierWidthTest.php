<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\Schema;

final class SchemaIdentifierWidthTest extends ConnectorTestCase
{
    public function test_full_96_character_page_id_survives_route_storage_contract(): void
    {
        $pageId = 'p' . str_repeat('a', 95);
        $repository = new ReleaseRepository();

        $stored = $repository->replaceRoutes('release-unit:target:1', [[
            'route_path' => '/managed/',
            'page_id' => $pageId,
            'title' => 'Managed',
            'description' => '',
            'head_html' => '',
            'body_html' => '<p>Managed</p>',
            'content_hash' => str_repeat('b', 64),
            'seo' => [],
            'scripts' => [],
        ]]);

        $this->assertTrue($stored);
        $this->assertCount(1, $GLOBALS['wpdb']->routeInserts);
        $this->assertSame($pageId, $GLOBALS['wpdb']->routeInserts[0]['page_id']);
        $this->assertSame(96, strlen($GLOBALS['wpdb']->routeInserts[0]['page_id']));

        $rejected = $repository->replaceRoutes('release-unit:target:2', [[
            'route_path' => '/too-long/',
            'page_id' => 'p' . str_repeat('b', 96),
        ]]);
        $this->assertInstanceOf(\WP_Error::class, $rejected);
        $this->assertSame('pagecraft_route_page_id', $rejected->get_error_code());
    }

    public function test_dbdelta_schema_widens_all_protocol_release_and_page_identifiers(): void
    {
        $source = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Schema.php');

        $this->assertSame('1.7.0', Schema::VERSION);
        $this->assertStringContainsString('page_id varchar(96) NOT NULL', $source);
        $this->assertStringContainsString('parent_release_id varchar(96) NULL', $source);
        $this->assertStringContainsString('base_release_id varchar(96) NOT NULL', $source);
        $this->assertStringNotContainsString('release_id varchar(64)', $source);
    }
}
