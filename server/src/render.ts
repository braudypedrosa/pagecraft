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
import type { Doc } from '../../app/src/core/types.ts';
import type { Asset } from './assets.ts';

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
  if (sitemap) files.set('sitemap.xml', sitemap);
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
