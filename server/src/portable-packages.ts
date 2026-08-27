import type { Doc, NavItem, Node as PagecraftNode } from '../../app/src/core/types.ts';
import {
  SCHEMA, assetFile, eachNode, exportTargets, slugify, wordpressStyles
} from '../../app/src/core/index.ts';
import { adoptHostDocument } from '../../app/src/host/schema.ts';
import {
  PACKAGE_MANIFEST_PATH, PAGE_PACKAGE_FORMAT_V1, PORTABLE_PACKAGE_LIMITS_V1,
  SITE_PACKAGE_FORMAT_V1, type PortableMenuDependencyV1,
  type PortablePackageBuild, type PortablePackageDependenciesV1,
  type PortablePackageFileRole, type PortablePackageFileV1,
  type PortablePackageKind, type PortablePackageManifestV1,
  type PortablePackageProvenanceV1
} from '../../app/src/package/types.ts';
import { ALLOWED as ALLOWED_ASSET_TYPES, type Asset } from './assets.ts';
import {
  assertSafeStaticSvg, canonicalJson, sha256, utf8ByteCompare
} from './releases.ts';
import { renderSite } from './render.ts';
import { createPortableZip, extractPortableZip } from './portable-zip.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const DOCUMENT_PATH = 'source/document.json' as const;
const PROVENANCE_PATH = 'source/provenance.json' as const;
const DEPENDENCIES_PATH = 'source/dependencies.json' as const;
const RENDERER_VERSION = `pagecraft-core-${SCHEMA}`;
const HASH = /^[a-f0-9]{64}$/;

interface PackageContent {
  path: string;
  role: PortablePackageFileRole;
  mediaType: string;
  bytes: Uint8Array;
  asset?: PortablePackageFileV1['asset'];
}

export interface PortablePackageInput {
  document: unknown;
  assets?: Asset[];
  provenance: PortablePackageProvenanceV1;
}

export interface PortablePagePackageInput extends PortablePackageInput {
  pageId: string;
}

export interface PortablePackageValidation {
  manifest: PortablePackageManifestV1;
  document: Doc;
  provenance: PortablePackageProvenanceV1;
  dependencies: PortablePackageDependenciesV1;
  files: Map<string, Uint8Array>;
  sha256: string;
}

const jsonBytes = (value: unknown) => encoder.encode(canonicalJson(value));
const textBytes = (value: string) => encoder.encode(value);

const decode = (bytes: Uint8Array, label: string) => {
  try { return decoder.decode(bytes); }
  catch { throw new Error(`${label} is not valid UTF-8`); }
};

const canonicalObject = <T>(bytes: Uint8Array, label: string): T => {
  const source = decode(bytes, label);
  let value: unknown;
  try { value = JSON.parse(source); }
  catch { throw new Error(`${label} is not valid JSON`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  if (canonicalJson(value) !== source) throw new Error(`${label} is not canonical JSON`);
  return value as T;
};

const nodes = (tree: PagecraftNode[]) => {
  const out: PagecraftNode[] = [];
  eachNode(tree, (node: PagecraftNode) => { out.push(node); });
  return out;
};

const treesWithRegions = (doc: Doc) => {
  const rows: Array<{ region: PortableMenuDependencyV1['region']; tree: PagecraftNode[] }> = [
    { region: 'header', tree: doc.header },
    ...doc.pages.map(page => ({ region: 'page' as const, tree: page.tree })),
    { region: 'footer', tree: doc.footer },
    ...(doc.meta.components || []).map(component => ({ region: 'component' as const, tree: [component.node] })),
    ...(doc.meta.blocks || []).map(block => ({ region: 'block' as const, tree: [block.node] }))
  ];
  return rows;
};

const cmsCounts = (doc: Doc) => {
  let boundNodes = 0;
  let collectionLists = 0;
  for (const { tree } of treesWithRegions(doc)) {
    for (const node of nodes(tree)) {
      if (node.type === 'list') collectionLists++;
      if (Object.values(node.bind || {}).some(binding => binding?.src === 'field')
        || node.showIf?.bind?.src === 'field') boundNodes++;
    }
  }
  return {
    collections: doc.meta.collections?.length || 0,
    boundNodes,
    collectionLists,
    detailPages: doc.pages.filter(page => Boolean(page.collection)).length
  };
};

const rejectCms = (doc: Doc) => {
  const counts = cmsCounts(doc);
  if (Object.values(counts).some(Boolean)) {
    throw new Error(
      'Portable package v1 rejects Pagecraft CMS bindings. Flatten the CMS content explicitly '
      + 'before export; collections, collection lists, detail pages, and field bindings are never silently removed.'
    );
  }
  return counts;
};

const assetReferences = (doc: Doc) => {
  const found = new Set<string>();
  const source = canonicalJson(doc);
  for (const match of source.matchAll(/asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@\d+)?/g)) found.add(match[1]);
  return [...found].sort(utf8ByteCompare);
};

const menuDependencies = (doc: Doc) => {
  const menus: PortableMenuDependencyV1[] = [];
  for (const { region, tree } of treesWithRegions(doc)) {
    for (const node of nodes(tree)) {
      if (node.type !== 'nav') continue;
      const items = ((node.props.items || []) as NavItem[]).map(item => ({
        label: String(item.label || ''),
        link: String(item.href || ''),
        classes: String(item.cls || '').split(/\s+/).filter(Boolean).sort(utf8ByteCompare),
        target: item.target === '_blank' ? '_blank' as const : '' as const
      }));
      menus.push({ nodeId: node.id, region, items });
    }
  }
  return menus.sort((left, right) => utf8ByteCompare(`${left.region}:${left.nodeId}`, `${right.region}:${right.nodeId}`));
};

const dependenciesOf = (doc: Doc): PortablePackageDependenciesV1 => ({
  format: 'pagecraft.dependencies.v1',
  globals: {
    headerNodes: nodes(doc.header).length,
    footerNodes: nodes(doc.footer).length,
    headerHash: sha256(jsonBytes(doc.header)),
    footerHash: sha256(jsonBytes(doc.footer))
  },
  tokens: { included: true, hash: sha256(jsonBytes(doc.meta.tokens)) },
  fonts: [...new Set([doc.meta.font, doc.meta.headFont].map(font => String(font || '').trim()).filter(Boolean))]
    .sort(utf8ByteCompare),
  menus: menuDependencies(doc),
  components: (doc.meta.components || []).map(component => component.id).sort(utf8ByteCompare),
  blocks: (doc.meta.blocks || []).map(block => block.id).sort(utf8ByteCompare),
  assets: assetReferences(doc),
  cms: { policy: 'reject', ...rejectCms(doc) }
});

const mimeFor = (path: string) => {
  if (/\.html$/i.test(path)) return 'text/html; charset=utf-8';
  if (/\.css$/i.test(path)) return 'text/css; charset=utf-8';
  if (/\.json$/i.test(path)) return 'application/json';
  if (/\.xml$/i.test(path)) return 'application/xml; charset=utf-8';
  if (/\.txt$/i.test(path)) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
};

const packageDocumentForPage = (doc: Doc, pageId: string): Doc => {
  const page = doc.pages.find(candidate => candidate.id === pageId);
  if (!page) throw new Error(`Pagecraft page ${pageId} does not exist`);
  return structuredClone({ ...doc, pages: [page] });
};

function packageAssets(doc: Doc, input: readonly Asset[]) {
  const wanted = assetReferences(doc);
  const byId = new Map(input.map(asset => [asset.id, asset]));
  const selected = wanted.map(id => {
    const asset = byId.get(id);
    if (!asset) throw new Error(`Portable package is missing referenced asset ${id}`);
    if (!ALLOWED_ASSET_TYPES.has(asset.type)) {
      throw new Error(`Portable package asset ${id} uses unsupported media type ${asset.type}`);
    }
    assertSafeStaticSvg(asset);
    return asset;
  });
  return selected.sort((left, right) => utf8ByteCompare(left.id, right.id));
}

function validateProvenance(value: PortablePackageProvenanceV1) {
  if (value.format !== 'pagecraft.provenance.v1'
    || !['pagecraft-cloud', 'wordpress-local'].includes(value.origin)
    || typeof value.sourceId !== 'string' || !value.sourceId
    || !Number.isInteger(value.sourceVersion) || value.sourceVersion < 0
    || (value.exportedBy !== undefined && (typeof value.exportedBy !== 'string' || !value.exportedBy))
    || (value.parentPackageHash !== undefined && !HASH.test(value.parentPackageHash))) {
    throw new Error('portable package provenance is invalid');
  }
}

function build(kind: PortablePackageKind, rawDocument: unknown, assets: readonly Asset[], provenance: PortablePackageProvenanceV1, pageId?: string): PortablePackageBuild {
  validateProvenance(provenance);
  const adopted = adoptHostDocument(rawDocument as never);
  const document = kind === 'page' ? packageDocumentForPage(adopted, String(pageId || '')) : adopted;
  const dependencies = dependenciesOf(document);
  const selectedAssets = packageAssets(document, assets);
  const rendered = renderSite(document, selectedAssets);
  const wordpressStyleFiles = new Map(exportTargets().map(target => [
    target.path,
    wordpressStyles(target.pg)
  ]));
  const firstStyles = wordpressStyleFiles.values().next().value as ReturnType<typeof wordpressStyles> | undefined;
  const content: PackageContent[] = [
    { path: DOCUMENT_PATH, role: 'document', mediaType: 'application/json', bytes: jsonBytes(document) },
    { path: PROVENANCE_PATH, role: 'provenance', mediaType: 'application/json', bytes: jsonBytes(provenance) },
    { path: DEPENDENCIES_PATH, role: 'dependencies', mediaType: 'application/json', bytes: jsonBytes(dependencies) },
    {
      path: 'styles/global.css', role: 'style', mediaType: 'text/css; charset=utf-8',
      bytes: textBytes(firstStyles?.global || '')
    }
  ];

  for (const [path, source] of [...rendered.files.entries()].sort(([a], [b]) => utf8ByteCompare(a, b))) {
    const isPage = /\.html$/i.test(path);
    content.push({
      path: `compiled/${path}`,
      role: isPage ? 'compiled-page' : 'compiled-support',
      mediaType: mimeFor(path),
      bytes: textBytes(source)
    });
    if (isPage) {
      const styles = wordpressStyleFiles.get(path);
      if (!styles) throw new Error(`Portable package could not resolve WordPress styles for ${path}`);
      content.push({ path: `previews/${path}`, role: 'preview', mediaType: mimeFor(path), bytes: textBytes(source) });
      content.push({
        path: `styles/pages/${path.replace(/\.html$/i, '.css')}`,
        role: 'style', mediaType: 'text/css; charset=utf-8', bytes: textBytes(styles.page)
      });
    }
  }
  for (const asset of selectedAssets) {
    content.push({
      path: assetFile(asset), role: 'asset', mediaType: asset.type, bytes: new Uint8Array(asset.bytes),
      asset: { id: asset.id, name: asset.name, width: asset.w, height: asset.h }
    });
  }

  content.sort((left, right) => utf8ByteCompare(left.path, right.path));
  const files: PortablePackageFileV1[] = content.map(file => ({
    path: file.path, role: file.role, mediaType: file.mediaType,
    bytes: file.bytes.byteLength, sha256: sha256(file.bytes),
    ...(file.asset ? { asset: file.asset } : {})
  }));
  const manifest: PortablePackageManifestV1 = {
    format: kind === 'site' ? SITE_PACKAGE_FORMAT_V1 : PAGE_PACKAGE_FORMAT_V1,
    packageVersion: 1,
    kind,
    schemaVersion: document.schemaVersion,
    rendererVersion: RENDERER_VERSION,
    documentPath: DOCUMENT_PATH,
    provenancePath: PROVENANCE_PATH,
    dependenciesPath: DEPENDENCIES_PATH,
    ...(kind === 'page' ? { entryPageId: document.pages[0].id } : {}),
    cms: { policy: 'reject', flattened: false },
    files,
    contentHash: sha256(jsonBytes(files))
  };
  const bytes = createPortableZip([
    { path: PACKAGE_MANIFEST_PATH, bytes: jsonBytes(manifest) },
    ...content.map(file => ({ path: file.path, bytes: file.bytes }))
  ]);
  const siteName = slugify(document.meta.name || 'pagecraft') || 'pagecraft';
  const pageName = kind === 'page' ? `-${slugify(document.pages[0].slug || document.pages[0].name || 'page') || 'page'}` : '';
  return {
    filename: `${siteName}${pageName}.pagecraft-${kind}.zip`,
    bytes,
    sha256: sha256(bytes),
    manifest
  };
}

export const createSitePackage = (input: PortablePackageInput) =>
  build('site', input.document, input.assets || [], input.provenance);

export const createPagePackage = (input: PortablePagePackageInput) =>
  build('page', input.document, input.assets || [], input.provenance, input.pageId);

/** Resolve and validate dependencies before a caller transfers any asset bodies from storage. */
export function portableAssetIds(rawDocument: unknown, pageId?: string) {
  const adopted = adoptHostDocument(rawDocument as never);
  const document = pageId === undefined ? adopted : packageDocumentForPage(adopted, pageId);
  rejectCms(document);
  return assetReferences(document);
}

const ROLES = new Set<PortablePackageFileRole>([
  'document', 'provenance', 'dependencies', 'compiled-page', 'compiled-support', 'style', 'asset', 'preview'
]);

const validFileContract = (file: PortablePackageFileV1) => {
  if (file.role !== 'asset' && file.asset !== undefined) return false;
  if (file.path === DOCUMENT_PATH) return file.role === 'document' && file.mediaType === 'application/json';
  if (file.path === PROVENANCE_PATH) return file.role === 'provenance' && file.mediaType === 'application/json';
  if (file.path === DEPENDENCIES_PATH) return file.role === 'dependencies' && file.mediaType === 'application/json';
  if (file.role === 'compiled-page') {
    return /^compiled\/(?!.*\/{2})[^\\]+\.html$/i.test(file.path)
      && file.mediaType === 'text/html; charset=utf-8';
  }
  if (file.role === 'compiled-support') {
    return ['compiled/robots.txt', 'compiled/sitemap.xml'].includes(file.path)
      && ['text/plain; charset=utf-8', 'application/xml; charset=utf-8'].includes(file.mediaType);
  }
  if (file.role === 'style') return /^styles\/.+\.css$/i.test(file.path) && file.mediaType === 'text/css; charset=utf-8';
  if (file.role === 'preview') return /^previews\/.+\.html$/i.test(file.path) && file.mediaType === 'text/html; charset=utf-8';
  if (file.role === 'asset') {
    const asset = file.asset;
    return /^assets\/.+/.test(file.path) && ALLOWED_ASSET_TYPES.has(file.mediaType)
      && !!asset && typeof asset.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(asset.id)
      && typeof asset.name === 'string' && asset.name.length > 0
      && Number.isInteger(asset.width) && asset.width >= 0
      && Number.isInteger(asset.height) && asset.height >= 0
      && assetFile({ id: asset.id, name: asset.name }) === file.path;
  }
  return false;
};

export function validatePortablePackage(archive: Uint8Array): PortablePackageValidation {
  const files = extractPortableZip(archive);
  const manifestBytes = files.get(PACKAGE_MANIFEST_PATH);
  if (!manifestBytes) throw new Error('portable package manifest.json is missing');
  if (manifestBytes.byteLength > PORTABLE_PACKAGE_LIMITS_V1.manifestBytes) {
    throw new Error('portable package manifest exceeds the v1 limit');
  }
  const manifest = canonicalObject<PortablePackageManifestV1>(manifestBytes, 'portable package manifest');
  const expectedFormat = manifest.kind === 'site' ? SITE_PACKAGE_FORMAT_V1
    : manifest.kind === 'page' ? PAGE_PACKAGE_FORMAT_V1 : '';
  if (!expectedFormat || manifest.format !== expectedFormat || manifest.packageVersion !== 1) {
    throw new Error(`unsupported portable package format: ${String(manifest.format || manifest.kind || 'unknown')}`);
  }
  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) {
    throw new Error('portable package schema version is invalid');
  }
  const renderer = /^pagecraft-core-(\d+)$/.exec(manifest.rendererVersion || '');
  if (!renderer || Number(renderer[1]) > SCHEMA || Number(renderer[1]) !== manifest.schemaVersion) {
    throw new Error(`portable package requires unsupported renderer ${String(manifest.rendererVersion || 'unknown')}`);
  }
  if (manifest.documentPath !== DOCUMENT_PATH || manifest.provenancePath !== PROVENANCE_PATH
    || manifest.dependenciesPath !== DEPENDENCIES_PATH
    || manifest.cms?.policy !== 'reject' || manifest.cms?.flattened !== false
    || !Array.isArray(manifest.files)) {
    throw new Error('portable package manifest contract is invalid');
  }
  if (manifest.files.length + 1 !== files.size) throw new Error('portable package contains unlisted or missing files');
  const sorted = [...manifest.files].sort((left, right) => utf8ByteCompare(left.path, right.path));
  if (canonicalJson(sorted) !== canonicalJson(manifest.files)
    || new Set(sorted.map(file => file.path.toLowerCase())).size !== sorted.length
    || !HASH.test(manifest.contentHash)
    || sha256(jsonBytes(manifest.files)) !== manifest.contentHash) {
    throw new Error('portable package file manifest is invalid');
  }
  const listed = new Set<string>();
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || !ROLES.has(file.role)
      || typeof file.mediaType !== 'string' || !file.mediaType
      || !Number.isInteger(file.bytes) || file.bytes < 0 || file.bytes > PORTABLE_PACKAGE_LIMITS_V1.fileBytes
      || !HASH.test(file.sha256) || !validFileContract(file)) {
      throw new Error(`portable package file record is invalid: ${String(file?.path || 'unknown')}`);
    }
    const bytes = files.get(file.path);
    if (!bytes) throw new Error(`portable package file is missing: ${file.path}`);
    if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256) {
      throw new Error(`portable package file failed integrity verification: ${file.path}`);
    }
    listed.add(file.path);
  }
  for (const path of files.keys()) {
    if (path !== PACKAGE_MANIFEST_PATH && !listed.has(path)) throw new Error(`portable package contains unlisted file: ${path}`);
  }

  const documentBytes = files.get(DOCUMENT_PATH)!;
  if (documentBytes.byteLength > PORTABLE_PACKAGE_LIMITS_V1.documentBytes) {
    throw new Error('portable package document exceeds the v1 limit');
  }
  const rawDocument = canonicalObject<Record<string, unknown>>(documentBytes, 'portable package document');
  const supplied = rawDocument.schemaVersion ?? rawDocument.v;
  if (!Number.isInteger(supplied) || supplied !== manifest.schemaVersion) {
    throw new Error('portable package document schema does not match its manifest');
  }
  const document = adoptHostDocument(rawDocument);
  const provenance = canonicalObject<PortablePackageProvenanceV1>(files.get(PROVENANCE_PATH)!, 'portable package provenance');
  validateProvenance(provenance);
  const dependencies = canonicalObject<PortablePackageDependenciesV1>(files.get(DEPENDENCIES_PATH)!, 'portable package dependencies');
  if (dependencies.format !== 'pagecraft.dependencies.v1' || dependencies.cms?.policy !== 'reject') {
    throw new Error('portable package dependencies contract is invalid');
  }
  const expectedDependencies = dependenciesOf(document);
  if (canonicalJson(dependencies) !== canonicalJson(expectedDependencies)) {
    throw new Error('portable package dependencies do not match the document');
  }
  const packagedAssetIds = manifest.files.filter(file => file.role === 'asset').map(file => file.asset!.id)
    .sort(utf8ByteCompare);
  if (canonicalJson(packagedAssetIds) !== canonicalJson(dependencies.assets)) {
    throw new Error('portable package assets do not match the document references');
  }
  if (manifest.kind === 'page') {
    if (document.pages.length !== 1 || !manifest.entryPageId || document.pages[0].id !== manifest.entryPageId) {
      throw new Error('portable page package must contain exactly its declared entry page');
    }
  } else if (manifest.entryPageId !== undefined) {
    throw new Error('portable site package cannot declare an entry page');
  }
  return { manifest, document, provenance, dependencies, files, sha256: sha256(archive) };
}

export const portablePackageRendererVersion = RENDERER_VERSION;
export const selectPortablePageDocument = (document: Doc, pageId: string) => packageDocumentForPage(document, pageId);
