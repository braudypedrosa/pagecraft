<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/** Publishes a bounded, read-only replacement index of native WP content. */
final class ContentIndex
{
    public const PUBLISH_HOOK = 'pagecraft_connector_publish_content_index';
    public const STATE_OPTION = 'pagecraft_content_index_state';
    private const MAX_ITEMS = 2000;
    private const BATCH_SIZE = 250;
    private const DEBOUNCE_SECONDS = 60;
    private const RETRY_SECONDS = 5 * MINUTE_IN_SECONDS;

    private readonly DeploymentLock $lifecycleLock;

    public function __construct(
        private readonly Connection $connection,
        private readonly HttpClient $http,
        ?DeploymentLock $lifecycleLock = null
    ) {
        $this->lifecycleLock = $lifecycleLock ?? new DeploymentLock();
    }

    public function hooks(): void
    {
        add_action(self::PUBLISH_HOOK, [$this, 'publish']);
        add_action('pagecraft_connector_pairing_confirmed', [$this, 'queueAfterLifecycle']);
        add_action('pagecraft_connector_sync_succeeded', [$this, 'queueAfterLifecycle']);
        add_action('save_post_page', [$this, 'nativeSaved'], 100, 3);
        add_action('save_post_post', [$this, 'nativeSaved'], 100, 3);
        add_action('deleted_post', [$this, 'nativeDeleted'], 100, 2);
        add_action('trashed_post', [$this, 'nativeChanged'], 100, 1);
        add_action('untrashed_post', [$this, 'nativeChanged'], 100, 1);
        add_action('init', [$this, 'ensureRetryScheduled']);
    }

    public function queueAfterLifecycle(mixed ...$ignored): void
    {
        $this->debounce(5);
    }

    public function nativeSaved(int $postId, mixed $post = null, bool $update = false): void
    {
        if (wp_is_post_revision($postId) || wp_is_post_autosave($postId)) {
            return;
        }
        $post = $post instanceof \WP_Post ? $post : get_post($postId);
        if (!$post instanceof \WP_Post
            || !in_array($post->post_type, ['page', 'post'], true)
            || get_post_meta($postId, '_pagecraft_managed', true) === '1') {
            return;
        }
        $this->debounce();
    }

    public function nativeDeleted(int $postId, mixed $post = null): void
    {
        $post = $post instanceof \WP_Post ? $post : get_post($postId);
        if ($post instanceof \WP_Post && in_array($post->post_type, ['page', 'post'], true)) {
            $this->debounce();
        }
    }

    public function nativeChanged(int $postId): void
    {
        $post = get_post($postId);
        if ($post instanceof \WP_Post && in_array($post->post_type, ['page', 'post'], true)) {
            $this->debounce();
        }
    }

    public function ensureRetryScheduled(): void
    {
        $state = $this->state();
        if (is_array($state['pending'] ?? null) && !wp_next_scheduled(self::PUBLISH_HOOK)) {
            wp_schedule_single_event(time() + self::RETRY_SECONDS, self::PUBLISH_HOOK);
        }
    }

    /** @return list<array{id:string,objectType:string,title:string,url:string,modifiedAt:string}> */
    public function collect(): array
    {
        $items = [];
        $page = 1;
        while (count($items) < self::MAX_ITEMS) {
            $posts = get_posts([
                'post_type' => ['page', 'post'],
                'post_status' => 'publish',
                'posts_per_page' => self::BATCH_SIZE,
                'paged' => $page,
                'orderby' => ['post_type' => 'ASC', 'ID' => 'ASC'],
                'order' => 'ASC',
                'no_found_rows' => true,
                'suppress_filters' => true,
            ]);
            if (!is_array($posts) || $posts === []) {
                break;
            }
            foreach ($posts as $post) {
                if (!$post instanceof \WP_Post
                    || $post->ID < 1
                    || !in_array($post->post_type, ['page', 'post'], true)
                    || $post->post_status !== 'publish'
                    || get_post_meta($post->ID, '_pagecraft_managed', true) === '1') {
                    continue;
                }
                $url = get_permalink($post);
                if (!is_string($url) || !$this->validNativePermalink($url)) {
                    continue;
                }
                $modified = $this->modifiedIso((string) ($post->post_modified_gmt ?? ''));
                if ($modified === '') {
                    continue;
                }
                $items[] = [
                    'id' => 'wp:' . $post->post_type . ':' . $post->ID,
                    'objectType' => $post->post_type,
                    'title' => $this->indexTitle((string) $post->post_title, $post->post_type, $post->ID),
                    'url' => $url,
                    'modifiedAt' => $modified,
                ];
                if (count($items) >= self::MAX_ITEMS) {
                    break 2;
                }
            }
            if (count($posts) < self::BATCH_SIZE) {
                break;
            }
            $page++;
        }
        usort($items, static fn (array $left, array $right): int => strcmp($left['id'], $right['id']));
        return $items;
    }

    /** @return true|\WP_Error */
    public function publish(): bool|\WP_Error
    {
        if (!$this->connection->isConfigured() || !$this->connection->can('content:index')) {
            return new \WP_Error('pagecraft_content_index_unavailable', 'The connected target cannot receive the read-only WordPress content index.');
        }
        $binding = $this->connection->bindingValid();
        if (is_wp_error($binding)) {
            return $binding;
        }
        $lease = $this->lifecycleLock->acquire('content-index');
        if (is_wp_error($lease)) {
            return $lease;
        }
        try {
            $lifecycle = $this->connection->lifecycleSnapshot();
            if (is_wp_error($lifecycle)) {
                return $lifecycle;
            }
            $state = $this->scopedState();
            if (is_wp_error($state)) {
                return $state;
            }

            $pending = is_array($state['pending'] ?? null) ? $state['pending'] : [];
            if ($pending !== []) {
                $sent = $this->sendPending($state, $pending, $lifecycle);
                if (is_wp_error($sent)) {
                    return $sent;
                }
                $state = $sent;
            }

            $items = $this->collect();
            $hash = hash('sha256', CanonicalJson::encode($items));
            if (hash_equals((string) ($state['last_hash'] ?? ''), $hash)) {
                return true;
            }
            $previousGeneration = max(0, (int) ($state['generation'] ?? 0));
            if ($previousGeneration >= 9007199254740991) {
                return new \WP_Error('pagecraft_content_index_generation_exhausted', 'The native content index generation cannot advance safely. Re-pair this Pagecraft connection.');
            }
            $generation = $previousGeneration + 1;
            $pending = [
                'generation' => $generation,
                'items' => $items,
                'hash' => $hash,
                'attempts' => 0,
                'created_at' => Support::utcNow(),
                'last_attempt_at' => null,
                'last_error_code' => null,
                'last_error_message' => null,
            ];
            $state['generation'] = $generation;
            $state['pending'] = $pending;
            if (!$this->persistState($state)) {
                return new \WP_Error('pagecraft_content_index_persist_failed', 'WordPress could not durably journal the native content index before publishing it.');
            }
            $sent = $this->sendPending($state, $pending, $lifecycle);
            return is_wp_error($sent) ? $sent : true;
        } finally {
            $this->lifecycleLock->release($lease);
        }
    }

    /** @return array<string,mixed> */
    public function state(): array
    {
        $state = get_option(self::STATE_OPTION, []);
        return is_array($state) ? $state : [];
    }

    /** @return array<string,mixed>|\WP_Error */
    private function scopedState(): array|\WP_Error
    {
        $connectionId = $this->connection->connectionId();
        $installationId = $this->connection->installationId();
        $state = $this->state();
        if (hash_equals($connectionId, (string) ($state['connection_id'] ?? ''))
            && hash_equals($installationId, (string) ($state['installation_id'] ?? ''))) {
            return $state;
        }
        $state = [
            'connection_id' => $connectionId,
            'installation_id' => $installationId,
            'generation' => 0,
            'published_generation' => 0,
            'last_hash' => '',
            'pending' => null,
        ];
        if (!$this->persistState($state)) {
            return new \WP_Error('pagecraft_content_index_persist_failed', 'WordPress could not initialize the connection-scoped content index journal.');
        }
        return $state;
    }

    /**
     * @param array<string,mixed> $state
     * @param array<string,mixed> $pending
     * @param array<string,mixed> $lifecycle
     * @return array<string,mixed>|\WP_Error
     */
    private function sendPending(array $state, array $pending, array $lifecycle): array|\WP_Error
    {
        $generation = (int) ($pending['generation'] ?? 0);
        $items = is_array($pending['items'] ?? null) ? $pending['items'] : [];
        $response = $this->http->publishContentIndex($generation, $items, $lifecycle);
        if (is_wp_error($response)) {
            $pending['attempts'] = (int) ($pending['attempts'] ?? 0) + 1;
            $pending['last_attempt_at'] = Support::utcNow();
            $pending['last_error_code'] = $response->get_error_code();
            $pending['last_error_message'] = wp_strip_all_tags($response->get_error_message());
            $state['pending'] = $pending;
            $this->persistState($state);
            $this->debounce(self::RETRY_SECONDS);
            return $response;
        }

        $state['published_generation'] = $generation;
        $state['last_hash'] = (string) ($pending['hash'] ?? hash('sha256', CanonicalJson::encode($items)));
        $state['pending'] = null;
        $state['published_at'] = Support::utcNow();
        if (!$this->persistState($state)) {
            return new \WP_Error(
                'pagecraft_content_index_receipt_persist_failed',
                'Pagecraft accepted the native content index, but WordPress retained the exact generation for an idempotent retry.'
            );
        }
        return $state;
    }

    /** @param array<string,mixed> $state */
    private function persistState(array $state): bool
    {
        update_option(self::STATE_OPTION, $state, false);
        return $this->state() === $state;
    }

    private function debounce(int $delay = self::DEBOUNCE_SECONDS): void
    {
        if (function_exists('wp_clear_scheduled_hook')) {
            wp_clear_scheduled_hook(self::PUBLISH_HOOK);
        }
        wp_schedule_single_event(time() + max(1, $delay), self::PUBLISH_HOOK);
    }

    private function validNativePermalink(string $url): bool
    {
        $parts = wp_parse_url($url);
        $homeParts = wp_parse_url(home_url('/'));
        if (!is_array($parts)
            || !is_array($homeParts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || (string) ($parts['host'] ?? '') === ''
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['query'])
            || isset($parts['fragment'])
            || strlen($url) > 2048
            || (strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
                && strtolower((string) ($parts['host'] ?? '')) !== 'localhost')) {
            return false;
        }
        $origin = Support::normalizeOrigin($url);
        $homeOrigin = Support::normalizeOrigin(home_url('/'));
        $path = (string) ($parts['path'] ?? '/');
        $homePath = rtrim((string) ($homeParts['path'] ?? '/'), '/');
        $pathMatches = $homePath === ''
            || $homePath === '/'
            || $path === $homePath
            || str_starts_with($path, $homePath . '/');
        return $origin !== '' && $homeOrigin !== '' && hash_equals($homeOrigin, $origin) && $pathMatches;
    }

    private function indexTitle(string $title, string $objectType, int $postId): string
    {
        $title = html_entity_decode(wp_strip_all_tags($title), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $title = trim((string) preg_replace('/[\x00-\x1f\x7f]+/u', ' ', $title));
        if ($title === '') {
            return sprintf('Untitled %s #%d', $objectType === 'page' ? 'Page' : 'Post', $postId);
        }
        $characters = preg_split('//u', $title, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($characters)) {
            return substr($title, 0, 240);
        }
        $result = '';
        $utf16Units = 0;
        foreach ($characters as $character) {
            $units = strlen($character) === 4 ? 2 : 1;
            if ($utf16Units + $units > 240) {
                break;
            }
            $result .= $character;
            $utf16Units += $units;
        }
        return $result;
    }

    private function modifiedIso(string $modifiedGmt): string
    {
        if ($modifiedGmt === '' || $modifiedGmt === '0000-00-00 00:00:00') {
            return '';
        }
        $timestamp = strtotime($modifiedGmt . ' UTC');
        return $timestamp === false ? '' : gmdate('Y-m-d\TH:i:s\Z', $timestamp);
    }
}
