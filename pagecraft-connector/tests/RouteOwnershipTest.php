<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\RouteOwnership;

final class RouteOwnershipTest extends ConnectorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-routes';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'site_id' => 'site-routes',
            'connection_id' => 'connection-routes',
            'profile' => 'existing-theme',
            'environment' => 'staging',
        ];
    }

    public function test_resolver_covers_public_cpt_single_archive_taxonomy_term_author_feed_and_system_routes(): void
    {
        $GLOBALS['pagecraft_test_post_types'] = [
            'book' => (object) ['name' => 'book', 'label' => 'Books', 'rewrite' => ['slug' => 'books']],
        ];
        $GLOBALS['pagecraft_test_post_type_archives']['book'] = home_url('/books/');
        $book = new \WP_Post(['ID' => 20, 'post_type' => 'book', 'post_title' => 'The Book', 'post_name' => 'the-book']);
        $GLOBALS['pagecraft_test_posts'][20] = $book;
        $GLOBALS['pagecraft_test_url_post_ids'][home_url('/books/the-book/')] = 20;

        $GLOBALS['pagecraft_test_taxonomies'] = [
            'genre' => (object) ['name' => 'genre', 'label' => 'Genres', 'rewrite' => ['slug' => 'genre']],
        ];
        $GLOBALS['pagecraft_test_terms']['genre|horror'] = (object) ['term_id' => 30, 'name' => 'Horror'];
        $GLOBALS['pagecraft_test_users']['braudy'] = (object) ['ID' => 40, 'display_name' => 'Braudy'];
        $ownership = new RouteOwnership();

        $this->assertSame('post-single', $ownership->owner('/books/the-book/')['owner_type']);
        $this->assertSame('post-type-archive', $ownership->owner('/books/')['owner_type']);
        $this->assertSame('post-type-rewrite', $ownership->owner('/books/not-yet-a-book/')['owner_type']);
        $this->assertTrue($ownership->owner('/books/not-yet-a-book/')['ambiguous']);
        $this->assertSame('term', $ownership->owner('/genre/horror/')['owner_type']);
        $this->assertSame('taxonomy-rewrite', $ownership->owner('/genre/not-a-term/')['owner_type']);
        $this->assertSame('author', $ownership->owner('/author/braudy/')['owner_type']);
        $this->assertSame('author-rewrite', $ownership->owner('/author/unknown/')['owner_type']);
        $this->assertSame('feed', $ownership->owner('/feed/')['owner_type']);
        $this->assertSame('system', $ownership->owner('/wp-json/pagecraft/v1/')['owner_type']);
        $this->assertSame('system', $ownership->owner('/robots.txt')['owner_type']);
    }

    public function test_unclassified_custom_rewrite_is_owned_and_fails_closed(): void
    {
        $GLOBALS['wp_rewrite']->rules = ['special/([^/]+)/?$' => 'index.php?custom_owner=$matches[1]'];

        $owner = (new RouteOwnership())->owner('/special/value/');

        $this->assertIsArray($owner);
        $this->assertSame('rewrite', $owner['owner_type']);
        $this->assertTrue($owner['ambiguous']);
        $this->assertFalse($owner['replaceable']);
    }

    public function test_mapper_records_owner_type_blocks_unsafe_replace_and_rechecks_mapped_destination(): void
    {
        $owners = [
            '/books/the-book/' => ['owner_type' => 'post-single', 'label' => 'The Book', 'post_id' => 20, 'post_type' => 'book', 'replaceable' => false],
            '/genre/horror/' => ['owner_type' => 'term', 'label' => 'Horror', 'object_id' => 30, 'taxonomy' => 'genre', 'replaceable' => false],
            '/landing/' => ['owner_type' => 'page', 'label' => 'Landing', 'post_id' => 50, 'post_type' => 'page', 'replaceable' => true],
            '/mapped-collision/' => ['owner_type' => 'post-type-archive', 'label' => 'Books', 'replaceable' => false],
        ];
        $ownership = new RouteOwnership(static fn (string $route): ?array => $owners[$route] ?? null);
        $mapper = new Mapper(new ReleaseRepository(), $ownership);
        $manifest = ['profile' => 'existing-theme', 'pages' => [
            ['path' => '/books/the-book/'],
            ['path' => '/genre/horror/'],
            ['path' => '/landing/'],
            ['path' => '/free/'],
        ]];

        $blocked = $mapper->preflight($manifest);
        $this->assertInstanceOf(\WP_Error::class, $blocked);
        $conflicts = $mapper->conflicts();
        $this->assertSame('post-single', $conflicts['/books/the-book/']['owner_type']);
        $this->assertSame('term', $conflicts['/genre/horror/']['owner_type']);
        $this->assertFalse($conflicts['/books/the-book/']['replace_allowed']);
        $this->assertTrue($conflicts['/landing/']['replace_allowed']);

        $this->assertFalse($mapper->setDecision('/books/the-book/', 'replace'));
        $this->assertTrue($mapper->setDecision('/books/the-book/', 'keep'));
        $this->assertTrue($mapper->setDecision('/genre/horror/', 'keep'));
        $this->assertTrue($mapper->setDecision('/landing/', 'replace'));
        $this->assertTrue($mapper->setDecision('/free/', 'map', '/mapped-collision/'));

        $mappedBlocked = $mapper->preflight($manifest);
        $this->assertInstanceOf(\WP_Error::class, $mappedBlocked);
        $this->assertSame('post-type-archive', $mapper->conflicts()['/free/']['owner_type']);
        $this->assertSame('/mapped-collision/', $mapper->conflicts()['/free/']['mapped_route']);
        $this->assertFalse($mapper->conflicts()['/free/']['replace_allowed']);
    }

    public function test_existing_theme_home_remains_wordpress_owned_without_a_collision_decision(): void
    {
        $ownership = new RouteOwnership(static fn (string $route): ?array => $route === '/'
            ? ['owner_type' => 'system', 'label' => 'WordPress home', 'replaceable' => false]
            : null);
        $mapper = new Mapper(new ReleaseRepository(), $ownership);

        $this->assertTrue($mapper->preflight(['profile' => 'existing-theme', 'pages' => [['path' => '/']]]));
        $this->assertSame([], $mapper->conflicts());
    }
}
