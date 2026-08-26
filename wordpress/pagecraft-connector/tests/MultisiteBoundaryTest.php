<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\ReleaseVerifier;
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\Sync;

final class MultisiteBoundaryTest extends ConnectorTestCase
{
    public function test_sync_fails_closed_on_multisite_before_network_or_mapping(): void
    {
        $GLOBALS['pagecraft_test_multisite'] = true;
        $connection = new Connection();
        $releases = new ReleaseRepository();
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $releases,
            new Mapper($releases)
        );

        $result = $sync->run(true);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_multisite_unsupported', $result->get_error_code());
    }

    public function test_activation_and_preflight_publish_the_same_blocking_boundary(): void
    {
        $activation = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Activation.php');
        $preflight = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Preflight.php');

        $this->assertStringContainsString('if (is_multisite())', $activation);
        $this->assertStringContainsString("'pagecraft_preflight_single_site', !is_multisite(), true", $preflight);
        $this->assertStringContainsString('single-site WordPress installations only', $activation);
        $this->assertStringContainsString('single-site WordPress installations only', $preflight);
    }
}
