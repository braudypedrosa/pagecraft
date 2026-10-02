/* Aggregate analytics for published sites (Phase 6). See docs/phase6-analytics-design.md.

   Counts only: page views by page, referrer host and device class; button and link clicks by
   label and target; accepted form submissions. Nothing that identifies a visitor is stored. The
   deduplication keys are salted hashes held in memory for minutes and never written down.

   Storage is files under the environment's publication root, so staging and QA traffic stays
   out of production by construction. Each process writes only its own hourly file; finished days
   are merged later, so no two processes ever write the same file. */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Device = 'mobile' | 'tablet' | 'desktop';
export const DEVICES: Device[] = ['desktop', 'mobile', 'tablet'];

/** One hour's (or day's) counts. Keys are already cleaned and bounded. */
export interface Bucket {
  views: number;
  clicks: number;
  forms: number;
  pages: Record<string, number>;
  referrers: Record<string, number>;
  devices: Partial<Record<Device, number>>;
  /** `${label}\t${target}` */
  actions: Record<string, number>;
  /** form id */
  formIds: Record<string, number>;
}
export const emptyBucket = (): Bucket => ({
  views: 0, clicks: 0, forms: 0, pages: {}, referrers: {}, devices: {}, actions: {}, formIds: {},
});

export const OTHER = '(other)';
export const DIRECT = '(direct)';
export const NOT_FOUND = '(not found)';
const CAPS = { pages: 200, referrers: 100, actions: 200, formIds: 100 } as const;

/* ---- what a request is ------------------------------------------------- */

/* Crawlers, link unfurlers, monitors and scripts. Not exhaustive and not meant to be: the totals
   are aggregate, and the long tail of bots is small next to these. */
const BOT = /bot\b|bot\/|crawl|spider|slurp|scrap|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python-|httpclient|go-http|java\/|node-fetch|axios|okhttp|libwww|feedfetcher|validator/i;

export function isBot(userAgent: string) {
  return !userAgent.trim() || BOT.test(userAgent);
}

/** Desktop, tablet or phone. iPadOS asking for desktop sites reads as desktop, which is honest. */
export function deviceOf(userAgent: string): Device {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Nexus (7|9|10)/i.test(userAgent)) return 'tablet';
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry|Opera Mini/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

type Header = (name: string) => string | undefined;

/** Why a request is not counted, or null when it is. Checked before anything is hashed. */
export function excluded(header: Header): string | null {
  if (header('sec-gpc') === '1' || header('dnt') === '1') return 'privacy-signal';
  if (/prefetch|prerender/i.test(`${header('sec-purpose') || ''} ${header('purpose') || ''} ${header('x-moz') || ''}`)) return 'prefetch';
  if (isBot(header('user-agent') || '')) return 'bot';
  // Someone signed in to Pagecraft: very likely the owner or a collaborator checking the site.
  if (/(?:^|;\s*)pc_session=/.test(header('cookie') || '')) return 'signed-in';
  return null;
}

/** The referring host, `(direct)` without one, or null for a link within the same site. */
export function referrerOf(referer: string | undefined, own: { host: string; prefix?: string }) {
  if (!referer) return DIRECT;
  let url: URL;
  try { url = new URL(referer); } catch { return DIRECT; }
  if (!/^https?:$/.test(url.protocol)) return DIRECT;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const ownHost = own.host.toLowerCase().split(':')[0].replace(/^www\./, '');
  if (host === ownHost && (!own.prefix || url.pathname === `/${own.prefix}` || url.pathname.startsWith(`/${own.prefix}/`))) return null;
  return host.slice(0, 100) || DIRECT;
}

const squash = (s: string, max: number) => String(s || '').replace(/[\t\r\n\s]+/g, ' ').trim().slice(0, max);
/** A click's visible label: text the owner wrote, never anything a visitor typed. */
export const cleanLabel = (raw: unknown) => squash(String(raw ?? ''), 60) || '(no label)';
/** Where a click goes: a path inside the site, a host outside it, or just the scheme. */
export function cleanTarget(raw: unknown) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^(mailto|tel|sms):/i.test(s)) return s.split(':')[0].toLowerCase() + ':';
  if (s.startsWith('/')) return squash(s.split(/[?#]/)[0], 120);
  return squash(s.toLowerCase().replace(/^www\./, '').replace(/[/?#].*$/, ''), 100);
}

/* ---- buckets ----------------------------------------------------------- */

function bump(map: Record<string, number>, key: string, cap: number, by = 1) {
  if (map[key] === undefined && Object.keys(map).length >= cap) key = OTHER;
  map[key] = (map[key] || 0) + by;
}

export function addInto(into: Bucket, from: Bucket) {
  into.views += from.views;
  into.clicks += from.clicks;
  into.forms += from.forms;
  for (const [k, n] of Object.entries(from.pages)) bump(into.pages, k, Infinity, n);
  for (const [k, n] of Object.entries(from.referrers)) bump(into.referrers, k, Infinity, n);
  for (const [k, n] of Object.entries(from.devices)) into.devices[k as Device] = (into.devices[k as Device] || 0) + (n || 0);
  for (const [k, n] of Object.entries(from.actions)) bump(into.actions, k, Infinity, n);
  for (const [k, n] of Object.entries(from.formIds)) bump(into.formIds, k, Infinity, n);
  return into;
}
export const sumBuckets = (buckets: Iterable<Bucket>) => {
  const total = emptyBucket();
  for (const b of buckets) addInto(total, b);
  return total;
};

/** Sorted rows, largest first, for a table. */
export const top = (map: Record<string, number>, limit = 50) =>
  Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);

/* ---- time ------------------------------------------------------------- */

/** All times are UTC: `2026-10-02` and hour `07`. */
export const dayOf = (d: Date) => d.toISOString().slice(0, 10);
export const hourOf = (d: Date) => d.toISOString().slice(11, 13);
const addDays = (day: string, n: number) => dayOf(new Date(Date.parse(day + 'T00:00:00Z') + n * 86_400_000));
export const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

export type RangeKey = '7d' | '30d' | '90d' | '12m';
export const RANGES: Record<RangeKey, { days: number; label: string }> = {
  '7d': { days: 7, label: 'Last 7 days' },
  '30d': { days: 30, label: 'Last 30 days' },
  '90d': { days: 90, label: 'Last 90 days' },
  '12m': { days: 365, label: 'Last 12 months' },
};
export const isRange = (s: unknown): s is RangeKey => typeof s === 'string' && s in RANGES;

/* Counts are stored by UTC hour and read in the site's time zone: an hour is an hour everywhere,
   and which day it belongs to is decided when reading. */
const zoneFormats = new Map<string, Intl.DateTimeFormat>();
const zoneFormat = (tz: string) => {
  let f = zoneFormats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' });
    zoneFormats.set(tz, f);
  }
  return f;
};
/** The local day, hour and UTC offset (`+08:00`, or `Z`) of an instant in a time zone. */
export function localParts(at: number, tz: string) {
  const parts = Object.fromEntries(zoneFormat(tz).formatToParts(new Date(at)).map(p => [p.type, p.value]));
  const offset = String(parts.timeZoneName || 'GMT').replace('GMT', '');
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: String(parts.hour).padStart(2, '0'), offset: !offset || /^[+-]00:00$/.test(offset) ? 'Z' : offset };
}
/** An IANA time zone name, canonicalised, or null when it is not one. */
export function validTimeZone(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw || raw.length > 64) return null;
  try { return new Intl.DateTimeFormat('en-US', { timeZone: raw }).resolvedOptions().timeZone; } catch { return null; }
}
export const timeZones = () => ['UTC', ...Intl.supportedValuesOf('timeZone').filter(z => z !== 'UTC')];

/** The range ending today in `tz`, and the period of the same length just before it. */
export function rangeDays(range: RangeKey, now: Date, tz = 'UTC') {
  const to = localParts(now.getTime(), tz).day;
  const from = addDays(to, 1 - RANGES[range].days);
  return { from, to, previous: { from: addDays(from, -RANGES[range].days), to: addDays(from, -1) } };
}

/** Change against the previous period, or null when there was nothing to compare with. */
export const change = (now: number, before: number) => (before ? (now - before) / before : null);

/* ---- CSV -------------------------------------------------------------- */

/* A leading apostrophe stops a spreadsheet from treating a label like `=SUM(…)` as a formula. */
const cell = (v: string | number) => {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** One row per counted thing per time unit: `time,metric,key,count`. */
export function toCsv(rows: { time: string; bucket: Bucket }[], formName: (id: string) => string = id => id) {
  const lines = ['time,metric,key,count'];
  for (const { time, bucket } of rows) {
    const add = (metric: string, key: string, n: number) => { if (n) lines.push([time, metric, key, n].map(cell).join(',')); };
    add('views', '', bucket.views);
    add('clicks', '', bucket.clicks);
    add('forms', '', bucket.forms);
    for (const [k, n] of top(bucket.pages, Infinity)) add('page', k, n);
    for (const [k, n] of top(bucket.referrers, Infinity)) add('referrer', k, n);
    for (const d of DEVICES) add('device', d, bucket.devices[d] || 0);
    for (const [k, n] of top(bucket.actions, Infinity)) add('click', k.replace('\t', ' → '), n);
    for (const [k, n] of top(bucket.formIds, Infinity)) add('form', formName(k), n);
  }
  return lines.join('\r\n') + '\r\n';
}

/* ---- storage ------------------------------------------------------------ */

export interface AnalyticsSettings {
  enabled: boolean;
  changedAt: string | null;
  changedBy: string | null;
  /** IANA name; which day a visit belongs to. UTC until the owner (or their browser) picks one. */
  timeZone?: string;
}
/** `merged` names the process files already folded in, so a crash between writing the merged day
    and deleting its parts can never count them twice. */
type DayFile = { hours: Record<string, Bucket>; merged?: string[] };
type MonthFile = { days: Record<string, Bucket> };

const HOURLY_DAYS = 90;
const DAILY_MONTHS = 13;
const json = async <T>(file: string): Promise<T | null> => {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
};
async function writeAtomic(file: string, data: unknown) {
  const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
  await rename(temp, file);
}

export class FileAnalyticsStore {
  readonly root: string;
  /** Unique per process start, so a restarted process never appends to a dead one's file. */
  readonly processId: string;
  private now: () => Date;
  private settingsCache = new Map<string, { at: number; value: AnalyticsSettings }>();
  private compacted = new Map<string, number>();

  constructor(root: string, options: { now?: () => Date; processId?: string } = {}) {
    this.root = root;
    this.now = options.now || (() => new Date());
    this.processId = options.processId || `${process.pid.toString(36)}${randomBytes(3).toString('hex')}`;
  }
  dir(site: string) { return join(this.root, createHash('sha256').update(site).digest('hex')); }

  async settings(site: string): Promise<AnalyticsSettings> {
    const hit = this.settingsCache.get(site);
    if (hit && Date.now() - hit.at < 10_000) return hit.value;
    const value = { enabled: false, changedAt: null, changedBy: null, ...await json<AnalyticsSettings>(join(this.dir(site), 'settings.json')) };
    this.settingsCache.set(site, { at: Date.now(), value });
    if (this.settingsCache.size > 5000) this.settingsCache.delete(this.settingsCache.keys().next().value!);
    return value;
  }
  async setEnabled(site: string, enabled: boolean, userId: string, timeZone?: string | null) {
    return this.writeSettings(site, { enabled, changedAt: this.now().toISOString(), changedBy: userId, ...(timeZone ? { timeZone } : {}) });
  }
  async setTimeZone(site: string, timeZone: string, userId: string) {
    return this.writeSettings(site, { timeZone, changedAt: this.now().toISOString(), changedBy: userId });
  }
  private async writeSettings(site: string, patch: Partial<AnalyticsSettings>) {
    const dir = this.dir(site);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    this.settingsCache.delete(site);
    const value: AnalyticsSettings = { ...await this.settings(site), ...patch };
    await writeAtomic(join(dir, 'settings.json'), value);
    this.settingsCache.set(site, { at: Date.now(), value });
    return value;
  }
  /** Every number for this site, gone; the setting goes back to off. */
  async remove(site: string) {
    await rm(this.dir(site), { recursive: true, force: true });
    this.settingsCache.delete(site);
  }

  /** Write this process's whole day for one site: it is the only writer of that file. */
  async writeOwn(site: string, day: string, file: DayFile) {
    const dir = join(this.dir(site), 'hours');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeAtomic(join(dir, `${day}.${this.processId}.json`), file);
  }

  /** Per-day totals for a range of days in `tz`, with the hours while they are kept. Hours are
      keyed by their local time with its offset, e.g. `2026-10-03T09:00+08:00`. */
  async read(site: string, from: string, to: string, tz = 'UTC') {
    await this.compact(site);
    const hoursDir = join(this.dir(site), 'hours');
    const files = await readdir(hoursDir).catch(() => [] as string[]);
    // The UTC days that can hold hours of these local days: one either side covers every offset.
    const local = new Map<string, Record<string, Bucket>>();
    for (const day of daysBetween(addDays(from, -1), addDays(to, 1))) {
      const settled = files.includes(`${day}.json`) ? await json<DayFile>(join(hoursDir, `${day}.json`)).catch(() => null) : null;
      const done = new Set(settled?.merged || []);
      const parts = files.filter(f => /^\d{4}-\d{2}-\d{2}\.[a-z0-9]+\.json$/.test(f) && f.startsWith(`${day}.`) && !done.has(f));
      const sources = [settled, ...await Promise.all(parts.map(part => json<DayFile>(join(hoursDir, part)).catch(() => null)))];
      for (const data of sources) {
        for (const [hour, bucket] of Object.entries(data?.hours || {})) {
          const at = localParts(Date.parse(`${day}T${hour}:00:00Z`), tz);
          const hours = local.get(at.day) || {};
          local.set(at.day, hours);
          addInto(hours[`${at.day}T${at.hour}:00${at.offset}`] ||= emptyBucket(), bucket);
        }
      }
    }
    // Inside the hourly window the hours are the record, even when there are none; before it,
    // the daily totals, filed in the time zone the site had when they were merged.
    const hourlyFrom = addDays(dayOf(this.now()), 1 - HOURLY_DAYS);
    const months = new Map<string, MonthFile | null>();
    const days: StoredDay[] = [];
    for (const day of daysBetween(from, to)) {
      const hours = local.get(day);
      if (hours || day >= hourlyFrom) {
        days.push({ day, total: sumBuckets(Object.values(hours || {})), hours: hours || {} });
        continue;
      }
      const month = day.slice(0, 7);
      if (!months.has(month)) months.set(month, await json<MonthFile>(join(this.dir(site), 'days', `${month}.json`)).catch(() => null));
      days.push({ day, total: months.get(month)?.days[day.slice(8)] || emptyBucket(), hours: null });
    }
    return days;
  }

  /** Merge finished days into one file each, add them to the month, and drop expired files. At
      most hourly per site and process, under a directory lock so two processes never race. */
  async compact(site: string, force = false) {
    const last = this.compacted.get(site) || 0;
    if (!force && Date.now() - last < 3_600_000) return;
    this.compacted.set(site, Date.now());
    const dir = this.dir(site);
    const lock = join(dir, '.compacting');
    try { await mkdir(lock); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; // nothing recorded yet
      const info = await stat(lock).catch(() => null);
      if (info && Date.now() - info.mtimeMs < 60_000) return;
      await rm(lock, { recursive: true, force: true });
      try { await mkdir(lock); } catch { return; }
    }
    try {
      const hoursDir = join(dir, 'hours');
      const files = await readdir(hoursDir).catch(() => [] as string[]);
      const today = dayOf(this.now());
      const settled = addDays(today, -2);
      const live = new Map<string, string[]>();
      for (const f of files) {
        const m = /^(\d{4}-\d{2}-\d{2})\.[a-z0-9]+\.json$/.exec(f);
        if (m && m[1] <= settled) live.set(m[1], [...(live.get(m[1]) || []), f]);
      }
      const tz = (await this.settings(site)).timeZone || 'UTC';
      for (const [day, parts] of [...live].sort()) {
        const merged: DayFile = (await json<DayFile>(join(hoursDir, `${day}.json`))) || { hours: {} };
        const done = new Set(merged.merged || []);
        const added: Record<string, Bucket> = {};
        for (const part of parts) {
          if (done.has(part)) continue;
          done.add(part);
          const data = await json<DayFile>(join(hoursDir, part)).catch(() => null);
          for (const [hour, bucket] of Object.entries(data?.hours || {})) {
            addInto(merged.hours[hour] ||= emptyBucket(), bucket);
            addInto(added[hour] ||= emptyBucket(), bucket);
          }
        }
        merged.merged = [...done];
        await writeAtomic(join(hoursDir, `${day}.json`), merged);
        const daysDir = join(dir, 'days');
        await mkdir(daysDir, { recursive: true, mode: 0o700 });
        // Each hour joins the local day it fell on, which near midnight can be another month.
        const touched = new Map<string, MonthFile>();
        for (const [hour, bucket] of Object.entries(added)) {
          const at = localParts(Date.parse(`${day}T${hour}:00:00Z`), tz);
          const key = at.day.slice(0, 7);
          if (!touched.has(key)) touched.set(key, (await json<MonthFile>(join(daysDir, `${key}.json`))) || { days: {} });
          addInto(touched.get(key)!.days[at.day.slice(8)] ||= emptyBucket(), bucket);
        }
        for (const [key, month] of touched) await writeAtomic(join(daysDir, `${key}.json`), month);
        for (const part of parts) await rm(join(hoursDir, part), { force: true });
      }
      // Retention: hourly detail for 90 days, daily totals for 13 months.
      const hourlyCutoff = addDays(today, -HOURLY_DAYS);
      for (const f of await readdir(hoursDir).catch(() => [] as string[])) {
        const m = /^(\d{4}-\d{2}-\d{2})\./.exec(f);
        if (m && m[1] < hourlyCutoff) await rm(join(hoursDir, f), { force: true });
      }
      const cutoff = new Date(Date.parse(today + 'T00:00:00Z'));
      cutoff.setUTCMonth(cutoff.getUTCMonth() - DAILY_MONTHS);
      const monthCutoff = dayOf(cutoff).slice(0, 7);
      for (const f of await readdir(join(dir, 'days')).catch(() => [] as string[])) {
        const m = /^(\d{4}-\d{2})\.json$/.exec(f);
        if (m && m[1] < monthCutoff) await rm(join(dir, 'days', f), { force: true });
      }
    } finally {
      await rmdir(lock).catch(() => undefined);
    }
  }
}

/* ---- recording ---------------------------------------------------------- */

export interface CountedRequest {
  header: Header;
  /** the client address, used only inside a salted in-memory hash */
  source: string;
  host: string;
}

/** Filters, short-lived deduplication and buffering in front of a store. */
export class AnalyticsRecorder {
  readonly store: FileAnalyticsStore;
  private now: () => Date;
  private pending = new Map<string, Map<string, Map<string, Bucket>>>(); // site → day → hour → delta
  private own = new Map<string, Map<string, DayFile>>(); // site → day → this process's whole day
  private seen = new Map<string, number>();
  private salt = { day: '', value: '' };
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  private readonly viewWindowMs = 30 * 60_000;
  private readonly clickWindowMs = 30_000;
  private readonly maxSeen = 50_000;

  constructor(store: FileAnalyticsStore, options: { now?: () => Date } = {}) {
    this.store = store;
    this.now = options.now || (() => new Date());
  }

  async enabled(site: string) { return (await this.store.settings(site)).enabled; }

  /** A page view. `page` is the publication's own path, or NOT_FOUND. */
  view(site: string, page: string, request: CountedRequest, own: { prefix?: string } = {}) {
    if (excluded(request.header)) return false;
    const ua = request.header('user-agent') || '';
    if (this.repeat([site, page, request.source, ua], this.viewWindowMs)) return false;
    const referrer = referrerOf(request.header('referer'), { host: request.host, prefix: own.prefix });
    const bucket = this.bucket(site);
    bucket.views++;
    bump(bucket.pages, page, CAPS.pages);
    if (referrer) bump(bucket.referrers, referrer, CAPS.referrers);
    const device = deviceOf(ua);
    bucket.devices[device] = (bucket.devices[device] || 0) + 1;
    return true;
  }

  /** A button or link click reported by the published page. */
  click(site: string, input: { label: unknown; target: unknown }, request: CountedRequest) {
    if (excluded(request.header)) return false;
    const label = cleanLabel(input.label), target = cleanTarget(input.target);
    if (this.repeat([site, label, target, request.source, request.header('user-agent') || ''], this.clickWindowMs)) return false;
    const bucket = this.bucket(site);
    bucket.clicks++;
    bump(bucket.actions, `${label}\t${target}`, CAPS.actions);
    return true;
  }

  /** An accepted form submission, counted where the server stored it. */
  form(site: string, formId: string) {
    const bucket = this.bucket(site);
    bucket.forms++;
    bump(bucket.formIds, squash(formId, 80), CAPS.formIds);
  }

  private repeat(parts: string[], windowMs: number) {
    const day = dayOf(this.now());
    if (this.salt.day !== day) { this.salt = { day, value: randomBytes(16).toString('hex') }; this.seen.clear(); }
    const key = createHash('sha256').update(this.salt.value).update(parts.join('\n')).digest('base64url');
    const at = this.now().getTime();
    const until = this.seen.get(key);
    if (until && until > at) return true;
    this.seen.delete(key);
    this.seen.set(key, at + windowMs);
    while (this.seen.size > this.maxSeen) this.seen.delete(this.seen.keys().next().value!);
    return false;
  }

  private bucket(site: string) {
    const at = this.now();
    const days = this.pending.get(site) || new Map<string, Map<string, Bucket>>();
    this.pending.set(site, days);
    const hours = days.get(dayOf(at)) || new Map<string, Bucket>();
    days.set(dayOf(at), hours);
    const bucket = hours.get(hourOf(at)) || emptyBucket();
    hours.set(hourOf(at), bucket);
    return bucket;
  }

  /** Write what was counted since the last flush. Serialized: one flush at a time. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing.then(() => this.flush());
    if (!this.pending.size) return Promise.resolve();
    const batch = this.pending;
    this.pending = new Map();
    this.flushing = (async () => {
      for (const [site, days] of batch) {
        const mine = this.own.get(site) || new Map<string, DayFile>();
        this.own.set(site, mine);
        for (const [day, hours] of days) {
          const file = mine.get(day) || { hours: {} };
          mine.set(day, file);
          for (const [hour, delta] of hours) addInto(file.hours[hour] ||= emptyBucket(), delta);
          try { await this.store.writeOwn(site, day, file); }
          catch (error) { console.error('analytics could not be written:', (error as Error).message); }
        }
        // A finished day stays on disk; this process no longer needs its copy.
        const keep = addDays(dayOf(this.now()), -1);
        for (const day of [...mine.keys()]) if (day < keep) mine.delete(day);
        // Inside the flush, so a flush that resolves has nothing still writing behind it.
        await this.store.compact(site).catch(error => console.error('analytics could not be compacted:', (error as Error).message));
      }
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  /** Flush every 10 s while there is something to write, and on the way out.

      A SIGTERM listener replaces Node's default of exiting, so this one flushes for at most two
      seconds and then raises the signal again, with itself already removed: the process still
      ends the way Passenger and the deploy's startup proof expect. Without that it never exits. */
  start(options: { raise?: (signal: NodeJS.Signals) => void } = {}) {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.flush(); }, 10_000);
    this.timer.unref?.();
    process.once('beforeExit', () => { void this.flush(); });
    const raise = options.raise || ((signal: NodeJS.Signals) => process.kill(process.pid, signal));
    process.once('SIGTERM', () => {
      this.stop();
      const limit = new Promise(resolve => setTimeout(resolve, 2000).unref?.());
      void Promise.race([this.flush().catch(() => undefined), limit]).then(() => raise('SIGTERM'));
    });
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** The click counter added to published HTML while analytics is on. First-party, no storage,
    no identifiers: it reports the page, the clicked element's label and where it goes. */
export function clickScript(siteId: string) {
  const endpoint = JSON.stringify(`/_pc/a/${encodeURIComponent(siteId)}`);
  return `<script>(()=>{const u=${endpoint};document.addEventListener("click",e=>{const el=e.target&&e.target.closest&&e.target.closest("a[href],button,[role=button],input[type=submit],input[type=button]");if(!el)return;let t="";const h=el.getAttribute("href");if(h){if(/^(mailto|tel|sms):/i.test(h))t=h.split(":")[0]+":";else try{const x=new URL(h,location.href);t=x.host===location.host?x.pathname:x.host}catch(_){}}const l=(el.getAttribute("aria-label")||el.innerText||el.value||"").replace(/\\s+/g," ").trim().slice(0,60);const b=JSON.stringify({p:location.pathname,l:l,t:t});try{navigator.sendBeacon?navigator.sendBeacon(u,b):fetch(u,{method:"POST",body:b,keepalive:true})}catch(_){}},{capture:true,passive:true})})()</script>`;
}

/** Insert the click counter just before `</body>`, or at the end when there is none. */
export function withClickScript(html: string, siteId: string) {
  const script = clickScript(siteId);
  const at = html.lastIndexOf('</body>');
  return at < 0 ? html + script : html.slice(0, at) + script + html.slice(at);
}

/* ---- the owner's report ---------------------------------------------------- */

export type StoredDay = { day: string; total: Bucket; hours: Record<string, Bucket> | null };
export interface AnalyticsReport {
  range: RangeKey;
  from: string;
  to: string;
  totals: { views: number; clicks: number; forms: number };
  previous: { views: number; clicks: number; forms: number };
  /** Days for ranges up to 90 days, weeks for twelve months. */
  columns: { start: string; end: string; views: number }[];
  pages: [string, number][];
  referrers: [string, number][];
  devices: [Device, number][];
  actions: { label: string; target: string; count: number }[];
  forms: { name: string; count: number }[];
  hasData: boolean;
}

export function analyticsReport(
  range: RangeKey, current: StoredDay[], previous: StoredDay[], formName: (id: string) => string = id => id,
): AnalyticsReport {
  const total = sumBuckets(current.map(d => d.total));
  const before = sumBuckets(previous.map(d => d.total));
  const step = range === '12m' ? 7 : 1;
  const columns: AnalyticsReport['columns'] = [];
  for (let i = 0; i < current.length; i += step) {
    const slice = current.slice(i, i + step);
    columns.push({ start: slice[0].day, end: slice[slice.length - 1].day, views: slice.reduce((n, d) => n + d.total.views, 0) });
  }
  return {
    range,
    from: current[0]?.day || '',
    to: current[current.length - 1]?.day || '',
    totals: { views: total.views, clicks: total.clicks, forms: total.forms },
    previous: { views: before.views, clicks: before.clicks, forms: before.forms },
    columns,
    pages: top(total.pages, 50),
    referrers: top(total.referrers, 50),
    devices: DEVICES.map(d => [d, total.devices[d] || 0] as [Device, number]).filter(([, n]) => n > 0),
    actions: top(total.actions, 50).map(([key, count]) => {
      const [label, target = ''] = key.split('\t');
      return { label, target, count };
    }),
    forms: top(total.formIds, 50).map(([id, count]) => ({ name: formName(id), count })),
    hasData: total.views + total.clicks + total.forms > 0,
  };
}

/** CSV rows for a range: hourly while hours are kept, daily before that. */
export function csvRows(days: StoredDay[]) {
  const rows: { time: string; bucket: Bucket }[] = [];
  for (const d of days) {
    if (d.hours) for (const hour of Object.keys(d.hours).sort()) rows.push({ time: hour, bucket: d.hours[hour] });
    else if (d.total.views + d.total.clicks + d.total.forms) rows.push({ time: d.day, bucket: d.total });
  }
  return rows;
}
