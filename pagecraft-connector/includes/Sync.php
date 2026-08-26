<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Sync
{
    private const PENDING_LIVE_ACKS_OPTION = Connection::PENDING_LIVE_ACKS_OPTION;
    private const PENDING_TERMINAL_ACKS_OPTION = Connection::PENDING_TERMINAL_ACKS_OPTION;
    private string $lastAcknowledgedState = '';
    private readonly \Closure $acknowledger;
    private readonly DeploymentLock $deploymentLock;
    private readonly \Closure $rollbackActivator;
    /** @var array{token:string,fence:int,purpose:string,expires:int}|null */
    private ?array $lease = null;
    /** @var array{token:string,connection_id:string,site_id:string,installation_id:string}|null */
    private ?array $connectionLifecycle = null;

    public function __construct(
        private readonly Connection $connection,
        private readonly HttpClient $http,
        private readonly ReleaseVerifier $verifier,
        private readonly ReleaseRepository $releases,
        private readonly Mapper $mapper,
        ?\Closure $acknowledger = null,
        ?DeploymentLock $deploymentLock = null,
        ?\Closure $rollbackActivator = null
    ) {
        $this->acknowledger = $acknowledger ?? fn (array $payload): array|\WP_Error => $this->http->acknowledge($payload);
        $this->deploymentLock = $deploymentLock ?? new DeploymentLock();
        $this->rollbackActivator = $rollbackActivator ?? fn (string $deploymentId, \Closure $guard): bool|\WP_Error => $this->releases->activate($deploymentId, $guard);
    }

    /** @return array<string,mixed>|\WP_Error */
    public function run(bool $force = false): array|\WP_Error
    {
        if (is_multisite()) {
            return $this->fail(new \WP_Error('pagecraft_multisite_unsupported', 'Pagecraft Connector v1 supports single-site WordPress installations only.'));
        }
        if ($this->connection->revocationPending()) {
            return $this->fail(new \WP_Error('pagecraft_revocation_pending', 'Pagecraft server revocation is pending. The active release is frozen and synchronization is disabled.'));
        }
        if (!$this->connection->isConfigured()) {
            return $this->fail(new \WP_Error('pagecraft_not_connected', 'Pagecraft is not connected.'));
        }
        $binding = $this->connection->bindingValid();
        if (is_wp_error($binding)) {
            return $this->fail($binding);
        }
        $recoverableAutomaticRollback = $this->hasRecoverableAutomaticRollbackAcknowledgement();
        $terminalAcknowledgementPending = $this->hasPendingTerminalAcknowledgements() || $recoverableAutomaticRollback;
        if ($this->connection->emergencyRollbackRequiresResume() && !$terminalAcknowledgementPending) {
            return $this->fail(new \WP_Error(
                'pagecraft_emergency_rollback_paused',
                'Emergency rollback is latched. Explicitly resume Pagecraft synchronization before checking for another deployment.'
            ));
        }
        if (!$force && $this->connection->mode() !== 'connected' && !$terminalAcknowledgementPending) {
            return $this->fail(new \WP_Error('pagecraft_sync_paused', 'Automatic Pagecraft synchronization is paused.'));
        }
        $connection = $this->connection->publicData();
        if (!empty($connection['origin_changed'])) {
            return $this->fail(new \WP_Error('pagecraft_origin_changed', 'The WordPress origin changed. Rebind it in Pagecraft before resuming synchronization.'));
        }
        $ownsLease = $this->acquireLease('sync');
        if (is_wp_error($ownsLease)) {
            return $ownsLease;
        }

        $temporary = '';
        $stagingDirectory = '';
        $manifest = null;
        try {
            $reconstructedRollback = $this->reconstructAutomaticRollbackAcknowledgement();
            if (is_wp_error($reconstructedRollback)) {
                return $this->recordFailure($reconstructedRollback, null, 'acknowledgement_pending');
            }
            // Terminal rollback receipts are also an outbox. A paused target may
            // deliver only these exact receipts; it must never poll or advance
            // until Pagecraft and the public pointer agree again.
            $terminalAcknowledgement = $this->retryPendingTerminalAcknowledgements();
            if (is_wp_error($terminalAcknowledgement)) {
                return $this->recordFailure($terminalAcknowledgement, null, 'acknowledgement_pending');
            }
            if ($this->connection->emergencyRollbackRequiresResume()) {
                return $this->fail(new \WP_Error(
                    'pagecraft_emergency_rollback_paused',
                    'Emergency rollback is latched. The rollback receipt is reconciled; explicitly resume Pagecraft synchronization before checking for another deployment.'
                ));
            }
            if (!$force && $this->connection->mode() !== 'connected') {
                return $this->fail(new \WP_Error(
                    'pagecraft_sync_paused',
                    'The pending rollback receipt is reconciled, but automatic Pagecraft synchronization remains paused.'
                ));
            }

            // Live acknowledgements are durable outbox items. Retry them before
            // polling. If the process stopped after verified_at committed but
            // before the option write, reconstruct the same receipt from the
            // verified active row before consulting a possibly-cleared target.
            $pendingAcknowledgement = $this->retryPendingLiveAcknowledgements();
            if (is_wp_error($pendingAcknowledgement)) {
                return $this->acknowledgementPending($pendingAcknowledgement, $this->firstPendingLiveManifest());
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $this->fail($heartbeat);
            }
            $interruptedActive = $this->releases->active();
            if ($this->activeReleaseNeedsVerification($interruptedActive)) {
                $manifest = $this->manifestForRelease($interruptedActive);
                $this->lastAcknowledgedState = $this->storedAckState((string) $manifest['deploymentId']) ?: 'activating';
                return $this->recoverUnverifiedActivation($interruptedActive);
            }
            $verifiedAcknowledgement = $this->reconcileVerifiedActiveAcknowledgement($interruptedActive);
            if (is_wp_error($verifiedAcknowledgement)) {
                return $this->acknowledgementPending($verifiedAcknowledgement, is_array($interruptedActive) ? $this->manifestForRelease($interruptedActive) : null);
            }

            // Installation and its remote staged receipt are separate durable
            // commits. Reconcile the latter before polling so a saved ETag/304
            // cannot strand downloading -> staged progression.
            $interruptedCandidate = $this->interruptedCandidate();
            if (is_array($interruptedCandidate)) {
                $manifest = $this->manifestForRelease($interruptedCandidate);
                $candidateAcknowledgement = $this->reconcileCandidateAcknowledgements($interruptedCandidate, $manifest);
                if (is_wp_error($candidateAcknowledgement)) {
                    return $this->progressAcknowledgementPending($candidateAcknowledgement, $manifest);
                }
            }
            $desired = $this->http->desiredRelease($force ? '' : $this->releases->etag());
            if (is_wp_error($desired)) {
                return $this->fail($desired);
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $this->fail($heartbeat);
            }
            if ($desired === null) {
                if (is_array($interruptedCandidate)) {
                    $candidateManifest = $this->manifestForRelease($interruptedCandidate);
                    return (string) ($interruptedCandidate['status'] ?? '') === 'needs_approval'
                        ? $this->activatePending((string) $interruptedCandidate['deployment_id'])
                        : $this->activateInstalled($candidateManifest);
                }
                return $this->succeed(['status' => 'current', 'message' => 'No newer Pagecraft deployment is available.']);
            }
            $manifest = $this->verifier->verify($desired);
            if (is_wp_error($manifest)) {
                return $this->fail($manifest);
            }
            $manifest = $this->releases->scopeDeploymentId($manifest);
            if (is_wp_error($manifest)) {
                return $this->fail($manifest);
            }
            // Pagecraft records the initial queued state when it issues the
            // signed target. WordPress owns transitions beginning at download.
            $this->lastAcknowledgedState = $this->storedAckState((string) $manifest['deploymentId']) ?: 'queued';
            $deploymentId = (string) $manifest['deploymentId'];
            $existing = $this->releases->find($deploymentId);
            if ($existing && $existing['status'] === 'active') {
                if ($this->activeReleaseNeedsVerification($existing)) {
                    return $this->recoverUnverifiedActivation($existing, $desired);
                }
                $acknowledged = $this->completeActiveAcknowledgement($manifest, $existing);
                if (is_wp_error($acknowledged)) {
                    // The release is already public locally. Never tell Pagecraft
                    // that it failed merely because a retryable acknowledgement
                    // could not be delivered; the next reconciliation retries it.
                    return $this->acknowledgementPending($acknowledged, $manifest);
                }
                $this->setEtag($desired);
                return $this->succeed(['status' => 'current', 'release_id' => $existing['release_id'], 'deployment_id' => $deploymentId]);
            }
            if ($existing && $existing['status'] === 'needs_approval') {
                return $this->activatePending($deploymentId);
            }
            if ($existing && $existing['status'] === 'failed') {
                return $this->fail(new \WP_Error('pagecraft_target_failed', 'This target sequence already failed. Ask Pagecraft to issue a new deployment sequence.'), $manifest);
            }
            if ($existing && $existing['status'] === 'retained' && empty($existing['verified_at'])) {
                $error = new \WP_Error('pagecraft_release_unverified', 'An interrupted Pagecraft candidate never passed public verification and cannot be reactivated.');
                return $this->failAfterErrorJournal($error, $manifest);
            }
            if ($existing && in_array($existing['status'], ['installed', 'retained'], true)) {
                return $this->activateInstalled($manifest, $desired);
            }

            $acknowledged = $this->acknowledgeState($manifest, 'downloading');
            if (is_wp_error($acknowledged)) {
                // A transport error is ambiguous: Pagecraft may already have
                // committed downloading. Keep the immutable candidate private
                // and replay the exact idempotent progress receipt next run.
                return $this->progressAcknowledgementPending($acknowledged, $manifest);
            }

            $artifact = is_array($manifest['_artifact'] ?? null) ? $manifest['_artifact'] : [];
            $artifactUrl = esc_url_raw((string) ($artifact['url'] ?? ''));
            if ($artifactUrl === '') {
                $artifactUrl = $this->connection->apiOrigin() . '/v1/releases/' . rawurlencode((string) $manifest['releaseId']) . '/artifact';
            }
            $temporary = $this->http->download($artifactUrl, (int) $manifest['artifactBytes']);
            if (is_wp_error($temporary)) {
                return $this->fail($temporary, $manifest);
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $this->fail($heartbeat, $manifest);
            }

            $stager = new Stager();
            $staged = $stager->stageCanonicalArtifact($temporary, $manifest);
            if (is_wp_error($staged)) {
                return $this->fail($staged, $manifest);
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $this->fail($heartbeat, $manifest);
            }
            $stagingDirectory = $staged['directory'];
            $artifactData = $staged['artifact'];
            $pendingScripts = $this->verifier->inspectArtifactScripts($artifactData);
            if (is_wp_error($pendingScripts)) {
                return $this->fail($pendingScripts, $manifest);
            }

            $manifest = self::mergeArtifact($manifest, $artifactData, $pendingScripts);
            $mappingPreflight = $this->mapper->preflight($manifest);
            if (is_wp_error($mappingPreflight)) {
                return $this->fail($mappingPreflight, $manifest);
            }
            $localized = $this->mapper->localizeManifest($manifest);
            if (is_wp_error($localized)) {
                return $this->fail($localized, $manifest);
            }
            $manifest = $localized;
            $preflight = apply_filters('pagecraft_connector_preflight', true, $manifest, $artifactData);
            if (is_wp_error($preflight)) {
                return $this->fail($preflight, $manifest);
            }
            if ($preflight !== true) {
                return $this->fail(new \WP_Error('pagecraft_preflight_failed', 'A WordPress integration blocked this Pagecraft deployment.'), $manifest);
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $this->fail($heartbeat, $manifest);
            }

            $record = $this->releases->stage($manifest);
            if (is_wp_error($record)) {
                return $this->fail($record, $manifest);
            }
            $routes = $this->mapper->apply($manifest, $staged['files']);
            if (is_wp_error($routes)) {
                return $this->failAfterErrorJournal($routes, $manifest);
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $this->fail($heartbeat, $manifest);
            }
            $stored = $this->releases->replaceRoutes($deploymentId, $routes);
            if (is_wp_error($stored)) {
                return $this->failAfterErrorJournal($stored, $manifest);
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $this->fail($heartbeat, $manifest);
            }
            $stored = $this->releases->replaceRedirects($deploymentId, (array) ($manifest['redirects'] ?? []));
            if (is_wp_error($stored)) {
                return $this->failAfterErrorJournal($stored, $manifest);
            }
            $installed = $this->persistInstalledCandidate($deploymentId, $pendingScripts !== [], $desired);
            if (is_wp_error($installed)) {
                // Do not store the target ETag or emit a terminal failure. The
                // row is still staged/private and the same signed desired target
                // must be fetched and retried on the next run.
                return $this->recordFailure($installed, $manifest, 'install_pending');
            }
            $acknowledged = $this->reconcileCandidateAcknowledgements($installed, $manifest);
            if (is_wp_error($acknowledged)) {
                return $this->progressAcknowledgementPending($acknowledged, $manifest);
            }

            if ($pendingScripts !== []) {
                return $this->succeed([
                    'status' => 'needs_approval',
                    'release_id' => (string) $manifest['releaseId'],
                    'deployment_id' => $deploymentId,
                    'pending_scripts' => $pendingScripts,
                ]);
            }

            return $this->activateInstalled($manifest, $desired);
        } finally {
            if ($temporary !== '' && is_file($temporary)) {
                wp_delete_file($temporary);
            }
            if ($stagingDirectory !== '') {
                (new Stager())->removeDirectory($stagingDirectory);
            }
            $this->releaseLease($ownsLease);
        }
    }

    /** @return array<string,mixed>|\WP_Error */
    public function activatePending(string $deploymentId): array|\WP_Error
    {
        if (is_multisite()) {
            return $this->fail(new \WP_Error('pagecraft_multisite_unsupported', 'Pagecraft Connector v1 supports single-site WordPress installations only.'));
        }
        $ownsLease = $this->acquireLease('script-approval');
        if (is_wp_error($ownsLease)) {
            return $ownsLease;
        }
        try {
            $release = $this->releases->find($deploymentId);
            if (!$release) {
                return $this->fail(new \WP_Error('pagecraft_release_missing', 'The Pagecraft deployment is not installed.'));
            }
            if (!$this->releaseBelongsToCurrentConnection($release)) {
                return $this->fail(new \WP_Error('pagecraft_release_connection_mismatch', 'This installed deployment belongs to a previous Pagecraft connection and cannot be activated.'));
            }
            $manifest = $this->manifestForRelease($release);
            $reconciled = $this->reconcileCandidateAcknowledgements($release, $manifest);
            if (is_wp_error($reconciled)) {
                return $this->progressAcknowledgementPending($reconciled, $manifest);
            }
            $pending = $release['manifest']['_pendingScripts'] ?? [];
            $pending = is_array($pending) ? array_values(array_filter($pending, 'is_string')) : [];
            if (!$this->verifier->allScriptsApproved($pending)) {
                return $this->succeed([
                    'status' => 'needs_approval',
                    'release_id' => $release['release_id'],
                    'deployment_id' => $release['deployment_id'],
                    'pending_scripts' => $pending,
                ]);
            }
            $ready = $this->releases->markReady($deploymentId);
            if (is_wp_error($ready)) {
                // The server remains at needs_approval and no activating ACK is
                // emitted until the local installed transition is durable.
                return $this->recordFailure($ready, $manifest, 'approval_activation_pending');
            }
            return $this->activateInstalled($manifest);
        } finally {
            $this->releaseLease($ownsLease);
        }
    }

    /** @return true|\WP_Error */
    public function emergencyRollback(string $deploymentId): bool|\WP_Error
    {
        $ownsLease = $this->acquireLease('rollback');
        if (is_wp_error($ownsLease)) {
            return $ownsLease;
        }
        try {
            $current = $this->releases->active();
            $release = $this->releases->find($deploymentId);
            if (!$this->isVerifiedRollbackCandidate($release) || !$this->releaseBelongsToCurrentConnection($release)) {
                return new \WP_Error('pagecraft_rollback_unavailable', 'Only a verified release from the current Pagecraft connection is available for emergency rollback.');
            }
            $intent = $this->beginEmergencyRollbackIntent($current, $release);
            if (is_wp_error($intent)) {
                return $intent;
            }
            $currentManifest = null;
            $rollbackExtra = null;
            if ($current && $current['deployment_id'] !== $release['deployment_id']) {
                $currentManifest = $this->manifestForRelease($current);
                $rollbackExtra = [
                    'activeHash' => (string) $release['artifact_hash'],
                    'detail' => ['stage' => 'rollback', 'action' => 'WordPress administrator rollback'],
                ];
                $payload = $this->ack($currentManifest, 'rolled_back', $rollbackExtra);
                // Persist the exact terminal receipt before the pointer switch.
                // Its expected-active binding prevents delivery unless/until the
                // requested retained release really becomes public.
                $persisted = $this->persistPendingTerminalAcknowledgement(
                    $currentManifest,
                    $payload,
                    (string) $release['deployment_id']
                );
                if (is_wp_error($persisted)) {
                    return $persisted;
                }
            }
            $heartbeat = $this->heartbeat();
            if (is_wp_error($heartbeat)) {
                return $heartbeat;
            }
            $activated = ($this->rollbackActivator)((string) $release['deployment_id'], $this->fenceGuard());
            if (is_wp_error($activated)) {
                if (is_array($currentManifest)) {
                    $this->clearPendingTerminalAcknowledgement((string) $currentManifest['deploymentId']);
                }
                $this->finishEmergencyRollbackIntent($intent, 'activation_failed', $activated);
                return $activated;
            }
            $completed = $this->finishEmergencyRollbackIntent($intent, 'active');
            if (is_wp_error($completed)) {
                return $completed;
            }
            $this->clearKnownCaches($release['manifest'] + [
                'releaseId' => $release['release_id'],
                'deploymentId' => $release['deployment_id'],
            ], 'emergency_rollback');
            if (is_array($currentManifest) && is_array($rollbackExtra)) {
                $this->clearPendingLiveAcknowledgement((string) $current['deployment_id']);
                $this->lastAcknowledgedState = $this->storedAckState((string) $currentManifest['deploymentId']) ?: 'live';
                $acknowledged = $this->acknowledgeState($currentManifest, 'rolled_back', $rollbackExtra);
                if (is_wp_error($acknowledged)) {
                    return $this->recordFailure(new \WP_Error(
                        'pagecraft_rollback_ack_pending',
                        'The rollback is active and paused, but Pagecraft has not yet accepted its durable rollback receipt: ' . $acknowledged->get_error_message()
                    ), $currentManifest, 'acknowledgement_pending');
                }
            }
            return true;
        } finally {
            $this->releaseLease($ownsLease);
        }
    }

    /**
     * Pause automatic advancement and persist the exact rollback intent before
     * the active pointer can move. A crash at any later checkpoint therefore
     * leaves the site safely paused until an administrator explicitly resumes.
     *
     * @param array<string,mixed>|null $current
     * @param array<string,mixed> $release
     * @return array<string,mixed>|\WP_Error
     */
    private function beginEmergencyRollbackIntent(?array $current, array $release): array|\WP_Error
    {
        if (!$this->connection->setMode('paused') && $this->connection->mode() !== 'paused') {
            return new \WP_Error('pagecraft_rollback_pause_failed', 'WordPress could not pause automatic synchronization before emergency rollback.');
        }
        $intent = [
            'intent_id' => wp_generate_uuid4(),
            'status' => 'pending',
            'requested_deployment_id' => (string) ($release['deployment_id'] ?? ''),
            'requested_release_id' => (string) ($release['release_id'] ?? ''),
            'previous_deployment_id' => (string) ($current['deployment_id'] ?? ''),
            'previous_release_id' => (string) ($current['release_id'] ?? ''),
            'requested_at' => Support::utcNow(),
            'user_id' => get_current_user_id(),
            'fence' => (int) ($this->lease['fence'] ?? 0),
        ];
        update_option(Connection::EMERGENCY_ROLLBACK_OPTION, $intent, false);
        $stored = get_option(Connection::EMERGENCY_ROLLBACK_OPTION, []);
        if (!is_array($stored)
            || !hash_equals((string) $intent['intent_id'], (string) ($stored['intent_id'] ?? ''))
            || (string) ($stored['status'] ?? '') !== 'pending') {
            return new \WP_Error('pagecraft_rollback_intent_failed', 'WordPress could not persist the emergency rollback intent. Synchronization remains paused.');
        }
        return $intent;
    }

    /** @param array<string,mixed> $intent @return true|\WP_Error */
    private function finishEmergencyRollbackIntent(array $intent, string $status, ?\WP_Error $error = null): bool|\WP_Error
    {
        $intent['status'] = $status;
        $intent['deployment_id'] = (string) ($intent['requested_deployment_id'] ?? '');
        $intent['release_id'] = (string) ($intent['requested_release_id'] ?? '');
        $intent['rolled_back_at'] = $status === 'active' ? Support::utcNow() : null;
        $intent['error_code'] = $error?->get_error_code();
        $intent['error_message'] = $error?->get_error_message();
        update_option(Connection::EMERGENCY_ROLLBACK_OPTION, $intent, false);
        $stored = get_option(Connection::EMERGENCY_ROLLBACK_OPTION, []);
        if (!is_array($stored)
            || !hash_equals((string) ($intent['intent_id'] ?? ''), (string) ($stored['intent_id'] ?? ''))
            || !hash_equals($status, (string) ($stored['status'] ?? ''))) {
            return new \WP_Error('pagecraft_rollback_intent_failed', 'The rollback pointer changed, but WordPress could not finalize its emergency rollback audit record. Synchronization remains paused.');
        }
        return true;
    }

    /** @param array<string,mixed>|null $release */
    private function isVerifiedRollbackCandidate(?array $release): bool
    {
        return is_array($release)
            && !empty($release['verified_at'])
            && in_array((string) ($release['status'] ?? ''), ['active', 'retained'], true);
    }

    /** @param array<string,mixed> $release */
    private function releaseBelongsToCurrentConnection(array $release): bool
    {
        return hash_equals(
            $this->connection->connectionId(),
            (string) ($release['connection_id'] ?? ($release['manifest']['connectionId'] ?? ''))
        ) && hash_equals(
            $this->connection->siteId(),
            (string) ($release['site_id'] ?? ($release['manifest']['siteId'] ?? ''))
        );
    }

    /** @param array<string,mixed>|null $release */
    private function activeReleaseNeedsVerification(?array $release): bool
    {
        return is_array($release)
            && $this->releaseBelongsToCurrentConnection($release)
            && (string) ($release['status'] ?? '') === 'active'
            && empty($release['verified_at']);
    }

    /**
     * Recover the verified_at -> live-outbox interruption boundary before a
     * 304/204 desired response can hide it.
     *
     * @param array<string,mixed>|null $release
     * @return true|\WP_Error
     */
    private function reconcileVerifiedActiveAcknowledgement(?array $release): bool|\WP_Error
    {
        if (!$this->isVerifiedRollbackCandidate($release)
            || (string) ($release['status'] ?? '') !== 'active'
            || !$this->releaseBelongsToCurrentConnection($release)) {
            return true;
        }
        $deploymentId = (string) ($release['deployment_id'] ?? '');
        $state = $this->storedAckState($deploymentId);
        if ($state === 'live') {
            return true;
        }
        $manifest = $this->manifestForRelease($release);
        // markVerified can only commit after the verifying transition. If the
        // local state option was itself lost, verifying is the narrow safe
        // reconstruction point for this exact durable active row.
        $this->lastAcknowledgedState = $state !== '' ? $state : 'verifying';
        return $this->completeActiveAcknowledgement($manifest, $release);
    }

    /** @return array<string,mixed>|null */
    private function interruptedCandidate(): ?array
    {
        $latest = $this->releases->latest($this->connection->connectionId());
        return is_array($latest)
            && in_array((string) ($latest['status'] ?? ''), ['installed', 'needs_approval'], true)
            ? $latest
            : null;
    }

    /**
     * Keep the installed-row commit ahead of the desired ETag commit. A failed
     * DB transition therefore guarantees the same desired envelope is fetched
     * again rather than being hidden behind a 304.
     *
     * @param array<string,mixed> $desired
     * @return array<string,mixed>|\WP_Error
     */
    private function persistInstalledCandidate(string $deploymentId, bool $needsApproval, array $desired): array|\WP_Error
    {
        $marked = $this->releases->markInstalled($deploymentId, $needsApproval);
        if (is_wp_error($marked)) {
            return $marked;
        }
        $installed = $this->releases->find($deploymentId);
        if (!is_array($installed)
            || (string) ($installed['status'] ?? '') !== ($needsApproval ? 'needs_approval' : 'installed')) {
            return new \WP_Error('pagecraft_release_install_verify', 'The Pagecraft deployment install state could not be verified. Its desired ETag was not saved.');
        }
        $this->setEtag($desired);
        return $installed;
    }

    /**
     * Reconcile the local markInstalled commit with Pagecraft's ordered target
     * state machine. Every retry uses the same deterministic idempotency key.
     *
     * @param array<string,mixed> $release
     * @param array<string,mixed> $manifest
     * @return true|\WP_Error
     */
    private function reconcileCandidateAcknowledgements(array $release, array $manifest): bool|\WP_Error
    {
        $status = (string) ($release['status'] ?? '');
        if (!in_array($status, ['installed', 'needs_approval'], true)) {
            return true;
        }
        $deploymentId = (string) ($manifest['deploymentId'] ?? '');
        $state = $this->storedAckState($deploymentId);
        $this->lastAcknowledgedState = $state !== '' ? $state : 'queued';
        if (!in_array($this->lastAcknowledgedState, ['queued', 'downloading', 'staged', 'needs_approval'], true)) {
            return new \WP_Error(
                'pagecraft_candidate_ack_state',
                'The locally installed Pagecraft deployment has an invalid acknowledgement state and cannot activate.'
            );
        }
        if ($this->lastAcknowledgedState === 'queued') {
            $acknowledged = $this->acknowledgeState($manifest, 'downloading');
            if (is_wp_error($acknowledged)) {
                return $acknowledged;
            }
        }
        if ($this->lastAcknowledgedState === 'downloading') {
            $acknowledged = $this->acknowledgeState($manifest, 'staged');
            if (is_wp_error($acknowledged)) {
                return $acknowledged;
            }
        }
        if ($status === 'needs_approval' && $this->lastAcknowledgedState === 'staged') {
            $acknowledged = $this->acknowledgeState($manifest, 'needs_approval');
            if (is_wp_error($acknowledged)) {
                return $acknowledged;
            }
        }
        return true;
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    private function assertActivationSequenceCurrent(array $manifest): bool|\WP_Error
    {
        $latest = $this->releases->latest($this->connection->connectionId());
        if (!$latest) {
            return true;
        }
        $deploymentId = (string) ($manifest['deploymentId'] ?? '');
        $latestId = (string) ($latest['deployment_id'] ?? '');
        if ($deploymentId !== ''
            && $latestId !== ''
            && !hash_equals($deploymentId, $latestId)
            && (int) ($manifest['sequence'] ?? 0) <= (int) ($latest['sequence'] ?? 0)) {
            return new \WP_Error(
                'pagecraft_target_sequence_replay',
                'A newer Pagecraft target sequence is already known locally. Only the exact active deployment may reconcile; use explicit emergency rollback for an older verified release.'
            );
        }
        return true;
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed>|null $desired @return array<string,mixed>|\WP_Error */
    private function activateInstalled(array $manifest, ?array $desired = null): array|\WP_Error
    {
        $ownsLease = $this->acquireLease('activation');
        if (is_wp_error($ownsLease)) {
            return $ownsLease;
        }
        try {
            $deploymentId = (string) $manifest['deploymentId'];
            $candidate = $this->releases->find($deploymentId);
            if (is_array($candidate) && in_array((string) ($candidate['status'] ?? ''), ['installed', 'needs_approval'], true)) {
                $reconciled = $this->reconcileCandidateAcknowledgements($candidate, $manifest);
                if (is_wp_error($reconciled)) {
                    return $this->progressAcknowledgementPending($reconciled, $manifest);
                }
            }
            $sequence = $this->assertActivationSequenceCurrent($manifest);
            if (is_wp_error($sequence)) {
                return $this->fail($sequence, $manifest);
            }
            $previous = $this->releases->active();
            if ($this->activeReleaseNeedsVerification($previous)) {
                return $this->fail(new \WP_Error(
                    'pagecraft_active_release_unverified',
                    'The current Pagecraft release must finish recovery verification before another deployment can activate.'
                ), $manifest);
            }
            $acknowledged = $this->acknowledgeState($manifest, 'activating');
            if (is_wp_error($acknowledged)) {
                // No public pointer has changed yet. An ambiguous activating
                // response must be replayed, never converted into failed.
                return $this->progressAcknowledgementPending($acknowledged, $manifest);
            }
            $activated = $this->releases->activate($deploymentId, $this->fenceGuard());
            if (is_wp_error($activated)) {
                return $this->fail($activated, $manifest);
            }
            $this->clearKnownCaches($manifest, 'activation');
            return $this->verifyAndPublish($manifest, $previous, $desired);
        } finally {
            $this->releaseLease($ownsLease);
        }
    }

    /**
     * Resume an activation interrupted after the atomic pointer switch. Public
     * probes always run again until verified_at commits; no live ACK can skip
     * that durable boundary.
     *
     * @param array<string,mixed> $release
     * @param array<string,mixed>|null $desired
     * @return array<string,mixed>|\WP_Error
     */
    private function recoverUnverifiedActivation(array $release, ?array $desired = null): array|\WP_Error
    {
        $manifest = $this->manifestForRelease($release);
        $previous = null;
        $previousId = (string) ($release['previous_deployment_id'] ?? '');
        if ($previousId !== '') {
            $manifest['_previousDeploymentId'] = $previousId;
            $candidate = $this->releases->find($previousId);
            if ($this->isVerifiedRollbackCandidate($candidate)) {
                $previous = $candidate;
            }
        } else {
            // Compatibility for an activation interrupted before the journal
            // column existed. New activations persist the exact prior pointer.
            $previous = $this->releases->previousVerified(
                (string) $release['deployment_id'],
                (string) ($release['connection_id'] ?? ($manifest['connectionId'] ?? '')),
                (string) ($release['site_id'] ?? ($manifest['siteId'] ?? '')),
                (int) ($release['sequence'] ?? ($manifest['sequence'] ?? 0))
            );
        }
        $this->clearKnownCaches($manifest, 'activation_recovery');
        return $this->verifyAndPublish($manifest, $previous, $desired);
    }

    /**
     * @param array<string,mixed> $manifest
     * @param array<string,mixed>|null $previous
     * @param array<string,mixed>|null $desired
     * @return array<string,mixed>|\WP_Error
     */
    private function verifyAndPublish(array $manifest, ?array $previous, ?array $desired = null): array|\WP_Error
    {
        if (in_array($this->lastAcknowledgedState, ['staged', 'needs_approval'], true)) {
            $acknowledged = $this->acknowledgeState($manifest, 'activating');
            if (is_wp_error($acknowledged)) {
                return $this->restoreAfterActivation($manifest, $previous, $acknowledged);
            }
        }
        if ($this->lastAcknowledgedState === 'activating') {
            $acknowledged = $this->acknowledgeState($manifest, 'verifying');
            if (is_wp_error($acknowledged)) {
                return $this->restoreAfterActivation($manifest, $previous, $acknowledged);
            }
        }
        if (!in_array($this->lastAcknowledgedState, ['verifying', 'live'], true)) {
            return $this->restoreAfterActivation($manifest, $previous, new \WP_Error(
                'pagecraft_activation_recovery_state',
                'The interrupted Pagecraft activation has an invalid acknowledgement state and cannot be promoted.'
            ));
        }

        $heartbeat = $this->heartbeat();
        if (is_wp_error($heartbeat)) {
            return $this->restoreAfterActivation($manifest, $previous, $heartbeat);
        }
        $verified = $this->verifyActivation($manifest);
        if (is_wp_error($verified)) {
            return $this->restoreAfterActivation($manifest, $previous, $verified);
        }
        $marked = $this->releases->markVerified((string) $manifest['deploymentId'], $this->fenceGuard());
        if (is_wp_error($marked)) {
            return $this->restoreAfterActivation($manifest, $previous, $marked);
        }
        // The marker and durable live outbox are adjacent recovery boundaries.
        // If PHP stops after this point, reconciliation retries this exact body
        // even when Pagecraft's desired pointer is already absent.
        $livePayload = $this->ack($manifest, 'live', ['activeHash' => (string) $manifest['artifactHash']]);
        $this->persistPendingLiveAcknowledgement($manifest, $livePayload);
        do_action('pagecraft_connector_release_publicly_verified', $manifest);

        $heartbeat = $this->heartbeat();
        if (is_wp_error($heartbeat)) {
            $this->persistPendingLiveAcknowledgement($manifest, $livePayload, $heartbeat);
            return $this->acknowledgementPending($heartbeat, $manifest);
        }
        $acknowledged = $this->acknowledgeState($manifest, 'live', ['activeHash' => (string) $manifest['artifactHash']]);
        if (is_wp_error($acknowledged)) {
            // Public verification and its durable marker already succeeded. The
            // exact idempotent remote receipt remains pending, so never restore
            // or deactivate the locally healthy release here.
            $this->releases->retain(5, $this->fenceGuard(), $this->connection->connectionId(), $this->connection->siteId());
            if (is_array($desired)) {
                $this->setEtag($desired);
            }
            return $this->acknowledgementPending($acknowledged, $manifest);
        }
        $this->releases->retain(5, $this->fenceGuard(), $this->connection->connectionId(), $this->connection->siteId());
        if (is_array($desired)) {
            $this->setEtag($desired);
        }
        return $this->succeed([
            'status' => 'activated',
            'release_id' => (string) $manifest['releaseId'],
            'deployment_id' => (string) $manifest['deploymentId'],
        ]);
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $release @return true|\WP_Error */
    private function completeActiveAcknowledgement(array $manifest, array $release): bool|\WP_Error
    {
        if (!$this->isVerifiedRollbackCandidate($release) || (string) ($release['status'] ?? '') !== 'active') {
            return new \WP_Error('pagecraft_release_unverified', 'Pagecraft cannot acknowledge an active release as live before public verification is durable.');
        }
        if ($this->lastAcknowledgedState === 'live') {
            return true;
        }
        if ($this->lastAcknowledgedState === '') {
            $this->lastAcknowledgedState = 'verifying';
        }
        if (in_array($this->lastAcknowledgedState, ['staged', 'needs_approval'], true)) {
            $result = $this->acknowledgeState($manifest, 'activating');
            if (is_wp_error($result)) {
                return $result;
            }
        }
        if ($this->lastAcknowledgedState === 'activating') {
            $result = $this->acknowledgeState($manifest, 'verifying');
            if (is_wp_error($result)) {
                return $result;
            }
        }
        if ($this->lastAcknowledgedState === 'verifying') {
            return $this->acknowledgeState($manifest, 'live', ['activeHash' => (string) $manifest['artifactHash']]);
        }
        return new \WP_Error(
            'pagecraft_active_ack_state',
            'The verified active Pagecraft deployment has an invalid acknowledgement state and cannot reconcile its live receipt.'
        );
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    private function assertLiveAcknowledgementEligible(array $manifest): bool|\WP_Error
    {
        $deploymentId = (string) ($manifest['deploymentId'] ?? '');
        $release = $this->releases->find($deploymentId);
        $pointer = (string) get_option('pagecraft_active_release_id', '');
        if ($deploymentId === ''
            || !hash_equals($deploymentId, $pointer)
            || !is_array($release)
            || (string) ($release['status'] ?? '') !== 'active'
            || empty($release['verified_at'])) {
            return new \WP_Error(
                'pagecraft_release_unverified',
                'A Pagecraft live acknowledgement requires the exact active release to have a durable public-verification marker.'
            );
        }
        return true;
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    private function verifyActivation(array $manifest): bool|\WP_Error
    {
        $active = $this->releases->active();
        if (!$active || !hash_equals((string) $manifest['deploymentId'], (string) $active['deployment_id']) || $active['status'] !== 'active') {
            return new \WP_Error('pagecraft_activation_pointer_verify', 'The active release pointer did not verify after activation.');
        }
        $paths = $this->releases->routePaths((string) $manifest['deploymentId']);
        do_action('pagecraft_connector_before_public_verify', $manifest);
        $injected = apply_filters('pagecraft_connector_public_verify_failure', false, $manifest);
        if (is_wp_error($injected)) {
            return $injected;
        }
        if ($injected === true) {
            return new \WP_Error('pagecraft_public_verify_injected', 'Public verification failure injected.');
        }
        if (!apply_filters('pagecraft_connector_verify_public_urls', true, $manifest)) {
            return true;
        }
        $expectedMarker = Support::releaseMarker(
            (string) ($manifest['deploymentId'] ?? ''),
            (string) ($manifest['artifactHash'] ?? '')
        );
        if ($expectedMarker === '') {
            return new \WP_Error('pagecraft_public_probe_identity', 'Public verification could not derive the exact Pagecraft release identity.');
        }
        $paths = array_slice(array_values(array_unique($paths)), 0, 3);
        foreach ($paths as $path) {
            $response = wp_safe_remote_get(home_url($path), [
                'timeout' => 15,
                // A managed route must itself return the deployed bytes. A
                // redirect to another managed route would carry the same marker
                // and otherwise mask a broken permalink or nested-route mapping.
                'redirection' => 0,
                'headers' => ['Cache-Control' => 'no-cache', 'X-Pagecraft-Verify' => (string) $manifest['deploymentId']],
                'user-agent' => 'Pagecraft-Connector-Verify/' . PAGECRAFT_CONNECTOR_VERSION,
            ]);
            if (is_wp_error($response)) {
                return new \WP_Error('pagecraft_public_probe_failed', sprintf('Public verification failed for %s: %s', $path, $response->get_error_message()));
            }
            $status = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            if ($status < 200 || $status >= 300 || !Support::bodyHasReleaseMarker($body, $expectedMarker)) {
                return new \WP_Error('pagecraft_public_probe_content', sprintf('Public verification for %s did not return the exact active Pagecraft release marker (HTTP %d).', $path, $status));
            }
        }
        return true;
    }

    /**
     * Restore the exact pre-activation public state before reporting a target
     * failure. This keeps the local pointer/native mappings and Pagecraft's
     * deployment state from ever settling into a live/failed split brain.
     *
     * @param array<string,mixed> $manifest
     * @param array<string,mixed>|null $previous
     */
    private function restoreAfterActivation(array $manifest, ?array $previous, \WP_Error $cause): \WP_Error
    {
        $deploymentId = (string) $manifest['deploymentId'];
        $expectedPreviousId = (string) ($manifest['_previousDeploymentId'] ?? '');
        if ($expectedPreviousId !== ''
            && (!$previous || !hash_equals($expectedPreviousId, (string) ($previous['deployment_id'] ?? '')))) {
            $this->connection->setMode('paused');
            return $this->recordFailure(new \WP_Error(
                'pagecraft_activation_restore_point_missing',
                $cause->get_error_message() . ' The exact previous verified deployment is unavailable, so Pagecraft paused without sending a live acknowledgement.',
                ['original_error' => $cause->get_error_code(), 'previous_deployment_id' => $expectedPreviousId]
            ), $manifest, 'restore_failed');
        }
        $hasPrevious = $previous && (string) $previous['deployment_id'] !== $deploymentId;
        $failureJournal = [
            'deployment_id' => $deploymentId,
            'error_code' => (string) $cause->get_error_code(),
            'error_message' => $cause->get_error_message(),
        ];
        $restored = $hasPrevious
            ? $this->releases->activate((string) $previous['deployment_id'], $this->fenceGuard(), $failureJournal)
            : $this->releases->deactivate($deploymentId, $this->fenceGuard(), $failureJournal);
        if (is_wp_error($restored)) {
            $this->connection->setMode('paused');
            return $this->recordFailure(new \WP_Error(
                'pagecraft_activation_restore_failed',
                $cause->get_error_message() . ' Automatic restore also failed: ' . $restored->get_error_message(),
                ['original_error' => $cause->get_error_code(), 'restore_error' => $restored->get_error_code()]
            ), $manifest, 'restore_failed');
        }

        $restoredManifest = $hasPrevious && is_array($previous)
            ? ($previous['manifest'] + [
                'releaseId' => $previous['release_id'],
                'deploymentId' => $previous['deployment_id'],
            ])
            : $manifest;
        $this->clearKnownCaches($restoredManifest, $hasPrevious ? 'automatic_rollback' : 'failed_first_activation');

        if ($hasPrevious) {
            $previousBelongsToConnection = hash_equals(
                $this->connection->connectionId(),
                (string) ($previous['connection_id'] ?? ($previous['manifest']['connectionId'] ?? ''))
            ) && hash_equals(
                $this->connection->siteId(),
                (string) ($previous['site_id'] ?? ($previous['manifest']['siteId'] ?? ''))
            );
            if (!$previousBelongsToConnection) {
                // A re-paired target may restore the old project's bytes for
                // availability, but the new Pagecraft site cannot accept that
                // unrelated artifact hash as its rollback pointer. Report the
                // new deployment failed; Pagecraft's active pointer stays null.
                return $this->fail($cause, $manifest);
            }
            $rolledBack = $this->acknowledgeState($manifest, 'rolled_back', [
                'activeHash' => (string) $previous['artifact_hash'],
                'error' => $cause->get_error_message(),
                'detail' => [
                    'code' => $cause->get_error_code(),
                    'message' => $cause->get_error_message(),
                    'stage' => $this->lastAcknowledgedState,
                    'action' => 'Previous release restored automatically.',
                ],
            ]);
            if (is_wp_error($rolledBack)) {
                if ($rolledBack->get_error_code() === 'pagecraft_terminal_ack_persist_failed') {
                    $this->connection->setMode('paused');
                }
                // Local public state is already safe and the exact rollback
                // receipt is durable. Do not replace it with a conflicting
                // failed terminal transition while transport is unavailable.
                return $this->recordFailure($rolledBack, $manifest, 'acknowledgement_pending');
            }
            return $this->fail($cause, $manifest);
        }

        return $this->fail($cause, $manifest);
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $extra @return true|\WP_Error */
    private function acknowledgeState(array $manifest, string $state, array $extra = []): bool|\WP_Error
    {
        if ($state === 'live') {
            $eligible = $this->assertLiveAcknowledgementEligible($manifest);
            if (is_wp_error($eligible)) {
                return $eligible;
            }
        }
        if ($this->lastAcknowledgedState === $state) {
            if ($state === 'live') {
                $this->clearPendingLiveAcknowledgement((string) $manifest['deploymentId']);
            }
            if ($state === 'rolled_back') {
                $this->clearPendingTerminalAcknowledgement((string) $manifest['deploymentId']);
            }
            return true;
        }
        $payload = $this->ack($manifest, $state, $extra);
        if ($state === 'live') {
            // Persist before transport. If the response is lost after the
            // server commits, the exact request remains available for retry.
            $this->persistPendingLiveAcknowledgement($manifest, $payload);
        }
        if ($state === 'rolled_back') {
            $active = $this->releases->active();
            $expectedActiveId = (string) ($active['deployment_id'] ?? '');
            $persisted = $this->persistPendingTerminalAcknowledgement($manifest, $payload, $expectedActiveId);
            if (is_wp_error($persisted)) {
                return $persisted;
            }
        }
        $result = $this->sendAcknowledgement($payload);
        if (is_wp_error($result)) {
            if ($state === 'live') {
                $this->persistPendingLiveAcknowledgement($manifest, $payload, $result, true);
            }
            if ($state === 'rolled_back') {
                $active = $this->releases->active();
                $this->persistPendingTerminalAcknowledgement(
                    $manifest,
                    $payload,
                    (string) ($active['deployment_id'] ?? ''),
                    $result,
                    true
                );
            }
            return $result;
        }
        $this->lastAcknowledgedState = $state;
        $this->storeAckState((string) $manifest['deploymentId'], $state);
        if ($state === 'live') {
            $this->clearPendingLiveAcknowledgement((string) $manifest['deploymentId']);
        }
        if ($state === 'rolled_back') {
            $this->clearPendingTerminalAcknowledgement((string) $manifest['deploymentId']);
        }
        return true;
    }

    /** @return true|\WP_Error */
    private function retryPendingLiveAcknowledgements(): bool|\WP_Error
    {
        $firstError = null;
        foreach ($this->pendingLiveAcknowledgements() as $deploymentId => $record) {
            if (!is_array($record) || !is_array($record['manifest'] ?? null) || !is_array($record['payload'] ?? null)) {
                $firstError ??= new \WP_Error('pagecraft_live_ack_record_invalid', 'A stored Pagecraft live acknowledgement is invalid and was not sent.');
                continue;
            }
            $manifest = $record['manifest'];
            $payload = $record['payload'];
            $expected = $this->ack($manifest, 'live', ['activeHash' => (string) ($manifest['artifactHash'] ?? '')]);
            if (!Support::validIdentifier((string) $deploymentId, 160)
                || !hash_equals((string) $deploymentId, (string) ($manifest['deploymentId'] ?? ''))
                || Support::json($payload) !== Support::json($expected)) {
                $firstError ??= new \WP_Error('pagecraft_live_ack_record_invalid', 'A stored Pagecraft live acknowledgement failed integrity validation and was not sent.');
                continue;
            }
            $eligible = $this->assertLiveAcknowledgementEligible($manifest);
            if (is_wp_error($eligible)) {
                $firstError ??= $eligible;
                continue;
            }
            $result = $this->sendAcknowledgement($payload);
            if (is_wp_error($result)) {
                $this->persistPendingLiveAcknowledgement($manifest, $payload, $result, true);
                $firstError ??= $result;
                continue;
            }
            $this->storeAckState((string) $deploymentId, 'live');
            $this->clearPendingLiveAcknowledgement((string) $deploymentId);
        }
        return $firstError ?? true;
    }

    /**
     * @param array<string,mixed> $manifest
     * @param array<string,mixed> $payload
     */
    private function persistPendingLiveAcknowledgement(array $manifest, array $payload, ?\WP_Error $error = null, bool $attempted = false): void
    {
        $deploymentId = (string) ($manifest['deploymentId'] ?? '');
        if (!Support::validIdentifier($deploymentId, 160)) {
            return;
        }
        $pending = $this->pendingLiveAcknowledgements();
        $previous = is_array($pending[$deploymentId] ?? null) ? $pending[$deploymentId] : [];
        $verified = [
            'releaseId' => (string) ($manifest['releaseId'] ?? ''),
            'deploymentId' => $deploymentId,
            'sequence' => (int) ($manifest['sequence'] ?? 0),
            'artifactHash' => strtolower((string) ($manifest['artifactHash'] ?? '')),
            '_manifestHash' => strtolower((string) ($manifest['_manifestHash'] ?? '')),
            '_deploymentHash' => strtolower((string) ($manifest['_deploymentHash'] ?? '')),
        ];
        $now = Support::utcNow();
        $pending[$deploymentId] = [
            'manifest' => $verified,
            'payload' => $payload,
            'attempts' => (int) ($previous['attempts'] ?? 0) + ($attempted ? 1 : 0),
            'first_pending_at' => (string) ($previous['first_pending_at'] ?? $now),
            'last_attempt_at' => $attempted ? $now : ($previous['last_attempt_at'] ?? null),
            'last_error_code' => $error ? (string) $error->get_error_code() : ($previous['last_error_code'] ?? null),
            'last_error_message' => $error ? wp_strip_all_tags($error->get_error_message()) : ($previous['last_error_message'] ?? null),
        ];
        if (count($pending) > 25) {
            $pending = array_slice($pending, -25, null, true);
        }
        update_option(self::PENDING_LIVE_ACKS_OPTION, $pending, false);
    }

    /** @return array<string,array<string,mixed>> */
    private function pendingLiveAcknowledgements(): array
    {
        $pending = get_option(self::PENDING_LIVE_ACKS_OPTION, []);
        return is_array($pending) ? $pending : [];
    }

    /** @return array<string,mixed>|null */
    private function firstPendingLiveManifest(): ?array
    {
        foreach ($this->pendingLiveAcknowledgements() as $record) {
            if (is_array($record) && is_array($record['manifest'] ?? null)) {
                return $record['manifest'];
            }
        }
        return null;
    }

    private function clearPendingLiveAcknowledgement(string $deploymentId): void
    {
        $pending = $this->pendingLiveAcknowledgements();
        if (!array_key_exists($deploymentId, $pending)) {
            return;
        }
        unset($pending[$deploymentId]);
        update_option(self::PENDING_LIVE_ACKS_OPTION, $pending, false);
    }

    private function hasPendingTerminalAcknowledgements(): bool
    {
        return $this->pendingTerminalAcknowledgements() !== [];
    }

    /**
     * A failed row with an exact verified previous pointer is the durable
     * database-side half of an automatic rollback. It lets a later run rebuild
     * the terminal outbox if the option write failed after pointer restoration.
     */
    private function hasRecoverableAutomaticRollbackAcknowledgement(): bool
    {
        return is_array($this->recoverableAutomaticRollback());
    }

    /** @return true|\WP_Error */
    private function reconstructAutomaticRollbackAcknowledgement(): bool|\WP_Error
    {
        $recovery = $this->recoverableAutomaticRollback();
        if (!is_array($recovery)) {
            return true;
        }
        $failed = $recovery['failed'];
        $active = $recovery['active'];
        $manifest = $this->manifestForRelease($failed);
        $state = $this->storedAckState((string) $manifest['deploymentId']);
        $errorCode = sanitize_key((string) ($failed['error_code'] ?? 'pagecraft_activation_failed')) ?: 'pagecraft_activation_failed';
        $errorMessage = wp_strip_all_tags((string) ($failed['error_message'] ?? 'The deployment failed public verification.'));
        $payload = $this->ack($manifest, 'rolled_back', [
            'activeHash' => (string) $active['artifact_hash'],
            'error' => $errorMessage,
            'detail' => [
                'code' => $errorCode,
                'message' => $errorMessage,
                'stage' => $state !== '' ? $state : 'verifying',
                'action' => 'Previous release restored automatically.',
            ],
        ]);
        if (!$this->connection->setMode('paused') && $this->connection->mode() !== 'paused') {
            return new \WP_Error('pagecraft_automatic_rollback_pause_failed', 'WordPress could not pause before reconstructing the automatic rollback receipt.');
        }
        return $this->persistPendingTerminalAcknowledgement(
            $manifest,
            $payload,
            (string) $active['deployment_id']
        );
    }

    /** @return array{failed:array<string,mixed>,active:array<string,mixed>}|null */
    private function recoverableAutomaticRollback(): ?array
    {
        $failed = $this->releases->latest($this->connection->connectionId());
        if (!is_array($failed)
            || (string) ($failed['status'] ?? '') !== 'failed'
            || !Support::validIdentifier((string) ($failed['previous_deployment_id'] ?? ''), 160)
            || in_array($this->storedAckState((string) ($failed['deployment_id'] ?? '')), ['failed', 'rolled_back'], true)) {
            return null;
        }
        $active = $this->releases->active();
        if (!$this->isVerifiedRollbackCandidate($active)
            || !hash_equals((string) $failed['previous_deployment_id'], (string) ($active['deployment_id'] ?? ''))
            || !hash_equals($this->connection->connectionId(), (string) ($active['connection_id'] ?? ''))
            || !hash_equals($this->connection->siteId(), (string) ($active['site_id'] ?? ''))) {
            return null;
        }
        return ['failed' => $failed, 'active' => $active];
    }

    /** @return array<string,array<string,mixed>> */
    private function pendingTerminalAcknowledgements(): array
    {
        $pending = get_option(self::PENDING_TERMINAL_ACKS_OPTION, []);
        return is_array($pending) ? $pending : [];
    }

    /**
     * @param array<string,mixed> $manifest
     * @param array<string,mixed> $payload
     * @return true|\WP_Error
     */
    private function persistPendingTerminalAcknowledgement(
        array $manifest,
        array $payload,
        string $expectedActiveDeploymentId,
        ?\WP_Error $error = null,
        bool $attempted = false
    ): bool|\WP_Error {
        $deploymentId = (string) ($manifest['deploymentId'] ?? '');
        if (!Support::validIdentifier($deploymentId, 160)
            || !Support::validIdentifier($expectedActiveDeploymentId, 160)
            || (string) ($payload['status'] ?? '') !== 'rolled_back') {
            return new \WP_Error('pagecraft_terminal_ack_record_invalid', 'The rollback acknowledgement could not be persisted safely.');
        }
        $pending = $this->pendingTerminalAcknowledgements();
        $previous = is_array($pending[$deploymentId] ?? null) ? $pending[$deploymentId] : [];
        $now = Support::utcNow();
        $pending[$deploymentId] = [
            'manifest' => [
                'releaseId' => (string) ($manifest['releaseId'] ?? ''),
                'deploymentId' => $deploymentId,
                'sequence' => (int) ($manifest['sequence'] ?? 0),
                'artifactHash' => strtolower((string) ($manifest['artifactHash'] ?? '')),
                '_manifestHash' => strtolower((string) ($manifest['_manifestHash'] ?? '')),
                '_deploymentHash' => strtolower((string) ($manifest['_deploymentHash'] ?? '')),
            ],
            'payload' => $payload,
            'expected_active_deployment_id' => $expectedActiveDeploymentId,
            'attempts' => (int) ($previous['attempts'] ?? 0) + ($attempted ? 1 : 0),
            'first_pending_at' => (string) ($previous['first_pending_at'] ?? $now),
            'last_attempt_at' => $attempted ? $now : ($previous['last_attempt_at'] ?? null),
            'last_error_code' => $error ? (string) $error->get_error_code() : ($previous['last_error_code'] ?? null),
            'last_error_message' => $error ? wp_strip_all_tags($error->get_error_message()) : ($previous['last_error_message'] ?? null),
        ];
        if (count($pending) > 25) {
            $pending = array_slice($pending, -25, null, true);
        }
        update_option(self::PENDING_TERMINAL_ACKS_OPTION, $pending, false);
        $stored = $this->pendingTerminalAcknowledgements();
        if (!isset($stored[$deploymentId])
            || Support::json($stored[$deploymentId]['payload'] ?? null) !== Support::json($payload)
            || !hash_equals($expectedActiveDeploymentId, (string) ($stored[$deploymentId]['expected_active_deployment_id'] ?? ''))) {
            return new \WP_Error('pagecraft_terminal_ack_persist_failed', 'WordPress could not durably persist the rollback acknowledgement. Synchronization remains paused.');
        }
        return true;
    }

    /** @return true|\WP_Error */
    private function retryPendingTerminalAcknowledgements(): bool|\WP_Error
    {
        $firstError = null;
        foreach ($this->pendingTerminalAcknowledgements() as $deploymentId => $record) {
            if (!is_array($record)
                || !is_array($record['manifest'] ?? null)
                || !is_array($record['payload'] ?? null)) {
                $firstError ??= new \WP_Error('pagecraft_terminal_ack_record_invalid', 'A stored Pagecraft rollback acknowledgement is invalid and was not sent.');
                continue;
            }
            $manifest = $record['manifest'];
            $payload = $record['payload'];
            $expectedActiveId = (string) ($record['expected_active_deployment_id'] ?? '');
            $base = $this->ack($manifest, 'rolled_back');
            if (!Support::validIdentifier((string) $deploymentId, 160)
                || !hash_equals((string) $deploymentId, (string) ($manifest['deploymentId'] ?? ''))
                || !Support::validIdentifier($expectedActiveId, 160)
                || !hash_equals((string) $base['releaseId'], (string) ($payload['releaseId'] ?? ''))
                || (int) $base['targetSequence'] !== (int) ($payload['targetSequence'] ?? -1)
                || !hash_equals((string) $base['idempotencyKey'], (string) ($payload['idempotencyKey'] ?? ''))
                || (string) ($payload['status'] ?? '') !== 'rolled_back') {
                $firstError ??= new \WP_Error('pagecraft_terminal_ack_record_invalid', 'A stored Pagecraft rollback acknowledgement failed its active-release binding and was not sent.');
                continue;
            }
            $recovered = $this->recoverPendingEmergencyRollback($record);
            if (is_wp_error($recovered)) {
                $firstError ??= $recovered;
                continue;
            }
            $active = $this->releases->active();
            $activeHash = strtolower((string) ($active['artifact_hash'] ?? ''));
            if (!hash_equals($expectedActiveId, (string) ($active['deployment_id'] ?? ''))
                || !preg_match('/^[a-f0-9]{64}$/', $activeHash)
                || !hash_equals($activeHash, strtolower((string) ($payload['activeHash'] ?? '')))) {
                $firstError ??= new \WP_Error('pagecraft_terminal_ack_record_invalid', 'A stored Pagecraft rollback acknowledgement is not bound to the exact active release and was not sent.');
                continue;
            }
            $result = $this->sendAcknowledgement($payload);
            if (is_wp_error($result)) {
                $this->persistPendingTerminalAcknowledgement($manifest, $payload, $expectedActiveId, $result, true);
                $firstError ??= $result;
                continue;
            }
            $this->storeAckState((string) $deploymentId, 'rolled_back');
            $this->clearPendingTerminalAcknowledgement((string) $deploymentId);
        }
        return $firstError ?? true;
    }

    /**
     * Complete the exact emergency intent if PHP stopped after its outbox was
     * persisted but before the atomic pointer switch. No other pointer topology
     * is eligible, so a stale or edited option remains fail-closed.
     *
     * @param array<string,mixed> $record
     * @return true|\WP_Error
     */
    private function recoverPendingEmergencyRollback(array $record): bool|\WP_Error
    {
        $intent = get_option(Connection::EMERGENCY_ROLLBACK_OPTION, []);
        if (!is_array($intent)
            || !in_array((string) ($intent['status'] ?? ''), ['pending', 'activation_failed', 'active'], true)) {
            return true;
        }
        $manifest = is_array($record['manifest'] ?? null) ? $record['manifest'] : [];
        $payload = is_array($record['payload'] ?? null) ? $record['payload'] : [];
        $sourceId = (string) ($manifest['deploymentId'] ?? '');
        $expectedActiveId = (string) ($record['expected_active_deployment_id'] ?? '');
        if (!hash_equals($expectedActiveId, (string) ($intent['requested_deployment_id'] ?? ''))
            || !hash_equals($sourceId, (string) ($intent['previous_deployment_id'] ?? ''))) {
            return true;
        }
        $active = $this->releases->active();
        $activeId = (string) ($active['deployment_id'] ?? '');
        $target = $this->releases->find($expectedActiveId);
        if (!$this->isVerifiedRollbackCandidate($target)
            || !preg_match('/^[a-f0-9]{64}$/', strtolower((string) ($target['artifact_hash'] ?? '')))
            || !hash_equals(strtolower((string) $target['artifact_hash']), strtolower((string) ($payload['activeHash'] ?? '')))) {
            return new \WP_Error('pagecraft_rollback_recovery_target', 'The exact verified rollback target is unavailable; synchronization remains paused.');
        }
        if (hash_equals($expectedActiveId, $activeId)) {
            if ((string) ($intent['status'] ?? '') !== 'active') {
                $finished = $this->finishEmergencyRollbackIntent($intent, 'active');
                if (is_wp_error($finished)) {
                    return $finished;
                }
            }
            return true;
        }
        if (!$this->isVerifiedRollbackCandidate($active) || !hash_equals($sourceId, $activeId)) {
            return new \WP_Error('pagecraft_rollback_recovery_pointer', 'The public release pointer no longer matches the exact interrupted rollback intent; synchronization remains paused.');
        }
        $heartbeat = $this->heartbeat();
        if (is_wp_error($heartbeat)) {
            return $heartbeat;
        }
        $activated = ($this->rollbackActivator)($expectedActiveId, $this->fenceGuard());
        if (is_wp_error($activated)) {
            $this->finishEmergencyRollbackIntent($intent, 'activation_failed', $activated);
            return $activated;
        }
        $finished = $this->finishEmergencyRollbackIntent($intent, 'active');
        if (is_wp_error($finished)) {
            return $finished;
        }
        $this->clearPendingLiveAcknowledgement($sourceId);
        $targetManifest = $this->manifestForRelease($target);
        $this->clearKnownCaches($targetManifest, 'emergency_rollback_recovery');
        return true;
    }

    private function clearPendingTerminalAcknowledgement(string $deploymentId): void
    {
        $pending = $this->pendingTerminalAcknowledgements();
        if (!array_key_exists($deploymentId, $pending)) {
            return;
        }
        unset($pending[$deploymentId]);
        update_option(self::PENDING_TERMINAL_ACKS_OPTION, $pending, false);
    }

    /** @param array<string,mixed> $payload @return array<string,mixed>|\WP_Error */
    private function sendAcknowledgement(array $payload): array|\WP_Error
    {
        return ($this->acknowledger)($payload);
    }

    /**
     * Clear only documented, whole-site cache surfaces after the active pointer
     * changes. Every integration is optional and failures are isolated so a
     * cache plugin cannot leave activation control flow half-complete.
     *
     * @param array<string,mixed> $manifest
     */
    private function clearKnownCaches(array $manifest, string $reason): void
    {
        $errors = [];
        foreach (['posts', 'post_meta'] as $group) {
            if (function_exists('wp_cache_flush_group')) {
                try {
                    wp_cache_flush_group($group);
                } catch (\Throwable $error) {
                    $errors[] = 'object-cache:' . $group . ':' . $error->getMessage();
                }
            }
        }
        $calls = [
            'rocket_clean_domain' => static fn (): mixed => rocket_clean_domain(),
            'w3tc_flush_all' => static fn (): mixed => w3tc_flush_all(),
            'wp_cache_clear_cache' => static fn (): mixed => wp_cache_clear_cache(),
        ];
        foreach ($calls as $function => $call) {
            if (!function_exists($function)) {
                continue;
            }
            try {
                $call();
            } catch (\Throwable $error) {
                $errors[] = $function . ':' . $error->getMessage();
            }
        }
        try {
            do_action('litespeed_purge_all', 'Pagecraft ' . $reason);
        } catch (\Throwable $error) {
            $errors[] = 'litespeed_purge_all:' . $error->getMessage();
        }
        do_action('pagecraft_connector_release_cache_cleared', $manifest, $reason, $errors);
    }

    /** @param array<string,mixed> $release @return array<string,mixed> */
    private function manifestForRelease(array $release): array
    {
        $manifest = is_array($release['manifest'] ?? null) ? $release['manifest'] : [];
        return array_replace($manifest, [
            'releaseId' => (string) ($release['release_id'] ?? ''),
            'deploymentId' => (string) ($release['deployment_id'] ?? ''),
            'sequence' => (int) ($release['sequence'] ?? 0),
            'artifactHash' => (string) ($release['artifact_hash'] ?? ''),
            '_manifestHash' => (string) ($release['manifest_hash'] ?? ''),
            '_deploymentHash' => (string) ($release['deployment_hash'] ?? ''),
        ]);
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $artifact @param list<string> $pendingScripts @return array<string,mixed> */
    public static function mergeArtifact(array $manifest, array $artifact, array $pendingScripts): array
    {
        $routesByPage = [];
        foreach ((array) ($artifact['routes'] ?? []) as $route) {
            if (is_array($route)) {
                $route['_shared'] = is_array($artifact['shared'] ?? null) ? $artifact['shared'] : [];
                $routesByPage[(string) ($route['pageId'] ?? '')] = $route;
            }
        }
        $entities = is_array($artifact['entities'] ?? null) ? $artifact['entities'] : [];
        $pages = [];
        foreach ((array) ($entities['pages'] ?? []) as $entity) {
            if (!is_array($entity)) {
                continue;
            }
            $pageId = (string) ($entity['pageId'] ?? '');
            if (isset($routesByPage[$pageId])) {
                $pages[] = array_replace($routesByPage[$pageId], $entity);
                unset($routesByPage[$pageId]);
            }
        }
        foreach ($routesByPage as $route) {
            $pages[] = $route;
        }
        $manifest['pages'] = $pages;
        $manifest['assets'] = is_array($artifact['assets'] ?? null) ? $artifact['assets'] : [];
        $cms = is_array($artifact['cms'] ?? null) ? $artifact['cms'] : [];
        $manifest['cms'] = ['collections' => is_array($cms['collections'] ?? null) ? $cms['collections'] : []];
        $manifest['nativeOps'] = is_array($artifact['nativeOps'] ?? null) ? $artifact['nativeOps'] : [];
        $manifest['redirects'] = is_array($artifact['redirects'] ?? null) ? $artifact['redirects'] : [];
        $manifest['entities'] = $entities;
        $manifest['forms'] = is_array($entities['forms'] ?? null) ? $entities['forms'] : [];
        $manifest['rendererVersion'] = (string) ($artifact['rendererVersion'] ?? '');
        $manifest['_pendingScripts'] = $pendingScripts;
        $manifest['_artifactFormat'] = (string) ($artifact['format'] ?? '');
        return $manifest;
    }

    /** @param array<string,mixed> $desired */
    private function setEtag(array $desired): void
    {
        if (!empty($desired['_etag']) && is_string($desired['_etag'])) {
            $this->releases->setEtag($desired['_etag']);
        }
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $extra @return array<string,mixed> */
    private function ack(array $manifest, string $status, array $extra = []): array
    {
        $keyMaterial = $this->connection->connectionId() . "\0" . (string) $manifest['releaseId'] . "\0" . (int) $manifest['sequence'] . "\0" . $status;
        return array_replace([
            'releaseId' => (string) $manifest['releaseId'],
            'targetSequence' => (int) $manifest['sequence'],
            'status' => $status,
            'activeHash' => null,
            'idempotencyKey' => 'wp-' . (int) $manifest['sequence'] . '-' . $status . '-' . substr(hash('sha256', $keyMaterial), 0, 32),
        ], $extra);
    }

    private function storedAckState(string $deploymentId): string
    {
        $states = get_option('pagecraft_deployment_ack_states', []);
        return is_array($states) ? (string) ($states[$deploymentId] ?? '') : '';
    }

    private function storeAckState(string $deploymentId, string $state): void
    {
        $states = get_option('pagecraft_deployment_ack_states', []);
        $states = is_array($states) ? $states : [];
        $states[$deploymentId] = $state;
        if (count($states) > 25) {
            $states = array_slice($states, -25, null, true);
        }
        update_option('pagecraft_deployment_ack_states', $states, false);
    }

    /** Retain rollback releases under the same fence used by activation and rollback. @return true|\WP_Error */
    public function retainReleases(int $count = 5): bool|\WP_Error
    {
        $ownsLease = $this->acquireLease('retention');
        if (is_wp_error($ownsLease)) {
            return $ownsLease;
        }
        try {
            return $this->releases->retain(
                $count,
                $this->fenceGuard(),
                $this->connection->connectionId(),
                $this->connection->siteId()
            );
        } finally {
            $this->releaseLease($ownsLease);
        }
    }

    /** Pin changes share the deployment fence with retention and activation. @return true|\WP_Error */
    public function pinRelease(string $deploymentId, bool $pinned): bool|\WP_Error
    {
        $ownsLease = $this->acquireLease('pin');
        if (is_wp_error($ownsLease)) {
            return $ownsLease;
        }
        try {
            return $this->releases->pin($deploymentId, $pinned, $this->fenceGuard());
        } finally {
            $this->releaseLease($ownsLease);
        }
    }

    /** @return bool|\WP_Error True means this call acquired the outer lease. */
    private function acquireLease(string $purpose): bool|\WP_Error
    {
        if ($this->lease !== null) {
            $owned = $this->deploymentLock->assertOwned($this->lease);
            return is_wp_error($owned) ? $owned : false;
        }
        $lease = $this->deploymentLock->acquire($purpose);
        if (is_wp_error($lease)) {
            return $lease;
        }
        $this->lease = $lease;
        $lifecycle = $this->connection->lifecycleSnapshot();
        if (is_wp_error($lifecycle)) {
            $this->lease = null;
            $this->deploymentLock->release($lease);
            return $lifecycle;
        }
        $this->connectionLifecycle = $lifecycle;
        return true;
    }

    private function releaseLease(bool $ownedHere): void
    {
        if (!$ownedHere || $this->lease === null) {
            return;
        }
        $lease = $this->lease;
        $this->lease = null;
        $this->connectionLifecycle = null;
        $this->deploymentLock->release($lease);
    }

    /** @return true|\WP_Error */
    private function heartbeat(): bool|\WP_Error
    {
        if ($this->lease === null) {
            return new \WP_Error('pagecraft_deployment_lock_missing', 'No Pagecraft deployment lock is held.');
        }
        $renewed = $this->deploymentLock->renew($this->lease);
        if (is_wp_error($renewed)) {
            return $renewed;
        }
        $this->lease = $renewed;
        if ($this->connectionLifecycle === null) {
            return new \WP_Error('pagecraft_connection_lifecycle_missing', 'No Pagecraft connection lifecycle fence is held.');
        }
        return $this->connection->assertLifecycleSnapshot($this->connectionLifecycle);
    }

    /** @return \Closure(): (true|\WP_Error) */
    private function fenceGuard(): \Closure
    {
        return function (): bool|\WP_Error {
            if ($this->lease === null) {
                return new \WP_Error('pagecraft_deployment_lock_missing', 'No Pagecraft deployment lock is held.');
            }
            $owned = $this->deploymentLock->assertOwned($this->lease);
            if (is_wp_error($owned)) {
                return $owned;
            }
            if ($this->connectionLifecycle === null) {
                return new \WP_Error('pagecraft_connection_lifecycle_missing', 'No Pagecraft connection lifecycle fence is held.');
            }
            return $this->connection->assertLifecycleSnapshot($this->connectionLifecycle);
        };
    }

    /** Persist the local terminal journal before reporting failure upstream. */
    private function failAfterErrorJournal(\WP_Error $cause, array $manifest): \WP_Error
    {
        $journaled = $this->releases->setError(
            (string) ($manifest['deploymentId'] ?? ''),
            (string) $cause->get_error_code(),
            $cause->get_error_message()
        );
        if (is_wp_error($journaled)) {
            return $this->recordFailure(new \WP_Error(
                'pagecraft_failure_journal_pending',
                $cause->get_error_message() . ' WordPress could not durably journal that failure, so no terminal acknowledgement was sent.',
                ['cause' => $cause->get_error_code(), 'journal_error' => $journaled->get_error_code()]
            ), $manifest, 'failure_journal_pending');
        }
        return $this->fail($cause, $manifest);
    }

    /** @param array<string,mixed>|null $manifest @return \WP_Error */
    private function fail(\WP_Error $error, ?array $manifest = null): \WP_Error
    {
        update_option('pagecraft_last_sync', [
            'status' => 'failed',
            'at' => Support::utcNow(),
            'error_code' => $error->get_error_code(),
            'message' => $error->get_error_message(),
            'release_id' => $manifest['releaseId'] ?? null,
        ], false);
        if ($manifest
            && isset($manifest['releaseId'], $manifest['sequence'], $manifest['deploymentId'])
            && !in_array($this->lastAcknowledgedState, ['', 'live', 'failed', 'rolled_back'], true)) {
            $result = $this->sendAcknowledgement($this->ack($manifest, 'failed', [
                'error' => $error->get_error_message(),
                'detail' => [
                    'code' => $error->get_error_code(),
                    'message' => $error->get_error_message(),
                    'stage' => $this->lastAcknowledgedState,
                    'action' => 'Inspect WordPress Site Health and retry after correcting the reported issue.',
                ],
            ]));
            if (!is_wp_error($result)) {
                $this->lastAcknowledgedState = 'failed';
                $this->storeAckState((string) $manifest['deploymentId'], 'failed');
            }
        }
        return $error;
    }

    /** @param array<string,mixed>|null $manifest @return array<string,mixed> */
    private function acknowledgementPending(\WP_Error $error, ?array $manifest): array
    {
        return $this->succeed([
            'status' => 'acknowledgement_pending',
            'release_id' => $manifest['releaseId'] ?? null,
            'deployment_id' => $manifest['deploymentId'] ?? null,
            'error_code' => $error->get_error_code(),
            'message' => 'The verified Pagecraft release remains active. WordPress will retry the exact live acknowledgement automatically: ' . $error->get_error_message(),
        ]);
    }

    /** @param array<string,mixed>|null $manifest @return array<string,mixed> */
    private function progressAcknowledgementPending(\WP_Error $error, ?array $manifest): array
    {
        return $this->succeed([
            'status' => 'acknowledgement_pending',
            'release_id' => $manifest['releaseId'] ?? null,
            'deployment_id' => $manifest['deploymentId'] ?? null,
            'error_code' => $error->get_error_code(),
            'message' => 'The installed Pagecraft candidate remains private. WordPress will replay its exact ordered deployment acknowledgement before activation: ' . $error->get_error_message(),
        ]);
    }

    /** @param array<string,mixed>|null $manifest */
    private function recordFailure(\WP_Error $error, ?array $manifest, string $status = 'failed'): \WP_Error
    {
        update_option('pagecraft_last_sync', [
            'status' => $status,
            'at' => Support::utcNow(),
            'error_code' => $error->get_error_code(),
            'message' => $error->get_error_message(),
            'release_id' => $manifest['releaseId'] ?? null,
        ], false);
        return $error;
    }

    /** @param array<string,mixed> $result @return array<string,mixed> */
    private function succeed(array $result): array
    {
        update_option('pagecraft_last_sync', ['status' => $result['status'] ?? 'ok', 'at' => Support::utcNow()] + $result, false);
        do_action('pagecraft_connector_sync_succeeded', $result);
        return $result;
    }
}
