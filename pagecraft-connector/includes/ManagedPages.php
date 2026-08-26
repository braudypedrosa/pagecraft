<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class ManagedPages
{
    public function __construct(private readonly Connection $connection)
    {
    }

    public function hooks(): void
    {
        add_filter('block_editor_settings_all', [$this, 'lockEditor'], 10, 2);
        add_filter('wp_insert_post_data', [$this, 'protectManagedPost'], 10, 4);
        add_filter('update_post_metadata', [$this, 'protectManagedMeta'], 10, 5);
        add_filter('add_post_metadata', [$this, 'protectManagedMeta'], 10, 5);
        add_filter('delete_post_metadata', [$this, 'protectManagedMeta'], 10, 5);
        add_filter('rest_pre_insert_page', [$this, 'rejectRestMutation'], 10, 2);
        add_filter('pre_trash_post', [$this, 'preventDeletion'], 10, 2);
        add_filter('pre_delete_post', [$this, 'preventDeletion'], 10, 2);
        add_filter('pre_delete_attachment', [$this, 'preventAttachmentDeletion'], 10, 3);
        add_filter('display_post_states', [$this, 'postState'], 10, 2);
        add_filter('page_row_actions', [$this, 'rowActions'], 10, 2);
        add_action('add_meta_boxes_page', [$this, 'addMetaBox']);
        add_action('enqueue_block_editor_assets', [$this, 'editorAssets']);
        add_filter('admin_body_class', [$this, 'adminBodyClass']);
    }

    /** @param array<string,mixed> $settings @return array<string,mixed> */
    public function lockEditor(array $settings, \WP_Block_Editor_Context $context): array
    {
        $post = $context->post;
        if (!$post instanceof \WP_Post || !$this->managedPage($post->ID)) {
            return $settings;
        }
        $settings['templateLock'] = 'all';
        $settings['canLockBlocks'] = false;
        $settings['codeEditingEnabled'] = false;
        $settings['supportsLayout'] = false;
        $settings['pagecraftManaged'] = true;
        return $settings;
    }

    /** @param array<string,mixed> $data @param array<string,mixed> $postarr @param array<string,mixed> $unsanitized @return array<string,mixed> */
    public function protectManagedPost(array $data, array $postarr, array $unsanitized, bool $update): array
    {
        if (!$update || Mapper::isApplying()) {
            return $data;
        }
        $postId = (int) ($postarr['ID'] ?? 0);
        if ($postId < 1 || get_post_meta($postId, '_pagecraft_managed', true) !== '1' || get_post_type($postId) !== 'page') {
            return $data;
        }
        $current = get_post($postId, ARRAY_A);
        if (!is_array($current)) {
            return $data;
        }
        foreach (['post_title', 'post_name', 'post_content', 'post_excerpt', 'post_status', 'post_parent', 'menu_order', 'post_date', 'post_date_gmt', 'comment_status', 'ping_status', 'post_password'] as $field) {
            $data[$field] = $current[$field];
        }
        return $data;
    }

    public function protectManagedMeta(mixed $check, int $objectId, string $metaKey, mixed $metaValue, mixed $previous): mixed
    {
        if (Mapper::isApplying()
            || get_post_type($objectId) !== 'page'
            || get_post_meta($objectId, '_pagecraft_managed', true) !== '1'
            || in_array($metaKey, ['_edit_lock', '_edit_last'], true)) {
            return $check;
        }
        return true;
    }

    public function rejectRestMutation(mixed $preparedPost, \WP_REST_Request $request): mixed
    {
        $postId = absint($request['id'] ?? 0);
        if ($postId > 0 && get_post_meta($postId, '_pagecraft_managed', true) === '1' && !Mapper::isApplying()) {
            return new \WP_Error('pagecraft_managed_read_only', 'This page is managed by Pagecraft and cannot be changed through WordPress.', ['status' => 403]);
        }
        return $preparedPost;
    }

    public function preventDeletion(mixed $delete, \WP_Post $post): mixed
    {
        return !Mapper::isApplying()
            && !ReleaseRepository::isDeletingManagedObject($post->ID, 'post')
            && get_post_type($post->ID) === 'page'
            && get_post_meta($post->ID, '_pagecraft_managed', true) === '1'
                ? false
                : $delete;
    }

    public function preventAttachmentDeletion(mixed $delete, \WP_Post $post, bool $forceDelete): mixed
    {
        if ($delete !== null
            || Mapper::isApplying()
            || ReleaseRepository::isDeletingManagedObject($post->ID, 'attachment')
            || get_post_type($post->ID) !== 'attachment'
            || get_post_meta($post->ID, '_pagecraft_managed', true) !== '1') {
            return $delete;
        }
        global $wpdb;
        $referenceCount = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}pagecraft_objects WHERE object_id = %d",
            $post->ID
        ));
        if (!is_numeric($referenceCount)) {
            return false;
        }
        $references = (int) $referenceCount;
        return $references > 0 ? false : $delete;
    }

    /** @param array<string,string> $states @return array<string,string> */
    public function postState(array $states, \WP_Post $post): array
    {
        if (get_post_meta($post->ID, '_pagecraft_managed', true) === '1') {
            $states['pagecraft'] = __('Managed by Pagecraft', 'pagecraft-connector');
        }
        return $states;
    }

    /** @param array<string,string> $actions @return array<string,string> */
    public function rowActions(array $actions, \WP_Post $post): array
    {
        if (get_post_meta($post->ID, '_pagecraft_managed', true) !== '1') {
            return $actions;
        }
        unset($actions['inline hide-if-no-js'], $actions['trash']);
        $url = $this->editUrl($post->ID);
        if ($url !== '') {
            $actions['pagecraft_edit'] = '<a href="' . esc_url($url) . '">' . esc_html__('Edit in Pagecraft', 'pagecraft-connector') . '</a>';
        } else {
            $actions['pagecraft_edit'] = '<span aria-disabled="true">' . esc_html__('Connect Pagecraft to edit', 'pagecraft-connector') . '</span>';
        }
        return $actions;
    }

    public function addMetaBox(): void
    {
        add_meta_box('pagecraft-managed', __('Pagecraft', 'pagecraft-connector'), function (\WP_Post $post): void {
            if (get_post_meta($post->ID, '_pagecraft_managed', true) !== '1') {
                echo '<p>' . esc_html__('This page is not managed by Pagecraft.', 'pagecraft-connector') . '</p>';
                return;
            }
            echo '<p>' . esc_html__('Pagecraft is the source of truth. This WordPress page is a read-only deployment mirror.', 'pagecraft-connector') . '</p>';
            $url = $this->editUrl($post->ID);
            if ($url !== '') {
                echo '<p><a class="button button-primary" href="' . esc_url($url) . '">' . esc_html__('Edit in Pagecraft', 'pagecraft-connector') . '</a></p>';
            } else {
                echo '<p><strong>' . esc_html__('Edit in Pagecraft', 'pagecraft-connector') . '</strong></p><p>' . esc_html__('Connect this WordPress site in Pagecraft Operate to enable a secure editor session.', 'pagecraft-connector') . '</p><p><a class="button" href="' . esc_url(admin_url('admin.php?page=pagecraft')) . '">' . esc_html__('Open Pagecraft Operate', 'pagecraft-connector') . '</a></p>';
            }
        }, 'page', 'side', 'high');
    }

    public function editorAssets(): void
    {
        $postId = $this->currentPostId();
        if (!$this->managedPage($postId)) {
            return;
        }
        wp_enqueue_style('pagecraft-managed-editor', PAGECRAFT_CONNECTOR_URL . 'assets/managed-editor.css', [], PAGECRAFT_CONNECTOR_VERSION);
        wp_enqueue_script('pagecraft-managed-editor', PAGECRAFT_CONNECTOR_URL . 'assets/managed-editor.js', ['wp-data', 'wp-dom-ready', 'wp-notices'], PAGECRAFT_CONNECTOR_VERSION, true);
        $editUrl = $this->editUrl($postId);
        wp_localize_script('pagecraft-managed-editor', 'pagecraftManagedEditor', [
            'editUrl' => $editUrl,
            'notice' => $editUrl !== ''
                ? __('This is a read-only deployment mirror. Edit the source in Pagecraft.', 'pagecraft-connector')
                : __('This is a read-only deployment mirror. Connect Pagecraft in Operate to enable editing.', 'pagecraft-connector'),
            'actionLabel' => __('Edit in Pagecraft', 'pagecraft-connector'),
            'lockedLabels' => [
                __('Featured image'),
                __('Status'),
                __('Date'),
                __('Schedule'),
                __('Publish'),
                __('Visibility'),
                __('URL'),
                __('Permalink'),
                __('Slug'),
                __('Template'),
                __('Discussion'),
                __('Parent'),
                __('Order'),
            ],
        ]);
    }

    public function adminBodyClass(string $classes): string
    {
        $postId = $this->currentPostId();
        return $this->managedPage($postId)
            ? trim($classes . ' pagecraft-managed-editor')
            : $classes;
    }

    private function managedPage(int $postId): bool
    {
        return $postId > 0
            && get_post_type($postId) === 'page'
            && get_post_meta($postId, '_pagecraft_managed', true) === '1';
    }

    private function editUrl(int $postId): string
    {
        if (!$this->connection->isConfigured() || !$this->connection->can('editor:open')) {
            return '';
        }
        return add_query_arg([
            'page' => 'pagecraft-editor',
            'post_id' => $postId,
        ], admin_url('admin.php'));
    }

    private function currentPostId(): int
    {
        global $post;
        if ($post instanceof \WP_Post) {
            return $post->ID;
        }
        return absint($_GET['post'] ?? 0);
    }
}
