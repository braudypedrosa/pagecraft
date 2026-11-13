import { test } from 'vitest';
import a from 'node:assert/strict';
import { formatOwnerMoney, ownerBillingBody } from '../src/owner-billing-page.ts';
import type { OwnerBillingLoadResult } from '../src/owner-billing.ts';
import type { User } from '../src/auth.ts';
import { accountSettingsPage, dashboardPage, founderReportsSignInPage, ownerBillingPage } from '../src/account-pages.ts';

type Data = Extract<OwnerBillingLoadResult, { status: 'ok' }>;

const base = (overrides: Partial<Data> = {}): Data => ({
  status: 'ok',
  generatedAt: '2026-10-09T00:00:00.000Z',
  platform: { siteCount: 9, accountCount: null },
  costs: { state: 'available', basis: 'monthly_budget', rows: [], totals: [] },
  billing: { state: 'not_connected', environment: null },
  ...overrides,
});

const founder: User = { id: 'founder-1', email: 'founder@example.test', name: 'Founder' };

test('disconnected billing is truthful and does not render invented zero totals', () => {
  const html = ownerBillingBody(base());
  a.match(html, /Paddle not connected/);
  a.match(html, /No provider revenue or paid transaction total is available/);
  a.match(html, /including QA sites/);
  a.match(html, /account metric is not configured/i);
  a.doesNotMatch(html, /USD\s*0\.00|\$0\.00|Revenue[^<]*0/);
  a.match(html, /href="#overview"/);
  a.match(html, /href="#costs"/);
  a.match(html, /href="#start"/);
  a.match(html, /https:\/\/login\.paddle\.com/);
  a.match(html, /https:\/\/sandbox-login\.paddle\.com/);
  a.match(html, /Checkout and paid-plan activation still need to be implemented/);
  a.match(html, /\.dashboard-app \.pc-owner-billing \.pc-workspace-head\{align-items:flex-end;margin:0\}/);
  a.ok(html.indexOf('href="#overview"') < html.indexOf('href="#costs"'));
  a.ok(html.indexOf('href="#costs"') < html.indexOf('href="#start"'));
  a.ok(html.indexOf('id="costs"') < html.indexOf('id="start"'));
  a.equal((html.match(/Paddle is not connected/g) || []).length, 1);
  a.doesNotMatch(html, /href="#subscriptions"|href="#payments"/);
});

test('sandbox billing is labelled, separates financial concepts, and exposes no customer PII', () => {
  const data = base({
    platform: { siteCount: 12, accountCount: 3 },
    billing: {
      state: 'connected', environment: 'sandbox', coverage: 'partial',
      coverageNote: 'Provider pagination limit reached; totals cover only retrieved records.',
      period: { kind: 'last_30_days_utc', startsAt: '2026-09-09T00:00:00.000Z', endsAt: '2026-10-09T00:00:00.000Z' },
      activeRecurringEstimate: [{ currencyCode: 'USD', monthlyEstimateMinor: '1000', annualizedEstimateMinor: '12000' }],
      atRiskRecurringEstimate: [{ currencyCode: 'USD', monthlyEstimateMinor: '500', annualizedEstimateMinor: '6000' }],
      recurringEstimateNote: 'Estimate note.',
      completedGrossCustomerCharges: [{ currencyCode: 'USD', amountMinor: '2200' }],
      completedTax: [{ currencyCode: 'USD', amountMinor: '200' }],
      completedPayoutEarnings: [{ currencyCode: 'PHP', amountMinor: '95000' }],
      completedPayoutFees: [{ currencyCode: 'PHP', amountMinor: '5000' }],
      approvedAdjustments: [{ currencyCode: 'USD', amountMinor: '-400' }],
      financialDataNote: 'Financial note.',
      subscriptions: [{ id: 'sub_safe', customerId: 'ctm_private', status: 'active', currencyCode: 'USD', billingInterval: 'month', billingFrequency: 1, nextBilledAt: '2026-11-01T00:00:00Z', scheduledChange: null, itemCount: 1 }],
      recentTransactions: [{ id: 'txn_safe', customerId: 'ctm_private', subscriptionId: 'sub_safe', invoiceNumber: 'INV-1', status: 'completed', currencyCode: 'USD', billedAt: '2026-10-08T00:00:00Z', grossCustomerChargeMinor: '2200', taxMinor: '200', payoutCurrencyCode: 'PHP', payoutEarningsMinor: '95000', payoutFeeMinor: '5000', approvedAdjustmentsMinor: '-400' }],
    },
  });
  const html = ownerBillingBody(data);
  a.match(html, /Sandbox · test data/);
  a.match(html, /Partial provider data/);
  a.match(html, /Gross customer charges/);
  a.match(html, /Payout earnings/);
  a.match(html, /Approved refunds \/ adjustments/);
  a.match(html, /USD\s*22\.00/);
  a.match(html, /PHP\s*950\.00/);
  a.doesNotMatch(html, /ctm_private/);
  a.doesNotMatch(html, /id="start"|href="#start"/);
});

test('money formatting preserves bigint precision and ISO currency decimal rules', () => {
  a.equal(formatOwnerMoney('900719925474099312345', 'USD'), 'USD\u00a09,007,199,254,740,993,123.45');
  a.equal(formatOwnerMoney('123456', 'JPY'), 'JPY\u00a0123,456');
  a.equal(formatOwnerMoney('123456', 'KWD'), 'KWD\u00a0123.456');
  a.equal(formatOwnerMoney('-400', 'USD'), '-USD\u00a04.00');
  a.equal(formatOwnerMoney('not-an-integer', 'USD'), 'Unavailable');
});

test('cost rows, edit links and form values are escaped and use the specified routes', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const html = ownerBillingBody(base({
    costs: {
      state: 'available', basis: 'monthly_budget',
      totals: [{ currencyCode: 'USD', amountMinor: '1234' }],
      rows: [{ id, label: '<img src=x onerror=alert(1)>', category: 'hosting', amountMinor: '1234', currencyCode: 'USD', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }],
    },
  }), { editCostId: id, error: '<script>alert(1)</script>' });
  a.doesNotMatch(html, /<img src=x|<script>alert/);
  a.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  a.match(html, new RegExp(`href="/owner/billing\\?edit=${id}#costs"`));
  a.match(html, new RegExp(`action="/owner/billing/costs/${id}/remove"`));
  a.match(html, /action="\/owner\/billing\/costs"/);
  a.match(html, /name="amount"[^>]*value="12\.34"/);
  a.match(html, /The budget change could not be completed/);
  a.doesNotMatch(html, /apiKey|sandbox-api\.paddle\.com|<script[^>]+src=/i);
});

test('provider failure withholds stale totals and offers a safe retry', () => {
  const html = ownerBillingBody(base({
    billing: { state: 'unavailable', environment: 'live', reason: 'provider_response_invalid' },
  }));
  a.match(html, /Paddle data is temporarily unavailable/);
  a.match(html, /totals are hidden/i);
  a.match(html, /href="\/owner\/billing">Retry/);
  a.doesNotMatch(html, /provider_response_invalid/);
});

test('failed cost submissions retain escaped draft values over stored edit values', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const html = ownerBillingBody(base({
    costs: { state: 'available', basis: 'monthly_budget', totals: [], rows: [{
      id, label: 'Stored label', category: 'hosting', amountMinor: '1000', currencyCode: 'USD',
      createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    }] },
  }), {
    editCostId: id,
    error: 'amount_invalid',
    draftCost: { id, label: 'Draft <label>', category: 'database', amount: '12.345', currencyCode: 'NZD' },
  });
  a.match(html, /value="Draft &lt;label&gt;"/);
  a.match(html, /value="database" selected/);
  a.match(html, /name="amount"[^>]*value="12\.345"/);
  a.match(html, /<select id="cost-currency" name="currencyCode" required>/);
  a.match(html, /<option value="NZD" selected>NZD<\/option>/);
  for (const currency of ['USD', 'PHP', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY', 'BHD']) {
    a.match(html, new RegExp(`<option value="${currency}"`));
  }
  a.match(html, /id="cost-amount"[^>]*aria-invalid="true"/);
  a.match(html, /Enter a positive amount or zero using the currency’s decimal places/);
  a.match(html, /id="cost-amount"[^>]*pattern="\[0-9\]\+\(\[\.\]\[0-9\]\{1,2\}\)\?"/);
  a.match(html, /aria-describedby="cost-form-feedback cost-amount-help"/);
  a.doesNotMatch(html, /value="Stored label"/);
});

test('a stale edit id shows recovery instead of silently becoming a new budget', () => {
  const html = ownerBillingBody(base(), { editCostId: '123e4567-e89b-42d3-a456-426614174099' });
  a.match(html, /Budget row not found/);
  a.match(html, /Return to budgets/);
  a.doesNotMatch(html, /<form[^>]*data-owner-cost-form/);
});

test('unsupported draft currency offers recovery rather than becoming a valid option', () => {
  const html = ownerBillingBody(base(), {
    error: 'currency_invalid',
    draftCost: { id: '', label: 'Hosting', category: 'hosting', amount: '12.34', currencyCode: 'ZZZ' },
  });
  a.doesNotMatch(html, /<option value="ZZZ"/);
  a.match(html, /<option value="" selected>Choose currency<\/option>/);
  a.match(html, /Choose a supported currency/);
  a.match(html, /Choose a currency to confirm the allowed decimal places/);
  a.match(html, /id="cost-currency"[^>]*aria-invalid="true"/);
});

test('provider failure offers retry without showing first-time setup steps', () => {
  const html = ownerBillingBody(base({
    billing: { state: 'unavailable', environment: 'sandbox', reason: 'provider_unavailable' },
  }));
  a.match(html, /Paddle data is temporarily unavailable/);
  a.doesNotMatch(html, /id="start"|Create both Paddle accounts/);
});

test('budget feedback stays inside costs and currency precision guidance follows ISO digits', () => {
  const html = ownerBillingBody(base(), { message: 'saved' });
  a.ok(html.indexOf('id="costs"') < html.indexOf('data-owner-feedback'));
  a.match(html, /USD allows up to 2 decimal places/);
  a.match(html, /id="cost-amount"[^>]*aria-describedby="cost-amount-help"/);

  const jpy = ownerBillingBody(base(), {
    draftCost: { id: '', label: 'Hosting', category: 'hosting', amount: '1000', currencyCode: 'JPY' },
  });
  a.match(jpy, /pattern="\[0-9\]\+" placeholder="0" value="1000"/);
  a.match(jpy, /JPY uses whole amounts/);

  const bhd = ownerBillingBody(base(), {
    draftCost: { id: '', label: 'Hosting', category: 'hosting', amount: '1.234', currencyCode: 'BHD' },
  });
  a.match(bhd, /pattern="\[0-9\]\+\(\[\.\]\[0-9\]\{1,3\}\)\?"/);
  a.match(bhd, /BHD allows up to 3 decimal places/);
});

test('founder reports render in a standalone shell with an explicit trusted data source', () => {
  const html = ownerBillingPage(founder, base(), {}, {
    dataEnvironment: 'staging',
    appOrigin: 'https://app.itspagecraft.com/account?ignored=true',
  });
  a.match(html, /<title>Founder reports — Pagecraft<\/title>/);
  a.match(html, /<strong>Founder reports<\/strong>/);
  a.match(html, /Private founder view of Pagecraft subscriptions/);
  a.match(html, /data-environment="staging">Staging data/);
  a.match(html, /href="https:\/\/app\.itspagecraft\.com">Open Pagecraft<\/a>/);
  a.match(html, /action="\/auth\/logout"/);
  a.doesNotMatch(html, /data-notify-root|id="account-menu"|class="pc-rail"|Account settings/);
});

test('founder reports reject non-http app origins and always label an unconfigured source', () => {
  const html = ownerBillingPage(founder, base(), {}, {
    dataEnvironment: 'unconfigured',
    appOrigin: 'javascript:alert(1)',
  });
  a.match(html, /data-environment="unconfigured">Data source unconfigured/);
  a.doesNotMatch(html, /javascript:|Open Pagecraft/);
});

test('founder sign in uses only the existing-account flow and optional configured challenge', () => {
  const html = founderReportsSignInPage({
    error: 'auth',
    appOrigin: 'https://app.itspagecraft.com',
    dataEnvironment: 'production',
    challengeSiteKey: 'site-key-123',
  });
  a.match(html, /data-environment="production">Production data/);
  a.match(html, /action="\/auth\/sign-in"/);
  a.match(html, /name="email" type="email"[^>]*autocomplete="email"/);
  a.match(html, /name="password" type="password"[^>]*autocomplete="current-password"/);
  a.match(html, /We could not sign you in with those details/);
  a.match(html, /class="cf-turnstile" data-sitekey="site-key-123" data-action="founder_sign_in"/);
  a.match(html, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  a.doesNotMatch(html, /action="\/auth\/google"|href="\/sign-up"|>Continue with Google</i);
});

test('ordinary customer dashboard and account settings contain no founder billing navigation', () => {
  const dashboard = dashboardPage(founder, [], 0, { usedBytes: 0, limitBytes: 100 * 1024 * 1024 });
  const account = accountSettingsPage(founder, {
    providers: ['email'], ownerCount: 0, storage: { usedBytes: 0, limitBytes: 100 * 1024 * 1024 },
  });
  for (const html of [dashboard, account]) {
    a.doesNotMatch(html, /href="\/owner\/billing"|Owner billing|Founder reports/);
  }
});
