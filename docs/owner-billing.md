# Founder reports operations

## Product boundary

Founder financial reporting is a separate private console intended for `https://reports.itspagecraft.com`. The customer Pagecraft app exposes no financial routes or Billing navigation. The reports process reuses Pagecraft’s account authentication and reporting code without booting the editor, creating customer profiles, initializing database schemas, running service or background workers, publishing sites, or sending customer messages.

The current reports data source is **staging**. This is an explicit operational setting and is shown in the interface. It must not be described as production data.

## Authorization and privacy

Access is limited to verified Supabase Auth UUIDs in `PAGECRAFT_OWNER_AUTH_USER_IDS`. Missing, malformed, or empty configuration stops the reports process. A display name, email, mutable user metadata, complimentary Pro plan, site membership, editor token, or assistant bearer token never grants financial access.

The reports host verifies the identity through Supabase Auth `getUser` and uses its own host-only `pc_reports_auth` cookie. It does not offer customer signup or profile creation. Anonymous users see the dedicated existing-account sign-in page; authenticated users outside the UUID allowlist receive 403.

Every founder route, API response, and deployment response uses `private, no-store` and `noindex, nofollow`. Budget mutations also require the configured reports origin. The optional **Open Pagecraft** link accepts only a configured absolute HTTP or HTTPS origin.

## Runtime configuration

`server/src/reports-config.ts` defines the allowlisted reports settings. `server/src/reports-index.ts` may load them from the owner-only JSON file named by `PAGECRAFT_REPORTS_CONFIG`. That file must be a regular file, no larger than 32 KiB, inaccessible to group and other users, and contain only supported string settings. Keep it outside the source checkout and never commit or paste its contents into chat.

| Setting | Purpose |
|---|---|
| `REPORTS_HOST` | Exact reports hostname |
| `REPORTS_ORIGIN` | Trusted absolute origin for the reports console |
| `REPORTS_APP_ORIGIN` | Optional trusted absolute customer Pagecraft origin used only by the return link |
| `REPORTS_DATA_ENVIRONMENT` | Visible data-source label: `staging`, `production`, or `unconfigured` |
| `PAGECRAFT_REPORTS_STORAGE_ROOT` | Absolute private directory containing `costs.json` |
| `PAGECRAFT_OWNER_AUTH_USER_IDS` | Verified founder auth UUID allowlist |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Existing-account authentication |
| `TURNSTILE_SITE_KEY` | Optional founder sign-in challenge |
| `DATABASE_GATEWAY_URL`, `DATABASE_GATEWAY_KEY`, `DATABASE_GATEWAY_REGION` | Read gateway for the explicitly selected dataset |
| `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT` | Optional server-only Paddle reporting access |

The gateway URL and key must be provided together. Selecting `staging` or `production` requires a read gateway. Invalid origins, data environments, Paddle environments, or partial gateway configuration stop startup rather than falling back silently.

No Paddle key is currently configured. Founder reports therefore shows Paddle as not connected and withholds provider financial metrics instead of presenting false zeroes. When a key is added, use a sandbox read key first. The reporting integration reads subscriptions, transactions, and included adjustments; it does not mutate Paddle. Give it only the required provider permissions. Requests use fixed HTTPS provider origins, strict pagination origins, timeouts, and response bounds, and surface partial or unavailable data without exposing provider errors. [Paddle authentication guidance](https://developer.paddle.com/api-reference/about/authentication/)

This is separate from future checkout and webhook credentials. Customer subscription provisioning still needs trusted price mapping, verified webhooks, durable event handling, and explicit entitlement policy.

## Storage and money

Monthly cost budgets persist at `<PAGECRAFT_REPORTS_STORAGE_ROOT>/costs.json`. The reports deployment owns this private file independently of Pagecraft publication storage. Temporary writes use owner-only permissions and atomic rename; same-process writers serialize. Back up the directory with the reports runtime data.

Entries use stable UUIDs, bounded labels and categories, supported ISO currencies, and nonnegative integer minor-unit amounts. Form input follows each currency’s decimal precision and never passes through floating-point arithmetic. Currency totals remain independent. A failed storage read produces an unavailable state and suppresses the form and totals; it is never rendered as an empty budget.

Filesystem storage matches the current single-process design. Multiple reports processes would need shared transactions or locking before horizontal scaling.

## Reports-host routes

These routes belong to the founder reports process only; they are not mounted in the customer Pagecraft app.

- `GET /`: founder reports dashboard; anonymous users are sent to `/sign-in`.
- `GET /sign-in`: dedicated existing-account founder sign-in.
- `POST /auth/sign-in` and `POST /auth/logout`: reports-host session lifecycle.
- `GET /owner/billing`: authenticated reporting body.
- `GET /api/owner/billing`: private reporting JSON.
- `POST /owner/billing/costs`: create or edit a monthly cost budget.
- `POST /owner/billing/costs/:id/remove`: remove one budget row.
- `GET /__deployment`: host-gated private deployment identity.

## Data-source promotion

Reports currently reads staging data. Changing `REPORTS_DATA_ENVIRONMENT` to `production` is a manual production-launch step after Pagecraft has a clean isolated production database and the reports gateway points to that database. It is not an automatic consequence of deploying the reports process or promoting an editor release. Change the gateway and visible label together, then verify the reported site count and environment badge before relying on the console.

The reports process performs no database schema initialization. Prepare and verify the target Pagecraft database separately.

## Deployment and DNS status

The hosting account now has the reports subdomain and a separate Node 24 fixed-root application named `pagecraft-reports`. Protected runtime configuration and budget storage are provisioned separately. The application receives an immutable clone of the exact tested staging source release. Do not share the customer app’s writable checkout, auth cookie, or budget file.

Activate a tested source release with `tools/deploy/activate_reports.py <development commit>` on the hosting account after DNS and HTTPS are ready. This helper verifies the native candidate, denies anonymous financial data, rejects customer routes, then switches only the reports pointer. Failed restart, HTTPS verification, or status persistence restores the previous reports pointer; customer data and configuration stay separate. Source releases are copied with their installed dependencies, so customer release retention cannot invalidate reports. Reports release pruning is currently manual; preserve the active release and its rollback copy.

Public deployment is not yet verified. The Cloudflare DNS change is also pending user login: create a DNS-only `A` record for `reports.itspagecraft.com` pointing to `67.223.118.197`. Do not mark the hostname, deployment, or founder login complete until the live host is reachable and verified.

## Verification

Before accepting the reports deployment:

1. Confirm `/__deployment` identifies the exact approved immutable source release and remains private/no-store.
2. Confirm the page visibly says **Staging data** while the staging gateway is configured.
3. Verify an ordinary authenticated Pagecraft account with the same display name or plan receives 403 and cannot read financial JSON.
4. Verify the allowlisted UUID can sign in with the reports-only cookie, sign out, and cannot create a new customer profile through this host.
5. Add, edit, reload, and remove one clearly disposable QA budget without altering existing rows.
6. Review desktop and tablet layout, keyboard focus, validation recovery, table overflow, and private cache/search headers.
7. Confirm the customer Pagecraft app has no founder financial route or navigation.

Sandbox Paddle fixtures may verify presentation, but they are not proof of a live provider connection. Production reporting, checkout, paid entitlement enforcement, and a real purchase remain separate acceptance work.
