<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\CanonicalJson;
use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Forms;
use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseVerifier;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\Renderer;
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\Seo;
use Pagecraft\Connector\Stager;
use Pagecraft\Connector\Support;
use Pagecraft\Connector\Sync;
use ReflectionClass;
use ReflectionMethod;

final class GoldenArtifactTest extends ConnectorTestCase
{
    public function test_connector_consumes_the_shared_backend_golden_artifact(): void
    {
        $fixture = $this->fixture();
        $artifactBytes = CanonicalJson::encode($fixture['artifact']);
        $manifestBytes = Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']);
        $manifest = Support::decodeObject($manifestBytes);
        $manifest['profile'] = 'existing-theme';
        $artifactFile = tempnam(sys_get_temp_dir(), 'pagecraft-golden-');
        $this->assertIsString($artifactFile);
        file_put_contents($artifactFile, $artifactBytes);

        try {
            $staged = (new Stager())->stageCanonicalArtifact($artifactFile, $manifest);
            $this->assertIsArray($staged, is_wp_error($staged) ? $staged->get_error_message() : '');
            $this->assertSame('pagecraft.wordpress-artifact.v1', $staged['artifact']['format']);
            $this->assertSame('content-fragment', $staged['artifact']['routes'][0]['bodyKind']);
            foreach ($staged['artifact']['routes'] as $route) {
                $this->assertSame('css-before-runtime', $route['headOrder'] ?? null);
            }
            $matrix = array_values(array_filter(
                $staged['artifact']['routes'],
                static fn (array $route): bool => ($route['path'] ?? '') === '/nested/about'
            ))[0] ?? null;
            $this->assertIsArray($matrix);
            $this->assertStringContainsString('pc-asset://assethero', (string) $matrix['bodyHtml']);
            $allOccurrences = array_merge(
                (array) ($staged['artifact']['shared']['scripts'] ?? []),
                ...array_map(
                    static fn (array $route): array => (array) ($route['scripts'] ?? []),
                    $staged['artifact']['routes']
                )
            );
            $occurrenceIds = array_column($allOccurrences, 'occurrenceId');
            $this->assertNotSame([], $occurrenceIds);
            $this->assertCount(count($occurrenceIds), array_unique($occurrenceIds));
            $this->assertCount(1, $staged['files']);
            (new Stager())->removeDirectory($staged['directory']);
        } finally {
            wp_delete_file($artifactFile);
        }
    }

    public function test_shared_desired_envelope_verifies_and_requires_target_local_script_approval(): void
    {
        $fixture = $this->fixture();
        $GLOBALS['pagecraft_test_home'] = 'https://wp.example/site';
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-golden';

        $connection = new Connection();
        $begun = $connection->beginPairing('http://localhost:8787', 'site-golden', 'existing-theme', 'staging');
        $pairing = $connection->consumePairing($begun['state'], 'authorization-code-golden');
        $connection->saveTokenResponse([
            'connectionId' => 'connection-golden',
            'siteId' => 'site-golden',
            'refreshToken' => 'golden-refresh-token',
            'accessToken' => 'golden-access-token',
            'expiresIn' => 900,
            'scopes' => ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'],
            'environment' => 'staging',
            'profile' => 'existing-theme',
            'editorSessionUrl' => 'http://localhost:8787/v1/connections/connection-golden/editor-sessions',
            'keysetEnvelope' => $fixture['keysetEnvelope'],
        ], 'http://localhost:8787', $pairing);

        $approvals = new ScriptApprovals();
        $verifier = new ReleaseVerifier($connection, $approvals);
        $verified = $verifier->verify($fixture['desired']);

        $this->assertIsArray($verified, is_wp_error($verified) ? $verified->get_error_message() : '');
        $this->assertSame('release-golden-1', $verified['releaseId']);
        $this->assertSame('connection-golden', $verified['connectionId']);
        $this->assertSame('installation-golden', $verified['installationId']);
        $this->assertSame('https://wp.example', $verified['targetOrigin']);
        $this->assertSame('/site', $verified['targetPath']);
        $this->assertSame('existing-theme', $verified['profile']);
        $this->assertSame('staging', $verified['environment']);
        $this->assertSame(4, $verified['sequence']);

        $pending = $verifier->inspectArtifactScripts($fixture['artifact']);
        $this->assertIsArray($pending, is_wp_error($pending) ? $pending->get_error_message() : '');
        $declarations = [];
        foreach ((array) ($fixture['artifact']['routes'] ?? []) as $route) {
            if (is_array($route)) {
                $declarations = array_merge($declarations, (array) ($route['scripts'] ?? []));
            }
        }
        $declaredHashes = array_values(array_unique(array_map(
            static fn (array $script): string => (string) ($script['hash'] ?? ''),
            array_values(array_filter($declarations, 'is_array'))
        )));
        sort($declaredHashes, SORT_STRING);
        $this->assertSame($declaredHashes, $pending);
        $this->assertGreaterThanOrEqual(
            7,
            count($pending),
            'The real Core component matrix must exercise every interactive runtime family under target-local approval.'
        );
        $this->assertFalse($verifier->allScriptsApproved($pending));

        foreach ($pending as $fingerprint) {
            $this->assertTrue($approvals->approve($fingerprint, 7));
        }
        $this->assertTrue($verifier->allScriptsApproved($pending));
        $this->assertSame([], $verifier->inspectArtifactScripts($fixture['artifact']));
    }

    public function test_golden_css_renders_before_the_exact_approved_route_head_occurrence(): void
    {
        $fixture = $this->fixture();
        $artifact = $fixture['artifact'];
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        $matrix = array_values(array_filter(
            (array) $artifact['routes'],
            static fn (mixed $route): bool => is_array($route) && ($route['path'] ?? '') === '/nested/about'
        ))[0] ?? null;
        $this->assertIsArray($matrix);
        $matrix['_shared'] = $artifact['shared'];
        $matrix['_profile'] = 'pagecraft-theme';
        $matrix['_deploymentId'] = 'release-golden-1:target:4';
        $matrix['_artifactHash'] = (string) $manifest['artifactHash'];
        $matrix['sourceHash'] = str_repeat('a', 64);
        $assetUrls = [];
        foreach ((array) ($artifact['assets'] ?? []) as $asset) {
            if (is_array($asset)) {
                $assetUrls[(string) $asset['assetId']] = 'https://wp.example/uploads/' . rawurlencode((string) $asset['assetId']);
            }
        }
        $mapper = (new ReflectionClass(Mapper::class))->newInstanceWithoutConstructor();
        $mapped = (new ReflectionMethod(Mapper::class, 'hydratePage'))->invoke($mapper, $matrix, [], $assetUrls);
        $this->assertIsArray($mapped, is_wp_error($mapped) ? $mapped->get_error_message() : '');
        $headOccurrences = array_values(array_filter(
            (array) $mapped['scripts'],
            static fn (mixed $script): bool => is_array($script) && ($script['region'] ?? '') === 'route-head'
        ));
        $this->assertCount(1, $headOccurrences);
        $headOccurrence = $headOccurrences[0];
        $fingerprint = (string) $headOccurrence['fingerprint'];
        $GLOBALS['wpdb']->scriptApprovals[$fingerprint] = [
            'fingerprint' => $fingerprint,
            'label' => 'Signed golden head occurrence',
            'first_seen' => '2026-08-26 00:00:00',
            'approved_at' => '2026-08-26 00:01:00',
            'approved_by' => 7,
            'revoked_at' => null,
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'release-golden-1:target:4';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = ['profile' => 'pagecraft-theme'];
        $GLOBALS['wpdb']->routeRows = [[
            'id' => 1,
            'release_id' => 'release-golden-1:target:4',
            'route_path' => $mapped['route_path'],
            'page_id' => $mapped['page_id'],
            'post_id' => null,
            'title' => $mapped['title'],
            'description' => $mapped['description'],
            'head_html' => $mapped['head_html'],
            'body_html' => $mapped['body_html'],
            'content_hash' => $mapped['content_hash'],
            'source_hash' => $mapped['source_hash'],
            'status' => 'publish',
            'seo_json' => Support::json($mapped['seo']),
            'scripts_json' => Support::json($mapped['scripts']),
        ]];
        $_SERVER['REQUEST_URI'] = '/nested/about/';
        $connection = new Connection();
        $releases = new ReleaseRepository();
        $renderer = new Renderer(
            $releases,
            new ScriptApprovals(),
            new Forms($connection),
            new Seo($releases, $connection),
            $connection
        );

        ob_start();
        $renderer->renderHead();
        $head = (string) ob_get_clean();

        $stylePosition = strpos($head, '<style data-pagecraft-route>');
        $scriptPosition = strpos($head, (string) $headOccurrence['html']);
        $this->assertNotFalse($stylePosition);
        $this->assertNotFalse($scriptPosition);
        $this->assertLessThan($scriptPosition, $stylePosition);
        $this->assertSame(1, substr_count($head, (string) $headOccurrence['html']));
        $this->assertStringNotContainsString('%%PAGECRAFT_RUNTIME:', $head);
    }

    public function test_shared_artifact_covers_the_connected_component_runtime_cms_form_and_responsive_matrix(): void
    {
        $artifact = $this->fixture()['artifact'];
        $routes = is_array($artifact['routes'] ?? null) ? $artifact['routes'] : [];
        $this->assertNotSame([], $routes);
        $matrix = null;
        foreach ($routes as $route) {
            if (is_array($route) && (string) ($route['path'] ?? '') === '/nested/about') {
                $matrix = $route;
                break;
            }
        }
        $this->assertIsArray($matrix, 'The real component matrix must live on a non-home route owned by both profiles.');
        $body = (string) $matrix['bodyHtml'];
        $renderedClasses = [
            'section' => 'pagecraft-section', 'row' => 'pagecraft-row', 'list' => 'pagecraft-list',
            'slider' => 'pagecraft-slider', 'column' => 'pagecraft-column', 'box' => 'pagecraft-box',
            'heading' => 'pagecraft-heading', 'text' => 'pagecraft-wysiwyg', 'quote' => 'pagecraft-quote',
            'image' => 'pagecraft-figure', 'gallery' => 'pagecraft-gallery', 'video' => 'pagecraft-video',
            'icon' => 'pagecraft-icon', 'tabs' => 'pagecraft-tabs', 'table' => 'pagecraft-table-wrap',
            'code' => 'pagecraft-code', 'crumbs' => 'pagecraft-crumbs', 'button' => 'pagecraft-button',
            'nav' => 'pagecraft-nav-menu', 'form' => 'pagecraft-form', 'accordion' => 'pagecraft-accordion',
            'embed' => 'pagecraft-embed', 'spacer' => 'pagecraft-spacer', 'divider' => 'pagecraft-divider',
        ];
        foreach ($renderedClasses as $component => $class) {
            $this->assertMatchesRegularExpression(
                '/\bid="pc-matrix-' . preg_quote($component, '/') . '"[^>]*\bclass="[^"]*\b' . preg_quote($class, '/') . '\b/i',
                $body,
                $component . ' must use its actual Core-rendered DOM contract.'
            );
        }
        $this->assertStringNotContainsString('data-pagecraft-component', $body, 'Synthetic component labels are not integration evidence.');
        $this->assertMatchesRegularExpression('/\bdata-slider\b[\s\S]*\bdata-slides\b/i', $body);
        $this->assertMatchesRegularExpression('/\bdata-tabs\b[\s\S]*role="tablist"[\s\S]*role="tab"[\s\S]*role="tabpanel"/i', $body);
        $this->assertMatchesRegularExpression('/\bdata-nav\b[\s\S]*\bdata-nav-t\b[\s\S]*\bdata-nav-l\b/i', $body);
        $this->assertMatchesRegularExpression('/<details\b[^>]*class="[^"]*pagecraft-accordion-item[^"]*"[\s\S]*<summary\b/i', $body);
        $this->assertMatchesRegularExpression(
            '/data-embed="https:\/\/www\.youtube\.com\/embed\/aqz-KE-bpKQ[^>]+data-pagecraft-embed-provider="youtube"/i',
            $body
        );
        $this->assertMatchesRegularExpression(
            '/<iframe[^>]+player\.vimeo\.com\/video\/76979871[^>]+data-pagecraft-embed-provider="vimeo"/i',
            $body
        );

        $runtime = (string) $matrix['runtime'];
        $css = (string) $matrix['css'];
        foreach (['scrollBy', 'data-tabs-ready', 'navigator.clipboard', 'data-nav', 'data-embed', 'data-lightbox', 'IntersectionObserver'] as $hook) {
            $this->assertStringContainsString($hook, $runtime, $hook . ' behavior must travel in the signed Core runtime.');
        }
        $this->assertMatchesRegularExpression('/@media\s*\(/', $css);
        $this->assertStringContainsString('--golden-tablet', $css);

        $forms = is_array($artifact['forms'] ?? null) ? $artifact['forms'] : [];
        $this->assertNotSame([], $forms);
        $this->assertSame($forms, $artifact['entities']['forms'] ?? null);
        $this->assertTrue((bool) array_filter(
            $forms,
            static fn (array $form): bool => ($form['id'] ?? '') === 'contact-form'
                && ($form['routePath'] ?? '') === '/nested/about'
        ));
        $this->assertStringContainsString('%%PAGECRAFT_FORM_ENDPOINT:contact-form%%', $body);

        $collections = is_array($artifact['cms']['collections'] ?? null) ? $artifact['cms']['collections'] : [];
        $this->assertNotSame([], $collections);
        $itemCount = array_sum(array_map(
            static fn (array $collection): int => count((array) ($collection['items'] ?? [])),
            array_values(array_filter($collections, 'is_array'))
        ));
        $this->assertGreaterThan(0, $itemCount);
        $assets = is_array($artifact['assets'] ?? null) ? $artifact['assets'] : [];
        $this->assertTrue((bool) array_filter(
            $assets,
            static fn (array $asset): bool => ($asset['assetId'] ?? '') === 'assethero'
                && ($asset['mime'] ?? '') === 'image/png'
                && (int) ($asset['bytes'] ?? 0) > 8
        ));

        $fixture = $this->fixture();
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        $merged = Sync::mergeArtifact($manifest, $artifact, []);
        $this->assertCount(count($routes), $merged['pages']);
        $this->assertSame($forms, $merged['forms']);
        $this->assertSame($collections, $merged['cms']['collections']);
        $this->assertSame([], $merged['_pendingScripts']);
    }

    public function test_staging_rejects_invalid_forms_even_when_artifact_and_manifest_lists_match(): void
    {
        $fixture = $this->fixture();
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        $invalid = [[
            'id' => 'contact-form', 'routePath' => '/', 'method' => 'POST',
            'fields' => [['name' => 'PageCraft_token', 'type' => 'text', 'required' => false]],
        ]];
        $artifact = $fixture['artifact'];
        $artifact['forms'] = $invalid;
        $artifact['entities']['forms'] = $invalid;
        $manifest['forms'] = $invalid;
        $manifest['entities']['forms'] = $invalid;

        $result = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_form_definition_field', $result->get_error_code());
    }

    public function test_staging_rejects_top_level_forms_that_drift_from_signed_native_entities(): void
    {
        $fixture = $this->fixture();
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        $extra = [
            'id' => 'newsletter', 'routePath' => '/', 'method' => 'POST',
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => true]],
        ];
        $artifact = $fixture['artifact'];
        $artifact['forms'][] = $extra;
        $manifest['forms'][] = $extra;

        $result = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_forms_mismatch', $result->get_error_code());
    }

    public function test_pagecraft_theme_rejects_shared_form_missing_on_one_rendered_route(): void
    {
        [$artifact, $manifest] = $this->sharedShellFormFixture(['/contact'], ['/contact']);

        $result = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_shared_form_placeholder', $result->get_error_code());
        $this->assertStringContainsString('exact signed definition and placeholder', $result->get_error_message());
    }

    public function test_pagecraft_theme_accepts_shared_form_contracted_for_every_rendered_route(): void
    {
        [$artifact, $manifest] = $this->sharedShellFormFixture(['/', '/contact'], ['/', '/contact']);

        $staged = $this->stage($artifact, $manifest);

        $this->assertIsArray($staged, is_wp_error($staged) ? $staged->get_error_message() : '');
        (new Stager())->removeDirectory((string) $staged['directory']);
    }

    public function test_existing_theme_does_not_require_forms_for_omitted_shared_shell_routes(): void
    {
        [$artifact, $manifest] = $this->sharedShellFormFixture(['/contact'], ['/contact']);
        $manifest['profile'] = 'existing-theme';

        $staged = $this->stage($artifact, $manifest);

        $this->assertIsArray($staged, is_wp_error($staged) ? $staged->get_error_message() : '');
        (new Stager())->removeDirectory((string) $staged['directory']);
    }

    /** @dataProvider malformedSharedFormPairs */
    public function test_staging_rejects_extra_missing_or_route_drifted_form_placeholder_pairs(string $variant): void
    {
        [$artifact, $manifest] = $this->sharedShellFormFixture(['/', '/contact'], ['/', '/contact']);
        if ($variant === 'missing') {
            array_shift($manifest['placeholders']);
        } elseif ($variant === 'extra') {
            $manifest['placeholders'][] = [
                'id' => 'extra-form',
                'kind' => 'form',
                'routePath' => '/',
                'token' => '%%PAGECRAFT_FORM_ENDPOINT:extra-form%%',
            ];
        } else {
            $manifest['placeholders'][0]['routePath'] = '/wrong-route';
        }

        $result = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_form_placeholder', $result->get_error_code());
    }

    /** @return iterable<string,array{string}> */
    public static function malformedSharedFormPairs(): iterable
    {
        yield 'missing placeholder' => ['missing'];
        yield 'extra placeholder' => ['extra'];
        yield 'route drift' => ['drift'];
    }

    /** @dataProvider invalidHeadOrderValues */
    public function test_staging_requires_the_explicit_css_before_runtime_head_contract(?string $headOrder): void
    {
        $fixture = $this->fixture();
        $artifact = $fixture['artifact'];
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        if ($headOrder === null) {
            unset($artifact['routes'][0]['headOrder']);
        } else {
            $artifact['routes'][0]['headOrder'] = $headOrder;
        }

        $result = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_head_order', $result->get_error_code());
    }

    /** @return iterable<string,array{?string}> */
    public static function invalidHeadOrderValues(): iterable
    {
        yield 'missing' => [null];
        yield 'unsupported order' => ['runtime-before-css'];
    }

    public function test_staging_cross_checks_position_bound_runtime_occurrences_with_signed_manifest_placeholders(): void
    {
        [$artifact, $manifest] = $this->positionBoundRuntimeFixture();

        $staged = $this->stage($artifact, $manifest);

        $this->assertIsArray($staged, is_wp_error($staged) ? $staged->get_error_message() : '');
        (new Stager())->removeDirectory((string) $staged['directory']);
    }

    /** @dataProvider invalidRuntimeContractMutations */
    public function test_staging_rejects_missing_extra_duplicate_or_drifted_runtime_contract_entries(string $mutation): void
    {
        [$artifact, $manifest] = $this->positionBoundRuntimeFixture();
        $runtimeIndexes = array_keys(array_filter(
            (array) $manifest['placeholders'],
            static fn (mixed $placeholder): bool => is_array($placeholder) && ($placeholder['kind'] ?? '') === 'runtime'
        ));
        $index = (int) ($runtimeIndexes[0] ?? -1);
        $this->assertGreaterThanOrEqual(0, $index);
        if ($mutation === 'missing') {
            unset($manifest['placeholders'][$index]);
            $manifest['placeholders'] = array_values($manifest['placeholders']);
        } elseif ($mutation === 'extra') {
            $manifest['placeholders'][] = [
                'kind' => 'runtime',
                'routePath' => '/',
                'id' => 'script-' . str_repeat('b', 32),
                'token' => '%%PAGECRAFT_RUNTIME:script-' . str_repeat('b', 32) . '%%',
            ];
        } elseif ($mutation === 'duplicate') {
            $manifest['placeholders'][] = $manifest['placeholders'][$index];
        } elseif ($mutation === 'drift') {
            $manifest['placeholders'][$index]['routePath'] = '/another-route';
        } elseif (str_starts_with($mutation, 'script-')) {
            $scriptIndexes = array_keys(array_filter(
                (array) $manifest['scripts'],
                static fn (mixed $script): bool => is_array($script)
                    && ($script['occurrenceId'] ?? '') === 'script-' . str_repeat('a', 32)
            ));
            $scriptIndex = (int) ($scriptIndexes[0] ?? -1);
            $this->assertGreaterThanOrEqual(0, $scriptIndex);
            if ($mutation === 'script-missing') {
                unset($manifest['scripts'][$scriptIndex]);
                $manifest['scripts'] = array_values($manifest['scripts']);
            } elseif ($mutation === 'script-extra') {
                $extra = $manifest['scripts'][$scriptIndex];
                $extra['occurrenceId'] = 'script-' . str_repeat('b', 32);
                $extra['token'] = '%%PAGECRAFT_RUNTIME:' . $extra['occurrenceId'] . '%%';
                $manifest['scripts'][] = $extra;
            } elseif ($mutation === 'script-duplicate') {
                $manifest['scripts'][] = $manifest['scripts'][$scriptIndex];
            } elseif ($mutation === 'script-drift') {
                $manifest['scripts'][$scriptIndex]['hash'] = str_repeat('f', 64);
            }
        }

        $result = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame(
            str_starts_with($mutation, 'script-') ? 'pagecraft_runtime_manifest' : 'pagecraft_runtime_placeholder',
            $result->get_error_code()
        );
    }

    /** @return iterable<string,array{string}> */
    public static function invalidRuntimeContractMutations(): iterable
    {
        yield 'missing' => ['missing'];
        yield 'extra' => ['extra'];
        yield 'duplicate' => ['duplicate'];
        yield 'route drift' => ['drift'];
        yield 'manifest script missing' => ['script-missing'];
        yield 'manifest script extra' => ['script-extra'];
        yield 'manifest script duplicate' => ['script-duplicate'];
        yield 'manifest script drift' => ['script-drift'];
    }

    /** @dataProvider overlongRedirects */
    public function test_staging_rejects_redirect_paths_beyond_the_storage_boundary(string $field): void
    {
        $fixture = $this->fixture();
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        $artifact = $fixture['artifact'];
        $redirect = ['from' => '/legacy.html', 'to' => '/managed/', 'status' => 301];
        $redirect[$field] = '/' . str_repeat('a', 191) . '/';
        $artifact['redirects'] = [$redirect];
        $manifest['redirects'] = [$redirect];

        $result = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_redirect', $result->get_error_code());
    }

    /** @return iterable<string,array{string}> */
    public static function overlongRedirects(): iterable
    {
        yield 'source' => ['from'];
        yield 'destination' => ['to'];
    }

    public function test_one_signed_native_link_artifact_materializes_against_each_target_origin(): void
    {
        [$artifact, $manifest, $token] = $this->nativeLinkFixture();

        $this->nativePost(71, 'https://staging.example.test/preview', '/native-contact/', 'page');
        $staging = $this->stage($artifact, $manifest);
        $this->assertIsArray($staging, is_wp_error($staging) ? $staging->get_error_message() : '');
        $this->assertStringContainsString(
            'href="https://staging.example.test/preview/native-contact/"',
            (string) $staging['artifact']['routes'][0]['bodyHtml']
        );
        (new Stager())->removeDirectory($staging['directory']);

        $GLOBALS['pagecraft_test_posts'] = [];
        $GLOBALS['pagecraft_test_permalinks'] = [];
        $GLOBALS['pagecraft_test_url_post_ids'] = [];
        $this->nativePost(93, 'https://production.example.test', '/native-contact/', 'page');
        $production = $this->stage($artifact, $manifest);
        $this->assertIsArray($production, is_wp_error($production) ? $production->get_error_message() : '');
        $html = (string) $production['artifact']['routes'][0]['bodyHtml'];
        $this->assertStringContainsString('href="https://production.example.test/native-contact/"', $html);
        $this->assertStringContainsString(
            'href="https://production.example.test/native-contact/"',
            (string) $production['artifact']['routes'][1]['bodyHtml'],
            'A compiler route without a trailing slash must match WordPress\'s canonical route key.'
        );
        $this->assertStringNotContainsString('staging.example.test', $html);
        $this->assertStringNotContainsString($token, $html);
        (new Stager())->removeDirectory($production['directory']);
    }

    public function test_native_link_staging_rejects_a_missing_or_wrong_type_local_route(): void
    {
        [$artifact, $manifest] = $this->nativeLinkFixture();
        $GLOBALS['pagecraft_test_home'] = 'https://production.example.test';

        $missing = $this->stage($artifact, $manifest);
        $this->assertInstanceOf(\WP_Error::class, $missing);
        $this->assertSame('pagecraft_wordpress_content_missing', $missing->get_error_code());

        $this->nativePost(94, 'https://production.example.test', '/native-contact/', 'post');
        $wrongType = $this->stage($artifact, $manifest);
        $this->assertInstanceOf(\WP_Error::class, $wrongType);
        $this->assertSame('pagecraft_wordpress_content_missing', $wrongType->get_error_code());
    }

    public function test_native_link_staging_rejects_a_local_permalink_that_moved_from_the_signed_route(): void
    {
        [$artifact, $manifest] = $this->nativeLinkFixture();
        $this->nativePost(96, 'https://production.example.test', '/native-contact/', 'page');
        $GLOBALS['pagecraft_test_permalinks'][96] = 'https://production.example.test/moved-contact/';

        $mismatch = $this->stage($artifact, $manifest);

        $this->assertInstanceOf(\WP_Error::class, $mismatch);
        $this->assertSame('pagecraft_wordpress_content_mismatch', $mismatch->get_error_code());
    }

    public function test_native_link_staging_rejects_undeclared_and_tampered_placeholders(): void
    {
        [$artifact, $manifest] = $this->nativeLinkFixture();
        $this->nativePost(95, 'https://production.example.test', '/native-contact/', 'page');

        $undeclared = $manifest;
        $undeclared['placeholders'] = array_values(array_filter(
            (array) $undeclared['placeholders'],
            static fn (mixed $placeholder): bool => !is_array($placeholder)
                || ($placeholder['kind'] ?? '') !== 'wordpress-content'
        ));
        $result = $this->stage($artifact, $undeclared);
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_wordpress_content_placeholder', $result->get_error_code());

        $tampered = $manifest;
        foreach ($tampered['placeholders'] as &$placeholder) {
            if (is_array($placeholder) && ($placeholder['kind'] ?? '') === 'wordpress-content') {
                $placeholder['path'] = '/another-page/';
                break;
            }
        }
        unset($placeholder);
        $result = $this->stage($artifact, $tampered);
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_wordpress_content_placeholder', $result->get_error_code());
    }

    /** @param array<string,mixed> $artifact @param array<string,mixed> $manifest @return array<string,mixed>|\WP_Error */
    private function stage(array $artifact, array $manifest): array|\WP_Error
    {
        $bytes = CanonicalJson::encode($artifact);
        $manifest['artifactBytes'] = strlen($bytes);
        $manifest['artifactHash'] = hash('sha256', $bytes);
        $file = tempnam(sys_get_temp_dir(), 'pagecraft-form-contract-');
        if (!is_string($file)) {
            return new \WP_Error('pagecraft_test_temp', 'Could not create a test artifact.');
        }
        file_put_contents($file, $bytes);
        try {
            return (new Stager())->stageCanonicalArtifact($file, $manifest);
        } finally {
            wp_delete_file($file);
        }
    }

    /** @return array{array<string,mixed>,array<string,mixed>} */
    private function positionBoundRuntimeFixture(): array
    {
        $fixture = $this->fixture();
        $artifact = $fixture['artifact'];
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        $template = '<script>window.pagecraftPositionBound=1</script>';
        $id = 'script-' . str_repeat('a', 32);
        $token = '%%PAGECRAFT_RUNTIME:' . $id . '%%';
        $artifact['routes'][0]['runtime'] = $template;
        $artifact['routes'][0]['scripts'] = [[
            'occurrenceId' => $id,
            'region' => 'route-body',
            'order' => 0,
            'placement' => 'body',
            'token' => $token,
            'hash' => hash('sha256', $template),
            'kind' => 'generated',
        ]];
        $artifact['routes'][0]['bodyHtml'] .= '<!--' . $token . '-->';
        $manifest['placeholders'][] = [
            'kind' => 'runtime',
            'routePath' => (string) $artifact['routes'][0]['path'],
            'id' => $id,
            'token' => $token,
        ];
        $manifest['scripts'][] = [
            'source' => 'generated',
            'ownerId' => (string) $artifact['routes'][0]['pageId'],
            'occurrenceId' => $id,
            'region' => 'route-body',
            'order' => 0,
            'placement' => 'body',
            'token' => $token,
            'hash' => hash('sha256', $template),
            'kind' => 'generated',
        ];
        usort($manifest['scripts'], static function (array $left, array $right): int {
            $leftKey = (string) $left['ownerId'] . ':' . (string) $left['region'] . ':'
                . str_pad((string) $left['order'], 8, '0', STR_PAD_LEFT) . ':' . (string) $left['occurrenceId'];
            $rightKey = (string) $right['ownerId'] . ':' . (string) $right['region'] . ':'
                . str_pad((string) $right['order'], 8, '0', STR_PAD_LEFT) . ':' . (string) $right['occurrenceId'];
            return strcmp($leftKey, $rightKey);
        });
        return [$artifact, $manifest];
    }

    /**
     * @param list<string> $definitionRoutes
     * @param list<string> $placeholderRoutes
     * @return array{array<string,mixed>,array<string,mixed>}
     */
    private function sharedShellFormFixture(array $definitionRoutes, array $placeholderRoutes): array
    {
        $fixture = $this->fixture();
        $artifact = $fixture['artifact'];
        $manifest = Support::decodeObject(Support::base64UrlDecode((string) $fixture['desired']['release']['manifest']));
        $root = $artifact['routes'][0];
        $contact = $root;
        $contact['path'] = '/contact';
        $contact['pageId'] = 'page-contact';
        $artifact['routes'] = [$root, $contact];
        $artifact['shared']['footerHtml'] .= '<form action="%%PAGECRAFT_FORM_ENDPOINT:shared-newsletter%%" method="POST" data-pagecraft-form-mode="wordpress"><input name="email" type="email"></form>';

        $definition = [
            'id' => 'shared-newsletter',
            'routePath' => '/',
            'method' => 'POST',
            'fields' => [[
                'name' => 'email',
                'type' => 'email',
                'required' => true,
                'privacy' => 'email',
            ]],
        ];
        $definitions = [];
        foreach ($definitionRoutes as $routePath) {
            $routeDefinition = $definition;
            $routeDefinition['routePath'] = $routePath;
            $definitions[] = $routeDefinition;
        }
        $artifact['forms'] = $definitions;
        $artifact['entities']['forms'] = $definitions;
        $manifest['forms'] = $definitions;
        $manifest['entities']['forms'] = $definitions;
        $manifest['profile'] = 'pagecraft-theme';
        $manifest['scripts'] = [];
        $manifest['placeholders'] = [];
        foreach ($placeholderRoutes as $routePath) {
            $manifest['placeholders'][] = [
                'id' => 'shared-newsletter',
                'kind' => 'form',
                'routePath' => $routePath,
                'token' => '%%PAGECRAFT_FORM_ENDPOINT:shared-newsletter%%',
            ];
        }
        return [$artifact, $manifest];
    }

    /** @return array{array<string,mixed>,array<string,mixed>,string} */
    private function nativeLinkFixture(): array
    {
        $fixture = $this->fixture();
        $artifact = $fixture['artifact'];
        $manifest = Support::decodeObject(
            Support::base64UrlDecode((string) $fixture['desired']['release']['manifest'])
        );
        $path = '/native-contact/';
        $token = '%%PAGECRAFT_WP_CONTENT:page:' . Support::base64UrlEncode($path) . '%%';
        $artifact['routes'][0]['bodyHtml'] .= '<a href="' . $token . '">Native contact</a>';
        $manifest['placeholders'][] = [
            'routePath' => (string) $artifact['routes'][0]['path'],
            'kind' => 'wordpress-content',
            'objectType' => 'page',
            'path' => $path,
            'token' => $token,
        ];
        $artifact['routes'][1]['bodyHtml'] .= '<a href="' . $token . '">Nested native contact</a>';
        $manifest['placeholders'][] = [
            'routePath' => (string) $artifact['routes'][1]['path'],
            'kind' => 'wordpress-content',
            'objectType' => 'page',
            'path' => $path,
            'token' => $token,
        ];
        return [$artifact, $manifest, $token];
    }

    private function nativePost(int $postId, string $home, string $path, string $type): void
    {
        $GLOBALS['pagecraft_test_home'] = $home;
        $url = rtrim($home, '/') . '/' . ltrim($path, '/');
        $GLOBALS['pagecraft_test_posts'][$postId] = new \WP_Post([
            'ID' => $postId,
            'post_type' => $type,
            'post_status' => 'publish',
            'post_name' => trim($path, '/'),
            'post_title' => 'Native contact',
        ]);
        $GLOBALS['pagecraft_test_permalinks'][$postId] = $url;
        $GLOBALS['pagecraft_test_url_post_ids'][$url] = $postId;
    }

    /** @return array<string,mixed> */
    private function fixture(): array
    {
        $configured = getenv('PAGECRAFT_GOLDEN_ARTIFACT_FIXTURE');
        $candidates = array_filter([
            is_string($configured) ? $configured : '',
            dirname(__DIR__, 3) . '/server/tests/fixtures/wordpress-artifact-v1.json',
            '/opt/pagecraft-tests/fixtures/wordpress-artifact-v1.json',
        ]);
        foreach ($candidates as $fixturePath) {
            if (is_file($fixturePath)) {
                return json_decode((string) file_get_contents($fixturePath), true, 128, JSON_THROW_ON_ERROR);
            }
        }
        $this->markTestSkipped('The shared backend golden artifact is not mounted in this isolated plugin runtime.');
    }
}
