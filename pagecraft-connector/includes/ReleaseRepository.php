<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use RuntimeException;

final class ReleaseRepository
{
    /** @var list<array{object_id:int,kind:'attachment'|'post'}> */
    private static array $managedObjectDeletionScopes = [];

    public static function isDeletingManagedObject(?int $objectId = null, ?string $kind = null): bool
    {
        if ($objectId === null) {
            return self::$managedObjectDeletionScopes !== [];
        }
        foreach (array_reverse(self::$managedObjectDeletionScopes) as $scope) {
            if ($scope['object_id'] === $objectId && ($kind === null || $scope['kind'] === $kind)) {
                return true;
            }
        }
        return false;
    }

    /** @return array<string,mixed>|null */
    public function active(): ?array
    {
        $id = (string) get_option('pagecraft_active_release_id', '');
        return $id !== '' ? $this->find($id) : null;
    }

    /** @return array<string,mixed>|null */
    public function find(string $deploymentId): ?array
    {
        global $wpdb;
        if (!Support::validIdentifier($deploymentId, 160)) {
            return null;
        }
        $table = $wpdb->prefix . 'pagecraft_releases';
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE deployment_id = %s OR release_id = %s ORDER BY sequence_no DESC LIMIT 1", $deploymentId, $deploymentId), ARRAY_A);
        return is_array($row) ? $this->normalize($row) : null;
    }

    /** @return array<string,mixed>|null */
    public function latest(string $connectionId = ''): ?array
    {
        global $wpdb;
        if ($connectionId !== '') {
            if (!Support::validIdentifier($connectionId, 96)) {
                return null;
            }
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}pagecraft_releases WHERE connection_id = %s ORDER BY sequence_no DESC,id DESC LIMIT 1",
                $connectionId
            ), ARRAY_A);
        } else {
            $row = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}pagecraft_releases ORDER BY sequence_no DESC,id DESC LIMIT 1", ARRAY_A);
        }
        return is_array($row) ? $this->normalize($row) : null;
    }

    /**
     * Deployment IDs are local storage keys. Preserve the established compact
     * form, but add a deterministic connection suffix when a re-paired target
     * reuses the same release/sequence tuple under another signed envelope.
     *
     * @param array<string,mixed> $manifest
     * @return array<string,mixed>|\WP_Error
     */
    public function scopeDeploymentId(array $manifest): array|\WP_Error
    {
        $deploymentId = (string) ($manifest['deploymentId'] ?? '');
        $connectionId = (string) ($manifest['connectionId'] ?? '');
        if (!Support::validIdentifier($deploymentId, 160) || !Support::validIdentifier($connectionId, 96)) {
            return new \WP_Error('pagecraft_deployment_identity', 'The signed deployment has no valid local connection identity.');
        }
        $existing = $this->find($deploymentId);
        if (!$existing || hash_equals($connectionId, (string) ($existing['connection_id'] ?? ''))) {
            return $manifest;
        }
        $scopedId = $deploymentId . ':c:' . substr(hash('sha256', $connectionId), 0, 12);
        if (!Support::validIdentifier($scopedId, 160)) {
            return new \WP_Error('pagecraft_deployment_identity', 'The connection-scoped deployment identifier is too long.');
        }
        $scoped = $this->find($scopedId);
        if ($scoped && !hash_equals($connectionId, (string) ($scoped['connection_id'] ?? ''))) {
            return new \WP_Error('pagecraft_release_collision', 'The connection-scoped deployment identifier is already owned by another target.');
        }
        $manifest['deploymentId'] = $scopedId;
        return $manifest;
    }

    /** @return list<array<string,mixed>> */
    public function list(int $limit = 25): array
    {
        global $wpdb;
        $limit = max(1, min(100, $limit));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pagecraft_releases ORDER BY sequence_no DESC,id DESC LIMIT %d",
            $limit
        ), ARRAY_A);
        return is_array($rows) ? array_map([$this, 'normalize'], $rows) : [];
    }

    /** @param array<string,mixed> $manifest @return true|\WP_Error */
    public function stage(array $manifest): bool|\WP_Error
    {
        global $wpdb;
        $releaseId = (string) ($manifest['releaseId'] ?? '');
        $deploymentId = (string) ($manifest['deploymentId'] ?? ($releaseId . ':target:' . (int) ($manifest['sequence'] ?? 0)));
        $connectionId = (string) ($manifest['connectionId'] ?? '');
        $siteId = (string) ($manifest['siteId'] ?? '');
        $manifestHash = (string) ($manifest['_manifestHash'] ?? '');
        if (!Support::validIdentifier($connectionId, 96) || !Support::validIdentifier($siteId, 96)) {
            return new \WP_Error('pagecraft_release_binding', 'The staged release is missing its signed Pagecraft connection or site binding.');
        }
        $existing = $this->find($deploymentId);
        if ($existing) {
            if (!hash_equals((string) $existing['manifest_hash'], $manifestHash)
                || !hash_equals((string) $existing['deployment_hash'], (string) ($manifest['_deploymentHash'] ?? ''))) {
                return new \WP_Error('pagecraft_release_collision', 'A release with this ID already exists with different signed content.');
            }
            return true;
        }

        $latest = $this->latest($connectionId);
        if ($latest && (int) $manifest['sequence'] <= (int) $latest['sequence']) {
            return new \WP_Error('pagecraft_release_replay', 'The release sequence is not newer than the last installed release.');
        }

        $storedManifest = $manifest;
        unset($storedManifest['_releaseCanonical'], $storedManifest['_deploymentCanonical'], $storedManifest['_artifact']);
        $inserted = $wpdb->insert(
            $wpdb->prefix . 'pagecraft_releases',
            [
                'release_id' => $releaseId,
                'deployment_id' => $deploymentId,
                'sequence_no' => (int) $manifest['sequence'],
                'connection_id' => $connectionId,
                'site_id' => $siteId,
                'source_version' => (int) $manifest['sourceVersion'],
                'status' => 'staged',
                'manifest' => Support::json($storedManifest),
                'manifest_hash' => $manifestHash,
                'deployment_hash' => (string) ($manifest['_deploymentHash'] ?? ''),
                'artifact_hash' => strtolower((string) $manifest['artifactHash']),
                'parent_release_id' => !empty($manifest['parentReleaseId']) ? (string) $manifest['parentReleaseId'] : null,
                'created_at' => $this->mysqlDate((string) ($manifest['createdAt'] ?? '')),
                'installed_at' => null,
                'activated_at' => null,
                'verified_at' => null,
                'previous_deployment_id' => null,
                'pinned' => 0,
                'error_code' => null,
                'error_message' => null,
            ],
            ['%s', '%s', '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s']
        );
        return $inserted === false ? new \WP_Error('pagecraft_release_store', 'WordPress could not stage the release record.') : true;
    }

    /** @param list<array<string,mixed>> $routes */
    public function replaceRoutes(string $deploymentId, array $routes): bool|\WP_Error
    {
        global $wpdb;
        if (!Support::validIdentifier($deploymentId, 160)) {
            return new \WP_Error('pagecraft_route_deployment', 'The Pagecraft route deployment identifier is invalid.');
        }
        foreach ($routes as $route) {
            if (!is_array($route) || !Support::validIdentifier($route['page_id'] ?? null)) {
                return new \WP_Error('pagecraft_route_page_id', 'A Pagecraft route has an invalid page identifier.');
            }
        }
        $table = $wpdb->prefix . 'pagecraft_routes';
        $wpdb->delete($table, ['release_id' => $deploymentId], ['%s']);
        foreach ($routes as $route) {
            $ok = $wpdb->insert($table, [
                'release_id' => $deploymentId,
                'route_path' => Support::normalizeRoute((string) ($route['route_path'] ?? '/')),
                'page_id' => (string) ($route['page_id'] ?? ''),
                'post_id' => !empty($route['post_id']) ? (int) $route['post_id'] : null,
                'title' => (string) ($route['title'] ?? ''),
                'description' => (string) ($route['description'] ?? ''),
                'head_html' => (string) ($route['head_html'] ?? ''),
                'body_html' => (string) ($route['body_html'] ?? ''),
                'content_hash' => (string) ($route['content_hash'] ?? hash('sha256', (string) ($route['body_html'] ?? ''))),
                'seo_json' => Support::json($route['seo'] ?? []),
                'scripts_json' => Support::json($route['scripts'] ?? []),
            ], ['%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s']);
            if ($ok === false) {
                return new \WP_Error('pagecraft_route_store', 'WordPress could not stage all Pagecraft routes.');
            }
        }
        return true;
    }

    /** @return true|\WP_Error */
    public function markInstalled(string $deploymentId, bool $needsApproval = false): bool|\WP_Error
    {
        global $wpdb;
        $updated = $wpdb->update(
            $wpdb->prefix . 'pagecraft_releases',
            ['status' => $needsApproval ? 'needs_approval' : 'installed', 'installed_at' => Support::utcNow(), 'error_code' => null, 'error_message' => null],
            ['deployment_id' => $deploymentId, 'status' => 'staged'],
            ['%s', '%s', '%s', '%s'],
            ['%s', '%s']
        );
        return $updated === 1
            ? true
            : new \WP_Error('pagecraft_release_install_persist', 'WordPress could not atomically mark the exact staged Pagecraft deployment as installed. It remains private and will be retried.');
    }

    /** @param list<mixed> $redirects */
    public function replaceRedirects(string $deploymentId, array $redirects): bool|\WP_Error
    {
        global $wpdb;
        $table = $wpdb->prefix . 'pagecraft_redirects';
        $wpdb->delete($table, ['release_id' => $deploymentId], ['%s']);
        foreach ($redirects as $redirect) {
            if (!is_array($redirect)) {
                return new \WP_Error('pagecraft_redirect_invalid', 'A signed redirect is invalid.');
            }
            $from = Support::normalizeRoute((string) ($redirect['from'] ?? ''));
            $to = Support::normalizeRoute((string) ($redirect['to'] ?? ''));
            $status = (int) ($redirect['status'] ?? 301);
            if ($from === $to || strlen($from) > 191 || strlen($to) > 191 || !in_array($status, [301, 302, 307, 308], true)) {
                return new \WP_Error('pagecraft_redirect_invalid', 'A signed redirect is unsafe or self-referential.');
            }
            if ($wpdb->insert($table, ['release_id' => $deploymentId, 'from_path' => $from, 'to_path' => $to, 'status_code' => $status], ['%s', '%s', '%s', '%d']) === false) {
                return new \WP_Error('pagecraft_redirect_store', 'WordPress could not stage all signed redirects.');
            }
        }
        return true;
    }

    /** @return array{to:string,status:int}|null */
    public function redirect(string $path): ?array
    {
        global $wpdb;
        $active = (string) get_option('pagecraft_active_release_id', '');
        if ($active === '') {
            return null;
        }
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT to_path,status_code FROM {$wpdb->prefix}pagecraft_redirects WHERE release_id = %s AND from_path = %s LIMIT 1",
            $active,
            Support::normalizeRoute($path)
        ), ARRAY_A);
        return is_array($row) ? ['to' => (string) $row['to_path'], 'status' => (int) $row['status_code']] : null;
    }

    /** @return true|\WP_Error */
    public function markReady(string $deploymentId): bool|\WP_Error
    {
        global $wpdb;
        $updated = $wpdb->update(
            $wpdb->prefix . 'pagecraft_releases',
            ['status' => 'installed', 'error_code' => null, 'error_message' => null],
            ['deployment_id' => $deploymentId, 'status' => 'needs_approval'],
            ['%s', '%s', '%s'],
            ['%s', '%s']
        );
        $stored = $this->find($deploymentId);
        if ($updated !== 1 || !is_array($stored) || (string) ($stored['status'] ?? '') !== 'installed') {
            return new \WP_Error('pagecraft_release_ready_persist_failed', 'WordPress could not durably mark the approved Pagecraft release ready for activation.');
        }
        return true;
    }

    /** @return array<string,mixed>|null */
    public function previousVerified(
        string $excludeDeploymentId,
        string $connectionId,
        string $siteId,
        int $beforeSequence
    ): ?array
    {
        global $wpdb;
        if (!Support::validIdentifier($excludeDeploymentId, 160)
            || !Support::validIdentifier($connectionId, 96)
            || !Support::validIdentifier($siteId, 96)
            || $beforeSequence < 1) {
            return null;
        }
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pagecraft_releases
             WHERE deployment_id <> %s AND connection_id = %s AND site_id = %s AND sequence_no < %d
               AND verified_at IS NOT NULL AND status IN ('active','retained')
             ORDER BY sequence_no DESC,id DESC LIMIT 1",
            $excludeDeploymentId,
            $connectionId,
            $siteId,
            $beforeSequence
        ), ARRAY_A);
        return is_array($row) ? $this->normalize($row) : null;
    }

    /** Mark an active release rollback-safe only after public health probes pass. @return true|\WP_Error */
    public function markVerified(string $deploymentId, ?\Closure $fenceGuard = null): bool|\WP_Error
    {
        global $wpdb;
        $transactional = $this->transactionalStorage();
        if (is_wp_error($transactional)) {
            return $transactional;
        }
        if ($wpdb->query('START TRANSACTION') === false) {
            return new \WP_Error('pagecraft_verify_transaction', 'WordPress could not start the verification transaction.');
        }
        try {
            $this->assertFence($fenceGuard);
            $pointer = $wpdb->get_var($wpdb->prepare(
                "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1 FOR UPDATE",
                'pagecraft_active_release_id'
            ));
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT status,verified_at FROM {$wpdb->prefix}pagecraft_releases WHERE deployment_id = %s LIMIT 1 FOR UPDATE",
                $deploymentId
            ), ARRAY_A);
            if (!is_string($pointer)
                || !hash_equals($deploymentId, $pointer)
                || !is_array($row)
                || (string) ($row['status'] ?? '') !== 'active') {
                throw new RuntimeException('Only the exact active Pagecraft deployment can be marked verified.');
            }
            if (empty($row['verified_at'])) {
                $updated = $wpdb->update(
                    $wpdb->prefix . 'pagecraft_releases',
                    ['verified_at' => Support::utcNow()],
                    ['deployment_id' => $deploymentId, 'status' => 'active'],
                    ['%s'],
                    ['%s', '%s']
                );
                if ($updated !== 1) {
                    throw new RuntimeException('WordPress could not persist the verified release marker.');
                }
            }
            $this->assertFence($fenceGuard);
            if ($wpdb->query('COMMIT') === false) {
                throw new RuntimeException('WordPress could not commit the verified release marker.');
            }
        } catch (\Throwable $error) {
            $wpdb->query('ROLLBACK');
            return new \WP_Error('pagecraft_verify_persist_failed', $error->getMessage());
        }
        return true;
    }

    /** @param array{deployment_id:string,error_code:string,error_message:string}|null $failedActivation */
    public function activate(string $deploymentId, ?\Closure $fenceGuard = null, ?array $failedActivation = null): bool|\WP_Error
    {
        global $wpdb;
        $transactional = $this->transactionalStorage();
        if (is_wp_error($transactional)) {
            return $transactional;
        }

        $objects = $wpdb->prefix . 'pagecraft_objects';
        $releases = $wpdb->prefix . 'pagecraft_releases';
        if ($wpdb->query('START TRANSACTION') === false) {
            return new \WP_Error('pagecraft_activation_transaction', 'WordPress could not start an activation transaction.');
        }
        $targetRows = [];
        $activeRows = [];
        $targetIds = [];
        $targetCollisionIds = [];
        $old = '';
        try {
            $this->assertFence($fenceGuard);
            $releaseRow = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$releases} WHERE deployment_id = %s LIMIT 1 FOR UPDATE",
                $deploymentId
            ), ARRAY_A);
            $release = is_array($releaseRow) ? $this->normalize($releaseRow) : null;
            if (!$release
                || !in_array($release['status'], ['installed', 'active', 'retained'], true)
                || ($release['status'] === 'retained' && empty($release['verified_at']))) {
                throw new RuntimeException('The selected Pagecraft release is not installed.');
            }
            // wpdb::get_var() normalizes an empty string to null. Read the
            // row instead so the valid first-install pointer ("") remains
            // distinguishable from a missing option row while it is locked.
            $pointerRow = $wpdb->get_row($wpdb->prepare(
                "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1 FOR UPDATE",
                'pagecraft_active_release_id'
            ), ARRAY_A);
            if (!is_array($pointerRow) || !array_key_exists('option_value', $pointerRow)) {
                throw new RuntimeException('The active Pagecraft release pointer is unavailable.');
            }
            $pointer = (string) $pointerRow['option_value'];
            $old = $pointer;
            if ($failedActivation !== null
                && (!hash_equals($old, (string) ($failedActivation['deployment_id'] ?? ''))
                    || $old === $deploymentId)) {
                throw new RuntimeException('The failed activation journal does not match the release being restored.');
            }
            if ($old === $deploymentId && $release['status'] === 'active') {
                $this->assertFence($fenceGuard);
                if ($wpdb->query('COMMIT') === false) {
                    throw new RuntimeException('WordPress could not commit the current release verification.');
                }
                return true;
            }
            $targetRows = $wpdb->get_results($wpdb->prepare(
                "SELECT object_id,target_status,source_type FROM {$objects} WHERE deployment_id = %s FOR UPDATE",
                $deploymentId
            ), ARRAY_A);
            $activeRows = $wpdb->get_results("SELECT object_id,target_status,source_type FROM {$objects} WHERE state = 'active' FOR UPDATE", ARRAY_A);
            if (!is_array($targetRows) || !is_array($activeRows)) {
                throw new RuntimeException('WordPress could not read the versioned native mappings.');
            }
            $targetIds = array_fill_keys(array_map(static fn (array $row): int => (int) $row['object_id'], $targetRows), true);
            foreach ($targetRows as $row) {
                if (($row['source_type'] ?? '') === 'collision') {
                    $targetCollisionIds[(int) $row['object_id']] = true;
                }
            }
            $changed = $wpdb->query($wpdb->prepare(
                "UPDATE {$objects} SET state = 'retained', updated_at = %s WHERE state = 'active' AND deployment_id <> %s",
                Support::utcNow(),
                $deploymentId
            ));
            if ($changed === false) {
                throw new RuntimeException('Could not retain the previous native mappings.');
            }
            $this->activationCheckpoint('retain_mappings', $deploymentId, $old);

            foreach ($activeRows as $row) {
                $postId = (int) ($row['object_id'] ?? 0);
                $collision = ($row['source_type'] ?? '') === 'collision';
                if ($postId > 0 && ($collision ? !isset($targetCollisionIds[$postId]) : !isset($targetIds[$postId]))) {
                    $status = $collision ? (string) ($row['target_status'] ?? 'publish') : 'pagecraft_retained';
                    $updated = $wpdb->update($wpdb->posts, ['post_status' => $status], ['ID' => $postId], ['%s'], ['%d']);
                    if ($updated === false) {
                        throw new RuntimeException('Could not hide the previous native objects.');
                    }
                }
            }
            $this->activationCheckpoint('hide_previous_objects', $deploymentId, $old);

            foreach ($targetRows as $row) {
                $postId = (int) ($row['object_id'] ?? 0);
                $status = (string) ($row['target_status'] ?? 'publish');
                $collision = ($row['source_type'] ?? '') === 'collision';
                if (!$collision && !in_array($status, ['publish', 'draft', 'private', 'pending', 'future', 'inherit'], true)) {
                    throw new RuntimeException('A candidate has an invalid target post status.');
                }
                if ($postId > 0) {
                    $updated = $wpdb->update($wpdb->posts, ['post_status' => $collision ? 'pagecraft_retained' : $status], ['ID' => $postId], ['%s'], ['%d']);
                    if ($updated === false) {
                        throw new RuntimeException('Could not activate all native candidate objects.');
                    }
                }
            }
            $this->activationCheckpoint('activate_native_objects', $deploymentId, $old);

            $updated = $wpdb->query($wpdb->prepare(
                "UPDATE {$objects} SET state = 'active', updated_at = %s WHERE deployment_id = %s",
                Support::utcNow(),
                $deploymentId
            ));
            if ($updated === false) {
                throw new RuntimeException('Could not activate the target native mappings.');
            }
            $this->activationCheckpoint('activate_mappings', $deploymentId, $old);

            if ($old !== '' && $old !== $deploymentId) {
                $oldReleaseData = $failedActivation !== null
                    ? [
                        'status' => 'failed',
                        'error_code' => sanitize_key((string) ($failedActivation['error_code'] ?? 'pagecraft_activation_failed')),
                        'error_message' => wp_strip_all_tags((string) ($failedActivation['error_message'] ?? 'Pagecraft activation failed.')),
                    ]
                    : ['status' => 'retained'];
                $updated = $wpdb->update($releases, $oldReleaseData, ['deployment_id' => $old]);
                if ($updated === false) {
                    throw new RuntimeException('Could not journal the previous Pagecraft release state.');
                }
            }
            $updated = $wpdb->update(
                $releases,
                [
                    'status' => 'active',
                    'activated_at' => Support::utcNow(),
                    'previous_deployment_id' => $old !== '' && $old !== $deploymentId ? $old : null,
                ],
                ['deployment_id' => $deploymentId],
                ['%s', '%s', '%s'],
                ['%s']
            );
            if ($updated === false) {
                throw new RuntimeException('Could not activate the Pagecraft release record.');
            }
            $this->activationCheckpoint('release_statuses', $deploymentId, $old);

            $pointer = $wpdb->update($wpdb->options, ['option_value' => $deploymentId, 'autoload' => 'no'], ['option_name' => 'pagecraft_active_release_id'], ['%s', '%s'], ['%s']);
            if ($pointer === false || ($pointer === 0 && $old !== $deploymentId)) {
                throw new RuntimeException('Could not update the active release pointer.');
            }
            $this->activationCheckpoint('active_pointer', $deploymentId, $old);

            $this->assertFence($fenceGuard);
            if ($wpdb->query('COMMIT') === false) {
                throw new RuntimeException('WordPress could not commit the release activation.');
            }
        } catch (\Throwable $error) {
            $wpdb->query('ROLLBACK');
            return new \WP_Error('pagecraft_activation_failed', $error->getMessage());
        }

        wp_cache_delete('pagecraft_active_release_id', 'options');
        wp_cache_delete('alloptions', 'options');
        foreach (array_unique(array_merge(array_keys($targetIds), array_map(static fn (array $row): int => (int) $row['object_id'], $activeRows))) as $postId) {
            if ((int) $postId > 0) {
                clean_post_cache((int) $postId);
            }
        }
        do_action('pagecraft_release_activated', $deploymentId, $old);
        return true;
    }

    /** Restore the offline state when the first activation fails public verification. */
    /** @param array{error_code:string,error_message:string}|null $failedActivation */
    public function deactivate(string $deploymentId, ?\Closure $fenceGuard = null, ?array $failedActivation = null): bool|\WP_Error
    {
        global $wpdb;
        $transactional = $this->transactionalStorage();
        if (is_wp_error($transactional)) {
            return $transactional;
        }
        $objects = $wpdb->prefix . 'pagecraft_objects';
        if ($wpdb->query('START TRANSACTION') === false) {
            return new \WP_Error('pagecraft_deactivate_transaction', 'WordPress could not start the restore transaction.');
        }
        $rows = [];
        try {
            $this->assertFence($fenceGuard);
            $pointer = $wpdb->get_var($wpdb->prepare(
                "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1 FOR UPDATE",
                'pagecraft_active_release_id'
            ));
            if (!is_string($pointer) || $pointer !== $deploymentId) {
                throw new RuntimeException('The deployment is not the active release.');
            }
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT object_id,source_type,target_status FROM {$objects} WHERE deployment_id = %s FOR UPDATE",
                $deploymentId
            ), ARRAY_A);
            if (!is_array($rows)) {
                throw new RuntimeException('WordPress could not lock the active native mappings.');
            }
            foreach ((array) $rows as $row) {
                $status = ($row['source_type'] ?? '') === 'collision' ? (string) ($row['target_status'] ?? 'publish') : 'pagecraft_retained';
                if ($wpdb->update($wpdb->posts, ['post_status' => $status], ['ID' => (int) $row['object_id']], ['%s'], ['%d']) === false) {
                    throw new RuntimeException('Could not hide a failed candidate object.');
                }
            }
            $releaseState = $failedActivation !== null
                ? [
                    'status' => 'failed',
                    'error_code' => sanitize_key((string) ($failedActivation['error_code'] ?? 'pagecraft_activation_failed')),
                    'error_message' => wp_strip_all_tags((string) ($failedActivation['error_message'] ?? 'Pagecraft activation failed.')),
                ]
                : ['status' => 'retained'];
            if ($wpdb->update($objects, ['state' => 'retained', 'updated_at' => Support::utcNow()], ['deployment_id' => $deploymentId], ['%s', '%s'], ['%s']) === false
                || $wpdb->update($wpdb->prefix . 'pagecraft_releases', $releaseState, ['deployment_id' => $deploymentId]) === false
                || $wpdb->update($wpdb->options, ['option_value' => '', 'autoload' => 'no'], ['option_name' => 'pagecraft_active_release_id'], ['%s', '%s'], ['%s']) === false) {
                throw new RuntimeException('Could not restore the offline active-release state.');
            }
            $this->assertFence($fenceGuard);
            if ($wpdb->query('COMMIT') === false) {
                throw new RuntimeException('WordPress could not commit the restore transaction.');
            }
        } catch (\Throwable $error) {
            $wpdb->query('ROLLBACK');
            return new \WP_Error('pagecraft_deactivate_failed', $error->getMessage());
        }
        wp_cache_delete('pagecraft_active_release_id', 'options');
        wp_cache_delete('alloptions', 'options');
        foreach ((array) $rows as $row) {
            clean_post_cache((int) $row['object_id']);
        }
        do_action('pagecraft_release_deactivated', $deploymentId);
        return true;
    }

    /** @return true|\WP_Error */
    public function setError(string $deploymentId, string $code, string $message): bool|\WP_Error
    {
        global $wpdb;
        $errorCode = sanitize_key($code);
        $errorMessage = wp_strip_all_tags($message);
        $updated = $wpdb->update(
            $wpdb->prefix . 'pagecraft_releases',
            ['status' => 'failed', 'error_code' => $errorCode, 'error_message' => $errorMessage],
            ['deployment_id' => $deploymentId],
            ['%s', '%s', '%s'],
            ['%s']
        );
        $stored = $this->find($deploymentId);
        if ($updated !== 1
            || !is_array($stored)
            || (string) ($stored['status'] ?? '') !== 'failed'
            || !hash_equals($errorCode, (string) ($stored['error_code'] ?? ''))
            || !hash_equals($errorMessage, (string) ($stored['error_message'] ?? ''))) {
            return new \WP_Error('pagecraft_release_error_persist_failed', 'WordPress could not durably journal the failed Pagecraft deployment state.');
        }
        return true;
    }

    /** @return true|\WP_Error */
    public function pin(string $deploymentId, bool $pinned, ?\Closure $fenceGuard = null): bool|\WP_Error
    {
        global $wpdb;
        try {
            $this->assertFence($fenceGuard);
        } catch (\Throwable $error) {
            return new \WP_Error('pagecraft_pin_fenced', $error->getMessage());
        }
        $updated = $wpdb->update(
            $wpdb->prefix . 'pagecraft_releases',
            ['pinned' => $pinned ? 1 : 0],
            ['deployment_id' => $deploymentId],
            ['%d'],
            ['%s']
        );
        try {
            $this->assertFence($fenceGuard);
        } catch (\Throwable $error) {
            return new \WP_Error('pagecraft_pin_fenced', $error->getMessage());
        }
        $stored = $this->find($deploymentId);
        if ($updated !== 1 || !is_array($stored) || (bool) ($stored['pinned'] ?? false) !== $pinned) {
            return new \WP_Error('pagecraft_pin_persist_failed', 'WordPress could not durably update the exact Pagecraft rollback pin.');
        }
        return true;
    }

    /** @return array<string,mixed>|null */
    public function route(string $path, ?string $releaseId = null): ?array
    {
        global $wpdb;
        $releaseId ??= (string) get_option('pagecraft_active_release_id', '');
        if ($releaseId === '') {
            return null;
        }
        $table = $wpdb->prefix . 'pagecraft_routes';
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table} WHERE release_id = %s AND route_path = %s",
            $releaseId,
            Support::normalizeRoute($path)
        ), ARRAY_A);
        return is_array($row) ? $this->normalizeRouteRow($row) : null;
    }

    /** @return array<string,mixed>|null */
    public function routeForPost(int $postId, ?string $releaseId = null): ?array
    {
        global $wpdb;
        $releaseId ??= (string) get_option('pagecraft_active_release_id', '');
        if ($releaseId === '' || $postId < 1) {
            return null;
        }
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pagecraft_routes WHERE release_id = %s AND post_id = %d LIMIT 1",
            $releaseId,
            $postId
        ), ARRAY_A);
        return is_array($row) ? $this->normalizeRouteRow($row) : null;
    }

    /** @return list<string> */
    public function routePaths(string $deploymentId): array
    {
        global $wpdb;
        if (!Support::validIdentifier($deploymentId, 160)) {
            return [];
        }
        $paths = $wpdb->get_col($wpdb->prepare(
            "SELECT route_path FROM {$wpdb->prefix}pagecraft_routes WHERE release_id = %s ORDER BY route_path ASC",
            $deploymentId
        ));
        return array_values(array_filter(array_map(
            static fn ($path): string => is_string($path) ? Support::normalizeRoute($path) : '',
            (array) $paths
        ), static fn (string $path): bool => $path !== ''));
    }

    /** @return true|\WP_Error */
    public function retain(
        int $count = 5,
        ?\Closure $fenceGuard = null,
        string $connectionId = '',
        string $siteId = ''
    ): bool|\WP_Error
    {
        global $wpdb;
        try {
            $this->assertFence($fenceGuard);
        } catch (\Throwable $error) {
            return new \WP_Error('pagecraft_retention_fenced', $error->getMessage());
        }
        $count = max(5, $count);
        $table = $wpdb->prefix . 'pagecraft_releases';
        if (!Support::validIdentifier($connectionId, 96) || !Support::validIdentifier($siteId, 96)) {
            return new \WP_Error('pagecraft_retention_binding', 'A valid Pagecraft connection and site binding is required for rollback retention.');
        }
        $storage = $this->transactionalStorage();
        if (is_wp_error($storage)) {
            return $storage;
        }
        // The rollback set is five verified releases. Unverified candidates
        // remain available, but can never displace a verified rollback point.
        $verified = $wpdb->get_col($wpdb->prepare(
            "SELECT deployment_id FROM {$table} WHERE connection_id = %s AND site_id = %s AND verified_at IS NOT NULL AND status IN ('active','retained') ORDER BY sequence_no DESC LIMIT %d",
            $connectionId,
            $siteId,
            $count
        ));
        $pending = $wpdb->get_col("SELECT deployment_id FROM {$table} WHERE status IN ('staged','installed','needs_approval')");
        $pinned = $wpdb->get_col("SELECT deployment_id FROM {$table} WHERE pinned = 1");
        $recoveryPointers = $wpdb->get_col(
            "SELECT previous_deployment_id FROM {$table} WHERE status = 'active' AND verified_at IS NULL AND previous_deployment_id IS NOT NULL"
        );
        $activePointer = (string) get_option('pagecraft_active_release_id', '');
        $pendingAcknowledgements = get_option('pagecraft_pending_live_acknowledgements', []);
        $pendingTerminalAcknowledgements = get_option(Connection::PENDING_TERMINAL_ACKS_OPTION, []);
        $keep = array_values(array_unique(array_merge(
            array_filter($verified, 'is_string'),
            array_filter($pending, 'is_string'),
            array_filter($pinned, 'is_string'),
            array_filter($recoveryPointers, 'is_string'),
            $activePointer !== '' ? [$activePointer] : [],
            is_array($pendingAcknowledgements) ? array_filter(array_keys($pendingAcknowledgements), 'is_string') : [],
            is_array($pendingTerminalAcknowledgements) ? array_filter(array_keys($pendingTerminalAcknowledgements), 'is_string') : [],
            is_array($pendingTerminalAcknowledgements) ? array_values(array_filter(array_map(
                static fn (mixed $record): string => is_array($record) ? (string) ($record['expected_active_deployment_id'] ?? '') : '',
                $pendingTerminalAcknowledgements
            ), static fn (string $id): bool => $id !== '')) : []
        )));
        $all = $wpdb->get_col("SELECT deployment_id FROM {$table}");
        foreach ($all as $deploymentId) {
            if (!is_string($deploymentId) || in_array($deploymentId, $keep, true)) {
                continue;
            }
            try {
                $this->assertFence($fenceGuard);
            } catch (\Throwable $error) {
                return new \WP_Error('pagecraft_retention_fenced', $error->getMessage());
            }
            if ($wpdb->query('START TRANSACTION') === false) {
                return new \WP_Error('pagecraft_retention_transaction', 'WordPress could not start the atomic release-retention transaction.');
            }
            $objectIds = [];
            try {
                $this->assertFence($fenceGuard);
                $locked = $wpdb->get_row($wpdb->prepare(
                    "SELECT deployment_id,pinned FROM {$table} WHERE deployment_id = %s LIMIT 1 FOR UPDATE",
                    $deploymentId
                ), ARRAY_A);
                if (!is_array($locked)) {
                    if ($wpdb->query('ROLLBACK') === false) {
                        throw new RuntimeException('WordPress could not roll back a missing retention candidate.');
                    }
                    continue;
                }
                if (!empty($locked['pinned'])) {
                    if ($wpdb->query('ROLLBACK') === false) {
                        throw new RuntimeException('WordPress could not roll back a newly pinned retention candidate.');
                    }
                    continue;
                }
                $objectIds = $wpdb->get_col($wpdb->prepare(
                    "SELECT object_id FROM {$wpdb->prefix}pagecraft_objects WHERE deployment_id = %s",
                    $deploymentId
                ));
                foreach ([
                    [$wpdb->prefix . 'pagecraft_routes', ['release_id' => $deploymentId], ['%s']],
                    [$wpdb->prefix . 'pagecraft_redirects', ['release_id' => $deploymentId], ['%s']],
                    [$wpdb->prefix . 'pagecraft_objects', ['deployment_id' => $deploymentId], ['%s']],
                ] as [$deleteTable, $where, $format]) {
                    $this->assertFence($fenceGuard);
                    if ($wpdb->delete($deleteTable, $where, $format) === false) {
                        throw new RuntimeException(sprintf('WordPress could not delete retained data from %s.', $deleteTable));
                    }
                }
                $this->assertFence($fenceGuard);
                if ($wpdb->delete($table, ['deployment_id' => $deploymentId], ['%s']) !== 1) {
                    throw new RuntimeException('WordPress could not delete exactly one retained release row.');
                }
                if ($wpdb->query('COMMIT') === false) {
                    throw new RuntimeException('WordPress could not commit the atomic release-retention transaction.');
                }
            } catch (\Throwable $error) {
                $wpdb->query('ROLLBACK');
                return new \WP_Error(
                    'pagecraft_retention_transaction',
                    'Release retention was rolled back without deleting the rollback candidate: ' . $error->getMessage()
                );
            }
            foreach (array_unique(array_map('intval', (array) $objectIds)) as $postId) {
                if ($postId < 1) {
                    continue;
                }
                $referenceCount = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}pagecraft_objects WHERE object_id = %d",
                    $postId
                ));
                if (!is_numeric($referenceCount)) {
                    return new \WP_Error(
                        'pagecraft_retention_reference_check',
                        sprintf('Release retention could not safely confirm whether managed WordPress object %d is still referenced.', $postId)
                    );
                }
                $references = (int) $referenceCount;
                if ($references === 0 && get_post_meta($postId, '_pagecraft_managed', true) === '1') {
                    $deleted = $this->deleteManagedObject($postId);
                    if (is_wp_error($deleted)) {
                        return $deleted;
                    }
                }
            }
        }
        return true;
    }

    /** @return true|\WP_Error */
    private function deleteManagedObject(int $postId): bool|\WP_Error
    {
        $kind = get_post_type($postId) === 'attachment' ? 'attachment' : 'post';
        self::$managedObjectDeletionScopes[] = ['object_id' => $postId, 'kind' => $kind];
        try {
            $deleted = $kind === 'attachment'
                ? wp_delete_attachment($postId, true)
                : wp_delete_post($postId, true);
        } finally {
            array_pop(self::$managedObjectDeletionScopes);
        }
        return $deleted instanceof \WP_Post
            ? true
            : new \WP_Error('pagecraft_retention_object_cleanup', sprintf('Release retention could not remove unreferenced managed WordPress object %d.', $postId));
    }

    /** @return true|\WP_Error */
    private function transactionalStorage(): bool|\WP_Error
    {
        global $wpdb;
        foreach ([
            $wpdb->posts,
            $wpdb->options,
            $wpdb->prefix . 'pagecraft_releases',
            $wpdb->prefix . 'pagecraft_routes',
            $wpdb->prefix . 'pagecraft_redirects',
            $wpdb->prefix . 'pagecraft_objects',
        ] as $table) {
            $row = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS LIKE %s', $wpdb->esc_like($table)), ARRAY_A);
            $engine = is_array($row) ? strtoupper((string) ($row['Engine'] ?? '')) : '';
            if ($engine !== 'INNODB') {
                return new \WP_Error(
                    'pagecraft_non_transactional_storage',
                    sprintf('Atomic activation requires InnoDB; %s uses %s.', $table, $engine !== '' ? $engine : 'an unknown engine')
                );
            }
        }
        return true;
    }

    private function activationCheckpoint(string $step, string $deploymentId, string $previousId): void
    {
        do_action('pagecraft_connector_activation_step', $step, $deploymentId, $previousId);
        $failure = apply_filters('pagecraft_connector_activation_failure', false, $step, $deploymentId, $previousId);
        if (is_wp_error($failure)) {
            throw new RuntimeException($failure->get_error_message());
        }
        if ($failure === true) {
            throw new RuntimeException(sprintf('Activation failure injected after %s.', $step));
        }
    }

    private function assertFence(?\Closure $fenceGuard): void
    {
        if ($fenceGuard === null) {
            return;
        }
        $result = $fenceGuard();
        if (is_wp_error($result)) {
            throw new RuntimeException($result->get_error_message());
        }
        if ($result !== true) {
            throw new RuntimeException('The Pagecraft deployment fence rejected this mutation.');
        }
    }

    public function etag(): string
    {
        return (string) get_option('pagecraft_release_etag', '');
    }

    public function setEtag(string $etag): void
    {
        update_option('pagecraft_release_etag', sanitize_text_field($etag), false);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function normalize(array $row): array
    {
        try {
            $manifest = Support::decodeObject((string) ($row['manifest'] ?? '{}'));
        } catch (RuntimeException) {
            $manifest = [];
        }
        $connectionId = (string) ($row['connection_id'] ?? '');
        $siteId = (string) ($row['site_id'] ?? '');
        if ($connectionId === '') {
            $connectionId = (string) ($manifest['connectionId'] ?? '');
        }
        if ($siteId === '') {
            $siteId = (string) ($manifest['siteId'] ?? '');
        }
        return [
            'id' => (int) ($row['id'] ?? 0),
            'deployment_id' => (string) ($row['deployment_id'] ?? ''),
            'release_id' => (string) ($row['release_id'] ?? ''),
            'connection_id' => $connectionId,
            'site_id' => $siteId,
            'sequence' => (int) ($row['sequence_no'] ?? 0),
            'source_version' => (int) ($row['source_version'] ?? 0),
            'status' => (string) ($row['status'] ?? ''),
            'manifest' => $manifest,
            'manifest_hash' => (string) ($row['manifest_hash'] ?? ''),
            'deployment_hash' => (string) ($row['deployment_hash'] ?? ''),
            'artifact_hash' => (string) ($row['artifact_hash'] ?? ''),
            'parent_release_id' => $row['parent_release_id'] ?? null,
            'created_at' => (string) ($row['created_at'] ?? ''),
            'installed_at' => $row['installed_at'] ?? null,
            'activated_at' => $row['activated_at'] ?? null,
            'verified_at' => $row['verified_at'] ?? null,
            'previous_deployment_id' => $row['previous_deployment_id'] ?? null,
            'pinned' => (bool) ($row['pinned'] ?? false),
            'error_code' => $row['error_code'] ?? null,
            'error_message' => $row['error_message'] ?? null,
        ];
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function normalizeRouteRow(array $row): array
    {
        foreach (['seo_json' => 'seo', 'scripts_json' => 'scripts'] as $source => $target) {
            try {
                $row[$target] = Support::decodeObject((string) ($row[$source] ?: '{}'));
            } catch (RuntimeException) {
                $row[$target] = [];
            }
            unset($row[$source]);
        }
        $row['id'] = (int) $row['id'];
        $row['post_id'] = $row['post_id'] !== null ? (int) $row['post_id'] : null;
        return $row;
    }

    private function mysqlDate(string $value): string
    {
        $time = strtotime($value);
        return $time ? gmdate('Y-m-d H:i:s', $time) : Support::utcNow();
    }
}
