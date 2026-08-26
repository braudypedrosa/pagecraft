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
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\Sync;
use ReflectionMethod;

final class SyncRollbackEligibilityTest extends ConnectorTestCase
{
    public function test_only_previously_active_or_retained_releases_are_emergency_rollback_candidates(): void
    {
        $connection = new Connection();
        $repository = new ReleaseRepository();
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $repository,
            new Mapper($repository),
            static fn (array $payload): array => ['status' => (string) ($payload['status'] ?? '')]
        );
        $eligible = new ReflectionMethod(Sync::class, 'isVerifiedRollbackCandidate');

        $this->assertTrue($eligible->invoke($sync, ['status' => 'active', 'verified_at' => '2026-08-26 00:00:00']));
        $this->assertTrue($eligible->invoke($sync, ['status' => 'retained', 'verified_at' => '2026-08-26 00:00:00']));
        $this->assertFalse($eligible->invoke($sync, ['status' => 'active', 'verified_at' => null]));
        $this->assertFalse($eligible->invoke($sync, ['status' => 'retained', 'verified_at' => null]));
        foreach (['staged', 'installed', 'needs_approval', 'failed'] as $status) {
            $this->assertFalse($eligible->invoke($sync, ['status' => $status, 'verified_at' => '2026-08-26 00:00:00']), $status);
        }
        $this->assertFalse($eligible->invoke($sync, null));
    }

    public function test_interrupted_activation_must_reprobe_before_live_or_rollback_eligibility(): void
    {
        $connection = new Connection();
        $repository = new ReleaseRepository();
        $requests = [];
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $repository,
            new Mapper($repository),
            static function (array $payload) use (&$requests): array {
                $requests[] = $payload;
                return ['status' => (string) ($payload['status'] ?? '')];
            }
        );
        $needsVerification = new ReflectionMethod(Sync::class, 'activeReleaseNeedsVerification');
        $eligible = new ReflectionMethod(Sync::class, 'isVerifiedRollbackCandidate');
        $complete = new ReflectionMethod(Sync::class, 'completeActiveAcknowledgement');
        $crashState = ['status' => 'active', 'verified_at' => null];

        $this->assertTrue($needsVerification->invoke($sync, $crashState));
        $this->assertFalse($eligible->invoke($sync, $crashState));
        $blocked = $complete->invoke($sync, [
            'deploymentId' => 'deployment-crash:target:4',
            'releaseId' => 'release-crash',
            'sequence' => 4,
            'artifactHash' => str_repeat('e', 64),
        ], $crashState);
        $this->assertInstanceOf(\WP_Error::class, $blocked);
        $this->assertSame('pagecraft_release_unverified', $blocked->get_error_code());
        $this->assertSame([], $requests, 'A crash-state release must not send a live acknowledgement.');

        $syncSource = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Sync.php');
        $runStart = strpos($syncSource, 'public function run');
        $recovery = strpos($syncSource, '$interruptedActive = $this->releases->active()', $runStart);
        $desired = strpos($syncSource, '$desired = $this->http->desiredRelease', $runStart);
        $publishStart = strpos($syncSource, 'private function verifyAndPublish');
        $publishEnd = strpos($syncSource, '/**', $publishStart + 1);
        $publish = substr($syncSource, $publishStart, $publishEnd - $publishStart);
        $probe = strpos($publish, '$this->verifyActivation($manifest)');
        $marker = strpos($publish, '$this->releases->markVerified');
        $outbox = strpos($publish, '$this->persistPendingLiveAcknowledgement($manifest, $livePayload)');
        $live = strpos($publish, '$this->acknowledgeState($manifest, \'live\'');

        $this->assertIsInt($recovery);
        $this->assertIsInt($desired);
        $this->assertTrue($recovery < $desired, 'Interrupted activation recovery must run before desired-release polling.');
        $this->assertIsInt($probe);
        $this->assertIsInt($marker);
        $this->assertIsInt($outbox);
        $this->assertIsInt($live);
        $this->assertTrue(
            $probe < $marker && $marker < $outbox && $outbox < $live,
            'Public probes, the durable marker, and the live outbox must precede every live acknowledgement.'
        );

        $repositorySource = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/ReleaseRepository.php');
        $schemaSource = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Schema.php');
        $this->assertStringContainsString('verified_at IS NOT NULL', $repositorySource);
        $this->assertStringContainsString('previous_deployment_id', $repositorySource);
        $this->assertStringContainsString('verified_at datetime NULL', $schemaSource);
        $this->assertStringContainsString("'redirection' => 0", $syncSource, 'Public health probes must reject managed-route redirects instead of following another release marker.');
    }

    public function test_emergency_rollback_pause_and_intent_survive_interruption_after_pointer_switch(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-rollback';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-rollback',
            'site_id' => 'site-rollback',
            'api_origin' => 'http://localhost:8787',
            'access_token' => Crypto::seal('rollback-access'),
            'refresh_token' => Crypto::seal('rollback-refresh'),
            'access_expires_at' => time() + 600,
            'scopes' => ['release:read'],
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-rollback',
            'profile' => 'existing-theme',
            'environment' => 'staging',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
        $connection = new Connection();
        $repository = new ReleaseRepository();
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
        $httpCalls = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function () use (&$httpCalls): array {
            $httpCalls++;
            return ['response' => ['code' => 204], 'headers' => [], 'body' => ''];
        };
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $repository,
            new Mapper($repository),
            null,
            $lock
        );
        $begin = new ReflectionMethod(Sync::class, 'beginEmergencyRollbackIntent');
        $intent = $begin->invoke($sync, [
            'deployment_id' => 'release-new:target:2', 'release_id' => 'release-new',
        ], [
            'deployment_id' => 'release-old:target:1', 'release_id' => 'release-old',
        ]);

        $this->assertIsArray($intent);
        $this->assertSame('paused', $connection->mode());
        $this->assertSame('pending', $GLOBALS['pagecraft_test_options']['pagecraft_emergency_rollback']['status']);
        $this->assertSame('release-old:target:1', $GLOBALS['pagecraft_test_options']['pagecraft_emergency_rollback']['requested_deployment_id']);
        $this->assertSame('release-new:target:2', $GLOBALS['pagecraft_test_options']['pagecraft_emergency_rollback']['previous_deployment_id']);

        // Simulate process death immediately after the atomic pointer switch:
        // the next cron entry must observe the already-durable pause first.
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'release-old:target:1';
        $result = $sync->run(false);
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_emergency_rollback_paused', $result->get_error_code());
        $this->assertSame(0, $httpCalls);

        $forced = $sync->run(true);
        $this->assertInstanceOf(\WP_Error::class, $forced);
        $this->assertSame('pagecraft_emergency_rollback_paused', $forced->get_error_code());
        $this->assertSame(0, $httpCalls, 'Manual/forced synchronization cannot bypass an emergency rollback latch.');

        $finish = new ReflectionMethod(Sync::class, 'finishEmergencyRollbackIntent');
        $failed = $finish->invoke($sync, $intent, 'activation_failed', new \WP_Error('pagecraft_activation_failed', 'Injected activation failure.'));
        $this->assertTrue($failed);
        $this->assertSame('paused', $connection->mode());
        $this->assertSame('activation_failed', $GLOBALS['pagecraft_test_options']['pagecraft_emergency_rollback']['status']);
        $this->assertSame('pagecraft_activation_failed', $GLOBALS['pagecraft_test_options']['pagecraft_emergency_rollback']['error_code']);

        $forcedAfterFailure = $sync->run(true);
        $this->assertInstanceOf(\WP_Error::class, $forcedAfterFailure);
        $this->assertSame('pagecraft_emergency_rollback_paused', $forcedAfterFailure->get_error_code());
        $this->assertSame(0, $httpCalls);
        $this->assertFalse($connection->setMode('connected'), 'Generic mode changes must not clear the emergency latch.');
        $this->assertTrue($connection->resume('unit-test'));
        $this->assertSame('connected', $connection->mode());
        $this->assertSame('resumed', $GLOBALS['pagecraft_test_options']['pagecraft_emergency_rollback']['status']);
        $this->assertSame('unit-test', $GLOBALS['pagecraft_test_options']['pagecraft_emergency_rollback']['resume_reason']);

        $resumed = $sync->run(true);
        $this->assertIsArray($resumed);
        $this->assertSame('current', $resumed['status']);
        $this->assertSame(1, $httpCalls, 'Only an explicit Resume permits the next desired-release request.');

        $source = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Sync.php');
        $start = strpos($source, 'public function emergencyRollback');
        $end = strpos($source, 'private function beginEmergencyRollbackIntent', $start);
        $method = substr($source, $start, $end - $start);
        $pauseIntent = strpos($method, '$this->beginEmergencyRollbackIntent');
        $activate = strpos($method, '($this->rollbackActivator)');
        $complete = strpos($method, '$this->finishEmergencyRollbackIntent($intent, \'active\')');
        $this->assertIsInt($pauseIntent);
        $this->assertIsInt($activate);
        $this->assertIsInt($complete);
        $this->assertTrue($pauseIntent < $activate && $activate < $complete);

        $adminSource = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Admin.php');
        $cliSource = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/CliCommand.php');
        $this->assertStringContainsString("->resume('administrator')", $adminSource);
        $this->assertStringContainsString("->resume('cli')", $cliSource);
    }

    public function test_failed_resume_mode_write_keeps_emergency_latch_closed_to_forced_sync(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-resume-failure';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-resume-failure',
            'site_id' => 'site-resume-failure',
            'api_origin' => 'http://localhost:8787',
            'access_token' => Crypto::seal('resume-failure-access'),
            'refresh_token' => Crypto::seal('resume-failure-refresh'),
            'access_expires_at' => time() + 600,
            'scopes' => ['release:read'],
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-resume-failure',
            'profile' => 'existing-theme',
            'environment' => 'staging',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'paused';
        $GLOBALS['pagecraft_test_options'][Connection::EMERGENCY_ROLLBACK_OPTION] = [
            'intent_id' => 'rollback-resume-failure',
            'status' => 'active',
            'requested_deployment_id' => 'release-old:target:1',
        ];
        $httpCalls = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function () use (&$httpCalls): array {
            $httpCalls++;
            return ['response' => ['code' => 204], 'headers' => [], 'body' => ''];
        };
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name, mixed $value): ?bool {
            if ($name === 'pagecraft_mode') {
                return false;
            }
            $GLOBALS['pagecraft_test_options'][$name] = $value;
            return true;
        };
        $connection = new Connection();
        $repository = new ReleaseRepository();
        $sync = new Sync(
            $connection,
            new HttpClient($connection),
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $repository,
            new Mapper($repository)
        );

        $this->assertFalse($connection->resume('unit-failure'));
        $this->assertSame('paused', $connection->mode());
        $this->assertTrue($connection->emergencyRollbackRequiresResume());
        $this->assertSame('active', $GLOBALS['pagecraft_test_options'][Connection::EMERGENCY_ROLLBACK_OPTION]['status']);

        $forced = $sync->run(true);
        $this->assertInstanceOf(\WP_Error::class, $forced);
        $this->assertSame('pagecraft_emergency_rollback_paused', $forced->get_error_code());
        $this->assertSame(0, $httpCalls);

        $GLOBALS['pagecraft_test_update_option_handler'] = null;
        $this->assertTrue($connection->resume('unit-retry'));
        $this->assertFalse($connection->emergencyRollbackRequiresResume());
        $this->assertSame('connected', $connection->mode());
        $this->assertSame('resumed', $GLOBALS['pagecraft_test_options'][Connection::EMERGENCY_ROLLBACK_OPTION]['status']);
    }
}
