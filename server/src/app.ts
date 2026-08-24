/* The server, as routes.

   Two jobs, deliberately kept apart:

     · **serve a site** — a visitor asks for a page and gets the bytes the export would have
       written. Rendered on save, held in memory per site, so a request does no work beyond a
       map lookup.
     · **serve the editor** — the builder's own `index.html`, plus the two endpoints that
       replace `localStorage`: load a document, save a document.

   The site routes are public — a visitor is not asked who they are. Everything under `/api`
   and `/auth` is not, and `who()` plus `allowed()` are the only two places that decide.

   `app.ts` takes its stores and its editor file as arguments. That is what makes it testable
   without a database or a build — `index.ts` is the part that reads the environment. */
import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Store } from './store.ts';
import { renderSite, resolvePath } from './render.ts';
import { contentOnly } from './content.ts';
import { throttle } from './mail.ts';
import {
  type AssetStore, type Asset, metaOf, sniff, dimensions, MAX_BYTES, ALLOWED
} from './assets.ts';
import type { Doc } from '../../app/src/core/types.ts';
import {
  type AuthStore, type User, type Role, roleAllows, newToken, hashToken,
  normalEmail, LINK_TTL_MS, SESSION_TTL_MS, logLink, type LinkSender
} from './auth.ts';

export const SESSION_COOKIE = 'pc_session';

export interface Options {
  store: Store;
  auth: AuthStore;
  /** where the images live. Absent means a site renders with placeholders. */
  assets?: AssetStore;
  /** the built builder, as a string. Absent in tests that only exercise the site routes. */
  editorHtml?: string;
  /** which host serves the editor. Every other host is a site. */
  editorHost?: string;
  /** where a login link points. Needed because the link is built outside a request. */
  editorOrigin?: string;
  /** how the link reaches the person. Logged in development. */
  sendLink?: LinkSender;
  /** at most so many links per address per window. Absent means the default. */
  loginLimit?: { take(key: string): boolean };
  /** `Secure` on the session cookie. Off in tests and local http, on everywhere real. */
  secureCookies?: boolean;
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

  /* A render needs the site's assets, and fetching them is asynchronous while the render is
     not — so they are fetched first and handed in. `renderSite` stays synchronous, which is
     the property the singleton core depends on. */
  const build = (id: string, doc: Doc, assets: Asset[] = []) => {
    const out = renderSite(doc, assets);
    built.set(id, out.files);
    return out;
  };
  const assetsOf = async (id: string) => o.assets ? o.assets.list(id) : [];
  const rebuild = async (id: string, doc: Doc) => build(id, doc, await assetsOf(id));

  /* ------------------------------------------------------------------- who, and what */

  /** The person behind this request, or null. A bad cookie is the same as no cookie. */
  const who = async (c: Context): Promise<User | null> => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return null;
    const session = await o.auth.sessionByDigest(hashToken(token));
    if (!session) return null;
    return o.auth.userById(session.userId);
  };

  /**
   * May this person do this to this site? Every answer comes from here, so a route cannot
   * forget the membership half and check only that somebody is logged in.
   */
  const allowed = async (c: Context, siteId: string, verb: 'read' | 'write' | 'admin') => {
    const user = await who(c);
    if (!user) return { ok: false as const, status: 401 as const };
    const m = await o.auth.membership(siteId, user.id);
    if (!m) return { ok: false as const, status: 404 as const };   // not "403": do not confirm it exists
    if (!roleAllows(m.role, verb)) return { ok: false as const, status: 403 as const };
    return { ok: true as const, user, role: m.role };
  };

  const deny = (c: Context, status: 401 | 403 | 404) =>
    c.json({ error: status === 401 ? 'sign in' : status === 403 ? 'not allowed' : 'no such site' }, status);

  /* ----------------------------------------------------------------------------- auth */

  /* Always 200, whether or not the address is known. Answering differently would turn this
     into a way to ask which of someone's addresses has an account here — and the same is true
     of the throttle, which is why being over the limit also answers 200. Somebody hammering
     this endpoint learns nothing either way; the person whose address it is stops receiving
     mail, which is the point. */
  const limit = o.loginLimit || throttle();
  app.post('/auth/login', async c => {
    const body = await c.req.json().catch(() => null) as { email?: string } | null;
    const email = normalEmail(body?.email || '');
    if (!email.includes('@')) return c.json({ error: 'an email address is required' }, 400);

    if (limit.take(email) && await o.auth.userByEmail(email)) {
      const token = newToken();
      await o.auth.putLink(hashToken(token), email, Date.now() + LINK_TTL_MS);
      const origin = o.editorOrigin || new URL(c.req.url).origin;
      /* Awaited, so a mail server that is refusing is a 500 here rather than a silent
         nothing — a person staring at "check your email" is owed the truth. */
      try {
        await (o.sendLink || logLink)(email, `${origin}/auth/callback?token=${token}`);
      } catch (e) {
        console.error('the login link could not be sent:', (e as Error).message);
        return c.json({ error: 'the link could not be sent — try again shortly' }, 502);
      }
    }
    return c.json({ sent: true });
  });

  app.get('/auth/callback', async c => {
    const token = c.req.query('token') || '';
    const link = token ? await o.auth.useLink(hashToken(token)) : null;
    if (!link) return c.text('That link has expired or has already been used.', 400);

    const user = await o.auth.userByEmail(link.email);
    if (!user) return c.text('That link has expired or has already been used.', 400);

    const session = newToken();
    await o.auth.putSession(hashToken(session), user.id, Date.now() + SESSION_TTL_MS);
    setCookie(c, SESSION_COOKIE, session, {
      httpOnly: true, sameSite: 'Lax', path: '/',
      secure: !!o.secureCookies, maxAge: Math.floor(SESSION_TTL_MS / 1000)
    });
    return c.redirect('/');
  });

  app.post('/auth/logout', async c => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await o.auth.dropSession(hashToken(token));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/auth/me', async c => {
    const user = await who(c);
    if (!user) return c.json({ user: null });
    const sites = await o.store.list();
    const mine = [];
    for (const s of sites) {
      const m = await o.auth.membership(s.id, user.id);
      if (m) mine.push({ id: s.id, host: s.host, name: s.name, role: m.role });
    }
    return c.json({ user: { id: user.id, email: user.email, name: user.name }, sites: mine });
  });

  /* ---------------------------------------------------------------- the editor */

  app.get('/', async c => {
    if (!isEditorHost(c.req.header('host'), o)) return serveSite(c, o, built, build, '/');
    const user = await who(c);
    if (!user) return c.html(signInPage());

    const sites = await o.store.list();
    const mine = [];
    for (const s of sites) {
      const m = await o.auth.membership(s.id, user.id);
      if (m) mine.push({ site: s, role: m.role });
    }
    if (!mine.length) return c.html(emptyPage(user.email));
    /* one site is the common case, and a picker with one row on it is a click for nothing */
    if (mine.length === 1) return c.redirect(`/edit/${mine[0].site.id}`);
    return c.html(pickerPage(user.email, mine.map(m => ({ id: m.site.id, name: m.site.name, host: m.site.host, role: m.role }))));
  });

  /* The editor, with the document already in the page.

     Injecting it rather than having the editor fetch it keeps `load()` synchronous, which is
     what it is in the single-file build — the editor boots from a document that is already
     there, and the only difference is where the page got it. One build serves both. */
  app.get('/edit/:id', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return gate.status === 401 ? c.html(signInPage()) : deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    if (!o.editorHtml) return c.text('No editor build. Run `node build.mjs` first.', 503);

    const config = {
      siteId: site.id, host: site.host, name: site.name,
      version: site.version, role: gate.role, doc: site.doc
    };
    return c.html(inject(o.editorHtml, config));
  });

  /* The list is per person: a site nobody granted you is a site you do not know exists. */
  app.get('/api/sites', async c => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    const out = [];
    for (const s of await o.store.list()) {
      const m = await o.auth.membership(s.id, user.id);
      /* the list, without the documents — a picker does not need every page of every site */
      if (m) out.push({ id: s.id, host: s.host, name: s.name, version: s.version, updatedAt: s.updatedAt, role: m.role });
    }
    return c.json(out);
  });

  app.get('/api/sites/:id', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    return c.json({ id: site.id, host: site.host, name: site.name, version: site.version, role: gate.role, doc: site.doc });
  });

  /* Creating a site is not something a client does, so it needs a signed-in person and
     grants them ownership of what they made. */
  app.post('/api/sites', async c => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    const body = await c.req.json().catch(() => null) as { host?: string; name?: string; doc?: Doc } | null;
    if (!body || !body.host || !body.doc) return c.json({ error: 'host and doc are required' }, 400);
    try {
      const site = await o.store.create({ host: body.host, name: body.name || body.host, doc: body.doc });
      await o.auth.grant(site.id, user.id, 'owner');
      const out = await rebuild(site.id, site.doc);
      return c.json({ id: site.id, version: site.version, files: [...out.files.keys()] }, 201);
    } catch (e) {
      return c.json({ error: String((e as Error).message || e) }, 409);
    }
  });

  /* The save. This is the endpoint that makes the whole thing worth building: it is what
     `writeNow()` in the builder used to give localStorage. */
  app.put('/api/sites/:id', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'write');
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);

    const body = await c.req.json().catch(() => null) as { doc?: Doc; version?: number } | null;
    if (!body || !body.doc || typeof body.version !== 'number') {
      return c.json({ error: 'doc and version are required' }, 400);
    }

    /* A content role may save, and only content. The check is against what is stored rather
       than against what the editor thinks it loaded, so a stale client cannot smuggle a
       structural change through by sending an old skeleton. */
    if (gate.role === 'content') {
      /* the site's own asset ids, so an image may be swapped for another upload of theirs and
         not for a URL or for somebody else's id */
      const ids = new Set((await assetsOf(id)).map(x => x.id));
      const check = contentOnly(site.doc, body.doc, ids);
      if (!check.ok) {
        return c.json({
          error: 'content only',
          detail: 'This account can change text and CMS content. Layout, styling and page structure are not editable here.'
        }, 403);
      }
    }

    const res = await o.store.save(id, body.doc, body.version);
    if (!res.ok) {
      /* A stale version is not an error the editor should swallow. Someone else saved, and
         overwriting them silently is the one thing a store must never do. */
      return c.json({ error: 'stale', conflict: res.conflict }, 409);
    }

    const out = await rebuild(id, res.site!.doc);
    return c.json({
      version: res.site!.version,
      files: [...out.files.keys()],
      /* the same review the builder shows, so a save can say what it noticed */
      findings: out.findings.map(f => ({ level: f.level, code: f.code, msg: f.msg }))
    });
  });

  /* ---------------------------------------------------------------- the people

     Inviting somebody is a grant, not a token. Creating an account for an address hands over
     nothing on its own — they still have to receive a magic link at that address to sign in —
     so there is no invite to expire, resend or leak, and one fewer lifecycle to get wrong.

     Only an owner may do any of this: `admin` is the verb, and `roleAllows` gives it to owners
     alone. */

  app.get('/api/sites/:id/people', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);
    const list = await o.auth.members(id);
    return c.json(list.map(m => ({ userId: m.userId, email: m.email, name: m.name, role: m.role })));
  });

  app.post('/api/sites/:id/people', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);

    const body = await c.req.json().catch(() => null) as { email?: string; role?: Role } | null;
    const email = normalEmail(body?.email || '');
    const role: Role = body?.role === 'owner' ? 'owner' : 'content';
    if (!email.includes('@')) return c.json({ error: 'an email address is required' }, 400);

    /* An owner changing their own role is how a site ends up with nobody who can manage it. */
    const existing = await o.auth.userByEmail(email);
    if (existing && existing.id === gate.user.id && role !== 'owner') {
      return c.json({ error: 'you would be giving up your own ownership — ask another owner to do it' }, 409);
    }

    const user = existing || await o.auth.createUser(email);
    const m = await o.auth.grant(id, user.id, role);
    return c.json({ userId: user.id, email: user.email, name: user.name, role: m.role }, 201);
  });

  app.delete('/api/sites/:id/people/:userId', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);

    const target = c.req.param('userId');
    /* A site with no owner is a site nobody can manage, and there is no route back — no
       superuser, and the API is the only way in. So the last owner does not leave. */
    const owners = (await o.auth.members(id)).filter(m => m.role === 'owner');
    if (owners.length === 1 && owners[0].userId === target) {
      return c.json({ error: 'the last owner cannot be removed — a site with no owner cannot be managed' }, 409);
    }

    const gone = await o.auth.revoke(id, target);
    if (!gone) return c.json({ error: 'they had no access to remove' }, 404);
    /* Their sessions stay valid and are harmless: access is checked per request against the
       membership, so a membership that is gone is access that is gone. */
    return c.json({ removed: target });
  });

  /* ---------------------------------------------------------------- the assets */

  app.get('/api/sites/:id/assets', async c => {
    const gate = await allowed(c, c.req.param('id'), 'read');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.json([]);
    return c.json((await o.assets.list(c.req.param('id'))).map(metaOf));
  });

  /* Uploading is a write, so a content account may do it: swapping a photograph is a content
     edit in every sense that matters. What it may not do is point an element at the new
     image — that is a prop, and `contentOnly` refuses it. Worth naming as the next thing to
     fix rather than a subtlety to enjoy. */
  app.post('/api/sites/:id/assets', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'write');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.json({ error: 'this server stores no assets' }, 501);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return c.json({ error: 'a file is required' }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: `too large — the limit is ${MAX_BYTES} bytes` }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    /* Sniffed, not trusted. A caller can put anything in Content-Type, and `image/png` on
       arbitrary bytes is a way to host arbitrary content on somebody else's domain. */
    const type = sniff(bytes);
    if (!type || !ALLOWED.has(type)) return c.json({ error: 'that is not an image this server serves' }, 415);

    const saved = await o.assets.put({
      siteId: id, name: file.name || 'image', type, bytes, ...dimensions(bytes, type)
    });
    /* the site is rebuilt so the new file is served immediately, not on the next save */
    const site = await o.store.byId(id);
    if (site) await rebuild(id, site.doc);
    return c.json(metaOf(saved), 201);
  });

  /* The editor's view of an asset, by id. The site serves the same bytes at `assets/<name>`;
     this exists because the editor holds ids and knows nothing about names. */
  app.get('/api/sites/:id/assets/:aid', async c => {
    const gate = await allowed(c, c.req.param('id'), 'read');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.notFound();
    const a = await o.assets.get(c.req.param('id'), c.req.param('aid'));
    if (!a) return c.notFound();
    return c.body(a.bytes as unknown as ArrayBuffer, 200, {
      'content-type': a.type, 'cache-control': 'private, max-age=3600'
    });
  });

  /* ------------------------------------------------------------------ the sites */

  app.get('*', c => serveSite(c, o, built, build, new URL(c.req.url).pathname));

  return app;
}

/* `<` is escaped for the reason convention 9 exists: a document containing the characters
   `</script>` — in a code block, say, which this builder now has a widget for — would
   otherwise close the tag it is inside and the rest of the page would be script. */
function inject(html: string, config: unknown) {
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  const tag = `<script>window.PC_SERVER=${json};<\/script>\n`;
  const at = html.indexOf('<script');
  return at < 0 ? tag + html : html.slice(0, at) + tag + html.slice(at);
}

const shell = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#ebe8dd;color:#111311;
       font:15px/1.5 "Manrope",system-ui,-apple-system,sans-serif}
  .card{background:#fff;border:1px solid #e5e1d6;border-radius:16px;padding:28px;width:min(92vw,380px);
        box-shadow:0 10px 30px -12px #1113111f}
  h1{margin:0 0 4px;font-size:19px;letter-spacing:-.01em}
  p{margin:0 0 18px;color:#5f6660;font-size:13.5px}
  label{display:block;font-size:12px;color:#5f6660;margin-bottom:6px}
  input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d4cfc0;border-radius:4px;
        font:inherit;margin-bottom:12px}
  button{width:100%;padding:10px;border:0;border-radius:8px;background:#b7f34a;color:#111311;
         font:600 14px inherit;cursor:pointer}
  a{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;margin-bottom:6px;
    border:1px solid #e5e1d6;border-radius:8px;color:inherit;text-decoration:none}
  a:hover{background:#f8f6ef;border-color:#5f6660}
  small{color:#5f6660;font-size:12px}
  .ok{padding:11px 12px;border-radius:8px;background:#f8f6ef;font-size:13.5px}
</style></head><body><div class="card">${body}</div></body></html>`;

/* No framework for four screens' worth of markup. If this grows past a form and a list it
   should become part of the editor bundle rather than more strings in here. */
const signInPage = () => shell('Sign in — Pagecraft', `
  <h1>Pagecraft</h1>
  <p>Enter your email and we will send a link that signs you in.</p>
  <form id="f"><label for="e">Email</label>
    <input id="e" name="email" type="email" autocomplete="email" required>
    <button type="submit">Send me a link</button></form>
  <div id="done" class="ok" hidden>Check your email for the link.</div>
  <script>
    document.getElementById('f').addEventListener('submit', async ev => {
      ev.preventDefault();
      await fetch('/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: document.getElementById('e').value })
      });
      document.getElementById('f').hidden = true;
      document.getElementById('done').hidden = false;
    });
  <\/script>`);

const emptyPage = (email: string) => shell('No sites — Pagecraft', `
  <h1>Nothing to edit yet</h1>
  <p>${escapeHtml(email)} has no sites on this server. Ask whoever set it up to grant you one.</p>`);

const pickerPage = (email: string, sites: { id: string; name: string; host: string; role: string }[]) =>
  shell('Your sites — Pagecraft', `
  <h1>Your sites</h1>
  <p>Signed in as ${escapeHtml(email)}</p>
  ${sites.map(s => `<a href="/edit/${encodeURIComponent(s.id)}">
    <span>${escapeHtml(s.name)}<br><small>${escapeHtml(s.host)}</small></span>
    <small>${escapeHtml(s.role)}</small></a>`).join('')}`);

const escapeHtml = (v: string) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function isEditorHost(host: string | undefined, o: Options) {
  if (!o.editorHost) return true;                       // no split configured: everything is the editor
  return (host || '').split(':')[0] === o.editorHost;
}

async function serveSite(
  c: Context,
  o: Options,
  built: Map<string, Map<string, string>>,
  build: (id: string, doc: Doc, assets?: Asset[]) => { files: Map<string, string> },
  urlPath: string
) {
  const host = (c.req.header('host') || '').split(':')[0];
  const site = await o.store.byHost(host);
  if (!site) return c.text(`No site for host ${host}`, 404);

  /* A restart empties the cache, so the first request after one renders. Cheaper than
     writing files to the volume and keeping them in step with the document. */
  const path = resolvePath(urlPath);

  /* Images come from the asset store rather than the rendered map: the map holds strings, and
     putting megabytes of binary in it would make every render carry them. */
  if (path.startsWith('assets/') && o.assets) {
    const a = await o.assets.byPath(site.id, path);
    if (a) return c.body(a.bytes as unknown as ArrayBuffer, 200, {
      'content-type': a.type,
      /* the path is the filename, and the filename changes when the image does, so this is
         safe to cache hard — a replaced image is a different path */
      'cache-control': 'public, max-age=31536000, immutable'
    });
  }

  let files = built.get(site.id);
  if (!files) files = build(site.id, site.doc, o.assets ? await o.assets.list(site.id) : []).files;
  const body = files.get(path);
  /* A site's own 404 page if it has one — the convention the builder already exports. */
  if (body === undefined) {
    const notFound = files.get('404.html');
    if (notFound !== undefined) return c.body(notFound, 404, { 'content-type': TYPES.html });
    return c.text(`Not found: /${path}`, 404);
  }
  return c.body(body, 200, { 'content-type': typeOf(path) });
}
