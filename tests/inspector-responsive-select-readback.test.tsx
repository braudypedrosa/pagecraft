// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { installCustomSelects } from '../shared/custom-select.js';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const lineHeight = C.DEF.text.controls.style.find(control => control.c === 'line-height')!;
const font = C.DEF.text.controls.style.find(control => control.c === 'font-family')!;
const padding: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };
let r: Rig;

beforeEach(() => { r = rig(); });
afterEach(async () => {
  act(() => r.draw(null));
  r.host.remove();
  document.querySelectorAll('.pc-custom-select-popover').forEach(element => element.remove());
  await settle();
});

const trigger = (label: string) => r.$(`.pc-custom-select-trigger[aria-label="${label}"]`) as HTMLButtonElement;
const unit = (label: string) => r.$(`select[aria-label="${label} unit"]`) as HTMLSelectElement;
const value = (label: string) => r.$(`input[aria-label="${label} value"]`) as HTMLInputElement;

async function enhance() {
  installCustomSelects();
  await settle();
}

test('clearing responsive unit and box overrides refreshes enhanced unit labels from inherited CSS', async () => {
  const text = C.insert('text', null, 0)!;
  text.css.d['line-height'] = '28px';
  text.css.t['line-height'] = '1.5em';
  text.css.m['line-height'] = '150%';
  C.state.ui.dev = 'mobile';
  r.draw(() => <Ctl n={text} c={lineHeight} />, 'right');
  await enhance();
  assert.equal(trigger('Line height unit').textContent?.trim(), '%');

  act(() => r.click(r.$('button.rsp')));
  await settle();
  assert.equal(value('Line height').value, '1.5');
  assert.equal(unit('Line height').value, 'em', 'native select already follows inherited Tablet CSS');
  assert.equal(trigger('Line height unit').textContent?.trim(), 'em', 'visible enhanced label follows the native select');

  const box = C.insert('section', null, 1)!;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    box.css.d[`padding-${side}`] = '28px';
    box.css.t[`padding-${side}`] = '1.5em';
    box.css.m[`padding-${side}`] = '150%';
  }
  r.draw(() => <Ctl n={box} c={padding} />, 'right');
  await settle();
  assert.equal(trigger('Padding unit').textContent?.trim(), '%');

  act(() => r.click(r.$('button.rsp')));
  await settle();
  assert.equal((r.$('input[aria-label="Padding top"]') as HTMLInputElement).value, '1.5');
  assert.equal(unit('Padding').value, 'em');
  assert.equal(trigger('Padding unit').textContent?.trim(), 'em');
});

test('clearing a responsive font override refreshes the enhanced preset label', async () => {
  const text = C.insert('text', null, 0)!;
  const lora = C.fontGroups().flatMap(([, options]) => options)
    .find(([, label]) => label === 'Lora')![0];
  const system = C.fontGroups().flatMap(([, options]) => options)
    .find(([, label]) => label === 'System sans')![0];
  text.css.d['font-family'] = '"Courier New", monospace';
  text.css.t['font-family'] = lora;
  text.css.m['font-family'] = system;
  C.state.ui.dev = 'mobile';
  r.draw(() => <Ctl n={text} c={font} />, 'right');
  await enhance();
  assert.equal(trigger('Font').textContent?.trim(), 'System sans');

  act(() => r.click(r.$('button.rsp')));
  await settle();
  assert.equal((r.$('select[aria-label="Font"]') as HTMLSelectElement).value, lora);
  assert.equal(trigger('Font').textContent?.trim(), 'Lora');
});

test('empty unit choices remain local but enhanced labels reset across editing scopes', async () => {
  const text = C.insert('text', null, 0)!;
  delete text.css.d['line-height'];
  r.draw(() => <Ctl n={text} c={lineHeight} />, 'right');
  await enhance();

  act(() => r.pick(unit('Line height'), '%'));
  await settle();
  assert.equal(text.css.d['line-height'], undefined);
  assert.equal(trigger('Line height unit').textContent?.trim(), '%');

  C.state.ui.dev = 'mobile';
  r.draw(() => <Ctl n={text} c={lineHeight} />, 'right');
  await settle();
  assert.equal(unit('Line height').value, '');
  assert.equal(trigger('Line height unit').textContent?.trim(), '—');

  C.state.ui.st = 'hover';
  r.draw(() => <Ctl n={text} c={lineHeight} />, 'right');
  await settle();
  assert.equal(trigger('Line height unit').textContent?.trim(), '—');

  const classId = C.classAdd('Type', { d: {}, t: {}, m: {} });
  C.classApply(text, classId);
  C.state.ui.target = classId;
  r.draw(() => <Ctl n={text} c={lineHeight} />, 'right');
  await settle();
  assert.equal(trigger('Line height unit').textContent?.trim(), '—');
  assert.equal(C.findClass(classId)!.css.m['line-height'], undefined);
});
