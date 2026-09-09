/** Cloud-only outbound property source. Never imported by the editor/WordPress packages. */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, link } from 'node:fs/promises';
import { join } from 'node:path';
import { RELEASE_LIMITS_V1 } from './releases.ts';
import type { Doc, Field } from '../../app/src/core/types.ts';

export class IntegrationError extends Error {}
export interface Property { id: string; values: Record<string, string> }
export interface UplistingConnection {
  key: string;
  collectionId: string;
  selected: string[];
  lastSync?: string;
}
export interface CloudConnectionStore {
  get(siteId: string): Promise<UplistingConnection | null>;
  put(siteId: string, value: UplistingConnection | null): Promise<void>;
  exclusive<T>(siteId: string, run: () => Promise<T>): Promise<T>;
}

/** Private, persistent, environment-specific directory, outside releases and public assets.
 * The encryption key and ciphertext must both be included in restricted host backups.
 * A process crash leaves a fail-closed lock: remove it only after confirming no sync is running.
 */
export class FileCloudConnectionStore implements CloudConnectionStore {
  private root: string;
  constructor(root: string) { this.root = root; }
  private name(id: string) { return createHash('sha256').update(id).digest('hex'); }
  private async encryptionKey() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const path = join(this.root, 'encryption.key');
    try { return await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const temp = path + '.' + randomUUID();
    const file = await open(temp, 'wx', 0o600);
    try { await file.writeFile(randomBytes(32)); await file.sync(); } finally { await file.close(); }
    try { await link(temp, path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    finally { await unlink(temp); }
    const key = await readFile(path);
    if (key.length !== 32) throw new Error('Invalid integrations encryption key');
    return key;
  }
  async get(id: string) {
    let bytes: Buffer;
    try { bytes = await readFile(join(this.root, this.name(id) + '.enc')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    const cipher = createDecipheriv('aes-256-gcm', await readFile(join(this.root, 'encryption.key')), bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(id));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString()) as UplistingConnection;
  }
  async put(id: string, value: UplistingConnection | null) {
    const path = join(this.root, this.name(id) + '.enc');
    if (!value) { await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; }); return; }
    const key = await this.encryptionKey(), iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(id));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    const temp = path + '.' + randomUUID();
    const file = await open(temp, 'wx', 0o600);
    try { await file.writeFile(Buffer.concat([iv, cipher.getAuthTag(), encrypted])); await file.sync(); }
    finally { await file.close(); }
    await rename(temp, path);
  }
  async exclusive<T>(id: string, run: () => Promise<T>) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const path = join(this.root, this.name(id) + '.lock');
    let lock;
    try { lock = await open(path, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new IntegrationError('An integration operation is already running. Try again shortly.');
      throw error;
    }
    try { return await run(); } finally { await lock.close(); await unlink(path); }
  }
}

const plain = (v: unknown, max = 20000) => typeof v === 'string' ? v.slice(0, max).replace(/[\u0000-\u001f\u007f]/g, ' ') : '';
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? String(v) : '';
const picture = (v: unknown) => {
  try { const u = new URL(String(v)); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
  catch { return ''; }
};
type Resource = { id: string; type: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: Resource | Resource[] }> };
export function parseProperties(payload: unknown): Property[] {
  const body = payload as { data?: Resource[]; included?: Resource[] };
  if (!body || !Array.isArray(body.data) || body.data.length > 1000 || (body.included !== undefined && !Array.isArray(body.included))) {
    throw new IntegrationError('Uplisting returned an unexpected property response. No properties were changed.');
  }
  const included = new Map((body.included || []).map(r => [r.type + ':' + r.id, r]));
  const resolve = (r: Resource) => included.get(r.type + ':' + r.id)?.attributes || {};
  const ids = new Set<string>();
  return body.data.map(p => {
    if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 128 || ids.has(p.id) || !p.attributes || typeof p.attributes !== 'object') {
      throw new IntegrationError('Uplisting returned an invalid or repeated property ID. No properties were changed.');
    }
    ids.add(p.id);
    const a = p.attributes, rel = p.relationships || {}, address = rel.address?.data;
    const location = address && !Array.isArray(address) ? resolve(address) : {};
    const photos = rel.photos?.data, amenities = rel.amenities?.data;
    const sortedPhotos = Array.isArray(photos) ? photos.map(resolve).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)) : [];
    return { id: p.id, values: {
      title: plain(a.name, 500) || `Property ${p.id}`,
      description: typeof a.description === 'string' ? '<p>' + a.description.slice(0, 10000).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>' : '',
      image: sortedPhotos.map(p => picture(p.url)).find(Boolean) || '',
      property_type: plain(a.type, 200), guests: count(a.maximum_capacity), bedrooms: count(a.bedrooms), beds: count(a.beds), bathrooms: count(a.bathrooms),
      city: plain(location.city, 200), country: plain(location.country, 200),
      amenities: Array.isArray(amenities) ? amenities.map(resolve).map(a => plain(a.name, 200)).filter(Boolean).join(', ').slice(0, 1000) : '',
      uplisting_id: p.id,
    } };
  });
}

export class UplistingClient {
  private request: typeof fetch;
  constructor(request: typeof fetch = fetch) { this.request = request; }
  async properties(key: string): Promise<Property[]> {
    if (!key || key.length > 4096 || /[\r\n]/.test(key)) throw new IntegrationError('Enter a valid Uplisting API key.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    const all: Property[] = [], visited = new Set<string>();
    let next = 'https://connect.uplisting.io/properties';
    try {
      while (next) {
        const url = new URL(next);
        if (url.origin !== 'https://connect.uplisting.io' || url.pathname !== '/properties' || url.username || url.password || visited.has(url.href) || visited.size >= 10) {
          throw new IntegrationError('Uplisting returned unsupported pagination. No properties were changed.');
        }
        visited.add(url.href);
        if (visited.size > 1) await new Promise(resolve => setTimeout(resolve, 650));
        const response = await this.request(url.href, { method: 'GET', redirect: 'error', signal: controller.signal, headers: {
          Authorization: 'Basic ' + Buffer.from(key).toString('base64'), Accept: 'application/json',
        } });
        if (!response.ok) {
          await response.body?.cancel();
          throw new IntegrationError(response.status === 401 || response.status === 403
            ? 'Uplisting rejected this API key. Check API access and try again.'
            : response.status === 429 ? 'Uplisting’s request limit was reached. Wait a minute and try again.'
            : 'Uplisting is unavailable. Try again shortly.');
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('empty response');
        const chunks: Uint8Array[] = []; let length = 0;
        for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length;
          if (length > 12 * 1024 * 1024) { await reader.cancel(); throw new IntegrationError('This Uplisting account is too large for this import. Contact Pagecraft support.'); }
          chunks.push(value);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        all.push(...parseProperties(body));
        if (all.length > 1000 || new Set(all.map(p => p.id)).size !== all.length) throw new IntegrationError('Uplisting returned too many or repeated properties. No properties were changed.');
        const link = body.links?.next;
        next = link ? new URL(typeof link === 'string' ? link : link.href, url).href : '';
      }
      return all;
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      throw new IntegrationError('Could not read Uplisting properties. Check your connection and try again.');
    } finally { clearTimeout(timer); }
  }
}

export const UPLISTING_FIELDS: Field[] = [
  ['title', 'Property name', 'text'], ['description', 'Description', 'rich'], ['image', 'Cover photo', 'image'],
  ['property_type', 'Property type', 'text'], ['guests', 'Guests', 'number'], ['bedrooms', 'Bedrooms', 'number'],
  ['beds', 'Beds', 'number'], ['bathrooms', 'Bathrooms', 'number'], ['city', 'City', 'text'],
  ['country', 'Country', 'text'], ['amenities', 'Amenities', 'text'], ['uplisting_id', 'Uplisting ID', 'text'],
].map(([id, name, type]) => ({ id, name, type: type as Field['type'] }));

/** Only source fields are updated. IDs, URLs, draft state, custom fields and layout survive. */
export function syncProperties(source: Doc, connection: UplistingConnection, properties: Property[], selected: string[]): Doc {
  const wanted = new Set(selected), available = new Map(properties.map(p => [p.id, p]));
  if (!wanted.size || wanted.size !== selected.length || selected.some(id => !available.has(id))) {
    throw new IntegrationError('Select at least one property from the current Uplisting list.');
  }
  const doc = structuredClone(source);
  const collections = doc.meta.collections ||= [];
  let collection = collections.find(c => c.id === connection.collectionId);
  if (!collection) {
    if (collections.length >= RELEASE_LIMITS_V1.cmsCollections) throw new IntegrationError('This site has reached its CMS collection limit.');
    const slug = collections.some(c => c.slug === 'properties') ? 'uplisting-properties-' + connection.collectionId.slice(-8) : 'properties';
    collection = { id: connection.collectionId, name: 'Uplisting properties', slug, fields: structuredClone(UPLISTING_FIELDS), items: [], detail: '' };
    collections.push(collection);
  }
  for (const field of UPLISTING_FIELDS) {
    const existing = collection.fields.find(f => f.id === field.id);
    if (existing && existing.type !== field.type) throw new IntegrationError(`Restore the ${field.name} field type before syncing.`);
    if (!existing) collection.fields.push(structuredClone(field));
  }
  if (collection.fields.length > RELEASE_LIMITS_V1.cmsFieldsPerCollection) throw new IntegrationError('This collection has too many fields to sync.');
  for (const id of selected) {
    const property = available.get(id)!;
    const itemId = 'uplisting-' + createHash('sha256').update(connection.collectionId + '\0' + id).digest('hex').slice(0, 24);
    const existing = collection.items.find(i => i.id === itemId);
    if (existing) existing.values = { ...existing.values, ...property.values };
    else {
      // ID suffix keeps URLs unique without changing them when a property is renamed.
      const stem = property.values.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55).replace(/-$/, '') || 'property';
      collection.items.push({ id: itemId, slug: `${stem}-${itemId.slice(-12)}`, slugLocked: 1, values: { ...property.values } });
    }
  }
  return doc;
}
