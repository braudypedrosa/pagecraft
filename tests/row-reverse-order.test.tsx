// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import type { Node as PcNode } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

/* Row › Order: "Reversed" swaps a Row's columns at the screen size being edited. Side by
   side that is row-reverse; stacked on a phone it puts the last column first. */
let r: Rig;
beforeEach(() => { r = rig(); C.state.ui.st = ''; });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); C.state.ui.dev = 'desktop'; });

const orderControl = () => C.DEF.row.controls.content.find(c => c.t === 'order')!;

function twoColumnRow(): PcNode {
  const row = C.N('row');
  C.applyCols(row, [50, 50]);
  row.children[0].children.push(C.N('heading'));
  row.children[1].children.push(C.N('image'));
  const section = C.N('section');
  section.children.push(row);
  C.state.pages[0].tree = [section];
  C.selSet([row.id]);
  return row;
}

function draw(row: PcNode, dev: 'desktop' | 'tablet' | 'mobile') {
  C.state.ui.dev = dev;
  act(() => r.draw(() => <Ctl n={row} c={orderControl()} />, 'right'));
}
const button = (label: string) => r.$$('button').find(b => b.textContent === label)!;
const pressed = () => r.$$('button[aria-pressed="true"]').map(b => b.textContent);
const press = (label: string) => act(() => r.click(button(label)));
const css = (row: PcNode) => { const out = { d: '', t: '', m: '' }; C.nodeCss(row, false, out); return out; };
function saved(id: string) {
  let found: PcNode | undefined;
  C.eachNode(C.clone(C.doc()).pages[0].tree, n => { if (n.id === id) found = n; });
  return found!;
}

test('the Columns row offers Order only when there is more than one column', () => {
  const row = twoColumnRow();
  const c = orderControl();
  expect(c.label).toBe('Order');
  expect(c.when!(row)).toBe(true);
  C.applyCols(row, [100]);
  expect(c.when!(row)).toBe(false);
});

test('desktop: Reversed swaps side-by-side columns and Normal restores them', () => {
  const row = twoColumnRow();
  draw(row, 'desktop');
  expect(pressed()).toEqual(['Normal']);
  expect(C.rowStacked(row)).toBe(false);

  press('Reversed');
  expect(row.css.d['flex-direction']).toBe('row-reverse');
  expect(row.css.m['flex-wrap']).toBeUndefined();
  expect(pressed()).toEqual(['Reversed']);
  expect(css(row).d).toContain('flex-direction:row-reverse');
  expect(saved(row.id).css.d['flex-direction']).toBe('row-reverse');

  press('Normal');
  expect(row.css.d['flex-direction']).toBeUndefined();
  expect(css(row).d).not.toContain('flex-direction');
  expect(pressed()).toEqual(['Normal']);
});

test('mobile: Reversed puts the last column first when the columns stack, desktop untouched', () => {
  const row = twoColumnRow();
  draw(row, 'mobile');
  expect(C.rowStacked(row)).toBe(true);
  expect(pressed()).toEqual(['Normal']);

  press('Reversed');
  expect(row.css.m['flex-wrap']).toBe('wrap-reverse');
  expect(row.css.m['flex-direction']).toBeUndefined();
  expect(row.css.d['flex-direction']).toBeUndefined();
  expect(row.css.d['flex-wrap']).toBeUndefined();
  expect(pressed()).toEqual(['Reversed']);
  const out = css(row);
  expect(out.m).toContain('flex-wrap:wrap-reverse');
  expect(out.d).not.toContain('wrap-reverse');
  expect(saved(row.id).css.m['flex-wrap']).toBe('wrap-reverse');

  draw(row, 'desktop');
  expect(pressed()).toEqual(['Normal']);

  draw(row, 'mobile');
  press('Normal');
  expect(row.css.m['flex-wrap']).toBeUndefined();
  expect(pressed()).toEqual(['Normal']);
});

test('each screen size is independent: image left on desktop, image first on a phone', () => {
  const row = twoColumnRow();
  draw(row, 'desktop');
  press('Reversed');

  // Stacked lines are not reordered by row-reverse, so the phone still reads Normal.
  draw(row, 'mobile');
  expect(pressed()).toEqual(['Normal']);
  press('Reversed');
  expect(row.css.d['flex-direction']).toBe('row-reverse');
  expect(row.css.m['flex-wrap']).toBe('wrap-reverse');

  // Tablet keeps the columns side by side and inherits desktop's order.
  draw(row, 'tablet');
  expect(C.rowStacked(row)).toBe(false);
  expect(pressed()).toEqual(['Reversed']);
  press('Normal');
  expect(row.css.t['flex-direction']).toBe('row');
  expect(row.css.d['flex-direction']).toBe('row-reverse');
  press('Reversed');
  expect(row.css.t['flex-direction']).toBeUndefined();
});

test('a template row that reverses with column-reverse reads as Reversed and can be set back', () => {
  const row = twoColumnRow();
  row.css.m['flex-direction'] = 'column-reverse';
  draw(row, 'mobile');
  expect(pressed()).toEqual(['Reversed']);
  press('Normal');
  expect(row.css.m['flex-direction']).toBeUndefined();
  expect(row.css.m['flex-wrap']).toBeUndefined();
  expect(C.rowReversed(row)).toBe(false);
});

test('columns given their own mobile widths stay side by side and reverse across', () => {
  const row = twoColumnRow();
  for (const col of row.children) col.css.m['flex-basis'] = '50%';
  draw(row, 'mobile');
  expect(C.rowStacked(row)).toBe(false);
  press('Reversed');
  expect(row.css.m['flex-direction']).toBe('row-reverse');
  expect(row.css.m['flex-wrap']).toBeUndefined();
});

test('Wrap names the value Order writes when the columns stack', () => {
  const wrap = C.DEF.row.controls.content.find(c => c.c === 'flex-wrap')!;
  const opts = (typeof wrap.opts === 'function' ? wrap.opts(C.N('row')) : wrap.opts) || [];
  expect(opts.map(([value]) => value)).toContain('wrap-reverse');
  const row = twoColumnRow();
  draw(row, 'mobile');
  press('Reversed');
  C.state.ui.dev = 'mobile';
  act(() => r.draw(() => <Ctl n={row} c={wrap} />, 'right'));
  const select = r.$('select') as HTMLSelectElement;
  expect(select.value).toBe('wrap-reverse');
  expect(select.selectedOptions[0]?.textContent).toBe('Wrap, reversed');
});
