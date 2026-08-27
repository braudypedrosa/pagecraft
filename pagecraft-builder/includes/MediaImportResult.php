<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

/**
 * Local WordPress ownership for every asset referenced by one portable package.
 */
final class MediaImportResult
{
    /**
     * @param array<string,array{attachmentId:int,path:string,url:string,hash:string}> $assets
     * @param list<int> $createdAttachmentIds
     */
    public function __construct(
        private array $assets,
        private array $createdAttachmentIds
    ) {
    }

    public function documentJson(string $source): string
    {
        try {
            $document = json_decode($source, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new PackageException('The Pagecraft document could not be localized: ' . $error->getMessage());
        }
        if (!is_array($document)) {
            throw new PackageException('The Pagecraft document could not be localized.');
        }
        $this->rewriteValue($document);
        return CanonicalJson::encode($document);
    }

    public function rewrite(string $source): string
    {
        foreach ($this->assets as $sourceId => $asset) {
            $source = preg_replace_callback(
                '/asset:' . preg_quote($sourceId, '/') . '(?:@\d+)?/',
                static fn (): string => $asset['url'],
                $source
            ) ?? $source;
            $source = preg_replace_callback(
                '#(?:\.\./)*/?' . preg_quote($asset['path'], '#') . '#',
                static fn (): string => $asset['url'],
                $source
            ) ?? $source;
        }
        return $source;
    }

    public function rewriteHtml(string $html): string
    {
        $html = $this->rewrite($html);
        foreach ($this->assets as $asset) {
            $url = $asset['url'];
            $attachmentId = $asset['attachmentId'];
            $html = preg_replace_callback('/<img\b[^>]*>/i', static function (array $match) use ($url, $attachmentId): string {
                $tag = $match[0];
                if (!preg_match('/\bsrc\s*=\s*(["\'])' . preg_quote($url, '/') . '\1/i', $tag)) {
                    return $tag;
                }
                if (preg_match('/\bclass\s*=\s*(["\'])(.*?)\1/i', $tag, $class)) {
                    $classes = preg_match('/(?:^|\s)wp-image-' . $attachmentId . '(?:\s|$)/', $class[2])
                        ? trim($class[2])
                        : trim($class[2] . ' wp-image-' . $attachmentId);
                    $tag = preg_replace('/\bclass\s*=\s*(["\'])(.*?)\1/i', 'class="' . esc_attr($classes) . '"', $tag, 1) ?? $tag;
                } else {
                    $tag = preg_replace('/\s*\/?>$/', ' class="wp-image-' . $attachmentId . '">', $tag, 1) ?? $tag;
                }
                $srcset = wp_get_attachment_image_srcset($attachmentId, 'full');
                if (is_string($srcset) && $srcset !== '' && !preg_match('/\bsrcset\s*=/i', $tag)) {
                    $tag = preg_replace('/\s*\/?>$/', ' srcset="' . esc_attr($srcset) . '">', $tag, 1) ?? $tag;
                }
                $sizes = wp_get_attachment_image_sizes($attachmentId, 'full');
                if (is_string($sizes) && $sizes !== '' && !preg_match('/\bsizes\s*=/i', $tag)) {
                    $tag = preg_replace('/\s*\/?>$/', ' sizes="' . esc_attr($sizes) . '">', $tag, 1) ?? $tag;
                }
                return $tag;
            }, $html) ?? $html;
        }
        return $html;
    }

    /** @return list<int> */
    public function attachmentIds(): array
    {
        return array_values(array_map(
            static fn (array $asset): int => $asset['attachmentId'],
            $this->assets
        ));
    }

    public function attachmentIdsJson(): string
    {
        return CanonicalJson::encode(array_map('strval', $this->attachmentIds()));
    }

    public function rollback(): void
    {
        foreach ($this->createdAttachmentIds as $attachmentId) {
            wp_delete_attachment($attachmentId, true);
        }
    }

    private function rewriteValue(mixed &$value): void
    {
        if (is_string($value)) {
            $value = $this->rewrite($value);
            return;
        }
        if (!is_array($value)) {
            return;
        }
        foreach ($value as &$child) {
            $this->rewriteValue($child);
        }
    }
}
