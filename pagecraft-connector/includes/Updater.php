<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

/** Signed, private update channel for the connector and universal theme. */
final class Updater
{
    private const PREFIX = "pagecraft-package-v1\0";
    private const CONNECTOR = 'pagecraft-connector';
    private const THEME = 'pagecraft-theme';
    private const THEME_STYLESHEET = 'pagecraft';
    // Constructed in two parts so production packaging can assert that the
    // literal marker exists only at the RootTrust injection point.
    private const ROOT_MARKER = '@@PAGECRAFT_ROOT_' . 'PUBLIC_KEY_BASE64URL@@';

    public function __construct(private readonly Connection $connection, private readonly HttpClient $http)
    {
    }

    public function hooks(): void
    {
        add_filter('pre_set_site_transient_update_plugins', [$this, 'checkPlugins']);
        add_filter('pre_set_site_transient_update_themes', [$this, 'checkThemes']);
        add_filter('upgrader_pre_download', [$this, 'download'], 10, 4);
    }

    public function checkPlugins(mixed $transient): mixed
    {
        if (!$this->mayCheck($transient)) {
            return $transient;
        }
        $metadata = $this->metadata(self::CONNECTOR);
        if (is_wp_error($metadata) || version_compare(PAGECRAFT_CONNECTOR_VERSION, (string) $metadata['version'], '>=')) {
            return $transient;
        }
        $plugin = plugin_basename(PAGECRAFT_CONNECTOR_FILE);
        $transient->response[$plugin] = (object) [
            'id' => 'pagecraft/' . self::CONNECTOR,
            'slug' => self::CONNECTOR,
            'plugin' => $plugin,
            'new_version' => (string) $metadata['version'],
            'url' => 'https://build.itspagecraft.com/',
            'package' => $this->packageUri(self::CONNECTOR, (string) $metadata['version']),
            'tested' => (string) ($metadata['requirements']['wordpress'] ?? ''),
            'requires_php' => (string) ($metadata['requirements']['php'] ?? '8.1'),
        ];
        return $transient;
    }

    public function checkThemes(mixed $transient): mixed
    {
        if (!$this->mayCheck($transient)) {
            return $transient;
        }
        $theme = wp_get_theme(self::THEME_STYLESHEET);
        if (!$theme->exists()) {
            return $transient;
        }
        $metadata = $this->metadata(self::THEME);
        if (is_wp_error($metadata) || version_compare((string) $theme->get('Version'), (string) $metadata['version'], '>=')) {
            return $transient;
        }
        $transient->response[self::THEME_STYLESHEET] = [
            'theme' => self::THEME_STYLESHEET,
            'new_version' => (string) $metadata['version'],
            'url' => 'https://build.itspagecraft.com/',
            'package' => $this->packageUri(self::THEME, (string) $metadata['version']),
            'requires' => (string) ($metadata['requirements']['wordpress'] ?? '6.6'),
            'requires_php' => (string) ($metadata['requirements']['php'] ?? '8.1'),
        ];
        return $transient;
    }

    public function download(mixed $reply, string $package, mixed $upgrader, array $hookExtra): mixed
    {
        $slug = $this->slugFromPackageUri($package);
        if ($slug === '') {
            return $reply;
        }
        $capability = $slug === self::THEME ? 'update_themes' : 'update_plugins';
        if (!current_user_can($capability)) {
            return new \WP_Error('pagecraft_update_forbidden', sprintf('You cannot update %s.', $slug === self::THEME ? 'Pagecraft Theme' : 'Pagecraft Connector'));
        }
        delete_transient($this->cacheKey($slug));
        $metadata = $this->metadata($slug);
        if (is_wp_error($metadata)) {
            return $metadata;
        }
        $file = $this->http->download((string) $metadata['_downloadUrl'], (int) $metadata['packageBytes']);
        if (is_wp_error($file)) {
            return $file;
        }
        if (!Support::hashEquals((string) $metadata['packageHash'], hash_file('sha256', $file) ?: '')) {
            wp_delete_file($file);
            return new \WP_Error('pagecraft_package_hash', 'The downloaded package does not match its signed manifest.');
        }
        $archive = $this->validateArchive($file, $slug);
        if (is_wp_error($archive)) {
            wp_delete_file($file);
            return $archive;
        }
        return $file;
    }

    private function mayCheck(mixed $transient): bool
    {
        return is_object($transient) && $this->connection->isConfigured() && $this->connection->mode() !== 'frozen';
    }

    private function packageUri(string $slug, string $version): string
    {
        return 'pagecraft-signed://' . $slug . '/' . rawurlencode($version);
    }

    private function slugFromPackageUri(string $package): string
    {
        foreach ([self::CONNECTOR, self::THEME] as $slug) {
            if (str_starts_with($package, 'pagecraft-signed://' . $slug . '/')) {
                return $slug;
            }
        }
        return '';
    }

    /** @return array<string,mixed>|\WP_Error */
    private function metadata(string $slug): array|\WP_Error
    {
        if (!in_array($slug, [self::CONNECTOR, self::THEME], true)) {
            return new \WP_Error('pagecraft_package_slug', 'The Pagecraft package slug is invalid.');
        }
        $cached = get_transient($this->cacheKey($slug));
        if (is_array($cached)) {
            return $cached;
        }
        $response = $this->http->packageMetadata($slug);
        if (is_wp_error($response)) {
            return $response;
        }
        try {
            if (isset($response['keysetEnvelope']) && is_array($response['keysetEnvelope'])) {
                $this->connection->installKeysetEnvelope($response['keysetEnvelope']);
            }
            $signed = is_array($response['signed'] ?? null) ? $response['signed'] : [];
            $bytes = Support::base64UrlDecode((string) ($signed['manifest'] ?? ''));
            CanonicalJson::decode($bytes);
            $manifest = Support::decodeObject($bytes);
            $signature = Support::base64UrlDecode((string) ($signed['signature'] ?? ''));
            $publicKey = $this->releaseKey((string) ($signed['keyId'] ?? ''));
            if (strlen($signature) !== 64 || !$this->verify($signature, self::PREFIX . $bytes, $publicKey)) {
                throw new \RuntimeException('The Pagecraft package signature is invalid.');
            }
            $packageObject = is_array($response['package'] ?? null) ? $response['package'] : [];
            if (hash('sha256', CanonicalJson::encode(json_decode(Support::json($packageObject)))) !== hash('sha256', $bytes)
                || ($manifest['format'] ?? '') !== 'pagecraft.package.v1'
                || ($manifest['slug'] ?? '') !== $slug
                || !preg_match('/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/', (string) ($manifest['version'] ?? ''))
                || !preg_match('/^[a-f0-9]{64}$/', (string) ($manifest['packageHash'] ?? ''))
                || !is_int($manifest['packageBytes'] ?? null)
                || (int) $manifest['packageBytes'] < 1
                || ($manifest['license'] ?? '') !== 'GPL-3.0-or-later'
                || !is_array($manifest['requirements'] ?? null)) {
                throw new \RuntimeException('The signed Pagecraft package manifest is invalid or is not GPL-3.0-or-later.');
            }
            $download = is_array($response['download'] ?? null) ? $response['download'] : [];
            $url = esc_url_raw((string) ($download['url'] ?? ''));
            $expires = strtotime((string) ($download['expiresAt'] ?? ''));
            if ($url === ''
                || !$expires
                || $expires <= time()
                || Support::normalizeOrigin($url) !== $this->connection->apiOrigin()
                || (!str_starts_with($url, 'https://') && !Support::environmentAllowsHttp($url))) {
                throw new \RuntimeException('The Pagecraft package capability is invalid.');
            }
            $manifest['_downloadUrl'] = $url;
            set_transient($this->cacheKey($slug), $manifest, min(4 * MINUTE_IN_SECONDS, max(30, $expires - time() - 5)));
            return $manifest;
        } catch (\RuntimeException $error) {
            return new \WP_Error('pagecraft_package_invalid', $error->getMessage());
        }
    }

    private function cacheKey(string $slug): string
    {
        return 'pagecraft_package_' . str_replace('-', '_', $slug);
    }

    private function releaseKey(string $keyId): string
    {
        foreach ((array) ($this->connection->keyset()['keys'] ?? []) as $key) {
            if (!is_array($key) || !hash_equals($keyId, (string) ($key['id'] ?? ''))) {
                continue;
            }
            $now = time();
            if (($key['algorithm'] ?? '') !== 'Ed25519'
                || strtotime((string) ($key['notBefore'] ?? '')) > $now
                || strtotime((string) ($key['notAfter'] ?? '')) <= $now) {
                break;
            }
            $decoded = Support::base64UrlDecode((string) ($key['publicKey'] ?? ''));
            if (strlen($decoded) === 32) {
                return $decoded;
            }
        }
        throw new \RuntimeException('The Pagecraft package signing key is unknown or inactive.');
    }

    private function verify(string $signature, string $message, string $publicKey): bool
    {
        if (function_exists('sodium_crypto_sign_verify_detached')) {
            return sodium_crypto_sign_verify_detached($signature, $message, $publicKey);
        }
        if (class_exists('ParagonIE_Sodium_Compat')) {
            return \ParagonIE_Sodium_Compat::crypto_sign_verify_detached($signature, $message, $publicKey);
        }
        return false;
    }

    private function validateArchive(string $file, string $slug): bool|\WP_Error
    {
        if (!class_exists('ZipArchive')) {
            return new \WP_Error('pagecraft_package_zip_unavailable', 'ZIP support is required to inspect a signed Pagecraft package before installation.');
        }
        $zip = new \ZipArchive();
        if ($zip->open($file) !== true) {
            return new \WP_Error('pagecraft_package_zip_invalid', 'The signed Pagecraft package is not a readable ZIP archive.');
        }
        $expectedRoot = $slug === self::THEME ? self::THEME_STYLESHEET : self::CONNECTOR;
        $requiredEntry = $slug === self::THEME
            ? self::THEME_STYLESHEET . '/style.css'
            : self::CONNECTOR . '/pagecraft-connector.php';
        $requiredFound = false;
        $rootTrust = null;
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $name = (string) $zip->getNameIndex($index);
            if ($name === '' || str_starts_with($name, '/') || preg_match('#(?:^|/)\.\.(?:/|$)#', $name)) {
                $zip->close();
                return new \WP_Error('pagecraft_package_path', 'The signed Pagecraft package contains an unsafe path.');
            }
            if (!str_starts_with($name, $expectedRoot . '/')) {
                $zip->close();
                return new \WP_Error('pagecraft_package_root', sprintf('The signed %s package must install under %s/.', $slug, $expectedRoot));
            }
            if ($name === $requiredEntry) {
                $requiredFound = true;
            }
            if ($slug === self::CONNECTOR && $name === self::CONNECTOR . '/includes/RootTrust.php') {
                $rootTrust = $zip->getFromIndex($index);
            }
        }
        $zip->close();
        if (!$requiredFound) {
            return new \WP_Error('pagecraft_package_root', sprintf('The signed %s package is missing %s.', $slug, $requiredEntry));
        }
        if ($slug === self::CONNECTOR && (!is_string($rootTrust) || str_contains($rootTrust, self::ROOT_MARKER))) {
            return new \WP_Error('pagecraft_package_root_unprovisioned', 'The connector package has no production Pagecraft root key and cannot be installed.');
        }
        return true;
    }
}
