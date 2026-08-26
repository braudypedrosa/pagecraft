<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class HttpClient
{
    private readonly DeploymentLock $tokenRefreshLock;

    public function __construct(private readonly Connection $connection, ?DeploymentLock $tokenRefreshLock = null)
    {
        $this->tokenRefreshLock = $tokenRefreshLock ?? new DeploymentLock(null, null, null, 'pagecraft_token_refresh_lock');
    }

    /** @return array<string,mixed>|\WP_Error */
    public function exchangeCode(string $origin, string $code, string $verifier): array|\WP_Error
    {
        return $this->jsonRequest('POST', $origin . '/v1/oauth/token', [
            'grantType' => 'authorization_code',
            'clientId' => 'pagecraft-wordpress-connector',
            'code' => $code,
            'codeVerifier' => $verifier,
            'redirectUri' => admin_url('admin-post.php?action=pagecraft_pairing_callback'),
        ], false);
    }

    /** @return array<string,mixed>|\WP_Error */
    public function confirmConnection(string $idempotencyKey): array|\WP_Error
    {
        $connectionId = $this->connection->connectionId();
        $installationId = $this->connection->installationId();
        if (!Support::validIdentifier($connectionId, 160)
            || !Support::validIdentifier($installationId, 160)
            || !preg_match('/^[A-Za-z0-9._:-]{8,160}$/', $idempotencyKey)) {
            return new \WP_Error('pagecraft_pairing_confirmation_request', 'The Pagecraft confirmation binding or idempotency key is invalid.');
        }
        $binding = $this->connection->bindingValid(true);
        if (is_wp_error($binding)) {
            return $binding;
        }
        $access = $this->connection->accessToken();
        if ($access === '') {
            return new \WP_Error('pagecraft_pairing_confirmation_token', 'The saved Pagecraft access credential is unavailable for confirmation.');
        }

        // Always try the exact access credential returned by the code exchange
        // first. A lost response can therefore be confirmed idempotently without
        // rotating anything. Only an explicit 401 permits one fenced provisional
        // refresh and one retry of the byte-identical confirmation request.
        $response = $this->sendConfirmationRequest(
            $connectionId,
            $installationId,
            $idempotencyKey,
            $access
        );
        if (is_wp_error($response)) {
            return $response;
        }
        if (wp_remote_retrieve_response_code($response) === 401) {
            $refreshed = $this->refreshAccessToken(true);
            if (is_wp_error($refreshed)) {
                return $refreshed;
            }
            $rotatedAccess = $this->connection->accessToken();
            if ($rotatedAccess === '') {
                return new \WP_Error('pagecraft_pairing_confirmation_token', 'The refreshed Pagecraft access credential was not stored for confirmation.');
            }
            $response = $this->sendConfirmationRequest(
                $connectionId,
                $installationId,
                $idempotencyKey,
                $rotatedAccess
            );
            if (is_wp_error($response)) {
                return $response;
            }
        }
        if (wp_remote_retrieve_response_code($response) !== 200) {
            return $this->responseError($response, 'Pagecraft connection confirmation endpoint');
        }
        try {
            $body = Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
        if (!hash_equals($connectionId, (string) ($body['connectionId'] ?? ''))
            || (string) ($body['status'] ?? '') !== 'active'
            || !isset($body['confirmedAt'])
            || !strtotime((string) $body['confirmedAt'])
            || !array_key_exists('alreadyConfirmed', $body)
            || !is_bool($body['alreadyConfirmed'])) {
            return new \WP_Error('pagecraft_pairing_confirmation_response', 'Pagecraft returned an invalid connection confirmation.');
        }
        return $body;
    }

    /** @return array<string,mixed>|\WP_Error */
    private function sendConfirmationRequest(
        string $connectionId,
        string $installationId,
        string $idempotencyKey,
        string $accessToken
    ): array|\WP_Error {
        return wp_safe_remote_request(
            $this->connection->apiOrigin() . '/v1/connections/' . rawurlencode($connectionId) . '/confirm',
            [
                'method' => 'POST',
                'headers' => [
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer ' . $accessToken,
                    'Idempotency-Key' => $idempotencyKey,
                ],
                'body' => Support::json(['installationId' => $installationId]),
                'timeout' => 15,
                'redirection' => 0,
                'user-agent' => 'Pagecraft-Connector/' . PAGECRAFT_CONNECTOR_VERSION . '; ' . home_url('/'),
            ]
        );
    }

    /** @return array<string,mixed>|\WP_Error|null */
    public function desiredRelease(string $etag = ''): array|\WP_Error|null
    {
        $headers = $etag !== '' ? ['If-None-Match' => $etag] : [];
        $response = $this->request('GET', '/v1/connections/' . rawurlencode($this->connection->connectionId()) . '/desired-release', [
            'headers' => $headers,
            'timeout' => 20,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status === 204 || $status === 304) {
            return null;
        }
        if ($status !== 200) {
            return $this->responseError($response, 'Pagecraft release endpoint');
        }
        try {
            $body = Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
        $body['_etag'] = wp_remote_retrieve_header($response, 'etag');
        return $body;
    }

    /** @param array<string,mixed> $payload @return array<string,mixed>|\WP_Error */
    public function acknowledge(array $payload): array|\WP_Error
    {
        if (!$this->connection->can('deploy:ack')) {
            return new \WP_Error('pagecraft_scope_missing', 'The connection cannot acknowledge deployments.');
        }
        $response = $this->request('POST', '/v1/connections/' . rawurlencode($this->connection->connectionId()) . '/deployments', [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => Support::json($payload),
            'timeout' => 10,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return $this->responseError($response, 'Pagecraft deployment endpoint');
        }
        try {
            return Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
    }

    /**
     * Replace the complete read-only WordPress native content index for this
     * connection. Generation makes PUT replay idempotent; no endpoint in this
     * client writes back to native WordPress posts.
     *
     * @param list<array{id:string,objectType:string,title:string,url:string,modifiedAt:string}> $items
     * @param array<string,mixed>|null $lifecycleSnapshot
     * @return array<string,mixed>|\WP_Error
     */
    public function publishContentIndex(
        int $generation,
        array $items,
        ?array $lifecycleSnapshot = null
    ): array|\WP_Error {
        if ($lifecycleSnapshot !== null) {
            $current = $this->connection->assertLifecycleSnapshot($lifecycleSnapshot);
            if (is_wp_error($current)) {
                return $current;
            }
        }
        if (!$this->connection->can('content:index')) {
            return new \WP_Error('pagecraft_scope_missing', 'The connection cannot publish the read-only WordPress content index.');
        }
        $installationId = $this->connection->installationId();
        if ($generation < 1
            || $generation > 9007199254740991
            || count($items) > 2000
            || !Support::validIdentifier($installationId, 160)) {
            return new \WP_Error('pagecraft_content_index_request', 'The WordPress content index generation, size, or installation binding is invalid.');
        }
        foreach ($items as $item) {
            if (!is_array($item)) {
                return new \WP_Error('pagecraft_content_index_request', 'The WordPress content index contains an invalid item.');
            }
            $title = is_string($item['title'] ?? null) ? trim((string) $item['title']) : '';
            $url = is_string($item['url'] ?? null) ? (string) $item['url'] : '';
            $urlParts = wp_parse_url($url);
            if (!preg_match('/^wp:(?:page|post):[1-9][0-9]*$/', (string) ($item['id'] ?? ''))
                || !in_array((string) ($item['objectType'] ?? ''), ['page', 'post'], true)
                || $title === ''
                || $this->utf16Length($title) > 240
                || preg_match('/[\x00-\x1f\x7f]/u', $title)
                || !is_array($urlParts)
                || !in_array(strtolower((string) ($urlParts['scheme'] ?? '')), ['http', 'https'], true)
                || (string) ($urlParts['host'] ?? '') === ''
                || strlen($url) > 2048
                || !is_string($item['modifiedAt'] ?? null)
                || !strtotime((string) $item['modifiedAt'])) {
                return new \WP_Error('pagecraft_content_index_request', 'The WordPress content index contains an invalid item.');
            }
        }
        $response = $this->request(
            'PUT',
            '/v1/connections/' . rawurlencode($this->connection->connectionId()) . '/content-index',
            [
                'headers' => ['Content-Type' => 'application/json'],
                'body' => Support::json([
                    'installationId' => $installationId,
                    'generation' => $generation,
                    'items' => $items,
                ]),
                'timeout' => 20,
            ]
        );
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return $this->responseError($response, 'Pagecraft WordPress content index endpoint');
        }
        $body = trim(wp_remote_retrieve_body($response));
        if ($body === '') {
            return ['status' => 'accepted'];
        }
        try {
            return Support::decodeObject($body);
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
    }

    /** @return array<string,mixed>|\WP_Error */
    public function revokeConnection(string $idempotencyKey): array|\WP_Error
    {
        if (!preg_match('/^[A-Za-z0-9._:-]{8,160}$/', $idempotencyKey)) {
            return new \WP_Error('pagecraft_revocation_idempotency', 'The Pagecraft revocation idempotency key is invalid.');
        }
        $connectionId = $this->connection->connectionId();
        if (!Support::validIdentifier($connectionId, 160)) {
            return new \WP_Error('pagecraft_revocation_connection', 'The Pagecraft connection identifier is invalid.');
        }
        $binding = $this->connection->bindingValid(true);
        if (is_wp_error($binding)) {
            return $binding;
        }
        $access = $this->connection->accessToken();
        $refresh = $this->connection->refreshToken();
        if ($access === '' && $refresh === '') {
            return new \WP_Error('pagecraft_revocation_token_missing', 'No scoped Pagecraft credential is available for server revocation.');
        }
        $headers = [
            'Accept' => 'application/json',
            'Idempotency-Key' => $idempotencyKey,
        ];
        if ($access !== '') {
            $headers['Authorization'] = 'Bearer ' . $access;
        }
        if ($refresh !== '') {
            $headers['X-Pagecraft-Refresh-Token'] = $refresh;
        }
        // Revocation deliberately bypasses request() so an expired access token
        // can never trigger refresh rotation before DELETE. The stable stored
        // access/refresh pair and idempotency key are reused after response loss.
        $response = wp_safe_remote_request($this->connection->apiOrigin() . '/v1/connections/' . rawurlencode($connectionId), [
            'method' => 'DELETE',
            'headers' => $headers,
            'timeout' => 15,
            'redirection' => 0,
            'user-agent' => 'Pagecraft-Connector/' . PAGECRAFT_CONNECTOR_VERSION . '; ' . home_url('/'),
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        if (wp_remote_retrieve_response_code($response) !== 200) {
            return $this->responseError($response, 'Pagecraft connection revocation endpoint');
        }
        try {
            return Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
    }

    /** @param array<string,mixed> $payload @return array<string,mixed>|\WP_Error */
    public function writeCmsDraft(
        string $sourceId,
        array $payload,
        int $writeSequence,
        string $idempotencyKey,
        ?array $lifecycleSnapshot = null
    ): array|\WP_Error
    {
        if ($lifecycleSnapshot !== null) {
            $current = $this->connection->assertLifecycleSnapshot($lifecycleSnapshot);
            if (is_wp_error($current)) {
                return $current;
            }
        }
        if (!$this->connection->can('cms:write')) {
            return new \WP_Error('pagecraft_scope_missing', 'The connection cannot write Pagecraft CMS drafts.');
        }
        $values = is_array($payload['values'] ?? null) ? $payload['values'] : [];
        $values = array_map(static fn (mixed $value): string => (string) $value, $values);
        if ($writeSequence < 1 || !preg_match('/^[A-Za-z0-9._:-]{8,160}$/', $idempotencyKey)) {
            return new \WP_Error('pagecraft_cms_sequence', 'The CMS draft outbox sequence or idempotency key is invalid.');
        }
        $response = $this->request('PATCH', '/v1/sites/' . rawurlencode($this->connection->siteId()) . '/cms', [
            'headers' => ['Content-Type' => 'application/json', 'Idempotency-Key' => $idempotencyKey],
            'body' => Support::json([
                'baseVersion' => (int) ($payload['baseVersion'] ?? 0),
                'writes' => [array_filter([
                    'collectionId' => (string) ($payload['collectionId'] ?? ''),
                    'itemId' => $sourceId,
                    'writeSequence' => $writeSequence,
                    'values' => $values,
                    'draft' => is_bool($payload['draft'] ?? null) ? $payload['draft'] : null,
                ], static fn (mixed $value): bool => $value !== null)],
            ]),
            'timeout' => 20,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return $this->responseError($response, 'Pagecraft CMS');
        }
        try {
            $body = Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
        $accepted = false;
        foreach ((array) ($body['writes'] ?? []) as $write) {
            if (is_array($write)
                && hash_equals((string) ($payload['collectionId'] ?? ''), (string) ($write['collectionId'] ?? ''))
                && hash_equals($sourceId, (string) ($write['itemId'] ?? ''))
                && (int) ($write['writeSequence'] ?? 0) === $writeSequence) {
                $accepted = true;
                break;
            }
        }
        if (!in_array((string) ($body['status'] ?? ''), ['applied', 'duplicate'], true) || !$accepted) {
            return new \WP_Error('pagecraft_cms_response_invalid', 'Pagecraft returned an invalid CMS write acknowledgement.');
        }
        return $body;
    }

    /**
     * Upload exact WordPress attachment bytes into the private Pagecraft CMS
     * draft asset store. The returned binding is verified before callers may
     * replace a private wp-media reference in their durable outbox payload.
     *
     * @return array{assetId:string,reference:string,hash:string,bytes:int,mime:string,duplicate:bool}|\WP_Error
     */
    public function uploadCmsAsset(
        string $filename,
        string $mime,
        string $bytes,
        string $hash,
        string $idempotencyKey,
        ?array $lifecycleSnapshot = null
    ): array|\WP_Error
    {
        if ($lifecycleSnapshot !== null) {
            $current = $this->connection->assertLifecycleSnapshot($lifecycleSnapshot);
            if (is_wp_error($current)) {
                return $current;
            }
        }
        if (!$this->connection->can('cms:write') || $this->connection->environment() !== 'production') {
            return new \WP_Error('pagecraft_scope_missing', 'Only a Production connection with cms:write may upload Pagecraft CMS draft assets.');
        }
        $length = strlen($bytes);
        $hash = strtolower($hash);
        $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
        if ($length < 1
            || $length > 10 * MB_IN_BYTES
            || !in_array($mime, $allowed, true)
            || !preg_match('/^[a-f0-9]{64}$/', $hash)
            || !hash_equals($hash, hash('sha256', $bytes))
            || !preg_match('/^[A-Za-z0-9._:-]{8,160}$/', $idempotencyKey)) {
            return new \WP_Error('pagecraft_cms_asset_request', 'The CMS asset bytes, MIME, hash, or idempotency key are invalid.');
        }
        $filename = sanitize_file_name($filename);
        if ($filename === '' || strlen($filename) > 191) {
            return new \WP_Error('pagecraft_cms_asset_filename', 'The CMS asset filename is invalid.');
        }
        $response = $this->request('POST', '/v1/sites/' . rawurlencode($this->connection->siteId()) . '/cms-assets', [
            'headers' => [
                'Content-Type' => $mime,
                'Content-Length' => (string) $length,
                'Idempotency-Key' => $idempotencyKey,
                'X-Pagecraft-Filename' => $filename,
                'X-Pagecraft-Content-SHA256' => $hash,
            ],
            'body' => $bytes,
            'timeout' => 60,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return $this->responseError($response, 'Pagecraft CMS asset endpoint');
        }
        try {
            $body = Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
        $assetId = (string) ($body['assetId'] ?? '');
        $reference = (string) ($body['reference'] ?? '');
        if (!Support::validIdentifier($assetId)
            || !hash_equals('asset:' . $assetId, $reference)
            || !hash_equals($hash, strtolower((string) ($body['hash'] ?? '')))
            || (int) ($body['bytes'] ?? -1) !== $length
            || !hash_equals($mime, strtolower((string) ($body['mime'] ?? '')))
            || !is_bool($body['duplicate'] ?? null)) {
            return new \WP_Error('pagecraft_cms_asset_response_invalid', 'Pagecraft returned an invalid CMS asset binding.');
        }
        return [
            'assetId' => $assetId,
            'reference' => $reference,
            'hash' => $hash,
            'bytes' => $length,
            'mime' => $mime,
            'duplicate' => (bool) $body['duplicate'],
        ];
    }

    /** @return array{url:string,expiresAt:string}|\WP_Error */
    public function mintEditorSession(string $pageId = ''): array|\WP_Error
    {
        if (!$this->connection->can('editor:open')) {
            return new \WP_Error('pagecraft_scope_missing', 'The connection cannot open Pagecraft editor sessions.');
        }
        $response = $this->request('POST', '/v1/connections/' . rawurlencode($this->connection->connectionId()) . '/editor-sessions', [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => Support::json([
                'installationId' => $this->connection->installationId(),
                'pageId' => $pageId,
            ]),
            'timeout' => 20,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return $this->responseError($response, 'Pagecraft editor session endpoint');
        }
        try {
            $body = Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
        $url = esc_url_raw((string) ($body['url'] ?? ''));
        $expiresAt = (string) ($body['expiresAt'] ?? '');
        $allowedOrigins = array_filter([
            Support::normalizeOrigin($this->connection->apiOrigin()),
            Support::normalizeOrigin($this->connection->editorUrl()),
        ]);
        if ($url === ''
            || !in_array(Support::normalizeOrigin($url), $allowedOrigins, true)
            || (!Support::environmentAllowsHttp($url) && !str_starts_with($url, 'https://'))
            || !strtotime($expiresAt)
            || strtotime($expiresAt) <= time()
            || strtotime($expiresAt) > time() + 10 * MINUTE_IN_SECONDS) {
            return new \WP_Error('pagecraft_editor_session_invalid', 'Pagecraft returned an invalid editor session.');
        }
        return ['url' => $url, 'expiresAt' => $expiresAt];
    }

    /** @return array<string,mixed>|\WP_Error */
    public function packageMetadata(string $slug): array|\WP_Error
    {
        if (!in_array($slug, ['pagecraft-connector', 'pagecraft-theme'], true)) {
            return new \WP_Error('pagecraft_package_slug', 'The Pagecraft package slug is invalid.');
        }
        $response = $this->request('GET', '/v1/packages/' . $slug, ['timeout' => 15]);
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return $this->responseError($response, 'Pagecraft package endpoint');
        }
        try {
            return Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
    }

    /** @return string|\WP_Error Local temporary filename. */
    public function download(string $url, int $expectedBytes = 0): string|\WP_Error
    {
        $parts = wp_parse_url($url);
        $origin = Support::normalizeOrigin($url);
        $allowed = (array) apply_filters('pagecraft_connector_artifact_origins', [$this->connection->apiOrigin()]);
        $allowed = array_values(array_filter(array_map([Support::class, 'normalizeOrigin'], $allowed)));
        if (!is_array($parts) || !in_array($origin, $allowed, true) || (!Support::environmentAllowsHttp($url) && ($parts['scheme'] ?? '') !== 'https')) {
            return new \WP_Error('pagecraft_artifact_origin', 'The release artifact URL is not on an approved HTTPS origin.');
        }

        $temporary = wp_tempnam('pagecraft-release.json');
        if (!$temporary) {
            return new \WP_Error('pagecraft_tempfile', 'WordPress could not create a release staging file.');
        }
        $headers = [];
        if ($origin === $this->connection->apiOrigin() && $this->connection->accessToken() !== '') {
            $headers['Authorization'] = 'Bearer ' . $this->connection->accessToken();
        }
        $response = wp_safe_remote_get($url, [
            'timeout' => 60,
            'redirection' => 0,
            'headers' => $headers,
            'stream' => true,
            'filename' => $temporary,
            'limit_response_size' => $expectedBytes > 0 ? $expectedBytes + 1 : 104857601,
            'user-agent' => 'Pagecraft-Connector/' . PAGECRAFT_CONNECTOR_VERSION . '; ' . home_url('/'),
        ]);
        if (is_wp_error($response)) {
            wp_delete_file($temporary);
            return $response;
        }
        if (wp_remote_retrieve_response_code($response) !== 200) {
            wp_delete_file($temporary);
            return new \WP_Error('pagecraft_download_http', 'The Pagecraft release artifact could not be downloaded.');
        }
        if ($expectedBytes > 0 && filesize($temporary) !== $expectedBytes) {
            wp_delete_file($temporary);
            return new \WP_Error('pagecraft_download_size', 'The release artifact size does not match its signed manifest.');
        }
        return $temporary;
    }

    /** @param array<string,mixed> $args @return array<string,mixed>|\WP_Error */
    private function jsonRequest(string $method, string $url, array $payload, bool $authenticated): array|\WP_Error
    {
        $args = [
            'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
            'body' => Support::json($payload),
            'timeout' => 20,
            'redirection' => 0,
        ];
        if ($authenticated && $this->connection->accessToken() !== '') {
            $args['headers']['Authorization'] = 'Bearer ' . $this->connection->accessToken();
        }
        $response = wp_safe_remote_request($url, array_merge($args, ['method' => $method]));
        if (is_wp_error($response)) {
            return $response;
        }
        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return $this->responseError($response, 'Pagecraft');
        }
        try {
            return Support::decodeObject(wp_remote_retrieve_body($response));
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_invalid_json', $error->getMessage());
        }
    }

    /** @param array<string,mixed> $args @return array<string,mixed>|\WP_Error */
    private function request(string $method, string $path, array $args = [], bool $allowRefresh = true): array|\WP_Error
    {
        $binding = $this->connection->bindingValid();
        if (is_wp_error($binding)) {
            return $binding;
        }
        if ($allowRefresh && $this->connection->tokenExpired()) {
            $refreshed = $this->refreshAccessToken(false);
            if (is_wp_error($refreshed)) {
                return $refreshed;
            }
        }

        $accessUsed = $this->connection->accessToken();
        $response = $this->sendAuthenticatedRequest($method, $path, $args, $accessUsed);
        if (!$allowRefresh || is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 401) {
            return $response;
        }

        // A concurrent worker may already have rotated tokens after this request
        // was sent. Otherwise force exactly one fenced refresh, then retry the
        // original method/path/body once. A second 401 is returned to the caller.
        $currentAccess = $this->connection->accessToken();
        if ($currentAccess === '' || ($accessUsed !== '' && hash_equals($accessUsed, $currentAccess))) {
            $refreshed = $this->refreshAccessToken(true);
            if (is_wp_error($refreshed)) {
                return $refreshed;
            }
        }
        return $this->sendAuthenticatedRequest($method, $path, $args, $this->connection->accessToken());
    }

    /** @param array<string,mixed> $args @return array<string,mixed>|\WP_Error */
    private function sendAuthenticatedRequest(string $method, string $path, array $args, string $accessToken): array|\WP_Error
    {
        $headers = isset($args['headers']) && is_array($args['headers']) ? $args['headers'] : [];
        $headers['Accept'] = 'application/json';
        $headers['Authorization'] = 'Bearer ' . $accessToken;
        $args['headers'] = $headers;
        $args['method'] = $method;
        $args['redirection'] = 0;
        $args['user-agent'] = 'Pagecraft-Connector/' . PAGECRAFT_CONNECTOR_VERSION . '; ' . home_url('/');
        return wp_safe_remote_request($this->connection->apiOrigin() . $path, $args);
    }

    /** @return true|\WP_Error */
    private function refreshAccessToken(bool $force): bool|\WP_Error
    {
        $lease = $this->tokenRefreshLock->acquire('token-refresh');
        if (is_wp_error($lease)) {
            return new \WP_Error('pagecraft_token_refresh_busy', 'Another Pagecraft token refresh is already in progress. Retry this request shortly.');
        }
        try {
            if (!$force && !$this->connection->tokenExpired()) {
                return true;
            }
            $refreshToken = $this->connection->refreshToken();
            if ($refreshToken === '') {
                return new \WP_Error('pagecraft_refresh_token_missing', 'The scoped Pagecraft refresh credential is unavailable.');
            }
            $response = $this->jsonRequest('POST', $this->connection->apiOrigin() . '/v1/oauth/token', [
                'grantType' => 'refresh_token',
                'clientId' => 'pagecraft-wordpress-connector',
                'refreshToken' => $refreshToken,
            ], false);
            if (is_wp_error($response)) {
                return $response;
            }
            try {
                if (!$this->connection->updateTokensIfCurrent($response, $refreshToken)) {
                    return new \WP_Error(
                        'pagecraft_token_store',
                        'WordPress could not durably store the refreshed Pagecraft credential before retrying the request.'
                    );
                }
            } catch (\RuntimeException $error) {
                return new \WP_Error('pagecraft_token_store', $error->getMessage());
            }
            return true;
        } finally {
            $this->tokenRefreshLock->release($lease);
        }
    }

    /** @param array<string,mixed> $response */
    private function responseError(array $response, string $context): \WP_Error
    {
        $status = wp_remote_retrieve_response_code($response);
        $code = 'pagecraft_http_' . $status;
        $message = sprintf('%s returned HTTP %d.', $context, $status);
        $data = ['status' => $status, 'retryable' => $status === 429 || $status >= 500];
        try {
            $body = Support::decodeObject(wp_remote_retrieve_body($response));
            $remoteCode = $body['code'] ?? $body['error'] ?? '';
            if (is_string($remoteCode) && $remoteCode !== '') {
                $code = 'pagecraft_' . sanitize_key($remoteCode);
            }
            if (isset($body['message']) && is_string($body['message']) && $body['message'] !== '') {
                $message = $body['message'];
            }
            $data['details'] = $body['details'] ?? null;
            if (isset($body['retryable'])) {
                $data['retryable'] = (bool) $body['retryable'];
            }
        } catch (\RuntimeException) {
            // Preserve the actionable HTTP fallback without exposing an HTML error page.
        }
        return new \WP_Error($code, $message, $data);
    }

    private function utf16Length(string $value): int
    {
        $characters = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($characters)) {
            return strlen($value);
        }
        $length = 0;
        foreach ($characters as $character) {
            $length += strlen($character) === 4 ? 2 : 1;
        }
        return $length;
    }
}
