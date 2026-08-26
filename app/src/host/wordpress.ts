import { assetAdapter, authenticationAdapter, documentAdapter, menuAdapter, pageAdapter, revisionAdapter, settingsAdapter } from './shared';
import { FetchHostTransport, type FetchLike, type HostTransport } from './transport';
import type { HostCapability, HostSession, WordPressHostAdapter } from './types';

export interface WordPressHostOptions {
  restUrl?: string;
  pageId: string | number;
  nonce: string;
  capabilities?: readonly HostCapability[];
  userId?: string | number;
  userName?: string;
  fetch?: FetchLike;
  transport?: HostTransport;
}

const normalizeRestUrl = (value: string) => value.replace(/\/+$/, '');

export function createWordPressHostAdapter(options: WordPressHostOptions): WordPressHostAdapter {
  let nonce = options.nonce;
  const capabilities = [...(options.capabilities || [])];
  const transport = options.transport || new FetchHostTransport(
    normalizeRestUrl(options.restUrl || '/wp-json/pagecraft/v1'),
    options.fetch || globalThis.fetch.bind(globalThis),
    () => ({ 'X-WP-Nonce': nonce })
  );
  const page = encodeURIComponent(String(options.pageId));
  const initialSession: HostSession = {
    authenticated: true,
    userId: String(options.userId || ''),
    displayName: options.userName || '',
    capabilities
  };
  const authentication = authenticationAdapter(initialSession, async () => {
    const current = (await transport.request<HostSession>({ path: '/session' })).body;
    capabilities.splice(0, capabilities.length, ...current.capabilities);
    return current;
  });

  return {
    kind: 'wordpress',
    authentication,
    documents: documentAdapter(transport, `/pages/${page}/document`),
    pages: pageAdapter(transport, '/pages'),
    menus: menuAdapter(transport, '/menus'),
    revisions: revisionAdapter(transport, `/pages/${page}/revisions`),
    assets: assetAdapter(transport, '/media'),
    settings: settingsAdapter(transport, '/settings'),
    setNonce(value) { nonce = value; }
  };
}
