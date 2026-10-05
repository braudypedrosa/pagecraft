import { beforeEach, test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../app/src/core/index';
import { createWebHostAdapter } from '../app/src/host/web';
import { createWordPressHostAdapter } from '../app/src/host/wordpress';
import { DocumentSchemaError } from '../app/src/host/schema';
import type { Doc } from '../app/src/core/types';
import { renderSite } from '../server/src/render';

type RecordedRequest = { url: string; init: RequestInit };

const currentDocument = (): Doc => structuredClone(Core.doc());

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function wordpressFetch(doc: Doc) {
  const calls: RecordedRequest[] = [];
  const fetcher = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const path = new URL(url).pathname.replace('/wp-json/pagecraft/v1', '');
    const method = init.method || 'GET';
    if (path === '/session') return json({
      authenticated: true, userId: '7', displayName: 'Admin',
      capabilities: ['edit_document', 'manage_pages', 'manage_menus', 'upload_media']
    });
    if (path === '/pages/42/document' && method === 'GET') return json({ document: doc, version: 9 });
    if (path === '/pages/42/document' && method === 'PUT') return json({ version: 10 });
    if (path === '/pages' && method === 'GET') return json([
      { id: '42', title: 'Home', slug: 'home', status: 'publish' }
    ]);
    if (path === '/pages' && method === 'POST') return json({
      id: '43', title: 'About', slug: 'about', status: 'draft'
    }, 201);
    if (path === '/pages/42' && method === 'GET') return json({
      id: '42', title: 'Home', slug: 'home', status: 'publish'
    });
    if (path === '/pages/42' && method === 'PATCH') return json({
      id: '42', title: 'Homepage', slug: 'home', status: 'publish'
    });
    if (path === '/pages/42/revisions' && method === 'GET') return json([
      { id: '88', version: 8, createdAt: '2026-08-26T00:00:00Z' }
    ]);
    if (path === '/pages/42/revisions/8/restore' && method === 'POST') return json({ document: doc, version: 11 });
    if (path === '/menus' && method === 'GET') return json([
      { id: 'primary', name: 'Primary', items: [] }
    ]);
    if (path === '/menus/primary' && method === 'GET') return json({ id: 'primary', name: 'Primary', items: [] });
    if (path === '/menus/primary' && method === 'PUT') return json({ id: 'primary', name: 'Primary', items: [] });
    if (path === '/media' && method === 'GET') return json([
      { id: '51', name: 'hero.webp', mimeType: 'image/webp', url: 'https://wp.test/hero.webp', size: 123 }
    ]);
    if (path === '/media' && method === 'POST') return json({
      id: '52', name: 'new.webp', mimeType: 'image/webp', url: 'https://wp.test/new.webp', size: 3
    }, 201);
    if (path === '/media/51' && method === 'GET') return new Response(new Blob(['img'], { type: 'image/webp' }));
    if (path === '/media/51' && method === 'DELETE') return json({ removed: '51' });
    if (path === '/settings' && method === 'GET') return json({ theme: 'pagecraft', editor: true });
    if (path === '/settings' && method === 'PUT') return json({ theme: 'pagecraft', editor: false });
    if (path === '/content/sources' && method === 'GET') return json([
      { id: 'post', label: 'Posts', restBase: 'posts' }
    ]);
    if (path === '/content/post' && method === 'GET') return json([
      { id: '73', source: 'post', title: 'News', slug: 'news', status: 'publish' }
    ]);
    if (path === '/content/post/73' && method === 'GET') return json({
      id: '73', source: 'post', title: 'News', slug: 'news', status: 'publish'
    });
    throw new Error(`Unhandled fixture request: ${method} ${path}`);
  };
  return { calls, fetcher };
}

beforeEach(() => {
  Core.seed();
  Core.state.ui = Core.initUi();
});

test('WordPress adapter covers pages, revisions, menus, media, settings, nonces and capabilities', async () => {
  const doc = currentDocument();
  const fixture = wordpressFetch(doc);
  const host = createWordPressHostAdapter({
    restUrl: 'https://wp.test/wp-json/pagecraft/v1/', pageId: 42, nonce: 'nonce-one',
    capabilities: ['edit_document'], fetch: fixture.fetcher
  });

  a.equal(host.kind, 'wordpress');
  a.equal(host.features.hostedPublishing, false);
  a.equal(host.features.projectExport, false);
  a.equal(host.features.media, 'wordpress');
  a.equal(host.features.dynamicContent, 'wordpress');
  a.equal(host.authentication.can('edit_document'), true);
  a.equal(host.authentication.can('manage_pages'), false);
  const session = await host.authentication.session();
  a.equal(session.displayName, 'Admin');
  a.equal(host.authentication.can('manage_pages'), true, 'the refreshed WordPress capability list is authoritative');

  const loaded = await host.documents.load();
  a.equal(loaded.version, 9);
  a.equal(loaded.document.schemaVersion, Core.SCHEMA);
  a.equal((await host.documents.save({
    document: doc,
    version: 9,
    compiled: { html: '<main id="pagecraft-main"></main>', globalCss: ':root{}', pageCss: '.page{}' }
  })).version, 10);
  const savedDocument = JSON.parse(String(fixture.calls.at(-1)!.init.body));
  a.equal(savedDocument.compiled.pageCss, '.page{}');

  a.equal((await host.pages.list())[0].title, 'Home');
  a.equal((await host.pages.get('42')).slug, 'home');
  a.equal((await host.pages.create({ title: 'About', slug: 'about' })).id, '43');
  a.equal((await host.pages.update('42', { title: 'Homepage' })).title, 'Homepage');

  a.equal((await host.revisions.list())[0].version, 8);
  a.equal((await host.revisions.restore(8, 10)).version, 11);

  a.equal((await host.menus.list())[0].name, 'Primary');
  const menu = await host.menus.get('primary');
  a.equal((await host.menus.save(menu)).id, 'primary');

  a.equal((await host.assets.list())[0].mimeType, 'image/webp');
  a.equal((await host.assets.download('51')).size, 3);
  a.equal((await host.assets.upload(new Blob(['new'], { type: 'image/webp' }), 'new.webp')).id, '52');
  await host.assets.remove('51');

  a.equal((await host.settings.read()).theme, 'pagecraft');
  a.equal((await host.settings.write({ editor: false })).editor, false);

  a.equal((await host.content.sources())[0].id, 'post');
  a.equal((await host.content.list('post', { search: 'News', page: 2, perPage: 10 }))[0].id, '73');
  a.equal(new URL(fixture.calls.at(-1)!.url).search, '?search=News&page=2&per_page=10');
  a.equal((await host.content.get('post', '73')).title, 'News');

  const firstHeaders = new Headers(fixture.calls[0].init.headers);
  a.equal(firstHeaders.get('X-WP-Nonce'), 'nonce-one');
  host.setNonce('nonce-two');
  await host.pages.list();
  const lastHeaders = new Headers(fixture.calls.at(-1)!.init.headers);
  a.equal(lastHeaders.get('X-WP-Nonce'), 'nonce-two', 'nonce rotation changes transport authorization only');
  a.ok(fixture.calls.every(call => call.url.startsWith('https://wp.test/wp-json/pagecraft/v1/')));
});

test('an expired WordPress REST nonce is refreshed once and the request retried', async () => {
  /* WordPress stops accepting the nonce the editor opened with after 12 to 24 hours. */
  const doc = currentDocument();
  const calls: { url: string; nonce: string | null }[] = [];
  let valid = 'a1b2c3d4e5', handed = 'a1b2c3d4e5';
  const host = createWordPressHostAdapter({
    restUrl: 'https://wp.test/wp-json/pagecraft/v1', pageId: 42, nonce: 'nonce-stale',
    nonceUrl: 'https://wp.test/wp-admin/admin-ajax.php?action=rest-nonce',
    fetch: async (input, init = {}) => {
      const url = String(input);
      const nonce = new Headers(init.headers).get('X-WP-Nonce');
      calls.push({ url, nonce });
      if (url.includes('admin-ajax.php')) return new Response(handed);
      if (nonce !== valid) return json({ code: 'rest_cookie_invalid_nonce', message: 'Cookie check failed' }, 403);
      return json({ version: 10 });
    }
  });

  a.equal((await host.documents.save({ document: doc, version: 9 })).version, 10);
  a.deepEqual(calls.map(c => [new URL(c.url).pathname, c.nonce]), [
    ['/wp-json/pagecraft/v1/pages/42/document', 'nonce-stale'],
    ['/wp-admin/admin-ajax.php', null],
    ['/wp-json/pagecraft/v1/pages/42/document', 'a1b2c3d4e5']
  ]);

  /* a login that has really ended answers `0`: one retry at most, and the refusal stands */
  valid = 'never'; handed = '0'; calls.length = 0;
  await a.rejects(host.documents.save({ document: doc, version: 10 }),
    (e: any) => e.status === 403 && e.payload.code === 'rest_cookie_invalid_nonce');
  a.equal(calls.filter(c => c.url.includes('/document')).length, 1, 'no retry without a fresh nonce');

  /* and any other 403 is not a nonce problem, so nothing is asked for */
  calls.length = 0;
  const plain = createWordPressHostAdapter({
    restUrl: 'https://wp.test/wp-json/pagecraft/v1', pageId: 42, nonce: 'n',
    nonceUrl: 'https://wp.test/wp-admin/admin-ajax.php?action=rest-nonce',
    fetch: async input => { calls.push({ url: String(input), nonce: null }); return json({ code: 'rest_forbidden' }, 403); }
  });
  await a.rejects(plain.documents.save({ document: doc, version: 1 }));
  a.equal(calls.length, 1);
});

test('a save sent as the tab closes goes as keepalive only when the body is small enough', async () => {
  const seen: (boolean | undefined)[] = [];
  const host = createWebHostAdapter({
    siteId: 'site-1', role: 'owner',
    fetch: async (_input, init = {}) => { seen.push(init.keepalive); return json({ version: 2 }); }
  });
  const small = currentDocument();
  await host.documents.save({ document: small, version: 1, keepalive: true });
  const big = currentDocument();
  big.meta.css = 'x'.repeat(70_000);
  await host.documents.save({ document: big, version: 1, keepalive: true });
  await host.documents.save({ document: small, version: 1 });
  a.deepEqual(seen, [true, undefined, undefined], 'browsers refuse a keepalive body over 64 KiB outright');
});

test('WordPress adapter can target a native global-element document without changing other host services', async () => {
  const calls: string[] = [];
  const doc = currentDocument();
  const host = createWordPressHostAdapter({
    restUrl: 'https://wp.test/wp-json/pagecraft/v1',
    pageId: 77,
    documentPath: '/globals/77/document',
    revisionsPath: '/globals/77/revisions',
    nonce: 'global-nonce',
    fetch: async (input, init = {}) => {
      const path = new URL(String(input)).pathname.replace('/wp-json/pagecraft/v1', '');
      calls.push(`${String(init.method || 'GET').toUpperCase()} ${path}`);
      if (path === '/globals/77/document') {
        return json({ document: doc, version: 3 });
      }
      if (path === '/globals/77/revisions') {
        return json([{ id: 'current', version: 3, createdAt: '2026-08-28T00:00:00Z', current: true }]);
      }
      if (path === '/globals/77/revisions/2/restore') {
        return json({ document: doc, version: 4 });
      }
      throw new Error(`Unhandled global fixture request: ${path}`);
    }
  });

  a.equal((await host.documents.load()).version, 3);
  a.equal((await host.revisions.list())[0].version, 3);
  a.equal((await host.revisions.restore(2, 3)).version, 4);
  a.deepEqual(calls, [
    'GET /globals/77/document',
    'GET /globals/77/revisions',
    'POST /globals/77/revisions/2/restore'
  ]);
});

test('a reviewer host adapter has no editor capabilities', async () => {
  const web = createWebHostAdapter({ siteId: 'reviewed', role: 'reviewer' });
  a.equal(web.authentication.can('edit_document'), false);
  a.equal(web.authentication.can('publish'), false);
  a.equal(web.authentication.can('upload_media'), false);
});

test('web and WordPress hosts adopt and compile the identical document identically', async () => {
  const doc = currentDocument();
  const web = createWebHostAdapter({
    siteId: 'site-1', role: 'owner', document: doc, version: 4,
    fetch: async () => { throw new Error('the injected web document should not make a request'); }
  });
  a.equal(web.features.hostedPublishing, true);
  a.equal(web.features.projectExport, true);
  a.equal(web.features.pages, 'pagecraft');
  const fixture = wordpressFetch(doc);
  const wordpress = createWordPressHostAdapter({
    restUrl: 'https://wp.test/wp-json/pagecraft/v1', pageId: 42, nonce: 'n', fetch: fixture.fetcher
  });

  const webDocument = (await web.documents.load()).document;
  const wordpressDocument = (await wordpress.documents.load()).document;
  const webOutput = renderSite(webDocument);
  const wordpressOutput = renderSite(wordpressDocument);
  a.deepEqual([...wordpressOutput.files], [...webOutput.files]);
  a.deepEqual(wordpressOutput.findings, webOutput.findings);
});

test('every host fails closed with an actionable error for a newer document schema', async () => {
  const newer = { ...currentDocument(), schemaVersion: Core.SCHEMA + 1 };
  const web = createWebHostAdapter({ siteId: 'newer', document: newer, version: 1 });
  await a.rejects(web.documents.load(), (error: unknown) => {
    a.ok(error instanceof DocumentSchemaError);
    a.match(error.message, new RegExp(`schema ${Core.SCHEMA + 1}`));
    a.match(error.message, /Upgrade Pagecraft/);
    return true;
  });

  const fixture = wordpressFetch(newer as Doc);
  const wordpress = createWordPressHostAdapter({
    restUrl: 'https://wp.test/wp-json/pagecraft/v1', pageId: 42, nonce: 'n', fetch: fixture.fetcher
  });
  await a.rejects(wordpress.documents.load(), /Upgrade Pagecraft/);
});
