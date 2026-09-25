/* Scheduled publication of an exact, already-prepared snapshot.

   Snapshot bytes live in each environment's publication root, so schedules live beside them
   rather than in the shared database: a staging schedule can only ever name staging bytes, and
   no migration is needed. A due schedule publishes only while the site's live publication is
   still the baseline its snapshot was prepared against. Anything newer pauses it for a person.

   Passenger may run several processes over one root, so the file store never rewrites a shared
   state file. Each schedule is its own file. A short per-site mutex makes "one pending schedule
   per site" a plain check-then-write, and an exclusive claim file gives each run one runner. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const SCHEDULE_PAUSE_REASONS = [
  'baseline_superseded',
  'owner_removed',
  'snapshot_unavailable',
  'site_address_changed',
] as const;
export type SchedulePauseReason = typeof SCHEDULE_PAUSE_REASONS[number];
export type ScheduleStatus = 'pending' | 'published' | 'paused' | 'cancelled';

export interface PublicationSchedule {
  id: string;
  siteId: string;
  snapshotId: string;
  baselinePublicationId: string | null;
  /** UTC ISO. The author picks it in local time; the server never guesses a zone. */
  publishAt: string;
  createdBy: string;
  createdAt: string;
  idempotencyKey: string;
  status: ScheduleStatus;
  pausedReason?: SchedulePauseReason;
  publicationId?: string;
  settledAt?: string;
  attempts: number;
  /** When a transient failure may be retried; equals publishAt until the first failure. */
  nextAttemptAt: string;
  lastError?: string;
}

export type ScheduleCreateInput = Pick<
  PublicationSchedule,
  'siteId' | 'snapshotId' | 'baselinePublicationId' | 'publishAt' | 'createdBy' | 'idempotencyKey'
>;

export type ScheduleCreateResult =
  | { status: 'created'; schedule: PublicationSchedule }
  /** The same idempotency key was already used for this site. */
  | { status: 'existing'; schedule: PublicationSchedule }
  /** Another schedule for this site is still pending. */
  | { status: 'conflict'; schedule: PublicationSchedule };

export type ScheduleOutcome =
  | { status: 'published'; publicationId: string }
  | { status: 'paused'; reason: SchedulePauseReason }
  /** Transient: the schedule stays pending and is retried after a backoff. */
  | { status: 'retry'; error: string };

export type ScheduleCancelResult =
  | { status: 'cancelled'; schedule: PublicationSchedule }
  /** A runner holds it right now; cancelling could race the publish. */
  | { status: 'busy' }
  | { status: 'missing' };

export interface PublicationScheduleStore {
  create(input: ScheduleCreateInput, now?: Date): Promise<ScheduleCreateResult>;
  get(siteId: string, id: string): Promise<PublicationSchedule | null>;
  /** Newest first. */
  forSite(siteId: string): Promise<PublicationSchedule[]>;
  cancel(siteId: string, id: string, now?: Date): Promise<ScheduleCancelResult>;
  /** Pending schedules whose next attempt is due, earliest first. */
  due(now: Date, limit?: number): Promise<PublicationSchedule[]>;
  /** Exclusive claim for one run. False when another runner holds a live claim. */
  claim(id: string, worker: string, now?: Date): Promise<boolean>;
  settle(id: string, worker: string, outcome: ScheduleOutcome, now?: Date): Promise<PublicationSchedule | null>;
}

/** A claim older than this belongs to a runner that died mid-run. */
export const SCHEDULE_CLAIM_LEASE_MS = 5 * 60_000;
/* Creating holds the site mutex for milliseconds, so one this old belongs to a dead process. */
const SITE_MUTEX_STALE_MS = 30_000;
const SITE_MUTEX_WAIT_MS = 2_000;
const ID = /^[0-9a-f-]{36}$/i;
const KEY = /^[A-Za-z0-9._:-]{8,160}$/;

export function validScheduleInput(input: ScheduleCreateInput) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.siteId) && ID.test(input.snapshotId)
    && (input.baselinePublicationId === null || ID.test(input.baselinePublicationId))
    && !Number.isNaN(Date.parse(input.publishAt)) && !!input.createdBy && KEY.test(input.idempotencyKey);
}

/** Exponential, capped at an hour: a schedule is late already, but not abandoned. */
export function scheduleRetryDelayMs(attempts: number) {
  return Math.min(60 * 60_000, 15_000 * 2 ** Math.min(attempts, 8));
}

function settled(row: PublicationSchedule, outcome: ScheduleOutcome, now: Date) {
  const next: PublicationSchedule = { ...row, attempts: row.attempts + 1 };
  if (outcome.status === 'retry') {
    next.lastError = outcome.error.slice(0, 2000);
    next.nextAttemptAt = new Date(now.getTime() + scheduleRetryDelayMs(row.attempts)).toISOString();
    return next;
  }
  next.status = outcome.status;
  next.settledAt = now.toISOString();
  delete next.lastError;
  if (outcome.status === 'published') next.publicationId = outcome.publicationId;
  else next.pausedReason = outcome.reason;
  return next;
}

function fresh(input: ScheduleCreateInput, now: Date): PublicationSchedule {
  return {
    ...input,
    id: randomUUID(),
    createdAt: now.toISOString(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: new Date(input.publishAt).toISOString(),
    publishAt: new Date(input.publishAt).toISOString(),
  };
}

const newestFirst = (a: PublicationSchedule, b: PublicationSchedule) => b.createdAt.localeCompare(a.createdAt);
const earliestDue = (a: PublicationSchedule, b: PublicationSchedule) =>
  a.nextAttemptAt.localeCompare(b.nextAttemptAt) || a.createdAt.localeCompare(b.createdAt);

export class MemoryPublicationScheduleStore implements PublicationScheduleStore {
  private rows = new Map<string, PublicationSchedule>();
  private claims = new Map<string, { worker: string; at: number }>();

  async create(input: ScheduleCreateInput, now = new Date()): Promise<ScheduleCreateResult> {
    if (!validScheduleInput(input)) throw new Error('invalid publication schedule');
    const rows = [...this.rows.values()].filter(row => row.siteId === input.siteId);
    const same = rows.find(row => row.idempotencyKey === input.idempotencyKey);
    if (same) return { status: 'existing', schedule: { ...same } };
    const pending = rows.find(row => row.status === 'pending');
    if (pending) return { status: 'conflict', schedule: { ...pending } };
    const schedule = fresh(input, now);
    this.rows.set(schedule.id, schedule);
    return { status: 'created', schedule: { ...schedule } };
  }
  async get(siteId: string, id: string) {
    const row = this.rows.get(id);
    return row && row.siteId === siteId ? { ...row } : null;
  }
  async forSite(siteId: string) {
    return [...this.rows.values()].filter(row => row.siteId === siteId).sort(newestFirst).map(row => ({ ...row }));
  }
  async cancel(siteId: string, id: string, now = new Date()): Promise<ScheduleCancelResult> {
    const row = this.rows.get(id);
    if (!row || row.siteId !== siteId || row.status !== 'pending') return { status: 'missing' };
    if (!(await this.claim(id, 'cancel', now))) return { status: 'busy' };
    const next = { ...row, status: 'cancelled' as const, settledAt: now.toISOString() };
    this.rows.set(id, next);
    this.claims.delete(id);
    return { status: 'cancelled', schedule: { ...next } };
  }
  async due(now: Date, limit = 10) {
    const at = now.toISOString();
    return [...this.rows.values()].filter(row => row.status === 'pending' && row.nextAttemptAt <= at)
      .sort(earliestDue).slice(0, limit).map(row => ({ ...row }));
  }
  async claim(id: string, worker: string, now = new Date()) {
    const held = this.claims.get(id);
    if (held && now.getTime() - held.at < SCHEDULE_CLAIM_LEASE_MS) return false;
    this.claims.set(id, { worker, at: now.getTime() });
    return true;
  }
  async settle(id: string, worker: string, outcome: ScheduleOutcome, now = new Date()) {
    const row = this.rows.get(id);
    if (!row || row.status !== 'pending' || this.claims.get(id)?.worker !== worker) return null;
    const next = settled(row, outcome, now);
    this.rows.set(id, next);
    this.claims.delete(id);
    return { ...next };
  }
}

const siteKey = (siteId: string) => createHash('sha256').update(siteId).digest('hex');

/** Durable schedules beside the publication bytes they name. */
export class FilePublicationScheduleStore implements PublicationScheduleStore {
  private readonly directory: string;

  constructor(root: string) {
    if (!root || !resolve(root).startsWith('/')) {
      throw new Error('schedule storage root must be an absolute path');
    }
    this.directory = join(resolve(root), '.schedules');
  }

  private rowPath(id: string) {
    if (!ID.test(id)) throw new Error('invalid schedule id');
    return join(this.directory, `${id}.json`);
  }
  private claimPath(id: string) {
    return join(this.directory, `${id}.claim`);
  }
  private mutexPath(siteId: string) {
    return join(this.directory, `site-${siteKey(siteId)}.lock`);
  }

  private async read(id: string): Promise<PublicationSchedule | null> {
    try {
      return JSON.parse(await readFile(this.rowPath(id), 'utf8')) as PublicationSchedule;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  private async write(row: PublicationSchedule) {
    await mkdir(this.directory, { recursive: true });
    const temporary = `${this.rowPath(row.id)}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(row, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, this.rowPath(row.id));
  }
  private async all(): Promise<PublicationSchedule[]> {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const rows = await Promise.all(names.filter(name => /^[0-9a-f-]{36}\.json$/i.test(name))
      .map(name => this.read(name.slice(0, -5))));
    return rows.filter((row): row is PublicationSchedule => !!row);
  }
  /** Create a lock file exclusively. The caller decides what an existing one means. */
  private async lock(path: string, body: string) {
    await mkdir(this.directory, { recursive: true });
    try {
      const handle = await open(path, 'wx');
      try {
        await handle.writeFile(body);
      } finally {
        await handle.close();
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
  }
  private async unlockIfOwned(path: string, body: string) {
    try {
      if ((await readFile(path, 'utf8')) === body) await rm(path, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  /* Wall-clock time, not the caller's `now`: staleness is about real processes dying. */
  private async withSiteMutex<T>(siteId: string, work: () => Promise<T>): Promise<T> {
    const path = this.mutexPath(siteId), token = randomUUID(), started = Date.now();
    while (!(await this.lock(path, token))) {
      const age = await stat(path).then(info => Date.now() - info.mtimeMs, () => 0);
      /* A takeover can in principle race another takeover. That needs a process to die inside a
         millisecond-long section and two creates for the same site in the next moment; the
         worst outcome is a second pending schedule, which then pauses as superseded. */
      if (age > SITE_MUTEX_STALE_MS) await rm(path, { force: true });
      else if (Date.now() - started > SITE_MUTEX_WAIT_MS) throw new Error('publication schedule lock is contended');
      else await new Promise(done => setTimeout(done, 20));
    }
    try {
      return await work();
    } finally {
      await this.unlockIfOwned(path, token);
    }
  }

  async create(input: ScheduleCreateInput, now = new Date()): Promise<ScheduleCreateResult> {
    if (!validScheduleInput(input)) throw new Error('invalid publication schedule');
    return this.withSiteMutex(input.siteId, async () => {
      const rows = (await this.all()).filter(row => row.siteId === input.siteId);
      const same = rows.find(row => row.idempotencyKey === input.idempotencyKey);
      if (same) return { status: 'existing', schedule: same };
      const pending = rows.find(row => row.status === 'pending');
      if (pending) return { status: 'conflict', schedule: pending };
      const schedule = fresh(input, now);
      await this.write(schedule);
      return { status: 'created', schedule };
    });
  }

  async get(siteId: string, id: string) {
    if (!ID.test(id)) return null;
    const row = await this.read(id);
    return row && row.siteId === siteId ? row : null;
  }

  async forSite(siteId: string) {
    return (await this.all()).filter(row => row.siteId === siteId).sort(newestFirst);
  }

  async cancel(siteId: string, id: string, now = new Date()): Promise<ScheduleCancelResult> {
    const row = await this.get(siteId, id);
    if (!row || row.status !== 'pending') return { status: 'missing' };
    const worker = `cancel-${randomUUID()}`;
    if (!(await this.claim(id, worker, now))) return { status: 'busy' };
    try {
      const current = await this.read(id);
      if (!current || current.status !== 'pending') return { status: 'missing' };
      const next: PublicationSchedule = { ...current, status: 'cancelled', settledAt: now.toISOString() };
      await this.write(next);
      return { status: 'cancelled', schedule: next };
    } finally {
      await this.release(id, worker);
    }
  }

  async due(now: Date, limit = 10) {
    const at = now.toISOString();
    return (await this.all()).filter(row => row.status === 'pending' && row.nextAttemptAt <= at)
      .sort(earliestDue).slice(0, limit);
  }

  async claim(id: string, worker: string, now = new Date()) {
    const path = this.claimPath(id);
    const body = JSON.stringify({ worker, at: now.getTime() });
    if (await this.lock(path, body)) return true;
    /* Take over a claim whose runner died. A rename would silently let two takers both
       win, so remove the stale file and race for a fresh exclusive create instead. */
    try {
      const held = JSON.parse(await readFile(path, 'utf8')) as { at?: number };
      const age = now.getTime() - Number(held.at || (await stat(path)).mtimeMs);
      if (age < SCHEDULE_CLAIM_LEASE_MS) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    await rm(path, { force: true });
    return this.lock(path, body);
  }

  private async release(id: string, worker: string) {
    try {
      const held = JSON.parse(await readFile(this.claimPath(id), 'utf8')) as { worker?: string };
      if (held.worker === worker) await rm(this.claimPath(id), { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
  }

  async settle(id: string, worker: string, outcome: ScheduleOutcome, now = new Date()) {
    try {
      const held = JSON.parse(await readFile(this.claimPath(id), 'utf8')) as { worker?: string };
      if (held.worker !== worker) return null;
    } catch {
      return null;
    }
    try {
      const row = await this.read(id);
      if (!row || row.status !== 'pending') return null;
      const next = settled(row, outcome, now);
      await this.write(next);
      return next;
    } finally {
      await this.release(id, worker);
    }
  }
}
