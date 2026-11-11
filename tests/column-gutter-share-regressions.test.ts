// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as C from '../app/src/core/index';
import type { Bp, Node as PcNode } from '../app/src/core/types';

const builder = readFileSync(resolve('builder.html'), 'utf8');
const start = builder.indexOf('function startColResize(');
const end = builder.indexOf('/* Note this is the *visual* box:', start);
if (start < 0 || end < 0) throw new Error('Column gutter handler was not found');
const resizeSource = builder.slice(start, end);

beforeEach(() => {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = []; C.state.footer = [];
  C.ensureTokens().classes = [];
  C.hist.u.length = 0; C.hist.r.length = 0;
});

function row(weights: number[]) {
  const made = C.N('row', {}, {}, weights.map(weight =>
    C.N('column', {}, { d: { 'flex-grow': String(weight) } })));
  C.state.pages[0].tree = [C.N('section', {}, {}, [made])];
  return made;
}

const shareControl = C.DEF.column.controls.content!.find(control => control.c === 'flex-grow')!;
function expectNativeShares(values: number[]) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(shareControl.min);
  input.max = String(shareControl.max);
  input.step = String(shareControl.step);
  for (const value of values) {
    input.value = String(value);
    expect(input.validity.valid, 'Generated share ' + value + ': ' + input.validationMessage).toBe(true);
  }
}

function gesture(node: PcNode, options: { breakpoint?: Bp; zoom?: number; span?: number } = {}) {
  const zoom = options.zoom ?? 1, span = options.span ?? 1200;
  C.state.ui.dev = options.breakpoint === 't' ? 'tablet' : options.breakpoint === 'm' ? 'mobile' : 'desktop';
  const cd = document.implementation.createHTMLDocument('Workshop');
  cd.body.innerHTML = '<div id="s-hud"></div>';
  const element = cd.createElement('div'); element.id = node.id; cd.body.appendChild(element);
  element.getBoundingClientRect = () => ({ left: 0, top: 100, right: span, bottom: 200,
    x: 0, y: 100, width: span, height: 100, toJSON: () => ({}) });
  const grip = cd.createElement('div');
  grip.dataset.grip = node.id; grip.dataset.i = '0';
  cd.getElementById('s-hud')!.appendChild(grip);
  const calls = { saves: 0, ends: 0, paints: 0 };
  let transaction: string | null = null;
  const environment = {
    cdoc: cd, cwin: window, zoomK: zoom,
    locate: C.locate, dk: C.dk, resizeCols: C.resizeCols, rowRatiosAt: C.rowRatiosAt,
    applyColsAt: C.applyColsAt,
    tx: (key: string) => { if (transaction !== key) { C.checkpoint(); transaction = key; } },
    endTx: () => { transaction = null; calls.ends++; },
    save: () => { calls.saves++; }, paintCss: () => { calls.paints++; },
    renderRight: () => {}, positionHud: () => {}
  };
  const startResize = new Function(...Object.keys(environment), resizeSource + '\nreturn startColResize;')
    (...Object.values(environment));
  const initialX = 100;
  startResize(new MouseEvent('pointerdown', { clientX: initialX, cancelable: true }), grip);
  return {
    calls, grip, cd,
    move: (clientDelta: number) => cd.dispatchEvent(new MouseEvent('pointermove', { clientX: initialX + clientDelta })),
    screenMove: (screenDelta: number) => cd.dispatchEvent(new MouseEvent('pointermove', { clientX: initialX + screenDelta / zoom })),
    finish: (kind = 'pointerup') => cd.dispatchEvent(new MouseEvent(kind))
  };
}

test('absolute pointer moves use starting shares, including reversal to the origin', () => {
  const node = row([50, 30, 20]);
  const drag = gesture(node);
  drag.move(120);
  expect(C.rowRatiosAt(node, 'd')).toEqual([60, 20, 20]);
  drag.move(60);
  expect(C.rowRatiosAt(node, 'd')).toEqual([55, 25, 20]);
  drag.move(0);
  expect(C.rowRatiosAt(node, 'd')).toEqual([50, 30, 20]);
  drag.move(-120);
  expect(C.rowRatiosAt(node, 'd')).toEqual([40, 40, 20]);
  expect(C.hist.u).toHaveLength(1);
  drag.finish();
  expect(drag.calls.ends).toBe(1);
  expect(drag.calls.saves).toBe(1);
  expect(drag.cd.querySelector('.gtip')).toBeNull();
  expect(drag.grip.classList.contains('on')).toBe(false);
  drag.move(240);
  expect(C.rowRatiosAt(node, 'd')).toEqual([40, 40, 20]);
  C.undo();
  expect(C.rowRatiosAt(C.locate(node.id)!.node, 'd')).toEqual([50, 30, 20]);
});

test('reversing after either clamp remains relative to pointerdown', () => {
  const node = row([50, 50]);
  const drag = gesture(node);
  drag.move(12000);
  expect(C.rowRatiosAt(node, 'd')).toEqual([96, 4]);
  drag.move(60);
  expect(C.rowRatiosAt(node, 'd')).toEqual([55, 45]);
  drag.move(-12000);
  expect(C.rowRatiosAt(node, 'd')).toEqual([4, 96]);
  drag.move(0);
  expect(C.rowRatiosAt(node, 'd')).toEqual([50, 50]);
  drag.finish('pointercancel');
  drag.move(120);
  expect(C.rowRatiosAt(node, 'd')).toEqual([50, 50]);
});

test.each([1, .6818181818181818, .5])('iframe coordinates resize correctly at zoom %s', zoom => {
  const node = row([50, 50]);
  const drag = gesture(node, { zoom });
  drag.screenMove(10);
  drag.screenMove(20);
  const expected = +(50 + 20 / zoom / 1200 * 100).toFixed(4);
  expect(C.rowRatiosAt(node, 'd')).toEqual([expected, +(100 - expected).toFixed(4)]);
  drag.finish();
});

test('one gesture keeps its initial responsive ratios and breakpoint', () => {
  const node = row([50, 30, 20]);
  C.applyColsAt(node, [40, 40, 20], 't');
  const drag = gesture(node, { breakpoint: 't' });
  drag.move(120);
  C.state.ui.dev = 'mobile';
  drag.move(60);
  expect(C.rowRatiosAt(node, 'd')).toEqual([50, 30, 20]);
  expect(C.rowRatiosAt(node, 't')).toEqual([45, 35, 20]);
  expect(C.rowRatiosAt(node, 'm')).toEqual([45, 35, 20]);
  expect(node.children.every(child => child.css.m['flex-grow'] === undefined)).toBe(true);
  drag.finish();
});

test('the starting ratios use responsive class values when local shares are absent', () => {
  const node = row([50, 50]);
  const first = node.children[0];
  delete first.css.d['flex-grow'];
  const id = C.classAdd('Workshop column share', { d: { 'flex-grow': '20' }, t: { 'flex-grow': '30' }, m: {} });
  C.classApply(first, id);
  expect(C.rowRatiosAt(node, 'd')).toEqual([20, 50]);
  expect(C.rowRatiosAt(node, 't')).toEqual([30, 50]);
  const drag = gesture(node, { breakpoint: 't' });
  drag.move(120);
  drag.move(60);
  expect(C.rowRatiosAt(node, 't')).toEqual([34, 46]);
  expect(C.rowRatiosAt(node, 'd')).toEqual([20, 50]);
  expect(C.findClass(id)!.css.t['flex-grow']).toBe('30');
  drag.finish();
});

test.each([
  { weights: [10, 15, 35], delta: 10, expected: [16, 9, 35] },
  { weights: [10, 15, 35], delta: -999, expected: [4, 21, 35] },
  { weights: [80, 80, 20], delta: 999, expected: [100, 60, 20] },
  { weights: [40, 40, 100, 100, 100], delta: -999, expected: [15.2, 64.8, 100, 100, 100] }
])('non-100 shares retain bounds, pair total and other columns: $weights', ({ weights, delta, expected }) => {
  const node = row(weights);
  const result = C.resizeCols(node, 0, delta)!;
  expect(result).toEqual(expected);
  expect(result[0] + result[1]).toBeCloseTo(weights[0] + weights[1], 4);
  expect(result.slice(2)).toEqual(weights.slice(2));
  C.applyColsAt(node, result);
  expectNativeShares(C.rowRatiosAt(node, 'd'));
});

test.each([[4, 3, 93], [100, 100, 100]])('an immovable pair does not rewrite shares: %s', (...weights) => {
  const node = row(weights);
  const before = JSON.stringify(node);
  expect(C.resizeCols(node, 0, 10)).toBeNull();
  const drag = gesture(node);
  drag.move(120);
  drag.finish();
  expect(JSON.stringify(node)).toBe(before);
  expect(C.hist.u).toHaveLength(0);
});

test('generated precision is valid in the inspector and preset serialization stays unchanged', () => {
  expect(shareControl.min).toBe(C.MIN_COL);
  expect(shareControl.min).toBe(4);
  expect(shareControl.max).toBe(100);
  expect(shareControl.step).toBe(.0001);
  for (const count of [1, 2, 3, 4, 5, 6] as const) {
    for (const preset of C.LAYOUTS[count]) {
      const node = row(preset);
      C.applyCols(node, preset);
      expect(C.rowRatiosAt(node, 'd')).toEqual(preset.map(value => +value.toFixed(4)));
      expect(C.matchLayout(node)).not.toBeNull();
      expectNativeShares(C.rowRatiosAt(node, 'd'));
    }
  }
  const node = row([33.3333, 33.3333, 33.3334]);
  const result = C.resizeCols(node, 0, 2.422222222222)!;
  C.applyColsAt(node, result);
  expectNativeShares(C.rowRatiosAt(node, 'd'));
  expect(C.rowRatiosAt(node, 'd').reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 4);
});
