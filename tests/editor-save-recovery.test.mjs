import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('busy saves preserve edits, wait for explicit retry, and retain real conflict protection', async () => {
  const config = {
    restUrl: 'http://localhost/wp-json/pagecraft/v1', nonce: 'qa-nonce', version: 2,
    doc: null, role: 'owner', page: { id: 42, title: 'Save recovery QA', slug: 'save-qa' },
    capabilities: ['edit_document', 'edit_structure']
  };
  const marker = '<script>\n/* =====================================================================';
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(marker,
    `<script>window.PC_WORDPRESS=${JSON.stringify(config)}</script>\n${marker}`);
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const requests = [];
  let answer;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://localhost/wp-admin/admin-ajax.php', virtualConsole: console,
    beforeParse(window) {
      window.fetch = async (url, options = {}) => {
        if (String(url).endsWith('/document') && options.method === 'PUT') {
          requests.push(JSON.parse(options.body));
          return new Promise(resolve => { answer = (status, payload) => resolve({
            ok: status === 200, status, json: async () => payload
          }); });
        }
        return { ok: true, status: 200, json: async () => [] };
      };
    }
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 800));
    const window = dom.window;
    const document = window.document;
    window.__CORE.state.meta.name = 'Keep this unsaved QA edit';
    const first = window.writeNow();
    await tick();
    await window.writeNow(); // Queue a second call while the first is in flight.
    answer(409, { error: 'An operation holds the write lock.', retryable: true });
    await first;
    await tick();
    assert.equal(requests.length, 1, 'busy must not replay the queued save automatically');
    assert.equal(document.querySelector('#mTitle').textContent, 'Saving is temporarily busy');
    assert.match(document.querySelector('#mBody').textContent, /still here in this tab/);
    assert.doesNotMatch(document.querySelector('#mBody').textContent, /host now has|somebody|reload/i);
    assert.equal(document.querySelector('#stReload'), null);
    assert.equal(window.__CORE.state.meta.name, 'Keep this unsaved QA edit');
    document.querySelector('#busyRetry').click();
    await tick();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].version, 2, 'retry must not skip the version check');
    assert.deepEqual(requests[1].document, requests[0].document);
    answer(409, { error: 'Still busy.', retryable: true });
    await tick();
    assert.equal(document.querySelector('#modal').hidden, false, 'another busy retry remains actionable');
    document.querySelector('#busyRetry').click();
    await tick();
    answer(200, { version: 3 });
    await tick();
    assert.equal(document.querySelector('#modal').hidden, true);
    assert.match(document.querySelector('#savedTag').textContent, /Draft saved/);
    const next = window.writeNow();
    await tick();
    assert.equal(requests.at(-1).version, 3);
    answer(409, { retryable: true });
    await next;
    document.querySelector('#mClose').click();
    const stale = window.writeNow();
    await tick();
    answer(409, { conflict: { mine: 3, theirs: 4 } });
    await stale;
    await tick();
    assert.equal(document.querySelector('#mTitle').textContent, 'Somebody else saved this page');
    assert.match(document.querySelector('#mBody').textContent, /host now has 4/);
    assert.ok(document.querySelector('#stBackup'));
    assert.ok(document.querySelector('#stReload'));
    assert.equal(document.querySelector('#busyRetry'), null, 'a real conflict never offers overwrite/retry');
    assert.equal(window.__CORE.state.meta.name, 'Keep this unsaved QA edit');
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
