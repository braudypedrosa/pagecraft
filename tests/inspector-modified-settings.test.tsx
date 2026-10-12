// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { commonControlsFirst, controlIsModified } from '../app/src/ui/inspector/scope';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function inspect(node = C.insert('heading', null, 0)!, tab: 'style' | 'advanced' = 'style', device: 'desktop' | 'tablet' | 'mobile' = 'mobile') {
  C.selSet([node.id]);
  C.state.ui.stab = tab;
  C.state.ui.dev = device;
  r.draw(() => <Inspector />, 'right');
  return node;
}

function showModified() {
  const input = r.$('.inspector-modified-filter input') as HTMLInputElement;
  act(() => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function button(text: string) {
  return r.$$('button').find(item => item.textContent?.trim() === text) || null;
}

test('modified filter reads only the selected breakpoint, state, and target', () => {
  const node = C.insert('heading', null, 0)!;
  node.css.m['font-size'] = '24px';
  node.st = { hover: { d: {}, t: {}, m: { color: '#123456' } } };
  const classId = C.classAdd('Accent', { m: { 'letter-spacing': '1px' } });
  C.classApply(node, classId);
  inspect(node);

  showModified();
  expect(r.host.textContent).toContain('Size');
  expect(r.host.textContent).not.toContain('Letter spacing');

  C.state.ui.st = 'hover';
  r.draw(() => <Inspector />, 'right');
  expect(r.host.textContent).toContain('Colour');
  expect(r.host.textContent).not.toContain('Size');

  C.state.ui.st = '';
  C.state.ui.target = classId;
  r.draw(() => <Inspector />, 'right');
  expect(r.host.textContent).toContain('Letter spacing');
  expect(r.host.textContent).not.toContain('Size');
});

test('modified filter has a useful empty state on Style and Advanced', () => {
  const node = inspect();
  showModified();
  expect(r.$('.inspector-modified-empty')?.textContent).toBe('No modified settings in this scope.');

  C.state.ui.stab = 'advanced';
  r.draw(() => <Inspector />, 'right');
  expect(r.$('.inspector-modified-empty')?.textContent).toBe('No modified settings in this scope.');
  node.adv.css = '& { isolation: isolate; }';
  r.draw(() => <Inspector />, 'right');
  expect(r.host.textContent).toContain('Custom CSS');
  expect(r.host.textContent).not.toContain('HTML id');
});

test('element breakpoint reset clears only its current layer and is undoable', () => {
  const node = C.insert('heading', null, 0)!;
  node.css.d['font-size'] = '48px';
  node.css.t['font-size'] = '36px';
  node.css.m['font-size'] = '24px';
  node.css.m.color = '#123456';
  const classId = C.classAdd('Accent', { m: { color: '#abcdef' } });
  C.classApply(node, classId);
  inspect(node);

  r.click(button('Reset mobile changes'));
  expect(node.css.m).toEqual({});
  expect(node.css.t['font-size']).toBe('36px');
  expect(node.css.d['font-size']).toBe('48px');
  expect(C.findClass(classId)!.css.m.color).toBe('#abcdef');
  C.undo();
  const restored = C.locate(node.id)!.node;
  expect(restored.css.m['font-size']).toBe('24px');
  expect(restored.css.m.color).toBe('#123456');
});

test('breakpoint reset follows state and stays unavailable for Desktop and class targets', () => {
  const node = C.insert('heading', null, 0)!;
  node.css.m['font-size'] = '24px';
  node.st = { hover: { d: {}, t: {}, m: { color: '#123456' } } };
  inspect(node);
  C.state.ui.st = 'hover';
  r.draw(() => <Inspector />, 'right');
  r.click(button('Reset mobile changes'));
  expect(node.st.hover!.m).toEqual({});
  expect(node.css.m['font-size']).toBe('24px');

  C.state.ui.dev = 'desktop';
  r.draw(() => <Inspector />, 'right');
  expect(button('Reset desktop changes')).toBeNull();

  const classId = C.classAdd('Accent', { m: { color: '#abcdef' } });
  C.classApply(node, classId);
  C.state.ui.dev = 'mobile';
  C.state.ui.st = '';
  C.state.ui.target = classId;
  r.draw(() => <Inspector />, 'right');
  expect(button('Reset mobile changes')).toBeNull();
});

test('common ordering is stable and modified detection handles compound controls', () => {
  const controls: Control[] = [
    { t: 'select', c: 'overflow', label: 'Overflow', opts: [] },
    { t: 'link', k: 'link', label: 'Link' },
    { t: 'color', c: 'color', label: 'Colour' },
    { t: 'unit', c: 'font-size', label: 'Size' },
    { t: 'box', c: 'padding', label: 'Padding' },
  ];
  expect(commonControlsFirst(controls).map(control => control.label))
    .toEqual(['Size', 'Padding', 'Colour', 'Link', 'Overflow']);
  expect(controlIsModified({ t: 'box', c: 'padding', label: 'Padding' }, { 'padding-left': '8px' })).toBe(true);
  expect(controlIsModified({ t: 'border', label: 'Border' }, { 'border-top-width': '1px' })).toBe(true);
});

test('custom transforms live in Advanced, while modified transitions stay visible in Style', () => {
  const node = inspect();
  node.css.m.transition = 'color .2s linear';
  node.css.m.transform = 'rotate(2deg)';
  r.draw(() => <Inspector />, 'right');
  expect(r.host.textContent).not.toContain('Effects');
  showModified();
  expect(r.host.textContent).toContain('Transition');
  expect(r.host.textContent).not.toContain('Animation');
  expect(r.$('.inspector-modified-empty')).toBeNull();
  C.state.ui.stab = 'advanced';
  r.draw(() => <Inspector />, 'right');
  expect(r.host.textContent).toContain('Effects');
  expect(r.host.textContent).toContain('Transform');
  expect(r.host.textContent).not.toContain('Opacity');
});
