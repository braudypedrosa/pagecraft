import type { Doc, UnknownDocumentInput } from '../core/types';

export type HostKind = 'web' | 'wordpress';

export type HostFeatureProvider = false | 'pagecraft' | 'wordpress';

/**
 * Product capabilities are separate from authorization capabilities. A WordPress
 * administrator may be allowed to publish a page, for example, while hosted Pagecraft
 * publishing must still be absent from the WordPress workbench.
 */
export interface HostFeatures {
  readonly sites: boolean;
  readonly account: boolean;
  readonly billing: boolean;
  readonly sharing: boolean;
  readonly hostedPublishing: boolean;
  readonly cloudPageManager: boolean;
  readonly projectExport: boolean;
  readonly pages: HostFeatureProvider;
  readonly media: HostFeatureProvider;
  readonly menus: HostFeatureProvider;
  readonly revisions: HostFeatureProvider;
  readonly preview: HostFeatureProvider;
  readonly publishing: HostFeatureProvider;
  readonly globals: HostFeatureProvider;
  readonly dynamicContent: HostFeatureProvider;
}

export type HostCapability =
  | 'edit_document'
  | 'edit_structure'
  | 'publish'
  | 'upload_media'
  | 'manage_pages'
  | 'manage_menus'
  | 'manage_settings'
  | 'restore_revisions';

export interface HostSession {
  authenticated: boolean;
  userId: string;
  displayName: string;
  capabilities: readonly HostCapability[];
}

export interface HostDocument {
  document: Doc;
  version: number;
}

export interface HostDocumentSave {
  document: UnknownDocumentInput;
  version: number;
  /** A host may persist a compiled fallback beside the portable document. WordPress uses
   * this to keep the native page renderable when Pagecraft Builder is disabled. */
  compiled?: {
    html: string;
    globalCss: string;
    pageCss: string;
  };
}

export interface HostPage {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'publish' | 'private' | 'trash';
  url?: string;
  parentId?: string | null;
  modifiedAt?: string;
}

export interface HostPageWrite {
  title: string;
  slug: string;
  status?: HostPage['status'];
  parentId?: string | null;
}

export interface HostMenuItem {
  id: string;
  label: string;
  url: string;
  parentId?: string | null;
  classes?: readonly string[];
  target?: '' | '_blank';
  rel?: string;
  objectType?: 'page' | 'post' | 'custom';
  objectId?: string;
  anchor?: string;
  order: number;
}

export interface HostMenu {
  id: string;
  name: string;
  location?: string;
  items: readonly HostMenuItem[];
}

export interface HostRevision {
  id: string;
  version: number;
  createdAt: string;
  author?: { id?: string; name?: string; email?: string };
  current?: boolean;
}

export interface HostMedia {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  size: number;
  width?: number;
  height?: number;
}

export interface HostContentSource {
  id: string;
  label: string;
  restBase?: string;
}

export interface HostContentItem {
  id: string;
  source: string;
  title: string;
  slug: string;
  status: string;
  url?: string;
  modifiedAt?: string;
  excerpt?: string;
}

export type HostSettings = Readonly<Record<string, unknown>>;

export interface HostAuthenticationAdapter {
  session(): Promise<HostSession>;
  can(capability: HostCapability): boolean;
}

export interface HostDocumentAdapter {
  load(): Promise<HostDocument>;
  save(input: HostDocumentSave): Promise<{ version: number }>;
}

export interface HostPageAdapter {
  list(): Promise<readonly HostPage[]>;
  get(id: string): Promise<HostPage>;
  create(page: HostPageWrite): Promise<HostPage>;
  update(id: string, page: Partial<HostPageWrite>): Promise<HostPage>;
}

export interface HostMenuAdapter {
  list(): Promise<readonly HostMenu[]>;
  get(id: string): Promise<HostMenu>;
  save(menu: HostMenu): Promise<HostMenu>;
}

export interface HostRevisionAdapter {
  list(): Promise<readonly HostRevision[]>;
  restore(version: number, currentVersion: number): Promise<{ version: number; document?: Doc }>;
}

export interface HostAssetAdapter {
  list(): Promise<readonly HostMedia[]>;
  download(id: string): Promise<Blob>;
  upload(file: File | Blob, filename?: string): Promise<HostMedia>;
  remove(id: string): Promise<void>;
}

export interface HostSettingsAdapter {
  read(): Promise<HostSettings>;
  write(settings: Record<string, unknown>): Promise<HostSettings>;
}

export interface HostContentAdapter {
  sources(): Promise<readonly HostContentSource[]>;
  list(source: string, query?: { search?: string; page?: number; perPage?: number }): Promise<readonly HostContentItem[]>;
  get(source: string, id: string): Promise<HostContentItem>;
}

/**
 * Everything the shared editor is allowed to know about its host. Core document behavior,
 * compilation, rendering, components and migrations intentionally do not import this module.
 */
export interface PagecraftHostAdapter {
  readonly kind: HostKind;
  readonly features: Readonly<HostFeatures>;
  readonly authentication: HostAuthenticationAdapter;
  readonly documents: HostDocumentAdapter;
  readonly pages: HostPageAdapter;
  readonly menus: HostMenuAdapter;
  readonly revisions: HostRevisionAdapter;
  readonly assets: HostAssetAdapter;
  readonly settings: HostSettingsAdapter;
  /** Host-backed dynamic content. Pagecraft's in-document collections do not need this adapter. */
  readonly content?: HostContentAdapter;
}

export interface WebRelease {
  id: string;
  releaseNumber: number;
  sourceVersion: number;
  status: string;
  createdAt?: string;
}

export interface WebReleaseAdapter {
  list(): Promise<unknown>;
  publish(input: {
    sourceVersion: number;
    acknowledgeWarnings: boolean;
  }): Promise<unknown>;
  savePreview(input: {
    publicationId: string;
    snapshot: string;
  }): Promise<void>;
}

export interface WebHostAdapter extends PagecraftHostAdapter {
  readonly kind: 'web';
  readonly releases: WebReleaseAdapter;
}

export interface WordPressHostAdapter extends PagecraftHostAdapter {
  readonly kind: 'wordpress';
  readonly content: HostContentAdapter;
  /** Replace a REST nonce after WordPress refreshes it. The value remains transport-only. */
  setNonce(nonce: string): void;
}
