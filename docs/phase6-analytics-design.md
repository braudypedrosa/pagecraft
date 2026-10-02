# Phase 6: aggregate analytics

Status: designed and built 2026-10-02.

Owners can switch on in-house, aggregate analytics for a published site. Pagecraft counts page
views, referrers, device classes, button and link clicks, and accepted form submissions. It keeps
nothing that identifies a visitor.

## Decisions

| Question | Decision (user, 2026-10-02) |
| --- | --- |
| Default | **Off** until the site's owner turns it on. |
| Actions | Every **button and link click**, listed by its label and where it goes. An outbound link shows only its domain. |
| Privacy signals | Visits that send **Global Privacy Control or Do Not Track are skipped**. The page says so. |

These follow from the roadmap and were not reopened:
- No persistent visitor or session identifiers, no unique-visitor counts, no funnels, and nothing
  from a third party.
- Hourly totals are kept for 90 days, and daily totals for 13 months.
- IP addresses, raw browser identification strings (user agents), query strings and form values
  are never stored.
- Forms are counted on the server. QA traffic is isolated. Private preview and editor routes
  are never counted.

## What is counted, and where

- **Page views.** The server counts a view where it sends a page (`serveHostedPublication`),
  because Node serves every published request. A 304 revalidation counts too: it is a real
  repeat view, and deduplication catches reloads.
  - The page is the publication's own file path, not the raw URL. The page list can only hold
    pages that exist, plus "Not found".
- **Referrers.** Only the host of the `Referer` header is kept, with `www.` removed.
  - No header means "Direct".
  - The site's own host counts as internal and adds no referrer. On the shared editor host that
    includes links between pages of the same site.
- **Device.** Mobile, tablet or desktop, worked out from the user agent at request time. The user
  agent itself is thrown away.
- **Clicks.** A first-party script of about 600 bytes is added to published HTML at serve time,
  and only while analytics is on, and only for a visit that is itself counted. Signed-in
  Pagecraft users, visitors with a privacy signal, prefetches and bots never receive it, so
  their clicks can't be counted either. That matters for signed-in users, because the beacon
  request wouldn't carry their cookie. It never goes into exports, immutable publication files or
  previews. On each button or link click it sends `{page, label, target}` to
  `POST /_pc/a/:siteId` with `navigator.sendBeacon`.
  - The label is the visible text or `aria-label`, cut to 60 characters.
  - The target is the path for an internal link, the host for an outbound link, and just the
    scheme for `mailto:` or `tel:`, never the address.
- **Forms.** The form route counts a submission only when `FileSubmissionStore.add` actually
  created it. That makes a retried request (the same `_pc_request`) count once.

## What is never counted

- Requests other than GET.
- Prefetches (`Sec-Purpose` or `Purpose: prefetch`).
- Known bots and monitors, matched against a short user-agent pattern list.
- Visits sending `Sec-GPC: 1` or `DNT: 1`.
- Browsers signed in to Pagecraft (a `pc_session` cookie), so owners checking their own site
  don't inflate it. That cookie only reaches sites on the editor host; on a custom domain the
  other filters still apply.
- Every private route: editor, previews, review snapshots and template previews. None of them
  goes through `serveHostedPublication`.

## Deduplication and bounds

- **Deduplication.** Each process keeps an in-memory map of salted SHA-256 keys:
  `salt + IP + user agent + site + page`, plus the label and target for a click. The salt is
  random per process and changes daily.
  - A view repeated within 30 minutes, or a click within 30 seconds, counts once.
  - The map holds at most 50,000 keys, and the oldest go first. Nothing in it is ever written
    down, so no identifier exists beyond that short window.
  - Several server processes each have their own map, so deduplication is best effort. That
    is acceptable for aggregate totals.
- **Bounded ingestion.**
  - The click endpoint limits a source to 60 a minute and a site to 3,000, and takes at most
    1 KB of body.
  - It drops clicks for sites that are off or unpublished, and pages that aren't in the
    publication.
  - Each site-hour keeps at most 200 pages, 100 referrers and 200 actions. The rest fold into
    "Other".

## Time zones (added 2026-10-03)

- **Storage stays UTC.** Counts are always stored by UTC hour.
- **Setting.** Each site has `timeZone` in `settings.json`. The first time an owner turns analytics
  on, it is taken from their browser. After that the Analytics page has a time zone picker. Sites
  with no setting use UTC.
- **Reading** regroups hours into local days. It covers one UTC day either side of the range,
  which spans every possible offset. So 7, 30 and 90-day views are exact, and changing the zone
  regroups them at once.
- **Daily totals for 13 months** are filed by local day, in the zone the site had when that day
  was merged. An hour that crosses midnight into another month lands in the right month file.
  After a zone change, totals older than 90 days keep the zone they were counted in, and the
  page says so.
- **CSV hours** are local times with their offset, e.g. `2026-10-03T04:00+08:00` (zero offsets
  written `Z`).

## Storage

- **Location.** Files under each environment's publication root, like submissions:
  `<root>/.analytics/<sha256(siteId)>/`. Staging and production already have separate roots, so
  staging and QA traffic never mixes with production. There is no database change, which
  matters because the shared Supabase project is reserved for things both environments need.
- **Files.**
  - `settings.json` holds `{enabled, changedAt, changedBy}`. It is cached in memory for 10 s, so
    switching takes effect within seconds.
  - `hours/<day>.<process>.json` is the live hourly buckets one process has counted for a day.
    Only that process writes it, by writing a temp file and renaming it, so processes never
    need to lock each other.
  - `hours/<day>.json` is a finished day, merged from its process files once the day is two or
    more days old. It is deleted after 90 days.
  - `days/<month>.json` holds a month of daily totals, added when each day is merged. It is
    deleted after 13 months.
- **Flushing.** Counts are buffered in memory and written by a 10-second, `unref`'d timer
  whenever there is something new, and on `SIGTERM` and `beforeExit`. That writes only local
  files, so it is not one of the shared-database background workers that staging keeps off.
  A crash can lose up to about 10 s of counts.
- **Merging and retention** happen lazily: when the Analytics page reads, and at most once an
  hour per site when a process flushes.

## The Analytics page

`/sites/:id/analytics` is for owners only, like Integrations and Settings. A new "Analytics"
item joins the site rail.

- **When off:** what is and isn't counted, and **Turn on analytics**.
- **When on:**
  - Range: 7 days, 30 days, 90 days or 12 months. Up to 90 days reads the hourly files; longer
    reads the daily ones.
  - Totals for views, clicks and form submissions, each compared with the previous period of
    the same length.
  - A daily views chart.
  - Tables: top pages, referrers, devices, clicks, and forms. Form names come from the site's
    draft.
  - **Download CSV** for the range: `date,metric,key,count`.
  - **Turn off**, which keeps the numbers, and **Delete all analytics**, which needs
    confirmation and removes the site's analytics directory.
- The page says what is excluded: signed-in Pagecraft users, privacy signals, bots, and repeats
  within the deduplication window.

## Code

- `server/src/analytics.ts`
  - Pure helpers: device class, bot and prefetch checks, referrer host, label and target
    cleaning, bucket arithmetic, ranges, comparison, CSV.
  - `FileAnalyticsStore`.
  - `AnalyticsRecorder`, which handles the filters, deduplication and buffering.
- `server/src/app.ts`
  - The view hook and script injection in `serveHostedPublication`.
  - `POST /_pc/a/:siteId`, with `_pc` added to `RESERVED_PATHS`.
  - The owner page routes and the CSV download.
- `server/src/submissions-routes.ts` counts accepted forms.
- `server/src/account-pages.ts` holds the page and the rail item. It is fingerprinted, so changes
  go through the Chrome gallery capture.
