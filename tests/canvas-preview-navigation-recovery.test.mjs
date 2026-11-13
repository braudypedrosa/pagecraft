import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const builder = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });

// JSDOM does not navigate srcdoc or submit forms. Model the browser document
// boundary while exercising the real mount, toggle and paint functions.
async function harness() {
  const dom = new JSDOM('<body class="preview"><button id="previewBtn"></button><iframe id="canvas"></iframe></body>', {
    url: 'https://editor.example.test/', runScripts: 'outside-only'
  });
  windows.push(dom);
  const w = dom.window, d = w.document, frame = d.querySelector('#canvas');
  let active = null, unreadable = false, source = '', writes = 0;
  Object.defineProperty(frame, 'contentDocument', { get() {
    if (unreadable) throw new w.DOMException('Cross-origin document', 'SecurityError');
    return active;
  } });
  Object.defineProperty(frame, 'contentWindow', { get: () => active?.defaultView });
  Object.defineProperty(frame, 'srcdoc', { get: () => source, set(value) { source = value; writes++; } });
  const makeDocument = html => {
    const next = new JSDOM(html, { url: 'https://editor.example.test/', runScripts: 'outside-only' });
    windows.push(next);
    return next.window.document;
  };
  const form = () => `<form action="${w.state.form.action}" method="${w.state.form.method}"><label>Name<input name="Name"></label></form>`;
  const bindCanvas = vi.fn(), paintSel = vi.fn(), layoutCanvas = vi.fn();
  const dispose = vi.fn(), cancelReadiness = vi.fn();
  Object.assign(w, {
    $: selector => d.querySelector(selector),
    $$: (selector, root = d) => [...root.querySelectorAll(selector)],
    state: { ui: { mode: 'page' }, form: { action: 'https://receiver.example.test/get', method: 'get' } },
    editing: { on: false }, exitEdit: vi.fn(), svg: () => '',
    canvasCsp: nonce => `script-src 'nonce-${nonce}'`, bindCanvas, paintSel, layoutCanvas,
    scopeOf: () => 'main', curSets: () => [[w.state.form]],
    treeCss: () => '', publicFormControlCssFor: () => '',
    regions: () => [{ kind: 'main', get: () => [w.state.form] }],
    pageCtx: () => ({}), renderPublicLists: () => [form()], renderList: form,
    assetsToBlob: value => value, syncFonts: vi.fn(), runPreviewRuntime: vi.fn(),
    watchCanvasPreview: vi.fn(), reconcileCanvasSelectionContext: vi.fn(), positionHud: vi.fn(),
    dispose, cancelReadiness
  });
  w.eval('let previewDispose = () => dispose(); let canvasReadyCleanup = () => cancelReadiness();\n'
    + builder.slice(builder.indexOf('let cwin = null, cdoc = null;'), builder.indexOf('/* All three regions are always'))
    + builder.slice(builder.indexOf('function paint() {'), builder.indexOf('/* ================================================================ toast */'))
    + builder.slice(builder.indexOf('function togglePreview() {'), builder.indexOf('/* =============================================================== export */'))
    + '\nwindow.ownedCanvasDocument = () => cdoc;');
  d.querySelector('#previewBtn').addEventListener('click', () => w.togglePreview());
  const finishLoad = async () => {
    unreadable = false; active = makeDocument(source);
    frame.dispatchEvent(new w.Event('load'));
    await Promise.resolve();
  };
  const firstMount = w.mountCanvas();
  await finishLoad(); await firstMount;
  w.paint();
  return {
    w, d, frame, bindCanvas, paintSel, layoutCanvas, dispose, cancelReadiness, finishLoad,
    writes: () => writes,
    navigate(kind) {
      unreadable = kind === 'unreadable';
      active = kind === 'cross-origin' || unreadable ? null
        : makeDocument(kind === 'missing-root' ? '<style id="s-css"></style><pre>GET receipt</pre>'
          : kind === 'missing-css' ? '<div id="s-root">GET receipt</div>' : '<pre>GET receipt</pre>');
      frame.dispatchEvent(new w.Event('load'));
    },
    toggle: () => d.querySelector('#previewBtn').click()
  };
}

test.each(['cross-origin', 'unreadable', 'missing-root', 'missing-css', 'same-origin'])('%s response is replaced by the current editable canvas on return', async kind => {
  const h = await harness();
  const owned = h.w.ownedCanvasDocument();
  expect(() => h.navigate(kind)).not.toThrow();
  expect(h.w.ownedCanvasDocument()).toBe(owned);
  expect(h.bindCanvas).toHaveBeenCalledTimes(1);
  expect(h.cancelReadiness).toHaveBeenCalledTimes(1);
  h.w.runPreviewRuntime.mockClear();
  expect(() => h.w.paint()).not.toThrow();
  expect(h.w.runPreviewRuntime).not.toHaveBeenCalled();
  h.w.state.form = { action: 'https://receiver.example.test/post', method: 'post' };
  const saved = JSON.stringify(h.w.state);
  h.toggle();
  expect(h.d.body.classList.contains('preview')).toBe(false);
  expect(h.cancelReadiness).toHaveBeenCalledTimes(2);
  expect(h.writes()).toBe(2);
  await h.finishLoad();
  expect(h.frame.contentDocument.querySelector('input[name="Name"]')).not.toBeNull();
  expect(h.frame.contentDocument.querySelector('form').getAttribute('action')).toBe('https://receiver.example.test/post');
  expect(h.frame.contentDocument.querySelector('form').getAttribute('method')).toBe('post');
  expect(h.bindCanvas).toHaveBeenCalledTimes(2);
  expect(h.paintSel).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(h.w.state)).toBe(saved);
  h.toggle();
  expect(h.d.body.classList.contains('preview')).toBe(true);
  expect(h.frame.contentDocument.querySelector('form').getAttribute('method')).toBe('post');
  expect(h.writes()).toBe(2);
});

test('an intact canvas toggles without remounting or rebinding', async () => {
  const h = await harness(), owned = h.frame.contentDocument;
  h.toggle(); h.toggle();
  expect(h.frame.contentDocument).toBe(owned);
  expect(h.writes()).toBe(1);
  expect(h.bindCanvas).toHaveBeenCalledTimes(1);
});

test('opposite toggles during recovery share one remount and use the latest mode', async () => {
  const h = await harness();
  h.navigate('cross-origin');
  h.toggle(); h.toggle();
  expect(h.writes()).toBe(2);
  await h.finishLoad();
  expect(h.d.body.classList.contains('preview')).toBe(true);
  expect(h.bindCanvas).toHaveBeenCalledTimes(2);
  expect(h.paintSel).not.toHaveBeenCalled();
  expect(h.frame.contentDocument.querySelector('form')).not.toBeNull();
});

test('a repeated load event does not bind the same canvas document twice', async () => {
  const h = await harness();
  h.frame.dispatchEvent(new h.w.Event('load'));
  expect(h.bindCanvas).toHaveBeenCalledTimes(1);
});
