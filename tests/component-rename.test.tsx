// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { install } from '../app/src/ui/ctx';
import { Add } from '../app/src/ui/Add';
import { MobileMenuBuilder } from '../app/src/ui/inspector/MobileMenuBuilder';
import { rig, stubLegacy, type Rig } from './ui.setup';
let r: Rig, ask: HTMLElement;
const source = readFileSync('builder.html', 'utf8');
const settle = () => act(async () => { await Promise.resolve(); });
beforeEach(() => {
  r = rig();
  // Actual builder askText markup/handlers. Only motion/layer infrastructure is inert.
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  ask = document.importNode(parsed.querySelector('#ask')!, true);
  document.body.append(ask);
  const start = source.indexOf('let askDone = null;');
  const end = source.indexOf('\nfunction mediaPicker(', start);
  const listeners = source.slice(source.indexOf("$('#askX').addEventListener('click',"),
    source.indexOf("$('#ask').addEventListener('keydown',"));
  a.ok(start > 0 && end > start);
  const dialogs = new Function('$', '$$', 'esc', 'PC_UI', 'syncDialogLayers',
    source.slice(start, end) + '\n' + listeners + '\nreturn {askPick, askText, askConfirm};')(
      (s: string) => document.querySelector(s),
      (s: string) => [...document.querySelectorAll(s)], C.esc,
      { installUiMotion: () => null }, () => {});
  install(C, { ...stubLegacy(r.calls), ...dialogs });
});
afterEach(() => { act(() => r.draw(null)); r.host.remove(); ask.remove(); document.querySelector('#rename-picker')?.remove(); });


const draw = () => { C.state.ui.atab = 'components'; act(() => r.draw(() => <Add />, 'add')); };
const row = (name: string) => [...r.host.querySelectorAll<HTMLElement>('.brow')].find(el => el.querySelector('b')?.textContent === name)!;
const rename = (name: string) => {
  const button = row(name)?.querySelector<HTMLButtonElement>('button[aria-label="Rename this component"]');
  expect(button, `Rename action on ${name}`).toBeTruthy();
  act(() => { button!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); button!.click(); });
  expect(ask.hidden).toBe(false);
  expect(ask.querySelector('#askTitle')!.textContent).toBe('Rename component');
  expect((ask.querySelector('#askIn') as HTMLInputElement).value).toBe(name);
};
const submit = async (name: string) => {
  (ask.querySelector('#askIn') as HTMLInputElement).value = name;
  act(() => (ask.querySelector('#askYes') as HTMLButtonElement).click());
  await settle();
};

test('ordinary component renames through actual row action and dialog without placing or dragging an instance', async () => {
  const original = C.insert('button', null, 0)!;
  const cid = C.componentFromNode(original.id, 'Original card')!;
  C.instanceInsert(cid, null, 1);
  const before = JSON.parse(JSON.stringify(C.doc()));
  C.hist.u.length = 0; C.hist.r.length = 0;
  draw(); r.calls.length = 0;
  rename('Original card');
  await submit('  Renamed card  ');
  expect(C.findComponent(cid)!.name).toBe('Renamed card');
  expect(row('Renamed card')).toBeTruthy();
  expect(r.names()).not.toContain('startDrag');
  expect(r.names()).not.toContain('select');
  expect(C.hist.u).toHaveLength(1);
  const expected = JSON.parse(JSON.stringify(before));
  expected.meta.components.find((def: any) => def.id === cid).name = 'Renamed card';
  expect(C.doc()).toEqual(expected);
  C.undo(); draw(); expect(row('Original card')).toBeTruthy(); expect(C.doc()).toEqual(before);
  C.redo(); draw(); expect(row('Renamed card')).toBeTruthy(); expect(C.doc()).toEqual(expected);
  C.restore(C.migrate(JSON.parse(JSON.stringify(C.doc())))!); draw();
  expect(row('Renamed card')).toBeTruthy();
});

test('cancel, blank and unchanged names do not mutate document or add history; Core caps long names', async () => {
  const original = C.insert('heading', null, 0)!;
  const cid = C.componentFromNode(original.id, 'Original heading')!;
  C.hist.u.length = 0; C.hist.r.length = 0; draw();
  const before = JSON.parse(JSON.stringify(C.doc()));
  rename('Original heading'); act(() => (ask.querySelector('#askNo') as HTMLButtonElement).click()); await settle();
  expect(C.doc()).toEqual(before); expect(C.hist.u).toHaveLength(0);
  rename('Original heading'); await submit('   ');
  expect(C.doc()).toEqual(before); expect(C.hist.u).toHaveLength(0);
  rename('Original heading'); await submit('  Original heading  ');
  expect(C.doc()).toEqual(before); expect(C.hist.u).toHaveLength(0);
  rename('Original heading'); await submit('Long component name '.repeat(5));
  expect(C.findComponent(cid)!.name).toBe('Long component name '.repeat(5).trim().slice(0, 40));
  expect(C.hist.u).toHaveLength(1);
});

test('managed Custom layout rename updates actual picker label and preserves owner, links and definition content', async () => {
  const nav = C.N('nav', { aria: 'Original navigation', items: [{ id: 'work', label: 'Work', href: '/work' }] });
  C.state.pages[0].tree = [nav];
  C.setMobileMenuMode(nav, 'custom');
  const definition = C.mobileMenuDefinition(nav)!;
  C.prepareMobileMenuEdit(nav, definition.id); C.componentOpen(definition.id);
  const owner = JSON.parse(JSON.stringify(C.state.ui.mobileMenuOwner));
  const before = JSON.parse(JSON.stringify(C.doc()));
  C.hist.u.length = 0; C.hist.r.length = 0;
  const picker = document.createElement('div'); picker.id = 'rename-picker'; document.body.append(picker);
  // Register the actual right-side component alongside Add, as the host does.
  const { render } = await import('preact');
  const { registerPainter } = await import('../app/src/ui/ctx');
  const paintPicker = () => render(<MobileMenuBuilder n={C.state.pages[0].tree[0]} />, picker);
  registerPainter('right', paintPicker); act(paintPicker); draw();
  rename(definition.name); await submit('Managed evening menu');
  const select = picker.querySelector('select#mobile-menu-layout') as HTMLSelectElement;
  expect(select.selectedOptions[0].textContent).toBe('Managed evening menu');
  expect(select.value).toBe(definition.id);
  expect(C.state.ui.mobileMenuOwner).toEqual(owner);
  expect(C.state.pages[0].tree[0].props.aria).toBe('Original navigation');
  const expected = JSON.parse(JSON.stringify(before));
  expected.meta.components.find((def: any) => def.id === definition.id).name = 'Managed evening menu';
  expect(C.doc()).toEqual(expected); expect(C.hist.u).toHaveLength(1);
  C.undo(); draw(); act(paintPicker); expect(C.doc()).toEqual(before);
  C.redo(); draw(); act(paintPicker); expect(C.doc()).toEqual(expected);
  expect((picker.querySelector('#mobile-menu-layout') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Managed evening menu');
  render(null, picker);
});


test('a suffix beyond the existing forty-character name makes no checkpoint or save request', async () => {
  const original = C.insert('button', null, 0)!;
  const current = 'A'.repeat(40);
  const cid = C.componentFromNode(original.id, current)!;
  C.hist.u.length = 0; C.hist.r.length = 0; draw();
  const before = JSON.parse(JSON.stringify(C.doc()));
  const save = vi.fn(), previousSave = C.HOOKS.save;
  C.HOOKS.save = save;
  try {
    rename(current); await submit(current + ' ignored suffix');
    expect(C.findComponent(cid)!.name).toBe(current);
    expect(C.doc()).toEqual(before);
    expect(C.hist.u).toHaveLength(0);
    expect(C.hist.r).toHaveLength(0);
    expect(save).not.toHaveBeenCalled();
  } finally { C.HOOKS.save = previousSave; }
});

const remove = (name: string) => {
  const button = row(name).querySelector<HTMLButtonElement>('button[title="Delete this component"]')!;
  act(() => button.click());
  expect(ask.querySelector('#askTitle')!.textContent).toBe('Delete this component?');
  expect(ask.querySelector('#askYes')!.textContent).toBe('Delete component');
  return ask.querySelector('#askBody')!.textContent!;
};
const confirmDelete = async () => {
  act(() => (ask.querySelector('#askYes') as HTMLButtonElement).click()); await settle();
};

test('managed layout confirmation counts navigation owners and Cancel preserves their definitions and refs', async () => {
  const first = C.insert('nav', null, 0)!;
  C.setMobileMenuMode(first, 'custom');
  const definition = C.mobileMenuDefinition(first)!;
  const second = C.insert('nav', null, 1)!;
  second.props.mobileMenuComponent = definition.id;
  second.props.mobileMenuMode = 'custom';
  C.hist.u.length = 0; C.hist.r.length = 0; draw();
  const before = C.clone(C.doc());
  expect(row(definition.name).querySelector('small')!.textContent).toContain('2 mobile menus');
  expect(row(definition.name).querySelector('small')!.textContent).not.toContain('2 instances');
  const message = remove(definition.name);
  expect(message).toContain('2 mobile menus reference this layout');
  expect(message).toContain('navigation links or existing Follow layout');
  expect(message).not.toContain('keep what they show');
  expect(message).not.toContain('Nothing is using it');
  act(() => (ask.querySelector('#askNo') as HTMLButtonElement).click()); await settle();
  expect(C.doc()).toEqual(before); expect(C.hist.u).toHaveLength(0);
});

test('mixed delete explains ordinary retention separately from mobile fallback and commits one reversible edit', async () => {
  const nav = C.insert('nav', null, 0)!;
  nav.props.aria = 'Original navigation';
  const follow = C.ensureMobileMenuComponent(nav, 'follow');
  C.setMobileMenuMode(nav, 'custom');
  const definition = C.mobileMenuDefinition(nav)!;
  C.componentRename(follow.id, 'Kept Follow layout');
  C.componentRename(definition.id, 'Deleted Custom layout');
  definition.node.children.push(C.N('heading', { text: 'Private mobile content' }));
  const ordinary = C.instanceInsert(definition.id, null, 1)!;
  expect(ordinary).toBeTruthy();
  expect(C.instances(definition.id)).toHaveLength(1);
  C.hist.u.length = 0; C.hist.r.length = 0; draw();
  const before = C.clone(C.doc());
  const metadata = row(definition.name).querySelector('small')!.textContent;
  expect(metadata).toContain('1 instance'); expect(metadata).toContain('1 mobile menu');
  const message = remove(definition.name);
  expect(message).toContain('one place using it keep what they show, as ordinary elements');
  expect(message).toContain('1 mobile menu references this layout');
  expect(message).toContain('If this layout is active');
  await confirmDelete();
  expect(C.findComponent(definition.id)).toBeNull();
  expect(ordinary.use).toBeUndefined();
  expect(C.renderNode(ordinary, { edit: false })).toContain('Private mobile content');
  expect(nav.props.mobileMenuComponent).toBeUndefined();
  expect(C.mobileMenuMode(nav)).toBe('follow');
  expect(C.mobileMenuDefinition(nav)?.id).toBe(follow.id);
  expect(nav.props.aria).toBe('Original navigation');
  expect(C.renderNode(nav, { edit: false })).not.toContain('Private mobile content');
  expect(C.hist.u).toHaveLength(1);
  expect(r.arg('toast')).toEqual(['Component deleted. Mobile menu references removed.']);
  const after = C.clone(C.doc());
  C.undo(); expect(C.doc()).toEqual(before);
  C.redo(); expect(C.doc()).toEqual(after);
});

test('ordinary-only deletion retains its existing confirmation, toast and content flattening', async () => {
  const original = C.insert('button', null, 0)!;
  original.props.text = 'Keep ordinary content';
  const cid = C.componentFromNode(original.id, 'Ordinary only')!;
  C.instanceInsert(cid, null, 1);
  C.hist.u.length = 0; C.hist.r.length = 0; draw();
  const before = C.clone(C.doc());
  const message = remove('Ordinary only');
  expect(message).toBe('Ordinary only stops being a component. The 2 places using it keep what they show, as ordinary elements — they simply stop changing together.');
  await confirmDelete();
  expect(C.findComponent(cid)).toBeNull();
  for (const node of C.state.pages[0].tree) {
    expect(node.use).toBeUndefined();
    expect(C.renderNode(node, { edit: false })).toContain('Keep ordinary content');
  }
  expect(r.arg('toast')).toEqual(['Component deleted. Existing instances are now ordinary elements.']);
  expect(C.hist.u).toHaveLength(1);
  C.undo(); expect(C.doc()).toEqual(before);
});
