<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/** Durable, idempotent server revocation before local credential removal. */
final class Revocation
{
    public const OPTION = 'pagecraft_revocation_pending';
    public const RETRY_HOOK = 'pagecraft_connector_retry_revocation';
    private const PHASE_PENDING_REMOTE = 'pending_remote';
    private const PHASE_REMOTE_REVOKED = 'remote_revoked';

    private readonly \Closure $sender;
    private readonly DeploymentLock $lifecycleLock;

    public function __construct(
        private readonly Connection $connection,
        private readonly HttpClient $http,
        ?\Closure $sender = null,
        ?DeploymentLock $lifecycleLock = null
    ) {
        $this->sender = $sender ?? fn (string $idempotencyKey, bool $retry): array|\WP_Error => $this->http->revokeConnection($idempotencyKey);
        $this->lifecycleLock = $lifecycleLock ?? new DeploymentLock();
    }

    public function hooks(): void
    {
        add_action(self::RETRY_HOOK, [$this, 'retry']);
        add_action('admin_init', [$this, 'retryDue']);
    }

    /** @return array<string,mixed> */
    public function pending(): array
    {
        $pending = get_option(self::OPTION, []);
        return is_array($pending) ? $pending : [];
    }

    public function isPending(): bool
    {
        return $this->pending() !== [];
    }

    /** @return bool|\WP_Error */
    public function begin(): bool|\WP_Error
    {
        $lease = $this->lifecycleLock->acquire('revocation');
        if (is_wp_error($lease)) {
            return $lease;
        }
        try {
            return $this->beginOwned();
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @return bool|\WP_Error Caller owns the shared connection lifecycle lease. */
    private function beginOwned(): bool|\WP_Error
    {
        if ($this->connection->liveAcknowledgementPending()) {
            return new \WP_Error(
                'pagecraft_acknowledgement_reconciliation_pending',
                'Deliver the pending Pagecraft live acknowledgement before disconnecting. The original scoped credentials were retained.'
            );
        }
        if ($this->connection->rollbackLifecyclePending()) {
            return new \WP_Error(
                'pagecraft_rollback_reconciliation_pending',
                'Deliver the pending Pagecraft rollback receipt and explicitly Resume synchronization before disconnecting. The original scoped credentials were retained.'
            );
        }
        if (!$this->isPending() && $this->connection->pairingExchangeRequiresReconciliation()) {
            return new \WP_Error(
                'pagecraft_pairing_exchange_reconciliation_pending',
                'The retained Pagecraft token exchange may already have committed remotely. Retry or safely abandon that exact pairing transaction before disconnecting.'
            );
        }
        if (!$this->isPending()) {
            if (!$this->connection->isConfigured()) {
                return $this->connection->freeze(true)
                    ? true
                    : new \WP_Error(
                        'pagecraft_revocation_local_finalize_failed',
                        'WordPress could not durably freeze the disconnected Pagecraft target.'
                    );
            }
            $connectionId = $this->connection->connectionId();
            if (!Support::validIdentifier($connectionId, 160)) {
                return new \WP_Error('pagecraft_revocation_connection', 'The Pagecraft connection identifier is invalid. Credentials were retained.');
            }
            $keyMaterial = $connectionId . "\0" . $this->connection->installationId() . "\0" . random_bytes(32);
            $pending = [
                'connection_id' => $connectionId,
                'api_origin' => $this->connection->apiOrigin(),
                'idempotency_key' => 'wp-revoke-' . substr(hash('sha256', $keyMaterial), 0, 48),
                'phase' => self::PHASE_PENDING_REMOTE,
                'attempts' => 0,
                'requested_at' => Support::utcNow(),
                'next_attempt_at' => time(),
                'last_attempt_at' => null,
                'last_error_code' => null,
                'last_error_message' => null,
            ];
            if (!$this->persistPending($pending)) {
                return new \WP_Error(
                    'pagecraft_revocation_persist_failed',
                    'WordPress could not durably store the Pagecraft revocation request. No server request was sent and the scoped credentials were retained.'
                );
            }
        }

        return $this->retryOwned();
    }

    /** @return bool|\WP_Error */
    public function retry(): bool|\WP_Error
    {
        $lease = $this->lifecycleLock->acquire('revocation');
        if (is_wp_error($lease)) {
            return $lease;
        }
        try {
            return $this->retryOwned();
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @return bool|\WP_Error Caller owns the shared connection lifecycle lease. */
    private function retryOwned(): bool|\WP_Error
    {
        $pending = $this->pending();
        if ($pending === []) {
            return true;
        }
        $connectionId = (string) ($pending['connection_id'] ?? '');
        $idempotencyKey = (string) ($pending['idempotency_key'] ?? '');
        $phase = (string) ($pending['phase'] ?? self::PHASE_PENDING_REMOTE);
        if (!Support::validIdentifier($connectionId, 160)
            || !hash_equals($connectionId, $this->connection->connectionId())
            || !preg_match('/^[A-Za-z0-9._:-]{8,160}$/', $idempotencyKey)
            || !in_array($phase, [self::PHASE_PENDING_REMOTE, self::PHASE_REMOTE_REVOKED], true)) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_revocation_record_invalid',
                'The stored Pagecraft revocation request is invalid. Credentials were retained for administrator recovery.'
            ), $pending);
        }

        if ($phase === self::PHASE_REMOTE_REVOKED) {
            if (!isset($pending['revoked_at'])
                || !strtotime((string) $pending['revoked_at'])
                || !array_key_exists('already_revoked', $pending)
                || !is_bool($pending['already_revoked'])) {
                return $this->recordFailure(new \WP_Error(
                    'pagecraft_revocation_receipt_invalid',
                    'The stored Pagecraft revocation confirmation is invalid. Local credentials were retained for administrator recovery.'
                ), $pending);
            }
            return $this->finalizeLocalRevocation($pending);
        }

        // Advance the shared lifecycle fence before freezing or contacting the
        // server. Any Sync/CMS worker that captured the prior token is now
        // permanently unable to activate or write after this disconnect begins.
        $fenced = $this->ensureLifecycleFence($pending);
        if (is_wp_error($fenced)) {
            return $this->recordFailure($fenced, $pending);
        }
        $pending = $fenced;

        // Freeze public state before the first network request. Encrypted scoped
        // credentials remain only until server revocation is confirmed.
        if (!$this->connection->freeze(false)) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_revocation_freeze_failed',
                'WordPress could not durably freeze the active Pagecraft release, so no server revocation request was sent.'
            ), $pending);
        }
        if ($this->connection->accessToken() === '' && $this->connection->refreshToken() === '') {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_revocation_token_missing',
                'Server revocation cannot be retried because the scoped access credential is unavailable. The active release remains frozen.'
            ), $pending);
        }

        // DELETE never refreshes first. Every attempt reuses the same stored
        // scoped access/refresh credentials and durable idempotency key; Pagecraft
        // retains their digests solely to confirm an exact response-loss retry.
        $isRetry = (int) ($pending['attempts'] ?? 0) > 0 && $this->connection->accessToken() !== '';
        $response = ($this->sender)($idempotencyKey, $isRetry);
        if (is_wp_error($response)) {
            return $this->recordFailure($response, $pending);
        }
        if (!is_array($response)
            || !hash_equals($connectionId, (string) ($response['connectionId'] ?? ''))
            || (string) ($response['status'] ?? '') !== 'revoked'
            || !isset($response['revokedAt'])
            || !strtotime((string) $response['revokedAt'])
            || !array_key_exists('alreadyRevoked', $response)
            || !is_bool($response['alreadyRevoked'])) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_revocation_response_invalid',
                'Pagecraft returned an invalid revocation confirmation. Credentials were retained so the exact request can be retried.'
            ), $pending);
        }

        // Persist the remote commit before removing either local credential. If
        // WordPress stops here, retry() completes local cleanup without another
        // network request; if this write fails, the original exact DELETE can be
        // replayed using the still-retained credential and idempotency key.
        $pending['phase'] = self::PHASE_REMOTE_REVOKED;
        $pending['revoked_at'] = (string) $response['revokedAt'];
        $pending['already_revoked'] = (bool) $response['alreadyRevoked'];
        $pending['remote_confirmed_at'] = Support::utcNow();
        $pending['last_error_code'] = null;
        $pending['last_error_message'] = null;
        if (!$this->persistPending($pending)) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_revocation_receipt_persist_failed',
                'Pagecraft confirmed server revocation, but WordPress could not durably store the confirmation. The exact credential and request were retained for retry.'
            ), $pending);
        }

        return $this->finalizeLocalRevocation($pending);
    }

    /** @param array<string,mixed> $pending */
    private function finalizeLocalRevocation(array $pending): bool|\WP_Error
    {
        if (!$this->connection->freeze(true)) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_revocation_local_finalize_failed',
                'Pagecraft confirmed server revocation, but WordPress could not durably remove the local scoped credentials and freeze the target.'
            ), $pending);
        }

        $connectionId = (string) $pending['connection_id'];
        update_option('pagecraft_last_revocation', [
            'connection_id' => $connectionId,
            'revoked_at' => (string) $pending['revoked_at'],
            'already_revoked' => (bool) $pending['already_revoked'],
            'confirmed_at' => Support::utcNow(),
        ], false);

        delete_option(self::OPTION);
        if ($this->pending() !== []) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_revocation_receipt_clear_failed',
                'Pagecraft was revoked and local credentials were removed, but WordPress could not clear the durable revocation receipt.'
            ), $pending);
        }
        if (function_exists('wp_clear_scheduled_hook')) {
            wp_clear_scheduled_hook(self::RETRY_HOOK);
        }
        return true;
    }

    public function retryDue(): void
    {
        $pending = $this->pending();
        if ($pending !== [] && (int) ($pending['next_attempt_at'] ?? 0) <= time()) {
            $this->retry();
        }
    }

    /** @param array<string,mixed> $pending */
    private function recordFailure(\WP_Error $error, array $pending): \WP_Error
    {
        $attempts = (int) ($pending['attempts'] ?? 0) + 1;
        $delay = min(HOUR_IN_SECONDS, max(5 * MINUTE_IN_SECONDS, (2 ** min($attempts, 6)) * MINUTE_IN_SECONDS));
        $pending['attempts'] = $attempts;
        $pending['last_attempt_at'] = Support::utcNow();
        $pending['next_attempt_at'] = time() + $delay;
        $pending['last_error_code'] = (string) $error->get_error_code();
        $pending['last_error_message'] = wp_strip_all_tags($error->get_error_message());
        $this->persistPending($pending);
        if (function_exists('wp_next_scheduled')
            && function_exists('wp_schedule_single_event')
            && !wp_next_scheduled(self::RETRY_HOOK)) {
            wp_schedule_single_event((int) $pending['next_attempt_at'], self::RETRY_HOOK);
        }
        $remoteRevoked = (string) ($pending['phase'] ?? '') === self::PHASE_REMOTE_REVOKED;
        return new \WP_Error(
            'pagecraft_revocation_pending',
            $remoteRevoked
                ? 'Pagecraft confirmed server revocation, but local cleanup is still pending. The durable confirmation will retry without sending another server request.'
                : 'The active release is frozen, but Pagecraft has not confirmed server revocation yet. Encrypted credentials were retained only so this exact revocation can retry automatically.',
            ['cause' => $error->get_error_code(), 'retry_at' => $pending['next_attempt_at']]
        );
    }

    /** @param array<string,mixed> $pending */
    private function persistPending(array $pending): bool
    {
        update_option(self::OPTION, $pending, false);
        return $this->pending() === $pending;
    }

    /** @param array<string,mixed> $pending @return array<string,mixed>|\WP_Error */
    private function ensureLifecycleFence(array $pending): array|\WP_Error
    {
        $storedFence = (string) ($pending['lifecycle_fence'] ?? '');
        $connection = $this->connection->all();
        if ($storedFence !== ''
            && hash_equals($storedFence, (string) ($connection['lifecycle_fence'] ?? ''))) {
            return $pending;
        }
        $advanced = $this->connection->advanceLifecycleFence();
        if (is_wp_error($advanced)) {
            return $advanced;
        }
        $pending['lifecycle_fence'] = $advanced;
        $pending['lifecycle_fenced_at'] = Support::utcNow();
        if (!$this->persistPending($pending)) {
            return new \WP_Error(
                'pagecraft_revocation_lifecycle_persist_failed',
                'WordPress fenced in-flight Pagecraft work but could not durably bind the revocation receipt to that fence. No server request was sent.'
            );
        }
        return $pending;
    }
}
