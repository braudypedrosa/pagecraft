/* The Supabase gateway function itself, run in Node against PGlite with every migration applied.

   The function is Deno code: its `npm:`/`jsr:` imports are replaced with a postgres.js-shaped
   adapter over PGlite and an in-memory Storage bucket, and `Deno.serve` hands over the handler.
   What PGlite cannot show is concurrency: it is one connection, so lock order is asserted from
   the statements the gateway sends rather than from two transactions racing. */
import { afterAll, beforeAll, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { splitGatewayBlob } from '../src/gateway-blobs.ts';
import { GatewayStore, PagecraftGateway } from '../src/store-gateway.ts';
import { GatewayFounderCrmStore } from '../src/founder-crm-store.ts';
import { FREE_PLAN, PRO_PLAN } from '../../supabase/functions/pagecraft-db/plan-entitlements.ts';

type Query = (text: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
type Handler = (request: Request) => Promise<Response>;

const harness = vi.hoisted(() => ({
  sql: null as unknown,
  handler: null as null | ((request: Request) => Promise<Response>),
  statements: [] as string[],
  failWhen: null as RegExp | null,
  failOnceWhen: null as RegExp | null,
  afterQuery: null as null | ((text: string) => Promise<void>),
  postgresOptions: null as null | Record<string, unknown>,
  files: new Map<string, Uint8Array>(),
  removeError: null as null | { message: string },
  removeCalls: [] as string[][],
  deletedAuthUsers: [] as string[],
  deleteUserError: null as null | { message: string },
  afterUpload: null as null | ((path: string) => Promise<void> | void),
}));

vi.mock('jsr:@supabase/functions-js@2.111.0/edge-runtime.d.ts', () => ({}));
vi.mock('npm:postgres@3.4.7', () => ({
  default: (_url: string, options: Record<string, unknown>) => {
    harness.postgresOptions = options;
    return harness.sql;
  },
}));
vi.mock('npm:@supabase/supabase-js@2.112.4', () => ({
  createClient: () => ({
    auth: { admin: {
      inviteUserByEmail: async () => ({ error: null }),
      deleteUser: async (id: string) => {
        if (harness.deleteUserError) return { data: null, error: harness.deleteUserError };
        harness.deletedAuthUsers.push(id);
        return { data: {}, error: null };
      },
    } },
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Uint8Array) => {
          harness.statements.push(`storage.upload ${path}`);
          const existed = harness.files.has(path);
          if (!existed) harness.files.set(path, bytes);
          const after = harness.afterUpload;
          harness.afterUpload = null;
          await after?.(path);
          return existed
            ? { data: null, error: { message: 'The resource already exists' } }
            : { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          harness.removeCalls.push(paths);
          if (harness.removeError) return { data: null, error: harness.removeError };
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
    if (harness.failOnceWhen?.test(text)) {
      harness.failOnceWhen = null;
      return Promise.reject(new PostgresError({
        message: 'remaining connection slots are reserved for roles with the SUPERUSER attribute',
        severity: 'FATAL', code: '53300',
      }));
    }
    if (harness.failWhen?.test(text)) {
      return Promise.reject(new PostgresError({
        message: 'could not serialize access due to concurrent update', severity: 'ERROR',
        code: '40001', detail: 'Key (secret_column)=(private-value) is locked.',
      }));
    }
    return query(text, params).then(async result => {
      await harness.afterQuery?.(text);
      return result.rows;
    }, error => { throw asPostgresError(error); });
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

const operation = async (op: string, args: Record<string, unknown>) => {
  const response = await call(op, args);
  return { status: response.status, body: response.body.data as any };
};

test('an Edge isolate owns one connection and retries only its idempotent key lookup', async () => {
  a.deepEqual(harness.postgresOptions, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  harness.statements.length = 0;
  harness.failOnceWhen = /select secret_hash from gateway_config/;
  const response = await call('site.listMeta', {});
  a.equal(response.status, 200, JSON.stringify(response.body));
  a.equal(
    harness.statements.filter(statement =>
      statement.includes('select secret_hash from gateway_config')
    ).length,
    2,
    'a transient slot refusal retries the read once before any operation is dispatched',
  );
});

test('consent gateway keeps library and owner access pending until the exact recipient accepts', async () => {
  const siteId = 'consent-site', ownerId = 'consent-owner', recipientId = 'consent-recipient';
  await siteWithOwner(siteId, ownerId);
  await db.query(`insert into users (id, email) values ($1, $2)`, [recipientId, 'consent-recipient@example.test']);
  const invited = await operation('collaboration.invite', { kind: 'site_owner', resourceId: siteId, recipientId, invitedBy: ownerId });
  a.equal(invited.status, 200, JSON.stringify(invited.body));
  a.equal(invited.body.status, 'pending');
  const invitationId = (invited.body.invitation as { id: string }).id;
  a.equal(await count(`select * from site_users where site_id=$1 and user_id=$2`, [siteId, recipientId]), 0);
  a.equal((await operation('collaboration.decide', { id: invitationId, userId: ownerId, accept: true })).body, 'missing');
  a.equal((await operation('collaboration.decide', { id: invitationId, userId: recipientId, accept: true })).body, 'accepted');
  a.equal(await count(`select * from site_users where site_id=$1 and user_id=$2 and role='owner'`, [siteId, recipientId]), 1);
  a.equal((await operation('collaboration.decide', { id: invitationId, userId: recipientId, accept: true })).body, 'missing');

  const libraryId = randomUUID();
  await operation('library.create', { id: libraryId, ownerId, name: 'Consent library' });
  const pending = await operation('collaboration.invite', { kind: 'library', resourceId: libraryId, recipientId, invitedBy: ownerId });
  a.equal((await operation('library.getFor', { id: libraryId, userId: recipientId })).body, null);
  const libraryInvitationId = (pending.body.invitation as { id: string }).id;
  a.equal((await operation('collaboration.listForUser', { userId: recipientId })).body.length, 1);
  a.equal((await operation('collaboration.decide', { id: libraryInvitationId, userId: recipientId, accept: false })).body, 'declined');
  a.equal(await count(`select * from library_members where library_id=$1`, [libraryId]), 0);
});

test('resource deletion removes pending consent and its tables are inaccessible to client roles', async () => {
  await siteWithOwner('consent-delete', 'consent-delete-owner');
  await operation('collaboration.invite', { kind: 'site_owner', resourceId: 'consent-delete', recipientId: 'consent-recipient', invitedBy: 'consent-delete-owner' });
  await db.query(`delete from sites where id=$1`, ['consent-delete']);
  a.equal(await count(`select * from collaboration_invitations where resource_id='consent-delete'`), 0);
  for (const table of ['collaboration_invitations', 'wordpress_import_used_refresh_tokens']) {
    for (const role of ['anon', 'authenticated']) {
      const permissions = await db.query<{ allowed: boolean }>(`select has_table_privilege($1, $2, 'SELECT') as allowed`, [role, table]);
      a.equal(permissions.rows[0].allowed, false);
    }
    const security = await db.query<{ enabled: boolean }>(`select relrowsecurity as enabled from pg_class where oid=$1::regclass`, [table]);
    a.equal(security.rows[0].enabled, true);
  }
});

test('manual import gateway revokes a replayed token family and preserves legacy calls', async () => {
  const input = { id: 'replay-credential', ownerId: 'consent-owner', installationId: 'replay-wordpress', siteUrl: 'https://wordpress.example.test/subdirectory/', accessTokenDigest: hex('replay-access-1'), accessExpiresAt: new Date(Date.now()+900000).toISOString(), refreshTokenDigest: hex('replay-refresh-1') };
  const created = await operation('auth.manualImport.create', { input });
  a.equal(created.status, 200, JSON.stringify(created.body));
  a.equal(created.body.site_url, input.siteUrl);
  const exchanged = await operation('auth.manualImport.exchangeRefresh', { presentedDigest: input.refreshTokenDigest, nextAccessDigest: hex('replay-access-2'), nextAccessExpiresAt: input.accessExpiresAt, nextRefreshDigest: hex('replay-refresh-2') });
  a.equal(exchanged.body.status, 'rotated');
  a.equal((await operation('auth.manualImport.exchangeRefresh', { presentedDigest: hex('unknown-refresh'), nextAccessDigest: hex('unknown-access'), nextAccessExpiresAt: input.accessExpiresAt, nextRefreshDigest: hex('unknown-next') })).body.status, 'invalid');
  a.equal((await operation('auth.manualImport.byAccess', { digest: hex('replay-access-2') })).body.id, input.id);
  const replay = await operation('auth.manualImport.exchangeRefresh', { presentedDigest: input.refreshTokenDigest, nextAccessDigest: hex('replay-access-3'), nextAccessExpiresAt: input.accessExpiresAt, nextRefreshDigest: hex('replay-refresh-3') });
  a.equal(replay.body.status, 'reused');
  a.equal((await operation('auth.manualImport.byAccess', { digest: hex('replay-access-2') })).body, null);
  a.equal((await operation('auth.manualImport.byRefresh', { digest: hex('replay-refresh-2') })).body, null);
  await operation('auth.manualImport.create', { input: { ...input, accessTokenDigest: hex('repaired-access'), refreshTokenDigest: hex('repaired-refresh'), siteUrl: undefined } });
  a.equal((await operation('auth.manualImport.exchangeRefresh', { presentedDigest: input.refreshTokenDigest, nextAccessDigest: hex('old-family-access'), nextAccessExpiresAt: input.accessExpiresAt, nextRefreshDigest: hex('old-family-refresh') })).body.status, 'invalid');
  a.equal((await operation('auth.manualImport.rotate', { id: input.id, digest: hex('legacy-access'), expiresAt: input.accessExpiresAt })).body.refresh_token_digest, hex('repaired-refresh'));
  a.equal((await operation('auth.manualImport.byAccess', { digest: hex('legacy-access') })).body.site_url, null);
});
async function siteWithOwner(siteId: string, userId: string) {
  await db.query(`insert into users (id, email) values ($1, $2) on conflict do nothing`, [userId, `${userId}@example.test`]);
  await db.query(`insert into sites (id, host, slug, name, doc) values ($1, $2, $1, $1, $3)`,
    [siteId, `${siteId}.example.test`, doc]);
  await db.query(`insert into site_users (site_id, user_id, role) values ($1, $2, 'owner')`, [siteId, userId]);
}

test('proposal save commits owner provenance with the exact revision and retains ordinary content saves', async () => {
  const siteId = 'proposal-revision', ownerId = 'proposal-owner', editorId = 'proposal-editor';
  await siteWithOwner(siteId, ownerId);
  await siteWithOwner('other-proposal-site', ownerId);
  await db.query('update users set auth_user_id=$1 where id=$2', ['auth-proposal-owner', ownerId]);
  await db.query('insert into users (id, email, auth_user_id) values ($1, $2, $3)',
    [editorId, `${editorId}@example.test`, 'auth-proposal-editor']);
  await db.query("insert into site_users (site_id, user_id, role) values ($1, $2, 'content')", [siteId, editorId]);

  const storeAsset = (id: string, site: string, retired: boolean) => db.query(`
    insert into assets (id, site_id, name, type, bytes, retired) values ($1, $2, $3, 'image/png', $4, $5)`,
    [id, site, 'Workshop.png', new Uint8Array([1]), retired]);
  await storeAsset('proposal-workshop', siteId, false);
  await storeAsset('proposal-workshop-retired', siteId, true);
  await storeAsset('proposal-workshop-other', 'other-proposal-site', false);

  const proposal = { id: 'a'.repeat(16), attemptId: 'b'.repeat(32), assetIds: ['proposal-workshop'] };
  const owner = { newUserId: 'unused-owner-id', authUserId: 'auth-proposal-owner', email: `${ownerId}@example.test`, name: 'Owner' };
  const editor = { newUserId: 'unused-editor-id', authUserId: 'auth-proposal-editor', email: `${editorId}@example.test`, name: 'Editor' };
  const draft = { ...doc, meta: { name: 'Approved workshop' } };
  const input = { id: siteId, version: 1, doc: draft, requiredRole: 'write', proposal };
  const revision = async (version: number) => (await operation('site.revision', { id: siteId, version })).body;

  const invalid = await call('site.saveAssistantProposal', { ...input, ...owner, proposal: { ...proposal, attemptId: proposal.attemptId + '\n' } });
  a.equal(invalid.status, 400);
  a.equal(invalid.body.code, 'INVALID_PROPOSAL_PROVENANCE');
  const forbidden = await operation('site.saveAssistantProposal', { ...input, ...editor });
  a.deepEqual(forbidden.body, { status: 'forbidden' });
  const duplicate = await call('site.saveAssistantProposal', { ...input, ...owner, proposal: { ...proposal, assetIds: ['proposal-workshop', 'proposal-workshop'] } });
  a.equal(duplicate.status, 400);
  a.equal(duplicate.body.code, 'INVALID_PROPOSAL_ASSETS');
  for (const unavailable of ['proposal-workshop-retired', 'proposal-workshop-other', 'proposal-workshop-deleted']) {
    const refused = await call('site.saveAssistantProposal', {
      ...input, ...owner, proposal: { ...proposal, assetIds: ['proposal-workshop', unavailable] },
    });
    a.equal(refused.status, 409);
    a.equal(refused.body.code, 'PROPOSAL_ASSET_UNAVAILABLE');
    a.equal((await operation('site.byId', { id: siteId })).body.version, 1);
  }
  a.equal(await revision(2), null);

  const start = harness.statements.length;
  const saved = await operation('site.saveAssistantProposal', { ...input, ...owner });
  a.equal(saved.body.status, 'saved');
  a.equal(saved.body.site.version, 2);
  a.equal(saved.body.site.published_version, 1);
  const recorded = await revision(2);
  a.deepEqual(recorded.doc, draft);
  a.equal(recorded.saved_by, ownerId);
  a.deepEqual(recorded.context, { source: 'assistant-proposal', proposalId: proposal.id, attemptId: proposal.attemptId });
  const statements = harness.statements.slice(start);
  const siteLock = statements.findIndex(statement => /select version from sites .* for no key update/.test(statement));
  const membershipLock = statements.findIndex(statement => /select role from site_users .* for share/.test(statement));
  const assetLock = statements.findIndex(statement => /select id from assets .* not retired .* order by id for share/.test(statement));
  const revisionWrite = statements.findIndex(statement => statement.includes('insert into site_revisions'));
  a.ok(siteLock >= 0 && siteLock < membershipLock && membershipLock < assetLock && assetLock < revisionWrite);

  const replay = await operation('site.saveAssistantProposal', { ...input, ...owner });
  a.deepEqual(replay.body, { status: 'conflict', currentVersion: 2 });
  a.equal(await revision(3), null);
  const ordinary = await operation('site.saveAuthorized', { ...input, ...editor, version: 2 });
  a.equal(ordinary.body.status, 'saved');
  a.equal(ordinary.body.site.version, 3);
  a.equal((await revision(3)).context, null, 'ordinary save ignores proposal metadata');
  a.deepEqual((await revision(2)).context, recorded.context);
});

test('site history stays metadata-only when saved documents exceed the gateway response budget', async () => {
  const siteId = 'large-history', ownerId = 'large-history-owner';
  await siteWithOwner(siteId, ownerId);
  const payload = 'x'.repeat(1024 * 1024);
  for (let version = 1; version <= 8; version++) {
    await db.query(`insert into site_revisions
      (site_id, version, doc, saved_by, context, created_at)
      values ($1, $2, $3::jsonb, $4, $5::jsonb, $6)`, [
      siteId, version,
      JSON.stringify({ ...doc, meta: { payload: `${version}:${payload}` } }),
      ownerId, JSON.stringify({ marker: `revision-${version}` }),
      `2026-10-${String(version).padStart(2, '0')}T12:00:00.000Z`,
    ]);
  }

  const history = await call('site.history', { id: siteId });
  a.equal(history.status, 200, JSON.stringify(history.body));
  a.ok(Buffer.byteLength(JSON.stringify(history.body), 'utf8') < 64 * 1024,
    'listing metadata must not echo every immutable document through the Edge gateway');
  const rows = history.body.data as Record<string, unknown>[];
  a.deepEqual(rows.map(row => row.version), [8, 7, 6, 5, 4, 3, 2, 1]);
  for (const row of rows) {
    a.equal(Object.hasOwn(row, 'doc'), false);
    a.equal(Object.hasOwn(row, 'context'), false);
    a.equal(row.saved_by, ownerId);
    a.equal(typeof row.created_at, 'string');
  }

  const detail = await operation('site.revision', { id: siteId, version: 4 });
  a.equal(detail.status, 200);
  a.equal(detail.body.doc.meta.payload, `4:${payload}`);
  a.deepEqual(detail.body.context, { marker: 'revision-4' });
});

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

test('a site with signed releases is refused cleanly and keeps its history', async () => {
  await connectedSite('signed', 'owner-1');
  const before = await rowsFor('signed');
  a.ok(Object.values(before).every(n => n > 0), 'the fixture fills every dependent table');

  const reply = await call('site.delete', { id: 'signed' });
  a.equal(reply.status, 409);
  a.match(JSON.stringify(reply.body), /SITE_HAS_RELEASES/);
  a.deepEqual(await rowsFor('signed'), before, 'nothing was removed');
  a.equal(harness.files.has('owner-1/signed/a.webp'), true, 'stored media stays');
  await a.rejects(db.query(`delete from site_releases where site_id = 'signed'`), /immutable/);
});

test('deleting a WordPress-connected site without releases removes the connection with it', async () => {
  // Connected mode is retired, so a site can hold a connection and no signed release.
  await siteWithOwner('doomed', 'owner-2');
  await db.exec(`
    insert into wordpress_connections (id, site_id, created_by, installation_id, environment, profile,
      target_origin, target_path, redirect_uri, webhook_url, scopes, status, code_challenge,
      authorization_code_digest, authorization_code_expires_at, confirmed_at)
    values ('doomed-staging', 'doomed', 'owner-2', 'doomed-install', 'staging', 'existing-theme',
      'https://doomed.wp.test', '/', 'https://doomed.wp.test/wp-admin', 'https://doomed.wp.test/wp-json',
      '[]', 'active', 'challenge', 'doomed-code', now(), now());
    insert into connected_editor_sessions (digest, connection_id, site_id, owner_id, expires_at)
    values ('${hex('doomed' + 'session')}', 'doomed-staging', 'doomed', 'owner-2', now());
    insert into assets (id, site_id, name, type, w, h, owner_id, storage_path, stored_bytes)
    values ('doomed-asset', 'doomed', 'a.webp', 'image/webp', 1, 1, 'owner-2', 'owner-2/doomed/a.webp', 3);
  `);
  harness.files.set('owner-2/doomed/a.webp', new Uint8Array([1, 2, 3]));
  await connectedSite('kept', 'owner-4');
  const kept = await rowsFor('kept');

  a.equal(await new GatewayStore(client()).delete('doomed'), true);

  a.ok(Object.values(await rowsFor('doomed')).every(n => n === 0), JSON.stringify(await rowsFor('doomed')));
  a.deepEqual(await rowsFor('kept'), kept);
  a.equal(harness.files.has('owner-2/doomed/a.webp'), false, 'stored media goes after the commit');
  a.equal(await new GatewayStore(client()).delete('doomed'), false, 'a second delete finds nothing');
});

test('a failed site delete rolls back as a whole and keeps the stored media', async () => {
  await siteWithOwner('survivor', 'owner-3');
  await db.query(`insert into assets (id, site_id, name, type, w, h, owner_id, storage_path, stored_bytes)
    values ('survivor-asset', 'survivor', 'a.webp', 'image/webp', 1, 1, 'owner-3', 'owner-3/survivor/a.webp', 3)`);
  harness.files.set('owner-3/survivor/a.webp', new Uint8Array([1, 2, 3]));
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

test('owned-site creation uses the locked database plan and ignores caller plan fields', async () => {
  const create = (ownerId: string, id: string, plan: string) =>
    operation('account.createOwnedSite', {
      ownerId, id, host: `${id}.example.test`, slug: id, name: id, doc, plan,
    });
  await db.query(`insert into users (id, email, plan) values ($1, $2, 'free')`,
    ['plan-free-owner', 'plan-free-owner@example.test']);
  await db.query(`insert into users (id, email, plan) values ($1, $2, 'pro')`,
    ['plan-pro-owner', 'plan-pro-owner@example.test']);

  for (let index = 1; index <= FREE_PLAN.ownedSites!; index++) {
    a.equal((await create('plan-free-owner', `plan-free-${index}`, 'pro')).body.status, 'created');
  }
  a.equal((await create('plan-free-owner', 'plan-free-refused', 'enterprise')).body.status, 'limit',
    'a caller cannot spoof an unknown plan for a Free database user');

  for (let index = 1; index <= 4; index++) {
    a.equal((await create('plan-pro-owner', `plan-pro-${index}`, 'free')).body.status, 'created',
      'stored Pro stays unlimited when the caller claims Free');
  }
  const plans = await db.query<{ id: string; plan: string }>(
    `select id, plan from users where id in ('plan-free-owner', 'plan-pro-owner') order by id`);
  a.deepEqual(plans.rows, [
    { id: 'plan-free-owner', plan: 'free' },
    { id: 'plan-pro-owner', plan: 'pro' },
  ]);
  a.ok(harness.statements.some(text =>
    /select id, plan from users where id = \$1 for update/.test(text)),
  'creation reads the authoritative plan under the owner lock');
});

test('site and library storage clamp caller limits to the locked database plan', async () => {
  await siteWithOwner('quota-free-site', 'quota-free-owner');
  await siteWithOwner('quota-pro-site', 'quota-pro-owner');
  await db.query(`update users set plan='pro' where id='quota-pro-owner'`);
  await db.query(`insert into assets
    (id, site_id, name, type, w, h, owner_id, storage_path, stored_bytes)
    values ($1, $2, 'charged.webp', 'image/webp', 1, 1, $3, $4, $5)`,
  ['quota-free-charge', 'quota-free-site', 'quota-free-owner',
    'quota-free-owner/quota-free-site/charged.webp', FREE_PLAN.storageBytes - 32]);
  await db.query(`insert into assets
    (id, site_id, name, type, w, h, owner_id, storage_path, stored_bytes)
    values ($1, $2, 'charged.webp', 'image/webp', 1, 1, $3, $4, $5)`,
  ['quota-pro-charge', 'quota-pro-site', 'quota-pro-owner',
    'quota-pro-owner/quota-pro-site/charged.webp', FREE_PLAN.storageBytes]);

  const putSiteAsset = async (ownerId: string, siteId: string, marker: number) => {
    const bytes = webp(marker);
    return call('asset.putBlob', { asset: {
      id: `${siteId}-upload`, siteId, ownerId, name: 'upload.webp', type: 'image/webp',
      w: 8, h: 8, contentHash: hex(bytes), blob: await stage(bytes),
      limitBytes: PRO_PLAN.storageBytes, plan: 'enterprise',
    } });
  };
  a.equal((await putSiteAsset('quota-free-owner', 'quota-free-site', 21)).status, 409,
    'Free cannot use a caller-supplied Pro allowance');
  a.equal((await putSiteAsset('quota-pro-owner', 'quota-pro-site', 22)).status, 200,
    'stored Pro can exceed the Free allowance');

  const freeLibrary = randomUUID(), proLibrary = randomUUID();
  await operation('library.create', { id: freeLibrary, ownerId: 'quota-free-owner', name: 'Free kit' });
  await operation('library.create', { id: proLibrary, ownerId: 'quota-pro-owner', name: 'Pro kit' });
  const putLibraryAsset = async (
    libraryId: string,
    ownerId: string,
    marker: number,
  ) => {
    const bytes = webp(marker);
    return call('library.asset.putBlob', {
      libraryId, ownerId, id: hex(bytes), name: 'kit.webp', type: 'image/webp', w: 8, h: 8,
      blob: await stage(bytes), limitBytes: PRO_PLAN.storageBytes, plan: 'enterprise',
    });
  };
  a.equal((await putLibraryAsset(freeLibrary, 'quota-free-owner', 23)).status, 409);
  a.equal((await putLibraryAsset(proLibrary, 'quota-pro-owner', 24)).status, 200);
});

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

test('account deletion checks blockers, deletes the profile with its cascades, then the Auth user', async () => {
  const leaver = 'gw-leaver', other = 'gw-other';
  await siteWithOwner('gw-leaver-site', leaver);
  await db.query('update users set auth_user_id=$1 where id=$2', ['auth-gw-leaver', leaver]);
  await siteWithOwner('gw-kept-site', other);
  await db.query(`insert into site_users (site_id, user_id, role) values ('gw-kept-site', $1, 'content')`, [leaver]);
  await db.query(`insert into site_users (site_id, user_id, role) values ('gw-leaver-site', $1, 'owner')`, [other]);
  await db.query(`insert into sessions (digest, user_id, expires_at) values ('gw-session', $1, now() + interval '1 hour')`, [leaver]).catch(() => undefined);

  const shared = await operation('auth.accountDeletionCheck', { userId: leaver });
  a.equal(shared.status, 200, JSON.stringify(shared.body));
  a.deepEqual(shared.body, { status: 'shared_sites', sites: [{ id: 'gw-leaver-site', name: 'gw-leaver-site' }] });
  a.equal((await operation('auth.deleteAccount', { userId: leaver })).body.status, 'shared_sites', 'nothing deleted while shared');
  a.equal(await count('select * from users where id=$1', [leaver]), 1);

  await db.query(`delete from site_users where site_id='gw-leaver-site' and user_id=$1`, [other]);
  await db.query(`update users set plan='pro' where id=$1`, [leaver]);
  a.deepEqual((await operation('auth.accountDeletionCheck', { userId: leaver })).body, { status: 'plan' });
  await db.query(`update users set plan='free' where id=$1`, [leaver]);
  a.deepEqual((await operation('auth.accountDeletionCheck', { userId: leaver })).body, { status: 'ok', ownedSites: 1 });
  a.deepEqual((await operation('auth.deleteAccount', { userId: leaver })).body, { status: 'owned_sites' }, 'owned sites go first, through site.delete');

  a.equal((await operation('site.delete', { id: 'gw-leaver-site' })).body, true);
  harness.deletedAuthUsers.length = 0;
  const deleted = await operation('auth.deleteAccount', { userId: leaver });
  a.equal(deleted.status, 200, JSON.stringify(deleted.body));
  a.deepEqual(deleted.body, { status: 'deleted', authUserDeleted: true });
  a.deepEqual(harness.deletedAuthUsers, ['auth-gw-leaver']);
  a.equal(await count('select * from users where id=$1', [leaver]), 0);
  a.equal(await count('select * from site_users where user_id=$1', [leaver]), 0, 'memberships cascade');
  a.equal(await count(`select * from sites where id='gw-kept-site'`), 1, 'the collaborator site stays');
  a.equal(await count(`select * from site_users where site_id='gw-kept-site' and user_id=$1 and role='owner'`, [other]), 1);
  a.deepEqual((await operation('auth.deleteAccount', { userId: leaver })).body, { status: 'missing' });
  a.deepEqual((await operation('auth.accountDeletionCheck', { userId: leaver })).body, { status: 'missing' });
});

test('account deletion reports a profile whose Auth user could not be removed', async () => {
  const user = 'gw-auth-fails';
  await db.query('insert into users (id, email, auth_user_id) values ($1, $2, $3)', [user, 'gw-auth-fails@example.test', 'auth-gw-fails']);
  harness.deleteUserError = { message: 'service unavailable' };
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    a.deepEqual((await operation('auth.deleteAccount', { userId: user })).body, { status: 'deleted', authUserDeleted: false });
  } finally { harness.deleteUserError = null; spy.mockRestore(); }
  a.equal(await count('select * from users where id=$1', [user]), 0);
});

test('account deletion durably retries owned library object cleanup after Storage recovers', async () => {
  const user = 'gw-library-leaver', library = randomUUID();
  const path = `libraries/${library}/${H(7)}.webp`;
  await db.query(`insert into users (id, email) values ($1, $2)`, [user, 'gw-library-leaver@example.test']);
  await db.query(`insert into libraries (id, owner_id, name) values ($1, $2, 'Owned kit')`, [library, user]);
  await db.query(`insert into library_assets
    (library_id, id, name, type, w, h, storage_path, stored_bytes)
    values ($1, $2, 'Cover', 'image/webp', 1, 1, $3, 3)`, [library, H(7), path]);
  harness.files.set(path, new Uint8Array([1, 2, 3]));
  harness.removeError = { message: 'Storage unavailable' };
  try {
    a.equal((await operation('auth.deleteAccount', { userId: user })).body.status, 'deleted');
  } finally {
    harness.removeError = null;
  }
  a.equal(await count(`select * from libraries where id=$1`, [library]), 0, 'database rows cascade');
  a.equal(await count(`select * from storage_deletion_outbox where path=$1`, [path]), 1, 'object path survives for retry');
  a.equal(harness.files.has(path), true, 'failed Storage removal is not reported as complete');
  const queued = (await db.query<{ attempts: number; last_error: string }>(
    `select attempts, last_error from storage_deletion_outbox where path=$1`, [path],
  )).rows[0];
  a.deepEqual(queued, { attempts: 1, last_error: 'Storage unavailable' });
  for (const role of ['anon', 'authenticated']) {
    const permission = await db.query<{ allowed: boolean }>(
      `select has_table_privilege($1, 'storage_deletion_outbox', 'SELECT') as allowed`, [role],
    );
    a.equal(permission.rows[0].allowed, false, `${role} cannot read cleanup paths`);
  }
  a.equal((await db.query<{ enabled: boolean }>(
    `select relrowsecurity as enabled from pg_class where oid='storage_deletion_outbox'::regclass`,
  )).rows[0].enabled, true);

  await db.query(`update storage_deletion_outbox set next_attempt_at=now() where path=$1`, [path]);
  const retried = await operation('storage.drainDeletionOutbox', { worker: 'gateway-test-retry', limit: 10 });
  a.deepEqual(retried.body, { processed: 1, deleted: 1, pending: 0 });
  a.equal(harness.files.has(path), false);
  a.equal(await count(`select * from storage_deletion_outbox where path=$1`, [path]), 0);
});

test('a client running against the gateway reaches the deletion actions', async () => {
  const user = 'gw-client-leaver';
  await db.query('insert into users (id, email, auth_user_id) values ($1, $2, $3)', [user, 'gw-client@example.test', 'auth-gw-client']);
  const { GatewayAuthStore } = await import('../src/store-gateway.ts');
  const auth = new GatewayAuthStore(client());
  a.deepEqual(await auth.accountDeletionCheck(user), { status: 'ok', ownedSites: 0 });
  a.deepEqual(await auth.deleteAccount(user), { status: 'deleted', authUserDeleted: true });
  a.equal(await auth.userById(user), null);
});

test('plan grants recompute the cached account plan under the user lock', async () => {
  const userId = 'plan-grant-user';
  await db.query(`insert into users (id, email) values ($1, $2)`, [userId, 'plan-grant-user@example.test']);
  const plan = async () => (await db.query<{ plan: string; plan_source: string }>(
    `select plan, plan_source from users where id=$1`, [userId])).rows[0];

  harness.statements.length = 0;
  const launch = await operation('plan.grant', { userId, plan: 'launch', reason: 'Beta tester', grantedBy: 'founder' });
  a.equal(launch.status, 200, JSON.stringify(launch.body));
  a.deepEqual(launch.body.plan, { plan: 'launch', source: 'grant', changed: true });
  a.deepEqual(await plan(), { plan: 'launch', plan_source: 'grant' });
  a.ok(harness.statements.some(text => /select id, plan, plan_source from users where id = \$1 for update/.test(text)),
    'recompute reads the account under its row lock');

  const studio = await operation('plan.grant', { userId, plan: 'studio', reason: 'Partner', grantedBy: 'founder' });
  a.equal(studio.body.plan.plan, 'studio', 'the higher grant wins');

  const status = await operation('plan.status', { userId });
  a.equal(status.body.plan, 'studio');
  a.equal(status.body.grants.length, 2);

  const revoked = await operation('plan.revokeGrant', { grantId: studio.body.grant.id, revokedBy: 'founder' });
  a.deepEqual(revoked.body, { revoked: true, plan: { plan: 'launch', source: 'grant', changed: true } });
  a.equal((await operation('plan.revokeGrant', { grantId: studio.body.grant.id, revokedBy: 'founder' })).body.revoked, false);

  await db.query(`insert into billing_subscriptions
    (paddle_subscription_id, environment, user_id, price_id, plan, status, last_event_at)
    values ('sub_plan_test', 'sandbox', $1, 'pri_test', 'launch', 'active', now())`, [userId]);
  await operation('plan.revokeGrant', { grantId: launch.body.grant.id, revokedBy: 'founder' });
  a.deepEqual(await plan(), { plan: 'launch', plan_source: 'subscription' },
    'an active subscription keeps the plan after every grant is revoked');

  await db.query(`update billing_subscriptions set status='canceled' where paddle_subscription_id='sub_plan_test'`);
  a.deepEqual((await operation('plan.recompute', { userId })).body, { plan: 'free', source: 'free', changed: true });
  a.deepEqual((await operation('plan.recompute', { userId })).body, { plan: 'free', source: 'free', changed: false });
});

test('plan grants refuse invalid input and unknown accounts', async () => {
  const bad = [
    { userId: 'plan-grant-user', plan: 'free', reason: 'x', grantedBy: 'founder' },
    { userId: 'plan-grant-user', plan: 'enterprise', reason: 'x', grantedBy: 'founder' },
    { userId: 'plan-grant-user', plan: 'pro', reason: '', grantedBy: 'founder' },
    { userId: 'plan-grant-user', plan: 'pro', reason: 'x'.repeat(201), grantedBy: 'founder' },
    { userId: 'plan-grant-user', plan: 'pro', reason: 'x', grantedBy: '' },
    { userId: 'plan-grant-user', plan: 'pro', reason: 'x', grantedBy: 'founder', expiresAt: '2000-01-01T00:00:00Z' },
    { userId: 'plan-grant-user', plan: 'pro', reason: 'x', grantedBy: 'founder', expiresAt: 'soon' },
  ];
  for (const args of bad) {
    const response = await call('plan.grant', args);
    a.equal(response.status, 400, JSON.stringify(args));
    a.equal(response.body.code, 'INVALID_PLAN_REQUEST');
  }
  const missing = await call('plan.grant', { userId: 'nobody', plan: 'pro', reason: 'x', grantedBy: 'founder' });
  a.equal(missing.status, 404);
  a.equal((await call('plan.revokeGrant', { grantId: randomUUID(), revokedBy: 'founder' })).status, 404);
  a.equal(await count(`select * from plan_grants where user_id='nobody'`), 0);
});

test('stale plan recompute paginates every paid account and skips a concurrently deleted row', async () => {
  await db.exec(`
    insert into users (id, email, plan, plan_source)
    select 'page-' || lpad(n::text, 4, '0'), 'page-' || n || '@billing.test', 'launch', 'grant'
    from generate_series(0, 1000) n;
  `);
  const paged = await operation('plan.recomputeStale', {});
  a.equal(paged.status, 200, JSON.stringify(paged.body));
  a.ok(Number(paged.body.checked) >= 1001);
  a.equal(await count(`select * from users where id like 'page-%' and plan <> 'free'`), 0);

  await db.exec(`
    insert into users (id, email, plan, plan_source) values
      ('zz-stale-a', 'zz-stale-a@billing.test', 'launch', 'grant'),
      ('zz-stale-delete', 'zz-stale-delete@billing.test', 'launch', 'grant'),
      ('zz-stale-z', 'zz-stale-z@billing.test', 'launch', 'grant');
  `);
  harness.afterQuery = async text => {
    if (!/select id from users\s+where plan <> 'free'/.test(text)) return;
    harness.afterQuery = null;
    await db.query(`delete from users where id='zz-stale-delete'`);
  };
  const concurrent = await operation('plan.recomputeStale', {});
  harness.afterQuery = null;
  a.equal(concurrent.status, 200, JSON.stringify(concurrent.body));
  a.equal(await count(`select * from users where id in ('zz-stale-a','zz-stale-z') and plan <> 'free'`), 0,
    'the deleted row does not abandon later accounts');
});

test('billing and plan tables are inaccessible to client roles', async () => {
  for (const table of ['plan_grants', 'billing_customers', 'billing_subscriptions', 'billing_events', 'crm_contacts']) {
    for (const role of ['anon', 'authenticated']) {
      const permissions = await db.query<{ allowed: boolean }>(`select has_table_privilege($1, $2, 'SELECT') as allowed`, [role, table]);
      a.equal(permissions.rows[0].allowed, false, `${role} cannot read ${table}`);
    }
    const security = await db.query<{ enabled: boolean }>(`select relrowsecurity as enabled from pg_class where oid=$1::regclass`, [table]);
    a.equal(security.rows[0].enabled, true);
  }
});

const CRM_ACCOUNT = randomUUID();
test('CRM contacts keep the file store rules: revisions, one-time account link, uniqueness', async () => {
  await db.query(`insert into users (id, email) values ($1, $2)`, [CRM_ACCOUNT, 'owner@crm.test']);
  const crm = new GatewayFounderCrmStore(client());
  const base = { accountId: null, name: 'Ada', email: 'Ada@Lead.test', company: 'Acme', stage: 'lead' as const,
    source: 'referral' as const, notes: '', followUpOn: '2026-12-01', isTest: false };
  const created = await crm.put(base);
  a.equal(created.email, 'ada@lead.test');
  a.equal(created.revision, 1);
  a.equal(created.followUpOn, '2026-12-01');
  a.match(created.id, /^[0-9a-f-]{36}$/);

  const updated = await crm.put({ ...base, id: created.id, expectedRevision: 1, stage: 'contacted' });
  a.equal(updated.revision, 2);
  a.equal(updated.stage, 'contacted');
  a.equal(updated.createdAt, created.createdAt);

  await a.rejects(crm.put({ ...base, id: created.id, expectedRevision: 1 }), (error: any) => error.code === 'conflict');
  await a.rejects(crm.put({ ...base, name: 'Twin' }), (error: any) => error.code === 'duplicate');
  await a.rejects(crm.put({ ...base, id: randomUUID(), expectedRevision: 1 }), (error: any) => error.code === 'conflict');
  await a.rejects(crm.put({ ...base, id: created.id, expectedRevision: 2, email: 'owner@crm.test', accountId: CRM_ACCOUNT }),
    (error: any) => error.code === 'conflict' && /email does not match/.test(error.message));

  const lead = await crm.put({ ...base, email: 'owner@crm.test', name: 'Owner' });
  const linked = await crm.put({ ...base, id: lead.id, expectedRevision: 1, email: 'owner@crm.test', name: 'Owner', accountId: CRM_ACCOUNT });
  a.equal(linked.accountId, CRM_ACCOUNT);
  await a.rejects(crm.put({ ...base, id: lead.id, expectedRevision: 2, email: 'owner@crm.test', name: 'Owner', accountId: null }),
    (error: any) => error.code === 'conflict' && /cannot be changed/.test(error.message));
  await a.rejects(crm.put({ ...base, email: 'ghost@crm.test', accountId: randomUUID() }), (error: any) => error.code === 'invalid');

  const listed = await crm.list();
  a.deepEqual(listed.map(row => row.email), ['ada@lead.test', 'owner@crm.test']);
  a.equal((await call('crm.contacts.put', { contact: { ...base, email: 'NOT-LOWER@x.test' } })).body.code, 'CRM_INVALID');
});

test('the contacts file is imported once and kept as a backup', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'crm-import-'));
  const file = join(dir, 'contacts.json');
  const id = randomUUID(), clash = randomUUID();
  const row = (rowId: string, email: string, accountId: string | null) => ({
    id: rowId, accountId, name: 'Imported', email, company: '', stage: 'qualified', source: 'direct', notes: 'kept',
    followUpOn: null, isTest: true, createdAt: '2025-01-02T03:04:05.000Z', updatedAt: '2025-02-03T04:05:06.000Z', revision: 4,
  });
  writeFileSync(file, JSON.stringify([row(id, 'imported@crm.test', randomUUID()), row(clash, 'ada@lead.test', null)]), { mode: 0o600 });
  const crm = new GatewayFounderCrmStore(client(), { importFrom: file });
  const listed = await crm.list();
  const imported = listed.find(contact => contact.id === id)!;
  a.deepEqual({ ...imported }, { ...row(id, 'imported@crm.test', null) }, 'fields, timestamps and revision survive; a missing account link is dropped');
  a.equal(listed.filter(contact => contact.email === 'ada@lead.test').length, 1, 'an existing email is skipped, not overwritten');
  a.equal(existsSync(file), false);
  a.equal(existsSync(`${file}.imported`), true);
  await crm.list();
  a.equal(await count(`select * from crm_contacts where id::text = $1`, [id]), 1);
  rmSync(dir, { recursive: true, force: true });
});

test('Paddle subscription events apply once, in order, to the account their checkout named', async () => {
  const userId = randomUUID(), other = randomUUID();
  const clock = Date.now(), at = (hours: number) => new Date(clock + hours * 60 * 60 * 1000).toISOString();
  await db.query(`insert into users (id, email, name) values ($1, 'Payer@Billing.test', 'Pat Payer'), ($2, 'other@billing.test', '')`, [userId, other]);
  const event = (patch: Record<string, unknown> = {}) => ({
    environment: 'sandbox', eventId: `evt_${randomUUID().replace(/-/g, '').slice(0, 26)}`, eventType: 'subscription.created',
    occurredAt: at(-4), subscriptionId: 'sub_01billingtest0001', customerId: 'ctm_01billingtest0001',
    userId, priceId: 'pri_01launchmonthly01', plan: 'launch', status: 'active', currentPeriodEnd: at(24 * 30),
    scheduledChange: null, ...patch,
  });
  const plan = async (id = userId) => (await db.query<{ plan: string; plan_source: string }>(`select plan, plan_source from users where id=$1`, [id])).rows[0];

  const first = event();
  const applied = await operation('billing.applySubscription', first);
  a.equal(applied.status, 200, JSON.stringify(applied.body));
  a.equal(applied.body.outcome, 'applied');
  a.deepEqual(await plan(), { plan: 'launch', plan_source: 'subscription' });
  const contact = (await db.query<{ stage: string; email: string; account_id: string }>(`select stage, email, account_id from crm_contacts where account_id=$1`, [userId])).rows;
  a.deepEqual(contact, [{ stage: 'customer', email: 'payer@billing.test', account_id: userId }], 'a paying account becomes a CRM customer');

  a.equal((await operation('billing.applySubscription', first)).body.outcome, 'duplicate');
  const older = await operation('billing.applySubscription', event({ occurredAt: at(-5), status: 'canceled' }));
  a.equal(older.body.outcome, 'stale', 'an older event never overwrites newer state');
  a.equal((await plan()).plan, 'launch');

  const moved = await operation('billing.applySubscription', event({ occurredAt: at(-3), userId: other }));
  a.equal(moved.body.outcome, 'refused', 'custom data cannot move a subscription to another account');
  a.equal((await plan(other)).plan, 'free');
  const stolenCustomer = await operation('billing.applySubscription', event({ subscriptionId: 'sub_01billingtest0002', userId: other, occurredAt: at(-2), }));
  a.equal(stolenCustomer.body.outcome, 'refused', 'a customer stays with its first account');
  const nobody = await operation('billing.applySubscription', event({ subscriptionId: 'sub_01billingtest0003', customerId: 'ctm_01billingtest0003', userId: null }));
  a.equal(nobody.body.outcome, 'refused');

  await operation('billing.applySubscription', event({ occurredAt: at(-1), status: 'past_due' }));
  a.equal((await plan()).plan, 'launch', 'past due keeps the plan during the grace window');
  await db.query(`update billing_subscriptions set status_changed_at = now() - interval '8 days' where paddle_subscription_id='sub_01billingtest0001'`);
  const stale = await operation('plan.recomputeStale', {});
  a.ok(stale.body.changed >= 1);
  a.deepEqual(await plan(), { plan: 'free', plan_source: 'free' }, 'the periodic recompute ends the grace window');

  const canceled = await operation('billing.applySubscription', event({ occurredAt: at(0), status: 'canceled' }));
  a.equal(canceled.body.outcome, 'applied');
  a.equal((await plan()).plan, 'free');
  a.equal(await count(`select * from billing_events where error is not null`), 3);
  for (const bad of [{ plan: 'free' }, { environment: 'prod' }, { status: 'gone' }, { eventId: 'nope' }, { occurredAt: 'later' }]) {
    a.equal((await call('billing.applySubscription', event(bad))).status, 400, JSON.stringify(bad));
  }
});

test('media uploads write the file before taking the owner lock, so one account\'s uploads do not queue', async () => {
  await siteWithOwner('unlocked-site', 'owner-unlocked');
  const libraryId = randomUUID();
  await operation('library.create', { id: libraryId, ownerId: 'owner-unlocked', name: 'Kit' });
  const lockedBeforeUpload = () => {
    const upload = harness.statements.findIndex(text => text.startsWith('storage.upload '));
    const lock = harness.statements.findIndex(text => /from users where id = \$1 for update/.test(text));
    a.ok(upload >= 0 && lock >= 0, harness.statements.join('\n'));
    return lock < upload;
  };

  const siteBytes = webp(41);
  harness.statements.length = 0;
  const site = await call('asset.putBlob', { asset: {
    id: 'unlocked-photo', siteId: 'unlocked-site', ownerId: 'owner-unlocked', name: 'Photo.webp',
    type: 'image/webp', w: 8, h: 8, contentHash: hex(siteBytes), blob: await stage(siteBytes),
  } });
  a.equal(site.status, 200, JSON.stringify(site.body));
  a.equal(lockedBeforeUpload(), false, 'site media is written to Storage before the owner lock');
  a.ok(harness.files.has(String((site.body.data as { storage_path: string }).storage_path)));

  const libraryBytes = webp(42);
  harness.statements.length = 0;
  const library = await call('library.asset.putBlob', {
    libraryId, ownerId: 'owner-unlocked', id: hex(libraryBytes), name: 'kit.webp', type: 'image/webp',
    w: 8, h: 8, blob: await stage(libraryBytes),
  });
  a.equal(library.status, 200, JSON.stringify(library.body));
  a.equal(lockedBeforeUpload(), false, 'library media is written to Storage before the owner lock');
  a.ok(harness.files.has(`libraries/${libraryId}/${hex(libraryBytes)}.webp`));
  a.equal(harness.statements.filter(text => /from users where id = \$1 for update/.test(text)).length, 1,
    'a successful upload takes the owner lock once');
});

test('an upload refused by the quota removes the file it wrote early', async () => {
  await siteWithOwner('refused-site', 'owner-refused');
  const libraryId = randomUUID();
  await operation('library.create', { id: libraryId, ownerId: 'owner-refused', name: 'Kit' });
  const before = new Set(harness.files.keys());
  const siteBytes = webp(43);
  const site = await call('asset.putBlob', { asset: {
    id: 'refused-photo', siteId: 'refused-site', ownerId: 'owner-refused', name: 'Photo.webp',
    type: 'image/webp', w: 8, h: 8, contentHash: hex(siteBytes), blob: await stage(siteBytes), limitBytes: 1,
  } });
  a.equal(site.status, 409);
  a.equal(site.body.code, 'STORAGE_LIMIT');
  const libraryBytes = webp(44);
  const library = await call('library.asset.putBlob', {
    libraryId, ownerId: 'owner-refused', id: hex(libraryBytes), name: 'kit.webp', type: 'image/webp',
    w: 8, h: 8, blob: await stage(libraryBytes), limitBytes: 1,
  });
  a.equal(library.status, 409);
  a.deepEqual([...harness.files.keys()].filter(path => !before.has(path)), [],
    'no file is left behind without a row');
});

test('a file released by another upload between the two steps is written again under the lock', async () => {
  await siteWithOwner('vanish-site', 'owner-vanish');
  const bytes = webp(45);
  const asset = {
    id: 'vanish-photo', siteId: 'vanish-site', ownerId: 'owner-vanish', name: 'Photo.webp',
    type: 'image/webp', w: 8, h: 8, contentHash: hex(bytes), blob: await stage(bytes),
  };
  const first = await call('asset.putBlob', { asset });
  const path = String((first.body.data as { storage_path: string }).storage_path);
  // The file is there but no row holds it, like a concurrent upload that is about to fail.
  await db.query(`delete from assets where id = 'vanish-photo'`);
  a.ok(harness.files.has(path));
  harness.afterUpload = (uploaded) => { harness.files.delete(uploaded); };
  const second = await call('asset.putBlob', { asset });
  a.equal(second.status, 200, JSON.stringify(second.body));
  a.ok(harness.files.has(path), 'the saved row has its file');
  a.equal(await count(`select * from assets where storage_path = '${path}'`), 1);
});

test('a failed upload keeps a file that a concurrent upload\'s row claimed', async () => {
  await siteWithOwner('claimed-site', 'owner-claimed');
  const bytes = webp(46);
  const asset = {
    id: 'claimed-photo', siteId: 'claimed-site', ownerId: 'owner-claimed', name: 'Photo.webp',
    type: 'image/webp', w: 8, h: 8, contentHash: hex(bytes), blob: await stage(bytes),
  };
  let path = '';
  // Right after this call writes the file, another upload commits a row that points at it.
  harness.afterUpload = async (uploaded) => {
    path = uploaded;
    await db.query(`insert into assets (id, site_id, name, type, w, h, owner_id, storage_path, stored_bytes)
      values ('claimed-other', 'claimed-site', 'Other.webp', 'image/webp', 8, 8, 'owner-claimed', $1, $2)`,
    [`${uploaded}.other`, bytes.byteLength]);
    await db.query(`update assets set storage_path = $1 where id = 'claimed-other'`, [uploaded]);
  };
  harness.failWhen = /insert into assets/;
  let failed;
  try {
    failed = await call('asset.putBlob', { asset });
  } finally {
    harness.failWhen = null;
  }
  a.equal(failed.status, 500);
  a.ok(path && harness.files.has(path), 'the other row still has its file');
});
