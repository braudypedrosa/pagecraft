/* Assistant proposals (Phase 7): the owner's token page, the editor's proposal API and previews,
   and the MCP context an assistant token gets. See docs/phase7-assistant-proposals-design.md.

   The core is used synchronously, the way renderSite uses it: restore a copy of the draft, read
   or apply, take what is needed, all before the next await. */
import type { Context, Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import * as Core from '../../app/src/core/index.ts';
import type { Doc } from '../../app/src/core/types.ts';
import type { AssetRecord, AssetStore } from './assets.ts';
import type { AuthStore, Role, User } from './auth.ts';
import type { PublicationReviewStore } from './reviews.ts';
import type { Site, SiteRevision, Store } from './store.ts';
import { throttle } from './mail.ts';
import { AssistantLimitError, ASSISTANT_LIMITS, type FileAssistantStore, type Proposal } from './assistants.ts';
import type { AssistantMcpContext } from './assistant-mcp.ts';
import { siteAssistantsPage } from './account-pages.ts';
import { formRoutingChanged } from './content.ts';
import { adopt } from './render.ts';
import { canonicalJson, sha256 } from './releases.ts';

type Gate = { ok: true; user: User; role: Role } | { ok: false; status: 401 | 403 | 404 };
export interface AssistantDeps {
  store: Store;
  auth: AuthStore;
  assets?: AssetStore;
  assistants?: FileAssistantStore;
  reviews: PublicationReviewStore;
  editorOrigin?: string;
  allowed(c: Context, id: string, verb: 'read' | 'write' | 'admin'): Promise<Gate>;
  saveDraft(c: Context, site: Site, doc: Doc, assets: AssetRecord[], userId: string,
    proposal: { id: string; attemptId: string; assetIds: string[] }): Promise<200 | 401 | 403 | 404 | 409 | 422>;
  render(doc: Doc, assets: AssetRecord[]): { files: Map<string, string> } | null;
  assetHeaders(asset: { type: string; name: string }): Record<string, string>;
}

/** Load a draft into the core. Callers must finish with the core before their next await. */
const load = (doc: Doc) => { Core.restore(structuredClone(doc) as never); };
const snapshot = () => structuredClone(Core.doc()) as Doc;

const activeAssets = (assets: AssetRecord[]) => new Set(assets.filter(asset => !asset.retired).map(asset => asset.id));
const documentDigest = (doc: Doc) => sha256(new TextEncoder().encode(canonicalJson(doc)));
const staleDetail = 'The saved draft changed since this proposal was filed. Ask the assistant to read the current draft and propose again.';
const routingDetail = 'This proposal changes where a form submits or how it sends data. An owner must edit that setting in the builder.';

/** Build one complete candidate for filing, preview and apply. No partial previews. */
function proposalCandidate(doc: Doc, changes: Proposal['changes'], id: string, assets: AssetRecord[]) {
  load(doc);
  if (Core.proposalCheck(changes, id, { assets: activeAssets(assets) }).some(status => status !== 'ok')) {
    return { detail: 'A target, placement or asset no longer matches this proposal. Ask the assistant to propose again.' };
  }
  const assetIds = Core.proposalAssetIds(changes);
  Core.proposalApply(changes, id, { assets: activeAssets(assets) });
  const next = adopt(snapshot());
  if (!next) return { detail: 'The draft is incompatible with this editor version.' };
  return formRoutingChanged(doc, next) ? { detail: routingDetail } : { doc: next, assetIds };
}

/** Which rendered file shows a region: the page itself, or the front page for header and footer. */
function previewPaths(doc: Doc, regions: string[]) {
  load(doc);
  const targets = Core.exportTargets() as { pg: { id: string; name: string }; path: string; item?: unknown; pageNo?: number }[];
  const pages = targets.filter(t => (t.pageNo || 1) === 1);
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
    const site = await d.store.byId(c.req.param('id')!, { fresh: true });
    if (!site) return c.notFound();
    if (!d.assistants) return c.text('Assistants are unavailable on this server.', 503);
    return pageFor(c, gate.user, site, { message: c.req.query('message') });
  });

  const creates = throttle(10, 60 * 60_000);
  app.post('/sites/:id/assistants/tokens', async c => {
    const gate = await owner(c);
    if (!gate.ok) return c.text('Access denied', gate.status === 401 ? 401 : gate.status);
    const site = await d.store.byId(c.req.param('id')!, { fresh: true });
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
    const site = await d.store.byId(c.req.param('id')!, { fresh: true });
    if (!site) return { ok: false as const, response: c.json({ error: 'not found' }, 404) };
    return { ok: true as const, gate, site, assistants: d.assistants };
  };

  app.get('/api/sites/:id/proposals', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    const all = await g.assistants.proposals(g.site.id);
    const status = c.req.query('status');
    const list = status ? all.filter(p => p.status === status) : all;
    return c.json({ proposals: list.slice(0, 50).map(p => {
      const { application, ...proposal } = p;
      const waiting = p.status === 'pending' || p.status === 'applying';
      const matches = g.site.version === (waiting ? p.baseVersion : p.appliedVersion);
      return {
        ...proposal, ...(waiting && !matches ? { reviewIssue: staleDetail } : {}),
        recoveryAvailable: !!application && p.status === 'applying',
        previews: matches ? previewPaths(g.site.doc, p.regions) : [],
      };
    }) });
  });

  /* Use the reviewed version or the recorded before/after revisions of an applied proposal. */
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
    const requested = c.req.query('version');
    if (requested !== undefined && requested !== String(proposal.baseVersion)) return c.text(staleDetail, 409);
    const before = c.req.query('before') === '1';
    const assets = d.assets ? await d.assets.list(g.site.id, { fresh: true }) : [];
    let doc: Doc;
    if (proposal.status === 'applied') {
      const version = before ? proposal.baseVersion : proposal.appliedVersion;
      const revision = version && await d.store.revision(g.site.id, version);
      if (!revision) return c.notFound();
      doc = revision.doc;
    } else {
      if (proposal.baseVersion !== g.site.version) return c.text(staleDetail, 409);
      const candidate = proposalCandidate(g.site.doc, proposal.changes, proposal.id, assets);
      if (!candidate.doc) return c.text(candidate.detail, 409);
      doc = before ? g.site.doc : candidate.doc;
    }
    const html = d.render(doc, assets)?.files.get(path);
    if (!html || !/\.html$/.test(path)) return c.notFound();
    c.header('content-security-policy', "sandbox allow-same-origin; default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com data:; frame-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
    return c.html(html);
  });

  // An older open editor must reload rather than use the former browser-side apply protocol.
  app.post('/api/sites/:id/proposals/:proposal/claim', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    return c.json({ error: 'reload_required', detail: 'Reload the editor to apply this proposal with the current review.' }, 409);
  });

  const resultFor = (c: Context, proposal: Proposal, draft: { doc: Doc; version: number } | null) => {
    const { application: _application, ...publicProposal } = proposal;
    return c.json({ proposal: publicProposal, draft });
  };
  const matchesApplication = (proposal: Proposal, revision: SiteRevision) => proposal.application &&
    revision.savedBy === proposal.application.by &&
      revision.context?.source === 'assistant-proposal' && revision.context.proposalId === proposal.id &&
      revision.context.attemptId === proposal.application.attemptId &&
      documentDigest(revision.doc) === proposal.application.digest;
  const confirmedRevision = async (proposal: Proposal) => {
    const revision = await d.store.revision(proposal.siteId, proposal.baseVersion + 1);
    return revision && matchesApplication(proposal, revision) ? revision : null;
  };
  const decisionResponse = (c: Context, result: { status: 'ok'; value: Response } | { status: 'missing' | 'busy' }) => {
    if (result.status === 'ok') return result.value;
    return result.status === 'missing' ? c.notFound()
      : c.json({ error: 'busy', detail: 'Another tab is deciding this proposal. Try again in a moment.' }, 409);
  };

  app.post('/api/sites/:id/proposals/:proposal/apply', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    const body = await c.req.json().catch(() => null) as { version?: number } | null;
    if (!Number.isInteger(body?.version)) return c.json({ error: 'reviewed_version_required' }, 400);
    return decisionResponse(c, await g.assistants.withDecision(g.site.id, c.req.param('proposal')!, async (proposal, write, reserve) => {
      if (body!.version !== proposal.baseVersion) return c.json({ error: 'stale_review', detail: staleDetail }, 409);
      const site = await d.store.byId(g.site.id, { fresh: true });
      if (!site) return c.notFound();
      if (proposal.status === 'declined') {
        return c.json({ error: 'declined', detail: 'This proposal was already declined.' }, 409);
      }
      if (proposal.status === 'applied') {
        return resultFor(c, proposal, site.version === proposal.appliedVersion ? { doc: site.doc, version: site.version } : null);
      }
      const finish = async (attempt: Proposal, saved: { doc: Doc; version: number }, currentVersion: number) => {
        const next: Proposal = {
          ...attempt, status: 'applied', appliedVersion: saved.version, decidedBy: attempt.application!.by,
          decidedAt: new Date().toISOString(),
        };
        await write(next);
        return resultFor(c, next, saved.version === currentVersion ? { doc: saved.doc, version: saved.version } : null);
      };
      if (proposal.application && site.version > proposal.baseVersion) {
        const revision = await confirmedRevision(proposal);
        if (revision) return finish(proposal, revision, site.version);
      }
      if (site.version !== proposal.baseVersion) return c.json({ error: 'stale_review', detail: staleDetail }, 409);
      const assets = d.assets ? await d.assets.list(site.id, { fresh: true }) : [];
      const candidate = proposalCandidate(site.doc, proposal.changes, proposal.id, assets);
      if (!candidate.doc) return c.json({ error: 'proposal_blocked', detail: candidate.detail }, 409);
      const digest = documentDigest(candidate.doc);
      if (proposal.application && (proposal.application.digest !== digest || proposal.application.by !== g.gate.user.id)) {
        return c.json({ error: 'proposal_changed', detail: 'The reviewed result changed. Ask the assistant to propose again.' }, 409);
      }
      const application = proposal.application || { digest, by: g.gate.user.id, attemptId: randomBytes(16).toString('hex') };
      if (!await reserve({ kind: 'apply', application })) {
        return c.json({ error: 'busy', detail: 'Another tab is deciding this proposal. Try again in a moment.' }, 409);
      }
      const attempt: Proposal = { ...proposal, status: 'applying', application };
      await write(attempt);
      const status = await d.saveDraft(c, site, candidate.doc, assets, g.gate.user.id, {
        id: proposal.id, attemptId: application.attemptId, assetIds: candidate.assetIds,
      });
      const revision = await confirmedRevision(attempt);
      if (revision) return finish(attempt, revision, (await d.store.byId(site.id, { fresh: true }))?.version ?? 0);
      if (status === 200) {
        return c.json({ error: 'save_unconfirmed', detail: 'The save could not be confirmed. Try applying again to check the saved draft.' }, 503);
      }
      return c.json({ error: 'save_refused', detail: status === 409
        ? 'The draft or a selected asset changed before saving. Review the draft before trying again.'
        : 'The draft save was refused. Review the draft and try again.' }, status);
    }));
  });

  app.post('/api/sites/:id/proposals/:proposal/decision', async c => {
    const g = await editorGate(c);
    if (!g.ok) return g.response;
    const body = await c.req.json().catch(() => null) as { status?: string } | null;
    if (body?.status !== 'declined') return c.json({ error: 'decline_only', detail: 'Use Apply to draft to save and confirm an application.' }, 400);
    return decisionResponse(c, await g.assistants.withDecision(g.site.id, c.req.param('proposal')!, async (proposal, write, reserve) => {
      if (proposal.status === 'applied' || proposal.status === 'declined') {
        return c.json({ error: 'already_decided', detail: 'This proposal was already applied or declined.' }, 409);
      }
      if (proposal.application) {
        const latest = await d.store.byId(g.site.id, { fresh: true });
        const revision = latest && latest.version > proposal.baseVersion
          ? await d.store.revision(g.site.id, proposal.baseVersion + 1) : null;
        if (!revision || matchesApplication(proposal, revision)) {
          return c.json({ error: 'save_unconfirmed', detail: 'Try applying again to confirm whether this proposal was saved.' }, 409);
        }
      } else if (!await reserve({ kind: 'decline' })) {
        return c.json({ error: 'busy', detail: 'Another tab is deciding this proposal. Try again in a moment.' }, 409);
      }
      const next: Proposal = {
        ...proposal, application: undefined, status: 'declined', decidedBy: g.gate.user.id, decidedAt: new Date().toISOString(),
      };
      await write(next);
      return c.json({ proposal: next });
    }));
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
  const assetIds = activeAssets(assets);
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
      const latest = await d.store.byId(site.id, { fresh: true });
      if (!latest) return { ok: false, problems: ['The site no longer exists.'] };
      if (input.baseVersion !== latest.version) {
        return { ok: false, problems: [`The site changed since you read it: it is now version ${latest.version}. Read it again and propose against that version.`] };
      }
      const currentAssets = d.assets ? await d.assets.list(site.id, { fresh: true }) : [];
      load(latest.doc);
      const prepared = Core.proposalPrepare(input.changes, { assets: activeAssets(currentAssets) });
      if (prepared.problems.length) return { ok: false, problems: prepared.problems };
      const candidate = proposalCandidate(latest.doc, prepared.changes, '', currentAssets);
      if (!candidate.doc) return { ok: false, problems: [candidate.detail] };
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
