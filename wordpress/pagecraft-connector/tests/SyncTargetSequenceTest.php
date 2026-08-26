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

final class SyncTargetSequenceTest extends ConnectorTestCase
{
    public function test_retained_older_target_cannot_reactivate_after_newer_sequence_is_observed(): void
    {
        $repository = new ReleaseRepository();
        $connection = new Connection();
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $repository,
            new Mapper($repository)
        );
        $GLOBALS['wpdb']->releaseRows['deployment-new:target:11'] = $this->row('deployment-new:target:11', 11, 'installed');
        $GLOBALS['wpdb']->releaseRows['deployment-old:target:10'] = $this->row('deployment-old:target:10', 10, 'retained');
        $method = new ReflectionMethod(Sync::class, 'assertActivationSequenceCurrent');

        $replayed = $method->invoke($sync, ['deploymentId' => 'deployment-old:target:10', 'sequence' => 10]);
        $exactLatest = $method->invoke($sync, ['deploymentId' => 'deployment-new:target:11', 'sequence' => 11]);
        $future = $method->invoke($sync, ['deploymentId' => 'deployment-future:target:12', 'sequence' => 12]);

        $this->assertInstanceOf(\WP_Error::class, $replayed);
        $this->assertSame('pagecraft_target_sequence_replay', $replayed->get_error_code());
        $this->assertTrue($exactLatest);
        $this->assertTrue($future);

        $source = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Sync.php');
        $activation = substr($source, (int) strpos($source, 'private function activateInstalled'));
        $guard = strpos($activation, '$this->assertActivationSequenceCurrent($manifest)');
        $pointer = strpos($activation, '$this->releases->activate($deploymentId');
        $this->assertIsInt($guard);
        $this->assertIsInt($pointer);
        $this->assertTrue($guard < $pointer);
    }

    /** @return array<string,mixed> */
    private function row(string $deploymentId, int $sequence, string $status): array
    {
        return [
            'id' => $sequence,
            'deployment_id' => $deploymentId,
            'release_id' => 'release-' . $sequence,
            'sequence_no' => $sequence,
            'source_version' => $sequence,
            'status' => $status,
            'manifest' => '{}',
            'manifest_hash' => str_repeat('a', 64),
            'deployment_hash' => str_repeat('b', 64),
            'artifact_hash' => str_repeat('c', 64),
            'created_at' => '2026-08-26 00:00:00',
            'verified_at' => $status === 'retained' ? '2026-08-26 00:01:00' : null,
        ];
    }
}
