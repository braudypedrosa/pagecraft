import { test } from 'vitest';
import a from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backup = join(root, 'tools', 'backup-supabase.sh');
const restore = join(root, 'tools', 'restore-supabase.sh');

test('database recovery scripts are valid Bash', () => {
  const result = spawnSync('bash', ['-n', backup, restore], { encoding: 'utf8' });
  a.equal(result.status, 0, result.stderr);
});

test('backup refuses to run without a database URL and encryption secret', () => {
  const env = { ...process.env };
  delete env.SUPABASE_DB_URL;
  delete env.PAGECRAFT_BACKUP_PASSPHRASE;
  const result = spawnSync('bash', [backup], { env, encoding: 'utf8' });
  a.notEqual(result.status, 0);
  a.match(result.stderr, /SUPABASE_DB_URL/);
});

test('restore requires the explicit new-project confirmation phrase', () => {
  const result = spawnSync('bash', [restore, '/not-a-real-backup.enc'], {
    env: {
      ...process.env,
      SUPABASE_DB_URL: 'postgresql://invalid',
      PAGECRAFT_BACKUP_PASSPHRASE: 'fixture-only',
      PAGECRAFT_RESTORE_CONFIRM: ''
    },
    encoding: 'utf8'
  });
  a.notEqual(result.status, 0);
  a.match(result.stderr, /restore-to:invalid/);
});

test('scheduled backups are encrypted before upload and never commit credentials', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'database-backup.yml'), 'utf8');
  const script = readFileSync(backup, 'utf8');
  a.match(workflow, /secrets\.SUPABASE_DB_URL/);
  a.match(workflow, /secrets\.PAGECRAFT_BACKUP_PASSPHRASE/);
  a.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/);
  a.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d/m);
  a.match(workflow, /\*\.enc/);
  a.doesNotMatch(workflow, /postgresql:\/\/[A-Za-z0-9]/);
  a.match(script, /-aes-256-cbc/);
  a.match(script, /-pbkdf2/);
  a.match(script, /shasum -a 256/);
  a.match(script, /history_schema\.sql/);
  a.match(script, /history_data\.sql/);
  a.match(script, /--schema supabase_migrations/);
  a.match(script, /schema\.verify\.sql/);
});

test('a stubbed dump becomes an encrypted archive that the guarded restore consumes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pagecraft-recovery-test-'));
  try {
    const bin = join(dir, 'bin');
    const output = join(dir, 'output');
    const psqlLog = join(dir, 'psql.log');
    const mkdir = spawnSync('mkdir', ['-p', bin, output]);
    a.equal(mkdir.status, 0);

    const fakeSupabase = join(bin, 'supabase');
    writeFileSync(fakeSupabase, `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo "2.104.0"; exit 0; fi
[[ "\${1:-}" == db && "\${2:-}" == dump && "\${3:-}" == --dry-run ]] || exit 41
printf '%s\\n' "$*" >> "$DUMP_LOG"
printf '%s\\n' 'export PGUSER="postgres"' '    --role "postgres" \\' "# $*"
`);
    chmodSync(fakeSupabase, 0o755);

    // This executable is first in PATH: no invocation can reach a real Docker daemon.
    const fakeDocker = join(bin, 'docker');
    writeFileSync(fakeDocker, `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == *'ghcr.io/supabase/postgres:17.6.1.132 -s'* ]] || exit 42
envfile=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == --env-file ]]; then shift; envfile="$1"; fi
  shift || true
done
[[ -f "$envfile" ]] || exit 43
grep -qx 'PGUSER=backup_fixture' "$envfile" || exit 44
grep -qx 'PGHOST=db.fixture.test' "$envfile" || exit 45
template="$(cat)"
[[ "$template" != *'export PGUSER='* && "$template" != *'--role "postgres"'* ]] || exit 46
printf '%s\\n' "$template" >> "$DOCKER_LOG"
count=0; [[ -f "$COUNT_FILE" ]] && count="$(cat "$COUNT_FILE")"
count=$((count + 1)); printf '%s' "$count" > "$COUNT_FILE"
if [[ "\${CHANGE_SCHEMA:-0}" == 1 && "$count" == 6 ]]; then
  printf '%s\\n' '-- changed schema'; exit 0
fi
case "$template" in
  *--role-only*) printf '%s\\n' '-- fixture roles' ;;
  *--data-only*supabase_migrations*) printf '%s\\n' 'COPY supabase_migrations.schema_migrations FROM stdin;' '202611140001' '\\.' ;;
  *--schema*supabase_migrations*) printf '%s\\n' '-- fixture migration schema' ;;
  *--data-only*) printf '%s\\n' 'COPY public.sites FROM stdin;' 'fixture-site' '\\.' ;;
  *) printf '%s\\n' '-- fixture application schema' ;;
esac
`);
    chmodSync(fakeDocker, 0o755);

    const fakePsql = join(bin, 'psql');
    writeFileSync(fakePsql, `#!/usr/bin/env bash
set -euo pipefail
preflight=0
need_file=0
for arg in "$@"; do
  if [[ "$need_file" == 1 ]]; then test -s "$arg"; need_file=0; continue; fi
  [[ "$arg" == "--tuples-only" ]] && preflight=1
  [[ "$arg" == "--file" ]] && need_file=1
done
if [[ "$preflight" == 1 ]]; then
  echo "\${PREFLIGHT_COUNT:-0}"
else
  printf '%s\n' "$*" >> "$PSQL_LOG"
  for arg in "$@"; do
    if [[ -f "$arg" ]]; then cat "$arg" >> "$RESTORE_LOG"; fi
  done
fi
`);
    chmodSync(fakePsql, 0o755);

    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      SUPABASE_DB_URL: 'postgresql://backup_fixture:fixture@db.fixture.test:5432/postgres',
      PAGECRAFT_BACKUP_PASSPHRASE: 'fixture-passphrase-with-enough-length',
      PSQL_LOG: psqlLog,
      RESTORE_LOG: join(dir, 'restored.sql'),
      DUMP_LOG: join(dir, 'dump.log'),
      DOCKER_LOG: join(dir, 'docker.log'),
      COUNT_FILE: join(dir, 'count')
    };
    const made = spawnSync('bash', [backup, output], { env, encoding: 'utf8' });
    a.equal(made.status, 0, made.stderr);
    const archive = made.stdout.trim().split('\n').at(-1);
    a.ok(archive && existsSync(archive), 'encrypted backup was not written');
    a.ok(existsSync(`${archive}.sha256`), 'encrypted checksum was not written');
    const dumps = readFileSync(env.DUMP_LOG, 'utf8').trim().split('\n');
    a.equal(dumps.length, 8);
    a.match(dumps[0], /--role-only/);
    a.match(dumps[3], /--use-copy.*--data-only.*--schema supabase_migrations/);
    a.match(dumps[4], /--use-copy.*--data-only.*--exclude storage\.buckets_vectors.*--exclude storage\.vector_indexes/);
    a.equal(readFileSync(env.DOCKER_LOG, 'utf8').trim().split('\n').length, 8);

    const rejected = spawnSync('bash', [restore, archive], {
      env: { ...env, PAGECRAFT_RESTORE_CONFIRM: 'restore-to:db.fixture.test', PREFLIGHT_COUNT: '1' },
      encoding: 'utf8'
    });
    a.notEqual(rejected.status, 0);
    a.match(rejected.stderr, /already contains Pagecraft tables/);
    a.equal(existsSync(psqlLog), false, 'preflight rejection must not restore data');


    const restored = spawnSync('bash', [restore, archive], {
      env: { ...env, PAGECRAFT_RESTORE_CONFIRM: 'restore-to:db.fixture.test' },
      encoding: 'utf8'
    });
    a.equal(restored.status, 0, restored.stderr);
    a.equal(readFileSync(psqlLog, 'utf8').trim().split('\n').length, 2,
      'application data and migration history must both be restored transactionally');
    const restoredSql = readFileSync(env.RESTORE_LOG, 'utf8');
    a.match(restoredSql, /fixture-site/);
    a.match(restoredSql, /202611140001/);
    a.match(readFileSync(psqlLog, 'utf8'), /--single-transaction/);

    rmSync(env.COUNT_FILE);
    const changed = spawnSync('bash', [backup, join(dir, 'changed')], {
      env: { ...env, CHANGE_SCHEMA: '1' }, encoding: 'utf8'
    });
    a.notEqual(changed.status, 0);
    a.match(changed.stderr, /schema or migration history changed/);

  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
