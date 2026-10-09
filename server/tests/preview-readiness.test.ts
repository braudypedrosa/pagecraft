import { test, expect, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { withPreviewReadiness } from '../src/preview-readiness.ts';
import { createApp } from '../src/app.ts';
import { MemoryAuthStore, hashToken } from '../src/auth.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { blankDoc } from '../src/render.ts';

const token = 'a'.repeat(32);
function runtime(markup = '', options: { complete?: boolean; broken?: boolean; lazy?: boolean; fonts?: Promise<unknown> } = {}) {
  const dom = new JSDOM(`<html><body>${markup}</body></html>`, { runScripts: 'outside-only' });
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
  const output = withPreviewReadiness('', token);
  w.eval(output.slice(output.indexOf('>') + 1, output.lastIndexOf('</script>')));
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const paint = () => { frames.splice(0).forEach(fn => fn()); };
  return { dom, w, messages, flush, paint, frames };
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

test('private snapshot route validates correlation token and preserves authentication, CSP and stored bytes', async () => {
  const auth = new MemoryAuthStore(), store = new MemoryStore(), publications = new MemoryHostedPublicationStore();
  const user = await auth.createUser('readiness@example.invalid', 'Synthetic');
  await auth.putSession(hashToken('test-session'), user.id, Date.now() + 60000);
  const site = await store.create({ name: 'Synthetic', host: 'fixture.invalid', doc: blankDoc('Synthetic') });
  await auth.grant(site.id, user.id, 'owner');
  const source = '<html><body>Saved content</body></html>';
  const publication = await publications.create({ siteId: site.id, slug: 'synthetic', host: 'fixture.invalid', sourceVersion: 1,
    files: [{ path: 'index.html', mediaType: 'text/html', bytes: new TextEncoder().encode(source) }] });
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
  expect(await response.text()).toContain('data-pagecraft-preview-readiness');
  const denied = await get(token, false);
  expect(denied.status).toBeGreaterThanOrEqual(400);
  expect(await denied.text()).not.toContain('data-pagecraft-preview-readiness');
  const stored = await publications.file(publication, 'index.html');
  expect(stored).not.toBeNull();
  expect(new TextDecoder().decode(stored!)).toBe(source);
});
