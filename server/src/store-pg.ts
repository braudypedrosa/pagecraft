/* The Postgres store.

   **Unexercised.** There is no database on the machine this was written on, so every test
   runs against `MemoryStore` and the SQL below has never executed. That is a fact about this
   file, not a style of writing it — the first thing to do with a real database is run
   `server/tests/store-pg.test.ts`, which does not exist yet, against it.

   The schema is here rather than in a migration tool because there is one table and no
   history to migrate. When there are two of either, that changes. */
import type { Doc } from '../../app/src/core/types.ts';
import type { Site, SaveResult, Store } from './store.ts';

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

/* Just enough of `pg` to be typed without importing it at module scope — the memory store
   is the one the tests load, and they should not need a driver on the path to do it. */
interface Queryable {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
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
  constructor(private db: Queryable) { }

  async init() { await this.db.query(SCHEMA); }

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
