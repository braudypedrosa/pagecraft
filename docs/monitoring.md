# Monitoring

Pagecraft has no external error-tracking or paging service. Monitoring uses what already
exists: a file-based error log on the host, GitHub Actions for uptime, and the private
founder reports console for viewing.

## Server error log

`server/src/system-health.ts` records, in `<PAGECRAFT_PUBLICATION_ROOT>/.system-health/errors.json`:

- unhandled request errors (the Hono `onError` handler in `server/src/app.ts`), which now
  answer `500 Internal Server Error` with an `X-Request-ID` header the person can quote;
- uncaught exceptions and unhandled promise rejections (`installCrashRecorder` in
  `server/src/index.ts`, using `uncaughtExceptionMonitor`, so the process still crashes and
  restarts exactly as before).

Each entry holds the time, kind, method, a sanitized route (no query string; ids, tokens and
email-like segments replaced), status, request id and one scrubbed line of message (emails,
bearer/JWT/API keys, `token=`/`password=`/`cookie=` values, URL queries and long opaque
values removed, 300 characters max). Cookies, headers, bodies and stack traces are never
stored. The file is `0600`, newest first, at most 500 entries and 14 days. Staging and
production keep separate logs because their publication roots are separate.

Errors that a route catches and turns into its own 4xx/5xx answer are not "unhandled" and
are not recorded; they continue to go to the application log only.

## Uptime

`.github/workflows/uptime.yml` runs `tools/uptime-check.mjs` every 10 minutes. It requests
`https://build.itspagecraft.com/__deployment` and `https://staging.itspagecraft.com/__deployment`
and fails when either is unreachable, does not return a deployment record with a commit, or
takes longer than 8 seconds (one retry after 15 seconds first). A failed scheduled run makes
GitHub email the repository owner. No secrets are used.

GitHub runs schedules only from the default branch, which is `production`. The schedule
starts only after this workflow is promoted to production; until then it can be run by hand
with **Run workflow** (`workflow_dispatch`). GitHub may delay scheduled runs and disables
them after 60 days without repository activity.

## Disk space

The hosting account has a ~20 GB quota that release archives have filled before. Founder
reports' **System health** section shows, for each configured location, filesystem free and
used bytes (`statfs`) and, for release storage, the bytes actually held (bounded walk,
cached 10 minutes). Warnings appear when:

- free space is below `PAGECRAFT_DISK_WARN_FREE_BYTES` (default 2 GiB);
- the filesystem is at or above `PAGECRAFT_DISK_WARN_USED_PERCENT` (default 90%);
- release storage holds more than 5 GiB (the receiver keeps verified archives under 4 GiB,
  so more means retention stopped working).

Caveat: `statfs` reports the filesystem, not a CloudLinux per-account quota. On shared
hosting the filesystem figures can look healthy while the account quota is nearly full.
The release-storage measurement is the reliable signal for the failure seen before; confirm
the account quota in cPanel when in doubt.

## Founder reports: System health

`/health` in the founder reports console (owner allowlist only) shows recent server errors,
disk warnings and the deployed commits of the reported app (from its public
`/__deployment`) and of the reports process itself. Configure it in the reports runtime
file:

| Key | Value |
| --- | --- |
| `PAGECRAFT_REPORTS_HEALTH_ROOT` | Absolute publication root of the app being reported (the same value as that app's `PAGECRAFT_PUBLICATION_ROOT`). Required for the section. |
| `PAGECRAFT_REPORTS_RELEASE_ROOT` | Optional absolute path of the deployment receiver's release storage, for example `~/pagecraft-deploy` expanded. |
| `PAGECRAFT_DISK_WARN_FREE_BYTES`, `PAGECRAFT_DISK_WARN_USED_PERCENT` | Optional thresholds. |
| `REPORTS_APP_ORIGIN` | Existing key; used to read the app's `/__deployment`. |

The reports process runs on the same hosting account, so it reads these files directly; no
new HTTP endpoint or secret is added. Founder reports itself is not yet deployed (DNS for
`reports.itspagecraft.com` is pending), so the section is available once that deployment
happens.
