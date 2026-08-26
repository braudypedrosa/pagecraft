<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Activation
{
    public static function activate(): void
    {
        if (is_multisite()) {
            deactivate_plugins(plugin_basename(PAGECRAFT_CONNECTOR_FILE));
            wp_die(esc_html__('Pagecraft Connector v1 supports single-site WordPress installations only.', 'pagecraft-connector'));
        }
        if (version_compare(PHP_VERSION, '8.1', '<')) {
            deactivate_plugins(plugin_basename(PAGECRAFT_CONNECTOR_FILE));
            wp_die(esc_html__('Pagecraft Connector requires PHP 8.1 or later.', 'pagecraft-connector'));
        }

        if (!Schema::install()) {
            deactivate_plugins(plugin_basename(PAGECRAFT_CONNECTOR_FILE));
            wp_die(esc_html__('Pagecraft Connector could not create and verify its required database schema. No Connected operation was enabled.', 'pagecraft-connector'));
        }
        Capabilities::install();
        add_filter('cron_schedules', [self::class, 'schedules']);
        if (!wp_next_scheduled(Cron::SYNC_HOOK)) {
            wp_schedule_event(time() + 300, 'pagecraft_fifteen_minutes', Cron::SYNC_HOOK);
        }
        if (!wp_next_scheduled(Cron::CLEANUP_HOOK)) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', Cron::CLEANUP_HOOK);
        }
        remove_filter('cron_schedules', [self::class, 'schedules']);

        add_option('pagecraft_active_release_id', '', '', false);
        add_option('pagecraft_mode', 'frozen', '', false);
        add_option('pagecraft_installation_id', wp_generate_uuid4(), '', false);
        add_option('pagecraft_installed_at', time(), '', false);
    }

    public static function deactivate(): void
    {
        wp_clear_scheduled_hook(Cron::SYNC_HOOK);
        wp_clear_scheduled_hook(Cron::JOB_HOOK);
        wp_clear_scheduled_hook(Cron::CLEANUP_HOOK);
        wp_clear_scheduled_hook(Cron::CMS_DRAFT_HOOK);
        wp_clear_scheduled_hook(Revocation::RETRY_HOOK);
        wp_clear_scheduled_hook(PairingConfirmation::RETRY_HOOK);
        delete_option('pagecraft_sync_lock');
        flush_rewrite_rules(false);
    }

    /** @param array<string,array<string,mixed>> $schedules @return array<string,array<string,mixed>> */
    public static function schedules(array $schedules): array
    {
        $schedules['pagecraft_fifteen_minutes'] = [
            'interval' => 15 * MINUTE_IN_SECONDS,
            'display' => __('Every 15 minutes', 'pagecraft-connector'),
        ];
        return $schedules;
    }
}
