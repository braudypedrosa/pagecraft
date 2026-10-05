import { randomUUID } from 'node:crypto';
import a from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { test } from 'vitest';
import type { Doc } from '../../app/src/core/types.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import {
  GatewayCollaborationInvitationStore,
  MemoryCollaborationInvitationStore,
  PgCollaborationInvitationStore,
} from '../src/collaboration-invitations.ts';
import { MemoryLibraryStore } from '../src/libraries.ts';
import { MemoryStore } from '../src/store.ts';
import { PagecraftGateway } from '../src/store-gateway.ts';
import { PgAuthStore, PgStore, type Queryable } from '../src/store-pg.ts';

const document = { meta: {}, header: [], footer: [], pages: [] } as unknown as Doc;

async function memoryRig() {
  const sites = new MemoryStore();
  const auth = new MemoryAuthStore();
  const libraries = new MemoryLibraryStore();
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const recipient = await auth.createUser('recipient@example.test', 'Recipient');
  const stranger = await auth.createUser('stranger@example.test', 'Stranger');
  const site = await sites.create({ host: 'consent.test', slug: 'consent', name: 'Consent', doc: document });
  await auth.grant(site.id, owner.id, 'owner');
  const library = await libraries.create({ ownerId: owner.id, name: 'Brand kit' });
  const invitations = new MemoryCollaborationInvitationStore(sites, auth, libraries);
  return { sites, auth, libraries, owner, recipient, stranger, site, library, invitations };
}

test('site ownership is absent until the addressed recipient accepts, then the decision is single-use', async () => {
  const r = await memoryRig();
  const result = await r.invitations.invite({
    kind: 'site_owner', resourceId: r.site.id, recipientId: r.recipient.id, invitedBy: r.owner.id,
  });
  a.equal(result.status, 'pending');
  if (result.status !== 'pending') throw new Error('invitation missing');
  a.equal(await r.auth.membership(r.site.id, r.recipient.id), null, 'pending is not access');
  a.equal(await r.invitations.decide(result.invitation.id, r.stranger.id, true), 'missing', 'only recipient decides');
  const decisions = await Promise.all([
    r.invitations.decide(result.invitation.id, r.recipient.id, true),
    r.invitations.decide(result.invitation.id, r.recipient.id, false),
  ]);
  a.deepEqual(decisions, ['accepted', 'missing']);
  a.equal((await r.auth.membership(r.site.id, r.recipient.id))?.role, 'owner');
});

test('acceptance fails closed after inviter loses ownership', async () => {
  const r = await memoryRig();
  const result = await r.invitations.invite({
    kind: 'site_owner', resourceId: r.site.id, recipientId: r.recipient.id, invitedBy: r.owner.id,
  });
  if (result.status !== 'pending') throw new Error('invitation missing');
  await r.auth.grant(r.site.id, r.stranger.id, 'owner');
  await r.auth.removeMember(r.site.id, r.owner.id);
  a.equal(await r.invitations.decide(result.invitation.id, r.recipient.id, true), 'missing');
  a.equal(await r.auth.membership(r.site.id, r.recipient.id), null);
  a.deepEqual(await r.invitations.listForResource('site_owner', r.site.id), []);
});

test('declining ownership preserves an existing lower site role', async () => {
  const r = await memoryRig();
  await r.auth.grant(r.site.id, r.recipient.id, 'content');
  const result = await r.invitations.invite({
    kind: 'site_owner', resourceId: r.site.id, recipientId: r.recipient.id, invitedBy: r.owner.id,
  });
  if (result.status !== 'pending') throw new Error('invitation missing');
  a.equal(await r.invitations.decide(result.invitation.id, r.recipient.id, false), 'declined');
  a.equal((await r.auth.membership(r.site.id, r.recipient.id))?.role, 'content');
});

test('library invitations reserve the 50-person cap, repeat safely, and grant no early access', async () => {
  const r = await memoryRig();
  const first = await r.invitations.invite({
    kind: 'library', resourceId: r.library.id, recipientId: r.recipient.id, invitedBy: r.owner.id,
  });
  if (first.status !== 'pending') throw new Error('invitation missing');
  a.equal(await r.libraries.getFor(r.library.id, r.recipient.id), null, 'pending is not membership');
  const [repeated] = await Promise.all([
    r.invitations.invite({
      kind: 'library', resourceId: r.library.id, recipientId: r.recipient.id, invitedBy: r.owner.id,
    }),
    r.invitations.invite({
      kind: 'library', resourceId: r.library.id, recipientId: r.recipient.id, invitedBy: r.owner.id,
    }),
  ]);
  a.equal(repeated.status, 'pending');
  if (repeated.status === 'pending') a.equal(repeated.invitation.id, first.invitation.id);
  const pending = await r.invitations.listForUser(r.recipient.id);
  a.deepEqual(pending.map(item => [item.resourceName, item.inviterName]), [['Brand kit', 'Owner']]);

  for (let index = 1; index < 50; index++) {
    const user = await r.auth.createUser(`pending-${index}@example.test`);
    a.equal((await r.invitations.invite({
      kind: 'library', resourceId: r.library.id, recipientId: user.id, invitedBy: r.owner.id,
    })).status, 'pending');
  }
  const overflow = await r.auth.createUser('overflow@example.test');
  a.equal((await r.invitations.invite({
    kind: 'library', resourceId: r.library.id, recipientId: overflow.id, invitedBy: r.owner.id,
  })).status, 'limit');
  a.equal(await r.invitations.decide(first.invitation.id, r.recipient.id, true), 'accepted');
  a.equal((await r.libraries.getFor(r.library.id, r.recipient.id))?.access, 'viewer');
});

async function postgresRig() {
  const db = await PGlite.create();
  const queryable = db as unknown as Queryable;
  const sites = new PgStore(queryable);
  const auth = new PgAuthStore(queryable);
  await sites.init();
  await auth.init();
  await db.exec(`
    create table libraries (
      id uuid primary key, owner_id text not null references users(id) on delete cascade,
      name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table library_members (
      library_id uuid not null references libraries(id) on delete cascade,
      user_id text not null references users(id) on delete cascade,
      invited_by text not null, created_at timestamptz not null default now(), primary key(library_id,user_id)
    );
  `);
  const invitations = new PgCollaborationInvitationStore(queryable);
  await invitations.init();
  const owner = await auth.createUser('pg-owner@example.test', 'PG Owner');
  const recipient = await auth.createUser('pg-recipient@example.test', 'PG Recipient');
  const stranger = await auth.createUser('pg-stranger@example.test', 'PG Stranger');
  const site = await sites.create({ host: 'pg-consent.test', slug: 'pg-consent', name: 'PG Consent', doc: document });
  await auth.grant(site.id, owner.id, 'owner');
  const libraryId = randomUUID();
  await queryable.query('insert into libraries(id,owner_id,name) values($1,$2,$3)', [libraryId, owner.id, 'PG Kit']);
  return {
    db, queryable, sites, auth, owner, recipient, stranger, site, libraryId,
    invitations,
  };
}

test('Postgres decisions lock and atomically convert pending rows into accepted membership', async () => {
  const r = await postgresRig();
  const result = await r.invitations.invite({
    kind: 'library', resourceId: r.libraryId, recipientId: r.recipient.id, invitedBy: r.owner.id,
  });
  if (result.status !== 'pending') throw new Error('invitation missing');
  a.equal((await r.queryable.query('select * from library_members where user_id=$1', [r.recipient.id])).rows.length, 0);
  a.equal(await r.invitations.decide(result.invitation.id, r.stranger.id, true), 'missing');
  a.equal(await r.invitations.decide(result.invitation.id, r.recipient.id, true), 'accepted');
  a.equal((await r.queryable.query('select * from library_members where user_id=$1', [r.recipient.id])).rows.length, 1);
  a.equal((await r.queryable.query('select * from collaboration_invitations where id=$1', [result.invitation.id])).rows.length, 0);
  await r.db.close();
});

test('gateway adapter keeps operation names and camelCase wire fields stable', async () => {
  const calls: { op: string; args: Record<string, unknown> }[] = [];
  const request: typeof fetch = async (_url, init) => {
    const call = JSON.parse(String(init?.body)) as { op: string; args: Record<string, unknown> };
    calls.push(call);
    if (call.op === 'collaboration.listForResource') return Response.json({ data: [{
      id: 'i1', kind: 'library', resourceId: 'l1', recipientId: 'u2', invitedBy: 'u1',
      createdAt: '2026-10-05T00:00:00.000Z', recipientEmail: 'u2@example.test', recipientName: 'Recipient',
    }] });
    if (call.op === 'collaboration.invite') return Response.json({ data: { status: 'pending', invitation: {
      id: 'i1', kind: 'library', resourceId: 'l1', recipientId: 'u2', invitedBy: 'u1', createdAt: '2026-10-05T00:00:00.000Z',
    } } });
    if (call.op === 'collaboration.decide') return Response.json({ data: 'accepted' });
    if (call.op === 'collaboration.removeForRecipient') return Response.json({ data: true });
    return Response.json({ data: [] });
  };
  const store = new GatewayCollaborationInvitationStore(new PagecraftGateway('https://gateway.invalid', 'key', request));
  a.equal((await store.invite({ kind: 'library', resourceId: 'l1', recipientId: 'u2', invitedBy: 'u1' })).status, 'pending');
  a.equal((await store.listForResource('library', 'l1'))[0].recipientEmail, 'u2@example.test');
  a.equal(await store.decide('i1', 'u2', true), 'accepted');
  a.equal(await store.removeForRecipient('library', 'l1', 'u2'), true);
  a.deepEqual(calls.map(call => call.op), [
    'collaboration.invite', 'collaboration.listForResource', 'collaboration.decide', 'collaboration.removeForRecipient',
  ]);
});
