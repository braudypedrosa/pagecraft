/* The property the whole server rests on: a page served from the store is the same bytes as
   a page exported to disk. If that ever stops being true, the export contract this repo
   spent its life proving stops covering the thing people actually visit. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import {
  adopt, blankDoc, cleanPublishedUrl, hostedHtml, hostedSitemap, publicPath, renderSite, resolvePath
} from '../src/render.ts';
import type { Doc } from '../../app/src/core/types.ts';

/* The demo project, not an empty one: it has a header, a footer, two pages and most of the
   widget set, so a byte-identity claim over it means something. */
const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
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
  a.match(withBase.get('sitemap.xml')!, /<loc>https:\/\/acme\.example\.com\/<\/loc>/);
  a.equal(/\.html<\/loc>/.test(withBase.get('sitemap.xml')!), false,
    'the hosted sitemap names the canonical visitor routes');
  a.match(withBase.get('robots.txt')!, /Sitemap: https:\/\/acme\.example\.com\/sitemap\.xml/);

  Core.restore(structuredClone(doc));
  a.match(Core.sitemapXml(), /acme\.example\.com\/index\.html/,
    'the portable static export still names the files it actually writes');
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

test('a new site starts from pristine metadata after another project was rendered', () => {
  const foreign = demo();
  Object.assign(foreign.meta, {
    baseUrl: 'https://foreign.example/site',
    ogImage: 'asset:foreign-share',
    favicon: 'asset:foreign-icon',
    css: '.foreign-project{display:block}',
    headHtml: '<meta name="foreign-project" content="yes">',
    lang: 'fr',
    selfHostFonts: 1
  });
  foreign.meta.blocks = [{ id: 'foreign-block', name: 'Foreign block', node: Core.makeFor('box') }];
  foreign.meta.components = [{
    id: 'foreign-component', name: 'Foreign component', node: Core.makeFor('box'), props: []
  }];
  foreign.meta.collections = [{
    id: 'foreign-collection', name: 'Foreign collection', slug: 'foreign', detail: '',
    fields: [], items: []
  }];
  foreign.meta.tokens!.classes.push({
    id: 'foreign-class', name: 'Foreign class', css: { d: {}, t: {}, m: {} }
  });
  renderSite(foreign);

  const fresh = blankDoc('Fresh site');
  a.equal(fresh.meta.name, 'Fresh site');
  a.equal(fresh.meta.baseUrl, '');
  a.equal(fresh.meta.ogImage, '');
  a.equal(fresh.meta.favicon, '');
  a.equal(fresh.meta.css, '');
  a.equal(fresh.meta.headHtml, '');
  a.equal(fresh.meta.lang, 'en');
  a.equal(fresh.meta.selfHostFonts, undefined);
  a.deepEqual(fresh.meta.blocks, []);
  a.equal(fresh.meta.components, undefined);
  a.deepEqual(fresh.meta.collections, []);
  a.equal(fresh.meta.tokens?.classes.some(item => item.id === 'foreign-class'), false);
  a.ok((fresh.meta.tokens?.colors.length || 0) > 0, 'the default design library is still seeded');
  a.equal(fresh.pages.length, 1);
  a.equal(fresh.pages[0].slug, 'index');
  a.deepEqual(fresh.pages[0].tree, []);
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

test('hosted HTML uses clean public paths while rendered export files keep their names', () => {
  const files = new Map([
    ['index.html', '<a href="pricing.html">Price</a> <a href="index.html#work">Work</a>'],
    ['pricing.html', '<a href="index.html">Home</a>'],
    ['notes/first.html', '<a href="../pricing.html?from=note#plans">Price</a>'],
    ['download.pdf', 'pdf']
  ]);

  a.equal(publicPath('index.html', 'acme'), '/acme/');
  a.equal(publicPath('pricing.html', 'acme'), '/acme/pricing');
  a.equal(publicPath('notes/index.html', 'acme'), '/acme/notes/');
  a.equal(publicPath('pricing.html'), '/pricing');

  a.equal(
    hostedHtml(files.get('index.html')!, 'index.html', files, 'acme'),
    '<a href="/acme/pricing">Price</a> <a href="/acme/#work">Work</a>'
  );
  a.equal(
    hostedHtml(files.get('notes/first.html')!, 'notes/first.html', files, 'acme'),
    '<a href="/acme/pricing?from=note#plans">Price</a>'
  );

  const untouched = '<a href="#work">Here</a> <a href="https://other.test/page.html">Away</a> <a href="missing.html">Missing</a>';
  a.equal(hostedHtml(untouched, 'index.html', files, 'acme'), untouched);
  a.match(files.get('index.html')!, /href="pricing\.html"/, 'the downloadable export is unchanged');
});

test('hosted resources stay under the shared site path on root and nested pages', () => {
  const files = new Map([
    ['index.html', 'home'],
    ['notes/first.html', 'note']
  ]);
  const html = `<link rel="icon" href="../assets/favicon.svg">
<style>.hero{background-image:url('../assets/hero.webp?rev=2#crop')}</style>
<div style="mask-image: url(../assets/mask.svg)"></div>
<img src="../assets/photo.webp" poster="../assets/poster.webp"
 srcset="../assets/photo-480.webp 480w, ../assets/photo-960.webp 960w">`;
  const out = hostedHtml(html, 'notes/first.html', files, 'acme');
  for (const path of [
    '/acme/assets/favicon.svg', '/acme/assets/hero.webp?rev=2#crop',
    '/acme/assets/mask.svg',
    '/acme/assets/photo.webp', '/acme/assets/poster.webp',
    '/acme/assets/photo-480.webp', '/acme/assets/photo-960.webp'
  ]) a.ok(out.includes(path), path + ' was not rooted under the site');

  a.match(hostedHtml('<img src="assets/logo.webp">', 'index.html', files), /src="\/assets\/logo\.webp"/,
    'a custom-domain root also uses a root-relative asset');
});

test('hosted rewriting never interprets executable script or raw-text contents as HTML or CSS', () => {
  const files = new Map([['index.html', 'home'], ['pricing.html', 'price']]);
  const script = String.raw`<script>
const linkText = 'href="pricing.html"';
const sourcePattern = /\bsrc=(['"])(.*?)\1/gi;
const cssPattern = /url\((['"]?)(.*?)\1\)/gi;
const cssText = 'url("assets/not-a-real-request.webp")';
const notAClosingTag = '</scripture>';
</script>`;
  const textarea = `<textarea>href="pricing.html" url("assets/also-text.webp")</textarea>`;
  const comparison = `2 < 3 href="pricing.html" > 1`;
  const html = `<a href="pricing.html">Price</a>${script}${textarea}${comparison}<style>.real{background:url("assets/real.webp")}</style>`;
  const out = hostedHtml(html, 'index.html', files, 'acme');
  a.ok(out.includes(script), 'the executable script block stays byte-for-byte intact');
  a.ok(out.includes(textarea), 'raw text is not mistaken for tags or CSS');
  a.ok(out.includes(comparison), 'text containing angle brackets is not mistaken for a tag');
  a.match(out, /<a href="\/acme\/pricing">/);
  a.match(out, /\.real\{background:url\("\/acme\/assets\/real\.webp"\)\}/,
    'real style content is still normalized');
});

test('hosted SEO metadata and structured data use clean canonical URLs', () => {
  const files = new Map([
    ['index.html', 'home'],
    ['notes/first.html', 'note']
  ]);
  const html = `<link rel="canonical" href="https://example.test/base/notes/first.html">
<meta property="og:url" content="https://example.test/base/notes/first.html">
<meta property="og:image" content="../assets/share.webp">
<script type="application/ld+json">
{"@graph":[{"@type":"WebSite","url":"https://example.test/base/"},{"url":"https://example.test/base/notes/first.html","image":"../assets/article.webp","isPartOf":{"url":"https://example.test/base/index.html"},"away":"https://elsewhere.test/base/notes/first.html","sameOriginAway":"https://example.test/base/archive/notes/first.html"}]}
</script>`;
  const out = hostedHtml(html, 'notes/first.html', files, 'acme');
  a.match(out, /rel="canonical" href="https:\/\/example\.test\/base\/notes\/first"/);
  a.match(out, /property="og:url" content="https:\/\/example\.test\/base\/notes\/first"/);
  a.match(out, /property="og:image" content="\/acme\/assets\/share\.webp"/);
  const json = out.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)![1];
  const graph = JSON.parse(json);
  a.equal(graph['@graph'][1].url, 'https://example.test/base/notes/first');
  a.equal(graph['@graph'][1].image, '/acme/assets/article.webp');
  a.equal(graph['@graph'][1].isPartOf.url, 'https://example.test/base/');
  a.equal(graph['@graph'][1].away, 'https://elsewhere.test/base/notes/first.html',
    'an unrelated external URL stays authored even when its filename matches a page');
  a.equal(graph['@graph'][1].sameOriginAway, 'https://example.test/base/archive/notes/first.html',
    'a suffix match elsewhere under the same site also stays authored');
  a.equal(out.includes('/acme/../assets'), false, 'the shared prefix never keeps parent traversal');
});

test('hosted sitemap cleanup preserves query and hash while static URLs remain explicit', () => {
  const files = new Map([['index.html', 'home'], ['pricing.html', 'price']]);
  const siteBase = 'https://example.test/base/';
  a.equal(cleanPublishedUrl('https://example.test/base/index.html?from=old#top', files, siteBase),
    'https://example.test/base/?from=old#top');
  a.equal(cleanPublishedUrl('https://example.test/base/missing.html', files, siteBase),
    'https://example.test/base/missing.html');
  a.equal(cleanPublishedUrl('https://elsewhere.test/base/pricing.html', files, siteBase),
    'https://elsewhere.test/base/pricing.html', 'a matching filename on another origin is not ours');
  a.equal(cleanPublishedUrl('https://example.test/other/pricing.html', files, siteBase),
    'https://example.test/other/pricing.html', 'the same origin outside the configured base is not ours');
  a.equal(cleanPublishedUrl('https://example.test/base/archive/pricing.html', files, siteBase),
    'https://example.test/base/archive/pricing.html', 'a suffix match below another path is not a generated route');
  a.equal(cleanPublishedUrl('https://example.test/base/pricing.html', files, ''),
    'https://example.test/base/pricing.html', 'without a configured site base there is no ownership proof');
  const xml = '<urlset><url><loc>https://example.test/base/index.html</loc></url><url><loc>https://example.test/base/pricing.html</loc></url><url><loc>https://elsewhere.test/base/pricing.html</loc></url></urlset>';
  a.equal(hostedSitemap(xml, files, siteBase),
    '<urlset><url><loc>https://example.test/base/</loc></url><url><loc>https://example.test/base/pricing</loc></url><url><loc>https://elsewhere.test/base/pricing.html</loc></url></urlset>');
});

test('the review comes back with the render, so a save can report it without a second pass', () => {
  const out = renderSite(demo());
  a.ok(Array.isArray(out.findings));
  a.deepEqual(out.findings, Core.lint(), 'and it is the same review the builder shows');
});

test('manual Breadcrumb item links receive the same reserved-reference review as Nav items', () => {
  const doc = blankDoc('Breadcrumb review');
  const crumbs = Core.makeFor('crumbs');
  crumbs.props.mode = 'manual';
  crumbs.props.items = [{
    label: 'Broken native destination', href: 'pagecraft:wordpress-content:page:not-base64!'
  }, { label: 'Current', href: '' }];
  doc.pages[0].tree = [crumbs];
  const findings = renderSite(doc).findings;
  a.ok(findings.some(finding => finding.code === 'wordpress-link-invalid'
    && finding.nodeId === crumbs.id), 'the malformed reserved reference is a publish-blocking finding');
});

/* ------------------------------------------------------------------- schema */

/* The editor migrated on load from the first version. The server did not, and for as long as
   the schema never changed nobody could tell. */

test('a row written by an older editor is brought up to date before it is served', () => {
  const doc = demo() as any;
  /* v7: a button's hover was two custom properties read by a branch in the stylesheet writer */
  doc.v = 7;
  doc.schemaVersion = 7;
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
  doc.schemaVersion = Core.SCHEMA + 1;
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
