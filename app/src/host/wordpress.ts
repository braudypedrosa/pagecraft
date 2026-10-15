import { assetAdapter, authenticationAdapter, contentAdapter, documentAdapter, menuAdapter, pageAdapter, revisionAdapter, settingsAdapter } from './shared';
import { FetchHostTransport, HostRequestError, type FetchLike, type HostRequest, type HostTransport } from './transport';
import type { HostCapability, HostFeatures, HostMedia, HostSession, WordPressHostAdapter } from './types';

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

const WORDPRESS_MEDIA_REFERENCES = new Set(['managed_document', 'native_content', 'featured_image']);
const completeWordPressMediaUsage = (value: unknown) => {
  if (!value || typeof value !== 'object') return false;
  const usage = value as Record<string, unknown>;
  return typeof usage.id === 'string' && typeof usage.type === 'string'
    && typeof usage.title === 'string' && typeof usage.status === 'string'
    && (usage.parentId === null || typeof usage.parentId === 'string')
    && Array.isArray(usage.references) && usage.references.length > 0
    && usage.references.every(reference => typeof reference === 'string'
      && WORDPRESS_MEDIA_REFERENCES.has(reference));
};

/** Older plugin versions return ordinary media rows without an authoritative usage scan.
 * Treat those rows as unknown and non-deletable instead of letting the shared editor infer
 * site-wide safety from the one Pagecraft document it currently has open. */
const normalizeWordPressMedia = (media: HostMedia): HostMedia => {
  const complete = media.usageKnown === true
    && Number.isInteger(media.usageCount) && Number(media.usageCount) >= 0
    && typeof media.canDelete === 'boolean' && Array.isArray(media.usedBy)
    && media.usedBy.every(completeWordPressMediaUsage);
  const count = complete ? Number(media.usageCount) : null;
  const usedBy = complete ? media.usedBy! : [];
  const known = complete
    && (count === 0 ? usedBy.length === 0 : usedBy.length > 0)
    && !(media.canDelete === true && count !== 0);
  return {
    ...media,
    usageKnown: known,
    usageCount: known ? count : null,
    canDelete: known && count === 0 && media.canDelete === true,
    usedBy: known ? usedBy : []
  };
};

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
  dynamicContent: 'wordpress',
  managedForms: false
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
  const sharedAssets = assetAdapter(transport, '/media');
  const assets = {
    ...sharedAssets,
    async list() { return (await sharedAssets.list()).map(normalizeWordPressMedia); },
    async upload(file: File | Blob, filename?: string) {
      return normalizeWordPressMedia(await sharedAssets.upload(file, filename));
    }
  };

  return {
    kind: 'wordpress',
    features: WORDPRESS_HOST_FEATURES,
    authentication,
    documents: documentAdapter(transport, documentPath),
    pages: pageAdapter(transport, '/pages'),
    menus: menuAdapter(transport, '/menus'),
    revisions: revisionAdapter(transport, revisionsPath),
    assets,
    settings: settingsAdapter(transport, '/settings'),
    content: contentAdapter(transport, '/content'),
    setNonce(value) { nonce = value; }
  };
}
