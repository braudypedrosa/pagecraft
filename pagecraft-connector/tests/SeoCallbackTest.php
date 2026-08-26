<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\Seo;
use ReflectionMethod;
use ReflectionProperty;

final class SeoCallbackTest extends ConnectorTestCase
{
    public function test_adapter_scalar_callbacks_accept_null_without_a_type_error(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = ['profile' => 'existing-theme'];
        (new Seo(new ReleaseRepository(), new Connection()))->hooks();

        foreach (['wpseo_title', 'wpseo_metadesc', 'wpseo_canonical', 'wpseo_opengraph_url', 'rank_math/frontend/canonical'] as $hook) {
            $callback = $GLOBALS['pagecraft_test_filters'][$hook][0] ?? null;
            $this->assertIsCallable($callback, $hook);
            $this->assertSame('', $callback(null), $hook);
        }
    }

    public function test_managed_head_preserves_generic_application_json_and_replaces_only_json_ld(): void
    {
        $seo = new Seo(new ReleaseRepository(), new Connection());
        (new ReflectionProperty(Seo::class, 'bufferedSeo'))->setValue($seo, [
            'title' => 'Managed',
            'description' => 'Description',
            'canonical' => 'https://wp.example/managed/',
            'og' => [],
            'twitter' => [],
            'structuredData' => [['@id' => '/managed/#page']],
        ]);
        $document = '<html><head>'
            . '<script type="application/json" id="theme-hydration">{"blocks":[1]}</script>'
            . '<script type="application/ld+json">{"@id":"https://old.example/#page"}</script>'
            . '</head><body></body></html>';

        $normalized = $seo->normalizeManagedDocumentHead($document);

        $this->assertStringContainsString('id="theme-hydration"', $normalized);
        $this->assertStringContainsString('{"blocks":[1]}', $normalized);
        $this->assertSame(1, substr_count($normalized, 'application/ld+json'));
        $this->assertStringNotContainsString('https://old.example/', $normalized);
    }

    public function test_owned_tag_stripping_preserves_tag_shaped_text_inside_inert_head_regions_byte_for_byte(): void
    {
        $seo = new Seo(new ReleaseRepository(), new Connection());
        $json = '<script type=application/json id=hydration>{"html":"<title>Card</title>","meta":"<meta property=og:url content=/old>"}</script>';
        $style = '<style>.example::after{content:"<title>Card</title>"}</style>';
        $textarea = '<textarea><title>Card</title><meta name=description content=old></textarea>';
        $comment = '<!-- <title>Card</title><link rel=canonical href=/old> -->';
        $owned = '<title>Source title</title><link rel=canonical href=/old><meta property=og:url content=/old>';

        $stripped = $seo->stripOwnedTags($json . $style . $textarea . $comment . $owned);

        $this->assertStringStartsWith($json . $style . $textarea . $comment, $stripped);
        $this->assertStringNotContainsString('<title>Source title</title>', $stripped);
        $this->assertSame(4, substr_count($stripped, '<title>Card</title>'));
        $this->assertStringContainsString('"meta":"<meta property=og:url content=/old>"', $stripped);
        $this->assertStringContainsString('<!-- <title>Card</title><link rel=canonical href=/old> -->', $stripped);
    }

    public function test_owned_tag_stripping_handles_unquoted_reordered_and_tokenized_attributes(): void
    {
        $seo = new Seo(new ReleaseRepository(), new Connection());
        $head = '<link href=https://old.example/ rel=canonical>'
            . '<link href=https://old.example/alternate rel="alternate CANONICAL">'
            . '<meta content=https://old.example/ property=og:url>'
            . '<meta content="Old description" name=description>'
            . '<meta content=index,follow name=robots>'
            . '<meta content=Old name=twitter:title>'
            . '<meta content=https://old.example/ name=canonical>'
            . '<meta property=unrelated content=Old name=description>'
            . '<script nonce=unit type=application/ld+json>{"@id":"https://old.example/#page"}</script>'
            . '<script id=theme-hydration type=application/json>{"blocks":[1]}</script>'
            . '<meta content="width=device-width" name=viewport>'
            . '<link href=/theme.css rel=stylesheet>';

        $stripped = $seo->stripOwnedTags($head);

        $this->assertStringNotContainsString('https://old.example', $stripped);
        $this->assertStringNotContainsString('twitter:title', $stripped);
        $this->assertStringContainsString('id=theme-hydration', $stripped);
        $this->assertStringContainsString('{"blocks":[1]}', $stripped);
        $this->assertStringContainsString('name=viewport', $stripped);
        $this->assertStringContainsString('rel=stylesheet', $stripped);
    }

    public function test_document_normalizer_replaces_unquoted_adapter_tags_with_one_target_owned_set(): void
    {
        $seo = new Seo(new ReleaseRepository(), new Connection());
        (new ReflectionProperty(Seo::class, 'bufferedSeo'))->setValue($seo, [
            'title' => 'Managed',
            'description' => 'Managed description',
            'robots' => 'index,follow',
            'canonical' => 'https://wp.example/managed/',
            'og' => ['title' => 'Managed', 'url' => 'https://wp.example/managed/'],
            'twitter' => [],
            'structuredData' => [['@id' => '/managed/#page']],
        ]);
        $document = '<html><head>'
            . '<link href=https://source.example/managed/ rel=canonical>'
            . '<meta content=https://source.example/managed/ property=og:url>'
            . '<meta content="Source description" name=description>'
            . '<script TYPE=application/ld+json>{"@id":"https://source.example/#page"}</script>'
            . '<script type=application/json id=hydration>{"route":"managed"}</script>'
            . '</head><body></body></html>';

        $normalized = $seo->normalizeManagedDocumentHead($document);

        $this->assertStringNotContainsString('https://source.example', $normalized);
        $this->assertSame(1, substr_count($normalized, 'rel="canonical"'));
        $this->assertSame(1, substr_count($normalized, 'property="og:url"'));
        $this->assertSame(1, substr_count($normalized, 'application/ld+json'));
        $this->assertStringContainsString('https://wp.example/managed/', $normalized);
        $this->assertStringContainsString('id=hydration', $normalized);
        $this->assertStringContainsString('{"route":"managed"}', $normalized);
    }

    public function test_flat_compiler_og_and_twitter_fields_emit_exactly_one_complete_owned_set(): void
    {
        $GLOBALS['pagecraft_test_home'] = 'https://wp.example';
        $seo = new Seo(new ReleaseRepository(), new Connection());
        $normalize = new ReflectionMethod(Seo::class, 'normalize');
        $normalizedSeo = $normalize->invoke($seo, [
            '_route_path' => '/managed/',
            'title' => 'Managed title',
            'description' => 'Managed description',
            'canonical' => 'https://source.example/managed/',
            'robots' => 'index,follow',
            'ogTitle' => 'Managed OG title',
            'ogDescription' => 'Managed OG description',
            'ogType' => 'article',
            'ogUrl' => 'https://source.example/managed/',
            'ogImage' => 'https://wp.example/media/og.webp',
            'ogImageSecureUrl' => 'https://wp.example/media/og-secure.webp',
            'twitterCard' => 'summary_large_image',
            'twitterTitle' => 'Managed Twitter title',
            'twitterDescription' => 'Managed Twitter description',
            'twitterImage' => 'https://wp.example/media/twitter.webp',
            'structuredData' => '[]',
        ]);
        (new ReflectionProperty(Seo::class, 'bufferedSeo'))->setValue($seo, $normalizedSeo);
        $sourceTags = '<link href=https://source.example/managed/ rel=canonical>'
            . '<meta content=old property=og:title><meta content=old property=og:description>'
            . '<meta content=website property=og:type><meta content=https://source.example/ property=og:url>'
            . '<meta content=old property=og:image><meta content=old property=og:image:secure_url>'
            . '<meta content=summary name=twitter:card>'
            . '<meta content=old name=twitter:title><meta content=old name=twitter:description>'
            . '<meta content=old name=twitter:image>';

        $document = $seo->normalizeManagedDocumentHead('<html><head>' . $sourceTags . '</head><body></body></html>');

        foreach (['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:secure_url'] as $property) {
            $this->assertSame(1, substr_count($document, 'property="' . $property . '"'), $property);
        }
        foreach (['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'] as $name) {
            $this->assertSame(1, substr_count($document, 'name="' . $name . '"'), $name);
        }
        $this->assertSame(1, substr_count($document, '<title>Managed title</title>'));
        $this->assertSame(1, substr_count($document, 'name="description"'));
        $this->assertSame(1, substr_count($document, 'name="robots"'));
        $this->assertSame(1, substr_count($document, 'rel="canonical"'));
        $this->assertStringContainsString('rel="canonical" href="https://wp.example/managed/"', $document);
        $this->assertStringContainsString('content="article"', $document);
        $this->assertStringContainsString('content="https://wp.example/media/og-secure.webp"', $document);
        $this->assertStringContainsString('content="summary_large_image"', $document);
        $this->assertStringContainsString('content="Managed Twitter title"', $document);
        $this->assertStringNotContainsString('https://source.example', $document);
    }

    public function test_head_boundary_ignores_raw_text_comments_and_quoted_attribute_lookalikes(): void
    {
        $seo = new Seo(new ReleaseRepository(), new Connection());
        (new ReflectionProperty(Seo::class, 'bufferedSeo'))->setValue($seo, [
            'title' => 'Managed',
            'description' => 'Managed description',
            'canonical' => 'https://wp.example/managed/',
            'og' => ['url' => 'https://wp.example/managed/'],
            'twitter' => [],
            'structuredData' => [['name' => '</head>', '@id' => '/managed/#page']],
        ]);
        $document = '<html><head data-note="</head>">'
            . '<title>Docs </head> marker</title>'
            . '<!-- inert </head> marker -->'
            . '<style>.marker::before{content:"</head>"}</style>'
            . '<script type=application/json id=hydration>{"name":"</head>"}</script>'
            . '<script type=application/ld+json>{"name":"</head>","@id":"https://source.example/#page"}</script>'
            . '<link rel=canonical href=https://source.example/managed/>'
            . '<meta property=og:url content=https://source.example/managed/>'
            . '</head><body><p>Body</p></body></html>';

        $normalized = $seo->normalizeManagedDocumentHead($document);

        $this->assertStringContainsString('<head data-note="</head>">', $normalized);
        $this->assertSame(1, substr_count($normalized, '<title>Managed</title>'));
        $this->assertStringContainsString('<!-- inert </head> marker -->', $normalized);
        $this->assertStringContainsString('<style>.marker::before{content:"</head>"}</style>', $normalized);
        $this->assertStringContainsString('<script type=application/json id=hydration>{"name":"</head>"}</script>', $normalized);
        $this->assertStringContainsString('<body><p>Body</p></body>', $normalized);
        $this->assertStringNotContainsString('https://source.example', $normalized);
        $this->assertSame(1, substr_count($normalized, 'rel="canonical"'));
        $this->assertSame(1, substr_count($normalized, 'property="og:url"'));
        $this->assertSame(1, substr_count($normalized, 'application/ld+json'));
        preg_match('#<script type="application/ld\+json">([\s\S]*?)</script>#', $normalized, $schemaMatch);
        $schema = json_decode((string) ($schemaMatch[1] ?? ''), true);
        $this->assertSame('</head>', $schema[0]['name'] ?? null);
    }

    public function test_schema_url_allowlist_rebases_target_neutral_paths_to_root_and_subdirectory_homes(): void
    {
        $method = new ReflectionMethod(Seo::class, 'rebaseSchema');
        $seo = new Seo(new ReleaseRepository(), new Connection());
        $schema = [
            '@id' => '/mapped/#page',
            'url' => '/mapped/?view=full#content',
            'mainEntityOfPage' => '/',
            'image' => ['url' => '/media/hero.jpg', 'caption' => '/not-a-url-field/'],
            'sameAs' => ['https://social.example/account', '/profile/'],
            'fragment' => '#preserved',
        ];

        $GLOBALS['pagecraft_test_home'] = 'https://wp.example';
        $root = $method->invoke($seo, $schema, 'https://wp.example/mapped/');
        $this->assertSame('https://wp.example/mapped/#page', $root['@id']);
        $this->assertSame('https://wp.example/', $root['mainEntityOfPage']);

        $GLOBALS['pagecraft_test_home'] = 'https://wp.example/subdir';
        $subdirectory = $method->invoke($seo, $schema, 'https://wp.example/subdir/mapped/');
        $this->assertSame('https://wp.example/subdir/mapped/?view=full#content', $subdirectory['url']);
        $this->assertSame('https://wp.example/subdir/media/hero.jpg', $subdirectory['image']['url']);
        $this->assertSame('/not-a-url-field/', $subdirectory['image']['caption']);
        $this->assertSame('https://social.example/account', $subdirectory['sameAs'][0]);
        $this->assertSame('https://wp.example/subdir/profile/', $subdirectory['sameAs'][1]);
        $this->assertSame('#preserved', $subdirectory['fragment']);
    }
}
