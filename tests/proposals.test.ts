/* Assistant proposals (Phase 7): the core checks a proposal against the document, says whether it
   can still be applied, and applies it with the same commands the editor uses. */
import { beforeEach, test } from 'vitest';
import a from 'node:assert/strict';
import * as C from '../app/src/core/index';
import type { ComponentDef, Node } from '../app/src/core/types';

const node = (id: string, type: string, props: Record<string, unknown> = {}, extra: Partial<Node> = {}): Node => ({
  id, type, props, css: { d: {}, t: {}, m: {} }, hide: {}, cls: [], adv: {}, children: [], ...extra,
} as unknown as Node);
const assets = new Set(['aphoto1', 'aphoto2']);

beforeEach(() => {
  C.seed(); C.state.ui = C.initUi(); C.blankProject('Acme');
  const card: ComponentDef = {
    id: 'card', name: 'Card',
    props: [
      { k: 'title', label: 'Title', t: 'text', def: 'Hello' },
      { k: 'body', label: 'Body', t: 'rich', def: '' },
      { k: 'photo', label: 'Photo', t: 'img', def: '' },
      { k: 'cta', label: 'Button link', t: 'link', def: '' },
      { k: 'tone', label: 'Tone', t: 'select', def: 'plain', opts: [['plain', 'Plain'], ['loud', 'Loud']] },
    ],
    node: node('def-root', 'box', {}, { children: [node('def-title', 'heading', { text: 'Hello' })] }),
  };
  C.state.meta.components = [card];
  const pg = C.state.pages[0];
  pg.slug = 'index';
  C.state.pages.push({ ...structuredClone(pg), id: 'about-page', name: 'About', slug: 'about', tree: [] });
  pg.tree = [node('sec', 'section', {}, { children: [
    node('h1', 'heading', { text: 'Welcome', level: 'h1' }),
    node('copy', 'text', { html: '<p>Old copy</p>' }),
    node('pic', 'image', { src: 'asset:aphoto1', alt: 'Old alt' }),
    node('inst', 'box', {}, { use: 'card' }),
    node('code', 'embed', { html: '<b>x</b>' }),
  ] })];
  C.hist.u.length = 0;
});
const page = () => C.state.pages[0];

test('text, rich text, images and properties are resolved to exact targets with what they replace', () => {
  const { changes, problems } = C.proposalPrepare([
    { type: 'text', nodeId: 'h1', value: 'Book a workshop' },
    { type: 'text', nodeId: 'copy', value: 'First line\n\n<script>alert(1)</script>' },
    { type: 'image', nodeId: 'pic', assetId: 'asset:aphoto2' },
    { type: 'text', nodeId: 'pic', slot: 'alt', value: 'Two people at a workbench' },
    { type: 'property', nodeId: 'inst', property: 'title', value: 'Pottery' },
    { type: 'property', nodeId: 'inst', property: 'cta', value: '/about' },
    { type: 'property', nodeId: 'inst', property: 'tone', value: 'loud' },
  ], { assets });
  a.deepEqual(problems, []);
  a.deepEqual(changes.map(ch => [ch.type, ch.region, ch.slot || ch.property, ch.before]), [
    ['text', page().id, 'text', 'Welcome'],
    ['text', page().id, 'html', '<p>Old copy</p>'],
    ['image', page().id, 'src', 'asset:aphoto1'],
    ['text', page().id, 'alt', 'Old alt'],
    ['property', page().id, 'title', 'Hello'],
    ['property', page().id, 'cta', ''],
    ['property', page().id, 'tone', 'plain'],
  ]);
  a.equal(changes[1].value, '<p>First line</p><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>', 'rich text is escaped into paragraphs');
  a.equal(changes[5].value, 'about.html', 'an internal link is stored the way links are');
  a.match(changes[0].label, /Heading “Welcome” · Text/);
});

test('applying is one Undo step, and Undo puts everything back', () => {
  const { changes } = C.proposalPrepare([
    { type: 'text', nodeId: 'h1', value: 'Book a workshop' },
    { type: 'property', nodeId: 'inst', property: 'title', value: 'Pottery' },
    { type: 'insert', componentId: 'card', region: 'about-page', index: 0, values: { title: 'Visit us', photo: 'aphoto2' } },
  ], { assets });
  a.deepEqual(C.proposalCheck(changes), ['ok', 'ok', 'ok']);
  let placed: string[] = [];
  const before = { mode: C.state.ui.mode, cur: C.state.cur };
  C.edit(() => { placed = C.proposalApply(changes); });
  a.equal(C.hist.u.length, 1);
  a.equal((C.locateAny('h1').node.props as { text: string }).text, 'Book a workshop');
  a.equal(C.locateAny('inst').node.vals.title, 'Pottery');
  const about = C.state.pages[1].tree;
  a.equal(placed.length, 1);
  const inserted = C.locateAny(placed[0]).node;
  a.equal(inserted.use, 'card');
  a.deepEqual(inserted.vals, { title: 'Visit us', photo: 'asset:aphoto2' });
  a.ok(about.length >= 1, 'the instance landed on the About page, wrapped as that page needs');
  a.deepEqual({ mode: C.state.ui.mode, cur: C.state.cur }, before, 'the editor’s scope is left as it was');

  C.undo();
  a.equal((C.locateAny('h1').node.props as { text: string }).text, 'Welcome');
  a.equal(C.locateAny('inst').node.vals, undefined);
  a.equal(C.state.pages[1].tree.length, 0);
});

test('a target that changed since the proposal is stale, and one that is gone is missing', () => {
  const { changes } = C.proposalPrepare([
    { type: 'text', nodeId: 'h1', value: 'New' },
    { type: 'image', nodeId: 'pic', assetId: 'aphoto2' },
    { type: 'property', nodeId: 'inst', property: 'title', value: 'Pottery' },
  ], { assets });
  (C.locateAny('h1').node.props as { text: string }).text = 'Edited by the owner';
  C.state.pages[0].tree[0].children = C.state.pages[0].tree[0].children.filter((n: Node) => n.id !== 'pic');
  a.deepEqual(C.proposalCheck(changes), ['stale', 'missing', 'ok']);
});

test('what a proposal cannot do is refused with a reason the assistant can act on', () => {
  const problems = (input: unknown) => C.proposalPrepare(input, { assets }).problems.join(' ');
  a.match(problems([]), /at least one change/);
  a.match(problems(Array.from({ length: 51 }, () => ({ type: 'text', nodeId: 'h1', value: 'x' }))), /at most 50/);
  a.match(problems([{ type: 'text', nodeId: 'nope', value: 'x' }]), /no element "nope"/);
  a.match(problems([{ type: 'text', nodeId: 'def-title', value: 'x' }]), /no element "def-title"/, 'component definitions are not addressable');
  a.match(problems([{ type: 'text', nodeId: 'code', value: 'x' }]), /embedded code/);
  a.match(problems([{ type: 'text', nodeId: 'h1', slot: 'level', value: 'h2' }]), /no text "level"/);
  a.match(problems([{ type: 'image', nodeId: 'pic', assetId: 'https://evil.example/x.png' }]), /doesn't have/);
  a.match(problems([{ type: 'property', nodeId: 'h1', property: 'x', value: '' }]), /not a component instance/);
  a.match(problems([{ type: 'property', nodeId: 'inst', property: 'tone', value: 'neon' }]), /must be one of: plain, loud/);
  a.match(problems([{ type: 'property', nodeId: 'inst', property: 'cta', value: 'javascript:alert(1)' }]), /must be a page of this site/);
  a.match(problems([{ type: 'text', nodeId: 'h1', value: 'a' }, { type: 'text', nodeId: 'h1', value: 'b' }]), /same text twice/);
  a.match(problems([{ type: 'insert', componentId: 'ghost', region: 'about-page' }]), /no component "ghost"/);
  a.match(problems([{ type: 'insert', componentId: 'card', region: 'nowhere' }]), /not a page id/);
  a.match(problems([{ type: 'publish' }]), /not a change a proposal can make/);
  // One bad change refuses the whole proposal: nothing is half-prepared.
  a.deepEqual(C.proposalPrepare([{ type: 'text', nodeId: 'h1', value: 'ok' }, { type: 'text', nodeId: 'nope', value: 'x' }], { assets }).changes, []);
});

test('rich text takes bold, italic, safe links and lists, and nothing else', () => {
  const prepare = (value: string) => C.proposalPrepare([{ type: 'text', nodeId: 'copy', value }], { assets });
  const ok = prepare('Make it **bold**, *calm* and [visit us](/about).\n\n- One\n- Two [site](https://example.com/a?b=1&c=2)');
  a.deepEqual(ok.problems, []);
  a.equal(ok.changes[0].value,
    '<p>Make it <strong>bold</strong>, <em>calm</em> and <a href="about.html">visit us</a>.</p>'
    + '<ul><li>One</li><li>Two <a href="https://example.com/a?b=1&amp;c=2">site</a></li></ul>');
  a.equal(prepare('<b>x</b> <a href="javascript:alert(1)">y</a>').changes[0].value, '<p>&lt;b&gt;x&lt;/b&gt; &lt;a href=&quot;javascript:alert(1)&quot;&gt;y&lt;/a&gt;</p>',
    'HTML is shown, never run');
  a.match(prepare('[bad](javascript:alert(1))').problems.join(' '), /the link “javascript:alert\(1” must be a page of this site/);
  a.equal(prepare('a*b*c and 2 * 3 * 4').changes[0].value, '<p>a*b*c and 2 * 3 * 4</p>', 'stray asterisks stay asterisks');

  // A rich component property formats the same way; a plain one keeps the asterisks.
  C.state.meta.components![0].props.push({ k: 'note', label: 'Note', t: 'text', def: '' });
  const props = C.proposalPrepare([
    { type: 'property', nodeId: 'inst', property: 'body', value: '**Open** daily' },
    { type: 'property', nodeId: 'inst', property: 'note', value: '**Open** daily' },
  ], { assets });
  a.deepEqual(props.changes.map(ch => ch.value), ['<p><strong>Open</strong> daily</p>', '**Open** daily']);
});

test('reading a page gives rich text back as the same markdown', () => {
  (C.locateAny('copy').node.props as { html: string }).html = '<p>Hello <strong>there</strong></p><ul><li>One</li><li><a href="about.html">Two</a></li></ul>';
  const copy = C.proposalOutline(C.state.pages[0].id)!.find(e => e.id === 'copy') as { text: { html: string }; formatting: string };
  a.equal(copy.text.html, 'Hello **there**\n\n- One\n- [Two](about.html)');
  a.match(copy.formatting, /\*\*bold\*\*/);
  // Round trip: sending it back unchanged writes the same formatting.
  const again = C.proposalPrepare([{ type: 'text', nodeId: 'copy', value: copy.text.html }], { assets });
  a.equal(again.changes[0].value, '<p>Hello <strong>there</strong></p><ul><li>One</li><li><a href="about.html">Two</a></li></ul>');
});
