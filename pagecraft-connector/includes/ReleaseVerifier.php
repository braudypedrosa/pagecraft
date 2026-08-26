<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use RuntimeException;

final class ReleaseVerifier
{
    public const RELEASE_PREFIX = "pagecraft-release-v1\0";
    public const DEPLOYMENT_PREFIX = "pagecraft-deployment-v1\0";
    public const WEBHOOK_PREFIX = "pagecraft-webhook-v1\0";

    public function __construct(
        private readonly Connection $connection,
        private readonly ScriptApprovals $scripts
    ) {
    }

    public function available(): bool
    {
        return Support::signatureVerifierAvailable();
    }

    /** @param array<string,mixed> $wrapper @return array<string,mixed>|\WP_Error */
    public function verify(array $wrapper): array|\WP_Error
    {
        try {
            if (isset($wrapper['keysetEnvelope']) && is_array($wrapper['keysetEnvelope'])) {
                $this->connection->installKeysetEnvelope($wrapper['keysetEnvelope']);
            }
            $releasePart = $wrapper['release'] ?? null;
            $deploymentPart = $wrapper['deployment'] ?? null;
            if (!is_array($releasePart) || !is_array($deploymentPart)) {
                throw new RuntimeException('Pagecraft did not provide both signed release and deployment envelopes.');
            }

            $release = $this->verifyPart($releasePart, 'manifest', self::RELEASE_PREFIX, 'release');
            $deployment = $this->verifyPart($deploymentPart, 'envelope', self::DEPLOYMENT_PREFIX, 'deployment');
            $this->validateRelease($release['value']);
            $this->validateDeployment($deployment['value'], $release);

            $normalized = $release['value'];
            $normalized['connectionId'] = (string) $deployment['value']['connectionId'];
            $normalized['installationId'] = (string) $deployment['value']['installationId'];
            $normalized['targetOrigin'] = (string) $deployment['value']['targetOrigin'];
            $normalized['targetPath'] = (string) $deployment['value']['targetPath'];
            $normalized['environment'] = (string) $deployment['value']['environment'];
            $normalized['profile'] = (string) $deployment['value']['profile'];
            $normalized['sequence'] = (int) $deployment['value']['targetSequence'];
            $normalized['deploymentId'] = (string) $release['value']['releaseId'] . ':target:' . (int) $deployment['value']['targetSequence'];
            $normalized['requirements'] = is_array($deployment['value']['requirements'] ?? null) ? $deployment['value']['requirements'] : [];
            $normalized['_manifestHash'] = $release['hash'];
            $normalized['_deploymentHash'] = $deployment['hash'];
            $normalized['_releaseCanonical'] = $release['bytes'];
            $normalized['_deploymentCanonical'] = $deployment['bytes'];
            $normalized['_releaseKeyId'] = $release['key_id'];
            $normalized['_deploymentKeyId'] = $deployment['key_id'];
            $normalized['_artifact'] = is_array($releasePart['artifact'] ?? null) ? $releasePart['artifact'] : [];
            return $normalized;
        } catch (RuntimeException $error) {
            return new \WP_Error('pagecraft_release_invalid', $error->getMessage());
        }
    }

    /**
     * @param array<string,mixed> $artifact
     * @return list<string>|\WP_Error
     */
    public function inspectArtifactScripts(array $artifact): array|\WP_Error
    {
        try {
            $found = [];
            $shared = is_array($artifact['shared'] ?? null) ? $artifact['shared'] : [];
            if ((string) ($shared['runtime'] ?? '') !== '' || (array) ($shared['scripts'] ?? []) !== []) {
                $this->collectDeclaredRuntime(
                    (string) ($shared['runtime'] ?? ''),
                    $shared['scripts'] ?? [],
                    'Shared Pagecraft runtime',
                    'shared',
                    $found,
                    $this->connection->profile() === 'pagecraft-theme'
                );
            }
            foreach ((array) ($artifact['routes'] ?? []) as $route) {
                if (!is_array($route)) {
                    continue;
                }
                $label = 'Route ' . (string) ($route['path'] ?? '/');
                $this->collectDeclaredRuntime((string) ($route['runtime'] ?? ''), $route['scripts'] ?? [], $label, 'route', $found);
                $this->collectInlineScripts((string) ($route['headHtml'] ?? ''), $label, 'head', $found);
                $this->collectInlineScripts((string) ($route['bodyHtml'] ?? ''), $label, 'body', $found);
            }
            $pending = [];
            foreach (array_keys($found) as $fingerprint) {
                if (!$this->scripts->isApproved($fingerprint)) {
                    $pending[] = $fingerprint;
                }
            }
            sort($pending, SORT_STRING);
            return $pending;
        } catch (RuntimeException $error) {
            return new \WP_Error('pagecraft_script_index_invalid', $error->getMessage());
        }
    }

    /** @param list<string> $fingerprints */
    public function allScriptsApproved(array $fingerprints): bool
    {
        foreach ($fingerprints as $fingerprint) {
            if (!$this->scripts->isApproved((string) $fingerprint)) {
                return false;
            }
        }
        return true;
    }

    /** @return array<string,mixed>|\WP_Error */
    public function verifyWebhook(string $payload, string $signatureEncoded, string $keyId): array|\WP_Error
    {
        try {
            CanonicalJson::decode($payload);
            $event = Support::decodeObject($payload);
            $signature = Support::base64UrlDecode($signatureEncoded);
            if (strlen($signature) !== 64 || !$this->verifySignature($signature, self::WEBHOOK_PREFIX . $payload, $this->publicKey($keyId))) {
                throw new RuntimeException('The Pagecraft webhook signature is invalid.');
            }
            if (($event['type'] ?? '') !== 'release.available'
                || !Support::validIdentifier($event['eventId'] ?? null)
                || !Support::validIdentifier($event['releaseId'] ?? null)
                || !hash_equals($this->connection->connectionId(), (string) ($event['connectionId'] ?? ''))
                || !is_int($event['sequence'] ?? null)
                || (int) $event['sequence'] < 1) {
                throw new RuntimeException('The Pagecraft webhook payload is invalid or belongs to another connection.');
            }
            $occurred = strtotime((string) ($event['occurredAt'] ?? ''));
            if (!$occurred || abs(time() - $occurred) > 5 * MINUTE_IN_SECONDS) {
                throw new RuntimeException('The Pagecraft webhook is outside the five-minute replay window.');
            }
            return $event;
        } catch (RuntimeException $error) {
            return new \WP_Error('pagecraft_webhook_invalid', $error->getMessage());
        }
    }

    /** @param array<string,mixed> $part @return array{value:array<string,mixed>,bytes:string,hash:string,key_id:string} */
    private function verifyPart(array $part, string $field, string $prefix, string $label): array
    {
        $bytes = Support::base64UrlDecode((string) ($part[$field] ?? ''));
        CanonicalJson::decode($bytes);
        $value = Support::decodeObject($bytes);
        $signature = Support::base64UrlDecode((string) ($part['signature'] ?? ''));
        $keyId = (string) ($part['keyId'] ?? $part['key_id'] ?? '');
        $publicKey = $this->publicKey($keyId);
        if (strlen($signature) !== 64 || !$this->verifySignature($signature, $prefix . $bytes, $publicKey)) {
            throw new RuntimeException(sprintf('The Pagecraft %s signature is invalid.', $label));
        }
        return ['value' => $value, 'bytes' => $bytes, 'hash' => hash('sha256', $bytes), 'key_id' => $keyId];
    }

    /** @param array<string,mixed> $release */
    private function validateRelease(array $release): void
    {
        if (($release['format'] ?? '') !== 'pagecraft.release.v1') {
            throw new RuntimeException('This Pagecraft release format is not supported.');
        }
        foreach (['releaseId', 'siteId'] as $field) {
            if (!Support::validIdentifier($release[$field] ?? null)) {
                throw new RuntimeException(sprintf('Release field %s is invalid.', $field));
            }
        }
        if (!hash_equals($this->connection->siteId(), (string) $release['siteId'])) {
            throw new RuntimeException('The release belongs to a different Pagecraft site.');
        }
        foreach (['sourceVersion', 'schemaVersion'] as $field) {
            if (!is_int($release[$field] ?? null) || (int) $release[$field] < 1) {
                throw new RuntimeException(sprintf('Release field %s must be a positive integer.', $field));
            }
        }
        if (!preg_match('/^[a-f0-9]{64}$/', strtolower((string) ($release['artifactHash'] ?? '')))) {
            throw new RuntimeException('Release artifactHash is not a SHA-256 hash.');
        }
        $bytes = $release['artifactBytes'] ?? null;
        if (!is_int($bytes) || $bytes < 1 || $bytes > (int) apply_filters('pagecraft_connector_max_artifact_bytes', 100 * MB_IN_BYTES)) {
            throw new RuntimeException('The release artifact size is invalid or exceeds the configured limit.');
        }
        $created = strtotime((string) ($release['createdAt'] ?? ''));
        if (!$created || $created > time() + 300) {
            throw new RuntimeException('The release creation time is invalid.');
        }
    }

    /** @param array<string,mixed> $deployment @param array{value:array<string,mixed>,bytes:string,hash:string,key_id:string} $release */
    private function validateDeployment(array $deployment, array $release): void
    {
        if (($deployment['format'] ?? '') !== 'pagecraft.deployment.v1') {
            throw new RuntimeException('This Pagecraft deployment-envelope format is not supported.');
        }
        foreach (['releaseId', 'connectionId', 'installationId'] as $field) {
            if (!Support::validIdentifier($deployment[$field] ?? null)) {
                throw new RuntimeException(sprintf('Deployment field %s is invalid.', $field));
            }
        }
        if (!hash_equals((string) $release['value']['releaseId'], (string) $deployment['releaseId'])
            || !hash_equals($release['hash'], strtolower((string) ($deployment['releaseManifestHash'] ?? '')))) {
            throw new RuntimeException('The deployment envelope does not authorize this exact release manifest.');
        }
        if (!hash_equals($this->connection->connectionId(), (string) $deployment['connectionId'])
            || !hash_equals($this->connection->installationId(), (string) $deployment['installationId'])) {
            throw new RuntimeException('The deployment envelope belongs to another WordPress installation.');
        }
        if (!is_int($deployment['targetSequence'] ?? null) || (int) $deployment['targetSequence'] < 1) {
            throw new RuntimeException('Deployment targetSequence must be a positive integer.');
        }
        $targetOrigin = Support::normalizeOrigin((string) ($deployment['targetOrigin'] ?? ''));
        if ($targetOrigin === '' || $targetOrigin !== Support::normalizeOrigin(home_url('/'))) {
            throw new RuntimeException('The deployment envelope is bound to a different WordPress origin.');
        }
        if ($this->targetPath((string) ($deployment['targetPath'] ?? '')) !== $this->targetPath()) {
            throw new RuntimeException('The deployment envelope is bound to a different WordPress path.');
        }
        $environment = $this->connection->environment();
        if (!hash_equals($environment, (string) ($deployment['environment'] ?? ''))) {
            throw new RuntimeException('The deployment envelope is bound to another WordPress environment.');
        }
        if (!in_array($deployment['profile'] ?? null, ['existing-theme', 'pagecraft-theme'], true)
            || !hash_equals($this->connection->profile(), (string) $deployment['profile'])) {
            throw new RuntimeException('The deployment envelope is bound to another WordPress rendering profile.');
        }
        $this->validateRequirements(is_array($deployment['requirements'] ?? null) ? $deployment['requirements'] : []);
    }

    /** @param array<string,mixed> $requirements */
    private function validateRequirements(array $requirements): void
    {
        $versions = [
            'plugin' => PAGECRAFT_CONNECTOR_VERSION,
            'wordpress' => (string) get_bloginfo('version'),
            'php' => PHP_VERSION,
        ];
        foreach ($versions as $name => $actual) {
            $minimum = ltrim((string) ($requirements[$name] ?? ''), '> =');
            if ($minimum !== '' && version_compare($actual, $minimum, '<')) {
                throw new RuntimeException(sprintf('This deployment requires %s %s or later.', $name, $minimum));
            }
        }
    }

    private function publicKey(string $keyId): string
    {
        if (!Support::validIdentifier($keyId)) {
            throw new RuntimeException('The release signing key ID is invalid.');
        }
        $now = time();
        foreach ((array) ($this->connection->keyset()['keys'] ?? []) as $key) {
            if (!is_array($key) || !hash_equals($keyId, (string) ($key['id'] ?? ''))) {
                continue;
            }
            $notBefore = strtotime((string) ($key['notBefore'] ?? ''));
            $notAfter = strtotime((string) ($key['notAfter'] ?? ''));
            if (($key['algorithm'] ?? '') !== 'Ed25519' || !$notBefore || !$notAfter || $notBefore > $now || $notAfter <= $now) {
                throw new RuntimeException('The release signing key is not currently valid.');
            }
            $decoded = Support::base64UrlDecode((string) ($key['publicKey'] ?? ''));
            if (strlen($decoded) !== 32) {
                throw new RuntimeException('The release signing public key is invalid.');
            }
            return $decoded;
        }
        throw new RuntimeException('The release was signed by an unknown key.');
    }

    private function verifySignature(string $signature, string $message, string $publicKey): bool
    {
        if (function_exists('sodium_crypto_sign_verify_detached')) {
            return sodium_crypto_sign_verify_detached($signature, $message, $publicKey);
        }
        if (class_exists('ParagonIE_Sodium_Compat')) {
            return \ParagonIE_Sodium_Compat::crypto_sign_verify_detached($signature, $message, $publicKey);
        }
        throw new RuntimeException('No Ed25519 verifier is available.');
    }

    /** @param array<string,true> $found */
    private function collectScriptValue(mixed $value, string $label, array &$found): void
    {
        if ($value === null || $value === '' || $value === []) {
            return;
        }
        if (is_string($value)) {
            $this->registerScript(['code' => $value, 'label' => $label], $found);
            return;
        }
        if (!is_array($value)) {
            throw new RuntimeException('A release script declaration is malformed.');
        }
        if (array_is_list($value)) {
            foreach ($value as $script) {
                $this->collectScriptValue($script, $label, $found);
            }
            return;
        }
        $this->registerScript($value + ['label' => $label], $found);
    }

    /** @param array<string,mixed> $script @param array<string,true> $found */
    private function registerScript(array $script, array &$found): void
    {
        $code = (string) ($script['code'] ?? '');
        $fingerprint = strtolower((string) ($script['fingerprint'] ?? $script['hash'] ?? ''));
        if ($fingerprint === '' && $code !== '') {
            $fingerprint = hash('sha256', $code);
        }
        if (!preg_match('/^[a-f0-9]{64}$/', $fingerprint)
            || ($code !== '' && !Support::hashEquals($fingerprint, hash('sha256', $code)))) {
            throw new RuntimeException('A release script fingerprint is invalid.');
        }
        $script['fingerprint'] = $fingerprint;
        $this->scripts->register($script);
        $found[$fingerprint] = true;
    }

    /** @param array<string,true> $found */
    private function collectDeclaredRuntime(
        string $runtime,
        mixed $declarations,
        string $label,
        string $scope,
        array &$found,
        bool $register = true
    ): void
    {
        $occurrences = ScriptOccurrences::parse($runtime, $declarations, $scope);
        if (is_wp_error($occurrences)) {
            throw new RuntimeException($occurrences->get_error_message());
        }
        foreach ($occurrences as $occurrence) {
            if (!$register) {
                continue;
            }
            $this->registerScript($occurrence + [
                'code' => (string) $occurrence['template_html'],
                'label' => $label . ' ' . (string) $occurrence['region'],
            ], $found);
        }
    }

    /** @param array<string,true> $found */
    private function collectInlineScripts(string $html, string $label, string $placement, array &$found): void
    {
        if ($html === '') {
            return;
        }
        foreach ($this->inlineScriptElements($html) as $element) {
            $semantics = Support::htmlTagSemantics($element['opening'], ['type', 'src']);
            $attributes = $semantics['attributes'];
            $type = strtolower(trim((string) ($attributes['type'] ?? '')));
            $type = trim((string) strtok($type, ';'));
            $hasSource = array_key_exists('src', $attributes);
            if (!$hasSource && in_array($type, ['application/ld+json', 'application/json'], true)) {
                continue;
            }
            $code = trim($element['body']);
            if ($hasSource) {
                $code = 'src:' . (string) $attributes['src'];
            }
            if ($code !== '') {
                $this->registerScript(['code' => $code, 'label' => $label . ' ' . $placement, 'placement' => $placement], $found);
            }
        }
    }

    /**
     * Collect actual SCRIPT elements while honoring comments and raw-text /
     * RCDATA. Tag-shaped examples inside JSON, CSS, title, or textarea data are
     * not executable occurrences.
     *
     * @return list<array{opening:string,body:string}>
     */
    private function inlineScriptElements(string $html): array
    {
        $scripts = [];
        $cursor = 0;
        $length = strlen($html);
        while ($cursor < $length) {
            $opening = strpos($html, '<', $cursor);
            if ($opening === false) {
                break;
            }
            if (substr($html, $opening, 4) === '<!--') {
                $commentEnd = strpos($html, '-->', $opening + 4);
                if ($commentEnd === false) {
                    throw new RuntimeException('Release HTML contains an unterminated comment.');
                }
                $cursor = $commentEnd + 3;
                continue;
            }
            $candidate = substr($html, $opening, 96);
            if (!preg_match('/^<\s*\/?\s*[A-Za-z][A-Za-z0-9:-]*(?=[\s\/>])/', $candidate)
                && !str_starts_with($candidate, '<!')
                && !str_starts_with($candidate, '<?')) {
                $cursor = $opening + 1;
                continue;
            }
            $tagEnd = $this->htmlTagEnd($html, $opening);
            if ($tagEnd === null) {
                throw new RuntimeException('Release HTML contains an unterminated tag.');
            }
            $markup = substr($html, $opening, $tagEnd - $opening + 1);
            if (!preg_match('/^<\s*([A-Za-z][A-Za-z0-9:-]*)(?=[\s\/>])/', $markup, $match)) {
                $cursor = $tagEnd + 1;
                continue;
            }
            $tagName = strtolower((string) $match[1]);
            $cursor = $tagEnd + 1;
            if ($tagName === 'plaintext') {
                break;
            }
            if (!in_array($tagName, ['script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed', 'noframes'], true)) {
                continue;
            }
            $rawBounds = $this->rawTextElementBounds($html, $tagName, $cursor);
            if ($rawBounds === null) {
                throw new RuntimeException(sprintf('Release HTML contains an unterminated %s element.', $tagName));
            }
            if ($tagName === 'script') {
                $scripts[] = [
                    'opening' => $markup,
                    'body' => substr($html, $cursor, $rawBounds['start'] - $cursor),
                ];
            }
            $cursor = $rawBounds['end'];
        }
        return $scripts;
    }

    /** @return array{start:int,end:int}|null */
    private function rawTextElementBounds(string $html, string $tagName, int $offset): ?array
    {
        if (!preg_match(
            '#</\s*' . preg_quote($tagName, '#') . '(?=[\s/>])#i',
            $html,
            $match,
            PREG_OFFSET_CAPTURE,
            $offset
        )) {
            return null;
        }
        $closing = (int) $match[0][1];
        $tagEnd = $this->htmlTagEnd($html, $closing);
        return $tagEnd === null ? null : ['start' => $closing, 'end' => $tagEnd + 1];
    }

    private function htmlTagEnd(string $html, int $opening): ?int
    {
        $quote = '';
        $length = strlen($html);
        for ($index = $opening + 1; $index < $length; $index++) {
            $character = $html[$index];
            if ($quote !== '') {
                if ($character === $quote) {
                    $quote = '';
                }
                continue;
            }
            if ($character === '"' || $character === "'") {
                $quote = $character;
                continue;
            }
            if ($character === '>') {
                return $index;
            }
        }
        return null;
    }

    private function targetPath(?string $value = null): string
    {
        if ($value === null) {
            $value = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
        }
        $value = '/' . trim($value, '/');
        return $value === '/' ? '/' : $value . '/';
    }
}
