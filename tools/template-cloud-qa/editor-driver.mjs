/* Drives the real Pagecraft editor in headless Chrome with trusted mouse and keyboard input.
   Loopback QA host only (127.0.0.1:4951). Used for the template patch release editing exercises. */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const ORIGIN = 'http://127.0.0.1:4951';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function openBrowser({ width = 1600, height = 1000 } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'pc-driver-'));
  const child = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 200 && !port; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {} await sleep(50); }
  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let seq = 1; const waiting = new Map(); const events = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { const p = waiting.get(m.id); waiting.delete(m.id); m.error ? p.reject(new Error(`${p.method}: ${m.error.message}`)) : p.resolve(m.result); }
    else if (m.method) events.push(m);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = seq++; waiting.set(id, { resolve, reject, method }); ws.send(JSON.stringify({ id, method, params })); });
  for (const d of ['Page', 'Runtime', 'Log', 'Network']) await send(`${d}.enable`);
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.setLifecycleEventsEnabled', { enabled: true }).catch(() => {});
  // Accept window.confirm prompts the editor raises (none are destructive outside the disposable site).
  const dialogs = [];
  const b = {
    send, events, dialogs, version: (await send('Browser.getVersion')).product,
    async eval(fn, arg) {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(arg ?? null)})`, awaitPromise: true, returnByValue: true });
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
          return r.result.value;
        } catch (error) { if (attempt < 30 && /context|destroyed|Cannot find/i.test(error.message)) { await sleep(150); continue; } throw error; }
      }
    },
    async goto(url) {
      await send('Page.navigate', { url });
      for (let i = 0; i < 150; i++) { await sleep(100); if (await b.eval(() => document.readyState === 'complete').catch(() => false)) break; }
    },
    async editor(site) {
      await b.goto(`${ORIGIN}/edit/${site}`);
      for (let i = 0; i < 150; i++) {
        if (await b.eval(() => !!document.getElementById('canvas')?.contentDocument?.querySelector('[data-id]')).catch(() => false)) break;
        await sleep(100);
      }
      await sleep(800);
      await b.eval(() => { document.querySelector('[aria-label="Dismiss template guide"]')?.click(); });
    },
    async click(x, y, opts = {}) {
      const modifiers = opts.modifiers || 0, clickCount = opts.clickCount || 1;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers });
      for (let n = 1; n <= clickCount; n++) {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: n, modifiers });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: n, modifiers });
      }
      await sleep(opts.wait ?? 350);
    },
    /* Click an element of the editor chrome found by text, aria-label or title. */
    async button(name, opts = {}) {
      const box = await b.eval(({ name, within, exact }) => {
        const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && e.offsetParent !== null; };
        const root = within ? [...document.querySelectorAll(within)].filter(vis).pop() : document;
        if (!root) return null;
        const norm = s => (s || '').replace(/\s+/g, ' ').trim();
        const all = [...root.querySelectorAll('button,a,[role=button],[role=tab],[role=option],[role=menuitem],[role=combobox],summary')].filter(vis);
        const hit = all.find(e => [norm(e.getAttribute('aria-label')), norm(e.title), norm(e.textContent)].some(t => exact ? t === name : t === name || t.startsWith(name)));
        if (!hit) return null;
        hit.scrollIntoView({ block: 'center' }); const r = hit.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: hit.disabled };
      }, { name, within: opts.within, exact: opts.exact });
      if (!box) throw new Error(`No button "${name}"`);
      await b.click(box.x, box.y, opts);
      return box;
    },
    /* Open a custom select (hidden native <select aria-label> with a visible trigger beside it) and choose an option. */
    async choose(label, option) {
      const box = await b.eval(label => {
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && e.offsetParent !== null; };
        const sel = [...document.querySelectorAll('select')].find(s => s.getAttribute('aria-label') === label && (vis(s.parentElement) || vis(s)));
        const trigger = sel ? [...sel.parentElement.querySelectorAll('[role=combobox],button')].find(e => vis(e) && (sel.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) : [...document.querySelectorAll('[role=combobox]')].find(e => vis(e) && e.getAttribute('aria-label') === label);
        if (!trigger) return null;
        trigger.scrollIntoView({ block: 'center' }); const r = trigger.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, current: trigger.textContent.trim(), options: sel ? [...sel.options].map(o => o.textContent.trim()) : null };
      }, label);
      if (!box) throw new Error(`No select "${label}"`);
      await b.click(box.x, box.y, { wait: 400 });
      const options = await b.eval(() => [...document.querySelectorAll('[role=option]')].filter(e => e.offsetParent || e.getClientRects().length).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
      const want = typeof option === 'function' ? options.find(o => option(o, box.current)) : option;
      if (!want) { await b.key('Escape'); throw new Error(`No option for "${label}" among ${options.slice(0, 10).join(' / ')}`); }
      const at = await b.eval(want => { const o = [...document.querySelectorAll('[role=option]')].find(e => e.textContent.replace(/\s+/g, ' ').trim() === want); o.scrollIntoView({ block: 'center' }); const r = o.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, want);
      await b.click(at.x, at.y, { wait: 500 });
      return { from: box.current, to: want, options: options.slice(0, 12) };
    },
    /* Click visible text that is not a button (cards, labels). */
    async text(name) {
      const box = await b.eval(name => { const el = [...document.querySelectorAll('body *')].find(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() === name)); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, name);
      if (!box) throw new Error(`No text "${name}"`);
      await b.click(box.x, box.y);
    },
    async has(name, within) {
      return b.eval(({ name, within }) => {
        const root = within ? [...document.querySelectorAll(within)].filter(e => e.offsetParent).pop() : document;
        return !!root && [...root.querySelectorAll('button,a,[role=button],[role=tab],[role=option],[role=menuitem]')].some(e => e.offsetParent && [e.getAttribute('aria-label'), e.title, e.textContent].some(t => (t || '').replace(/\s+/g, ' ').trim().startsWith(name)));
      }, { name, within });
    },
    /* Click a canvas element (by data-id or a selector run inside the canvas document). */
    async canvas(target, opts = {}) {
      const box = await b.eval(target => {
        const fr = document.getElementById('canvas'); const d = fr.contentDocument;
        const el = target.startsWith('#') || target.includes('[') || target.includes(' ') || target.includes('.') ? d.querySelector(target) : d.querySelector(`[data-id="${target}"]`);
        if (!el) return null;
        // A section taller than the canvas scrolls its top out of view when centred; click inside the visible part.
        el.scrollIntoView({ block: 'center' });
        const R = fr.getBoundingClientRect(), s = R.width / fr.clientWidth, r = el.getBoundingClientRect();
        return { x: R.x + (r.x + Math.min(r.width / 2, 40)) * s, y: R.y + (Math.max(r.y, 0) + Math.min(r.height / 2, 20)) * s };
      }, target);
      if (!box) throw new Error(`No canvas element ${target}`);
      await sleep(250);
      const again = await b.eval(target => {
        const fr = document.getElementById('canvas'); const d = fr.contentDocument;
        const el = target.startsWith('#') || target.includes('[') || target.includes(' ') || target.includes('.') ? d.querySelector(target) : d.querySelector(`[data-id="${target}"]`);
        const R = fr.getBoundingClientRect(), s = R.width / fr.clientWidth, r = el.getBoundingClientRect();
        return { x: R.x + (r.x + Math.min(r.width / 2, 40)) * s, y: R.y + (Math.max(r.y, 0) + Math.min(r.height / 2, 20)) * s };
      }, target);
      await b.click(again.x, again.y, opts);
    },
    /* Select exactly this canvas element: click it, then climb with "Select parent" while a child is selected. */
    async selected() { return b.canvasEval(d => d.querySelector('[data-sel]')?.dataset.id || null); },
    async select(id) {
      await b.canvas(id); await sleep(250);
      for (let i = 0; i < 8; i++) {
        const now = await b.selected();
        if (now === id) return id;
        const inside = await b.canvasEval((d, [id, now]) => !!now && !!d.querySelector(`[data-id="${id}"] [data-id="${now}"]`), [id, now]);
        if (!inside) throw new Error(`Selecting ${id} selected ${now}`);
        await b.button('Select parent (esc)'); await sleep(250);
      }
      throw new Error(`Could not select ${id}`);
    },
    /* Set an inspector field found by aria-label (or placeholder/value match) through real typing. */
    async field(label, value, opts = {}) {
      const box = await b.eval(({ label, within }) => {
        const root = within ? [...document.querySelectorAll(within)].filter(e => e.offsetParent).pop() : document;
        const el = [...root.querySelectorAll('input,textarea')].find(e => e.offsetParent && (e.getAttribute('aria-label') === label || e.placeholder === label || e.dataset.qa === label));
        if (!el) return null;
        el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
        return { x: r.x + Math.min(r.width / 2, 60), y: r.y + Math.min(r.height / 2, 12) };
      }, { label, within: opts.within });
      if (!box) throw new Error(`No field "${label}"`);
      await b.click(box.x, box.y, { wait: 120 });
      await b.selectAll();
      await send('Input.insertText', { text: String(value) });
      await sleep(150);
      if (opts.commit !== false) await b.key(opts.commit || 'Enter');
      await sleep(opts.wait ?? 400);
    },
    /* Select the focused field's whole value (headless macOS ignores ⌘A without an edit command). */
    async selectAll() { await b.eval(() => { const e = document.activeElement; if (e && 'select' in e) e.select(); }); await sleep(60); },
    async key(key, modifiers = 0) {
      const codes = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, a: 65, d: 68, z: 90, c: 67, v: 86, s: 83 };
      const text = key.length === 1 && !(modifiers & (2 | 4)) ? key : undefined;
      const base = { key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key, windowsVirtualKeyCode: codes[key], modifiers };
      await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, text });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      await sleep(120);
    },
    async inspector() {
      return b.eval(() => [...document.querySelectorAll('button,input,textarea,[role=combobox]')].filter(e => e.offsetParent && e.getBoundingClientRect().x > innerWidth - 380 && e.getBoundingClientRect().y > 60)
        .map(e => `${e.tagName.toLowerCase()}|${e.getAttribute('aria-label') || ''}|${e.title || ''}|${(e.value ?? '') || (e.textContent || '').trim().slice(0, 30)}`));
    },
    async status() { return b.eval(() => [...document.querySelectorAll('body *')].filter(e => !e.childElementCount && e.getBoundingClientRect().top < 56 && e.getBoundingClientRect().height > 0).map(e => e.textContent.trim()).filter(t => /^(Draft|Saving|Saved|Unsaved|Changes)/i.test(t)).slice(0, 3).join(' | ')); },
    async saved(ms = 12000) {
      const start = Date.now();
      await sleep(600);
      while (Date.now() - start < ms) {
        const s = await b.status();
        if (/Draft (saved|ready)/i.test(s) && !/Saving|Unsaved/i.test(s)) return s;
        await sleep(250);
      }
      throw new Error('Draft did not save: ' + await b.status());
    },
    async canvasEval(fn, arg) { return b.eval(`(arg) => { const d = document.getElementById('canvas').contentDocument; return (${fn})(d, arg); }`, arg); },
    async screenshot(path, clip) { const { writeFile } = await import('node:fs/promises'); const s = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); await writeFile(path, Buffer.from(s.data, 'base64')); },
    async close() { ws.close(); child.kill('SIGTERM'); await sleep(300); await rm(profile, { recursive: true, force: true }); },
  };
  return b;
}

export async function as(templateId) { await fetch(`${ORIGIN}/qa/template/${templateId}`, { redirect: 'manual' }); }
export async function api(path, init) { const r = await fetch(ORIGIN + path, init); return r.headers.get('content-type')?.includes('json') ? r.json() : r.text(); }
