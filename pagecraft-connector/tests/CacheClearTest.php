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
use ReflectionMethod;

final class CacheClearTest extends ConnectorTestCase
{
    public function test_activation_cache_clear_calls_optional_integrations_and_hooks(): void
    {
        $connection = new Connection();
        $releases = new ReleaseRepository();
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $releases,
            new Mapper($releases)
        );
        $manifest = ['releaseId' => 'release-cache-unit', 'deploymentId' => 'deployment-cache-unit'];

        (new ReflectionMethod(Sync::class, 'clearKnownCaches'))->invoke($sync, $manifest, 'activation');

        $this->assertSame(
            ['object:posts', 'object:post_meta', 'wp-rocket', 'w3tc', 'wp-super-cache'],
            $GLOBALS['pagecraft_test_cache_calls']
        );
        $hooks = array_column($GLOBALS['pagecraft_test_actions'], 'hook');
        $this->assertContains('litespeed_purge_all', $hooks);
        $this->assertContains('pagecraft_connector_release_cache_cleared', $hooks);
        $pagecraft = $GLOBALS['pagecraft_test_actions'][array_search('pagecraft_connector_release_cache_cleared', $hooks, true)];
        $this->assertSame($manifest, $pagecraft['args'][0]);
        $this->assertSame('activation', $pagecraft['args'][1]);
        $this->assertSame([], $pagecraft['args'][2]);
    }
}
