import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { ComponentDef, Node } from '../../app/src/core/types.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { MemoryAssetStore } from '../src/assets.ts';
import { CLAIM_TTL, FileAssistantStore } from '../src/assistants.ts';
import { MemoryPublicationReviewStore } from '../src/reviews.ts';
import { blankDoc } from '../src/render.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(r => rm(r, { recursive: true, force: true }))); });
const node = (id: string, type: string, props: Record<string, unknown> = {}, extra: Partial<Node> = {}): Node => ({
  id, type, props, css: { d: {}, t: {}, m: {} }, hide: {}, cls: [], adv: {}, children: [], ...extra,
} as unknown as Node);

async function rig() {
  const root = await mkdtemp(join(tmpdir(), 'pc-assistants-'));
  roots.push(root);
  const store = new MemoryStore(), auth = new MemoryAuthStore(), assets = new MemoryAssetStore();
  const reviews = new MemoryPublicationReviewStore();
  const assistants = new FileAssistantStore(join(root, 'assistants'));
  const doc = blankDoc('Acme');
  const card: ComponentDef = { id: 'card', name: 'Card', props: [{ k: 'title', label: 'Title', t: 'text', def: 'Hello' }], node: node('def', 'box') };
  doc.meta.components = [card];
  doc.pages[0].tree = [node('sec', 'section', {}, { children: [node('h1', 'heading', { text: 'Welcome' }), node('inst', 'box', {}, { use: 'card' })] })];
  const site = await store.create({ host: 'acme.invalid', name: 'Acme', slug: 'acme', doc });
  const other = await store.create({ host: 'other.invalid', name: 'Other', slug: 'other', doc: blankDoc('Other') });
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const editor = await auth.createUser('editor@example.test', 'Editor');
  await auth.grant(site.id, owner.id, 'owner');
  await auth.grant(other.id, owner.id, 'owner');
  await auth.grant(site.id, editor.id, 'content');
  const image = await assets.put({ siteId: site.id, name: 'hero.png', type: 'image/png', w: 4, h: 4, bytes: new Uint8Array([1, 2, 3]) });
  const app = createApp({ store, auth, assets, assistants, reviews, editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>' });
  const cookie = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookie(owner.id), editorCookie = await cookie(editor.id);
  const call = (path: string, init: { method?: string; body?: string; json?: unknown; cookie?: string } = {}) => app.request(new Request(`http://admin.test${path}`, {
    method: init.method || 'GET',
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    headers: {
      host: 'admin.test', origin: 'http://admin.test', cookie: init.cookie ?? ownerCookie,
      ...(init.json !== undefined ? { 'content-type': 'application/json' } : init.body !== undefined ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
  }));
  const mcpFor = async (token: string) => {
    const client = new Client({ name: 'pagecraft-assistant-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL('http://admin.test/mcp'), {
      authProvider: { token: async () => token },
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('host', 'admin.test');
        return app.fetch(new Request(input, { ...init, headers }));
      },
    }));
    return client;
  };
  const newAssistantToken = async () => {
    const page = await (await call(`/sites/${site.id}/assistants/tokens`, { method: 'POST', body: 'name=Claude+Code' })).text();
    return /pca\.[A-Za-z0-9_-]+\.[a-f0-9]{16}\.[A-Za-z0-9_-]{43}/.exec(page)![0];
  };
  return { app, store, auth, assistants, reviews, site, other, owner, editor, image, call, editorCookie, mcpFor, newAssistantToken };
}

test('owners make tokens that are shown once, list them, and revoke them', async () => {
  const r = await rig();
  a.equal((await r.call(`/sites/${r.site.id}/assistants`, { cookie: r.editorCookie })).status, 403, 'owners only');
  const created = await r.call(`/sites/${r.site.id}/assistants/tokens`, { method: 'POST', body: 'name=Claude+Code' });
  a.equal(created.status, 200);
  a.match(created.headers.get('cache-control') || '', /no-store/);
  const page = await created.text();
  const token = /pca\.[A-Za-z0-9_-]+\.[a-f0-9]{16}\.[A-Za-z0-9_-]{43}/.exec(page)![0];
  a.match(page, /claude mcp add --transport http pagecraft-acme http:\/\/admin\.test\/mcp --header &quot;Authorization: Bearer pca\./);
  const later = await (await r.call(`/sites/${r.site.id}/assistants`)).text();
  a.doesNotMatch(later, new RegExp(token.split('.').at(-1)!), 'the secret is never shown again');
  a.match(later, /Claude Code/);
  a.ok(await r.assistants.authenticate(token));

  const [record] = await r.assistants.tokens(r.site.id);
  const revoked = await r.call(`/sites/${r.site.id}/assistants/tokens/${record.id}/revoke`, { method: 'POST', body: '' });
  a.equal(revoked.status, 303);
  a.equal(await r.assistants.authenticate(token), null);
  a.equal(await r.assistants.authenticate(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')), null, 'a forged secret fails');
});

test('an assistant reads one site and files proposals; it cannot change anything itself', async () => {
  const r = await rig();
  const mcp = await r.mcpFor(await r.newAssistantToken());
  a.deepEqual((await mcp.listTools()).tools.map(t => t.name),
    ['pagecraft_site', 'pagecraft_get_page', 'pagecraft_propose_changes', 'pagecraft_get_proposal', 'pagecraft_list_proposals']);
  const outline = (await mcp.callTool({ name: 'pagecraft_site', arguments: {} })).structuredContent as any;
  a.equal(outline.site.version, r.site.version);
  a.deepEqual(outline.components.map((c: { id: string }) => c.id), ['card']);
  a.deepEqual(outline.images.map((i: { id: string }) => i.id), [r.image.id]);
  const page = (await mcp.callTool({ name: 'pagecraft_get_page', arguments: { pageId: r.site.doc.pages[0].id } })).structuredContent as any;
  a.deepEqual(page.elements.find((e: { id: string }) => e.id === 'h1').text, { text: 'Welcome' });
  a.equal(page.elements.find((e: { id: string }) => e.id === 'inst').component.values.title, 'Hello');

  const stale = await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version - 1, title: 'Old', changes: [{ type: 'text', nodeId: 'h1', value: 'x' }] } });
  a.equal(stale.isError, true);
  a.match(JSON.stringify(stale.content), /changed since you read it/);
  const bad = await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Bad', changes: [{ type: 'text', nodeId: 'nope', value: 'x' }] } });
  a.match(JSON.stringify(bad.content), /no element \\"nope\\"/);

  const filed = await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Clearer welcome', summary: 'Say what the site is for.',
    changes: [{ type: 'text', nodeId: 'h1', value: 'Workshops for everyone' }, { type: 'property', nodeId: 'inst', property: 'title', value: 'Pottery' }],
  } });
  a.notEqual(filed.isError, true, JSON.stringify(filed.content));
  const result = filed.structuredContent as any;
  a.equal(result.proposal.status, 'pending');
  a.match(result.reviewUrl, new RegExp(`/edit/${r.site.id}\\?proposal=${result.proposal.id}`));
  // The draft is untouched until the owner applies it.
  a.equal(((await r.store.byId(r.site.id))!.doc.pages[0].tree[0].children[0].props as { text: string }).text, 'Welcome');
  const notices = await r.reviews.notices(r.owner.id);
  a.match(notices[0].title, /Claude Code proposed changes to Acme/);
  const status = (await mcp.callTool({ name: 'pagecraft_get_proposal', arguments: { proposalId: result.proposal.id } })).structuredContent as any;
  a.equal(status.proposal.status, 'pending');
  await mcp.close();
});

test('a token is for its own site, and stops working when its maker is no longer the owner', async () => {
  const r = await rig();
  const token = await r.newAssistantToken();
  const mcp = await r.mcpFor(token);
  const outline = (await mcp.callTool({ name: 'pagecraft_site', arguments: {} })).structuredContent as any;
  a.equal(outline.site.id, r.site.id);
  a.equal((await mcp.callTool({ name: 'pagecraft_get_page', arguments: { pageId: r.other.doc.pages[0].id } })).isError, true, 'another site’s page is not there');
  await mcp.close();
  await r.auth.revoke(r.site.id, r.owner.id);
  const refused = await r.app.request(new Request('http://admin.test/mcp', {
    method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    headers: { host: 'admin.test', authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
  }));
  a.equal(refused.status, 401);
});

test('the editor lists proposals with previews, and each is decided once', async () => {
  const r = await rig();
  const mcp = await r.mcpFor(await r.newAssistantToken());
  const filed = (await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Clearer welcome', changes: [{ type: 'text', nodeId: 'h1', value: 'Workshops for everyone' }],
  } })).structuredContent as any;
  await mcp.close();

  a.equal((await r.call(`/api/sites/${r.site.id}/proposals`, { cookie: r.editorCookie })).status, 403, 'owners only');
  const list = await (await r.call(`/api/sites/${r.site.id}/proposals?status=pending`)).json() as any;
  a.equal(list.proposals.length, 1);
  const [p] = list.proposals;
  a.deepEqual(p.previews.map((v: { path: string }) => v.path), ['index.html']);
  a.equal(p.changes[0].before, 'Welcome');

  const after = await (await r.call(`/api/sites/${r.site.id}/proposals/${p.id}/preview/index.html`)).text();
  a.match(after, /Workshops for everyone/);
  const before = await (await r.call(`/api/sites/${r.site.id}/proposals/${p.id}/preview/index.html?before=1`)).text();
  a.match(before, /Welcome/);
  a.doesNotMatch(before, /Workshops for everyone/);

  const decided = await r.call(`/api/sites/${r.site.id}/proposals/${filed.proposal.id}/decision`, { method: 'POST', json: { status: 'applied', version: 9 } });
  a.equal(decided.status, 200);
  a.equal(((await decided.json()) as any).proposal.appliedVersion, 9);
  a.equal((await r.call(`/api/sites/${r.site.id}/proposals/${filed.proposal.id}/decision`, { method: 'POST', json: { status: 'declined' } })).status, 409);
});

test('the editor claims a proposal before applying it, once, and an abandoned claim can be taken again', async () => {
  const r = await rig();
  const mcp = await r.mcpFor(await r.newAssistantToken());
  const filed = (await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Add a card', changes: [{ type: 'insert', componentId: 'card', region: r.site.doc.pages[0].id }],
  } })).structuredContent as any;
  await mcp.close();
  const id = filed.proposal.id;
  const claim = (cookie?: string) => r.call(`/api/sites/${r.site.id}/proposals/${id}/claim`, { method: 'POST', json: {}, ...(cookie ? { cookie } : {}) });

  a.equal((await claim(r.editorCookie)).status, 403, 'owners only');
  const first = await claim();
  a.equal(first.status, 200);
  a.equal(((await first.json()) as any).proposal.status, 'applying');
  const second = await claim();
  a.equal(second.status, 409, 'a second tab or a second click is refused');
  a.match(((await second.json()) as any).detail, /already being applied/);
  a.equal((await r.call(`/api/sites/${r.site.id}/proposals/0123456789abcdef/claim`, { method: 'POST', json: {} })).status, 404);

  // A tab that closed mid-apply leaves its claim behind; ten minutes on, it can be taken again.
  await writeFile(join(r.assistants.dir(r.site.id), 'proposals', `${id}.claim`), String(Date.now() - CLAIM_TTL - 1000));
  a.equal((await claim()).status, 200);
  a.equal((await claim()).status, 409, 'and the new claim is single use too');

  const decided = await r.call(`/api/sites/${r.site.id}/proposals/${id}/decision`, { method: 'POST', json: { status: 'applied', version: 5 } });
  a.equal(decided.status, 200, 'applying → applied');
  a.equal(((await decided.json()) as any).proposal.status, 'applied');
  a.equal((await claim()).status, 409, 'an applied proposal cannot be claimed again');

  // And the preview of an applied insert does not show it twice.
  const listed = await (await r.call(`/api/sites/${r.site.id}/proposals`)).json() as any;
  a.equal(listed.proposals[0].status, 'applied');
});
