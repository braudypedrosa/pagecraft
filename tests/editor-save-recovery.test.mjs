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

test('a WordPress compiler conflict preserves the draft and opens reload recovery from the Done action', async () => {
  const config = {
    restUrl: 'http://localhost/wp-json/pagecraft/v1', nonce: 'qa-nonce', version: 39,
    doc: null, role: 'owner', page: { id: 42, title: 'Compiler conflict QA', slug: 'compiler-qa' },
    capabilities: ['edit_document', 'edit_structure']
  };
  const marker = '<script>\n/* =====================================================================';
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(marker,
    `<script>window.PC_WORDPRESS=${JSON.stringify(config)}</script>\n${marker}`);
  const requests = [];
  let answer;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://localhost/wp-admin/admin-ajax.php', virtualConsole: new VirtualConsole(),
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
    const window = dom.window, document = window.document;
    // jsdom can stop boot at the iframe load boundary; real WordPress binds the shell action.
    if (document.querySelector('#publishLabel').textContent !== 'Done') window.bindTop();
    window.__CORE.state.meta.name = 'Keep this compiler-conflict draft';

    document.querySelector('#exportBtn').click();
    await tick();
    assert.equal(requests.length, 1, 'the WordPress Done action makes one save attempt');
    assert.equal(requests[0].version, 39);
    answer(409, {
      error: 'The Pagecraft compiler changed before this output was saved. Reload the editor and save again.',
      reloadRequired: true,
      compiler: { editorVersion: '0.2.17-preview.20261021.69' }
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(document.querySelector('#modal').hidden, false, 'recovery must be visible, not only written into hidden modal DOM');
    assert.equal(document.querySelector('#mTitle').textContent, 'Reload Pagecraft to keep editing');
    assert.match(document.querySelector('#mBody').textContent, /Pagecraft was updated while this editor was open/i);
    assert.match(document.querySelector('#mBody').textContent, /latest changes are still in this tab and have not been saved/i);
    assert.doesNotMatch(document.querySelector('#mBody').textContent, /compiler|0\.2\.17|renderer/i,
      'server diagnostics stay out of the customer-facing recovery dialog');
    assert.equal(document.querySelector('#compilerBackup')?.textContent, 'Download my copy');
    assert.equal(document.querySelector('#compilerReload')?.textContent, 'Reload builder');
    assert.ok(document.querySelector('#modalBox').contains(document.activeElement), 'focus moves into the visible recovery dialog');
    assert.equal(document.querySelector('#stReload'), null, 'a compiler mismatch is not presented as another author saving');
    assert.equal(document.querySelector('#busyRetry'), null, 'retrying the same obsolete compiler is not offered');
    assert.equal(document.querySelector('#svRetry'), null);
    assert.equal(window.__CORE.state.meta.name, 'Keep this compiler-conflict draft');

    await new Promise(resolve => setTimeout(resolve, 600));
    assert.equal(requests.length, 1, 'the failed save is not replayed automatically');
    const unload = new window.Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    assert.equal(unload.defaultPrevented, true, 'the preserved draft remains unsaved until deliberate recovery');
  } finally {
    dom.window.close();
  }
});

const marker = '<script>\n/* =====================================================================';
const built = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 800));

test('hosted network failure gives connection guidance and retry preserves the unsaved document', async () => {
  // Hosted editing requires a readable saved project. Seed it from the same built
  // editor rather than accidentally testing the incompatible-document guard.
  const seed = new JSDOM(built(), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole()
  });
  await settle();
  const server = { siteId: 'offline-qa', version: 1, role: 'owner', doc: seed.window.__CORE.clone(seed.window.__CORE.doc()) };
  seed.window.close();
  const html = built().replace(marker, `<script>window.PC_SERVER=${JSON.stringify(server)}</script>\n${marker}`);
  const requests = [];
  let online = false;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.fetch = async (_url, options = {}) => {
        if (options.method === 'PUT') {
          requests.push(JSON.parse(options.body));
          if (!online) throw new TypeError('Failed to fetch');
          return { ok: true, status: 200, json: async () => ({ version: 2 }) };
        }
        return { ok: true, status: 200, json: async () => [] };
      };
    }
  });
  try {
    await settle();
    const window = dom.window, document = window.document;
    // jsdom can stop boot at the iframe load boundary; real browsers dispatch it.
    if (document.querySelector('#savedTag').textContent === '—') window.bindTop();
    window.__CORE.state.meta.name = 'Keep the offline QA draft';
    await window.writeNow();
    assert.match(document.querySelector('#mBody').textContent, /connection to the host was lost/i);
    assert.match(document.querySelector('#mBody').textContent, /Check your connection/);
    assert.doesNotMatch(document.querySelector('#mBody').textContent, /Private.browsing|blocked cookies/);
    assert.equal(window.__CORE.state.meta.name, 'Keep the offline QA draft');
    assert.ok(document.querySelector('#svBackup'));
    document.querySelector('#mClose').click();
    await new Promise(resolve => setTimeout(resolve, 200));
    document.querySelector('#reviewBtn').focus();
    document.querySelector('#reviewBtn').click();
    assert.equal(document.querySelector('#mTitle').textContent, 'Site checks');
    assert.match(document.querySelector('#actionProblems').textContent, /latest changes were not saved/);
    assert.equal(document.querySelector('#releasePublish'), null, 'checking issues must not open publishing');
    assert.equal(document.querySelector('#exZip'), null, 'checking issues must not open exporting');
    document.querySelector('[data-problem-return]').click();
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(requests.length, 1, 'returning to recovery must not replay the failed save');
    assert.equal(document.querySelector('#mTitle').textContent, 'Your work is no longer being saved');
    assert.equal(document.querySelector('#modal').hidden, false);
    assert.ok(document.querySelector('#modalBox').contains(document.activeElement), 'focus stays in the reopened recovery dialog after the previous exit');
    document.querySelector('#mClose').click();
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(document.activeElement, document.querySelector('#reviewBtn'), 'recovery returns focus to the original checks trigger');
    document.querySelector('#reviewBtn').click();
    document.querySelector('[data-problem-return]').click();
    await new Promise(resolve => setTimeout(resolve, 200));
    online = true;
    document.querySelector('#svRetry').click();
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1], requests[0]);
    assert.equal(document.querySelector('#modal').hidden, true);
    assert.match(document.querySelector('#savedTag').textContent, /Draft saved/);
    document.querySelector('#reviewBtn').click();
    assert.equal(document.querySelector('#actionProblems').hidden, true, 'successful retry clears the retained save problem');
  } finally {
    dom.window.close();
  }
});

test('a hosted document this build cannot open is never overwritten by the demo', async () => {
  const server = { siteId: 'site-newer', version: 12, role: 'owner', doc: { schemaVersion: 9999, pages: [] } };
  const html = built().replace(marker, `<script>window.PC_SERVER=${JSON.stringify(server)}</script>\n${marker}`);
  const writes = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.fetch = async (url, options = {}) => {
        if (options.method && options.method !== 'GET') writes.push([String(url), options.method]);
        return { ok: true, status: 200, json: async () => [] };
      };
    }
  });
  try {
    await settle();
    const window = dom.window, document = window.document;
    assert.match(document.querySelector('#mBody').textContent, /nothing you do here will be saved/);
    window.__CORE.edit(() => { window.__CORE.state.meta.name = 'Demo edit'; });
    await new Promise(resolve => setTimeout(resolve, 700));      // past the save debounce
    await window.writeNow();
    assert.deepEqual(writes, [], 'not one write reached the server');
    assert.equal(document.querySelector('#savedTag').textContent, 'Not saving');
  } finally {
    dom.window.close();
  }
});

test('an unreadable project in this browser is left exactly as it was', async () => {
  const stored = JSON.stringify({ schemaVersion: 9999, meta: {}, pages: [] });
  const dom = new JSDOM(built(), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole(),
    beforeParse(window) { window.localStorage.setItem('pagecraft.project.v1', stored); }
  });
  try {
    await settle();
    const window = dom.window;
    window.__CORE.edit(() => { window.__CORE.state.meta.name = 'Demo edit'; });
    await new Promise(resolve => setTimeout(resolve, 700));
    window.writeNow();
    window.dispatchEvent(new window.Event('pagehide'));
    assert.equal(window.localStorage.getItem('pagecraft.project.v1'), stored);
    assert.equal(window.document.querySelector('#savedTag').textContent, 'Not saving');
  } finally {
    dom.window.close();
  }
});

test('closing the tab inside the save debounce prompts, and pagehide writes the last edit', async () => {
  const dom = new JSDOM(built(), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole() });
  try {
    await settle();
    const window = dom.window, C = window.__CORE;
    const unload = () => {
      const e = new window.Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    window.writeNow();
    assert.equal(unload(), false, 'nothing unsaved, nothing to ask');
    C.edit(() => { C.state.meta.name = 'Typed just before closing'; });
    assert.equal(unload(), true, 'an edit still waiting on the debounce is unsaved');
    window.dispatchEvent(new window.Event('pagehide'));
    assert.equal(JSON.parse(window.localStorage.getItem('pagecraft.project.v1')).meta.name, 'Typed just before closing');
    assert.equal(unload(), false);
  } finally {
    dom.window.close();
  }
});

test('an expired WordPress nonce is refreshed once; an ended session says so, never “not yours to make”', async () => {
  const config = {
    restUrl: 'http://localhost/wp-json/pagecraft/v1', nonce: 'stale00000', version: 2, doc: null, role: 'owner',
    page: { id: 42, title: 'Nonce QA', slug: 'nonce-qa' }, capabilities: ['edit_document', 'edit_structure']
  };
  const html = built().replace(marker, `<script>window.PC_WORDPRESS=${JSON.stringify(config)}</script>\n${marker}`);
  const puts = [], asked = [];
  let accepted = 'fresh00000', handed = 'fresh00000';
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'http://localhost/wp-admin/admin-ajax.php?action=pagecraft_editor_frame',
    beforeParse(window) {
      window.fetch = async (url, options = {}) => {
        if (String(url).includes('action=rest-nonce')) {
          asked.push(String(url));
          return { ok: true, status: 200, text: async () => handed };
        }
        if (String(url).endsWith('/document') && options.method === 'PUT') {
          const nonce = new window.Headers(options.headers).get('X-WP-Nonce');
          puts.push(nonce);
          return nonce === accepted
            ? { ok: true, status: 200, json: async () => ({ version: 3 }) }
            : { ok: false, status: 403, json: async () => ({ code: 'rest_cookie_invalid_nonce', message: 'Cookie check failed' }) };
        }
        return { ok: true, status: 200, json: async () => [] };
      };
    }
  });
  try {
    await settle();
    const window = dom.window, document = window.document;
    await window.writeNow();
    assert.deepEqual(puts, ['stale00000', 'fresh00000'], 'refreshed once and retried');
    assert.deepEqual(asked, ['http://localhost/wp-admin/admin-ajax.php?action=rest-nonce']);
    assert.match(document.querySelector('#savedTag').textContent, /Draft saved/);

    // The login itself has ended: WordPress hands out no nonce, so the save fails once, plainly.
    accepted = 'never'; handed = '0'; puts.length = 0;
    await window.writeNow();
    assert.deepEqual(puts, ['fresh00000'], 'no retry without a fresh nonce');
    assert.equal(document.querySelector('#mTitle').textContent, 'Your WordPress session expired');
    assert.match(document.querySelector('#mBody').textContent, /Your WordPress session expired\. Reload to keep editing\./);
    assert.doesNotMatch(document.querySelector('#mBody').textContent, /not yours|text and CMS content/);
  } finally {
    dom.window.close();
  }
});
