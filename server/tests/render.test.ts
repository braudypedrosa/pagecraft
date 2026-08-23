/* The property the whole server rests on: a page served from the store is the same bytes as
   a page exported to disk. If that ever stops being true, the export contract this repo
   spent its life proving stops covering the thing people actually visit. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { renderSite, resolvePath } from '../src/render.ts';
import type { Doc } from '../../app/src/core/types.ts';

/* The demo project, not an empty one: it has a header, a footer, two pages and most of the
   widget set, so a byte-identity claim over it means something. */
const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

test('the core runs headless — no DOM, in a plain node environment', () => {
  a.equal(typeof (globalThis as { document?: unknown }).document, 'undefined',
    'this suite must not run under jsdom, or it proves nothing about a server');
  a.ok(renderSite(demo()).files.size > 0);
});

test('a served page is byte-identical to the exported one', () => {
  const doc = demo();

  /* the export path, as the builder runs it */
  Core.restore(structuredClone(doc));
  const exported = new Map<string, string>();
  for (const t of Core.exportTargets()) exported.set(t.path, Core.buildPage(t.pg, t));

  /* the server path */
  const served = renderSite(doc).files;

  for (const [path, bytes] of exported) {
    a.equal(served.get(path), bytes, `${path} differs between export and serve`);
  }
  a.ok(exported.size >= 1);
});

test('every page the document declares gets a file, and the SEO pair follows the base URL', () => {
  const doc = demo();
  const out = renderSite(doc);
  a.ok(out.files.has('index.html'));
  a.equal(out.files.has('robots.txt'), true, 'always — it is meaningful without a base URL');
  a.equal(out.files.has('sitemap.xml'), false, 'an empty sitemap claims the site has no pages');

  doc.meta.baseUrl = 'https://acme.example.com';
  const withBase = renderSite(doc).files;
  a.equal(withBase.has('sitemap.xml'), true);
  a.match(withBase.get('sitemap.xml')!, /acme\.example\.com\/index\.html/);
  a.match(withBase.get('robots.txt')!, /Sitemap: https:\/\/acme\.example\.com\/sitemap\.xml/);
});

test('two documents rendered one after the other do not leak into each other', () => {
  /* The core holds its document in a module-level `state`, so this is the failure mode that
     matters: render A, render B, and A's pages appear in B. It cannot happen while the render
     is synchronous, and this is the case that notices if it stops being. */
  const a1 = demo();
  a1.meta.name = 'Alpha';
  a1.pages[0].title = 'Alpha home';

  const b1 = demo();
  b1.meta.name = 'Beta';
  b1.pages[0].title = 'Beta home';
  b1.pages.push({ ...structuredClone(b1.pages[0]), id: 'extra', slug: 'extra', name: 'Extra', title: 'Beta extra' });

  const outA = renderSite(a1).files;
  const outB = renderSite(b1).files;
  const again = renderSite(a1).files;

  a.match(outA.get('index.html')!, /Alpha home/);
  a.equal(/Beta/.test(outA.get('index.html')!), false);
  a.match(outB.get('index.html')!, /Beta home/);
  a.equal(outB.has('extra.html'), true, 'B has a page A does not');
  a.equal(outA.has('extra.html'), false);
  a.equal(again.get('index.html'), outA.get('index.html'), 'A renders the same after B ran');
});

test('rendering does not mutate the document it was given', () => {
  const doc = demo();
  const before = JSON.stringify(doc);
  renderSite(doc);
  a.equal(JSON.stringify(doc), before, 'the store hands out documents, not scratch space');
});

test('a request path resolves the way a static host would', () => {
  a.equal(resolvePath('/'), 'index.html');
  a.equal(resolvePath(''), 'index.html');
  a.equal(resolvePath('/pricing'), 'pricing.html');
  a.equal(resolvePath('/pricing.html'), 'pricing.html');
  a.equal(resolvePath('/work/'), 'work/index.html');
  a.equal(resolvePath('/work/acme'), 'work/acme.html');
  a.equal(resolvePath('/sitemap.xml'), 'sitemap.xml');
  a.equal(resolvePath('/robots.txt'), 'robots.txt');
});

test('the review comes back with the render, so a save can report it without a second pass', () => {
  const out = renderSite(demo());
  a.ok(Array.isArray(out.findings));
  a.deepEqual(out.findings, Core.lint(), 'and it is the same review the builder shows');
});
