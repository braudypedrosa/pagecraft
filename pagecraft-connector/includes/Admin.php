<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Admin
{
    public function __construct(
        private readonly Connection $connection,
        private readonly ReleaseRepository $releases,
        private readonly Sync $sync,
        private readonly ScriptApprovals $scripts,
        private readonly HttpClient $http,
        private readonly Forms $forms,
        private readonly Mapper $mapper,
        private readonly Preflight $preflight,
        private readonly Revocation $revocation,
        private readonly PairingConfirmation $pairingConfirmation
    ) {
    }

    public function hooks(): void
    {
        add_action('admin_menu', [$this, 'menu']);
        add_action('admin_enqueue_scripts', [$this, 'assets']);
        add_action('admin_notices', [$this, 'notices']);
        foreach (['pair', 'pairing_callback', 'pairing_retry', 'pairing_abort', 'sync', 'mode', 'disconnect', 'rollback', 'pin', 'script', 'retention', 'route_decision', 'activate_theme'] as $action) {
            add_action('admin_post_pagecraft_' . $action, [$this, $this->handler($action)]);
        }
    }

    public function menu(): void
    {
        add_menu_page(__('Pagecraft', 'pagecraft-connector'), __('Pagecraft', 'pagecraft-connector'), Capabilities::VIEW, 'pagecraft', [$this, 'dashboard'], 'dashicons-layout', 58);
        add_submenu_page('pagecraft', __('Operate', 'pagecraft-connector'), __('Operate', 'pagecraft-connector'), Capabilities::VIEW, 'pagecraft', [$this, 'dashboard']);
        add_submenu_page('pagecraft', __('Editor', 'pagecraft-connector'), __('Editor', 'pagecraft-connector'), 'manage_options', 'pagecraft-editor', [$this, 'editor']);
        add_submenu_page('pagecraft', __('Form submissions', 'pagecraft-connector'), __('Form submissions', 'pagecraft-connector'), 'manage_options', 'pagecraft-forms', [$this, 'forms']);
    }

    public function assets(string $hook): void
    {
        if (!str_contains($hook, 'pagecraft')) {
            return;
        }
        wp_enqueue_style('pagecraft-connector-admin', PAGECRAFT_CONNECTOR_URL . 'assets/admin.css', [], PAGECRAFT_CONNECTOR_VERSION);
        wp_enqueue_script('pagecraft-connector-admin', PAGECRAFT_CONNECTOR_URL . 'assets/admin.js', [], PAGECRAFT_CONNECTOR_VERSION, true);
    }

    public function dashboard(): void
    {
        if (!current_user_can(Capabilities::VIEW)) {
            wp_die(esc_html__('You cannot view Pagecraft status.', 'pagecraft-connector'));
        }
        $active = $this->releases->active();
        $lastSync = get_option('pagecraft_last_sync', []);
        $mode = $this->connection->mode();
        echo '<div class="wrap pagecraft-admin"><header class="pagecraft-admin__mast"><div><p class="pagecraft-eyebrow">' . esc_html__('Operate', 'pagecraft-connector') . '</p><h1>' . esc_html__('Pagecraft Connector', 'pagecraft-connector') . '</h1><p>' . esc_html__('Pagecraft publishes signed releases; WordPress verifies, stages, and activates them.', 'pagecraft-connector') . '</p></div><span class="pagecraft-state pagecraft-state--' . esc_attr($mode) . '">' . esc_html(ucfirst($mode)) . '</span></header>';
        echo '<div class="pagecraft-grid">';
        $connectionStatus = $this->revocation->isPending()
            ? __('Server revocation pending', 'pagecraft-connector')
            : ($this->pairingConfirmation->isPending()
                ? __('Server confirmation pending', 'pagecraft-connector')
                : ($this->connection->isConfigured() ? sprintf('%s · %s', $this->connection->siteId(), $this->connection->profile()) : __('Not paired', 'pagecraft-connector')));
        $this->card(__('Connection', 'pagecraft-connector'), $connectionStatus);
        $this->card(__('Active release', 'pagecraft-connector'), $active ? sprintf('%s · target %d', $active['release_id'], $active['sequence']) : __('No active release', 'pagecraft-connector'));
        $this->card(__('Last synchronization', 'pagecraft-connector'), is_array($lastSync) && isset($lastSync['at']) ? sprintf('%s · %s', (string) ($lastSync['status'] ?? ''), (string) $lastSync['at']) : __('Not run yet', 'pagecraft-connector'));
        echo '</div>';

        if ($this->revocation->isPending()) {
            $this->revocationPanel();
            $this->releaseTable();
        } elseif (!$this->connection->isConfigured()) {
            $this->pairingPanel();
        } else {
            $this->controls($mode);
            $this->profileSetup();
            $this->routeConflicts();
            $this->releaseTable();
            $this->scriptTable();
        }
        echo '</div>';
    }

    private function profileSetup(): void
    {
        if ($this->connection->profile() !== 'pagecraft-theme' || get_stylesheet() === 'pagecraft') {
            return;
        }
        echo '<section class="pagecraft-panel"><h2>' . esc_html__('Pagecraft Theme activation required', 'pagecraft-connector') . '</h2><p>' . esc_html__('This connection is bound to the Pagecraft Theme profile, but another theme is active. Synchronization is blocked until an administrator explicitly activates the installed Pagecraft theme.', 'pagecraft-connector') . '</p>';
        if (current_user_can('switch_themes') && wp_get_theme('pagecraft')->exists()) {
            $this->actionButton('pagecraft_activate_theme', 'pagecraft_activate_theme', __('Activate Pagecraft Theme', 'pagecraft-connector'), 'primary');
        } else {
            echo '<p><strong>' . esc_html__('Install the Pagecraft theme directory as “pagecraft” first.', 'pagecraft-connector') . '</strong></p>';
        }
        echo '</section>';
    }

    private function revocationPanel(): void
    {
        $pending = $this->revocation->pending();
        echo '<section class="pagecraft-panel"><h2>' . esc_html__('Server revocation pending', 'pagecraft-connector') . '</h2><p>' . esc_html__('The verified active release remains frozen and public. Encrypted scoped credentials are retained only to retry the exact idempotent Pagecraft revocation request.', 'pagecraft-connector') . '</p>';
        if (!empty($pending['last_error_message'])) {
            echo '<p><strong>' . esc_html__('Last error:', 'pagecraft-connector') . '</strong> ' . esc_html((string) $pending['last_error_message']) . '</p>';
        }
        if (current_user_can(Capabilities::MANAGE)) {
            $this->actionButton(
                'pagecraft_disconnect',
                'pagecraft_disconnect',
                __('Retry server revocation', 'pagecraft-connector'),
                'primary',
                [],
                __('Retry the pending Pagecraft server revocation now? The active release will remain frozen.', 'pagecraft-connector')
            );
        }
        echo '</section>';
    }

    private function routeConflicts(): void
    {
        $conflicts = $this->mapper->conflicts();
        if ($conflicts === []) {
            return;
        }
        echo '<section class="pagecraft-panel"><h2>' . esc_html__('Route decisions required', 'pagecraft-connector') . '</h2><p>' . esc_html__('These choices are local to this WordPress target and remain in effect for later releases. Rewrite-owned routes can be kept in WordPress or mapped elsewhere; only an unmanaged WordPress Page can be safely replaced.', 'pagecraft-connector') . '</p><table class="widefat striped"><thead><tr><th>' . esc_html__('Pagecraft route', 'pagecraft-connector') . '</th><th>' . esc_html__('WordPress owner', 'pagecraft-connector') . '</th><th>' . esc_html__('Decision', 'pagecraft-connector') . '</th></tr></thead><tbody>';
        foreach ($conflicts as $conflict) {
            $route = (string) ($conflict['route'] ?? '/');
            $owner = (string) ($conflict['title'] ?? 'WordPress route');
            $postId = (int) ($conflict['post_id'] ?? 0);
            $ownerHtml = $postId > 0
                ? '<a href="' . esc_url(get_edit_post_link($postId, '')) . '">' . esc_html($owner) . '</a>'
                : esc_html($owner);
            $mappedRoute = (string) ($conflict['mapped_route'] ?? $route);
            if ($mappedRoute !== $route) {
                $ownerHtml .= '<br><code>' . esc_html($mappedRoute) . '</code>';
            }
            $ownerHtml .= '<br><small>' . esc_html((string) ($conflict['owner_type'] ?? 'rewrite')) . '</small>';
            echo '<tr><td><code>' . esc_html($route) . '</code></td><td>' . $ownerHtml . '</td><td><div class="pagecraft-table-actions">';
            $decisions = ['keep' => __('Keep WordPress', 'pagecraft-connector')];
            if (!empty($conflict['replace_allowed'])) {
                $decisions['replace'] = __('Replace with Pagecraft', 'pagecraft-connector');
            }
            foreach ($decisions as $decision => $label) {
                $confirm = $decision === 'replace'
                    ? sprintf(__('Replace the WordPress page at %s with the Pagecraft route on the next activation? The previous release remains available for rollback.', 'pagecraft-connector'), $route)
                    : '';
                $this->actionButton('pagecraft_route_decision', 'pagecraft_route_decision', $label, '', ['route' => $route, 'decision' => $decision], $confirm);
            }
            echo '<form class="pagecraft-inline" method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="pagecraft_route_decision"><input type="hidden" name="route" value="' . esc_attr($route) . '"><input type="hidden" name="decision" value="map">';
            wp_nonce_field('pagecraft_route_decision');
            $mapId = 'pagecraft-map-' . substr(hash('sha256', $route), 0, 10);
            $mapLabel = sprintf(__('New WordPress path for Pagecraft route %s', 'pagecraft-connector'), $route);
            echo '<label class="screen-reader-text" for="' . esc_attr($mapId) . '">' . esc_html($mapLabel) . '</label><input required id="' . esc_attr($mapId) . '" name="path" aria-label="' . esc_attr($mapLabel) . '" placeholder="/pagecraft-' . esc_attr(trim($route, '/') ?: 'home') . '/"><button class="button">' . esc_html__('Map elsewhere', 'pagecraft-connector') . '</button></form></div></td></tr>';
        }
        echo '</tbody></table></section>';
    }

    private function pairingPanel(): void
    {
        if (!current_user_can(Capabilities::MANAGE)) {
            return;
        }
        if ($this->pairingConfirmation->isPending()) {
            if ($this->connection->pairingAuthorizationPending()
                && !$this->connection->pairingExchangePending()
                && !$this->connection->pairingConfirmationPending()) {
                echo '<section class="pagecraft-panel"><h2>' . esc_html__('Pagecraft authorization pending', 'pagecraft-connector') . '</h2><p>' . esc_html__('Complete the open Pagecraft consent, or cancel this exact authorization before starting again.', 'pagecraft-connector') . '</p>';
                $this->actionButton(
                    'pagecraft_disconnect',
                    'pagecraft_disconnect',
                    __('Cancel pending authorization', 'pagecraft-connector'),
                    'link-delete',
                    [],
                    __('Cancel this Pagecraft authorization? Its original callback will no longer be accepted.', 'pagecraft-connector')
                );
                echo '</section>';
                return;
            }
            $pending = $this->connection->pairingConfirmation();
            if ($pending === []) {
                $pending = $this->connection->pairingExchange();
            }
            echo '<section class="pagecraft-panel"><h2>' . esc_html__('Pairing recovery pending', 'pagecraft-connector') . '</h2><p>' . esc_html__('WordPress retained the authorization transaction securely. Retry the exact token exchange and server confirmation instead of starting another connection.', 'pagecraft-connector') . '</p>';
            if (!empty($pending['last_error_message'])) {
                echo '<p><strong>' . esc_html__('Last error:', 'pagecraft-connector') . '</strong> ' . esc_html((string) $pending['last_error_message']) . '</p>';
            }
            $this->actionButton('pagecraft_pairing_retry', 'pagecraft_pairing_retry', __('Retry pairing', 'pagecraft-connector'), 'primary');
            if ($this->connection->pairingExchangeAbandonable()) {
                $this->actionButton(
                    'pagecraft_pairing_abort',
                    'pagecraft_pairing_abort',
                    __('Abort expired pairing and restart', 'pagecraft-connector'),
                    'link-delete',
                    [],
                    __('Permanently remove the expired encrypted authorization transaction and start a new Pagecraft consent?', 'pagecraft-connector')
                );
            }
            echo '</section>';
            return;
        }
        echo '<section class="pagecraft-panel"><h2>' . esc_html__('Connect WordPress', 'pagecraft-connector') . '</h2><p>' . esc_html__('Choose the deployment profile explicitly. You will approve the target inside Pagecraft.', 'pagecraft-connector') . '</p><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('pagecraft_pair');
        echo '<input type="hidden" name="action" value="pagecraft_pair"><div class="pagecraft-fields">';
        echo '<label><span>' . esc_html__('Pagecraft API origin', 'pagecraft-connector') . '</span><input required type="url" name="api_origin" value="https://build.itspagecraft.com"></label>';
        echo '<label><span>' . esc_html__('Site ID (optional)', 'pagecraft-connector') . '</span><input name="site_id" autocomplete="off"></label>';
        echo '<label><span>' . esc_html__('Profile', 'pagecraft-connector') . '</span><select required name="profile"><option value="" selected disabled>' . esc_html__('Choose a profile', 'pagecraft-connector') . '</option><option value="existing-theme">' . esc_html__('Existing Theme', 'pagecraft-connector') . '</option><option value="pagecraft-theme">' . esc_html__('Pagecraft Theme', 'pagecraft-connector') . '</option></select></label>';
        echo '<label><span>' . esc_html__('Deployment target', 'pagecraft-connector') . '</span><select required name="environment"><option value="" selected disabled>' . esc_html__('Choose a target', 'pagecraft-connector') . '</option><option value="staging">' . esc_html__('Staging', 'pagecraft-connector') . '</option><option value="production">' . esc_html__('Production', 'pagecraft-connector') . '</option></select></label>';
        echo '</div><p><label><input type="checkbox" name="confirm_existing_theme" value="1"> ' . esc_html__('For Existing Theme profile, I confirm the current WordPress theme must remain active.', 'pagecraft-connector') . '</label></p><p><button class="button button-primary">' . esc_html__('Continue to Pagecraft', 'pagecraft-connector') . '</button></p></form></section>';
    }

    private function controls(string $mode): void
    {
        echo '<section class="pagecraft-panel"><div class="pagecraft-panel__head"><div><h2>' . esc_html__('Deployment controls', 'pagecraft-connector') . '</h2><p>' . esc_html__('Pause stops automatic pulls. Disconnect freezes the last active release and removes credentials.', 'pagecraft-connector') . '</p></div><div class="pagecraft-actions">';
        if (current_user_can(Capabilities::SYNC)) {
            $this->actionButton('pagecraft_sync', 'pagecraft_sync', __('Sync now', 'pagecraft-connector'), 'primary');
        }
        if (current_user_can(Capabilities::MANAGE)) {
            $next = $mode === 'connected' ? 'paused' : 'connected';
            $this->actionButton('pagecraft_mode', 'pagecraft_mode', $next === 'paused' ? __('Pause', 'pagecraft-connector') : __('Resume', 'pagecraft-connector'), '', ['mode' => $next]);
            $this->actionButton(
                'pagecraft_disconnect',
                'pagecraft_disconnect',
                __('Disconnect and freeze', 'pagecraft-connector'),
                'link-delete',
                [],
                __('Disconnect Pagecraft and remove the stored connection credentials? The current verified release will remain frozen and public.', 'pagecraft-connector')
            );
        }
        echo '</div></div></section>';
    }

    private function releaseTable(): void
    {
        $rows = $this->releases->list();
        echo '<section class="pagecraft-panel"><h2>' . esc_html__('Release history', 'pagecraft-connector') . '</h2><table class="widefat striped"><thead><tr><th>' . esc_html__('Release', 'pagecraft-connector') . '</th><th>' . esc_html__('Target', 'pagecraft-connector') . '</th><th>' . esc_html__('Status', 'pagecraft-connector') . '</th><th>' . esc_html__('Installed', 'pagecraft-connector') . '</th><th>' . esc_html__('Actions', 'pagecraft-connector') . '</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            echo '<tr><td><code>' . esc_html((string) $row['release_id']) . '</code></td><td>' . (int) $row['sequence'] . '</td><td>' . esc_html((string) $row['status']) . ($row['pinned'] ? ' · ' . esc_html__('pinned', 'pagecraft-connector') : '') . '</td><td>' . esc_html((string) ($row['installed_at'] ?? '—')) . '</td><td><div class="pagecraft-table-actions">';
            if (current_user_can(Capabilities::ROLLBACK) && !empty($row['verified_at']) && in_array($row['status'], ['active', 'retained'], true)) {
                $this->actionButton(
                    'pagecraft_rollback',
                    'pagecraft_rollback',
                    __('Rollback', 'pagecraft-connector'),
                    '',
                    ['deployment_id' => $row['deployment_id']],
                    sprintf(__('Emergency rollback to release %s and pause automatic synchronization?', 'pagecraft-connector'), (string) $row['release_id'])
                );
            }
            if (current_user_can(Capabilities::ROLLBACK)) {
                $this->actionButton('pagecraft_pin', 'pagecraft_pin', $row['pinned'] ? __('Unpin', 'pagecraft-connector') : __('Pin', 'pagecraft-connector'), '', ['deployment_id' => $row['deployment_id'], 'pinned' => $row['pinned'] ? '0' : '1']);
            }
            echo '</div></td></tr>';
        }
        if ($rows === []) {
            echo '<tr><td colspan="5">' . esc_html__('No signed releases have been installed.', 'pagecraft-connector') . '</td></tr>';
        }
        echo '</tbody></table></section>';
    }

    private function scriptTable(): void
    {
        $rows = $this->scripts->all();
        echo '<section class="pagecraft-panel"><h2>' . esc_html__('Script fingerprints', 'pagecraft-connector') . '</h2><p>' . esc_html__('A staged release cannot activate until every executable fingerprint is approved locally.', 'pagecraft-connector') . '</p><table class="widefat striped"><thead><tr><th>' . esc_html__('Label', 'pagecraft-connector') . '</th><th>' . esc_html__('Fingerprint', 'pagecraft-connector') . '</th><th>' . esc_html__('State', 'pagecraft-connector') . '</th><th>' . esc_html__('Action', 'pagecraft-connector') . '</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            $approved = !empty($row['approved_at']) && empty($row['revoked_at']);
            echo '<tr><td>' . esc_html((string) $row['label']) . '</td><td><code>' . esc_html((string) $row['fingerprint']) . '</code></td><td>' . esc_html($approved ? __('Approved', 'pagecraft-connector') : __('Not approved', 'pagecraft-connector')) . '</td><td>';
            if (current_user_can(Capabilities::APPROVE_SCRIPTS)) {
                $this->actionButton('pagecraft_script', 'pagecraft_script', $approved ? __('Revoke', 'pagecraft-connector') : __('Approve', 'pagecraft-connector'), '', ['fingerprint' => $row['fingerprint'], 'decision' => $approved ? 'revoke' : 'approve']);
            }
            echo '</td></tr>';
        }
        if ($rows === []) {
            echo '<tr><td colspan="4">' . esc_html__('No executable scripts have been staged.', 'pagecraft-connector') . '</td></tr>';
        }
        echo '</tbody></table></section>';
    }

    public function editor(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Only administrators can mint a Pagecraft editor session.', 'pagecraft-connector'));
        }
        $postId = absint($_GET['post_id'] ?? 0);
        $pageId = $postId > 0 ? (string) get_post_meta($postId, '_pagecraft_page_id', true) : sanitize_text_field((string) wp_unslash($_GET['page_id'] ?? ''));
        $session = $this->http->mintEditorSession($pageId);
        echo '<div class="wrap pagecraft-admin pagecraft-editor"><header class="pagecraft-admin__mast"><div><p class="pagecraft-eyebrow">' . esc_html__('Editor session', 'pagecraft-connector') . '</p><h1>' . esc_html__('Edit in Pagecraft', 'pagecraft-connector') . '</h1></div><a class="button" href="' . esc_url(admin_url('admin.php?page=pagecraft')) . '">' . esc_html__('Back to Operate', 'pagecraft-connector') . '</a></header>';
        if (is_wp_error($session)) {
            echo '<div class="notice notice-error inline"><p>' . esc_html($session->get_error_message()) . '</p></div></div>';
            return;
        }
        echo '<iframe class="pagecraft-editor__frame" title="' . esc_attr__('Pagecraft editor', 'pagecraft-connector') . '" src="' . esc_url($session['url']) . '" referrerpolicy="origin" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups"></iframe></div>';
    }

    public function forms(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Only administrators can view private form submissions.', 'pagecraft-connector'));
        }
        echo '<div class="wrap pagecraft-admin"><header class="pagecraft-admin__mast"><div><p class="pagecraft-eyebrow">' . esc_html__('Private data', 'pagecraft-connector') . '</p><h1>' . esc_html__('Pagecraft form submissions', 'pagecraft-connector') . '</h1><p>' . esc_html__('Payloads are encrypted at rest and automatically removed after the configured retention period.', 'pagecraft-connector') . '</p></div></header>';
        echo '<section class="pagecraft-panel"><form class="pagecraft-actions" method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="pagecraft_retention">';
        wp_nonce_field('pagecraft_retention');
        echo '<label><strong>' . esc_html__('Retention days', 'pagecraft-connector') . '</strong> <input type="number" min="1" max="365" name="days" value="' . (int) $this->forms->retentionDays() . '"></label><button class="button button-primary">' . esc_html__('Save retention', 'pagecraft-connector') . '</button></form></section>';
        echo '<section class="pagecraft-panel"><div class="pagecraft-table-scroll" role="region" tabindex="0" aria-label="' . esc_attr__('Pagecraft form submissions', 'pagecraft-connector') . '"><table class="widefat striped pagecraft-submissions"><thead><tr><th>' . esc_html__('Received', 'pagecraft-connector') . '</th><th>' . esc_html__('Form / route', 'pagecraft-connector') . '</th><th>' . esc_html__('Fields', 'pagecraft-connector') . '</th><th>' . esc_html__('State / expiry', 'pagecraft-connector') . '</th></tr></thead><tbody>';
        $rows = $this->forms->recent();
        foreach ($rows as $row) {
            echo '<tr><td>' . esc_html((string) $row['created_at']) . '<br><code>' . esc_html((string) $row['submission_uuid']) . '</code></td><td><strong>' . esc_html((string) $row['form_id']) . '</strong><br>' . esc_html((string) $row['route_path']) . '</td><td><pre>' . esc_html(Support::json($row['fields'])) . '</pre></td><td>' . esc_html((string) $row['status']) . '<br>' . esc_html((string) $row['expires_at']) . '</td></tr>';
        }
        if ($rows === []) {
            echo '<tr><td colspan="4">' . esc_html__('No retained submissions.', 'pagecraft-connector') . '</td></tr>';
        }
        echo '</tbody></table></div></section></div>';
    }

    public function pair(): void
    {
        $this->guard(Capabilities::MANAGE, 'pagecraft_pair');
        try {
            $apiOrigin = (string) wp_unslash($_POST['api_origin'] ?? '');
            $profile = sanitize_key((string) wp_unslash($_POST['profile'] ?? ''));
            $environment = sanitize_key((string) wp_unslash($_POST['environment'] ?? ''));
            if ($profile === 'existing-theme' && (string) ($_POST['confirm_existing_theme'] ?? '') !== '1') {
                throw new \RuntimeException('Confirm that the incumbent WordPress theme will remain active for Existing Theme profile.');
            }
            $ready = $this->preflight->pairing($apiOrigin, $profile, $environment);
            if (is_wp_error($ready)) {
                throw new \RuntimeException($ready->get_error_message());
            }
            $pairing = $this->pairingConfirmation->begin(
                $apiOrigin,
                sanitize_text_field((string) wp_unslash($_POST['site_id'] ?? '')),
                $profile,
                $environment
            );
            if (is_wp_error($pairing)) {
                throw new \RuntimeException($pairing->get_error_message());
            }
            wp_redirect($pairing['authorize_url'], 302, 'Pagecraft Connector'); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
            exit;
        } catch (\RuntimeException $error) {
            $this->bounce('error', $error->getMessage());
        }
    }

    public function pairingCallback(): void
    {
        if (!current_user_can(Capabilities::MANAGE)) {
            wp_die(esc_html__('You cannot connect Pagecraft.', 'pagecraft-connector'));
        }
        try {
            $state = (string) wp_unslash($_GET['state'] ?? '');
            $code = (string) wp_unslash($_GET['code'] ?? '');
            if ($state === '' || $code === '') {
                throw new \RuntimeException('Pagecraft did not return a complete authorization response.');
            }
            $confirmed = $this->pairingConfirmation->consumeAndRetry($state, $code);
            if (is_wp_error($confirmed)) {
                throw new \RuntimeException($confirmed->get_error_message());
            }
            $this->bounce('success', __('Pagecraft is connected. The first signed release will synchronize shortly.', 'pagecraft-connector'));
        } catch (\RuntimeException $error) {
            $this->bounce('error', $error->getMessage());
        }
    }

    public function pairingRetry(): void
    {
        $this->guard(Capabilities::MANAGE, 'pagecraft_pairing_retry');
        $result = $this->pairingConfirmation->retry();
        $this->bounce(
            is_wp_error($result) ? 'error' : 'success',
            is_wp_error($result)
                ? $result->get_error_message()
                : __('Pagecraft pairing recovered and confirmed.', 'pagecraft-connector')
        );
    }

    public function pairingAbort(): void
    {
        $this->guard(Capabilities::MANAGE, 'pagecraft_pairing_abort');
        $result = $this->pairingConfirmation->abandon('administrator');
        $this->bounce(
            is_wp_error($result) ? 'error' : 'success',
            is_wp_error($result)
                ? $result->get_error_message()
                : __('The expired Pagecraft pairing transaction was removed and audited. You can start pairing again.', 'pagecraft-connector')
        );
    }

    public function sync(): void
    {
        $this->guard(Capabilities::SYNC, 'pagecraft_sync');
        $result = $this->sync->run(true);
        $this->bounce(is_wp_error($result) ? 'error' : 'success', is_wp_error($result) ? $result->get_error_message() : sprintf(__('Synchronization finished: %s.', 'pagecraft-connector'), (string) ($result['status'] ?? 'ok')));
    }

    public function mode(): void
    {
        $this->guard(Capabilities::MANAGE, 'pagecraft_mode');
        $mode = sanitize_key((string) wp_unslash($_POST['mode'] ?? ''));
        $updated = $mode === 'connected'
            ? $this->connection->resume('administrator')
            : $this->connection->setMode($mode);
        $this->bounce($updated ? 'success' : 'error', $mode === 'paused' ? __('Automatic synchronization paused.', 'pagecraft-connector') : __('Connected synchronization resumed.', 'pagecraft-connector'));
    }

    public function disconnect(): void
    {
        $this->guard(Capabilities::MANAGE, 'pagecraft_disconnect');
        $result = $this->revocation->begin();
        $this->bounce(
            is_wp_error($result) ? 'error' : 'success',
            is_wp_error($result)
                ? $result->get_error_message()
                : __('Disconnected and revoked on Pagecraft. The last active release remains frozen and public.', 'pagecraft-connector')
        );
    }

    public function rollback(): void
    {
        $this->guard(Capabilities::ROLLBACK, 'pagecraft_rollback');
        $result = $this->sync->emergencyRollback(sanitize_text_field((string) wp_unslash($_POST['deployment_id'] ?? '')));
        $this->bounce(is_wp_error($result) ? 'error' : 'success', is_wp_error($result) ? $result->get_error_message() : __('Rollback activated and synchronization paused.', 'pagecraft-connector'));
    }

    public function pin(): void
    {
        $this->guard(Capabilities::ROLLBACK, 'pagecraft_pin');
        $ok = $this->sync->pinRelease(sanitize_text_field((string) wp_unslash($_POST['deployment_id'] ?? '')), (string) ($_POST['pinned'] ?? '') === '1');
        $this->bounce(!is_wp_error($ok) ? 'success' : 'error', !is_wp_error($ok) ? __('Release retention updated.', 'pagecraft-connector') : $ok->get_error_message());
    }

    public function script(): void
    {
        $this->guard(Capabilities::APPROVE_SCRIPTS, 'pagecraft_script');
        $fingerprint = strtolower(sanitize_text_field((string) wp_unslash($_POST['fingerprint'] ?? '')));
        $approve = (string) ($_POST['decision'] ?? '') === 'approve';
        $ok = $approve ? $this->scripts->approve($fingerprint, get_current_user_id()) : $this->scripts->revoke($fingerprint);
        if ($ok && $approve) {
            foreach ($this->releases->list() as $release) {
                if ($release['status'] === 'needs_approval') {
                    $this->sync->activatePending((string) $release['deployment_id']);
                }
            }
        }
        $this->bounce($ok ? 'success' : 'error', $ok ? __('Script approval updated.', 'pagecraft-connector') : __('Script approval could not be updated.', 'pagecraft-connector'));
    }

    public function retention(): void
    {
        $this->guard('manage_options', 'pagecraft_retention');
        $this->forms->setRetentionDays(absint($_POST['days'] ?? 90));
        set_transient('pagecraft_notice_' . get_current_user_id(), ['type' => 'success', 'message' => __('Form retention updated.', 'pagecraft-connector')], MINUTE_IN_SECONDS);
        wp_safe_redirect(admin_url('admin.php?page=pagecraft-forms'));
        exit;
    }

    public function routeDecision(): void
    {
        $this->guard(Capabilities::MANAGE, 'pagecraft_route_decision');
        $ok = $this->mapper->setDecision(
            (string) wp_unslash($_POST['route'] ?? '/'),
            sanitize_key((string) wp_unslash($_POST['decision'] ?? '')),
            (string) wp_unslash($_POST['path'] ?? '')
        );
        $this->bounce($ok ? 'success' : 'error', $ok ? __('Route decision saved. Ask Pagecraft to issue a new target sequence, then sync.', 'pagecraft-connector') : __('The route decision is invalid.', 'pagecraft-connector'));
    }

    public function activateTheme(): void
    {
        $this->guard('switch_themes', 'pagecraft_activate_theme');
        if ($this->connection->profile() !== 'pagecraft-theme' || !wp_get_theme('pagecraft')->exists()) {
            $this->bounce('error', __('The Pagecraft theme is not installed or this connection uses another profile.', 'pagecraft-connector'));
        }
        $compatible = $this->preflight->pagecraftThemeCompatibility('pagecraft-theme');
        if (is_wp_error($compatible)) {
            $this->bounce('error', $compatible->get_error_message());
        }
        switch_theme('pagecraft');
        $this->bounce(get_stylesheet() === 'pagecraft' ? 'success' : 'error', get_stylesheet() === 'pagecraft' ? __('Pagecraft Theme activated.', 'pagecraft-connector') : __('WordPress could not activate Pagecraft Theme.', 'pagecraft-connector'));
    }

    public function notices(): void
    {
        $notice = get_transient('pagecraft_notice_' . get_current_user_id());
        if (!is_array($notice)) {
            return;
        }
        delete_transient('pagecraft_notice_' . get_current_user_id());
        echo '<div class="notice notice-' . esc_attr((string) ($notice['type'] ?? 'info')) . ' is-dismissible"><p>' . esc_html((string) ($notice['message'] ?? '')) . '</p></div>';
    }

    private function handler(string $action): string
    {
        return lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $action))));
    }

    private function guard(string $capability, string $nonce): void
    {
        if (!current_user_can($capability)) {
            wp_die(esc_html__('You do not have permission to perform this Pagecraft action.', 'pagecraft-connector'));
        }
        check_admin_referer($nonce);
    }

    /** @param array<string,string|int> $fields */
    private function actionButton(string $action, string $nonce, string $label, string $class = '', array $fields = [], string $confirm = ''): void
    {
        echo '<form class="pagecraft-inline" method="post" action="' . esc_url(admin_url('admin-post.php')) . '"' . ($confirm !== '' ? ' data-pagecraft-confirm="' . esc_attr($confirm) . '"' : '') . '><input type="hidden" name="action" value="' . esc_attr($action) . '">';
        wp_nonce_field($nonce);
        foreach ($fields as $key => $value) {
            echo '<input type="hidden" name="' . esc_attr($key) . '" value="' . esc_attr((string) $value) . '">';
        }
        echo '<button class="button ' . esc_attr($class === 'primary' ? 'button-primary' : $class) . '">' . esc_html($label) . '</button></form>';
    }

    private function card(string $label, string $value): void
    {
        echo '<section class="pagecraft-card"><span>' . esc_html($label) . '</span><strong>' . esc_html($value) . '</strong></section>';
    }

    private function bounce(string $type, string $message): never
    {
        set_transient('pagecraft_notice_' . get_current_user_id(), ['type' => $type, 'message' => $message], MINUTE_IN_SECONDS);
        wp_safe_redirect(admin_url('admin.php?page=pagecraft'));
        exit;
    }
}
