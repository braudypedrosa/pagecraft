#!/usr/bin/env node

/*
 * Secret-safe verifier for the one-off pagecraft-logical-json-v1 snapshot.
 *
 * Feed decrypted JSON on stdin. The snapshot stays in memory, no row values are printed,
 * and PGlite is also in-memory. The output is limited to counts and integrity booleans so a
 * CI log or Codex tool result cannot accidentally disclose document, email, or token data.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const DATA_TABLES = [
  'sites',
  'users',
  'site_users',
  'assets',
  'site_revisions',
  'login_links',
  'sessions'
];
const EXPECTED_TABLES = new Set([...DATA_TABLES, 'gateway_config', 'schema_migrations']);
const MIGRATIONS = [
  'supabase/migrations/20260825000000_pagecraft_schema.sql',
  'supabase/migrations/20260825000100_gateway_config.sql',
  'supabase/migrations/20260825131540_site_revisions.sql',
  'supabase/migrations/20260825133055_index_revision_author.sql'
];
const REQUIRED_INDEXES = [
  'assets_pkey',
  'assets_site_idx',
  'gateway_config_pkey',
  'login_links_pkey',
  'sessions_pkey',
  'sessions_user_idx',
  'site_revisions_pkey',
  'site_revisions_saved_by_idx',
  'site_revisions_site_time_idx',
  'site_users_pkey',
  'site_users_user_idx',
  'sites_host_idx',
  'sites_host_key',
  'sites_pkey',
  'sites_slug_key',
  'users_email_key',
  'users_pkey'
];

let stage = 'read_input';

function fail(message) {
  throw new Error(message);
}

async function readStdin() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_INPUT_BYTES) fail('snapshot exceeds the verifier limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function dollarQuote(value) {
  let tag;
  do tag = `pc_${crypto.randomBytes(12).toString('hex')}`;
  while (value.includes(`$${tag}$`));
  return `$${tag}$${value}$${tag}$`;
}

function rowChunks(rows, maxBytes = 350_000) {
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  for (const row of rows) {
    const rowBytes = Buffer.byteLength(JSON.stringify(row), 'utf8') + (current.length ? 1 : 0);
    if (current.length && currentBytes + rowBytes > maxBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    if (rowBytes + 2 > maxBytes) fail('one snapshot row exceeds the safe MCP chunk size');
    current.push(row);
    currentBytes += rowBytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

try {
  const raw = await readStdin();
  stage = 'parse_snapshot';
  const snapshot = JSON.parse(raw);
  if (snapshot?.format !== 'pagecraft-logical-json-v1') fail('unexpected snapshot format');
  if (!snapshot.tables || typeof snapshot.tables !== 'object' || Array.isArray(snapshot.tables)) {
    fail('snapshot tables are missing');
  }
  const names = Object.keys(snapshot.tables);
  if (names.some(name => !EXPECTED_TABLES.has(name)) || [...EXPECTED_TABLES].some(name => !names.includes(name))) {
    fail('snapshot table allowlist mismatch');
  }
  for (const name of EXPECTED_TABLES) {
    if (!Array.isArray(snapshot.tables[name])) fail(`snapshot table ${name} is not an array`);
  }

  stage = 'create_memory_database';
  const db = await PGlite.create();
  await db.exec('create role anon; create role authenticated;');
  for (const file of MIGRATIONS) await db.exec(fs.readFileSync(file, 'utf8'));
  await db.exec('alter default privileges in schema public revoke all on tables from anon, authenticated;');

  stage = 'restore_rows';
  const inserted = Object.fromEntries(DATA_TABLES.map(name => [name, 0]));
  const chunkCounts = Object.fromEntries(DATA_TABLES.map(name => [name, 0]));
  const chunksExact = Object.fromEntries(DATA_TABLES.map(name => [name, true]));
  for (const table of DATA_TABLES) {
    const chunks = rowChunks(snapshot.tables[table]);
    chunkCounts[table] = chunks.length;
    for (const rows of chunks) {
      const payload = JSON.stringify(rows);
      const query = `
        with incoming as materialized (
          select * from jsonb_populate_recordset(
            null::public.${table},
            ${dollarQuote(payload)}::jsonb
          )
        ), made as (
          insert into public.${table} select * from incoming returning *
        ), made_minus_incoming as (
          select * from made
          except all
          select * from incoming
        ), incoming_minus_made as (
          select * from incoming
          except all
          select * from made
        )
        select
          (select count(*)::int from made) as count,
          not exists (select 1 from made_minus_incoming)
            and not exists (select 1 from incoming_minus_made) as exact
      `;
      const result = await db.query(query);
      inserted[table] += Number(result.rows[0].count);
      chunksExact[table] = chunksExact[table] && result.rows[0].exact === true;
    }
  }

  // The production gateway digest must never be restored into a disposable project.
  const disposableDigest = crypto.createHash('sha256').update('disposable-verifier-key').digest('hex');
  await db.query(
    'insert into public.gateway_config (id, secret_hash) values ($1, $2)',
    ['primary', disposableDigest]
  );

  stage = 'verify_exact_rows';
  const exact = {};
  for (const table of DATA_TABLES) {
    const result = await db.query(
      `with expected as (
         select * from jsonb_populate_recordset(null::public.${table}, $1::jsonb)
       ), actual_minus_expected as (
         select * from public.${table}
         except all
         select * from expected
       ), expected_minus_actual as (
         select * from expected
         except all
         select * from public.${table}
       )
       select not exists (select 1 from actual_minus_expected)
          and not exists (select 1 from expected_minus_actual) as exact`,
      [JSON.stringify(snapshot.tables[table])]
    );
    exact[table] = result.rows[0].exact === true;
  }

  const counts = {};
  for (const table of [...DATA_TABLES, 'gateway_config']) {
    const result = await db.query(`select count(*)::int as count from public.${table}`);
    counts[table] = Number(result.rows[0].count);
  }

  stage = 'verify_relational_integrity';
  const integrityResult = await db.query(`
    select
      not exists (
        select 1 from site_users m
        left join sites s on s.id = m.site_id
        left join users u on u.id = m.user_id
        where s.id is null or u.id is null
      ) as memberships,
      not exists (
        select 1 from sessions x left join users u on u.id = x.user_id
        where u.id is null
      ) as sessions,
      not exists (
        select 1 from assets a left join sites s on s.id = a.site_id
        where s.id is null
      ) as assets,
      not exists (
        select 1 from site_revisions r
        left join sites s on s.id = r.site_id
        left join users u on u.id = r.saved_by
        where s.id is null or (r.saved_by is not null and u.id is null)
      ) as revisions,
      not exists (
        select 1 from sites s
        where not exists (
          select 1 from site_revisions r
          where r.site_id = s.id and r.version = s.version
        )
      ) as current_revision
  `);
  stage = 'verify_rls';
  const rlsResult = await db.query(`
    select count(*)::int as enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any($1::text[])
      and c.relrowsecurity
  `, [[...DATA_TABLES, 'gateway_config']]);
  stage = 'verify_privileges';
  const privilegeResult = await db.query(`
    select count(*)::int as denied
    from unnest($1::text[]) as wanted(tablename)
    where not has_table_privilege('anon', 'public.' || wanted.tablename, 'SELECT')
      and not has_table_privilege('authenticated', 'public.' || wanted.tablename, 'SELECT')
  `, [[...DATA_TABLES, 'gateway_config']]);
  stage = 'verify_indexes';
  const indexResult = await db.query(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename::text = any($1::text[])
    order by indexname
  `, [[...DATA_TABLES, 'gateway_config']]);
  const indexNames = indexResult.rows.map(row => String(row.indexname));
  const missingIndexes = REQUIRED_INDEXES.filter(name => !indexNames.includes(name));

  const currentVersions = snapshot.tables.sites.map(site => Number(site.version));
  const revisionVersions = snapshot.tables.site_revisions.map(revision => Number(revision.version));
  const summary = {
    format: snapshot.format,
    captured_at: snapshot.captured_at,
    database_version: snapshot.database_version,
    source_migration_rows: snapshot.tables.schema_migrations.length,
    source_gateway_rows_skipped: snapshot.tables.gateway_config.length,
    gateway_digest_replaced: true,
    inserted,
    chunk_counts: chunkCounts,
    chunks_exact: chunksExact,
    counts,
    exact,
    integrity: integrityResult.rows[0],
    rls_enabled_tables: Number(rlsResult.rows[0].enabled),
    tables_denied_to_data_api_roles: Number(privilegeResult.rows[0].denied),
    index_count: indexNames.length,
    missing_indexes: missingIndexes,
    site_versions: currentVersions,
    revision_range: revisionVersions.length
      ? { min: Math.min(...revisionVersions), max: Math.max(...revisionVersions) }
      : null
  };
  stage = 'validate_summary';
  const failedExactTables = Object.entries(exact)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);
  if (failedExactTables.length) fail(`exact row verification failed: ${failedExactTables.join(',')}`);
  if (Object.values(chunksExact).some(value => value !== true)) {
    fail('inserted chunk verification failed');
  }
  if (Object.values(integrityResult.rows[0]).some(value => value !== true)) {
    fail('relational integrity verification failed');
  }
  if (Number(rlsResult.rows[0].enabled) !== DATA_TABLES.length + 1) {
    fail('RLS verification failed');
  }
  if (Number(privilegeResult.rows[0].denied) !== DATA_TABLES.length + 1) {
    fail('Data API role privilege verification failed');
  }
  if (missingIndexes.length) fail(`required indexes are missing: ${missingIndexes.join(',')}`);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  const code = typeof error?.code === 'string' ? ` (${error.code})` : '';
  const detail = ['verify_indexes', 'validate_summary'].includes(stage) && typeof error?.message === 'string'
    ? `: ${error.message}`
    : '';
  console.error(`Logical snapshot verification failed at stage: ${stage}${code}${detail}`);
  process.exitCode = 1;
}
