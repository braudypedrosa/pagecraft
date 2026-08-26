<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Cron
{
    public const SYNC_HOOK = 'pagecraft_connector_sync';
    public const JOB_HOOK = 'pagecraft_connector_process_release';
    public const CLEANUP_HOOK = 'pagecraft_connector_cleanup';
    public const CMS_DRAFT_HOOK = 'pagecraft_connector_cms_drafts';

    public function __construct(
        private readonly Sync $sync,
        private readonly ReleaseRepository $releases,
        private readonly Forms $forms,
        private readonly CmsWriteback $cms
    ) {
    }

    public function hooks(): void
    {
        add_filter('cron_schedules', [$this, 'schedules']);
        add_action(self::SYNC_HOOK, [$this, 'sync']);
        add_action(self::JOB_HOOK, [$this, 'sync']);
        add_action(self::CLEANUP_HOOK, [$this, 'cleanup']);
        add_action(self::CMS_DRAFT_HOOK, [$this->cms, 'process']);
        add_action('init', [$this, 'ensureScheduled']);
    }

    /** @param array<string,array<string,mixed>> $schedules @return array<string,array<string,mixed>> */
    public function schedules(array $schedules): array
    {
        $schedules['pagecraft_fifteen_minutes'] = ['interval' => 15 * MINUTE_IN_SECONDS, 'display' => __('Every 15 minutes', 'pagecraft-connector')];
        return $schedules;
    }

    public function ensureScheduled(): void
    {
        if (!wp_next_scheduled(self::SYNC_HOOK)) {
            wp_schedule_event(time() + 5 * MINUTE_IN_SECONDS, 'pagecraft_fifteen_minutes', self::SYNC_HOOK);
        }
        if (!wp_next_scheduled(self::CLEANUP_HOOK)) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', self::CLEANUP_HOOK);
        }
    }

    public function sync(): void
    {
        update_option('pagecraft_cron_heartbeat', ['started_at' => time(), 'status' => 'running'], false);
        $result = $this->sync->run(false);
        update_option('pagecraft_cron_heartbeat', [
            'started_at' => (int) (get_option('pagecraft_cron_heartbeat', [])['started_at'] ?? time()),
            'finished_at' => time(),
            'status' => is_wp_error($result) ? 'failed' : 'complete',
            'error_code' => is_wp_error($result) ? $result->get_error_code() : null,
        ], false);
    }

    public function cleanup(): void
    {
        $this->forms->cleanup();
        $this->sync->retainReleases(5);
    }

    /** @return array<string,int|false> */
    public function nextRuns(): array
    {
        return [
            'sync' => wp_next_scheduled(self::SYNC_HOOK),
            'cleanup' => wp_next_scheduled(self::CLEANUP_HOOK),
            'cms_drafts' => wp_next_scheduled(self::CMS_DRAFT_HOOK),
        ];
    }
}
