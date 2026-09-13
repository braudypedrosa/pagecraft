import { test, expect } from 'vitest';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { publicationPreviewHtml } from '../src/publication-preview.ts';

test('opaque previews embed frozen images and fonts without exposing source or rewriting page links', async () => {
  const store = new MemoryHostedPublicationStore();
  const text = new TextEncoder();
  const publication = await store.create({ siteId:'qa',slug:'qa',host:'qa.test',sourceVersion:1,files:[
    { path:'index.html',mediaType:'text/html',bytes:text.encode('page') },
    { path:'assets/logo.svg',mediaType:'image/svg+xml',bytes:text.encode('<svg/>') },
    { path:'assets/font.woff2',mediaType:'font/woff2',bytes:Uint8Array.of(1,2) },
    { path:'assets/style.css',mediaType:'text/css',bytes:text.encode('@font-face{src:url(font.woff2)}') }
  ] });
  const html = await publicationPreviewHtml(store,publication,'index.html',
    '<link href="assets/style.css"><img src="assets/logo.svg"><a href="about.html">About</a><img src="https://external.test/image.png">');
  expect(html).toContain('src="data:image/svg+xml;base64,');
  const encoded = html.match(/href="data:text\/css;base64,([^"]+)/)![1];
  expect(Buffer.from(encoded,'base64').toString()).toContain('url(data:font/woff2;base64,');
  expect(html).toContain('href="about.html"');
  expect(html).toContain('src="https://external.test/image.png"');
});
