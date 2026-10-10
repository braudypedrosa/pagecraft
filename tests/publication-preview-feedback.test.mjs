import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const builder = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const publicationSource = builder.slice(
  builder.indexOf('const publicationFrameCleanup ='),
  builder.indexOf('\n/* Scheduling publishes this exact reviewed version later')
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(prepare) {
  const dom = new JSDOM(`<body><div id="publicationChanges"><p>Old reviewed preview</p></div>
    <button id="releasePrepare">Create publication preview</button>
    <button id="releaseSchedule">Schedule…</button>
    <button id="releasePublish">Publish reviewed version</button></body>`, {
    url: 'https://example.test/edit/qa', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const { window: w } = dom;
  const doc = w.document;
  const project = { pages: [{ name: 'Home', slug: 'index' }, { name: 'Contact', slug: 'contact' }], ui: { mode: 'page' }, cur: 0 };
  const notices = [];
  Object.assign(w, {
    $: selector => doc.querySelector(selector),
    esc: value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])),
    feedback: () => ({ begin: button => ({
      success: message => notices.push(['success', message]),
      error: message => notices.push(['error', message]),
      cancel: () => notices.push(['cancel'])
    }) }),
    flushDraft: async () => {},
    HOST: { releases: { prepare } },
    SRV: { siteId: 'qa', version: 4 },
    doc: () => ({ pages: [] }),
    state: project,
    locate: id => id === 'form-1' ? { node: { id } } : null,
    closeModal: vi.fn(), render: vi.fn(), select: vi.fn(), showPanel: vi.fn(),
    publishDraft: vi.fn(), openSchedulePanel: vi.fn(), toast: vi.fn()
  });
  w.eval(publicationSource);
  return { dom, w, doc, notices };
}

describe('publication preview failure feedback', () => {
  test('persists escaped 422 findings with page context and safe navigation', async () => {
    const error = Object.assign(new Error('publication_validation_failed'), {
      status: 422,
      payload: {
        error: 'publication_validation_failed',
        findings: [{
          code: 'form-no-action',
          message: '<img src=x onerror=alert(1)> Choose a submission destination.',
          where: { page: 'Contact', slug: 'contact', region: 'page', node: 'Form' }
        }]
      }
    });
    const { dom, w, doc, notices } = fixture(async () => { throw error; });

    await w.preparePublicationReview(doc.querySelector('#releasePrepare'));

    const host = doc.querySelector('#publicationChanges');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('did not pass publication checks');
    expect(host.textContent).toContain('Choose a submission destination.');
    expect(host.textContent).toContain('Contact · page · Form');
    expect(host.querySelector('img')).toBeNull();
    expect(doc.querySelector('#releasePublish').disabled).toBe(true);
    expect(doc.querySelector('#releaseSchedule').disabled).toBe(true);
    expect(notices.at(-1)?.[1]).not.toContain('publication_validation_failed');

    host.querySelector('[data-publication-finding]').click();
    expect(w.closeModal).toHaveBeenCalledOnce();
    expect(w.state.cur).toBe(1);
    expect(w.showPanel).toHaveBeenCalledWith('layers');
    dom.window.close();
  });

  test('retry removes stale failure immediately and keeps publish controls gated', async () => {
    const next = deferred();
    let attempt = 0;
    const { dom, w, doc } = fixture(async () => {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error('publication_validation_failed'), {
        status: 422,
        payload: { error: 'publication_validation_failed', findings: [{ message: 'Fix the form.', where: { page: 'Contact', slug: 'contact' } }] }
      });
      return next.promise;
    });

    const button = doc.querySelector('#releasePrepare');
    await w.preparePublicationReview(button);
    expect(doc.querySelector('.publication-preview-error')).not.toBeNull();

    const retry = w.preparePublicationReview(button);
    await Promise.resolve();
    expect(doc.querySelector('.publication-preview-error')).toBeNull();
    expect(doc.querySelector('#publicationChanges').textContent).toContain('Preparing a new publication preview');
    expect(doc.querySelector('#releasePublish').disabled).toBe(true);
    expect(doc.querySelector('#releaseSchedule').disabled).toBe(true);

    next.resolve({
      snapshotId: 'reviewed-4', sourceVersion: 4, baselinePublicationId: null,
      comparisonAvailable: true, changes: [], pages: ['index.html'], warnings: [],
      draftPages: ['index.html'], publishedPages: []
    });
    await retry;
    expect(doc.querySelector('.publication-preview-error')).toBeNull();
    expect(doc.querySelector('#publicationChanges').textContent).toContain('Review of saved version 4');
    expect(doc.querySelector('#releasePublish').disabled).toBe(false);
    expect(doc.querySelector('#releaseSchedule').disabled).toBe(false);
    expect(typeof doc.querySelector('#releasePublish').onclick).toBe('function');
    expect(typeof doc.querySelector('#releaseSchedule').onclick).toBe('function');
    dom.window.close();
  });

  test('generic server errors never expose internal code-only messages', async () => {
    const error = Object.assign(new Error('snapshot_storage_failed'), {
      status: 500, payload: { error: 'snapshot_storage_failed', detail: '<b>database table snapshots_internal failed</b>' }
    });
    const { dom, w, doc } = fixture(async () => { throw error; });

    await w.preparePublicationReview(doc.querySelector('#releasePrepare'));

    expect(doc.querySelector('#publicationChanges').textContent).toContain('could not create the publication preview');
    expect(doc.querySelector('#publicationChanges').textContent).not.toContain('snapshot_storage_failed');
    expect(doc.querySelector('#publicationChanges').textContent).not.toContain('snapshots_internal');
    expect(doc.querySelector('#publicationChanges b')?.textContent).not.toContain('database table');
    dom.window.close();
  });

  test('a validation failure without structured findings directs the user to Site checks', async () => {
    const error = Object.assign(new Error('publication_validation_failed'), {
      status: 422, payload: { error: 'publication_validation_failed', detail: 'schema internals' }
    });
    const { dom, w, doc } = fixture(async () => { throw error; });

    await w.preparePublicationReview(doc.querySelector('#releasePrepare'));

    expect(doc.querySelector('#publicationChanges').textContent).toContain('Review Site checks');
    expect(doc.querySelector('#publicationChanges').textContent).not.toContain('schema internals');
    dom.window.close();
  });

  test('preserves the trusted stale-draft recovery message', async () => {
    const { dom, w, doc, notices } = fixture(async () => ({
      snapshotId: 'stale', sourceVersion: 3, baselinePublicationId: null,
      comparisonAvailable: true, changes: [], pages: ['index.html'], warnings: []
    }));

    await w.preparePublicationReview(doc.querySelector('#releasePrepare'));

    const message = 'The draft changed while preparing the preview. Create a new preview.';
    expect(doc.querySelector('#publicationChanges').textContent).toContain(message);
    expect(notices.at(-1)).toEqual(['error', message]);
    expect(doc.querySelector('#releasePublish').disabled).toBe(true);
    expect(doc.querySelector('#releaseSchedule').disabled).toBe(true);
    dom.window.close();
  });

  test('labels mixed findings as problems and suggestions by level', async () => {
    const error = Object.assign(new Error('publication_validation_failed'), {
      status: 422,
      payload: { error: 'publication_validation_failed', findings: [
        { level: 'error', message: 'Fix the form.', where: { page: 'Contact', slug: 'contact' } },
        { level: 'warn', message: 'Add a description.', where: { page: 'Contact', slug: 'contact' } }
      ] }
    });
    const { dom, w, doc } = fixture(async () => { throw error; });

    await w.preparePublicationReview(doc.querySelector('#releasePrepare'));

    expect(doc.querySelector('.publication-preview-findings .rh').textContent).toContain('1 problem · 1 suggestion');
    expect(doc.querySelectorAll('.publication-preview-findings .lv.error')).toHaveLength(1);
    expect(doc.querySelectorAll('.publication-preview-findings .lv.warn')).toHaveLength(1);
    dom.window.close();
  });
});
