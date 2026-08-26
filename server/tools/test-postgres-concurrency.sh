#!/usr/bin/env bash
set -euo pipefail

container="pagecraft-connected-pg-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

docker run --detach --rm --name "$container" \
  --env POSTGRES_PASSWORD=pagecraft-test --env POSTGRES_DB=pagecraft \
  --publish 127.0.0.1::5432 postgres:17-alpine >/dev/null

for _attempt in $(seq 1 60); do
  # The image briefly starts a temporary server while initializing the
  # database. Waiting for the init-complete marker avoids racing that server's
  # shutdown and mistaking it for the final test instance.
  if docker logs "$container" 2>&1 | rg -q 'PostgreSQL init process complete; ready for start up\.' \
    && docker exec "$container" pg_isready --username postgres --dbname pagecraft >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$container" pg_isready --username postgres --dbname pagecraft >/dev/null
port="$(docker port "$container" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/')"
PAGECRAFT_TEST_DATABASE_URL="postgresql://postgres:pagecraft-test@127.0.0.1:${port}/pagecraft" \
  npx vitest run server/tests/connected-postgres.integration.test.ts
