<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\CmsWriteback;
use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\DeploymentLock;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\ReleaseRepository;
use ReflectionMethod;

final class CmsWritebackRaceTest extends ConnectorTestCase
{
    public function test_newer_local_row_arriving_during_request_supersedes_older_outcome(): void
    {
        $connection = $this->productionConnection();
        $database = new CmsRaceWpdb();
        $GLOBALS['wpdb'] = $database;
        $writes = [];
        $cms = new CmsWriteback(
            $connection,
            new HttpClient($connection),
            new ReleaseRepository(),
            static function (string $sourceId, array $payload, int $sequence, string $key) use ($database, &$writes): array {
                $writes[] = compact('sourceId', 'payload', 'sequence', 'key');
                // Simulate a newer editor save committing while row 11 is in flight.
                $database->newerId = 12;
                return [
                    'status' => 'applied',
                    'version' => 9,
                    'publishedVersion' => 8,
                    'writes' => [['collectionId' => 'news', 'itemId' => 'item-one', 'writeSequence' => 11]],
                ];
            }
        );

        $cms->process();

        $this->assertCount(1, $writes);
        $this->assertSame(11, $writes[0]['sequence']);
        $this->assertMatchesRegularExpression('/^wp-cms-11-[a-f0-9]{40}$/', $writes[0]['key']);
        $this->assertSame('superseded', $database->statuses[11]);
        $this->assertNotContains('sent', array_column($database->updates, 'status'));
        $this->assertStringContainsString('newer local draft row 12', $database->errors[11]);

        $method = new ReflectionMethod(CmsWriteback::class, 'idempotencyKey');
        $this->assertSame($writes[0]['key'], $method->invoke($cms, 'item-one', 11));
    }

    public function test_terminally_failed_newer_save_still_permanently_supersedes_older_retry(): void
    {
        $connection = $this->productionConnection();
        $database = new CmsRaceWpdb();
        $database->newerId = 12;
        $database->statuses[12] = 'failed';
        $GLOBALS['wpdb'] = $database;
        $writes = [];
        $cms = new CmsWriteback(
            $connection,
            new HttpClient($connection),
            new ReleaseRepository(),
            static function (string $sourceId, array $payload, int $sequence, string $key) use (&$writes): array {
                $writes[] = compact('sourceId', 'payload', 'sequence', 'key');
                return ['status' => 'applied'];
            }
        );

        $cms->process();

        $this->assertSame([], $writes, 'The older retry must never reach Pagecraft after any higher accepted local save.');
        $this->assertSame('superseded', $database->statuses[11]);
        $this->assertStringContainsString('newer private WordPress draft', $database->errors[11]);
        $this->assertNotSame([], $database->newerLookupQueries);
        $this->assertStringNotContainsString('status IN', $database->newerLookupQueries[0]);
    }

    public function test_removed_active_mapping_is_rechecked_before_any_transport(): void
    {
        $connection = $this->productionConnection();
        $database = new CmsRaceWpdb();
        $database->mappingActive = false;
        $GLOBALS['wpdb'] = $database;
        $writes = [];
        $cms = new CmsWriteback(
            $connection,
            new HttpClient($connection),
            new ReleaseRepository(),
            static function () use (&$writes): array {
                $writes[] = true;
                return ['status' => 'applied'];
            }
        );

        $cms->process();

        $this->assertSame([], $writes);
        $this->assertSame('failed', $database->statuses[11]);
        $this->assertStringContainsString('no longer an active CMS mapping', $database->errors[11]);
    }

    public function test_connection_epoch_change_between_mapping_check_and_transport_fails_closed(): void
    {
        $connection = $this->productionConnection();
        $database = new CmsRaceWpdb();
        $database->mappingLookupHook = static function (int $lookup) use ($connection): void {
            if ($lookup === 2) {
                $connection->advanceLifecycleFence();
            }
        };
        $GLOBALS['wpdb'] = $database;
        $writes = [];
        $cms = new CmsWriteback(
            $connection,
            new HttpClient($connection),
            new ReleaseRepository(),
            static function () use (&$writes): array {
                $writes[] = true;
                return ['status' => 'applied'];
            }
        );

        $cms->process();

        $this->assertSame([], $writes, 'A C1 draft must never be sent after the connection lifecycle advances to C2.');
        $this->assertSame('failed', $database->statuses[11]);
        $this->assertStringContainsString('connection changed', $database->errors[11]);
        $this->assertSame(2, $database->mappingLookups);
    }

    public function test_revocation_lifecycle_lease_prevents_cms_transport_and_frozen_retry_stays_closed(): void
    {
        $connection = $this->productionConnection();
        $database = new CmsRaceWpdb();
        $GLOBALS['wpdb'] = $database;
        $lock = $this->lock();
        $revocationLease = $lock->acquire('revocation');
        $this->assertIsArray($revocationLease);
        $writes = [];
        $cms = new CmsWriteback(
            $connection,
            new HttpClient($connection),
            new ReleaseRepository(),
            static function () use (&$writes): array {
                $writes[] = true;
                return ['status' => 'applied'];
            },
            null,
            null,
            $lock
        );

        $cms->process();
        $this->assertSame([], $writes, 'CMS cannot start while Disconnect owns the shared lifecycle lease.');
        $this->assertSame('queued', $database->statuses[11]);

        $lock->release($revocationLease);
        $this->assertIsString($connection->advanceLifecycleFence());
        $this->assertTrue($connection->freeze(false));
        $cms->process();
        $this->assertSame([], $writes, 'After Disconnect freezes the target, a delayed CMS retry remains fail-closed.');
    }

    private function productionConnection(): Connection
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'api_origin' => 'http://localhost:8787',
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'profile' => 'existing-theme',
            'environment' => 'production',
            'access_token' => Crypto::seal('access-secret-value'),
            'refresh_token' => Crypto::seal('refresh-secret-value'),
            'access_expires_at' => time() + HOUR_IN_SECONDS,
            'scopes' => ['cms:write'],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-active';
        $GLOBALS['pagecraft_test_posts'][77] = new \WP_Post(['ID' => 77, 'post_type' => 'pagecraft_entry']);
        $GLOBALS['pagecraft_test_post_meta'][77] = [
            '_pagecraft_managed' => '1',
            '_pagecraft_item_id' => 'item-one',
            '_pagecraft_collection_id' => 'news',
        ];
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

final class CmsRaceWpdb
{
    public string $prefix = 'wp_';
    public string $options = 'wp_options';
    public int $newerId = 0;
    public bool $mappingActive = true;
    public int $mappingLookups = 0;
    public ?\Closure $mappingLookupHook = null;
    /** @var array<int,string> */
    public array $statuses = [11 => 'queued'];
    /** @var array<int,string> */
    public array $errors = [];
    /** @var list<array<string,mixed>> */
    public array $updates = [];
    /** @var list<string> */
    public array $newerLookupQueries = [];
    /** @var list<mixed> */
    private array $args = [];

    /** @return array<string,mixed>|null */
    public function get_row(string $query, mixed $output = null): ?array
    {
        if (str_contains($query, 'pagecraft_objects')) {
            $this->mappingLookups++;
            if ($this->mappingLookupHook instanceof \Closure) {
                ($this->mappingLookupHook)($this->mappingLookups);
            }
            return $this->mappingActive ? [
                'deployment_id' => 'deployment-active',
                'source_type' => 'cms',
                'source_id' => 'item-one',
                'object_id' => 77,
                'state' => 'active',
            ] : null;
        }
        if (!str_contains($query, 'pagecraft_releases')) {
            return null;
        }
        return [
            'id' => 1,
            'deployment_id' => 'deployment-active',
            'release_id' => 'release-active',
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'sequence_no' => 1,
            'source_version' => 8,
            'status' => 'active',
            'manifest' => json_encode(['connectionId' => 'connection-unit', 'siteId' => 'site-unit'], JSON_THROW_ON_ERROR),
            'manifest_hash' => str_repeat('a', 64),
            'deployment_hash' => str_repeat('b', 64),
            'artifact_hash' => str_repeat('c', 64),
            'created_at' => '2026-08-26 00:00:00',
            'verified_at' => '2026-08-26 00:01:00',
        ];
    }

    public function prepare(string $query, mixed ...$args): string
    {
        $this->args = $args;
        return $query;
    }

    public function query(string $query): int|false
    {
        if (str_starts_with(ltrim($query), 'UPDATE wp_options SET option_value')) {
            $next = (string) ($this->args[0] ?? '');
            $optionName = (string) ($this->args[1] ?? '');
            $expected = (string) ($this->args[2] ?? '');
            $current = array_key_exists($optionName, $GLOBALS['pagecraft_test_options'])
                ? (string) maybe_serialize($GLOBALS['pagecraft_test_options'][$optionName])
                : null;
            if ($current === null || !hash_equals($expected, $current)) {
                return 0;
            }
            $GLOBALS['pagecraft_test_options'][$optionName] = maybe_unserialize($next);
            return 1;
        }
        return 1;
    }

    /** @param array<string,mixed> $data */
    public function insert(string $table, array $data, array $format = []): int|false
    {
        if ($table !== $this->options) {
            return 1;
        }
        $optionName = (string) ($data['option_name'] ?? '');
        if ($optionName === '' || array_key_exists($optionName, $GLOBALS['pagecraft_test_options'])) {
            return false;
        }
        $GLOBALS['pagecraft_test_options'][$optionName] = maybe_unserialize($data['option_value'] ?? '');
        return 1;
    }

    /** @return list<array<string,mixed>> */
    public function get_results(string $query, mixed $output = null): array
    {
        if (!str_contains($query, "status = 'queued'")) {
            return [];
        }
        return [[
            'id' => 11,
            'connection_id' => 'connection-unit',
            'source_id' => 'item-one',
            'post_id' => 77,
            'base_release_id' => 'release-active',
            'payload' => json_encode([
                'itemId' => 'item-one',
                'collectionId' => 'news',
                'baseVersion' => 8,
                'title' => 'Local title',
                'slug' => 'local-title',
                'body' => 'Body',
                'excerpt' => 'Excerpt',
                'values' => ['custom' => 'value'],
            ], JSON_THROW_ON_ERROR),
            'status' => 'queued',
            'attempts' => 0,
        ]];
    }

    public function get_var(string $query): mixed
    {
        if (str_contains($query, 'FROM wp_options') && str_contains($query, 'option_value')) {
            $optionName = (string) ($this->args[0] ?? '');
            return array_key_exists($optionName, $GLOBALS['pagecraft_test_options'])
                ? maybe_serialize($GLOBALS['pagecraft_test_options'][$optionName])
                : null;
        }
        if (str_contains($query, 'id > %d')) {
            $this->newerLookupQueries[] = $query;
            return $this->newerId ?: null;
        }
        return null;
    }

    /** @param array<string,mixed> $data @param array<string,mixed> $where */
    public function update(string $table, array $data, array $where, array $format = [], array $whereFormat = []): int|false
    {
        $id = (int) ($where['id'] ?? 0);
        if ($id === 11 && isset($where['status']) && $this->statuses[$id] !== $where['status']) {
            return 0;
        }
        if ($id > 0 && isset($data['status'])) {
            $this->statuses[$id] = (string) $data['status'];
            $this->updates[] = $data;
        }
        if ($id > 0 && isset($data['error_message'])) {
            $this->errors[$id] = (string) $data['error_message'];
        }
        return 1;
    }
}
