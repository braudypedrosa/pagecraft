// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { HelpTip } from '../app/src/ui/HelpTip';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function inspect(n: ReturnType<typeof C.N>, tab: 'content' | 'style' | 'advanced' = 'content',
  dev: 'desktop' | 'tablet' | 'mobile' = 'desktop') {
  C.state.pages[0].tree = [n];
  C.state.ui.stab = tab;
  C.state.ui.dev = dev;
  C.selSet([n.id]);
  r.draw(() => <Inspector />, 'right');
}

const tipFor = (button: Element) => document.getElementById(button.getAttribute('aria-describedby')!)!;

test('container controls remain available without instructional disclosures', () => {
  for (const node of [C.N('section'), C.N('row'), C.N('box', { layout: 'block' }),
    C.N('box', { layout: 'flex' }), C.N('box', { layout: 'grid' })]) {
    inspect(node);
    assert.equal(r.$('.pc-context-help'), null);
    assert.ok(r.$('.gh'));
  }
});

test('optional help opens on focus, dismisses with Escape, and keeps focus on its trigger', () => {
  r.draw(<HelpTip label="Example" text="Useful guidance" />);
  const button = r.$('button')!;
  const tip = tipFor(button);
  assert.equal(tip.hidden, true);
  act(() => button.focus());
  assert.equal(tip.hidden, false);
  assert.equal(tip.getAttribute('role'), 'tooltip');
  assert.equal(tip.textContent, 'Useful guidance');
  act(() => { button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  assert.equal(tip.hidden, true);
  assert.equal(document.activeElement, button);
  act(() => r.click(button));
  assert.equal(tip.hidden, false, 'tap/click reopens dismissed help');
  act(() => { window.dispatchEvent(new Event('scroll')); });
  assert.equal(tip.hidden, true, 'scroll closes stale positioned help');
});

test('help opens on hover and disappears when its owning control unmounts', () => {
  r.draw(<HelpTip label="Example" text="Useful guidance" />);
  const button = r.$('button')!;
  const tip = tipFor(button);
  act(() => { button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
  assert.equal(tip.hidden, false);
  act(() => r.draw(null));
  assert.equal(document.getElementById(tip.id), null, 'tooltip content is cleaned up');
});

test('content-only accounts keep editable copy with a compact shared-content state', () => {
  r.host.remove(); r = rig({ canStructure: false });
  inspect(C.N('heading', { text: 'Shared heading' }), 'advanced', 'tablet');
  assert.equal(r.$('.tabs'), null);
  assert.equal(r.$('.pc-context-help'), null);
  assert.equal(r.$('.pc-shared-status')!.textContent, 'Shared');
  const editor = r.$('textarea') as HTMLTextAreaElement;
  assert.equal(editor.value, 'Shared heading');
  assert.equal(editor.disabled, false);
  assert.ok(editor.getAttribute('aria-describedby')?.includes(r.$('.pc-shared-status')!.id));
});

test('responsive scope stays at the field and reset restores inherited values', () => {
  const heading = C.N('heading');
  heading.css.d['font-size'] = '48px';
  heading.css.t['font-size'] = '34px';
  inspect(heading, 'style', 'mobile');
  assert.equal(r.$('.pc-context-help'), null);
  assert.match(r.$('.pc-responsive-status')!.getAttribute('title')!, /Tablet where set, then Desktop/);
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).value, '34');
  heading.css.m['font-size'] = '28px';
  r.draw(() => <Inspector />);
  const reset = r.$('button.rsp[aria-label="Clear Mobile override for Size"]')!;
  assert.ok(reset);
  r.click(reset);
  assert.equal(heading.css.m['font-size'], undefined);
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).value, '34');
});

test('committing a Padding edit refreshes its badge without remounting the field', () => {
  inspect(C.N('section'), 'style', 'tablet');
  const spacing = r.$$('.group').find(group => group.querySelector('.gh')?.textContent?.includes('Spacing'))!;
  const top = spacing.querySelector('input[data-field-part="top"]') as HTMLInputElement;
  top.focus(); r.type(top, '84');
  assert.equal(r.$('input[data-field-part="top"]'), top);
  assert.equal(document.activeElement, top);
  top.blur();
  assert.equal(r.$('input[data-field-part="top"]'), top);
  const reset = spacing.querySelector('button.rsp[aria-label="Clear Tablet override for Padding"]')!;
  assert.ok(reset);
  r.click(reset);
  assert.equal(spacing.querySelector('button.rsp[aria-label="Clear Tablet override for Padding"]'), null);
});

test('CMS source controls retain selection, binding and on-demand guidance', () => {
  const section = C.N('section');
  const collection = C.collectionAdd('Projects')!;
  inspect(section, 'advanced');
  const select = r.$('select[aria-label="Content source collection"]')!;
  const panel = select.closest('.group')!;
  const tip = tipFor(panel.querySelector('.pc-help-trigger')!);
  assert.equal(tip.hidden, true);
  assert.match(tip.textContent!, /bind its fields/);
  r.pick(select, collection.id);
  r.draw(() => <Inspector />);
  r.click(panel.querySelector('button.btn.block')!);
  assert.deepEqual(r.arg('bindModal'), [section.id]);
  assert.equal(section.src, collection.id);
});
