import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { MemoryAuthStore, hashToken } from '../src/auth.ts';
import { MemoryStore } from '../src/store.ts';
import { blankDoc } from '../src/render.ts';

async function fixture() {
  const auth = new MemoryAuthStore(), store = new MemoryStore();
  const user = await auth.createUser('private-owner@example.invalid', 'Private owner');
  const token = 'private-session-token';
  await auth.putSession(hashToken(token), user.id, Date.now() + 60000);
  const site = await store.create({ name: 'Private document', host: 'private-host.invalid', doc: blankDoc('Private document') });
  await auth.grant(site.id, user.id, 'owner');
  const app = createApp({ auth, store, editorHtml: '<html><head></head><body>Editor</body></html>', editorHost: 'admin.test' });
  const get = (cookie = true) => app.request(`http://admin.test/edit/${site.id}`, {
    headers: { host: 'admin.test', ...(cookie ? { cookie: `pc_session=${token}` } : {}) },
  });
  return { auth, user, site, token, get };
}

const names = (header: string) => [...header.matchAll(/(?:^|, )([\w.]+)_\d+;dur=([\d.]+);desc="start ([\d.]+)ms"/g)];

test('editor exposes fixed phases and independent per-request correlation without private metadata', async () => {
  const f = await fixture();
  const responses = await Promise.all([f.get(), f.get()]);
  assert.notEqual(responses[0].headers.get('x-request-id'), responses[1].headers.get('x-request-id'));
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const header = response.headers.get('server-timing') || '';
    assert.deepEqual(names(header).map(match => match[1]).sort(), [
      'editor.access', 'editor.document', 'editor.schedules', 'editor.shell', 'editor.storage', 'editor.wordpress',
    ]);
    assert.match(header, /server;dur=[\d.]+/);
    for (const match of names(header)) {
      assert.ok(Number(match[2]) >= 0 && Number(match[3]) >= 0);
    }
    for (const secret of [f.site.id, f.user.id, f.user.email, f.token, f.site.name, f.site.host]) {
      assert.equal(header.includes(secret), false, secret);
    }
  }
});

test('denied editor requests report only completed gate/document work and never a successful shell', async () => {
  const f = await fixture();
  const signedOut = await f.get(false);
  assert.doesNotMatch(await signedOut.text(), /window.PC_SERVER=/);
  assert.deepEqual(names(signedOut.headers.get('server-timing') || '').map(match => match[1]).sort(), [
    'editor.access', 'editor.document',
  ]);
  await f.auth.revoke(f.site.id, f.user.id);
  const revoked = await f.get();
  assert.equal(revoked.status, 404); // Membership denial does not reveal site existence.
  assert.doesNotMatch(revoked.headers.get('server-timing') || '', /editor\.(shell|storage|wordpress|schedules)/);
  assert.doesNotMatch(await revoked.text(), /window.PC_SERVER=/);
});
