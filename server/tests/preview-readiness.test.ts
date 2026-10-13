import { test, expect, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { withPreviewReadiness } from '../src/preview-readiness.ts';
import type { PreviewNavigation } from '../src/preview-readiness.ts';
import { createApp } from '../src/app.ts';
import { MemoryAuthStore, hashToken } from '../src/auth.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { blankDoc } from '../src/render.ts';

const token = 'a'.repeat(32);
const prefix = '/api/sites/fixture/publication-snapshots/11111111-1111-4111-a111-111111111111/files/';
const navigation = { prefix, pages: ['index.html', 'menu.html', 'stories/index.html', 'stories/room.html'] };
function runtime(markup = '', options: {
  complete?: boolean; broken?: boolean; lazy?: boolean; fonts?: Promise<unknown>;
  navigation?: PreviewNavigation; url?: string;
} = {}) {
  const dom = new JSDOM(`<html><body>${markup}</body></html>`, {
    runScripts: 'outside-only', url: options.url || 'https://admin.test' + prefix + 'index.html',
  });
  const w = dom.window as Window & typeof globalThis;
  const frames: (() => void)[] = [];
  const messages: unknown[] = [];
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  Object.defineProperty(w.document, 'fonts', { value: { ready: options.fonts || Promise.resolve() } });
  w.requestAnimationFrame = fn => { frames.push(() => fn(0)); return frames.length; };
  w.parent.postMessage = data => { messages.push(data); };
  w.setTimeout = setTimeout as unknown as typeof w.setTimeout;
  w.clearTimeout = clearTimeout as unknown as typeof w.clearTimeout;
  for (const img of Array.from(w.document.images)) {
    Object.defineProperty(img, 'complete', { value: options.complete ?? true });
    Object.defineProperty(img, 'naturalWidth', { value: options.broken ? 0 : 100 });
    Object.defineProperty(img, 'loading', { value: options.lazy ? 'lazy' : 'eager' });
    img.getBoundingClientRect = () => ({ top: 9999, bottom: 10099, left: 0, right: 100 } as DOMRect);
    img.decode = () => Promise.resolve();
  }
  const output = withPreviewReadiness('', token, options.navigation);
  w.eval(output.slice(output.indexOf('>') + 1, output.lastIndexOf('</script>')));
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const paint = () => { frames.splice(0).forEach(fn => fn()); };
  return { dom, w, messages, flush, paint, frames };
}

function click(f: ReturnType<typeof runtime>, options: MouseEventInit = {}) {
  let intercepted = false;
  // Observe the bridge's cancellation, then suppress jsdom's unsupported native navigation.
  f.w.document.addEventListener('click', event => {
    intercepted = event.defaultPrevented;
    event.preventDefault();
  }, { once: true });
  f.w.document.querySelector('a span')!.dispatchEvent(new f.w.MouseEvent('click', {
    bubbles: true, cancelable: true, button: 0, ...options,
  }));
  return intercepted;
}

test('valid empty and image previews report readiness only after dependencies and two painted frames', async () => {
  for (const markup of ['', '<img src="asset.webp">']) {
    let fontsReady!: () => void;
    const f = runtime(markup, { fonts: new Promise<void>(resolve => { fontsReady = resolve; }) });
    await f.flush();
    expect(f.frames).toHaveLength(0);
    expect(f.messages).toEqual([]);
    fontsReady(); await f.flush();
    f.paint(); expect(f.messages).toEqual([]);
    f.paint();
    expect(f.messages).toEqual([{ type: 'pagecraft-preview-ready', token, status: 'ready' }]);
    f.dom.window.close();
  }
});

test('image errors degrade, while offscreen lazy images do not hold initial preview readiness', async () => {
  const failed = runtime('<img src="missing.webp">', { complete: false });
  failed.w.document.images[0].dispatchEvent(new failed.w.Event('error'));
  await failed.flush(); failed.paint(); failed.paint();
  expect(failed.messages).toEqual([{ type: 'pagecraft-preview-ready', token, status: 'degraded' }]);
  failed.dom.window.close();
  const lazy = runtime('<img src="lazy.webp">', { complete: false, lazy: true });
  await lazy.flush(); lazy.paint(); lazy.paint();
  expect(lazy.messages).toEqual([{ type: 'pagecraft-preview-ready', token, status: 'ready' }]);
  lazy.dom.window.close();
});

test('stalled image or fonts produce a single degraded result at the bounded deadline', async () => {
  vi.useFakeTimers();
  try {
    const f = runtime('<img src="slow.webp">', { complete: false, fonts: new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(9999);
    expect(f.messages).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    f.paint(); f.paint();
    expect(f.messages).toEqual([{ type: 'pagecraft-preview-ready', token, status: 'degraded' }]);
    f.w.document.images[0].dispatchEvent(new f.w.Event('load'));
    await f.flush(); f.paint(); f.paint();
    expect(f.messages).toHaveLength(1);
    f.dom.window.close();
  } finally { vi.useRealTimers(); }
});

test('known private snapshot links request parent navigation using exact HTML paths and preserved hashes', async () => {
  const cases = [
    { href: prefix + 'menu', path: 'menu.html', hash: '' },
    { href: prefix + 'menu.html#pastries', path: 'menu.html', hash: '#pastries' },
    { href: 'https://admin.test' + prefix + 'stories/', path: 'stories/index.html', hash: '' },
    { href: prefix, path: 'index.html', hash: '' },
    { href: '../menu?category=bread#loaves', path: 'menu.html', hash: '#loaves', current: 'stories/room.html' },
  ];
  for (const c of cases) {
    const f = runtime(`<a href="${c.href}"><span>Page</span></a>`, {
      navigation, url: 'https://admin.test' + prefix + (c.current || 'index.html'),
    });
    await f.flush(); f.paint(); f.paint(); f.messages.length = 0;
    expect(click(f), c.href).toBe(true);
    expect(f.messages).toEqual([{ type: 'pagecraft-preview-navigate', token, path: c.path, hash: c.hash }]);
    f.dom.window.close();
  }
});

test('snapshot navigation ignores external, cross-snapshot, unknown and non-page links', async () => {
  const links = [
    'https://external.test' + prefix + 'menu',
    '//external.test' + prefix + 'menu.html',
    prefix.replace('11111111-', '22222222-') + 'menu',
    prefix.replace('/fixture/', '/another-site/') + 'menu',
    prefix.replace('/files/', '/files-lookalike/') + 'menu',
    '/menu',
    prefix + 'unknown',
    prefix + 'assets/logo.png',
    prefix + '../files-other/menu',
    '#pastries',
    'mailto:bakery@example.invalid',
    'javascript:void(0)',
    prefix + 'menu#' + 'a'.repeat(2048),
  ];
  for (const href of links) {
    const f = runtime(`<a href="${href}"><span>Page</span></a>`, { navigation });
    await f.flush(); f.paint(); f.paint(); f.messages.length = 0;
    expect(click(f), href).toBe(false);
    expect(f.messages).toEqual([]);
    f.dom.window.close();
  }
});

test('navigation respects download, new-tab, modified clicks and absence of a private manifest', async () => {
  const cases = [
    { attr: 'download' }, { attr: 'target="_blank"' }, { attr: 'target="other-frame"' },
    { event: { ctrlKey: true } }, { event: { metaKey: true } }, { event: { shiftKey: true } },
    { event: { altKey: true } }, { event: { button: 1 } }, { withoutManifest: true },
  ];
  for (const c of cases) {
    const f = runtime(`<a href="${prefix}menu" ${c.attr || ''}><span>Page</span></a>`, {
      navigation: c.withoutManifest ? undefined : navigation,
    });
    await f.flush(); f.paint(); f.paint(); f.messages.length = 0;
    expect(click(f, c.event)).toBe(false);
    expect(f.messages).toEqual([]);
    f.dom.window.close();
  }
});

test('private snapshot route validates correlation token and preserves authentication, CSP and stored bytes', async () => {
  const auth = new MemoryAuthStore(), store = new MemoryStore(), publications = new MemoryHostedPublicationStore();
  const user = await auth.createUser('readiness@example.invalid', 'Synthetic');
  await auth.putSession(hashToken('test-session'), user.id, Date.now() + 60000);
  const site = await store.create({ name: 'Synthetic', host: 'fixture.invalid', doc: blankDoc('Synthetic') });
  await auth.grant(site.id, user.id, 'owner');
  const source = '<html><body>Saved content<a href="menu.html">Menu</a></body></html>';
  const publication = await publications.create({ siteId: site.id, slug: 'synthetic', host: 'fixture.invalid', sourceVersion: 1,
    files: [
      { path: 'index.html', mediaType: 'text/html', bytes: new TextEncoder().encode(source) },
      { path: 'menu.html', mediaType: 'text/html', bytes: new TextEncoder().encode('<html><body>Menu</body></html>') },
      { path: 'assets/logo.svg', mediaType: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>') },
    ] });
  const app = createApp({ auth, store, publications, editorHost: 'admin.test' });
  const get = (value: string | undefined, signedIn = true) => app.request(`http://admin.test/api/sites/${site.id}/publication-snapshots/${publication.id}/files/index.html${value === undefined ? '' : '?pcPreviewReady=' + encodeURIComponent(value)}`, {
    headers: { host: 'admin.test', ...(signedIn ? { cookie: 'pc_session=test-session' } : {}) },
  });
  for (const value of [undefined, 'short', 'g'.repeat(32), 'a'.repeat(33), '</script><script>bad()']) {
    const response = await get(value);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('data-pagecraft-preview-readiness');
  }
  const response = await get(token);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-security-policy')).toBe("sandbox allow-scripts; connect-src 'none'; form-action 'none'; frame-ancestors 'self'");
  const body = await response.text();
  expect(body).toContain('data-pagecraft-preview-readiness');
  expect(body).toContain(`"prefix":"/api/sites/${site.id}/publication-snapshots/${publication.id}/files/"`);
  expect(body).toContain('"pages":["index.html","menu.html"]');
  expect(body).not.toContain('"pages":["index.html","menu.html","assets/logo.svg"]');
  const denied = await get(token, false);
  expect(denied.status).toBeGreaterThanOrEqual(400);
  expect(await denied.text()).not.toContain('data-pagecraft-preview-readiness');
  const stored = await publications.file(publication, 'index.html');
  expect(stored).not.toBeNull();
  expect(new TextDecoder().decode(stored!)).toBe(source);
});
