import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Core from '../../app/src/core/index.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { FileHostedPublicationStore } from '../src/publications.ts';
import { FileSubmissionStore } from '../src/submissions.ts';
import { blankDoc } from '../src/render.ts';
import { AnalyticsRecorder, DIRECT, FileAnalyticsStore, NOT_FOUND, sumBuckets } from '../src/analytics.ts';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(r => rm(r, { recursive: true, force: true }))); });

async function rig() {
  const root = await mkdtemp(join(tmpdir(), 'pc-analytics-routes-'));
  roots.push(root);
  const store = new MemoryStore();
  const doc = blankDoc('Acme');
  const form = Core.N('form'); form.id = 'contact'; form.props.fields = [{ name: 'email', label: 'Email', type: 'email', required: 1 }];
  doc.pages[0].tree = [form];
  const site = await store.create({ host: 'acme.invalid', name: 'Acme', slug: 'acme', doc });
  const publications = new FileHostedPublicationStore(join(root, 'published'));
  const page = (body: string) => new TextEncoder().encode(`<!doctype html><html><body>${body}</body></html>`);
  const pub = await publications.create({
    siteId: site.id, slug: site.slug, host: site.host, sourceVersion: site.version,
    files: [
      { path: 'index.html', mediaType: 'text/html', bytes: page('<a href="/acme/about">About</a>') },
      { path: 'about.html', mediaType: 'text/html', bytes: page('<button>Book</button>') },
      { path: '404.html', mediaType: 'text/html', bytes: page('Not here') },
    ],
  });
  await publications.promote(pub);
  const analyticsStore = new FileAnalyticsStore(join(root, 'analytics'));
  const analytics = new AnalyticsRecorder(analyticsStore);
  const auth = new MemoryAuthStore();
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const editor = await auth.createUser('editor@example.test', 'Editor');
  await auth.grant(site.id, owner.id, 'owner');
  await auth.grant(site.id, editor.id, 'content');
  const cookieFor = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookieFor(owner.id), editorCookie = await cookieFor(editor.id);
  const app = createApp({
    store, auth, publications, analytics,
    submissions: new FileSubmissionStore(join(root, 'submissions')),
    editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>',
  });
  let n = 0;
  const visit = (path: string, headers: Record<string, string> = {}) => app.request(new Request(`http://admin.test${path}`, {
    headers: { host: 'admin.test', 'user-agent': CHROME, 'x-forwarded-for': headers.ip || `203.0.113.${++n}`, ...headers },
  }));
  const click = (body: unknown, id = site.id) => app.request(new Request(`http://admin.test/_pc/a/${id}`, {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { host: 'admin.test', 'user-agent': CHROME, 'content-type': 'text/plain;charset=UTF-8', origin: 'null', 'x-forwarded-for': '198.51.100.4' },
  }));
  const totals = async () => {
    await analytics.flush();
    const today = new Date().toISOString().slice(0, 10);
    return sumBuckets((await analyticsStore.read(site.id, today, today)).map(d => d.total));
  };
  const manage = (path: string, init: { method?: string; body?: string; cookie?: string } = {}) => app.request(new Request(`http://admin.test/sites/${site.id}${path}`, {
    method: init.method || 'GET', body: init.body,
    headers: {
      host: 'admin.test', origin: 'http://admin.test', cookie: init.cookie ?? ownerCookie,
      ...(init.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
  }));
  return { site, app, analyticsStore, visit, click, totals, manage, editorCookie };
}

test('nothing is counted, and no script is added, until the owner turns analytics on', async () => {
  const r = await rig();
  const res = await r.visit('/acme/');
  a.equal(res.status, 200);
  a.doesNotMatch(await res.text(), /_pc\/a\//);
  a.equal((await r.click({ p: '/acme/', l: 'About', t: '/acme/about' })).status, 204);
  a.equal((await r.totals()).views, 0);
  a.equal((await r.totals()).clicks, 0);
});

test('views are counted by page, referrer and device, without repeats, signals or signed-in users', async () => {
  const r = await rig();
  await r.analyticsStore.setEnabled(r.site.id, true, 'owner');
  const home = await r.visit('/acme/', { referer: 'https://www.google.com/search?q=private', ip: '203.0.113.50' });
  a.match(await home.text(), new RegExp(`/_pc/a/${r.site.id}`), 'the click counter is in the page');
  await r.visit('/acme/', { referer: 'https://www.google.com/', ip: '203.0.113.50' }); // a reload
  await r.visit('/acme/about', { referer: 'http://admin.test/acme/' });             // inside the site
  await r.visit('/acme/missing');
  const signal = await r.visit('/acme/', { 'sec-gpc': '1' });
  a.doesNotMatch(await signal.text(), /_pc\/a\//, 'a visit that is not counted gets no click counter');
  const signedIn = await r.visit('/acme/', { cookie: 'pc_session=abc' });
  a.doesNotMatch(await signedIn.text(), /_pc\/a\//, 'nor does a signed-in Pagecraft user');
  await r.visit('/acme/', { 'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0)' });
  const totals = await r.totals();
  a.equal(totals.views, 3);
  a.deepEqual(totals.pages, { '/': 1, '/about': 1, [NOT_FOUND]: 1 });
  a.deepEqual(totals.referrers, { 'google.com': 1, [DIRECT]: 1 });
  a.deepEqual(totals.devices, { desktop: 3 });
});

test('clicks are counted only for a real page of this site, and the endpoint never says why', async () => {
  const r = await rig();
  await r.analyticsStore.setEnabled(r.site.id, true, 'owner');
  for (const body of [
    { p: '/acme/about', l: '  Book   now ', t: '/acme/book?x=1' },
    { p: '/acme/about', l: 'Email us', t: 'mailto:' },
    { p: '/acme/not-a-page', l: 'Ghost', t: '' },
    { p: '/other/', l: 'Elsewhere', t: '' },
    { p: 'http://[', l: 'Broken', t: '' }, // not a URL at all: still 204, never a 500
    'not json',
  ]) a.equal((await r.click(body)).status, 204);
  a.equal((await r.click({ p: '/acme/about', l: 'Wrong site', t: '' }, 'another-site')).status, 204);
  a.equal((await r.click('x'.repeat(2000))).status, 413);
  const totals = await r.totals();
  a.equal(totals.clicks, 2);
  a.deepEqual(totals.actions, { 'Book now\t/acme/book': 1, 'Email us\tmailto:': 1 });
});

test('an accepted form submission counts once, however often the browser retries it', async () => {
  const r = await rig();
  await r.analyticsStore.setEnabled(r.site.id, true, 'owner');
  const submit = (body: string) => r.app.request(new Request(`http://admin.test/forms/${r.site.id}/contact`, {
    method: 'POST', body, headers: { host: 'admin.test', origin: 'null', 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.8' },
  }));
  const request = '_pc_request=12345678-1234-4123-8123-123456789abc&email=visitor@example.test';
  a.equal((await submit(request)).status, 303);
  a.equal((await submit(request)).status, 303);
  a.equal((await submit('email=not-an-address')).status, 422);
  const totals = await r.totals();
  a.equal(totals.forms, 1);
  a.deepEqual(totals.formIds, { contact: 1 });
});

test('owners turn analytics on and off, read the numbers, download them and delete them', async () => {
  const r = await rig();
  const off = await r.manage('/analytics');
  a.equal(off.status, 200);
  const offHtml = await off.text();
  a.match(offHtml, /Analytics is off/);
  a.match(offHtml, /href="\/sites\/[^"]+\/analytics" aria-current="page"/, 'the rail marks the page');
  a.equal((await r.manage('/analytics', { cookie: r.editorCookie })).status, 403, 'owners only');
  a.equal((await r.manage('/analytics', { cookie: '' })).status, 302);

  a.match(offHtml, /name="timeZone" value="" data-browser-tz/, 'the browser sends the owner’s time zone');
  const on = await r.manage('/analytics/enable', { method: 'POST', body: 'timeZone=Europe%2FLondon' });
  a.equal(on.status, 303);
  a.equal((await r.analyticsStore.settings(r.site.id)).enabled, true);
  a.equal((await r.analyticsStore.settings(r.site.id)).timeZone, 'Europe/London');
  a.match((await r.manage('/analytics/timezone', { method: 'POST', body: 'timeZone=Nowhere%2FLand' })).headers.get('location') || '', /error=analytics_timezone/);
  a.equal((await r.manage('/analytics/timezone', { method: 'POST', body: 'timeZone=UTC' })).status, 303);
  a.equal((await r.analyticsStore.settings(r.site.id)).timeZone, 'UTC');

  await r.visit('/acme/', { referer: 'https://news.example/story' });
  await r.visit('/acme/about');
  await r.click({ p: '/acme/about', l: '<img src=x onerror=alert(1)>', t: '/acme/book' });
  const page = await (await r.manage('/analytics?range=7d')).text();
  a.match(page, /Page views by day/);
  a.match(page, /news\.example/);
  a.match(page, /&lt;img src=x onerror=alert\(1\)&gt;/, 'a visitor-supplied label is escaped');
  a.doesNotMatch(page, /<img src=x/);
  a.match(page, /aria-current="page">7 days</);

  const csv = await r.manage('/analytics.csv?range=7d');
  a.equal(csv.headers.get('content-type'), 'text/csv; charset=utf-8');
  a.match(csv.headers.get('content-disposition') || '', /acme-analytics-7d\.csv/);
  const text = await csv.text();
  a.match(text, /^time,metric,key,count\r\n/);
  a.match(text, /T\d{2}:00Z,views,,2\r\n/);
  a.match(text, /,referrer,news\.example,1\r\n/);

  a.equal((await r.manage('/analytics/disable', { method: 'POST', body: '' })).status, 303);
  a.match(await (await r.manage('/analytics')).text(), /Paused/, 'the numbers stay while paused');

  const refused = await r.manage('/analytics/delete', { method: 'POST', body: 'confirmed=no' });
  a.match(refused.headers.get('location') || '', /error=analytics_confirm/);
  a.equal((await r.totals()).views, 2);
  a.equal((await r.manage('/analytics/delete', { method: 'POST', body: 'confirmed=yes' })).status, 303);
  a.equal((await r.totals()).views, 0);
  a.match(await (await r.manage('/analytics')).text(), /Analytics is off/);
});
