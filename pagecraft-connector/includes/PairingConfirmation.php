<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/** Durable second phase of the WordPress OAuth connection handshake. */
final class PairingConfirmation
{
    public const RETRY_HOOK = 'pagecraft_connector_retry_pairing_confirmation';

    private readonly \Closure $sender;
    private readonly \Closure $exchanger;
    private readonly DeploymentLock $lifecycleLock;

    public function __construct(
        private readonly Connection $connection,
        private readonly HttpClient $http,
        ?\Closure $sender = null,
        ?\Closure $exchanger = null,
        ?DeploymentLock $lifecycleLock = null
    ) {
        $this->sender = $sender ?? fn (string $idempotencyKey): array|\WP_Error => $this->http->confirmConnection($idempotencyKey);
        $this->exchanger = $exchanger ?? fn (string $origin, string $code, string $verifier): array|\WP_Error => $this->http->exchangeCode($origin, $code, $verifier);
        $this->lifecycleLock = $lifecycleLock ?? new DeploymentLock();
    }

    public function hooks(): void
    {
        add_action(self::RETRY_HOOK, [$this, 'retry']);
        add_action('admin_init', [$this, 'retryDue']);
    }

    public function isPending(): bool
    {
        return $this->connection->pairingConfirmationPending()
            || $this->connection->pairingExchangePending()
            || $this->connection->pairingAuthorizationPending();
    }

    /** @return array{authorize_url:string,state:string}|\WP_Error */
    public function begin(string $apiOrigin, string $requestedSite, string $profile, string $environment): array|\WP_Error
    {
        $lease = $this->lifecycleLock->acquire('pairing');
        if (is_wp_error($lease)) {
            return $lease;
        }
        try {
            return $this->connection->beginPairing($apiOrigin, $requestedSite, $profile, $environment);
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @return bool|\WP_Error */
    public function retry(): bool|\WP_Error
    {
        $lease = $this->lifecycleLock->acquire('pairing');
        if (is_wp_error($lease)) {
            return $lease;
        }
        try {
            return $this->retryOwned();
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @return bool|\WP_Error */
    public function consumeAndRetry(string $state, string $authorizationCode): bool|\WP_Error
    {
        $lease = $this->lifecycleLock->acquire('pairing');
        if (is_wp_error($lease)) {
            return $lease;
        }
        try {
            $this->connection->consumePairing($state, $authorizationCode);
            return $this->retryOwned();
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @return bool|\WP_Error Caller owns the shared connection lifecycle lease. */
    private function retryOwned(): bool|\WP_Error
    {
        $exchangePending = $this->connection->pairingExchange();
        if ($exchangePending !== [] && !$this->connection->pairingConfirmationPending()) {
            if ($this->connection->revocationPending()) {
                return new \WP_Error(
                    'pagecraft_pairing_confirmation_revocation_pending',
                    'Pagecraft pairing recovery is suspended while server revocation is pending.'
                );
            }
            $recovered = $this->connection->recoverPairingExchange();
            if (is_wp_error($recovered)) {
                return $this->recordExchangeFailure($recovered, $exchangePending);
            }
            $pairing = $recovered['pairing'];
            $response = ($this->exchanger)(
                (string) ($pairing['api_origin'] ?? ''),
                (string) $recovered['code'],
                (string) ($pairing['verifier'] ?? '')
            );
            if (is_wp_error($response)) {
                return $this->recordExchangeFailure($response, $exchangePending);
            }
            try {
                $this->connection->saveTokenResponse($response, (string) ($pairing['api_origin'] ?? ''), $pairing);
            } catch (\RuntimeException $error) {
                return $this->recordExchangeFailure(new \WP_Error('pagecraft_pairing_token_store', $error->getMessage()), $exchangePending);
            }
            $exchangePending['phase'] = 'pending_confirmation';
            $exchangePending['last_error_code'] = null;
            $exchangePending['last_error_message'] = null;
            if (!$this->connection->persistPairingExchange($exchangePending)) {
                return $this->recordExchangeFailure(new \WP_Error(
                    'pagecraft_pairing_exchange_receipt_persist_failed',
                    'WordPress stored the provisional credentials but could not durably advance the pairing recovery journal.'
                ), $exchangePending);
            }
        }

        $pending = $this->connection->pairingConfirmation();
        if ($pending === []) {
            return true;
        }
        if ($this->connection->revocationPending()) {
            return new \WP_Error(
                'pagecraft_pairing_confirmation_revocation_pending',
                'Pagecraft connection confirmation is suspended while server revocation is pending.'
            );
        }

        $connectionId = (string) ($pending['connection_id'] ?? '');
        $installationId = (string) ($pending['installation_id'] ?? '');
        $idempotencyKey = (string) ($pending['idempotency_key'] ?? '');
        $phase = (string) ($pending['phase'] ?? '');
        if (!Support::validIdentifier($connectionId, 160)
            || !hash_equals($connectionId, $this->connection->connectionId())
            || !Support::validIdentifier($installationId, 160)
            || !hash_equals($installationId, $this->connection->installationId())
            || !preg_match('/^[A-Za-z0-9._:-]{8,160}$/', $idempotencyKey)
            || !in_array($phase, ['pending_remote', 'remote_confirmed'], true)
            || (string) ($pending['authorization_code'] ?? '') === ''
            || (string) ($pending['verifier'] ?? '') === '') {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_pairing_confirmation_record',
                'The durable Pagecraft confirmation transaction is invalid. The provisional credentials and PKCE material were retained for administrator recovery.'
            ), $pending);
        }
        try {
            if (Crypto::open((string) $pending['authorization_code']) === ''
                || Crypto::open((string) $pending['verifier']) === '') {
                throw new \RuntimeException('Empty retained pairing material.');
            }
        } catch (\RuntimeException $error) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_pairing_confirmation_secrets',
                'The retained Pagecraft authorization code or PKCE verifier cannot be opened.',
                ['cause' => $error->getMessage()]
            ), $pending);
        }

        if ($phase === 'pending_remote') {
            $response = ($this->sender)($idempotencyKey);
            if (is_wp_error($response)) {
                return $this->recordFailure($response, $pending);
            }
            if (!hash_equals($connectionId, (string) ($response['connectionId'] ?? ''))
                || (string) ($response['status'] ?? '') !== 'active'
                || !isset($response['confirmedAt'])
                || !strtotime((string) $response['confirmedAt'])
                || !array_key_exists('alreadyConfirmed', $response)
                || !is_bool($response['alreadyConfirmed'])) {
                return $this->recordFailure(new \WP_Error(
                    'pagecraft_pairing_confirmation_response',
                    'Pagecraft returned an invalid connection confirmation.'
                ), $pending);
            }

            // Store the remote commit before deleting either retained PKCE value.
            // A process interruption now resumes local cleanup without another
            // POST; failure here safely replays the same server idempotency key.
            $pending['phase'] = 'remote_confirmed';
            $pending['confirmed_at'] = (string) $response['confirmedAt'];
            $pending['already_confirmed'] = (bool) $response['alreadyConfirmed'];
            $pending['last_error_code'] = null;
            $pending['last_error_message'] = null;
            if (!$this->connection->persistPairingConfirmation($pending)) {
                return $this->recordFailure(new \WP_Error(
                    'pagecraft_pairing_confirmation_receipt_persist_failed',
                    'Pagecraft confirmed the connection, but WordPress could not durably store that confirmation. The exact request remains retryable.'
                ), $pending);
            }
        }

        if (!$this->connection->finishPairingConfirmation()) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_pairing_confirmation_finalize_failed',
                'Pagecraft confirmed the connection, but WordPress could not durably finish local pairing cleanup.'
            ), $pending);
        }

        if (function_exists('wp_clear_scheduled_hook')) {
            wp_clear_scheduled_hook(self::RETRY_HOOK);
        }
        do_action('pagecraft_connector_pairing_confirmed', $this->connection->publicData());
        return true;
    }

    public function retryDue(): void
    {
        $pending = $this->connection->pairingConfirmation();
        if ($pending === []) {
            $pending = $this->connection->pairingExchange();
        }
        if ($pending !== [] && (int) ($pending['next_attempt_at'] ?? 0) <= time()) {
            $this->retry();
        }
    }

    /** @return true|\WP_Error */
    public function abandon(string $reason = 'administrator'): bool|\WP_Error
    {
        $lease = $this->lifecycleLock->acquire('pairing-abort');
        if (is_wp_error($lease)) {
            return $lease;
        }
        try {
            return $this->connection->abandonPairingExchange($reason);
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @param array<string,mixed> $pending */
    private function recordFailure(\WP_Error $error, array $pending): \WP_Error
    {
        $attempts = (int) ($pending['attempts'] ?? 0) + 1;
        // The provisional server transaction has a finite confirmation window.
        // Retry at most five minutes apart so an outage through access-token
        // expiry still gets several refresh/confirm attempts before that window.
        $delay = min(5 * MINUTE_IN_SECONDS, max(MINUTE_IN_SECONDS, (2 ** min($attempts, 3)) * MINUTE_IN_SECONDS));
        $pending['attempts'] = $attempts;
        $pending['last_attempt_at'] = Support::utcNow();
        $pending['next_attempt_at'] = time() + $delay;
        $pending['last_error_code'] = (string) $error->get_error_code();
        $pending['last_error_message'] = wp_strip_all_tags($error->get_error_message());
        $this->connection->persistPairingConfirmation($pending);
        if (function_exists('wp_next_scheduled')
            && function_exists('wp_schedule_single_event')
            && !wp_next_scheduled(self::RETRY_HOOK)) {
            wp_schedule_single_event((int) $pending['next_attempt_at'], self::RETRY_HOOK);
        }
        return new \WP_Error(
            'pagecraft_pairing_confirmation_pending',
            'The Pagecraft connection is stored locally but still awaiting durable server confirmation. The exact pairing transaction will retry automatically.',
            ['cause' => $error->get_error_code(), 'retry_at' => $pending['next_attempt_at']]
        );
    }

    /** @param array<string,mixed> $pending */
    private function recordExchangeFailure(\WP_Error $error, array $pending): \WP_Error
    {
        $attempts = (int) ($pending['attempts'] ?? 0) + 1;
        $delay = min(5 * MINUTE_IN_SECONDS, max(MINUTE_IN_SECONDS, (2 ** min($attempts, 3)) * MINUTE_IN_SECONDS));
        $pending['attempts'] = $attempts;
        $pending['last_attempt_at'] = Support::utcNow();
        $pending['next_attempt_at'] = time() + $delay;
        $pending['last_error_code'] = (string) $error->get_error_code();
        $pending['last_error_message'] = wp_strip_all_tags($error->get_error_message());
        $this->connection->persistPairingExchange($pending);
        if (function_exists('wp_next_scheduled')
            && function_exists('wp_schedule_single_event')
            && !wp_next_scheduled(self::RETRY_HOOK)) {
            wp_schedule_single_event((int) $pending['next_attempt_at'], self::RETRY_HOOK);
        }
        return new \WP_Error(
            'pagecraft_pairing_exchange_pending',
            'The Pagecraft authorization response is retained securely and its exact token exchange will retry automatically.',
            ['cause' => $error->get_error_code(), 'retry_at' => $pending['next_attempt_at']]
        );
    }
}
