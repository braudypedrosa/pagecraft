<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\ManagedPages;

final class AdminUiContractTest extends ConnectorTestCase
{
    public function test_high_impact_actions_and_route_mapping_are_accessible_and_confirmed(): void
    {
        $admin = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Admin.php');
        $script = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'assets/admin.js');

        $this->assertStringContainsString('class="screen-reader-text" for="', $admin);
        $this->assertStringContainsString('aria-label="', $admin);
        $this->assertStringContainsString('data-pagecraft-confirm', $admin);
        $this->assertStringContainsString('Disconnect Pagecraft and remove', $admin);
        $this->assertStringContainsString('Emergency rollback to release', $admin);
        $this->assertStringContainsString('Replace the WordPress page at', $admin);
        $this->assertStringContainsString("form.matches( 'form[data-pagecraft-confirm]' )", $script);
        $this->assertStringContainsString('window.confirm', $script);
    }

    public function test_managed_editor_hides_document_affordances_while_server_guards_all_fields(): void
    {
        $script = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'assets/managed-editor.js');
        $css = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'assets/managed-editor.css');
        $managed = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/ManagedPages.php');

        foreach (['featured-image', 'discussion-panel', 'page-attributes', 'post-status', 'post-link', 'post-template'] as $panel) {
            $this->assertStringContainsString("'{$panel}'", $script);
        }
        foreach (['editor-post-summary', 'editor-post-featured-image', 'editor-post-date', 'editor-post-permalink', 'editor-post-template', 'editor-post-discussion', 'editor-page-attributes'] as $selector) {
            $this->assertStringContainsString($selector, $script);
            $this->assertStringContainsString($selector, $css);
        }
        $this->assertStringContainsString("lockPostSaving( 'pagecraft-managed-read-only' )", $script);
        $this->assertStringContainsString("['post_title', 'post_name', 'post_content', 'post_excerpt', 'post_status', 'post_parent', 'menu_order', 'post_date', 'post_date_gmt', 'comment_status', 'ping_status', 'post_password']", $managed);
        $this->assertStringContainsString('protectManagedMeta', $managed);
        $this->assertStringContainsString('rejectRestMutation', $managed);
    }

    public function test_managed_page_lock_does_not_capture_managed_cms_records(): void
    {
        $cmsPost = new \WP_Post(['ID' => 71, 'post_type' => 'pagecraft_entry']);
        $GLOBALS['pagecraft_test_posts'][$cmsPost->ID] = $cmsPost;
        $GLOBALS['pagecraft_test_post_meta'][$cmsPost->ID] = ['_pagecraft_managed' => '1'];
        $GLOBALS['post'] = $cmsPost;
        $managed = new ManagedPages(new Connection());

        $this->assertSame('wp-admin', $managed->adminBodyClass('wp-admin'));

        $page = new \WP_Post(['ID' => 72, 'post_type' => 'page']);
        $GLOBALS['pagecraft_test_posts'][$page->ID] = $page;
        $GLOBALS['pagecraft_test_post_meta'][$page->ID] = ['_pagecraft_managed' => '1'];
        $GLOBALS['post'] = $page;

        $this->assertSame('wp-admin pagecraft-managed-editor', $managed->adminBodyClass('wp-admin'));
    }

    public function test_private_submission_payloads_stay_within_a_mobile_scroll_region(): void
    {
        $admin = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Admin.php');
        $css = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'assets/admin.css');

        $this->assertStringContainsString('pagecraft-table-scroll', $admin);
        $this->assertStringContainsString('role="region" tabindex="0"', $admin);
        $this->assertStringContainsString('overflow-x: auto', $css);
        $this->assertStringContainsString('.pagecraft-submissions pre', $css);
        $this->assertStringContainsString('white-space: pre-wrap', $css);
        $this->assertStringContainsString('@media (max-width: 900px)', $css);
    }

    public function test_staging_cms_editor_has_server_and_client_read_only_guards(): void
    {
        $cms = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/CmsWriteback.php');
        $script = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'assets/cms-editor.js');
        $css = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'assets/cms-editor.css');
        $mapper = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Mapper.php');

        $this->assertStringContainsString("add_filter('rest_pre_insert_pagecraft_entry'", $cms);
        $this->assertStringContainsString("add_filter('pre_trash_post'", $cms);
        $this->assertStringContainsString("add_filter('pre_delete_post'", $cms);
        $this->assertStringContainsString("lockPostSaving( 'pagecraft-cms-staging-read-only' )", $script);
        $this->assertStringContainsString('#submitdiv', $script);
        $this->assertStringContainsString('#misc-publishing-actions', $script);
        $this->assertStringContainsString('Save to Pagecraft draft', $script);
        $this->assertStringContainsString('.pagecraft-cms-read-only #submitdiv', $css);
        $this->assertStringContainsString('.pagecraft-cms-managed #misc-publishing-actions', $css);
        $this->assertStringContainsString("'meta_box_cb' => false", $mapper);
        $this->assertStringContainsString("'show_ui' => false", $mapper);
        $this->assertStringContainsString("'capabilities' => ['create_posts' => 'do_not_allow']", $mapper);
    }
}
