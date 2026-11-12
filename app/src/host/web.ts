import type { UnknownDocumentInput } from '../core/types';
import { authenticationAdapter, menuAdapter, pageAdapter, revisionAdapter, settingsAdapter } from './shared';
import { FetchHostTransport, type FetchLike, type HostTransport } from './transport';
import { adoptHostDocument } from './schema';
import type { LibraryBundle } from '../core/libraries';
import type {
  HostCapability, HostFeatures, HostMedia, HostSession, WebLibrary, WebLibraryMember, WebLibraryVersionSummary, WebProposal, WebPublicationSchedule,
  WebPublicationSnapshot, WebHostAdapter
} from './types';

export interface WebHostOptions {
  siteId: string;
  apiRoot?: string;
  templateDraft?: boolean;
  getDraftRevision?: () => number;
  onDraftRevision?: (revision: number, previousRevision: number) => void;
  sessionToken?: string;
  role?: 'owner' | 'content' | 'reviewer';
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
  dynamicContent: 'pagecraft',
  managedForms: false
});

const webCapabilities = (role: WebHostOptions['role']): HostCapability[] => {
  if (role === 'reviewer') return [];
  if (role === 'content') return ['edit_document'];
  return ['edit_document', 'edit_structure', 'publish', 'upload_media', 'manage_pages',
    'manage_menus', 'manage_settings', 'restore_revisions'];
};

const cloudSaveResponse = (body: unknown): { version: number } => {
  const version = body && typeof body === 'object'
    ? (body as { version?: unknown }).version
    : undefined;
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    throw new TypeError('Invalid Cloud save response: expected a finite numeric version.');
  }
  return body as { version: number };
};

export function createWebHostAdapter(options: WebHostOptions): WebHostAdapter {
  const site = encodeURIComponent(options.siteId);
  const apiRoot = (options.apiRoot || `/api/sites/${site}`).replace(/\/$/, '');
  const features: Readonly<HostFeatures> = options.templateDraft ? Object.freeze({
    ...WEB_HOST_FEATURES, sites: false, account: false, billing: false, sharing: false,
    hostedPublishing: false, cloudPageManager: false, publishing: false, dynamicContent: false
  }) : WEB_HOST_FEATURES;
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
    capabilities: options.templateDraft && options.role !== 'reviewer'
      ? ['edit_document', 'edit_structure', 'upload_media', 'manage_pages', 'manage_menus', 'manage_settings', 'restore_revisions']
      : webCapabilities(options.role)
  };
  const initial = options.document
    ? { document: options.document, version: options.version || 1 }
    : undefined;
  const assetRoot = `${apiRoot}/assets`;
  const asMedia = (row: any, size = 0): HostMedia => ({
    id: String(row.id), name: String(row.name || 'asset'), mimeType: String(row.mimeType || row.type || ''),
    url: String(row.url || `${assetRoot}/${encodeURIComponent(String(row.id))}`),
    size: Number(row.size || row.storedBytes || size || 0),
    tags: row.tags || [], metadataVersion: Number(row.metadataVersion || 0), createdAt: row.createdAt || null,
    width: Number(row.width ?? row.w ?? 0), height: Number(row.height ?? row.h ?? 0)
  });
  return {
    kind: 'web',
    features,
    authentication: authenticationAdapter(session),
    documents: {
      async load() {
        const row: { document?: unknown; doc?: unknown; version: number } = initial
          || (await transport.request<{ document?: unknown; doc?: unknown; version: number }>({ path: `${apiRoot}` })).body;
        return { document: adoptHostDocument((row.document ?? row.doc) as any), version: row.version };
      },
      async save(input) {
        const doc = adoptHostDocument(input.document);
        const response = await transport.request<unknown>({
          method: 'PUT', path: `${apiRoot}`, body: { doc, version: input.version },
          ...(input.keepalive ? { keepalive: true } : {})
        });
        return cloudSaveResponse(response.body);
      }
    },
    pages: pageAdapter(transport, `${apiRoot}/pages`),
    menus: menuAdapter(transport, `${apiRoot}/menus`),
    revisions: revisionAdapter(transport, `${apiRoot}/history`),
    assets: {
      retainsHistory: true,
      ...(!options.templateDraft ? { async tag(id: string, tags: string[], version: number) {
        return asMedia((await transport.request<any>({method: 'PATCH', path: `${assetRoot}/${encodeURIComponent(id)}`, body: {tags, version}})).body);
      } } : {}),
      async list() { return (await transport.request<any[]>({ path: assetRoot })).body.map(row => asMedia(row)); },
      async download(id) {
        return (await transport.request<Blob>({ path: `${assetRoot}/${encodeURIComponent(id)}`, responseType: 'blob' })).body;
      },
      async upload(file, filename) {
        const form = new FormData();
        const name = filename || ('name' in file ? String((file as File).name || 'asset') : 'asset');
        form.set('file', file, name);
        const expected = options.templateDraft ? options.getDraftRevision?.() : undefined;
        if (options.templateDraft) {
          if (!Number.isSafeInteger(expected) || (expected as number) < 0 || !options.onDraftRevision) throw new Error('Template draft revision is unavailable. Reload before uploading.');
          form.set('revision', String(expected));
        }
        const row = (await transport.request<any>({ method: 'POST', path: assetRoot, body: form })).body;
        if (options.templateDraft) {
          if (row.previousRevision !== expected || !Number.isSafeInteger(row.revision) || row.revision !== (expected as number) + 1) throw new Error('Template draft revision could not be confirmed. Reload before continuing.');
          options.onDraftRevision!(row.revision, row.previousRevision);
        }
        return asMedia(row, file.size);
      },
      async remove(id) {
        if (options.templateDraft) throw new Error('Template draft assets are retained.');
        await transport.request<unknown>({ method: 'DELETE', path: `${assetRoot}/${encodeURIComponent(id)}` });
      }
    },
    settings: settingsAdapter(transport, `${apiRoot}/settings`),
    releases: {
      async prepare(sourceVersion) { return (await transport.request<WebPublicationSnapshot>({ method: 'POST', path: `${apiRoot}/publication-snapshots`, body: { sourceVersion } })).body; },
      async schedule(input) {
        return (await transport.request<{ schedule: WebPublicationSchedule }>({ method: 'POST', path: `${apiRoot}/publication-schedules`, body: { ...input } })).body.schedule;
      },
      async schedules() { return (await transport.request<{ schedules: WebPublicationSchedule[] }>({ path: `${apiRoot}/publication-schedules` })).body.schedules; },
      async cancelSchedule(id) {
        await transport.request<unknown>({ method: 'DELETE', path: `${apiRoot}/publication-schedules/${encodeURIComponent(id)}` });
      },
      async list() { return (await transport.request<unknown>({ path: `${apiRoot}/publication` })).body; },
      async publish(input) {
        return (await transport.request<unknown>({
          method: 'POST', path: `${apiRoot}/publish`, body: { ...input }
        })).body;
      },
      async savePreview(input) {
        await transport.request<unknown>({
          method: 'POST', path: `${apiRoot}/publication-preview`, body: input
        });
      }
    },
    libraries: {
      async list() { return (await transport.request<{ libraries: WebLibrary[] }>({ path: '/api/libraries' })).body.libraries; },
      async create(name) {
        return (await transport.request<{ library: WebLibrary }>({ method: 'POST', path: '/api/libraries', body: { name } })).body.library;
      },
      async get(id) {
        return (await transport.request<{ library: WebLibrary; versions: WebLibraryVersionSummary[] }>({ path: `/api/libraries/${encodeURIComponent(id)}` })).body;
      },
      async version(id, version) {
        return (await transport.request<{ version: WebLibraryVersionSummary; bundle: LibraryBundle }>({
          path: `/api/libraries/${encodeURIComponent(id)}/versions/${encodeURIComponent(String(version))}`
        })).body;
      },
      async publish(id, input) {
        return (await transport.request<{ version: WebLibraryVersionSummary }>({
          method: 'POST', path: `/api/libraries/${encodeURIComponent(id)}/versions`, body: { siteId: options.siteId, ...input }
        })).body.version;
      },
      async copyAssets(input) {
        return (await transport.request<{ assets: Record<string, string> }>({
          method: 'POST', path: `${apiRoot}/library-assets`, body: { ...input }
        })).body.assets;
      },
      async members(id) {
        return (await transport.request<{ members: WebLibraryMember[] }>({ path: `/api/libraries/${encodeURIComponent(id)}/members` })).body.members;
      },
      async share(id, email) {
        return (await transport.request<{ added: boolean; member: WebLibraryMember }>({
          method: 'POST', path: `/api/libraries/${encodeURIComponent(id)}/members`, body: { email }
        })).body;
      },
      async unshare(id, userId) {
        await transport.request<unknown>({
          method: 'DELETE', path: `/api/libraries/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`
        });
      },
      async leave(id) {
        await transport.request<unknown>({ method: 'DELETE', path: `/api/libraries/${encodeURIComponent(id)}/members/me` });
      }
    },
    proposals: {
      async list(status) {
        return (await transport.request<{ proposals: WebProposal[] }>({
          path: `${apiRoot}/proposals${status ? `?status=${status}` : ''}`
        })).body.proposals;
      },
      async apply(id, version) {
        return (await transport.request<Awaited<ReturnType<WebHostAdapter['proposals']['apply']>>>({
          method: 'POST', path: `${apiRoot}/proposals/${encodeURIComponent(id)}/apply`, body: { version },
        })).body;
      },
      async decline(id) {
        await transport.request<unknown>({
          method: 'POST', path: `${apiRoot}/proposals/${encodeURIComponent(id)}/decision`, body: { status: 'declined' }
        });
      },
      previewUrl: (id, path, version, before) =>
        `${options.baseUrl || ''}${apiRoot}/proposals/${encodeURIComponent(id)}/preview/${path.split('/').map(encodeURIComponent).join('/')}?version=${version}${before ? '&before=1' : ''}`,
      settingsUrl: `${options.baseUrl || ''}/sites/${site}/assistants`
    }
  };
}
