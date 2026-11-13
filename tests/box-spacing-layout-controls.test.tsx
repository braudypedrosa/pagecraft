// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import type { Control } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

test('spacing controls retain contextual names, native numeric constraints and side-first tab order', () => {
  const n = C.insert('heading', null, 0)!;
  const c: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };
  r.draw(<Ctl n={n} c={c} />);

  expect(r.$$('input,select').map(control => control.getAttribute('aria-label')))
    .toEqual(['Padding top', 'Padding right', 'Padding bottom', 'Padding left', 'Padding unit']);
  for (const input of r.$$('input') as HTMLInputElement[]) {
    expect(input.type).toBe('number');
    expect(input.step).toBe('any');
    expect(input.min).toBe('0');
    expect([...input.labels!].some(label => label.querySelector('span')?.textContent === input.dataset.fieldPart)).toBe(true);
  }
  const unit = r.$('select') as HTMLSelectElement;
  expect([...unit.options].map(option => option.value)).toEqual(['px', 'rem', '%', 'em']);
});

test('the separate Unit row still converts all four populated sides and keeps signed and fractional values', () => {
  const n = C.insert('heading', null, 0)!;
  C.selSet([n.id]);
  n.css.d.margin = '13px 125px -125px 1.5px';
  const c: Control = { t: 'box', c: 'margin', label: 'Margin', r: 1, neg: 1 };
  r.draw(<Ctl n={n} c={c} />);
  expect(r.$$('input').map(input => (input as HTMLInputElement).value)).toEqual(['13', '125', '-125', '1.5']);
  act(() => r.pick(r.$('select[data-field-part="unit"]')!, 'rem'));

  expect(n.css.d.margin).toBeUndefined();
  for (const [side, value] of [['top', '13'], ['right', '125'], ['bottom', '-125'], ['left', '1.5']]) {
    expect(n.css.d['margin-' + side]).toBe(value + 'rem');
  }
  expect((r.$('input[data-field-part="bottom"]') as HTMLInputElement).min).toBe('');
});
