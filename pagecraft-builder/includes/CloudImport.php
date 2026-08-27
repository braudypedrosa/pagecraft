<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

/** A manual, revocable Pagecraft Cloud reader. It never schedules work or writes cloud data. */
final class CloudImport
{
    private const OPTION = 'pagecraft_cloud_import_v1';
    private const INSTALLATION = 'pagecraft_installation_id';
    private const TRANSIENT_PREFIX = 'pagecraft_cloud_oauth_';

    public function origin(): string
    {
        return untrailingslashit((string) apply_filters('pagecraft_cloud_origin', 'https://build.itspagecraft.com'));
    }

    public function authorizationUrl(string $callback): string
    {
        $installation = (string) get_option(self::INSTALLATION, '');
        if ($installation === '') {
            $installation = 'wp-' . wp_generate_uuid4();
            update_option(self::INSTALLATION, $installation, false);
        }
        $verifier = $this->random(64);
        $state = $this->random(32);
        set_transient(self::TRANSIENT_PREFIX . hash('sha256', $state), [
            'verifier' => $verifier,
            'callback' => $callback,
        ], 10 * MINUTE_IN_SECONDS);
        return add_query_arg([
            'installation_id' => $installation,
            'redirect_uri' => $callback,
            'code_challenge' => $this->base64url(hash('sha256', $verifier, true)),
            'code_challenge_method' => 'S256',
            'state' => $state,
        ], $this->origin() . '/v1/wordpress-import/authorize');
    }

    public function complete(string $code, string $state, string $callback): void
    {
        $key = self::TRANSIENT_PREFIX . hash('sha256', $state);
        $pending = get_transient($key);
        delete_transient($key);
        if (!is_array($pending) || !hash_equals((string) ($pending['callback'] ?? ''), $callback)
            || !is_string($pending['verifier'] ?? null)) {
            throw new PackageException('The Pagecraft connection expired or its browser state did not match. Reconnect and try again.');
        }
        $reply = $this->postJson('/v1/wordpress-import/token', [
            'grant_type' => 'authorization_code', 'code' => $code,
            'code_verifier' => $pending['verifier'], 'redirect_uri' => $callback,
        ]);
        $this->storeTokens($reply);
    }

    /** @return array<string,mixed>|null */
    public function connection(): ?array
    {
        $encoded = get_option(self::OPTION, '');
        if (!is_string($encoded) || $encoded === '') return null;
        try {
            $decoded = json_decode($this->decrypt($encoded), true, 32, JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return list<array<string,mixed>> */
    public function projects(): array
    {
        $reply = $this->getJson('/v1/wordpress-import/projects');
        return is_array($reply['projects'] ?? null) ? array_values($reply['projects']) : [];
    }

    /** @return array{project:array<string,mixed>,pages:list<array<string,mixed>>} */
    public function pages(string $projectId): array
    {
        $reply = $this->getJson('/v1/wordpress-import/projects/' . rawurlencode($projectId) . '/pages');
        return [
            'project' => is_array($reply['project'] ?? null) ? $reply['project'] : [],
            'pages' => is_array($reply['pages'] ?? null) ? array_values($reply['pages']) : [],
        ];
    }

    public function download(string $projectId, string $pageId): string
    {
        $token = $this->accessToken();
        $temporary = wp_tempnam('pagecraft-cloud.pagecraft-page.zip');
        if (!is_string($temporary) || $temporary === '') {
            throw new PackageException('WordPress could not create a temporary file for the Pagecraft package.');
        }
        $response = wp_remote_get($this->origin() . '/v1/wordpress-import/projects/'
            . rawurlencode($projectId) . '/pages/' . rawurlencode($pageId) . '/package', [
                'headers' => ['Authorization' => 'Bearer ' . $token],
                'timeout' => 90, 'redirection' => 0, 'stream' => true, 'filename' => $temporary,
            ]);
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            if (is_file($temporary)) wp_delete_file($temporary);
            throw new PackageException($this->responseError($response, 'Pagecraft could not download this page package.'));
        }
        return $temporary;
    }

    public function disconnect(): void
    {
        $connection = $this->connection();
        if ($connection) {
            $this->postJson('/v1/wordpress-import/revoke', [
                'credential_id' => (string) ($connection['credential_id'] ?? ''),
                'refresh_token' => (string) ($connection['refresh_token'] ?? ''),
            ], false);
        }
        delete_option(self::OPTION);
    }

    /** @return array<string,mixed> */
    private function getJson(string $path): array
    {
        $response = wp_remote_get($this->origin() . $path, [
            'headers' => ['Authorization' => 'Bearer ' . $this->accessToken()],
            'timeout' => 20, 'redirection' => 0,
        ]);
        return $this->decodeResponse($response, 'Pagecraft Cloud could not be reached.');
    }

    private function accessToken(): string
    {
        $connection = $this->connection();
        if (!$connection) throw new PackageException('Connect your Pagecraft account before importing a cloud page.');
        if ((int) ($connection['expires_at'] ?? 0) > time() + 30 && !empty($connection['access_token'])) {
            return (string) $connection['access_token'];
        }
        $reply = $this->postJson('/v1/wordpress-import/token', [
            'grant_type' => 'refresh_token', 'refresh_token' => (string) ($connection['refresh_token'] ?? ''),
        ]);
        $this->storeTokens(array_merge($connection, $reply));
        return (string) $reply['access_token'];
    }

    /** @param array<string,mixed> $payload @return array<string,mixed> */
    private function postJson(string $path, array $payload, bool $throw = true): array
    {
        $response = wp_remote_post($this->origin() . $path, [
            'headers' => ['Content-Type' => 'application/json'], 'timeout' => 20, 'redirection' => 0,
            'body' => wp_json_encode($payload),
        ]);
        if (!$throw && (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) >= 400)) return [];
        return $this->decodeResponse($response, 'Pagecraft Cloud could not complete the request.');
    }

    /** @return array<string,mixed> */
    private function decodeResponse(mixed $response, string $fallback): array
    {
        if (is_wp_error($response)) throw new PackageException($fallback . ' ' . $response->get_error_message());
        $status = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode((string) wp_remote_retrieve_body($response), true);
        if ($status < 200 || $status >= 300 || !is_array($body)) {
            $message = is_array($body) ? (string) ($body['error'] ?? $fallback) : $fallback;
            if ($status === 401 || !empty($body['reconnect'])) {
                delete_option(self::OPTION);
                throw new PackageException('Your Pagecraft connection expired or was revoked. Reconnect your account.');
            }
            throw new PackageException($message);
        }
        return $body;
    }

    private function responseError(mixed $response, string $fallback): string
    {
        if (is_wp_error($response)) return $fallback . ' ' . $response->get_error_message();
        $body = json_decode((string) wp_remote_retrieve_body($response), true);
        return is_array($body) && !empty($body['error']) ? (string) $body['error'] : $fallback;
    }

    /** @param array<string,mixed> $tokens */
    private function storeTokens(array $tokens): void
    {
        $current = $this->connection() ?? [];
        $record = [
            'credential_id' => (string) ($tokens['credential_id'] ?? $current['credential_id'] ?? ''),
            'access_token' => (string) ($tokens['access_token'] ?? ''),
            'refresh_token' => (string) ($tokens['refresh_token'] ?? $current['refresh_token'] ?? ''),
            'expires_at' => time() + max(60, (int) ($tokens['expires_in'] ?? 900)),
            'connected_at' => (int) ($current['connected_at'] ?? time()),
        ];
        if ($record['credential_id'] === '' || $record['access_token'] === '' || $record['refresh_token'] === '') {
            throw new PackageException('Pagecraft returned an incomplete connection credential.');
        }
        $json = wp_json_encode($record);
        if (!is_string($json)) throw new PackageException('WordPress could not encode the Pagecraft credential.');
        update_option(self::OPTION, $this->encrypt($json), false);
    }

    private function encrypt(string $plaintext): string
    {
        $iv = random_bytes(12); $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $this->key(), OPENSSL_RAW_DATA, $iv, $tag);
        if (!is_string($ciphertext)) throw new PackageException('WordPress could not protect the Pagecraft credential.');
        return $this->base64url($iv . $tag . $ciphertext);
    }

    private function decrypt(string $encoded): string
    {
        $bytes = $this->fromBase64url($encoded);
        if (strlen($bytes) < 29) throw new \RuntimeException('invalid credential');
        $plaintext = openssl_decrypt(substr($bytes, 28), 'aes-256-gcm', $this->key(), OPENSSL_RAW_DATA,
            substr($bytes, 0, 12), substr($bytes, 12, 16));
        if (!is_string($plaintext)) throw new \RuntimeException('invalid credential');
        return $plaintext;
    }

    private function key(): string { return hash('sha256', wp_salt('auth') . '|' . get_option(self::INSTALLATION, ''), true); }
    private function random(int $bytes): string { return $this->base64url(random_bytes($bytes)); }
    private function base64url(string $bytes): string { return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '='); }
    private function fromBase64url(string $value): string
    {
        $decoded = base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4), true);
        if (!is_string($decoded)) throw new \RuntimeException('invalid credential');
        return $decoded;
    }
}
