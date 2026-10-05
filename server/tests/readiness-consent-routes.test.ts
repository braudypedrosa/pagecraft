import a from 'node:assert/strict';
import { test } from 'vitest';
import type { Doc } from '../../app/src/core/types.ts';
import { MemoryOwnedSiteStore } from '../src/accounts.ts';
import { createApp } from '../src/app.ts';
import { MemoryAssetStore } from '../src/assets.ts';
import { hashToken, MemoryAuthStore, newToken, type User } from '../src/auth.ts';
import { MemoryCollaborationInvitationStore } from '../src/collaboration-invitations.ts';
import { MemoryLibraryStore } from '../src/libraries.ts';
import { MemoryStore } from '../src/store.ts';

const document = { meta: {}, header: [], footer: [], pages: [] } as unknown as Doc;

async function rig() {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const libraries = new MemoryLibraryStore();
  const assets = new MemoryAssetStore();
  const owner = await auth.createUser('owner@example.test', '<img src=x onerror=alert(1)>');
  const site = await store.create({
    host: 'consent-routes.test', slug: 'consent-routes', name: '<script>alert(1)</script>', doc: document,
    savedBy: owner.id,
  });
  await auth.grant(site.id, owner.id, 'owner');
  const invitations = new MemoryCollaborationInvitationStore(store, auth, libraries);
  const app = createApp({
    store, auth, libraries, assets, collaborationInvitations: invitations,
    ownedSites: new MemoryOwnedSiteStore(store, auth), editorHost: 'admin.test',
    editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>',
  });
  const cookie = async (user: User) => {
    const token = newToken();
    await auth.putSession(hashToken(token), user.id, Date.now() + 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookie(owner);
  const request = (path: string, session = ownerCookie, init: RequestInit = {}) => app.request(new Request(
    `http://admin.test${path}`,
    {
      ...init,
      headers: {
        host: 'admin.test', origin: 'http://admin.test', cookie: session,
        ...(init.headers || {}),
      },
    },
  ));
  const form = (path: string, session: string, values: Record<string, string>) => request(path, session, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  });
  const json = (path: string, session: string, body: unknown, method = 'POST') => request(path, session, {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const pending = async (session: string) => (await (await request('/api/invitations', session)).json() as {
    invitations: { id: string; kind: string; resourceId: string }[];
  }).invitations;
  return { store, auth, libraries, invitations, owner, site, ownerCookie, cookie, request, form, json, pending };
}

test('HTML and JSON owner invitation paths stay pending until the exact recipient decides', async () => {
  const r = await rig();

  const htmlNew = await r.form(`/sites/${r.site.id}/people/invite`, r.ownerCookie, {
    email: 'html-new@example.test', role: 'owner',
  });
  a.equal(htmlNew.status, 303);
  a.match(htmlNew.headers.get('location') || '', /Access\+starts\+after\+acceptance/);
  const htmlNewUser = await r.auth.userByEmail('html-new@example.test');
  a.ok(htmlNewUser);
  a.equal(await r.auth.membership(r.site.id, htmlNewUser!.id), null);
  const htmlNewCookie = await r.cookie(htmlNewUser!);
  a.equal((await r.request('/invitations', htmlNewCookie)).headers.get('cache-control'), 'private, no-store');
  const htmlNewInvitation = (await r.pending(htmlNewCookie))[0];
  const htmlAccepted = await r.request(`/invitations/${htmlNewInvitation.id}/accept`, htmlNewCookie, { method: 'POST' });
  a.equal(htmlAccepted.status, 303);
  a.equal(htmlAccepted.headers.get('location'), '/invitations?message=Invitation+accepted.');
  a.equal((await r.auth.membership(r.site.id, htmlNewUser!.id))?.role, 'owner');

  const htmlPromotion = await r.auth.createUser('html-promotion@example.test', 'HTML Promotion');
  await r.auth.grant(r.site.id, htmlPromotion.id, 'content');
  const promoted = await r.form(`/sites/${r.site.id}/people/${htmlPromotion.id}/role`, r.ownerCookie, { role: 'owner' });
  a.equal(promoted.status, 303);
  a.equal((await r.auth.membership(r.site.id, htmlPromotion.id))?.role, 'content');
  const htmlPromotionCookie = await r.cookie(htmlPromotion);
  const htmlPromotionInvitation = (await r.pending(htmlPromotionCookie))[0];
  const htmlDeclined = await r.request(`/invitations/${htmlPromotionInvitation.id}/decline`, htmlPromotionCookie, { method: 'POST' });
  a.equal(htmlDeclined.status, 303);
  a.equal((await r.auth.membership(r.site.id, htmlPromotion.id))?.role, 'content');

  const jsonNew = await r.auth.createUser('json-new@example.test', 'JSON New');
  const jsonInvite = await r.json(`/api/sites/${r.site.id}/people`, r.ownerCookie, {
    email: jsonNew.email, role: 'owner',
  });
  a.equal(jsonInvite.status, 201);
  const jsonInviteBody = await jsonInvite.json() as { awaitingAcceptance: boolean; invitationId: string };
  a.equal(jsonInviteBody.awaitingAcceptance, true);
  a.equal(await r.auth.membership(r.site.id, jsonNew.id), null);

  const jsonPromotion = await r.auth.createUser('json-promotion@example.test', 'JSON Promotion');
  await r.auth.grant(r.site.id, jsonPromotion.id, 'reviewer');
  const jsonUpdate = await r.json(`/api/sites/${r.site.id}/people`, r.ownerCookie, {
    email: jsonPromotion.email, role: 'owner',
  });
  a.equal(jsonUpdate.status, 201);
  a.equal((await jsonUpdate.json() as { awaitingAcceptance: boolean }).awaitingAcceptance, true);
  a.equal((await r.auth.membership(r.site.id, jsonPromotion.id))?.role, 'reviewer');

  const promotionCookie = await r.cookie(jsonPromotion);
  const invitation = (await r.pending(promotionCookie))[0];
  a.equal((await r.request(`/api/invitations/${invitation.id}/accept`, r.ownerCookie, { method: 'POST' })).status, 404,
    'inviter cannot accept for recipient');
  const declined = await r.request(`/api/invitations/${invitation.id}/decline`, promotionCookie, { method: 'POST' });
  a.deepEqual(await declined.json(), { status: 'declined' });
  a.equal((await r.auth.membership(r.site.id, jsonPromotion.id))?.role, 'reviewer',
    'decline preserves existing lower role');
});

test('removal cancels pending ownership and accepted invited ownership does not consume creator quota', async () => {
  const r = await rig();
  const cancelled = await r.auth.createUser('cancelled@example.test', 'Cancelled');
  const pendingResponse = await r.json(`/api/sites/${r.site.id}/people`, r.ownerCookie, {
    email: cancelled.email, role: 'owner',
  });
  const invitationId = (await pendingResponse.json() as { invitationId: string }).invitationId;
  const removed = await r.request(`/api/sites/${r.site.id}/people/${cancelled.id}`, r.ownerCookie, { method: 'DELETE' });
  a.deepEqual(await removed.json(), { removed: cancelled.id });
  const cancelledCookie = await r.cookie(cancelled);
  a.equal((await r.request(`/api/invitations/${invitationId}/accept`, cancelledCookie, { method: 'POST' })).status, 404);
  a.equal(await r.auth.membership(r.site.id, cancelled.id), null);

  const accepted = await r.auth.createUser('accepted@example.test', 'Accepted');
  const invited = await r.json(`/api/sites/${r.site.id}/people`, r.ownerCookie, {
    email: accepted.email, role: 'owner',
  });
  const acceptedId = (await invited.json() as { invitationId: string }).invitationId;
  const acceptedCookie = await r.cookie(accepted);
  a.equal((await r.request(`/api/invitations/${acceptedId}/accept`, acceptedCookie, { method: 'POST' })).status, 200);
  a.equal((await r.auth.membership(r.site.id, accepted.id))?.role, 'owner');
  a.equal(await new MemoryOwnedSiteStore(r.store, r.auth).owned(accepted.id), 0,
    'accepting somebody else’s site does not use their creation allowance');
});

test('owner can cancel a pending promotion without removing the lower membership', async () => {
  const r = await rig();
  const editor = await r.auth.createUser('cancel-promotion@example.test', 'Cancel Promotion');
  await r.auth.grant(r.site.id, editor.id, 'content');
  const invited = await r.form(`/sites/${r.site.id}/people/${editor.id}/role`, r.ownerCookie, { role: 'owner' });
  a.equal(invited.status, 303);
  a.equal((await r.auth.membership(r.site.id, editor.id))?.role, 'content');
  const editorCookie = await r.cookie(editor);
  a.equal((await r.pending(editorCookie)).length, 1);

  const unauthorized = await r.request(
    `/sites/${r.site.id}/people/${editor.id}/invitation/cancel`, editorCookie, { method: 'POST' },
  );
  a.equal(unauthorized.status, 403, 'non-owner cannot cancel even their own promotion');
  a.equal((await r.pending(editorCookie)).length, 1);

  const cancelled = await r.request(
    `/sites/${r.site.id}/people/${editor.id}/invitation/cancel`, r.ownerCookie, { method: 'POST' },
  );
  a.equal(cancelled.status, 303);
  a.equal(cancelled.headers.get('location'), `/sites/${r.site.id}/people?message=Ownership+invitation+cancelled.`);
  a.equal((await r.auth.membership(r.site.id, editor.id))?.role, 'content',
    'cancelling promotion preserves content access');
  a.deepEqual(await r.pending(editorCookie), []);

  const missing = await r.request(
    `/sites/${r.site.id}/people/${editor.id}/invitation/cancel`, r.ownerCookie, { method: 'POST' },
  );
  a.equal(missing.status, 303);
  a.equal(missing.headers.get('location'), `/sites/${r.site.id}/people?error=people_missing`);
  a.equal((await r.auth.membership(r.site.id, editor.id))?.role, 'content');
});

test('invitations page escapes names, handles empty and missing states, and rejects foreign-origin decisions', async () => {
  const r = await rig();
  const recipient = await r.auth.createUser('page-recipient@example.test', 'Recipient');
  const invited = await r.invitations.invite({
    kind: 'site_owner', resourceId: r.site.id, recipientId: recipient.id, invitedBy: r.owner.id,
  });
  if (invited.status !== 'pending') throw new Error('invitation missing');
  const recipientCookie = await r.cookie(recipient);
  const page = await (await r.request('/invitations', recipientCookie)).text();
  a.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  a.match(page, /&lt;img src=x onerror=alert\(1\)&gt;/);
  a.doesNotMatch(page, /<script>alert\(1\)<\/script>/);
  a.doesNotMatch(page, /<img src=x onerror=alert\(1\)>/);

  const emptyUser = await r.auth.createUser('empty@example.test', 'Empty');
  const emptyCookie = await r.cookie(emptyUser);
  a.match(await (await r.request('/invitations', emptyCookie)).text(), /No invitations are waiting/);
  a.equal((await r.request('/api/invitations/not-a-real-id/accept', emptyCookie, { method: 'POST' })).status, 404);
  a.equal((await r.request('/invitations/not-a-real-id/accept', emptyCookie, { method: 'POST' })).status, 303);
  a.equal((await r.request('/invitations', '')).headers.get('location'), '/sign-in?next=%2Finvitations');

  const foreign = await r.request(`/api/invitations/${invited.invitation.id}/accept`, recipientCookie, {
    method: 'POST', headers: { origin: 'https://attacker.test' },
  });
  a.equal(foreign.status, 403);
  a.equal((await r.pending(recipientCookie)).length, 1, 'rejected cross-origin request did not consume invitation');
});

test('memberships accepted before consent rollout remain usable', async () => {
  const r = await rig();
  const legacy = await r.auth.createUser('legacy@example.test', 'Legacy');
  const library = await r.libraries.create({ ownerId: r.owner.id, name: 'Legacy accepted library' });
  await r.libraries.addMember({ libraryId: library.id, userId: legacy.id, invitedBy: r.owner.id });
  const legacyCookie = await r.cookie(legacy);
  const listed = await r.request('/api/libraries', legacyCookie);
  a.deepEqual((await listed.json() as { libraries: { id: string }[] }).libraries.map(item => item.id), [library.id]);
  a.equal((await r.request(`/api/libraries/${library.id}`, legacyCookie)).status, 200);
});
