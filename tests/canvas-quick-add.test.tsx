// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { openQuickAdd, closeQuickAdd } from '../app/src/ui/QuickAdd';
import { quickAddChoices, QUICK_ADD_DEFAULTS } from '../app/src/ui/Add';
import type { Node as PcNode } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

/* Quick add: a + on each edge of the selected element. Above and below insert before and
   after it; beside it either adds a neighbour (horizontal lists) or wraps the element and
   the new one in a two-column Row (vertical lists). */
let r: Rig;
beforeEach(() => {
  r = rig();
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
});
afterEach(() => { closeQuickAdd(); act(() => r.draw(null)); r.host.remove(); C.state.ui.dev = 'desktop'; });

/** Section > Row(2 cols) > [Column: heading], [Column: empty] */
function page() {
  const section = C.N('section');
  const row = C.makeFor('columns');
  while (row.children.length > 2) row.children.pop();
  C.applyCols(row, [50, 50]);
  const heading = C.N('heading');
  row.children[0].children.push(heading);
  section.children.push(row);
  C.state.pages[0].tree = [section];
  return { section, row, left: row.children[0], right: row.children[1], heading };
}
const types = (list: PcNode[]) => list.map(n => n.type);
const add = (id: string, side: 'top' | 'right' | 'bottom' | 'left', key: string) => { let leaf: PcNode | null = null; C.edit(() => { leaf = C.quickAdd(id, side, key); }); return leaf as PcNode | null; };

test('which sides offer a +', () => {
  const { section, row, left, heading } = page();
  expect(C.quickAddSides(heading.id)).toEqual(['top', 'right', 'bottom', 'left']);
  expect(C.quickAddSides(left.id)).toEqual(['top', 'right', 'bottom', 'left']);
  expect(C.quickAddSides(section.id)).toEqual(['top', 'bottom']);
  expect(C.quickAddSides(row.id)).toEqual(['top', 'right', 'bottom', 'left']);
  expect(C.quickAddSides('missing')).toEqual([]);

  C.state.ui.mode = 'header';
  expect(C.quickAddSides(heading.id)).toEqual([]);
  C.state.ui.mode = 'page';
});

test('above and below insert before and after in the same list', () => {
  const { left, heading } = page();
  const above = add(heading.id, 'top', 'button')!;
  expect(types(left.children)).toEqual(['button', 'heading']);
  expect(left.children[0].id).toBe(above.id);
  add(heading.id, 'bottom', 'text');
  expect(types(left.children)).toEqual(['button', 'heading', 'text']);
});

test('beside an element in a vertical list wraps both in a two-column row, new one on that side', () => {
  const { left, heading } = page();
  const image = add(heading.id, 'right', 'image')!;
  expect(types(left.children)).toEqual(['row']);
  const wrapper = left.children[0];
  expect(wrapper.children.map(c => types(c.children))).toEqual([['heading'], ['image']]);
  expect(wrapper.children[1].children[0].id).toBe(image.id);
  expect(wrapper.children.map(c => c.css.d['flex-grow'])).toEqual(['50', '50']);

  const button = add(heading.id, 'left', 'button')!;
  const inner = wrapper.children[0].children[0];
  expect(inner.type).toBe('row');
  expect(inner.children.map(c => types(c.children))).toEqual([['button'], ['heading']]);
  expect(inner.children[0].children[0].id).toBe(button.id);
});

test('a column takes a new column beside it and content at its top or bottom', () => {
  const { row, left, heading } = page();
  add(left.id, 'top', 'button');
  add(left.id, 'bottom', 'text');
  expect(types(left.children)).toEqual(['button', 'heading', 'text']);
  const image = add(left.id, 'right', 'image')!;
  expect(row.children).toHaveLength(3);
  expect(row.children[1].children[0].id).toBe(image.id);
  expect(row.children[1].css.d['flex-grow']).toBe('50');
  add(left.id, 'left', 'heading');
  expect(row.children).toHaveLength(4);
  expect(types(row.children[0].children)).toEqual(['heading']);
  expect(heading.id).toBe(row.children[1].children[1].id);
});

test('a section takes a new section above and below', () => {
  const { section } = page();
  add(section.id, 'bottom', 'heading');
  add(section.id, 'top', 'text');
  const tree = C.state.pages[0].tree;
  expect(types(tree)).toEqual(['section', 'section', 'section']);
  expect(tree[1].id).toBe(section.id);
  let found = '';
  C.eachNode([tree[0]], n => { if (n.type === 'text') found = n.id; });
  expect(found).not.toBe('');
  expect(add(section.id, 'left', 'image')).toBeNull();
});

test('in a horizontal flex box the sides add neighbours and there is no above or below', () => {
  const { left } = page();
  const box = C.makeFor('flex');
  const a = C.N('button'), b = C.N('button');
  box.children.push(a, b);
  left.children.push(box);
  expect(C.quickAddSides(a.id)).toEqual(['left', 'right']);
  add(a.id, 'right', 'icon');
  expect(types(box.children)).toEqual(['button', 'icon', 'button']);
  expect(add(a.id, 'top', 'icon')).toBeNull();
});

test('quick add is one undo step and survives save', () => {
  const { left, heading } = page();
  add(heading.id, 'right', 'image');
  expect(types(left.children)).toEqual(['row']);
  const saved = C.clone(C.doc());
  let images = 0;
  C.eachNode(saved.pages[0].tree, n => { if (n.type === 'image') images++; });
  expect(images).toBe(1);
  C.undo();
  expect(types(C.state.pages[0].tree[0].children[0].children[0].children)).toEqual(['heading']);
});

test('the picker lists the common elements and searches the palette', () => {
  expect(quickAddChoices('').map(([key]) => key)).toEqual(QUICK_ADD_DEFAULTS);
  expect(quickAddChoices('photo').map(([key]) => key)).toContain('image');
  expect(quickAddChoices('zzzz')).toEqual([]);
});

test('the picker opens beside the +, picks with a click or the keyboard, and closes', () => {
  const picked: string[] = [];
  let more = 0;
  const opts = { x: 400, y: 300, side: 'bottom' as const, onPick: (k: string) => picked.push(k), onMore: () => { more++; } };

  act(() => { openQuickAdd(opts); });
  const dialog = () => document.querySelector('.pc-quick-add') as HTMLElement | null;
  expect(dialog()?.getAttribute('aria-label')).toBe('Add an element below');
  expect([...dialog()!.querySelectorAll('[role=option]')].map(o => o.textContent)).toEqual(['Heading', 'Rich text', 'Button', 'Image', 'Columns']);
  act(() => { (dialog()!.querySelector('[data-key=button]') as HTMLElement).click(); });
  expect(picked).toEqual(['button']);
  expect(dialog()).toBeNull();

  act(() => { openQuickAdd(opts); });
  const key = (k: string) => act(() => { dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });
  key('ArrowDown'); key('Enter');
  expect(picked).toEqual(['button', 'text']);

  act(() => { openQuickAdd(opts); });
  key('Escape');
  expect(dialog()).toBeNull();

  act(() => { openQuickAdd(opts); });
  act(() => { (dialog()!.querySelector('[data-more]') as HTMLElement).click(); });
  expect(more).toBe(1);
  expect(dialog()).toBeNull();
});
