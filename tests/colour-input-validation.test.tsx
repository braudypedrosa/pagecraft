// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

/* A half-typed hex is not an error yet: the warning waits until typing stops (blur). */
let r: Rig;
beforeEach(() => { r = rig(); C.state.ui.st = ''; C.state.ui.dev = 'desktop'; });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

test('typing a hex shows no warning until the field loses focus', () => {
  const section = C.N('section');
  C.state.pages[0].tree = [section];
  C.selSet([section.id]);
  const colour = C.COMMON_STYLE.flatMap(g => g.items).find(c => c.t === 'color' && c.c === 'background-color')!;
  act(() => r.draw(() => <Ctl n={section} c={colour} />, 'right'));
  const hex = () => r.$('input.hex') as HTMLInputElement;
  const warning = () => [...r.host.querySelectorAll('[role=alert]')].find(e => e.textContent === 'Enter a valid colour.');

  act(() => { hex().focus(); hex().dispatchEvent(new Event('focus')); });
  for (const partial of ['#', '#1f', '#1f3a2']) {
    act(() => r.type(hex(), partial));
    expect(warning(), partial).toBeUndefined();
    expect(hex().getAttribute('aria-invalid')).toBeNull();
  }
  act(() => { hex().dispatchEvent(new FocusEvent('blur')); });
  expect(warning()).toBeDefined();
  expect(hex().getAttribute('aria-invalid')).toBe('true');
  expect(hex().value).toBe('#1f3a2');

  // Coming back to fix it keeps what was typed.
  act(() => { hex().dispatchEvent(new FocusEvent('focus')); });
  expect(hex().value).toBe('#1f3a2');
  act(() => r.type(hex(), '#1f3a2d'));
  expect(warning()).toBeUndefined();
  expect(section.css.d['background-color']).toBe('#1f3a2d');
  act(() => { hex().dispatchEvent(new FocusEvent('blur')); });
  expect(warning()).toBeUndefined();
});
