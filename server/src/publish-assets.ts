import type { Asset, AssetRecord } from './assets.ts';

/* Publishing and preview snapshots need every referenced image's bytes. Each read is a
   gateway round trip across the Pacific plus a base64 body (about 1.5 s for a photo), and
   they used to run one after another: 15 images, about 17 s. Reads now run a few at a time,
   and bytes are kept by site, id and content hash. An id can be re-uploaded with new bytes,
   but never under the same hash, so a hit is always the current image; images whose
   metadata carries no hash, or whose bytes do not match it, are never kept. */
export interface PublishAssetReaderOptions {
  concurrency?: number;
  cacheBytes?: number;
}

export function publishAssetReader(
  get: (siteId: string, id: string) => Promise<Asset | null>,
  options: PublishAssetReaderOptions = {},
) {
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const budget = options.cacheBytes ?? 48 * 1024 * 1024;
  const kept = new Map<string, Asset>();
  let keptBytes = 0;
  const keyOf = (siteId: string, meta: AssetRecord) =>
    meta.contentHash ? `${siteId}\n${meta.id}\n${meta.contentHash}` : '';
  const keep = (key: string, meta: AssetRecord, asset: Asset) => {
    if (!key || asset.contentHash !== meta.contentHash || asset.bytes.byteLength > budget / 8) return;
    const prior = kept.get(key);
    if (prior) keptBytes -= prior.bytes.byteLength;
    kept.delete(key);
    kept.set(key, asset);
    keptBytes += asset.bytes.byteLength;
    while (keptBytes > budget) {
      const [oldest, value] = kept.entries().next().value as [string, Asset];
      kept.delete(oldest);
      keptBytes -= value.bytes.byteLength;
    }
  };
  return async (siteId: string, selected: AssetRecord[]): Promise<Asset[]> => {
    const out: (Asset | null)[] = new Array(selected.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < selected.length) {
        const index = next++;
        const meta = selected[index];
        const key = keyOf(siteId, meta);
        const hit = key ? kept.get(key) : undefined;
        if (hit) {
          kept.delete(key);
          kept.set(key, hit);
          out[index] = hit;
          continue;
        }
        const asset = await get(siteId, meta.id);
        if (asset) keep(key, meta, asset);
        out[index] = asset;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));
    return out.filter((asset): asset is Asset => !!asset);
  };
}
