/* Runs the publication schedules that have come due.

   Every step is safe to repeat, so any trigger may call this: a timer, a protected endpoint hit
   by cron, or both at once. A schedule is claimed before it runs, the database commit applies
   only while the snapshot's baseline is still live (store.publishScheduled), and a replay of an
   already-applied schedule succeeds without changing anything. Anything that would publish
   something other than exactly what was scheduled pauses the schedule for a person instead. */
import { randomUUID } from 'node:crypto';
import type { AuthStore } from './auth.ts';
import type { NoticeSender } from './mail.ts';
import type { HostedPublicationStore } from './publications.ts';
import type { PublicationReviewStore } from './reviews.ts';
import type {
  PublicationSchedule,
  PublicationScheduleStore,
  SchedulePauseReason,
  ScheduleOutcome,
} from './schedules.ts';
import type { Store } from './store.ts';

export interface ScheduleRunnerDeps {
  store: Store;
  publications: HostedPublicationStore;
  schedules: PublicationScheduleStore;
  auth: Pick<AuthStore, 'membership' | 'userById'>;
  reviews?: PublicationReviewStore;
  sendNotice?: NoticeSender;
  editorOrigin?: string;
}

export interface ScheduleRunResult {
  id: string;
  siteId: string;
  status: ScheduleOutcome['status'];
  reason?: SchedulePauseReason;
}

export const SCHEDULE_PAUSE_COPY: Record<SchedulePauseReason, string> = {
  baseline_superseded: 'A newer version was published after this one was prepared, so it was not published. Review the current draft and schedule again.',
  owner_removed: 'You are no longer an owner of this site, so the scheduled version was not published.',
  snapshot_unavailable: 'The prepared version is no longer available, so it was not published. Prepare it again to reschedule.',
  site_address_changed: "The site's address changed after this version was prepared, so it was not published. Prepare it again to reschedule.",
};

const pause = (reason: SchedulePauseReason): ScheduleOutcome => ({ status: 'paused', reason });

async function runOne(d: ScheduleRunnerDeps, row: PublicationSchedule): Promise<ScheduleOutcome> {
  const membership = await d.auth.membership(row.siteId, row.createdBy);
  if (membership?.role !== 'owner') return pause('owner_removed');
  const site = await d.store.byId(row.siteId);
  if (!site) return pause('snapshot_unavailable');
  const snapshot = await d.publications.byId(row.siteId, row.snapshotId);
  if (!snapshot || !(await d.publications.source(snapshot))) return pause('snapshot_unavailable');
  if (snapshot.slug !== site.slug || snapshot.host !== site.host.toLowerCase()) return pause('site_address_changed');

  // The superseded decision belongs to the locked commit, never to a possibly cached read.
  const committed = await d.store.publishScheduled({
    id: row.siteId,
    version: snapshot.sourceVersion,
    publicationId: snapshot.id,
    contentHash: snapshot.contentHash,
    baselinePublicationId: row.baselinePublicationId,
    createdBy: row.createdBy,
    createdAt: snapshot.createdAt,
  });
  if (committed.status === 'missing') return pause('snapshot_unavailable');
  if (committed.status === 'superseded') return pause('baseline_superseded');

  /* Identical content published earlier keeps its original publication id, so promote whichever
     one the database recorded. A retry after a failed promote replays the commit and lands here. */
  const liveId = committed.site.publishedPublicationId;
  const effective = liveId === snapshot.id ? snapshot : liveId ? await d.publications.byId(row.siteId, liveId) : null;
  if (!effective) return { status: 'retry', error: 'The recorded publication files are not available yet.' };
  await d.publications.promote(effective);
  return { status: 'published', publicationId: effective.id };
}

async function notify(d: ScheduleRunnerDeps, row: PublicationSchedule) {
  if (!d.reviews || (row.status !== 'published' && row.status !== 'paused')) return;
  const published = row.status === 'published';
  const title = published ? 'Scheduled publish complete' : 'Scheduled publish paused';
  const body = published
    ? 'Your scheduled version of the site is now live.'
    : SCHEDULE_PAUSE_COPY[row.pausedReason || 'snapshot_unavailable'];
  const path = `/sites/${encodeURIComponent(row.siteId)}`;
  const href = d.editorOrigin ? `${d.editorOrigin}${path}` : path;
  await d.reviews.notify({ userId: row.createdBy, kind: published ? 'schedule_published' : 'schedule_paused', title, body, href });
  const user = await d.auth.userById(row.createdBy);
  if (!user?.email) return;
  const work = await d.reviews.enqueueEmail({ to: user.email, subject: title, body: `${body}\n${href}` });
  if (!d.sendNotice) return;
  try {
    await d.sendNotice(work.to, work.subject, work.body);
    await d.reviews.markEmailDelivered(work.id);
  } catch (error) {
    console.error('schedule notice could not be emailed:', (error as Error).message);
  }
}

export async function runDueSchedules(
  d: ScheduleRunnerDeps,
  now = new Date(),
  worker = `schedule-${randomUUID()}`,
  limit = 10,
): Promise<ScheduleRunResult[]> {
  const results: ScheduleRunResult[] = [];
  for (const row of await d.schedules.due(now, limit)) {
    if (!(await d.schedules.claim(row.id, worker, now))) continue;
    let outcome: ScheduleOutcome;
    try {
      outcome = await runOne(d, row);
    } catch (error) {
      outcome = { status: 'retry', error: String((error as Error).message || error) };
    }
    const settled = await d.schedules.settle(row.id, worker, outcome, now);
    if (settled) await notify(d, settled).catch(error => console.error('schedule notice failed:', (error as Error).message));
    results.push({ id: row.id, siteId: row.siteId, status: outcome.status, ...(outcome.status === 'paused' ? { reason: outcome.reason } : {}) });
  }
  return results;
}
