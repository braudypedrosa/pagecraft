import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { Doc } from '../../app/src/core/types.ts';
import type { Asset } from './assets.ts';
import { sha256 } from './releases.ts';
import { validatePortablePackage, type PortablePackageValidation } from './portable-packages.ts';

export interface SiteTemplateSummary {
  format: 'pagecraft.site-template.v1';
  id: string;
  version: string;
  name: string;
  sampleName: string;
  description: string;
  categories: string[];
  pages: Array<{ id: string; name: string; slug: string }>;
  packageFile: string;
  packageSha256: string;
  previewPage: string;
  assetCount: number;
  assetBytes: number;
}

export interface InstantiatedSiteTemplate {
  template: SiteTemplateSummary;
  document: Doc;
  assets: Asset[];
}

export interface SiteTemplateStore {
  list(): Promise<SiteTemplateSummary[]>;
  instantiate(id: string, version?: string): Promise<InstantiatedSiteTemplate | null>;
  preview(id: string, version: string, path: string): Promise<{ bytes: Uint8Array; mediaType: string } | null>;
}

const HASH = /^[a-f0-9]{64}$/;
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const safeTemplate = (value: unknown): SiteTemplateSummary | null => {
  const item = value as Partial<SiteTemplateSummary>;
  if (item.format !== 'pagecraft.site-template.v1' || !SEGMENT.test(String(item.id || ''))
    || !VERSION.test(String(item.version || '')) || !item.name || !item.sampleName || !item.description
    || !Array.isArray(item.categories) || !item.categories.every(value => typeof value === 'string' && value)
    || !Array.isArray(item.pages) || item.pages.length < 1
    || !item.pages.every((page) => {
      const record = page as { id?: unknown; name?: unknown; slug?: unknown };
      return SEGMENT.test(String(record?.id || ''))
        && typeof record?.name === 'string' && record.name.trim().length > 0
        && SEGMENT.test(String(record?.slug || ''));
    })
    || item.packageFile !== 'site.pagecraft-site.zip' || !HASH.test(String(item.packageSha256 || ''))
    || !/^[a-z0-9][a-z0-9/-]*\.html$/.test(String(item.previewPage || ''))
    || !Number.isInteger(item.assetCount) || Number(item.assetCount) < 0
    || !Number.isInteger(item.assetBytes) || Number(item.assetBytes) < 0) return null;
  return item as SiteTemplateSummary;
};

const mediaType = (path: string) => {
  if (/\.html$/i.test(path)) return 'text/html; charset=utf-8';
  if (/\.css$/i.test(path)) return 'text/css; charset=utf-8';
  if (/\.webp$/i.test(path)) return 'image/webp';
  if (/\.png$/i.test(path)) return 'image/png';
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  if (/\.svg$/i.test(path)) return 'image/svg+xml';
  return 'application/octet-stream';
};

const replaceAssets = (value: unknown, ids: Map<string, string>): unknown => {
  if (typeof value === 'string') {
    let out = value;
    for (const [from, to] of [...ids].sort(([a], [b]) => b.length - a.length)) {
      out = out.split(`asset:${from}`).join(`asset:${to}`);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(item => replaceAssets(item, ids));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceAssets(item, ids)]));
  }
  return value;
};

export class FileSiteTemplateStore implements SiteTemplateStore {
  private root: string;
  private catalog: SiteTemplateSummary[] | null = null;
  private packages = new Map<string, PortablePackageValidation>();

  constructor(root: string) { this.root = resolve(root); }

  private path(...parts: string[]) {
    const path = resolve(this.root, ...parts);
    if (path !== this.root && !path.startsWith(this.root + sep)) throw new Error('template path escaped its root');
    return path;
  }

  async list() {
    if (this.catalog) return structuredClone(this.catalog);
    const raw = JSON.parse(await readFile(this.path('catalog.json'), 'utf8')) as { format?: string; templates?: unknown[] };
    if (raw.format !== 'pagecraft.site-template-catalog.v1' || !Array.isArray(raw.templates)) {
      throw new Error('site template catalog is invalid');
    }
    const templates = raw.templates.map(safeTemplate);
    if (templates.some(item => !item)) throw new Error('site template catalog contains an invalid template');
    const unique = new Set(templates.map(item => `${item!.id}@${item!.version}`));
    if (unique.size !== templates.length) throw new Error('site template catalog contains duplicate versions');
    this.catalog = templates as SiteTemplateSummary[];
    return structuredClone(this.catalog);
  }

  private async load(template: SiteTemplateSummary) {
    const key = `${template.id}@${template.version}`;
    const cached = this.packages.get(key);
    if (cached) return cached;
    const bytes = new Uint8Array(await readFile(this.path(template.id, template.version, template.packageFile)));
    if (sha256(bytes) !== template.packageSha256) throw new Error(`site template ${key} failed package integrity verification`);
    const validated = validatePortablePackage(bytes);
    const pages = validated.document.pages.map(page => ({ id: page.id, name: page.name, slug: page.slug }));
    const assetFiles = validated.manifest.files.filter(file => file.role === 'asset');
    const assetBytes = assetFiles.reduce(
      (total, file) => total + (validated.files.get(file.path)?.byteLength || 0),
      0,
    );
    if (validated.manifest.kind !== 'site'
      || JSON.stringify(pages) !== JSON.stringify(template.pages)
      || assetFiles.length !== template.assetCount
      || assetBytes !== template.assetBytes
      || !validated.files.has(`previews/${template.previewPage}`)) {
      throw new Error(`site template ${key} does not match its catalog record`);
    }
    this.packages.set(key, validated);
    return validated;
  }

  async instantiate(id: string, version?: string): Promise<InstantiatedSiteTemplate | null> {
    const templates = await this.list();
    const matches = templates.filter(item => item.id === id && (!version || item.version === version));
    const template = matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
    if (!template) return null;
    const validated = await this.load(template);
    const idMap = new Map(validated.dependencies.assets.map(id => [id, crypto.randomUUID()]));
    const document = replaceAssets(structuredClone(validated.document), idMap) as Doc;
    const assets: Asset[] = validated.manifest.files.filter(file => file.role === 'asset').map(file => ({
      id: idMap.get(file.asset!.id)!, siteId: '', name: file.asset!.name, type: file.mediaType,
      w: file.asset!.width, h: file.asset!.height, bytes: new Uint8Array(validated.files.get(file.path)!)
    }));
    return { template: structuredClone(template), document, assets };
  }

  async preview(id: string, version: string, path: string) {
    const template = (await this.list()).find(item => item.id === id && item.version === version);
    if (!template) return null;
    const clean = path.replace(/^\/+/, '') || template.previewPage;
    if (clean.includes('..') || clean.includes('\\')) return null;
    const validated = await this.load(template);
    const candidates = [`previews/${clean}`, `compiled/${clean}`, clean];
    for (const candidate of candidates) {
      const bytes = validated.files.get(candidate);
      if (bytes) return { bytes: new Uint8Array(bytes), mediaType: mediaType(candidate) };
    }
    return null;
  }
}
