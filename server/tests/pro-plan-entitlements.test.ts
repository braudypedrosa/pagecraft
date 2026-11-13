import { test } from 'vitest';
import a from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.ts';
import { MemoryAuthStore, type AccountPlan, type User } from '../src/auth.ts';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import { MemoryOwnedSiteStore, PgOwnedSiteStore } from '../src/accounts.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAssetStore, type Asset, type AssetQuota } from '../src/assets.ts';
import { PgAuthStore, PgStore, type Queryable } from '../src/store-pg.ts';
import { FREE_PLAN, PRO_PLAN } from '../src/plans.ts';
import { blankDoc } from '../src/render.ts';

// Fixtures model trusted database assignment. No production API can set this value.
class AssignedAuth extends MemoryAuthStore {
  assigned = new Map<string, AccountPlan>();
  private decorate(user: User | null) {
    return user ? { ...user, plan: this.assigned.get(user.id) || user.plan } : null;
  }
  async userById(id: string) { return this.decorate(await super.userById(id)); }
  async ensureAuthUser(id: string, email: string, name = '') {
    return this.decorate(await super.ensureAuthUser(id, email, name))!;
  }
}
class RecordingAssets extends MemoryAssetStore {
  lastQuota?: AssetQuota;
  async put(asset: Omit<Asset, 'id'> & { id?: string }, quota?: AssetQuota) {
    this.lastQuota = quota;
    return super.put(asset, quota);
  }
}
const unavailable = async (): Promise<never> => { throw new Error('Not used in quota tests'); };
async function rig(plan: AccountPlan) {
  const store = new MemoryStore(), auth = new AssignedAuth(), assets = new RecordingAssets();
  let identity: VerifiedIdentity = { authUserId: 'verified-owner', email: 'owner@example.test', name: 'Owner' };
  const owner = await auth.ensureAuthUser(identity.authUserId, identity.email, identity.name);
  auth.assigned.set(owner.id, plan);
  const accountAuth: AccountAuth = {
    identity: async () => identity, oauth: unavailable, signUp: unavailable, signIn: unavailable,
    confirm: unavailable, forgot: unavailable, reset: unavailable, updateEmail: unavailable,
    updatePassword: unavailable, signOut: unavailable,
  };
  const app = createApp({ store, auth, assets, accountAuth,
    ownedSites: new MemoryOwnedSiteStore(store, auth), editorHost: 'admin.test',
    editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>',
  });
  const request = (path: string, init: RequestInit = {}) => app.request(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', origin: 'http://admin.test', ...init.headers },
  }));
  const create = (name: string, extra: Record<string, unknown> = {}) => request('/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, doc: blankDoc(name), ...extra }),
  });
  return { auth, owner, assets, request, create, as: (next: VerifiedIdentity) => { identity = next; } };
}

test('assigned Pro creates six sites concurrently, survives profile edits, and reports 5 GB', async () => {
  const { request, create } = await rig('pro');
  const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => create(`Pro ${i}`)));
  a.deepEqual(responses.map(response => response.status), [201, 201, 201, 201, 201, 201]);
  const profile = await request('/account/profile', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'New name', email: 'owner@example.test', plan: 'free' }),
  });
  a.equal(profile.status, 303);
  const me = await (await request('/auth/me')).json();
  a.equal(me.user.plan, 'pro');
  a.equal(me.user.name, 'New name');
  a.equal(me.sites.length, 6);
  a.equal(me.storage.limitBytes, PRO_PLAN.storageBytes);
  a.equal((await (await request('/api/storage')).json()).limitBytes, PRO_PLAN.storageBytes);
  a.match(await (await request('/account?tab=plan')).text(), /Unlimited owned sites/);
});

test('Free cannot self-assign Pro through creation or editable profile fields', async () => {
  const { request, create } = await rig('free');
  for (let i = 0; i < 3; i++) a.equal((await create(`Free ${i}`, { plan: 'pro' })).status, 201);
  const blocked = await create('Fourth', { plan: 'pro', ownedSites: null });
  a.equal(blocked.status, 409);
  a.deepEqual(await blocked.json(), { error: 'site_limit_reached', limit: 3 });
  await request('/account/profile', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'Owner', email: 'owner@example.test', plan: 'pro' }),
  });
  const me = await (await request('/auth/me')).json();
  a.equal(me.user.plan, 'free');
  a.equal(me.storage.limitBytes, FREE_PLAN.storageBytes);
});

test('collaborator uploads use the site storage owner plan in both directions', async () => {
  for (const [ownerPlan, collaboratorPlan] of [['pro', 'free'], ['free', 'pro']] as const) {
    const { auth, owner, create, request, assets, as } = await rig(ownerPlan);
    const made = await (await create(`Owner ${ownerPlan}`)).json();
    const collaboratorIdentity = { authUserId: 'collaborator', email: 'collaborator@example.test', name: 'Collaborator' };
    const collaborator = await auth.ensureAuthUser(collaboratorIdentity.authUserId, collaboratorIdentity.email);
    auth.assigned.set(collaborator.id, collaboratorPlan);
    await auth.grant(made.id, collaborator.id, 'content');
    as(collaboratorIdentity);
    const form = new FormData();
    form.set('file', new File(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>'], 'quota.svg', { type: 'image/svg+xml' }));
    const uploaded = await request(`/api/sites/${made.id}/assets`, { method: 'POST', body: form });
    a.equal(uploaded.status, 201);
    a.equal(assets.lastQuota?.ownerId, owner.id);
    a.equal(assets.lastQuota?.limitBytes, ownerPlan === 'pro' ? PRO_PLAN.storageBytes : FREE_PLAN.storageBytes);
  }
});

test('Postgres resolves the assigned plan while preserving atomic Free creation limits', async () => {
  const db = await PGlite.create();
  try {
    const query = db as unknown as Queryable;
    const store = new PgStore(query), auth = new PgAuthStore(query), owned = new PgOwnedSiteStore(query);
    await store.init(); await auth.init();
    const owner = await auth.createUser('pg-pro@example.test', 'Pg Pro');
    for (let i = 0; i < 3; i++) a.equal((await owned.create({ ownerId: owner.id, host: `pg${i}.test`, name: `Pg ${i}`, doc: blankDoc(`Pg ${i}`) })).ok, true);
    a.deepEqual(await owned.create({ ownerId: owner.id, host: 'pg-blocked.test', name: 'Blocked', doc: blankDoc('Blocked') }), { ok: false, reason: 'site_limit_reached' });
    await db.query("update users set plan='pro' where id=$1", [owner.id]);
    a.equal((await owned.create({ ownerId: owner.id, host: 'pg-fourth.test', name: 'Fourth', doc: blankDoc('Fourth') })).ok, true);
    a.equal((await auth.updateProfile(owner.id, { name: 'Renamed' }))?.plan, 'pro');
    a.equal((await auth.ensureAuthUser('pg-auth', owner.email))?.plan, 'pro');
    a.equal((await auth.usersByIds([owner.id]))[0]?.plan, 'pro');
    a.equal(await owned.owned(owner.id), 4);
  } finally { await db.close(); }
});
