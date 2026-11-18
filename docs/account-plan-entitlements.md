# Private account entitlements

| Plan | Publicly available | Owned sites | Optimized media pool |
| --- | --- | --- | --- |
| Free | Yes; default for new profiles | 1 in total, including drafts | 100 MB |
| Launch | Not yet; grant only until checkout ships | 5 | 1 GB (working figure) |
| Studio | Not yet; grant only until checkout ships | 20 | 5 GB (working figure) |
| Pro | No; privately assigned | Unlimited | 5 GB |

Pro is complimentary. It has no checkout, public upgrade option, or payment obligation.
`public.users.plan` is authoritative; editable Auth metadata and request bodies cannot assign
a plan. Profile changes and verified identity linking preserve an existing assignment.
The browser roles have no direct access to update the plan column.

The canonical catalog is `supabase/functions/pagecraft-db/plan-entitlements.ts`, re-exported
by `server/src/plans.ts`. The Node deployment bundles that one pure module; the gateway
deployment includes it alongside the function entrypoint. Unknown values fail closed to
Free, and the database constraint permits only `free`, `launch`, `studio` and `pro`.

The Free allowance changed from 3 to 1 owned site on 2026-11-16 (user decision). Existing
Free accounts that already own more sites keep every one of them: nothing is deleted, hidden
or made read-only. They can keep editing and publishing those sites; only creating another
site is refused while their count is at or above the allowance. The dashboard shows, for
example, `3 of 1 owned sites` and the "Site limit reached" card, and the API answers
`409 site_limit_reached` with `limit` and a readable `detail`.

Enforcement happens in two places that share this catalog: the Node app (memory and Postgres
stores) and the `pagecraft-db` database gateway edge function (`account.createOwnedSite`).
The gateway is deployed to Supabase separately; the Node deployment does not update it.
Until the edge function is redeployed with the new catalog, gateway-backed environments keep
enforcing the old allowance of 3. Because staging and production share one database and
gateway, that redeploy affects both environments at once.

An unlimited site allowance is represented by `null`, never `Infinity` or a large invented
number. Site creation resolves the owner’s stored plan while holding the user row lock.
Being invited to another person’s site does not consume the creation allowance.

Media uploads, connected WordPress uploads, Uplisting cover imports, library publication,
and library imports use the storage owner’s allowance. Durable gateway and Postgres writes
read the owner’s plan under the quota lock; a supplied quota can only reduce its cap.
Curated-template installation retains its existing media ownership and accounting. Authentication, rate limits,
file size checks, document limits, and invitation permissions remain independent of plans.

For a private assignment, resolve the exact signed-in profile and confirmed Auth identity,
then update only that profile through trusted database administration. Do not match display
name alone. Verify the stored value, rendered plan, storage endpoint, and site creation past
the Free limit. No browser-facing plan assignment endpoint is provided.

The current staging and production installation shares account records. A plan assignment
is therefore account data shared by both environments; frontend/server promotion remains
a separate deployment. A future clean production database needs its own deliberate grant.

## Plan grants and subscriptions (2026-11-19)

`users.plan` is now a cached value. The gateway derives it with `effectivePlan` in
`plan-entitlements.ts`: the highest of every unrevoked, unexpired row in `plan_grants` and
every `billing_subscriptions` row that is `active`, `trialing`, or `past_due` for less than
`PAST_DUE_GRACE_DAYS` (7). On a tie a subscription is reported over a grant. `users.plan_source`
records `free`, `grant` or `subscription`, and `plan_changed_at` when it last changed.

Gateway operations (server key only): `plan.status`, `plan.recompute`, `plan.grant` and
`plan.revokeGrant`. Each write locks the user row, changes its source rows and rewrites the
cached plan in one transaction. `server/src/plan-grants.ts` is the Node client. The
migration turned every existing `pro` account into a grant with `granted_by = 'migration'`.

Use `plan.grant` instead of editing `users.plan` by hand: a direct edit is overwritten at
the next recompute. `billing_customers`, `billing_subscriptions` and `billing_events` exist
for the Paddle webhook (billing phase 3) and are not written yet. All four tables have row
level security enabled and no client-role access.

## Founder CRM in the database and "Give plan" (2026-11-19)

- Founder CRM contacts move from `contacts.json` on the Reports host into the `crm_contacts`
  table (migration `20261119010000_crm_contacts.sql`). Only the server-keyed `pagecraft-db`
  gateway reads or writes it (`crm.contacts.list`, `crm.contacts.put`, `crm.contacts.import`).
  The gateway re-checks revisions, the one-time account link and uniqueness under a table lock.
- When `DATABASE_GATEWAY_URL` is configured, the Reports app uses the database store. On the
  first CRM request it copies the old file once (ids, timestamps and revisions kept; rows whose
  id, email or account already exist are skipped) and renames it to `contacts.json.imported`.
- A customer linked to a Pagecraft account shows a **Plan** panel in the CRM detail view. The
  founder can give Launch, Studio or Pro with a reason and optional end date, or remove a given
  plan. `POST /crm/plans` is founder-only, same-origin, throttled, and only accepts accounts in
  the current snapshot. Grants are recorded with `granted_by = founder:<auth user id>`.
- Free is never granted; it is what an account falls back to. Its limits are unchanged.
- Deploy order: apply both migrations, redeploy `pagecraft-db`, then deploy the Reports app.
