/* The property the whole server rests on: a page served from the store is the same bytes as
   a page exported to disk. If that ever stops being true, the export contract this repo
   spent its life proving stops covering the thing people actually visit. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { adopt, renderSite, resolvePath } from '../src/render.ts';
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

/* ------------------------------------------------------------------- schema */

/* The editor migrated on load from the first version. The server did not, and for as long as
   the schema never changed nobody could tell. */

test('a row written by an older editor is brought up to date before it is served', () => {
  const doc = demo() as any;
  /* v7: a button's hover was two custom properties read by a branch in the stylesheet writer */
  doc.v = 7;
  const btn = { id: 'nX', type: 'button', props: { text: 'Go' }, adv: {}, children: [],
                css: { d: { '--hover-bg': '#ff0000', '--hover-fg': '#ffffff' }, t: {}, m: {} } };
  doc.pages[0].tree.push(btn);

  const bare = renderSite(structuredClone(doc)).files.get('index.html') || '';
  a.equal(/--hover-bg:#ff0000/.test(bare), true, 'the property is still emitted...');
  a.equal(/:hover\{[^}]*background-color:#ff0000/.test(bare), false, '...and nothing reads it');

  const served = renderSite(adopt(structuredClone(doc)) as Doc).files.get('index.html') || '';
  a.match(served, /:hover\{[^}]*background-color:#ff0000/, 'adopted, the hover is a rule again');
  a.match(served, /:hover\{[^}]*border-color:#ffffff/, 'including the border that followed the text');
});

test('adopt is idempotent, which is what makes it safe on every render', () => {
  const once = adopt(demo()) as Doc;
  const twice = adopt(structuredClone(once)) as Doc;
  a.deepEqual(twice, once);
  a.equal(renderSite(twice).files.get('index.html'), renderSite(once).files.get('index.html'));
});

test('a document from a newer build is refused rather than half-understood', () => {
  const doc = demo() as any;
  doc.v = Core.SCHEMA + 1;
  a.equal(adopt(doc), null);
});

/* --------------------------------------------------- a site with a collection

   The claim is one static file per item. `renderSite` walks `exportTargets()`, so it holds by
   construction — and nothing asserted it, which means a CMS site served from here could have
   404ed on every item page without a test noticing. Built with the core rather than a fixture
   file, so it exercises the same calls the editor makes. */

/** A site with a collection, a page listing it, and a page templating one item. */
function cmsSite(): { doc: Doc; slugs: string[] } {
  Core.seed();
  Core.blankProject('Notes');
  /* `blankProject` keeps the libraries — colours, classes, blocks, components, and a
     collection's *schema*. So a second call would add a second collection called Notes, get
     the id `notes-2`, and put the detail pages somewhere this fixture is not looking. Cleared
     here rather than worked around, because the fixture wants a clean slate and the product is
     right to keep them. */
  Core.state.meta.collections = [];
  Core.state.meta.baseUrl = 'https://notes.test';

  const col = Core.collectionAdd('Notes')!;
  const title = col.fields[0].id;
  const body = Core.fieldAdd(col.id, 'Body', 'rich')!.id;
  const aside = Core.fieldAdd(col.id, 'Aside', 'text')!.id;

  const rows: [string, string, string][] = [
    ['First note', '<p>The first one.</p>', 'With an aside.'],
    ['Second note', '<p>The second one.</p>', ''],
    ['Third note', '<p>The third one.</p>', 'And another aside.']
  ];
  for (const [t, b, a2] of rows) {
    const it = Core.itemAdd(col.id)!;
    Core.itemSet(col.id, it.id, title, t);
    Core.itemSet(col.id, it.id, body, b);
    if (a2) Core.itemSet(col.id, it.id, aside, a2);
  }

  /* the index: a list repeating one card */
  const h1 = Core.insert('heading', null, 0)!;
  h1.props.text = 'Notes'; h1.props.level = 'h1'; h1.props.ts = 'display';
  const list = Core.insert('list', null, 1)!;
  list.src = col.id;
  const cardRow = Core.insert('columns', list, 0)!;
  const card = cardRow.children[0];
  Core.applyCols(cardRow, [100]);
  const cardTitle = Core.insert('heading', card, 0)!;
  cardTitle.props.level = 'h2'; cardTitle.props.ts = 'subtitle';
  Core.bindSet(cardTitle, 'text', Core.bindField(title));

  /* the detail template: one file per item, with a conditional aside */
  const det = Core.pageFromTemplate('blank', 'Note')!;
  Core.state.pages.push(det);
  det.slug = 'note';
  det.collection = col.id;
  det.title = 'A note'; det.desc = 'One note.';
  Core.state.cur = Core.state.pages.length - 1;
  const dh = Core.insert('heading', null, 0)!;
  dh.props.level = 'h1'; dh.props.ts = 'display';
  Core.bindSet(dh, 'text', Core.bindField(title));
  const dbody = Core.insert('text', null, 1)!;
  Core.bindSet(dbody, 'html', Core.bindField(body));
  const dside = Core.insert('text', null, 2)!;
  Core.bindSet(dside, 'html', Core.bindField(aside));
  Core.condSet(dside, { bind: Core.bindField(aside)!, op: 'set' });
  Core.state.cur = 0;

  const doc = structuredClone({
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  }) as Doc;
  return { doc, slugs: (doc.meta.collections || [])[0].items.map(i => i.slug) };
}

test('a collection is one served file per item, each with its own content', () => {
  const { doc, slugs } = cmsSite();
  const out = renderSite(doc);

  a.deepEqual(slugs, ['first-note', 'second-note', 'third-note']);
  for (const s of slugs) {
    a.ok(out.files.has(`notes/${s}.html`), `notes/${s}.html is served`);
  }
  a.ok(out.files.has('index.html'));
  a.ok(out.files.has('sitemap.xml'), 'and the sitemap, since a base URL is set');

  /* each detail page is about its own item, which is the whole point */
  const first = out.files.get('notes/first-note.html')!;
  a.match(first, /<h1[^>]*>First note</);
  a.equal(/Second note/.test(first), false);
  a.match(first, /The first one\./);

  /* the conditional aside: on the two items that have one, and not on the third */
  a.match(out.files.get('notes/first-note.html')!, /With an aside\./);
  a.match(out.files.get('notes/third-note.html')!, /And another aside\./);
  const second = out.files.get('notes/second-note.html')!;
  a.equal(/aside/i.test(second.slice(second.indexOf('<body'))), false,
    'an empty field means the element is not in the file at all');
});

test('a detail page asks for its assets one directory up', () => {
  /* `rel` is why: the file sits in `notes/`, so a root-relative path would only resolve from
     the root. Getting this wrong breaks every image on every detail page and nothing else. */
  const { doc } = cmsSite();
  const out = renderSite(doc);
  const detail = out.files.get('notes/first-note.html')!;
  const links = [...detail.matchAll(/(?:href|src)="([^"]*)"/g)].map(m => m[1]);
  const local = links.filter(h => !/^(https?:|mailto:|tel:|data:|#)/.test(h));
  for (const h of local) {
    a.match(h, /^\.\.\/|^[a-z0-9-]+\.html$|^[a-z0-9-]+\/[a-z0-9-]+\.html$/i,
      `${h} resolves from notes/`);
  }
});

test('a request path finds a detail page the way a static host would', () => {
  a.equal(resolvePath('/notes/first-note.html'), 'notes/first-note.html');
  a.equal(resolvePath('/notes/first-note'), 'notes/first-note.html', 'extensionless works too');
  a.equal(resolvePath('/notes/'), 'notes/index.html');
});
