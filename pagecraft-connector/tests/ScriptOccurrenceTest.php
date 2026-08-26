<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Forms;
use Pagecraft\Connector\Mapper;
use Pagecraft\Connector\ReleaseRepository;
use Pagecraft\Connector\ReleaseVerifier;
use Pagecraft\Connector\Renderer;
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\ScriptOccurrences;
use Pagecraft\Connector\Seo;
use Pagecraft\Connector\Stager;
use ReflectionClass;
use ReflectionMethod;

final class ScriptOccurrenceTest extends ConnectorTestCase
{
    public function test_manifest_inventory_uses_explicit_utf8_byte_order_for_mixed_owner_ids(): void
    {
        $expected = [];
        foreach (['a', 'B', 'A_', 'A-'] as $index => $ownerId) {
            $id = 'script-' . str_pad((string) $index, 32, '0', STR_PAD_LEFT);
            $expected[$id] = [
                'source' => 'page',
                'ownerId' => $ownerId,
                'occurrenceId' => $id,
                'region' => 'route-tail',
                'order' => 0,
                'placement' => 'body',
                'token' => '%%PAGECRAFT_RUNTIME:' . $id . '%%',
                'hash' => hash('sha256', $ownerId),
                'kind' => 'authored',
            ];
        }
        $actual = array_values($expected);
        usort($actual, static function (array $left, array $right): int {
            $leftKey = $left['ownerId'] . ':' . $left['region'] . ':00000000:' . $left['occurrenceId'];
            $rightKey = $right['ownerId'] . ':' . $right['region'] . ':00000000:' . $right['occurrenceId'];
            return strcmp($leftKey, $rightKey);
        });
        $validate = new ReflectionMethod(Stager::class, 'validateManifestScripts');

        $this->assertSame(['A-', 'A_', 'B', 'a'], array_column($actual, 'ownerId'));
        $this->assertTrue($validate->invoke(new Stager(), $actual, $expected));
        [$actual[0], $actual[1]] = [$actual[1], $actual[0]];
        $this->assertInstanceOf(\WP_Error::class, $validate->invoke(new Stager(), $actual, $expected));
    }

    public function test_verifier_accepts_repeated_ordered_occurrences_but_approval_stays_per_fingerprint(): void
    {
        $script = '<script>window.widget=(window.widget||0)+1</script>';
        $hash = hash('sha256', $script);
        $shared = '<script>window.shell=true</script>';
        $artifact = [
            'shared' => [
                'runtime' => $shared,
                'scripts' => [$this->occurrence($shared, 'shared-header', 0, '0')],
            ],
            'routes' => [[
                'path' => '/managed/',
                'runtime' => $script . "\n" . $script,
                'scripts' => [
                    $this->occurrence($script, 'route-body', 0, '1'),
                    $this->occurrence($script, 'route-body', 1, '2'),
                ],
                'headHtml' => '',
                'bodyHtml' => '',
            ]],
        ];

        $pending = (new ReleaseVerifier(new Connection(), new ScriptApprovals()))
            ->inspectArtifactScripts($artifact);

        $this->assertSame([$hash], $pending, 'Approval is intentionally target-local and fingerprint-based.');
        $this->assertCount(1, $GLOBALS['wpdb']->scriptApprovals);
        $this->assertArrayNotHasKey(hash('sha256', $shared), $GLOBALS['wpdb']->scriptApprovals, 'Existing Theme does not execute its omitted Pagecraft shell.');
    }

    public function test_mapper_pairs_runtime_and_declarations_by_occurrence_instead_of_hash(): void
    {
        $script = '<script>window.widget=(window.widget||0)+1</script>';
        $hash = hash('sha256', $script);
        $page = [
            'pageId' => 'page-script-occurrences',
            'path' => '/managed/',
            'title' => 'Managed',
            'bodyKind' => 'content-fragment',
            'headOrder' => 'css-before-runtime',
            'bodyHtml' => '<p>Managed</p>',
            'headHtml' => '',
            'runtime' => implode("\n", [$script, $script, $script]),
            'scripts' => [
                $this->occurrence($script, 'route-head', 0, '3'),
                $this->occurrence($script, 'route-body', 0, '4'),
                $this->occurrence($script, 'route-body', 1, '5'),
            ],
            'sourceHash' => str_repeat('a', 64),
            '_profile' => 'existing-theme',
            '_deploymentId' => 'deployment-script:target:1',
            '_artifactHash' => str_repeat('b', 64),
        ];
        $mapper = (new ReflectionClass(Mapper::class))->newInstanceWithoutConstructor();
        $result = (new ReflectionMethod(Mapper::class, 'hydratePage'))->invoke($mapper, $page, [], []);

        $this->assertIsArray($result);
        $this->assertCount(3, $result['scripts']);
        $this->assertSame(['head', 'body', 'body'], array_column($result['scripts'], 'placement'));
        $this->assertSame([$hash, $hash, $hash], array_column($result['scripts'], 'fingerprint'));
        $this->assertSame(['route-head', 'route-body', 'route-body'], array_column($result['scripts'], 'region'));
        $this->assertSame([0, 0, 1], array_column($result['scripts'], 'order'));
    }

    public function test_mapper_and_renderer_emit_consolidated_css_before_approved_head_runtime(): void
    {
        $script = '<script>window.pagecraftHeadSawCss=getComputedStyle(document.documentElement).getPropertyValue("--pagecraft-head-order")</script>';
        $occurrence = $this->occurrence($script, 'route-head', 0, 'a');
        $page = [
            'pageId' => 'page-head-order',
            'path' => '/head-order/',
            'title' => 'Head order',
            'bodyKind' => 'content-fragment',
            'headOrder' => 'css-before-runtime',
            'bodyHtml' => '<p>Head order</p>',
            'headHtml' => '<meta name="viewport" content="width=device-width"><!--' . $occurrence['token'] . '-->',
            'css' => '.pagecraft-root{--pagecraft-head-order:ready}.pagecraft-root .head-order{color:green}',
            'runtime' => $script,
            'scripts' => [$occurrence],
            'sourceHash' => str_repeat('a', 64),
            '_profile' => 'pagecraft-theme',
            '_deploymentId' => 'deployment-head-order:target:1',
            '_artifactHash' => str_repeat('b', 64),
            '_shared' => [
                'headerHtml' => '',
                'footerHtml' => '',
                'css' => '@font-face{font-family:Frozen;src:url(data:font/woff2;base64,d09GMg==)}',
                'runtime' => '',
                'scripts' => [],
            ],
        ];
        $mapper = (new ReflectionClass(Mapper::class))->newInstanceWithoutConstructor();
        $hydrate = new ReflectionMethod(Mapper::class, 'hydratePage');
        $mapped = $hydrate->invoke($mapper, $page, [], []);

        $this->assertIsArray($mapped);
        $this->assertLessThan(
            strpos($mapped['head_html'], '<!--' . $occurrence['token'] . '-->'),
            strpos($mapped['head_html'], '<style data-pagecraft-route>')
        );
        $this->assertLessThan(
            strpos($mapped['head_html'], '.pagecraft-root{--pagecraft-head-order:ready}'),
            strpos($mapped['head_html'], '@font-face')
        );

        $fingerprint = hash('sha256', $script);
        $GLOBALS['wpdb']->scriptApprovals[$fingerprint] = [
            'fingerprint' => $fingerprint,
            'label' => 'Approved head-order script',
            'first_seen' => '2026-08-26 00:00:00',
            'approved_at' => '2026-08-26 00:01:00',
            'approved_by' => 7,
            'revoked_at' => null,
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-head-order:target:1';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = ['profile' => 'pagecraft-theme'];
        $GLOBALS['wpdb']->routeRows = [[
            'id' => 1,
            'release_id' => 'deployment-head-order:target:1',
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
            'seo_json' => '{}',
            'scripts_json' => json_encode($mapped['scripts'], JSON_THROW_ON_ERROR),
        ]];
        $_SERVER['REQUEST_URI'] = '/head-order/';
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
        $rendered = (string) ob_get_clean();

        $this->assertSame(1, substr_count($rendered, '<style data-pagecraft-route>'));
        $this->assertSame(1, substr_count($rendered, $script));
        $this->assertLessThan(strpos($rendered, $script), strpos($rendered, '<style data-pagecraft-route>'));
        $this->assertStringNotContainsString('%%PAGECRAFT_RUNTIME:', $rendered);

        $page['_profile'] = 'existing-theme';
        $existing = $hydrate->invoke($mapper, $page, [], []);
        $this->assertIsArray($existing);
        $this->assertStringContainsString('.pagecraft-root .head-order{color:green}', $existing['head_html']);
        $this->assertLessThan(
            strpos($existing['head_html'], '<!--' . $occurrence['token'] . '-->'),
            strpos($existing['head_html'], '<style data-pagecraft-route>')
        );
    }

    public function test_renderer_injects_approved_occurrences_at_exact_markers_and_keeps_tail_order(): void
    {
        $literal = '%%PAGECRAFT_RUNTIME:script-' . str_repeat('f', 32) . '%%';
        $same = '<script>window.tokenExample="' . $literal . '";document.currentScript.previousElementSibling.setAttribute("data-ready","yes")</script>';
        $sameHash = hash('sha256', $same);
        $tail = '<script>window.tail=true</script>';
        $tailHash = hash('sha256', $tail);
        $scripts = [
            $this->mappedOccurrence($same, 'route-head', 0, '6'),
            $this->mappedOccurrence($same, 'route-body', 0, '7'),
            $this->mappedOccurrence($same, 'route-body', 1, '8'),
            $this->mappedOccurrence($tail, 'route-tail', 0, '9'),
        ];
        foreach ([$sameHash, $tailHash] as $hash) {
            $GLOBALS['wpdb']->scriptApprovals[$hash] = [
                'fingerprint' => $hash,
                'label' => 'Approved test script',
                'first_seen' => '2026-08-26 00:00:00',
                'approved_at' => '2026-08-26 00:01:00',
                'approved_by' => 7,
                'revoked_at' => null,
            ];
        }
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-script:target:1';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = ['profile' => 'pagecraft-theme'];
        $GLOBALS['wpdb']->routeRows = [[
            'id' => 1,
            'release_id' => 'deployment-script:target:1',
            'route_path' => '/managed/',
            'page_id' => 'page-script-occurrences',
            'post_id' => null,
            'title' => 'Managed',
            'description' => '',
            'head_html' => '<meta name="viewport" content="width=device-width">'
                . '<!--' . $scripts[0]['token'] . '-->',
            'body_html' => '<div id="first-widget"></div><!--' . $scripts[1]['token'] . '-->'
                . '<div id="second-widget"></div><!--' . $scripts[2]['token'] . '-->',
            'content_hash' => str_repeat('a', 64),
            'source_hash' => str_repeat('b', 64),
            'status' => 'publish',
            'seo_json' => '{}',
            'scripts_json' => json_encode($scripts, JSON_THROW_ON_ERROR),
        ]];
        $_SERVER['REQUEST_URI'] = '/managed/';
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
        $body = (string) $renderer->renderRoute('/managed/');
        ob_start();
        $renderer->renderScripts('body');
        $tailOutput = (string) ob_get_clean();
        ob_start();
        $renderer->renderScripts('body');
        $tailAgain = (string) ob_get_clean();

        $this->assertSame(1, substr_count($head, $same));
        $this->assertSame(2, substr_count($body, $same));
        $this->assertStringContainsString('<div id="first-widget"></div>' . $same, $body);
        $this->assertStringContainsString('<div id="second-widget"></div>' . $same, $body);
        $this->assertSame(2, substr_count($body, $literal), 'Approved script string literals must remain byte-exact.');
        $this->assertSame(1, substr_count($tailOutput, $tail));
        $this->assertSame('', $tailAgain, 'A hook retry must not replay already-rendered occurrences.');
    }

    public function test_profile_composition_preserves_document_regions_and_omits_unrendered_shell_scripts(): void
    {
        $routeHead = '<script>window.order=["route-head"]</script>';
        $sharedHeader = '<script>window.order.push("shared-header")</script>';
        $routeBody = '<script>window.order.push("route-body")</script>';
        $sharedFooter = '<script>window.order.push("shared-footer")</script>';
        $routeTail = '<script>window.order.push("route-tail")</script>';
        $page = [
            'pageId' => 'page-script-regions',
            'path' => '/managed/',
            'title' => 'Managed',
            'bodyKind' => 'content-fragment',
            'headOrder' => 'css-before-runtime',
            'bodyHtml' => '<p>Managed</p>',
            'headHtml' => '',
            'css' => '.pagecraft-root .cascade{color:red}.pagecraft-root .cascade{color:blue}',
            'runtime' => implode("\n", [$routeHead, $routeBody, $routeTail]),
            'scripts' => [
                $this->occurrence($routeHead, 'route-head', 0, 'a'),
                $this->occurrence($routeBody, 'route-body', 0, 'b'),
                $this->occurrence($routeTail, 'route-tail', 0, 'c'),
            ],
            'sourceHash' => str_repeat('a', 64),
            '_deploymentId' => 'deployment-regions:target:1',
            '_artifactHash' => str_repeat('b', 64),
            '_shared' => [
                'headerHtml' => '<header>Header</header>',
                'footerHtml' => '<footer>Footer</footer>',
                'css' => '@font-face{font-family:Frozen;src:url(data:font/woff2;base64,d09GMg==)}',
                'runtime' => implode("\n", [$sharedHeader, $sharedFooter]),
                'scripts' => [
                    $this->occurrence($sharedHeader, 'shared-header', 0, 'd'),
                    $this->occurrence($sharedFooter, 'shared-footer', 0, 'e'),
                ],
            ],
        ];
        $mapper = (new ReflectionClass(Mapper::class))->newInstanceWithoutConstructor();
        $hydrate = new ReflectionMethod(Mapper::class, 'hydratePage');

        $page['_profile'] = 'pagecraft-theme';
        $theme = $hydrate->invoke($mapper, $page, [], []);
        $this->assertIsArray($theme);
        $this->assertSame(
            ['route-head', 'shared-header', 'route-body', 'shared-footer', 'route-tail'],
            array_column($theme['scripts'], 'region')
        );
        $this->assertStringContainsString('<header>Header</header><p>Managed</p><footer>Footer</footer>', $theme['body_html']);
        $this->assertLessThan(
            strpos($theme['head_html'], '.pagecraft-root .cascade'),
            strpos($theme['head_html'], '@font-face')
        );

        $page['_profile'] = 'existing-theme';
        $existing = $hydrate->invoke($mapper, $page, [], []);
        $this->assertIsArray($existing);
        $this->assertSame(['route-head', 'route-body', 'route-tail'], array_column($existing['scripts'], 'region'));
        $this->assertStringNotContainsString('Header', $existing['body_html']);
        $this->assertStringNotContainsString('Footer', $existing['body_html']);
    }

    public function test_occurrence_contract_rejects_duplicate_ids_wrong_regions_and_noncontiguous_order(): void
    {
        $one = '<script>window.one=1</script>';
        $two = '<script>window.two=1</script>';
        $first = $this->occurrence($one, 'route-body', 0, 'f');

        $duplicate = ScriptOccurrences::parse(
            $one . "\n" . $two,
            [$first, $first + ['hash' => hash('sha256', $two)]],
            'route'
        );
        $this->assertInstanceOf(\WP_Error::class, $duplicate);

        $wrongRegion = ScriptOccurrences::parse($one, [
            $this->occurrence($one, 'shared-header', 0, '0'),
        ], 'route');
        $this->assertInstanceOf(\WP_Error::class, $wrongRegion);

        $wrongPlacement = $this->occurrence($one, 'route-head', 0, '1');
        $wrongPlacement['placement'] = 'body';
        $this->assertInstanceOf(\WP_Error::class, ScriptOccurrences::parse($one, [$wrongPlacement], 'route'));

        $skippedOrder = $this->occurrence($one, 'route-body', 2, '2');
        $this->assertInstanceOf(\WP_Error::class, ScriptOccurrences::parse($one, [$skippedOrder], 'route'));
    }

    public function test_runtime_markers_must_match_signed_occurrences_one_for_one_and_in_order(): void
    {
        $one = $this->occurrence('<script>window.one=1</script>', 'route-body', 0, '3');
        $two = $this->occurrence('<script>window.two=1</script>', 'route-body', 1, '4');
        $valid = '<div id="one"></div><!--' . $one['token'] . '-->'
            . '<div id="two"></div><!--' . $two['token'] . '-->';

        $this->assertTrue(ScriptOccurrences::validateMarkers($valid, [$one, $two], 'route-body'));
        $this->assertInstanceOf(\WP_Error::class, ScriptOccurrences::validateMarkers(
            '<div></div><!--' . $one['token'] . '-->',
            [$one, $two],
            'route-body'
        ));
        $this->assertInstanceOf(\WP_Error::class, ScriptOccurrences::validateMarkers(
            '<!--' . $one['token'] . '--><!--' . $one['token'] . '-->',
            [$one, $two],
            'route-body'
        ));
        $this->assertInstanceOf(\WP_Error::class, ScriptOccurrences::validateMarkers(
            '<!--%%PAGECRAFT_RUNTIME:script-' . str_repeat('f', 32) . '%%-->',
            [$one, $two],
            'route-body'
        ));
        $this->assertInstanceOf(\WP_Error::class, ScriptOccurrences::validateMarkers(
            (string) $one['token'] . '<!--' . $two['token'] . '-->',
            [$one, $two],
            'route-body'
        ));
    }

    /** @return array<string,mixed> */
    private function occurrence(string $script, string $region, int $order, string $suffix): array
    {
        $occurrenceId = 'script-' . str_repeat('0', 31) . $suffix;
        return [
            'occurrenceId' => $occurrenceId,
            'region' => $region,
            'order' => $order,
            'placement' => $region === 'route-head' ? 'head' : 'body',
            'token' => '%%PAGECRAFT_RUNTIME:' . $occurrenceId . '%%',
            'hash' => hash('sha256', $script),
            'kind' => 'authored',
        ];
    }

    /** @return array<string,mixed> */
    private function mappedOccurrence(string $script, string $region, int $order, string $suffix): array
    {
        return $this->occurrence($script, $region, $order, $suffix) + [
            'fingerprint' => hash('sha256', $script),
            'html' => $script,
            'template_html' => $script,
        ];
    }
}
