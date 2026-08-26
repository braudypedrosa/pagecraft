<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class RestApi
{
    public function __construct(
        private readonly Connection $connection,
        private readonly ReleaseVerifier $verifier,
        private readonly Sync $sync,
        private readonly Forms $forms
    ) {
    }

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'register']);
    }

    public function register(): void
    {
        register_rest_route('pagecraft/v1', '/releases/available', [
            'methods' => 'POST',
            'callback' => [$this, 'releaseAvailable'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route('pagecraft/v1', '/forms/(?P<form_id>[A-Za-z0-9._:-]+)', [
            'methods' => 'POST',
            'callback' => [$this, 'submitForm'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route('pagecraft/v1', '/status', [
            'methods' => 'GET',
            'callback' => [$this, 'status'],
            'permission_callback' => static fn (): bool => current_user_can(Capabilities::VIEW),
        ]);
    }

    public function releaseAvailable(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
    {
        if (!$this->connection->isConfigured()) {
            return new \WP_Error('pagecraft_not_connected', 'Pagecraft is not connected.', ['status' => 403]);
        }
        $raw = (string) $request->get_body();
        $signature = (string) $request->get_header('x-pagecraft-signature');
        $keyId = (string) $request->get_header('x-pagecraft-key-id');
        $contentHash = strtolower((string) $request->get_header('x-pagecraft-content-sha256'));
        $headerEventId = (string) $request->get_header('x-pagecraft-event-id');
        $headerTimestamp = (string) $request->get_header('x-pagecraft-timestamp');
        $event = $this->verifier->verifyWebhook($raw, $signature, $keyId);
        if (is_wp_error($event)) {
            $event->add_data(['status' => 401]);
            return $event;
        }
        if (!preg_match('/^[a-f0-9]{64}$/', $contentHash)
            || !hash_equals($contentHash, hash('sha256', $raw))
            || !hash_equals($headerEventId, (string) $event['eventId'])
            || !hash_equals($headerTimestamp, (string) $event['occurredAt'])) {
            return new \WP_Error('pagecraft_webhook_headers', 'The signed webhook headers do not match its canonical body.', ['status' => 401]);
        }
        global $wpdb;
        $table = $wpdb->prefix . 'pagecraft_events';
        $existing = $wpdb->get_row($wpdb->prepare("SELECT body_hash FROM {$table} WHERE event_id = %s", (string) $event['eventId']), ARRAY_A);
        $bodyHash = hash('sha256', $raw);
        if (is_array($existing)) {
            if (!hash_equals((string) $existing['body_hash'], $bodyHash)) {
                return new \WP_Error('pagecraft_webhook_collision', 'A webhook event ID was reused with different signed bytes.', ['status' => 409]);
            }
            return new \WP_REST_Response(['status' => 'duplicate'], 200);
        }
        $connectionId = $this->connection->connectionId();
        $latest = (new ReleaseRepository())->latest($connectionId);
        $lastQueued = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT MAX(sequence_no) FROM {$table} WHERE connection_id = %s",
            $connectionId
        ));
        $lastSeen = max((int) ($latest['sequence'] ?? 0), $lastQueued);
        if ((int) $event['sequence'] <= $lastSeen) {
            return new \WP_Error('pagecraft_webhook_stale', 'The webhook target sequence is stale.', ['status' => 409]);
        }
        $now = Support::utcNow();
        $stored = $wpdb->insert($table, [
            'event_id' => (string) $event['eventId'],
            'connection_id' => (string) $event['connectionId'],
            'release_id' => (string) $event['releaseId'],
            'sequence_no' => (int) $event['sequence'],
            'body_hash' => $bodyHash,
            'status' => 'queued',
            'attempts' => 0,
            'available_at' => $now,
            'lease_until' => null,
            'received_at' => $now,
            'error_message' => null,
        ], ['%s', '%s', '%s', '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%s']);
        if ($stored === false) {
            $raced = $wpdb->get_row($wpdb->prepare("SELECT body_hash FROM {$table} WHERE event_id = %s", (string) $event['eventId']), ARRAY_A);
            if (is_array($raced) && hash_equals((string) $raced['body_hash'], $bodyHash)) {
                return new \WP_REST_Response(['status' => 'duplicate'], 200);
            }
            return new \WP_Error('pagecraft_webhook_store', 'WordPress could not queue the signed release event.', ['status' => 500]);
        }
        if (!wp_next_scheduled(Cron::JOB_HOOK)) {
            wp_schedule_single_event(time() + 1, Cron::JOB_HOOK);
        }
        return new \WP_REST_Response(['status' => 'queued'], 202);
    }

    public function submitForm(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
    {
        $input = $request->get_params();
        $input['pagecraft_form_id'] = (string) $request['form_id'];
        unset($input['form_id']);
        $result = $this->forms->submit($input, $_SERVER);
        if (is_wp_error($result)) {
            $result->add_data(['status' => $result->get_error_code() === 'pagecraft_form_rate_limited' ? 429 : 400]);
            return $result;
        }
        $accept = strtolower((string) $request->get_header('accept'));
        if (str_contains($accept, 'text/html')) {
            $redirect = home_url(Support::normalizeRoute((string) ($input['pagecraft_route'] ?? '/')));
            $response = new \WP_REST_Response(null, 303);
            $response->header('Location', esc_url_raw(add_query_arg('pagecraft_form', 'success', $redirect)));
            return $response;
        }
        return new \WP_REST_Response($result, 201);
    }

    public function status(): \WP_REST_Response
    {
        $release = pagecraft_get_active_release();
        return new \WP_REST_Response([
            'mode' => $this->connection->mode(),
            'connection' => $this->connection->publicData(),
            'activeRelease' => $release,
            'lastSync' => get_option('pagecraft_last_sync', null),
        ], 200);
    }
}
