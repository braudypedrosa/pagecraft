<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\CmsWriteback;
use Pagecraft\Connector\Connection;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\ReleaseRepository;

final class CmsQueuePersistenceTest extends ConnectorTestCase
{
    protected function tearDown(): void
    {
        unset($_POST['pagecraft_cms_nonce'], $_POST['pagecraft_pending_fields']);
        parent::tearDown();
    }

    public function test_failed_new_snapshot_insert_preserves_the_previous_deliverable_queue(): void
    {
        [$writeback, $post] = $this->writeback();
        $GLOBALS['pagecraft_test_fail_cms_draft_insert'] = true;

        $writeback->queuePrivateSnapshot($post->ID, $post, true);

        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftInserts);
        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftEvents, 'No older queue row may be superseded before the replacement insert succeeds.');
        $notice = get_transient('pagecraft_notice_' . get_current_user_id());
        $this->assertIsArray($notice);
        $this->assertSame('error', $notice['type']);
        $this->assertStringContainsString('previously queued draft remains available', $notice['message']);
    }

    public function test_successful_snapshot_is_inserted_before_only_older_ids_are_superseded(): void
    {
        [$writeback, $post] = $this->writeback();

        $writeback->queuePrivateSnapshot($post->ID, $post, true);

        $this->assertCount(1, $GLOBALS['wpdb']->cmsDraftInserts);
        $this->assertSame(['insert', 'supersede'], $GLOBALS['wpdb']->cmsDraftEvents);
        $this->assertSame('queued', $GLOBALS['wpdb']->cmsDraftInserts[0]['status']);
        $this->assertSame('connection-cms-queue', $GLOBALS['wpdb']->cmsDraftInserts[0]['connection_id']);
        $this->assertSame('item-unit', $GLOBALS['wpdb']->cmsDraftInserts[0]['source_id']);
        $this->assertSame(1, $GLOBALS['wpdb']->cmsDraftInserts[0]['id']);

        $source = (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/CmsWriteback.php');
        $insert = strpos($source, '$inserted = $wpdb->insert($table');
        $olderFence = strpos($source, "AND id < %d", (int) $insert);
        $this->assertIsInt($insert);
        $this->assertIsInt($olderFence);
        $this->assertTrue($insert < $olderFence);
    }

    public function test_old_project_managed_item_stays_read_only_after_repair_until_new_release_is_active(): void
    {
        [$writeback, $post] = $this->writeback();
        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['connection_id'] = 'connection-new-project';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['site_id'] = 'site-new-project';

        $writeback->queuePrivateSnapshot($post->ID, $post, true);

        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftInserts);
        $this->assertFalse(get_transient('pagecraft_notice_' . get_current_user_id()));
    }

    public function test_staging_target_never_queues_or_schedules_a_cms_writeback(): void
    {
        [$writeback, $post] = $this->writeback();
        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['environment'] = 'staging';

        $writeback->queuePrivateSnapshot($post->ID, $post, true);

        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftInserts);
        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftEvents);
        $this->assertSame([], $GLOBALS['pagecraft_test_scheduled_events']);
    }

    public function test_removed_item_cannot_queue_from_stale_managed_post_metadata(): void
    {
        [$writeback, $post] = $this->writeback();
        $GLOBALS['wpdb']->objectRows = [];

        $writeback->queuePrivateSnapshot($post->ID, $post, true);

        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftInserts);
        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftEvents);
    }

    public function test_reused_source_id_cannot_queue_from_a_different_post_than_the_active_mapping(): void
    {
        [$writeback, $post] = $this->writeback();
        $GLOBALS['wpdb']->objectRows[0]['object_id'] = 99;

        $writeback->queuePrivateSnapshot($post->ID, $post, true);

        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftInserts);
        $this->assertSame([], $GLOBALS['wpdb']->cmsDraftEvents);
    }

    public function test_cross_project_activation_cannot_resolve_current_connection_drafts_against_old_bytes(): void
    {
        [$writeback] = $this->writeback();
        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['connection_id'] = 'connection-new-project';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['site_id'] = 'site-new-project';

        $writeback->resolveForActivation('deployment-cms-queue');

        $this->assertSame(0, $GLOBALS['wpdb']->objectResultQueries);
    }

    /** @return array{CmsWriteback,\WP_Post} */
    private function writeback(): array
    {
        $post = new \WP_Post([
            'ID' => 41,
            'post_type' => 'pagecraft_entry',
            'post_title' => 'Active title',
            'post_name' => 'active-title',
            'post_content' => 'Active body',
            'post_excerpt' => 'Active excerpt',
        ]);
        $GLOBALS['pagecraft_test_posts'][$post->ID] = $post;
        $GLOBALS['pagecraft_test_post_meta'][$post->ID] = [
            '_pagecraft_managed' => '1',
            '_pagecraft_item_id' => 'item-unit',
            '_pagecraft_collection_id' => 'posts',
            '_pagecraft_collection_schema' => [
                'format' => 'pagecraft.collection-schema.v1',
                'fields' => [[
                    'id' => 'title',
                    'name' => 'Title',
                    'type' => 'text',
                    'required' => true,
                    'choices' => [],
                ]],
            ],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-cms-queue',
            'site_id' => 'site-cms-queue',
            'api_origin' => 'http://localhost:8787',
            'scopes' => ['cms:write'],
            'environment' => 'production',
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-cms-queue';
        $GLOBALS['wpdb']->releaseRows['deployment-cms-queue'] = [
            'id' => 1,
            'deployment_id' => 'deployment-cms-queue',
            'release_id' => 'release-cms-queue',
            'connection_id' => 'connection-cms-queue',
            'site_id' => 'site-cms-queue',
            'sequence_no' => 1,
            'source_version' => 1,
            'status' => 'active',
            'manifest' => json_encode(['connectionId' => 'connection-cms-queue', 'siteId' => 'site-cms-queue'], JSON_THROW_ON_ERROR),
            'manifest_hash' => str_repeat('a', 64),
            'deployment_hash' => str_repeat('b', 64),
            'artifact_hash' => str_repeat('c', 64),
            'created_at' => '2026-08-26 00:00:00',
            'verified_at' => '2026-08-26 00:01:00',
        ];
        $GLOBALS['wpdb']->objectRows[] = [
            'deployment_id' => 'deployment-cms-queue',
            'release_id' => 'release-cms-queue',
            'source_type' => 'cms',
            'source_id' => 'item-unit',
            'object_id' => $post->ID,
            'state' => 'active',
        ];
        $_POST['pagecraft_cms_nonce'] = 'unit-nonce';
        $_POST['pagecraft_pending_fields'] = [
            'f_' . substr(hash('sha256', 'title'), 0, 20) => 'New private title',
        ];
        $connection = new Connection();
        $repository = new ReleaseRepository();
        return [
            new CmsWriteback(
                $connection,
                new HttpClient($connection),
                $repository,
                null,
                static fn (): array => []
            ),
            $post,
        ];
    }
}
