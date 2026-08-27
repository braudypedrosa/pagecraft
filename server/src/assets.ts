/* Where the images live.

   In the single-file editor they are blobs in IndexedDB, which is what makes that file work
   with no server — and also what makes it useless the moment two people share a site: a
   client on another machine sees every image as a placeholder, because the bytes were only
   ever in somebody else's browser.

   So the server owns them. An asset belongs to a site, carries the filename it was uploaded
   under, and is served at the same collision-safe path the export writes, from
   `assetFile` in the core, so a page served from here and the same page in an exported zip
   name the file identically. That agreement is the reason `assetFile` moved into the core
   rather than being written twice.

   Bytes stay out of the document. The document holds `asset:<id>` and nothing else, which is
   what keeps a save small and a render synchronous. */
import { assetFile } from '../../app/src/core/index.ts';

export interface AssetRecord {
  id: string;
  siteId: string;
  /** the uploaded filename, sanitised into the path by `assetFile` */
  name: string;
  type: string;
  /** intrinsic size, so the export can write width and height and the review can check them */
  w: number;
  h: number;
  /** Optimized bytes charged to the free account's shared media allowance. */
  storedBytes?: number;
  /** Source size is retained as metadata only; the source bytes are discarded. */
  originalBytes?: number;
  ownerId?: string;
  contentHash?: string;
  optimized?: boolean;
}

export interface Asset extends AssetRecord {
  bytes: Uint8Array;
}

/** What a listing hands back: everything except the bytes. */
export type AssetMeta = Omit<AssetRecord, 'siteId'> & { path: string };

export const metaOf = (a: AssetRecord): AssetMeta =>
  ({
    id: a.id, name: a.name, type: a.type, w: a.w, h: a.h,
    path: assetFile(a),
    ...(a.storedBytes == null ? {} : { storedBytes: a.storedBytes }),
    ...(a.originalBytes == null ? {} : { originalBytes: a.originalBytes }),
    ...(a.optimized == null ? {} : { optimized: a.optimized })
  });

/** The filename-only path older releases emitted. Public lookup keeps accepting it so already
    published markup and bookmarks do not break while new renders use the id-suffixed path. */
export const legacyAssetPath = (a: Pick<AssetRecord, 'id' | 'name'>) =>
  'assets/' + String(a.name || a.id).replace(/[^\w.-]+/g, '-').toLowerCase();

export interface AssetStore {
  /** Metadata only. Listing a library must never transfer every image body. */
  list(siteId: string): Promise<AssetRecord[]>;
  get(siteId: string, id: string): Promise<Asset | null>;
  /** by the path a rendered page asks for, e.g. `assets/logo-a123.png` */
  byPath(siteId: string, path: string): Promise<Asset | null>;
  put(a: Omit<Asset, 'id'> & { id?: string }, quota?: AssetQuota): Promise<AssetRecord>;
  /** Finalize a WordPress-originated asset only while its connection is active. Production
      stores lock that connection alongside the insert; the callback gives MemoryAssetStore
      the same ordering guarantee in tests. Null means the guard or exact-id binding failed. */
  putConnected(
    a: Omit<Asset, 'id'> & { id: string }, connectionId: string,
    active?: () => Promise<boolean>, quota?: AssetQuota
  ): Promise<AssetRecord | null>;
  remove(siteId: string, id: string): Promise<boolean>;
  usage(ownerId: string, limitBytes?: number): Promise<AssetUsage>;
}

export interface AssetQuota {
  ownerId: string;
  limitBytes: number;
  originalBytes: number;
  optimized: boolean;
}

export interface AssetUsage { usedBytes: number; limitBytes: number }

export class AssetQuotaError extends Error {
  usage: AssetUsage;
  constructor(usage: AssetUsage) {
    super('free account media storage limit reached');
    this.name = 'AssetQuotaError';
    this.usage = usage;
  }
}

/** Ten megabytes. Large enough for a photograph nobody has thought about, small enough that
    one upload cannot fill a volume. */
export const MAX_BYTES = 10 * 1024 * 1024;
export const FREE_STORAGE_BYTES = 100 * 1024 * 1024;

/** What a browser will actually display, which is the only reason to accept an upload. */
export const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml']);

/**
 * The type from the bytes, not from what the upload claimed.
 *
 * A caller can say anything in `Content-Type`. These are the magic numbers, and an upload
 * whose bytes do not match a format we serve is refused — otherwise `image/png` is a way to
 * host arbitrary content on somebody's own domain.
 */
export function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  const has = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (has(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (has(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (has(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (has(0x52, 0x49, 0x46, 0x46) && has2(b, 8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  /* AVIF and other ISO-BMFF: `ftyp` at offset 4, brand after it */
  if (has2(b, 4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(b[8] || 0, b[9] || 0, b[10] || 0, b[11] || 0);
    if (/avif|avis|mif1|msf1/.test(brand)) return 'image/avif';
  }
  /* SVG is text, so it is sniffed by shape rather than by a signature. `<svg` may sit after
     an XML declaration, a doctype or a comment, so look at the head rather than byte zero. */
  const head = new TextDecoder().decode(b.slice(0, 1024)).toLowerCase();
  if (/<svg[\s>]/.test(head)) return 'image/svg+xml';
  return null;
}
const has2 = (b: Uint8Array, at: number, sig: number[]) => sig.every((v, i) => b[at + i] === v);

/**
 * Intrinsic size, read from the bytes.
 *
 * No image library: the four formats that matter put their dimensions within the first few
 * bytes, and pulling them out is a page of code against a dependency. Unknown means zero,
 * and zero means the export writes no width and height — the review already has a rule for
 * an image with no dimensions, so an unread size becomes a finding rather than a silent
 * layout shift.
 */
export function dimensions(bytes: Uint8Array, type: string): { w: number; h: number } {
  const b = bytes;
  const be32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const le16 = (i: number) => (b[i] | (b[i + 1] << 8));

  if (type === 'image/png' && b.length > 24) return { w: be32(16), h: be32(20) };
  if (type === 'image/gif' && b.length > 10) return { w: le16(6), h: le16(8) };
  if (type === 'image/jpeg') {
    /* walk the segments to the first frame header, which is where the size is */
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  if (type === 'image/svg+xml') {
    /* a viewBox is the honest size for an SVG, and width/height may be percentages */
    const head = new TextDecoder().decode(b.slice(0, 2048));
    const vb = head.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
    if (vb) return { w: Math.round(+vb[1]), h: Math.round(+vb[2]) };
  }
  return { w: 0, h: 0 };
}

export class MemoryAssetStore implements AssetStore {
  private all = new Map<string, Asset>();
  private quotas = new Map<string, AssetQuota>();
  private seq = 0;

  async list(siteId: string) {
    return [...this.all.values()]
      .filter(a => a.siteId === siteId)
      .map(({ bytes: _bytes, ...meta }) => ({ ...meta }));
  }
  async get(siteId: string, id: string) {
    const a = this.all.get(id);
    return a && a.siteId === siteId ? a : null;
  }
  async byPath(siteId: string, path: string) {
    for (const a of this.all.values()) {
      if (a.siteId !== siteId) continue;
      const current = metaOf(a).path;
      if (current === path || legacyAssetPath(a) === path) return a;
    }
    return null;
  }
  async put(a: Omit<Asset, 'id'> & { id?: string }, quota?: AssetQuota) {
    /* `a` + digits: the same shape the editor's own ids take, so a document written against
       one store opens against the other. */
    const id = a.id || 'a' + (++this.seq) + Math.random().toString(36).slice(2, 8);
    if (quota) {
      const prior = this.all.get(id);
      const used = [...this.all.entries()].reduce((total, [assetId, asset]) =>
        total + (this.quotas.get(assetId)?.ownerId === quota.ownerId ? asset.bytes.byteLength : 0), 0);
      const replacing = prior && this.quotas.get(id)?.ownerId === quota.ownerId ? prior.bytes.byteLength : 0;
      if (used - replacing + a.bytes.byteLength > quota.limitBytes) {
        throw new AssetQuotaError({ usedBytes: used, limitBytes: quota.limitBytes });
      }
      this.quotas.set(id, quota);
    }
    const rec: Asset = { ...a, id };
    this.all.set(id, rec);
    const { bytes: _bytes, ...meta } = rec;
    return { ...meta, storedBytes: rec.bytes.byteLength,
      originalBytes: quota?.originalBytes, ownerId: quota?.ownerId,
      optimized: quota?.optimized };
  }
  async putConnected(a: Omit<Asset, 'id'> & { id: string }, _connectionId: string,
    active?: () => Promise<boolean>, quota?: AssetQuota) {
    if (!active || !await active()) return null;
    const prior = this.all.get(a.id);
    if (prior && (prior.siteId !== a.siteId || prior.name !== a.name || prior.type !== a.type
      || prior.w !== a.w || prior.h !== a.h || !sameBytes(prior.bytes, a.bytes))) return null;
    return prior ? metaOfRecord(prior) : this.put(a, quota);
  }
  async remove(siteId: string, id: string) {
    const a = this.all.get(id);
    if (!a || a.siteId !== siteId) return false;
    this.all.delete(id);
    this.quotas.delete(id);
    return true;
  }

  async usage(ownerId: string, limitBytes = FREE_STORAGE_BYTES) {
    const usedBytes = [...this.all.entries()].reduce((total, [id, asset]) =>
      total + (this.quotas.get(id)?.ownerId === ownerId ? asset.bytes.byteLength : 0), 0);
    return { usedBytes, limitBytes };
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.byteLength === b.byteLength && a.every((value, index) => value === b[index]);
const metaOfRecord = (a: Asset): AssetRecord => {
  const { bytes: _bytes, ...meta } = a;
  return { ...meta };
};

/** The volume's half of the schema. Unexercised, like the rest of `store-pg.ts`. */
export const ASSET_SCHEMA = `
create table if not exists assets (
  id       text primary key,
  site_id  text not null references sites (id) on delete cascade,
  owner_id text references users (id) on delete restrict,
  name     text not null,
  type     text not null,
  w        integer not null default 0,
  h        integer not null default 0,
  bytes    bytea,
  storage_path text,
  stored_bytes bigint,
  original_bytes bigint,
  content_hash text,
  optimized boolean not null default false
);
create index if not exists assets_site_idx on assets (site_id);
create index if not exists assets_owner_idx on assets (owner_id);
create unique index if not exists assets_storage_path_key on assets (storage_path)
  where storage_path is not null;
`;
