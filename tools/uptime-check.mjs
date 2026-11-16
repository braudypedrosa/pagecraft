#!/usr/bin/env node
/* Uptime check for the scheduled GitHub workflow (.github/workflows/uptime.yml).
   Requests each environment's public /__deployment record and exits non-zero when one is
   down, answers with something other than a deployment record, or is slow. A failed
   scheduled run is what makes GitHub email the repository owner; no secrets are used.
   Each target gets one retry so a single dropped connection does not page anyone. */

export const DEFAULT_TARGETS = [
  { label: 'production', url: 'https://build.itspagecraft.com/__deployment' },
  { label: 'staging', url: 'https://staging.itspagecraft.com/__deployment' },
];
export const DEFAULT_SLOW_MS = 8000;
const TIMEOUT_MS = 20_000;

export async function checkTarget(target, { fetcher = fetch, slowMs = DEFAULT_SLOW_MS, now = () => performance.now() } = {}) {
  const started = now();
  try {
    const response = await fetcher(target.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json', 'user-agent': 'pagecraft-uptime-check' },
      redirect: 'manual',
      cache: 'no-store',
    });
    const ms = Math.round(now() - started);
    if (response.status !== 200) return { ...target, ok: false, ms, problem: `HTTP ${response.status}` };
    let body;
    try { body = await response.json(); } catch { return { ...target, ok: false, ms, problem: 'response is not JSON' }; }
    if (!body || typeof body.commit !== 'string' || !/^[0-9a-f]{40}$/.test(body.commit)) {
      return { ...target, ok: false, ms, problem: 'no deployed commit in the response' };
    }
    if (ms > slowMs) return { ...target, ok: false, ms, commit: body.commit, problem: `slow: ${ms} ms (limit ${slowMs} ms)` };
    return { ...target, ok: true, ms, commit: body.commit };
  } catch (error) {
    return { ...target, ok: false, ms: Math.round(now() - started), problem: error?.name === 'TimeoutError' ? `no response within ${TIMEOUT_MS} ms` : `request failed: ${error?.message || error}` };
  }
}

export async function runUptimeCheck({ targets = DEFAULT_TARGETS, fetcher = fetch, slowMs = DEFAULT_SLOW_MS, retryDelayMs = 15_000, log = console.log } = {}) {
  const results = [];
  for (const target of targets) {
    let result = await checkTarget(target, { fetcher, slowMs });
    if (!result.ok && retryDelayMs >= 0) {
      log(`${target.label}: ${result.problem}; retrying once`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      result = await checkTarget(target, { fetcher, slowMs });
    }
    log(result.ok
      ? `ok    ${target.label} ${result.ms} ms commit ${result.commit.slice(0, 12)}`
      : `FAIL  ${target.label} ${target.url}: ${result.problem}`);
    results.push(result);
  }
  return { ok: results.every(result => result.ok), results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slow = Number(process.env.UPTIME_SLOW_MS);
  const { ok, results } = await runUptimeCheck({ slowMs: Number.isFinite(slow) && slow > 0 ? slow : DEFAULT_SLOW_MS });
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['| Environment | Result | Time | Commit |', '| --- | --- | --- | --- |',
      ...results.map(r => `| ${r.label} | ${r.ok ? 'up' : `**down** — ${r.problem}`} | ${r.ms} ms | ${r.commit ? r.commit.slice(0, 12) : '—'} |`)].join('\n') + '\n');
  }
  process.exit(ok ? 0 : 1);
}
