<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\DeploymentLock;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ManagedPages;
use Pagecraft\Connector\CmsWriteback;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\ReleaseVerifier;
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\Support;
use Pagecraft\Connector\Sync;

final class ConnectionScopeTest extends ConnectorTestCase
{
    public function test_fresh_connection_sequence_is_independent_and_reused_local_id_is_scoped(): void
    {
        $repository = new ReleaseRepository();
        $old = $this->manifest('connection-old', 'site-old', 'release-shared', 10);
        $this->assertTrue($repository->stage($old));

        $new = $this->manifest('connection-new', 'site-new', 'release-new', 1);
        $this->assertTrue($repository->stage($new));
        $this->assertSame(10, $repository->latest('connection-old')['sequence']);
        $this->assertSame(1, $repository->latest('connection-new')['sequence']);

        $reused = $this->manifest('connection-new', 'site-new', 'release-shared', 10);
        $scoped = $repository->scopeDeploymentId($reused);
        $this->assertIsArray($scoped);
        $this->assertNotSame($old['deploymentId'], $scoped['deploymentId']);
        $this->assertStringStartsWith($old['deploymentId'] . ':c:', $scoped['deploymentId']);
    }

    public function test_emergency_rollback_rejects_verified_release_from_previous_connection(): void
    {
        $this->configure('connection-new', 'site-new');
        $old = $this->manifest('connection-old', 'site-old', 'release-old', 9);
        $GLOBALS['wpdb']->releaseRows[$old['deploymentId']] = $this->row($old, 'retained', true);
        $repository = new ReleaseRepository();
        $connection = new Connection();
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $repository,
            new Mapper($repository)
        );

        $result = $sync->emergencyRollback($old['deploymentId']);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_rollback_unavailable', $result->get_error_code());
        $this->assertSame([], get_option(Connection::EMERGENCY_ROLLBACK_OPTION, []));
    }

    public function test_first_sync_after_repair_treats_old_active_release_only_as_public_fallback(): void
    {
        $this->configure('connection-new', 'site-new');
        $old = $this->manifest('connection-old', 'site-old', 'release-old', 10);
        $GLOBALS['wpdb']->releaseRows[$old['deploymentId']] = $this->row($old, 'active', true);
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $old['deploymentId'];
        $acknowledgements = [];
        $desiredCalls = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function () use (&$desiredCalls): array {
            $desiredCalls++;
            return ['response' => ['code' => 204], 'headers' => [], 'body' => ''];
        };
        $repository = new ReleaseRepository();
        $connection = new Connection();
        $lockState = ['raw' => null, 'state' => []];
        $lock = new DeploymentLock(
            static function () use (&$lockState): array {
                return $lockState;
            },
            static function (?string $expected, array $next) use (&$lockState): bool {
                if ($expected !== $lockState['raw']) {
                    return false;
                }
                $lockState = ['raw' => serialize($next), 'state' => $next];
                return true;
            },
            static fn (): int => time()
        );
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $repository,
            new Mapper($repository),
            static function (array $payload) use (&$acknowledgements): array {
                $acknowledgements[] = $payload;
                return ['status' => (string) $payload['status']];
            },
            $lock
        );

        $result = $sync->run(false);

        $this->assertIsArray($result);
        $this->assertSame('current', $result['status']);
        $this->assertSame(1, $desiredCalls);
        $this->assertSame([], $acknowledgements, 'The new connection must never acknowledge the old connection\'s active fallback.');
        $this->assertSame($old['deploymentId'], get_option('pagecraft_active_release_id'));
    }

    public function test_webhook_and_cms_queues_are_connection_scoped_in_schema_and_queries(): void
    {
        $schema = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Schema.php');
        $rest = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/RestApi.php');
        $cms = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/CmsWriteback.php');

        $this->assertStringContainsString('connection_sequence (connection_id,sequence_no)', $schema);
        $this->assertStringContainsString('KEY queue (connection_id,status,available_at)', $schema);
        $this->assertStringContainsString('MAX(sequence_no) FROM {$table} WHERE connection_id = %s', $rest);
        $this->assertStringContainsString("WHERE connection_id = %s AND status = 'queued'", $cms);
        $this->assertStringContainsString('connection_id = %s AND source_id = %s', $cms);
    }

    public function test_retention_keeps_last_five_verified_releases_from_current_connection_epoch(): void
    {
        $repository = new ReleaseRepository();
        for ($sequence = 96; $sequence <= 100; $sequence++) {
            $manifest = $this->manifest('connection-old', 'site-old', 'release-old-' . $sequence, $sequence);
            $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->row($manifest, 'retained', true);
        }
        for ($sequence = 1; $sequence <= 6; $sequence++) {
            $manifest = $this->manifest('connection-new', 'site-new', 'release-new-' . $sequence, $sequence);
            $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->row($manifest, $sequence === 6 ? 'active' : 'retained', true);
        }
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'release-new-6:target:6';

        $retained = $repository->retain(5, static fn (): bool => true, 'connection-new', 'site-new');

        $this->assertTrue($retained);
        for ($sequence = 2; $sequence <= 6; $sequence++) {
            $this->assertArrayHasKey('release-new-' . $sequence . ':target:' . $sequence, $GLOBALS['wpdb']->releaseRows);
        }
        $this->assertArrayNotHasKey('release-new-1:target:1', $GLOBALS['wpdb']->releaseRows);
        foreach (range(96, 100) as $sequence) {
            $this->assertArrayNotHasKey('release-old-' . $sequence . ':target:' . $sequence, $GLOBALS['wpdb']->releaseRows);
        }
    }

    public function test_retention_rolls_back_every_release_mapping_when_any_delete_boundary_fails(): void
    {
        foreach (['pagecraft_routes', 'pagecraft_redirects', 'pagecraft_objects', 'pagecraft_releases'] as $failedTable) {
            $GLOBALS['wpdb'] = new \PagecraftTestWpdb();
            $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'release-new-6:target:6';
            $repository = new ReleaseRepository();
            for ($sequence = 1; $sequence <= 6; $sequence++) {
                $manifest = $this->manifest('connection-new', 'site-new', 'release-new-' . $sequence, $sequence);
                $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->row(
                    $manifest,
                    $sequence === 6 ? 'active' : 'retained',
                    true
                );
            }
            $candidate = 'release-new-1:target:1';
            $GLOBALS['wpdb']->routeRows[] = ['release_id' => $candidate, 'route_path' => '/retained/'];
            $GLOBALS['wpdb']->redirectRows[] = ['release_id' => $candidate, 'from_path' => '/retained.html'];
            $GLOBALS['wpdb']->objectRows[] = [
                'deployment_id' => $candidate,
                'source_type' => 'cms',
                'source_id' => 'retained-item',
                'object_id' => 77,
                'state' => 'active',
            ];
            $beforeReleases = $GLOBALS['wpdb']->releaseRows;
            $beforeRoutes = $GLOBALS['wpdb']->routeRows;
            $beforeRedirects = $GLOBALS['wpdb']->redirectRows;
            $beforeObjects = $GLOBALS['wpdb']->objectRows;
            $GLOBALS['wpdb']->failRetentionDeleteTable = $failedTable;

            $result = $repository->retain(5, static fn (): bool => true, 'connection-new', 'site-new');

            $this->assertInstanceOf(\WP_Error::class, $result, $failedTable);
            $this->assertSame('pagecraft_retention_transaction', $result->get_error_code(), $failedTable);
            $this->assertSame($beforeReleases, $GLOBALS['wpdb']->releaseRows, $failedTable . ' release rollback');
            $this->assertSame($beforeRoutes, $GLOBALS['wpdb']->routeRows, $failedTable . ' route rollback');
            $this->assertSame($beforeRedirects, $GLOBALS['wpdb']->redirectRows, $failedTable . ' redirect rollback');
            $this->assertSame($beforeObjects, $GLOBALS['wpdb']->objectRows, $failedTable . ' object rollback');
        }
    }

    public function test_retention_uses_a_narrow_trusted_scope_to_delete_unreferenced_managed_records_and_assets(): void
    {
        $repository = new ReleaseRepository();
        $connection = new Connection();
        (new ManagedPages($connection))->hooks();
        (new CmsWriteback($connection, new HttpClient($connection), $repository))->hooks();
        for ($sequence = 1; $sequence <= 6; $sequence++) {
            $manifest = $this->manifest('connection-new', 'site-new', 'release-new-' . $sequence, $sequence);
            $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->row(
                $manifest,
                $sequence === 6 ? 'active' : 'retained',
                true
            );
        }
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'release-new-6:target:6';
        $candidate = 'release-new-1:target:1';
        foreach ([[77, 'pagecraft_entry', 'cms'], [78, 'attachment', 'asset']] as [$postId, $postType, $sourceType]) {
            $GLOBALS['pagecraft_test_posts'][$postId] = new \WP_Post(['ID' => $postId, 'post_type' => $postType]);
            $GLOBALS['pagecraft_test_post_meta'][$postId] = ['_pagecraft_managed' => '1'];
            $GLOBALS['wpdb']->objectRows[] = [
                'deployment_id' => $candidate,
                'source_type' => $sourceType,
                'source_id' => $sourceType . '-one',
                'object_id' => $postId,
                'state' => 'active',
            ];
        }

        $this->assertFalse(wp_delete_post(77, true), 'An administrator cannot delete a managed CMS record directly.');
        $this->assertFalse(wp_delete_attachment(78, true), 'An administrator cannot delete an asset referenced by a retained release.');

        $GLOBALS['pagecraft_test_posts'][79] = new \WP_Post(['ID' => 79, 'post_type' => 'attachment']);
        $GLOBALS['pagecraft_test_post_meta'][79] = ['_pagecraft_managed' => '1'];
        $GLOBALS['wpdb']->objectRows[] = [
            'deployment_id' => 'release-new-6:target:6',
            'source_type' => 'asset',
            'source_id' => 'active-asset',
            'object_id' => 79,
            'state' => 'active',
        ];
        $GLOBALS['pagecraft_test_filters']['pre_delete_post'][] = static function (mixed $delete, \WP_Post $post): mixed {
            if ($post->ID === 77) {
                wp_delete_attachment(79, true);
            }
            return $delete;
        };

        $retained = $repository->retain(5, static fn (): bool => true, 'connection-new', 'site-new');

        $this->assertTrue($retained);
        $this->assertNull(get_post(77));
        $this->assertNull(get_post(78));
        $this->assertInstanceOf(\WP_Post::class, get_post(79), 'A nested delete cannot borrow the trusted scope of another object.');
        $this->assertSame([['id' => 77, 'force' => true, 'trusted' => true]], $GLOBALS['pagecraft_test_deleted_posts']);
        $this->assertSame([['id' => 78, 'force' => true, 'trusted' => true]], $GLOBALS['pagecraft_test_deleted_attachments']);
        $this->assertFalse(ReleaseRepository::isDeletingManagedObject(), 'The trusted deletion scope must always close after pruning.');
    }

    public function test_reference_query_failures_block_direct_and_retention_deletion(): void
    {
        $repository = new ReleaseRepository();
        $connection = new Connection();
        (new ManagedPages($connection))->hooks();
        for ($sequence = 1; $sequence <= 6; $sequence++) {
            $manifest = $this->manifest('connection-new', 'site-new', 'release-new-' . $sequence, $sequence);
            $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->row(
                $manifest,
                $sequence === 6 ? 'active' : 'retained',
                true
            );
        }
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'release-new-6:target:6';
        $GLOBALS['pagecraft_test_posts'][81] = new \WP_Post(['ID' => 81, 'post_type' => 'attachment']);
        $GLOBALS['pagecraft_test_post_meta'][81] = ['_pagecraft_managed' => '1'];
        $GLOBALS['wpdb']->objectRows[] = [
            'deployment_id' => 'release-new-1:target:1',
            'source_type' => 'asset',
            'source_id' => 'candidate-asset',
            'object_id' => 81,
            'state' => 'active',
        ];
        $GLOBALS['wpdb']->failObjectReferenceCountIds = [81];

        $this->assertFalse(wp_delete_attachment(81, true), 'A failed reference query must block direct attachment deletion.');

        $retained = $repository->retain(5, static fn (): bool => true, 'connection-new', 'site-new');

        $this->assertInstanceOf(\WP_Error::class, $retained);
        $this->assertSame('pagecraft_retention_reference_check', $retained->get_error_code());
        $this->assertInstanceOf(\WP_Post::class, get_post(81));
        $this->assertSame([], $GLOBALS['pagecraft_test_deleted_attachments']);
        $this->assertFalse(ReleaseRepository::isDeletingManagedObject());
    }

    /** @return array<string,mixed> */
    private function manifest(string $connectionId, string $siteId, string $releaseId, int $sequence): array
    {
        return [
            'releaseId' => $releaseId,
            'deploymentId' => $releaseId . ':target:' . $sequence,
            'connectionId' => $connectionId,
            'siteId' => $siteId,
            'sequence' => $sequence,
            'sourceVersion' => $sequence,
            'artifactHash' => hash('sha256', $releaseId . ':artifact'),
            '_manifestHash' => hash('sha256', $releaseId . ':manifest'),
            '_deploymentHash' => hash('sha256', $connectionId . ':' . $releaseId),
            'createdAt' => '2026-08-26T00:00:00Z',
        ];
    }

    /** @param array<string,mixed> $manifest @return array<string,mixed> */
    private function row(array $manifest, string $status, bool $verified): array
    {
        return [
            'id' => (int) $manifest['sequence'],
            'deployment_id' => (string) $manifest['deploymentId'],
            'release_id' => (string) $manifest['releaseId'],
            'connection_id' => (string) $manifest['connectionId'],
            'site_id' => (string) $manifest['siteId'],
            'sequence_no' => (int) $manifest['sequence'],
            'source_version' => (int) $manifest['sourceVersion'],
            'status' => $status,
            'manifest' => Support::json($manifest),
            'manifest_hash' => (string) $manifest['_manifestHash'],
            'deployment_hash' => (string) $manifest['_deploymentHash'],
            'artifact_hash' => (string) $manifest['artifactHash'],
            'created_at' => '2026-08-26 00:00:00',
            'verified_at' => $verified ? '2026-08-26 00:01:00' : null,
        ];
    }

    private function configure(string $connectionId, string $siteId): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => $connectionId,
            'site_id' => $siteId,
            'api_origin' => 'http://localhost:8787',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-scope',
            'environment' => 'staging',
            'profile' => 'existing-theme',
            'scopes' => ['release:read', 'deploy:ack'],
            'access_token' => Crypto::seal('access-scope'),
            'refresh_token' => Crypto::seal('refresh-scope'),
            'access_expires_at' => time() + HOUR_IN_SECONDS,
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-scope';
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
    }
}
