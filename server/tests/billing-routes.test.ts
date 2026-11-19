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
import { MemoryStore } from '../src/store.ts';

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
  a.match(page, /Choose Launch/);
  a.match(page, /Choose Studio/);
  a.doesNotMatch(page, /Choose Pro/, 'only plans with configured prices are offered');

  a.equal((await post({ plan: 'pro', interval: 'monthly' })).status, 422);
  a.equal((await post({ plan: 'free', interval: 'monthly' })).status, 422);
  const response = await post({ plan: 'launch', interval: 'yearly' });
  a.equal(response.status, 303);
  a.equal(response.headers.get('location'), 'https://app.test/account/plans/checkout?_ptxn=txn_01checkouttest01');
  const [, init] = (r.fetcher as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
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
  a.match(html, /2026-12-19/);
  a.doesNotMatch(html, /<form|Always free|Your current plan/);
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
