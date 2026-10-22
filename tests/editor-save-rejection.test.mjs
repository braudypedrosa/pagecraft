import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const marker = '<script>\n/* =====================================================================';
const config = {
  restUrl: 'http://localhost/wp-json/pagecraft/v1', nonce: 'qa-nonce', version: 2,
  doc: null, role: 'owner', page: { id: 42, title: 'Save rejection QA', slug: 'save-qa' },
  capabilities: ['edit_document', 'edit_structure']
};
const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

for (const [status, payload, reason] of [
  [400, { error: 'The compiled Pagecraft page contains unsupported executable markup.' }, /unsupported executable markup/],
  [422, { error: 'The compiled Pagecraft page contains an unsafe inline style.' }, /unsafe inline style/],
  [400, { message: 'Pagecraft iframe embeds must use an absolute HTTPS URL.' }, /absolute HTTPS URL/],
  [422, { error: '<img src=x onerror=alert(1)> token=secret https://user:pass@example.test/private' }, null],
  [400, { error: { token: 'secret' } }, null]
]) {
  test(`WordPress ${status} rejection explains correction and preserves explicit retry (${String(payload.error || payload.message).slice(0, 45)})`, async () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(marker,
      `<script>window.PC_WORDPRESS=${JSON.stringify(config)}</script>\n${marker}`);
    const requests = [];
    let accept = false;
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole(),
      beforeParse(window) {
        window.fetch = async (url, options = {}) => {
          if (String(url).endsWith('/document') && options.method === 'PUT') {
            requests.push(JSON.parse(options.body));
            return { ok: accept, status: accept ? 200 : status, json: async () => accept ? { version: 3 } : payload };
          }
          return { ok: true, status: 200, json: async () => [] };
        };
      }
    });
    try {
      await wait(800);
      const { window } = dom, document = window.document;
      window.__CORE.state.meta.name = 'Keep this rejected draft';
      await window.writeNow();
      assert.equal(document.querySelector('#mTitle').textContent, 'This draft could not be saved');
      const body = document.querySelector('#mBody').textContent;
      assert.match(body, /host rejected this save/i);
      assert.match(body, /correct|fix/i);
      assert.doesNotMatch(body, /reconnect|check your connection|could not confirm/i);
      if (reason) assert.match(body, reason);
      assert.doesNotMatch(body, /secret|user:pass|example\.test|onerror|\[object Object\]/);
      assert.equal(document.querySelector('#mBody img'), null);
      assert.ok(document.querySelector('#svBackup'));
      assert.equal(window.__CORE.state.meta.name, 'Keep this rejected draft');
      const unload = new window.Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      assert.ok(unload.defaultPrevented);
      await wait(100);
      assert.equal(requests.length, 1, 'no automatic replay after rejection');
      accept = true;
      document.querySelector('#svRetry').click();
      await wait(100);
      assert.equal(requests.length, 2);
      assert.deepEqual(requests[1], requests[0], 'explicit retry retains the same unsaved draft and version');
      assert.match(document.querySelector('#savedTag').textContent, /Draft saved/);
    } finally { dom.window.close(); }
  });
}

for (const surface of ['historyModal', 'historyPanel']) {
  for (const success of [true, false]) {
    test(`${surface}: only confirmed restore releases failed-save unload and replay guards (${success})`, async () => {
      const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(marker,
        `<script>window.PC_WORDPRESS=${JSON.stringify(config)}</script>\n${marker}`);
      const writes = [];
      const dom = new JSDOM(html, {
        runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole(),
        beforeParse(window) {
          window.fetch = async (url, options = {}) => {
            if (options.method === 'PUT') {
              writes.push(JSON.parse(options.body));
              return { ok: false, status: 400, json: async () => ({ error: 'The compiled Pagecraft page contains unsupported executable markup.' }) };
            }
            if (String(url).endsWith('/restore')) return {
              ok: success, status: success ? 200 : 400,
              json: async () => success ? { version: 3 } : { error: 'Restore rejected.' }
            };
            return { ok: true, status: 200, json: async () => [{ version: 1, createdAt: '2026-10-22' }] };
          };
        }
      });
      try {
        await wait(800);
        const { window } = dom, document = window.document;
        window.__CORE.state.meta.name = 'Unsaved rejected draft';
        await window.writeNow();
        document.querySelector('#mClose').click();
        await wait(200);
        await window[surface]();
        document.querySelector('[data-restore]').click();
        await wait();
        document.querySelector('#askYes').click();
        await wait(100);
        const unload = new window.Event('beforeunload', { cancelable: true });
        window.dispatchEvent(unload);
        assert.equal(unload.defaultPrevented, !success, 'failed restore must keep draft protection; successful restore owns the reload');
        if (success) {
          window.dispatchEvent(new window.Event('pagehide'));
          await wait();
          assert.equal(writes.length, 1, 'restored server revision must not be overwritten by the failed draft on pagehide');
        }
      } finally { dom.window.close(); }
    });
  }
}
