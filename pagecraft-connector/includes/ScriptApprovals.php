<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class ScriptApprovals
{
    /** @param array<string,mixed> $script */
    public function register(array $script): void
    {
        global $wpdb;
        $fingerprint = strtolower((string) ($script['fingerprint'] ?? ''));
        if (!preg_match('/^[a-f0-9]{64}$/', $fingerprint)) {
            return;
        }
        $table = $wpdb->prefix . 'pagecraft_script_approvals';
        $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$table} (fingerprint,label,first_seen) VALUES (%s,%s,%s)",
            $fingerprint,
            sanitize_text_field((string) ($script['label'] ?? 'Pagecraft script')),
            Support::utcNow()
        ));
    }

    public function isApproved(string $fingerprint): bool
    {
        global $wpdb;
        $table = $wpdb->prefix . 'pagecraft_script_approvals';
        $value = $wpdb->get_var($wpdb->prepare(
            "SELECT approved_at FROM {$table} WHERE fingerprint = %s AND approved_at IS NOT NULL AND revoked_at IS NULL",
            strtolower($fingerprint)
        ));
        return is_string($value) && $value !== '';
    }

    public function approve(string $fingerprint, int $userId): bool
    {
        global $wpdb;
        if (!preg_match('/^[a-f0-9]{64}$/', $fingerprint)) {
            return false;
        }
        return false !== $wpdb->update(
            $wpdb->prefix . 'pagecraft_script_approvals',
            ['approved_at' => Support::utcNow(), 'approved_by' => $userId, 'revoked_at' => null],
            ['fingerprint' => $fingerprint],
            ['%s', '%d', '%s'],
            ['%s']
        );
    }

    public function revoke(string $fingerprint): bool
    {
        global $wpdb;
        return false !== $wpdb->update(
            $wpdb->prefix . 'pagecraft_script_approvals',
            ['revoked_at' => Support::utcNow()],
            ['fingerprint' => strtolower($fingerprint)],
            ['%s'],
            ['%s']
        );
    }

    /** @return list<array<string,mixed>> */
    public function all(): array
    {
        global $wpdb;
        $rows = $wpdb->get_results("SELECT fingerprint,label,first_seen,approved_at,approved_by,revoked_at FROM {$wpdb->prefix}pagecraft_script_approvals ORDER BY first_seen DESC", ARRAY_A);
        return is_array($rows) ? $rows : [];
    }
}
