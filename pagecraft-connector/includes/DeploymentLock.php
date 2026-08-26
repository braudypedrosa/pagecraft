<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/**
 * Owner-token deployment lease with a monotonically increasing fence.
 *
 * The option row is retained after release so every new owner receives a
 * strictly newer fence. Production uses an atomic compare-and-swap against the
 * exact serialized option value; closures are accepted only to make race and
 * expiry behavior deterministic in unit tests.
 */
final class DeploymentLock
{
    private const OPTION = 'pagecraft_deployment_lock';
    private const LEASE_SECONDS = 300;

    private readonly \Closure $reader;
    private readonly \Closure $compareAndSwap;
    private readonly \Closure $clock;
    private readonly string $optionName;

    public function __construct(?\Closure $reader = null, ?\Closure $compareAndSwap = null, ?\Closure $clock = null, string $optionName = self::OPTION)
    {
        $this->optionName = sanitize_key($optionName) ?: self::OPTION;
        $this->reader = $reader ?? fn (): array => $this->readOption();
        $this->compareAndSwap = $compareAndSwap ?? fn (?string $expected, array $next): bool => $this->swapOption($expected, $next);
        $this->clock = $clock ?? static fn (): int => time();
    }

    /** @return array{token:string,fence:int,purpose:string,expires:int}|\WP_Error */
    public function acquire(string $purpose): array|\WP_Error
    {
        $purpose = sanitize_key($purpose);
        if ($purpose === '') {
            return new \WP_Error('pagecraft_deployment_lock_purpose', 'A deployment lock purpose is required.');
        }
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $snapshot = ($this->reader)();
            $state = is_array($snapshot['state'] ?? null) ? $snapshot['state'] : [];
            $raw = isset($snapshot['raw']) && is_string($snapshot['raw']) ? $snapshot['raw'] : null;
            $now = ($this->clock)();
            if ((string) ($state['token'] ?? '') !== '' && (int) ($state['expires'] ?? 0) > $now) {
                return new \WP_Error('pagecraft_sync_locked', sprintf(
                    'Another Pagecraft deployment operation (%s) is already running.',
                    sanitize_text_field((string) ($state['purpose'] ?? 'deployment'))
                ));
            }
            $next = [
                'token' => Support::base64UrlEncode(random_bytes(18)),
                'fence' => max(0, (int) ($state['fence'] ?? 0)) + 1,
                'purpose' => $purpose,
                'expires' => $now + self::LEASE_SECONDS,
            ];
            if (($this->compareAndSwap)($raw, $next)) {
                return $next;
            }
        }
        return new \WP_Error('pagecraft_sync_locked', 'Another Pagecraft deployment operation won the lock race.');
    }

    /** @param array{token:string,fence:int,purpose:string,expires:int} $lease @return array{token:string,fence:int,purpose:string,expires:int}|\WP_Error */
    public function renew(array $lease): array|\WP_Error
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $snapshot = ($this->reader)();
            $state = is_array($snapshot['state'] ?? null) ? $snapshot['state'] : [];
            $raw = isset($snapshot['raw']) && is_string($snapshot['raw']) ? $snapshot['raw'] : null;
            $valid = $this->matches($state, $lease, true);
            if (is_wp_error($valid)) {
                return $valid;
            }
            $next = $lease;
            $next['expires'] = ($this->clock)() + self::LEASE_SECONDS;
            if (($this->compareAndSwap)($raw, $next)) {
                return $next;
            }
        }
        return new \WP_Error('pagecraft_deployment_lock_lost', 'The Pagecraft deployment lock changed while its lease was being renewed.');
    }

    /** @param array{token:string,fence:int,purpose:string,expires:int} $lease @return true|\WP_Error */
    public function assertOwned(array $lease): bool|\WP_Error
    {
        $snapshot = ($this->reader)();
        $state = is_array($snapshot['state'] ?? null) ? $snapshot['state'] : [];
        return $this->matches($state, $lease, true);
    }

    /** @param array{token:string,fence:int,purpose:string,expires:int} $lease */
    public function release(array $lease): void
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $snapshot = ($this->reader)();
            $state = is_array($snapshot['state'] ?? null) ? $snapshot['state'] : [];
            $raw = isset($snapshot['raw']) && is_string($snapshot['raw']) ? $snapshot['raw'] : null;
            if (is_wp_error($this->matches($state, $lease, false))) {
                return;
            }
            $released = ['token' => '', 'fence' => (int) $lease['fence'], 'purpose' => '', 'expires' => 0];
            if (($this->compareAndSwap)($raw, $released)) {
                return;
            }
        }
    }

    /** @param array<string,mixed> $state @param array<string,mixed> $lease @return true|\WP_Error */
    private function matches(array $state, array $lease, bool $requireUnexpired): bool|\WP_Error
    {
        $token = (string) ($lease['token'] ?? '');
        $same = $token !== ''
            && (int) ($state['fence'] ?? 0) === (int) ($lease['fence'] ?? -1)
            && hash_equals((string) ($state['token'] ?? ''), $token);
        if (!$same || ($requireUnexpired && (int) ($state['expires'] ?? 0) <= ($this->clock)())) {
            return new \WP_Error('pagecraft_deployment_lock_lost', 'The Pagecraft deployment lock expired or was fenced by another operation.');
        }
        return true;
    }

    /** @return array{raw:?string,state:array<string,mixed>} */
    private function readOption(): array
    {
        global $wpdb;
        $raw = $wpdb->get_var($wpdb->prepare(
            "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1",
            $this->optionName
        ));
        if (!is_string($raw)) {
            return ['raw' => null, 'state' => []];
        }
        $state = maybe_unserialize($raw);
        return ['raw' => $raw, 'state' => is_array($state) ? $state : []];
    }

    /** @param array<string,mixed> $next */
    private function swapOption(?string $expected, array $next): bool
    {
        global $wpdb;
        $encoded = maybe_serialize($next);
        if ($expected === null) {
            $inserted = $wpdb->insert(
                $wpdb->options,
                ['option_name' => $this->optionName, 'option_value' => $encoded, 'autoload' => 'no'],
                ['%s', '%s', '%s']
            );
            if ($inserted === false) {
                return false;
            }
        } else {
            $updated = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->options} SET option_value = %s, autoload = 'no' WHERE option_name = %s AND option_value = %s",
                $encoded,
                $this->optionName,
                $expected
            ));
            if ($updated !== 1) {
                return false;
            }
        }
        wp_cache_delete($this->optionName, 'options');
        wp_cache_delete('alloptions', 'options');
        return true;
    }
}
