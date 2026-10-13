import { afterEach, expect, test } from 'vitest';
import { fork } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilePublicationScheduleStore, SCHEDULE_CLAIM_LEASE_MS } from '../src/schedules.ts';

const children: ReturnType<typeof fork>[] = [], roots: string[] = [];
afterEach(async () => {
  await Promise.all(children.splice(0).map(child => new Promise<void>(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    child.once('exit', () => resolve()); child.kill();
  })));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-schedule-contention-'));
  roots.push(root);
  const store = new FilePublicationScheduleStore(root), now = new Date();
  const { schedule } = await store.create({
    siteId: 'contention-site', snapshotId: randomUUID(), baselinePublicationId: null,
    publishAt: now.toISOString(), createdBy: 'fixture-owner', idempotencyKey: randomUUID(),
  }, now);
  return { root, store, schedule, now };
};
function claimant(root: string, id: string, name: string, now: Date, pause = '') {
  const child = fork(new URL('./fixtures/schedule-contention-worker.mjs', import.meta.url),
    [root, id, name, now.toISOString(), pause], { execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  children.push(child);
  let stderr = '';
  child.stderr?.on('data', data => { stderr += String(data); });
  const received: { type: string; won?: boolean; settled?: boolean; status?: string; message?: string }[] = [];
  const waiters = new Set<() => void>();
  child.on('message', message => { received.push(message as typeof received[number]); waiters.forEach(check => check()); });
  child.on('exit', () => waiters.forEach(check => check()));
  const wait = (type: string) => new Promise<typeof received[number]>((resolve, reject) => {
    const deadline = setTimeout(() => { waiters.delete(check); reject(new Error(`Worker ${name} did not report ${type}: ${stderr}`)); }, 8000);
    const check = () => {
      const result = received.find(message => message.type === type || message.type === 'error');
      if (result) {
        clearTimeout(deadline); waiters.delete(check);
        if (result.type === 'error') reject(new Error(result.message)); else resolve(result);
      } else if (child.exitCode !== null || child.signalCode !== null) {
        clearTimeout(deadline); waiters.delete(check); reject(new Error(`Worker ${name} exited: ${stderr}`));
      }
    };
    waiters.add(check); check();
  });
  return { child, wait };
}

test('real processes cannot both claim while one payload write is suspended', async () => {
  const f = await createFixture();
  const one = claimant(f.root, f.schedule.id, 'process-one', f.now, 'write');
  await one.wait('ready'); one.child.send('claim');
  await one.wait('writing');
  const second = await new FilePublicationScheduleStore(f.root).claim(f.schedule.id, 'process-two', f.now);
  one.child.send('continue');
  const first = (await one.wait('result')).won;
  expect([first, second].sort()).toEqual([false, true]);
});

test('real processes racing an expired lease elect only one successor', async () => {
  const f = await createFixture();
  await writeFile(join(f.root, '.schedules', f.schedule.id + '.claim'),
    JSON.stringify({ worker: 'dead-process', at: f.now.getTime() - SCHEDULE_CLAIM_LEASE_MS - 1 }));
  const runners = Array.from({ length: 8 }, (_, index) => claimant(f.root, f.schedule.id, 'successor-' + index, f.now));
  await Promise.all(runners.map(runner => runner.wait('ready')));
  runners.forEach(runner => runner.child.send('claim'));
  const results = await Promise.all(runners.map(runner => runner.wait('result')));
  expect(results.filter(result => result.won)).toHaveLength(1);
});

test('a paused old settler cannot write after another process takes the expired claim', async () => {
  const f = await createFixture();
  expect(await f.store.claim(f.schedule.id, 'old-settler', f.now)).toBe(true);
  const settler = claimant(f.root, f.schedule.id, 'old-settler', f.now, 'write');
  await settler.wait('ready'); settler.child.send('settle');
  await settler.wait('writing');
  const newer = new Date(f.now.getTime() + SCHEDULE_CLAIM_LEASE_MS + 1);
  const other = new FilePublicationScheduleStore(f.root);
  expect(await other.claim(f.schedule.id, 'successor', newer)).toBe(true);
  settler.child.send('continue');
  expect((await settler.wait('result')).settled).toBe(false);
  expect((await f.store.get(f.schedule.siteId, f.schedule.id))?.attempts).toBe(0);
  expect(await f.store.claim(f.schedule.id, 'wrong-run', newer)).toBe(false);
});

test('real processes recovering one stale site mutex create only one pending schedule', async () => {
  const f = await createFixture(), siteId = 'stale-site';
  const base = join(f.root, '.schedules', 'site-' + createHash('sha256').update(siteId).digest('hex') + '.lock');
  await writeFile(base, 'legacy-dead-process');
  const expired = new Date(Date.now() - 60_000);
  await utimes(base, expired, expired);
  const runners = Array.from({ length: 8 }, (_, index) => claimant(f.root, siteId, 'site-creator-' + index, f.now));
  await Promise.all(runners.map(runner => runner.wait('ready')));
  runners.forEach(runner => runner.child.send('create'));
  const results = await Promise.all(runners.map(runner => runner.wait('result')));
  expect(results.filter(result => result.status === 'created')).toHaveLength(1);
  expect(results.filter(result => result.status === 'conflict')).toHaveLength(7);
  expect(await f.store.forSite(siteId)).toHaveLength(1);
});

test('fresh incomplete legacy claims remain held and old owners cannot release or settle a successor', async () => {
  const f = await createFixture(), other = new FilePublicationScheduleStore(f.root);
  const base = join(f.root, '.schedules', f.schedule.id + '.claim');
  await writeFile(base, '');
  expect(await f.store.claim(f.schedule.id, 'premature-taker', f.now)).toBe(false);
  expect(await readFile(base, 'utf8')).toBe('');
  const takeover = new Date(Date.now() + SCHEDULE_CLAIM_LEASE_MS + 1000);
  expect(await f.store.claim(f.schedule.id, 'first-owner', takeover)).toBe(true);
  const newer = new Date(takeover.getTime() + SCHEDULE_CLAIM_LEASE_MS + 1);
  expect(await other.claim(f.schedule.id, 'successor', newer)).toBe(true);
  await f.store.release(f.schedule.id, 'first-owner');
  expect(await f.store.claim(f.schedule.id, 'late-taker', newer)).toBe(false);
  expect(await f.store.settle(f.schedule.id, 'first-owner', { status: 'published', publicationId: f.schedule.snapshotId }, newer)).toBeNull();
  expect((await other.settle(f.schedule.id, 'successor', { status: 'retry', error: 'fixture retry' }, newer))?.attempts).toBe(1);
  expect(await f.store.claim(f.schedule.id, 'new-run', newer)).toBe(true);
  await other.release(f.schedule.id, 'successor');
  expect(await other.claim(f.schedule.id, 'wrong-run', newer)).toBe(false);
});

test('duplicate settlements write only once and site removal cleans retained generations', async () => {
  const f = await createFixture(), other = new FilePublicationScheduleStore(f.root);
  expect(await f.store.claim(f.schedule.id, 'owner', f.now)).toBe(true);
  const results = await Promise.all([
    f.store.settle(f.schedule.id, 'owner', { status: 'published', publicationId: f.schedule.snapshotId }, f.now),
    other.settle(f.schedule.id, 'owner', { status: 'retry', error: 'duplicate' }, f.now),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await f.store.get(f.schedule.siteId, f.schedule.id))?.attempts).toBe(1);
  await f.store.removeSite(f.schedule.siteId);
  expect(await readdir(join(f.root, '.schedules'))).toEqual([]);
});
