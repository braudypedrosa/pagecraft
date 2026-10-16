import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import * as C from '../app/src/core/index';

const windows = [];
const builder = readFileSync('builder.html', 'utf8');
// JSDOM does not load iframe srcdoc. These chrome tests bypass only canvas mounting.
const built = readFileSync('index.html', 'utf8').replace('await mountCanvas();', '/* Canvas mounting is browser-verified separately. */');
const builtWithMoreTools = (() => {
  if (built.includes('id="moreToolsBtn"')) return built;
  const markup = builder.slice(builder.indexOf('    <button class="iconbtn moreToolsToggle"'), builder.indexOf('    <button class="btn primary" id="exportBtn"'));
  const script = builder.slice(builder.indexOf('function wireMoreTools()'), builder.indexOf('\n/* ============================================================= keyboard */'));
  if (!markup || !script) throw new Error('More tools source blocks are missing');
  return built
    .replace('    <button class="btn primary" id="exportBtn"', () => markup + '    <button class="btn primary" id="exportBtn"')
    // A replacement function preserves the source's `$$` query helper verbatim.
    .replace('/* ============================================================= keyboard */', () => script + '\n\n/* ============================================================= keyboard */')
    .replace("  $('#helpBtn').addEventListener('click', helpModal);", "  $('#helpBtn').addEventListener('click', helpModal);\n  wireMoreTools();");
})();
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); vi.useRealTimers(); });

function readinessHarness() {
  const dom = new JSDOM('<main><iframe></iframe></main>', { url: 'https://example.test/edit/qa', runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window;
  w.eval(builder.slice(builder.indexOf('const publicationFrameCleanup ='), builder.indexOf('\nasync function preparePublicationReview')));
  const frame = w.document.querySelector('iframe');
  const message = (status, source = frame.contentWindow, token = new URL(frame.src).searchParams.get('pcPreviewReady')) => w.dispatchEvent(new w.MessageEvent('message', {
    source, data: { type: 'pagecraft-preview-ready', token, status }
  }));
  return { w, frame, message, status: () => w.document.querySelector('[role="status"]').textContent, retry: () => w.document.querySelector('button') };
}

test('preview readiness requires both the current iframe and unpredictable request token', () => {
  const { w, frame, message, status, retry } = readinessHarness();
  w.loadPublicationFrame(frame, '/saved-version/index.html');
  expect(frame.getAttribute('aria-busy')).toBe('true');
  expect(retry().hidden).toBe(true);
  message('ready', w);
  message('ready', frame.contentWindow, 'wrong-token');
  message('unknown');
  expect(status()).toBe('Loading page preview…');
  message('ready');
  expect(status()).toBe('Page preview displayed.');
  expect(frame.getAttribute('aria-busy')).toBe('false');
  message('degraded');
  expect(status()).toBe('Page preview displayed.');
});

test('preview timeout exposes retry; retry rejects stale completion and reports missing assets', () => {
  vi.useFakeTimers();
  const { w, frame, message, status, retry } = readinessHarness();
  w.loadPublicationFrame(frame, '/saved-version/index.html');
  const oldToken = new URL(frame.src).searchParams.get('pcPreviewReady');
  vi.advanceTimersByTime(15000);
  expect(status()).toContain('taking too long');
  expect(retry().hidden).toBe(false);
  expect(frame.getAttribute('aria-busy')).toBe('false');
  retry().click();
  expect(frame.getAttribute('aria-busy')).toBe('true');
  expect(new URL(frame.src).pathname).toBe('/saved-version/index.html');
  expect(new URL(frame.src).searchParams.get('pcPreviewReady')).not.toBe(oldToken);
  message('ready', frame.contentWindow, oldToken);
  expect(status()).toBe('Loading page preview…');
  message('degraded');
  expect(status()).toContain('assets could not load');
  expect(retry().hidden).toBe(false);
});

async function editor(config = null, wordpress = false, options = {}) {
  C.blankProject('Editor usability fixture');
  const values = config ? { siteId: 'qa', name: 'QA', role: 'owner', version: 1, doc: JSON.parse(JSON.stringify(C.doc())), ...config } : null;
  const marker = '<script>\n/* =====================================================================';
  const source = options.html || built;
  const html = values ? source.replace(marker, `<script>window.${wordpress ? 'PC_WORDPRESS' : 'PC_SERVER'}=${JSON.stringify(values)}</script>\n${marker}`) : source;
  const errors = [], calls = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://example.test/edit/qa', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (options.width) {
        Object.defineProperty(w, 'innerWidth', { configurable: true, writable: true, value: options.width });
        w.matchMedia = query => {
          const max = /max-width:\s*(\d+)px/.exec(query), min = /min-width:\s*(\d+)px/.exec(query);
          const matches = (!max || w.innerWidth <= Number(max[1])) && (!min || w.innerWidth >= Number(min[1]));
          return { matches, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
        };
      }
      w.CSS = { ...w.CSS, escape: value => String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`) };
      w.fetch = async (url, options = {}) => { calls.push([String(url), options.method || 'GET']); return { ok: true, status: 200, json: async () => /assets|media$/.test(String(url)) ? [] : { version: 1 } }; };
    }
  });
  windows.push(dom);
  await new Promise(resolve => setTimeout(resolve, 800));
  const w = dom.window, d = w.document;
  if (d.querySelector('#savedTag').textContent === '—') w.bindTop();
  expect(errors).toEqual([]);
  return { w, d, core: w.__CORE, calls, errors };
}

test('selection breadcrumbs select ancestors and retain keyboard focus on the selected target', async () => {
  const { w, d, core, errors } = await editor();
  core.edit(() => { core.tree().splice(0); core.selSet([]); });
  const heading = core.insert('heading', null, 0);
  core.selSet([heading.id]);
  w.renderModebar();
  const path = Array.from(d.querySelectorAll('[data-select-ancestor]'));
  expect(path.length).toBeGreaterThan(1);
  expect(path.at(-1).getAttribute('aria-current')).toBe('true');
  const parent = path.at(-2).dataset.selectAncestor;
  path.at(-2).click();
  expect(core.state.ui.sel).toBe(parent);
  expect(d.activeElement.dataset.selectAncestor).toBe(parent);
  expect(d.querySelector('[data-select-ancestor][aria-current="true"]').dataset.selectAncestor).toBe(parent);
  expect(errors).toEqual([]);
});

test('insertion hints match actual sibling and container placement', async () => {
  const { w, core } = await editor();
  core.edit(() => { core.tree().splice(0); core.selSet([]); });
  expect(w.insertionHint('heading')).toContain('at the end of this page');
  const first = core.insert('heading', null, 0);
  const parent = core.locate(first.id).parent;
  const second = core.insert('heading', parent, parent.children.length);
  second.props.text = 'Following heading';
  core.selSet([first.id]);
  const hint = w.insertionHint('button');
  expect(hint).toContain('before ' + core.nameOf(second) + ' in ' + core.nameOf(parent));
  w.appendSmart('button');
  expect(parent.children.map(node => node.type)).toEqual(['heading', 'button', 'heading']);
  core.selSet([parent.id]);
  expect(w.insertionHint('image')).toContain('at the end of ' + core.nameOf(parent));
});

test('client review opens owner workflow without outbound mutations and explains unsaved changes', async () => {
  const { w, d, core, calls } = await editor({});
  expect(d.querySelector('#clientReviewBtn').hidden).toBe(false);
  d.querySelector('#clientReviewBtn').click();
  expect(d.querySelector('#mTitle').textContent).toBe('Client review');
  expect(d.querySelector('#mBody').textContent).toContain('Later edits do not inherit its approval');
  expect(d.querySelector('#mBody').textContent).toContain('latest saved draft');
  expect(d.querySelector('#mFoot a').getAttribute('href')).toBe('/sites/qa/reviews');
  expect(calls.filter(([, method]) => method !== 'GET')).toEqual([]);
  core.state.meta.name = 'Unsaved edit';
  w.clientReviewModal();
  expect(d.querySelector('#mBody').textContent).toContain('not saved yet');
});

test.each([{ role: 'content' }, { editorSessionToken: 'scoped-session' }])('client review is unavailable outside owner account access: %j', async config => {
  const { w, d } = await editor(config);
  expect(d.querySelector('#clientReviewBtn').hidden).toBe(true);
  w.clientReviewModal();
  expect(d.querySelector('#modal').hidden).toBe(true);
});

test('WordPress owners cannot open the Cloud client review workflow', async () => {
  const { w, d } = await editor(wordpressConfig, true);
  expect(d.querySelector('#clientReviewBtn').hidden).toBe(true);
  w.clientReviewModal();
  expect(d.querySelector('#modal').hidden).toBe(true);
});

const wordpressConfig = { restUrl: 'https://example.test/wp-json/pagecraft/v1', nonce: 'fixture',
  page: { id: 42, title: 'WP page', slug: 'wp-page' }, capabilities: ['edit_document', 'edit_structure'],
  previewUrl: 'https://example.test/wp-page/' };

test.each([
  { label: 'standalone', config: null, wordpress: false, available: ['undoBtn', 'redoBtn', 'canvasFocusBtn', 'reviewBtn', 'helpBtn'] },
  { label: 'Cloud owner', config: { url: 'https://example.test/live' }, wordpress: false, available: ['undoBtn', 'redoBtn', 'canvasFocusBtn', 'reviewBtn', 'historyBtn', 'clientReviewBtn', 'shareBtn', 'helpBtn'] },
  { label: 'Cloud content account', config: { role: 'content', url: 'https://example.test/live' }, wordpress: false, available: ['undoBtn', 'redoBtn', 'canvasFocusBtn', 'reviewBtn', 'shareBtn', 'helpBtn'] }
])('mobile More tools reflects $label capabilities', async ({ config, wordpress, available }) => {
  const { d, errors } = await editor(config, wordpress, { html: builtWithMoreTools, width: 600 });
  const trigger = d.querySelector('#moreToolsBtn'), menu = d.querySelector('#moreToolsPop');
  trigger.click();
  const item = target => menu.querySelector(`[data-more-target="${target}"]`);
  expect(menu.hidden).toBe(false);
  for (const target of ['undoBtn', 'redoBtn', 'canvasFocusBtn', 'reviewBtn', 'historyBtn', 'clientReviewBtn', 'shareBtn', 'helpBtn']) {
    expect(item(target).hidden, target).toBe(!available.includes(target));
    if (!available.includes(target)) continue;
    const source = d.getElementById(target);
    expect(item(target).disabled, target).toBe(source.disabled);
    expect(item(target).textContent, target).toBe(source.getAttribute('aria-label') || source.title);
  }
  expect(errors).toEqual([]);
});

test.each([601, 390, 320])('More tools remains operable at a %i px Cloud toolbar', async width => {
  const { d, errors } = await editor({ url: 'https://example.test/live' }, false, { html: builtWithMoreTools, width });
  d.querySelector('#moreToolsBtn').click();
  expect(d.querySelector('#moreToolsPop').hidden).toBe(false);
  expect(d.querySelector('[data-more-target="reviewBtn"]').hidden).toBe(false);
  expect(d.querySelector('#previewBtn')).not.toBeNull();
  expect(d.querySelectorAll('#devSeg button')).toHaveLength(3);
  expect(d.querySelector('#exportBtn').hidden).toBe(false);
  expect(d.querySelector('#publishLabel').textContent).toBe('Publish');
  expect(errors).toEqual([]);
});

test('mobile More tools opens real recovery surfaces with keyboard focus and no save or undo mutation', async () => {
  const { w, d, core, errors } = await editor(wordpressConfig, true, { html: builtWithMoreTools, width: 768 });
  const trigger = d.querySelector('#moreToolsBtn'), menu = d.querySelector('#moreToolsPop');
  const state = () => JSON.stringify({ document: core.doc(), undo: core.hist.u.length, redo: core.hist.r.length, save: w.eval('saveState') });
  const before = state();
  expect(trigger.title).toBe('More tools');
  expect(trigger.getAttribute('aria-label')).toBe('More tools');
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');

  trigger.click();
  expect(menu.hidden).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  w.innerWidth = 767;
  w.dispatchEvent(new w.Event('resize'));
  trigger.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).filter(item => !item.hidden);
  expect(items.map(item => item.dataset.moreTarget)).toEqual(['undoBtn', 'redoBtn', 'canvasFocusBtn', 'reviewBtn', 'historyBtn', 'helpBtn']);
  const enabledItems = items.filter(item => !item.disabled);
  expect(items.map(item => item.disabled)).toEqual(items.map(item => d.getElementById(item.dataset.moreTarget).disabled));
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(d.activeElement).toBe(enabledItems[0]);
  enabledItems[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(d.activeElement).toBe(enabledItems[1]);
  enabledItems[1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(menu.hidden).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(d.activeElement).toBe(trigger);

  trigger.click();
  items.at(-1).focus();
  d.querySelector('#exportBtn').focus();
  expect(menu.hidden).toBe(true);
  expect(d.activeElement).toBe(d.querySelector('#exportBtn'));

  const openItem = target => {
    trigger.click();
    const item = menu.querySelector(`[data-more-target="${target}"]`);
    expect(item.hidden).toBe(false);
    item.click();
  };
  openItem('canvasFocusBtn');
  expect(d.body.classList.contains('canvas-focus')).toBe(true);
  trigger.click();
  expect(menu.querySelector('[data-more-target="canvasFocusBtn"]').textContent).toBe('Show side panels');
  menu.querySelector('[data-more-target="canvasFocusBtn"]').click();
  expect(d.body.classList.contains('canvas-focus')).toBe(false);

  openItem('reviewBtn');
  await new Promise(resolve => w.requestAnimationFrame(resolve));
  expect(d.querySelector('#rightAux .tt b').textContent).toBe('Site checks');
  d.querySelector('#rightSurfaceClose').click();
  await new Promise(resolve => w.requestAnimationFrame(resolve));
  expect(d.activeElement).toBe(trigger);

  openItem('historyBtn');
  await new Promise(resolve => w.requestAnimationFrame(resolve));
  expect(d.querySelector('#rightAux .tt b').textContent).toBe('Version history');
  d.querySelector('#rightSurfaceClose').click();
  await new Promise(resolve => w.requestAnimationFrame(resolve));
  expect(d.activeElement).toBe(trigger);

  openItem('helpBtn');
  expect(d.querySelector('#mTitle').textContent).toBe('Help & keyboard shortcuts');
  d.querySelector('#mClose').click();
  await vi.waitFor(() => expect(d.querySelector('#modal').hidden).toBe(true));
  expect(d.activeElement).toBe(trigger);

  trigger.click();
  expect(menu.hidden).toBe(false);
  d.querySelector('#stage').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  expect(menu.hidden).toBe(true);
  expect(d.activeElement).toBe(trigger);
  expect(state()).toBe(before);
  expect(errors).toEqual([]);
});

function rightSurfaceHarness() {
  const dom = new JSDOM(`<body>
    <button id="canvasFocusBtn" data-wired="1" aria-label="Hide side panels" aria-pressed="false"></button>
    <button id="reviewBtn" aria-pressed="false"></button><button id="historyBtn" aria-pressed="false"></button>
    <aside id="right"></aside><aside id="rightAux" hidden></aside>
  </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  windows.push(dom);
  const w = dom.window, d = w.document, canvasFocus = d.querySelector('#canvasFocusBtn');
  canvasFocus.addEventListener('click', () => {
    const active = !d.body.classList.contains('canvas-focus');
    d.body.classList.toggle('canvas-focus', active);
    canvasFocus.setAttribute('aria-label', active ? 'Show side panels' : 'Hide side panels');
    canvasFocus.setAttribute('aria-pressed', String(active));
  });
  w.eval(`
    const IS_WORDPRESS = true;
    const $ = selector => document.querySelector(selector);
    const svg = () => '';
    const esc = value => value;
    const layoutCanvas = () => {};
    const renderRight = () => {};
    const state = { pages: [{ id: 'page', title: 'Unchanged' }] };
    const hist = { u: [{ label: 'Earlier edit' }], r: [] };
    let saveState = 'ok';
    window.rightSurfaceDocumentState = () => JSON.stringify({ state, hist, saveState });
    ${builder.slice(builder.indexOf('let rightSurfaceTrigger = null;'), builder.indexOf('\nfunction closeReviewSurface()'))}
  `);
  return { w, d, canvasFocus };
}

test.each([
  { width: 1440, close: 'button' },
  { width: 1360, close: 'escape' },
  { width: 768, close: 'button' },
  { width: 600, close: 'escape' }
])('WordPress right surfaces replace library focus at $width px and restore it on $close', async ({ width, close }) => {
  const { w, d } = rightSurfaceHarness();
  Object.defineProperty(w, 'innerWidth', { configurable: true, value: width });
  const trigger = d.querySelector('#historyBtn');
  trigger.focus();
  d.body.classList.add('library-focus');
  const documentBefore = w.rightSurfaceDocumentState();

  const panel = w.openRightSurface('Version history', 'WordPress revisions', '<p>Saved version</p>', trigger);
  await new Promise(resolve => w.requestAnimationFrame(resolve));
  expect(panel.hidden).toBe(false);
  expect(d.body.classList.contains('library-focus')).toBe(false);
  expect(d.body.classList.contains('canvas-focus')).toBe(false);
  expect(d.activeElement).toBe(d.querySelector('#rightSurfaceClose'));

  if (close === 'escape') d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  else d.querySelector('#rightSurfaceClose').click();
  await new Promise(resolve => w.requestAnimationFrame(resolve));
  expect(panel.hidden).toBe(true);
  expect(d.body.classList.contains('library-focus')).toBe(true);
  expect(d.activeElement).toBe(trigger);
  expect(w.rightSurfaceDocumentState()).toBe(documentBefore);
});

test('WordPress right surfaces temporarily leave canvas focus and restore its control state', async () => {
  const { w, d, canvasFocus } = rightSurfaceHarness();
  canvasFocus.click();
  expect(d.body.classList.contains('canvas-focus')).toBe(true);
  expect(canvasFocus.getAttribute('aria-pressed')).toBe('true');
  const documentBefore = w.rightSurfaceDocumentState();
  const trigger = d.querySelector('#reviewBtn');

  w.openRightSurface('Site checks', 'Checks for this WordPress page', '<p>No issues</p>', trigger);
  expect(d.body.classList.contains('canvas-focus')).toBe(false);
  expect(canvasFocus.getAttribute('aria-pressed')).toBe('false');
  expect(canvasFocus.getAttribute('aria-label')).toBe('Hide side panels');
  const nextTrigger = d.querySelector('#historyBtn');
  w.openRightSurface('Version history', 'WordPress revisions', '<p>Saved version</p>', nextTrigger);
  w.closeRightSurface();
  await new Promise(resolve => w.requestAnimationFrame(resolve));
  expect(d.body.classList.contains('canvas-focus')).toBe(true);
  expect(canvasFocus.getAttribute('aria-pressed')).toBe('true');
  expect(canvasFocus.getAttribute('aria-label')).toBe('Show side panels');
  expect(d.activeElement).toBe(nextTrigger);
  expect(w.rightSurfaceDocumentState()).toBe(documentBefore);
});

test('replacing and closing a modal detach pending preview listeners', async () => {
  const { w, d } = await editor();
  const check = replace => {
    w.openModal('Preview', '<iframe id="test-preview"></iframe>', '');
    const frame = d.querySelector('#test-preview');
    w.loadPublicationFrame(frame, '/saved-version/index.html');
    const status = d.querySelector('#mBody .pc-preview-state [role="status"]');
    const token = new URL(frame.src).searchParams.get('pcPreviewReady');
    const source = frame.contentWindow;
    if (replace) w.openModal('Other dialog', '<p>Different content</p>', '');
    else w.eval('closeModal()');
    w.dispatchEvent(new w.MessageEvent('message', { source, data: { type: 'pagecraft-preview-ready', token, status: 'ready' } }));
    expect(status.textContent).toBe('Loading page preview…');
  };
  check(true); check(false);
});

test('component root rejects sibling insertion without changing the document or history', async () => {
  const { w, d, core, errors } = await editor();
  core.edit(() => { core.tree().splice(0); core.selSet([]); });
  const heading = core.insert('heading', null, 0);
  const componentId = core.componentFromNode(heading.id, 'Headline component');
  core.componentOpen(componentId);
  const root = core.findComponent(componentId).node;
  core.selSet([root.id]);
  w.renderPalette();
  expect(w.insertionHint('heading')).toContain('Choose a container inside this component');
  const documentBefore = JSON.stringify(core.doc());
  const undoBefore = core.hist.u.length, redoBefore = core.hist.r.length;
  const tile = Array.from(d.querySelectorAll('.pitem')).find(button => button.textContent.trim() === 'Heading');
  expect(tile).toBeTruthy();
  tile.click();
  expect(JSON.stringify(core.doc())).toBe(documentBefore);
  expect(core.hist.u.length).toBe(undoBefore);
  expect(core.hist.r.length).toBe(redoBefore);
  expect(core.state.ui.sel).toBe(root.id);
  // Supply only the minimum canvas DOM needed to observe removal of a stale indicator.
  w.eval('cdoc = document.implementation.createHTMLDocument("test canvas"); cdoc.body.innerHTML = \'<div id="s-drop"></div>\';');
  w.previewInsertion('heading');
  expect(w.eval('cdoc.getElementById("s-drop")')).toBeNull();
  expect(errors).toEqual([]);
});
