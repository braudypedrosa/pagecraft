<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\CanonicalJson;
use Pagecraft\Connector\Connection;
use Pagecraft\Connector\ReleaseVerifier;
use Pagecraft\Connector\RootTrust;
use Pagecraft\Connector\ScriptApprovals;
use Pagecraft\Connector\Support;

final class ReleaseVerifierTest extends ConnectorTestCase
{
    private string $secret;
    private ReleaseVerifier $verifier;

    protected function setUp(): void
    {
        parent::setUp();
        $pair = sodium_crypto_sign_seed_keypair(str_repeat("\x33", SODIUM_CRYPTO_SIGN_SEEDBYTES));
        $this->secret = sodium_crypto_sign_secretkey($pair);
        $public = sodium_crypto_sign_publickey($pair);
        $keyset = RootTrust::verifyKeysetEnvelope(pagecraft_test_keyset_envelope('release-target-v1', $public), 'http://localhost:8787');
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'api_origin' => 'http://localhost:8787',
            'profile' => 'existing-theme',
            'environment' => 'staging',
            'keyset' => $keyset,
        ];
        $this->verifier = new ReleaseVerifier(new Connection(), new ScriptApprovals());
    }

    public function test_exact_release_and_target_envelopes_verify(): void
    {
        $verified = $this->verifier->verify($this->wrapper());
        $this->assertIsArray($verified);
        $this->assertSame('release-unit', $verified['releaseId']);
        $this->assertSame('release-unit:target:17', $verified['deploymentId']);
        $this->assertSame('http://localhost:8088', $verified['targetOrigin']);
    }

    public function test_release_ancestry_is_preserved_from_the_project_release_manifest(): void
    {
        $verified = $this->verifier->verify($this->wrapper([], ['parentReleaseId' => 'release-parent']));

        $this->assertIsArray($verified);
        $this->assertSame('release-parent', $verified['parentReleaseId']);
    }

    public function test_release_tamper_is_rejected(): void
    {
        $wrapper = $this->wrapper();
        $release = Support::decodeObject(Support::base64UrlDecode($wrapper['release']['manifest']));
        $release['sourceVersion'] = 99;
        $wrapper['release']['manifest'] = Support::base64UrlEncode(CanonicalJson::encode($release));

        $result = $this->verifier->verify($wrapper);
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertStringContainsString('signature is invalid', $result->get_error_message());
    }

    public function test_signed_envelope_for_another_origin_is_rejected(): void
    {
        $result = $this->verifier->verify($this->wrapper(['targetOrigin' => 'http://localhost:9999']));
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertStringContainsString('different WordPress origin', $result->get_error_message());
    }

    public function test_signed_envelope_for_a_cloned_installation_is_rejected(): void
    {
        $result = $this->verifier->verify($this->wrapper(['installationId' => 'installation-clone']));
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertStringContainsString('another WordPress installation', $result->get_error_message());
    }

    public function test_canonical_webhook_signature_and_replay_window_verify(): void
    {
        $event = [
            'type' => 'release.available',
            'eventId' => 'event-unit-1',
            'connectionId' => 'connection-unit',
            'releaseId' => 'release-unit',
            'sequence' => 17,
            'occurredAt' => gmdate('c'),
        ];
        $body = CanonicalJson::encode($event);
        $signature = sodium_crypto_sign_detached(ReleaseVerifier::WEBHOOK_PREFIX . $body, $this->secret);
        $verified = $this->verifier->verifyWebhook($body, Support::base64UrlEncode($signature), 'release-target-v1');

        $this->assertIsArray($verified);
        $this->assertSame('event-unit-1', $verified['eventId']);
    }

    public function test_expired_webhook_is_rejected_even_with_a_valid_signature(): void
    {
        $event = [
            'type' => 'release.available',
            'eventId' => 'event-unit-old',
            'connectionId' => 'connection-unit',
            'releaseId' => 'release-unit',
            'sequence' => 17,
            'occurredAt' => gmdate('c', time() - 10 * MINUTE_IN_SECONDS),
        ];
        $body = CanonicalJson::encode($event);
        $signature = sodium_crypto_sign_detached(ReleaseVerifier::WEBHOOK_PREFIX . $body, $this->secret);
        $result = $this->verifier->verifyWebhook($body, Support::base64UrlEncode($signature), 'release-target-v1');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertStringContainsString('replay window', $result->get_error_message());
    }

    public function test_inline_script_classification_uses_browser_attribute_semantics_and_placement(): void
    {
        $artifact = [
            'shared' => ['runtime' => '', 'scripts' => []],
            'routes' => [[
                'path' => '/managed/',
                'runtime' => '',
                'scripts' => [],
                'headHtml' => '<script nonce=unit TYPE=application&#x2f;ld+json>{"@id":"/managed/#page"}</script>'
                    . '<script data-kind=config type=application&#47;json>{"blocks":[1]}</script>'
                    . '<script nonce=unit TYPE=text/javascript>window.head=1</script>'
                    . '<script defer SRC=https://cdn.example/app.js></script>',
                'bodyHtml' => '<script data-place=body type=module>window.body=1</script>',
            ]],
        ];

        $pending = $this->verifier->inspectArtifactScripts($artifact);
        $expected = [
            hash('sha256', 'window.head=1'),
            hash('sha256', 'src:https://cdn.example/app.js'),
            hash('sha256', 'window.body=1'),
        ];
        sort($expected, SORT_STRING);

        $this->assertSame($expected, $pending);
        $this->assertStringContainsString('head', $GLOBALS['wpdb']->scriptApprovals[hash('sha256', 'window.head=1')]['label']);
        $this->assertStringContainsString('head', $GLOBALS['wpdb']->scriptApprovals[hash('sha256', 'src:https://cdn.example/app.js')]['label']);
        $this->assertStringContainsString('body', $GLOBALS['wpdb']->scriptApprovals[hash('sha256', 'window.body=1')]['label']);
        $this->assertArrayNotHasKey(hash('sha256', '{"blocks":[1]}'), $GLOBALS['wpdb']->scriptApprovals);
    }

    public function test_inline_script_classification_ignores_tag_shaped_text_in_inert_regions(): void
    {
        $artifact = [
            'shared' => ['runtime' => '', 'scripts' => []],
            'routes' => [[
                'path' => '/managed/',
                'runtime' => '',
                'scripts' => [],
                'headHtml' => '<!-- <script>commentExample()</script> -->'
                    . '<style>.example::after{content:"<script>styleExample()</script>"}</style>'
                    . '<script type=application/json>{"html":"<script>jsonExample()</script>"}</script>',
                'bodyHtml' => '<title><script>titleExample()</script></title>'
                    . '<textarea><script>textareaExample()</script></textarea>'
                    . '<script>realExecutable()</script>',
            ]],
        ];

        $pending = $this->verifier->inspectArtifactScripts($artifact);

        $this->assertSame([hash('sha256', 'realExecutable()')], $pending);
        foreach (['commentExample()', 'styleExample()', 'jsonExample()', 'titleExample()', 'textareaExample()'] as $inert) {
            $this->assertArrayNotHasKey(hash('sha256', $inert), $GLOBALS['wpdb']->scriptApprovals);
        }
    }

    /** @param array<string,mixed> $deploymentOverrides @param array<string,mixed> $releaseOverrides @return array<string,mixed> */
    private function wrapper(array $deploymentOverrides = [], array $releaseOverrides = []): array
    {
        $release = array_replace([
            'format' => 'pagecraft.release.v1',
            'releaseId' => 'release-unit',
            'siteId' => 'site-unit',
            'sourceVersion' => 7,
            'schemaVersion' => 13,
            'artifactHash' => str_repeat('a', 64),
            'artifactBytes' => 42,
            'createdAt' => gmdate('c', time() - 30),
        ], $releaseOverrides);
        $releaseBytes = CanonicalJson::encode($release);
        $deployment = array_replace([
            'format' => 'pagecraft.deployment.v1',
            'releaseId' => 'release-unit',
            'releaseManifestHash' => hash('sha256', $releaseBytes),
            'connectionId' => 'connection-unit',
            'installationId' => 'installation-unit',
            'targetOrigin' => 'http://localhost:8088',
            'targetPath' => '/',
            'environment' => 'staging',
            'profile' => 'existing-theme',
            'targetSequence' => 17,
            'requirements' => ['wordpress' => '6.6', 'php' => '8.1', 'plugin' => '0.1.0'],
        ], $deploymentOverrides);
        $deploymentBytes = CanonicalJson::encode($deployment);
        return [
            'release' => [
                'manifest' => Support::base64UrlEncode($releaseBytes),
                'signature' => Support::base64UrlEncode(sodium_crypto_sign_detached(ReleaseVerifier::RELEASE_PREFIX . $releaseBytes, $this->secret)),
                'keyId' => 'release-target-v1',
                'artifact' => ['url' => 'http://localhost:8787/v1/releases/release-unit/artifact', 'expiresAt' => gmdate('c', time() + 300)],
            ],
            'deployment' => [
                'envelope' => Support::base64UrlEncode($deploymentBytes),
                'signature' => Support::base64UrlEncode(sodium_crypto_sign_detached(ReleaseVerifier::DEPLOYMENT_PREFIX . $deploymentBytes, $this->secret)),
                'keyId' => 'release-target-v1',
            ],
        ];
    }
}
