import { beforeEach, test } from 'vitest';
import a from 'node:assert/strict';
import * as C from '../app/src/core/index';
import {
  LibraryError, bundleItemCount, extractLibraryBundle, importCustomCode, itemHash, planLibraryImport, planLibraryUpdate,
  previewLibraryUpdate, remapBundleAssets, sha256,
  type LibraryBundle,
} from '../app/src/core/libraries';
import type { ComponentDef, Doc, Node } from '../app/src/core/types';

let seq = 0;
const newId = () => `fresh-${++seq}`;
const source = (version: number) => ({ libraryId: 'lib-1', version });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

beforeEach(() => { seq = 0; });

/** A blank site straight from the real core, so default tokens are the ones every site has. */
function blankSite(name = 'Site'): Doc {
  C.seed(); C.state.ui = C.initUi(); C.blankProject(name);
  C.state.meta.components = []; C.state.meta.blocks = []; C.state.meta.collections = [];
  return clone(C.doc());
}
const node = (id: string, type: string, extra: Partial<Node> = {}): Node => ({
  id, type, props: {}, css: {}, hide: {}, cls: [], adv: {}, children: [], ...extra,
} as unknown as Node);

/* The author's site: a Card component using a class, a colour, a text style, a nested Badge
   component and an image, with a variant and a slot. */
function authorSite() {
  const doc = blankSite('Author');
  doc.meta.tokens!.colors.push({ id: 'accent', name: 'Accent', value: '#c05621' });
  doc.meta.tokens!.classes.push({ id: 'shadow', name: 'Shadow', css: { d: { 'box-shadow': '0 2px 6px var(--c-accent)' } } as never });
  const badge: ComponentDef = { id: 'badge', name: 'Badge', props: [{ k: 'label', label: 'Label', t: 'text', def: 'New' }],
    node: node('b1', 'text', { props: { text: 'New' } as never, css: { d: { color: 'var(--c-brand)' } } as never }) };
  const card: ComponentDef = {
    id: 'card', name: 'Card',
    props: [{ k: 'title', label: 'Title', t: 'text', def: 'Hello' }, { k: 'tone', label: 'Tone', t: 'text', def: 'plain' }],
    variants: [{ id: 'loud', name: 'Loud', values: { tone: 'loud' } }],
    node: node('c1', 'box', {
      cls: ['shadow'],
      css: { d: { background: 'url(asset:a0123456789ab)' } } as never,
      children: [
        node('c2', 'heading', { props: { ts: 'title', text: 'Hello' } as never, bind: { text: { src: 'prop', path: 'title' } } }),
        node('c3', 'box', { use: 'badge' }),
        node('c4', 'box', { slot: 'body' }),
      ],
    }),
  };
  doc.meta.components = [badge, card];
  doc.meta.blocks = [{ id: 'hero', name: 'Hero', node: node('h1', 'box', { children: [node('h2', 'box', { use: 'card' })] }) }];
  return doc;
}
const bundleOf = (doc = authorSite()) => extractLibraryBundle(doc, [{ kind: 'component', id: 'card' }], C.SCHEMA);
const assets = { a0123456789ab: 'a9999999999ff' };

test('sha256 matches the published test vectors', () => {
  a.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  a.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  a.equal(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  a.equal(sha256('é'.repeat(100)).length, 64);
});

test('a bundle carries the chosen item and everything it depends on, hashed without node ids', () => {
  const bundle = bundleOf();
  a.deepEqual(bundle.components.map(c => c.id).sort(), ['badge', 'card']);
  a.deepEqual(bundle.classes.map(c => c.id), ['shadow']);
  // accent through the class, brand through the badge, ink through the site's Title style
  a.deepEqual(bundle.colors.map(c => c.id).sort(), ['accent', 'brand', 'ink']);
  a.deepEqual(bundle.textStyles.map(t => t.id), ['title']);
  a.deepEqual(bundle.assets, ['a0123456789ab']);
  a.deepEqual(bundle.blocks, [], 'only what the card needs, not the whole site');
  for (const k of ['component:card', 'component:badge', 'class:shadow', 'color:accent', 'textStyle:title']) a.match(bundle.hashes[k], /^[0-9a-f]{64}$/);

  const renumbered = authorSite();
  renumbered.meta.components!.find(c => c.id === 'card')!.node.id = 'something-else';
  a.equal(bundleOf(renumbered).hashes['component:card'], bundle.hashes['component:card'], 'node ids are local, not content');
});

test('publishing refuses CMS bindings and missing items with a readable reason', () => {
  const doc = authorSite();
  doc.meta.components!.find(c => c.id === 'badge')!.node.bind = { text: { src: 'field', path: 'title' } };
  a.throws(() => bundleOf(doc), (e: unknown) => e instanceof LibraryError && /badge.*CMS field title/.test(e.message));
  a.throws(() => extractLibraryBundle(authorSite(), [{ kind: 'component', id: 'nope' }], C.SCHEMA), /Missing component "nope"/);
});

test('import makes locally owned copies with fresh node ids, records links and rewrites images', () => {
  const bundle = bundleOf();
  const site = blankSite('Recipient');
  const plan = planLibraryImport(site, bundle, source(1), [{ kind: 'component', id: 'card' }], { assets, newId });
  const card = plan.doc.meta.components!.find(c => c.id === 'card')!;
  a.ok(card, 'card arrives under its own id');
  a.ok(plan.doc.meta.components!.find(c => c.id === 'badge'), 'its nested component comes with it');
  a.ok(plan.doc.meta.tokens!.classes.find(c => c.id === 'shadow'));
  a.match(card.node.id, /^fresh-/);
  a.equal(JSON.stringify(card).includes('asset:a9999999999ff'), true);
  a.equal(JSON.stringify(card).includes('a0123456789ab'), false);

  const how = Object.fromEntries(plan.items.map(i => [`${i.kind}:${i.sourceId}`, i.how]));
  a.equal(how['textStyle:title'], 'site-foundation', "the site's own Title style is used, not duplicated");
  a.equal(how['color:brand'], 'site-foundation');
  a.equal(plan.doc.meta.tokens!.text.filter(t => t.id === 'title').length, 1);
  a.deepEqual(plan.doc.meta.libraryLinks!.map(l => `${l.kind}:${l.localId}@${l.version}`).sort(),
    ['class:shadow@1', 'color:accent@1', 'component:badge@1', 'component:card@1']);
  a.deepEqual(site.meta.libraryLinks, undefined, 'the input document is never mutated');
});

test('an id already used for something else is renamed, and every reference follows it', () => {
  const site = blankSite('Recipient');
  site.meta.components = [{ id: 'badge', name: 'Their own badge', props: [], node: node('x1', 'text') }];
  site.meta.tokens!.colors.push({ id: 'accent', name: 'Accent', value: '#c05621' }); // identical: reused
  const plan = planLibraryImport(site, bundleOf(), source(1), [{ kind: 'component', id: 'card' }], { assets, newId });
  const how = Object.fromEntries(plan.items.map(i => [`${i.kind}:${i.sourceId}`, `${i.how}:${i.localId}`]));
  a.equal(how['component:badge'], 'renamed:badge-2');
  a.equal(how['color:accent'], 'reused:accent');
  a.equal(plan.doc.meta.tokens!.colors.filter(c => c.id === 'accent').length, 1, 'identical tokens are not duplicated');
  const card = plan.doc.meta.components!.find(c => c.id === 'card')!;
  a.equal(card.node.children[1].use, 'badge-2', 'the nested instance points at the renamed copy');
  a.equal(plan.doc.meta.components!.find(c => c.id === 'badge')!.name, 'Their own badge', 'the site keeps its own');
});

test('images must be copied into the site before the document can refer to them', () => {
  a.throws(() => planLibraryImport(blankSite(), bundleOf(), source(1), [{ kind: 'component', id: 'card' }], { newId }),
    /Copy these images into the site first: a0123456789ab/);
  a.throws(() => planLibraryImport(blankSite(), bundleOf(), source(1), [{ kind: 'block', id: 'hero' }], { assets, newId }),
    /no block "hero"/);
});

test('importing again keeps the site copy and its link untouched', () => {
  const first = planLibraryImport(blankSite(), bundleOf(), source(1), [{ kind: 'component', id: 'card' }], { assets, newId }).doc;
  first.meta.components!.find(c => c.id === 'card')!.name = 'Card (edited here)';
  const before = clone(first.meta.libraryLinks);
  const again = planLibraryImport(first, bundleOf(), source(1), [{ kind: 'component', id: 'card' }], { assets, newId });
  a.equal(again.items.find(i => i.sourceId === 'card')!.how, 'linked');
  a.deepEqual(again.doc.meta.libraryLinks, before);
  a.equal(again.doc.meta.components!.filter(c => c.name.startsWith('Card')).length, 1);
});

/* ---- updates ---- */

function imported() {
  const doc = planLibraryImport(blankSite(), bundleOf(), source(1), [{ kind: 'component', id: 'card' }], { assets, newId }).doc;
  // A placement with its own values, a variant and slot content: all of it belongs to the site.
  doc.pages[0].tree.push(node('p1', 'box', { use: 'card', vals: { title: 'Mine' }, variant: 'loud', children: [node('p2', 'text', { slot: 'body' })] }));
  return doc;
}
function version2(edit: (doc: Doc) => void) {
  const doc = authorSite();
  edit(doc);
  return bundleOf(doc);
}

test('an item changed only upstream updates, and placements keep their own content', () => {
  const next = version2(doc => { doc.meta.components!.find(c => c.id === 'card')!.props[0].def = 'Welcome'; });
  const plan = planLibraryUpdate(imported(), next, source(2), {}, { assets, newId });
  a.equal(plan.items.find(i => i.sourceId === 'card')!.action, 'update');
  a.equal(plan.items.find(i => i.sourceId === 'badge')!.action, 'none');
  a.deepEqual(plan.unresolved, []);
  const card = plan.doc!.meta.components!.find(c => c.id === 'card')!;
  a.equal(card.props[0].def, 'Welcome');
  const placement = plan.doc!.pages[0].tree.find(n => n.id === 'p1')!;
  a.deepEqual(placement.vals, { title: 'Mine' });
  a.equal(placement.variant, 'loud');
  a.equal(placement.children[0].id, 'p2');
  const link = plan.doc!.meta.libraryLinks!.find(l => l.sourceId === 'card')!;
  a.equal(link.version, 2);
  a.equal(link.sourceHash, next.hashes['component:card']);
  a.equal(link.localHash, itemHash('component', card));
});

test('an item changed on both sides is a conflict that must be resolved', () => {
  const site = imported();
  site.meta.components!.find(c => c.id === 'card')!.name = 'Card (ours)';
  const next = version2(doc => { doc.meta.components!.find(c => c.id === 'card')!.name = 'Card (theirs)'; });

  const waiting = planLibraryUpdate(site, next, source(2), {}, { assets, newId });
  a.equal(waiting.items.find(i => i.sourceId === 'card')!.action, 'conflict');
  a.deepEqual(waiting.unresolved, ['component:card']);
  a.equal(waiting.doc, null, 'nothing is written while a conflict is open');

  const mine = planLibraryUpdate(site, next, source(2), { 'component:card': 'mine' }, { assets, newId }).doc!;
  a.equal(mine.meta.components!.find(c => c.id === 'card')!.name, 'Card (ours)');
  const mineLink = mine.meta.libraryLinks!.find(l => l.sourceId === 'card')!;
  a.equal(mineLink.version, 2);
  a.notEqual(itemHash('component', mine.meta.components!.find(c => c.id === 'card')!), mineLink.localHash, 'still counted as changed here');

  const theirs = planLibraryUpdate(site, next, source(2), { 'component:card': 'theirs' }, { assets, newId }).doc!;
  a.equal(theirs.meta.components!.find(c => c.id === 'card')!.name, 'Card (theirs)');
});

test('removed items are unlinked, never deleted', () => {
  const site = imported();
  site.meta.tokens!.classes = site.meta.tokens!.classes.filter(c => c.id !== 'shadow'); // deleted here
  const next = version2(doc => {
    const card = doc.meta.components!.find(c => c.id === 'card')!;
    card.node.children = card.node.children.filter(n => n.use !== 'badge');
    doc.meta.components = doc.meta.components!.filter(c => c.id !== 'badge'); // gone upstream
  });
  const plan = planLibraryUpdate(site, next, source(2), {}, { assets, newId });
  const why = Object.fromEntries(plan.items.map(i => [i.sourceId, `${i.action}:${i.reason}`]));
  a.equal(why.badge, 'unlink:upstream-removed');
  a.equal(why.shadow, 'unlink:deleted-here');
  a.ok(plan.doc!.meta.components!.find(c => c.id === 'badge'), 'the site keeps its badge');
  a.equal(plan.doc!.meta.libraryLinks!.some(l => l.sourceId === 'badge' || l.sourceId === 'shadow'), false);
});

test('an update warns before it drops a variant, a property or slot content', () => {
  const next = version2(doc => {
    const card = doc.meta.components!.find(c => c.id === 'card')!;
    card.variants = [];
    card.props = card.props.filter(p => p.k !== 'title');
    card.node.children = card.node.children.filter(n => n.slot !== 'body');
  });
  const card = planLibraryUpdate(imported(), next, source(2), {}, { assets, newId }).items.find(i => i.sourceId === 'card')!;
  a.equal(card.warnings.length, 3);
  a.match(card.warnings.join(' '), /variant.*property.*slot/s);
});

test('dependencies new in the update are brought in as an import would', () => {
  const next = version2(doc => {
    doc.meta.tokens!.classes.push({ id: 'rounded', name: 'Rounded', css: { d: { 'border-radius': '12px' } } as never });
    doc.meta.components!.find(c => c.id === 'card')!.node.cls.push('rounded');
  });
  const plan = planLibraryUpdate(imported(), next, source(2), {}, { assets, newId });
  a.ok(plan.doc!.meta.tokens!.classes.find(c => c.id === 'rounded'));
  a.ok(plan.doc!.meta.libraryLinks!.find(l => l.sourceId === 'rounded' && l.version === 2));
});

test('links survive a build that does not know about libraries', () => {
  const doc = imported();
  const reopened = C.migrate(JSON.parse(JSON.stringify({ ...doc, schemaVersion: C.SCHEMA })));
  a.ok(reopened);
  a.deepEqual(reopened!.meta.libraryLinks, doc.meta.libraryLinks);
});

test('a bundle is plain data that round-trips through JSON', () => {
  const bundle: LibraryBundle = bundleOf();
  a.deepEqual(JSON.parse(JSON.stringify(bundle)), bundle);
});

test('publishing swaps site image ids for content hashes, and equal content keeps equal hashes', () => {
  const hash = 'f'.repeat(64);
  const published = remapBundleAssets(bundleOf(), { a0123456789ab: hash });
  a.deepEqual(published.assets, [hash]);
  a.equal(JSON.stringify(published).includes('a0123456789ab'), false);
  a.match(JSON.stringify(published.components.find(c => c.id === 'card')), new RegExp(`asset:${hash}`));
  a.notEqual(published.hashes['component:card'], bundleOf().hashes['component:card'], 'the hash follows the content');
  a.equal(published.hashes['component:badge'], bundleOf().hashes['component:badge'], 'items without images are unchanged');

  // The same image uploaded to another site under a different id publishes identically.
  const elsewhere = authorSite();
  const card = elsewhere.meta.components!.find(c => c.id === 'card')!;
  card.node.css = { d: { background: 'url(asset:a0000000000ee)' } } as never;
  const again = remapBundleAssets(bundleOf(elsewhere), { a0000000000ee: hash });
  a.equal(again.hashes['component:card'], published.hashes['component:card']);
  a.equal(bundleItemCount(published), 7, "card, badge, shadow, accent, brand, ink, title");
  a.throws(() => remapBundleAssets(bundleOf(), {}), /No library copy for images: a0123456789ab/);
});

/* A library can be published by anyone and shared with anyone, so its bundle is untrusted: what
   becomes markup is cleaned on the way in, and custom code is reported rather than slipped in. */
const XSS = '<img src=x onerror=alert(1)>';
const BAD_CLASS = 'x" onmouseover="alert(1)';
const BAD_STYLE = 'y"><img src=x onerror=alert(1)>';
function hostileBundle(withEmbed = true) {
  const doc = blankSite('Hostile');
  doc.meta.tokens!.classes.push({ id: BAD_CLASS, name: 'Evil class', css: { d: { color: 'red' } } as never });
  doc.meta.tokens!.text.push({ id: BAD_STYLE, name: 'Evil style', css: { d: {}, t: {}, m: {} } as never });
  const promo: ComponentDef = {
    id: 'promo', name: XSS,
    props: [{ k: 'body', label: 'Body', t: 'rich', def: `<p>Hi</p>${XSS}` }, { k: 'go', label: 'Go', t: 'link', def: 'javascript:alert(1)' }],
    variants: [{ id: 'loud', name: 'Loud', values: { body: `<p>Loud</p>${XSS}`, go: 'javascript:alert(2)' } }],
    node: node('r', 'box', {
      cls: [BAD_CLASS],
      props: { link: 'javascript:alert(1)', target: '" onmouseover="alert(1)' } as never,
      children: [
        node('t', 'text', { props: { html: `<p>Words</p>${XSS}`, ts: BAD_STYLE } as never }),
        node('c', 'crumbs', { props: { mode: 'manual', items: [{ label: 'Home', href: 'javascript:alert(1)', target: '"x' }, { label: 'Here', href: '' }] } as never }),
        ...(withEmbed ? [node('e', 'embed', { props: { html: '<script>steal()</script>' } as never })] : []),
      ],
    }),
  };
  doc.meta.components = [promo];
  return extractLibraryBundle(doc, [{ kind: 'component', id: 'promo' }], C.SCHEMA);
}

test('an import cleans what becomes markup: rich text, links, targets and unsafe ids', () => {
  const bundle = hostileBundle();
  const plan = planLibraryImport(blankSite('Owner'), bundle, source(1), [{ kind: 'component', id: 'promo' }], { newId });
  const doc = plan.doc;
  const cls = doc.meta.tokens!.classes.find(c => c.name === 'Evil class')!;
  const ts = doc.meta.tokens!.text.find(t => t.name === 'Evil style')!;
  a.match(cls.id, /^[a-z0-9][a-z0-9_-]*$/);
  a.match(ts.id, /^[a-z0-9][a-z0-9_-]*$/);
  a.ok(plan.items.some(i => i.kind === 'class' && i.sourceId === BAD_CLASS && i.how === 'renamed'));
  const promo = doc.meta.components!.find(c => c.id === 'promo')!;
  a.deepEqual(promo.node.cls, [cls.id], 'references follow the new id');
  const [text, crumbs, embed] = promo.node.children;
  a.equal((text.props as { ts: string }).ts, ts.id);
  a.equal((text.props as { html: string }).html, '<p>Words</p>');
  a.equal(promo.props[0].def, '<p>Hi</p>');
  a.equal(promo.props[1].def, '');
  a.deepEqual(promo.variants![0].values, { body: '<p>Loud</p>', go: '' });
  a.deepEqual(promo.node.props, { link: '', target: '' });
  a.deepEqual((crumbs.props as { items: unknown[] }).items[0], { label: 'Home', href: '', target: '' });
  a.equal(promo.name, XSS, 'a name stays plain text; everything that shows one escapes it');
  a.equal((embed.props as { html: string }).html, '<script>steal()</script>', 'an Embed is code by design: reported, not rewritten');

  // and placed on a page, nothing of it can run in the canvas
  C.restore(doc);
  C.state.pages[0].tree = [node('p1', 'box', { use: 'promo' })];
  const html = C.renderNode(C.state.pages[0].tree[0], { edit: true });
  a.doesNotMatch(html, /\son\w+=|<img|javascript:|<script/);
  a.equal((html.match(/"/g) || []).length % 2, 0, 'no attribute was broken open');
});

test('an import and an update report the Embeds they would bring, before anything is copied', () => {
  const bundle = hostileBundle();
  const chosen = [{ kind: 'component' as const, id: 'promo' }];
  const expected = [{ kind: 'component', id: 'promo', name: XSS, embeds: 1 }];
  a.deepEqual(importCustomCode(bundle, chosen), expected);
  a.deepEqual(planLibraryImport(blankSite('Owner'), bundle, source(1), chosen, { newId }).customCode, expected);
  a.deepEqual(importCustomCode(hostileBundle(false), chosen), []);

  // Version 1 had no embed; version 2 adds one to an item this site already took.
  const site = planLibraryImport(blankSite('Owner'), hostileBundle(false), source(1), chosen, { newId }).doc;
  a.deepEqual(previewLibraryUpdate(site, bundle, source(2)).customCode, expected);
  const plan = planLibraryUpdate(site, bundle, source(2), {}, { newId });
  a.deepEqual(plan.customCode, expected);
  // Taken from upstream, the update is cleaned exactly as an import is.
  const promo = plan.doc!.meta.components!.find(c => c.id === 'promo')!;
  a.doesNotMatch(JSON.stringify([promo.props, promo.variants, promo.node.props, promo.node.children[0]]), /<img|javascript:/);
});

