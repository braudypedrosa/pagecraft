import { test, expect, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm, stat, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import * as Core from '../../app/src/core/index.ts';
import { FileCloudConnectionStore, IntegrationError, parseProperties, syncProperties, UplistingClient } from '../src/cloud-uplisting.ts';
import { cloudIntegrationRoutes } from '../src/cloud-integrations-routes.ts';
import { MemoryStore } from '../src/store.ts';
import { siteIntegrationsPage } from '../src/account-pages.ts';

const payload = () => ({ data: [{ id: '42', type: 'properties', attributes: { name: 'QA Waterline', description: 'A woodland stay.\nSpace & quiet. <script>unsafe</script>', bedrooms: 2, bathrooms: 1.5, maximum_capacity: 4, wifi_password: 'never-import', currency: 'USD' }, relationships: {
  address: { data: { id: 'a', type: 'addresses' } }, photos: { data: [{ id: 'p1', type: 'photos' }, { id: 'p2', type: 'photos' }] }, amenities: { data: [{ id: 'k', type: 'amenities' }] },
} }], included: [
  { id: 'a', type: 'addresses', attributes: { city: 'Test City', country: 'Test Country', street: 'private street' } },
  { id: 'p1', type: 'photos', attributes: { url: 'https://images.example.test/second.jpg', order: 2 } },
  { id: 'p2', type: 'photos', attributes: { url: 'https://images.example.test/cover.jpg', order: 1 } },
  { id: 'k', type: 'amenities', attributes: { name: 'Kitchen' } },
] });
const doc = () => { Core.seed(); return structuredClone({ schemaVersion: Core.SCHEMA, meta: Core.state.meta, header: Core.state.header, footer: Core.state.footer, pages: Core.state.pages }); };
const connection = { key: 'test-secret', collectionId: 'uplisting-test', selected: [] };

test('normalizes documented JSON:API relationships and only imports public display fields', () => {
  const properties = parseProperties(payload());
  expect(properties[0].values).toMatchObject({ title: 'QA Waterline', image: 'https://images.example.test/cover.jpg', bathrooms: '1.5', city: 'Test City', amenities: 'Kitchen' });
  expect(JSON.stringify(properties)).not.toMatch(/never-import|private street|currency/);
  const duplicate = payload(); duplicate.data.push(duplicate.data[0]);
  expect(() => parseProperties(duplicate)).toThrow(IntegrationError);
  expect(() => parseProperties({ errors: [] })).toThrow(IntegrationError);
});

test('sync is idempotent, preserves URLs, layouts, draft state, custom fields and unselected items', () => {
  const source = doc(), properties = parseProperties(payload());
  const imported = syncProperties(source, connection, properties, ['42']);
  const c = imported.meta.collections!.find(c => c.id === connection.collectionId)!;
  c.fields.push({ id: 'editorial', name: 'Editorial note', type: 'text' });
  c.items[0].values.editorial = 'Keep this'; c.items[0].draft = 1;
  c.items[0].slug = 'my-property';
  c.items.push({ id: 'manual', slug: 'manual', values: { title: 'Manual' } });
  properties[0].values.title = 'Renamed in Uplisting';
  const updated = syncProperties(imported, connection, properties, ['42']);
  const items = updated.meta.collections!.find(c => c.id === connection.collectionId)!.items;
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({ slug: 'my-property', draft: 1, values: { editorial: 'Keep this', title: 'Renamed in Uplisting' } });
  expect(updated.pages).toEqual(source.pages);
  const reconnected = syncProperties(updated, { ...connection, collectionId: 'another-connection' }, properties, ['42']);
  const allIds = reconnected.meta.collections!.flatMap(c => c.items.map(i => i.id));
  expect(new Set(allIds).size).toBe(allIds.length);
  expect(JSON.stringify(updated)).not.toContain(connection.key);
  expect(() => syncProperties(updated, connection, properties, ['missing'])).toThrow(IntegrationError);
  expect(() => syncProperties(updated, connection, properties, ['42', '42'])).toThrow(IntegrationError);
});

test('client sends API-key Basic auth only to the fixed property endpoint and refuses foreign pagination', async () => {
  const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
    expect(options?.headers).toMatchObject({ Authorization: 'Basic ' + Buffer.from('secret').toString('base64') });
    expect(options?.redirect).toBe('error');
    return Response.json({ ...payload(), links: { next: 'https://attacker.test/properties' } });
  });
  await expect(new UplistingClient(fetcher).properties('secret')).rejects.toThrow('pagination');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://connect.uplisting.io/properties');
});

test('provider failures never disclose response bodies or keys', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response('secret-provider-body', { status: 401 }));
  await expect(new UplistingClient(fetcher).properties('secret-key')).rejects.toThrow('rejected this API key');
  const bad = new UplistingClient(async () => { throw new Error('secret-key'); });
  await expect(bad.properties('secret-key')).rejects.toThrow('Could not read Uplisting properties');
});

test('credentials are encrypted, site-bound, persistent, private and exclusive', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pc-integration-'));
  try {
    const store = new FileCloudConnectionStore(root);
    await store.put('site-a', connection);
    expect(await new FileCloudConnectionStore(root).get('site-a')).toEqual(connection);
    const files = await readdir(root), encrypted = files.find(f => f.endsWith('.enc'))!;
    expect((await readFile(join(root, encrypted))).includes(Buffer.from(connection.key))).toBe(false);
    expect((await stat(join(root, encrypted))).mode & 0o777).toBe(0o600);
    await store.put('site-b', connection);
    const other = (await readdir(root)).find(f => f.endsWith('.enc') && f !== encrypted)!;
    await copyFile(join(root, encrypted), join(root, other));
    await expect(store.get('site-b')).rejects.toThrow();
    await store.exclusive('site-a', async () => { await expect(store.exclusive('site-a', async () => {})).rejects.toThrow('already running'); });
    await store.put('site-a', null); expect(await store.get('site-a')).toBeNull();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('concurrent first writes use one fully initialized encryption key', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pc-integration-'));
  try {
    const store = new FileCloudConnectionStore(root);
    await Promise.all(['a', 'b', 'c'].map(id => store.put(id, connection)));
    for (const id of ['a', 'b', 'c']) expect(await store.get(id)).toEqual(connection);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Cloud routes gate owners, reject cross-origin/WP access, sync drafts with CAS, and never expose keys', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pc-integration-'));
  try {
    const store = new MemoryStore(), connections = new FileCloudConnectionStore(root);
    const site = await store.create({ name: 'Integration QA', host: 'integration.invalid', doc: doc() });
    const user = { id: 'owner', email: 'owner@example.test', name: 'Owner', createdAt: '' };
    let owner = true;
    const mount = () => { const app = new Hono(); cloudIntegrationRoutes(app, { store, editorOrigin: 'https://admin.test', integrations: { connections, client: new UplistingClient(async () => { const body = payload(); body.data[0].relationships.photos.data = []; return Response.json(body); }) }, allowed: async () => owner ? { ok: true, user, role: 'owner' } : { ok: false, status: 403 } }); return app; };
    const request = (action: string, body: unknown, headers: Record<string, string> = {}) => mount().request('https://admin.test/sites/' + site.id + '/integrations/uplisting/' + action, { method: 'POST', headers: { origin: 'https://admin.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    owner = false; expect((await request('connect', { key: 'secret-key' })).status).toBe(403);
    owner = true; expect((await request('connect', { key: 'secret-key' }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await request('connect', { key: 'secret-key' }, { 'x-pagecraft-editor-session': 'wp-token' })).status).toBe(403);
    const connected = await request('connect', { key: 'secret-key' }); expect(connected.status).toBe(200); expect(await connected.text()).not.toContain('secret-key');
    expect((await request('sync', { selected: ['42'], version: site.version + 1 })).status).toBe(409);
    const synced = await request('sync', { selected: ['42'], version: site.version }); expect(synced.status).toBe(200);
    const current = (await store.byId(site.id))!;
    expect(current.version).toBe(site.version + 1); expect(current.publishedVersion).toBe(site.publishedVersion);
    expect(JSON.stringify(current)).not.toContain('secret-key');
    expect(current.doc.meta.collections?.some(c => c.name === 'Uplisting properties')).toBe(true);
    expect((await request('sync', { selected: ['42'], version: site.version })).status).toBe(409);
    const page = await mount().request('https://admin.test/sites/' + site.id + '/integrations');
    expect(await page.text()).not.toContain('secret-key');
    await request('disconnect', {}); expect(await connections.get(site.id)).toBeNull();
    expect((await store.byId(site.id))!.doc).toEqual(current.doc);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('integration page escapes provider identifiers and exposes clear controls', () => {
  const html = siteIntegrationsPage({ id: '1', name: 'Owner', email: 'owner@example.test', createdAt: '' }, { id: 'site', name: '<script>bad</script>', version: 1 }, { enabled: true, connected: true, selected: ['</script><script>alert(1)</script>'] });
  expect(html).not.toContain('<script>bad</script>');
  expect(html).not.toContain('</script><script>alert(1)');
  expect(html).toContain('type="password"');
  expect(html).toContain('Refresh properties');
  expect(html).toContain('Sync selected properties');
});

test.each(['cdn.filestackcontent.com', 'djts5lg061pqs.cloudfront.net'])('cover import from %s stores optimized, deduplicated assets without credentials', async host => {
  const { default: sharp } = await import('sharp');
  const { MemoryAssetStore } = await import('../src/assets.ts');
  const { importUplistingCovers } = await import('../src/uplisting-media.ts');
  const { cmsDocumentErrors } = await import('../src/cms-document.ts');
  const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#65745a' } }).png().toBuffer();
  const assets = new MemoryAssetStore();
  const properties = parseProperties(payload()); properties[0].values.image = 'https://' + host + '/test-photo';
  const fetcher = vi.fn<typeof fetch>(async (_url, options) => { expect(options?.headers).toBeUndefined(); expect(options?.redirect).toBe('error'); return new Response(bytes); });
  const converted = await importUplistingCovers(properties, 'site-a', 'owner', assets, fetcher);
  expect(converted[0].values.image).toMatch(/^asset:uplisting-photo-/);
  await importUplistingCovers(properties, 'site-a', 'owner', assets, fetcher);
  expect(await assets.list('site-a')).toHaveLength(1);
  const before = doc(), after = syncProperties(before, connection, converted, ['42']);
  expect(cmsDocumentErrors(before, after, new Set((await assets.list('site-a')).map(a => a.id)))).toEqual([]);
  expect(JSON.stringify(after)).not.toContain('https://cdn.filestackcontent.com');
  expect(JSON.stringify(after)).not.toContain('test-secret');
});

test('cover import refuses unverified hosts and malformed image bytes', async () => {
  const { MemoryAssetStore } = await import('../src/assets.ts');
  const { importUplistingCovers } = await import('../src/uplisting-media.ts');
  const assets = new MemoryAssetStore(), properties = parseProperties(payload());
  const fetcher = vi.fn<typeof fetch>(async () => new Response('not an image'));
  for (const host of ['127.0.0.1', 'untrusted.cloudfront.net', 'djts5lg061pqs.cloudfront.net.attacker.test']) {
  properties[0].values.image = 'https://' + host + '/private';
  await expect(importUplistingCovers(properties, 'site', 'owner', assets, fetcher)).rejects.toThrow('unsupported photo host');
  expect(fetcher).not.toHaveBeenCalled();
  }
  properties[0].values.image = 'https://cdn.filestackcontent.com/test-photo';
  await expect(importUplistingCovers(properties, 'site', 'owner', assets, fetcher)).rejects.toThrow('unsupported image format');
  expect(await assets.list('site')).toHaveLength(0);
});
