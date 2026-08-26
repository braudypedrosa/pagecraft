import {
  createHash, createPrivateKey, createPublicKey, sign as edSign, verify as edVerify,
  type KeyLike
} from 'node:crypto';
import type { Doc } from '../../app/src/core/types.ts';
import type { Asset } from './assets.ts';
import {
  assetFile, buildWordPressContentReference, parseWordPressContentReference,
  parseWordPressContentToken, SHARED_FOOTER_END, SHARED_FOOTER_START,
  SHARED_HEADER_END, SHARED_HEADER_START, wordpressContentToken
} from '../../app/src/core/index.ts';
import { assertTypedCmsWrite } from './cms-values.ts';

export const RELEASE_FORMAT = 'pagecraft.release.v1' as const;
export const DEPLOYMENT_FORMAT = 'pagecraft.deployment.v1' as const;
export const ARTIFACT_FORMAT = 'pagecraft.wordpress-artifact.v1' as const;
export const KEYSET_FORMAT = 'pagecraft.keyset.v1' as const;
export const RELEASE_CONTEXT = 'pagecraft-release-v1\0';
export const DEPLOYMENT_CONTEXT = 'pagecraft-deployment-v1\0';
export const KEYSET_CONTEXT = 'pagecraft-keyset-v1\0';
export const WEBHOOK_CONTEXT = 'pagecraft-webhook-v1\0';
export const PACKAGE_CONTEXT = 'pagecraft-package-v1\0';

/** Fixed v1 ceilings mirrored by the connector's staging verifier. A signed release must be
 * accepted or rejected before notification; WordPress must never discover contract drift only
 * after it has downloaded an otherwise valid deployment. */
export const RELEASE_LIMITS_V1 = Object.freeze({
  routes: 5_000,
  redirects: 10_000,
  assets: 5_000,
  decodedAssetBytes: 250 * 1024 * 1024,
  artifactBytes: 100 * 1024 * 1024,
  cmsCollections: 100,
  cmsFieldsPerCollection: 100,
  forms: 1_000
});

export interface ReleaseFileV1 {
  path: string;
  mime: string;
  bytes: number;
  hash: string;
}

export interface ReleasePageV1 {
  id: string;
  name: string;
  path: string;
}

export interface ReleaseAssetV1 extends ReleaseFileV1 {
  id: string;
  width: number;
  height: number;
}

export interface ReleaseScriptV1 {
  source: 'generated' | 'project' | 'page';
  ownerId: string;
  occurrenceId: string;
  region: ArtifactScriptRegionV1;
  order: number;
  placement: 'head' | 'body';
  token: string;
  hash: string;
  kind: 'generated' | 'authored';
}

export type ArtifactScriptRegionV1 =
  | 'route-head' | 'shared-header' | 'route-body' | 'shared-footer' | 'route-tail';

export interface ArtifactScriptOccurrenceV1 {
  occurrenceId: string;
  region: ArtifactScriptRegionV1;
  order: number;
  placement: 'head' | 'body';
  token: string;
  hash: string;
  kind: 'generated' | 'authored';
}

/** Immutable, project-scoped content release. It is identical for every deployment target. */
export interface ReleaseManifestV1 {
  format: typeof RELEASE_FORMAT;
  releaseId: string;
  siteId: string;
  sequence: number;
  sourceVersion: number;
  schemaVersion: number;
  rendererVersion: string;
  parentReleaseId: string | null;
  createdAt: string;
  requirements: { plugin: string; wordpress: string; php: string };
  capabilities: string[];
  artifactHash: string;
  artifactBytes: number;
  files: ReleaseFileV1[];
  pages: ReleasePageV1[];
  cms: { collections: Array<{ id: string; name: string }> };
  assets: ReleaseAssetV1[];
  scripts: ReleaseScriptV1[];
  redirects: ReleaseArtifactV1['redirects'];
  entities: ReleaseArtifactV1['entities'];
  forms: ReleaseArtifactV1['forms'];
  placeholders: Array<{
    routePath: string;
    kind: 'content' | 'asset' | 'runtime' | 'form' | 'wordpress-content';
    key?: string;
    id?: string;
    token?: string;
    objectType?: 'page' | 'post';
    path?: string;
  }>;
  audit: {
    acknowledgeWarnings: boolean;
    warningCodes: string[];
    warningCount: number;
    errorCodes: string[];
    errorCount: number;
  };
}

/** Target-bound instruction. A production envelope may be minted only after staging health. */
export interface DeploymentEnvelopeV1 {
  format: typeof DEPLOYMENT_FORMAT;
  releaseId: string;
  releaseManifestHash: string;
  artifactHash: string;
  connectionId: string;
  installationId: string;
  environment: 'staging' | 'production';
  profile: 'existing-theme' | 'pagecraft-theme';
  targetOrigin: string;
  targetPath: string;
  targetSequence: number;
  issuedAt: string;
  requirements: ReleaseManifestV1['requirements'];
}

export interface ArtifactRouteV1 {
  pageId: string;
  path: string;
  title: string;
  description: string;
  headHtml: string;
  /** The connector emits the consolidated signed CSS before substituting route-head runtime
   * markers. Sources with an executable/style interleave that cannot satisfy this are rejected. */
  headOrder: 'css-before-runtime';
  bodyHtml: string;
  bodyKind: 'content-fragment';
  css: string;
  runtime: string;
  seo: ArtifactSeoV1;
  scripts: ArtifactScriptOccurrenceV1[];
  sourceHash: string;
}

/** Target-neutral SEO owned by the connector. URL fields contain a clean route, an external
 * absolute URL, or a content-addressed `pc-asset://` token; they never contain the Pagecraft
 * preview origin. Raw canonical/Open Graph/Twitter tags are removed from `headHtml`. */
export interface ArtifactSeoV1 {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogType: string;
  ogUrl: string;
  ogImage: string;
  ogImageSecureUrl: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  structuredData: string;
}

export interface ArtifactAssetV1 {
  assetId: string;
  filename: string;
  mime: string;
  bytes: number;
  hash: string;
  width: number;
  height: number;
  content: string;
}

export interface ReleaseFormFieldV1 {
  name: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  privacy?: 'email';
}

export interface ReleaseFormV1 {
  id: string;
  routePath: string;
  method: 'POST';
  fields: ReleaseFormFieldV1[];
}

/** Compiled WordPress payload. It intentionally contains no editor document or node tree. */
export interface ReleaseArtifactV1 {
  format: typeof ARTIFACT_FORMAT;
  releaseId: string;
  siteId: string;
  sourceVersion: number;
  schemaVersion: number;
  rendererVersion: string;
  routes: ArtifactRouteV1[];
  shared: {
    css: string; runtime: string; headerHtml: string; footerHtml: string;
    scripts: ArtifactScriptOccurrenceV1[];
  };
  redirects: Array<{ from: string; to: string; status: 301 | 302 | 307 | 308; hash: string }>;
  entities: {
    pages: Array<{ pageId: string; path: string; title: string; description: string }>;
    forms: ReleaseFormV1[];
  };
  forms: ReleaseFormV1[];
  cms: { collections: unknown[] };
  assets: ArtifactAssetV1[];
}

export interface BuiltReleaseV1 {
  artifact: ReleaseArtifactV1;
  artifactBytes: Uint8Array;
  artifactHash: string;
  files: ReleaseFileV1[];
  pages: ReleasePageV1[];
  cms: ReleaseManifestV1['cms'];
  assets: ReleaseAssetV1[];
  scripts: ReleaseScriptV1[];
  redirects: ReleaseArtifactV1['redirects'];
  entities: ReleaseArtifactV1['entities'];
  forms: ReleaseArtifactV1['forms'];
  placeholders: ReleaseManifestV1['placeholders'];
}

export interface SignedReleaseManifestV1 {
  manifest: string;
  signature: string;
  keyId: string;
}

export interface SignedDeploymentEnvelopeV1 {
  envelope: string;
  signature: string;
  keyId: string;
}

export interface DesiredReleaseV1 {
  release: SignedReleaseManifestV1 & { artifact: { url: string; expiresAt: string } };
  deployment: SignedDeploymentEnvelopeV1;
  keysetEnvelope?: KeysetEnvelopeV1;
}

export interface ReleaseAvailableWebhookV1 {
  type: 'release.available';
  eventId: string;
  connectionId: string;
  releaseId: string;
  sequence: number;
  occurredAt: string;
}

export interface PackageManifestV1 {
  format: 'pagecraft.package.v1';
  slug: 'pagecraft-connector' | 'pagecraft-theme';
  version: string;
  packageHash: string;
  packageBytes: number;
  license: 'GPL-3.0-or-later';
  requirements: { wordpress: string; php: string; connector?: string };
  generatedAt: string;
}

export function signPackageManifest(manifest: PackageManifestV1, key: ReleaseSigningKey) {
  const signed = signCanonical(manifest, PACKAGE_CONTEXT, key);
  return { manifest: signed.encoded, signature: signed.signature, keyId: key.keyId };
}

export function verifySignedPackage(input: {
  manifest: string; signature: string; publicKey: KeyLike | string | Uint8Array; packageBytes?: Uint8Array;
}) {
  verifyCanonical(input.manifest, input.signature, PACKAGE_CONTEXT, input.publicKey);
  const manifest = decodeCanonical(input.manifest, 'pagecraft.package.v1') as unknown as PackageManifestV1;
  if (input.packageBytes && (input.packageBytes.byteLength !== manifest.packageBytes
    || sha256(input.packageBytes) !== manifest.packageHash)) throw new Error('package archive does not match signed metadata');
  return manifest;
}

export function signReleaseAvailableWebhook(event: ReleaseAvailableWebhookV1, key: ReleaseSigningKey) {
  const bytes = utf8(canonicalJson(event));
  const signature = edSign(null, contextInput(WEBHOOK_CONTEXT, bytes), privateKey(key.privateKey));
  return {
    payload: decoder.decode(bytes),
    bodyHash: sha256(bytes),
    signature: signature.toString('base64url'),
    keyId: key.keyId
  };
}

export interface ReleaseSigningKey {
  keyId: string;
  privateKey: KeyLike | string | Uint8Array;
  publicKey?: KeyLike | string | Uint8Array;
}

export interface ReleasePublicKey {
  id: string;
  algorithm: 'Ed25519';
  /** Raw 32-byte Ed25519 public key, base64url encoded. */
  publicKey: string;
  notBefore: string;
  notAfter: string;
}

export interface KeysetV1 {
  format: typeof KEYSET_FORMAT;
  generatedAt: string;
  expiresAt: string;
  keys: ReleasePublicKey[];
}

/** Generated offline. Runtime receives this envelope, never the root private key. */
export interface KeysetEnvelopeV1 {
  keyset: string;
  signature: string;
  rootKeyId: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const RAW_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** Canonical JSON for the strict JSON subset used by the signed v1 protocol. */
export function canonicalJson(value: unknown): string {
  const visit = (part: unknown, insideArray = false): string | undefined => {
    if (part === null) return 'null';
    if (typeof part === 'string' || typeof part === 'boolean') return JSON.stringify(part);
    if (typeof part === 'number') {
      if (!Number.isFinite(part)) throw new TypeError('canonical JSON does not allow non-finite numbers');
      return JSON.stringify(Object.is(part, -0) ? 0 : part);
    }
    if (part === undefined && !insideArray) return undefined;
    if (Array.isArray(part)) return '[' + part.map(item => visit(item, true) ?? 'null').join(',') + ']';
    if (typeof part === 'object') {
      const object = part as Record<string, unknown>;
      const tag = Object.prototype.toString.call(object);
      if (tag !== '[object Object]') throw new TypeError(`canonical JSON cannot encode ${tag}`);
      const fields: string[] = [];
      for (const key of Object.keys(object).sort()) {
        const encoded = visit(object[key]);
        if (encoded !== undefined) fields.push(JSON.stringify(key) + ':' + encoded);
      }
      return '{' + fields.join(',') + '}';
    }
    throw new TypeError(`canonical JSON cannot encode ${typeof part}`);
  };
  return visit(value) as string;
}

export const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
export const fromBase64url = (value: string) => new Uint8Array(Buffer.from(value, 'base64url'));
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const utf8 = (value: string) => encoder.encode(value);
/** Explicit UTF-8 byte order, matching PHP `strcmp`. Never use host-locale collation for a
 * signed array: ICU locale defaults differ across machines and from the connector runtime. */
export function utf8ByteCompare(left: string, right: string): number {
  if (left === right) return 0;
  const a = utf8(left), b = utf8(right);
  const length = Math.min(a.byteLength, b.byteLength);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return a.byteLength < b.byteLength ? -1 : 1;
}

/**
 * SVGs stay byte-for-byte identical between the signed artifact and WordPress.  That means
 * neither side may "sanitize" an executable SVG after signing: publication has to reject it
 * before the hash is frozen instead.  This deliberately accepts the small static subset that
 * logos and illustrations need and fails closed for active content or remote references.
 */
export function assertSafeStaticSvg(asset: Pick<Asset, 'id' | 'type' | 'bytes'>): void {
  if (asset.type !== 'image/svg+xml') return;

  const fail = (reason: string): never => {
    throw new Error(`SVG asset ${asset.id} is not safe static SVG: ${reason}`);
  };
  let source = '';
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(asset.bytes);
  } catch {
    fail('invalid UTF-8');
  }

  const trimmed = source.replace(/^\uFEFF/, '').trim();
  if (!trimmed) fail('empty document');
  if (/<!DOCTYPE\b|<!ENTITY\b|<\?xml-stylesheet\b|<!\[CDATA\[/i.test(trimmed)) {
    fail('XML declarations, entities, stylesheets, and CDATA are not supported');
  }
  const withoutComments = trimmed.replace(/<!--[\s\S]*?-->/g, '');
  if (/<!--|-->/.test(withoutComments)) fail('malformed XML comment');
  const document = withoutComments.replace(/^<\?xml\b[^?]*\?>\s*/i, '').trim();
  if (!/^<svg(?:\s|>)[\s\S]*<\/svg>$/i.test(document)) fail('one complete svg root is required');
  if (/<\?(?!xml\b)/i.test(document)) fail('processing instructions are not supported');

  const forbiddenElement = /<\s*\/?\s*(?:[A-Za-z_][\w.-]*:)?(?:script|foreignObject|iframe|object|embed|audio|video|style|a|image|animate|animateMotion|animateTransform|set)\b/i;
  if (forbiddenElement.test(document)) fail('active or externally loaded elements are not supported');

  const tags = document.match(/<[^!?][^>]*>/g) || [];
  for (const rawTag of tags) {
    let tag = rawTag;
    try {
      tag = tag.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (_match, hex: string, decimal: string) => {
        const point = Number.parseInt(hex || decimal, hex ? 16 : 10);
        if (!Number.isInteger(point) || point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) {
          throw new Error('invalid character reference');
        }
        return String.fromCodePoint(point);
      });
    } catch {
      fail('invalid numeric character reference');
    }
    if (/\s(?:[A-Za-z_][\w.-]*:)?on[a-z0-9_.:-]*\s*=/i.test(tag)) {
      fail('event-handler attributes are not supported');
    }
    if (/\sstyle\s*=\s*(?:["'][\s\S]*?(?:@import|expression\s*\(|behavior\s*:|-moz-binding)[\s\S]*?["']|[^\s>]*(?:@import|expression\s*\(|behavior\s*:|-moz-binding)[^\s>]*)/i.test(tag)) {
      fail('executable CSS is not supported');
    }

    const hrefs = tag.matchAll(/(?:^|\s)(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi);
    for (const href of hrefs) {
      const value = (href[1] ?? href[2] ?? href[3] ?? '').trim();
      if (!/^#[A-Za-z_][\w:.-]*$/.test(value)) fail('only local fragment href references are supported');
    }

    const namespaces = tag.matchAll(/(?:^|\s)(xmlns(?::xlink)?)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi);
    for (const namespace of namespaces) {
      const name = namespace[1].toLowerCase();
      const value = namespace[2] ?? namespace[3] ?? namespace[4] ?? '';
      const expected = name === 'xmlns:xlink'
        ? 'http://www.w3.org/1999/xlink'
        : 'http://www.w3.org/2000/svg';
      if (value !== expected) fail('unexpected XML namespace');
    }

    const urlReferences = tag.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi);
    for (const reference of urlReferences) {
      if (!/^#[A-Za-z_][\w:.-]*$/.test(reference[2].trim())) {
        fail('only local fragment url references are supported');
      }
    }

    /* URI schemes have no purpose in the accepted static subset.  The two standard xmlns
       values above are the only exceptions and are removed before this final catch-all. */
    const withoutNamespaces = tag.replace(
      /\sxmlns(?::xlink)?\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      ''
    );
    if (/(?:javascript|vbscript|data|https?|file|ftp)\s*:/i.test(withoutNamespaces)) {
      fail('external or executable URI schemes are not supported');
    }
  }
}

const CONNECTED_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const CMS_TYPES = new Set(['text', 'rich', 'image', 'link', 'number', 'date', 'option', 'bool', 'ref']);

/** Keep the compiler's CMS boundary at least as strict as WordPress staging. */
function assertCmsContract(document: Doc, assetIds: ReadonlySet<string>) {
  const collections = document.meta.collections || [];
  if (collections.length > RELEASE_LIMITS_V1.cmsCollections) {
    throw new Error(`release has more than ${RELEASE_LIMITS_V1.cmsCollections} CMS collections`);
  }
  const collectionIds = new Set<string>();
  const globalItemIds = new Set<string>();
  for (const collection of collections) {
    if (!CONNECTED_IDENTIFIER.test(collection.id) || collection.id.length > 96
      || collectionIds.has(collection.id)) {
      throw new Error(`CMS collection ${collection.id || '(empty)'} has an invalid or duplicate ID`);
    }
    collectionIds.add(collection.id);
    if (!collection.fields.length || collection.fields.length > RELEASE_LIMITS_V1.cmsFieldsPerCollection) {
      throw new Error(`CMS collection ${collection.id} has an invalid field count`);
    }
    const fieldIds = new Set<string>();
    for (const field of collection.fields) {
      if (!CONNECTED_IDENTIFIER.test(field.id) || field.id.length > 64 || fieldIds.has(field.id)
        || !CMS_TYPES.has(field.type) || !String(field.name || '').trim()) {
        throw new Error(`CMS collection ${collection.id} has an invalid or duplicate field`);
      }
      fieldIds.add(field.id);
      if (field.type === 'option') {
        const options = String(field.opts || '').split(',').map(option => option.trim()).filter(Boolean);
        if (options.length > 100 || new Set(options).size !== options.length
          || options.some(option => utf8(option).byteLength > 500)) {
          throw new Error(`CMS option field ${field.id} has invalid or duplicate choices`);
        }
      }
      if (field.type === 'ref' && (!field.ref || !CONNECTED_IDENTIFIER.test(field.ref)
        || field.ref.length > 96)) {
        throw new Error(`CMS reference field ${field.id} has an invalid target`);
      }
    }
    const itemIds = new Set<string>();
    for (const item of collection.items) {
      if (!CONNECTED_IDENTIFIER.test(item.id) || item.id.length > 96 || itemIds.has(item.id)
        || globalItemIds.has(item.id)) {
        throw new Error(`CMS collection ${collection.id} has an invalid or duplicate item ID`);
      }
      itemIds.add(item.id);
      globalItemIds.add(item.id);
    }
  }
  for (const collection of collections) {
    for (const field of collection.fields) {
      if (field.type === 'ref' && !collectionIds.has(field.ref || '')) {
        throw new Error(`CMS reference field ${field.id} points to an unknown collection`);
      }
    }
    for (const item of collection.items) {
      assertTypedCmsWrite(document, collection.id, item.id, item.values, assetIds);
    }
  }
}

function referencedAssets(input: {
  routes: ArtifactRouteV1[];
  shared: ReleaseArtifactV1['shared'];
  cmsCollections: Doc['meta']['collections'];
}) {
  const ids = new Set<string>();
  const compiled = canonicalJson({ routes: input.routes, shared: input.shared });
  for (const match of compiled.matchAll(/pc-asset:\/\/([A-Za-z0-9][A-Za-z0-9._:-]*)/g)) ids.add(match[1]);
  for (const collection of input.cmsCollections || []) {
    const imageFields = new Set(collection.fields.filter(field => field.type === 'image').map(field => field.id));
    for (const item of collection.items) {
      for (const fieldId of imageFields) {
        const match = String(item.values[fieldId] || '').match(/^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@\d+)?$/);
        if (match) ids.add(match[1]);
      }
    }
  }
  return ids;
}

export interface IndexedWordPressLinkTarget {
  targetOrigin: string;
  targetPath: string;
  items: Array<{ objectType: 'page' | 'post'; url: string }>;
}

/** Migrate values written by the first Connected picker, which stored an exact target
 * permalink. This happens only in the release compiler's adopted document clone: the
 * source revision remains immutable, while a known staging URL can never leak into the
 * promoted production artifact. New editor writes already use the neutral reference. */
export function migrateIndexedWordPressLinks(
  source: Doc,
  targets: readonly IndexedWordPressLinkTarget[]
): { document: Doc; migrated: number; unsafeTargetUrls: string[] } {
  const replacements = new Map<string, string>();
  const unsafeIndexedUrls = new Set<string>();
  const targetScopes = targets.map(target => ({
    origin: target.targetOrigin,
    homePath: target.targetPath === '/' ? '' : target.targetPath.replace(/\/+$/, '')
  }));
  for (const target of targets) {
    const homePath = target.targetPath === '/' ? '' : target.targetPath.replace(/\/+$/, '');
    for (const item of target.items) {
      let url: URL;
      try { url = new URL(item.url); } catch {
        unsafeIndexedUrls.add(item.url);
        continue;
      }
      if (url.origin !== target.targetOrigin || url.hash || url.search
        || (homePath && url.pathname !== homePath && !url.pathname.startsWith(homePath + '/'))) {
        unsafeIndexedUrls.add(item.url);
        continue;
      }
      const relative = homePath ? (url.pathname.slice(homePath.length) || '/') : url.pathname;
      const reference = buildWordPressContentReference(item.objectType, relative);
      if (!reference || !parseWordPressContentReference(reference)) {
        unsafeIndexedUrls.add(item.url);
        continue;
      }
      const prior = replacements.get(item.url);
      if (prior && prior !== reference) {
        throw new Error('a WordPress content index maps one permalink to conflicting target-neutral routes');
      }
      replacements.set(item.url, reference);
    }
  }
  if (!targets.length) return { document: source, migrated: 0, unsafeTargetUrls: [] };

  const document = structuredClone(source);
  let migrated = 0;
  const unsafeTargetUrls = new Set<string>();
  const replace = (value: unknown) => {
    const exact = String(value == null ? '' : value).trim();
    if (unsafeIndexedUrls.has(exact)) {
      unsafeTargetUrls.add(exact);
      return value;
    }
    const next = replacements.get(exact);
    if (next) {
      migrated++;
      return next;
    }
    let url: URL;
    try { url = new URL(exact); } catch { return value; }
    if (targetScopes.some(scope => url.origin === scope.origin
      && (!scope.homePath || url.pathname === scope.homePath
        || url.pathname.startsWith(`${scope.homePath}/`)))) {
      /* An absolute URL inside a paired target is not portable. If it is no longer in
         the current native-content index, its type and stable route cannot be trusted.
         Fail publication instead of guessing and leaking a staging host to production. */
      unsafeTargetUrls.add(exact);
    }
    return value;
  };
  const components = new Map((document.meta.components || []).map(component => [component.id, component]));
  const visitNode = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.props && typeof node.props === 'object') {
      if (typeof node.props.link === 'string') node.props.link = replace(node.props.link);
      if ((node.type === 'nav' || node.type === 'crumbs') && Array.isArray(node.props.items)) {
        for (const item of node.props.items) {
          if (item && typeof item.href === 'string') item.href = replace(item.href);
        }
      }
    }
    const definition = typeof node.use === 'string' ? components.get(node.use) : null;
    if (definition && node.vals && typeof node.vals === 'object') {
      for (const property of definition.props || []) {
        if (property.t === 'link' && typeof node.vals[property.k] === 'string') {
          node.vals[property.k] = replace(node.vals[property.k]);
        }
      }
    }
    if (Array.isArray(node.children)) node.children.forEach(visitNode);
  };
  document.header.forEach(visitNode);
  document.footer.forEach(visitNode);
  document.pages.forEach(page => page.tree.forEach(visitNode));
  for (const block of document.meta.blocks || []) visitNode(block.node);
  for (const component of document.meta.components || []) {
    for (const property of component.props || []) {
      if (property.t !== 'link') continue;
      property.def = String(replace(property.def));
      for (const variant of component.variants || []) {
        if (typeof variant.values[property.k] === 'string') {
          variant.values[property.k] = String(replace(variant.values[property.k]));
        }
      }
    }
    visitNode(component.node);
  }
  return {
    document,
    migrated,
    unsafeTargetUrls: [...unsafeTargetUrls].sort(utf8ByteCompare)
  };
}

/** Freeze compiled routes and content-addressed assets; the raw editor Doc never crosses. */
export function buildReleaseArtifact(input: {
  releaseId: string;
  siteId: string;
  sourceVersion: number;
  document: Doc;
  files: Map<string, string>;
  assets?: Asset[];
}): BuiltReleaseV1 {
  if (!Number.isInteger(input.document.schemaVersion) || input.document.schemaVersion < 1) {
    throw new Error('a release requires an adopted document with schemaVersion');
  }
  const authoredDocument = canonicalJson(input.document);
  for (const marker of [
    SHARED_HEADER_START, SHARED_HEADER_END, SHARED_FOOTER_START, SHARED_FOOTER_END
  ]) {
    if (authoredDocument.includes(marker)) {
      throw new Error('release document contains a reserved shared-shell boundary marker');
    }
  }
  if (authoredCssAtRuleIssues(input.document).length) {
    throw new Error('release contains an unsafe authored CSS parser directive');
  }
  for (const [path, html] of input.files) {
    if (!path.toLowerCase().endsWith('.html')) continue;
    for (const match of String(html || '').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
      if (hasUnsafeCssParserDirective(match[1])) {
        throw new Error(`release route ${path} contains an unsafe CSS parser directive`);
      }
    }
  }
  const stylesheetLinks = releaseStylesheetLinks(input.files);
  if (stylesheetLinks.length) {
    throw new Error(
      `release contains unfrozen stylesheet links: ${stylesheetLinks.join(', ')}`
    );
  }
  const availableAssets = [...(input.assets || [])].sort((a, b) => utf8ByteCompare(a.id, b.id));
  const availableById = new Map<string, Asset>();
  const assetByPath = new Map<string, string>();
  for (const asset of availableAssets) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(asset.id) || availableById.has(asset.id)) {
      throw new Error(`release asset ${asset.id || '(empty)'} has an invalid or duplicate ID`);
    }
    const path = assetFile(asset).replace(/^\/+/, '');
    if (assetByPath.has(path)) throw new Error(`release assets collide at ${path}`);
    availableById.set(asset.id, asset);
    assetByPath.set(path, asset.id);
  }
  const htmlFiles = [...input.files]
    .filter(([path]) => path.toLowerCase().endsWith('.html'))
    .sort(([a], [b]) => utf8ByteCompare(a, b));
  if (htmlFiles.length > RELEASE_LIMITS_V1.routes) {
    throw new Error(`release has more than ${RELEASE_LIMITS_V1.routes} routes`);
  }
  const routeSources = htmlFiles.map(([file]) => releasePageForFile(input.document, file));
  const frozenFonts = frozenFontCss(htmlFiles);
  const routes: ArtifactRouteV1[] = htmlFiles.map(([file, html], index) => compileRoute(
    file, html, routeSources[index], assetByPath, input.document.meta.baseUrl || ''
  ));
  const routeIds = new Set<string>();
  const routePaths = new Set<string>();
  for (const route of routes) {
    if (!CONNECTED_IDENTIFIER.test(route.pageId) || route.pageId.length > 96
      || routeIds.has(route.pageId)) {
      throw new Error(`release route ${route.path} has an invalid or duplicate page ID`);
    }
    if (!route.path.startsWith('/') || route.path.length > 191 || routePaths.has(route.path)) {
      throw new Error(`release route ${route.path} has an invalid or duplicate path`);
    }
    routeIds.add(route.pageId);
    routePaths.add(route.path);
  }
  const sharedCandidates = htmlFiles.map(([file, html]) => compileShared(
    html, assetByPath, frozenFonts, input.document.meta.baseUrl || '', file
  ));
  const shared = sharedCandidates[0] || compileShared(
    '', assetByPath, frozenFonts, input.document.meta.baseUrl || '', 'index.html'
  );
  const sharedContract = canonicalJson(shared);
  const sharedMismatch = sharedCandidates.findIndex(candidate => canonicalJson(candidate) !== sharedContract);
  if (sharedMismatch >= 0) {
    const fields = (Object.keys(shared) as Array<keyof typeof shared>)
      .filter(field => canonicalJson(sharedCandidates[sharedMismatch][field]) !== canonicalJson(shared[field]));
    throw new Error(`release routes disagree about the shared header, footer, CSS, or runtime (${fields.join(', ')})`);
  }
  assertPortableShared(shared, input.document.meta.baseUrl || '');
  const pages = routes.map((route, index) => ({
    id: route.pageId, name: routeSources[index]?.name || route.title, path: route.path
  })).sort((a, b) => utf8ByteCompare(a.path, b.path));
  const cmsCollections = (input.document.meta.collections || []).map(collection => structuredClone(collection));
  assertCmsContract(input.document, new Set(availableById.keys()));
  const routeForms = routes.flatMap(managedFormContracts);
  const sharedForms = sharedManagedFormContracts(shared, routes);
  const forms = [...routeForms, ...sharedForms]
    .sort((a, b) => utf8ByteCompare(`${a.routePath}:${a.id}`, `${b.routePath}:${b.id}`));
  for (let index = 1; index < forms.length; index++) {
    if (forms[index - 1].routePath === forms[index].routePath
      && forms[index - 1].id.toLowerCase() === forms[index].id.toLowerCase()) {
      throw new Error(`managed form ${forms[index].id} is duplicated on ${forms[index].routePath}`);
    }
  }
  if (forms.length > RELEASE_LIMITS_V1.forms) {
    throw new Error(`release has more than ${RELEASE_LIMITS_V1.forms} managed forms`);
  }
  const redirects = htmlFiles.flatMap(([file]) => legacyRedirects(file))
    .sort((a, b) => utf8ByteCompare(a.from, b.from));
  if (redirects.length > RELEASE_LIMITS_V1.redirects) {
    throw new Error(`release has more than ${RELEASE_LIMITS_V1.redirects} redirects`);
  }
  const referencedAssetIds = referencedAssets({ routes, shared, cmsCollections });
  for (const id of referencedAssetIds) {
    if (!availableById.has(id)) throw new Error(`release references missing asset ${id}`);
  }
  if (referencedAssetIds.size > RELEASE_LIMITS_V1.assets) {
    throw new Error(`release has more than ${RELEASE_LIMITS_V1.assets} referenced assets`);
  }
  const frozenAssets = availableAssets.filter(asset => referencedAssetIds.has(asset.id));
  const decodedAssetBytes = frozenAssets.reduce((total, asset) => total + asset.bytes.byteLength, 0);
  if (decodedAssetBytes > RELEASE_LIMITS_V1.decodedAssetBytes) {
    throw new Error(`release assets exceed ${RELEASE_LIMITS_V1.decodedAssetBytes} decoded bytes`);
  }
  frozenAssets.forEach(assertSafeStaticSvg);
  const artifactAssets: ArtifactAssetV1[] = frozenAssets.map(asset => ({
    assetId: asset.id,
    filename: assetFile(asset),
    mime: asset.type,
    bytes: asset.bytes.byteLength,
    hash: sha256(asset.bytes),
    width: asset.w,
    height: asset.h,
    content: base64url(asset.bytes)
  }));
  const artifact: ReleaseArtifactV1 = {
    format: ARTIFACT_FORMAT,
    releaseId: input.releaseId,
    siteId: input.siteId,
    sourceVersion: input.sourceVersion,
    schemaVersion: input.document.schemaVersion,
    rendererVersion: `pagecraft-core-${input.document.schemaVersion}`,
    routes,
    shared,
    redirects,
    entities: {
      pages: routes.map(route => ({
        pageId: route.pageId, path: route.path, title: route.title, description: route.description
      })),
      forms
    },
    forms,
    cms: { collections: cmsCollections },
    assets: artifactAssets
  };
  if (canonicalJson(artifact).includes('pagecraft:wordpress-content:')) {
    throw new Error('release contains a raw WordPress content reference instead of a typed signed placeholder');
  }
  const placeholders: ReleaseManifestV1['placeholders'] = [
    ...routes.flatMap(route => routePlaceholders(route)),
    ...sharedRuntimePlaceholders(shared),
    ...sharedWordPressContentPlaceholders(shared),
    ...sharedForms.map(form => ({
      routePath: form.routePath,
      kind: 'form' as const,
      id: form.id,
      token: `%%PAGECRAFT_FORM_ENDPOINT:${form.id}%%`
    }))
  ];
  placeholders.sort((left, right) => utf8ByteCompare(
    `${left.routePath}:${left.kind}:${left.objectType || ''}:${left.path || ''}:${left.id || ''}:${left.token || ''}`,
    `${right.routePath}:${right.kind}:${right.objectType || ''}:${right.path || ''}:${right.id || ''}:${right.token || ''}`
  ));
  const unresolved = canonicalJson(artifact).match(/%%PAGECRAFT_[A-Za-z0-9_.:-]+%%/g) || [];
  const declared = new Set([
    ...placeholders.map(item => item.token),
    ...routes.flatMap(route => route.scripts.map(script => script.token)),
    ...shared.scripts.map(script => script.token)
  ]);
  const unknown = unresolved.filter(token => !declared.has(token));
  if (unknown.length) throw new Error(`release contains unresolved dynamic placeholders: ${[...new Set(unknown)].join(', ')}`);
  const artifactBytes = utf8(canonicalJson(artifact));
  if (artifactBytes.byteLength > RELEASE_LIMITS_V1.artifactBytes) {
    throw new Error(`release artifact exceeds ${RELEASE_LIMITS_V1.artifactBytes} bytes`);
  }
  const files: ReleaseFileV1[] = routes.map(route => {
    const payload = utf8(canonicalJson(route));
    return { path: route.path, mime: 'application/vnd.pagecraft.route+json', bytes: payload.byteLength, hash: sha256(payload) };
  });
  const assets: ReleaseAssetV1[] = artifactAssets.map(asset => ({
    id: asset.assetId, path: asset.filename, mime: asset.mime, bytes: asset.bytes,
    hash: asset.hash, width: asset.width, height: asset.height
  }));
  const cms = {
    collections: (input.document.meta.collections || []).map(collection => ({
      id: collection.id, name: collection.name
    })).sort((a, b) => utf8ByteCompare(a.id, b.id))
  };
  return {
    artifact,
    artifactBytes,
    artifactHash: sha256(artifactBytes),
    files,
    pages,
    cms,
    assets,
    scripts: [
      ...routes.flatMap(route => route.scripts.map(script => ({
        source: script.kind === 'generated' ? 'generated' as const : 'page' as const,
        ownerId: route.pageId,
        occurrenceId: script.occurrenceId,
        region: script.region,
        order: script.order,
        placement: script.placement,
        token: script.token,
        hash: script.hash,
        kind: script.kind
      }))),
      ...shared.scripts.map(script => ({
        source: script.kind === 'generated' ? 'generated' as const : 'project' as const,
        ownerId: input.siteId,
        occurrenceId: script.occurrenceId,
        region: script.region,
        order: script.order,
        placement: script.placement,
        token: script.token,
        hash: script.hash,
        kind: script.kind
      }))
    ].sort((a, b) => utf8ByteCompare(
      `${a.ownerId}:${a.region}:${String(a.order).padStart(8, '0')}:${a.occurrenceId}`,
      `${b.ownerId}:${b.region}:${String(b.order).padStart(8, '0')}:${b.occurrenceId}`
    )),
    redirects: artifact.redirects,
    entities: artifact.entities,
    forms: artifact.forms,
    placeholders
  };
}


interface HtmlTagToken {
  start: number;
  end: number;
  name: string;
  closing: boolean;
  selfClosing: boolean;
}

/** Locate real document sections without mistaking `</head>` or `</body>` text inside a script,
 * style, comment, or quoted attribute for a boundary. The renderer output is HTML, so raw-text
 * elements end at the first browser-significant matching close tag. */
function nextHtmlTag(html: string, from: number): HtmlTagToken | null {
  const token = /<!--[\s\S]*?-->|<\/?([A-Za-z][A-Za-z0-9:-]*)\b(?:[^>"']+|"[^"]*"|'[^']*')*>/gi;
  token.lastIndex = from;
  for (let match = token.exec(html); match; match = token.exec(html)) {
    if (!match[1]) continue;
    return {
      start: match.index,
      end: token.lastIndex,
      name: match[1].toLowerCase(),
      closing: /^<\//.test(match[0]),
      selfClosing: /\/\s*>$/.test(match[0])
    };
  }
  return null;
}

function rawElementEnd(html: string, token: HtmlTagToken) {
  const close = new RegExp(`<\\/${token.name}\\s*>`, 'gi');
  close.lastIndex = token.end;
  const ending = close.exec(html);
  return ending ? { start: ending.index, end: close.lastIndex } : null;
}

function htmlRawElementRanges(html: string, wanted: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const raw = new Set(['script', 'style', 'textarea', 'title', 'template']);
  let cursor = 0;
  while (cursor < html.length) {
    const token = nextHtmlTag(html, cursor);
    if (!token) break;
    cursor = token.end;
    if (token.closing || token.selfClosing || !raw.has(token.name)) continue;
    const ending = rawElementEnd(html, token);
    if (!ending) break;
    if (token.name === wanted.toLowerCase()) ranges.push({ start: token.start, end: ending.end });
    /* Script/style/RCDATA contents are not markup. Skip them even when looking for another
       element type, so inert `<script>` text cannot enter the executable inventory. */
    cursor = ending.end;
  }
  return ranges;
}

function htmlStartTagRanges(html: string, wanted?: string) {
  const ranges: Array<{ start: number; end: number; name: string }> = [];
  const inert = new Set(['script', 'style', 'textarea', 'title', 'template']);
  let cursor = 0;
  while (cursor < html.length) {
    const token = nextHtmlTag(html, cursor);
    if (!token) break;
    cursor = token.end;
    if (token.closing) continue;
    if (!wanted || token.name === wanted.toLowerCase()) {
      ranges.push({ start: token.start, end: token.end, name: token.name });
    }
    if (!token.selfClosing && inert.has(token.name)) {
      const ending = rawElementEnd(html, token);
      if (!ending) break;
      cursor = ending.end;
    }
  }
  return ranges;
}

const htmlStartTags = (html: string, tag: string) =>
  htmlStartTagRanges(String(html || ''), tag).map(range => html.slice(range.start, range.end));

function replaceHtmlStartTags(html: string, tag: string, replace: (markup: string) => string) {
  const ranges = htmlStartTagRanges(String(html || ''), tag);
  if (!ranges.length) return html;
  let out = '', cursor = 0;
  for (const range of ranges) {
    out += html.slice(cursor, range.start) + replace(html.slice(range.start, range.end));
    cursor = range.end;
  }
  return out + html.slice(cursor);
}

function replaceAllHtmlStartTags(html: string, replace: (markup: string, tag: string) => string) {
  const ranges = htmlStartTagRanges(String(html || ''));
  if (!ranges.length) return html;
  let out = '', cursor = 0;
  for (const range of ranges) {
    out += html.slice(cursor, range.start) + replace(html.slice(range.start, range.end), range.name);
    cursor = range.end;
  }
  return out + html.slice(cursor);
}

/** Replace the two document-ownership tags on Pagecraft's hosted fallback without relying on
 * quoted attributes or a particular attribute order. The tokenizer skips comments and
 * raw/RCDATA bodies, so a literal `<meta>` or `</head>` inside script/title/textarea content
 * remains inert and cannot redirect where the replacement is inserted. */
export function replaceHostedSeoOwnershipTags(html: string, replacement: string) {
  let clean = replaceHtmlStartTags(String(html || ''), 'link', tag =>
    relationTokens(tag).includes('canonical') ? '' : tag);
  clean = replaceHtmlStartTags(clean, 'meta', tag =>
    htmlAttribute(tag, 'name').trim().toLowerCase() === 'robots' ? '' : tag);
  const head = htmlSectionBounds(clean, 'head');
  return head
    ? clean.slice(0, head.innerEnd) + replacement + clean.slice(head.innerEnd)
    : replacement + clean;
}

const htmlRawElements = (html: string, tag: string) =>
  htmlRawElementRanges(String(html || ''), tag).map(range => html.slice(range.start, range.end));

function removeHtmlRawElements(html: string, tag: string) {
  const ranges = htmlRawElementRanges(String(html || ''), tag);
  if (!ranges.length) return html;
  let out = '', cursor = 0;
  for (const range of ranges) {
    out += html.slice(cursor, range.start);
    cursor = range.end;
  }
  return out + html.slice(cursor);
}

function htmlSectionBounds(html: string, wanted: string): {
  outerStart: number; innerStart: number; innerEnd: number; outerEnd: number;
} | null {
  const name = wanted.toLowerCase();
  let cursor = 0;
  let opening: HtmlTagToken | null = null;
  while (cursor < html.length) {
    const token = nextHtmlTag(html, cursor);
    if (!token) return null;
    cursor = token.end;
    if (!token.closing && token.name === name) { opening = token; break; }
    if (!token.closing && !token.selfClosing
      && ['script', 'style', 'textarea', 'title', 'template'].includes(token.name)) {
      const ending = rawElementEnd(html, token);
      if (!ending) return null;
      cursor = ending.end;
    }
  }
  if (!opening) return null;
  if (['script', 'style', 'textarea', 'title', 'template'].includes(name)) {
    const ending = rawElementEnd(html, opening);
    return ending ? {
      outerStart: opening.start, innerStart: opening.end, innerEnd: ending.start, outerEnd: ending.end
    } : null;
  }
  let depth = 1;
  cursor = opening.end;
  const raw = new Set(['script', 'style', 'textarea', 'title', 'template']);
  while (cursor < html.length) {
    const token = nextHtmlTag(html, cursor);
    if (!token) return null;
    if (!token.closing && !token.selfClosing && raw.has(token.name) && token.name !== name) {
      const ending = rawElementEnd(html, token);
      if (!ending) return null;
      cursor = ending.end;
      continue;
    }
    cursor = token.end;
    if (token.name !== name) continue;
    if (token.closing) {
      depth--;
      if (depth === 0) return {
        outerStart: opening.start, innerStart: opening.end, innerEnd: token.start, outerEnd: token.end
      };
    } else if (!token.selfClosing) depth++;
  }
  return null;
}

interface HtmlElementSection {
  outerStart: number;
  innerStart: number;
  innerEnd: number;
  outerEnd: number;
  opening: string;
  inner: string;
  outer: string;
}

/** Return complete, real elements in document order. `htmlSectionBounds` already skips
 * comments and raw/RCDATA contents, so strings such as `</form>` inside a textarea or script
 * cannot truncate a form and commented controls cannot enter its signed field contract. */
function htmlElementSections(html: string, wanted: string): HtmlElementSection[] {
  const sections: HtmlElementSection[] = [];
  let cursor = 0;
  while (cursor < html.length) {
    const relative = htmlSectionBounds(html.slice(cursor), wanted);
    if (!relative) break;
    const bounds = {
      outerStart: cursor + relative.outerStart,
      innerStart: cursor + relative.innerStart,
      innerEnd: cursor + relative.innerEnd,
      outerEnd: cursor + relative.outerEnd
    };
    sections.push({
      ...bounds,
      opening: html.slice(bounds.outerStart, bounds.innerStart),
      inner: html.slice(bounds.innerStart, bounds.innerEnd),
      outer: html.slice(bounds.outerStart, bounds.outerEnd)
    });
    cursor = bounds.outerEnd;
  }
  return sections;
}

function htmlSectionInner(html: string, tag: string) {
  const found = htmlSectionBounds(String(html || ''), tag);
  return found ? html.slice(found.innerStart, found.innerEnd) : null;
}

function htmlSectionOuter(html: string, tag: string) {
  const found = htmlSectionBounds(String(html || ''), tag);
  return found ? html.slice(found.outerStart, found.outerEnd) : null;
}

function removeHtmlSection(html: string, tag: string) {
  const found = htmlSectionBounds(String(html || ''), tag);
  return found ? html.slice(0, found.outerStart) + html.slice(found.outerEnd) : html;
}

/** Core owns one page-level main and emits its generated interaction runtime at the end of
 * body. Header/footer scripts belong to the shared shell; everything else in body belongs to
 * this route even when it sits after main. Keeping these regions separate prevents both the
 * old runtime loss and double-inventorying a global authored script. */
function documentBodyRegions(html: string) {
  const full = htmlSectionInner(html, 'body') ?? html;
  const main = htmlSectionBounds(full, 'main');
  const markers = [
    SHARED_HEADER_START, SHARED_HEADER_END, SHARED_FOOTER_START, SHARED_FOOTER_END
  ];
  const markerIndexes = markers.map(marker => full.indexOf(marker));
  const hasMarker = markerIndexes.some(index => index >= 0);
  if (hasMarker) {
    if (!main || markerIndexes.some((index, position) => index < 0
      || full.lastIndexOf(markers[position]) !== index)) {
      throw new Error('release route has invalid shared-shell boundary markers');
    }
    const [headerStart, headerEnd, footerStart, footerEnd] = markerIndexes;
    const headerContentStart = headerStart + SHARED_HEADER_START.length;
    const headerAfter = headerEnd + SHARED_HEADER_END.length;
    const footerContentStart = footerStart + SHARED_FOOTER_START.length;
    const footerAfter = footerEnd + SHARED_FOOTER_END.length;
    if (!(headerStart <= headerEnd && headerAfter <= main.outerStart
      && main.outerEnd <= footerStart && footerStart <= footerEnd)) {
      throw new Error('release route has out-of-order shared-shell boundary markers');
    }
    const routeBefore = full.slice(0, headerStart) + full.slice(headerAfter, main.outerStart);
    const routeAfter = full.slice(main.outerEnd, footerStart) + full.slice(footerAfter);
    const mainInner = full.slice(main.innerStart, main.innerEnd);
    return {
      full,
      main: mainInner,
      routeBefore,
      routeAfter,
      route: routeBefore + mainInner + routeAfter,
      header: full.slice(headerContentStart, headerEnd),
      footer: full.slice(footerContentStart, footerEnd)
    };
  }
  if (!main) {
    const header = htmlSectionOuter(full, 'header') || '';
    const footer = htmlSectionOuter(full, 'footer') || '';
    const routeBody = removeHtmlSection(removeHtmlSection(full, 'header'), 'footer');
    return {
      full, main: routeBody, routeBefore: '', routeAfter: '', route: routeBody, header, footer
    };
  }
  const before = full.slice(0, main.outerStart);
  const after = full.slice(main.outerEnd);
  const header = htmlSectionOuter(before, 'header') || '';
  const footer = htmlSectionOuter(after, 'footer') || '';
  const routeBefore = removeHtmlSection(before, 'header');
  const routeAfter = removeHtmlSection(after, 'footer');
  return {
    full,
    main: full.slice(main.innerStart, main.innerEnd),
    routeBefore,
    routeAfter,
    route: routeBefore + full.slice(main.innerStart, main.innerEnd) + routeAfter,
    header, footer
  };
}

function compiledScriptOccurrences(
  owner: string,
  groups: Array<{ region: ArtifactScriptRegionV1; placement: 'head' | 'body'; scripts: string[] }>
) {
  const contents: string[] = [];
  const scripts: ArtifactScriptOccurrenceV1[] = [];
  for (const group of groups) {
    group.scripts.forEach((script, order) => {
      const hash = sha256(utf8(script));
      const occurrenceId = `script-${sha256(utf8(`${owner}\0${group.region}\0${order}\0${hash}`)).slice(0, 32)}`;
      contents.push(script);
      scripts.push({
        occurrenceId,
        region: group.region,
        order,
        placement: group.placement,
        token: `%%PAGECRAFT_RUNTIME:${occurrenceId}%%`,
        hash,
        kind: scriptKind(script)
      });
    });
  }
  return { runtime: contents.join('\n'), scripts };
}

/** Replace each executable element with a signed inert marker at the same DOM position. The
 * connector substitutes the approved occurrence there after verifying the artifact. JSON-LD
 * is carried by typed SEO instead and deliberately has no runtime marker. */
function runtimeMarkedMarkup(markup: string, occurrences: ArtifactScriptOccurrenceV1[]) {
  const ranges = htmlRawElementRanges(String(markup || ''), 'script');
  if (!ranges.length) {
    if (occurrences.length) throw new Error('release runtime occurrence has no source position');
    return markup;
  }
  let out = '', cursor = 0, executable = 0;
  for (const range of ranges) {
    const script = markup.slice(range.start, range.end);
    out += markup.slice(cursor, range.start);
    if (!isJsonLd(script)) {
      const occurrence = occurrences[executable++];
      if (!occurrence) throw new Error('release executable script has no signed occurrence');
      out += `<!--${occurrence.token}-->`;
    }
    cursor = range.end;
  }
  if (executable !== occurrences.length) {
    throw new Error('release runtime occurrence count does not match its source positions');
  }
  return out + markup.slice(cursor);
}

function compileRoute(
  file: string, html: string, page: Doc['pages'][number] | undefined,
  assetByPath: Map<string, string>, sourceBaseUrl: string
): ArtifactRouteV1 {
  const path = cleanRoute(file);
  if (html.includes('%%PAGECRAFT_RUNTIME:')) {
    throw new Error(`release route ${path} contains a reserved runtime placeholder`);
  }
  if (htmlStartTags(html, 'template').length) {
    throw new Error(`release route ${path} contains an unsupported template element`);
  }
  const head = htmlSectionInner(html, 'head') || '';
  const bodyRegions = documentBodyRegions(html);
  const body = bodyRegions.main;
  const routeBody = bodyRegions.route;
  const allHeadScripts = htmlRawElements(head, 'script');
  const firstExecutableHeadScript = htmlRawElementRanges(head, 'script')
    .find(range => !isJsonLd(head.slice(range.start, range.end)));
  const styleAfterHeadRuntime = firstExecutableHeadScript
    && htmlRawElementRanges(head, 'style').some(range => range.start > firstExecutableHeadScript.start);
  if (styleAfterHeadRuntime) {
    throw new Error(
      `release route ${path} contains a head style after executable runtime; portable CSS must precede route-head runtime`
    );
  }
  const beforeMainScripts = htmlRawElements(bodyRegions.routeBefore, 'script');
  const allRouteScripts = htmlRawElements(bodyRegions.main, 'script');
  const allTailScripts = htmlRawElements(bodyRegions.routeAfter, 'script');
  if (beforeMainScripts.some(script => !isJsonLd(script))) {
    throw new Error(`release route ${path} contains an executable script outside its portable content region`);
  }
  const structuredData = [...allHeadScripts, ...beforeMainScripts, ...allRouteScripts, ...allTailScripts]
    .filter(isJsonLd)
    .map((script, index) => portableJsonLd(
      script, sourceBaseUrl, assetByPath, `${path} JSON-LD ${index + 1}`
    ));
  const headScripts = allHeadScripts.filter(script => !isJsonLd(script));
  const routeScripts = allRouteScripts.filter(script => !isJsonLd(script));
  const tailScripts = allTailScripts.filter(script => !isJsonLd(script));
  /* One route stylesheet follows actual document source order, including authored styles in
     the shared shell. This preserves equal-specificity cascade behavior without asking the
     connector to guess how separately compiled shared/route streams should interleave. */
  const styles = [...htmlRawElements(head, 'style'), ...htmlRawElements(bodyRegions.full, 'style')];
  const styleBody = styles.filter(style => !/\bdata-pagecraft-frozen-fonts\s*=/i.test(style))
    .map((style, index) => portableStyleElement(style, `${path} style ${index + 1}`)).join('\n');
  const title = decodeEntity(htmlSectionInner(head, 'title') || page?.title || page?.name || '');
  const description = attribute(head, 'meta', 'name', 'description', 'content') || page?.desc || '';
  const ownedSeo = ownedSeoValues(head, path);
  assertFormDestinations(body, path);
  const inline = inlineExecutables(removeHtmlRawElements(head + '\n' + routeBody, 'script'));
  if (inline.length) {
    throw new Error(`unsafe inline executable markup in ${path}: ${inline.join(', ')}`);
  }
  const rewrittenHeadScripts = headScripts.map(script => rewriteAssetReferences(script, assetByPath));
  const rewrittenRouteScripts = routeScripts.map(script => rewriteAssetReferences(script, assetByPath));
  const rewrittenTailScripts = tailScripts.map(script => rewriteAssetReferences(script, assetByPath));
  assertImmutableScriptSources(
    [...rewrittenHeadScripts, ...rewrittenRouteScripts, ...rewrittenTailScripts], cleanRoute(file)
  );
  const portableCss = rewritePortableCssUrls(styleBody, sourceBaseUrl, assetByPath);
  assertImmutableCssResources(portableCss, `${path} CSS`);
  const compiledScripts = compiledScriptOccurrences(path, [
    { region: 'route-head', placement: 'head', scripts: rewrittenHeadScripts },
    { region: 'route-body', placement: 'body', scripts: rewrittenRouteScripts },
    { region: 'route-tail', placement: 'body', scripts: rewrittenTailScripts }
  ]);
  const headOccurrences = compiledScripts.scripts.filter(script => script.region === 'route-head');
  const bodyOccurrences = compiledScripts.scripts.filter(script => script.region === 'route-body');
  const markedHead = runtimeMarkedMarkup(head, headOccurrences);
  const markedBody = runtimeMarkedMarkup(body, bodyOccurrences);
  const portableHead = portableSeoHead(
    removeHtmlRawElements(markedHead, 'style'), sourceBaseUrl, assetByPath, path
  );
  const route: ArtifactRouteV1 = {
    pageId: page?.id || `route-${sha256(utf8(path)).slice(0, 48)}`,
    path,
    title,
    description,
    headHtml: rewritePortableMarkup(portableHead.trim(), file, assetByPath, sourceBaseUrl),
    headOrder: 'css-before-runtime',
    bodyHtml: rewritePortableMarkup(
      removeHtmlRawElements(markedBody, 'style').trim(), file, assetByPath, sourceBaseUrl
    ),
    bodyKind: 'content-fragment',
    css: scopeCss(portableCss),
    runtime: compiledScripts.runtime,
    seo: {
      title,
      description,
      /* Target-neutral paths are signed. The connector owns the exact WordPress origin. */
      canonical: path,
      robots: attribute(head, 'meta', 'name', 'robots', 'content'),
      ogTitle: ownedSeo.get('og:title') || '',
      ogDescription: ownedSeo.get('og:description') || '',
      ogType: ownedSeo.get('og:type') || '',
      ogUrl: path,
      ogImage: portableOwnedAssetUrl(
        ownedSeo.get('og:image') || '', sourceBaseUrl, assetByPath, `${path} og:image`
      ),
      ogImageSecureUrl: portableOwnedAssetUrl(
        ownedSeo.get('og:image:secure_url') || '', sourceBaseUrl, assetByPath,
        `${path} og:image:secure_url`
      ),
      twitterCard: ownedSeo.get('twitter:card') || '',
      twitterTitle: ownedSeo.get('twitter:title') || '',
      twitterDescription: ownedSeo.get('twitter:description') || '',
      twitterImage: portableOwnedAssetUrl(
        ownedSeo.get('twitter:image') || '', sourceBaseUrl, assetByPath, `${path} twitter:image`
      ),
      structuredData: canonicalJson(structuredData)
    },
    scripts: compiledScripts.scripts,
    sourceHash: sha256(utf8(html))
  };
  assertPortableRoute(route, sourceBaseUrl);
  return route;
}

const SUPPORTED_OWNED_SEO = new Set([
  'og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:secure_url',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'
]);

function ownedSeoValues(head: string, owner: string) {
  const values = new Map<string, string>();
  for (const tag of htmlStartTags(head, 'meta')) {
    const names = [htmlAttribute(tag, 'property'), htmlAttribute(tag, 'name')]
      .map(value => value.trim().toLowerCase()).filter(value => /^(?:og|twitter):/.test(value));
    const unique = [...new Set(names)];
    if (!unique.length) continue;
    if (unique.length !== 1) throw new Error(`release route ${owner} has an ambiguous owned SEO meta tag`);
    const field = unique[0];
    if (!SUPPORTED_OWNED_SEO.has(field)) {
      throw new Error(`release route ${owner} uses unsupported owned SEO field ${field}`);
    }
    if (values.has(field)) throw new Error(`release route ${owner} repeats owned SEO field ${field}`);
    values.set(field, htmlAttribute(tag, 'content'));
  }
  return values;
}

/** Remove source-host ownership tags and normalize the URL-bearing head fields the connector
 * may safely carry. WordPress reconstructs canonical and Open Graph URLs from the signed route
 * path plus the authorized target. Any remaining mutable resource is rejected below. */
function portableSeoHead(
  head: string, sourceBaseUrl: string, assetByPath: Map<string, string>, owner: string
) {
  let out = replaceHtmlStartTags(head, 'meta', tag => {
    const owners = [htmlAttribute(tag, 'property'), htmlAttribute(tag, 'name')]
      .map(value => value.trim().toLowerCase());
    if (owners.some(value => /^(?:og|twitter):/.test(value))) return '';
    const name = htmlAttribute(tag, 'name').toLowerCase();
    if (name === 'msapplication-tileimage') {
      return replaceHtmlAttribute(tag, 'content', value =>
        portableArtifactUrl(value, sourceBaseUrl, assetByPath));
    }
    return tag;
  });
  out = replaceHtmlStartTags(out, 'link', tag => {
    const rel = relationTokens(tag);
    if (rel.includes('canonical')) return '';
    if (rel.includes('stylesheet')) throw new Error(`release route ${owner} contains an unfrozen stylesheet`);
    if (rel.includes('manifest')) throw new Error(`release route ${owner} contains an unsupported mutable manifest`);
    if (rel.includes('modulepreload')) {
      throw new Error(`release route ${owner} contains an unsupported executable resource hint`);
    }
    if (rel.includes('preload')) {
      const as = htmlAttribute(tag, 'as').toLowerCase();
      if (as !== 'image' && as !== 'font') {
        throw new Error(`release route ${owner} contains unsupported preload type ${as || '(missing)'}`);
      }
    }
    const carriesUrl = rel.some(value => [
      'alternate', 'feed', 'icon', 'apple-touch-icon', 'apple-touch-startup-image', 'mask-icon',
      'preload', 'preconnect', 'dns-prefetch'
    ].includes(value));
    if (!carriesUrl) return tag;
    const oldHref = htmlAttribute(tag, 'href');
    const portableHref = portableArtifactUrl(oldHref, sourceBaseUrl, assetByPath);
    if ((rel.includes('preconnect') || rel.includes('dns-prefetch')) && portableHref !== oldHref) return '';
    let rewritten = replaceHtmlAttribute(tag, 'href', () => portableHref);
    if (htmlAttribute(rewritten, 'imagesrcset')) {
      rewritten = replaceHtmlAttribute(rewritten, 'imagesrcset', value =>
        value.split(',').map(candidate => {
          const match = candidate.trim().match(/^(\S+)([\s\S]*)$/);
          return match
            ? `${portableArtifactUrl(match[1], sourceBaseUrl, assetByPath)}${match[2]}` : candidate;
        }).join(', '));
    }
    return rewritten;
  });
  return out;
}

function replaceHtmlAttribute(tag: string, name: string, transform: (value: string) => string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\s${escaped}\\s*=\\s*)(?:(["'])([\\s\\S]*?)\\2|([^\\s\\"'\u0060<>]+))`, 'i');
  return tag.replace(pattern, (_whole, lead: string, _quote: string | undefined,
    quoted: string | undefined, unquoted: string | undefined) => {
    const value = decodeHtmlEntities((quoted ?? unquoted ?? '').trim());
    const rewritten = transform(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `${lead}"${rewritten}"`;
  });
}

function portableStyleElement(style: string, owner: string) {
  const opening = htmlStartTags(style, 'style')[0] || '<style>';
  assertAllowedAttributes(opening, ['media', 'type', 'nonce'], owner);
  const type = htmlAttribute(opening, 'type').trim().toLowerCase();
  if (type && type !== 'text/css') throw new Error(`release ${owner} uses unsupported style type ${type}`);
  const css = htmlSectionInner(style, 'style') ?? '';
  const media = htmlAttribute(opening, 'media').trim();
  if (!media) return css;
  if (media.length > 512 || /[{};\u0000-\u001f]/.test(media)) {
    throw new Error(`release ${owner} uses an unsafe style media query`);
  }
  return `@media ${media}{${css}}`;
}

function portableJsonLd(
  script: string, sourceBaseUrl: string, assetByPath: Map<string, string>, owner: string
): unknown {
  const body = script.replace(/^<script\b[^>]*>|<\/script\s*>$/gi, '').trim();
  try {
    return mapJson(JSON.parse(body), (item, path) => {
      if (typeof item !== 'string') return item;
      const last = path.at(-1) || '';
      let imageOwner = -1;
      for (let index = path.length - 1; index >= 0; index--) {
        if (/^(?:image|logo)$/i.test(path[index])) { imageOwner = index; break; }
      }
      const imageTail = imageOwner < 0 ? [] : path.slice(imageOwner + 1);
      const directImageValue = imageOwner >= 0 && imageTail.every(key => /^\d+$/.test(key));
      const imageObjectUrl = imageOwner >= 0 && /^(?:url|thumbnailUrl|contentUrl)$/i.test(last);
      const imageLike = directImageValue || imageObjectUrl
        || /^(?:thumbnailUrl|contentUrl|embedUrl)$/i.test(last);
      return imageLike
        ? portableOwnedAssetUrl(item, sourceBaseUrl, assetByPath, `${owner} ${path.join('.')}`)
        : portableArtifactUrl(item, sourceBaseUrl, assetByPath);
    });
  } catch {
    throw new Error(`release route ${owner} contains invalid JSON-LD`);
  }
}

const portableArtifactUrl = (value: string, sourceBaseUrl: string, assetByPath: Map<string, string>) =>
  rewriteAssetReferences(portableUrl(value, sourceBaseUrl), assetByPath);

function portableOwnedAssetUrl(
  value: string, sourceBaseUrl: string, assetByPath: Map<string, string>, owner: string
) {
  if (!value) return '';
  const rewritten = portableArtifactUrl(value, sourceBaseUrl, assetByPath);
  let local = !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(value);
  if (!local && sourceBaseUrl) {
    try { local = new URL(value, sourceBaseUrl).origin === new URL(sourceBaseUrl).origin; } catch { /* reject below */ }
  }
  if (local && !immutableResourceUrl(rewritten)) {
    throw new Error(`release ${owner} references an unfrozen local asset`);
  }
  return rewritten;
}

function mapJson(
  value: unknown, visit: (value: unknown, path: string[]) => unknown, path: string[] = []
): unknown {
  if (Array.isArray(value)) return value.map((item, index) => mapJson(item, visit, [...path, String(index)]));
  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, mapJson(item, visit, [...path, key])]));
  }
  return visit(value, path);
}

function portableUrl(value: string, sourceBaseUrl: string) {
  if (!value || !sourceBaseUrl) return value;
  try {
    const source = new URL(sourceBaseUrl);
    const target = new URL(value, source);
    if (target.origin !== source.origin) return value;
    const prefix = source.pathname.replace(/\/+$/, '');
    if (prefix && target.pathname !== prefix && !target.pathname.startsWith(prefix + '/')) return value;
    let path = target.pathname.slice(prefix.length) || '/';
    path = path.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '') || '/';
    return path + target.search + target.hash;
  } catch { return value; }
}

const relationTokens = (tag: string) => htmlAttribute(tag, 'rel').toLowerCase()
  .split(/\s+/).filter(Boolean);

function htmlAttributeNames(tag: string) {
  const body = tag.replace(/^<[A-Za-z][A-Za-z0-9:-]*/, '').replace(/\/?>\s*$/, '');
  const names = new Set<string>();
  const attribute = /([^\s"'\u0060=<>\/]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'\u0060<>]+))?/g;
  for (const match of body.matchAll(attribute)) names.add(match[1].toLowerCase());
  return names;
}

function assertAllowedAttributes(tag: string, allowed: string[], owner: string) {
  const extras = [...htmlAttributeNames(tag)].filter(name => !allowed.includes(name));
  if (extras.length) throw new Error(`release route ${owner} uses unsupported head attributes: ${extras.join(', ')}`);
}

const sourceUrl = (value: string, sourceBaseUrl: string) => {
  if (!sourceBaseUrl || !/^(?:https?:)?\/\//i.test(value.trim())) return false;
  try {
    const source = new URL(sourceBaseUrl);
    const target = new URL(value.startsWith('//') ? `${source.protocol}${value}` : value);
    return target.origin === source.origin;
  } catch { return false; }
};

const immutableResourceUrl = (value: string) => /^(?:pc-asset:\/\/|data:)/i.test(value.trim());

type PortableEmbedProvider = 'youtube' | 'vimeo';

/** Connected v1 deliberately permits only the player documents that Pagecraft's Video and
 * Embed widgets can describe without executable inline markup. The remote player remains a
 * live third-party integration; every ordinary image/media/file resource must still be frozen
 * into the signed release. */
function portableEmbedProvider(value: string): PortableEmbedProvider | null {
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    if ((url.hostname === 'www.youtube.com' || url.hostname === 'www.youtube-nocookie.com')
      && /^\/embed\/[A-Za-z0-9_-]{6,128}$/.test(url.pathname)) return 'youtube';
    if (url.hostname === 'player.vimeo.com' && /^\/video\/[0-9]{1,32}$/.test(url.pathname)) {
      return 'vimeo';
    }
  } catch { /* unsupported URL */ }
  return null;
}

function setHtmlAttribute(tag: string, name: string, value: string) {
  if (htmlAttributeNames(tag).has(name.toLowerCase())) {
    return replaceHtmlAttribute(tag, name, () => value);
  }
  const encoded = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return tag.replace(/(\s*\/?>)$/, ` ${name}="${encoded}"$1`);
}

function markPortableEmbed(tag: string, tagName: string) {
  if (tagName === 'iframe') {
    const provider = portableEmbedProvider(htmlAttribute(tag, 'src'));
    if (!provider) throw new Error('release contains an unsupported iframe source');
    const allowed = new Set([
      'src', 'title', 'width', 'height', 'loading', 'allow', 'allowfullscreen', 'frameborder',
      'referrerpolicy', 'sandbox', 'class', 'id', 'aria-label', 'data-pagecraft-embed-provider'
    ]);
    const extras = [...htmlAttributeNames(tag)].filter(name => !allowed.has(name));
    if (extras.length) throw new Error(`release iframe uses unsupported attributes: ${extras.join(', ')}`);
    const loading = htmlAttribute(tag, 'loading').toLowerCase();
    if (loading && loading !== 'lazy' && loading !== 'eager') {
      throw new Error('release iframe uses an unsupported loading mode');
    }
    const frameborder = htmlAttribute(tag, 'frameborder');
    if (frameborder && frameborder !== '0' && frameborder !== '1') {
      throw new Error('release iframe uses an unsupported frameborder');
    }
    for (const name of ['title', 'allow', 'referrerpolicy', 'sandbox', 'class', 'id', 'aria-label']) {
      if (htmlAttribute(tag, name).length > 512) {
        throw new Error(`release iframe ${name} exceeds the portable limit`);
      }
    }
    return setHtmlAttribute(tag, 'data-pagecraft-embed-provider', provider);
  }
  const facadeUrl = htmlAttribute(tag, 'data-embed');
  if (!facadeUrl) {
    if (htmlAttributeNames(tag).has('data-pagecraft-embed-provider')) {
      throw new Error('release contains orphaned embed provenance');
    }
    return tag;
  }
  if (tagName !== 'button') throw new Error('release contains data-embed on an unsupported element');
  const provider = portableEmbedProvider(facadeUrl);
  if (!provider) throw new Error('release contains an unsupported video facade source');
  return setHtmlAttribute(tag, 'data-pagecraft-embed-provider', provider);
}

function assertHeadContract(head: string, owner: string) {
  for (const tag of htmlStartTags(head, 'meta')) {
    const owned = [htmlAttribute(tag, 'property'), htmlAttribute(tag, 'name')]
      .map(value => value.toLowerCase());
    if (owned.some(value => /^(?:og|twitter):/.test(value))) {
      throw new Error(`release route ${owner} retained a raw owned SEO meta tag`);
    }
    if (htmlAttribute(tag, 'name').toLowerCase() === 'msapplication-tileimage') {
      if (!immutableResourceUrl(htmlAttribute(tag, 'content'))) {
        throw new Error(`release route ${owner} contains an unfrozen tile image`);
      }
      assertAllowedAttributes(tag, ['name', 'content'], owner);
    }
  }
  for (const tag of htmlStartTags(head, 'link')) {
    const rel = relationTokens(tag);
    if (rel.includes('canonical')) throw new Error(`release route ${owner} retained a raw canonical link`);
    if (!rel.length || rel.includes('stylesheet') || rel.includes('manifest') || rel.includes('modulepreload')) {
      throw new Error(`release route ${owner} contains an unsupported link resource`);
    }
    const href = htmlAttribute(tag, 'href');
    if (!href) throw new Error(`release route ${owner} contains a link without href`);
    if (rel.includes('preload')) {
      const as = htmlAttribute(tag, 'as').toLowerCase();
      if ((as !== 'image' && as !== 'font') || !immutableResourceUrl(href)) {
        throw new Error(`release route ${owner} contains an unfrozen preload resource`);
      }
      assertAllowedAttributes(tag, [
        'rel', 'href', 'as', 'type', 'media', 'crossorigin', 'imagesrcset', 'imagesizes',
        'fetchpriority', 'referrerpolicy'
      ], owner);
      const srcset = htmlAttribute(tag, 'imagesrcset');
      if (srcset && srcset.split(',').some(candidate =>
        !immutableResourceUrl(candidate.trim().split(/\s+/, 1)[0] || ''))) {
        throw new Error(`release route ${owner} contains an unfrozen preload image candidate`);
      }
      continue;
    }
    if (rel.some(value => ['icon', 'apple-touch-icon', 'apple-touch-startup-image', 'mask-icon'].includes(value))) {
      const allowedRel = new Set([
        'icon', 'shortcut', 'apple-touch-icon', 'apple-touch-startup-image', 'mask-icon'
      ]);
      if (rel.some(value => !allowedRel.has(value)) || !immutableResourceUrl(href)) {
        throw new Error(`release route ${owner} contains an unfrozen icon resource`);
      }
      assertAllowedAttributes(tag, [
        'rel', 'href', 'sizes', 'color', 'type', 'media', 'crossorigin', 'fetchpriority', 'referrerpolicy'
      ], owner);
      continue;
    }
    if (rel.some(value => value === 'alternate' || value === 'feed')) {
      if (rel.some(value => value !== 'alternate' && value !== 'feed')) {
        throw new Error(`release route ${owner} contains unsupported alternate link semantics`);
      }
      assertAllowedAttributes(tag, ['rel', 'href', 'hreflang', 'type', 'media', 'title'], owner);
      continue;
    }
    if (rel.some(value => value === 'preconnect' || value === 'dns-prefetch')) {
      if (rel.some(value => value !== 'preconnect' && value !== 'dns-prefetch')) {
        throw new Error(`release route ${owner} contains unsupported connection hint semantics`);
      }
      assertAllowedAttributes(tag, ['rel', 'href', 'crossorigin'], owner);
      continue;
    }
    throw new Error(`release route ${owner} contains unsupported link relation ${rel.join(' ')}`);
  }
}

function assertNoSourceOriginInMarkup(markup: string, sourceBaseUrl: string, owner: string) {
  if (!sourceBaseUrl) return;
  for (const range of htmlStartTagRanges(markup)) {
    const tag = markup.slice(range.start, range.end);
    for (const name of [
      'href', 'src', 'action', 'formaction', 'poster', 'data', 'data-embed', 'cite', 'longdesc', 'content'
    ]) {
      const value = htmlAttribute(tag, name);
      const externalFormDestination = (name === 'action' && range.name === 'form'
        || name === 'formaction' && (range.name === 'button' || range.name === 'input'))
        && /^https:\/\//i.test(value);
      if (externalFormDestination) continue;
      if (value && sourceUrl(value, sourceBaseUrl)) {
        throw new Error(`release ${owner} retained the Pagecraft source origin in ${name}`);
      }
    }
    for (const name of ['srcset', 'imagesrcset']) {
      const value = htmlAttribute(tag, name);
      if (value && value.split(',').some(candidate =>
        sourceUrl(candidate.trim().split(/\s+/, 1)[0] || '', sourceBaseUrl))) {
        throw new Error(`release ${owner} retained the Pagecraft source origin in ${name}`);
      }
    }
  }
}

function assertNoSourceOriginInText(value: string, sourceBaseUrl: string, owner: string) {
  if (!sourceBaseUrl) return;
  let source: URL;
  try { source = new URL(sourceBaseUrl); } catch { return; }
  if (value.includes(source.origin) || value.includes(source.origin.replaceAll('/', '\\/'))) {
    throw new Error(`release ${owner} retained the Pagecraft source origin`);
  }
}

function assertFrozenMarkupResources(markup: string, owner: string) {
  for (const range of htmlStartTagRanges(markup)) {
    const tag = markup.slice(range.start, range.end);
    const resourceAttributes: string[] = [];
    if (range.name === 'img' || range.name === 'source') resourceAttributes.push('src');
    if (range.name === 'video') resourceAttributes.push('src', 'poster');
    if (range.name === 'audio' || range.name === 'track') resourceAttributes.push('src');
    if (range.name === 'input' && htmlAttribute(tag, 'type').toLowerCase() === 'image') {
      resourceAttributes.push('src');
    }
    for (const name of resourceAttributes) {
      const value = htmlAttribute(tag, name);
      if (value && !immutableResourceUrl(value)) {
        throw new Error(`release ${owner} contains an unfrozen ${range.name} ${name}`);
      }
    }
    if ((range.name === 'img' || range.name === 'source') && htmlAttribute(tag, 'srcset')) {
      for (const candidate of htmlAttribute(tag, 'srcset').split(',')) {
        if (!immutableResourceUrl(candidate.trim().split(/\s+/, 1)[0] || '')) {
          throw new Error(`release ${owner} contains an unfrozen ${range.name} srcset candidate`);
        }
      }
    }
    if (range.name === 'object' || range.name === 'embed') {
      throw new Error(`release ${owner} contains an unsupported ${range.name} element`);
    }
    if (range.name === 'iframe') {
      const provider = portableEmbedProvider(htmlAttribute(tag, 'src'));
      const provenance = htmlAttribute(tag, 'data-pagecraft-embed-provider');
      if (!provider || provenance !== provider) {
        throw new Error(`release ${owner} contains an unverified iframe`);
      }
    }
    if (htmlAttribute(tag, 'data-embed')) {
      const provider = portableEmbedProvider(htmlAttribute(tag, 'data-embed'));
      const provenance = htmlAttribute(tag, 'data-pagecraft-embed-provider');
      if (range.name !== 'button' || !provider || provenance !== provider) {
        throw new Error(`release ${owner} contains an unverified video facade`);
      }
    }
  }
}

function assertPortableRoute(route: ArtifactRouteV1, sourceBaseUrl: string) {
  assertHeadContract(route.headHtml, route.path);
  assertFrozenMarkupResources(route.headHtml, `${route.path} head`);
  assertFrozenMarkupResources(route.bodyHtml, `${route.path} body`);
  assertNoSourceOriginInMarkup(route.headHtml, sourceBaseUrl, `${route.path} head`);
  assertNoSourceOriginInMarkup(route.bodyHtml, sourceBaseUrl, `${route.path} body`);
  assertNoSourceOriginInText(route.css, sourceBaseUrl, `${route.path} CSS`);
  assertNoSourceOriginInText(route.runtime, sourceBaseUrl, `${route.path} runtime`);
  assertNoSourceOriginInText(canonicalJson(route.seo), sourceBaseUrl, `${route.path} SEO`);
}

function assertPortableShared(shared: ReleaseArtifactV1['shared'], sourceBaseUrl: string) {
  assertFrozenMarkupResources(shared.headerHtml, 'shared header');
  assertFrozenMarkupResources(shared.footerHtml, 'shared footer');
  assertNoSourceOriginInMarkup(shared.headerHtml, sourceBaseUrl, 'shared header');
  assertNoSourceOriginInMarkup(shared.footerHtml, sourceBaseUrl, 'shared footer');
  assertNoSourceOriginInText(shared.css, sourceBaseUrl, 'shared CSS');
  assertNoSourceOriginInText(shared.runtime, sourceBaseUrl, 'shared runtime');
}

function rewritePortableCssUrls(css: string, sourceBaseUrl: string, assetByPath: Map<string, string>) {
  const rewritten = rewriteAssetReferences(String(css || '').replace(
    /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
    (_whole, quote: string, value: string) => {
      const rewritten = portableArtifactUrl(value.trim(), sourceBaseUrl, assetByPath);
      return `url(${quote}${rewritten}${quote})`;
    }
  ), assetByPath);
  return rewritten;
}

/** CSS participates in the same immutable-resource contract as HTML. A relative or same-origin
 * URL that did not map to a signed asset would otherwise become a WordPress-local request for
 * bytes that are not in the release. External CSS resources are equally mutable, so v1 accepts
 * only signed asset tokens, embedded data, and same-document fragment references. */
function assertImmutableCssResources(css: string, owner: string) {
  for (const value of cssUrlResources(css)) {
    if (/^(?:pc-asset:\/\/|data:|#)/i.test(value)) continue;
    throw new Error(`release ${owner} references an unfrozen CSS resource`);
  }
}

/** Browser-equivalent CSS URL scanner. Function identifiers can contain comments, line
 * continuations, and escapes (`u\72l`, `\75rl`); quoted strings that merely mention `url()`
 * are inert. Escapes inside the resource itself fail closed rather than being normalized into
 * a potentially different network destination. */
function cssUrlResources(css: string): string[] {
  const source = String(css || '');
  const urls: string[] = [];
  const commentEnd = (at: number) => {
    const end = source.indexOf('*/', at + 2);
    return end < 0 ? source.length : end + 2;
  };
  const escaped = (at: number): { value: string; end: number } => {
    let cursor = at + 1;
    if (cursor >= source.length) return { value: '', end: cursor };
    if (source[cursor] === '\r' || source[cursor] === '\n' || source[cursor] === '\f') {
      if (source[cursor] === '\r' && source[cursor + 1] === '\n') cursor++;
      return { value: '', end: cursor + 1 };
    }
    const hex = source.slice(cursor).match(/^[0-9a-f]{1,6}/i)?.[0] || '';
    if (!hex) return { value: source[cursor], end: cursor + 1 };
    cursor += hex.length;
    if (/\s/.test(source[cursor] || '')) cursor += source[cursor] === '\r'
      && source[cursor + 1] === '\n' ? 2 : 1;
    const point = Number.parseInt(hex, 16);
    return {
      value: point && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : '\uFFFD',
      end: cursor
    };
  };
  const quotedEnd = (at: number) => {
    const quote = source[at++];
    while (at < source.length) {
      if (source[at] === '\\') { at = escaped(at).end; continue; }
      if (source[at++] === quote) break;
    }
    return at;
  };
  let cursor = 0;
  while (cursor < source.length) {
    if (source.startsWith('/*', cursor)) { cursor = commentEnd(cursor); continue; }
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = quotedEnd(cursor); continue;
    }
    if (!/[A-Za-z_-]/.test(source[cursor]) && source[cursor] !== '\\') { cursor++; continue; }
    const start = cursor;
    let identifier = '';
    while (cursor < source.length) {
      if (source.startsWith('/*', cursor)) { cursor = commentEnd(cursor); continue; }
      if (source[cursor] === '\\') {
        const part = escaped(cursor); identifier += part.value; cursor = part.end; continue;
      }
      if (!/[A-Za-z0-9_-]/.test(source[cursor])) break;
      identifier += source[cursor++];
    }
    if (identifier.toLowerCase() !== 'url') {
      if (cursor === start) cursor++;
      continue;
    }
    while (cursor < source.length && (/\s/.test(source[cursor]) || source.startsWith('/*', cursor))) {
      cursor = source.startsWith('/*', cursor) ? commentEnd(cursor) : cursor + 1;
    }
    if (source[cursor] !== '(') continue;
    cursor++;
    while (/\s/.test(source[cursor] || '')) cursor++;
    const quote = source[cursor] === '"' || source[cursor] === "'" ? source[cursor++] : '';
    const valueStart = cursor;
    if (quote) {
      while (cursor < source.length && source[cursor] !== quote) {
        if (source[cursor] === '\\') cursor = escaped(cursor).end; else cursor++;
      }
    } else {
      while (cursor < source.length && source[cursor] !== ')') cursor++;
    }
    const raw = source.slice(valueStart, cursor).trim();
    if (quote && source[cursor] === quote) cursor++;
    while (/\s/.test(source[cursor] || '')) cursor++;
    if (source[cursor] === ')') cursor++;
    urls.push(/[\\]|\/\*/.test(raw) ? '__pagecraft_unsafe_css_url__' : raw);
  }
  return urls;
}

const FORM_RESERVED_FIELDS = new Set(['action', 'form_id', '_wpnonce', '_wp_http_referer']);
function runtimePlaceholders(markup: string, routePath: string): ReleaseManifestV1['placeholders'] {
  return [...markup.matchAll(/<!--(%%PAGECRAFT_RUNTIME:(script-[a-f0-9]{32})%%)-->/g)].map(match => ({
    routePath, kind: 'runtime' as const, id: match[2], token: match[1]
  }));
}

function formPlaceholders(markup: string, routePath: string): ReleaseManifestV1['placeholders'] {
  return htmlStartTags(markup, 'form').flatMap(opening => {
    const action = htmlAttribute(opening, 'action');
    const match = action.match(/^%%PAGECRAFT_FORM_ENDPOINT:([A-Za-z0-9][A-Za-z0-9._:-]{0,95})%%$/);
    return match ? [{
      routePath, kind: 'form' as const, id: match[1], token: action
    }] : [];
  }).sort((a, b) => utf8ByteCompare(a.id || '', b.id || ''));
}

/** Native WordPress destinations are allowed only as exact href values on anchors.
 * Their type and WordPress-home-relative route are repeated in the signed manifest,
 * so the connector never infers a target-local operation from an opaque string. */
function wordpressContentPlaceholders(
  markup: string, routePath: string
): ReleaseManifestV1['placeholders'] {
  const found = new Map<string, ReleaseManifestV1['placeholders'][number]>();
  const anchorTokens: string[] = [];
  for (const opening of htmlStartTags(markup, 'a')) {
    const token = htmlAttribute(opening, 'href');
    if (!token.includes('PAGECRAFT_WP_CONTENT')) continue;
    const reference = parseWordPressContentToken(token);
    if (!reference || wordpressContentToken(reference) !== token) {
      throw new Error(`release route ${routePath} contains an invalid WordPress content placeholder`);
    }
    anchorTokens.push(token);
    found.set(token, {
      routePath,
      kind: 'wordpress-content',
      objectType: reference.objectType,
      path: reference.path,
      token
    });
  }
  const allTokens = markup.match(/%%PAGECRAFT_WP_CONTENT:(?:page|post):[A-Za-z0-9_-]+%%/g) || [];
  const malformed = markup.replace(/%%PAGECRAFT_WP_CONTENT:(?:page|post):[A-Za-z0-9_-]+%%/g, '')
    .includes('%%PAGECRAFT_WP_CONTENT');
  const sortedAnchors = [...anchorTokens].sort(utf8ByteCompare);
  if (malformed || (markup.includes('%%PAGECRAFT_WP_CONTENT')
    && (allTokens.length !== anchorTokens.length
      || [...allTokens].sort(utf8ByteCompare).some((token, index) =>
        token !== sortedAnchors[index])))) {
    throw new Error(`release route ${routePath} contains a WordPress content placeholder outside an exact anchor href`);
  }
  return [...found.values()].sort((a, b) => utf8ByteCompare(a.token || '', b.token || ''));
}

function routePlaceholders(route: ArtifactRouteV1): ReleaseManifestV1['placeholders'] {
  const runtime = [
    ...runtimePlaceholders(route.headHtml, route.path),
    ...runtimePlaceholders(route.bodyHtml, route.path)
  ];
  const expected = route.scripts.filter(script => script.region !== 'route-tail');
  if (runtime.length !== expected.length
    || expected.some(script => runtime.filter(item => item.id === script.occurrenceId
      && item.token === script.token).length !== 1)) {
    throw new Error(`release route ${route.path} runtime markers do not match signed occurrences`);
  }
  return [
    ...runtime,
    ...formPlaceholders(route.bodyHtml, route.path),
    ...wordpressContentPlaceholders(route.headHtml + '\n' + route.bodyHtml, route.path)
  ];
}

function sharedRuntimePlaceholders(
  shared: ReleaseArtifactV1['shared']
): ReleaseManifestV1['placeholders'] {
  const runtime = [
    ...runtimePlaceholders(shared.headerHtml, '*'),
    ...runtimePlaceholders(shared.footerHtml, '*')
  ];
  if (runtime.length !== shared.scripts.length
    || shared.scripts.some(script => runtime.filter(item => item.id === script.occurrenceId
      && item.token === script.token).length !== 1)) {
    throw new Error('release shared runtime markers do not match signed occurrences');
  }
  return runtime;
}

function sharedWordPressContentPlaceholders(
  shared: ReleaseArtifactV1['shared']
): ReleaseManifestV1['placeholders'] {
  return wordpressContentPlaceholders(
    shared.headerHtml + '\n' + shared.footerHtml,
    '*'
  );
}

/** The signed form definition is the only input contract WordPress accepts. It is
 * compiled from the exact managed form markup rather than inferred from submitted keys. */
function managedFormContractsInMarkup(
  markup: string, routePath: string, owner = routePath
): ReleaseFormV1[] {
  const out: ReleaseFormV1[] = [];
  const seen = new Set<string>();
  for (const form of htmlElementSections(markup, 'form')) {
    const opening = form.opening;
    const action = htmlAttribute(opening, 'action');
    const token = action.match(/^%%PAGECRAFT_FORM_ENDPOINT:([A-Za-z0-9][A-Za-z0-9._:-]{0,95})%%$/);
    if (!token) continue;
    const id = token[1];
    const formKey = id.toLowerCase();
    if (seen.has(formKey)) throw new Error(`managed form ${id} is duplicated on ${owner}`);
    seen.add(formKey);
    const fields: ReleaseFormFieldV1[] = [];
    const names = new Set<string>();
    let privacyEmailSeen = false;
    const controls: Array<{
      start: number; tag: 'input' | 'select' | 'textarea'; opening: string; inner: string;
    }> = [
      ...htmlStartTagRanges(form.inner, 'input').map(range => ({
        start: range.start, tag: 'input' as const,
        opening: form.inner.slice(range.start, range.end), inner: ''
      })),
      ...htmlElementSections(form.inner, 'select').map(section => ({
        start: section.outerStart, tag: 'select' as const,
        opening: section.opening, inner: section.inner
      })),
      ...htmlElementSections(form.inner, 'textarea').map(section => ({
        start: section.outerStart, tag: 'textarea' as const,
        opening: section.opening, inner: section.inner
      }))
    ].sort((left, right) => left.start - right.start);
    for (const control of controls) {
      const attributes = htmlAttributeNames(control.opening);
      if (attributes.has('disabled')) continue;
      const name = htmlAttribute(control.opening, 'name');
      if (!name) throw new Error(`managed form ${id} on ${owner} has a field without a name`);
      const lowerName = name.toLowerCase();
      if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(name)
        || lowerName.startsWith('pagecraft_') || FORM_RESERVED_FIELDS.has(lowerName)) {
        throw new Error(`managed form ${id} on ${owner} has an unsupported field name`);
      }
      if (names.has(lowerName)) throw new Error(`managed form ${id} on ${owner} repeats field ${name}`);
      names.add(lowerName);
      const rawType = control.tag === 'textarea' || control.tag === 'select'
        ? control.tag : (htmlAttribute(control.opening, 'type') || 'text').toLowerCase();
      if (!['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox'].includes(rawType)) {
        throw new Error(`managed form ${id} on ${owner} uses unsupported field type ${rawType}`);
      }
      if (attributes.has('multiple')) {
        throw new Error(`managed form ${id} on ${owner} uses an unsupported multi-value field`);
      }
      const type = rawType as ReleaseFormFieldV1['type'];
      const required = attributes.has('required');
      const options = type === 'select' ? htmlElementSections(control.inner, 'option')
        .map(option => htmlAttributeNames(option.opening).has('value')
          ? htmlAttribute(option.opening, 'value')
          : decodeEntity(option.inner.replace(/<!--[^]*?-->/g, '').replace(/<[^>]*>/g, '').trim())) : [];
      if (options.length > 100 || options.some(option => !option || utf8(option).byteLength > 500)
        || new Set(options).size !== options.length) {
        throw new Error(`managed form ${id} on ${owner} has invalid or duplicate options`);
      }
      if (type === 'select' && !options.length) {
        throw new Error(`managed form ${id} on ${owner} requires at least one select option`);
      }
      const isPrivacyEmail: boolean = type === 'email' && !privacyEmailSeen;
      fields.push({
        name, type, required,
        ...(options.length ? { options } : {}),
        ...(isPrivacyEmail ? { privacy: 'email' as const } : {})
      });
      if (isPrivacyEmail) privacyEmailSeen = true;
    }
    if (!fields.length) throw new Error(`managed form ${id} on ${owner} has no supported fields`);
    if (fields.length > 50) throw new Error(`managed form ${id} on ${owner} has too many fields`);
    out.push({ id, routePath, method: 'POST', fields });
  }
  for (const placeholder of formPlaceholders(markup, routePath)) {
    if (!out.some(form => form.id === placeholder.id)) {
      throw new Error(`managed form placeholder ${placeholder.id} on ${owner} is outside a complete form`);
    }
  }
  return out;
}

function managedFormContracts(route: ArtifactRouteV1): ReleaseFormV1[] {
  return managedFormContractsInMarkup(route.bodyHtml, route.path);
}

function sharedManagedFormContracts(
  shared: ReleaseArtifactV1['shared'], routes: ArtifactRouteV1[]
): ReleaseFormV1[] {
  const templates = managedFormContractsInMarkup(
    shared.headerHtml + '\n' + shared.footerHtml,
    '*',
    'the shared site shell'
  );
  return routes.flatMap(route => templates.map(form => ({
    ...form,
    routePath: route.path,
    fields: form.fields.map(field => ({ ...field, ...(field.options ? { options: [...field.options] } : {}) }))
  })));
}

function assertFormDestinations(markup: string, owner: string) {
  for (const opening of htmlStartTags(markup, 'form')) {
    const action = htmlAttribute(opening, 'action');
    if (action.startsWith('%%PAGECRAFT_FORM_ENDPOINT:')) {
      if (!/^%%PAGECRAFT_FORM_ENDPOINT:[A-Za-z0-9][A-Za-z0-9._:-]{0,95}%%$/.test(action)) {
        throw new Error(`WordPress-managed form on ${owner} has an unsupported form ID`);
      }
      if ((htmlAttribute(opening, 'method') || 'get').toLowerCase() !== 'post') {
        throw new Error(`WordPress-managed form on ${owner} must use POST`);
      }
      continue;
    }
    let endpoint: URL | null = null;
    try { endpoint = new URL(action); } catch { /* handled below */ }
    if (!endpoint || endpoint.protocol !== 'https:' || !endpoint.hostname) {
      throw new Error(`external form on ${owner} requires an absolute HTTPS endpoint`);
    }
  }
}

function frozenFontCss(htmlFiles: Array<[string, string]>) {
  const found = new Set<string>();
  let pagesWithFonts = 0;
  for (const [path, html] of htmlFiles) {
    const styles = (html.match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || [])
      .filter(style => /\bdata-pagecraft-frozen-fonts\s*=/i.test(style));
    if (styles.length > 1) throw new Error(`release route ${path} repeats its frozen font stylesheet`);
    if (!styles.length) continue;
    pagesWithFonts++;
    const opening = styles[0].match(/^<style\b[^>]*>/i)?.[0] || '';
    const declared = htmlAttribute(opening, 'data-pagecraft-frozen-fonts');
    const css = styles[0].replace(/^<style\b[^>]*>\n?|\n?<\/style\s*>$/gi, '');
    if (!/^[a-f0-9]{64}$/.test(declared) || sha256(utf8(css)) !== declared) {
      throw new Error(`release route ${path} has invalid frozen font CSS`);
    }
    found.add(css);
  }
  if (found.size > 1 || (pagesWithFonts && pagesWithFonts !== htmlFiles.length)) {
    throw new Error('release routes disagree about their frozen font CSS');
  }
  return [...found][0] || '';
}

function compileShared(
  html: string,
  assetByPath: Map<string, string>,
  frozenFonts = '',
  sourceBaseUrl = '',
  currentFile = 'index.html'
): ReleaseArtifactV1['shared'] {
  const regions = documentBodyRegions(html);
  const header = regions.header, footer = regions.footer;
  const shell = header + '\n' + footer;
  assertFormDestinations(shell, 'the shared site shell');
  const headerScripts = htmlRawElements(header, 'script');
  const footerScripts = htmlRawElements(footer, 'script');
  const shellScripts = [...headerScripts, ...footerScripts];
  if (shellScripts.some(isJsonLd)) {
    throw new Error('shared site shell contains unsupported JSON-LD; move structured data into a page head');
  }
  const inline = inlineExecutables(removeHtmlRawElements(shell, 'script'));
  if (inline.length) throw new Error(`unsafe inline executable markup in shared shell: ${inline.join(', ')}`);
  const rewrittenHeaderScripts = headerScripts.map(script => rewriteAssetReferences(script, assetByPath));
  const rewrittenFooterScripts = footerScripts.map(script => rewriteAssetReferences(script, assetByPath));
  const executable = [...rewrittenHeaderScripts, ...rewrittenFooterScripts];
  assertImmutableScriptSources(executable, 'the shared site shell');
  const portableCss = rewritePortableCssUrls(
    frozenFonts, sourceBaseUrl, assetByPath
  );
  assertImmutableCssResources(portableCss, 'shared CSS');
  const compiledScripts = compiledScriptOccurrences('shared', [
    { region: 'shared-header', placement: 'body', scripts: rewrittenHeaderScripts },
    { region: 'shared-footer', placement: 'body', scripts: rewrittenFooterScripts }
  ]);
  const clean = (value: string, region: 'shared-header' | 'shared-footer') =>
    rewritePortableMarkup(
      removeHtmlRawElements(runtimeMarkedMarkup(
        value, compiledScripts.scripts.filter(script => script.region === region)
      ), 'style'),
      currentFile, assetByPath, sourceBaseUrl
    ).trim();
  return {
    css: scopeCss(portableCss),
    runtime: compiledScripts.runtime,
    headerHtml: clean(header, 'shared-header'),
    footerHtml: clean(footer, 'shared-footer'),
    scripts: compiledScripts.scripts
  };
}

function rewritePortableMarkup(
  markup: string, currentFile: string, assetByPath: Map<string, string>, sourceBaseUrl = ''
) {
  let out = rewriteAssetReferences(markup, assetByPath);
  const basePath = '/' + currentFile.replace(/^\/+/, '').replace(/[^/]+$/, '');
  const portable = (raw: string) => {
    const value = raw.trim();
    if (!value || value.startsWith('#') || value.startsWith('%%PAGECRAFT_')) return raw;
    const owned = portableUrl(value, sourceBaseUrl);
    if (owned !== value) return owned;
    if (/^([a-z][\w+.-]*:|\/\/)/i.test(value)) return raw;
    try {
      const url = new URL(value, `https://pagecraft.invalid${basePath}`);
      if (!/\.html$/i.test(url.pathname)) return raw;
      const clean = url.pathname.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '') || '/';
      return `${clean}${url.search}${url.hash}`;
    } catch { return raw; }
  };
  out = replaceAllHtmlStartTags(out, (tag, tagName) => {
    let rewritten = tag;
    for (const name of ['href', 'src', 'action', 'formaction', 'poster', 'data', 'cite', 'longdesc']) {
      const value = htmlAttribute(rewritten, name);
      const externalFormDestination = (name === 'action' && tagName === 'form'
        || name === 'formaction' && (tagName === 'button' || tagName === 'input'))
        && /^https:\/\//i.test(value);
      if (value && !externalFormDestination) rewritten = replaceHtmlAttribute(rewritten, name, portable);
    }
    for (const name of ['srcset', 'imagesrcset']) {
      if (!htmlAttribute(rewritten, name)) continue;
      rewritten = replaceHtmlAttribute(rewritten, name, value => value.split(',').map(candidate => {
        const match = candidate.trim().match(/^(\S+)([\s\S]*)$/);
        return match ? `${portable(match[1])}${match[2]}` : candidate;
      }).join(', '));
    }
    return markPortableEmbed(rewritten, tagName);
  });
  /* Absolute source URLs become route-relative before this pass, so map their newly portable
     asset paths as well as the paths that were already relative in the renderer output. */
  return rewriteAssetReferences(out, assetByPath);
}

function rewriteAssetReferences(value: string, assetByPath: Map<string, string>) {
  let out = value;
  for (const [path, id] of [...assetByPath].sort(([a], [b]) => b.length - a.length)) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(`(^|["'\\s(,:=])(?:(?:\\.\\.\\/)+|\\.\\/|\\/)?${escaped}(?=["'\\s),?#]|$)`, 'g'),
      `$1pc-asset://${id}`
    );
  }
  return out;
}

function inlineExecutables(markup: string) {
  const found: string[] = [];
  for (const range of htmlStartTagRanges(markup)) {
    const tag = markup.slice(range.start, range.end);
    const names = htmlAttributeNames(tag);
    for (const name of names) {
      if (/^on[a-z][\w:-]*$/i.test(name)) found.push(`${name}=${htmlAttribute(tag, name)}`);
    }
    for (const name of ['href', 'src', 'action', 'formaction', 'data']) {
      const value = htmlAttribute(tag, name).trim();
      if (/^(?:javascript:|data:text\/html(?:;|,))/i.test(value)) found.push(`${name}=${value}`);
    }
    if (names.has('srcdoc')) found.push(`srcdoc:${htmlAttribute(tag, 'srcdoc')}`);
  }
  return [...new Set(found)].sort(utf8ByteCompare);
}

const isJsonLd = (script: string) => {
  const opening = htmlStartTags(script, 'script')[0] || '';
  const type = htmlAttribute(opening, 'type').split(';', 1)[0].trim().toLowerCase();
  /* A src-bearing script is executable/mutable even if it claims the JSON-LD MIME type. */
  return type === 'application/ld+json' && !htmlAttribute(opening, 'src');
};
/** A signed approval must cover the bytes the browser executes. Local release assets are
 * content-addressed; a cross-origin script is only immutable when the browser is given SRI.
 * Relative or protocol-relative sources that were not frozen as assets fail publication. */
function assertImmutableScriptSources(scripts: string[], owner: string) {
  for (const script of scripts) {
    const opening = htmlStartTags(script, 'script')[0] || '';
    const attributes = htmlAttributeNames(opening);
    if (!attributes.has('src')) continue;
    const src = htmlAttribute(opening, 'src');
    if (!src) throw new Error(`executable script in ${owner} has a malformed src`);
    if (src.startsWith('pc-asset://')) continue;
    if (!/^https:\/\//i.test(src)) {
      throw new Error(`executable script in ${owner} is not a frozen release asset or absolute HTTPS URL`);
    }
    const integrity = htmlAttribute(opening, 'integrity');
    const crossorigin = htmlAttribute(opening, 'crossorigin').toLowerCase();
    const validIntegrity = integrity.split(/\s+/).filter(Boolean).some(value =>
      /^(?:sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}$/.test(value));
    if (!validIntegrity || (crossorigin !== '' && crossorigin !== 'anonymous')
      || !attributes.has('crossorigin')) {
      throw new Error(`external executable script in ${owner} requires SRI integrity and crossorigin="anonymous"`);
    }
  }
}

export const decodeHtmlEntities = (value: string) => String(value || '')
  .replace(/&#x([0-9a-f]+);?|&#([0-9]+);?/gi,
    (_whole, hexadecimal: string | undefined, decimal: string | undefined) => {
      const point = Number.parseInt(hexadecimal || decimal || '0', hexadecimal ? 16 : 10);
      return point && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : '\uFFFD';
    })
  .replace(/&(amp|lt|gt|quot|apos|colon|sol|plus|tab|newline);/gi, (_whole, name: string) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', sol: '/', plus: '+',
    tab: '\t', newline: '\n'
  })[name.toLowerCase()] || _whole);

function htmlAttribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = tag.match(new RegExp(`\\s${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  if (quoted) return decodeHtmlEntities(quoted[2].trim());
  return decodeHtmlEntities(
    (tag.match(new RegExp("\\s" + escaped + "\\s*=\\s*([^\\s\\\"'`<>]+)", 'i'))?.[1] || '').trim()
  );
}
const scriptKind = (script: string): 'generated' | 'authored' =>
  /data-(?:slider|tabs|nav|facade|lightbox)|pagecraft-(?:animate|copy)|IntersectionObserver/.test(script)
    ? 'generated' : 'authored';

function attribute(html: string, tag: string, key: string, expected: string, value: string) {
  for (const attrs of htmlStartTags(html, tag)) {
    if (htmlAttribute(attrs, key).toLowerCase() !== expected.toLowerCase()) continue;
    return htmlAttribute(attrs, value);
  }
  return '';
}

const decodeEntity = decodeHtmlEntities;

/** Resolve generated pagination and CMS-detail files back to stable Pagecraft identities.
 * Derived IDs use source IDs rather than slugs, so changing a public URL does not orphan the
 * corresponding managed WordPress record. */
function releasePageForFile(document: Doc, file: string): Doc['pages'][number] | undefined {
  const exact = document.pages.find(page => pageFile(page.slug) === file);
  if (exact) return exact;

  const pagination = file.match(/^(.*)\/page-([1-9]\d*)\.html$/i);
  if (pagination) {
    const source = document.pages.find(page => page.slug.replace(/^\/+|\/+$/g, '') === pagination[1]);
    if (source) return {
      ...source,
      id: `route-${sha256(utf8(`page\0${source.id}\0${pagination[2]}`)).slice(0, 48)}`,
      name: `${source.name} — page ${pagination[2]}`
    };
  }

  for (const collection of document.meta.collections || []) {
    const prefix = collection.slug.replace(/^\/+|\/+$/g, '') + '/';
    if (!file.startsWith(prefix) || !file.toLowerCase().endsWith('.html')) continue;
    const itemSlug = file.slice(prefix.length, -'.html'.length);
    const item = collection.items.find(candidate => candidate.slug === itemSlug && !candidate.draft);
    const source = document.pages.find(page => page.collection === collection.id);
    if (item && source) return {
      ...source,
      id: `route-${sha256(utf8(`detail\0${source.id}\0${item.id}`)).slice(0, 48)}`,
      name: `${source.name}: ${item.values.title || item.values.name || item.slug}`
    };
  }
  return undefined;
}

const pageFile = (slug: string) => {
  const value = String(slug || 'index').replace(/^\/+|\/+$/g, '');
  return value === 'index' ? 'index.html' : value.endsWith('.html') ? value : value + '.html';
};
const cleanRoute = (file: string) => {
  let path = '/' + file.replace(/^\/+/, '');
  if (/\/index\.html$/i.test(path)) path = path.slice(0, -'index.html'.length);
  else if (/\.html$/i.test(path)) path = path.slice(0, -'.html'.length);
  return path || '/';
};
const legacyRedirects = (file: string): ReleaseArtifactV1['redirects'] => {
  const normalized = '/' + file.replace(/^\/+/, '');
  const to = cleanRoute(file);
  const from = [normalized];
  if (/\/index\.html$/i.test(normalized)) from.push(normalized.slice(0, -'.html'.length));
  return [...new Set(from)].filter(value => value !== to && value.length <= 191 && to.length <= 191).map(value => {
    const redirect = { from: value, to, status: 301 as const };
    return { ...redirect, hash: sha256(utf8(canonicalJson(redirect))) };
  });
};
/** Scope generated CSS for Existing Theme mode without rewriting keyframe selectors. */
export function scopeCss(css: string, root = '.pagecraft-root'): string {
  const walk = (source: string): string => {
    let out = '', at = 0;
    while (at < source.length) {
      const next = nextCssBlockOrStatement(source, at);
      if (!next) { out += source.slice(at); break; }
      if (next.kind === 'statement') {
        const statement = source.slice(at, next.at + 1);
        const semantic = canonicalCssSyntax(statement).trim();
        if (!semantic) out += statement;
        else if (/^@layer\s+[A-Za-z_][\w.-]*(?:\s*,\s*[A-Za-z_][\w.-]*)*\s*;$/i.test(semantic)) {
          out += statement;
        } else {
          throw new Error('unsupported CSS statement at-rule');
        }
        at = next.at + 1;
        continue;
      }
      const open = next.at;
      const prelude = source.slice(at, open);
      const close = matchingBrace(source, open);
      if (close < 0) throw new Error('unbalanced CSS block');
      const body = source.slice(open + 1, close);
      const semantic = canonicalCssSyntax(prelude).trim();
      if (/^@(?:media|supports|layer|container)\b/i.test(semantic)) {
        out += prelude + '{' + walk(body) + '}';
      } else if (/^@(?:-webkit-)?keyframes\b/i.test(semantic)
        || /^@(?:font-face|property|page)\b/i.test(semantic)) {
        out += prelude + '{' + body + '}';
      } else if (semantic.startsWith('@')) {
        out += prelude + '{' + body + '}';
      } else {
        const lead = prelude.match(/^(?:(?:\s+)|(?:\/\*[\s\S]*?\*\/))*/)?.[0] || '';
        const selectors = prelude.slice(lead.length).trim();
        out += lead + splitSelectors(selectors).map(selector => scopeSelector(selector, root)).join(',')
          + '{' + body + '}';
      }
      at = close + 1;
    }
    return out;
  };
  return walk(String(css || ''));
}

/** Authored project CSS that cannot be safely isolated in another theme fails publication. */
export function unsafeExistingThemeCss(css: string): string[] {
  const issues = new Set<string>();
  const inspect = (source: string) => {
    let at = 0;
    while (at < source.length) {
      const next = nextCssBlockOrStatement(source, at);
      if (!next) {
        if (/@(?:import|namespace|charset)\b/i.test(source.slice(at))) issues.add('unsafe-global-at-rule');
        break;
      }
      if (next.kind === 'statement') {
        const semantic = canonicalCssSyntax(source.slice(at, next.at + 1)).trim();
        if (semantic && !/^@layer\s+[A-Za-z_][\w.-]*(?:\s*,\s*[A-Za-z_][\w.-]*)*\s*;$/i.test(semantic)) {
          issues.add(semantic.startsWith('@') ? 'unsafe-global-at-rule' : 'invalid-css');
        }
        at = next.at + 1;
        continue;
      }
      const open = next.at;
      const prelude = source.slice(at, open).trim();
      const semantic = canonicalCssSyntax(prelude).trim();
      const close = matchingBrace(source, open);
      if (close < 0) { issues.add('invalid-css'); break; }
      const body = source.slice(open + 1, close);
      if (/^@(?:media|supports|layer|container)\b/i.test(semantic)) inspect(body);
      else if (/^@(?:-webkit-)?keyframes\b/i.test(semantic)) issues.add('unsafe-global-at-rule');
      else if (semantic.startsWith('@')) issues.add('unsafe-global-at-rule');
      else for (const selector of splitSelectors(prelude)) {
        if (/^(?:\*|:root\b|html\b|body\b)/i.test(selector.trim())) issues.add('unsafe-global-selector');
      }
      at = close + 1;
    }
  };
  let source = canonicalCssSyntax(css);
  if (/@(?:import|namespace|charset)\b/i.test(source)) issues.add('unsafe-global-at-rule');
  source = source.replace(/@(?:import|namespace|charset)\b[^;]*;/gi, '');
  inspect(source);
  return [...issues].sort(utf8ByteCompare);
}

/** Normalize only CSS syntax, never string or URL contents. CSS identifiers may escape any
 * character and comments disappear before parsing, so literal regexes alone do not recognize
 * browser-equivalent `@import`/`body` spellings. */
export function canonicalCssSyntax(css: string): string {
  const source = String(css || '');
  let out = '';
  for (let i = 0; i < source.length;) {
    if (source.startsWith('/*', i)) {
      const close = source.indexOf('*/', i + 2);
      i = close < 0 ? source.length : close + 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += quote;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i++;
          if (i < source.length && source[i] === '\r' && source[i + 1] === '\n') i += 2;
          else if (i < source.length) i++;
          continue;
        }
        if (source[i] === quote) { i++; break; }
        i++;
      }
      out += quote;
      continue;
    }
    if (ch !== '\\') { out += ch; i++; continue; }
    i++;
    if (i >= source.length) break;
    if (source[i] === '\n' || source[i] === '\f') { i++; continue; }
    if (source[i] === '\r') { i += source[i + 1] === '\n' ? 2 : 1; continue; }
    const hex = source.slice(i).match(/^[0-9a-f]{1,6}/i)?.[0] || '';
    if (hex) {
      i += hex.length;
      if (/\s/.test(source[i] || '')) i += source[i] === '\r' && source[i + 1] === '\n' ? 2 : 1;
      const point = Number.parseInt(hex, 16);
      out += point && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : '\uFFFD';
      continue;
    }
    out += source[i++];
  }
  /* Strings above are empty placeholders. Mask unquoted URL payloads too so a harmless path
     containing the text "@import" is not mistaken for a parser directive. */
  return out.replace(/\burl\s*\([^)]*\)/gi, 'url()');
}

export const hasUnsafeCssParserDirective = (css: string) =>
  /@(?:import|namespace|charset)(?![-_a-z0-9])/i.test(canonicalCssSyntax(css));

/** Only authored, free-form CSS is publication-blocking. Generated Pagecraft rules are
 * deterministically scoped by `scopeCss`; node advanced CSS is rendered under its node id. */
export function authoredStylesheetIssues(document: Doc): string[] {
  const issues = new Set<string>();
  const inspect = (html: string) => {
    for (const match of String(html || '').matchAll(/<link\b[^>]*>/gi)) {
      const rel = htmlAttribute(match[0], 'rel').toLowerCase().split(/\s+/).filter(Boolean);
      if (rel.includes('stylesheet')) issues.add('unsafe-external-stylesheet');
    }
  };
  inspect(document.meta.headHtml || '');
  const visit = (nodes: Doc['header']) => {
    for (const node of nodes || []) {
      if (node.type === 'embed') inspect(String(node.props.html || ''));
      visit(node.children || []);
    }
  };
  visit(document.header); visit(document.footer);
  for (const page of document.pages) { inspect(page.headHtml || ''); visit(page.tree); }
  for (const component of document.meta.components || []) visit(component.node ? [component.node] : []);
  return [...issues].sort(utf8ByteCompare);
}

/** Pagecraft Theme may own global selectors, but an authored import/namespace/charset still
 * pulls mutable bytes or changes parser context outside the signed release. */
export function authoredCssAtRuleIssues(document: Doc): string[] {
  const sources = [document.meta.css || ''];
  const inspect = (html: string) => {
    for (const match of String(html || '').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
      sources.push(match[1]);
    }
  };
  inspect(document.meta.headHtml || '');
  const visit = (nodes: Doc['header']) => {
    for (const node of nodes || []) {
      if (node.type === 'embed') inspect(String(node.props.html || ''));
      visit(node.children || []);
    }
  };
  visit(document.header); visit(document.footer);
  for (const page of document.pages) { inspect(page.headHtml || ''); visit(page.tree); }
  for (const component of document.meta.components || []) visit(component.node ? [component.node] : []);
  return sources.some(hasUnsafeCssParserDirective)
    ? ['unsafe-global-at-rule'] : [];
}

/** A Connected release has to remain immutable and work without a third-party stylesheet
 * changing beneath its signature. Until the publisher freezes stylesheet and font bytes,
 * every linked stylesheet (including renderer-generated Google Fonts CSS) is unsupported. */
export function releaseStylesheetLinks(files: Map<string, string>): string[] {
  const links = new Set<string>();
  for (const [path, html] of files) {
    if (!path.toLowerCase().endsWith('.html')) continue;
    for (const match of String(html || '').matchAll(/<link\b[^>]*>/gi)) {
      const rel = htmlAttribute(match[0], 'rel').toLowerCase().split(/\s+/).filter(Boolean);
      if (!rel.includes('stylesheet')) continue;
      links.add(htmlAttribute(match[0], 'href') || `${path}#stylesheet-without-href`);
    }
  }
  return [...links].sort(utf8ByteCompare);
}

export function existingThemeCssIssues(document: Doc): string[] {
  const authored: string[] = [document.meta.css || ''];
  const takeStyles = (html: string) => {
    const source = String(html || '');
    for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) authored.push(match[1]);
  };
  takeStyles(document.meta.headHtml || '');
  const visit = (nodes: Doc['header']) => {
    for (const node of nodes || []) {
      if (node.type === 'embed') takeStyles(String(node.props.html || ''));
      visit(node.children || []);
    }
  };
  visit(document.header); visit(document.footer);
  for (const page of document.pages) { takeStyles(page.headHtml || ''); visit(page.tree); }
  for (const component of document.meta.components || []) visit(component.node ? [component.node] : []);
  return [...new Set([
    ...authored.flatMap(unsafeExistingThemeCss), ...authoredStylesheetIssues(document)
  ])].sort(utf8ByteCompare);
}

function splitSelectors(value: string) {
  const parts: string[] = [];
  let start = 0, round = 0, square = 0, quote = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') round++;
    else if (ch === ')') round--;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === ',' && round === 0 && square === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}
function scopeSelector(selector: string, root: string) {
  let value = selector.trim();
  value = value.replace(/^html\s+body\b/i, root).replace(/^:root\b/i, root)
    .replace(/^html\b/i, root).replace(/^body\b/i, root);
  if (value === root || value.startsWith(root + ':') || value.startsWith(root + '.')) return value;
  if (value.startsWith(root + ' ') || value.startsWith(root + '>')) return value;
  return root + ' ' + value;
}
function nextCssBlockOrStatement(source: string, start: number):
  { at: number; kind: 'block' | 'statement' } | null {
  let quote = '', round = 0, square = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 1;
    } else if (ch === '\\') i++;
    else if (ch === '(') round++;
    else if (ch === ')') round = Math.max(0, round - 1);
    else if (ch === '[') square++;
    else if (ch === ']') square = Math.max(0, square - 1);
    else if (!round && !square && ch === '{') return { at: i, kind: 'block' };
    else if (!round && !square && ch === ';') return { at: i, kind: 'statement' };
  }
  return null;
}
function matchingBrace(source: string, open: number) {
  let depth = 1, quote = '';
  for (let i = open + 1; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 1;
    } else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

export function manifestForRelease(input: {
  releaseId: string;
  siteId: string;
  sequence: number;
  sourceVersion: number;
  schemaVersion: number;
  parentReleaseId: string | null;
  createdAt: string;
  audit: ReleaseManifestV1['audit'];
  built: Pick<BuiltReleaseV1,
    'artifactHash' | 'artifactBytes' | 'files' | 'pages' | 'cms' | 'assets' | 'scripts'
    | 'redirects' | 'entities' | 'forms' | 'placeholders'>;
}): ReleaseManifestV1 {
  if (!Number.isInteger(input.sequence) || input.sequence < 1) throw new Error('release sequence must be positive');
  return {
    format: RELEASE_FORMAT,
    releaseId: input.releaseId,
    siteId: input.siteId,
    sequence: input.sequence,
    sourceVersion: input.sourceVersion,
    schemaVersion: input.schemaVersion,
    rendererVersion: `pagecraft-core-${input.schemaVersion}`,
    parentReleaseId: input.parentReleaseId,
    createdAt: new Date(input.createdAt).toISOString(),
    requirements: { plugin: '>=0.1.0', wordpress: '>=6.6', php: '>=8.1' },
    capabilities: ['compiled-routes', 'native-entities', 'atomic-activate', 'rollback'],
    artifactHash: input.built.artifactHash,
    artifactBytes: input.built.artifactBytes.byteLength,
    files: input.built.files,
    pages: input.built.pages,
    cms: input.built.cms,
    assets: input.built.assets,
    scripts: input.built.scripts,
    redirects: input.built.redirects,
    entities: input.built.entities,
    forms: input.built.forms,
    placeholders: input.built.placeholders,
    audit: input.audit
  };
}

export function deploymentForTarget(input: {
  release: ReleaseManifestV1;
  releaseManifest: string;
  connectionId: string;
  installationId: string;
  environment: 'staging' | 'production';
  profile: 'existing-theme' | 'pagecraft-theme';
  targetOrigin: string;
  targetPath: string;
  targetSequence: number;
  issuedAt: string;
}): DeploymentEnvelopeV1 {
  if (!Number.isInteger(input.targetSequence) || input.targetSequence < 1) throw new Error('target sequence must be positive');
  return {
    format: DEPLOYMENT_FORMAT,
    releaseId: input.release.releaseId,
    releaseManifestHash: sha256(fromBase64url(input.releaseManifest)),
    artifactHash: input.release.artifactHash,
    connectionId: input.connectionId,
    installationId: input.installationId,
    environment: input.environment,
    profile: input.profile,
    targetOrigin: canonicalOrigin(input.targetOrigin),
    targetPath: canonicalTargetPath(input.targetPath),
    targetSequence: input.targetSequence,
    issuedAt: new Date(input.issuedAt).toISOString(),
    requirements: input.release.requirements
  };
}

export function signReleaseManifest(manifest: ReleaseManifestV1, key: ReleaseSigningKey): SignedReleaseManifestV1 {
  const signed = signCanonical(manifest, RELEASE_CONTEXT, key);
  return { manifest: signed.encoded, signature: signed.signature, keyId: key.keyId };
}

export function signDeploymentEnvelope(envelope: DeploymentEnvelopeV1, key: ReleaseSigningKey): SignedDeploymentEnvelopeV1 {
  const signed = signCanonical(envelope, DEPLOYMENT_CONTEXT, key);
  return { envelope: signed.encoded, signature: signed.signature, keyId: key.keyId };
}

export function decodeReleaseManifest(encoded: string): ReleaseManifestV1 {
  return decodeCanonical(encoded, RELEASE_FORMAT) as unknown as ReleaseManifestV1;
}
export function decodeDeploymentEnvelope(encoded: string): DeploymentEnvelopeV1 {
  return decodeCanonical(encoded, DEPLOYMENT_FORMAT) as unknown as DeploymentEnvelopeV1;
}

export function verifySignedRelease(input: {
  signed: SignedReleaseManifestV1;
  publicKey: KeyLike | string | Uint8Array;
  artifactBytes?: Uint8Array;
}): ReleaseManifestV1 {
  verifyCanonical(input.signed.manifest, input.signed.signature, RELEASE_CONTEXT, input.publicKey);
  const manifest = decodeReleaseManifest(input.signed.manifest);
  if (input.artifactBytes
    && (input.artifactBytes.byteLength !== manifest.artifactBytes || sha256(input.artifactBytes) !== manifest.artifactHash)) {
    throw new Error('release artifact does not match its manifest');
  }
  return manifest;
}

export function verifySignedDeployment(input: {
  signed: SignedDeploymentEnvelopeV1;
  publicKey: KeyLike | string | Uint8Array;
  releaseManifest: string;
  expected?: Partial<Pick<DeploymentEnvelopeV1,
    'connectionId' | 'installationId' | 'environment' | 'profile' | 'targetOrigin' | 'targetPath' | 'releaseId'>>;
  afterSequence?: number;
}): DeploymentEnvelopeV1 {
  verifyCanonical(input.signed.envelope, input.signed.signature, DEPLOYMENT_CONTEXT, input.publicKey);
  const envelope = decodeDeploymentEnvelope(input.signed.envelope);
  if (envelope.releaseManifestHash !== sha256(fromBase64url(input.releaseManifest))) {
    throw new Error('deployment does not reference this release manifest');
  }
  if (input.expected) {
    for (const [field, expected] of Object.entries(input.expected)) {
      const normalized = field === 'targetOrigin' && expected ? canonicalOrigin(String(expected))
        : field === 'targetPath' && expected ? canonicalTargetPath(String(expected)) : expected;
      if (envelope[field as keyof DeploymentEnvelopeV1] !== normalized) {
        throw new Error(`deployment is bound to a different ${field}`);
      }
    }
  }
  if (input.afterSequence !== undefined && envelope.targetSequence <= input.afterSequence) {
    throw new Error('deployment sequence is a replay or rollback');
  }
  return envelope;
}

export function buildKeysetEnvelope(input: {
  rootKeyId: string;
  rootPrivateKey: KeyLike | string | Uint8Array;
  generatedAt: string;
  expiresAt: string;
  releaseKeys: Array<{ key: ReleaseSigningKey; notBefore: string; notAfter: string }>;
}): { envelope: KeysetEnvelopeV1; keyset: KeysetV1 } {
  const keyset: KeysetV1 = {
    format: KEYSET_FORMAT,
    generatedAt: new Date(input.generatedAt).toISOString(),
    expiresAt: new Date(input.expiresAt).toISOString(),
    keys: input.releaseKeys.map(item => ({
      id: item.key.keyId,
      algorithm: 'Ed25519' as const,
      publicKey: rawPublicKey(item.key.publicKey || createPublicKey(privateKey(item.key.privateKey))),
      notBefore: new Date(item.notBefore).toISOString(),
      notAfter: new Date(item.notAfter).toISOString()
    })).sort((a, b) => utf8ByteCompare(a.id, b.id))
  };
  const bytes = utf8(canonicalJson(keyset));
  const signature = edSign(null, contextInput(KEYSET_CONTEXT, bytes), privateKey(input.rootPrivateKey));
  return {
    keyset,
    envelope: { keyset: base64url(bytes), signature: signature.toString('base64url'), rootKeyId: input.rootKeyId }
  };
}

export function verifyKeysetEnvelope(input: {
  envelope: KeysetEnvelopeV1;
  rootPublicKey: KeyLike | string | Uint8Array;
  now?: string;
}): KeysetV1 {
  verifyCanonical(input.envelope.keyset, input.envelope.signature, KEYSET_CONTEXT, input.rootPublicKey);
  const keyset = decodeCanonical(input.envelope.keyset, KEYSET_FORMAT) as unknown as KeysetV1;
  const now = new Date(input.now || Date.now()).getTime();
  if (new Date(keyset.expiresAt).getTime() <= now) throw new Error('release keyset has expired');
  for (const key of keyset.keys) {
    if (fromBase64url(key.publicKey).byteLength !== 32) throw new Error('keyset contains a malformed Ed25519 key');
  }
  return keyset;
}

/** Raw 32-byte public key to the Node KeyObject used by verification. */
export function keyFromRawPublic(value: string) {
  const raw = Buffer.from(value, 'base64url');
  if (raw.byteLength !== 32) throw new Error('Ed25519 public key must be 32 bytes');
  return createPublicKey({ key: Buffer.concat([RAW_ED25519_PREFIX, raw]), type: 'spki', format: 'der' });
}

export function rawPublicKey(value: KeyLike | string | Uint8Array) {
  const der = publicKey(value).export({ type: 'spki', format: 'der' });
  if (der.byteLength !== RAW_ED25519_PREFIX.byteLength + 32
    || !der.subarray(0, RAW_ED25519_PREFIX.byteLength).equals(RAW_ED25519_PREFIX)) {
    throw new Error('public key is not Ed25519');
  }
  return der.subarray(RAW_ED25519_PREFIX.byteLength).toString('base64url');
}

export function parseReleaseArtifact(bytes: Uint8Array): ReleaseArtifactV1 {
  const artifact = decodeCanonical(base64url(bytes), ARTIFACT_FORMAT) as unknown as ReleaseArtifactV1;
  if ('document' in artifact) throw new Error('release artifact must not contain an editor document');
  return artifact;
}

function signCanonical(value: unknown, context: string, key: ReleaseSigningKey) {
  const bytes = utf8(canonicalJson(value));
  const signature = edSign(null, contextInput(context, bytes), privateKey(key.privateKey));
  return { encoded: base64url(bytes), signature: signature.toString('base64url') };
}
function verifyCanonical(encoded: string, signature: string, context: string, key: KeyLike | string | Uint8Array) {
  const bytes = fromBase64url(encoded);
  const sig = fromBase64url(signature);
  if (sig.byteLength !== 64 || !edVerify(null, contextInput(context, bytes), publicKey(key), sig)) {
    throw new Error('signature is invalid');
  }
  decodeCanonical(encoded);
}
function decodeCanonical(encoded: string, expectedFormat?: string): Record<string, unknown> {
  const bytes = fromBase64url(encoded);
  const parsed = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>;
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`unsupported ${expectedFormat} payload`);
  if (base64url(utf8(canonicalJson(parsed))) !== encoded) throw new Error('signed JSON is not canonical');
  return parsed;
}
function contextInput(context: string, bytes: Uint8Array) {
  return Buffer.concat([Buffer.from(context, 'utf8'), Buffer.from(bytes)]);
}
function privateKey(value: KeyLike | string | Uint8Array) {
  if (typeof value === 'string' || value instanceof Uint8Array) return createPrivateKey(value);
  return value;
}
function publicKey(value: KeyLike | string | Uint8Array) {
  if (typeof value === 'object' && !(value instanceof Uint8Array)
    && 'type' in value && value.type === 'public') return value;
  return createPublicKey(value as Parameters<typeof createPublicKey>[0]);
}

export function canonicalOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && !url.hostname.endsWith('.localhost')) {
    throw new Error('target origin must use HTTPS');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('target origin must not contain credentials, path, query, or fragment');
  }
  return url.origin;
}
export function canonicalTargetPath(value: string): string {
  const raw = String(value || '/').trim();
  if (!raw.startsWith('/') || raw.includes('..') || /[?#\\]/.test(raw)) throw new Error('invalid target path');
  const stripped = raw.replace(/^\/+|\/+$/g, '');
  return stripped ? '/' + stripped : '/';
}
