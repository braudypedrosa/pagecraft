import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function harness() {
  const dom = new JSDOM(`
    <body>
      <div id="app" inert aria-busy="true"><div id="target" tabindex="0"></div></div>
      <div id="modal" hidden><button id="modalButton">Close</button></div>
    </body>`, { runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window;
  const target = w.document.querySelector('#target');
  const calls = {
    exportModal: vi.fn(), saveExplicitly: vi.fn(), undo: vi.fn(), redo: vi.fn(),
    edit: vi.fn(), select: vi.fn(), closeModal: vi.fn(() => { w.document.querySelector('#modal').hidden = true; })
  };
  Object.assign(w, {
    askOpenNow: () => false,
    editing: { on: false },
    state: { ui: { sel: 'node-1' } },
    $: selector => w.document.querySelector(selector),
    selIds: () => ['node-1'],
    locate: () => ({ node: { id: 'node-1', type: 'box' } }),
    DEF: { box: { edit: false } },
    IS_WORDPRESS: false,
    HOST_FEATURES: { preview: 'local', projectExport: true },
    WP: {},
    canStructure: () => true,
    endTx: vi.fn(),
    firstChildOf: () => 'next', step: () => 'next', parentOf: () => null,
    runAct: vi.fn(), closeRightSurface: vi.fn(), backToBuilder: vi.fn(), togglePreview: vi.fn(),
    copyStyles: vi.fn(), styleClip: {}, renderRight: vi.fn(), toast: vi.fn(), multiOn: () => false,
    copyElement: vi.fn(), cutElement: vi.fn(), clip: {}, pasteElement: vi.fn(),
    findModal: vi.fn(), kindOf: () => 'Box', delMany: vi.fn(), delNode: vi.fn(), dupMany: vi.fn(), dupNode: vi.fn(),
    ...calls
  });
  const start = source.indexOf('function hotkey(e) {');
  const end = source.indexOf("\ndocument.addEventListener('keydown', hotkey);", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  w.eval(source.slice(start, end));
  const press = (key, options = {}, eventTarget = target) => {
    const event = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
    Object.defineProperty(event, 'target', { configurable: true, value: eventTarget });
    w.hotkey(event);
    return event;
  };
  return { w, target, calls, press };
}

test('document shortcuts stay inactive until hosted startup finishes', async () => {
  const { w, calls, press } = harness();
  const assets = deferred();
  const hydrate = assets.promise.then(() => {
    const app = w.document.querySelector('#app');
    app.removeAttribute('inert');
    app.setAttribute('aria-busy', 'false');
  });

  for (const event of [
    press('e', { metaKey: true }),
    press('s', { metaKey: true }),
    press('z', { metaKey: true }),
    press('ArrowDown')
  ]) expect(event.defaultPrevented).toBe(false);
  expect(calls.exportModal).not.toHaveBeenCalled();
  expect(calls.saveExplicitly).not.toHaveBeenCalled();
  expect(calls.undo).not.toHaveBeenCalled();
  expect(calls.select).not.toHaveBeenCalled();

  assets.resolve();
  await hydrate;
  expect(press('e', { metaKey: true }).defaultPrevented).toBe(true);
  expect(calls.exportModal).toHaveBeenCalledTimes(1);
  expect(press('s', { metaKey: true }).defaultPrevented).toBe(true);
  expect(calls.saveExplicitly).toHaveBeenCalledTimes(1);
});

test('a startup-visible dialog keeps its Escape keyboard scope', () => {
  const { w, calls, press } = harness();
  const modal = w.document.querySelector('#modal');
  modal.hidden = false;
  const event = press('Escape', {}, w.document.querySelector('#modalButton'));
  expect(event.defaultPrevented).toBe(true);
  expect(calls.closeModal).toHaveBeenCalledTimes(1);
  expect(modal.hidden).toBe(true);
});
