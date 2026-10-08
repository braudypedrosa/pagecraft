# Private account entitlements

| Plan | Publicly available | Owned sites | Optimized media pool |
| --- | --- | --- | --- |
| Free | Yes; default for new profiles | 3 | 100 MB |
| Pro | No; privately assigned | Unlimited | 5 GB |

Pro is complimentary. It has no checkout, public upgrade option, or payment obligation.
`public.users.plan` is authoritative; editable Auth metadata and request bodies cannot assign
a plan. Profile changes and verified identity linking preserve an existing assignment.
The browser roles have no direct access to update the plan column.

The canonical catalog is `supabase/functions/pagecraft-db/plan-entitlements.ts`, re-exported
by `server/src/plans.ts`. The Node deployment bundles that one pure module; the gateway
deployment includes it alongside the function entrypoint. Unknown values fail closed to
Free, and the database constraint permits only `free` and `pro`.

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
