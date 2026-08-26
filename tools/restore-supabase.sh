#!/usr/bin/env bash
set -euo pipefail

# Restore an encrypted Pagecraft backup into a newly created Supabase project. This refuses
# to run without an explicit confirmation phrase because restoring into the wrong database
# is destructive and difficult to reverse.

archive_path="${1:-}"
: "${archive_path:?Usage: tools/restore-supabase.sh /path/to/pagecraft-db-*.tar.gz.enc}"
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the NEW target project connection URL.}"
: "${PAGECRAFT_BACKUP_PASSPHRASE:?Set PAGECRAFT_BACKUP_PASSPHRASE to the backup secret.}"

target_authority="${SUPABASE_DB_URL#*://}"
target_authority="${target_authority%%/*}"
target_hostport="${target_authority##*@}"
target_host="${target_hostport%%:*}"
if [[ -z "$target_host" || "$target_host" == "$SUPABASE_DB_URL" ]]; then
  echo "Refusing to restore: SUPABASE_DB_URL is not a valid PostgreSQL URL." >&2
  exit 1
fi
expected_confirmation="restore-to:$target_host"
if [[ "${PAGECRAFT_RESTORE_CONFIRM:-}" != "$expected_confirmation" ]]; then
  echo "Refusing to restore to $target_host. Set PAGECRAFT_RESTORE_CONFIRM=$expected_confirmation." >&2
  exit 1
fi

test -f "$archive_path" || {
  echo "Backup archive not found: $archive_path" >&2
  exit 1
}
command -v openssl >/dev/null 2>&1 || {
  echo "OpenSSL is required." >&2
  exit 1
}
command -v psql >/dev/null 2>&1 || {
  echo "PostgreSQL psql is required." >&2
  exit 1
}
command -v tar >/dev/null 2>&1 || {
  echo "tar is required." >&2
  exit 1
}
if command -v sha256sum >/dev/null 2>&1; then
  checksum_check=(sha256sum -c)
elif command -v shasum >/dev/null 2>&1; then
  checksum_check=(shasum -a 256 -c)
else
  echo "sha256sum or shasum is required." >&2
  exit 1
fi

existing_tables="$(psql \
  --dbname "$SUPABASE_DB_URL" \
  --tuples-only \
  --no-align \
  --variable ON_ERROR_STOP=1 \
  --command "select count(*) from pg_catalog.pg_tables where schemaname = 'public' and tablename in ('sites','users','login_links','sessions','site_users','assets','site_revisions','gateway_config')")"
if [[ "${existing_tables//[[:space:]]/}" != "0" ]]; then
  echo "Refusing to restore: $target_host already contains Pagecraft tables." >&2
  exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-restore.XXXXXX")"
cleanup() {
  case "$work_dir" in
    "${TMPDIR:-/tmp}"/pagecraft-restore.*) rm -rf -- "$work_dir" ;;
    *) echo "Refusing to remove unexpected temporary path: $work_dir" >&2 ;;
  esac
}
trap cleanup EXIT

openssl enc \
  -d \
  -aes-256-cbc \
  -pbkdf2 \
  -iter 200000 \
  -in "$archive_path" \
  -out "$work_dir/backup.tar.gz" \
  -pass env:PAGECRAFT_BACKUP_PASSPHRASE

while IFS= read -r member; do
  case "$member" in
    roles.sql|schema.sql|data.sql|history_schema.sql|history_data.sql|SHA256SUMS|MANIFEST) ;;
    *)
      echo "Refusing unexpected archive member: $member" >&2
      exit 1
      ;;
  esac
done < <(tar -tzf "$work_dir/backup.tar.gz")

tar -xzf "$work_dir/backup.tar.gz" -C "$work_dir"
(
  cd "$work_dir"
  "${checksum_check[@]}" SHA256SUMS
)

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$work_dir/roles.sql" \
  --file "$work_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$work_dir/data.sql" \
  --dbname "$SUPABASE_DB_URL"

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$work_dir/history_schema.sql" \
  --file "$work_dir/history_data.sql" \
  --dbname "$SUPABASE_DB_URL"

echo "Restore completed. Verify Pagecraft row counts, ownership, revisions, assets, and login before cutover."
