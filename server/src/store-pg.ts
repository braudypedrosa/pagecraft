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

   The schema was here rather than in a migration tool because there was nothing to migrate.
   There is now: `slug` arrives as an `alter table` with a backfill, which is a migration in all
   but name. One more of those and it wants a real tool with an ordered list and a record of
   what has run — this one is safe to re-run only because every statement in it says
   `if not exists`. */
import type { Doc } from '../../app/src/core/types.ts';
import {
  validSlug, slugFrom, type CmsWriteHead, type Site, type SiteRevision, type SaveResult, type Store
} from './store.ts';
import {
  ASSET_SCHEMA, legacyAssetPath, metaOf,
  AssetQuotaError, FREE_STORAGE_BYTES,
  type Asset, type AssetQuota, type AssetRecord, type AssetStore
} from './assets.ts';
import {
  AUTH_SCHEMA, normalEmail, type AuthStore, type InviteDeliveryResult,
  type InvitationDrainResult, type InvitationProvisionResult,
  type MemberChangeResult, type MemberRemovalResult, type Role, type Session,
  type ManualImportCredential, type User
} from './auth.ts';
import {
  type ConnectedEditorCredential, type ConnectedGrant, type ConnectedGrantKind,
  type ConnectedStore, type ConnectionRevocationResult, type Deployment, type DeploymentResult,
  type ReleaseReservation, type ReleaseTarget,
  type SiteRelease, type SiteReleaseSummary, type WebhookOutboxEvent, type WordPressConnection,
  type WordPressContentIndexResult, type WordPressContentIndexSnapshot
} from './release-store.ts';

/** Run once. `IF NOT EXISTS` so a restart is not a special case. */
export const SCHEMA = `
create table if not exists sites (
  id          text primary key,
  host        text not null unique,
  name        text not null,
  doc         jsonb not null,
  version     integer not null default 1,
  published_version integer not null default 1,
  published_release_id text,
  published_release_sequence integer not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists sites_host_idx on sites (host);

-- The path a site answers on under the editor's own host. Added after the table shipped, so it
-- arrives as an alter: a column, a backfill from the host's first label, then the constraints.
-- In that order, because NOT NULL on a table with rows and no values would fail.
-- (No backticks in here: this is prose inside a template literal. Convention 9.)
alter table sites add column if not exists slug text;
update sites set slug = split_part(host, '.', 1) where slug is null;
alter table sites alter column slug set not null;
create unique index if not exists sites_slug_key on sites (slug);
alter table sites add column if not exists published_version integer;
update sites set published_version = version where published_version is null;
alter table sites alter column published_version set default 1;
alter table sites alter column published_version set not null;
alter table sites add column if not exists published_release_id text;
alter table sites add column if not exists published_release_sequence integer not null default 0;

create table if not exists site_revisions (
  site_id    text not null references sites (id) on delete cascade,
  version    integer not null,
  doc        jsonb not null,
  saved_by   text,
  context    jsonb,
  created_at timestamptz not null default now(),
  primary key (site_id, version)
);
create index if not exists site_revisions_site_time_idx on site_revisions (site_id, created_at desc);
insert into site_revisions (site_id, version, doc, created_at)
select id, version, doc, updated_at from sites
on conflict (site_id, version) do nothing;
`;

/** Connected WordPress persistence. Releases, targets, and deployment acknowledgements are
 * append-only; only connection pointers/tokens move. The production migration additionally
 * installs database triggers that reject privileged UPDATE/DELETE attempts on immutable rows. */
export const CONNECTED_SCHEMA = `
create table if not exists wordpress_connections (
  id text primary key,
  site_id text not null references sites (id) on delete cascade,
  created_by text not null references users (id) on delete restrict,
  installation_id text not null,
  environment text not null check (environment in ('staging', 'production')),
  profile text not null check (profile in ('existing-theme', 'pagecraft-theme')),
  target_origin text not null,
  target_path text not null,
  redirect_uri text not null,
  webhook_url text not null,
  scopes jsonb not null default '[]'::jsonb,
  status text not null check (status in ('pending', 'provisioned', 'active', 'revoked')),
  code_challenge text not null,
  authorization_code_digest text not null unique,
  authorization_code_expires_at timestamptz not null,
  authorization_code_used_at timestamptz,
  confirmation_expires_at timestamptz,
  confirmed_at timestamptz,
  access_token_digest text unique,
  access_token_expires_at timestamptz,
  previous_access_token_digest text,
  previous_access_token_expires_at timestamptz,
  refresh_token_digest text unique,
  desired_release_id text,
  pending_release_id text,
  next_sequence integer not null default 1 check (next_sequence > 0),
  last_acknowledged_sequence integer not null default 0 check (last_acknowledged_sequence >= 0),
  active_release_id text,
  active_hash text,
  revoked_at timestamptz,
  revocation_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wordpress_connections_confirmation_state_check check (
    (status = 'pending' and confirmation_expires_at is null and confirmed_at is null)
    or (status = 'provisioned' and confirmation_expires_at is not null
      and confirmed_at is null and access_token_digest is not null
      and access_token_expires_at is not null and refresh_token_digest is not null)
    or (status = 'active' and confirmed_at is not null)
    or status = 'revoked'
  )
);
alter table wordpress_connections add column if not exists revoked_at timestamptz;
alter table wordpress_connections add column if not exists revocation_idempotency_key text;
alter table wordpress_connections add column if not exists previous_access_token_digest text;
alter table wordpress_connections add column if not exists previous_access_token_expires_at timestamptz;
alter table wordpress_connections add column if not exists confirmation_expires_at timestamptz;
alter table wordpress_connections add column if not exists confirmed_at timestamptz;
update wordpress_connections set confirmed_at = coalesce(confirmed_at, updated_at, created_at)
  where status = 'active' or (status = 'revoked'
    and authorization_code_used_at is not null and access_token_digest is not null);
alter table wordpress_connections drop constraint if exists wordpress_connections_status_check;
alter table wordpress_connections add constraint wordpress_connections_status_check
  check (status in ('pending', 'provisioned', 'active', 'revoked'));
alter table wordpress_connections drop constraint if exists wordpress_connections_confirmation_state_check;
alter table wordpress_connections add constraint wordpress_connections_confirmation_state_check check (
  (status = 'pending' and confirmation_expires_at is null and confirmed_at is null)
  or (status = 'provisioned' and confirmation_expires_at is not null
    and confirmed_at is null and access_token_digest is not null
    and access_token_expires_at is not null and refresh_token_digest is not null)
  or (status = 'active' and confirmed_at is not null)
  or status = 'revoked'
);
create index if not exists wordpress_connections_site_idx on wordpress_connections (site_id, environment);
create unique index if not exists wordpress_connections_one_environment_idx
  on wordpress_connections (site_id, environment) where status <> 'revoked';
create unique index if not exists wordpress_connections_installation_idx
  on wordpress_connections (installation_id) where status <> 'revoked';
create unique index if not exists wordpress_connections_target_idx
  on wordpress_connections (target_origin, target_path) where status <> 'revoked';
create index if not exists wordpress_connections_desired_idx on wordpress_connections (desired_release_id) where desired_release_id is not null;
create index if not exists wordpress_connections_pending_idx on wordpress_connections (pending_release_id) where pending_release_id is not null;
create index if not exists wordpress_connections_previous_access_idx
  on wordpress_connections (previous_access_token_digest)
  where status = 'active' and previous_access_token_digest is not null;
create index if not exists wordpress_connections_confirmation_expiry_idx
  on wordpress_connections (confirmation_expires_at) where status = 'provisioned';

create table if not exists wordpress_content_indexes (
  connection_id text primary key references wordpress_connections (id) on delete cascade,
  generation bigint not null check (generation > 0),
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  synced_at timestamptz not null
);
create index if not exists wordpress_content_indexes_synced_idx
  on wordpress_content_indexes (synced_at desc);

create table if not exists site_release_counters (
  site_id text primary key references sites (id) on delete cascade,
  next_sequence integer not null check (next_sequence > 0)
);
create table if not exists site_release_reservations (
  site_id text not null references sites (id) on delete cascade,
  idempotency_key text not null,
  release_id text not null unique,
  sequence integer not null check (sequence > 0),
  parent_release_id text,
  created_by text not null references users (id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (site_id, idempotency_key),
  unique (site_id, sequence)
);
alter table site_release_reservations add column if not exists completed_at timestamptz;

create table if not exists site_releases (
  id text primary key,
  site_id text not null references sites (id) on delete cascade,
  sequence integer not null check (sequence > 0),
  source_version integer not null check (source_version > 0),
  schema_version integer not null check (schema_version > 0),
  parent_release_id text references site_release_reservations (release_id),
  artifact_hash text not null check (artifact_hash ~ '^[0-9a-f]{64}$'),
  artifact_bytes integer not null check (artifact_bytes >= 0),
  artifact bytea not null,
  hosted_files jsonb not null default '[]'::jsonb,
  manifest text not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  signature text not null,
  key_id text not null,
  files jsonb not null,
  pages jsonb not null,
  cms jsonb not null,
  assets jsonb not null,
  scripts jsonb not null,
  audit jsonb not null,
  idempotency_key text not null,
  created_by text not null,
  created_at timestamptz not null,
  unique (site_id, sequence),
  unique (site_id, idempotency_key)
);
alter table site_releases add column if not exists hosted_files jsonb not null default '[]'::jsonb;
update site_release_reservations r set completed_at = coalesce(r.completed_at, made.created_at)
from site_releases made where made.id = r.release_id and r.completed_at is null;
/* Development builds predating strict serialization could leave several outstanding leases.
   Close every obsolete older gap and keep only the newest lease eligible for recovery. Parent
   selection uses actual releases, so closed gaps can never enter a newly signed chain. */
with obsolete as (
  select site_id, idempotency_key, row_number() over (
    partition by site_id order by sequence desc
  ) as position
  from site_release_reservations where completed_at is null
)
update site_release_reservations r set completed_at = now()
from obsolete o where o.site_id = r.site_id and o.idempotency_key = r.idempotency_key
  and o.position > 1;
create unique index if not exists site_release_reservations_one_unbuilt_idx
  on site_release_reservations (site_id) where completed_at is null;
create index if not exists site_releases_site_time_idx on site_releases (site_id, created_at desc);
create index if not exists site_releases_source_idx on site_releases (site_id, source_version);

create table if not exists site_release_publications (
  release_id text primary key references site_releases (id) on delete restrict,
  site_id text not null references sites (id) on delete cascade,
  status text not null check (status in ('published','aborted')),
  finalized_at timestamptz not null,
  unique (site_id, release_id)
);
create index if not exists site_release_publications_site_idx
  on site_release_publications (site_id, finalized_at desc) where status = 'published';

create table if not exists release_assets (
  release_id text not null references site_releases (id) on delete restrict,
  asset_id text not null,
  path text not null,
  mime text not null,
  bytes integer not null check (bytes >= 0),
  hash text not null,
  width integer not null check (width >= 0),
  height integer not null check (height >= 0),
  primary key (release_id, asset_id),
  unique (release_id, path)
);
create index if not exists release_assets_hash_idx on release_assets (hash);

create table if not exists release_targets (
  release_id text not null references site_releases (id) on delete restrict,
  connection_id text not null references wordpress_connections (id) on delete restrict,
  sequence integer not null check (sequence > 0),
  envelope text not null,
  signature text not null,
  key_id text not null,
  created_at timestamptz not null,
  primary key (release_id, connection_id),
  unique (connection_id, sequence)
);
create index if not exists release_targets_connection_time_idx on release_targets (connection_id, created_at desc);

create table if not exists deployments (
  id text primary key,
  connection_id text not null references wordpress_connections (id) on delete restrict,
  release_id text not null,
  sequence integer not null check (sequence > 0),
  status text not null check (status in (
    'queued', 'downloading', 'staged', 'needs_approval',
    'activating', 'verifying', 'live', 'failed', 'rolled_back'
  )),
  active_hash text,
  error text,
  detail jsonb,
  idempotency_key text not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  foreign key (release_id, connection_id) references release_targets (release_id, connection_id) on delete restrict,
  unique (connection_id, idempotency_key),
  unique (connection_id, release_id, sequence, status)
);
create index if not exists deployments_release_time_idx on deployments (release_id, created_at desc);
create index if not exists deployments_connection_time_idx on deployments (connection_id, created_at desc);

create table if not exists wordpress_webhook_outbox (
  event_id text primary key,
  connection_id text not null references wordpress_connections (id) on delete restrict,
  release_id text not null references site_releases (id) on delete restrict,
  target_sequence integer not null,
  webhook_url text not null,
  payload jsonb not null,
  body_hash text not null,
  signature text not null,
  key_id text not null,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (connection_id, release_id)
);
create index if not exists wordpress_webhook_outbox_ready_idx
  on wordpress_webhook_outbox (next_attempt_at, created_at) where delivered_at is null;

create table if not exists connected_one_time_grants (
  digest text primary key,
  kind text not null check (kind in ('oauth-consent', 'editor-code', 'package-download',
    'manual-import-consent', 'manual-import-code')),
  site_id text references sites (id) on delete cascade,
  connection_id text references wordpress_connections (id) on delete cascade,
  payload jsonb not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists connected_one_time_grants_expiry_idx
  on connected_one_time_grants (expires_at) where used_at is null;

create table if not exists connected_editor_sessions (
  digest text primary key,
  connection_id text not null references wordpress_connections (id) on delete cascade,
  site_id text not null references sites (id) on delete cascade,
  owner_id text not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists connected_editor_sessions_expiry_idx on connected_editor_sessions (expires_at);
`;

/* Just enough of `pg` to be typed without importing it at module scope — and narrow enough
   that PGlite satisfies it too, which is what lets the tests run the real SQL with no daemon.
   `rowCount` is optional because the two drivers disagree about it and nothing here reads it. */
export interface Queryable {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
  /** `pg.Pool` exposes this; single-connection test drivers do not need to. Operations that
      require more than one statement use the acquired client so BEGIN/COMMIT and row locks
      cannot accidentally hop between pool connections. */
  connect?(): Promise<Queryable & { release?(): void }>;
}

interface Row {
  id: string; host: string; slug: string; name: string; doc: Doc;
  version: number; published_version: number; published_release_id: string | null;
  updated_at: Date | string;
}

const toSite = (r: Row): Site => ({
  id: r.id, host: r.host, slug: r.slug, name: r.name, doc: r.doc, version: r.version,
  publishedVersion: r.published_version, publishedReleaseId: r.published_release_id,
  updatedAt: typeof r.updated_at === 'string' ? r.updated_at : r.updated_at.toISOString()
});

interface RevisionRow {
  site_id: string; version: number; doc: Doc; saved_by: string | null;
  context: Record<string, unknown> | null; created_at: Date | string;
}
const toRevision = (r: RevisionRow): SiteRevision => ({
  siteId: r.site_id, version: r.version, doc: r.doc, savedBy: r.saved_by,
  context: r.context,
  createdAt: typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString()
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

  async bySlug(slug: string) {
    const { rows } = await this.db.query<Row>('select * from sites where slug = $1', [slug]);
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

  async listMeta() {
    const { rows } = await this.db.query<Omit<Row, 'doc'>>(
      'select id, host, slug, name, version, published_version, published_release_id, updated_at from sites order by name');
    return rows.map(r => ({
      id: r.id, host: r.host, slug: r.slug, name: r.name, version: r.version,
      publishedVersion: r.published_version, publishedReleaseId: r.published_release_id,
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : r.updated_at.toISOString()
    }));
  }

  async create(input: { host: string; slug?: string; name: string; doc: Doc; savedBy?: string }) {
    const id = crypto.randomUUID();
    const want = input.slug ? validSlug(input.slug) : null;
    if (input.slug && !want) throw new Error(`not a usable path: ${input.slug}`);
    /* The taken list is read to *derive* a slug, not to guarantee it: the unique index decides,
       and a collision on insert is retried with the next candidate. A check-then-insert would
       leave the same race `setHost` avoids for the same reason. */
    const taken = (await this.listMeta()).map(s => s.slug);
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = want || slugFrom(input.name || input.host, taken);
      try {
        const { rows } = await this.db.query<Row>(
          `with made as (
             insert into sites (id, host, slug, name, doc) values ($1, $2, $3, $4, $5) returning *
           ), recorded as (
             insert into site_revisions (site_id, version, doc, saved_by, created_at)
             select id, version, doc, $6, updated_at from made
           )
           select * from made`,
          [id, input.host, slug, input.name, JSON.stringify(input.doc), input.savedBy || null]
        );
        return toSite(rows[0]);
      } catch (e) {
        const msg = String((e as Error).message);
        /* a slug clash is worth another try; a host clash is the caller's answer */
        if (want || !/slug/i.test(msg) || !/unique|duplicate/i.test(msg)) throw e;
        taken.push(slug);
      }
    }
    throw new Error('could not find a free path for this site');
  }

  async setSlug(id: string, slug: string) {
    const want = validSlug(slug);
    if (!want) return null;
    try {
      const { rows } = await this.db.query<Row>(
        'update sites set slug = $1, updated_at = now() where id = $2 returning *', [want, id]);
      return rows[0] ? toSite(rows[0]) : null;
    } catch (e) {
      if (/unique|duplicate/i.test(String((e as Error).message))) return null;
      throw e;
    }
  }

  async setName(id: string, name: string) {
    const clean = name.trim();
    if (!clean) return null;
    const { rows } = await this.db.query<Row>(
      'update sites set name = $1, updated_at = now() where id = $2 returning *', [clean, id]);
    return rows[0] ? toSite(rows[0]) : null;
  }

  async delete(id: string) {
    const { rows } = await this.db.query<{ id: string }>('delete from sites where id = $1 returning id', [id]);
    return !!rows[0];
  }

  async setHost(id: string, host: string) {
    /* The unique index is what decides, not a read beforehand: two sites claiming one domain
       is exactly the race a check-then-write leaves open. */
    try {
      const { rows } = await this.db.query<Row>(
        'update sites set host = $1, updated_at = now() where id = $2 returning *', [host, id]);
      return rows[0] ? toSite(rows[0]) : null;
    } catch (e) {
      if (/unique|duplicate/i.test(String((e as Error).message))) return null;
      throw e;
    }
  }

  async save(id: string, doc: Doc, version: number, savedBy?: string, context?: Record<string, unknown>): Promise<SaveResult> {
    /* The version is in the WHERE clause, so the check and the write are one statement and
       two saves cannot both believe they were first. Doing it as a read then a write would
       leave exactly that gap. */
    const { rows } = await this.db.query<Row>(
      `with changed as (
         update sites set doc = $1, version = version + 1, updated_at = now()
         where id = $2 and version = $3 returning *
       ), recorded as (
         insert into site_revisions (site_id, version, doc, saved_by, context, created_at)
         select id, version, doc, $4, $5::jsonb, updated_at from changed
       )
       select * from changed`,
      [JSON.stringify(doc), id, version, savedBy || null, context ? JSON.stringify(context) : null]
    );
    if (rows[0]) return { ok: true, site: toSite(rows[0]) };

    /* Nothing updated: either the row is gone or somebody else saved first. Worth telling
       apart, because one is a bug and the other is two people editing. */
    const current = await this.byId(id);
    if (!current) return { ok: false };
    return { ok: false, conflict: { yours: version, theirs: current.version } };
  }

  async saveConnectedCms(
    id: string, doc: Doc, version: number, savedBy: string, connectionId: string,
    context: Record<string, unknown>, _active?: () => Promise<boolean>
  ): Promise<SaveResult> {
    /* `guard` locks the same connection row Disconnect locks. Whichever operation obtains it
       first finishes first: a successful disconnect can therefore never be followed by a CMS
       revision from an already in-flight bearer request. */
    const { rows } = await this.db.query<Row>(
      `with guard as materialized (
         select id from wordpress_connections
         where id = $6 and site_id = $2 and status = 'active'
           and access_token_expires_at > now()
         for update
       ), changed as (
         update sites set doc = $1, version = version + 1, updated_at = now()
         from guard where sites.id = $2 and sites.version = $3 returning sites.*
       ), recorded as (
         insert into site_revisions (site_id, version, doc, saved_by, context, created_at)
         select id, version, doc, $4, $5::jsonb, updated_at from changed
       ) select * from changed`,
      [JSON.stringify(doc), id, version, savedBy, JSON.stringify(context), connectionId]
    );
    if (rows[0]) return { ok: true, site: toSite(rows[0]) };
    const current = await this.byId(id);
    if (!current) return { ok: false };
    if (current.version !== version) {
      return { ok: false, conflict: { yours: version, theirs: current.version } };
    }
    return { ok: false, guarded: true };
  }

  async history(id: string) {
    const { rows } = await this.db.query<RevisionRow>(
      'select * from site_revisions where site_id = $1 order by version desc', [id]);
    return rows.map(toRevision);
  }

  async revision(id: string, version: number) {
    const { rows } = await this.db.query<RevisionRow>(
      'select * from site_revisions where site_id = $1 and version = $2', [id, version]);
    return rows[0] ? toRevision(rows[0]) : null;
  }

  async cmsWriteHeads(id: string, connectionId: string, itemKeys: string[]) {
    if (!itemKeys.length) return [];
    const { rows } = await this.db.query<{
      connection_id: string; collection_id: string; item_id: string; write_sequence: string | number;
      idempotency_key: string; body_hash: string; version: number;
    }>(
      `select distinct on (entry->>'collectionId', entry->>'itemId')
         entry->>'connectionId' as connection_id, entry->>'collectionId' as collection_id,
         entry->>'itemId' as item_id, (entry->>'writeSequence')::bigint as write_sequence,
         entry->>'idempotencyKey' as idempotency_key, entry->>'bodyHash' as body_hash,
         revision.version
       from site_revisions revision
       cross join lateral jsonb_array_elements(
         case when jsonb_typeof(revision.context->'cmsWrites') = 'array'
           then revision.context->'cmsWrites' else '[]'::jsonb end
       ) entry
       where revision.site_id = $1 and entry->>'connectionId' = $2
         and concat(length(entry->>'collectionId'), ':', entry->>'collectionId', entry->>'itemId') = any($3::text[])
         and (entry->>'writeSequence') ~ '^[1-9][0-9]*$'
       order by entry->>'collectionId', entry->>'itemId',
         (entry->>'writeSequence')::bigint desc, revision.version desc`,
      [id, connectionId, itemKeys]
    );
    return rows.map((row): CmsWriteHead => ({
      connectionId: row.connection_id, collectionId: row.collection_id, itemId: row.item_id,
      writeSequence: Number(row.write_sequence), idempotencyKey: row.idempotency_key,
      bodyHash: row.body_hash, version: row.version
    }));
  }

  async publish(id: string, version: number, releaseId: string, releaseSequence: number) {
    const { rows } = await this.db.query<Row>(
      `with valid as materialized (
         select 1 from site_revisions where site_id = $1 and version = $2
       ), changed as (
         update sites set published_version = $2, published_release_id = $3,
           published_release_sequence = $4, updated_at = now()
         where id = $1 and exists (select 1 from valid)
           and (published_release_sequence < $4
             or (published_release_sequence = $4
               and (published_release_id is null or published_release_id = $3))) returning *
       ) select * from changed union all
         select s.* from sites s where s.id = $1 and exists (select 1 from valid)
           and not exists (select 1 from changed) limit 1`,
      [id, version, releaseId, releaseSequence]
    );
    return rows[0] ? toSite(rows[0]) : null;
  }
}

/* --------------------------------------------------------- Connected WordPress */

interface ConnectionRow {
  id: string; site_id: string; created_by: string; installation_id: string; environment: WordPressConnection['environment'];
  profile: WordPressConnection['profile'];
  target_origin: string; target_path: string; redirect_uri: string; webhook_url: string; scopes: string[];
  status: WordPressConnection['status']; code_challenge: string; authorization_code_digest: string;
  authorization_code_expires_at: Date | string; authorization_code_used_at: Date | string | null;
  confirmation_expires_at: Date | string | null; confirmed_at: Date | string | null;
  access_token_digest: string | null; access_token_expires_at: Date | string | null;
  refresh_token_digest: string | null; desired_release_id: string | null; pending_release_id: string | null;
  next_sequence: number; last_acknowledged_sequence: number; active_release_id: string | null;
  active_hash: string | null; revoked_at: Date | string | null;
  revocation_idempotency_key: string | null; created_at: Date | string; updated_at: Date | string;
}

const iso = (value: Date | string) => typeof value === 'string' ? new Date(value).toISOString() : value.toISOString();
const isoNull = (value: Date | string | null) => value == null ? null : iso(value);
const toConnection = (row: ConnectionRow): WordPressConnection => ({
  id: row.id, siteId: row.site_id, createdBy: row.created_by, installationId: row.installation_id,
  environment: row.environment, profile: row.profile,
  targetOrigin: row.target_origin, targetPath: row.target_path,
  redirectUri: row.redirect_uri, webhookUrl: row.webhook_url, scopes: row.scopes, status: row.status,
  codeChallenge: row.code_challenge, authorizationCodeDigest: row.authorization_code_digest,
  authorizationCodeExpiresAt: iso(row.authorization_code_expires_at),
  authorizationCodeUsedAt: isoNull(row.authorization_code_used_at),
  confirmationExpiresAt: isoNull(row.confirmation_expires_at), confirmedAt: isoNull(row.confirmed_at),
  accessTokenDigest: row.access_token_digest, accessTokenExpiresAt: isoNull(row.access_token_expires_at),
  refreshTokenDigest: row.refresh_token_digest, desiredReleaseId: row.desired_release_id,
  pendingReleaseId: row.pending_release_id, nextSequence: row.next_sequence,
  lastAcknowledgedSequence: row.last_acknowledged_sequence,
  activeReleaseId: row.active_release_id, activeHash: row.active_hash,
  revokedAt: isoNull(row.revoked_at), revocationIdempotencyKey: row.revocation_idempotency_key,
  createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
});

interface ReleaseRow {
  id: string; site_id: string; sequence: number; source_version: number; schema_version: number;
  parent_release_id: string | null; artifact_hash: string; artifact_bytes: number; artifact: Uint8Array;
  hosted_files: SiteRelease['hostedFiles'];
  manifest: string; manifest_hash: string; signature: string; key_id: string;
  files: SiteRelease['files']; pages: SiteRelease['pages']; cms: SiteRelease['cms'];
  assets: SiteRelease['assets']; scripts: SiteRelease['scripts']; audit: SiteRelease['audit'];
  idempotency_key: string; created_by: string; created_at: Date | string;
}
type ReleaseSummaryRow = Omit<ReleaseRow, 'artifact' | 'hosted_files'>;
interface ReleaseReservationRow {
  site_id: string; idempotency_key: string; release_id: string; sequence: number;
  parent_release_id: string | null; created_by: string; created_at: Date | string;
  completed_at: Date | string | null;
}
const toReleaseReservation = (row: ReleaseReservationRow): ReleaseReservation => ({
  siteId: row.site_id, idempotencyKey: row.idempotency_key, releaseId: row.release_id,
  sequence: row.sequence, parentReleaseId: row.parent_release_id, createdBy: row.created_by,
  createdAt: iso(row.created_at), completedAt: isoNull(row.completed_at)
});
const toRelease = (row: ReleaseRow): SiteRelease => ({
  id: row.id, siteId: row.site_id, sequence: row.sequence, sourceVersion: row.source_version,
  schemaVersion: row.schema_version, parentReleaseId: row.parent_release_id,
  artifactHash: row.artifact_hash, artifactBytes: row.artifact_bytes,
  artifact: row.artifact instanceof Uint8Array ? new Uint8Array(row.artifact) : new Uint8Array(row.artifact),
  hostedFiles: row.hosted_files,
  manifest: row.manifest, manifestHash: row.manifest_hash, signature: row.signature, keyId: row.key_id,
  files: row.files, pages: row.pages, cms: row.cms, assets: row.assets, scripts: row.scripts,
  audit: row.audit, idempotencyKey: row.idempotency_key, createdBy: row.created_by,
  createdAt: iso(row.created_at)
});
const toReleaseSummary = (row: ReleaseSummaryRow): SiteReleaseSummary => ({
  id: row.id, siteId: row.site_id, sequence: row.sequence, sourceVersion: row.source_version,
  schemaVersion: row.schema_version, parentReleaseId: row.parent_release_id,
  artifactHash: row.artifact_hash, artifactBytes: row.artifact_bytes,
  manifest: row.manifest, manifestHash: row.manifest_hash, signature: row.signature, keyId: row.key_id,
  files: row.files, pages: row.pages, cms: row.cms, assets: row.assets, scripts: row.scripts,
  audit: row.audit, idempotencyKey: row.idempotency_key, createdBy: row.created_by,
  createdAt: iso(row.created_at)
});

const RELEASE_SUMMARY_COLUMNS = `
  r.id, r.site_id, r.sequence, r.source_version, r.schema_version, r.parent_release_id,
  r.artifact_hash, r.artifact_bytes, r.manifest, r.manifest_hash, r.signature, r.key_id,
  r.files, r.pages, r.cms, r.assets, r.scripts, r.audit, r.idempotency_key, r.created_by, r.created_at
`;

interface TargetRow {
  release_id: string; connection_id: string; sequence: number; envelope: string;
  signature: string; key_id: string; created_at: Date | string;
}
const toTarget = (row: TargetRow): ReleaseTarget => ({
  releaseId: row.release_id, connectionId: row.connection_id, sequence: row.sequence,
  envelope: row.envelope, signature: row.signature, keyId: row.key_id, createdAt: iso(row.created_at)
});

interface DeploymentRow {
  id: string; connection_id: string; release_id: string; sequence: number;
  status: Deployment['status']; active_hash: string | null; error: string | null;
  detail: Deployment['detail'];
  idempotency_key: string; body_hash: string; created_at: Date | string;
}
const toDeployment = (row: DeploymentRow): Deployment => ({
  id: row.id, connectionId: row.connection_id, releaseId: row.release_id,
  sequence: row.sequence, status: row.status, activeHash: row.active_hash, error: row.error,
  detail: row.detail,
  idempotencyKey: row.idempotency_key, bodyHash: row.body_hash, createdAt: iso(row.created_at)
});

interface WebhookRow {
  event_id: string; connection_id: string; release_id: string; target_sequence: number;
  webhook_url: string; payload: Record<string, unknown> | string; body_hash: string;
  signature: string; key_id: string; attempts: number; next_attempt_at: Date | string;
  locked_at: Date | string | null; locked_by: string | null; delivered_at: Date | string | null;
  last_error: string | null; created_at: Date | string;
}
const toWebhook = (row: WebhookRow): WebhookOutboxEvent => ({
  eventId: row.event_id, connectionId: row.connection_id, releaseId: row.release_id,
  targetSequence: row.target_sequence, webhookUrl: row.webhook_url,
  payload: typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload),
  bodyHash: row.body_hash, signature: row.signature, keyId: row.key_id, attempts: row.attempts,
  nextAttemptAt: iso(row.next_attempt_at), lockedAt: isoNull(row.locked_at), lockedBy: row.locked_by,
  deliveredAt: isoNull(row.delivered_at), lastError: row.last_error, createdAt: iso(row.created_at)
});

interface GrantRow {
  digest: string; kind: ConnectedGrantKind; site_id: string | null; connection_id: string | null;
  payload: Record<string, unknown>; expires_at: Date | string; used_at: Date | string | null;
  created_at: Date | string;
}
const toGrant = (row: GrantRow): ConnectedGrant => ({
  digest: row.digest, kind: row.kind, siteId: row.site_id, connectionId: row.connection_id,
  payload: row.payload, expiresAt: iso(row.expires_at), usedAt: isoNull(row.used_at),
  createdAt: iso(row.created_at)
});
interface EditorCredentialRow {
  digest: string; connection_id: string; site_id: string; owner_id: string;
  expires_at: Date | string; created_at: Date | string;
}
const toEditorCredential = (row: EditorCredentialRow): ConnectedEditorCredential => ({
  digest: row.digest, connectionId: row.connection_id, siteId: row.site_id, ownerId: row.owner_id,
  expiresAt: iso(row.expires_at), createdAt: iso(row.created_at)
});

interface WordPressContentIndexRow {
  connection_id: string; generation: number | string; body_hash: string;
  items: WordPressContentIndexSnapshot['items']; synced_at: Date | string;
}
const toWordPressContentIndex = (row: WordPressContentIndexRow): WordPressContentIndexSnapshot => ({
  connectionId: row.connection_id, generation: Number(row.generation), bodyHash: row.body_hash,
  items: row.items, syncedAt: iso(row.synced_at)
});

export class PgConnectedStore implements ConnectedStore {
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }
  async init() { for (const stmt of statements(CONNECTED_SCHEMA)) await this.db.query(stmt); }

  async createConnection(input: Omit<WordPressConnection,
    'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'>) {
    const { rows } = await this.db.query<ConnectionRow>(
      `with expired as (
         update wordpress_connections set status = 'revoked', revoked_at = now(),
           revocation_idempotency_key = 'expired-pairing-' || id,
           desired_release_id = null, pending_release_id = null, updated_at = now()
         where (status = 'pending' and authorization_code_expires_at <= now())
           or (status = 'provisioned' and confirmation_expires_at <= now())
         returning id
       ), expired_fence as materialized (select count(*) from expired)
       insert into wordpress_connections (
         id, site_id, created_by, installation_id, environment, profile, target_origin, target_path, redirect_uri, webhook_url,
         scopes, status, code_challenge, authorization_code_digest,
         authorization_code_expires_at, authorization_code_used_at, confirmation_expires_at,
         confirmed_at, access_token_digest, access_token_expires_at, refresh_token_digest,
         desired_release_id, pending_release_id, next_sequence, last_acknowledged_sequence,
         active_release_id, active_hash
       ) select
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
       from expired_fence returning *`,
      [input.id, input.siteId, input.createdBy, input.installationId, input.environment, input.profile, input.targetOrigin,
        input.targetPath, input.redirectUri, input.webhookUrl, JSON.stringify(input.scopes), input.status,
        input.codeChallenge, input.authorizationCodeDigest, input.authorizationCodeExpiresAt,
        input.authorizationCodeUsedAt, input.confirmationExpiresAt, input.confirmedAt,
        input.accessTokenDigest, input.accessTokenExpiresAt, input.refreshTokenDigest,
        input.desiredReleaseId, input.pendingReleaseId, input.nextSequence,
        input.lastAcknowledgedSequence, input.activeReleaseId, input.activeHash]
    );
    return toConnection(rows[0]);
  }

  async connection(id: string) {
    const { rows } = await this.db.query<ConnectionRow>('select * from wordpress_connections where id = $1', [id]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async connectionsForSite(siteId: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      `select * from wordpress_connections where site_id = $1 and status <> 'revoked'
       order by created_at`, [siteId]);
    return rows.map(toConnection);
  }
  async connectionHistoryForSite(siteId: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      'select * from wordpress_connections where site_id = $1 order by created_at', [siteId]);
    return rows.map(toConnection);
  }
  async canonicalProductionConnection(siteId: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      `select * from wordpress_connections
       where site_id = $1 and environment = 'production' and confirmed_at is not null
       order by (status = 'active') desc, created_at desc limit 1`, [siteId]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async authorizationConnection(digest: string, now: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      `select * from wordpress_connections where authorization_code_digest = $1
       and ((status = 'pending' and authorization_code_expires_at > $2)
         or (status = 'provisioned' and confirmation_expires_at > $2))`, [digest, now]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async useAuthorizationCode(digest: string, now: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      `update wordpress_connections set authorization_code_used_at = coalesce(authorization_code_used_at, $2),
         updated_at = $2
       where authorization_code_digest = $1
         and ((status = 'pending' and authorization_code_expires_at > $2)
           or (status = 'provisioned' and confirmation_expires_at > $2))
       returning *`, [digest, now]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async provisionConnection(id: string, input: {
    accessTokenDigest: string; accessTokenExpiresAt: string; refreshTokenDigest: string;
    confirmationExpiresAt: string;
  }) {
    const { rows } = await this.db.query<ConnectionRow>(
      `update wordpress_connections set status = 'provisioned', access_token_digest = $2,
         access_token_expires_at = $3, previous_access_token_digest = null,
         previous_access_token_expires_at = null, refresh_token_digest = $4,
         confirmation_expires_at = coalesce(confirmation_expires_at, $5), updated_at = now()
       where id = $1 and status in ('pending', 'provisioned')
         and authorization_code_used_at is not null returning *`,
      [id, input.accessTokenDigest, input.accessTokenExpiresAt, input.refreshTokenDigest,
        input.confirmationExpiresAt]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async confirmConnection(input: {
    id: string; accessTokenDigest: string; installationId: string; now: string;
  }) {
    const { rows } = await this.db.query<{ connection: ConnectionRow; alreadyConfirmed: boolean }>(
      `with locked as materialized (
         select * from wordpress_connections where id = $1 for update
       ), changed as (
         update wordpress_connections set status = 'active', confirmed_at = $4, updated_at = $4
         where id = $1 and status = 'provisioned' and installation_id = $3
           and access_token_digest = $2 and access_token_expires_at > $4
           and confirmation_expires_at > $4 returning *
       ) select coalesce(
           (select row_to_json(c)::jsonb from changed c),
           (select row_to_json(c)::jsonb from locked c
             where status = 'active' and installation_id = $3 and access_token_digest = $2)
         ) as connection,
         coalesce((select status = 'active' from locked), false) as "alreadyConfirmed"`,
      [input.id, input.accessTokenDigest, input.installationId, input.now]
    );
    const row = rows[0];
    return row?.connection
      ? { connection: toConnection(row.connection), alreadyConfirmed: row.alreadyConfirmed }
      : null;
  }
  async connectionByAccessToken(digest: string, now: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      `select * from wordpress_connections where status = 'active' and (
         (access_token_digest = $1 and access_token_expires_at > $2)
         or (previous_access_token_digest = $1 and previous_access_token_expires_at > $2)
       ) limit 1`, [digest, now]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async connectionByRefreshToken(digest: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      `select * from wordpress_connections where refresh_token_digest = $1
       and status in ('provisioned', 'active')`, [digest]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async rotateAccessToken(id: string, digest: string, expiresAt: string) {
    const { rows } = await this.db.query<ConnectionRow>(
      `update wordpress_connections set
       previous_access_token_digest = case
         when access_token_digest is not null and access_token_expires_at is not null
           then access_token_digest else null end,
       previous_access_token_expires_at = case
         when access_token_digest is not null and access_token_expires_at is not null
           then least(access_token_expires_at, now() + interval '2 minutes') else null end,
       access_token_digest = $2, access_token_expires_at = $3,
       updated_at = now() where id = $1 and (status = 'active'
         or (status = 'provisioned' and confirmation_expires_at > now())) returning *`,
      [id, digest, expiresAt]);
    return rows[0] ? toConnection(rows[0]) : null;
  }
  async revokeConnection(input: {
    id: string; accessTokenDigest?: string | null; refreshTokenDigest?: string | null;
    idempotencyKey: string; now: string;
  }): Promise<ConnectionRevocationResult> {
    const { rows } = await this.db.query<{ result: Record<string, unknown> | string }>(
      `with locked as materialized (
         select * from wordpress_connections where id = $1 for update
       ), verdict as materialized (
         select case
           when not exists(select 1 from locked) or (select status from locked) = 'pending'
             then 'unauthorized'
           when not (
             ($2::text is not null and (
               coalesce((select access_token_digest from locked) = $2, false)
               or coalesce((select previous_access_token_digest from locked) = $2, false)
             ))
             or ($3::text is not null
               and coalesce((select refresh_token_digest from locked) = $3, false))
           ) then 'unauthorized'
           when (select status from locked) = 'revoked'
             and (select revocation_idempotency_key from locked) is distinct from $4
             and coalesce((select revocation_idempotency_key from locked), '')
               not like 'expired-pairing-%'
             then 'idempotency-conflict'
           when (select status from locked) in ('provisioned', 'active')
             and not (
               ($3::text is not null
                 and coalesce((select refresh_token_digest from locked) = $3, false))
               or ($2::text is not null and (
                 (coalesce((select access_token_digest from locked) = $2, false)
                   and (select access_token_expires_at from locked) > $5::timestamptz)
                 or (coalesce((select previous_access_token_digest from locked) = $2, false)
                   and (select previous_access_token_expires_at from locked) > $5::timestamptz)
               ))
             )
             then 'unauthorized'
           else null
         end as error
       ), changed as (
         update wordpress_connections c set status = 'revoked', revoked_at = $5,
           revocation_idempotency_key = $4,
           access_token_digest = case when $2::text is not null and (
             coalesce((select access_token_digest from locked) = $2, false)
             or coalesce((select previous_access_token_digest from locked) = $2, false)
           ) then $2 else c.access_token_digest end,
           previous_access_token_digest = null, previous_access_token_expires_at = null,
           desired_release_id = null, pending_release_id = null, updated_at = $5
         where c.id = $1 and c.status in ('provisioned', 'active')
           and (select error from verdict) is null
         returning c.*
       ), invalidated as (
         delete from connected_editor_sessions
         where connection_id = $1 and (select error from verdict) is null returning digest
       ) select jsonb_build_object(
         'error', (select error from verdict),
         'alreadyRevoked', coalesce((select status = 'revoked' from locked), false),
         'invalidatedSessions', (select count(*) from invalidated),
         'connection', coalesce(
           (select to_jsonb(c) from changed c),
           (select to_jsonb(c) from locked c where (select error from verdict) is null)
         )
       ) as result`,
      [input.id, input.accessTokenDigest || null, input.refreshTokenDigest || null,
        input.idempotencyKey, input.now]
    );
    const raw = rows[0]?.result;
    const result = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw;
    const error = result?.error as ConnectionRevocationResult extends { ok: false; error: infer E } ? E : never;
    if (error) return { ok: false, error };
    const connection = result?.connection as unknown as ConnectionRow | null;
    if (!connection) return { ok: false, error: 'unauthorized' };
    return {
      ok: true, connection: toConnection(connection), alreadyRevoked: result?.alreadyRevoked === true
    };
  }
  async setPendingRelease(id: string, releaseId: string | null) {
    const { rows } = await this.db.query<ConnectionRow>(
      `update wordpress_connections set pending_release_id = $2, updated_at = now()
       where id = $1 and status = 'active' returning *`, [id, releaseId]);
    return rows[0] ? toConnection(rows[0]) : null;
  }

  async putGrant(input: Omit<ConnectedGrant, 'usedAt' | 'createdAt'>) {
    const { rows } = await this.db.query<GrantRow>(
      `insert into connected_one_time_grants (
         digest, kind, site_id, connection_id, payload, expires_at
       ) values ($1,$2,$3,$4,$5,$6) returning *`,
      [input.digest, input.kind, input.siteId, input.connectionId, JSON.stringify(input.payload), input.expiresAt]
    );
    return toGrant(rows[0]);
  }

  async consumeGrant(digest: string, kind: ConnectedGrantKind, now: string) {
    const { rows } = await this.db.query<GrantRow>(
      `update connected_one_time_grants set used_at = $3
       where digest = $1 and kind = $2 and used_at is null and expires_at > $3 returning *`,
      [digest, kind, now]
    );
    return rows[0] ? toGrant(rows[0]) : null;
  }

  async putEditorCredential(input: Omit<ConnectedEditorCredential, 'createdAt'>) {
    const { rows } = await this.db.query<EditorCredentialRow>(
      `insert into connected_editor_sessions (
         digest, connection_id, site_id, owner_id, expires_at
       ) values ($1,$2,$3,$4,$5) returning *`,
      [input.digest, input.connectionId, input.siteId, input.ownerId, input.expiresAt]
    );
    return toEditorCredential(rows[0]);
  }

  async editorCredential(digest: string, now: string) {
    const { rows } = await this.db.query<EditorCredentialRow>(
      `select session.* from connected_editor_sessions session
       join wordpress_connections connection on connection.id = session.connection_id
       where session.digest = $1 and session.expires_at > $2
         and connection.status = 'active' limit 1`,
      [digest, now]
    );
    return rows[0] ? toEditorCredential(rows[0]) : null;
  }

  async replaceWordPressContentIndex(input: WordPressContentIndexSnapshot): Promise<WordPressContentIndexResult> {
    const acquired = this.db.connect ? await this.db.connect() : null;
    const client = acquired || this.db;
    try {
      await client.query('begin');
      /* The connection row is the lifecycle fence used by revoke and snapshot writers alike.
         It also serializes two first snapshots, avoiding the visibility edge where ON CONFLICT
         can observe a row that the command's earlier read snapshot cannot yet select. */
      const connection = await client.query<{ status: WordPressConnection['status'] }>(
        'select status from wordpress_connections where id = $1 for update', [input.connectionId]);
      if (!connection.rows[0]) {
        await client.query('commit');
        return { ok: false, error: 'unknown-connection' };
      }
      if (connection.rows[0].status !== 'active') {
        await client.query('commit');
        return { ok: false, error: 'connection-inactive' };
      }
      const current = await client.query<WordPressContentIndexRow>(
        'select * from wordpress_content_indexes where connection_id = $1 for update',
        [input.connectionId]);
      const existing = current.rows[0];
      if (existing && input.generation < Number(existing.generation)) {
        await client.query('commit');
        return { ok: false, error: 'stale-generation' };
      }
      if (existing && input.generation === Number(existing.generation)) {
        await client.query('commit');
        if (input.bodyHash !== existing.body_hash) return { ok: false, error: 'generation-conflict' };
        return { ok: true, snapshot: toWordPressContentIndex(existing), duplicate: true };
      }
      const changed = await client.query<WordPressContentIndexRow>(
        `insert into wordpress_content_indexes (connection_id, generation, body_hash, items, synced_at)
         values ($1,$2,$3,$4,$5)
         on conflict (connection_id) do update set generation = excluded.generation,
           body_hash = excluded.body_hash, items = excluded.items, synced_at = excluded.synced_at
         returning *`,
        [input.connectionId, input.generation, input.bodyHash, JSON.stringify(input.items), input.syncedAt]
      );
      await client.query('commit');
      return { ok: true, snapshot: toWordPressContentIndex(changed.rows[0]), duplicate: false };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      acquired?.release?.();
    }
  }

  async wordpressContentIndexesForSite(siteId: string) {
    const { rows } = await this.db.query<WordPressContentIndexRow>(
      `select idx.* from wordpress_content_indexes idx
       join wordpress_connections connection on connection.id = idx.connection_id
       where connection.site_id = $1 and connection.status = 'active'
       order by connection.environment, idx.connection_id`, [siteId]
    );
    return rows.map(toWordPressContentIndex);
  }

  async reserveRelease(input: Omit<ReleaseReservation,
    'sequence' | 'parentReleaseId' | 'createdAt' | 'completedAt'>) {
    const acquired = this.db.connect ? await this.db.connect() : null;
    const client = acquired || this.db;
    try {
      await client.query('begin');
      const site = await client.query<{ id: string; published_release_id: string | null }>(
        'select id, published_release_id from sites where id = $1 for update', [input.siteId]);
      if (!site.rows[0]) throw new Error('site does not exist');
      const existing = await client.query<ReleaseReservationRow & { publication_status: string | null }>(
        `select r.*, p.status as publication_status from site_release_reservations r
         left join site_release_publications p on p.release_id = r.release_id
         where r.site_id = $1 and r.idempotency_key = $2 limit 1`,
        [input.siteId, input.idempotencyKey]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].publication_status === 'aborted') {
          throw new Error('idempotency key belongs to an abandoned release; use a new key');
        }
        await client.query('commit');
        return toReleaseReservation(existing.rows[0]);
      }
      const unbuilt = await client.query<ReleaseReservationRow>(
        `select r.* from site_release_reservations r
         left join site_release_publications p on p.release_id = r.release_id
         where r.site_id = $1 and p.release_id is null
         order by r.sequence desc limit 1 for update of r`,
        [input.siteId]
      );
      if (unbuilt.rows[0]) {
        const age = Date.now() - new Date(unbuilt.rows[0].created_at).getTime();
        if (age < 5 * 60 * 1000) {
          throw new Error('another release is still being finalized; retry shortly');
        }
        const built = await client.query<{ id: string }>(
          'select id from site_releases where id = $1 limit 1', [unbuilt.rows[0].release_id]);
        if (!built.rows[0]) {
          const reclaimed = await client.query<ReleaseReservationRow>(
            `update site_release_reservations
             set idempotency_key = $2, created_by = $3, created_at = now(), completed_at = null
             where site_id = $1 and release_id = $4 returning *`,
            [input.siteId, input.idempotencyKey, input.createdBy, unbuilt.rows[0].release_id]
          );
          await client.query('commit');
          return toReleaseReservation(reclaimed.rows[0]);
        }
        const status = site.rows[0].published_release_id === unbuilt.rows[0].release_id
          ? 'published' : 'aborted';
        await client.query(
          `insert into site_release_publications (release_id, site_id, status, finalized_at)
           values ($1,$2,$3,now()) on conflict (release_id) do nothing`,
          [unbuilt.rows[0].release_id, input.siteId, status]
        );
      }
      const counter = await client.query<{ sequence: number }>(
        `insert into site_release_counters (site_id, next_sequence) values ($1, 2)
         on conflict (site_id) do update
         set next_sequence = site_release_counters.next_sequence + 1
         returning next_sequence - 1 as sequence`,
        [input.siteId]
      );
      const parent = await client.query<{ release_id: string }>(
        `select r.id as release_id from site_releases r
         join site_release_publications p on p.release_id = r.id and p.status = 'published'
         where r.site_id = $1 order by r.sequence desc limit 1`,
        [input.siteId]
      );
      const made = await client.query<ReleaseReservationRow>(
        `insert into site_release_reservations (
           site_id, idempotency_key, release_id, sequence, parent_release_id, created_by
         ) values ($1,$2,$3,$4,$5,$6) returning *`,
        [input.siteId, input.idempotencyKey, input.releaseId, counter.rows[0].sequence,
          parent.rows[0]?.release_id || null, input.createdBy]
      );
      await client.query('commit');
      return toReleaseReservation(made.rows[0]);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      acquired?.release?.();
    }
  }

  async createRelease(release: SiteRelease) {
    const reserved = await this.db.query<ReleaseReservationRow>(
      'select * from site_release_reservations where site_id = $1 and idempotency_key = $2',
      [release.siteId, release.idempotencyKey]
    );
    const reservation = reserved.rows[0] ? toReleaseReservation(reserved.rows[0]) : null;
    if (!reservation || reservation.releaseId !== release.id || reservation.sequence !== release.sequence
      || reservation.parentReleaseId !== release.parentReleaseId || reservation.createdBy !== release.createdBy) {
      throw new Error('release does not match its durable sequence reservation');
    }
    const { rows } = await this.db.query<ReleaseRow>(
      `with eligible as materialized (
         select 1 from site_release_reservations
         where site_id = $2 and idempotency_key = $21 and release_id = $1
           and sequence = $3 and parent_release_id is not distinct from $6
           and created_by = $22 and completed_at is null
         for update
       ), made as (
         insert into site_releases (
           id, site_id, sequence, source_version, schema_version, parent_release_id,
           artifact_hash, artifact_bytes, artifact, hosted_files, manifest, manifest_hash, signature, key_id,
           files, pages, cms, assets, scripts, audit, idempotency_key, created_by, created_at
         ) select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
           from eligible
         on conflict (site_id, idempotency_key) do nothing returning *
       ), recorded_assets as (
         insert into release_assets (release_id, asset_id, path, mime, bytes, hash, width, height)
         select made.id, item.id, item.path, item.mime, item.bytes, item.hash, item.width, item.height
         from made, jsonb_to_recordset($24::jsonb) as item(
           id text, path text, mime text, bytes integer, hash text, width integer, height integer
         ) returning release_id
       ), completed as (
         update site_release_reservations r set completed_at = now()
         from made where r.release_id = made.id returning r.release_id
       ) select made.* from made`,
      [release.id, release.siteId, release.sequence, release.sourceVersion, release.schemaVersion,
        release.parentReleaseId, release.artifactHash, release.artifactBytes, release.artifact,
        JSON.stringify(release.hostedFiles), release.manifest, release.manifestHash, release.signature, release.keyId,
        JSON.stringify(release.files), JSON.stringify(release.pages), JSON.stringify(release.cms),
        JSON.stringify(release.assets), JSON.stringify(release.scripts), JSON.stringify(release.audit),
        release.idempotencyKey, release.createdBy, release.createdAt, JSON.stringify(release.assets)]
    );
    if (rows[0]) return { release: toRelease(rows[0]), created: true };
    const existing = await this.db.query<ReleaseRow>(
      'select * from site_releases where site_id = $1 and idempotency_key = $2',
      [release.siteId, release.idempotencyKey]);
    if (!existing.rows[0]) throw new Error('release id or sequence already exists');
    return { release: toRelease(existing.rows[0]), created: false };
  }
  async release(id: string) {
    const { rows } = await this.db.query<ReleaseRow>('select * from site_releases where id = $1', [id]);
    return rows[0] ? toRelease(rows[0]) : null;
  }
  async commitReleasePublication(input: {
    siteId: string; releaseId: string; sourceVersion: number; releaseSequence: number; publishedAt: string;
  }, _publishHosted: () => Promise<{ publishedVersion: number; publishedReleaseId: string | null } | null>) {
    const { rows } = await this.db.query<{
      published_version: number; published_release_id: string | null;
    }>(
      `with locked as materialized (
         select * from sites where id = $1 for update
       ), eligible as materialized (
         select release.id, release.site_id, release.source_version, release.sequence
         from site_releases release join locked site on site.id = release.site_id
         join site_revisions revision on revision.site_id = release.site_id
           and revision.version = release.source_version
         left join site_release_publications publication on publication.release_id = release.id
         where release.id = $2 and release.site_id = $1 and release.source_version = $3
           and release.sequence = $4 and publication.status is distinct from 'aborted'
       ), changed as materialized (
         update sites site set published_version = eligible.source_version,
           published_release_id = eligible.id, published_release_sequence = eligible.sequence,
           updated_at = $5
         from eligible where site.id = eligible.site_id
           and (site.published_release_sequence < eligible.sequence
             or (site.published_release_sequence = eligible.sequence
               and (site.published_release_id is null or site.published_release_id = eligible.id)))
         returning site.id, site.published_version, site.published_release_id
       ), finalized as (
         insert into site_release_publications (release_id, site_id, status, finalized_at)
         select eligible.id, eligible.site_id, 'published', $5 from eligible
         join changed on changed.id = eligible.site_id
         on conflict (release_id) do nothing returning status
       ), marker as materialized (
         select status from finalized union all
         select publication.status from site_release_publications publication, eligible
         where publication.release_id = eligible.id and not exists (select 1 from finalized)
       ), effective as materialized (
         select changed.published_version, changed.published_release_id from changed
         union all
         select locked.published_version, locked.published_release_id from locked
         where not exists (select 1 from changed)
       ) select effective.published_version, effective.published_release_id from effective
         where exists (select 1 from eligible)
           and (not exists (select 1 from changed)
             or (select status from marker limit 1) = 'published')`,
      [input.siteId, input.releaseId, input.sourceVersion, input.releaseSequence, input.publishedAt]
    );
    return rows[0] ? {
      publishedVersion: rows[0].published_version,
      publishedReleaseId: rows[0].published_release_id
    } : null;
  }
  async markReleasePublished(releaseId: string, publishedAt: string) {
    const { rows } = await this.db.query<{ status: string }>(
      `with release as materialized (
         select release.id, release.site_id from site_releases release
         join sites site on site.id = release.site_id and site.published_release_id = release.id
         where release.id = $1 for update of site
       ), made as (
         insert into site_release_publications (release_id, site_id, status, finalized_at)
         select id, site_id, 'published', $2 from release
         on conflict (release_id) do nothing returning status
       ) select status from made union all
         select status from site_release_publications where release_id = $1
           and not exists (select 1 from made) limit 1`,
      [releaseId, publishedAt]
    );
    return rows[0]?.status === 'published';
  }
  async releasesForSite(siteId: string) {
    const { rows } = await this.db.query<ReleaseSummaryRow>(
      `select ${RELEASE_SUMMARY_COLUMNS} from site_releases r
       join site_release_publications publication
         on publication.release_id = r.id and publication.status = 'published'
       where r.site_id = $1 order by r.sequence desc`, [siteId]);
    return rows.map(toReleaseSummary);
  }
  async createTarget(target: ReleaseTarget, desired: boolean) {
    const attachExisting = async (existing: ReleaseTarget) => {
      const attached = await this.db.query<{ id: string }>(
        `update wordpress_connections set
           desired_release_id = case when $3 then $2 else desired_release_id end,
           pending_release_id = case when $3 and pending_release_id = $2 then null else pending_release_id end,
           updated_at = case when $3 then now() else updated_at end
         where id = $1 and status = 'active'
           and exists (select 1 from site_release_publications
             where release_id = $2 and status = 'published')
           and (not $3 or ($4 > last_acknowledged_sequence
             and active_release_id is distinct from $2))
           and (not $3 or desired_release_id is null or desired_release_id = $2)
           and (not $3 or active_release_id is null or exists (
             select 1 from site_releases candidate join site_releases active
               on active.id = wordpress_connections.active_release_id
             where candidate.id = $2 and active.sequence < candidate.sequence
           )) returning id`,
        [target.connectionId, target.releaseId, desired, existing.sequence]
      );
      if (!attached.rows[0]) {
        const current = await this.connection(target.connectionId);
        if (current?.status === 'active' && desired
          && (existing.sequence <= current.lastAcknowledgedSequence
            || current.activeReleaseId === target.releaseId)) {
          return { target: existing, created: false };
        }
        throw new Error('another release is already desired or the connection is inactive');
      }
      return { target: existing, created: false };
    };
    const old = await this.target(target.connectionId, target.releaseId);
    if (old) return attachExisting(old);
    const { rows } = await this.db.query<TargetRow>(
      `with eligible as (
         select c.id from wordpress_connections c join site_releases r on r.site_id = c.site_id
         left join site_releases active on active.id = c.active_release_id
         join site_release_publications publication
           on publication.release_id = r.id and publication.status = 'published'
         where c.id = $2 and r.id = $1 and c.status = 'active' and c.next_sequence = $3
           and (c.active_release_id is null
             or (active.id is not null and active.sequence < r.sequence))
         for update of c
       ), inserted as (
         insert into release_targets (release_id, connection_id, sequence, envelope, signature, key_id, created_at)
         select $1, id, $3, $4, $5, $6, $7 from eligible
         on conflict do nothing returning *
       ), advanced as (
         update wordpress_connections c set next_sequence = next_sequence + 1,
           desired_release_id = case when $8 then $1 else desired_release_id end,
           pending_release_id = case
             when $8 and pending_release_id = $1 then null else pending_release_id end,
           updated_at = now()
         where c.id = $2 and exists (select 1 from inserted) returning c.id
       ) select i.* from inserted i, advanced a`,
      [target.releaseId, target.connectionId, target.sequence, target.envelope, target.signature,
        target.keyId, target.createdAt, desired]
    );
    if (!rows[0]) {
      /* Another worker may have issued this exact target while this statement waited on the
         connection lock. Recover the immutable row instead of turning harmless convergence
         into a failed Publish response. */
      const existing = await this.target(target.connectionId, target.releaseId);
      if (existing) return attachExisting(existing);
      throw new Error('release target is not eligible or sequence is not next');
    }
    return { target: toTarget(rows[0]), created: true };
  }
  async target(connectionId: string, releaseId: string) {
    const { rows } = await this.db.query<TargetRow>(
      'select * from release_targets where connection_id = $1 and release_id = $2', [connectionId, releaseId]);
    return rows[0] ? toTarget(rows[0]) : null;
  }
  async desiredTarget(connectionId: string) {
    const { rows } = await this.db.query<ConnectionRow & ReleaseSummaryRow & TargetRow>(
      `select
         c.*, r.id as release_row_id, r.site_id as release_site_id, r.sequence as release_sequence,
         r.source_version, r.schema_version, r.parent_release_id, r.artifact_hash, r.artifact_bytes,
         r.manifest as release_manifest, r.manifest_hash, r.signature as release_signature,
         r.key_id as release_key_id, r.files, r.pages, r.cms, r.assets, r.scripts, r.audit,
         r.idempotency_key as release_idempotency_key, r.created_by, r.created_at as release_created_at,
         t.release_id as target_release_id, t.connection_id as target_connection_id,
         t.sequence as target_sequence, t.envelope, t.signature as target_signature,
         t.key_id as target_key_id,
         t.created_at as target_created_at
       from wordpress_connections c
       join site_releases r on r.id = c.desired_release_id
       join site_release_publications publication
         on publication.release_id = r.id and publication.status = 'published'
       join release_targets t on t.release_id = r.id and t.connection_id = c.id
       where c.id = $1 and c.status = 'active'`, [connectionId]);
    const row = rows[0] as unknown as Record<string, unknown> | undefined;
    if (!row) return null;
    const release: ReleaseSummaryRow = {
      id: String(row.release_row_id), site_id: String(row.release_site_id),
      sequence: Number(row.release_sequence), source_version: Number(row.source_version),
      schema_version: Number(row.schema_version), parent_release_id: row.parent_release_id as string | null,
      artifact_hash: String(row.artifact_hash), artifact_bytes: Number(row.artifact_bytes),
      files: row.files as SiteRelease['files'],
      manifest: String(row.release_manifest), manifest_hash: String(row.manifest_hash),
      signature: String(row.release_signature), key_id: String(row.release_key_id),
      pages: row.pages as SiteRelease['pages'], cms: row.cms as SiteRelease['cms'],
      assets: row.assets as SiteRelease['assets'], scripts: row.scripts as SiteRelease['scripts'],
      audit: row.audit as SiteRelease['audit'], idempotency_key: String(row.release_idempotency_key),
      created_by: String(row.created_by), created_at: row.release_created_at as Date | string
    };
    const target: TargetRow = {
      release_id: String(row.target_release_id), connection_id: String(row.target_connection_id),
      sequence: Number(row.target_sequence), envelope: String(row.envelope),
      signature: String(row.target_signature), key_id: String(row.target_key_id),
      created_at: row.target_created_at as Date | string
    };
    return { connection: toConnection(rows[0]), release: toReleaseSummary(release), target: toTarget(target) };
  }
  async deploymentsForRelease(releaseId: string) {
    const { rows } = await this.db.query<DeploymentRow>(
      'select * from deployments where release_id = $1 order by created_at', [releaseId]);
    return rows.map(toDeployment);
  }
  async recordDeployment(input: Omit<Deployment, 'id' | 'createdAt'>): Promise<DeploymentResult> {
    /* One statement owns the connection-row lock from validation through pointer advancement.
       Pool.query may choose a different client for each call, so a BEGIN spread across calls
       would be illusory. This CTE is safe for both pg.Pool and the PGlite test adapter. */
    const id = crypto.randomUUID(), createdAt = new Date().toISOString();
    const { rows } = await this.db.query<{ result: Record<string, unknown> | string }>(
      `with locked as materialized (
         select * from wordpress_connections where id = $2 for update
       ), duplicate as materialized (
         select deployment.* from deployments deployment, locked
         where deployment.connection_id = $2 and deployment.idempotency_key = $9 limit 1
       ), release_target as materialized (
         select r.site_id, r.artifact_hash, t.sequence
         from site_releases r join release_targets t on t.release_id = r.id and t.connection_id = $2
         where r.id = $3
       ), rollback_release as materialized (
         select r.id, r.artifact_hash from site_releases r
         join site_release_publications publication
           on publication.release_id = r.id and publication.status = 'published'
         join locked connection on connection.site_id = r.site_id
         where $5 = 'rolled_back' and $6::text is not null and r.artifact_hash = $6::text limit 1
       ), prior as materialized (
         select status from deployments
         where connection_id = $2 and release_id = $3 and sequence = $4
         order by created_at desc limit 1
       ), verdict as materialized (
         select case
           when not exists(select 1 from locked) then 'unknown-target'
           when (select status from locked) <> 'active' then 'connection-inactive'
           when exists(select 1 from duplicate) and (select body_hash from duplicate) <> $10
             then 'idempotency-conflict'
           when exists(select 1 from duplicate) then null
           when not exists(select 1 from release_target)
             or (select site_id from release_target) <> (select site_id from locked) then 'unknown-target'
           when $4 <> (select sequence from release_target) then 'wrong-sequence'
           when $4 < (select last_acknowledged_sequence from locked) then 'replay'
           when $5 = 'live' and $6::text is distinct from (select artifact_hash from release_target) then 'wrong-hash'
           when $5 = 'rolled_back' and not exists(select 1 from rollback_release) then 'wrong-hash'
           when not (
             (not exists(select 1 from prior) and $5 = 'queued')
             or ((select status from prior) = 'queued' and $5 in ('downloading','failed'))
             or ((select status from prior) = 'downloading' and $5 in ('staged','failed'))
             or ((select status from prior) = 'staged' and $5 in ('needs_approval','activating','failed'))
             or ((select status from prior) = 'needs_approval' and $5 in ('activating','failed'))
             or ((select status from prior) = 'activating' and $5 in ('verifying','failed','rolled_back'))
             or ((select status from prior) = 'verifying' and $5 in ('live','failed','rolled_back'))
             or ((select status from prior) = 'live' and $5 = 'rolled_back')
             or ((select status from prior) = 'failed' and $5 = 'rolled_back')
           ) then 'status-conflict'
           else null
         end as error
       ), inserted as (
         insert into deployments (
           id, connection_id, release_id, sequence, status, active_hash, error, detail,
           idempotency_key, body_hash, created_at
         ) select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
         where (select error from verdict) is null and not exists(select 1 from duplicate)
         returning *
       ), advanced as (
         update wordpress_connections c set
           last_acknowledged_sequence = case when $5 = 'live' then $4 else last_acknowledged_sequence end,
           active_release_id = case
             when $5 = 'live' then $3
             when $5 = 'rolled_back' then (select id from rollback_release)
             else active_release_id end,
           active_hash = case
             when $5 = 'live' then $6::text
             when $5 = 'rolled_back' then (select artifact_hash from rollback_release)
             else active_hash end,
           desired_release_id = case
             when $5 in ('live','failed','rolled_back') and desired_release_id = $3
               then null else desired_release_id end,
           pending_release_id = case
             when $5 in ('live','failed','rolled_back') and pending_release_id = $3
               then null else pending_release_id end,
           updated_at = $11
         where c.id = $2 and c.status = 'active' and exists(select 1 from inserted) returning c.id
       ), promotion as (
         update wordpress_connections production set pending_release_id = $3, updated_at = $11
         from locked staging
         where exists(select 1 from inserted) and $5 = 'live'
           and staging.environment = 'staging'
           and production.site_id = staging.site_id and production.environment = 'production'
           and production.status = 'active' and production.active_release_id is distinct from $3
           and (production.active_release_id is null
             or (select sequence from site_releases where id = production.active_release_id)
               < (select sequence from site_releases where id = $3))
           and (production.pending_release_id is null or production.pending_release_id = $3
             or (select sequence from site_releases where id = production.pending_release_id)
               <= (select sequence from site_releases where id = $3))
         returning production.id
       )
       select jsonb_build_object(
         'error', (select error from verdict),
         'duplicate', exists(select 1 from duplicate),
         'deployment', coalesce((select to_jsonb(d) from duplicate d), (select to_jsonb(i) from inserted i))
       ) as result`,
      [id, input.connectionId, input.releaseId, input.sequence, input.status,
        input.activeHash, input.error, JSON.stringify(input.detail), input.idempotencyKey,
        input.bodyHash, createdAt]
    );
    const raw = rows[0]?.result;
    const result = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw;
    const error = result?.error as DeploymentResult['error'] | null | undefined;
    if (error) return { ok: false, error };
    const deployment = result?.deployment as unknown as DeploymentRow | null;
    if (!deployment) return { ok: false, error: 'status-conflict' };
    return {
      ok: true, duplicate: result?.duplicate === true, deployment: toDeployment(deployment),
      connection: (await this.connection(input.connectionId)) || undefined
    };
  }

  async enqueueWebhook(input: Omit<WebhookOutboxEvent,
    'attempts' | 'nextAttemptAt' | 'lockedAt' | 'lockedBy' | 'deliveredAt' | 'lastError' | 'createdAt'>) {
    const { rows } = await this.db.query<WebhookRow>(
      `insert into wordpress_webhook_outbox (
         event_id, connection_id, release_id, target_sequence, webhook_url, payload,
         body_hash, signature, key_id
       ) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
       on conflict (connection_id, release_id) do nothing returning *`,
      [input.eventId, input.connectionId, input.releaseId, input.targetSequence, input.webhookUrl,
        input.payload, input.bodyHash, input.signature, input.keyId]
    );
    if (rows[0]) return toWebhook(rows[0]);
    const existing = await this.db.query<WebhookRow>(
      'select * from wordpress_webhook_outbox where connection_id = $1 and release_id = $2',
      [input.connectionId, input.releaseId]
    );
    if (!existing.rows[0] || existing.rows[0].body_hash !== input.bodyHash) throw new Error('webhook idempotency conflict');
    return toWebhook(existing.rows[0]);
  }

  async claimWebhooks(worker: string, limit: number) {
    const { rows } = await this.db.query<WebhookRow>(
      `with claim as (
         select event_id from wordpress_webhook_outbox
         where delivered_at is null and next_attempt_at <= now()
           and (locked_at is null or locked_at < now() - interval '5 minutes')
         order by next_attempt_at, created_at for update skip locked limit $2
       ) update wordpress_webhook_outbox o
       set locked_at = now(), locked_by = $1, attempts = attempts + 1
       from claim where o.event_id = claim.event_id returning o.*`,
      [worker, Math.max(1, Math.min(limit, 100))]
    );
    return rows.map(toWebhook);
  }

  async settleWebhook(eventId: string, delivered: boolean, nextAttemptAt: string, error?: string) {
    await this.db.query(
      `update wordpress_webhook_outbox set locked_at = null, locked_by = null,
         delivered_at = case when $2 then now() else delivered_at end,
         next_attempt_at = $3, last_error = $4 where event_id = $1`,
      [eventId, delivered, nextAttemptAt, error ? error.slice(0, 2000) : null]
    );
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
  w: number; h: number; bytes: Uint8Array | null;
  owner_id: string | null; storage_path: string | null;
  stored_bytes: number | string | null; original_bytes: number | string | null;
  content_hash: string | null; optimized: boolean;
}

type AssetMetaRow = Omit<AssetRow, 'bytes'>;

const toAsset = (r: AssetRow): Asset => ({
  id: r.id, siteId: r.site_id, name: r.name, type: r.type,
  w: r.w, h: r.h,
  bytes: r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes || []),
  ownerId: r.owner_id || undefined,
  storedBytes: r.stored_bytes == null ? undefined : Number(r.stored_bytes),
  originalBytes: r.original_bytes == null ? undefined : Number(r.original_bytes),
  contentHash: r.content_hash || undefined,
  optimized: r.optimized
});

const toAssetRecord = (r: AssetMetaRow): AssetRecord => ({
  id: r.id, siteId: r.site_id, name: r.name, type: r.type, w: r.w, h: r.h,
  ownerId: r.owner_id || undefined,
  storedBytes: r.stored_bytes == null ? undefined : Number(r.stored_bytes),
  originalBytes: r.original_bytes == null ? undefined : Number(r.original_bytes),
  contentHash: r.content_hash || undefined,
  optimized: r.optimized
});

export class PgAssetStore implements AssetStore {
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }

  async init() {
    for (const stmt of statements(ASSET_SCHEMA)) await this.db.query(stmt);
  }

  async list(siteId: string) {
    const { rows } = await this.db.query<AssetMetaRow>(
      `select id, site_id, name, type, w, h, owner_id, storage_path,
              stored_bytes, original_bytes, content_hash, optimized
       from assets where site_id = $1 order by name`, [siteId]);
    return rows.map(toAssetRecord);
  }

  async get(siteId: string, id: string) {
    const { rows } = await this.db.query<AssetRow>('select * from assets where site_id = $1 and id = $2', [siteId, id]);
    return rows[0] ? toAsset(rows[0]) : null;
  }

  /** By the path a rendered page asks for. The name is sanitised into the path by `assetFile`,
      so the comparison has to happen on the sanitised form rather than in SQL. */
  async byPath(siteId: string, path: string) {
    for (const a of await this.list(siteId)) {
      if (metaOf(a).path === path || legacyAssetPath(a) === path) return this.get(siteId, a.id);
    }
    return null;
  }

  async put(a: Omit<Asset, 'id'> & { id?: string }, quota?: AssetQuota) {
    const id = a.id || 'a' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('begin');
      if (quota) {
        const owner = await client.query<{ id: string }>('select id from users where id = $1 for update', [quota.ownerId]);
        if (!owner.rows[0]) throw new Error('storage owner does not exist');
        const current = await client.query<{ used: string }>(
          `select coalesce(sum(stored_bytes),0)::text as used from assets where owner_id = $1`, [quota.ownerId]);
        const prior = await client.query<{ bytes: string }>(
          `select coalesce(stored_bytes,0)::text as bytes from assets where id = $1 and owner_id = $2`, [id, quota.ownerId]);
        const used = Number(current.rows[0]?.used || 0), replacing = Number(prior.rows[0]?.bytes || 0);
        if (used - replacing + a.bytes.byteLength > quota.limitBytes) {
          throw new AssetQuotaError({ usedBytes: used, limitBytes: quota.limitBytes });
        }
      }
      const { rows } = await client.query<AssetMetaRow>(
        `insert into assets (
           id, site_id, owner_id, name, type, w, h, bytes,
           stored_bytes, original_bytes, content_hash, optimized
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (id) do update set
           name = excluded.name, type = excluded.type, w = excluded.w, h = excluded.h,
           bytes = excluded.bytes, owner_id = excluded.owner_id,
           stored_bytes = excluded.stored_bytes, original_bytes = excluded.original_bytes,
           content_hash = excluded.content_hash, optimized = excluded.optimized
         returning id, site_id, name, type, w, h, owner_id, storage_path,
                   stored_bytes, original_bytes, content_hash, optimized`,
        [id, a.siteId, quota?.ownerId || null, a.name, a.type, a.w, a.h, a.bytes,
          a.bytes.byteLength, quota?.originalBytes ?? a.bytes.byteLength,
          a.contentHash || null, quota?.optimized || false]
      );
      await client.query('commit');
      return toAssetRecord(rows[0]);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') client.release();
    }
  }

  async putConnected(
    a: Omit<Asset, 'id'> & { id: string }, connectionId: string,
    _active?: () => Promise<boolean>, quota?: AssetQuota
  ) {
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('begin');
      const guard = await client.query<{ created_by: string }>(
        `select created_by from wordpress_connections
         where id = $1 and site_id = $2 and status = 'active'
           and access_token_expires_at > now() for update`, [connectionId, a.siteId]);
      if (!guard.rows[0]) {
        await client.query('rollback');
        return null;
      }
      const ownerId = quota?.ownerId || guard.rows[0].created_by;
      if (quota) {
        const owner = await client.query<{ id: string }>('select id from users where id = $1 for update', [ownerId]);
        if (!owner.rows[0]) throw new Error('storage owner does not exist');
        const current = await client.query<{ used: string }>(
          `select coalesce(sum(stored_bytes),0)::text as used from assets where owner_id = $1`, [ownerId]);
        const prior = await client.query<{ bytes: string }>(
          `select coalesce(stored_bytes,0)::text as bytes from assets where id = $1 and owner_id = $2`, [a.id, ownerId]);
        const used = Number(current.rows[0]?.used || 0), replacing = Number(prior.rows[0]?.bytes || 0);
        if (used - replacing + a.bytes.byteLength > quota.limitBytes) {
          throw new AssetQuotaError({ usedBytes: used, limitBytes: quota.limitBytes });
        }
      }
      const { rows } = await client.query<AssetMetaRow>(
        `insert into assets (id, site_id, owner_id, name, type, w, h, bytes,
           stored_bytes, original_bytes, content_hash, optimized)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (id) do update set id = assets.id
         where assets.site_id = excluded.site_id and assets.name = excluded.name
           and assets.type = excluded.type and assets.w = excluded.w and assets.h = excluded.h
           and assets.bytes = excluded.bytes
         returning assets.id, assets.site_id, assets.name, assets.type, assets.w, assets.h,
           assets.owner_id, assets.storage_path, assets.stored_bytes, assets.original_bytes,
           assets.content_hash, assets.optimized`,
        [a.id, a.siteId, ownerId, a.name, a.type, a.w, a.h, a.bytes,
          a.bytes.byteLength, quota?.originalBytes ?? a.bytes.byteLength,
          a.contentHash || null, quota?.optimized || false]
      );
      await client.query('commit');
      return rows[0] ? toAssetRecord(rows[0]) : null;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') client.release();
    }
  }

  async remove(siteId: string, id: string) {
    const { rows } = await this.db.query<{ id: string }>(
      'delete from assets where site_id = $1 and id = $2 returning id', [siteId, id]);
    return rows.length > 0;
  }

  async usage(ownerId: string, limitBytes = FREE_STORAGE_BYTES) {
    const { rows } = await this.db.query<{ used: string }>(
      `select coalesce(sum(stored_bytes),0)::text as used from assets where owner_id = $1`, [ownerId]);
    return { usedBytes: Number(rows[0]?.used || 0), limitBytes };
  }
}


/* --------------------------------------------------------------------- auth */

interface UserRow {
  id: string; email: string; name: string; auth_user_id?: string | null;
  plan?: 'free'; created_at?: Date | string;
}
interface SessionRow { digest: string; user_id: string; expires_at: Date | string }
interface MemberRow { site_id: string; user_id: string; role: Role }
interface AccessRow extends UserRow { role: Role | null }

const ms = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v).getTime();

export class PgAuthStore implements AuthStore {
  private db: Queryable;
  constructor(db: Queryable) { this.db = db; }

  async init() {
    for (const stmt of statements(AUTH_SCHEMA)) await this.db.query(stmt);
  }

  async userByEmail(email: string) {
    const { rows } = await this.db.query<UserRow>('select * from users where email = $1', [normalEmail(email)]);
    return rows[0] ? this.user(rows[0]) : null;
  }
  async userById(id: string) {
    const { rows } = await this.db.query<UserRow>('select * from users where id = $1', [id]);
    return rows[0] ? this.user(rows[0]) : null;
  }
  async userByAuthId(authUserId: string) {
    const { rows } = await this.db.query<UserRow>(
      'select * from users where auth_user_id = $1', [authUserId]);
    return rows[0] ? this.user(rows[0]) : null;
  }
  async ensureAuthUser(authUserId: string, email: string, name = '') {
    const normalized = normalEmail(email);
    const existing = await this.db.query<UserRow>(
      `update users set
         email = $2,
         name = case when name = '' then $3 else name end
       where auth_user_id = $1 returning *`,
      [authUserId, normalized, name.trim()]
    );
    if (existing.rows[0]) return this.user(existing.rows[0]);
    const { rows } = await this.db.query<UserRow>(
      `insert into users (id, email, name, auth_user_id) values ($1, $2, $3, $4)
       on conflict (email) do update set
         auth_user_id = excluded.auth_user_id,
         name = case when users.name = '' then excluded.name else users.name end
       where users.auth_user_id is null or users.auth_user_id = excluded.auth_user_id
       returning *`,
      [crypto.randomUUID(), normalized, name.trim(), authUserId]
    );
    if (!rows[0]) throw new Error('that email is already linked to another identity');
    return this.user(rows[0]);
  }
  async updateProfile(userId: string, input: { name: string }) {
    const { rows } = await this.db.query<UserRow>(
      'update users set name = $2 where id = $1 returning *', [userId, input.name.trim()]);
    return rows[0] ? this.user(rows[0]) : null;
  }
  async usersByIds(ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    const { rows } = await this.db.query<UserRow>(
      'select id, email, name, auth_user_id from users where id = any($1::text[])', [unique]);
    return rows.map(row => this.user(row));
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
    return this.user(rows[0]);
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
  async userForSession(digest: string) {
    const { rows } = await this.db.query<UserRow>(
      `select u.id, u.email, u.name, u.auth_user_id
       from sessions s join users u on u.id = s.user_id
       where s.digest = $1 and s.expires_at > now()`, [digest]);
    if (rows[0]) return this.user(rows[0]);
    /* Opportunistic cleanup for an expired token. Unknown tokens make this harmless no-op. */
    await this.db.query('delete from sessions where digest = $1 and expires_at <= now()', [digest]);
    return null;
  }
  async accessForSession(digest: string, siteId: string) {
    const { rows } = await this.db.query<AccessRow>(
      `select u.id, u.email, u.name, u.auth_user_id, m.role
       from sessions s
       join users u on u.id = s.user_id
       left join site_users m on m.user_id = u.id and m.site_id = $2
       where s.digest = $1 and s.expires_at > now()`, [digest, siteId]);
    if (rows[0]) {
      const { role, ...row } = rows[0];
      return { user: this.user(row), role };
    }
    await this.db.query('delete from sessions where digest = $1 and expires_at <= now()', [digest]);
    return null;
  }
  async dropSession(digest: string) {
    await this.db.query('delete from sessions where digest = $1', [digest]);
  }

  async membership(siteId: string, userId: string) {
    const { rows } = await this.db.query<MemberRow>(
      'select * from site_users where site_id = $1 and user_id = $2', [siteId, userId]);
    return rows[0] ? { siteId: rows[0].site_id, userId: rows[0].user_id, role: rows[0].role } : null;
  }
  async membershipsForUser(userId: string) {
    const { rows } = await this.db.query<MemberRow>('select * from site_users where user_id = $1', [userId]);
    return rows.map(r => ({ siteId: r.site_id, userId: r.user_id, role: r.role }));
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
      `select m.site_id, m.user_id, m.role, u.email, u.name, u.auth_user_id
       from site_users m join users u on u.id = m.user_id
       where m.site_id = $1 order by u.email`, [siteId]);
    return rows.map(r => ({
      siteId: r.site_id, userId: r.user_id, role: r.role, email: r.email, name: r.name,
      authUserId: r.auth_user_id ?? null
    }));
  }
  async revoke(siteId: string, userId: string) {
    const { rows } = await this.db.query<{ user_id: string }>(
      'delete from site_users where site_id = $1 and user_id = $2 returning user_id', [siteId, userId]);
    return rows.length > 0;
  }
  async changeMemberRole(siteId: string, userId: string, role: Role): Promise<MemberChangeResult> {
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('begin');
      await client.query('select id from sites where id = $1 for update', [siteId]);
      const current = await client.query<MemberRow>(
        'select * from site_users where site_id = $1 and user_id = $2', [siteId, userId]);
      if (!current.rows[0]) { await client.query('rollback'); return { status: 'missing' }; }
      if (current.rows[0].role === 'owner' && role !== 'owner') {
        const owners = await client.query<{ count: string }>(
          `select count(*)::text as count from site_users where site_id = $1 and role = 'owner'`, [siteId]);
        if (Number(owners.rows[0]?.count || 0) <= 1) {
          await client.query('rollback');
          return { status: 'last_owner' };
        }
      }
      const changed = await client.query<MemberRow>(
        'update site_users set role = $3 where site_id = $1 and user_id = $2 returning *',
        [siteId, userId, role]);
      await client.query('commit');
      const row = changed.rows[0];
      return { status: 'updated', membership: { siteId: row.site_id, userId: row.user_id, role: row.role } };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') client.release();
    }
  }
  async removeMember(siteId: string, userId: string): Promise<MemberRemovalResult> {
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('begin');
      await client.query('select id from sites where id = $1 for update', [siteId]);
      const current = await client.query<MemberRow>(
        'select * from site_users where site_id = $1 and user_id = $2', [siteId, userId]);
      if (!current.rows[0]) { await client.query('rollback'); return { status: 'missing' }; }
      if (current.rows[0].role === 'owner') {
        const owners = await client.query<{ count: string }>(
          `select count(*)::text as count from site_users where site_id = $1 and role = 'owner'`, [siteId]);
        if (Number(owners.rows[0]?.count || 0) <= 1) {
          await client.query('rollback');
          return { status: 'last_owner' };
        }
      }
      await client.query('delete from site_users where site_id = $1 and user_id = $2', [siteId, userId]);
      await client.query(
        `delete from collaborator_invitation_outbox
         where site_id = $1 and user_id = $2 and delivered_at is null`, [siteId, userId]);
      await client.query('commit');
      return { status: 'removed' };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') client.release();
    }
  }
  async provisionInvitation(input: {
    siteId: string; actorUserId: string; email: string; role: Role; redirectTo: string;
  }): Promise<InvitationProvisionResult> {
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('begin');
      await client.query('select id from sites where id = $1 for update', [input.siteId]);
      const actor = await client.query<MemberRow>(
        'select * from site_users where site_id = $1 and user_id = $2', [input.siteId, input.actorUserId]);
      if (actor.rows[0]?.role !== 'owner') { await client.query('rollback'); return { status: 'forbidden' }; }
      const created = await client.query<UserRow>(
        `insert into users (id, email, name) values ($1, $2, '')
         on conflict (email) do update set email = excluded.email returning *`,
        [crypto.randomUUID(), normalEmail(input.email)]);
      const user = this.user(created.rows[0]);
      const current = await client.query<MemberRow>(
        'select * from site_users where site_id = $1 and user_id = $2', [input.siteId, user.id]);
      if (current.rows[0]?.role === 'owner' && input.role !== 'owner') {
        const owners = await client.query<{ count: string }>(
          `select count(*)::text as count from site_users where site_id = $1 and role = 'owner'`, [input.siteId]);
        if (Number(owners.rows[0]?.count || 0) <= 1) {
          await client.query('rollback'); return { status: 'last_owner' };
        }
      }
      const membershipRows = await client.query<MemberRow>(
        `insert into site_users (site_id, user_id, role) values ($1, $2, $3)
         on conflict (site_id, user_id) do update set role = excluded.role returning *`,
        [input.siteId, user.id, input.role]);
      if (!user.authUserId) {
        await client.query(
          `insert into collaborator_invitation_outbox (id, site_id, user_id, email, redirect_to)
           values ($1, $2, $3, $4, $5)
           on conflict (site_id, user_id) where delivered_at is null do update set
             email = excluded.email, redirect_to = excluded.redirect_to,
             next_attempt_at = least(collaborator_invitation_outbox.next_attempt_at, now()),
             locked_at = null, locked_by = null`,
          [crypto.randomUUID(), input.siteId, user.id, user.email, input.redirectTo]);
      }
      await client.query('commit');
      const row = membershipRows.rows[0];
      return {
        status: 'granted', user,
        membership: { siteId: row.site_id, userId: row.user_id, role: row.role },
        queued: !user.authUserId
      };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') client.release();
    }
  }
  async drainInvitationOutbox(_worker: string, _limit = 10): Promise<InvitationDrainResult> {
    /* Direct-Postgres deployments do not possess Supabase's service credential. The durable
       work remains queued until a privileged gateway worker drains it. */
    return { processed: 0, delivered: 0, pending: 0 };
  }
  async inviteEmail(_email: string, _redirectTo: string): Promise<InviteDeliveryResult> {
    return 'unavailable';
  }

  private user(row: UserRow): User {
    return {
      id: row.id, email: row.email, name: row.name,
      authUserId: row.auth_user_id ?? null,
      plan: row.plan || 'free',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined
    };
  }
  async createManualImportCredential(input: Omit<ManualImportCredential,
    'status' | 'createdAt' | 'updatedAt' | 'revokedAt'>) {
    const { rows } = await this.db.query<{
      id:string; owner_id:string; installation_id:string; access_token_digest:string;
      access_expires_at:Date|string; refresh_token_digest:string; status:'active'|'revoked';
      created_at:Date|string; updated_at:Date|string; revoked_at:Date|string|null;
    }>(`insert into wordpress_import_credentials (
        id, owner_id, installation_id, access_token_digest, access_expires_at, refresh_token_digest
      ) values ($1, $2, $3, $4, $5, $6)
      on conflict (owner_id, installation_id) do update set
        access_token_digest = excluded.access_token_digest,
        access_expires_at = excluded.access_expires_at,
        refresh_token_digest = excluded.refresh_token_digest,
        status = 'active', revoked_at = null, updated_at = now()
      returning *`, [
      input.id, input.ownerId, input.installationId, input.accessTokenDigest,
      new Date(input.accessExpiresAt).toISOString(), input.refreshTokenDigest
    ]);
    return this.manualCredential(rows[0]);
  }
  async manualImportByAccess(digest: string) {
    const { rows } = await this.db.query<any>(
      `select * from wordpress_import_credentials
       where access_token_digest = $1 and status = 'active' and access_expires_at > now() limit 1`, [digest]);
    return rows[0] ? this.manualCredential(rows[0]) : null;
  }
  async manualImportByRefresh(digest: string) {
    const { rows } = await this.db.query<any>(
      `select * from wordpress_import_credentials
       where refresh_token_digest = $1 and status = 'active' limit 1`, [digest]);
    return rows[0] ? this.manualCredential(rows[0]) : null;
  }
  async rotateManualImportAccess(id: string, digest: string, expiresAt: number) {
    const { rows } = await this.db.query<any>(
      `update wordpress_import_credentials set access_token_digest = $2, access_expires_at = $3, updated_at = now()
       where id = $1 and status = 'active' returning *`, [id, digest, new Date(expiresAt).toISOString()]);
    return rows[0] ? this.manualCredential(rows[0]) : null;
  }
  async revokeManualImportCredential(id: string, refreshDigest: string) {
    const { rows } = await this.db.query<{ id:string }>(
      `update wordpress_import_credentials set status = 'revoked', revoked_at = coalesce(revoked_at, now()), updated_at = now()
       where id = $1 and refresh_token_digest = $2 returning id`, [id, refreshDigest]);
    return rows.length > 0;
  }
  private manualCredential(row: any): ManualImportCredential {
    return {
      id: row.id, ownerId: row.owner_id, installationId: row.installation_id,
      accessTokenDigest: row.access_token_digest, accessExpiresAt: ms(row.access_expires_at),
      refreshTokenDigest: row.refresh_token_digest, status: row.status,
      createdAt: ms(row.created_at), updatedAt: ms(row.updated_at),
      revokedAt: row.revoked_at ? ms(row.revoked_at) : null
    };
  }
  /** Sessions a revoked person still holds are harmless — access is checked per request
      against `site_users`, so a membership that is gone is access that is gone. */
  async sessionsOf(userId: string) {
    const { rows } = await this.db.query<{ digest: string }>(
      'select digest from sessions where user_id = $1', [userId]);
    return rows.map(r => r.digest);
  }
}
