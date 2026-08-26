<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Forms
{
    private const RETENTION_DAYS = 90;
    private const TRANSPORT_FIELDS = ['pagecraft_form_id', 'pagecraft_route', 'pagecraft_form_token', 'pagecraft_company'];
    private const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox'];
    private const RESERVED_FIELDS = ['action', 'form_id', '_wpnonce', '_wp_http_referer'];

    public function __construct(private readonly Connection $connection)
    {
    }

    public function hooks(): void
    {
        add_action('admin_post_nopriv_pagecraft_form_submit', [$this, 'handlePost']);
        add_action('admin_post_pagecraft_form_submit', [$this, 'handlePost']);
        add_filter('wp_privacy_personal_data_exporters', [$this, 'exporters']);
        add_filter('wp_privacy_personal_data_erasers', [$this, 'erasers']);
    }

    public function prepareHtml(string $html, string $routePath): string
    {
        $ranges = $this->formOpeningTagRanges($html);
        if ($ranges === null) {
            // Malformed markup must remain byte-for-byte inert. Staging rejects
            // malformed artifacts; this guard prevents a partial runtime edit.
            return $html;
        }
        foreach (array_reverse($ranges) as $range) {
            $opening = substr($html, $range['start'], $range['length']);
            $replacement = $this->prepareOpeningForm($opening, $routePath);
            if ($replacement !== $opening) {
                $html = substr_replace($html, $replacement, $range['start'], $range['length']);
            }
        }
        return $html;
    }

    private function prepareOpeningForm(string $opening, string $routePath): string
    {
        $formId = $this->openingTagAttribute($opening, 'data-pagecraft-form');
        if ($formId === '' && preg_match('/%%PAGECRAFT_FORM_ENDPOINT:([A-Za-z0-9._:-]+)%%/', $opening, $tokenMatch)) {
            $formId = (string) $tokenMatch[1];
        } elseif ($formId === '') {
            return $opening;
        }
        $mode = $this->openingTagAttribute($opening, 'data-pagecraft-form-mode');
        $mode = $mode !== '' ? $mode : $this->openingTagAttribute($opening, 'data-pagecraft-mode');
        if (!Support::validIdentifier($formId)
            || strtolower($mode) === 'external'
            || $this->definition($formId, Support::normalizeRoute($routePath)) === []) {
            return $opening;
        }
        $opening = $this->replaceFormTransportAttributes(
            $opening,
            rest_url('pagecraft/v1/forms/' . rawurlencode($formId))
        );
        $token = $this->token($formId, $routePath);
        return $opening
            . '<input type="hidden" name="pagecraft_form_id" value="' . esc_attr($formId) . '">'
            . '<input type="hidden" name="pagecraft_route" value="' . esc_attr(Support::normalizeRoute($routePath)) . '">'
            . '<input type="hidden" name="pagecraft_form_token" value="' . esc_attr($token) . '">'
            . '<div class="pagecraft-honeypot" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden"><label>Company<input tabindex="-1" autocomplete="off" name="pagecraft_company"></label></div>';
    }

    /**
     * Find complete, real FORM opening tags using browser-equivalent comment,
     * quoted-attribute, raw-text, and RCDATA boundaries.
     *
     * @return list<array{start:int,length:int}>|null
     */
    private function formOpeningTagRanges(string $html): ?array
    {
        $ranges = [];
        $cursor = 0;
        $length = strlen($html);
        while ($cursor < $length) {
            $opening = strpos($html, '<', $cursor);
            if ($opening === false) {
                break;
            }
            if (substr($html, $opening, 4) === '<!--') {
                $commentEnd = strpos($html, '-->', $opening + 4);
                if ($commentEnd === false) {
                    return null;
                }
                $cursor = $commentEnd + 3;
                continue;
            }
            $candidate = substr($html, $opening, 96);
            if (!preg_match('/^<\s*\/?\s*[A-Za-z][A-Za-z0-9:-]*(?=[\s\/>])/', $candidate)
                && !str_starts_with($candidate, '<!')
                && !str_starts_with($candidate, '<?')) {
                $cursor = $opening + 1;
                continue;
            }
            $tagEnd = $this->htmlTagEnd($html, $opening);
            if ($tagEnd === null) {
                return null;
            }
            $markup = substr($html, $opening, $tagEnd - $opening + 1);
            if (!preg_match('/^<\s*([A-Za-z][A-Za-z0-9:-]*)(?=[\s\/>])/', $markup, $match)) {
                $cursor = $tagEnd + 1;
                continue;
            }
            $tagName = strtolower((string) $match[1]);
            if ($tagName === 'form') {
                $ranges[] = ['start' => $opening, 'length' => $tagEnd - $opening + 1];
            }
            $cursor = $tagEnd + 1;
            if ($tagName === 'plaintext') {
                break;
            }
            if (!in_array($tagName, ['script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed', 'noframes'], true)) {
                continue;
            }
            $rawEnd = $this->rawTextElementEnd($html, $tagName, $cursor);
            if ($rawEnd === null) {
                return null;
            }
            $cursor = $rawEnd;
        }
        return $ranges;
    }

    private function rawTextElementEnd(string $html, string $tagName, int $offset): ?int
    {
        $pattern = '#</\s*' . preg_quote($tagName, '#') . '(?=[\s/>])#i';
        while (preg_match($pattern, $html, $match, PREG_OFFSET_CAPTURE, $offset)) {
            $closing = (int) $match[0][1];
            $tagEnd = $this->htmlTagEnd($html, $closing);
            if ($tagEnd === null) {
                return null;
            }
            return $tagEnd + 1;
        }
        return null;
    }

    private function htmlTagEnd(string $html, int $opening): ?int
    {
        $quote = '';
        $length = strlen($html);
        for ($index = $opening + 1; $index < $length; $index++) {
            $character = $html[$index];
            if ($quote !== '') {
                if ($character === $quote) {
                    $quote = '';
                }
                continue;
            }
            if ($character === '"' || $character === "'") {
                $quote = $character;
                continue;
            }
            if ($character === '>') {
                return $index;
            }
        }
        return null;
    }

    private function openingTagAttribute(string $opening, string $name): string
    {
        if (class_exists('WP_HTML_Tag_Processor')) {
            $processor = new \WP_HTML_Tag_Processor($opening);
            if ($processor->next_tag('FORM')) {
                $value = $processor->get_attribute($name);
                return is_string($value) ? $value : '';
            }
            return '';
        }
        if (!preg_match(
            '/\s' . preg_quote($name, '/') . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i',
            $opening,
            $match
        )) {
            return '';
        }
        return (string) (($match[1] ?? '') !== '' ? $match[1] : ((($match[2] ?? '') !== '') ? $match[2] : ($match[3] ?? '')));
    }

    private function replaceFormTransportAttributes(string $opening, string $endpoint): string
    {
        if (class_exists('WP_HTML_Tag_Processor')) {
            $processor = new \WP_HTML_Tag_Processor($opening);
            if ($processor->next_tag('FORM')) {
                $processor->remove_attribute('action');
                $processor->remove_attribute('method');
                $processor->set_attribute('action', $endpoint);
                $processor->set_attribute('method', 'post');
                return $processor->get_updated_html();
            }
        }
        $opening = (string) preg_replace(
            '/\s+(?:action|method)\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/i',
            '',
            $opening
        );
        return (string) preg_replace(
            '/\s*\/?\>$/',
            ' action="' . esc_url($endpoint) . '" method="post">',
            $opening,
            1
        );
    }

    /** @param array<string,mixed> $input @param array<string,mixed> $server @return array{submission_uuid:string,status:string}|\WP_Error */
    public function submit(array $input, array $server): array|\WP_Error
    {
        foreach (self::TRANSPORT_FIELDS as $transportField) {
            if (isset($input[$transportField]) && (is_array($input[$transportField]) || is_object($input[$transportField]))) {
                return new \WP_Error('pagecraft_form_array_field', 'Form fields must contain one scalar value.');
            }
        }
        $formId = sanitize_text_field((string) ($input['pagecraft_form_id'] ?? ''));
        $route = Support::normalizeRoute((string) ($input['pagecraft_route'] ?? '/'));
        $token = (string) ($input['pagecraft_form_token'] ?? '');
        $definition = $this->definition($formId, $route);
        if (!Support::validIdentifier($formId)
            || !hash_equals($this->token($formId, $route), $token)
            || $definition === []
            || !$this->formExists($formId, $route)) {
            return new \WP_Error('pagecraft_form_invalid', 'This form does not belong to the active Pagecraft release.');
        }
        if (trim((string) ($input['pagecraft_company'] ?? '')) !== '') {
            return new \WP_Error('pagecraft_form_rejected', 'The submission was rejected.');
        }
        $ip = (string) ($server['REMOTE_ADDR'] ?? 'unknown');
        if (!$this->allow($formId, $ip)) {
            return new \WP_Error('pagecraft_form_rate_limited', 'Too many submissions. Please wait and try again.');
        }
        $validated = $this->validatePayload($input, $definition);
        if (is_wp_error($validated)) {
            return $validated;
        }
        $payload = $validated['payload'];

        $uuid = wp_generate_uuid4();
        // Only an explicitly signed privacy=email field participates in
        // WordPress privacy export/erase lookup. Field names are never guessed.
        $email = $validated['privacy_email'];
        global $wpdb;
        $now = time();
        $stored = $wpdb->insert($wpdb->prefix . 'pagecraft_forms', [
            'submission_uuid' => $uuid,
            'form_id' => $formId,
            'route_path' => $route,
            'payload' => Crypto::seal(Support::json($payload)),
            'email_hash' => $email !== '' ? $this->emailHash($email) : null,
            'ip_hash' => hash_hmac('sha256', $ip, wp_salt('nonce')),
            'user_agent_hash' => hash('sha256', (string) ($server['HTTP_USER_AGENT'] ?? '')),
            'status' => 'received',
            'created_at' => gmdate('Y-m-d H:i:s', $now),
            'expires_at' => gmdate('Y-m-d H:i:s', $now + $this->retentionDays() * DAY_IN_SECONDS),
        ], ['%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s']);
        if ($stored === false) {
            return new \WP_Error('pagecraft_form_store', 'WordPress could not store this form submission.');
        }

        $recipients = array_values(array_filter((array) ($definition['recipients'] ?? [get_option('admin_email')]), 'is_email'));
        $subject = sanitize_text_field((string) ($definition['subject'] ?? sprintf('Pagecraft form: %s', $formId)));
        $lines = [sprintf('Route: %s', $route), sprintf('Submission: %s', $uuid), ''];
        foreach ($payload as $key => $value) {
            $lines[] = sprintf('%s: %s', $key, $value);
        }
        $mailed = $recipients !== [] && wp_mail($recipients, $subject, implode("\n", $lines));
        $wpdb->update($wpdb->prefix . 'pagecraft_forms', ['status' => $mailed ? 'mailed' : 'mail_failed'], ['submission_uuid' => $uuid], ['%s'], ['%s']);
        return ['submission_uuid' => $uuid, 'status' => $mailed ? 'mailed' : 'stored'];
    }

    public function handlePost(): void
    {
        $result = $this->submit($_POST, $_SERVER);
        $redirect = home_url(Support::normalizeRoute((string) ($_POST['pagecraft_route'] ?? '/')));
        $redirect = add_query_arg('pagecraft_form', is_wp_error($result) ? $result->get_error_code() : 'success', $redirect);
        wp_safe_redirect($redirect, 303);
        exit;
    }

    public function cleanup(): void
    {
        global $wpdb;
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}pagecraft_forms WHERE expires_at <= %s", Support::utcNow()));
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}pagecraft_rate_limits WHERE expires_at <= %s", Support::utcNow()));
    }

    public function retentionDays(): int
    {
        return max(1, min(365, (int) get_option('pagecraft_form_retention_days', self::RETENTION_DAYS)));
    }

    public function setRetentionDays(int $days): bool
    {
        return update_option('pagecraft_form_retention_days', max(1, min(365, $days)), false);
    }

    /** @return list<array<string,mixed>> */
    public function recent(int $limit = 100): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id,submission_uuid,form_id,route_path,payload,status,created_at,expires_at FROM {$wpdb->prefix}pagecraft_forms ORDER BY id DESC LIMIT %d",
            max(1, min(250, $limit))
        ), ARRAY_A);
        foreach ((array) $rows as &$row) {
            try {
                $row['fields'] = Support::decodeObject(Crypto::open((string) $row['payload']));
            } catch (\RuntimeException) {
                $row['fields'] = ['notice' => 'Encrypted submission could not be opened.'];
            }
            unset($row['payload']);
        }
        unset($row);
        return is_array($rows) ? $rows : [];
    }

    /** @param array<string,mixed> $exporters @return array<string,mixed> */
    public function exporters(array $exporters): array
    {
        $exporters['pagecraft-forms'] = ['exporter_friendly_name' => __('Pagecraft form submissions', 'pagecraft-connector'), 'callback' => [$this, 'export']];
        return $exporters;
    }

    /** @return array{data:list<array<string,mixed>>,done:bool} */
    public function export(string $email, int $page = 1): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pagecraft_forms WHERE email_hash = %s ORDER BY id ASC LIMIT 100 OFFSET %d",
            $this->emailHash($email), max(0, ($page - 1) * 100)
        ), ARRAY_A);
        $data = [];
        foreach ((array) $rows as $row) {
            try {
                $payload = Support::decodeObject(Crypto::open((string) $row['payload']));
            } catch (\RuntimeException) {
                $payload = ['notice' => 'Encrypted submission could not be opened.'];
            }
            $data[] = [
                'group_id' => 'pagecraft-forms',
                'group_label' => __('Pagecraft form submissions', 'pagecraft-connector'),
                'item_id' => 'pagecraft-form-' . (int) $row['id'],
                'data' => array_map(static fn (string $key, mixed $value): array => ['name' => $key, 'value' => (string) $value], array_keys($payload), $payload),
            ];
        }
        return ['data' => $data, 'done' => count((array) $rows) < 100];
    }

    /** @param array<string,mixed> $erasers @return array<string,mixed> */
    public function erasers(array $erasers): array
    {
        $erasers['pagecraft-forms'] = ['eraser_friendly_name' => __('Pagecraft form submissions', 'pagecraft-connector'), 'callback' => [$this, 'erase']];
        return $erasers;
    }

    /** @return array{items_removed:bool,items_retained:bool,messages:list<string>,done:bool} */
    public function erase(string $email, int $page = 1): array
    {
        global $wpdb;
        $removed = $wpdb->delete($wpdb->prefix . 'pagecraft_forms', ['email_hash' => $this->emailHash($email)], ['%s']);
        return ['items_removed' => (int) $removed > 0, 'items_retained' => false, 'messages' => [], 'done' => true];
    }

    private function token(string $formId, string $route): string
    {
        $release = (string) get_option('pagecraft_active_release_id', '');
        return hash_hmac('sha256', $release . "\0" . $formId . "\0" . Support::normalizeRoute($route), wp_salt('nonce'));
    }

    private function allow(string $formId, string $ip): bool
    {
        global $wpdb;
        $table = $wpdb->prefix . 'pagecraft_rate_limits';
        $key = hash_hmac('sha256', $formId . "\0" . $ip, wp_salt('nonce'));
        $now = Support::utcNow();
        $expires = gmdate('Y-m-d H:i:s', time() + 10 * MINUTE_IN_SECONDS);
        $wpdb->query($wpdb->prepare(
            "INSERT INTO {$table} (key_hash,window_start,hits,expires_at) VALUES (%s,%s,1,%s)
             ON DUPLICATE KEY UPDATE hits = IF(expires_at <= VALUES(window_start),1,hits + 1),
             window_start = IF(expires_at <= VALUES(window_start),VALUES(window_start),window_start),
             expires_at = IF(expires_at <= VALUES(window_start),VALUES(expires_at),expires_at)",
            $key, $now, $expires
        ));
        return (int) $wpdb->get_var($wpdb->prepare("SELECT hits FROM {$table} WHERE key_hash = %s", $key)) <= (int) apply_filters('pagecraft_connector_form_rate_limit', 5);
    }

    private function formExists(string $formId, string $route): bool
    {
        $releaseId = (string) get_option('pagecraft_active_release_id', '');
        global $wpdb;
        $body = $wpdb->get_var($wpdb->prepare(
            "SELECT body_html FROM {$wpdb->prefix}pagecraft_routes WHERE release_id = %s AND route_path = %s LIMIT 1",
            $releaseId, $route
        ));
        return is_string($body) && (
            (bool) preg_match('/\bdata-pagecraft-form\s*=\s*(["\'])' . preg_quote($formId, '/') . '\1/i', $body)
            || str_contains($body, '%%PAGECRAFT_FORM_ENDPOINT:' . $formId . '%%')
        );
    }

    /**
     * @param array<string,mixed> $input
     * @param array<string,mixed> $definition
     * @return array{payload:array<string,string>,privacy_email:string}|\WP_Error
     */
    private function validatePayload(array $input, array $definition): array|\WP_Error
    {
        $fields = self::normalizeFields($definition['fields'] ?? null);
        if (is_wp_error($fields)) {
            return $fields;
        }
        $byName = [];
        foreach ($fields as $field) {
            $byName[$field['name']] = $field;
        }
        foreach ($input as $rawKey => $value) {
            $key = (string) $rawKey;
            if (in_array($key, self::TRANSPORT_FIELDS, true)) {
                if (is_array($value)) {
                    return new \WP_Error('pagecraft_form_array_field', 'Form fields must contain one scalar value.');
                }
                continue;
            }
            if ($key === ''
                || str_starts_with(strtolower($key), 'pagecraft_')
                || in_array(strtolower($key), self::RESERVED_FIELDS, true)) {
                return new \WP_Error('pagecraft_form_reserved_field', 'The form submission contains a reserved field name.');
            }
            if (!isset($byName[$key])) {
                return new \WP_Error('pagecraft_form_unknown_field', sprintf('The field “%s” is not part of the signed form definition.', sanitize_text_field($key)));
            }
            if (is_array($value) || is_object($value)) {
                return new \WP_Error('pagecraft_form_array_field', sprintf('The field “%s” must contain one scalar value.', sanitize_text_field($key)));
            }
        }

        $payload = [];
        $privacyEmail = '';
        $total = 0;
        foreach ($fields as $field) {
            $name = $field['name'];
            $present = array_key_exists($name, $input);
            $value = $present ? (string) wp_unslash($input[$name]) : '';
            $clean = $field['type'] === 'textarea' ? sanitize_textarea_field($value) : sanitize_text_field($value);
            $required = $field['required'];
            if (!$present || trim($clean) === '') {
                if ($required) {
                    return new \WP_Error('pagecraft_form_required', sprintf('Complete the required field “%s”.', $name));
                }
                continue;
            }

            $limit = match ($field['type']) {
                'email' => 320,
                'tel' => 64,
                'number' => 128,
                'textarea' => 20000,
                default => 2000,
            };
            if (strlen($clean) > $limit) {
                return new \WP_Error('pagecraft_form_field_too_large', sprintf('The field “%s” is too long.', $name));
            }
            if ($field['type'] === 'email' && !is_email($clean)) {
                return new \WP_Error('pagecraft_form_email', sprintf('Enter a valid email address for “%s”.', $name));
            }
            if ($field['type'] === 'tel') {
                $digits = preg_replace('/\D+/', '', $clean);
                if (!preg_match('/^\+?[0-9][0-9().\- xX]*$/', $clean)
                    || !is_string($digits)
                    || strlen($digits) < 3
                    || strlen($digits) > 20) {
                    return new \WP_Error('pagecraft_form_tel', sprintf('Enter a valid telephone number for “%s”.', $name));
                }
            }
            if ($field['type'] === 'number'
                && (!preg_match('/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/', $clean)
                    || !is_finite((float) $clean))) {
                return new \WP_Error('pagecraft_form_number', sprintf('Enter a valid number for “%s”.', $name));
            }
            if ($field['type'] === 'select' && !in_array($clean, $field['options'], true)) {
                return new \WP_Error('pagecraft_form_option', sprintf('Choose a valid option for “%s”.', $name));
            }
            if ($field['type'] === 'checkbox') {
                $allowed = $field['options'] !== [] ? $field['options'] : ['1', 'on', 'true', 'yes'];
                if (!in_array($clean, $allowed, true)) {
                    return new \WP_Error('pagecraft_form_checkbox', sprintf('The checkbox value for “%s” is invalid.', $name));
                }
            }
            $total += strlen($name) + strlen($clean);
            if ($total > 100000) {
                return new \WP_Error('pagecraft_form_too_large', 'The form submission is too large.');
            }
            $payload[$name] = $clean;
            if ($field['privacy'] === 'email') {
                $privacyEmail = strtolower($clean);
            }
        }
        if ($payload === []) {
            return new \WP_Error('pagecraft_form_empty', 'Complete at least one form field.');
        }
        return ['payload' => $payload, 'privacy_email' => $privacyEmail];
    }

    /**
     * @return list<array{name:string,type:string,required:bool,options:list<string>,privacy:string}>|\WP_Error
     */
    public static function normalizeFields(mixed $rawFields): array|\WP_Error
    {
        if (!is_array($rawFields) || $rawFields === [] || count($rawFields) > 50) {
            return new \WP_Error('pagecraft_form_definition_fields', 'The signed form definition has no valid field list.');
        }
        $fields = [];
        $seen = [];
        $privacyEmailSeen = false;
        foreach ($rawFields as $rawField) {
            if (!is_array($rawField)) {
                return new \WP_Error('pagecraft_form_definition_field', 'The signed form definition contains an invalid field.');
            }
            $name = (string) ($rawField['name'] ?? '');
            $type = (string) ($rawField['type'] ?? '');
            $privacy = (string) ($rawField['privacy'] ?? '');
            if (array_key_exists('required', $rawField) && !is_bool($rawField['required'])) {
                return new \WP_Error('pagecraft_form_definition_field', 'The signed form definition contains an invalid required flag.');
            }
            $required = ($rawField['required'] ?? false) === true;
            $seenKey = strtolower($name);
            if (!preg_match('/^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/', $name)
                || str_starts_with(strtolower($name), 'pagecraft_')
                || in_array(strtolower($name), self::RESERVED_FIELDS, true)
                || isset($seen[$seenKey])
                || !in_array($type, self::FIELD_TYPES, true)
                || !in_array($privacy, ['', 'email'], true)
                || ($privacy === 'email' && ($type !== 'email' || $privacyEmailSeen))) {
                return new \WP_Error('pagecraft_form_definition_field', 'The signed form definition contains an invalid or duplicate field.');
            }
            $options = [];
            if (array_key_exists('options', $rawField)) {
                if (!is_array($rawField['options']) || count($rawField['options']) > 100) {
                    return new \WP_Error('pagecraft_form_definition_options', 'The signed form definition contains invalid options.');
                }
                foreach ($rawField['options'] as $option) {
                    if (!is_string($option) || $option === '' || strlen($option) > 500 || in_array($option, $options, true)) {
                        return new \WP_Error('pagecraft_form_definition_options', 'The signed form definition contains invalid options.');
                    }
                    $options[] = $option;
                }
            }
            if ($type === 'select' && $options === []) {
                return new \WP_Error('pagecraft_form_definition_options', 'A signed select field requires at least one option.');
            }
            if (!in_array($type, ['select', 'checkbox'], true) && $options !== []) {
                return new \WP_Error('pagecraft_form_definition_options', 'Only select and checkbox fields may declare options.');
            }
            $fields[] = compact('name', 'type', 'required', 'options', 'privacy');
            $seen[$seenKey] = true;
            $privacyEmailSeen = $privacyEmailSeen || $privacy === 'email';
        }
        return $fields;
    }

    /** @return list<array<string,mixed>>|\WP_Error */
    public static function validateDefinitions(mixed $rawDefinitions): array|\WP_Error
    {
        if (!is_array($rawDefinitions) || count($rawDefinitions) > 1000) {
            return new \WP_Error('pagecraft_form_definitions', 'The signed release form definition list is invalid or too large.');
        }
        $definitions = [];
        $seen = [];
        foreach ($rawDefinitions as $definition) {
            if (!is_array($definition)) {
                return new \WP_Error('pagecraft_form_definition', 'The signed release contains an invalid form definition.');
            }
            $formId = (string) ($definition['id'] ?? $definition['formId'] ?? '');
            $routeRaw = $definition['routePath'] ?? null;
            $method = $definition['method'] ?? null;
            if (!Support::validIdentifier($formId)
                || !is_string($routeRaw)
                || !str_starts_with($routeRaw, '/')
                || strlen($routeRaw) > 191
                || !is_string($method)
                || strtoupper($method) !== 'POST') {
                return new \WP_Error('pagecraft_form_definition', 'A signed form has an invalid ID, route, or method.');
            }
            $route = Support::normalizeRoute($routeRaw);
            $routeParts = wp_parse_url($routeRaw);
            if (!is_array($routeParts)
                || isset($routeParts['scheme'])
                || isset($routeParts['host'])
                || isset($routeParts['query'])
                || isset($routeParts['fragment'])) {
                return new \WP_Error('pagecraft_form_definition', 'A signed form route must be a local path without query or fragment.');
            }
            $key = strtolower($formId) . "\0" . $route;
            if (isset($seen[$key])) {
                return new \WP_Error('pagecraft_form_definition', 'The signed release contains a duplicate form definition.');
            }
            $fields = self::normalizeFields($definition['fields'] ?? null);
            if (is_wp_error($fields)) {
                return $fields;
            }
            if (isset($definition['recipients'])) {
                if (!is_array($definition['recipients']) || count($definition['recipients']) > 20) {
                    return new \WP_Error('pagecraft_form_definition_notification', 'A signed form contains an invalid notification recipient list.');
                }
                foreach ($definition['recipients'] as $recipient) {
                    if (!is_string($recipient) || !is_email($recipient)) {
                        return new \WP_Error('pagecraft_form_definition_notification', 'A signed form contains an invalid notification recipient.');
                    }
                }
            }
            if (isset($definition['subject']) && (!is_string($definition['subject']) || strlen($definition['subject']) > 500)) {
                return new \WP_Error('pagecraft_form_definition_notification', 'A signed form contains an invalid notification subject.');
            }
            $definitions[] = $definition;
            $seen[$key] = true;
        }
        return $definitions;
    }

    /** @return array<string,mixed> */
    private function definition(string $formId, string $route): array
    {
        $release = pagecraft_get_active_release();
        foreach ((array) ($release['manifest']['forms'] ?? []) as $definition) {
            if (is_array($definition)
                && (string) ($definition['id'] ?? $definition['formId'] ?? '') === $formId
                && Support::normalizeRoute((string) ($definition['routePath'] ?? '')) === $route
                && strtoupper((string) ($definition['method'] ?? 'POST')) === 'POST'
                && !is_wp_error(self::normalizeFields($definition['fields'] ?? null))) {
                return $definition;
            }
        }
        return [];
    }

    private function emailHash(string $email): string
    {
        return hash_hmac('sha256', strtolower(trim($email)), wp_salt('secure_auth'));
    }
}
