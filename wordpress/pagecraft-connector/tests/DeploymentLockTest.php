<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\DeploymentLock;

final class DeploymentLockTest extends ConnectorTestCase
{
    public function test_expired_worker_is_fenced_and_cannot_renew_or_release_new_owner(): void
    {
        $now = 1_000;
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
        $lock = new DeploymentLock($reader, $swap, static function () use (&$now): int { return $now; });

        $first = $lock->acquire('sync');
        $this->assertIsArray($first);
        $this->assertSame(1, $first['fence']);
        $blocked = $lock->acquire('rollback');
        $this->assertInstanceOf(\WP_Error::class, $blocked);
        $this->assertSame('pagecraft_sync_locked', $blocked->get_error_code());

        $now = $first['expires'] + 1;
        $second = $lock->acquire('rollback');
        $this->assertIsArray($second);
        $this->assertSame(2, $second['fence']);
        $this->assertSame('rollback', $state['purpose']);

        $lost = $lock->renew($first);
        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame('pagecraft_deployment_lock_lost', $lost->get_error_code());
        $lock->release($first);
        $this->assertSame($second['token'], $state['token'], 'An expired worker must not release the newer owner.');
        $this->assertTrue($lock->assertOwned($second));
    }

    public function test_renewal_preserves_fence_and_release_preserves_monotonic_counter(): void
    {
        $now = 2_000;
        $raw = null;
        $state = [];
        $reader = static function () use (&$raw, &$state): array { return ['raw' => $raw, 'state' => $state]; };
        $swap = static function (?string $expected, array $next) use (&$raw, &$state): bool {
            if ($expected !== $raw) {
                return false;
            }
            $state = $next;
            $raw = serialize($next);
            return true;
        };
        $lock = new DeploymentLock($reader, $swap, static function () use (&$now): int { return $now; });

        $lease = $lock->acquire('sync');
        $this->assertIsArray($lease);
        $now += 120;
        $renewed = $lock->renew($lease);
        $this->assertIsArray($renewed);
        $this->assertSame($lease['token'], $renewed['token']);
        $this->assertSame($lease['fence'], $renewed['fence']);
        $this->assertGreaterThan($lease['expires'], $renewed['expires']);
        $lock->release($renewed);
        $this->assertSame('', $state['token']);
        $this->assertSame(1, $state['fence']);

        $next = $lock->acquire('retention');
        $this->assertIsArray($next);
        $this->assertSame(2, $next['fence']);
    }

    public function test_sync_approval_rollback_retention_and_atomic_repository_mutations_share_the_fence(): void
    {
        $sync = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Sync.php');
        $repository = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/ReleaseRepository.php');
        $cron = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Cron.php');

        foreach (['sync', 'script-approval', 'activation', 'rollback', 'retention', 'pin'] as $purpose) {
            $this->assertStringContainsString("acquireLease('{$purpose}')", $sync);
        }
        $this->assertStringContainsString('$this->sync->retainReleases(5)', $cron);
        $this->assertStringContainsString('LIMIT 1 FOR UPDATE', $repository);
        $this->assertStringContainsString("state = 'active' FOR UPDATE", $repository);
        $transaction = strpos($repository, "query('START TRANSACTION')");
        $releaseRead = strpos($repository, 'SELECT * FROM {$releases}', is_int($transaction) ? $transaction : 0);
        $this->assertIsInt($transaction);
        $this->assertIsInt($releaseRead);
        $this->assertLessThan($releaseRead, $transaction, 'Mutable activation rows must be read only after the transaction starts.');
        $this->assertGreaterThanOrEqual(3, substr_count($repository, '$this->assertFence($fenceGuard)'));
    }
}
