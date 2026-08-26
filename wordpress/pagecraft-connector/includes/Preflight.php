<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/** Reusable deployment readiness checks for pairing, sync, Site Health, and WP-CLI. */
final class Preflight
{
    public function __construct(
        private readonly Connection $connection,
        private readonly Mapper $mapper,
        private readonly Cron $cron
    ) {
    }

    public function hooks(): void
    {
        add_filter('pagecraft_connector_preflight', [$this, 'filter'], 5, 3);
    }

    /** @param array<string,mixed> $manifest @param array<string,mixed> $artifact */
    public function filter(mixed $result, array $manifest, array $artifact): mixed
    {
        if ($result !== true) {
            return $result;
        }
        $report = $this->report($manifest, $artifact, true);
        update_option('pagecraft_preflight', $report, false);
        if ($report['ok']) {
            return true;
        }
        foreach ($report['checks'] as $code => $check) {
            if (!empty($check['blocking']) && empty($check['ok'])) {
                return new \WP_Error((string) $code, (string) $check['message'], ['checks' => $report['checks']]);
            }
        }
        return new \WP_Error('pagecraft_preflight_failed', 'Pagecraft deployment preflight failed.', ['checks' => $report['checks']]);
    }

    public function pairing(string $apiOrigin, string $profile, string $environment): bool|\WP_Error
    {
        $report = $this->report([
            'targetOrigin' => Support::normalizeOrigin(home_url('/')),
            'targetPath' => $this->targetPath(),
            'profile' => $profile,
            'environment' => $environment,
            '_pairing' => true,
            '_apiOrigin' => Support::normalizeOrigin($apiOrigin),
        ], [], true);
        update_option('pagecraft_preflight', $report, false);
        if ($report['ok']) {
            return true;
        }
        foreach ($report['checks'] as $code => $check) {
            if (!empty($check['blocking']) && empty($check['ok'])) {
                return new \WP_Error((string) $code, (string) $check['message'], ['checks' => $report['checks']]);
            }
        }
        return new \WP_Error('pagecraft_preflight_failed', 'Pagecraft pairing preflight failed.', ['checks' => $report['checks']]);
    }

    /**
     * @param array<string,mixed> $manifest
     * @param array<string,mixed> $artifact
     * @return array{ok:bool,checked_at:string,checks:array<string,array{ok:bool,blocking:bool,message:string}>}
     */
    public function report(array $manifest = [], array $artifact = [], bool $network = false): array
    {
        global $wpdb;
        $pairing = !empty($manifest['_pairing']);
        $connection = $this->connection->publicData();
        $profile = (string) ($manifest['profile'] ?? $this->connection->profile());
        $environment = (string) ($manifest['environment'] ?? $this->connection->environment());
        $apiOrigin = Support::normalizeOrigin((string) ($manifest['_apiOrigin'] ?? $this->connection->apiOrigin()));
        $homeOrigin = Support::normalizeOrigin(home_url('/'));
        $expectedOrigin = Support::normalizeOrigin((string) ($manifest['targetOrigin'] ?? ($connection['target_origin'] ?? '')));
        $expectedPath = $this->normalizeTargetPath((string) ($manifest['targetPath'] ?? ($connection['target_path'] ?? '')));
        $actualPath = $this->targetPath();
        $checks = [];
        $add = static function (string $code, bool $ok, bool $blocking, string $message) use (&$checks): void {
            $checks[$code] = ['ok' => $ok, 'blocking' => $blocking, 'message' => $message];
        };

        $add('pagecraft_preflight_php', version_compare(PHP_VERSION, '8.1', '>='), true, 'Pagecraft Connector requires PHP 8.1 or later.');
        $add('pagecraft_preflight_wordpress', version_compare((string) get_bloginfo('version'), '6.6', '>='), true, 'Pagecraft Connector requires WordPress 6.6 or later.');
        $add('pagecraft_preflight_single_site', !is_multisite(), true, 'Pagecraft Connector v1 supports single-site WordPress installations only.');
        $add('pagecraft_preflight_crypto', Support::signatureVerifierAvailable(), true, 'Pagecraft requires Sodium or sodium_compat to verify signed releases.');
        $add('pagecraft_preflight_origin', $homeOrigin !== '' && $homeOrigin === $expectedOrigin, true, 'The signed target origin does not exactly match WordPress Home URL.');
        $add('pagecraft_preflight_target_path', $expectedPath !== '' && $expectedPath === $actualPath, true, 'The signed target path does not exactly match this WordPress installation path.');
        $add('pagecraft_preflight_https', str_starts_with($homeOrigin, 'https://') || Support::environmentAllowsHttp($homeOrigin), true, 'WordPress must use HTTPS; insecure HTTP is allowed only for an explicitly enabled loopback test target.');
        $add('pagecraft_preflight_api_origin', $apiOrigin !== '' && (str_starts_with($apiOrigin, 'https://') || Support::environmentAllowsHttp($apiOrigin)), true, 'The Pagecraft API must use HTTPS; insecure HTTP is allowed only for an explicitly enabled loopback test target.');
        $add('pagecraft_preflight_root_trust', $apiOrigin !== '' && RootTrust::isProvisioned($apiOrigin), true, 'This connector build has no valid pinned Pagecraft root public key.');
        $add('pagecraft_preflight_environment', in_array($environment, ['staging', 'production'], true), true, 'Choose an explicit Staging or Production deployment target.');

        $permalinks = (string) get_option('permalink_structure', '');
        $add('pagecraft_preflight_permalinks', $permalinks !== '', true, 'Enable pretty permalinks before connecting Pagecraft.');
        $rules = get_option('rewrite_rules', []);
        $add('pagecraft_preflight_rewrites', is_array($rules) && $rules !== [], true, 'WordPress rewrite rules are missing. Save Permalink Settings, then retry.');

        $uploads = wp_upload_dir();
        $uploadDirectory = is_array($uploads) ? (string) ($uploads['basedir'] ?? '') : '';
        $uploadReady = is_array($uploads) && empty($uploads['error']) && $uploadDirectory !== '' && is_dir($uploadDirectory) && is_writable($uploadDirectory);
        $add('pagecraft_preflight_uploads', $uploadReady, true, 'The WordPress uploads directory must exist and be writable.');
        $requiredBytes = max(50 * MB_IN_BYTES, 2 * (int) ($manifest['artifactBytes'] ?? 0));
        $free = $uploadReady ? @disk_free_space($uploadDirectory) : false;
        $add('pagecraft_preflight_disk', is_numeric($free) && (float) $free >= $requiredBytes, true, sprintf('At least %d MB of free upload storage is required for safe staging.', (int) ceil($requiredBytes / MB_IN_BYTES)));

        $engines = [];
        foreach ([$wpdb->posts, $wpdb->options, $wpdb->prefix . 'pagecraft_releases', $wpdb->prefix . 'pagecraft_objects'] as $table) {
            $row = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS LIKE %s', $wpdb->esc_like($table)), ARRAY_A);
            $engines[$table] = is_array($row) ? strtoupper((string) ($row['Engine'] ?? '')) : '';
        }
        $add('pagecraft_preflight_storage', $engines !== [] && !in_array(false, array_map(static fn (string $engine): bool => $engine === 'INNODB', $engines), true), true, 'Atomic Pagecraft activation requires InnoDB for WordPress posts, options, releases, and mappings.');

        $nextSync = $this->cron->nextRuns()['sync'];
        $heartbeat = get_option('pagecraft_cron_heartbeat', []);
        $installedAt = (int) get_option('pagecraft_installed_at', time());
        $heartbeatFresh = time() - $installedAt < 30 * MINUTE_IN_SECONDS
            || (is_array($heartbeat) && (int) ($heartbeat['started_at'] ?? 0) >= time() - 30 * MINUTE_IN_SECONDS);
        $cronReady = is_int($nextSync) && $nextSync >= time() - 5 * MINUTE_IN_SECONDS && $nextSync <= time() + 30 * MINUTE_IN_SECONDS && $heartbeatFresh;
        $add('pagecraft_preflight_cron', $cronReady, true, 'The Pagecraft reconciliation event is missing or overdue. Repair WP-Cron before connecting.');

        $theme = wp_get_theme('pagecraft');
        $pagecraftExists = $theme->exists() && !$theme->errors();
        if ($profile === 'pagecraft-theme') {
            $add('pagecraft_preflight_profile_theme', $pagecraftExists && ($pairing || get_stylesheet() === 'pagecraft'), !$pairing, $pagecraftExists ? 'Activate Pagecraft Theme explicitly before synchronization.' : 'Install the compatible Pagecraft theme before synchronization.');
        } elseif ($profile === 'existing-theme') {
            $add('pagecraft_preflight_profile_theme', get_stylesheet() !== 'pagecraft', true, 'Existing Theme profile must keep the incumbent WordPress theme active.');
        } else {
            $add('pagecraft_preflight_profile_theme', false, true, 'Choose a supported Pagecraft rendering profile.');
        }

        $builderActive = defined('ELEMENTOR_VERSION') || defined('ET_BUILDER_VERSION') || class_exists('FLBuilder');
        $add('pagecraft_preflight_builder_dependency', !$builderActive || $profile === 'existing-theme', false, 'A WordPress page builder is active; confirm it is not required by the Pagecraft Theme profile.');
        $themeDependencies = $this->publishedThemeDependencyIds();
        $themeCompatible = $profile !== 'pagecraft-theme' || $themeDependencies === [];
        $add(
            'pagecraft_preflight_theme_content_dependencies',
            $themeCompatible,
            $profile === 'pagecraft-theme',
            $themeCompatible
                ? 'Published WordPress content is compatible with the selected rendering profile.'
                : sprintf('Pagecraft Theme activation is blocked because %d published item(s) depend on a builder or incumbent-theme template. Use Existing Theme or migrate those items first.', count($themeDependencies))
        );
        $conflicts = $this->mapper->conflicts();
        $add('pagecraft_preflight_route_decisions', $pairing || $conflicts === [], !$pairing, 'Resolve every Pagecraft route collision in Operate before activation.');

        if (!$pairing && $this->connection->isConfigured()) {
            $add('pagecraft_preflight_connection_origin', hash_equals((string) ($connection['target_origin'] ?? ''), $homeOrigin), true, 'The connected target origin changed and must be rebound in Pagecraft.');
            $add('pagecraft_preflight_connection_path', $this->normalizeTargetPath((string) ($connection['target_path'] ?? '')) === $actualPath, true, 'The connected target path changed and must be rebound in Pagecraft.');
            $add('pagecraft_preflight_connection_profile', hash_equals($this->connection->profile(), $profile), true, 'The release profile differs from the consent-bound connection profile.');
            $add('pagecraft_preflight_connection_environment', hash_equals($this->connection->environment(), $environment), true, 'The release environment differs from the consent-bound deployment target.');
        }

        if ($network && apply_filters('pagecraft_connector_run_network_preflight', true, $manifest, $artifact)) {
            $rest = wp_safe_remote_get(rest_url(), ['timeout' => 8, 'redirection' => 0, 'user-agent' => 'Pagecraft-Connector-Preflight/' . PAGECRAFT_CONNECTOR_VERSION]);
            $restStatus = is_wp_error($rest) ? 0 : wp_remote_retrieve_response_code($rest);
            $add('pagecraft_preflight_rest_loopback', !is_wp_error($rest) && $restStatus >= 200 && $restStatus < 400, true, 'The WordPress REST API loopback request failed.');
            $outbound = $apiOrigin !== '' ? wp_safe_remote_head($apiOrigin . '/v1/health', ['timeout' => 8, 'redirection' => 0, 'user-agent' => 'Pagecraft-Connector-Preflight/' . PAGECRAFT_CONNECTOR_VERSION]) : new \WP_Error('pagecraft_api_origin', 'Missing API origin.');
            $outboundStatus = is_wp_error($outbound) ? 0 : wp_remote_retrieve_response_code($outbound);
            $add('pagecraft_preflight_outbound', !is_wp_error($outbound) && $outboundStatus >= 200 && $outboundStatus < 500, true, 'WordPress cannot reach the configured Pagecraft API origin.');
        }

        $ok = true;
        foreach ($checks as $check) {
            if ($check['blocking'] && !$check['ok']) {
                $ok = false;
                break;
            }
        }
        return ['ok' => $ok, 'checked_at' => Support::utcNow(), 'checks' => $checks];
    }

    public function pagecraftThemeCompatibility(string $profile = 'pagecraft-theme'): bool|\WP_Error
    {
        if ($profile !== 'pagecraft-theme') {
            return true;
        }
        $ids = $this->publishedThemeDependencyIds();
        if ($ids === []) {
            return true;
        }
        return new \WP_Error(
            'pagecraft_preflight_theme_content_dependencies',
            sprintf('Pagecraft Theme activation is blocked because %d published item(s) depend on a builder or incumbent-theme template. Use Existing Theme or migrate those items first.', count($ids)),
            ['post_ids' => $ids]
        );
    }

    /** @return list<int> */
    private function publishedThemeDependencyIds(): array
    {
        global $wpdb;
        $metaKeys = [
            '_elementor_edit_mode',
            '_elementor_data',
            '_et_pb_use_builder',
            '_fl_builder_enabled',
            '_fl_builder_data',
            '_fusion_builder_status',
            '_wpb_vc_js_status',
            '_bricks_page_content_2',
            'ct_builder_shortcodes',
            '_themify_builder_settings_json',
            '_wp_page_template',
        ];
        $quotedKeys = implode(',', array_fill(0, count($metaKeys), '%s'));
        $sql = "/* pagecraft_theme_dependencies */
            SELECT DISTINCT p.ID
            FROM {$wpdb->posts} p
            LEFT JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
            WHERE p.post_status = 'publish'
              AND p.post_type NOT IN ('attachment','revision','nav_menu_item')
              AND (
                (pm.meta_key IN ({$quotedKeys})
                  AND pm.meta_value NOT IN ('','0','off','no','false','[]','default'))
                OR p.post_content REGEXP '\\\\[(et_pb_|fusion_|vc_|fl_builder_|themify_|oxy_|ct_)'
              )
            ORDER BY p.ID ASC
            LIMIT 100";
        $ids = $wpdb->get_col($wpdb->prepare($sql, ...$metaKeys));
        $ids = array_values(array_unique(array_filter(array_map('intval', (array) $ids), static fn (int $id): bool => $id > 0)));
        /** @var list<int> $ids */
        return array_values((array) apply_filters('pagecraft_connector_theme_dependency_post_ids', $ids));
    }

    private function targetPath(): string
    {
        return $this->normalizeTargetPath((string) wp_parse_url(home_url('/'), PHP_URL_PATH));
    }

    private function normalizeTargetPath(string $path): string
    {
        $path = '/' . trim($path, '/');
        return $path === '/' ? '/' : $path . '/';
    }
}
