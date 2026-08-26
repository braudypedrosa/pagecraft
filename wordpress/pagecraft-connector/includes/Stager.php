<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use ZipArchive;

final class Stager
{
    /** Exact Core-owned animation blocks accepted on an Existing Theme target. */
    private const GENERATED_KEYFRAME_HASHES = [
        'bpfadein' => 'e217ab2206f9495816a809c952746543e0c72318c30e7918a895a83720b1cea3',
        'bpslideleft' => 'a82b10b78f5d943bcd644666e82a93e1cacc6d21f23e320cd64de3228aabc30b',
        'bpslideright' => '0be3a239b6b1fa03d524b8c44a290270b25b5cecb96a6f01f8228c2fe97c2c82',
        'bpscaleup' => '9a7f6841faecb6dc0f9ec648def060042a8bb1b2807ef6cdb69a90421101b6f3',
        'bpfadeup' => '775d66be0664f93291f46e05a1369bf109f11b32426397b45d163ef0695f2f72',
        'bpfadedown' => '4a9b652214e96b09f5c8bcd91fcab3aa69617305c344e1530c4286856feab675',
        'bpcard' => 'a61f97749a6e884d2bbe984494d131153bdf8cbe74cb00863c68815ab3eab1f6',
        'bpdonedemo' => '12d555daf1f963f19dd80a666cb273cc646d102f9c2b058475357e9fbf04e604',
        'bpfadeout' => '346f44ae4886d049b245c15a9c3b95d894a4bf983fd1f8a379a20904c9b687e0',
        'bpslideup' => '554518c4e89af046cf0ae10b3589896615fb39f666256569bef0d7ff794866b0',
        'bpslidedown' => '14eec0e4aa388e77cbe407f055fc1e9bd082272b4c955800600bcebe0c9bb240',
        'bpscaledown' => 'd7afbbcc4ad535da5cc949d810bddc211669c292b13ae8c7d0ed358961897be4',
        'bpzoomin' => 'a9448d1b0dff62c61a0c6b0d7c4e5c7687294315a3420a7d0c23f39f3c977703',
        'bpzoomout' => 'f6141fcf3f0ac5f7218e6936939f781e562e61fd1777879da9b420a683020a5b',
        'bprotatein' => '8e90ff96727d17f72be258317bfde16168bd413ec023c3bd1c68a91dd8eec226',
        'bprotateinleft' => '7a8891cac03817bbc9644052be6a9cc1cd0e06944ef9bbfba9fd9a28c4022aa8',
        'bprotateinright' => 'dfc1c2322ed28c7a298a3b06d9f4386f4697608cdbd1bde11991473100c66df5',
        'bpbounce' => 'a0ef6b13845ae219f7c5770d1b6d3fb18a420209f31fda9e4eed0c325692b067',
        'bpbouncein' => 'ff8cc9b9911877eecbcfd674911dbf852221f0efc60102162c953651347f8f12',
        'bpbounceup' => '8d5f3af3d2d8632184628b12d23595ef6b83a42e66e926c730166b4a54f1d74e',
        'bpbouncedown' => '4791b2d90918e899192ec7c9ed42fa7fe5c5518c97e0e4e27b958c7c124ddb9b',
        'bpflipx' => 'add0ee9134dc46cb437d9f8f5ba1e496d09e7a00e066b66b023338904efbb6c9',
        'bpflipy' => '35b8c194a365973535073951ad214c90f2ffa2121efb2671419bb91d74298bf4',
        'bpspin' => 'baf4f0191782f37746e58d8855e9faa22badf285d9a5d624de9be7bc1cff93d0',
        'bpelastic' => 'd02194049043dada2fe1fa3f260e102e9b30f3f68fe4c01b18ef2ba421dc99a7',
        'bpslidefadeup' => 'c710d88a17bc0a5277701b05b160209a53706b3e4b9213a3d944d8e6259adfb6',
        'bpslidefadedown' => 'b136d9f9233d6ef5e167a27a8e2f2124a9760b881f2c02befa1f83713cd18564',
        'bpslidefadeleft' => 'aa0a2fca7afd5bffa675fdc6fd330498adf6776c5f5ae43cf73de9bd62e16035',
        'bpslidefaderight' => '2e04a162ac939da95377a2ea8f258a3ad9d9acb23dee7b1f5c29db379fe8857a',
    ];

    /**
     * Decode the canonical JSON WordPress artifact and stage its binary assets.
     *
     * @param array<string,mixed> $manifest Verified project release plus target envelope.
     * @return array{directory:string,files:array<string,string>,artifact:array<string,mixed>}|\WP_Error
     */
    public function stageCanonicalArtifact(string $artifactFile, array $manifest): array|\WP_Error
    {
        if (!is_readable($artifactFile)) {
            return new \WP_Error('pagecraft_artifact_missing', 'The Pagecraft artifact is not readable.');
        }
        $bytes = file_get_contents($artifactFile);
        if (!is_string($bytes)
            || strlen($bytes) !== (int) $manifest['artifactBytes']
            || !Support::hashEquals((string) $manifest['artifactHash'], hash('sha256', $bytes))) {
            return new \WP_Error('pagecraft_artifact_hash', 'The artifact does not match the signed release manifest.');
        }
        try {
            CanonicalJson::decode($bytes);
            $artifact = Support::decodeObject($bytes);
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_artifact_json', $error->getMessage());
        }
        if (($artifact['format'] ?? '') !== 'pagecraft.wordpress-artifact.v1'
            || !hash_equals((string) $manifest['releaseId'], (string) ($artifact['releaseId'] ?? ''))
            || !hash_equals((string) $manifest['siteId'], (string) ($artifact['siteId'] ?? ''))
            || (int) ($artifact['sourceVersion'] ?? 0) !== (int) $manifest['sourceVersion']
            || (int) ($artifact['schemaVersion'] ?? 0) !== (int) $manifest['schemaVersion']) {
            return new \WP_Error('pagecraft_artifact_identity', 'The artifact identity does not match its signed release manifest.');
        }
        foreach (['rendererVersion', 'redirects', 'entities', 'forms'] as $field) {
            if (!array_key_exists($field, $artifact) || !array_key_exists($field, $manifest)
                || hash('sha256', CanonicalJson::encode(json_decode(Support::json($artifact[$field]))))
                    !== hash('sha256', CanonicalJson::encode(json_decode(Support::json($manifest[$field]))))) {
                return new \WP_Error('pagecraft_artifact_manifest_mismatch', sprintf('Artifact field %s does not match the signed release manifest.', $field));
            }
        }
        $cmsProjection = $this->validateCmsManifestProjection($artifact['cms'] ?? null, $manifest['cms'] ?? null);
        if (is_wp_error($cmsProjection)) {
            return $cmsProjection;
        }
        $manifestForms = Forms::validateDefinitions($manifest['forms'] ?? null);
        if (is_wp_error($manifestForms)) {
            return $manifestForms;
        }
        $artifactForms = Forms::validateDefinitions($artifact['forms'] ?? null);
        if (is_wp_error($artifactForms)) {
            return $artifactForms;
        }
        $entityForms = is_array($artifact['entities'] ?? null) ? ($artifact['entities']['forms'] ?? null) : null;
        if (!is_array($entityForms)
            || hash('sha256', CanonicalJson::encode(json_decode(Support::json($artifact['forms']))))
                !== hash('sha256', CanonicalJson::encode(json_decode(Support::json($entityForms))))) {
            return new \WP_Error('pagecraft_artifact_forms_mismatch', 'Artifact forms must exactly match the signed native form entity list.');
        }
        $cmsIdentities = $this->validateCmsIdentities($artifact['cms'] ?? null);
        if (is_wp_error($cmsIdentities)) {
            return $cmsIdentities;
        }
        $formContracts = $this->validateFormPlaceholderProjection(
            $artifactForms,
            (array) ($manifest['placeholders'] ?? [])
        );
        if (is_wp_error($formContracts)) {
            return $formContracts;
        }
        $wordpressContentLinks = $this->validateWordPressContentPlaceholderProjection(
            $artifact,
            (array) ($manifest['placeholders'] ?? [])
        );
        if (is_wp_error($wordpressContentLinks)) {
            return $wordpressContentLinks;
        }
        if (isset($artifact['doc']) || isset($artifact['editorDoc']) || isset($artifact['project'])) {
            return new \WP_Error('pagecraft_artifact_editor_doc', 'A WordPress artifact must not contain the editable Pagecraft document.');
        }
        if (!is_array($artifact['routes'] ?? null) || count($artifact['routes']) > (int) apply_filters('pagecraft_connector_max_routes', 5000)) {
            return new \WP_Error('pagecraft_artifact_routes', 'The artifact route map is invalid or too large.');
        }
        $shared = $artifact['shared'] ?? null;
        if (!is_array($shared)
            || !is_string($shared['headerHtml'] ?? null)
            || !is_string($shared['footerHtml'] ?? null)
            || !is_string($shared['css'] ?? null)
            || !is_string($shared['runtime'] ?? null)
            || !is_array($shared['scripts'] ?? null)) {
            return new \WP_Error('pagecraft_artifact_shared', 'The artifact shared shell is invalid.');
        }
        $sharedOccurrences = ScriptOccurrences::parse(
            (string) $shared['runtime'],
            $shared['scripts'],
            'shared'
        );
        if (is_wp_error($sharedOccurrences)) {
            return $sharedOccurrences;
        }
        $manifestScriptExpectations = [];
        $manifestScripts = $this->appendManifestScriptExpectations(
            $manifestScriptExpectations,
            $sharedOccurrences,
            (string) $manifest['siteId'],
            'project'
        );
        if (is_wp_error($manifestScripts)) {
            return $manifestScripts;
        }
        $runtimePlaceholderExpectations = [];
        $runtimeExpectation = $this->appendRuntimePlaceholderExpectations(
            $runtimePlaceholderExpectations,
            $sharedOccurrences,
            '*',
            ['shared-header', 'shared-footer']
        );
        if (is_wp_error($runtimeExpectation)) {
            return $runtimeExpectation;
        }
        foreach (['headerHtml' => 'shared-header', 'footerHtml' => 'shared-footer'] as $field => $region) {
            $markers = ScriptOccurrences::validateMarkers((string) $shared[$field], $sharedOccurrences, $region);
            if (is_wp_error($markers)) {
                return $markers;
            }
        }
        $sharedUnsafe = $this->unsafeRoute([
            'path' => '/',
            'headHtml' => '',
            'bodyHtml' => (string) $shared['headerHtml'] . (string) $shared['footerHtml'],
            'css' => (string) $shared['css'],
        ], (array) ($manifest['placeholders'] ?? []), (string) ($manifest['profile'] ?? '') === 'existing-theme', true);
        if (is_wp_error($sharedUnsafe)) {
            return $sharedUnsafe;
        }
        foreach ($artifact['routes'] as $route) {
            if (!is_array($route)
                || !Support::validIdentifier($route['pageId'] ?? null)
                || strlen(Support::normalizeRoute((string) ($route['path'] ?? '/'))) > 191
                || !is_string($route['bodyHtml'] ?? null)
                || !is_string($route['css'] ?? null)
                || !is_string($route['runtime'] ?? null)
                || !is_array($route['scripts'] ?? null)
                || ($route['bodyKind'] ?? '') !== 'content-fragment'
                || str_contains((string) $route['bodyHtml'], 'pagecraft-root')) {
                return new \WP_Error('pagecraft_artifact_route', 'The artifact contains an invalid route.');
            }
            if (($route['headOrder'] ?? '') !== 'css-before-runtime') {
                return new \WP_Error('pagecraft_artifact_head_order', 'The artifact route does not declare the supported CSS-before-runtime head order.');
            }
            $unsafe = $this->unsafeRoute(
                $route,
                (array) ($manifest['placeholders'] ?? []),
                (string) ($manifest['profile'] ?? '') === 'existing-theme'
            );
            if (is_wp_error($unsafe)) {
                return $unsafe;
            }
            $routeOccurrences = ScriptOccurrences::parse(
                (string) $route['runtime'],
                $route['scripts'],
                'route'
            );
            if (is_wp_error($routeOccurrences)) {
                return $routeOccurrences;
            }
            $manifestScripts = $this->appendManifestScriptExpectations(
                $manifestScriptExpectations,
                $routeOccurrences,
                (string) $route['pageId'],
                'page'
            );
            if (is_wp_error($manifestScripts)) {
                return $manifestScripts;
            }
            $runtimeExpectation = $this->appendRuntimePlaceholderExpectations(
                $runtimePlaceholderExpectations,
                $routeOccurrences,
                Support::normalizeRoute((string) $route['path']),
                ['route-head', 'route-body']
            );
            if (is_wp_error($runtimeExpectation)) {
                return $runtimeExpectation;
            }
            foreach (['headHtml' => 'route-head', 'bodyHtml' => 'route-body'] as $field => $region) {
                $markers = ScriptOccurrences::validateMarkers((string) $route[$field], $routeOccurrences, $region);
                if (is_wp_error($markers)) {
                    return $markers;
                }
            }
        }
        $formCoverage = $this->validateFormRouteCoverage(
            $artifact['routes'],
            $shared,
            $formContracts,
            (string) ($manifest['profile'] ?? '') === 'existing-theme'
        );
        if (is_wp_error($formCoverage)) {
            return $formCoverage;
        }
        $runtimePlaceholders = $this->validateRuntimePlaceholders(
            (array) ($manifest['placeholders'] ?? []),
            $runtimePlaceholderExpectations
        );
        if (is_wp_error($runtimePlaceholders)) {
            return $runtimePlaceholders;
        }
        $manifestScripts = $this->validateManifestScripts($manifest['scripts'] ?? null, $manifestScriptExpectations);
        if (is_wp_error($manifestScripts)) {
            return $manifestScripts;
        }
        $redirects = $artifact['redirects'] ?? null;
        if (!is_array($redirects) || count($redirects) > 10000) {
            return new \WP_Error('pagecraft_artifact_redirects', 'The artifact redirect map is invalid or too large.');
        }
        foreach ($redirects as $redirect) {
            $fromParts = is_array($redirect) ? wp_parse_url((string) ($redirect['from'] ?? '')) : false;
            $toParts = is_array($redirect) ? wp_parse_url((string) ($redirect['to'] ?? '')) : false;
            if (!is_array($redirect)
                || !is_string($redirect['from'] ?? null)
                || !is_string($redirect['to'] ?? null)
                || !in_array($redirect['status'] ?? null, [301, 302, 307, 308], true)
                || !is_array($fromParts) || isset($fromParts['scheme']) || isset($fromParts['host']) || isset($fromParts['query']) || isset($fromParts['fragment'])
                || !is_array($toParts) || isset($toParts['scheme']) || isset($toParts['host']) || isset($toParts['query']) || isset($toParts['fragment'])
                || strlen(Support::normalizeRoute((string) $redirect['from'])) > 191
                || strlen(Support::normalizeRoute((string) $redirect['to'])) > 191
                || Support::normalizeRoute((string) $redirect['from']) === Support::normalizeRoute((string) $redirect['to'])) {
                return new \WP_Error('pagecraft_artifact_redirect', 'The artifact contains an unsafe redirect.');
            }
        }

        $uploads = wp_upload_dir();
        if (!empty($uploads['error'])) {
            return new \WP_Error('pagecraft_upload_dir', (string) $uploads['error']);
        }
        $releaseId = sanitize_file_name((string) $manifest['releaseId']);
        $directory = trailingslashit((string) $uploads['basedir']) . 'pagecraft/staging/' . $releaseId . '-' . wp_generate_password(10, false, false);
        if (!wp_mkdir_p($directory)) {
            return new \WP_Error('pagecraft_staging_directory', 'WordPress could not create the release staging directory.');
        }

        $files = [];
        $assets = $artifact['assets'] ?? [];
        if (!is_array($assets) || count($assets) > (int) apply_filters('pagecraft_connector_max_assets', 5000)) {
            $this->removeDirectory($directory);
            return new \WP_Error('pagecraft_artifact_assets', 'The artifact asset map is invalid or too large.');
        }
        $decodedTotal = 0;
        foreach ($assets as $index => $asset) {
            if (!is_array($asset)) {
                $this->removeDirectory($directory);
                return new \WP_Error('pagecraft_artifact_asset', 'The artifact contains an invalid asset.');
            }
            $assetId = (string) ($asset['assetId'] ?? '');
            $hash = strtolower((string) ($asset['hash'] ?? ''));
            $declaredBytes = $asset['bytes'] ?? null;
            try {
                $content = Support::base64UrlDecode((string) ($asset['content'] ?? ''));
            } catch (\RuntimeException $error) {
                $this->removeDirectory($directory);
                return new \WP_Error('pagecraft_asset_encoding', $error->getMessage());
            }
            if (!Support::validIdentifier($assetId)
                || !preg_match('/^[a-f0-9]{64}$/', $hash)
                || !is_int($declaredBytes)
                || strlen($content) !== $declaredBytes
                || !Support::hashEquals($hash, hash('sha256', $content))) {
                $this->removeDirectory($directory);
                return new \WP_Error('pagecraft_asset_integrity', 'An artifact asset failed integrity validation.');
            }
            $decodedTotal += strlen($content);
            if ($decodedTotal > (int) apply_filters('pagecraft_connector_max_asset_bytes', 250 * MB_IN_BYTES)) {
                $this->removeDirectory($directory);
                return new \WP_Error('pagecraft_asset_size', 'The artifact contains too much decoded asset data.');
            }
            $filename = sanitize_file_name((string) ($asset['filename'] ?? $assetId));
            if ($filename === '') {
                $this->removeDirectory($directory);
                return new \WP_Error('pagecraft_asset_filename', 'An artifact asset has no safe filename.');
            }
            $component = $this->stagedAssetFilename($assetId, $hash, $filename);
            if (is_wp_error($component)) {
                $this->removeDirectory($directory);
                return $component;
            }
            $relative = 'assets/' . $component;
            $absolute = $directory . '/' . $relative;
            if (!wp_mkdir_p(dirname($absolute)) || file_put_contents($absolute, $content, LOCK_EX) !== strlen($content)) {
                $this->removeDirectory($directory);
                return new \WP_Error('pagecraft_asset_stage', 'WordPress could not stage an artifact asset.');
            }
            $files[$relative] = $absolute;
            $asset['file'] = $relative;
            $asset['sha256'] = $hash;
            unset($asset['content']);
            $assets[$index] = $asset;
        }
        $artifact['assets'] = $assets;
        $assetReferences = $this->validateAssetReferences($artifact);
        if (is_wp_error($assetReferences)) {
            $this->removeDirectory($directory);
            return $assetReferences;
        }
        $artifact = $this->materializeWordPressContentLinks($artifact, $wordpressContentLinks);
        if (is_wp_error($artifact)) {
            $this->removeDirectory($directory);
            return $artifact;
        }
        return ['directory' => $directory, 'files' => $files, 'artifact' => $artifact];
    }

    /**
     * Cross-check every typed native-content occurrence with its signed declaration,
     * then resolve that declaration against this WordPress installation. The returned
     * map is target-local staging state; neither it nor the local origin changes the
     * verified artifact bytes or release digest.
     *
     * @param array<string,mixed> $artifact
     * @param list<mixed> $placeholders
     * @return array<string,string>|\WP_Error exact token to local permalink
     */
    private function validateWordPressContentPlaceholderProjection(
        array $artifact,
        array $placeholders
    ): array|\WP_Error {
        $declared = [];
        $byToken = [];
        foreach ($placeholders as $placeholder) {
            if (!is_array($placeholder) || ($placeholder['kind'] ?? '') !== 'wordpress-content') {
                continue;
            }
            $routePath = $placeholder['routePath'] ?? null;
            $objectType = $placeholder['objectType'] ?? null;
            $path = $placeholder['path'] ?? null;
            $token = $placeholder['token'] ?? null;
            $routeParts = is_string($routePath) && $routePath !== '*'
                ? wp_parse_url($routePath)
                : null;
            $validRoute = $routePath === '*' || (is_string($routePath)
                && is_array($routeParts)
                && str_starts_with($routePath, '/')
                && strlen($routePath) <= 191
                && !isset($routeParts['scheme'])
                && !isset($routeParts['host'])
                && !isset($routeParts['query'])
                && !isset($routeParts['fragment']));
            $validPath = is_string($path)
                && str_starts_with($path, '/')
                && strlen($path) <= 2048
                && !preg_match('/[?#\\\\\x00-\x1f\x7f]/', $path)
                && Support::normalizeRoute($path) === $path;
            $expectedToken = $validPath && is_string($objectType)
                ? '%%PAGECRAFT_WP_CONTENT:' . $objectType . ':' . Support::base64UrlEncode($path) . '%%'
                : '';
            if (!$validRoute
                || !in_array($objectType, ['page', 'post'], true)
                || !$validPath
                || !is_string($token)
                || !hash_equals($expectedToken, $token)) {
                return new \WP_Error(
                    'pagecraft_wordpress_content_placeholder',
                    'A signed WordPress content placeholder has an invalid route, type, path, or token.'
                );
            }
            $routeKey = $routePath === '*' ? '*' : Support::normalizeRoute((string) $routePath);
            $key = $routeKey . "\0" . $token;
            if (isset($declared[$key])) {
                return new \WP_Error(
                    'pagecraft_wordpress_content_placeholder',
                    'The signed release contains a duplicate route-scoped WordPress content placeholder.'
                );
            }
            if (isset($byToken[$token])
                && ($byToken[$token]['objectType'] !== $objectType || $byToken[$token]['path'] !== $path)) {
                return new \WP_Error(
                    'pagecraft_wordpress_content_placeholder',
                    'One WordPress content token cannot declare conflicting native destinations.'
                );
            }
            $declared[$key] = true;
            $byToken[$token] = ['objectType' => $objectType, 'path' => $path];
        }

        $actual = [];
        foreach ((array) ($artifact['routes'] ?? []) as $route) {
            if (!is_array($route)) {
                continue;
            }
            $routePath = Support::normalizeRoute((string) ($route['path'] ?? '/'));
            $tokens = $this->wordpressContentTokens(implode("\n", [
                (string) ($route['headHtml'] ?? ''),
                (string) ($route['bodyHtml'] ?? ''),
                (string) ($route['contentHtml'] ?? ''),
            ]));
            if (is_wp_error($tokens)) {
                return $tokens;
            }
            foreach ($tokens as $token) {
                $actual[$routePath . "\0" . $token] = true;
            }
        }
        $shared = is_array($artifact['shared'] ?? null) ? $artifact['shared'] : [];
        $sharedTokens = $this->wordpressContentTokens(
            (string) ($shared['headerHtml'] ?? '') . "\n" . (string) ($shared['footerHtml'] ?? '')
        );
        if (is_wp_error($sharedTokens)) {
            return $sharedTokens;
        }
        foreach ($sharedTokens as $token) {
            $actual['*' . "\0" . $token] = true;
        }
        ksort($declared, SORT_STRING);
        ksort($actual, SORT_STRING);
        if (array_keys($declared) !== array_keys($actual)) {
            return new \WP_Error(
                'pagecraft_wordpress_content_placeholder',
                'Every rendered WordPress content token must have exactly one matching signed route-scoped declaration.'
            );
        }

        $resolved = [];
        foreach ($byToken as $token => $definition) {
            $url = $this->resolveWordPressContentLink(
                (string) $definition['objectType'],
                (string) $definition['path']
            );
            if (is_wp_error($url)) {
                return $url;
            }
            $resolved[$token] = $url;
        }
        return $resolved;
    }

    /** @return list<string>|\WP_Error */
    private function wordpressContentTokens(string $html): array|\WP_Error
    {
        preg_match_all(
            '/%%PAGECRAFT_WP_CONTENT:(?:page|post):[A-Za-z0-9_-]+%%/',
            $html,
            $allMatches
        );
        $all = array_map('strval', (array) ($allMatches[0] ?? []));
        $withoutValid = (string) preg_replace(
            '/%%PAGECRAFT_WP_CONTENT:(?:page|post):[A-Za-z0-9_-]+%%/',
            '',
            $html
        );
        if (str_contains($withoutValid, '%%PAGECRAFT_WP_CONTENT')) {
            return new \WP_Error(
                'pagecraft_wordpress_content_placeholder',
                'The artifact contains a malformed WordPress content placeholder.'
            );
        }
        $anchors = [];
        $scan = $this->scanHtmlTags($html);
        if ($scan['incomplete']) {
            return new \WP_Error('pagecraft_wordpress_content_placeholder', 'The artifact contains incomplete HTML.');
        }
        foreach ($scan['tags'] as $markup) {
            $semantics = Support::htmlTagSemantics($markup, ['href']);
            if (strtolower((string) ($semantics['tag'] ?? '')) !== 'a') {
                continue;
            }
            $href = trim((string) ($semantics['attributes']['href'] ?? ''));
            if (str_contains($href, 'PAGECRAFT_WP_CONTENT')) {
                $anchors[] = $href;
            }
        }
        sort($all, SORT_STRING);
        sort($anchors, SORT_STRING);
        if ($all !== $anchors) {
            return new \WP_Error(
                'pagecraft_wordpress_content_placeholder',
                'A WordPress content placeholder is not the exact href of an anchor.'
            );
        }
        return array_values(array_unique($all));
    }

    /** @return string|\WP_Error */
    private function resolveWordPressContentLink(string $objectType, string $path): string|\WP_Error
    {
        $candidate = home_url('/' . ltrim($path, '/'));
        $postId = url_to_postid($candidate);
        $post = $postId > 0 ? get_post($postId) : null;
        if (!$post instanceof \WP_Post
            || $post->post_status !== 'publish'
            || $post->post_type !== $objectType
            || get_post_meta($postId, '_pagecraft_managed', true) === '1') {
            return new \WP_Error(
                'pagecraft_wordpress_content_missing',
                sprintf('The local published WordPress %s at %s is missing or has a different content type.', $objectType, $path)
            );
        }
        $permalink = get_permalink($post);
        if (!is_string($permalink)
            || $this->wordpressRelativeRoute($permalink) !== $path) {
            return new \WP_Error(
                'pagecraft_wordpress_content_mismatch',
                sprintf('The local WordPress permalink for %s does not match the signed route %s.', $objectType, $path)
            );
        }
        return $permalink;
    }

    private function wordpressRelativeRoute(string $url): string
    {
        $parts = wp_parse_url($url);
        $homeParts = wp_parse_url(home_url('/'));
        if (!is_array($parts)
            || !is_array($homeParts)
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['query'])
            || isset($parts['fragment'])
            || !hash_equals(Support::normalizeOrigin(home_url('/')), Support::normalizeOrigin($url))) {
            return '';
        }
        $path = '/' . ltrim((string) ($parts['path'] ?? '/'), '/');
        $homePath = '/' . trim((string) ($homeParts['path'] ?? '/'), '/');
        if ($homePath !== '/') {
            if ($path === $homePath || $path === $homePath . '/') {
                $path = '/';
            } elseif (str_starts_with($path, $homePath . '/')) {
                $path = substr($path, strlen($homePath));
            } else {
                return '';
            }
        }
        return Support::normalizeRoute($path);
    }

    /** @param array<string,mixed> $artifact @param array<string,string> $links @return array<string,mixed>|\WP_Error */
    private function materializeWordPressContentLinks(array $artifact, array $links): array|\WP_Error
    {
        $replace = static function (string $value) use ($links): string {
            return str_replace(array_keys($links), array_values($links), $value);
        };
        foreach ((array) ($artifact['routes'] ?? []) as $index => $route) {
            if (!is_array($route)) {
                continue;
            }
            foreach (['headHtml', 'bodyHtml', 'contentHtml'] as $field) {
                if (is_string($route[$field] ?? null)) {
                    $route[$field] = $replace((string) $route[$field]);
                }
            }
            $artifact['routes'][$index] = $route;
        }
        if (is_array($artifact['shared'] ?? null)) {
            foreach (['headerHtml', 'footerHtml'] as $field) {
                if (is_string($artifact['shared'][$field] ?? null)) {
                    $artifact['shared'][$field] = $replace((string) $artifact['shared'][$field]);
                }
            }
        }
        if (str_contains(Support::json($artifact), '%%PAGECRAFT_WP_CONTENT')) {
            return new \WP_Error(
                'pagecraft_wordpress_content_materialize',
                'A verified WordPress content placeholder could not be materialized locally.'
            );
        }
        return $artifact;
    }

    /**
     * Form definitions and signed endpoint placeholders are two projections of
     * one route-scoped contract. Compare the full pair set so an extra, missing
     * or route-drifted placeholder cannot authorize a different public form.
     *
     * @param list<array<string,mixed>> $definitions
     * @param list<mixed> $placeholders
     * @return array<string,true>|\WP_Error
     */
    private function validateFormPlaceholderProjection(array $definitions, array $placeholders): array|\WP_Error
    {
        $definitionPairs = [];
        foreach ($definitions as $definition) {
            $id = (string) ($definition['id'] ?? $definition['formId'] ?? '');
            $route = Support::normalizeRoute((string) ($definition['routePath'] ?? '/'));
            $definitionPairs[$route . "\0" . $id] = true;
        }

        $placeholderPairs = [];
        foreach ($placeholders as $placeholder) {
            if (!is_array($placeholder) || ($placeholder['kind'] ?? '') !== 'form') {
                continue;
            }
            $id = (string) ($placeholder['id'] ?? $placeholder['key'] ?? '');
            $routeRaw = $placeholder['routePath'] ?? null;
            $token = $placeholder['token'] ?? null;
            $routeParts = is_string($routeRaw) ? wp_parse_url($routeRaw) : false;
            if (!Support::validIdentifier($id)
                || !is_string($routeRaw)
                || !str_starts_with($routeRaw, '/')
                || strlen($routeRaw) > 191
                || !is_array($routeParts)
                || isset($routeParts['scheme'])
                || isset($routeParts['host'])
                || isset($routeParts['query'])
                || isset($routeParts['fragment'])
                || !is_string($token)
                || !hash_equals('%%PAGECRAFT_FORM_ENDPOINT:' . $id . '%%', $token)) {
                return new \WP_Error('pagecraft_artifact_form_placeholder', 'A signed WordPress form placeholder is invalid or does not match its form ID.');
            }
            $key = Support::normalizeRoute($routeRaw) . "\0" . $id;
            if (isset($placeholderPairs[$key])) {
                return new \WP_Error('pagecraft_artifact_form_placeholder', 'The signed release contains a duplicate route-scoped form placeholder.');
            }
            $placeholderPairs[$key] = true;
        }

        ksort($definitionPairs, SORT_STRING);
        ksort($placeholderPairs, SORT_STRING);
        if (array_keys($definitionPairs) !== array_keys($placeholderPairs)) {
            return new \WP_Error('pagecraft_artifact_form_placeholder', 'Every signed WordPress form definition must have exactly one matching route-scoped endpoint placeholder.');
        }
        return $definitionPairs;
    }

    /**
     * @param list<mixed> $routes
     * @param array<string,mixed> $shared
     * @param array<string,true> $contracts
     * @return true|\WP_Error
     */
    private function validateFormRouteCoverage(
        array $routes,
        array $shared,
        array $contracts,
        bool $existingTheme
    ): bool|\WP_Error {
        $sharedIds = $existingTheme
            ? []
            : $this->formTokenIds((string) ($shared['headerHtml'] ?? '') . "\n" . (string) ($shared['footerHtml'] ?? ''));
        foreach ($routes as $route) {
            if (!is_array($route)) {
                continue;
            }
            $routePath = Support::normalizeRoute((string) ($route['path'] ?? '/'));
            $routeIds = $this->formTokenIds(implode("\n", [
                (string) ($route['headHtml'] ?? ''),
                (string) ($route['bodyHtml'] ?? ''),
                (string) ($route['contentHtml'] ?? ''),
            ]));
            foreach (array_values(array_unique(array_merge($routeIds, $sharedIds))) as $id) {
                if (!isset($contracts[$routePath . "\0" . $id])) {
                    return new \WP_Error(
                        $sharedIds !== [] && in_array($id, $sharedIds, true)
                            ? 'pagecraft_artifact_shared_form_placeholder'
                            : 'pagecraft_artifact_form_placeholder',
                        'Every rendered WordPress form endpoint token must have an exact signed definition and placeholder for that route.'
                    );
                }
            }
        }
        return true;
    }

    /** @return list<string> */
    private function formTokenIds(string $html): array
    {
        if (!preg_match_all('/%%PAGECRAFT_FORM_ENDPOINT:([A-Za-z0-9._:-]+)%%/', $html, $matches)) {
            return [];
        }
        return array_values(array_unique(array_map('strval', $matches[1])));
    }

    /**
     * @param array<string,array{routePath:string,id:string,token:string}> $expected
     * @param list<array<string,mixed>> $occurrences
     * @param list<string> $regions
     * @return true|\WP_Error
     */
    private function appendRuntimePlaceholderExpectations(
        array &$expected,
        array $occurrences,
        string $routePath,
        array $regions
    ): bool|\WP_Error {
        foreach ($occurrences as $occurrence) {
            if (!is_array($occurrence) || !in_array((string) ($occurrence['region'] ?? ''), $regions, true)) {
                continue;
            }
            $id = (string) ($occurrence['occurrenceId'] ?? '');
            foreach ($expected as $existing) {
                if (hash_equals($id, $existing['id'])) {
                    return new \WP_Error('pagecraft_runtime_placeholder', 'Runtime occurrence IDs must be globally unique across the signed artifact.');
                }
            }
            $key = $routePath . "\0" . $id;
            if (isset($expected[$key])) {
                return new \WP_Error('pagecraft_runtime_placeholder', 'Runtime occurrence placeholders must be unique across the signed artifact.');
            }
            $expected[$key] = [
                'routePath' => $routePath,
                'id' => $id,
                'token' => (string) ($occurrence['token'] ?? ''),
            ];
        }
        return true;
    }

    /**
     * @param array<string,array<string,mixed>> $expected
     * @param list<array<string,mixed>> $occurrences
     * @return true|\WP_Error
     */
    private function appendManifestScriptExpectations(
        array &$expected,
        array $occurrences,
        string $ownerId,
        string $authoredSource
    ): bool|\WP_Error {
        foreach ($occurrences as $occurrence) {
            $id = is_array($occurrence) ? (string) ($occurrence['occurrenceId'] ?? '') : '';
            if ($id === '' || isset($expected[$id])) {
                return new \WP_Error('pagecraft_runtime_manifest', 'Artifact executable occurrence IDs must be globally unique.');
            }
            $kind = (string) ($occurrence['kind'] ?? '');
            $expected[$id] = [
                'source' => $kind === 'generated' ? 'generated' : $authoredSource,
                'ownerId' => $ownerId,
                'occurrenceId' => $id,
                'region' => (string) ($occurrence['region'] ?? ''),
                'order' => $occurrence['order'] ?? null,
                'placement' => (string) ($occurrence['placement'] ?? ''),
                'token' => (string) ($occurrence['token'] ?? ''),
                'hash' => (string) ($occurrence['hash'] ?? ''),
                'kind' => $kind,
            ];
        }
        return true;
    }

    /**
     * @param array<string,array<string,mixed>> $expected
     * @return true|\WP_Error
     */
    private function validateManifestScripts(mixed $scripts, array $expected): bool|\WP_Error
    {
        if (!is_array($scripts) || !array_is_list($scripts) || count($scripts) !== count($expected)) {
            return new \WP_Error('pagecraft_runtime_manifest', 'The signed release script inventory must exactly match every artifact occurrence.');
        }
        $fields = ['source', 'ownerId', 'occurrenceId', 'region', 'order', 'placement', 'token', 'hash', 'kind'];
        $seen = [];
        $actualOrder = [];
        foreach ($scripts as $script) {
            if (!is_array($script)) {
                return new \WP_Error('pagecraft_runtime_manifest', 'A signed release script inventory entry is malformed.');
            }
            $keys = array_keys($script);
            sort($keys, SORT_STRING);
            $required = $fields;
            sort($required, SORT_STRING);
            if ($keys !== $required) {
                return new \WP_Error('pagecraft_runtime_manifest', 'Signed release script inventory fields must match the v1 contract exactly.');
            }
            $id = is_string($script['occurrenceId'] ?? null) ? (string) $script['occurrenceId'] : '';
            if ($id === '' || isset($seen[$id]) || !isset($expected[$id])) {
                return new \WP_Error('pagecraft_runtime_manifest', 'The signed release script inventory has an unknown or duplicate occurrence.');
            }
            foreach ($fields as $field) {
                if (($script[$field] ?? null) !== ($expected[$id][$field] ?? null)) {
                    return new \WP_Error('pagecraft_runtime_manifest', 'A signed release script inventory entry disagrees with the artifact occurrence.');
                }
            }
            $seen[$id] = true;
            $actualOrder[] = $id;
        }
        $sorted = array_values($expected);
        usort($sorted, static function (array $left, array $right): int {
            $leftKey = (string) $left['ownerId'] . ':' . (string) $left['region'] . ':'
                . str_pad((string) $left['order'], 8, '0', STR_PAD_LEFT) . ':' . (string) $left['occurrenceId'];
            $rightKey = (string) $right['ownerId'] . ':' . (string) $right['region'] . ':'
                . str_pad((string) $right['order'], 8, '0', STR_PAD_LEFT) . ':' . (string) $right['occurrenceId'];
            return strcmp($leftKey, $rightKey);
        });
        if ($actualOrder !== array_column($sorted, 'occurrenceId')) {
            return new \WP_Error('pagecraft_runtime_manifest', 'The signed release script inventory is not in canonical occurrence order.');
        }
        return true;
    }

    /**
     * @param list<mixed> $placeholders
     * @param array<string,array{routePath:string,id:string,token:string}> $expected
     * @return true|\WP_Error
     */
    private function validateRuntimePlaceholders(array $placeholders, array $expected): bool|\WP_Error
    {
        $found = [];
        foreach ($placeholders as $placeholder) {
            if (!is_array($placeholder) || ($placeholder['kind'] ?? '') !== 'runtime') {
                continue;
            }
            $rawRoute = $placeholder['routePath'] ?? null;
            $routePath = $rawRoute === '*' ? '*' : (is_string($rawRoute) ? Support::normalizeRoute($rawRoute) : '');
            $id = is_string($placeholder['id'] ?? null) ? (string) $placeholder['id'] : '';
            $token = is_string($placeholder['token'] ?? null) ? (string) $placeholder['token'] : '';
            $key = $routePath . "\0" . $id;
            if ($routePath === '' || !preg_match('/^script-[a-f0-9]{32}$/', $id)
                || !hash_equals('%%PAGECRAFT_RUNTIME:' . $id . '%%', $token)
                || isset($found[$key])
                || !isset($expected[$key])
                || !hash_equals($expected[$key]['token'], $token)) {
                return new \WP_Error('pagecraft_runtime_placeholder', 'Signed runtime placeholders must uniquely match the exact artifact occurrence, route, and token.');
            }
            $found[$key] = true;
        }
        if (count($found) !== count($expected)) {
            return new \WP_Error('pagecraft_runtime_placeholder', 'Every position-bound runtime occurrence must have one exact signed manifest placeholder.');
        }
        return true;
    }

    /** @return string|\WP_Error */
    private function stagedAssetFilename(string $assetId, string $hash, string $filename): string|\WP_Error
    {
        $filename = sanitize_file_name($filename);
        $prefix = $assetId . '-' . substr(strtolower($hash), 0, 12) . '-';
        $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
        if (!preg_match('/^[a-z0-9]{1,16}$/', $extension)) {
            $extension = '';
        }
        $suffix = $extension !== '' ? '.' . $extension : '';
        $stem = $extension !== '' ? substr($filename, 0, -(strlen($extension) + 1)) : $filename;
        $maxStemBytes = 240 - strlen($prefix) - strlen($suffix);
        if ($maxStemBytes < 1) {
            return new \WP_Error('pagecraft_asset_filename', 'The content-addressed Pagecraft asset filename exceeds the filesystem component limit.');
        }
        $stem = $this->truncateUtf8Bytes($stem, $maxStemBytes);
        $stem = rtrim($stem, ".-_ \t\n\r\0\x0B");
        if ($stem === '') {
            $stem = substr('asset', 0, $maxStemBytes);
        }
        $component = $prefix . $stem . $suffix;
        if (strlen($component) > 240 || str_contains($component, '/') || str_contains($component, '\\')) {
            return new \WP_Error('pagecraft_asset_filename', 'The content-addressed Pagecraft asset filename is unsafe.');
        }
        return $component;
    }

    private function truncateUtf8Bytes(string $value, int $maxBytes): string
    {
        if (strlen($value) <= $maxBytes) {
            return $value;
        }
        $value = substr($value, 0, $maxBytes);
        while ($value !== '' && preg_match('//u', $value) !== 1) {
            $value = substr($value, 0, -1);
        }
        return $value;
    }

    /** @return true|\WP_Error */
    private function validateCmsIdentities(mixed $cms): bool|\WP_Error
    {
        if (!is_array($cms) || !is_array($cms['collections'] ?? null)) {
            return new \WP_Error('pagecraft_artifact_cms', 'The signed artifact CMS map is invalid.');
        }
        $collections = [];
        $items = [];
        foreach ($cms['collections'] as $collection) {
            if (!is_array($collection)) {
                return new \WP_Error('pagecraft_artifact_cms_collection', 'The signed artifact contains an invalid CMS collection.');
            }
            $collectionId = (string) ($collection['collectionId'] ?? $collection['id'] ?? '');
            if (!Support::validIdentifier($collectionId) || isset($collections[$collectionId]) || !is_array($collection['items'] ?? null)) {
                return new \WP_Error('pagecraft_artifact_cms_collection', 'The signed artifact contains a duplicate or invalid CMS collection.');
            }
            $collections[$collectionId] = true;
            foreach ($collection['items'] as $item) {
                if (!is_array($item)) {
                    return new \WP_Error('pagecraft_artifact_cms_item', 'The signed artifact contains an invalid CMS item.');
                }
                $itemId = (string) ($item['itemId'] ?? $item['id'] ?? '');
                if (!Support::validIdentifier($itemId)) {
                    return new \WP_Error('pagecraft_artifact_cms_item', 'The signed artifact contains an invalid CMS item identity.');
                }
                if (isset($items[$itemId])) {
                    return new \WP_Error(
                        'pagecraft_artifact_cms_item_duplicate',
                        sprintf('CMS item ID %s occurs in both %s and %s; Connected v1 requires site-global item IDs.', $itemId, $items[$itemId], $collectionId)
                    );
                }
                $items[$itemId] = $collectionId;
            }
        }
        return true;
    }

    /**
     * The project manifest inventories CMS collections by immutable ID/name;
     * the signed artifact hash binds the complete field schema and item bytes.
     * Require the target artifact to project to exactly that signed inventory.
     *
     * @return true|\WP_Error
     */
    private function validateCmsManifestProjection(mixed $artifactCms, mixed $manifestCms): bool|\WP_Error
    {
        if (!is_array($artifactCms)
            || !is_array($artifactCms['collections'] ?? null)
            || !is_array($manifestCms)
            || !is_array($manifestCms['collections'] ?? null)) {
            return new \WP_Error('pagecraft_artifact_manifest_mismatch', 'Artifact field cms does not match the signed release manifest.');
        }
        $project = static function (array $collections, bool $full): ?array {
            $result = [];
            foreach ($collections as $collection) {
                if (!is_array($collection)
                    || !is_string($collection['id'] ?? null)
                    || !is_string($collection['name'] ?? null)
                    || (!$full && array_diff(array_keys($collection), ['id', 'name']) !== [])) {
                    return null;
                }
                $id = (string) $collection['id'];
                if (!Support::validIdentifier($id) || isset($result[$id])) {
                    return null;
                }
                $result[$id] = ['id' => $id, 'name' => (string) $collection['name']];
            }
            ksort($result, SORT_STRING);
            return array_values($result);
        };
        $artifactProjection = $project($artifactCms['collections'], true);
        $manifestProjection = $project($manifestCms['collections'], false);
        if ($artifactProjection === null
            || $manifestProjection === null
            || !hash_equals(
                hash('sha256', CanonicalJson::encode($artifactProjection)),
                hash('sha256', CanonicalJson::encode($manifestProjection))
            )) {
            return new \WP_Error('pagecraft_artifact_manifest_mismatch', 'Artifact field cms does not match the signed release manifest.');
        }
        return true;
    }

    /** @param array<string,mixed> $route @param list<mixed> $placeholders @return true|\WP_Error */
    private function unsafeRoute(
        array $route,
        array $placeholders,
        bool $existingTheme = false,
        bool $frozenSharedCss = false
    ): bool|\WP_Error
    {
        $html = implode("\n", [(string) ($route['headHtml'] ?? ''), (string) ($route['bodyHtml'] ?? ''), (string) ($route['contentHtml'] ?? '')]);
        if ($this->unsafeHtml($html) || $this->hasExecutableInlineScript($html)) {
            return new \WP_Error('pagecraft_artifact_inline_execution', 'Executable HTML must be isolated in the signed runtime and approved by fingerprint.');
        }
        if ($this->hasOwnedSeoHeadTag((string) ($route['headHtml'] ?? ''))) {
            return new \WP_Error('pagecraft_artifact_owned_seo_head', 'The compiled Pagecraft artifact contains raw canonical, Open Graph, or Twitter metadata instead of its signed target-neutral SEO fields.');
        }
        if ($this->hasUnresolvedHtmlNavigation($html)) {
            return new \WP_Error('pagecraft_artifact_html_link', 'A managed route contains an unresolved internal .html link.');
        }
        if ($this->hasMutableStylesheetLink($html)) {
            return new \WP_Error(
                'pagecraft_artifact_stylesheet',
                'Pagecraft releases cannot activate mutable external stylesheets; CSS must be embedded or reference an exact content-addressed release asset.'
            );
        }
        $css = html_entity_decode((string) ($route['css'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $securityCss = $this->canonicalCssSecurityView($css);
        if (preg_match('/@(?:import|namespace|charset)\b|(?<![-\w])expression\s*\(|javascript\s*:|(?<![-\w])-moz-binding\s*:|(?<![-\w])behavior\s*:|<\/style/i', $securityCss)) {
            return new \WP_Error('pagecraft_artifact_css_unsafe', 'A managed route contains CSS that cannot be isolated safely.');
        }
        if ($existingTheme && !$this->existingThemeCssSafe($css, $frozenSharedCss)) {
            return new \WP_Error(
                'pagecraft_artifact_existing_theme_css',
                'Existing Theme requires compiler-scoped selectors and exact Pagecraft-owned global CSS.'
            );
        }
        if (!$frozenSharedCss && preg_match_all('/%%PAGECRAFT_FORM_ENDPOINT:([A-Za-z0-9._:-]+)%%/', $html, $matches)) {
            foreach ($matches[1] as $formId) {
                $declared = false;
                foreach ($placeholders as $placeholder) {
                    $placeholderRoute = is_array($placeholder) && is_string($placeholder['routePath'] ?? null)
                        ? (string) $placeholder['routePath']
                        : '';
                    if (is_array($placeholder)
                        && ($placeholder['kind'] ?? '') === 'form'
                        && (string) ($placeholder['key'] ?? $placeholder['id'] ?? '') === (string) $formId
                        && Support::normalizeRoute($placeholderRoute) === Support::normalizeRoute((string) $route['path'])) {
                        $declared = true;
                        break;
                    }
                }
                if (!$declared) {
                    return new \WP_Error('pagecraft_artifact_form_placeholder', 'A WordPress form endpoint token is not declared in the signed manifest.');
                }
            }
        }
        return true;
    }

    /**
     * Build a conservative scan-only CSS view. CSS identifier escapes,
     * continuations and comments can otherwise disguise executable tokens or
     * mutable at-rules from a literal regular-expression check. The signed CSS
     * bytes themselves are never rewritten.
     */
    private function canonicalCssSecurityView(string $css): string
    {
        $css = (string) preg_replace('#/\*[\s\S]*?\*/#', '', $css);
        $css = (string) preg_replace("/\\\\(?:\r\n|[\n\r\f])/", '', $css);
        $css = (string) preg_replace_callback(
            '/\\\\(?:([0-9a-f]{1,6})(?:[ \t\r\n\f])?|([^\r\n\f0-9a-f]))/i',
            static function (array $match): string {
                if (($match[1] ?? '') === '') {
                    return (string) ($match[2] ?? '');
                }
                $codepoint = (int) hexdec((string) $match[1]);
                if ($codepoint === 0 || $codepoint > 0x10FFFF || ($codepoint >= 0xD800 && $codepoint <= 0xDFFF)) {
                    return "\u{FFFD}";
                }
                if ($codepoint <= 0x7F) {
                    return chr($codepoint);
                }
                return html_entity_decode('&#x' . dechex($codepoint) . ';', ENT_QUOTES | ENT_HTML5, 'UTF-8');
            },
            $css
        );
        return strtolower($css);
    }

    private function existingThemeCssSafe(string $css, bool $frozenSharedCss): bool
    {
        $cursor = 0;
        $length = strlen($css);
        while ($cursor < $length) {
            $boundary = $this->nextCssBoundary($css, $cursor);
            if ($boundary === null) {
                return trim($this->canonicalCssSecurityView(substr($css, $cursor))) === '';
            }
            [$at, $delimiter] = $boundary;
            $prelude = substr($css, $cursor, $at - $cursor);
            $semantic = trim($this->canonicalCssSecurityView($prelude));
            if ($delimiter === ';') {
                if ($semantic !== ''
                    && !preg_match('/^@layer\s+[a-z_][\w.-]*(?:\s*,\s*[a-z_][\w.-]*)*$/i', $semantic)) {
                    return false;
                }
                $cursor = $at + 1;
                continue;
            }
            $close = $this->matchingCssBrace($css, $at);
            if ($close === null || $semantic === '') {
                return false;
            }
            $body = substr($css, $at + 1, $close - $at - 1);
            if (preg_match('/^@(?:media|supports|layer|container)\b/i', $semantic)) {
                if (!$this->existingThemeCssSafe($body, $frozenSharedCss)) {
                    return false;
                }
            } elseif (preg_match('/^@(?:-webkit-)?keyframes\s+([a-z_][\w-]*)$/i', $semantic, $keyframe)) {
                $canonical = preg_replace(
                    '/\s+/',
                    '',
                    $this->canonicalCssSecurityView($prelude . '{' . $body . '}')
                );
                $name = strtolower((string) $keyframe[1]);
                if (!is_string($canonical)
                    || !isset(self::GENERATED_KEYFRAME_HASHES[$name])
                    || !hash_equals(self::GENERATED_KEYFRAME_HASHES[$name], hash('sha256', $canonical))) {
                    return false;
                }
            } elseif (preg_match('/^@font-face$/i', $semantic)) {
                if (!$frozenSharedCss || !$this->frozenFontFaceSafe($body)) {
                    return false;
                }
            } elseif (str_starts_with($semantic, '@')) {
                return false;
            } else {
                foreach ($this->splitCssSelectors($semantic) as $selector) {
                    if (!preg_match('/^\.pagecraft-root(?=$|[\s.#:\[>+~])/i', trim($selector))) {
                        return false;
                    }
                }
            }
            $cursor = $close + 1;
        }
        return true;
    }

    /** @return array{int,string}|null */
    private function nextCssBoundary(string $css, int $offset): ?array
    {
        $quote = '';
        $round = 0;
        $square = 0;
        $length = strlen($css);
        for ($index = $offset; $index < $length; $index++) {
            $character = $css[$index];
            if ($quote !== '') {
                if ($character === '\\') {
                    $index++;
                } elseif ($character === $quote) {
                    $quote = '';
                }
                continue;
            }
            if ($character === '/' && ($css[$index + 1] ?? '') === '*') {
                $end = strpos($css, '*/', $index + 2);
                if ($end === false) {
                    return null;
                }
                $index = $end + 1;
                continue;
            }
            if ($character === '"' || $character === "'") {
                $quote = $character;
                continue;
            }
            if ($character === '(') {
                $round++;
                continue;
            }
            if ($character === ')') {
                $round--;
                if ($round < 0) {
                    return null;
                }
                continue;
            }
            if ($character === '[') {
                $square++;
                continue;
            }
            if ($character === ']') {
                $square--;
                if ($square < 0) {
                    return null;
                }
                continue;
            }
            if ($round === 0 && $square === 0 && ($character === '{' || $character === ';')) {
                return [$index, $character];
            }
            if ($round === 0 && $square === 0 && $character === '}') {
                return null;
            }
        }
        return null;
    }

    private function matchingCssBrace(string $css, int $opening): ?int
    {
        $depth = 1;
        $quote = '';
        $length = strlen($css);
        for ($index = $opening + 1; $index < $length; $index++) {
            $character = $css[$index];
            if ($quote !== '') {
                if ($character === '\\') {
                    $index++;
                } elseif ($character === $quote) {
                    $quote = '';
                }
                continue;
            }
            if ($character === '/' && ($css[$index + 1] ?? '') === '*') {
                $end = strpos($css, '*/', $index + 2);
                if ($end === false) {
                    return null;
                }
                $index = $end + 1;
                continue;
            }
            if ($character === '"' || $character === "'") {
                $quote = $character;
            } elseif ($character === '{') {
                $depth++;
            } elseif ($character === '}' && --$depth === 0) {
                return $index;
            }
        }
        return null;
    }

    /** @return list<string> */
    private function splitCssSelectors(string $selectors): array
    {
        $parts = [];
        $start = 0;
        $quote = '';
        $round = 0;
        $square = 0;
        $length = strlen($selectors);
        for ($index = 0; $index < $length; $index++) {
            $character = $selectors[$index];
            if ($quote !== '') {
                if ($character === '\\') {
                    $index++;
                } elseif ($character === $quote) {
                    $quote = '';
                }
                continue;
            }
            if ($character === '"' || $character === "'") {
                $quote = $character;
            } elseif ($character === '(') {
                $round++;
            } elseif ($character === ')') {
                $round--;
            } elseif ($character === '[') {
                $square++;
            } elseif ($character === ']') {
                $square--;
            } elseif ($character === ',' && $round === 0 && $square === 0) {
                $parts[] = substr($selectors, $start, $index - $start);
                $start = $index + 1;
            }
        }
        $parts[] = substr($selectors, $start);
        return $parts;
    }

    private function frozenFontFaceSafe(string $body): bool
    {
        if (!preg_match('/(?:^|;)\s*font-family\s*:/i', $body)
            || preg_match('/\blocal\s*\(/i', $body)
            || !preg_match_all('/url\s*\(\s*(?:(["\'])(.*?)\1|([^)]*))\s*\)/is', $body, $matches, PREG_SET_ORDER)) {
            return false;
        }
        foreach ($matches as $match) {
            $url = trim((string) (($match[2] ?? '') !== '' ? $match[2] : ($match[3] ?? '')));
            if (!preg_match('#^data:font/woff2;base64,[A-Za-z0-9+/]+={0,2}$#', $url)) {
                return false;
            }
        }
        return true;
    }

    private function hasExecutableInlineScript(string $html): bool
    {
        $scan = $this->scanHtmlTags($html);
        if ($scan['incomplete']) {
            return true;
        }
        foreach ($scan['tags'] as $script) {
            $semantics = Support::htmlTagSemantics((string) $script, ['type', 'src']);
            if ($semantics['tag'] !== 'script') {
                continue;
            }
            $attributes = $semantics['attributes'];
            $type = strtolower(trim((string) ($attributes['type'] ?? '')));
            $type = trim((string) strtok($type, ';'));
            if (array_key_exists('src', $attributes)
                || !in_array($type, ['application/ld+json', 'application/json'], true)) {
                return true;
            }
        }
        return false;
    }

    private function hasOwnedSeoHeadTag(string $html): bool
    {
        foreach ($this->scanHtmlTags($html)['tags'] as $markup) {
            $tag = Support::htmlTagSemantics((string) $markup, ['rel', 'name', 'property']);
            if ($tag['tag'] === 'link') {
                $relations = preg_split('/\s+/', strtolower(trim((string) ($tag['attributes']['rel'] ?? '')))) ?: [];
                if (in_array('canonical', $relations, true)) {
                    return true;
                }
            }
            if ($tag['tag'] === 'meta') {
                foreach (['name', 'property'] as $ownerAttribute) {
                    $owner = strtolower(trim((string) ($tag['attributes'][$ownerAttribute] ?? '')));
                    if ($owner === 'canonical' || str_starts_with($owner, 'og:') || str_starts_with($owner, 'twitter:')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private function hasMutableStylesheetLink(string $html): bool
    {
        foreach ($this->scanHtmlTags($html)['tags'] as $markup) {
            $tag = Support::htmlTagSemantics($markup, ['rel', 'href']);
            if ($tag['tag'] !== 'link') {
                continue;
            }
            $relations = preg_split('/\s+/', strtolower(trim((string) ($tag['attributes']['rel'] ?? '')))) ?: [];
            if (in_array('stylesheet', $relations, true)
                && !$this->isContentAddressedStylesheet((string) ($tag['attributes']['href'] ?? ''))) {
                return true;
            }
        }
        return false;
    }

    private function isContentAddressedStylesheet(string $href): bool
    {
        return preg_match('#^(?:pc-asset://[A-Za-z0-9][A-Za-z0-9._:-]{0,95}|\{\{pagecraft-asset:[A-Za-z0-9][A-Za-z0-9._:-]{0,95}\}\})$#', trim($href)) === 1;
    }

    /**
     * Tokenize real opening tags while honoring comments and HTML raw-text /
     * RCDATA boundaries. Entity-escaped code examples remain text nodes.
     *
     * @return array{tags:list<string>,incomplete:bool}
     */
    private function scanHtmlTags(string $html): array
    {
        $tags = [];
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
                    return ['tags' => $tags, 'incomplete' => true];
                }
                $cursor = $commentEnd + 3;
                continue;
            }
            $candidate = substr($html, $opening, 80);
            if (!preg_match('/^<\s*\/?\s*[A-Za-z][A-Za-z0-9:-]*\b/', $candidate)
                && !str_starts_with($candidate, '<!')
                && !str_starts_with($candidate, '<?')) {
                $cursor = $opening + 1;
                continue;
            }
            $tagEnd = $this->htmlTagEnd($html, $opening);
            if ($tagEnd === null) {
                return ['tags' => $tags, 'incomplete' => true];
            }
            $markup = substr($html, $opening, $tagEnd - $opening + 1);
            if (!preg_match('/^<\s*([A-Za-z][A-Za-z0-9:-]*)\b/', $markup, $match)) {
                $cursor = $tagEnd + 1;
                continue;
            }
            $tagName = strtolower((string) $match[1]);
            $tags[] = $markup;
            $cursor = $tagEnd + 1;
            if (!in_array($tagName, ['script', 'style', 'title', 'textarea'], true)) {
                continue;
            }
            if (!preg_match(
                '#</\s*' . preg_quote($tagName, '#') . '\s*>#i',
                $html,
                $closing,
                PREG_OFFSET_CAPTURE,
                $cursor
            )) {
                return ['tags' => $tags, 'incomplete' => true];
            }
            $cursor = (int) $closing[0][1] + strlen((string) $closing[0][0]);
        }
        return ['tags' => $tags, 'incomplete' => false];
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

    /** Parse attributes with WordPress core's HTML tokenizer so quoted, unquoted, and entity-obfuscated executable values fail closed. */
    private function unsafeHtml(string $html): bool
    {
        $scan = $this->scanHtmlTags($html);
        if ($scan['incomplete']) {
            return true;
        }
        $blockedTags = ['OBJECT', 'EMBED', 'APPLET', 'FRAME', 'FRAMESET', 'BASE', 'PORTAL'];
        $urlAttributes = ['href', 'src', 'srcset', 'action', 'formaction', 'xlink:href', 'data', 'poster', 'background'];
        foreach ($scan['tags'] as $markup) {
            $semantics = Support::htmlTagSemantics($markup, ['*']);
            $tag = strtoupper($semantics['tag']);
            $attributes = $semantics['attributes'];
            if (in_array($tag, $blockedTags, true)) {
                return true;
            }
            if ($tag === 'IFRAME') {
                if (!$this->portableEmbedTag($tag, $attributes)) {
                    return true;
                }
            } elseif (isset($attributes['data-embed'])) {
                if (!$this->portableEmbedTag($tag, $attributes)) {
                    return true;
                }
            } elseif (isset($attributes['data-pagecraft-embed-provider'])) {
                return true;
            }
            if (!$this->frozenMarkupResources($tag, $attributes)) {
                return true;
            }
            // Script type/src semantics are handled once by
            // hasExecutableInlineScript() for both tokenizer and fallback paths.
            if ($tag === 'META' && strtolower($this->compactAttribute($attributes['http-equiv'] ?? '')) === 'refresh') {
                return true;
            }
            $relations = preg_split('/\s+/', strtolower(trim((string) ($attributes['rel'] ?? '')))) ?: [];
            if ($tag === 'LINK' && in_array('import', $relations, true)) {
                return true;
            }
            foreach ($attributes as $name => $value) {
                $lowerName = strtolower((string) $name);
                if (str_starts_with($lowerName, 'on') || $lowerName === 'srcdoc') {
                    return true;
                }
                $compact = strtolower($this->compactAttribute($value));
                if (in_array($lowerName, $urlAttributes, true)
                    && preg_match('/(?:^|,)(?:javascript|vbscript|data|blob|filesystem):/i', $compact)) {
                    if (!str_starts_with($compact, 'data:')
                        || !$this->portableDataResource($tag, $lowerName, $attributes)) {
                        return true;
                    }
                }
                if ($lowerName === 'style'
                    && preg_match('/(?:expression\(|javascript:|vbscript:|data:text\/html|-moz-binding:|behavior:)/i', $compact)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** @param array<string,string> $attributes */
    private function frozenMarkupResources(string $tag, array $attributes): bool
    {
        $names = [];
        if (in_array($tag, ['IMG', 'SOURCE'], true)) {
            $names[] = 'src';
        }
        if ($tag === 'VIDEO') {
            $names = array_merge($names, ['src', 'poster']);
        }
        if (in_array($tag, ['AUDIO', 'TRACK'], true)) {
            $names[] = 'src';
        }
        if ($tag === 'INPUT' && strtolower((string) ($attributes['type'] ?? '')) === 'image') {
            $names[] = 'src';
        }
        foreach ($names as $name) {
            $value = trim((string) ($attributes[$name] ?? ''));
            if ($value !== '' && !$this->immutableMarkupResource($value)) {
                return false;
            }
        }
        if (in_array($tag, ['IMG', 'SOURCE'], true) && isset($attributes['srcset'])) {
            $srcset = trim((string) $attributes['srcset']);
            if ($srcset !== '' && !str_starts_with(strtolower($srcset), 'data:')) {
                foreach (explode(',', $srcset) as $candidate) {
                    $url = preg_split('/\s+/', trim($candidate), 2)[0] ?? '';
                    if ($url !== '' && !$this->immutableMarkupResource($url)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private function immutableMarkupResource(string $value): bool
    {
        return preg_match('#^(?:pc-asset://|\{\{pagecraft-asset:|data:)#i', trim($value)) === 1;
    }

    /** @param array<string,string> $attributes */
    private function portableDataResource(string $tag, string $attribute, array $attributes): bool
    {
        return ($attribute === 'src' && in_array($tag, ['IMG', 'SOURCE', 'VIDEO', 'AUDIO', 'TRACK'], true))
            || ($attribute === 'poster' && $tag === 'VIDEO')
            || ($attribute === 'srcset' && in_array($tag, ['IMG', 'SOURCE'], true))
            || ($attribute === 'src' && $tag === 'INPUT' && strtolower((string) ($attributes['type'] ?? '')) === 'image');
    }

    /** @param array<string,string> $attributes */
    private function portableEmbedTag(string $tag, array $attributes): bool
    {
        if ($tag === 'IFRAME') {
            $provider = $this->portableEmbedProvider((string) ($attributes['src'] ?? ''));
            if ($provider === ''
                || !hash_equals($provider, (string) ($attributes['data-pagecraft-embed-provider'] ?? ''))) {
                return false;
            }
            $allowed = [
                'src', 'title', 'width', 'height', 'loading', 'allow', 'allowfullscreen', 'frameborder',
                'referrerpolicy', 'sandbox', 'class', 'id', 'aria-label', 'data-pagecraft-embed-provider',
            ];
            if (array_diff(array_keys($attributes), $allowed) !== []) {
                return false;
            }
            $loading = strtolower((string) ($attributes['loading'] ?? ''));
            if ($loading !== '' && !in_array($loading, ['lazy', 'eager'], true)) {
                return false;
            }
            $frameborder = (string) ($attributes['frameborder'] ?? '');
            if ($frameborder !== '' && !in_array($frameborder, ['0', '1'], true)) {
                return false;
            }
            foreach (['title', 'allow', 'referrerpolicy', 'sandbox', 'class', 'id', 'aria-label'] as $name) {
                if (strlen((string) ($attributes[$name] ?? '')) > 512) {
                    return false;
                }
            }
            return true;
        }
        if ($tag !== 'BUTTON') {
            return false;
        }
        $provider = $this->portableEmbedProvider((string) ($attributes['data-embed'] ?? ''));
        return $provider !== ''
            && hash_equals($provider, (string) ($attributes['data-pagecraft-embed-provider'] ?? ''));
    }

    private function portableEmbedProvider(string $value): string
    {
        $value = trim($value);
        if ($value === '' || strlen($value) > 2048) {
            return '';
        }
        $parts = wp_parse_url($value);
        if (!is_array($parts)
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || (string) ($parts['user'] ?? '') !== ''
            || (string) ($parts['pass'] ?? '') !== ''
            || (string) ($parts['fragment'] ?? '') !== '') {
            return '';
        }
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        $path = (string) ($parts['path'] ?? '');
        if (in_array($host, ['www.youtube.com', 'www.youtube-nocookie.com'], true)
            && preg_match('#^/embed/[A-Za-z0-9_-]{6,128}$#', $path)) {
            return 'youtube';
        }
        if ($host === 'player.vimeo.com' && preg_match('#^/video/[0-9]{1,32}$#', $path)) {
            return 'vimeo';
        }
        return '';
    }

    /**
     * Inspect navigation attributes with WordPress core's HTML tokenizer. The
     * regex branch is a fail-closed compatibility fallback for test/minimal
     * runtimes where the WordPress 6.6 tokenizer has not been loaded yet.
     */
    private function hasUnresolvedHtmlNavigation(string $html): bool
    {
        $attributes = ['href', 'action', 'formaction'];
        foreach ($this->scanHtmlTags($html)['tags'] as $markup) {
            $tag = Support::htmlTagSemantics($markup, $attributes);
            foreach ($attributes as $attribute) {
                if (isset($tag['attributes'][$attribute])
                    && $this->isInternalHtmlReference((string) $tag['attributes'][$attribute])) {
                    return true;
                }
            }
        }
        return false;
    }

    private function isInternalHtmlReference(string $value): bool
    {
        $value = trim(html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($value === '' || str_starts_with($value, '#') || str_starts_with($value, '%%PAGECRAFT_')) {
            return false;
        }
        $parts = wp_parse_url($value);
        if (!is_array($parts) || isset($parts['scheme']) || isset($parts['host'])) {
            return false;
        }
        $path = rawurldecode((string) ($parts['path'] ?? ''));
        return (bool) preg_match('/\.html$/i', str_replace('\\', '/', $path));
    }

    private function compactAttribute(mixed $value): string
    {
        if (!is_string($value)) {
            return '';
        }
        $decoded = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return (string) preg_replace('/[\x00-\x20\x7F]+/', '', $decoded);
    }

    /** @param array<string,mixed> $artifact @return true|\WP_Error */
    private function validateAssetReferences(array $artifact): bool|\WP_Error
    {
        $ids = [];
        $legacyPaths = [];
        foreach ((array) ($artifact['assets'] ?? []) as $asset) {
            if (is_array($asset)) {
                $ids[(string) ($asset['assetId'] ?? '')] = true;
                $legacyPaths[] = (string) ($asset['filename'] ?? '');
            }
        }
        $routes = (array) ($artifact['routes'] ?? []);
        $shared = is_array($artifact['shared'] ?? null) ? $artifact['shared'] : [];
        $routes[] = [
            'headHtml' => '',
            'bodyHtml' => (string) ($shared['headerHtml'] ?? '') . (string) ($shared['footerHtml'] ?? ''),
            'css' => (string) ($shared['css'] ?? ''),
        ];
        foreach ($routes as $route) {
            if (!is_array($route)) {
                continue;
            }
            $source = implode("\n", [(string) ($route['headHtml'] ?? ''), (string) ($route['bodyHtml'] ?? ''), (string) ($route['contentHtml'] ?? ''), (string) ($route['css'] ?? '')]);
            if (preg_match_all('/pc-asset:\/\/([A-Za-z0-9._:-]+)/', $source, $matches)) {
                foreach ($matches[1] as $id) {
                    if (!isset($ids[(string) $id])) {
                        return new \WP_Error('pagecraft_asset_placeholder_unknown', 'A route references an asset ID not present in the signed artifact.');
                    }
                }
            }
            foreach ($legacyPaths as $path) {
                if ($path !== '' && (str_contains($source, 'assets/' . $path) || str_contains($source, $path))) {
                    return new \WP_Error('pagecraft_asset_placeholder_required', 'Compiled routes must use explicit pc-asset:// IDs instead of raw asset paths.');
                }
            }
        }
        return true;
    }

    /** @param array<string,mixed> $manifest @return array{directory:string,files:array<string,string>}|\WP_Error */
    public function extract(string $archive, array $manifest): array|\WP_Error
    {
        if (!class_exists(ZipArchive::class)) {
            return new \WP_Error('pagecraft_zip_missing', 'The PHP Zip extension is required to inspect signed Pagecraft archives safely.');
        }
        if (!is_readable($archive)) {
            return new \WP_Error('pagecraft_archive_missing', 'The Pagecraft release archive is not readable.');
        }
        if (!Support::hashEquals((string) $manifest['artifactHash'], hash_file('sha256', $archive) ?: '')) {
            return new \WP_Error('pagecraft_artifact_hash', 'The Pagecraft release archive hash does not match its signed manifest.');
        }

        $expected = [];
        $total = 0;
        foreach ((array) $manifest['files'] as $file) {
            if (!is_array($file)) {
                continue;
            }
            $path = (string) $file['path'];
            $expected[$path] = $file;
            $total += (int) $file['bytes'];
        }
        $maxExpanded = (int) apply_filters('pagecraft_connector_max_expanded_bytes', 250 * MB_IN_BYTES);
        if ($total > $maxExpanded) {
            return new \WP_Error('pagecraft_archive_expanded_size', 'The expanded release exceeds the configured size limit.');
        }

        $zip = new ZipArchive();
        if ($zip->open($archive, ZipArchive::RDONLY) !== true) {
            return new \WP_Error('pagecraft_archive_open', 'The Pagecraft release archive could not be opened.');
        }
        $seen = [];
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $stat = $zip->statIndex($index, ZipArchive::FL_UNCHANGED);
            if (!is_array($stat)) {
                $zip->close();
                return new \WP_Error('pagecraft_archive_entry', 'The release contains an unreadable archive entry.');
            }
            $name = (string) ($stat['name'] ?? '');
            if (str_ends_with($name, '/')) {
                continue;
            }
            if (!isset($expected[$name]) || isset($seen[$name]) || (int) $stat['size'] !== (int) $expected[$name]['bytes']) {
                $zip->close();
                return new \WP_Error('pagecraft_archive_index', 'The archive contents do not match the signed file index.');
            }
            $seen[$name] = true;
            if (method_exists($zip, 'getExternalAttributesIndex')) {
                $opsys = 0;
                $attributes = 0;
                if ($zip->getExternalAttributesIndex($index, $opsys, $attributes)) {
                    $mode = ($attributes >> 16) & 0170000;
                    if ($mode === 0120000) {
                        $zip->close();
                        return new \WP_Error('pagecraft_archive_symlink', 'Symbolic links are not allowed in Pagecraft releases.');
                    }
                }
            }
        }
        if (count($seen) !== count($expected)) {
            $zip->close();
            return new \WP_Error('pagecraft_archive_missing_files', 'The archive is missing signed files.');
        }

        $uploads = wp_upload_dir();
        if (!empty($uploads['error'])) {
            $zip->close();
            return new \WP_Error('pagecraft_upload_dir', (string) $uploads['error']);
        }
        $releaseId = sanitize_file_name((string) $manifest['releaseId']);
        $directory = trailingslashit((string) $uploads['basedir']) . 'pagecraft/staging/' . $releaseId . '-' . wp_generate_password(10, false, false);
        if (!wp_mkdir_p($directory)) {
            $zip->close();
            return new \WP_Error('pagecraft_staging_directory', 'WordPress could not create the release staging directory.');
        }
        if (!$zip->extractTo($directory)) {
            $zip->close();
            $this->removeDirectory($directory);
            return new \WP_Error('pagecraft_archive_extract', 'WordPress could not extract the Pagecraft release.');
        }
        $zip->close();

        $files = [];
        foreach ($expected as $path => $file) {
            $absolute = $directory . '/' . $path;
            $real = realpath($absolute);
            $root = realpath($directory);
            if (!is_string($real) || !is_string($root) || !str_starts_with($real, $root . DIRECTORY_SEPARATOR)
                || !is_file($real)
                || !Support::hashEquals((string) $file['sha256'], hash_file('sha256', $real) ?: '')) {
                $this->removeDirectory($directory);
                return new \WP_Error('pagecraft_file_hash', 'An extracted release file failed integrity verification.');
            }
            $files[$path] = $real;
        }
        return ['directory' => $directory, 'files' => $files];
    }

    public function removeDirectory(string $directory): void
    {
        $uploads = wp_upload_dir();
        $allowedRoot = realpath(trailingslashit((string) ($uploads['basedir'] ?? '')) . 'pagecraft/staging');
        $target = realpath($directory);
        if (!is_string($allowedRoot) || !is_string($target) || !str_starts_with($target, $allowedRoot . DIRECTORY_SEPARATOR)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($target, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            if ($item->isDir() && !$item->isLink()) {
                rmdir($item->getPathname());
            } else {
                wp_delete_file($item->getPathname());
            }
        }
        rmdir($target);
    }
}
