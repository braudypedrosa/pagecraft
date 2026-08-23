/* The server, as routes.

   Two jobs, deliberately kept apart:

     · **serve a site** — a visitor asks for a page and gets the bytes the export would have
       written. Rendered on save, held in memory per site, so a request does no work beyond a
       map lookup.
     · **serve the editor** — the builder's own `index.html`, plus the two endpoints that
       replace `localStorage`: load a document, save a document.

   Nothing here knows about authentication yet. `requireEditor` is the one place it will
   attach, and it is a named function rather than an inline check so that the seam is visible
   before there is anything behind it.

   `app.ts` takes its store and its editor file as arguments. That is what makes it testable
   without a database or a build — `index.ts` is the part that reads the environment. */
import { Hono, type Context } from 'hono';
import type { Store } from './store.ts';
import { renderSite, resolvePath } from './render.ts';
import type { Doc } from '../../app/src/core/types.ts';

export interface Options {
  store: Store;
  /** the built builder, as a string. Absent in tests that only exercise the site routes. */
  editorHtml?: string;
  /** which host serves the editor. Every other host is a site. */
  editorHost?: string;
}

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8'
};
const typeOf = (path: string) => TYPES[(path.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

export function createApp(o: Options) {
  const app = new Hono();

  /* Rendered output, per site id, rebuilt on save. A site's files are small — the whole
     demo project is 69 KB of HTML — and rendering is about 5 ms, so holding them costs
     little and means a visitor never waits for a render. */
  const built = new Map<string, Map<string, string>>();

  const build = (id: string, doc: Doc) => {
    const out = renderSite(doc);
    built.set(id, out.files);
    return out;
  };

  /** Where auth attaches. Named now, empty now, so the seam is not invented later. */
  const requireEditor = async (_siteId: string): Promise<boolean> => true;

  /* ---------------------------------------------------------------- the editor */

  app.get('/', c => {
    if (!isEditorHost(c.req.header('host'), o)) return serveSite(c, o, built, build, '/');
    if (!o.editorHtml) return c.text('No editor build. Run `node build.mjs` first.', 503);
    return c.html(o.editorHtml);
  });

  app.get('/api/sites', async c => {
    const sites = await o.store.list();
    /* the list, without the documents — a picker does not need every page of every site */
    return c.json(sites.map(s => ({ id: s.id, host: s.host, name: s.name, version: s.version, updatedAt: s.updatedAt })));
  });

  app.get('/api/sites/:id', async c => {
    const site = await o.store.byId(c.req.param('id'));
    if (!site) return c.json({ error: 'no such site' }, 404);
    if (!await requireEditor(site.id)) return c.json({ error: 'not allowed' }, 403);
    return c.json({ id: site.id, host: site.host, name: site.name, version: site.version, doc: site.doc });
  });

  app.post('/api/sites', async c => {
    const body = await c.req.json().catch(() => null) as { host?: string; name?: string; doc?: Doc } | null;
    if (!body || !body.host || !body.doc) return c.json({ error: 'host and doc are required' }, 400);
    try {
      const site = await o.store.create({ host: body.host, name: body.name || body.host, doc: body.doc });
      const out = build(site.id, site.doc);
      return c.json({ id: site.id, version: site.version, files: [...out.files.keys()] }, 201);
    } catch (e) {
      return c.json({ error: String((e as Error).message || e) }, 409);
    }
  });

  /* The save. This is the endpoint that makes the whole thing worth building: it is what
     `writeNow()` in the builder used to give localStorage. */
  app.put('/api/sites/:id', async c => {
    const id = c.req.param('id');
    const site = await o.store.byId(id);
    if (!site) return c.json({ error: 'no such site' }, 404);
    if (!await requireEditor(id)) return c.json({ error: 'not allowed' }, 403);

    const body = await c.req.json().catch(() => null) as { doc?: Doc; version?: number } | null;
    if (!body || !body.doc || typeof body.version !== 'number') {
      return c.json({ error: 'doc and version are required' }, 400);
    }

    const res = await o.store.save(id, body.doc, body.version);
    if (!res.ok) {
      /* A stale version is not an error the editor should swallow. Someone else saved, and
         overwriting them silently is the one thing a store must never do. */
      return c.json({ error: 'stale', conflict: res.conflict }, 409);
    }

    const out = build(id, res.site!.doc);
    return c.json({
      version: res.site!.version,
      files: [...out.files.keys()],
      /* the same review the builder shows, so a save can say what it noticed */
      findings: out.findings.map(f => ({ level: f.level, code: f.code, msg: f.msg }))
    });
  });

  /* ------------------------------------------------------------------ the sites */

  app.get('*', c => serveSite(c, o, built, build, new URL(c.req.url).pathname));

  return app;
}

function isEditorHost(host: string | undefined, o: Options) {
  if (!o.editorHost) return true;                       // no split configured: everything is the editor
  return (host || '').split(':')[0] === o.editorHost;
}

async function serveSite(
  c: Context,
  o: Options,
  built: Map<string, Map<string, string>>,
  build: (id: string, doc: Doc) => { files: Map<string, string> },
  urlPath: string
) {
  const host = (c.req.header('host') || '').split(':')[0];
  const site = await o.store.byHost(host);
  if (!site) return c.text(`No site for host ${host}`, 404);

  /* A restart empties the cache, so the first request after one renders. Cheaper than
     writing files to the volume and keeping them in step with the document. */
  let files = built.get(site.id);
  if (!files) files = build(site.id, site.doc).files;

  const path = resolvePath(urlPath);
  const body = files.get(path);
  /* A site's own 404 page if it has one — the convention the builder already exports. */
  if (body === undefined) {
    const notFound = files.get('404.html');
    if (notFound !== undefined) return c.body(notFound, 404, { 'content-type': TYPES.html });
    return c.text(`Not found: /${path}`, 404);
  }
  return c.body(body, 200, { 'content-type': typeOf(path) });
}
