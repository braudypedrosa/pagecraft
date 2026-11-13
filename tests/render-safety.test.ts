/* What a person other than the owner can get onto the owner's canvas: a CMS entry, a value a
   binding writes, an Embed. The canvas is the editor's origin, so each of these is rendered as
   inert words or cleaned markup — in the editor and in the published page alike. */
import { beforeEach, test } from 'vitest';
import a from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as C from '../app/src/core/index';

const XSS = '<img src=x onerror=alert(1)>';

beforeEach(() => {
  C.seed(); C.state.ui = C.initUi(); C.blankProject('Render safety');
  C.state.meta.collections = []; C.state.meta.components = [];
});

/** A detail-style list: one card per entry, with a WYSIWYG body bound to `field`. */
function cmsCard(type: 'text' | 'rich') {
  const col = C.collectionAdd('Notes')!;
  const body = C.fieldAdd(col.id, 'Body', type)!;
  const item = C.itemAdd(col.id)!;
  const text = C.N('text');
  const list = C.N('list', {}, {}, [C.N('column', {}, {}, [text])]);
  C.srcSet(list, col.id);
  C.bindSet(text, 'html', C.bindField(body.id));
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  return { col, body, item, text, list };
}
const both = (list: ReturnType<typeof C.N>) => [C.renderNode(list, { edit: true }), C.buildPage(C.state.pages[0])];

test('a CMS text value bound to a WYSIWYG renders as escaped words, in the canvas and on the page', () => {
  const { col, body, item, list } = cmsCard('text');
  C.itemSet(col.id, item.id, body.id, XSS + '\nsecond line');
  for (const html of both(list)) {
    a.doesNotMatch(html, /<img src=x/);
    a.match(html, /<p>&lt;img src=x onerror=alert\(1\)&gt;<br>second line<\/p>/);
  }
});

test('a rich CMS value bound to a WYSIWYG keeps its formatting and loses everything executable', () => {
  const { col, body, item, list } = cmsCard('rich');
  C.itemSet(col.id, item.id, body.id, `<p><strong>Bold</strong> <a href="https://example.test/">safe</a></p>${XSS}<a href="javascript:alert(1)">bad</a>`);
  for (const html of both(list)) {
    a.match(html, /<p><strong>Bold<\/strong> <a href="https:\/\/example.test\/">safe<\/a><\/p>/);
    a.doesNotMatch(html, /onerror|<img src=x|javascript:/);
  }
});

test('a component rich property bound to a CMS text field is escaped too', () => {
  const col = C.collectionAdd('Cabins')!;
  const blurb = C.fieldAdd(col.id, 'Blurb', 'text')!;
  const item = C.itemAdd(col.id)!;
  C.itemSet(col.id, item.id, blurb.id, XSS);
  const box = C.N('box', {}, {}, [C.N('text')]);
  const list = C.N('list', {}, {}, [box]); C.srcSet(list, col.id);
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  const cid = C.componentFromNode(box.id, 'Card')!;
  const def = C.findComponent(cid)!;
  const k = C.propAdd(cid, 'Description', 'rich', '<p>Default</p>')!;
  C.bindSet(def.node.children[0], 'html', { src: 'prop', path: k });
  C.bindSet(box, C.VAL + k, C.bindField(blurb.id));
  for (const html of both(list)) {
    a.doesNotMatch(html, /<img src=x/);
    a.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  }
  // An instance's own rich value is authored markup, and renders as it always has.
  C.bindSet(box, C.VAL + k, null);
  C.instSet(box, k, '<p><em>Own</em></p>');
  a.match(C.buildPage(C.state.pages[0]), /<p><em>Own<\/em><\/p>/);
});

test('a guess binds a WYSIWYG to rich text only, while choosing a text field by hand still works', () => {
  const col = C.collectionAdd('Posts')!;
  const summary = C.fieldAdd(col.id, 'Summary', 'text')!;
  const list = C.N('list', {}, {}, [C.N('column', {}, {}, [C.N('heading'), C.N('text')])]);
  C.srcSet(list, col.id);
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  const slots = C.bindSlots(list.id);
  const html = slots.find(s => s.key === 'html')!;
  a.equal(C.guessBindings(slots, col)[html.nodeId + '|html'], '', 'a text field is never guessed into a rich slot');
  a.ok(html.fieldTypes.includes('text'), 'the picker still offers it');
  // A name match is a guess too.
  const named = C.fieldAdd(col.id, 'Rich text', 'text')!;
  a.notEqual(C.guessBindings(C.bindSlots(list.id), col)[html.nodeId + '|html'], named.id);
  const body = C.fieldAdd(col.id, 'Body', 'rich')!;
  a.equal(C.guessBindings(C.bindSlots(list.id), col)[html.nodeId + '|html'], body.id);
  void summary;
});

test('stripScripts removes the handler, URL and srcdoc forms the old pattern let through', () => {
  for (const payload of [
    '<svg/onload=alert(1)>',
    '<img src="x"/onerror=alert(1)>',
    '<details/open/ontoggle=alert(1)>',
    '<img src="x"onerror=alert(1)>',
    '<IMG SRC=x ONERROR=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href=" JaVa&#x0A;ScRiPt&colon;alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
    '<form><button formaction="javascript:alert(1)">go</button></form>',
    '<svg><a><animate attributeName="href" values="javascript:alert(1)"/></a></svg>',
    '<!--><img src=x onerror=alert(1)>-->',
    '<script>alert(1)</script>',
  ]) {
    const { html, stripped } = C.stripScripts(payload);
    a.ok(stripped > 0, payload);
    a.doesNotMatch(html, /\son\w+=|javascript:|srcdoc|<script/i, `${payload} → ${html}`);
  }
  // Ordinary embed markup is untouched in substance.
  const map = '<iframe src="https://maps.example/embed?a=1&amp;b=2" width="600" height="450" style="border:0;" allowfullscreen loading="lazy"></iframe>';
  a.deepEqual(C.stripScripts(map), { html: map, stripped: 0 });
});

test('cleanRich keeps the toolbar allowlist and nothing else', () => {
  a.equal(C.cleanRich('<p>a<p>b'), '<p>a</p><p>b</p>');
  a.equal(C.cleanRich('<ul><li>a<li>b</ul>'), '<ul><li>a</li><li>b</li></ul>');
  a.equal(C.cleanRich('<b>open'), '<b>open</b>', 'nothing is left open to embolden the page');
  a.equal(C.cleanRich('<a href="//evil.test" target="_blank">x</a>'), '<a>x</a>');
  a.equal(C.cleanRich('<a href="/about">x</a> <a href="mailto:a@b.test">m</a>'), '<a href="/about">x</a> <a href="mailto:a@b.test">m</a>');
  a.equal(C.cleanRich('<style>p{}</style><span style="x">kept words</span> 1 < 2'), 'kept words 1 &lt; 2');
});

test('a target is "_blank" or nothing, whatever a binding writes into it', () => {
  const col = C.collectionAdd('Links')!;
  const t = C.fieldAdd(col.id, 'Target', 'text')!;
  const item = C.itemAdd(col.id)!;
  C.itemSet(col.id, item.id, t.id, '" onmouseover="alert(1)');
  const btn = C.N('button', { link: 'https://example.test/' });
  const list = C.N('list', {}, {}, [C.N('column', {}, {}, [btn])]);
  C.srcSet(list, col.id);
  C.bindSet(btn, 'target', C.bindField(t.id));
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  for (const html of both(list)) a.doesNotMatch(html, /onmouseover|target=/);
  C.itemSet(col.id, item.id, t.id, '_blank');
  for (const html of both(list)) a.match(html, /target="_blank" rel="noopener"/);
});

test('editor hooks and breadcrumb links are escaped', () => {
  const h = C.N('heading');
  h.id = 'n1" onclick="alert(1)';
  a.doesNotMatch(C.renderNode(h, { edit: true }), /" onclick=/);
  const crumbs = C.N('crumbs', { mode: 'manual', items: [{ label: 'Home', href: '/x" onmouseover="alert(1)' }, { label: 'Here', href: '' }] });
  const out = C.renderNode(crumbs, { edit: false });
  a.match(out, /<a href="\/x&quot; onmouseover=&quot;alert\(1\)">Home<\/a>/);
});

test('Preview on the canvas draws an Embed in a sandboxed frame; the export keeps it inline', () => {
  const embed = C.N('embed', { html: XSS + '<p>Widget</p>' });
  const exported = C.renderNode(embed, { edit: false });
  a.match(exported, /<img src=x onerror=alert\(1\)><p>Widget<\/p>/, 'the published page ships it verbatim');
  const preview = C.renderNode(embed, { edit: false, canvas: true });
  a.match(preview, /<iframe sandbox="allow-scripts" srcdoc="[^"]*&lt;img src=x onerror=alert\(1\)&gt;/);
  a.doesNotMatch(preview, /allow-same-origin/);
  a.doesNotMatch(preview.replace(/srcdoc="[^"]*"/, ''), /<img|onerror/, 'nothing of it is canvas markup');
});

test('the canvas policy runs only nonce-bearing scripts and the hashed embed reporter', () => {
  const csp = C.canvasCsp('abc123');
  a.match(csp, /script-src 'nonce-abc123' 'sha256-[^']+'/);
  a.match(csp, /object-src 'none'/);
  a.match(csp, /base-uri 'none'/);
  a.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  a.equal(C.EMBED_FRAME_HASH, 'sha256-' + createHash('sha256').update(C.EMBED_FRAME_JS).digest('base64'),
    'the hash in the policy is the hash of the script the frame runs');
});
