import { test, vi } from 'vitest';
import a from 'node:assert/strict';
import type { VerifiedIdentity } from '../src/account-auth.ts';
import { loadFounderCrm } from '../src/founder-crm-data.ts';
import type { CrmContact, CrmPlatformSnapshot } from '../src/founder-crm-types.ts';

const OWNER_ID = '123e4567-e89b-42d3-a456-426614174000';
const OTHER_ID = '123e4567-e89b-42d3-a456-426614174001';
const ACCOUNT_ID = '123e4567-e89b-42d3-a456-426614174010';
const TEST_ACCOUNT_ID = '123e4567-e89b-42d3-a456-426614174011';
const identity = (authUserId = OWNER_ID): VerifiedIdentity => ({ authUserId, email: 'owner@example.test', name: 'Owner' });
const billing = { ownerAuthUserIds: [OWNER_ID], now: () => new Date('2026-10-09T00:00:00.000Z') };

const snapshot: CrmPlatformSnapshot = {
  accounts: [
    { id: ACCOUNT_ID, authUserId: ACCOUNT_ID, name: 'Real account', email: 'REAL@EXAMPLE.TEST', plan: 'free', createdAt: '2026-10-08T00:00:00Z', ownedSites: 1, publishedSites: 1, mediaBytes: 10, lastEditedAt: '2026-10-08T12:00:00Z' },
    { id: TEST_ACCOUNT_ID, authUserId: TEST_ACCOUNT_ID, name: 'Test account', email: 'test@example.test', plan: 'pro', createdAt: '2026-10-07T00:00:00Z', ownedSites: 1, publishedSites: 0, mediaBytes: 20, lastEditedAt: null },
    { id: '123e4567-e89b-42d3-a456-426614174012', authUserId: '123e4567-e89b-42d3-a456-426614174112', name: '', email: 'new@example.test', plan: 'free', createdAt: '2026-10-06T00:00:00Z', ownedSites: 0, publishedSites: 0, mediaBytes: 0, lastEditedAt: null },
  ],
  sites: [
    { id: 'site-real', ownerIds: [ACCOUNT_ID], name: 'Real site', slug: 'real', published: true, createdAt: '2026-10-08T03:00:00Z', updatedAt: '2026-10-08T04:00:00Z' },
    { id: 'site-test', ownerIds: [TEST_ACCOUNT_ID], name: 'Test site', slug: 'test', published: false, createdAt: '2026-10-07T03:00:00Z', updatedAt: '2026-10-07T04:00:00Z' },
  ],
  accountTotal: 3,
  siteTotal: 2,
  coverage: 'complete',
};

const contacts: CrmContact[] = [
  { id: '123e4567-e89b-42d3-a456-426614174020', accountId: null, name: 'Old name', email: 'real@example.test', company: 'Acme', stage: 'qualified', source: 'referral', notes: 'Keep', followUpOn: '2026-10-10', isTest: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', revision: 1 },
  { id: '123e4567-e89b-42d3-a456-426614174021', accountId: TEST_ACCOUNT_ID, name: 'Test', email: 'test@example.test', company: '', stage: 'lead', source: 'paid', notes: '', followUpOn: null, isTest: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', revision: 1 },
  { id: '123e4567-e89b-42d3-a456-426614174022', accountId: null, name: 'Manual lead', email: 'manual@example.test', company: '', stage: 'contacted', source: 'social', notes: '', followUpOn: null, isTest: false, createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z', revision: 1 },
];

test('access denial happens before platform, CRM, billing, or provider reads', async () => {
  const platform = { snapshot: vi.fn(async () => snapshot) };
  const store = { list: vi.fn(async () => contacts), put: vi.fn() };
  const fetcher = vi.fn<typeof fetch>();
  for (const denied of [null, identity(OTHER_ID)]) {
    const result = await loadFounderCrm(denied, {
      billing: { ...billing, paddle: { apiKey: 'private' }, fetch: fetcher }, platform, contacts: store,
    }, {});
    a.ok('status' in result);
    if ('status' in result) a.equal(result.status, denied ? 'forbidden' : 'unauthenticated');
  }
  a.equal(platform.snapshot.mock.calls.length, 0);
  a.equal(store.list.mock.calls.length, 0);
  a.equal(fetcher.mock.calls.length, 0);
});

test('platform and CRM merge without duplicates, preserve plan meaning, and exclude explicit test records', async () => {
  const result = await loadFounderCrm(identity(), {
    billing,
    platform: { snapshot: async () => snapshot },
    contacts: { list: async () => contacts, put: vi.fn() },
  }, { range: '30d', includeTests: false });
  if ('status' in result) throw new Error(result.status);
  a.equal(result.customers.length, 3);
  const real = result.customers.find(row => row.accountId === ACCOUNT_ID)!;
  a.equal(real.contactId, contacts[0].id, 'normalized email links one CRM contact to one account');
  a.equal(real.name, 'Real account', 'platform identity stays canonical');
  a.equal(real.company, 'Acme');
  a.equal(real.plan, 'free', 'plan is reported verbatim and never treated as paid status');
  a.equal(result.customers.some(row => row.accountId === TEST_ACCOUNT_ID), false);
  a.equal(result.analytics.newAccounts, 2);
  a.deepEqual(result.analytics.activation, { eligibleAccounts: 2, publishedAccounts: 1, rate: 50 });
  a.equal(result.analytics.pipeline.find(row => row.stage === 'qualified')?.value, 1);
  a.equal(result.analytics.pipeline.find(row => row.stage === 'contacted')?.value, 1);
  a.equal(result.analytics.sources.find(row => row.source === 'paid')?.value, 0);
  a.equal(result.analytics.siteGrowth.reduce((sum, point) => sum + point.value, 0), 1);
});

test('test records are included by default and excluded only when explicitly requested', async () => {
  const options = {
    billing,
    platform: { snapshot: async () => snapshot },
    contacts: { list: async () => contacts, put: vi.fn() },
  };
  const defaultResult = await loadFounderCrm(identity(), options, { range: '30d' });
  if ('status' in defaultResult) throw new Error(defaultResult.status);
  a.equal(defaultResult.includeTests, true);
  a.equal(defaultResult.customers.some(row => row.accountId === TEST_ACCOUNT_ID), true);
  const excluded = await loadFounderCrm(identity(), options, { includeTests: false });
  if ('status' in excluded) throw new Error(excluded.status);
  a.equal(excluded.customers.some(row => row.accountId === TEST_ACCOUNT_ID), false);
});

test('empty connected feeds differ from unavailable and missing feeds', async () => {
  const empty = await loadFounderCrm(identity(), {
    billing,
    platform: { snapshot: async () => ({ accounts: [], sites: [], accountTotal: 0, siteTotal: 0, coverage: 'complete' }) },
    contacts: { list: async () => [], put: vi.fn() },
  }, {});
  if ('status' in empty) throw new Error(empty.status);
  a.equal(empty.platform.state, 'available');
  a.equal(empty.crm.state, 'available');
  a.equal(empty.analytics.newAccounts, 0);
  a.deepEqual(empty.analytics.activation, { eligibleAccounts: 0, publishedAccounts: 0, rate: null });
  a.equal(empty.analytics.pipeline.length, 5);
  a.equal(empty.analytics.sources.length, 7);

  const unavailable = await loadFounderCrm(identity(), {
    billing,
    platform: { snapshot: async () => { throw new Error('private upstream detail'); } },
    contacts: { list: async () => { throw new Error('private path'); }, put: vi.fn() },
  }, {});
  if ('status' in unavailable) throw new Error(unavailable.status);
  a.equal(unavailable.platform.state, 'unavailable');
  a.equal(unavailable.crm.state, 'unavailable');
  a.equal(unavailable.analytics.newAccounts, null);
  a.deepEqual(unavailable.analytics.pipeline, []);
  a.deepEqual(unavailable.analytics.sources, []);

  const missing = await loadFounderCrm(identity(), { billing }, {});
  if ('status' in missing) throw new Error(missing.status);
  a.equal(missing.platform.state, 'not_connected');
  a.equal(missing.crm.state, 'not_connected');
  a.deepEqual(missing.analytics.pipeline, []);
  a.deepEqual(missing.analytics.sources, []);
});

test('follow-ups include overdue and current UTC day, excluding future and archived records', async () => {
  const dated = (id: string, email: string, followUpOn: string, stage: CrmContact['stage'] = 'contacted'): CrmContact => ({
    id, accountId: null, name: email, email, company: '', stage, source: 'direct', notes: '',
    followUpOn, isTest: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', revision: 1,
  });
  const rows = [
    dated('123e4567-e89b-42d3-a456-426614174031', 'today@example.test', '2026-10-09'),
    dated('123e4567-e89b-42d3-a456-426614174032', 'overdue@example.test', '2026-10-08'),
    dated('123e4567-e89b-42d3-a456-426614174033', 'future@example.test', '2026-10-10'),
    dated('123e4567-e89b-42d3-a456-426614174034', 'archived@example.test', '2026-10-07', 'archived'),
  ];
  const result = await loadFounderCrm(identity(), {
    billing,
    contacts: { list: async () => rows, put: vi.fn() },
  }, {});
  if ('status' in result) throw new Error(result.status);
  a.deepEqual(result.analytics.followUps.map(row => row.email), [
    'overdue@example.test', 'today@example.test',
  ]);
});

test('linked contact keeps its account id when platform data is unavailable', async () => {
  const linked = { ...contacts[1], isTest: false };
  const result = await loadFounderCrm(identity(), {
    billing,
    platform: { snapshot: async () => { throw new Error('offline'); } },
    contacts: { list: async () => [linked], put: vi.fn() },
  }, {});
  if ('status' in result) throw new Error(result.status);
  a.equal(result.platform.state, 'unavailable');
  a.equal(result.customers[0]?.accountId, TEST_ACCOUNT_ID);
  a.equal(result.customers[0]?.ownedSites, null);
  a.equal(result.customers[0]?.lastEditedAt, null);
});

test('charge chart groups exact minor-unit integers by currency and selected UTC bucket', async () => {
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return Response.json({
      data: url.pathname === '/transactions' ? [
        { id: 'usd-a', status: 'completed', currency_code: 'USD', billed_at: '2026-07-11T00:00:00.000Z', details: { totals: { total: '9007199254740993', tax: '0' } }, adjustments: [] },
        { id: 'usd-b', status: 'completed', currency_code: 'USD', billed_at: '2026-07-11T23:59:59.999Z', details: { totals: { total: '7', tax: '0' } }, adjustments: [] },
        { id: 'eur', status: 'completed', currency_code: 'EUR', billed_at: '2026-07-12T00:00:00.000Z', details: { totals: { total: '5', tax: '0' } }, adjustments: [] },
      ] : [],
      meta: { pagination: { next: `${url.origin}${url.pathname}?unused=1`, has_more: false } },
    });
  };
  const result = await loadFounderCrm(identity(), {
    billing: { ...billing, paddle: { apiKey: 'key' }, fetch: fetcher },
  }, { range: '90d' });
  if ('status' in result || result.billing.billing.state !== 'connected') throw new Error('billing unavailable');
  a.equal(result.billing.billing.period.kind, 'selected_days_utc');
  a.equal(result.billing.billing.period.startsAt, '2026-07-11T00:00:00.000Z');
  const euro = result.analytics.chargeHistory.find(series => series.currencyCode === 'EUR')!;
  const usd = result.analytics.chargeHistory.find(series => series.currencyCode === 'USD')!;
  a.equal(euro.points.length, 14);
  a.equal(usd.points.length, 14);
  a.deepEqual(euro.points[0], { date: '2026-07-06', amountMinor: '5' });
  a.deepEqual(usd.points[0], { date: '2026-07-06', amountMinor: '9007199254741000' });
  a.ok(euro.points.slice(1).every(point => point.amountMinor === '0'));
  a.ok(usd.points.slice(1).every(point => point.amountMinor === '0'));
});

test('connected subscription currency gets a complete flat zero series when no charges exist', async () => {
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return Response.json({
      data: url.pathname === '/subscriptions' ? [{
        id: 'sub-nzd', customer_id: 'ctm-nzd', status: 'active', currency_code: 'NZD',
        billing_cycle: { interval: 'month', frequency: 1 }, items: [], next_billed_at: null,
      }] : [],
      meta: { pagination: { next: `${url.origin}${url.pathname}?unused=1`, has_more: false } },
    });
  };
  const result = await loadFounderCrm(identity(), {
    billing: { ...billing, paddle: { apiKey: 'key' }, fetch: fetcher },
  }, { range: '30d' });
  if ('status' in result) throw new Error(result.status);
  const series = result.analytics.chargeHistory.find(row => row.currencyCode === 'NZD')!;
  a.equal(series.points.length, 31);
  a.ok(series.points.every(point => point.amountMinor === '0'));
});
