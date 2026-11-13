import { test } from 'vitest';
import a from 'node:assert/strict';
import { assistantMcpResponse, type AssistantMcpContext } from '../src/assistant-mcp.ts';
import { createApp } from '../src/app.ts';
import { MemoryAssetStore } from '../src/assets.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { pagecraftMcpResponse, type PagecraftIntegrationRead } from '../src/integrations.ts';
import { blankDoc } from '../src/render.ts';
import { MemoryStore } from '../src/store.ts';

const headers = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
};

const request = (body: unknown) => new Request('https://admin.test/mcp', {
  method: 'POST', headers, body: JSON.stringify(body),
});

const streamedRequest = (body: string) => new Request('https://admin.test/mcp', {
  method: 'POST', headers,
  body: new ReadableStream({
    start(controller) {
      const bytes = new TextEncoder().encode(body);
      const midpoint = Math.floor(bytes.length / 2);
      controller.enqueue(bytes.slice(0, midpoint));
      controller.enqueue(bytes.slice(midpoint));
      controller.close();
    },
  }),
  // Node requires this for a streamed request body; browsers ignore it.
  duplex: 'half',
} as RequestInit & { duplex: 'half' });

const projectsCall = (id: number) => ({
  jsonrpc: '2.0', id, method: 'tools/call',
  params: { name: 'pagecraft_list_projects', arguments: {} },
});

const readFor = (ownerId: string): PagecraftIntegrationRead => ({
  ownerId,
  sites: [{
    id: `site-${ownerId}`, host: `${ownerId}.test`, name: ownerId, slug: ownerId,
    version: 1, publishedVersion: 0, publishedReleaseId: null, publishedPublicationId: null,
    updatedAt: '2026-10-21T00:00:00.000Z', doc: blankDoc(ownerId),
  }],
});

const assistantContext = (onOutline = () => {}) => ({
  site: { id: 'site-assistant', name: 'Assistant', version: 1 }, tokenName: 'test-token',
  outline() { onOutline(); return { site: { id: 'site-assistant' } }; },
  region: () => null,
  propose: async () => ({ ok: false as const, problems: ['not used'] }),
  proposals: async () => [], proposal: async () => null,
  reviewUrl: () => 'https://admin.test/review',
} satisfies AssistantMcpContext);

test('MCP 2.3 keeps same-id HTTP clients isolated and accepts later requests', async () => {
  const [alpha, beta] = await Promise.all([
    pagecraftMcpResponse(request(projectsCall(1)), readFor('alpha')),
    pagecraftMcpResponse(request(projectsCall(1)), readFor('beta')),
  ]);
  const [alphaText, betaText] = await Promise.all([alpha.text(), beta.text()]);

  a.equal(alpha.status, 200);
  a.equal(beta.status, 200);
  a.match(alphaText, /site-alpha/);
  a.doesNotMatch(alphaText, /site-beta/);
  a.match(betaText, /site-beta/);
  a.doesNotMatch(betaText, /site-alpha/);

  const later = await pagecraftMcpResponse(request(projectsCall(2)), readFor('alpha'));
  a.equal(later.status, 200);
  a.match(await later.text(), /site-alpha/);
});

test('MCP 2.3 rejects an invalid JSON-RPC batch before dispatch', async () => {
  const response = await pagecraftMcpResponse(request([projectsCall(1), null]), readFor('alpha'));
  a.equal(response.status, 400);
  a.match(await response.text(), /JSON-RPC batch contains an invalid message/);
});

test('unauthenticated HTTP requests are rejected before malformed MCP input is parsed', async () => {
  const app = createApp({
    store: new MemoryStore(), auth: new MemoryAuthStore(), assets: new MemoryAssetStore(),
    editorHost: 'admin.test', editorOrigin: 'https://admin.test', editorHtml: '<title>Builder</title>',
  });
  const response = await app.request(new Request('https://admin.test/mcp', {
    method: 'POST', headers: { host: 'admin.test', 'content-type': 'application/json' }, body: '{',
  }));
  a.equal(response.status, 401);
  a.equal((await response.json() as { error: string }).error, 'invalid_token');
});

test('both authenticated MCP handlers reject a streamed UTF-8 body over 1 MB before tool dispatch', async () => {
  const oversized = JSON.stringify({
    ...projectsCall(1), params: { name: 'pagecraft_list_projects', arguments: { value: '🙂'.repeat(250_000) } },
  });
  a.ok(oversized.length < 1_000_000, 'the character count alone is below the byte limit');
  a.ok(new TextEncoder().encode(oversized).byteLength > 1_000_000, 'the UTF-8 byte count crosses the limit');

  let integrationCalls = 0;
  const integrationRead = { ownerId: 'alpha' } as PagecraftIntegrationRead;
  Object.defineProperty(integrationRead, 'sites', {
    get() { integrationCalls++; return readFor('alpha').sites; },
  });
  let assistantCalls = 0;
  const responses = await Promise.all([
    pagecraftMcpResponse(streamedRequest(oversized), integrationRead),
    assistantMcpResponse(streamedRequest(oversized), assistantContext(() => assistantCalls++)),
  ]);
  for (const response of responses) {
    a.equal(response.status, 413);
    a.match(await response.text(), /must not exceed 1000000 bytes/);
  }
  a.equal(integrationCalls, 0);
  a.equal(assistantCalls, 0);
});

test('both MCP handlers reject excessive argument elements before calling a tool', async () => {
  const argumentsWithTooManyElements = Object.fromEntries(
    Array.from({ length: 10_001 }, (_, index) => [`field${index}`, index]),
  );
  const call = {
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'pagecraft_list_projects', arguments: argumentsWithTooManyElements },
  };
  let integrationCalls = 0;
  const integrationRead = { ownerId: 'alpha' } as PagecraftIntegrationRead;
  Object.defineProperty(integrationRead, 'sites', {
    get() { integrationCalls++; return readFor('alpha').sites; },
  });
  let assistantCalls = 0;
  const assistantCall = { ...call, params: { ...call.params, name: 'pagecraft_site' } };
  const responses = await Promise.all([
    pagecraftMcpResponse(request(call), integrationRead),
    assistantMcpResponse(request(assistantCall), assistantContext(() => assistantCalls++)),
  ]);
  for (const response of responses) {
    a.equal(response.status, 200);
    a.match(await response.text(), /more than the maximum of 10000 elements/);
  }
  a.equal(integrationCalls, 0);
  a.equal(assistantCalls, 0);
});
