import a from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { test, vi } from 'vitest';
import type { User } from '../src/auth.ts';
import { billingRoutes } from '../src/billing-routes.ts';
import {
  checkoutReady, paddleBillingConfig, parsePaddlePrices, verifyPaddleSignature, type SubscriptionEventInput,
} from '../src/paddle-billing.ts';
import type { AccountPlanStatus } from '../src/plan-grants.ts';
import { createApp } from '../src/app.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryStore, validSlug } from '../src/store.ts';

const SECRET = 'pdl_ntfset_test_secret';
const env = {
  PADDLE_ENVIRONMENT: 'sandbox', PADDLE_API_KEY: 'pdl_sdbx_apikey_test', PADDLE_WEBHOOK_SECRET: SECRET,
  PADDLE_CLIENT_TOKEN: 'test_0123456789abcdef', PADDLE_PRICES: 'launch:monthly=pri_01launchmonthly01,launch:yearly=pri_01launchyearly001,studio:monthly=pri_01studiomonthly01',
};
const sign = (body: string, ts = Math.floor(Date.now() / 1000)) =>
  `ts=${ts};h1=${createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')}`;
const user: User = { id: 'user-1', email: 'payer@example.test', name: 'Payer', plan: 'free' };
const freeStatus = (): AccountPlanStatus => ({ plan: 'free', source: 'free', changedAt: null, grants: [], subscriptions: [] });

function rig(overrides: { userId?: string; status?: () => AccountPlanStatus; fetcher?: typeof fetch } = {}) {
  const config = paddleBillingConfig(env)!;
  const applied: SubscriptionEventInput[] = [];
  const ledger = {
    applySubscription: vi.fn(async (event: SubscriptionEventInput) => { applied.push(event); return { outcome: 'applied' as const, userId: 'user-1', plan: { plan: 'launch' as const, source: 'subscription' as const, changed: true } }; }),
    recomputeStale: vi.fn(async () => ({ checked: 0, changed: 0 })),
  };
  const reports: string[] = [];
  const fetcher = overrides.fetcher ?? vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (new URL(String(_url)).pathname === '/prices') return Response.json({ data: [] });
    const body = JSON.parse(String(init?.body));
    a.deepEqual(body.custom_data, { pagecraft_user_id: 'user-1' });
    return Response.json({ data: { id: 'txn_01checkouttest01', checkout: { url: 'https://app.test/account/plans/checkout?_ptxn=txn_01checkouttest01' } } });
  }) as unknown as typeof fetch;
  let current: User | null = { ...user, id: overrides.userId ?? user.id };
  const app = new Hono();
  billingRoutes(app, {
    config, ledger, editorOrigin: 'https://app.test', fetcher, report: message => reports.push(message),
    plans: { status: async () => (overrides.status ?? freeStatus)() },
  }, async () => current);
  return { app, ledger, applied, reports, fetcher, signOut: () => { current = null; } };
}

const subscriptionEvent = (patch: Record<string, unknown> = {}) => JSON.stringify({
  event_id: 'evt_01webhooktest0001', event_type: 'subscription.created', occurred_at: '2026-11-19T01:00:00Z',
  data: {
    id: 'sub_01webhooktest0001', status: 'active', customer_id: 'ctm_01webhooktest0001',
    custom_data: { pagecraft_user_id: 'user-1' }, items: [{ price: { id: 'pri_01launchyearly001' }, quantity: 1 }],
    current_billing_period: { starts_at: '2026-11-19T01:00:00Z', ends_at: '2027-11-19T01:00:00Z' }, scheduled_change: null,
    ...patch,
  },
});

test('every mounted billing route reserves its top-level site slug', () => {
  const { app } = rig();
  a.ok(app.routes.some(route => route.path.startsWith('/billing/')));
  for (const route of app.routes) a.equal(validSlug(route.path.split('/')[1]), null);
});

test('configuration maps only trusted prices and keeps billing off when unset', () => {
  a.equal(paddleBillingConfig({}), undefined);
  a.equal(checkoutReady(paddleBillingConfig(env)), true);
  a.equal(checkoutReady(paddleBillingConfig({ ...env, PADDLE_CLIENT_TOKEN: '' })), false);
  a.throws(() => parsePaddlePrices('free:monthly=pri_01freemonthly0001'));
  a.throws(() => parsePaddlePrices('launch:monthly=pri_01aaaaaaaaaaaa,launch:monthly=pri_01bbbbbbbbbbbb'));
  a.throws(() => paddleBillingConfig({ ...env, PADDLE_CLIENT_TOKEN: 'live_0123456789abcdef' }), /does not match/);
});

test('signatures must match the raw body, the secret and a recent timestamp', () => {
  const body = subscriptionEvent();
  a.equal(verifyPaddleSignature(body, sign(body), SECRET), true);
  a.equal(verifyPaddleSignature(body + ' ', sign(body), SECRET), false);
  a.equal(verifyPaddleSignature(body, sign(body), 'other-secret'), false);
  a.equal(verifyPaddleSignature(body, sign(body, Math.floor(Date.now() / 1000) - 600), SECRET), false);
  a.equal(verifyPaddleSignature(body, `ts=1;h1=zz`, SECRET), false);
  a.equal(verifyPaddleSignature(body, undefined, SECRET), false);
  a.equal(verifyPaddleSignature(body, `${sign(body)};h1=${'0'.repeat(64)}`, SECRET), true, 'any listed h1 may match during rotation');
});

test('the webhook applies verified subscription events and ignores everything else', async () => {
  const r = rig();
  const post = (body: string, signature = sign(body)) => r.app.request('/billing/paddle/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', 'paddle-signature': signature }, body,
  });
  a.equal((await post(subscriptionEvent(), 'ts=1;h1=' + '0'.repeat(64))).status, 401);
  a.equal(r.ledger.applySubscription.mock.calls.length, 0);

  const response = await post(subscriptionEvent());
  a.equal(response.status, 200);
  a.deepEqual(r.applied[0], {
    environment: 'sandbox', eventId: 'evt_01webhooktest0001', eventType: 'subscription.created', occurredAt: '2026-11-19T01:00:00Z',
    subscriptionId: 'sub_01webhooktest0001', customerId: 'ctm_01webhooktest0001', userId: 'user-1',
    priceId: 'pri_01launchyearly001', plan: 'launch', status: 'active', currentPeriodEnd: '2027-11-19T01:00:00Z', scheduledChange: null,
  });

  const unknownPrice = await post(subscriptionEvent({ items: [{ price: { id: 'pri_01someoneelse0001' } }] }));
  a.equal((await unknownPrice.json()).ignored, 'no Pagecraft price');
  const transaction = JSON.stringify({ event_id: 'evt_01x', event_type: 'transaction.completed', data: {} });
  a.equal((await (await post(transaction)).json()).ignored, 'not a subscription event');
  a.equal(r.ledger.applySubscription.mock.calls.length, 1);

  r.ledger.applySubscription.mockRejectedValueOnce(new Error('gateway down'));
  a.equal((await post(subscriptionEvent())).status, 503, 'a gateway failure asks Paddle to retry');
  r.ledger.applySubscription.mockResolvedValueOnce({ outcome: 'refused', reason: 'account does not exist' } as never);
  a.equal((await post(subscriptionEvent())).status, 200, 'a permanent refusal is acknowledged and reported');
  a.match(r.reports.at(-1)!, /refused: account does not exist/);
});

test('checkout names the signed-in account and refuses a second subscription', async () => {
  const r = rig();
  const post = (fields: Record<string, string>) => r.app.request('/account/plans/checkout', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields),
  });
  const page = await (await r.app.request('/account/plans')).text();
  a.match(page, /Upgrade to Launch/);
  a.match(page, /Upgrade to Studio/);
  a.doesNotMatch(page, /Upgrade to Pro/, 'only plans with configured prices are offered');

  a.equal((await post({ plan: 'pro', interval: 'monthly' })).status, 422);
  a.equal((await post({ plan: 'free', interval: 'monthly' })).status, 422);
  const response = await post({ plan: 'launch', interval: 'yearly' });
  a.equal(response.status, 303);
  a.equal(response.headers.get('location'), 'https://app.test/account/plans/checkout?_ptxn=txn_01checkouttest01');
  const [, init] = (r.fetcher as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find(([url]) => String(url).endsWith('/transactions'))!;
  const payload = JSON.parse(String(init.body));
  a.deepEqual(payload.items, [{ price_id: 'pri_01launchyearly001', quantity: 1 }]);
  a.equal('checkout' in payload, false, 'sandbox uses the default payment link');

  const checkout = await (await r.app.request('/account/plans/checkout?_ptxn=txn_01checkouttest01')).text();
  a.match(checkout, /cdn\.paddle\.com\/paddle\/v2\/paddle\.js/);
  a.match(checkout, /test_0123456789abcdef/);
  a.doesNotMatch(checkout, /pdl_sdbx_apikey_test|pdl_ntfset/, 'server secrets never reach the page');

  const subscribed = rig({ status: () => ({ ...freeStatus(), plan: 'launch', source: 'subscription', subscriptions: [{
    id: 'sub_1', environment: 'sandbox', priceId: 'pri_01launchmonthly01', plan: 'launch', status: 'active',
    statusChangedAt: null, currentPeriodEnd: '2026-12-19T00:00:00Z', scheduledChange: null }] }) });
  const again = await subscribed.app.request('/account/plans/checkout', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ plan: 'studio', interval: 'monthly' }),
  });
  a.equal(again.status, 409);
  a.equal((subscribed.fetcher as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);

  const redirected = rig({ fetcher: (async () => Response.json({ data: { id: 'txn_01checkouttest01', checkout: { url: 'https://evil.test/pay?_ptxn=txn_01checkouttest01' } } })) as unknown as typeof fetch });
  const evil = await redirected.app.request('/account/plans/checkout', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ plan: 'launch', interval: 'monthly' }),
  });
  a.equal(evil.status, 503, 'checkout only follows links back to this app');

  r.signOut();
  a.equal((await post({ plan: 'launch', interval: 'monthly' })).status, 303);
  a.match((await r.app.request('/account/plans')).headers.get('location') || '', /sign-in/);
});

test('an unrestricted account retains its subscription details and cannot start checkout', async () => {
  const r = rig({ userId: '328a15d0-0837-4881-8b47-38d316c03f95', status: () => ({
    ...freeStatus(), plan: 'launch', source: 'subscription', subscriptions: [{
      id: 'sub_1', environment: 'sandbox', priceId: 'pri_01launchmonthly01', plan: 'launch', status: 'active',
      statusChangedAt: null, currentPeriodEnd: '2026-12-19T00:00:00Z', scheduledChange: null,
    }],
  }) });
  const html = await (await r.app.request('/account/plans')).text();
  a.match(html, /<h1>Unrestricted<\/h1>/);
  a.match(html, /<dd>Launch<\/dd>/);
  a.match(html, /December 19, 2026/);
  a.doesNotMatch(html, /action="\/account\/plans\/checkout"|Always free|Your current plan/);
  const post = await r.app.request('/account/plans/checkout', { method: 'POST' });
  a.equal(post.status, 303);
  a.equal(post.headers.get('location'), '/account/plans');
  a.equal((await r.app.request('/account/plans/checkout?_ptxn=txn_01checkouttest01')).headers.get('location'), '/account/plans');
  a.equal((r.fetcher as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
});

test('the full app passes signed webhooks through without a browser origin', async () => {
  const applySubscription = vi.fn(async () => ({ outcome: 'applied' as const, userId: 'user-1', plan: { plan: 'launch' as const, source: 'subscription' as const, changed: true } }));
  const app = createApp({
    store: new MemoryStore(), auth: new MemoryAuthStore(), editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    billing: { config: paddleBillingConfig(env)!, editorOrigin: 'http://admin.test', report: () => undefined,
      ledger: { applySubscription, recomputeStale: async () => ({ checked: 0, changed: 0 }) }, plans: { status: async () => freeStatus() } },
  });
  const body = subscriptionEvent();
  const response = await app.request(new Request('http://admin.test/billing/paddle/webhook', {
    method: 'POST', headers: { host: 'admin.test', 'content-type': 'application/json', 'paddle-signature': sign(body) }, body,
  }));
  a.equal(response.status, 200, await response.clone().text());
  a.equal(applySubscription.mock.calls.length, 1);
  const off = createApp({ store: new MemoryStore(), auth: new MemoryAuthStore(), editorHost: 'admin.test', editorOrigin: 'http://admin.test' });
  const missing = await off.request(new Request('http://admin.test/billing/paddle/webhook', {
    method: 'POST', headers: { host: 'admin.test', 'paddle-signature': sign(body) }, body,
  }));
  a.notEqual(missing.status, 200, 'without billing configured nothing answers the webhook');
});

const renewalDate = '2026-12-19T01:00:00Z';
const launchPrice = 'pri_01launchmonthly01', studioPrice = 'pri_01studiomonthly01';
const paidStatus = (): AccountPlanStatus => ({
  ...freeStatus(), plan: 'launch', source: 'subscription', subscriptions: [{
    id: 'sub_01webhooktest0001', environment: 'sandbox', priceId: launchPrice, plan: 'launch',
    status: 'active', statusChangedAt: null, currentPeriodEnd: renewalDate, scheduledChange: null,
  }],
});

function paymentReviewRig() {
  const status = paidStatus();
  const row = status.subscriptions[0];
  let amount = '1200', version = 1;
  const writes: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    a.equal(new URL(String(url)).origin, 'https://sandbox-api.paddle.com');
    a.ok([ '', '/preview', '/cancel' ].some(suffix => path === '/subscriptions/' + row.id + suffix));
    const sub = {
      id: row.id, status: 'active', custom_data: { pagecraft_user_id: 'user-1' },
      updated_at: '2026-11-20T12:00:0' + version + 'Z', items: [{ quantity: 1, price: { id: row.priceId } }],
      scheduled_change: row.scheduledChange ? { action: row.scheduledChange, effective_at: renewalDate } : null,
      current_billing_period: { ends_at: renewalDate },
    };
    if (init?.method === 'GET') return Response.json({ data: sub });
    const body = JSON.parse(String(init?.body));
    if (path.endsWith('/preview')) {
      a.equal(init?.method, 'PATCH');
      a.equal(body.proration_billing_mode, 'prorated_immediately');
      a.equal(body.on_payment_failure, 'prevent_change');
      return Response.json({ data: { update_summary: { result: {
        action: body.items[0].price_id === studioPrice ? 'charge' : 'credit', amount, currency_code: 'USD',
      } }, next_transaction: { details: { totals: { grand_total: '2400', currency_code: 'USD' } } }, next_billed_at: renewalDate } });
    }
    writes.push({ path, method: String(init?.method), body });
    version++;
    if (body.items) {
      row.priceId = body.items[0].price_id;
      row.plan = row.priceId === launchPrice ? 'launch' : 'studio';
      status.plan = row.plan;
    } else {
      row.scheduledChange = path.endsWith('/cancel') ? 'cancel' : null;
    }
    return Response.json({ data: { ...sub, items: [{ quantity: 1, price: { id: row.priceId } }],
      scheduled_change: row.scheduledChange ? { action: row.scheduledChange, effective_at: renewalDate } : null } });
  };
  const r = rig({ status: () => status, fetcher });
  const post = (step: string, body: Record<string,string>) => r.app.request('/account/plans/' + step, {
    method: 'POST', body: new URLSearchParams(body),
  });
  const review = async (body: Record<string,string>) => {
    const response = await post('review', body);
    const html = await response.text();
    a.equal(response.status, 200, html.replace(/<[^>]+>/g, ' ').slice(-1500));
    const token = html.match(/name="token" value="([^"]+)"/)?.[1];
    a.ok(token, 'the review renders a confirmation token');
    return { html, token };
  };
  return { r, status, row, writes, post, review, setAmount: (next: string) => { amount = next; } };
}

test('existing subscribers review prorated upgrades and downgrades before the provider changes the same subscription', async () => {
  const flow = paymentReviewRig();
  const upgrade = await flow.review({ action: 'change', plan: 'studio', interval: 'monthly', subscriptionId: 'unrelated' });
  a.match(upgrade.html, /USD\s+12\.00 charge/);
  a.match(upgrade.html, /USD\s+24\.00/);
  a.equal(flow.writes.length, 0);
  flow.setAmount('1300');
  a.equal((await flow.post('confirm', { token: upgrade.token })).status, 409, 'changed quote requires a new review');
  a.equal(flow.writes.length, 0);
  const reviewed = await flow.review({ action: 'change', plan: 'studio', interval: 'monthly' });
  a.equal((await flow.post('confirm', { token: reviewed.token })).status, 303);
  a.deepEqual(flow.writes[0], { path: '/subscriptions/' + flow.row.id, method: 'PATCH', body: {
    items: [{ price_id: studioPrice, quantity: 1 }], proration_billing_mode: 'prorated_immediately', on_payment_failure: 'prevent_change',
  } });
  a.equal((await flow.post('confirm', { token: reviewed.token })).status, 422, 'duplicate cannot bill the same change again');
  const downgrade = await flow.review({ action: 'change', plan: 'launch', interval: 'monthly' });
  a.match(downgrade.html, /USD\s+13\.00 credit/);
  a.equal((await flow.post('confirm', { token: downgrade.token })).status, 303);
  a.deepEqual(flow.writes[1].body.items, [{ price_id: launchPrice, quantity: 1 }]);
});

test('cancellation keeps existing paid access through term and renewal removes only a pending cancellation', async () => {
  const flow = paymentReviewRig();
  a.equal((await flow.post('review', { action: 'renew' })).status, 409);
  const cancel = await flow.review({ action: 'cancel' });
  a.match(cancel.html, /December 19, 2026/);
  a.equal((await flow.post('confirm', { token: cancel.token })).status, 303);
  a.deepEqual(flow.writes[0], { path: '/subscriptions/' + flow.row.id + '/cancel', method: 'POST', body: { effective_from: 'next_billing_period' } });
  a.equal(flow.row.plan, 'launch');
  a.equal((await flow.post('confirm', { token: cancel.token })).status, 409);
  const resume = await flow.review({ action: 'renew' });
  a.equal((await flow.post('confirm', { token: resume.token })).status, 303);
  a.deepEqual(flow.writes[1], { path: '/subscriptions/' + flow.row.id, method: 'PATCH', body: { scheduled_change: null } });
  a.equal((await flow.post('confirm', { token: cancel.token })).status, 409, 'prior review cannot undo a later renewal');
  a.equal(flow.writes.length, 2);
});

test('unavailable billing, another environment and ambiguous subscriptions cannot initiate changes', async () => {
  const unreadable = rig({ status: () => { throw new Error('unavailable'); } });
  const page = await unreadable.app.request('/account/plans');
  a.equal(page.status, 503);
  a.doesNotMatch(await page.text(), /action="\/account\/plans\/checkout"/);
  const flow = paymentReviewRig();
  flow.row.environment = 'live';
  a.equal((await flow.post('review', { action: 'cancel' })).status, 409);
  flow.row.environment = 'sandbox';
  flow.status.subscriptions.push({ ...flow.row, id: 'sub_01othersub0000001' });
  a.equal((await flow.post('review', { action: 'change', plan: 'studio', interval: 'monthly' })).status, 409);
  flow.r.signOut();
  a.equal((await flow.post('confirm', { token: '' })).status, 303);
  a.equal(flow.writes.length, 0);
});

test('only matching configured catalog prices are displayed and simultaneous reads share a bounded cache', async () => {
  const launch = { id: launchPrice, status: 'active', unit_price: { amount: '1200', currency_code: 'USD' },
    billing_cycle: { interval: 'month', frequency: 1 }, quantity: { minimum: 1, maximum: 1 } };
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = new URL(String(url));
    a.equal(target.origin + target.pathname, 'https://sandbox-api.paddle.com/prices');
    a.deepEqual(target.searchParams.get('id')!.split(','), [launchPrice, 'pri_01launchyearly001', studioPrice]);
    a.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + env.PADDLE_API_KEY);
    return Response.json({ data: [
      launch, { ...launch, id: studioPrice, unit_price: { amount: '99999', currency_code: 'USD' }, billing_cycle: { interval: 'year', frequency: 1 } },
      { ...launch, id: 'pri_01notconfigured01', unit_price: { amount: '99999', currency_code: 'USD' } },
    ] });
  });
  const r = rig({ fetcher });
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    const [one, two] = await Promise.all([r.app.request('/account/plans'), r.app.request('/account/plans')]);
    a.equal(two.status, 200);
    const html = await one.text();
    a.match(html, /USD\s+12\.00/);
    a.doesNotMatch(html, /999\.99/);
    a.equal(fetcher.mock.calls.length, 1);
    vi.setSystemTime(Date.now() + 61_000);
    await r.app.request('/account/plans');
    a.equal(fetcher.mock.calls.length, 2);
  } finally { vi.useRealTimers(); }
  const offline = rig({ fetcher: async () => new Response(null, { status: 503 }) });
  const response = await offline.app.request('/account/plans');
  a.equal(response.status, 200);
  a.match(await response.text(), /Upgrade to Launch/);
});
