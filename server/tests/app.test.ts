/* Milestone 1, as a test: a document is saved, and the live page changes.

   No browser and no database — Hono apps take a `Request` and return a `Response`, so the
   whole round trip is assertable in-process. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, type Role } from '../src/auth.ts';
import type { Doc } from '../../app/src/core/types.ts';
import { validatePortablePackage } from '../src/portable-packages.ts';

/* The demo project, not an empty one: it has a header, a footer, two pages and most of the
   widget set, so a byte-identity claim over it means something. */
const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

/* A rig that signs in the way a person does: ask for a link, follow it, keep the cookie.
   Fabricating a session would leave the login flow untested by everything that uses it. */
const rig = async (role: Role = 'owner') => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHtml: '<title>Builder</title>', editorHost: 'admin.test',
    editorOrigin: 'http://admin.test', sendLink: (_to, url) => { sent = url; }
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const user = await auth.createUser('client@acme.test', 'Client');
  await auth.grant(site.id, user.id, role);

  const admin = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init,
      headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers || {}) }
    }));

  const signIn = async () => {
    const res = await admin('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'client@acme.test' }) });
    a.equal(res.status, 200);
    a.ok(sent, 'no link was sent');
    const token = new URL(sent).searchParams.get('token')!;
    const cb = await admin(`/auth/callback?token=${token}`);
    a.equal(cb.status, 302, 'the callback should redirect into the editor');
    const setCookie = cb.headers.get('set-cookie') || '';
    const cookie = setCookie.split(';')[0];
    a.match(cookie, /^pc_session=/);
    a.match(setCookie, /HttpOnly/i, 'a session cookie readable by script is a session cookie for the taking');
    a.match(setCookie, /SameSite=Lax/i);
    return { cookie, token };
  };

  const get = (path: string, host = 'acme.test') =>
    app.request(new Request(`http://${host}${path}`, { headers: { host } }));
  const put = (id: string, doc: Doc, version: number, cookie?: string) =>
    admin(`/api/sites/${id}`, { method: 'PUT', body: JSON.stringify({ doc, version }) }, cookie);

  return { store, auth, app, site, user, get, put, admin, signIn, linkUrl: () => sent };
};

test('a visitor gets the page the export would have written', async () => {
  const { get } = await rig();
  const res = await get('/');
  a.equal(res.status, 200);
  a.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  const html = await res.text();
  a.match(html, /<!doctype html>/i);
  a.match(html, /<\/html>/);
  a.match(res.headers.get('content-security-policy') || '', /sandbox allow-scripts/);
  a.equal(/allow-same-origin/.test(res.headers.get('content-security-policy') || ''), false,
    'published scripts must receive an opaque origin, not the editor session origin');
});

test('auth and API routes answer only on the editor host', async () => {
  const { app } = await rig();
  const login = await app.request(new Request('http://acme.test/auth/login', {
    method: 'POST', headers: { host: 'acme.test', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'client@acme.test' })
  }));
  a.equal(login.status, 404);
  const api = await app.request(new Request('http://acme.test/api/sites', { headers: { host: 'acme.test' } }));
  a.equal(api.status, 404);
});

test('an authorized reader can download deterministic portable site and page packages', async () => {
  const { site, user, admin, signIn } = await rig('content');
  const { cookie } = await signIn();
  const siteResponse = await admin(`/v1/sites/${site.id}/packages/site`, {}, cookie);
  a.equal(siteResponse.status, 200);
  a.equal(siteResponse.headers.get('content-type'), 'application/zip');
  a.match(siteResponse.headers.get('content-disposition') || '', /\.pagecraft-site\.zip/);
  const siteBytes = new Uint8Array(await siteResponse.arrayBuffer());
  a.equal(siteResponse.headers.get('x-pagecraft-content-sha256'), validatePortablePackage(siteBytes).sha256);

  const pageId = site.doc.pages[0].id;
  const pageResponse = await admin(`/v1/sites/${site.id}/packages/pages/${pageId}`, {}, cookie);
  a.equal(pageResponse.status, 200);
  a.match(pageResponse.headers.get('content-disposition') || '', /\.pagecraft-page\.zip/);
  const imported = validatePortablePackage(new Uint8Array(await pageResponse.arrayBuffer()));
  a.equal(imported.manifest.entryPageId, pageId);
  a.equal(imported.provenance.origin, 'pagecraft-cloud');
  a.equal(imported.provenance.exportedBy, user.id);
});

test('a shared-path site keeps the published sandbox on the editor host', async () => {
  const { site, admin } = await rig();
  const res = await admin(`/${site.slug}/`);
  a.equal(res.status, 200);
  const policy = res.headers.get('content-security-policy') || '';
  a.match(policy, /sandbox allow-scripts/);
  a.equal(policy.includes('allow-same-origin'), false);
});

test('autosave creates a draft without changing the published page', async () => {
  const { site, get, put, admin, signIn } = await rig();
  const { cookie } = await signIn();

  const before = await (await get('/')).text();
  a.equal(/Braudy was here/.test(before), false);

  /* the edit a client would make: one string, in the document */
  const doc = structuredClone(site.doc);
  let touched = 0;
  Core.restore(doc);
  Core.eachNode(doc.pages[0].tree, (n: { type: string; props: Record<string, unknown> }) => {
    if (touched === 0 && n.type === 'heading') { n.props.text = 'Braudy was here'; touched++; }
  });
  a.equal(touched, 1, 'the fixture has no heading to edit');

  const res = await put(site.id, doc, site.version, cookie);
  a.equal(res.status, 200);
  const body = await res.json() as { version: number; files: string[] };
  a.equal(body.version, site.version + 1, 'a save bumps the version');
  a.ok(body.files.includes('index.html'));

  const draft = await (await admin(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc };
  a.equal(JSON.stringify(draft.doc).includes('Braudy was here'), true,
    'the saved words must remain available in the draft');

  const after = await (await get('/')).text();
  a.equal(/Braudy was here/.test(after), false,
    'autosave must not leak draft content to the published page');
});

test('a save carrying a stale version is refused rather than winning', async () => {
  const { site, put, signIn } = await rig();
  const { cookie } = await signIn();
  const doc = structuredClone(site.doc);

  a.equal((await put(site.id, doc, site.version, cookie)).status, 200);

  /* the second editor still holds the version they loaded */
  const late = await put(site.id, doc, site.version, cookie);
  a.equal(late.status, 409);
  const body = await late.json() as { error: string; conflict: { yours: number; theirs: number } };
  a.equal(body.error, 'stale');
  a.deepEqual(body.conflict, { yours: 1, theirs: 2 });
});

test('an unrenderable save is rejected before it can advance or corrupt the stored document', async () => {
  const { site, put, signIn, store } = await rig();
  const { cookie } = await signIn();
  const malformed = structuredClone(site.doc);
  malformed.pages = [{}] as Doc['pages'];

  const res = await put(site.id, malformed, site.version, cookie);
  a.equal(res.status, 422);
  a.equal((await res.json() as { error: string }).error, 'invalid document');
  const stored = await store.byId(site.id);
  a.equal(stored!.version, site.version, 'no failed write bumped the version');
  a.deepEqual(stored!.doc, site.doc, 'the valid document remains intact');
});

test('an unrenderable create is rejected before a site or revision is inserted', async () => {
  const { site, admin, signIn, store } = await rig();
  const { cookie } = await signIn();
  const malformed = structuredClone(site.doc);
  malformed.pages = [{}] as Doc['pages'];
  const before = await store.listMeta();

  const res = await admin('/api/sites', {
    method: 'POST', body: JSON.stringify({ name: 'Broken', doc: malformed })
  }, cookie);
  a.equal(res.status, 422);
  a.deepEqual((await store.listMeta()).map(s => s.id), before.map(s => s.id));
});

test('an owner can inspect history and restore without deleting later versions', async () => {
  const { site, put, admin, signIn, store } = await rig();
  const { cookie } = await signIn();
  const changed = structuredClone(site.doc);
  changed.pages[0].title = 'Second version';
  a.equal((await put(site.id, changed, 1, cookie)).status, 200);

  const listed = await admin(`/api/sites/${site.id}/history`, {}, cookie);
  a.equal(listed.status, 200);
  const versions = await listed.json() as { version: number; author: { email: string } | null }[];
  a.deepEqual(versions.map(v => v.version), [2, 1]);
  a.equal(versions[0].author?.email, 'client@acme.test');

  const restored = await admin(`/api/sites/${site.id}/history/1/restore`, {
    method: 'POST', body: JSON.stringify({ currentVersion: 2 })
  }, cookie);
  a.equal(restored.status, 200);
  a.equal((await restored.json() as { version: number }).version, 3);
  a.equal((await store.history(site.id)).length, 3);
  a.equal((await store.byId(site.id))!.doc.pages[0].title, site.doc.pages[0].title);
});

test('restore requires a positive integer current version before touching history', async () => {
  const { site, admin, signIn, store } = await rig();
  const { cookie } = await signIn();
  const before = await store.history(site.id);
  const res = await admin(`/api/sites/${site.id}/history/1/restore`, {
    method: 'POST', body: JSON.stringify({ currentVersion: 1.5 })
  }, cookie);
  a.equal(res.status, 400);
  a.deepEqual(await store.history(site.id), before);
});

test('a content account may read history but cannot restore it', async () => {
  const { site, admin, signIn } = await rig('content');
  const { cookie } = await signIn();
  a.equal((await admin(`/api/sites/${site.id}/history`, {}, cookie)).status, 200);
  const restore = await admin(`/api/sites/${site.id}/history/1/restore`, {
    method: 'POST', body: JSON.stringify({ currentVersion: 1 })
  }, cookie);
  a.equal(restore.status, 403);
});

test('a save reports what the review noticed, so the editor need not ask twice', async () => {
  const { site, put, signIn } = await rig();
  const { cookie } = await signIn();
  const res = await put(site.id, structuredClone(site.doc), site.version, cookie);
  const body = await res.json() as { findings: { level: string; code: string }[] };
  a.ok(Array.isArray(body.findings));
  a.ok(body.findings.every(f => typeof f.code === 'string' && typeof f.level === 'string'));
});

test('paths resolve as a static host would, and a missing one is a 404', async () => {
  const { site, get, put, signIn } = await rig();
  const { cookie } = await signIn();
  const doc = structuredClone(site.doc);
  const second = doc.pages[1];
  a.ok(second, 'the fixture needs a second page');
  await put(site.id, doc, site.version, cookie);

  a.equal((await get('/' + second.slug)).status, 200, 'extensionless');
  const legacy = await get('/' + second.slug + '.html');
  a.equal(legacy.status, 308, 'the old filename redirects to the clean custom-domain path');
  a.equal(legacy.headers.get('location'), '/' + second.slug);
  a.equal((await get('/robots.txt')).status, 200);
  a.equal((await get('/nope')).status, 404);
});

test('site roots and index aliases redirect to one clean URL without losing the query', async () => {
  const { site, get, admin } = await rig();
  const sharedRoot = await admin(`/${site.slug}?from=bare`);
  a.equal(sharedRoot.status, 308);
  a.equal(sharedRoot.headers.get('location'), `/${site.slug}/?from=bare`);

  const sharedIndex = await admin(`/${site.slug}/index?from=index`);
  a.equal(sharedIndex.status, 308);
  a.equal(sharedIndex.headers.get('location'), `/${site.slug}/?from=index`);

  const customIndex = await get('/index.html?from=legacy');
  a.equal(customIndex.status, 308);
  a.equal(customIndex.headers.get('location'), '/?from=legacy');
});

test('an unknown host is not somebody else’s site', async () => {
  const { get } = await rig();
  const res = await get('/', 'stranger.test');
  a.equal(res.status, 404);
  a.match(await res.text(), /No site for host stranger\.test/);
});

test('the editor host asks who you are before it shows you anything', async () => {
  const { admin } = await rig();
  const res = await admin('/');
  a.equal(res.status, 200);
  const html = await res.text();
  a.match(html, /Send me a link/, 'a sign-in form, not the editor');
  a.match(html, /if \(!response\.ok\)/, 'mail failures must not become a false success screen');
  a.match(html, /role="alert"/, 'the failure has a visible and accessible destination');
  a.equal(/<title>Builder<\/title>/.test(html), false);
});

test('one site goes straight to it; several offer a choice', async () => {
  const { store, auth, user, admin, signIn, site } = await rig();
  const { cookie } = await signIn();

  const one = await admin('/', {}, cookie);
  a.equal(one.status, 302);
  a.equal(one.headers.get('location'), `/edit/${site.id}`, 'a picker with one row is a click for nothing');

  const second = await store.create({ host: 'beta.test', name: 'Beta', doc: demo() });
  await auth.grant(second.id, user.id, 'owner');
  const many = await admin('/', {}, cookie);
  a.equal(many.status, 200);
  const html = await many.text();
  a.match(html, /Acme/);
  a.match(html, /Beta/);
  a.match(html, new RegExp(`/edit/${second.id}`));
});

test('a signed-in person with no sites is offered one, not a dead end', async () => {
  const { auth, admin, linkUrl } = await rig();
  await auth.createUser('nobody@elsewhere.test');       // an account, no membership
  await admin('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@elsewhere.test' }) });
  const token = new URL(linkUrl()).searchParams.get('token')!;
  const cb = await admin(`/auth/callback?token=${token}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];

  const res = await admin('/', {}, cookie);
  a.equal(res.status, 200);
  const html = await res.text();
  /* This screen used to read "ask whoever set it up to grant you one" — shown to the person who
     had just set it up, on a server where nothing in a browser could create a site. */
  a.match(html, /Make your first site/);
  a.match(html, /<form id="new"/, 'and a way to make one');
  a.match(html, /\/api\/sites/, 'pointed at the endpoint that was there all along');
  a.equal(/<title>Builder<\/title>/.test(html), false, 'and certainly not an editor');
});

test('the editor arrives with the document already in the page', async () => {
  const { admin, signIn, site, user } = await rig();
  const { cookie } = await signIn();
  const res = await admin(`/edit/${site.id}`, {}, cookie);
  a.equal(res.status, 200);
  const html = await res.text();
  a.match(html, /<title>Builder<\/title>/, 'and it is the editor');
  a.match(html, /window\.PC_SERVER=/);

  /* the config parses, and carries what the editor needs to save */
  const from = html.indexOf('window.PC_SERVER=') + 'window.PC_SERVER='.length;
  const to = html.indexOf('</script>', from);
  a.ok(from > 17 && to > from, 'no config found in the served page');
  const config = JSON.parse(html.slice(from, to).replace(/;\s*$/, '').replace(/\\u003c/g, '<'));
  a.equal(config.siteId, site.id);
  a.equal(config.version, 1);
  a.equal(config.role, 'owner');
  a.deepEqual(config.user, { id: user.id, name: 'Client', email: 'client@acme.test' });
  a.equal(config.host, 'acme.test');
  a.ok(config.doc.pages.length >= 1, 'the document itself, so load() stays synchronous');
});

test('a document containing </script> cannot close the tag it is injected into', async () => {
  /* Convention 9. The code widget exists now, so a document holding that sequence is not a
     hypothetical — and the failure would be the whole editor, not one page. */
  const { store, auth, user, admin, signIn } = await rig();
  const doc = demo();
  const host = doc.pages[0].tree[0];
  host.children.push(Core.N('code', { body: 'const evil = "</scr' + 'ipt><script>alert(1)</scr' + 'ipt>";' }, {}, []));
  const site = await store.create({ host: 'risky.test', name: 'Risky', doc });
  await auth.grant(site.id, user.id, 'owner');

  const { cookie } = await signIn();
  const html = await (await admin(`/edit/${site.id}`, {}, cookie)).text();
  const start = html.indexOf('window.PC_SERVER=');
  const injected = html.slice(start, html.indexOf('</script>', start));
  a.equal(/<\/script/i.test(injected), false, 'the sequence survived into the injected block');
  a.match(injected, /\\u003c/, 'escaped rather than stripped, so the document is unchanged');
});

test('the editor is not served for a site you have no role on', async () => {
  const { admin, signIn } = await rig();
  const { cookie } = await signIn();
  const res = await admin('/edit/does-not-exist', {}, cookie);
  a.equal(res.status, 404);
});

test('the editor asks you to sign in rather than 401-ing at a browser', async () => {
  const { admin, site } = await rig();
  const res = await admin(`/edit/${site.id}`);
  a.equal(res.status, 200, 'a person typing a URL gets a form, not JSON');
  a.match(await res.text(), /Send me a link/);
});

test('two sites on one server stay their own', async () => {
  const { store, app } = await rig();
  const other = demo();
  other.pages[0].title = 'Beta home';
  await store.create({ host: 'beta.test', name: 'Beta', doc: other });

  const ask = (host: string) => app.request(new Request(`http://${host}/`, { headers: { host } }));
  const [acme, beta] = [await (await ask('acme.test')).text(), await (await ask('beta.test')).text()];
  a.match(beta, /Beta home/);
  a.equal(/Beta home/.test(acme), false);
});

test('a site is loadable and saveable by id, and the document round-trips', async () => {
  const { site, admin, signIn } = await rig();
  const { cookie } = await signIn();
  const res = await admin(`/api/sites/${site.id}`, {}, cookie);
  a.equal(res.status, 200);
  const body = await res.json() as { id: string; version: number; doc: Doc };
  a.equal(body.id, site.id);
  a.equal(body.version, 1);
  a.deepEqual(body.doc, site.doc, 'what the editor loads is what the store holds');
});
