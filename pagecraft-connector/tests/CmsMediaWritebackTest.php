<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\CmsWriteback;
use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Crypto;
use Pagecraft\Connector\HttpClient;
use Pagecraft\Connector\ReleaseRepository;
use ReflectionMethod;

final class CmsMediaWritebackTest extends ConnectorTestCase
{
    public function test_http_client_uploads_raw_bytes_and_verifies_every_returned_binding(): void
    {
        $connection = $this->productionConnection();
        $bytes = $this->pngBytes();
        $hash = hash('sha256', $bytes);
        $captured = [];
        $GLOBALS['pagecraft_test_http_handler'] = static function (string $url, array $args) use (&$captured, $bytes, $hash): array {
            $captured = compact('url', 'args');
            return [
                'response' => ['code' => 201],
                'body' => json_encode([
                    'assetId' => 'cms-upload-one',
                    'reference' => 'asset:cms-upload-one',
                    'hash' => $hash,
                    'bytes' => strlen($bytes),
                    'mime' => 'image/png',
                    'duplicate' => false,
                ], JSON_THROW_ON_ERROR),
            ];
        };

        $result = (new HttpClient($connection))->uploadCmsAsset('draft image.jpg', 'image/png', $bytes, $hash, 'wp-media-11-unit-key');

        $this->assertIsArray($result, is_wp_error($result) ? $result->get_error_message() : '');
        $this->assertSame('asset:cms-upload-one', $result['reference']);
        $this->assertStringEndsWith('/v1/sites/site-unit/cms-assets', $captured['url']);
        $this->assertSame('POST', $captured['args']['method']);
        $this->assertSame($bytes, $captured['args']['body']);
        $this->assertSame((string) strlen($bytes), $captured['args']['headers']['Content-Length']);
        $this->assertSame($hash, $captured['args']['headers']['X-Pagecraft-Content-SHA256']);
        $this->assertSame('draft-image.jpg', $captured['args']['headers']['X-Pagecraft-Filename']);

        $GLOBALS['pagecraft_test_http_handler'] = static fn (): array => [
            'response' => ['code' => 200],
            'body' => json_encode([
                'assetId' => 'cms-upload-one', 'reference' => 'asset:cms-upload-one',
                'hash' => str_repeat('0', 64), 'bytes' => strlen($bytes), 'mime' => 'image/png', 'duplicate' => true,
            ], JSON_THROW_ON_ERROR),
        ];
        $tampered = (new HttpClient($connection))->uploadCmsAsset('draft.png', 'image/png', $bytes, $hash, 'wp-media-11-unit-key');
        $this->assertInstanceOf(\WP_Error::class, $tampered);
        $this->assertSame('pagecraft_cms_asset_response_invalid', $tampered->get_error_code());
    }

    public function test_response_loss_retries_same_asset_key_then_replaces_private_token_only_after_verified_binding(): void
    {
        $connection = $this->productionConnection();
        $attachmentId = $this->registerPngAttachment();
        $calls = [];
        $attempt = 0;
        $uploader = static function (string $filename, string $mime, string $bytes, string $hash, string $key) use (&$calls, &$attempt): array|\WP_Error {
            $calls[] = compact('filename', 'mime', 'bytes', 'hash', 'key');
            $attempt++;
            if ($attempt === 1) {
                return new \WP_Error('http_request_failed', 'Simulated response loss.');
            }
            return [
                'assetId' => 'cms-media-resolved', 'reference' => 'asset:cms-media-resolved',
                'hash' => $hash, 'bytes' => strlen($bytes), 'mime' => $mime, 'duplicate' => true,
            ];
        };
        $cms = new CmsWriteback(
            $connection,
            new HttpClient($connection),
            new ReleaseRepository(),
            null,
            static fn (): array => [],
            $uploader
        );
        $capture = new ReflectionMethod(CmsWriteback::class, 'capturePendingMedia');
        $resolve = new ReflectionMethod(CmsWriteback::class, 'resolvePendingMedia');
        $values = ['hero' => 'wp-media:' . $attachmentId];
        $media = $capture->invoke($cms, $values, true);
        $this->assertIsArray($media, is_wp_error($media) ? $media->get_error_message() : '');
        $payload = ['collectionId' => 'articles', 'values' => $values, 'media' => $media];

        $lost = $resolve->invoke($cms, $payload, 11, 'article-one');
        $this->assertInstanceOf(\WP_Error::class, $lost);
        $this->assertSame('wp-media:' . $attachmentId, $payload['values']['hero']);

        $resolved = $resolve->invoke($cms, $payload, 11, 'article-one');
        $this->assertIsArray($resolved, is_wp_error($resolved) ? $resolved->get_error_message() : '');
        $this->assertSame('asset:cms-media-resolved', $resolved['values']['hero']);
        $this->assertSame($calls[0]['key'], $calls[1]['key']);
        $this->assertMatchesRegularExpression('/^wp-media-11-[a-f0-9]{40}$/', $calls[1]['key']);
        $this->assertSame($this->pngBytes(), $calls[1]['bytes']);

        $again = $resolve->invoke($cms, $resolved, 11, 'article-one');
        $this->assertSame($resolved, $again);
        $this->assertCount(2, $calls, 'A durably resolved reference must not upload again.');
    }

    public function test_attachment_byte_change_after_queue_fails_closed(): void
    {
        $connection = $this->productionConnection();
        $attachmentId = $this->registerPngAttachment();
        $cms = new CmsWriteback($connection, new HttpClient($connection), new ReleaseRepository(), null, static fn (): array => []);
        $capture = new ReflectionMethod(CmsWriteback::class, 'capturePendingMedia');
        $resolve = new ReflectionMethod(CmsWriteback::class, 'resolvePendingMedia');
        $values = ['hero' => 'wp-media:' . $attachmentId];
        $media = $capture->invoke($cms, $values, true);
        file_put_contents((string) $GLOBALS['pagecraft_test_attachment_files'][$attachmentId], $this->pngBytes() . 'changed');

        $result = $resolve->invoke($cms, ['values' => $values, 'media' => $media], 12, 'article-one');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_cms_media_changed', $result->get_error_code());
    }

    private function productionConnection(): Connection
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_connection'] = [
            'api_origin' => 'http://localhost:8787',
            'connection_id' => 'connection-unit',
            'site_id' => 'site-unit',
            'target_origin' => 'http://localhost:8088',
            'target_path' => '/',
            'installation_id' => 'installation-unit',
            'profile' => 'existing-theme',
            'environment' => 'production',
            'access_token' => Crypto::seal('access-secret-value'),
            'refresh_token' => Crypto::seal('refresh-secret-value'),
            'access_expires_at' => time() + HOUR_IN_SECONDS,
            'scopes' => ['cms:write'],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_installation_id'] = 'installation-unit';
        $GLOBALS['pagecraft_test_options']['pagecraft_mode'] = 'connected';
        return new Connection();
    }

    private function registerPngAttachment(): int
    {
        $id = 88;
        $directory = trailingslashit((string) $GLOBALS['pagecraft_test_uploads']) . 'local-media';
        wp_mkdir_p($directory);
        $file = trailingslashit($directory) . 'draft-image.original';
        file_put_contents($file, $this->pngBytes());
        $GLOBALS['pagecraft_test_attachment_files'][$id] = $file;
        $GLOBALS['pagecraft_test_attachment_mimes'][$id] = 'image/png';
        $GLOBALS['pagecraft_test_attachment_titles'][$id] = 'Draft image';
        $GLOBALS['pagecraft_test_image_mimes'][$file] = 'image/png';
        return $id;
    }

    private function pngBytes(): string
    {
        return (string) base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
    }
}
