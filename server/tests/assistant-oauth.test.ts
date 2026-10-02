import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport, auth, type OAuthClientProvider } from '@modelcontextprotocol/client';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { FileAssistantStore, FileOAuthStore } from '../src/assistants.ts';
import { blankDoc } from '../src/render.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(r => rm(r, { recursive: true, force: true }))); });
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

async function rig(editorOrigin = 'http://admin.test') {
  const root = await mkdtemp(join(tmpdir(), 'pc-oauth-'));
  roots.push(root);
  const store = new MemoryStore(), auth = new MemoryAuthStore();
  const assistants = new FileAssistantStore(root);
  const site = await store.create({ host: 'acme.invalid', name: 'Acme', slug: 'acme', doc: blankDoc('Acme') });
  const second = await store.create({ host: 'beta.invalid', name: 'Beta', slug: 'beta', doc: blankDoc('Beta') });
  const notMine = await store.create({ host: 'gamma.invalid', name: 'Gamma', slug: 'gamma', doc: blankDoc('Gamma') });
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const other = await auth.createUser('other@example.test', 'Other');
  await auth.grant(site.id, owner.id, 'owner');
  await auth.grant(second.id, owner.id, 'owner');
  await auth.grant(notMine.id, other.id, 'owner');
  await auth.grant(notMine.id, owner.id, 'content');
  const app = createApp({
    store, auth, assistants, assistantOAuth: new FileOAuthStore(root),
    editorHost: 'admin.test', editorOrigin, editorHtml: '<title>Builder</title>',
  });
  const token = newToken();
  await auth.putSession(hashToken(token), owner.id, Date.now() + 60_000);
  const cookie = `pc_session=${token}`;
  const call = (path: string, init: { method?: string; form?: Record<string, string>; json?: unknown; cookie?: string } = {}) =>
    app.request(new Request(`http://admin.test${path}`, {
      method: init.method || 'GET', redirect: 'manual',
      body: init.json !== undefined ? JSON.stringify(init.json) : init.form ? new URLSearchParams(init.form).toString() : undefined,
      headers: {
        host: 'admin.test', origin: 'http://admin.test', cookie: init.cookie ?? cookie,
        ...(init.json !== undefined ? { 'content-type': 'application/json' } : init.form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
    }));
  const register = async (redirect = CALLBACK) => (await (await call('/oauth/assistants/register', { method: 'POST', json: { client_name: 'Claude', redirect_uris: [redirect] } })).json()) as { client_id: string };
  /** The browser half: authorize, approve, and the code that comes back. */
  const approve = async (clientId: string, siteId: string, verifier = randomBytes(32).toString('base64url')) => {
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const page = await (await call(`/oauth/assistants/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=${challenge}&code_challenge_method=S256&state=xyz&resource=${encodeURIComponent('http://admin.test/mcp')}`)).text();
    const consent = /name="consent" value="([^"]+)"/.exec(page)![1];
    const back = await call('/oauth/assistants/authorize', { method: 'POST', form: { consent, siteId, decision: 'allow' } });
    const to = new URL(back.headers.get('location')!);
    return { code: to.searchParams.get('code')!, state: to.searchParams.get('state'), verifier, page };
  };
  const exchange = (clientId: string, code: string, verifier: string) => call('/oauth/assistants/token', { method: 'POST', form: {
    grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: CALLBACK, resource: 'http://admin.test/mcp',
  } });
  return { app, assistants, site, second, notMine, owner, call, register, approve, exchange };
}

test('MCP clients can discover how to sign in from the 401 and the metadata', async () => {
  const r = await rig();
  const unauthorized = await r.call('/mcp', { method: 'POST', json: { jsonrpc: '2.0', id: 1, method: 'tools/list' }, cookie: '' });
  a.equal(unauthorized.status, 401);
  a.match(unauthorized.headers.get('www-authenticate') || '', /resource_metadata="http:\/\/admin\.test\/\.well-known\/oauth-protected-resource"/);
  a.match(unauthorized.headers.get('www-authenticate') || '', /scope="projects:read packages:read"/, 'the WordPress plugin still sees its scope');
  const resource = await (await r.call('/.well-known/oauth-protected-resource')).json() as any;
  a.equal(resource.resource, 'http://admin.test/mcp');
  a.deepEqual(resource.authorization_servers, ['http://admin.test']);
  const server = await (await r.call('/.well-known/oauth-authorization-server')).json() as any;
  a.equal(server.authorization_endpoint, 'http://admin.test/oauth/assistants/authorize');
  a.deepEqual(server.code_challenge_methods_supported, ['S256']);
  a.equal(server.registration_endpoint, 'http://admin.test/oauth/assistants/register');
});

test('registration takes only HTTPS or local redirects', async () => {
  const r = await rig();
  const ok = await r.call('/oauth/assistants/register', { method: 'POST', json: { client_name: 'Claude', redirect_uris: [CALLBACK] } });
  a.equal(ok.status, 201);
  a.match(((await ok.json()) as any).client_id, /^pcc_[a-f0-9]{24}$/);
  a.equal((await r.call('/oauth/assistants/register', { method: 'POST', json: { redirect_uris: ['http://localhost:33418/callback'] } })).status, 201);
  for (const bad of ['http://evil.example/cb', 'javascript:alert(1)', 'https://user:pw@claude.ai/cb', '']) {
    a.equal((await r.call('/oauth/assistants/register', { method: 'POST', json: { redirect_uris: [bad] } })).status, 400, bad);
  }
});

test('the owner picks one of their own sites, and the app gets a token for that site only', async () => {
  const r = await rig();
  const { client_id } = await r.register();
  const signedOut = await r.call(`/oauth/assistants/authorize?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=${'a'.repeat(43)}&code_challenge_method=S256`, { cookie: '' });
  a.equal(signedOut.status, 302);
  a.match(signedOut.headers.get('location') || '', /^\/sign-in\?next=/);

  const first = await r.approve(client_id, r.site.id);
  a.match(first.page, /Let Claude propose changes to a site\?/);
  a.match(first.page, /claude\.ai/);
  a.match(first.page, /<option value="[^"]+">Acme<\/option><option value="[^"]+">Beta<\/option><\/select>/, 'only sites they own');
  a.doesNotMatch(first.page, /Gamma/);
  a.equal(first.state, 'xyz');

  const wrong = await r.exchange(client_id, first.code, 'not-the-verifier-not-the-verifier-not-the-ve');
  a.equal(wrong.status, 400);
  a.equal(((await wrong.json()) as any).error, 'invalid_grant');
  a.equal((await r.exchange(client_id, first.code, first.verifier)).status, 400, 'a code is used once, even by a failed attempt');

  const second = await r.approve(client_id, r.site.id);
  const issued = await r.exchange(client_id, second.code, second.verifier);
  a.equal(issued.status, 200);
  const body = await issued.json() as any;
  a.equal(body.token_type, 'Bearer');
  a.match(body.access_token, /^pca\./);
  const [listed] = await r.assistants.tokens(r.site.id);
  a.equal(listed.name, 'Claude (connected app)');

  const client = new Client({ name: 'oauth-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://admin.test/mcp'), {
    authProvider: { token: async () => body.access_token },
    fetch: async (input, init) => { const h = new Headers(init?.headers); h.set('host', 'admin.test'); return r.app.fetch(new Request(input, { ...init, headers: h })); },
  }));
  const outline = (await client.callTool({ name: 'pagecraft_site', arguments: {} })).structuredContent as any;
  a.equal(outline.site.id, r.site.id);
  await client.close();

  // Connecting the same app to the same site again replaces its token.
  const again = await r.approve(client_id, r.site.id);
  await r.exchange(client_id, again.code, again.verifier);
  const tokens = await r.assistants.tokens(r.site.id);
  a.deepEqual(tokens.map(t => Boolean(t.revokedAt)).sort(), [false, true]);
});

test('declining, someone else’s site, and stale approvals are all refused', async () => {
  const r = await rig();
  const { client_id } = await r.register();
  const challenge = createHash('sha256').update('v'.repeat(43)).digest('base64url');
  const authorize = (extra = '') => r.call(`/oauth/assistants/authorize?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=${challenge}&code_challenge_method=S256&state=s1${extra}`);
  const consentOf = async () => /name="consent" value="([^"]+)"/.exec(await (await authorize()).text())![1];

  const denied = await r.call('/oauth/assistants/authorize', { method: 'POST', form: { consent: await consentOf(), siteId: r.site.id, decision: 'deny' } });
  a.match(denied.headers.get('location') || '', /^https:\/\/claude\.ai\/api\/mcp\/auth_callback\?state=s1&error=access_denied$/);

  const consent = await consentOf();
  a.equal((await r.call('/oauth/assistants/authorize', { method: 'POST', form: { consent, siteId: r.notMine.id, decision: 'allow' } })).status, 403);
  a.equal((await r.call('/oauth/assistants/authorize', { method: 'POST', form: { consent, siteId: r.site.id, decision: 'allow' } })).status, 400, 'an approval is used once');

  const noPkce = await r.call(`/oauth/assistants/authorize?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(CALLBACK)}&state=s1`);
  a.match(noPkce.headers.get('location') || '', /error=invalid_request/);
  a.equal((await r.call(`/oauth/assistants/authorize?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent('https://evil.example/cb')}`)).status, 400, 'never redirects somewhere unregistered');
  a.equal((await r.call(`/oauth/assistants/authorize?response_type=code&client_id=pcc_${'0'.repeat(24)}&redirect_uri=${encodeURIComponent(CALLBACK)}`)).status, 400);
});

test('the MCP SDK’s own client signs in end to end, the way Claude Desktop and Code do', async () => {
  // The SDK, rightly, sends a code only to an HTTPS token endpoint.
  const r = await rig('https://admin.test');
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    h.set('host', 'admin.test');
    return r.app.fetch(new Request(input, { ...init, headers: h, redirect: 'manual' }));
  };
  const browser: { opened?: URL } = {};
  const saved: { client?: any; tokens?: any; verifier?: string } = {};
  const provider: OAuthClientProvider = {
    get redirectUrl() { return 'http://localhost:33418/callback'; },
    get clientMetadata() { return { client_name: 'Claude Desktop', redirect_uris: ['http://localhost:33418/callback'], grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none' }; },
    state: () => 'desktop-state',
    clientInformation: () => saved.client,
    saveClientInformation: (info) => { saved.client = info; },
    tokens: () => saved.tokens,
    saveTokens: (tokens) => { saved.tokens = tokens; },
    redirectToAuthorization: (url) => { browser.opened = url; },
    saveCodeVerifier: (v) => { saved.verifier = v; },
    codeVerifier: () => saved.verifier!,
  };
  a.equal(await auth(provider, { serverUrl: 'https://admin.test/mcp', fetchFn }), 'REDIRECT');
  const opened = browser.opened!;
  a.ok(opened, 'the app is sent to the consent page');
  a.equal(opened.origin + opened.pathname, 'https://admin.test/oauth/assistants/authorize');
  a.match(saved.client.client_id, /^pcc_/);

  // The owner approves in their browser.
  const page = await (await r.call(opened.pathname + opened.search)).text();
  const consent = /name="consent" value="([^"]+)"/.exec(page)![1];
  const back = new URL((await r.call('/oauth/assistants/authorize', { method: 'POST', form: { consent, siteId: r.second.id, decision: 'allow' } })).headers.get('location')!);
  a.equal(back.origin + back.pathname, 'http://localhost:33418/callback');
  a.equal(back.searchParams.get('state'), 'desktop-state');

  a.equal(await auth(provider, { serverUrl: 'https://admin.test/mcp', authorizationCode: back.searchParams.get('code')!, fetchFn }), 'AUTHORIZED');
  a.match(saved.tokens.access_token, /^pca\./);
  const client = new Client({ name: 'desktop', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('https://admin.test/mcp'), { authProvider: provider, fetch: fetchFn }));
  a.equal(((await client.callTool({ name: 'pagecraft_site', arguments: {} })).structuredContent as any).site.name, 'Beta');
  await client.close();
});
