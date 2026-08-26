<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Schema
{
    public const VERSION = '1.7.0';

    public static function install(): bool
    {
        global $wpdb;

        if (!function_exists('dbDelta')) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }
        $collate = $wpdb->get_charset_collate();

        $releases = $wpdb->prefix . 'pagecraft_releases';
        $routes = $wpdb->prefix . 'pagecraft_routes';
        $objects = $wpdb->prefix . 'pagecraft_objects';
        $redirects = $wpdb->prefix . 'pagecraft_redirects';
        $events = $wpdb->prefix . 'pagecraft_events';
        $forms = $wpdb->prefix . 'pagecraft_forms';
        $rates = $wpdb->prefix . 'pagecraft_rate_limits';
        $scripts = $wpdb->prefix . 'pagecraft_script_approvals';
        $drafts = $wpdb->prefix . 'pagecraft_cms_drafts';

        dbDelta("CREATE TABLE {$releases} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            deployment_id varchar(160) NOT NULL,
            release_id varchar(96) NOT NULL,
            connection_id varchar(96) NOT NULL DEFAULT '',
            site_id varchar(96) NOT NULL DEFAULT '',
            sequence_no bigint(20) unsigned NOT NULL,
            source_version bigint(20) unsigned NOT NULL DEFAULT 0,
            status varchar(24) NOT NULL DEFAULT 'staged',
            manifest longtext NOT NULL,
            manifest_hash char(64) NOT NULL,
            deployment_hash char(64) NOT NULL,
            artifact_hash char(64) NOT NULL DEFAULT '',
            parent_release_id varchar(96) NULL,
            created_at datetime NOT NULL,
            installed_at datetime NULL,
            activated_at datetime NULL,
            verified_at datetime NULL,
            previous_deployment_id varchar(160) NULL,
            pinned tinyint(1) NOT NULL DEFAULT 0,
            error_code varchar(64) NULL,
            error_message text NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY deployment_id (deployment_id),
            KEY release_id (release_id),
            KEY connection_sequence (connection_id,sequence_no),
            KEY site_id (site_id),
            KEY sequence_no (sequence_no),
            KEY status (status),
            KEY verified_at (verified_at),
            KEY previous_deployment_id (previous_deployment_id)
        ) {$collate};");

        dbDelta("CREATE TABLE {$routes} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            release_id varchar(160) NOT NULL,
            route_path varchar(191) NOT NULL,
            page_id varchar(96) NOT NULL,
            post_id bigint(20) unsigned NULL,
            title text NOT NULL,
            description text NOT NULL,
            head_html longtext NOT NULL,
            body_html longtext NOT NULL,
            content_hash char(64) NOT NULL,
            seo_json longtext NULL,
            scripts_json longtext NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY release_route (release_id,route_path),
            KEY page_id (page_id),
            KEY post_id (post_id)
        ) {$collate};");

        dbDelta("CREATE TABLE {$objects} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            deployment_id varchar(160) NOT NULL DEFAULT '',
            release_id varchar(96) NOT NULL DEFAULT '',
            source_type varchar(24) NOT NULL,
            source_id varchar(96) NOT NULL,
            object_id bigint(20) unsigned NOT NULL,
            object_hash char(64) NOT NULL,
            target_status varchar(24) NOT NULL DEFAULT 'publish',
            state varchar(24) NOT NULL DEFAULT 'staged',
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY deployment_source (deployment_id,source_type,source_id),
            KEY source_state (source_type,source_id,state),
            KEY object_id (object_id),
            KEY release_id (release_id),
            KEY deployment_id (deployment_id)
        ) {$collate};");

        dbDelta("CREATE TABLE {$redirects} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            release_id varchar(160) NOT NULL,
            from_path varchar(191) NOT NULL,
            to_path varchar(191) NOT NULL,
            status_code smallint(3) unsigned NOT NULL DEFAULT 301,
            PRIMARY KEY  (id),
            UNIQUE KEY release_from (release_id,from_path),
            KEY release_id (release_id)
        ) {$collate};");

        // dbDelta does not remove obsolete indexes. The old index prevented one
        // immutable mapping per deployment and made safe rollback impossible.
        $legacyIndex = $wpdb->get_var($wpdb->prepare("SHOW INDEX FROM {$objects} WHERE Key_name = %s", 'source_object'));
        if (is_string($legacyIndex) && $legacyIndex !== '') {
            $wpdb->query("ALTER TABLE {$objects} DROP INDEX source_object");
        }

        dbDelta("CREATE TABLE {$events} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id varchar(96) NOT NULL,
            connection_id varchar(96) NOT NULL,
            release_id varchar(96) NULL,
            sequence_no bigint(20) unsigned NULL,
            body_hash char(64) NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'queued',
            attempts smallint(5) unsigned NOT NULL DEFAULT 0,
            available_at datetime NOT NULL,
            lease_until datetime NULL,
            received_at datetime NOT NULL,
            error_message text NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY event_id (event_id),
            KEY queue (status,available_at)
        ) {$collate};");

        dbDelta("CREATE TABLE {$forms} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            submission_uuid char(36) NOT NULL,
            form_id varchar(96) NOT NULL,
            route_path varchar(191) NOT NULL,
            payload longtext NOT NULL,
            email_hash char(64) NULL,
            ip_hash char(64) NOT NULL,
            user_agent_hash char(64) NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'received',
            created_at datetime NOT NULL,
            expires_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY submission_uuid (submission_uuid),
            KEY form_id (form_id),
            KEY expires_at (expires_at)
        ) {$collate};");

        dbDelta("CREATE TABLE {$rates} (
            key_hash char(64) NOT NULL,
            window_start datetime NOT NULL,
            hits smallint(5) unsigned NOT NULL DEFAULT 1,
            expires_at datetime NOT NULL,
            PRIMARY KEY  (key_hash),
            KEY expires_at (expires_at)
        ) {$collate};");

        dbDelta("CREATE TABLE {$scripts} (
            fingerprint char(64) NOT NULL,
            label varchar(191) NOT NULL DEFAULT '',
            first_seen datetime NOT NULL,
            approved_at datetime NULL,
            approved_by bigint(20) unsigned NULL,
            revoked_at datetime NULL,
            PRIMARY KEY  (fingerprint),
            KEY approved_at (approved_at)
        ) {$collate};");

        // dbDelta cannot replace an existing index when the same key name has
        // different columns. v1.7 scopes the CMS queue by connection, so drop
        // only that known obsolete shape before asking dbDelta to recreate it.
        self::dropMismatchedIndex($drafts, 'queue', ['connection_id', 'status', 'available_at']);
        dbDelta("CREATE TABLE {$drafts} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            connection_id varchar(96) NOT NULL DEFAULT '',
            source_id varchar(96) NOT NULL,
            post_id bigint(20) unsigned NOT NULL,
            base_release_id varchar(96) NOT NULL,
            payload longtext NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'queued',
            attempts smallint(5) unsigned NOT NULL DEFAULT 0,
            available_at datetime NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            error_message text NULL,
            PRIMARY KEY  (id),
            KEY queue (connection_id,status,available_at),
            KEY source_id (source_id),
            KEY post_id (post_id)
        ) {$collate};");

        // dbDelta is best-effort and can return without surfacing a failed
        // ALTER/CREATE. Never advance the schema cursor until the exact table
        // columns and keys used by binding, activation, rollback, and queues
        // are visible in the database.
        if (!self::ready()) {
            return false;
        }

        // Release manifests already contain the consent-bound connection/site
        // identity, so upgrades can scope existing rows without mutating their
        // signed bytes. Legacy CMS drafts cannot be attributed safely and stay
        // quarantined with an empty connection_id.
        $legacyReleases = $wpdb->get_results("SELECT id,manifest FROM {$releases} WHERE connection_id = '' OR site_id = ''", ARRAY_A);
        $releaseBackfillComplete = true;
        foreach ((array) $legacyReleases as $legacyRelease) {
            try {
                $manifest = Support::decodeObject((string) ($legacyRelease['manifest'] ?? '{}'));
            } catch (\RuntimeException) {
                $releaseBackfillComplete = false;
                continue;
            }
            $connectionId = (string) ($manifest['connectionId'] ?? '');
            $siteId = (string) ($manifest['siteId'] ?? '');
            if (!Support::validIdentifier($connectionId, 96) || !Support::validIdentifier($siteId, 96)) {
                $releaseBackfillComplete = false;
                continue;
            }
            $updated = $wpdb->update(
                $releases,
                ['connection_id' => $connectionId, 'site_id' => $siteId],
                ['id' => (int) ($legacyRelease['id'] ?? 0)],
                ['%s', '%s'],
                ['%d']
            );
            if ($updated !== 1) {
                $releaseBackfillComplete = false;
            }
        }

        if (!$releaseBackfillComplete) {
            return false;
        }
        update_option('pagecraft_schema_version', self::VERSION, false);
        return (string) get_option('pagecraft_schema_version', '') === self::VERSION;
    }

    public static function ready(): bool
    {
        global $wpdb;
        foreach (self::requiredShape() as $suffix => $required) {
            $table = $wpdb->prefix . $suffix;
            $columnRows = $wpdb->get_results("SHOW COLUMNS FROM {$table}", ARRAY_A);
            if (!is_array($columnRows) || $columnRows === []) {
                return false;
            }
            $columns = array_values(array_filter(array_map(
                static fn (mixed $row): string => is_array($row) ? (string) ($row['Field'] ?? '') : '',
                $columnRows
            )));
            foreach ($required['columns'] as $column) {
                if (!in_array($column, $columns, true)) {
                    return false;
                }
            }

            $indexRows = $wpdb->get_results("SHOW INDEX FROM {$table}", ARRAY_A);
            if (!is_array($indexRows) || $indexRows === []) {
                return false;
            }
            $indexes = array_values(array_unique(array_filter(array_map(
                static fn (mixed $row): string => is_array($row) ? (string) ($row['Key_name'] ?? '') : '',
                $indexRows
            ))));
            foreach ($required['indexes'] as $index) {
                if (!in_array($index, $indexes, true)) {
                    return false;
                }
            }
            $expectedColumns = self::requiredIndexColumns()[$suffix] ?? [];
            foreach ($expectedColumns as $index => $columns) {
                $actual = [];
                foreach ($indexRows as $row) {
                    if (is_array($row) && (string) ($row['Key_name'] ?? '') === $index) {
                        $actual[(int) ($row['Seq_in_index'] ?? (count($actual) + 1))] = (string) ($row['Column_name'] ?? '');
                    }
                }
                ksort($actual);
                if (array_values($actual) !== $columns) {
                    return false;
                }
            }
        }
        return true;
    }

    /** @return array<string,array<string,list<string>>> */
    private static function requiredIndexColumns(): array
    {
        return [
            'pagecraft_releases' => ['connection_sequence' => ['connection_id', 'sequence_no']],
            'pagecraft_routes' => ['release_route' => ['release_id', 'route_path']],
            'pagecraft_objects' => ['deployment_source' => ['deployment_id', 'source_type', 'source_id']],
            'pagecraft_events' => ['queue' => ['status', 'available_at']],
            'pagecraft_cms_drafts' => ['queue' => ['connection_id', 'status', 'available_at']],
        ];
    }

    /** @param list<string> $expected */
    private static function dropMismatchedIndex(string $table, string $index, array $expected): void
    {
        global $wpdb;
        $rows = $wpdb->get_results("SHOW INDEX FROM {$table}", ARRAY_A);
        if (!is_array($rows)) {
            return;
        }
        $actual = [];
        foreach ($rows as $row) {
            if (is_array($row) && (string) ($row['Key_name'] ?? '') === $index) {
                $actual[(int) ($row['Seq_in_index'] ?? (count($actual) + 1))] = (string) ($row['Column_name'] ?? '');
            }
        }
        ksort($actual);
        if ($actual !== [] && array_values($actual) !== $expected) {
            // Identifiers are internal constants, never request input.
            $wpdb->query("ALTER TABLE {$table} DROP INDEX {$index}");
        }
    }

    /** @return array<string,array{columns:list<string>,indexes:list<string>}> */
    private static function requiredShape(): array
    {
        return [
            'pagecraft_releases' => [
                'columns' => ['id', 'deployment_id', 'release_id', 'connection_id', 'site_id', 'sequence_no', 'source_version', 'status', 'manifest', 'manifest_hash', 'deployment_hash', 'artifact_hash', 'parent_release_id', 'created_at', 'installed_at', 'activated_at', 'verified_at', 'previous_deployment_id', 'pinned', 'error_code', 'error_message'],
                'indexes' => ['PRIMARY', 'deployment_id', 'release_id', 'connection_sequence', 'site_id', 'sequence_no', 'status', 'verified_at', 'previous_deployment_id'],
            ],
            'pagecraft_routes' => [
                'columns' => ['id', 'release_id', 'route_path', 'page_id', 'post_id', 'title', 'description', 'head_html', 'body_html', 'content_hash', 'seo_json', 'scripts_json'],
                'indexes' => ['PRIMARY', 'release_route', 'page_id', 'post_id'],
            ],
            'pagecraft_objects' => [
                'columns' => ['id', 'deployment_id', 'release_id', 'source_type', 'source_id', 'object_id', 'object_hash', 'target_status', 'state', 'updated_at'],
                'indexes' => ['PRIMARY', 'deployment_source', 'source_state', 'object_id', 'release_id', 'deployment_id'],
            ],
            'pagecraft_redirects' => [
                'columns' => ['id', 'release_id', 'from_path', 'to_path', 'status_code'],
                'indexes' => ['PRIMARY', 'release_from', 'release_id'],
            ],
            'pagecraft_events' => [
                'columns' => ['id', 'event_id', 'connection_id', 'release_id', 'sequence_no', 'body_hash', 'status', 'attempts', 'available_at', 'lease_until', 'received_at', 'error_message'],
                'indexes' => ['PRIMARY', 'event_id', 'queue'],
            ],
            'pagecraft_forms' => [
                'columns' => ['id', 'submission_uuid', 'form_id', 'route_path', 'payload', 'email_hash', 'ip_hash', 'user_agent_hash', 'status', 'created_at', 'expires_at'],
                'indexes' => ['PRIMARY', 'submission_uuid', 'form_id', 'expires_at'],
            ],
            'pagecraft_rate_limits' => [
                'columns' => ['key_hash', 'window_start', 'hits', 'expires_at'],
                'indexes' => ['PRIMARY', 'expires_at'],
            ],
            'pagecraft_script_approvals' => [
                'columns' => ['fingerprint', 'label', 'first_seen', 'approved_at', 'approved_by', 'revoked_at'],
                'indexes' => ['PRIMARY', 'approved_at'],
            ],
            'pagecraft_cms_drafts' => [
                'columns' => ['id', 'connection_id', 'source_id', 'post_id', 'base_release_id', 'payload', 'status', 'attempts', 'available_at', 'created_at', 'updated_at', 'error_message'],
                'indexes' => ['PRIMARY', 'queue', 'source_id', 'post_id'],
            ],
        ];
    }
}
