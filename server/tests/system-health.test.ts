/* Monitoring without an external service: sanitized server error capture, disk warnings, the
   founder System health section and the uptime check used by the scheduled workflow. */
import { afterEach, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Context } from 'hono';
import * as Core from '../../app/src/core/index.ts';
import type { Doc } from '../../app/src/core/types.ts';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import { createApp } from '../src/app.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { createFounderReportsApp } from '../src/founder-reports.ts';
import { reportsRuntimeConfig } from '../src/reports-config.ts';
import { MemoryStore } from '../src/store.ts';
import {
  FileServerErrorLog, MemoryServerErrorLog, SERVER_ERROR_MAX_ENTRIES, deploymentFromUrl, diskUsage,
  sanitizeErrorMessage, sanitizeRoute, systemHealthSnapshot, type SystemHealthSnapshot,
} from '../src/system-health.ts';

const roots: string[] = [];
const scratch = async () => { const dir = await mkdtemp(join(tmpdir(), 'pagecraft-health-')); roots.push(dir); return dir; };
afterEach(async () => { await Promise.all(roots.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

const demo = (): Doc => {
  Core.seed();
  return structuredClone({ schemaVersion: Core.SCHEMA, meta: Core.state.meta, header: Core.state.header, footer: Core.state.footer, pages: Core.state.pages });
};

/* ------------------------------------------------------------- sanitizing */

test('error messages lose secrets, contact details, query strings and opaque values', () => {
  const secret = new Error([
    'Request to https://db.example.test/rest/v1/users?select=*&apikey=sb_secret_abcdefghijklmnop failed for jane.doe+test@example.com',
    'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl token=abc123secret password=hunter2 cookie=pc_session=xyz',
    'site 123e4567-e89b-42d3-a456-426614174000 hash 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  ].join(' ') + '\n    at stack frame (file.ts:1:1)');
  const { name, message } = sanitizeErrorMessage(secret);
  a.equal(name, 'Error');
  for (const leaked of ['jane.doe', 'example.com', 'sb_secret', 'eyJhbGci', 'abc123secret', 'hunter2', 'pc_session=xyz', 'select=*', '123e4567', '9f86d0818', 'stack frame']) {
    a.doesNotMatch(message, new RegExp(leaked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${leaked} leaked: ${message}`);
  }
  a.match(message, /https:\/\/db\.example\.test\/rest\/v1\/users\?\[query\]/);
  a.match(message, /\[email\]/);
  a.ok(message.length <= 300);
  a.equal(sanitizeErrorMessage('x'.repeat(5000)).message.length <= 300, true);
  a.deepEqual(sanitizeErrorMessage(undefined), { name: 'undefined', message: 'undefined' });
  a.equal(sanitizeErrorMessage({ name: 'Weird<script>', message: 'nope' }).name, 'Weirdscript');
});

test('routes keep their shape but drop queries, ids, tokens and email addresses', () => {
  a.equal(sanitizeRoute('/api/sites/123e4567-e89b-42d3-a456-426614174000/doc?token=secret'), '/api/sites/:id/doc');
  a.equal(sanitizeRoute('/invitations/a1B2c3D4e5F6g7H8i9J0k1L2/accept'), '/invitations/:token/accept');
  a.equal(sanitizeRoute('/account/jane@example.com'), '/account/:email');
  a.equal(sanitizeRoute('/account/jane%40example.com'), '/account/:email');
  a.equal(sanitizeRoute('/edit/s1#fragment'), '/edit/s1');
  a.equal(sanitizeRoute(undefined), undefined);
  a.ok(sanitizeRoute('/' + 'a/'.repeat(300))!.length <= 200);
});

/* --------------------------------------------------------------- the log */

test('the file log keeps newest first, at most 500 entries and 14 days, with owner-only permissions', async () => {
  const dir = await scratch();
  const log = new FileServerErrorLog(join(dir, '.system-health'));
  const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  await log.record({ kind: 'request', error: new Error('ancient'), at: old, path: '/api/x', status: 500 });
  await log.record({ kind: 'request', error: new Error('first'), method: 'post', path: '/api/sites?x=1', status: 500, requestId: 'req-1' });
  await log.record({ kind: 'uncaught_exception', error: new TypeError('second') });
  const rows = await log.list();
  a.deepEqual(rows.map(row => row.message), ['second', 'first'], '15-day-old entries are pruned');
  a.deepEqual({ ...rows[1], id: 'x', at: 'x' }, { id: 'x', at: 'x', kind: 'request', method: 'POST', route: '/api/sites', status: 500, requestId: 'req-1', name: 'Error', message: 'first' });
  a.equal(rows[0].name, 'TypeError');
  a.equal((await stat(log.path)).mode & 0o777, 0o600);

  // A burst is bounded and coalesced rather than written once per error.
  await Promise.all(Array.from({ length: SERVER_ERROR_MAX_ENTRIES + 40 }, (_, i) => log.record({ kind: 'request', error: new Error(`burst ${i}`) })));
  const capped = await log.list();
  a.equal(capped.length, SERVER_ERROR_MAX_ENTRIES);
  a.equal(JSON.parse(await readFile(log.path, 'utf8')).length, SERVER_ERROR_MAX_ENTRIES);
});

test('a corrupt log file is treated as empty and replaced, never crashing the caller', async () => {
  const dir = await scratch();
  await mkdir(join(dir, '.system-health'));
  await writeFile(join(dir, '.system-health', 'errors.json'), '{not json');
  const log = new FileServerErrorLog(join(dir, '.system-health'));
  a.deepEqual(await log.list(), []);
  log.recordSync({ kind: 'uncaught_exception', error: new Error('after corruption') });
  a.deepEqual((await log.list()).map(row => row.message), ['after corruption']);
});

test('a crashing process records the crash and still exits as it would have', async () => {
  const dir = await scratch();
  const module = new URL('../src/system-health.ts', import.meta.url).pathname;
  for (const [kind, code] of [
    ['uncaught_exception', `setTimeout(() => { throw new Error('boom token=abc user@example.com'); }, 0);`],
    ['unhandled_rejection', `Promise.reject(new Error('rejected promise'));`],
  ] as const) {
    const logDir = join(dir, kind);
    const child = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const { FileServerErrorLog, installCrashRecorder } = await import(${JSON.stringify(module)});
       installCrashRecorder(new FileServerErrorLog(${JSON.stringify(logDir)}));
       ${code}`], { encoding: 'utf8', timeout: 20_000 });
    a.notEqual(child.status, 0, `${kind} still crashes the process`);
    const rows = JSON.parse(await readFile(join(logDir, 'errors.json'), 'utf8'));
    a.equal(rows.length, 1);
    a.equal(rows[0].kind, kind);
    a.doesNotMatch(rows[0].message, /abc|user@example/);
  }
});

/* ------------------------------------------------------- the app handler */

class FailingStore extends MemoryStore {
  override async listMeta(): Promise<never> {
    throw new Error('gateway exploded for owner@example.test with key=sk_live_123456789');
  }
}

test('an unhandled request error answers 500 with a request id and leaves a sanitized record', async () => {
  const store = new FailingStore(), auth = new MemoryAuthStore(), serverErrors = new MemoryServerErrorLog();
  let sent = '';
  const app = createApp({ store, auth, serverErrors, editorHtml: '<title>B</title>', editorHost: 'admin.test', editorOrigin: 'http://admin.test', sendLink: (_t, url) => { sent = url; } });
  const site = await MemoryStore.prototype.create.call(store, { host: 'acme.test', name: 'Acme', doc: demo() });
  const user = await auth.createUser('me@acme.test');
  await auth.grant(site.id, user.id, 'owner');
  const req = (path: string, init: RequestInit = {}, cookie = '') => app.request(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  }));
  await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'me@acme.test' }) });
  const cookie = ((await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`)).headers.get('set-cookie') || '').split(';')[0];

  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const res = await req('/api/sites?secret=query-value', {}, cookie);
    a.equal(res.status, 500);
    a.equal(await res.text(), 'Internal Server Error');
    const requestId = res.headers.get('x-request-id');
    a.match(requestId || '', /^[0-9a-f-]{36}$/);
    const [row] = await serverErrors.list();
    a.equal(row.kind, 'request');
    a.equal(row.method, 'GET');
    a.equal(row.route, '/api/sites');
    a.equal(row.status, 500);
    a.equal(row.requestId, requestId);
    const stored = JSON.stringify(row);
    for (const leaked of ['owner@example.test', 'sk_live', 'query-value', cookie.split('=')[1] || 'never']) a.ok(!stored.includes(leaked), `${leaked} leaked`);
  } finally { spy.mockRestore(); }

  // Ordinary 4xx answers are not errors and are not recorded.
  const before = (await serverErrors.list()).length;
  a.equal((await req('/api/sites/nope', {}, cookie)).status >= 400, true);
  a.equal((await serverErrors.list()).length, before);
});

/* -------------------------------------------------------------- disk */

test('disk usage reports free and used bytes and warns at the configured thresholds', async () => {
  const dir = await scratch();
  await mkdir(join(dir, 'archives', 'pagecraft-app'), { recursive: true });
  await writeFile(join(dir, 'archives', 'pagecraft-app', 'r1.tar.gz'), Buffer.alloc(64 * 1024));
  const [healthy] = await diskUsage([{ label: 'Publication storage', path: dir }], { minFreeBytes: 1, maxUsedPercent: 100 });
  a.equal(healthy.state, 'available');
  a.ok(healthy.totalBytes! > 0 && healthy.freeBytes! > 0 && healthy.usedBytes! >= 0);
  a.ok(healthy.usedPercent! >= 0 && healthy.usedPercent! <= 100);
  a.equal(healthy.warning, false);

  const [low] = await diskUsage([{ label: 'Publication storage', path: dir }], { minFreeBytes: Number.MAX_SAFE_INTEGER, maxUsedPercent: 100 });
  a.equal(low.warning, true);
  a.match(low.reasons[0], /free \(warning below/);

  const [release] = await diskUsage([{ label: 'Release storage', path: join(dir, 'archives'), measure: true, budgetBytes: 1024 }], { minFreeBytes: 1, maxUsedPercent: 100 }, Date.now() + 1);
  a.ok(release.measuredBytes! >= 64 * 1024);
  a.equal(release.warning, true);
  a.match(release.reasons.join(' '), /Release storage holds .* \(warning above/);

  const [missing] = await diskUsage([{ label: 'Gone', path: join(dir, 'does-not-exist') }]);
  a.deepEqual({ state: missing.state, warning: missing.warning }, { state: 'unavailable', warning: true });
});

test('the snapshot combines errors, disk and deployments into warnings', async () => {
  const dir = await scratch();
  const errors = new MemoryServerErrorLog();
  for (let i = 0; i < 21; i++) await errors.record({ kind: 'request', error: new Error(`e${i}`), path: '/api/x', status: 500 });
  const snapshot = await systemHealthSnapshot({
    errors,
    disks: [{ label: 'Publication storage', path: dir }],
    thresholds: { minFreeBytes: Number.MAX_SAFE_INTEGER, maxUsedPercent: 100 },
    deployments: [
      { label: 'Pagecraft app (staging)', read: async () => ({ commit: 'a'.repeat(40), branch: 'development' }) },
      { label: 'Founder reports', read: async () => { throw new Error('down'); } },
    ],
  });
  a.equal(snapshot.errors.last24h, 21);
  a.equal(snapshot.errors.recent.length, 21);
  a.deepEqual(snapshot.deployments[0], { label: 'Pagecraft app (staging)', state: 'available', commit: 'a'.repeat(40), branch: 'development' });
  a.equal(snapshot.deployments[1].state, 'unavailable');
  a.ok(snapshot.warnings.some(w => /free \(warning below/.test(w)));
  a.ok(snapshot.warnings.includes('21 server errors in the last 24 hours.'));
  a.ok(snapshot.warnings.includes('Founder reports deployment could not be read.'));
});

test('a deployment record is read from /__deployment and only well-formed values are kept', async () => {
  const fetcher = (async (url: string) => {
    if (url.includes('bad')) return new Response(JSON.stringify({ commit: '<script>', branch: 'x y' }), { status: 200 });
    if (url.includes('down')) return new Response('no', { status: 502 });
    return Response.json({ commit: 'b'.repeat(40), branch: 'production' });
  }) as typeof fetch;
  a.deepEqual(await deploymentFromUrl('https://ok.test/__deployment', fetcher)(), { commit: 'b'.repeat(40), branch: 'production' });
  a.deepEqual(await deploymentFromUrl('https://bad.test/__deployment', fetcher)(), { commit: null, branch: null });
  a.equal(await deploymentFromUrl('https://down.test/__deployment', fetcher)(), null);
});

/* ----------------------------------------------------- founder reports */

const OWNER = '123e4567-e89b-42d3-a456-426614174000';
const owner: VerifiedIdentity = { authUserId: OWNER, email: 'founder@example.test', name: 'Founder', createdAt: '2026-01-01T00:00:00.000Z' };
const reports = (current: VerifiedIdentity | null, systemHealth?: () => Promise<SystemHealthSnapshot>) => {
  const auth = { identity: async (_c: Context) => current, signIn: async () => null, signOut: async () => undefined } as unknown as AccountAuth;
  const app = createFounderReportsApp({
    host: 'reports.test', origin: 'http://reports.test', appOrigin: 'http://app.test', dataEnvironment: 'staging',
    accountAuth: auth, billing: { ownerAuthUserIds: [OWNER] }, systemHealth,
  });
  return (path: string) => app.request(new Request(`http://reports.test${path}`, { headers: { host: 'reports.test' } }));
};

const sample = (): SystemHealthSnapshot => ({
  generatedAt: '2026-11-16T10:00:00.000Z',
  deployments: [
    { label: 'Pagecraft app (staging)', state: 'available', commit: '2ba748d50ba2c0ffee0000000000000000000000', branch: 'development' },
    { label: 'Founder reports', state: 'unavailable' },
  ],
  errors: { state: 'available', last24h: 1, last14d: 2, recent: [
    { id: '1', at: '2026-11-16T09:00:00.000Z', kind: 'request', method: 'GET', route: '/api/sites', status: 500, requestId: 'req-abc', name: 'Error', message: 'gateway <b>exploded</b>' },
  ] },
  disk: [
    { label: 'Publication storage', state: 'available', totalBytes: 20 * 1024 ** 3, freeBytes: 1024 ** 3, usedBytes: 19 * 1024 ** 3, usedPercent: 95, warning: true, reasons: ['Only 1.0 GB free (warning below 2.0 GB).'] },
    { label: 'Release storage', state: 'available', totalBytes: 20 * 1024 ** 3, freeBytes: 1024 ** 3, usedBytes: 19 * 1024 ** 3, usedPercent: 95, measuredBytes: 3 * 1024 ** 3, budgetBytes: 5 * 1024 ** 3, warning: false, reasons: [] },
  ],
  warnings: ['Only 1.0 GB free (warning below 2.0 GB).', 'Founder reports deployment could not be read.'],
});

test('founder reports shows System health only to the allowlisted owner', async () => {
  a.equal((await reports(null, async () => sample())('/health')).status, 303, 'signed-out visitors are sent to sign in');
  const stranger = { ...owner, authUserId: '123e4567-e89b-42d3-a456-426614174999' };
  a.equal((await reports(stranger, async () => sample())('/health')).status, 403);

  const res = await reports(owner, async () => sample())('/health');
  a.equal(res.status, 200);
  a.equal(res.headers.get('cache-control'), 'private, no-store');
  const html = await res.text();
  a.match(html, /<h2>System health<\/h2>/);
  a.match(html, /aria-current="page"[^>]*><svg[^>]*>[\s\S]*?<span>System health<\/span>/);
  a.match(html, /data-health-commit>2ba748d50ba2<\/span> · development/);
  a.doesNotMatch(html, /&lt;time/, 'dates render as <time>, not escaped markup');
  a.match(html, /Checked <time datetime="2026-11-16T10:00:00.000Z">/);
  a.match(html, /Deployment record unavailable/);
  a.match(html, /data-health-disk-warning/);
  a.match(html, /1\.0 GB free of 20\.0 GB · 95% used/);
  a.match(html, /holds 3\.0 GB of 5\.0 GB budget/);
  a.match(html, /data-health-warning>Only 1\.0 GB free/);
  a.match(html, /GET \/api\/sites<\/td><td>500<\/td><td><span class="health-mono">req-abc<\/span>/);
  a.match(html, /gateway &lt;b&gt;exploded&lt;\/b&gt;/, 'messages are escaped');
  a.match(html, /1 in the last 24 hours · 2 kept/);
});

test('founder reports explains an unconfigured or failing System health source', async () => {
  const unconfigured = await (await reports(owner)('/health')).text();
  a.match(unconfigured, /System health is not configured/);
  a.match(unconfigured, /PAGECRAFT_REPORTS_HEALTH_ROOT/);
  const failing = await reports(owner, async () => { throw new Error('nope'); })('/health');
  a.equal(failing.status, 200);
  a.match(await failing.text(), /System health is not configured/);
  const empty = await (await reports(owner, async () => ({ ...sample(), warnings: [], errors: { state: 'available', recent: [], last24h: 0, last14d: 0 } }))('/health')).text();
  a.match(empty, /data-health-ok>No disk, error-rate or deployment warnings/);
  a.match(empty, /No server errors recorded/);
});

test('reports configuration accepts only absolute health paths', () => {
  const base = {
    REPORTS_HOST: 'reports.test', PAGECRAFT_OWNER_AUTH_USER_IDS: OWNER, SUPABASE_URL: 'http://supabase.test',
    SUPABASE_PUBLISHABLE_KEY: 'pk', PAGECRAFT_REPORTS_STORAGE_ROOT: '/srv/reports',
  };
  const ok = reportsRuntimeConfig({ ...base, PAGECRAFT_REPORTS_HEALTH_ROOT: '/srv/publications', PAGECRAFT_REPORTS_RELEASE_ROOT: '/home/x/pagecraft-deploy' });
  a.equal(ok.healthRoot, '/srv/publications');
  a.equal(ok.releaseRoot, '/home/x/pagecraft-deploy');
  a.equal(reportsRuntimeConfig(base).healthRoot, undefined);
  a.throws(() => reportsRuntimeConfig({ ...base, PAGECRAFT_REPORTS_HEALTH_ROOT: 'relative/path' }), /absolute/);
  a.throws(() => reportsRuntimeConfig({ ...base, PAGECRAFT_REPORTS_RELEASE_ROOT: '../up' }), /absolute/);
});
