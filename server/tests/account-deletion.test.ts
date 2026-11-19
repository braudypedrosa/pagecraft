/* Self-serve account deletion (Account settings → Security → Delete account).

   Local fixtures only: in-memory stores and temporary directories. Nothing here talks to the
   shared Supabase project. */
import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Context } from 'hono';
import { PGlite } from '@electric-sql/pglite';
import * as Core from '../../app/src/core/index.ts';
import type { Doc } from '../../app/src/core/types.ts';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import { accountSettingsPage, type AccountDeletionView } from '../src/account-pages.ts';
import { createApp } from '../src/app.ts';
import { FileAssistantStore } from '../src/assistants.ts';
import { MemoryAuthStore, type User } from '../src/auth.ts';
import { MemoryLibraryStore } from '../src/libraries.ts';
import { MemoryOwnedSiteStore } from '../src/accounts.ts';
import { MemoryStore } from '../src/store.ts';
import { PgAuthStore, PgStore, type Queryable } from '../src/store-pg.ts';
import { FileSubmissionStore } from '../src/submissions.ts';
import { TestHumanChallenge } from '../src/turnstile.ts';
import { blankDoc } from '../src/render.ts';
import { FileAccountDeletionLog } from '../src/system-health.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
const scratch = async () => { const dir = await mkdtemp(join(tmpdir(), 'pagecraft-delete-')); roots.push(dir); return dir; };

const doc = (): Doc => {
  Core.seed();
  return structuredClone({ schemaVersion: Core.SCHEMA, meta: Core.state.meta, header: Core.state.header, footer: Core.state.footer, pages: Core.state.pages });
};

class FakeAuth implements AccountAuth {
  current: VerifiedIdentity | null = null;
  verified: { email: string; password: string; captchaToken: string }[] = [];
  signedOutEverywhere = 0;
  signedOut = 0;
  async identity(_c: Context) { return this.current; }
  async oauth() { return null; }
  async signUp() { return 'confirmation_required' as const; }
  async signIn() { return null; }
  async confirm() { return null; }
  async forgot() {}
  async reset() { return false; }
  async updateEmail() { return false; }
  async updatePassword() { return false; }
  async signOut() { this.signedOut++; this.current = null; }
  async signOutEverywhere() { this.signedOutEverywhere++; }
  async verifyPassword(_c: Context, input: { email: string; password: string; captchaToken: string }) {
    this.verified.push(input);
    if (input.captchaToken !== 'pagecraft-test-human') return 'challenge' as const;
    return input.password === 'correct horse battery';
  }
}

/** A gateway that predates `auth.accountDeletionCheck` rejects the unknown action. */
class OldGatewayAuth extends MemoryAuthStore {
  override async accountDeletionCheck(): Promise<never> { throw new Error('gateway 400: unknown op auth.accountDeletionCheck'); }
}
class PlanAuth extends MemoryAuthStore {
  plans = new Map<string, 'pro'>();
  private withPlan(user: User | null) { return user && this.plans.has(user.id) ? { ...user, plan: this.plans.get(user.id)! } : user; }
  override async userById(id: string) { return this.withPlan(await super.userById(id)); }
  override async userByAuthId(id: string) { return this.withPlan(await super.userByAuthId(id)); }
  override async ensureAuthUser(id: string, email: string, name = '') { return this.withPlan(await super.ensureAuthUser(id, email, name))!; }
}

const identity = (providers = ['email'], lastSignInAt?: string): VerifiedIdentity => ({
  authUserId: 'auth-leaver', email: 'leaver@example.test', name: 'Leaver', providers, ...(lastSignInAt ? { lastSignInAt } : {}),
});

async function rig(options: { auth?: MemoryAuthStore; connected?: unknown; providers?: string[]; lastSignInAt?: string } = {}) {
  const root = await scratch();
  const store = new MemoryStore();
  const auth = options.auth || new PlanAuth();
  auth.siteNames = async (ids) => new Map((await Promise.all(ids.map(id => store.byId(id)))).filter(Boolean).map(site => [site!.id, site!.name]));
  const accountAuth = new FakeAuth();
  const submissions = new FileSubmissionStore(join(root, 'submissions'));
  const assistants = new FileAssistantStore(join(root, 'assistants'));
  const libraries = new MemoryLibraryStore();
  const accountDeletions = new FileAccountDeletionLog(join(root, '.account-deletions'));
  const app = createApp({
    store, auth, accountAuth, ownedSites: new MemoryOwnedSiteStore(store, auth), challenge: new TestHumanChallenge(),
    turnstileSiteKey: 'test-site-key', editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>B</title>',
    submissions, assistants, libraries, accountDeletions,
    ...(options.connected ? { connected: options.connected as never } : {}),
  });
  const request = (path: string, init: RequestInit = {}) => app.request(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', origin: 'http://admin.test', ...(init.headers || {}) },
  }));
  const me = identity(options.providers, options.lastSignInAt);
  accountAuth.current = me;
  const user = await auth.ensureAuthUser(me.authUserId, me.email, me.name);
  const other = await auth.createUser('owner@example.test', 'Other owner');
  const make = async (name: string, ownerId: string) => {
    const site = await store.create({ host: `${name.toLowerCase().replace(/\W+/g, '-')}.invalid`, name, doc: doc(), savedBy: ownerId });
    await auth.grant(site.id, ownerId, 'owner');
    return site;
  };
  const del = (fields: Record<string, string>) => request('/account/delete', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields),
  });
  const valid = { confirmEmail: 'Leaver@Example.test', currentPassword: 'correct horse battery', 'cf-turnstile-response': 'pagecraft-test-human' };
  return { root, store, auth, accountAuth, submissions, assistants, libraries, accountDeletions, request, user, other, make, del, valid };
}

const html = async (res: Response) => res.text();

test('Security explains exactly what is deleted and kept and asks for the email and password', async () => {
  const r = await rig();
  await r.make('Studio Draft', r.user.id);
  const shared = await r.make('Client Site', r.other.id);
  await r.auth.grant(shared.id, r.user.id, 'content');
  const page = await html(await r.request('/account?tab=security'));
  a.match(page, /<h2>Delete account<\/h2>/);
  a.match(page, /This cannot be undone/);
  a.match(page, /The site you own, including drafts, revisions, uploaded media, hosted publications, form submissions, analytics, reviews and schedules:<ul class="pc-delete-sites"><li>Studio Draft<\/li><\/ul>/);
  a.match(page, /Assistant access tokens you created and integration connections on deleted sites/);
  a.match(page, /libraries you own and share, your library memberships, and invitations you sent or received/);
  a.match(page, /every signed-in session on all devices/);
  a.match(page, /The site you collaborate on stay|The site<\/?[^>]*>? you collaborate on stay|stay with their owners\. You are removed from it/);
  a.match(page, /<li>Client Site<\/li>/);
  a.match(page, /name="confirmEmail"[^>]*data-expected="leaver@example\.test"/);
  a.match(page, /Type <strong>leaver@example\.test<\/strong> to confirm/);
  a.match(page, /name="currentPassword" type="password" autocomplete="current-password" required/);
  a.match(page, /class="cf-turnstile" data-sitekey="test-site-key" data-action="login"/);
  a.match(page, /challenges\.cloudflare\.com\/turnstile/);
  a.match(page, /<button class="pc-btn pc-delete-account" type="submit" disabled data-account-delete-submit>Delete account permanently<\/button>/);
  a.match(page, /confirm\('Delete your Pagecraft account and everything it owns\? This cannot be undone\.'\)/);
});

test('deletion removes owned sites and their files, keeps collaborator sites, and ends every session', async () => {
  const r = await rig();
  const draft = await r.make('Studio Draft', r.user.id);
  const live = await r.make('Studio Live', r.user.id);
  const shared = await r.make('Client Site', r.other.id);
  await r.auth.grant(shared.id, r.user.id, 'content');
  await r.submissions.add(live.id, { id: '00000000-0000-4000-8000-000000000001', formId: 'f', formName: 'Contact', createdAt: new Date().toISOString(), status: 'success', values: [{ label: 'Email', value: 'visitor@example.test' }] });
  await r.assistants.createToken(live.id, 'Mine', r.user.id);
  const sharedToken = await r.assistants.createToken(shared.id, 'Leaver token', r.user.id);
  const othersToken = await r.assistants.createToken(shared.id, 'Owner token', r.other.id);
  const library = await r.libraries.create({ ownerId: r.other.id, name: 'Owner library' });
  await r.libraries.addMember({ libraryId: library.id, userId: r.user.id, invitedBy: r.other.id });
  const submissionsBefore = (await readdir(join(r.root, 'submissions'))).length;
  a.equal(submissionsBefore, 1);

  const res = await r.del(r.valid);
  a.equal(res.status, 303, await res.clone().text());
  a.equal(res.headers.get('location'), '/sign-in?message=Your+Pagecraft+account+was+deleted.');

  a.equal(await r.store.byId(draft.id), null, 'owned draft deleted');
  a.equal(await r.store.byId(live.id), null, 'owned published site deleted');
  a.deepEqual(await readdir(join(r.root, 'submissions')), [], 'form submissions removed');
  a.deepEqual(await r.assistants.tokens(live.id), [], 'tokens on deleted sites removed');
  a.ok(await r.store.byId(shared.id), 'collaborator site kept');
  a.equal(await r.auth.membership(shared.id, r.user.id), null, 'collaborator membership removed');
  a.equal((await r.auth.membership(shared.id, r.other.id))?.role, 'owner', 'the other owner is untouched');
  const tokens = await r.assistants.tokens(shared.id);
  a.ok(tokens.find(t => t.id === sharedToken.view.id)?.revokedAt, 'their token on a kept site is revoked');
  a.equal(tokens.find(t => t.id === othersToken.view.id)?.revokedAt, null, 'the owner\'s token is untouched');
  a.deepEqual((await r.libraries.members(library.id)).filter(m => m.userId === r.user.id), [], 'library membership removed');
  a.equal(await r.auth.userById(r.user.id), null, 'profile deleted');
  a.equal(await r.auth.userByEmail('leaver@example.test'), null);
  a.equal(r.accountAuth.signedOutEverywhere, 1);
  a.ok(r.accountAuth.signedOut >= 1);
  a.deepEqual(r.accountAuth.verified.map(v => [v.email, v.password]), [['leaver@example.test', 'correct horse battery']]);
  a.equal((await r.accountDeletions.list())[0]?.authUserId, 'auth-leaver', 'the Auth identity this store cannot remove is queued for an administrator');
  const after = await r.request('/account');
  a.equal(after.status, 302);
  a.match(after.headers.get('location') || '', /^\/sign-in/);
});

test('a wrong email, password or security check deletes nothing', async () => {
  const r = await rig();
  const site = await r.make('Keep Me', r.user.id);
  const cases: [Record<string, string>, string][] = [
    [{ ...r.valid, confirmEmail: 'someone@example.test' }, 'account_delete_email'],
    [{ ...r.valid, confirmEmail: '' }, 'account_delete_email'],
    [{ ...r.valid, currentPassword: 'wrong password!' }, 'account_delete_password'],
    [{ ...r.valid, currentPassword: '' }, 'account_delete_password'],
    [{ ...r.valid, 'cf-turnstile-response': '' }, 'challenge'],
  ];
  for (const [fields, error] of cases) {
    const res = await r.del(fields);
    a.equal(res.status, 303);
    a.equal(res.headers.get('location'), `/account?tab=security&error=${error}#delete-account`);
  }
  a.ok(await r.store.byId(site.id));
  a.ok(await r.auth.userById(r.user.id));
  a.equal(r.accountAuth.signedOutEverywhere, 0);
  a.match(await html(await r.request('/account?tab=security&error=account_delete_password')), /Your current password could not be verified\. Nothing was deleted\./);
});

test('sites shared with other owners and assigned plans block deletion with an explanation', async () => {
  const r = await rig();
  const shared = await r.make('Co-owned Studio', r.user.id);
  await r.auth.grant(shared.id, r.other.id, 'owner');
  const solo = await r.make('Solo Site', r.user.id);
  const page = await html(await r.request('/account?tab=security'));
  a.match(page, /data-account-delete-blocked/);
  a.match(page, /You own sites that also have other owners\. Remove yourself as an owner from each one/);
  a.match(page, /<li>Co-owned Studio<\/li>/);
  a.doesNotMatch(page, /<form[^>]*data-account-delete-form/, 'no form while blocked');
  const res = await r.del(r.valid);
  a.equal(res.headers.get('location'), '/account?tab=security&error=account_delete_blocked#delete-account');
  a.ok(await r.store.byId(shared.id));
  a.ok(await r.store.byId(solo.id), 'nothing is deleted when anything blocks');
  a.ok(await r.auth.userById(r.user.id));

  const p = await rig();
  (p.auth as PlanAuth).plans.set(p.user.id, 'pro');
  const proPage = await html(await p.request('/account?tab=security'));
  a.match(proPage, /Your account has the Pro plan\. Paid or assigned plans must be cancelled or removed first/);
  a.equal((await p.del(p.valid)).headers.get('location'), '/account?tab=security&error=account_delete_blocked#delete-account');
  a.ok(await p.auth.userById(p.user.id));
});

test('owned sites with signed WordPress releases block deletion before anything changes', async () => {
  const connected = { releasesForSite: async (id: string) => id === releasedId ? [{ id: 'release-1' }] : [] };
  let releasedId = '';
  const r = await rig({ connected });
  releasedId = (await r.make('Released Site', r.user.id)).id;
  const other = await r.make('Other Site', r.user.id);
  const page = await html(await r.request('/account?tab=security'));
  a.match(page, /These sites have signed WordPress releases, which are kept permanently/);
  a.match(page, /<li>Released Site<\/li>/);
  a.equal((await r.del(r.valid)).headers.get('location'), '/account?tab=security&error=account_delete_blocked#delete-account');
  a.ok(await r.store.byId(releasedId));
  a.ok(await r.store.byId(other.id));
});

test('a backing store that cannot delete profiles yet shows unavailable and deletes nothing', async () => {
  const r = await rig({ auth: new OldGatewayAuth() });
  const site = await r.make('Untouched', r.user.id);
  const page = await html(await r.request('/account?tab=security'));
  a.match(page, /data-account-delete-unavailable>Self-serve deletion is not available yet\. Nothing has been deleted\./);
  a.doesNotMatch(page, /<form[^>]*data-account-delete-form/);
  const res = await r.del(r.valid);
  a.equal(res.headers.get('location'), '/account?tab=security&error=account_delete_unavailable#delete-account');
  a.ok(await r.store.byId(site.id));
  a.ok(await r.auth.userById(r.user.id));
  a.equal(r.accountAuth.verified.length, 0, 'the password is not even checked');
});

test('Google-only accounts confirm with a sign-in from the last 15 minutes instead of a password', async () => {
  const stale = await rig({ providers: ['google'], lastSignInAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
  const site = await stale.make('Google Site', stale.user.id);
  const page = await html(await stale.request('/account?tab=security'));
  a.match(page, /data-account-delete-reauth>For your security, sign out and sign in with Google again/);
  a.match(page, /data-reauth-required/);
  a.doesNotMatch(page, /name="currentPassword"[^>]*>[\s\S]*Delete account permanently/);
  a.equal((await stale.del({ confirmEmail: 'leaver@example.test' })).headers.get('location'), '/account?tab=security&error=account_delete_reauth#delete-account');
  a.ok(await stale.store.byId(site.id));

  const fresh = await rig({ providers: ['google'], lastSignInAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() });
  const mine = await fresh.make('Google Site', fresh.user.id);
  const res = await fresh.del({ confirmEmail: 'leaver@example.test' });
  a.equal(res.headers.get('location'), '/sign-in?message=Your+Pagecraft+account+was+deleted.');
  a.equal(await fresh.store.byId(mine.id), null);
  a.equal(await fresh.auth.userById(fresh.user.id), null);
  a.equal(fresh.accountAuth.verified.length, 0);
});

test('deletion is rate limited and requires a signed-in session', async () => {
  const r = await rig();
  r.accountAuth.current = null;
  const anonymous = await r.del(r.valid);
  a.equal(anonymous.status, 303);
  a.match(anonymous.headers.get('location') || '', /^\/sign-in/);
  r.accountAuth.current = identity();
  let limited = '';
  for (let i = 0; i < 10; i++) limited = (await r.del({ ...r.valid, confirmEmail: 'nope@example.test' })).headers.get('location') || '';
  a.equal(limited, '/account?tab=security&error=password_rate#delete-account');
  a.ok(await r.auth.userById(r.user.id));
});

test('the page renders the deletion summary safely for long lists and hostile names', () => {
  const user = { id: 'u', email: 'a@example.test', name: 'A' } as unknown as User;
  const view: AccountDeletionView = {
    available: true, blockers: [], passwordRequired: true, freshSignInRequired: false,
    ownedSites: Array.from({ length: 15 }, (_, i) => `<img src=x onerror=alert(${i})>`), collaboratorSites: [],
    turnstileSiteKey: 'k',
  };
  const page = accountSettingsPage(user, { providers: ['email'], ownerCount: 15, storage: { usedBytes: 0, limitBytes: 1 }, deletion: view }, { tab: 'security' });
  a.doesNotMatch(page, /<img src=x/);
  a.match(page, /&lt;img src=x onerror=alert\(0\)&gt;/);
  a.match(page, /<li>and 3 more<\/li>/);
  a.match(page, /The 15 sites you own/);
  a.doesNotMatch(accountSettingsPage(user, { providers: ['email'], ownerCount: 0, storage: { usedBytes: 0, limitBytes: 1 } }, { tab: 'security' }), /Delete account/, 'hidden when not offered');
});

test('Postgres deletes the profile with its cascades only after owned sites are gone', async () => {
  const db = await PGlite.create();
  try {
    const q = db as unknown as Queryable;
    const sites = new PgStore(q), auth = new PgAuthStore(q);
    await sites.init(); await auth.init();
    const user = await auth.createUser('pg-leaver@example.test', 'Leaver');
    const other = await auth.createUser('pg-owner@example.test', 'Owner');
    const owned = await sites.create({ host: 'pg-owned.test', name: 'Owned', doc: blankDoc('Owned'), savedBy: user.id });
    await auth.grant(owned.id, user.id, 'owner');
    const kept = await sites.create({ host: 'pg-kept.test', name: 'Kept', doc: blankDoc('Kept'), savedBy: other.id });
    await auth.grant(kept.id, other.id, 'owner');
    await auth.grant(kept.id, user.id, 'content');
    await auth.putSession('digest-1', user.id, Date.now() + 60_000);

    a.deepEqual(await auth.accountDeletionCheck(user.id), { status: 'ok', ownedSites: 1 });
    a.deepEqual(await auth.deleteAccount(user.id), { status: 'owned_sites' }, 'owned sites must be deleted first');
    await auth.grant(owned.id, other.id, 'owner');
    a.deepEqual(await auth.deleteAccount(user.id), { status: 'shared_sites', sites: [{ id: owned.id, name: 'Owned' }] });
    await auth.revoke(owned.id, other.id);
    await db.query("update users set plan = 'pro' where id = $1", [user.id]);
    a.deepEqual(await auth.deleteAccount(user.id), { status: 'plan' });
    await db.query("update users set plan = 'free' where id = $1", [user.id]);

    a.equal(await sites.delete(owned.id), true);
    a.deepEqual(await auth.deleteAccount(user.id), { status: 'deleted', authUserDeleted: false });
    a.equal(await auth.userById(user.id), null);
    a.equal(await auth.sessionByDigest('digest-1'), null, 'sessions cascade');
    a.equal(await auth.membership(kept.id, user.id), null, 'memberships cascade');
    a.ok(await sites.byId(kept.id), 'the collaborator site stays');
    a.equal((await auth.membership(kept.id, other.id))?.role, 'owner');
    a.deepEqual(await auth.deleteAccount(user.id), { status: 'missing' });
  } finally { await db.close(); }
});

test('release checks run for every owned site at once, and never show when deletion is unavailable', async () => {
  let active = 0, peak = 0;
  const releasedIds = new Set<string>();
  const connected = { releasesForSite: async (id: string) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 20));
    active--;
    return releasedIds.has(id) ? [{ id: 'release-1' }] : [];
  } };
  const r = await rig({ connected });
  releasedIds.add((await r.make('Released One', r.user.id)).id);
  releasedIds.add((await r.make('Released Two', r.user.id)).id);
  const page = await html(await r.request('/account?tab=security'));
  a.match(page, /<li>Released One<\/li>/);
  a.match(page, /<li>Released Two<\/li>/);
  a.equal(peak, 2, 'the owned sites are checked together, not one after another');

  const old = await rig({ connected, auth: new OldGatewayAuth() });
  releasedIds.add((await old.make('Released Elsewhere', old.user.id)).id);
  const unavailable = await html(await old.request('/account?tab=security'));
  a.match(unavailable, /Self-serve deletion is not available yet/);
  a.doesNotMatch(unavailable, /signed WordPress releases/);
});
