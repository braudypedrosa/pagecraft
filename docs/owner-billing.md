# Owner billing dashboard operations

## Authorization

The feature is private to verified account UUIDs in `PAGECRAFT_OWNER_AUTH_USER_IDS` (comma-separated). Missing or malformed configuration denies access. Do not use a display name, email, mutable user metadata, complimentary Pro plan, site membership, editor token or assistant bearer token as platform financial permission.

The account identity comes from `AccountAuth.identity`, which uses Supabase Auth `getUser` verification. The server gates page/API reads and budget changes before reading platform counts, budget storage or Paddle. All owner responses use `private, no-store` and `noindex, nofollow`; routes exist only on the editor host. Browser budget mutations require the configured trusted origin even when unrelated bearer/session headers are present.

## Server configuration

| Setting | Purpose |
|---|---|
| `PAGECRAFT_OWNER_AUTH_USER_IDS` | Verified auth UUID allowlist, never a profile ID |
| `PADDLE_API_KEY` | Optional server-only read credential |
| `PADDLE_ENVIRONMENT` | `sandbox` by default; `live` must be explicit |
| `PAGECRAFT_PUBLICATION_ROOT` | This environment's persistent private storage root |

Without a Paddle key, the dashboard is fully usable for cost budgets and reports `not_connected`. Invalid environment names stop startup rather than silently selecting live. Keep sandbox keys on staging and live keys only in the isolated production configuration. Do not paste credentials into chat or commit them. [Paddle authentication guidance](https://developer.paddle.com/api-reference/about/authentication/)

The read key needs subscription and transaction read access and sufficient adjustment read permission for the `include=adjustments` request. Assign the minimum needed permissions in the provider. This integration never makes mutating provider requests. API origins are selected internally, HTTPS-only, with redirects rejected and exact-origin pagination validation. Requests have timeouts, byte/row/page bounds; failures are redacted. Partial retrieval or omitted malformed financial records are explicitly marked, never described as complete totals.

This is not the future checkout credential/signature setup. Customer subscription provisioning will need a separately reviewed integration, trusted price mapping and verified webhooks.

## Storage and money

Budgets persist at `<publication root>/.owner-billing/costs.json`. The directory is private operational storage, not a published site. Temporary writes are 0600 and atomically renamed; same-process writers to one path serialize. Back up this small private file with the environment's persistent data. Filesystem storage is designed for the current single-process hosting model; distributed writers would require shared database transactions or locking before horizontal scale.

Entries have stable UUIDs, bounded labels, categories, currencies and nonnegative integer minor-unit amounts. Input uses the selected currency's decimal precision; values never pass through floating-point arithmetic. Currency totals remain independent. Storage failures display unavailable and suppress budget totals/forms; no failed read is shown as an empty budget.

## Routes and verification

- `GET /owner/billing`: owner dashboard; anonymous requests redirect to sign-in, ordinary users receive 403.
- `GET /api/owner/billing`: private JSON; unauthenticated 401, non-owner 403.
- `POST /owner/billing/costs`: create/edit monthly budget using the same-origin form, 8 KiB body limit.
- `POST /owner/billing/costs/:id/remove`: owner removal of a budget row.

Verify an ordinary authenticated account with an identical display name/plan cannot access financial data. Verify the allowlisted account can add/edit/reload/remove a clearly disposable QA budget; clean up only that QA row, preserving existing budgets. Review desktop and tablet rendering, keyboard focus, validation, request recovery, table overflow and no-store headers. Sandbox financial UI can be exercised with isolated fixtures, but must be labeled as test data and is not proof of live Paddle integration.

The production/staging database is currently shared under the approved prelaunch arrangement. This feature does not change database permissions/schema or entitlements. Budgets remain in the separate environment publication root. Keep staging background workers disabled. Isolate production before live customer billing.
