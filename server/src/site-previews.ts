/** Derived dashboard artwork, scoped to this deployment. One bounded record per site.
 * This cache never changes the saved document or a published release. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const previewVersion = (site: { version: number; publishedPublicationId?: string | null }) =>
  `${site.version}:${site.publishedPublicationId || ''}`;
export const previewUrl = (id: string, version: string) =>
  `/api/sites/${encodeURIComponent(id)}/dashboard-thumbnail?version=${encodeURIComponent(version)}`;
export interface SitePreview { version: string; image: string; etag: string }
export interface SitePreviewStore {
  get(id: string): Promise<SitePreview | null>;
  put(id: string, version: string, bytes: Uint8Array): Promise<void>;
  remove(id: string): Promise<void>;
}
const record = (version: string, bytes: Uint8Array): SitePreview => ({
  version, image: Buffer.from(bytes).toString('base64'),
  etag: createHash('sha256').update(bytes).digest('hex'),
});
export class MemorySitePreviewStore implements SitePreviewStore {
  private rows = new Map<string, SitePreview>();
  async get(id: string) { return this.rows.get(id) || null; }
  async put(id: string, version: string, bytes: Uint8Array) {
    this.rows.set(id, record(version, bytes));
  }
  async remove(id: string) { this.rows.delete(id); }
}
export class FileSitePreviewStore implements SitePreviewStore {
  private root: string;
  constructor(root: string) { this.root = root; }
  private path(id: string) { return join(this.root, createHash('sha256').update(id).digest('hex') + '.json'); }
  async get(id: string): Promise<SitePreview | null> {
    try { return JSON.parse(await readFile(this.path(id), 'utf8')); }
    catch { return null; } // Cache loss cannot prevent access to the user's site.
  }
  async put(id: string, version: string, bytes: Uint8Array) {
    if (!bytes.length || bytes.length > 1024 * 1024) throw new Error('Invalid preview size');
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const temporary = this.path(id) + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(record(version, bytes)), { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.path(id));
    } finally { await rm(temporary, { force: true }); }
  }
  async remove(id: string) { await rm(this.path(id), { force: true }); }
}
