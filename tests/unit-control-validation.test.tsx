// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { advControls } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';
import type { Control, Node as PcNode } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const node = (type: 'heading' | 'gallery' | 'list' | 'button' | 'nav' = 'heading') => {
  const n = C.insert(type, null, 0)!;
  C.selSet([n.id]);
  return n;
};

const valueInput = () => r.$('input[data-field-part="value"]') as HTMLInputElement;
const unitSelect = () => r.$('select[data-field-part="unit"]') as HTMLSelectElement;

const enter = (n: PcNode, control: Control, value: string, unit?: string) => {
  r.draw(<Ctl n={n} c={control} />);
  if (unit !== undefined) act(() => r.pick(unitSelect(), unit));
  act(() => r.type(valueInput(), value));
  return valueInput();
};

test('nonnegative unit controls clamp collection gaps, dimensions, and custom gaps in every supported unit', () => {
  const controls: Control[] = [
    C.DEF.list.controls.content.find(control => control.c === 'gap')!,
    { t: 'unit', c: 'width', label: 'Width', r: 1, units: ['px', 'rem', '%', 'em'] },
    { t: 'unit', c: 'height', label: 'Height', r: 1, units: ['px', 'rem', '%', 'em'] },
    { t: 'unit', c: '--custom-gap', label: 'Custom gap', r: 1, units: ['px', 'rem', '%', 'em'] },
    { t: 'unit', c: '--field-gap', label: 'Field gap', r: 1, units: ['px', 'rem', '%', 'em'] }
  ];

  for (const control of controls) {
    for (const unit of ['px', 'rem', '%', 'em']) {
      const n = node('list');
      const input = enter(n, { ...control, units: ['px', 'rem', '%', 'em'] }, '-2.5', unit);
      assert.equal(n.css.d[control.c!], `0${unit}`);
      assert.equal(input.min, '0');
      assert.equal(input.value, '0');
      r.draw(null);
    }
  }
});

test('Gallery columns honor their explicit minimum while legitimate negative controls remain negative', () => {
  const gallery = node('gallery');
  const columns = C.DEF.gallery.controls.content.find(control => control.c === '--g-cols')!;
  const columnsInput = enter(gallery, columns, '0');
  assert.equal(columnsInput.min, '1');
  assert.equal(columnsInput.value, '1');
  assert.equal(gallery.css.d['--g-cols'], '1');
  r.draw(null);

  for (const type of ['heading', 'button', 'nav'] as const) {
    const target = node(type);
    const letterSpacing = C.DEF[type].controls.style.find(control => control.c === 'letter-spacing')!;
    const input = enter(target, letterSpacing, '-0.25', 'em');
    assert.equal(input.min, '');
    assert.equal(input.value, '-0.25');
    assert.equal(target.css.d['letter-spacing'], '-0.25em');
    r.draw(null);
  }

  const heading = node();
  for (const [control, value, expected] of [
    [advControls(heading).find(control => control.c === 'top')!, '-12.5', '-12.5px'],
    [advControls(heading).find(control => control.c === 'z-index')!, '-3', '-3']
  ] as Array<[Control, string, string]>) {
    const input = enter(heading, control, value);
    assert.equal(input.min, '');
    assert.equal(input.value, value);
    assert.equal(heading.css.d[control.c!], expected);
    r.draw(null);
  }
});

test('explicit bounds clamp only out-of-range finite values and empty input still clears', () => {
  const n = node();
  const bounded: Control = { t: 'unit', c: 'width', label: 'Width', r: 1, min: 2, max: 5, units: ['px'] };
  let input = enter(n, bounded, '-9');
  assert.equal(input.min, '2');
  assert.equal(input.max, '5');
  assert.equal(input.value, '2');
  assert.equal(n.css.d.width, '2px');

  act(() => r.type(input, '9'));
  assert.equal(input.value, '5');
  assert.equal(n.css.d.width, '5px');

  act(() => r.type(input, '2.50'));
  assert.equal(input.value, '2.50');
  assert.equal(n.css.d.width, '2.50px');

  act(() => r.type(input, ''));
  assert.equal(n.css.d.width, undefined);
});

test('unit validation preserves responsive, state, class, and empty unit-choice destinations', () => {
  const control: Control = { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: ['px', 'rem', '%', 'em'] };
  const responsive = node();
  C.state.ui.dev = 'mobile';
  enter(responsive, control, '1.25', 'rem');
  assert.equal(responsive.css.m.gap, '1.25rem');
  assert.equal(responsive.css.d.gap, undefined);
  r.draw(null);

  const state = node();
  C.state.ui.dev = 'desktop';
  C.state.ui.st = 'hover';
  enter(state, control, '2.5', '%');
  assert.equal(state.st?.hover?.d.gap, '2.5%');
  r.draw(null);

  const target = node();
  const classId = C.classAdd('Unit target', { d: {}, t: {}, m: {} });
  C.classApply(target, classId);
  C.state.ui.st = '';
  C.state.ui.target = classId;
  enter(target, control, '3.75', 'em');
  assert.equal(C.findClass(classId)!.css.d.gap, '3.75em');
  assert.equal(target.css.d.gap, undefined);
  r.draw(null);

  const empty = node();
  C.state.ui.target = '';
  r.draw(<Ctl n={empty} c={control} />);
  act(() => r.pick(unitSelect(), 'rem'));
  assert.equal(empty.css.d.gap, undefined, 'unit choice stays UI-only while the value is empty');
  act(() => r.type(valueInput(), '4.5'));
  assert.equal(empty.css.d.gap, '4.5rem');
});
