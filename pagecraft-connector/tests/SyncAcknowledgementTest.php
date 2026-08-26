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
use Pagecraft\Connector\Support;
use Pagecraft\Connector\Sync;
use ReflectionMethod;
use ReflectionProperty;

final class SyncAcknowledgementTest extends ConnectorTestCase
{
    public function test_verified_active_without_live_outbox_reconstructs_receipt_before_saved_etag_poll(): void
    {
        $events = [];
        $sync = $this->sync(static function (array $payload) use (&$events): array {
            $events[] = 'ack:' . (string) $payload['status'];
            return ['status' => (string) $payload['status']];
        });
        $manifest = $this->manifest();
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $manifest['deploymentId'];
        $GLOBALS['pagecraft_test_options']['pagecraft_release_etag'] = '"saved-etag"';
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$manifest['deploymentId'] => 'verifying'];
        $this->storeVerifiedActiveRelease($manifest);
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$events): array {
            $events[] = 'desired';
            return ['response' => ['code' => 304], 'headers' => [], 'body' => ''];
        };

        $result = $sync->run(false);

        $this->assertIsArray($result);
        $this->assertSame('current', $result['status']);
        $this->assertSame(['ack:live', 'desired'], $events, 'The reconstructed live receipt must precede even a saved-ETag 304 poll.');
        $this->assertSame('live', get_option('pagecraft_deployment_ack_states')[$manifest['deploymentId']]);
        $this->assertSame([], get_option('pagecraft_pending_live_acknowledgements', []));
        $this->assertSame($manifest['deploymentId'], get_option('pagecraft_active_release_id'));
    }

    public function test_reconstructed_live_receipt_survives_response_loss_and_retries_before_poll(): void
    {
        $requests = [];
        $responses = [
            new \WP_Error('http_request_failed', 'Live response lost after commit.'),
            ['status' => 'live', 'duplicate' => true],
        ];
        $sync = $this->sync(static function (array $payload) use (&$requests, &$responses): array|\WP_Error {
            $requests[] = $payload;
            return array_shift($responses);
        });
        $manifest = $this->manifest();
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $manifest['deploymentId'];
        $GLOBALS['pagecraft_test_options']['pagecraft_release_etag'] = '"saved-etag"';
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$manifest['deploymentId'] => 'verifying'];
        $this->storeVerifiedActiveRelease($manifest);
        $desiredCalls = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function () use (&$desiredCalls): array {
            $desiredCalls++;
            return ['response' => ['code' => 304], 'headers' => [], 'body' => ''];
        };

        $lost = $sync->run(false);
        $retried = $sync->run(false);

        $this->assertIsArray($lost);
        $this->assertSame('acknowledgement_pending', $lost['status']);
        $this->assertIsArray($retried);
        $this->assertSame('current', $retried['status']);
        $this->assertCount(2, $requests);
        $this->assertSame($requests[0], $requests[1]);
        $this->assertSame(1, $desiredCalls, 'A failed live receipt retries before polling and never needs a desired pointer to survive.');
        $this->assertSame($manifest['deploymentId'], get_option('pagecraft_active_release_id'));
    }

    public function test_installed_and_approval_candidates_replay_ordered_missing_receipts_idempotently(): void
    {
        $requests = [];
        $responses = [
            new \WP_Error('http_request_failed', 'Staged response lost.'),
            ['status' => 'staged', 'duplicate' => true],
            ['status' => 'needs_approval'],
        ];
        $sync = $this->sync(static function (array $payload) use (&$requests, &$responses): array|\WP_Error {
            $requests[] = $payload;
            return array_shift($responses);
        });
        $manifest = $this->manifest();
        $release = $this->release($manifest, 'installed');
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$manifest['deploymentId'] => 'downloading'];
        $reconcile = new ReflectionMethod(Sync::class, 'reconcileCandidateAcknowledgements');

        $lost = $reconcile->invoke($sync, $release, $manifest);
        $retried = $reconcile->invoke($sync, $release, $manifest);
        $approvalRelease = $this->release($manifest, 'needs_approval');
        $approvedState = $reconcile->invoke($sync, $approvalRelease, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertTrue($retried);
        $this->assertTrue($approvedState);
        $this->assertSame(['staged', 'staged', 'needs_approval'], array_column($requests, 'status'));
        $this->assertSame($requests[0], $requests[1], 'Response loss must replay the exact staged body and idempotency key.');
        $this->assertSame('needs_approval', get_option('pagecraft_deployment_ack_states')[$manifest['deploymentId']]);
        $this->assertNotContains('activating', array_column($requests, 'status'));
    }

    public function test_saved_etag_approval_candidate_replays_staged_and_needs_approval_before_304(): void
    {
        $events = [];
        $sync = $this->sync(static function (array $payload) use (&$events): array {
            $events[] = 'ack:' . (string) $payload['status'];
            return ['status' => (string) $payload['status']];
        });
        $manifest = $this->manifest();
        $manifest['_pendingScripts'] = [str_repeat('f', 64)];
        $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->rawReleaseRow($manifest, 'needs_approval', false);
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$manifest['deploymentId'] => 'downloading'];
        $GLOBALS['pagecraft_test_options']['pagecraft_release_etag'] = '"candidate-etag"';
        $GLOBALS['pagecraft_test_http_handler'] = static function () use (&$events): array {
            $events[] = 'desired';
            return ['response' => ['code' => 304], 'headers' => [], 'body' => ''];
        };

        $result = $sync->run(false);

        $this->assertIsArray($result);
        $this->assertSame('needs_approval', $result['status']);
        $this->assertSame(['ack:staged', 'ack:needs_approval', 'desired'], $events);
        $this->assertSame('needs_approval', get_option('pagecraft_deployment_ack_states')[$manifest['deploymentId']]);
        $this->assertNotContains('ack:activating', $events);
    }

    public function test_failed_mark_installed_never_saves_etag_or_hides_the_staged_retry(): void
    {
        $sync = $this->sync(static fn (array $payload): array => ['status' => (string) $payload['status']]);
        $manifest = $this->manifest();
        $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->rawReleaseRow($manifest, 'staged', false);
        $GLOBALS['pagecraft_test_options']['pagecraft_release_etag'] = '"previous-etag"';
        $GLOBALS['pagecraft_test_fail_release_install'] = true;
        $persist = new ReflectionMethod(Sync::class, 'persistInstalledCandidate');

        $failed = $persist->invoke($sync, $manifest['deploymentId'], true, ['_etag' => '"new-etag"']);

        $this->assertInstanceOf(\WP_Error::class, $failed);
        $this->assertSame('pagecraft_release_install_persist', $failed->get_error_code());
        $this->assertSame('staged', $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']]['status']);
        $this->assertSame('"previous-etag"', get_option('pagecraft_release_etag'), 'A failed install commit must leave polling able to fetch the same desired target.');

        $GLOBALS['pagecraft_test_fail_release_install'] = false;
        $retried = $persist->invoke($sync, $manifest['deploymentId'], true, ['_etag' => '"new-etag"']);
        $this->assertIsArray($retried);
        $this->assertSame('needs_approval', $retried['status']);
        $this->assertSame('"new-etag"', get_option('pagecraft_release_etag'));
    }

    public function test_failed_mark_ready_stops_before_activating_ack_and_remains_retryable(): void
    {
        $requests = [];
        $sync = $this->sync(static function (array $payload) use (&$requests): array {
            $requests[] = $payload;
            return ['status' => (string) $payload['status']];
        });
        $manifest = $this->manifest();
        $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->rawReleaseRow($manifest, 'needs_approval', false);
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$manifest['deploymentId'] => 'needs_approval'];
        $GLOBALS['pagecraft_test_fail_release_ready'] = true;

        $result = $sync->activatePending($manifest['deploymentId']);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_release_ready_persist_failed', $result->get_error_code());
        $this->assertSame('needs_approval', $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']]['status']);
        $this->assertSame([], $requests, 'No activating transition may be emitted before the local ready write commits.');
    }

    public function test_ambiguous_activating_response_keeps_candidate_private_and_replays_exact_progress_receipt(): void
    {
        $requests = [];
        $sync = $this->sync(static function (array $payload) use (&$requests): \WP_Error {
            $requests[] = $payload;
            return new \WP_Error('http_request_failed', 'The activating response was lost after commit.');
        });
        $manifest = $this->manifest();
        $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']] = $this->rawReleaseRow($manifest, 'installed', false);
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$manifest['deploymentId'] => 'staged'];
        $activate = new ReflectionMethod(Sync::class, 'activateInstalled');

        $first = $activate->invoke($sync, $manifest);
        $second = $activate->invoke($sync, $manifest);

        $this->assertIsArray($first);
        $this->assertSame('acknowledgement_pending', $first['status']);
        $this->assertIsArray($second);
        $this->assertSame('acknowledgement_pending', $second['status']);
        $this->assertCount(2, $requests);
        $this->assertSame(['activating', 'activating'], array_column($requests, 'status'));
        $this->assertSame($requests[0], $requests[1]);
        $this->assertSame('installed', $GLOBALS['wpdb']->releaseRows[$manifest['deploymentId']]['status']);
        $this->assertSame('', (string) get_option('pagecraft_active_release_id', ''));
        $this->assertNotContains('failed', array_column($requests, 'status'));
    }

    public function test_ambiguous_downloading_branch_is_fail_safe_progress_reconciliation(): void
    {
        $source = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Sync.php');
        $start = strpos($source, '$acknowledged = $this->acknowledgeState($manifest, \'downloading\')');
        $this->assertIsInt($start);
        $end = strpos($source, '$artifact =', $start);
        $branch = substr($source, $start, $end - $start);

        $this->assertStringContainsString('progressAcknowledgementPending($acknowledged, $manifest)', $branch);
        $this->assertStringNotContainsString('fail($acknowledged', $branch);
    }

    public function test_rollback_terminal_receipt_blocks_resume_and_retries_exactly_while_paused(): void
    {
        $requests = [];
        $responses = [
            new \WP_Error('http_request_failed', 'Rollback response lost after commit.'),
            ['status' => 'rolled_back', 'duplicate' => true],
        ];
        $sync = $this->sync(static function (array $payload) use (&$requests, &$responses): array|\WP_Error {
            $requests[] = $payload;
            return array_shift($responses);
        });
        $new = $this->manifest();
        $old = $new;
        $old['releaseId'] = 'release-ack-old';
        $old['deploymentId'] = 'release-ack-old:target:6';
        $old['sequence'] = 6;
        $old['artifactHash'] = str_repeat('d', 64);
        $GLOBALS['wpdb']->releaseRows[$new['deploymentId']] = $this->rawReleaseRow($new, 'retained');
        $GLOBALS['wpdb']->releaseRows[$old['deploymentId']] = $this->rawReleaseRow($old, 'active');
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $old['deploymentId'];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'paused';
        $GLOBALS['pagecraft_test_options'][Connection::EMERGENCY_ROLLBACK_OPTION] = [
            'intent_id' => 'rollback-intent-unit',
            'status' => 'active',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$new['deploymentId'] => 'live'];
        $this->setAcknowledgedState($sync, 'live');
        $acknowledge = new ReflectionMethod(Sync::class, 'acknowledgeState');

        $lost = $acknowledge->invoke($sync, $new, 'rolled_back', [
            'activeHash' => $old['artifactHash'],
            'detail' => ['stage' => 'rollback', 'action' => 'WordPress administrator rollback'],
        ]);
        $connection = new Connection();
        $revocationCalls = 0;
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function (string $key, bool $retry) use (&$revocationCalls): array {
                $revocationCalls++;
                return [
                    'connectionId' => 'connection-unit',
                    'status' => 'revoked',
                    'revokedAt' => gmdate('c'),
                    'alreadyRevoked' => false,
                ];
            }
        );
        $blockedDisconnect = $revocation->begin();
        $blockedResume = $connection->resume('unit');
        $reconciled = $sync->run(true);
        $resumed = $connection->resume('unit');
        $disconnected = $revocation->begin();
        $newPairing = $connection->beginPairing('http://localhost:8787', 'site-new-unit', 'existing-theme', 'staging');

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertInstanceOf(\WP_Error::class, $blockedDisconnect);
        $this->assertSame('pagecraft_rollback_reconciliation_pending', $blockedDisconnect->get_error_code());
        $this->assertFalse($blockedResume);
        $this->assertInstanceOf(\WP_Error::class, $reconciled);
        $this->assertSame('pagecraft_emergency_rollback_paused', $reconciled->get_error_code());
        $this->assertTrue($resumed);
        $this->assertCount(2, $requests);
        $this->assertSame($requests[0], $requests[1]);
        $this->assertSame('rolled_back', get_option('pagecraft_deployment_ack_states')[$new['deploymentId']]);
        $this->assertSame([], get_option(Connection::PENDING_TERMINAL_ACKS_OPTION, []));
        $this->assertSame($old['deploymentId'], get_option('pagecraft_active_release_id'));
        $this->assertTrue($disconnected);
        $this->assertSame(1, $revocationCalls);
        $this->assertArrayHasKey('authorize_url', $newPairing);
    }

    public function test_pre_pointer_rollback_outbox_recovers_exact_intent_before_sending_receipt(): void
    {
        $events = [];
        $new = $this->manifest();
        $old = $new;
        $old['releaseId'] = 'release-ack-old';
        $old['deploymentId'] = 'release-ack-old:target:6';
        $old['sequence'] = 6;
        $old['artifactHash'] = str_repeat('d', 64);
        $sync = $this->sync(
            static function (array $payload) use (&$events): array {
                $events[] = 'ack:' . (string) $payload['status'];
                return ['status' => (string) $payload['status']];
            },
            static function (string $deploymentId, \Closure $guard) use (&$events, $new, $old): bool|\WP_Error {
                $owned = $guard();
                if (is_wp_error($owned)) {
                    return $owned;
                }
                $events[] = 'activate:' . $deploymentId;
                $GLOBALS['wpdb']->releaseRows[$new['deploymentId']]['status'] = 'retained';
                $GLOBALS['wpdb']->releaseRows[$old['deploymentId']]['status'] = 'active';
                $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $deploymentId;
                return true;
            }
        );
        $GLOBALS['wpdb']->releaseRows[$new['deploymentId']] = $this->rawReleaseRow($new, 'active');
        $GLOBALS['wpdb']->releaseRows[$old['deploymentId']] = $this->rawReleaseRow($old, 'retained');
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $new['deploymentId'];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'paused';
        $GLOBALS['pagecraft_test_options'][Connection::EMERGENCY_ROLLBACK_OPTION] = [
            'intent_id' => 'rollback-intent-pre-pointer',
            'status' => 'pending',
            'requested_deployment_id' => $old['deploymentId'],
            'requested_release_id' => $old['releaseId'],
            'previous_deployment_id' => $new['deploymentId'],
            'previous_release_id' => $new['releaseId'],
        ];
        $ack = new ReflectionMethod(Sync::class, 'ack');
        $payload = $ack->invoke($sync, $new, 'rolled_back', [
            'activeHash' => $old['artifactHash'],
            'detail' => ['stage' => 'rollback', 'action' => 'WordPress administrator rollback'],
        ]);
        $persist = new ReflectionMethod(Sync::class, 'persistPendingTerminalAcknowledgement');
        $this->assertTrue($persist->invoke($sync, $new, $payload, $old['deploymentId']));

        // This is the exact crash point: the durable outbox/intent exist while
        // the original deployment is still active.
        $result = $sync->run(true);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_emergency_rollback_paused', $result->get_error_code());
        $this->assertSame(['activate:' . $old['deploymentId'], 'ack:rolled_back'], $events);
        $this->assertSame($old['deploymentId'], get_option('pagecraft_active_release_id'));
        $this->assertSame('active', get_option(Connection::EMERGENCY_ROLLBACK_OPTION)['status']);
        $this->assertSame([], get_option(Connection::PENDING_TERMINAL_ACKS_OPTION, []));
        $this->assertTrue((new Connection())->resume('unit'));
    }

    public function test_failed_terminal_option_write_is_reconstructed_from_restored_release_journal(): void
    {
        $requests = [];
        $sync = $this->sync(static function (array $payload) use (&$requests): array {
            $requests[] = $payload;
            return ['status' => (string) $payload['status']];
        });
        $failed = $this->manifest();
        $previous = $failed;
        $previous['releaseId'] = 'release-ack-previous';
        $previous['deploymentId'] = 'release-ack-previous:target:6';
        $previous['sequence'] = 6;
        $previous['artifactHash'] = str_repeat('d', 64);
        $failedRow = $this->rawReleaseRow($failed, 'failed', false);
        $failedRow['previous_deployment_id'] = $previous['deploymentId'];
        $failedRow['error_code'] = 'pagecraft_public_probe_content';
        $failedRow['error_message'] = 'The candidate route returned stale bytes.';
        $GLOBALS['wpdb']->releaseRows[$failed['deploymentId']] = $failedRow;
        $GLOBALS['wpdb']->releaseRows[$previous['deploymentId']] = $this->rawReleaseRow($previous, 'active');
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $previous['deploymentId'];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'paused';
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = [$failed['deploymentId'] => 'verifying'];

        $ack = new ReflectionMethod(Sync::class, 'ack');
        $payload = $ack->invoke($sync, $failed, 'rolled_back', [
            'activeHash' => $previous['artifactHash'],
            'error' => $failedRow['error_message'],
            'detail' => [
                'code' => $failedRow['error_code'],
                'message' => $failedRow['error_message'],
                'stage' => 'verifying',
                'action' => 'Previous release restored automatically.',
            ],
        ]);
        $GLOBALS['pagecraft_test_update_option_handler'] = static fn (string $name): ?bool => $name === Connection::PENDING_TERMINAL_ACKS_OPTION ? false : null;
        $persist = new ReflectionMethod(Sync::class, 'persistPendingTerminalAcknowledgement');
        $lost = $persist->invoke($sync, $failed, $payload, $previous['deploymentId']);
        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame('pagecraft_terminal_ack_persist_failed', $lost->get_error_code());
        $this->assertSame([], get_option(Connection::PENDING_TERMINAL_ACKS_OPTION, []));

        $desiredCalls = 0;
        $GLOBALS['pagecraft_test_update_option_handler'] = null;
        $GLOBALS['pagecraft_test_http_handler'] = static function () use (&$desiredCalls): array {
            $desiredCalls++;
            return ['response' => ['code' => 304], 'body' => ''];
        };
        $recovered = $sync->run(false);

        $this->assertInstanceOf(\WP_Error::class, $recovered);
        $this->assertSame('pagecraft_sync_paused', $recovered->get_error_code());
        $this->assertSame(0, $desiredCalls, 'A reconstructed rollback receipt is delivered before any desired polling.');
        $this->assertCount(1, $requests);
        $this->assertSame($payload, $requests[0]);
        $this->assertSame('rolled_back', get_option('pagecraft_deployment_ack_states')[$failed['deploymentId']]);
        $this->assertSame([], get_option(Connection::PENDING_TERMINAL_ACKS_OPTION, []));
        $this->assertSame('paused', (new Connection())->mode());
    }

    public function test_lost_live_response_retries_the_exact_request_without_blank_state(): void
    {
        $requests = [];
        $responses = [
            new \WP_Error('http_request_failed', 'The response was lost after commit.'),
            ['status' => 'live', 'duplicate' => true],
        ];
        $sync = $this->sync(static function (array $payload) use (&$requests, &$responses): array|\WP_Error {
            $requests[] = $payload;
            return array_shift($responses);
        });
        $manifest = $this->manifest();
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $manifest['deploymentId'];
        $this->storeVerifiedActiveRelease($manifest);

        $this->setAcknowledgedState($sync, 'verifying');
        $lost = $this->acknowledgeLive($sync, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame($manifest['deploymentId'], get_option('pagecraft_active_release_id'));
        $pending = get_option('pagecraft_pending_live_acknowledgements');
        $this->assertIsArray($pending);
        $this->assertArrayHasKey($manifest['deploymentId'], $pending);
        $this->assertSame(1, $pending[$manifest['deploymentId']]['attempts']);
        $this->assertSame('live', $pending[$manifest['deploymentId']]['payload']['status']);

        $retried = (new ReflectionMethod(Sync::class, 'retryPendingLiveAcknowledgements'))->invoke($sync);

        $this->assertTrue($retried);
        $this->assertCount(2, $requests);
        $this->assertSame($requests[0], $requests[1], 'A response-loss retry must reuse the exact body and idempotency key.');
        $this->assertSame([], get_option('pagecraft_pending_live_acknowledgements'));
        $this->assertSame('live', get_option('pagecraft_deployment_ack_states')[$manifest['deploymentId']]);
        $this->assertSame($manifest['deploymentId'], get_option('pagecraft_active_release_id'));
    }

    public function test_production_issuance_error_stays_pending_and_never_restores_the_pointer(): void
    {
        $sync = $this->sync(static fn (array $payload): \WP_Error => new \WP_Error(
            'pagecraft_production_issuance_pending',
            'Production issuance is temporarily unavailable.'
        ));
        $manifest = $this->manifest();
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = $manifest['deploymentId'];
        $this->storeVerifiedActiveRelease($manifest);
        $this->setAcknowledgedState($sync, 'verifying');

        $first = $this->acknowledgeLive($sync, $manifest);
        $retry = (new ReflectionMethod(Sync::class, 'retryPendingLiveAcknowledgements'))->invoke($sync);

        $this->assertInstanceOf(\WP_Error::class, $first);
        $this->assertInstanceOf(\WP_Error::class, $retry);
        $this->assertSame($manifest['deploymentId'], get_option('pagecraft_active_release_id'));
        $pending = get_option('pagecraft_pending_live_acknowledgements');
        $this->assertSame(2, $pending[$manifest['deploymentId']]['attempts']);
        $this->assertSame('pagecraft_production_issuance_pending', $pending[$manifest['deploymentId']]['last_error_code']);

        $source = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Sync.php');
        $liveOffset = strpos($source, '$acknowledged = $this->acknowledgeState($manifest, \'live\'');
        $this->assertIsInt($liveOffset);
        $nextMethod = strpos($source, '/**', $liveOffset + 1);
        $liveBranch = substr($source, $liveOffset, $nextMethod - $liveOffset);
        $this->assertStringContainsString('acknowledgementPending', $liveBranch);
        $this->assertStringNotContainsString('restoreAfterActivation', $liveBranch);
    }

    private function sync(\Closure $acknowledger, ?\Closure $rollbackActivator = null): Sync
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'api_origin' => 'http://localhost:8787',
            'access_token' => Crypto::seal('access-unit'),
            'refresh_token' => Crypto::seal('refresh-unit'),
            'access_expires_at' => time() + 600,
            'scopes' => ['release:read', 'deploy:ack'],
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'profile' => 'existing-theme',
            'environment' => 'staging',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] ??= 'connected';
        $connection = new Connection();
        $http = new HttpClient($connection);
        $releases = new ReleaseRepository();
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
        return new Sync(
            $connection,
            $http,
            new ReleaseVerifier($connection, new ScriptApprovals()),
            $releases,
            new Mapper($releases),
            $acknowledger,
            $lock,
            $rollbackActivator
        );
    }

    /** @param array<string,mixed> $manifest */
    private function acknowledgeLive(Sync $sync, array $manifest): bool|\WP_Error
    {
        return (new ReflectionMethod(Sync::class, 'acknowledgeState'))->invoke(
            $sync,
            $manifest,
            'live',
            ['activeHash' => $manifest['artifactHash']]
        );
    }

    private function setAcknowledgedState(Sync $sync, string $state): void
    {
        (new ReflectionProperty(Sync::class, 'lastAcknowledgedState'))->setValue($sync, $state);
    }

    /** @param array<string,mixed> $manifest */
    private function storeVerifiedActiveRelease(array $manifest): void
    {
        $GLOBALS['wpdb']->releaseRows[(string) $manifest['deploymentId']] = $this->rawReleaseRow($manifest, 'active');
    }

    /** @param array<string,mixed> $manifest @return array<string,mixed> */
    private function rawReleaseRow(array $manifest, string $status, bool $verified = true): array
    {
        return [
            'id' => 1,
            'release_id' => (string) $manifest['releaseId'],
            'deployment_id' => (string) $manifest['deploymentId'],
            'sequence_no' => (int) $manifest['sequence'],
            'source_version' => 1,
            'status' => $status,
            'manifest' => Support::json($manifest),
            'manifest_hash' => (string) $manifest['_manifestHash'],
            'deployment_hash' => (string) $manifest['_deploymentHash'],
            'artifact_hash' => (string) $manifest['artifactHash'],
            'created_at' => '2026-08-26 00:00:00',
            'verified_at' => $verified ? '2026-08-26 00:01:00' : null,
        ];
    }

    /** @param array<string,mixed> $manifest @return array<string,mixed> */
    private function release(array $manifest, string $status): array
    {
        return [
            'release_id' => $manifest['releaseId'],
            'deployment_id' => $manifest['deploymentId'],
            'sequence' => $manifest['sequence'],
            'status' => $status,
            'manifest' => $manifest,
            'manifest_hash' => $manifest['_manifestHash'],
            'deployment_hash' => $manifest['_deploymentHash'],
            'artifact_hash' => $manifest['artifactHash'],
            'verified_at' => null,
        ];
    }

    /** @return array<string,mixed> */
    private function manifest(): array
    {
        return [
            'releaseId' => 'release-ack-unit',
            'deploymentId' => 'release-ack-unit:target:7',
            'connectionId' => 'connection-unit',
            'siteId' => 'site-unit',
            'sequence' => 7,
            'artifactHash' => str_repeat('a', 64),
            '_manifestHash' => str_repeat('b', 64),
            '_deploymentHash' => str_repeat('c', 64),
        ];
    }
}
