import { describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const gallery = (items: Array<{ src: string; alt?: string; caption?: string }>, lightbox = 1, captions = 1) =>
  C.N('gallery', { items, lightbox, captions });

describe('Gallery lightbox link labels', () => {
  test('empty and whitespace-only alt text get indexed action labels without invented image alt text', () => {
    const html = C.renderNode(gallery([
      { src: 'asset:first', alt: '' },
      { src: 'asset:second', alt: '   ' },
    ]), { edit: false });

    expect(html).toContain('data-lb="0" aria-label="Open image 1"');
    expect(html).toContain('data-lb="1" aria-label="Open image 2"');
    expect(html).toContain('src="asset:first" alt=""');
    expect(html).toContain('src="asset:second" alt="   "');
  });

  test('a trimmed caption labels the action safely even when visible captions are off', () => {
    const html = C.renderNode(gallery([
      { src: 'asset:captioned', alt: '\t', caption: '  Photo <one> & "detail"  ' },
    ], 1, 0), { edit: false });

    expect(html).toContain('aria-label="Photo &lt;one&gt; &amp; &quot;detail&quot;"');
    expect(html).toContain('alt="\t"');
    expect(html).not.toContain('<figcaption');
  });

  test('authored nonblank alt text remains the lightbox action label ahead of the caption', () => {
    const html = C.renderNode(gallery([
      { src: 'asset:authored', alt: 'Authored & label', caption: 'Caption label' },
    ]), { edit: false });

    expect(html).toContain('aria-label="Authored &amp; label"');
    expect(html).toContain('alt="Authored &amp; label"');
    expect(html).not.toContain('aria-label="Caption label"');
  });

  test('a gallery without lightbox keeps non-link frames', () => {
    const html = C.renderNode(gallery([
      { src: 'asset:plain', alt: '', caption: 'Plain caption' },
    ], 0), { edit: false });

    expect(html).toContain('<span class="pagecraft-gallery-frame"><img');
    expect(html).not.toContain('<a class="pagecraft-gallery-frame"');
    expect(html).not.toContain('aria-label=');
  });
});
