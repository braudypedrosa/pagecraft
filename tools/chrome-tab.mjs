/** A headless Google Chrome tab that offers the small surface the gallery helpers use:
 * `capabilities.get('cdp').send`, `playwright.evaluate/getByRole/locator`, and `pressKey`.
 * It drives Chrome over the DevTools protocol with Node's own WebSocket, so nothing is
 * downloaded and no browser profile of the user's is touched: every run gets a throwaway
 * profile that is deleted afterwards. */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CHROME_BROWSER_LABEL = 'Headless Chrome';
const CHROME = process.env.PAGECRAFT_CHROME
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(done => setTimeout(done, ms));

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.next = 1;
    this.waiting = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const pending = message.id && this.waiting.get(message.id);
      if (!pending) return;
      this.waiting.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function devtoolsPort(profile, child) {
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null) throw new Error(`Chrome exited early (${child.exitCode}).`);
    try {
      const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      if (port) return Number(port);
    } catch {}
    await sleep(50);
  }
  throw new Error('Chrome did not open a DevTools port.');
}

/* An accessible-name lookup close enough for the gallery's own controls: exact, whitespace-
   normalised match on aria-label, aria-labelledby, an associated <label>, or text. */
const FIND_BY_ROLE = `(role, name) => {
  const norm = s => String(s || '').replace(/\\s+/g, ' ').trim();
  const selectors = { link: 'a[href]', button: 'button,[role=button],input[type=button],input[type=submit]',
    combobox: '[role=combobox],select' };
  const nameOf = el => el.getAttribute('aria-label')
    || (el.getAttribute('aria-labelledby') || '').split(/\\s+/).map(id => document.getElementById(id)?.textContent).filter(Boolean).join(' ')
    || (el.labels && [...el.labels].map(l => l.textContent).join(' '))
    || el.textContent;
  // Visually hidden originals (an enhanced select's native element) are not clickable targets.
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
  const all = [...document.querySelectorAll(selectors[role] || '[role=' + role + ']')];
  const hits = all.filter(el => norm(nameOf(el)) === norm(name) && visible(el));
  // An explicit role (the enhanced trigger) outranks an implicit one (the native element).
  return hits.find(el => el.getAttribute('role') === role) || hits[0] || null;
}`;

export async function launchChromeTab({ url, width = 1440, height = 900 } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'pagecraft-chrome-'));
  const child = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-background-networking',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  const close = async () => {
    child.kill('SIGTERM');
    await sleep(300);
    await rm(profile, { recursive: true, force: true });
  };
  try {
    const port = await devtoolsPort(profile, child);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find(target => target.type === 'page');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const cdp = new Cdp(socket);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const version = (await cdp.send('Browser.getVersion')).product;

    const evaluate = async (fn, arg) => {
      const expression = `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
      for (let attempt = 0; ; attempt++) {
        try {
          const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
          return result.value;
        } catch (error) {
          // A click on a gallery link replaces the document; retry once it has.
          if (attempt < 40 && /context|destroyed|navigat|Cannot find/i.test(String(error.message))) { await sleep(100); continue; }
          throw error;
        }
      }
    };
    const clickAt = async (x, y) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };
    /* Scroll into view, then click the centre with real input, as Playwright does. */
    const clickFound = async (finder, arg, what) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        const box = await evaluate(`(arg) => { const el = (${finder})(...arg); if (!el) return null;
          el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!el.disabled }; }`, arg);
        if (box && !box.disabled) {
          // Playwright-style stability: the same position twice, so a still-booting widget is not hit.
          await sleep(60);
          const again = await evaluate(`(arg) => { const el = (${finder})(...arg); if (!el) return null; const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }`, arg);
          if (again && Math.abs(again.x - box.x) < 1 && Math.abs(again.y - box.y) < 1) return clickAt(box.x, box.y);
        }
        await sleep(100);
      }
      throw new Error(`Could not find an enabled ${what}.`);
    };
    const locator = selector => ({
      waitFor: async () => {
        for (let attempt = 0; attempt < 100; attempt++) {
          if (await evaluate(s => !!document.querySelector(s), selector).catch(() => false)) return;
          await sleep(100);
        }
        throw new Error(`Timed out waiting for ${selector}`);
      },
      click: () => clickFound('(s) => document.querySelector(s)', [selector], selector),
    });
    const keys = { Escape: { code: 'Escape', windowsVirtualKeyCode: 27 }, Enter: { code: 'Enter', windowsVirtualKeyCode: 13 },
      ArrowDown: { code: 'ArrowDown', windowsVirtualKeyCode: 40 }, Tab: { code: 'Tab', windowsVirtualKeyCode: 9 } };
    const tab = {
      browser: CHROME_BROWSER_LABEL,
      browserVersion: version,
      capabilities: { get: async name => { if (name !== 'cdp') throw new Error(`No ${name} capability`); return cdp; } },
      playwright: {
        evaluate,
        getByRole: (role, { name }) => ({ click: () => clickFound(FIND_BY_ROLE, [role, name], `${role} "${name}"`) }),
        locator,
      },
      pressKey: async key => {
        const k = keys[key]; if (!k) throw new Error(`Unsupported key ${key}`);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, ...k });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, ...k });
      },
      type: async text => cdp.send('Input.insertText', { text }),
      clickAt,
      goto: async target => {
        await cdp.send('Page.navigate', { url: target });
        for (let attempt = 0; attempt < 100; attempt++) {
          if (await evaluate(() => document.readyState === 'complete' && document.documentElement.dataset.galleryReady === 'true').catch(() => false)) return;
          await sleep(100);
        }
        throw new Error(`Timed out loading ${target}`);
      },
      close: async () => { socket.close(); await close(); },
    };
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    if (url) await tab.goto(url);
    return tab;
  } catch (error) {
    await close();
    throw error;
  }
}
