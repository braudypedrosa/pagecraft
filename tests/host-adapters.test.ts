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
  a.equal(host.authentication.can('edit_document'), true);
  a.equal(host.authentication.can('manage_pages'), false);
  const session = await host.authentication.session();
  a.equal(session.displayName, 'Admin');
  a.equal(host.authentication.can('manage_pages'), true, 'the refreshed WordPress capability list is authoritative');

  const loaded = await host.documents.load();
  a.equal(loaded.version, 9);
  a.equal(loaded.document.schemaVersion, Core.SCHEMA);
  a.equal((await host.documents.save({ document: doc, version: 9 })).version, 10);

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

  const firstHeaders = new Headers(fixture.calls[0].init.headers);
  a.equal(firstHeaders.get('X-WP-Nonce'), 'nonce-one');
  host.setNonce('nonce-two');
  await host.pages.list();
  const lastHeaders = new Headers(fixture.calls.at(-1)!.init.headers);
  a.equal(lastHeaders.get('X-WP-Nonce'), 'nonce-two', 'nonce rotation changes transport authorization only');
  a.ok(fixture.calls.every(call => call.url.startsWith('https://wp.test/wp-json/pagecraft/v1/')));
});

test('web and WordPress hosts adopt and compile the identical document identically', async () => {
  const doc = currentDocument();
  const web = createWebHostAdapter({
    siteId: 'site-1', role: 'owner', document: doc, version: 4,
    fetch: async () => { throw new Error('the injected web document should not make a request'); }
  });
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
