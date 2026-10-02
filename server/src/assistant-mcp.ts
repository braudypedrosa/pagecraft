/* The MCP tools an assistant token gets (Phase 7). Read one site, and file proposals for its owner
   to review in the editor. Nothing here writes the site: a proposal is a request, applied by a
   person. The read-only WordPress import credential keeps its own three tools (integrations.ts)
   and gains none of these. See docs/phase7-assistant-proposals-design.md. */
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { Proposal } from "./assistants.ts";

export interface AssistantMcpContext {
  site: { id: string; name: string; version: number };
  tokenName: string;
  /** pages, regions, components and images */
  outline(): Record<string, unknown>;
  /** one page, or `header` / `footer`, as elements; null when there is no such region */
  region(id: string): Record<string, unknown> | null;
  propose(input: { baseVersion: number; title: string; summary: string; changes: unknown[] }):
    Promise<{ ok: true; proposal: Proposal } | { ok: false; problems: string[] }>;
  proposals(): Promise<Proposal[]>;
  proposal(id: string): Promise<Proposal | null>;
  reviewUrl(proposal: Proposal): string;
}

const result = (value: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});
const failure = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

const summary = (p: Proposal) => ({
  id: p.id, title: p.title, status: p.status, createdAt: p.createdAt, decidedAt: p.decidedAt,
  changes: p.changes.length, baseVersion: p.baseVersion,
});

const change = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    nodeId: z.string().describe("an element id from pagecraft_get_page"),
    slot: z.string().optional().describe("which text, e.g. text, alt, caption or items.0.label; defaults to the element's first"),
    value: z.string().describe("plain text; rich text is turned into paragraphs, and markup is shown literally"),
  }),
  z.object({
    type: z.literal("image"),
    nodeId: z.string(),
    slot: z.string().optional().describe("defaults to the element's main image"),
    assetId: z.string().describe("an image id from pagecraft_site; new images cannot be uploaded"),
  }),
  z.object({
    type: z.literal("property"),
    nodeId: z.string().describe("a component instance's element id"),
    property: z.string().describe("a property key from that component in pagecraft_site"),
    value: z.string(),
  }),
  z.object({
    type: z.literal("insert"),
    componentId: z.string().describe("an existing component from pagecraft_site"),
    region: z.string().describe("a page id, or header / footer"),
    parentId: z.string().optional().describe("an element whose canHold includes the component; omit to add at the region's top level"),
    index: z.number().int().min(0).optional().describe("position among the parent's children; defaults to the end"),
    values: z.record(z.string(), z.string()).optional().describe("property values for the new instance"),
  }),
]);

function assistantServer(ctx: AssistantMcpContext) {
  const server = new McpServer({ name: "pagecraft-assistant", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.registerTool("pagecraft_site", {
    description: `Start here. Read the outline of the Pagecraft site “${ctx.site.name}”: its pages, the header and footer, the components you can place and their properties, and the images you can use. Includes the version to send with a proposal.`,
    inputSchema: z.object({}),
  }, async () => result(ctx.outline()));

  server.registerTool("pagecraft_get_page", {
    description: "Read one page (by id), or the header or footer, as a list of elements with their ids, text and images by slot, component values, and which components each element can hold. Use these ids in a proposal.",
    inputSchema: z.object({ pageId: z.string().min(1).describe("a page id from pagecraft_site, or header / footer") }),
  }, async ({ pageId }) => {
    const region = ctx.region(pageId);
    return region ? result(region) : failure(`There is no page "${pageId}". Use a page id from pagecraft_site, or header / footer.`);
  });

  server.registerTool("pagecraft_propose_changes", {
    description: "Propose changes for the site's owner to review and apply in the Pagecraft editor. Nothing changes until they do. A proposal can change text, swap in one of the site's existing images, set a component instance's properties, and add instances of existing components. It cannot change layout, styles, code, settings or people, and it cannot publish. Send the version you read; if the site changed since, read it again.",
    inputSchema: z.object({
      baseVersion: z.number().int().describe("the version from pagecraft_site or pagecraft_get_page"),
      title: z.string().min(1).max(120).describe("a short title the owner sees, e.g. “Clearer workshop copy”"),
      summary: z.string().max(2000).optional().describe("why, in a sentence or two"),
      changes: z.array(change).min(1).max(50),
    }),
  }, async (input) => {
    const filed = await ctx.propose({ baseVersion: input.baseVersion, title: input.title, summary: input.summary || "", changes: input.changes });
    if (!filed.ok) return failure(`The proposal was not filed:\n- ${filed.problems.join("\n- ")}`);
    return result({
      proposal: summary(filed.proposal),
      changes: filed.proposal.changes.map((c) => c.label),
      reviewUrl: ctx.reviewUrl(filed.proposal),
      next: "The site's owner reviews it in the Pagecraft editor and applies or declines it. Check with pagecraft_get_proposal.",
    });
  });

  server.registerTool("pagecraft_get_proposal", {
    description: "See whether one of your proposals is still waiting, was applied, or was declined.",
    inputSchema: z.object({ proposalId: z.string().min(1) }),
  }, async ({ proposalId }) => {
    const p = await ctx.proposal(proposalId);
    return p ? result({ proposal: summary(p), changes: p.changes.map((c) => c.label) }) : failure("There is no such proposal for this site.");
  });

  server.registerTool("pagecraft_list_proposals", {
    description: "List recent proposals for this site, newest first, with their status.",
    inputSchema: z.object({}),
  }, async () => result({ proposals: (await ctx.proposals()).slice(0, 25).map(summary) }));

  return server;
}

export function assistantMcpResponse(request: Request, ctx: AssistantMcpContext) {
  const handler = createMcpHandler(() => assistantServer(ctx), { responseMode: "json" });
  return handler.fetch(request, {
    authInfo: {
      token: "verified-pagecraft-assistant-token",
      clientId: ctx.tokenName,
      scopes: ["site:read", "proposals:write"],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    },
  });
}
