# Phase 4 — idempotent snapshot scheduling (design, not built)

Status: design approved 2026-09-25, with the decisions below. Nothing here is implemented yet. This design comes from
reading the current publish, snapshot, worker and gateway code on `b0712ca`.

Roadmap contract: *schedules target exact snapshots and pause for review if a
newer publication supersedes their baseline.* Staging keeps
`PAGECRAFT_BACKGROUND_WORKERS=0`, and staging and production share one database.

## Constraints found in the code

- **Snapshot bytes are per environment.** They live under each environment's
  `PAGECRAFT_PUBLICATION_ROOT` (`publications.ts:342-656`). A `hosted_publications`
  row appears only when a snapshot is actually published. So a schedule in a
  shared table could point at bytes the other environment does not have.
- **Today's publish check can't publish later.** Publishing requires the draft version
  to equal the snapshot's version (`app.ts:2615`, `app.ts:2657`), and the gateway
  repeats the check under `for update`. Any autosave after the snapshot is prepared
  makes it stale. A scheduled publish needs a different check: *nobody
  published since this snapshot was prepared*. The draft moving on is expected.
- **The baseline is already recorded.** Each snapshot's private source stores
  `baselinePublicationId` (`app.ts:2760`). "Superseded" therefore means
  `source.baselinePublicationId !== sites.published_publication_id`. That column
  is shared, so a production publish also supersedes a staging schedule. That is
  the same exposure manual publishing already has.
- **Publishing is identity-gated.** Owner membership is checked against the
  requesting user (`app.ts:2592-2606`, gateway `site.publishHostedAuthorized`).
  A timed run has no request, so it has to check the stored creator instead.
  It must not use the ungated `site.publishHosted`.
- **There is no scheduler.** The only timers are the two `setInterval` drains gated by
  `PAGECRAFT_BACKGROUND_WORKERS` (`index.ts:338-416`). Passenger can idle the
  process, so an in-process timer alone can't promise when it will run.

## Model

```ts
interface PublicationSchedule {
  id: string; siteId: string; snapshotId: string;
  baselinePublicationId: string | null;
  publishAt: string;            // UTC ISO; chosen in the author's local time
  createdBy: string;            // user id, re-checked as an owner at run time
  createdAt: string; idempotencyKey: string;
  status: 'pending' | 'published' | 'paused' | 'cancelled';
  pausedReason?: 'baseline_superseded' | 'owner_removed' | 'snapshot_unavailable' | 'site_address_changed';
  publicationId?: string; attempts: number; lastError?: string;
}
```

**Storage:** per-environment files under `<publicationRoot>/.schedules/`, beside
the snapshot bytes. Reviews, submissions and live reviews are stored the same way. Use one
file per schedule, plus an exclusive lock file (`open(…, 'wx')` with a lease)
to claim a run. Passenger may run several processes, and the review store's
whole-file rewrite is not safe across them. **No SQL migration**, so there's no
shared-schema risk.

## Creating a schedule

`POST /api/sites/:id/publication-schedules` `{snapshotId, publishAt, acknowledgeWarnings, idempotencyKey}`

- Owner only, the same gate as publish.
- The snapshot exists in this environment and matches the site's slug/host.
- The baseline still equals `published_publication_id`; otherwise `409 stale_baseline`.
- Warnings must be acknowledged now, as publish requires. Nobody is present at
  run time to acknowledge them.
- `publishAt` must be at least 2 minutes and at most 90 days away.
- Allow one pending schedule per site (decided 2026-09-25). A second request gets `409 schedule_exists`,
  and the UI offers to replace the existing one.
- A repeated `idempotencyKey` returns the same schedule. `DELETE …/:scheduleId` cancels it.

## Running due schedules

`runDueSchedules(now)` is idempotent, so any trigger can call it safely.
For each pending schedule that is due:

1. Claim its lock. If the claim fails, skip it; another process is running it.
2. Re-read the site authoritatively, bypassing the draft-only gateway cache.
3. If `published_publication_id` already equals the snapshot, mark it `published`.
   This is a replay.
4. Otherwise pause, never publish, when the creator is no longer an owner, the
   snapshot is gone, the slug/host changed, or **the baseline was superseded**.
5. Commit through a new additive gateway operation, `site.publishScheduledSnapshot`.
   Under `for update`, it checks the creator's owner membership and
   `published_publication_id is not distinct from baseline`. It then inserts
   `hosted_publications` (the existing unique constraint deduplicates) and sets
   the site pointer and `published_version = snapshot.sourceVersion`. It does
   **not** check the draft version.
6. Promote this environment's file pointer, then send an in-app notice to the creator
   (`schedule_published` / `schedule_paused`; unknown kinds use the default
   icon). Email waits on the separate notice-delivery fix: queued review emails
   are never sent today.

A paused schedule stays paused. To resume, prepare a fresh snapshot of the
current draft and schedule it.

## Trigger (decided 2026-09-25: both)

- A dedicated flag, `PAGECRAFT_SCHEDULE_RUNNER=1`, starts a 60s interval. It is separate
  from `PAGECRAFT_BACKGROUND_WORKERS` and touches only this environment's schedule
  files and the rows of sites that are due. It never touches the shared invitation or webhook
  queues. That is the scoped acceptance the roadmap asks for.
- A protected `POST /internal/publication-schedules/run` with a secret header, called
  every minute by a server crontab entry. A crontab already exists for TLS renewal.
  This entry wakes an idled Passenger process. Promise "within a few minutes of
  the chosen time", not to the second.

## UI (both files are gallery-fingerprinted — one Codex capture)

- **Publish dialog** (`builder.html`, `preparePublicationReview`). After a review
  preview is prepared, add **Schedule this version…** next to **Publish reviewed
  version**. It opens a date/time picker in local time, with the time zone shown. While
  a schedule is pending, the dialog shows it with **Cancel schedule**.
- **Site overview** (`account-pages.ts:279-305`). Add a "Scheduled for …" row beside
  "Last published". A paused schedule shows its reason and links to the editor.

## Deployment order

1. Deploy the gateway function (`pagecraft-db-v3`) with the new operation. Older apps ignore it.
2. Deploy the Node app. The schedule runner is off by default.
3. Add the crontab entry and set the flag on staging only. Test there with a labeled QA site.
   Production comes later, when the user explicitly asks.

## Tests

- **Server, creation:** owner-only; stale baseline refused; warnings must be acknowledged;
  a repeated idempotency key returns the same schedule; one pending schedule per site; cancel.
- **Server, running:** publishes the exact snapshot bytes; a replay does nothing;
  a superseded baseline, a removed owner or a missing snapshot pauses without publishing;
  two runners racing produce one publication.
- **Gateway:** `deno test` for the new operation, including the baseline race.
- **UI:** tests for the dialog and overview states. Browser checks at 768, 1024 and 1440.

Out of scope: recurring schedules, scheduled unpublishing, per-page schedules.
