import { createHash } from 'node:crypto';
import { type AssetStore, MAX_BYTES, FREE_STORAGE_BYTES, sniff } from './assets.ts';
import { optimizeImage } from './image-optimization.ts';
import { IntegrationError, type Property } from './cloud-uplisting.ts';

/** Verified Uplisting image hosts: API documentation and current property UI. No provider credential is sent to image hosts. */
const PHOTO_HOSTS = new Set(['cdn.filestackcontent.com', 'djts5lg061pqs.cloudfront.net']);
export async function importUplistingCovers(properties: Property[], siteId: string, ownerId: string, assets?: AssetStore, request: typeof fetch = fetch) {
  if (!properties.some(p => p.values.image)) return properties;
  if (!assets) throw new IntegrationError('The media library is unavailable. Try again before importing photos.');
  const copies = structuredClone(properties), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const property = copies[next++]; if (!property) return;
      const source = property.values.image; if (!source) continue;
      if (controller.signal.aborted) throw new IntegrationError('Photo import took too long. Select fewer properties and try again.');
      const url = new URL(source);
      if (url.protocol !== 'https:' || url.port || url.username || url.password || !PHOTO_HOSTS.has(url.hostname)) {
        throw new IntegrationError('A property uses an unsupported photo host. Contact Pagecraft support before importing it.');
      }
      const response = await request(url.href, { redirect: 'error', signal: controller.signal });
      if (!response.ok) { await response.body?.cancel(); throw new IntegrationError('A property photo could not be downloaded. Check it in Uplisting and try again.'); }
      const reader = response.body?.getReader(); if (!reader) throw new Error('empty photo');
      const chunks: Uint8Array[] = []; let length = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.length;
        if (length > MAX_BYTES) { await reader.cancel(); throw new IntegrationError('A cover photo exceeds the 10 MB media limit. Reduce it in Uplisting and retry.'); }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks), type = sniff(bytes);
      if (!type || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type)) throw new IntegrationError('A cover photo has an unsupported image format. Use JPEG, PNG, WebP or AVIF.');
      const hash = createHash('sha256').update(bytes).digest('hex'), id = 'uplisting-photo-' + hash.slice(0, 40);
      if (!await assets.get(siteId, id)) {
        const output = await optimizeImage(bytes, type);
        await assets.put({ id, siteId, name: `uplisting-cover-${hash.slice(0, 8)}.${output.extension}`, type: output.type, bytes: output.bytes, w: output.w, h: output.h, contentHash: hash },
          { ownerId, limitBytes: FREE_STORAGE_BYTES, originalBytes: bytes.length, optimized: true });
      }
      property.values.image = 'asset:' + id;
    }
  };
  try {
    // Await both workers even on failure: nothing continues after the operation lock is released.
    const results = await Promise.allSettled([worker(), worker()]);
    const failed = results.find(r => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    return copies;
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError('Could not import property photos. Check your media storage allowance and try fewer properties.');
  } finally { clearTimeout(timer); controller.abort(); }
}
