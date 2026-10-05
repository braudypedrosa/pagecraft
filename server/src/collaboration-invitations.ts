import { randomUUID } from 'node:crypto';
import type { AuthStore } from './auth.ts';
import { LIBRARY_MEMBERS_MAX, type LibraryStore } from './libraries.ts';
import type { PagecraftGateway } from './store-gateway.ts';
import type { Queryable } from './store-pg.ts';
import type { Store } from './store.ts';

export type CollaborationInvitationKind = 'site_owner' | 'library';

export interface CollaborationInvitation {
  id: string;
  kind: CollaborationInvitationKind;
  resourceId: string;
  recipientId: string;
  invitedBy: string;
  createdAt: string;
}

export interface CollaborationInvitationSummary extends CollaborationInvitation {
  resourceName: string;
  inviterName: string;
}

export interface ResourceCollaborationInvitation extends CollaborationInvitation {
  recipientEmail: string;
  recipientName: string;
}

export type CollaborationInviteResult =
  | { status: 'pending'; invitation: CollaborationInvitation }
  | { status: 'already_member' | 'forbidden' | 'limit' };

export type CollaborationDecision = 'accepted' | 'declined' | 'missing';

export interface CollaborationInvitationStore {
  listForUser(userId: string): Promise<CollaborationInvitationSummary[]>;
  listForResource(kind: CollaborationInvitationKind, resourceId: string): Promise<ResourceCollaborationInvitation[]>;
  invite(input: {
    kind: CollaborationInvitationKind;
    resourceId: string;
    recipientId: string;
    invitedBy: string;
  }): Promise<CollaborationInviteResult>;
  decide(id: string, userId: string, accept: boolean): Promise<CollaborationDecision>;
  removeForRecipient(kind: CollaborationInvitationKind, resourceId: string, recipientId: string): Promise<boolean>;
}

const invitationKey = (kind: CollaborationInvitationKind, resourceId: string, recipientId: string) =>
  `${kind}|${resourceId}|${recipientId}`;

export class MemoryCollaborationInvitationStore implements CollaborationInvitationStore {
  private rows = new Map<string, CollaborationInvitation>();
  private keys = new Map<string, string>();
  private resourceQueues = new Map<string, Promise<void>>();
  private decisionQueues = new Map<string, Promise<void>>();
  private store: Store;
  private auth: AuthStore;
  private libraries?: LibraryStore;

  constructor(
    store: Store,
    auth: AuthStore,
    libraries?: LibraryStore,
  ) {
    this.store = store;
    this.auth = auth;
    this.libraries = libraries;
  }

  async listForUser(userId: string) {
    const rows = [...this.rows.values()].filter(row => row.recipientId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const out: CollaborationInvitationSummary[] = [];
    for (const row of rows) {
      const [resourceName, inviter] = await Promise.all([
        this.resourceName(row.kind, row.resourceId),
        this.auth.userById(row.invitedBy),
      ]);
      if (resourceName === null || !inviter) continue;
      out.push({ ...row, resourceName, inviterName: inviter.name || inviter.email });
    }
    return out;
  }

  async listForResource(kind: CollaborationInvitationKind, resourceId: string) {
    const rows = [...this.rows.values()].filter(row => row.kind === kind && row.resourceId === resourceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const users = await Promise.all(rows.map(row => this.auth.userById(row.recipientId)));
    return rows.flatMap((row, index) => users[index] ? [{
      ...row, recipientEmail: users[index]!.email, recipientName: users[index]!.name,
    }] : []);
  }

  async invite(input: {
    kind: CollaborationInvitationKind;
    resourceId: string;
    recipientId: string;
    invitedBy: string;
  }): Promise<CollaborationInviteResult> {
    const queueKey = `${input.kind}|${input.resourceId}`;
    return this.queued(this.resourceQueues, queueKey, () => this.inviteLocked(input));
  }

  private async inviteLocked(input: {
    kind: CollaborationInvitationKind;
    resourceId: string;
    recipientId: string;
    invitedBy: string;
  }): Promise<CollaborationInviteResult> {
    if (!await this.auth.userById(input.recipientId) || !await this.inviterOwns(input.kind, input.resourceId, input.invitedBy)) {
      return { status: 'forbidden' };
    }
    if (await this.isMember(input.kind, input.resourceId, input.recipientId)) {
      return { status: 'already_member' };
    }
    const key = invitationKey(input.kind, input.resourceId, input.recipientId);
    const existing = this.keys.get(key);
    if (existing) return { status: 'pending', invitation: { ...this.rows.get(existing)! } };
    if (input.kind === 'library') {
      const active = (await this.libraries!.members(input.resourceId)).length;
      const pending = (await this.listForResource('library', input.resourceId)).length;
      if (active + pending >= LIBRARY_MEMBERS_MAX) return { status: 'limit' };
    }
    const invitation: CollaborationInvitation = {
      id: randomUUID(), ...input, createdAt: new Date().toISOString(),
    };
    this.rows.set(invitation.id, invitation);
    this.keys.set(key, invitation.id);
    return { status: 'pending', invitation: { ...invitation } };
  }

  async decide(id: string, userId: string, accept: boolean): Promise<CollaborationDecision> {
    const invitation = this.rows.get(id);
    if (!invitation || invitation.recipientId !== userId) return 'missing';
    return this.queued(this.resourceQueues, `${invitation.kind}|${invitation.resourceId}`, () =>
      this.queued(this.decisionQueues, id, () => this.decideLocked(id, userId, accept)));
  }

  private async decideLocked(id: string, userId: string, accept: boolean): Promise<CollaborationDecision> {
    const invitation = this.rows.get(id);
    if (!invitation || invitation.recipientId !== userId) return 'missing';
    if (!accept) {
      this.remove(invitation);
      return 'declined';
    }
    if (!await this.inviterOwns(invitation.kind, invitation.resourceId, invitation.invitedBy)) {
      this.remove(invitation);
      return 'missing';
    }
    // Recheck after asynchronous ownership reads. Only one concurrent decision consumes the row.
    if (this.rows.get(id) !== invitation) return 'missing';
    this.remove(invitation);
    if (invitation.kind === 'site_owner') {
      await this.auth.grant(invitation.resourceId, invitation.recipientId, 'owner');
    } else {
      await this.libraries!.addMember({
        libraryId: invitation.resourceId,
        userId: invitation.recipientId,
        invitedBy: invitation.invitedBy,
      });
    }
    return 'accepted';
  }

  async removeForRecipient(kind: CollaborationInvitationKind, resourceId: string, recipientId: string) {
    const id = this.keys.get(invitationKey(kind, resourceId, recipientId));
    if (!id) return false;
    const invitation = this.rows.get(id);
    if (!invitation) return false;
    this.remove(invitation);
    return true;
  }

  private remove(invitation: CollaborationInvitation) {
    this.rows.delete(invitation.id);
    this.keys.delete(invitationKey(invitation.kind, invitation.resourceId, invitation.recipientId));
  }

  private async inviterOwns(kind: CollaborationInvitationKind, resourceId: string, invitedBy: string) {
    if (kind === 'site_owner') {
      const [site, membership] = await Promise.all([
        this.store.byId(resourceId), this.auth.membership(resourceId, invitedBy),
      ]);
      return !!site && membership?.role === 'owner';
    }
    if (!this.libraries) return false;
    const library = await this.libraries.get(resourceId);
    return library?.ownerId === invitedBy;
  }

  private async isMember(kind: CollaborationInvitationKind, resourceId: string, recipientId: string) {
    if (kind === 'site_owner') return (await this.auth.membership(resourceId, recipientId))?.role === 'owner';
    return !!(await this.libraries!.getFor(resourceId, recipientId));
  }

  private async resourceName(kind: CollaborationInvitationKind, resourceId: string) {
    if (kind === 'site_owner') return (await this.store.byId(resourceId))?.name ?? null;
    return (await this.libraries?.get(resourceId))?.name ?? null;
  }

  private async queued<T>(queues: Map<string, Promise<void>>, key: string, work: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    queues.set(key, queued);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (queues.get(key) === queued) queues.delete(key);
    }
  }
}

export const COLLABORATION_INVITATIONS_SCHEMA = `
create table if not exists collaboration_invitations (
  id text primary key,
  kind text not null check (kind in ('site_owner', 'library')),
  resource_id text not null,
  recipient_id text not null references users (id) on delete cascade,
  invited_by text not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (kind, resource_id, recipient_id)
);
create index if not exists collaboration_invitations_recipient_idx
  on collaboration_invitations (recipient_id, created_at desc);
`;

interface InvitationRow {
  id: string;
  kind: CollaborationInvitationKind;
  resource_id: string;
  recipient_id: string;
  invited_by: string;
  created_at: string | Date;
  resource_name?: string;
  inviter_name?: string;
  recipient_email?: string;
  recipient_name?: string;
}

const iso = (value: string | Date) => typeof value === 'string' ? new Date(value).toISOString() : value.toISOString();
const fromRow = (row: InvitationRow): CollaborationInvitation => ({
  id: row.id, kind: row.kind, resourceId: row.resource_id, recipientId: row.recipient_id,
  invitedBy: row.invited_by, createdAt: iso(row.created_at),
});

export class PgCollaborationInvitationStore implements CollaborationInvitationStore {
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }

  async init() {
    for (const statement of COLLABORATION_INVITATIONS_SCHEMA.split(';').map(value => value.trim()).filter(Boolean)) {
      await this.db.query(statement);
    }
  }

  async listForUser(userId: string) {
    const { rows } = await this.db.query<InvitationRow>(
      `select i.*,
        case when i.kind = 'site_owner' then (select s.name from sites s where s.id = i.resource_id)
             else (select l.name from libraries l where l.id = i.resource_id::uuid) end as resource_name,
        coalesce(nullif(u.name, ''), u.email) as inviter_name
       from collaboration_invitations i join users u on u.id = i.invited_by
       where i.recipient_id = $1 order by i.created_at desc`, [userId]);
    return rows.filter(row => row.resource_name != null).map(row => ({
      ...fromRow(row), resourceName: row.resource_name!, inviterName: row.inviter_name || '',
    }));
  }

  async listForResource(kind: CollaborationInvitationKind, resourceId: string) {
    const { rows } = await this.db.query<InvitationRow>(
      `select i.*, u.email as recipient_email, u.name as recipient_name
       from collaboration_invitations i join users u on u.id = i.recipient_id
       where i.kind = $1 and i.resource_id = $2 order by i.created_at`, [kind, resourceId]);
    return rows.map(row => ({
      ...fromRow(row), recipientEmail: row.recipient_email || '', recipientName: row.recipient_name || '',
    }));
  }

  async invite(input: {
    kind: CollaborationInvitationKind;
    resourceId: string;
    recipientId: string;
    invitedBy: string;
  }): Promise<CollaborationInviteResult> {
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('begin');
      if (input.kind === 'site_owner') {
        const resource = await client.query<{ id: string }>('select id from sites where id = $1 for update', [input.resourceId]);
        if (!resource.rows[0]) return await this.finish(client, { status: 'forbidden' });
        const actor = await client.query<{ role: string }>(
          'select role from site_users where site_id = $1 and user_id = $2', [input.resourceId, input.invitedBy]);
        if (actor.rows[0]?.role !== 'owner') return await this.finish(client, { status: 'forbidden' });
        const member = await client.query<{ role: string }>(
          'select role from site_users where site_id = $1 and user_id = $2', [input.resourceId, input.recipientId]);
        if (member.rows[0]?.role === 'owner') return await this.finish(client, { status: 'already_member' });
      } else {
        const resource = await client.query<{ owner_id: string }>(
          'select owner_id from libraries where id = $1::uuid for update', [input.resourceId]);
        if (resource.rows[0]?.owner_id !== input.invitedBy) return await this.finish(client, { status: 'forbidden' });
        const member = await client.query<{ user_id: string }>(
          'select user_id from library_members where library_id = $1::uuid and user_id = $2', [input.resourceId, input.recipientId]);
        if (member.rows[0]) return await this.finish(client, { status: 'already_member' });
      }
      const prior = await client.query<InvitationRow>(
        `select * from collaboration_invitations
         where kind = $1 and resource_id = $2 and recipient_id = $3`,
        [input.kind, input.resourceId, input.recipientId]);
      if (prior.rows[0]) return await this.finish(client, { status: 'pending', invitation: fromRow(prior.rows[0]) });
      if (input.kind === 'library') {
        const count = await client.query<{ count: string }>(
          `select ((select count(*) from library_members where library_id = $1::uuid) +
                   (select count(*) from collaboration_invitations where kind = 'library' and resource_id = $1::text))::text as count`,
          [input.resourceId]);
        if (Number(count.rows[0]?.count || 0) >= LIBRARY_MEMBERS_MAX) {
          return await this.finish(client, { status: 'limit' });
        }
      }
      const inserted = await client.query<InvitationRow>(
        `insert into collaboration_invitations (id, kind, resource_id, recipient_id, invited_by)
         values ($1, $2, $3, $4, $5) returning *`,
        [randomUUID(), input.kind, input.resourceId, input.recipientId, input.invitedBy]);
      return await this.finish(client, { status: 'pending', invitation: fromRow(inserted.rows[0]) });
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') client.release();
    }
  }

  async decide(id: string, userId: string, accept: boolean): Promise<CollaborationDecision> {
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('begin');
      const peek = await client.query<InvitationRow>('select * from collaboration_invitations where id = $1', [id]);
      const initial = peek.rows[0];
      if (!initial || initial.recipient_id !== userId) return await this.finish(client, 'missing');
      if (initial.kind === 'site_owner') {
        await client.query('select id from sites where id = $1 for update', [initial.resource_id]);
      } else {
        await client.query('select id from libraries where id = $1::uuid for update', [initial.resource_id]);
      }
      const found = await client.query<InvitationRow>(
        'select * from collaboration_invitations where id = $1 for update', [id]);
      const invitation = found.rows[0];
      if (!invitation || invitation.recipient_id !== userId) return await this.finish(client, 'missing');
      if (!accept) {
        await client.query('delete from collaboration_invitations where id = $1', [id]);
        return await this.finish(client, 'declined');
      }
      if (invitation.kind === 'site_owner') {
        const resource = await client.query<{ id: string }>('select id from sites where id = $1 for update', [invitation.resource_id]);
        const actor = resource.rows[0] && await client.query<{ role: string }>(
          'select role from site_users where site_id = $1 and user_id = $2', [invitation.resource_id, invitation.invited_by]);
        if (!resource.rows[0] || actor?.rows[0]?.role !== 'owner') {
          await client.query('delete from collaboration_invitations where id = $1', [id]);
          return await this.finish(client, 'missing');
        }
        await client.query(
          `insert into site_users (site_id, user_id, role) values ($1, $2, 'owner')
           on conflict (site_id, user_id) do update set role = 'owner'`,
          [invitation.resource_id, invitation.recipient_id]);
      } else {
        const resource = await client.query<{ owner_id: string }>(
          'select owner_id from libraries where id = $1::uuid for update', [invitation.resource_id]);
        if (resource.rows[0]?.owner_id !== invitation.invited_by) {
          await client.query('delete from collaboration_invitations where id = $1', [id]);
          return await this.finish(client, 'missing');
        }
        await client.query(
          `insert into library_members (library_id, user_id, invited_by) values ($1::uuid, $2, $3)
           on conflict (library_id, user_id) do nothing`,
          [invitation.resource_id, invitation.recipient_id, invitation.invited_by]);
      }
      await client.query('delete from collaboration_invitations where id = $1', [id]);
      return await this.finish(client, 'accepted');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') client.release();
    }
  }

  async removeForRecipient(kind: CollaborationInvitationKind, resourceId: string, recipientId: string) {
    const { rows } = await this.db.query<{ id: string }>(
      `delete from collaboration_invitations
       where kind = $1 and resource_id = $2 and recipient_id = $3 returning id`,
      [kind, resourceId, recipientId]);
    return rows.length > 0;
  }

  private async finish<T>(client: Queryable, value: T): Promise<T> {
    await client.query('commit');
    return value;
  }
}

interface InvitationWire {
  id: string;
  kind: CollaborationInvitationKind;
  resource_id?: string;
  resourceId?: string;
  recipient_id?: string;
  recipientId?: string;
  invited_by?: string;
  invitedBy?: string;
  created_at?: string | Date;
  createdAt?: string | Date;
  resource_name?: string;
  resourceName?: string;
  inviter_name?: string;
  inviterName?: string;
  recipient_email?: string;
  recipientEmail?: string;
  recipient_name?: string;
  recipientName?: string;
}

const fromWire = (row: InvitationWire): CollaborationInvitation => ({
  id: row.id, kind: row.kind, resourceId: row.resourceId || row.resource_id || '',
  recipientId: row.recipientId || row.recipient_id || '', invitedBy: row.invitedBy || row.invited_by || '',
  createdAt: iso(row.createdAt || row.created_at || new Date(0)),
});

export class GatewayCollaborationInvitationStore implements CollaborationInvitationStore {
  private gateway: PagecraftGateway;
  constructor(gateway: PagecraftGateway) { this.gateway = gateway; }

  async listForUser(userId: string) {
    return (await this.gateway.call<InvitationWire[]>('collaboration.listForUser', { userId })).map(row => ({
      ...fromWire(row), resourceName: row.resourceName || row.resource_name || '',
      inviterName: row.inviterName || row.inviter_name || '',
    }));
  }
  async listForResource(kind: CollaborationInvitationKind, resourceId: string) {
    return (await this.gateway.call<InvitationWire[]>('collaboration.listForResource', { kind, resourceId })).map(row => ({
      ...fromWire(row), recipientEmail: row.recipientEmail || row.recipient_email || '',
      recipientName: row.recipientName || row.recipient_name || '',
    }));
  }
  async invite(input: { kind: CollaborationInvitationKind; resourceId: string; recipientId: string; invitedBy: string }) {
    const result = await this.gateway.call<{ status: CollaborationInviteResult['status']; invitation?: InvitationWire }>(
      'collaboration.invite', input);
    return result.status === 'pending' && result.invitation
      ? { status: 'pending' as const, invitation: fromWire(result.invitation) }
      : { status: result.status as 'already_member' | 'forbidden' | 'limit' };
  }
  decide(id: string, userId: string, accept: boolean) {
    return this.gateway.call<CollaborationDecision>('collaboration.decide', { id, userId, accept });
  }
  removeForRecipient(kind: CollaborationInvitationKind, resourceId: string, recipientId: string) {
    return this.gateway.call<boolean>('collaboration.removeForRecipient', { kind, resourceId, recipientId });
  }
}
