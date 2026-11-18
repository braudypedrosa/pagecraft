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
supabase_version="$(supabase --version)"
if [[ "$supabase_version" != "2.104.0" ]]; then
  echo "Supabase CLI 2.104.0 is required for the backup dump templates." >&2
  exit 1
fi
for command in docker python3; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "$command is required." >&2
    exit 1
  }
done
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

umask 077
python3 - "$work_dir/pg.env" <<'PY'
import os
import sys
from urllib.parse import parse_qs, unquote, urlsplit

url = urlsplit(os.environ["SUPABASE_DB_URL"])
if url.scheme not in ("postgres", "postgresql") or not all((url.hostname, url.username, url.password)):
    raise SystemExit("A PostgreSQL connection URL with a user and password is required.")
settings = {
    "PGHOST": url.hostname,
    "PGPORT": str(url.port or 5432),
    "PGUSER": unquote(url.username),
    "PGPASSWORD": unquote(url.password),
    "PGDATABASE": unquote(url.path[1:]) or "postgres",
    "PGSSLMODE": parse_qs(url.query).get("sslmode", ["require"])[0],
}
if any("\n" in value or "\r" in value for value in settings.values()):
    raise SystemExit("Connection settings cannot contain line breaks.")
with open(sys.argv[1], "w") as config:
    for key, value in settings.items():
        config.write(f"{key}={value}\n")
PY

# Retain the pinned CLI's dump filters and SQL formatting. Its templates assume the
# postgres administrator, so drop that role switch and connect as the backup login.
dump() {
  local output="$1" template="$work_dir/dump.sh"
  shift
  supabase db dump --dry-run --db-url postgresql://backup@127.0.0.1:5432/postgres "$@" |
    sed -E \
      -e '/^export PG(HOST|PORT|USER|PASSWORD|DATABASE)=/d' \
      -e '/^[[:space:]]+--role "postgres" \\$/d' > "$template"
  docker run --rm -i --env-file "$work_dir/pg.env" --entrypoint /bin/bash \
    ghcr.io/supabase/postgres:17.6.1.132 -s < "$template" > "$work_dir/$output"
}

dump roles.sql --role-only
dump schema.sql
dump history_schema.sql \
  --schema supabase_migrations
dump history_data.sql \
  --use-copy \
  --data-only \
  --schema supabase_migrations
dump data.sql \
  --use-copy \
  --data-only \
  --exclude "storage.buckets_vectors" \
  --exclude "storage.vector_indexes"

# The CLI performs separate logical dumps. Re-read the schema and migration ledger after the
# data snapshot and abort if a deployment crossed the backup window.
dump schema.verify.sql
dump history_schema.verify.sql \
  --schema supabase_migrations
dump history_data.verify.sql \
  --use-copy \
  --data-only \
  --schema supabase_migrations

# The CLI comments out pg_dump's random restrict keys in data dumps. Ignore the keys
# when comparing the ledger, preserving COPY rows and the original archived SQL.
for ledger in history_data.sql history_data.verify.sql; do
  sed -E \
    -e '/^COPY .* FROM stdin;$/,/^\\\.$/b' \
    -e 's/^(-- \\(un)?restrict) [[:alnum:]]+$/\1/' \
    "$work_dir/$ledger" > "$work_dir/$ledger.compare"
done

for pair in \
  "schema.sql:schema.verify.sql" \
  "history_schema.sql:history_schema.verify.sql" \
  "history_data.sql.compare:history_data.verify.sql.compare"; do
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
    "$supabase_version" > MANIFEST
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
