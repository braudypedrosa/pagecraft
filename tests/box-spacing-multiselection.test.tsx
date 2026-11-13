// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { L } from '../app/src/ui/ctx';
import { Ctl } from '../app/src/ui/inspector/Controls';
import type { Control } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const padding: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };
const sides = ['top', 'right', 'bottom', 'left'];

function fixture() {
  const first = C.N('heading', { text: 'Workshop one' });
  const second = C.N('heading', { text: 'Workshop two' });
  first.css.d = { padding: '7px' };
  second.css.d = { padding: '9px' };
  const unselected = C.N('text', { html: '<p>Workshop paragraph</p>' });
  unselected.css.d = { padding: '0px' };
  const column = C.N('column', {}, { d: { padding: '4px' }, t: {}, m: {} }, [first, second, unselected]);
  C.state.pages[0].tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [column])])];
  C.selSet([column.id, first.id, second.id]);
  return { column, first, second, unselected, selected: [column, first, second] };
}

const input = (side: string) => r.$(`input[data-field-part="${side}"]`)!;

test('box spacing updates exactly the selected parent and children and removes each shorthand', () => {
  const f = fixture();
  const negativeBefore = structuredClone(f.unselected);
  const selectedBefore = f.selected.map(n => ({ ...n.css.d }));
  r.draw(<Ctl n={f.column} c={padding} />);
  act(() => r.type(input('top'), '13'));

  f.selected.forEach((n, index) => {
    const expected = selectedBefore[index];
    delete expected.padding;
    expect(n.css.d).toEqual({ ...expected, 'padding-top': '13px', 'padding-right': '4px', 'padding-bottom': '4px', 'padding-left': '4px' });
  });
  expect(f.unselected).toEqual(negativeBefore);
});

test('box fanout respects the active responsive state without replacing resting or inherited declarations', () => {
  const f = fixture();
  const desktopBefore = f.selected.map(n => structuredClone(n.css.d));
  C.state.ui.dev = 'tablet';
  C.state.ui.st = 'hover';
  r.draw(<Ctl n={f.column} c={padding} />);
  act(() => r.pick(r.$('select[data-field-part="unit"]')!, 'rem'));
  act(() => r.type(input('left'), '1.5'));

  f.selected.forEach((n, index) => {
    expect(n.st?.hover?.t).toEqual({ 'padding-left': '1.5rem' });
    expect(n.css.d).toEqual(desktopBefore[index]);
    expect(n.css.t).toEqual({});
    expect(n.st?.hover?.d).toEqual({});
    expect(n.st?.hover?.m).toEqual({});
  });
  expect(f.unselected.st).toBeUndefined();
});

test('shared unit changes, clearing and numeric normalization reach every selected box', () => {
  const f = fixture();
  r.draw(<Ctl n={f.column} c={padding} />);
  for (const unit of ['rem', '%', 'em', 'px']) {
    act(() => r.pick(r.$('select[data-field-part="unit"]')!, unit));
    for (const n of f.selected) {
      for (const side of sides) expect(n.css.d['padding-' + side]).toBe('4' + unit);
      expect(n.css.d.padding).toBeUndefined();
    }
  }
  act(() => r.type(input('top'), '-1.5'));
  for (const n of f.selected) expect(n.css.d['padding-top']).toBe('0px');
  act(() => r.type(input('right'), ''));
  for (const n of f.selected) expect(n.css.d['padding-right']).toBeUndefined();

  const margin: Control = { t: 'box', c: 'margin', label: 'Margin', r: 1, neg: 1 };
  r.draw(<Ctl n={f.column} c={margin} />);
  act(() => r.pick(r.$('select[data-field-part="unit"]')!, 'em'));
  act(() => r.type(input('bottom'), '-1.25'));
  for (const n of f.selected) expect(n.css.d['margin-bottom']).toBe('-1.25em');
  expect(f.unselected.css.d).toEqual({ padding: '0px' });
});

test('a primary class target is written once while selected elements retain their local declarations', () => {
  const f = fixture();
  const classId = C.classAdd('Workshop spacing', { d: { padding: '8px' }, t: {}, m: {} });
  C.classApply(f.column, classId);
  C.classApply(f.unselected, classId);
  C.state.ui.target = classId;
  const klass = C.findClass(classId)!;
  const localBefore = [f.column, f.first, f.second, f.unselected].map(n => structuredClone(n.css));
  const writes: Record<string, number> = {};
  klass.css.d = new Proxy(klass.css.d, {
    set(target, key: string, value) { writes[key] = (writes[key] || 0) + 1; target[key] = value; return true; },
    deleteProperty(target, key: string) { writes[key] = (writes[key] || 0) + 1; delete target[key]; return true; }
  });
  r.draw(<Ctl n={f.column} c={padding} />);
  act(() => r.type(input('top'), '13'));

  expect(writes).toEqual({ padding: 1, 'padding-top': 1, 'padding-right': 1, 'padding-bottom': 1, 'padding-left': 1 });
  expect(klass.css.d).toEqual({ 'padding-top': '13px', 'padding-right': '8px', 'padding-bottom': '8px', 'padding-left': '8px' });
  [f.column, f.first, f.second, f.unselected].forEach((n, index) => expect(n.css).toEqual(localBefore[index]));
});

test('a coalesced box edit restores the whole selection with one Undo and Redo', () => {
  const f = fixture();
  const before = structuredClone(C.doc());
  let txKey: string | null = null;
  // Match the editor transaction boundary: input events coalesce until blur.
  L.tx = key => { if (txKey !== key) { txKey = key; C.checkpoint(); } };
  L.endTx = () => { txKey = null; };
  r.draw(<Ctl n={f.column} c={padding} />);
  act(() => r.type(input('top'), '13'));
  act(() => r.type(input('top'), '14'));
  act(() => { input('top').dispatchEvent(new window.Event('blur')); });
  expect(C.hist.u).toHaveLength(1);
  const changed = structuredClone(C.doc());
  for (const n of f.selected) expect(n.css.d['padding-top']).toBe('14px');

  C.undo();
  expect(C.doc()).toEqual(before);
  expect(C.hist.u).toHaveLength(0);
  C.redo();
  expect(C.doc()).toEqual(changed);
});
