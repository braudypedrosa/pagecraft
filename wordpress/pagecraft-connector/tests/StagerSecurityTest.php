<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Stager;
use ReflectionMethod;

final class StagerSecurityTest extends ConnectorTestCase
{
    /** @dataProvider executableMarkup */
    public function test_raw_executable_markup_is_rejected(string $html): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '',
            'bodyHtml' => $html,
            'css' => '',
        ], []);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_inline_execution', $result->get_error_code());
    }

    /** @return iterable<string,array{string}> */
    public static function executableMarkup(): iterable
    {
        yield 'unquoted javascript URL' => ['<a href=javascript:alert(1)>Open</a>'];
        yield 'entity-obfuscated javascript URL' => ['<a href=java&#x73;cript:alert(1)>Open</a>'];
        yield 'unquoted srcdoc' => ['<iframe srcdoc=<script>alert(1)</script>></iframe>'];
        yield 'data HTML URL' => ['<a href=data:text/html,<script>alert(1)</script>>Open</a>'];
        yield 'object embed' => ['<object data=https://example.com/payload></object>'];
        yield 'inline event handler' => ['<img src="pc-asset://hero" onerror=alert(1)>'];
        yield 'unquoted executable script type' => ['<script nonce=unit type=text/javascript>alert(1)</script>'];
        yield 'inert type with executable source' => ['<script type=application/ld+json src=/payload.js></script>'];
    }

    /** @dataProvider unresolvedHtmlNavigation */
    public function test_unresolved_internal_html_navigation_is_rejected_for_quoted_and_unquoted_attributes(string $html): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '',
            'bodyHtml' => $html,
            'css' => '',
        ], []);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_html_link', $result->get_error_code());
    }

    /** @return iterable<string,array{string}> */
    public static function unresolvedHtmlNavigation(): iterable
    {
        yield 'unquoted href' => ['<a href=legacy.html>Legacy</a>'];
        yield 'unquoted action with query' => ['<form action=/legacy/index.html?source=form></form>'];
        yield 'unquoted formaction with fragment' => ['<button formaction=../legacy.html#send>Send</button>'];
        yield 'quoted href' => ['<a href="/legacy/page.html?source=nav#top">Legacy</a>'];
        yield 'encoded extension' => ['<a href=/legacy/page%2Ehtml>Legacy</a>'];
    }

    public function test_external_html_urls_and_non_navigation_data_attributes_are_not_rejected(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '',
            'bodyHtml' => '<a href=https://example.com/archive.html data-href=/legacy.html>External</a>',
            'css' => '',
        ], []);

        $this->assertTrue($result);
    }

    public function test_escaped_and_raw_text_code_examples_remain_browser_inert(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '<title>Teach &lt;iframe src=/example.html&gt;</title>',
            'bodyHtml' => '<pre><code>&lt;script&gt;alert(1)&lt;/script&gt; &lt;a href=legacy.html&gt;Example&lt;/a&gt;</code></pre>'
                . '<p>&lt;iframe src=https://example.com/embed&gt;&lt;/iframe&gt;</p>'
                . '<textarea><a href=legacy.html>literal textarea example</a></textarea>'
                . '<script type=application/json>{"example":"<a href=legacy.html>"}</script>'
                . '<p>Two is less than three: 2 < 3.</p>',
            'css' => '',
        ], []);

        $this->assertTrue($result);
    }

    /** @dataProvider portableEmbeds */
    public function test_compiler_marked_core_video_and_embed_players_are_portable(string $html): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/', 'headHtml' => '', 'bodyHtml' => $html, 'css' => '',
        ], []);

        $this->assertTrue($result);
    }

    /** @return iterable<string,array{string}> */
    public static function portableEmbeds(): iterable
    {
        yield 'YouTube Core iframe' => [
            '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ?controls=1" title="Video" loading="lazy"'
                . ' allow="accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture" allowfullscreen'
                . ' data-pagecraft-embed-provider="youtube"></iframe>',
        ];
        yield 'Vimeo Core iframe' => [
            '<iframe data-pagecraft-embed-provider=vimeo loading=eager frameborder=0'
                . ' src=https://player.vimeo.com/video/12345678?controls=1 title=Video></iframe>',
        ];
        yield 'YouTube facade' => [
            '<button type=button data-embed="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ"'
                . ' data-pagecraft-embed-provider=youtube>Play</button>',
        ];
    }

    /** @dataProvider unsupportedEmbeds */
    public function test_unverified_or_nonportable_embeds_are_rejected(string $html): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/', 'headHtml' => '', 'bodyHtml' => $html, 'css' => '',
        ], []);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_inline_execution', $result->get_error_code());
    }

    /** @return iterable<string,array{string}> */
    public static function unsupportedEmbeds(): iterable
    {
        yield 'arbitrary iframe host' => ['<iframe src=https://widgets.example/embed/abc data-pagecraft-embed-provider=youtube></iframe>'];
        yield 'HTTP player' => ['<iframe src=http://www.youtube.com/embed/aqz-KE-bpKQ data-pagecraft-embed-provider=youtube></iframe>'];
        yield 'missing provenance' => ['<iframe src=https://www.youtube.com/embed/aqz-KE-bpKQ></iframe>'];
        yield 'mismatched provenance' => ['<iframe src=https://player.vimeo.com/video/123 data-pagecraft-embed-provider=youtube></iframe>'];
        yield 'unsupported iframe attribute' => ['<iframe src=https://www.youtube.com/embed/aqz-KE-bpKQ data-pagecraft-embed-provider=youtube data-extra=x></iframe>'];
        yield 'invalid loading mode' => ['<iframe src=https://www.youtube.com/embed/aqz-KE-bpKQ data-pagecraft-embed-provider=youtube loading=auto></iframe>'];
        yield 'invalid frame border' => ['<iframe src=https://www.youtube.com/embed/aqz-KE-bpKQ data-pagecraft-embed-provider=youtube frameborder=2></iframe>'];
        yield 'orphan provenance' => ['<div data-pagecraft-embed-provider=youtube>Video</div>'];
        yield 'facade provider mismatch' => ['<button data-embed=https://www.youtube.com/embed/aqz-KE-bpKQ data-pagecraft-embed-provider=vimeo>Play</button>'];
    }

    public function test_ordinary_media_must_be_frozen_or_inline_data(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $unsafe = $method->invoke(new Stager(), [
            'path' => '/managed/', 'headHtml' => '',
            'bodyHtml' => '<img src=https://cdn.example/image.png><video poster=/poster.jpg></video>', 'css' => '',
        ], []);
        $safe = $method->invoke(new Stager(), [
            'path' => '/managed/', 'headHtml' => '',
            'bodyHtml' => '<img src=pc-asset://hero srcset="pc-asset://hero 1x, pc-asset://hero-2x 2x">'
                . '<video poster="data:image/png;base64,AAAA" src=pc-asset://movie></video>',
            'css' => '',
        ], []);

        $this->assertInstanceOf(\WP_Error::class, $unsafe);
        $this->assertSame('pagecraft_artifact_inline_execution', $unsafe->get_error_code());
        $this->assertTrue($safe);
    }

    public function test_both_profiles_reject_mutable_stylesheets_and_allow_content_addressed_release_css(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $route = [
            'path' => '/managed/',
            'headHtml' => '<link href=https://cdn.example/theme.css rel="preload stylesheet">',
            'bodyHtml' => '<p>Managed</p>',
            'css' => '',
        ];

        $existingBlocked = $method->invoke(new Stager(), $route, [], true);
        $themeBlocked = $method->invoke(new Stager(), $route, [], false);
        $localRoute = $route;
        $localRoute['headHtml'] = '<link rel=stylesheet href=pc-asset://route-css>';

        $this->assertInstanceOf(\WP_Error::class, $existingBlocked);
        $this->assertSame('pagecraft_artifact_stylesheet', $existingBlocked->get_error_code());
        $this->assertInstanceOf(\WP_Error::class, $themeBlocked);
        $this->assertSame('pagecraft_artifact_stylesheet', $themeBlocked->get_error_code());
        $this->assertTrue($method->invoke(new Stager(), $localRoute, [], true));
        $this->assertTrue($method->invoke(new Stager(), $localRoute, [], false));
    }

    /** @dataProvider escapedUnsafeCss */
    public function test_css_escapes_comments_and_mixed_case_cannot_hide_unsafe_tokens(string $css): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '',
            'bodyHtml' => '<p>Managed</p>',
            'css' => $css,
        ], []);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_css_unsafe', $result->get_error_code());
    }

    /** @return iterable<string,array{string}> */
    public static function escapedUnsafeCss(): iterable
    {
        yield 'hex import' => ['@\\69mport url(https://evil.example/x.css);'];
        yield 'six digit import' => ['@\\000069mport url(https://evil.example/x.css);'];
        yield 'terminated hex import' => ['@\\69 mport url(https://evil.example/x.css);'];
        yield 'simple escaped import' => ['@\\i\\mport url(https://evil.example/x.css);'];
        yield 'mixed case comment import' => ['@Im/**/PoRt url(https://evil.example/x.css);'];
        yield 'fully escaped import' => ['@\\69\\6d\\70\\6f\\72\\74  url(https://evil.example/x.css);'];
        yield 'escaped namespace' => ['@\\6e amespace svg url(https://evil.example/ns);'];
        yield 'escaped charset' => ['@\\63 harset "UTF-8";'];
        yield 'escaped javascript scheme' => ['a{background:url(javascr\\69pt:alert(1))}'];
    }

    public function test_signed_inline_font_face_data_remains_allowed(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '',
            'bodyHtml' => '<p>Managed</p>',
            'css' => '@font-face{font-family:Pagecraft;src:url(data:font/woff2;base64,d09GMgABAAAAAA) format("woff2")} .pagecraft-root{font-family:Pagecraft}',
        ], []);

        $this->assertTrue($result);
    }

    public function test_existing_theme_requires_scoped_compiled_css_and_exact_core_globals(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $stager = new Stager();
        $route = static fn (string $css): array => [
            'path' => '/managed/',
            'headHtml' => '',
            'bodyHtml' => '<p class="theme-button pc-fade-up">Managed</p>',
            'css' => $css,
        ];

        $unscoped = $method->invoke($stager, $route('.theme-button{color:red}'), [], true);
        $nestedUnscoped = $method->invoke(
            $stager,
            $route('@media (min-width:1px){@supports(display:grid){.theme-button{display:grid}}}'),
            [],
            true
        );
        $authoredKeyframe = $method->invoke(
            $stager,
            $route('@keyframes spin{from{opacity:0}to{opacity:1}}.pagecraft-root .theme-button{animation:spin 1s}'),
            [],
            true
        );
        $spoofedCoreKeyframe = $method->invoke(
            $stager,
            $route('@keyframes bpFadeUp{from{opacity:1}to{opacity:0}}.pagecraft-root .pc-fade-up{animation:bpFadeUp 1s}'),
            [],
            true
        );
        $exactCore = $method->invoke(
            $stager,
            $route('@keyframes bpFadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}'
                . '@media (min-width:1px){.pagecraft-root .theme-button{color:red}}'),
            [],
            true
        );
        $themeOwnsGlobal = $method->invoke($stager, $route('.theme-button{color:red}'), [], false);

        foreach ([$unscoped, $nestedUnscoped, $authoredKeyframe, $spoofedCoreKeyframe] as $blocked) {
            $this->assertInstanceOf(\WP_Error::class, $blocked);
            $this->assertSame('pagecraft_artifact_existing_theme_css', $blocked->get_error_code());
        }
        $this->assertTrue($exactCore);
        $this->assertTrue($themeOwnsGlobal, 'Pagecraft Theme owns its document and may render project-global selectors.');
    }

    public function test_existing_theme_allows_frozen_shared_font_bytes_but_not_route_owned_font_faces(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $route = [
            'path' => '/',
            'headHtml' => '',
            'bodyHtml' => '<p>Managed</p>',
            'css' => '@font-face{font-family:PagecraftFrozen;src:url(data:font/woff2;base64,d09GMgABAAAAAA) format("woff2")}',
        ];

        $shared = $method->invoke(new Stager(), $route, [], true, true);
        $authoredRoute = $method->invoke(new Stager(), $route, [], true, false);

        $this->assertTrue($shared);
        $this->assertInstanceOf(\WP_Error::class, $authoredRoute);
        $this->assertSame('pagecraft_artifact_existing_theme_css', $authoredRoute->get_error_code());
    }

    public function test_unquoted_reordered_and_entity_encoded_json_scripts_remain_inert(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '<script nonce=unit TYPE=application&#x2f;ld+json>{"@id":"/managed/#page"}</script>'
                . '<script data-config=theme type=application&#47;json>{"blocks":[1]}</script>',
            'bodyHtml' => '<p>Managed</p>',
            'css' => '',
        ], []);

        $this->assertTrue($result);
    }

    public function test_owned_tag_lookalike_inside_json_raw_text_is_not_document_metadata(): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => '<script type=application/json>{"template":"<meta property=og:url content=/source/>"}</script>',
            'bodyHtml' => '<p>Managed</p>',
            'css' => '',
        ], []);

        $this->assertTrue($result);
    }

    /** @dataProvider rawOwnedSeoTags */
    public function test_raw_target_owned_seo_tags_fail_staging_with_browser_attribute_semantics(string $head): void
    {
        $method = new ReflectionMethod(Stager::class, 'unsafeRoute');
        $result = $method->invoke(new Stager(), [
            'path' => '/managed/',
            'headHtml' => $head,
            'bodyHtml' => '<p>Managed</p>',
            'css' => '',
        ], []);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_owned_seo_head', $result->get_error_code());
    }

    /** @return iterable<string,array{string}> */
    public static function rawOwnedSeoTags(): iterable
    {
        yield 'canonical relation token' => ['<link href=https://source.example/ rel="alternate canonical">'];
        yield 'reordered unquoted og property' => ['<meta content=https://source.example/ property=og:url>'];
        yield 'unquoted twitter name' => ['<meta content=summary_large_image name=twitter:card>'];
    }
}
