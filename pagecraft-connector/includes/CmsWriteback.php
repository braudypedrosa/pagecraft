<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class CmsWriteback
{
    private readonly \Closure $writer;
    private readonly \Closure $assetChoiceProvider;
    private readonly \Closure $assetUploader;
    private readonly DeploymentLock $lifecycleLock;

    public function __construct(
        private readonly Connection $connection,
        private readonly HttpClient $http,
        private readonly ReleaseRepository $releases,
        ?\Closure $writer = null,
        ?\Closure $assetChoiceProvider = null,
        ?\Closure $assetUploader = null,
        ?DeploymentLock $lifecycleLock = null
    ) {
        $this->writer = $writer ?? fn (string $sourceId, array $payload, int $sequence, string $key, array $lifecycle): array|\WP_Error => $this->http->writeCmsDraft($sourceId, $payload, $sequence, $key, $lifecycle);
        $this->assetChoiceProvider = $assetChoiceProvider ?? fn (): array => $this->activeImageChoices();
        $this->assetUploader = $assetUploader ?? fn (string $filename, string $mime, string $bytes, string $hash, string $key, array $lifecycle): array|\WP_Error => $this->http->uploadCmsAsset($filename, $mime, $bytes, $hash, $key, $lifecycle);
        $this->lifecycleLock = $lifecycleLock ?? new DeploymentLock();
    }

    public function hooks(): void
    {
        add_filter('wp_insert_post_data', [$this, 'protectActiveFields'], 8, 4);
        add_filter('update_post_metadata', [$this, 'protectActiveMeta'], 10, 5);
        add_filter('add_post_metadata', [$this, 'protectActiveMeta'], 10, 5);
        add_filter('delete_post_metadata', [$this, 'protectActiveMeta'], 10, 5);
        add_filter('rest_pre_insert_pagecraft_entry', [$this, 'rejectRestMutation'], 10, 2);
        add_filter('pre_trash_post', [$this, 'preventDeletion'], 10, 2);
        add_filter('pre_delete_post', [$this, 'preventDeletion'], 10, 2);
        add_filter('post_row_actions', [$this, 'rowActions'], 10, 2);
        add_filter('bulk_actions-edit-pagecraft_entry', [$this, 'bulkActions']);
        add_filter('admin_body_class', [$this, 'adminBodyClass']);
        add_filter('block_editor_settings_all', [$this, 'lockReadOnlyEditor'], 10, 2);
        add_action('save_post_pagecraft_entry', [$this, 'queuePrivateSnapshot'], 20, 3);
        add_action('add_meta_boxes_pagecraft_entry', [$this, 'addMetaBox']);
        add_filter('manage_pagecraft_entry_posts_columns', [$this, 'columns']);
        add_action('manage_pagecraft_entry_posts_custom_column', [$this, 'column'], 10, 2);
        add_action('pagecraft_release_activated', [$this, 'resolveForActivation']);
        add_action('admin_enqueue_scripts', [$this, 'editorAssets']);
    }

    public function editorAssets(): void
    {
        if (!function_exists('get_current_screen')) {
            return;
        }
        $screen = get_current_screen();
        if (!$screen || ($screen->post_type ?? '') !== 'pagecraft_entry') {
            return;
        }
        $postId = $this->currentPostId();
        if ($postId < 1 || !$this->managed($postId)) {
            return;
        }
        $readOnly = !$this->eligible($postId);
        if (!$readOnly) {
            wp_enqueue_media();
        }
        wp_enqueue_style('pagecraft-cms-editor', PAGECRAFT_CONNECTOR_URL . 'assets/cms-editor.css', [], PAGECRAFT_CONNECTOR_VERSION);
        wp_enqueue_script('pagecraft-cms-editor', PAGECRAFT_CONNECTOR_URL . 'assets/cms-editor.js', ['jquery', 'wp-data', 'wp-dom-ready', 'wp-notices'], PAGECRAFT_CONNECTOR_VERSION, true);
        wp_localize_script('pagecraft-cms-editor', 'pagecraftCmsEditor', [
            'readOnly' => $readOnly,
            'notice' => $this->readOnlyMessage(),
            'saveLabel' => __('Save to Pagecraft draft', 'pagecraft-connector'),
            'saveAriaLabel' => __('Save CMS values to the Pagecraft draft', 'pagecraft-connector'),
        ]);
    }

    /** @param array<string,mixed> $data @param array<string,mixed> $postarr @param array<string,mixed> $unsanitized @return array<string,mixed> */
    public function protectActiveFields(array $data, array $postarr, array $unsanitized, bool $update): array
    {
        if (!$update || Mapper::isApplying()) {
            return $data;
        }
        $postId = (int) ($postarr['ID'] ?? 0);
        if ($postId < 1 || get_post_type($postId) !== 'pagecraft_entry' || get_post_meta($postId, '_pagecraft_managed', true) !== '1') {
            return $data;
        }
        $active = get_post($postId, ARRAY_A);
        if (!is_array($active)) {
            return $data;
        }
        foreach (['post_title', 'post_name', 'post_content', 'post_excerpt', 'post_status', 'post_parent', 'menu_order', 'post_date', 'post_date_gmt', 'comment_status', 'ping_status', 'post_password'] as $field) {
            $data[$field] = $active[$field];
        }
        return $data;
    }

    public function protectActiveMeta(mixed $check, int $objectId, string $metaKey, mixed $metaValue, mixed $previous): mixed
    {
        if (Mapper::isApplying()
            || get_post_type($objectId) !== 'pagecraft_entry'
            || !$this->managed($objectId)
            || in_array($metaKey, ['_edit_lock', '_edit_last'], true)) {
            return $check;
        }
        return true;
    }

    public function rejectRestMutation(mixed $preparedPost, \WP_REST_Request $request): mixed
    {
        $postId = absint($request['id'] ?? 0);
        if ($postId > 0 && $this->managed($postId) && !Mapper::isApplying()) {
            return new \WP_Error('pagecraft_cms_native_read_only', 'This CMS record is managed by Pagecraft. Use the signed CMS field editor in WordPress production or edit it in Pagecraft.', ['status' => 403]);
        }
        return $preparedPost;
    }

    public function preventDeletion(mixed $delete, \WP_Post $post): mixed
    {
        return !Mapper::isApplying()
            && !ReleaseRepository::isDeletingManagedObject($post->ID, 'post')
            && get_post_type($post->ID) === 'pagecraft_entry'
            && $this->managed($post->ID)
            ? false
            : $delete;
    }

    /** @param array<string,string> $actions @return array<string,string> */
    public function rowActions(array $actions, \WP_Post $post): array
    {
        if (get_post_type($post->ID) !== 'pagecraft_entry' || !$this->managed($post->ID)) {
            return $actions;
        }
        unset($actions['inline hide-if-no-js'], $actions['trash']);
        return $actions;
    }

    /** @param array<string,string> $actions @return array<string,string> */
    public function bulkActions(array $actions): array
    {
        unset($actions['trash'], $actions['delete']);
        return $actions;
    }

    /** @param array<string,mixed> $settings @return array<string,mixed> */
    public function lockReadOnlyEditor(array $settings, \WP_Block_Editor_Context $context): array
    {
        $post = $context->post;
        if (!$post instanceof \WP_Post || get_post_type($post->ID) !== 'pagecraft_entry' || !$this->managed($post->ID) || $this->eligible($post->ID)) {
            return $settings;
        }
        $settings['templateLock'] = 'all';
        $settings['canLockBlocks'] = false;
        $settings['codeEditingEnabled'] = false;
        $settings['pagecraftCmsReadOnly'] = true;
        return $settings;
    }

    public function adminBodyClass(string $classes): string
    {
        $postId = $this->currentPostId();
        if ($postId < 1 || !$this->managed($postId)) {
            return $classes;
        }
        return trim($classes . ' pagecraft-cms-managed' . ($this->eligible($postId) ? '' : ' pagecraft-cms-read-only'));
    }

    public function queuePrivateSnapshot(int $postId, \WP_Post $post, bool $update): void
    {
        if (!$update || Mapper::isApplying() || wp_is_post_revision($postId) || wp_is_post_autosave($postId) || !$this->eligible($postId)) {
            return;
        }
        if (!isset($_POST['pagecraft_cms_nonce'])
            || !wp_verify_nonce(sanitize_text_field((string) wp_unslash($_POST['pagecraft_cms_nonce'])), 'pagecraft_cms_draft_' . $postId)
            || !current_user_can('edit_post', $postId)) {
            return;
        }
        $schema = $this->schema($postId);
        $rawValues = isset($_POST['pagecraft_pending_fields']) ? wp_unslash($_POST['pagecraft_pending_fields']) : [];
        $values = $this->sanitizeTypedValues($rawValues, $schema);
        if (is_wp_error($values)) {
            set_transient('pagecraft_notice_' . get_current_user_id(), [
                'type' => 'error',
                'message' => $values->get_error_message(),
            ], MINUTE_IN_SECONDS);
            return;
        }
        $media = $this->capturePendingMedia($values, true);
        if (is_wp_error($media)) {
            set_transient('pagecraft_notice_' . get_current_user_id(), [
                'type' => 'error',
                'message' => $media->get_error_message(),
            ], MINUTE_IN_SECONDS);
            return;
        }
        $active = get_post($postId);
        $payload = [
            'itemId' => (string) get_post_meta($postId, '_pagecraft_item_id', true),
            'collectionId' => (string) get_post_meta($postId, '_pagecraft_collection_id', true),
            'baseReleaseId' => (string) ($this->releases->active()['release_id'] ?? ''),
            'baseVersion' => (int) ($this->releases->active()['source_version'] ?? 0),
            // These are private display projections only. HttpClient sends only
            // the signed field IDs in values; item slug is structural in v1.
            'title' => sanitize_text_field((string) ($values['title'] ?? ($active instanceof \WP_Post ? $active->post_title : ''))),
            'slug' => $active instanceof \WP_Post ? $active->post_name : '',
            'body' => wp_kses_post((string) ($values['body'] ?? ($active instanceof \WP_Post ? $active->post_content : ''))),
            'excerpt' => sanitize_textarea_field((string) ($values['excerpt'] ?? ($active instanceof \WP_Post ? $active->post_excerpt : ''))),
            'values' => $values,
            'media' => $media,
        ];
        global $wpdb;
        $now = Support::utcNow();
        $table = $wpdb->prefix . 'pagecraft_cms_drafts';
        $inserted = $wpdb->insert($table, [
            'connection_id' => $this->connection->connectionId(),
            'source_id' => $payload['itemId'],
            'post_id' => $postId,
            'base_release_id' => $payload['baseReleaseId'],
            'payload' => Support::json($payload),
            'status' => 'queued',
            'attempts' => 0,
            'available_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
            'error_message' => null,
        ], ['%s', '%s', '%d', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s']);
        if ($inserted === false) {
            set_transient('pagecraft_notice_' . get_current_user_id(), [
                'type' => 'error',
                'message' => 'The private Pagecraft CMS draft could not be saved. The previously queued draft remains available and was not superseded.',
            ], MINUTE_IN_SECONDS);
            return;
        }
        $newRowId = (int) $wpdb->insert_id;
        if ($newRowId < 1) {
            // The new row exists but cannot safely fence older rows without its
            // monotonic ID. Keep every queue entry deliverable and surface the
            // persistence anomaly rather than risking draft loss.
            set_transient('pagecraft_notice_' . get_current_user_id(), [
                'type' => 'error',
                'message' => 'The private Pagecraft CMS draft was saved, but its queue position could not be verified. Earlier drafts were preserved.',
            ], MINUTE_IN_SECONDS);
        } else {
            $superseded = $wpdb->query($wpdb->prepare(
                "UPDATE {$table} SET status = 'superseded', updated_at = %s, error_message = 'Replaced by a newer private WordPress draft.' WHERE connection_id = %s AND source_id = %s AND status = 'queued' AND id < %d",
                $now,
                $this->connection->connectionId(),
                (string) $payload['itemId'],
                $newRowId
            ));
            if ($superseded === false) {
                // Both rows remaining queued is safe: process() permanently
                // supersedes any lower ID as soon as it observes this accepted
                // newer save. Report the DB anomaly without dropping either.
                set_transient('pagecraft_notice_' . get_current_user_id(), [
                    'type' => 'error',
                    'message' => 'The new private Pagecraft CMS draft was saved, but earlier queue rows could not be marked superseded yet. No draft data was discarded.',
                ], MINUTE_IN_SECONDS);
            }
        }
        if (!wp_next_scheduled(Cron::CMS_DRAFT_HOOK)) {
            wp_schedule_single_event(time() + 5, Cron::CMS_DRAFT_HOOK);
        }
    }

    public function process(): void
    {
        $lease = $this->lifecycleLock->acquire('cms-writeback');
        if (is_wp_error($lease)) {
            return;
        }
        try {
            $this->processOwned($lease);
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @param array{token:string,fence:int,purpose:string,expires:int} $lease */
    private function processOwned(array &$lease): void
    {
        if (!$this->connection->isConfigured() || $this->connection->mode() !== 'connected' || !$this->production()) {
            return;
        }
        if (is_wp_error($this->connection->bindingValid())) {
            return;
        }
        if (!$this->activeReleaseBelongsToConnection()) {
            return;
        }
        $lifecycle = $this->connection->lifecycleSnapshot();
        if (is_wp_error($lifecycle)) {
            return;
        }
        global $wpdb;
        $table = $wpdb->prefix . 'pagecraft_cms_drafts';
        $connectionId = $this->connection->connectionId();
        $wpdb->query($wpdb->prepare(
            "UPDATE {$table} SET status = 'queued', available_at = %s, updated_at = %s, error_message = 'Recovered an expired processing lease.' WHERE connection_id = %s AND status = 'processing' AND updated_at < %s",
            Support::utcNow(),
            Support::utcNow(),
            $connectionId,
            gmdate('Y-m-d H:i:s', time() - 10 * MINUTE_IN_SECONDS)
        ));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$table} WHERE connection_id = %s AND status = 'queued' AND available_at <= %s ORDER BY id ASC LIMIT 10",
            $connectionId,
            Support::utcNow()
        ), ARRAY_A);
        foreach ((array) $rows as $row) {
            $id = (int) $row['id'];
            $claimed = $wpdb->update(
                $table,
                ['status' => 'processing', 'updated_at' => Support::utcNow()],
                ['id' => $id, 'status' => 'queued'],
                ['%s', '%s'],
                ['%d', '%s']
            );
            if ($claimed !== 1) {
                continue;
            }
            if ($this->newerDraftId($connectionId, (string) $row['source_id'], $id, $table) > 0) {
                $this->supersede($table, $id, 'A newer private WordPress draft was queued before this write began.');
                continue;
            }
            try {
                $payload = Support::decodeObject((string) $row['payload']);
            } catch (\RuntimeException $error) {
                $wpdb->update($table, ['status' => 'failed', 'error_message' => $error->getMessage(), 'updated_at' => Support::utcNow()], ['id' => $id]);
                continue;
            }
            if (!$this->activeCmsMapping(
                (int) ($row['post_id'] ?? 0),
                (string) ($row['source_id'] ?? ''),
                (string) ($payload['collectionId'] ?? '')
            )) {
                $wpdb->update($table, [
                    'status' => 'failed',
                    'updated_at' => Support::utcNow(),
                    'error_message' => 'The item is no longer an active CMS mapping in this exact Pagecraft deployment.',
                ], ['id' => $id, 'status' => 'processing']);
                continue;
            }
            $resolved = $this->resolvePendingMedia(
                $payload,
                $id,
                (string) $row['source_id'],
                $lifecycle,
                fn (): bool|\WP_Error => $this->renewLifecycleLease($lease)
            );
            if (is_wp_error($resolved)) {
                $attempts = (int) $row['attempts'] + 1;
                $terminal = in_array($resolved->get_error_code(), [
                    'pagecraft_cms_media_missing',
                    'pagecraft_cms_media_changed',
                    'pagecraft_cms_media_invalid',
                    'pagecraft_svg_active_element',
                    'pagecraft_svg_event',
                    'pagecraft_svg_href',
                    'pagecraft_svg_url',
                    'pagecraft_svg_uri',
                    'pagecraft_svg_css',
                    'pagecraft_svg_xml',
                    'pagecraft_connection_lifecycle_changed',
                ], true);
                $wpdb->update($table, [
                    'status' => $terminal || $attempts >= 5 ? 'failed' : 'queued',
                    'attempts' => $attempts,
                    'available_at' => gmdate('Y-m-d H:i:s', time() + min(HOUR_IN_SECONDS, 30 * (2 ** $attempts))),
                    'updated_at' => Support::utcNow(),
                    'error_message' => $resolved->get_error_message(),
                ], ['id' => $id]);
                continue;
            }
            if ($resolved !== $payload) {
                $persisted = $wpdb->update($table, [
                    'payload' => Support::json($resolved),
                    'updated_at' => Support::utcNow(),
                ], ['id' => $id, 'status' => 'processing'], ['%s', '%s'], ['%d', '%s']);
                if ($persisted !== 1) {
                    continue;
                }
                $payload = $resolved;
            }
            $newerBeforeWrite = $this->newerDraftId($connectionId, (string) $row['source_id'], $id, $table);
            if ($newerBeforeWrite > 0) {
                $this->supersede($table, $id, sprintf('CMS media resolved, then superseded by newer local draft row %d.', $newerBeforeWrite));
                continue;
            }
            if (!$this->activeCmsMapping(
                (int) ($row['post_id'] ?? 0),
                (string) ($row['source_id'] ?? ''),
                (string) ($payload['collectionId'] ?? '')
            )) {
                $wpdb->update($table, [
                    'status' => 'failed',
                    'updated_at' => Support::utcNow(),
                    'error_message' => 'The active Pagecraft deployment changed before this CMS draft could be sent.',
                ], ['id' => $id, 'status' => 'processing']);
                continue;
            }
            $currentLifecycle = $this->connection->assertLifecycleSnapshot($lifecycle);
            if (is_wp_error($currentLifecycle)) {
                $wpdb->update($table, [
                    'status' => 'failed',
                    'updated_at' => Support::utcNow(),
                    'error_message' => $currentLifecycle->get_error_message(),
                ], ['id' => $id, 'status' => 'processing']);
                continue;
            }
            $leaseOwned = $this->renewLifecycleLease($lease);
            if (is_wp_error($leaseOwned)) {
                $wpdb->update($table, [
                    'status' => 'queued',
                    'available_at' => gmdate('Y-m-d H:i:s', time() + MINUTE_IN_SECONDS),
                    'updated_at' => Support::utcNow(),
                    'error_message' => $leaseOwned->get_error_message(),
                ], ['id' => $id, 'status' => 'processing']);
                continue;
            }
            $idempotencyKey = $this->idempotencyKey((string) $row['source_id'], $id, (string) $lifecycle['connection_id']);
            $result = ($this->writer)((string) $row['source_id'], $payload, $id, $idempotencyKey, $lifecycle);
            $newerId = $this->newerDraftId($connectionId, (string) $row['source_id'], $id, $table);
            if (is_wp_error($result)) {
                if ($newerId > 0) {
                    $this->supersede($table, $id, sprintf('Superseded by local draft row %d while this write was processing.', $newerId));
                    continue;
                }
                $attempts = (int) $row['attempts'] + 1;
                $terminal = in_array($result->get_error_code(), ['pagecraft_stale-write', 'pagecraft_write-sequence-conflict'], true);
                $wpdb->update($table, [
                    'status' => $terminal || $attempts >= 5 ? 'failed' : 'queued',
                    'attempts' => $attempts,
                    'available_at' => gmdate('Y-m-d H:i:s', time() + min(HOUR_IN_SECONDS, 30 * (2 ** $attempts))),
                    'updated_at' => Support::utcNow(),
                    'error_message' => $result->get_error_message(),
                ], ['id' => $id]);
                continue;
            }
            if ($newerId > 0) {
                $this->supersede($table, $id, sprintf('Sent, then superseded by newer local draft row %d.', $newerId));
                continue;
            }
            $wpdb->update($table, ['status' => 'sent', 'updated_at' => Support::utcNow(), 'error_message' => null], ['id' => $id]);
        }
    }

    public function addMetaBox(\WP_Post $post): void
    {
        add_meta_box('pagecraft-cms-writeback', __('Pending Pagecraft publish', 'pagecraft-connector'), [$this, 'renderMetaBox'], 'pagecraft_entry', 'normal', 'high');
        if (!$this->managed($post->ID)) {
            return;
        }
        remove_meta_box('tagsdiv-pagecraft_collection', 'pagecraft_entry', 'side');
        remove_meta_box('pagecraft_collectiondiv', 'pagecraft_entry', 'side');
        if (!$this->eligible($post->ID)) {
            remove_meta_box('submitdiv', 'pagecraft_entry', 'side');
        }
    }

    public function renderMetaBox(\WP_Post $post): void
    {
        $editable = $this->eligible($post->ID);
        $pending = $this->latestPending($post->ID);
        $activeValues = get_post_meta($post->ID, 'pagecraft_fields', true);
        $values = $pending['values'] ?? (is_array($activeValues) ? $activeValues : []);
        $schema = $this->schema($post->ID);
        if ($editable) {
            wp_nonce_field('pagecraft_cms_draft_' . $post->ID, 'pagecraft_cms_nonce');
            if ($pending !== null) {
                echo '<div class="notice notice-info inline"><p>' . esc_html__('These private values are pending in Pagecraft. Public/native fields remain on the active release until Pagecraft publishes them.', 'pagecraft-connector') . '</p></div>';
            } else {
                echo '<p>' . esc_html__('Changes here are sent only to the Pagecraft draft. They cannot publish directly from WordPress.', 'pagecraft-connector') . '</p>';
            }
        } else {
            echo '<div class="notice notice-info inline"><p><strong>' . esc_html($this->readOnlyMessage()) . '</strong></p></div>';
        }
        if ($schema === []) {
            echo '<p><strong>' . esc_html__('Typed editing is unavailable because this item has no valid signed collection schema. Publish a new Pagecraft release before editing.', 'pagecraft-connector') . '</strong></p>';
        } else {
            echo '<fieldset class="pagecraft-cms-fields"' . ($editable ? '' : ' disabled aria-disabled="true"') . '>';
            $this->renderTypedFields($schema, is_array($values) ? $values : [], !$editable);
            echo '</fieldset><p class="description">' . esc_html(__($editable
                ? 'The item slug is structural in Connected v1 and remains read-only. Image changes remain private until the Pagecraft draft is published in a signed release.'
                : 'These values are a read-only view of the active signed release.', 'pagecraft-connector')) . '</p>';
        }
    }

    /** @param array<string,string> $columns @return array<string,string> */
    public function columns(array $columns): array
    {
        $columns['pagecraft_pending'] = __('Pagecraft state', 'pagecraft-connector');
        return $columns;
    }

    public function column(string $column, int $postId): void
    {
        if ($column === 'pagecraft_pending') {
            echo $this->latestPending($postId) !== null
                ? esc_html__('Pending Pagecraft publish', 'pagecraft-connector')
                : esc_html__('Active release', 'pagecraft-connector');
        }
    }

    public function resolveForActivation(string $deploymentId): void
    {
        $active = $this->releases->active();
        if (!is_array($active)
            || !hash_equals($deploymentId, (string) ($active['deployment_id'] ?? ''))
            || !$this->activeReleaseBelongsToConnection($active)) {
            return;
        }
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT source_id,object_id FROM {$wpdb->prefix}pagecraft_objects WHERE deployment_id = %s AND source_type = 'cms' AND state = 'active'",
            $deploymentId
        ), ARRAY_A);
        foreach ((array) $rows as $row) {
            $post = get_post((int) ($row['object_id'] ?? 0));
            if (!$post instanceof \WP_Post) {
                continue;
            }
            $values = get_post_meta($post->ID, 'pagecraft_fields', true);
            $active = $this->normalizePayload([
                'itemId' => (string) $row['source_id'],
                'collectionId' => (string) get_post_meta($post->ID, '_pagecraft_collection_id', true),
                'title' => $post->post_title,
                'slug' => $post->post_name,
                'body' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'values' => is_array($values) ? $values : [],
            ]);
            $drafts = $wpdb->get_results($wpdb->prepare(
                "SELECT id,payload FROM {$wpdb->prefix}pagecraft_cms_drafts WHERE connection_id = %s AND source_id = %s AND status IN ('queued','sent','failed') ORDER BY id DESC",
                $this->connection->connectionId(),
                (string) $row['source_id']
            ), ARRAY_A);
            foreach ((array) $drafts as $draft) {
                try {
                    $pending = Support::decodeObject((string) $draft['payload']);
                } catch (\RuntimeException) {
                    continue;
                }
                unset($pending['baseReleaseId'], $pending['baseVersion']);
                if (hash_equals(hash('sha256', CanonicalJson::encode(json_decode(Support::json($this->normalizePayload($pending))))), hash('sha256', CanonicalJson::encode(json_decode(Support::json($active)))))) {
                    $wpdb->update($wpdb->prefix . 'pagecraft_cms_drafts', ['status' => 'resolved', 'updated_at' => Support::utcNow(), 'error_message' => null], ['id' => (int) $draft['id']]);
                }
            }
        }
    }

    /** @return array<string,mixed>|null */
    private function latestPending(int $postId): ?array
    {
        global $wpdb;
        $sourceId = (string) get_post_meta($postId, '_pagecraft_item_id', true);
        if ($sourceId === '') {
            return null;
        }
        $payload = $wpdb->get_var($wpdb->prepare(
            "SELECT payload FROM {$wpdb->prefix}pagecraft_cms_drafts WHERE connection_id = %s AND source_id = %s AND status IN ('queued','sent','failed') ORDER BY id DESC LIMIT 1",
            $this->connection->connectionId(),
            $sourceId
        ));
        if (!is_string($payload) || $payload === '') {
            return null;
        }
        try {
            return Support::decodeObject($payload);
        } catch (\RuntimeException) {
            return null;
        }
    }

    /** @return array<string,mixed> */
    private function schema(int $postId): array
    {
        $schema = get_post_meta($postId, '_pagecraft_collection_schema', true);
        if (!is_array($schema)
            || ($schema['format'] ?? '') !== 'pagecraft.collection-schema.v1'
            || !is_array($schema['fields'] ?? null)) {
            return [];
        }
        foreach ($schema['fields'] as $field) {
            if (!is_array($field)
                || !Support::validIdentifier((string) ($field['id'] ?? ''), 64)
                || !in_array((string) ($field['type'] ?? ''), ['text', 'rich', 'image', 'link', 'number', 'date', 'option', 'bool', 'ref'], true)
                || !is_array($field['choices'] ?? null)) {
                return [];
            }
        }
        return $schema;
    }

    /** @param array<string,mixed> $schema @param array<string,mixed> $values */
    private function renderTypedFields(array $schema, array $values, bool $disabled = false): void
    {
        $assetChoices = ($this->assetChoiceProvider)();
        $assetChoices = is_array($assetChoices) ? $assetChoices : [];
        $disabledAttributes = $disabled ? ' disabled aria-disabled="true"' : '';
        foreach ($schema['fields'] as $field) {
            $fieldId = (string) $field['id'];
            $type = (string) $field['type'];
            $label = (string) ($field['name'] ?? $fieldId);
            $value = (string) ($values[$fieldId] ?? '');
            $controlId = 'pagecraft-cms-' . substr(hash('sha256', $fieldId), 0, 12);
            $name = 'pagecraft_pending_fields[' . $this->fieldInputKey($fieldId) . ']';
            $required = !empty($field['required']) ? ' <span aria-hidden="true">*</span>' : '';
            echo '<div class="pagecraft-cms-field pagecraft-cms-field--' . esc_attr($type) . '"><label for="' . esc_attr($controlId) . '"><strong>' . esc_html($label) . '</strong>' . $required . '</label><br>';
            if ($type === 'rich') {
                echo '<textarea class="widefat" rows="8" id="' . esc_attr($controlId) . '" name="' . esc_attr($name) . '"' . $disabledAttributes . '>' . esc_textarea($value) . '</textarea>';
            } elseif ($type === 'image') {
                echo '<div class="pagecraft-cms-media"><select class="widefat pagecraft-cms-media__value" id="' . esc_attr($controlId) . '" name="' . esc_attr($name) . '"' . $disabledAttributes . '><option value="">' . esc_html__('No image', 'pagecraft-connector') . '</option>';
                $currentBase = preg_replace('/@\d+$/', '', $value);
                $currentListed = $value === '';
                foreach ($assetChoices as $assetValue => $assetLabel) {
                    $optionValue = hash_equals((string) $currentBase, (string) $assetValue) && $value !== '' ? $value : (string) $assetValue;
                    $selected = $value !== '' && hash_equals($value, $optionValue);
                    $currentListed = $currentListed || $selected;
                    echo '<option value="' . esc_attr($optionValue) . '"' . ($selected ? ' selected' : '') . '>' . esc_html((string) $assetLabel) . '</option>';
                }
                if (!$currentListed) {
                    $pendingLabel = str_starts_with($value, 'wp-media:')
                        ? sprintf(__('Pending WordPress media #%d', 'pagecraft-connector'), (int) substr($value, 9))
                        : __('Pending Pagecraft image', 'pagecraft-connector');
                    echo '<option value="' . esc_attr($value) . '" selected>' . esc_html($pendingLabel) . '</option>';
                }
                echo '</select><div class="pagecraft-cms-media__actions"><button type="button" class="button pagecraft-cms-media__choose" data-target="' . esc_attr($controlId) . '"' . $disabledAttributes . '>' . esc_html__('Choose or upload image', 'pagecraft-connector') . '</button><button type="button" class="button-link-delete pagecraft-cms-media__clear" data-target="' . esc_attr($controlId) . '"' . $disabledAttributes . '>' . esc_html__('Remove image', 'pagecraft-connector') . '</button></div><span class="description">' . esc_html__('Existing Pagecraft images stay referenced directly. New WordPress media is uploaded privately to the Pagecraft draft before the field write is sent.', 'pagecraft-connector') . '</span></div>';
            } elseif (in_array($type, ['option', 'ref'], true)) {
                echo '<select class="widefat" id="' . esc_attr($controlId) . '" name="' . esc_attr($name) . '"' . $disabledAttributes . '><option value="">' . esc_html__('Choose…', 'pagecraft-connector') . '</option>';
                foreach ((array) ($field['choices'] ?? []) as $choiceValue => $choiceLabel) {
                    echo '<option value="' . esc_attr((string) $choiceValue) . '"' . (hash_equals($value, (string) $choiceValue) ? ' selected' : '') . '>' . esc_html((string) $choiceLabel) . '</option>';
                }
                echo '</select>';
            } elseif ($type === 'bool') {
                $checked = in_array(strtolower($value), ['1', 'true', 'yes'], true);
                echo '<input type="hidden" name="' . esc_attr($name) . '" value="0"' . $disabledAttributes . '><input id="' . esc_attr($controlId) . '" name="' . esc_attr($name) . '" type="checkbox" value="1"' . ($checked ? ' checked' : '') . $disabledAttributes . '>';
            } else {
                $inputType = $type === 'number' ? 'number' : ($type === 'date' ? 'date' : ($type === 'link' ? 'url' : 'text'));
                echo '<input class="widefat" id="' . esc_attr($controlId) . '" name="' . esc_attr($name) . '" type="' . esc_attr($inputType) . '"' . ($type === 'number' ? ' step="any"' : '') . ' value="' . esc_attr($value) . '"' . $disabledAttributes . '>';
            }
            echo '</div>';
        }
    }

    /** @param array<string,mixed> $schema @return array<string,string>|\WP_Error */
    private function sanitizeTypedValues(mixed $rawValues, array $schema): array|\WP_Error
    {
        if (!is_array($rawValues) || $schema === [] || !is_array($schema['fields'] ?? null)) {
            return new \WP_Error('pagecraft_cms_schema_missing', 'This item has no valid signed Pagecraft collection schema.');
        }
        $allowedInputKeys = [];
        foreach ($schema['fields'] as $field) {
            $allowedInputKeys[$this->fieldInputKey((string) ($field['id'] ?? ''))] = true;
        }
        foreach ($rawValues as $inputKey => $rawValue) {
            if (!isset($allowedInputKeys[(string) $inputKey]) || is_array($rawValue) || is_object($rawValue)) {
                return new \WP_Error('pagecraft_cms_field_unknown', 'The CMS draft contains an unknown or non-scalar field.');
            }
        }

        $assetChoices = ($this->assetChoiceProvider)();
        $assetChoices = is_array($assetChoices) ? $assetChoices : [];
        $values = [];
        foreach ($schema['fields'] as $field) {
            $fieldId = (string) $field['id'];
            $type = (string) $field['type'];
            $key = $this->fieldInputKey($fieldId);
            $raw = array_key_exists($key, $rawValues) ? (string) $rawValues[$key] : ($type === 'bool' ? '0' : '');
            $value = match ($type) {
                'rich' => wp_kses_post($raw),
                'link' => esc_url_raw(trim($raw)),
                default => sanitize_text_field($raw),
            };
            if (!empty($field['required']) && ($value === '' || ($type === 'bool' && !in_array(strtolower($value), ['1', 'true', 'yes'], true)))) {
                return new \WP_Error('pagecraft_cms_field_required', sprintf('Complete the required Pagecraft field “%s”.', (string) ($field['name'] ?? $fieldId)));
            }
            $limit = $type === 'rich' ? 100000 : 5000;
            if (strlen($value) > $limit) {
                return new \WP_Error('pagecraft_cms_field_too_large', sprintf('Pagecraft field “%s” is too long.', (string) ($field['name'] ?? $fieldId)));
            }
            $choices = is_array($field['choices'] ?? null) ? $field['choices'] : [];
            $valid = $value === '' || match ($type) {
                'number' => is_numeric($value),
                'date' => (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value),
                'option', 'ref' => array_key_exists($value, $choices),
                'bool' => in_array(strtolower($value), ['0', '1', 'true', 'false', 'yes', 'no'], true),
                'image' => $this->managedImageValue($value, $assetChoices),
                'link' => (bool) preg_match('#^(?:https?://|/|\#|mailto:)#i', $value),
                default => true,
            };
            if (!$valid) {
                return new \WP_Error('pagecraft_cms_field_type', sprintf('Pagecraft field “%s” has an invalid %s value.', (string) ($field['name'] ?? $fieldId), $type));
            }
            $values[$fieldId] = $value;
        }
        return $values;
    }

    /** @param array<string,mixed> $choices */
    private function managedImageValue(string $value, array $choices): bool
    {
        if (preg_match('/^(asset:[A-Za-z0-9._:-]+)(?:@\d+)?$/', $value, $match)) {
            return array_key_exists((string) $match[1], $choices);
        }
        if (preg_match('/^wp-media:([1-9]\d*)$/', $value, $match)) {
            return !is_wp_error($this->localImageDetails((int) $match[1], true));
        }
        return false;
    }

    /** @param array<string,string> $values @return array<string,array<string,mixed>>|\WP_Error */
    private function capturePendingMedia(array $values, bool $requirePermission): array|\WP_Error
    {
        $media = [];
        foreach ($values as $fieldId => $value) {
            if (!preg_match('/^wp-media:([1-9]\d*)$/', $value, $match)) {
                continue;
            }
            $details = $this->localImageDetails((int) $match[1], $requirePermission);
            if (is_wp_error($details)) {
                return $details;
            }
            unset($details['file']);
            $media[$fieldId] = $details;
        }
        return $media;
    }

    /** @return array{attachmentId:int,file:string,filename:string,mime:string,bytes:int,hash:string}|\WP_Error */
    private function localImageDetails(int $attachmentId, bool $requirePermission): array|\WP_Error
    {
        if ($attachmentId < 1
            || get_post_type($attachmentId) !== 'attachment'
            || ($requirePermission && !current_user_can('edit_post', $attachmentId))) {
            return new \WP_Error('pagecraft_cms_media_invalid', 'Choose an image attachment that you are allowed to edit.');
        }
        $file = get_attached_file($attachmentId, true);
        $mime = strtolower((string) get_post_mime_type($attachmentId));
        $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
        if (!is_string($file) || $file === '' || !is_file($file) || !is_readable($file) || !in_array($mime, $allowed, true)) {
            return new \WP_Error('pagecraft_cms_media_missing', 'The selected WordPress image bytes are unavailable or unsupported.');
        }
        $bytes = filesize($file);
        if (!is_int($bytes) || $bytes < 1 || $bytes > 10 * MB_IN_BYTES) {
            return new \WP_Error('pagecraft_cms_media_invalid', 'The selected WordPress image must be between 1 byte and 10 MiB.');
        }
        if ($mime === 'image/svg+xml') {
            $safe = Mapper::validateSafeStaticSvgFile($file);
            if (is_wp_error($safe)) {
                return $safe;
            }
        } else {
            $sniffed = function_exists('wp_get_image_mime') ? strtolower((string) wp_get_image_mime($file)) : '';
            if ($sniffed === '' || !hash_equals($mime, $sniffed)) {
                return new \WP_Error('pagecraft_cms_media_invalid', 'The selected WordPress image MIME does not match its bytes.');
            }
        }
        $hash = hash_file('sha256', $file);
        if (!is_string($hash)) {
            return new \WP_Error('pagecraft_cms_media_invalid', 'The selected WordPress image could not be hashed.');
        }
        $extensions = [
            'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif',
            'image/webp' => 'webp', 'image/avif' => 'avif', 'image/svg+xml' => 'svg',
        ];
        $stem = sanitize_file_name((string) pathinfo(basename($file), PATHINFO_FILENAME));
        $filename = ($stem !== '' ? $stem : 'pagecraft-media-' . $attachmentId) . '.' . $extensions[$mime];
        return [
            'attachmentId' => $attachmentId,
            'file' => $file,
            'filename' => $filename,
            'mime' => $mime,
            'bytes' => $bytes,
            'hash' => $hash,
        ];
    }

    /** @param array<string,mixed> $payload @return array<string,mixed>|\WP_Error */
    private function resolvePendingMedia(
        array $payload,
        int $rowId,
        string $sourceId,
        ?array $lifecycle = null,
        ?\Closure $leaseGuard = null
    ): array|\WP_Error
    {
        if ($lifecycle === null) {
            $captured = $this->connection->lifecycleSnapshot();
            if (is_wp_error($captured)) {
                return $captured;
            }
            $lifecycle = $captured;
        }
        $values = is_array($payload['values'] ?? null) ? $payload['values'] : [];
        $media = is_array($payload['media'] ?? null) ? $payload['media'] : [];
        foreach ($values as $fieldId => $value) {
            if (!is_string($fieldId) || !is_string($value) || !preg_match('/^wp-media:([1-9]\d*)$/', $value, $match)) {
                continue;
            }
            $attachmentId = (int) $match[1];
            $frozen = is_array($media[$fieldId] ?? null) ? $media[$fieldId] : [];
            if ((int) ($frozen['attachmentId'] ?? 0) !== $attachmentId
                || !preg_match('/^[a-f0-9]{64}$/', (string) ($frozen['hash'] ?? ''))
                || !is_int($frozen['bytes'] ?? null)
                || !is_string($frozen['mime'] ?? null)
                || !is_string($frozen['filename'] ?? null)) {
                return new \WP_Error('pagecraft_cms_media_invalid', 'The private CMS media snapshot is incomplete.');
            }
            $current = $this->localImageDetails($attachmentId, false);
            if (is_wp_error($current)) {
                return $current;
            }
            if (!hash_equals((string) $frozen['hash'], $current['hash'])
                || (int) $frozen['bytes'] !== $current['bytes']
                || !hash_equals((string) $frozen['mime'], $current['mime'])) {
                return new \WP_Error('pagecraft_cms_media_changed', 'The selected WordPress image changed after the private draft was queued. Save the item again to approve its new bytes.');
            }
            $bytes = file_get_contents($current['file']);
            if (!is_string($bytes) || strlen($bytes) !== $current['bytes'] || !hash_equals($current['hash'], hash('sha256', $bytes))) {
                return new \WP_Error('pagecraft_cms_media_changed', 'The selected WordPress image changed while Pagecraft was preparing it.');
            }
            $fenced = $this->connection->assertLifecycleSnapshot($lifecycle);
            if (is_wp_error($fenced)) {
                return $fenced;
            }
            if ($leaseGuard !== null) {
                $leaseOwned = $leaseGuard();
                if (is_wp_error($leaseOwned)) {
                    return $leaseOwned;
                }
            }
            $key = $this->mediaIdempotencyKey($sourceId, $rowId, $fieldId, $attachmentId, $current['hash'], (string) ($lifecycle['connection_id'] ?? ''));
            $uploaded = ($this->assetUploader)($current['filename'], $current['mime'], $bytes, $current['hash'], $key, $lifecycle);
            if (is_wp_error($uploaded)) {
                return $uploaded;
            }
            $reference = (string) ($uploaded['reference'] ?? '');
            $assetId = (string) ($uploaded['assetId'] ?? '');
            if (!Support::validIdentifier($assetId)
                || !hash_equals('asset:' . $assetId, $reference)
                || !hash_equals($current['hash'], strtolower((string) ($uploaded['hash'] ?? '')))
                || (int) ($uploaded['bytes'] ?? -1) !== $current['bytes']
                || !hash_equals($current['mime'], strtolower((string) ($uploaded['mime'] ?? '')))
                || !is_bool($uploaded['duplicate'] ?? null)) {
                return new \WP_Error('pagecraft_cms_asset_response_invalid', 'Pagecraft returned an invalid CMS asset binding.');
            }
            $values[$fieldId] = $reference;
            $media[$fieldId] = $frozen + [
                'assetId' => $assetId,
                'reference' => $reference,
                'resolvedAt' => Support::utcNow(),
            ];
        }
        $payload['values'] = $values;
        if ($media !== []) {
            $payload['media'] = $media;
        }
        return $payload;
    }

    /** @param array{token:string,fence:int,purpose:string,expires:int} $lease @return true|\WP_Error */
    private function renewLifecycleLease(array &$lease): bool|\WP_Error
    {
        $renewed = $this->lifecycleLock->renew($lease);
        if (is_wp_error($renewed)) {
            return $renewed;
        }
        $lease = $renewed;
        return true;
    }

    private function mediaIdempotencyKey(
        string $sourceId,
        int $rowId,
        string $fieldId,
        int $attachmentId,
        string $hash,
        string $connectionId = ''
    ): string
    {
        $connectionId = $connectionId !== '' ? $connectionId : $this->connection->connectionId();
        $material = $connectionId . "\0" . $sourceId . "\0" . $rowId . "\0" . $fieldId . "\0" . $attachmentId . "\0" . $hash;
        return 'wp-media-' . $rowId . '-' . substr(hash('sha256', $material), 0, 40);
    }

    private function fieldInputKey(string $fieldId): string
    {
        return 'f_' . substr(hash('sha256', $fieldId), 0, 20);
    }

    /** @return array<string,string> Asset reference to administrator label. */
    private function activeImageChoices(): array
    {
        $active = $this->releases->active();
        if (!$active || !$this->activeReleaseBelongsToConnection($active)) {
            return [];
        }
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT source_id,object_id FROM {$wpdb->prefix}pagecraft_objects WHERE deployment_id = %s AND source_type = 'asset' AND state = 'active' ORDER BY source_id ASC",
            (string) $active['deployment_id']
        ), ARRAY_A);
        $choices = [];
        foreach ((array) $rows as $row) {
            $assetId = (string) ($row['source_id'] ?? '');
            $attachmentId = (int) ($row['object_id'] ?? 0);
            if (!Support::validIdentifier($assetId) || $attachmentId < 1 || !wp_attachment_is_image($attachmentId)) {
                continue;
            }
            $label = get_the_title($attachmentId);
            $choices['asset:' . $assetId] = $label !== '' ? $label : sprintf(__('Pagecraft image %s', 'pagecraft-connector'), $assetId);
        }
        return $choices;
    }

    private function field(string $name, string $label, string $value): void
    {
        echo '<p><label for="' . esc_attr($name) . '"><strong>' . esc_html($label) . '</strong></label><br><input class="widefat" id="' . esc_attr($name) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '"></p>';
    }

    private function textarea(string $name, string $label, string $value, int $rows, string $class = ''): void
    {
        echo '<p><label for="' . esc_attr($name) . '"><strong>' . esc_html($label) . '</strong></label><br><textarea class="widefat ' . esc_attr($class) . '" rows="' . $rows . '" id="' . esc_attr($name) . '" name="' . esc_attr($name) . '">' . esc_textarea($value) . '</textarea></p>';
    }

    private function eligible(int $postId): bool
    {
        return $this->production()
            && $this->connection->mode() === 'connected'
            && $this->connection->can('cms:write')
            && $this->activeCmsMapping($postId);
    }

    private function managed(int $postId): bool
    {
        return $postId > 0
            && get_post_type($postId) === 'pagecraft_entry'
            && get_post_meta($postId, '_pagecraft_managed', true) === '1';
    }

    private function currentPostId(): int
    {
        global $post;
        if ($post instanceof \WP_Post) {
            return $post->ID;
        }
        return absint($_GET['post'] ?? 0);
    }

    private function readOnlyMessage(): string
    {
        return $this->production()
            ? __('This Pagecraft CMS item is read-only because production write-back is not currently authorized.', 'pagecraft-connector')
            : __('This staging CMS item is read-only. Edit CMS values in Pagecraft; production WordPress is the only native write-back target.', 'pagecraft-connector');
    }

    private function activeCmsMapping(int $postId, string $sourceId = '', string $collectionId = ''): bool
    {
        $active = $this->releases->active();
        if ($postId < 1
            || !$this->activeReleaseBelongsToConnection($active)
            || get_post_type($postId) !== 'pagecraft_entry'
            || get_post_meta($postId, '_pagecraft_managed', true) !== '1') {
            return false;
        }
        $postSourceId = (string) get_post_meta($postId, '_pagecraft_item_id', true);
        $postCollectionId = (string) get_post_meta($postId, '_pagecraft_collection_id', true);
        $sourceId = $sourceId !== '' ? $sourceId : $postSourceId;
        $collectionId = $collectionId !== '' ? $collectionId : $postCollectionId;
        if (!Support::validIdentifier($sourceId)
            || !Support::validIdentifier($collectionId)
            || !hash_equals($postSourceId, $sourceId)
            || !hash_equals($postCollectionId, $collectionId)) {
            return false;
        }

        global $wpdb;
        $mapping = $wpdb->get_row($wpdb->prepare(
            "SELECT deployment_id,source_id,object_id,state FROM {$wpdb->prefix}pagecraft_objects WHERE deployment_id = %s AND source_type = 'cms' AND source_id = %s AND object_id = %d AND state = 'active' LIMIT 1",
            (string) $active['deployment_id'],
            $sourceId,
            $postId
        ), ARRAY_A);
        return is_array($mapping)
            && hash_equals((string) $active['deployment_id'], (string) ($mapping['deployment_id'] ?? ''))
            && hash_equals($sourceId, (string) ($mapping['source_id'] ?? ''))
            && (int) ($mapping['object_id'] ?? 0) === $postId
            && (string) ($mapping['state'] ?? '') === 'active';
    }

    /** @param array<string,mixed>|null $active */
    private function activeReleaseBelongsToConnection(?array $active = null): bool
    {
        $active ??= $this->releases->active();
        return is_array($active)
            && hash_equals($this->connection->connectionId(), (string) ($active['connection_id'] ?? ($active['manifest']['connectionId'] ?? '')))
            && hash_equals($this->connection->siteId(), (string) ($active['site_id'] ?? ($active['manifest']['siteId'] ?? '')));
    }

    private function production(): bool
    {
        return $this->connection->environment() === 'production';
    }

    private function idempotencyKey(string $sourceId, int $rowId, string $connectionId = ''): string
    {
        $connectionId = $connectionId !== '' ? $connectionId : $this->connection->connectionId();
        $material = $connectionId . "\0" . $sourceId . "\0" . $rowId;
        return 'wp-cms-' . $rowId . '-' . substr(hash('sha256', $material), 0, 40);
    }

    private function newerDraftId(string $connectionId, string $sourceId, int $rowId, string $table): int
    {
        global $wpdb;
        return (int) $wpdb->get_var($wpdb->prepare(
            // Every higher row is an accepted local save. Even if that newer
            // save later fails schema/media delivery, an older retry must never
            // overwrite it and roll the Pagecraft draft backward.
            "SELECT id FROM {$table} WHERE connection_id = %s AND source_id = %s AND id > %d ORDER BY id DESC LIMIT 1",
            $connectionId,
            $sourceId,
            $rowId
        ));
    }

    private function supersede(string $table, int $rowId, string $message): void
    {
        global $wpdb;
        $wpdb->update($table, [
            'status' => 'superseded',
            'updated_at' => Support::utcNow(),
            'error_message' => $message,
        ], ['id' => $rowId]);
    }

    /** @param array<string,mixed> $payload @return array<string,mixed> */
    private function normalizePayload(array $payload): array
    {
        $values = is_array($payload['values'] ?? null) ? $payload['values'] : [];
        return [
            'itemId' => (string) ($payload['itemId'] ?? ''),
            'collectionId' => (string) ($payload['collectionId'] ?? ''),
            'title' => sanitize_text_field((string) ($payload['title'] ?? '')),
            'slug' => sanitize_title((string) ($payload['slug'] ?? '')),
            'body' => wp_kses_post((string) ($payload['body'] ?? '')),
            'excerpt' => sanitize_textarea_field((string) ($payload['excerpt'] ?? '')),
            'values' => array_map(static fn (mixed $value): string => sanitize_textarea_field((string) $value), $values),
        ];
    }
}
