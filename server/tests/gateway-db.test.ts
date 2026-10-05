/* The Supabase gateway function itself, run in Node against PGlite with every migration applied.

   The function is Deno code: its `npm:`/`jsr:` imports are replaced with a postgres.js-shaped
   adapter over PGlite and an in-memory Storage bucket, and `Deno.serve` hands over the handler.
   What PGlite cannot show is concurrency: it is one connection, so lock order is asserted from
   the statements the gateway sends rather than from two transactions racing. */
import { afterAll, beforeAll, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { splitGatewayBlob } from '../src/gateway-blobs.ts';
import { GatewayStore, PagecraftGateway } from '../src/store-gateway.ts';

type Query = (text: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
type Handler = (request: Request) => Promise<Response>;

const harness = vi.hoisted(() => ({
  sql: null as unknown,
  handler: null as null | ((request: Request) => Promise<Response>),
  statements: [] as string[],
  failWhen: null as RegExp | null,
  files: new Map<string, Uint8Array>(),
}));

vi.mock('jsr:@supabase/functions-js@2.111.0/edge-runtime.d.ts', () => ({}));
vi.mock('npm:postgres@3.4.7', () => ({ default: () => harness.sql }));
vi.mock('npm:@supabase/supabase-js@2.112.4', () => ({
  createClient: () => ({
    auth: { admin: { inviteUserByEmail: async () => ({ error: null }) } },
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Uint8Array) => {
          if (harness.files.has(path)) return { data: null, error: { message: 'The resource already exists' } };
          harness.files.set(path, bytes);
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) harness.files.delete(path);
          return { data: [], error: null };
        },
        download: async (path: string) => harness.files.has(path)
          ? { data: new Blob([harness.files.get(path)! as BlobPart]), error: null }
          : { data: null, error: { message: 'Object not found' } },
      }),
    },
  }),
}));

/** postgres.js errors carry snake_case fields and the name PostgresError; PGlite's do not. */
class PostgresError extends Error {
  constructor(fields: Record<string, unknown>) {
    super(String(fields.message));
    this.name = 'PostgresError';
    Object.assign(this, fields);
  }
}
const asPostgresError = (error: unknown) => {
  const e = error as Record<string, unknown>;
  return typeof e?.severity === 'string' ? new PostgresError({
    message: e.message, severity: e.severity, code: e.code, detail: e.detail,
    constraint_name: e.constraint, table_name: e.table, schema_name: e.schema,
  }) : error;
};

/** The slice of postgres.js the gateway uses: tagged queries, `sql(list)`, json, array, begin. */
function postgresShape(query: Query): unknown {
  const tag = (strings: TemplateStringsArray | unknown[], ...values: unknown[]) => {
    if (!('raw' in strings)) return { list: strings };
    let text = strings[0];
    const params: unknown[] = [];
    values.forEach((value, index) => {
      const list = (value as { list?: unknown[] } | null)?.list;
      if (list) text += `(${list.map(item => `$${params.push(item)}`).join(', ')})`;
      else text += `$${params.push((value as { json?: unknown } | null)?.json ?? value)}`;
      text += strings[index + 1];
    });
    harness.statements.push(text.replace(/\s+/g, ' ').trim());
    if (harness.failWhen?.test(text)) {
      return Promise.reject(new PostgresError({
        message: 'could not serialize access due to concurrent update', severity: 'ERROR',
        code: '40001', detail: 'Key (secret_column)=(private-value) is locked.',
      }));
    }
    return query(text, params).then(result => result.rows, error => { throw asPostgresError(error); });
  };
  return Object.assign(tag, {
    json: (value: unknown) => ({ json: value }),
    array: (value: unknown[]) => value,
    begin: (work: (transaction: unknown) => Promise<unknown>) =>
      db.transaction((tx: Transaction) => work(postgresShape((text, params) => tx.query(text, params)))),
  });
}

const KEY = 'gateway-test-key';
const hex = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const H = (n: number) => String(n).repeat(64).slice(0, 64);
let db: PGlite;
let handler: Handler;

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);`);
  const migrations = join(import.meta.dirname, '../../supabase/migrations');
  for (const name of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrations, name), 'utf8'));
  }
  await db.query(`insert into gateway_config (id, secret_hash) values ('primary', $1)`, [hex(KEY)]);
  harness.sql = postgresShape((text, params) => db.query(text, params));
  const env: Record<string, string> = {
    SUPABASE_DB_URL: 'postgres://gateway.test/postgres',
    SUPABASE_URL: 'http://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  };
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (name: string) => env[name] },
    serve: (serve: Handler) => { handler = serve; },
  };
  // A computed specifier keeps tsc out of the Deno module; Vitest still applies the mocks.
  const gatewayModule = '../../supabase/functions/pagecraft-db/index.ts';
  await import(/* @vite-ignore */ gatewayModule);
  a.ok(handler, 'the gateway registered its handler');
});

afterAll(async () => {
  delete (globalThis as { Deno?: unknown }).Deno;
  await db?.close();
});

const call = async (op: string, args: Record<string, unknown>, key = KEY) => {
  const response = await handler(new Request('http://gateway.test/functions/v1/pagecraft-db', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pagecraft-gateway-key': key },
    body: JSON.stringify({ op, args }),
  }));
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};
const client = () => new PagecraftGateway('http://gateway.test', KEY,
  (async (url: string | URL | Request, init?: RequestInit) => handler(new Request(url, init))) as typeof fetch);
const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(`select count(*)::integer as n from (${sql}) rows`, params)).rows[0].n);

const doc = { schemaVersion: 1, meta: {}, header: [], footer: [], pages: [] };
async function siteWithOwner(siteId: string, userId: string) {
  await db.query(`insert into users (id, email) values ($1, $2) on conflict do nothing`, [userId, `${userId}@example.test`]);
  await db.query(`insert into sites (id, host, slug, name, doc) values ($1, $2, $1, $1, $3)`,
    [siteId, `${siteId}.example.test`, doc]);
  await db.query(`insert into site_users (site_id, user_id, role) values ($1, $2, 'owner')`, [siteId, userId]);
}

/** A site paired with WordPress and published once: every table that refers to it has a row. */
async function connectedSite(siteId: string, userId: string) {
  await siteWithOwner(siteId, userId);
  const release = `${siteId}-release`, connection = `${siteId}-staging`, publication = randomUUID();
  await db.exec(`
    insert into site_revisions (site_id, version, doc) values ('${siteId}', 1, '{"schemaVersion":1}');
    insert into wordpress_connections (id, site_id, created_by, installation_id, environment, profile,
      target_origin, target_path, redirect_uri, webhook_url, scopes, status, code_challenge,
      authorization_code_digest, authorization_code_expires_at, confirmed_at)
    values ('${connection}', '${siteId}', '${userId}', '${siteId}-install', 'staging', 'existing-theme',
      'https://${siteId}.wp.test', '/', 'https://${siteId}.wp.test/wp-admin', 'https://${siteId}.wp.test/wp-json',
      '[]', 'active', 'challenge', '${siteId}-code', now(), now());
    insert into site_release_reservations (site_id, idempotency_key, release_id, sequence, created_by)
    values ('${siteId}', 'publish-1', '${release}', 1, '${userId}');
    insert into site_releases (id, site_id, sequence, source_version, schema_version, artifact_hash,
      artifact_bytes, artifact, hosted_files, manifest, manifest_hash, signature, key_id, files, pages,
      cms, assets, scripts, audit, idempotency_key, created_by, created_at)
    values ('${release}', '${siteId}', 1, 1, 1, '${H(1)}', 1, '\\x00', '[]', 'manifest', '${H(2)}',
      'signature', 'key-1', '[]', '[]', '{}', '[]', '[]', '{}', 'publish-1', '${userId}', now());
    insert into release_assets (release_id, asset_id, path, mime, bytes, hash, width, height)
    values ('${release}', 'asset-1', 'assets/a.webp', 'image/webp', 3, '${H(3)}', 1, 1);
    insert into release_targets (release_id, connection_id, sequence, envelope, signature, key_id, created_at)
    values ('${release}', '${connection}', 1, 'envelope', 'signature', 'key-1', now());
    insert into deployments (id, connection_id, release_id, sequence, status, idempotency_key, body_hash)
    values ('${siteId}-deployment', '${connection}', '${release}', 1, 'live', 'ack-1', '${H(4)}');
    insert into wordpress_webhook_outbox (event_id, connection_id, release_id, target_sequence, webhook_url,
      payload, body_hash, signature, key_id)
    values ('${siteId}-event', '${connection}', '${release}', 1, 'https://${siteId}.wp.test/wp-json', '{}',
      '${H(5)}', 'signature', 'key-1');
    insert into site_release_publications (release_id, site_id, status, finalized_at)
    values ('${release}', '${siteId}', 'published', now());
    insert into connected_editor_sessions (digest, connection_id, site_id, owner_id, expires_at)
    values ('${hex(siteId + 'session')}', '${connection}', '${siteId}', '${userId}', now());
    insert into hosted_publications (id, site_id, source_version, content_hash, storage_key, created_by, created_at)
    values ('${publication}', '${siteId}', 1, '${H(6)}', 'key', '${userId}', now());
    update sites set published_release_id = '${release}', published_publication_id = '${publication}'
    where id = '${siteId}';
    update wordpress_connections set active_release_id = '${release}' where id = '${connection}';
    insert into assets (id, site_id, name, type, w, h, owner_id, storage_path, stored_bytes)
    values ('${siteId}-asset', '${siteId}', 'a.webp', 'image/webp', 1, 1, '${userId}', '${userId}/${siteId}/a.webp', 3);
  `);
  harness.files.set(`${userId}/${siteId}/a.webp`, new Uint8Array([1, 2, 3]));
}

const SITE_TABLES = [
  'sites:id', 'site_users:site_id', 'site_revisions:site_id', 'assets:site_id', 'wordpress_connections:site_id',
  'site_release_reservations:site_id', 'site_releases:site_id', 'site_release_publications:site_id',
  'connected_editor_sessions:site_id', 'hosted_publications:site_id',
];
const rowsFor = async (siteId: string) => {
  const out: Record<string, number> = {};
  for (const entry of SITE_TABLES) {
    const [table, column] = entry.split(':');
    out[table] = await count(`select 1 from ${table} where ${column} = $1`, [siteId]);
  }
  const release = `${siteId}-release`;
  for (const table of ['release_assets', 'release_targets', 'deployments', 'wordpress_webhook_outbox']) {
    out[table] = await count(`select 1 from ${table} where release_id = $1`, [release]);
  }
  return out;
};

test('a bogus gateway key is refused from memory, without a query against the pool', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    const start = Date.now() + 24 * 60 * 60_000;
    vi.setSystemTime(start);
    a.equal((await call('site.listMeta', {})).status, 200, 'a stale cache loads the configured key');

    harness.statements.length = 0;
    const burst = await Promise.all(Array.from({ length: 25 }, (_, n) => call('site.listMeta', {}, `junk-${n}`)));
    a.deepEqual([...new Set(burst.map(reply => reply.status))], [401]);
    a.deepEqual(harness.statements, [], 'a key just loaded is not reloaded for junk');

    vi.setSystemTime(start + 11_000);
    const later = await Promise.all(Array.from({ length: 25 }, (_, n) => call('site.listMeta', {}, `junk-${n}`)));
    a.deepEqual([...new Set(later.map(reply => reply.status))], [401]);
    a.equal(harness.statements.length, 1, 'a mismatch refreshes once per ten seconds, however many arrive');

    // A rotated key is picked up by the next mismatch refresh, not a minute later.
    await db.query(`update gateway_config set secret_hash = $1`, [hex('rotated-key')]);
    vi.setSystemTime(start + 22_000);
    a.equal((await call('site.listMeta', {}, 'rotated-key')).status, 200);
    harness.statements.length = 0;
    a.equal((await call('site.listMeta', {}, KEY)).status, 401);
    a.deepEqual(harness.statements, [], 'the old key is refused without asking the database');

    await db.query(`update gateway_config set secret_hash = $1`, [hex(KEY)]);
    vi.setSystemTime(start + 33_000);
    a.equal((await call('site.listMeta', {})).status, 200);
  } finally {
    vi.useRealTimers();
  }
});

test('deleting a WordPress-connected site removes its release history with it, and nothing else', async () => {
  await connectedSite('doomed', 'owner-1');
  await connectedSite('kept', 'owner-2');
  a.ok(Object.values(await rowsFor('doomed')).every(n => n > 0), 'the fixture fills every dependent table');
  const kept = await rowsFor('kept');

  a.equal(await new GatewayStore(client()).delete('doomed'), true);

  a.ok(Object.values(await rowsFor('doomed')).every(n => n === 0), JSON.stringify(await rowsFor('doomed')));
  a.deepEqual(await rowsFor('kept'), kept);
  a.equal(harness.files.has('owner-1/doomed/a.webp'), false, 'stored media goes after the commit');
  a.equal(harness.files.has('owner-2/kept/a.webp'), true);
  // `set local` ended with the transaction: release rows are immutable again.
  a.equal((await db.query<{ role: string }>(`select current_setting('session_replication_role') as role`)).rows[0].role, 'origin');
  await a.rejects(db.query(`delete from site_releases where site_id = 'kept'`), /immutable/);
  a.equal(await new GatewayStore(client()).delete('doomed'), false, 'a second delete finds nothing');
});

test('a failed site delete rolls back as a whole and keeps the stored media', async () => {
  await connectedSite('survivor', 'owner-3');
  const before = await rowsFor('survivor');
  harness.failWhen = /delete from sites/;
  try {
    const reply = await call('site.delete', { id: 'survivor' });
    a.equal(reply.status, 500);
  } finally {
    harness.failWhen = null;
  }
  a.deepEqual(await rowsFor('survivor'), before);
  a.equal(harness.files.has('owner-3/survivor/a.webp'), true);
});

const webp = (marker: number) => {
  const bytes = new Uint8Array(64).fill(marker);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  return bytes;
};
async function stage(bytes: Uint8Array) {
  const split = splitGatewayBlob(bytes);
  for (const chunk of split.chunks) {
    a.equal((await call('asset.blob.putChunk', { blob: split.descriptor, chunk })).status, 200);
  }
  return split.descriptor;
}

test('a failed asset upload never removes a file it did not write, and hides the database text', async () => {
  await siteWithOwner('media', 'owner-4');
  const bytes = webp(7);
  const asset = {
    id: 'media-photo', siteId: 'media', name: 'Photo.webp', type: 'image/webp', w: 8, h: 8,
    ownerId: 'owner-4', contentHash: hex(bytes), blob: await stage(bytes),
  };
  const first = await call('asset.putBlob', { asset });
  a.equal(first.status, 200, JSON.stringify(first.body));
  const path = String((first.body.data as { storage_path: string }).storage_path);
  a.ok(harness.files.has(path));

  // Renaming re-sends the same bytes: same path, so Storage answers "already exists".
  harness.failWhen = /insert into assets/;
  let failed;
  try {
    failed = await call('asset.putBlob', { asset: { ...asset, name: 'Renamed.webp' } });
  } finally {
    harness.failWhen = null;
  }
  a.equal(failed.status, 500);
  a.ok(harness.files.has(path), 'the live asset still has its file');
  a.deepEqual(failed.body, { error: 'database operation failed', code: 'DATABASE_ERROR' });
});

test('a library upload fences on the owner row before the library row, like site uploads', async () => {
  await siteWithOwner('library-site', 'owner-5');
  const libraryId = randomUUID();
  a.equal((await call('library.create', { id: libraryId, ownerId: 'owner-5', name: 'Kit' })).status, 200);
  const upload = async (marker: number, limitBytes: number) => {
    const bytes = webp(marker);
    return call('library.asset.putBlob', {
      libraryId, ownerId: 'owner-5', limitBytes, id: hex(bytes), name: `kit-${marker}.webp`,
      type: 'image/webp', w: 8, h: 8, blob: await stage(bytes),
    });
  };
  harness.statements.length = 0;
  a.equal((await upload(1, 1000)).status, 200);
  const locks = harness.statements.filter(text => /for update/.test(text));
  a.match(locks[0], /from users where id = \$1 for update/);
  a.match(locks[1], /from libraries where id = \$1::uuid for update/);
  const userLock = harness.statements.indexOf(locks[0]);
  a.ok(userLock < harness.statements.findIndex(text => /sum\(stored_bytes\)/.test(text)),
    'the quota is read under the owner lock');

  // 64 bytes used of 160: one more fits, two do not. PGlite serializes these, so this checks the
  // outcome rather than the race; the lock assertion above is what closes the race in Postgres.
  const raced = await Promise.all([upload(2, 160), upload(3, 160)]);
  a.deepEqual(raced.map(reply => reply.status).sort(), [200, 409]);
  a.equal(raced.find(reply => reply.status === 409)!.body.code, 'STORAGE_LIMIT');
});

test('database errors reach the caller as a stable code, with only a unique constraint name', async () => {
  await siteWithOwner('taken', 'owner-6');
  const duplicate = await call('site.create', {
    id: 'other', host: 'other.example.test', slug: 'taken', name: 'Other', doc,
  });
  a.equal(duplicate.status, 409);
  a.deepEqual(duplicate.body, {
    error: 'duplicate key value violates unique constraint "sites_slug_key"', code: '23505',
  });

  const invalid = await call('site.create', {
    id: 'broken', host: 'broken.example.test', slug: 'broken', name: 'Broken', doc: { ...doc, schemaVersion: 0 },
  });
  a.equal(invalid.status, 500);
  a.deepEqual(invalid.body, { error: 'database operation failed', code: 'DATABASE_ERROR' });

  // The gateway's own refusals keep their words: the server matches some of them.
  const unknown = await call('no.such.op', {});
  a.deepEqual(unknown, { status: 400, body: { error: 'unknown gateway operation', code: 'UNKNOWN_OPERATION' } });
});
