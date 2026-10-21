// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

async function open(paint = false) {
  const node = C.insert(paint ? 'section' : 'heading', null, 0)!;
  const key = paint ? 'background-color' : 'color';
  node.css.d[key] = '#3366cc';
  C.selSet([node.id]);
  r.draw(() => <Ctl n={node} c={{ t: 'color', c: key, label: 'Colour', paint: paint ? 1 : undefined }} />, 'right');
  const anchor = r.$('button.sw')!;
  anchor.focus();
  await act(async () => { r.click(anchor); await new Promise(resolve => setTimeout(resolve, 40)); });
  return { node, key, anchor };
}

for (const paint of [false, true]) test(`${paint ? 'solid/gradient' : 'solid'} picker exposes the advertised named nonmodal dialog and receives focus`, async () => {
  const { anchor, node, key } = await open(paint);
  assert.equal(anchor.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(anchor.getAttribute('aria-expanded'), 'true');
  const dialogs = r.$$('[role="dialog"]');
  assert.equal(dialogs.length, 1, 'the actual opened picker must be discoverable as a dialog');
  const dialog = dialogs[0];
  assert.equal(dialog.getAttribute('aria-label'), 'Colour picker');
  assert.notEqual(dialog.getAttribute('aria-modal'), 'true', 'outside inspector controls remain available');
  assert.equal(document.activeElement, dialog.querySelector('.cp-sv'));
  assert.ok(dialog.querySelector('input[aria-label="Colour value"]'));
  if (paint) {
    const gradient = [...dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === 'Gradient')!;
    act(() => r.click(gradient));
    assert.equal(r.$$('[role="dialog"]').length, 1);
    assert.equal(r.$('[role="dialog"]')!.getAttribute('aria-label'), 'Colour picker');
    assert.match(node.css.d['background-image'], /^linear-gradient/);
  } else assert.equal(node.css.d[key], '#3366cc', 'opening alone must not write a colour');
});

test('named dialog retains keyboard colour editing and Escape restores the actual swatch', async () => {
  const { node, key, anchor } = await open();
  const hue = r.$('[role="dialog"] [aria-label="Hue"]')!;
  const before = node.css.d[key];
  act(() => { hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); });
  assert.notEqual(node.css.d[key], before);
  const edited = node.css.d[key], depth = C.hist.u.length;
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  assert.equal(r.$('[role="dialog"]'), null);
  assert.equal(anchor.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, anchor);
  assert.equal(node.css.d[key], edited);
  assert.equal(C.hist.u.length, depth, 'closing must not create an extra colour edit');
});

for (const device of ['desktop', 'tablet', 'mobile'] as const) for (const side of ['top', 'right']) test(`outside Padding ${side} keeps focus after gradient picker dismissal on ${device}`, async () => {
  const { mount } = await import('../app/src/ui/index');
  const { stubLegacy } = await import('./ui.setup');
  const right = document.createElement('div'); right.id = 'right'; document.body.append(right);
  const section = C.insert('section', null, 0)!;
  C.selSet([section.id]); C.state.ui.stab = 'style'; C.state.ui.dev = device;
  section.css.d['background-color'] = '#3366cc';
  section.css.d['background-image'] = 'linear-gradient(90deg, #3366cc, #ffffff)';
  const previousMotion = window.__pcMotion;
  window.__pcMotion = { reduced: () => false, enter() {}, exit: () => Promise.resolve() } as any;
  try {
    const ui = mount(C, stubLegacy([]));
    act(() => ui.renderRight());
    const swatch = right.querySelector<HTMLElement>('button.sw')!;
    assert.ok(swatch, 'the real Section inspector exposes a background picker');
    await act(async () => { swatch.click(); await new Promise(resolve => setTimeout(resolve, 40)); });
    assert.ok(right.querySelector('[role="dialog"]'));
    const padding = right.querySelector<HTMLInputElement>(`input[aria-label="Padding ${side}"]`)!;
    assert.ok(padding);
    await act(async () => {
      padding.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      padding.focus(); // The browser's pointer default action runs before the exit resolves.
      await new Promise(resolve => setTimeout(resolve, 40));
    });
    assert.equal(right.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, padding, 'dismissal must not autofocus the departing picker');
    act(() => { padding.value = '19'; padding.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(section.css[C.dk()][`padding-${side}`], '19px', 'destination remains editable');
  } finally {
    window.__pcMotion = previousMotion;
    act(() => render(null, right)); right.remove();
  }
});
