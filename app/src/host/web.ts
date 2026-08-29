import type { UnknownDocumentInput } from '../core/types';
import { authenticationAdapter, menuAdapter, pageAdapter, revisionAdapter, settingsAdapter } from './shared';
import { FetchHostTransport, type FetchLike, type HostTransport } from './transport';
import { adoptHostDocument } from './schema';
import type { HostCapability, HostFeatures, HostMedia, HostSession, WebHostAdapter } from './types';

export interface WebHostOptions {
  siteId: string;
  sessionToken?: string;
  role?: 'owner' | 'content';
  userId?: string;
  userName?: string;
  document?: UnknownDocumentInput;
  version?: number;
  baseUrl?: string;
  fetch?: FetchLike;
  transport?: HostTransport;
}

export const WEB_HOST_FEATURES: Readonly<HostFeatures> = Object.freeze({
  sites: true,
  account: true,
  billing: true,
  sharing: true,
  hostedPublishing: true,
  cloudPageManager: true,
  projectExport: true,
  pages: 'pagecraft',
  media: 'pagecraft',
  menus: 'pagecraft',
  revisions: 'pagecraft',
  preview: 'pagecraft',
  publishing: 'pagecraft',
  globals: 'pagecraft',
  dynamicContent: 'pagecraft'
});

const webCapabilities = (role: WebHostOptions['role']): HostCapability[] => role === 'content'
  ? ['edit_document']
  : ['edit_document', 'edit_structure', 'publish', 'upload_media', 'manage_pages',
    'manage_menus', 'manage_settings', 'restore_revisions'];

export function createWebHostAdapter(options: WebHostOptions): WebHostAdapter {
  const site = encodeURIComponent(options.siteId);
  const transport = options.transport || new FetchHostTransport(
    options.baseUrl || '',
    options.fetch || globalThis.fetch.bind(globalThis),
    (): Readonly<Record<string, string>> => options.sessionToken
      ? { 'X-Pagecraft-Editor-Session': options.sessionToken }
      : {}
  );
  const session: HostSession = {
    authenticated: !!options.role || !!options.sessionToken,
    userId: options.userId || '',
    displayName: options.userName || '',
    capabilities: webCapabilities(options.role)
  };
  const initial = options.document
    ? { document: options.document, version: options.version || 1 }
    : undefined;
  const assetRoot = `/api/sites/${site}/assets`;
  const asMedia = (row: any, size = 0): HostMedia => ({
    id: String(row.id), name: String(row.name || 'asset'), mimeType: String(row.mimeType || row.type || ''),
    url: String(row.url || `${assetRoot}/${encodeURIComponent(String(row.id))}`),
    size: Number(row.size || row.storedBytes || size || 0),
    width: Number(row.width ?? row.w ?? 0), height: Number(row.height ?? row.h ?? 0)
  });
  return {
    kind: 'web',
    features: WEB_HOST_FEATURES,
    authentication: authenticationAdapter(session),
    documents: {
      async load() {
        const row: { document?: unknown; doc?: unknown; version: number } = initial
          || (await transport.request<{ document?: unknown; doc?: unknown; version: number }>({ path: `/api/sites/${site}` })).body;
        return { document: adoptHostDocument((row.document ?? row.doc) as any), version: row.version };
      },
      async save(input) {
        const doc = adoptHostDocument(input.document);
        return (await transport.request<{ version: number }>({
          method: 'PUT', path: `/api/sites/${site}`, body: { doc, version: input.version }
        })).body;
      }
    },
    pages: pageAdapter(transport, `/api/sites/${site}/pages`),
    menus: menuAdapter(transport, `/api/sites/${site}/menus`),
    revisions: revisionAdapter(transport, `/api/sites/${site}/history`),
    assets: {
      async list() { return (await transport.request<any[]>({ path: assetRoot })).body.map(row => asMedia(row)); },
      async download(id) {
        return (await transport.request<Blob>({ path: `${assetRoot}/${encodeURIComponent(id)}`, responseType: 'blob' })).body;
      },
      async upload(file, filename) {
        const form = new FormData();
        const name = filename || ('name' in file ? String((file as File).name || 'asset') : 'asset');
        form.set('file', file, name);
        const row = (await transport.request<any>({ method: 'POST', path: assetRoot, body: form })).body;
        return asMedia(row, file.size);
      },
      async remove(id) {
        await transport.request<unknown>({ method: 'DELETE', path: `${assetRoot}/${encodeURIComponent(id)}` });
      }
    },
    settings: settingsAdapter(transport, `/api/sites/${site}/settings`),
    releases: {
      async list() { return (await transport.request<unknown>({ path: `/api/sites/${site}/publication` })).body; },
      async publish(input) {
        return (await transport.request<unknown>({
          method: 'POST', path: `/api/sites/${site}/publish`, body: { ...input }
        })).body;
      }
    }
  };
}
