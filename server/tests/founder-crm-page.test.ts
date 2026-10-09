import a from 'node:assert/strict';
import { test } from 'vitest';
import type { User } from '../src/auth.ts';
import { founderCrmPage, founderCrmSignInPage } from '../src/founder-crm-page.ts';
import type { FounderCrmData, FounderCrmPageInput } from '../src/founder-crm-types.ts';

const founder: User = {
  id: 'founder-1', name: 'Braudy <Founder>', email: 'founder@example.test',
};

const base = (overrides: Partial<FounderCrmData> = {}): FounderCrmData => ({
  generatedAt: '2026-10-09T01:30:00.000Z',
  range: '30d',
  periodStart: '2026-09-10T00:00:00.000Z',
  periodEnd: '2026-10-09T23:59:59.999Z',
  includeTests: false,
  platform: {
    state: 'available',
    snapshot: {
      accountTotal: 2, siteTotal: 3, coverage: 'complete',
      accounts: [], sites: [],
    },
  },
  crm: { state: 'available', contacts: [] },
  customers: [],
  analytics: {
    accountGrowth: [{ date: '2026-09-10', value: 0 }, { date: '2026-10-09', value: 2 }],
    siteGrowth: [], newAccounts: 2,
    activation: { eligibleAccounts: 2, publishedAccounts: 1, rate: 50 },
    planMix: [{ label: 'free', value: 2 }],
    pipeline: [{ stage: 'lead', value: 0 }, { stage: 'customer', value: 1 }],
    sources: [], followUps: [], chargeHistory: [],
  },
  billing: {
    status: 'ok', generatedAt: '2026-10-09T01:30:00.000Z',
    platform: { siteCount: 3, accountCount: 2 },
    costs: { state: 'available', basis: 'monthly_budget', rows: [], totals: [] },
    billing: { state: 'not_connected', environment: null },
  },
  ...overrides,
});

const input = (overrides: Partial<FounderCrmPageInput> = {}): FounderCrmPageInput => ({
  section: 'overview', dataEnvironment: 'staging', ...overrides,
});

test('renders a standalone Founder CRM shell with preserved report controls', () => {
  const html = founderCrmPage(founder, base(), input());
  a.match(html, /^<!doctype html>/);
  a.match(html, /Pagecraft HQ/);
  a.match(html, /Founder CRM/);
  a.match(html, /aria-label="Founder CRM"/);
  a.match(html, /href="\/customers\?range=30d&amp;tests=exclude&amp;currency=USD"/);
  a.match(html, /name="range"/);
  a.match(html, /<option value="12m">Past year \(365 days\)<\/option>/);
  a.match(html, /name="tests"/);
  a.match(html, /action="\/auth\/logout"/);
  a.match(html, /data-environment="staging">Staging data/);
  a.match(html, /class="period-window">Period <time datetime="2026-09-10T00:00:00\.000Z">Sep 10, 2026<\/time>–<time datetime="2026-10-09T23:59:59\.999Z">Oct 9, 2026<\/time> UTC<\/span>/);
  a.doesNotMatch(html, /Open Pagecraft/);
  a.doesNotMatch(html, /pc-founder-topbar|pc-workspace-head/);
  a.doesNotMatch(html, /Local sample data/);
});

test('preview labeling is explicit, escaped, and opt-in on dashboard and sign-in', () => {
  const previewInput = { ...input(), previewLabel: 'QA <fixture>' } as FounderCrmPageInput & { previewLabel: string };
  const page = founderCrmPage(founder, base(), previewInput);
  const signIn = founderCrmSignInPage({ dataEnvironment: 'staging', previewLabel: 'QA <fixture>' });
  for (const html of [page, signIn]) {
    a.match(html, /Local sample data/);
    a.match(html, /QA &lt;fixture&gt; · This preview does not contain live business records/);
    a.doesNotMatch(html, /QA <fixture>/);
  }
});

test('overview chart has keyboard-readable values and a disclosed data table', () => {
  const html = founderCrmPage(founder, base(), input());
  a.match(html, /Account creation trend/);
  a.match(html, /<g class="chart-point" tabindex="0" role="img" aria-label="2026-10-09: 2"><title>2026-10-09: 2<\/title>/);
  a.match(html, /class="chart-y-axis" aria-hidden="true"><span>2<\/span><span>0<\/span>/);
  a.match(html, /class="chart-x-axis" aria-hidden="true"><span>Sep 10<\/span><span><\/span><span>Oct 9<\/span>/);
  a.match(html, /preserveAspectRatio="none" role="img" aria-label="Account creation trend\. Values range from 0 to 2\."/);
  a.match(html, /<summary>View chart data<\/summary>/);
  a.match(html, /<th>Date<\/th><th>Value<\/th>/);
  a.match(html, /Paddle is not connected\. No revenue trend is shown/);
  a.doesNotMatch(html, /USD(?:&nbsp;|\s)0\.00/);
});

test('overview uses filtered visible counts and labels a partial snapshot as retrieved coverage', () => {
  const customer = {
    id: 'account:visible', accountId: 'visible', contactId: null,
    name: 'Visible', email: 'visible@example.test', company: '', plan: 'free',
    ownedSites: 2, publishedSites: 1, mediaBytes: 0, joinedAt: '2026-10-01T00:00:00Z',
    lastEditedAt: null, stage: 'lead' as const, source: 'unknown' as const,
    notes: '', followUpOn: null, isTest: false, revision: null,
  };
  const data = base({
    customers: [customer],
    platform: { ...base().platform, snapshot: {
      ...base().platform.snapshot!, accountTotal: 1000, siteTotal: 2400, coverage: 'partial',
      accounts: [{ id: 'visible', authUserId: 'auth-visible', name: 'Visible', email: 'visible@example.test', plan: 'free', createdAt: '2026-10-01T00:00:00Z', ownedSites: 2, publishedSites: 1, mediaBytes: 0, lastEditedAt: null }],
      sites: [
        { id: 'site-1', ownerIds: ['visible'], name: 'One', slug: 'one', published: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
        { id: 'site-2', ownerIds: ['visible'], name: 'Two', slug: 'two', published: false, createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' },
      ],
    } },
  });
  const html = founderCrmPage(founder, data, input());
  a.match(html, /Partial Pagecraft coverage/);
  a.match(html, /Retrieved accounts<\/dt><dd>1<\/dd>/);
  a.match(html, /Retrieved sites<\/dt><dd>2<\/dd>/);
  a.match(html, /partial feed/);
  a.doesNotMatch(html, /Retrieved accounts<\/dt><dd>1,000<\/dd>/);
});

test('single-point counts and equal positive charges render safely with exact bigint money', () => {
  const data = base({
    analytics: {
      ...base().analytics,
      accountGrowth: [{ date: '2026-10-09', value: 4 }],
      chargeHistory: [{
        currencyCode: 'USD',
        points: [
          { date: '2026-09-10', amountMinor: '900719925474099312345' },
          { date: '2026-10-09', amountMinor: '900719925474099312345' },
        ],
      }],
    },
    billing: {
      ...base().billing,
      billing: {
        state: 'connected', environment: 'live', coverage: 'complete', coverageNote: null,
        period: { kind: 'last_30_days_utc', startsAt: '2026-09-10T00:00:00Z', endsAt: '2026-10-09T23:59:59Z' },
        activeRecurringEstimate: [{ currencyCode: 'USD', monthlyEstimateMinor: '900719925474099312345', annualizedEstimateMinor: '10808639105689191748140' }],
        atRiskRecurringEstimate: [], recurringEstimateNote: 'Catalog prices only.',
        completedGrossCustomerCharges: [{ currencyCode: 'USD', amountMinor: '900719925474099312345' }],
        completedTax: [], completedPayoutEarnings: [], completedPayoutFees: [], approvedAdjustments: [],
        financialDataNote: 'Completed provider transactions.', subscriptions: [], recentTransactions: [],
      },
    },
  });
  const html = founderCrmPage(founder, data, input({ currencyCode: 'USD' }));
  a.match(html, /USD(?:&nbsp;|\s)9,007,199,254,740,993,123\.45/);
  a.doesNotMatch(html, /NaN|Infinity/);
  a.match(html, /Collected customer charges · USD/);
  a.match(html, /Values range from USD(?:&nbsp;|\s)0\.00 to USD 9e18/);
  a.match(html, /aria-label="2026-10-09: USD(?:&nbsp;|\s)9,007,199,254,740,993,123\.45"/);
  a.equal((html.match(/class="chart-dot" cx="(?:8|712)\.00" cy="8\.00"/g) || []).length, 2);
  a.match(html, /class="chart-dot" cx="360\.00" cy="8\.00"/);
});

test('all-zero count and money charts stay flat on the zero baseline', () => {
  const data = base({
    analytics: {
      ...base().analytics,
      accountGrowth: [{ date: '2026-09-10', value: 0 }, { date: '2026-10-09', value: 0 }],
      chargeHistory: [{ currencyCode: 'USD', points: [
        { date: '2026-09-10', amountMinor: '0' }, { date: '2026-10-09', amountMinor: '0' },
      ] }],
    },
    billing: { ...base().billing, billing: {
      state: 'connected', environment: 'live', coverage: 'complete', coverageNote: null,
      period: { kind: 'last_30_days_utc', startsAt: '2026-09-10T00:00:00Z', endsAt: '2026-10-09T23:59:59Z' },
      activeRecurringEstimate: [], atRiskRecurringEstimate: [], recurringEstimateNote: 'Estimate.',
      completedGrossCustomerCharges: [{ currencyCode: 'USD', amountMinor: '0' }], completedTax: [],
      completedPayoutEarnings: [], completedPayoutFees: [], approvedAdjustments: [],
      financialDataNote: 'Transactions.', subscriptions: [], recentTransactions: [],
    } },
  });
  const html = founderCrmPage(founder, data, input({ currencyCode: 'USD' }));
  a.equal((html.match(/class="chart-dot" cx="(?:8|712)\.00" cy="182\.00"/g) || []).length, 4);
  a.match(html, /d="M8\.00 182\.00 L712\.00 182\.00 L712\.00 182\.00 L8\.00 182\.00 Z" class="area"/);
  a.doesNotMatch(html, /NaN|Infinity/);
});

test('customer data and failed drafts are escaped while account identity remains read only', () => {
  const customer = {
    id: 'account:acc-1', accountId: 'acc-1', contactId: 'contact-1',
    name: '<img src=x onerror=alert(1)>', email: 'person@example.test', company: 'A & B',
    plan: 'free', ownedSites: 1, publishedSites: 0, mediaBytes: 10,
    joinedAt: '2026-10-01T00:00:00Z', lastEditedAt: null,
    stage: 'contacted' as const, source: 'referral' as const,
    notes: '</textarea><script>alert(1)</script>', followUpOn: '2026-10-20',
    isTest: false, revision: 3,
  };
  const html = founderCrmPage(founder, base({ customers: [customer] }), input({
    section: 'customers', editAccountId: 'acc-1', error: '<script>unsafe</script>',
    draftContact: { accountId: 'acc-1', notes: '</textarea><script>alert(2)</script>', stage: 'qualified' },
  }));
  a.doesNotMatch(html, /<img src=x|<script>alert/);
  a.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  a.match(html, /&lt;\/textarea&gt;&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  a.match(html, /<input type="hidden" name="name"/);
  a.match(html, /<input type="hidden" name="email"/);
  a.doesNotMatch(html, /id="contact-name"|id="contact-email"/);
  a.match(html, /name="expectedRevision" value="3"/);
  a.match(html, /name="returnSection" value="customers"/);
});

test('a linked account with a blank name remains editable without inventing an identity value', () => {
  const customer = {
    id: 'account:blank', accountId: 'blank', contactId: null,
    name: '', email: 'blank@example.test', company: '', plan: 'free', ownedSites: 0,
    publishedSites: 0, mediaBytes: 0, joinedAt: '2026-10-01T00:00:00Z', lastEditedAt: null,
    stage: 'lead' as const, source: 'unknown' as const, notes: '', followUpOn: null,
    isTest: false, revision: null,
  };
  const html = founderCrmPage(founder, base({ customers: [customer] }), input({
    section: 'customers', editAccountId: 'blank',
  }));
  a.match(html, /Pagecraft account/);
  a.match(html, /Unnamed account/);
  a.match(html, /<input type="hidden" name="name" value="">/);
  a.match(html, /<input type="hidden" name="email" value="blank@example\.test">/);
});

test('new manual lead and pipeline forms post complete state to the CRM route', () => {
  const html = founderCrmPage(founder, base(), input({
    section: 'pipeline', draftContact: { name: 'Draft name', stage: 'lead', isTest: true },
  }));
  a.match(html, /action="\/crm\/contacts"/);
  a.match(html, /name="name"[^>]*value="Draft name"/);
  a.match(html, /name="email" type="email"/);
  a.match(html, /name="range" value="30d"/);
  a.match(html, /name="tests" value="exclude"/);
  a.match(html, /name="returnSection" value="pipeline"/);
  a.match(html, /name="isTest" value="true" checked/);
  a.match(html, /Archive a record by changing its stage to Archived/);
  a.doesNotMatch(html, /delete|Remove contact/i);
});

test('pipeline retains archived records for its Archived filter', () => {
  const archived = {
    id: 'contact:archived', accountId: null, contactId: 'archived', name: 'Past lead',
    email: 'past@example.test', company: 'Past Co', plan: null, ownedSites: null,
    publishedSites: null, mediaBytes: null, joinedAt: '2026-09-01T00:00:00Z', lastEditedAt: null,
    stage: 'archived' as const, source: 'referral' as const, notes: '', followUpOn: null,
    isTest: false, revision: 1,
  };
  const html = founderCrmPage(founder, base({ customers: [archived] }), input({ section: 'pipeline' }));
  a.match(html, /data-stage-jump="archived"/);
  a.match(html, /data-stage="archived"/);
  a.match(html, /Past lead/);
  a.match(html, /href="\/pipeline\?range=30d&amp;tests=exclude&amp;currency=USD&amp;editContact=archived"/);
});

test('pipeline withholds zero-like counts when CRM storage is unavailable', () => {
  const html = founderCrmPage(founder, base({
    crm: { state: 'unavailable', contacts: [] },
    analytics: { ...base().analytics, pipeline: [
      { stage: 'lead', value: 0 }, { stage: 'contacted', value: 0 },
      { stage: 'qualified', value: 0 }, { stage: 'customer', value: 0 },
      { stage: 'archived', value: 0 },
    ] },
  }), input({ section: 'pipeline' }));
  a.match(html, /CRM storage is unavailable/);
  a.match(html, /counts are withheld/);
  a.doesNotMatch(html, /<div class="stage-strip"|<a href="#pipeline-list" data-stage-jump|>Add lead<\/a>/);
});

test('connected partial billing labels coverage and keeps currencies separate', () => {
  const connected = base({
    billing: {
      ...base().billing,
      billing: {
        state: 'connected', environment: 'sandbox', coverage: 'partial',
        coverageNote: '<partial provider coverage>',
        period: { kind: 'last_30_days_utc', startsAt: '2026-09-10T00:00:00Z', endsAt: '2026-10-09T23:59:59Z' },
        activeRecurringEstimate: [
          { currencyCode: 'USD', monthlyEstimateMinor: '1000', annualizedEstimateMinor: '12000' },
          { currencyCode: 'PHP', monthlyEstimateMinor: '50000', annualizedEstimateMinor: '600000' },
        ],
        atRiskRecurringEstimate: [{ currencyCode: 'USD', monthlyEstimateMinor: '250', annualizedEstimateMinor: '3000' }],
        recurringEstimateNote: 'Catalog estimate.',
        completedGrossCustomerCharges: [{ currencyCode: 'USD', amountMinor: '2000' }],
        completedTax: [{ currencyCode: 'USD', amountMinor: '200' }],
        completedPayoutEarnings: [], completedPayoutFees: [], approvedAdjustments: [],
        financialDataNote: 'Provider values.', subscriptions: [], recentTransactions: [],
      },
    },
  });
  const html = founderCrmPage(founder, connected, input({ section: 'revenue', currencyCode: 'USD' }));
  a.match(html, /Partial provider coverage/);
  a.match(html, /&lt;partial provider coverage&gt;/);
  a.match(html, /Current recurring estimate/);
  a.match(html, /USD(?:&nbsp;|\s)10\.00/);
  a.doesNotMatch(html, /PHP(?:&nbsp;|\s)500\.00/);
  a.match(html, /Sandbox billing/);
});

test('cost forms preserve draft fields and use existing mutation routes', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const data = base({
    billing: {
      ...base().billing,
      costs: {
        state: 'available', basis: 'monthly_budget',
        totals: [{ currencyCode: 'USD', amountMinor: '1234' }],
        rows: [{ id, label: 'Hosting', category: 'hosting', amountMinor: '1234', currencyCode: 'USD', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }],
      },
    },
  });
  const html = founderCrmPage(founder, data, input({ section: 'costs', costInput: {
    editCostId: id, error: 'amount_invalid',
    draftCost: { id, label: 'Draft <cost>', category: 'database', amount: '12.345', currencyCode: 'USD' },
  } }));
  a.match(html, /action="\/owner\/billing\/costs\?range=30d&amp;tests=exclude&amp;currency=USD"/);
  a.match(html, new RegExp(`action="/owner/billing/costs/${id}/remove\\?range=30d&amp;tests=exclude&amp;currency=USD"`));
  a.match(html, /value="Draft &lt;cost&gt;"/);
  a.match(html, /name="amount"[^>]*value="12\.345"/);
  a.match(html, /name="currencyCode"/);
  a.match(html, /name="range" value="30d"/);
  a.match(html, /Enter a positive amount or zero using the currency’s decimal places/);
});

test('contact success feedback is announced and receives focus on load', () => {
  const html = founderCrmPage(founder, base(), input({ section: 'customers', message: 'Contact saved.' }));
  a.match(html, /class="notice success" role="status" tabindex="-1" data-feedback>Contact saved\.<\/p>/);
  a.match(html, /const feedback=document\.querySelector\('\[data-feedback\]'\);if\(feedback\)feedback\.focus\(\)/);
  a.match(html, /if\(form\.dataset\.submitting==='true'\)\{event\.preventDefault\(\);return;\}/);
  a.match(html, /setTimeout\(\(\)=>\{button\.dataset\.original/);
  a.doesNotMatch(html, /button\.disabled=true/);
});

test('reports expose stateful CSV links and explain snapshot metrics', () => {
  const html = founderCrmPage(founder, base({ analytics: {
    ...base().analytics,
    siteGrowth: [{ date: '2026-09-10', value: 1 }, { date: '2026-10-09', value: 3 }],
    sources: [{ source: 'referral', value: 2 }, { source: 'unknown', value: 0 }],
  } }), input({ section: 'reports' }));
  for (const file of ['customers', 'pipeline', 'payments', 'budgets', 'metrics']) {
    a.match(html, new RegExp(`/exports/${file}\\.csv\\?range=30d&amp;tests=exclude&amp;currency=USD`));
  }
  a.match(html, /Current snapshot, not period conversion/);
  a.match(html, /All account profiles \(unfiltered\)/);
  a.match(html, /Inventory total; derived metrics use retrieved profiles/);
  a.match(html, /Past 30 days; daily UTC buckets/);
  a.match(html, /Site creation trend/);
  a.match(html, /aria-label="2026-10-09: 3"/);
  a.match(html, /Manual source distribution/);
  a.match(html, /<span>Referral<\/span>/);
  a.doesNotMatch(html, /<span>Unknown<\/span>/);
});

test('partial reports distinguish inventory totals from retrieved profiles and source coverage', () => {
  const partialPlatform = {
    state: 'available' as const,
    snapshot: {
      accountTotal: 1000, siteTotal: 2400, coverage: 'partial' as const,
      accounts: [{ id: 'retrieved', authUserId: 'auth-retrieved', name: 'Retrieved', email: 'r@example.test', plan: 'free', createdAt: '2026-10-01T00:00:00Z', ownedSites: 0, publishedSites: 0, mediaBytes: 0, lastEditedAt: null }],
      sites: [],
    },
  };
  const report = founderCrmPage(founder, base({ platform: partialPlatform }), input({ section: 'reports' }));
  const source = founderCrmPage(founder, base({ platform: partialPlatform }), input({ section: 'sources' }));
  a.match(report, /All account profiles \(unfiltered\)<\/strong><\/td><td>1,000<\/td>/);
  a.match(report, /Retrieved profiles<\/strong><\/td><td>1<\/td><td>Profiles retrieved for derived metrics; partial feed<\/td>/);
  a.match(source, /1 of 1,000 profiles retrieved · partial snapshot coverage/);
  a.doesNotMatch(source, /1,000 raw account records/);
});

test('source outages warn that directory identity and CRM annotations are incomplete', () => {
  const html = founderCrmPage(founder, base({
    platform: { state: 'unavailable', snapshot: null },
    crm: { state: 'not_connected', contacts: [] },
  }), input({ section: 'customers' }));
  a.match(html, /Pagecraft source unavailable/);
  a.match(html, /saved CRM contacts only; account, site, and plan values are withheld/);
  a.match(html, /CRM storage not connected/);
  a.match(html, /Stage and source labels may fall back to incomplete defaults/);
});

test('sources state unmeasured analytics without fake values', () => {
  const html = founderCrmPage(founder, base(), input({ section: 'sources' }));
  a.match(html, /Traffic, customer acquisition cost, churn, and retention are not connected/);
  a.match(html, /profile creation timestamps describe account creation/);
  a.match(html, /not daily active users/);
  a.doesNotMatch(html, /CAC[^<]*0|Churn[^<]*0|Retention[^<]*0/);
});

test('sign-in page matches the standalone HQ brand and escapes challenge configuration', () => {
  const html = founderCrmSignInPage({
    error: 'auth', dataEnvironment: 'production', challengeSiteKey: 'site-key-123',
  });
  a.match(html, /<title>Sign in — Pagecraft HQ<\/title>/);
  a.match(html, /Founder CRM/);
  a.match(html, /data-environment="production">Production data/);
  a.match(html, /action="\/auth\/sign-in"/);
  a.match(html, /autocomplete="email"/);
  a.match(html, /autocomplete="current-password"/);
  a.match(html, /class="cf-turnstile" data-sitekey="site-key-123" data-action="founder_sign_in"/);
  a.match(html, /We could not sign you in with those details/);
  a.doesNotMatch(html, /sign-up|Continue with Google|Open Pagecraft/i);
});
