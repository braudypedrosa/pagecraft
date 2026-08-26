<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\Schema;

final class SchemaMigrationTest extends ConnectorTestCase
{
    public function test_failed_legacy_binding_backfill_does_not_bump_version_and_next_install_retries(): void
    {
        $deploymentId = 'legacy-deployment-unit';
        $GLOBALS['wpdb']->releaseRows[$deploymentId] = [
            'id' => 41,
            'deployment_id' => $deploymentId,
            'release_id' => 'legacy-release-unit',
            'connection_id' => '',
            'site_id' => '',
            'sequence_no' => 8,
            'status' => 'active',
            'verified_at' => '2026-08-26 00:00:00',
            'manifest' => json_encode([
                'connectionId' => 'connection-migrated',
                'siteId' => 'site-migrated',
            ], JSON_THROW_ON_ERROR),
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $deploymentId;
        $GLOBALS['pagecraft_test_options']['pagecraft_schema_version'] = '1.6.0';
        $GLOBALS['pagecraft_test_fail_release_backfill'] = true;

        $failed = Schema::install();

        $this->assertFalse($failed);
        $this->assertSame('1.6.0', get_option('pagecraft_schema_version'));
        $this->assertSame('', $GLOBALS['wpdb']->releaseRows[$deploymentId]['connection_id']);
        $fallback = (new ReleaseRepository())->active();
        $this->assertSame('connection-migrated', $fallback['connection_id']);
        $this->assertSame('site-migrated', $fallback['site_id']);

        $GLOBALS['pagecraft_test_fail_release_backfill'] = false;
        $retried = Schema::install();

        $this->assertTrue($retried);
        $this->assertSame(Schema::VERSION, get_option('pagecraft_schema_version'));
        $this->assertSame('connection-migrated', $GLOBALS['wpdb']->releaseRows[$deploymentId]['connection_id']);
        $this->assertSame('site-migrated', $GLOBALS['wpdb']->releaseRows[$deploymentId]['site_id']);
        $this->assertSame($deploymentId, (new ReleaseRepository())->active()['deployment_id']);
    }

    public function test_missing_dbdelta_column_or_index_fails_closed_before_version_bump_and_boot_hooks(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_schema_version'] = '1.6.0';
        $GLOBALS['pagecraft_test_missing_schema_column'] = 'wp_pagecraft_releases.connection_id';

        $this->assertFalse(Schema::install());
        $this->assertSame('1.6.0', get_option('pagecraft_schema_version'));

        $GLOBALS['pagecraft_test_missing_schema_column'] = '';
        $GLOBALS['pagecraft_test_missing_schema_index'] = 'wp_pagecraft_cms_drafts.queue';
        $this->assertFalse(Schema::install());
        $this->assertSame('1.6.0', get_option('pagecraft_schema_version'));

        $GLOBALS['pagecraft_test_missing_schema_index'] = '';
        $this->assertTrue(Schema::install());
        $this->assertSame(Schema::VERSION, get_option('pagecraft_schema_version'));

        $plugin = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Plugin.php');
        $activation = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Activation.php');
        $this->assertStringContainsString('if (!$schemaReady)', $plugin);
        $this->assertStringContainsString("add_action('admin_notices'", $plugin);
        $this->assertStringContainsString('if (!Schema::install())', $activation);
        $this->assertStringContainsString('deactivate_plugins', $activation);
    }
}
