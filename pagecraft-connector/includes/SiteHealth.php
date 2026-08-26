<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class SiteHealth
{
    public function __construct(
        private readonly Connection $connection,
        private readonly ReleaseRepository $releases,
        private readonly Cron $cron,
        private readonly ReleaseVerifier $verifier,
        private readonly Preflight $preflight
    ) {
    }

    public function hooks(): void
    {
        add_filter('site_status_tests', [$this, 'tests']);
        add_filter('debug_information', [$this, 'debug']);
    }

    /** @param array<string,mixed> $tests @return array<string,mixed> */
    public function tests(array $tests): array
    {
        $tests['direct']['pagecraft_crypto'] = ['label' => __('Pagecraft signing support', 'pagecraft-connector'), 'test' => [$this, 'crypto']];
        $tests['direct']['pagecraft_connection'] = ['label' => __('Pagecraft connection', 'pagecraft-connector'), 'test' => [$this, 'connection']];
        $tests['direct']['pagecraft_release'] = ['label' => __('Pagecraft active release', 'pagecraft-connector'), 'test' => [$this, 'release']];
        $tests['direct']['pagecraft_cron'] = ['label' => __('Pagecraft synchronization schedule', 'pagecraft-connector'), 'test' => [$this, 'cron']];
        $tests['direct']['pagecraft_preflight'] = ['label' => __('Pagecraft deployment readiness', 'pagecraft-connector'), 'test' => [$this, 'preflight']];
        return $tests;
    }

    /** @return array<string,mixed> */
    public function crypto(): array
    {
        $ready = $this->verifier->available() && RootTrust::isProvisioned($this->connection->apiOrigin());
        return $this->result(
            'pagecraft_crypto',
            $ready,
            $ready ? __('Pagecraft signatures can be verified', 'pagecraft-connector') : __('Pagecraft trust material is not ready', 'pagecraft-connector'),
            $ready ? __('Ed25519 support and a pinned Pagecraft root key are available.', 'pagecraft-connector') : __('Provision the offline-generated Pagecraft root public key in this plugin build and ensure Sodium is available.', 'pagecraft-connector')
        );
    }

    /** @return array<string,mixed> */
    public function connection(): array
    {
        $data = $this->connection->publicData();
        $ready = $this->connection->isConfigured() && empty($data['origin_changed']);
        return $this->result('pagecraft_connection', $ready, $ready ? __('Pagecraft is connected', 'pagecraft-connector') : __('Pagecraft needs connection attention', 'pagecraft-connector'), $ready ? sprintf(__('Mode: %s. Profile: %s.', 'pagecraft-connector'), $this->connection->mode(), $this->connection->profile()) : __('Pair Pagecraft or rebind the WordPress origin. A frozen active release remains available offline.', 'pagecraft-connector'));
    }

    /** @return array<string,mixed> */
    public function release(): array
    {
        $release = $this->releases->active();
        return $this->result('pagecraft_release', $release !== null, $release ? __('A verified Pagecraft release is active', 'pagecraft-connector') : __('No Pagecraft release is active', 'pagecraft-connector'), $release ? sprintf(__('Release %1$s, target sequence %2$d.', 'pagecraft-connector'), $release['release_id'], $release['sequence']) : __('WordPress will continue using its native theme and content until a signed release activates.', 'pagecraft-connector'), $release === null ? 'recommended' : 'good');
    }

    /** @return array<string,mixed> */
    public function cron(): array
    {
        $next = $this->cron->nextRuns()['sync'];
        $ready = is_int($next) && $next > time() - HOUR_IN_SECONDS;
        return $this->result('pagecraft_cron', $ready, $ready ? __('Pagecraft polling is scheduled', 'pagecraft-connector') : __('Pagecraft polling is not scheduled', 'pagecraft-connector'), $ready ? sprintf(__('Next reconciliation: %s.', 'pagecraft-connector'), wp_date('Y-m-d H:i:s T', $next)) : __('Visit the Pagecraft Operate screen or repair WP-Cron.', 'pagecraft-connector'));
    }

    /** @return array<string,mixed> */
    public function preflight(): array
    {
        $report = $this->preflight->report([], [], false);
        $failed = [];
        foreach ($report['checks'] as $code => $check) {
            if (!empty($check['blocking']) && empty($check['ok'])) {
                $failed[] = (string) $code;
            }
        }
        return $this->result(
            'pagecraft_preflight',
            (bool) $report['ok'],
            $report['ok'] ? __('WordPress is ready for Pagecraft deployment', 'pagecraft-connector') : __('Pagecraft deployment preflight has blockers', 'pagecraft-connector'),
            $report['ok'] ? __('Origin, storage, rewrites, cron, and rendering profile checks passed.', 'pagecraft-connector') : sprintf(__('Blocking checks: %s.', 'pagecraft-connector'), implode(', ', $failed))
        );
    }

    /** @param array<string,mixed> $debug @return array<string,mixed> */
    public function debug(array $debug): array
    {
        $active = $this->releases->active();
        $debug['pagecraft-connector'] = [
            'label' => __('Pagecraft Connector', 'pagecraft-connector'),
            'fields' => [
                'version' => ['label' => __('Version', 'pagecraft-connector'), 'value' => PAGECRAFT_CONNECTOR_VERSION],
                'mode' => ['label' => __('Mode', 'pagecraft-connector'), 'value' => $this->connection->mode()],
                'profile' => ['label' => __('Profile', 'pagecraft-connector'), 'value' => $this->connection->profile() ?: 'unpaired'],
                'release' => ['label' => __('Active release', 'pagecraft-connector'), 'value' => $active['release_id'] ?? 'none'],
                'last_sync' => ['label' => __('Last sync', 'pagecraft-connector'), 'value' => Support::json(get_option('pagecraft_last_sync', [])), 'private' => true],
            ],
        ];
        return $debug;
    }

    /** @return array<string,mixed> */
    private function result(string $test, bool $ok, string $label, string $description, string $failureStatus = 'critical'): array
    {
        return [
            'label' => $label,
            'status' => $ok ? 'good' : $failureStatus,
            'badge' => ['label' => __('Pagecraft', 'pagecraft-connector'), 'color' => 'blue'],
            'description' => '<p>' . esc_html($description) . '</p>',
            'actions' => '<p><a href="' . esc_url(admin_url('admin.php?page=pagecraft')) . '">' . esc_html__('Open Pagecraft Operate', 'pagecraft-connector') . '</a></p>',
            'test' => $test,
        ];
    }
}
