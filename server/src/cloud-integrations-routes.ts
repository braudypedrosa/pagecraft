import { type AssetStore } from './assets.ts';
import { importUplistingCovers } from './uplisting-media.ts';
import { cmsDocumentErrors } from './cms-document.ts';
import { throttle } from './mail.ts';
import type { Hono, Context } from 'hono';
import type { Store } from './store.ts';
import type { User } from './auth.ts';
import { randomUUID } from 'node:crypto';
import { IntegrationError, syncProperties, type CloudConnectionStore, UplistingClient } from './cloud-uplisting.ts';
import { siteIntegrationsPage } from './account-pages.ts';

export interface CloudIntegrations { connections: CloudConnectionStore; client: UplistingClient }
type Gate = { ok: true; user: User; role: string } | { ok: false; status: 401 | 403 | 404 };
export function cloudIntegrationRoutes(app: Hono, o: {
  store: Store; integrations?: CloudIntegrations; assets?: AssetStore;
  allowed: (c: Context, id: string, verb: 'admin') => Promise<Gate>;
  editorOrigin?: string;
}) {
  const base = '/sites/:id/integrations';
  const rate = throttle(10, 60000);
  const cooldown = throttle(1, 2000);
  const gate = async (c: Context) => {
    // This feature is Cloud-account-only, including when a WP credential belongs to an owner.
    if (c.req.header('x-pagecraft-editor-session') || c.req.header('authorization')) return { ok: false as const, status: 403 as const };
    return o.allowed(c, c.req.param('id')!, 'admin');
  };
  app.get(base, async c => {
    const access = await gate(c);
    if (!access.ok) return access.status === 401 ? c.redirect('/sign-in?next=' + encodeURIComponent(new URL(c.req.url).pathname)) : c.text('Access denied', access.status);
    const site = await o.store.byId(c.req.param('id'));
    if (!site) return c.notFound();
    let connection = null;
    try { connection = await o.integrations?.connections.get(site.id) || null; }
    catch { return c.text('Integrations storage is unavailable. Try again shortly.', 503); }
    return c.html(siteIntegrationsPage(access.user, site, { enabled: !!o.integrations, connected: !!connection, selected: connection?.selected || [], lastSync: connection?.lastSync }));
  });
  app.post(base + '/uplisting/:action', async c => {
    const access = await gate(c);
    if (!access.ok) return c.json({ error: 'You need owner access to manage integrations.' }, access.status);
    const origin = c.req.header('origin');
    if (origin !== new URL(o.editorOrigin || c.req.url).origin) return c.json({ error: 'Refresh this page and try again.' }, 403);
    if (!o.integrations) return c.json({ error: 'Integrations are unavailable on this server.' }, 503);
    const id = c.req.param('id')!, action = c.req.param('action')!;
    if (!['connect', 'list', 'sync', 'disconnect'].includes(action)) return c.notFound();
    if (!rate.take(access.user.id) || !cooldown.take(id)) { c.header('retry-after', '2'); return c.json({ error: 'Please wait a moment before trying again.' }, 429); }
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') return c.json({ error: 'Invalid request.' }, 400);
    try {
      return await o.integrations.connections.exclusive(id, async () => {
        const site = await o.store.byId(id);
        if (!site) return c.notFound();
        const connections = o.integrations!.connections, client = o.integrations!.client;
        const connection = await connections.get(id);
        if (action === 'disconnect') {
          await connections.put(id, null);
          return c.json({ message: 'Uplisting disconnected. Imported CMS content is retained.' });
        }
        if (action === 'connect') {
          if (connection) throw new IntegrationError('Disconnect the current Uplisting account before connecting another.');
          const key = typeof body.key === 'string' ? body.key.trim() : '';
          const properties = await client.properties(key);
          await connections.put(id, { key, collectionId: 'uplisting-' + randomUUID(), selected: [] });
          return c.json({ properties: properties.map(p => ({ id: p.id, name: p.values.title, city: p.values.city })), version: site.version, message: 'Connected to Uplisting. Choose properties to import.' });
        }
        if (!connection) throw new IntegrationError('Connect Uplisting first.');
        const properties = await client.properties(connection.key);
        if (action === 'list') return c.json({ properties: properties.map(p => ({ id: p.id, name: p.values.title, city: p.values.city })), version: site.version, selected: connection.selected });
        if (!Number.isInteger(body.version) || body.version !== site.version) return c.json({ error: 'The site changed since this list was loaded. Refresh properties and try again.' }, 409);
        const selected = body.selected;
        if (!Array.isArray(selected) || selected.length > 1000 || selected.some(id => typeof id !== 'string')) throw new IntegrationError('Select valid properties to sync.');
        if (selected.length > 25) throw new IntegrationError('Sync up to 25 properties at a time. Choose fewer properties.');
        // Validate selection before downloading or storing any media.
        syncProperties(site.doc, connection, properties, selected);
        const imported = await importUplistingCovers(properties.filter(p => selected.includes(p.id)), id, access.user.id, o.assets);
        const doc = syncProperties(site.doc, connection, imported, selected);
        const assetIds = new Set((await o.assets?.list(id) || []).map(a => a.id));
        const errors = cmsDocumentErrors(site.doc, doc, assetIds);
        if (errors.length) throw new IntegrationError('Some CMS fields need attention before syncing. Check required custom fields and field types in the collection.');
        if (Buffer.byteLength(JSON.stringify(doc)) > 12 * 1024 * 1024) throw new IntegrationError('This import would exceed the site document limit. Select fewer properties.');
        const result = await o.store.save(id, doc, site.version, access.user.id, { source: 'uplisting', action: 'property-sync', count: selected.length });
        if (!result.ok) return c.json({ error: 'The site changed during sync. Refresh properties and try again.' }, 409);
        const lastSync = new Date().toISOString();
        try { await connections.put(id, { ...connection, selected, lastSync }); }
        catch { return c.json({ version: result.site?.version ?? site.version + 1, message: 'Properties were saved, but sync status could not be recorded. Refresh properties before syncing again.' }); }
        return c.json({ version: result.site?.version ?? site.version + 1, lastSync, message: `${selected.length} properties synced to the draft. Open the CMS to review, then publish when ready.` });
      });
    } catch (error) {
      // Provider bodies, URLs, keys and filesystem errors never reach the browser or logs.
      return c.json({ error: error instanceof IntegrationError ? error.message : 'Integrations are temporarily unavailable. Try again shortly.' }, 400);
    }
  });
}
