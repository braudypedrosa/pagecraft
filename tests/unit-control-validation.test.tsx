// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { advControls } from '../app/src/ui/inspector/Inspector';
import { installCustomSelects } from '../shared/custom-select.js';
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

test('integer CSS controls round fractional input while lengths retain decimals', () => {
  const gallery = node('gallery');
  const columns = C.DEF.gallery.controls.content.find(control => control.c === '--g-cols')!;
  const columnsInput = enter(gallery, columns, '2.5');
  assert.equal(columnsInput.value, '3');
  assert.equal(gallery.css.d['--g-cols'], '3');
  r.draw(null);

  const heading = node();
  const zIndex = advControls(heading).find(control => control.c === 'z-index')!;
  const zInput = enter(heading, zIndex, '2.5');
  assert.equal(zInput.value, '3');
  assert.equal(heading.css.d['z-index'], '3');
  r.draw(null);

  const length = advControls(heading).find(control => control.c === 'top')!;
  const lengthInput = enter(heading, length, '2.5');
  assert.equal(lengthInput.value, '2.5');
  assert.equal(heading.css.d.top, '2.5px');
});

test('native step validity matches decimal, explicit-step, and integer unit rules', () => {
  const heading = node();
  const top = advControls(heading).find(control => control.c === 'top')!;
  const topInput = enter(heading, top, '-1.5');
  assert.equal(topInput.step, 'any');
  assert.equal(topInput.validity.valid, true, 'a stored fractional length must remain natively valid');
  r.draw(null);

  const measured: Control = {
    t: 'unit', c: 'width', label: 'Measured width', r: 1, min: 0, step: .25, units: ['px']
  };
  const measuredInput = enter(heading, measured, '1.25');
  assert.equal(measuredInput.step, '0.25');
  assert.equal(measuredInput.validity.valid, true);
  measuredInput.value = '1.1';
  assert.equal(measuredInput.validity.stepMismatch, true, 'an explicit step remains a native constraint');
  r.draw(null);

  const zIndex = advControls(heading).find(control => control.c === 'z-index')!;
  r.draw(<Ctl n={heading} c={zIndex} />);
  const zInput = valueInput();
  assert.equal(zInput.step, '1');
  zInput.value = '-2.7';
  assert.equal(zInput.validity.stepMismatch, true, 'integer controls retain their whole-number constraint');
  act(() => r.type(zInput, '-2.7'));
  assert.equal(zInput.value, '-3');
  assert.equal(zInput.validity.valid, true);
});

test('integer controls canonicalize finite numeric spellings without rewriting lengths', () => {
  const heading = node();
  const zIndex = advControls(heading).find(control => control.c === 'z-index')!;
  for (const [raw, expected] of [
    ['2e0', '2'], ['2.0', '2'], ['-2e0', '-2'], ['2e-1', '0'], ['-0', '0'],
    ['1e21', '1000000000000000000000'],
  ]) {
    const input = enter(heading, zIndex, raw);
    assert.equal(input.value, expected);
    assert.equal(heading.css.d['z-index'], expected);
    r.draw(null);
  }

  const length = advControls(heading).find(control => control.c === 'top')!;
  const lengthInput = enter(heading, length, '2e0');
  assert.equal(lengthInput.value, '2e0');
  assert.equal(heading.css.d.top, '2e0px');

  r.draw(null);
  const gallery = node('gallery');
  const columns = C.DEF.gallery.controls.content.find(control => control.c === '--g-cols')!;
  const columnsInput = enter(gallery, columns, '2e-1');
  assert.equal(columnsInput.value, '1');
  assert.equal(gallery.css.d['--g-cols'], '1');
});

test('unit parsing and remount preserve valid scientific and decimal lengths', () => {
  assert.deepEqual(C.parseU('2e0px'), { n: '2e0', u: 'px' });
  assert.deepEqual(C.parseU('+2E-1REM'), { n: '2E-1', u: 'rem' });
  assert.deepEqual(C.parseU('2.50em'), { n: '2.50', u: 'em' });
  assert.deepEqual(C.parseU('-.5vh'), { n: '-.5', u: 'vh' });
  assert.deepEqual(C.parseU('var(--space)'), { n: '', u: '' });
  assert.deepEqual(C.parseU('calc(2px + 1rem)'), { n: '', u: '' });

  const heading = node();
  const top = advControls(heading).find(control => control.c === 'top')!;
  heading.css.d.top = '2e0px';
  r.draw(<Ctl n={heading} c={top} />);
  assert.equal(valueInput().value, '2e0');

  r.draw(null);
  r.draw(<Ctl n={heading} c={top} />);
  assert.equal(valueInput().value, '2e0');
  assert.equal(heading.css.d.top, '2e0px');
});

test('renderer normalizes legacy fractional integer CSS values without changing lengths', () => {
  const gallery = node('gallery');
  gallery.css.d['--g-cols'] = '2.5';
  let buckets = { d: '', t: '', m: '' };
  C.nodeCss(gallery, false, buckets);
  assert.match(buckets.d, /--g-cols:3;/);

  const heading = node();
  heading.css.d['z-index'] = '-2.5';
  heading.css.d.top = '2.5px';
  buckets = { d: '', t: '', m: '' };
  C.nodeCss(heading, false, buckets);
  assert.match(buckets.d, /z-index:-2;/);
  assert.match(buckets.d, /top:2.5px;/);
});

test('renderer canonicalizes finite scientific and legacy integer declarations', () => {
  const gallery = node('gallery');
  const heading = node();
  const cases = [
    ['--g-cols', gallery, '2e0', '2'],
    ['--g-cols', gallery, '2e-1px', '1'],
    ['z-index', heading, '+2', '2'],
    ['z-index', heading, '2.0', '2'],
    ['z-index', heading, '-2e0', '-2'],
    ['z-index', heading, '-0', '0'],
    ['z-index', heading, '1e21', '1000000000000000000000'],
  ] as const;

  for (const [key, target, raw, expected] of cases) {
    target.css.d[key] = raw;
    const buckets = { d: '', t: '', m: '' };
    C.nodeCss(target, false, buckets);
    assert.ok(buckets.d.includes(`${key}:${expected};`), `${key}:${raw} should compile as ${expected}`);
    delete target.css.d[key];
  }

  heading.css.d.top = '2e0px';
  const buckets = { d: '', t: '', m: '' };
  C.nodeCss(heading, false, buckets);
  assert.match(buckets.d, /top:2e0px;/);
});

test('renderer preserves existing nonnumeric CSS values for integer-key declarations', () => {
  const heading = node();
  for (const value of ['auto', 'var(--layer)', 'calc(2 + 1)']) {
    heading.css.d['z-index'] = value;
    const buckets = { d: '', t: '', m: '' };
    C.nodeCss(heading, false, buckets);
    assert.ok(buckets.d.includes(`z-index:${value};`));
  }

  const gallery = node('gallery');
  gallery.css.d['--g-cols'] = 'var(--columns)';
  const buckets = { d: '', t: '', m: '' };
  C.nodeCss(gallery, false, buckets);
  assert.match(buckets.d, /--g-cols:var\(--columns\);/);
});

test('integer controls keep negative Z-index, clamp zero Gallery columns, and clear empty input', () => {
  const heading = node();
  const zIndex = advControls(heading).find(control => control.c === 'z-index')!;
  const zInput = enter(heading, zIndex, '-2.5');
  assert.equal(zInput.value, '-2');
  assert.equal(heading.css.d['z-index'], '-2');
  r.draw(null);

  const gallery = node('gallery');
  const columns = C.DEF.gallery.controls.content.find(control => control.c === '--g-cols')!;
  const columnsInput = enter(gallery, columns, '0.4');
  assert.equal(columnsInput.value, '1');
  assert.equal(gallery.css.d['--g-cols'], '1');
  act(() => r.type(columnsInput, ''));
  assert.equal(gallery.css.d['--g-cols'], undefined);
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

test('Advanced unit controls expose only their valid CSS keyword and keep numeric validation', () => {
  const heading = node();
  const cases = [
    ['top', [['auto', 'Auto']], '-12.5', 'px', '-12.5px'],
    ['z-index', [['auto', 'Auto']], '-2.5', '', '-2'],
    ['max-width', [['none', 'None']], '-12.5', 'px', '0px'],
  ] as const;

  for (const [property, options, raw, unit, expected] of cases) {
    const control = advControls(heading).find(candidate => candidate.c === property)!;
    assert.deepEqual(control.opts, options);
    const input = enter(heading, control, raw, unit);
    assert.equal(input.getAttribute('aria-label'), `${control.label} value`);
    assert.equal(unitSelect().getAttribute('aria-label'), `${control.label} unit or keyword`);
    assert.equal(heading.css.d[property], expected);
    r.draw(null);
  }
});

test('a keyword switches to a numeric draft without clearing or writing until a valid number exists', () => {
  const heading = node();
  const top = advControls(heading).find(control => control.c === 'top')!;
  heading.css.d.top = '24px';
  r.draw(() => <Ctl n={heading} c={top} />, 'right');

  act(() => r.pick(unitSelect(), 'auto'));
  assert.equal(heading.css.d.top, 'auto');
  assert.equal(valueInput().value, '');
  assert.equal(valueInput().disabled, true);

  act(() => r.pick(unitSelect(), 'rem'));
  assert.equal(unitSelect().value, 'rem');
  assert.equal(valueInput().disabled, false);
  assert.equal(heading.css.d.top, 'auto', 'choosing a numeric unit is a draft until a number exists');

  act(() => r.type(valueInput(), '-1.25'));
  assert.equal(heading.css.d.top, '-1.25rem');

  r.draw(null);
  r.draw(() => <Ctl n={heading} c={top} />, 'right');
  assert.equal(unitSelect().value, 'rem');
  assert.equal(valueInput().value, '-1.25');
});

test('enhanced keyword picker keeps its field name and keyboard navigation can select None', async () => {
  HTMLElement.prototype.scrollIntoView = () => {};
  const heading = node();
  const maxWidth = advControls(heading).find(control => control.c === 'max-width')!;
  heading.css.d['max-width'] = '240px';
  r.draw(() => <Ctl n={heading} c={maxWidth} />, 'right');
  installCustomSelects();

  const trigger = r.$('.pc-custom-select-trigger[aria-label="Max width unit or keyword"]') as HTMLButtonElement;
  assert.ok(trigger);
  act(() => trigger.click());
  await new Promise(resolve => requestAnimationFrame(resolve));
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover:not([hidden])')!;
  const initial = menu.querySelector<HTMLButtonElement>('[data-active="true"]')!;
  act(() => { initial.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })); });
  const active = menu.querySelector<HTMLButtonElement>('[data-active="true"]')!;
  assert.equal(active.textContent?.trim(), 'None');
  act(() => active.click());
  assert.equal(heading.css.d['max-width'], 'none');
  assert.match(trigger.textContent || '', /None/);
});
