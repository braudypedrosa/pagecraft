import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const decoder = new TextDecoder('utf-8', { fatal: true });
const HASH = /^[a-f0-9]{64}$/;

export interface PublicationInputFile {
  path: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface PublicationFile {
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
}

export interface PublicationSummary {
  format: 'pagecraft.hosted-publication.v1';
  id: string;
  siteId: string;
  slug: string;
  host: string;
  sourceVersion: number;
  createdAt: string;
  contentHash: string;
  files: PublicationFile[];
}

export interface HostedPublicationStore {
  create(input: {
    siteId: string;
    slug: string;
    host: string;
    sourceVersion: number;
    files: PublicationInputFile[];
  }): Promise<PublicationSummary>;
  byId(siteId: string, publicationId: string): Promise<PublicationSummary | null>;
  currentBySlug(slug: string): Promise<PublicationSummary | null>;
  currentByHost(host: string): Promise<PublicationSummary | null>;
  promote(publication: PublicationSummary): Promise<void>;
  file(publication: PublicationSummary, path: string): Promise<Uint8Array | null>;
}

const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

export function safePublicationPath(raw: string): string | null {
  const path = String(raw || '').replace(/^\/+/, '');
  if (!path || path.length > 512 || path.includes('\\') || path.includes('\0')) return null;
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  if (!parts.every(part => /^[A-Za-z0-9._@+-]+$/.test(part))) return null;
  return parts.join('/');
}

function validateInput(input: {
  siteId: string; slug: string; host: string; sourceVersion: number; files: PublicationInputFile[];
}) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.siteId)) throw new Error('invalid publication site id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new Error('invalid publication slug');
  if (!input.host || input.host.length > 253 || /[\s/\\?#@]/.test(input.host)) throw new Error('invalid publication host');
  if (!Number.isInteger(input.sourceVersion) || input.sourceVersion < 1) throw new Error('invalid publication version');
  if (!input.files.length || input.files.length > 10_000) throw new Error('invalid publication file count');
  const paths = new Set<string>();
  for (const file of input.files) {
    const path = safePublicationPath(file.path);
    if (!path || path !== file.path || paths.has(path.toLowerCase())) throw new Error(`invalid publication path: ${file.path}`);
    if (!file.mediaType || file.mediaType.length > 200) throw new Error(`invalid publication media type: ${path}`);
    if (!(file.bytes instanceof Uint8Array) || file.bytes.byteLength > 100 * 1024 * 1024) {
      throw new Error(`invalid publication file: ${path}`);
    }
    paths.add(path.toLowerCase());
  }
}

function summaryFor(input: {
  siteId: string; slug: string; host: string; sourceVersion: number; files: PublicationInputFile[];
}): PublicationSummary {
  const files = input.files.map(file => ({
    path: file.path,
    mediaType: file.mediaType,
    bytes: file.bytes.byteLength,
    sha256: sha256(file.bytes)
  })).sort((left, right) => left.path.localeCompare(right.path, 'en'));
  return {
    format: 'pagecraft.hosted-publication.v1',
    id: randomUUID(),
    siteId: input.siteId,
    slug: input.slug,
    host: input.host.toLowerCase(),
    sourceVersion: input.sourceVersion,
    createdAt: new Date().toISOString(),
    contentHash: sha256(JSON.stringify({
      slug: input.slug, host: input.host.toLowerCase(), sourceVersion: input.sourceVersion, files
    })),
    files
  };
}

function validSummary(value: unknown): value is PublicationSummary {
  if (!value || typeof value !== 'object') return false;
  const row = value as PublicationSummary;
  return row.format === 'pagecraft.hosted-publication.v1'
    && /^[0-9a-f-]{36}$/i.test(row.id)
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(row.siteId)
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)
    && Number.isInteger(row.sourceVersion) && row.sourceVersion > 0
    && HASH.test(row.contentHash)
    && Array.isArray(row.files)
    && row.files.every(file => !!safePublicationPath(file.path) && HASH.test(file.sha256)
      && Number.isInteger(file.bytes) && file.bytes >= 0 && typeof file.mediaType === 'string');
}

export class MemoryHostedPublicationStore implements HostedPublicationStore {
  private publications = new Map<string, { summary: PublicationSummary; files: Map<string, Uint8Array> }>();
  private slugs = new Map<string, string>();
  private hosts = new Map<string, string>();
  private siteAliases = new Map<string, { slug: string; host: string }>();

  async create(input: {
    siteId: string; slug: string; host: string; sourceVersion: number; files: PublicationInputFile[];
  }) {
    validateInput(input);
    const summary = summaryFor(input);
    this.publications.set(summary.id, {
      summary: structuredClone(summary),
      files: new Map(input.files.map(file => [file.path, file.bytes.slice()]))
    });
    return structuredClone(summary);
  }

  async byId(siteId: string, publicationId: string) {
    const row = this.publications.get(publicationId);
    return row?.summary.siteId === siteId ? structuredClone(row.summary) : null;
  }

  async currentBySlug(slug: string) {
    const id = this.slugs.get(slug);
    return id ? this.byId(this.publications.get(id)?.summary.siteId || '', id) : null;
  }

  async currentByHost(host: string) {
    const id = this.hosts.get(host.toLowerCase());
    return id ? this.byId(this.publications.get(id)?.summary.siteId || '', id) : null;
  }

  async promote(publication: PublicationSummary) {
    if (!await this.byId(publication.siteId, publication.id)) throw new Error('publication does not exist');
    const previous = this.siteAliases.get(publication.siteId);
    this.slugs.set(publication.slug, publication.id);
    this.hosts.set(publication.host.toLowerCase(), publication.id);
    this.siteAliases.set(publication.siteId, { slug: publication.slug, host: publication.host.toLowerCase() });
    const previousSlugId = previous ? this.slugs.get(previous.slug) : undefined;
    const previousHostId = previous ? this.hosts.get(previous.host) : undefined;
    if (previous && previous.slug !== publication.slug
      && this.publications.get(previousSlugId || '')?.summary.siteId === publication.siteId) {
      this.slugs.delete(previous.slug);
    }
    if (previous && previous.host !== publication.host.toLowerCase()
      && this.publications.get(previousHostId || '')?.summary.siteId === publication.siteId) {
      this.hosts.delete(previous.host);
    }
  }

  async file(publication: PublicationSummary, rawPath: string) {
    const path = safePublicationPath(rawPath);
    const row = this.publications.get(publication.id);
    if (!path || row?.summary.siteId !== publication.siteId) return null;
    return row.files.get(path)?.slice() || null;
  }
}

export class FileHostedPublicationStore implements HostedPublicationStore {
  private readonly root: string;

  constructor(root: string) {
    if (!root || !resolve(root).startsWith('/')) throw new Error('PAGECRAFT_PUBLICATION_ROOT must be an absolute path');
    this.root = resolve(root);
  }

  private publicationRoot(siteId: string, publicationId: string) {
    return join(this.root, 'publications', sha256(siteId), publicationId);
  }

  private pointerPath(kind: 'slug' | 'host', value: string) {
    return join(this.root, 'pointers', kind, `${sha256(value.toLowerCase())}.json`);
  }

  private siteAliasPath(siteId: string) {
    return join(this.root, 'pointers', 'site', `${sha256(siteId)}.json`);
  }

  private async atomicJson(path: string, value: unknown) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(value));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
  }

  async create(input: {
    siteId: string; slug: string; host: string; sourceVersion: number; files: PublicationInputFile[];
  }) {
    validateInput(input);
    const summary = summaryFor(input);
    const finalRoot = this.publicationRoot(summary.siteId, summary.id);
    const temporary = join(this.root, 'tmp', `${summary.id}.${randomUUID()}`);
    await mkdir(dirname(temporary), { recursive: true, mode: 0o700 });
    await mkdir(temporary, { recursive: false, mode: 0o700 });
    try {
      for (const file of input.files) {
        const destination = join(temporary, 'files', file.path);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        const handle = await open(destination, 'wx', 0o600);
        try {
          await handle.writeFile(file.bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
      }
      await this.atomicJson(join(temporary, 'manifest.json'), summary);
      for (const record of summary.files) {
        const stored = new Uint8Array(await readFile(join(temporary, 'files', record.path)));
        if (stored.byteLength !== record.bytes || sha256(stored) !== record.sha256) {
          throw new Error(`publication verification failed: ${record.path}`);
        }
      }
      await mkdir(dirname(finalRoot), { recursive: true, mode: 0o700 });
      await rename(temporary, finalRoot);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
    return summary;
  }

  async byId(siteId: string, publicationId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return null;
    try {
      const value = JSON.parse(decoder.decode(await readFile(join(this.publicationRoot(siteId, publicationId), 'manifest.json'))));
      return validSummary(value) && value.siteId === siteId && value.id === publicationId ? value : null;
    } catch { return null; }
  }

  private async current(kind: 'slug' | 'host', value: string) {
    try {
      const pointer = JSON.parse(decoder.decode(await readFile(this.pointerPath(kind, value)))) as {
        siteId?: string; publicationId?: string; value?: string;
      };
      if (pointer.value !== value.toLowerCase() || !pointer.siteId || !pointer.publicationId) return null;
      return this.byId(pointer.siteId, pointer.publicationId);
    } catch { return null; }
  }

  currentBySlug(slug: string) { return this.current('slug', slug); }
  currentByHost(host: string) { return this.current('host', host.toLowerCase()); }

  async promote(publication: PublicationSummary) {
    if (!await this.byId(publication.siteId, publication.id)) throw new Error('publication does not exist');
    const pointer = { siteId: publication.siteId, publicationId: publication.id };
    let previous: { slug?: string; host?: string } = {};
    try {
      previous = JSON.parse(decoder.decode(await readFile(this.siteAliasPath(publication.siteId))));
    } catch { /* The first publication has no prior aliases. */ }
    await this.atomicJson(this.pointerPath('slug', publication.slug), { ...pointer, value: publication.slug });
    await this.atomicJson(this.pointerPath('host', publication.host), { ...pointer, value: publication.host.toLowerCase() });
    await this.atomicJson(this.siteAliasPath(publication.siteId), {
      siteId: publication.siteId, slug: publication.slug, host: publication.host.toLowerCase()
    });
    await Promise.all([
      previous.slug && previous.slug !== publication.slug
        ? this.removeOwnedPointer('slug', previous.slug, publication.siteId)
        : undefined,
      previous.host && previous.host !== publication.host.toLowerCase()
        ? this.removeOwnedPointer('host', previous.host, publication.siteId)
        : undefined
    ]);
  }

  private async removeOwnedPointer(kind: 'slug' | 'host', value: string, siteId: string) {
    const path = this.pointerPath(kind, value);
    try {
      const pointer = JSON.parse(decoder.decode(await readFile(path))) as { siteId?: string };
      if (pointer.siteId === siteId) await unlink(path);
    } catch { /* Missing or malformed stale pointers are already unavailable. */ }
  }

  async file(publication: PublicationSummary, rawPath: string) {
    const path = safePublicationPath(rawPath);
    const record = path && publication.files.find(file => file.path === path);
    if (!path || !record) return null;
    const location = join(this.publicationRoot(publication.siteId, publication.id), 'files', path);
    try {
      const info = await stat(location);
      if (!info.isFile() || info.size !== record.bytes) return null;
      const bytes = new Uint8Array(await readFile(location));
      return sha256(bytes) === record.sha256 ? bytes : null;
    } catch { return null; }
  }
}
