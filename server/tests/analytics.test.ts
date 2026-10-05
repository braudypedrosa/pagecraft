import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AnalyticsRecorder, DIRECT, FileAnalyticsStore, NOT_FOUND, OTHER, change, cleanTarget, csvRows, deviceOf, excluded,
  localParts, rangeDays, referrerOf, sumBuckets, toCsv, validTimeZone, withClickScript, emptyBucket,
} from '../src/analytics.ts';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const headers = (h: Record<string, string>) => (name: string) => h[name];
const visitor = (extra: Record<string, string> = {}, source = '203.0.113.7') =>
  ({ header: headers({ 'user-agent': CHROME, ...extra }), source, host: 'acme.test' });

const dirs: string[] = [];
async function tempRoot() {
  const dir = await mkdtemp(join(tmpdir(), 'pc-analytics-'));
  dirs.push(dir);
  return dir;
}
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

/** A store and recorder on a clock the test moves. */
async function rig(root?: string, processId = 'p1') {
  const clock = { at: Date.parse('2026-10-02T09:15:00Z') };
  const now = () => new Date(clock.at);
  const store = new FileAnalyticsStore(root || await tempRoot(), { now, processId });
  const recorder = new AnalyticsRecorder(store, { now });
  return { clock, store, recorder };
}

test('what is not counted: privacy signals, prefetches, bots and signed-in Pagecraft users', () => {
  a.equal(excluded(headers({ 'user-agent': CHROME })), null);
  a.equal(excluded(headers({ 'user-agent': CHROME, 'sec-gpc': '1' })), 'privacy-signal');
  a.equal(excluded(headers({ 'user-agent': CHROME, dnt: '1' })), 'privacy-signal');
  a.equal(excluded(headers({ 'user-agent': CHROME, 'sec-purpose': 'prefetch;prerender' })), 'prefetch');
  for (const ua of ['', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'curl/8.4.0', 'facebookexternalhit/1.1', 'python-requests/2.31']) {
    a.equal(excluded(headers({ 'user-agent': ua })), 'bot', ua);
  }
  a.equal(excluded(headers({ 'user-agent': CHROME, cookie: 'theme=dark; pc_session=abc' })), 'signed-in');
});

test('devices, referrers and click targets keep only coarse, owner-meaningful values', () => {
  a.equal(deviceOf(CHROME), 'desktop');
  a.equal(deviceOf(IPHONE), 'mobile');
  a.equal(deviceOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36'), 'mobile');
  a.equal(deviceOf('Mozilla/5.0 (Linux; Android 13; SM-X710) Safari/537.36'), 'tablet');
  a.equal(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');

  a.equal(referrerOf(undefined, { host: 'acme.test' }), DIRECT);
  a.equal(referrerOf('https://www.Google.com/search?q=secret', { host: 'acme.test' }), 'google.com');
  a.equal(referrerOf('https://acme.test/about', { host: 'acme.test' }), null, 'a link inside the site');
  a.equal(referrerOf('not a url', { host: 'acme.test' }), DIRECT);
  // On the shared editor host only the site's own slug is internal.
  a.equal(referrerOf('https://build.test/acme/pricing', { host: 'build.test', prefix: 'acme' }), null);
  a.equal(referrerOf('https://build.test/other-site/', { host: 'build.test', prefix: 'acme' }), 'build.test');

  a.equal(cleanTarget('mailto:someone@example.com'), 'mailto:', 'never the address');
  a.equal(cleanTarget('tel:+15551234'), 'tel:');
  a.equal(cleanTarget('/pricing?plan=pro#faq'), '/pricing');
  a.equal(cleanTarget('WWW.Example.com/path'), 'example.com');
});

test('a reload within half an hour is one view; a different page or a later visit is another', async () => {
  const { clock, recorder } = await rig();
  a.equal(recorder.view('s1', '/', visitor()), true);
  a.equal(recorder.view('s1', '/', visitor()), false, 'the same reload');
  a.equal(recorder.view('s1', '/pricing', visitor()), true);
  a.equal(recorder.view('s1', '/', visitor({}, '198.51.100.2')), true, 'someone else');
  a.equal(recorder.view('s1', '/', visitor({ 'sec-gpc': '1' }, '198.51.100.9')), false);
  clock.at += 31 * 60_000;
  a.equal(recorder.view('s1', '/', visitor()), true, 'a later visit counts again');

  a.equal(recorder.click('s1', { label: '  Book   now ', target: '/book' }, visitor()), true);
  a.equal(recorder.click('s1', { label: 'Book now', target: '/book' }, visitor()), false, 'a double click');
  clock.at += 31_000;
  a.equal(recorder.click('s1', { label: 'Book now', target: '/book' }, visitor()), true);
  recorder.form('s1', 'contact');
});

test('counts reach disk per process, two processes add up, and nothing is counted twice', async () => {
  const root = await tempRoot();
  const one = await rig(root, 'p1');
  const two = await rig(root, 'p2');
  one.recorder.view('s1', '/', visitor({ referer: 'https://news.example/' }));
  one.recorder.view('s1', '/about', visitor());
  two.recorder.view('s1', '/', visitor({ 'user-agent': IPHONE }, '198.51.100.2'));
  two.recorder.click('s1', { label: 'Call us', target: 'tel:' }, visitor());
  two.recorder.form('s1', 'contact');
  await Promise.all([one.recorder.flush(), two.recorder.flush()]);
  // A second flush with nothing new writes nothing new.
  await one.recorder.flush();

  const days = await one.store.read('s1', '2026-10-01', '2026-10-02');
  a.deepEqual(days.map(d => d.day), ['2026-10-01', '2026-10-02']);
  const total = sumBuckets(days.map(d => d.total));
  a.equal(total.views, 3);
  a.deepEqual(total.pages, { '/': 2, '/about': 1 });
  a.deepEqual(total.referrers, { 'news.example': 1, [DIRECT]: 2 });
  a.deepEqual(total.devices, { desktop: 2, mobile: 1 });
  a.deepEqual(total.actions, { 'Call us\ttel:': 1 });
  a.deepEqual(total.formIds, { contact: 1 });
  a.equal(days[1].hours!['2026-10-02T09:00Z'].views, 3, 'hours are kept, by local time with its offset');
});

test('finished days merge into one file and the month, then expire on schedule', async () => {
  const { clock, store, recorder } = await rig();
  recorder.view('s1', '/', visitor());
  recorder.view('s1', NOT_FOUND, visitor());
  await recorder.flush();

  // Two days later the day is settled: one merged file, and the month has its total.
  clock.at = Date.parse('2026-10-04T12:00:00Z');
  await store.compact('s1', true);
  const files = await readdir(join(store.dir('s1'), 'hours'));
  a.deepEqual(files, ['2026-10-02.json']);
  const merged = await store.read('s1', '2026-10-02', '2026-10-02');
  a.equal(merged[0].total.views, 2);
  await store.compact('s1', true);
  a.equal((await store.read('s1', '2026-10-02', '2026-10-02'))[0].total.views, 2, 'merging twice changes nothing');

  // After 90 days the hourly detail is gone and the daily total remains.
  clock.at = Date.parse('2027-01-05T12:00:00Z');
  await store.compact('s1', true);
  a.deepEqual(await readdir(join(store.dir('s1'), 'hours')), []);
  const daily = await store.read('s1', '2026-10-02', '2026-10-02');
  a.equal(daily[0].total.views, 2);
  a.equal(daily[0].hours, null);

  // After 13 months the daily total goes too.
  clock.at = Date.parse('2027-12-01T12:00:00Z');
  await store.compact('s1', true);
  a.equal((await store.read('s1', '2026-10-02', '2026-10-02'))[0].total.views, 0);
});

test('an hour keeps at most 200 pages; the rest fold into Other', async () => {
  const { recorder, store } = await rig();
  for (let i = 0; i < 205; i++) recorder.view('s1', `/p${i}`, visitor({}, `198.51.100.${i % 250}`));
  await recorder.flush();
  const [day] = await store.read('s1', '2026-10-02', '2026-10-02');
  a.equal(Object.keys(day.total.pages).length, 201);
  a.equal(day.total.pages[OTHER], 5);
  a.equal(day.total.views, 205);
});

test('settings default to off, switch, and deleting removes every number', async () => {
  const { store, recorder } = await rig();
  a.equal((await store.settings('s1')).enabled, false);
  await store.setEnabled('s1', true, 'u1');
  a.equal(await recorder.enabled('s1'), true);
  recorder.view('s1', '/', visitor());
  await recorder.flush();
  await store.remove('s1');
  a.equal((await store.settings('s1')).enabled, false);
  a.equal((await store.read('s1', '2026-10-02', '2026-10-02'))[0].total.views, 0);
});

test('ranges, comparisons and the CSV export', () => {
  const now = new Date('2026-10-02T09:00:00Z');
  a.deepEqual(rangeDays('7d', now), { from: '2026-09-26', to: '2026-10-02', previous: { from: '2026-09-19', to: '2026-09-25' } });
  a.equal(change(120, 100), 0.2);
  a.equal(change(5, 0), null);

  const bucket = { ...emptyBucket(), views: 3, clicks: 1, pages: { '/': 3 }, devices: { mobile: 1, desktop: 2 }, actions: { '=HYPERLINK("x")\t/go': 1 }, formIds: { f1: 2 }, forms: 2 };
  const csv = toCsv([{ time: '2026-10-02', bucket }], id => (id === 'f1' ? 'Contact, main' : id));
  a.match(csv, /^time,metric,key,count\r\n/);
  a.match(csv, /2026-10-02,views,,3\r\n/);
  a.match(csv, /2026-10-02,device,mobile,1\r\n/);
  a.match(csv, /2026-10-02,form,"Contact, main",2\r\n/);
  a.match(csv, /2026-10-02,click,"'=HYPERLINK\(""x""\) → \/go",1\r\n/, 'a formula-looking label is defused');
});

test('the click counter goes just before </body> and posts to the site’s own endpoint', () => {
  const html = withClickScript('<html><body><p>Hi</p></body></html>', 'site-1');
  a.match(html, /<p>Hi<\/p><script>.*\/_pc\/a\/site-1.*<\/script><\/body>/s);
  a.doesNotMatch(html, /cookie|localStorage|sessionStorage/);
});

test('on SIGTERM the counts are flushed and the signal raised again, so the process still exits', async () => {
  const { recorder, store } = await rig();
  const before = process.listeners('SIGTERM');
  const raised: string[] = [];
  recorder.start({ raise: signal => { raised.push(signal); } });
  const added = process.listeners('SIGTERM').filter(l => !before.includes(l));
  a.equal(added.length, 1);
  try {
    recorder.view('s1', '/', visitor());
    (added[0] as () => void)();
    await new Promise(resolve => setTimeout(resolve, 50));
    a.deepEqual(raised, ['SIGTERM'], 'the default exit still happens');
    a.equal((await store.read('s1', '2026-10-02', '2026-10-02'))[0].total.views, 1, 'counted before exiting');
  } finally {
    for (const l of added) process.removeListener('SIGTERM', l as () => void);
    recorder.stop();
  }
});

test('days follow the site’s time zone: an evening in UTC is the next morning in Manila', async () => {
  const { clock, store, recorder } = await rig();
  a.equal(validTimeZone('asia/manila'), 'Asia/Manila', 'canonicalised');
  a.equal(validTimeZone('Mars/Olympus'), null);
  a.deepEqual(localParts(Date.parse('2026-10-02T20:30:00Z'), 'Asia/Manila'), { day: '2026-10-03', hour: '04', minute: '30', offset: '+08:00' });
  a.deepEqual(rangeDays('7d', new Date('2026-10-02T20:30:00Z'), 'Asia/Manila').to, '2026-10-03');

  clock.at = Date.parse('2026-10-02T09:15:00Z'); // 17:15 in Manila, same day
  recorder.view('s1', '/', visitor());
  clock.at = Date.parse('2026-10-02T20:15:00Z'); // 04:15 the next morning in Manila
  recorder.view('s1', '/', visitor({}, '198.51.100.3'));
  await recorder.flush();

  const utc = await store.read('s1', '2026-10-02', '2026-10-03');
  a.deepEqual(utc.map(d => d.total.views), [2, 0]);
  const manila = await store.read('s1', '2026-10-02', '2026-10-03', 'Asia/Manila');
  a.deepEqual(manila.map(d => d.total.views), [1, 1]);
  a.deepEqual(Object.keys(manila[1].hours!), ['2026-10-03T04:00+08:00']);
  a.match(toCsv(csvRows(manila)), /2026-10-03T04:00\+08:00,views,,1/);

  // Once merged, daily totals are filed under the site's local days.
  await store.setTimeZone('s1', 'Asia/Manila', 'u1');
  clock.at = Date.parse('2027-01-10T12:00:00Z');
  await store.compact('s1', true);
  const later = await store.read('s1', '2026-10-02', '2026-10-03', 'Asia/Manila');
  a.deepEqual(later.map(d => [d.total.views, d.hours]), [[1, null], [1, null]]);
  a.equal((await store.settings('s1')).timeZone, 'Asia/Manila');
});

const keys = (map: Record<string, number>) => Object.keys(map).length;
const stored = async (file: string) => JSON.parse(await readFile(file, 'utf8'));

test('stored hours, days and months keep the caps, however many flushes and processes add to them', async () => {
  const root = await tempRoot();
  const one = await rig(root, 'p1'), two = await rig(root, 'p2');
  // Each flush is under the caps on its own; together they are well over.
  for (const [r, from] of [[one, 0], [one, 150], [two, 300]] as const) {
    for (let i = from; i < from + 150; i++) {
      r.recorder.view('s1', `/p${i}`, visitor({ referer: `https://r${i}.example/` }, `198.51.100.${i % 250}`));
      r.recorder.click('s1', { label: `Label ${i}`, target: '/go' }, visitor({}, `203.0.113.${i % 250}`));
    }
    await r.recorder.flush();
  }
  const own = (await stored(join(one.store.dir('s1'), 'hours', '2026-10-02.p1.json'))).hours['09'];
  a.deepEqual([keys(own.pages), keys(own.referrers), keys(own.actions)], [201, 101, 201]);
  a.equal(own.pages[OTHER], 100);
  a.equal(own.views, 300, 'nothing is lost, only folded');

  const [day] = await one.store.read('s1', '2026-10-02', '2026-10-02');
  a.equal(day.total.views, 450);
  a.deepEqual([keys(day.total.pages), keys(day.total.referrers), keys(day.total.actions)], [201, 101, 201]);

  one.clock.at = Date.parse('2026-10-04T12:00:00Z');
  await one.store.compact('s1', true);
  const merged = (await stored(join(one.store.dir('s1'), 'hours', '2026-10-02.json'))).hours['09'];
  const month = (await stored(join(one.store.dir('s1'), 'days', '2026-10.json'))).days['02'];
  for (const bucket of [merged, month]) {
    a.deepEqual([keys(bucket.pages), keys(bucket.referrers), keys(bucket.actions)], [201, 101, 201]);
    a.equal(bucket.views, 450);
  }
});

test('deleted numbers stay deleted when another process writes back what it still held', async () => {
  const root = await tempRoot();
  const one = await rig(root, 'p1'), two = await rig(root, 'p2');
  two.recorder.view('s1', '/', visitor());
  await two.recorder.flush(); // p2 now holds today's whole day, and has the settings cached
  two.recorder.view('s1', '/about', visitor());
  await one.store.remove('s1');
  const settings = await one.store.settings('s1');
  a.equal(settings.enabled, false);
  a.equal(settings.resetAt, '2026-10-02T09:15:00.000Z');

  // Within its 10-second cache p2 still writes the old day back; nobody counts it.
  await two.recorder.flush();
  a.deepEqual(await readdir(join(one.store.dir('s1'), 'hours')), ['2026-10-02.p2.json']);
  a.equal((await one.store.read('s1', '2026-10-02', '2026-10-02'))[0].total.views, 0);
  one.clock.at = Date.parse('2026-10-04T12:00:00Z');
  await one.store.compact('s1', true);
  a.deepEqual(await readdir(join(one.store.dir('s1'), 'hours')), ['2026-10-02.json'], 'dropped, not merged');
  a.equal((await one.store.read('s1', '2026-10-02', '2026-10-02'))[0].total.views, 0);
  a.equal((await one.store.read('s1', '2026-10-02', '2026-10-02', 'Asia/Manila'))[0].total.views, 0);
});

test('a process that learns of a delete drops what it held and counts only what comes after', async () => {
  const root = await tempRoot();
  const one = await rig(root, 'p1'), two = await rig(root, 'p2');
  two.recorder.view('s1', '/', visitor());
  await two.recorder.flush();
  two.recorder.view('s1', '/about', visitor());   // buffered before the delete
  await one.store.remove('s1');
  await two.store.resetAt('s1');                   // p2's settings cache has expired
  await two.recorder.flush();
  a.deepEqual(await readdir(join(one.store.dir('s1'), 'hours')).catch(() => []), [], 'nothing written back');

  await one.store.setEnabled('s1', true, 'u1');
  a.ok((await one.store.settings('s1')).resetAt, 'turning it back on keeps the reset');
  two.clock.at += 60_000;
  two.recorder.view('s1', '/new', visitor({}, '198.51.100.40'));
  await two.recorder.flush();
  const [day] = await one.store.read('s1', '2026-10-02', '2026-10-02');
  a.equal(day.total.views, 1);
  a.deepEqual(day.total.pages, { '/new': 1 });
});

test('half-hour time zones keep their minutes in hour labels and the CSV', async () => {
  const { store, recorder } = await rig();
  a.deepEqual(localParts(Date.parse('2026-10-02T00:00:00Z'), 'Asia/Kolkata'), { day: '2026-10-02', hour: '05', minute: '30', offset: '+05:30' });
  recorder.view('s1', '/', visitor()); // 09:15 UTC is 14:45 in Kolkata, in the hour from 14:30
  await recorder.flush();
  const days = await store.read('s1', '2026-10-02', '2026-10-02', 'Asia/Kolkata');
  a.deepEqual(Object.keys(days[0].hours!), ['2026-10-02T14:30+05:30']);
  a.match(toCsv(csvRows(days)), /\r\n2026-10-02T14:30\+05:30,views,,1\r\n/);
  a.match(toCsv(csvRows(await store.read('s1', '2026-10-02', '2026-10-02', 'Asia/Kathmandu'))), /2026-10-02T14:45\+05:45,views,,1/);
});

test('the local day straddling the 90-day boundary is read from its daily total, not its surviving hours', async () => {
  const { clock, store, recorder } = await rig();
  await store.setTimeZone('s1', 'Asia/Manila', 'u1');
  clock.at = Date.parse('2026-10-01T20:00:00Z'); // 04:00 on 2 October in Manila
  recorder.view('s1', '/', visitor());
  await recorder.flush();
  clock.at = Date.parse('2026-10-02T09:15:00Z'); // 17:15 the same Manila day
  recorder.view('s1', '/', visitor({}, '198.51.100.3'));
  await recorder.flush();

  // 90 days on, UTC 1 October's hours are retired and UTC 2 October's are kept.
  clock.at = Date.parse('2026-12-31T12:00:00Z');
  await store.compact('s1', true);
  a.deepEqual(await readdir(join(store.dir('s1'), 'hours')), ['2026-10-02.json']);
  const [straddling, next] = await store.read('s1', '2026-10-02', '2026-10-03', 'Asia/Manila');
  a.deepEqual([straddling.total.views, straddling.hours], [2, null]);
  a.deepEqual([next.total.views, next.hours], [0, {}], 'a whole day inside the window still reads by the hour');
});
