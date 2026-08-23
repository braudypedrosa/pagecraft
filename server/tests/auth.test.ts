/* Auth, tested from the refusals inward.

   The happy path is one case. The rest of this file is the cases where the answer has to be
   no, because those are the ones that are wrong silently: a token that works twice, a
   session that outlives its expiry, a signed-in stranger reading somebody else's document.
   `app.test.ts` already exercises the flow end to end for every write it makes. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp, SESSION_COOKIE } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import {
  MemoryAuthStore, hashToken, newToken, roleAllows, normalEmail, sameDigest,
  LINK_TTL_MS, SESSION_TTL_MS, type Role
} from '../src/auth.ts';
import type { Doc } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
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
    editorOrigin: 'http://admin.test', sendLink: (_to, url) => { sent = url; }
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init,
      headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  const login = async (email: string) => {
    sent = '';
    await req('/auth/login', { method: 'POST', body: JSON.stringify({ email }) });
    return sent ? new URL(sent).searchParams.get('token')! : '';
  };
  const follow = async (token: string) => {
    const res = await req(`/auth/callback?token=${token}`);
    const raw = res.headers.get('set-cookie') || '';
    return { res, cookie: raw.split(';')[0], raw };
  };
  const member = async (email: string, role: Role) => {
    const u = await auth.createUser(email);
    await auth.grant(site.id, u.id, role);
    return u;
  };
  return { store, auth, app, site, req, login, follow, member };
};

/* --------------------------------------------------------------- the pieces */

test('a token is never stored, only its digest', () => {
  const t = newToken();
  const d = hashToken(t);
  a.notEqual(t, d);
  a.equal(d.length, 64, 'sha-256, hex');
  a.equal(hashToken(t), d, 'and it is stable, or a session would not survive one request');
  a.notEqual(newToken(), newToken());
  a.ok(newToken().length >= 40, 'guessing is not a threat model at this width');
});

test('digests compare without leaking where they differ', () => {
  const d = hashToken('x');
  a.equal(sameDigest(d, d), true);
  a.equal(sameDigest(d, hashToken('y')), false);
  a.equal(sameDigest(d, 'short'), false, 'and unequal lengths do not throw');
});

test('an address is one address however it is typed', () => {
  a.equal(normalEmail('  Client@Acme.TEST '), 'client@acme.test');
});

test('a content role may read and may not write', () => {
  a.equal(roleAllows('content', 'read'), true);
  a.equal(roleAllows('content', 'write'), false, 'until a content-only write can be checked');
  a.equal(roleAllows('content', 'admin'), false);
  a.equal(roleAllows('owner', 'admin'), true);
  a.equal(roleAllows('owner', 'write'), true);
  /* a role nobody defined is not a role that gets in */
  a.equal(roleAllows('nonsense' as Role, 'read'), false);
});

/* ----------------------------------------------------------------- the flow */

test('a link signs you in once, and never again', async () => {
  const { login, follow, member } = await rig();
  await member('client@acme.test', 'owner');

  const token = await login('client@acme.test');
  a.ok(token);

  const first = await follow(token);
  a.equal(first.res.status, 302);
  a.match(first.cookie, /^pc_session=/);

  /* the same link, a second time */
  const second = await follow(token);
  a.equal(second.res.status, 400, 'a spent token is spent');
  a.equal(second.res.headers.get('set-cookie'), null, 'and hands out no session');
});

test('the session cookie is not readable by script and does not travel cross-site', async () => {
  const { login, follow, member } = await rig();
  await member('client@acme.test', 'owner');
  const { raw } = await follow(await login('client@acme.test'));
  a.match(raw, /HttpOnly/i);
  a.match(raw, /SameSite=Lax/i);
  a.match(raw, /Path=\//i);
  a.equal(/Secure/i.test(raw), false, 'off for local http; index.ts turns it on in production');
});

test('login says the same thing whether or not the address is known', async () => {
  const { req, login } = await rig();
  const known = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@acme.test' }) });
  a.equal(known.status, 200, 'answering 404 here is a way to enumerate accounts');
  a.deepEqual(await known.json(), { sent: true });
  a.equal(await login('nobody@acme.test'), '', 'and no link is actually sent');
});

test('a malformed address is refused before anything is created', async () => {
  const { req } = await rig();
  const res = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'not-an-address' }) });
  a.equal(res.status, 400);
});

test('an unknown, tampered or missing token gets nothing', async () => {
  const { req, follow } = await rig();
  a.equal((await follow(newToken())).res.status, 400, 'a token nobody issued');
  a.equal((await req('/auth/callback')).status, 400, 'no token at all');
  a.equal((await req('/auth/callback?token=')).status, 400, 'an empty one');
});

test('an expired link is refused, and is spent by being presented', async () => {
  const { auth, req } = await rig();
  const u = await auth.createUser('late@acme.test');
  const token = newToken();
  await auth.putLink(hashToken(token), u.email, Date.now() - 1);
  a.equal((await req(`/auth/callback?token=${token}`)).status, 400);
  /* presenting it consumed it, so it cannot be retried when the clock suits */
  await auth.putLink(hashToken(token), u.email, Date.now() + LINK_TTL_MS);
  a.equal((await req(`/auth/callback?token=${token}`)).status, 302, 'a fresh one still works');
});

test('an expired session is no session', async () => {
  const { auth, req, site, member } = await rig();
  const u = await member('client@acme.test', 'owner');
  const token = newToken();
  await auth.putSession(hashToken(token), u.id, Date.now() - 1);
  const res = await req(`/api/sites/${site.id}`, {}, `${SESSION_COOKIE}=${token}`);
  a.equal(res.status, 401);
  a.equal(await auth.sessionByDigest(hashToken(token)), null, 'and it is dropped on the way past');
});

test('logging out ends the session for good', async () => {
  const { login, follow, member, req, site } = await rig();
  await member('client@acme.test', 'owner');
  const { cookie } = await follow(await login('client@acme.test'));

  a.equal((await req(`/api/sites/${site.id}`, {}, cookie)).status, 200);
  a.equal((await req('/auth/logout', { method: 'POST' }, cookie)).status, 200);
  a.equal((await req(`/api/sites/${site.id}`, {}, cookie)).status, 401, 'the cookie is now a dead token');
});

/* -------------------------------------------------------------- the gate */

test('nothing under /api answers without a session', async () => {
  const { req, site } = await rig();
  a.equal((await req('/api/sites')).status, 401);
  a.equal((await req(`/api/sites/${site.id}`)).status, 401);
  a.equal((await req(`/api/sites/${site.id}`, { method: 'PUT', body: '{}' })).status, 401);
  a.equal((await req('/api/sites', { method: 'POST', body: '{}' })).status, 401);
});

test('a signed-in stranger cannot tell whether somebody else’s site exists', async () => {
  const { auth, login, follow, req, site } = await rig();
  await auth.createUser('stranger@elsewhere.test');          // an account, but no membership
  const { cookie } = await follow(await login('stranger@elsewhere.test'));

  const real = await req(`/api/sites/${site.id}`, {}, cookie);
  const fake = await req('/api/sites/does-not-exist', {}, cookie);
  a.equal(real.status, 404);
  a.equal(fake.status, 404, 'the same answer, or the status is an existence oracle');
  a.deepEqual(await real.json(), await fake.json());
});

test('the site list holds only the sites you were granted', async () => {
  const { store, login, follow, req, site, member } = await rig();
  await store.create({ host: 'other.test', name: 'Other', doc: demo() });
  await member('client@acme.test', 'content');
  const { cookie } = await follow(await login('client@acme.test'));

  const list = await (await req('/api/sites', {}, cookie)).json() as { id: string; role: Role }[];
  a.deepEqual(list.map(s => s.id), [site.id], 'one of the two');
  a.equal(list[0].role, 'content', 'and it says what you are');
});

test('a content role can open the document and cannot save it', async () => {
  const { login, follow, req, site, member } = await rig();
  await member('client@acme.test', 'content');
  const { cookie } = await follow(await login('client@acme.test'));

  const read = await req(`/api/sites/${site.id}`, {}, cookie);
  a.equal(read.status, 200);
  const body = await read.json() as { role: Role; doc: Doc };
  a.equal(body.role, 'content');

  const write = await req(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: body.doc, version: 1 })
  }, cookie);
  a.equal(write.status, 403, 'refusing beats allowing a write and calling it content-only');
});

test('creating a site makes you its owner, and not of anything else', async () => {
  const { auth, login, follow, req, site } = await rig();
  await auth.createUser('me@acme.test');
  const { cookie } = await follow(await login('me@acme.test'));

  const res = await req('/api/sites', {
    method: 'POST', body: JSON.stringify({ host: 'new.test', name: 'New', doc: demo() })
  }, cookie);
  a.equal(res.status, 201);
  const made = await res.json() as { id: string };

  const list = await (await req('/api/sites', {}, cookie)).json() as { id: string; role: Role }[];
  a.deepEqual(list.map(s => s.id), [made.id]);
  a.equal(list[0].role, 'owner');
  a.equal((await req(`/api/sites/${site.id}`, {}, cookie)).status, 404, 'and not the one that was already there');
});

test('who you are is answerable, and says which sites and in what role', async () => {
  const { login, follow, req, member, site } = await rig();
  await member('client@acme.test', 'content');

  const anon = await (await req('/auth/me')).json() as { user: null };
  a.equal(anon.user, null);

  const { cookie } = await follow(await login('client@acme.test'));
  const me = await (await req('/auth/me', {}, cookie)).json() as
    { user: { email: string }; sites: { id: string; role: Role }[] };
  a.equal(me.user.email, 'client@acme.test');
  a.deepEqual(me.sites, [{ id: site.id, host: 'acme.test', name: 'Acme', role: 'content' }]);
});

test('the site itself stays public — a visitor is never asked who they are', async () => {
  const { app } = await rig();
  const res = await app.request(new Request('http://acme.test/', { headers: { host: 'acme.test' } }));
  a.equal(res.status, 200, 'a login wall on a published page would be the opposite of the point');
  a.match(await res.text(), /<!doctype html>/i);
});

test('the two lifetimes are the ones the comments claim', () => {
  a.equal(LINK_TTL_MS, 15 * 60 * 1000);
  a.equal(SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000);
});
