<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\DeploymentLock;
use Pagecraft\Connector\HttpClient;

final class HttpClientRefreshTest extends ConnectorTestCase
{
    public function test_delayed_older_rotation_cannot_overwrite_newer_local_tokens(): void
    {
        $this->configuredConnection('access-a', 'refresh-a');
        $connection = new Connection();

        $stored = $connection->updateTokensIfCurrent([
            'accessToken' => 'access-b',
            'refreshToken' => 'refresh-b',
            'expiresIn' => 900,
        ], 'refresh-a');
        $delayed = $connection->updateTokensIfCurrent([
            'accessToken' => 'access-stale',
            'refreshToken' => 'refresh-stale',
            'expiresIn' => 900,
        ], 'refresh-a');

        $this->assertTrue($stored);
        $this->assertFalse($delayed);
        $this->assertSame('access-b', $connection->accessToken());
        $this->assertSame('refresh-b', $connection->refreshToken());
    }

    public function test_401_forces_one_fenced_refresh_and_retries_original_request_once(): void
    {
        $this->configuredConnection('access-b', 'refresh-b');
        $calls = [];
        $desiredAttempts = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$calls, &$desiredAttempts): array {
            $calls[] = ['url' => $url, 'args' => $args];
            if (str_ends_with($url, '/v1/oauth/token')) {
                return [
                    'response' => ['code' => 200],
                    'headers' => ['Content-Type' => 'application/json'],
                    'body' => json_encode([
                        'accessToken' => 'access-c',
                        'refreshToken' => 'refresh-c',
                        'expiresIn' => 900,
                    ], JSON_THROW_ON_ERROR),
                ];
            }
            $desiredAttempts++;
            return [
                'response' => ['code' => $desiredAttempts === 1 ? 401 : 204],
                'headers' => [],
                'body' => '',
            ];
        };
        $connection = new Connection();
        $client = new HttpClient($connection, $this->lock());

        $result = $client->desiredRelease();

        $this->assertNull($result);
        $this->assertCount(3, $calls);
        $this->assertStringEndsWith('/desired-release', $calls[0]['url']);
        $this->assertStringEndsWith('/v1/oauth/token', $calls[1]['url']);
        $this->assertStringEndsWith('/desired-release', $calls[2]['url']);
        $this->assertSame('Bearer access-b', $calls[0]['args']['headers']['Authorization']);
        $this->assertSame('Bearer access-c', $calls[2]['args']['headers']['Authorization']);
        $this->assertSame('access-c', $connection->accessToken());
        $this->assertSame('refresh-c', $connection->refreshToken());
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

    private function configuredConnection(string $access, string $refresh): void
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
            'access_token' => Crypto::seal($access),
            'refresh_token' => Crypto::seal($refresh),
            'access_expires_at' => time() + HOUR_IN_SECONDS,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
    }
}
