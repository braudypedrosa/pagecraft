#!/usr/bin/env bash
set -euo pipefail

command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
command -v supabase >/dev/null || { echo 'Supabase CLI is required.' >&2; exit 1; }

migration_container="pagecraft-migrations-${PPID}-${RANDOM}"
if [[ ! "$migration_container" =~ ^pagecraft-migrations-[0-9]+-[0-9]+$ ]]; then
  echo 'Refusing an invalid disposable container name.' >&2
  exit 1
fi
cleanup_migrations() { docker rm -f "$migration_container" >/dev/null 2>&1 || true; }
trap cleanup_migrations EXIT INT TERM

docker run --detach --rm --name "$migration_container" \
  --env POSTGRES_PASSWORD=pagecraft-test --env POSTGRES_DB=pagecraft \
  --publish 127.0.0.1::5432 postgres:17-alpine >/dev/null

for migration_attempt in $(seq 1 60); do
  if docker exec "$migration_container" pg_isready --username postgres --dbname pagecraft >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$migration_container" pg_isready --username postgres --dbname pagecraft >/dev/null
docker exec "$migration_container" psql --username postgres --dbname pagecraft \
  --set ON_ERROR_STOP=1 --command 'create role anon nologin; create role authenticated nologin;' >/dev/null

for migration_file in supabase/migrations/*.sql; do
  docker exec --interactive "$migration_container" psql --username postgres --dbname pagecraft \
    --set ON_ERROR_STOP=1 < "$migration_file" >/dev/null
done

public_tables_without_rls=$(docker exec "$migration_container" psql --username postgres --dbname pagecraft \
  --tuples-only --no-align --command "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity")
[[ "$public_tables_without_rls" == '0' ]] || { echo "Public tables without RLS: $public_tables_without_rls" >&2; exit 1; }

direct_client_grants=$(docker exec "$migration_container" psql --username postgres --dbname pagecraft \
  --tuples-only --no-align --command "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')")
[[ "$direct_client_grants" == '0' ]] || { echo "Unexpected direct client grants: $direct_client_grants" >&2; exit 1; }

security_invoker=$(docker exec "$migration_container" psql --username postgres --dbname pagecraft \
  --tuples-only --no-align --command "select coalesce(array_position(reloptions,'security_invoker=true') is not null,false) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='wordpress_deployments'")
[[ "$security_invoker" == 't' ]] || { echo 'wordpress_deployments must be a security-invoker view.' >&2; exit 1; }

private_function_grants=$(docker exec "$migration_container" psql --username postgres --dbname pagecraft \
  --tuples-only --no-align --command "select count(*) from information_schema.routine_privileges where routine_schema='private' and grantee in ('anon','authenticated','PUBLIC')")
[[ "$private_function_grants" == '0' ]] || { echo "Unexpected private function grants: $private_function_grants" >&2; exit 1; }

advisor_port=$(docker port "$migration_container" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/')
PGSSLMODE=disable DO_NOT_TRACK=1 supabase db advisors \
  --db-url "postgres://postgres:pagecraft-test@127.0.0.1:${advisor_port}/pagecraft" \
  --type all --level warn --fail-on error

echo 'Supabase migrations, RLS/grants, and database advisors passed on PostgreSQL 17.'
