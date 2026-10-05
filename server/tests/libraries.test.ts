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
  const friend = await auth.createUser('friend@example.test', 'Friend');
  const author = await store.create({ host: 'author.test', name: 'Author', slug: 'author', doc: blankDoc() });
  const recipient = await store.create({ host: 'recipient.test', name: 'Recipient', slug: 'recipient', doc: blankDoc() });
  await auth.grant(author.id, owner.id, 'owner');
  await auth.grant(recipient.id, owner.id, 'owner');
  const friendSite = await store.create({ host: 'friend.test', name: 'Friend site', slug: 'friend', doc: blankDoc() });
  await auth.grant(friendSite.id, friend.id, 'owner');
  const image = await assets.put({ siteId: author.id, name: 'hero.webp', type: 'image/webp', w: 8, h: 8, bytes: imageBytes, contentHash: sha(imageBytes) });
  const doc = structuredClone(author.doc);
  const card: ComponentDef = { id: 'card', name: 'Card', props: [], node: node('c1', 'box', { css: { d: { background: `url(asset:${image.id})` } } as never }) };
  doc.meta.components = [card];
  const saved = await store.save(author.id, doc, author.version, owner.id);
  a.equal(saved.ok, true);
  const notices: { to: string; subject: string; text: string }[] = [];
  const app = createApp({
    store, auth, assets, libraries, editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>',
    sendNotice: (to, subject, text) => { notices.push({ to, subject, text }); },
  });
  const cookieFor = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60 * 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookieFor(owner.id), strangerCookie = await cookieFor(stranger.id), friendCookie = await cookieFor(friend.id);
  const call = async (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const res = await app.request(new Request(`http://admin.test${path}`, {
      method: init.method || 'GET',
      headers: { host: 'admin.test', 'content-type': 'application/json', origin: 'http://admin.test', cookie: init.cookie ?? ownerCookie },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }));
    return { status: res.status, body: await res.json().catch(() => null) as any };
  };
  return { store, auth, assets, libraries, author, recipient, friend, friendSite, image, call, notices, ownerCookie, strangerCookie, friendCookie };
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

/* ---- read-only sharing (slice 2) ---- */

const settled = () => new Promise(resolve => setTimeout(resolve, 10));

async function sharedRig() {
  const r = await rig();
  const lib = (await r.call('/api/libraries', { method: 'POST', body: { name: 'Brand kit' } })).body.library;
  const site = await r.store.byId(r.author.id);
  await r.call(`/api/libraries/${lib.id}/versions`, { method: 'POST', body: { siteId: r.author.id, sourceVersion: site!.version, items: [{ kind: 'component', id: 'card' }] } });
  return { ...r, lib };
}

const invitationFor = async (r: Awaited<ReturnType<typeof sharedRig>>, cookie: string) => {
  const pending = await r.call('/api/invitations', { cookie });
  a.equal(pending.status, 200);
  a.equal(pending.body.invitations.length, 1);
  return pending.body.invitations[0] as { id: string; kind: string; resourceId: string };
};

test('sharing lets a viewer list, read and import into their own site, and nothing more', async () => {
  const r = await sharedRig();
  const shared = await r.call(`/api/libraries/${r.lib.id}/members`, { method: 'POST', body: { email: ' Friend@Example.test ' } });
  a.equal(shared.status, 201);
  a.equal(shared.body.added, true);
  a.equal(shared.body.member.email, 'friend@example.test');
  a.equal(shared.body.member.awaitingAcceptance, true);
  a.deepEqual((await r.call(`/api/libraries/${r.lib.id}/members`)).body.members.map((m: { email: string }) => m.email), ['friend@example.test']);
  // The notice goes out after the response, so the owner never waits on mail.
  await settled();
  a.equal(r.notices.length, 1, 'the person shared with is told');
  a.equal(r.notices[0].to, 'friend@example.test');
  a.match(r.notices[0].subject, /Owner invited you to a library/);
  a.match(r.notices[0].text, /“Brand kit”/);

  const asFriend = { cookie: r.friendCookie };
  a.deepEqual((await r.call('/api/libraries', asFriend)).body.libraries, [], 'invitation grants no list access');
  a.equal((await r.call(`/api/libraries/${r.lib.id}`, asFriend)).status, 404);
  a.equal((await r.call(`/api/libraries/${r.lib.id}/versions/1`, asFriend)).status, 404);
  a.equal((await r.call(`/api/sites/${r.friendSite.id}/library-assets`, {
    method: 'POST', cookie: r.friendCookie, body: { libraryId: r.lib.id, version: 1 },
  })).status, 404, 'invitation grants no import access');
  const invitation = await invitationFor(r, r.friendCookie);
  a.deepEqual([invitation.kind, invitation.resourceId], ['library', r.lib.id]);
  a.equal((await r.call(`/api/invitations/${invitation.id}/accept`, {
    method: 'POST', cookie: r.strangerCookie,
  })).status, 404, 'another signed-in user cannot accept');
  const accepted = await r.call(`/api/invitations/${invitation.id}/accept`, {
    method: 'POST', cookie: r.friendCookie,
  });
  a.deepEqual(accepted.body, { status: 'accepted' });
  a.equal((await r.call(`/api/invitations/${invitation.id}/accept`, {
    method: 'POST', cookie: r.friendCookie,
  })).status, 404, 'acceptance is single-use');

  const listed = (await r.call('/api/libraries', asFriend)).body.libraries;
  a.deepEqual(listed.map((l: { name: string; access: string; ownerName: string }) => [l.name, l.access, l.ownerName]), [['Brand kit', 'viewer', 'Owner']]);
  const read = await r.call(`/api/libraries/${r.lib.id}`, asFriend);
  a.equal(read.body.library.access, 'viewer');
  a.equal((await r.call(`/api/libraries/${r.lib.id}/versions/1`, asFriend)).status, 200);

  // Import into a site the viewer owns; their site pays for its own copy of the image.
  const copied = await r.call(`/api/sites/${r.friendSite.id}/library-assets`, { method: 'POST', cookie: r.friendCookie, body: { libraryId: r.lib.id, version: 1 } });
  a.equal(copied.status, 200);
  a.equal((await r.assets.list(r.friendSite.id)).length, 1);
  // …but not into a site that is not theirs.
  a.equal((await r.call(`/api/sites/${r.recipient.id}/library-assets`, { method: 'POST', cookie: r.friendCookie, body: { libraryId: r.lib.id, version: 1 } })).status, 404);

  // Owner-only actions are refused with a reason, not concealed.
  const site = await r.store.byId(r.author.id);
  const publish = await r.call(`/api/libraries/${r.lib.id}/versions`, { method: 'POST', cookie: r.friendCookie, body: { siteId: r.friendSite.id, sourceVersion: site!.version, items: [{ kind: 'component', id: 'card' }] } });
  a.equal(publish.status, 403);
  a.equal(publish.body.error, 'only_owner');
  a.equal((await r.call(`/api/libraries/${r.lib.id}/members`, asFriend)).status, 403);
  a.equal((await r.call(`/api/libraries/${r.lib.id}/members`, { method: 'POST', cookie: r.friendCookie, body: { email: 'other@example.test' } })).status, 403);

  // Someone it was not shared with still sees nothing at all.
  a.equal((await r.call(`/api/libraries/${r.lib.id}`, { cookie: r.strangerCookie })).status, 404);
  a.equal((await r.call('/api/libraries', { cookie: r.strangerCookie })).body.libraries.length, 0);
});

test('sharing refuses your own address and bad ones, and a double click is harmless', async () => {
  const r = await sharedRig();
  const path = `/api/libraries/${r.lib.id}/members`;
  a.equal((await r.call(path, { method: 'POST', body: { email: 'owner@example.test' } })).status, 400);
  a.equal((await r.call(path, { method: 'POST', body: { email: 'not an address' } })).status, 400);
  a.equal((await r.call(path, { method: 'POST', body: { email: 'friend@example.test' } })).status, 201);
  const again = await r.call(path, { method: 'POST', body: { email: 'friend@example.test' } });
  a.equal(again.status, 429, 'the same address twice in a minute is held back');
  await settled();
  a.equal(r.notices.length, 1);
  a.equal((await r.call(path)).body.members.length, 1);
});

test('an address with no account yet still must accept after signing in', async () => {
  const r = await sharedRig();
  const shared = await r.call(`/api/libraries/${r.lib.id}/members`, { method: 'POST', body: { email: 'newcomer@example.test' } });
  a.equal(shared.status, 201);
  const newcomer = await r.auth.userByEmail('newcomer@example.test');
  a.ok(newcomer, 'a pending user row holds the share');
  const token = newToken();
  await r.auth.putSession(hashToken(token), newcomer!.id, Date.now() + 60_000);
  const listed = await r.call('/api/libraries', { cookie: `pc_session=${token}` });
  a.deepEqual(listed.body.libraries, [], 'signing in alone is not consent');
  const pending = await r.call('/api/invitations', { cookie: `pc_session=${token}` });
  const invitation = pending.body.invitations[0];
  a.equal((await r.call(`/api/invitations/${invitation.id}/accept`, {
    method: 'POST', cookie: `pc_session=${token}`,
  })).body.status, 'accepted');
  const accepted = await r.call('/api/libraries', { cookie: `pc_session=${token}` });
  a.deepEqual(accepted.body.libraries.map((l: { name: string }) => l.name), ['Brand kit']);
});

test('a recipient can decline a library invitation without ever receiving access', async () => {
  const r = await sharedRig();
  await r.call(`/api/libraries/${r.lib.id}/members`, {
    method: 'POST', body: { email: 'friend@example.test' },
  });
  const invitation = await invitationFor(r, r.friendCookie);
  const declined = await r.call(`/api/invitations/${invitation.id}/decline`, {
    method: 'POST', cookie: r.friendCookie,
  });
  a.deepEqual(declined.body, { status: 'declined' });
  a.deepEqual((await r.call('/api/libraries', { cookie: r.friendCookie })).body.libraries, []);
  a.equal((await r.call(`/api/libraries/${r.lib.id}`, { cookie: r.friendCookie })).status, 404);
  a.equal((await r.call(`/api/invitations/${invitation.id}/decline`, {
    method: 'POST', cookie: r.friendCookie,
  })).status, 404, 'decline is single-use');
});

test('the owner removes someone, a viewer can leave, and the owner cannot be removed', async () => {
  const r = await sharedRig();
  const path = `/api/libraries/${r.lib.id}/members`;
  await r.call(path, { method: 'POST', body: { email: 'friend@example.test' } });
  await r.call(path, { method: 'POST', body: { email: 'stranger@example.test' } });

  const friendInvitation = await invitationFor(r, r.friendCookie);
  a.equal((await r.call(`/api/invitations/${friendInvitation.id}/accept`, {
    method: 'POST', cookie: r.friendCookie,
  })).body.status, 'accepted');

  // A viewer may not cancel someone else's pending invitation, and may leave themselves.
  const stranger = await r.auth.userByEmail('stranger@example.test');
  a.equal((await r.call(`${path}/${stranger!.id}`, { method: 'DELETE', cookie: r.friendCookie })).status, 403);
  const left = await r.call(`${path}/me`, { method: 'DELETE', cookie: r.friendCookie });
  a.equal(left.status, 200);
  a.equal((await r.call(`/api/libraries/${r.lib.id}`, { cookie: r.friendCookie })).status, 404);

  const removed = await r.call(`${path}/${stranger!.id}`, { method: 'DELETE' });
  a.deepEqual(removed.body, { removed: true });
  a.deepEqual((await r.call(path)).body.members, []);
  a.equal((await r.call(`/api/libraries/${r.lib.id}`, { cookie: r.strangerCookie })).status, 404);
  a.equal((await r.call(`${path}/${stranger!.id}`, { method: 'DELETE' })).status, 404);
  a.equal((await r.call(`${path}/me`, { method: 'DELETE' })).status, 400, 'the owner cannot leave');
});
