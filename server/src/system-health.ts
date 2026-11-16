/* Operational health without an external service: a bounded, sanitized record of server
   errors kept beside the other file stores under the publication root, and free/used disk
   for the places that have filled the hosting account's quota before.

   Nothing personal is kept. An entry holds the time, method, a path with token-like
   segments replaced, the status, the request id and a scrubbed one-line message — never a
   cookie, header, query string, body, email address or stack trace. */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rename, rm, statfs } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const SERVER_ERROR_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const SERVER_ERROR_MAX_ENTRIES = 500;
const MESSAGE_LIMIT = 300;
const ROUTE_LIMIT = 200;

export type ServerErrorKind = 'request' | 'uncaught_exception' | 'unhandled_rejection';

export interface ServerErrorEntry {
  id: string;
  at: string;
  kind: ServerErrorKind;
  method?: string;
  route?: string;
  status?: number;
  requestId?: string;
  name: string;
  message: string;
}

export interface ServerErrorInput {
  kind: ServerErrorKind;
  error: unknown;
  method?: string;
  path?: string;
  status?: number;
  requestId?: string;
  at?: Date;
}

/** A request path without its query, with ids, tokens and email-like segments replaced. */
export function sanitizeRoute(path: string | undefined) {
  if (!path) return undefined;
  const clean = path.split(/[?#]/)[0] || '/';
  const segments = clean.split('/').map((encoded) => {
    let segment = encoded;
    try { segment = decodeURIComponent(encoded); } catch { /* keep the encoded form */ }
    if (!segment) return segment;
    if (/@/.test(segment)) return ':email';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return ':id';
    if (segment.length >= 16 && /\d/.test(segment) && /^[\w.~=+-]+$/.test(segment)) return ':token';
    if (segment.length > 64) return ':long';
    return segment.replace(/[^\w.~@:+-]/g, '_');
  });
  return segments.join('/').slice(0, ROUTE_LIMIT) || '/';
}

/** One scrubbed line: secrets, contact details, query strings and long opaque values removed. */
export function sanitizeErrorMessage(error: unknown): { name: string; message: string } {
  const raw = error instanceof Error ? error : null;
  const name = (raw?.name || (typeof error === 'object' && error && 'name' in error ? String((error as { name: unknown }).name) : '') || typeof error)
    .replace(/[^\w.-]/g, '').slice(0, 40) || 'Error';
  let message = raw ? raw.message : typeof error === 'string' ? error : (() => {
    try { return JSON.stringify(error) ?? String(error); } catch { return String(error); }
  })();
  message = String(message ?? '').split(/\r?\n/)[0];
  message = message
    .replace(/\b(bearer|basic)\s+[^\s,;"']+/gi, '$1 [redacted]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[jwt]')
    .replace(/\b(?:sb|sk|pk|rk|whsec|pdl|apikey)_[\w-]{8,}/gi, '[key]')
    .replace(/([?&;]|\b)(token|access_token|refresh_token|code|key|secret|password|passwd|pwd|cookie|session|authorization|signature|sig|api[_-]?key)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s&;,"']+)/gi, '$1$2$3[redacted]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/gi, '$1?[query]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b[A-Fa-f0-9]{24,}\b/g, '[hex]')
    .replace(/\b[A-Za-z0-9+/_-]{32,}={0,2}/g, '[opaque]')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, message: message.slice(0, MESSAGE_LIMIT) || '(no message)' };
}

export function serverErrorEntry(input: ServerErrorInput): ServerErrorEntry {
  const { name, message } = sanitizeErrorMessage(input.error);
  const requestId = input.requestId && /^[\w-]{1,64}$/.test(input.requestId) ? input.requestId : undefined;
  return {
    id: randomUUID(),
    at: (input.at || new Date()).toISOString(),
    kind: input.kind,
    ...(input.method ? { method: input.method.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) } : {}),
    ...(input.path ? { route: sanitizeRoute(input.path) } : {}),
    ...(typeof input.status === 'number' ? { status: input.status } : {}),
    ...(requestId ? { requestId } : {}),
    name,
    message,
  };
}

const prune = (rows: ServerErrorEntry[], now: number) => rows
  .filter((row) => {
    const at = Date.parse(row.at);
    return Number.isFinite(at) && now - at <= SERVER_ERROR_RETENTION_MS && at - now < 60_000;
  })
  .sort((a, b) => b.at.localeCompare(a.at))
  .slice(0, SERVER_ERROR_MAX_ENTRIES);

const parse = (text: string): ServerErrorEntry[] => {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value)
      ? value.filter((row) => row && typeof row === 'object' && typeof row.at === 'string' && typeof row.message === 'string')
      : [];
  } catch { return []; }
};

export interface ServerErrorLog {
  record(input: ServerErrorInput): Promise<void>;
  /** Synchronous, for the last moments of a crashing process. Never throws. */
  recordSync(input: ServerErrorInput): void;
  list(now?: Date): Promise<ServerErrorEntry[]>;
}

/** `<publication root>/.system-health/errors.json`, newest first, ≤500 entries, ≤14 days. */
export class FileServerErrorLog implements ServerErrorLog {
  readonly path: string;
  private pending: ServerErrorEntry[] = [];
  private flushing: Promise<void> | null = null;
  constructor(directory: string) { this.path = join(directory, 'errors.json'); }

  async record(input: ServerErrorInput) {
    this.pending.push(serverErrorEntry(input));
    if (this.pending.length > SERVER_ERROR_MAX_ENTRIES) this.pending.splice(0, this.pending.length - SERVER_ERROR_MAX_ENTRIES);
    // A burst of errors coalesces into one write per flush rather than one per error.
    this.flushing ||= this.flush().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private async flush() {
    while (this.pending.length) {
      const batch = this.pending.splice(0);
      let existing: ServerErrorEntry[] = [];
      try { existing = parse(await readFile(this.path, 'utf8')); } catch { /* first entry */ }
      const rows = prune([...batch, ...existing], Date.now());
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify(rows) + '\n', 'utf8');
        await handle.close();
        await rename(temporary, this.path);
      } catch (error) {
        await handle.close().catch(() => undefined);
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }
    }
  }

  recordSync(input: ServerErrorInput) {
    try {
      let existing: ServerErrorEntry[] = [];
      try { existing = parse(readFileSync(this.path, 'utf8')); } catch { /* first entry */ }
      const rows = prune([serverErrorEntry(input), ...this.pending.splice(0), ...existing], Date.now());
      mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(rows) + '\n', { mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.path);
    } catch { /* the process is already failing; never mask the original error */ }
  }

  async list(now = new Date()) {
    await this.flushing?.catch(() => undefined);
    try { return prune(parse(await readFile(this.path, 'utf8')), now.getTime()); } catch { return []; }
  }
}

/** Records crashes without changing them: Node still exits exactly as it would have. An
    unhandled rejection reaches the monitor with origin "unhandledRejection" (default
    `--unhandled-rejections=throw`), so one listener covers both. */
export function installCrashRecorder(log: ServerErrorLog, target: NodeJS.Process = process) {
  const listener = (error: Error, origin: string) => log.recordSync({
    kind: origin === 'unhandledRejection' ? 'unhandled_rejection' : 'uncaught_exception',
    error,
  });
  target.on('uncaughtExceptionMonitor', listener);
  return () => { target.off('uncaughtExceptionMonitor', listener); };
}

export class MemoryServerErrorLog implements ServerErrorLog {
  rows: ServerErrorEntry[] = [];
  async record(input: ServerErrorInput) { this.recordSync(input); }
  recordSync(input: ServerErrorInput) { this.rows = prune([serverErrorEntry(input), ...this.rows], Date.now()); }
  async list(now = new Date()) { return prune(this.rows, now.getTime()); }
}

/* ------------------------------------------------------------------ disk */

export const GIB = 1024 ** 3;
export const DEFAULT_MIN_FREE_BYTES = 2 * GIB;
export const DEFAULT_MAX_USED_PERCENT = 90;
/** The receiver keeps verified archives under 4 GiB; more means retention stopped working. */
export const DEFAULT_RELEASE_BUDGET_BYTES = 5 * GIB;
const MEASURE_ENTRY_LIMIT = 200_000;
const MEASURE_CACHE_MS = 10 * 60 * 1000;

export interface DiskTarget {
  label: string;
  path: string;
  /** Walk the directory and report the bytes it holds (bounded, cached). */
  measure?: boolean;
  /** Warn when the measured size passes this many bytes. */
  budgetBytes?: number;
}

export interface DiskThresholds {
  minFreeBytes: number;
  maxUsedPercent: number;
}

export interface DiskUsage {
  label: string;
  state: 'available' | 'unavailable';
  totalBytes?: number;
  freeBytes?: number;
  usedBytes?: number;
  usedPercent?: number;
  measuredBytes?: number;
  measuredPartial?: boolean;
  budgetBytes?: number;
  warning: boolean;
  reasons: string[];
}

const measured = new Map<string, { at: number; bytes: number; partial: boolean }>();

/** Bytes under a directory, not following symlinks, capped so a huge tree stays cheap. */
export async function directoryBytes(root: string, limit = MEASURE_ENTRY_LIMIT) {
  let bytes = 0, seen = 0, partial = false;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: import('node:fs').Dirent[];
    try { entries = await readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (++seen > limit) { partial = true; stack.length = 0; break; }
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try { const info = await lstat(full); bytes += info.blocks ? info.blocks * 512 : info.size; } catch { /* vanished */ }
      }
    }
  }
  return { bytes, partial };
}

const formatBytes = (bytes: number) => bytes >= GIB ? `${(bytes / GIB).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;

export async function diskUsage(
  targets: DiskTarget[],
  thresholds: DiskThresholds = { minFreeBytes: DEFAULT_MIN_FREE_BYTES, maxUsedPercent: DEFAULT_MAX_USED_PERCENT },
  now = Date.now(),
): Promise<DiskUsage[]> {
  return Promise.all(targets.map(async (target): Promise<DiskUsage> => {
    try {
      const info = await statfs(target.path);
      const totalBytes = Number(info.blocks) * Number(info.bsize);
      const freeBytes = Number(info.bavail) * Number(info.bsize);
      const usedBytes = Math.max(0, totalBytes - Number(info.bfree) * Number(info.bsize));
      const usedPercent = totalBytes ? Math.round(usedBytes / totalBytes * 1000) / 10 : 0;
      const reasons: string[] = [];
      if (freeBytes < thresholds.minFreeBytes) reasons.push(`Only ${formatBytes(freeBytes)} free (warning below ${formatBytes(thresholds.minFreeBytes)}).`);
      if (usedPercent >= thresholds.maxUsedPercent) reasons.push(`${usedPercent}% of the filesystem is used (warning at ${thresholds.maxUsedPercent}%).`);
      let size: { bytes: number; partial: boolean } | undefined;
      if (target.measure) {
        const cached = measured.get(target.path);
        if (cached && now - cached.at < MEASURE_CACHE_MS) size = cached;
        else {
          size = await directoryBytes(target.path);
          measured.set(target.path, { at: now, ...size });
        }
        if (target.budgetBytes && size.bytes > target.budgetBytes) {
          reasons.push(`${target.label} holds ${formatBytes(size.bytes)} (warning above ${formatBytes(target.budgetBytes)}).`);
        }
      }
      return {
        label: target.label, state: 'available', totalBytes, freeBytes, usedBytes, usedPercent,
        ...(size ? { measuredBytes: size.bytes, measuredPartial: size.partial } : {}),
        ...(target.budgetBytes ? { budgetBytes: target.budgetBytes } : {}),
        warning: reasons.length > 0, reasons,
      };
    } catch {
      return { label: target.label, state: 'unavailable', warning: true, reasons: [`${target.label} could not be read.`] };
    }
  }));
}

export function diskThresholdsFromEnv(env: Record<string, string | undefined>): DiskThresholds {
  const free = Number(env.PAGECRAFT_DISK_WARN_FREE_BYTES);
  const percent = Number(env.PAGECRAFT_DISK_WARN_USED_PERCENT);
  return {
    minFreeBytes: Number.isFinite(free) && free > 0 ? free : DEFAULT_MIN_FREE_BYTES,
    maxUsedPercent: Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : DEFAULT_MAX_USED_PERCENT,
  };
}

/* -------------------------------------------------------------- snapshot */

export interface DeploymentInfo { commit: string | null; branch: string | null }

export interface SystemHealthSnapshot {
  generatedAt: string;
  deployments: { label: string; state: 'available' | 'unavailable'; commit?: string | null; branch?: string | null }[];
  errors: { state: 'available' | 'unavailable'; recent: ServerErrorEntry[]; last24h: number; last14d: number };
  disk: DiskUsage[];
  warnings: string[];
}

export interface SystemHealthSource {
  errors?: ServerErrorLog;
  disks: DiskTarget[];
  thresholds?: DiskThresholds;
  deployments: { label: string; read(): Promise<DeploymentInfo | null> }[];
}

export async function systemHealthSnapshot(source: SystemHealthSource, now = new Date()): Promise<SystemHealthSnapshot> {
  const [errorRows, disk, deployments] = await Promise.all([
    source.errors ? source.errors.list(now).then((rows) => rows, () => null) : Promise.resolve(null),
    diskUsage(source.disks, source.thresholds, now.getTime()),
    Promise.all(source.deployments.map(async (deployment) => {
      try {
        const info = await deployment.read();
        return info ? { label: deployment.label, state: 'available' as const, commit: info.commit, branch: info.branch }
          : { label: deployment.label, state: 'unavailable' as const };
      } catch { return { label: deployment.label, state: 'unavailable' as const }; }
    })),
  ]);
  const day = now.getTime() - 24 * 60 * 60 * 1000;
  const rows = errorRows || [];
  const last24h = rows.filter((row) => Date.parse(row.at) >= day).length;
  const warnings = [
    ...disk.flatMap((entry) => entry.reasons),
    ...(errorRows === null ? ['Server error records could not be read.'] : []),
    ...(last24h >= 20 ? [`${last24h} server errors in the last 24 hours.`] : []),
    ...deployments.filter((d) => d.state === 'unavailable').map((d) => `${d.label} deployment could not be read.`),
  ];
  return {
    generatedAt: now.toISOString(),
    deployments,
    errors: { state: errorRows === null ? 'unavailable' : 'available', recent: rows.slice(0, 50), last24h, last14d: rows.length },
    disk,
    warnings,
  };
}

/** Reads a deployment record that the app already serves at `/__deployment`. */
export function deploymentFromUrl(url: string, fetcher: typeof fetch = fetch, timeoutMs = 4000) {
  return async (): Promise<DeploymentInfo | null> => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const body = await response.json() as Partial<DeploymentInfo>;
    const commit = typeof body.commit === 'string' && /^[0-9a-f]{7,40}$/i.test(body.commit) ? body.commit : null;
    const branch = typeof body.branch === 'string' && /^[\w./-]{1,80}$/.test(body.branch) ? body.branch : null;
    return { commit, branch };
  };
}
