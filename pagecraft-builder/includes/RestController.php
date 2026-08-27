<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class RestController
{
    public const NAMESPACE = 'pagecraft/v1';

    public function register(): void
    {
        add_action('rest_api_init', [$this, 'routes']);
    }

    public function routes(): void
    {
        register_rest_route(self::NAMESPACE, '/session', [
            'methods' => 'GET',
            'callback' => [$this, 'session'],
            'permission_callback' => static fn (): bool => current_user_can(Capabilities::EDIT),
        ]);
        register_rest_route(self::NAMESPACE, '/pages', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'pages'],
                'permission_callback' => static fn (): bool => current_user_can(Capabilities::EDIT),
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'createPage'],
                'permission_callback' => static fn (): bool => current_user_can(Capabilities::EDIT)
                    && current_user_can('edit_pages'),
            ],
        ]);
        register_rest_route(self::NAMESPACE, '/pages/(?P<id>\d+)', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'page'],
                'permission_callback' => [$this, 'canEditPage'],
            ],
            [
                'methods' => 'PATCH',
                'callback' => [$this, 'updatePage'],
                'permission_callback' => [$this, 'canEditPage'],
            ],
        ]);
        register_rest_route(self::NAMESPACE, '/pages/(?P<id>\d+)/document', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'document'],
                'permission_callback' => [$this, 'canEditPage'],
            ],
            [
                'methods' => 'PUT',
                'callback' => [$this, 'saveDocument'],
                'permission_callback' => [$this, 'canEditPage'],
            ],
        ]);
        register_rest_route(self::NAMESPACE, '/pages/(?P<id>\d+)/revisions', [
            'methods' => 'GET',
            'callback' => [$this, 'revisions'],
            'permission_callback' => [$this, 'canEditPage'],
        ]);
        register_rest_route(self::NAMESPACE, '/pages/(?P<id>\d+)/revisions/(?P<version>\d+)/restore', [
            'methods' => 'POST',
            'callback' => [$this, 'restore'],
            'permission_callback' => [$this, 'canEditPage'],
        ]);
        register_rest_route(self::NAMESPACE, '/media', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'media'],
                'permission_callback' => static fn (): bool => current_user_can(Capabilities::EDIT),
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'uploadMedia'],
                'permission_callback' => static fn (): bool => current_user_can(Capabilities::EDIT)
                    && current_user_can('upload_files'),
            ],
        ]);
        register_rest_route(self::NAMESPACE, '/media/(?P<id>\d+)', [
            'methods' => 'DELETE',
            'callback' => [$this, 'deleteMedia'],
            'permission_callback' => static fn (\WP_REST_Request $request): bool => current_user_can(Capabilities::EDIT)
                && current_user_can('delete_post', (int) $request['id']),
        ]);
        register_rest_route(self::NAMESPACE, '/menus', [
            'methods' => 'GET',
            'callback' => [$this, 'menus'],
            'permission_callback' => static fn (): bool => current_user_can(Capabilities::MANAGE)
                && current_user_can('edit_theme_options'),
        ]);
        register_rest_route(self::NAMESPACE, '/menus/(?P<id>\d+)', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'menu'],
                'permission_callback' => static fn (): bool => current_user_can(Capabilities::MANAGE)
                    && current_user_can('edit_theme_options'),
            ],
            [
                'methods' => 'PUT',
                'callback' => [$this, 'saveMenu'],
                'permission_callback' => static fn (): bool => current_user_can(Capabilities::MANAGE)
                    && current_user_can('edit_theme_options'),
            ],
        ]);
        register_rest_route(self::NAMESPACE, '/settings', [
            'methods' => 'GET',
            'callback' => [$this, 'settings'],
            'permission_callback' => static fn (): bool => current_user_can(Capabilities::EDIT),
        ]);
    }

    public function canEditPage(\WP_REST_Request $request): bool
    {
        return current_user_can(Capabilities::EDIT)
            && current_user_can('edit_post', (int) $request['id'])
            && get_post_type((int) $request['id']) === 'page';
    }

    public function session(): \WP_REST_Response
    {
        $user = wp_get_current_user();
        $capabilities = ['edit_document', 'edit_structure', 'restore_revisions'];
        if (current_user_can('edit_pages')) {
            $capabilities[] = 'manage_pages';
        }
        if (current_user_can('upload_files')) {
            $capabilities[] = 'upload_media';
        }
        if (current_user_can(Capabilities::MANAGE) && current_user_can('edit_theme_options')) {
            $capabilities[] = 'manage_menus';
        }
        return new \WP_REST_Response([
            'authenticated' => $user->exists(),
            'userId' => (string) $user->ID,
            'displayName' => (string) $user->display_name,
            'capabilities' => $capabilities,
        ]);
    }

    public function pages(): \WP_REST_Response
    {
        $posts = get_posts([
            'post_type' => 'page',
            'post_status' => ['draft', 'publish', 'private', 'trash'],
            'posts_per_page' => 200,
            'orderby' => ['menu_order' => 'ASC', 'title' => 'ASC'],
        ]);
        return new \WP_REST_Response(array_map([$this, 'pagePayload'], $posts));
    }

    public function page(\WP_REST_Request $request): \WP_REST_Response
    {
        return new \WP_REST_Response($this->pagePayload(get_post((int) $request['id'])));
    }

    public function createPage(\WP_REST_Request $request): \WP_REST_Response
    {
        $input = $request->get_json_params();
        $status = $this->status((string) ($input['status'] ?? 'draft'));
        if (in_array($status, ['publish', 'private'], true) && !current_user_can('publish_pages')) {
            return new \WP_REST_Response(['error' => __('You are not allowed to publish pages.', 'pagecraft-builder')], 403);
        }
        $id = wp_insert_post([
            'post_type' => 'page',
            'post_status' => $status,
            'post_title' => sanitize_text_field((string) ($input['title'] ?? __('Untitled page', 'pagecraft-builder'))),
            'post_name' => sanitize_title((string) ($input['slug'] ?? '')),
            'post_parent' => max(0, (int) ($input['parentId'] ?? 0)),
        ], true);
        if (is_wp_error($id)) {
            return new \WP_REST_Response(['error' => $id->get_error_message()], 400);
        }
        return new \WP_REST_Response($this->pagePayload(get_post((int) $id)), 201);
    }

    public function updatePage(\WP_REST_Request $request): \WP_REST_Response
    {
        $input = $request->get_json_params();
        $update = ['ID' => (int) $request['id']];
        if (array_key_exists('title', $input)) {
            $update['post_title'] = sanitize_text_field((string) $input['title']);
        }
        if (array_key_exists('slug', $input)) {
            $update['post_name'] = sanitize_title((string) $input['slug']);
        }
        if (array_key_exists('status', $input)) {
            $update['post_status'] = $this->status((string) $input['status']);
            if (in_array($update['post_status'], ['publish', 'private'], true) && !current_user_can('publish_pages')) {
                return new \WP_REST_Response(['error' => __('You are not allowed to publish pages.', 'pagecraft-builder')], 403);
            }
        }
        if (array_key_exists('parentId', $input)) {
            $update['post_parent'] = max(0, (int) $input['parentId']);
        }
        $id = wp_update_post($update, true);
        if (is_wp_error($id)) {
            return new \WP_REST_Response(['error' => $id->get_error_message()], 400);
        }
        return new \WP_REST_Response($this->pagePayload(get_post((int) $id)));
    }

    public function document(\WP_REST_Request $request): \WP_REST_Response
    {
        return $this->editorResponse(function () use ($request): array {
            $loaded = (new PageEditor())->load((int) $request['id']);
            if (is_array($loaded['document'])) {
                $loaded['document'] = (new NativeMenu())->hydrateDocument($loaded['document']);
            }
            return $loaded;
        });
    }

    public function saveDocument(\WP_REST_Request $request): \WP_REST_Response
    {
        return $this->editorResponse(function () use ($request): array {
            $input = $request->get_json_params();
            $document = $input['document'] ?? $input['doc'] ?? null;
            if (is_array($document)) {
                return (new NativeMenu())->synchronizeAndRun(
                    $document,
                    static fn (): array => (new PageEditor())->save((int) $request['id'], $input)
                );
            }
            return (new PageEditor())->save((int) $request['id'], $input);
        });
    }

    public function revisions(\WP_REST_Request $request): \WP_REST_Response
    {
        return $this->editorResponse(static fn (): array => (new PageEditor())->revisions((int) $request['id']));
    }

    public function restore(\WP_REST_Request $request): \WP_REST_Response
    {
        $input = $request->get_json_params();
        return $this->editorResponse(static fn (): array => (new PageEditor())->restore(
            (int) $request['id'],
            (int) $request['version'],
            (int) ($input['currentVersion'] ?? -1)
        ));
    }

    public function media(): \WP_REST_Response
    {
        $attachments = get_posts([
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'post_mime_type' => 'image',
            'posts_per_page' => 200,
            'orderby' => 'date',
            'order' => 'DESC',
        ]);
        return new \WP_REST_Response(array_map([$this, 'mediaPayload'], $attachments));
    }

    public function uploadMedia(): \WP_REST_Response
    {
        if (!function_exists('media_handle_upload')) {
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }
        $id = media_handle_upload('file', 0, [], ['test_form' => false]);
        if (is_wp_error($id)) {
            return new \WP_REST_Response(['error' => $id->get_error_message()], 400);
        }
        return new \WP_REST_Response($this->mediaPayload(get_post((int) $id)), 201);
    }

    public function deleteMedia(\WP_REST_Request $request): \WP_REST_Response
    {
        $id = (int) $request['id'];
        if (get_post_type($id) !== 'attachment' || !wp_delete_attachment($id, true)) {
            return new \WP_REST_Response(['error' => __('WordPress could not delete that media item.', 'pagecraft-builder')], 400);
        }
        return new \WP_REST_Response(['removed' => (string) $id]);
    }

    public function menus(): \WP_REST_Response
    {
        return $this->menuResponse(static fn (): array => (new NativeMenu())->list());
    }

    public function menu(\WP_REST_Request $request): \WP_REST_Response
    {
        return $this->menuResponse(static fn (): array => (new NativeMenu())->get((int) $request['id']));
    }

    public function saveMenu(\WP_REST_Request $request): \WP_REST_Response
    {
        return $this->menuResponse(static fn (): array => (new NativeMenu())->save(
            (int) $request['id'],
            $request->get_json_params()
        ));
    }

    public function settings(): \WP_REST_Response
    {
        $theme = wp_get_theme();
        return new \WP_REST_Response([
            'theme' => (string) $theme->get_stylesheet(),
            'editor' => true,
            'wordpressVersion' => (string) get_bloginfo('version'),
        ]);
    }

    /** @return array<string,mixed> */
    private function pagePayload(?\WP_Post $post): array
    {
        if (!$post || $post->post_type !== 'page') {
            return [];
        }
        return [
            'id' => (string) $post->ID,
            'title' => get_the_title($post),
            'slug' => (string) $post->post_name,
            'status' => in_array($post->post_status, ['draft', 'publish', 'private', 'trash'], true)
                ? $post->post_status : 'draft',
            'url' => get_permalink($post),
            'parentId' => $post->post_parent > 0 ? (string) $post->post_parent : null,
            'modifiedAt' => get_post_modified_time('c', true, $post),
        ];
    }

    /** @return array<string,mixed> */
    private function mediaPayload(?\WP_Post $post): array
    {
        if (!$post || $post->post_type !== 'attachment') {
            return [];
        }
        $metadata = wp_get_attachment_metadata($post->ID);
        $file = get_attached_file($post->ID);
        return [
            'id' => (string) $post->ID,
            'name' => get_the_title($post),
            'mimeType' => (string) $post->post_mime_type,
            'url' => (string) wp_get_attachment_url($post->ID),
            'size' => is_string($file) && is_file($file) ? (int) filesize($file) : 0,
            'width' => is_array($metadata) ? (int) ($metadata['width'] ?? 0) : 0,
            'height' => is_array($metadata) ? (int) ($metadata['height'] ?? 0) : 0,
        ];
    }

    private function status(string $status): string
    {
        return in_array($status, ['draft', 'publish', 'private', 'trash'], true) ? $status : 'draft';
    }

    /** @param callable():array<mixed> $operation */
    private function editorResponse(callable $operation): \WP_REST_Response
    {
        try {
            return new \WP_REST_Response($operation());
        } catch (EditorConflict $error) {
            return new \WP_REST_Response([
                'error' => $error->getMessage(),
                'conflict' => ['mine' => $error->mine, 'theirs' => $error->theirs],
            ], 409);
        } catch (PackageException $error) {
            return new \WP_REST_Response(['error' => $error->getMessage()], 400);
        }
    }

    /** @param callable():array<mixed> $operation */
    private function menuResponse(callable $operation): \WP_REST_Response
    {
        try {
            return new \WP_REST_Response($operation());
        } catch (PackageException $error) {
            return new \WP_REST_Response(['error' => $error->getMessage()], 400);
        }
    }
}
