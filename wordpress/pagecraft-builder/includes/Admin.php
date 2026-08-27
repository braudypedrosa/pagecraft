<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class Admin
{
    public const MENU_SLUG = 'pagecraft';
    public const EDITOR_SLUG = 'pagecraft-editor';

    public function register(): void
    {
        add_action('admin_menu', [$this, 'menus']);
        add_action('admin_enqueue_scripts', [$this, 'assets']);
        add_action('wp_ajax_pagecraft_editor_frame', [$this, 'editorFrame']);
        add_action('admin_post_pagecraft_prepare_page', [$this, 'preparePage']);
        add_action('admin_post_pagecraft_create_page', [$this, 'createPage']);
        add_action('admin_post_pagecraft_upload_page', [$this, 'uploadPage']);
        add_action('admin_post_pagecraft_add_page_to_menu', [$this, 'addPageToMenu']);
        add_action('admin_post_pagecraft_cloud_start', [$this, 'cloudStart']);
        add_action('admin_post_pagecraft_cloud_callback', [$this, 'cloudCallback']);
        add_action('admin_post_pagecraft_cloud_disconnect', [$this, 'cloudDisconnect']);
        add_action('admin_post_pagecraft_cloud_import', [$this, 'cloudImport']);
        add_filter('manage_pages_columns', [$this, 'columns']);
        add_action('manage_pages_custom_column', [$this, 'column'], 10, 2);
        add_filter('page_row_actions', [$this, 'rowActions'], 10, 2);
        add_filter('views_edit-page', [$this, 'pageViews']);
        add_action('pre_get_posts', [$this, 'filterPages']);
    }

    public function menus(): void
    {
        add_menu_page(
            __('Pagecraft', 'pagecraft-builder'),
            __('Pagecraft', 'pagecraft-builder'),
            Capabilities::EDIT,
            self::MENU_SLUG,
            [$this, 'overview'],
            'dashicons-layout',
            25
        );
        add_submenu_page(self::MENU_SLUG, __('Overview', 'pagecraft-builder'), __('Overview', 'pagecraft-builder'),
            Capabilities::EDIT, self::MENU_SLUG, [$this, 'overview']);
        add_submenu_page(self::MENU_SLUG, __('Global Elements', 'pagecraft-builder'), __('Global Elements', 'pagecraft-builder'),
            Capabilities::EDIT, 'pagecraft-globals', [$this, 'globals']);
        add_submenu_page(self::MENU_SLUG, __('Import / Export', 'pagecraft-builder'), __('Import / Export', 'pagecraft-builder'),
            Capabilities::IMPORT, 'pagecraft-import-export', [$this, 'importExport']);
        add_submenu_page(self::MENU_SLUG, __('Connect Account', 'pagecraft-builder'), __('Connect Account', 'pagecraft-builder'),
            Capabilities::MANAGE, 'pagecraft-connect', [$this, 'connect']);
        add_submenu_page(self::MENU_SLUG, __('Settings', 'pagecraft-builder'), __('Settings', 'pagecraft-builder'),
            Capabilities::MANAGE, 'pagecraft-settings', [$this, 'settings']);
        add_submenu_page(null, __('Edit with Pagecraft', 'pagecraft-builder'), __('Edit with Pagecraft', 'pagecraft-builder'),
            Capabilities::EDIT, self::EDITOR_SLUG, [$this, 'editor']);
    }

    public function assets(string $hook): void
    {
        if (!str_contains($hook, 'pagecraft') && $hook !== 'edit.php') {
            return;
        }
        wp_enqueue_style(
            'pagecraft-builder-admin',
            PAGECRAFT_BUILDER_URL . 'assets/pagecraft-admin.css',
            [],
            PAGECRAFT_BUILDER_VERSION
        );
    }

    public function overview(): void
    {
        $this->guard(Capabilities::EDIT);
        $managed = $this->managedCount();
        echo '<div class="wrap pagecraft-admin"><div class="pagecraft-admin__mast">'
            . '<div><h1>' . esc_html__('Pagecraft', 'pagecraft-builder') . '</h1>'
            . '<p>' . esc_html__('Build Pagecraft pages inside WordPress. WordPress owns every local copy.', 'pagecraft-builder') . '</p></div>'
            . '<form action="' . esc_url(admin_url('admin-post.php')) . '" method="post">';
        wp_nonce_field('pagecraft_create_page');
        echo '<input type="hidden" name="action" value="pagecraft_create_page">'
            . '<button class="button button-primary button-hero">' . esc_html__('Create Pagecraft page', 'pagecraft-builder') . '</button>'
            . '</form></div><div class="pagecraft-admin__summary">'
            . '<strong>' . esc_html((string) $managed) . '</strong><span>'
            . esc_html(_n('Pagecraft page in WordPress', 'Pagecraft pages in WordPress', $managed, 'pagecraft-builder'))
            . '</span><a href="' . esc_url($this->pagesUrl()) . '">' . esc_html__('Open WordPress Pages', 'pagecraft-builder') . '</a>'
            . '</div><div class="pagecraft-admin__rule"><h2>' . esc_html__('One page library', 'pagecraft-builder') . '</h2>'
            . '<p>' . esc_html__('Pagecraft does not create a second Pages screen. Use WordPress Pages for titles, slugs, status, authors, previews, and every Pagecraft editing action.', 'pagecraft-builder') . '</p>'
            . '</div></div>';
    }

    public function globals(): void
    {
        $this->simplePage(
            __('Global Elements', 'pagecraft-builder'),
            __('The Pagecraft header and footer are revision-backed WordPress records shared by managed pages.', 'pagecraft-builder'),
            __('Global editing is installed at the storage boundary. The visual global editor will use the same full-screen workbench.', 'pagecraft-builder')
        );
    }

    public function importExport(): void
    {
        $this->guard(Capabilities::IMPORT);
        echo '<div class="wrap pagecraft-admin"><h1>' . esc_html__('Import / Export', 'pagecraft-builder') . '</h1>';
        $this->noticeFromQuery();
        $imported = isset($_GET['pagecraft_imported']) ? absint($_GET['pagecraft_imported']) : 0;
        if ($imported > 0 && get_post_type($imported) === 'page' && current_user_can('edit_post', $imported)) {
            echo '<div class="pagecraft-admin__rule pagecraft-import-result"><h2>'
                . esc_html__('Page imported into WordPress', 'pagecraft-builder') . '</h2><p>'
                . esc_html__('The page is independent and WordPress-owned. Global navigation was not changed.', 'pagecraft-builder')
                . '</p><div class="pagecraft-import-result__actions"><a class="button button-primary" href="'
                . esc_url($this->editorUrl($imported)) . '">' . esc_html__('Edit with Pagecraft', 'pagecraft-builder')
                . '</a><form action="' . esc_url(admin_url('admin-post.php')) . '" method="post">';
            wp_nonce_field('pagecraft_add_page_to_menu_' . $imported);
            echo '<input type="hidden" name="action" value="pagecraft_add_page_to_menu">'
                . '<input type="hidden" name="post" value="' . esc_attr((string) $imported) . '">'
                . '<label class="screen-reader-text" for="pagecraft-menu-location">'
                . esc_html__('Menu location', 'pagecraft-builder') . '</label>'
                . '<select id="pagecraft-menu-location" name="location">';
            foreach (NativeMenu::locations() as $slug => $label) {
                echo '<option value="' . esc_attr($slug) . '">' . esc_html($label) . '</option>';
            }
            echo '</select><button class="button">' . esc_html__('Add to menu', 'pagecraft-builder')
                . '</button></form></div></div>';
        }
        echo '<div class="pagecraft-admin__rule"><h2>' . esc_html__('Upload a Pagecraft page', 'pagecraft-builder') . '</h2>'
            . '<p>' . esc_html__('Import creates a new native WordPress page. It never replaces an existing page unless a later explicit replacement flow confirms it.', 'pagecraft-builder') . '</p>'
            . '<form class="pagecraft-upload" action="' . esc_url(admin_url('admin-post.php')) . '" method="post" enctype="multipart/form-data">';
        wp_nonce_field('pagecraft_upload_page');
        echo '<input type="hidden" name="action" value="pagecraft_upload_page">'
            . '<label for="pagecraft-package">' . esc_html__('Pagecraft page package', 'pagecraft-builder') . '</label>'
            . '<input id="pagecraft-package" name="pagecraft_package" type="file" accept=".pagecraft-page.zip,application/zip" required>'
            . '<button class="button button-primary">' . esc_html__('Import as new page', 'pagecraft-builder') . '</button>'
            . '</form></div></div>';
    }

    public function connect(): void
    {
        $this->guard(Capabilities::MANAGE);
        $cloud = new CloudImport();
        echo '<div class="wrap pagecraft-admin pagecraft-cloud"><div class="pagecraft-admin__mast"><div><h1>'
            . esc_html__('Import from Pagecraft Cloud', 'pagecraft-builder') . '</h1><p>'
            . esc_html__('Browse your cloud pages and deliberately import an independent WordPress-owned copy.', 'pagecraft-builder')
            . '</p></div></div>';
        $this->noticeFromQuery();
        if (!$cloud->connection()) {
            echo '<section class="pagecraft-cloud__empty"><h2>' . esc_html__('Connect only when you need to import', 'pagecraft-builder')
                . '</h2><p>' . esc_html__('The connection is read-only and revocable. It creates no webhooks, polling, synchronization, or background updates.', 'pagecraft-builder')
                . '</p><form action="' . esc_url(admin_url('admin-post.php')) . '" method="post">';
            wp_nonce_field('pagecraft_cloud_start');
            echo '<input type="hidden" name="action" value="pagecraft_cloud_start"><button class="button button-primary button-hero">'
                . esc_html__('Connect Pagecraft account', 'pagecraft-builder') . '</button></form></section></div>';
            return;
        }
        echo '<div class="pagecraft-cloud__status"><div><strong>' . esc_html__('Connected for manual import', 'pagecraft-builder')
            . '</strong><span>' . esc_html__('Nothing imports until an administrator clicks Import.', 'pagecraft-builder')
            . '</span></div><form action="' . esc_url(admin_url('admin-post.php')) . '" method="post">';
        wp_nonce_field('pagecraft_cloud_disconnect');
        echo '<input type="hidden" name="action" value="pagecraft_cloud_disconnect"><button class="button">'
            . esc_html__('Disconnect', 'pagecraft-builder') . '</button></form></div>';
        try {
            $projects = $cloud->projects();
            $selected = sanitize_text_field((string) ($_GET['project'] ?? ($projects[0]['id'] ?? '')));
            echo '<form class="pagecraft-cloud__project" method="get" action="' . esc_url(admin_url('admin.php')) . '">'
                . '<input type="hidden" name="page" value="pagecraft-connect"><label for="pagecraft-cloud-project">'
                . esc_html__('Pagecraft project', 'pagecraft-builder') . '</label><select id="pagecraft-cloud-project" name="project">';
            foreach ($projects as $project) {
                $id = (string) ($project['id'] ?? '');
                echo '<option value="' . esc_attr($id) . '"' . selected($id, $selected, false) . '>'
                    . esc_html((string) ($project['name'] ?? __('Untitled project', 'pagecraft-builder'))) . ' · '
                    . esc_html(sprintf(_n('%d page', '%d pages', (int) ($project['pageCount'] ?? 0), 'pagecraft-builder'), (int) ($project['pageCount'] ?? 0)))
                    . '</option>';
            }
            echo '</select><button class="button">' . esc_html__('Show pages', 'pagecraft-builder') . '</button></form>';
            if ($selected !== '') $this->cloudPages($cloud, $selected);
        } catch (PackageException $error) {
            echo '<div class="notice notice-error inline"><p>' . esc_html($error->getMessage()) . '</p><p><a class="button" href="'
                . esc_url(admin_url('admin.php?page=pagecraft-connect&pagecraft_error=reconnect')) . '">'
                . esc_html__('Reconnect account', 'pagecraft-builder') . '</a></p></div>';
        }
        echo '</div>';
    }

    private function cloudPages(CloudImport $cloud, string $projectId): void
    {
        $result = $cloud->pages($projectId);
        $pages = $result['pages'];
        if (!$pages) {
            echo '<div class="pagecraft-cloud__empty"><h2>' . esc_html__('No pages in this project', 'pagecraft-builder')
                . '</h2><p>' . esc_html__('Create a page in the Pagecraft web builder, then return here to import it.', 'pagecraft-builder') . '</p></div>';
            return;
        }
        echo '<div class="pagecraft-cloud__pages" role="list">';
        foreach ($pages as $page) {
            $pageId = (string) ($page['id'] ?? '');
            $local = $this->localCloudCopy($projectId, $pageId);
            echo '<article class="pagecraft-cloud-page" role="listitem"><div class="pagecraft-cloud-page__body"><h2>'
                . esc_html((string) ($page['name'] ?? __('Untitled page', 'pagecraft-builder'))) . '</h2><p class="pagecraft-cloud-page__path">/'
                . esc_html((string) ($page['slug'] ?? '')) . '</p><p>'
                . esc_html(sprintf(__('Cloud version %1$d · Modified %2$s', 'pagecraft-builder'),
                    (int) ($page['sourceVersion'] ?? 0), $this->dateLabel((string) ($page['modifiedAt'] ?? ''))))
                . '</p></div><div class="pagecraft-cloud-page__actions"><a class="button" target="_blank" rel="noopener" href="'
                . esc_url((string) ($page['previewUrl'] ?? '')) . '">' . esc_html__('Preview', 'pagecraft-builder') . '</a>'
                . '<form action="' . esc_url(admin_url('admin-post.php')) . '" method="post">';
            wp_nonce_field('pagecraft_cloud_import_' . $projectId . '_' . $pageId);
            echo '<input type="hidden" name="action" value="pagecraft_cloud_import"><input type="hidden" name="project" value="'
                . esc_attr($projectId) . '"><input type="hidden" name="cloud_page" value="' . esc_attr($pageId) . '">'
                . '<label class="screen-reader-text" for="pagecraft-import-mode-' . esc_attr($pageId) . '">'
                . esc_html__('Import method', 'pagecraft-builder') . '</label><select id="pagecraft-import-mode-' . esc_attr($pageId) . '" name="mode">'
                . '<option value="draft">' . esc_html__('New draft', 'pagecraft-builder') . '</option>';
            if (current_user_can('publish_pages')) echo '<option value="publish">' . esc_html__('New published page', 'pagecraft-builder') . '</option>';
            if ($local > 0) echo '<option value="replace:' . esc_attr((string) $local) . '">'
                . esc_html__('Replace local copy (creates revision)', 'pagecraft-builder') . '</option>';
            echo '</select><button class="button button-primary">' . esc_html__('Import page', 'pagecraft-builder')
                . '</button></form></div></article>';
        }
        echo '</div>';
    }

    public function settings(): void
    {
        $this->simplePage(
            __('Settings', 'pagecraft-builder'),
            __('Pagecraft uses WordPress Pages, revisions, media, permissions, and the active Pagecraft Theme.', 'pagecraft-builder'),
            __('There are no synchronization, deployment, or remote-ownership settings in the native handoff product.', 'pagecraft-builder')
        );
    }

    public function editor(): void
    {
        $postId = isset($_GET['post']) ? absint($_GET['post']) : 0;
        $this->guardPage($postId);
        if (!ManagedPage::isManaged($postId)
            && (int) get_post_meta($postId, ManagedPage::CONVERSION_REVISION, true) === 0) {
            $this->editorChoice($postId);
            return;
        }
        $frame = add_query_arg([
            'action' => 'pagecraft_editor_frame',
            'post' => $postId,
            '_wpnonce' => wp_create_nonce('pagecraft_editor_frame_' . $postId),
        ], admin_url('admin-ajax.php'));
        echo '<div class="pagecraft-editor-admin"><iframe class="pagecraft-editor-admin__frame" src="'
            . esc_url($frame) . '" title="' . esc_attr__('Pagecraft editor', 'pagecraft-builder')
            . '" allow="clipboard-write" referrerpolicy="same-origin"></iframe></div>';
    }

    private function editorChoice(int $postId): void
    {
        $post = get_post($postId);
        echo '<div class="wrap pagecraft-admin pagecraft-start"><a class="pagecraft-admin__back" href="'
            . esc_url($this->pagesUrl()) . '">&larr; ' . esc_html__('WordPress Pages', 'pagecraft-builder') . '</a>'
            . '<h1>' . esc_html(sprintf(__('Edit “%s” with Pagecraft', 'pagecraft-builder'), get_the_title($post))) . '</h1>'
            . '<p class="pagecraft-start__intro">' . esc_html__('Choose how this native WordPress page should enter Pagecraft. Nothing happens until you choose.', 'pagecraft-builder') . '</p>'
            . '<div class="pagecraft-start__choices"><section><h2>' . esc_html__('Start from scratch', 'pagecraft-builder') . '</h2>'
            . '<p>' . esc_html__('Create a recoverable WordPress revision, then open a blank Pagecraft canvas for this page.', 'pagecraft-builder') . '</p>'
            . '<form action="' . esc_url(admin_url('admin-post.php')) . '" method="post">';
        wp_nonce_field('pagecraft_prepare_page_' . $postId);
        echo '<input type="hidden" name="action" value="pagecraft_prepare_page"><input type="hidden" name="post" value="'
            . esc_attr((string) $postId) . '"><button class="button button-primary">'
            . esc_html__('Start from scratch', 'pagecraft-builder') . '</button></form></section>'
            . '<section><h2>' . esc_html__('Import from Pagecraft Cloud', 'pagecraft-builder') . '</h2>'
            . '<p>' . esc_html__('Connect an account, choose a cloud page, and import an independent WordPress-owned copy.', 'pagecraft-builder') . '</p>'
            . '<a class="button" href="' . esc_url(admin_url('admin.php?page=pagecraft-connect')) . '">'
            . esc_html__('Connect Pagecraft account', 'pagecraft-builder') . '</a></section>'
            . '<section><h2>' . esc_html__('Upload a package', 'pagecraft-builder') . '</h2>'
            . '<p>' . esc_html__('Import a .pagecraft-page.zip as a new native WordPress page.', 'pagecraft-builder') . '</p>'
            . '<a class="button" href="' . esc_url(admin_url('admin.php?page=pagecraft-import-export')) . '">'
            . esc_html__('Choose a package', 'pagecraft-builder') . '</a></section></div></div>';
    }

    public function editorFrame(): void
    {
        $postId = isset($_GET['post']) ? absint($_GET['post']) : 0;
        check_ajax_referer('pagecraft_editor_frame_' . $postId);
        $this->guardPage($postId);
        if (!ManagedPage::isManaged($postId)
            && (int) get_post_meta($postId, ManagedPage::CONVERSION_REVISION, true) === 0) {
            $this->fail(__('This page has not been prepared for Pagecraft conversion.', 'pagecraft-builder'), 403);
        }
        $asset = PAGECRAFT_BUILDER_DIR . 'assets/pagecraft-editor.html';
        $html = @file_get_contents($asset);
        if (!is_string($html) || $html === '') {
            $this->fail(__('The Pagecraft editor asset is missing. Reinstall Pagecraft Builder.', 'pagecraft-builder'), 500);
        }
        try {
            $loaded = (new PageEditor())->load($postId);
            if (is_array($loaded['document'])) {
                $loaded['document'] = (new NativeMenu())->hydrateDocument($loaded['document']);
            }
        } catch (PackageException $error) {
            $this->fail($error->getMessage(), 400);
        }
        $post = get_post($postId);
        $user = wp_get_current_user();
        $config = [
            'restUrl' => untrailingslashit(rest_url(RestController::NAMESPACE)),
            'nonce' => wp_create_nonce('wp_rest'),
            'doc' => $loaded['document'],
            'version' => $loaded['version'],
            'role' => 'owner',
            'siteName' => get_bloginfo('name'),
            'page' => [
                'id' => $postId,
                'title' => get_the_title($post),
                'slug' => (string) ($post->post_name ?? ''),
            ],
            'user' => ['id' => (string) $user->ID, 'name' => (string) $user->display_name],
            'capabilities' => array_values(array_merge(
                ['edit_document', 'edit_structure', 'restore_revisions'],
                current_user_can('edit_pages') ? ['manage_pages'] : [],
                current_user_can('upload_files') ? ['upload_media'] : [],
                current_user_can(Capabilities::MANAGE) && current_user_can('edit_theme_options')
                    ? ['manage_menus'] : []
            )),
            'wordpressContent' => $this->wordpressContent(),
            'previewUrl' => get_preview_post_link($postId),
            'pagesUrl' => $this->pagesUrl(),
            'exitUrl' => get_edit_post_link($postId, 'raw'),
        ];
        $script = '<script>window.PC_WORDPRESS=' . wp_json_encode(
            $config,
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
        ) . ';</script>';
        $marker = '<script>\n/* =====================================================================';
        if (!str_contains($html, $marker)) {
            $this->fail(__('The Pagecraft editor asset is incompatible with this plugin.', 'pagecraft-builder'), 500);
        }
        $html = str_replace($marker, $script . "\n" . $marker, $html);
        nocache_headers();
        header('Content-Type: text/html; charset=' . get_option('blog_charset', 'UTF-8'));
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header("Content-Security-Policy: default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline' data:; img-src 'self' data: blob: https:; connect-src 'self' blob: https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
        echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted generated editor artifact plus encoded config.
        exit;
    }

    public function preparePage(): void
    {
        $postId = isset($_POST['post']) ? absint($_POST['post']) : 0;
        check_admin_referer('pagecraft_prepare_page_' . $postId);
        $this->guardPage($postId);
        if (ManagedPage::isManaged($postId)) {
            wp_safe_redirect($this->editorUrl($postId));
            exit;
        }
        if (!post_type_supports('page', 'revisions') || !wp_revisions_enabled(get_post($postId))) {
            $this->fail(__('WordPress revisions must be enabled before converting this page.', 'pagecraft-builder'), 400);
        }
        $revision = wp_save_post_revision($postId);
        if (is_wp_error($revision)) {
            $this->fail($revision->get_error_message(), 400);
        }
        if (!is_int($revision) || $revision <= 0) {
            $post = get_post($postId);
            if (is_object($post) && trim((string) $post->post_content) !== '') {
                $this->fail(__('WordPress could not create the required conversion backup.', 'pagecraft-builder'), 400);
            }
            $revision = -1;
        }
        update_post_meta($postId, ManagedPage::CONVERSION_REVISION, (string) $revision);
        wp_safe_redirect($this->editorUrl($postId));
        exit;
    }

    public function createPage(): void
    {
        check_admin_referer('pagecraft_create_page');
        $this->guard(Capabilities::EDIT);
        $postId = wp_insert_post([
            'post_type' => 'page',
            'post_status' => 'draft',
            'post_title' => __('Untitled Pagecraft page', 'pagecraft-builder'),
        ], true);
        if (is_wp_error($postId)) {
            $this->fail($postId->get_error_message(), 400);
        }
        update_post_meta((int) $postId, ManagedPage::CONVERSION_REVISION, '-1');
        wp_safe_redirect($this->editorUrl((int) $postId));
        exit;
    }

    public function uploadPage(): void
    {
        check_admin_referer('pagecraft_upload_page');
        $this->guard(Capabilities::IMPORT);
        $file = $_FILES['pagecraft_package'] ?? null;
        if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
            || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
            wp_safe_redirect(add_query_arg('pagecraft_error', 'upload', admin_url('admin.php?page=pagecraft-import-export')));
            exit;
        }
        try {
            $result = pagecraft_builder_import_page_package($file['tmp_name']);
            wp_safe_redirect(add_query_arg(
                'pagecraft_imported',
                (string) $result->postId,
                admin_url('admin.php?page=pagecraft-import-export')
            ));
        } catch (PackageException $error) {
            wp_safe_redirect(add_query_arg('pagecraft_error', rawurlencode($error->getMessage()), admin_url('admin.php?page=pagecraft-import-export')));
        }
        exit;
    }

    public function addPageToMenu(): void
    {
        $postId = isset($_POST['post']) ? absint($_POST['post']) : 0;
        check_admin_referer('pagecraft_add_page_to_menu_' . $postId);
        $this->guard(Capabilities::MANAGE);
        $location = sanitize_key((string) ($_POST['location'] ?? ''));
        try {
            (new NativeMenu())->addPageToLocation($postId, $location);
            wp_safe_redirect(add_query_arg([
                'pagecraft_imported' => (string) $postId,
                'pagecraft_menu_added' => $location,
            ], admin_url('admin.php?page=pagecraft-import-export')));
        } catch (PackageException $error) {
            wp_safe_redirect(add_query_arg([
                'pagecraft_imported' => (string) $postId,
                'pagecraft_error' => rawurlencode($error->getMessage()),
            ], admin_url('admin.php?page=pagecraft-import-export')));
        }
        exit;
    }

    public function cloudStart(): void
    {
        check_admin_referer('pagecraft_cloud_start');
        $this->guard(Capabilities::MANAGE);
        $callback = admin_url('admin-post.php?action=pagecraft_cloud_callback');
        wp_safe_redirect((new CloudImport())->authorizationUrl($callback));
        exit;
    }

    public function cloudCallback(): void
    {
        $this->guard(Capabilities::MANAGE);
        $code = sanitize_text_field((string) ($_GET['code'] ?? ''));
        $state = sanitize_text_field((string) ($_GET['state'] ?? ''));
        try {
            if ($code === '' || $state === '') throw new PackageException('Pagecraft did not return a complete authorization response.');
            (new CloudImport())->complete($code, $state, admin_url('admin-post.php?action=pagecraft_cloud_callback'));
            wp_safe_redirect(admin_url('admin.php?page=pagecraft-connect&pagecraft_connected=1'));
        } catch (PackageException $error) {
            wp_safe_redirect(add_query_arg('pagecraft_error', rawurlencode($error->getMessage()), admin_url('admin.php?page=pagecraft-connect')));
        }
        exit;
    }

    public function cloudDisconnect(): void
    {
        check_admin_referer('pagecraft_cloud_disconnect');
        $this->guard(Capabilities::MANAGE);
        (new CloudImport())->disconnect();
        wp_safe_redirect(admin_url('admin.php?page=pagecraft-connect&pagecraft_disconnected=1'));
        exit;
    }

    public function cloudImport(): void
    {
        $projectId = sanitize_text_field((string) ($_POST['project'] ?? ''));
        $pageId = sanitize_text_field((string) ($_POST['cloud_page'] ?? ''));
        check_admin_referer('pagecraft_cloud_import_' . $projectId . '_' . $pageId);
        $this->guard(Capabilities::IMPORT);
        $temporary = '';
        try {
            $mode = sanitize_text_field((string) ($_POST['mode'] ?? 'draft'));
            $options = [];
            if ($mode === 'publish') $options['status'] = 'publish';
            elseif (str_starts_with($mode, 'replace:')) {
                $options['replace_post_id'] = absint(substr($mode, strlen('replace:')));
                $options['confirm_replace'] = true;
            } elseif ($mode !== 'draft') throw new PackageException('Choose a supported Pagecraft import method.');
            $temporary = (new CloudImport())->download($projectId, $pageId);
            $result = pagecraft_builder_import_page_package($temporary, $options);
            wp_safe_redirect(add_query_arg('pagecraft_imported', (string) $result->postId,
                admin_url('admin.php?page=pagecraft-import-export')));
        } catch (PackageException $error) {
            wp_safe_redirect(add_query_arg('pagecraft_error', rawurlencode($error->getMessage()),
                admin_url('admin.php?page=pagecraft-connect&project=' . rawurlencode($projectId))));
        } finally {
            if ($temporary !== '' && is_file($temporary)) wp_delete_file($temporary);
        }
        exit;
    }

    /** @param array<string,string> $columns @return array<string,string> */
    public function columns(array $columns): array
    {
        $output = [];
        foreach ($columns as $key => $label) {
            $output[$key] = $label;
            if ($key === 'title') {
                $output['pagecraft'] = __('Pagecraft', 'pagecraft-builder');
            }
        }
        return $output;
    }

    public function column(string $column, int $postId): void
    {
        if ($column !== 'pagecraft') {
            return;
        }
        if (!ManagedPage::isManaged($postId)) {
            echo '<span class="pagecraft-status pagecraft-status--native">' . esc_html__('WordPress', 'pagecraft-builder') . '</span>';
            return;
        }
        $stored = (int) get_post_meta($postId, ManagedPage::SCHEMA_VERSION, true);
        $compatible = $stored > 0 && $stored <= PageEditor::SCHEMA_VERSION;
        echo '<span class="pagecraft-status ' . ($compatible ? 'pagecraft-status--ready' : 'pagecraft-status--blocked') . '">'
            . esc_html($compatible ? __('Ready', 'pagecraft-builder') : __('Upgrade required', 'pagecraft-builder')) . '</span>';
    }

    /** @param array<string,string> $actions @return array<string,string> */
    public function rowActions(array $actions, \WP_Post $post): array
    {
        if ($post->post_type !== 'page' || !current_user_can(Capabilities::EDIT) || !current_user_can('edit_post', $post->ID)) {
            return $actions;
        }
        $label = ManagedPage::isManaged($post->ID)
            ? __('Edit with Pagecraft', 'pagecraft-builder')
            : __('Build with Pagecraft', 'pagecraft-builder');
        $pagecraft = '<a href="' . esc_url($this->editorUrl($post->ID)) . '">' . esc_html($label) . '</a>';
        $output = ['pagecraft' => $pagecraft] + $actions;
        if (ManagedPage::isManaged($post->ID)) {
            $output['pagecraft_native'] = '<a href="' . esc_url(admin_url('post.php?post=' . $post->ID . '&action=edit')) . '">'
                . esc_html__('WordPress settings', 'pagecraft-builder') . '</a>';
        }
        return $output;
    }

    /** @param array<string,string> $views @return array<string,string> */
    public function pageViews(array $views): array
    {
        if (!current_user_can(Capabilities::EDIT)) {
            return $views;
        }
        $count = $this->managedCount();
        $current = isset($_GET['pagecraft_filter']) && $_GET['pagecraft_filter'] === 'managed';
        $views['pagecraft'] = '<a href="' . esc_url(add_query_arg('pagecraft_filter', 'managed', admin_url('edit.php?post_type=page')))
            . '"' . ($current ? ' class="current" aria-current="page"' : '') . '>'
            . esc_html__('Pagecraft', 'pagecraft-builder') . ' <span class="count">(' . esc_html((string) $count) . ')</span></a>';
        return $views;
    }

    public function filterPages(\WP_Query $query): void
    {
        if (!is_admin() || !$query->is_main_query() || $query->get('post_type') !== 'page'
            || !isset($_GET['pagecraft_filter']) || $_GET['pagecraft_filter'] !== 'managed') {
            return;
        }
        $meta = $query->get('meta_query');
        $meta = is_array($meta) ? $meta : [];
        $meta[] = ['key' => ManagedPage::DOCUMENT, 'compare' => 'EXISTS'];
        $query->set('meta_query', $meta);
    }

    private function simplePage(string $title, string $lead, string $detail): void
    {
        $this->guard(Capabilities::EDIT);
        echo '<div class="wrap pagecraft-admin"><h1>' . esc_html($title) . '</h1><p class="pagecraft-admin__lead">'
            . esc_html($lead) . '</p><div class="pagecraft-admin__rule"><p>' . esc_html($detail) . '</p></div></div>';
    }

    private function noticeFromQuery(): void
    {
        if (isset($_GET['pagecraft_menu_added'])) {
            $location = sanitize_key((string) $_GET['pagecraft_menu_added']);
            $label = NativeMenu::locations()[$location] ?? __('selected navigation', 'pagecraft-builder');
            echo '<div class="notice notice-success is-dismissible"><p>'
                . esc_html(sprintf(__('The page was added to %s.', 'pagecraft-builder'), $label)) . '</p></div>';
        }
        if (isset($_GET['pagecraft_error'])) {
            $message = $_GET['pagecraft_error'] === 'upload'
                ? __('WordPress did not receive a valid Pagecraft package upload.', 'pagecraft-builder')
                : sanitize_text_field(wp_unslash((string) $_GET['pagecraft_error']));
            echo '<div class="notice notice-error"><p>' . esc_html($message) . '</p></div>';
        }
    }

    private function managedCount(): int
    {
        return count(get_posts([
            'post_type' => 'page',
            'post_status' => ['draft', 'pending', 'publish', 'private'],
            'posts_per_page' => -1,
            'fields' => 'ids',
            'meta_key' => ManagedPage::DOCUMENT,
        ]));
    }

    /** @return list<array<string,mixed>> */
    private function localCloudCopy(string $projectId, string $pageId): int
    {
        $ids = get_posts([
            'post_type' => 'page', 'post_status' => 'any', 'posts_per_page' => 1, 'fields' => 'ids',
            'meta_query' => [
                'relation' => 'AND',
                ['key' => ManagedPage::SOURCE_PROJECT_ID, 'value' => $projectId],
                ['key' => ManagedPage::SOURCE_PAGE_ID, 'value' => $pageId],
            ],
        ]);
        return is_array($ids) && isset($ids[0]) ? (int) $ids[0] : 0;
    }

    private function dateLabel(string $value): string
    {
        $timestamp = strtotime($value);
        return $timestamp ? wp_date(get_option('date_format') . ' ' . get_option('time_format'), $timestamp)
            : __('Unknown date', 'pagecraft-builder');
    }

    private function wordpressContent(): array
    {
        $home = home_url('/');
        $parts = wp_parse_url($home);
        if (!is_array($parts) || !is_string($parts['scheme'] ?? null) || !is_string($parts['host'] ?? null)) {
            return [];
        }
        $origin = $parts['scheme'] . '://' . $parts['host']
            . (isset($parts['port']) ? ':' . (int) $parts['port'] : '');
        $targetPath = '/' . trim((string) ($parts['path'] ?? '/'), '/');
        if ($targetPath !== '/') {
            $targetPath = rtrim($targetPath, '/');
        }
        $posts = get_posts([
            'post_type' => ['page', 'post'],
            'post_status' => ['draft', 'pending', 'publish', 'private'],
            'posts_per_page' => 500,
            'orderby' => ['post_type' => 'ASC', 'menu_order' => 'ASC', 'title' => 'ASC'],
        ]);
        $items = [];
        foreach (is_array($posts) ? $posts : [] as $post) {
            if (!is_object($post) || !isset($post->ID, $post->post_type)
                || !in_array($post->post_type, ['page', 'post'], true)) {
                continue;
            }
            $items[] = [
                'id' => (string) $post->ID,
                'objectType' => (string) $post->post_type,
                'title' => get_the_title($post),
                'url' => get_permalink($post),
                'modifiedAt' => get_post_modified_time('c', true, $post),
            ];
        }
        return [[
            'connectionId' => 'wordpress-local',
            'environment' => 'production',
            'profile' => 'pagecraft-theme',
            'targetOrigin' => $origin,
            'targetPath' => $targetPath,
            'items' => $items,
        ]];
    }

    private function pagesUrl(): string
    {
        return admin_url('edit.php?post_type=page&pagecraft_filter=managed');
    }

    private function editorUrl(int $postId): string
    {
        return admin_url('admin.php?page=' . self::EDITOR_SLUG . '&post=' . $postId);
    }

    private function guard(string $capability): void
    {
        if (!current_user_can($capability)) {
            $this->fail(__('You are not allowed to use Pagecraft.', 'pagecraft-builder'), 403);
        }
    }

    private function guardPage(int $postId): void
    {
        if ($postId <= 0 || get_post_type($postId) !== 'page' || !current_user_can(Capabilities::EDIT)
            || !current_user_can('edit_post', $postId)) {
            $this->fail(__('You are not allowed to edit this Pagecraft page.', 'pagecraft-builder'), 403);
        }
    }

    private function fail(string $message, int $status): never
    {
        wp_die(esc_html($message), '', ['response' => $status]);
        exit;
    }
}
