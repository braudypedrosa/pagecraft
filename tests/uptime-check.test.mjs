/* The uptime check behind .github/workflows/uptime.yml. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkTarget, runUptimeCheck } from '../tools/uptime-check.mjs';

/* ------------------------------------------------------------- uptime */

test('the uptime check passes healthy deployments and fails down, wrong, or slow ones', async () => {
  const commit = 'c'.repeat(40);
  const fetcher = (async (url) => {
    if (url.includes('down')) throw new TypeError('fetch failed');
    if (url.includes('502')) return new Response('bad gateway', { status: 502 });
    if (url.includes('html')) return new Response('<html>', { status: 200 });
    if (url.includes('nocommit')) return Response.json({ commit: null });
    return Response.json({ commit, branch: 'production' });
  });
  const ok = await checkTarget({ label: 'p', url: 'https://ok.test/__deployment' }, { fetcher });
  a.equal(ok.ok, true);
  a.equal(ok.commit, commit);
  for (const [url, problem] of [['https://down.test', /request failed/], ['https://502.test', /HTTP 502/], ['https://html.test', /not JSON/], ['https://nocommit.test', /no deployed commit/]]) {
    const result = await checkTarget({ label: 'x', url }, { fetcher });
    a.equal(result.ok, false, url);
    a.match(result.problem, problem);
  }
  let clock = 0;
  const slow = await checkTarget({ label: 's', url: 'https://ok.test' }, { fetcher, slowMs: 100, now: () => (clock += 150) });
  a.equal(slow.ok, false);
  a.match(slow.problem, /slow: 150 ms/);

  const lines = [];
  const all = await runUptimeCheck({
    targets: [{ label: 'production', url: 'https://ok.test' }, { label: 'staging', url: 'https://502.test' }],
    fetcher, retryDelayMs: 0, log: line => lines.push(line),
  });
  a.equal(all.ok, false, 'one environment down fails the run');
  a.match(lines.join('\n'), /staging: HTTP 502; retrying once/);
  a.match(lines.join('\n'), /FAIL {2}staging/);
  a.match(lines.join('\n'), /ok {4}production/);

  // A single dropped connection recovers on the retry.
  let calls = 0;
  const flaky = (async () => (++calls === 1 ? new Response('', { status: 503 }) : Response.json({ commit })));
  a.equal((await runUptimeCheck({ targets: [{ label: 'p', url: 'https://x.test' }], fetcher: flaky, retryDelayMs: 0, log: () => undefined })).ok, true);
});

test('the uptime workflow runs every 10 minutes against both environments without secrets', async () => {
  const workflow = await readFile(new URL('../.github/workflows/uptime.yml', import.meta.url), 'utf8');
  a.match(workflow, /cron: '\*\/10 \* \* \* \*'/);
  a.match(workflow, /workflow_dispatch/);
  a.match(workflow, /node tools\/uptime-check\.mjs/);
  a.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  const script = await readFile(new URL('../tools/uptime-check.mjs', import.meta.url), 'utf8');
  a.match(script, /https:\/\/build\.itspagecraft\.com\/__deployment/);
  a.match(script, /https:\/\/staging\.itspagecraft\.com\/__deployment/);
});
