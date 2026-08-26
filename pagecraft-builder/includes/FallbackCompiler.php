<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class FallbackCompiler
{
    public static function content(PortablePagePackage $package): string
    {
        $html = $package->compiledHtml();
        if (preg_match_all('/<main\b/i', $html) !== 1
            || !preg_match('/<main\b[^>]*\bid=(?:"pagecraft-main"|\'pagecraft-main\')[^>]*>([\s\S]*)<\/main\s*>/i', $html, $match)) {
            throw new PackageException('The compiled Pagecraft page has no unambiguous page body.');
        }
        $body = $match[1];
        self::assertSafeMarkup($body);
        $wrapped = '<div id="pagecraft-main" class="pagecraft-main" data-pagecraft-fallback="1">'
            . $body . '</div>';
        $sanitized = wp_kses($wrapped, self::allowedHtml(), self::allowedProtocols());
        if (trim($body) !== '' && trim(strip_tags($sanitized)) === '' && !preg_match('/<(?:img|video|svg|iframe)\b/i', $sanitized)) {
            throw new PackageException('WordPress could not preserve the compiled Pagecraft page safely.');
        }
        return $sanitized;
    }

    public static function css(PortablePagePackage $package): string
    {
        $css = $package->compiledCss();
        if (preg_match(
            '/@(?:import|charset|namespace)\b|expression\s*\(|(?:^|[;{])\s*(?:behavior|-moz-binding)\s*:|<\/style|url\s*\(\s*["\']?\s*(?:javascript|data\s*:\s*text\/html)/i',
            $css
        )) {
            throw new PackageException('The compiled Pagecraft stylesheet contains an unsupported executable or parser directive.');
        }
        return $css;
    }

    private static function assertSafeMarkup(string $html): void
    {
        if (preg_match('/<(?:script|style|object|embed|base|meta|link)\b|\bon[a-z0-9_-]+\s*=|\bsrcdoc\s*=|(?:javascript|data\s*:\s*text\/html)\s*:/i', $html)) {
            throw new PackageException('The compiled Pagecraft page contains unsupported executable markup.');
        }
        if (preg_match_all('/\sstyle\s*=\s*(["\'])(.*?)\1/is', $html, $styles, PREG_SET_ORDER)) {
            foreach ($styles as $style) {
                if (preg_match('/expression\s*\(|url\s*\(|(?:^|;)\s*(?:behavior|-moz-binding)\s*:|@import/i', $style[2])) {
                    throw new PackageException('The compiled Pagecraft page contains an unsafe inline style.');
                }
            }
        }
        if (preg_match_all('/<iframe\b[^>]*\bsrc\s*=\s*(["\'])(.*?)\1/is', $html, $frames, PREG_SET_ORDER)) {
            foreach ($frames as $frame) {
                if (!preg_match('#^https://#i', html_entity_decode($frame[2], ENT_QUOTES | ENT_HTML5, 'UTF-8'))) {
                    throw new PackageException('Pagecraft iframe embeds must use an absolute HTTPS URL.');
                }
            }
        }
        if (preg_match_all('/<form\b[^>]*\baction\s*=\s*(["\'])(.*?)\1/is', $html, $forms, PREG_SET_ORDER)) {
            foreach ($forms as $form) {
                if (!preg_match('#^https://#i', html_entity_decode($form[2], ENT_QUOTES | ENT_HTML5, 'UTF-8'))) {
                    throw new PackageException('Pagecraft form actions must use an absolute HTTPS URL.');
                }
            }
        }
    }

    /** @return array<string, array<string, bool>> */
    private static function allowedHtml(): array
    {
        $global = [
            'id' => true, 'class' => true, 'title' => true, 'role' => true, 'tabindex' => true,
            'aria-*' => true, 'data-*' => true, 'hidden' => true, 'dir' => true, 'lang' => true,
            'style' => true
        ];
        $tags = [
            'div', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'span',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'b', 'i', 'u', 's', 'small',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'cite', 'pre', 'code', 'br', 'hr',
            'figure', 'figcaption', 'picture', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
            'details', 'summary'
        ];
        $allowed = [];
        foreach ($tags as $tag) {
            $allowed[$tag] = $global;
        }
        $allowed['a'] = $global + ['href' => true, 'target' => true, 'rel' => true, 'download' => true];
        $allowed['img'] = $global + [
            'src' => true, 'srcset' => true, 'sizes' => true, 'alt' => true, 'width' => true,
            'height' => true, 'loading' => true, 'decoding' => true
        ];
        $allowed['source'] = $global + ['src' => true, 'srcset' => true, 'sizes' => true, 'type' => true, 'media' => true];
        $allowed['video'] = $global + [
            'src' => true, 'poster' => true, 'width' => true, 'height' => true, 'controls' => true,
            'autoplay' => true, 'loop' => true, 'muted' => true, 'playsinline' => true, 'preload' => true
        ];
        $allowed['iframe'] = $global + [
            'src' => true, 'width' => true, 'height' => true, 'allow' => true, 'allowfullscreen' => true,
            'loading' => true, 'referrerpolicy' => true
        ];
        $allowed['button'] = $global + ['type' => true, 'name' => true, 'value' => true, 'disabled' => true];
        $allowed['form'] = $global + ['action' => true, 'method' => true, 'autocomplete' => true, 'novalidate' => true];
        $allowed['label'] = $global + ['for' => true];
        $allowed['input'] = $global + [
            'type' => true, 'name' => true, 'value' => true, 'placeholder' => true, 'required' => true,
            'checked' => true, 'disabled' => true, 'autocomplete' => true, 'accept' => true,
            'min' => true, 'max' => true, 'step' => true
        ];
        $allowed['textarea'] = $global + [
            'name' => true, 'placeholder' => true, 'required' => true, 'disabled' => true,
            'rows' => true, 'cols' => true, 'autocomplete' => true
        ];
        $allowed['select'] = $global + ['name' => true, 'required' => true, 'disabled' => true, 'multiple' => true];
        $allowed['option'] = $global + ['value' => true, 'selected' => true, 'disabled' => true];
        $allowed['svg'] = $global + [
            'xmlns' => true, 'viewbox' => true, 'width' => true, 'height' => true,
            'fill' => true, 'stroke' => true, 'focusable' => true
        ];
        $svg = $global + [
            'd' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true,
            'stroke-linecap' => true, 'stroke-linejoin' => true, 'viewbox' => true,
            'x' => true, 'y' => true, 'x1' => true, 'x2' => true, 'y1' => true, 'y2' => true,
            'cx' => true, 'cy' => true, 'r' => true, 'rx' => true, 'ry' => true,
            'points' => true, 'width' => true, 'height' => true
        ];
        foreach (['g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon'] as $tag) {
            $allowed[$tag] = $svg;
        }
        return $allowed;
    }

    /** @return list<string> */
    private static function allowedProtocols(): array
    {
        return ['http', 'https', 'mailto', 'tel'];
    }
}
