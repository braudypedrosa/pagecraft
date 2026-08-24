/* Build Pagecraft's own page, with Pagecraft.
 *
 *   node --experimental-strip-types tools/demo-site.mjs
 *
 * Writes `dist/demo/index.html`: one self-contained file, which is what the "images inlined"
 * export mode produces. That is the artifact published from this repo alongside the builder —
 * the builder is the tool, this is what the tool makes.
 *
 *   builder   https://claude.ai/code/artifact/16d1f437-f2ca-44df-aff7-02875acdd2c2
 *   this page https://claude.ai/code/artifact/adda4e09-131d-4c1c-84e3-393254a0fa72
 *
 * `npm run publish:check` guards the builder's copy only. This one needs no guard: it is one
 * command to regenerate and the page is a demonstration rather than the product, so a stale
 * copy costs a rebuild rather than a wrong answer.
 *
 * ## Why a script and not a saved project
 *
 * A project JSON is 57 KB of unreadable nesting. This is the same site as a hundred lines you
 * can read, and it doubles as the widest integration exercise in the repo: patterns, a Box grid,
 * a component with three declared properties and six instances, a collection with a conditional
 * field, a table, a syntax-highlighted code block, a form with half-width fields, and the
 * review. If any of that breaks, this stops producing a page.
 *
 * ## Why the image is an SVG data URI
 *
 * The image widget takes an upload *or* a URL, and a data URI is a URL. An upload would mean an
 * asset store, which lives in the browser — and a 1600×900 PNG came to 1.2 MB of base64 in the
 * exported file, against about a kilobyte for the same panel drawn as SVG. A real site would
 * upload a photograph; a diagram belongs in vector.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../app/src/core/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');

/* ---- the hero panel, as vector ---------------------------------------- */
const panel = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="#111311"/><stop offset="1" stop-color="#2b3a2b"/></linearGradient></defs>`
    + `<rect width="1600" height="900" fill="url(#g)"/>`
    + `<text x="120" y="470" fill="#f8f6ef" font-family="Manrope, system-ui, sans-serif" font-size="112" font-weight="600" letter-spacing="-4">One file.</text>`
    + `<text x="122" y="560" fill="#b0b7b1" font-family="Manrope, system-ui, sans-serif" font-size="40">Everything a browser needs.</text>`
    + `<rect x="120" y="640" width="420" height="26" rx="13" fill="#b7f34a"/>`
    + `</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
};

/* ---- the project ------------------------------------------------------- */
C.seed();                       // for the tokens and text styles, which are the design system
C.blankProject('Pagecraft');
C.state.meta.collections = [];
C.state.meta.components = [];
C.state.meta.blocks = [];
C.state.meta.baseUrl = 'https://pagecraft.example';

const page = C.state.pages[0];
page.slug = 'index';
page.title = 'Pagecraft';
page.desc = 'A visual page builder in a single HTML file. No accounts, no build step, '
  + 'no dependencies — and what comes out is static HTML you own.';

/* ---- header and footer, from the templates ---------------------------- */
C.state.ui.mode = 'header';
C.patternInsert('header-cta', null, 0);
{
  let brand = null, nav = null, btn = null;
  C.eachNode(C.state.header, n => {
    if (!brand && n.type === 'heading') brand = n;
    if (!nav && n.type === 'nav') nav = n;
    if (!btn && n.type === 'button') btn = n;
  });
  brand.props.text = 'Pagecraft';
  /* Anchors rather than page links, because this is one page. On a multi-page site the review
     would refuse these — a bare `#what` in a *global* header resolves only on the page that
     has it, and it says so, eighteen times. */
  nav.props.items = [
    { label: 'What it does', href: '#what' },
    { label: 'What changed', href: '#changed' },
    { label: 'The export', href: '#export' }
  ];
  btn.props.text = 'Open it';
  btn.props.link = 'https://github.com/braudypedrosa/pagecraft';
  btn.props.target = '_blank';
}
C.state.ui.mode = 'footer';
C.patternInsert('footer-slim', null, 0);
C.eachNode(C.state.footer, n => {
  if (n.type === 'heading') n.props.text = 'Pagecraft';
  if (n.type === 'text') n.props.html = '<p>MIT licensed. Build with it, sell what you make.</p>';
});
C.state.ui.mode = 'page';

/* ---- the hero ---------------------------------------------------------- */
C.patternInsert('hero-centre', null, 0);
{
  const byStyle = ts => { let f = null; C.eachNode(page.tree, n => { if (!f && n.props.ts === ts) f = n; }); return f; };
  byStyle('eyebrow').props.text = 'One HTML file';
  const h1 = byStyle('display');
  h1.props.text = 'Build it visually. Ship real HTML.';
  h1.props.level = 'h1';
  byStyle('lead').props.html = '<p>A page builder that is one file. No accounts, no build step, '
    + 'nothing to install — open it and start. What comes out is static HTML you own.</p>';
  let btn = null;
  C.eachNode(page.tree, n => { if (!btn && n.type === 'button') btn = n; });
  btn.props.text = 'See what it makes';
  btn.props.link = '#what';

  const img = C.insert('image', page.tree[0], 99);
  img.props.src = panel();
  img.props.alt = 'A dark panel reading “One file. Everything a browser needs.”';
  img.props.w = '1600';
  img.props.h = '900';
  img.props.lazy = 0;
  C.setCss(img, 'border-radius', '16px');
  C.setCss(img, 'margin-top', '36px');
}

/* ---- what it does: a component, six instances ------------------------- */
const FEATURES = [
  ['code', 'Real HTML out', 'No runtime, no framework, no build. A folder of files a browser can open — and still read in ten years.'],
  ['layers', 'Components, not copies', 'Save a card once. Every place you put it stays connected, and what varies between them is a property you declared.'],
  ['users', 'Content without a rebuild', 'Collections repeat a card per item. A client signs in and changes the words; nobody re-exports anything.'],
  ['box', 'Three breakpoints, one document', 'Override only what needs overriding. The panel says which breakpoint owns a value, so nothing is haunted.'],
  ['shield', 'It tells you what is wrong', 'A review before you export: contrast, heading order, missing alt text, dead links, forms with nowhere to post.'],
  ['zap', 'Images done properly', 'Uploads are stored once, referenced everywhere, and exported at the widths a browser actually wants.']
];
{
  const sec = C.insert('section', null, 1);
  sec.adv.htmlId = 'what';
  const h = C.insert('heading', sec, 0);
  h.props.text = 'What it actually does';
  h.props.ts = 'title';
  h.props.level = 'h2';
  C.setCss(h, 'text-align', 'center');

  const grid = C.insert('grid', sec, 1);
  C.setCss(grid, 'gap', '20px');
  C.setCss(grid, 'margin-top', '36px');
  C.setCss(grid, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))');
  /* the phone rule, which the review insists on and is right to */
  grid.css.m = { 'grid-template-columns': 'repeat(auto-fit, minmax(240px, 1fr))' };

  /* one card, by hand, then made into a component */
  const card = C.insert('box', grid, 0);
  card.props.layout = 'flex';
  for (const k of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']) C.setCss(card, k, '26px');
  C.setCss(card, 'border-radius', '16px');
  C.setCss(card, 'background-color', C.cvar('surface'));
  C.setCss(card, 'border-width', '1px');
  C.setCss(card, 'border-style', 'solid');
  C.setCss(card, 'border-color', C.cvar('line'));
  C.setCss(card, 'flex-direction', 'column');
  C.setCss(card, 'gap', '10px');
  C.insert('icon', card, 0).props.name = 'code';
  const ct = C.insert('heading', card, 1);
  ct.props.text = 'Title'; ct.props.ts = 'subtitle'; ct.props.level = 'h3';
  C.insert('text', card, 2).props.html = '<p>Body.</p>';

  const cid = C.componentFromNode(card.id, 'Feature');
  const def = C.findComponent(cid);
  const first = {};
  C.eachNode([def.node], n => { if (!first[n.type]) first[n.type] = n; });
  const key = {};
  for (const [type, k, label] of [['icon', 'name', 'Icon'], ['heading', 'text', 'Title'], ['text', 'html', 'Body']]) {
    const ctl = C.contentControls(first[type]).find(c => c.k === k);
    key[label] = C.propFromControl(cid, first[type].id, ctl);
    C.propRename(cid, key[label], label);
  }

  const inst0 = C.instances(cid)[0].node;
  const fill = (node, [icon, title, body]) => {
    C.instSet(node, key.Icon, icon);
    C.instSet(node, key.Title, title);
    C.instSet(node, key.Body, `<p>${body}</p>`);
  };
  fill(inst0, FEATURES[0]);
  FEATURES.slice(1).forEach((row, i) => fill(C.instanceInsert(cid, grid, i + 1), row));
}

/* ---- what changed: a collection, and a condition ---------------------- */
const RELEASES = [
  ['One way to author a hover', 'v8',
    'A button had two colour pickers of its own and nothing else could have a hover at all. Both are gone: every element uses the State control.',
    'Migrating to a value that was not on screen would be a redesign wearing a migration’s clothes.'],
  ['A binding says where its value comes from', 'v9',
    'A binding was a bare field id, because a CMS field was the only place a value could come from. It names its source now.', ''],
  ['Components', 'v10',
    'A definition and its instances. Nothing is cloned at render, so one set of rules dresses every instance.',
    'Taken early on purpose: it is the one thing expensive to retrofit.'],
  ['The global block retired', 'v11',
    'Copies that pushed content over each other became components. A copy that had diverged keeps what it shows and stops being linked.', '']
];
{
  const col = C.collectionAdd('Releases');
  const title = col.fields[0].id;
  const version = C.fieldAdd(col.id, 'Version', 'text').id;
  const summary = C.fieldAdd(col.id, 'Summary', 'rich').id;
  const note = C.fieldAdd(col.id, 'Note', 'text').id;
  for (const [t, v, s, n] of RELEASES) {
    const it = C.itemAdd(col.id);
    C.itemSet(col.id, it.id, title, t);
    C.itemSet(col.id, it.id, version, v);
    C.itemSet(col.id, it.id, summary, `<p>${s}</p>`);
    if (n) C.itemSet(col.id, it.id, note, n);
  }

  const sec = C.insert('section', null, 2);
  sec.adv.htmlId = 'changed';
  C.setCss(sec, 'background-color', C.cvar('surface'));
  const h = C.insert('heading', sec, 0);
  h.props.text = 'What changed';
  h.props.ts = 'title';
  h.props.level = 'h2';
  C.setCss(h, 'text-align', 'center');
  const lead = C.insert('text', sec, 1);
  lead.props.ts = 'lead';
  lead.props.html = '<p>Each of these is a schema version, which means each one migrated every '
    + 'project that existed. The rule is that no page moves.</p>';
  C.setCss(lead, 'text-align', 'center');
  C.setCss(lead, 'max-width', '62ch');
  C.setCss(lead, 'margin-left', 'auto');
  C.setCss(lead, 'margin-right', 'auto');

  const list = C.insert('list', sec, 2);
  list.src = col.id;
  C.setCss(list, 'margin-top', '32px');
  const row = C.insert('columns', list, 0);
  C.applyCols(row, C.LAYOUTS[1][0]);
  const card = row.children[0];
  for (const k of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']) C.setCss(card, k, '24px');
  C.setCss(card, 'border-radius', '14px');
  C.setCss(card, 'background-color', C.cvar('bg'));
  C.setCss(card, 'border-width', '1px');
  C.setCss(card, 'border-style', 'solid');
  C.setCss(card, 'border-color', C.cvar('line'));
  C.setCss(card, 'gap', '8px');

  const ver = C.insert('heading', card, 0);
  ver.props.ts = 'eyebrow'; ver.props.level = 'div';
  C.bindSet(ver, 'text', C.bindField(version));
  const ttl = C.insert('heading', card, 1);
  ttl.props.ts = 'subtitle'; ttl.props.level = 'h3';
  C.bindSet(ttl, 'text', C.bindField(title));
  const sum = C.insert('text', card, 2);
  sum.props.ts = 'body';
  C.bindSet(sum, 'html', C.bindField(summary));
  /* the conditional: only the releases with a note show one */
  const nte = C.insert('text', card, 3);
  nte.props.ts = 'small';
  C.bindSet(nte, 'html', C.bindField(note));
  C.condSet(nte, { bind: C.bindField(note), op: 'set' });
}

/* ---- the export: a table and the markup ------------------------------- */
{
  const sec = C.insert('section', null, 3);
  sec.adv.htmlId = 'export';
  const h = C.insert('heading', sec, 0);
  h.props.text = 'What comes out';
  h.props.ts = 'title';
  h.props.level = 'h2';

  const table = C.insert('table', sec, 1);
  table.props.body = [
    'File|What it is',
    'index.html|One per page, named by its slug — with the stylesheet inlined',
    'work/acme.html|One per collection item, when a page is a template for one',
    'assets/hero.webp|Your uploads, each written at several widths with a srcset',
    'sitemap.xml|Every page, once a Site URL is set in Project settings',
    'robots.txt|Pointing at the sitemap',
    'content.json|The collections, if the site has any'
  ].join('\n');
  table.props.head = 1;
  table.props.rowhead = 1;
  table.props.zebra = 1;
  table.props.caption = 'What an export writes';
  C.setCss(table, 'margin-top', '24px');

  const code = C.insert('code', sec, 2);
  code.props.lang = 'html';
  code.props.numbers = 1;
  code.props.body = [
    '<section id="pagecraft-section-1" class="pagecraft-section pagecraft-1k2">',
    '  <div class="pagecraft-container">',
    '    <h1 class="pagecraft-heading pagecraft-1k3 ts-display">Build it visually.</h1>',
    '    <p class="pagecraft-wysiwyg pagecraft-1k4 ts-lead">Ship real HTML.</p>',
    '  </div>',
    '</section>'
  ].join('\n');
  C.setCss(code, 'margin-top', '32px');

  const note = C.insert('text', sec, 3);
  note.props.ts = 'body';
  note.props.html = '<p>One <code>&lt;style&gt;</code> block per page, not a shared file: a page '
    + 'is then one request that renders on arrival, and there is no second file to lose when '
    + 'somebody copies the HTML somewhere. Three media queries — reduced motion, tablet, phone '
    + '— and no rule for an element the page does not have.</p>';
  C.setCss(note, 'max-width', '68ch');
  C.setCss(note, 'margin-top', '20px');
}

/* ---- the form, with two fields on one row ----------------------------- */
{
  const sec = C.insert('section', null, 4);
  sec.adv.htmlId = 'ask';
  C.setCss(sec, 'background-color', C.cvar('surface'));
  const h = C.insert('heading', sec, 0);
  h.props.text = 'Ask something';
  h.props.ts = 'title';
  h.props.level = 'h2';
  const lead = C.insert('text', sec, 1);
  lead.props.ts = 'lead';
  lead.props.html = '<p>It is MIT licensed and there is nothing to buy. If something is '
    + 'unclear, that is a bug.</p>';
  C.setCss(lead, 'max-width', '58ch');

  const form = C.insert('form', sec, 2);
  form.props.action = 'https://formspree.io/f/example';
  form.props.submit = 'Send it';
  form.props.fields[0].half = 1;         // Name
  form.props.fields[1].half = 1;         // Email
  C.setCss(form, 'max-width', '46rem');
  C.setCss(form, 'margin-top', '28px');
}

/* ---- and out ---------------------------------------------------------- */
const findings = C.lint();
const bad = findings.filter(f => f.level === 'error');
for (const f of findings) console.log(`  ${f.level.padEnd(5)} ${f.code.padEnd(16)} ${f.msg.slice(0, 96)}`);
if (bad.length) {
  console.error(`\n${bad.length} error${bad.length === 1 ? '' : 's'} — the page is not worth publishing like this.`);
  process.exit(1);
}

const html = C.buildPage(page);
const out = join(repo, 'dist', 'demo');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);

/* ---- and again, as an Artifact fragment -------------------------------
 * An Artifact is published as page *content*: the host supplies the doctype, `<html>` and
 * `<head>`, so this keeps the title, the font links and the stylesheet and drops the wrapper.
 * The canonical, `og:*` and JSON-LD go too — they name `pagecraft.example`, and publishing a
 * page that claims a canonical URL it does not have is worse than publishing one with none.
 */
const fragment = (doc) => {
  const pick = re => (doc.match(re) || [''])[0];
  const body = doc.slice(doc.indexOf('<body>') + 6, doc.lastIndexOf('</body>'));
  return [
    pick(/<title>[\s\S]*?<\/title>/),
    pick(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/),
    pick(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>/),
    pick(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/),
    pick(/<style>[\s\S]*?<\/style>/),
    body.trim()
  ].filter(Boolean).join('\n');
};
const frag = fragment(html);
writeFileSync(join(out, 'artifact.html'), frag);

const kb = n => Math.round(n / 1024) + ' KB';
console.log(`\ndist/demo/artifact.html — ${kb(frag.length)} (page content, for publishing)`);
console.log(`dist/demo/index.html — ${kb(html.length)}`);
console.log(`  ${C.components().length} component, ${C.componentUsage(C.components()[0].id)} instances`);
console.log(`  ${C.collections()[0].items.length} collection items, ${findings.length} findings`);
