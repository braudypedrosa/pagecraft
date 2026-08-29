import type {
  HostAssetAdapter, HostAuthenticationAdapter, HostCapability, HostContentAdapter, HostContentItem,
  HostContentSource, HostDocumentAdapter,
  HostMedia, HostMenu, HostMenuAdapter, HostPage, HostPageAdapter, HostPageWrite,
  HostRevision, HostRevisionAdapter, HostSession, HostSettings, HostSettingsAdapter
} from './types';
import type { HostTransport } from './transport';
import { encodePath } from './transport';
import { adoptHostDocument } from './schema';

export const capabilitySet = (values: readonly HostCapability[]) => new Set(values);

export function authenticationAdapter(
  initial: HostSession,
  load: () => Promise<HostSession> = async () => initial
): HostAuthenticationAdapter {
  let current = initial;
  return {
    async session() { current = await load(); return current; },
    can(capability) { return current.capabilities.includes(capability); }
  };
}

export function documentAdapter(
  transport: HostTransport,
  path: string,
  initial?: { document: unknown; version: number }
): HostDocumentAdapter {
  return {
    async load() {
      const row: { document?: unknown; doc?: unknown; version: number } = initial
        || (await transport.request<{ document?: unknown; doc?: unknown; version: number }>({ path })).body;
      return { document: adoptHostDocument((row.document ?? row.doc) as any), version: row.version };
    },
    async save(input) {
      const document = adoptHostDocument(input.document);
      return (await transport.request<{ version: number }>({
        method: 'PUT', path, body: {
          document,
          doc: document,
          version: input.version,
          ...(input.compiled ? { compiled: input.compiled } : {})
        }
      })).body;
    }
  };
}

export function pageAdapter(transport: HostTransport, root: string): HostPageAdapter {
  return {
    async list() { return (await transport.request<HostPage[]>({ path: root })).body; },
    async get(id) { return (await transport.request<HostPage>({ path: `${root}/${encodePath(id)}` })).body; },
    async create(page: HostPageWrite) {
      return (await transport.request<HostPage>({ method: 'POST', path: root, body: { ...page } })).body;
    },
    async update(id, page) {
      return (await transport.request<HostPage>({ method: 'PATCH', path: `${root}/${encodePath(id)}`, body: page })).body;
    }
  };
}

export function menuAdapter(transport: HostTransport, root: string): HostMenuAdapter {
  return {
    async list() { return (await transport.request<HostMenu[]>({ path: root })).body; },
    async get(id) { return (await transport.request<HostMenu>({ path: `${root}/${encodePath(id)}` })).body; },
    async save(menu) {
      return (await transport.request<HostMenu>({ method: 'PUT', path: `${root}/${encodePath(menu.id)}`, body: menu as any })).body;
    }
  };
}

export function revisionAdapter(transport: HostTransport, root: string): HostRevisionAdapter {
  return {
    async list() { return (await transport.request<HostRevision[]>({ path: root })).body; },
    async restore(version, currentVersion) {
      const row = (await transport.request<{ document?: unknown; doc?: unknown; version: number }>({
        method: 'POST', path: `${root}/${encodePath(version)}/restore`, body: { currentVersion }
      })).body;
      const raw = row.document ?? row.doc;
      return raw === undefined
        ? { version: row.version }
        : { document: adoptHostDocument(raw as any), version: row.version };
    }
  };
}

export function assetAdapter(transport: HostTransport, root: string): HostAssetAdapter {
  return {
    async list() { return (await transport.request<HostMedia[]>({ path: root })).body; },
    async download(id) {
      return (await transport.request<Blob>({ path: `${root}/${encodePath(id)}`, responseType: 'blob' })).body;
    },
    async upload(file, filename) {
      const form = new FormData();
      form.set('file', file, filename || ('name' in file ? String((file as File).name || 'asset') : 'asset'));
      return (await transport.request<HostMedia>({ method: 'POST', path: root, body: form })).body;
    },
    async remove(id) {
      await transport.request<void>({ method: 'DELETE', path: `${root}/${encodePath(id)}`, responseType: 'empty' });
    }
  };
}

export function settingsAdapter(transport: HostTransport, path: string): HostSettingsAdapter {
  return {
    async read() { return (await transport.request<HostSettings>({ path })).body; },
    async write(settings) {
      return (await transport.request<HostSettings>({ method: 'PUT', path, body: settings })).body;
    }
  };
}

export function contentAdapter(transport: HostTransport, root: string): HostContentAdapter {
  return {
    async sources() {
      return (await transport.request<HostContentSource[]>({ path: `${root}/sources` })).body;
    },
    async list(source, query = {}) {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.page) params.set('page', String(query.page));
      if (query.perPage) params.set('per_page', String(query.perPage));
      const suffix = params.size ? `?${params}` : '';
      return (await transport.request<HostContentItem[]>({ path: `${root}/${encodePath(source)}${suffix}` })).body;
    },
    async get(source, id) {
      return (await transport.request<HostContentItem>({ path: `${root}/${encodePath(source)}/${encodePath(id)}` })).body;
    }
  };
}
