import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));

function harness(preview) {
  const dom = new JSDOM(`<body class="${preview ? 'preview' : ''}"><div id="modal" hidden></div><iframe id="canvas"></iframe></body>`, { runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window, cdoc = w.document.querySelector('#canvas').contentDocument;
  const group = cdoc.createElement('div');
  group.tabIndex = 0;
  group.textContent = 'List group';
  cdoc.body.append(group);
  const select = vi.fn(), edit = vi.fn(), togglePreview = vi.fn(), saveExplicitly = vi.fn();
  const undo = vi.fn(), redo = vi.fn();
  Object.assign(w, {
    askOpenNow: () => false, editing: { on: false }, state: { ui: { sel: 'group' } },
    $: selector => w.document.querySelector(selector), selIds: () => ['group'], locate: () => ({ node: { type: 'list' } }),
    DEF: { list: { edit: false } }, IS_WORDPRESS: false, HOST_FEATURES: { preview: 'local', projectExport: true }, WP: {},
    select, edit, togglePreview, saveExplicitly, endTx: vi.fn(), undo, redo,
    runAct: vi.fn(), closeRightSurface: vi.fn(), backToBuilder: vi.fn(),
    firstChildOf: () => 'next', step: () => 'next', parentOf: () => null, canStructure: () => true,
  });
  const start = source.indexOf('function hotkey(e) {');
  const end = source.indexOf('\ndocument.addEventListener(\'keydown\', hotkey);', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  w.eval(source.slice(start, end));
  const invoke = event => { Object.defineProperty(event, 'target', { configurable: true, value: group }); w.hotkey(event); };
  return { w, group, select, edit, togglePreview, saveExplicitly, undo, redo, invoke };
}

test('Preview leaves List group arrow keys to the rendered page', () => {
  const { group, select, invoke } = harness(true);
  const event = new group.ownerDocument.defaultView.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  invoke(event);
  expect(event.defaultPrevented).toBe(false);
  expect(select).not.toHaveBeenCalled();
});

test('editor List group arrows retain canvas selection behavior', () => {
  const { group, select, invoke } = harness(false);
  const event = new group.ownerDocument.defaultView.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  invoke(event);
  expect(event.defaultPrevented).toBe(true);
  expect(select).toHaveBeenCalled();
});

test('Preview content owns navigation, activation, deletion, and history keys while Cmd-P/S remain editor shortcuts', () => {
  const { w, group, select, edit, togglePreview, saveExplicitly, undo, redo, invoke } = harness(true);
  const nativeKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Home', 'End', 'Delete', 'Backspace'];
  for (const key of nativeKeys) {
    const event = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    invoke(event);
    expect(event.defaultPrevented, key).toBe(false);
  }
  for (const key of ['z', 'y', 'd', 'c', 'x', 'v']) {
    const event = new w.KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true });
    invoke(event);
    expect(event.defaultPrevented, `Meta-${key}`).toBe(false);
  }
  expect(select).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
  expect(undo).not.toHaveBeenCalled();
  expect(redo).not.toHaveBeenCalled();
  const save = new w.KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true });
  invoke(save);
  expect(saveExplicitly).toHaveBeenCalled();
  const preview = new w.KeyboardEvent('keydown', { key: 'p', metaKey: true, bubbles: true, cancelable: true });
  invoke(preview);
  expect(preview.defaultPrevented).toBe(true);
  expect(togglePreview).toHaveBeenCalled();
});
