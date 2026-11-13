// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import type { ComponentDef, ComponentProp, Node as PcNode } from '../app/src/core/types';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { L } from '../app/src/ui/ctx';
import { installCustomSelects } from '../shared/custom-select.js';
import { rig, type Rig } from './ui.setup';

let r: Rig | undefined;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const button = (name: string) => r!.$$('button').find(el => el.getAttribute('aria-label') === name || el.textContent === name)!;
const click = async (name: string) => { await act(async () => { r!.click(button(name)); await settle(); }); };
const input = () => r!.$('[role="group"][aria-label^="Edit default"] input, [role="group"][aria-label^="Edit default"] textarea')!;
const type = async (value: string) => { await act(async () => { r!.type(input(), value); await settle(); }); };
const draw = () => act(() => r!.draw(() => <Inspector />, 'right'));
const definition = (): ComponentDef => C.findComponent('workshop-card')!;
const instances = (): PcNode[] => C.state.pages[0].tree;

function setup(properties: ComponentProp[], opts: Parameters<typeof rig>[0] = {}) {
  r = rig(opts);
  const root = C.N('box');
  const heading = C.N('heading', { text: 'Underlying title' });
  heading.bind = { text: { src: 'prop', path: 'title' } };
  root.children = [heading];
  C.state.meta.components = [{ id: 'workshop-card', name: 'Workshop Card', node: root, props: properties }];
  const inherited = C.N('box'); inherited.use = 'workshop-card';
  const own = C.N('box'); own.use = 'workshop-card'; own.vals = { title: 'Local title' };
  const empty = C.N('box'); empty.use = 'workshop-card'; empty.vals = { title: '' };
  C.state.pages[0].tree = [inherited, own, empty];
  C.componentOpen('workshop-card');
  C.selSet([root.id]);
  C.state.ui.stab = 'content';
  draw();
}

afterEach(async () => {
  if (r) { act(() => r!.draw(null)); r.host.remove(); r = undefined; }
  await settle();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test('shared default drafts cancel without mutation; Save moves only inheriting instances and supports atomic Undo', async () => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }]);
  definition().variants = [{ id: 'evening', name: 'Evening', values: { title: 'Evening title' } }];
  const variant = C.N('box'); variant.use = 'workshop-card'; variant.variant = 'evening';
  C.state.pages[0].tree.push(variant);
  const before = C.clone(C.doc());
  await click('Edit default for Title');
  await type('New shared title');
  expect(C.doc()).toEqual(before);
  expect(C.hist.u).toHaveLength(0);
  await click('Cancel');
  expect(C.doc()).toEqual(before);
  expect(r!.names()).not.toContain('save');
  expect(document.activeElement).toBe(button('Edit default for Title'));

  await click('Edit default for Title');
  await type('New shared title');
  await click('Save default');
  expect(definition().props[0].def).toBe('New shared title');
  expect(instances().map(n => C.instValue(n, definition(), 'title')))
    .toEqual(['New shared title', 'Local title', '', 'Evening title']);
  expect(C.hist.u).toHaveLength(1);
  expect(r!.names()).toContain('save');
  const after = C.clone(C.doc());
  C.undo(); expect(C.doc()).toEqual(before);
  C.redo(); expect(C.doc()).toEqual(after);
  C.instSet(instances()[1], 'title', undefined);
  expect(C.instValue(instances()[1], definition(), 'title')).toBe('New shared title');
});

test('an intentional empty shared default saves and an unchanged default creates no Undo step', async () => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }]);
  await click('Edit default for Title');
  await click('Save default');
  expect(C.hist.u).toHaveLength(0);
  await click('Edit default for Title');
  await type('');
  await click('Save default');
  expect(definition().props[0].def).toBe('');
  expect(C.instValue(instances()[0], definition(), 'title')).toBe('');
  expect(C.instValue(instances()[1], definition(), 'title')).toBe('Local title');
  expect(C.hist.u).toHaveLength(1);
});

test('default value kinds retain their controls, choices and validation until explicit Save', async () => {
  setup([
    { k: 'description', label: 'Description', t: 'rich', def: '<p>Workshop details</p>' },
    { k: 'layout', label: 'Layout', t: 'select', def: 'stack', opts: [['stack', 'Stacked'], ['row', 'Inline']] },
    { k: 'shown', label: 'Shown', t: 'bool', def: '0' },
    { k: 'icon', label: 'Icon', t: 'icon', def: 'check' },
    { k: 'colour', label: 'Colour', t: 'color', def: '#112233' },
    { k: 'link', label: 'Link', t: 'link', def: '#details' }
  ]);
  await click('Edit default for Description');
  expect(input().tagName).toBe('TEXTAREA');
  await type('<p>Changed <strong>details</strong></p>');
  await click('Save default');
  expect(C.findProp(definition(), 'description')!.def).toBe('<p>Changed <strong>details</strong></p>');

  for (const [label, value] of [['Layout', 'row'], ['Shown', '1'], ['Icon', 'arrow-right']]) {
    await click('Edit default for ' + label);
    const select = r!.$('[role="group"][aria-label^="Edit default"] select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    const pick = label === 'Icon' ? select.options[select.options.length - 1].value : value;
    await act(async () => { r!.pick(select, pick); await settle(); });
    await click('Save default');
    expect(definition().props.find(p => p.label === label)!.def).toBe(pick);
  }
  await click('Edit default for Colour');
  await type('invalid-colour-value');
  expect(button('Save default').hasAttribute('disabled')).toBe(true);
  expect(C.findProp(definition(), 'colour')!.def).toBe('#112233');
  await type('#abcdef');
  await click('Save default');
  expect(C.findProp(definition(), 'colour')!.def).toBe('#abcdef');
  await click('Edit default for Link');
  await type('#workshop');
  await click('Save default');
  expect(C.findProp(definition(), 'link')!.def).toBe('#workshop');
});

test('default image picker preserves own image metadata and drops inherited stale dimensions on a changed source', async () => {
  const assets = {
    forest: { id: 'forest', url: '/forest.webp', name: 'Forest', size: 4000, w: 1600, h: 900 },
    lake: { id: 'lake', url: '/lake.webp', name: 'Lake', size: 3000, w: 1200, h: 800 }
  };
  setup([{ k: 'photo', label: 'Photo', t: 'img', def: 'asset:forest' }], { asset: id => assets[id as keyof typeof assets] || null });
  const image = C.N('image', { src: 'asset:forest', w: '1600', h: '900', alt: 'Workshop image' });
  image.bind = { src: { src: 'prop', path: 'photo' } };
  definition().node.children = [image];
  instances()[1].vals = { photo: 'asset:forest' };
  C.instImageSizeSet(instances()[1], 'photo', assets.forest);
  const own = C.clone(instances()[1].vals);
  const picker = vi.spyOn(L, 'mediaPicker').mockResolvedValueOnce(null).mockResolvedValueOnce('lake');
  await click('Edit default for Photo');
  await click('Choose default image for Photo');
  expect(C.hist.u).toHaveLength(0);
  expect(C.findProp(definition(), 'photo')!.def).toBe('asset:forest');
  await click('Choose default image for Photo');
  expect(picker).toHaveBeenCalledTimes(2);
  expect(r!.host.textContent).toContain('1200 × 800');
  expect(C.findProp(definition(), 'photo')!.def).toBe('asset:forest');
  await click('Save default');
  expect(C.findProp(definition(), 'photo')!.def).toBe('asset:lake');
  expect(instances()[1].vals).toEqual(own);
  const inherited = C.renderNode(instances()[0], { edit: false });
  expect(inherited).toContain('asset:lake');
  expect(inherited).not.toContain('width="1600"');
  expect(C.renderNode(instances()[1], { edit: false })).toContain('width="1600"');
  expect(C.hist.u).toHaveLength(1);
  await click('Edit default for Photo');
  await click('Clear default image for Photo');
  await click('Cancel');
  expect(C.findProp(definition(), 'photo')!.def).toBe('asset:lake');
});

test('variant deletion cancels safely, preserves every effective value, and Undo restores variant membership', async () => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }]);
  definition().variants = [{ id: 'evening', name: 'Evening <warm>', values: { title: 'Evening title' } }];
  for (const n of instances()) n.variant = 'evening';
  C.componentClose();
  C.selSet([instances()[0].id]);
  draw();
  installCustomSelects();
  await settle();
  const before = C.clone(C.doc());
  const publicBefore = C.buildPage(C.page());
  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const opener = button('Delete variant');
  opener.focus();
  await click('Delete variant');
  expect(C.doc()).toEqual(before);
  expect(C.hist.u).toHaveLength(0);
  expect(document.activeElement, 'Cancel keeps focus on the surviving opener').toBe(opener);
  expect(confirm.mock.calls[0][1]).toContain('Evening &lt;warm&gt;');
  expect(confirm.mock.calls[0][1]).toContain('3 instances using it keep their current values');
  await click('Delete variant');
  const native = r!.$('select[aria-label="Component variant"]') as HTMLSelectElement;
  const trigger = native.nextElementSibling as HTMLButtonElement;
  expect(trigger.getAttribute('role')).toBe('combobox');
  expect(trigger.hidden).toBe(false);
  expect(document.activeElement, 'confirmed deletion focuses the surviving visible variant picker').toBe(trigger);
  expect(trigger.textContent).toBe('Default');
  expect(C.variantsOf(definition())).toHaveLength(0);
  expect(instances().every(n => !n.variant)).toBe(true);
  expect(instances().map(n => C.instValue(n, definition(), 'title'))).toEqual(['Evening title', 'Local title', '']);
  expect(C.buildPage(C.page())).toBe(publicBefore);
  expect(C.hist.u).toHaveLength(1);
  const after = C.clone(C.doc());
  C.undo(); expect(C.doc()).toEqual(before);
  C.redo(); expect(C.doc()).toEqual(after);
});

test('new definition and variant controls do not appear for a content-only account', () => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }], { canStructure: false });
  expect(button('Edit default for Title')).toBeUndefined();
  definition().variants = [{ id: 'evening', name: 'Evening', values: { title: 'Evening title' } }];
  instances()[0].variant = 'evening';
  C.componentClose(); C.selSet([instances()[0].id]); draw();
  expect(button('Delete variant')).toBeUndefined();
});

test.each([true, false])('inspector offers structural footer actions only with structure permission (%s), while content remains editable', async canStructure => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }], { canStructure });
  C.componentClose(); C.selSet([instances()[0].id]); draw();
  const field = r!.$$('.f').find(el => el.querySelector('label')?.textContent?.startsWith('Title'))!
    .querySelector('input, textarea') as HTMLInputElement;
  expect(field).not.toBeNull();
  await act(async () => { r!.type(field, 'Workshop edited title'); await settle(); });
  expect(C.instValue(instances()[0], definition(), 'title')).toBe('Workshop edited title');

  if (!canStructure) {
    expect(r!.$('.sFoot')).toBeNull();
    expect(r!.calls.filter(([name]) => name === 'runAct')).toEqual([]);
    return;
  }
  const actions = r!.$$('.sFoot button');
  expect(actions.map(el => el.textContent!.trim())).toEqual(['Duplicate', 'Delete']);
  await act(async () => { actions.forEach(action => r!.click(action)); await settle(); });
  expect(r!.calls.filter(([name]) => name === 'runAct'))
    .toEqual([['runAct', 'dup', [instances()[0].id]], ['runAct', 'del', [instances()[0].id]]]);
});

test('content-only variant context is disabled and even a programmatic selection cannot queue a structural save', async () => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }], { canStructure: false });
  definition().variants = [{ id: 'evening', name: 'Workshop Evening', values: { title: 'Evening title' } }];
  instances()[0].variant = 'evening';
  C.componentClose(); C.selSet([instances()[0].id]); draw();
  const before = C.clone(C.doc());
  const saveCalls = r!.names().filter(name => name === 'save').length;
  const select = r!.$('select[aria-label="Component variant"]') as HTMLSelectElement;
  expect(select.disabled).toBe(true);
  expect(select.value).toBe('evening');
  installCustomSelects(); await settle();
  const trigger = select.nextElementSibling as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  expect(trigger.textContent).toBe('Workshop Evening');
  expect(button('Save as variant')).toBeUndefined();
  expect(r!.$('.f > .row')).toBeNull();
  await act(async () => { r!.pick(select, ''); await settle(); });
  expect(C.doc()).toEqual(before);
  expect(C.hist.u).toHaveLength(0);
  expect(r!.names().filter(name => name === 'save')).toHaveLength(saveCalls);
});

test.each([false, true])('variant reset clears only permitted own values and their paired metadata (%s)', async canStructure => {
  setup([
    { k: 'title', label: 'Title', t: 'text', def: 'Workshop default' },
    { k: 'photo', label: 'Photo', t: 'img', def: 'asset:forest' },
    { k: 'destination', label: 'Destination', t: 'link', def: '/workshop' },
    { k: 'shown', label: 'Shown', t: 'bool', def: '1' },
    { k: 'layout', label: 'Layout', t: 'select', def: 'stack', opts: [['stack', 'Stacked'], ['row', 'Inline']] },
  ], { canStructure });
  const image = C.N('image', { src: 'asset:forest' });
  image.bind = { src: { src: 'prop', path: 'photo' } };
  definition().node.children.push(image);
  definition().variants = [{ id: 'evening', name: 'Workshop Evening', values: { title: 'Evening title' } }];
  const inst = instances()[0]; inst.variant = 'evening';
  inst.vals = { title: 'Workshop own title', photo: 'asset:lake', destination: '/local', '@link-target:destination': '_blank', shown: '0', layout: 'row' };
  C.instImageSizeSet(inst, 'photo', { w: 1200, h: 800 });
  expect(inst.vals[C.imageSizeKey('photo')]).toBeDefined();
  C.componentClose(); C.selSet([inst.id]); draw();
  const before = C.clone(C.doc());
  await click('Back to the variant');
  expect(inst.vals).toEqual(canStructure ? undefined : { shown: '0', layout: 'row' });
  expect(inst.variant).toBe('evening');
  expect(C.instValue(inst, definition(), 'title')).toBe('Evening title');
  if (!canStructure) {
    expect(button('Back to the variant')).toBeUndefined();
    expect(r!.$('.f > .row')).toBeNull();
  }
  expect(C.hist.u).toHaveLength(1);
  const after = C.clone(C.doc());
  C.undo(); expect(C.doc()).toEqual(before);
  C.redo(); expect(C.doc()).toEqual(after);
});

test('variant authoring rechecks structure permission before opening and after resolving its name dialog', async () => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }]);
  C.componentClose(); C.selSet([instances()[1].id]); draw();
  const before = C.clone(C.doc());
  const permission = vi.spyOn(L, 'canStructure').mockReturnValue(false);
  let resolveName!: (value: string) => void;
  const ask = vi.spyOn(L, 'askText').mockImplementation(() => new Promise(resolve => { resolveName = resolve; }));
  await click('Save as variant');
  expect(ask).not.toHaveBeenCalled();
  permission.mockReturnValue(true);
  await click('Save as variant');
  expect(ask).toHaveBeenCalledTimes(1);
  await act(async () => { permission.mockReturnValue(false); resolveName('Workshop alternate'); await settle(); });
  expect(C.doc()).toEqual(before);
  expect(C.hist.u).toHaveLength(0);
  expect(r!.names()).not.toContain('save');
});

test('an account with structure permission still creates a variant from the instance values', async () => {
  setup([{ k: 'title', label: 'Title', t: 'text', def: 'Workshop default' }]);
  C.componentClose(); C.selSet([instances()[1].id]); draw();
  const ask = vi.spyOn(L, 'askText').mockResolvedValue('Workshop alternate');
  await click('Save as variant');
  expect(ask).toHaveBeenCalledTimes(1);
  expect(definition().variants).toEqual([{ id: 'workshop-alternate', name: 'Workshop alternate', values: { title: 'Local title' } }]);
  expect(instances()[1].variant).toBe('workshop-alternate');
  expect(instances()[1].vals).toBeUndefined();
  expect(r!.names()).toContain('save');
  expect((r!.$('select[aria-label="Component variant"]') as HTMLSelectElement).disabled).toBe(false);
});
