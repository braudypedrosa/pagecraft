import type { Doc, UnknownDocumentInput } from '../core/types';

export type HostKind = 'web' | 'wordpress';

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

/**
 * Everything the shared editor is allowed to know about its host. Core document behavior,
 * compilation, rendering, components and migrations intentionally do not import this module.
 */
export interface PagecraftHostAdapter {
  readonly kind: HostKind;
  readonly authentication: HostAuthenticationAdapter;
  readonly documents: HostDocumentAdapter;
  readonly pages: HostPageAdapter;
  readonly menus: HostMenuAdapter;
  readonly revisions: HostRevisionAdapter;
  readonly assets: HostAssetAdapter;
  readonly settings: HostSettingsAdapter;
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
    idempotencyKey: string;
    acknowledgeWarnings: boolean;
    warningCodes: readonly string[];
  }): Promise<unknown>;
}

export interface WebHostAdapter extends PagecraftHostAdapter {
  readonly kind: 'web';
  readonly releases: WebReleaseAdapter;
}

export interface WordPressHostAdapter extends PagecraftHostAdapter {
  readonly kind: 'wordpress';
  /** Replace a REST nonce after WordPress refreshes it. The value remains transport-only. */
  setNonce(nonce: string): void;
}
