/* Signing an assistant app in to one site, the way MCP clients expect (Phase 7).

   claude.ai, Claude Desktop and other MCP clients discover these endpoints from the 401 the /mcp
   route returns, register themselves, and send the owner here to approve. The result is the
   same per-site assistant token the Assistants page makes: it reads one site and files
   proposals, it is listed and revocable on that page, and it lapses if its maker stops owning
   the site. Public clients only, PKCE S256 required, codes single use for ten minutes.
   See docs/phase7-assistant-proposals-design.md. */
import { createHash } from 'node:crypto';
import type { Context, Hono } from 'hono';
import type { User } from './auth.ts';
import type { Site } from './store.ts';
import { throttle } from './mail.ts';
import { AssistantLimitError, type FileAssistantStore, type FileOAuthStore } from './assistants.ts';

export interface AssistantOAuthDeps {
  assistants?: FileAssistantStore;
  oauth?: FileOAuthStore;
  editorOrigin?: string;
  isEditorHost(c: Context): boolean;
  who(c: Context): Promise<User | null>;
  /** sites this user owns */
  ownedSites(user: User): Promise<Pick<Site, 'id' | 'name'>[]>;
  page(title: string, body: string): string;
  requestSource(c: Context): string;
}

export const ASSISTANT_SCOPES = ['site:read', 'proposals:write'];
const AUTHORIZE = '/oauth/assistants/authorize';
const TOKEN = '/oauth/assistants/token';
const REGISTER = '/oauth/assistants/register';

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** HTTPS, or a loopback address for an app on the owner's own computer. Nothing else. */
export function redirectAllowed(raw: unknown) {
  if (typeof raw !== 'string' || raw.length > 500) return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

/** What /mcp sends with a 401, so a client knows where to sign in. */
export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource`;

export function assistantOAuthRoutes(app: Hono, d: AssistantOAuthDeps) {
  const origin = (c: Context) => d.editorOrigin || new URL(c.req.url).origin;
  const open = (c: Context) => { c.header('access-control-allow-origin', '*'); c.header('cache-control', 'no-store'); };
  const ready = (c: Context) => d.isEditorHost(c) && !!d.assistants && !!d.oauth;

  const resource = (c: Context) => ({
    resource: `${origin(c)}/mcp`, resource_name: 'Pagecraft', authorization_servers: [origin(c)],
    bearer_methods_supported: ['header'], scopes_supported: ASSISTANT_SCOPES,
  });
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
    app.get(path, c => { if (!ready(c)) return c.notFound(); open(c); return c.json(resource(c)); });
  }
  app.get('/.well-known/oauth-authorization-server', c => {
    if (!ready(c)) return c.notFound();
    open(c);
    const here = origin(c);
    return c.json({
      issuer: here, authorization_endpoint: here + AUTHORIZE, token_endpoint: here + TOKEN, registration_endpoint: here + REGISTER,
      response_types_supported: ['code'], grant_types_supported: ['authorization_code'], code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'], scopes_supported: ASSISTANT_SCOPES,
    });
  });
  app.options('/oauth/assistants/*', c => {
    c.header('access-control-allow-origin', '*');
    c.header('access-control-allow-methods', 'POST, OPTIONS');
    c.header('access-control-allow-headers', 'content-type');
    return c.body(null, 204);
  });

  /* Dynamic client registration (RFC 7591), public clients only. */
  const registrations = throttle(20, 60 * 60_000, 20_000);
  app.post(REGISTER, async c => {
    if (!ready(c)) return c.notFound();
    open(c);
    if (!registrations.take(d.requestSource(c))) return c.json({ error: 'slow_down', error_description: 'Too many registrations. Try again later.' }, 429);
    const body = await c.req.json().catch(() => null) as { redirect_uris?: unknown; client_name?: unknown } | null;
    const uris = Array.isArray(body?.redirect_uris) ? body!.redirect_uris : [];
    if (!uris.length || uris.length > 5 || !uris.every(redirectAllowed)) {
      return c.json({ error: 'invalid_redirect_uri', error_description: 'Redirect URIs must be HTTPS, or http on localhost.' }, 400);
    }
    const name = String(body?.client_name || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'AI assistant';
    const client = await d.oauth!.registerClient({ name, redirectUris: uris as string[] });
    return c.json({
      client_id: client.id, client_id_issued_at: Math.floor(Date.parse(client.createdAt) / 1000), client_name: client.name,
      redirect_uris: client.redirectUris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code'], response_types: ['code'],
    }, 201);
  });

  const problemPage = (c: Context, message: string, status: 400 | 403 = 400) =>
    c.html(d.page('Can’t connect', `<h1>Can’t connect this assistant</h1><p>${esc(message)}</p>`), status);

  /* The owner approves, and chooses which one site the app may read and propose changes to. */
  app.get(AUTHORIZE, async c => {
    if (!ready(c)) return c.notFound();
    const q = c.req.query();
    const client = await d.oauth!.client(String(q.client_id || ''));
    const redirectUri = String(q.redirect_uri || '');
    // Without a known client and one of its own redirects, nothing is sent anywhere.
    if (!client || !client.redirectUris.includes(redirectUri)) return problemPage(c, 'This app is not registered with Pagecraft, or it asked to return somewhere it did not register.');
    /* Anyone may register a client, so redirecting before the owner has decided would send any
       visitor to any registered address. Bad parameters are explained here instead; the app is
       only sent back to after a decision on the consent page. */
    if (q.response_type !== 'code') return problemPage(c, 'This app asked to sign in in a way Pagecraft does not support.');
    if (q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(String(q.code_challenge || ''))) return problemPage(c, 'This app did not send the PKCE (S256) challenge Pagecraft requires.');
    if (q.resource && q.resource !== `${origin(c)}/mcp`) return problemPage(c, 'This app asked for access to something other than this Pagecraft server.');
    const user = await d.who(c);
    if (!user) return c.redirect(`/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname + new URL(c.req.url).search)}`, 302);
    const sites = await d.ownedSites(user);
    if (!sites.length) return problemPage(c, 'Your account doesn’t own any Pagecraft sites. Assistants can only connect to a site you own.', 403);
    const consent = await d.oauth!.createConsent({
      userId: user.id, clientId: client.id, redirectUri, challenge: String(q.code_challenge), state: String(q.state || ''), resource: `${origin(c)}/mcp`,
    });
    const host = new URL(redirectUri).host;
    c.header('cache-control', 'no-store');
    return c.html(d.page('Connect an assistant', `<style>.consent__actions label{margin-top:20px}.consent__buttons{display:flex;gap:10px;margin-top:8px}.consent__buttons .pc-btn{flex:1;width:auto}.consent__actions .pc-btn.secondary{background:#fff;border-color:var(--pc-border-strong)}.consent__actions .pc-btn.secondary:hover{background:var(--pc-hover-bg)}</style><section class="consent">
      <header class="consent__header"><div class="consent__brand"><img src="/brand/pagecraft-favicon.svg" alt=""><span>Pagecraft</span></div>
        <h1>Let ${esc(client.name)} propose changes to a site?</h1>
        <p>It will be able to read the site you choose and suggest changes. Nothing changes until you review and apply a proposal in the editor.</p></header>
      <div class="consent__body">
        <div class="consent__destination"><span>Returns to</span><strong>${esc(host)}</strong></div>
        <form class="consent__actions" method="post" action="${AUTHORIZE}">
          <input type="hidden" name="consent" value="${esc(consent)}">
          <label for="assistant-site">Site</label>
          <select id="assistant-site" name="siteId" required>${sites.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
          <p class="consent__note">It can’t publish, upload images, or change layout, styles, code, settings or people. Revoke it any time on the site’s Assistants page.</p>
          <div class="consent__buttons"><button class="pc-btn secondary" type="submit" name="decision" value="deny">Cancel</button><button class="pc-btn primary" type="submit" name="decision" value="allow">Allow</button></div>
        </form>
      </div></section>`));
  });

  app.post(AUTHORIZE, async c => {
    if (!ready(c)) return c.notFound();
    const user = await d.who(c);
    if (!user) return problemPage(c, 'Sign in to Pagecraft, then start connecting again from your assistant.');
    const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
    const consent = await d.oauth!.takeConsent(String(form.consent || ''));
    if (!consent || consent.userId !== user.id) return problemPage(c, 'This approval expired or was already used. Start connecting again from your assistant.');
    const to = new URL(consent.redirectUri);
    if (consent.state) to.searchParams.set('state', consent.state);
    if (form.decision !== 'allow') {
      to.searchParams.set('error', 'access_denied');
      return c.redirect(to.href, 303);
    }
    const siteId = String(form.siteId || '');
    if (!(await d.ownedSites(user)).some(s => s.id === siteId)) return problemPage(c, 'You can only connect an assistant to a site you own.', 403);
    to.searchParams.set('code', await d.oauth!.createCode({ ...consent, siteId }));
    return c.redirect(to.href, 303);
  });

  app.post(TOKEN, async c => {
    if (!ready(c)) return c.notFound();
    open(c);
    const type = c.req.header('content-type') || '';
    const body = (type.includes('application/json') ? await c.req.json().catch(() => null) : await c.req.parseBody().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'invalid_request' }, 400);
    if (body.grant_type !== 'authorization_code') return c.json({ error: 'unsupported_grant_type' }, 400);
    const code = await d.oauth!.takeCode(String(body.code || ''));
    const invalid = (why: string) => c.json({ error: 'invalid_grant', error_description: why }, 400);
    if (!code) return invalid('The code is unknown, expired or already used.');
    if (code.clientId !== String(body.client_id || '') || code.redirectUri !== String(body.redirect_uri || '')) return invalid('The code was issued to a different app or redirect.');
    if (challengeOf(String(body.code_verifier || '')) !== code.challenge) return invalid('The PKCE verifier does not match.');
    if (body.resource && body.resource !== code.resource) return c.json({ error: 'invalid_target' }, 400);
    const client = await d.oauth!.client(code.clientId);
    if (!client) return c.json({ error: 'invalid_client' }, 401);
    try {
      const { token } = await d.assistants!.createToken(code.siteId, `${client.name} (connected app)`, code.userId, { clientId: client.id });
      return c.json({ access_token: token, token_type: 'Bearer', scope: ASSISTANT_SCOPES.join(' ') });
    } catch (error) {
      if (error instanceof AssistantLimitError) return c.json({ error: 'invalid_request', error_description: error.message }, 400);
      throw error;
    }
  });
}
