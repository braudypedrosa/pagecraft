# Pagecraft HQ founder CRM operations

## Product boundary

**Pagecraft HQ** is a standalone private CRM intended for `https://reports.itspagecraft.com`. It has its own navigation, sign-in, styles, server entry point and private storage. The customer Pagecraft application exposes no CRM or financial routes and no founder navigation.

The current dataset is **staging**, as explicitly selected by the founder. A reports deployment does not promote data to production. The reports process does not boot the editor, create Pagecraft profiles, initialize database schemas, run service/background workers, publish sites, provision paid subscriptions or send customer messages.

## Screens and available data

| Screen | Purpose |
|---|---|
| Overview | Accounts, unique sites, activated accounts, recurring catalog-price estimates, account creation and completed-charge trends, plan mix, CRM pipeline and due follow-ups |
| Customers | Searchable account/lead directory; company, stage, source, notes, follow-up date and test-record annotations |
| Pipeline | Lead, contacted, qualified, customer and archived stages, with stage filters and follow-ups |
| Revenue | Provider subscriptions, past-due estimates, transactions, taxes, payout earnings, fees and approved adjustments, separated by currency |
| Costs | Private monthly cost budgets; exact currency amounts and edit/remove actions |
| Reports | Metric definitions, site creation trend, manual source distribution and five CSV exports |
| Sources | Availability, retrieval coverage and measurement gaps |

CRM annotations never change a Pagecraft profile, plan, membership or paid entitlement. A manual lead with the same normalized email as an account is merged into the directory. The first verified account edit may attach that lead to its account; afterward the account link is immutable. Linked names and emails come from the verified platform snapshot. Conflicting revisions preserve the submitted draft and ask for a reload instead of silently overwriting a newer edit. Archive records by selecting the Archived stage.

## Metric definitions

- Account profiles are Pagecraft application profiles, including legacy/unlinked profiles. They are not all paying customers.
- Current plan mix is assigned plans, including complimentary/internal plans. It is not subscription revenue.
- Activation is the percentage of retrieved, verified Auth-linked profiles with at least one owned published site. Verified profiles with no sites remain in the denominator. This is a current snapshot, not period conversion.
- Site totals count unique retrieved site IDs, avoiding double-counting co-owned sites.
- Media bytes match Pagecraft quota ownership: assets by `assets.owner_id`, plus library assets by the owning library. Retired assets remain included, matching current quota accounting.
- Account and site creation trends use profile timestamps and earliest site-revision timestamps. They are not traffic or daily active users.
- Periods are rolling 30, 90 and 365 days. Charts use daily, weekly and monthly UTC buckets respectively; first/last buckets can be partial. Underlying records remain bounded by the exact period shown.
- Due follow-ups have a date on or before the current UTC day and are not archived. Future follow-ups remain visible in the directory.
- The test-record filter applies to marked CRM records and matched account/site metrics. It does not infer that a Paddle transaction is a test from a CRM annotation; the provider environment is labeled independently.
- Current recurring estimates use active catalog prices, not a recognized-revenue ledger. Completed gross charges, taxes, fees, adjustments and payout earnings use provider-supplied amounts. Missing payout details remain unavailable.
- Monthly cost budgets are planning figures, not actual expense records. They are not used to invent profit or margins.

Traffic, acquisition sessions, customer acquisition cost, churn and retention require additional data sources and are explicitly unmeasured. Manual CRM source attribution is shown as such. No Paddle account/key is currently connected, so hosted revenue metrics remain unavailable rather than showing false zeroes. Local QA uses an unmistakably labeled synthetic dataset and sandbox-payment fixture.

## Authorization and privacy

Only verified Supabase Auth UUIDs in `PAGECRAFT_OWNER_AUTH_USER_IDS` can read or change CRM data. Missing/malformed configuration stops startup. A display name, email, user metadata, Pro plan, site membership, editor token or assistant bearer token never grants founder access.

The reports host verifies the account through Supabase Auth `getUser` and uses a separate host-only `pc_reports_auth` cookie. It offers existing-account sign-in only. Ordinary authenticated accounts receive 403. Every reports response is private/no-store and noindex/nofollow; same-origin checks cover sign-in, sign-out, CRM edits and budgets, including requests carrying bearer credentials. Fixed export names, bounded request bodies and per-founder throttles limit the surface.

The browser receives rendered records and private authenticated JSON, never database/provider secrets. CSV exports quote cells and escape spreadsheet formula prefixes. Exports retain selected period, test setting and currency metadata. Payment and budget rows are filtered to the requested currency; payout currency remains explicit. Unavailable required sources return 503 instead of a successful empty export.

## Runtime configuration

`server/src/reports-config.ts` allowlists reports settings. `server/src/reports-index.ts` may load them from the owner-only JSON file named by `PAGECRAFT_REPORTS_CONFIG`. This must be a regular file no larger than 32 KiB, inaccessible to group/other users, containing supported string settings only. Keep it outside the checkout; never commit or paste its contents.

| Setting | Purpose |
|---|---|
| `REPORTS_HOST`, `REPORTS_ORIGIN` | Exact reports hostname and trusted origin |
| `REPORTS_APP_ORIGIN` | Optional validated app origin retained for runtime compatibility |
| `REPORTS_DATA_ENVIRONMENT` | Visible `staging`, `production` or `unconfigured` data label |
| `PAGECRAFT_REPORTS_STORAGE_ROOT` | Absolute private directory for `costs.json` and `contacts.json` |
| `PAGECRAFT_OWNER_AUTH_USER_IDS` | Verified founder Auth UUID allowlist |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Existing-account authentication |
| `TURNSTILE_SITE_KEY` | Optional founder sign-in challenge |
| `DATABASE_GATEWAY_URL`, `DATABASE_GATEWAY_KEY`, `DATABASE_GATEWAY_REGION` | Existing dataset gateway for legacy inventory reporting |
| `REPORTS_DATA_GATEWAY_URL` | Separate read-only founder snapshot Edge Function, same trusted origin as the existing gateway |
| `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT` | Optional server-only Paddle reporting access, sandbox by default |

Invalid origins, insecure production endpoints, partial gateway settings, or unsupported environments stop startup. No secret/configuration appears in evidence.

The new `supabase/functions/pagecraft-reports` service accepts only `founder.snapshot`. It verifies the existing server-only gateway key against the stored SHA-256 hash before reading accounts/sites. It has no schema initialization or data mutation operations. Retrieval is bounded to 1,000 profiles and 5,000 sites and includes full inventory counts plus explicit complete/partial coverage. The existing Pagecraft database functions are left intact.

Paddle reporting uses fixed HTTPS provider origins, strict pagination origins, timeouts, bounded responses and partial/unavailable states. It reads subscriptions, transactions and included adjustments only. Use a sandbox key with the needed read permissions first. [Paddle authentication guidance](https://developer.paddle.com/api-reference/about/authentication/)

Checkout/webhook credentials and provisioning remain separate work: trusted prices, verified signed webhooks, durable event handling and explicit entitlement policy are required before live billing.

## Private storage

CRM contacts and monthly cost budgets belong to the independent reports deployment. New files use owner-only permissions and atomic rename; same-process writers serialize. CRM reads reject non-private files, symlinks, invalid records and oversized files. CRM revisions reject stale updates, duplicate emails and conflicting account links. Failed reads produce an unavailable state, not fabricated empty results.

Back up the private reports data directory independently of customer publication storage. Current limits are 2,000 CRM annotations/leads, a 2 MiB CRM file and 100 budget rows. Filesystem persistence suits the current single-process design. Multiple reports processes require shared transactions or cross-process locking before scaling.

## Routes

These routes exist only in the reports process:

- `GET /` and `GET /owner/billing`: compatibility redirects to `/overview`.
- `GET /overview`, `/customers`, `/pipeline`, `/revenue`, `/costs`, `/reports`, `/sources`: private CRM screens.
- `GET /sign-in`, `POST /auth/sign-in`, `POST /auth/logout`: separate founder session.
- `GET /api/crm/summary`: private CRM/analytics JSON.
- `POST /crm/contacts`: create/edit founder annotations or a manual lead.
- `GET /exports/customers.csv`, `/pipeline.csv`, `/payments.csv`, `/budgets.csv`, `/metrics.csv`: private CSV exports under `/exports`.
- `GET /api/owner/billing`: retained private financial API.
- `POST /owner/billing/costs`, `/owner/billing/costs/:id/remove`: budget writes returning to `/costs`.
- `GET /__deployment`: host-gated private/no-store deployment identity.

## Deployment and launch boundaries

The hosting account has a separate Node 24 application named `pagecraft-reports`, its own fixed-root startup, protected runtime configuration and data directory. It receives an immutable clone of an exact tested staging source release. Customer checkout, cookies and writable data are independent.

Public activation still requires the reports DNS record and valid HTTPS. Create a DNS-only `A` record named `reports` pointing to `67.223.118.197`, then provision/verify TLS. Run `tools/deploy/activate_reports.py <tested development commit>` on the hosting account. The helper tests native boot, denies anonymous financial access, rejects customer routes, switches only the reports pointer and verifies the exact release via real HTTPS. Failure restores the previous reports pointer. Preserve the active release and rollback copy when pruning.

After the hostname is ready, the founder must sign in through the dedicated reports page and verify real staging data. Do not claim public availability or authenticated founder acceptance from a local sample-data screenshot, an Edge Function deployment or a successful CI run.

At customer launch, prepare the clean isolated production database separately. Change the reports gateway and `REPORTS_DATA_ENVIRONMENT` together only when it is ready; verify source counts and the Production data badge. The staging and production dataset currently remain shared, so this work does not authorize live payments or a production promotion.

## Acceptance checks

1. Confirm exact `/__deployment` release, private/no-store headers and visible dataset label.
2. Confirm ordinary accounts, editor tokens and wrong-host requests cannot read CRM/financial data or write annotations.
3. Verify founder sign-in/sign-out, lead create/edit/reload/archive, stale revisions and matched-account identity protection.
4. Verify search/plan/stage filters, archived records, test exclusion, UTC follow-up dates and all three reporting periods.
5. Verify exact minor-unit money, separate currencies, missing/partial provider details, and budget create/edit/remove without touching existing records.
6. Review real rendered desktop/tablet screens, readable chart values, keyboard focus, error drafts and contained table overflow. Mobile is outside the product scope.
7. Verify all CSV exports and spreadsheet-safe text; unavailable sources must fail explicitly.
8. Confirm customer Pagecraft still has no CRM/financial navigation or routes.

Local native HTTP tests exercise actual fixture writes independently of the browser. Built-in-browser POSTs were blocked by its inspector during this task; do not describe those mutations as browser-verified until the blocking condition is resolved. UI navigation/filters and rendered states are verified separately.
