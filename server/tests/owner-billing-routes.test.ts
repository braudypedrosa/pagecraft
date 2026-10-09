import { afterEach, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { createFounderReportsApp } from '../src/founder-reports.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryStore } from '../src/store.ts';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import { FileOwnerCostStore } from '../src/owner-billing.ts';
import { ownerBudgetMinorUnits } from '../src/owner-billing-routes.ts';

const OWNER = '123e4567-e89b-42d3-a456-426614174000';
const OTHER = '123e4567-e89b-42d3-a456-426614174001';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

async function rig(options: { ids?: string[]; legacy?: boolean; failCosts?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-owner-route-'));
  roots.push(root);
  const costs = new FileOwnerCostStore(join(root, 'costs.json'));
  let identity: VerifiedIdentity | null = { authUserId: OWNER, email: 'owner@example.test', name: 'Owner' };
  const source = vi.fn(async () => 9);
  const accountAuth = { identity: async () => identity } as unknown as AccountAuth;
  if (options.legacy) identity = null;
  const app = createFounderReportsApp({
    accountAuth, host: 'admin.test', origin: 'http://admin.test', dataEnvironment: 'staging',
    billing: { ownerAuthUserIds: options.ids ?? [OWNER],
      costs: options.failCosts ? { list: async () => { throw new Error('private file path'); }, put: async () => { throw new Error('private file path'); }, remove: async () => { throw new Error('private file path'); } } : costs,
      platform: { siteCount: source },
    },
  });
  const request = (path: string, init: RequestInit = {}) => app.request(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', origin: 'http://admin.test', ...init.headers },
  }));
  const post = (fields: Record<string, string>, headers: Record<string, string> = {}) => request('/owner/billing/costs', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields),
  });
  return { request, post, costs, source, setIdentity: (value: VerifiedIdentity | null) => { identity = value; } };
}

test('billing pages and JSON use exact account authorization and private responses', async () => {
  const r = await rig();
  let page = await r.request('/overview');
  a.equal(page.status, 200);
  a.match(page.headers.get('cache-control') || '', /private, no-store/);
  a.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
  a.match(await page.text(), /Paddle is not connected/);
  const json = await r.request('/api/owner/billing');
  a.equal(json.status, 200);
  const data = await json.json();
  a.equal(data.billing.state, 'not_connected');
  a.equal(data.platform.siteCount, 9);
  a.equal(data.platform.accountCount, null);
  a.equal(data.billing.completedGrossCustomerCharges, undefined);
  r.source.mockClear();
  r.setIdentity({ authUserId: OTHER, email: 'owner@example.test', name: 'Owner' });
  a.equal((await r.request('/overview')).status, 403);
  a.equal((await r.request('/api/owner/billing')).status, 403);
  a.equal((await r.post({label:'Attack',category:'other',amount:'1',currencyCode:'USD'})).status, 403);
  a.equal(r.source.mock.calls.length, 0);
  a.deepEqual(await r.costs.list(), []);
  r.setIdentity(null);
  page = await r.request('/overview');
  a.equal(page.status, 303);
  a.equal(page.headers.get('location'), '/sign-in');
  a.equal((await r.request('/api/owner/billing')).status, 401);
});

test('missing configuration, legacy auth and custom site hosts cannot access finances', async () => {
  const missing = await rig({ ids: [] });
  a.equal((await missing.request('/overview')).status, 403);
  a.equal(missing.source.mock.calls.length, 0);
  const legacy = await rig({ legacy: true });
  a.equal((await legacy.request('/api/owner/billing', { headers: { authorization: 'Bearer pretend-owner', 'x-pagecraft-editor-session': 'pretend-owner' } })).status, 401);
  const r = await rig();
  a.equal((await r.request('/overview', { headers: { host: 'customer.test' } })).status, 404);
  a.equal((await r.request('/api/owner/billing', { headers: { host: 'customer.test' } })).status, 404);
  a.equal(r.source.mock.calls.length, 0);
});

test('the customer application exposes no founder billing routes or navigation', async () => {
  const accountAuth = { identity: async () => ({ authUserId: OWNER, email: 'owner@example.test', name: 'Owner' }) } as unknown as AccountAuth;
  const app = createApp({ store: new MemoryStore(), auth: new MemoryAuthStore(), accountAuth,
    editorHost: 'admin.test', editorOrigin: 'http://admin.test' });
  const request = (path: string) => app.request(new Request(`http://admin.test${path}`, { headers: {host:'admin.test'} }));
  for (const path of ['/', '/account']) a.doesNotMatch(await (await request(path)).text(), /href="\/owner\/billing"/);
  for (const path of ['/owner/billing', '/api/owner/billing']) a.equal((await request(path)).status, 404);
});

test('budget creation, editing and removal persist exact currencies without changing billing status', async () => {
  const r = await rig();
  const first = await r.post({ label: 'Hosting', category: 'hosting', amount: '12.34', currencyCode: 'usd' });
  a.equal(first.status, 303);
  const rows = await r.costs.list();
  a.equal(rows[0].amountMinor, '1234');
  a.equal(rows[0].currencyCode, 'USD');
  const update = await r.post({ id: rows[0].id, label: 'Hosting revised', category: 'hosting', amount: '15.50', currencyCode: 'USD' });
  a.equal(update.status, 303);
  a.equal((await r.costs.list())[0].amountMinor, '1550');
  const page = await r.request(`/costs?edit=${rows[0].id}`);
  a.match(await page.text(), /value="15.50"/);
  const response = await r.request(`/owner/billing/costs/${rows[0].id}/remove`, { method: 'POST' });
  a.equal(response.status, 303);
  a.deepEqual(await r.costs.list(), []);
  const data = await (await r.request('/api/owner/billing')).json();
  a.equal(data.billing.state, 'not_connected');
});

test('budget mutations reject cross-origin, missing-origin and editor-token bypass attempts', async () => {
  const r = await rig();
  const fields = { label: 'CSRF', category: 'other', amount: '100', currencyCode: 'USD' };
  const origins: Record<string, string>[] = [
    { origin: 'https://evil.test' },
    { origin: '', referer: '' },
    { origin: 'https://evil.test', authorization: 'Bearer unrelated-editor-token', 'x-pagecraft-editor-session': 'unrelated-editor-token' },
  ];
  for (const headers of origins) a.equal((await r.post(fields, headers)).status, 403);
  a.deepEqual(await r.costs.list(), []);
});

test('invalid amounts and oversized inputs preserve stored budgets and recover safely', async () => {
  const r = await rig();
  const fields = { label: 'My budget', category: 'hosting', amount: '1.005', currencyCode: 'USD' };
  let response = await r.post(fields);
  a.equal(response.status, 422);
  a.match(await response.text(), /notice error/);
  response = await r.post({...fields, amount:'-10'});
  a.equal(response.status, 422);
  response = await r.post({...fields, amount:'10', label:'x'.repeat(9000)});
  a.equal(response.status, 413);
  a.deepEqual(await r.costs.list(), []);
});

test('cost storage failure stays unavailable and does not expose a filesystem path', async () => {
  const r = await rig({ failCosts: true });
  const data = await (await r.request('/api/owner/billing')).json();
  a.equal(data.costs.state, 'unavailable');
  a.equal(data.costs.rows, undefined);
  const response = await r.post({ label: 'Hosting', category: 'hosting', amount: '10', currencyCode: 'USD' });
  a.equal(response.status, 503);
  a.doesNotMatch(await response.text(), /private file path/);
});

test('major-unit conversion honors currency precision and accepts no negative or exponential values', () => {
  a.equal(ownerBudgetMinorUnits('12.34', 'USD'), '1234');
  a.equal(ownerBudgetMinorUnits('12.34', 'PHP'), '1234');
  a.equal(ownerBudgetMinorUnits('100', 'JPY'), '100');
  a.equal(ownerBudgetMinorUnits('1.234', 'BHD'), '1234');
  a.equal(ownerBudgetMinorUnits('9007199254.74', 'USD'), '900719925474');
  for (const bad of ['-1', '1e3', '1,000', '1.234', '00.10', '10000000000.00']) a.equal(ownerBudgetMinorUnits(bad, 'USD'), null);
  a.equal(ownerBudgetMinorUnits('10', 'ZZZ'), null);
  a.equal(ownerBudgetMinorUnits('1.5', 'JPY'), null);
});
