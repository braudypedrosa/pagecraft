import { afterAll, test } from 'vitest';
import a from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FilePublicationScheduleStore,
  MemoryPublicationScheduleStore,
  SCHEDULE_CLAIM_LEASE_MS,
  type PublicationScheduleStore,
  type ScheduleCreateInput,
} from '../src/schedules.ts';

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
});
const fileRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-schedules-'));
  roots.push(root);
  return root;
};

const t0 = new Date('2026-10-01T09:00:00.000Z');
const later = (ms: number) => new Date(t0.getTime() + ms);
const input = (overrides: Partial<ScheduleCreateInput> = {}): ScheduleCreateInput => ({
  siteId: 'site-1',
  snapshotId: randomUUID(),
  baselinePublicationId: randomUUID(),
  publishAt: later(60 * 60_000).toISOString(),
  createdBy: 'owner-1',
  idempotencyKey: `key-${randomUUID()}`,
  ...overrides,
});

const stores: [string, () => Promise<PublicationScheduleStore>][] = [
  ['memory', async () => new MemoryPublicationScheduleStore()],
  ['file', async () => new FilePublicationScheduleStore(await fileRoot())],
];

for (const [kind, make] of stores) {
  test(`${kind}: one pending schedule per site, and a repeated key returns the same schedule`, async () => {
    const store = await make();
    const first = await store.create(input({ idempotencyKey: 'same-key-001' }), t0);
    a.equal(first.status, 'created');
    a.equal(first.schedule.status, 'pending');
    a.equal(first.schedule.nextAttemptAt, first.schedule.publishAt);

    const repeat = await store.create(input({ idempotencyKey: 'same-key-001' }), t0);
    a.equal(repeat.status, 'existing');
    a.equal(repeat.schedule.id, first.schedule.id);

    const second = await store.create(input(), t0);
    a.equal(second.status, 'conflict');
    a.equal(second.schedule.id, first.schedule.id);

    // Other sites are unaffected.
    a.equal((await store.create(input({ siteId: 'site-2' }), t0)).status, 'created');
    a.equal((await store.forSite('site-1')).length, 1);
  });

  test(`${kind}: only due pending schedules are offered, earliest first`, async () => {
    const store = await make();
    const soon = await store.create(input({ siteId: 'a', publishAt: later(5 * 60_000).toISOString() }), t0);
    const sooner = await store.create(input({ siteId: 'b', publishAt: later(60_000).toISOString() }), t0);
    await store.create(input({ siteId: 'c', publishAt: later(60 * 60_000).toISOString() }), t0);

    a.deepEqual((await store.due(t0)).map(row => row.id), []);
    a.deepEqual((await store.due(later(10 * 60_000))).map(row => row.id), [sooner.schedule.id, soon.schedule.id]);
  });

  test(`${kind}: a claim is exclusive until settled, and settling frees the site for a new schedule`, async () => {
    const store = await make();
    const { schedule } = await store.create(input(), t0);
    a.equal(await store.claim(schedule.id, 'runner-a', t0), true);
    a.equal(await store.claim(schedule.id, 'runner-b', t0), false);
    // Only the claimant may settle.
    a.equal(await store.settle(schedule.id, 'runner-b', { status: 'published', publicationId: schedule.snapshotId }, t0), null);

    const done = await store.settle(schedule.id, 'runner-a', { status: 'published', publicationId: schedule.snapshotId }, t0);
    a.equal(done?.status, 'published');
    a.equal(done?.publicationId, schedule.snapshotId);
    a.deepEqual(await store.due(later(24 * 60 * 60_000)), []);
    // A settled schedule cannot be settled again, even by a new claimant.
    a.equal(await store.claim(schedule.id, 'runner-c', t0), true);
    a.equal(await store.settle(schedule.id, 'runner-c', { status: 'paused', reason: 'baseline_superseded' }, t0), null);

    a.equal((await store.create(input(), t0)).status, 'created');
  });

  test(`${kind}: a transient failure stays pending and backs off`, async () => {
    const store = await make();
    const { schedule } = await store.create(input({ publishAt: t0.toISOString() }), t0);
    await store.claim(schedule.id, 'runner-a', t0);
    const retry = await store.settle(schedule.id, 'runner-a', { status: 'retry', error: 'gateway timeout' }, t0);
    a.equal(retry?.status, 'pending');
    a.equal(retry?.attempts, 1);
    a.equal(retry?.lastError, 'gateway timeout');
    a.deepEqual(await store.due(later(5_000)), []);
    a.equal((await store.due(later(15_000)))[0]?.id, schedule.id);
    // The site still has its one pending schedule.
    a.equal((await store.create(input(), t0)).status, 'conflict');
  });

  test(`${kind}: a pause records its reason and never becomes due again`, async () => {
    const store = await make();
    const { schedule } = await store.create(input({ publishAt: t0.toISOString() }), t0);
    await store.claim(schedule.id, 'runner-a', t0);
    const paused = await store.settle(schedule.id, 'runner-a', { status: 'paused', reason: 'baseline_superseded' }, t0);
    a.equal(paused?.status, 'paused');
    a.equal(paused?.pausedReason, 'baseline_superseded');
    a.deepEqual(await store.due(later(24 * 60 * 60_000)), []);
  });

  test(`${kind}: cancel refuses while a runner holds the schedule`, async () => {
    const store = await make();
    const { schedule } = await store.create(input(), t0);
    await store.claim(schedule.id, 'runner-a', t0);
    a.equal((await store.cancel('site-1', schedule.id, t0)).status, 'busy');
    await store.settle(schedule.id, 'runner-a', { status: 'retry', error: 'x' }, t0);

    const cancelled = await store.cancel('site-1', schedule.id, t0);
    a.equal(cancelled.status, 'cancelled');
    a.equal((await store.cancel('site-1', schedule.id, t0)).status, 'missing');
    // Another site's id is never reachable through this site.
    a.equal((await store.cancel('site-2', schedule.id, t0)).status, 'missing');
    a.equal((await store.create(input(), t0)).status, 'created');
  });

  test(`${kind}: a claim abandoned past its lease can be taken over`, async () => {
    const store = await make();
    const { schedule } = await store.create(input(), t0);
    a.equal(await store.claim(schedule.id, 'dead-runner', t0), true);
    a.equal(await store.claim(schedule.id, 'runner-b', later(SCHEDULE_CLAIM_LEASE_MS - 1)), false);
    a.equal(await store.claim(schedule.id, 'runner-b', later(SCHEDULE_CLAIM_LEASE_MS + 1)), true);
    // The dead runner's late settle is ignored.
    a.equal(await store.settle(schedule.id, 'dead-runner', { status: 'published', publicationId: schedule.snapshotId }), null);
  });
}

/* Passenger may run several processes over one publication root. Two store instances on the
   same directory stand in for two processes: neither holds any state the other cannot see. */
test('file: invariants hold across processes sharing one root', async () => {
  const root = await fileRoot();
  const one = new FilePublicationScheduleStore(root);
  const two = new FilePublicationScheduleStore(root);

  const results = await Promise.all([one.create(input(), t0), two.create(input(), t0)]);
  a.deepEqual(results.map(result => result.status).sort(), ['conflict', 'created']);
  const created = results.find(result => result.status === 'created')!.schedule;

  const claims = await Promise.all([one.claim(created.id, 'p1', t0), two.claim(created.id, 'p2', t0)]);
  a.deepEqual(claims.sort(), [false, true]);
  a.equal((await two.get('site-1', created.id))?.id, created.id);
});

test('file: a site mutex left by a process that died mid-create is taken over', async () => {
  const root = await fileRoot();
  const store = new FilePublicationScheduleStore(root);
  await store.create(input({ siteId: 'warm-up' }), t0);
  const { createHash } = await import('node:crypto');
  const mutex = join(root, '.schedules', `site-${createHash('sha256').update('site-9').digest('hex')}.lock`);
  await writeFile(mutex, 'dead-process');
  const old = new Date(Date.now() - 60_000);
  await utimes(mutex, old, old);

  a.equal((await store.create(input({ siteId: 'site-9' }), t0)).status, 'created');
  // The mutex is released afterwards, so the next create answers immediately.
  a.equal((await store.create(input({ siteId: 'site-9' }), t0)).status, 'conflict');
  a.equal((await readdir(join(root, '.schedules'))).some(name => name.endsWith('.lock')), false);
});

test('file: ids from the outside cannot reach paths outside the schedule directory', async () => {
  const store = new FilePublicationScheduleStore(await fileRoot());
  a.equal(await store.get('site-1', '../../etc/passwd'), null);
  a.equal((await store.cancel('site-1', '../x')).status, 'missing');
  await a.rejects(store.create(input({ snapshotId: '../snapshot' })), /invalid publication schedule/);
});
