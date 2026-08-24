/* Who has access, and who may change that.

   Inviting is a grant rather than a token: creating an account for an address hands over
   nothing by itself, because signing in still needs a magic link delivered to that address.
   So there is no invite to expire or resend, and the cases worth testing are the refusals —
   who may not do this, and the one move that would leave a site nobody can manage. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, type Role } from '../src/auth.ts';
import type { Doc } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

const rig = async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_t, url) => { sent = url; }
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });

  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init,
      headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));

  /** sign in as an address that already has an account */
  const signIn = async (email: string) => {
    sent = '';
    await req('/auth/login', { method: 'POST', body: JSON.stringify({ email }) });
    const token = new URL(sent).searchParams.get('token')!;
    const cb = await req(`/auth/callback?token=${token}`);
    return (cb.headers.get('set-cookie') || '').split(';')[0];
  };
  const member = async (email: string, role: Role) => {
    const u = await auth.createUser(email);
    await auth.grant(site.id, u.id, role);
    return u;
  };
  const people = (cookie: string) => req(`/api/sites/${site.id}/people`, {}, cookie);
  const invite = (cookie: string, email: string, role?: string) =>
    req(`/api/sites/${site.id}/people`, { method: 'POST', body: JSON.stringify({ email, role }) }, cookie);
  const remove = (cookie: string, userId: string) =>
    req(`/api/sites/${site.id}/people/${userId}`, { method: 'DELETE' }, cookie);

  return { app, store, auth, site, req, signIn, member, people, invite, remove };
};

/* ------------------------------------------------------------------ the flow */

test('an owner invites an address, and that address can then sign in and edit', async () => {
  const { auth, site, signIn, member, invite } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  const cookie = await signIn(owner.email);

  const res = await invite(cookie, 'Client@Acme.TEST');
  a.equal(res.status, 201);
  const body = await res.json() as { userId: string; email: string; role: Role };
  a.equal(body.email, 'client@acme.test', 'normalised, or one person becomes two');
  a.equal(body.role, 'content', 'content unless an owner is asked for');

  /* the invitation is access, not a password: they sign in the ordinary way */
  const theirs = await signIn('client@acme.test');
  a.ok(theirs.startsWith('pc_session='));
  const m = await auth.membership(site.id, body.userId);
  a.equal(m!.role, 'content');
});

test('inviting somebody who already has an account changes their role', async () => {
  const { signIn, member, invite, people } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  const client = await member('client@acme.test', 'content');
  const cookie = await signIn(owner.email);

  a.equal((await invite(cookie, client.email, 'owner')).status, 201);
  const list = await (await people(cookie)).json() as { userId: string; role: Role }[];
  a.equal(list.find(p => p.userId === client.id)!.role, 'owner', 'granted again, not duplicated');
  a.equal(list.length, 2);
});

test('the list says who has access, in a readable order', async () => {
  const { signIn, member, people } = await rig();
  const owner = await member('zoe@acme.test', 'owner');
  await member('adam@acme.test', 'content');
  const cookie = await signIn(owner.email);

  const list = await (await people(cookie)).json() as { email: string; role: Role }[];
  a.deepEqual(list.map(p => p.email), ['adam@acme.test', 'zoe@acme.test']);
  a.deepEqual(list.map(p => p.role), ['content', 'owner']);
});

test('removing somebody removes their access on the next request', async () => {
  const { site, req, signIn, member, remove } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  const client = await member('client@acme.test', 'content');
  const ownerCookie = await signIn(owner.email);
  const clientCookie = await signIn(client.email);

  a.equal((await req(`/api/sites/${site.id}`, {}, clientCookie)).status, 200);
  a.equal((await remove(ownerCookie, client.id)).status, 200);
  /* their session is still valid and buys nothing: access is checked per request against the
     membership, so a membership that is gone is access that is gone */
  a.equal((await req(`/api/sites/${site.id}`, {}, clientCookie)).status, 404);
  a.equal((await req('/api/sites', {}, clientCookie)).status, 200, 'still signed in, with no sites');
  a.deepEqual(await (await req('/api/sites', {}, clientCookie)).json(), []);
});

test('removing somebody who has no access says so rather than pretending', async () => {
  const { signIn, member, remove } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  const cookie = await signIn(owner.email);
  const res = await remove(cookie, 'nobody');
  a.equal(res.status, 404);
});

/* ------------------------------------------------------------- the refusals */

test('a content account cannot see or change who has access', async () => {
  const { signIn, member, people, invite, remove } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  const client = await member('client@acme.test', 'content');
  const cookie = await signIn(client.email);

  a.equal((await people(cookie)).status, 403, 'the list of people is not content');
  a.equal((await invite(cookie, 'friend@acme.test')).status, 403);
  a.equal((await remove(cookie, owner.id)).status, 403, 'and certainly not removing the owner');
});

test('a stranger cannot tell whether the site exists', async () => {
  const { auth, signIn, people } = await rig();
  await auth.createUser('stranger@elsewhere.test');
  const cookie = await signIn('stranger@elsewhere.test');
  a.equal((await people(cookie)).status, 404, 'the same answer as a site that is not there');
});

test('nobody signed in gets nothing', async () => {
  const { people, invite } = await rig();
  a.equal((await people('')).status, 401);
  a.equal((await invite('', 'x@acme.test')).status, 401);
});

test('a malformed address is refused before an account is made', async () => {
  const { auth, signIn, member, invite } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  const cookie = await signIn(owner.email);
  a.equal((await invite(cookie, 'not-an-address')).status, 400);
  a.equal(await auth.userByEmail('not-an-address'), null);
});

/* ------------------------------------------------- the site that nobody owns */

test('the last owner cannot be removed, because nobody could manage the site after', async () => {
  const { signIn, member, remove, people } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  await member('client@acme.test', 'content');
  const cookie = await signIn(owner.email);

  const res = await remove(cookie, owner.id);
  a.equal(res.status, 409);
  a.match((await res.json() as { error: string }).error, /last owner/);
  a.equal((await (await people(cookie)).json() as unknown[]).length, 2, 'nothing changed');
});

test('a second owner makes the first removable', async () => {
  const { signIn, member, invite, remove, people } = await rig();
  const first = await member('first@acme.test', 'owner');
  const cookie = await signIn(first.email);
  const second = await (await invite(cookie, 'second@acme.test', 'owner')).json() as { userId: string };

  a.equal((await remove(cookie, first.id)).status, 200);
  const list = await (await people(await signIn('second@acme.test'))).json() as { userId: string }[];
  a.deepEqual(list.map(p => p.userId), [second.userId]);
});

test('an owner cannot demote themselves into locking the site', async () => {
  /* The same hole as removing the last owner, through the other door. */
  const { signIn, member, invite, people } = await rig();
  const owner = await member('owner@acme.test', 'owner');
  const cookie = await signIn(owner.email);

  const res = await invite(cookie, owner.email, 'content');
  a.equal(res.status, 409);
  a.match((await res.json() as { error: string }).error, /your own ownership/);
  const list = await (await people(cookie)).json() as { role: Role }[];
  a.deepEqual(list.map(p => p.role), ['owner'], 'still an owner');
});

test('another owner may demote you, which is the way that is meant to work', async () => {
  const { signIn, member, invite, people } = await rig();
  const one = await member('one@acme.test', 'owner');
  const two = await member('two@acme.test', 'owner');
  const cookie = await signIn(two.email);

  a.equal((await invite(cookie, one.email, 'content')).status, 201);
  const list = await (await people(cookie)).json() as { email: string; role: Role }[];
  a.equal(list.find(p => p.email === one.email)!.role, 'content');
});
