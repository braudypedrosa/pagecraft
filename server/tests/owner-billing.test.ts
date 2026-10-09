import { afterEach, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VerifiedIdentity } from '../src/account-auth.ts';
import {
  FileOwnerCostStore,
  loadOwnerBilling,
  ownerBillingAccess,
  parseOwnerAuthUserIds,
  putOwnerCostBudget,
  removeOwnerCostBudget,
} from '../src/owner-billing.ts';

const OWNER_ID = '123e4567-e89b-42d3-a456-426614174000';
const OTHER_ID = '123e4567-e89b-42d3-a456-426614174001';
const identity = (authUserId = OWNER_ID): VerifiedIdentity => ({
  authUserId, email: 'owner@example.test', name: 'Owner',
});
const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

test('owner allowlist fails closed and uses only exact verified auth UUIDs', () => {
  a.deepEqual(parseOwnerAuthUserIds(undefined), []);
  a.deepEqual(parseOwnerAuthUserIds(''), []);
  a.deepEqual(parseOwnerAuthUserIds(`${OWNER_ID},not-a-uuid`), []);
  a.deepEqual(parseOwnerAuthUserIds(`${OWNER_ID}, ${OWNER_ID}`), [OWNER_ID]);
  a.equal(ownerBillingAccess(null, [OWNER_ID]), 'unauthenticated');
  a.equal(ownerBillingAccess(identity(), []), 'forbidden');
  a.equal(ownerBillingAccess(identity(), [OWNER_ID, 'bad']), 'forbidden');
  a.equal(ownerBillingAccess(identity(OTHER_ID), [OWNER_ID]), 'forbidden');
  a.equal(ownerBillingAccess(identity(), [OWNER_ID]), 'allowed');
  a.equal(ownerBillingAccess({ ...identity(OTHER_ID), email: 'owner@example.test' }, [OWNER_ID]), 'forbidden');
});

test('not connected is honest, makes no provider call, and leaves unknown metrics null', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const result = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], fetch: fetcher,
    platform: { siteCount: async () => 7 },
    now: () => new Date('2026-10-09T00:00:00.000Z'),
  });
  a.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  a.deepEqual(result.platform, { siteCount: 7, accountCount: null });
  a.deepEqual(result.billing, { state: 'not_connected', environment: null });
  a.deepEqual(result.costs, { state: 'available', basis: 'monthly_budget', rows: [], totals: [] });
  a.equal(fetcher.mock.calls.length, 0);
});

test('forbidden callers cannot cause metrics, cost, or Paddle reads', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const siteCount = vi.fn(async () => 1);
  const costs = { list: vi.fn(async () => []), put: vi.fn(), remove: vi.fn() };
  a.deepEqual(await loadOwnerBilling(identity(OTHER_ID), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'secret' }, fetch: fetcher,
    platform: { siteCount }, costs,
  }), { status: 'forbidden' });
  a.equal(fetcher.mock.calls.length, 0);
  a.equal(siteCount.mock.calls.length, 0);
  a.equal(costs.list.mock.calls.length, 0);
});

const subscription = (input: {
  id: string; status: 'active' | 'past_due' | 'paused'; currency: string;
  amount: string; interval: 'month' | 'year'; frequency?: number; quantity?: number;
}) => ({
  id: input.id, customer_id: `ctm_${input.id}`, status: input.status,
  currency_code: input.currency, next_billed_at: '2026-11-01T00:00:00Z',
  billing_cycle: { interval: input.interval, frequency: input.frequency || 1 },
  scheduled_change: null,
  items: [{
    status: input.status === 'paused' ? 'inactive' : 'active', recurring: true,
    quantity: input.quantity || 1,
    price: {
      unit_price: { amount: input.amount, currency_code: input.currency },
      billing_cycle: { interval: input.interval, frequency: input.frequency || 1 },
      tax_mode: 'account_setting',
    },
  }],
});

const transaction = (input: {
  id: string; status: string; currency: string; total: string; tax: string;
  earnings?: string; fee?: string; payoutCurrency?: string; billedAt?: string; adjustment?: string;
}) => ({
  id: input.id, status: input.status, currency_code: input.currency,
  customer_id: `ctm_${input.id}`, subscription_id: `sub_${input.id}`,
  invoice_number: `inv-${input.id}`, billed_at: input.billedAt || '2026-10-08T00:00:00Z',
  details: {
    totals: { total: input.total, tax: input.tax },
    payout_totals: input.earnings === undefined ? null : {
      currency_code: input.payoutCurrency || input.currency, earnings: input.earnings, fee: input.fee || '0',
    },
  },
  adjustments: input.adjustment === undefined ? [] : [{
    status: 'approved', currency_code: input.currency, totals: { total: input.adjustment },
  }, {
    status: 'pending_approval', currency_code: input.currency, totals: { total: '999999' },
  }],
});

test('Paddle data stays currency-safe and separates active, at-risk, gross, payout, tax and approved adjustments', async () => {
  const requests: { url: URL; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push({ url, init });
    if (url.pathname === '/subscriptions') return Response.json({
      data: [
        subscription({ id: 'active-month', status: 'active', currency: 'USD', amount: '1200', interval: 'month' }),
        subscription({ id: 'active-year', status: 'active', currency: 'USD', amount: '12000', interval: 'year' }),
        subscription({ id: 'active-eur', status: 'active', currency: 'EUR', amount: '900', interval: 'month' }),
        subscription({ id: 'risk', status: 'past_due', currency: 'USD', amount: '500', interval: 'month' }),
      ], meta: { pagination: { next: `${url.origin}${url.pathname}?after=unused`, has_more: false } },
    });
    if (url.pathname === '/transactions') return Response.json({
      data: [
        transaction({ id: 'done-usd', status: 'completed', currency: 'USD', total: '2200', tax: '200', earnings: '1700', fee: '300', adjustment: '-400' }),
        transaction({ id: 'done-eur', status: 'completed', currency: 'EUR', total: '1000', tax: '100', earnings: '750', fee: '150', payoutCurrency: 'USD' }),
        transaction({ id: 'pending', status: 'ready', currency: 'USD', total: '9900', tax: '900', earnings: '8000', fee: '1000' }),
      ], meta: { pagination: { next: `${url.origin}${url.pathname}?after=unused`, has_more: false } },
    });
    return new Response(null, { status: 404 });
  };
  const result = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'pdl-secret' }, fetch: fetcher,
    now: () => new Date('2026-10-09T00:00:00.000Z'),
  });
  a.equal(result.status, 'ok');
  if (result.status !== 'ok' || result.billing.state !== 'connected') return;
  a.equal(result.billing.environment, 'sandbox');
  a.equal(result.billing.coverage, 'complete');
  a.deepEqual(result.billing.activeRecurringEstimate, [
    { currencyCode: 'EUR', monthlyEstimateMinor: '900', annualizedEstimateMinor: '10800' },
    { currencyCode: 'USD', monthlyEstimateMinor: '2200', annualizedEstimateMinor: '26400' },
  ]);
  a.deepEqual(result.billing.atRiskRecurringEstimate, [
    { currencyCode: 'USD', monthlyEstimateMinor: '500', annualizedEstimateMinor: '6000' },
  ]);
  a.deepEqual(result.billing.completedGrossCustomerCharges, [
    { currencyCode: 'EUR', amountMinor: '1000' }, { currencyCode: 'USD', amountMinor: '2200' },
  ]);
  a.deepEqual(result.billing.completedTax, [
    { currencyCode: 'EUR', amountMinor: '100' }, { currencyCode: 'USD', amountMinor: '200' },
  ]);
  a.deepEqual(result.billing.completedPayoutEarnings, [
    { currencyCode: 'USD', amountMinor: '2450' },
  ]);
  a.deepEqual(result.billing.completedPayoutFees, [
    { currencyCode: 'USD', amountMinor: '450' },
  ]);
  a.deepEqual(result.billing.approvedAdjustments, [{ currencyCode: 'USD', amountMinor: '-400' }]);
  a.equal(result.billing.subscriptions.length, 4);
  a.equal(result.billing.recentTransactions.length, 3, 'receipt list keeps non-completed statuses');
  a.deepEqual(result.billing.period, {
    kind: 'last_30_days_utc', startsAt: '2026-09-09T00:00:00.000Z', endsAt: '2026-10-09T00:00:00.000Z',
  });
  a.equal(requests.length, 2);
  for (const request of requests) {
    a.equal(request.url.origin, 'https://sandbox-api.paddle.com');
    const headers = new Headers(request.init?.headers);
    a.equal(headers.get('authorization'), 'Bearer pdl-secret');
    a.equal(headers.get('paddle-version'), '1');
    a.equal(headers.get('skip-count'), 'true');
    a.equal(request.init?.redirect, 'error');
  }
  const transactionRequest = requests.find(request => request.url.pathname === '/transactions')!;
  const subscriptionRequest = requests.find(request => request.url.pathname === '/subscriptions')!;
  a.equal(subscriptionRequest.url.searchParams.get('per_page'), '200');
  a.equal(transactionRequest.url.searchParams.get('per_page'), '30');
  a.equal(transactionRequest.url.searchParams.get('billed_at[GTE]'), '2026-09-09T00:00:00.000Z');
  a.equal(transactionRequest.url.searchParams.get('billed_at[LTE]'), '2026-10-09T00:00:00.000Z');
  a.equal(result.billing.recentTransactions.find(row => row.id === 'done-eur')?.payoutCurrencyCode, 'USD');
});

test('annual recurring normalization rounds only final exact fraction', async () => {
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return Response.json({
      data: url.pathname === '/subscriptions' ? [
        subscription({ id: 'a', status: 'active', currency: 'USD', amount: '1000', interval: 'year' }),
        subscription({ id: 'b', status: 'active', currency: 'USD', amount: '1000', interval: 'year' }),
      ] : [],
      meta: { pagination: { next: `${url.origin}${url.pathname}?after=unused`, has_more: false } },
    });
  };
  const result = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'key' }, fetch: fetcher,
  });
  if (result.status !== 'ok' || result.billing.state !== 'connected') throw new Error('not connected');
  a.deepEqual(result.billing.activeRecurringEstimate, [{
    currencyCode: 'USD', monthlyEstimateMinor: '167', annualizedEstimateMinor: '2000',
  }]);
});

test('pagination is bounded, reports partial coverage, and rejects a cross-origin next URL', async () => {
  const partialFetch: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return Response.json({ data: [], meta: { pagination: { next: `${url.origin}${url.pathname}?after=next`, has_more: true } } });
  };
  const partial = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'key', maxPages: 1 }, fetch: partialFetch,
  });
  if (partial.status !== 'ok') throw new Error('not allowed');
  a.equal(partial.billing.state, 'connected');
  if (partial.billing.state === 'connected') {
    a.equal(partial.billing.coverage, 'partial');
    a.match(partial.billing.coverageNote || '', /pagination was incomplete or invalid/i);
  }

  const hostileFetch: typeof fetch = async () => Response.json({
    data: [], meta: { pagination: { next: 'https://attacker.example/steal', has_more: true } },
  });
  const hostile = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'do-not-leak' }, fetch: hostileFetch,
  });
  if (hostile.status !== 'ok') throw new Error('not allowed');
  a.equal(hostile.billing.state, 'connected');
  if (hostile.billing.state === 'connected') {
    a.equal(hostile.billing.coverage, 'partial');
    a.match(hostile.billing.coverageNote || '', /pagination was incomplete or invalid/i);
  }
  a.doesNotMatch(JSON.stringify(hostile), /do-not-leak/);
});

test('missing pagination metadata and has_more without next produce partial coverage', async () => {
  for (const pagination of [undefined, { has_more: true }]) {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return Response.json({ data: [], ...(pagination ? { meta: { pagination } } : {}) });
    };
    const result = await loadOwnerBilling(identity(), {
      ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'key' }, fetch: fetcher,
    });
    if (result.status !== 'ok' || result.billing.state !== 'connected') throw new Error('not connected');
    a.equal(result.billing.coverage, 'partial');
    a.match(result.billing.coverageNote || '', /pagination was incomplete or invalid/);
    a.equal(calls, 2, 'each list stops after its malformed first page');
  }
});

test('one overall deadline bounds both list pagination and stalled custom response bodies', async () => {
  const stalled = new ReadableStream<Uint8Array>({ start() { /* deliberately never closes */ } });
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/subscriptions') return new Response(stalled, { headers: { 'content-type': 'application/json' } });
    return Response.json({
      data: [],
      meta: { pagination: { next: `${url.origin}${url.pathname}?after=unused`, has_more: false } },
    });
  };
  const started = Date.now();
  const result = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID],
    paddle: { apiKey: 'key', timeoutMs: 5_000, overallTimeoutMs: 100 },
    fetch: fetcher,
  });
  const elapsed = Date.now() - started;
  if (result.status !== 'ok') throw new Error('not allowed');
  a.deepEqual(result.billing, {
    state: 'unavailable', environment: 'sandbox', reason: 'provider_unavailable',
  });
  a.ok(elapsed < 1_000, `overall deadline took ${elapsed}ms`);
});

test('malformed financial records make coverage partial instead of producing false complete totals', async () => {
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return Response.json({
      data: url.pathname === '/subscriptions'
        ? [{ ...subscription({ id: 'bad-sub', status: 'active', currency: 'USD', amount: '1000', interval: 'month' }), items: [{ status: 'active', recurring: true, quantity: 1, price: { billing_cycle: { interval: 'month', frequency: 1 }, unit_price: { amount: 'broken', currency_code: 'USD' } } }] }]
        : [{ id: 'bad-completed', status: 'completed', currency_code: 'USD', billed_at: '2026-10-08T00:00:00Z', details: { totals: { total: 'broken', tax: '100' }, payout_totals: null }, adjustments: [] }],
      meta: { pagination: { next: `${url.origin}${url.pathname}?after=unused`, has_more: false } },
    });
  };
  const result = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'key' }, fetch: fetcher,
  });
  if (result.status !== 'ok' || result.billing.state !== 'connected') throw new Error('not connected');
  a.equal(result.billing.coverage, 'partial');
  a.match(result.billing.coverageNote || '', /2 malformed or unsupported provider records omitted/);
  a.deepEqual(result.billing.activeRecurringEstimate, []);
  a.deepEqual(result.billing.completedGrossCustomerCharges, []);
  a.match(result.billing.financialDataNote, /Payout earnings and fees use payout currency/);
  a.match(result.billing.financialDataNote, /null means none were returned/);
});

test('provider response bytes and endpoint-specific rows are bounded independently of page count', async () => {
  const oversizedBody: typeof fetch = async () => new Response(' '.repeat(2 * 1024 * 1024 + 1), {
    headers: { 'content-type': 'application/json' },
  });
  const bytesResult = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'key' }, fetch: oversizedBody,
  });
  if (bytesResult.status !== 'ok') throw new Error('not allowed');
  a.deepEqual(bytesResult.billing, {
    state: 'unavailable', environment: 'sandbox', reason: 'provider_response_invalid',
  });

  for (const oversizedPath of ['/subscriptions', '/transactions']) {
    const oversizedRows: typeof fetch = async input => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const limit = url.pathname === '/transactions' ? 30 : 200;
      return Response.json({
        data: url.pathname === oversizedPath ? Array.from({ length: limit + 1 }, () => ({})) : [],
        meta: { pagination: { next: `${url.origin}${url.pathname}?after=unused`, has_more: false } },
      });
    };
    const rowsResult = await loadOwnerBilling(identity(), {
      ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'key' }, fetch: oversizedRows,
    });
    if (rowsResult.status !== 'ok') throw new Error('not allowed');
    a.deepEqual(rowsResult.billing, {
      state: 'unavailable', environment: 'sandbox', reason: 'provider_response_invalid',
    });
  }
});

test('provider timeouts and malformed or non-success responses are redacted', async () => {
  const hanging: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('secret timeout body')), { once: true });
  });
  const timed = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'top-secret', timeoutMs: 100 }, fetch: hanging,
  });
  if (timed.status !== 'ok') throw new Error('not allowed');
  a.deepEqual(timed.billing, {
    state: 'unavailable', environment: 'sandbox', reason: 'provider_unavailable',
  });

  for (const fetcher of [
    (async () => new Response('upstream says key=top-secret', { status: 401 })) as typeof fetch,
    (async () => Response.json({ nope: [] })) as typeof fetch,
  ]) {
    const result = await loadOwnerBilling(identity(), {
      ownerAuthUserIds: [OWNER_ID], paddle: { apiKey: 'top-secret', environment: 'live' }, fetch: fetcher,
    });
    if (result.status !== 'ok') throw new Error('not allowed');
    a.equal(result.billing.state, 'unavailable');
    a.doesNotMatch(JSON.stringify(result), /top-secret|upstream says/);
  }
});

test('cost budgets validate, persist atomically, serialize concurrent writes and stay owner-only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pc-owner-costs-'));
  roots.push(root);
  const path = join(root, 'costs.json');
  const store = new FileOwnerCostStore(path);
  const secondStore = new FileOwnerCostStore(path);
  const denied = await putOwnerCostBudget(identity(OTHER_ID), [OWNER_ID], store, {
    label: 'Secret hosting', category: 'hosting', amountMinor: '1000', currencyCode: 'USD',
  });
  a.deepEqual(denied, { status: 'forbidden' });
  a.deepEqual(await store.list(), []);

  for (const bad of [
    { label: '', category: 'hosting', amountMinor: '1', currencyCode: 'USD' },
    { label: 'Negative', category: 'hosting', amountMinor: '-1', currencyCode: 'USD' },
    { label: 'Decimal', category: 'hosting', amountMinor: '1.25', currencyCode: 'USD' },
    { label: 'Bad currency', category: 'other', amountMinor: '1', currencyCode: 'usd' },
  ] as const) {
    const result = await putOwnerCostBudget(identity(), [OWNER_ID], store, bad);
    a.equal(result.status, 'invalid');
  }

  const made = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    putOwnerCostBudget(identity(), [OWNER_ID], index % 2 ? store : secondStore, {
      label: `Budget ${index}`, category: index % 2 ? 'hosting' : 'marketing',
      amountMinor: String(index), currencyCode: index % 3 ? 'USD' : 'EUR',
    })));
  a.ok(made.every(result => result.status === 'ok'));
  const rows = await store.list();
  a.equal(rows.length, 20);
  a.equal(new Set(rows.map(row => row.id)).size, 20);
  a.equal((await readFile(path, 'utf8')).endsWith('\n'), true);

  const first = rows[0];
  const updated = await putOwnerCostBudget(identity(), [OWNER_ID], store, {
    id: first.id, label: 'Updated', category: 'database', amountMinor: '500', currencyCode: 'NZD',
  });
  a.equal(updated.status, 'ok');
  if (updated.status === 'ok') {
    a.equal(updated.row?.createdAt, first.createdAt);
    a.equal(updated.row?.label, 'Updated');
  }
  a.deepEqual(await removeOwnerCostBudget(identity(OTHER_ID), [OWNER_ID], store, first.id), { status: 'forbidden' });
  a.deepEqual(await removeOwnerCostBudget(identity(), [OWNER_ID], store, first.id), { status: 'ok', removed: true });
  a.equal((await store.list()).length, 19);

  const dashboard = await loadOwnerBilling(identity(), {
    ownerAuthUserIds: [OWNER_ID], costs: store,
  });
  if (dashboard.status !== 'ok') throw new Error('not allowed');
  a.equal(dashboard.costs.state, 'available');
  a.equal(dashboard.costs.basis, 'monthly_budget');
  if (dashboard.costs.state === 'available') {
    a.ok(dashboard.costs.totals.every(total => /^\d+$/.test(total.amountMinor)));
  }
});

test('cost read and write failures are unavailable and never leak filesystem errors', async () => {
  const broken = {
    list: async () => { throw new Error('/private/path secret database failure'); },
    put: async () => { throw new Error('/private/path write failure'); },
    remove: async () => { throw new Error('/private/path remove failure'); },
  };
  const dashboard = await loadOwnerBilling(identity(), { ownerAuthUserIds: [OWNER_ID], costs: broken });
  if (dashboard.status !== 'ok') throw new Error('not allowed');
  a.deepEqual(dashboard.costs, { state: 'unavailable', basis: 'monthly_budget' });

  const input = { label: 'Hosting', category: 'hosting' as const, amountMinor: '100', currencyCode: 'USD' };
  a.deepEqual(await putOwnerCostBudget(identity(), [OWNER_ID], broken, input), { status: 'unavailable' });
  a.deepEqual(await removeOwnerCostBudget(identity(), [OWNER_ID], broken, OWNER_ID), { status: 'unavailable' });
  a.doesNotMatch(JSON.stringify(await putOwnerCostBudget(identity(), [OWNER_ID], broken, input)), /private|secret|failure/);
});

test('updating a missing cost row returns only a whitelisted reason', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pc-owner-costs-missing-'));
  roots.push(root);
  const store = new FileOwnerCostStore(join(root, 'costs.json'));
  const result = await putOwnerCostBudget(identity(), [OWNER_ID], store, {
    id: OTHER_ID, label: 'Missing', category: 'other', amountMinor: '10', currencyCode: 'USD',
  });
  a.deepEqual(result, { status: 'invalid', reason: 'not_found' });
});
