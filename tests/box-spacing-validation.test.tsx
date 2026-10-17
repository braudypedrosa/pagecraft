// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const node = () => {
  const n = C.insert('heading', null, 0)!;
  C.selSet([n.id]);
  return n;
};

test('padding clamps negative finite input and advertises a nonnegative minimum', () => {
  const n = node();
  const padding: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };
  r.draw(<Ctl n={n} c={padding} />);
  const input = r.$('input[data-field-part="top"]') as HTMLInputElement;

  act(() => r.pick(r.$('select[data-field-part="unit"]')!, 'rem'));
  act(() => r.type(input, '-1.25'));

  assert.equal(n.css.d['padding-top'], '0rem');
  assert.equal(input.value, '0');
  assert.equal(input.min, '0');
});

test('margin preserves negative decimals and empty values unset the side', () => {
  const n = node();
  const margin: Control = { t: 'box', c: 'margin', label: 'Margin', r: 1, neg: 1 };
  r.draw(<Ctl n={n} c={margin} />);
  const input = r.$('input[data-field-part="right"]') as HTMLInputElement;

  assert.equal(input.min, '');
  act(() => r.pick(r.$('select[data-field-part="unit"]')!, 'em'));
  act(() => r.type(input, '-1.25'));
  assert.equal(input.value, '-1.25');
  assert.equal(n.css.d['margin-right'], '-1.25em');

  act(() => r.type(input, ''));
  assert.equal(n.css.d['margin-right'], undefined);
});

test('box writes retain all units and responsive, state, and class destinations', () => {
  for (const unit of ['px', 'rem', '%', 'em']) {
    const n = node();
    const padding: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };
    r.draw(<Ctl n={n} c={padding} />);
    act(() => r.pick(r.$('select[data-field-part="unit"]')!, unit));
    act(() => r.type(r.$('input[data-field-part="top"]')!, '1.5'));
    assert.equal(n.css.d['padding-top'], `1.5${unit}`);
    r.draw(null);
  }

  const responsive = node();
  C.state.ui.dev = 'mobile';
  r.draw(<Ctl n={responsive} c={{ t: 'box', c: 'padding', label: 'Padding', r: 1 }} />);
  act(() => r.pick(r.$('select[data-field-part="unit"]')!, 'rem'));
  act(() => r.type(r.$('input[data-field-part="right"]')!, '2'));
  assert.equal(responsive.css.m['padding-right'], '2rem');
  r.draw(null);

  const state = node();
  C.state.ui.dev = 'desktop';
  C.state.ui.st = 'hover';
  r.draw(<Ctl n={state} c={{ t: 'box', c: 'padding', label: 'Padding', r: 1 }} />);
  act(() => r.type(r.$('input[data-field-part="bottom"]')!, '3'));
  assert.equal(state.st?.hover?.d['padding-bottom'], '3px');
  r.draw(null);

  const target = node();
  const classId = C.classAdd('Spacing', { d: {}, t: {}, m: {} });
  C.classApply(target, classId);
  C.state.ui.st = '';
  C.state.ui.target = classId;
  r.draw(<Ctl n={target} c={{ t: 'box', c: 'padding', label: 'Padding', r: 1 }} />);
  act(() => r.type(r.$('input[data-field-part="left"]')!, '4'));
  assert.equal(C.findClass(classId)!.css.d['padding-left'], '4px');
  assert.equal(target.css.d['padding-left'], undefined);
});
