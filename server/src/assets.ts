/* Where the images live.

   In the single-file editor they are blobs in IndexedDB, which is what makes that file work
   with no server — and also what makes it useless the moment two people share a site: a
   client on another machine sees every image as a placeholder, because the bytes were only
   ever in somebody else's browser.

   So the server owns them. An asset belongs to a site, carries the filename it was uploaded
   under, and is served at the same path the export writes — `assets/<name>`, from
   `assetFile` in the core, so a page served from here and the same page in an exported zip
   name the file identically. That agreement is the reason `assetFile` moved into the core
   rather than being written twice.

   Bytes stay out of the document. The document holds `asset:<id>` and nothing else, which is
   what keeps a save small and a render synchronous. */
import { assetFile } from '../../app/src/core/index.ts';

export interface Asset {
  id: string;
  siteId: string;
  /** the uploaded filename, sanitised into the path by `assetFile` */
  name: string;
  type: string;
  /** intrinsic size, so the export can write width and height and the review can check them */
  w: number;
  h: number;
  bytes: Uint8Array;
}

/** What a listing hands back: everything except the bytes. */
export type AssetMeta = Omit<Asset, 'bytes' | 'siteId'> & { path: string };

export const metaOf = (a: Asset): AssetMeta =>
  ({ id: a.id, name: a.name, type: a.type, w: a.w, h: a.h, path: assetFile(a) });

export interface AssetStore {
  list(siteId: string): Promise<Asset[]>;
  get(siteId: string, id: string): Promise<Asset | null>;
  /** by the path a rendered page asks for, e.g. `assets/logo.png` */
  byPath(siteId: string, path: string): Promise<Asset | null>;
  put(a: Omit<Asset, 'id'> & { id?: string }): Promise<Asset>;
  remove(siteId: string, id: string): Promise<boolean>;
}

/** Ten megabytes. Large enough for a photograph nobody has thought about, small enough that
    one upload cannot fill a volume. */
export const MAX_BYTES = 10 * 1024 * 1024;

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
  private seq = 0;

  async list(siteId: string) {
    return [...this.all.values()].filter(a => a.siteId === siteId);
  }
  async get(siteId: string, id: string) {
    const a = this.all.get(id);
    return a && a.siteId === siteId ? a : null;
  }
  async byPath(siteId: string, path: string) {
    for (const a of this.all.values()) if (a.siteId === siteId && assetFile(a) === path) return a;
    return null;
  }
  async put(a: Omit<Asset, 'id'> & { id?: string }) {
    /* `a` + digits: the same shape the editor's own ids take, so a document written against
       one store opens against the other. */
    const id = a.id || 'a' + (++this.seq) + Math.random().toString(36).slice(2, 8);
    const rec: Asset = { ...a, id };
    this.all.set(id, rec);
    return rec;
  }
  async remove(siteId: string, id: string) {
    const a = this.all.get(id);
    if (!a || a.siteId !== siteId) return false;
    this.all.delete(id);
    return true;
  }
}

/** The volume's half of the schema. Unexercised, like the rest of `store-pg.ts`. */
export const ASSET_SCHEMA = `
create table if not exists assets (
  id       text primary key,
  site_id  text not null references sites (id) on delete cascade,
  name     text not null,
  type     text not null,
  w        integer not null default 0,
  h        integer not null default 0,
  bytes    bytea not null
);
create index if not exists assets_site_idx on assets (site_id);
`;
