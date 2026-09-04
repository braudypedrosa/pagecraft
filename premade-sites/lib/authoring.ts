import * as Core from '../../app/src/core/index.ts';
import type { Bp, Doc, Node } from '../../app/src/core/types.ts';

export const TEMPLATE_SOURCE_FORMAT = 'pagecraft.site-template-source.v1' as const;
export type CustomCssPolicy = 'native-only' | 'reviewed-exception';

export interface TemplateAssetSource {
  /** Stable id used by the document as `asset:<id>`. */
  id: string;
  /** File path relative to the release directory. */
  file: string;
}

export interface TemplateSourceConfig {
  format: typeof TEMPLATE_SOURCE_FORMAT;
  id: string;
  version: string;
  name: string;
  sampleName: string;
  description: string;
  categories: string[];
  source: string;
  sourceExport: string;
  previewPage: string;
  assets: TemplateAssetSource[];
  customCssPolicy: CustomCssPolicy;
  /** Required when a release retains CSS that Pagecraft cannot model natively yet. */
  customCssReason?: string;
}

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const SOURCE_FILE = /^[a-z0-9][a-z0-9._/-]*\.ts$/;
const ASSET_FILE = /^(?!\/)[a-zA-Z0-9._/-]+$/;

export function validateTemplateSourceConfig(value: unknown): TemplateSourceConfig {
  const item = value as Partial<TemplateSourceConfig>;
  const fail = (detail: string): never => { throw new Error(`template source config: ${detail}`); };
  if (item.format !== TEMPLATE_SOURCE_FORMAT) fail(`format must be ${TEMPLATE_SOURCE_FORMAT}`);
  if (!SEGMENT.test(String(item.id || ''))) fail('id must be a lowercase hyphenated segment');
  if (!VERSION.test(String(item.version || ''))) fail('version must use semver x.y.z');
  if (!String(item.name || '').trim()) fail('name is required');
  if (!String(item.sampleName || '').trim()) fail('sampleName is required');
  if (!String(item.description || '').trim()) fail('description is required');
  if (!Array.isArray(item.categories) || !item.categories.length
    || !item.categories.every(category => typeof category === 'string' && category.trim())) {
    fail('categories must contain at least one label');
  }
  if (!SOURCE_FILE.test(String(item.source || '')) || String(item.source).includes('..')) {
    fail('source must be a relative TypeScript file inside the release');
  }
  if (!/^[A-Za-z_$][\w$]*$/.test(String(item.sourceExport || ''))) fail('sourceExport is invalid');
  if (!/^[a-z0-9][a-z0-9/-]*\.html$/.test(String(item.previewPage || ''))) fail('previewPage is invalid');
  if (!Array.isArray(item.assets)) fail('assets must be an array');
  const ids = new Set<string>();
  for (const asset of item.assets as TemplateAssetSource[]) {
    if (!SEGMENT.test(String(asset?.id || ''))) fail(`asset id ${String(asset?.id || '')} is invalid`);
    if (!ASSET_FILE.test(String(asset?.file || ''))) fail(`asset file for ${asset.id} is unsafe`);
    if (ids.has(asset.id)) fail(`asset id ${asset.id} is duplicated`);
    ids.add(asset.id);
  }
  if (item.customCssPolicy !== 'native-only' && item.customCssPolicy !== 'reviewed-exception') {
    fail('customCssPolicy must be native-only or reviewed-exception');
  }
  if (item.customCssPolicy === 'reviewed-exception' && !String(item.customCssReason || '').trim()) {
    fail('reviewed-exception requires customCssReason');
  }
  return item as TemplateSourceConfig;
}

export function templateNodes(document: Doc): Node[] {
  const out: Node[] = [];
  const visit = (nodes: Node[]) => {
    for (const node of nodes) {
      out.push(node);
      visit(node.children || []);
    }
  };
  visit(document.header || []);
  visit(document.footer || []);
  for (const page of document.pages || []) visit(page.tree || []);
  return out;
}

const assetReferences = (value: unknown, refs = new Set<string>()): Set<string> => {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/asset:([a-z0-9]+(?:-[a-z0-9]+)*)/g)) refs.add(match[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) assetReferences(item, refs);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) assetReferences(item, refs);
  }
  return refs;
};

/**
 * The authoring gate for curated sites. Visual values belong in node/class Pagecraft
 * data so the inspector can read them. Custom CSS is an explicit, reviewed exception,
 * never an invisible default chosen by the template generator.
 */
export function validateTemplateDocument(document: Doc, config: TemplateSourceConfig): string[] {
  const findings: string[] = [];
  if (!document || !Array.isArray(document.pages) || !document.pages.length) findings.push('document:missing-pages');
  const slugs = new Set<string>();
  for (const page of document.pages || []) {
    if (!SEGMENT.test(String(page.slug || ''))) findings.push(`${page.id}:invalid-page-slug`);
    if (slugs.has(page.slug)) findings.push(`${page.id}:duplicate-page-slug`);
    slugs.add(page.slug);
  }
  if (!slugs.has('index')) findings.push('document:missing-index-page');

  const ids = new Set<string>();
  const breakpoints: Bp[] = ['d', 't', 'm'];
  for (const node of templateNodes(document)) {
    if (!node.id || ids.has(node.id)) findings.push(`${node.id || 'node'}:duplicate-or-missing-id`);
    ids.add(node.id);
    for (const breakpoint of breakpoints) {
      if (!node.css || !node.css[breakpoint] || Array.isArray(node.css[breakpoint])) {
        findings.push(`${node.id}:${breakpoint}:missing-css-block`);
      }
    }
    if (String(node.adv?.css || '').trim() && config.customCssPolicy === 'native-only') {
      findings.push(`${node.id}:advanced-css-is-not-builder-native`);
    }
  }
  if (String(document.meta?.css || '').trim() && config.customCssPolicy === 'native-only') {
    findings.push('document:custom-css-is-not-builder-native');
  }

  const configured = new Set(config.assets.map(asset => asset.id));
  for (const reference of assetReferences(document)) {
    if (!configured.has(reference)) findings.push(`asset:${reference}:not-configured`);
  }
  for (const asset of configured) {
    if (!assetReferences(document).has(asset)) findings.push(`asset:${asset}:unused`);
  }
  return findings;
}

export function assertTemplateDocument(document: Doc, config: TemplateSourceConfig) {
  const findings = validateTemplateDocument(document, config);
  if (findings.length) throw new Error(`template authoring contract failed: ${findings.join(', ')}`);
}

/** A native empty document with Pagecraft's reusable tokens and text styles ready. */
export function buildTemplateStarter(name: string): Doc {
  Core.seed();
  Core.blankProject(name);
  return structuredClone(Core.doc());
}
