// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { registerPainter } from '../app/src/ui/ctx';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(async () => {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  act(() => r.draw(null));
  r.host.remove();
});

test('button state click survives a text-field blur repaint', () => {
  const node = C.insert('heading', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.host.id = 'right';
  r.draw(() => <Inspector />, 'right');

  const idInput = r.$$('input').find(input => input.closest('.f')?.textContent?.includes('HTML id')) as HTMLInputElement;
  const hover = r.$$('button').find(button => button.textContent?.trim() === 'Hover')!;
  assert.ok(idInput);
  assert.ok(hover);
  let repaintCount = 0;
  /* A native pointer click cannot dispatch to a button removed during the preceding blur.
     Model that browser boundary while keeping the real Inspector handlers under test. */
  registerPainter('right', () => {
    repaintCount++;
    if (repaintCount === 1) hover.remove();
  });
  idInput.focus();
  r.type(idInput, 'hero-title');

  act(() => {
    hover.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    idInput.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: hover }));
    hover.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    if (hover.isConnected) hover.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  assert.equal(node.adv.htmlId, 'hero-title');
  assert.equal(C.state.ui.st, 'hover');
});

test('delayed pointerup keeps the target alive across animation frames', async () => {
  const node = C.insert('heading', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.host.id = 'right';
  r.draw(() => <Inspector />, 'right');
  const idInput = r.$$('input').find(input => input.closest('.f')?.textContent?.includes('HTML id')) as HTMLInputElement;
  const hover = r.$$('button').find(button => button.textContent?.trim() === 'Hover')!;
  registerPainter('right', () => hover.remove());
  idInput.focus();
  r.type(idInput, 'delayed-title');
  hover.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
  idInput.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: hover }));
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.ok(hover.isConnected, 'pointer activation must not use a short RAF timeout');
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8 }));
  assert.ok(hover.isConnected, 'an unrelated pointer release must not finish the activation');
  hover.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
  hover.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert.equal(C.state.ui.st, 'hover');
  assert.equal(node.adv.htmlId, 'delayed-title');
});

test('pointer cancellation releases the deferred repaint without selecting the state', async () => {
  const node = C.insert('heading', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.host.id = 'right';
  r.draw(() => <Inspector />, 'right');
  const idInput = r.$$('input').find(input => input.closest('.f')?.textContent?.includes('HTML id')) as HTMLInputElement;
  const hover = r.$$('button').find(button => button.textContent?.trim() === 'Hover')!;
  registerPainter('right', () => hover.remove());
  idInput.focus();
  r.type(idInput, 'cancelled-title');
  hover.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  idInput.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: hover }));
  document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
  assert.ok(hover.isConnected, 'cancel waits for the deferred repaint boundary');
  await new Promise(resolve => requestAnimationFrame(resolve));
  assert.ok(!hover.isConnected, 'cancel cleans up and repaints once');
  assert.equal(C.state.ui.st, '');
  assert.equal(node.adv.htmlId, 'cancelled-title');
});

test('keyboard focus waits while focused, then Enter activates the tab', async () => {
  const node = C.insert('heading', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.host.id = 'right';
  r.draw(() => <Inspector />, 'right');
  const idInput = r.$$('input').find(input => input.closest('.f')?.textContent?.includes('HTML id')) as HTMLInputElement;
  const styleTab = r.$$('button').find(button => button.textContent?.trim() === 'Style')!;
  registerPainter('right', () => styleTab.remove());
  idInput.focus();
  r.type(idInput, 'keyboard-title');
  styleTab.focus();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert.ok(styleTab.isConnected, 'focused keyboard target remains available across frames');
  assert.equal(document.activeElement, styleTab);
  styleTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  styleTab.click();
  assert.equal(C.state.ui.stab, 'style');
  assert.equal(node.adv.htmlId, 'keyboard-title');
});

test('keyboard Space activation reaches the State button after focus is stable', async () => {
  const node = C.insert('heading', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.host.id = 'right';
  r.draw(() => <Inspector />, 'right');
  const idInput = r.$$('input').find(input => input.closest('.f')?.textContent?.includes('HTML id')) as HTMLInputElement;
  const hover = r.$$('button').find(button => button.textContent?.trim() === 'Hover')!;
  registerPainter('right', () => hover.remove());
  idInput.focus();
  r.type(idInput, 'space-title');
  hover.focus();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert.ok(hover.isConnected);
  hover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert.ok(hover.isConnected, 'non-activation keys must preserve the focused target');
  hover.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert.ok(hover.isConnected, 'held Space must preserve the target until keyup and click');
  assert.equal(document.activeElement, hover);
  hover.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
  hover.click();
  assert.equal(C.state.ui.st, 'hover');
  assert.equal(node.adv.htmlId, 'space-title');
});

test('device button outside the inspector keeps its pointer activation', () => {
  const node = C.insert('heading', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.host.id = 'right';
  r.draw(() => <Inspector />, 'right');
  const devSeg = document.createElement('div');
  devSeg.id = 'devSeg';
  const tablet = document.createElement('button');
  tablet.dataset.dev = 'tablet';
  tablet.textContent = 'Tablet';
  tablet.addEventListener('click', () => { C.state.ui.dev = 'tablet'; });
  devSeg.append(tablet);
  document.body.append(devSeg);
  const idInput = r.$$('input').find(input => input.closest('.f')?.textContent?.includes('HTML id')) as HTMLInputElement;
  registerPainter('right', () => tablet.remove());
  idInput.focus();
  r.type(idInput, 'tablet-title');
  tablet.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  idInput.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: tablet }));
  tablet.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  tablet.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert.equal(C.state.ui.dev, 'tablet');
  assert.equal(node.adv.htmlId, 'tablet-title');
  devSeg.remove();
});

for (const interruption of ['blur', 'lostpointercapture']) {
  test(`pointer ${interruption} cleans pending activation before any later release`, async () => {
    const node = C.insert('heading', null, 0)!;
    C.selSet([node.id]);
    C.state.ui.stab = 'advanced';
    r.host.id = 'right';
    r.draw(() => <Inspector />, 'right');
    const input = r.$$('input').find(input => input.closest('.f')?.textContent?.includes('HTML id')) as HTMLInputElement;
    const hover = r.$$('button').find(button => button.textContent?.trim() === 'Hover')!;
    let paints = 0;
    registerPainter('right', () => { paints++; });
    input.focus();
    r.type(input, 'interrupted-title');
    hover.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 17 }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: hover }));
    const before = paints;
    window.dispatchEvent(interruption === 'blur' ? new Event('blur') : new PointerEvent('lostpointercapture', { pointerId: 17 }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    assert.equal(paints, before + 1, 'interruption releases exactly one pending repaint');
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 17 }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    assert.equal(paints, before + 1, 'later reused pointer release has no stale listener');
    assert.equal(node.adv.htmlId, 'interrupted-title');
    assert.equal(C.state.ui.st, '');
  });
}
