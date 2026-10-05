/* Assistant proposals (Phase 7): the owner's token page, the editor's proposal API and previews,
   and the MCP context an assistant token gets. See docs/phase7-assistant-proposals-design.md.

   The core is used synchronously, the way renderSite uses it: restore a copy of the draft, read
   or apply, take what is needed, all before the next await. */
import type { Context, Hono } from 'hono';
import * as Core from '../../app/src/core/index.ts';
import type { Doc } from '../../app/src/core/types.ts';
import type { AssetRecord, AssetStore } from './assets.ts';
import type { AuthStore, Role, User } from './auth.ts';
import type { PublicationReviewStore } from './reviews.ts';
import type { Site, Store } from './store.ts';
import { throttle } from './mail.ts';
import { AssistantLimitError, ASSISTANT_LIMITS, type FileAssistantStore, type Proposal } from './assistants.ts';
import type { AssistantMcpContext } from './assistant-mcp.ts';
import { siteAssistantsPage } from './account-pages.ts';

type Gate = { ok: true; user: User; role: Role } | { ok: false; status: 401 | 403 | 404 };
export interface AssistantDeps {
  store: Store;
  auth: AuthStore;
  assets?: AssetStore;
  assistants?: FileAssistantStore;
  reviews: PublicationReviewStore;
  editorOrigin?: string;
  allowed(c: Context, id: string, verb: 'read' | 'write' | 'admin'): Promise<Gate>;
  render(doc: Doc, assets: AssetRecord[]): { files: Map<string, string> } | null;
  assetHeaders(asset: { type: string; name: string }): Record<string, string>;
}

/** Load a draft into the core. Callers must finish with the core before their next await. */
const load = (doc: Doc) => { Core.restore(structuredClone(doc) as never); };
const snapshot = () => structuredClone(Core.doc()) as Doc;

/** The draft with the proposal's still-applicable changes written in, for previews. An insert
    already in the draft is skipped, so an applied proposal does not preview it twice. */
function withProposal(doc: Doc, proposal: Proposal) {
  load(doc);
  Core.proposalApply(proposal.changes, proposal.id);
  return snapshot();
}

/** Which rendered file shows a region: the page itself, or the front page for header and footer. */
function previewPaths(doc: Doc, regions: string[]) {
  load(doc);
  const targets = Core.exportTargets() as { pg: { id: string; name: string }; path: string; item?: unknown; pageNo?: number }[];
  const pages = targets.filter(t => !t.item && (t.pageNo || 1) === 1);
  const front = pages.find(t => t.path === 'index.html') || pages[0];
  return regions.map(region => {
    const target = region === 'header' || region === 'footer' ? front : pages.find(t => t.pg.id === region);
    const label = region === 'header' ? 'Header' : region === 'footer' ? 'Footer' : target?.pg.name || 'Page';
    return target ? { region, label, path: target.path } : null;
  }).filter(Boolean) as { region: string; label: string; path: string }[];
}

export function assistantRoutes(app: Hono, d: AssistantDeps) {
  const origin = (c: Context) => d.editorOrigin || new URL(c.req.url).origin;
  const owner = async (c: Context) => {
    // Owners in the browser only: an integration or assistant credential never manages these.
    if (c.req.header('authorization') || c.req.header('x-pagecraft-editor-session')) return { ok: false as const, status: 403 as const };
    return d.allowed(c, c.req.param('id')!, 'admin');
  };
  const pageFor = async (c: Context, user: User, site: Site, extra: { token?: string; error?: string; message?: string } = {}) => {
    const [tokens, proposals] = await Promise.all([d.assistants!.tokens(site.id), d.assistants!.proposals(site.id)]);
    c.header('cache-control', 'no-store');
    return c.html(siteAssistantsPage(user, { id: site.id, name: site.name, slug: site.slug }, {
      tokens, proposals: proposals.slice(0, 20), mcpUrl: `${origin(c)}/mcp`, editorUrl: `${origin(c)}/edit/${encodeURIComponent(site.id)}`, ...extra,
    }));
  };

  /* ---- the owner's page: tokens, and what assistants proposed ---- */
  app.get('/sites/:id/assistants', async c => {
    const gate = await owner(c);
    if (!gate.ok) return gate.status === 401 ? c.redirect(`/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`) : c.text('Access denied', gate.status);
    const site = await d.store.byId(c.req.param('id')!);
    if (!site) return c.notFound();
    if (!d.assistants) return c.text('Assistants are unavailable on this server.', 503);
    return pageFor(c, gate.user, site, { message: c.req.query('message') });
  });

  const creates = throttle(10, 60 * 60_000);
  app.post('/sites/:id/assistants/tokens', async c => {
    const gate = await owner(c);
    if (!gate.ok) return c.text('Access denied', gate.status === 401 ? 401 : gate.status);
    const site = await d.store.byId(c.req.param('id')!);
    if (!site || !d.assistants) return c.notFound();
    if (!creates.take(gate.user.id)) return pageFor(c, gate.user, site, { error: 'Too many tokens just now. Try again in an hour.' });
    const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
    try {
      const { token } = await d.assistants.createToken(site.id, String(form.name || ''), gate.user.id);
      // Shown once, in this response only: never in a URL, never stored in plain text.
      return pageFor(c, gate.user, site, { token });
    } catch (error) {
      if (error instanceof AssistantLimitError) return pageFor(c, gate.user, site, { error: error.message });
      throw error;
    }
  });

  app.post('/sites/:id/assistants/tokens/:token/revoke', async c => {
    const gate = await owner(c);
    if (!gate.ok) return c.text('Access denied', gate.status === 401 ? 401 : gate.status);
    if (!d.assistants) return c.notFound();
    const id = c.req.param('id')!;
    const revoked = await d.assistants.revokeToken(id, c.req.param('token')!);
    return c.redirect(`/sites/${encodeURIComponent(id)}/assistants?message=${encodeURIComponent(revoked ? 'Token revoked. Assistants using it can no longer read the site or propose changes.' : 'That token was already revoked.')}`, 303);
  });

  /* ---- the editor's API (owners only) ---- */
  const editorGate = async (c: Context) => {
    if (!d.assistants) return { ok: false as const, response: c.json({ error: 'assistants are unavailable' }, 503) };
    const gate = await d.allowed(c, c.req.param('id')!, 'admin');
    if (!gate.ok) return { ok: false as const, response: c.json({ error: gate.status === 401 ? 'sign in' : 'not allowed' }, gate.status) };
    const site = await d.store.byId(c.req.param('id')!);
    if (!site) return { ok: false as const, response: c.json({ error: 'not found' }, 404) };
    return { ok: true as const, gate, site, assistants: d.assistants };
  };

  app.get('/api/sites/:id/proposals', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    const all = await g.assistants.proposals(g.site.id);
    const status = c.req.query('status');
    const list = status ? all.filter(p => p.status === status) : all;
    return c.json({ proposals: list.slice(0, 50).map(p => ({ ...p, previews: previewPaths(g.site.doc, p.regions) })) });
  });

  /* The proposal applied to a copy of the draft, rendered the way the dashboard preview is: no
     scripts, images from this site. `?before=1` renders the draft as it is now. */
  app.get('/api/sites/:id/proposals/:proposal/preview/*', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    const proposal = await g.assistants.proposal(g.site.id, c.req.param('proposal')!);
    if (!proposal) return c.notFound();
    c.header('cache-control', 'private, no-store');
    c.header('x-robots-tag', 'noindex, nofollow');
    const prefix = `/api/sites/${encodeURIComponent(g.site.id)}/proposals/${proposal.id}/preview/`;
    const path = decodeURIComponent(new URL(c.req.url).pathname.slice(prefix.length));
    if (path.startsWith('assets/')) {
      const asset = await d.assets?.byPath(g.site.id, path);
      if (!asset) return c.notFound();
      return c.body(asset.bytes as unknown as ArrayBuffer, 200, d.assetHeaders(asset));
    }
    const assets = d.assets ? await d.assets.list(g.site.id) : [];
    const doc = c.req.query('before') === '1' ? g.site.doc : withProposal(g.site.doc, proposal);
    const html = d.render(doc, assets)?.files.get(path);
    if (!html || !/\.html$/.test(path)) return c.notFound();
    c.header('content-security-policy', "sandbox allow-same-origin; default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com data:; frame-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
    return c.html(html);
  });

  /* Claimed before the editor applies it: single use, so a second tab or a second click is told
     no instead of inserting the same instances again. */
  app.post('/api/sites/:id/proposals/:proposal/claim', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    const claimed = await g.assistants.claim(g.site.id, c.req.param('proposal')!, g.gate.user.id);
    if (!claimed) return c.json({ error: 'not found' }, 404);
    if (!claimed.ok) {
      return c.json({ error: 'claimed', detail: claimed.proposal.status === 'applying'
        ? 'This proposal is already being applied, in another tab or window. Reload the proposals to see where it stands.'
        : 'This proposal was already applied or declined.' }, 409);
    }
    return c.json({ proposal: claimed.proposal });
  });

  app.post('/api/sites/:id/proposals/:proposal/decision', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    const body = await c.req.json().catch(() => null) as { status?: string; version?: number } | null;
    if (body?.status !== 'applied' && body?.status !== 'declined') return c.json({ error: 'status must be applied or declined' }, 400);
    const decided = await g.assistants.decide(g.site.id, c.req.param('proposal')!, {
      status: body.status, by: g.gate.user.id, version: Number.isInteger(body.version) ? body.version : undefined,
    });
    if (!decided) return c.json({ error: 'not_pending', detail: 'This proposal was already applied or declined.' }, 409);
    return c.json({ proposal: decided });
  });
}

/* ---- MCP: what an assistant token sees ---- */

const proposeLimit = throttle(30, 60 * 60_000);

export async function assistantMcpContext(d: AssistantDeps, c: Context, auth: { siteId: string; tokenId: string; name: string }) {
  const site = await d.store.byId(auth.siteId);
  if (!site) return null;
  // A token speaks for the owner who made it, and only while they still own the site.
  const tokens = await d.assistants!.tokens(auth.siteId);
  const maker = tokens.find(t => t.id === auth.tokenId)?.createdBy;
  if (!maker || (await d.auth.membership(auth.siteId, maker))?.role !== 'owner') return null;
  const assets = d.assets ? await d.assets.list(auth.siteId) : [];
  const assetIds = new Set(assets.filter(a => !(a as { retired?: boolean }).retired).map(a => a.id));
  const editorOrigin = d.editorOrigin || new URL(c.req.url).origin;

  const ctx: AssistantMcpContext = {
    site: { id: site.id, name: site.name, version: site.version },
    tokenName: auth.name,
    outline() {
      load(site.doc);
      return {
        site: { id: site.id, name: site.name, version: site.version },
        pages: Core.state.pages.map(pg => ({ id: pg.id, name: pg.name, slug: pg.slug })),
        regions: ['header', 'footer'],
        components: Core.components().map(cd => ({
          id: cd.id, name: cd.name, rootType: cd.node.type,
          properties: (cd.props || []).map(pr => ({ key: pr.k, label: pr.label, kind: pr.t, default: pr.def, ...(pr.opts ? { options: pr.opts.map(([v]) => v) } : {}) })),
        })),
        images: assets.filter(a => assetIds.has(a.id)).slice(0, 300).map(a => ({ id: a.id, name: a.name, width: a.w, height: a.h })),
        limits: { changesPerProposal: Core.PROPOSAL_LIMITS.changes, waitingProposals: ASSISTANT_LIMITS.pending },
      };
    },
    region(id) {
      load(site.doc);
      const elements = Core.proposalOutline(id);
      if (!elements) return null;
      const name = id === 'header' ? 'Header' : id === 'footer' ? 'Footer' : Core.state.pages.find(pg => pg.id === id)?.name;
      return { version: site.version, region: id, name, elements };
    },
    async propose(input) {
      if (!proposeLimit.take(auth.tokenId)) return { ok: false, problems: ['Too many proposals in the last hour. Try again later.'] };
      const latest = await d.store.byId(site.id);
      if (!latest) return { ok: false, problems: ['The site no longer exists.'] };
      if (input.baseVersion !== latest.version) {
        return { ok: false, problems: [`The site changed since you read it: it is now version ${latest.version}. Read it again and propose against that version.`] };
      }
      load(latest.doc);
      const prepared = Core.proposalPrepare(input.changes, { assets: assetIds });
      if (prepared.problems.length) return { ok: false, problems: prepared.problems };
      const regions = [...new Set(prepared.changes.map(ch => ch.region))];
      try {
        const proposal = await d.assistants!.addProposal({
          siteId: site.id, baseVersion: latest.version, title: input.title.trim().slice(0, Core.PROPOSAL_LIMITS.title),
          summary: input.summary.trim().slice(0, Core.PROPOSAL_LIMITS.summary), changes: prepared.changes, regions,
          tokenId: auth.tokenId, tokenName: auth.name,
        });
        // In the app only: an email for every proposal would be noise.
        await d.reviews.notify({
          userId: maker, kind: 'assistant_proposal', title: `${auth.name} proposed changes to ${site.name}`,
          body: `“${proposal.title}”: ${proposal.changes.length} ${proposal.changes.length === 1 ? 'change' : 'changes'} to review in the editor.`,
          href: ctx.reviewUrl(proposal),
        }).catch(() => undefined);
        return { ok: true, proposal };
      } catch (error) {
        if (error instanceof AssistantLimitError) return { ok: false, problems: [error.message] };
        throw error;
      }
    },
    proposals: () => d.assistants!.proposals(site.id),
    proposal: (id) => d.assistants!.proposal(site.id, id),
    reviewUrl: (p: Proposal) => `${editorOrigin}/edit/${encodeURIComponent(site.id)}?proposal=${p.id}`,
  };
  return ctx;
}
