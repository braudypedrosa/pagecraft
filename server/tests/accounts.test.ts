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
  oauthRedirectTo: string | null = null;
  emailRedirectTo: string | null = null;
  passwordUpdate: { password: string; currentPassword?: string } | null = null;
  async identity(_c: Context) { return this.current; }
  async oauth(_c: Context, input: { provider: 'google'; redirectTo: string }) {
    this.oauthRedirectTo = input.redirectTo;
    return 'https://accounts.example.test/google';
  }
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
  async updateEmail(_c: Context, input: { email: string; redirectTo: string }) {
    if (!this.current) return false;
    this.emailRedirectTo = input.redirectTo;
    this.current = { ...this.current, email: input.email };
    return true;
  }
  async updatePassword(_c: Context, input: { password: string; currentPassword?: string }) {
    this.passwordUpdate = input;
    return input.password.length >= 12 && input.currentPassword !== 'wrong password';
  }
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
  const root = await request('/');
  a.equal(root.status, 302);
  a.equal(root.headers.get('location'), '/sign-in');

  const anonymous = await request('/edit/unknown');
  a.equal(anonymous.status, 302);
  a.equal(anonymous.headers.get('location'), '/sign-in?next=%2Fedit%2Funknown');

  accountAuth.current = { authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder' };
  const dashboard = await request('/');
  a.equal(dashboard.status, 200);
  const html = await dashboard.text();
  a.match(html, /<h1>Sites<\/h1>/);
  a.match(html, /Create your first site/);
  a.match(html, /class="pc-topbar"/);
  a.match(html, /class="pc-rail"/);
  a.match(html, /height:52px/);
  a.match(html, /width:62px/);
  a.match(html, /@media\(max-width:520px\).*\.pc-rail\{width:52px/);
  a.match(html, /<button type="button" data-site-view="sites" aria-pressed="true">/);
  a.doesNotMatch(html, /data-site-view="recent"/);
  a.doesNotMatch(html, /class="pc-rail-account"/);
  a.doesNotMatch(html, /data-account-open/);
});

test('dashboard renders searchable builder-style site cards and the owner quota', async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = { authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder' };
  await auth.ensureAuthUser('auth-1', 'builder@example.test', 'Builder');
  const created = await request('/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Braudy', doc: doc() })
  });
  a.equal(created.status, 201);

  const dashboard = await request('/');
  a.equal(dashboard.status, 200);
  const html = await dashboard.text();
  a.match(html, /placeholder="Search sites"/);
  a.match(html, /<option value="updated">Last edited<\/option>/);
  a.match(html, /class="pc-site-card"/);
  a.match(html, /class="pc-site-preview"/);
  a.match(html, /class="pc-preview-fallback"/);
  a.match(html, /data-copy-site/);
  a.match(html, />Braudy<\/div>/);
  a.match(html, /class="pc-site-url"/);
  a.match(html, />admin\.test\/braudy<\/a>/);
  a.match(html, />Edit<\/a>/);
  a.match(html, />View site<\/a>/);
  a.match(html, />Owner<\/div>/);
  a.match(html, /2 sites remaining/);
  a.match(html, /1 of 3 owned sites · 0 KB of 100 MB media used/);
  a.match(html, /data-site-view="owned"/);
  a.match(html, /data-filter-empty/);
  a.match(html, /No sites match your search/);
  a.match(html, /No shared sites yet/);
  a.match(html, /No owned sites yet/);
  a.match(html, />Add new site<\/a>/);
  a.match(html, /href="\/account">Account settings<\/a>/);
  a.match(html, /name="slug"/);
  a.match(html, /data-create-error/);
  a.match(html, /background-position:right 14px center/);
  a.match(html, /pc-custom-select-trigger/);
  a.match(html, /pc-custom-select-popover/);
  a.match(html, /\.pc-site-grid\{align-items:stretch\}/);
  a.match(html, /\.pc-site-card,\.pc-create-card\{height:100%\}/);
});

test('account settings shows profile, security, providers, and real free-plan usage', async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder',
    providers: ['email', 'google'], createdAt: '2026-01-12T00:00:00.000Z'
  };
  await auth.ensureAuthUser('auth-1', 'builder@example.test', 'Builder');

  const response = await request('/account');
  a.equal(response.status, 200);
  const html = await response.text();
  a.match(html, /<h1>Account settings<\/h1>/);
  a.match(html, /action="\/account\/profile"/);
  a.match(html, /value="Builder"/);
  a.match(html, /value="builder@example\.test"/);
  a.match(html, /Email and password<\/strong><span>Connected/);
  a.match(html, /Google<\/strong><span>Connected/);
  a.match(html, /action="\/account\/password"/);
  a.match(html, /Current password/);
  a.match(html, /Plan &amp; billing/);
  a.match(html, /<span class="pc-plan-badge">Free<\/span>/);
  a.match(html, /0 of 3 used/);
  a.match(html, /0 KB of 100 MB/);
  a.match(html, /Paid plans are not available yet/);
  a.match(html, /Joined Jan 12, 2026/);
  a.match(html, /href="#profile" aria-current="location"/);
  a.match(html, /addEventListener\('hashchange'/);
  a.match(html, /history\.pushState\(null,'','#'\+id\)/);
  a.match(html, /scrollIntoView\(\{block:'start',behavior:'auto'\}\)/);
});

test('account profile updates the local name and starts verified email change', async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: 'auth-1', email: 'old@example.test', name: 'Old Name', providers: ['email']
  };
  const user = await auth.ensureAuthUser('auth-1', 'old@example.test', 'Old Name');
  const response = await request('/account/profile', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'New Name', email: 'new@example.test' })
  });
  a.equal(response.status, 303);
  a.match(response.headers.get('location') || '', /Confirm\+the\+new\+email/);
  a.equal(accountAuth.emailRedirectTo, 'http://admin.test/auth/confirm?next=%2Faccount');
  a.equal((await auth.userById(user.id))?.name, 'New Name');

  const page = await request('/account');
  a.equal(page.status, 200);
  a.equal((await auth.userById(user.id))?.email, 'new@example.test');
});

test('account profile refuses an email already owned by another Pagecraft identity', async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: 'auth-1', email: 'first@example.test', name: 'First', providers: ['email']
  };
  await auth.ensureAuthUser('auth-1', 'first@example.test', 'First');
  await auth.ensureAuthUser('auth-2', 'taken@example.test', 'Second');
  const response = await request('/account/profile', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'First', email: 'taken@example.test' })
  });
  a.equal(response.status, 303);
  a.equal(response.headers.get('location'), '/account?error=email_conflict#profile');
});

test('password accounts require the current password while Google-only accounts can set one', async () => {
  const { request, accountAuth } = rig();
  accountAuth.current = {
    authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder', providers: ['email']
  };
  const wrong = await request('/account/password', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ currentPassword: 'wrong password', password: 'a long replacement passphrase',
      passwordConfirm: 'a long replacement passphrase' })
  });
  a.equal(wrong.headers.get('location'), '/account?error=password_current#security');

  accountAuth.current = {
    authUserId: 'auth-2', email: 'google@example.test', name: 'Google', providers: ['google']
  };
  const set = await request('/account/password', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: 'a long replacement passphrase',
      passwordConfirm: 'a long replacement passphrase' })
  });
  a.equal(set.headers.get('location'), '/account?message=Password+updated.#security');
  a.deepEqual(accountAuth.passwordUpdate, { password: 'a long replacement passphrase' });
});

test('account mutations enforce the browser origin check', async () => {
  const { request, accountAuth } = rig();
  accountAuth.current = {
    authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder', providers: ['email']
  };
  const response = await request('/account/profile', {
    method: 'POST', headers: { origin: 'https://elsewhere.test', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'Changed', email: 'builder@example.test' })
  });
  a.equal(response.status, 403);
  a.deepEqual(await response.json(), { error: 'origin_not_allowed' });
});

test('site creation reports usable slug errors to JSON and redirects form submissions safely', async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = { authUserId: 'auth-1', email: 'builder@example.test', name: 'Builder' };
  await auth.ensureAuthUser('auth-1', 'builder@example.test', 'Builder');

  const invalid = await request('/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Invalid', slug: 'Not A Slug' })
  });
  a.equal(invalid.status, 422);
  a.deepEqual(await invalid.json(), {
    error: 'invalid_slug',
    detail: 'Use lowercase letters, numbers, and single hyphens. Maximum 40 characters.'
  });

  const invalidForm = await request('/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'Invalid', slug: 'Not A Slug' })
  });
  a.equal(invalidForm.status, 303);
  a.equal(invalidForm.headers.get('location'), '/?error=slug');

  const first = await request('/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'First', slug: 'reserved-address' })
  });
  a.equal(first.status, 201);
  const duplicate = await request('/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Second', slug: 'reserved-address' })
  });
  a.equal(duplicate.status, 409);
  a.deepEqual(await duplicate.json(), {
    error: 'slug_taken', detail: 'That site address is already in use. Choose another.'
  });
});

test('sign in offers Google and email, links to registration, and uses the Pagecraft logo', async () => {
  const { request } = rig();
  const response = await request('/sign-in');
  a.equal(response.status, 200);
  const html = await response.text();
  a.match(html, /Continue with Google/);
  a.match(html, /action="\/auth\/login"/);
  a.match(html, /href="\/sign-up"/);
  a.match(html, /href="\/privacy"/);
  a.match(html, /href="\/terms"/);
  a.match(html, /src="\/brand\/pagecraft-logo\.svg\?v=dark-2"/);
  a.match(html, /data-theme="dark"/);
  a.match(html, /rel="icon" type="image\/svg\+xml" href="\/brand\/pagecraft-favicon\.svg"/);

  const logo = await request('/brand/pagecraft-logo.svg');
  a.equal(logo.status, 200);
  a.match(logo.headers.get('content-type') || '', /image\/svg\+xml/);
  const logoSvg = await logo.text();
  a.match(logoSvg, /Pagecraft primary logo for dark backgrounds/);
  a.match(logoSvg, /fill="#F8F6EF"/);

  const favicon = await request('/brand/pagecraft-favicon.svg');
  a.equal(favicon.status, 200);
  a.match(favicon.headers.get('content-type') || '', /image\/svg\+xml/);
  a.match(await favicon.text(), /Pagecraft favicon/);
});

test('privacy and terms are public on the editor host', async () => {
  const { request } = rig();
  const privacy = await request('/privacy');
  a.equal(privacy.status, 200);
  const privacyHtml = await privacy.text();
  a.match(privacyHtml, /Privacy Policy/);
  a.match(privacyHtml, /Braudy Pedrosa/);
  a.match(privacyHtml, /hello@braudyp\.dev/);
  a.match(privacyHtml, /Supabase/);

  const terms = await request('/terms');
  a.equal(terms.status, 200);
  const termsHtml = await terms.text();
  a.match(termsHtml, /Terms of Service/);
  a.match(termsHtml, /laws of the Philippines/);
});

test('Google sign in uses the Supabase PKCE callback and preserves only a safe local destination', async () => {
  const { request, accountAuth, auth } = rig();
  const start = await request('/auth/google', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ next: '/edit/site-1' })
  });
  a.equal(start.status, 303);
  a.equal(start.headers.get('location'), 'https://accounts.example.test/google');
  a.equal(accountAuth.oauthRedirectTo, 'http://admin.test/auth/confirm?next=%2Fedit%2Fsite-1');

  accountAuth.current = { authUserId: 'google-auth-1', email: 'google@example.test', name: 'Google Builder' };
  const callback = await request('/auth/confirm?code=valid&next=%2Fedit%2Fsite-1');
  a.equal(callback.status, 303);
  a.equal(callback.headers.get('location'), '/edit/site-1');
  a.ok(await auth.userByEmail('google@example.test'));

  const unsafe = await request('/auth/confirm?code=valid&next=https%3A%2F%2Fevil.test');
  a.equal(unsafe.headers.get('location'), '/');
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
