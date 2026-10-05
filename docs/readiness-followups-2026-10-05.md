# Readiness follow-ups — 5 October 2026

This update addresses the remaining consent, WordPress credential, and staging schedule
findings in the 3 October readiness review. The original 71/90 result describes that earlier
build; it is not a fresh score for this update.

## Collaboration consent

New library shares and site ownership invitations remain pending until the addressed person
accepts them at `/invitations`. Inviting an existing content editor or reviewer to become an
owner preserves their current role until acceptance. Decline and cancellation preserve that
role. Existing accepted memberships remain usable. Content editor and reviewer invitations
keep their established behavior.

The dashboard links to outstanding invitations. Owners can see and cancel pending invitations
on the People page; library owners see “Awaiting acceptance” in the sharing list. Decisions
require the recipient's authenticated account and the correct browser origin. An editor
session cannot accept on the account's behalf. Invitation pages are private and uncached.

Pending invitations do not grant access. Acceptance rechecks the inviter's ownership, then
grants membership and consumes the invitation in one database transaction. Active and pending
library memberships share the existing 50-person limit. Deleting a resource removes its
pending invitations in the same transaction.

## WordPress credentials

New and reconnected WordPress import connections store the site address derived from the
validated callback, including a WordPress subdirectory. The consent page and account Security
tab show that address. Existing connections retain their installation ID until reconnected,
because their old credentials did not record an address.

Refresh spends a digest and rotates access and refresh tokens atomically. Reusing a spent
refresh token revokes the active credential family, including its replacement access token.
Unknown tokens do not revoke somebody else's connection. Spent digests are valid for reuse
detection for 90 days; no bearer tokens are stored in the history table. Reconnection clears
the old family so an old token cannot revoke the replacement connection.

## Rollout and compatibility

Apply the two additive migrations before the app and gateway update. The Supabase connector
assigned migration ledger versions `20261005055558` and `20261005055600`; their names match the
committed migration files. Do not use `supabase db push` against the existing divergent ledger.

Gateway `pagecraft-db-v3` v24 retains the older operations used by production. New tables have
RLS enabled and no grants for `anon` or `authenticated`; the gateway retains its existing custom
authentication. The new `site_url` column is nullable for existing credentials and older
production builds. No document schema or released template version changes are needed.

The staging schedule cron changed from every five minutes to every minute, with a private
backup and readback proving all other entries unchanged. Staging background queue workers
remain disabled. This changes the wake-up cadence; it does not guarantee exact-second delivery.

## Verification and remaining work

- `npm test`: 1,624 passed, 5 skipped; build and TypeScript checks passed.
- Demo export: 54 KB, six component instances and four collection items, zero review findings.
- Deployment Python tests: 29 passed.
- Gateway Deno type check passed; actual gateway SQL ran against all migrations in PGlite.
- Built-in browser: acceptance and decline with fictional local accounts; desktop and 390px
  mobile views; WordPress site address; 22 gallery interactions; all 24 screenshots matched.
- Live database readback: both new tables have RLS and denied client reads, `site_url` is
  nullable, and both resource cleanup triggers exist. Gateway v24 is active.

PGlite is a single connection, so its tests do not reproduce two live PostgreSQL transactions
racing. New permission and refresh flows were verified with isolated fixtures, without sending
invitations to real people or changing their memberships. Staging deployment verification and
its exact commit belong in the task-close evidence record after deployment.

Production promotion remains a separate approval. The prelaunch shared database remains the
approved configuration; production needs an isolated database before customer launch. Signed-in
hosting latency and integrations not exercised in the original review remain launch checks.
