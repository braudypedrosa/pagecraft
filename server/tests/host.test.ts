/* Domains, and the question a proxy asks before it certifies one.

   Two things here have consequences outside this process. A host is what a request is matched
   on and what a certificate is issued for, so a malformed one is a site nobody can reach. And
   `/internal/tls-check` is what stops this server being made to ask Let's Encrypt for a
   certificate on behalf of anybody who points a DNS record at it — which ends in a rate limit
   and a box that can no longer get certificates for its own clients. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore, validHost } from '../src/store.ts';
import { MemoryAuthStore, type Role } from '../src/auth.ts';
import type { Doc } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

const rig = async (role: Role = 'owner') => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_t, url) => { sent = url; }
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const user = await auth.createUser('me@acme.test');
  await auth.grant(site.id, user.id, role);

  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init,
      headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'me@acme.test' }) });
  const cb = await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];

  const setHost = (host: string, c = cookie) =>
    req(`/api/sites/${site.id}/host`, { method: 'PUT', body: JSON.stringify({ host }) }, c);
  const ask = (domain: string, headers: Record<string, string> = {}) =>
    app.request(new Request(`http://127.0.0.1:8787/internal/tls-check?domain=${encodeURIComponent(domain)}`,
      { headers: { host: '127.0.0.1:8787', ...headers } }));

  return { app, store, site, req, cookie, setHost, ask };
};

/* -------------------------------------------------------------- validation */

test('a host is a hostname, not a URL', () => {
  a.equal(validHost('acme.com'), 'acme.com');
  a.equal(validHost('  Acme.COM. '), 'acme.com', 'trimmed, lowercased, root dot dropped');
  a.equal(validHost('www.acme.co.uk'), 'www.acme.co.uk');
  a.equal(validHost('a-b.acme.com'), 'a-b.acme.com');

  for (const bad of [
    'https://acme.com', 'acme.com/', 'acme.com:8080', 'acme.com/page', 'ac me.com',
    'user@acme.com', 'acme.com#x', '', '   ', '.acme.com', 'acme..com', '-acme.com',
    'acme-.com', 'acme', '*.acme.com', '192.168.1.1', '[::1]'
  ]) {
    a.equal(validHost(bad), null, `${JSON.stringify(bad)} should not be a host`);
  }
});

test('a label and a name each have a length nobody should exceed', () => {
  a.equal(validHost('a'.repeat(63) + '.com'), 'a'.repeat(63) + '.com');
  a.equal(validHost('a'.repeat(64) + '.com'), null, 'a label caps at 63');
  const long = (`${'a'.repeat(60)}.`).repeat(5) + 'com';
  a.equal(long.length > 253, true, 'the fixture is long enough to be the point');
  a.equal(validHost(long), null);
});

test('a localhost name is allowed, because development happens', () => {
  a.equal(validHost('localhost'), 'localhost');
  a.equal(validHost('site.localhost'), 'site.localhost');
});

/* ------------------------------------------------------------ moving a site */

test('an owner moves a site to a domain, and it answers there', async () => {
  const { app, setHost } = await rig();
  const res = await setHost('acme.com');
  a.equal(res.status, 200);
  const body = await res.json() as { id: string; host: string };
  a.equal(body.host, 'acme.com');
  a.ok(body.id, 'and it says which site moved');

  const now = await app.request(new Request('http://acme.com/', { headers: { host: 'acme.com' } }));
  a.equal(now.status, 200, 'the new domain serves');
  const before = await app.request(new Request('http://acme.test/', { headers: { host: 'acme.test' } }));
  a.equal(before.status, 404, 'and the old one does not, which is what moving means');
});

test('a domain another site holds is refused rather than taken', async () => {
  const { store, setHost } = await rig();
  await store.create({ host: 'taken.com', name: 'Other', doc: demo() });
  const res = await setHost('taken.com');
  a.equal(res.status, 409);
  a.match((await res.json() as { error: string }).error, /already answers/);
});

test('a URL pasted into the field is explained rather than accepted', async () => {
  const { setHost } = await rig();
  const res = await setHost('https://acme.com/');
  a.equal(res.status, 400);
  const body = await res.json() as { error: string; detail: string };
  a.match(body.error, /not a domain/);
  a.match(body.detail, /No scheme, no port, no path/);
});

test('a content account cannot move the site', async () => {
  /* Moving a domain takes the site off the address people have. That is not content however
     little markup it changes. */
  const { setHost } = await rig('content');
  a.equal((await setHost('acme.com')).status, 403);
});

test('nobody signed in cannot move it either', async () => {
  const { setHost } = await rig();
  a.equal((await setHost('acme.com', '')).status, 401);
});

/* ------------------------------------------------------- the certificate ask */

test('the ask says yes only for a domain a site has claimed', async () => {
  const { ask, setHost } = await rig();

  const known = await ask('acme.test');
  a.equal(known.status, 200, 'a site answers here, so a certificate is warranted');

  const stranger = await ask('someone-elses-domain.com');
  a.equal(stranger.status, 404, 'nobody claimed it, so nothing is requested for it');

  /* and claiming it is what flips the answer */
  await setHost('acme.com');
  a.equal((await ask('acme.com')).status, 200);
  a.equal((await ask('acme.test')).status, 404, 'the site moved off it');
});

test('a malformed domain in the ask is refused before any lookup', async () => {
  const { ask } = await rig();
  a.equal((await ask('')).status, 400);
  a.equal((await ask('*.acme.com')).status, 400, 'a wildcard is not a name to certify');
  a.equal((await ask('https://acme.com')).status, 400);
});

test('the ask cannot be reached from outside the box', async () => {
  /* The proxy asks over loopback and sets no X-Forwarded-For on its own ask. A request that
     carries one came through the proxy from somewhere else, which this endpoint is not for.
     The Caddyfile refuses `/internal/*` at the edge as well — this is the other half. */
  const { ask } = await rig();
  a.equal((await ask('acme.test')).status, 200, 'from the proxy itself');
  a.equal((await ask('acme.test', { 'x-forwarded-for': '203.0.113.9' })).status, 403);
});

test('the ask is not a way to enumerate the sites on this server', async () => {
  /* It answers about one domain at a time and only about the one asked for, which is the least
     it can say and still do its job. There is nothing to list. */
  const { ask } = await rig();
  const res = await ask('acme.test');
  a.equal(await res.text(), 'ok', 'no id, no name, no document');
});
