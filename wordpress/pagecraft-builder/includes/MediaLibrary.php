<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

/** Import package assets into native, content-addressed WordPress attachments. */
final class MediaLibrary
{
    public const HASH = '_pagecraft_asset_sha256';
    public const SOURCE_ID = '_pagecraft_asset_source_id';
    public const SOURCE_PATH = '_pagecraft_asset_source_path';

    public static function register(): void
    {
        add_filter('pre_delete_attachment', [self::class, 'preventReferencedDeletion'], 10, 3);
    }

    public static function preventReferencedDeletion(mixed $delete, object $post, bool $forceDelete): mixed
    {
        $attachmentId = (int) ($post->ID ?? 0);
        if ($attachmentId <= 0 || !self::isReferenced($attachmentId)) {
            return $delete;
        }
        return false;
    }

    public function import(PortablePagePackage $package): MediaImportResult
    {
        if (!current_user_can(Capabilities::IMPORT) || !current_user_can('upload_files')) {
            throw new PackageException('You are not allowed to import Pagecraft media.');
        }
        $usage = $this->usage($package->documentJson());
        $assets = [];
        $created = [];
        try {
            foreach ($package->assetRecords() as $record) {
                $metadata = $record->asset;
                $sourceId = (string) $metadata->id;
                $bytes = $package->assetBytes((string) $record->path);
                $actual = $this->inspect($bytes, (string) $record->mediaType);
                if (($metadata->width > 0 && $actual['width'] > 0 && $metadata->width !== $actual['width'])
                    || ($metadata->height > 0 && $actual['height'] > 0 && $metadata->height !== $actual['height'])) {
                    throw new PackageException('Pagecraft asset dimensions do not match the file: ' . $record->path . '.');
                }
                $attachmentId = $this->existing((string) $record->sha256);
                if ($attachmentId <= 0) {
                    $attachmentId = $this->createAttachment(
                        (string) $metadata->name,
                        (string) $record->mediaType,
                        $bytes,
                        $usage[$sourceId] ?? [],
                        (string) $record->sha256,
                        $sourceId,
                        (string) $record->path
                    );
                    $created[] = $attachmentId;
                } else {
                    $this->applyTextMetadata($attachmentId, $usage[$sourceId] ?? [], true);
                }
                $url = wp_get_attachment_url($attachmentId);
                if (!is_string($url) || $url === '') {
                    throw new PackageException('WordPress could not resolve the imported media URL.');
                }
                $assets[$sourceId] = [
                    'attachmentId' => $attachmentId,
                    'path' => (string) $record->path,
                    'url' => esc_url_raw($url),
                    'hash' => (string) $record->sha256,
                ];
            }
            return new MediaImportResult($assets, $created);
        } catch (\Throwable $error) {
            foreach ($created as $attachmentId) {
                wp_delete_attachment($attachmentId, true);
            }
            throw $error;
        }
    }

    /** @return array{width:int,height:int} */
    private function inspect(string $bytes, string $expectedType): array
    {
        $actualType = $this->sniff($bytes);
        if ($actualType !== $expectedType) {
            throw new PackageException('A Pagecraft asset does not match its declared media type.');
        }
        if ($actualType === 'image/svg+xml') {
            if (preg_match('/<script\b|\bon[a-z0-9_-]+\s*=|<foreignObject\b|(?:href|src)\s*=\s*["\']\s*(?:https?:|\/\/|data:)|url\(\s*["\']?\s*(?:https?:|\/\/|data:)/i', $bytes)) {
                throw new PackageException('Pagecraft SVG assets must be static and self-contained.');
            }
            $dimensions = ['width' => 0, 'height' => 0];
            if (preg_match('/viewBox\s*=\s*["\']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i', $bytes, $match)) {
                $dimensions = ['width' => (int) round((float) $match[1]), 'height' => (int) round((float) $match[2])];
            }
            return $dimensions;
        }
        $image = @getimagesizefromstring($bytes);
        if (!is_array($image) || (int) ($image[0] ?? 0) <= 0 || (int) ($image[1] ?? 0) <= 0) {
            throw new PackageException('A Pagecraft image is corrupt or unsupported by this WordPress host.');
        }
        return ['width' => (int) $image[0], 'height' => (int) $image[1]];
    }

    private function sniff(string $bytes): string
    {
        if (str_starts_with($bytes, "\x89PNG\r\n\x1a\n")) return 'image/png';
        if (str_starts_with($bytes, "\xff\xd8\xff")) return 'image/jpeg';
        if (str_starts_with($bytes, 'GIF87a') || str_starts_with($bytes, 'GIF89a')) return 'image/gif';
        if (substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP') return 'image/webp';
        if (substr($bytes, 4, 4) === 'ftyp' && preg_match('/^(?:avif|avis|mif1|msf1)$/', substr($bytes, 8, 4))) {
            return 'image/avif';
        }
        if (preg_match('/<svg[\s>]/i', substr($bytes, 0, 4096))) return 'image/svg+xml';
        return '';
    }

    private function existing(string $hash): int
    {
        $ids = get_posts([
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'meta_key' => self::HASH,
            'meta_value' => $hash,
        ]);
        foreach (is_array($ids) ? $ids : [] as $id) {
            $file = get_attached_file((int) $id);
            if (is_string($file) && is_file($file) && hash_file('sha256', $file) === $hash) {
                return (int) $id;
            }
        }
        return 0;
    }

    /** @param array{alt?:string,caption?:string} $usage */
    private function createAttachment(
        string $name,
        string $mediaType,
        string $bytes,
        array $usage,
        string $hash,
        string $sourceId,
        string $sourcePath
    ): int {
        $filename = sanitize_file_name($name);
        if ($filename === '') {
            throw new PackageException('A Pagecraft asset has no safe filename.');
        }
        $this->assertFilenameMatchesType($filename, $mediaType);
        $upload = wp_upload_bits($filename, null, $bytes);
        if (!is_array($upload) || !empty($upload['error']) || !is_string($upload['file'] ?? null)
            || !is_string($upload['url'] ?? null)) {
            throw new PackageException('WordPress could not store a Pagecraft asset: ' . (string) ($upload['error'] ?? 'upload failed'));
        }
        $attachmentId = wp_insert_attachment([
            'post_mime_type' => $mediaType,
            'post_title' => sanitize_text_field(pathinfo($filename, PATHINFO_FILENAME)),
            'post_excerpt' => sanitize_text_field((string) ($usage['caption'] ?? '')),
            'post_status' => 'inherit',
        ], $upload['file'], 0, true);
        if (is_wp_error($attachmentId)) {
            @unlink($upload['file']);
            throw new PackageException('WordPress could not register a Pagecraft asset: ' . $attachmentId->get_error_message());
        }
        $attachmentId = (int) $attachmentId;
        if (!function_exists('wp_generate_attachment_metadata')) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }
        $generated = wp_generate_attachment_metadata($attachmentId, $upload['file']);
        if (is_array($generated) && $generated !== []) {
            wp_update_attachment_metadata($attachmentId, $generated);
        }
        update_post_meta($attachmentId, self::HASH, $hash);
        update_post_meta($attachmentId, self::SOURCE_ID, $sourceId);
        update_post_meta($attachmentId, self::SOURCE_PATH, $sourcePath);
        $this->applyTextMetadata($attachmentId, $usage);
        return $attachmentId;
    }

    private function assertFilenameMatchesType(string $filename, string $mediaType): void
    {
        $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
        $allowed = [
            'image/png' => ['png'],
            'image/jpeg' => ['jpg', 'jpeg'],
            'image/gif' => ['gif'],
            'image/webp' => ['webp'],
            'image/avif' => ['avif'],
            'image/svg+xml' => ['svg'],
        ];
        if (!isset($allowed[$mediaType]) || !in_array($extension, $allowed[$mediaType], true)) {
            throw new PackageException('A Pagecraft asset filename does not match its verified media type: ' . $filename . '.');
        }
    }

    /** @param array{alt?:string,caption?:string} $usage */
    private function applyTextMetadata(int $attachmentId, array $usage, bool $onlyMissing = false): void
    {
        $alt = sanitize_text_field((string) ($usage['alt'] ?? ''));
        if ($alt !== '' && (!$onlyMissing || get_post_meta($attachmentId, '_wp_attachment_image_alt', true) === '')) {
            update_post_meta($attachmentId, '_wp_attachment_image_alt', $alt);
        }
        $caption = sanitize_text_field((string) ($usage['caption'] ?? ''));
        $attachment = $onlyMissing ? get_post($attachmentId) : null;
        if ($caption !== '' && (!$onlyMissing || !is_object($attachment) || (string) ($attachment->post_excerpt ?? '') === '')) {
            wp_update_post(['ID' => $attachmentId, 'post_excerpt' => $caption]);
        }
    }

    /** @return array<string,array{alt?:string,caption?:string}> */
    private function usage(string $documentJson): array
    {
        $document = json_decode($documentJson, true);
        $usage = [];
        $visit = function (mixed $value) use (&$visit, &$usage): void {
            if (!is_array($value)) return;
            $source = is_string($value['src'] ?? null) ? $value['src'] : '';
            if (preg_match('/^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)/', $source, $match)) {
                $id = $match[1];
                $usage[$id] ??= [];
                foreach (['alt', 'caption'] as $field) {
                    $text = trim((string) ($value[$field] ?? ''));
                    if ($text !== '' && empty($usage[$id][$field])) $usage[$id][$field] = $text;
                }
            }
            foreach ($value as $child) $visit($child);
        };
        $visit($document);
        return $usage;
    }

    private static function isReferenced(int $attachmentId): bool
    {
        $needle = '"' . $attachmentId . '"';
        $ids = get_posts([
            'post_type' => ['page', GlobalElement::POST_TYPE, 'revision'],
            'post_status' => 'any',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'meta_query' => [[
                'key' => ManagedPage::MEDIA_ATTACHMENTS,
                'value' => $needle,
                'compare' => 'LIKE',
            ]],
        ]);
        foreach (is_array($ids) ? $ids : [] as $postId) {
            $encoded = get_post_meta((int) $postId, ManagedPage::MEDIA_ATTACHMENTS, true);
            $references = is_string($encoded) ? json_decode($encoded, true) : null;
            if (is_array($references) && in_array((string) $attachmentId, $references, true)) return true;
        }
        return false;
    }
}
