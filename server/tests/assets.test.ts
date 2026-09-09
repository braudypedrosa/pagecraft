/* Images, on a server.

   The weight here is on two things. What the server accepts, because `image/png` on
   arbitrary bytes is a way to host arbitrary content on somebody's own domain. And that a
   rendered page names a file the same way an exported zip does, because that agreement is
   the reason `assetFile` moved into the core. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { AssetQuotaError, MemoryAssetStore, sniff, dimensions, metaOf, ALLOWED, MAX_BYTES } from '../src/assets.ts';
import { renderSite } from '../src/render.ts';
import type { Doc } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

/* Real headers, minimal bodies. A 1x1 PNG is the smallest thing that is honestly a PNG. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0x03, 0x20,      // width 800
  0, 0, 0x02, 0x58,      // height 600
  8, 6, 0, 0, 0
]);
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
  0xff, 0xc0, 0, 0x11, 8, 0x01, 0x90, 0x02, 0x8a, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1
]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00, 0, 0]);
const SVG = new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"></svg>');
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

/* -------------------------------------------------------------- sniffing */

test('the type comes from the bytes, not from what the upload claimed', () => {
  a.equal(sniff(PNG), 'image/png');
  a.equal(sniff(JPEG), 'image/jpeg');
  a.equal(sniff(GIF), 'image/gif');
  a.equal(sniff(WEBP), 'image/webp');
  a.equal(sniff(SVG), 'image/svg+xml', 'after an XML declaration, which is where it usually is');
});

test('things that are not images are not images', () => {
  a.equal(sniff(new TextEncoder().encode('#!/bin/sh\nrm -rf /')), null);
  a.equal(sniff(new TextEncoder().encode('<html><body>hi</body></html>')), null);
  a.equal(sniff(new Uint8Array([0x4d, 0x5a, 0x90, 0x00])), null, 'a windows executable');
  a.equal(sniff(new Uint8Array(0)), null, 'nothing at all');
  a.equal(sniff(new Uint8Array([0x89, 0x50])), null, 'half a signature');
});

test('every type the sniffer names is one the server will serve', () => {
  for (const bytes of [PNG, JPEG, GIF, WEBP, SVG]) {
    a.equal(ALLOWED.has(sniff(bytes)!), true, `${sniff(bytes)} sniffed but not allowed`);
  }
});

test('dimensions are read from the bytes, and an unknown size is zero rather than a guess', () => {
  a.deepEqual(dimensions(PNG, 'image/png'), { w: 800, h: 600 });
  a.deepEqual(dimensions(JPEG, 'image/jpeg'), { w: 650, h: 400 });
  a.deepEqual(dimensions(GIF, 'image/gif'), { w: 320, h: 240 });
  a.deepEqual(dimensions(SVG, 'image/svg+xml'), { w: 24, h: 12 }, 'the viewBox, not a percentage');
  a.deepEqual(dimensions(WEBP, 'image/webp'), { w: 0, h: 0 },
    'unread rather than invented — the review already reports an image with no dimensions');
});

/* ------------------------------------------------------- naming and paths */

test('server asset metadata uses a collision-safe immutable path', () => {
  /* One rule, in the core, because a page served from here and the same page in a zip have
     to ask for the same file. */
  const asset = { id: 'a1', siteId: 's1', name: 'Big Logo.PNG', type: 'image/png', w: 8, h: 8, bytes: PNG };
  a.equal(Core.assetFile(asset), 'assets/big-logo-a1.png', 'sanitised, stable and collision-safe');
  a.equal(metaOf(asset).path, 'assets/big-logo-a1.png', 'the stable id prevents filename collisions');
  a.equal(Core.assetFile({ id: 'a2' }), 'assets/a2', 'the id when there is no name');
});

test('server asset metadata exposes an ephemeral editor preview without persisting storage details', () => {
  const meta = metaOf({
    id: 'a1', siteId: 's1', name: 'Preview.webp', type: 'image/webp', w: 800, h: 600,
    editorUrl: 'https://storage.example.test/signed/preview.webp?token=short-lived'
  });
  a.equal(meta.url, 'https://storage.example.test/signed/preview.webp?token=short-lived');
  a.equal('editorUrl' in meta, false);
  a.equal('siteId' in meta, false);
});

test('a token becomes a path, and one with nothing behind it becomes the placeholder', () => {
  const get = (id: string) => id === 'a1' ? { id: 'a1', name: 'logo.png' }
    : id === 'hero-image.v2' ? { id: 'hero-image.v2', name: 'hero.png' } : null;
  a.equal(Core.assetPaths('<img src="asset:a1">', get), '<img src="assets/logo-a1.png">');
  a.equal(Core.assetPaths('<img src="asset:a1">', get, '../'), '<img src="../assets/logo-a1.png">');
  a.equal(Core.assetPaths('<img src="asset:hero-image.v2">', get), '<img src="assets/hero-heroimagev2.png">',
    'portable asset ids retain supported punctuation while resolving');
  a.match(Core.assetPaths('<img src="asset:gone">', get), /^<img src="data:image\/svg\+xml/,
    'a missing image is a placeholder, not a broken src');
});

test('a page one directory down asks for the image at the right depth', () => {
  const doc = demo();
  /* the demo's hero image, pointed at an asset */
  Core.restore(doc);
  const found: { props: Record<string, unknown> }[] = [];
  Core.eachNode(doc.pages[0].tree, (n: any) => { if (!found.length && n.type === 'image') found.push(n); });
  a.equal(found.length, 1, 'the fixture has no image');
  found[0].props.src = 'asset:a1';

  const assets = [{ id: 'a1', siteId: 's1', name: 'hero.png', type: 'image/png', w: 8, h: 8, bytes: PNG }];
  const out = renderSite(doc, assets);
  a.match(out.files.get('index.html')!, /src="assets\/hero-a1\.png"/);
  a.equal(/src="asset:a1"/.test(out.files.get('index.html')!), false, 'the token must not survive');
});

test('free media usage is shared across an owner’s sites and deletion frees allowance', async () => {
  const assets = new MemoryAssetStore();
  const quota = { ownerId: 'u1', limitBytes: 10, originalBytes: 20, optimized: true };
  await assets.put({ siteId: 's1', name: 'one.webp', type: 'image/webp', w: 1, h: 1,
    bytes: new Uint8Array(6) }, quota);
  await assets.put({ siteId: 's2', name: 'two.webp', type: 'image/webp', w: 1, h: 1,
    bytes: new Uint8Array(4) }, quota);
  a.deepEqual(await assets.usage('u1', 10), { usedBytes: 10, limitBytes: 10 });
  await a.rejects(
    assets.put({ siteId: 's3', name: 'full.webp', type: 'image/webp', w: 1, h: 1,
      bytes: new Uint8Array(1) }, quota),
    (error: unknown) => error instanceof AssetQuotaError
  );
  const first = (await assets.list('s1'))[0];
  await assets.remove('s1', first.id);
  a.deepEqual(await assets.usage('u1', 10), { usedBytes: 4, limitBytes: 10 });
  a.deepEqual(await assets.usage('u2', 10), { usedBytes: 0, limitBytes: 10 });
});

/* ------------------------------------------------------------ through the API */

const rig = async (role: 'owner' | 'content' = 'owner') => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const assets = new MemoryAssetStore();
  let sent = '';
  const app = createApp({
    store, auth, assets, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_t, url) => { sent = url; },
    /* Most fixtures below are deliberately header-only byte sequences. Keep the transport
       tests focused on storage semantics; real Sharp/SVGO output has its own test file. */
    optimizeAsset: async (bytes, type) => ({
      bytes, type, ...dimensions(bytes, type), extension: type === 'image/svg+xml' ? 'svg'
        : type === 'image/jpeg' ? 'jpg' : type.split('/')[1]
    })
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  if (role === 'content') {
    const owner = await auth.createUser('owner@acme.test');
    await auth.grant(site.id, owner.id, 'owner');
  }
  const user = await auth.createUser('me@acme.test');
  await auth.grant(site.id, user.id, role);
  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init, headers: { host: 'admin.test', ...(cookie ? { cookie } : {}), ...(init.headers || {}) }
    }));
  await req('/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'me@acme.test' })
  });
  const cb = await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];

  const upload = (bytes: Uint8Array, name: string, type = 'image/png') => {
    const form = new FormData();
    form.set('file', new File([bytes as unknown as BlobPart], name, { type }));
    return req(`/api/sites/${site.id}/assets`, { method: 'POST', body: form }, cookie);
  };
  return { app, store, assets, site, req, cookie, upload };
};

test('an image uploads, lists, and is served on the site at its export path', async () => {
  const { app, upload, req, cookie, site } = await rig();

  const up = await upload(PNG, 'Hero Shot.png');
  a.equal(up.status, 201);
  const meta = await up.json() as { id: string; path: string; w: number; h: number; type: string };
  a.equal(meta.path, `assets/hero-shot-${meta.id}.png`);
  a.deepEqual([meta.w, meta.h], [800, 600], 'measured on the way in');

  const list = await (await req(`/api/sites/${site.id}/assets`, {}, cookie)).json() as unknown[];
  a.equal(list.length, 1);
  const usage = await (await req('/api/storage', {}, cookie)).json() as { usedBytes: number; limitBytes: number };
  a.equal(usage.usedBytes, PNG.byteLength, 'the shared allowance charges stored output bytes');
  a.equal(usage.limitBytes, 100 * 1024 * 1024);

  /* the site serves it, on the path the export would have written */
  const served = await app.request(new Request(`http://acme.test/${meta.path}`, { headers: { host: 'acme.test' } }));
  a.equal(served.status, 200);
  a.equal(served.headers.get('content-type'), 'image/png');
  a.match(served.headers.get('cache-control') || '', /immutable/);
  a.deepEqual(new Uint8Array(await served.arrayBuffer()), PNG, 'the same bytes back');
});

test('SVG remains supported but is sandboxed when opened directly', async () => {
  const { app, upload } = await rig('content');
  const active = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>');
  const up = await upload(active, 'mark.svg', 'image/svg+xml');
  a.equal(up.status, 201);
  const meta = await up.json() as { path: string };
  const served = await app.request(new Request(`http://acme.test/${meta.path}`, { headers: { host: 'acme.test' } }));
  a.equal(served.status, 200);
  a.match(served.headers.get('content-security-policy') || '', /^sandbox;/);
  a.match(served.headers.get('content-security-policy') || '', /default-src 'none'/);
  a.equal(served.headers.get('x-content-type-options'), 'nosniff');
});

test('an upload that is not an image is refused whatever it says it is', async () => {
  const { upload } = await rig();
  const res = await upload(new TextEncoder().encode('#!/bin/sh\nrm -rf /'), 'innocent.png', 'image/png');
  a.equal(res.status, 415, 'the content type claimed png; the bytes did not');
  a.match((await res.json() as { error: string }).error, /not an image/);
});

test('an upload larger than the limit is refused rather than stored', async () => {
  const { upload } = await rig();
  const big = new Uint8Array(MAX_BYTES + 1);
  big.set(PNG);
  const res = await upload(big, 'huge.png');
  a.equal(res.status, 413);
});

test('an upload with no file is a 400, not a stored empty asset', async () => {
  const { req, cookie, site, assets } = await rig();
  const res = await req(`/api/sites/${site.id}/assets`, { method: 'POST', body: new FormData() }, cookie);
  a.equal(res.status, 400);
  a.equal((await assets.list(site.id)).length, 0);
});

test('assets belong to their site and nobody else’s', async () => {
  const { app, store, assets, upload, site } = await rig();
  const meta = await (await upload(PNG, 'mine.png')).json() as { path: string };
  const other = await store.create({ host: 'beta.test', name: 'Beta', doc: demo() });

  a.equal((await assets.list(other.id)).length, 0);
  const cross = await app.request(new Request(`http://beta.test/${meta.path}`, { headers: { host: 'beta.test' } }));
  a.equal(cross.status, 404, 'another site cannot serve this one’s images');
  const own = await app.request(new Request(`http://acme.test/${meta.path}`, { headers: { host: 'acme.test' } }));
  a.equal(own.status, 200);
  void site;
});

test('same-named uploads receive different immutable paths and remain individually readable', async () => {
  const { app, upload } = await rig();
  const one = await (await upload(PNG, 'photo.png')).json() as { id: string; path: string };
  const two = await (await upload(JPEG, 'photo.png', 'image/jpeg')).json() as { id: string; path: string };
  a.notEqual(one.id, two.id);
  a.notEqual(one.path, two.path);
  const first = await app.request(new Request(`http://acme.test/${one.path}`, { headers: { host: 'acme.test' } }));
  const second = await app.request(new Request(`http://acme.test/${two.path}`, { headers: { host: 'acme.test' } }));
  a.deepEqual(new Uint8Array(await first.arrayBuffer()), PNG);
  a.deepEqual(new Uint8Array(await second.arrayBuffer()), JPEG);
});

test('asset deletion is durable, permissioned, and visible after reload', async () => {
  const { assets, upload, req, cookie, site } = await rig();
  const meta = await (await upload(PNG, 'unused.png')).json() as { id: string };
  const gone = await req(`/api/sites/${site.id}/assets/${meta.id}`, { method: 'DELETE' }, cookie);
  a.equal(gone.status, 200);
  a.equal(await assets.get(site.id, meta.id), null);
  a.deepEqual(await (await req(`/api/sites/${site.id}/assets`, {}, cookie)).json(), []);
  a.equal((await req(`/api/sites/${site.id}/assets/${meta.id}`, { method: 'DELETE' }, cookie)).status, 404);
});

test('asset deletion needs a signed-in writer', async () => {
  const { app, upload, site } = await rig();
  const meta = await (await upload(PNG, 'private.png')).json() as { id: string };
  const res = await app.request(new Request(`http://admin.test/api/sites/${site.id}/assets/${meta.id}`, {
    method: 'DELETE', headers: { host: 'admin.test' }
  }));
  a.equal(res.status, 401);
});

test('uploading needs a session and a role on that site', async () => {
  const { app, site } = await rig();
  const form = new FormData();
  form.set('file', new File([PNG as unknown as BlobPart], 'x.png', { type: 'image/png' }));
  const res = await app.request(new Request(`http://admin.test/api/sites/${site.id}/assets`, {
    method: 'POST', body: form, headers: { host: 'admin.test' }
  }));
  a.equal(res.status, 401);
});

test('a content account may upload — swapping a photograph is a content edit', async () => {
  const { upload } = await rig('content');
  const res = await upload(JPEG, 'new-photo.jpg', 'image/jpeg');
  a.equal(res.status, 201);
});

test('a site with no asset store renders placeholders rather than failing', async () => {
  /* The single-file build and a server without a volume both have to keep working. */
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const app = createApp({ store, auth, editorHost: 'admin.test' });
  const doc = demo();
  Core.restore(doc);
  let img: any = null;
  Core.eachNode(doc.pages[0].tree, (n: any) => { if (!img && n.type === 'image') img = n; });
  img.props.src = 'asset:a1';
  await store.create({ host: 'acme.test', name: 'Acme', doc });

  const res = await app.request(new Request('http://acme.test/', { headers: { host: 'acme.test' } }));
  a.equal(res.status, 200);
  a.match(await res.text(), /data:image\/svg\+xml/, 'the placeholder, not a broken src');
});
