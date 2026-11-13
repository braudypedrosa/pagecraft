// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { ComponentDef, Node as PcNode } from '../app/src/core/types';

const instance = (id: string, title: string, children: PcNode[] = []) => {
  const node = C.N('box'); node.use = id; node.vals = { title }; node.children = children; return node;
};
function definition(id = 'workshop-card'): ComponentDef {
  const title = C.N('heading', { text: 'Underlying workshop title' });
  title.bind = { text: { src: 'prop', path: 'title' } };
  const photo = C.N('image', { src: 'https://example.test/forest.webp', alt: 'Workshop forest' });
  photo.bind = { src: { src: 'prop', path: 'photo' }, alt: { src: 'prop', path: 'alt' } };
  const slot = C.N('box', {}, {}, [C.N('text', { html: '<p>Default workshop slot</p>' })]);
  slot.slot = 'body';
  const def: ComponentDef = {
    id, name: 'Workshop Card', node: C.N('box', {}, {}, [title, photo, slot]),
    props: [
      { k: 'title', label: 'Title', t: 'text', def: 'Workshop default' },
      { k: 'photo', label: 'Photo', t: 'img', def: 'https://example.test/forest.webp' },
      { k: 'alt', label: 'Alt', t: 'text', def: 'Workshop forest' },
    ]
  };
  C.state.meta.components!.push(def); return def;
}
const publicDocument = (html: string, visit: (document: Document) => void) => {
  visit(new DOMParser().parseFromString(html, 'text/html'));
};
beforeEach(() => {
  C.blankProject('Workshop slot composition');
  C.state.header = []; C.state.footer = [];
  C.state.meta.components = []; C.state.meta.collections = []; C.state.meta.blocks = [];
  C.ensureTokens();
});

test('finite page-owned Card-in-Card composition renders every instance and the inner default slot with stable unique public IDs', () => {
  const def = definition();
  const inner = instance(def.id, 'Inner Workshop Card');
  const outer = instance(def.id, 'Outer Workshop Card', [inner]);
  C.page().tree = [outer];
  const before = C.clone(C.doc());
  const edited = C.renderNode(outer, { edit: true });
  expect(edited).not.toContain('contains itself');
  expect(edited).toContain('Inner Workshop Card');
  expect(edited).toContain('Default workshop slot');
  const html = C.buildPage(C.page());
  publicDocument(html, document => {
    expect(document.body.textContent).toContain('Outer Workshop Card');
    expect(document.body.textContent).toContain('Inner Workshop Card');
    expect(document.body.textContent!.match(/Default workshop slot/g)).toHaveLength(1);
    const ids = Array.from(document.querySelectorAll('[id]'), element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(document.getElementById(C.domIdOf(inner))).not.toBeNull();
  });
  expect(C.buildPage(C.page())).toBe(html);
  expect(C.doc()).toEqual(before);
});

test('the contextual media-review consumer reaches the inner same-definition instance and retains its own override', () => {
  const def = definition();
  const inner = instance(def.id, 'Workshop inner without alternative text');
  inner.vals!.photo = 'https://example.test/lake.webp'; inner.vals!.alt = '';
  const outer = instance(def.id, 'Workshop outer', [inner]); C.page().tree = [outer];
  const missing = C.lint().filter(finding => finding.code === 'no-alt');
  expect(missing).toHaveLength(1);
  expect(missing[0].target).toMatchObject({ pageId: C.page().id, scope: 'page', nodeId: inner.id });
  publicDocument(C.buildPage(C.page()), document => {
    expect(Array.from(document.images, image => [image.getAttribute('src'), image.alt]))
      .toEqual([['https://example.test/forest.webp', 'Workshop forest'], ['https://example.test/lake.webp', '']]);
  });
});

test('page-owned nested same-definition slot content retains detail CMS and native form-routing scope', () => {
  const def = definition();
  const col = C.collectionAdd('Workshop Cabins');
  const title = C.titleField(col)!;
  const item = C.itemAdd(col.id)!; C.itemSet(col.id, item.id, title.id, 'Workshop Pine Cabin'); C.itemDraft(col.id, item.id, false);
  const form = C.N('form', { mode: 'external', action: 'https://example.test/receipt', method: 'post' });
  const inner = instance(def.id, 'Fallback inner title', [form]);
  C.bindSet(inner, C.VAL + 'title', C.bindField(title.id));
  const outer = instance(def.id, 'Workshop outer title', [inner]);
  C.page().tree = [outer]; C.page().collection = col.id;
  const html = C.buildPage(C.page(), { col, item });
  expect(html).toContain('Workshop Pine Cabin');
  publicDocument(html, document => {
    expect(document.querySelector('form')?.getAttribute('action')).toBe('https://example.test/receipt');
  });
  const observations: C.FormRoutingObservation[] = [];
  C.inspectFormRouting(C.doc(), observation => observations.push(observation));
  expect(observations).toHaveLength(1);
  expect(JSON.parse(observations[0].placement)).toContain(form.id);
  expect(JSON.parse(observations[0].context)).toEqual([[col.id, item.id]]);
  expect(observations[0].cloud).toMatchObject({ kind: 'external', action: 'https://example.test/receipt', method: 'post' });
});

test.each(['direct', 'mutual', 'definition-owned fill'] as const)('genuine %s definition recursion remains refused without exhausting the renderer or review', kind => {
  const a = definition('workshop-a');
  const b = definition('workshop-b');
  if (kind === 'direct') a.node.children.push(instance(a.id, 'Workshop forbidden self default'));
  else if (kind === 'mutual') {
    a.node.children.push(instance(b.id, 'Workshop B default'));
    b.node.children.push(instance(a.id, 'Workshop forbidden A default'));
  } else {
    // A owns this B instance and its supplied A child. Leaving B's expansion must retain A
    // in the definition stack, so the slot boundary cannot turn a real cycle into recursion.
    a.node.children.push(instance(b.id, 'Workshop B filled by A', [instance(a.id, 'Workshop forbidden A fill')]));
  }
  const form = C.N('form', { mode: 'external', action: 'https://example.test/cycle-receipt', method: 'post' });
  a.node.children.unshift(form); // Force form inspection to traverse the guarded definitions.
  const outer = instance(a.id, 'Workshop visible outer'); C.page().tree = [outer];
  const edited = C.renderNode(outer, { edit: true });
  expect(edited).toContain('contains itself');
  const html = C.buildPage(C.page());
  expect(html.length).toBeLessThan(150_000);
  expect(html).toContain('Workshop visible outer');
  expect(html).not.toContain('Workshop forbidden');
  expect(html).not.toContain('contains itself');
  expect(() => C.lint()).not.toThrow();
  const observed: C.FormRoutingObservation[] = [];
  expect(() => C.inspectFormRouting(C.doc(), row => observed.push(row))).not.toThrow();
  expect(observed).toHaveLength(1);
  expect(JSON.parse(observed[0].placement)).toContain(form.id);
});
