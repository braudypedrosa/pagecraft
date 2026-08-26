<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class CliCommand
{
    public function __construct(
        private readonly Sync $sync,
        private readonly ReleaseRepository $releases,
        private readonly Connection $connection,
        private readonly Seo $seo,
        private readonly ScriptApprovals $scripts,
        private readonly Preflight $preflight,
        private readonly Revocation $revocation
    ) {
    }

    public static function register(Sync $sync, ReleaseRepository $releases, Connection $connection, Seo $seo, ScriptApprovals $scripts, Preflight $preflight, Revocation $revocation): void
    {
        \WP_CLI::add_command('pagecraft', new self($sync, $releases, $connection, $seo, $scripts, $preflight, $revocation));
    }

    /** Show connection and active release status. */
    public function status(array $args, array $assoc): void
    {
        $active = $this->releases->active();
        $data = [
            'configured' => $this->connection->isConfigured(),
            'mode' => $this->connection->mode(),
            'profile' => $this->connection->profile(),
            'connection_id' => $this->connection->connectionId(),
            'site_id' => $this->connection->siteId(),
            'active_release_id' => $active['release_id'] ?? null,
            'active_deployment_id' => $active['deployment_id'] ?? null,
            'target_sequence' => $active['sequence'] ?? null,
            'last_sync' => get_option('pagecraft_last_sync', null),
            'revocation_pending' => $this->revocation->pending(),
        ];
        $this->output($data, $assoc);
    }

    /** Pull, verify, stage, and activate the desired signed release. */
    public function sync(array $args, array $assoc): void
    {
        $result = $this->sync->run(isset($assoc['force']));
        if (is_wp_error($result)) {
            \WP_CLI::error($result->get_error_code() . ': ' . $result->get_error_message());
        }
        $this->output($result, $assoc);
    }

    /** Pause automatic synchronization. */
    public function pause(): void
    {
        $this->connection->setMode('paused');
        \WP_CLI::success('Pagecraft synchronization paused.');
    }

    /** Resume connected synchronization. */
    public function resume(): void
    {
        if (!$this->connection->isConfigured()) {
            \WP_CLI::error('Pagecraft is not connected.');
        }
        if (!$this->connection->resume('cli')) {
            \WP_CLI::error('Pagecraft synchronization could not be resumed. Resolve pending revocation or connection state first.');
        }
        \WP_CLI::success('Pagecraft synchronization resumed.');
    }

    /** Freeze the active release and remove connector credentials. */
    public function disconnect(): void
    {
        $result = $this->revocation->begin();
        if (is_wp_error($result)) {
            \WP_CLI::error($result->get_error_code() . ': ' . $result->get_error_message());
        }
        \WP_CLI::success('Pagecraft disconnected and revoked; the active release remains frozen.');
    }

    /** Roll back to a retained deployment and pause synchronization. */
    public function rollback(array $args): void
    {
        $deploymentId = (string) ($args[0] ?? '');
        $result = $this->sync->emergencyRollback($deploymentId);
        if (is_wp_error($result)) {
            \WP_CLI::error($result->get_error_code() . ': ' . $result->get_error_message());
        }
        \WP_CLI::success('Rollback active; synchronization paused.');
    }

    /** Pin or unpin a retained deployment. */
    public function pin(array $args, array $assoc): void
    {
        $deploymentId = (string) ($args[0] ?? '');
        $pinned = !isset($assoc['off']);
        $result = $this->sync->pinRelease($deploymentId, $pinned);
        if (is_wp_error($result)) {
            \WP_CLI::error($result->get_error_code() . ': ' . $result->get_error_message());
        }
        \WP_CLI::success($pinned ? 'Release pinned.' : 'Release unpinned.');
    }

    /** Approve an exact signed script fingerprint. */
    public function approve_script(array $args): void
    {
        $fingerprint = strtolower((string) ($args[0] ?? ''));
        if (!$this->scripts->approve($fingerprint, get_current_user_id())) {
            \WP_CLI::error('The script fingerprint is invalid or unknown.');
        }
        \WP_CLI::success('Script fingerprint approved.');
    }

    /** Emit machine-readable preflight diagnostics. */
    public function doctor(array $args, array $assoc): void
    {
        global $wpdb;
        $engines = [];
        foreach ([$wpdb->posts, $wpdb->options, $wpdb->prefix . 'pagecraft_releases', $wpdb->prefix . 'pagecraft_objects'] as $table) {
            $row = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS LIKE %s', $wpdb->esc_like($table)), ARRAY_A);
            $engines[$table] = is_array($row) ? (string) ($row['Engine'] ?? '') : '';
        }
        $active = $this->releases->active();
        $seo = $this->seo->status();
        $checks = [
            'crypto' => ['ok' => function_exists('sodium_crypto_sign_verify_detached') || class_exists('ParagonIE_Sodium_Compat')],
            'root_trust' => ['ok' => RootTrust::isProvisioned($this->connection->apiOrigin())],
            'connection' => ['ok' => $this->connection->isConfigured(), 'mode' => $this->connection->mode(), 'profile' => $this->connection->profile()],
            'active_release' => ['ok' => $active !== null, 'release_id' => $active['release_id'] ?? null, 'deployment_id' => $active['deployment_id'] ?? null],
            'storage' => ['ok' => !in_array(false, array_map(static fn (string $engine): bool => strtoupper($engine) === 'INNODB', $engines), true), 'engines' => $engines],
            'cron' => ['ok' => is_int(wp_next_scheduled(Cron::SYNC_HOOK)), 'next' => wp_next_scheduled(Cron::SYNC_HOOK)],
            'seo' => $seo,
            'preflight' => $this->preflight->report([], [], isset($assoc['network'])),
        ];
        $data = ['ok' => !in_array(false, array_map(static fn (array $check): bool => (bool) ($check['ok'] ?? false), $checks), true), 'checks' => $checks];
        // Stable top-level SEO contract for Docker matrix assertions.
        $data['seo'] = $seo;
        $format = (string) ($assoc['format'] ?? 'human');
        $this->output($data, ['format' => $format]);
        if ($format !== 'json' && !$seo['ok']) {
            \WP_CLI::error('pagecraft_seo_conflict: Yoast SEO and Rank Math cannot both own Pagecraft managed metadata.', false);
            \WP_CLI::halt(1);
        }
    }

    /** @param array<string,mixed> $data @param array<string,mixed> $assoc */
    private function output(array $data, array $assoc): void
    {
        $format = (string) ($assoc['format'] ?? 'json');
        if ($format === 'json') {
            \WP_CLI::line((string) wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            return;
        }
        foreach ($data as $key => $value) {
            \WP_CLI::line($key . ': ' . (is_scalar($value) || $value === null ? (string) $value : Support::json($value)));
        }
    }
}
