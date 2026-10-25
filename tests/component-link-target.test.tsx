/** @vitest-environment jsdom */
import { beforeEach, afterEach, test, expect } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); C.seed(); C.blankProject('Link target QA'); C.state.meta.components = []; });
afterEach(() => r.host.remove());

function component(rootType: 'column' | 'box' = 'column', links = 1) {
  const buttons = Array.from({ length: links }, (_, i) => C.N('button', {
    text: `Link ${i + 1}`, link: `https://default-${i + 1}.example`, target: '',
  }));
  const root = C.insert(rootType, null, 0)!;
  root.children = buttons;
  const id = C.componentFromNode(root.id, 'Link card')!;
  const definition = C.findComponent(id)!;
  const keys = buttons.map((_, i) => {
    const key = C.propAdd(id, i ? `Link ${i + 1}` : 'Link', 'link', `https://default-${i + 1}.example`)!;
    C.bindSet(definition.node.children[i], 'link', { src: 'prop', path: key });
    return key;
  });
  return { instance: C.locate(root.id)!.node, definition, buttons: definition.node.children, keys };
}

function anchors(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('a')];
}

test('the real component Link control owns target beside href and undo restores it atomically', async () => {
  const { instance, keys: [key] } = component();
  C.instSet(instance, key, 'about.html');
  const control = C.instControls(instance)[0];
  expect(control).toMatchObject({ k: 'val:link', tk: 'val:@link-target:link' });
  C.hist.u.length = 0; C.hist.r.length = 0;

  r.draw(<Ctl n={instance} c={control} />);
  await act(async () => r.click(r.$('button[role="switch"]')!));

  expect(instance.vals).toMatchObject({ link: 'about.html', '@link-target:link': '_blank' });
  expect(instance.props.target).toBeUndefined();
  for (const edit of [true, false]) {
    expect(anchors(C.renderNode(instance, { edit }))[0]).toMatchObject({
      href: expect.stringContaining('about.html'), target: '_blank', rel: 'noopener',
    });
  }
  expect(r.names()).toContain('tx');
  expect(r.names()).toContain('endTx');
  C.instLinkTargetSet(instance, key, '');
  C.hist.u.length = 0; C.hist.r.length = 0;
  C.edit(() => C.instLinkTargetSet(instance, key, '_blank'));
  expect(C.hist.u).toHaveLength(1);
  C.undo();
  let restored = C.locate(instance.id)!.node;
  expect(C.instLinkTarget(restored, C.findComponent(restored.use), key)).toBe('');
  C.redo();
  restored = C.locate(instance.id)!.node;
  expect(C.instLinkTarget(restored, C.findComponent(restored.use), key)).toBe('_blank');
});

test('No link clears href and target in one transaction for direct and component links', () => {
  const direct = C.insert('button', null, 0)!;
  direct.props.link = '/direct';
  direct.props.target = '_blank';
  const directControl = { t: 'link', k: 'link', l: 'Link' } as any;
  r.draw(<Ctl n={direct} c={directControl} />);
  act(() => r.pick(r.$('select[data-field-part="type"]')!, 'none'));
  expect(direct.props).toMatchObject({ link: '', target: '' });
  expect(r.names().filter(name => name === 'tx')).toHaveLength(1);
  expect(r.names().filter(name => name === 'endTx')).toHaveLength(1);

  C.blankProject('Component No link'); C.state.meta.components = [];
  const { instance, keys: [key] } = component();
  C.instSet(instance, key, '/component');
  C.instLinkTargetSet(instance, key, '_blank');
  const control = C.instControls(instance)[0];
  r.draw(<Ctl n={instance} c={control} />);
  act(() => r.pick(r.$('select[data-field-part="type"]')!, 'none'));
  expect(instance.vals).toMatchObject({ [key]: '', [C.linkTargetKey(key)]: '' });
  expect((instance.props as Record<string, unknown>)[C.linkTargetKey(key)]).toBeUndefined();

  C.instSet(instance, key, '/undo');
  C.instLinkTargetSet(instance, key, '_blank');
  C.hist.u.length = 0; C.hist.r.length = 0;
  C.edit(() => {
    C.applyC(instance, control, '');
    C.applyC(instance, { k: control.tk! }, '');
  });
  expect(instance.vals).toMatchObject({ [key]: '', [C.linkTargetKey(key)]: '' });
  C.undo();
  let restored = C.locate(instance.id)!.node;
  expect(restored.vals).toMatchObject({ [key]: '/undo', [C.linkTargetKey(key)]: '_blank' });
  C.redo();
  restored = C.locate(instance.id)!.node;
  expect(restored.vals).toMatchObject({ [key]: '', [C.linkTargetKey(key)]: '' });
});

test('two link properties own targets independently', () => {
  const { instance, definition, keys } = component('column', 2);
  C.instSet(instance, keys[0], '/first');
  C.instSet(instance, keys[1], '/second');
  C.instLinkTargetSet(instance, keys[0], '_blank');

  let rendered = anchors(C.renderNode(instance, { edit: false }));
  expect(rendered.map(a => [a.getAttribute('href'), a.target, a.rel])).toEqual([
    ['/first', '_blank', 'noopener'], ['/second', '', ''],
  ]);
  C.instLinkTargetSet(instance, keys[1], '_blank');
  C.instLinkTargetSet(instance, keys[0], '');
  rendered = anchors(C.renderNode(instance, { edit: false }));
  expect(rendered.map(a => [a.target, a.rel])).toEqual([['', ''], ['_blank', 'noopener']]);
  expect(C.instLinkTarget(instance, definition, keys[0])).toBe('');
});

test('definition and variant targets resolve until a local target overrides them', () => {
  const { instance, definition, buttons: [button], keys: [key] } = component();
  button.props.target = '_blank';
  expect(C.instLinkTarget(instance, definition, key)).toBe('_blank');
  C.instLinkTargetSet(instance, key, '');
  expect(C.instLinkTarget(instance, definition, key)).toBe('');

  C.instSet(instance, key, '/variant');
  C.instLinkTargetSet(instance, key, '_blank');
  const variant = C.variantFromInstance(instance, 'New tab')!;
  expect(C.findVariant(definition, variant)!.values).toMatchObject({
    [key]: '/variant', [C.linkTargetKey(key)]: '_blank',
  });
  expect(C.instOwn(instance)).toEqual([]);
  C.instLinkTargetSet(instance, key, '');
  expect(C.instOwn(instance)).toEqual([key]);
  C.instSet(instance, key, undefined);
  expect(C.instOwn(instance)).toEqual([]);
  expect(C.instLinkTarget(instance, definition, key)).toBe('_blank');
  expect(C.variantDelete(definition.id, variant)).toBe(1);
  expect(instance.variant).toBeUndefined();
  expect(instance.vals).toMatchObject({ [key]: '/variant', [C.linkTargetKey(key)]: '_blank' });
});

test('a CMS href leaves its independently editable component target alone', async () => {
  const { instance, definition, keys: [key] } = component();
  const collection = C.collectionAdd('Projects')!;
  const field = C.fieldAdd(collection.id, 'Destination', 'link')!;
  const item = C.itemAdd(collection.id)!;
  C.itemSet(collection.id, item.id, field.id, '/cms-project');
  C.srcSet(instance, collection.id);
  C.instSet(instance, key, '/local-fallback');
  C.bindSet(instance, C.VAL + key, C.bindField(field.id));
  const control = C.instControls(instance)[0];

  r.draw(<Ctl n={instance} c={control} />);
  expect((r.$('input') as HTMLInputElement).disabled).toBe(true);
  expect((r.$('input') as HTMLInputElement).value).toBe('/cms-project');
  await act(async () => r.click(r.$('button[role="switch"]')!));
  expect(C.instLinkTarget(instance, definition, key)).toBe('_blank');
  let link = anchors(C.renderNode(instance, { edit: false }))[0];
  expect([link.getAttribute('href'), link.target, link.rel]).toEqual(['/cms-project', '_blank', 'noopener']);

  C.itemSet(collection.id, item.id, field.id, '');
  expect(anchors(C.renderNode(instance, { edit: false }))).toHaveLength(0);
  delete item.values[field.id];
  expect(anchors(C.renderNode(instance, { edit: false }))).toHaveLength(0);
  C.itemSet(collection.id, item.id, field.id, 'javascript:alert(1)');
  expect(anchors(C.renderNode(instance, { edit: false }))).toHaveLength(0);
  C.bindSet(instance, C.VAL + key, null);
  link = anchors(C.renderNode(instance, { edit: false }))[0];
  expect([link.getAttribute('href'), link.target, link.rel]).toEqual(['/local-fallback', '_blank', 'noopener']);
});

test('legacy root target is recovered only for an unambiguous single link destination', () => {
  const one = component();
  one.definition.node.props.link = '';
  one.instance.props.target = '_blank';
  const exported = JSON.parse(JSON.stringify(C.doc()));
  const restoredOne = C.migrate(exported)!;
  const queue = [...restoredOne.pages[0].tree];
  let restoredInstance: any = null;
  while (queue.length) {
    const node = queue.shift()!;
    if (node.use === one.definition.id) { restoredInstance = node; break; }
    queue.push(...(node.children || []));
  }
  const restoredDefinition = restoredOne.meta.components[0];
  expect(restoredInstance).not.toBeNull();
  expect(C.instLinkTarget(restoredInstance, restoredDefinition, one.keys[0])).toBe('_blank');
  C.instLinkTargetSet(one.instance, one.keys[0], '');
  expect(one.instance.props.target).toBeUndefined();

  C.blankProject('Independent root link'); C.state.meta.components = [];
  const independent = component('box');
  independent.definition.node.props.link = '/independent';
  independent.instance.props.target = '_blank';
  expect(C.instLinkTarget(independent.instance, independent.definition, independent.keys[0])).toBe('');

  C.blankProject('Two links'); C.state.meta.components = [];
  const two = component('column', 2);
  two.instance.props.target = '_blank';
  expect(two.keys.map(key => C.instLinkTarget(two.instance, two.definition, key))).toEqual(['', '']);

  C.blankProject('No destination'); C.state.meta.components = [];
  const none = component();
  delete none.definition.node.children[0].bind;
  none.instance.props.target = '_blank';
  expect(C.instLinkTarget(none.instance, none.definition, none.keys[0])).toBe('');
});

test('the first bound destination supplies the shared property target default', () => {
  const shared = component();
  const second = C.N('button', { text: 'Second', link: '/second', target: '_blank' });
  C.bindSet(second, 'link', { src: 'prop', path: shared.keys[0] });
  shared.definition.node.children.push(second);
  shared.buttons[0].props.target = '';
  expect(C.instLinkTarget(shared.instance, shared.definition, shared.keys[0])).toBe('');
  shared.buttons[0].props.target = '_blank';
  second.props.target = '';
  expect(C.instLinkTarget(shared.instance, shared.definition, shared.keys[0])).toBe('_blank');
});

test('legacy target ownership survives variant capture and clears back to defaults', () => {
  const saved = component('box');
  saved.definition.node.props.link = '';
  saved.instance.props.target = '_blank';
  expect(C.instOwn(saved.instance)).toEqual(saved.keys);
  const variant = C.variantFromInstance(saved.instance, 'Legacy target')!;
  expect(C.findVariant(saved.definition, variant)!.values).toMatchObject({
    [C.linkTargetKey(saved.keys[0])]: '_blank',
  });
  expect(saved.instance.props.target).toBeUndefined();
  expect(C.instOwn(saved.instance)).toEqual([]);
  expect(C.instLinkTarget(saved.instance, saved.definition, saved.keys[0])).toBe('_blank');

  C.blankProject('Reset legacy target'); C.state.meta.components = [];
  const reset = component('box');
  reset.definition.node.props.link = '';
  reset.instance.props.target = '_blank';
  expect(C.instOwn(reset.instance)).toEqual(reset.keys);
  C.instOwn(reset.instance).forEach(key => C.instSet(reset.instance, key, undefined));
  expect(reset.instance.props.target).toBeUndefined();
  expect(C.instOwn(reset.instance)).toEqual([]);
  expect(C.instLinkTarget(reset.instance, reset.definition, reset.keys[0])).toBe('');
});

test('property deletion and component materialization clean up paired target ownership', () => {
  const removed = component();
  const removedKey = removed.keys[0];
  C.instSet(removed.instance, removedKey, '/removed');
  C.instLinkTargetSet(removed.instance, removedKey, '_blank');
  removed.definition.variants = [{ id: 'v', name: 'V', values: {
    [removedKey]: '/variant', [C.linkTargetKey(removedKey)]: '_blank',
  } }];
  C.propDelete(removed.definition.id, removedKey);
  expect(removed.instance.vals).toBeUndefined();
  expect(removed.definition.variants[0].values).toEqual({});

  C.blankProject('Materialize'); C.state.meta.components = [];
  const kept = component();
  C.instSet(kept.instance, kept.keys[0], '/kept');
  C.instLinkTargetSet(kept.instance, kept.keys[0], '_blank');
  C.componentDelete(kept.definition.id);
  const ordinaryButton = kept.instance.children[0];
  expect(ordinaryButton.props).toMatchObject({ link: '/kept', target: '_blank' });
  expect(ordinaryButton.bind).toBeUndefined();

  C.blankProject('Delete legacy property'); C.state.meta.components = [];
  const legacy = component('box');
  legacy.definition.node.props.link = '';
  legacy.instance.props.target = '_blank';
  C.propDelete(legacy.definition.id, legacy.keys[0]);
  expect(legacy.instance.props.target).toBeUndefined();

  C.blankProject('Keep independent root target'); C.state.meta.components = [];
  const independent = component('box');
  independent.definition.node.props.link = '/independent';
  independent.instance.props.target = '_blank';
  C.propDelete(independent.definition.id, independent.keys[0]);
  expect(independent.instance.props.target).toBe('_blank');
});

test('component deletion preserves distinct defaults on destinations sharing one property', () => {
  const shared = component();
  shared.buttons[0].props.target = '';
  const second = C.N('button', { text: 'Second', link: '/second', target: '_blank' });
  C.bindSet(second, 'link', { src: 'prop', path: shared.keys[0] });
  shared.definition.node.children.push(second);
  C.instSet(shared.instance, shared.keys[0], '/shared');

  C.componentDelete(shared.definition.id);
  expect(shared.instance.children.map(child => child.props.target)).toEqual(['', '_blank']);
  expect(anchors(C.renderNode(shared.instance, { edit: false })).map(link => [link.target, link.rel]))
    .toEqual([['', ''], ['_blank', 'noopener']]);
});

test('component deletion preserves a root destination target after merging instance props', () => {
  const root = C.insert('button', null, 0)!;
  root.props.link = '/definition';
  root.props.target = '_blank';
  const id = C.componentFromNode(root.id, 'Root link')!;
  const definition = C.findComponent(id)!;
  const key = C.propAdd(id, 'Link', 'link', '/definition')!;
  C.bindSet(definition.node, 'link', { src: 'prop', path: key });
  const instance = C.locate(root.id)!.node;
  instance.props.target = '';
  C.instSet(instance, key, '/root');

  C.componentDelete(id);
  expect(instance.props).toMatchObject({ link: '/root', target: '_blank' });
  expect(anchors(C.renderNode(instance, { edit: false })).map(link => [link.target, link.rel]))
    .toEqual([['_blank', 'noopener']]);
});

test('schema 13 adoption changes markers only and schema 14 rejects a future document', () => {
  const old = structuredClone(C.doc()) as any;
  old.schemaVersion = 13;
  delete old.v;
  const before = structuredClone(old);
  const migrated = C.migrate(old)!;
  expect(migrated.schemaVersion).toBe(14);
  expect(migrated.v).toBeUndefined();
  expect({ ...migrated, schemaVersion: 13 }).toEqual(before);
  expect(C.migrate({ ...structuredClone(C.doc()), schemaVersion: 15 })).toBeNull();
});
