<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use RuntimeException;

final class Connection
{
    public const EMERGENCY_ROLLBACK_OPTION = 'pagecraft_emergency_rollback';
    public const PENDING_LIVE_ACKS_OPTION = 'pagecraft_pending_live_acknowledgements';
    public const PENDING_TERMINAL_ACKS_OPTION = 'pagecraft_pending_terminal_acknowledgements';
    public const PAIRING_AUTHORIZATION_OPTION = 'pagecraft_pairing_authorization_pending';
    public const PAIRING_CANCELLATIONS_OPTION = 'pagecraft_pairing_authorization_cancellations';
    public const PAIRING_EXCHANGE_OPTION = 'pagecraft_pairing_exchange_pending';
    private const OPTION = 'pagecraft_connection';
    private const ALLOWED_SCOPES = ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'];
    private const PROFILES = ['existing-theme', 'pagecraft-theme'];

    public function hooks(): void
    {
        add_action('update_option_home', [$this, 'flagOriginChange'], 10, 2);
        add_action('update_option_siteurl', [$this, 'flagOriginChange'], 10, 2);
    }

    /** @return array<string,mixed> */
    public function all(): array
    {
        $value = get_option(self::OPTION, []);
        return is_array($value) ? $value : [];
    }

    /** @return array<string,mixed> */
    public function publicData(): array
    {
        $value = $this->all();
        unset($value['access_token'], $value['refresh_token']);
        if (is_array($value['pairing_confirmation'] ?? null)) {
            unset(
                $value['pairing_confirmation']['authorization_code'],
                $value['pairing_confirmation']['verifier']
            );
        }
        return $value;
    }

    public function mode(): string
    {
        $mode = (string) get_option('pagecraft_mode', 'frozen');
        return in_array($mode, ['connected', 'paused', 'frozen'], true) ? $mode : 'frozen';
    }

    public function setMode(string $mode): bool
    {
        if (!in_array($mode, ['connected', 'paused', 'frozen'], true)) {
            return false;
        }
        if ($mode !== 'frozen' && $this->revocationPending()) {
            return false;
        }
        if ($mode === 'connected' && $this->emergencyRollbackRequiresResume()) {
            return false;
        }
        return update_option('pagecraft_mode', $mode, false);
    }

    public function emergencyRollbackRequiresResume(): bool
    {
        $intent = get_option(self::EMERGENCY_ROLLBACK_OPTION, []);
        return is_array($intent)
            && in_array((string) ($intent['status'] ?? ''), ['pending', 'active', 'activation_failed'], true);
    }

    public function terminalAcknowledgementPending(): bool
    {
        $pending = get_option(self::PENDING_TERMINAL_ACKS_OPTION, []);
        return is_array($pending) && $pending !== [];
    }

    public function liveAcknowledgementPending(): bool
    {
        $pending = get_option(self::PENDING_LIVE_ACKS_OPTION, []);
        return is_array($pending) && $pending !== [];
    }

    public function deploymentAcknowledgementPending(): bool
    {
        return $this->liveAcknowledgementPending() || $this->terminalAcknowledgementPending();
    }

    public function rollbackLifecyclePending(): bool
    {
        return $this->terminalAcknowledgementPending() || $this->emergencyRollbackRequiresResume();
    }

    public function pairingConfirmationPending(): bool
    {
        return $this->pairingConfirmation() !== [];
    }

    /** @return array<string,mixed> */
    public function pairingExchange(): array
    {
        $pending = get_option(self::PAIRING_EXCHANGE_OPTION, []);
        return is_array($pending) ? $pending : [];
    }

    public function pairingExchangePending(): bool
    {
        return $this->pairingExchange() !== [];
    }

    /**
     * A cache-bypassing lifecycle check for an OAuth exchange whose remote
     * commit is still ambiguous. Disconnect must preserve this exact replay
     * authority until pairing recovery either succeeds or is safely abandoned.
     */
    public function pairingExchangeRequiresReconciliation(): bool
    {
        $pending = $this->freshOption(self::PAIRING_EXCHANGE_OPTION, []);
        return is_array($pending) && $pending !== [];
    }

    /** @return array<string,mixed> */
    public function pairingAuthorization(): array
    {
        $pending = get_option(self::PAIRING_AUTHORIZATION_OPTION, []);
        return is_array($pending) ? $pending : [];
    }

    public function pairingAuthorizationPending(): bool
    {
        return $this->pairingAuthorization() !== [];
    }

    /** @return array<string,mixed> */
    public function pairingConfirmation(): array
    {
        $pending = $this->all()['pairing_confirmation'] ?? [];
        return is_array($pending) ? $pending : [];
    }

    /** Explicitly acknowledge the emergency rollback latch and resume sync. */
    public function resume(string $reason = 'administrator'): bool
    {
        if ($this->revocationPending()) {
            return false;
        }
        if ($this->terminalAcknowledgementPending()) {
            // Keep the rollback latch fail-closed until Sync has delivered the
            // exact durable terminal receipt. Resuming first could poll and
            // reactivate the deployment Pagecraft still considers current.
            return false;
        }
        $intent = get_option(self::EMERGENCY_ROLLBACK_OPTION, []);
        if ($this->emergencyRollbackRequiresResume() && is_array($intent)) {
            // Persist the connected mode first while the latch is still active.
            // A crash or failed mode write therefore remains fail-closed: even
            // force/manual sync checks the latch before observing the mode.
            if (!update_option('pagecraft_mode', 'connected', false) && $this->mode() !== 'connected') {
                return false;
            }
            $intentId = (string) ($intent['intent_id'] ?? '');
            if (!Support::validIdentifier($intentId, 160)) {
                return false;
            }
            $intent['status'] = 'resumed';
            $intent['resumed_at'] = Support::utcNow();
            $intent['resumed_by'] = get_current_user_id();
            $intent['resume_reason'] = sanitize_key($reason) ?: 'administrator';
            update_option(self::EMERGENCY_ROLLBACK_OPTION, $intent, false);
            $stored = get_option(self::EMERGENCY_ROLLBACK_OPTION, []);
            if (!is_array($stored)
                || (string) ($stored['status'] ?? '') !== 'resumed'
                || !hash_equals($intentId, (string) ($stored['intent_id'] ?? ''))) {
                return false;
            }
            return true;
        }
        return $this->setMode('connected') || $this->mode() === 'connected';
    }

    public function isConfigured(): bool
    {
        $data = $this->all();
        return !empty($data['connection_id']) && !empty($data['site_id']) && !empty($data['api_origin']) && !empty($data['refresh_token']);
    }

    /** @return true|\WP_Error */
    public function bindingValid(bool $allowPendingConfirmation = false): bool|\WP_Error
    {
        $data = $this->freshAll();
        if (empty($data['connection_id'])
            || empty($data['site_id'])
            || empty($data['api_origin'])
            || empty($data['refresh_token'])) {
            return new \WP_Error('pagecraft_not_connected', 'Pagecraft is not connected.');
        }
        $currentOrigin = Support::normalizeOrigin(home_url('/'));
        $storedOrigin = Support::normalizeOrigin((string) ($data['target_origin'] ?? ''));
        $currentPath = $this->targetPath();
        $storedPath = Support::normalizeRoute((string) ($data['target_path'] ?? ''));
        $currentInstallation = (string) get_option('pagecraft_installation_id', '');
        $storedInstallation = (string) ($data['installation_id'] ?? '');
        if ($currentOrigin === ''
            || $storedOrigin === ''
            || !hash_equals($storedOrigin, $currentOrigin)
            || !hash_equals($storedPath, $currentPath)
            || !Support::validIdentifier($currentInstallation, 160)
            || !Support::validIdentifier($storedInstallation, 160)
            || !hash_equals($storedInstallation, $currentInstallation)
            || !empty($data['origin_changed'])) {
            return new \WP_Error(
                'pagecraft_connection_binding_changed',
                'This Pagecraft credential is bound to a different WordPress origin, path, or installation. Re-pair this target before making authenticated requests.'
            );
        }
        if (!$allowPendingConfirmation && is_array($data['pairing_confirmation'] ?? null)) {
            return new \WP_Error(
                'pagecraft_connection_confirmation_pending',
                'The locally stored Pagecraft connection is awaiting server confirmation.'
            );
        }
        return true;
    }

    /**
     * Capture the exact credential lifecycle that authorizes a long-running
     * operation. Revocation and re-pairing advance this token so work that
     * started under an older connection cannot mutate pointers or write CMS
     * data after the administrator changes the connection lifecycle.
     *
     * @return array{token:string,connection_id:string,site_id:string,installation_id:string}|\WP_Error
     */
    public function lifecycleSnapshot(bool $allowPendingConfirmation = false): array|\WP_Error
    {
        $binding = $this->bindingValid($allowPendingConfirmation);
        if (is_wp_error($binding)) {
            return $binding;
        }
        if ($this->revocationPending()) {
            return new \WP_Error('pagecraft_connection_lifecycle_changed', 'Pagecraft server revocation started while this operation was running.');
        }
        $data = $this->freshAll();
        $token = (string) ($data['lifecycle_fence'] ?? '');
        if (!$this->validLifecycleToken($token)) {
            $token = Support::base64UrlEncode(random_bytes(24));
            $data['lifecycle_fence'] = $token;
            update_option(self::OPTION, $data, false);
            $stored = $this->all();
            if (!hash_equals($token, (string) ($stored['lifecycle_fence'] ?? ''))) {
                return new \WP_Error('pagecraft_connection_lifecycle_store', 'WordPress could not durably initialize the Pagecraft connection lifecycle fence.');
            }
        }
        return [
            'token' => $token,
            'connection_id' => (string) ($data['connection_id'] ?? ''),
            'site_id' => (string) ($data['site_id'] ?? ''),
            'installation_id' => (string) ($data['installation_id'] ?? ''),
        ];
    }

    /** @param array<string,mixed> $snapshot @return true|\WP_Error */
    public function assertLifecycleSnapshot(array $snapshot, bool $allowPendingConfirmation = false): bool|\WP_Error
    {
        if ($this->revocationPending()) {
            return new \WP_Error('pagecraft_connection_lifecycle_changed', 'Pagecraft server revocation invalidated this in-flight operation.');
        }
        $binding = $this->bindingValid($allowPendingConfirmation);
        if (is_wp_error($binding)) {
            return $binding;
        }
        $data = $this->freshAll();
        $expectedToken = (string) ($snapshot['token'] ?? '');
        $storedToken = (string) ($data['lifecycle_fence'] ?? '');
        if (!$this->validLifecycleToken($expectedToken)
            || !$this->validLifecycleToken($storedToken)
            || !hash_equals($expectedToken, $storedToken)
            || !hash_equals((string) ($snapshot['connection_id'] ?? ''), (string) ($data['connection_id'] ?? ''))
            || !hash_equals((string) ($snapshot['site_id'] ?? ''), (string) ($data['site_id'] ?? ''))
            || !hash_equals((string) ($snapshot['installation_id'] ?? ''), (string) ($data['installation_id'] ?? ''))) {
            return new \WP_Error(
                'pagecraft_connection_lifecycle_changed',
                'The Pagecraft connection changed while this operation was running. No external write or active-release mutation was allowed.'
            );
        }
        return true;
    }

    /** @return string|\WP_Error The newly durable lifecycle token. */
    public function advanceLifecycleFence(): string|\WP_Error
    {
        $data = $this->all();
        if ($data === []) {
            return new \WP_Error('pagecraft_connection_lifecycle_missing', 'No Pagecraft connection exists to fence.');
        }
        $token = Support::base64UrlEncode(random_bytes(24));
        $data['lifecycle_fence'] = $token;
        update_option(self::OPTION, $data, false);
        if (!hash_equals($token, (string) ($this->all()['lifecycle_fence'] ?? ''))) {
            return new \WP_Error('pagecraft_connection_lifecycle_store', 'WordPress could not durably advance the Pagecraft connection lifecycle fence.');
        }
        return $token;
    }

    public function revocationPending(): bool
    {
        $pending = $this->freshOption(Revocation::OPTION, []);
        return is_array($pending) && $pending !== [];
    }

    public function apiOrigin(): string
    {
        return (string) ($this->all()['api_origin'] ?? '');
    }

    public function connectionId(): string
    {
        return (string) ($this->all()['connection_id'] ?? '');
    }

    public function siteId(): string
    {
        return (string) ($this->all()['site_id'] ?? '');
    }

    public function editorUrl(): string
    {
        return (string) ($this->all()['editor_url'] ?? '');
    }

    public function profile(): string
    {
        $profile = (string) ($this->all()['profile'] ?? '');
        return in_array($profile, self::PROFILES, true) ? $profile : '';
    }

    public function environment(): string
    {
        $environment = (string) ($this->all()['environment'] ?? '');
        return in_array($environment, ['staging', 'production'], true) ? $environment : '';
    }

    /** @return list<string> */
    public function scopes(): array
    {
        $scopes = $this->all()['scopes'] ?? [];
        return is_array($scopes) ? array_values(array_filter($scopes, 'is_string')) : [];
    }

    public function can(string $scope): bool
    {
        return in_array($scope, $this->scopes(), true);
    }

    public function accessToken(): string
    {
        return $this->openSecret('access_token');
    }

    public function refreshToken(): string
    {
        return $this->openSecret('refresh_token');
    }

    /** @return array<string,mixed> */
    public function keyset(): array
    {
        $keyset = $this->all()['keyset'] ?? [];
        return is_array($keyset) ? $keyset : [];
    }

    public function installationId(): string
    {
        $id = (string) get_option('pagecraft_installation_id', '');
        if ($id === '') {
            $candidate = wp_generate_uuid4();
            add_option('pagecraft_installation_id', $candidate, '', false);
            // add_option is atomic. Re-read so a concurrent winner, rather than
            // this request's losing candidate, is always consent-bound.
            $id = (string) get_option('pagecraft_installation_id', '');
        }
        if (!Support::validIdentifier($id, 160)) {
            throw new RuntimeException('WordPress could not durably initialize the Pagecraft installation identifier.');
        }
        return $id;
    }

    /** @return array{authorize_url:string,state:string} */
    public function beginPairing(string $apiOrigin, string $requestedSite, string $profile, string $environment = ''): array
    {
        if ($this->revocationPending()) {
            throw new RuntimeException('Finish the pending Pagecraft server revocation before creating another connection.');
        }
        if ($this->pairingExchangePending()) {
            throw new RuntimeException('Finish or retry the retained Pagecraft pairing transaction before starting another connection.');
        }
        if ($this->pairingAuthorizationPending()) {
            throw new RuntimeException('Finish or cancel the pending Pagecraft authorization before starting another connection.');
        }
        if ($this->liveAcknowledgementPending()) {
            throw new RuntimeException('Deliver the pending Pagecraft live receipt before creating another connection.');
        }
        if ($this->rollbackLifecyclePending()) {
            throw new RuntimeException('Deliver the pending Pagecraft rollback receipt and explicitly Resume before creating another connection.');
        }
        if ($this->isConfigured()) {
            throw new RuntimeException('Disconnect and complete Pagecraft server revocation before pairing this WordPress target again.');
        }
        $origin = Support::normalizeOrigin($apiOrigin);
        if ($origin === '' || (!Support::environmentAllowsHttp($origin) && !str_starts_with($origin, 'https://'))) {
            throw new RuntimeException('Pagecraft must use a valid HTTPS origin.');
        }
        if ($requestedSite !== '' && !Support::validIdentifier($requestedSite)) {
            throw new RuntimeException('The requested Pagecraft site is invalid.');
        }
        if (!in_array($profile, self::PROFILES, true)) {
            throw new RuntimeException('Choose either Existing Theme or Pagecraft Theme before pairing.');
        }
        if (!in_array($environment, ['staging', 'production'], true)) {
            throw new RuntimeException('Choose either Staging or Production as the Pagecraft deployment target.');
        }

        $state = Support::base64UrlEncode(random_bytes(32));
        $verifier = Support::base64UrlEncode(random_bytes(48));
        $challenge = Support::base64UrlEncode(hash('sha256', $verifier, true));
        $key = $this->pairingKey($state);
        $redirect = admin_url('admin-post.php?action=pagecraft_pairing_callback');
        $targetOrigin = Support::normalizeOrigin(home_url('/'));
        if (Support::normalizeOrigin($redirect) !== $targetOrigin) {
            throw new RuntimeException('WordPress Home and Admin must share an origin for secure Pagecraft pairing.');
        }
        $authorization = [
            'user_id' => get_current_user_id(),
            'state' => $state,
            'verifier' => $verifier,
            'api_origin' => $origin,
            'site_id' => sanitize_text_field($requestedSite),
            'profile' => $profile,
            'environment' => $environment,
            'target_origin' => $targetOrigin,
            'target_path' => $this->targetPath(),
            'redirect_uri' => $redirect,
        ];
        if (!set_transient($key, $authorization, 10 * MINUTE_IN_SECONDS)
            || get_transient($key) !== $authorization) {
            throw new RuntimeException('WordPress could not retain the Pagecraft authorization state.');
        }
        $pendingAuthorization = [
            'status' => 'pending',
            'state' => $state,
            'transient_key' => $key,
            'user_id' => get_current_user_id(),
            'api_origin' => $origin,
            'requested_at' => Support::utcNow(),
            'expires_at' => time() + (10 * MINUTE_IN_SECONDS),
        ];
        update_option(self::PAIRING_AUTHORIZATION_OPTION, $pendingAuthorization, false);
        if ($this->pairingAuthorization() !== $pendingAuthorization) {
            delete_transient($key);
            throw new RuntimeException('WordPress could not durably journal the Pagecraft authorization state.');
        }

        $query = [
            'clientId' => 'pagecraft-wordpress-connector',
            'responseType' => 'code',
            'redirectUri' => $redirect,
            'codeChallenge' => $challenge,
            'codeChallengeMethod' => 'S256',
            'state' => $state,
            'siteId' => sanitize_text_field($requestedSite),
            'targetOrigin' => $targetOrigin,
            'targetPath' => $this->targetPath(),
            'installationId' => $this->installationId(),
            'environment' => $environment,
            'profile' => $profile,
            'scope' => implode(' ', self::ALLOWED_SCOPES),
            'webhookUrl' => rest_url('pagecraft/v1/releases/available'),
        ];

        return ['authorize_url' => add_query_arg($query, $origin . '/v1/oauth/authorize'), 'state' => $state];
    }

    /** @return array<string,mixed> */
    public function consumePairing(string $state, string $authorizationCode = ''): array
    {
        $key = $this->pairingKey($state);
        if ($this->pairingAuthorizationCancelled($state)) {
            throw new RuntimeException('The Pagecraft authorization was cancelled before this callback arrived.');
        }
        $authorization = $this->pairingAuthorization();
        $exchange = $this->pairingExchange();
        $authorizationValid = $authorization !== []
            && (string) ($authorization['status'] ?? '') === 'pending'
            && hash_equals($state, (string) ($authorization['state'] ?? ''))
            && hash_equals($key, (string) ($authorization['transient_key'] ?? ''))
            && (int) ($authorization['user_id'] ?? 0) === get_current_user_id()
            && (int) ($authorization['expires_at'] ?? 0) >= time();
        $exchangeValid = $exchange !== []
            && hash_equals($state, (string) ($exchange['state'] ?? ''))
            && hash_equals($key, (string) ($exchange['transient_key'] ?? ''))
            && (int) ($exchange['user_id'] ?? 0) === get_current_user_id()
            && (int) ($exchange['authority_expires_at'] ?? PHP_INT_MAX) >= time();
        if (!$authorizationValid && !$exchangeValid) {
            throw new RuntimeException('The Pagecraft authorization was cancelled, expired, or replaced before this callback arrived.');
        }
        $data = get_transient($key);
        if (!is_array($data)
            || !isset($data['state'], $data['user_id'])
            || !hash_equals((string) $data['state'], $state)
            || (int) $data['user_id'] !== get_current_user_id()) {
            throw new RuntimeException('The Pagecraft connection attempt expired or does not belong to this user.');
        }
        if ($authorizationCode !== '') {
            if (strlen($authorizationCode) < 8
                || strlen($authorizationCode) > 512
                || preg_match('/[\x00-\x20\x7f]/', $authorizationCode)) {
                throw new RuntimeException('Pagecraft returned an invalid authorization code.');
            }
            $storedCode = (string) ($data['authorization_code'] ?? '');
            if ($storedCode !== '') {
                try {
                    if (!hash_equals(Crypto::open($storedCode), $authorizationCode)) {
                        throw new RuntimeException('The Pagecraft authorization callback does not match the retained pairing transaction.');
                    }
                } catch (RuntimeException $error) {
                    throw new RuntimeException('The retained Pagecraft authorization code could not be verified.', 0, $error);
                }
            } else {
                $data['authorization_code'] = Crypto::seal($authorizationCode);
            }
        }
        // The OAuth server may commit before WordPress receives or persists the
        // token/confirmation response. Retain the verifier and encrypted code
        // for an identical callback retry; final confirmation removes both.
        if (!set_transient($key, $data, 30 * MINUTE_IN_SECONDS)
            || get_transient($key) !== $data) {
            throw new RuntimeException('WordPress could not retain the Pagecraft pairing transaction for a safe retry.');
        }
        if ($authorizationCode !== '') {
            $pending = $this->pairingExchange();
            try {
                // WordPress transients are caches and may be evicted before
                // their nominal expiry. Keep the retry authority in an
                // authenticated encrypted option until token exchange and
                // server confirmation have both completed.
                $recoveryPayload = Crypto::seal(json_encode(
                    $data,
                    JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES
                ));
            } catch (\JsonException|RuntimeException $error) {
                throw new RuntimeException('WordPress could not encrypt the Pagecraft pairing recovery transaction.', 0, $error);
            }
            if ($pending === []) {
                $pending = [
                    'state' => $state,
                    'transient_key' => $key,
                    'user_id' => (int) $data['user_id'],
                    'api_origin' => (string) $data['api_origin'],
                    'recovery_payload' => $recoveryPayload,
                    'phase' => 'pending_token',
                    'attempts' => 0,
                    'requested_at' => Support::utcNow(),
                    'authorization_code_expires_at' => time() + (10 * MINUTE_IN_SECONDS),
                    // A request just before code expiry may have committed and
                    // lost its response, leaving a provisioned connection for
                    // the server's additional 30-minute confirmation window.
                    // Keep the sealed recovery authority through that entire
                    // worst case; explicit invalid_grant can prove earlier
                    // abandonment safe.
                    'authority_expires_at' => time() + (40 * MINUTE_IN_SECONDS),
                    'next_attempt_at' => time(),
                    'last_attempt_at' => null,
                    'last_error_code' => null,
                    'last_error_message' => null,
                ];
            } elseif (!hash_equals($state, (string) ($pending['state'] ?? ''))
                || !hash_equals($key, (string) ($pending['transient_key'] ?? ''))) {
                throw new RuntimeException('Another Pagecraft pairing transaction is already awaiting recovery.');
            } else {
                // Refresh a legacy or repeated callback journal with the same
                // sealed authority without changing its retry identity.
                $pending['recovery_payload'] = $recoveryPayload;
            }
            if (!$this->persistPairingExchange($pending)) {
                throw new RuntimeException('WordPress could not durably journal the Pagecraft token exchange. No token request was sent.');
            }
            delete_option(self::PAIRING_AUTHORIZATION_OPTION);
            if ($this->pairingAuthorizationPending()) {
                throw new RuntimeException('WordPress retained the token exchange but could not close its pre-authorization phase. Pairing recovery remains available.');
            }
        }
        return $data;
    }

    /** @return true|\WP_Error */
    public function cancelPairingAuthorization(string $reason = 'disconnect'): bool|\WP_Error
    {
        $pending = $this->pairingAuthorization();
        if ($pending === []) {
            return true;
        }
        $state = (string) ($pending['state'] ?? '');
        $key = (string) ($pending['transient_key'] ?? '');
        if (strlen($state) < 32
            || strlen($state) > 160
            || !preg_match('/^[A-Za-z0-9_-]+$/', $state)
            || !hash_equals($this->pairingKey($state), $key)) {
            return new \WP_Error('pagecraft_pairing_authorization_record', 'The pending Pagecraft authorization record is invalid and was not silently discarded.');
        }
        $audit = [
            'state_hash' => hash('sha256', $state),
            'requested_at' => (string) ($pending['requested_at'] ?? ''),
            'expires_at' => max(time() + MINUTE_IN_SECONDS, (int) ($pending['expires_at'] ?? 0)),
            'cancelled_at' => Support::utcNow(),
            'cancelled_by' => get_current_user_id(),
            'reason' => sanitize_key($reason) ?: 'disconnect',
        ];
        $cancellations = $this->freshOption(self::PAIRING_CANCELLATIONS_OPTION, []);
        $cancellations = is_array($cancellations) ? $cancellations : [];
        foreach ($cancellations as $hash => $record) {
            if (!is_array($record) || (int) ($record['expires_at'] ?? 0) < time()) {
                unset($cancellations[$hash]);
            }
        }
        $cancellations[$audit['state_hash']] = $audit;
        update_option(self::PAIRING_CANCELLATIONS_OPTION, $cancellations, false);
        $storedCancellations = $this->freshOption(self::PAIRING_CANCELLATIONS_OPTION, []);
        if (!is_array($storedCancellations)
            || ($storedCancellations[$audit['state_hash']] ?? null) !== $audit) {
            return new \WP_Error(
                'pagecraft_pairing_authorization_cancel_marker',
                'WordPress could not durably invalidate the pending Pagecraft callback, so its authority was retained.'
            );
        }
        // This summary is convenient for administrators; the retained
        // state-hash tombstone above is the authoritative cancellation audit.
        update_option('pagecraft_last_pairing_cancellation', $audit, false);
        if (get_option('pagecraft_last_pairing_cancellation', []) !== $audit) {
            return new \WP_Error('pagecraft_pairing_authorization_cancel_audit', 'WordPress could not durably audit the cancelled Pagecraft authorization.');
        }
        delete_transient($key);
        if (get_transient($key) !== false) {
            return new \WP_Error('pagecraft_pairing_authorization_cancel', 'WordPress could not clear the cancelled Pagecraft authorization cache.');
        }
        delete_option(self::PAIRING_AUTHORIZATION_OPTION);
        if ($this->pairingAuthorizationPending()) {
            return new \WP_Error('pagecraft_pairing_authorization_cancel', 'WordPress could not clear the cancelled Pagecraft authorization journal.');
        }
        return true;
    }

    /** @param array<string,mixed> $pending */
    public function persistPairingExchange(array $pending): bool
    {
        update_option(self::PAIRING_EXCHANGE_OPTION, $pending, false);
        return $this->pairingExchange() === $pending;
    }

    /** @return array{pairing:array<string,mixed>,code:string}|\WP_Error */
    public function recoverPairingExchange(): array|\WP_Error
    {
        $pending = $this->pairingExchange();
        $state = (string) ($pending['state'] ?? '');
        $key = (string) ($pending['transient_key'] ?? '');
        if ($pending === []
            || strlen($state) < 32
            || strlen($state) > 160
            || !preg_match('/^[A-Za-z0-9_-]+$/', $state)
            || !hash_equals($this->pairingKey($state), $key)) {
            return new \WP_Error('pagecraft_pairing_recovery_record', 'The retained Pagecraft pairing recovery record is invalid.');
        }
        $pairing = null;
        $sealedRecovery = (string) ($pending['recovery_payload'] ?? '');
        if ($sealedRecovery !== '') {
            try {
                $decoded = json_decode(Crypto::open($sealedRecovery), true, 64, JSON_THROW_ON_ERROR);
                $pairing = is_array($decoded) ? $decoded : null;
            } catch (\JsonException|RuntimeException $error) {
                return new \WP_Error(
                    'pagecraft_pairing_recovery_secrets',
                    'The durable Pagecraft pairing recovery transaction cannot be opened.',
                    ['cause' => $error->getMessage()]
                );
            }
        }
        if (!is_array($pairing)) {
            // Backward compatibility for a journal written before durable
            // encrypted recovery payloads were introduced.
            $pairing = get_transient($key);
        }
        if (!is_array($pairing)
            || !hash_equals($state, (string) ($pairing['state'] ?? ''))
            || (int) ($pending['user_id'] ?? 0) !== (int) ($pairing['user_id'] ?? -1)
            || !hash_equals((string) ($pending['api_origin'] ?? ''), (string) ($pairing['api_origin'] ?? ''))
            || (string) ($pairing['authorization_code'] ?? '') === '') {
            return new \WP_Error('pagecraft_pairing_recovery_expired', 'The retained Pagecraft pairing transaction expired before token exchange. An administrator must resolve or restart pairing.');
        }
        try {
            $code = Crypto::open((string) $pairing['authorization_code']);
        } catch (RuntimeException $error) {
            return new \WP_Error('pagecraft_pairing_recovery_secrets', 'The retained Pagecraft authorization code cannot be opened.', ['cause' => $error->getMessage()]);
        }
        if ($code === '' || (string) ($pairing['verifier'] ?? '') === '') {
            return new \WP_Error('pagecraft_pairing_recovery_secrets', 'The retained Pagecraft token exchange material is incomplete.');
        }
        return ['pairing' => $pairing, 'code' => $code];
    }

    public function pairingExchangeAbandonable(): bool
    {
        $pending = $this->pairingExchange();
        if ($pending === []
            || $this->isConfigured()
            || $this->pairingConfirmationPending()
            || (string) ($pending['phase'] ?? '') !== 'pending_token') {
            return false;
        }
        $lastError = (string) ($pending['last_error_code'] ?? '');
        return (int) ($pending['authority_expires_at'] ?? PHP_INT_MAX) <= time()
            || in_array($lastError, ['invalid_grant', 'pagecraft_invalid_grant'], true);
    }

    /** @return true|\WP_Error */
    public function abandonPairingExchange(string $reason = 'administrator'): bool|\WP_Error
    {
        if (!$this->pairingExchangeAbandonable()) {
            return new \WP_Error(
                'pagecraft_pairing_abandon_unavailable',
                'The retained Pagecraft authorization is still valid or has already advanced; retry it instead of abandoning it.'
            );
        }
        $pending = $this->pairingExchange();
        $state = (string) ($pending['state'] ?? '');
        $key = (string) ($pending['transient_key'] ?? '');
        if (!hash_equals($this->pairingKey($state), $key)) {
            return new \WP_Error('pagecraft_pairing_recovery_record', 'The retained Pagecraft pairing recovery record is invalid.');
        }
        $audit = [
            'state_hash' => hash('sha256', $state),
            'requested_at' => (string) ($pending['requested_at'] ?? ''),
            'authority_expires_at' => (int) ($pending['authority_expires_at'] ?? 0),
            'last_error_code' => (string) ($pending['last_error_code'] ?? ''),
            'abandoned_at' => Support::utcNow(),
            'abandoned_by' => get_current_user_id(),
            'reason' => sanitize_key($reason) ?: 'administrator',
        ];
        update_option('pagecraft_last_pairing_abandonment', $audit, false);
        if (get_option('pagecraft_last_pairing_abandonment', []) !== $audit) {
            return new \WP_Error('pagecraft_pairing_abandon_audit', 'WordPress could not durably audit the abandoned Pagecraft pairing transaction.');
        }
        delete_transient($key);
        if (get_transient($key) !== false) {
            return new \WP_Error('pagecraft_pairing_abandon_cleanup', 'WordPress could not remove the expired Pagecraft authorization cache.');
        }
        delete_option(self::PAIRING_EXCHANGE_OPTION);
        if ($this->pairingExchangePending()) {
            return new \WP_Error('pagecraft_pairing_abandon_cleanup', 'WordPress could not remove the expired Pagecraft pairing recovery transaction.');
        }
        return true;
    }

    /** @param array<string,mixed> $response */
    public function saveTokenResponse(array $response, string $apiOrigin, array $pairing): void
    {
        if ($this->revocationPending()) {
            throw new RuntimeException('A Pagecraft server revocation is pending; new credentials were not stored.');
        }
        if ($this->liveAcknowledgementPending()) {
            throw new RuntimeException('A Pagecraft live acknowledgement is still pending; new credentials were not stored.');
        }
        if ($this->rollbackLifecyclePending()) {
            throw new RuntimeException('A Pagecraft rollback receipt or Resume acknowledgement is still pending; new credentials were not stored.');
        }
        $connectionId = (string) ($response['connectionId'] ?? $response['connection_id'] ?? '');
        $siteId = (string) ($response['siteId'] ?? $response['site_id'] ?? '');
        $refresh = (string) ($response['refreshToken'] ?? $response['refresh_token'] ?? '');
        $access = (string) ($response['accessToken'] ?? $response['access_token'] ?? '');
        $scopes = $response['scopes'] ?? [];
        if (is_string($scopes)) {
            $scopes = preg_split('/\s+/', trim($scopes)) ?: [];
        }
        $rawScopes = is_array($scopes) ? array_values(array_unique(array_filter($scopes, 'is_string'))) : [];
        $scopes = array_values(array_intersect(self::ALLOWED_SCOPES, $rawScopes));

        $profile = (string) ($pairing['profile'] ?? '');
        $environment = (string) ($pairing['environment'] ?? '');
        $state = (string) ($pairing['state'] ?? '');
        $verifier = (string) ($pairing['verifier'] ?? '');
        $sealedAuthorizationCode = (string) ($pairing['authorization_code'] ?? '');
        $returnedProfile = (string) ($response['profile'] ?? '');
        $returnedEnvironment = (string) ($response['environment'] ?? '');
        try {
            $authorizationCode = $sealedAuthorizationCode !== '' ? Crypto::open($sealedAuthorizationCode) : '';
        } catch (RuntimeException) {
            $authorizationCode = '';
        }
        if (!Support::validIdentifier($connectionId)
            || !Support::validIdentifier($siteId)
            || ((string) ($pairing['site_id'] ?? '') !== '' && !hash_equals((string) $pairing['site_id'], $siteId))
            || $refresh === ''
            || $access === ''
            || strlen($state) < 32
            || strlen($state) > 160
            || !preg_match('/^[A-Za-z0-9_-]+$/', $state)
            || strlen($verifier) < 43
            || strlen($verifier) > 128
            || !preg_match('/^[A-Za-z0-9_-]+$/', $verifier)
            || $authorizationCode === ''
            || array_diff(self::ALLOWED_SCOPES, $scopes) !== []
            || array_diff($rawScopes, self::ALLOWED_SCOPES) !== []
            || !in_array($profile, self::PROFILES, true)
            || !in_array($environment, ['staging', 'production'], true)
            || !hash_equals($profile, $returnedProfile)
            || !hash_equals($environment, $returnedEnvironment)) {
            throw new RuntimeException('Pagecraft returned an incomplete or over-broad connection grant.');
        }

        $origin = Support::normalizeOrigin($apiOrigin);
        $keysetEnvelope = $response['keysetEnvelope'] ?? $response['keyset_envelope'] ?? [];
        if (!is_array($keysetEnvelope)) {
            throw new RuntimeException('Pagecraft did not provide a signed release-key set.');
        }
        $keyset = RootTrust::verifyKeysetEnvelope($keysetEnvelope, $origin);

        $now = time();
        $expiresIn = max(60, min(DAY_IN_SECONDS, (int) ($response['expiresIn'] ?? $response['expires_in'] ?? 3600)));
        $installationId = $this->installationId();
        $idempotencyKey = 'wp-confirm-' . substr(hash('sha256', $connectionId . "\0" . $installationId . "\0" . $state), 0, 48);
        $confirmation = [
            'connection_id' => $connectionId,
            'installation_id' => $installationId,
            'state' => $state,
            'idempotency_key' => $idempotencyKey,
            'phase' => 'pending_remote',
            'authorization_code' => $sealedAuthorizationCode,
            'verifier' => Crypto::seal($verifier),
            'attempts' => 0,
            'requested_at' => Support::utcNow(),
            'next_attempt_at' => time(),
            'last_attempt_at' => null,
            'last_error_code' => null,
            'last_error_message' => null,
        ];
        $existingConfirmation = $this->pairingConfirmation();
        if ($existingConfirmation !== []
            && hash_equals($idempotencyKey, (string) ($existingConfirmation['idempotency_key'] ?? ''))
            && hash_equals($connectionId, (string) ($existingConfirmation['connection_id'] ?? ''))
            && hash_equals($state, (string) ($existingConfirmation['state'] ?? ''))) {
            $confirmation = $existingConfirmation;
        }
        $data = [
            'api_origin' => $origin,
            'connection_id' => $connectionId,
            'site_id' => $siteId,
            'target_origin' => Support::normalizeOrigin(home_url('/')),
            'target_path' => $this->targetPath(),
            'installation_id' => $installationId,
            'environment' => $environment,
            'profile' => $profile,
            'scopes' => $scopes,
            'editor_url' => esc_url_raw((string) ($response['editorSessionUrl'] ?? $response['editor_session_url'] ?? '')),
            'keyset' => $keyset,
            'keyset_fingerprint' => (string) $keyset['_fingerprint'],
            'access_token' => $access !== '' ? Crypto::seal($access) : '',
            'refresh_token' => Crypto::seal($refresh),
            'access_expires_at' => $now + $expiresIn,
            'connected_at' => Support::utcNow(),
            'origin_changed' => false,
            'lifecycle_fence' => Support::base64UrlEncode(random_bytes(24)),
            'pairing_confirmation' => $confirmation,
        ];

        // The locally durable binding remains frozen until the second-phase
        // server confirmation succeeds. This prevents cron/manual sync from
        // using a connection the Pagecraft server still considers provisional.
        $previousMode = $this->mode();
        $previousConnection = $this->all();
        $previousEtag = get_option('pagecraft_release_etag', '');
        $previousAckStates = get_option('pagecraft_deployment_ack_states', []);
        $bindingChanged = !hash_equals((string) ($previousConnection['connection_id'] ?? ''), $connectionId)
            || !hash_equals((string) ($previousConnection['site_id'] ?? ''), $siteId);
        if (!$this->setMode('frozen') && $this->mode() !== 'frozen') {
            throw new RuntimeException('WordPress could not enter confirmation-safe Frozen mode; new Pagecraft credentials were not stored.');
        }
        // Reset connection-scoped cursors before exposing the new binding. A
        // crash here can only cause the old connection to re-poll; it can never
        // let confirmation finalize a new connection with an old ETag/ACK cursor.
        if ($bindingChanged && !$this->resetConnectionCursors()) {
            update_option('pagecraft_mode', $previousMode, false);
            update_option('pagecraft_release_etag', $previousEtag, false);
            update_option('pagecraft_deployment_ack_states', $previousAckStates, false);
            throw new RuntimeException('WordPress could not reset the connection-scoped deployment cursors; the previous Pagecraft credential binding was preserved.');
        }
        update_option(self::OPTION, $data, false);
        if ($this->all() !== $data) {
            update_option(self::OPTION, $previousConnection, false);
            update_option('pagecraft_mode', $previousMode, false);
            update_option('pagecraft_release_etag', $previousEtag, false);
            update_option('pagecraft_deployment_ack_states', $previousAckStates, false);
            throw new RuntimeException('WordPress could not atomically store the new Pagecraft credential binding.');
        }
    }

    /** @param array<string,mixed> $confirmation */
    public function persistPairingConfirmation(array $confirmation): bool
    {
        $data = $this->all();
        $current = is_array($data['pairing_confirmation'] ?? null) ? $data['pairing_confirmation'] : [];
        if ($current === []
            || !hash_equals((string) ($current['connection_id'] ?? ''), (string) ($confirmation['connection_id'] ?? ''))
            || !hash_equals((string) ($current['idempotency_key'] ?? ''), (string) ($confirmation['idempotency_key'] ?? ''))) {
            return false;
        }
        $data['pairing_confirmation'] = $confirmation;
        update_option(self::OPTION, $data, false);
        return $this->pairingConfirmation() === $confirmation;
    }

    /** Finish a remotely confirmed pairing without exposing retained PKCE material. */
    public function finishPairingConfirmation(): bool
    {
        $confirmation = $this->pairingConfirmation();
        if ($confirmation === [] || (string) ($confirmation['phase'] ?? '') !== 'remote_confirmed') {
            return false;
        }
        if (!$this->resume('pairing')) {
            return false;
        }

        $state = (string) ($confirmation['state'] ?? '');
        if (strlen($state) < 32
            || strlen($state) > 160
            || !preg_match('/^[A-Za-z0-9_-]+$/', $state)) {
            return false;
        }
        delete_transient($this->pairingKey($state));
        if (get_transient($this->pairingKey($state)) !== false) {
            return false;
        }
        delete_option(self::PAIRING_AUTHORIZATION_OPTION);
        if ($this->pairingAuthorizationPending()) {
            return false;
        }

        // Remove and verify the pre-token journal while the durable
        // remote_confirmed receipt still exists. A crash at any later cleanup
        // boundary therefore resumes here without re-exchanging the code or
        // posting confirmation again.
        $exchange = $this->pairingExchange();
        if ($exchange !== []
            && !hash_equals($state, (string) ($exchange['state'] ?? ''))) {
            return false;
        }
        delete_option(self::PAIRING_EXCHANGE_OPTION);
        if ($this->pairingExchangePending()) {
            return false;
        }

        $data = $this->all();
        $current = is_array($data['pairing_confirmation'] ?? null) ? $data['pairing_confirmation'] : [];
        if ($current === []
            || !hash_equals((string) ($confirmation['idempotency_key'] ?? ''), (string) ($current['idempotency_key'] ?? ''))) {
            return false;
        }
        unset($data['pairing_confirmation']);
        update_option(self::OPTION, $data, false);
        if ($this->pairingConfirmationPending()) {
            return false;
        }
        update_option('pagecraft_last_pairing_confirmation', [
            'connection_id' => (string) ($confirmation['connection_id'] ?? ''),
            'confirmed_at' => (string) ($confirmation['confirmed_at'] ?? Support::utcNow()),
            'already_confirmed' => (bool) ($confirmation['already_confirmed'] ?? false),
            'completed_at' => Support::utcNow(),
        ], false);
        return true;
    }

    /** @param array<string,mixed> $envelope */
    public function installKeysetEnvelope(array $envelope): void
    {
        $data = $this->all();
        $keyset = RootTrust::verifyKeysetEnvelope($envelope, $this->apiOrigin());
        $data['keyset'] = $keyset;
        $data['keyset_fingerprint'] = (string) $keyset['_fingerprint'];
        update_option(self::OPTION, $data, false);
    }

    /** @param array<string,mixed> $response */
    public function updateTokens(array $response): void
    {
        if ($this->revocationPending()) {
            throw new RuntimeException('Pagecraft token rotation is disabled while server revocation is pending.');
        }
        $data = $this->all();
        $access = (string) ($response['accessToken'] ?? $response['access_token'] ?? '');
        $refresh = (string) ($response['refreshToken'] ?? $response['refresh_token'] ?? '');
        if ($access !== '') {
            $data['access_token'] = Crypto::seal($access);
        }
        if ($refresh !== '') {
            $data['refresh_token'] = Crypto::seal($refresh);
        }
        $data['access_expires_at'] = time() + max(60, min(DAY_IN_SECONDS, (int) ($response['expiresIn'] ?? $response['expires_in'] ?? 3600)));
        update_option(self::OPTION, $data, false);
        $stored = $this->all();
        if ($stored !== $data
            || ($access !== '' && !hash_equals($access, $this->accessToken()))
            || ($refresh !== '' && !hash_equals($refresh, $this->refreshToken()))) {
            throw new RuntimeException('WordPress could not durably store the refreshed Pagecraft credential.');
        }
    }

    /**
     * Persist a refresh response only while the exact credential used to obtain
     * it is still current. The caller holds the token-refresh fence, and this
     * comparison prevents a delayed older response from replacing newer tokens.
     *
     * @param array<string,mixed> $response
     */
    public function updateTokensIfCurrent(array $response, string $expectedRefreshToken): bool
    {
        $current = $this->refreshToken();
        if ($expectedRefreshToken === '' || $current === '' || !hash_equals($expectedRefreshToken, $current)) {
            return false;
        }
        $this->updateTokens($response);
        return true;
    }

    public function tokenExpired(): bool
    {
        return (int) ($this->all()['access_expires_at'] ?? 0) <= time() + 30;
    }

    /**
     * Freeze synchronization and optionally remove the scoped credentials.
     *
     * The post-write reads are deliberate: update_option() may return false for
     * either an unchanged value or a failed write. Revocation may discard its
     * durable receipt only after the stored state proves both operations landed.
     */
    public function freeze(bool $forgetSecrets = true): bool
    {
        $data = $this->all();
        $confirmationState = '';
        if ($forgetSecrets) {
            $confirmation = is_array($data['pairing_confirmation'] ?? null) ? $data['pairing_confirmation'] : [];
            $confirmationState = (string) ($confirmation['state'] ?? '');
            unset($data['access_token'], $data['refresh_token']);
            unset($data['pairing_confirmation']);
            $data['disconnected_at'] = (string) ($data['disconnected_at'] ?? Support::utcNow());
        }
        update_option(self::OPTION, $data, false);
        $stored = $this->all();
        if ($stored !== $data
            || ($forgetSecrets && (isset($stored['access_token']) || isset($stored['refresh_token'])))) {
            return false;
        }

        $this->setMode('frozen');
        if ($this->mode() !== 'frozen') {
            return false;
        }
        if ($forgetSecrets && $confirmationState !== '') {
            delete_transient($this->pairingKey($confirmationState));
            if (get_transient($this->pairingKey($confirmationState)) !== false) {
                return false;
            }
        }
        if ($forgetSecrets) {
            $cancelled = $this->cancelPairingAuthorization('disconnect');
            if (is_wp_error($cancelled)) {
                return false;
            }
            delete_option(self::PAIRING_EXCHANGE_OPTION);
            if ($this->pairingExchangePending()) {
                return false;
            }
        }
        return true;
    }

    public function flagOriginChange(mixed $old, mixed $new): void
    {
        if ((string) $old === (string) $new || !$this->isConfigured()) {
            return;
        }
        $data = $this->all();
        $data['origin_changed'] = true;
        update_option(self::OPTION, $data, false);
        $this->setMode('paused');
    }

    private function openSecret(string $key): string
    {
        $sealed = (string) ($this->all()[$key] ?? '');
        if ($sealed === '') {
            return '';
        }
        try {
            return Crypto::open($sealed);
        } catch (RuntimeException) {
            return '';
        }
    }

    /** @return array<string,mixed> Cache-bypassing credential read for lifecycle fences. */
    private function freshAll(): array
    {
        $value = $this->freshOption(self::OPTION, []);
        return is_array($value) ? $value : [];
    }

    private function freshOption(string $name, mixed $default = false): mixed
    {
        global $wpdb;
        if (!isset($wpdb->options) || !is_string($wpdb->options) || $wpdb->options === '') {
            return get_option($name, $default);
        }
        $raw = $wpdb->get_var($wpdb->prepare(
            "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1",
            $name
        ));
        return is_string($raw) ? maybe_unserialize($raw) : $default;
    }

    private function pairingAuthorizationCancelled(string $state): bool
    {
        if (strlen($state) < 32
            || strlen($state) > 160
            || !preg_match('/^[A-Za-z0-9_-]+$/', $state)) {
            return false;
        }
        $cancellations = $this->freshOption(self::PAIRING_CANCELLATIONS_OPTION, []);
        if (!is_array($cancellations)) {
            return false;
        }
        $record = $cancellations[hash('sha256', $state)] ?? null;
        return is_array($record)
            && hash_equals(hash('sha256', $state), (string) ($record['state_hash'] ?? ''))
            && (int) ($record['expires_at'] ?? 0) >= time();
    }

    /**
     * A desired ETag and deployment states are consent-bound to one connection.
     * Clear them only after the replacement credential and mode have committed;
     * scoped database rows preserve the previous verified public release.
     */
    private function resetConnectionCursors(): bool
    {
        update_option('pagecraft_release_etag', '', false);
        update_option('pagecraft_deployment_ack_states', [], false);
        return (string) get_option('pagecraft_release_etag', '') === ''
            && get_option('pagecraft_deployment_ack_states', []) === [];
    }

    private function pairingKey(string $state): string
    {
        return 'pagecraft_pair_' . substr(hash('sha256', $state), 0, 32);
    }

    private function validLifecycleToken(string $token): bool
    {
        return strlen($token) === 32 && (bool) preg_match('/^[A-Za-z0-9_-]+$/', $token);
    }

    private function targetPath(): string
    {
        $path = wp_parse_url(home_url('/'), PHP_URL_PATH);
        $path = is_string($path) && $path !== '' ? '/' . trim($path, '/') : '/';
        return $path === '/' ? '/' : $path . '/';
    }
}
