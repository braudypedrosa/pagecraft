import { assetAdapter, authenticationAdapter, contentAdapter, documentAdapter, menuAdapter, pageAdapter, revisionAdapter, settingsAdapter } from './shared';
import { FetchHostTransport, HostRequestError, type FetchLike, type HostRequest, type HostTransport } from './transport';
import type { HostCapability, HostFeatures, HostSession, WordPressHostAdapter } from './types';

export interface WordPressHostOptions {
  restUrl?: string;
  pageId: string | number;
  documentPath?: string;
  revisionsPath?: string;
  nonce: string;
  /** WordPress core's `admin-ajax.php?action=rest-nonce`, which answers a fresh `wp_rest` nonce
      while the login behind it is still valid. */
  nonceUrl?: string;
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

const expiredNonce = (error: unknown) => error instanceof HostRequestError && error.status === 403
  && (error.payload as { code?: string } | null)?.code === 'rest_cookie_invalid_nonce';

export function createWordPressHostAdapter(options: WordPressHostOptions): WordPressHostAdapter {
  let nonce = options.nonce;
  const capabilities = [...(options.capabilities || [])];
  const fetcher = options.fetch || globalThis.fetch.bind(globalThis);
  const rest = options.transport || new FetchHostTransport(
    normalizeRestUrl(options.restUrl || '/wp-json/pagecraft/v1'),
    fetcher,
    () => ({ 'X-WP-Nonce': nonce })
  );
  /* The editor gets one nonce when it opens, and WordPress stops accepting it after 12 to 24
     hours — so an editor left open overnight failed every save with a 403. On exactly that
     refusal, ask WordPress for a fresh nonce and try once more. One request at a time asks; a
     login that has really ended answers with no nonce, and the original error stands. */
  let asking: Promise<string | null> | null = null;
  const ask = async () => {
    try {
      const response = await fetcher(options.nonceUrl!, { credentials: 'same-origin' });
      const text = (await response.text()).trim();
      return response.ok && /^[a-z0-9]{6,32}$/i.test(text) ? text : null;
    } catch { return null; }
  };
  const freshNonce = () => asking || (asking = ask().finally(() => { asking = null; }));
  const transport: HostTransport = {
    async request<T>(request: HostRequest) {
      try {
        return await rest.request<T>(request);
      } catch (error) {
        if (!options.nonceUrl || !expiredNonce(error)) throw error;
        const fresh = await freshNonce();
        if (!fresh) throw error;
        nonce = fresh;
        return rest.request<T>(request);
      }
    }
  };
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
