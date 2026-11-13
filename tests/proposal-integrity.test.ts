import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Node } from '../app/src/core/types';

const assets = new Set(['site-photo']);
const prepare = (changes: unknown[]) => C.proposalPrepare(changes, { assets });
const outline = (region: string, id: string) => C.proposalOutline(region)!.find(node => node.id === id);
const proposalId = '17be2a9c';
const node = (id: string, type: string, props = {}, children: Node[] = []): Node => ({
  ...C.N(type, props, {}, children), id
});

beforeEach(() => {
  C.seed();
  C.state.ui = C.initUi();
  const home = C.blankProject('Field Notes');
  home.tree = [node('home-section', 'section', {}, [node('home-title', 'heading', { text: 'Welcome' })])];
  C.state.pages.push({ ...home, id: 'about', name: 'About', slug: 'about', tree: [] });
  C.state.meta.components = [
    { id: 'title', name: 'Title', node: node('title-def', 'heading', { text: 'New title' }), props: [] },
    { id: 'card', name: 'Card', node: node('card-def', 'box'), props: [] },
    { id: 'frame', name: 'Frame', node: node('frame-def', 'section'), props: [] }
  ];
});

test('a slotless instance on another page offers no insertion or ghost content target', () => {
  const ghost = node('ghost', 'heading', { text: 'Stored fallback' });
  const frame = { ...node('frame', 'section', {}, [ghost]), use: 'frame' };
  C.state.pages[1].tree.push(frame);
  expect(outline('about', frame.id)).not.toHaveProperty('canHold');
  expect(outline('about', ghost.id)).toBeUndefined();

  const before = structuredClone(C.doc());
  const result = prepare([
    { type: 'insert', componentId: 'title', region: 'about', parentId: frame.id },
    { type: 'text', nodeId: 'home-title', value: 'Still waiting' }
  ]);
  expect(result.problems).toEqual([expect.stringContaining('cannot go inside Frame')]);
  expect(result.changes).toEqual([]);
  expect(C.doc()).toEqual(before);
});

test('an off-page instance exposes its first named slot, validates its actual type and preserves other slots', () => {
  const lead = { ...node('lead-row', 'row'), slot: 'lead' };
  const aside = { ...node('aside-box', 'box'), slot: 'aside' };
  C.findComponent('frame')!.node.children.push(lead, aside);
  const earlier = { ...node('earlier', 'column'), slot: 'lead' };
  const otherSlot = { ...node('existing-aside', 'heading', { text: 'Kept aside' }), slot: 'aside' };
  const frame = { ...node('frame', 'section', {}, [otherSlot, earlier]), use: 'frame' };
  C.state.pages[1].tree.push(frame);
  expect(outline('about', frame.id)).toMatchObject({ placementSlot: 'lead', canHold: ['title'] });
  expect(prepare([{ type: 'insert', componentId: 'card', region: 'about', parentId: frame.id }]).changes).toEqual([]);
  const { changes, problems } = prepare([{ type: 'insert', componentId: 'title', region: 'about', parentId: frame.id, index: 0 }]);
  expect(problems).toEqual([]);
  const [id] = C.proposalApply(changes, proposalId);
  expect(frame.children.map(child => [child.id, child.slot])).toEqual([
    [otherSlot.id, 'aside'], [id + 'w3', 'lead'], [earlier.id, 'lead']
  ]);
  expect(frame.children[1].children[0]).toMatchObject({ id, use: 'title' });
  expect(C.proposalCheck(changes, proposalId)).toEqual(['applied']);
  expect(C.renderNode(frame, { edit: true })).toContain('New title');
  expect(C.renderNode(frame, { edit: true })).toContain('Kept aside');
  expect(C.proposalOutline(C.state.pages[0].id)?.some(entry => entry.id === id)).toBe(false);
});

test('filling the default slot cannot hide content already placed in a nested named slot', () => {
  const nested = { ...node('nested-slot', 'box'), slot: 'details' };
  const first = { ...node('first-slot', 'row', {}, [node('column', 'column', {}, [nested])]), slot: 'lead' };
  C.findComponent('frame')!.node.children.push(first);
  const detail = { ...node('detail', 'heading', { text: 'Current detail' }), slot: 'details' };
  const frame = { ...node('frame', 'section', {}, [detail]), use: 'frame' };
  C.state.pages[1].tree.push(frame);
  expect(outline('about', frame.id)).not.toHaveProperty('canHold');
  expect(outline('about', detail.id)).toMatchObject({ text: { text: 'Current detail' } });
  expect(prepare([{ type: 'insert', componentId: 'title', region: 'about', parentId: frame.id }]).changes).toEqual([]);
  expect(C.renderNode(frame, { edit: true })).toContain('Current detail');
});

test('root inserts in different regions have deterministic wrapper IDs and one consistent sibling order', () => {
  const before = structuredClone(C.doc());
  const { changes, problems } = prepare([
    { type: 'insert', componentId: 'title', region: 'about' },
    { type: 'insert', componentId: 'title', region: 'about' },
    { type: 'insert', componentId: 'title', region: 'footer' }
  ]);
  expect(problems).toEqual([]);
  const expectedIds = changes.map((_, index) => C.proposalNodeId(proposalId, index));
  expect(C.proposalApply(changes, proposalId)).toEqual(expectedIds);
  const after = structuredClone(C.doc());
  expect(after.pages[1].tree.map(wrapper => wrapper.id)).toEqual(expectedIds.slice(0, 2).map(id => id + 'w1'));
  expect(after.footer[0].children[0].children[0].id).toBe(expectedIds[2] + 'w3');
  C.restore(structuredClone(before));
  expect(C.proposalApply(changes, proposalId)).toEqual(expectedIds);
  expect(C.doc()).toEqual(after);
});

test('parent reordering, moved targets, and unverifiable legacy inserts refuse the whole batch', () => {
  const about = C.state.pages[1];
  const parent = node('destination', 'section');
  about.tree.push(parent, node('other', 'section'));
  const { changes, problems } = prepare([
    { type: 'text', nodeId: 'home-title', value: 'Still waiting' },
    { type: 'insert', componentId: 'title', region: 'about', parentId: parent.id }
  ]);
  expect(problems).toEqual([]);
  about.tree.reverse();
  expect(C.proposalCheck(changes, proposalId)).toEqual(['ok', 'stale']);
  expect(C.proposalApply(changes, proposalId)).toEqual([]);
  expect(outline(C.state.pages[0].id, 'home-title')).toMatchObject({ text: { text: 'Welcome' } });
  expect(parent.children).toEqual([]);

  about.tree.reverse();
  const legacy = { ...changes[1], placement: undefined };
  expect(C.proposalCheck([legacy], proposalId)).toEqual(['stale']);
  C.state.footer.push(about.tree.shift()!);
  expect(C.proposalCheck(changes, proposalId)).toEqual(['ok', 'stale']);
  expect(C.proposalApply(changes, proposalId)).toEqual([]);
  expect(parent.children).toEqual([]);
});

test('outline hides definition and CMS fallback values while describing editable property ownership', () => {
  const def = C.findComponent('title')!;
  def.props = [
    { k: 'default-copy', label: 'Default', t: 'text', def: 'Defined value' },
    { k: 'variant-copy', label: 'Variant', t: 'text', def: '' },
    { k: 'own-copy', label: 'Own', t: 'text', def: '' },
    { k: 'bound-copy', label: 'Bound', t: 'text', def: 'Hidden property fallback' }
  ];
  def.variants = [{ id: 'second', name: 'Second', values: { 'variant-copy': 'Variant value' } }];
  const instance = { ...node('instance', 'heading', { text: 'Hidden root fallback' }), use: 'title',
    vals: { 'own-copy': 'Own value' }, variant: 'second' };
  const bound = node('bound', 'image', { src: 'asset:old-photo', alt: 'Alt' });
  C.bindSet(instance, C.VAL + 'bound-copy', C.bindField('item-title'));
  C.bindSet(bound, 'src', C.bindField('item-image'));
  const home = C.state.pages[0];
  home.tree[0].children.push(instance, bound);

  expect(outline(home.id, instance.id)).not.toHaveProperty('text');
  expect(outline(home.id, instance.id)).toMatchObject({ component: {
    values: { 'default-copy': 'Defined value', 'variant-copy': 'Variant value', 'own-copy': 'Own value' },
    propertySources: {
      'default-copy': { source: 'default' }, 'variant-copy': { source: 'variant', variantId: 'second' },
      'own-copy': { source: 'override' }, 'bound-copy': { source: 'binding', src: 'field', path: 'item-title' }
    }
  } });
  expect(JSON.stringify(outline(home.id, instance.id))).not.toContain('Hidden');
  expect(outline(home.id, bound.id)).not.toHaveProperty('images');
  expect(outline(home.id, bound.id)).toMatchObject({ text: { alt: 'Alt' }, boundSlots: { src: { src: 'field', path: 'item-image' } } });
  for (const input of [
    { type: 'text', nodeId: instance.id, value: 'Wrong owner' },
    { type: 'property', nodeId: instance.id, property: 'bound-copy', value: 'Wrong owner' },
    { type: 'image', nodeId: bound.id, assetId: 'site-photo' }
  ]) expect(prepare([input]).changes).toEqual([]);
  expect(prepare([{ type: 'property', nodeId: instance.id, property: 'default-copy', value: 'Own now' }]).problems).toEqual([]);
  expect(prepare([{ type: 'text', nodeId: bound.id, slot: 'alt', value: 'New alt' }]).problems).toEqual([]);
});

test('new bindings and stable navigation row reorders invalidate previously accepted content changes', () => {
  const nav = node('nav', 'nav', { items: [{ id: 'first', label: 'Workshop' }, { id: 'second', label: 'Workshop' }] });
  const home = C.state.pages[0];
  const heading = home.tree[0].children[0];
  home.tree[0].children.push(nav);
  const { changes, problems } = prepare([
    { type: 'text', nodeId: heading.id, value: 'New title' },
    { type: 'text', nodeId: nav.id, slot: 'items.0.label', value: 'Course' }
  ]);
  expect(problems).toEqual([]);
  C.bindSet(heading, 'text', C.bindField('item-title'));
  (nav.props.items as any[]).reverse();
  expect(C.proposalCheck(changes, proposalId)).toEqual(['stale', 'stale']);
  expect(C.proposalApply(changes, proposalId)).toEqual([]);
  expect(heading.props.text).toBe('Welcome');
  expect(nav.props.items).toEqual([{ id: 'second', label: 'Workshop' }, { id: 'first', label: 'Workshop' }]);
});

test('review rejects an unavailable asset across every image write and ignores unrelated previous refs', () => {
  const home = C.state.pages[0];
  const image = node('image', 'image', { src: 'asset:previous' });
  const card = { ...node('card', 'box'), use: 'card' };
  C.findComponent('card')!.props = [{ k: 'photo', label: 'Photo', t: 'img', def: 'asset:previous' }];
  home.tree[0].children.push(image, card);
  const { changes, problems } = prepare([
    { type: 'image', nodeId: image.id, assetId: 'site-photo' },
    { type: 'property', nodeId: card.id, property: 'photo', value: 'site-photo' },
    { type: 'insert', componentId: 'card', region: 'about', values: { photo: 'site-photo' } },
    { type: 'text', nodeId: 'home-title', value: 'Still waiting' }
  ]);
  expect(problems).toEqual([]);
  expect(C.proposalAssetIds(changes)).toEqual(['site-photo']);
  expect(C.proposalCheck(changes, proposalId, { assets })).toEqual(['ok', 'ok', 'ok', 'ok']);
  const unavailable = { assets: new Set<string>() };
  expect(C.proposalCheck(changes, proposalId, unavailable)).toEqual(['stale', 'stale', 'stale', 'ok']);
  const before = structuredClone(C.doc());
  expect(C.proposalApply(changes, proposalId, unavailable)).toEqual([]);
  expect(C.doc()).toEqual(before);
});
