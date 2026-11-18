import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { selectionToolbarPosition, selectionToolbarTop } from '../app/src/ui/canvas-placement';

const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));

const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const rect = (left, top, right, bottom) => ({
  left, top, right, bottom, width: right - left, height: bottom - top,
  x: left, y: top, toJSON() {},
});
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('positionHud uses measured sibling rectangles and keeps every toolbar control reachable', () => {
  const dom = new JSDOM('<body><iframe id="canvas"></iframe></body>', {
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  windows.push(dom);
  const w = dom.window;
  const frame = w.document.querySelector('iframe');
  const cdoc = frame.contentDocument;
  const cwin = frame.contentWindow;
  Object.defineProperties(cwin, {
    innerWidth: { configurable: true, value: 414 },
    innerHeight: { configurable: true, value: 260 },
    scrollX: { configurable: true, value: 0 },
    scrollY: { configurable: true, value: 0 },
  });
  cdoc.body.innerHTML = `<main>
    <div id="source" data-id="source" data-t="heading">Source</div>
    <div id="selected" data-id="selected" data-t="button">Selected</div>
    <div id="next" data-id="next" data-t="button">Next</div>
  </main><div id="s-hud"></div>`;
  const boxes = {
    source: rect(60, 72, 282, 121),
    selected: rect(60, 137, 404, 186),
    next: rect(60, 186, 404, 250),
  };
  Object.entries(boxes).forEach(([id, box]) => { cdoc.getElementById(id).getBoundingClientRect = () => box; });
  const nativeBounds = cwin.Element.prototype.getBoundingClientRect;
  cwin.Element.prototype.getBoundingClientRect = function () {
    if (this.classList?.contains('bar')) return rect(60, 137, 404, 177);
    return nativeBounds.call(this);
  };
  const nodes = [
    { id: 'source', type: 'heading' },
    { id: 'selected', type: 'button' },
    { id: 'next', type: 'button' },
  ];
  Object.assign(w, {
    cdoc, cwin,
    state: { ui: { sel: 'selected' } },
    editing: { on: false },
    locate: id => {
      const node = nodes.find(item => item.id === id);
      return node ? { node, list: nodes, parent: { id: 'parent', type: 'column', children: nodes } } : null;
    },
    selectedCanvasElement: id => cdoc.getElementById(id),
    DEF: { heading: { label: 'Heading' }, button: { label: 'Button' } },
    selIds: () => ['selected'],
    tree: () => nodes,
    nameOf: node => node.type,
    esc: String,
    svg: () => '',
    gripsHtml: () => '',
    PC_UI: { selectionToolbarTop, selectionToolbarPosition },
  });

  w.eval(between('function positionHud()', '/* A grip per gutter'));
  w.positionHud();

  const bar = cdoc.querySelector('#s-hud .bar');
  const placed = rect(Number.parseFloat(bar.style.left), Number.parseFloat(bar.style.top),
    Number.parseFloat(bar.style.left) + 344, Number.parseFloat(bar.style.top) + 40);
  expect(overlaps(placed, boxes.source)).toBe(false);
  expect(overlaps(placed, boxes.selected)).toBe(false);
  expect(overlaps(placed, boxes.next)).toBe(false);
  expect(placed.left).toBeGreaterThanOrEqual(0);
  expect(placed.right).toBeLessThanOrEqual(cwin.innerWidth);
  expect(placed.top).toBeGreaterThanOrEqual(0);
  expect(placed.bottom).toBeLessThanOrEqual(cwin.innerHeight);
  expect(bar.querySelectorAll('button').length).toBeGreaterThan(0);
});

test('side + buttons on an element that touches the frame edge move inside, so the page never widens', () => {
  const dom = new JSDOM('<body><iframe id="canvas"></iframe></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  windows.push(dom);
  const w = dom.window;
  const frame = w.document.querySelector('iframe');
  const cdoc = frame.contentDocument, cwin = frame.contentWindow;
  cdoc.body.innerHTML = '<div id="s-root"></div><div id="s-hud" style="width:399px"></div>';
  cdoc.documentElement.style.setProperty('--z', '1');
  Object.assign(w, {
    cdoc, cwin, svg: () => '',
    quickAddSides: () => ['top', 'right', 'bottom', 'left'],
  });
  w.eval(between('const QUICK_LABEL', '/* Hovering or focusing a + draws'));
  const sides = html => {
    const host = cdoc.createElement('div'); host.innerHTML = html;
    return Object.fromEntries([...host.querySelectorAll('.qa')].map(b => [b.dataset.side, b.classList.contains('inside')]));
  };
  // Full width on the 399px phone canvas: both side buttons would sit outside the page.
  expect(sides(w.quickAddHtml('full', 0, 100, 399, 80))).toEqual({ top: false, right: true, bottom: false, left: true });
  // With room on both sides they stay outside the element, where they always were.
  expect(sides(w.quickAddHtml('mid', 60, 100, 200, 80))).toEqual({ top: false, right: false, bottom: false, left: false });
  // A zoomed-out canvas makes the button bigger in page units, so it needs more room.
  cdoc.documentElement.style.setProperty('--z', '0.5');
  expect(sides(w.quickAddHtml('near', 60, 100, 300, 80)).right).toBe(true);
});
