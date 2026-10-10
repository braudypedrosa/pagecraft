// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

let r: Rig;
const colour: Control = { t: 'color', c: 'color', label: 'Colour', r: 1 };
const gradient: Control = { t: 'color', c: 'background-image', label: 'Gradient', r: 1, paint: 1 };

beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function linkedHeading() {
  const n = C.insert('heading', null, 0)!;
  n.css.d.color = C.cvar('ink');
  C.selSet([n.id]);
  return n;
}

function openPicker(n: ReturnType<typeof linkedHeading>) {
  r.draw(<Ctl n={n} c={colour} />);
  act(() => r.click(r.$('button.sw')));
  return r.$('input.cp-val') as HTMLInputElement;
}

function gradientHeading() {
  const n = C.insert('heading', null, 0)!;
  n.css.d['background-image'] = 'linear-gradient(90deg, #111311, #b7f34a)';
  C.selSet([n.id]);
  return n;
}

function openGradientPicker(n: ReturnType<typeof gradientHeading>) {
  r.draw(<Ctl n={n} c={gradient} />);
  act(() => r.click(r.$('button.sw')));
  return r.$('input.cp-val') as HTMLInputElement;
}

test('focusing a linked colour and pressing Escape or blurring keeps the token link', () => {
  const n = linkedHeading();
  const input = openPicker(n);

  act(() => {
    input.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  assert.equal(n.css.d.color, C.cvar('ink'));
  assert.equal(r.names().includes('save'), false, 'an unchanged field must not create a save');

  const secondInput = openPicker(n);
  act(() => { secondInput.dispatchEvent(new FocusEvent('blur', { bubbles: true })); });
  assert.equal(n.css.d.color, C.cvar('ink'));
  assert.equal(r.names().includes('save'), false, 'an unchanged blur must not create a save');
});

test('editing the value commits the literal colour on blur', () => {
  const n = linkedHeading();
  const input = openPicker(n);

  act(() => r.type(input, '#abcdef'));
  act(() => { input.dispatchEvent(new FocusEvent('blur', { bubbles: true })); });
  assert.equal(n.css.d.color, '#abcdef');
  assert.ok(r.names().includes('save'), 'a changed value should use the hard writer');
});

test('gradient stop focus and blur keeps the gradient, and an edit commits through it', () => {
  const n = gradientHeading();
  const input = openGradientPicker(n);
  const secondStop = r.$$('.cp-stops button')[1];

  act(() => secondStop.click());
  const untouched = n.css.d['background-image'];
  act(() => {
    input.focus();
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  });
  assert.equal(n.css.d['background-image'], untouched);

  const edited = openGradientPicker(n);
  act(() => r.$$('.cp-stops button')[1].click());
  act(() => r.type(edited, '#abcdef'));
  act(() => { edited.dispatchEvent(new FocusEvent('blur', { bubbles: true })); });
  assert.match(String(n.css.d['background-image']), /^linear-gradient\(90deg,/);
  assert.match(String(n.css.d['background-image']), /#abcdef/);
});
