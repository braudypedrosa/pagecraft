import { test } from 'vitest';
import a from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import {
  createFounderReportsHandler,
  founderSnapshot,
  type SqlTag,
} from '../../supabase/functions/pagecraft-reports/founder-reporting.ts';

const KEY = 'private-reporting-key';
const HASH = createHash('sha256').update(KEY).digest('hex');

function fakeSql(log: { statement: string; values: unknown[] }[]): SqlTag {
  return async <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> => {
    const statement = strings.join('?').replace(/\s+/g, ' ').trim();
    log.push({ statement, values });
    if (statement.includes('from gateway_config')) return [{ secret_hash: HASH }] as T;
    if (statement.includes('count(*)::bigint as count from users')) return [{ count: '2' }] as T;
    if (statement.includes('count(*)::bigint as count from sites')) return [{ count: '3' }] as T;
    if (statement.includes('from users u')) return [{
      id: 'account-1', auth_user_id: 'auth-1', name: 'Account', email: 'account@example.test', plan: 'free',
      created_at: '2026-10-01T00:00:00Z', owned_sites: 1, published_sites: 1,
      media_bytes: '12', last_edited_at: '2026-10-02T00:00:00Z',
    }] as T;
    if (statement.includes('from sites s')) return [{
      id: 'site-1', owner_ids: ['account-1'], name: 'Site', slug: 'site', published: true,
      created_at: '2026-10-01T01:00:00Z', updated_at: '2026-10-02T00:00:00Z',
    }] as T;
    throw new Error(`unexpected query: ${statement}`);
  };
}

test('snapshot uses bounded parameterized SELECT queries and returns exact camelCase coverage', async () => {
  const log: { statement: string; values: unknown[] }[] = [];
  const result = await founderSnapshot(fakeSql(log), { accountLimit: 99_999, siteLimit: -10 });
  a.equal(result.coverage, 'partial');
  a.equal(result.accountTotal, 2);
  a.equal(result.siteTotal, 3);
  a.deepEqual(result.accounts[0], {
    id: 'account-1', authUserId: 'auth-1', name: 'Account', email: 'account@example.test', plan: 'free',
    createdAt: '2026-10-01T00:00:00.000Z', ownedSites: 1, publishedSites: 1,
    mediaBytes: 12, lastEditedAt: '2026-10-02T00:00:00.000Z',
  });
  a.deepEqual(result.sites[0]?.ownerIds, ['account-1']);
  a.ok(log.every(entry => /^select\b/i.test(entry.statement)), 'reporting SQL stays read-only');
  a.ok(log.every(entry => !/\b(insert|update|delete|alter|create|drop)\b/i.test(entry.statement)));
  a.equal(log.find(entry => entry.statement.includes('from users u'))?.values.at(-1), 1_000);
  a.equal(log.find(entry => entry.statement.includes('from sites s'))?.values.at(-1), 1);
  const allSql = log.map(entry => entry.statement).join(' ');
  a.match(allSql, /site_revisions/);
  a.match(allSql, /library_assets/);
  a.doesNotMatch(allSql, /select\s+.*\bdoc\b/i);
});

test('gateway authenticates before report reads, allows only founder.snapshot, and redacts failures', async () => {
  const log: { statement: string; values: unknown[] }[] = [];
  const handler = createFounderReportsHandler(fakeSql(log));
  const request = (key: string | null, body: unknown) => handler(new Request('http://reports.test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-pagecraft-gateway-key': key } : {}) },
    body: JSON.stringify(body),
  }));

  let response = await request(null, { op: 'founder.snapshot', args: {} });
  a.equal(response.status, 401);
  a.equal(log.length, 0, 'missing key causes no database read');

  response = await request('wrong', { op: 'founder.snapshot', args: {} });
  a.equal(response.status, 401);
  a.equal(log.filter(entry => entry.statement.includes('gateway_config')).length, 1);
  a.equal(log.some(entry => entry.statement.includes('from users u')), false);

  response = await request(KEY, { op: 'site.list', args: {} });
  a.equal(response.status, 400);
  a.equal((await response.json() as { code: string }).code, 'UNKNOWN_OPERATION');

  response = await request(KEY, { op: 'founder.snapshot', args: {} });
  a.equal(response.status, 200);
  a.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json() as { data: { coverage: string } };
  a.equal(body.data.coverage, 'partial');
});

test('reporting SQL executes against the existing table shapes without reading document or asset bodies', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table users (id text primary key, auth_user_id text, name text, email text, plan text, created_at timestamptz);
      create table sites (id text primary key, name text, slug text, updated_at timestamptz,
        published_release_id text, published_publication_id uuid);
      create table site_users (site_id text, user_id text, role text);
      create table site_revisions (site_id text, created_at timestamptz);
      create table assets (id text, site_id text, owner_id text, stored_bytes bigint, bytes bytea, retired boolean);
      create table libraries (id uuid primary key, owner_id text);
      create table library_assets (library_id uuid, stored_bytes bigint);
      insert into users values ('account-1', 'auth-1', 'Account', 'a@example.test', 'free', '2026-10-01T00:00:00Z');
      insert into users values ('account-2', 'auth-2', 'Co-owner', 'b@example.test', 'free', '2026-09-01T00:00:00Z');
      insert into sites values ('site-1', 'Site', 'site', '2026-10-02T00:00:00Z', 'release-1', null);
      insert into site_users values ('site-1', 'account-1', 'owner');
      insert into site_users values ('site-1', 'account-2', 'owner');
      insert into site_revisions values ('site-1', '2026-10-01T01:00:00Z');
      insert into assets values ('asset-1', 'site-1', 'account-1', 7, null, true);
      insert into libraries values ('123e4567-e89b-42d3-a456-426614174000', 'account-1');
      insert into library_assets values ('123e4567-e89b-42d3-a456-426614174000', 5);
    `);
    const sql: SqlTag = async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
      const statement = strings.reduce((built, part, index) =>
        built + part + (index < values.length ? `$${index + 1}` : ''), '');
      return (await db.query(statement, values)).rows as T;
    };
    const result = await founderSnapshot(sql);
    a.equal(result.coverage, 'complete');
    a.equal(result.accounts.find(account => account.id === 'account-1')?.mediaBytes, 12);
    a.equal(result.accounts.find(account => account.id === 'account-2')?.mediaBytes, 0,
      'co-owner does not inherit another profile media usage');
    a.equal(result.accounts.find(account => account.id === 'account-1')?.publishedSites, 1);
    a.deepEqual(result.sites[0]?.ownerIds, ['account-1', 'account-2']);
    a.equal(result.sites[0]?.createdAt, '2026-10-01T01:00:00.000Z');
  } finally {
    await db.close();
  }
});
