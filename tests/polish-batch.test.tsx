// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import { readFileSync } from 'node:fs';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { openQuickAdd, closeQuickAdd } from '../app/src/ui/QuickAdd';
import { quickAddChoices, recordElementUse, QUICK_ADD_DEFAULTS } from '../app/src/ui/Add';
import type { Node as PcNode } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => {
  r = rig();
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
  try { localStorage.clear(); } catch { /* storage may be blocked */ }
});
afterEach(() => { closeQuickAdd(); act(() => r.draw(null)); r.host.remove(); C.state.ui.dev = 'desktop'; });

function twoColumnSection() {
  const section = C.N('section');
  const row = C.makeFor('columns');
  while (row.children.length > 2) row.children.pop();
  C.applyCols(row, [50, 50]);
  row.children[0].children.push(C.N('heading'));
  row.children[1].children.push(C.N('image'));
  section.children.push(row);
  C.state.pages[0].tree = [section];
  return { section, row };
}

/* ---- Quick add: starter sections from a section's + ---------------------------- */
test("a section's + offers the page's starter sections and places one above or below", () => {
  const { section } = twoColumnSection();
  const offered = C.quickAddSections(section.id);
  expect(offered.map(([id]) => id)).toContain('hero-split');
  expect(offered.every(([id]) => !C.PATTERNS.find(p => p.id === id)!.scope)).toBe(true);
  expect(C.quickAddSections(section.children[0].id)).toEqual([]);

  let made: PcNode | null = null;
  C.edit(() => { made = C.quickAddSection(section.id, 'bottom', 'hero-split'); });
  expect(C.state.pages[0].tree.map(n => n.id)).toEqual([section.id, made!.id]);
  C.edit(() => { made = C.quickAddSection(section.id, 'top', 'features-3'); });
  expect(C.state.pages[0].tree[0].id).toBe(made!.id);
  expect(C.quickAddSection(section.id, 'left', 'hero-split')).toBeNull();
});

test('the picker lists sections under their own heading and picks them by click or keyboard', () => {
  const picked: string[] = [];
  const sections: [string, string][] = [['hero-split', 'Split hero'], ['features-3', 'Three features']];
  const opts = { x: 300, y: 300, side: 'bottom' as const, onPick: () => {}, onMore: () => {}, sections, onPickSection: (id: string) => picked.push(id) };
  act(() => { openQuickAdd(opts); });
  const dialog = () => document.querySelector('.pc-quick-add') as HTMLElement;
  expect(dialog().textContent).toContain('Sections');
  act(() => { (dialog().querySelector('[data-section=features-3]') as HTMLElement).click(); });
  expect(picked).toEqual(['features-3']);

  act(() => { openQuickAdd(opts); });
  const key = (k: string) => act(() => { dialog().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });
  for (let i = 0; i < QUICK_ADD_DEFAULTS.length; i++) key('ArrowDown');
  key('Enter');
  expect(picked).toEqual(['features-3', 'hero-split']);

  act(() => { openQuickAdd(opts); });
  const search = dialog().querySelector('input') as HTMLInputElement;
  act(() => { search.value = 'hero'; search.dispatchEvent(new Event('input', { bubbles: true })); });
  expect([...dialog().querySelectorAll('[data-section]')].map(b => b.getAttribute('data-section'))).toEqual(['hero-split']);
});

/* ---- Quick add: recently used first --------------------------------------------- */
test('recently used elements come first in the picker, seven at most', () => {
  expect(quickAddChoices('').map(([k]) => k)).toEqual(QUICK_ADD_DEFAULTS);
  recordElementUse('video');
  recordElementUse('divider');
  const keys = quickAddChoices('').map(([k]) => k);
  expect(keys.slice(0, 2)).toEqual(['divider', 'video']);
  expect(keys).toHaveLength(7);
  expect(new Set(keys).size).toBe(keys.length);
});

/* ---- Row: Stack on tablet ------------------------------------------------------- */
test('Stack on tablet puts every column on its own line at the tablet breakpoint only', () => {
  const { row } = twoColumnSection();
  const stack = C.DEF.row.controls.content.find(c => c.t === 'stack')!;
  expect(stack.label).toBe('Stack on tablet');
  act(() => r.draw(() => <Ctl n={row} c={stack} />, 'right'));
  const sw = () => r.$('button[role=switch]') as HTMLButtonElement;
  expect(sw().getAttribute('aria-checked')).toBe('false');

  act(() => r.click(sw()));
  expect(row.children.map(c => c.css.t['flex-basis'])).toEqual(['100%', '100%']);
  expect(row.children.map(c => c.css.d['flex-basis'])).toEqual([undefined, undefined]);
  expect(C.rowStacksOnTablet(row)).toBe(true);
  act(() => r.draw(() => <Ctl n={row} c={stack} />, 'right'));
  expect(sw().getAttribute('aria-checked')).toBe('true');
  const css = { d: '', t: '', m: '' };
  C.nodeCss(row.children[0], false, css);
  expect(css.t).toContain('flex-basis:100%');

  C.state.ui.dev = 'tablet';
  expect(C.rowStacked(row)).toBe(true);
  C.state.ui.dev = 'desktop';

  act(() => r.click(sw()));
  expect(row.children.map(c => c.css.t['flex-basis'])).toEqual([undefined, undefined]);
  C.undo();
  expect(C.rowStacksOnTablet(C.state.pages[0].tree[0].children[0])).toBe(true);
});

/* ---- Content tab: Show on phone ------------------------------------------------- */
test('on the phone canvas the Content tab has a Show on Phone switch that hides the element there', () => {
  const heading = C.N('heading');
  C.state.pages[0].tree = [heading];
  C.selSet([heading.id]);
  C.state.ui.dev = 'desktop';
  act(() => r.draw(() => <Inspector />, 'right'));
  expect(r.$('.pc-device-visibility')).toBeNull();

  C.state.ui.dev = 'mobile';
  act(() => r.draw(() => <Inspector />, 'right'));
  const sw = () => r.$('.pc-device-visibility button[role=switch]') as HTMLButtonElement;
  expect(sw().getAttribute('aria-label')).toBe('Show on Phone'.replace('Phone', C.DEV_LABEL.m));
  expect(sw().getAttribute('aria-checked')).toBe('true');
  act(() => r.click(sw()));
  expect(heading.hide && heading.hide.m).toBe(true);
  expect(heading.hide && heading.hide.d).toBeFalsy();
  act(() => r.draw(() => <Inspector />, 'right'));
  expect(sw().getAttribute('aria-checked')).toBe('false');
});

/* ---- Canvas: Reversed chip, blank-page heroes, Shift+Enter ---------------------- */
const source = readFileSync('builder.html', 'utf8');
const slice = (from: string, to: string) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

test('a selected reversed row says so on the canvas', () => {
  const fn = slice('function reversedRowHtml(s) {', '\nlet quickPending');
  const { row } = twoColumnSection();
  const el = { getBoundingClientRect: () => ({ left: 10, bottom: 200 }) };
  const run = (s: any) => new Function('rowReversed', 'selectedCanvasElement', 'cwin', 'svg', 'esc', 'DEV_LABEL', 'dk',
    fn + '\nreturn reversedRowHtml(arguments[7]);')(C.rowReversed, () => el, { scrollX: 0, scrollY: 0 }, () => '', C.esc, C.DEV_LABEL, C.dk, s);
  C.state.ui.dev = 'mobile';
  expect(run({ node: row, parent: null })).toBe('');
  C.setRowReversed(row, true);
  expect(run({ node: row, parent: null })).toContain('Reversed on ' + C.DEV_LABEL.m);
  expect(run({ node: row.children[0], parent: row })).toContain('rev-chip');
  C.state.ui.dev = 'desktop';
  expect(run({ node: row, parent: null })).toBe('');
});

test('a blank page offers three hero layouts that each add a real hero section', () => {
  const html = new Function('PATTERNS', 'esc', slice('const START_HEROES', 'function startWithHero') + '\nreturn startHeroHtml();')(C.PATTERNS, C.esc);
  const ids = [...html.matchAll(/data-starthero="([^"]+)"/g)].map((m: RegExpMatchArray) => m[1]);
  expect(ids).toEqual(['hero-split', 'hero-centre', 'hero-form']);
  expect(html).toContain('Start with a hero');
  for (const id of ids) {
    C.state.pages[0].tree = [];
    let made: PcNode | null = null;
    C.edit(() => { made = C.patternInsert(id, null, C.tree().length); });
    expect(made!.type).toBe('section');
    expect(C.state.pages[0].tree).toHaveLength(1);
  }
  expect(source).toContain("if (hero && typeof startWithHero === 'function')");
});

test('Shift+Enter opens quick add below, and Help lists it', () => {
  const block = slice("  /* Shift+Enter: quick add below", "  if (k === 'enter' && state.ui.sel && !meta) {");
  expect(block).toContain("e.shiftKey");
  expect(block).toContain("sides.includes('bottom') ? 'bottom' : sides.includes('right') ? 'right'");
  expect(source).toContain("['Add an element below', '⇧↵ or the + on an edge']");
});

test('hovering a + draws the landing line on that edge, and leaving clears it', () => {
  const fn = slice('function quickAddPreview(btn) {', '\nlet quickPending');
  const canvas = document.implementation.createHTMLDocument('canvas');
  const hud = canvas.createElement('div'); hud.id = 's-hud'; canvas.body.append(hud);
  const el = { getBoundingClientRect: () => ({ left: 40, top: 100, width: 300, height: 60 }) };
  const preview = new Function('cdoc', 'cwin', 'state', 'selectedCanvasElement', fn + '\nreturn quickAddPreview;')(
    canvas, { scrollX: 0, scrollY: 20 }, { ui: { sel: 'x' } }, () => el);
  const btn = (side: string) => ({ dataset: { side } });
  preview(btn('bottom'));
  let line = hud.querySelector('.qa-line') as HTMLElement;
  expect(line.className).toBe('qa-line bottom');
  expect([line.style.left, line.style.top, line.style.width]).toEqual(['40px', '180px', '300px']);
  preview(btn('left'));
  expect(hud.querySelectorAll('.qa-line')).toHaveLength(1);
  line = hud.querySelector('.qa-line') as HTMLElement;
  expect([line.style.left, line.style.top, line.style.height]).toEqual(['40px', '120px', '60px']);
  preview(null);
  expect(hud.querySelector('.qa-line')).toBeNull();
});
