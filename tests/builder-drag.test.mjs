import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });
function harness(payload = {kind:'new',type:'heading',label:'Heading'}) {
  const dom = new JSDOM('<button id="card">Heading</button><div id="ghost"></div><iframe id="canvas"></iframe>', { runScripts: 'outside-only', pretendToBeVisual: true });
  windows.push(dom);
  const w = dom.window, d = w.document, frame = d.querySelector('iframe'), cd = frame.contentDocument;
  cd.body.innerHTML = '<div id="s-root"><h1 id="h" data-id="h">Existing</h1></div><div id="s-hud"></div>';
  const rect = { x: 0, y: 0, left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 };
  frame.getBoundingClientRect = () => rect;
  cd.getElementById('h').getBoundingClientRect = () => ({ ...rect, top: 20, bottom: 60, height: 40 });
  cd.elementFromPoint = () => cd.getElementById('h');
  const node = { id: 'h', type: 'heading' }, added = [], moved = [];
  let parentSelections = 0;
  d.addEventListener('keydown', e => { if(e.key === 'Escape') parentSelections++; });
  Object.assign(w, { cdoc: cd, cwin: frame.contentWindow, zoomK: 1, state: { ui: { mode: 'page' } },
    $: selector => d.querySelector(selector), svg: () => '', esc: String, kindOf: () => 'Heading', labelOf: () => 'Heading',
    locate: () => ({ node }), tree: () => [node], holds: () => false,
    edit: fn => fn(), insert: (...args) => { added.push(args); return { id: 'new' }; }, selSet: () => {},
    moveMany: (...args) => moved.push(args), toast: () => {}, PC_UI: { recordElementUse: () => {} }, revealSelection: () => {} });
  w.eval(source.slice(source.indexOf('let drag = null, dragDidMove = false;'), source.indexOf('/* ========================================================= inline editing */')) + '\nwindow.dragMoved = () => dragDidMove;');
  w.startDrag({ preventDefault() {}, target: d.querySelector('#card'), pointerId: 1, clientX: 0, clientY: 0 }, payload, false);
  return { w, d, cd, added, moved, parentSelections:()=>parentSelections, event: (name, x = 25, y = 25) => d.dispatchEvent(new w.MouseEvent(name, { bubbles: true, clientX:x, clientY:y })) };
}
test.each(['pointercancel', 'Escape'])('a %s cancels an active valid drop without changing the page', action => {
  const { w,d,cd,added,event,parentSelections } = harness();
  event('pointermove');
  expect(cd.querySelector('#s-drop-label')?.textContent).toBe('Add Heading before Heading');
  if (action === 'Escape') d.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  else event(action);
  event('pointerup');
  expect(parentSelections()).toBe(0);
  expect(added).toHaveLength(0);
  expect(cd.querySelector('#s-drop')).toBeNull();
  expect(cd.querySelector('#s-drop-label')).toBeNull();
  expect(d.body.classList.contains('dragging')).toBe(false);
});
test('minor pointer jitter stays a click rather than a drag', () => {
  const { w,added,event } = harness();
  event('pointermove', 2, 2); event('pointerup',2,2);
  expect(added).toHaveLength(0);
  expect(w.dragMoved()).toBe(false);
});
test('a completed drag inserts once at the visible destination', () => {
  const { added,event } = harness();
  event('pointermove'); event('pointerup');
  expect(added).toEqual([['heading', null, 0]]);
});

test('single-node drops use the same index correction as group moves', () => {
  const { moved, event } = harness({kind:'move',id:'h',ids:['h'],label:'Heading'});
  event('pointermove',25,100); event('pointerup',25,100);
  expect(moved).toEqual([[['h'],null,1]]);
});
