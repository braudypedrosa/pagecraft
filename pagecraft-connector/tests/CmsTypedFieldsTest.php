<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\CmsWriteback;
use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseRepository;
use ReflectionMethod;

final class CmsTypedFieldsTest extends ConnectorTestCase
{
    public function test_staging_renders_managed_cms_values_read_only_without_a_write_nonce(): void
    {
        [$cms, $post] = $this->writebackForEnvironment('staging');

        ob_start();
        $cms->renderMetaBox($post);
        $html = (string) ob_get_clean();

        $this->assertStringContainsString('This staging CMS item is read-only', $html);
        $this->assertStringContainsString('<fieldset class="pagecraft-cms-fields" disabled aria-disabled="true">', $html);
        $this->assertStringContainsString('disabled aria-disabled="true"', $html);
        $this->assertStringContainsString('These values are a read-only view of the active signed release.', $html);
        $this->assertStringNotContainsString('name="pagecraft_cms_nonce"', $html);
        $this->assertSame([], $GLOBALS['pagecraft_test_nonce_fields']);
    }

    public function test_production_renders_managed_cms_values_as_private_draft_controls(): void
    {
        [$cms, $post] = $this->writebackForEnvironment('production');

        ob_start();
        $cms->renderMetaBox($post);
        $html = (string) ob_get_clean();

        $this->assertStringContainsString('Changes here are sent only to the Pagecraft draft.', $html);
        $this->assertStringContainsString('<fieldset class="pagecraft-cms-fields">', $html);
        $this->assertStringContainsString('name="pagecraft_cms_nonce"', $html);
        $this->assertStringNotContainsString('disabled aria-disabled="true"', $html);
        $this->assertSame([['action' => 'pagecraft_cms_draft_52', 'name' => 'pagecraft_cms_nonce']], $GLOBALS['pagecraft_test_nonce_fields']);
    }

    public function test_staging_removes_native_update_and_taxonomy_boxes_while_production_keeps_update(): void
    {
        [$staging, $stagingPost] = $this->writebackForEnvironment('staging');
        $staging->addMetaBox($stagingPost);
        $stagingRemoved = array_column($GLOBALS['pagecraft_test_meta_boxes_removed'], 'id');

        $this->assertContains('submitdiv', $stagingRemoved);
        $this->assertContains('tagsdiv-pagecraft_collection', $stagingRemoved);
        $this->assertContains('pagecraft_collectiondiv', $stagingRemoved);

        pagecraft_test_reset_wordpress();
        [$production, $productionPost] = $this->writebackForEnvironment('production');
        $production->addMetaBox($productionPost);
        $productionRemoved = array_column($GLOBALS['pagecraft_test_meta_boxes_removed'], 'id');

        $this->assertNotContains('submitdiv', $productionRemoved);
        $this->assertContains('tagsdiv-pagecraft_collection', $productionRemoved);
        $this->assertContains('pagecraft_collectiondiv', $productionRemoved);
    }

    public function test_managed_cms_native_record_and_metadata_cannot_be_mutated_or_deleted(): void
    {
        [$cms, $post] = $this->writebackForEnvironment('staging');
        $data = ['post_title' => 'Changed', 'post_status' => 'trash', 'post_password' => 'changed'];

        $protected = $cms->protectActiveFields($data, ['ID' => $post->ID], [], true);

        $this->assertSame('Active title', $protected['post_title']);
        $this->assertSame('publish', $protected['post_status']);
        $this->assertSame('', $protected['post_password']);
        $this->assertTrue($cms->protectActiveMeta(false, $post->ID, '_thumbnail_id', 99, false));
        $this->assertFalse($cms->protectActiveMeta(false, $post->ID, '_edit_lock', '1:7', false));
        $this->assertFalse($cms->preventDeletion(null, $post));
    }

    public function test_signed_schema_normalizes_every_current_field_type_and_reference_choices(): void
    {
        $collections = $this->collections();
        $mapper = new Mapper(new ReleaseRepository());
        $schemas = (new ReflectionMethod(Mapper::class, 'normalizeCollectionSchemas'))->invoke($mapper, $collections);

        $this->assertIsArray($schemas, is_wp_error($schemas) ? $schemas->get_error_message() : '');
        $fields = $schemas['articles']['fields'];
        $this->assertSame(['text', 'rich', 'image', 'link', 'number', 'date', 'option', 'bool', 'ref'], array_column($fields, 'type'));
        $this->assertSame(['Draft', 'Published'], array_values($fields[6]['choices']));
        $this->assertSame(['Author One'], array_values($fields[8]['choices']));

        $values = (new ReflectionMethod(Mapper::class, 'validateCmsValues'))->invoke(
            $mapper,
            $collections[0]['items'][0]['values'],
            $schemas['articles'],
            ['hero-one' => true]
        );
        $this->assertIsArray($values, is_wp_error($values) ? $values->get_error_message() : '');
        $this->assertSame('asset:hero-one', $values['hero']);
        $this->assertStringContainsString("update_post_meta(\$postId, '_pagecraft_collection_schema', \$schema)", (string) file_get_contents(PAGECRAFT_CONNECTOR_DIR . 'includes/Mapper.php'));
    }

    public function test_private_typed_values_accept_managed_asset_reference_and_reject_local_attachment_id(): void
    {
        $schema = $this->schema();
        $connection = new Connection();
        $cms = new CmsWriteback(
            $connection,
            new HttpClient($connection),
            new ReleaseRepository(),
            null,
            static fn (): array => ['asset:hero-one' => 'Hero image']
        );
        $key = new ReflectionMethod(CmsWriteback::class, 'fieldInputKey');
        $input = [];
        $values = [
            'title' => 'Typed title',
            'content' => '<p>Safe <strong>rich</strong></p>',
            'hero' => 'asset:hero-one',
            'website' => 'https://example.com/path',
            'price' => '19.95',
            'published' => '2026-08-26',
            'state' => 'Published',
            'featured' => '1',
            'author' => 'author-one',
        ];
        foreach ($values as $fieldId => $value) {
            $input[$key->invoke($cms, $fieldId)] = $value;
        }
        $sanitized = (new ReflectionMethod(CmsWriteback::class, 'sanitizeTypedValues'))->invoke($cms, $input, $schema);

        $this->assertIsArray($sanitized, is_wp_error($sanitized) ? $sanitized->get_error_message() : '');
        $this->assertSame($values, $sanitized);

        $input[$key->invoke($cms, 'hero')] = '42';
        $rejected = (new ReflectionMethod(CmsWriteback::class, 'sanitizeTypedValues'))->invoke($cms, $input, $schema);
        $this->assertInstanceOf(\WP_Error::class, $rejected);
        $this->assertSame('pagecraft_cms_field_type', $rejected->get_error_code());
    }

    public function test_title_only_collection_sends_no_legacy_projection_keys(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'api_origin' => 'http://localhost:8787',
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'access_token' => Crypto::seal('access-secret-value'),
            'refresh_token' => Crypto::seal('refresh-secret-value'),
            'access_expires_at' => time() + HOUR_IN_SECONDS,
            'scopes' => ['cms:write'],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $captured = [];
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$captured): array {
            $captured = SupportJson::decode((string) $args['body']);
            return [
                'response' => ['code' => 200],
                'body' => json_encode([
                    'status' => 'applied',
                    'baseVersion' => 1,
                    'version' => 2,
                    'publishedVersion' => 1,
                    'writes' => [['collectionId' => 'articles', 'itemId' => 'one', 'writeSequence' => 17]],
                ], JSON_THROW_ON_ERROR),
            ];
        };
        $payload = [
            'collectionId' => 'articles',
            'baseVersion' => 1,
            'values' => ['title' => 'Only declared value'],
            'title' => 'Legacy title',
            'slug' => 'must-not-send',
            'body' => 'must-not-send',
            'excerpt' => 'must-not-send',
        ];

        $result = (new HttpClient(new Connection()))->writeCmsDraft('one', $payload, 17, 'wp-cms-17-unit-key');

        $this->assertIsArray($result, is_wp_error($result) ? $result->get_error_message() : '');
        $this->assertSame(['title' => 'Only declared value'], $captured['writes'][0]['values']);
        $this->assertArrayNotHasKey('slug', $captured['writes'][0]['values']);
        $this->assertArrayNotHasKey('body', $captured['writes'][0]['values']);
        $this->assertArrayNotHasKey('excerpt', $captured['writes'][0]['values']);
    }

    /** @return list<array<string,mixed>> */
    private function collections(): array
    {
        return [[
            'id' => 'articles', 'name' => 'Articles',
            'fields' => [
                ['id' => 'title', 'name' => 'Title', 'type' => 'text', 'required' => 1],
                ['id' => 'content', 'name' => 'Content', 'type' => 'rich'],
                ['id' => 'hero', 'name' => 'Hero', 'type' => 'image'],
                ['id' => 'website', 'name' => 'Website', 'type' => 'link'],
                ['id' => 'price', 'name' => 'Price', 'type' => 'number'],
                ['id' => 'published', 'name' => 'Published', 'type' => 'date'],
                ['id' => 'state', 'name' => 'State', 'type' => 'option', 'opts' => 'Draft, Published'],
                ['id' => 'featured', 'name' => 'Featured', 'type' => 'bool'],
                ['id' => 'author', 'name' => 'Author', 'type' => 'ref', 'ref' => 'authors'],
            ],
            'items' => [[
                'id' => 'article-one', 'slug' => 'article-one',
                'values' => [
                    'title' => 'Typed title', 'content' => '<p>Safe <strong>rich</strong></p>',
                    'hero' => 'asset:hero-one', 'website' => 'https://example.com/path',
                    'price' => '19.95', 'published' => '2026-08-26', 'state' => 'Published',
                    'featured' => '1', 'author' => 'author-one',
                ],
            ]],
        ], [
            'id' => 'authors', 'name' => 'Authors',
            'fields' => [['id' => 'title', 'name' => 'Name', 'type' => 'text']],
            'items' => [['id' => 'author-one', 'slug' => 'author-one', 'values' => ['title' => 'Author One']]],
        ]];
    }

    /** @return array<string,mixed> */
    private function schema(): array
    {
        $mapper = new Mapper(new ReleaseRepository());
        $schemas = (new ReflectionMethod(Mapper::class, 'normalizeCollectionSchemas'))->invoke($mapper, $this->collections());
        return $schemas['articles'];
    }

    /** @return array{CmsWriteback,\WP_Post} */
    private function writebackForEnvironment(string $environment): array
    {
        $post = new \WP_Post([
            'ID' => 52,
            'post_type' => 'pagecraft_entry',
            'post_title' => 'Active title',
            'post_name' => 'active-title',
            'post_content' => 'Active body',
            'post_excerpt' => 'Active excerpt',
            'post_status' => 'publish',
            'post_password' => '',
        ]);
        $GLOBALS['pagecraft_test_posts'][$post->ID] = $post;
        $GLOBALS['pagecraft_test_post_meta'][$post->ID] = [
            '_pagecraft_managed' => '1',
            '_pagecraft_item_id' => 'item-unit',
            '_pagecraft_collection_id' => 'articles',
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
            'pagecraft_fields' => ['title' => 'Active title'],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-cms-fields',
            'site_id' => 'site-cms-fields',
            'api_origin' => 'http://localhost:8787',
            'scopes' => ['cms:write'],
            'environment' => $environment,
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-cms-fields';
        $GLOBALS['wpdb']->releaseRows['deployment-cms-fields'] = [
            'id' => 1,
            'deployment_id' => 'deployment-cms-fields',
            'release_id' => 'release-cms-fields',
            'connection_id' => 'connection-cms-fields',
            'site_id' => 'site-cms-fields',
            'sequence_no' => 1,
            'source_version' => 1,
            'status' => 'active',
            'manifest' => json_encode(['connectionId' => 'connection-cms-fields', 'siteId' => 'site-cms-fields'], JSON_THROW_ON_ERROR),
            'manifest_hash' => str_repeat('a', 64),
            'deployment_hash' => str_repeat('b', 64),
            'artifact_hash' => str_repeat('c', 64),
            'created_at' => '2026-08-26 00:00:00',
            'verified_at' => '2026-08-26 00:01:00',
        ];
        $GLOBALS['wpdb']->objectRows[] = [
            'deployment_id' => 'deployment-cms-fields',
            'release_id' => 'release-cms-fields',
            'source_type' => 'cms',
            'source_id' => 'item-unit',
            'object_id' => $post->ID,
            'state' => 'active',
        ];
        $connection = new Connection();
        return [
            new CmsWriteback($connection, new HttpClient($connection), new ReleaseRepository(), null, static fn (): array => []),
            $post,
        ];
    }
}

/** Avoid coupling the request-body assertion to WordPress JSON helpers. */
final class SupportJson
{
    /** @return array<string,mixed> */
    public static function decode(string $json): array
    {
        $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        return is_array($decoded) ? $decoded : [];
    }
}
