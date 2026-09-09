import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { PgStore, PgAuthStore } from '../src/store-pg.ts';
import { FileHostedPublicationStore } from '../src/publications.ts';

// Opt-in: point only at a disposable PostgreSQL database, never production.
const database = process.env.PAGECRAFT_TEST_DATABASE_URL;
test.skipIf(!database)('real HTTP/PostgreSQL/filesystem: publish, move, delete, restart', async () => {
  const pool = new Pool({ connectionString: database });
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-http-lifecycle-'));
  const store = new PgStore(pool), auth = new PgAuthStore(pool);
  let link = '', cookie = '';
  const start = async () => {
    const app = createApp({ store: new PgStore(pool), auth: new PgAuthStore(pool),
      publications: new FileHostedPublicationStore(root), editorHtml: '<title>QA</title>',
      editorHost: '127.0.0.1', sendLink: (_to, url) => { link = url; } });
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return { server, origin: `http://127.0.0.1:${address.port}` };
  };
  let listener: Awaited<ReturnType<typeof start>> | undefined;
  const stop = async () => {
    if (listener) await new Promise<void>((resolve, reject) => listener!.server.close(error => error ? reject(error) : resolve()));
    listener = undefined;
  };
  const request = (path: string, init: RequestInit = {}) => fetch(listener!.origin + path, {
    ...init, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...init.headers }
  });
  const json = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const domainStatus = (host: string) => new Promise<number>((resolve, reject) => {
    const req = httpRequest(listener!.origin + '/', { headers: { host } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode!));
    });
    req.on('error', reject); req.end();
  });
  try {
    await store.init(); await auth.init();
    Core.seed();
    const doc = structuredClone({ schemaVersion: Core.SCHEMA, meta: Core.state.meta, header: Core.state.header, footer: Core.state.footer, pages: Core.state.pages });
    const fixture = JSON.parse(JSON.stringify(doc).replace(/Manrope|DM Sans/g, 'Arial'));
    const unique = randomUUID().slice(0, 8);
    const site = await store.create({ name: `Lifecycle ${unique}`, host: `${unique}.test`, doc: fixture });
    const user = await auth.createUser(`${unique}@example.test`, 'Local QA');
    await auth.grant(site.id, user.id, 'owner');
    listener = await start();
    assert.equal((await request('/auth/login', json('POST', { email: user.email }))).status, 200);
    const callback = await request('/auth/callback?token=' + new URL(link).searchParams.get('token'));
    cookie = callback.headers.get('set-cookie')!.split(';')[0];
    const publish = await request(`/api/sites/${site.id}/publish`, json('POST', { sourceVersion: site.version, acknowledgeWarnings: true }));
    assert.equal(publish.status, 200, await publish.text());
    assert.equal((await request(`/${site.slug}/`)).status, 200);
    const slug = `moved-${unique}`;
    assert.equal((await request(`/api/sites/${site.id}/slug`, json('PUT', { slug }))).status, 200);
    assert.equal((await request(`/${site.slug}/`)).status, 404);
    assert.equal((await request(`/${slug}/`)).status, 200);
    assert.equal((await request(`/${slug}`)).headers.get('location'), `/${slug}/`);
    const movedHost = `moved-${unique}.test`;
    assert.equal((await request(`/api/sites/${site.id}/host`, json('PUT', { host: movedHost }))).status, 200);
    assert.equal(await domainStatus(site.host), 404);
    assert.equal(await domainStatus(movedHost), 200);
    await stop(); listener = await start();
    assert.equal((await request(`/${slug}/`)).status, 200, 'routing survives application restart');
    const republish = await request(`/api/sites/${site.id}/publish`, json('POST', { sourceVersion: site.version, acknowledgeWarnings: true }));
    assert.equal(republish.status, 200, await republish.text());
    assert.equal((await request(`/${site.slug}/`)).status, 404);
    const removed = await request(`/sites/${site.id}/settings/delete`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ confirmation: site.name }).toString()
    });
    assert.equal(removed.status, 303);
    assert.equal(await store.byId(site.id), null);
    await stop(); listener = await start();
    assert.equal((await request(`/${slug}/`)).status, 404);
    assert.equal(await domainStatus(movedHost), 404);
    console.log('Verified real HTTP publish → slug/domain move → restart → republish → delete → restart (PostgreSQL + disk).');
  } finally {
    await stop(); await pool.end(); await rm(root, { recursive: true, force: true });
  }
}, 30_000);
