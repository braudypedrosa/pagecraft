<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\ContentIndex;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\HttpClient;

final class ContentIndexTest extends ConnectorTestCase
{
    public function test_collector_includes_only_public_native_pages_and_posts(): void
    {
        $this->post(1, 'page', 'publish', 'About &amp; Team', 'about', '2026-08-25 02:03:04');
        $this->post(2, 'post', 'publish', 'News', 'news', '2026-08-25 03:04:05');
        $this->post(3, 'page', 'private', 'Private', 'private');
        $this->post(4, 'post', 'draft', 'Draft', 'draft');
        $this->post(5, 'page', 'trash', 'Trash', 'trash');
        $this->post(6, 'page', 'publish', 'Managed', 'managed');
        $GLOBALS['pagecraft_test_post_meta'][6]['_pagecraft_managed'] = '1';
        $this->post(7, 'page', 'publish', 'External permalink', 'external');
        $GLOBALS['pagecraft_test_permalinks'][7] = 'https://evil.example/external/';
        $this->post(8, 'attachment', 'publish', 'Media', 'media');
        $this->post(9, 'page', 'publish', 'Query permalink', 'query');
        $GLOBALS['pagecraft_test_permalinks'][9] = 'http://localhost:8088/query/?preview=1';

        $items = $this->index()->collect();

        $this->assertSame([
            [
                'id' => 'wp:page:1',
                'objectType' => 'page',
                'title' => 'About & Team',
                'url' => 'http://localhost:8088/about/',
                'modifiedAt' => '2026-08-25T02:03:04Z',
            ],
            [
                'id' => 'wp:post:2',
                'objectType' => 'post',
                'title' => 'News',
                'url' => 'http://localhost:8088/news/',
                'modifiedAt' => '2026-08-25T03:04:05Z',
            ],
        ], $items);
    }

    public function test_collector_is_deterministic_sorted_and_bounded_to_two_thousand_items(): void
    {
        for ($id = 2005; $id >= 1; $id--) {
            $this->post($id, $id % 2 === 0 ? 'post' : 'page', 'publish', 'Item ' . $id, 'item-' . $id);
        }

        $first = $this->index()->collect();
        $second = $this->index()->collect();
        $ids = array_column($first, 'id');
        $sorted = $ids;
        sort($sorted, SORT_STRING);

        $this->assertCount(2000, $first);
        $this->assertSame($sorted, $ids);
        $this->assertSame($first, $second);
        $this->assertCount(2000, array_unique($ids));
    }

    public function test_collector_normalizes_server_title_limits_and_enforces_target_path_boundary(): void
    {
        $GLOBALS['pagecraft_test_home'] = 'https://wp.example/site';
        $this->post(20, 'page', 'publish', '', 'untitled');
        $this->post(21, 'post', 'publish', str_repeat('A', 260), 'long-title');
        $this->post(22, 'page', 'publish', 'Outside', 'outside');
        $this->post(23, 'post', 'publish', str_repeat("\u{1F680}", 140), 'unicode-title');
        $GLOBALS['pagecraft_test_permalinks'][20] = 'https://wp.example/site/untitled/';
        $GLOBALS['pagecraft_test_permalinks'][21] = 'https://wp.example/site/long-title/';
        $GLOBALS['pagecraft_test_permalinks'][22] = 'https://wp.example/outside/';
        $GLOBALS['pagecraft_test_permalinks'][23] = 'https://wp.example/site/unicode-title/';

        $items = $this->index()->collect();

        $this->assertSame(['wp:page:20', 'wp:post:21', 'wp:post:23'], array_column($items, 'id'));
        $this->assertSame('Untitled Page #20', $items[0]['title']);
        $this->assertSame(240, strlen($items[1]['title']));
        $this->assertStringStartsWith('https://wp.example/site/', $items[1]['url']);
        $this->assertSame(120, count(preg_split('//u', $items[2]['title'], -1, PREG_SPLIT_NO_EMPTY)));
    }

    public function test_full_replacement_snapshot_removes_deleted_native_item_with_next_generation(): void
    {
        $this->configuredConnection();
        $this->post(1, 'page', 'publish', 'One', 'one');
        $this->post(2, 'post', 'publish', 'Two', 'two');
        $requests = [];
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$requests): array {
            $requests[] = ['url' => $url, 'args' => $args, 'body' => json_decode((string) $args['body'], true, 32, JSON_THROW_ON_ERROR)];
            return [
                'response' => ['code' => 200],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => '{"status":"applied"}',
            ];
        };
        $index = $this->index();

        $this->assertTrue($index->publish());
        unset($GLOBALS['pagecraft_test_posts'][2]);
        $this->assertTrue($index->publish());

        $this->assertCount(2, $requests);
        $this->assertSame(1, $requests[0]['body']['generation']);
        $this->assertSame(['wp:page:1', 'wp:post:2'], array_column($requests[0]['body']['items'], 'id'));
        $this->assertSame(
            ['id', 'objectType', 'title', 'url', 'modifiedAt'],
            array_keys($requests[0]['body']['items'][0]),
            'The connector payload must match the server/store/UI ContentIndexItemV1 field contract exactly.'
        );
        $this->assertArrayNotHasKey('type', $requests[0]['body']['items'][0]);
        $this->assertSame(2, $requests[1]['body']['generation']);
        $this->assertSame(['wp:page:1'], array_column($requests[1]['body']['items'], 'id'));
        $this->assertSame('installation-unit', $requests[1]['body']['installationId']);
        $this->assertSame('PUT', $requests[1]['args']['method']);
        $this->assertSame('Bearer access-secret-value', $requests[1]['args']['headers']['Authorization']);
        $this->assertStringEndsWith('/v1/connections/connection-unit/content-index', $requests[1]['url']);
    }

    public function test_lost_response_retries_byte_identical_generation_and_snapshot(): void
    {
        $this->configuredConnection();
        $this->post(9, 'page', 'publish', 'Nine', 'nine');
        $requests = [];
        $attempt = 0;
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$requests, &$attempt): array|\WP_Error {
            $requests[] = ['url' => $url, 'args' => $args];
            $attempt++;
            if ($attempt === 1) {
                return new \WP_Error('http_request_failed', 'Response lost after Pagecraft committed the generation.');
            }
            return ['response' => ['code' => 200], 'headers' => [], 'body' => '{"status":"duplicate"}'];
        };
        $index = $this->index();

        $lost = $index->publish();
        $pending = $index->state()['pending'] ?? null;
        $retried = $index->publish();

        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertIsArray($pending);
        $this->assertSame(1, $pending['generation']);
        $this->assertTrue($retried);
        $this->assertCount(2, $requests);
        $this->assertSame($requests[0]['url'], $requests[1]['url']);
        $this->assertSame($requests[0]['args']['body'], $requests[1]['args']['body']);
        $this->assertNull($index->state()['pending']);
        $this->assertSame(1, $index->state()['published_generation']);
    }

    /** @dataProvider retainedHttpFailures */
    public function test_stale_or_non_success_response_retains_exact_pending_snapshot(int $status): void
    {
        $this->configuredConnection();
        $this->post(10, 'post', 'publish', 'Ten', 'ten');
        $requests = [];
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$requests, $status): array {
            $requests[] = (string) $args['body'];
            return [
                'response' => ['code' => $status],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => json_encode(['error' => $status === 409 ? 'stale-generation' : 'temporarily-unavailable'], JSON_THROW_ON_ERROR),
            ];
        };
        $index = $this->index();

        $first = $index->publish();
        $pending = $index->state()['pending'] ?? null;
        $second = $index->publish();

        $this->assertInstanceOf(\WP_Error::class, $first);
        $this->assertInstanceOf(\WP_Error::class, $second);
        $this->assertIsArray($pending);
        $this->assertSame(1, $pending['generation']);
        $this->assertSame($requests[0], $requests[1]);
        $this->assertSame(1, ($index->state()['pending'] ?? [])['generation']);
        $this->assertGreaterThanOrEqual(2, ($index->state()['pending'] ?? [])['attempts']);
    }

    /** @return iterable<string,array{int}> */
    public static function retainedHttpFailures(): iterable
    {
        yield 'stale generation' => [409];
        yield 'server unavailable' => [503];
    }

    public function test_hooks_debounce_native_changes_and_queue_pair_and_sync_refreshes(): void
    {
        $this->post(11, 'page', 'publish', 'Eleven', 'eleven');
        $index = $this->index();
        $index->hooks();

        foreach ([
            ContentIndex::PUBLISH_HOOK,
            'pagecraft_connector_pairing_confirmed',
            'pagecraft_connector_sync_succeeded',
            'save_post_page',
            'save_post_post',
            'deleted_post',
        ] as $hook) {
            $this->assertArrayHasKey($hook, $GLOBALS['pagecraft_test_registered_actions']);
        }

        $index->nativeSaved(11, $GLOBALS['pagecraft_test_posts'][11], true);
        $index->nativeSaved(11, $GLOBALS['pagecraft_test_posts'][11], true);
        $this->assertCount(1, $GLOBALS['pagecraft_test_scheduled_events'], 'Repeated native saves debounce to one replacement-index job.');
        $this->assertSame(ContentIndex::PUBLISH_HOOK, $GLOBALS['pagecraft_test_scheduled_events'][0]['hook']);

        $GLOBALS['pagecraft_test_post_meta'][11]['_pagecraft_managed'] = '1';
        $index->nativeSaved(11, $GLOBALS['pagecraft_test_posts'][11], true);
        $this->assertCount(1, $GLOBALS['pagecraft_test_scheduled_events']);
        $index->nativeDeleted(11, $GLOBALS['pagecraft_test_posts'][11]);
        $this->assertCount(1, $GLOBALS['pagecraft_test_scheduled_events']);

        $index->queueAfterLifecycle(['status' => 'current']);
        $this->assertCount(1, $GLOBALS['pagecraft_test_scheduled_events']);
        $this->assertLessThanOrEqual(time() + 5, $GLOBALS['pagecraft_test_scheduled_events'][0]['timestamp']);
    }

    private function index(): ContentIndex
    {
        $connection = new Connection();
        return new ContentIndex($connection, new HttpClient($connection));
    }

    private function configuredConnection(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'api_origin' => 'http://localhost:8787',
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'profile' => 'existing-theme',
            'environment' => 'staging',
            'access_token' => Crypto::seal('access-secret-value'),
            'refresh_token' => Crypto::seal('refresh-secret-value'),
            'access_expires_at' => time() + HOUR_IN_SECONDS,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'lifecycle_fence' => 'unit-lifecycle-fence-1234567890',
        ];
    }

    private function post(
        int $id,
        string $type,
        string $status,
        string $title,
        string $slug,
        string $modified = '2026-08-25 01:02:03'
    ): void {
        $GLOBALS['pagecraft_test_posts'][$id] = new \WP_Post([
            'ID' => $id,
            'post_type' => $type,
            'post_status' => $status,
            'post_title' => $title,
            'post_name' => $slug,
            'post_modified_gmt' => $modified,
        ]);
    }
}
