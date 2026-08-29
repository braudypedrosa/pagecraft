import { assetAdapter, authenticationAdapter, contentAdapter, documentAdapter, menuAdapter, pageAdapter, revisionAdapter, settingsAdapter } from './shared';
import { FetchHostTransport, type FetchLike, type HostTransport } from './transport';
import type { HostCapability, HostFeatures, HostSession, WordPressHostAdapter } from './types';

export interface WordPressHostOptions {
  restUrl?: string;
  pageId: string | number;
  documentPath?: string;
  revisionsPath?: string;
  nonce: string;
  capabilities?: readonly HostCapability[];
  userId?: string | number;
  userName?: string;
  fetch?: FetchLike;
  transport?: HostTransport;
}

const normalizeRestUrl = (value: string) => value.replace(/\/+$/, '');

export const WORDPRESS_HOST_FEATURES: Readonly<HostFeatures> = Object.freeze({
  sites: false,
  account: false,
  billing: false,
  sharing: false,
  hostedPublishing: false,
  cloudPageManager: false,
  projectExport: false,
  pages: 'wordpress',
  media: 'wordpress',
  menus: 'wordpress',
  revisions: 'wordpress',
  preview: 'wordpress',
  publishing: 'wordpress',
  globals: 'wordpress',
  dynamicContent: 'wordpress'
});

export function createWordPressHostAdapter(options: WordPressHostOptions): WordPressHostAdapter {
  let nonce = options.nonce;
  const capabilities = [...(options.capabilities || [])];
  const transport = options.transport || new FetchHostTransport(
    normalizeRestUrl(options.restUrl || '/wp-json/pagecraft/v1'),
    options.fetch || globalThis.fetch.bind(globalThis),
    () => ({ 'X-WP-Nonce': nonce })
  );
  const page = encodeURIComponent(String(options.pageId));
  const documentPath = options.documentPath || `/pages/${page}/document`;
  const revisionsPath = options.revisionsPath || `/pages/${page}/revisions`;
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
    features: WORDPRESS_HOST_FEATURES,
    authentication,
    documents: documentAdapter(transport, documentPath),
    pages: pageAdapter(transport, '/pages'),
    menus: menuAdapter(transport, '/menus'),
    revisions: revisionAdapter(transport, revisionsPath),
    assets: assetAdapter(transport, '/media'),
    settings: settingsAdapter(transport, '/settings'),
    content: contentAdapter(transport, '/content'),
    setNonce(value) { nonce = value; }
  };
}
