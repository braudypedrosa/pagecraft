# Pagecraft: first customers and billing

Prepared 9 October 2026, Asia/Manila. The owner dashboard is a reporting foundation. A Paddle account, checkout, paid-plan provisioning, customer billing portal, and production launch are not yet complete.

## Start here

1. **Choose one initial audience:** freelancers and small web studios delivering client sites. Demonstrate the complete build → client review → publish/export workflow. Position Pagecraft around an approachable editor, reusable native content and export ownership. Avoid a “cheapest overall” claim.
2. **Recruit 5–10 guided beta users.** Use a short screen recording, a clear beta invitation and a concrete example site. Watch each person create a site, edit a template, ask for review and publish. Record where they need help and whether they return. Promote the free beta honestly while billing is being prepared.
3. **Create your Paddle accounts yourself:** [live account](https://login.paddle.com/) and [separate sandbox account](https://sandbox-login.paddle.com/). You complete identity verification, payment details and acceptance of terms. Your account does not exist yet, so dashboard financial totals are unavailable.
4. **Prepare the public purchase information:** product features, final prices and allowances, support contact, terms, privacy and refund policy. Identify the seller accurately in the terms. Submit the actual production checkout domain/subdomain for approval. Paddle requires HTTPS and accessible purchase policies; sandbox testing does not require domain approval. [Paddle domain review](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)
5. **Connect sandbox and finish subscription billing.** Run the acceptance cases below. Provision an isolated production database before real customers or live paid entitlements, then prove the production deployment and customer journey. Production promotion remains a separate action.
6. **Start a controlled paid launch** after the provider, product, support and production checks pass. Begin with a small cohort and measure usage/support costs before increasing advertising.

Pagecraft is a tablet/desktop editing app. Beta onboarding and advertising should explain that supported editing experience; mobile-device builder QA is outside this launch scope.

## Plans to finalize before creating provider prices

| Plan | Proposed charge | Proposed owned sites | Primary use |
|---|---|---|---|
| Free | $0 | **1 total, including drafts** | Learn and publish a small site |
| Launch | $10/month or $96/year | 5, with 1 custom-domain hosted publication | A first business or client site |
| Studio | $24/month or $228/year | 20, with 5 custom-domain hosted publications | Freelancers and small studios |

Paid rates and resource allowances remain proposals. The user confirmed the one-site Free policy, but the existing entitlement catalog still enforces three sites; implement and verify the one-site limit before presenting that allowance as available. Preserve existing Free sites and block additional creation at or above the new allowance.

The [full pricing and margin proposal](../../research/pricing-2026-10-09/pricing-proposal.md) is in the adjacent project research folder. It includes storage, bandwidth, forms, CMS, seats, comparison commitments and cost assumptions. The private complimentary Pro plan remains a testing entitlement, not proof of payment or a platform administrator role. Domain registration is separate.

Replace the model's assumptions with actual invoices and representative customer usage. Include infrastructure, email, media/traffic, support time, refunds, acquisition cost and founder compensation in the price floor. Paddle currently advertises 5% + $0.50 per checkout and no setup/monthly fee; sub-$10 products are directed to bespoke pricing. [Paddle pricing](https://www.paddle.com/pricing)

## What the owner dashboard shows

Open `/owner/billing` from the owner account's Billing link. Other users cannot obtain access by changing their name, email metadata or plan. The server verifies the signed-in Supabase auth UUID against a private deployment allowlist.

- Platform site inventory, including QA sites. Global account count is unavailable until an authorized aggregate source is implemented.
- Paddle connection status, sandbox/live environment, refresh time and partial-data warnings.
- Active monthly and annualized recurring **catalog-price estimates**, with past-due value separate. Discounts and price tax modes mean these are not audited net MRR.
- Completed customer charges, tax, provider payout earnings/fees and approved adjustments for a fixed trailing 30-day UTC billing window, grouped by currency.
- Recent completed receipts and current active/past-due subscription records.
- Editable persistent **monthly cost budgets** for hosting, database, email, marketing and other costs. These are planning figures, not actual invoices. They are not subtracted from 30-day receipts to invent a profit number.

No Paddle connection means unknown financial metrics, not zero revenue. Payout figures are provider earnings before separate operating costs and are not proof of a bank deposit. Adjustment totals concern the retrieved transactions, including their returned adjustments; they are not a complete refund ledger by refund issue date. Provider payout currencies may differ from checkout currencies and remain separate. No currency conversion or cross-currency summing occurs.

## Subscription billing still to implement

The reporting dashboard makes only read requests to Paddle. It does not create subscriptions, open checkout, charge customers, issue refunds, change their plans or grant paid access.

The customer billing integration needs:

1. Final public plan catalog and server-side resource enforcement. Map trusted Paddle price IDs to account entitlements and billing intervals; do not accept a browser-supplied price or plan name as authority.
2. A logged-in checkout flow tied to the verified Pagecraft account and the correct sandbox/live provider environment.
3. Raw-body webhook signature verification, durable event storage, `event_id` deduplication and `occurred_at` ordering. Verify events against provider state when needed; handle retries/reconciliation and preserve later subscription changes. Checkout redirects alone must not activate paid plans. [Paddle provisioning guide](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/)
4. A persistent customer/subscription mirror linked to the verified Pagecraft owner account, with explicit active, trial, past-due, paused and canceled policy. Decide grace periods and downgrade behavior before launch. Preserve customer content when limits fall; block new excess usage instead of deleting sites.
5. Customer self-service for receipts, card updates and cancellation through the provider's billing portal. Show the next billing date and scheduled cancellation clearly.
6. Cost and acquisition reporting based on actual invoices and verified conversion events. The dashboard currently has budgets, not invoice reconciliation, SaaS signup attribution, CAC, conversion rate or audited profit.

## Sandbox acceptance cases

| Journey | Required result |
|---|---|
| Monthly and annual checkout | Correct plan, currency, tax presentation and billing interval; verified webhook provisions the matching account |
| Abandon or fail checkout | No paid access granted |
| Renew and fail renewal | Provider status and documented grace/access policy stay consistent |
| Upgrade/downgrade | Proration and next charge disclosed; quotas update without deleting customer content |
| Cancel now/end of term | Portal and Pagecraft show the effective date; entitlement follows the agreed policy |
| Refund/adjustment | Receipt, reporting and entitlement treatment match the provider state; approval is deliberate |
| Duplicate/out-of-order webhook | No duplicate grant, charge or regression to older state |
| Wrong signature/account/price/environment | Rejected; no entitlement changes |
| Provider timeout/revoked key | Clear unavailable state; no fake totals or accidental plan downgrade |
| Owner and ordinary user | Financial data available only to the allowlisted verified owner |

Real sandbox/provider integration is unverified until the accounts and credentials exist. A mocked API or a passing unit test does not substitute for these customer journeys.

## First advertising experiment

Begin with an organic beta message and product demonstration. Suggested positioning:

> Build, review and launch client-ready websites with an approachable visual editor and export ownership.

Use one audience, one concrete site example and one call to action. Show actual Pagecraft UI and a real output site. Avoid implying that checkout, public paid plans, AI inference credits or features still in development are available.

For the first paid experiment, use a **suggested total cap of $50–$100** after activation and billing work. This is a planning proposal, not approved spend or a prediction of conversions. Keep the experiment small enough to inspect each signup. Choose a channel based on where the beta audience responds; do not buy several channels simultaneously before there is evidence.

Record campaign/source identifiers and these aggregated steps: landing visit → signup → site creation → first publish → paid subscription → continued use. Collect only what the product needs and disclose analytics appropriately. Pagecraft's opt-in published-site visitor analytics do not currently measure this SaaS acquisition funnel; instrumentation is a separate implementation task.

Evaluate cost per activated account and paying account, retained customers and support effort. Set an affordable acquisition ceiling from measured contribution margin and runway. Click-through rate alone is insufficient. Pause an experiment that produces signups who cannot complete the first site, and fix onboarding before spending more.

## Business setup

You said the business is not registered. Confirm your jurisdiction, registration/tax obligations and invoicing with a local qualified adviser before taking paid customers. Paddle onboarding status does not establish local compliance or remove income-tax obligations. This guide does not assume a country or invent registration/setup costs. Record the seller identity and policies accurately; do not declare a foreign business that has not been formed.

## Suggested first week

| When | You | Pagecraft development |
|---|---|---|
| Day 1 | Create Paddle live and sandbox accounts; gather real recurring costs | Review owner dashboard and populate genuine cost budgets |
| Days 2–3 | Finalize audience, price policy, seller identity and public purchase policies | Implement confirmed plan enforcement, checkout mapping and signed webhook handling |
| Days 3–5 | Run guided beta sessions; prepare one demo | Test renewal/cancellation/failure cases and production database isolation |
| After acceptance | Approve launch and any advertising budget | Verify exact production commit and one controlled real purchase with explicit authorization |

These are work phases, not guaranteed provider approval or engineering completion dates. Domain review can require additional information; do not promise an opening date until the provider and production checks pass.
