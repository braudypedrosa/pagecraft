<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\DeploymentLock;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\PairingConfirmation;
use Pagecraft\Connector\Revocation;

final class PairingConfirmationTest extends ConnectorTestCase
{
    public function test_saved_binding_is_confirmed_with_exact_bearer_body_and_stable_idempotency_contract(): void
    {
        [$connection, $begun] = $this->savedProvisionalConnection();
        $captured = [];
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$captured): array {
            $captured = compact('url', 'args');
            return [
                'response' => ['code' => 200],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => json_encode([
                    'connectionId' => 'connection-confirm',
                    'status' => 'active',
                    'confirmedAt' => gmdate('c'),
                    'alreadyConfirmed' => false,
                ], JSON_THROW_ON_ERROR),
            ];
        };

        $result = (new PairingConfirmation($connection, new HttpClient($connection)))->retry();

        $this->assertTrue($result);
        $this->assertSame('http://localhost:8787/v1/connections/connection-confirm/confirm', $captured['url']);
        $this->assertSame('POST', $captured['args']['method']);
        $this->assertSame('Bearer access-secret-value', $captured['args']['headers']['Authorization']);
        $this->assertMatchesRegularExpression('/^wp-confirm-[a-f0-9]{48}$/', $captured['args']['headers']['Idempotency-Key']);
        $this->assertSame('{"installationId":"installation-unit"}', $captured['args']['body']);
        $this->assertSame(0, $captured['args']['redirection']);
        $this->assertFalse($connection->pairingConfirmationPending());
        $this->assertSame('connected', $connection->mode());
        $this->assertSame('access-secret-value', $connection->accessToken());
        $this->assertSame('refresh-secret-value', $connection->refreshToken());
        $this->assertSame(false, get_transient($this->pairingKey($begun['state'])));
    }

    public function test_lost_confirmation_response_retains_encrypted_pkce_transaction_and_replays_exact_request(): void
    {
        [$connection, $begun] = $this->savedProvisionalConnection();
        $requests = [];
        $responses = [
            new \WP_Error('http_request_failed', 'Confirmation response was lost.'),
            [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => true,
            ],
        ];
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static function (string $idempotencyKey) use (&$requests, &$responses): array|\WP_Error {
                $requests[] = $idempotencyKey;
                return array_shift($responses);
            }
        );

        $lost = $confirmation->retry();

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame('pagecraft_pairing_confirmation_pending', $lost->get_error_code());
        $pending = $connection->pairingConfirmation();
        $this->assertSame('pending_remote', $pending['phase']);
        $this->assertSame(1, $pending['attempts']);
        $this->assertSame('authorization-code-confirm', Crypto::open((string) $pending['authorization_code']));
        $this->assertNotSame('', Crypto::open((string) $pending['verifier']));
        $this->assertSame('frozen', $connection->mode());
        $this->assertIsArray(get_transient($this->pairingKey($begun['state'])));
        $this->assertSame('access-secret-value', $connection->accessToken());

        $retried = $confirmation->retry();

        $this->assertTrue($retried);
        $this->assertCount(2, $requests);
        $this->assertSame($requests[0], $requests[1]);
        $this->assertFalse($connection->pairingConfirmationPending());
        $this->assertSame(false, get_transient($this->pairingKey($begun['state'])));
        $this->assertSame('connected', $connection->mode());
    }

    public function test_remote_confirmation_survives_local_receipt_write_failure_and_finishes_without_second_post(): void
    {
        [$connection] = $this->savedProvisionalConnection();
        $requests = 0;
        $failRemoteReceipt = true;
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name, mixed $value) use (&$failRemoteReceipt): ?bool {
            $phase = is_array($value)
                && is_array($value['pairing_confirmation'] ?? null)
                ? (string) ($value['pairing_confirmation']['phase'] ?? '')
                : '';
            if ($name === 'pagecraft_connection' && $phase === 'remote_confirmed' && $failRemoteReceipt) {
                $failRemoteReceipt = false;
                return false;
            }
            return null;
        };
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static function () use (&$requests): array {
                $requests++;
                return [
                    'connectionId' => 'connection-confirm',
                    'status' => 'active',
                    'confirmedAt' => gmdate('c'),
                    'alreadyConfirmed' => false,
                ];
            }
        );

        $failedWrite = $confirmation->retry();

        $this->assertInstanceOf(\WP_Error::class, $failedWrite);
        $this->assertSame('pagecraft_pairing_confirmation_pending', $failedWrite->get_error_code());
        $this->assertSame(1, $requests);
        $this->assertSame('remote_confirmed', $connection->pairingConfirmation()['phase']);
        $this->assertTrue($confirmation->retry());
        $this->assertSame(1, $requests, 'A durable remote commit must complete locally without another confirmation POST.');
        $this->assertFalse($connection->pairingConfirmationPending());
        $this->assertSame('connected', $connection->mode());
    }

    public function test_confirmation_after_sixteen_minute_outage_tries_original_then_refreshes_on_401(): void
    {
        [$connection] = $this->savedProvisionalConnection();
        $data = $GLOBALS['pagecraft_test_options']['pagecraft_connection'];
        $data['access_expires_at'] = time() - MINUTE_IN_SECONDS;
        $data['pairing_confirmation']['requested_at'] = gmdate('c', time() - (16 * MINUTE_IN_SECONDS));
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = $data;

        $calls = [];
        $confirmationAttempts = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$calls, &$confirmationAttempts): array {
            $calls[] = ['url' => $url, 'args' => $args];
            if (str_ends_with($url, '/v1/oauth/token')) {
                return [
                    'response' => ['code' => 200],
                    'headers' => ['Content-Type' => 'application/json'],
                    'body' => json_encode([
                        'accessToken' => 'access-confirm-rotated',
                        'refreshToken' => 'refresh-confirm-rotated',
                        'expiresIn' => 900,
                    ], JSON_THROW_ON_ERROR),
                ];
            }
            $confirmationAttempts++;
            return [
                'response' => ['code' => $confirmationAttempts === 1 ? 401 : 200],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => $confirmationAttempts === 1 ? '{}' : json_encode([
                    'connectionId' => 'connection-confirm',
                    'status' => 'active',
                    'confirmedAt' => gmdate('c'),
                    'alreadyConfirmed' => false,
                ], JSON_THROW_ON_ERROR),
            ];
        };
        $client = new HttpClient($connection, $this->lock());

        $result = (new PairingConfirmation($connection, $client))->retry();

        $this->assertTrue($result);
        $this->assertCount(3, $calls);
        $this->assertStringEndsWith('/confirm', $calls[0]['url']);
        $this->assertStringEndsWith('/v1/oauth/token', $calls[1]['url']);
        $this->assertStringEndsWith('/confirm', $calls[2]['url']);
        $this->assertSame('Bearer access-secret-value', $calls[0]['args']['headers']['Authorization']);
        $this->assertSame('Bearer access-confirm-rotated', $calls[2]['args']['headers']['Authorization']);
        $this->assertSame($calls[0]['args']['headers']['Idempotency-Key'], $calls[2]['args']['headers']['Idempotency-Key']);
        $this->assertSame($calls[0]['args']['body'], $calls[2]['args']['body']);
        $this->assertSame('access-confirm-rotated', $connection->accessToken());
        $this->assertSame('refresh-confirm-rotated', $connection->refreshToken());
        $this->assertFalse($connection->pairingConfirmationPending());
    }

    public function test_lost_confirm_response_retries_with_original_token_without_rotation(): void
    {
        [$connection] = $this->savedProvisionalConnection();
        $calls = [];
        $attempt = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$calls, &$attempt): array|\WP_Error {
            $calls[] = ['url' => $url, 'args' => $args];
            $attempt++;
            if ($attempt === 1) {
                return new \WP_Error('http_request_failed', 'The confirmation response was lost.');
            }
            return [
                'response' => ['code' => 200],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => json_encode([
                    'connectionId' => 'connection-confirm',
                    'status' => 'active',
                    'confirmedAt' => gmdate('c'),
                    'alreadyConfirmed' => true,
                ], JSON_THROW_ON_ERROR),
            ];
        };
        $confirmation = new PairingConfirmation($connection, new HttpClient($connection, $this->lock()));

        $this->assertInstanceOf(\WP_Error::class, $confirmation->retry());
        $this->assertTrue($confirmation->retry());

        $this->assertCount(2, $calls);
        $this->assertSame('Bearer access-secret-value', $calls[0]['args']['headers']['Authorization']);
        $this->assertSame($calls[0]['args']['headers']['Authorization'], $calls[1]['args']['headers']['Authorization']);
        $this->assertSame($calls[0]['args']['headers']['Idempotency-Key'], $calls[1]['args']['headers']['Idempotency-Key']);
        $this->assertSame($calls[0]['args']['body'], $calls[1]['args']['body']);
        $this->assertFalse($connection->pairingConfirmationPending());
    }

    public function test_lost_token_exchange_response_is_durably_retried_by_same_pairing_transaction(): void
    {
        [$connection, $begun, $pairing] = $this->pendingTokenExchange();
        $exchangeCalls = [];
        $responses = [
            new \WP_Error('http_request_failed', 'The token response was lost after server commit.'),
            $this->tokenResponse(),
        ];
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ],
            static function (string $origin, string $code, string $verifier) use (&$exchangeCalls, &$responses): array|\WP_Error {
                $exchangeCalls[] = compact('origin', 'code', 'verifier');
                return array_shift($responses);
            }
        );

        $lost = $confirmation->retry();

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame('pagecraft_pairing_exchange_pending', $lost->get_error_code());
        $pending = $connection->pairingExchange();
        $this->assertSame('pending_token', $pending['phase']);
        $this->assertSame(1, $pending['attempts']);
        $this->assertLessThanOrEqual(5 * MINUTE_IN_SECONDS, (int) $pending['next_attempt_at'] - time());
        $this->assertIsArray(get_transient($this->pairingKey($begun['state'])));
        $this->assertFalse($connection->isConfigured());

        $this->assertTrue($confirmation->retry());
        $this->assertCount(2, $exchangeCalls);
        $this->assertSame($exchangeCalls[0], $exchangeCalls[1]);
        $this->assertSame('authorization-code-confirm', $exchangeCalls[0]['code']);
        $this->assertSame((string) $pairing['verifier'], $exchangeCalls[0]['verifier']);
        $this->assertSame('connected', $connection->mode());
        $this->assertFalse($connection->pairingExchangePending());
        $this->assertFalse($connection->pairingConfirmationPending());

        $admin = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Admin.php');
        $this->assertStringContainsString('pagecraft_pairing_retry', $admin);
        $this->assertStringContainsString('$this->pairingConfirmation->retry()', $admin);
    }

    public function test_token_exchange_recovery_survives_transient_eviction_with_only_sealed_durable_authority(): void
    {
        [$connection, $begun, $pairing] = $this->pendingTokenExchange();
        $journal = $connection->pairingExchange();
        $this->assertNotSame('', (string) ($journal['recovery_payload'] ?? ''));
        $serializedJournal = json_encode($journal, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('authorization-code-confirm', $serializedJournal);
        $this->assertStringNotContainsString((string) $pairing['verifier'], $serializedJournal);

        // Transients may be evicted by an object cache regardless of their TTL.
        delete_transient($this->pairingKey($begun['state']));
        $this->assertFalse(get_transient($this->pairingKey($begun['state'])));
        $exchanges = [];
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ],
            function (string $origin, string $code, string $verifier) use (&$exchanges): array {
                $exchanges[] = compact('origin', 'code', 'verifier');
                return $this->tokenResponse();
            }
        );

        $this->assertTrue($confirmation->retry());
        $this->assertCount(1, $exchanges);
        $this->assertSame('authorization-code-confirm', $exchanges[0]['code']);
        $this->assertSame((string) $pairing['verifier'], $exchanges[0]['verifier']);
        $this->assertFalse($connection->pairingExchangePending());
        $this->assertFalse($connection->pairingConfirmationPending());
        $this->assertSame('connected', $connection->mode());
    }

    public function test_confirmed_pairing_cleanup_recovers_if_connection_write_stops_after_exchange_journal_removal(): void
    {
        [$connection] = $this->savedProvisionalConnection();
        $requests = 0;
        $failConfirmationRemoval = true;
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name, mixed $value) use (&$failConfirmationRemoval): ?bool {
            if ($name === 'pagecraft_connection'
                && is_array($value)
                && !isset($value['pairing_confirmation'])
                && $failConfirmationRemoval) {
                $failConfirmationRemoval = false;
                return false;
            }
            return null;
        };
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static function () use (&$requests): array {
                $requests++;
                return [
                    'connectionId' => 'connection-confirm',
                    'status' => 'active',
                    'confirmedAt' => gmdate('c'),
                    'alreadyConfirmed' => false,
                ];
            }
        );

        $interrupted = $confirmation->retry();

        $this->assertInstanceOf(\WP_Error::class, $interrupted);
        $this->assertSame('pagecraft_pairing_confirmation_pending', $interrupted->get_error_code());
        $this->assertFalse($connection->pairingExchangePending(), 'The exchange journal is cleared before the fallible confirmation-record cleanup boundary.');
        $this->assertSame('remote_confirmed', $connection->pairingConfirmation()['phase']);
        $this->assertSame(1, $requests);

        $this->assertTrue($confirmation->retry());
        $this->assertSame(1, $requests, 'Recovery from the cleanup boundary must not exchange the code or confirm the server twice.');
        $this->assertFalse($connection->pairingConfirmationPending());
        $this->assertSame('connected', $connection->mode());
    }

    public function test_ambiguous_exchange_at_code_expiry_cannot_be_abandoned_and_exact_replay_can_confirm(): void
    {
        [$connection] = $this->pendingTokenExchange();
        $journal = $connection->pairingExchange();
        $journal['requested_at'] = gmdate('c', time() - (10 * MINUTE_IN_SECONDS));
        $journal['authorization_code_expires_at'] = time() - 1;
        $journal['authority_expires_at'] = time() + (30 * MINUTE_IN_SECONDS);
        $journal['last_error_code'] = 'http_request_failed';
        $this->assertTrue($connection->persistPairingExchange($journal));

        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ],
            fn (): array => $this->tokenResponse(),
            $this->lock()
        );

        $blocked = $confirmation->abandon();

        $this->assertInstanceOf(\WP_Error::class, $blocked);
        $this->assertSame('pagecraft_pairing_abandon_unavailable', $blocked->get_error_code());
        $this->assertTrue($connection->pairingExchangePending());
        $this->assertTrue($confirmation->retry(), 'A lost token response remains exactly replayable throughout the provisional confirmation window.');
        $this->assertSame('connected', $connection->mode());
    }

    public function test_explicit_invalid_grant_allows_audited_abort_and_fresh_pairing(): void
    {
        [$connection, $begun] = $this->pendingTokenExchange();
        $journal = $connection->pairingExchange();
        $journal['last_error_code'] = 'pagecraft_invalid_grant';
        $this->assertTrue($connection->persistPairingExchange($journal));
        $confirmation = new PairingConfirmation($connection, new HttpClient($connection), null, null, $this->lock());

        $this->assertTrue($confirmation->abandon());
        $this->assertFalse($connection->pairingExchangePending());
        $this->assertFalse(get_transient($this->pairingKey($begun['state'])));
        $audit = get_option('pagecraft_last_pairing_abandonment', []);
        $this->assertSame(hash('sha256', $begun['state']), $audit['state_hash']);
        $this->assertSame('pagecraft_invalid_grant', $audit['last_error_code']);
        $this->assertArrayNotHasKey('recovery_payload', $audit);

        $fresh = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $this->assertNotSame($begun['state'], $fresh['state']);
        $admin = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Admin.php');
        $this->assertStringContainsString('pagecraft_pairing_abort', $admin);
        $this->assertStringContainsString('$this->pairingConfirmation->abandon', $admin);
    }

    public function test_disconnect_cannot_overtake_an_inflight_token_exchange_on_shared_lifecycle_lock(): void
    {
        [$connection] = $this->pendingTokenExchange();
        $lock = $this->lock();
        $disconnectDuringExchange = null;
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'revoked',
                'revokedAt' => gmdate('c'),
                'alreadyRevoked' => false,
            ],
            $lock
        );
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ],
            function () use (&$disconnectDuringExchange, $revocation): array {
                $disconnectDuringExchange = $revocation->begin();
                return $this->tokenResponse();
            },
            $lock
        );

        $this->assertTrue($confirmation->retry());
        $this->assertInstanceOf(\WP_Error::class, $disconnectDuringExchange);
        $this->assertSame('pagecraft_sync_locked', $disconnectDuringExchange->get_error_code());
        $this->assertTrue($connection->isConfigured());
        $this->assertSame('connected', $connection->mode());

        $this->assertTrue($revocation->begin(), 'A later explicit Disconnect runs only after pairing releases the lifecycle lease.');
        $this->assertSame('', $connection->accessToken());
        $this->assertSame('frozen', $connection->mode());
    }

    public function test_disconnect_rejects_ambiguous_token_exchange_after_committed_response_loss(): void
    {
        [$connection] = $this->pendingTokenExchange();
        $exchangeCalls = 0;
        $responses = [
            new \WP_Error('http_request_failed', 'Token response was lost after the server committed.'),
            $this->tokenResponse(),
        ];
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ],
            static function () use (&$exchangeCalls, &$responses): array|\WP_Error {
                $exchangeCalls++;
                return array_shift($responses);
            },
            $this->lock()
        );

        $lost = $confirmation->retry();

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame('pagecraft_pairing_exchange_pending', $lost->get_error_code());
        $this->assertFalse($connection->isConfigured());
        $journal = $connection->pairingExchange();
        $this->assertSame('pending_token', $journal['phase']);

        $serverRevocations = 0;
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function () use (&$serverRevocations): array {
                $serverRevocations++;
                return [];
            },
            $this->lock()
        );
        $blocked = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $blocked);
        $this->assertSame('pagecraft_pairing_exchange_reconciliation_pending', $blocked->get_error_code());
        $this->assertSame(0, $serverRevocations);
        $this->assertSame($journal, $connection->pairingExchange(), 'Disconnect must retain the exact encrypted replay authority.');
        $this->assertTrue($confirmation->retry(), 'The blocked disconnect leaves the identical token exchange recoverable.');
        $this->assertSame(2, $exchangeCalls);
        $this->assertTrue($connection->isConfigured());
        $this->assertSame('connected', $connection->mode());

        $cli = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/CliCommand.php');
        $this->assertStringContainsString('$this->revocation->begin()', $cli);
        $this->assertStringContainsString('$result->get_error_code()', $cli);
    }

    public function test_pending_token_disconnect_stops_before_any_fallible_freeze_boundary(): void
    {
        [$connection] = $this->pendingTokenExchange();
        $journal = $connection->pairingExchange();
        $freezeWrites = 0;
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name) use (&$freezeWrites): ?bool {
            if ($name === 'pagecraft_connection' || $name === 'pagecraft_mode') {
                $freezeWrites++;
                throw new \RuntimeException('Injected process stop inside local freeze.');
            }
            return null;
        };
        $revocation = new Revocation($connection, new HttpClient($connection), null, $this->lock());

        $blocked = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $blocked);
        $this->assertSame('pagecraft_pairing_exchange_reconciliation_pending', $blocked->get_error_code());
        $this->assertSame(0, $freezeWrites, 'The ambiguity guard must run before freeze can partially mutate local state.');
        $this->assertSame($journal, $connection->pairingExchange());
        $this->assertFalse($connection->isConfigured());
        $this->assertSame([], $revocation->pending());
    }

    public function test_callback_consumption_and_journaling_share_the_disconnect_lifecycle_lock(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $lock = $this->lock();
        $disconnectDuringJournal = null;
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [],
            $lock
        );
        $interleaved = false;
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name, mixed $value) use (&$interleaved, &$disconnectDuringJournal, $revocation): ?bool {
            if (!$interleaved
                && $name === Connection::PAIRING_EXCHANGE_OPTION
                && is_array($value)
                && (string) ($value['phase'] ?? '') === 'pending_token') {
                $interleaved = true;
                $disconnectDuringJournal = $revocation->begin();
            }
            return null;
        };
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ],
            fn (): array => $this->tokenResponse(),
            $lock
        );

        $this->assertTrue($confirmation->consumeAndRetry($begun['state'], 'authorization-code-confirm'));
        $this->assertTrue($interleaved);
        $this->assertInstanceOf(\WP_Error::class, $disconnectDuringJournal);
        $this->assertSame('pagecraft_sync_locked', $disconnectDuringJournal->get_error_code());
        $this->assertTrue($connection->isConfigured());
        $this->assertFalse($connection->pairingExchangePending());
        $this->assertFalse($connection->pairingConfirmationPending());

        $admin = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Admin.php');
        $this->assertStringContainsString('consumeAndRetry($state, $code)', $admin);
        $this->assertStringNotContainsString('$this->connection->consumePairing($state, $code)', $admin);
    }

    public function test_disconnect_cancels_preauthorization_and_original_callback_cannot_reconnect(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $connection = new Connection();
        $lock = $this->lock();
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [],
            fn (): array => $this->tokenResponse(),
            $lock
        );
        $begun = $confirmation->begin('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $this->assertIsArray($begun);
        $this->assertTrue($connection->pairingAuthorizationPending());
        $revocation = new Revocation($connection, new HttpClient($connection), null, $lock);

        $this->assertTrue($revocation->begin());
        $this->assertFalse($connection->pairingAuthorizationPending());
        $this->assertFalse(get_transient($this->pairingKey($begun['state'])));
        $audit = get_option('pagecraft_last_pairing_cancellation', []);
        $this->assertSame(hash('sha256', $begun['state']), $audit['state_hash']);

        try {
            $confirmation->consumeAndRetry($begun['state'], 'authorization-code-confirm');
            $this->fail('A cancelled OAuth callback must not recreate a Pagecraft connection.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('cancelled', $error->getMessage());
        }
        $this->assertFalse($connection->isConfigured());
        $this->assertFalse($connection->pairingExchangePending());
    }

    public function test_disconnect_cannot_interleave_inside_durable_preauthorization_creation(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $connection = new Connection();
        $lock = $this->lock();
        $revocation = new Revocation($connection, new HttpClient($connection), null, $lock);
        $disconnectDuringBegin = null;
        $interleaved = false;
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name) use (&$interleaved, &$disconnectDuringBegin, $revocation): ?bool {
            if (!$interleaved && $name === Connection::PAIRING_AUTHORIZATION_OPTION) {
                $interleaved = true;
                $disconnectDuringBegin = $revocation->begin();
            }
            return null;
        };
        $confirmation = new PairingConfirmation($connection, new HttpClient($connection), null, null, $lock);

        $begun = $confirmation->begin('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');

        $this->assertIsArray($begun);
        $this->assertTrue($interleaved);
        $this->assertInstanceOf(\WP_Error::class, $disconnectDuringBegin);
        $this->assertSame('pagecraft_sync_locked', $disconnectDuringBegin->get_error_code());
        $this->assertTrue($connection->pairingAuthorizationPending());
        $this->assertTrue($revocation->begin(), 'Disconnect can cancel the complete authorization only after begin releases the lifecycle lease.');
        $this->assertFalse($connection->pairingAuthorizationPending());
    }

    public function test_committed_cancellation_marker_blocks_callback_after_immediate_cleanup_crash(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $connection = new Connection();
        $lock = $this->lock();
        $confirmation = new PairingConfirmation($connection, new HttpClient($connection), null, null, $lock);
        $begun = $confirmation->begin('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $this->assertIsArray($begun);
        $revocation = new Revocation($connection, new HttpClient($connection), null, $lock);
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name, mixed $value): ?bool {
            if ($name === Connection::PAIRING_CANCELLATIONS_OPTION) {
                // Simulate the durable DB write committing immediately before
                // PHP is terminated and before transient/journal cleanup.
                $GLOBALS['pagecraft_test_options'][$name] = $value;
                throw new \RuntimeException('Injected process stop after authoritative cancellation marker.');
            }
            return null;
        };

        try {
            $revocation->begin();
            $this->fail('Expected the injected post-marker process stop.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('authoritative cancellation marker', $error->getMessage());
        }
        $GLOBALS['pagecraft_test_update_option_handler'] = null;
        $this->assertTrue($connection->pairingAuthorizationPending(), 'Cleanup did not run in the injected crash window.');
        $this->assertIsArray(get_transient($this->pairingKey($begun['state'])));
        $tombstones = get_option(Connection::PAIRING_CANCELLATIONS_OPTION, []);
        $this->assertArrayHasKey(hash('sha256', $begun['state']), $tombstones);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('cancelled');
        $confirmation->consumeAndRetry($begun['state'], 'authorization-code-confirm');
    }

    public function test_transient_cleanup_failure_retains_authoritative_cancellation_and_retry_finishes_cleanup(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $connection = new Connection();
        $lock = $this->lock();
        $confirmation = new PairingConfirmation($connection, new HttpClient($connection), null, null, $lock);
        $begun = $confirmation->begin('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $this->assertIsArray($begun);
        $key = $this->pairingKey($begun['state']);
        $GLOBALS['pagecraft_test_delete_transient_handler'] = static fn (string $name): ?bool => $name === $key ? false : null;
        $revocation = new Revocation($connection, new HttpClient($connection), null, $lock);

        $failedCleanup = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $failedCleanup);
        $this->assertSame('pagecraft_revocation_local_finalize_failed', $failedCleanup->get_error_code());
        $this->assertTrue($connection->pairingAuthorizationPending());
        $this->assertIsArray(get_transient($key));
        try {
            $confirmation->consumeAndRetry($begun['state'], 'authorization-code-confirm');
            $this->fail('The durable cancellation tombstone must reject the still-present transient.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('cancelled', $error->getMessage());
        }

        $GLOBALS['pagecraft_test_delete_transient_handler'] = null;
        $this->assertTrue($revocation->begin());
        $this->assertFalse($connection->pairingAuthorizationPending());
        $this->assertFalse(get_transient($key));
    }

    public function test_local_connection_write_failure_retains_exchange_until_verified_retry(): void
    {
        [$connection] = $this->pendingTokenExchange();
        $connectionWriteAttempts = 0;
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name, mixed $value) use (&$connectionWriteAttempts): ?bool {
            if ($name === 'pagecraft_connection' && is_array($value) && isset($value['pairing_confirmation'])) {
                $connectionWriteAttempts++;
                if ($connectionWriteAttempts === 1) {
                    return false;
                }
            }
            return null;
        };
        $exchanges = 0;
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (): array => [
                'connectionId' => 'connection-confirm',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ],
            function () use (&$exchanges): array {
                $exchanges++;
                return $this->tokenResponse();
            }
        );

        $failed = $confirmation->retry();

        $this->assertInstanceOf(\WP_Error::class, $failed);
        $this->assertSame('pagecraft_pairing_exchange_pending', $failed->get_error_code());
        $this->assertFalse($connection->isConfigured());
        $this->assertTrue($connection->pairingExchangePending());

        $this->assertTrue($confirmation->retry());
        $this->assertSame(2, $exchanges, 'The identical retained code exchange remains retryable after a local option-write failure.');
        $this->assertTrue($connection->isConfigured());
        $this->assertSame('connected', $connection->mode());
        $this->assertFalse($connection->pairingExchangePending());
    }

    public function test_new_binding_is_not_exposed_or_confirmed_until_connection_cursors_reset_durably(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'api_origin' => 'http://localhost:8787',
            'connection_id' => 'connection-old',
            'site_id' => 'site-old',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'profile' => 'existing-theme',
            'environment' => 'staging',
            // A revoked historical binding intentionally has no refresh token.
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_release_etag'] = '"old-connection-etag"';
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = ['old-deployment' => 'live'];
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $connection->consumePairing($begun['state'], 'authorization-code-confirm');
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name): ?bool {
            return $name === 'pagecraft_release_etag' ? false : null;
        };
        $confirmCalls = 0;
        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static function () use (&$confirmCalls): array {
                $confirmCalls++;
                return [];
            },
            fn (): array => $this->tokenResponse()
        );

        $failed = $confirmation->retry();

        $this->assertInstanceOf(\WP_Error::class, $failed);
        $this->assertSame('pagecraft_pairing_exchange_pending', $failed->get_error_code());
        $this->assertSame('connection-old', $connection->connectionId());
        $this->assertSame('"old-connection-etag"', get_option('pagecraft_release_etag'));
        $this->assertSame(['old-deployment' => 'live'], get_option('pagecraft_deployment_ack_states'));
        $this->assertSame(0, $confirmCalls, 'Server confirmation cannot run before both connection-scoped cursors are durably reset.');
        $this->assertTrue($connection->pairingExchangePending());
        $this->assertFalse($connection->pairingConfirmationPending());
    }

    /** @return array{Connection,array{authorize_url:string,state:string}} */
    private function savedProvisionalConnection(): array
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-confirm');
        $connection->saveTokenResponse([
            'connectionId' => 'connection-confirm',
            'siteId' => 'site-unit',
            'refreshToken' => 'refresh-secret-value',
            'accessToken' => 'access-secret-value',
            'expiresIn' => 900,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'environment' => 'staging',
            'profile' => 'existing-theme',
            'editorSessionUrl' => 'http://localhost:8787/v1/connections/connection-confirm/editor-sessions',
            'keysetEnvelope' => \pagecraft_test_keyset_envelope(),
        ], 'http://localhost:8787', $pairing);
        $this->assertTrue($connection->pairingConfirmationPending());
        $this->assertSame('frozen', $connection->mode());
        return [$connection, $begun];
    }

    /** @return array{Connection,array{authorize_url:string,state:string},array<string,mixed>} */
    private function pendingTokenExchange(): array
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-confirm');
        $this->assertTrue($connection->pairingExchangePending());
        return [$connection, $begun, $pairing];
    }

    /** @return array<string,mixed> */
    private function tokenResponse(): array
    {
        return [
            'connectionId' => 'connection-confirm',
            'siteId' => 'site-unit',
            'refreshToken' => 'refresh-secret-value',
            'accessToken' => 'access-secret-value',
            'expiresIn' => 900,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'environment' => 'staging',
            'profile' => 'existing-theme',
            'editorSessionUrl' => 'http://localhost:8787/v1/connections/connection-confirm/editor-sessions',
            'keysetEnvelope' => \pagecraft_test_keyset_envelope(),
        ];
    }

    private function pairingKey(string $state): string
    {
        return 'pagecraft_pair_' . substr(hash('sha256', $state), 0, 32);
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
