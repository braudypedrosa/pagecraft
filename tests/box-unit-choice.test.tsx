// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

let r: Rig;
const padding: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };

beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function heading() {
  const n = C.insert('heading', null, 0)!;
  C.selSet([n.id]);
  return n;
}

function unit() {
  return r.$('select[data-field-part="unit"]') as HTMLSelectElement;
}

test('empty box unit choice stays UI-only, then applies to first value', () => {
  const n = heading();
  r.draw(<Ctl n={n} c={padding} />);
  const beforeHistory = C.hist.u.length;

  act(() => r.pick(unit(), 'rem'));
  assert.equal(unit().value, 'rem');
  assert.equal(n.css.d.padding, undefined);
  assert.equal(n.css.d['padding-top'], undefined);
  assert.equal(C.hist.u.length, beforeHistory, 'unit choice alone must not create history');

  act(() => r.type(r.$('input[data-field-part="top"]')!, '8'));
  assert.equal(n.css.d['padding-top'], '8rem');
  assert.equal(n.css.d['padding-right'], undefined);
  assert.equal(unit().value, 'rem');
});

test('empty box unit choice resets across breakpoint, state, and class target scopes', () => {
  const n = heading();
  r.draw(<Ctl n={n} c={padding} />);

  act(() => r.pick(unit(), 'rem'));
  assert.equal(unit().value, 'rem');

  C.state.ui.dev = 'mobile';
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(unit().value, 'px');
  act(() => r.pick(unit(), 'em'));
  assert.equal(unit().value, 'em');
  assert.equal(n.css.m['padding-top'], undefined);

  C.state.ui.st = 'hover';
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(unit().value, 'px');
  act(() => r.pick(unit(), '%'));
  assert.equal(unit().value, '%');
  assert.equal(n.st?.hover?.m['padding-top'], undefined);

  const classId = C.classAdd('Spacing', { d: {}, t: {}, m: {} });
  C.classApply(n, classId);
  C.state.ui.target = classId;
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(unit().value, 'px');
  act(() => r.pick(unit(), 'em'));
  assert.equal(unit().value, 'em');
  assert.equal(C.findClass(classId)!.css.d['padding-top'], undefined);
  assert.equal(n.css.d['padding-top'], undefined);
});
