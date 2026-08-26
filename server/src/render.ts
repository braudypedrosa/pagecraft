/* A stored document, turned into the files a browser asks for.

   This is the whole reason the server exists. The export in the builder writes a zip; here
   the same functions write into a map, and the map is what gets served. Same core, same
   `exportTargets`, same `buildPage` — so a page served from the store and a page exported
   to disk are the same bytes, and `render.test.ts` asserts exactly that rather than trusting
   it.

   ## Why this function is synchronous, and must stay that way

   The core keeps its document in a module-level `state`. `restore()` loads one in, and
   everything after it reads that singleton. A server serves many documents, so two renders
   running at once would read each other's pages.

   Node runs one thing at a time, so this is safe as long as the whole render is one
   synchronous run — no `await` anywhere between `restore()` and the last `buildPage()`. That
   is not a style preference; adding an `await` inside here is how two sites start swapping
   pages under load, and nothing would fail loudly when it happened.

   `renderSite` is therefore sync, takes a plain document, and returns before anything else
   can run. Everything asynchronous — reading the document, writing the files — happens
   outside it. `render.test.ts` has a case that renders two documents interleaved to hold the
   line. */
import * as Core from '../../app/src/core/index.ts';
import type { Doc, UnknownDocumentInput } from '../../app/src/core/types.ts';
import type { Asset } from './assets.ts';

/* Core is a singleton because the portable builder and renderer share one implementation.
   Capture its truly pristine metadata once, before any request can restore another project.
   `seed()` intentionally builds on the current design library, which is right for the editor's
   Reset/Blank flow but wrong for a server creating an unrelated site after a render. */
const PRISTINE_META = structuredClone(Core.state.meta);

/**
 * A stored document, brought up to the schema this build speaks.
 *
 * The editor has always migrated on load. The server did not, and served whatever JSON was in
 * the column — which was invisible for as long as the schema never changed. The first change
 * was v7 -> v8, folding a button's `--hover-bg` into its hover state block, and without this
 * every stored button quietly lost its hover: the custom property is still emitted, and now
 * nothing reads it.
 *
 * It mutates and returns the same object, which is what `Core.migrate` does, and it is
 * idempotent — a document already at the current schema comes back untouched. So calling it on
 * every render costs a tree walk on a document measured in kilobytes, and that is the trade:
 * correct on a cold row, rather than fast and wrong.
 *
 * Null means a document this build cannot speak — written by a newer editor, and `Core.migrate`
 * refuses rather than corrupt it. Callers decide what that is worth: the save path refuses with
 * an error somebody can read, and the render path serves the document as it stands, because it
 * is already in the table and a site going dark is worse than a site rendering one property
 * this build does not know about.
 *
 * One function rather than an `adopt` and a `canAdopt`, because asking the question runs the
 * migration — a predicate that quietly rewrote its argument would be a trap.
 */
export const adopt = (doc: UnknownDocumentInput): Doc | null => Core.migrate(doc) as Doc | null;

/**
 * A new, empty project — the document a site starts from.
 *
 * `seed()` then `blankProject()` is what the builder's own "Start an empty site" does, and the
 * order matters: seed installs the colour tokens and text styles, and `blankProject` clears the
 * *content* while keeping those. So a new site arrives with a design system and no pages to
 * argue with, rather than with somebody else's demo to delete.
 *
 * Synchronous, and for the same reason `renderSite` is: the core keeps its document in a
 * module-level singleton, so anything that reads `state` has to finish before the next thing
 * touches it. No `await` between the two calls and the clone.
 */
export function blankDoc(name: string): Doc {
  Core.state.meta = structuredClone(PRISTINE_META);
  Core.state.header = [];
  Core.state.footer = [];
  Core.state.pages = [];
  Core.state.cur = 0;
  Core.seed();
  Core.blankProject(name);
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta,
    header: Core.state.header,
    footer: Core.state.footer,
    pages: Core.state.pages
  }) as Doc;
}

export interface RenderedSite {
  /** path relative to the site root, e.g. `index.html` or `work/acme.html` */
  files: Map<string, string>;
  /** what the review found, so a save can report it without a second pass */
  findings: ReturnType<typeof Core.lint>;
}

/**
 * Render every file a document produces. Synchronous on purpose — see the note above.
 *
 * `assets` is the site's images, by id. Every `asset:<id>` in the output becomes the path
 * `assetFile` gives it — the path the export writes and the path the site route serves, one
 * naming rule in the core so the three cannot disagree. An id with nothing behind it becomes
 * the placeholder rather than a broken `src`.
 *
 * `variants` is still off. A `srcset` needs downscaled copies, and making those needs an
 * image library the server does not have; one `src` that works beats five that do not.
 */
export function renderSite(doc: Doc, assets: Asset[] = []): RenderedSite {
  Core.restore(structuredClone(doc));

  const byId = new Map(assets.map(a => [a.id, a]));
  const get = (id: string) => byId.get(id) || null;

  const files = new Map<string, string>();
  for (const t of Core.exportTargets()) {
    /* `rel` is how deep the file sits, so a detail page one directory down asks for
       `../assets/logo.png` rather than a path that only resolves at the root. */
    files.set(t.path, Core.assetPaths(Core.buildPage(t.pg, t), get, t.rel || ''));
  }

  /* Both are empty without a base URL, and an empty sitemap is worse than none: it tells a
     crawler the site has no pages. */
  const sitemap = Core.sitemapXml();
  if (sitemap) files.set('sitemap.xml', hostedSitemap(sitemap, files, Core.state.meta.baseUrl || ''));
  files.set('robots.txt', Core.robotsTxt());

  return { files, findings: Core.lint() };
}

/** What a request path maps to. Directories get their index, and a bare path gets `.html`. */
export function resolvePath(urlPath: string): string {
  let p = urlPath.replace(/^\/+/, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  /* `/pricing` and `/pricing.html` are the same page. A host serving these files would do
     the same, so the editor's preview and the live site agree on what a link means. */
  if (!/\.[a-z0-9]+$/i.test(p)) p += '.html';
  return p;
}

/** The browser-facing path for one of the static files the core renders.
 *
 * Files keep their `.html` names because the same map is also the portable download. The
 * hosted site is different: its router can resolve an extensionless request, so exposing the
 * filename in navigation only leaks an implementation detail into the visitor's address bar.
 */
export function publicPath(filePath: string, prefix = ''): string {
  const root = '/' + prefix.replace(/^\/+|\/+$/g, '');
  let path = filePath.replace(/^\/+/, '');
  let directory = false;
  if (path === 'index.html') { path = ''; directory = true; }
  else if (path.endsWith('/index.html')) { path = path.slice(0, -'/index.html'.length); directory = true; }
  else if (/\.html$/i.test(path)) path = path.slice(0, -'.html'.length);
  const out = (root === '/' ? '' : root) + (path ? '/' + path : '') || '/';
  return directory && out !== '/' ? out + '/' : out;
}

const htmlFiles = (files: Map<string, string>) => [...files.keys()]
  .filter(file => /\.html$/i.test(file))
  .sort((a, b) => b.length - a.length);

/** Clean one generated absolute page URL without touching unrelated authored URLs.
 *
 * A filename suffix is not ownership: `https://elsewhere.test/pricing.html` may match one of
 * our generated files and still be an intentionally authored external URL. Require an exact
 * origin + configured site-base + file-path match before removing the extension. */
export function cleanPublishedUrl(value: string, files: Map<string, string>, siteBase: string): string {
  let url: URL, base: URL;
  try { url = new URL(value); base = new URL(siteBase); } catch { return value; }
  if (!/^https?:$/i.test(url.protocol) || !/^https?:$/i.test(base.protocol)) return value;
  if (url.origin !== base.origin) return value;

  base.search = '';
  base.hash = '';
  base.pathname = base.pathname.replace(/\/*$/, '/') || '/';
  const file = htmlFiles(files).find(candidate => {
    const expected = new URL(candidate.replace(/^\/+/, ''), base);
    return url.pathname === expected.pathname;
  });
  if (!file) return value;

  if (/\/index\.html$/i.test(url.pathname)) url.pathname = url.pathname.slice(0, -'index.html'.length);
  else url.pathname = url.pathname.slice(0, -'.html'.length);
  return url.href;
}

/** The hosted sitemap follows the same clean URLs visitors see. The core sitemap is left
 * untouched, because a downloaded static export really does contain `.html` files. */
export function hostedSitemap(xml: string, files: Map<string, string>, siteBase = ''): string {
  return xml.replace(/<loc>([^<]+)<\/loc>/gi,
    (_whole, value: string) => `<loc>${cleanPublishedUrl(value, files, siteBase)}</loc>`);
}

/** Rewrite links in hosted HTML to the router's clean paths.
 *
 * Only links that resolve to an HTML file actually present in this rendered site are touched.
 * That keeps external URLs, anchors, downloads and author-entered paths intact. Resolution is
 * relative to the rendered file, which also covers collection detail pages one folder deep.
 */
export function hostedHtml(
  html: string,
  currentFile: string,
  files: Map<string, string>,
  prefix = ''
): string {
  const base = new URL(currentFile.replace(/^\/+/, ''), 'https://pagecraft.invalid/');
  let siteBase = '';
  /* The core's canonical names the current generated file, which lets the hosted renderer
     recover the configured site prefix without trusting an unrelated absolute URL elsewhere
     in the document. JSON-LD's WebSite node provides the same base when present. */
  const baseFromCurrentPage = (value: string) => {
    let url: URL;
    try { url = new URL(value); } catch { return ''; }
    if (!/^https?:$/i.test(url.protocol)) return '';
    const file = currentFile.replace(/^\/+/, '');
    const suffix = '/' + file;
    if (!(url.pathname === suffix || url.pathname.endsWith(suffix))) return '';
    url.pathname = url.pathname.slice(0, -file.length) || '/';
    url.search = '';
    url.hash = '';
    return url.href;
  };
  const publicAsset = (value: string) => {
    const raw = value.trim();
    if (!raw || raw.startsWith('#') || /^([a-z][\w+.-]*:|\/\/)/i.test(raw)) return value;
    let url: URL;
    try { url = new URL(raw, base); } catch { return value; }
    const file = url.pathname.replace(/^\/+/, '');
    if (!file.startsWith('assets/')) return value;
    const root = prefix.replace(/^\/+|\/+$/g, '');
    return '/' + (root ? root + '/' : '') + file + url.search + url.hash;
  };
  const cleanHref = (href: string) => {
    const value = href.trim();
    const asset = publicAsset(value);
    if (asset !== value) return asset;
    if (!value || value.startsWith('#') || /^([a-z][\w+.-]*:|\/\/)/i.test(value)) return href;
    let url: URL;
    try { url = new URL(value, base); } catch { return href; }
    const file = url.pathname.replace(/^\/+/, '');
    if (!/\.html$/i.test(file) || !files.has(file)) return href;
    return publicPath(file, prefix) + url.search + url.hash;
  };

  const attr = (tag: string, name: string, change: (value: string) => string) => {
    const re = new RegExp(`(\\s${name}\\s*=\\s*)(['"])([\\s\\S]*?)\\2`, 'gi');
    return tag.replace(re, (_whole, lead: string, quote: string, value: string) =>
      `${lead}${quote}${change(value)}${quote}`);
  };
  const attrValue = (tag: string, name: string) => {
    const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(['"])([\\s\\S]*?)\\1`, 'i'));
    return match ? match[2] : '';
  };

  /* CSS is raw text too. Scan it rather than applying a page-wide `url()` regex: JavaScript,
     comments and quoted CSS content may all legitimately contain those characters. */
  const rewriteCss = (css: string) => {
    let out = '', i = 0;
    while (i < css.length) {
      if (css.startsWith('/*', i)) {
        const end = css.indexOf('*/', i + 2);
        const stop = end < 0 ? css.length : end + 2;
        out += css.slice(i, stop); i = stop; continue;
      }
      if (css[i] === '"' || css[i] === "'") {
        const quote = css[i]; let end = i + 1;
        while (end < css.length) {
          if (css[end] === '\\') { end += 2; continue; }
          if (css[end++] === quote) break;
        }
        out += css.slice(i, end); i = end; continue;
      }
      const before = i ? css[i - 1] : '';
      if (!/[\w-]/.test(before) && css.slice(i, i + 3).toLowerCase() === 'url') {
        let paren = i + 3;
        while (/\s/.test(css[paren] || '')) paren++;
        if (css[paren] === '(') {
          let start = paren + 1;
          while (/\s/.test(css[start] || '')) start++;
          const quote = css[start] === '"' || css[start] === "'" ? css[start++] : '';
          let end = start;
          if (quote) {
            while (end < css.length) {
              if (css[end] === '\\') { end += 2; continue; }
              if (css[end] === quote) break;
              end++;
            }
          } else while (end < css.length && css[end] !== ')') end++;
          let close = quote ? end + 1 : end;
          while (/\s/.test(css[close] || '')) close++;
          if ((!quote || css[end] === quote) && css[close] === ')') {
            out += css.slice(i, start) + publicAsset(css.slice(start, end)) + css.slice(end, close + 1);
            i = close + 1; continue;
          }
        }
      }
      out += css[i++];
    }
    return out;
  };

  const rewriteTag = (tag: string) => {
    if (/^<\s*[!/?]/.test(tag)) return tag;
    let out = attr(tag, 'href', cleanHref);
    out = attr(out, 'src', publicAsset);
    out = attr(out, 'poster', publicAsset);
    out = attr(out, 'srcset', value => value.split(',').map(part => {
      const match = part.match(/^(\s*)(\S+)([\s\S]*)$/);
      return match ? match[1] + publicAsset(match[2]) + match[3] : part;
    }).join(','));
    out = attr(out, 'style', rewriteCss);

    /* Canonical and Open Graph URLs are absolute, so ordinary navigation rewriting quite
       rightly leaves them alone. They still need the hosted route rather than the export file. */
    if (/^<\s*link\b/i.test(out) && /\bcanonical\b/i.test(attrValue(out, 'rel'))) {
      const authored = attrValue(out, 'href');
      if (!siteBase) siteBase = baseFromCurrentPage(authored);
      out = attr(out, 'href', value => cleanPublishedUrl(value, files, siteBase));
    }
    if (/^<\s*meta\b/i.test(out)) {
      const property = attrValue(out, 'property').toLowerCase();
      if (property === 'og:url') {
        const authored = attrValue(out, 'content');
        if (!siteBase) siteBase = baseFromCurrentPage(authored);
        out = attr(out, 'content', value => cleanPublishedUrl(value, files, siteBase));
      }
      else if (property === 'og:image') out = attr(out, 'content', publicAsset);
    }
    return out;
  };

  /* Keep the JSON island valid while cleaning every generated page reference in its graph. */
  const rewriteJsonLd = (body: string) => {
    try {
      const graph = JSON.parse(body);
      const siteNode = Array.isArray(graph && graph['@graph'])
        ? graph['@graph'].find((node: unknown) => node && typeof node === 'object' && (node as Record<string, unknown>)['@type'] === 'WebSite')
        : null;
      if (!siteBase) {
        const authoredBase = String(siteNode && siteNode.url || '');
        try {
          const parsed = new URL(authoredBase);
          if (/^https?:$/i.test(parsed.protocol)) siteBase = authoredBase;
        } catch { /* leave generated URLs explicit when no configured base is available */ }
      }
      const walk = (value: unknown): unknown => Array.isArray(value) ? value.map(walk)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child)]))
          : typeof value === 'string' ? (() => {
            const asset = publicAsset(value);
            if (asset !== value) return asset;
            return cleanPublishedUrl(value, files, siteBase);
          })() : value;
      const json = JSON.stringify(walk(graph), null, 2).replace(/</g, '\\u003c');
      return `\n${json}\n`;
    } catch { return body; }
  };

  const tagEnd = (from: number) => {
    let quote = '';
    for (let i = from; i < html.length; i++) {
      const char = html[i];
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '>') return i;
    }
    return -1;
  };

  /* Walk HTML regions. Text and comments pass byte-for-byte; attributes are rewritten only
     on opening tags; executable/raw-text bodies are never interpreted as markup. */
  const lower = html.toLowerCase();
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext']);
  const rawClose = (name: string, from: number) => {
    let found = from;
    while ((found = lower.indexOf(`</${name}`, found)) >= 0) {
      const after = lower[found + name.length + 2] || '';
      if (!after || /[\s/>]/.test(after)) return found;
      found += name.length + 2;
    }
    return -1;
  };
  let out = '', at = 0;
  while (at < html.length) {
    const openAt = html.indexOf('<', at);
    if (openAt < 0) { out += html.slice(at); break; }
    out += html.slice(at, openAt);
    if (html.startsWith('<!--', openAt)) {
      const end = html.indexOf('-->', openAt + 4);
      const stop = end < 0 ? html.length : end + 3;
      out += html.slice(openAt, stop); at = stop; continue;
    }
    const openEnd = tagEnd(openAt + 1);
    if (openEnd < 0) { out += html.slice(openAt); break; }
    const open = html.slice(openAt, openEnd + 1);
    const named = open.match(/^<\s*([a-z][\w:-]*)\b/i);
    const name = named ? named[1].toLowerCase() : '';
    if (!name) { out += open; at = openEnd + 1; continue; }
    if (!raw.has(name) || /\/\s*>$/.test(open)) {
      out += rewriteTag(open); at = openEnd + 1; continue;
    }
    const closeAt = rawClose(name, openEnd + 1);
    if (closeAt < 0) {
      out += rewriteTag(open) + html.slice(openEnd + 1); break;
    }
    const closeEnd = tagEnd(closeAt + 2 + name.length);
    if (closeEnd < 0) {
      out += rewriteTag(open) + html.slice(openEnd + 1); break;
    }
    const body = html.slice(openEnd + 1, closeAt);
    out += rewriteTag(open);
    if (name === 'style') out += rewriteCss(body);
    else if (name === 'script' && /\bapplication\/ld\+json\b/i.test(attrValue(open, 'type'))) out += rewriteJsonLd(body);
    else out += body;
    out += html.slice(closeAt, closeEnd + 1);
    at = closeEnd + 1;
  }
  return out;
}
