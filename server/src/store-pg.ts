/* The Postgres store.

   Exercised now. `store-pg.test.ts` runs every method here against PGlite — Postgres compiled
   to WASM — so the SQL executes on every `npm test` rather than only when somebody remembers
   to start a container. That matters more than it sounds: this file was written blind, and
   writing SQL blind is how a query that looks right ships wrong.

   What PGlite does not test is concurrency. It is a single connection, so the one claim below
   that depends on two writers racing — the version in the `where` clause of `save` — is
   argued rather than proven. A real Postgres and two clients is the way to prove it, and the
   reason the check is one statement is exactly so that the database settles it rather than
   this code.

   The schema is here rather than in a migration tool because there is nothing to migrate yet.
   When there is, that changes. */
import type { Doc } from '../../app/src/core/types.ts';
import type { Site, SaveResult, Store } from './store.ts';
import { ASSET_SCHEMA, type Asset, type AssetStore } from './assets.ts';
import {
  AUTH_SCHEMA, normalEmail, type AuthStore, type Role, type Session
} from './auth.ts';
import { assetFile as assetFilePath } from '../../app/src/core/index.ts';

/** Run once. `IF NOT EXISTS` so a restart is not a special case. */
export const SCHEMA = `
create table if not exists sites (
  id          text primary key,
  host        text not null unique,
  name        text not null,
  doc         jsonb not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);
create index if not exists sites_host_idx on sites (host);
`;

/* Just enough of `pg` to be typed without importing it at module scope — and narrow enough
   that PGlite satisfies it too, which is what lets the tests run the real SQL with no daemon.
   `rowCount` is optional because the two drivers disagree about it and nothing here reads it. */
export interface Queryable {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
}

interface Row {
  id: string; host: string; name: string; doc: Doc;
  version: number; updated_at: Date | string;
}

const toSite = (r: Row): Site => ({
  id: r.id, host: r.host, name: r.name, doc: r.doc, version: r.version,
  updatedAt: typeof r.updated_at === 'string' ? r.updated_at : r.updated_at.toISOString()
});

export class PgStore implements Store {
  /* A field and an assignment, not `constructor(private db)`. A parameter property is one of
     the few TypeScript constructs that cannot be erased — it generates an assignment — so
     Node's strip-only mode refuses the whole module. Vitest transforms, which is why sixteen
     tests passed against a file the server could never import. */
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }

  async init() {
    /* One statement per call: PGlite's `query` takes a single statement, and a driver that
       tolerates several is not a reason to depend on it. */
    for (const stmt of statements(SCHEMA)) await this.db.query(stmt);
  }

  async byHost(host: string) {
    const { rows } = await this.db.query<Row>('select * from sites where host = $1', [host]);
    return rows[0] ? toSite(rows[0]) : null;
  }

  async byId(id: string) {
    const { rows } = await this.db.query<Row>('select * from sites where id = $1', [id]);
    return rows[0] ? toSite(rows[0]) : null;
  }

  async list() {
    const { rows } = await this.db.query<Row>('select * from sites order by name');
    return rows.map(toSite);
  }

  async create(input: { host: string; name: string; doc: Doc }) {
    const id = crypto.randomUUID();
    const { rows } = await this.db.query<Row>(
      `insert into sites (id, host, name, doc) values ($1, $2, $3, $4) returning *`,
      [id, input.host, input.name, JSON.stringify(input.doc)]
    );
    return toSite(rows[0]);
  }

  async save(id: string, doc: Doc, version: number): Promise<SaveResult> {
    /* The version is in the WHERE clause, so the check and the write are one statement and
       two saves cannot both believe they were first. Doing it as a read then a write would
       leave exactly that gap. */
    const { rows } = await this.db.query<Row>(
      `update sites set doc = $1, version = version + 1, updated_at = now()
       where id = $2 and version = $3 returning *`,
      [JSON.stringify(doc), id, version]
    );
    if (rows[0]) return { ok: true, site: toSite(rows[0]) };

    /* Nothing updated: either the row is gone or somebody else saved first. Worth telling
       apart, because one is a bug and the other is two people editing. */
    const current = await this.byId(id);
    if (!current) return { ok: false };
    return { ok: false, conflict: { yours: version, theirs: current.version } };
  }
}


/** Split a schema into statements. Comments are stripped first, so a `;` inside one cannot
    end a statement that has not finished. */
export function statements(sql: string): string[] {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map(x => x.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------- assets */

interface AssetRow {
  id: string; site_id: string; name: string; type: string;
  w: number; h: number; bytes: Uint8Array;
}

const toAsset = (r: AssetRow): Asset => ({
  id: r.id, siteId: r.site_id, name: r.name, type: r.type,
  w: r.w, h: r.h, bytes: r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes)
});

export class PgAssetStore implements AssetStore {
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }

  async init() {
    for (const stmt of statements(ASSET_SCHEMA)) await this.db.query(stmt);
  }

  async list(siteId: string) {
    const { rows } = await this.db.query<AssetRow>('select * from assets where site_id = $1 order by name', [siteId]);
    return rows.map(toAsset);
  }

  async get(siteId: string, id: string) {
    const { rows } = await this.db.query<AssetRow>('select * from assets where site_id = $1 and id = $2', [siteId, id]);
    return rows[0] ? toAsset(rows[0]) : null;
  }

  /** By the path a rendered page asks for. The name is sanitised into the path by `assetFile`,
      so the comparison has to happen on the sanitised form rather than in SQL. */
  async byPath(siteId: string, path: string) {
    for (const a of await this.list(siteId)) {
      if (assetFilePath(a) === path) return a;
    }
    return null;
  }

  async put(a: Omit<Asset, 'id'> & { id?: string }) {
    const id = a.id || 'a' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const { rows } = await this.db.query<AssetRow>(
      `insert into assets (id, site_id, name, type, w, h, bytes)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set
         name = excluded.name, type = excluded.type,
         w = excluded.w, h = excluded.h, bytes = excluded.bytes
       returning *`,
      [id, a.siteId, a.name, a.type, a.w, a.h, a.bytes]
    );
    return toAsset(rows[0]);
  }

  async remove(siteId: string, id: string) {
    const { rows } = await this.db.query<{ id: string }>(
      'delete from assets where site_id = $1 and id = $2 returning id', [siteId, id]);
    return rows.length > 0;
  }
}


/* --------------------------------------------------------------------- auth */

interface UserRow { id: string; email: string; name: string }
interface SessionRow { digest: string; user_id: string; expires_at: Date | string }
interface MemberRow { site_id: string; user_id: string; role: Role }

const ms = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v).getTime();

export class PgAuthStore implements AuthStore {
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }

  async init() {
    for (const stmt of statements(AUTH_SCHEMA)) await this.db.query(stmt);
  }

  async userByEmail(email: string) {
    const { rows } = await this.db.query<UserRow>('select * from users where email = $1', [normalEmail(email)]);
    return rows[0] || null;
  }
  async userById(id: string) {
    const { rows } = await this.db.query<UserRow>('select * from users where id = $1', [id]);
    return rows[0] || null;
  }
  async createUser(email: string, name = '') {
    /* `on conflict` rather than a read-then-write: two invitations to the same address arriving
       together should produce one account, and the database is the only thing that can say so. */
    const { rows } = await this.db.query<UserRow>(
      `insert into users (id, email, name) values ($1, $2, $3)
       on conflict (email) do update set name = coalesce(nullif(excluded.name, ''), users.name)
       returning *`,
      [crypto.randomUUID(), normalEmail(email), name]
    );
    return rows[0];
  }

  async putLink(digest: string, email: string, expiresAt: number) {
    await this.db.query(
      `insert into login_links (digest, email, expires_at) values ($1, $2, $3)
       on conflict (digest) do update set email = excluded.email, expires_at = excluded.expires_at`,
      [digest, normalEmail(email), new Date(expiresAt).toISOString()]
    );
  }
  async useLink(digest: string) {
    /* Deleted and read in one statement, so a link presented twice at once is consumed once —
       which is the whole point of a single-use token and cannot be done with a read then a
       delete. Expiry is checked after, because a token is spent by being presented. */
    const { rows } = await this.db.query<{ email: string; expires_at: Date | string }>(
      'delete from login_links where digest = $1 returning email, expires_at', [digest]);
    const row = rows[0];
    if (!row) return null;
    return ms(row.expires_at) > Date.now() ? { email: row.email } : null;
  }

  async putSession(digest: string, userId: string, expiresAt: number) {
    await this.db.query(
      'insert into sessions (digest, user_id, expires_at) values ($1, $2, $3)',
      [digest, userId, new Date(expiresAt).toISOString()]
    );
  }
  async sessionByDigest(digest: string) {
    const { rows } = await this.db.query<SessionRow>('select * from sessions where digest = $1', [digest]);
    const row = rows[0];
    if (!row) return null;
    if (ms(row.expires_at) <= Date.now()) {
      await this.dropSession(digest);
      return null;
    }
    const out: Session = { token: row.digest, userId: row.user_id, expiresAt: ms(row.expires_at) };
    return out;
  }
  async dropSession(digest: string) {
    await this.db.query('delete from sessions where digest = $1', [digest]);
  }

  async membership(siteId: string, userId: string) {
    const { rows } = await this.db.query<MemberRow>(
      'select * from site_users where site_id = $1 and user_id = $2', [siteId, userId]);
    return rows[0] ? { siteId: rows[0].site_id, userId: rows[0].user_id, role: rows[0].role } : null;
  }
  async grant(siteId: string, userId: string, role: Role) {
    const { rows } = await this.db.query<MemberRow>(
      `insert into site_users (site_id, user_id, role) values ($1, $2, $3)
       on conflict (site_id, user_id) do update set role = excluded.role
       returning *`,
      [siteId, userId, role]
    );
    return { siteId: rows[0].site_id, userId: rows[0].user_id, role: rows[0].role };
  }
  async members(siteId: string) {
    const { rows } = await this.db.query<MemberRow & UserRow>(
      `select m.site_id, m.user_id, m.role, u.email, u.name
       from site_users m join users u on u.id = m.user_id
       where m.site_id = $1 order by u.email`, [siteId]);
    return rows.map(r => ({
      siteId: r.site_id, userId: r.user_id, role: r.role, email: r.email, name: r.name
    }));
  }
  async revoke(siteId: string, userId: string) {
    const { rows } = await this.db.query<{ user_id: string }>(
      'delete from site_users where site_id = $1 and user_id = $2 returning user_id', [siteId, userId]);
    return rows.length > 0;
  }
  /** Sessions a revoked person still holds are harmless — access is checked per request
      against `site_users`, so a membership that is gone is access that is gone. */
  async sessionsOf(userId: string) {
    const { rows } = await this.db.query<{ digest: string }>(
      'select digest from sessions where user_id = $1', [userId]);
    return rows.map(r => r.digest);
  }
}
