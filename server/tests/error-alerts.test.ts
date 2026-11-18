/* Error alert emails: history is not emailed, new errors are, at most once per cooldown, and a
   failed send is retried rather than lost. */
import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkErrorAlerts, errorAlertMessage, startErrorAlerts, ALERT_MAX_LISTED } from '../src/error-alerts.ts';
import { MemoryServerErrorLog, serverErrorEntry } from '../src/system-health.ts';

const roots: string[] = [];
const scratch = async () => { const dir = await mkdtemp(join(tmpdir(), 'pagecraft-alerts-')); roots.push(dir); return dir; };
afterEach(async () => { await Promise.all(roots.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

const at = (iso: string) => new Date(iso);
const setup = async () => {
  const log = new MemoryServerErrorLog();
  const sent: { to: string; subject: string; text: string }[] = [];
  let fail = false;
  const options = {
    log,
    to: 'ops@example.test',
    statePath: join(await scratch(), 'alert-state.json'),
    environment: 'build.example.test',
    send: async (to: string, subject: string, text: string) => {
      if (fail) throw new Error('smtp down');
      sent.push({ to, subject, text });
    },
  };
  const add = (iso: string, message = 'boom') => log.recordSync({ kind: 'request', error: new Error(message), method: 'GET', path: '/api/sites', status: 500, at: at(iso) });
  return { log, sent, options, add, setFail: (v: boolean) => { fail = v; } };
};

test('the first check records where the log is and does not email history', async () => {
  const t = await setup();
  const now = new Date();
  t.add(new Date(now.getTime() - 60_000).toISOString(), 'old');
  a.equal(await checkErrorAlerts(t.options, now), 'initialized');
  a.equal(t.sent.length, 0);
  a.equal(await checkErrorAlerts(t.options, now), 'none');
  const state = JSON.parse(await readFile(t.options.statePath, 'utf8'));
  a.ok(state.lastSeenAt);
});

test('new errors are emailed once, then wait for the cooldown, then are included next time', async () => {
  const t = await setup();
  const base = Date.now();
  const iso = (offset: number) => new Date(base + offset).toISOString();
  a.equal(await checkErrorAlerts(t.options, new Date(base)), 'initialized');

  t.add(iso(1_000), 'first failure');
  a.equal(await checkErrorAlerts(t.options, new Date(base + 2_000)), 'sent');
  a.equal(t.sent.length, 1);
  a.equal(t.sent[0].to, 'ops@example.test');
  a.match(t.sent[0].subject, /1 new server error on build\.example\.test/);
  a.match(t.sent[0].text, /first failure/);
  a.match(t.sent[0].text, /GET \/api\/sites/);

  t.add(iso(3_000), 'second failure');
  a.equal(await checkErrorAlerts(t.options, new Date(base + 4_000)), 'cooldown');
  a.equal(t.sent.length, 1);

  t.add(iso(5_000), 'third failure');
  a.equal(await checkErrorAlerts(t.options, new Date(base + 2_000 + 60 * 60 * 1000)), 'sent');
  a.equal(t.sent.length, 2);
  a.match(t.sent[1].subject, /2 new server errors/);
  a.match(t.sent[1].text, /second failure/);
  a.match(t.sent[1].text, /third failure/);
  a.doesNotMatch(t.sent[1].text, /first failure/);
});

test('a failed send is retried on the next check', async () => {
  const t = await setup();
  const base = Date.now();
  await checkErrorAlerts(t.options, new Date(base));
  t.add(new Date(base + 1_000).toISOString(), 'needs retry');
  t.setFail(true);
  a.equal(await checkErrorAlerts(t.options, new Date(base + 2_000)), 'failed');
  t.setFail(false);
  a.equal(await checkErrorAlerts(t.options, new Date(base + 3_000)), 'sent');
  a.match(t.sent[0].text, /needs retry/);
});

test('the message lists at most ten entries and keeps the sanitized text only', () => {
  const rows = Array.from({ length: 12 }, (_, i) => serverErrorEntry({
    kind: 'request', error: new Error(`failed for jane@example.com token=abc${i}`), at: new Date(Date.UTC(2026, 10, 18, 0, i)),
  })).reverse();
  const { subject, text } = errorAlertMessage(rows, 'staging.example.test');
  a.match(subject, /12 new server errors on staging\.example\.test/);
  a.match(text, new RegExp(`newest ${ALERT_MAX_LISTED}`));
  a.equal((text.match(/^- /gm) || []).length, ALERT_MAX_LISTED);
  a.doesNotMatch(text, /jane@example\.com/);
  a.doesNotMatch(text, /abc\d/);
});

test('the alerting log records through and schedules a check after an error', async () => {
  const t = await setup();
  const alerts = startErrorAlerts(t.log, t.options, { startupDelayMs: 5, intervalMs: 60_000, afterErrorDelayMs: 5 });
  try {
    await new Promise(resolve => setTimeout(resolve, 30)); // startup check initializes
    await alerts.log.record({ kind: 'request', error: new Error('late failure'), method: 'POST', path: '/api/publish', status: 500 });
    a.equal((await alerts.log.list()).length, 1);
    await new Promise(resolve => setTimeout(resolve, 50));
    a.equal(t.sent.length, 1);
    a.match(t.sent[0].text, /late failure/);
  } finally { alerts.stop(); }
});
