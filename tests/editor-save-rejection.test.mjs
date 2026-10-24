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
const waitUntil = async (condition, timeout = 3000) => {
  const until = Date.now() + timeout;
  while (!condition() && Date.now() < until) await wait(20);
};

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

test('editing a rejected Embed shows the new save reason and recompiles the corrected draft', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(marker,
    `<script>window.PC_WORDPRESS=${JSON.stringify(config)}</script>\n${marker}`);
  const requests = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.fetch = async (url, options = {}) => {
        if (String(url).endsWith('/document') && options.method === 'PUT') {
          requests.push(JSON.parse(options.body));
          if (requests.length === 1) return {
            ok: false, status: 400,
            json: async () => ({ error: 'The compiled Pagecraft page contains unsupported executable markup.' })
          };
          if (requests.length < 4) return {
            ok: false, status: 400,
            json: async () => ({ error: 'Pagecraft iframe embeds must use an absolute HTTPS URL.' })
          };
          return { ok: true, status: 200, json: async () => ({ version: 3 }) };
        }
        return { ok: true, status: 200, json: async () => [] };
      };
    }
  });
  try {
    await wait(800);
    const { window } = dom, document = window.document, core = window.__CORE;
    /* jsdom does not navigate iframe.srcdoc, so hosted boot can remain paused at the
       canvas load boundary even though Core and the inspector are available. Complete
       the same load event a browser supplies before exercising a document shortcut. */
    if (document.querySelector('#app').getAttribute('aria-busy') === 'true') {
      const frame = document.querySelector('#canvas');
      const initial = frame.srcdoc;
      frame.contentDocument.open();
      frame.contentDocument.write(initial);
      frame.contentDocument.close();
      frame.dispatchEvent(new window.Event('load'));
      const readyUntil = Date.now() + 1200;
      while (document.querySelector('#app').getAttribute('aria-busy') === 'true' && Date.now() < readyUntil) await wait(20);
    }
    assert.equal(document.querySelector('#app').getAttribute('aria-busy'), 'false', 'fixture reached the real shortcut-ready state');
    const embed = core.insert('embed', null, core.tree().length);
    embed.props.html = '<iframe title="Unsafe preview" srcdoc="<p>Unsafe</p>"></iframe>';
    window.select(embed.id);

    await window.writeNow();
    assert.match(document.querySelector('#mBody').textContent, /unsupported executable markup/i);
    document.querySelector('#mClose').click();
    await wait(100);

    let control = document.querySelector('#inspector-panel textarea');
    assert.ok(control, 'the selected Embed exposes its real HTML control');
    control.value = '<iframe title="Local image" src="http://pagecraft-wordpress-qa.local/table-1.png"></iframe>';
    control.dispatchEvent(new window.Event('input', { bubbles: true }));
    control.dispatchEvent(new window.FocusEvent('blur', { bubbles: true }));
    await waitUntil(() => requests.length >= 2 && document.querySelector('#modal').hidden === false);

    assert.equal(requests.length, 2);
    assert.match(requests[1].compiled.html, /src="http:\/\/pagecraft-wordpress-qa\.local\/table-1\.png"/);
    assert.doesNotMatch(requests[1].compiled.html, /srcdoc=/i, 'the new save recompiles public output instead of reusing canvas preview markup');
    assert.equal(document.querySelector('#modal').hidden, false, 'a changed rejected draft explains its current failure');
    assert.match(document.querySelector('#mBody').textContent, /absolute HTTPS URL/i);

    document.querySelector('#mClose').click();
    await wait(100);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    await wait(100);
    assert.equal(requests.length, 3, 'an explicit unchanged save still reaches the host');
    assert.equal(document.querySelector('#modal').hidden, true, 'the same unchanged rejection stays deduplicated');

    control = document.querySelector('#inspector-panel textarea');
    control.value = '<iframe title="Public image" src="https://example.com/table-1.png"></iframe>';
    control.dispatchEvent(new window.Event('input', { bubbles: true }));
    control.dispatchEvent(new window.FocusEvent('blur', { bubbles: true }));
    await waitUntil(() => requests.length >= 4 && /Draft saved/.test(document.querySelector('#savedTag').textContent));
    assert.equal(requests.length, 4);
    assert.match(requests[3].compiled.html, /src="https:\/\/example\.com\/table-1\.png"/);
    assert.match(document.querySelector('#savedTag').textContent, /Draft saved/);
    assert.equal(window.PC_WORDPRESS.version, 3);
  } finally { dom.window.close(); }
});

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
