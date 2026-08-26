<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\RouteOwnership;

final class RouteTranslationTest extends ConnectorTestCase
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

    public function test_map_decisions_cannot_create_public_html_routes_directly_or_by_inheritance(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));

        $this->assertFalse($mapper->setDecision('/about/', 'map', '/portfolio.html'));
        $this->assertFalse($mapper->setDecision('/about/', 'map', '/PORTFOLIO.HTML/'));
        $this->assertTrue($mapper->setDecision('/parent/', 'map', '/portfolio/'));

        $localized = $mapper->localizeManifest([
            'profile' => 'pagecraft-theme',
            'pages' => [
                ['pageId' => 'parent', 'path' => '/parent/', 'bodyKind' => 'content-fragment', 'bodyHtml' => '<p>Parent</p>'],
                ['pageId' => 'child', 'path' => '/parent/child.html/', 'bodyKind' => 'content-fragment', 'bodyHtml' => '<p>Child</p>'],
            ],
        ]);

        $this->assertInstanceOf(\WP_Error::class, $localized);
        $this->assertSame('pagecraft_route_html_target', $localized->get_error_code());
    }

    public function test_one_translation_table_localizes_routes_links_forms_redirects_seo_and_native_ops(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $this->assertTrue($mapper->setDecision('/products/', 'map', '/catalog/'));
        $manifest = [
            'profile' => 'existing-theme',
            'pages' => [
                [
                    'pageId' => 'products', 'path' => '/products/', 'bodyKind' => 'content-fragment',
                    'bodyHtml' => '<a href="/products/widget/?ref=nav#buy" data-href="/products/">Widget</a><form action=/products/widget/><p>/products/ remains text</p>',
                    'headHtml' => '<link href="/products/">',
                    'runtime' => '<script>window.route="/products/"</script>',
                    'seo' => [
                        'canonical' => '/products/',
                        'ogUrl' => '/products/',
                        'structuredData' => '[{"@id":"/products/#page","url":"/products/widget/"}]',
                    ],
                    '_shared' => ['headerHtml' => '<a href="/products/">Products</a>', 'footerHtml' => ''],
                ],
                ['pageId' => 'widget', 'path' => '/products/widget/', 'bodyKind' => 'content-fragment', 'bodyHtml' => '<a href="/products/">Back</a>'],
                ['pageId' => 'contact', 'path' => '/contact/', 'bodyKind' => 'content-fragment', 'bodyHtml' => '<a href="/products/">Products</a>'],
                ['pageId' => 'home', 'path' => '/', 'bodyKind' => 'content-fragment', 'bodyHtml' => '<p>Native home</p>'],
            ],
            'forms' => [['id' => 'buy', 'routePath' => '/products/widget/', 'method' => 'POST', 'fields' => [['name' => 'email', 'type' => 'email', 'required' => true]]]],
            'placeholders' => [
                ['id' => 'buy', 'kind' => 'form', 'routePath' => '/products/widget/', 'token' => '%%PAGECRAFT_FORM_ENDPOINT:buy%%'],
                [
                    'kind' => 'wordpress-content', 'routePath' => '*', 'objectType' => 'page',
                    'path' => '/native-contact/', 'token' => '%%PAGECRAFT_WP_CONTENT:page:L25hdGl2ZS1jb250YWN0Lw%%',
                ],
            ],
            'redirects' => [['from' => '/products/index.html', 'to' => '/products/', 'status' => 301]],
            'entities' => [
                'pages' => [['pageId' => 'products', 'path' => '/products/'], ['pageId' => 'widget', 'path' => '/products/widget/']],
                'forms' => [['id' => 'buy', 'routePath' => '/products/widget/', 'method' => 'POST', 'fields' => [['name' => 'email', 'type' => 'email', 'required' => true]]]],
            ],
            'nativeOps' => [['kind' => 'menu', 'href' => '/products/widget/?from=menu#item', 'parentPath' => '/products/']],
        ];

        $this->assertTrue($mapper->preflight($manifest));
        $localized = $mapper->localizeManifest($manifest);

        $this->assertIsArray($localized);
        $byId = [];
        foreach ($localized['pages'] as $page) {
            $byId[$page['pageId']] = $page;
        }
        $this->assertSame('/catalog/', $byId['products']['path']);
        $this->assertSame('/catalog/widget/', $byId['widget']['path']);
        $this->assertTrue($byId['home']['_pagecraftSkip']);
        $this->assertStringContainsString('/catalog/widget/?ref=nav#buy', $byId['products']['bodyHtml']);
        $this->assertStringContainsString('action="/catalog/widget/"', $byId['products']['bodyHtml']);
        $this->assertStringContainsString('data-href="/products/"', $byId['products']['bodyHtml']);
        $this->assertStringContainsString('<p>/products/ remains text</p>', $byId['products']['bodyHtml']);
        $this->assertStringContainsString('window.route="/products/"', $byId['products']['runtime']);
        $this->assertStringContainsString('href="/catalog/"', $byId['products']['_shared']['headerHtml']);
        $this->assertSame('/catalog/', $byId['products']['seo']['canonical']);
        $this->assertStringContainsString('/catalog/widget/', $byId['products']['seo']['structuredData']);
        $this->assertSame('/catalog/widget/', $localized['forms'][0]['routePath']);
        $this->assertSame('/catalog/widget/', $localized['placeholders'][0]['routePath']);
        $this->assertSame('*', $localized['placeholders'][1]['routePath'],
            'A shared header/footer placeholder remains bound to the signed shared region.');
        $this->assertSame('/catalog/index.html', $localized['redirects'][0]['from']);
        $this->assertSame('/catalog/', $localized['redirects'][0]['to']);
        $this->assertSame('/catalog/widget/?from=menu#item', $localized['nativeOps'][0]['href']);
        $this->assertSame('/catalog/', $localized['nativeOps'][0]['parentPath']);
        $this->assertSame('/catalog/widget/', $localized['entities']['pages'][1]['path']);
        $this->assertSame('/catalog/widget/', $localized['entities']['forms'][0]['routePath']);
    }

    public function test_subdirectory_target_path_is_applied_only_to_target_neutral_public_html_urls(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $manifest = [
            'profile' => 'pagecraft-theme',
            'targetPath' => '/site/',
            'pages' => [[
                'pageId' => 'about',
                'path' => '/about/',
                'bodyKind' => 'content-fragment',
                'bodyHtml' => '<a href=/about/?ref=nav#team>About</a>'
                    . '<a href=&#47;about&#47;>Entity path</a>'
                    . '<img src="/media/logo.png" srcset="/media/logo.png 1x, /media/logo-2x.png 2x, pc-asset://asset-hero 3x"><video poster=/media/poster.jpg></video>'
                    . '<blockquote cite="/sources/story/"></blockquote>'
                    . '<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%"><button formaction=/checkout/>Send</button></form>'
                    . '<a href="#fragment">Fragment</a><a href="https://external.example/about/">External</a>'
                    . '<a href="//cdn.example/file">CDN</a><img src="pc-asset://asset-hero">'
                    . '<a href="/site/already/">Already local</a><a href="relative/path">Relative</a>'
                    . '<!-- <a href=/about/> stays a comment -->'
                    . '<textarea><a href=/about/> stays text</textarea>'
                    . '<script>window.example="<a href=/about/>"</script>'
                    . '<style>.x::after{content:"<a href=/about/>"}</style>'
                    . '<div data-example="href=/about/">Attribute text</div>',
                'headHtml' => '<title><a href=/about/> stays title text</title>'
                    . '<link rel="alternate" href="/about/fr/" imagesrcset="/media/fr.png 1x, /media/fr-2x.png 2x">',
                '_shared' => [
                    'headerHtml' => '<a href="/">Home</a><img src=/shared/logo.png>',
                    'footerHtml' => '<a href="/legal/?from=footer">Legal</a>',
                ],
            ]],
        ];

        $localized = $mapper->localizeManifest($manifest);

        $this->assertIsArray($localized);
        $page = $localized['pages'][0];
        $this->assertSame('/about/', $page['path'], 'Stored routes stay target-neutral for request lookup.');
        $this->assertStringContainsString('href="/site/about/?ref=nav#team"', $page['bodyHtml']);
        $this->assertGreaterThanOrEqual(2, substr_count($page['bodyHtml'], 'href="/site/about/'));
        $this->assertStringContainsString('src="/site/media/logo.png"', $page['bodyHtml']);
        $this->assertStringContainsString('srcset="/site/media/logo.png 1x, /site/media/logo-2x.png 2x, pc-asset://asset-hero 3x"', $page['bodyHtml']);
        $this->assertStringContainsString('poster="/site/media/poster.jpg"', $page['bodyHtml']);
        $this->assertStringContainsString('cite="/site/sources/story/"', $page['bodyHtml']);
        $this->assertStringContainsString('formaction="/site/checkout/"', $page['bodyHtml']);
        $this->assertStringContainsString('action="%%PAGECRAFT_FORM_ENDPOINT:contact%%"', $page['bodyHtml']);
        $this->assertStringContainsString('href="#fragment"', $page['bodyHtml']);
        $this->assertStringContainsString('href="https://external.example/about/"', $page['bodyHtml']);
        $this->assertStringContainsString('href="//cdn.example/file"', $page['bodyHtml']);
        $this->assertStringContainsString('src="pc-asset://asset-hero"', $page['bodyHtml']);
        $this->assertStringContainsString('href="/site/already/"', $page['bodyHtml']);
        $this->assertStringContainsString('href="relative/path"', $page['bodyHtml']);
        $this->assertStringContainsString('<!-- <a href=/about/> stays a comment -->', $page['bodyHtml']);
        $this->assertStringContainsString('<textarea><a href=/about/> stays text</textarea>', $page['bodyHtml']);
        $this->assertStringContainsString('<script>window.example="<a href=/about/>"</script>', $page['bodyHtml']);
        $this->assertStringContainsString('<style>.x::after{content:"<a href=/about/>"}</style>', $page['bodyHtml']);
        $this->assertStringContainsString('data-example="href=/about/"', $page['bodyHtml']);
        $this->assertStringContainsString('<title><a href=/about/> stays title text</title>', $page['headHtml']);
        $this->assertStringContainsString('href="/site/about/fr/"', $page['headHtml']);
        $this->assertStringContainsString('imagesrcset="/site/media/fr.png 1x, /site/media/fr-2x.png 2x"', $page['headHtml']);
        $this->assertStringContainsString('href="/site/"', $page['_shared']['headerHtml']);
        $this->assertStringContainsString('src="/site/shared/logo.png"', $page['_shared']['headerHtml']);
        $this->assertStringContainsString('href="/site/legal/?from=footer"', $page['_shared']['footerHtml']);
    }

    public function test_mapping_onto_another_pagecraft_route_is_rejected_before_staging(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $this->assertTrue($mapper->setDecision('/source/', 'map', '/destination/'));

        $result = $mapper->preflight(['profile' => 'pagecraft-theme', 'pages' => [
            ['pageId' => 'source', 'path' => '/source/'],
            ['pageId' => 'destination', 'path' => '/destination/'],
        ]]);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_route_target_duplicate', $result->get_error_code());
    }

    public function test_two_explicit_maps_cannot_share_a_target_route(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $this->assertTrue($mapper->setDecision('/one/', 'map', '/shared/'));
        $this->assertTrue($mapper->setDecision('/two/', 'map', '/shared/'));

        $result = $mapper->localizeManifest(['profile' => 'pagecraft-theme', 'pages' => [
            ['pageId' => 'one', 'path' => '/one/'],
            ['pageId' => 'two', 'path' => '/two/'],
        ]]);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_route_target_duplicate', $result->get_error_code());
    }

    public function test_inherited_child_mapping_must_fit_the_route_storage_boundary(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $parentTarget = '/' . str_repeat('a', 188) . '/';
        $this->assertSame(190, strlen($parentTarget));
        $this->assertTrue($mapper->setDecision('/parent/', 'map', $parentTarget));

        $result = $mapper->preflight(['profile' => 'pagecraft-theme', 'pages' => [
            ['pageId' => 'parent', 'path' => '/parent/'],
            ['pageId' => 'child', 'path' => '/parent/child/'],
        ]]);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_route_target_invalid', $result->get_error_code());
    }

    public function test_legacy_redirect_alias_must_fit_after_target_local_mapping(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $parentTarget = '/' . str_repeat('a', 188) . '/';
        $this->assertTrue($mapper->setDecision('/source/', 'map', $parentTarget));

        $result = $mapper->preflight([
            'profile' => 'pagecraft-theme',
            'pages' => [['pageId' => 'source', 'path' => '/source/']],
            'redirects' => [['from' => '/source/index.html', 'to' => '/source/', 'status' => 301]],
        ]);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_redirect_target_invalid', $result->get_error_code());
    }

    public function test_route_decisions_do_not_cross_pagecraft_project_scope(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $this->assertTrue($mapper->setDecision('/about/', 'map', '/company/'));
        $projectA = $mapper->localizeManifest([
            'profile' => 'existing-theme',
            'pages' => [['pageId' => 'about-a', 'path' => '/about/']],
        ]);
        $this->assertIsArray($projectA);
        $this->assertSame('/company/', $projectA['pages'][0]['path']);

        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['site_id'] = 'site-project-b';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['connection_id'] = 'connection-project-b';
        $projectB = $mapper->localizeManifest([
            'profile' => 'existing-theme',
            'pages' => [['pageId' => 'about-b', 'path' => '/about/']],
        ]);

        $this->assertIsArray($projectB);
        $this->assertSame('/about/', $projectB['pages'][0]['path']);
        $this->assertSame('default', $projectB['pages'][0]['_routeDecision']);
    }

    public function test_same_project_reconnect_preserves_target_local_decisions(): void
    {
        $mapper = new Mapper(new ReleaseRepository(), new RouteOwnership(static fn (string $route): ?array => null));
        $this->assertTrue($mapper->setDecision('/about/', 'map', '/company/'));
        $GLOBALS['pagecraft_test_options']['pagecraft_connection']['connection_id'] = 'replacement-connection';

        $localized = $mapper->localizeManifest([
            'profile' => 'existing-theme',
            'pages' => [['pageId' => 'about', 'path' => '/about/']],
        ]);

        $this->assertIsArray($localized);
        $this->assertSame('/company/', $localized['pages'][0]['path']);
        $stored = $GLOBALS['pagecraft_test_options']['pagecraft_route_decisions'];
        $this->assertSame('site-routes', $stored['scope']['site_id']);
        $this->assertSame('installation-routes', $stored['scope']['installation_id']);
    }
}
