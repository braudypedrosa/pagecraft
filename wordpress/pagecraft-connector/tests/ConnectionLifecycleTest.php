<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\DeploymentLock;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\ReleaseVerifier;
use Pagecraft\Connector\Revocation;
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\Sync;
use ReflectionMethod;

final class ConnectionLifecycleTest extends ConnectorTestCase
{
    public function test_revocation_advances_fence_before_server_request_and_invalidates_inflight_work(): void
    {
        $connection = $this->configuredConnection();
        $snapshot = $connection->lifecycleSnapshot();
        $this->assertIsArray($snapshot);
        $seenDuringDelete = null;
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function () use ($connection, $snapshot, &$seenDuringDelete): array {
                $seenDuringDelete = $connection->assertLifecycleSnapshot($snapshot);
                return [
                    'connectionId' => 'connection-unit',
                    'status' => 'revoked',
                    'revokedAt' => gmdate('c'),
                    'alreadyRevoked' => false,
                ];
            }
        );

        $result = $revocation->begin();

        $this->assertTrue($result);
        $this->assertInstanceOf(\WP_Error::class, $seenDuringDelete);
        $this->assertSame('pagecraft_connection_lifecycle_changed', $seenDuringDelete->get_error_code());
        $this->assertInstanceOf(\WP_Error::class, $connection->assertLifecycleSnapshot($snapshot));
        $this->assertSame('frozen', $connection->mode());
    }

    public function test_repair_fence_rejects_snapshot_from_previous_connection_epoch(): void
    {
        $connection = $this->configuredConnection();
        $old = $connection->lifecycleSnapshot();
        $this->assertIsArray($old);

        $advanced = $connection->advanceLifecycleFence();

        $this->assertIsString($advanced);
        $this->assertNotSame($old['token'], $advanced);
        $rejected = $connection->assertLifecycleSnapshot($old);
        $this->assertInstanceOf(\WP_Error::class, $rejected);
        $this->assertSame('pagecraft_connection_lifecycle_changed', $rejected->get_error_code());
    }

    public function test_inflight_sync_fence_is_lost_before_any_post_disconnect_repository_mutation(): void
    {
        $connection = $this->configuredConnection();
        $releases = new ReleaseRepository();
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $releases,
            new Mapper($releases),
            null,
            $this->lock()
        );
        $acquire = new ReflectionMethod(Sync::class, 'acquireLease');
        $guardMethod = new ReflectionMethod(Sync::class, 'fenceGuard');
        $heartbeat = new ReflectionMethod(Sync::class, 'heartbeat');
        $this->assertTrue($acquire->invoke($sync, 'sync'));

        $this->assertIsString($connection->advanceLifecycleFence());
        $guard = $guardMethod->invoke($sync);
        $guarded = $guard();
        $renewed = $heartbeat->invoke($sync);

        $this->assertInstanceOf(\WP_Error::class, $guarded);
        $this->assertSame('pagecraft_connection_lifecycle_changed', $guarded->get_error_code());
        $this->assertInstanceOf(\WP_Error::class, $renewed);
        $this->assertSame('pagecraft_connection_lifecycle_changed', $renewed->get_error_code());
    }

    public function test_lifecycle_assertion_bypasses_stale_per_request_option_cache(): void
    {
        $connection = $this->configuredConnection();
        $snapshot = $connection->lifecycleSnapshot();
        $this->assertIsArray($snapshot);
        $cached = $GLOBALS['pagecraft_test_options']['pagecraft_connection'];
        $durable = $cached;
        $durable['lifecycle_fence'] = 'abcdefghijklmnopqrstuvwxyz123456';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = $durable;
        $GLOBALS['pagecraft_test_cached_options']['pagecraft_connection'] = $cached;

        $this->assertSame($snapshot['token'], $connection->all()['lifecycle_fence'], 'The normal option API is intentionally stale in this regression.');
        $result = $connection->assertLifecycleSnapshot($snapshot);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_connection_lifecycle_changed', $result->get_error_code());
    }

    public function test_concurrent_installation_id_creation_uses_durable_winner(): void
    {
        $GLOBALS['pagecraft_test_add_option_handler'] = static function (string $name): ?bool {
            if ($name !== 'pagecraft_installation_id') {
                return null;
            }
            $GLOBALS['pagecraft_test_options'][$name] = 'installation-concurrent-winner';
            return false;
        };

        $this->assertSame('installation-concurrent-winner', (new Connection())->installationId());
    }

    public function test_installation_id_write_failure_stops_before_authorize_binding(): void
    {
        $GLOBALS['pagecraft_test_add_option_handler'] = static fn (string $name): ?bool => $name === 'pagecraft_installation_id' ? false : null;

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('durably initialize');
        (new Connection())->installationId();
    }

    private function configuredConnection(): Connection
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'api_origin' => 'http://localhost:8787',
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'profile' => 'existing-theme',
            'environment' => 'production',
            'access_token' => Crypto::seal('access-unit'),
            'refresh_token' => Crypto::seal('refresh-unit'),
            'access_expires_at' => time() + 900,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'lifecycle_fence' => '1234567890abcdefghijklmnopqrstuv',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
        return new Connection();
    }

    private function lock(): DeploymentLock
    {
        $raw = null;
        $state = [];
        $reader = static function () use (&$raw, &$state): array {
            return ['raw' => $raw, 'state' => $state];
        };
        $swap = static function (?string $expected, array $next) use (&$raw, &$state): bool {
            if ($expected !== $raw) {
                return false;
            }
            $state = $next;
            $raw = serialize($next);
            return true;
        };
        return new DeploymentLock($reader, $swap, static fn (): int => 1_000);
    }
}
