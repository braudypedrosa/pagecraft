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
import { FileAssistantStore } from '../src/assistants.ts';
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
  const call = (path: string, init: { method?: string; body?: string; json?: unknown; cookie?: string; origin?: string } = {}) => app.request(new Request(`http://admin.test${path}`, {
    method: init.method || 'GET',
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    headers: {
      host: 'admin.test', origin: init.origin ?? 'http://admin.test', cookie: init.cookie ?? ownerCookie,
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
  return { app, store, auth, assets, assistants, reviews, site, other, owner, editor, image, call, editorCookie, mcpFor, newAssistantToken };
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

test('an authenticated assistant request is bounded before a proposal tool can run', async () => {
  const r = await rig();
  const token = await r.newAssistantToken();
  const post = (body: BodyInit) => r.app.request(new Request('http://admin.test/mcp', {
    method: 'POST', body,
    headers: {
      host: 'admin.test', authorization: `Bearer ${token}`,
      'content-type': 'application/json', accept: 'application/json, text/event-stream',
    },
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit & { duplex?: 'half' }));
  const toolCall = (args: Record<string, unknown>) => ({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'pagecraft_propose_changes', arguments: args },
  });
  const validChange = {
    baseVersion: r.site.version, title: 'Bounded request',
    changes: [{ type: 'text', nodeId: 'h1', value: 'Still unchanged' }],
  };

  const oversizedText = JSON.stringify(toolCall({ ...validChange, note: '🙂'.repeat(250_000) }));
  const bytes = new TextEncoder().encode(oversizedText);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 500_000));
      controller.enqueue(bytes.slice(500_000));
      controller.close();
    },
  });
  const oversized = await post(stream);
  a.equal(oversized.status, 413);
  a.match(await oversized.text(), /must not exceed 1000000 bytes/);

  const tooMany = await post(JSON.stringify(toolCall({
    ...validChange,
    values: Object.fromEntries(Array.from({ length: 10_001 }, (_, index) => [`field${index}`, index])),
  })));
  a.equal(tooMany.status, 200);
  a.match(await tooMany.text(), /more than the maximum of 10000 elements/);
  a.deepEqual(await r.assistants.proposals(r.site.id), [], 'neither rejected request reached the proposal callback');

  const mcp = await r.mcpFor(token);
  a.equal((await mcp.callTool({ name: 'pagecraft_site', arguments: {} })).isError, undefined,
    'the same authenticated endpoint still accepts a normal request');
  await mcp.close();
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

  const url = `/api/sites/${r.site.id}/proposals/${filed.proposal.id}`;
  a.equal((await r.call(url + '/decision', { method: 'POST', json: { status: 'applied', version: 9 } })).status, 400);
  a.equal((await r.call(url + '/claim', { method: 'POST', json: {} })).status, 409);
  a.equal((await r.call(url + '/apply', { method: 'POST', json: { version: 9 } })).status, 409);
  a.equal((await r.call(url + '/apply', { method: 'POST', json: { version: r.site.version }, cookie: r.editorCookie })).status, 403);
  a.equal((await r.call(url + '/apply', { method: 'POST', json: { version: r.site.version }, origin: 'https://foreign.example.test' })).status, 403);
  const apply = () => r.call(url + '/apply', { method: 'POST', json: { version: r.site.version } });
  const applied = await apply();
  a.equal(applied.status, 200);
  const result = await applied.json() as any;
  a.equal(result.proposal.appliedVersion, r.site.version + 1);
  a.equal(result.draft.version, result.proposal.appliedVersion);
  a.equal((await r.store.byId(r.site.id))!.doc.pages[0].tree[0].children[0].props.text, 'Workshops for everyone');
  a.deepEqual(await (await apply()).json(), result, 'retries return the same saved revision');
  a.equal((await r.call(url + '/decision', { method: 'POST', json: { status: 'declined' } })).status, 409);
  const saved = (await r.store.byId(r.site.id))!;
  a.equal(saved.version, r.site.version + 1);
  a.equal(saved.publishedReleaseId, null);
  a.equal(saved.publishedPublicationId, null);
});

test('a moved target invalidates the whole preview and owner apply on the next draft version', async () => {
  const r = await rig();
  const mcp = await r.mcpFor(await r.newAssistantToken());
  const { proposal } = (await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Clearer welcome', changes: [{ type: 'text', nodeId: 'h1', value: 'Workshops for everyone' }],
  } })).structuredContent as any;
  await mcp.close();
  const doc = structuredClone(r.site.doc);
  const home = doc.pages[0];
  doc.pages.push({ id: 'work', name: 'Work', slug: 'work', title: '', desc: '', tree: home.tree.splice(0) });
  const save = await r.call(`/api/sites/${r.site.id}`, { method: 'PUT', json: { doc, version: r.site.version } });
  a.equal(save.status, 200);
  const path = `/api/sites/${r.site.id}/proposals`;
  const listed = await (await r.call(path)).json() as any;
  a.deepEqual(listed.proposals[0].previews, []);
  a.match(listed.proposals[0].reviewIssue, /saved draft changed/);
  a.equal((await r.call(path + `/${proposal.id}/preview/index.html?version=${r.site.version}`)).status, 409);
  a.equal((await r.call(path + `/${proposal.id}/apply`, { method: 'POST', json: { version: r.site.version } })).status, 409);
  const latest = await r.store.byId(r.site.id);
  a.equal(latest?.version, r.site.version + 1);
  a.equal(latest?.doc.pages[1].tree[0].children[0].props.text, 'Welcome');
});

test('owner apply survives an interrupted save response and refuses a concurrent decline', async () => {
  const r = await rig();
  const mcp = await r.mcpFor(await r.newAssistantToken());
  const { proposal } = (await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Add a card', changes: [{ type: 'insert', componentId: 'card', region: r.site.doc.pages[0].id }],
  } })).structuredContent as any;
  const path = `/api/sites/${r.site.id}/proposals/${proposal.id}`;
  const save = r.store.save.bind(r.store);
  let enter!: () => void, leave!: () => void;
  const started = new Promise<void>(resolve => { enter = resolve; });
  const release = new Promise<void>(resolve => { leave = resolve; });
  r.store.save = async (...args) => {
    enter();
    await release;
    await save(...args);
    // The route receives a success acknowledgement without access to its revision readback.
    return { ok: true };
  };
  const revision = r.store.revision.bind(r.store);
  let revisionAvailable = false;
  r.store.revision = async (...args) => revisionAvailable ? revision(...args) : null;
  const apply = () => r.call(path + '/apply', { method: 'POST', json: { version: r.site.version } });
  const first = apply();
  await started;
  try {
    const declined = await r.call(path + '/decision', { method: 'POST', json: { status: 'declined' } });
    a.equal(declined.status, 409);
    a.equal((await apply()).status, 409);
  } finally {
    leave();
  }
  a.equal((await first).status, 503);
  a.equal((await r.assistants.proposal(r.site.id, proposal.id))?.status, 'applying');
  revisionAvailable = true;
  const recovered = await apply();
  a.equal(recovered.status, 200);
  a.equal(((await recovered.json()) as any).proposal.status, 'applied');
  a.equal((await r.store.byId(r.site.id))?.version, r.site.version + 1);
  const current = (await mcp.callTool({ name: 'pagecraft_get_page', arguments: { pageId: r.site.doc.pages[0].id } })).structuredContent as any;
  a.equal(current.elements.filter((n: any) => n.component?.id === 'card').length, 2, 'one existing and one inserted');
  await mcp.close();
});

test('an expired apply worker cannot save after a decline wins', async () => {
  const r = await rig();
  const mcp = await r.mcpFor(await r.newAssistantToken());
  const { proposal } = (await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Clarify welcome', changes: [{ type: 'text', nodeId: 'h1', value: 'Join the workshop' }],
  } })).structuredContent as any;
  await mcp.close();
  let enter!: () => void, leave!: () => void;
  const started = new Promise<void>(resolve => { enter = resolve; });
  const release = new Promise<void>(resolve => { leave = resolve; });
  const list = r.assets.list.bind(r.assets);
  r.assets.list = async id => { enter(); await release; return list(id); };
  const path = `/api/sites/${r.site.id}/proposals/${proposal.id}`;
  const interrupted = r.call(path + '/apply', { method: 'POST', json: { version: r.site.version } });
  await started;
  try {
    await writeFile(join(r.assistants.dir(r.site.id), 'proposals', proposal.id + '.decision.0'), JSON.stringify({ at: 0 }));
    a.equal((await r.call(path + '/decision', { method: 'POST', json: { status: 'declined' } })).status, 200);
  } finally {
    leave();
  }
  a.equal((await interrupted).status, 409);
  a.equal((await r.assistants.proposal(r.site.id, proposal.id))?.status, 'declined');
  a.equal((await r.store.byId(r.site.id))?.version, r.site.version);
});

test('an unrelated identical revision cannot confirm a failed proposal attempt', async () => {
  const r = await rig();
  const mcp = await r.mcpFor(await r.newAssistantToken());
  const { proposal } = (await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version, title: 'Clarify welcome', changes: [{ type: 'text', nodeId: 'h1', value: 'Join the workshop' }],
  } })).structuredContent as any;
  await mcp.close();
  const originalSave = r.store.save.bind(r.store);
  let candidate: Parameters<typeof originalSave>[1] | undefined;
  r.store.save = async (_id, doc) => { candidate = doc; throw new Error('fixture interrupted before committing'); };
  const path = `/api/sites/${r.site.id}/proposals/${proposal.id}`;
  const apply = () => r.call(path + '/apply', { method: 'POST', json: { version: r.site.version } });
  a.equal((await apply()).status, 500);
  a.ok(candidate);
  a.equal((await originalSave(r.site.id, candidate, r.site.version, r.owner.id)).ok, true);
  r.store.save = originalSave;
  a.equal((await apply()).status, 409);
  a.notEqual((await r.assistants.proposal(r.site.id, proposal.id))?.status, 'applied');
  a.equal((await r.call(path + '/decision', { method: 'POST', json: { status: 'declined' } })).status, 200);
});

test('assistant proposals and content saves reject effective form routing changes but allow ordinary copy', async () => {
  const r = await rig();
  const doc = structuredClone(r.site.doc);
  doc.meta.components!.push({
    id: 'form-card', name: 'Inquiry form',
    props: [{ k: 'endpoint', label: 'Where submissions go', t: 'text', def: '' }],
    node: node('form-def', 'form', { action: '', method: 'post' }, { bind: { action: { src: 'prop', path: 'endpoint' } } }),
  });
  doc.pages[0].tree[0].children.push(node('inquiry', 'form', {}, { use: 'form-card' }));
  const sitePath = `/api/sites/${r.site.id}`;
  a.equal((await r.call(sitePath, { method: 'PUT', json: { doc, version: r.site.version } })).status, 200);
  const mcp = await r.mcpFor(await r.newAssistantToken());
  const value = 'https://receiver.example.test/inquiries';
  const result = await mcp.callTool({ name: 'pagecraft_propose_changes', arguments: {
    baseVersion: r.site.version + 1, title: 'Update inquiry destination',
    changes: [{ type: 'property', nodeId: 'inquiry', property: 'endpoint', value }],
  } });
  a.equal(result.isError, true);
  a.match(JSON.stringify(result.content), /where a form submits/);
  a.deepEqual(await r.assistants.proposals(r.site.id), []);
  const rerouted = structuredClone(doc);
  rerouted.pages[0].tree[0].children.at(-1)!.vals = { endpoint: value };
  a.equal((await r.call(sitePath, { method: 'PUT', cookie: r.editorCookie, json: {
    doc: rerouted, version: r.site.version + 1,
  } })).status, 403);
  doc.pages[0].tree[0].children[0].props.text = 'Workshop timetable';
  a.equal((await r.call(sitePath, { method: 'PUT', cookie: r.editorCookie, json: {
    doc, version: r.site.version + 1,
  } })).status, 200);
  a.equal((await r.call(sitePath, { method: 'PUT', json: { doc: rerouted, version: r.site.version + 2 } })).status, 200, 'the owner retains direct routing control');
  await mcp.close();
});
