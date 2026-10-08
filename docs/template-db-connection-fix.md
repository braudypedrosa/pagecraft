# Template import database connection fix

Status: local development candidate on 2026-10-08. Not deployed.

## Incident evidence

The Stillwood dashboard import rolled back on staging. Between
`2026-10-08T03:35:43Z` and `2026-10-08T03:35:47Z`, `pagecraft-db-v3` logged PostgreSQL
error `53300`: `remaining connection slots are reserved for roles with the SUPERUSER
attribute`. Read-only log aggregation found four matching function events and four
matching PostgreSQL events in the surrounding ten-minute window.

A read-only function download confirmed the active function is version 25, retains
`verify_jwt=false`, and has the repository's existing `max: 3`, `prepare: false`,
10-second connect timeout and 20-second idle timeout. No runtime secret was read or printed.

A read-only database snapshot during the investigation showed:

- `max_connections = 60`;
- `superuser_reserved_connections = 3`;
- database connection limit `-1`, the normal unlimited database-level setting;
- 17 client backends at the snapshot: 16 idle and one active.

The quiet snapshot does not reproduce the earlier burst, but it rules out an altered
database-level connection limit. No sessions were terminated and no database setting was
changed.

## Cause

`pagecraft-db` creates one postgres.js client at module scope, so it does not leak a new client
per request. Transactions use `sql.begin` and release their connection when their callback
settles. The client also has a 20-second idle timeout.

The pool was configured with `max: 3`. That limit is per warm Edge isolate, rather than global.
Traffic that creates 19 isolates can therefore ask for 57 ordinary PostgreSQL connections,
which is the whole non-superuser allowance on this project before Auth, Storage, PostgREST and
other platform clients are counted. This explains a burst-only `53300` even though a later
snapshot is healthy.

[Supabase's current serverless guidance](https://supabase.com/docs/guides/database/connecting-to-postgres#configure-your-client)
says to construct the client once at module scope, cap its pool at one connection, and disable
prepared statements. The gateway already followed the module-scope and `prepare: false` parts.
The candidate changes `max` from three to one. It keeps the runtime-provided `SUPABASE_DB_URL`,
timeouts and connection mode unchanged, so it makes no assumption about the URI or deployment
topology.

## Retry boundary

The reported failure occurred while loading the gateway-key hash, before the request was
authenticated and before its operation was parsed or dispatched. That `SELECT` is idempotent.
The candidate retries only PostgreSQL `53300` once after 50 milliseconds at this boundary.

No gateway operation is retried. Operations include inserts, updates, deletes, asset writes and
transactions; replaying them at this layer would require operation-specific idempotency proof.
All other errors retain the existing response and logging behavior.

## Verification

- `npx vitest run server/tests/gateway-db.test.ts`: 13 passed. The new regression test asserts
  `max: 1`, proves the first key lookup can receive `53300`, and proves exactly one retry occurs
  before successful dispatch.
- `npm test`: 118 files passed, 2 skipped; 1,706 tests passed, 5 skipped.
- `deno check --config supabase/functions/pagecraft-db/deno.json
  supabase/functions/pagecraft-db/index.ts`: passed.
- `deno test --config supabase/functions/pagecraft-db/deno.json
  supabase/functions/pagecraft-db`: 3 passed.
- Static inspection covered all 27 `sql.begin` callbacks in the gateway sources. None uses the
  outer `sql` client while holding its transaction connection, so `max: 1` does not introduce a
  nested-pool deadlock.
- Repository-wide Deno formatting remains red because three gateway files already differ from
  Deno 2.8.2 formatting, including unrelated sections of `index.ts`. The candidate does not
  reformat those shared files.

## Release proposal

1. Review the two-file gateway diff and the focused test evidence.
2. Deploy the repository function as the existing `pagecraft-db-v3` slug with its existing
   `verify_jwt=false` custom gateway-key authentication. Do not change secrets, the database URI,
   pooler settings, database limits or host configuration.
3. Confirm the new Edge Function version is serving, then retry one Stillwood staging import.
4. Confirm the import completes, its prepared images exist, and no new `53300` appears in the
   function or PostgreSQL logs during the attempt.
5. Run the remaining five staging template imports sequentially and retain their per-template
   results. A successful deployment does not itself establish template QA Pass.

Rollback is the preceding Edge Function version. Rollback restores the three-connection
per-isolate behavior and therefore restores the incident risk; it requires no schema or data
rollback.
