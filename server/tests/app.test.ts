/* Milestone 1, as a test: a document is saved, and the live page changes.

   No browser and no database — Hono apps take a `Request` and return a `Response`, so the
   whole round trip is assertable in-process. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import type { Doc } from '../../app/src/core/types.ts';

/* The demo project, not an empty one: it has a header, a footer, two pages and most of the
   widget set, so a byte-identity claim over it means something. */
const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

const rig = async () => {
  const store = new MemoryStore();
  const app = createApp({ store, editorHtml: '<title>Builder</title>', editorHost: 'admin.test' });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const get = (path: string, host = 'acme.test') =>
    app.request(new Request(`http://${host}${path}`, { headers: { host } }));
  const put = (id: string, doc: Doc, version: number) =>
    app.request(new Request(`http://admin.test/api/sites/${id}`, {
      method: 'PUT', headers: { host: 'admin.test', 'content-type': 'application/json' },
      body: JSON.stringify({ doc, version })
    }));
  return { store, app, site, get, put };
};

test('a visitor gets the page the export would have written', async () => {
  const { get } = await rig();
  const res = await get('/');
  a.equal(res.status, 200);
  a.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  const html = await res.text();
  a.match(html, /<!doctype html>/i);
  a.match(html, /<\/html>/);
});

test('editing content changes the live page, with nobody exporting anything', async () => {
  const { site, get, put } = await rig();

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

  const res = await put(site.id, doc, site.version);
  a.equal(res.status, 200);
  const body = await res.json() as { version: number; files: string[] };
  a.equal(body.version, site.version + 1, 'a save bumps the version');
  a.ok(body.files.includes('index.html'));

  const after = await (await get('/')).text();
  a.match(after, /Braudy was here/, 'the served page did not change');
});

test('a save carrying a stale version is refused rather than winning', async () => {
  const { site, put } = await rig();
  const doc = structuredClone(site.doc);

  a.equal((await put(site.id, doc, site.version)).status, 200);

  /* the second editor still holds the version they loaded */
  const late = await put(site.id, doc, site.version);
  a.equal(late.status, 409);
  const body = await late.json() as { error: string; conflict: { yours: number; theirs: number } };
  a.equal(body.error, 'stale');
  a.deepEqual(body.conflict, { yours: 1, theirs: 2 });
});

test('a save reports what the review noticed, so the editor need not ask twice', async () => {
  const { site, put } = await rig();
  const res = await put(site.id, structuredClone(site.doc), site.version);
  const body = await res.json() as { findings: { level: string; code: string }[] };
  a.ok(Array.isArray(body.findings));
  a.ok(body.findings.every(f => typeof f.code === 'string' && typeof f.level === 'string'));
});

test('paths resolve as a static host would, and a missing one is a 404', async () => {
  const { site, get, put } = await rig();
  const doc = structuredClone(site.doc);
  const second = doc.pages[1];
  a.ok(second, 'the fixture needs a second page');
  await put(site.id, doc, site.version);

  a.equal((await get('/' + second.slug)).status, 200, 'extensionless');
  a.equal((await get('/' + second.slug + '.html')).status, 200);
  a.equal((await get('/robots.txt')).status, 200);
  a.equal((await get('/nope')).status, 404);
});

test('an unknown host is not somebody else’s site', async () => {
  const { get } = await rig();
  const res = await get('/', 'stranger.test');
  a.equal(res.status, 404);
  a.match(await res.text(), /No site for host stranger\.test/);
});

test('the editor host serves the editor, not a site', async () => {
  const { app } = await rig();
  const res = await app.request(new Request('http://admin.test/', { headers: { host: 'admin.test' } }));
  a.equal(res.status, 200);
  a.match(await res.text(), /<title>Builder<\/title>/);
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
  const { site, app } = await rig();
  const res = await app.request(new Request(`http://admin.test/api/sites/${site.id}`, { headers: { host: 'admin.test' } }));
  a.equal(res.status, 200);
  const body = await res.json() as { id: string; version: number; doc: Doc };
  a.equal(body.id, site.id);
  a.equal(body.version, 1);
  a.deepEqual(body.doc, site.doc, 'what the editor loads is what the store holds');
});
