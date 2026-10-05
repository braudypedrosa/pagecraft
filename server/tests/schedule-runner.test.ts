import { afterAll, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { MemoryPublicationReviewStore } from '../src/reviews.ts';
import {
  FilePublicationScheduleStore,
  MemoryPublicationScheduleStore,
  SCHEDULE_CLAIM_LEASE_MS,
  scheduleRetryDelayMs,
  type PublicationScheduleStore,
} from '../src/schedules.ts';
import { runDueSchedules } from '../src/schedule-runner.ts';
import type { Doc } from '../../app/src/core/types.ts';

const doc = (): Doc => ({
  schemaVersion: 1,
  pages: [{ id: 'home', name: 'Home', slug: 'index', html: '', css: '' } as never],
  meta: { collections: [] },
} as unknown as Doc);
const file = (text: string) => ({ path: 'index.html', mediaType: 'text/html', bytes: new TextEncoder().encode(`<!doctype html><title>${text}</title>`) });
const t0 = new Date('2026-10-01T09:00:00.000Z');
const later = (ms: number) => new Date(t0.getTime() + ms);

/* A site that is live on version 1, with version 2 prepared as a snapshot and scheduled for t0,
   and the draft already moved on to version 3. */
async function rig(schedules: PublicationScheduleStore = new MemoryPublicationScheduleStore()) {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const publications = new MemoryHostedPublicationStore();
  const reviews = new MemoryPublicationReviewStore();
  const mailed: { to: string; subject: string }[] = [];
  const site = await store.create({ host: 'cabins.test', name: 'Cabins', slug: 'cabins', doc: doc() });
  const owner = await auth.createUser('owner@example.test', 'Owner');
  await auth.grant(site.id, owner.id, 'owner');

  const live = await publications.create({ siteId: site.id, slug: 'cabins', host: 'cabins.test', sourceVersion: 1, files: [file('v1')] });
  await store.publishHosted({ id: site.id, version: 1, publicationId: live.id, contentHash: live.contentHash, createdBy: owner.id, createdAt: live.createdAt });
  await publications.promote(live);
  await store.save(site.id, doc(), 1, owner.id);
  const snapshot = await publications.create({
    siteId: site.id, slug: 'cabins', host: 'cabins.test', sourceVersion: 2,
    source: { document: doc(), baselinePublicationId: live.id, warnings: [] }, files: [file('v2 reviewed')],
  });
  await store.save(site.id, doc(), 2, owner.id);
  const { schedule } = await schedules.create({
    siteId: site.id, snapshotId: snapshot.id, baselinePublicationId: live.id,
    publishAt: t0.toISOString(), createdBy: owner.id, idempotencyKey: `key-${randomUUID()}`,
  }, new Date(t0.getTime() - 60 * 60_000));
  const deps = {
    store, auth, publications, schedules, reviews, editorOrigin: 'https://admin.test',
    sendNotice: (to: string, subject: string) => { mailed.push({ to, subject }); },
  };
  return { store, auth, publications, schedules, reviews, mailed, site, owner, live, snapshot, schedule, deps };
}

test('a due schedule publishes exactly its snapshot, leaves the draft alone and tells the owner', async () => {
  const r = await rig();
  a.deepEqual(await runDueSchedules(r.deps, later(-1)), [], 'not due a millisecond early');

  const results = await runDueSchedules(r.deps, t0);
  a.deepEqual(results.map(x => x.status), ['published']);
  const site = await r.store.byId(r.site.id);
  a.equal(site?.publishedPublicationId, r.snapshot.id);
  a.equal(site?.publishedVersion, 2);
  a.equal(site?.version, 3);
  a.equal((await r.publications.currentBySlug('cabins'))?.id, r.snapshot.id, 'the public pointer moved');
  a.equal((await r.schedules.get(r.site.id, r.schedule.id))?.status, 'published');

  const [notice] = await r.reviews.notices(r.owner.id);
  a.equal(notice.kind, 'schedule_published');
  a.equal(notice.href, `https://admin.test/sites/${r.site.id}`);
  a.deepEqual(r.mailed, [{ to: 'owner@example.test', subject: 'Scheduled publish complete' }]);

  // Running again finds nothing to do.
  a.deepEqual(await runDueSchedules(r.deps, later(60_000)), []);
});

test('a manual publish in the meantime pauses the schedule instead of overwriting it', async () => {
  const r = await rig();
  const manual = await r.publications.create({ siteId: r.site.id, slug: 'cabins', host: 'cabins.test', sourceVersion: 3, files: [file('v3 by hand')] });
  await r.store.publishHosted({ id: r.site.id, version: 3, publicationId: manual.id, contentHash: manual.contentHash, createdBy: r.owner.id, createdAt: manual.createdAt });
  await r.publications.promote(manual);

  const results = await runDueSchedules(r.deps, t0);
  a.deepEqual(results, [{ id: r.schedule.id, siteId: r.site.id, status: 'paused', reason: 'baseline_superseded' }]);
  a.equal((await r.store.byId(r.site.id))?.publishedPublicationId, manual.id);
  a.equal((await r.publications.currentBySlug('cabins'))?.id, manual.id);
  const [notice] = await r.reviews.notices(r.owner.id);
  a.equal(notice.kind, 'schedule_paused');
  a.match(notice.body, /newer version was published/);
});

test('a creator who is no longer an owner cannot publish through an old schedule', async () => {
  const r = await rig();
  await r.auth.grant(r.site.id, r.owner.id, 'content');
  const results = await runDueSchedules(r.deps, t0);
  a.equal(results[0]?.reason, 'owner_removed');
  a.equal((await r.store.byId(r.site.id))?.publishedPublicationId, r.live.id);
});

test('a missing snapshot or a moved site pauses rather than guessing', async () => {
  const r = await rig();
  await r.publications.discard(r.snapshot);
  a.equal((await runDueSchedules(r.deps, t0))[0]?.reason, 'snapshot_unavailable');

  const moved = await rig();
  await moved.store.setSlug(moved.site.id, 'cabins-renamed');
  a.equal((await runDueSchedules(moved.deps, t0))[0]?.reason, 'site_address_changed');
  a.equal((await moved.store.byId(moved.site.id))?.publishedPublicationId, moved.live.id);
});

test('a failed promote retries after backoff and the replay completes without a second commit', async () => {
  const r = await rig();
  const promote = r.publications.promote.bind(r.publications);
  let failures = 1;
  r.publications.promote = async publication => {
    if (failures-- > 0) throw new Error('pointer volume unavailable');
    return promote(publication);
  };
  a.deepEqual((await runDueSchedules(r.deps, t0)).map(x => x.status), ['retry']);
  const pending = await r.schedules.get(r.site.id, r.schedule.id);
  a.equal(pending?.status, 'pending');
  a.equal(pending?.lastError, 'pointer volume unavailable');
  // The database already points at the snapshot; the public pointer does not yet.
  a.equal((await r.store.byId(r.site.id))?.publishedPublicationId, r.snapshot.id);
  a.equal((await r.publications.currentBySlug('cabins'))?.id, r.live.id);

  a.deepEqual(await runDueSchedules(r.deps, later(1_000)), [], 'backing off');
  const retried = await runDueSchedules(r.deps, later(scheduleRetryDelayMs(0)));
  a.deepEqual(retried.map(x => x.status), ['published']);
  a.equal((await r.publications.currentBySlug('cabins'))?.id, r.snapshot.id);
});

test('two runners at once publish once', async () => {
  const r = await rig();
  const [one, two] = await Promise.all([runDueSchedules(r.deps, t0, 'runner-a'), runDueSchedules(r.deps, t0, 'runner-b')]);
  a.equal(one.length + two.length, 1);
  a.equal((await r.reviews.notices(r.owner.id)).length, 1);
});

test('the runner reads the site past any cache, so a slug changed elsewhere pauses before the commit', async () => {
  const r = await rig();
  const cached = (await r.store.byId(r.site.id))!;
  // Another process moves the site; this process still holds the row it read earlier.
  await r.store.setSlug(r.site.id, 'cabins-moved');
  await r.publications.relocate(r.site.id, 'cabins-moved', 'cabins.test');
  const byId = r.store.byId.bind(r.store);
  r.store.byId = (async (id: string, options?: { fresh?: boolean }) =>
    options?.fresh ? byId(id) : structuredClone(cached)) as typeof r.store.byId;

  a.deepEqual((await runDueSchedules(r.deps, t0)).map(x => x.reason), ['site_address_changed']);
  a.equal((await byId(r.site.id))?.publishedPublicationId, r.live.id, 'nothing was committed');
  a.equal((await r.publications.currentBySlug('cabins-moved'))?.id, r.live.id);
  a.equal(await r.publications.currentBySlug('cabins'), null, 'the old address stays empty');
});

test('a site moved between the read and the commit is paused, not promoted at its old address', async () => {
  const r = await rig();
  const publishScheduled = r.store.publishScheduled.bind(r.store);
  r.store.publishScheduled = async input => {
    await r.store.setSlug(r.site.id, 'cabins-moved');
    return publishScheduled(input);
  };
  a.deepEqual((await runDueSchedules(r.deps, t0)).map(x => x.reason), ['site_address_changed']);
  a.equal((await r.publications.currentBySlug('cabins'))?.id, r.live.id, 'the snapshot was not promoted');
});

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
});
const scheduleStores: [string, () => Promise<PublicationScheduleStore>][] = [
  ['memory', async () => new MemoryPublicationScheduleStore()],
  ['file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pagecraft-runner-'));
    roots.push(root);
    return new FilePublicationScheduleStore(root);
  }],
];

for (const [kind, make] of scheduleStores) {
  test(`${kind}: a schedule cancelled after the due list was read is not published`, async () => {
    const r = await rig(await make());
    const due = r.schedules.due.bind(r.schedules);
    r.schedules.due = async (now, limit) => {
      const rows = await due(now, limit);
      a.equal((await r.schedules.cancel(r.site.id, r.schedule.id)).status, 'cancelled');
      return rows;
    };
    a.deepEqual(await runDueSchedules(r.deps, t0), []);
    a.equal((await r.schedules.get(r.site.id, r.schedule.id))?.status, 'cancelled');
    a.equal((await r.store.byId(r.site.id))?.publishedPublicationId, r.live.id);
    a.equal((await r.publications.currentBySlug('cabins'))?.id, r.live.id);
    a.deepEqual(await r.reviews.notices(r.owner.id), []);
    a.equal(await r.schedules.claim(r.schedule.id, 'next-runner'), true, 'the runner let go of its claim');
  });

  test(`${kind}: claims stay live through a batch that runs longer than the lease`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(t0);
      const r = await rig(await make());
      // Due first, for a site the creator does not own. Its run is the slow one.
      await r.schedules.create({
        siteId: 'slow-site', snapshotId: randomUUID(), baselinePublicationId: null,
        publishAt: later(-60_000).toISOString(), createdBy: r.owner.id, idempotencyKey: `key-${randomUUID()}`,
      }, later(-2 * 60 * 60_000));
      let stolen: boolean | undefined;
      const membership = r.auth.membership.bind(r.auth);
      r.auth.membership = async (siteId, userId) => {
        if (siteId === 'slow-site') vi.setSystemTime(Date.now() + SCHEDULE_CLAIM_LEASE_MS + 60_000);
        else stolen = await r.schedules.claim(r.schedule.id, 'other-runner', new Date());
        return membership(siteId, userId);
      };
      const results = await runDueSchedules(r.deps, new Date());
      a.deepEqual(results.map(x => x.status), ['paused', 'published']);
      a.equal(stolen, false, 'another runner cannot take over a claim made moments ago');
    } finally {
      vi.useRealTimers();
    }
  });
}
