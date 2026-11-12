import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const builder = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const publish = builder.slice(builder.indexOf('async function publishDraft('), builder.indexOf('\nasync function wordpressPublishModal('));
const stale = builder.slice(builder.indexOf('function warnStale('), builder.indexOf('\n/* A content account tried', builder.indexOf('function warnStale(')));

function fixture(payload) {
  const dom = new JSDOM('<body><button id="publish">Publish</button><div id="releasePanel"></div><div id="modal"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window, document = w.document;
  const backup = vi.fn(), reload = vi.fn(), remembered = vi.fn();
  const documentCopy = { pages: [{ name: 'Retained draft' }] };
  Object.assign(w, {
    $: selector => document.querySelector(selector), SRV: { version: 1893 },
    lint: () => [], lintCounts: () => ({ error: 0, warn: 0 }),
    feedback: () => ({ begin: () => ({ success: vi.fn(), error: vi.fn() }) }),
    flushDraft: async () => {}, doc: () => documentCopy,
    publicationPreviewSnapshot: async () => null,
    HOST: { releases: { prepare: true, publish: async () => { throw Object.assign(new Error(payload.error), { status: 409, payload }); } } },
    rememberSaveProblem: remembered,
    openModal: (title, body, footer) => { document.querySelector('#modal').innerHTML = `<h2>${title}</h2>${body}${footer}`; },
    backupJson: backup, reloadDiscardingChanges: reload,
    esc: value => String(value), toast: vi.fn()
  });
  w.eval(`let saveWarned = false;\n${stale}\n${publish}`);
  return { dom, w, document, backup, reload, remembered, documentCopy };
}

describe('publication conflict recovery', () => {
  test('maps the server stale publication version into the existing recovery dialog', async () => {
    const f = fixture({ error: 'stale_source_version', sourceVersion: 1893, currentVersion: 1894 });
    await f.w.publishDraft(f.document.querySelector('#publish'), { sourceVersion: 1893, document: JSON.stringify(f.documentCopy), snapshotId: 'reviewed' });
    const modal = f.document.querySelector('#modal');
    expect(modal.textContent).toContain('Your version is 1893, the host now has 1894');
    expect(modal.textContent).not.toContain('host now has ?');
    expect(f.documentCopy.pages[0].name).toBe('Retained draft');
    expect(f.remembered).toHaveBeenCalledOnce();
    modal.querySelector('#stBackup').click();
    modal.querySelector('#stReload').click();
    expect(f.backup).toHaveBeenCalledOnce();
    expect(f.reload).toHaveBeenCalledOnce();
    f.dom.window.close();
  });

  test('keeps the existing save-conflict payload and recovery behavior', () => {
    const f = fixture({});
    f.w.warnStale({ conflict: { yours: 1893, theirs: 1895 } });
    expect(f.document.querySelector('#modal').textContent).toContain('host now has 1895');
    expect(f.document.querySelector('#stBackup')).not.toBeNull();
    expect(f.document.querySelector('#stReload')).not.toBeNull();
    f.dom.window.close();
  });
});
