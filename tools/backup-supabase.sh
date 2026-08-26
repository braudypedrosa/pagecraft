#!/usr/bin/env bash
set -euo pipefail

# Produce a complete logical Supabase backup, encrypt it before it leaves the runner, and
# write a checksum for the encrypted artifact. The database URL and passphrase are supplied
# through the environment so neither appears in shell history or the repository.

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the percent-encoded Session pooler URL.}"
: "${PAGECRAFT_BACKUP_PASSPHRASE:?Set PAGECRAFT_BACKUP_PASSPHRASE to a long, unique secret.}"

command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI is required." >&2
  exit 1
}
command -v openssl >/dev/null 2>&1 || {
  echo "OpenSSL is required." >&2
  exit 1
}
command -v tar >/dev/null 2>&1 || {
  echo "tar is required." >&2
  exit 1
}
if command -v sha256sum >/dev/null 2>&1; then
  checksum=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  checksum=(shasum -a 256)
else
  echo "sha256sum or shasum is required." >&2
  exit 1
fi

backup_dir="${1:-.backups}"
mkdir -p "$backup_dir"

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-backup.XXXXXX")"
cleanup() {
  case "$work_dir" in
    "${TMPDIR:-/tmp}"/pagecraft-backup.*) rm -rf -- "$work_dir" ;;
    *) echo "Refusing to remove unexpected temporary path: $work_dir" >&2 ;;
  esac
}
trap cleanup EXIT

supabase db dump --db-url "$SUPABASE_DB_URL" --file "$work_dir/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" --file "$work_dir/schema.sql"
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --file "$work_dir/history_schema.sql" \
  --schema supabase_migrations
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --file "$work_dir/history_data.sql" \
  --use-copy \
  --data-only \
  --schema supabase_migrations
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --file "$work_dir/data.sql" \
  --use-copy \
  --data-only \
  --exclude "storage.buckets_vectors" \
  --exclude "storage.vector_indexes"

# The CLI performs separate logical dumps. Re-read the schema and migration ledger after the
# data snapshot and abort if a deployment crossed the backup window.
supabase db dump --db-url "$SUPABASE_DB_URL" --file "$work_dir/schema.verify.sql"
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --file "$work_dir/history_schema.verify.sql" \
  --schema supabase_migrations
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --file "$work_dir/history_data.verify.sql" \
  --use-copy \
  --data-only \
  --schema supabase_migrations
for pair in \
  "schema.sql:schema.verify.sql" \
  "history_schema.sql:history_schema.verify.sql" \
  "history_data.sql:history_data.verify.sql"; do
  before="${pair%%:*}"
  after="${pair#*:}"
  cmp -s "$work_dir/$before" "$work_dir/$after" || {
    echo "Backup aborted: database schema or migration history changed during the dump." >&2
    exit 1
  }
done

for required_file in roles.sql schema.sql data.sql history_schema.sql history_data.sql; do
  test -s "$work_dir/$required_file" || {
    echo "Backup failed: $required_file is missing or empty." >&2
    exit 1
  }
done

(
  cd "$work_dir"
  "${checksum[@]}" roles.sql schema.sql data.sql history_schema.sql history_data.sql > SHA256SUMS
  printf 'created_utc=%s\nsupabase_cli=%s\n' \
    "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    "$(supabase --version)" > MANIFEST
  tar -czf backup.tar.gz \
    roles.sql schema.sql data.sql history_schema.sql history_data.sql SHA256SUMS MANIFEST
)

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
encrypted_name="pagecraft-db-$timestamp.tar.gz.enc"
encrypted_path="$backup_dir/$encrypted_name"
openssl enc \
  -aes-256-cbc \
  -salt \
  -pbkdf2 \
  -iter 200000 \
  -in "$work_dir/backup.tar.gz" \
  -out "$encrypted_path" \
  -pass env:PAGECRAFT_BACKUP_PASSPHRASE

(
  cd "$backup_dir"
  "${checksum[@]}" "$encrypted_name" > "$encrypted_name.sha256"
)
printf '%s\n' "$encrypted_path"
