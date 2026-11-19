/* Cloud QA matrix for the four patch drafts: every published page at 390/768/1024/1440 in headless
   Chrome against the local template-candidate-qa host (127.0.0.1:4951). Writes one JSON record
   per template plus full-page JPEG captures for the rendered review.
   node cloud-matrix.mjs <outDir> <slug>:<page,page,...> ... */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = 'http://127.0.0.1:4951';
const WIDTHS = [390, 768, 1024, 1440];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [outDir, ...specs] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });

const profile = await mkdtemp(join(tmpdir(), 'pc-matrix-'));
const child = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let port;
for (let i = 0; i < 200 && !port; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {} await sleep(50); }
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 1; const waiting = new Map(); const events = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const p = waiting.get(m.id); waiting.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  else if (m.method) events.push(m);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = seq++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (fn, arg) => {
  const r = await send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(arg ?? null)})`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
for (const d of ['Page', 'Runtime', 'Log', 'Network']) await send(`${d}.enable`);
const version = (await send('Browser.getVersion')).product;

async function load(url, width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  events.length = 0;
  await send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { if (await evaluate(() => document.readyState === 'complete').catch(() => false)) break; await sleep(100); }
  // Walk the page so lazy images load, then wait for every image to settle.
  await evaluate(async () => {
    const step = innerHeight * .8;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    scrollTo(0, 0);
    await Promise.all([...document.images].map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 5000); })));
    await document.fonts.ready;
  });
  await sleep(250);
}

/* Everything measured in the page. */
const MEASURE = () => {
  const W = innerWidth, out = {};
  const visible = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 0 && r.height > 0; };
  const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  // text-floor: smallest rendered size of visible text.
  const small = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let minFont = 99;
  for (let n; (n = walker.nextNode());) {
    const t = n.textContent.trim(); const el = n.parentElement;
    if (!t || !el || !visible(el) || el.closest('[aria-hidden=true],script,style,noscript')) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    minFont = Math.min(minFont, size);
    if (size < 12) small.push({ el: label(el), size, text: t.slice(0, 40) });
  }
  out.textFloor = { minFont, small };
  // overflow: page width and elements poking past the viewport (unless clipped by an ancestor).
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/hidden|clip|auto|scroll/.test(o.overflowX)) return true; } return false; };
  const over = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue; const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== 'fixed') over.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) });
  }
  out.overflow = { scrollWidth: document.documentElement.scrollWidth, width: W, elements: over.slice(0, 10) };
  // containers: text cut off by its own box, or squeezed into very narrow columns.
  const cut = [], squeezed = [];
  for (const el of document.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,a,button,label,span,figcaption,summary,td,th,dt,dd')) {
    if (!visible(el)) continue; const s = getComputedStyle(el);
    if (/hidden|clip/.test(s.overflow) && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && s.textOverflow !== 'ellipsis' && el.textContent.trim()) cut.push({ el: label(el), text: el.textContent.trim().slice(0, 40) });
    const r = el.getBoundingClientRect();
    if (/^(P|LI|H[1-6])$/.test(el.tagName) && el.textContent.trim().length > 40 && r.width < 140) squeezed.push({ el: label(el), width: Math.round(r.width) });
  }
  out.containers = { cut, squeezed };
  // image-crops: loaded, not distorted (fill with a different aspect), alt present.
  const images = [...document.images].filter(visible);
  out.images = {
    count: images.length,
    broken: images.filter(i => !i.complete || !i.naturalWidth).map(i => i.currentSrc || i.src),
    distorted: images.filter(i => { const s = getComputedStyle(i); if (!/fill/.test(s.objectFit) || !i.naturalWidth) return false; const r = i.getBoundingClientRect(); return Math.abs(r.width / r.height - i.naturalWidth / i.naturalHeight) > .03 * (i.naturalWidth / i.naturalHeight); }).map(i => i.currentSrc || i.src),
    noAlt: images.filter(i => !i.hasAttribute('alt')).map(i => i.currentSrc || i.src),
    fits: [...new Set(images.map(i => getComputedStyle(i).objectFit))],
    lazyAboveFold: images.filter(i => i.loading === 'lazy' && i.getBoundingClientRect().top < innerHeight).length,
    noSize: images.filter(i => !i.getAttribute('width') || !i.getAttribute('height')).length,
  };
  // responsive-hierarchy: one H1, no skipped levels, H1 at least as large as any other heading.
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
  const levels = hs.map(h => +h.tagName[1]); const skips = [];
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) skips.push(`${hs[i - 1].tagName}→${hs[i].tagName} "${hs[i].textContent.trim().slice(0, 30)}"`);
  const h1 = hs.filter(h => h.tagName === 'H1');
  const h1Size = h1[0] ? parseFloat(getComputedStyle(h1[0]).fontSize) : 0;
  const bigger = hs.filter(h => h.tagName !== 'H1' && parseFloat(getComputedStyle(h).fontSize) > h1Size + .5).map(h => `${h.tagName} ${parseFloat(getComputedStyle(h).fontSize)}px > H1 ${h1Size}px`);
  out.hierarchy = { h1: h1.length, h1Size, firstLevel: levels[0], skips, bigger, height: document.documentElement.scrollHeight };
  // Interactive bits used by the keyboard and menu checks.
  out.title = document.title; out.lang = document.documentElement.lang;
  return out;
};

/* keyboard: Tab through the page; each stop must be visible, on screen and show focus. */
async function keyboard() {
  await evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
  const stops = [], problems = [];
  const total = await evaluate(() => document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])').length);
  for (let i = 0; i < Math.min(total + 2, 60); i++) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await sleep(30);
    const probe = () => evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
      const first = el === document.querySelector('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])');
      return { first, tag: el.tagName.toLowerCase(), name: (el.getAttribute('aria-label') || el.textContent || el.name || '').trim().slice(0, 30),
        visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', onScreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, ring, focusVisible: el.matches(':focus-visible') };
    });
    let s = await probe();
    // A focus style that slides in (skip links) is sampled again once its transition ends.
    if (s && (!s.onScreen || !s.ring)) { await sleep(250); s = await probe(); }
    if (!s) break;
    if (stops.length && s.first) break;
    stops.push(s);
    if (!s.visible || !s.onScreen || !s.ring) problems.push(s);
  }
  return { stops: stops.length, problems };
}

/* mobile-menu: when the header collapses its navigation, the toggle must open it and expose links. */
async function mobileMenu() {
  const found = await evaluate(() => {
    const header = document.querySelector('header') || document.body;
    const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const toggle = [...header.querySelectorAll('button[aria-expanded],summary,[aria-controls]')].find(vis);
    const navLinks = [...header.querySelectorAll('nav a')];
    return { hasToggle: !!toggle, linksVisible: navLinks.filter(vis).length, links: navLinks.length };
  });
  if (!found.hasToggle) return { ...found, collapsed: false };
  const box = await evaluate(() => { const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const t = [...(document.querySelector('header') || document.body).querySelectorAll('button[aria-expanded],summary,[aria-controls]')].find(vis); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: (t.getAttribute('aria-label') || t.textContent).trim() }; });
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await sleep(350);
  const after = await evaluate(() => { const header = document.querySelector('header') || document.body; const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; }; const t = header.querySelector('button[aria-expanded]'); return { linksVisible: [...header.querySelectorAll('nav a')].filter(vis).length, expanded: t?.getAttribute('aria-expanded') ?? null }; });
  return { ...found, collapsed: found.linksVisible === 0, toggle: box.label, opened: after.linksVisible, expanded: after.expanded };
}

const results = [];
for (const spec of specs) {
  const [slug, pageList] = spec.split(':');
  const record = { slug, chrome: version, origin: ORIGIN, pages: [] };
  for (const pageSlug of pageList.split(',')) for (const width of WIDTHS) {
    const url = `${ORIGIN}/${slug}/${pageSlug === 'index' ? '' : pageSlug}`;
    await load(url, width);
    const m = await evaluate(MEASURE);
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 62, captureBeyondViewport: true });
    const file = `${pageSlug}-${width}.jpg`;
    await writeFile(join(outDir, slug + '--' + file), Buffer.from(shot.data, 'base64'));
    const kb = await keyboard();
    await load(url, width);
    const menu = await mobileMenu();
    const consoleErrors = events.filter(e => (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') || e.method === 'Runtime.exceptionThrown')
      .map(e => e.params.entry?.text || e.params.args?.map(a => a.value).join(' ') || e.params.exceptionDetails?.text);
    const failed = events.filter(e => e.method === 'Network.responseReceived' && e.params.response.status >= 400).map(e => `${e.params.response.status} ${e.params.response.url}`);
    results.push(`${slug} ${pageSlug} ${width}`);
    record.pages.push({ page: pageSlug, width, url, ...m, keyboard: kb, menu, console: { errors: consoleErrors, failedRequests: failed }, capture: file });
    process.stdout.write('.');
  }
  await writeFile(join(outDir, slug + '.json'), JSON.stringify(record, null, 1));
  console.log(`\n${slug}: ${record.pages.length} page/width records`);
}
ws.close(); child.kill('SIGTERM'); await sleep(300); await rm(profile, { recursive: true, force: true });
