<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\PairingConfirmation;
use Pagecraft\Connector\Revocation;
use RuntimeException;

final class ConnectionTest extends ConnectorTestCase
{
    public function test_pairing_uses_the_exact_camel_case_pkce_contract(): void
    {
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        parse_str((string) parse_url($begun['authorize_url'], PHP_URL_QUERY), $query);

        $this->assertSame('S256', $query['codeChallengeMethod']);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $query['codeChallenge']);
        $this->assertSame('site-unit', $query['siteId']);
        $this->assertSame('staging', $query['environment']);
        $this->assertSame('existing-theme', $query['profile']);
        $this->assertSame('http://localhost:8088', $query['targetOrigin']);
        $this->assertSame('/', $query['targetPath']);
        $this->assertSame('release:read deploy:ack cms:write editor:open content:index', $query['scope']);
        $this->assertSame('http://localhost:8088/wp-json/pagecraft/v1/releases/available', $query['webhookUrl']);
        $this->assertArrayNotHasKey('site_id', $query);
        $this->assertArrayNotHasKey('code_challenge', $query);
    }

    public function test_pairing_requires_an_explicit_supported_profile(): void
    {
        $this->expectException(RuntimeException::class);
        (new Connection())->beginPairing('http://localhost:8787', 'site-unit', '', 'staging');
    }

    public function test_pairing_requires_an_explicit_supported_environment(): void
    {
        $this->expectException(RuntimeException::class);
        (new Connection())->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', '');
    }

    public function test_scoped_credentials_are_stored_encrypted_with_wordpress_salts(): void
    {
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-unit');
        $connection->saveTokenResponse([
            'connectionId' => 'connection-unit',
            'siteId' => 'site-unit',
            'refreshToken' => 'refresh-secret-value',
            'accessToken' => 'access-secret-value',
            'expiresIn' => 900,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'environment' => 'staging',
            'profile' => 'existing-theme',
            'editorSessionUrl' => 'http://localhost:8787/v1/connections/connection-unit/editor-sessions',
            'keysetEnvelope' => \pagecraft_test_keyset_envelope(),
        ], 'http://localhost:8787', $pairing);

        $stored = $GLOBALS['pagecraft_test_options']['pagecraft_connection'];
        $encoded = json_encode($stored, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('refresh-secret-value', $encoded);
        $this->assertStringNotContainsString('access-secret-value', $encoded);
        $this->assertStringStartsWith('v', $stored['refresh_token']);
        $this->assertSame('refresh-secret-value', $connection->refreshToken());
        $this->assertSame('access-secret-value', $connection->accessToken());
        $this->assertSame('existing-theme', $stored['profile']);
        $this->assertSame('staging', $stored['environment']);
    }

    public function test_authenticated_requests_reject_direct_home_or_installation_binding_mutation(): void
    {
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-unit');
        $connection->saveTokenResponse([
            'connectionId' => 'connection-unit', 'siteId' => 'site-unit',
            'refreshToken' => 'refresh-secret-value', 'accessToken' => 'access-secret-value', 'expiresIn' => 900,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'environment' => 'staging', 'profile' => 'existing-theme',
            'editorSessionUrl' => 'http://localhost:8787/v1/connections/connection-unit/editor-sessions',
            'keysetEnvelope' => \pagecraft_test_keyset_envelope(),
        ], 'http://localhost:8787', $pairing);
        $calls = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function () use (&$calls): array {
            $calls++;
            return ['response' => ['code' => 204], 'body' => ''];
        };

        $GLOBALS['pagecraft_test_home'] = 'http://clone.local:8088';
        $origin = (new HttpClient($connection))->desiredRelease();
        $this->assertInstanceOf(\WP_Error::class, $origin);
        $this->assertSame('pagecraft_connection_binding_changed', $origin->get_error_code());
        $this->assertSame(0, $calls);

        $GLOBALS['pagecraft_test_home'] = 'http://localhost:8088';
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'cloned-installation';
        $installation = (new HttpClient($connection))->desiredRelease();
        $this->assertInstanceOf(\WP_Error::class, $installation);
        $this->assertSame('pagecraft_connection_binding_changed', $installation->get_error_code());
        $this->assertSame(0, $calls);
    }

    public function test_token_response_does_not_overwrite_old_binding_when_connected_mode_cannot_persist(): void
    {
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-unit');
        $old = [
            'connection_id' => 'connection-old',
            'site_id' => 'site-old',
            'api_origin' => 'http://localhost:8787',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = $old;
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'paused';
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name): ?bool {
            return $name === 'pagecraft_mode' ? false : null;
        };

        try {
            $connection->saveTokenResponse([
                'connectionId' => 'connection-new',
                'siteId' => 'site-unit',
                'refreshToken' => 'refresh-new',
                'accessToken' => 'access-new',
                'expiresIn' => 900,
                'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
                'environment' => 'staging',
                'profile' => 'existing-theme',
                'editorSessionUrl' => 'http://localhost:8787/v1/connections/connection-new/editor-sessions',
                'keysetEnvelope' => \pagecraft_test_keyset_envelope(),
            ], 'http://localhost:8787', $pairing);
            $this->fail('Expected Connected-mode persistence to fail.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('new Pagecraft credentials were not stored', $error->getMessage());
        }

        $this->assertSame($old, get_option('pagecraft_connection'));
        $this->assertSame('paused', $connection->mode());
    }

    public function test_pairing_and_token_storage_are_blocked_by_unresolved_rollback_lifecycle(): void
    {
        $connection = new Connection();
        $old = ['connection_id' => 'connection-old', 'site_id' => 'site-old'];
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = $old;
        $GLOBALS['pagecraft_test_options'][Connection::PENDING_TERMINAL_ACKS_OPTION] = [
            'deployment-old' => ['payload' => ['status' => 'rolled_back']],
        ];

        try {
            $connection->beginPairing('http://localhost:8787', 'site-new', 'existing-theme', 'staging');
            $this->fail('Expected pairing to remain bound to the pending rollback receipt.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('rollback receipt', $error->getMessage());
        }

        try {
            $connection->saveTokenResponse([], 'http://localhost:8787', []);
            $this->fail('Expected token storage to reject the pending rollback receipt.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('new credentials were not stored', $error->getMessage());
        }
        $this->assertSame($old, get_option('pagecraft_connection'));
    }

    public function test_live_receipt_blocks_disconnect_pairing_and_credential_replacement(): void
    {
        $connection = new Connection();
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-old',
            'site_id' => 'site-old',
            'api_origin' => 'http://localhost:8787',
            'refresh_token' => 'sealed-old',
        ];
        $GLOBALS['pagecraft_test_options'][Connection::PENDING_LIVE_ACKS_OPTION] = [
            'deployment-old' => ['payload' => ['status' => 'live']],
        ];
        $revocationCalls = 0;
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function () use (&$revocationCalls): array {
                $revocationCalls++;
                return [];
            }
        );

        $disconnect = $revocation->begin();
        $this->assertInstanceOf(\WP_Error::class, $disconnect);
        $this->assertSame('pagecraft_acknowledgement_reconciliation_pending', $disconnect->get_error_code());
        $this->assertSame(0, $revocationCalls);

        foreach (['pair', 'store'] as $operation) {
            try {
                if ($operation === 'pair') {
                    $connection->beginPairing('http://localhost:8787', 'site-new', 'existing-theme', 'staging');
                } else {
                    $connection->saveTokenResponse([], 'http://localhost:8787', []);
                }
                $this->fail('Expected the pending live receipt to keep the old credential binding.');
            } catch (RuntimeException $error) {
                $this->assertStringContainsString('live', strtolower($error->getMessage()));
            }
        }
        $this->assertSame('connection-old', $connection->connectionId());
    }

    public function test_configured_target_requires_explicit_revocation_before_new_pairing(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-old',
            'site_id' => 'site-old',
            'api_origin' => 'http://localhost:8787',
            'refresh_token' => 'sealed-old',
        ];

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Disconnect');
        (new Connection())->beginPairing('http://localhost:8787', 'site-new', 'existing-theme', 'staging');
    }

    public function test_pairing_verifier_survives_local_token_write_failure_until_exact_retry_commits(): void
    {
        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-unit', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-unit');
        $response = $this->tokenResponse('connection-retry', 'site-unit');
        $GLOBALS['pagecraft_test_update_option_handler'] = static fn (string $name): ?bool => $name === 'pagecraft_connection' ? false : null;

        try {
            $connection->saveTokenResponse($response, 'http://localhost:8787', $pairing);
            $this->fail('Expected the injected local credential write to fail.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('atomically store', $error->getMessage());
        }
        $retriedPairing = $connection->consumePairing($begun['state']);
        $this->assertSame($pairing['verifier'], $retriedPairing['verifier']);
        $this->assertSame([], $connection->all());

        $GLOBALS['pagecraft_test_update_option_handler'] = null;
        $connection->saveTokenResponse($response, 'http://localhost:8787', $retriedPairing);
        $this->assertSame('connection-retry', $connection->connectionId());
        $this->assertTrue($connection->pairingConfirmationPending());
        $this->assertSame('frozen', $connection->mode());
        $stillRetained = $connection->consumePairing($begun['state']);
        $this->assertSame($pairing['verifier'], $stillRetained['verifier']);

        $confirmation = new PairingConfirmation(
            $connection,
            new HttpClient($connection),
            static fn (string $idempotencyKey): array => [
                'connectionId' => 'connection-retry',
                'status' => 'active',
                'confirmedAt' => gmdate('c'),
                'alreadyConfirmed' => false,
            ]
        );
        $this->assertTrue($confirmation->retry());
        $this->assertFalse($connection->pairingConfirmationPending());
        $this->assertSame('connected', $connection->mode());
        try {
            $connection->consumePairing($begun['state']);
            $this->fail('Committed pairing verifier should be removed.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('expired', $error->getMessage());
        }
    }

    public function test_new_connection_resets_only_connection_bound_poll_and_ack_cursors(): void
    {
        $connection = new Connection();
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-old',
            'site_id' => 'site-old',
            'api_origin' => 'http://localhost:8787',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_release_etag'] = '"old-etag"';
        $GLOBALS['pagecraft_test_options']['pagecraft_deployment_ack_states'] = ['old-deployment' => 'live'];
        $begun = $connection->beginPairing('http://localhost:8787', 'site-new', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-unit');

        $connection->saveTokenResponse($this->tokenResponse('connection-new', 'site-new'), 'http://localhost:8787', $pairing);

        $this->assertSame('connection-new', $connection->connectionId());
        $this->assertSame('', get_option('pagecraft_release_etag'));
        $this->assertSame([], get_option('pagecraft_deployment_ack_states'));
    }

    /** @return array<string,mixed> */
    private function tokenResponse(string $connectionId, string $siteId): array
    {
        return [
            'connectionId' => $connectionId,
            'siteId' => $siteId,
            'refreshToken' => 'refresh-secret-value',
            'accessToken' => 'access-secret-value',
            'expiresIn' => 900,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'environment' => 'staging',
            'profile' => 'existing-theme',
            'editorSessionUrl' => 'http://localhost:8787/v1/connections/' . $connectionId . '/editor-sessions',
            'keysetEnvelope' => \pagecraft_test_keyset_envelope(),
        ];
    }
}
