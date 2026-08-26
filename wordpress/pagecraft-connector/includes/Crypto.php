<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

use RuntimeException;

final class Crypto
{
    public static function seal(string $plaintext): string
    {
        $key = self::key();
        if (function_exists('sodium_crypto_secretbox')) {
            $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
            $ciphertext = sodium_crypto_secretbox($plaintext, $nonce, $key);
            return 'v1.' . Support::base64UrlEncode($nonce) . '.' . Support::base64UrlEncode($ciphertext);
        }

        if (function_exists('openssl_encrypt')) {
            $nonce = random_bytes(12);
            $tag = '';
            $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, 'pagecraft-connector-v1');
            if (!is_string($ciphertext)) {
                throw new RuntimeException('Could not encrypt Pagecraft credentials.');
            }
            return 'v2.' . Support::base64UrlEncode($nonce) . '.' . Support::base64UrlEncode($tag . $ciphertext);
        }

        throw new RuntimeException('Pagecraft Connector requires Sodium or OpenSSL.');
    }

    public static function open(string $sealed): string
    {
        $parts = explode('.', $sealed, 3);
        if (count($parts) !== 3) {
            throw new RuntimeException('Stored Pagecraft credential is malformed.');
        }
        [$version, $nonceEncoded, $payloadEncoded] = $parts;
        $nonce = Support::base64UrlDecode($nonceEncoded);
        $payload = Support::base64UrlDecode($payloadEncoded);
        $key = self::key();

        if ($version === 'v1' && function_exists('sodium_crypto_secretbox_open')) {
            $plaintext = sodium_crypto_secretbox_open($payload, $nonce, $key);
            if (!is_string($plaintext)) {
                throw new RuntimeException('Stored Pagecraft credential could not be decrypted.');
            }
            return $plaintext;
        }

        if ($version === 'v2' && function_exists('openssl_decrypt') && strlen($payload) >= 16) {
            $tag = substr($payload, 0, 16);
            $ciphertext = substr($payload, 16);
            $plaintext = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, 'pagecraft-connector-v1');
            if (!is_string($plaintext)) {
                throw new RuntimeException('Stored Pagecraft credential could not be decrypted.');
            }
            return $plaintext;
        }

        throw new RuntimeException('Stored Pagecraft credential uses an unavailable cipher.');
    }

    private static function key(): string
    {
        $material = function_exists('wp_salt') ? wp_salt('secure_auth') : (defined('AUTH_KEY') ? (string) AUTH_KEY : '');
        if ($material === '') {
            throw new RuntimeException('WordPress salts are required to protect Pagecraft credentials.');
        }
        return hash_hkdf('sha256', $material, 32, 'pagecraft-connector-credential-v1');
    }
}
