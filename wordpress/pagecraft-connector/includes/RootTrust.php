<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use RuntimeException;

/**
 * Root-of-trust boundary for Pagecraft release keys.
 *
 * Production packaging MUST replace the marker below with the base64url encoding of the raw
 * 32-byte Ed25519 root public key. The root private key never belongs in this plugin or in the
 * Pagecraft application runtime.
 */
final class RootTrust
{
    public const ROOT_KEY_ID = 'pagecraft-root-v1';
    private const BUNDLED_ROOT_PUBLIC_KEY = '@@PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL@@';
    private const SIGNING_PREFIX = "pagecraft-keyset-v1\0";

    /** @param array<string,mixed> $envelope @return array<string,mixed> */
    public static function verifyKeysetEnvelope(array $envelope, string $apiOrigin): array
    {
        $encoded = (string) ($envelope['keyset'] ?? '');
        $signature = Support::base64UrlDecode((string) ($envelope['signature'] ?? ''));
        $rootKeyId = (string) ($envelope['rootKeyId'] ?? $envelope['root_key_id'] ?? '');
        if (!hash_equals(self::ROOT_KEY_ID, $rootKeyId) || strlen($signature) !== 64) {
            throw new RuntimeException('The Pagecraft signing-key envelope is invalid.');
        }
        $bytes = Support::base64UrlDecode($encoded);
        CanonicalJson::decode($bytes);
        $keyset = Support::decodeObject($bytes);
        if (($keyset['format'] ?? '') !== 'pagecraft.keyset.v1' || !is_array($keyset['keys'] ?? null)) {
            throw new RuntimeException('The Pagecraft signing-key set has an unsupported format.');
        }
        $root = self::rootPublicKey($apiOrigin);
        if (!self::verify($signature, self::SIGNING_PREFIX . $bytes, $root)) {
            throw new RuntimeException('The Pagecraft signing-key set is not signed by the pinned root key.');
        }
        $now = time();
        $generated = strtotime((string) ($keyset['generatedAt'] ?? ''));
        $expires = strtotime((string) ($keyset['expiresAt'] ?? ''));
        if (!$generated || !$expires || $generated > $now + 300 || $expires <= $now) {
            throw new RuntimeException('The Pagecraft signing-key set is not currently valid.');
        }
        foreach ($keyset['keys'] as $key) {
            if (!is_array($key)
                || !Support::validIdentifier($key['id'] ?? null)
                || ($key['algorithm'] ?? '') !== 'Ed25519'
                || strlen(Support::base64UrlDecode((string) ($key['publicKey'] ?? ''))) !== 32
                || !strtotime((string) ($key['notBefore'] ?? ''))
                || !strtotime((string) ($key['notAfter'] ?? ''))) {
                throw new RuntimeException('The Pagecraft signing-key set contains an invalid key.');
            }
        }
        $keyset['_canonical'] = $bytes;
        $keyset['_fingerprint'] = hash('sha256', $bytes);
        return $keyset;
    }

    public static function isProvisioned(string $apiOrigin): bool
    {
        try {
            return strlen(self::rootPublicKey($apiOrigin)) === 32;
        } catch (RuntimeException) {
            return false;
        }
    }

    private static function rootPublicKey(string $apiOrigin): string
    {
        $encoded = self::BUNDLED_ROOT_PUBLIC_KEY;
        if (str_starts_with($encoded, '@@')) {
            $parts = wp_parse_url($apiOrigin);
            $host = strtolower((string) ($parts['host'] ?? ''));
            $local = Support::environmentAllowsHttp($apiOrigin)
                && in_array($host, ['localhost', '127.0.0.1', '::1'], true)
                && defined('PAGECRAFT_CONNECTOR_ALLOW_LOCAL_ROOT_OVERRIDE')
                && PAGECRAFT_CONNECTOR_ALLOW_LOCAL_ROOT_OVERRIDE === true
                && defined('PAGECRAFT_CONNECTOR_LOCAL_ROOT_PUBLIC_KEY');
            if (!$local) {
                throw new RuntimeException('This plugin build has no pinned Pagecraft root public key.');
            }
            $encoded = (string) PAGECRAFT_CONNECTOR_LOCAL_ROOT_PUBLIC_KEY;
        }
        $decoded = Support::base64UrlDecode($encoded);
        if (strlen($decoded) !== 32) {
            throw new RuntimeException('The pinned Pagecraft root public key is invalid.');
        }
        return $decoded;
    }

    private static function verify(string $signature, string $message, string $publicKey): bool
    {
        if (function_exists('sodium_crypto_sign_verify_detached')) {
            return sodium_crypto_sign_verify_detached($signature, $message, $publicKey);
        }
        if (class_exists('ParagonIE_Sodium_Compat')) {
            return \ParagonIE_Sodium_Compat::crypto_sign_verify_detached($signature, $message, $publicKey);
        }
        throw new RuntimeException('No Ed25519 verifier is available.');
    }
}
