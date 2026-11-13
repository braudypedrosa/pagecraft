import a from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { test } from 'vitest';
import { assistantMcpResponse, type AssistantMcpContext } from '../src/assistant-mcp.ts';

test('assistant MCP rejects unknown proposal fields before any part of the batch is dispatched', async () => {
  const dispatched: Parameters<AssistantMcpContext['propose']>[0][] = [];
  const context: AssistantMcpContext = {
    site: { id: 'harbor', name: 'Harbor Studio', version: 3 },
    tokenName: 'Review fixture',
    outline: () => ({}),
    region: () => null,
    async propose(input) {
      dispatched.push(input);
      return { ok: false, problems: ['The proposal reached the draft validator.'] };
    },
    proposals: async () => [],
    proposal: async () => null,
    reviewUrl: () => 'https://editor.test/review',
  };
  const client = new Client({ name: 'Protocol Check', version: '1.0.0' });
  const endpoint = new URL('https://editor.test/mcp');
  await client.connect(new StreamableHTTPClientTransport(endpoint, {
    fetch: async (input, init) => assistantMcpResponse(new Request(input, init), context),
  }));
  try {
    const changes = [
      { type: 'text', nodeId: 'heading', value: 'Harbor Studio' },
      { type: 'image', nodeId: 'photo', assetId: 'harbor-photo' },
      { type: 'property', nodeId: 'card', property: 'headline', value: 'Selected work' },
      { type: 'insert', componentId: 'card', region: 'work', values: { headline: 'Selected work' } },
    ];
    const proposal = { baseVersion: 3, title: 'Update Harbor Studio', changes };
    const submit = (args: Record<string, unknown>) => client.callTool({
      name: 'pagecraft_propose_changes', arguments: args,
    });
    const expectError = async (args: Record<string, unknown>, message: RegExp) => {
      const result = await submit(args);
      const content = result.content?.[0];
      a.equal(result.isError, true);
      a.ok(content?.type === 'text');
      a.match(content.text, message);
    };

    await expectError({ ...proposal, publish: true }, /unrecognized key.*publish/i);
    for (const index of changes.keys()) {
      const malformed = changes.map((change, i) => i === index ? { ...change, style: { color: 'red' } } : change);
      await expectError({ ...proposal, changes: malformed }, new RegExp(`changes\\.${index}: unrecognized key.*style`, 'i'));
    }
    a.deepEqual(dispatched, [], 'A malformed batch never reaches the draft validator.');

    await expectError(proposal, /The proposal reached the draft validator/);
    a.deepEqual(dispatched, [{ ...proposal, summary: '' }]);
  } finally {
    await client.close();
  }
});
