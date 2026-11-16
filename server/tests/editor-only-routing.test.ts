/* Auth and administration exist on the editor host only (`editorOnly` in app.ts).

   Hono 4.13.16 / @hono/node-server 2.1.3 fixed router and path-decoding bugs where an encoded
   line terminator, a backslash or a second decode could make a path skip wildcard middleware
   such as `app.use('/api/*', editorOnly)`. These cases pin the behaviour after the upgrade:
   a request on a published site's Host never reaches an account or API handler, whatever
   spelling the path arrives in — both through `app.request` and through a real socket, where
   the raw request line is not normalised by the WHATWG URL parser first. */
import { test, afterAll } from 'vitest';
import a from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import type { Doc } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

const rig = async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHtml: '<title>Builder</title>', editorHost: 'admin.test',
    editorOrigin: 'http://admin.test', sendLink: (_t, url) => { sent = url; }
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const user = await auth.createUser('me@acme.test');
  await auth.grant(site.id, user.id, 'owner');
  const editor = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init,
      headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  await editor('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'me@acme.test' }) });
  const cb = await editor(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];
  return { app, site, editor, cookie };
};

/* A response that came from an account/API handler: JSON, or the site list, or a session. */
const reachedHandler = async (res: Response, siteId: string) => {
  const body = await res.text();
  return res.headers.get('set-cookie')?.includes('pc_') ||
    (res.status < 400 && (res.headers.get('content-type') || '').includes('application/json')) ||
    body.includes(siteId) || /"sites"\s*:/.test(body);
};

const variants = (id: string) => [
  `/api/sites`,
  `/api/sites/${id}`,
  `/api/sites/${id}/doc`,
  `/auth/login`,
  `/auth/callback?token=x`,
  `/account`,
  `/owner`,
  `/api%0a/sites`,
  `/api/%0a/sites`,
  `/api%0A/sites/${id}`,
  `/api%0d/sites`,
  `/api/sites%0a`,
  `/%61pi/sites`,
  `/api%2fsites`,
  `/api%252fsites`,
  `/auth%0a/login`,
  `/./api/sites`,
  `//api/sites`,
  `/x/../api/sites`,
  `/api/sites/./${id}`,
];

test('the editor host itself still serves the API to its signed-in user (control)', async () => {
  const { editor, cookie, site } = await rig();
  const res = await editor('/api/sites', {}, cookie);
  a.equal(res.status, 200);
  a.ok((await res.text()).includes(site.id));
});

test('editor-only middleware blocks /api, /auth and account paths on a site Host, in every spelling', async () => {
  const { app, site, cookie } = await rig();
  for (const path of variants(site.id)) {
    for (const method of ['GET', 'POST']) {
      const res = await app.request(new Request(`http://acme.test${path}`, {
        method,
        headers: { host: 'acme.test', cookie, 'content-type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ email: 'me@acme.test' }) : undefined,
      }));
      a.equal(await reachedHandler(res, site.id), false, `${method} ${path} on a site Host reached a handler (${res.status})`);
      a.ok(res.status === 404 || res.status === 405 || res.status === 400 || res.status === 403,
        `${method} ${path} on a site Host answered ${res.status}`);
    }
  }
});

/* Through a real HTTP server the raw request line reaches the adapter unparsed, which is where
   the backslash and double-decode advisories applied. */
const servers: Array<{ close: () => void }> = [];
afterAll(() => servers.forEach(s => s.close()));

const raw = (port: number, path: string, host: string, cookie: string, method = 'GET') =>
  new Promise<{ status: number; type: string; body: string; setCookie: string }>((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method, headers: { host, cookie, 'content-type': 'application/json' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        type: String(res.headers['content-type'] || ''),
        body,
        setCookie: String(res.headers['set-cookie'] || ''),
      }));
    });
    req.on('error', reject);
    if (method === 'POST') req.write(JSON.stringify({ email: 'me@acme.test' }));
    req.end();
  });

test('over a real socket, backslash and encoded variants never reach editor-only handlers on a site Host', async () => {
  const { app, site, cookie } = await rig();
  const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve(s));
  });
  servers.push(server);
  const port = (server.address() as AddressInfo).port;

  const control = await raw(port, '/api/sites', 'admin.test', cookie);
  a.equal(control.status, 200, 'the same socket serves the editor host');
  a.ok(control.body.includes(site.id));

  const socketVariants = [
    ...variants(site.id),
    `/api\\sites`,
    `\\api\\sites`,
    `/api\\sites\\${site.id}`,
    `/auth\\login`,
    `/api%5csites`,
    `/api%5Csites/${site.id}`,
    `/brand%5c..%5capi/sites`,
  ];
  for (const path of socketVariants) {
    for (const method of ['GET', 'POST']) {
      const res = await raw(port, path, 'acme.test', cookie, method);
      const leaked = res.setCookie.includes('pc_') ||
        (res.status < 400 && res.type.includes('application/json')) ||
        res.body.includes(site.id) || /"sites"\s*:/.test(res.body);
      a.equal(leaked, false, `${method} ${JSON.stringify(path)} on a site Host reached a handler (${res.status})`);
      a.ok(res.status >= 400, `${method} ${JSON.stringify(path)} on a site Host answered ${res.status}`);
    }
  }
});
