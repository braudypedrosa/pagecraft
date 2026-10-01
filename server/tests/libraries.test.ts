import { test } from 'vitest';
import a from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as Core from '../../app/src/core/index.ts';
import { planLibraryImport, type LibraryBundle } from '../../app/src/core/libraries.ts';
import type { ComponentDef, Doc, Node } from '../../app/src/core/types.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { MemoryAssetStore } from '../src/assets.ts';
import { MemoryLibraryStore } from '../src/libraries.ts';

const node = (id: string, type: string, extra: Partial<Node> = {}): Node => ({
  id, type, props: {}, css: {}, hide: {}, cls: [], adv: {}, children: [], ...extra,
} as unknown as Node);
const blankDoc = (): Doc => {
  Core.seed(); Core.blankProject('Site');
  Core.state.meta.components = []; Core.state.meta.blocks = []; Core.state.meta.collections = [];
  return structuredClone(Core.doc());
};
const imageBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 5, 6, 7, 8]);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function rig() {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const assets = new MemoryAssetStore();
  const libraries = new MemoryLibraryStore();
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const stranger = await auth.createUser('stranger@example.test', 'Stranger');
  const author = await store.create({ host: 'author.test', name: 'Author', slug: 'author', doc: blankDoc() });
  const recipient = await store.create({ host: 'recipient.test', name: 'Recipient', slug: 'recipient', doc: blankDoc() });
  await auth.grant(author.id, owner.id, 'owner');
  await auth.grant(recipient.id, owner.id, 'owner');
  const image = await assets.put({ siteId: author.id, name: 'hero.webp', type: 'image/webp', w: 8, h: 8, bytes: imageBytes, contentHash: sha(imageBytes) });
  const doc = structuredClone(author.doc);
  const card: ComponentDef = { id: 'card', name: 'Card', props: [], node: node('c1', 'box', { css: { d: { background: `url(asset:${image.id})` } } as never }) };
  doc.meta.components = [card];
  const saved = await store.save(author.id, doc, author.version, owner.id);
  a.equal(saved.ok, true);
  const app = createApp({ store, auth, assets, libraries, editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>' });
  const cookieFor = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60 * 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookieFor(owner.id), strangerCookie = await cookieFor(stranger.id);
  const call = async (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const res = await app.request(new Request(`http://admin.test${path}`, {
      method: init.method || 'GET',
      headers: { host: 'admin.test', 'content-type': 'application/json', origin: 'http://admin.test', cookie: init.cookie ?? ownerCookie },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }));
    return { status: res.status, body: await res.json().catch(() => null) as any };
  };
  return { store, assets, libraries, author, recipient, image, call, ownerCookie, strangerCookie };
}

test('an owner creates a library that nobody else can see', async () => {
  const r = await rig();
  const created = await r.call('/api/libraries', { method: 'POST', body: { name: 'Brand kit' } });
  a.equal(created.status, 201);
  a.equal((await r.call('/api/libraries')).body.libraries.length, 1);
  a.equal((await r.call('/api/libraries', { cookie: r.strangerCookie })).body.libraries.length, 0);
  a.equal((await r.call(`/api/libraries/${created.body.library.id}`, { cookie: r.strangerCookie })).status, 404, 'concealed, not forbidden');
  a.equal((await r.call('/api/libraries', { method: 'POST', body: { name: '' } })).status, 400);
  a.equal((await r.call('/api/libraries', { cookie: '' })).status, 401);
});

test('publishing copies the images into the library, and versions are numbered and immutable', async () => {
  const r = await rig();
  const lib = (await r.call('/api/libraries', { method: 'POST', body: { name: 'Brand kit' } })).body.library;
  const site = await r.store.byId(r.author.id);
  const first = await r.call(`/api/libraries/${lib.id}/versions`, { method: 'POST', body: { siteId: r.author.id, sourceVersion: site!.version, items: [{ kind: 'component', id: 'card' }] } });
  a.equal(first.status, 201);
  a.equal(first.body.version.version, 1);

  const read = await r.call(`/api/libraries/${lib.id}/versions/1`);
  const bundle = read.body.bundle as LibraryBundle;
  const hash = sha(imageBytes);
  a.deepEqual(bundle.assets, [hash], 'the version names the library copy, not the site asset');
  a.equal(JSON.stringify(bundle).includes(r.image.id), false);
  a.ok(await r.libraries.asset(lib.id, hash), 'the bytes now live in the library');

  // The source site deleting its image does not break the version.
  await r.assets.remove(r.author.id, r.image.id);
  a.ok(await r.libraries.asset(lib.id, hash));

  const listing = await r.call(`/api/libraries/${lib.id}`);
  a.deepEqual(listing.body.versions.map((v: { version: number }) => v.version), [1]);
});

test('publishing refuses a stale version, a stranger, and items CMS would have to carry', async () => {
  const r = await rig();
  const lib = (await r.call('/api/libraries', { method: 'POST', body: { name: 'Kit' } })).body.library;
  const site = await r.store.byId(r.author.id);
  const items = [{ kind: 'component', id: 'card' }];
  a.equal((await r.call(`/api/libraries/${lib.id}/versions`, { method: 'POST', body: { siteId: r.author.id, sourceVersion: site!.version - 1, items } })).status, 409);
  a.equal((await r.call(`/api/libraries/${lib.id}/versions`, { method: 'POST', cookie: r.strangerCookie, body: { siteId: r.author.id, sourceVersion: site!.version, items } })).status, 404);
  a.equal((await r.call(`/api/libraries/${lib.id}/versions`, { method: 'POST', body: { siteId: r.author.id, sourceVersion: site!.version, items: [{ kind: 'spaceship', id: 'x' }] } })).status, 400);

  const doc = structuredClone(site!.doc);
  doc.meta.components![0].node.src = 'workshops';
  const saved = await r.store.save(r.author.id, doc, site!.version, 'owner');
  a.equal(saved.ok, true);
  const refused = await r.call(`/api/libraries/${lib.id}/versions`, { method: 'POST', body: { siteId: r.author.id, sourceVersion: site!.version + 1, items } });
  a.equal(refused.status, 422);
  a.match(refused.body.problems.join(' '), /CMS collection workshops/);
});

test('importing into another site copies the images in once, and the document plan uses them', async () => {
  const r = await rig();
  const lib = (await r.call('/api/libraries', { method: 'POST', body: { name: 'Brand kit' } })).body.library;
  const site = await r.store.byId(r.author.id);
  await r.call(`/api/libraries/${lib.id}/versions`, { method: 'POST', body: { siteId: r.author.id, sourceVersion: site!.version, items: [{ kind: 'component', id: 'card' }] } });
  const bundle = (await r.call(`/api/libraries/${lib.id}/versions/1`)).body.bundle as LibraryBundle;

  const copied = await r.call(`/api/sites/${r.recipient.id}/library-assets`, { method: 'POST', body: { libraryId: lib.id, version: 1 } });
  a.equal(copied.status, 200);
  const siteAssetId = copied.body.assets[sha(imageBytes)];
  a.match(siteAssetId, /^a/);
  const local = await r.assets.get(r.recipient.id, siteAssetId);
  a.deepEqual([...local!.bytes], [...imageBytes]);

  const again = await r.call(`/api/sites/${r.recipient.id}/library-assets`, { method: 'POST', body: { libraryId: lib.id, version: 1 } });
  a.equal(again.body.assets[sha(imageBytes)], siteAssetId, 'a second import reuses the copy');
  a.equal((await r.assets.list(r.recipient.id)).length, 1);

  const recipient = await r.store.byId(r.recipient.id);
  const plan = planLibraryImport(recipient!.doc, bundle, { libraryId: lib.id, version: 1 }, [{ kind: 'component', id: 'card' }], { assets: copied.body.assets });
  a.match(JSON.stringify(plan.doc.meta.components), new RegExp(`asset:${siteAssetId}`));

  a.equal((await r.call(`/api/sites/${r.recipient.id}/library-assets`, { method: 'POST', body: { libraryId: lib.id, version: 1, assets: ['0'.repeat(64)] } })).status, 400,
    'only images the version uses can be copied out');
  a.equal((await r.call(`/api/sites/${r.recipient.id}/library-assets`, { method: 'POST', cookie: r.strangerCookie, body: { libraryId: lib.id, version: 1 } })).status, 404);
});
