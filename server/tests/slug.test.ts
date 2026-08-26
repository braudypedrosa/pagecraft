/* Sites shared by path.

   A host means DNS, a certificate, and a client who has to change a record before they can see
   anything. Worth it for a site that is somebody's front door; absurd for one you want to send a
   link to this afternoon. So every site also answers at `/<slug>/` on the editor's own host,
   which needs no DNS and rides the certificate the server already has.

   The risk is the shared namespace: a site called `api` would shadow this server's own routes.
   `validSlug` refuses them, and the last test here checks that list against Hono's own route
   table rather than against a list somebody remembered to update. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore, validSlug, slugFrom, RESERVED_PATHS } from '../src/store.ts';
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

const rig = async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    /* enough for `/edit/:id` to answer: without it the route 503s with "no editor build", which
       is correct and not what these tests are about */
    editorHtml: '<title>Builder</title>',
    sendLink: (_t, url) => { sent = url; }
  });
  const req = (path: string, init: RequestInit = {}, cookie?: string, host = 'admin.test') =>
    app.request(new Request(`http://${host}${path}`, {
      ...init, headers: { host, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  const signIn = async (email: string) => {
    /* `/auth/login` answers 200 to an address it has never heard of and sends nothing — that is
       deliberate, so the endpoint cannot enumerate users. Which means a test has to create the
       person first, the way OWNER_EMAIL does on boot. */
    await auth.createUser(email, 'Owner');
    await req('/auth/login', { method: 'POST', body: JSON.stringify({ email }) });
    const cb = await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
    return (cb.headers.get('set-cookie') || '').split(';')[0];
  };
  return { app, store, auth, req, signIn };
};

/* ------------------------------------------------------------- the slug itself */

test('a slug is a path segment, and narrow on purpose', () => {
  a.equal(validSlug('acme'), 'acme');
  a.equal(validSlug('  Acme-Rebrand  '), 'acme-rebrand', 'trimmed and lowercased');
  a.equal(validSlug('a'), 'a');
  a.equal(validSlug('a1-b2-c3'), 'a1-b2-c3');

  for (const bad of [
    '', '   ', '-acme', 'acme-', 'acme--co', 'ACME!', 'acme co', 'acme/co', 'acme.com',
    'a'.repeat(41), 'api', 'auth', 'internal', 'edit', 'robots.txt', 'favicon.ico'
  ]) {
    a.equal(validSlug(bad), null, `${JSON.stringify(bad)} should not be a slug`);
  }
});

test('a slug is derived from the name, and made unique', () => {
  a.equal(slugFrom('Acme Rebrand', []), 'acme-rebrand');
  a.equal(slugFrom('Acme Rebrand', ['acme-rebrand']), 'acme-rebrand-2');
  a.equal(slugFrom('Acme Rebrand', ['acme-rebrand', 'acme-rebrand-2']), 'acme-rebrand-3');
  a.equal(slugFrom('!!!', []), 'site', 'a name with nothing usable in it still gets a path');
  a.equal(slugFrom('API', []), 'api-2', 'and a reserved one is stepped over rather than taken');
});

/* --------------------------------------------------------------- serving by path */

test('a site is served under its path, with no domain of its own', async () => {
  const { store, req } = await rig();
  const site = await store.create({ host: 'unclaimed-1.invalid', name: 'Acme', doc: demo() });
  a.equal(site.slug, 'acme', 'a slug came for free');

  const home = await req('/acme/');
  a.equal(home.status, 200);
  a.match(await home.text(), /<h1/);

  const bare = await req('/acme?from=bare');
  a.equal(bare.status, 308, 'the directory-shaped root has one canonical URL');
  a.equal(bare.headers.get('location'), '/acme/?from=bare');
  const legacy = await req('/acme/pricing.html?from=old');
  a.equal(legacy.status, 308, 'a legacy filename redirects');
  a.equal(legacy.headers.get('location'), '/acme/pricing?from=old');
  a.equal((await req('/acme/pricing')).status, 200, 'extensionless, the way a static host would');
  const oldHome = await req('/acme/index.html');
  a.equal(oldHome.status, 308);
  a.equal(oldHome.headers.get('location'), '/acme/');
  a.equal((await req('/acme/nope.html')).status, 404, 'a missing filename does not earn a redirect');
  a.equal((await req('/acme/nope')).status, 404);
  a.equal((await req('/nobody/')).status, 404, 'a slug nobody has');
});

test('the editor keeps its own paths, whatever a site is called', async () => {
  /* The whole risk of putting sites in the same namespace. `validSlug` refuses these, so a
     request for one can never be read as a site. */
  const { req, signIn } = await rig();
  const cookie = await signIn('owner@admin.test');
  a.equal((await req('/auth/me', {}, cookie)).status, 200);
  a.equal((await req('/api/sites', {}, cookie)).status, 200);
  /* and the store refuses to create one that would shadow them */
  for (const slug of RESERVED_PATHS) a.equal(validSlug(slug), null, slug);
});

test('two sites, two paths, and the right pages under each', async () => {
  const { store, req } = await rig();
  await store.create({ host: 'a.invalid', slug: 'first', name: 'First', doc: demo() });

  /* tell them apart by content */
  const doc = demo();
  doc.pages[0].tree = [Core.N('section', {}, {}, [Core.N('row', {}, {}, [
    Core.N('column', {}, {}, [Core.N('heading', { text: 'I am the second site', level: 'h1' })])
  ])])];
  await store.create({ host: 'b.invalid', slug: 'second', name: 'Second', doc });

  a.match(await (await req('/first/')).text(), /Pagecraft|craft/i);
  a.match(await (await req('/second/')).text(), /I am the second site/);
  a.equal(/I am the second site/.test(await (await req('/first/')).text()), false);
});

test('a path is taken once, and refused after that', async () => {
  const { store } = await rig();
  await store.create({ host: 'a.invalid', slug: 'acme', name: 'A', doc: demo() });
  await a.rejects(
    () => store.create({ host: 'b.invalid', slug: 'acme', name: 'B', doc: demo() }),
    /already taken/);
  /* without asking for one, the second site simply gets the next free path */
  const auto = await store.create({ host: 'c.invalid', name: 'Acme', doc: demo() });
  a.equal(auto.slug, 'acme-2');
});

/* ------------------------------------------------------------------ through the API */

test('making a site needs no domain, and the server says where it is', async () => {
  const { req, signIn } = await rig();
  const cookie = await signIn('owner@admin.test');
  const res = await req('/api/sites', {
    method: 'POST', body: JSON.stringify({ name: 'Acme Rebrand', doc: demo() })
  }, cookie);
  a.equal(res.status, 201, 'no host in the body, and that is fine now');
  const made = await res.json() as { id: string; slug: string; url: string };
  a.equal(made.slug, 'acme-rebrand');
  a.equal(made.url, 'http://admin.test/acme-rebrand/', 'the link to send somebody');

  const live = await req('/acme-rebrand/');
  a.equal(live.status, 200, 'and it answers there immediately');
});

test('a site with a real domain reports that instead', async () => {
  const { store, auth, req, signIn } = await rig();
  const cookie = await signIn('owner@admin.test');
  const site = await store.create({ host: 'acme.com', name: 'Acme', doc: demo() });
  /* created straight in the store, so nobody owns it yet — and reading a site needs a
     membership, which is the point of that gate */
  const me = await auth.userByEmail('owner@admin.test');
  await auth.grant(site.id, me!.id, 'owner' as Role);
  const seen = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { url: string; slug: string };
  a.equal(seen.url, 'http://acme.com/', 'a domain is the better address once there is one');
  a.equal(seen.slug, 'acme', 'and the path still works, because links to it might exist');
  a.equal((await req('/acme/')).status, 200);
});

test('site creation validates a supplied host before storing anything', async () => {
  const { store, req, signIn } = await rig();
  const cookie = await signIn('owner@admin.test');
  const before = await store.listMeta();
  const res = await req('/api/sites', {
    method: 'POST', body: JSON.stringify({
      name: 'Bad host', host: 'https://bad.example/path', doc: demo()
    })
  }, cookie);
  a.equal(res.status, 400);
  a.deepEqual(await store.listMeta(), before, 'invalid input did not create an unreachable site');
});

test('moving a path is an admin’s call, and refuses one already taken', async () => {
  const { store, auth, req, signIn } = await rig();
  const site = await store.create({ host: 'a.invalid', slug: 'acme', name: 'Acme', doc: demo() });
  await store.create({ host: 'b.invalid', slug: 'taken', name: 'Other', doc: demo() });
  const user = await auth.createUser('owner@admin.test');
  await auth.grant(site.id, user.id, 'owner' as Role);
  const cookie = await signIn('owner@admin.test');

  const move = (slug: string) => req(`/api/sites/${site.id}/slug`, {
    method: 'PUT', body: JSON.stringify({ slug })
  }, cookie);

  a.equal((await move('taken')).status, 409, 'somebody else answers there');
  a.equal((await move('Not A Path')).status, 400);
  const ok = await move('acme-two');
  a.equal(ok.status, 200);
  a.equal((await ok.json() as { url: string }).url, 'http://admin.test/acme-two/');
  a.equal((await req('/acme-two/')).status, 200);
  a.equal((await req('/acme/')).status, 404, 'and the old path stops answering, which is what moving means');
});

test('a content account cannot move the path', async () => {
  const { store, auth, req, signIn } = await rig();
  const site = await store.create({ host: 'a.invalid', slug: 'acme', name: 'Acme', doc: demo() });
  const user = await auth.createUser('client@acme.test');
  await auth.grant(site.id, user.id, 'content' as Role);
  const cookie = await signIn('client@acme.test');
  const res = await req(`/api/sites/${site.id}/slug`, {
    method: 'PUT', body: JSON.stringify({ slug: 'somewhere-else' })
  }, cookie);
  a.equal(res.status, 403, 'the path is the URL people were given');
});

/* ------------------------------------------------- the list that must not drift */

test('every route the editor registers is a path a site cannot take', async () => {
  /* The guard that makes the shared namespace safe, checked against Hono's own route table
     rather than against a list somebody remembered to update. Add a route, forget this list,
     and a site called after it would shadow the route — silently, and only for whoever named
     their site that. */
  const { app } = await rig();
  const tops = new Set<string>();
  for (const r of app.routes) {
    const first = r.path.replace(/^\//, '').split('/')[0];
    if (!first || first === '*') continue;
    tops.add(first.replace(/^:/, ''));
  }
  a.equal(tops.size > 0, true, 'the route table is readable, or this test proves nothing');
  for (const top of tops) {
    a.equal(validSlug(top), null,
      `“${top}” is a route prefix, so it must be in RESERVED_PATHS — add it there`);
  }
});

/* ------------------------------------------------- the first five minutes

   What a fresh deployment does before anybody has a site. This used to be a dead end: the empty
   screen said "ask whoever set it up to grant you one" to the person who had just set it up, and
   nothing in a browser could create a site at all. */

test('a name is enough to make a site — no document, no domain', async () => {
  const { req, signIn } = await rig();
  const cookie = await signIn('owner@admin.test');

  const res = await req('/api/sites', {
    method: 'POST', body: JSON.stringify({ name: 'Acme Rebrand' })
  }, cookie);
  a.equal(res.status, 201, 'no doc in the body, which is the whole point');
  const made = await res.json() as { id: string; slug: string; url: string };
  a.equal(made.slug, 'acme-rebrand');
  a.equal(made.url, 'http://admin.test/acme-rebrand/');

  /* it serves immediately, and it is empty rather than somebody else's demo */
  const live = await req('/acme-rebrand/');
  a.equal(live.status, 200);
  const html = await live.text();
  a.equal(/Pagecraft — shape the web/.test(html), false, 'not the seeded demo');

  /* and the editor opens on it with the design system in place */
  const edit = await req(`/edit/${made.id}`, {}, cookie);
  a.equal(edit.status, 200);
  const cfg = JSON.parse(/window\.PC_SERVER=(\{.*?\});/.exec(await edit.text())![1]);
  a.equal(cfg.name, 'Acme Rebrand');
  a.equal(cfg.doc.pages.length, 1, 'one empty page to start on');
  a.equal(cfg.doc.pages[0].tree.length, 0);
  a.equal((cfg.doc.meta.tokens.colors || []).length > 0, true, 'with colours and text styles');
  a.equal((cfg.doc.meta.tokens.text || []).length > 0, true);
});

test('an unnamed site still gets a name and a path', async () => {
  const { req, signIn } = await rig();
  const cookie = await signIn('owner@admin.test');
  const res = await req('/api/sites', { method: 'POST', body: JSON.stringify({}) }, cookie);
  a.equal(res.status, 201);
  const made = await res.json() as { slug: string };
  a.equal(made.slug, 'untitled-site', 'derived from the fallback name, not left blank');
  a.equal((await req('/untitled-site/')).status, 200);
});

test('the picker says where a site is, not the placeholder host it has', async () => {
  /* A site with no domain carries `unclaimed-<uuid>.invalid`, which never resolves. Printing it
     under the site's name would be the picker lying about where the site is. */
  const { req, signIn } = await rig();
  const cookie = await signIn('owner@admin.test');
  await req('/api/sites', { method: 'POST', body: JSON.stringify({ name: 'One' }) }, cookie);
  await req('/api/sites', { method: 'POST', body: JSON.stringify({ name: 'Two' }) }, cookie);

  const html = await (await req('/', {}, cookie)).text();
  a.match(html, /\/one\//, 'the path it actually answers on');
  a.match(html, /\/two\//);
  a.equal(/unclaimed-/.test(html), false, 'and never the placeholder');
  a.match(html, /<form id="new"/, 'plus a way to add another');
});
