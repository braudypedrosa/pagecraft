import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index.ts';

const source = readFileSync('builder.html', 'utf8'), windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); return source.slice(a, b);
}
function harness() {
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  const nodes = ['button', 'heading', 'image', 'quote'].map(type => C.N(type));
  C.state.pages[0].tree = nodes;
  C.styleClip.css = { d: { color: '#234567' }, t: {}, m: {} };
  const dom = new JSDOM('<iframe id="canvas"></iframe>', { runScripts: 'outside-only', pretendToBeVisual: true });
  windows.push(dom); const w = dom.window, frame = w.document.querySelector('iframe'), cdoc = frame.contentDocument;
  cdoc.body.innerHTML = C.renderList(nodes, { edit: true });
  const runAct = vi.fn();
  Object.assign(w, { state: C.state, DEF: C.DEF, selSet: C.selSet, selIds: C.selIds, selToggle: C.selToggle, selRange: C.selRange,
    multiOn: C.multiOn, locate: C.locate, menuFor: C.menuFor, esc: C.esc,
    cdoc, cwin: frame.contentWindow, editing: { on: false },
    $: q => w.document.querySelector(q), $$: (q, root = w.document) => [...root.querySelectorAll(q)],
    PC_UI: { installUiMotion: () => null }, runAct, startDrag: vi.fn(), startColResize: vi.fn(), setMode: vi.fn(),
    contextualCanvasElement: () => null, rememberCanvasItem: () => false, exitEdit: vi.fn(), escCtx: vi.fn(),
    paintSel: vi.fn(), renderRight: vi.fn(), renderModebar: vi.fn(), renderLayers: vi.fn(), drawBlocks: vi.fn(),
    revealSelection: vi.fn(), positionHud: vi.fn(), placeRT: vi.fn(), hotkey: vi.fn(),
    frameRect: () => ({ left: 0, top: 0 }), toScreen: (value, offset) => value + offset });
  w.eval('let canvasSelectionContext = null;\n' + section('function selectsCanvasAncestor(', '// Panel changes can reflow the canvas.'));
  w.eval(section('function closeCtx(', '/* One closer for every way out:'));
  w.eval(section('function canvasPointerHit(', '/* =============================================================== drag/drop */'));
  w.bindCanvas();
  const target = node => cdoc.getElementById(node.id);
  const press = (node, options = {}) => target(node).dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, button: 0, ...options }));
  const context = (node, options = {}) => {
    press(node, { button: 2, buttons: 2, ...options });
    target(node).dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, ...options }));
  };
  const selectThree = () => { press(nodes[0]); press(nodes[1], { shiftKey: true }); press(nodes[2], { shiftKey: true }); };
  return { w, nodes, press, context, selectThree, runAct };
}

test('right-clicking each selected member preserves all three targets and actual multi-action menu', () => {
  const { w, nodes, context, selectThree, runAct } = harness();
  selectThree(); const selected = [...C.selIds()]; expect(selected).toHaveLength(3);
  for (const member of nodes.slice(0, 3)) {
    context(member);
    expect(C.selIds()).toEqual(selected);
    expect(w.document.querySelector('#ctx [data-a="dup"]').textContent).toContain('Duplicate all 3');
    expect(w.document.querySelector('#ctx [data-a="stpaste"]').textContent).toContain('Paste styles to 3');
    expect(w.document.querySelector('#ctx [data-a="edit"]')).toBeNull();
  }
  expect(runAct).not.toHaveBeenCalled();
});

test('right-clicking an unselected member selects it and offers single actions', () => {
  const { w, nodes, context, selectThree } = harness();
  selectThree(); context(nodes[3]);
  expect(C.selIds()).toEqual([nodes[3].id]);
  expect(w.document.querySelector('#ctx [data-a="dup"]').textContent).toContain('Duplicate');
  expect(w.document.querySelector('#ctx [data-a="dup"]').textContent).not.toContain('all');
  expect(w.document.querySelector('#ctx [data-a="edit"]')).not.toBeNull();
});

test('ordinary left clicks and Shift, Ctrl and Meta multi-selection retain their behavior', () => {
  const { nodes, press } = harness();
  press(nodes[0]); press(nodes[1], { shiftKey: true }); press(nodes[2], { ctrlKey: true }); press(nodes[3], { metaKey: true });
  expect(C.selIds()).toHaveLength(4);
  press(nodes[3], { metaKey: true }); expect(C.selIds()).toHaveLength(3);
  press(nodes[2]); expect(C.selIds()).toEqual([nodes[2].id]);
});

test('secondary clicks with modifiers preserve selected members and select unselected members singly', () => {
  const { nodes, context, selectThree } = harness();
  selectThree(); const selected = [...C.selIds()];
  context(nodes[1], { shiftKey: true }); expect(C.selIds()).toEqual(selected);
  context(nodes[3], { shiftKey: true }); expect(C.selIds()).toEqual([nodes[3].id]);
});
