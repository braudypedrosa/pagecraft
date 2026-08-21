/* Tests run against app/src/core/index.ts — the TypeScript core, which is now the
   source of truth. build.mjs compiles it back into the legacy single-file build, so
   this still exercises shipped code rather than a copy of it.
   Every assertion below is unchanged from the node:test version; only the three
   import lines moved. That is what makes the port verifiable rather than hopeful. */
import { test, beforeEach } from 'vitest';
import a from 'node:assert/strict';
import * as C from '../app/src/core/index';
import type { Node as PcNode, Handle, Bp, Finding, ColorToken, TextStyle, Field, Item, GalleryTile } from '../app/src/core/types';

/* The core's finders return `T | null` because in the running app a stale id is a
   real possibility worth handling. In a test the id always comes from something the
   test just made, so a null is a broken fixture rather than a case to cover. These
   say that once instead of two hundred `!`s, and they throw naming what was missing —
   a broken fixture then fails as "no node abc" rather than as a TypeError three
   assertions further down. */
function must<T>(x: T | null | undefined, what: string): T {
  if (x == null) throw new Error(`test fixture: no ${what}`);
  return x;
}
const at = (id: string): Handle => must(C.locate(id), `node ${id}`);
const color = (id: string) => must(C.findColor(id), `colour ${id}`);
const style = (id: string) => must(C.findStyle(id), `text style ${id}`);
const klass = (id: string) => must(C.findClass(id), `class ${id}`);
/* `Handle.parent` is null for a level-1 node, which is correct — but a test asking
   for the parent has just put the node inside something. */
const holderOf = (id: string) => must(at(id).parent, `parent of ${id}`);
/* A repeater's rows, typed. `items` is gallery tiles on a gallery, links on a nav and
   questions on an accordion, so a test that just built one says which it has — the same
   cast the core makes inside its own branch. */
const rowsOf = <T,>(n: PcNode): T[] => must(n.props.items, 'items rows') as T[];
/* These core calls return null when the operation is refused — a real outcome the
   app handles and a few tests below assert. A test that goes on to *use* the result
   is asserting it succeeded, so it says so here once rather than at every property
   access. The parameter lists come from the core, so they cannot drift out of step.
   The tests that check a refusal call C.* directly, and are the reason these are
   wrappers rather than a change to the core's return types. */
const insert = (...a: Parameters<typeof C.insert>) => must(C.insert(...a), 'insert');
const paste = (...a: Parameters<typeof C.pasteNode>) => must(C.pasteNode(...a), 'pasteNode');
const blockInsert = (...a: Parameters<typeof C.blockInsert>) => must(C.blockInsert(...a), 'blockInsert');
const itemAdd = (...a: Parameters<typeof C.itemAdd>) => must(C.itemAdd(...a), 'itemAdd');
const collectionAdd = (...a: Parameters<typeof C.collectionAdd>) => must(C.collectionAdd(...a), 'collectionAdd');
const pageFromTemplate = (...a: Parameters<typeof C.pageFromTemplate>) => must(C.pageFromTemplate(...a), 'pageFromTemplate');
const patternInsert = (...a: Parameters<typeof C.patternInsert>) => must(C.patternInsert(...a), 'patternInsert');
const resizeCols = (...a: Parameters<typeof C.resizeCols>) => must(C.resizeCols(...a), 'resizeCols');
const layerTarget = (...a: Parameters<typeof C.layerTarget>) => must(C.layerTarget(...a), 'layerTarget');
const bindScope = (...a: Parameters<typeof C.bindScope>) => must(C.bindScope(...a), 'bindScope');
const coll = (...a: Parameters<typeof C.findCollection>) => must(C.findCollection(...a), 'findCollection');
const block = (...a: Parameters<typeof C.findBlock>) => must(C.findBlock(...a), 'findBlock');
const blockSave = (...a: Parameters<typeof C.blockSave>) => must(C.blockSave(...a), 'blockSave');
const pageMove = (...a: Parameters<typeof C.pageMove>) => must(C.pageMove(...a), 'pageMove');

const fresh = () => {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.hist.u.length = 0; C.hist.r.length = 0;
};
const blank = () => {
  fresh();
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  C.ensureTokens().classes = [];
  /* seed() leaves project-level libraries alone — blocks and collections are
     assets, not page content — so a test that wants a clean slate says so */
  C.state.meta.blocks = [];
  C.state.meta.collections = [];
  /* Cleared because it changes what every page emits — a canonical tag and a JSON-LD script
     appear only once one is set. Two tests have now set it and leaked it into suites that
     assert those are absent, and the second time was me repeating the first. A test that
     needs one sets it; nothing should inherit one. */
  C.state.meta.baseUrl = '';
  C.state.meta.headHtml = '';
};
const types = (l: PcNode[]) => l.map(n => n.type);
/* the two media blocks, either of which may be absent when nothing overrides */
const blocks = (css: string) => {
  const t = css.indexOf(C.MQ.t), m = css.indexOf(C.MQ.m);
  return {
    base: css.slice(0, t < 0 ? (m < 0 ? undefined : m) : t),
    tablet: t < 0 ? '' : css.slice(t, m < 0 ? undefined : m),
    mobile: m < 0 ? '' : css.slice(m)
  };
};
const count = (list: PcNode[], type: string) => { let n = 0; C.eachNode(list, x => { if (x.type === type) n++; }); return n; };

beforeEach(fresh);

/* ------------------------------------------------------------- hierarchy */
test('holds() encodes the Section > Row > Column > content hierarchy', () => {
  a.equal(C.holds('section', 'row'), true);
  a.equal(C.holds('row', 'column'), true);
  a.equal(C.holds('column', 'heading'), true);
  a.equal(C.holds('column', 'row'), true, 'a row may nest inside a column');
  a.equal(C.holds('row', 'section'), false);
  a.equal(C.holds('column', 'column'), false);
  a.equal(C.holds('heading', 'button'), false, 'leaves hold nothing');
});

test('dropping a leaf at the root builds the missing wrappers', () => {
  blank();
  const leaf = insert('heading', null, 0);
  const t = C.state.pages[0].tree;
  a.equal(t.length, 1);
  a.equal(t[0].type, 'section');
  a.equal(t[0].children[0].type, 'row');
  a.equal(t[0].children[0].children[0].type, 'column');
  a.equal(t[0].children[0].children[0].children[0].id, leaf.id);
});

test('a row dropped in a column nests instead of wrapping', () => {
  blank();
  insert('heading', null, 0);
  const col = C.state.pages[0].tree[0].children[0].children[0];
  insert('row', col, 1);
  a.deepEqual(types(col.children), ['heading', 'row']);
});

test('changing the column count expands and contracts without losing content', () => {
  blank();
  const row = C.makeFor('columns');
  C.state.pages[0].tree.push(C.N('section', {}, {}, [row]));
  a.equal(row.children.length, C.DEFAULT_COLS, 'a Columns drop starts at the default count');
  C.applyCols(row, C.LAYOUTS[3][0]);
  row.children.forEach((c, i) => c.children.push(C.N('heading', { text: 'c' + i })));

  C.applyCols(row, C.LAYOUTS[4][0]);
  a.equal(row.children.length, 4);
  a.deepEqual(row.children.map(c => c.css.d['flex-grow']), ['25', '25', '25', '25']);

  C.applyCols(row, C.LAYOUTS[2][0]);
  a.equal(row.children.length, 2);
  a.equal(count([row], 'heading'), 3, 'no content is destroyed when columns are removed');
  a.equal(row.children[1].children.length, 2, 'orphans move into the last surviving column');
  a.deepEqual(row.children.map(c => c.css.d['flex-grow']), ['50', '50']);

  C.applyCols(row, C.LAYOUTS[2][1]);
  a.deepEqual(row.children.map(c => c.css.d['flex-grow']), ['66.6666', '33.3333'], 'an asymmetric split');
});

test('every layout adds up to a full row and matches its own count', () => {
  C.COUNTS.forEach(k => {
    a.ok(C.LAYOUTS[k as keyof typeof C.LAYOUTS].length, k + ' has at least one layout');
    C.LAYOUTS[k as keyof typeof C.LAYOUTS].forEach((l: number[]) => {
      a.equal(l.length, k, 'a ' + k + '-column layout lists ' + k + ' widths');
      a.ok(Math.abs(l.reduce((t, w) => t + w, 0) - 100) < 0.51, l.join('/') + ' sums to 100');
    });
  });
});

test('matchLayout identifies the active split, or none after a manual tweak', () => {
  blank();
  const row = C.makeFor('columns');
  C.applyCols(row, C.LAYOUTS[3][1]);
  a.equal(C.matchLayout(row), 1);
  C.applyCols(row, C.LAYOUTS[3][0]);
  a.equal(C.matchLayout(row), 0);
  row.children[0].css.d['flex-grow'] = '41.7';
  a.equal(C.matchLayout(row), null, 'a hand-set width matches no preset');
  a.deepEqual(C.rowRatios(row).map(Math.round), [42, 33, 33]);
});

test('Columns drops as a row, and nests inside a column', () => {
  blank();
  insert('columns', null, 0);
  const sec = C.state.pages[0].tree[0];
  a.equal(sec.type, 'section');
  a.equal(sec.children[0].type, 'row', 'a Columns drop at the root gets a section wrapper');
  a.equal(sec.children[0].children.length, C.DEFAULT_COLS);
  a.equal(C.holds('column', 'columns'), true, 'and may nest inside a column');
  const col = sec.children[0].children[0];
  insert('columns', col, 0);
  a.equal(col.children[0].type, 'row');
});

/* ------------------------------------------------------- tree operations */
test('moveNode refuses to nest a node inside itself', () => {
  blank();
  insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  const col = sec.children[0].children[0];
  C.moveNode(sec.id, col, 0);
  a.equal(C.state.pages[0].tree.length, 1);
  a.equal(C.state.pages[0].tree[0].id, sec.id, 'the tree is untouched');
});

test('duplicate assigns fresh ids to every descendant', () => {
  blank();
  insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  const before: string[] = [];
  C.eachNode([sec], n => before.push(n.id));
  C.dupNode(sec.id);
  const copy = C.state.pages[0].tree[1];
  const after: string[] = [];
  C.eachNode([copy], n => after.push(n.id));
  a.equal(after.length, before.length);
  a.equal(after.some(id => before.includes(id)), false, 'no id is reused');
  a.equal(C.state.ui.sel, copy.id);
});

test('delete selects the parent so focus never disappears', () => {
  blank();
  const leaf = insert('heading', null, 0);
  const col = holderOf(leaf.id);
  C.state.ui.sel = leaf.id;
  C.delNode(leaf.id);
  a.equal(C.state.ui.sel, col.id);
  a.equal(C.locate(leaf.id), null);
});

test('locate finds nodes at any depth and returns their position', () => {
  const deep = C.state.pages[0].tree[0].children[0].children[0].children[0];
  const hit = at(deep.id);
  a.equal(hit.node.id, deep.id);
  a.equal(hit.i, 0);
  a.equal(must(hit.parent, 'parent').type, 'column');
});

/* ------------------------------------------------------------- history */
test('undo and redo round-trip an edit', () => {
  blank();
  C.edit(() => insert('heading', null, 0));
  a.equal(C.state.pages[0].tree.length, 1);
  C.undo();
  a.equal(C.state.pages[0].tree.length, 0);
  C.redo();
  a.equal(C.state.pages[0].tree.length, 1);
});

test('a new edit clears the redo stack', () => {
  blank();
  C.edit(() => insert('heading', null, 0));
  C.undo();
  a.equal(C.hist.r.length, 1);
  C.edit(() => insert('button', null, 0));
  a.equal(C.hist.r.length, 0);
});

/* ------------------------------------------------------------ migration */
test('migrate stamps old projects and refuses newer ones', () => {
  a.equal(C.migrate({ pages: [{ tree: [] }] }).v, C.SCHEMA, 'unversioned v1 is adopted');
  a.equal(C.migrate({ v: C.SCHEMA + 1, pages: [{ tree: [] }] }), null, 'newer schema is refused');
  a.equal(C.migrate({ pages: [] }), null);
  a.equal(C.migrate(null), null);
  a.equal(C.migrate({ nope: 1 }), null);
});

/* ------------------------------------------------ responsive stylesheet */
test('breakpoint overrides land in the matching media query only', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d = { 'font-size': '40px' };
  h.css.t = { 'font-size': '30px' };
  h.css.m = { 'font-size': '20px' };
  const css = C.treeCss([C.state.pages[0].tree], false);
  const { base, tablet, mobile } = blocks(css);
  a.match(base, /font-size:40px/);
  a.match(tablet, /font-size:30px/);
  a.match(mobile, /font-size:20px/);
  a.equal(/font-size:20px/.test(tablet), false);
  /* Two *breakpoint* blocks is the invariant — the stylesheet also closes with a
     prefers-reduced-motion block, which is not a breakpoint and must not be
     counted as one. Counting bare `@media` conflated the two. */
  a.equal((css.match(/@media \(max-width/g) || []).length, 2, 'exactly one media block per breakpoint');
  a.equal(css.indexOf(C.MQ.t) < css.indexOf(C.MQ.m), true, 'tablet before mobile');
});

test('hidden elements are removed on export but only ghosted while editing', () => {
  blank();
  const h = insert('heading', null, 0);
  h.hide = { m: true };
  a.match(C.treeCss([C.state.pages[0].tree], false), /display:none !important/);
  const editing = C.treeCss([C.state.pages[0].tree], true);
  a.equal(/display:none !important/.test(editing), false);
  a.match(editing, /opacity:\.32/);
});

test('custom CSS substitutes & for the element selector', () => {
  blank();
  const h = insert('heading', null, 0);
  h.adv.css = '& { outline: 2px solid red } &:hover { opacity: .5 }';
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, new RegExp('\\.' + C.nodeClass(h) + ' \\{ outline: 2px solid red \\}'));
  a.match(css, new RegExp('\\.' + C.nodeClass(h) + ':hover'));
});

test('button hover colours become a :hover rule', () => {
  blank();
  const b = insert('button', null, 0);
  b.css.d['--hover-bg'] = '#ff0000';
  a.match(C.treeCss([C.state.pages[0].tree], false), new RegExp('\\.' + C.nodeClass(b) + ':hover\\{background-color:#ff0000'));
});

/* --------------------------------------------------------------- markup */
test('author text is escaped, never injected', () => {
  blank();
  const h = insert('heading', null, 0);
  h.props.text = '<script>alert(1)</script>';
  const html = C.renderNode(h, { edit: false });
  a.equal(html.includes('<script>'), false);
  a.match(html, /&lt;script&gt;/);
});

test('element tags come from a whitelist', () => {
  blank();
  const h = insert('heading', null, 0);
  h.props.level = 'script';
  a.match(C.renderNode(h, { edit: false }), /^<h2 /, 'an unknown heading level falls back to h2');

  const sec = C.state.pages[0].tree[0];
  sec.props.tag = 'script';
  a.match(C.renderNode(sec, { edit: false }), /^<section /, 'an unknown section tag falls back to section');
  sec.props.tag = 'header';
  a.match(C.renderNode(sec, { edit: false }), /^<header /, 'a whitelisted tag is honoured');
});

test('safeUrl passes real links and drops script schemes', () => {
  ['https://x.com/a', 'pricing.html', '#contact', '/index.html', './a.html', 'mailto:a@b.c', 'tel:+1', 'example.com/x']
    .forEach(u => a.equal(C.safeUrl(u), u, u + ' should be allowed'));
  ['javascript:alert(1)', 'JavaScript:alert(1)', 'vbscript:x', 'data:text/html,<script>', ' javascript:alert(1)']
    .forEach(u => a.equal(C.safeUrl(u), '', u + ' should be blocked'));
});

test('a blocked href renders no link at all', () => {
  blank();
  const b = insert('button', null, 0);
  b.props.link = 'javascript:alert(1)';
  const html = C.renderNode(b, { edit: false });
  a.equal(/javascript:/i.test(html), false);
  a.match(html, /^<button /, 'it degrades to a plain button');
});

test('video URLs resolve to the right embed', () => {
  a.match(C.vid({ src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }), /youtube\.com\/embed\/aqz-KE-bpKQ/);
  a.match(C.vid({ src: 'https://youtu.be/aqz-KE-bpKQ' }), /youtube\.com\/embed\/aqz-KE-bpKQ/);
  a.match(C.vid({ src: 'https://vimeo.com/123456' }), /player\.vimeo\.com\/video\/123456/);
  a.match(C.vid({ src: 'https://cdn.example.com/clip.mp4', controls: 1 }), /^<video src="https:\/\/cdn\.example\.com\/clip\.mp4" controls/);
  a.match(C.vid({ src: '' }), /Add a video URL/);
});

/* ---- the not-found page, and per-page head ------------------------------ */

test('a page slugged 404 exports as 404.html and behaves like a not-found page', () => {
  blank();
  const pg = C.state.pages[0];
  C.state.meta.baseUrl = 'https://example.com';

  pg.slug = 'index';
  a.equal(C.isNotFound(pg), false);
  a.match(C.buildPage(pg), /rel="canonical" href="https:\/\/example\.com\/index\.html"/);
  a.equal(/name="robots"/.test(C.buildPage(pg)), false);
  a.match(C.sitemapXml(), /index\.html/);

  pg.slug = C.NOT_FOUND;
  a.equal(C.isNotFound(pg), true);
  a.equal(must(C.exportTargets().find(t => t.pg === pg), 'target').path, '404.html');
  /* not a destination: no canonical, and it asks not to be indexed */
  a.equal(/rel="canonical"/.test(C.buildPage(pg)), false);
  a.match(C.buildPage(pg), /<meta name="robots" content="noindex">/);
  /* and offering a crawler a list with the error page on it invites it to index the error page */
  a.equal(/404\.html/.test(C.sitemapXml()), false);
});

test('a page carries its own head block, after the project-wide one', () => {
  blank();
  const pg = C.state.pages[0];
  C.state.meta.headHtml = '<meta name="site" content="yes">';
  pg.headHtml = '<meta name="page" content="also">';
  const html = C.buildPage(pg);
  a.match(html, /content="yes"/);
  a.match(html, /content="also"/);
  a.ok(html.indexOf('content="yes"') < html.indexOf('content="also"'), 'project first, page second');
  a.ok(html.indexOf('content="also"') < html.indexOf('</head>'), 'and both inside the head');

  /* a page with none adds nothing */
  pg.headHtml = '';
  a.equal(/content="also"/.test(C.buildPage(pg)), false);
  C.state.meta.headHtml = '';
});

/* ---- the export carries no comments ------------------------------------
   Convention 7 in CONTEXT.md, and I put a comment in the quote widget's rules that would have
   shipped in every exported page. The editor-only tail is a different matter and keeps its
   seven: it styles the canvas and never reaches a customer, which is why this asks
   `baseCss(false)` rather than both. A convention that relies on remembering it is a
   convention with a test missing. */

test('the exported stylesheet carries no comments', () => {
  const css = C.baseCss(false);
  a.equal(css.includes('/*'), false, 'baseCss(false) ships a comment');
  a.equal(css.includes('*/'), false);
  /* the editor half is allowed them, and has them — asserting otherwise would be asserting
     the wrong contract, and would fail the day someone documents a canvas rule */
  a.ok(C.baseCss(true).includes('/*'), 'the canvas half is exempt, and uses that');

  /* and no comment reaches the page by way of a node's own rules, a text style or a class */
  fresh();
  const page = C.buildPage(C.state.pages[0]);
  const style = must(page.match(/<style>([\s\S]*?)<\/style>/), 'the stylesheet')[1];
  a.equal(style.includes('/*'), false, 'a built page ships a comment');
  a.ok(style.length > 2000, 'and there was a real stylesheet to check');
});

/* ---- moving to the ends -------------------------------------------------
   `nudge` walks one step. This is the end of that walk, which is what is wanted when a
   section belongs at the top of a page and is currently seventh. Uses the `fourSections`
   fixture declared with the move-a-set tests below — it labels them a to d, which reads. */

test('a section moves to the top and to the bottom of its own list', () => {
  const { t, order } = fourSections();
  const c = t[2].id;
  a.deepEqual(order(), ['a', 'b', 'c', 'd']);

  a.equal(C.atEdge([c], -1), false, 'there is somewhere to go');
  a.ok(C.sendEdge([c], -1));
  a.deepEqual(order(), ['c', 'a', 'b', 'd']);

  a.ok(C.sendEdge([c], 1));
  a.deepEqual(order(), ['a', 'b', 'd', 'c'], 'and all the way back down');
});

test('already flush is a no-op, and the tree is untouched', () => {
  const { t, order } = fourSections();
  a.equal(C.atEdge([t[0].id], -1), true, 'a is already at the top');
  a.equal(C.sendEdge([t[0].id], -1), false);
  a.deepEqual(order(), ['a', 'b', 'c', 'd']);

  a.equal(C.atEdge([t[3].id], 1), true, 'and d at the bottom');
  a.equal(C.sendEdge([t[3].id], 1), false);
  a.deepEqual(order(), ['a', 'b', 'c', 'd']);

  /* the other direction is still available from either end */
  a.equal(C.atEdge([t[0].id], 1), false);
  a.equal(C.atEdge([t[3].id], -1), false);
});

test('a set moves to an end together and keeps its document order', () => {
  const { t, order } = fourSections();
  const pair = [t[1].id, t[3].id];                      // b and d

  a.ok(C.sendEdge(pair, -1));
  a.deepEqual(order(), ['b', 'd', 'a', 'c'], 'both to the top, in order');

  a.ok(C.sendEdge(pair, 1));
  a.deepEqual(order(), ['a', 'c', 'b', 'd'], 'both to the bottom, in order');

  a.equal(C.atEdge(pair, 1), true, 'a set already flush is flush');
  a.equal(C.sendEdge(pair, 1), false);
});

test('a selection spanning two lists has no single answer, so it does nothing', () => {
  const { t, order } = fourSections();
  /* one heading from section a, one from section b: different columns, different lists */
  const pick = (sec: PcNode): PcNode => {
    const found: PcNode[] = [];
    C.eachNode([sec], x => { if (!found.length && x.type === 'heading') found.push(x); });
    return must(found[0], 'heading');
  };
  const h1 = pick(t[0]), h2 = pick(t[1]);
  a.notEqual(holderOf(h1.id).id, holderOf(h2.id).id);

  const before = JSON.stringify(C.state.pages[0].tree);
  a.equal(C.atEdge([h1.id, h2.id], -1), true, 'nothing to do rather than something arbitrary');
  a.equal(C.sendEdge([h1.id, h2.id], -1), false);
  a.equal(JSON.stringify(C.state.pages[0].tree), before);
  a.deepEqual(order(), ['a', 'b', 'c', 'd']);
});

test('a lone child has no list to be at the end of', () => {
  blank();
  const h = insert('heading', null, 0);
  a.equal(holderOf(h.id).children.length, 1);
  [-1, 1].forEach(dir => {
    a.equal(C.atEdge([h.id], dir), true);
    a.equal(C.sendEdge([h.id], dir), false);
  });
});

test('the menu offers both ends only where there is a list, and names the keys', () => {
  const { t } = fourSections();
  const acts = (id: string) => C.menuFor([id]).map(m => m.act);
  a.ok(acts(t[1].id).includes('first'));
  a.ok(acts(t[1].id).includes('last'));
  const menu = C.menuFor([t[1].id]);
  a.equal(must(menu.find(x => x.act === 'first'), 'first').key, '⌘⇧↑');
  a.equal(must(menu.find(x => x.act === 'last'), 'last').key, '⌘⇧↓');

  blank();
  const lone = insert('heading', null, 0);
  a.equal(acts(lone.id).includes('first'), false, 'not offered with nowhere to go');
  a.equal(acts(lone.id).includes('last'), false);
});

test('Save as a block is offered in the menu and not on the bar', () => {
  /* It is something you do once to an element you have finished, where everything else on the
     bar is something you do while working — and the bar had reached nine buttons. The plus it
     used to wear was misleading on top of that: a plus reads as "add one of these", and this
     takes what is selected and keeps it for reuse. */
  const { t } = fourSections();
  a.ok(C.menuFor([t[1].id]).some(m => m.act === 'block'), 'the menu still offers it');
  /* the glyph it briefly had is gone with the button, since the menu draws labels not icons */
  a.equal(C.IC.save, undefined);
  a.ok(C.IC.toTop && C.IC.toBottom, 'the two that are on the bar have theirs');
  [C.IC.toTop, C.IC.toBottom].forEach(d => {
    a.equal(/fill="(?!none)/.test(d), false, 'stroke only, like every other icon');
    a.match(d, /^<path /);
  });
});

/* ---- content back in ---------------------------------------------------
   `contentJson` went out and nothing came back, so export-edit-reimport had no second half.
   An upsert, never a delete: a file holding part of the content must not be able to remove
   the rest. */

test('a content.json round-trips: export, import, nothing changed and nothing lost', () => {
  const { col, fields, add } = cmsFixture();
  add('On craft', 'Journal', '1');
  add('Field notes', 'Notes', '2');
  const before = C.contentJson();

  const rep = must(C.contentImport(JSON.parse(before)), 'report');
  a.deepEqual(rep.collections, { added: 0, matched: 1 }, 'matched by id, not duplicated');
  a.deepEqual(rep.fields, { added: 0 });
  a.deepEqual(rep.items, { added: 0, updated: 2 });
  a.deepEqual(rep.notes, []);
  a.equal(C.collections().length, 1, 'no second Journal');
  a.equal(col.items.length, 2);
  a.equal(C.contentJson(), before, 'and the data is byte-identical');
  a.ok(fields.title);
});

test('an edited file updates by id and adds what is new', () => {
  const { col, fields, add } = cmsFixture();
  const one = add('Old title', 'Journal', '1');
  const file = JSON.parse(C.contentJson());

  file.collections[0].items[0].values[fields.title] = 'New title';
  file.collections[0].items.push({ id: 'brand-new', slug: 'brand-new', values: { [fields.title]: 'Fresh' } });

  const rep = must(C.contentImport(file), 'report');
  a.deepEqual(rep.items, { added: 1, updated: 1 });
  a.equal(one.values[fields.title], 'New title', 'the existing item was edited in place');
  a.equal(col.items.length, 2);
  a.equal(col.items[1].values[fields.title], 'Fresh');
});

test('import never deletes, however little the file holds', () => {
  /* the property that makes opening a file safe */
  const { col, add } = cmsFixture();
  add('Keep me', 'Journal', '1');
  add('Keep me too', 'Journal', '2');
  const file = JSON.parse(C.contentJson());
  file.collections[0].items = [file.collections[0].items[0]];      // a file with one of two

  must(C.contentImport(file), 'report');
  a.equal(col.items.length, 2, 'the item absent from the file is still here');

  file.collections = [];                                          // and a file with none
  must(C.contentImport(file), 'report');
  a.equal(C.collections().length, 1);
  a.equal(col.items.length, 2);
});

test('a file that lost its ids still matches, by slug and by field name', () => {
  /* which is what a spreadsheet round-trip does to a file */
  const { col, fields, add } = cmsFixture();
  const it = add('On craft', 'Journal', '1');
  const file = JSON.parse(C.contentJson());
  const fc = file.collections[0];
  delete fc.id;
  fc.items.forEach((x: any) => { delete x.id; });

  const rep = must(C.contentImport(file), 'report');
  a.deepEqual(rep.collections, { added: 0, matched: 1 }, 'matched on slug');
  a.deepEqual(rep.items, { added: 0, updated: 1 }, 'matched on slug too');
  a.equal(C.collections().length, 1, 'no duplicate collection');
  a.equal(col.items.length, 1, 'and no duplicate item');
  a.equal(it.values[fields.title], 'On craft');
});

test('a new collection, a new field, and a field type this build does not know', () => {
  blank();
  const rep = must(C.contentImport({
    collections: [{
      id: 'people', name: 'People', slug: 'people',
      fields: [{ id: 'title', name: 'Title', type: 'text' }, { id: 'joined', name: 'Joined', type: 'quantum' }],
      items: [{ id: 'a', slug: 'ada', values: { title: 'Ada', joined: '1843' } }]
    }]
  }), 'report');

  a.deepEqual(rep.collections, { added: 1, matched: 0 });
  a.equal(rep.fields.added, 1, 'Title already exists on a new collection, so only Joined is new');
  a.deepEqual(rep.items, { added: 1, updated: 0 });
  const col = must(C.collections().find(c => c.slug === 'people'), 'People');
  a.equal(must(C.findField(col, 'joined'), 'joined').type, 'text', 'an unknown type lands as text');
  a.match(rep.notes.join(' '), /no “quantum” field type/, 'and says so rather than silently');
  a.equal(col.items[0].values['title'], 'Ada');
  a.equal(col.items[0].slug, 'ada', 'the slug from the file survives being set after the title');
});

test('values for fields that do not exist are skipped, and named once', () => {
  const { col } = cmsFixture();
  const rep = must(C.contentImport({
    collections: [{ id: col.id, slug: col.slug, fields: [],
      items: [
        { id: 'x1', slug: 'x1', values: { nope: 'a', alsonope: 'b' } },
        { id: 'x2', slug: 'x2', values: { nope: 'c' } }
      ] }]
  }), 'report');
  a.equal(rep.items.added, 2);
  a.equal(rep.notes.length, 1, 'one note for the collection, not one per item');
  a.match(rep.notes[0], /nope, alsonope/);
});

test('anything that is not a content file is refused rather than half-applied', () => {
  const { col } = cmsFixture();
  const items = col.items.length;
  [null, undefined, 0, '', 'a string', [], {}, { collections: null }, { collections: {} },
   { pages: [], meta: {} }].forEach(v =>
    a.equal(C.contentImport(v), null, JSON.stringify(v) + ' is not a content.json'));
  a.equal(col.items.length, items, 'and nothing was touched on the way to saying no');
});

test('the site block is read and ignored', () => {
  /* it describes the project, not its content — rewriting someone's site name from a data
     file is not what "import content" says on the button */
  const { col } = cmsFixture();
  C.state.meta.name = 'Mine';
  const was = C.state.meta.baseUrl;
  must(C.contentImport({ site: { name: 'Theirs', lang: 'fr', baseUrl: 'https://elsewhere.test' },
    collections: [{ id: col.id, slug: col.slug, fields: [], items: [] }] }), 'report');
  a.equal(C.state.meta.name, 'Mine');
  a.equal(C.state.meta.lang, 'en');
  a.equal(C.state.meta.baseUrl, was);
});

/* ---- pagination --------------------------------------------------------
   Forty posts meant forty cards, and the only way out was a limit that hid the rest for
   good. Page one keeps the page's own address so nothing linking to it has to change; the
   rest sit in a folder beside it, which is the shape detail pages already use. */

const paged = (per: string, howMany: number) => {
  const { col, fields, add } = cmsFixture();
  for (let i = 1; i <= howMany; i++) add('Post ' + i, 'Journal', String(i));
  const list = C.N('list', { per, sort: fields.rank, dir: 'asc' });
  list.src = col.id;
  list.children.push(C.N('column', {}, {}, [C.N('heading', { text: 'card', ts: 'subtitle' })]));
  const pg = C.state.pages[0];
  pg.slug = 'journal';
  pg.tree.push(C.N('section', {}, {}, [list]));
  return { col, fields, list, pg };
};

test('a page count is items over per-page, rounded up, and one when it does not paginate', () => {
  const { col, list } = paged('4', 10);
  a.equal(C.listPageCount(list, col), 3, '10 over 4 is 3 pages');
  list.props.per = '10';
  a.equal(C.listPageCount(list, col), 1, 'exactly one page is one page');
  list.props.per = '';
  a.equal(C.listPageCount(list, col), 1, 'and so is not paginating at all');
  list.props.per = '0';
  a.equal(C.listPageCount(list, col), 1);
  list.props.per = 'lots';
  a.equal(C.listPageCount(list, col), 1, 'junk paginates nothing rather than crashing');
});

test('page one keeps the page address and the rest sit in a folder', () => {
  a.equal(C.pagedPath('journal', 1), 'journal.html', 'nothing linking to it has to change');
  a.equal(C.pagedPath('journal', 2), 'journal/page-2.html');
  a.equal(C.pagedRel(1), '', 'page one is at the root');
  a.equal(C.pagedRel(2), '../', 'the rest climb out to reach a sibling');
  /* `page-2` rather than a bare `2`, which could collide with an item of that slug */
  a.equal(/\/2\.html$/.test(C.pagedPath('journal', 2)), false);
});

test('a paginated page exports one file per page, each knowing which it is', () => {
  paged('4', 10);
  const t = C.exportTargets().filter(x => x.path.startsWith('journal'));
  a.deepEqual(t.map(x => x.path), ['journal.html', 'journal/page-2.html', 'journal/page-3.html']);
  a.deepEqual(t.map(x => x.pageNo), [1, 2, 3]);
  a.deepEqual(t.map(x => x.rel), ['', '../', '../']);
  a.deepEqual(t.map(x => x.pages), [3, 3, 3]);
  /* pages after the first say so in the title, so search results are not three identical rows */
  a.equal(/page 2/.test(String(t[1].pg.title)), true);
  a.equal(/page/.test(String(t[0].pg.title || '')), false, 'but page one is left alone');
});

test('each exported page carries its own slice, and the pager points at its neighbours', () => {
  const { pg } = paged('4', 10);
  const html = (n: number) => C.buildPage(pg, { pageNo: n, pages: 3, rel: C.pagedRel(n) });
  /* counts rendered cards: each card's heading holds the literal "card", where matching on
     the text-style class also counted the `.ts-subtitle` rule in the stylesheet */
  const cards = (h: string) => (h.match(/>card</g) || []).length;

  a.equal(cards(html(1)), 4);
  a.equal(cards(html(2)), 4);
  a.equal(cards(html(3)), 2, 'the last page holds the remainder');

  /* page one: no previous to go to, and a next that does */
  const one = html(1);
  a.match(one, /<nav class="pagecraft-pager" aria-label="Pages">/);
  a.match(one, /<span class="pagecraft-page prev off" aria-hidden="true">Previous<\/span>/);
  a.match(one, /<a class="pagecraft-page next" href="journal\/page-2\.html" rel="next">Next<\/a>/);
  a.match(one, /<span class="pagecraft-page on" aria-current="page">1<\/span>/, 'where you are is not a link');

  /* page two climbs out of the folder to reach page one */
  const two = html(2);
  a.match(two, /<a class="pagecraft-page prev" href="\.\.\/journal\.html" rel="prev">/);
  a.match(two, /<a class="pagecraft-page next" href="\.\.\/journal\/page-3\.html"/);
  a.match(two, /aria-current="page">2</);

  /* and page three has nowhere further to go */
  a.match(html(3), /<span class="pagecraft-page next off" aria-hidden="true">Next<\/span>/);
});

test('an unpaginated list still shows everything, and grows no pager', () => {
  const { pg, list } = paged('', 10);
  const html = C.buildPage(pg);
  a.equal((html.match(/>card</g) || []).length, 10);
  /* the element, not the class: `.pagecraft-pager` is also a rule in the stylesheet, which
     every page carries — matched loosely this assertion could never fail */
  const hasPager = (h: string) => /<nav class="pagecraft-pager"/.test(h);
  a.equal(hasPager(html), false);
  /* and a single page of results needs no navigation either */
  list.props.per = '20';
  a.equal(hasPager(C.buildPage(pg)), false, 'one page is not a set of pages');
});

test('only the first paginated list slices, and the review says the others do not', () => {
  const { col, pg, list } = paged('4', 10);
  const second = C.N('list', { per: '2' });
  second.src = col.id;
  second.children.push(C.N('column', {}, {}, [C.N('heading', { text: 'b', ts: 'body' })]));
  pg.tree.push(C.N('section', {}, {}, [second]));

  a.equal(must(C.paginatorOf(pg), 'paginator').node.id, list.id, 'first in document order');
  a.equal(must(C.paginatorOf(pg), 'paginator').extra, 1);

  const html = C.buildPage(pg, { pageNo: 1, pages: 3 });
  a.equal((html.match(/>card</g) || []).length, 4, 'the paginator slices');
  a.equal((html.match(/>b</g) || []).length, 10, 'the other shows everything');
  a.equal((html.match(/<nav class="pagecraft-pager"/g) || []).length, 1, 'one pager, not two');

  a.ok(C.lint().some(f => f.code === 'many-paginators'), 'the review reports it');
});

test('the sitemap and the canonical name the file, not the slug', () => {
  const { pg } = paged('4', 10);
  C.state.meta.baseUrl = 'https://example.com';   /* `blank()` clears it again next test */
  const map = C.sitemapXml();
  a.match(map, /https:\/\/example\.com\/journal\.html/);
  a.match(map, /https:\/\/example\.com\/journal\/page-2\.html/);
  a.equal((map.match(/journal\.html/g) || []).length, 1, 'page one listed once, not three times');
  /* and each file points at itself */
  a.match(C.buildPage(pg, { pageNo: 2 }), /rel="canonical" href="https:\/\/example\.com\/journal\/page-2\.html"/);
});

test('preview can follow a pager link', () => {
  /* the whole point of `page-2` living in a folder is that `pageAt` already climbs out of
     one, so Preview follows a pager the same way it follows a nav */
  const { pg } = paged('4', 10);
  a.equal(must(C.pageAt('journal.html'), 'page one').at, C.state.pages.indexOf(pg));
  a.equal(must(C.pageAt('../journal.html'), 'from the folder').at, C.state.pages.indexOf(pg));
});

/* ---- where a link points -----------------------------------------------
   `.html` is in the stored href because that is what an HTML export needs; the slug is the
   page's identity. `pageAt` is the one place that knows the difference, which is what lets
   Preview follow a link the way a browser would instead of shrugging at it. */

test('pageAt finds an ordinary page by its slug, extension or not', () => {
  blank();
  const home = C.state.pages[0];
  home.slug = 'index';
  C.state.pages.push({ id: 'p2', name: 'Pricing', slug: 'pricing', title: '', desc: '', ogImage: '', tree: [] } as any);

  a.equal(must(C.pageAt('pricing.html'), 'pricing').at, 1);
  a.equal(must(C.pageAt('pricing'), 'no extension').at, 1, 'the slug is the identity');
  a.equal(must(C.pageAt('index.html'), 'home').at, 0);
  a.equal(must(C.pageAt('./pricing.html'), 'relative').at, 1);
  a.equal(must(C.pageAt('../pricing.html'), 'from a folder').at, 1, 'a detail page climbs out');
  a.equal(must(C.pageAt('/pricing.html'), 'rooted').at, 1);

  /* the fragment comes along so the arrival can scroll */
  const f = must(C.pageAt('pricing.html#plans'), 'with a fragment');
  a.equal(f.at, 1); a.equal(f.frag, 'plans');

  /* a bare fragment is this page */
  C.state.cur = 1;
  a.deepEqual([must(C.pageAt('#top'), 'bare').at, must(C.pageAt('#top'), 'bare').frag], [1, 'top']);
});

test('pageAt refuses what is not in this project, rather than guessing', () => {
  blank();
  ['https://example.com', '//example.com/x', 'mailto:a@b.c', 'tel:123', 'nope.html',
   '', '#', 'a/b/c.html', 'data:text/html,x'].forEach(v =>
    a.equal(C.pageAt(v), null, JSON.stringify(v)));
});

test('pageAt resolves a detail page to its template and its item', () => {
  const { col, add } = cmsFixture();
  const first = add('On craft', 'Journal', '1');
  const held = add('Unfinished', 'Journal', '2');
  C.state.pages[0].collection = col.id;

  const hit = must(C.pageAt(col.slug + '/' + first.slug + '.html'), 'detail');
  a.equal(hit.at, 0, 'the page that templates the collection');
  a.equal(must(hit.col, 'col').id, col.id);
  a.equal(must(hit.item, 'item').id, first.id, 'and the item that was clicked');

  /* a draft has no page, so a link to one resolves to nothing rather than to the template */
  C.itemDraft(col.id, held.id, true);
  a.equal(C.pageAt(col.slug + '/' + held.slug + '.html'), null);

  /* and a collection nothing templates has nowhere to land */
  C.state.pages[0].collection = '';
  a.equal(C.pageAt(col.slug + '/' + first.slug + '.html'), null);
});

test('every link a template writes resolves through pageAt', () => {
  /* the region templates all point at HOME, and this is what makes that meaningful:
     Preview can follow them, so a header dropped into a project is checkable */
  ['header-bar', 'header-cta', 'header-centred', 'header-ink',
   'footer-columns', 'footer-slim', 'footer-signup', 'footer-ink'].forEach(id => {
    fresh();
    const p = C.PATTERNS.find(x => x.id === id)!;
    C.state.ui.mode = p.scope!;
    const into = p.scope === 'header' ? C.state.header : C.state.footer;
    into.length = 0;
    patternInsert(id, null, 0);
    const html = C.buildPage(C.state.pages[0]);
    const internal = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
      .filter(h => !/^(https?:|mailto:|tel:|#)/i.test(h));
    a.ok(internal.length, id + ' has internal links to check');
    internal.forEach(h => a.ok(C.pageAt(h), `${id}: ${h} resolves`));
  });
});

/* ---- drafts and filters ------------------------------------------------
   The two verbs a Collection List was missing. Sorting, directing and limiting are enough
   for "the five newest" and nothing else: a category page asks for a subset, and a blog
   needs somewhere to keep a post that is not ready. */

const cmsFixture = () => {
  blank();
  const col = collectionAdd('Journal');
  C.fieldAdd(col.id, 'Title', 'text');
  C.fieldAdd(col.id, 'Category', 'text');
  C.fieldAdd(col.id, 'Rank', 'number');
  const [title, cat, rank] = col.fields.map((f: Field) => f.id);
  const add = (t: string, c: string, r: string) => {
    const it = itemAdd(col.id);
    C.itemSet(col.id, it.id, title, t);
    C.itemSet(col.id, it.id, cat, c);
    C.itemSet(col.id, it.id, rank, r);
    return it;
  };
  return { col, fields: { title, cat, rank }, add };
};

test('a draft leaves every published surface and stays editable in the CMS', () => {
  const { col, add } = cmsFixture();
  const live = add('Shipped', 'Journal', '1');
  const held = add('Half written', 'Journal', '2');

  a.equal(C.published(col).length, 2, 'nothing is a draft to begin with');
  a.ok(C.itemDraft(col.id, held.id, true));

  a.deepEqual(C.published(col).map(i => i.id), [live.id], 'gone from the published set');
  a.equal(col.items.length, 2, 'but still in the collection, because you still edit it');
  a.equal(held.draft, 1);

  /* no detail page, so no entry in the sitemap or the archive either */
  const pg = C.state.pages[0];
  pg.collection = col.id;
  /* only this collection's targets: `blank()` empties page 0's tree but leaves the
     project's other pages alone, and those are not what this is about */
  const detail = () => C.exportTargets().filter(t => t.col).map(t => t.path);
  a.deepEqual(detail(), [col.slug + '/' + live.slug + '.html'], 'one detail page, not two');
  a.equal(/half-written/.test(C.contentJson()), false, 'and absent from content.json');

  /* and back again */
  a.ok(C.itemDraft(col.id, held.id, false));
  a.equal(held.draft, undefined, 'the flag is removed, not set to zero');
  a.equal(detail().length, 2, 'and the page comes back');
});

test('a Collection List shows published items only', () => {
  const { col, add } = cmsFixture();
  add('One', 'Journal', '1');
  const held = add('Two', 'Journal', '2');
  const list = C.N('list', {});
  list.src = col.id;
  C.itemDraft(col.id, held.id, true);
  a.deepEqual(C.listItems(list, col).map(i => i.id).includes(held.id), false);
  a.equal(C.listItems(list, col).length, 1);
});

test('the filter is what a category page is made of', () => {
  const { col, fields, add } = cmsFixture();
  add('A', 'Journal', '10');
  add('B', 'Notes', '9');
  add('C', 'journal', '8');            // deliberately different case
  const list = C.N('list', {});
  list.src = col.id;
  const titles = () => C.listItems(list, col).map(i => i.values[fields.title]);

  a.deepEqual(titles(), ['A', 'B', 'C'], 'no filter, every item');

  Object.assign(list.props, { where: fields.cat, op: 'is', val: 'Journal' });
  a.deepEqual(titles(), ['A', 'C'], 'case-insensitive, which is what a URL slug needs');

  list.props.op = 'not';
  a.deepEqual(titles(), ['B']);

  list.props.op = 'has'; list.props.val = 'urn';
  a.deepEqual(titles(), ['A', 'C'], 'contains, for a tag inside a longer value');
});

test('the filter reads numbers as numbers, and empties as empties', () => {
  const { col, fields, add } = cmsFixture();
  add('nine', 'x', '9');
  add('ten', 'x', '10');
  const blankRank = add('none', 'x', '');
  const list = C.N('list', {});
  list.src = col.id;
  const titles = () => C.listItems(list, col).map(i => i.values[fields.title]);

  Object.assign(list.props, { where: fields.rank, op: 'is', val: '9' });
  a.deepEqual(titles(), ['nine'], '9 is not 10, and not a string comparison');

  list.props.op = 'set';
  a.deepEqual(titles(), ['nine', 'ten'], 'only items with a value');
  list.props.op = 'unset';
  a.deepEqual(titles(), ['none']);
  a.equal(blankRank.values[fields.rank], '');
});

test('a filter that cannot yet do anything hides nothing', () => {
  /* Typing a value one character at a time must not blank the list on the way, and a field
     deleted from under a list must not silently empty every page that used it. */
  const { col, fields, add } = cmsFixture();
  add('A', 'Journal', '1');
  add('B', 'Notes', '2');
  const list = C.N('list', {});
  list.src = col.id;

  Object.assign(list.props, { where: fields.cat, op: 'is', val: '' });
  a.equal(C.listItems(list, col).length, 2, 'no value yet, so no filter yet');

  list.props.where = 'a-field-that-was-deleted';
  list.props.val = 'Journal';
  a.equal(C.listItems(list, col).length, 2, 'a missing field is not a filter that matches nothing');

  /* the operators that need no value still work with none */
  Object.assign(list.props, { where: fields.cat, op: 'set', val: '' });
  a.equal(C.listItems(list, col).length, 2);
});

test('filter, sort and limit compose in that order', () => {
  const { col, fields, add } = cmsFixture();
  ['5', '1', '9', '3'].forEach((r, i) => add('i' + i, i < 3 ? 'Journal' : 'Notes', r));
  const list = C.N('list', {});
  list.src = col.id;
  Object.assign(list.props, { where: fields.cat, op: 'is', val: 'Journal', sort: fields.rank, dir: 'asc', limit: '2' });
  /* Journal holds 5, 1, 9 → sorted 1, 5, 9 → first two */
  a.deepEqual(C.listItems(list, col).map(i => i.values[fields.rank]), ['1', '5']);
  a.equal(C.FILTER_OPS.length, 5, 'and the operator list the control offers is the one tested here');
});

test('the canvas previews a published item, and falls back rather than showing nothing', () => {
  const { col, add } = cmsFixture();
  const a1 = add('One', 'x', '1');
  const a2 = add('Two', 'x', '2');
  C.itemDraft(col.id, a1.id, true);
  a.equal(must(C.previewItem(col), 'preview').id, a2.id, 'skips the draft');
  C.itemDraft(col.id, a2.id, true);
  a.equal(must(C.previewItem(col), 'preview').id, a1.id, 'all drafts: show one anyway');
});

/* ---- responsive images ------------------------------------------------
   The ladder and the `sizes` computation are the whole decision; the export only does the
   pixel-pushing. Both read `imageWidths`, so what the markup promises and what the export
   writes cannot drift apart. */

test('the width ladder never upscales, and skips a variant that would not pay for itself', () => {
  a.deepEqual(C.imageWidths(3000), [480, 768, 1024, 1440, 1920, 3000], 'ladder, then the original');
  a.deepEqual(C.imageWidths(1200), [480, 768, 1024, 1200], 'nothing above the original');
  /* 768 is dropped at 800: a variant within 160px of the original saves a few kilobytes
     and costs a round trip, so the rule is "at least MIN_STEP smaller", applied to every
     rung rather than only to the top one */
  a.deepEqual(C.imageWidths(800), [480, 800]);

  /* which puts the floor at 640 — the first width with any rung far enough below it */
  a.deepEqual(C.imageWidths(640), [480, 640]);
  a.deepEqual(C.imageWidths(639), [], 'one pixel under the floor: a single file is right');
  a.deepEqual(C.imageWidths(600), []);
  a.deepEqual(C.imageWidths(480), [], 'already at the smallest rung');
  a.deepEqual(C.imageWidths(320), [], 'smaller than any rung');

  /* junk in, nothing out — never a fabricated width */
  [0, -1, '', null, undefined, 'wide', NaN].forEach(v => a.deepEqual(C.imageWidths(v), [], String(v)));
  a.deepEqual(C.imageWidths('1200'), C.imageWidths(1200), 'props store numbers as strings');
  a.ok(C.imageWidths(3000).every((w, i, arr) => !i || w > arr[i - 1]), 'ascending, as srcset wants');
});

test('sizes is computed from the layout, not assumed to be the viewport', () => {
  blank();
  /* one image alone in a boxed section: the container less its padding */
  const solo = insert('image', null, 0);
  const sec = C.chainTo(solo.id).find(n => n.type === 'section')!;
  a.equal(String(C.state.meta.maxWidth), '1200px');
  const pad = parseFloat(sec.css.d['padding-left']) + parseFloat(sec.css.d['padding-right']);
  a.match(C.sizesFor(solo.id), new RegExp(`min\\(100vw, ${1200 - pad}px\\)`));
  a.match(C.sizesFor(solo.id), /^\(max-width: 767px\) 100vw,/, 'full width below the breakpoint');

  /* a full-bleed section really is the viewport, and says so */
  sec.props.width = 'full';
  a.equal(C.sizesFor(solo.id), '100vw');
});

test('a column in a three-up row gets a third of the room, less the gaps it does not get', () => {
  blank();
  const row = C.cols(3, [[], [], []], { d: { gap: '24px' } });
  const sec = C.N('section', {}, { d: { 'padding-left': '28px', 'padding-right': '28px' } }, [row]);
  C.state.pages[0].tree.push(sec);
  const img = C.N('image', { w: '3000', h: '2000' });
  row.children[1].children.push(img);

  /* 1200 container − 56 padding = 1144; − 2 gaps of 24 = 1096; ÷ 3 ≈ 365 */
  a.match(C.sizesFor(img.id), /min\(100vw, 365px\)/);

  /* widen that column and its share grows with it */
  row.children[1].css.d['flex-grow'] = '50';
  row.children[0].css.d['flex-grow'] = '25';
  row.children[2].css.d['flex-grow'] = '25';
  a.match(C.sizesFor(img.id), /min\(100vw, 548px\)/, 'half of 1096');
});

test('srcset is the separate-files export only, and only for a stored asset', () => {
  blank();
  const img = insert('image', null, 0);
  img.props.w = '3000'; img.props.h = '2000';
  img.props.src = 'asset:abc123';

  /* inlining five variants to save bandwidth on one is worse than not trying */
  a.equal(/srcset/.test(C.renderNode(img, { edit: false })), false, 'no variants by default');
  a.equal(/srcset/.test(C.renderNode(img, { edit: true, variants: true })), false, 'never in the editor');

  const out = C.renderNode(img, { edit: false, variants: true });
  a.match(out, /srcset="asset:abc123@480 480w, asset:abc123@768 768w, asset:abc123@1024 1024w, asset:abc123@1440 1440w, asset:abc123@1920 1920w, asset:abc123@3000 3000w"/);
  a.match(out, /sizes="\(max-width: 767px\) 100vw, min\(100vw, \d+px\)"/);
  a.match(out, /src="asset:abc123"/, 'and a plain src for anything that ignores srcset');

  /* a remote URL or a data URI has no variants to point at */
  img.props.src = 'https://example.com/a.png';
  a.equal(/srcset/.test(C.renderNode(img, { edit: false, variants: true })), false);
  img.props.src = 'data:image/png;base64,AAAA';
  a.equal(/srcset/.test(C.renderNode(img, { edit: false, variants: true })), false);

  /* and an image too small for the ladder gets none either */
  img.props.src = 'asset:abc123'; img.props.w = '400';
  a.equal(/srcset/.test(C.renderNode(img, { edit: false, variants: true })), false);
});

test('buildPage carries the variants flag through to the markup', () => {
  /* This is the test that was missing. Every case above calls `renderNode` directly, so all
     of them passed while `buildPage` was quietly dropping the flag and no exported page had
     a srcset at all — the feature was broken end to end and the suite was green. An option
     that only one caller knows about has to be asserted at the boundary that caller uses. */
  blank();
  const img = insert('image', null, 0);
  Object.assign(img.props, { src: 'asset:zz9', alt: 'A picture', w: '2400', h: '1600' });
  const pg = C.state.pages[0];

  a.equal(/srcset/.test(C.buildPage(pg)), false, 'no options: a single src');
  a.equal(/srcset/.test(C.buildPage(pg, { variants: false })), false);
  const out = C.buildPage(pg, { variants: true });
  a.match(out, /srcset="asset:zz9@480 480w/, 'and the flag survives the trip');
  a.match(out, /sizes="\(max-width: 767px\) 100vw,/);
  /* the widths in the markup are exactly what the export writer will be asked for */
  a.deepEqual([...out.matchAll(/asset:zz9@(\d+)/g)].map(m => +m[1]), C.imageWidths(2400));
});

test('every shape of the image widget carries the srcset, not just the bare one', () => {
  blank();
  const img = insert('image', null, 0);
  Object.assign(img.props, { src: 'asset:abc123', w: '2400', h: '1600' });
  const o = { edit: false, variants: true };

  a.match(C.renderNode(img, o), /^<img [^>]*srcset=/, 'bare');
  img.props.caption = 'A caption';
  a.match(C.renderNode(img, o), /<img [^>]*srcset=/, 'inside a figure');
  a.match(C.renderNode(img, o), /^<figure/);
  img.props.caption = ''; img.props.link = 'index.html';
  a.match(C.renderNode(img, o), /<a [^>]*><img [^>]*srcset=/, 'wrapped in a link');
});

/* ---- colour, as numbers ----------------------------------------------
   `hex2rgb` is now a caller of `parseColor` rather than a second parser, so these pin
   down both: the accepted set must not have widened (it feeds `contrast`, where a
   wrong answer is worse than no answer) and alpha must survive a round trip. */

test('effectiveAt follows the same order the review does, without a walk at the call site', () => {
  blank();
  const sec = insert('section', null, 0);
  const h = at(sec.id);
  /* section > row > column > heading, which insert() builds when given a leaf */
  const head = insert('heading', null, 1);
  const col = holderOf(head.id);
  a.equal(col.type, 'column');

  /* nothing anywhere: empty, not a guess. A fresh heading carries ts:'title', and that
     style sets a colour — so the text style has to go too for there to be nothing. */
  delete head.css.d['color'];
  head.props.ts = '';
  a.equal(C.effectiveAt(head.id, 'color'), '');

  /* inherited from an ancestor */
  const row = holderOf(col.id);
  row.css.d['color'] = 'rgb(1, 2, 3)';
  a.equal(C.effectiveAt(head.id, 'color'), 'rgb(1, 2, 3)');

  /* a text style beats an ancestor */
  head.props.ts = 'title';
  a.equal(C.effectiveAt(head.id, 'color'), style('title').css.d['color']);

  /* the node's own value beats everything */
  head.css.d['color'] = '#abcdef';
  a.equal(C.effectiveAt(head.id, 'color'), '#abcdef');

  /* and it agrees with effective() given a hand-built chain, which is the point of it */
  a.equal(C.effectiveAt(head.id, 'color'), C.effective(head, 'color', C.chainTo(head.id)));
  a.equal(C.effectiveAt('no-such-node', 'color'), '');
  a.ok(h);
});

test('chainTo is root-first, which is the order effective() reads', () => {
  blank();
  const head = insert('heading', null, 0);
  const chain = C.chainTo(head.id);
  a.deepEqual(chain.map(n => n.type), ['section', 'row', 'column'],
    'outermost first, the node’s own parent last');
  a.deepEqual(C.chainTo(chain[0].id), [], 'a top-level node has nothing above it');
});

test('parseColor takes every hex length that is a colour, and refuses the ones that are not', () => {
  a.deepEqual(C.parseColor('#abc'), { r: 170, g: 187, b: 204, a: 1 });
  a.deepEqual(C.parseColor('#aabbcc'), { r: 170, g: 187, b: 204, a: 1 });
  a.deepEqual(C.parseColor('#ABC'), { r: 170, g: 187, b: 204, a: 1 }, 'case does not matter');
  /* 4 and 8 digits carry alpha; ff is opaque, 80 is about half */
  a.deepEqual(C.parseColor('#abcf'), { r: 170, g: 187, b: 204, a: 1 });
  a.equal(C.parseColor('#aabbcc80')!.a, 128 / 255);
  a.equal(C.parseColor('#aabbcc00')!.a, 0);
  /* 5 and 7 digits are not shorthand for anything, and must not be padded into a colour */
  ['#ab', '#abcde', '#abcdefa', '#abcdefabc', '#', '', 'red', 'var(--c-ink)', 'inherit', null, undefined]
    .forEach(v => a.equal(C.parseColor(v), null, JSON.stringify(v) + ' is not a colour'));
});

test('parseColor reads both rgb syntaxes, clamps, and defaults alpha to opaque', () => {
  a.deepEqual(C.parseColor('rgb(1,2,3)'), { r: 1, g: 2, b: 3, a: 1 });
  a.deepEqual(C.parseColor('rgba(1, 2, 3, 0.5)'), { r: 1, g: 2, b: 3, a: 0.5 });
  a.deepEqual(C.parseColor('rgb(1 2 3 / 50%)'), { r: 1, g: 2, b: 3, a: 0.5 }, 'space syntax and a percentage');
  a.equal(C.parseColor('rgb(300, 20, 3)')!.r, 255, 'over 255 is clamped, not wrapped');
  a.equal(C.parseColor('rgba(1,2,3,9)')!.a, 1, 'and so is alpha');
  /* a negative component is not valid CSS, so it is not a colour rather than a clamped
     one — the same answer the parser gave before it understood alpha */
  a.equal(C.parseColor('rgb(-20, 20, 3)'), null);
});

test('fmtColor stays hex while it can, and round-trips through parseColor', () => {
  a.equal(C.fmtColor({ r: 170, g: 187, b: 204, a: 1 }), '#aabbcc');
  a.equal(C.fmtColor({ r: 0, g: 0, b: 0, a: 1 }), '#000000', 'padded, not #0');
  a.equal(C.fmtColor({ r: 170, g: 187, b: 204, a: 0.5 }), 'rgba(170, 187, 204, 0.5)');
  a.equal(C.fmtColor({ r: 1, g: 2, b: 3, a: 0.333333 }), 'rgba(1, 2, 3, 0.33)', 'two decimals, no float noise');
  ['#aabbcc', 'rgba(1, 2, 3, 0.5)', 'rgba(0, 0, 0, 0)'].forEach(v =>
    a.equal(C.fmtColor(C.parseColor(v)!), v, v + ' survives a round trip'));
});

test('hsv round-trips, and the grey and red edges do not drift', () => {
  /* every 15° at full saturation must come back as the same rgb, which is the property
     a saturation/value square depends on as the pointer moves */
  for (let h = 0; h < 360; h += 15) {
    const rgb = C.hsv2rgb({ h, s: 1, v: 1 });
    a.equal(Math.round(C.rgb2hsv(rgb).h), h, h + '° round-trips');
  }
  a.deepEqual(C.hsv2rgb({ h: 0, s: 0, v: 1 }), { r: 255, g: 255, b: 255 });
  a.deepEqual(C.hsv2rgb({ h: 0, s: 0, v: 0 }), { r: 0, g: 0, b: 0 });
  a.equal(C.rgb2hsv({ r: 128, g: 128, b: 128 }).s, 0, 'grey has no hue to speak of');
  a.equal(C.rgb2hsv({ r: 0, g: 0, b: 0 }).v, 0);
  /* out-of-range hue wraps rather than clipping, so dragging past the end of the strip
     does not stick on magenta */
  a.deepEqual(C.hsv2rgb({ h: 360, s: 1, v: 1 }), C.hsv2rgb({ h: 0, s: 1, v: 1 }));
  a.deepEqual(C.hsv2rgb({ h: -60, s: 1, v: 1 }), C.hsv2rgb({ h: 300, s: 1, v: 1 }));
});

test('hex2rgb accepts exactly what it always did, and contrast still refuses non-colours', () => {
  /* it is a view onto parseColor now, so the risk is the accepted set widening under it —
     contrast() returning a number where it used to return null is a silent wrong answer */
  a.deepEqual(C.hex2rgb('#abc'), [170, 187, 204]);
  a.deepEqual(C.hex2rgb('#aabbcc'), [170, 187, 204]);
  a.deepEqual(C.hex2rgb('rgba(1,2,3,0.5)'), [1, 2, 3], 'alpha dropped, which is what a ratio wants');
  ['transparent', 'red', 'currentColor', 'var(--c-ink)', ''].forEach(v =>
    a.equal(C.hex2rgb(v), null, v + ' is not a literal colour'));
  /* contrast resolves a token first, so a token reference is answerable and a keyword
     is not — the distinction is the whole reason `resolveColor` sits in front of it */
  ['transparent', 'red', 'currentColor', ''].forEach(v =>
    a.equal(C.contrast(v, '#ffffff'), null, v + ': contrast says so rather than guessing'));
  a.ok(C.contrast('var(--c-ink)', '#ffffff')! > 15, 'but a token resolves and is answerable');
  a.ok(C.contrast('#000000', '#ffffff')! > 20, 'black on white is the maximum');
});

test('a captioned image becomes a figure, a plain one stays an img', () => {
  blank();
  const img = insert('image', null, 0);
  img.props.src = 'https://x.com/a.png';
  a.match(C.renderNode(img, { edit: false }), /^<img /);
  img.props.caption = 'A caption';
  const fig = C.renderNode(img, { edit: false });
  a.match(fig, /^<figure /);
  a.match(fig, /<figcaption class="pagecraft-caption">A caption<\/figcaption>/);
});

/* ---- the quote widget ------------------------------------------------
   Both testimonial patterns used to build a quote out of two WYSIWYG blocks holding
   `<p>&ldquo;…&rdquo;</p>`, so the most quotable thing on a marketing page exported as
   an anonymous paragraph. These pin the semantics down so it cannot regress to that. */

test('an attributed quote is a figure, an unattributed one is a bare blockquote', () => {
  blank();
  const q = insert('quote', null, 0);
  q.props.text = 'They shipped in a week.';
  q.props.by = '';
  const bare = C.renderNode(q, { edit: false });
  a.match(bare, /^<blockquote /);
  a.match(bare, /<p>They shipped in a week\.<\/p>/);
  a.equal(/figure|figcaption/.test(bare), false, 'no caption, so no wrapper to hold one');

  q.props.by = 'Jane Doe, CTO at Acme';
  const fig = C.renderNode(q, { edit: false });
  a.match(fig, /^<figure /);
  a.match(fig, /<blockquote><p>They shipped in a week\.<\/p><\/blockquote>/);
  a.match(fig, /<figcaption class="pagecraft-attrib">Jane Doe, CTO at Acme<\/figcaption>/);
});

test('a source URL is recorded for machines and links the attribution', () => {
  blank();
  const q = insert('quote', null, 0);
  q.props.text = 'Quoted.';
  q.props.by = 'The Times';
  q.props.source = 'https://example.com/review';
  const html = C.renderNode(q, { edit: false });
  a.match(html, /<blockquote cite="https:\/\/example\.com\/review">/);
  a.match(html, /<figcaption class="pagecraft-attrib"><a href="https:\/\/example\.com\/review">The Times<\/a>/);

  /* unattributed, the attribute lands on the element that carries the id */
  q.props.by = '';
  a.match(C.renderNode(q, { edit: false }), /^<blockquote id="[^"]*" cite="https:\/\/example\.com\/review"/);

  /* and a source that is not a URL is dropped rather than emitted */
  q.props.source = 'javascript:alert(1)';
  const unsafe = C.renderNode(q, { edit: false });
  a.equal(/cite=|javascript:/.test(unsafe), false);
});

test('quote text is escaped, and the quotation marks are not in it', () => {
  blank();
  const q = insert('quote', null, 0);
  q.props.text = '5 > 3 & <b>bold</b>';
  q.props.by = 'A & B <script>';
  const html = C.renderNode(q, { edit: false });
  a.match(html, /5 &gt; 3 &amp; &lt;b&gt;bold&lt;\/b&gt;/);
  a.match(html, /A &amp; B &lt;script&gt;/);
  /* the marks are drawn by CSS, so nothing a screen reader reads contains them */
  a.equal(/[\u201C\u201D]|&ldquo;|&rdquo;/.test(html), false);
  a.match(C.baseCss(false), /pagecraft-quote p:first-of-type::before\{content:"\\201C"\}/);
});

test('a newline in a quote breaks the line rather than closing the paragraph', () => {
  blank();
  const q = insert('quote', null, 0);
  q.props.text = 'One line.\nAnother.';
  q.props.by = '';
  const html = C.renderNode(q, { edit: false });
  a.equal((html.match(/<p>/g) || []).length, 1);
  a.match(html, /One line\.<br>Another\./);
});

test('a quote joins find and replace under its own labels', () => {
  blank();
  const q = insert('quote', null, 0);
  q.props.text = 'Findable sentence.';
  q.props.by = 'Findable person.';
  const slots = C.textSlots(q);
  a.deepEqual(slots.map(x => x.prop), ['text', 'by']);
  a.deepEqual(slots.map(x => C.slotName(x)), ['Text', 'Attribution']);
  a.equal(C.searchCount(C.searchAll('Findable')), 2);
  C.replaceAll('Findable', 'Found');
  a.equal(q.props.text, 'Found sentence.');
  a.equal(q.props.by, 'Found person.');
});

test('both testimonial patterns export a real blockquote', () => {
  ['quote', 'quotes-3'].forEach(id => {
    blank();
    patternInsert(id, null, 0);
    const html = C.buildPage(C.state.pages[0]);
    const want = id === 'quotes-3' ? 3 : 1;
    a.equal((html.match(/<blockquote/g) || []).length, want, id + ': one blockquote per quote');
    a.equal((html.match(/&ldquo;|&rdquo;/g) || []).length, 0, id + ': no typed quotation marks');
    a.match(html, /<figcaption class="pagecraft-attrib">Name, Role at Company<\/figcaption>/);
  });
});

test('lazy loading is an export-only attribute', () => {
  blank();
  const img = insert('image', null, 0);
  img.props.src = 'https://x.com/a.png';
  a.match(C.renderNode(img, { edit: false }), /loading="lazy"/);
  a.equal(/loading="lazy"/.test(C.renderNode(img, { edit: true })), false);
});

/* --------------------------------------------------------------- export */
test('the exported page carries no editor state', () => {
  const html = C.buildPage(C.state.pages[0]);
  ['data-id=', 'data-t=', 'data-sel', 's-empty', 's-hud', 's-lock', 's-canvas-empty']
    .forEach(t => a.equal(html.includes(t), false, t + ' must not reach the export'));
});

test('the export is a complete document with page metadata', () => {
  const pg = C.state.pages[0];
  pg.title = 'Custom title';
  pg.desc = 'Custom description';
  const html = C.buildPage(pg);
  a.match(html, /^<!doctype html>/);
  a.match(html, /<html lang="en">/);
  a.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  a.match(html, /<title>Custom title<\/title>/);
  a.match(html, /<meta name="description" content="Custom description">/);
  a.match(html, /<meta property="og:title" content="Custom title">/);
  a.match(html, /<\/body>\n<\/html>/);
});

test('the global header and footer are inlined into every page', () => {
  C.state.header = [C.N('section', { tag: 'header' }, {}, [C.cols(1, [[C.N('heading', { text: 'SITEWIDE-HEAD' })]])])];
  C.state.footer = [C.N('section', { tag: 'footer' }, {}, [C.cols(1, [[C.N('heading', { text: 'SITEWIDE-FOOT' })]])])];
  for (const pg of C.state.pages) {
    const html = C.buildPage(pg);
    a.match(html, /SITEWIDE-HEAD/);
    a.match(html, /SITEWIDE-FOOT/);
    a.ok(html.indexOf('SITEWIDE-HEAD') < html.indexOf('SITEWIDE-FOOT'), 'header precedes footer');
  }
});

test('the nav toggle script ships only when a page uses a nav', () => {
  blank();
  C.state.header = []; C.state.footer = [];
  a.equal(/<script/.test(C.buildPage(C.state.pages[0])), false, 'no nav, no script');
  insert('nav', null, 0);
  const html = C.buildPage(C.state.pages[0]);
  a.equal((html.match(/<script/g) || []).length, 1, 'exactly one copy');
  a.match(html, /aria-expanded="false"/);
  a.match(html, /aria-controls="/);
});

test('a nav collapses at the breakpoint the author chose', () => {
  blank();
  const nav = insert('nav', null, 0);
  const at = () => {
    const { tablet, mobile } = blocks(C.treeCss([C.state.pages[0].tree], false));
    return { tablet: tablet.includes('.pagecraft-nav-toggle{display:flex}'), mobile: mobile.includes('.pagecraft-nav-toggle{display:flex}') };
  };
  nav.props.collapse = 'mobile';
  a.deepEqual(at(), { tablet: false, mobile: true });
  nav.props.collapse = 'tablet';
  a.deepEqual(at(), { tablet: true, mobile: false }, 'the tablet query already covers mobile');
  nav.props.collapse = 'never';
  a.deepEqual(at(), { tablet: false, mobile: false });
});

test('asset references survive buildPage for the export step to resolve', () => {
  blank();
  const img = insert('image', null, 0);
  img.props.src = 'asset:abc123';
  a.match(C.buildPage(C.state.pages[0]), /src="asset:abc123"/);
});

test('project-level typography and container width reach the stylesheet', () => {
  C.state.meta.maxWidth = '980px';
  C.state.meta.font = 'Georgia, serif';
  C.state.meta.css = '.custom-marker{color:red}';
  const html = C.buildPage(C.state.pages[0]);
  a.match(html, /--maxw:980px/);
  a.match(html, /font-family:Georgia, serif/);
  a.match(html, /\.custom-marker\{color:red\}/);
});

test('the demo project renders every component type', () => {
  const seen = new Set();
  [C.state.header, C.state.footer, ...C.state.pages.map(p => p.tree)]
    .forEach(l => C.eachNode(l, n => seen.add(n.type)));
  ['section', 'row', 'column', 'heading', 'text', 'image', 'video', 'button', 'nav', 'divider']
    .forEach(t => a.ok(seen.has(t), 'demo content should include a ' + t));
});

/* --------------------------------------------------------- design tokens */
test('the default token set is the Pagecraft working palette', () => {
  const hex = (id: string) => color(id).value;
  a.equal(hex('text'), '#111311', 'Ink');
  a.equal(hex('bg'), '#f8f6ef', 'Paper');
  a.equal(hex('brand'), '#b7f34a', 'Craft Green');
  a.equal(hex('slate'), '#6f7771', 'brand Slate');
  a.equal(hex('surface'), '#ffffff', 'White');
  /* display type follows .pc-display from the brand token file */
  const d = style('display').css.d;
  a.equal(d['font-weight'], '600');
  a.equal(d['letter-spacing'], '-.04em');
  a.equal(d['line-height'], '.96');
  /* labels are set in the supporting face */
  a.match(style('eyebrow').css.d['font-family'], /DM Sans/);
});

test('the demo project is typeset in the brand faces', () => {
  a.match(C.state.meta.font, /Manrope/);
  a.match(C.state.meta.headFont, /Manrope/);
  a.match(C.buildPage(C.state.pages[0]), /font-family:'Manrope'/);
});

/* --------------------------------------------------------- font library */
test('choosing a font is enough — the stylesheet link is written for you', () => {
  a.equal(C.state.meta.headHtml, '', 'nothing hand-written in the head');
  const html = C.buildPage(C.state.pages[0]);
  a.match(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?/);
  a.equal((html.match(/rel="preconnect"/g) || []).length, 2, 'both preconnects, once');
});

test('only the families actually in use are requested', () => {
  blank();
  C.state.meta.font = C.stackFor('Inter', 's');
  C.state.meta.headFont = '';
  C.ensureTokens().text = [];
  a.deepEqual(C.usedFamilies(), ['Inter']);
  const h = insert('heading', null, 0);
  h.props.ts = '';
  h.css.d['font-family'] = C.stackFor('Playfair Display', 'f');
  a.deepEqual(C.usedFamilies(), ['Inter', 'Playfair Display'].sort((x, y) =>
    C.GF.findIndex(g => g[0] === x) - C.GF.findIndex(g => g[0] === y)));
  a.match(C.gfontsHref(), /family=Playfair\+Display:wght@/, 'spaces become plus signs');
});

test('a family reached only through a class or text style still loads', () => {
  blank();
  C.state.meta.font = ''; C.state.meta.headFont = '';
  C.ensureTokens().text = [{ id: 'x', name: 'X', css: { d: { 'font-family': C.stackFor('Lora', 'f') }, t: {}, m: {} } }];
  a.deepEqual(C.usedFamilies(), ['Lora'], 'via a text style');
  C.ensureTokens().text = [];
  C.classAdd('Mono', { d: { 'font-family': C.stackFor('JetBrains Mono', 'm') } });
  a.deepEqual(C.usedFamilies(), ['JetBrains Mono'], 'via a class');
});

test('a system stack or custom family requests nothing', () => {
  blank();
  C.ensureTokens().text = [];
  C.state.meta.font = C.FONT_BASE[1][0];              // System sans
  C.state.meta.headFont = "'Wingdings Pro',sans-serif";
  a.deepEqual(C.usedFamilies(), []);
  a.equal(C.gfontsHref(), '');
  a.equal(C.gfontsLink(), '');
  a.equal(/fonts\.googleapis/.test(C.buildPage(C.state.pages[0])), false);
});

test('a font stack always names a fallback for its category', () => {
  a.match(C.stackFor('Lora', 'f'), /^'Lora',Georgia/);
  a.match(C.stackFor('Inter', 's'), /^'Inter',system-ui/);
  a.match(C.stackFor('DM Mono', 'm'), /^'DM Mono',ui-monospace/);
  a.equal(C.familyOf(C.stackFor('Playfair Display', 'f')), 'Playfair Display');
  a.equal(C.isGoogle(C.stackFor('Inter', 's')), true);
  a.equal(C.isGoogle('Helvetica,sans-serif'), false);
});

test('the picker groups the library and covers every family', () => {
  const groups = C.fontGroups();
  a.deepEqual(groups.map(g => g[0]), ['Standard', 'Sans serif — Google Fonts', 'Serif — Google Fonts', 'Display — Google Fonts', 'Monospace — Google Fonts']);
  const offered = groups.slice(1).reduce((n, g) => n + g[1].length, 0);
  a.equal(offered, C.GF.length, 'every family in the library is offered');
  a.ok(C.GF.length >= 40, 'a usable library, not a token gesture');
});
test('colour tokens become :root variables and elements reference them', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d.color = C.cvar('brand');
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, new RegExp('--c-brand:' + color('brand').value));
  a.match(css, new RegExp('\\.' + C.nodeClass(h) + '\\{[^}]*color:var\\(--c-brand\\)'));
});

test('changing one token restyles every element linked to it', () => {
  blank();
  const one = insert('heading', null, 0);
  const two = insert('button', null, 1);
  one.css.d.color = C.cvar('brand');
  two.css.d['background-color'] = C.cvar('brand');
  color('brand').value = '#ff0055';
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, /--c-brand:#ff0055/);
  a.match(css, new RegExp('\\.' + C.nodeClass(one) + '\\{[^}]*color:var\\(--c-brand\\)'));
  a.match(css, new RegExp('\\.' + C.nodeClass(two) + '\\{[^}]*background-color:var\\(--c-brand\\)'));
  a.equal(/#ff0055/.test(css.replace('--c-brand:#ff0055', '')), false, 'the literal is defined once, not copied');
});

test('text styles emit one rule per breakpoint, before element rules', () => {
  blank();
  const h = insert('heading', null, 0);
  C.tsApply(h, 'display');
  const css = C.treeCss([C.state.pages[0].tree], false);
  const { base, tablet, mobile } = blocks(css);
  const size = (b: Bp) => style('display').css[b]['font-size'];
  a.match(base, new RegExp('\\.ts-display\\{[^}]*font-size:' + size('d')));
  a.match(tablet, new RegExp('\\.ts-display\\{[^}]*font-size:' + size('t')));
  a.match(mobile, new RegExp('\\.ts-display\\{[^}]*font-size:' + size('m')));
  a.ok(base.indexOf('.ts-display') < base.indexOf('.' + C.nodeClass(h)),
    'style rules precede element rules so per-element tweaks win');
});

test('an element carrying a text style renders its class', () => {
  blank();
  const h = insert('heading', null, 0);
  C.tsApply(h, 'title');
  a.match(C.renderNode(h, { edit: false }), new RegExp('class="pagecraft-heading ' + C.nodeClass(h) + ' ts-title"'));
  h.props.ts = 'does-not-exist';
  a.equal(/ts-does-not-exist/.test(C.renderNode(h, { edit: false })), false, 'a dangling reference is ignored');
});

test('applying a style clears the typography that would mask it', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d['font-size'] = '99px';
  h.css.d['margin-bottom'] = '10px';
  C.tsApply(h, 'body');
  a.equal(h.css.d['font-size'], undefined, 'typography steps aside');
  a.equal(h.css.d['margin-bottom'], '10px', 'non-typographic styling is untouched');
  a.equal(h.props.ts, 'body');
});

test('detaching a style bakes its values in so nothing moves', () => {
  blank();
  const h = insert('heading', null, 0);
  const want = { d: style('display').css.d['font-size'], t: style('display').css.t['font-size'], m: style('display').css.m['font-size'] };
  C.tsApply(h, 'display');
  C.tsUnlink(h);
  a.equal(h.props.ts, '');
  a.equal(h.css.d['font-size'], want.d);
  a.equal(h.css.t['font-size'], want.t);
  a.equal(h.css.m['font-size'], want.m);
});

test('detaching keeps a local override in preference to the style value', () => {
  blank();
  const h = insert('heading', null, 0);
  const weight = style('display').css.d['font-weight'];
  C.tsApply(h, 'display');
  h.css.d['font-size'] = '70px';
  C.tsUnlink(h);
  a.equal(h.css.d['font-size'], '70px');
  a.equal(h.css.d['font-weight'], weight, 'the rest comes from the style');
});

test('updating a style from one element moves every user of it', () => {
  blank();
  const one = insert('heading', null, 0);
  const two = insert('heading', null, 1);
  C.tsApply(one, 'title');
  C.tsApply(two, 'title');
  a.equal(C.tsUsage('title'), 2);
  one.css.d['letter-spacing'] = '-.06em';
  C.tsUpdateFrom(one);
  a.equal(style('title').css.d['letter-spacing'], '-.06em');
  a.equal(one.css.d['letter-spacing'], undefined, 'the element stops carrying it locally');
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, /\.ts-title\{[^}]*letter-spacing:-\.06em/);
  a.equal((css.match(/letter-spacing:-\.06em/g) || []).length, 1, 'defined once, applied to both');
});

test('saving a new style from an element captures all three breakpoints', () => {
  blank();
  const h = insert('heading', null, 0);
  h.props.ts = '';
  h.css.d['font-size'] = '28px';
  h.css.m['font-size'] = '18px';
  const id = C.tsCreateFrom(h, 'Card heading');
  a.equal(id, 'card-heading');
  a.equal(h.props.ts, id);
  a.equal(style(id).css.d['font-size'], '28px');
  a.equal(style(id).css.m['font-size'], '18px');
  a.equal(h.css.d['font-size'], undefined);
});

test('style ids stay unique when names collide', () => {
  blank();
  const h = insert('heading', null, 0);
  a.equal(C.tsCreateFrom(h, 'Display'), 'display-2', 'display is taken by the default set');
});

test('deleting a style leaves its users looking identical', () => {
  blank();
  const h = insert('heading', null, 0);
  const size = style('display').css.d['font-size'];
  C.tsApply(h, 'display');
  C.styleDelete('display');
  a.equal(C.findStyle('display'), null);
  a.equal(h.props.ts, '');
  a.equal(h.css.d['font-size'], size, 'the look was baked in on the way out');
});

test('deleting a colour inlines its literal everywhere', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = C.colorAdd('Highlight', '#00ddaa');
  h.css.d.color = C.cvar(id);
  style('body').css.d.color = C.cvar(id);
  a.equal(C.colorUsage(id), 2, 'counted in both elements and text styles');
  a.equal(C.colorDelete(id), true);
  a.equal(C.findColor(id), null);
  a.equal(h.css.d.color, '#00ddaa');
  a.equal(style('body').css.d.color, '#00ddaa');
});

test('the three reserved colours cannot be deleted', () => {
  C.RESERVED.forEach(id => {
    a.equal(C.colorDelete(id), false, id + ' must survive');
    a.ok(color(id), id + ' still present');
  });
});

test('the base stylesheet consumes the reserved colours', () => {
  const css = C.baseCss(false);
  a.match(css, /color:var\(--c-text\)/);
  a.match(css, /background:var\(--c-bg\)/);
  a.match(css, /--accent:var\(--c-brand\)/);
});

test('isRef and refId only accept the token syntax', () => {
  a.equal(C.isRef('var(--c-brand)'), true);
  a.equal(C.refId('var(--c-brand)'), 'brand');
  a.equal(C.isRef('#4f7cff'), false);
  a.equal(C.isRef('var(--nav-gap)'), false);
  a.equal(C.refId('rgba(0,0,0,.5)'), null);
});

test('resolveColor follows a reference and survives a dangling one', () => {
  a.equal(C.resolveColor(C.cvar('brand')), color('brand').value);
  a.equal(C.resolveColor('#123456'), '#123456');
  a.equal(C.resolveColor(C.cvar('nope')), '');
});

test('migration v2 to v3 folds loose meta colours into tokens', () => {
  const d = C.migrate({ v: 2, meta: { color: '#111111', bg: '#fefefe', accent: '#00ff00' }, pages: [{ tree: [] }] });
  a.equal(d.v, C.SCHEMA);
  a.equal(d.meta.tokens.colors.find((c: ColorToken) => c.id === 'text').value, '#111111');
  a.equal(d.meta.tokens.colors.find((c: ColorToken) => c.id === 'bg').value, '#fefefe');
  a.equal(d.meta.tokens.colors.find((c: ColorToken) => c.id === 'brand').value, '#00ff00');
  a.equal(d.meta.accent, undefined, 'the old loose fields are removed');
  a.ok(d.meta.tokens.text.length, 'default text styles are provided');
});

test('an existing token set is never overwritten by migration', () => {
  const mine = { colors: [{ id: 'text', name: 'T', value: '#abcdef' }], text: [] };
  const d = C.migrate({ v: 2, meta: { tokens: mine }, pages: [{ tree: [] }] });
  a.equal(d.meta.tokens, mine);
});

test('the demo project is built on tokens, not loose hex values', () => {
  const json = JSON.stringify([C.state.header, C.state.footer, ...C.state.pages.map(p => p.tree)]);
  a.ok((json.match(/var\(--c-/g) || []).length > 12, 'colours are token references');
  const styled: string[] = [];
  [C.state.header, C.state.footer, ...C.state.pages.map(p => p.tree)]
    .forEach(l => C.eachNode(l, n => { if (C.TS_TYPES.includes(n.type) && n.props.ts) styled.push(n.props.ts); }));
  a.ok(styled.length > 10, 'text elements use text styles');
  styled.forEach(id => a.ok(style(id), 'style ' + id + ' exists'));
});

test('a token rebrand changes the export in one place', () => {
  const was = color('brand').value;
  const before = C.buildPage(C.state.pages[0]);
  a.match(before, new RegExp('--c-brand:' + was));
  color('brand').value = '#e11d48';
  const after = C.buildPage(C.state.pages[0]);
  a.match(after, /--c-brand:#e11d48/);
  a.equal(before.split(was).join('#e11d48'), after, 'nothing else in the document changed');
});

test('every internal link in the demo resolves — including from global regions', () => {
  /* A global header or footer is inlined into every page, so a bare "#anchor"
     in one only works on the page that happens to own that anchor. */
  const idsBySlug: Record<string, Set<string>> = {};
  for (const pg of C.state.pages) {
    idsBySlug[pg.slug + '.html'] = new Set([...C.buildPage(pg).matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
  }
  for (const pg of C.state.pages) {
    const html = C.buildPage(pg);
    const here = pg.slug + '.html';
    const links = [...html.matchAll(/href="(?!https?:|mailto:|tel:)([^"]+)"/g)].map(m => m[1]);
    for (const href of links) {
      const [path, frag] = href.split('#');
      const target = path === '' ? here : path;
      a.ok(idsBySlug[target], `${href} on /${here} points at ${target}, which is not a page in this project`);
      if (frag) a.ok(idsBySlug[target].has(frag), `${href} on /${here} has no element with id "${frag}"`);
    }
  }
});

/* --------------------------------------------------------- export review */
const codes = (f: Finding[]) => f.map(x => x.code);
const find = (f: Finding[], code: string) => f.filter(x => x.code === code);

test('the demo project reviews clean apart from its placeholder image', () => {
  const f = C.lint();
  a.equal(C.lintCounts(f).error, 0, 'no errors: ' + JSON.stringify(codes(f)));
  a.deepEqual([...new Set(codes(f))].sort(), ['no-dimensions', 'no-image'],
    'the only findings are the image the user is meant to replace');
});

test('a dead internal link is an error, a live one is silent', () => {
  blank();
  const b = insert('button', null, 0);
  b.props.link = 'nope.html';
  a.equal(find(C.lint(), 'dead-link').length, 1);
  b.props.link = 'pricing.html';
  a.equal(find(C.lint(), 'dead-link').length, 0);
});

test('a fragment link is checked against the page that owns it', () => {
  blank();
  const b = insert('button', null, 0);
  b.props.link = '#nowhere';
  a.equal(find(C.lint(), 'dead-anchor').length, 1);
  const sec = C.state.pages[0].tree[0];
  sec.adv.htmlId = 'nowhere';
  a.equal(find(C.lint(), 'dead-anchor').length, 0);
});

test('a bare fragment in a global region is flagged, since it travels', () => {
  blank();
  C.state.header = [C.N('section', { tag: 'header' }, {}, [C.cols(1, [[C.N('button', { text: 'Go', link: '#top' })]])])];
  const f = find(C.lint(), 'global-fragment');
  a.ok(f.length, 'the header link should be questioned');
  a.match(f[0].msg, /on every page/);
  /* naming the page resolves it */
  C.eachNode(C.state.header, n => { if (n.type === 'button') n.props.link = 'index.html#top'; });
  C.state.pages[0].tree = [C.N('section', {}, {}, [])];
  C.state.pages[0].tree[0].adv.htmlId = 'top';
  a.equal(find(C.lint(), 'global-fragment').length, 0);
});

test('missing alt is an error unless the image is marked decorative', () => {
  blank();
  const img = insert('image', null, 0);
  img.props.src = 'a.png'; img.props.alt = ''; img.props.w = '10'; img.props.h = '10';
  a.equal(find(C.lint(), 'no-alt').length, 1);
  img.props.decorative = 1;
  a.equal(find(C.lint(), 'no-alt').length, 0, 'decorative is a deliberate empty alt');
  a.match(C.renderNode(img, { edit: false }), /alt=""/);
});

test('images without intrinsic size are flagged for layout shift', () => {
  blank();
  const img = insert('image', null, 0);
  img.props.src = 'a.png'; img.props.alt = 'A';
  a.equal(find(C.lint(), 'no-dimensions').length, 1);
  img.props.w = '800'; img.props.h = '600';
  a.equal(find(C.lint(), 'no-dimensions').length, 0);
  a.match(C.renderNode(img, { edit: false }), /width="800" height="600"/);
});

test('heading order and h1 count are checked per page', () => {
  blank();
  const mk = (lvl: string) => { const h = insert('heading', null, 0); h.props.level = lvl; return h; };
  mk('h3'); mk('h1');                       // inserted at 0, so document order is h1 then h3
  const f = C.lint();
  a.equal(find(f, 'heading-skip').length, 1, 'H1 followed by H3 skips a level');
  a.equal(find(f, 'no-h1').length, 0);
  blank();
  mk('h2');
  a.equal(find(C.lint(), 'no-h1').length, 1);
});

test('duplicate anchor ids on one page are an error', () => {
  blank();
  const one = insert('heading', null, 0), two = insert('heading', null, 1);
  holderOf(one.id).adv.htmlId = 'dup';
  holderOf(two.id).adv.htmlId = 'dup';
  a.equal(find(C.lint(), 'duplicate-id').length, 1);
});

test('contrast is measured against the element own background first', () => {
  blank();
  const sec = C.N('section', {}, { d: { 'background-color': '#111311' } }, []);
  C.state.pages[0].tree.push(sec);
  const row = C.makeFor('columns'); sec.children.push(row);
  const btn = C.N('button', { text: 'Go', ts: '' }, { d: { 'background-color': '#b7f34a', color: '#111311' } });
  row.children[0].children.push(btn);
  /* Ink on Craft Green is 14:1 — measuring against the section would read 1:1 */
  a.equal(find(C.lint(), 'contrast').length, 0);
  btn.css.d['background-color'] = '#111311';
  a.equal(find(C.lint(), 'contrast').length, 1, 'ink on ink is unreadable');
});

test('contrast uses the larger-text threshold where it applies', () => {
  a.ok(must(C.contrast('#6f7771', '#f8f6ef'), 'contrast') < 4.5, 'brand Slate fails AA for body copy on Paper');
  a.ok(must(C.contrast('#6f7771', '#f8f6ef'), 'contrast') > 3, 'but clears the large-text bar');
  blank();
  const h = insert('heading', null, 0);
  h.props.ts = ''; h.css.d.color = '#6f7771';
  h.css.d['font-size'] = '14px';
  a.equal(find(C.lint(), 'contrast').length, 1, 'small text is held to 4.5:1');
  h.css.d['font-size'] = '40px';
  a.equal(find(C.lint(), 'contrast').length, 0, 'large text is held to 3:1');
});

test('the default palette gives secondary text an accessible home', () => {
  const v = (id: string) => color(id).value;
  a.ok(must(C.contrast(v('muted'), v('bg')), 'contrast') >= 4.5, 'Slate (on Paper) clears AA on Paper');
  a.ok(must(C.contrast(v('muted-i'), v('ink')), 'contrast') >= 4.5, 'Slate (on Ink) clears AA on Ink');
  a.equal(v('slate'), '#6f7771', 'the brand Slate is still available for fills and large text');
});

/* --------------------------------------------------- deferred media + SEO */
test('an embedded player is deferred behind a facade by default', () => {
  blank();
  const v = insert('video', null, 0);
  const html = C.buildPage(C.state.pages[0]);
  a.equal(/<iframe/.test(html), false, 'no player iframe on load');
  a.match(html, /data-facade/);
  a.match(html, /data-embed="https:\/\/www\.youtube\.com\/embed\//);
  a.match(html, /i\.ytimg\.com\/vi\/[\w-]+\/hqdefault\.jpg/, 'the poster comes from the video id');
  a.equal((html.match(/<script/g) || []).length, 1, 'one small script, only because a facade is present');
  /* turning it off restores the eager embed and drops the script */
  v.props.facade = 0;
  const eager = C.buildPage(C.state.pages[0]);
  a.match(eager, /<iframe[^>]+youtube\.com\/embed/);
  a.equal(/<script/.test(eager), false);
});

test('autoplay bypasses the facade, since a click is no longer the trigger', () => {
  blank();
  const v = insert('video', null, 0);
  v.props.autoplay = 1;
  a.equal(C.canFacade(v.props), false);
  a.match(C.buildPage(C.state.pages[0]), /<iframe/);
});

test('a self-hosted file is never facaded', () => {
  blank();
  const v = insert('video', null, 0);
  v.props.src = 'https://cdn.example.com/clip.mp4';
  a.equal(C.canFacade(v.props), false);
  a.match(C.buildPage(C.state.pages[0]), /<video src="https:\/\/cdn\.example\.com\/clip\.mp4"/);
});

test('a site URL turns on canonical, og:url and absolute share images', () => {
  C.state.meta.baseUrl = 'https://pagecraft.dev/';
  C.state.meta.ogImage = 'social.png';
  C.state.meta.lang = 'en-GB';
  C.state.meta.favicon = '/favicon.svg';
  const html = C.buildPage(C.state.pages[0]);
  a.match(html, /<html lang="en-GB">/);
  a.match(html, /<link rel="canonical" href="https:\/\/pagecraft\.dev\/index\.html">/);
  a.match(html, /<meta property="og:url" content="https:\/\/pagecraft\.dev\/index\.html">/);
  a.match(html, /<meta property="og:image" content="https:\/\/pagecraft\.dev\/social\.png">/);
  a.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  a.match(html, /<link rel="icon" href="\/favicon\.svg">/);
});

test('a page share image overrides the project one, and absolute URLs pass through', () => {
  C.state.meta.baseUrl = 'https://pagecraft.dev';
  C.state.meta.ogImage = 'social.png';
  C.state.pages[0].ogImage = 'https://cdn.example.com/hero.jpg';
  a.match(C.buildPage(C.state.pages[0]), /og:image" content="https:\/\/cdn\.example\.com\/hero\.jpg"/);
});

test('without a site URL there is no canonical and no sitemap', () => {
  C.state.meta.baseUrl = '';
  const html = C.buildPage(C.state.pages[0]);
  a.equal(/rel="canonical"/.test(html), false);
  a.equal(C.sitemapXml(), '');
  a.match(C.robotsTxt(), /^User-agent: \*/);
  a.equal(/Sitemap:/.test(C.robotsTxt()), false);
});

test('sitemap lists every page against the site URL', () => {
  C.state.meta.baseUrl = 'https://pagecraft.dev';
  const xml = C.sitemapXml();
  a.match(xml, /^<\?xml version="1.0"/);
  C.state.pages.forEach(p => a.match(xml, new RegExp('<loc>https://pagecraft\\.dev/' + p.slug + '\\.html</loc>')));
  a.equal((xml.match(/<url>/g) || []).length, C.state.pages.length);
  a.match(C.robotsTxt(), /Sitemap: https:\/\/pagecraft\.dev\/sitemap\.xml/);
});

/* ---------------------------------------------------- reusable style classes */
test('a class is emitted once and shared by every element using it', () => {
  blank();
  const a1 = insert('heading', null, 0), a2 = insert('heading', null, 1);
  const id = C.classAdd('Card', { d: { 'border-radius': '16px', 'padding-top': '28px' } });
  C.classApply(a1, id); C.classApply(a2, id);
  const { base } = blocks(C.treeCss([C.state.pages[0].tree], false));
  a.equal((base.match(/\.c-card\{/g) || []).length, 1, 'one rule, not one per element');
  a.match(C.renderNode(a1, { edit: false }), /class="[^"]*\bc-card\b/);
  a.match(C.renderNode(a2, { edit: false }), /class="[^"]*\bc-card\b/);
  a.equal(C.classUsage(id), 2);
});

test('precedence runs text style, then class, then the element', () => {
  blank();
  const h = insert('heading', null, 0);
  C.tsApply(h, 'title');
  const id = C.classAdd('Loud', { d: { 'font-size': '80px' } });
  C.classApply(h, id);
  const css = C.treeCss([C.state.pages[0].tree], false);
  const iTs = css.indexOf('.ts-title{'), iCls = css.indexOf('.c-loud{'), iEl = css.indexOf('.' + C.nodeClass(h) + '{');
  a.ok(iTs > -1 && iCls > -1, 'both preset rules are present');
  a.ok(iTs < iCls, 'a class overrides a text style');
  if (iEl > -1) a.ok(iCls < iEl, 'the element overrides its class');
});

test('list order decides which of two classes wins', () => {
  blank();
  const h = insert('heading', null, 0);
  const first = C.classAdd('First', { d: { color: '#111111' } });
  const second = C.classAdd('Second', { d: { color: '#222222' } });
  C.classApply(h, first); C.classApply(h, second);
  let css = C.treeCss([C.state.pages[0].tree], false);
  a.ok(css.indexOf('.c-first{') < css.indexOf('.c-second{'), 'Second is defined later, so it wins');
  C.classMove(second, -1);
  css = C.treeCss([C.state.pages[0].tree], false);
  a.ok(css.indexOf('.c-second{') < css.indexOf('.c-first{'), 'raising it flips precedence');
});

test('saving a class from an element moves the styling off the element', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d['border-radius'] = '12px';
  h.css.m['border-radius'] = '6px';
  const id = C.classFrom(h, 'Rounded');
  a.equal(klass(id).css.d['border-radius'], '12px');
  a.equal(klass(id).css.m['border-radius'], '6px', 'breakpoints come along');
  a.deepEqual(h.css, { d: {}, t: {}, m: {} }, 'the element no longer carries it');
  a.ok((h.cls || []).includes(id));
  /* and the rendered result is unchanged */
  a.match(C.treeCss([C.state.pages[0].tree], false), /\.c-rounded\{[^}]*border-radius:12px/);
});

test('deleting a class bakes it into its users so nothing moves', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = C.classAdd('Pad', { d: { 'padding-top': '40px' }, m: { 'padding-top': '20px' } });
  C.classApply(h, id);
  h.css.d['padding-top'] = '50px';                 // a local override must survive
  C.classDelete(id);
  a.equal(C.findClass(id), null);
  a.equal((h.cls || []).length, 0);
  a.equal(h.css.d['padding-top'], '50px', 'the element override wins on the way out');
  a.equal(h.css.m['padding-top'], '20px', 'and the class value is kept where there was none');
});

test('removing a class from one element leaves the others alone', () => {
  blank();
  const a1 = insert('heading', null, 0), a2 = insert('heading', null, 1);
  const id = C.classAdd('Shared', { d: { color: '#333333' } });
  C.classApply(a1, id); C.classApply(a2, id);
  C.classRemove(a1, id);
  a.equal(C.classUsage(id), 1);
  a.ok(klass(id), 'the class itself survives');
  a.equal(/c-shared/.test(C.renderNode(a1, { edit: false })), false);
  a.match(C.renderNode(a2, { edit: false }), /c-shared/);
});

test('class ids stay unique and a dangling reference is ignored', () => {
  blank();
  a.equal(C.classAdd('Card'), 'card');
  a.equal(C.classAdd('Card'), 'card-2');
  const h = insert('heading', null, 0);
  h.cls = ['card', 'ghost'];
  a.deepEqual(C.nodeClasses(h).map(c => c.id), ['card'], 'the unknown id is dropped');
  a.equal(/c-ghost/.test(C.renderNode(h, { edit: false })), false);
});

test('a class can carry breakpoint overrides of its own', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = C.classAdd('Stack', { d: { 'flex-direction': 'row' }, m: { 'flex-direction': 'column' } });
  C.classApply(h, id);
  const { base, mobile } = blocks(C.treeCss([C.state.pages[0].tree], false));
  a.match(base, /\.c-stack\{[^}]*flex-direction:row/);
  a.match(mobile, /\.c-stack\{[^}]*flex-direction:column/);
});

test('the contrast check reads colours coming from a class', () => {
  blank();
  const sec = C.N('section', {}, { d: { 'background-color': '#f8f6ef' } }, []);
  C.state.pages[0].tree.push(sec);
  const row = C.makeFor('columns'); sec.children.push(row);
  const h = C.N('heading', { text: 'Hi', ts: '' }, { d: { 'font-size': '14px' } });
  row.children[0].children.push(h);
  const id = C.classAdd('Faint', { d: { color: '#cccccc' } });
  C.classApply(h, id);
  a.equal(find(C.lint(), 'contrast').length, 1, 'a class-supplied colour is still measured');
});

test('migration brings an older project all the way forward', () => {
  const d = C.migrate({ v: 3, meta: { tokens: { colors: [], text: [] } }, pages: [{ tree: [] }] });
  a.equal(d.v, C.SCHEMA);
  a.deepEqual(d.meta.tokens.classes, [], 'v3 → v4 adds the class list');
  /* and a v2 project passes through every step */
  const old = C.migrate({ v: 2, meta: { accent: '#00ff00' }, pages: [{ tree: [] }] });
  a.equal(old.v, C.SCHEMA);
  a.ok(Array.isArray(old.meta.tokens.classes));
  a.equal(old.meta.tokens.colors.find((c: ColorToken) => c.id === 'brand').value, '#00ff00');
});

test('v4 → v5 backfills the HTML tag onto the stock text styles', () => {
  const d = C.migrate({
    v: 4,
    meta: { tokens: { colors: [], classes: [], text: [{ id: 'display', name: 'D', css: { d: {}, t: {}, m: {} } }, { id: 'mine', name: 'Mine', css: { d: {}, t: {}, m: {} } }] } },
    pages: [{ tree: [] }]
  });
  a.equal(d.meta.tokens.text.find((t: TextStyle) => t.id === 'display').tag, 'h1');
  a.equal(d.meta.tokens.text.find((t: TextStyle) => t.id === 'mine').tag, undefined, 'a custom style is left alone');
});

test('applying a text style also takes the tag that belongs with it', () => {
  blank();
  const h = insert('heading', null, 0);
  h.props.level = 'h4';
  C.tsApply(h, 'display');
  a.equal(h.props.level, 'h1', 'one choice, not two');
  C.tsApply(h, 'subtitle');
  a.equal(h.props.level, 'h3');
  /* a style with no tag leaves the tag alone */
  style('subtitle').tag = '';
  h.props.level = 'h5';
  C.tsApply(h, 'subtitle');
  a.equal(h.props.level, 'h5');
  /* and it only applies to headings */
  const t = insert('text', null, 1);
  t.props.level = undefined;
  C.tsApply(t, 'display');
  a.equal(t.props.level, undefined);
});

test('pages can be reordered, and the current page follows', () => {
  fresh();
  const names = () => C.state.pages.map(p => p.name);
  a.deepEqual(names(), ['Home', 'Pricing']);
  C.state.cur = 0;
  a.equal(pageMove(0, 1), true);
  a.deepEqual(names(), ['Pricing', 'Home']);
  a.equal(C.page().name, 'Home', 'the page you were editing is still the current one');
  a.equal(pageMove(1, 1), false, 'already last');
  a.equal(pageMove(0, -1), false, 'already first');
});

test('page order drives the sitemap order', () => {
  fresh();
  C.state.meta.baseUrl = 'https://x.dev';
  const before = C.sitemapXml().match(/<loc>[^<]+<\/loc>/g);
  pageMove(0, 1);
  const after = C.sitemapXml().match(/<loc>[^<]+<\/loc>/g);
  a.deepEqual(after, [must(before, 'sitemap')[1], must(before, 'sitemap')[0]]);
});

test('the demo shares one Card class across its three feature cards', () => {
  const card = C.classes().find(c => c.id === 'card');
  a.ok(card, 'the demo ships a Card class');
  a.equal(C.classUsage('card'), 3);
  const { base, mobile } = blocks(C.treeCss([C.state.pages[0].tree], false));
  a.equal((base.match(/\.c-card\{/g) || []).length, 1, 'declared once for all three');
  a.match(base, /\.c-card\{[^}]*border-radius:16px/);
  a.match(mobile, /\.c-card\{[^}]*padding-top:22px/, 'and once more for its mobile override');
});

/* ------------------------------------------------------ clipboard + keys */
test('a copied element pastes as a sibling with fresh ids', () => {
  blank();
  const h = insert('heading', null, 0);
  h.props.text = 'Original';
  C.copyNode(h.id);
  const made = paste(h.id);
  a.ok(made);
  a.equal(made.props.text, 'Original');
  a.notEqual(made.id, h.id, 'the copy gets its own id');
  const col = holderOf(h.id);
  a.deepEqual(col.children.map(c => c.type), ['heading', 'heading']);
  a.equal(col.children[1].id, made.id, 'it lands directly after the original');
});

test('pasting a subtree reissues every descendant id', () => {
  blank();
  insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  const before: string[] = [];
  C.eachNode([sec], n => before.push(n.id));
  C.copyNode(sec.id);
  const made = paste(sec.id);
  const after: string[] = [];
  C.eachNode([made], n => after.push(n.id));
  a.equal(after.length, before.length);
  a.equal(after.some(id => before.includes(id)), false);
});

test('the clipboard survives a page change, so copies cross pages', () => {
  fresh();
  const h = insert('heading', null, 0);
  h.props.text = 'Travelling';
  C.copyNode(h.id);
  C.state.cur = 1;                                  // a different page
  const target = C.state.pages[1].tree[0];
  const landed = paste(target.id);
  a.ok(landed, 'it fits inside a section on the other page');
  a.equal(landed.props.text, 'Travelling');
  a.ok(at(landed.id), 'and it is now part of page two');
});

test('paste builds the wrappers a drag would, rather than refusing', () => {
  blank();
  const h = insert('heading', null, 0);          // section > row > column > heading
  C.copyNode(h.id);
  const row = holderOf(holderOf(h.id).id);
  const made = paste(row.id);                // a row holds columns, not headings
  a.ok(made, 'it still lands somewhere sensible');
  a.equal(holderOf(made.id).type, 'column', 'a column was created for it');

  /* and at the root it grows the full section > row > column chain */
  blank();
  const leaf = insert('heading', null, 0);
  C.copyNode(leaf.id);
  C.state.pages[0].tree = [];
  const atRoot = paste(null);
  a.ok(atRoot);
  const chain = [];
  let cur = at(atRoot.id);
  let up: Handle | null = cur;
  while (up) { chain.unshift(up.node.type); up = up.parent ? at(up.parent.id) : null; }
  a.deepEqual(chain, ['section', 'row', 'column', 'heading']);
});

test('a copied class reference keeps following the class', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = C.classAdd('Shared', { d: { color: '#333333' } });
  C.classApply(h, id);
  C.copyNode(h.id);
  const made = paste(h.id);
  a.deepEqual(made.cls, [id], 'the copy shares the class, not a snapshot of it');
  a.equal(C.classUsage(id), 2);
  klass(id).css.d.color = '#444444';
  a.match(C.treeCss([C.state.pages[0].tree], false), /\.c-shared\{[^}]*color:#444444/);
});

test('arrow traversal walks the tree in reading order', () => {
  blank();
  insert('heading', null, 0);
  const flat = C.flatten(C.state.pages[0].tree).map(n => n.type);
  a.deepEqual(flat, ['section', 'row', 'column', 'heading']);

  const sec = C.state.pages[0].tree[0];
  a.equal(C.step(null, 1), sec.id, 'with nothing selected it starts at the top');
  const row = sec.children[0];
  a.equal(C.step(sec.id, 1), row.id);
  a.equal(C.step(row.id, -1), sec.id);
  const last = C.flatten(C.state.pages[0].tree).pop();
  a.equal(C.step(last.id, 1), last.id, 'it stops at the end rather than wrapping');
});

test('left and right move by depth', () => {
  blank();
  insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  const row = sec.children[0];
  a.equal(C.firstChildOf(sec.id), row.id);
  a.equal(C.parentOf(row.id), sec.id);
  a.equal(C.parentOf(sec.id), null, 'a top-level section has no parent to reach');
  const leaf = C.flatten(C.state.pages[0].tree).pop();
  a.equal(C.firstChildOf(leaf.id), null);
});

test('nudge reorders among siblings and stops at the ends', () => {
  blank();
  const row = C.makeFor('columns');
  C.state.pages[0].tree.push(C.N('section', {}, {}, [row]));
  const [a1, a2] = row.children;
  a.equal(C.nudge(a2.id, -1), true);
  a.deepEqual(row.children.map(c => c.id), [a2.id, a1.id]);
  a.equal(C.nudge(a2.id, -1), false, 'already first');
  a.equal(C.nudge(a1.id, 1), false, 'already last');
});

/* ------------------------------------------------------------ link picker */
test('a link is parsed into a destination, not left as a string', () => {
  fresh();
  a.deepEqual(C.parseLink('', 'index'), { mode: 'none' });
  a.deepEqual(C.parseLink('pricing.html', 'index'), { mode: 'page', page: 'pricing', frag: '' });
  a.deepEqual(C.parseLink('index.html#craft', 'index'), { mode: 'page', page: 'index', frag: 'craft' });
  a.deepEqual(C.parseLink('https://example.com', 'index'), { mode: 'url', value: 'https://example.com' });
  a.deepEqual(C.parseLink('mailto:a@b.c', 'index'), { mode: 'email', value: 'a@b.c' });
  a.deepEqual(C.parseLink('TEL:+15550100', 'index'), { mode: 'phone', value: '+15550100' });
});

test('a bare fragment is read as belonging to its own page', () => {
  fresh();
  a.deepEqual(C.parseLink('#craft', 'index'), { mode: 'page', page: 'index', frag: 'craft' },
    'so it keeps working when the element moves into a global region');
  a.equal(C.buildLink(C.parseLink('#craft', 'index')), 'index.html#craft');
});

test('a link to a page that no longer exists degrades to a plain URL', () => {
  fresh();
  a.deepEqual(C.parseLink('ghost.html', 'index'), { mode: 'url', value: 'ghost.html' },
    'it is shown as-is rather than silently pointing at a real page');
});

test('building a link round-trips every mode', () => {
  fresh();
  const trip = (h: string) => C.buildLink(C.parseLink(h, 'index'));
  ['pricing.html', 'index.html#craft', 'https://example.com/a?b=c', 'mailto:a@b.c', 'tel:+15550100', '']
    .forEach(h => a.equal(trip(h), h, h + ' survives a round trip'));
  a.equal(C.buildLink({ mode: 'page', page: '' }), '', 'an incomplete destination yields no href');
  a.equal(C.buildLink({ mode: 'email', value: '' }), '');
  a.equal(C.buildLink(null), '');
});

test('the anchor list offers what the target page really has', () => {
  fresh();
  const home = C.anchorsOf('index');
  a.ok(home.includes('craft') && home.includes('contact'), 'the demo anchors: ' + home.join(', '));
  a.deepEqual(C.anchorsOf('pricing'), [], 'the pricing page defines none');
  /* globals count, since they render on every page */
  C.state.header[0].adv.htmlId = 'top';
  a.ok(C.anchorsOf('pricing').includes('top'));
});

test('every link a picker can build passes the export review', () => {
  fresh();
  const btn = insert('button', null, 0);
  [['page', { mode: 'page', page: 'pricing', frag: '' }],
  ['page+anchor', { mode: 'page', page: 'index', frag: 'craft' }],
  ['url', { mode: 'url', value: 'https://example.com' }],
  ['email', { mode: 'email', value: 'a@b.c' }],
  ['phone', { mode: 'phone', value: '+15550100' }],
  ['none', { mode: 'none' }]].forEach(([what, o]) => {
    btn.props.link = C.buildLink(o);
    const bad = C.lint().filter(f => ['dead-link', 'dead-anchor', 'global-fragment', 'empty-anchor'].includes(f.code));
    a.equal(bad.length, 0, what + ' should not produce a link finding, got ' + JSON.stringify(bad.map(b => b.code)));
  });
});

test('the language list is offered as codes with names', () => {
  a.ok(C.LANGS.length > 15);
  C.LANGS.forEach(([code, name]) => {
    a.match(code, /^[a-z]{2}(-[A-Z]{2})?$/, code + ' is a BCP-47 tag');
    a.ok(name.length > 2, code + ' has a readable name');
  });
  a.ok(C.LANGS.some(([c]) => c === 'en'));
});

/* -------------------------------------------------------------------- forms */
test('a form renders labelled, named fields and a submit button', () => {
  blank();
  const fm = insert('form', null, 0);
  fm.props.action = 'https://formspree.io/f/abc';
  const html = C.renderNode(fm, { edit: false });
  a.match(html, /^<form /);
  a.match(html, /action="https:\/\/formspree\.io\/f\/abc" method="post"/);
  a.match(html, /<label for="[^"]+">Name <span aria-hidden="true">\*<\/span><\/label>/);
  a.match(html, /<input id="[^"]+" name="name" type="text" required>/);
  a.match(html, /<textarea id="[^"]+" name="message" rows="4">/);
  a.match(html, /<button type="submit" class="pagecraft-form-button">Send<\/button>/);
  /* every label points at a real id */
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  [...html.matchAll(/for="([^"]+)"/g)].forEach(m => a.ok(ids.includes(m[1]), m[1] + ' has no matching field'));
});

test('each field type renders the right control', () => {
  blank();
  const fm = insert('form', null, 0);
  fm.props.action = 'https://x.dev/f';
  fm.props.fields = [
    { type: 'email', label: 'Email', name: 'email' },
    { type: 'textarea', label: 'Note', name: 'note' },
    { type: 'select', label: 'Plan', name: 'plan', opts: 'Small, Large' },
    { type: 'checkbox', label: 'Subscribe', name: 'sub' }
  ];
  const html = C.renderNode(fm, { edit: false });
  a.match(html, /type="email"/);
  a.match(html, /<textarea/);
  a.match(html, /<option value="Small">Small<\/option><option value="Large">Large<\/option>/);
  a.match(html, /type="checkbox"/);
  a.match(html, /pagecraft-field-check/, 'a checkbox lays out inline with its label');
});

test('a form with nowhere to submit is an error, not a shrug', () => {
  blank();
  const fm = insert('form', null, 0);
  a.equal(find(C.lint(), 'form-no-action').length, 1);
  a.match(C.renderNode(fm, { edit: false }), /^<form [^>]*>(?!.*action=)/s, 'and no action attribute is emitted');
  fm.props.action = 'https://formspree.io/f/abc';
  a.equal(find(C.lint(), 'form-no-action').length, 0);
  fm.props.action = 'mailto:hi@example.com';
  a.equal(find(C.lint(), 'form-no-action').length, 0, 'a mailto counts');
  a.match(C.renderNode(fm, { edit: false }), /action="mailto:hi@example\.com"/);
});

test('an unlabelled field and a duplicate name are both reported', () => {
  blank();
  const fm = insert('form', null, 0);
  fm.props.action = 'https://x.dev/f';
  fm.props.fields = [{ type: 'text', label: '', name: 'a' }, { type: 'text', label: 'Two', name: 'a' }];
  const f = C.lint();
  a.equal(find(f, 'field-no-label').length, 1);
  a.equal(find(f, 'field-dup-name').length, 1);
  a.match(find(f, 'field-dup-name')[0].msg, /overwrite/);
});

test('a field with no name falls back to its label', () => {
  blank();
  const fm = insert('form', null, 0);
  fm.props.action = 'https://x.dev/f';
  fm.props.fields = [{ type: 'text', label: 'Company name', name: '' }];
  a.match(C.renderNode(fm, { edit: false }), /name="company-name"/);
  a.equal(find(C.lint(), 'field-dup-name').length, 0);
});

test('a javascript: action is refused like any other link', () => {
  blank();
  const fm = insert('form', null, 0);
  fm.props.action = 'javascript:alert(1)';
  const html = C.renderNode(fm, { edit: false });
  a.equal(/javascript:/i.test(html), false);
  a.equal(/action=/.test(html), false, 'it degrades to a form that submits nowhere');
});

test('the form takes its colours from tokens so a rebrand reaches it', () => {
  blank();
  const fm = insert('form', null, 0);
  const css = C.treeCss([C.state.pages[0].tree], false);
  const rule = css.slice(css.indexOf('.' + C.nodeClass(fm) + '{'));
  const decls = rule.slice(0, rule.indexOf('}'));
  a.ok(decls.includes('--f-btn-bg:var(--c-brand)'), 'button colour is a token reference');
  a.ok(decls.includes('--f-bg:var(--c-surface)'), 'field background is a token reference');
  a.ok(must(C.contrast(fm.css.d['--f-btn-fg'], fm.css.d['--f-btn-bg']), 'contrast') > 4.5, 'and its button is readable');
});

test('a form on a dark section is told its labels have gone unreadable', () => {
  blank();
  const sec = C.N('section', {}, { d: { 'background-color': C.cvar('ink') } }, []);
  C.state.pages[0].tree.push(sec);
  const row = C.makeFor('columns');
  sec.children.push(row);
  const fm = C.N('form', { action: 'https://x.dev/f' }, {}, []);
  row.children[0].children.push(fm);
  const f = find(C.lint(), 'form-contrast');
  a.equal(f.length, 1, 'the light-section default label colour is caught');
  a.match(f[0].msg, /Field labels/);
  /* pointing them at the inverted token clears it */
  fm.css.d['--f-label'] = C.cvar('muted-i');
  a.equal(find(C.lint(), 'form-contrast').length, 0);
});

test('the submit button and field text are checked against their own grounds', () => {
  blank();
  const fm = insert('form', null, 0);
  fm.props.action = 'https://x.dev/f';
  a.equal(find(C.lint(), 'form-contrast').length, 0, 'the defaults are readable on Paper');
  fm.css.d['--f-btn-fg'] = C.cvar('bg');            // Paper on Craft Green — 1.22:1
  const f = find(C.lint(), 'form-contrast');
  a.equal(f.length, 1);
  a.match(f[0].msg, /submit button label/);
});

/* ------------------------------------------------------- blocks + templates */
test('a saved block places a fresh copy that still follows its classes', () => {
  fresh();
  const craft = C.state.pages[0].tree[1];
  const originalIds = new Set();
  C.eachNode([craft], n => originalIds.add(n.id));
  const id = blockSave(craft.id, 'Feature trio');
  a.equal(id, 'feature-trio');
  a.equal(C.blocks().length, 1);

  C.state.cur = 1;                                    // a different page
  const before = C.classUsage('card');
  const made = blockInsert(id, null, 0);
  a.ok(made);
  a.equal(made.type, 'section');
  a.equal(C.classUsage('card'), before + 3, 'the copy shares the class, not a snapshot');
  let clash = false;
  C.eachNode([made], n => { if (originalIds.has(n.id)) clash = true; });
  a.equal(clash, false, 'every id in the copy is new');
});

test('a block finds a legal home when dropped somewhere it cannot sit', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = blockSave(h.id, 'Just a heading');
  const row = holderOf(holderOf(h.id).id);
  const made = blockInsert(id, row, 0);            // a row holds columns
  a.ok(made);
  a.equal(holderOf(made.id).type, 'column', 'a column was created for it');
});

test('forgetting a block leaves the copies already placed alone', () => {
  fresh();
  const id = blockSave(C.state.pages[0].tree[1].id, 'Trio');
  const made = blockInsert(id, null, 0);
  C.blockDelete(id);
  a.equal(C.findBlock(id), null);
  a.ok(at(made.id), 'the copy on the page survives');
});

test('every template builds real structure from the project tokens', () => {
  fresh();
  C.TEMPLATES.forEach(t => {
    const pg = pageFromTemplate(t.id, t.name);
    let n = 0;
    C.eachNode(pg.tree, () => n++);
    if (t.id === 'blank') { a.equal(n, 0); return; }
    a.ok(n > 5, t.id + ' has structure');
    /* it must be valid: sections at the root, rows in sections, and so on */
    pg.tree.forEach((node: PcNode) => a.equal(node.type, 'section', t.id + ' puts sections at the root'));
    C.state.pages.push(pg);
    const html = C.buildPage(pg);
    a.match(html, /^<!doctype html>/);
    a.ok(html.includes('var(--c-'), t.id + ' references colour tokens');
    C.state.pages.pop();
  });
});

test('a template page gets a unique slug', () => {
  fresh();
  const a1 = pageFromTemplate('contact', 'Contact');
  C.state.pages.push(a1);
  const a2 = pageFromTemplate('contact', 'Contact');
  a.equal(a1.slug, 'contact');
  a.equal(a2.slug, 'contact-2');
});

test('the contact template ships a form that the review then asks you to wire up', () => {
  fresh();
  const pg = pageFromTemplate('contact', 'Contact');
  C.state.pages.push(pg);
  C.state.cur = C.state.pages.length - 1;
  let hasForm = false;
  C.eachNode(pg.tree, n => { if (n.type === 'form') hasForm = true; });
  a.ok(hasForm);
  a.equal(find(C.lint(), 'form-no-action').length, 1, 'and it tells you the endpoint is missing');
});

test('migration v5 to v6 adds the block list', () => {
  const d = C.migrate({ v: 5, meta: { tokens: { colors: [], text: [], classes: [] } }, pages: [{ tree: [] }] });
  a.equal(d.v, C.SCHEMA);
  a.deepEqual(d.meta.blocks, []);
});

/* ------------------------------------------------- namespaced class and id */
test('every exported element carries a pagecraft class and an id', () => {
  fresh();
  const html = C.buildPage(C.state.pages[0]);
  const tags = html.match(/<(?:section|header|footer|div|nav|form|h1|h2|h3|p|a|img|hr|button|figure)\b[^>]*>/g) || [];
  const styled = tags.filter(t => t.includes('class="'));
  a.ok(styled.length > 20, 'a real page worth checking');
  styled.forEach(t => a.match(t, /class="pagecraft-[\w-]+/, 'unnamespaced class in ' + t.slice(0, 70)));
  /* every element that owns a class also owns an id, so it can be linked to */
  tags.filter(t => /class="pagecraft-[\w-]+ pagecraft-/.test(t))
    .forEach(t => a.match(t, /\bid="[\w-]+"/, 'no id on ' + t.slice(0, 70)));
});

test('the class names come from the widget names', () => {
  a.equal(C.widgetSlug('heading'), 'heading');
  a.equal(C.widgetSlug('text'), 'wysiwyg');
  a.equal(C.widgetSlug('nav'), 'nav-menu');
  a.equal(C.widgetSlug('form'), 'form');
  a.equal(C.widgetSlug('columns' in C.DEF ? 'columns' : 'column'), 'column');
});

test('the auto id is readable, stable and namespaced', () => {
  blank();
  const h = insert('heading', null, 0);
  a.match(C.autoId(h), /^pagecraft-heading-[a-z0-9]+$/);
  a.equal(C.autoId(h), C.autoId(h), 'stable across calls');
  a.equal(C.domIdOf(h), C.autoId(h));
  a.match(C.renderNode(h, { edit: false }), new RegExp('id="' + C.autoId(h) + '"'));
});

test('an Advanced anchor overrides the auto id verbatim', () => {
  blank();
  const h = insert('heading', null, 0);
  h.adv.htmlId = 'pricing-table';
  a.equal(C.domIdOf(h), 'pricing-table');
  a.match(C.renderNode(h, { edit: false }), /id="pricing-table"/);
  a.equal(/pagecraft-heading-/.test(C.renderNode(h, { edit: false }).split('class=')[0]), false,
    'the override is used, not appended to');
  /* and the styling hook is unaffected, so its CSS still applies */
  h.css.d.color = '#123456';
  a.match(C.treeCss([C.state.pages[0].tree], false), new RegExp('\\.' + C.nodeClass(h) + '\\{[^}]*color:#123456'));
});

test('the editor addresses elements by node id, the export by the readable one', () => {
  blank();
  const h = insert('heading', null, 0);
  a.match(C.renderNode(h, { edit: true }), new RegExp('id="' + h.id + '"'));
  a.match(C.renderNode(h, { edit: false }), new RegExp('id="' + C.autoId(h) + '"'));
});

test('an auto id can be used as a link target', () => {
  fresh();
  const btn = insert('button', null, 0);
  const target = C.state.pages[0].tree[0];
  btn.props.link = 'index.html#' + C.autoId(target);
  a.equal(find(C.lint(), 'dead-anchor').length, 0, 'the review resolves it');
});

/* ------------------------------------------------------- the selection set
   Multi-select keeps one primary in `state.ui.sel` and the rest in `multi`, so
   every single-selection path in the app is untouched. These cover the set
   operations and, more importantly, the two places a set can act twice on one
   node or reach a field that node has no business holding. */

/* three headings in one column — the shape behind "styling three cards" */
const trio = () => {
  blank();
  const h1 = insert('heading', null, 0);
  const col = holderOf(h1.id);
  const h2 = insert('heading', col, 1);
  const h3 = insert('heading', col, 2);
  return { col, ids: [h1.id, h2.id, h3.id] };
};

test('the primary comes first and dead members drop out', () => {
  const { ids } = trio();
  C.selSet(ids);
  a.equal(C.state.ui.sel, ids[0]);
  a.deepEqual(C.selIds(), ids);
  a.equal(C.multiOn(), true);
  C.state.ui.multi.push(ids[2], 'ghost');     // a duplicate and an id with no node
  a.deepEqual(C.selIds(), ids, 'deduped, and the missing node is not reported as selected');
});

test('toggling the primary out promotes the next member', () => {
  const { ids } = trio();
  C.selSet([ids[1]]);
  C.selToggle(ids[2]);
  a.deepEqual(C.selIds(), [ids[1], ids[2]]);
  C.selToggle(ids[1]);                        // drop the primary itself
  a.deepEqual(C.selIds(), [ids[2]], 'the survivor becomes the primary');
  a.equal(C.state.ui.sel, ids[2], 'so the inspector always has a key object');
  C.selToggle(ids[2]);
  a.deepEqual(C.selIds(), []);
  a.equal(C.state.ui.sel, null);
});

test('a range covers everything between, whichever way it is drawn', () => {
  const { ids } = trio();
  a.deepEqual(C.selRange(ids[0], ids[2]), ids);
  a.deepEqual(C.selRange(ids[2], ids[0]), ids, 'dragging upwards gives the same set');
  a.deepEqual(C.selRange(ids[1], ids[1]), [ids[1]]);
});

test('a range never reaches inside a collapsed row', () => {
  /* the Navigator is the list a range sweeps, so it has to agree with what that
     list is actually showing */
  const { col, ids } = trio();
  const sec = C.state.pages[0].tree[0], row = sec.children[0];
  a.ok(C.selRange(sec.id, ids[2]).includes(ids[1]), 'expanded, the headings are in range');
  C.state.ui.collapsed[col.id] = true;
  const shut = C.selRange(sec.id, col.id);
  a.deepEqual(shut, [sec.id, row.id, col.id], 'collapsed, the range stops at the column');
  a.equal(shut.some(id => ids.includes(id)), false, 'its hidden children are left out');
});

test('a member that sits inside another member is not counted twice', () => {
  blank();
  const h = insert('heading', null, 0);
  const col = holderOf(h.id), sec = C.state.pages[0].tree[0];
  a.deepEqual(C.topMost([sec.id, col.id, h.id]), [sec.id], 'the section already contains the other two');
  a.deepEqual(C.topMost([col.id, h.id]), [col.id]);
});

test('deleting a set takes every member and leaves a live selection', () => {
  const { col, ids } = trio();
  C.selSet(ids);
  a.equal(C.delMany(C.selIds()), 3);
  a.equal(col.children.length, 0);
  a.equal(C.state.ui.sel, col.id, 'the parent takes over');
  a.deepEqual(C.state.ui.multi, []);
});

test('deleting a parent and its child does not delete twice', () => {
  blank();
  const h = insert('heading', null, 0);
  const col = holderOf(h.id), sec = C.state.pages[0].tree[0];
  a.equal(C.delMany([sec.id, col.id, h.id]), 1, 'one act, on the outermost');
  a.equal(C.state.pages[0].tree.length, 0);
  a.equal(C.state.ui.sel, null, 'nothing is left to select');
});

test('duplicating a set copies each member and selects the copies', () => {
  const { col, ids } = trio();
  C.selSet(ids);
  a.equal(C.dupMany(C.selIds()), 3);
  a.equal(col.children.length, 6);
  const made = C.selIds();
  a.equal(made.length, 3);
  a.equal(made.some(id => ids.includes(id)), false, 'the copies are selected, not the originals');
  a.equal(new Set(col.children.map(c => c.id)).size, 6, 'every copy got a fresh id');
});

test('a set reorders as a block and stops at the end', () => {
  const { col, ids } = trio();
  const [x, y, z] = ids;
  a.equal(C.nudgeMany([y, z], -1), true);
  a.deepEqual(col.children.map(c => c.id), [y, z, x], 'the pair moved up together');
  a.equal(C.nudgeMany([y, z], -1), false, 'already against the top');
  a.equal(C.nudgeMany([y, z], 1), true);
  a.deepEqual(col.children.map(c => c.id), [x, y, z]);
});

test('a style edit reaches every member, a content field only those that have it', () => {
  blank();
  const h = insert('heading', null, 0);
  const col = holderOf(h.id);
  const b = insert('button', col, 1);
  const ids = [h.id, b.id];
  C.selSet(ids);

  const css = C.fanTargets({ c: 'padding' }, ids);
  a.deepEqual(css.map(n => n.type), ['heading', 'button'], 'a CSS property is universal');

  const shared = C.fanTargets({ k: 'text' }, ids);
  a.deepEqual(shared.map(n => n.type), ['heading', 'button'], 'both declare a text field');

  const only = C.fanTargets({ k: 'level' }, ids);
  a.deepEqual(only.map(n => n.type), ['heading'], 'a button has no heading level to set');

  const id = C.fanTargets({ k: '_id' }, ids);
  a.deepEqual(id.map(n => n.type), ['heading'], 'two elements cannot share one HTML id');
});

test('undo retires members whose node it removed', () => {
  const { ids } = trio();
  C.selSet(ids);
  C.edit(() => C.delNode(ids[2]));             // history now holds the trio
  C.selSet(ids.slice(0, 2));
  C.undo();
  a.deepEqual(C.selIds(), ids.slice(0, 2), 'the restored third is not silently re-selected');
  C.selSet(ids);
  C.redo();                                    // the third node goes again
  a.deepEqual(C.selIds(), ids.slice(0, 2), 'and the set drops it rather than pointing at nothing');
});

/* --------------------------------------------------------- template library
   The library shipped a flat run of H2s with no H1 on every page, under a green
   suite, because the tests asserted that templates build structure and never
   asked what that structure said. These ask. */

/* what a user actually does: add the template as a new page on a real project */
const asPage = (tid: string) => {
  fresh();
  C.state.pages.push(pageFromTemplate(tid, 'T'));
  C.state.cur = C.state.pages.length - 1;
  return C.state.pages[C.state.cur];
};
const outline = (tree: PcNode[]) => {
  const out: number[] = [];
  C.eachNode(tree, n => { const lv = String(n.props.level || ''); if (n.type === 'heading' && /^h[1-6]$/.test(lv)) out.push(+lv[1]); });
  return out;
};

test('every page template states its subject with exactly one H1', () => {
  for (const t of C.TEMPLATES) {
    if (t.id === 'blank') continue;                    // an empty page has nothing to state
    const pg = asPage(t.id);
    const h1s = outline(pg.tree).filter(l => l === 1);
    a.equal(h1s.length, 1, `“${t.name}” should have one H1, found ${h1s.length}`);
  }
});

test('no page template skips a heading level', () => {
  for (const t of C.TEMPLATES) {
    const levels = outline(asPage(t.id).tree);
    for (let i = 1; i < levels.length; i++)
      a.ok(levels[i] - levels[i - 1] <= 1,
        `“${t.name}” jumps from H${levels[i - 1]} to H${levels[i]}, which breaks screen-reader navigation`);
  }
});

/* The review is the contract with the user, so a template must not open on
   problems the user did not cause. Page title, description and the image and
   form placeholders are theirs to fill in — everything else is ours. */
/* Findings that belong to the author, not to the template: a slot to fill, a
   title to write, an endpoint to paste. `gallery-no-image` is one of these for
   the same reason `no-image` is — a template ships somewhere to put an image. */
const THEIRS = ['no-title', 'no-desc', 'no-image', 'no-dimensions', 'form-no-action', 'no-h1', 'gallery-no-image'];

test('no page template lands with a problem of its own making', () => {
  for (const t of C.TEMPLATES) {
    asPage(t.id);
    const mine = C.lint().filter(f => !THEIRS.includes(f.code));
    a.deepEqual(mine.map(f => f.code), [], `“${t.name}” reports ${mine.map(f => f.code).join(', ')}`);
  }
});

test('no section pattern lands with a problem of its own making', () => {
  /* A scoped pattern is linted where it actually goes. Inserting a header into a page body
     is a context the Templates tab no longer offers, and linting it there asks the wrong
     question — a `<header>` in an article and a `<header>` as the site header have different
     rules, `global-fragment` among them. */
  for (const p of C.PATTERNS) {
    fresh();
    C.state.ui.mode = p.scope || 'page';
    const into = p.scope === 'header' ? C.state.header : p.scope === 'footer' ? C.state.footer : C.state.pages[0].tree;
    if (p.scope) into.length = 0;
    const made = patternInsert(p.id, null, into.length);
    a.ok(made, `“${p.name}” built nothing`);
    const mine = C.lint().filter(f => !THEIRS.includes(f.code) && f.code !== 'many-h1');
    a.deepEqual(mine.map(f => f.code), [], `“${p.name}” reports ${mine.map(f => f.code).join(', ')}`);
  }
});

test('every region pattern is scoped, tagged and offered only in its region', () => {
  const region = C.PATTERNS.filter(p => p.scope);
  a.equal(region.filter(p => p.scope === 'header').length, 4, 'four headers');
  a.equal(region.filter(p => p.scope === 'footer').length, 4, 'four footers');

  region.forEach(p => {
    fresh();
    C.state.ui.mode = p.scope!;
    const into = p.scope === 'header' ? C.state.header : C.state.footer;
    into.length = 0;
    const node = patternInsert(p.id, null, 0);
    /* the landmark tag is the whole point: a region template that stayed a <section>
       would look right in the canvas and export without a landmark */
    a.equal(node.type, 'section', `${p.name} builds a section`);
    a.equal(node.props.tag, p.scope, `${p.name} sets tag=${p.scope}`);
    a.equal(p.cat, p.scope === 'header' ? 'Header' : 'Footer');

    const html = C.buildPage(C.state.pages[0]);
    a.equal((html.match(new RegExp('<' + p.scope + '[ >]', 'g')) || []).length, 1,
      `${p.name} exports exactly one <${p.scope}>`);
    a.equal(/href="#"/.test(html), false, `${p.name} exports no placeholder-# link`);
  });
});

test('a bar aligns its text on the baseline, and re-centres once the menu is an icon', () => {
  /* `align-items:center` centred the line boxes exactly — both at 33.2px, measured — and
     still read as wrong: a 19px wordmark and a 15px menu centred in their own boxes end up
     with baselines 2px apart, and the eye follows the baseline. Equal line-heights do not
     help, because the offset comes from the ascent scaling with the font size rather than
     from the leading. Baseline alignment brings it to 0.2px.

     There is no layout in this environment, so what is asserted is the structure that
     produces it. The numbers above came from measuring the real thing in a browser. */
  const rowOf = (id: string) => {
    fresh();
    C.state.ui.mode = (C.PATTERNS.find(p => p.id === id)!.scope || 'page') as any;
    const into = C.state.ui.mode === 'header' ? C.state.header : C.state.footer;
    into.length = 0;
    return must(patternInsert(id, null, 0), id).children[0];
  };

  ['header-bar', 'header-cta', 'header-ink'].forEach(id => {
    const row = rowOf(id);
    a.equal(row.css.d['align-items'], 'baseline', id + ': text beside text shares a baseline');
    /* once the menu collapses to a burger there is no baseline worth sharing, and an icon
       reads as centred or not — this left it 4.3px low at 414px. `m` is the same
       max-width:767px that `collapse:'mobile'` emits into, so the switch lands exactly
       where the menu stops being words. */
    a.equal(row.css.m['align-items'], 'center', id + ': centred once the menu is a burger');
    a.equal(row.css.d['flex-wrap'], 'nowrap', id + ': a header must not reflow to two lines');
  });

  /* a padded box among the text wants its box centred, not its baseline shared */
  const cta = rowOf('header-cta');
  const last = cta.children[cta.children.length - 1];
  a.equal(last.css.d['align-self'], 'center', 'the button column opts back out');
  a.equal(must(last.children[0], 'button').type, 'button');

  /* the slim footer has the same 19px-against-14px pairing and no menu, so it stays
     baseline at every width — and it never declared nowrap, so it must not have gained one */
  const slim = rowOf('footer-slim');
  a.equal(slim.css.d['align-items'], 'baseline');
  a.equal(slim.css.d['flex-wrap'], undefined, 'the row base class already wraps; do not override it');
  a.equal(slim.css.m['align-items'], undefined, 'nothing collapses, so nothing to re-centre');
});

test('a page pattern is never a landmark, so the two sets stay disjoint', () => {
  /* `scope` is what the Add panel routes on: every pattern is offered from every region and
     the click goes where the scope says. So the property that matters is that the sets do
     not overlap — a pattern with no scope must never build a `<header>` or `<footer>`, or it
     would land in a page body as a duplicate landmark. */
  const forPage = C.PATTERNS.filter(p => !p.scope);
  a.equal(forPage.length, C.PATTERNS.length - 8);
  a.equal(forPage.some(p => ['Header', 'Footer'].includes(p.cat)), false);
  /* and a page pattern is never a landmark, which is what makes the two sets disjoint */
  forPage.forEach(p => {
    fresh();
    const n = patternInsert(p.id, null, 0);
    a.equal(['header', 'footer'].includes(String(n.props.tag || '')), false, p.name);
  });
});

test('a heading takes its outline level from its text style', () => {
  blank();
  const sec = must(C.PATTERNS.find(p => p.id === 'hero-split'), 'hero-split pattern').build();
  C.state.pages[0].tree.push(sec);
  a.deepEqual(outline([sec]), [1], 'a display headline is the H1');
  a.match(C.renderNode(at(C.state.pages[0].tree[0].id).node, { edit: false }), /<section/);
});

test('a sourced image with the untouched default is reported', () => {
  /* The default used to be the literal string 'Descriptive alt text', which
     passed the alt check — so a hand-placed image exported meaningless alt text
     and the review stayed silent. The guidance lives in the field placeholder
     instead, where it cannot become content. */
  blank();
  const img = insert('image', null, 0);
  a.equal(img.props.alt, '', 'nothing is pre-filled that could pass for a description');
  const ctl = must(C.DEF.image.controls.content.find(c => c.k === 'alt'), 'alt control');
  a.ok(ctl.ph, 'the prompt is still there, as the placeholder');
  img.props.src = 'p.jpg';
  a.equal(find(C.lint(), 'no-alt').length, 1, 'a real image with no description is an error');
  img.props.decorative = 1;
  a.equal(find(C.lint(), 'no-alt').length, 0, 'unless it is marked decorative');
});

test('an image placeholder is not reported as an undescribed image', () => {
  blank();
  const img = insert('image', null, 0);
  img.props.alt = '';                          // as a template ships one: nothing described yet
  a.equal(find(C.lint(), 'no-alt').length, 0, 'nothing to describe until there is a source');
  a.equal(find(C.lint(), 'no-image').length, 1, 'the missing source is still reported');
  img.props.src = 'photo.jpg';
  a.equal(find(C.lint(), 'no-alt').length, 1, 'once there is an image, alt text is required');
  img.props.alt = 'A description';
  a.equal(find(C.lint(), 'no-alt').length, 0);
});

test('every pattern preview is a self-contained wireframe', () => {
  for (const p of C.PATTERNS) {
    const svg = p.preview();
    a.match(svg, /^<svg class="pvw" viewBox="0 0 96 58"/, `“${p.name}” preview is not the standard frame`);
    a.equal(/<image|href=|url\(/.test(svg), false, `“${p.name}” preview reaches outside the document`);
  }
});

test('patterns are grouped, and every group has a name', () => {
  const cats = [...new Set(C.PATTERNS.map(p => p.cat))];
  a.ok(cats.length >= 8, 'the Templates tab is worth browsing');
  for (const p of C.PATTERNS) {
    a.ok(p.cat && p.name && p.desc, `“${p.id}” is missing a category, name or description`);
    a.equal(C.PATTERNS.filter(x => x.id === p.id).length, 1, `duplicate pattern id “${p.id}”`);
  }
});

test('templates and patterns are built from tokens, not literal colours', () => {
  /* a rebrand from Project has to reach them, so a raw hex is a bug */
  const raw: string[] = [];
  const scan = (label: string, tree: PcNode[]) => C.eachNode(tree, n => {
    for (const b of ['d', 't', 'm'] as Bp[])
      for (const [k, v] of Object.entries(n.css[b] || {}))
        if (/^#[0-9a-f]{3,8}$/i.test(String(v))) raw.push(`${label}: ${k}=${v}`);
  });
  for (const t of C.TEMPLATES) { fresh(); scan(t.name, t.build()); }
  for (const p of C.PATTERNS) { fresh(); scan(p.name, [p.build()]); }
  a.deepEqual(raw, []);
});

test('a size override on a styled heading is pinned at every breakpoint', () => {
  /* Text styles carry their own tablet and mobile sizes, and treeCss emits the
     breakpoint blocks after the desktop element rules — so a desktop-only
     font-size loses below 1024px, which is most of the editor canvas. A step
     number set to 19px was rendering at the Display style's 44px because of
     exactly this. */
  const loose: string[] = [];
  const scan = (label: string, tree: PcNode[]) => C.eachNode(tree, n => {
    if (!n.props || !n.props.ts) return;                    // no text style, nothing to fight
    const style = C.findStyle(n.props.ts);
    if (!style) return;
    const responsive = (['t', 'm'] as Bp[]).filter(b => (style.css[b] || {})['font-size']);
    if (!(n.css.d || {})['font-size'] || !responsive.length) return;
    for (const b of responsive)
      if (!(n.css[b] || {})['font-size'])
        loose.push(`${label}: ${n.props.text || n.type} sets a desktop font-size but none for '${b}', so the ${n.props.ts} style wins there`);
  });
  for (const t of C.TEMPLATES) { fresh(); scan(t.name, t.build()); }
  for (const p of C.PATTERNS) { fresh(); scan(p.name, [p.build()]); }
  a.deepEqual(loose, []);
});

/* ------------------------------------------------------ column drag-resize */
const row3 = () => {
  blank();
  insert('columns', null, 0);
  const row = C.state.pages[0].tree[0].children[0];
  C.applyCols(row, [50, 30, 20]);
  return row;
};

test('dragging a gutter moves width between two neighbours only', () => {
  const row = row3();
  const out = resizeCols(row, 0, 10);                 // grow the first by 10% of the row
  a.deepEqual(out, [60, 20, 20], 'the third column is untouched');
  a.equal(out.reduce((x, y) => x + y, 0), 100, 'and the row still totals 100');
});

test('a drag the other way is the same move, signed', () => {
  const row = row3();
  a.deepEqual(resizeCols(row, 1, -10), [50, 20, 30]);
});

test('a column stops at the minimum instead of collapsing', () => {
  const row = row3();
  const out = resizeCols(row, 0, -999);               // shove the gutter far left
  a.equal(out[0], C.MIN_COL, 'clamped, not zero — a collapsed column cannot be grabbed back');
  a.equal(out[0] + out[1], 80, 'the pair still holds what it held');
  const far = resizeCols(row, 0, 999);
  a.equal(far[1], C.MIN_COL, 'and the same at the other end');
});

test('the gutters at each end of the row are not draggable', () => {
  const row = row3();
  a.equal(C.resizeCols(row, -1, 5), null);
  a.equal(C.resizeCols(row, 2, 5), null, 'there is no column after the last one');
});

test('a resize reads and writes the breakpoint being edited', () => {
  /* the column width control is responsive, so dragging on tablet must not
     silently rewrite the desktop base */
  const row = row3();
  const out = resizeCols(row, 0, 10, 't');
  C.applyColsAt(row, out, 't');
  a.deepEqual(C.rowRatios(row), [50, 30, 20], 'desktop is left exactly as it was');
  a.deepEqual(C.rowRatiosAt(row, 't'), [60, 20, 20], 'the override carries the new split');
  a.deepEqual(C.rowRatiosAt(row, 'm'), [60, 20, 20], 'and mobile falls through to tablet');
});

test('mobile overrides tablet, which overrides desktop', () => {
  const row = row3();
  C.applyColsAt(row, [10, 80, 10], 'm');
  a.deepEqual(C.rowRatiosAt(row, 'd'), [50, 30, 20]);
  a.deepEqual(C.rowRatiosAt(row, 't'), [50, 30, 20], 'tablet never saw a change');
  a.deepEqual(C.rowRatiosAt(row, 'm'), [10, 80, 10]);
});

test('resizing does not add or remove columns', () => {
  const row = row3();
  C.applyColsAt(row, resizeCols(row, 0, 25), 'd');
  a.equal(row.children.length, 3);
  a.deepEqual(row.children.map(c => c.type), ['column', 'column', 'column']);
});

test('a two-column row still resizes, and an equal split survives a round trip', () => {
  blank();
  insert('columns', null, 0);
  const row = C.state.pages[0].tree[0].children[0];
  a.equal(row.children.length, 2, 'Columns drops two');
  const out = resizeCols(row, 0, 15);
  C.applyColsAt(row, out, 'd');
  a.deepEqual(C.rowRatios(row), [65, 35]);
  C.applyColsAt(row, resizeCols(row, 0, -15), 'd');
  a.deepEqual(C.rowRatios(row), [50, 50], 'back where it started');
});

/* -------------------------------------------------------------- global blocks
   A plain block places independent copies. A global one tags each copy so that
   one of them can push its content back to the block and out to the rest. */
const savedFrom = (sync: boolean) => {
  blank();
  const h = insert('heading', null, 0);
  h.props.text = 'Original';
  const sec = C.state.pages[0].tree[0];
  return { id: blockSave(sec.id, 'Promo', sync), sec };
};

test('a plain block places copies that owe each other nothing', () => {
  const { id } = savedFrom(false);
  const first = blockInsert(id, null, 1);
  blockInsert(id, null, 2);
  a.equal(block(id).sync, false);
  a.equal(!!(first.adv || {}).block, false, 'no link is recorded');
  a.equal(C.blockUsage(id), 0, 'so there is nothing to keep in sync');
});

test('a global block tags every copy it places', () => {
  const { id } = savedFrom(true);
  const one = blockInsert(id, null, 1), two = blockInsert(id, null, 2);
  a.equal(block(id).sync, true);
  a.equal(one.adv.block, id);
  a.equal(two.adv.block, id);
  a.notEqual(one.id, two.id, 'they are still separate nodes');
  a.equal(C.blockUsage(id), 2);
});

test('the source of a global block never carries its own link', () => {
  const { id } = savedFrom(true);
  a.equal(!!(block(id).node.adv || {}).block, false);
  /* and saving an instance as a new block does not inherit the old link either */
  const inst = blockInsert(id, null, 1);
  const id2 = blockSave(inst.id, 'Promo two', true);
  a.equal(!!(block(id2).node.adv || {}).block, false);
});

test('pushing one copy brings the block and every other copy into line', () => {
  const { id } = savedFrom(true);
  const one = blockInsert(id, null, 1);
  const two = blockInsert(id, null, 2);
  const three = blockInsert(id, null, 3);
  /* edit just one of them */
  const headingIn = (node: PcNode) => { const found: PcNode[] = []; C.eachNode([node], x => { if (x.type === 'heading') found.push(x); }); return must(found[0], 'a heading inside'); };
  headingIn(one).props.text = 'Edited';
  a.equal(headingIn(two).props.text, 'Original', 'untouched until pushed');

  a.equal(C.blockPush(one.id), 2, 'two other copies updated');
  a.equal(headingIn(two).props.text, 'Edited');
  a.equal(headingIn(three).props.text, 'Edited');
  a.equal(headingIn(block(id).node).props.text, 'Edited', 'and the block itself');
});

test('a push keeps each copy its own element', () => {
  const { id } = savedFrom(true);
  const one = blockInsert(id, null, 1), two = blockInsert(id, null, 2);
  const idBefore = two.id;
  two.adv.htmlId = 'promo-two';
  C.blockPush(one.id);
  a.equal(two.id, idBefore, 'the node id survives, so a selection is not lost');
  a.equal(two.adv.block, id, 'and so does the link');
  a.equal(two.adv.htmlId, '', 'but a per-copy anchor is cleared — two elements cannot share one id');
});

test('pushing from something that is not a global copy does nothing', () => {
  const { id, sec } = savedFrom(false);
  const plain = blockInsert(id, null, 1);
  a.equal(C.blockPush(plain.id), 0);
  a.equal(C.blockPush(sec.id), 0, 'the source section is not an instance either');
});

test('instances are found across pages and both global regions', () => {
  const { id } = savedFrom(true);
  blockInsert(id, null, 1);
  C.state.pages.push(pageFromTemplate('blank', 'Two'));
  C.state.cur = 1;
  blockInsert(id, null, 0);
  C.state.ui.mode = 'header';
  blockInsert(id, null, 0);
  C.state.ui.mode = 'page'; C.state.cur = 0;
  a.equal(C.blockUsage(id), 3);
  a.deepEqual([...new Set(C.blockInstances(id).map(x => x.where))].sort(), ['header', 'page:0', 'page:1']);
});

test('forgetting a global block leaves its copies in place', () => {
  const { id } = savedFrom(true);
  const one = blockInsert(id, null, 1);
  C.blockDelete(id);
  a.equal(C.findBlock(id), null);
  a.ok(at(one.id), 'the copy is still on the page');
  a.equal(C.blockPush(one.id), 0, 'it just has nothing left to push to');
});

test('a fresh copy never inherits a hand-set anchor', () => {
  /* every duplicate path runs through reid, and each of them used to produce a
     duplicate-id error the moment the source carried an anchor */
  blank();
  const h = insert('heading', null, 0);
  h.adv.htmlId = 'signup';
  const sec = C.state.pages[0].tree[0];

  C.dupNode(sec.id);
  a.equal(C.state.pages[0].tree.length, 2);
  const copied: string[] = [];
  C.eachNode([C.state.pages[0].tree[1]], n => { if (n.adv && n.adv.htmlId) copied.push(n.adv.htmlId); });
  a.deepEqual(copied, [], 'the duplicate carries no anchor');
  a.equal(h.adv.htmlId, 'signup', 'and the original keeps its own');
  a.equal(find(C.lint(), 'duplicate-id').length, 0);

  /* the same for a placed block, and for paste */
  const id = blockSave(sec.id, 'With anchor', true);
  const placed = blockInsert(id, null, 2);
  const fromBlock: string[] = [];
  C.eachNode([placed], n => { if (n.adv && n.adv.htmlId) fromBlock.push(n.adv.htmlId); });
  a.deepEqual(fromBlock, []);
  C.copyNode(sec.id);
  const pasted = paste(null);
  const fromClip: string[] = [];
  C.eachNode([pasted], n => { if (n.adv && n.adv.htmlId) fromClip.push(n.adv.htmlId); });
  a.deepEqual(fromClip, []);
  a.equal(find(C.lint(), 'duplicate-id').length, 0, 'nothing collides anywhere');
});

test('every link mode round-trips through build and parse', () => {
  /* the inspector derives a link's mode from the href it holds, so each mode has to
     survive the trip out and back — three of them silently did not */
  fresh();
  const here = 'index';
  const cases: [Record<string, string>, string][] = [
    [{ mode: 'none' }, ''],
    [{ mode: 'page', page: 'pricing', frag: '' }, 'pricing.html'],
    [{ mode: 'page', page: 'index', frag: 'craft' }, 'index.html#craft'],
    [{ mode: 'url', value: 'https://example.com/docs' }, 'https://example.com/docs'],
    [{ mode: 'email', value: 'hello@example.com' }, 'mailto:hello@example.com'],
    [{ mode: 'phone', value: '+15550100' }, 'tel:+15550100'],
  ];
  for (const [o, href] of cases) {
    a.equal(C.buildLink(o), href, `${o.mode} builds`);
    a.equal(C.parseLink(href, here).mode, o.mode, `${o.mode} parses back`);
  }
  /* and a mode with no value yet builds nothing — which is why the inspector has to
     remember the choice rather than read it back from the href */
  for (const m of ['url', 'email', 'phone']) a.equal(C.buildLink({ mode: m }), '');
});

/* ------------------------------------------------------- content collections */
const projects = () => {
  blank();
  const col = collectionAdd('Projects');
  C.fieldAdd(col.id, 'Summary', 'text');
  C.fieldAdd(col.id, 'Cover', 'image');
  return col;
};

test('a new collection arrives usable, with an id you can put in a URL', () => {
  blank();
  const col = collectionAdd('Case Studies');
  a.equal(col.id, 'case-studies');
  a.equal(col.slug, 'case-studies');
  a.equal(col.fields.length, 1, 'one field to start, or there is nothing to fill in');
  a.equal(col.fields[0].type, 'text');
  a.deepEqual(col.items, []);
});

test('two collections of the same name do not collide', () => {
  blank();
  a.equal(collectionAdd('Work').id, 'work');
  a.equal(collectionAdd('Work').id, 'work-2');
});

test('an item names itself from the first text field, and slugs from that', () => {
  const col = projects();
  const it = itemAdd(col.id);
  a.equal(C.itemTitle(col, it), 'Untitled');
  C.itemSet(col.id, it.id, 'title', 'Acme rebrand');
  a.equal(C.itemTitle(col, it), 'Acme rebrand');
  a.equal(it.slug, 'acme-rebrand', 'the slug follows the title');
});

test('two items with the same title get different slugs', () => {
  const col = projects();
  const a1 = itemAdd(col.id), a2 = itemAdd(col.id);
  C.itemSet(col.id, a1.id, 'title', 'Rebrand');
  C.itemSet(col.id, a2.id, 'title', 'Rebrand');
  a.equal(a1.slug, 'rebrand');
  a.equal(a2.slug, 'rebrand-2', 'or one would overwrite the other on export');
});

test('a hand-set slug stops following the title', () => {
  const col = projects();
  const it = itemAdd(col.id);
  C.itemSet(col.id, it.id, 'title', 'First name');
  a.equal(it.slug, 'first-name');
  C.itemSetSlug(col.id, it.id, 'custom-url');
  a.equal(it.slug, 'custom-url');
  C.itemSet(col.id, it.id, 'title', 'Renamed after publishing');
  a.equal(it.slug, 'custom-url', 'a published URL does not move on a typo fix');
});

test('deleting a field takes its values with it', () => {
  const col = projects();
  const it = itemAdd(col.id);
  C.itemSet(col.id, it.id, 'title', 'One');
  C.itemSet(col.id, it.id, 'summary', 'kept');
  C.itemSet(col.id, it.id, 'cover', 'asset:abc');
  a.equal(C.fieldDelete(col.id, 'cover'), 1, 'one value cleared');
  a.equal('cover' in it.values, false, 'no orphan value survives the schema');
  a.deepEqual(Object.keys(it.values).sort(), ['summary', 'title']);
});

test('the last field cannot be deleted', () => {
  blank();
  const col = collectionAdd('Notes');
  a.equal(C.fieldDelete(col.id, col.fields[0].id), 0);
  a.equal(col.fields.length, 1, 'a collection with no fields could hold nothing');
});

test('fields and items reorder, and stop at the ends', () => {
  const col = projects();
  a.equal(C.fieldMove(col.id, 'cover', -1), true);
  a.deepEqual(col.fields.map((f: Field) => f.id), ['title', 'cover', 'summary']);
  a.equal(C.fieldMove(col.id, 'title', -1), false, 'already first');
  const i1 = itemAdd(col.id), i2 = itemAdd(col.id);
  a.equal(C.itemMove(col.id, i2.id, -1), true);
  a.deepEqual(col.items.map((i: Item) => i.id), [i2.id, i1.id]);
  a.equal(C.itemMove(col.id, i1.id, 1), false, 'already last');
});

test('an unknown field type falls back rather than storing nonsense', () => {
  const col = projects();
  a.equal(C.fieldAdd(col.id, 'Odd', 'not-a-type').type, 'text');
  a.equal(C.fieldAdd(col.id, 'Price', 'number').type, 'number');
});

test('deleting a collection leaves the others alone', () => {
  blank();
  const a1 = collectionAdd('One'), a2 = collectionAdd('Two');
  C.collectionDelete(a1.id);
  a.deepEqual(C.collections().map(c => c.id), [a2.id]);
});

test('migration v6 to v7 adds the collection list', () => {
  const before = { v: 6, pages: [{ id: 'p', name: 'Home', slug: 'index', tree: [] }], meta: { blocks: [] } };
  const after = C.migrate(before);
  a.deepEqual(after.meta.collections, []);
  a.equal(after.v, 7);
  /* and a project already on 7 is left as it is */
  const kept = { v: 7, pages: before.pages, meta: { collections: [{ id: 'x', name: 'X', fields: [], items: [] }] } };
  a.equal(C.migrate(kept).meta.collections.length, 1);
});

/* -------------------------------------------------------------------- binding */
const bound = () => {
  blank();
  const col = collectionAdd('Projects');
  C.fieldAdd(col.id, 'Summary', 'text');
  const i1 = itemAdd(col.id), i2 = itemAdd(col.id);
  C.itemSet(col.id, i1.id, 'title', 'Acme rebrand');
  C.itemSet(col.id, i1.id, 'summary', 'A full identity refresh');
  C.itemSet(col.id, i2.id, 'title', 'Northwind app');
  C.itemSet(col.id, i2.id, 'summary', 'Design system and product UI');
  const h = insert('heading', null, 0);
  const col_ = holderOf(h.id);                 // the column that wraps it
  C.srcSet(col_, col.id);
  C.bindSet(h, 'text', 'title');
  return { col, i1, i2, h, holder: col_ };
};

test('a binding names a field, and takes its collection from the scope above', () => {
  const { h, holder, col } = bound();
  a.deepEqual(h.bind, { text: 'title' }, 'the node stores only the field');
  a.equal(h.src, undefined, 'no collection id on the bound node');
  const sc = bindScope(h.id);
  a.equal(sc.col.id, col.id);
  a.equal(must(sc.node, 'scope node').id, holder.id, 'resolved from the nearest ancestor with a source');
});

test('a bound property renders the item, not the placeholder', () => {
  bound();
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: false });
  a.match(html, /Acme rebrand/);
  a.equal(/A headline that carries weight/.test(html), false, 'the default text is gone');
});

test('the canvas previews one item, and the switcher moves it', () => {
  const { col } = bound();
  a.match(C.renderNode(C.state.pages[0].tree[0], { edit: false }), /Acme rebrand/);
  C.state.ui.item = { [col.id]: 1 };
  a.match(C.renderNode(C.state.pages[0].tree[0], { edit: false }), /Northwind app/);
});

test('a preview index past the end falls back rather than rendering nothing', () => {
  const { col } = bound();
  C.state.ui.item = { [col.id]: 99 };
  a.equal(must(C.previewItem(col), 'preview item').values.title, 'Northwind app', 'clamped to the last item');
  C.collections()[0].items = [];
  a.equal(C.previewItem(col), null, 'and an empty collection binds to nothing');
});

test('an empty field renders empty, not the placeholder it replaced', () => {
  const { col, i1 } = bound();
  C.itemSet(col.id, i1.id, 'title', '');
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: false });
  a.equal(/A headline that carries weight/.test(html), false,
    'what the canvas shows has to be what the export writes');
});

test('binding to a field that no longer exists yields empty, not a crash', () => {
  const { h, col } = bound();
  C.fieldDelete(col.id, 'summary');
  C.bindSet(h, 'text', 'summary');
  a.equal(C.boundProps(h, col, col.items[0]).text, '');
  a.doesNotThrow(() => C.renderNode(C.state.pages[0].tree[0], { edit: false }));
});

test('clearing a binding drops the map when it was the last one', () => {
  const { h } = bound();
  C.bindSet(h, 'text', '');
  a.equal(h.bind, undefined, 'no empty object left behind');
  C.bindSet(h, 'text', 'title');
  C.bindSet(h, 'link', 'title');
  C.bindSet(h, 'link', '');
  a.deepEqual(h.bind, { text: 'title' });
});

test('an unbound tree is left exactly as it was', () => {
  blank();
  const h = insert('heading', null, 0);
  a.equal(C.boundProps(h, null, null), h.props, 'the identity object, not a copy');
});

test('a source only counts when the collection is real', () => {
  const { holder } = bound();
  C.srcSet(holder, 'ghost-collection');
  a.equal(holder.src, undefined);
  const h2 = insert('heading', null, 0);
  a.equal(C.bindScope(h2.id), null, 'nothing above it declares a source');
});

test('which props may bind: content, but never the text style', () => {
  const keys = C.bindableKeys('heading');
  a.ok(keys.includes('text'));
  a.ok(keys.includes('link'));
  a.equal(keys.includes('ts'), false, 'a text style is a design choice, not content');
  a.ok(C.bindableKeys('image').includes('src'));
  a.ok(C.bindableKeys('image').includes('alt'));
});

/* --------------------------------------------------------- collection list */
const withList = () => {
  blank();
  const col = collectionAdd('Projects');
  C.fieldAdd(col.id, 'Year', 'number');
  [['Acme rebrand', '2025'], ['Northwind app', '2024'], ['Harbour print', '100']].forEach(([t, y]) => {
    const it = itemAdd(col.id);
    C.itemSet(col.id, it.id, 'title', t);
    C.itemSet(col.id, it.id, 'year', y);
  });
  const list = C.N('list');
  C.srcSet(list, col.id);
  const card = C.N('column', {}, {}, [C.N('heading', { text: 'placeholder', ts: 'subtitle' })]);
  list.children.push(card);
  C.state.pages[0].tree.push(C.N('section', {}, {}, [list]));
  const heading = card.children[0];
  C.bindSet(heading, 'text', 'title');
  return { col, list, card, heading };
};

test('a collection list renders its contents once per item', () => {
  withList();
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: false });
  a.equal((html.match(/class="pagecraft-column/g) || []).length, 3, 'one card per item');
  for (const t of ['Acme rebrand', 'Northwind app', 'Harbour print']) a.match(html, new RegExp(t));
  a.equal(/placeholder/.test(html), false, 'the template text is replaced everywhere');
});

test('every repeat gets its own item, not the previewed one', () => {
  const { col } = withList();
  C.state.ui.item = { [col.id]: 2 };                 // preview the third
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: false });
  a.equal((html.match(/Acme rebrand/g) || []).length, 1, 'still one of each');
  a.equal((html.match(/Harbour print/g) || []).length, 1, 'the preview index does not leak into a repeat');
});

test('sorting a number field compares numerically', () => {
  const { list, col } = withList();
  list.props.sort = 'year';
  const order = () => C.listItems(list, col).map(i => i.values.year);
  a.deepEqual(order(), ['100', '2024', '2025'], 'not string order, which puts 100 last');
  list.props.dir = 'desc';
  a.deepEqual(order(), ['2025', '2024', '100']);
});

test('sorting a text field compares as text', () => {
  const { list, col } = withList();
  list.props.sort = 'title';
  a.deepEqual(C.listItems(list, col).map(i => i.values.title), ['Acme rebrand', 'Harbour print', 'Northwind app']);
});

test('no sort means the order set in the CMS', () => {
  const { list, col } = withList();
  a.deepEqual(C.listItems(list, col).map(i => i.values.title), ['Acme rebrand', 'Northwind app', 'Harbour print']);
});

test('a limit caps the list, and a bad limit does not', () => {
  const { list, col } = withList();
  list.props.limit = '2';
  a.equal(C.listItems(list, col).length, 2);
  for (const bad of ['', '0', '-3', 'abc']) { list.props.limit = bad; a.equal(C.listItems(list, col).length, 3, `limit ${JSON.stringify(bad)} means all`); }
});

test('an empty collection exports nothing rather than an empty shell', () => {
  withList();
  C.collections()[0].items = [];
  const shipped = C.renderNode(C.state.pages[0].tree[0], { edit: false });
  a.equal(/pagecraft-list/.test(shipped), false, 'no stray wrapper in the export');
  a.match(C.renderNode(C.state.pages[0].tree[0], { edit: true }), /has no items yet/, 'but the editor says why');
});

test('a list with no collection exports nothing and prompts in the editor', () => {
  const { list } = withList();
  C.srcSet(list, '');
  a.equal(/pagecraft-list/.test(C.renderNode(C.state.pages[0].tree[0], { edit: false })), false);
  a.match(C.renderNode(C.state.pages[0].tree[0], { edit: true }), /Pick a collection/);
});

test('a list with no card exports nothing and prompts in the editor', () => {
  const { list } = withList();
  list.children = [];
  a.equal(/pagecraft-list/.test(C.renderNode(C.state.pages[0].tree[0], { edit: false })), false);
  a.match(C.renderNode(C.state.pages[0].tree[0], { edit: true }), /becomes the card/);
});

test('a list sits where a row sits, and holds columns', () => {
  a.equal(C.lvl('list'), C.lvl('row'), 'same level, so it drops in the same places');
  a.equal(C.holds('section', 'list'), true);
  a.equal(C.holds('list', 'column'), true);
  a.equal(C.holds('column', 'list'), false, 'a card cannot contain the list it repeats in');
});

test('every repeat ships a unique id, or the export is invalid markup', () => {
  withList();
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: false });
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  a.equal(ids.length, new Set(ids).size, 'no id appears twice: ' + ids.join(' '));
  a.ok(ids.some(x => /-acme-rebrand$/.test(x)), 'the item slug is what makes them unique');
});

test('a hand-set anchor inside a card is made per-item too', () => {
  const { heading } = withList();
  heading.adv.htmlId = 'card-title';
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: false });
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  a.equal(ids.length, new Set(ids).size, 'still unique');
  a.ok(ids.includes('card-title-acme-rebrand'));
});

test('in the editor the first repeat keeps the bare node id', () => {
  const { card } = withList();
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: true });
  a.match(html, new RegExp('id="' + card.id + '"'), 'so selection and the HUD still find it');
  a.equal((html.match(new RegExp('data-id="' + card.id + '"', 'g')) || []).length, 3,
    'but every copy still points at the one template node');
});

/* ------------------------------------------------------------- detail pages */
const detail = () => {
  blank();
  const col = collectionAdd('Projects');
  col.slug = 'work';
  C.fieldAdd(col.id, 'Body', 'rich');
  ['Acme rebrand', 'Northwind app'].forEach(t => {
    const it = itemAdd(col.id);
    C.itemSet(col.id, it.id, 'title', t);
    C.itemSet(col.id, it.id, 'body', 'The story of ' + t);
  });
  /* a second ordinary page to link to */
  C.state.pages.push(pageFromTemplate('blank', 'About'));
  const tpl = pageFromTemplate('blank', 'Project');
  tpl.collection = col.id;
  tpl.bindTitle = 'title';
  C.state.pages.push(tpl);
  return { col, tpl };
};

test('a detail template emits one file per item, the rest one each', () => {
  detail();
  const t = C.exportTargets();
  a.deepEqual(t.map(x => x.path),
    ['index.html', 'pricing.html', 'about.html', 'work/acme-rebrand.html', 'work/northwind-app.html']);
  a.deepEqual(t.map(x => x.rel), ['', '', '', '../', '../'], 'and each knows how deep it sits');
});

test('a detail page takes its title from the field it is bound to', () => {
  detail();
  const t = C.exportTargets().filter(x => x.item);
  a.deepEqual(t.map(x => x.pg.title), ['Acme rebrand', 'Northwind app']);
});

test('an internal link climbs out of the folder, an external one does not', () => {
  const o = { rel: '../' };
  a.equal(C.pageHref('about.html', o), '../about.html');
  a.equal(C.pageHref('index.html#craft', o), '../index.html#craft');
  a.equal(C.pageHref('https://example.com', o), 'https://example.com');
  a.equal(C.pageHref('mailto:a@b.com', o), 'mailto:a@b.com');
  a.equal(C.pageHref('/rooted.html', o), '/rooted.html');
  a.equal(C.pageHref('#anchor', o), '#anchor');
  a.equal(C.pageHref('about.html', { rel: '' }), 'about.html', 'a root page is untouched');
});

test('cms:item resolves to the page of whichever item is rendering', () => {
  const { col } = detail();
  const it = col.items[1];
  a.equal(C.pageHref('cms:item', { col, item: it }), 'work/northwind-app.html');
  a.equal(C.pageHref('cms:item', { col, item: it, rel: '../' }), '../work/northwind-app.html');
  a.equal(C.pageHref('cms:item', {}), '', 'outside an item it points nowhere rather than at "#"');
  a.deepEqual(C.parseLink('cms:item', 'index'), { mode: 'item' });
  a.equal(C.buildLink({ mode: 'item' }), 'cms:item');
});

test('a detail page renders the item it stands for', () => {
  const { tpl } = detail();
  const h = C.N('heading', { text: 'placeholder', ts: 'display' });
  C.bindSet(h, 'text', 'title');
  tpl.tree.push(C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [h])])]));
  const t = C.exportTargets().find(x => x.item && x.item.slug === 'acme-rebrand');
  const html = C.buildPage(t.pg, t);
  a.match(html, /Acme rebrand/);
  a.equal(/placeholder/.test(html), false);
  a.match(html, /<title>Acme rebrand<\/title>/, 'and its own title');
});

test('the header on a nested page links back out', () => {
  detail();
  C.state.header.push(C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {},
    [C.N('nav', { items: [{ label: 'Home', href: 'index.html' }, { label: 'Out', href: 'https://x.com' }] })])])]));
  const root = C.exportTargets()[0], deep = C.exportTargets().find(x => x.item);
  a.match(C.buildPage(root.pg, root), /href="index\.html"/);
  const nested = C.buildPage(deep.pg, deep);
  a.match(nested, /href="\.\.\/index\.html"/, 'the shared header follows the page it is on');
  a.match(nested, /href="https:\/\/x\.com"/, 'but an external link is left alone');
});

test('the sitemap lists every generated file', () => {
  detail();
  C.state.meta.baseUrl = 'https://example.com';
  const xml = C.sitemapXml();
  for (const u of ['index.html', 'about.html', 'work/acme-rebrand.html', 'work/northwind-app.html'])
    a.match(xml, new RegExp('<loc>https://example\\.com/' + u.replace(/[/.]/g, m => '\\' + m) + '</loc>'));
});

test('a detail template with an empty collection emits nothing for it', () => {
  detail();
  C.collections()[0].items = [];
  a.deepEqual(C.exportTargets().map(x => x.path), ['index.html', 'pricing.html', 'about.html']);
});

test('on a detail page the whole page is the binding scope', () => {
  const { tpl, col } = detail();
  C.state.cur = C.state.pages.indexOf(tpl);
  const h = insert('heading', null, 0);
  const sc = bindScope(h.id);
  a.equal(sc.col.id, col.id);
  a.equal(sc.node, null, 'no src node needed — the page provides it');
});

/* -------------------------------------------------------------- content.json */
test('content.json carries the schema, the items and their URLs', () => {
  detail();
  const j = JSON.parse(C.contentJson());
  a.equal(j.site.name, C.state.meta.name);
  a.equal(j.collections.length, 1);
  const c = j.collections[0];
  a.equal(c.id, 'projects');
  a.equal(c.slug, 'work');
  a.deepEqual(c.fields.map((f: Field) => f.id), ['title', 'body']);
  a.deepEqual(c.fields.map((f: Field) => f.type), ['text', 'rich']);
  a.deepEqual(c.items.map((i: Item) => i.slug), ['acme-rebrand', 'northwind-app']);
  a.equal(c.items[0].url, 'work/acme-rebrand.html', 'so a consumer knows where the page is');
  a.equal(c.items[0].values.title, 'Acme rebrand');
});

test('an item with no detail page carries no url', () => {
  blank();
  const col = collectionAdd('Notes');
  const it = itemAdd(col.id);
  C.itemSet(col.id, it.id, 'title', 'One');
  const c = JSON.parse(C.contentJson()).collections[0];
  a.equal('url' in c.items[0], false, 'rather than a link to a file that is not written');
});

test('every field appears on every item, even the ones never filled in', () => {
  const { col } = detail();
  C.fieldAdd(col.id, 'Client', 'text');
  const c = JSON.parse(C.contentJson()).collections[0];
  for (const it of c.items) a.deepEqual(Object.keys(it.values).sort(), ['body', 'client', 'title']);
  a.equal(c.items[0].values.client, '', 'an unset value is empty, not missing');
});

test('image values go through the resolver the caller supplies', () => {
  blank();
  const col = collectionAdd('Gallery');
  C.fieldAdd(col.id, 'Shot', 'image');
  const it = itemAdd(col.id);
  C.itemSet(col.id, it.id, 'shot', 'asset:abc123');
  a.equal(JSON.parse(C.contentJson()).collections[0].items[0].values.shot, 'asset:abc123',
    'untouched by default, since core cannot see the asset store');
  const resolved = JSON.parse(C.contentJson(v => String(v).replace(/^asset:/, 'assets/') + '.png'));
  a.equal(resolved.collections[0].items[0].values.shot, 'assets/abc123.png');
});

test('the same project exports the same bytes', () => {
  detail();
  a.equal(C.contentJson(), C.contentJson(), 'no timestamp, so it diffs cleanly');
});

test('content.json is valid JSON and ends with a newline', () => {
  detail();
  const raw = C.contentJson();
  a.doesNotThrow(() => JSON.parse(raw));
  a.equal(raw.endsWith('\n'), true);
});

/* =============================================================== accordion
   Native <details>, which is the whole reason this widget costs no JavaScript. */
const acc = (props = {}) => {
  blank();
  const n = insert('accordion', null, 0);
  Object.assign(n.props, props);
  return n;
};

test('an accordion is native <details>, so it ships no script of its own', () => {
  const n = acc();
  const html = C.renderNode(n, { edit: false });
  a.equal((html.match(/<details/g) || []).length, 3);
  a.equal((html.match(/<summary/g) || []).length, 3);
  a.equal(/<script/i.test(html), false);
  a.equal(/aria-expanded/.test(html), false, 'the element carries its own state');
});

test('“one open at a time” is the native name attribute, and only one panel may be open', () => {
  const n = acc({ single: 1, open: 'all' });
  const html = C.renderNode(n, { edit: false });
  const names = html.match(/name="[^"]+"/g) || [];
  a.equal(names.length, 3, 'every panel is in the group');
  a.equal(new Set(names).size, 1, 'one shared name is what makes it exclusive');
  a.equal((html.match(/ open>/g) || []).length, 1,
    'a shared name allows one open panel, so “all open” cannot also be honoured');
});

test('what opens on load follows the setting', () => {
  a.equal((C.renderNode(acc({ open: 'none' }), { edit: false }).match(/ open>/g) || []).length, 0);
  a.equal((C.renderNode(acc({ open: 'first' }), { edit: false }).match(/ open>/g) || []).length, 1);
  a.equal((C.renderNode(acc({ open: 'all' }), { edit: false }).match(/ open>/g) || []).length, 3);
});

test('a selected accordion opens every panel in the editor, so the answers can be styled', () => {
  const n = acc({ open: 'none' });
  C.state.ui.sel = n.id;
  a.equal((C.renderNode(n, { edit: true }).match(/ open>/g) || []).length, 3);
  C.state.ui.sel = null;
  a.equal((C.renderNode(n, { edit: true }).match(/ open>/g) || []).length, 0);
});

test('an answer becomes paragraphs: a blank line starts one, a single newline breaks', () => {
  a.equal(C.para('one\n\ntwo'), '<p>one</p><p>two</p>');
  a.equal(C.para('one\ntwo'), '<p>one<br>two</p>');
  a.equal(C.para('  '), '', 'nothing in, nothing out');
  a.match(C.para('<b>hi</b>'), /&lt;b&gt;/, 'an answer is text, not markup');
});

test('an accordion with no questions exports nothing but explains itself in the editor', () => {
  const n = acc({ items: [] });
  a.equal(C.renderNode(n, { edit: false }), '');
  a.match(C.renderNode(n, { edit: true }), /s-empty/);
});

/* =================================================================== embed */
test('an embed exports its markup verbatim — that is the entire point', () => {
  blank();
  const n = insert('embed', null, 0);
  n.props.html = '<iframe src="https://example.com/x" title="Map"></iframe>';
  a.match(C.renderNode(n, { edit: false }), /<iframe src="https:\/\/example\.com\/x" title="Map"><\/iframe>/);
});

test('the canvas holds back scripts the export ships', () => {
  blank();
  const n = insert('embed', null, 0);
  n.props.html = '<div id="w"></div><script src="https://x.test/w.js"></script>';
  const shipped = C.renderNode(n, { edit: false });
  const drawn = C.renderNode(n, { edit: true });
  a.match(shipped, /<script src="https:\/\/x\.test\/w\.js">/, 'the export keeps it');
  a.equal(/<script/i.test(drawn), false, 'the editor renders on every keystroke, so it must not run');
  a.match(drawn, /1 script held back/);
});

test('stripScripts takes both forms and counts what it took', () => {
  a.deepEqual(C.stripScripts('<script>a()</script>'), { html: '', stripped: 1 });
  a.deepEqual(C.stripScripts('<script src="x.js"></script>'), { html: '', stripped: 1 });
  a.deepEqual(C.stripScripts('<b onclick="a()">x</b>'), { html: '<b>x</b>', stripped: 1 });
  a.deepEqual(C.stripScripts("<b onmouseover='a()'>x</b>"), { html: '<b>x</b>', stripped: 1 });
  a.deepEqual(C.stripScripts('<b>x</b>'), { html: '<b>x</b>', stripped: 0 });
});

test('an aspect ratio reaches the iframe through a class, not a style-attribute selector', () => {
  blank();
  const n = insert('embed', null, 0);
  n.props.html = '<iframe src="x"></iframe>';
  a.equal(/pagecraft-embed-ratio/.test(C.renderNode(n, { edit: false })), false, 'none chosen, none applied');
  n.props.ratio = '16 / 9';
  const html = C.renderNode(n, { edit: false });
  a.match(html, /pagecraft-embed-ratio/);
  a.match(html, /aspect-ratio:16 \/ 9/);
  a.match(C.baseCss(false), /\.pagecraft-embed-ratio>iframe[^}]*height:100%/);
});

test('an empty embed exports nothing', () => {
  blank();
  const n = insert('embed', null, 0);
  a.equal(C.renderNode(n, { edit: false }), '');
});

/* ==================================================================== icon */
test('every icon in the set has a path, and none is empty', () => {
  a.ok(C.ICON_NAMES.length >= 30, 'a set worth picking from');
  C.ICON_NAMES.forEach(k => {
    a.match(C.ICON_PATHS[k], /^<(path|circle|rect|ellipse)/, k + ' draws something');
    a.equal(/viewBox/.test(C.ICON_PATHS[k]), false, k + ' is a bare path list');
  });
  a.equal(new Set(C.ICONS.flatMap(([, l]) => l.map(([k]) => k))).size, C.ICON_NAMES.length,
    'no glyph appears in two groups');
});

test('an icon always carries width and height — a viewBox alone collapses', () => {
  blank();
  const n = insert('icon', null, 0);
  const html = C.renderNode(n, { edit: false });
  a.match(html, /width="24"/);
  a.match(html, /height="24"/);
  a.match(html, /viewBox="0 0 24 24"/);
  a.match(C.baseCss(false), /\.pagecraft-icon-glyph\{[^}]*width:var\(--icon-size/);
});

test('a label makes an icon announced; without one it is hidden', () => {
  blank();
  const n = insert('icon', null, 0);
  a.match(C.renderNode(n, { edit: false }), /aria-hidden="true"/);
  n.props.label = 'Verified';
  const html = C.renderNode(n, { edit: false });
  a.match(html, /role="img"/);
  a.match(html, /aria-label="Verified"/);
  a.equal(/aria-hidden/.test(html), false);
});

test('a linked icon names the link, not the glyph', () => {
  blank();
  const n = insert('icon', null, 0);
  n.props.link = 'https://example.com';
  n.props.label = 'Our GitHub';
  const html = C.renderNode(n, { edit: false });
  a.match(html, /<a [^>]*aria-label="Our GitHub"/, 'the link is what gets the name');
  a.match(html, /<svg [^>]*aria-hidden="true"/, 'the glyph inside it says nothing twice');
  a.match(html, /class="pagecraft-icon-glyph"/);
});

test('an unknown icon name falls back rather than drawing an empty box', () => {
  blank();
  const n = insert('icon', null, 0);
  n.props.name = 'no-such-glyph';
  a.match(C.renderNode(n, { edit: false }), new RegExp(C.ICON_PATHS.check.slice(1, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

/* ================================================================= gallery */
const gal = (count: number, props: Record<string, any> = {}) => {
  blank();
  const n = insert('gallery', null, 0);
  n.props.items = Array.from({ length: count }, (_, i) =>
    ({ src: 'asset:a' + i, alt: 'Shot ' + i, caption: 'Cap ' + i, w: '1200', h: '900' }));
  Object.assign(n.props, props);
  return n;
};

test('a gallery is one figure per tile, and an empty tile is a slot, not a gap', () => {
  const n = gal(3);
  rowsOf<GalleryTile>(n).push({ src: '', alt: '' });
  const html = C.renderNode(n, { edit: false });
  /* the same call the Image widget makes: no source means the placeholder, so a
     three-slot template renders as three slots rather than as nothing */
  a.equal((html.match(/<figure/g) || []).length, 4);
  /* twice for the one empty slot: the img and the lightbox href it is wrapped in */
  a.equal((html.match(new RegExp(C.PH.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2);
  a.match(html, /class="pagecraft-gallery [^"]*"/);
});

test('with the lightbox on every tile is a real link, so it works with scripting off', () => {
  const html = C.renderNode(gal(2), { edit: false });
  a.match(html, /data-lightbox/);
  a.equal((html.match(/<a class="pagecraft-gallery-frame" href="asset:a\d"/g) || []).length, 2);
  a.match(html, /data-lb="0"/);
});

test('with the lightbox off there is nothing to intercept and nothing linked', () => {
  const html = C.renderNode(gal(2, { lightbox: 0 }), { edit: false });
  a.equal(/data-lightbox/.test(html), false);
  a.equal(/<a class="pagecraft-gallery-frame"/.test(html), false);
  a.match(html, /<span class="pagecraft-gallery-frame">/);
});

test('a gallery writes intrinsic size, so the grid does not shift as it loads', () => {
  a.match(C.renderNode(gal(1), { edit: false }), /width="1200" height="900"/);
});

test('captions are opt-in', () => {
  a.equal(/figcaption/.test(C.renderNode(gal(1), { edit: false })), false);
  a.match(C.renderNode(gal(1, { captions: 1 }), { edit: false }), /<figcaption class="pagecraft-gallery-caption">Cap 0/);
});

test('a tile shape reaches the frame through a class and a variable', () => {
  const html = C.renderNode(gal(1, { ratio: '1 / 1', fit: 'contain' }), { edit: false });
  a.match(html, /pagecraft-gallery-fixed/);
  a.match(html, /--g-ratio:1 \/ 1/);
  a.match(html, /--g-fit:contain/);
  a.equal(/pagecraft-gallery-fixed/.test(C.renderNode(gal(1, { ratio: '' }), { edit: false })), false);
});

test('an empty gallery exports nothing', () => {
  const n = gal(0);
  a.equal(C.renderNode(n, { edit: false }), '');
  a.match(C.renderNode(n, { edit: true }), /s-empty/);
});

test('the lightbox script ships only onto a page that has one', () => {
  /* the marker is the script's own code, not the class name — the stylesheet
     carries .pagecraft-lightbox rules on every page, the way the nav and form
     rules do, and only the script is conditional */
  gal(2);
  a.match(C.buildPage(C.page()), /HTMLDialogElement/);
  blank();
  insert('heading', null, 0);
  a.equal(/HTMLDialogElement/.test(C.buildPage(C.page())), false, 'no gallery, no script');
  gal(2, { lightbox: 0 });
  a.equal(/data-lightbox/.test(C.buildPage(C.page())), false);
  a.equal(/HTMLDialogElement/.test(C.buildPage(C.page())), false, 'nothing to upgrade, nothing shipped');
});

/* ====================================================== the exported page */
test('a visitor asking for less motion gets it, and outranks the project CSS', () => {
  C.state.meta.css = '.x{transition:all 2s}';
  const css = C.baseCss(false);
  a.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  a.match(css, /transition-duration:\.01ms !important/);
  a.ok(css.indexOf('prefers-reduced-motion') > css.indexOf('.x{transition:all 2s}'),
    'it closes the stylesheet, so a project rule cannot re-enable motion');
  C.state.meta.css = '';
});

test('keyboard focus is visible on everything that can take it', () => {
  const css = C.baseCss(false);
  ['.pagecraft-button:focus-visible', '.pagecraft-nav-list a:focus-visible',
    '.pagecraft-heading a:focus-visible', '.pagecraft-wysiwyg a:focus-visible',
    '.pagecraft-accordion-q:focus-visible', '.pagecraft-gallery-frame:focus-visible',
    '.pagecraft-icon:focus-visible', '.pagecraft-form-button:focus-visible'
  ].forEach(sel => a.ok(css.includes(sel), sel + ' has a focus ring'));
  /* currentColor, not the brand: #b7f34a is 1.6:1 on Paper, so a brand ring round
     a brand-filled button was invisible in the one case it had to work. Text
     colour already contrasts with its own ground, so the ring inherits that. */
  a.match(css, /outline:3px solid currentColor;outline-offset:3px/);
  /* The video facade keeps the brand-green ring it already had. It has the same
     weakness — at outline-offset the ring sits on the section background, and brand
     green on Paper is 1.6:1 — but it predates this rule and fixing it was not what
     was asked for. Left as found, deliberately. */
  a.match(css, /\.pagecraft-video-play:focus-visible\{outline:3px solid var\(--c-brand\)/);
  a.equal(css.includes('.pagecraft-video-play:focus-visible,'), false,
    'and it is its own rule, not folded into the shared one');
});

test('a hidden lightbox control has the display escape hatch its own class needs', () => {
  a.match(C.baseCss(false), /\.pagecraft-lightbox-btn\[hidden\]\{display:none\}/);
});

/* ======================================================= review, new rules */
test('an accordion row with no question is an error, an empty answer a warning', () => {
  const n = acc({ items: [{ q: '', a: 'x' }, { q: 'Real?', a: '' }, { q: 'Fine', a: 'Yes' }] });
  const f = C.lint();
  a.equal(find(f, 'accordion-no-question').length, 1, 'counted per accordion, not per row');
  a.match(find(f, 'accordion-no-question')[0].msg, /^1 row /);
  a.equal(find(f, 'accordion-no-answer').length, 1);
  a.equal(find(f, 'accordion-empty').length, 0);
  n.props.items = [];
  a.equal(find(C.lint(), 'accordion-empty').length, 1);
});

test('an embed says what the review cannot check for it', () => {
  blank();
  const n = insert('embed', null, 0);
  a.equal(find(C.lint(), 'embed-empty').length, 1);
  n.props.html = '<iframe src="https://x.test"></iframe>';
  a.equal(codes(C.lint()).filter(x => x.startsWith('embed-')).length, 0);
  n.props.html += '<script src="https://x.test/w.js"></script>';
  a.equal(find(C.lint(), 'embed-script').length, 1);
});

test('a linked icon with no label is an error — the link would have no name at all', () => {
  blank();
  const n = insert('icon', null, 0);
  a.equal(find(C.lint(), 'icon-link-no-label').length, 0, 'an unlinked glyph is allowed to be decorative');
  n.props.link = 'https://example.com';
  a.equal(find(C.lint(), 'icon-link-no-label').length, 1);
  n.props.label = 'GitHub';
  a.equal(find(C.lint(), 'icon-link-no-label').length, 0);
});

test('a gallery is held to the Image widget’s standards, counted per gallery', () => {
  const n = gal(4);
  a.equal(codes(C.lint()).filter(x => x.startsWith('gallery-')).length, 0);
  rowsOf<GalleryTile>(n)[0].alt = '';
  rowsOf<GalleryTile>(n)[1].alt = ' ';
  rowsOf<GalleryTile>(n)[2].w = '';
  const f = C.lint();
  a.equal(find(f, 'gallery-no-alt').length, 1);
  a.match(find(f, 'gallery-no-alt')[0].msg, /2 of 4 images/);
  a.equal(find(f, 'gallery-no-dimensions').length, 1);
  n.props.items = [];
  a.equal(find(C.lint(), 'gallery-empty').length, 1);
});

test('a gallery slot with no image yet is a slot to fill, not an alt-text error', () => {
  const n = gal(2);
  rowsOf<GalleryTile>(n).push({ src: '', alt: '', caption: '' });
  const f = C.lint();
  a.equal(find(f, 'gallery-no-image').length, 1, 'reported as the placeholder it is');
  a.match(find(f, 'gallery-no-image')[0].msg, /^1 tile /);
  a.equal(find(f, 'gallery-no-alt').length, 0,
    'nothing to describe yet — the same rule the Image widget follows');
  a.equal(C.lintCounts(f).error, 0, 'a fresh gallery template opens on no errors at all');
});

/* ================================================================ binding */
test('a control that edits a list of its own is not offered for binding', () => {
  a.equal(C.bindableKeys('nav').includes('items'), false, 'a field cannot fill an array of links');
  a.equal(C.bindableKeys('form').includes('fields'), false);
  a.equal(C.bindableKeys('accordion').includes('items'), false);
  a.equal(C.bindableKeys('gallery').includes('items'), false);
  a.ok(C.bindableKeys('embed').includes('html'), 'a single value still binds');
  a.ok(C.bindableKeys('icon').includes('name'));
});

/* ============================================ the canvas renders its breakpoint
   The canvas used to be whatever width the panels left over, so which breakpoint it
   drew was an accident of the window. At a 1440px window with the inspector open it
   was 741px and quietly rendering mobile while the chip read "Desktop base". These
   pin the two things that were being conflated: the width a breakpoint means, and
   the room available to show it. */
test('a breakpoint renders at the width it means, not at whatever is left over', () => {
  a.equal(C.canvasWidth('mobile', '1200px'), 414);
  a.equal(C.canvasWidth('tablet', '1200px'), 834);
  /* desktop has to clear the 1024px tablet query with room to spare */
  a.ok(C.canvasWidth('desktop', '1200px') > 1024);
  a.equal(C.canvasWidth('desktop', '1200px'), 1320, 'the container plus breathing room');
});

test('the desktop canvas is never narrower than the project container', () => {
  /* otherwise the container, not the breakpoint, is what the preview shows you */
  a.ok(C.canvasWidth('desktop', '1600px') >= 1600);
  a.equal(C.canvasWidth('desktop', '1600px'), 1720);
  /* and never narrower than the floor, whatever the container says */
  a.equal(C.canvasWidth('desktop', '600px'), 1280);
  a.equal(C.canvasWidth('desktop', ''), 1280);
  a.equal(C.canvasWidth('desktop', '90%'), 1280, 'a non-px container falls back to the floor');
  a.equal(C.canvasWidth('desktop', '80vw'), 1280);
});

test('every device width clears the query below it, at any window size', () => {
  /* the actual regression: no available width may change which breakpoint renders */
  for (const avail of [400, 581, 741, 900, 1059, 1400, 2200]) {
    const w = C.canvasWidth('desktop', '1200px');
    a.ok(w > 1024, `desktop stays above the tablet query with ${avail}px available`);
    a.ok(C.zoomFor('fit', w, avail) > 0, 'and is always shown at some scale');
  }
  a.ok(C.canvasWidth('tablet', '1200px') <= 1024, 'tablet sits inside the tablet query');
  a.ok(C.canvasWidth('tablet', '1200px') > 767, 'but above the mobile one');
  a.ok(C.canvasWidth('mobile', '1200px') <= 767);
});

test('fit scales down to the space available and never magnifies', () => {
  a.equal(C.fitZoom(1320, 660), 0.5);
  a.equal(C.fitZoom(1320, 1320), 1);
  /* a 414px mobile frame in a wide window belongs at 100%, not blown up */
  a.equal(C.fitZoom(414, 1400), 1);
  a.equal(C.fitZoom(0, 500), 1, 'no target, no scaling');
  a.equal(C.fitZoom(1320, 0), 1, 'no room measured yet, no scaling');
  a.equal(C.fitZoom(1320, -20), 1);
});

test('zoomFor honours an explicit choice and falls back to fit', () => {
  a.equal(C.zoomFor('fit', 1320, 660), 0.5);
  a.equal(C.zoomFor(null, 1320, 660), 0.5, 'unset means fit');
  a.equal(C.zoomFor('1', 1320, 660), 1, 'an explicit 100% overrides the space available');
  a.equal(C.zoomFor('0.25', 1320, 660), 0.25);
  a.equal(C.zoomFor('nonsense', 1320, 660), 1, 'an unparseable choice is 100%, not 0');
});

test('the zoom list offers fit plus fixed steps, all parseable', () => {
  a.equal(C.ZOOMS[0][0], 'fit');
  C.ZOOMS.slice(1).forEach(([v]) => {
    const n = parseFloat(v);
    a.ok(n > 0 && n <= 1, `${v} is a usable factor`);
  });
  a.deepEqual(C.ZOOMS.map(z => z[1]), ['Fit', '100%', '75%', '50%', '25%']);
});

test('the two demo breakpoints a laptop used to hide are reachable', () => {
  /* 1440px window, inspector open: ~741px of room. Before, that *was* the canvas
     width, so the title rendered at its mobile 27px. Now the frame is 1320px wide
     and scaled, so the desktop rule is the one that applies. */
  const w = C.canvasWidth('desktop', C.state.meta.maxWidth);
  const k = C.fitZoom(w, 741);
  a.ok(w > 1024, 'desktop rules apply in the frame');
  a.ok(k < 1, 'and it is scaled to fit the laptop');
  a.equal(Math.round(w * k), 741, 'filling exactly the room there is');
});

/* ================================================== somewhere of your own to start
   The only way out of the demo used to be "Reset to demo content", so building your
   own site meant deleting two pages and then emptying a six-node header and a
   fifteen-node footer by hand. */
test('an empty site is one empty page, and no global regions', () => {
  fresh();
  const pg = C.blankProject('Harbour Print Co');
  a.equal(C.state.meta.name, 'Harbour Print Co');
  a.equal(C.state.pages.length, 1);
  a.deepEqual([pg.name, pg.slug], ['Home', 'index']);
  a.deepEqual(pg.tree, []);
  a.deepEqual(C.state.header, []);
  a.deepEqual(C.state.footer, []);
  a.equal(C.state.cur, 0);
  a.equal(pg.title, '', 'nothing filled in on your behalf');
  a.equal(pg.desc, '');
});

test('what you built survives it: colours, text styles, classes, blocks', () => {
  fresh();
  C.classAdd('Card', { d: { padding: '20px' } });
  C.colorAdd('Brand teal', '#0aa');
  C.state.meta.blocks = [{ id: 'hero', name: 'Hero', node: C.N('heading'), sync: 0 }];
  const before = [C.colors().length, C.styles().length, C.classes().length, C.blocks().length];
  C.blankProject('Mine');
  a.deepEqual([C.colors().length, C.styles().length, C.classes().length, C.blocks().length], before,
    'a library is work, not content');
  a.ok(klass('card'), 'a class you made is still there');
});

test('a collection keeps its schema and loses its items', () => {
  fresh();
  const col = collectionAdd('Projects');
  C.fieldAdd(col.id, 'Summary', 'text');
  itemAdd(col.id); itemAdd(col.id);
  a.equal(coll(col.id).items.length, 2);
  C.blankProject('Mine');
  const after = coll(col.id);
  a.ok(after, 'the content type is a library and stays');
  a.equal(after.fields.length, 2, 'with its fields');
  a.equal(after.items.length, 0, 'but the items were content, and content goes');
});

test('starting empty is undoable', () => {
  fresh();
  const had = C.state.pages.length;
  C.edit(() => C.blankProject('Mine'));
  a.equal(C.state.pages.length, 1);
  C.undo();
  a.equal(C.state.pages.length, had, 'the demo comes back');
  a.equal(C.state.meta.name, 'Pagecraft');
});

test('an unnamed empty site still has a name', () => {
  fresh();
  C.blankProject('');
  a.equal(C.state.meta.name, 'Untitled site');
  C.blankProject('   ');
  a.equal(C.state.meta.name, 'Untitled site');
  C.blankProject('x'.repeat(90));
  a.equal(C.state.meta.name.length, 60, 'and a bounded one');
});

test('a brand-new empty site is not told off for having no H1', () => {
  fresh();
  C.blankProject('Mine');
  const codes = [...new Set(C.lint().map(f => f.code))].sort();
  /* a page with nothing on it has no heading structure to get wrong; what is left is
     the two things a new site genuinely has to fill in */
  a.deepEqual(codes, ['no-desc', 'no-title']);
  a.equal(C.lintCounts(C.lint()).error, 0, 'and nothing is an error yet');
});

/* ============================================================ style clipboard
   A text style covers the reusable case. This is the one-off: before it, the only
   way to make one element look like another was to rebuild it control by control. */
/* `a` is the assert alias in this file, so the fixture names its nodes src/dst —
   destructuring a node called `a` shadowed it and every case here failed at once. */
const styled = () => {
  blank();
  const src = insert('heading', null, 0);
  const dst = insert('heading', null, 1);
  src.css.d = { color: '#a8402f', 'letter-spacing': '.06em' };
  src.css.t = { 'font-size': '30px' };
  src.css.m = { 'font-size': '22px' };
  src.props.ts = 'subtitle';
  return { src, dst };
};

test('a copied look carries every breakpoint, its classes and its text style', () => {
  const { src } = styled();
  C.classAdd('Card', { d: { padding: '20px' } });
  C.classApply(src, 'card');
  src.adv.css = '&:hover{opacity:.8}';
  C.copyStyles(src.id);
  const sc = must(C.styleClip.css, 'copied styles');
  a.equal(sc.d.color, '#a8402f');
  a.equal(sc.t['font-size'], '30px', 'a look is not a look if it falls apart on mobile');
  a.equal(sc.m['font-size'], '22px');
  a.deepEqual(C.styleClip.cls, ['card']);
  a.equal(C.styleClip.ts, 'subtitle');
  a.equal(C.styleClip.adv, '&:hover{opacity:.8}');
  a.match(C.styleClip.from, /^A headline/, 'it names what it holds');
});

test('pasting replaces rather than merges', () => {
  const { src, dst } = styled();
  dst.css.d = { 'font-weight': '900', 'text-align': 'center' };
  C.copyStyles(src.id);
  C.pasteStyles(dst.id);
  a.equal(dst.css.d.color, '#a8402f');
  a.equal(dst.css.d['font-weight'], undefined,
    'a merge would leave whatever the target had that the source never mentioned');
  a.equal(dst.css.d['text-align'], undefined);
  a.deepEqual(dst.css.m, { 'font-size': '22px' });
});

test('a text style travels only where the target has one to set', () => {
  const { src } = styled();
  C.copyStyles(src.id);
  const h = insert('heading', null, 1);
  const img = insert('image', null, 2);
  C.pasteStyles(h.id);
  C.pasteStyles(img.id);
  a.equal(h.props.ts, 'subtitle', 'a Heading declares a text style');
  a.equal(img.props.ts, undefined, 'an Image does not, so it is left alone');
  /* CSS is universal, the same rule fanTargets uses for multi-select */
  a.equal(img.css.d['letter-spacing'], '.06em', 'the CSS still crosses');
});

test('a class deleted between the copy and the paste is dropped, not carried', () => {
  const { src, dst } = styled();
  C.classAdd('Card', { d: { padding: '20px' } });
  C.classApply(src, 'card');
  C.copyStyles(src.id);
  C.classDelete('card');
  C.pasteStyles(dst.id);
  a.deepEqual(dst.cls, [], 'no dangling id');
});

test('the two clipboards are independent', () => {
  const { src, dst } = styled();
  C.copyNode(src.id);
  C.copyStyles(dst.id);
  a.equal(must(C.clip.node, 'clipboard node').id, src.id, 'copying a look did not throw away the copied element');
  C.copyNode(dst.id);
  a.ok(C.styleClip.css, 'and copying an element did not throw away the look');
});

test('pasting onto a set counts what it changed, and does nothing with an empty clipboard', () => {
  const { src } = styled();
  const one = insert('heading', null, 1);
  const two = insert('heading', null, 2);
  C.copyStyles(src.id);
  a.equal(C.pasteStylesMany([one.id, two.id]), 2);
  a.equal(one.css.d.color, '#a8402f');
  a.equal(two.css.d.color, '#a8402f');
  a.equal(C.pasteStylesMany([one.id, 'no-such-node']), 1, 'a missing id is skipped, not thrown');
  C.styleClip.css = null;
  a.equal(C.pasteStyles(one.id), false, 'nothing copied, nothing pasted');
});

/* ================================================================== finding
   Nothing could find a word across a project. With twelve pages, two global regions
   and a CMS, "where did I write that" had no answer, and renaming anything meant
   opening every page to look. */
test('a search reaches every region, and reports where each hit lives', () => {
  fresh();
  const hits = C.searchAll('Pagecraft');
  const wheres = [...new Set(hits.map(h => h.where))].sort();
  a.deepEqual(wheres, ['footer', 'header', 'page', 'project'],
    'the global regions and the page fields are searched, not only page elements');
  a.ok(hits.some(h => h.field === 'Browser title'),
    'a page title is text the site publishes, so a rename that misses it is not a rename');
  a.ok(hits.some(h => h.field === 'Project name'));
  a.equal(C.searchCount(hits), hits.length, 'one occurrence each in the demo');
});

test('a search finds nothing for nothing', () => {
  fresh();
  a.deepEqual(C.searchAll(''), []);
  a.deepEqual(C.searchAll(null), []);
  a.deepEqual(C.searchAll('zzzznotpresent'), []);
});

test('case sensitivity is a choice', () => {
  blank();
  const h = insert('heading', null, 0);
  h.props.text = 'Harbour harbour HARBOUR';
  a.equal(C.searchCount(C.searchAll('harbour')), 3, 'insensitive by default');
  a.equal(C.searchCount(C.searchAll('harbour', { caseSensitive: true })), 1);
  a.equal(C.searchCount(C.searchAll('HARBOUR', { caseSensitive: true })), 1);
});

test('rich text is searched as text, never as markup', () => {
  blank();
  const t = insert('text', null, 0);
  t.props.html = '<div class="wrap"><p>a wrapper of words</p></div>';
  /* looking for "div" must not report every tag, and "class" must not match an attribute */
  a.equal(C.searchCount(C.searchAll('div')), 0);
  a.equal(C.searchCount(C.searchAll('class')), 0);
  a.equal(C.searchCount(C.searchAll('wrap')), 1, 'the one in the sentence, not the one in the class');
  a.equal(C.searchCount(C.searchAll('words')), 1);
});

test('a replace stays out of the tags too', () => {
  blank();
  const t = insert('text', null, 0);
  t.props.html = '<div class="wrap"><p>wrap it</p></div>';
  a.equal(C.replaceAll('wrap', 'fold'), 1);
  a.equal(t.props.html, '<div class="wrap"><p>fold it</p></div>', 'the class attribute is untouched');
});

test('outsideTags only transforms what sits between tags', () => {
  a.equal(C.outsideTags('<b title="a">a</b>', s => s.toUpperCase()), '<b title="a">A</b>');
  a.equal(C.outsideTags('plain', s => s.toUpperCase()), 'PLAIN');
  a.equal(C.outsideTags('', () => 'x'), 'x');
});

test('a replace reaches nested props: accordion rows, nav links, form fields', () => {
  blank();
  const acc = insert('accordion', null, 0);
  acc.props.items = [{ q: 'Is Acme good?', a: 'Acme is fine.' }];
  const nav = insert('nav', null, 1);
  nav.props.items = [{ label: 'Acme', href: '#acme' }];
  const form = insert('form', null, 2);
  form.props.fields = [{ type: 'text', label: 'Acme name', name: 'n', ph: 'Your Acme id' }];
  a.equal(C.searchCount(C.searchAll('Acme')), 5, 'both accordion keys, the nav label and href, both form strings');
  C.replaceAll('Acme', 'Beta');
  a.equal(acc.props.items[0].q, 'Is Beta good?');
  a.equal(acc.props.items[0].a, 'Beta is fine.');
  a.equal(nav.props.items[0].label, 'Beta');
  a.equal(form.props.fields[0].label, 'Beta name');
  a.equal(form.props.fields[0].ph, 'Your Beta id');
  a.equal(C.searchCount(C.searchAll('Acme')), 0);
});

test('a page slug is left alone — it is a published URL', () => {
  fresh();
  const slugs = C.state.pages.map(p => p.slug);
  C.replaceAll('Pagecraft', 'Harbour');
  a.deepEqual(C.state.pages.map(p => p.slug), slugs,
    'moving a URL because a word changed is how links break');
  a.equal(C.state.meta.name, 'Harbour', 'but the project name does follow');
});

test('a replace is one undo step for the whole project', () => {
  fresh();
  const before = C.searchCount(C.searchAll('Pagecraft'));
  a.ok(before > 3);
  C.edit(() => C.replaceAll('Pagecraft', 'Harbour'));
  a.equal(C.searchCount(C.searchAll('Pagecraft')), 0);
  C.undo();
  a.equal(C.searchCount(C.searchAll('Pagecraft')), before);
});

test('CMS item values are searched and replaced', () => {
  blank();
  const col = collectionAdd('Projects');
  const it = itemAdd(col.id);
  C.itemSet(col.id, it.id, 'title', 'Acme rebrand');
  const hits = C.searchAll('Acme');
  a.equal(hits.length, 1);
  a.equal(hits[0].where, 'cms');
  a.equal(hits[0].pageName, 'Projects');
  C.replaceAll('Acme', 'Beta');
  a.equal(coll(col.id).items[0].values.title, 'Beta rebrand');
  /* and it can be told not to */
  C.replaceAll('Beta', 'Gamma', { cms: false });
  a.equal(coll(col.id).items[0].values.title, 'Beta rebrand');
});

test('a text slot is declared once and every walker agrees', () => {
  blank();
  const g = insert('gallery', null, 0);
  g.props.items = [{ src: 'asset:a', alt: 'A plate', caption: 'Plate one' }];
  const slots = C.textSlots(g);
  a.equal(slots.length, 2, 'alt and caption, not src');
  a.deepEqual(slots.map(C.slotName), ['Alt text', 'Caption']);
  a.equal(C.slotGet(g, slots[0]), 'A plate');
  C.slotSet(g, slots[1], 'Changed');
  a.equal(g.props.items[0].caption, 'Changed');
});

test('every widget that carries text declares it', () => {
  /* the walker is the only place this is written down, so a widget missing from it is
     a widget find-and-replace silently cannot reach */
  ['heading', 'text', 'button', 'image', 'icon', 'embed', 'accordion', 'gallery', 'nav', 'form']
    .forEach(t => a.ok(C.TEXT_SLOTS[t as keyof typeof C.TEXT_SLOTS], t + ' names its text props'));
  Object.keys(C.TEXT_SLOTS).forEach(t => a.ok(C.DEF[t], t + ' is a real widget'));
});

/* ============================================================= binding a card
   Binding was one control at a time: select, open Content, click the badge, pick a
   field, repeat. About fifteen interactions for a five-field card, and nowhere to
   see the mapping as a whole. */
const cardIn = () => {
  blank();
  const col = collectionAdd('Projects');
  C.fieldAdd(col.id, 'Summary', 'rich');
  C.fieldAdd(col.id, 'Cover', 'image');
  C.fieldAdd(col.id, 'Year', 'number');
  C.fieldAdd(col.id, 'Read more', 'link');
  const card = C.N('column', {}, {}, [C.N('heading'), C.N('text'), C.N('image'), C.N('button')]);
  const list = C.N('list', {}, {}, [card]);
  C.srcSet(list, col.id);
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  return { col, list };
};

test('the sheet lists content, not settings', () => {
  const { list } = cardIn();
  const slots = C.bindSlots(list.id);
  /* every bindable key would be sixteen rows for this card, thirteen of them things
     nobody binds — a list's sort order, a heading's HTML tag, an image's lazy flag */
  a.equal(slots.length, 9);
  slots.forEach(s => a.ok(C.BIND_CTL.includes(s.ctl), s.label + ' is a content control'));
  a.equal(slots.filter(s => s.key === 'html').length, 1, 'the WYSIWYG body is in there');
});

test('a WYSIWYG body can be bound at all', () => {
  /* the rich control had no `k`, so bindableKeys skipped it and the single most
     useful thing to bind was unreachable — boundProps could always resolve it */
  a.deepEqual(C.bindableKeys('text'), ['html']);
});

test('the first guess gets a normal card right', () => {
  const { col, list } = cardIn();
  const slots = C.bindSlots(list.id);
  const g = C.guessBindings(slots, col);
  const bindOf = (type: string, key: string) => g[must(slots.find(s => s.type === type && s.key === key), `slot ${type}.${key}`).nodeId + '|' + key];
  a.equal(bindOf('heading', 'text'), 'title');
  a.equal(bindOf('text', 'html'), 'summary');
  a.equal(bindOf('image', 'src'), 'cover');
  a.equal(bindOf('button', 'link'), 'read-more', 'the button gets the link field, not the heading');
  a.equal(bindOf('heading', 'link'), '', 'and the heading is left alone rather than guessed at');
});

test('a field is used once, so a second heading does not also take the title', () => {
  const { col } = cardIn();
  const card = C.N('column', {}, {}, [C.N('heading'), C.N('heading')]);
  const list = C.N('list', {}, {}, [card]);
  C.srcSet(list, col.id);
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  const slots = C.bindSlots(list.id);
  const g = C.guessBindings(slots, col);
  const texts = slots.filter(s => s.key === 'text').map(s => g[s.nodeId + '|text']);
  a.equal(texts[0], 'title');
  a.equal(texts[1], '', 'the title is consumed, and a wrong guess is worse than none');
});

test('a name match beats the shape of the control', () => {
  blank();
  const col = collectionAdd('Things');
  C.fieldAdd(col.id, 'Caption', 'text');
  const img = C.N('image');
  const list = C.N('list', {}, {}, [C.N('column', {}, {}, [img])]);
  C.srcSet(list, col.id);
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  const slots = C.bindSlots(list.id);
  const g = C.guessBindings(slots, col);
  a.equal(g[img.id + '|caption'], 'caption', 'a field called Caption goes to the Caption control');
});

test('an existing binding is never guessed over', () => {
  const { col, list } = cardIn();
  const h = at(C.bindSlots(list.id)[0].nodeId).node;
  C.bindSet(h, 'text', 'year');
  const slots = C.bindSlots(list.id);
  const g = C.guessBindings(slots, col);
  a.equal(g[h.id + '|text'], 'year', 'a decision already made stays made');
});

test('applyBindings writes the map and counts only what changed', () => {
  const { col, list } = cardIn();
  const slots = C.bindSlots(list.id);
  const g = C.guessBindings(slots, col);
  a.equal(C.applyBindings(g), 4);
  a.equal(C.applyBindings(g), 0, 'writing the same map again changes nothing');
  const h = at(slots.find(s => s.key === 'text').nodeId).node;
  a.equal(C.bindGet(h, 'text'), 'title');
  /* clearing is a write too */
  slots.forEach(s => { g[s.nodeId + '|' + s.key] = ''; });
  a.equal(C.applyBindings(g), 4);
  a.equal(C.bindGet(h, 'text'), '');
});

test('a bound card renders one per item, with the bound values', () => {
  const { col, list } = cardIn();
  C.applyBindings(C.guessBindings(C.bindSlots(list.id), col));
  const a1 = itemAdd(col.id); C.itemSet(col.id, a1.id, 'title', 'Acme rebrand');
  const a2 = itemAdd(col.id); C.itemSet(col.id, a2.id, 'title', 'Northwind app');
  const html = C.renderNode(at(list.id).node, { edit: false });
  a.match(html, /Acme rebrand/);
  a.match(html, /Northwind app/);
  /* the class *and* the auto id both contain the widget slug, so count the class */
  a.equal((html.match(/class="pagecraft-heading/g) || []).length, 2, 'one card per item');
});

test('a scope with nothing bindable in it gives an empty sheet', () => {
  blank();
  const col = collectionAdd('Things');
  const list = C.N('list', {}, {}, [C.N('column', {}, {}, [C.N('divider'), C.N('spacer')])]);
  C.srcSet(list, col.id);
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  a.deepEqual(C.bindSlots(list.id), []);
  a.deepEqual(C.guessBindings([], col), {});
  a.deepEqual(C.guessBindings(C.bindSlots(list.id), null), {}, 'and no collection means no guess');
});

/* ========================================== moving a set, and moving from the list
   Dragging with several selected was impossible — the HUD hid its handle, because
   moving a set was left out of the multi-select pass. */
const fourSections = () => {
  blank();
  const t = C.state.pages[0].tree;
  ['a', 'b', 'c', 'd'].forEach(k => {
    const sec = C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [C.N('heading', { text: k })])])]);
    t.push(sec);
  });
  const label = (n: PcNode) => { let v = ''; C.eachNode([n], x => { if (!v && x.props && x.props.text) v = x.props.text; }); return v; };
  return { t, order: () => t.map(label) };
};

test('a set moves together and keeps its order', () => {
  const { t, order } = fourSections();
  a.deepEqual(order(), ['a', 'b', 'c', 'd']);
  a.equal(C.moveMany([t[0].id, t[1].id], null, 4), 2);
  a.deepEqual(order(), ['c', 'd', 'a', 'b'], 'a stays ahead of b');
});

test('a set moving backwards in its own list lands where it was aimed', () => {
  const { t, order } = fourSections();
  /* the members that were ahead of the target leave holes behind them, which is why
     the insertion point is re-read rather than assumed */
  C.moveMany([t[2].id, t[3].id], null, 0);
  a.deepEqual(order(), ['c', 'd', 'a', 'b']);
});

test('moving a set is not confused by document order of the ids', () => {
  const { t, order } = fourSections();
  C.moveMany([t[1].id, t[0].id], null, 4);   // given out of order on purpose
  a.deepEqual(order(), ['c', 'd', 'a', 'b'], 'selOrder settles it, not the caller');
});

test('a parent and its own child in one set move once, as the parent', () => {
  const { t, order } = fourSections();
  const inner = t[0].children[0];
  a.equal(C.moveMany([t[0].id, inner.id], null, 4), 1, 'topMost drops the child');
  a.deepEqual(order(), ['b', 'c', 'd', 'a']);
});

test('a Navigator drop reads the thirds of a row', () => {
  const { t } = fourSections();
  const before = layerTarget(t[2].id, 'before', 'section', []);
  const after = layerTarget(t[2].id, 'after', 'section', []);
  a.equal(before.container, null, 'a section sits at the root');
  a.equal(before.index, 2);
  a.equal(after.index, 3);
});

test('the middle of a row drops inside it, when it can hold the thing', () => {
  const { t } = fourSections();
  const col = t[0].children[0].children[0];
  const inside = layerTarget(col.id, 'inside', 'heading', []);
  a.equal(must(inside.container, 'container').id, col.id);
  a.equal(inside.index, 0, 'first inside — the only way a list can reach an empty container');
  a.equal(C.layerTarget(col.id, 'inside', 'section', []), null, 'a column cannot hold a section');
});

test('a row that is the dragged node, or under it, is refused', () => {
  const { t } = fourSections();
  const inner = t[0].children[0];
  a.equal(C.layerTarget(t[0].id, 'inside', 'section', [t[0].id]), null, 'not inside itself');
  a.equal(C.layerTarget(inner.id, 'inside', 'row', [t[0].id]), null,
    'and not inside its own descendant — that detaches the tree');
  a.ok(layerTarget(t[1].id, 'after', 'section', [t[0].id]), 'a different branch is fine');
});

test('a Navigator drop onto a missing row is nothing, not a throw', () => {
  fourSections();
  a.equal(C.layerTarget('no-such-row', 'before', 'section', []), null);
});

/* The snippet used to take an offset into the raw value, strip the tags, and then
   re-find the match with indexOf — which returns the *earliest* occurrence, not the
   one that was found. So a second hit was shown with the first one's context. */
test('a snippet shows the match it was given, not the first one that looks like it', () => {
  const v = '<i>web</i> then web here';
  const at = v.indexOf('web', 12);           // the second one
  const s = C.snippet(C.searchText(v, true), at - 3, 3, 8);
  a.match(s, /then web here/, 'centred on the second occurrence');
});

test('slotHits offsets index the same string the snippet slices', () => {
  const v = 'the web and the web again';
  const h = C.slotHits(v, 'web', true, false);
  a.equal(h.n, 2);
  a.equal(h.text.slice(h.at, h.at + 3), 'web', 'the offset lands on the match, in h.text');
});

test('a tag becomes a space, so a match can never form across one', () => {
  /* this is what keeps the count identical to what replaceAll will change */
  a.equal(C.slotHits('<b>we</b>b', 'web', true, true).n, 0);
  a.equal(C.searchText('<b>we</b>b', true), ' we b', 'one space per tag');
  a.equal(C.searchText('plain', false), 'plain');
});

test('whitespace is collapsed after slicing, never before', () => {
  const t = C.searchText('<p>a</p><p>needle</p><p>b</p>', true);
  const h = C.slotHits('<p>a</p><p>needle</p><p>b</p>', 'needle', true, true);
  a.match(C.snippet(t, h.at, 6, 20), /a needle b/, 'readable, and still the right match');
});

/* ================================================= what applies to a selection
   Three places grew their own copy of "duplicate this, delete this" — the canvas HUD
   bar, the Navigator row, the inspector footer — each offering a different subset of
   the same verbs, and none offering copy/paste styles. `menuFor` is the single answer
   to "what applies here", and `runAct` in the UI is the single place that does it. */
const acts = (ids: string[]) => C.menuFor(ids).map(i => i.act);

test('the menu offers what the element can actually do', () => {
  blank();
  const h = insert('heading', null, 0);
  const a1 = acts([h.id]);
  a.ok(a1.includes('edit'), 'a heading has content to edit in place');
  a.ok(a1.includes('up'), 'and a parent to select — insert built the wrappers');
  a.ok(a1.includes('block'));
  a.ok(a1.includes('del'));
});

test('a type with nothing to edit in place is not offered it', () => {
  blank();
  const d = insert('divider', null, 0);
  a.equal(acts([d.id]).includes('edit'), false);
  const img = insert('image', null, 1);
  a.equal(acts([img.id]).includes('edit'), false, 'an image is edited through its fields');
});

test('paste appears only when there is something to paste', () => {
  blank();
  const h = insert('heading', null, 0);
  C.clip.node = null;
  C.styleClip.css = null;
  a.equal(acts([h.id]).includes('paste'), false);
  a.equal(acts([h.id]).includes('stpaste'), false,
    'a permanently dead row reads as a broken menu');
  C.copyNode(h.id);
  C.copyStyles(h.id);
  a.ok(acts([h.id]).includes('paste'));
  a.ok(acts([h.id]).includes('stpaste'));
  a.match(must(C.menuFor([h.id]).find(i => i.act === 'paste'), 'paste').label, /^Paste Heading$/,
    'and it names what would land');
});

test('a multi-selection says how many, and which verbs cannot fan out', () => {
  blank();
  const one = insert('heading', null, 0);
  const two = insert('heading', null, 1);
  C.copyStyles(one.id);
  const m = C.menuFor([one.id, two.id]);
  const label = (act: string) => must(m.find(i => i.act === act), act).label;
  a.match(label('dup'), /Duplicate all 2/);
  a.match(label('del'), /Delete all 2/);
  a.match(label('stpaste'), /Paste styles to 2/);
  /* the node clipboard holds one element, so copy and cut say which one they take */
  a.match(label('copy'), /Copy the first/);
  a.match(label('cut'), /Cut the first/);
  a.equal(m.map(i => i.act).includes('edit'), false, 'no in-place edit for a set');
  a.equal(m.map(i => i.act).includes('block'), false, 'and a block is one element');
});

test('hide names the breakpoint it applies to, and reads the current state', () => {
  blank();
  const h = insert('heading', null, 0);
  a.match(must(C.menuFor([h.id]).find(i => i.act === 'hide'), 'hide').label, /^Hide on Desktop$/);
  h.hide = { d: true };
  a.match(must(C.menuFor([h.id]).find(i => i.act === 'hide'), 'hide').label, /^Show on Desktop$/);
  C.state.ui.dev = 'mobile';
  a.match(must(C.menuFor([h.id]).find(i => i.act === 'hide'), 'hide').label, /on Mobile$/);
  C.state.ui.dev = 'desktop';
});

test('pushing a block copy is offered only on a copy of a global block', () => {
  blank();
  const h = insert('heading', null, 0);
  a.equal(acts([h.id]).includes('push'), false);
  const bid = blockSave(h.id, 'Hero', 1);
  h.adv.block = bid;
  a.ok(acts([h.id]).includes('push'), 'this one is linked to a block');
  h.adv.block = 'gone';
  a.equal(acts([h.id]).includes('push'), false, 'a dangling link offers nothing');
});

test('the menu is grouped, and delete is last and marked', () => {
  blank();
  const h = insert('heading', null, 0);
  const m = C.menuFor([h.id]);
  a.ok(m.filter(i => i.sep).length >= 3, 'hairlines, not one long list');
  a.equal(m[m.length - 1].act, 'del', 'the destructive one is last');
  a.equal(m[m.length - 1].danger, true, 'and says so');
  a.equal(m[m.length - 1].sep, undefined, 'nothing follows it to separate from');
});

test('nothing selected offers nothing, and a stale id is skipped', () => {
  blank();
  a.deepEqual(C.menuFor([]), []);
  a.deepEqual(C.menuFor(null), []);
  a.deepEqual(C.menuFor(['no-such-node']), [], 'a deleted node has no menu');
});

/* ------------------------------------------- what the inspector is editing
   These eight lived in the UI half until now, which is why none of them had a test.
   `cssVal` is the one that matters: its fallback chain *is* the responsive cascade,
   and the canvas rendering desktop styling at a mobile width came from getting that
   relationship wrong elsewhere. */

test('parseU splits a value from its unit, and refuses to guess', () => {
  a.deepEqual(C.parseU('24px'), { n: '24', u: 'px' });
  a.deepEqual(C.parseU('1.5rem'), { n: '1.5', u: 'rem' });
  a.deepEqual(C.parseU('-8px'), { n: '-8', u: 'px' }, 'negatives are real values here');
  a.deepEqual(C.parseU('  40 %  '), { n: '40', u: '%' }, 'whitespace either side, and before the unit');
  a.deepEqual(C.parseU('700'), { n: '700', u: '' }, 'unitless is legitimate — font-weight, line-height');
  /* the inspector shows these straight to the user, so an unparseable value has to
     come back empty rather than as NaN or a partial number */
  ['auto', 'inherit', 'calc(100% - 8px)', '10pt', '', null, undefined].forEach(v => {
    a.deepEqual(C.parseU(v), { n: '', u: '' }, JSON.stringify(v) + ' is not a number and a unit');
  });
});

test('cssVal falls back mobile → tablet → desktop, the way the export cascades', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d = { 'font-size': '48px' };
  const read = (dev: 'desktop' | 'tablet' | 'mobile') => { C.state.ui.dev = dev; return C.cssVal(h, 'font-size', true); };

  a.deepEqual(read('desktop'), { v: '48px', own: true }, 'desktop owns the base');
  a.deepEqual(read('tablet'), { v: '48px', own: false }, 'tablet shows it but does not own it');
  a.deepEqual(read('mobile'), { v: '48px', own: false });

  h.css.t = { 'font-size': '36px' };
  a.deepEqual(read('tablet'), { v: '36px', own: true });
  a.deepEqual(read('mobile'), { v: '36px', own: false },
    'mobile inherits from tablet, not from desktop — this is the whole chain');

  h.css.m = { 'font-size': '28px' };
  a.deepEqual(read('mobile'), { v: '28px', own: true });
  a.deepEqual(read('desktop'), { v: '48px', own: true }, 'and the base is untouched by either');
});

test('cssVal reports own only for a value set at the breakpoint being edited', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d = { color: '#111111' };
  /* `own` drives the override badge, so it has to mean "set here". An empty string is
     what a cleared field leaves behind, and it must not read as an override. */
  h.css.m = { color: '' };
  C.state.ui.dev = 'mobile';
  a.deepEqual(C.cssVal(h, 'color', true), { v: '#111111', own: false },
    'an empty override is not an override');
  a.deepEqual(C.cssVal(h, 'missing-prop', true), { v: '', own: false }, 'and nothing set reads as empty');
});

test('cssVal ignores the current device for a non-responsive control', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d = { 'font-size': '48px' };
  h.css.m = { 'font-size': '28px' };
  C.state.ui.dev = 'mobile';
  a.deepEqual(C.cssVal(h, 'font-size', false), { v: '48px', own: true },
    'a control that is not responsive always edits the base, wherever you are standing');
});

test('setCss writes at the breakpoint being edited, and clearing deletes', () => {
  blank();
  const h = insert('heading', null, 0);
  C.state.ui.dev = 'mobile';
  C.setCss(h, 'font-size', '28px', true);
  a.deepEqual(h.css.m, { 'font-size': '28px' });
  a.equal(h.css.d['font-size'], undefined, 'the base is left alone');

  C.state.ui.dev = 'desktop';
  C.setCss(h, 'font-size', '48px', true);
  a.equal(h.css.d['font-size'], '48px');

  /* storing '' would emit `font-size:` into the export and shadow the value below it
     in the cascade, so clearing has to remove the key outright */
  C.state.ui.dev = 'mobile';
  C.setCss(h, 'font-size', '', true);
  a.equal('font-size' in h.css.m, false, 'cleared, not blanked');
  C.state.ui.dev = 'desktop';
  a.deepEqual(C.cssVal(h, 'font-size', true), { v: '48px', own: true }, 'and the base shows through again');

  C.setCss(h, 'color', null, true);
  a.equal('color' in h.css.d, false, 'null clears too — the inspector sends both');
});

test('setCss writes the base when the control is not responsive', () => {
  blank();
  const h = insert('heading', null, 0);
  C.state.ui.dev = 'mobile';
  C.setCss(h, 'text-align', 'center', false);
  a.equal(h.css.d['text-align'], 'center');
  a.equal('text-align' in (h.css.m || {}), false, 'and nothing lands at the mobile breakpoint');
});

test('tgtObj sends styling to the targeted class, but only if the node has it', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = C.classAdd('Card', { d: { padding: '20px' } });

  C.state.ui.target = '';
  a.equal(C.tgtObj(h), h, 'nothing targeted: the element itself');
  a.equal(C.tgtIsClass(h), false);

  /* targeted but not applied. Without the `cls` check this returned the class, and a
     style edit would have restyled every other element using it. */
  C.state.ui.target = id;
  a.equal(C.tgtObj(h), h, 'a class this element does not carry is not a target');
  a.equal(C.tgtIsClass(h), false);

  C.classApply(h, id);
  a.equal(C.tgtObj(h), C.findClass(id), 'applied and targeted: the class');
  a.equal(C.tgtIsClass(h), true);

  C.classRemove(h, id);
  a.equal(C.tgtObj(h), h, 'removing it takes the target away with it');
  C.state.ui.target = '';
});

test('tgtObj survives a target naming a class that no longer exists', () => {
  blank();
  const h = insert('heading', null, 0);
  C.state.ui.target = 'deleted-class';
  a.equal(C.tgtObj(h), h, 'a stale target falls back to the element rather than throwing');
  C.state.ui.target = '';
});

test('linkOf remembers a mode picked before there is a value to derive it from', () => {
  blank();
  const b = insert('button', null, 0);
  b.props.link = '';
  a.equal(C.linkOf(b, 'link', 'index').mode, 'none', 'nothing typed, nothing to infer');

  /* the select snapped shut before its input could appear, because an empty URL parses
     back as `none`. The pending choice lives in ui.lmode until a value makes it real. */
  C.state.ui.lmode = { key: b.id + '|link', mode: 'url' };
  a.equal(C.linkOf(b, 'link', 'index').mode, 'url', 'the pending mode holds the field open');

  b.props.link = 'https://example.com';
  a.equal(C.linkOf(b, 'link', 'index').mode, 'url', 'and once there is a value it derives itself');

  /* the pending mode belongs to one field, not to the editor */
  C.state.ui.lmode = { key: 'some-other-node|link', mode: 'email' };
  b.props.link = '';
  a.equal(C.linkOf(b, 'link', 'index').mode, 'none', 'another field’s pending mode does not leak in');
  C.state.ui.lmode = null;
});

test('propVal reads a prop, and tolerates a control with no key', () => {
  blank();
  const h = insert('heading', null, 0);
  h.props.text = 'Hello';
  a.equal(C.propVal(h, 'text'), 'Hello');
  a.equal(C.propVal(h, 'nope'), undefined);
  /* a `toggle` or a section header carries no `k`, and the inspector calls this anyway */
  a.equal(C.propVal(h, undefined), undefined);
});

test('kb reads as a size a person would say out loud', () => {
  a.equal(C.kb(0), '1 KB', 'nothing is still one unit — "0 KB" reads as a broken upload');
  a.equal(C.kb(1024), '1 KB');
  a.equal(C.kb(1536), '2 KB');
  a.equal(C.kb(1048575), '1024 KB');
  a.equal(C.kb(1048576), '1.0 MB');
  a.equal(C.kb(2_600_000), '2.5 MB');
});

/* ------------------------------------------------------------------ crc32
   The zip builder needs Blob and CompressionStream so it stays in the UI, but the
   checksum is arithmetic and it had no test. A wrong CRC does not fail loudly: it
   produces an archive that will not open, which is the worst way for this to be
   wrong. These are the published CRC-32 (IEEE) vectors, so the test checks the
   standard rather than checking the implementation against itself. */
test('crc32 matches the published CRC-32 vectors', () => {
  const of = (s: string) => C.crc32(new TextEncoder().encode(s));
  a.equal(of(''), 0x00000000, 'empty input');
  a.equal(of('a'), 0xE8B7BE43);
  a.equal(of('abc'), 0x352441C2);
  a.equal(of('message digest'), 0x20159D7F);
  a.equal(of('123456789'), 0xCBF43926, 'the check value from the CRC catalogue');
  a.equal(of('The quick brown fox jumps over the lazy dog'), 0x414FA339);
  a.equal(of('abcdefghijklmnopqrstuvwxyz'), 0x4C2750BD);
});

test('crc32 stays inside 32 unsigned bits', () => {
  /* the zip header wants a uint32; a signed result writes the wrong four bytes */
  const of = (s: string) => C.crc32(new TextEncoder().encode(s));
  ['', 'a', 'abc', 'ÿþý', 'x'.repeat(5000)].forEach(s => {
    const v = of(s);
    a.ok(Number.isInteger(v) && v >= 0 && v <= 0xFFFFFFFF, JSON.stringify(s.slice(0, 12)) + ' -> ' + v);
  });
  a.equal(C.CRC_T.length, 256, 'the table is fully built');
});

test('crc32 is order-sensitive, which is the point of a checksum', () => {
  const of = (s: string) => C.crc32(new TextEncoder().encode(s));
  a.notEqual(of('ab'), of('ba'));
  a.notEqual(of('abc'), of('abcd'));
});

/* ------------------------------------------------------------ smartTarget
   Click-to-add. Every Add-panel click and every media-library placement goes through
   this, and it had no test either. */
test('smartTarget puts a new element inside the selection when it can hold one', () => {
  blank();
  const h = insert('heading', null, 0);
  const col = holderOf(h.id);
  C.selSet([col.id]);
  const [container, index] = C.smartTarget('heading');
  a.equal(container && container.id, col.id, 'a column can hold a heading, so it goes inside');
  a.equal(index, col.children.length, 'at the end of what is already there');
});

test('smartTarget places beside a leaf, because a leaf holds nothing', () => {
  blank();
  const one = insert('heading', null, 0);
  const col = holderOf(one.id);
  const two = insert('heading', col, 1);
  /* selecting the *first* heading has to place after it, not at the end of the column —
     "add" landing at the bottom of the page is the thing this exists to prevent */
  C.selSet([one.id]);
  const [container, index] = C.smartTarget('heading');
  a.equal(container && container.id, col.id, 'up one level, to the column that holds it');
  a.equal(index, 1, 'immediately after the selected heading');
  a.deepEqual(col.children.map(c => c.id), [one.id, two.id], 'and the fixture really is in that order');
});

test('smartTarget treats any deeper level as able to hold it, wrappers and all', () => {
  /* `holds` compares levels rather than listing legal children, so a section holds a
     heading — `insert` builds the row and column in between. That is why selecting a
     section adds *into* it rather than after it, and it is worth pinning down: the
     hierarchy comment reads Section > Row > Column > content, which invites the
     opposite guess. */
  blank();
  insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  C.selSet([sec.id]);
  const [container, index] = C.smartTarget('heading');
  a.equal(container && container.id, sec.id, 'the section takes it');
  a.equal(index, sec.children.length, 'after the row already in there');

  const row = sec.children[0];
  C.selSet([row.id]);
  const [c2, i2] = C.smartTarget('heading');
  a.equal(c2 && c2.id, row.id, 'and so does the row, for the same reason');
  a.equal(i2, row.children.length);
});

test('smartTarget appends to the end when nothing is selected', () => {
  blank();
  insert('heading', null, 0);
  C.selSet([]);
  const [container, index] = C.smartTarget('section');
  a.equal(container, null);
  a.equal(index, C.state.pages[0].tree.length, 'the end of the page');
});

test('nothing holds a section, so one always lands at the page root', () => {
  /* the level rule cuts the other way here: a section is level 1 and `holds` needs
     something strictly shallower, which no node is. Every ancestor is walked past and
     the root takes it — however deep the selection was. */
  blank();
  const h = insert('heading', null, 0);
  C.selSet([h.id]);
  const [container, index] = C.smartTarget('section');
  a.equal(container, null, 'not the column, not the row, not the section');
  a.equal(index, 1, 'after the section the selection was inside, not before it');
});

/* -------------------------------------------- a control value becoming state
   applyC/applyOne are the single point where editing a field mutates the document.
   They were in the UI half, so none of these rules had a test. */

test('applyOne writes a prop, a CSS declaration, or an Advanced field', () => {
  blank();
  const h = insert('heading', null, 0);
  C.applyOne(h, { k: 'text' }, 'Written');
  a.equal(h.props.text, 'Written');

  C.applyOne(h, { c: 'text-align' }, 'center');
  a.equal(h.css.d['text-align'], 'center', 'a control with `c` writes CSS, not a prop');
  a.equal('text-align' in h.props, false);

  C.applyOne(h, { k: '_cls' }, 'promo wide');
  C.applyOne(h, { k: '_css' }, '&{outline:1px solid red}');
  a.equal(h.adv.cls, 'promo wide');
  a.equal(h.adv.css, '&{outline:1px solid red}');
  a.equal('_cls' in h.props, false, 'the escape hatches land on adv, never on props');
});

test('the _id control strips anything an id attribute cannot carry', () => {
  blank();
  const h = insert('heading', null, 0);
  /* this value becomes an id in the exported HTML and the target of a #fragment link,
     so a space or a '#' — both of which a person types naturally when writing an
     anchor — has to come out rather than ship */
  const clean = (v: any) => { C.applyOne(h, { k: '_id' }, v); return h.adv.htmlId; };
  a.equal(clean('sign up now'), 'signupnow');
  a.equal(clean('#pricing'), 'pricing');
  a.equal(clean('Get-Started_2'), 'Get-Started_2', 'letters, digits, dash and underscore survive');
  a.equal(clean('a"b\'c<d>e&f'), 'abcdef', 'and nothing that could break out of the attribute');
  a.equal(clean(''), '');
  a.equal(clean(null), '', 'a cleared field is empty, not "null"');
});

test('applyOne on a targeted class writes the class, not the element', () => {
  blank();
  const h = insert('heading', null, 0);
  const other = insert('heading', holderOf(h.id), 1);
  const id = C.classAdd('Promo');
  C.classApply(h, id);
  C.classApply(other, id);
  C.state.ui.target = id;

  C.applyOne(h, { c: 'padding-top' }, '40px');
  a.equal(C.findClass(id)!.css.d['padding-top'], '40px', 'the class took it');
  a.equal('padding-top' in h.css.d, false, 'and the element itself was not touched');
  /* which is the point: every other user of the class moves with it */
  a.equal('padding-top' in other.css.d, false);
  C.state.ui.target = '';
});

test('applyC fans one edit out across a multi-selection', () => {
  blank();
  const one = insert('heading', null, 0);
  const two = insert('heading', holderOf(one.id), 1);
  const three = insert('heading', holderOf(one.id), 2);
  C.selSet([one.id, two.id, three.id]);
  C.applyC(one, { k: 'text' }, 'All three');
  a.deepEqual([one, two, three].map(n => n.props.text), ['All three', 'All three', 'All three']);

  C.applyC(one, { c: 'color' }, '#ff0000');
  a.deepEqual([one, two, three].map(n => n.css.d.color), ['#ff0000', '#ff0000', '#ff0000']);
});

test('applyC only fans out to elements that have the control', () => {
  blank();
  const h = insert('heading', null, 0);
  const img = insert('image', holderOf(h.id), 1);
  C.selSet([h.id, img.id]);
  /* `text` is not an image control, so the image must not grow a stray prop */
  C.applyC(h, { k: 'text' }, 'Only the heading');
  a.equal(h.props.text, 'Only the heading');
  a.equal('text' in img.props, false, 'an image has no text control, so it is skipped');

  /* CSS is shared by everything, so that does reach both */
  C.applyC(h, { c: 'margin-top' }, '12px');
  a.equal(h.css.d['margin-top'], '12px');
  a.equal(img.css.d['margin-top'], '12px');
});

test('a class target takes one write, not one per selected element', () => {
  blank();
  const one = insert('heading', null, 0);
  const two = insert('heading', holderOf(one.id), 1);
  const id = C.classAdd('Shared');
  C.classApply(one, id); C.classApply(two, id);
  C.state.ui.target = id;
  C.selSet([one.id, two.id]);

  /* both selected elements resolve to the same class object, so fanning out would
     write the identical value twice. The result is the same either way — this asserts
     the values land where they should and nowhere else. */
  C.applyC(one, { c: 'gap' }, '8px');
  a.equal(C.findClass(id)!.css.d.gap, '8px');
  a.equal('gap' in one.css.d, false);
  a.equal('gap' in two.css.d, false);
  C.state.ui.target = '';
});

test('applyC with a single selection writes only that element', () => {
  blank();
  const one = insert('heading', null, 0);
  const two = insert('heading', holderOf(one.id), 1);
  C.selSet([one.id]);
  C.applyC(one, { k: 'text' }, 'Just me');
  a.equal(one.props.text, 'Just me');
  a.notEqual(two.props.text, 'Just me');
});

test('applyC does not fan out from an element outside the selection', () => {
  blank();
  const one = insert('heading', null, 0);
  const two = insert('heading', holderOf(one.id), 1);
  const three = insert('heading', holderOf(one.id), 2);
  C.selSet([one.id, two.id]);
  /* the inspector draws the primary selection, so a call naming something else is not
     a fan-out — it is a targeted write, and treating it as a fan-out would edit two
     elements the user did not have selected */
  C.applyC(three, { k: 'text' }, 'Only three');
  a.equal(three.props.text, 'Only three');
  a.notEqual(one.props.text, 'Only three');
  a.notEqual(two.props.text, 'Only three');
});

test('applyOne respects the breakpoint for a responsive control', () => {
  blank();
  const h = insert('heading', null, 0);
  C.state.ui.dev = 'mobile';
  C.applyOne(h, { c: 'font-size', r: 1 }, '24px');
  a.equal(h.css.m['font-size'], '24px');
  a.equal('font-size' in h.css.d, false, 'the base is untouched');
  /* and a control that is not marked responsive edits the base wherever you stand */
  C.applyOne(h, { c: 'font-weight' }, '700');
  a.equal(h.css.d['font-weight'], '700');
  C.state.ui.dev = 'desktop';
});

/* ---------------------------------------------------- duplicating and deleting pages
   Both were written inline inside a click handler in builder.html, so neither had a
   test — including the `cur` clamp, which is the same off-by-one twice over. */

test('pageDup copies the tree and gives every node a fresh id', () => {
  fresh();
  const before = C.state.pages.length;
  C.state.cur = 0;
  const ids = new Set<string>();
  C.eachNode(C.state.pages[0].tree, n => ids.add(n.id));

  const copy = C.pageDup(0)!;
  a.equal(C.state.pages.length, before + 1);
  a.equal(C.state.pages[1].id, copy.id, 'the copy sits directly after its source');
  a.equal(C.state.cur, 1, 'and becomes the page you are looking at');

  /* two pages sharing node ids would make locate() return whichever it reached
     first, quietly breaking selection on both */
  const copied: string[] = [];
  C.eachNode(copy.tree, n => copied.push(n.id));
  a.ok(copied.length, 'the copy is not empty');
  a.equal(copied.some(id => ids.has(id)), false, 'no id is shared with the original');
  a.equal(new Set(copied).size, copied.length, 'and none is repeated inside the copy');
});

test('pageDup names and slugs the copy so neither collides', () => {
  fresh();
  const src = C.state.pages[0];
  const name = src.name, slug = src.slug;
  const copy = C.pageDup(0)!;
  a.equal(copy.name, name + ' copy');
  a.equal(copy.slug, C.slugify(slug + '-copy'));
  a.notEqual(copy.slug, slug, 'two pages exporting to the same file would overwrite each other');
});

test('pageDup clears the selection, which belonged to the page you left', () => {
  fresh();
  const h = C.flatten(C.state.pages[0].tree).find((n: any) => n.type === 'heading');
  C.selSet([h.id]);
  C.pageDup(0);
  a.deepEqual(C.selIds(), [], 'a selection pointing into the old page means nothing here');
});

test('pageDup refuses an index that is not a page', () => {
  fresh();
  const before = C.state.pages.length;
  a.equal(C.pageDup(99), null);
  a.equal(C.pageDup(-1), null);
  a.equal(C.state.pages.length, before, 'and adds nothing');
});

test('pageDelete keeps cur pointing at a real page, whichever page went', () => {
  fresh();
  while (C.state.pages.length < 4) C.pageDup(0);

  /* deleting the last page leaves cur past the end */
  C.state.cur = 3;
  a.equal(C.pageDelete(3), true);
  a.equal(C.state.cur, 2, 'clamped back onto the new last page');
  a.ok(C.state.pages[C.state.cur], 'and it is a real one');

  /* deleting before the current one shifts everything down */
  C.state.cur = 2;
  const wanted = C.state.pages[2];
  a.equal(C.pageDelete(0), true);
  a.equal(C.state.cur, 1);
  a.equal(C.state.pages[C.state.cur].id, wanted.id, 'still the same page, at its new index');
});

test('pageDelete refuses the last page', () => {
  fresh();
  while (C.state.pages.length > 1) C.pageDelete(C.state.pages.length - 1);
  a.equal(C.state.pages.length, 1);
  /* a project with no pages has nothing to show and no way back to one */
  a.equal(C.pageDelete(0), false);
  a.equal(C.state.pages.length, 1);
  a.equal(C.state.cur, 0);
});

test('pageDelete refuses an index that is not a page', () => {
  fresh();
  C.pageDup(0);
  const before = C.state.pages.length;
  a.equal(C.pageDelete(99), false);
  a.equal(C.state.pages.length, before);
});

/* --------------------------------------- inserting at the selection, not at an index
   patternInsert and blockInsert both test `parentNode === undefined` explicitly and
   mean "drop wherever the selection allows". The signatures declared the argument
   required, which made that branch unreachable as far as the types were concerned —
   and it was the branch the Add panel uses for every click. Untested until now. */

test('patternInsert with no parent drops at the selection', () => {
  blank();
  const h = insert('heading', null, 0);
  C.selSet([h.id]);
  const before = C.state.pages[0].tree.length;
  const made = C.patternInsert(C.PATTERNS[0].id);
  a.ok(made, 'it went somewhere');
  a.equal(C.state.pages[0].tree.length, before + 1, 'a section landed at the root');
  /* nothing holds a section, so it lands beside the one the selection was inside —
     the same rule smartTarget follows */
  a.equal(C.state.pages[0].tree[1].id, made!.id);
});

test('blockInsert with no parent drops at the selection', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = blockSave(h.id, 'Promo');
  const col = holderOf(h.id);
  C.selSet([col.id]);
  const before = col.children.length;
  const made = C.blockInsert(id);
  a.ok(made, 'placed');
  a.equal(col.children.length, before + 1, 'inside the selected column');
});

test('an explicit parent and index still win over the selection', () => {
  blank();
  const h = insert('heading', null, 0);
  const id = blockSave(h.id, 'Promo');
  const col = holderOf(h.id);
  C.selSet([col.id]);
  /* passing null means the page root, and it must not be read as "no parent" — those
     are different answers and conflating them is what the old signature invited */
  const made = C.blockInsert(id, null, 0);
  a.ok(made);
  a.equal(C.state.pages[0].tree.length, 2, 'a second section at the root, not inside the column');
});

test('a section-level drop from a leaf selection reaches the root', () => {
  /* The bug this covers: dropTree walked up through every ancestor and stopped, never
     trying the document root — which is the only thing that holds a section. So
     clicking a template with a heading selected did nothing and reported "That does
     not fit there", while the same click with a section selected worked. Reproduced
     in the shipped build before fixing it. */
  blank();
  const h = insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  C.selSet([h.id]);
  const made = C.dropTree(C.N('section', {}, {}, []), h.id);
  a.ok(made, 'a section dropped onto a heading has to land somewhere');
  const list = C.state.pages[0].tree;
  a.equal(list.length, 2);
  a.equal(list.indexOf(sec), 0);
  a.equal(list[1].type, 'section', 'after the section the heading was inside');
});

test('the root fallback does not fire when something nearer fits', () => {
  blank();
  const one = insert('heading', null, 0);
  const col = holderOf(one.id);
  const before = C.state.pages[0].tree.length;
  /* a heading fits inside the column, so it must go there rather than to the root */
  const made = C.dropTree(C.N('heading', { text: 'x' }, {}, []), one.id);
  a.ok(made);
  a.equal(C.state.pages[0].tree.length, before, 'no new section at the root');
  a.equal(col.children.length, 2, 'it went in beside its sibling');
});

/* ------------------------------------------------- adding a text style
   The project dialog's Add button carried its own copy of the id-uniquifying logic and
   pushed straight into `tokens.text` rather than through ensureTokens() — so on a
   project whose tokens had not been built it would have thrown. One function now, shared
   with tsCreateFrom. */

test('styleAdd derives a unique id from the name', () => {
  blank();
  const a1 = C.styleAdd('Caption');
  a.equal(a1, 'caption');
  const a2 = C.styleAdd('Caption');
  a.equal(a2, 'caption-2', 'a second one does not overwrite the first');
  a.equal(C.styleAdd('Caption'), 'caption-3');
  a.equal(C.styles().filter(t => t.name === 'Caption').length, 3);
});

test('styleAdd falls back to a usable id when the name has none', () => {
  blank();
  /* punctuation-only names slugify to nothing, and an empty id would collide with
     itself on the next add */
  a.equal(C.styleAdd('...'), 'style');
  a.equal(C.styleAdd('!!!'), 'style-2');
});

test('styleAdd gives the style values, not an empty object', () => {
  blank();
  const id = C.styleAdd('Caption');
  const t = must(C.findStyle(id), 'the new style');
  a.equal(t.css.d['font-size'], '16px');
  a.equal(t.css.d['font-weight'], '400');
  a.equal(t.css.d['line-height'], '1.5');
  a.deepEqual(t.css.t, {}, 'and no breakpoint overrides yet');
  a.deepEqual(t.css.m, {});
});

test('styleAdd works before the tokens exist', () => {
  blank();
  /* the old copy of this wrote state.meta.tokens.text directly, which throws when
     tokens is still null — the exact class of bug the typed core surfaced six of */
  C.state.meta.tokens = null;
  const id = C.styleAdd('Caption');
  a.equal(id, 'caption');
  a.ok(C.findStyle(id), 'and the tokens were built on the way');
});

test('styleAdd clamps a very long name', () => {
  blank();
  const t = must(C.findStyle(C.styleAdd('x'.repeat(80))), 'the new style');
  a.equal(t.name.length, 40);
});

test('tsCreateFrom shares the same id rule', () => {
  blank();
  const h = insert('heading', null, 0);
  h.css.d = { 'font-size': '30px' };
  C.styleAdd('Feature');
  const id = C.tsCreateFrom(h, 'Feature');
  a.equal(id, 'feature-2', 'it sees the style styleAdd made, and steps around it');
});

/* ---------------------------------------------------------------- JSON-LD
   Structured data, so a search engine can tell a project page from an article without
   inferring it from the markup. The tests read the graph object rather than the script
   tag, because asserting against a graph is worth more than asserting against a string. */

const withBase = () => { C.state.meta.baseUrl = 'https://example.com'; };

/** A collection with one item, so the Article tests do not depend on demo content that
    an earlier `blank()` may have cleared. */
const detailFixture = () => {
  const col = must(C.collectionAdd('Projects'), 'collection');
  const field = must(C.titleField(col), 'title field');
  const item = must(C.itemAdd(col.id), 'item');
  C.itemSet(col.id, item.id, field.id, 'Northwind app');
  return { col: must(C.findCollection(col.id), 'collection'), item };
};

test('no Site URL means no structured data at all', () => {
  fresh();
  C.state.meta.baseUrl = '';
  /* a relative `url` in JSON-LD is worse than none — a consumer resolves it against its
     own host — which is the rule the canonical tag and the sitemap already follow */
  a.equal(C.jsonLdGraph(C.page()), null);
  a.equal(C.jsonLd(C.page()), '');
});

test('a trailing slash on the Site URL does not double up', () => {
  fresh();
  C.state.meta.baseUrl = 'https://example.com///';
  const g = must(C.jsonLdGraph(C.page()), 'graph');
  const site = g['@graph'].find((x: any) => x['@type'] === 'WebSite') as any;
  a.equal(site.url, 'https://example.com/');
  a.equal(site['@id'], 'https://example.com/#site');
});

test('an ordinary page is a WebPage, tied to the site', () => {
  fresh(); withBase();
  const pg = C.page();
  pg.slug = 'about'; pg.title = 'About us'; pg.desc = 'Who we are.';
  const g = must(C.jsonLdGraph(pg), 'graph');
  a.equal(g['@context'], 'https://schema.org');

  const types = g['@graph'].map((x: any) => x['@type']);
  a.deepEqual(types, ['Organization', 'WebSite', 'WebPage'], 'three nodes, in that order');

  const page = g['@graph'][2] as any;
  a.equal(page.name, 'About us');
  a.equal(page.description, 'Who we are.');
  a.equal(page.url, 'https://example.com/about.html');
  a.deepEqual(page.isPartOf, { '@id': 'https://example.com/#site' }, 'by reference, not by copy');
  a.equal('publisher' in page, false, 'a page has no publisher — its article would');
});

test('the WebSite names the Organization as its publisher, by id', () => {
  fresh(); withBase();
  C.state.meta.name = 'Pagecraft Studio';
  const g = must(C.jsonLdGraph(C.page()), 'graph');
  const [org, site] = g['@graph'] as any[];
  a.equal(org['@type'], 'Organization');
  a.equal(org.name, 'Pagecraft Studio');
  a.equal(org.url, 'https://example.com/');
  a.deepEqual(site.publisher, { '@id': org['@id'] }, 'one Organization node, referenced');
});

test('Organization carries no logo, because nothing in the project is one', () => {
  fresh(); withBase();
  C.state.meta.favicon = 'asset:abc';
  C.state.meta.ogImage = 'share.png';
  const g = must(C.jsonLdGraph(C.page()), 'graph');
  const org = g['@graph'][0] as any;
  /* a favicon is not a logo and a share image is not a logo; emitting either would be a
     guess a consumer acts on */
  a.equal('logo' in org, false);
});

test('a detail page is an Article with a publisher', () => {
  fresh(); withBase();
  const { col, item } = detailFixture();
  const pg = C.page();
  pg.slug = col.slug + '/' + item.slug;
  pg.title = 'Northwind app';
  pg.desc = 'A rebrand.';
  const g = must(C.jsonLdGraph(pg, { col, item }), 'graph');

  const node = g['@graph'][2] as any;
  a.equal(node['@type'], 'Article');
  a.equal(node.headline, 'Northwind app', 'an Article has a headline, not a name');
  a.equal('name' in node, false);
  a.equal(node.url, `https://example.com/${col.slug}/${item.slug}.html`);
  a.equal(node['@id'], node.url + '#article', 'its own id, distinct from the page url');
  a.deepEqual(node.publisher, { '@id': 'https://example.com/#org' });
});

test('the page image is absolute, and a full URL is left alone', () => {
  fresh(); withBase();
  const pg = C.page();
  pg.ogImage = 'img/cover.png';
  a.equal((must(C.jsonLdGraph(pg), 'g')['@graph'][2] as any).image, 'https://example.com/img/cover.png');

  pg.ogImage = 'https://cdn.example.net/cover.png';
  a.equal((must(C.jsonLdGraph(pg), 'g')['@graph'][2] as any).image,
    'https://cdn.example.net/cover.png', 'already absolute');
});

test('the page image falls back to the project image, and is omitted when neither is set', () => {
  fresh(); withBase();
  const pg = C.page();
  pg.ogImage = '';
  C.state.meta.ogImage = 'default.png';
  a.equal((must(C.jsonLdGraph(pg), 'g')['@graph'][2] as any).image, 'https://example.com/default.png');

  C.state.meta.ogImage = '';
  const node = must(C.jsonLdGraph(pg), 'g')['@graph'][2] as any;
  a.equal('image' in node, false, 'an empty image key is worse than no key');
});

test('an empty description is omitted rather than sent as an empty string', () => {
  fresh(); withBase();
  const pg = C.page();
  pg.desc = '';
  a.equal('description' in (must(C.jsonLdGraph(pg), 'g')['@graph'][2] as any), false);
});

test('the script tag cannot be closed early by a value', () => {
  fresh(); withBase();
  const pg = C.page();
  /* the one injection route a JSON island has: a value containing the closing tag */
  pg.title = 'Sneaky </script><script>alert(1)</script>';
  const out = C.jsonLd(pg);
  a.equal(/<\/script>\s*<script>alert/.test(out), false, 'no second script element');
  a.equal(out.match(/<\/script>/g)!.length, 1, 'exactly one closing tag — the real one');
  a.match(out, /\\u003c\/script/, 'the value survives, escaped');
  /* and it is still valid JSON that parses back to the title */
  const json = out.replace(/^<script[^>]*>\n/, '').replace(/\n<\/script>\n$/, '');
  a.equal((JSON.parse(json)['@graph'][2] as any).name, pg.title);
});

test('buildPage embeds the graph, and og:type follows it', () => {
  fresh(); withBase();
  const html = C.buildPage(C.page());
  a.match(html, /<script type="application\/ld\+json">/);
  a.match(html, /"@type": "WebPage"/);
  a.match(html, /og:type" content="website"/);

  const { col, item } = detailFixture();
  const detail = C.buildPage(C.page(), { col, item });
  a.match(detail, /"@type": "Article"/);
  a.match(detail, /og:type" content="article"/, 'an article page says so to Open Graph too');
});

test('buildPage emits no JSON-LD block without a Site URL', () => {
  fresh();
  C.state.meta.baseUrl = '';
  const html = C.buildPage(C.page());
  a.equal(/ld\+json/.test(html), false);
  a.match(html, /og:type" content="website"/, 'Open Graph still goes out — it needs no domain');
});

test('every exported target produces a graph naming its own URL', () => {
  fresh(); withBase();
  /* the real shape of an export: ordinary pages plus one file per item */
  const targets = C.exportTargets();
  a.ok(targets.length > 1);
  targets.forEach((t: any) => {
    const g = must(C.jsonLdGraph(t.pg, { col: t.col, item: t.item }), 'graph for ' + t.path);
    const node = g['@graph'][2] as any;
    a.equal(node.url, 'https://example.com/' + t.path, t.path + ' names itself');
    a.equal(node['@type'], t.item ? 'Article' : 'WebPage');
  });
});
