/* Tests run against dist/core.cjs, which build.mjs extracts verbatim from the
   regions of builder.html marked as DOM-free — so this exercises shipped code,
   not a copy of it. */
'use strict';
const { test, beforeEach } = require('node:test');
const a = require('node:assert/strict');
const C = require('../dist/core.cjs');

const fresh = () => {
  C.seed();
  C.state.ui = { mode: 'page', dev: 'desktop', sel: null, multi: [], tab: 'add', stab: 'content', open: {}, collapsed: {} };
  C.state.cur = 0;
  C.hist.u.length = 0; C.hist.r.length = 0;
};
const blank = () => {
  fresh();
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  C.state.meta.tokens.classes = [];
  /* seed() leaves project-level libraries alone — blocks and collections are
     assets, not page content — so a test that wants a clean slate says so */
  C.state.meta.blocks = [];
  C.state.meta.collections = [];
};
const types = l => l.map(n => n.type);
/* the two media blocks, either of which may be absent when nothing overrides */
const blocks = css => {
  const t = css.indexOf(C.MQ.t), m = css.indexOf(C.MQ.m);
  return {
    base: css.slice(0, t < 0 ? (m < 0 ? undefined : m) : t),
    tablet: t < 0 ? '' : css.slice(t, m < 0 ? undefined : m),
    mobile: m < 0 ? '' : css.slice(m)
  };
};
const count = (list, type) => { let n = 0; C.eachNode(list, x => { if (x.type === type) n++; }); return n; };

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
  const leaf = C.insert('heading', null, 0);
  const t = C.state.pages[0].tree;
  a.equal(t.length, 1);
  a.equal(t[0].type, 'section');
  a.equal(t[0].children[0].type, 'row');
  a.equal(t[0].children[0].children[0].type, 'column');
  a.equal(t[0].children[0].children[0].children[0].id, leaf.id);
});

test('a row dropped in a column nests instead of wrapping', () => {
  blank();
  C.insert('heading', null, 0);
  const col = C.state.pages[0].tree[0].children[0].children[0];
  C.insert('row', col, 1);
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
    a.ok(C.LAYOUTS[k].length, k + ' has at least one layout');
    C.LAYOUTS[k].forEach(l => {
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
  C.insert('columns', null, 0);
  const sec = C.state.pages[0].tree[0];
  a.equal(sec.type, 'section');
  a.equal(sec.children[0].type, 'row', 'a Columns drop at the root gets a section wrapper');
  a.equal(sec.children[0].children.length, C.DEFAULT_COLS);
  a.equal(C.holds('column', 'columns'), true, 'and may nest inside a column');
  const col = sec.children[0].children[0];
  C.insert('columns', col, 0);
  a.equal(col.children[0].type, 'row');
});

/* ------------------------------------------------------- tree operations */
test('moveNode refuses to nest a node inside itself', () => {
  blank();
  C.insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  const col = sec.children[0].children[0];
  C.moveNode(sec.id, col, 0);
  a.equal(C.state.pages[0].tree.length, 1);
  a.equal(C.state.pages[0].tree[0].id, sec.id, 'the tree is untouched');
});

test('duplicate assigns fresh ids to every descendant', () => {
  blank();
  C.insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  const before = [];
  C.eachNode([sec], n => before.push(n.id));
  C.dupNode(sec.id);
  const copy = C.state.pages[0].tree[1];
  const after = [];
  C.eachNode([copy], n => after.push(n.id));
  a.equal(after.length, before.length);
  a.equal(after.some(id => before.includes(id)), false, 'no id is reused');
  a.equal(C.state.ui.sel, copy.id);
});

test('delete selects the parent so focus never disappears', () => {
  blank();
  const leaf = C.insert('heading', null, 0);
  const col = C.locate(leaf.id).parent;
  C.state.ui.sel = leaf.id;
  C.delNode(leaf.id);
  a.equal(C.state.ui.sel, col.id);
  a.equal(C.locate(leaf.id), null);
});

test('locate finds nodes at any depth and returns their position', () => {
  const deep = C.state.pages[0].tree[0].children[0].children[0].children[0];
  const hit = C.locate(deep.id);
  a.equal(hit.node.id, deep.id);
  a.equal(hit.i, 0);
  a.equal(hit.parent.type, 'column');
});

/* ------------------------------------------------------------- history */
test('undo and redo round-trip an edit', () => {
  blank();
  C.edit(() => C.insert('heading', null, 0));
  a.equal(C.state.pages[0].tree.length, 1);
  C.undo();
  a.equal(C.state.pages[0].tree.length, 0);
  C.redo();
  a.equal(C.state.pages[0].tree.length, 1);
});

test('a new edit clears the redo stack', () => {
  blank();
  C.edit(() => C.insert('heading', null, 0));
  C.undo();
  a.equal(C.hist.r.length, 1);
  C.edit(() => C.insert('button', null, 0));
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
  const h = C.insert('heading', null, 0);
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
  const h = C.insert('heading', null, 0);
  h.hide = { m: true };
  a.match(C.treeCss([C.state.pages[0].tree], false), /display:none !important/);
  const editing = C.treeCss([C.state.pages[0].tree], true);
  a.equal(/display:none !important/.test(editing), false);
  a.match(editing, /opacity:\.32/);
});

test('custom CSS substitutes & for the element selector', () => {
  blank();
  const h = C.insert('heading', null, 0);
  h.adv.css = '& { outline: 2px solid red } &:hover { opacity: .5 }';
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, new RegExp('\\.' + C.nodeClass(h) + ' \\{ outline: 2px solid red \\}'));
  a.match(css, new RegExp('\\.' + C.nodeClass(h) + ':hover'));
});

test('button hover colours become a :hover rule', () => {
  blank();
  const b = C.insert('button', null, 0);
  b.css.d['--hover-bg'] = '#ff0000';
  a.match(C.treeCss([C.state.pages[0].tree], false), new RegExp('\\.' + C.nodeClass(b) + ':hover\\{background-color:#ff0000'));
});

/* --------------------------------------------------------------- markup */
test('author text is escaped, never injected', () => {
  blank();
  const h = C.insert('heading', null, 0);
  h.props.text = '<script>alert(1)</script>';
  const html = C.renderNode(h, { edit: false });
  a.equal(html.includes('<script>'), false);
  a.match(html, /&lt;script&gt;/);
});

test('element tags come from a whitelist', () => {
  blank();
  const h = C.insert('heading', null, 0);
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
  const b = C.insert('button', null, 0);
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

test('a captioned image becomes a figure, a plain one stays an img', () => {
  blank();
  const img = C.insert('image', null, 0);
  img.props.src = 'https://x.com/a.png';
  a.match(C.renderNode(img, { edit: false }), /^<img /);
  img.props.caption = 'A caption';
  const fig = C.renderNode(img, { edit: false });
  a.match(fig, /^<figure /);
  a.match(fig, /<figcaption class="pagecraft-caption">A caption<\/figcaption>/);
});

test('lazy loading is an export-only attribute', () => {
  blank();
  const img = C.insert('image', null, 0);
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
  C.insert('nav', null, 0);
  const html = C.buildPage(C.state.pages[0]);
  a.equal((html.match(/<script/g) || []).length, 1, 'exactly one copy');
  a.match(html, /aria-expanded="false"/);
  a.match(html, /aria-controls="/);
});

test('a nav collapses at the breakpoint the author chose', () => {
  blank();
  const nav = C.insert('nav', null, 0);
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
  const img = C.insert('image', null, 0);
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
  const hex = id => C.findColor(id).value;
  a.equal(hex('text'), '#111311', 'Ink');
  a.equal(hex('bg'), '#f8f6ef', 'Paper');
  a.equal(hex('brand'), '#b7f34a', 'Craft Green');
  a.equal(hex('slate'), '#6f7771', 'brand Slate');
  a.equal(hex('surface'), '#ffffff', 'White');
  /* display type follows .pc-display from the brand token file */
  const d = C.findStyle('display').css.d;
  a.equal(d['font-weight'], '600');
  a.equal(d['letter-spacing'], '-.04em');
  a.equal(d['line-height'], '.96');
  /* labels are set in the supporting face */
  a.match(C.findStyle('eyebrow').css.d['font-family'], /DM Sans/);
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
  C.state.meta.tokens.text = [];
  a.deepEqual(C.usedFamilies(), ['Inter']);
  const h = C.insert('heading', null, 0);
  h.props.ts = '';
  h.css.d['font-family'] = C.stackFor('Playfair Display', 'f');
  a.deepEqual(C.usedFamilies(), ['Inter', 'Playfair Display'].sort((x, y) =>
    C.GF.findIndex(g => g[0] === x) - C.GF.findIndex(g => g[0] === y)));
  a.match(C.gfontsHref(), /family=Playfair\+Display:wght@/, 'spaces become plus signs');
});

test('a family reached only through a class or text style still loads', () => {
  blank();
  C.state.meta.font = ''; C.state.meta.headFont = '';
  C.state.meta.tokens.text = [{ id: 'x', name: 'X', css: { d: { 'font-family': C.stackFor('Lora', 'f') }, t: {}, m: {} } }];
  a.deepEqual(C.usedFamilies(), ['Lora'], 'via a text style');
  C.state.meta.tokens.text = [];
  C.classAdd('Mono', { d: { 'font-family': C.stackFor('JetBrains Mono', 'm') } });
  a.deepEqual(C.usedFamilies(), ['JetBrains Mono'], 'via a class');
});

test('a system stack or custom family requests nothing', () => {
  blank();
  C.state.meta.tokens.text = [];
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
  const h = C.insert('heading', null, 0);
  h.css.d.color = C.cvar('brand');
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, new RegExp('--c-brand:' + C.findColor('brand').value));
  a.match(css, new RegExp('\\.' + C.nodeClass(h) + '\\{[^}]*color:var\\(--c-brand\\)'));
});

test('changing one token restyles every element linked to it', () => {
  blank();
  const one = C.insert('heading', null, 0);
  const two = C.insert('button', null, 1);
  one.css.d.color = C.cvar('brand');
  two.css.d['background-color'] = C.cvar('brand');
  C.findColor('brand').value = '#ff0055';
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, /--c-brand:#ff0055/);
  a.match(css, new RegExp('\\.' + C.nodeClass(one) + '\\{[^}]*color:var\\(--c-brand\\)'));
  a.match(css, new RegExp('\\.' + C.nodeClass(two) + '\\{[^}]*background-color:var\\(--c-brand\\)'));
  a.equal(/#ff0055/.test(css.replace('--c-brand:#ff0055', '')), false, 'the literal is defined once, not copied');
});

test('text styles emit one rule per breakpoint, before element rules', () => {
  blank();
  const h = C.insert('heading', null, 0);
  C.tsApply(h, 'display');
  const css = C.treeCss([C.state.pages[0].tree], false);
  const { base, tablet, mobile } = blocks(css);
  const size = b => C.findStyle('display').css[b]['font-size'];
  a.match(base, new RegExp('\\.ts-display\\{[^}]*font-size:' + size('d')));
  a.match(tablet, new RegExp('\\.ts-display\\{[^}]*font-size:' + size('t')));
  a.match(mobile, new RegExp('\\.ts-display\\{[^}]*font-size:' + size('m')));
  a.ok(base.indexOf('.ts-display') < base.indexOf('.' + C.nodeClass(h)),
    'style rules precede element rules so per-element tweaks win');
});

test('an element carrying a text style renders its class', () => {
  blank();
  const h = C.insert('heading', null, 0);
  C.tsApply(h, 'title');
  a.match(C.renderNode(h, { edit: false }), new RegExp('class="pagecraft-heading ' + C.nodeClass(h) + ' ts-title"'));
  h.props.ts = 'does-not-exist';
  a.equal(/ts-does-not-exist/.test(C.renderNode(h, { edit: false })), false, 'a dangling reference is ignored');
});

test('applying a style clears the typography that would mask it', () => {
  blank();
  const h = C.insert('heading', null, 0);
  h.css.d['font-size'] = '99px';
  h.css.d['margin-bottom'] = '10px';
  C.tsApply(h, 'body');
  a.equal(h.css.d['font-size'], undefined, 'typography steps aside');
  a.equal(h.css.d['margin-bottom'], '10px', 'non-typographic styling is untouched');
  a.equal(h.props.ts, 'body');
});

test('detaching a style bakes its values in so nothing moves', () => {
  blank();
  const h = C.insert('heading', null, 0);
  const want = { d: C.findStyle('display').css.d['font-size'], t: C.findStyle('display').css.t['font-size'], m: C.findStyle('display').css.m['font-size'] };
  C.tsApply(h, 'display');
  C.tsUnlink(h);
  a.equal(h.props.ts, '');
  a.equal(h.css.d['font-size'], want.d);
  a.equal(h.css.t['font-size'], want.t);
  a.equal(h.css.m['font-size'], want.m);
});

test('detaching keeps a local override in preference to the style value', () => {
  blank();
  const h = C.insert('heading', null, 0);
  const weight = C.findStyle('display').css.d['font-weight'];
  C.tsApply(h, 'display');
  h.css.d['font-size'] = '70px';
  C.tsUnlink(h);
  a.equal(h.css.d['font-size'], '70px');
  a.equal(h.css.d['font-weight'], weight, 'the rest comes from the style');
});

test('updating a style from one element moves every user of it', () => {
  blank();
  const one = C.insert('heading', null, 0);
  const two = C.insert('heading', null, 1);
  C.tsApply(one, 'title');
  C.tsApply(two, 'title');
  a.equal(C.tsUsage('title'), 2);
  one.css.d['letter-spacing'] = '-.06em';
  C.tsUpdateFrom(one);
  a.equal(C.findStyle('title').css.d['letter-spacing'], '-.06em');
  a.equal(one.css.d['letter-spacing'], undefined, 'the element stops carrying it locally');
  const css = C.treeCss([C.state.pages[0].tree], false);
  a.match(css, /\.ts-title\{[^}]*letter-spacing:-\.06em/);
  a.equal((css.match(/letter-spacing:-\.06em/g) || []).length, 1, 'defined once, applied to both');
});

test('saving a new style from an element captures all three breakpoints', () => {
  blank();
  const h = C.insert('heading', null, 0);
  h.props.ts = '';
  h.css.d['font-size'] = '28px';
  h.css.m['font-size'] = '18px';
  const id = C.tsCreateFrom(h, 'Card heading');
  a.equal(id, 'card-heading');
  a.equal(h.props.ts, id);
  a.equal(C.findStyle(id).css.d['font-size'], '28px');
  a.equal(C.findStyle(id).css.m['font-size'], '18px');
  a.equal(h.css.d['font-size'], undefined);
});

test('style ids stay unique when names collide', () => {
  blank();
  const h = C.insert('heading', null, 0);
  a.equal(C.tsCreateFrom(h, 'Display'), 'display-2', 'display is taken by the default set');
});

test('deleting a style leaves its users looking identical', () => {
  blank();
  const h = C.insert('heading', null, 0);
  const size = C.findStyle('display').css.d['font-size'];
  C.tsApply(h, 'display');
  C.styleDelete('display');
  a.equal(C.findStyle('display'), null);
  a.equal(h.props.ts, '');
  a.equal(h.css.d['font-size'], size, 'the look was baked in on the way out');
});

test('deleting a colour inlines its literal everywhere', () => {
  blank();
  const h = C.insert('heading', null, 0);
  const id = C.colorAdd('Highlight', '#00ddaa');
  h.css.d.color = C.cvar(id);
  C.findStyle('body').css.d.color = C.cvar(id);
  a.equal(C.colorUsage(id), 2, 'counted in both elements and text styles');
  a.equal(C.colorDelete(id), true);
  a.equal(C.findColor(id), null);
  a.equal(h.css.d.color, '#00ddaa');
  a.equal(C.findStyle('body').css.d.color, '#00ddaa');
});

test('the three reserved colours cannot be deleted', () => {
  C.RESERVED.forEach(id => {
    a.equal(C.colorDelete(id), false, id + ' must survive');
    a.ok(C.findColor(id), id + ' still present');
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
  a.equal(C.resolveColor(C.cvar('brand')), C.findColor('brand').value);
  a.equal(C.resolveColor('#123456'), '#123456');
  a.equal(C.resolveColor(C.cvar('nope')), '');
});

test('migration v2 to v3 folds loose meta colours into tokens', () => {
  const d = C.migrate({ v: 2, meta: { color: '#111111', bg: '#fefefe', accent: '#00ff00' }, pages: [{ tree: [] }] });
  a.equal(d.v, C.SCHEMA);
  a.equal(d.meta.tokens.colors.find(c => c.id === 'text').value, '#111111');
  a.equal(d.meta.tokens.colors.find(c => c.id === 'bg').value, '#fefefe');
  a.equal(d.meta.tokens.colors.find(c => c.id === 'brand').value, '#00ff00');
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
  const styled = [];
  [C.state.header, C.state.footer, ...C.state.pages.map(p => p.tree)]
    .forEach(l => C.eachNode(l, n => { if (C.TS_TYPES.includes(n.type) && n.props.ts) styled.push(n.props.ts); }));
  a.ok(styled.length > 10, 'text elements use text styles');
  styled.forEach(id => a.ok(C.findStyle(id), 'style ' + id + ' exists'));
});

test('a token rebrand changes the export in one place', () => {
  const was = C.findColor('brand').value;
  const before = C.buildPage(C.state.pages[0]);
  a.match(before, new RegExp('--c-brand:' + was));
  C.findColor('brand').value = '#e11d48';
  const after = C.buildPage(C.state.pages[0]);
  a.match(after, /--c-brand:#e11d48/);
  a.equal(before.split(was).join('#e11d48'), after, 'nothing else in the document changed');
});

test('every internal link in the demo resolves — including from global regions', () => {
  /* A global header or footer is inlined into every page, so a bare "#anchor"
     in one only works on the page that happens to own that anchor. */
  const idsBySlug = {};
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
const codes = f => f.map(x => x.code);
const find = (f, code) => f.filter(x => x.code === code);

test('the demo project reviews clean apart from its placeholder image', () => {
  const f = C.lint();
  a.equal(C.lintCounts(f).error, 0, 'no errors: ' + JSON.stringify(codes(f)));
  a.deepEqual([...new Set(codes(f))].sort(), ['no-dimensions', 'no-image'],
    'the only findings are the image the user is meant to replace');
});

test('a dead internal link is an error, a live one is silent', () => {
  blank();
  const b = C.insert('button', null, 0);
  b.props.link = 'nope.html';
  a.equal(find(C.lint(), 'dead-link').length, 1);
  b.props.link = 'pricing.html';
  a.equal(find(C.lint(), 'dead-link').length, 0);
});

test('a fragment link is checked against the page that owns it', () => {
  blank();
  const b = C.insert('button', null, 0);
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
  const img = C.insert('image', null, 0);
  img.props.src = 'a.png'; img.props.alt = ''; img.props.w = '10'; img.props.h = '10';
  a.equal(find(C.lint(), 'no-alt').length, 1);
  img.props.decorative = 1;
  a.equal(find(C.lint(), 'no-alt').length, 0, 'decorative is a deliberate empty alt');
  a.match(C.renderNode(img, { edit: false }), /alt=""/);
});

test('images without intrinsic size are flagged for layout shift', () => {
  blank();
  const img = C.insert('image', null, 0);
  img.props.src = 'a.png'; img.props.alt = 'A';
  a.equal(find(C.lint(), 'no-dimensions').length, 1);
  img.props.w = '800'; img.props.h = '600';
  a.equal(find(C.lint(), 'no-dimensions').length, 0);
  a.match(C.renderNode(img, { edit: false }), /width="800" height="600"/);
});

test('heading order and h1 count are checked per page', () => {
  blank();
  const mk = lvl => { const h = C.insert('heading', null, 0); h.props.level = lvl; return h; };
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
  const one = C.insert('heading', null, 0), two = C.insert('heading', null, 1);
  C.locate(one.id).parent.adv.htmlId = 'dup';
  C.locate(two.id).parent.adv.htmlId = 'dup';
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
  a.ok(C.contrast('#6f7771', '#f8f6ef') < 4.5, 'brand Slate fails AA for body copy on Paper');
  a.ok(C.contrast('#6f7771', '#f8f6ef') > 3, 'but clears the large-text bar');
  blank();
  const h = C.insert('heading', null, 0);
  h.props.ts = ''; h.css.d.color = '#6f7771';
  h.css.d['font-size'] = '14px';
  a.equal(find(C.lint(), 'contrast').length, 1, 'small text is held to 4.5:1');
  h.css.d['font-size'] = '40px';
  a.equal(find(C.lint(), 'contrast').length, 0, 'large text is held to 3:1');
});

test('the default palette gives secondary text an accessible home', () => {
  const v = id => C.findColor(id).value;
  a.ok(C.contrast(v('muted'), v('bg')) >= 4.5, 'Slate (on Paper) clears AA on Paper');
  a.ok(C.contrast(v('muted-i'), v('ink')) >= 4.5, 'Slate (on Ink) clears AA on Ink');
  a.equal(v('slate'), '#6f7771', 'the brand Slate is still available for fills and large text');
});

/* --------------------------------------------------- deferred media + SEO */
test('an embedded player is deferred behind a facade by default', () => {
  blank();
  const v = C.insert('video', null, 0);
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
  const v = C.insert('video', null, 0);
  v.props.autoplay = 1;
  a.equal(C.canFacade(v.props), false);
  a.match(C.buildPage(C.state.pages[0]), /<iframe/);
});

test('a self-hosted file is never facaded', () => {
  blank();
  const v = C.insert('video', null, 0);
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
  const a1 = C.insert('heading', null, 0), a2 = C.insert('heading', null, 1);
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
  const h = C.insert('heading', null, 0);
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
  const h = C.insert('heading', null, 0);
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
  const h = C.insert('heading', null, 0);
  h.css.d['border-radius'] = '12px';
  h.css.m['border-radius'] = '6px';
  const id = C.classFrom(h, 'Rounded');
  a.equal(C.findClass(id).css.d['border-radius'], '12px');
  a.equal(C.findClass(id).css.m['border-radius'], '6px', 'breakpoints come along');
  a.deepEqual(h.css, { d: {}, t: {}, m: {} }, 'the element no longer carries it');
  a.ok((h.cls || []).includes(id));
  /* and the rendered result is unchanged */
  a.match(C.treeCss([C.state.pages[0].tree], false), /\.c-rounded\{[^}]*border-radius:12px/);
});

test('deleting a class bakes it into its users so nothing moves', () => {
  blank();
  const h = C.insert('heading', null, 0);
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
  const a1 = C.insert('heading', null, 0), a2 = C.insert('heading', null, 1);
  const id = C.classAdd('Shared', { d: { color: '#333333' } });
  C.classApply(a1, id); C.classApply(a2, id);
  C.classRemove(a1, id);
  a.equal(C.classUsage(id), 1);
  a.ok(C.findClass(id), 'the class itself survives');
  a.equal(/c-shared/.test(C.renderNode(a1, { edit: false })), false);
  a.match(C.renderNode(a2, { edit: false }), /c-shared/);
});

test('class ids stay unique and a dangling reference is ignored', () => {
  blank();
  a.equal(C.classAdd('Card'), 'card');
  a.equal(C.classAdd('Card'), 'card-2');
  const h = C.insert('heading', null, 0);
  h.cls = ['card', 'ghost'];
  a.deepEqual(C.nodeClasses(h).map(c => c.id), ['card'], 'the unknown id is dropped');
  a.equal(/c-ghost/.test(C.renderNode(h, { edit: false })), false);
});

test('a class can carry breakpoint overrides of its own', () => {
  blank();
  const h = C.insert('heading', null, 0);
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
  a.equal(old.meta.tokens.colors.find(c => c.id === 'brand').value, '#00ff00');
});

test('v4 → v5 backfills the HTML tag onto the stock text styles', () => {
  const d = C.migrate({
    v: 4,
    meta: { tokens: { colors: [], classes: [], text: [{ id: 'display', name: 'D', css: { d: {}, t: {}, m: {} } }, { id: 'mine', name: 'Mine', css: { d: {}, t: {}, m: {} } }] } },
    pages: [{ tree: [] }]
  });
  a.equal(d.meta.tokens.text.find(t => t.id === 'display').tag, 'h1');
  a.equal(d.meta.tokens.text.find(t => t.id === 'mine').tag, undefined, 'a custom style is left alone');
});

test('applying a text style also takes the tag that belongs with it', () => {
  blank();
  const h = C.insert('heading', null, 0);
  h.props.level = 'h4';
  C.tsApply(h, 'display');
  a.equal(h.props.level, 'h1', 'one choice, not two');
  C.tsApply(h, 'subtitle');
  a.equal(h.props.level, 'h3');
  /* a style with no tag leaves the tag alone */
  C.findStyle('subtitle').tag = '';
  h.props.level = 'h5';
  C.tsApply(h, 'subtitle');
  a.equal(h.props.level, 'h5');
  /* and it only applies to headings */
  const t = C.insert('text', null, 1);
  t.props.level = undefined;
  C.tsApply(t, 'display');
  a.equal(t.props.level, undefined);
});

test('pages can be reordered, and the current page follows', () => {
  fresh();
  const names = () => C.state.pages.map(p => p.name);
  a.deepEqual(names(), ['Home', 'Pricing']);
  C.state.cur = 0;
  a.equal(C.pageMove(0, 1), true);
  a.deepEqual(names(), ['Pricing', 'Home']);
  a.equal(C.page().name, 'Home', 'the page you were editing is still the current one');
  a.equal(C.pageMove(1, 1), false, 'already last');
  a.equal(C.pageMove(0, -1), false, 'already first');
});

test('page order drives the sitemap order', () => {
  fresh();
  C.state.meta.baseUrl = 'https://x.dev';
  const before = C.sitemapXml().match(/<loc>[^<]+<\/loc>/g);
  C.pageMove(0, 1);
  const after = C.sitemapXml().match(/<loc>[^<]+<\/loc>/g);
  a.deepEqual(after, [before[1], before[0]]);
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
  const h = C.insert('heading', null, 0);
  h.props.text = 'Original';
  C.copyNode(h.id);
  const made = C.pasteNode(h.id);
  a.ok(made);
  a.equal(made.props.text, 'Original');
  a.notEqual(made.id, h.id, 'the copy gets its own id');
  const col = C.locate(h.id).parent;
  a.deepEqual(col.children.map(c => c.type), ['heading', 'heading']);
  a.equal(col.children[1].id, made.id, 'it lands directly after the original');
});

test('pasting a subtree reissues every descendant id', () => {
  blank();
  C.insert('heading', null, 0);
  const sec = C.state.pages[0].tree[0];
  const before = [];
  C.eachNode([sec], n => before.push(n.id));
  C.copyNode(sec.id);
  const made = C.pasteNode(sec.id);
  const after = [];
  C.eachNode([made], n => after.push(n.id));
  a.equal(after.length, before.length);
  a.equal(after.some(id => before.includes(id)), false);
});

test('the clipboard survives a page change, so copies cross pages', () => {
  fresh();
  const h = C.insert('heading', null, 0);
  h.props.text = 'Travelling';
  C.copyNode(h.id);
  C.state.cur = 1;                                  // a different page
  const target = C.state.pages[1].tree[0];
  const landed = C.pasteNode(target.id);
  a.ok(landed, 'it fits inside a section on the other page');
  a.equal(landed.props.text, 'Travelling');
  a.ok(C.locate(landed.id), 'and it is now part of page two');
});

test('paste builds the wrappers a drag would, rather than refusing', () => {
  blank();
  const h = C.insert('heading', null, 0);          // section > row > column > heading
  C.copyNode(h.id);
  const row = C.locate(C.locate(h.id).parent.id).parent;
  const made = C.pasteNode(row.id);                // a row holds columns, not headings
  a.ok(made, 'it still lands somewhere sensible');
  a.equal(C.locate(made.id).parent.type, 'column', 'a column was created for it');

  /* and at the root it grows the full section > row > column chain */
  blank();
  const leaf = C.insert('heading', null, 0);
  C.copyNode(leaf.id);
  C.state.pages[0].tree = [];
  const atRoot = C.pasteNode(null);
  a.ok(atRoot);
  const chain = [];
  let cur = C.locate(atRoot.id);
  while (cur) { chain.unshift(cur.node.type); cur = cur.parent ? C.locate(cur.parent.id) : null; }
  a.deepEqual(chain, ['section', 'row', 'column', 'heading']);
});

test('a copied class reference keeps following the class', () => {
  blank();
  const h = C.insert('heading', null, 0);
  const id = C.classAdd('Shared', { d: { color: '#333333' } });
  C.classApply(h, id);
  C.copyNode(h.id);
  const made = C.pasteNode(h.id);
  a.deepEqual(made.cls, [id], 'the copy shares the class, not a snapshot of it');
  a.equal(C.classUsage(id), 2);
  C.findClass(id).css.d.color = '#444444';
  a.match(C.treeCss([C.state.pages[0].tree], false), /\.c-shared\{[^}]*color:#444444/);
});

test('arrow traversal walks the tree in reading order', () => {
  blank();
  C.insert('heading', null, 0);
  const flat = C.flatten(C.state.pages[0].tree).map(n => n.type);
  a.deepEqual(flat, ['section', 'row', 'column', 'heading']);
  const first = flat[0];
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
  C.insert('heading', null, 0);
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
  const trip = h => C.buildLink(C.parseLink(h, 'index'));
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
  const btn = C.insert('button', null, 0);
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
  const fm = C.insert('form', null, 0);
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
  const fm = C.insert('form', null, 0);
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
  const fm = C.insert('form', null, 0);
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
  const fm = C.insert('form', null, 0);
  fm.props.action = 'https://x.dev/f';
  fm.props.fields = [{ type: 'text', label: '', name: 'a' }, { type: 'text', label: 'Two', name: 'a' }];
  const f = C.lint();
  a.equal(find(f, 'field-no-label').length, 1);
  a.equal(find(f, 'field-dup-name').length, 1);
  a.match(find(f, 'field-dup-name')[0].msg, /overwrite/);
});

test('a field with no name falls back to its label', () => {
  blank();
  const fm = C.insert('form', null, 0);
  fm.props.action = 'https://x.dev/f';
  fm.props.fields = [{ type: 'text', label: 'Company name', name: '' }];
  a.match(C.renderNode(fm, { edit: false }), /name="company-name"/);
  a.equal(find(C.lint(), 'field-dup-name').length, 0);
});

test('a javascript: action is refused like any other link', () => {
  blank();
  const fm = C.insert('form', null, 0);
  fm.props.action = 'javascript:alert(1)';
  const html = C.renderNode(fm, { edit: false });
  a.equal(/javascript:/i.test(html), false);
  a.equal(/action=/.test(html), false, 'it degrades to a form that submits nowhere');
});

test('the form takes its colours from tokens so a rebrand reaches it', () => {
  blank();
  const fm = C.insert('form', null, 0);
  const css = C.treeCss([C.state.pages[0].tree], false);
  const rule = css.slice(css.indexOf('.' + C.nodeClass(fm) + '{'));
  const decls = rule.slice(0, rule.indexOf('}'));
  a.ok(decls.includes('--f-btn-bg:var(--c-brand)'), 'button colour is a token reference');
  a.ok(decls.includes('--f-bg:var(--c-surface)'), 'field background is a token reference');
  a.ok(C.contrast(fm.css.d['--f-btn-fg'], fm.css.d['--f-btn-bg']) > 4.5, 'and its button is readable');
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
  const fm = C.insert('form', null, 0);
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
  const id = C.blockSave(craft.id, 'Feature trio');
  a.equal(id, 'feature-trio');
  a.equal(C.blocks().length, 1);

  C.state.cur = 1;                                    // a different page
  const before = C.classUsage('card');
  const made = C.blockInsert(id, null, 0);
  a.ok(made);
  a.equal(made.type, 'section');
  a.equal(C.classUsage('card'), before + 3, 'the copy shares the class, not a snapshot');
  let clash = false;
  C.eachNode([made], n => { if (originalIds.has(n.id)) clash = true; });
  a.equal(clash, false, 'every id in the copy is new');
});

test('a block finds a legal home when dropped somewhere it cannot sit', () => {
  blank();
  const h = C.insert('heading', null, 0);
  const id = C.blockSave(h.id, 'Just a heading');
  const row = C.locate(C.locate(h.id).parent.id).parent;
  const made = C.blockInsert(id, row, 0);            // a row holds columns
  a.ok(made);
  a.equal(C.locate(made.id).parent.type, 'column', 'a column was created for it');
});

test('forgetting a block leaves the copies already placed alone', () => {
  fresh();
  const id = C.blockSave(C.state.pages[0].tree[1].id, 'Trio');
  const made = C.blockInsert(id, null, 0);
  C.blockDelete(id);
  a.equal(C.findBlock(id), null);
  a.ok(C.locate(made.id), 'the copy on the page survives');
});

test('every template builds real structure from the project tokens', () => {
  fresh();
  C.TEMPLATES.forEach(t => {
    const pg = C.pageFromTemplate(t.id, t.name);
    let n = 0;
    C.eachNode(pg.tree, () => n++);
    if (t.id === 'blank') { a.equal(n, 0); return; }
    a.ok(n > 5, t.id + ' has structure');
    /* it must be valid: sections at the root, rows in sections, and so on */
    pg.tree.forEach(node => a.equal(node.type, 'section', t.id + ' puts sections at the root'));
    C.state.pages.push(pg);
    const html = C.buildPage(pg);
    a.match(html, /^<!doctype html>/);
    a.ok(html.includes('var(--c-'), t.id + ' references colour tokens');
    C.state.pages.pop();
  });
});

test('a template page gets a unique slug', () => {
  fresh();
  const a1 = C.pageFromTemplate('contact', 'Contact');
  C.state.pages.push(a1);
  const a2 = C.pageFromTemplate('contact', 'Contact');
  a.equal(a1.slug, 'contact');
  a.equal(a2.slug, 'contact-2');
});

test('the contact template ships a form that the review then asks you to wire up', () => {
  fresh();
  const pg = C.pageFromTemplate('contact', 'Contact');
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
  const h = C.insert('heading', null, 0);
  a.match(C.autoId(h), /^pagecraft-heading-[a-z0-9]+$/);
  a.equal(C.autoId(h), C.autoId(h), 'stable across calls');
  a.equal(C.domIdOf(h), C.autoId(h));
  a.match(C.renderNode(h, { edit: false }), new RegExp('id="' + C.autoId(h) + '"'));
});

test('an Advanced anchor overrides the auto id verbatim', () => {
  blank();
  const h = C.insert('heading', null, 0);
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
  const h = C.insert('heading', null, 0);
  a.match(C.renderNode(h, { edit: true }), new RegExp('id="' + h.id + '"'));
  a.match(C.renderNode(h, { edit: false }), new RegExp('id="' + C.autoId(h) + '"'));
});

test('an auto id can be used as a link target', () => {
  fresh();
  const btn = C.insert('button', null, 0);
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
  const h1 = C.insert('heading', null, 0);
  const col = C.locate(h1.id).parent;
  const h2 = C.insert('heading', col, 1);
  const h3 = C.insert('heading', col, 2);
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
  const h = C.insert('heading', null, 0);
  const col = C.locate(h.id).parent, sec = C.state.pages[0].tree[0];
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
  const h = C.insert('heading', null, 0);
  const col = C.locate(h.id).parent, sec = C.state.pages[0].tree[0];
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
  const h = C.insert('heading', null, 0);
  const col = C.locate(h.id).parent;
  const b = C.insert('button', col, 1);
  const ids = [h.id, b.id];
  C.selSet(ids);

  const css = C.fanTargets({ t: 'unit', c: 'padding' }, ids);
  a.deepEqual(css.map(n => n.type), ['heading', 'button'], 'a CSS property is universal');

  const shared = C.fanTargets({ t: 'text', k: 'text' }, ids);
  a.deepEqual(shared.map(n => n.type), ['heading', 'button'], 'both declare a text field');

  const only = C.fanTargets({ t: 'select', k: 'level' }, ids);
  a.deepEqual(only.map(n => n.type), ['heading'], 'a button has no heading level to set');

  const id = C.fanTargets({ t: 'text', k: '_id' }, ids);
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
const asPage = tid => {
  fresh();
  C.state.pages.push(C.pageFromTemplate(tid, 'T'));
  C.state.cur = C.state.pages.length - 1;
  return C.state.pages[C.state.cur];
};
const outline = tree => {
  const out = [];
  C.eachNode(tree, n => { if (n.type === 'heading' && /^h[1-6]$/.test(n.props.level)) out.push(+n.props.level[1]); });
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
  for (const p of C.PATTERNS) {
    fresh();
    const made = C.patternInsert(p.id, null, C.state.pages[0].tree.length);
    a.ok(made, `“${p.name}” built nothing`);
    const mine = C.lint().filter(f => !THEIRS.includes(f.code) && f.code !== 'many-h1');
    a.deepEqual(mine.map(f => f.code), [], `“${p.name}” reports ${mine.map(f => f.code).join(', ')}`);
  }
});

test('a heading takes its outline level from its text style', () => {
  blank();
  const sec = C.PATTERNS.find(p => p.id === 'hero-split').build();
  C.state.pages[0].tree.push(sec);
  a.deepEqual(outline([sec]), [1], 'a display headline is the H1');
  a.match(C.renderNode(C.locate(C.state.pages[0].tree[0].id).node, { edit: false }), /<section/);
});

test('a sourced image with the untouched default is reported', () => {
  /* The default used to be the literal string 'Descriptive alt text', which
     passed the alt check — so a hand-placed image exported meaningless alt text
     and the review stayed silent. The guidance lives in the field placeholder
     instead, where it cannot become content. */
  blank();
  const img = C.insert('image', null, 0);
  a.equal(img.props.alt, '', 'nothing is pre-filled that could pass for a description');
  const ctl = C.DEF.image.controls.content.find(c => c.k === 'alt');
  a.ok(ctl.ph, 'the prompt is still there, as the placeholder');
  img.props.src = 'p.jpg';
  a.equal(find(C.lint(), 'no-alt').length, 1, 'a real image with no description is an error');
  img.props.decorative = 1;
  a.equal(find(C.lint(), 'no-alt').length, 0, 'unless it is marked decorative');
});

test('an image placeholder is not reported as an undescribed image', () => {
  blank();
  const img = C.insert('image', null, 0);
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
  const raw = [];
  const scan = (label, tree) => C.eachNode(tree, n => {
    for (const b of ['d', 't', 'm'])
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
  const loose = [];
  const scan = (label, tree) => C.eachNode(tree, n => {
    if (!n.props || !n.props.ts) return;                    // no text style, nothing to fight
    const style = C.findStyle(n.props.ts);
    if (!style) return;
    const responsive = ['t', 'm'].filter(b => (style.css[b] || {})['font-size']);
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
  C.insert('columns', null, 0);
  const row = C.state.pages[0].tree[0].children[0];
  C.applyCols(row, [50, 30, 20]);
  return row;
};

test('dragging a gutter moves width between two neighbours only', () => {
  const row = row3();
  const out = C.resizeCols(row, 0, 10);                 // grow the first by 10% of the row
  a.deepEqual(out, [60, 20, 20], 'the third column is untouched');
  a.equal(out.reduce((x, y) => x + y, 0), 100, 'and the row still totals 100');
});

test('a drag the other way is the same move, signed', () => {
  const row = row3();
  a.deepEqual(C.resizeCols(row, 1, -10), [50, 20, 30]);
});

test('a column stops at the minimum instead of collapsing', () => {
  const row = row3();
  const out = C.resizeCols(row, 0, -999);               // shove the gutter far left
  a.equal(out[0], C.MIN_COL, 'clamped, not zero — a collapsed column cannot be grabbed back');
  a.equal(out[0] + out[1], 80, 'the pair still holds what it held');
  const far = C.resizeCols(row, 0, 999);
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
  const out = C.resizeCols(row, 0, 10, 't');
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
  C.applyColsAt(row, C.resizeCols(row, 0, 25), 'd');
  a.equal(row.children.length, 3);
  a.deepEqual(row.children.map(c => c.type), ['column', 'column', 'column']);
});

test('a two-column row still resizes, and an equal split survives a round trip', () => {
  blank();
  C.insert('columns', null, 0);
  const row = C.state.pages[0].tree[0].children[0];
  a.equal(row.children.length, 2, 'Columns drops two');
  const out = C.resizeCols(row, 0, 15);
  C.applyColsAt(row, out, 'd');
  a.deepEqual(C.rowRatios(row), [65, 35]);
  C.applyColsAt(row, C.resizeCols(row, 0, -15), 'd');
  a.deepEqual(C.rowRatios(row), [50, 50], 'back where it started');
});

/* -------------------------------------------------------------- global blocks
   A plain block places independent copies. A global one tags each copy so that
   one of them can push its content back to the block and out to the rest. */
const savedFrom = (sync) => {
  blank();
  const h = C.insert('heading', null, 0);
  h.props.text = 'Original';
  const sec = C.state.pages[0].tree[0];
  return { id: C.blockSave(sec.id, 'Promo', sync), sec };
};

test('a plain block places copies that owe each other nothing', () => {
  const { id } = savedFrom(false);
  const first = C.blockInsert(id, null, 1);
  C.blockInsert(id, null, 2);
  a.equal(C.findBlock(id).sync, false);
  a.equal(!!(first.adv || {}).block, false, 'no link is recorded');
  a.equal(C.blockUsage(id), 0, 'so there is nothing to keep in sync');
});

test('a global block tags every copy it places', () => {
  const { id } = savedFrom(true);
  const one = C.blockInsert(id, null, 1), two = C.blockInsert(id, null, 2);
  a.equal(C.findBlock(id).sync, true);
  a.equal(one.adv.block, id);
  a.equal(two.adv.block, id);
  a.notEqual(one.id, two.id, 'they are still separate nodes');
  a.equal(C.blockUsage(id), 2);
});

test('the source of a global block never carries its own link', () => {
  const { id, sec } = savedFrom(true);
  a.equal(!!(C.findBlock(id).node.adv || {}).block, false);
  /* and saving an instance as a new block does not inherit the old link either */
  const inst = C.blockInsert(id, null, 1);
  const id2 = C.blockSave(inst.id, 'Promo two', true);
  a.equal(!!(C.findBlock(id2).node.adv || {}).block, false);
});

test('pushing one copy brings the block and every other copy into line', () => {
  const { id } = savedFrom(true);
  const one = C.blockInsert(id, null, 1);
  const two = C.blockInsert(id, null, 2);
  const three = C.blockInsert(id, null, 3);
  /* edit just one of them */
  const headingIn = node => { let f = null; C.eachNode([node], x => { if (!f && x.type === 'heading') f = x; }); return f; };
  headingIn(one).props.text = 'Edited';
  a.equal(headingIn(two).props.text, 'Original', 'untouched until pushed');

  a.equal(C.blockPush(one.id), 2, 'two other copies updated');
  a.equal(headingIn(two).props.text, 'Edited');
  a.equal(headingIn(three).props.text, 'Edited');
  a.equal(headingIn(C.findBlock(id).node).props.text, 'Edited', 'and the block itself');
});

test('a push keeps each copy its own element', () => {
  const { id } = savedFrom(true);
  const one = C.blockInsert(id, null, 1), two = C.blockInsert(id, null, 2);
  const idBefore = two.id;
  two.adv.htmlId = 'promo-two';
  C.blockPush(one.id);
  a.equal(two.id, idBefore, 'the node id survives, so a selection is not lost');
  a.equal(two.adv.block, id, 'and so does the link');
  a.equal(two.adv.htmlId, '', 'but a per-copy anchor is cleared — two elements cannot share one id');
});

test('pushing from something that is not a global copy does nothing', () => {
  const { id, sec } = savedFrom(false);
  const plain = C.blockInsert(id, null, 1);
  a.equal(C.blockPush(plain.id), 0);
  a.equal(C.blockPush(sec.id), 0, 'the source section is not an instance either');
});

test('instances are found across pages and both global regions', () => {
  const { id } = savedFrom(true);
  C.blockInsert(id, null, 1);
  C.state.pages.push(C.pageFromTemplate('blank', 'Two'));
  C.state.cur = 1;
  C.blockInsert(id, null, 0);
  C.state.ui.mode = 'header';
  C.blockInsert(id, null, 0);
  C.state.ui.mode = 'page'; C.state.cur = 0;
  a.equal(C.blockUsage(id), 3);
  a.deepEqual([...new Set(C.blockInstances(id).map(x => x.where))].sort(), ['header', 'page:0', 'page:1']);
});

test('forgetting a global block leaves its copies in place', () => {
  const { id } = savedFrom(true);
  const one = C.blockInsert(id, null, 1);
  C.blockDelete(id);
  a.equal(C.findBlock(id), null);
  a.ok(C.locate(one.id), 'the copy is still on the page');
  a.equal(C.blockPush(one.id), 0, 'it just has nothing left to push to');
});

test('a fresh copy never inherits a hand-set anchor', () => {
  /* every duplicate path runs through reid, and each of them used to produce a
     duplicate-id error the moment the source carried an anchor */
  blank();
  const h = C.insert('heading', null, 0);
  h.adv.htmlId = 'signup';
  const sec = C.state.pages[0].tree[0];

  C.dupNode(sec.id);
  a.equal(C.state.pages[0].tree.length, 2);
  const copied = [];
  C.eachNode([C.state.pages[0].tree[1]], n => { if (n.adv && n.adv.htmlId) copied.push(n.adv.htmlId); });
  a.deepEqual(copied, [], 'the duplicate carries no anchor');
  a.equal(h.adv.htmlId, 'signup', 'and the original keeps its own');
  a.equal(find(C.lint(), 'duplicate-id').length, 0);

  /* the same for a placed block, and for paste */
  const id = C.blockSave(sec.id, 'With anchor', true);
  const placed = C.blockInsert(id, null, 2);
  const fromBlock = [];
  C.eachNode([placed], n => { if (n.adv && n.adv.htmlId) fromBlock.push(n.adv.htmlId); });
  a.deepEqual(fromBlock, []);
  C.copyNode(sec.id);
  const pasted = C.pasteNode(null);
  const fromClip = [];
  C.eachNode([pasted], n => { if (n.adv && n.adv.htmlId) fromClip.push(n.adv.htmlId); });
  a.deepEqual(fromClip, []);
  a.equal(find(C.lint(), 'duplicate-id').length, 0, 'nothing collides anywhere');
});

test('every link mode round-trips through build and parse', () => {
  /* the inspector derives a link's mode from the href it holds, so each mode has to
     survive the trip out and back — three of them silently did not */
  fresh();
  const here = 'index';
  const cases = [
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
  const col = C.collectionAdd('Projects');
  C.fieldAdd(col.id, 'Summary', 'text');
  C.fieldAdd(col.id, 'Cover', 'image');
  return col;
};

test('a new collection arrives usable, with an id you can put in a URL', () => {
  blank();
  const col = C.collectionAdd('Case Studies');
  a.equal(col.id, 'case-studies');
  a.equal(col.slug, 'case-studies');
  a.equal(col.fields.length, 1, 'one field to start, or there is nothing to fill in');
  a.equal(col.fields[0].type, 'text');
  a.deepEqual(col.items, []);
});

test('two collections of the same name do not collide', () => {
  blank();
  a.equal(C.collectionAdd('Work').id, 'work');
  a.equal(C.collectionAdd('Work').id, 'work-2');
});

test('an item names itself from the first text field, and slugs from that', () => {
  const col = projects();
  const it = C.itemAdd(col.id);
  a.equal(C.itemTitle(col, it), 'Untitled');
  C.itemSet(col.id, it.id, 'title', 'Acme rebrand');
  a.equal(C.itemTitle(col, it), 'Acme rebrand');
  a.equal(it.slug, 'acme-rebrand', 'the slug follows the title');
});

test('two items with the same title get different slugs', () => {
  const col = projects();
  const a1 = C.itemAdd(col.id), a2 = C.itemAdd(col.id);
  C.itemSet(col.id, a1.id, 'title', 'Rebrand');
  C.itemSet(col.id, a2.id, 'title', 'Rebrand');
  a.equal(a1.slug, 'rebrand');
  a.equal(a2.slug, 'rebrand-2', 'or one would overwrite the other on export');
});

test('a hand-set slug stops following the title', () => {
  const col = projects();
  const it = C.itemAdd(col.id);
  C.itemSet(col.id, it.id, 'title', 'First name');
  a.equal(it.slug, 'first-name');
  C.itemSetSlug(col.id, it.id, 'custom-url');
  a.equal(it.slug, 'custom-url');
  C.itemSet(col.id, it.id, 'title', 'Renamed after publishing');
  a.equal(it.slug, 'custom-url', 'a published URL does not move on a typo fix');
});

test('deleting a field takes its values with it', () => {
  const col = projects();
  const it = C.itemAdd(col.id);
  C.itemSet(col.id, it.id, 'title', 'One');
  C.itemSet(col.id, it.id, 'summary', 'kept');
  C.itemSet(col.id, it.id, 'cover', 'asset:abc');
  a.equal(C.fieldDelete(col.id, 'cover'), 1, 'one value cleared');
  a.equal('cover' in it.values, false, 'no orphan value survives the schema');
  a.deepEqual(Object.keys(it.values).sort(), ['summary', 'title']);
});

test('the last field cannot be deleted', () => {
  blank();
  const col = C.collectionAdd('Notes');
  a.equal(C.fieldDelete(col.id, col.fields[0].id), 0);
  a.equal(col.fields.length, 1, 'a collection with no fields could hold nothing');
});

test('fields and items reorder, and stop at the ends', () => {
  const col = projects();
  a.equal(C.fieldMove(col.id, 'cover', -1), true);
  a.deepEqual(col.fields.map(f => f.id), ['title', 'cover', 'summary']);
  a.equal(C.fieldMove(col.id, 'title', -1), false, 'already first');
  const i1 = C.itemAdd(col.id), i2 = C.itemAdd(col.id);
  a.equal(C.itemMove(col.id, i2.id, -1), true);
  a.deepEqual(col.items.map(i => i.id), [i2.id, i1.id]);
  a.equal(C.itemMove(col.id, i1.id, 1), false, 'already last');
});

test('an unknown field type falls back rather than storing nonsense', () => {
  const col = projects();
  a.equal(C.fieldAdd(col.id, 'Odd', 'not-a-type').type, 'text');
  a.equal(C.fieldAdd(col.id, 'Price', 'number').type, 'number');
});

test('deleting a collection leaves the others alone', () => {
  blank();
  const a1 = C.collectionAdd('One'), a2 = C.collectionAdd('Two');
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
  const col = C.collectionAdd('Projects');
  C.fieldAdd(col.id, 'Summary', 'text');
  const i1 = C.itemAdd(col.id), i2 = C.itemAdd(col.id);
  C.itemSet(col.id, i1.id, 'title', 'Acme rebrand');
  C.itemSet(col.id, i1.id, 'summary', 'A full identity refresh');
  C.itemSet(col.id, i2.id, 'title', 'Northwind app');
  C.itemSet(col.id, i2.id, 'summary', 'Design system and product UI');
  const h = C.insert('heading', null, 0);
  const col_ = C.locate(h.id).parent;                 // the column that wraps it
  C.srcSet(col_, col.id);
  C.bindSet(h, 'text', 'title');
  return { col, i1, i2, h, holder: col_ };
};

test('a binding names a field, and takes its collection from the scope above', () => {
  const { h, holder, col } = bound();
  a.deepEqual(h.bind, { text: 'title' }, 'the node stores only the field');
  a.equal(h.src, undefined, 'no collection id on the bound node');
  const sc = C.bindScope(h.id);
  a.equal(sc.col.id, col.id);
  a.equal(sc.node.id, holder.id, 'resolved from the nearest ancestor with a source');
});

test('a bound property renders the item, not the placeholder', () => {
  const { h, i1 } = bound();
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
  a.equal(C.previewItem(col).values.title, 'Northwind app', 'clamped to the last item');
  C.collections()[0].items = [];
  a.equal(C.previewItem(col), null, 'and an empty collection binds to nothing');
});

test('an empty field renders empty, not the placeholder it replaced', () => {
  const { h, col, i1 } = bound();
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
  const h = C.insert('heading', null, 0);
  a.equal(C.boundProps(h, null, null), h.props, 'the identity object, not a copy');
});

test('a source only counts when the collection is real', () => {
  const { holder } = bound();
  C.srcSet(holder, 'ghost-collection');
  a.equal(holder.src, undefined);
  const h2 = C.insert('heading', null, 0);
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
  const col = C.collectionAdd('Projects');
  C.fieldAdd(col.id, 'Year', 'number');
  [['Acme rebrand', '2025'], ['Northwind app', '2024'], ['Harbour print', '100']].forEach(([t, y]) => {
    const it = C.itemAdd(col.id);
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
  const { col } = withList();
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
  const { col } = withList();
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
  const { col } = withList();
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
  const { col, card } = withList();
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: true });
  a.match(html, new RegExp('id="' + card.id + '"'), 'so selection and the HUD still find it');
  a.equal((html.match(new RegExp('data-id="' + card.id + '"', 'g')) || []).length, 3,
    'but every copy still points at the one template node');
});

/* ------------------------------------------------------------- detail pages */
const detail = () => {
  blank();
  const col = C.collectionAdd('Projects');
  col.slug = 'work';
  C.fieldAdd(col.id, 'Body', 'rich');
  ['Acme rebrand', 'Northwind app'].forEach(t => {
    const it = C.itemAdd(col.id);
    C.itemSet(col.id, it.id, 'title', t);
    C.itemSet(col.id, it.id, 'body', 'The story of ' + t);
  });
  /* a second ordinary page to link to */
  C.state.pages.push(C.pageFromTemplate('blank', 'About'));
  const tpl = C.pageFromTemplate('blank', 'Project');
  tpl.collection = col.id;
  tpl.bindTitle = 'title';
  C.state.pages.push(tpl);
  return { col, tpl };
};

test('a detail template emits one file per item, the rest one each', () => {
  const { col } = detail();
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
  const { col, tpl } = detail();
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
  const { col } = detail();
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
  const { col } = detail();
  C.collections()[0].items = [];
  a.deepEqual(C.exportTargets().map(x => x.path), ['index.html', 'pricing.html', 'about.html']);
});

test('on a detail page the whole page is the binding scope', () => {
  const { tpl, col } = detail();
  C.state.cur = C.state.pages.indexOf(tpl);
  const h = C.insert('heading', null, 0);
  const sc = C.bindScope(h.id);
  a.equal(sc.col.id, col.id);
  a.equal(sc.node, null, 'no src node needed — the page provides it');
});

/* -------------------------------------------------------------- content.json */
test('content.json carries the schema, the items and their URLs', () => {
  const { col } = detail();
  const j = JSON.parse(C.contentJson());
  a.equal(j.site.name, C.state.meta.name);
  a.equal(j.collections.length, 1);
  const c = j.collections[0];
  a.equal(c.id, 'projects');
  a.equal(c.slug, 'work');
  a.deepEqual(c.fields.map(f => f.id), ['title', 'body']);
  a.deepEqual(c.fields.map(f => f.type), ['text', 'rich']);
  a.deepEqual(c.items.map(i => i.slug), ['acme-rebrand', 'northwind-app']);
  a.equal(c.items[0].url, 'work/acme-rebrand.html', 'so a consumer knows where the page is');
  a.equal(c.items[0].values.title, 'Acme rebrand');
});

test('an item with no detail page carries no url', () => {
  blank();
  const col = C.collectionAdd('Notes');
  const it = C.itemAdd(col.id);
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
  const col = C.collectionAdd('Gallery');
  C.fieldAdd(col.id, 'Shot', 'image');
  const it = C.itemAdd(col.id);
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
  const n = C.insert('accordion', null, 0);
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
  const n = C.insert('embed', null, 0);
  n.props.html = '<iframe src="https://example.com/x" title="Map"></iframe>';
  a.match(C.renderNode(n, { edit: false }), /<iframe src="https:\/\/example\.com\/x" title="Map"><\/iframe>/);
});

test('the canvas holds back scripts the export ships', () => {
  blank();
  const n = C.insert('embed', null, 0);
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
  const n = C.insert('embed', null, 0);
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
  const n = C.insert('embed', null, 0);
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
  const n = C.insert('icon', null, 0);
  const html = C.renderNode(n, { edit: false });
  a.match(html, /width="24"/);
  a.match(html, /height="24"/);
  a.match(html, /viewBox="0 0 24 24"/);
  a.match(C.baseCss(false), /\.pagecraft-icon-glyph\{[^}]*width:var\(--icon-size/);
});

test('a label makes an icon announced; without one it is hidden', () => {
  blank();
  const n = C.insert('icon', null, 0);
  a.match(C.renderNode(n, { edit: false }), /aria-hidden="true"/);
  n.props.label = 'Verified';
  const html = C.renderNode(n, { edit: false });
  a.match(html, /role="img"/);
  a.match(html, /aria-label="Verified"/);
  a.equal(/aria-hidden/.test(html), false);
});

test('a linked icon names the link, not the glyph', () => {
  blank();
  const n = C.insert('icon', null, 0);
  n.props.link = 'https://example.com';
  n.props.label = 'Our GitHub';
  const html = C.renderNode(n, { edit: false });
  a.match(html, /<a [^>]*aria-label="Our GitHub"/, 'the link is what gets the name');
  a.match(html, /<svg [^>]*aria-hidden="true"/, 'the glyph inside it says nothing twice');
  a.match(html, /class="pagecraft-icon-glyph"/);
});

test('an unknown icon name falls back rather than drawing an empty box', () => {
  blank();
  const n = C.insert('icon', null, 0);
  n.props.name = 'no-such-glyph';
  a.match(C.renderNode(n, { edit: false }), new RegExp(C.ICON_PATHS.check.slice(1, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

/* ================================================================= gallery */
const gal = (count, props = {}) => {
  blank();
  const n = C.insert('gallery', null, 0);
  n.props.items = Array.from({ length: count }, (_, i) =>
    ({ src: 'asset:a' + i, alt: 'Shot ' + i, caption: 'Cap ' + i, w: '1200', h: '900' }));
  Object.assign(n.props, props);
  return n;
};

test('a gallery is one figure per tile, and an empty tile is a slot, not a gap', () => {
  const n = gal(3);
  n.props.items.push({ src: '', alt: '' });
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
  C.insert('heading', null, 0);
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
    '.pagecraft-icon:focus-visible', '.pagecraft-form-button:focus-visible',
    '.pagecraft-video-play:focus-visible'
  ].forEach(sel => a.ok(css.includes(sel), sel + ' has a focus ring'));
  /* currentColor, not the brand: #b7f34a is 1.6:1 on Paper, so a brand ring round
     a brand-filled button was invisible in the one case it had to work. Text
     colour already contrasts with its own ground, so the ring inherits that. */
  a.match(css, /outline:3px solid currentColor;outline-offset:3px/);
  a.equal(/focus-visible\{outline:3px solid var\(--c-brand\)/.test(css), false);
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
  const n = C.insert('embed', null, 0);
  a.equal(find(C.lint(), 'embed-empty').length, 1);
  n.props.html = '<iframe src="https://x.test"></iframe>';
  a.equal(codes(C.lint()).filter(x => x.startsWith('embed-')).length, 0);
  n.props.html += '<script src="https://x.test/w.js"></script>';
  a.equal(find(C.lint(), 'embed-script').length, 1);
});

test('a linked icon with no label is an error — the link would have no name at all', () => {
  blank();
  const n = C.insert('icon', null, 0);
  a.equal(find(C.lint(), 'icon-link-no-label').length, 0, 'an unlinked glyph is allowed to be decorative');
  n.props.link = 'https://example.com';
  a.equal(find(C.lint(), 'icon-link-no-label').length, 1);
  n.props.label = 'GitHub';
  a.equal(find(C.lint(), 'icon-link-no-label').length, 0);
});

test('a gallery is held to the Image widget’s standards, counted per gallery', () => {
  const n = gal(4);
  a.equal(codes(C.lint()).filter(x => x.startsWith('gallery-')).length, 0);
  n.props.items[0].alt = '';
  n.props.items[1].alt = ' ';
  n.props.items[2].w = '';
  const f = C.lint();
  a.equal(find(f, 'gallery-no-alt').length, 1);
  a.match(find(f, 'gallery-no-alt')[0].msg, /2 of 4 images/);
  a.equal(find(f, 'gallery-no-dimensions').length, 1);
  n.props.items = [];
  a.equal(find(C.lint(), 'gallery-empty').length, 1);
});

test('a gallery slot with no image yet is a slot to fill, not an alt-text error', () => {
  const n = gal(2);
  n.props.items.push({ src: '', alt: '', caption: '' });
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
  a.ok(C.findClass('card'), 'a class you made is still there');
});

test('a collection keeps its schema and loses its items', () => {
  fresh();
  const col = C.collectionAdd('Projects');
  C.fieldAdd(col.id, 'Summary', 'text');
  C.itemAdd(col.id); C.itemAdd(col.id);
  a.equal(C.findCollection(col.id).items.length, 2);
  C.blankProject('Mine');
  const after = C.findCollection(col.id);
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
  const src = C.insert('heading', null, 0);
  const dst = C.insert('heading', null, 1);
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
  a.equal(C.styleClip.css.d.color, '#a8402f');
  a.equal(C.styleClip.css.t['font-size'], '30px', 'a look is not a look if it falls apart on mobile');
  a.equal(C.styleClip.css.m['font-size'], '22px');
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
  const h = C.insert('heading', null, 1);
  const img = C.insert('image', null, 2);
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
  a.equal(C.clip.node.id, src.id, 'copying a look did not throw away the copied element');
  C.copyNode(dst.id);
  a.ok(C.styleClip.css, 'and copying an element did not throw away the look');
});

test('pasting onto a set counts what it changed, and does nothing with an empty clipboard', () => {
  const { src } = styled();
  const one = C.insert('heading', null, 1);
  const two = C.insert('heading', null, 2);
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
  const h = C.insert('heading', null, 0);
  h.props.text = 'Harbour harbour HARBOUR';
  a.equal(C.searchCount(C.searchAll('harbour')), 3, 'insensitive by default');
  a.equal(C.searchCount(C.searchAll('harbour', { caseSensitive: true })), 1);
  a.equal(C.searchCount(C.searchAll('HARBOUR', { caseSensitive: true })), 1);
});

test('rich text is searched as text, never as markup', () => {
  blank();
  const t = C.insert('text', null, 0);
  t.props.html = '<div class="wrap"><p>a wrapper of words</p></div>';
  /* looking for "div" must not report every tag, and "class" must not match an attribute */
  a.equal(C.searchCount(C.searchAll('div')), 0);
  a.equal(C.searchCount(C.searchAll('class')), 0);
  a.equal(C.searchCount(C.searchAll('wrap')), 1, 'the one in the sentence, not the one in the class');
  a.equal(C.searchCount(C.searchAll('words')), 1);
});

test('a replace stays out of the tags too', () => {
  blank();
  const t = C.insert('text', null, 0);
  t.props.html = '<div class="wrap"><p>wrap it</p></div>';
  a.equal(C.replaceAll('wrap', 'fold'), 1);
  a.equal(t.props.html, '<div class="wrap"><p>fold it</p></div>', 'the class attribute is untouched');
});

test('outsideTags only transforms what sits between tags', () => {
  a.equal(C.outsideTags('<b title="a">a</b>', s => s.toUpperCase()), '<b title="a">A</b>');
  a.equal(C.outsideTags('plain', s => s.toUpperCase()), 'PLAIN');
  a.equal(C.outsideTags('', s => 'x'), 'x');
});

test('a replace reaches nested props: accordion rows, nav links, form fields', () => {
  blank();
  const acc = C.insert('accordion', null, 0);
  acc.props.items = [{ q: 'Is Acme good?', a: 'Acme is fine.' }];
  const nav = C.insert('nav', null, 1);
  nav.props.items = [{ label: 'Acme', href: '#acme' }];
  const form = C.insert('form', null, 2);
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
  const col = C.collectionAdd('Projects');
  const it = C.itemAdd(col.id);
  C.itemSet(col.id, it.id, 'title', 'Acme rebrand');
  const hits = C.searchAll('Acme');
  a.equal(hits.length, 1);
  a.equal(hits[0].where, 'cms');
  a.equal(hits[0].pageName, 'Projects');
  C.replaceAll('Acme', 'Beta');
  a.equal(C.findCollection(col.id).items[0].values.title, 'Beta rebrand');
  /* and it can be told not to */
  C.replaceAll('Beta', 'Gamma', { cms: false });
  a.equal(C.findCollection(col.id).items[0].values.title, 'Beta rebrand');
});

test('a text slot is declared once and every walker agrees', () => {
  blank();
  const g = C.insert('gallery', null, 0);
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
    .forEach(t => a.ok(C.TEXT_SLOTS[t], t + ' names its text props'));
  Object.keys(C.TEXT_SLOTS).forEach(t => a.ok(C.DEF[t], t + ' is a real widget'));
});
