// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Control, Node as PcNode } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function field(n: PcNode, c: Control) {
  r.draw(<Ctl n={n} c={c} />);
  return r.$('input[data-field-part="value"]') as HTMLInputElement;
}

/* jsdom cannot retain Chromium's internal `2.` editing buffer: its public value is
   `2`, while the next key still completes `2.5`. Model that browser boundary only.
   A programmatic value write discards the draft and moves the caret, even if the
   public value was already equal. Real native typing is checked separately. */
function nativeNumberDraft(input: HTMLInputElement) {
  const value = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
  let draft = '', writes = 0;
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return value.get!.call(input); },
    set(next: string) { writes++; draft = String(next); value.set!.call(input, next); }
  });
  return {
    type(text: string) {
      draft = '';
      for (const character of text) {
        draft += character;
        value.set!.call(input, draft.endsWith('.') ? draft.slice(0, -1) : draft);
        act(() => { input.dispatchEvent(new Event('input', { bubbles: true })); });
      }
      act(() => { input.dispatchEvent(new Event('blur', { bubbles: true })); });
    },
    writes: () => writes
  };
}

for (const key of ['per', 'limit'] as const) test(`sequential List ${key} decimal entry rounds and persists without redundant draft resets`, () => {
  const list = C.insert('list', null, 0)!;
  const control = C.DEF.list.controls.content.find(c => c.k === key)!;
  const input = field(list, control), native = nativeNumberDraft(input);
  native.type('2.5');
  assert.equal(input.value, '3');
  assert.equal(list.props[key], '3');
  assert.equal(native.writes(), 1, 'only the actual fractional normalization may replace the native draft');
  const snapshot = C.clone(C.doc());
  act(() => r.draw(null)); C.blankProject('Reload'); C.restore(snapshot);
  const restored = C.locate(list.id)!.node;
  assert.equal(field(restored, control).value, '3');
});

test('ordinary sequential integer digits do not receive value writes or reverse their order', () => {
  const list = C.insert('list', null, 0)!;
  const input = field(list, C.DEF.list.controls.content.find(c => c.k === 'per')!);
  const native = nativeNumberDraft(input);
  native.type('12');
  assert.equal(input.value, '12'); assert.equal(list.props.per, '12');
  assert.equal(native.writes(), 0);
});

test('integer clamps, negative CSS values, zero and clearing retain existing rules', () => {
  const heading = C.insert('heading', null, 0)!;
  const controls: Array<[Control, string, string]> = [
    [{ t: 'unit', c: 'z-index', label: 'Z-index', integer: 1, neg: 1, units: [''] }, '-2.7', '-3'],
    [{ t: 'unit', c: '--count', label: 'Count', integer: 1, min: 1, max: 4, units: [''] }, '9', '4'],
    [{ t: 'unit', c: '--count', label: 'Count', integer: 1, units: [''] }, '-2', '0'],
    [{ t: 'unit', c: '--count', label: 'Count', integer: 1, units: [''] }, '0', '0'],
    [{ t: 'unit', c: '--count', label: 'Count', integer: 1, units: [''] }, '', '']
  ];
  for (const [control, raw, expected] of controls) {
    const input = field(heading, control);
    act(() => r.type(input, raw));
    assert.equal(input.value, expected); assert.equal(heading.css.d[control.c!] ?? '', expected);
    r.draw(null);
  }
});

test('sequential noninteger lengths retain decimal precision and avoid draft writes', () => {
  const heading = C.insert('heading', null, 0)!;
  const input = field(heading, { t: 'unit', c: 'width', label: 'Width', units: ['px'] });
  const native = nativeNumberDraft(input);
  native.type('2.5');
  assert.equal(input.value, '2.5'); assert.equal(heading.css.d.width, '2.5px');
  assert.equal(native.writes(), 0);
});
