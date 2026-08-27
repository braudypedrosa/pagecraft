import type { Doc } from '../../app/src/core/types.ts';
import type { AuthStore } from './auth.ts';
import { slugFrom, validSlug, type Site, type Store } from './store.ts';
import type { Queryable } from './store-pg.ts';
import type { PagecraftGateway } from './store-gateway.ts';

export const OWNED_SITE_LIMIT = 3;
export type CreateOwnedResult =
  | { ok: true; site: Site }
  | { ok: false; reason: 'site_limit_reached' | 'profile_missing' };

export interface OwnedSiteStore {
  create(input: { ownerId: string; host: string; slug?: string; name: string; doc: Doc }): Promise<CreateOwnedResult>;
}

export class MemoryOwnedSiteStore implements OwnedSiteStore {
  private queues = new Map<string, Promise<void>>();
  private store: Store;
  private auth: AuthStore;
  constructor(store: Store, auth: AuthStore) { this.store = store; this.auth = auth; }

  async create(input: { ownerId: string; host: string; slug?: string; name: string; doc: Doc }) {
    const previous = this.queues.get(input.ownerId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    this.queues.set(input.ownerId, queued);
    await previous;
    try {
      if (!await this.auth.userById(input.ownerId)) return { ok: false, reason: 'profile_missing' } as const;
      const memberships = await this.auth.membershipsForUser(input.ownerId);
      if (memberships.filter(item => item.role === 'owner').length >= OWNED_SITE_LIMIT) {
        return { ok: false, reason: 'site_limit_reached' } as const;
      }
      const site = await this.store.create({ ...input, savedBy: input.ownerId });
      try {
        await this.auth.grant(site.id, input.ownerId, 'owner');
      } catch (error) {
        /* Memory stores are used only in development/tests and expose no delete operation.
           The queue still proves quota races. Durable implementations below commit both rows. */
        throw error;
      }
      return { ok: true, site } as const;
    } finally {
      release();
      if (this.queues.get(input.ownerId) === queued) this.queues.delete(input.ownerId);
    }
  }
}

interface SiteRow {
  id: string; host: string; slug: string; name: string; doc: Doc; version: number;
  published_version: number; published_release_id: string | null; updated_at: string | Date;
}
const siteFromRow = (row: SiteRow): Site => ({
  id: row.id, host: row.host, slug: row.slug, name: row.name, doc: row.doc,
  version: row.version, publishedVersion: row.published_version,
  publishedReleaseId: row.published_release_id,
  updatedAt: typeof row.updated_at === 'string' ? new Date(row.updated_at).toISOString() : row.updated_at.toISOString()
});

export class PgOwnedSiteStore implements OwnedSiteStore {
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }

  async create(input: { ownerId: string; host: string; slug?: string; name: string; doc: Doc }) {
    const wanted = input.slug ? validSlug(input.slug) : null;
    if (input.slug && !wanted) throw new Error(`not a usable path: ${input.slug}`);
    for (let attempt = 0; attempt < 5; attempt++) {
      const client = this.db.connect ? await this.db.connect() : this.db;
      try {
        await client.query('begin');
        const owner = await client.query<{ id: string }>('select id from users where id = $1 for update', [input.ownerId]);
        if (!owner.rows[0]) {
          await client.query('rollback');
          return { ok: false, reason: 'profile_missing' } as const;
        }
        const count = await client.query<{ count: string }>(
          `select count(*)::text as count from site_users where user_id = $1 and role = 'owner'`, [input.ownerId]);
        if (Number(count.rows[0]?.count || 0) >= OWNED_SITE_LIMIT) {
          await client.query('rollback');
          return { ok: false, reason: 'site_limit_reached' } as const;
        }
        const paths = await client.query<{ slug: string }>('select slug from sites');
        const slug = wanted || slugFrom(input.name || input.host, paths.rows.map(row => row.slug));
        const id = crypto.randomUUID();
        const made = await client.query<SiteRow>(
          `insert into sites (id, host, slug, name, doc) values ($1, $2, $3, $4, $5) returning *`,
          [id, input.host, slug, input.name, JSON.stringify(input.doc)]);
        await client.query(
          `insert into site_users (site_id, user_id, role) values ($1, $2, 'owner')`, [id, input.ownerId]);
        await client.query(
          `insert into site_revisions (site_id, version, doc, saved_by, created_at)
           select id, version, doc, $2, updated_at from sites where id = $1`, [id, input.ownerId]);
        await client.query('commit');
        return { ok: true, site: siteFromRow(made.rows[0]) } as const;
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        const message = String((error as Error).message);
        if (!wanted && /slug/i.test(message) && /unique|duplicate/i.test(message)) continue;
        throw error;
      } finally {
        if ('release' in client && typeof client.release === 'function') client.release();
      }
    }
    throw new Error('could not find a free path for this site');
  }
}

export class GatewayOwnedSiteStore implements OwnedSiteStore {
  private gateway: PagecraftGateway;
  private store: Store;
  constructor(gateway: PagecraftGateway, store: Store) { this.gateway = gateway; this.store = store; }

  async create(input: { ownerId: string; host: string; slug?: string; name: string; doc: Doc }) {
    const wanted = input.slug ? validSlug(input.slug) : null;
    if (input.slug && !wanted) throw new Error(`not a usable path: ${input.slug}`);
    const taken = (await this.store.listMeta()).map(site => site.slug);
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = wanted || slugFrom(input.name || input.host, taken);
      try {
        const result = await this.gateway.call<{ status: 'created' | 'limit' | 'missing'; site?: SiteRow }>(
          'account.createOwnedSite', {
            id: crypto.randomUUID(), ownerId: input.ownerId, host: input.host, slug,
            name: input.name, doc: input.doc
          });
        if (result.status === 'limit') return { ok: false, reason: 'site_limit_reached' } as const;
        if (result.status === 'missing' || !result.site) return { ok: false, reason: 'profile_missing' } as const;
        return { ok: true, site: siteFromRow(result.site) } as const;
      } catch (error) {
        const message = String((error as Error).message);
        if (!wanted && /slug/i.test(message) && /unique|duplicate/i.test(message)) {
          taken.push(slug);
          continue;
        }
        throw error;
      }
    }
    throw new Error('could not find a free path for this site');
  }
}
