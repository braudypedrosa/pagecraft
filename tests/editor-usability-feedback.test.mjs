import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import * as C from '../app/src/core/index';

const windows = [];
const builder = readFileSync('builder.html', 'utf8');
// JSDOM does not load iframe srcdoc. These chrome tests bypass only canvas mounting.
const built = readFileSync('index.html', 'utf8').replace('await mountCanvas();', '/* Canvas mounting is browser-verified separately. */');
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

async function editor(config = null, wordpress = false) {
  C.blankProject('Editor usability fixture');
  const values = config ? { siteId: 'qa', name: 'QA', role: 'owner', version: 1, doc: JSON.parse(JSON.stringify(C.doc())), ...config } : null;
  const marker = '<script>\n/* =====================================================================';
  const html = values ? built.replace(marker, `<script>window.${wordpress ? 'PC_WORDPRESS' : 'PC_SERVER'}=${JSON.stringify(values)}</script>\n${marker}`) : built;
  const errors = [], calls = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://example.test/edit/qa', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
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
  const { w, d } = await editor({ restUrl: 'https://example.test/wp-json/pagecraft/v1', nonce: 'fixture', page: { id: 42, title: 'WP page', slug: 'wp-page' }, capabilities: ['edit_document', 'edit_structure'], previewUrl: 'https://example.test/wp-page/' }, true);
  expect(d.querySelector('#clientReviewBtn').hidden).toBe(true);
  w.clientReviewModal();
  expect(d.querySelector('#modal').hidden).toBe(true);
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
