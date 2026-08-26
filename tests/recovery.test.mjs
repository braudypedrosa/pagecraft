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
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--file" ]]; then shift; out="$1"; fi
  shift || true
done
test -n "$out"
if [[ "$out" == *.verify.sql ]]; then
  cp "\${out/.verify/}" "$out"
else
  printf '%s\n' '-- deterministic fixture dump' > "$out"
fi
`);
    chmodSync(fakeSupabase, 0o755);

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
  echo 0
else
  echo restore >> "$PSQL_LOG"
fi
`);
    chmodSync(fakePsql, 0o755);

    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      SUPABASE_DB_URL: 'postgresql://postgres:fixture@db.fixture.test:5432/postgres',
      PAGECRAFT_BACKUP_PASSPHRASE: 'fixture-passphrase-with-enough-length',
      PSQL_LOG: psqlLog
    };
    const made = spawnSync('bash', [backup, output], { env, encoding: 'utf8' });
    a.equal(made.status, 0, made.stderr);
    const archive = made.stdout.trim().split('\n').at(-1);
    a.ok(archive && existsSync(archive), 'encrypted backup was not written');
    a.ok(existsSync(`${archive}.sha256`), 'encrypted checksum was not written');

    const restored = spawnSync('bash', [restore, archive], {
      env: { ...env, PAGECRAFT_RESTORE_CONFIRM: 'restore-to:db.fixture.test' },
      encoding: 'utf8'
    });
    a.equal(restored.status, 0, restored.stderr);
    a.equal(readFileSync(psqlLog, 'utf8').trim().split('\n').length, 2,
      'application data and migration history must both be restored transactionally');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
