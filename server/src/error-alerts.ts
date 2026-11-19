/* Email the operator when the server records new errors.

   The error log in system-health.ts is only useful if somebody reads it, and the founder
   reports console that shows it is not always deployed. This sends one short digest email
   when new entries appear, using the SMTP settings the server already has for notices. No
   external service, no new secret: just PAGECRAFT_ALERT_EMAIL.

   Entries are already sanitized by system-health.ts (no cookies, bodies, emails or stack
   traces), so the email carries nothing the log does not.

   Rules:
   - The first check after a fresh install only records where the log is; history is not
     emailed.
   - At most one email per cooldown (default one hour). Errors that arrive during the cooldown
     are not dropped: they are included in the next email.
   - A failed send changes nothing, so the same errors are tried again next time.
   - State lives in a small file beside the log, so restarts (including crash restarts) do
     not resend old errors and do send the ones that caused the crash. */
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ServerErrorEntry, ServerErrorInput, ServerErrorLog } from './system-health.ts';

export const ALERT_COOLDOWN_MS = 60 * 60 * 1000;
export const ALERT_MAX_LISTED = 10;

export interface ErrorAlertState {
  /** `at` of the newest entry already emailed (or already present at install). */
  lastSeenAt: string | null;
  /** When the last email went out. */
  lastSentAt: string | null;
}

export type AlertSender = (to: string, subject: string, text: string) => Promise<void> | void;

export interface ErrorAlertOptions {
  log: Pick<ServerErrorLog, 'list'>;
  send: AlertSender;
  to: string;
  statePath: string;
  /** Which deployment this is, for the subject line, e.g. build.itspagecraft.com. */
  environment: string;
  cooldownMs?: number;
}

export type ErrorAlertResult = 'initialized' | 'none' | 'cooldown' | 'sent' | 'failed';

async function readState(path: string): Promise<ErrorAlertState | null> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (value && typeof value === 'object') {
      return {
        lastSeenAt: typeof value.lastSeenAt === 'string' ? value.lastSeenAt : null,
        lastSentAt: typeof value.lastSentAt === 'string' ? value.lastSentAt : null,
      };
    }
  } catch { /* missing or unreadable: treat as a fresh install */ }
  return null;
}

async function writeState(path: string, state: ErrorAlertState) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(state) + '\n', 'utf8');
    await handle.close();
    await rename(temporary, path);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

const describe = (row: ServerErrorEntry) => {
  const where = [row.method, row.route].filter(Boolean).join(' ');
  const status = typeof row.status === 'number' ? ` ${row.status}` : '';
  const request = row.requestId ? ` (request ${row.requestId})` : '';
  return `- ${row.at}  ${row.kind}${status}${where ? `  ${where}` : ''}${request}\n  ${row.name}: ${row.message}`;
};

export function errorAlertMessage(entries: ServerErrorEntry[], environment: string) {
  const count = entries.length;
  const subject = `[Pagecraft] ${count} new server error${count === 1 ? '' : 's'} on ${environment}`;
  const listed = entries.slice(0, ALERT_MAX_LISTED);
  const lines = [
    `${environment} recorded ${count} new server error${count === 1 ? '' : 's'}.`,
    count > listed.length ? `The newest ${listed.length} are below.` : '',
    '',
    ...listed.map(describe),
    '',
    'The full log (14 days) is in founder reports under System health, or on the host in',
    '<PAGECRAFT_PUBLICATION_ROOT>/.system-health/errors.json.',
    'Messages are sanitized: no cookies, bodies, email addresses or stack traces.',
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '');
  return { subject, text: lines.join('\n') };
}

/** One check. Safe to call often; it sends at most one email per cooldown. */
export async function checkErrorAlerts(options: ErrorAlertOptions, now = new Date()): Promise<ErrorAlertResult> {
  const cooldown = options.cooldownMs ?? ALERT_COOLDOWN_MS;
  const entries = await options.log.list(now); // newest first
  const state = await readState(options.statePath);
  if (!state) {
    await writeState(options.statePath, { lastSeenAt: entries[0]?.at ?? now.toISOString(), lastSentAt: null });
    return 'initialized';
  }
  const fresh = entries.filter((row) => !state.lastSeenAt || row.at > state.lastSeenAt);
  if (!fresh.length) return 'none';
  const lastSent = state.lastSentAt ? Date.parse(state.lastSentAt) : NaN;
  if (Number.isFinite(lastSent) && now.getTime() - lastSent < cooldown) return 'cooldown';
  const { subject, text } = errorAlertMessage(fresh, options.environment);
  try {
    await options.send(options.to, subject, text);
  } catch (error) {
    console.error('The error alert email could not be sent:', (error as Error).message);
    return 'failed';
  }
  await writeState(options.statePath, { lastSeenAt: fresh[0].at, lastSentAt: now.toISOString() });
  return 'sent';
}

/**
 * Runs checks shortly after start (so a crash that restarted the process is reported), on an
 * interval, and shortly after each newly recorded error. Returns a log to use in place of the
 * original, plus a stop function for tests.
 */
export function startErrorAlerts(
  log: ServerErrorLog,
  options: Omit<ErrorAlertOptions, 'log'>,
  timing: { startupDelayMs?: number; intervalMs?: number; afterErrorDelayMs?: number } = {},
) {
  const { startupDelayMs = 30_000, intervalMs = 5 * 60_000, afterErrorDelayMs = 60_000 } = timing;
  let running = false;
  let pending: ReturnType<typeof setTimeout> | null = null;
  const run = async () => {
    if (running) return;
    running = true;
    try { await checkErrorAlerts({ ...options, log }); } catch (error) {
      console.error('Error alerts could not be checked:', (error as Error).message);
    } finally { running = false; }
  };
  const soon = (delay: number) => {
    if (pending) return;
    pending = setTimeout(() => { pending = null; void run(); }, delay);
    pending.unref?.();
  };
  soon(startupDelayMs);
  const interval = setInterval(() => void run(), intervalMs);
  interval.unref?.();
  const alerting: ServerErrorLog = {
    async record(input: ServerErrorInput) {
      await log.record(input);
      soon(afterErrorDelayMs);
    },
    recordSync: (input) => log.recordSync(input),
    list: (now) => log.list(now),
  };
  const stop = () => { clearInterval(interval); if (pending) clearTimeout(pending); pending = null; };
  return { log: alerting, run, stop };
}
