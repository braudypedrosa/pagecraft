import { test, expect } from 'vitest';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { LiveReviewStore, digest, secret } from '../src/live-reviews.ts';
import { blankDoc } from '../src/render.ts';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
async function setup() {
  const store = new MemoryStore(), auth = new MemoryAuthStore(), reviews = new LiveReviewStore();
  const site = await store.create({ host: 'site.test', name: 'Review QA', slug: 'review-qa', doc: blankDoc('Review QA') });
  const owner = await auth.createUser('owner@example.test'), reviewer = await auth.createUser('reviewer@example.test'), developer = await auth.createUser('developer@example.test'), other = await auth.createUser('other@example.test');
  for (const user of [owner, reviewer, developer]) await auth.grant(site.id, user.id, user === owner ? 'owner' : 'reviewer');
  await reviews.invite(site.id, reviewer.email, 'private'); await reviews.invite(site.id, developer.email, 'developer');
  const app = createApp({ store, auth, liveReviews: reviews, editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '' });
  const cookies = new Map<string,string>();
  for (const user of [owner, reviewer, developer, other]) { const token = newToken(); await auth.putSession(hashToken(token), user.id, Date.now() + 600000); cookies.set(user.id, 'pc_session=' + token); }
  const req = (path: string, cookie = '', body?: unknown, origin = 'http://admin.test') => app.request('http://admin.test' + path, { method: body === undefined ? 'GET' : 'POST', headers: { host: 'admin.test', cookie, origin, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { store, site, reviews, owner, reviewer, developer, other, cookies, req, app };
}
const pin = { page: 'index.html', device: 'desktop', x: .5, y: 120, nodeId: '', nodeX: 0, nodeY: 0, body: 'Fix spacing' };
test('live links enforce identity, invitation scope, guest boundaries, device threads and developer resolution', async () => {
  const s = await setup();
  const pub = await s.reviews.createLink(s.site.id, 'public'), priv = await s.reviews.createLink(s.site.id, 'private'), dev = await s.reviews.createLink(s.site.id, 'developer');
  const path = '/review/' + pub.token;
  expect((await s.req(path + '/state')).status).toBe(403);
  const guest = await s.reviews.addGuest(s.site.id, 'Guest Reviewer');
  const cookie = 'pc_review_guest_' + s.site.id + '=' + guest;
  expect((await s.req(path + '/state', cookie)).status).toBe(200);
  expect((await s.req('/review/' + priv.token + '/state', cookie)).status).toBe(403);
  expect((await s.req('/review/' + priv.token + '/state', s.cookies.get(s.other.id))).status).toBe(403);
  expect((await s.req('/review/' + dev.token + '/state', s.cookies.get(s.reviewer.id))).status).toBe(403);
  const created = await s.req(path + '/pin', cookie, pin); expect(created.status).toBe(201); const row = await created.json();
  expect((await s.req(path + '/pin', cookie, { ...pin, device: 'mobile' })).status).toBe(201);
  expect((await s.req(path + '/pin', cookie, { ...pin, x: 9 })).status).toBe(400);
  expect((await s.req(path + '/pin', cookie, pin, 'https://evil.test')).status).toBe(403);
  expect((await s.req(path + '/resolve', cookie, { pinId: row.id, done: true })).status).toBe(403);
  expect((await s.req('/review/' + priv.token + '/reply', s.cookies.get(s.reviewer.id), { pinId: row.id, body: 'Confirmed' })).status).toBe(200);
  expect((await s.req('/review/' + dev.token + '/resolve', s.cookies.get(s.developer.id), { pinId: row.id, done: true })).status).toBe(200);
  expect((await s.reviews.pins(s.site.id))[0].done).toBe(true);
  expect((await s.req('/review/' + dev.token + '/resolve', s.cookies.get(s.developer.id), { pinId: row.id, done: false })).status).toBe(200);
  expect((await s.reviews.pins(s.site.id)).map(p => p.device)).toEqual(['desktop', 'mobile']);
  const preview = await s.req(path + '/preview', cookie); expect(preview.status).toBe(200); expect((await preview.json()).html).toContain('reviewChannel');
  expect((await s.req('/sites/' + s.site.id + '/reviews', s.cookies.get(s.developer.id))).status).toBe(200);
  const hub = await (await s.req('/sites/' + s.site.id + '/reviews', s.cookies.get(s.owner.id))).text();
  expect(hub).toContain('pc-sub-table');
  expect(hub).toContain('Create a review link');
  expect(hub).toContain('pc-forms-table');
  expect(hub).toContain('/review/' + pub.token);
  await s.reviews.removeInvite(s.site.id, s.developer.email);
  expect((await s.req('/review/' + dev.token + '/state', s.cookies.get(s.developer.id))).status).toBe(403);
  await s.reviews.revoke(s.site.id, pub.id);
  expect((await s.req(path + '/state', cookie)).status).toBe(403);
});
test('review data survives restart and concurrent writes without losing pins', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'live-review-'));
  try {
    const file = join(dir, 'reviews.json'), store = new LiveReviewStore(file);
    const link = await store.createLink('site', 'public');
    await Promise.all(Array.from({ length: 12 }, (_, i) => store.addPin({ ...pin, device: 'desktop', siteId: 'site', author: { id: 'a', name: 'A' }, body: 'Comment ' + i })));
    const restored = new LiveReviewStore(file);
    expect(await restored.link(link.token)).toEqual(link); expect(await restored.pins('site')).toHaveLength(12);
  } finally { await rm(dir, { recursive: true }); }
});
test('live previews follow saved versions and keep pins; foreign-site pins and removed members fail closed', async () => {
  const s = await setup(), link = await s.reviews.createLink(s.site.id, 'private');
  const path = '/review/' + link.token, cookie = s.cookies.get(s.reviewer.id)!;
  const row = await (await s.req(path + '/pin', cookie, pin)).json();
  const before = await (await s.req(path + '/preview', cookie)).json();
  await s.store.save(s.site.id, blankDoc('Updated review site'), s.site.version, s.owner.id);
  const after = await (await s.req(path + '/preview', cookie)).json();
  expect(after.version).toBe(before.version + 1);
  expect(after.html).toContain('Updated review site');
  expect((await s.reviews.pins(s.site.id))[0].id).toBe(row.id);
  const second = await s.reviews.createLink('not-this-site', 'public');
  expect((await s.req('/review/' + second.token + '/reply', cookie, {pinId:row.id,body:'Wrong site'})).status).toBe(403);
  expect((await s.req(path + '/pin', cookie, {...pin,page:'../../index.html'})).status).toBe(400);
});
test('owner invitations give reviewer membership and developer resolution without ownership', async () => {
  const s = await setup(), link = await s.reviews.createLink(s.site.id, 'private');
  const path = '/review/' + link.token;
  const send = (cookie: string, email: string) => s.app.request('http://admin.test' + path + '/invite', { method:'POST',headers:{host:'admin.test',origin:'http://admin.test',cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,kind:'developer'}) });
  expect((await send(s.cookies.get(s.reviewer.id)!, 'new@example.test')).status).toBe(403);
  expect((await send(s.cookies.get(s.owner.id)!, 'new@example.test')).status).toBe(303);
  expect((await s.reviews.invitations(s.site.id)).some(i=>i.email==='new@example.test'&&i.kind==='developer')).toBe(true);
  expect((await s.reviews.links(s.site.id)).some(l=>l.access==='developer')).toBe(true);
});

test('editor destination is exposed only to existing site editors', async () => {
  const s = await setup();
  const link = await s.reviews.createLink(s.site.id, 'developer');
  const path = '/review/' + link.token;
  const ownerHtml = await (await s.req(path, s.cookies.get(s.owner.id))).text();
  const developerHtml = await (await s.req(path, s.cookies.get(s.developer.id))).text();
  expect(ownerHtml).toContain('"editorUrl":"/edit/' + s.site.id + '"');
  expect(developerHtml).toContain('"editorUrl":null');
});

test('owners, reviewers and developers can annotate; only owners and developers can mark fixed', async () => {
  const s = await setup();
  const link = await s.reviews.createLink(s.site.id, 'public');
  const path = '/review/' + link.token;
  for (const user of [s.owner, s.reviewer, s.developer]) {
    const cookie = s.cookies.get(user.id);
    const response = await s.req(path + '/pin', cookie, pin);
    expect(response.status).toBe(201);
    const created = await response.json();
    expect((await s.req(path + '/resolve', cookie, {pinId:created.id,done:true})).status).toBe(user === s.reviewer ? 403 : 200);
  }
});

const author = (name: string) => ({ id: name, name });
const sitePin = { ...pin, device: 'desktop' as const, siteId: 'site', author: author('A') };

test('a link revoked in one process is refused by the others, and their later writes do not restore it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'live-review-'));
  try {
    const file = join(dir, 'reviews.json'), one = new LiveReviewStore(file), two = new LiveReviewStore(file);
    const link = await one.createLink('site', 'public');
    expect(await two.link(link.token)).toEqual(link);
    await one.revoke('site', link.id);
    expect(await two.link(link.token)).toBeNull();
    // The other process keeps writing; none of it brings the link back.
    await two.addPin(sitePin); await two.createLink('site', 'private'); await two.invite('site', 'r@example.test', 'private');
    expect(await one.link(link.token)).toBeNull();
    expect((await new LiveReviewStore(file).links('site')).find(l => l.id === link.id)?.active).toBe(false);

    // Replies to one pin from two processes at once both land, and resolving keeps them.
    const row = await one.addPin(sitePin);
    await Promise.all([one.reply('site', row.id, author('A'), 'From one'), two.reply('site', row.id, author('B'), 'From two')]);
    await two.resolve('site', row.id, author('B'), true);
    const stored = (await one.pins('site')).find(p => p.id === row.id)!;
    expect(stored.replies.map(r => r.body).sort()).toEqual(['From one', 'From two']);
    expect(stored).toMatchObject({ done: true, resolvedBy: author('B') });
    await expect(one.reply('other-site', row.id, author('A'), 'Wrong site')).rejects.toThrow('missing_pin');

    await one.invite('site', 'dev@example.test', 'developer');
    expect(await two.invited('site', 'dev@example.test', 'developer')).toBe(true);
    expect(await two.invited('site', 'dev@example.test', 'private')).toBe(false);
    await two.removeInvite('site', 'dev@example.test');
    expect(await one.invited('site', 'dev@example.test')).toBe(false);
    const guest = await one.addGuest('site', 'Guest');
    expect(await two.guest('site', guest)).toEqual({ id: 'guest:' + digest(guest), name: 'Guest' });
    expect(await two.guest('other-site', guest)).toBeNull();
  } finally { await rm(dir, { recursive: true }); }
});

test('the old live-review file is split into records on first use, and a revocation it holds wins', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'live-review-'));
  try {
    const file = join(dir, 'reviews.json'), guestToken = secret();
    const link = (access: 'public' | 'private', active: boolean) => ({ id: randomUUID(), siteId: 'site', token: secret(), access, active, createdAt: '2026-09-01T00:00:00.000Z' });
    const live = link('public', true), revoked = link('private', false);
    const reply = (body: string, createdAt: string) => ({ id: randomUUID(), author: author('A'), body, createdAt });
    const legacy = {
      links: [live, revoked],
      pins: [{ ...sitePin, id: randomUUID(), createdAt: '2026-09-01T00:01:00.000Z', done: false, replies: [reply('First', '2026-09-01T00:02:00.000Z'), reply('Second', '2026-09-01T00:03:00.000Z')] }],
      invites: [{ siteId: 'site', email: 'r@example.test', kind: 'private' }],
      guests: [{ digest: digest(guestToken), siteId: 'site', name: 'Guest', expires: Date.now() + 60_000 }, { digest: digest(secret()), siteId: 'site', name: 'Gone', expires: Date.now() - 1 }],
    };
    await writeFile(file, JSON.stringify(legacy));
    const one = new LiveReviewStore(file), two = new LiveReviewStore(file);
    const [links, pins] = await Promise.all([one.links('site'), two.pins('site')]);
    expect(links).toHaveLength(2);
    expect(pins).toEqual(legacy.pins);
    expect(await one.link(live.token)).toEqual(live);
    expect(await one.link(revoked.token)).toBeNull();
    expect(await two.invited('site', 'r@example.test', 'private')).toBe(true);
    expect(await two.guest('site', guestToken)).toMatchObject({ name: 'Guest' });
    await expect(stat(file)).rejects.toThrow(/ENOENT/);
    expect(JSON.parse(await readFile(file + '.migrated', 'utf8'))).toEqual(legacy);

    // A process still on the old code revokes the live link and writes the file again.
    await writeFile(file, JSON.stringify({ ...legacy, links: [{ ...live, active: false }, revoked] }));
    expect(await new LiveReviewStore(file).link(live.token)).toBeNull();
  } finally { await rm(dir, { recursive: true }); }
});
