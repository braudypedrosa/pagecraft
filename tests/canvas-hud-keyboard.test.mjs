import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));

function harness() {
  const dom = new JSDOM('<iframe id="canvas"></iframe>', { runScripts: 'outside-only', pretendToBeVisual: true });
  windows.push(dom);
  const w = dom.window;
  const frame = w.document.querySelector('#canvas');
  const cdoc = frame.contentDocument;
  cdoc.body.innerHTML = '<div id="s-hud"><button data-act="edit">Edit content</button><button data-act="drag">Drag</button><button data-act="more">More</button></div>';
  const runAct = vi.fn(), startDrag = vi.fn(), openCtx = vi.fn();
  const selected = { id: 'selected', type: 'heading' };
  Object.assign(w, {
    cdoc, cwin: frame.contentWindow,
    state: { ui: { sel: selected.id } }, editing: { on: false }, DEF: {}, IS_WORDPRESS: false,
    $: selector => w.document.querySelector(selector), $$: (selector, root = w.document) => [...root.querySelectorAll(selector)],
    closeCtx: vi.fn(), escCtx: vi.fn(), select: vi.fn(), setMode: vi.fn(), exitEdit: vi.fn(), hotkey: vi.fn(), positionHud: vi.fn(), placeRT: vi.fn(),
    selIds: () => [selected.id], locate: () => ({ node: selected }), kindOf: () => 'Heading',
    runAct, startDrag, openCtx, frameRect: () => ({ left: 100, top: 40 }),
    toScreen: (value, offset) => value * 0.5 + offset
  });
  const start = source.indexOf('function activateHudButton(');
  const end = source.indexOf('\n/* =============================================================== drag/drop */', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  w.eval(source.slice(start, end));
  w.bindCanvas();
  return { w, cdoc, runAct, startDrag, openCtx };
}

test('a keyboard-synthesized HUD click activates once while its pointer click is not repeated', () => {
  const { w, cdoc, runAct } = harness();
  const edit = cdoc.querySelector('[data-act="edit"]');
  edit.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(runAct).toHaveBeenCalledTimes(1);
  expect(runAct).toHaveBeenCalledWith('edit', ['selected']);

  edit.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 30 }));
  edit.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
  expect(runAct).toHaveBeenCalledTimes(2);
});

test('keyboard activation keeps drag pointer-only and anchors More to its button', () => {
  const { w, cdoc, startDrag, openCtx } = harness();
  const drag = cdoc.querySelector('[data-act="drag"]');
  drag.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(startDrag).not.toHaveBeenCalled();
  drag.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 8, clientY: 9 }));
  expect(startDrag).toHaveBeenCalledTimes(1);

  const more = cdoc.querySelector('[data-act="more"]');
  more.getBoundingClientRect = () => ({ left: 20, top: 10, width: 40, height: 20, right: 60, bottom: 30, x: 20, y: 10, toJSON() {} });
  more.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(openCtx).toHaveBeenLastCalledWith(120, 50, ['selected']);
});
