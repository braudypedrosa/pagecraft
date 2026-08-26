<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\Support;

final class ReleaseStatePersistenceTest extends ConnectorTestCase
{
    public function test_mark_ready_fails_closed_until_exact_status_write_is_durable(): void
    {
        $repository = new ReleaseRepository();
        $manifest = $this->manifest('connection-current', 'site-current', 4, 'deployment-ready');
        $GLOBALS['wpdb']->releaseRows['deployment-ready'] = $this->row($manifest, 'needs_approval');
        $GLOBALS['pagecraft_test_fail_release_ready'] = true;

        $failed = $repository->markReady('deployment-ready');

        $this->assertInstanceOf(\WP_Error::class, $failed);
        $this->assertSame('pagecraft_release_ready_persist_failed', $failed->get_error_code());
        $this->assertSame('needs_approval', $GLOBALS['wpdb']->releaseRows['deployment-ready']['status']);

        $GLOBALS['pagecraft_test_fail_release_ready'] = false;
        $this->assertTrue($repository->markReady('deployment-ready'));
        $this->assertSame('installed', $GLOBALS['wpdb']->releaseRows['deployment-ready']['status']);
    }

    public function test_set_error_fails_closed_and_verifies_exact_journal_before_terminal_ack(): void
    {
        $repository = new ReleaseRepository();
        $manifest = $this->manifest('connection-current', 'site-current', 5, 'deployment-error');
        $GLOBALS['wpdb']->releaseRows['deployment-error'] = $this->row($manifest, 'installed');
        $GLOBALS['pagecraft_test_fail_release_error'] = true;

        $failed = $repository->setError('deployment-error', 'Probe_Failed', '<b>Stale response</b>');

        $this->assertInstanceOf(\WP_Error::class, $failed);
        $this->assertSame('pagecraft_release_error_persist_failed', $failed->get_error_code());
        $this->assertSame('installed', $GLOBALS['wpdb']->releaseRows['deployment-error']['status']);

        $GLOBALS['pagecraft_test_fail_release_error'] = false;
        $this->assertTrue($repository->setError('deployment-error', 'Probe_Failed', '<b>Stale response</b>'));
        $stored = $GLOBALS['wpdb']->releaseRows['deployment-error'];
        $this->assertSame('failed', $stored['status']);
        $this->assertSame('probe_failed', $stored['error_code']);
        $this->assertSame('Stale response', $stored['error_message']);
    }

    public function test_previous_verified_fallback_never_crosses_connection_or_site_epoch(): void
    {
        $repository = new ReleaseRepository();
        $old = $this->manifest('connection-old', 'site-old', 100, 'deployment-old-100');
        $current = $this->manifest('connection-current', 'site-current', 3, 'deployment-current-3');
        $candidate = $this->manifest('connection-current', 'site-current', 4, 'deployment-current-4');
        $GLOBALS['wpdb']->releaseRows['deployment-old-100'] = $this->row($old, 'retained', true, 1);
        $GLOBALS['wpdb']->releaseRows['deployment-current-3'] = $this->row($current, 'retained', true, 2);
        $GLOBALS['wpdb']->releaseRows['deployment-current-4'] = $this->row($candidate, 'active', false, 3);

        $previous = $repository->previousVerified(
            'deployment-current-4',
            'connection-current',
            'site-current',
            4
        );

        $this->assertIsArray($previous);
        $this->assertSame('deployment-current-3', $previous['deployment_id']);

        unset($GLOBALS['wpdb']->releaseRows['deployment-current-3']);
        $this->assertNull($repository->previousVerified(
            'deployment-current-4',
            'connection-current',
            'site-current',
            4
        ));
    }

    /** @return array<string,mixed> */
    private function manifest(string $connectionId, string $siteId, int $sequence, string $deploymentId): array
    {
        return [
            'releaseId' => 'release-' . $deploymentId,
            'deploymentId' => $deploymentId,
            'connectionId' => $connectionId,
            'siteId' => $siteId,
            'sequence' => $sequence,
            'artifactHash' => str_repeat('a', 64),
            '_manifestHash' => str_repeat('b', 64),
            '_deploymentHash' => str_repeat('c', 64),
        ];
    }

    /** @param array<string,mixed> $manifest @return array<string,mixed> */
    private function row(array $manifest, string $status, bool $verified = false, int $id = 1): array
    {
        return [
            'id' => $id,
            'release_id' => $manifest['releaseId'],
            'deployment_id' => $manifest['deploymentId'],
            'connection_id' => $manifest['connectionId'],
            'site_id' => $manifest['siteId'],
            'sequence_no' => $manifest['sequence'],
            'source_version' => 1,
            'status' => $status,
            'manifest' => Support::json($manifest),
            'manifest_hash' => $manifest['_manifestHash'],
            'deployment_hash' => $manifest['_deploymentHash'],
            'artifact_hash' => $manifest['artifactHash'],
            'created_at' => '2026-08-26 00:00:00',
            'verified_at' => $verified ? '2026-08-26 00:01:00' : null,
            'error_code' => null,
            'error_message' => null,
        ];
    }
}
