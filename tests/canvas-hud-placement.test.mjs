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
