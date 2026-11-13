// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => C.blankProject('Rich text render safety'));

const unsafe = [
  'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java&#x73;cript:alert(1)',
  'java&Tab;script:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,test',
  'data:image/svg+xml,test', 'asset:test', '//untrusted.example/path',
];

test.each([true, false])('rich-text render sanitizes stored executable links in edit=%s without altering the document', edit => {
  for (const href of unsafe) {
    const html = `<p><a href="${href}" onclick="alert(1)"><strong>Workshop guide</strong></a></p>`;
    const node = C.N('text', { html });
    const output = C.renderNode(node, { edit });
    const host = document.createElement('div'); host.innerHTML = output;
    expect(host.querySelector('a')?.hasAttribute('href'), href).toBe(false);
    expect(host.querySelector('a')?.hasAttribute('onclick'), href).toBe(false);
    expect(host.querySelector('strong')?.textContent).toBe('Workshop guide');
    expect(node.props.html).toBe(html);
  }
});

test('rich-text content blocks executable tags and attributes while preserving toolbar markup and words', () => {
  const node = C.N('text', { html: '<h2>Visitor guide</h2><ul><li><b>Book</b> a <em>quiet room</em></li></ul><p><a href="/visit?day=1&amp;time=2#rooms">Visit</a><br><u>Ask us</u></p><script>alert(1)</script><img src=x onerror="alert(1)">' });
  const host = document.createElement('div'); host.innerHTML = C.renderNode(node, { edit: false });
  expect(host.querySelector('script,img,[onerror]')).toBeNull();
  expect(host.querySelector('h2')?.textContent).toBe('Visitor guide');
  expect(host.querySelector('li')?.textContent).toBe('Book a quiet room');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/visit?day=1&time=2#rooms');
  expect(host.querySelector('br')).not.toBeNull();
  expect(host.querySelector('u')?.textContent).toBe('Ask us');
});

test.each(['https://example.com/visit', 'http://example.com', 'mailto:hello@example.com', 'tel:+15550100', '#rooms', '/visit', '../visit', 'visit.html?day=1#rooms'])('toolbar and output retain safe rich-text link %s', href => {
  expect(C.safeRichUrl(href)).toBe(href);
  const host = document.createElement('div');
  host.innerHTML = C.renderNode(C.N('text', { html: `<p><a href="${href}">Visit</a></p>` }), { edit: false });
  expect(host.querySelector('a')?.getAttribute('href')).toBe(href);
});

test.each(unsafe)('toolbar rejects unsafe rich-text link %s', href => {
  expect(C.safeRichUrl(href)).toBe('');
});
