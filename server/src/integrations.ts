import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { Site } from "./store.ts";

export const PAGECRAFT_INTEGRATION_SCOPES = [
  "projects:read",
  "packages:read",
] as const;

export interface PagecraftIntegrationRead {
  ownerId: string;
  sites: Site[];
}

const pageName = (page: Site["doc"]["pages"][number]) =>
  page.name || page.title || "Untitled page";

const textResult = (value: Record<string, unknown>) => ({
  content: [{
    type: "text" as const,
    text: JSON.stringify(value, null, 2),
  }],
  structuredContent: value,
});

const errorResult = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

export const integrationDiscovery = (origin: string) => ({
  version: "2026-08-31",
  authorization: {
    type: "oauth2-authorization-code-pkce",
    authorizationEndpoint: `${origin}/v1/integrations/wordpress/authorize`,
    tokenEndpoint: `${origin}/v1/integrations/wordpress/token`,
    revocationEndpoint: `${origin}/v1/integrations/wordpress/revoke`,
    scopesSupported: PAGECRAFT_INTEGRATION_SCOPES,
  },
  wordpress: {
    catalogEndpoint: `${origin}/v1/integrations/wordpress/catalog`,
    projectPackageEndpoint:
      `${origin}/v1/integrations/wordpress/projects/{projectId}/package`,
    pagePackageEndpoint:
      `${origin}/v1/integrations/wordpress/projects/{projectId}/pages/{pageId}/package`,
    ownership: "wordpress-copy",
    synchronization: "manual",
  },
  mcp: {
    endpoint: `${origin}/mcp`,
    transport: "streamable-http",
    scopesRequired: ["projects:read"],
    tools: [
      "pagecraft_list_projects",
      "pagecraft_list_pages",
      "pagecraft_get_page",
    ],
  },
});

function pagecraftMcpServer(read: PagecraftIntegrationRead) {
  const server = new McpServer({
    name: "pagecraft",
    version: "0.1.0",
  }, {
    capabilities: { tools: {} },
  });

  server.registerTool(
    "pagecraft_list_projects",
    {
      description: "List the Pagecraft projects owned by the connected account.",
      inputSchema: z.object({}),
    },
    async () => textResult({
      projects: read.sites.map((site) => ({
        id: site.id,
        name: site.name,
        pageCount: site.doc.pages.length,
        sourceVersion: site.version,
        modifiedAt: site.updatedAt,
      })),
    }),
  );

  server.registerTool(
    "pagecraft_list_pages",
    {
      description: "List the pages in one Pagecraft project.",
      inputSchema: z.object({
        projectId: z.string().min(1).describe("Pagecraft project ID"),
      }),
    },
    async ({ projectId }) => {
      const site = read.sites.find((item) => item.id === projectId);
      if (!site) return errorResult("Project not found or not owned by this account.");
      return textResult({
        project: {
          id: site.id,
          name: site.name,
          sourceVersion: site.version,
        },
        pages: site.doc.pages.map((page) => ({
          id: page.id,
          name: pageName(page),
          slug: page.slug,
        })),
      });
    },
  );

  server.registerTool(
    "pagecraft_get_page",
    {
      description:
        "Read one Pagecraft page document. This tool never changes Pagecraft or WordPress.",
      inputSchema: z.object({
        projectId: z.string().min(1).describe("Pagecraft project ID"),
        pageId: z.string().min(1).describe("Pagecraft page ID"),
      }),
    },
    async ({ projectId, pageId }) => {
      const site = read.sites.find((item) => item.id === projectId);
      if (!site) return errorResult("Project not found or not owned by this account.");
      const page = site.doc.pages.find((item) => item.id === pageId);
      if (!page) return errorResult("Page not found in this project.");
      return textResult({
        project: {
          id: site.id,
          name: site.name,
          sourceVersion: site.version,
        },
        page: structuredClone(page) as unknown as Record<string, unknown>,
      });
    },
  );

  return server;
}

export async function pagecraftMcpResponse(
  request: Request,
  read: PagecraftIntegrationRead,
): Promise<Response> {
  const handler = createMcpHandler(
    () => pagecraftMcpServer(read),
    { responseMode: "json" },
  );
  return handler.fetch(request, {
    authInfo: {
      token: "verified-pagecraft-integration-token",
      clientId: read.ownerId,
      scopes: [...PAGECRAFT_INTEGRATION_SCOPES],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    },
  });
}
