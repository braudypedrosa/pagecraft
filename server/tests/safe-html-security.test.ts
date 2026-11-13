import { test } from 'vitest';
import a from 'node:assert/strict';
import { cleanRichHtml, safeRichHtml } from '../src/safe-html.ts';

test('the production rich-text boundary rejects current sanitize-html advisory payload families', () => {
  const payloads = [
    '<div><noscript></div><a href="https://evil.test/reset">Reset</a></noscript><p>After</p>',
    '<p>Hi</p><![CDATA[ x > <noscript>]]><a href="https://evil.test/reset">Reset</a></noscript>',
    '<svg><a href="#safe"><svg:animate attributeName="href" values="#safe;javascript:alert(1)" dur=".01s" fill="freeze"/><text>Click</text></a></svg>',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)"><p>After</p>',
    '<meta http-equiv="refresh" content="0;url=data:text/html,owned"><p>After</p>',
  ];

  for (const payload of payloads) {
    a.equal(safeRichHtml(payload), false, payload);
    a.doesNotMatch(cleanRichHtml(payload), /<noscript|<svg|<[^>]*animate|<meta|javascript:|data:text\/html/i, payload);
  }
});

test('the same boundary still accepts the exact toolbar markup and safe link schemes it stores', () => {
  const allowed = '<div><p><strong>Bold</strong> <a href="https://example.test/">Link</a></p><ul><li>One</li></ul></div>';
  a.equal(cleanRichHtml(allowed), allowed);
  a.equal(safeRichHtml(allowed), true);
});
