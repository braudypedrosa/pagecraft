import * as Core from '../../../app/src/core/index.ts';
import type { Doc, NavItem, UnknownDocumentInput } from '../../../app/src/core/types.ts';
import { adoptHostDocument } from '../../../app/src/host/schema.ts';
import { sha256 as sha256Fallback } from '../../../app/src/core/libraries.ts';
import {
  COMPILER_DESCRIPTOR, COMPILER_RESULT_FORMAT, type CompilerDescriptor
} from './contract.ts';

export interface CompilerAsset {
  /** Durable WordPress or CDN URL. Object/data URLs are deliberately rejected. */
  url: string;
  name?: string;
}

export interface CompilerMenu {
  id?: string;
  /** Present on the native `/menus` response; record-shaped callers may use their key instead. */
  location?: string;
  items: readonly CompilerMenuItem[];
}

/** Accept both document-native items and the WordPress `/menus` REST payload directly. */
export interface CompilerMenuItem extends NavItem {
  url?: string;
  classes?: readonly string[];
}

export type CompilerDesign = Pick<Doc['meta'], 'maxWidth' | 'font' | 'headFont' | 'size' | 'css' | 'tokens'>;

export interface CompileOptions {
  pageId: string;
  assets: Readonly<Record<string, CompilerAsset>>;
  /** Signed render token or stored target-neutral reference to its current WordPress URL. */
  wordpressContent?: Readonly<Record<string, string>>;
  /** Current WordPress menu snapshot by Pagecraft Theme location. */
  wordpressMenus?: Readonly<Record<string, CompilerMenu>> | readonly CompilerMenu[];
  /** WordPress-owned site design overrides the copy retained in an individual page document. */
  design?: Partial<CompilerDesign>;
}

export interface CompilerResult {
  format: typeof COMPILER_RESULT_FORMAT;
  compiler: CompilerDescriptor;
  pageId: string;
  html: string;
  globalCss: string;
  pageCss: string;
  fontCss: string;
  contentHash: string;
}

export interface CompilerDependencies {
  fetch: typeof fetch;
  /** Web Crypto is unavailable in non-secure local WordPress workers. */
  crypto?: Crypto;
}

export class PagecraftCompilerError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PagecraftCompilerError';
  }
}

const WP_CONTENT_TOKEN = /%%PAGECRAFT_WP_CONTENT:(page|post):([A-Za-z0-9_-]+)%%/g;
const absoluteHttpUrl = (value: unknown, label: string) => {
  const raw = String(value == null ? '' : value).trim();
  if (!raw || /[\u0000-\u001f\u007f"'<>\\]/.test(raw)) {
    throw new PagecraftCompilerError('invalid_url', `${label} has an invalid URL.`);
  }
  let parsed: URL;
  try { parsed = new URL(raw); }
  catch { throw new PagecraftCompilerError('invalid_url', `${label} has an invalid URL.`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new PagecraftCompilerError('invalid_url', `${label} must use a durable HTTP or HTTPS URL.`);
  }
  return parsed.href;
};

function applyDesign(document: Doc, design: CompileOptions['design']) {
  if (!design) return;
  for (const key of ['maxWidth', 'font', 'headFont', 'size', 'css', 'tokens'] as const) {
    if (Object.prototype.hasOwnProperty.call(design, key)) {
      (document.meta as any)[key] = Core.clone(design[key]);
    }
  }
}

const MENU_LOCATIONS = new Set(['primary', 'footer', 'utility']);

function walkRenderedNodes(
  document: Doc,
  value: unknown,
  components: Set<string>,
  visit: (node: Record<string, any>) => void,
) {
  if (!Array.isArray(value)) return;
  value.forEach(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const node = item as Record<string, any>;
    const use = String(node.use || '');
    const definition = use
      ? document.meta.components?.find(component => component.id === use)
      : undefined;
    if (definition) {
      if (!components.has(use)) {
        components.add(use);
        walkRenderedNodes(document, [definition.node], components, visit);
      }
    } else {
      visit(node);
    }
    /* Instance children are stored outside the definition because they fill its slots. */
    walkRenderedNodes(document, node.children, components, visit);
  });
}

/** Match NativeMenu::ensureDocumentBindings for raw stored documents. */
function ensureMenuBindings(document: Doc) {
  let headerCount = 0;
  const components = new Set<string>();
  walkRenderedNodes(document, document.header, components, node => {
    if (node.type !== 'nav' || !node.props || typeof node.props !== 'object') return;
    const declared = String(node.props.menuLocation || '');
    if (!MENU_LOCATIONS.has(declared)) node.props.menuLocation = headerCount === 0 ? 'primary' : 'utility';
    headerCount++;
  });
  let footerCount = 0;
  walkRenderedNodes(document, document.footer, components, node => {
    if (node.type !== 'nav' || !node.props || typeof node.props !== 'object') return;
    const declared = String(node.props.menuLocation || '');
    if (!MENU_LOCATIONS.has(declared) && footerCount === 0) node.props.menuLocation = 'footer';
    footerCount++;
  });
}

function menuItems(items: readonly CompilerMenuItem[]): NavItem[] {
  return items.map(item => {
    let href = String(item.href ?? item.url ?? '');
    const anchor = String(item.anchor || '');
    if (item.href === undefined && anchor && !href.includes('#')) href += `#${anchor}`;
    return {
      id: String(item.id || ''),
      label: String(item.label || ''),
      href,
      parentId: String(item.parentId || ''),
      cls: item.cls !== undefined ? String(item.cls) : (item.classes || []).map(String).join(' '),
      target: item.target === '_blank' ? '_blank' : '',
      rel: String(item.rel || ''),
      objectType: String(item.objectType || 'custom'),
      objectId: String(item.objectId || ''),
      anchor,
    };
  });
}

function menusByLocation(menus: CompileOptions['wordpressMenus']) {
  const indexed: Record<string, CompilerMenu> = {};
  if (Array.isArray(menus)) {
    menus.forEach(menu => {
      const location = String(menu?.location || '');
      if (MENU_LOCATIONS.has(location)) indexed[location] = menu;
    });
  } else if (menus) {
    Object.entries(menus).forEach(([location, menu]) => {
      if (MENU_LOCATIONS.has(location) && menu) indexed[location] = menu;
    });
  }
  return indexed;
}

function hydrateMenus(value: unknown, menus: Readonly<Record<string, CompilerMenu>>) {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(child => hydrateMenus(child, menus));
    return;
  }
  const row = value as Record<string, any>;
  if (row.type === 'nav' && row.props && typeof row.props === 'object') {
    const location = String(row.props.menuLocation || '');
    const menu = menus[location];
    if (menu) {
      row.props.items = menuItems(menu.items);
      if (menu.id) row.props.nativeMenuId = String(menu.id);
    }
  }
  Object.values(row).forEach(child => hydrateMenus(child, menus));
}

function resolveAssets(source: string, assets: CompileOptions['assets']) {
  const missing = new Set<string>();
  const urls = new Map<string, string>();
  const output = String(source).replace(Core.A_RE, (_match, id: string) => {
    const asset = assets[id];
    if (!asset) { missing.add(id); return _match; }
    let url = urls.get(id);
    if (!url) {
      url = absoluteHttpUrl(asset.url, `Image “${asset.name || id}”`);
      urls.set(id, url);
    }
    return url;
  });
  if (missing.size) {
    throw new PagecraftCompilerError(
      'missing_assets',
      `WordPress could not resolve ${[...missing].map(id => `“${id}”`).join(', ')}. Reload media and try again.`
    );
  }
  return output;
}

function resolveWordPressContent(source: string, content: CompileOptions['wordpressContent']) {
  const missing = new Set<string>();
  const output = String(source).replace(WP_CONTENT_TOKEN, (token, objectType: string, encodedPath: string) => {
    const reference = `pagecraft:wordpress-content:${objectType}:${encodedPath}`;
    const value = content?.[token] || content?.[reference];
    if (!value) { missing.add(reference); return token; }
    /* Core escapes a resolved link while rendering. This replacement happens one boundary
       later, so retain the same attribute-safe ampersand form. */
    return absoluteHttpUrl(value, `WordPress ${objectType} link`).replace(/&/g, '&amp;');
  });
  if (missing.size) {
    throw new PagecraftCompilerError(
      'missing_wordpress_content',
      `WordPress could not resolve ${[...missing].join(', ')}. Refresh the content index and try again.`
    );
  }
  return output;
}

async function wordpressFontCss(fetcher: typeof fetch) {
  const href = Core.gfontsHref();
  if (!href) return '';
  let response: Response;
  try { response = await fetcher(href); }
  catch { throw new PagecraftCompilerError('font_fetch_failed', 'The selected fonts could not be loaded. Check the connection and retry.'); }
  if (!response.ok) {
    throw new PagecraftCompilerError('font_fetch_failed', 'The selected fonts could not be loaded. Check the connection and retry.');
  }
  const faces = Core.parseFontCss(await response.text());
  if (!faces.length) {
    throw new PagecraftCompilerError('font_parse_failed', 'The selected fonts returned no usable font files. Retry or choose another font.');
  }
  return Core.fontFaceCss(faces, face => face.url) + '\n';
}

export async function compilerSha256(value: string, cryptoApi?: Crypto) {
  /* Web Crypto is the fast path on secure origins. Local WordPress development commonly
     runs over plain HTTP, where a Worker can expose `crypto` without `subtle`; use the
     core's UTF-8 SHA-256 there so maintenance compilation remains deterministic. */
  try {
    if (cryptoApi?.subtle && typeof cryptoApi.subtle.digest === 'function') {
      const bytes = new TextEncoder().encode(value);
      const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* An unavailable or disabled implementation is equivalent to no Web Crypto. */
  }
  try {
    return sha256Fallback(value);
  } catch {
    throw new PagecraftCompilerError(
      'hash_failed',
      'Pagecraft could not verify the generated output in this browser. Reload the editor and retry.'
    );
  }
}

async function compileIsolated(
  input: UnknownDocumentInput,
  options: CompileOptions,
  dependencies: CompilerDependencies
): Promise<CompilerResult> {
  if (!options || !String(options.pageId || '').trim()) {
    throw new PagecraftCompilerError('missing_page', 'Choose the exact Pagecraft page to compile.');
  }
  const previous = Core.clone(Core.doc());
  try {
    const document = adoptHostDocument(input);
    applyDesign(document, options.design);
    ensureMenuBindings(document);
    hydrateMenus(document, menusByLocation(options.wordpressMenus));
    Core.restore(document);
    const page = Core.state.pages.find(candidate => candidate.id === options.pageId);
    if (!page) {
      throw new PagecraftCompilerError('missing_page', `Page “${options.pageId}” is not present in this document.`);
    }

    const fontCss = await wordpressFontCss(dependencies.fetch);
    const styles = Core.wordpressStyles(page);
    const resolve = (value: string) => resolveWordPressContent(resolveAssets(value, options.assets || {}), options.wordpressContent);
    const html = resolve(Core.buildPage(page));
    const globalCss = fontCss + resolve(styles.global);
    const pageCss = resolve(styles.page);
    const contentHash = await compilerSha256(JSON.stringify({ html, globalCss, pageCss }), dependencies.crypto);
    return {
      format: COMPILER_RESULT_FORMAT,
      compiler: COMPILER_DESCRIPTOR,
      pageId: page.id,
      html, globalCss, pageCss, fontCss, contentHash
    };
  } finally {
    Core.restore(previous);
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialize access to Core's module state even when this source entry is called directly. */
export function compileDocument(
  input: UnknownDocumentInput,
  options: CompileOptions,
  dependencies: CompilerDependencies = { fetch: globalThis.fetch.bind(globalThis), crypto: globalThis.crypto }
) {
  const job = queue.then(() => compileIsolated(input, options, dependencies));
  queue = job.then(() => undefined, () => undefined);
  return job;
}
