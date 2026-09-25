import { afterEach, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { MemoryPublicationReviewStore } from '../src/reviews.ts';
import { MemoryPublicationScheduleStore } from '../src/schedules.ts';
import type { Doc } from '../../app/src/core/types.ts';

afterEach(() => { vi.useRealTimers(); });

const doc = (): Doc => ({
  schemaVersion: 1,
  pages: [{ id: 'home', name: 'Home', slug: 'index', html: '', css: '' } as never],
  meta: { collections: [] },
} as unknown as Doc);
const file = (text: string) => ({ path: 'index.html', mediaType: 'text/html', bytes: new TextEncoder().encode(`<!doctype html><title>${text}</title>`) });
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function rig({ warnings = [] as { code: string; message: string }[] } = {}) {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const publications = new MemoryHostedPublicationStore();
  const schedules = new MemoryPublicationScheduleStore();
  const reviews = new MemoryPublicationReviewStore();
  const site = await store.create({ host: 'cabins.test', name: 'Cabins', slug: 'cabins', doc: doc() });
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const editor = await auth.createUser('editor@example.test', 'Editor');
  await auth.grant(site.id, owner.id, 'owner');
  await auth.grant(site.id, editor.id, 'content');
  const live = await publications.create({ siteId: site.id, slug: 'cabins', host: 'cabins.test', sourceVersion: 1, files: [file('v1')] });
  await store.publishHosted({ id: site.id, version: 1, publicationId: live.id, contentHash: live.contentHash, createdBy: owner.id, createdAt: live.createdAt });
  await publications.promote(live);
  await store.save(site.id, doc(), 1, owner.id);
  const snapshot = await publications.create({
    siteId: site.id, slug: 'cabins', host: 'cabins.test', sourceVersion: 2,
    source: { document: doc(), baselinePublicationId: live.id, warnings }, files: [file('v2')],
  });
  const app = createApp({
    store, auth, publications, reviews, schedules, scheduleRunnerKey: 'cron-key-for-tests',
    editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>',
  });
  const cookieFor = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60 * 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookieFor(owner.id), editorCookie = await cookieFor(editor.id);
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init,
      headers: { host: 'admin.test', 'content-type': 'application/json', ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers || {}) },
    }));
  const schedule = (body: Record<string, unknown>, cookie = ownerCookie) =>
    call(`/api/sites/${site.id}/publication-schedules`, { method: 'POST', cookie, body: JSON.stringify(body) });
  return { store, publications, schedules, site, live, snapshot, call, schedule, ownerCookie, editorCookie };
}

test('an owner schedules a prepared snapshot once, and a repeat or a second schedule says so', async () => {
  const r = await rig();
  const body = { snapshotId: r.snapshot.id, publishAt: inMinutes(60), idempotencyKey: 'schedule-key-001' };
  const created = await r.schedule(body);
  a.equal(created.status, 201);
  const { schedule } = await created.json() as { schedule: { id: string; status: string; baselinePublicationId: string } };
  a.equal(schedule.status, 'pending');
  a.equal(schedule.baselinePublicationId, r.live.id);

  a.equal((await r.schedule(body)).status, 200, 'the same key is the same schedule');
  const second = await r.schedule({ ...body, idempotencyKey: 'schedule-key-002' });
  a.equal(second.status, 409);
  a.equal(((await second.json()) as { error: string }).error, 'schedule_exists');

  const listed = await (await r.call(`/api/sites/${r.site.id}/publication-schedules`, { cookie: r.ownerCookie })).json() as { schedules: { id: string }[] };
  a.deepEqual(listed.schedules.map(s => s.id), [schedule.id]);

  const cancelled = await r.call(`/api/sites/${r.site.id}/publication-schedules/${schedule.id}`, { method: 'DELETE', cookie: r.ownerCookie });
  a.equal(cancelled.status, 200);
  a.equal((await r.schedules.get(r.site.id, schedule.id))?.status, 'cancelled');
});

test('only owners schedule, and a session is required', async () => {
  const r = await rig();
  const body = { snapshotId: r.snapshot.id, publishAt: inMinutes(60), idempotencyKey: 'schedule-key-003' };
  a.equal((await r.schedule(body, r.editorCookie)).status, 403);
  a.equal((await r.schedule(body, '')).status, 401);
  a.equal((await r.call(`/api/sites/${r.site.id}/publication-schedules`, { cookie: r.editorCookie })).status, 403);
});

test('the time must be at least two minutes and at most ninety days away', async () => {
  const r = await rig();
  for (const publishAt of [inMinutes(1), inMinutes(91 * 24 * 60), 'next tuesday']) {
    const res = await r.schedule({ snapshotId: r.snapshot.id, publishAt, idempotencyKey: `key-${Math.random().toString(36).slice(2, 12)}` });
    a.equal(res.status, 400, publishAt);
  }
});

test('a snapshot already superseded by a newer publish cannot be scheduled', async () => {
  const r = await rig();
  const manual = await r.publications.create({ siteId: r.site.id, slug: 'cabins', host: 'cabins.test', sourceVersion: 2, files: [file('v2 by hand')] });
  await r.store.publishHosted({ id: r.site.id, version: 2, publicationId: manual.id, contentHash: manual.contentHash, createdBy: 'owner', createdAt: manual.createdAt });
  const res = await r.schedule({ snapshotId: r.snapshot.id, publishAt: inMinutes(60), idempotencyKey: 'schedule-key-004' });
  a.equal(res.status, 409);
  a.equal(((await res.json()) as { error: string }).error, 'stale_baseline');
});

test('warnings are acknowledged when scheduling, because nobody is present when it runs', async () => {
  const r = await rig({ warnings: [{ code: 'nested-link', message: 'A link contains another link.' }] });
  const body = { snapshotId: r.snapshot.id, publishAt: inMinutes(60), idempotencyKey: 'schedule-key-005' };
  const refused = await r.schedule(body);
  a.equal(refused.status, 409);
  a.equal(((await refused.json()) as { error: string }).error, 'publication_warnings');
  a.equal((await r.schedule({ ...body, acknowledgeWarnings: true })).status, 201);
});

test('the run endpoint exists only with the right key, and then publishes what is due', async () => {
  const r = await rig();
  await r.schedule({ snapshotId: r.snapshot.id, publishAt: inMinutes(5), idempotencyKey: 'schedule-key-006' });
  const run = (authorization?: string) => r.call('/api/internal/publication-schedules/run', { method: 'POST', headers: authorization ? { authorization } : {} });
  a.equal((await run()).status, 404);
  a.equal((await run('Bearer wrong-key')).status, 404);

  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + 6 * 60_000);
  const res = await run('Bearer cron-key-for-tests');
  a.equal(res.status, 200);
  const { results } = await res.json() as { results: { status: string }[] };
  a.deepEqual(results.map(x => x.status), ['published']);
  a.equal((await r.store.byId(r.site.id))?.publishedPublicationId, r.snapshot.id);
  a.equal((await r.publications.currentBySlug('cabins'))?.id, r.snapshot.id);
});
