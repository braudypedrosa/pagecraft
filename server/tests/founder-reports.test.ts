import a from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Context } from 'hono';
import { afterEach, test, vi } from 'vitest';
import { UI_FONT_FACES } from '../../shared/ui-fonts.js';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import { createFounderReportsApp } from '../src/founder-reports.ts';

const OWNER = '123e4567-e89b-42d3-a456-426614174000';
const OTHER = '123e4567-e89b-42d3-a456-426614174001';
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

class FakeAccountAuth {
  current: VerifiedIdentity | null = null;
  signInResult: VerifiedIdentity | 'challenge' | null = null;
  identityError: Error | null = null;
  signInError: Error | null = null;
  signOutError: Error | null = null;
  identityCalls = 0;
  signIn = vi.fn(async (_c: Context, _input: { email: string; password: string; captchaToken: string }) => {
    if (this.signInError) throw this.signInError;
    return this.signInResult;
  });
  signOut = vi.fn(async () => {
    if (this.signOutError) throw this.signOutError;
    this.current = null;
  });
  oauth = vi.fn();
  signUp = vi.fn();
  async identity() {
    this.identityCalls++;
    if (this.identityError) throw this.identityError;
    return this.current;
  }
}

function makeRig(input: {
  current?: VerifiedIdentity | null;
  ids?: string[];
  brandRoot?: string;
  assetRoot?: string;
  now?: () => Date;
  challengeSiteKey?: string;
} = {}) {
  const auth = new FakeAccountAuth();
  auth.current = input.current ?? null;
  const app = createFounderReportsApp({
    host: 'reports.test', origin: 'http://reports.test', appOrigin: 'http://app.test',
    dataEnvironment: 'staging', accountAuth: auth as unknown as AccountAuth,
    challengeSiteKey: input.challengeSiteKey,
    brandRoot: input.brandRoot,
    assetRoot: input.assetRoot,
    billing: { ownerAuthUserIds: input.ids ?? [OWNER], now: input.now },
  });
  const request = (path: string, init: RequestInit = {}) => app.request(new Request(`http://reports.test${path}`, {
    ...init,
    headers: { host: 'reports.test', ...(init.headers || {}) },
  }));
  const post = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) => request(path, {
    method: 'POST',
    headers: { origin: 'http://reports.test', 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields),
  });
  return { app, auth, request, post };
}

const owner = (id = OWNER): VerifiedIdentity => ({
  authUserId: id, email: 'founder@example.test', name: 'Founder', createdAt: '2026-01-01T00:00:00.000Z',
});

test('strict host and privacy headers cover redirects, errors and unknown paths', async () => {
  const r = makeRig();
  const root = await r.request('/');
  a.equal(root.status, 303);
  a.equal(root.headers.get('location'), '/overview');
  for (const response of [root, await r.request('/missing'), await r.request('/sign-in')]) {
    a.match(response.headers.get('cache-control') || '', /no-store/);
    a.match(response.headers.get('x-robots-tag') || '', /noindex/);
    a.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  }
  const wrongHost = await r.request('/sign-in', { headers: { host: 'staging.itspagecraft.com' } });
  a.equal(wrongHost.status, 404);
  a.match(wrongHost.headers.get('cache-control') || '', /no-store/);
});

test('standalone route surface has only reports, sign-in, logout and explicit assets', async () => {
  const r = makeRig();
  for (const path of [
    '/sign-up', '/auth/google', '/auth/confirm', '/account', '/sites', '/api/sites',
    '/edit/site-1', '/notifications', '/review/x', '/v1/wordpress-distribution/x', '/customer.example',
  ]) a.equal((await r.request(path)).status, 404, path);
  a.equal((await r.request('/auth/logout')).status, 404);
  for (const path of ['/auth/google', '/auth/signup', '/api/sites', '/sites/new']) {
    a.equal((await r.request(path, { method: 'POST', body: 'unknown' })).status, 404, `POST ${path}`);
  }
});

test('billing authorizes only the immutable verified owner id and reuses identity per request', async () => {
  const r = makeRig({ current: owner() });
  const page = await r.request('/overview');
  a.equal(page.status, 200);
  const html = await page.text();
  a.match(html, /Pagecraft HQ/);
  a.match(html, /Staging data/);
  a.match(html, /founder@example\.test/);
  a.doesNotMatch(html, /dashboard-app|pc-app-sidebar/);
  a.equal(r.auth.identityCalls, 1);

  r.auth.current = owner(OTHER);
  a.equal((await r.request('/overview')).status, 403);
  a.equal((await r.request('/api/owner/billing')).status, 403);
  r.auth.current = null;
  a.equal((await r.request('/overview')).status, 303);
  a.equal((await r.request('/api/owner/billing')).status, 401);
});

test('existing-account sign-in admits allowlisted ids and clears ordinary sessions', async () => {
  const r = makeRig({ challengeSiteKey: 'pagecraft-local-test' });
  r.auth.signInResult = owner();
  let response = await r.post('/auth/sign-in', {
    email: 'FOUNDER@example.test', password: 'correct password',
    'cf-turnstile-response': 'pagecraft-test-human',
  });
  a.equal(response.status, 303);
  a.equal(response.headers.get('location'), '/overview');
  a.equal(r.auth.signIn.mock.calls[0]?.[1].email, 'founder@example.test');

  r.auth.signInResult = owner(OTHER);
  response = await r.post('/auth/sign-in', {
    email: 'person@example.test', password: 'correct password',
    'cf-turnstile-response': 'pagecraft-test-human',
  }, { cookie: 'pc_reports_auth=base; pc_reports_auth.0=chunk0; pc_reports_auth.1=chunk1; pc_auth=customer; unrelated=keep' });
  a.equal(response.status, 403);
  a.equal(response.headers.get('clear-site-data'), null);
  const cleared = response.headers.get('set-cookie') || '';
  a.match(cleared, /pc_reports_auth=/);
  a.match(cleared, /pc_reports_auth\.0=/);
  a.match(cleared, /pc_reports_auth\.1=/);
  a.doesNotMatch(cleared, /(?:^|[, ])pc_auth=/);
  a.doesNotMatch(cleared, /unrelated=/);
  a.doesNotMatch(cleared, /Domain=/i);
  a.equal(r.auth.signOut.mock.calls.length, 1);
  a.equal(r.auth.oauth.mock.calls.length, 0);
  a.equal(r.auth.signUp.mock.calls.length, 0);

  r.auth.current = owner(OTHER);
  response = await r.request('/sign-in', { headers: {
    cookie: 'pc_reports_auth.0=chunk0; pc_auth=customer',
  } });
  a.equal(response.status, 403);
  a.match(response.headers.get('set-cookie') || '', /pc_reports_auth\.0=/);
  a.doesNotMatch(response.headers.get('set-cookie') || '', /(?:^|[, ])pc_auth=/);
  a.equal(r.auth.signOut.mock.calls.length, 2);
});

test('all POST routes require trusted origin even with bearer credentials', async () => {
  const r = makeRig({ current: owner() });
  for (const path of ['/auth/sign-in', '/auth/logout', '/owner/billing/costs', '/crm/contacts']) {
    for (const headers of [
      {},
      { origin: 'https://evil.test' },
      { origin: 'https://evil.test', authorization: 'Bearer unrelated' },
    ] as Record<string, string>[]) {
      const response = await r.request(path, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: '',
      });
      a.equal(response.status, 403, `${path} ${JSON.stringify(headers)}`);
    }
  }
  a.equal(r.auth.signIn.mock.calls.length, 0);
  a.equal(r.auth.signOut.mock.calls.length, 0);
});

test('logout clears host session and redacts provider failures', async () => {
  const r = makeRig({ current: owner() });
  r.auth.signOutError = new Error('/private/auth/session-secret');
  const response = await r.post('/auth/logout', {}, {
    cookie: 'pc_reports_auth.0=chunk0; pc_reports_auth.1=chunk1; pc_auth=customer',
  });
  a.equal(response.status, 303);
  a.equal(response.headers.get('location'), '/sign-in');
  a.equal(response.headers.get('clear-site-data'), null);
  const cleared = response.headers.get('set-cookie') || '';
  a.match(cleared, /pc_reports_auth=/);
  a.match(cleared, /pc_reports_auth\.0=/);
  a.match(cleared, /pc_reports_auth\.1=/);
  a.doesNotMatch(cleared, /(?:^|[, ])pc_auth=/);
  a.doesNotMatch(await response.text(), /session-secret/);
});

test('authentication and report failures are redacted and fail closed', async () => {
  const authFailure = makeRig();
  authFailure.auth.identityError = new Error('https://private-auth.invalid secret-token');
  let response = await authFailure.request('/api/owner/billing');
  a.equal(response.status, 503);
  a.deepEqual(await response.json(), { error: 'authentication_unavailable' });

  const signInFailure = makeRig();
  signInFailure.auth.signInError = new Error('private Supabase failure');
  response = await signInFailure.post('/auth/sign-in', {
    email: 'founder@example.test', password: 'password',
  }, { cookie: 'pc_reports_auth.0=chunk0; pc_auth=customer' });
  a.equal(response.status, 503);
  a.equal(response.headers.get('clear-site-data'), null);
  const cleared = response.headers.get('set-cookie') || '';
  a.match(cleared, /pc_reports_auth\.0=/);
  a.doesNotMatch(cleared, /(?:^|[, ])pc_auth=/);
  a.doesNotMatch(await response.text(), /Supabase failure/);

  const reportFailure = makeRig({ current: owner(), now: () => { throw new Error('/private/report-store'); } });
  response = await reportFailure.request('/api/owner/billing');
  a.equal(response.status, 503);
  a.deepEqual(await response.json(), { error: 'billing_unavailable' });
  response = await reportFailure.request('/overview');
  a.equal(response.status, 503);
  a.doesNotMatch(await response.text(), /private\/report-store/);
});

test('login enforces content type, body limit, challenge and per-account rate limit', async () => {
  const r = makeRig({ challengeSiteKey: 'pagecraft-local-test' });
  let response = await r.request('/auth/sign-in', {
    method: 'POST', headers: { origin: 'http://reports.test', 'content-type': 'application/json' }, body: '{}',
  });
  a.equal(response.status, 415);
  response = await r.post('/auth/sign-in', { email: 'person@example.test', password: 'x'.repeat(17_000) });
  a.equal(response.status, 413);
  response = await r.request('/auth/logout', {
    method: 'POST', headers: { origin: 'http://reports.test', 'content-type': 'text/plain' },
    body: 'x'.repeat(1100),
  });
  a.equal(response.status, 413);
  response = await r.post('/auth/sign-in', { email: 'person@example.test', password: 'password' });
  a.equal(response.status, 422);
  for (let attempt = 0; attempt < 8; attempt++) {
    response = await r.post('/auth/sign-in', {
      email: 'limited@example.test', password: 'wrong',
      'cf-turnstile-response': 'pagecraft-test-human',
    });
    a.equal(response.status, 401);
  }
  response = await r.post('/auth/sign-in', {
    email: 'limited@example.test', password: 'wrong',
    'cf-turnstile-response': 'pagecraft-test-human',
  });
  a.equal(response.status, 429);
  a.equal(response.headers.get('retry-after'), '900');
});

test('brand serving uses an explicit filename allowlist and never exposes source paths', async () => {
  const brandRoot = await mkdtemp(join(tmpdir(), 'pagecraft-founder-brand-'));
  roots.push(brandRoot);
  await mkdir(join(brandRoot, 'logo'), { recursive: true });
  await mkdir(join(brandRoot, 'fonts'), { recursive: true });
  await writeFile(join(brandRoot, 'logo/pagecraft-logo-primary-dark.svg'), '<svg>logo</svg>');
  await writeFile(join(brandRoot, 'pagecraft-favicon.svg'), '<svg>icon</svg>');
  for (const { file } of UI_FONT_FACES) await writeFile(join(brandRoot, 'fonts', file), `font:${file}`);
  const r = makeRig({ brandRoot });

  let response = await r.request('/brand/pagecraft-logo.svg');
  a.equal(response.status, 200);
  a.equal(await response.text(), '<svg>logo</svg>');
  response = await r.request(`/brand/fonts/${UI_FONT_FACES[0].file}`, { method: 'HEAD' });
  a.equal(response.status, 200);
  a.equal(await response.text(), '');
  for (const path of [
    '/brand/fonts/not-allowlisted.ttf', '/brand/fonts/../../../server/src/account-auth.ts',
    '/brand/%2e%2e/server/src/account-auth.ts', '/brand/logo/pagecraft-logo-primary-dark.svg',
  ]) a.equal((await r.request(path)).status, 404, path);
  a.equal((await r.request('/brand/pagecraft-logo.svg', { method: 'POST', headers: { origin: 'http://reports.test' } })).status, 404);
});

test('invalid standalone host and origin configuration fails before serving', () => {
  const auth = new FakeAccountAuth() as unknown as AccountAuth;
  const base = { accountAuth: auth, billing: { ownerAuthUserIds: [OWNER] }, dataEnvironment: 'staging' as const };
  a.throws(() => createFounderReportsApp({ ...base, host: 'reports.test', origin: 'https://other.test' }));
  a.throws(() => createFounderReportsApp({ ...base, host: 'reports.test/path', origin: 'https://reports.test' }));
  a.throws(() => createFounderReportsApp({ ...base, host: 'reports.test', origin: 'javascript:alert(1)' }));
  a.throws(() => createFounderReportsApp({ ...base, host: 'reports.test', origin: 'http://reports.test', assetRoot: 'relative/assets' }));
});

test('CRM libraries are self-hosted code assets with a strict filename and method allowlist', async () => {
  const assetRoot = await mkdtemp(join(tmpdir(), 'pagecraft-crm-assets-'));
  roots.push(assetRoot);
  await writeFile(join(assetRoot, 'founder-crm.js'), '/* library bundle */');
  await writeFile(join(assetRoot, 'founder-crm.css'), '/* library styles */');
  await writeFile(join(assetRoot, 'private.json'), '{"secret":"never serve"}');
  const r = makeRig({ assetRoot });
  for (const [file, type] of [['founder-crm.js', 'text/javascript'], ['founder-crm.css', 'text/css']]) {
    const response = await r.request(`/assets/${file}`);
    a.equal(response.status, 200);
    a.match(response.headers.get('content-type') || '', new RegExp(type));
    a.match(response.headers.get('cache-control') || '', /no-store/);
    a.match(response.headers.get('content-security-policy') || '', /script-src 'self'/);
    const bytes = await response.text();
    a.equal(Number(response.headers.get('content-length')), Buffer.byteLength(bytes));
    const head = await r.request(`/assets/${file}`, { method: 'HEAD' });
    a.equal(head.status, 200);
    a.equal(await head.text(), '');
  }
  for (const path of ['/assets/private.json', '/assets/founder-crm.js.map', '/assets/%2e%2e/private.json']) {
    a.equal((await r.request(path)).status, 404, path);
  }
  a.equal((await r.request('/assets/founder-crm.js', { method: 'POST', headers: { origin: 'http://reports.test' } })).status, 404);
  a.equal((await r.request('/assets/founder-crm.js', { headers: { host: 'staging.itspagecraft.com' } })).status, 404);
  a.equal((await makeRig().request('/assets/founder-crm.js')).status, 404);
});
