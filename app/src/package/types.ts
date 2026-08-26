export const SITE_PACKAGE_FORMAT_V1 = 'pagecraft.site-package.v1' as const;
export const PAGE_PACKAGE_FORMAT_V1 = 'pagecraft.page-package.v1' as const;
export const PACKAGE_MANIFEST_PATH = 'manifest.json' as const;

/** Limits are checked from ZIP metadata before any compressed entry is expanded. */
export const PORTABLE_PACKAGE_LIMITS_V1 = Object.freeze({
  archiveBytes: 300 * 1024 * 1024,
  files: 5_000,
  pathBytes: 240,
  fileBytes: 100 * 1024 * 1024,
  expandedBytes: 500 * 1024 * 1024,
  manifestBytes: 2 * 1024 * 1024,
  documentBytes: 50 * 1024 * 1024
});

export type PortablePackageKind = 'site' | 'page';
export type PortablePackageOrigin = 'pagecraft-cloud' | 'wordpress-local';
export type PortablePackageFileRole =
  | 'document'
  | 'provenance'
  | 'dependencies'
  | 'compiled-page'
  | 'compiled-support'
  | 'style'
  | 'asset'
  | 'preview';

export interface PortablePackageFileV1 {
  path: string;
  role: PortablePackageFileRole;
  mediaType: string;
  bytes: number;
  sha256: string;
}

export interface PortablePackageProvenanceV1 {
  format: 'pagecraft.provenance.v1';
  origin: PortablePackageOrigin;
  sourceId: string;
  sourceVersion: number;
  exportedBy?: string;
  parentPackageHash?: string;
}

export interface PortableMenuDependencyV1 {
  nodeId: string;
  region: 'header' | 'page' | 'footer' | 'component' | 'block';
  items: Array<{
    label: string;
    link: string;
    classes: string[];
    target: '' | '_blank';
  }>;
}

export interface PortablePackageDependenciesV1 {
  format: 'pagecraft.dependencies.v1';
  globals: {
    headerNodes: number;
    footerNodes: number;
    headerHash: string;
    footerHash: string;
  };
  tokens: { included: true; hash: string };
  fonts: string[];
  menus: PortableMenuDependencyV1[];
  components: string[];
  blocks: string[];
  assets: string[];
  cms: {
    policy: 'reject';
    collections: number;
    boundNodes: number;
    collectionLists: number;
    detailPages: number;
  };
}

export interface PortablePackageManifestV1 {
  format: typeof SITE_PACKAGE_FORMAT_V1 | typeof PAGE_PACKAGE_FORMAT_V1;
  packageVersion: 1;
  kind: PortablePackageKind;
  schemaVersion: number;
  rendererVersion: string;
  documentPath: 'source/document.json';
  provenancePath: 'source/provenance.json';
  dependenciesPath: 'source/dependencies.json';
  entryPageId?: string;
  cms: { policy: 'reject'; flattened: false };
  files: PortablePackageFileV1[];
  contentHash: string;
}

export interface PortablePackageBuild {
  filename: string;
  bytes: Uint8Array;
  sha256: string;
  manifest: PortablePackageManifestV1;
}
