import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('builder.html', 'utf8');
const publish = source.slice(source.indexOf('async function publishDraft('), source.indexOf('\nasync function wordpressPublishModal()'));
const windows = [];
afterEach(() => { windows.splice(0).forEach(dom => dom.window.close()); });

function fixture() {
  const dom = new JSDOM('<div id="releasePanel"></div><button id="publish"></button>', { runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window;
  let resolve, reject;
  const result = new Promise((yes, no) => { resolve = yes; reject = no; });
  let started;
  const publishing = new Promise(resolveStarted => { started = resolveStarted; });
  const current = { heading: 'Pine' };
  const stamp = vi.fn();
  const action = { success: vi.fn(), error: vi.fn() };
  Object.assign(w, {
    lint: () => [], lintCounts: () => ({ error: 0, warn: 0 }),
    feedback: () => ({ begin: () => action }), $: s => w.document.querySelector(s),
    flushDraft: async () => {}, doc: () => current,
    SRV: { version: 17, publishedVersion: 16 },
    HOST: { releases: { prepare: true, publish: () => { started(); return result; } } },
    publicationPreviewSnapshot: async () => null,
    paintShareState: () => {}, renderReleasePanel: () => {}, stamp, esc: String,
    saving: false, saveAgain: false, saveState: 'ok', lastCloudDocument: JSON.stringify(current),
  });
  w.eval(publish);
  const reviewed = { sourceVersion: 17, snapshotId: 'snapshot', document: JSON.stringify(current), warnings: [] };
  const run = () => w.publishDraft(w.document.querySelector('#publish'), reviewed);
  return { w, current, stamp, action, resolve, reject, run, publishing };
}

for (const status of ['published', 'unchanged']) test(`${status} publication updates the indicator only for the current saved reviewed draft`, async () => {
  const f = fixture();
  const pending = f.run();
  await f.publishing;
  f.resolve({ status, publicationId: 'release', sourceVersion: 17 });
  await pending;
  expect(f.stamp).toHaveBeenCalledWith('Published', false);
});

for (const change of ['unsaved', 'saved', 'saving', 'save failure', 'different response', 'unsuccessful response']) test(`publication does not mark a ${change} draft as published`, async () => {
  const f = fixture();
  const pending = f.run();
  await f.publishing;
  if (change === 'unsaved') f.current.heading = 'Lake';
  if (change === 'saved') { f.current.heading = 'Lake'; f.w.SRV.version = 18; f.w.lastCloudDocument = JSON.stringify(f.current); }
  if (change === 'saving') f.w.saving = true;
  if (change === 'save failure') f.w.saveState = 'failed';
  f.resolve({ status: change === 'unsuccessful response' ? 'failed' : 'published', publicationId: 'release', sourceVersion: change === 'different response' ? 16 : 17 });
  await pending;
  expect(f.stamp).not.toHaveBeenCalled();
});

test('failed publication does not mark a draft as published', async () => {
  const f = fixture();
  const pending = f.run();
  await f.publishing;
  f.reject(new Error('unavailable'));
  await pending;
  expect(f.action.error).toHaveBeenCalled();
  expect(f.stamp).not.toHaveBeenCalled();
});

test('a later edit immediately clears the published indicator before autosave', () => {
  const f = fixture();
  f.w.document.body.insertAdjacentHTML('beforeend', '<span id="savedTag">Published</span>');
  Object.assign(f.w, { IS_WORDPRESS: false, dirty: false, saveSoon: vi.fn() });
  const start = source.indexOf('const save = () => {');
  const save = source.slice(start, source.indexOf('\n/* A failed write', start));
  f.w.eval(save + '\nsave();');
  expect(f.stamp).toHaveBeenCalledWith('Draft changed — not published', false);
  expect(f.w.dirty).toBe(true);
  expect(f.w.saveSoon).toHaveBeenCalledOnce();
});
