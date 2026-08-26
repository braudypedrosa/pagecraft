<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\Revocation;

final class RevocationTest extends ConnectorTestCase
{
    public function test_response_loss_freezes_content_and_retries_before_forgetting_credentials(): void
    {
        $this->configuredConnection();
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-live-unit';
        $requests = [];
        $responses = [
            new \WP_Error('http_request_failed', 'Response lost after server commit.'),
            [
                'connectionId' => 'connection-unit',
                'status' => 'revoked',
                'revokedAt' => gmdate('c'),
                'alreadyRevoked' => true,
            ],
        ];
        $connection = new Connection();
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function (string $key, bool $retry) use (&$requests, &$responses): array|\WP_Error {
                $requests[] = ['key' => $key, 'retry' => $retry];
                return array_shift($responses);
            }
        );

        $lost = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame('pagecraft_revocation_pending', $lost->get_error_code());
        $this->assertSame('frozen', $connection->mode());
        $this->assertSame('deployment-live-unit', get_option('pagecraft_active_release_id'));
        $this->assertSame('access-secret-value', $connection->accessToken());
        $this->assertSame('refresh-secret-value', $connection->refreshToken());
        $pending = $revocation->pending();
        $this->assertSame(1, $pending['attempts']);
        $this->assertMatchesRegularExpression('/^wp-revoke-[a-f0-9]{48}$/', (string) $pending['idempotency_key']);
        $this->assertFalse($connection->setMode('connected'));

        $retried = $revocation->retry();

        $this->assertTrue($retried);
        $this->assertCount(2, $requests);
        $this->assertSame($requests[0]['key'], $requests[1]['key']);
        $this->assertFalse($requests[0]['retry']);
        $this->assertTrue($requests[1]['retry']);
        $this->assertSame('deployment-live-unit', get_option('pagecraft_active_release_id'));
        $this->assertSame('', $connection->accessToken());
        $this->assertSame('', $connection->refreshToken());
        $this->assertSame([], $revocation->pending());
        $this->assertFalse($connection->isConfigured());
        $this->assertSame('connection-unit', get_option('pagecraft_last_revocation')['connection_id']);
    }

    public function test_invalid_confirmation_remains_retryable_and_never_clears_secrets(): void
    {
        $this->configuredConnection();
        $connection = new Connection();
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static fn (string $key, bool $retry): array => [
                'connectionId' => 'another-connection',
                'status' => 'revoked',
                'revokedAt' => gmdate('c'),
                'alreadyRevoked' => false,
            ]
        );

        $result = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_revocation_pending', $result->get_error_code());
        $this->assertTrue($revocation->isPending());
        $this->assertSame('access-secret-value', $connection->accessToken());
        $this->assertSame('frozen', $connection->mode());
    }

    public function test_disconnect_does_not_freeze_or_call_server_when_revocation_intent_cannot_persist(): void
    {
        $this->configuredConnection();
        $before = get_option('pagecraft_connection');
        $requests = 0;
        $GLOBALS['pagecraft_test_update_option_handler'] = static fn (string $name): ?bool => $name === Revocation::OPTION ? false : null;
        $connection = new Connection();
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function () use (&$requests): array {
                $requests++;
                return [];
            }
        );

        $result = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_revocation_persist_failed', $result->get_error_code());
        $this->assertSame(0, $requests);
        $this->assertSame([], $revocation->pending());
        $this->assertSame($before, get_option('pagecraft_connection'));
        $this->assertSame('connected', $connection->mode());
        $this->assertSame('access-secret-value', $connection->accessToken());
        $this->assertSame('refresh-secret-value', $connection->refreshToken());
    }

    public function test_server_commit_receipt_survives_local_secret_removal_failure_and_retry_skips_network(): void
    {
        $this->configuredConnection();
        $requests = 0;
        $failCredentialRemoval = true;
        $GLOBALS['pagecraft_test_update_option_handler'] = static function (string $name, mixed $value) use (&$failCredentialRemoval): ?bool {
            if ($name === 'pagecraft_connection'
                && $failCredentialRemoval
                && is_array($value)
                && !array_key_exists('access_token', $value)
                && !array_key_exists('refresh_token', $value)) {
                $failCredentialRemoval = false;
                return false;
            }
            return null;
        };
        $connection = new Connection();
        $revokedAt = gmdate('c');
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function () use (&$requests, $revokedAt): array {
                $requests++;
                return [
                    'connectionId' => 'connection-unit',
                    'status' => 'revoked',
                    'revokedAt' => $revokedAt,
                    'alreadyRevoked' => false,
                ];
            }
        );

        $failedLocalCommit = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $failedLocalCommit);
        $this->assertSame('pagecraft_revocation_pending', $failedLocalCommit->get_error_code());
        $this->assertSame(1, $requests);
        $this->assertSame('remote_revoked', $revocation->pending()['phase']);
        $this->assertSame('pagecraft_revocation_local_finalize_failed', $revocation->pending()['last_error_code']);
        $this->assertSame($revokedAt, $revocation->pending()['revoked_at']);
        $this->assertSame('access-secret-value', $connection->accessToken());
        $this->assertSame('refresh-secret-value', $connection->refreshToken());
        $this->assertSame('frozen', $connection->mode());

        $retried = $revocation->retry();

        $this->assertTrue($retried);
        $this->assertSame(1, $requests, 'A durable remote receipt must make local cleanup retry without another DELETE.');
        $this->assertSame('', $connection->accessToken());
        $this->assertSame('', $connection->refreshToken());
        $this->assertFalse($connection->isConfigured());
        $this->assertSame('frozen', $connection->mode());
        $this->assertSame([], $revocation->pending());
        $this->assertSame('connection-unit', get_option('pagecraft_last_revocation')['connection_id']);
    }

    public function test_failed_initial_freeze_keeps_receipt_and_sends_no_server_request_until_retry(): void
    {
        $this->configuredConnection();
        $requests = 0;
        $GLOBALS['pagecraft_test_update_option_handler'] = static fn (string $name): ?bool => $name === 'pagecraft_mode' ? false : null;
        $connection = new Connection();
        $revocation = new Revocation(
            $connection,
            new HttpClient($connection),
            static function () use (&$requests): array {
                $requests++;
                return [
                    'connectionId' => 'connection-unit',
                    'status' => 'revoked',
                    'revokedAt' => gmdate('c'),
                    'alreadyRevoked' => false,
                ];
            }
        );

        $blocked = $revocation->begin();

        $this->assertInstanceOf(\WP_Error::class, $blocked);
        $this->assertSame('pagecraft_revocation_pending', $blocked->get_error_code());
        $this->assertSame(0, $requests);
        $this->assertSame('pending_remote', $revocation->pending()['phase']);
        $this->assertSame('pagecraft_revocation_freeze_failed', $revocation->pending()['last_error_code']);
        $this->assertSame('connected', $connection->mode());
        $this->assertSame('access-secret-value', $connection->accessToken());

        $GLOBALS['pagecraft_test_update_option_handler'] = null;
        $this->assertTrue($revocation->retry());
        $this->assertSame(1, $requests);
        $this->assertSame([], $revocation->pending());
    }

    public function test_http_contract_uses_delete_bearer_and_idempotency_header_without_a_body(): void
    {
        $this->configuredConnection();
        $captured = [];
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$captured): array {
            $captured = compact('url', 'args');
            return [
                'response' => ['code' => 200],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => json_encode([
                    'connectionId' => 'connection-unit',
                    'status' => 'revoked',
                    'revokedAt' => gmdate('c'),
                    'alreadyRevoked' => false,
                ], JSON_THROW_ON_ERROR),
            ];
        };

        $result = (new HttpClient(new Connection()))->revokeConnection('wp-revoke-unit-12345678');

        $this->assertIsArray($result);
        $this->assertSame('http://localhost:8787/v1/connections/connection-unit', $captured['url']);
        $this->assertSame('DELETE', $captured['args']['method']);
        $this->assertSame('wp-revoke-unit-12345678', $captured['args']['headers']['Idempotency-Key']);
        $this->assertSame('Bearer access-secret-value', $captured['args']['headers']['Authorization']);
        $this->assertSame('refresh-secret-value', $captured['args']['headers']['X-Pagecraft-Refresh-Token']);
        $this->assertArrayNotHasKey('body', $captured['args']);
    }

    public function test_expired_access_response_loss_never_rotates_and_retries_identical_credentials(): void
    {
        $this->configuredConnection();
        $connectionData = $GLOBALS['pagecraft_test_options']['pagecraft_connection'];
        $connectionData['access_expires_at'] = time() - HOUR_IN_SECONDS;
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = $connectionData;
        $requests = [];
        $attempt = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$requests, &$attempt): array|\WP_Error {
            $requests[] = compact('url', 'args');
            $attempt++;
            if ($attempt === 1) {
                return new \WP_Error('http_request_failed', 'Response lost after revoke commit.');
            }
            return [
                'response' => ['code' => 200],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => json_encode([
                    'connectionId' => 'connection-unit',
                    'status' => 'revoked',
                    'revokedAt' => gmdate('c'),
                    'alreadyRevoked' => true,
                ], JSON_THROW_ON_ERROR),
            ];
        };
        $connection = new Connection();
        $revocation = new Revocation($connection, new HttpClient($connection));

        $lost = $revocation->begin();
        $retried = $revocation->retry();

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertTrue($retried);
        $this->assertCount(2, $requests);
        foreach ($requests as $request) {
            $this->assertStringNotContainsString('/oauth/token', $request['url']);
            $this->assertSame('DELETE', $request['args']['method']);
            $this->assertSame('Bearer access-secret-value', $request['args']['headers']['Authorization']);
            $this->assertSame('refresh-secret-value', $request['args']['headers']['X-Pagecraft-Refresh-Token']);
        }
        $this->assertSame(
            $requests[0]['args']['headers']['Idempotency-Key'],
            $requests[1]['args']['headers']['Idempotency-Key']
        );
    }

    private function configuredConnection(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'api_origin' => 'http://localhost:8787',
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'profile' => 'existing-theme',
            'environment' => 'staging',
            'access_token' => Crypto::seal('access-secret-value'),
            'refresh_token' => Crypto::seal('refresh-secret-value'),
            'access_expires_at' => time() + HOUR_IN_SECONDS,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
    }
}
