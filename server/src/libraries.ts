/* Account-owned libraries (Phase 5, slice 1b).

   A library holds insert-only numbered versions and its own copies of the images they use, so
   a version never depends on the site it was published from. Publishing copies images out of
   the source site into the library; importing copies them into the receiving site through the
   ordinary asset path, charged to that site's storage owner. The document side is pure and
   lives in app/src/core/libraries.ts. See docs/phase5-libraries-design.md. */
import { createHash, randomUUID } from 'node:crypto';
import {
  bundleItemCount, extractLibraryBundle, remapBundleAssets,
  type LibraryBundle, type LibraryItemRef,
} from '../../app/src/core/libraries.ts';
import type { Doc } from '../../app/src/core/types.ts';
import { AssetQuotaError, type AssetRecord, type AssetStore } from './assets.ts';

export interface Library {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: number;
}
export interface LibraryVersionSummary {
  version: number;
  contentHash: string;
  itemCount: number;
  sourceSiteId: string | null;
  createdBy: string;
  createdAt: string;
}
export interface LibraryVersion extends LibraryVersionSummary { content: LibraryBundle }
export interface LibraryAsset { id: string; name: string; type: string; w: number; h: number; bytes: Uint8Array }

export interface LibraryStore {
  create(input: { ownerId: string; name: string }): Promise<Library>;
  listForOwner(ownerId: string): Promise<Library[]>;
  get(id: string): Promise<Library | null>;
  versions(id: string): Promise<LibraryVersionSummary[]>;
  version(id: string, version: number): Promise<LibraryVersion | null>;
  /** Insert-only: the next number is assigned atomically, a published version never changes. */
  publish(input: { libraryId: string; content: LibraryBundle; contentHash: string; itemCount: number; createdBy: string; sourceSiteId: string }): Promise<LibraryVersionSummary>;
  /** Which of these image ids the library already holds. */
  hasAssets(libraryId: string, ids: string[]): Promise<string[]>;
  /** Store one image under its content hash. Counts toward `ownerId`'s allowance. */
  putAsset(libraryId: string, asset: LibraryAsset, quota: { ownerId: string; limitBytes: number }): Promise<void>;
  asset(libraryId: string, id: string): Promise<LibraryAsset | null>;
}

export const LIBRARY_NAME_MAX = 80;
export const LIBRARY_ITEMS_MAX = 200;
const HASH = /^[a-f0-9]{64}$/;
const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export const libraryContentHash = (bundle: LibraryBundle) => sha256(JSON.stringify(bundle));

export class MemoryLibraryStore implements LibraryStore {
  private libraries = new Map<string, Library>();
  private versionRows = new Map<string, LibraryVersion[]>();
  private assets = new Map<string, Map<string, LibraryAsset>>();

  async create(input: { ownerId: string; name: string }) {
    const now = new Date().toISOString();
    const library: Library = { id: randomUUID(), ownerId: input.ownerId, name: input.name, createdAt: now, updatedAt: now, latestVersion: 0 };
    this.libraries.set(library.id, library);
    return { ...library };
  }
  async listForOwner(ownerId: string) {
    return [...this.libraries.values()].filter(l => l.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(l => ({ ...l }));
  }
  async get(id: string) {
    const library = this.libraries.get(id);
    return library ? { ...library } : null;
  }
  async versions(id: string) {
    return (this.versionRows.get(id) || []).map(({ content: _content, ...summary }) => ({ ...summary })).reverse();
  }
  async version(id: string, version: number) {
    const row = (this.versionRows.get(id) || []).find(v => v.version === version);
    return row ? structuredClone(row) : null;
  }
  async publish(input: { libraryId: string; content: LibraryBundle; contentHash: string; itemCount: number; createdBy: string; sourceSiteId: string }) {
    const library = this.libraries.get(input.libraryId);
    if (!library) throw new Error('library not found');
    const rows = this.versionRows.get(input.libraryId) || [];
    const row: LibraryVersion = {
      version: rows.length + 1, contentHash: input.contentHash, itemCount: input.itemCount, sourceSiteId: input.sourceSiteId,
      createdBy: input.createdBy, createdAt: new Date().toISOString(), content: structuredClone(input.content),
    };
    this.versionRows.set(input.libraryId, [...rows, row]);
    library.latestVersion = row.version;
    library.updatedAt = row.createdAt;
    const { content: _content, ...summary } = row;
    return summary;
  }
  async hasAssets(libraryId: string, ids: string[]) {
    const held = this.assets.get(libraryId);
    return ids.filter(id => held?.has(id));
  }
  async putAsset(libraryId: string, asset: LibraryAsset, quota: { ownerId: string; limitBytes: number }) {
    const used = [...this.libraries.values()].filter(l => l.ownerId === quota.ownerId)
      .reduce((n, l) => n + [...(this.assets.get(l.id)?.values() || [])].reduce((m, a) => m + a.bytes.byteLength, 0), 0);
    if (used + asset.bytes.byteLength > quota.limitBytes) {
      throw new AssetQuotaError({ usedBytes: used, limitBytes: quota.limitBytes });
    }
    const held = this.assets.get(libraryId) || new Map<string, LibraryAsset>();
    if (!held.has(asset.id)) held.set(asset.id, { ...asset, bytes: asset.bytes.slice() });
    this.assets.set(libraryId, held);
  }
  async asset(libraryId: string, id: string) {
    const found = this.assets.get(libraryId)?.get(id);
    return found ? { ...found, bytes: found.bytes.slice() } : null;
  }
}

export interface LibraryDeps { libraries: LibraryStore; assets: AssetStore }

/** Publish `items` from a site's saved document as the library's next version. Images are
    copied into the library first, so the stored version names only the library's copies. */
export async function publishLibraryVersion(d: LibraryDeps, input: {
  library: Library; siteId: string; doc: Doc; items: LibraryItemRef[]; userId: string; schemaVersion: number; limitBytes: number;
}) {
  const bundle = extractLibraryBundle(input.doc, input.items, input.schemaVersion);
  const map: Record<string, string> = {};
  const images = new Map<string, LibraryAsset>();
  for (const id of bundle.assets) {
    const source = await d.assets.get(input.siteId, id);
    if (!source) throw new LibraryImageError(`An image this item uses (${id}) is no longer in the site.`);
    const hash = sha256(source.bytes);
    map[id] = hash;
    images.set(hash, { id: hash, name: source.name, type: source.type, w: source.w, h: source.h, bytes: source.bytes });
  }
  const held = new Set(await d.libraries.hasAssets(input.library.id, [...images.keys()]));
  for (const image of images.values()) {
    if (!held.has(image.id)) await d.libraries.putAsset(input.library.id, image, { ownerId: input.library.ownerId, limitBytes: input.limitBytes });
  }
  const content = remapBundleAssets(bundle, map);
  return d.libraries.publish({
    libraryId: input.library.id, content, contentHash: libraryContentHash(content), itemCount: bundleItemCount(content),
    createdBy: input.userId, sourceSiteId: input.siteId,
  });
}

/** Copy a version's images into a site and return library id → site asset id. An image the site
    already holds from an earlier import (same content hash, not retired) is reused, not copied. */
export async function copyLibraryAssetsToSite(d: LibraryDeps, input: {
  libraryId: string; ids: string[]; siteId: string; ownerId: string; limitBytes: number;
}) {
  const ids = [...new Set(input.ids)];
  if (ids.some(id => !HASH.test(id))) throw new LibraryImageError('Unknown library image.');
  const existing = new Map<string, AssetRecord>();
  for (const record of await d.assets.list(input.siteId)) {
    if (record.contentHash && !record.retired && !existing.has(record.contentHash)) existing.set(record.contentHash, record);
  }
  const map: Record<string, string> = {};
  for (const id of ids) {
    const reuse = existing.get(id);
    if (reuse) { map[id] = reuse.id; continue; }
    const image = await d.libraries.asset(input.libraryId, id);
    if (!image) throw new LibraryImageError(`The library is missing an image (${id}).`);
    const saved = await d.assets.put({
      siteId: input.siteId, name: image.name, type: image.type, w: image.w, h: image.h, bytes: image.bytes, contentHash: id,
    }, { ownerId: input.ownerId, limitBytes: input.limitBytes, originalBytes: image.bytes.byteLength, optimized: true });
    map[id] = saved.id;
  }
  return map;
}

export class LibraryImageError extends Error {}
export { AssetQuotaError };
