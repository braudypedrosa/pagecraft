import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.ts';
import { MemoryAuthStore, hashToken } from '../src/auth.ts';
import { MemoryStore } from '../src/store.ts';
import { blankDoc } from '../src/render.ts';

const editorHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

async function fixture() {
  const auth = new MemoryAuthStore();
  const store = new MemoryStore();
  const user = await auth.createUser('load-fixture@example.invalid', 'Load fixture');
  const token = 'load-fixture-session';
  await auth.putSession(hashToken(token), user.id, Date.now() + 60000);
  const site = await store.create({ name: 'Private fixture </script> marker',
    host: 'fixture.example.invalid', doc: blankDoc('Private fixture </script> marker') });
  await auth.grant(site.id, user.id, 'owner');
  const app = createApp({ store, auth, editorHtml, editorHost: 'admin.test' });
  const request = (path: string, cookie = '', host = 'admin.test') =>
    app.request(`http://${host}${path}`, { headers: { host, ...(cookie ? { cookie } : {}) } });
  return { app, site, request, cookie: `pc_session=${token}` };
}

test('hosted editor keeps private configuration in a small uncached document before its shared script', async () => {
  const { site, request, cookie } = await fixture();
  const response = await request(`/edit/${site.id}`, cookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const html = await response.text();
  assert.ok(Buffer.byteLength(html) < 50000, 'shared builder bytes must leave the per-site response');
  const from = html.indexOf('window.PC_SERVER=') + 'window.PC_SERVER='.length;
  const to = html.indexOf('</script>', from);
  const config = JSON.parse(html.slice(from, to).replace(/;\s*$/, ''));
  assert.equal(config.siteId, site.id);
  assert.equal(config.name, site.name);
  assert.deepEqual(config.doc, site.doc);
  assert.match(html.slice(from, to), /\\u003c/);
  assert.ok(from < html.indexOf('src="/brand/builder-assets/'), 'config must exist before builder execution');
  assert.match(html, /<style id="pc-fonts">[\s\S]*?\/brand\/builder-assets\/[a-f0-9]{64}\.ttf/);
  assert.equal(html.includes('data:font/ttf;base64,'), false);

  const paths = [...new Set([...html.matchAll(/\/brand\/builder-assets\/[a-f0-9]{64}\.(?:css|js|ttf)/g)].map(m => m[0]))];
  assert.ok(paths.some(path => path.endsWith('.js')));
  assert.ok(paths.some(path => path.endsWith('.css')));
  assert.ok(paths.some(path => path.endsWith('.ttf')));
  for (const path of paths) {
    const asset = await request(path);
    assert.equal(asset.status, 200, path);
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(asset.headers.get('set-cookie'), null);
    if (!path.endsWith('.ttf')) {
      const body = await asset.text();
      assert.equal(body.includes('load-fixture@example.invalid'), false);
      assert.equal(body.includes('Private fixture'), false);
      assert.equal(body.includes(JSON.stringify(config)), false);
    } else {
      assert.equal(asset.headers.get('content-type'), 'font/ttf');
      assert.ok((await asset.arrayBuffer()).byteLength > 1000);
    }
  }
});

test('only known static builder assets are public on the editor host; site authorization stays fresh', async () => {
  const { site, request, cookie } = await fixture();
  const signedOut = await request(`/edit/${site.id}`);
  assert.equal((await signedOut.text()).includes('window.PC_SERVER='), false);
  const html = await (await request(`/edit/${site.id}`, cookie)).text();
  const path = html.match(/\/brand\/builder-assets\/[a-f0-9]{64}\.js/)![0];
  assert.equal((await request(path, '', 'fixture.example.invalid')).status, 404);
  assert.equal((await request('/brand/builder-assets/' + '0'.repeat(64) + '.js')).status, 404);
  assert.equal((await request('/brand/builder-assets/unknown.css')).status, 404);
  assert.equal((await request('/brand/builder-assets/index.html')).status, 404);
  assert.ok(editorHtml.includes('data:font/ttf;base64,'), 'portable editor retains its embedded fonts');
  assert.equal(editorHtml.includes('/brand/builder-assets/'), false, 'portable editor stays self-contained');
});
