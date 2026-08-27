import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryOwnedSiteStore } from '../src/accounts.ts';
import { TestHumanChallenge } from '../src/turnstile.ts';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import type { Context } from 'hono';

const doc = () => {
  Core.seed();
  return structuredClone({ schemaVersion: Core.SCHEMA, meta: Core.state.meta,
    header: Core.state.header, footer: Core.state.footer, pages: Core.state.pages });
};

class FakeAccountAuth implements AccountAuth {
  current: VerifiedIdentity | null = null;
  signup: { email: string; name: string; captchaToken: string } | null = null;
  async identity(_c: Context) { return this.current; }
  async signUp(_c: Context, input: { email: string; password: string; name: string; captchaToken: string }) {
    this.signup = { email: input.email, name: input.name, captchaToken: input.captchaToken };
    return 'confirmation_required' as const;
  }
  async signIn(_c: Context, input: { email: string; password: string }) {
    if (input.password !== 'correct horse battery') return null;
    return this.current = { authUserId: 'auth-1', email: input.email, name: 'Builder' };
  }
  async confirm() { return this.current; }
  async forgot() {}
  async reset(_c: Context, password: string) { return password.length >= 12; }
  async signOut() { this.current = null; }
}

const rig = () => {
  const store = new MemoryStore(), auth = new MemoryAuthStore(), accountAuth = new FakeAccountAuth();
  const app = createApp({
    store, auth, accountAuth, ownedSites: new MemoryOwnedSiteStore(store, auth),
    challenge: new TestHumanChallenge(), turnstileSiteKey: 'test-site-key',
    editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>'
  });
  const request = (path: string, init: RequestInit = {}) => app.request(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', origin: 'http://admin.test', ...(init.headers || {}) }
  }));
  return { store, auth, accountAuth, app, request };
};

test('anonymous visitors are sent to sign in and a verified identity always sees the dashboard', async () => {
  const { request, accountAuth } = rig();
  const anonymous = await request('/edit/unknown');
  a.equal(anonymous.status, 302);
  a.equal(anonymous.headers.get('location'), '/sign-in?next=%2Fedit%2Funknown');

  accountAuth.current = { authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder' };
  const dashboard = await request('/');
  a.equal(dashboard.status, 200);
  const html = await dashboard.text();
  a.match(html, /Your sites/);
  a.match(html, /Start your first site/);
});

test('signup validates a human challenge and does not provision an unconfirmed profile', async () => {
  const { request, auth, accountAuth } = rig();
  const body = new URLSearchParams({ name: 'Builder', email: 'Builder@Example.test',
    password: 'correct horse battery', passwordConfirm: 'correct horse battery',
    'cf-turnstile-response': 'pagecraft-test-human' });
  const response = await request('/auth/signup', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body
  });
  a.equal(response.status, 303);
  a.match(response.headers.get('location') || '', /^\/sign-in\?message=/);
  a.deepEqual(accountAuth.signup, {
    email: 'builder@example.test', name: 'Builder', captchaToken: 'pagecraft-test-human'
  });
  a.equal(await auth.userByEmail('builder@example.test'), null);
});

test('three concurrent owned sites succeed and the fourth is rejected atomically', async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = { authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder' };
  await auth.ensureAuthUser('auth-1', 'builder@example.test', 'Builder');
  const make = (name: string) => request('/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, doc: doc() })
  });
  const responses = await Promise.all(['One', 'Two', 'Three', 'Four'].map(make));
  a.deepEqual(responses.map(response => response.status).sort(), [201, 201, 201, 409]);
  const limited = responses.find(response => response.status === 409)!;
  a.deepEqual(await limited.json(), { error: 'site_limit_reached', limit: 3 });
});

test('cross-origin cookie-backed mutations are refused', async () => {
  const { app, accountAuth } = rig();
  accountAuth.current = { authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder' };
  const response = await app.request(new Request('http://admin.test/api/sites', {
    method: 'POST', headers: { host: 'admin.test', origin: 'https://attacker.test', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Nope' })
  }));
  a.equal(response.status, 403);
  a.deepEqual(await response.json(), { error: 'origin_not_allowed' });
});
