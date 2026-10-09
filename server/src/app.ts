import { LiveReviewStore } from './live-reviews.ts';
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { runDueSchedules } from "./schedule-runner.ts";
import type { PublicationScheduleStore } from "./schedules.ts";
import { liveReviewRoutes } from './live-review-routes.ts';
import { publicationPreviewHtml } from "./publication-preview.ts";
import { publicationChanges } from "./publication-changes.ts";
import { componentGalleryPage, galleryBaselineName } from './component-gallery.ts';
import { prepareHostedEditor } from './editor-assets.ts';
import { requestTiming, newRequestTiming, timingHeader, timed } from './request-timing.ts';
import { MemorySitePreviewStore, previewVersion, previewUrl, type SitePreviewStore } from './site-previews.ts';
import { UI_TOKENS_CSS } from '../../shared/ui-tokens.js';
import { UI_FOCUS_CSS } from '../../shared/ui-focus.js';
import { UI_FONT_FACES, UI_FONTS_CSS } from '../../shared/ui-fonts.js';
import { ACCOUNT_ACTIONS_BOOT_SCRIPT } from '../../shared/account-actions.js';
import { ACTION_FEEDBACK_BOOT_SCRIPT } from '../../shared/action-feedback.js';
import { UI_MOTION_BOOT_SCRIPT, UI_MOTION_CSS } from '../../shared/ui-motion.js';
import { submissionRoutes } from './submissions-routes.ts';
import { assistantMcpContext, assistantRoutes, type AssistantDeps } from './assistant-routes.ts';
import { assistantMcpResponse } from './assistant-mcp.ts';
import { isAssistantToken, type FileAssistantStore, type FileOAuthStore } from './assistants.ts';
import { ASSISTANT_SCOPES, assistantOAuthRoutes, resourceMetadataUrl } from './assistant-oauth.ts';
import { siteForms, type FileSubmissionStore } from './submissions.ts';
import { cloudIntegrationRoutes, type CloudIntegrations } from './cloud-integrations-routes.ts';
import { cmsDocumentErrors } from './cms-document.ts';
import {
  isReviewDecision,
  MemoryPublicationReviewStore,
  type PublicationReviewStore,
} from './reviews.ts';
/* The server, as routes.

   Two jobs, deliberately kept apart:

     · **serve a site** — a visitor asks for a page and gets the bytes the export would have
       written. Rendered on save, held in memory per site, so a request does no work beyond a
       map lookup.
     · **serve the editor** — the builder's own `index.html`, plus the two endpoints that
       replace `localStorage`: load a document, save a document.

   The site routes are public — a visitor is not asked who they are. Everything under `/api`
   and `/auth` is not, and `who()` plus `allowed()` are the only two places that decide.

   `app.ts` takes its stores and its editor file as arguments. That is what makes it testable
   without a database or a build — `index.ts` is the part that reads the environment. */
import { type Context, Hono } from "hono";
import { stream } from "hono/streaming";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { bodyLimit } from "hono/body-limit";
import {
  AnalyticsRecorder, NOT_FOUND, analyticsReport, csvRows, excluded, isRange, rangeDays, timeZones, toCsv, validTimeZone, withClickScript,
  type RangeKey,
} from "./analytics.ts";
import {
  cmsItemKey,
  type Site,
  type SiteRevision,
  type Store,
  validHost,
  validSlug,
} from "./store.ts";
import {
  adopt,
  blankDoc,
  hostedHtml,
  publicPath,
  renderSite,
  resolvePath,
} from "./render.ts";
import { contentOnly } from "./content.ts";
import { assertTypedCmsWrite } from "./cms-values.ts";
import { throttle, type NoticeSender } from "./mail.ts";
import { planEntitlements } from "./plans.ts";
import {
  ALLOWED,
  documentAssetIds,
  type Asset,
  AssetQuotaError,
  type AssetRecord,
  type AssetStore,
  FREE_STORAGE_BYTES,
  MAX_BYTES,
  metaOf,
  sniff,
} from "./assets.ts";
import {
  type OptimizedImage,
  optimizedName,
  optimizeImage,
} from "./image-optimization.ts";
import type { Doc } from "../../app/src/core/types.ts";
import { assetFile, SCHEMA as CORE_SCHEMA } from "../../app/src/core/index.ts";
import { LibraryError, type LibraryItemKind, type LibraryItemRef } from "../../app/src/core/libraries.ts";
import { MemoryCollaborationInvitationStore, type CollaborationInvitationStore } from "./collaboration-invitations.ts";
import {
  copyLibraryAssetsToSite, LIBRARY_ITEMS_MAX, LIBRARY_MEMBERS_MAX, LIBRARY_NAME_MAX, LibraryImageError, publishLibraryVersion,
  type LibraryStore,
} from "./libraries.ts";
import {
  type AuthStore,
  hashToken,
  LINK_TTL_MS,
  type LinkSender,
  logLink,
  newToken,
  normalEmail,
  type Role,
  roleAllows,
  isSiteRole,
  roleMayReview,
  sameDigest,
  SESSION_TTL_MS,
  type User,
  validEmail,
} from "./auth.ts";
import {
  type ConnectedStore,
  type DeploymentStatus,
  type ReleaseAudit,
  type SiteRelease,
  type SiteReleaseSummary,
  type WordPressConnection,
  type WordPressContentIndexItem,
} from "./release-store.ts";
import {
  authoredCssAtRuleIssues,
  authoredStylesheetIssues,
  base64url,
  buildReleaseArtifact,
  canonicalJson,
  canonicalOrigin,
  canonicalTargetPath,
  decodeReleaseManifest,
  deploymentForTarget,
  existingThemeCssIssues,
  fromBase64url,
  type KeysetEnvelopeV1,
  manifestForRelease,
  migrateIndexedWordPressLinks,
  parseReleaseArtifact,
  type ReleaseSigningKey,
  releaseStylesheetLinks,
  replaceHostedSeoOwnershipTags,
  sha256,
  signDeploymentEnvelope,
  signReleaseAvailableWebhook,
  signReleaseManifest,
  utf8ByteCompare,
} from "./releases.ts";
import { freezeGoogleFontStylesheets, shareHostedStyles } from "./font-freeze.ts";
import type { PackageRegistry } from "./packages.ts";
import type {
  HostedPublicationStore,
  PublicationSummary,
} from "./publications.ts";
import {
  createPagePackage,
  createSitePackage,
  portableAssetIds,
} from "./portable-packages.ts";
import type { AccountAuth, VerifiedIdentity } from "./account-auth.ts";
import type { HumanChallenge } from "./turnstile.ts";
import type { OwnedSiteStore } from "./accounts.ts";
import { latestSiteTemplates, type SiteTemplateStore } from "./site-templates.ts";
import {
  integrationDiscovery,
  pagecraftMcpResponse,
} from "./integrations.ts";
import {
  accountSettingsPage,
  confirmLinkPage,
  dashboardPage,
  collaborationInvitationsPage,
  forgotPage,
  privacyPage,
  resetPage,
  signInPage as accountSignInPage,
  signUpPage,
  siteOverviewPage,
  sitePeoplePage,
  siteReviewsPage,
  siteReviewDetailPage,
  siteSettingsPage,
  siteAnalyticsPage,
  notificationsPage,
  notificationStatusExamples,
  notificationsMiniMarkup,
  termsPage,
} from "./account-pages.ts";
import {
  CUSTOM_SELECT_BOOT_SCRIPT,
  CUSTOM_SELECT_CSS,
} from "../../shared/custom-select.js";

export const SESSION_COOKIE = "pc_session";

export type HostedPublishPreparation =
  | {
    status: "ok";
    user: User;
    role: Role;
    site: Site;
    revision: SiteRevision | null;
    assets: AssetRecord[];
  }
  | { status: "missing" | "forbidden" };

export interface HostedPublishPreparer {
  prepare(
    input: { siteId: string; identity: VerifiedIdentity },
  ): Promise<HostedPublishPreparation>;
}

export type CloudSaveResult =
  | { status: "saved"; site: Site }
  | { status: "missing" }
  | { status: "forbidden" }
  | { status: "conflict"; currentVersion: number };

export type CloudPublishResult =
  | { status: "published"; site: Site }
  | { status: "missing" }
  | { status: "forbidden" }
  | { status: "conflict"; currentVersion: number };

/** Production-only fast path. Cached source material is never trusted for authorization: every
 * write re-checks the verified identity, current membership, and optimistic version atomically
 * inside the gateway. */
export interface CloudMutationFastPath {
  cachedSaveSource(siteId: string, sourceVersion: number): {
    site: Site;
    assets: AssetRecord[];
  } | null;
  saveAuthorized(input: {
    siteId: string;
    sourceVersion: number;
    doc: Doc;
    identity: VerifiedIdentity;
    requiredRole: "write" | "admin";
  }): Promise<CloudSaveResult>;
  cachedPublishSource(input: {
    siteId: string;
    sourceVersion: number;
    identity: VerifiedIdentity;
  }):
    | Omit<
      Extract<HostedPublishPreparation, { status: "ok" }>,
      "status" | "role"
    >
    | null;
  publishAuthorized(input: {
    siteId: string;
    sourceVersion: number;
    publicationId: string;
    contentHash: string;
    createdAt: string;
    identity: VerifiedIdentity;
  }): Promise<CloudPublishResult>;
}

export type ManualImportCatalogRead =
  | { authorized: false }
  | { authorized: true; ownerId: string; sites: Site[] };

export type ManualImportProjectRead =
  | { authorized: false }
  | { authorized: true; ownerId: string; site: Site | null };

/** Production gateway fast path for manual WordPress imports. Access-token validity,
 * current ownership, and the requested site are resolved in one HTTPS crossing. */
export interface ManualImportReadFastPath {
  catalog(accessDigest: string): Promise<ManualImportCatalogRead>;
  project(
    accessDigest: string,
    projectId: string,
  ): Promise<ManualImportProjectRead>;
}

/* Authorization-code exchange is retryable because the callback crosses two durable systems:
   Pagecraft and WordPress. Deriving the credentials from the high-entropy code + PKCE verifier
   returns the exact same secrets after response loss without storing plaintext credentials on
   Pagecraft. The domain and connection binding prevent either token role or another connection
   from sharing key material. */
const oauthCredential = (
  kind: "access" | "refresh",
  connectionId: string,
  code: string,
  verifier: string,
) =>
  base64url(Buffer.from(
    hashToken(
      ["pagecraft-oauth-code-v1", kind, connectionId, code, verifier].join(
        "\0",
      ),
    ),
    "hex",
  ));

export interface Options {
  /** Internal, authenticated UI reference; disabled unless the host explicitly opts in. */
  componentGallery?: boolean;
  store: Store;
  auth: AuthStore;
  /** where the images live. Absent means a site renders with placeholders. */
  assets?: AssetStore;
  /** Injectable so route behavior can be proven with tiny synthetic image headers. */
  optimizeAsset?: (bytes: Uint8Array, type: string) => Promise<OptimizedImage>;
  /** the built builder, as a string. Absent in tests that only exercise the site routes. */
  editorHtml?: string;
  /** which host serves the editor. Every other host is a site. */
  editorHost?: string;
  /** where a login link points. Needed because the link is built outside a request. */
  editorOrigin?: string;
  /** how the link reaches the person. Logged in development. */
  sendLink?: LinkSender;
  /** Review assignment, comment, and decision mail. Omitted when SMTP is unset. */
  sendNotice?: NoticeSender;
  /** at most so many links per address per window. Absent means the default. */
  loginLimit?: { take(key: string): boolean };
  /** `Secure` on the session cookie. Off in tests and local http, on everywhere real. */
  secureCookies?: boolean;
  /** Immutable releases, WordPress targets, and deployment acknowledgements. */
  connected?: ConnectedStore;
  /** Online release key. The offline root key is never a runtime option. */
  releaseSigning?: ReleaseSigningKey;
  /** Offline root-signed public release-key set returned to connectors unchanged. */
  keysetEnvelope?: KeysetEnvelopeV1;
  /** Pre-verified, signed connector/theme archives. No registry means no update downloads. */
  packages?: PackageRegistry;
  /** Immutable, materialized hosted releases and their atomic public pointers. */
  publications?: HostedPublicationStore;
  sitePreviews?: SitePreviewStore;
  liveReviews?: LiveReviewStore;
  /** Production gateway fast path: authenticate and load one hosted publish source in one call. */
  hostedPublish?: HostedPublishPreparer;
  /** Cached-source + atomic-write path that removes redundant production gateway crossings. */
  cloudMutations?: CloudMutationFastPath;
  /** Current manual-import authorization and project data in one production gateway call. */
  manualImports?: ManualImportReadFastPath;
  /** Injectable only so font freezing can be proven without a live third-party dependency. */
  fontFetch?: typeof fetch;
  /** Cloud-only outbound app credentials and property clients. */
  cloudIntegrations?: CloudIntegrations;
  submissions?: FileSubmissionStore;
  reviews?: PublicationReviewStore;
  /** Scheduled publication of prepared snapshots, stored beside this environment's bytes. */
  schedules?: PublicationScheduleStore;
  /** Account-owned libraries (Phase 5); shared across environments like sites. */
  libraries?: LibraryStore;
  /** Pending invitations grant no access until the addressed person accepts. */
  collaborationInvitations?: CollaborationInvitationStore;
  /** Aggregate analytics for published sites (Phase 6), off per site until its owner turns it on. */
  analytics?: AnalyticsRecorder;
  /** Assistant tokens and their proposals (Phase 7). */
  assistants?: FileAssistantStore;
  /** Sign-in for assistant apps (claude.ai, Claude Desktop) that issues those tokens. */
  assistantOAuth?: FileOAuthStore;
  /** Bearer key for the cron-driven run endpoint; without one the endpoint does not exist. */
  scheduleRunnerKey?: string;
  /** Verified Supabase email/password accounts. Omit only for legacy rollback/tests. */
  accountAuth?: AccountAuth;
  /** Atomic site creation and owner grant, including the owned-site quota. */
  ownedSites?: OwnedSiteStore;
  /** Immutable, Pagecraft-curated full-site packages. */
  siteTemplates?: SiteTemplateStore;
  /** Cloudflare Turnstile verifier for public account forms. */
  challenge?: HumanChallenge;
  turnstileSiteKey?: string;
  /** Believe `CF-Connecting-IP`. Only true when Cloudflare really fronts the origin. */
  trustCloudflare?: boolean;
  /** Signs short-lived account cookies. Absent means a per-process key, which is enough for
      one Node process; several processes behind one host need the same configured value. */
  cookieSecret?: string;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
};
const typeOf = (path: string) =>
  TYPES[(path.split(".").pop() || "").toLowerCase()] ||
  "application/octet-stream";

function editorAssetEncoding(header = ''): 'br' | 'gzip' | 'identity' | null {
  const weights = new Map<string, number>();
  for (const part of header.split(',')) {
    const [name, ...parameters] = part.trim().split(';');
    if (!name) continue;
    const parameter = parameters.map(value => value.trim()).find(value => /^q=/i.test(value));
    const weight = parameter ? Number(parameter.slice(2)) : 1;
    weights.set(name.toLowerCase(), Number.isFinite(weight) && weight >= 0 && weight <= 1 ? weight : 0);
  }
  const quality = (name: string) => weights.get(name) ?? weights.get('*') ?? 0;
  const br = quality('br'), gzip = quality('gzip');
  const identity = weights.get('identity') ?? (weights.get('*') === 0 ? 0 : 1);
  if (weights.has('identity') && identity > Math.max(br, gzip)) return 'identity';
  if (br > 0 && br >= gzip) return 'br';
  if (gzip > 0) return 'gzip';
  return identity > 0 ? 'identity' : null;
}

export function createApp(o: Options) {
  const app = new Hono();
  // Split only the static source, before any account or document configuration is injected.
  // The canonical single-file editor remains available to offline and WordPress hosts.
  const hostedEditor = o.editorHtml ? prepareHostedEditor(o.editorHtml) : undefined;
  const invitations = o.collaborationInvitations || new MemoryCollaborationInvitationStore(o.store, o.auth, o.libraries);
  const sitePreviews = o.sitePreviews || new MemorySitePreviewStore();
  const optimizeAsset = o.optimizeAsset || optimizeImage;
  /* The address every per-source limit keys on. Nothing sits in front of the origin unless
     `trustCloudflare` says so, and without Cloudflare its header is whatever the caller typed.
     LiteSpeed replaces `X-Forwarded-For` with the real client, so its leftmost entry is next;
     a direct connection has only its socket peer (LiteSpeed's Unix socket has none). */
  const requestSource = (c: Context) =>
    (o.trustCloudflare && c.req.header("cf-connecting-ip")) ||
    (c.req.header("x-forwarded-for") || "").split(",")[0].trim() ||
    (c.env as { incoming?: IncomingMessage } | undefined)?.incoming?.socket
      ?.remoteAddress ||
    "unknown";
  /* Invitations can send transactional email and create pending access records. These limits
     are deliberately independent: rotating addresses must not evade the source/account limit,
     while rotating callers must not mail-bomb one recipient. The short recipient cooldown
     also makes accidental double-submission harmless. */
  const inviteSourceLimit = throttle(30, 15 * 60 * 1000, 5000);
  const inviteAccountLimit = throttle(20, 60 * 60 * 1000, 5000);
  const inviteSiteLimit = throttle(20, 60 * 60 * 1000, 5000);
  const inviteEmailLimit = throttle(3, 60 * 60 * 1000, 5000);
  const inviteCooldown = throttle(1, 60 * 1000, 5000);

  app.use('*', async (c, next) => {
    const trace = newRequestTiming();
    await requestTiming.run(trace, next);
    const editorTiming = isEditorHost(c.req.header('host'), o) &&
      /^\/(edit|api|sites)(\/|$)/.test(new URL(c.req.url).pathname);
    const publicationTiming = trace.spans.some((span) =>
      span.name.startsWith('publication.')
    );
    if (editorTiming || publicationTiming) {
      c.header('Server-Timing', timingHeader(trace));
    }
    if (editorTiming) {
      c.header('X-Request-ID', trace.id);
    }
  });

  /* Baseline browser hardening. Published HTML adds a sandbox below because it may contain an
     owner's intentional scripts; the editor itself must never be framed by another site. */
  app.use("*", async (c, next) => {
    await next();
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
    c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (
      isEditorHost(c.req.header("host"), o) &&
      !c.res.headers.has("content-security-policy")
    ) {
      c.header(
        "content-security-policy",
        "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
      );
    }
    const path = new URL(c.req.url).pathname;
    const privateRoute = !path.startsWith("/v1/wordpress-distribution/") &&
        /^\/(?:api|auth|edit|sites|v1)(?:\/|$)/.test(path) ||
      /^\/(?:account|invitations|owner)(?:\/|$)/.test(path) ||
      /^\/internal\/components(?:\/|$)/.test(path) ||
      path === "/mcp" ||
      (path === "/" && isEditorHost(c.req.header("host"), o));
    const cachedThumbnail = c.req.method === "GET" && /^\/api\/sites\/[^/]+\/dashboard-thumbnail$/.test(path) &&
      [200, 304].includes(c.res.status) && c.res.headers.get("cache-control")?.includes("immutable");
    if (privateRoute && !cachedThumbnail) c.header("cache-control", "private, no-store");
    /* `secureCookies` is the production signal already passed by the entry point. Browsers
       ignore HSTS over HTTP; over HTTPS this closes the first-visit downgrade gap. Deliberately
       no includeSubDomains until every unrelated subdomain is known to be HTTPS-only. */
    if (o.secureCookies) {
      c.header("strict-transport-security", "max-age=31536000");
    }
  });

  /* Auth and administration exist on the editor host only. Besides narrowing the attack
     surface, this prevents a custom site's Host header from becoming a magic-link origin. */
  const editorOnly = async (c: Context, next: () => Promise<void>) => {
    if (!isEditorHost(c.req.header("host"), o)) return c.notFound();
    await next();
  };
  app.use("/auth/*", editorOnly);
  app.use("/api/*", editorOnly);
  app.use("/v1/*", editorOnly);
  app.use("/sign-up", editorOnly);
  app.use("/sign-in", editorOnly);
  app.use("/forgot-password", editorOnly);
  app.use("/reset-password", editorOnly);
  app.use("/internal/components", editorOnly);
  app.use("/internal/components/*", editorOnly);
  app.use("/account", editorOnly);
  app.use("/account/*", editorOnly);
  app.use("/owner", editorOnly);
  app.use("/owner/*", editorOnly);
  app.use("/sites/*", editorOnly);
  app.use("/invitations", editorOnly);
  app.use("/invitations/*", editorOnly);
  app.use("/review/*", editorOnly);
  app.use("/privacy", editorOnly);
  app.use("/terms", editorOnly);
  // Share the builder's exact font files; only the product font manifest is public.
  // CloudLinux launches from a fixed directory outside the active release.
  const brandFile = (path: string) => fileURLToPath(new URL(`../../brand/${path}`, import.meta.url));
  for (const { file } of UI_FONT_FACES) {
    app.get(`/brand/fonts/${file}`, editorOnly, serveStatic({ path: brandFile(`fonts/${file}`) }));
  }
  app.get('/brand/builder-assets/*', editorOnly, (c) => {
    const asset = hostedEditor?.assets.get(new URL(c.req.url).pathname);
    if (!asset) return c.notFound();
    const encoding = editorAssetEncoding(c.req.header('accept-encoding'));
    c.header('vary', 'Accept-Encoding');
    if (!encoding) return c.text('No acceptable asset encoding.', 406);
    const body = encoding === 'identity' ? asset.body : asset[encoding];
    return new Response(new Uint8Array(body), { headers: {
      'content-type': asset.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      'vary': 'Accept-Encoding',
      ...(encoding === 'identity' ? {} : { 'content-encoding': encoding }),
    } });
  });
  app.get(
    "/brand/pagecraft-logo.svg",
    editorOnly,
    serveStatic({
      path: brandFile("logo/pagecraft-logo-primary-dark.svg"),
    }),
  );
  app.get(
    "/brand/pagecraft-favicon.svg",
    editorOnly,
    serveStatic({
      path: brandFile("pagecraft-favicon.svg"),
    }),
  );
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 16 * 1024 * 1024,
      onError: (c) => c.json({ error: "request is too large" }, 413),
    }),
  );
  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: 16 * 1024 * 1024,
      onError: (c) => c.json({ error: "request is too large" }, 413),
    }),
  );
  app.use(
    "/sites/*",
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.text("Request too large", 413),
    }),
  );
  // Invitation decisions are browser actions in both account and legacy cookie modes.
  app.use("*", async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && /^\/(?:api\/)?invitations(?:\/|$)/.test(path)) {
      const expected = new URL(o.editorOrigin || c.req.url).origin;
      let origin = c.req.header("origin") || "";
      if (!origin) try { origin = new URL(c.req.header("referer") || "").origin; } catch { /* Missing origin fails closed. */ }
      if (origin !== expected) return c.json({ error: "origin_not_allowed" }, 403);
    }
    await next();
  });
  if (o.accountAuth) {
    app.use("*", async (c, next) => {
      const method = c.req.method.toUpperCase();
      const path = new URL(c.req.url).pathname;
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(method) &&
        (/^\/(?:auth|api|account|sites)(?:\/|$)/.test(path));
      const bearer = /^Bearer\s+/i.test(c.req.header("authorization") || "") ||
        !!c.req.header("x-pagecraft-editor-session");
      if (mutating && !bearer) {
        const expected = new URL(o.editorOrigin || c.req.url).origin;
        const origin = c.req.header("origin") || (() => {
          try {
            return new URL(c.req.header("referer") || "").origin;
          } catch {
            return "";
          }
        })();
        if (!origin || origin !== expected) {
          return c.json({ error: "origin_not_allowed" }, 403);
        }
      }
      /* The old cookie is deliberately cleared throughout the cutover release. */
      if (getCookie(c, SESSION_COOKIE)) {
        deleteCookie(c, SESSION_COOKIE, { path: "/" });
      }
      await next();
    });
  }

  /* Rendered output, per site id, rebuilt on save. A site's files are small — the whole
     demo project is 69 KB of HTML — and rendering is about 5 ms, so holding them costs
     little and means a visitor never waits for a render. */
  const built = new Map<string, {
    version: number;
    releaseId: string | null;
    files: Map<string, string>;
  }>();
  type OAuthConsent = {
    userId: string;
    request: {
      suggestedSiteId: string;
      installationId: string;
      environment: "staging" | "production";
      profile: "existing-theme" | "pagecraft-theme";
      targetOrigin: string;
      targetPath: string;
      redirectUri: string;
      webhookUrl: string;
      codeChallenge: string;
      state: string;
      scopes: string[];
    };
  };
  type ManualImportConsent = {
    userId: string;
    installationId: string;
    redirectUri: string;
    codeChallenge: string;
    state: string;
  };

  /* A render needs the site's assets, and fetching them is asynchronous while the render is
     not — so they are fetched first and handed in. `renderSite` stays synchronous, which is
     the property the singleton core depends on. */
  const render = (
    doc: Doc,
    assets: AssetRecord[] = [],
    formEndpoint = '',
    options: { foundation?: boolean } = {},
  ) => {
    /* Every served byte comes through here, so this is where a document written by an older
       editor is brought up to date. `adopt` returning null means a newer editor wrote it; it
       is in the table already, so render it as it stands rather than take the site down. */
    /* The renderer reads ids and names only. Keep its existing Asset input contract while the
       stores correctly keep image bodies out of metadata listings. */
    const refs: Asset[] = assets.map((asset) => ({
      ...asset,
      bytes: new Uint8Array(),
    }));
    const adopted = adopt(doc);
    if (!adopted) {
      throw new Error("document schema is newer than this Pagecraft renderer");
    }
    return renderSite(adopted, refs, formEndpoint, options);
  };
  const assetsOf = async (id: string) => o.assets ? o.assets.list(id) : [];
  const assetBodiesOf = async (
    id: string,
    onlyIds?: ReadonlySet<string>,
    knownMetadata?: AssetRecord[],
  ) => {
    if (!o.assets) return [] as Asset[];
    const selected = (knownMetadata || await o.assets.list(id))
      .filter((meta) => !onlyIds || onlyIds.has(meta.id));
    const out: Asset[] = [];
    for (const meta of selected) {
      const asset = await o.assets.get(id, meta.id);
      if (asset) out.push(asset);
    }
    return out;
  };
  const releaseAssetIds = (
    doc: Doc,
    files: Map<string, string>,
    assets: AssetRecord[],
  ) => {
    const referenced = new Set<string>();
    const rendered = [...files.values()].join("\n");
    for (const asset of assets) {
      if (rendered.includes(assetFile(asset))) referenced.add(asset.id);
    }
    for (const collection of doc.meta.collections || []) {
      const imageFields = new Set(
        collection.fields.filter((field) => field.type === "image").map(
          (field) => field.id,
        ),
      );
      for (const item of collection.items) {
        for (const fieldId of imageFields) {
          const match = String(item.values[fieldId] || "").match(
            /^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@\d+)?$/,
          );
          if (match) referenced.add(match[1]);
        }
      }
    }
    return referenced;
  };
  const remember = (site: Site, out: ReturnType<typeof render>) => {
    built.set(site.id, {
      version: site.publishedVersion,
      releaseId: site.publishedReleaseId,
      files: out.files,
    });
    return out;
  };
  /** Where a hosted publication is read: the site's own domain, or the editor host and its
      slug. From the configured editor origin rather than request headers, because it is
      written into the published files. */
  const publicAddress = (c: Context, site: Pick<Site, "host" | "slug">) => {
    const editor = new URL(o.editorOrigin || c.req.url);
    return /\.invalid$/.test(site.host)
      ? `${editor.origin}/${site.slug}/`
      : `${editor.protocol}//${site.host.toLowerCase()}/`;
  };
  const cloudReceiver = (c: Context, id: string) => o.submissions && !c.req.header('x-pagecraft-editor-session')
    ? new URL('/forms/' + encodeURIComponent(id), o.editorOrigin || c.req.url).href : '';
  const candidate = (doc: Doc, assets: AssetRecord[], formEndpoint = '') => {
    try {
      return render(doc, assets, formEndpoint);
    } catch (caught) {
      console.warn(
        "invalid Pagecraft document rejected:",
        String((caught as Error).message || caught),
      );
      return null;
    }
  };

  /* ------------------------------------------------------------------- who, and what */

  /* One identity check per request. A gate, the route behind it and pages such as /account all
     ask who is calling; each ask used to be another Supabase Auth round trip (about 0.35 s)
     with the same request cookies and therefore the same answer. Keyed by the request object,
     so nothing outlives the request and no answer is shared between two of them. */
  const identities = new WeakMap<Request, Promise<VerifiedIdentity | null>>();
  const verifiedIdentity = (c: Context) => {
    let pending = identities.get(c.req.raw);
    if (!pending) {
      pending = timed("auth.verify", () => o.accountAuth!.identity(c));
      identities.set(c.req.raw, pending);
    }
    return pending;
  };
  const users = new WeakMap<Request, Promise<User | null>>();

  /** The person behind this request, or null. A bad cookie is the same as no cookie. */
  const who = (c: Context): Promise<User | null> => {
    let pending = users.get(c.req.raw);
    if (!pending) {
      pending = (async () => {
        if (o.accountAuth) {
          const identity = await verifiedIdentity(c);
          if (!identity) return null;
          return o.auth.ensureAuthUser(
            identity.authUserId,
            identity.email,
            identity.name,
          );
        }
        const token = getCookie(c, SESSION_COOKIE);
        if (!token) return null;
        return o.auth.userForSession(hashToken(token));
      })();
      users.set(c.req.raw, pending);
    }
    return pending;
  };

  app.get('/internal/components', async c => {
    if (!o.componentGallery || !o.editorHtml) return c.notFound();
    if (!await who(c)) return c.redirect('/sign-in?next=%2Finternal%2Fcomponents');
    c.header('x-robots-tag', 'noindex, nofollow');
    return c.html(componentGalleryPage(o.editorHtml, c.req.query('host'), c.req.query('section')));
  });
  app.get('/internal/components/baselines/:name', async (c, next) => {
    if (!o.componentGallery || !await who(c)) return c.notFound();
    const name = galleryBaselineName(c.req.param('name'));
    if (!name) return c.notFound();
    c.header('x-robots-tag', 'noindex, nofollow');
    return serveStatic({path:fileURLToPath(new URL(`../../public/internal-ui-baselines/${name}`, import.meta.url))})(c, next);
  });

  const visibleSites = async (user: User) => {
    const [sites, memberships] = await Promise.all([
      o.store.listMeta(),
      o.auth.membershipsForUser(user.id),
    ]);
    const roles = new Map(memberships.map((m) => [m.siteId, m.role]));
    return sites.flatMap((site) => {
      const role = roles.get(site.id);
      return role ? [{ site, role }] : [];
    });
  };

  /* What the dashboard and plan show against the owned-site limit, counted the way creation
     counts it. Until the gateway knows `account.ownedSiteCount`, every owner row (the old,
     stricter count) is shown instead of failing the page. */
  const ownedSiteCount = async (user: User, mine: { role: Role }[]) => {
    const every = mine.filter((item) => item.role === "owner").length;
    if (!o.ownedSites) return every;
    return o.ownedSites.owned(user.id).catch(() => every);
  };

  const storageOwner = async (siteId: string, actor: User, role: Role) => {
    if (role === "owner") return actor.id;
    const owners = (await o.auth.members(siteId))
      .filter((member) => member.role === "owner")
      .sort((a, b) => a.userId.localeCompare(b.userId));
    return owners[0]?.userId || null;
  };

  // Shared-site uploads consume the storage owner's allowance, not the collaborator's.
  const storageLimitForOwner = async (ownerId: string, knownUser?: User) =>
    planEntitlements((ownerId === knownUser?.id ? knownUser : await o.auth.userById(ownerId))?.plan).storageBytes;

  /**
   * Who this person is to this site: one identity check and one membership lookup. `allowed`
   * then asks whether that role may do something; `allowedMember` accepts any role. Both used
   * to repeat the whole lookup for each role they tried, so a content editor opening a site
   * paid for two identity checks and two membership reads, and a reviewer for three.
   */
  const siteAccess = async (c: Context, siteId: string) => {
    const scoped = c.req.header("x-pagecraft-editor-session");
    if (scoped) {
      const credential = await o.connected?.editorCredential(
        hashToken(scoped),
        new Date().toISOString(),
      );
      if (!credential) return { ok: false as const, status: 401 as const };
      if (credential.siteId !== siteId) {
        return { ok: false as const, status: 404 as const };
      }
      const [user, membership] = await Promise.all([
        o.auth.userById(credential.ownerId),
        o.auth.membership(siteId, credential.ownerId),
      ]);
      if (!user || membership?.role !== "owner") {
        return { ok: false as const, status: 403 as const };
      }
      return { ok: true as const, user, role: membership.role };
    }
    if (o.accountAuth) {
      const user = await who(c);
      if (!user) return { ok: false as const, status: 401 as const };
      const membership = await o.auth.membership(siteId, user.id);
      if (!membership) return { ok: false as const, status: 404 as const };
      return { ok: true as const, user, role: membership.role };
    } else {
      const token = getCookie(c, SESSION_COOKIE);
      if (!token) return { ok: false as const, status: 401 as const };
      const access = await o.auth.accessForSession(hashToken(token), siteId);
      if (!access) return { ok: false as const, status: 401 as const };
      if (!access.role) return { ok: false as const, status: 404 as const }; // conceal existence
      return { ok: true as const, user: access.user, role: access.role };
    }
  };

  /**
   * May this person do this to this site? Every answer comes from here, so a route cannot
   * forget the membership half and check only that somebody is logged in.
   */
  const allowed = async (
    c: Context,
    siteId: string,
    verb: "read" | "write" | "admin",
  ) => {
    const access = await siteAccess(c, siteId);
    if (!access.ok) return access;
    /* Connected mode is retired, and what is left of its embedded editor may open and save
       this one document. It never administers the site: no deleting, people, publishing,
       hosts or settings, whatever its owner may do in their own browser. */
    if (verb === "admin" && c.req.header("x-pagecraft-editor-session")) {
      return { ok: false as const, status: 403 as const };
    }
    if (!roleAllows(access.role, verb)) {
      return { ok: false as const, status: 403 as const };
    }
    return access;
  };

  /* Any member, whatever their role. An editor session is capped at `write`, so on member pages
     it counts as a content editor and never stands in for the owner. */
  const allowedMember = async (c: Context, siteId: string) => {
    const access = await siteAccess(c, siteId);
    return access.ok && c.req.header("x-pagecraft-editor-session")
      ? { ...access, role: "content" as Role }
      : access;
  };

  const allowedReview = async (c: Context, siteId: string) => {
    const member = await allowedMember(c, siteId);
    if (!member.ok) return member;
    if (!roleMayReview(member.role)) {
      return { ok: false as const, status: 403 as const };
    }
    return member;
  };

  const liveReviews = o.liveReviews || new LiveReviewStore();
  const reviews: PublicationReviewStore = o.reviews || new MemoryPublicationReviewStore();

  const deny = (c: Context, status: 401 | 403 | 404) =>
    c.json({
      error: status === 401
        ? "sign in"
        : status === 403
        ? "not allowed"
        : "no such site",
    }, status);

  /* Gateway, database and file-system errors can carry SQL text, row values or server paths.
     The log keeps them whole and people see the route's own sentence. Errors this server
     raised itself, such as validation and ordering checks, keep their words. */
  const shownError = (error: unknown, fallback: string) => {
    const e = error as { name?: unknown; severity?: unknown; syscall?: unknown };
    if (
      error instanceof Error && e.name !== "GatewayError" &&
      typeof e.severity !== "string" && typeof e.syscall !== "string"
    ) return error.message;
    console.error(`${fallback}:`, error);
    return fallback;
  };

  const bearerConnection = async (c: Context) => {
    if (!o.connected) return null;
    const match = (c.req.header("authorization") || "").match(
      /^Bearer\s+([^\s]+)$/i,
    );
    if (!match) return null;
    return o.connected.connectionByAccessToken(
      hashToken(match[1]),
      new Date().toISOString(),
    );
  };
  const releaseReady = () =>
    !!(o.connected && o.releaseSigning && o.keysetEnvelope);
  const releaseUnavailable = (c: Context) =>
    c.json({
      error: "release signing is unavailable",
      detail:
        "Connected publishing requires a release private key and an offline root-signed keyset.",
    }, 503);
  const publicConnection = (connection: WordPressConnection) => ({
    id: connection.id,
    installationId: connection.installationId,
    environment: connection.environment,
    profile: connection.profile,
    targetOrigin: connection.targetOrigin,
    targetPath: connection.targetPath,
    status: connection.status,
    desiredReleaseId: connection.desiredReleaseId,
    pendingReleaseId: connection.pendingReleaseId,
    activeReleaseId: connection.activeReleaseId,
    activeHash: connection.activeHash,
    nextSequence: connection.nextSequence,
    lastAcknowledgedSequence: connection.lastAcknowledgedSequence,
    updatedAt: connection.updatedAt,
  });
  const wordpressContentForSite = async (siteId: string) => {
    if (!o.connected) return [];
    const [connections, snapshots] = await Promise.all([
      o.connected.connectionsForSite(siteId),
      o.connected.wordpressContentIndexesForSite(siteId),
    ]);
    const byId = new Map(
      connections.filter((item) => item.status === "active").map(
        (item) => [item.id, item],
      ),
    );
    return snapshots.flatMap((snapshot) => {
      const connection = byId.get(snapshot.connectionId);
      return connection
        ? [{
          connectionId: connection.id,
          environment: connection.environment,
          profile: connection.profile,
          targetOrigin: connection.targetOrigin,
          targetPath: connection.targetPath,
          generation: snapshot.generation,
          syncedAt: snapshot.syncedAt,
          /* The index is a link catalogue, not a second WordPress editor. */
          items: snapshot.items.map((item) => ({ ...item })),
        }]
        : [];
    }).sort((a, b) =>
      utf8ByteCompare(a.environment, b.environment) ||
      utf8ByteCompare(a.targetOrigin, b.targetOrigin)
    );
  };
  const issueTarget = async (
    release: SiteReleaseSummary,
    connection: WordPressConnection,
    desired: boolean,
  ) => {
    if (!o.connected || !o.releaseSigning) {
      throw new Error("release signing unavailable");
    }
    const ensureQueued = async (target: { sequence: number }) => {
      const history = (await o.connected!.deploymentsForRelease(release.id))
        .filter((item) =>
          item.connectionId === connection.id &&
          item.sequence === target.sequence
        );
      if (history.length) return;
      const queued = {
        connectionId: connection.id,
        releaseId: release.id,
        sequence: target.sequence,
        status: "queued" as const,
        activeHash: null,
        error: null,
        detail: {
          stage: "queued",
          message: "Release is available for this target.",
        },
        idempotencyKey: `target:${connection.id}:${release.id}`,
      };
      const bodyHash = sha256(new TextEncoder().encode(canonicalJson(queued)));
      const recorded = await o.connected!.recordDeployment({
        ...queued,
        bodyHash,
      });
      if (!recorded.ok) {
        throw new Error(`could not queue release target: ${recorded.error}`);
      }
    };
    const announce = async (
      target: { sequence: number; createdAt: string },
    ) => {
      const eventId = `pcw_${
        sha256(new TextEncoder().encode(`${connection.id}:${release.id}`))
          .slice(0, 40)
      }`;
      const event = {
        type: "release.available" as const,
        eventId,
        connectionId: connection.id,
        releaseId: release.id,
        sequence: target.sequence,
        occurredAt: target.createdAt,
      };
      const signed = signReleaseAvailableWebhook(event, o.releaseSigning!);
      try {
        await o.connected!.enqueueWebhook({
          eventId,
          connectionId: connection.id,
          releaseId: release.id,
          targetSequence: target.sequence,
          webhookUrl: connection.webhookUrl,
          payload: signed.payload,
          bodyHash: signed.bodyHash,
          signature: signed.signature,
          keyId: signed.keyId,
        });
      } catch (error) {
        /* Polling reconciles even if the announcement queue is temporarily unavailable. */
        console.error(
          "WordPress release webhook could not be queued:",
          (error as Error).message,
        );
      }
    };
    const existing = await o.connected.target(connection.id, release.id);
    if (existing) {
      /* Creating a target advances a mutable pointer before the immutable queued event is
         appended. A worker can fail between those writes, so every retry repairs that exact
         deterministic event before it reports the target as usable. */
      const attached = await o.connected.createTarget(existing, desired);
      await ensureQueued(attached.target);
      await announce(attached.target);
      return attached.target;
    }
    const releaseManifest = decodeReleaseManifest(release.manifest);
    const issuedAt = new Date().toISOString();
    const envelope = deploymentForTarget({
      release: releaseManifest,
      releaseManifest: release.manifest,
      connectionId: connection.id,
      installationId: connection.installationId,
      environment: connection.environment,
      profile: connection.profile,
      targetOrigin: connection.targetOrigin,
      targetPath: connection.targetPath,
      targetSequence: connection.nextSequence,
      issuedAt,
    });
    const signed = signDeploymentEnvelope(envelope, o.releaseSigning);
    const made = await o.connected.createTarget({
      releaseId: release.id,
      connectionId: connection.id,
      sequence: connection.nextSequence,
      envelope: signed.envelope,
      signature: signed.signature,
      keyId: signed.keyId,
      createdAt: issuedAt,
    }, desired);
    await ensureQueued(made.target);
    await announce(made.target);
    return made.target;
  };
  const stageReleaseIfIdle = async (
    release: SiteReleaseSummary,
    connections?: WordPressConnection[],
  ) => {
    if (!o.connected) return false;
    const targets = connections ||
      await o.connected.connectionsForSite(release.siteId);
    const staging = targets.find((item) =>
      item.environment === "staging" && item.status === "active"
    );
    const production = targets.find((item) =>
      item.environment === "production" && item.status === "active"
    );
    if (!staging || production?.desiredReleaseId) return false;
    if (staging.desiredReleaseId) {
      if (staging.desiredReleaseId !== release.id) return false;
      await issueTarget(release, staging, true);
      return true;
    }
    /* A release may finish compiling before the lower sequence that reserved its parent.
       Never let that race skip the parent. If the parent exists but has not been targeted yet,
       this worker may safely issue it; otherwise the parent's terminal ACK will advance the
       queue. This also survives a worker dying between `createRelease` and `createTarget`. */
    if (release.parentReleaseId) {
      const parent = await o.connected.release(release.parentReleaseId);
      if (!parent || parent.sequence !== release.sequence - 1) return false;
      const stagingTarget = await o.connected.target(staging.id, parent.id);
      if (!stagingTarget) {
        await issueTarget(parent, staging, true);
        return true;
      }
      const stagingHistory =
        (await o.connected.deploymentsForRelease(parent.id))
          .filter((item) => item.connectionId === staging.id);
      const stagingLast = stagingHistory[stagingHistory.length - 1];
      if (
        !stagingLast ||
        !["live", "failed", "rolled_back"].includes(stagingLast.status)
      ) return false;
      if (stagingLast.status === "live" && production) {
        const productionTarget = await o.connected.target(
          production.id,
          parent.id,
        );
        if (!productionTarget) return false;
        const productionHistory =
          (await o.connected.deploymentsForRelease(parent.id))
            .filter((item) => item.connectionId === production.id);
        const productionLast = productionHistory[productionHistory.length - 1];
        if (
          !productionLast ||
          !["live", "failed", "rolled_back"].includes(productionLast.status)
        ) return false;
      }
    }
    /* Do not let staging get ahead of production. One release traverses both targets before
       the next enters staging, which makes rapid publishes an ordered queue rather than a
       pair of last-write-wins pointers. */
    await issueTarget(release, staging, true);
    return true;
  };
  const stageNextRelease = async (siteId: string, afterSequence: number) => {
    if (!o.connected) return null;
    const connections = await o.connected.connectionsForSite(siteId);
    const releases = (await o.connected.releasesForSite(siteId))
      .filter((item) => item.sequence > afterSequence)
      .sort((a, b) => a.sequence - b.sequence);
    for (const release of releases) {
      const staging = connections.find((item) =>
        item.environment === "staging" && item.status === "active"
      );
      if (!staging) break;
      const existing = await o.connected.target(staging.id, release.id);
      if (existing) {
        const history = (await o.connected.deploymentsForRelease(release.id))
          .filter((item) =>
            item.connectionId === staging.id &&
            item.sequence === existing.sequence
          );
        const last = history.at(-1);
        if (last && ["live", "failed", "rolled_back"].includes(last.status)) {
          continue;
        }
        if (!staging.desiredReleaseId) {
          await issueTarget(release, staging, true);
          return release;
        }
        continue;
      }
      if (await stageReleaseIfIdle(release, connections)) return release;
      break;
    }
    return null;
  };
  const currentStagingPromotion = async (siteId: string) => {
    if (!o.connected) return null;
    const connections = await o.connected.connectionsForSite(siteId);
    const staging = connections.find((item) =>
      item.environment === "staging" && item.status === "active"
    );
    if (!staging?.activeReleaseId) return null;
    const release = await o.connected.release(staging.activeReleaseId);
    if (!release) {
      throw new Error("the active staging release could not be loaded safely");
    }
    return { staging, release, connections };
  };

  /* ----------------------------------------------------------------------------- auth */

  /* Always 200, whether or not the address is known. Answering differently would turn this
     into a way to ask which of someone's addresses has an account here — and the same is true
     of the throttle, which is why being over the limit also answers 200. Somebody hammering
     this endpoint learns nothing either way; the person whose address it is stops receiving
     mail, which is the point. */
  const limit = o.loginLimit || throttle();
  const sourceLimit = throttle(30, 15 * 60 * 1000, 5000);
  app.get("/privacy", (c) => c.html(privacyPage()));
  app.get("/terms", (c) => c.html(termsPage()));
  if (!o.accountAuth) {
    app.post(
      "/auth/login",
      bodyLimit({
        maxSize: 8 * 1024,
        onError: (c) => c.json({ error: "request is too large" }, 413),
      }),
      async (c) => {
        const body = await c.req.json().catch(() => null) as
          | { email?: string }
          | null;
        const email = normalEmail(body?.email || "");
        if (!validEmail(email)) {
          return c.json({ error: "a valid email address is required" }, 400);
        }

        if (
          sourceLimit.take(requestSource(c)) && limit.take(email) &&
          await o.auth.userByEmail(email)
        ) {
          const token = newToken();
          await o.auth.putLink(
            hashToken(token),
            email,
            Date.now() + LINK_TTL_MS,
          );
          const origin = o.editorOrigin || new URL(c.req.url).origin;
          /* Awaited, so a mail server that is refusing is a 500 here rather than a silent
         nothing — a person staring at "check your email" is owed the truth. */
          try {
            await (o.sendLink || logLink)(
              email,
              `${origin}/auth/callback?token=${token}`,
            );
          } catch (e) {
            console.error(
              "the login link could not be sent:",
              (e as Error).message,
            );
            return c.json({
              error: "the link could not be sent — try again shortly",
            }, 502);
          }
        }
        return c.json({ sent: true });
      },
    );
  }

  app.get("/auth/callback", async (c) => {
    if (o.accountAuth) return c.notFound();
    const token = c.req.query("token") || "";
    const link = token ? await o.auth.useLink(hashToken(token)) : null;
    if (!link) {
      return c.text("That link has expired or has already been used.", 400);
    }

    const user = await o.auth.userByEmail(link.email);
    if (!user) {
      return c.text("That link has expired or has already been used.", 400);
    }

    const session = newToken();
    await o.auth.putSession(
      hashToken(session),
      user.id,
      Date.now() + SESSION_TTL_MS,
    );
    setCookie(c, SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: !!o.secureCookies,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return c.redirect("/");
  });

  if (!o.accountAuth) {
    app.post("/auth/logout", async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (token) await o.auth.dropSession(hashToken(token));
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return c.json({ ok: true });
    });
  }

  if (o.accountAuth) {
    const siteKey = o.turnstileSiteKey || "";
    /* A browser drops tabs and newlines inside a URL, so "/\t/evil.test" is "//evil.test" to
       it. Resolve the value the way a browser would and keep it only if it stays here. */
    const safeNext = (raw: unknown) => {
      const value = String(raw || "");
      if (!value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return "/";
      try {
        const here = new URL("https://pagecraft.invalid");
        const url = new URL(value, here);
        return url.origin === here.origin ? url.pathname + url.search + url.hash : "/";
      } catch {
        return "/";
      }
    };
    const form = async (c: Context) => {
      const type = c.req.header("content-type") || "";
      if (type.includes("application/json")) {
        return await c.req.json().catch(() => ({})) as Record<string, unknown>;
      }
      return await c.req.parseBody().catch(() => ({})) as Record<
        string,
        unknown
      >;
    };
    const authSourceLimit = throttle(30, 15 * 60 * 1000, 5000);
    const authEmailLimit = throttle(8, 15 * 60 * 1000, 5000);
    const accountChangeLimit = throttle(8, 15 * 60 * 1000, 5000);
    const challengeToken = async (
      c: Context,
      body: Record<string, unknown>,
      action: "signup" | "login" | "forgot",
    ) => {
      const token = String(
        body["cf-turnstile-response"] || body.turnstileToken || "",
      );
      return o.challenge &&
          await o.challenge.verify({ token, ip: requestSource(c), action })
        ? token
        : "";
    };
    /* Setting a password without the current one is for a session that has just come through a
       recovery or invitation link. That arrival is recorded in a short signed cookie bound to
       the identity it verified; any other session changes its password from Security, which
       asks for the current one. */
    const RECOVERY_COOKIE = "pc_recovery";
    const RECOVERY_TTL_MS = 15 * 60 * 1000;
    const recoveryKey = o.cookieSecret || randomBytes(32).toString("hex");
    const recoverySignature = (authUserId: string, expires: string) =>
      createHmac("sha256", recoveryKey)
        .update(`pagecraft-recovery-v1\0${authUserId}\0${expires}`)
        .digest("base64url");
    const markRecovery = (c: Context, authUserId: string) => {
      const expires = String(Date.now() + RECOVERY_TTL_MS);
      setCookie(
        c,
        RECOVERY_COOKIE,
        `${expires}.${recoverySignature(authUserId, expires)}`,
        {
          httpOnly: true,
          sameSite: "Lax",
          path: "/",
          secure: !!o.secureCookies,
          maxAge: RECOVERY_TTL_MS / 1000,
        },
      );
    };
    const recovering = (c: Context, authUserId?: string | null) => {
      const [expires = "", signature = ""] = (getCookie(c, RECOVERY_COOKIE) || "")
        .split(".");
      return !!authUserId && Number(expires) > Date.now() &&
        sameDigest(signature, recoverySignature(authUserId, expires));
    };
    /* WordPress import credentials outlive any browser session, so a new password ends them.
       Revocation failing must not undo a password that has already changed. */
    const revokeWordPressImports = async (userId: string) => {
      try {
        const credentials = await o.auth.manualImportsForOwner(userId);
        for (const credential of credentials) {
          await o.auth.revokeManualImportForOwner(credential.id, userId);
        }
        return credentials.length;
      } catch (error) {
        console.error(
          "WordPress import credentials could not be revoked:",
          (error as Error).message,
        );
        return 0;
      }
    };

    app.get(
      "/sign-up",
      (c) =>
        c.html(
          signUpPage(siteKey, {
            error: c.req.query("error"),
            message: c.req.query("message"),
          }),
        ),
    );
    app.get("/sign-in", (c) =>
      c.html(accountSignInPage(siteKey, {
        error: c.req.query("error"),
        message: c.req.query("message"),
        next: safeNext(c.req.query("next")),
      })));
    app.get(
      "/forgot-password",
      (c) =>
        c.html(
          forgotPage(siteKey, {
            error: c.req.query("error"),
            message: c.req.query("message"),
          }),
        ),
    );
    app.get("/reset-password", async (c) => {
      const user = await who(c);
      if (!user) return c.redirect("/sign-in?error=reset");
      if (!recovering(c, user.authUserId)) {
        return c.redirect("/account?tab=security&error=reset");
      }
      return c.html(resetPage({
        error: c.req.query("error"),
        next: safeNext(c.req.query("next")),
      }));
    });

    app.post(
      "/auth/signup",
      bodyLimit({
        maxSize: 16 * 1024,
        onError: (c) => c.text("Request too large", 413),
      }),
      async (c) => {
        const body = await form(c);
        const email = normalEmail(String(body.email || ""));
        const name = String(body.name || "").trim().slice(0, 120);
        const password = String(body.password || "");
        const confirmation = String(body.passwordConfirm || "");
        if (!validEmail(email) || !name) {
          return c.redirect("/sign-up?error=invalid", 303);
        }
        if (password.length < 12) {
          return c.redirect("/sign-up?error=password", 303);
        }
        if (password !== confirmation) {
          return c.redirect("/sign-up?error=mismatch", 303);
        }
        const captchaToken = await challengeToken(c, body, "signup");
        if (!captchaToken) {
          return c.redirect("/sign-up?error=challenge", 303);
        }
        /* An address is charged only for requests whose challenge passed, so requests without
           one cannot use up somebody else's allowance. */
        if (
          !authSourceLimit.take(requestSource(c)) || authEmailLimit.limited(email)
        ) {
          return c.redirect(
            "/sign-up?message=Check+your+email+to+finish+creating+your+account.",
            303,
          );
        }
        const origin = o.editorOrigin || new URL(c.req.url).origin;
        const created = await o.accountAuth!.signUp(c, {
          email,
          password,
          name,
          redirectTo: `${origin}/auth/confirm`,
          captchaToken,
        });
        if (created === "challenge") {
          return c.redirect("/sign-up?error=challenge", 303);
        }
        authEmailLimit.take(email);
        return c.redirect(
          "/sign-in?message=Check+your+email+to+confirm+your+account.",
          303,
        );
      },
    );

    app.post(
      "/auth/login",
      bodyLimit({
        maxSize: 16 * 1024,
        onError: (c) => c.text("Request too large", 413),
      }),
      async (c) => {
        const body = await form(c);
        const email = normalEmail(String(body.email || ""));
        const password = String(body.password || "");
        const next = safeNext(body.next);
        /* The challenge comes first, and only a wrong password counts against an address.
           Counting every request let anyone lock somebody else out with eight empty forms. */
        const captchaToken = await challengeToken(c, body, "login");
        if (!validEmail(email) || !password || !captchaToken) {
          return c.redirect(
            `/sign-in?error=challenge&next=${encodeURIComponent(next)}`,
            303,
          );
        }
        if (
          !authSourceLimit.take(requestSource(c)) || authEmailLimit.limited(email)
        ) {
          return c.redirect(
            `/sign-in?error=auth&next=${encodeURIComponent(next)}`,
            303,
          );
        }
        const identity = await o.accountAuth!.signIn(c, {
          email,
          password,
          captchaToken,
        });
        if (identity === "challenge") {
          return c.redirect(
            `/sign-in?error=challenge&next=${encodeURIComponent(next)}`,
            303,
          );
        }
        if (!identity) {
          authEmailLimit.take(email);
          return c.redirect(
            `/sign-in?error=auth&next=${encodeURIComponent(next)}`,
            303,
          );
        }
        await o.auth.ensureAuthUser(
          identity.authUserId,
          identity.email,
          identity.name,
        );
        return c.redirect(next, 303);
      },
    );

    app.post(
      "/auth/google",
      bodyLimit({
        maxSize: 4 * 1024,
        onError: (c) => c.text("Request too large", 413),
      }),
      async (c) => {
        const body = await form(c);
        const next = safeNext(body.next);
        if (!authSourceLimit.take(requestSource(c))) {
          return c.redirect(
            `/sign-in?error=oauth&next=${encodeURIComponent(next)}`,
            303,
          );
        }
        const origin = o.editorOrigin || new URL(c.req.url).origin;
        const redirectTo = `${origin}/auth/confirm?next=${
          encodeURIComponent(next)
        }`;
        const url = await o.accountAuth!.oauth(c, {
          provider: "google",
          redirectTo,
        });
        return url ? c.redirect(url, 303) : c.redirect(
          `/sign-in?error=oauth&next=${encodeURIComponent(next)}`,
          303,
        );
      },
    );

    const confirmed = async (
      c: Context,
      identity: VerifiedIdentity | null,
      type: string | undefined,
      next: string,
    ) => {
      if (!identity) {
        return c.redirect("/sign-in?error=expired", 303);
      }
      await o.auth.ensureAuthUser(
        identity.authUserId,
        identity.email,
        identity.name,
      );
      if (type === "recovery" || type === "invite") {
        markRecovery(c, identity.authUserId);
        return c.redirect(
          `/reset-password?next=${encodeURIComponent(next)}`,
          303,
        );
      }
      return c.redirect(next, 303);
    };

    /* A `token_hash` link signs in whoever opens it, so verifying it on GET would let any page
       sign a visitor into the sender's account. It is verified from this page's own form
       instead, which the origin check confines to Pagecraft. A PKCE `code` is already bound to
       the browser that started the flow, so it is exchanged directly. */
    app.get("/auth/confirm", async (c) => {
      const type = c.req.query("type");
      const next = safeNext(c.req.query("next"));
      const code = c.req.query("code");
      const tokenHash = c.req.query("token_hash");
      if (tokenHash && !code) {
        return c.html(confirmLinkPage({ tokenHash, type: type || "", next }));
      }
      return confirmed(
        c,
        await o.accountAuth!.confirm(c, { code, type }),
        type,
        next,
      );
    });

    app.post(
      "/auth/confirm",
      bodyLimit({
        maxSize: 4 * 1024,
        onError: (c) => c.text("Request too large", 413),
      }),
      async (c) => {
        const body = await form(c);
        const type = String(body.type || "") || undefined;
        const next = safeNext(body.next);
        const tokenHash = String(body.token_hash || "");
        if (!tokenHash) return c.redirect("/sign-in?error=expired", 303);
        return confirmed(
          c,
          await o.accountAuth!.confirm(c, { tokenHash, type }),
          type,
          next,
        );
      },
    );

    app.post(
      "/auth/forgot-password",
      bodyLimit({
        maxSize: 16 * 1024,
        onError: (c) => c.text("Request too large", 413),
      }),
      async (c) => {
        const body = await form(c);
        const email = normalEmail(String(body.email || ""));
        const captchaToken = await challengeToken(c, body, "forgot");
        const allowedRequest = validEmail(email) && !!captchaToken &&
          authSourceLimit.take(requestSource(c)) &&
          !authEmailLimit.limited(email);
        if (allowedRequest) {
          const origin = o.editorOrigin || new URL(c.req.url).origin;
          const sent = await o.accountAuth!.forgot(c, {
            email,
            redirectTo: `${origin}/auth/confirm?type=recovery`,
            captchaToken,
          }).catch(() => undefined);
          // Only a request whose challenge Auth accepted counts against the address it mails.
          if (sent !== "challenge") authEmailLimit.take(email);
        }
        return c.redirect(
          "/forgot-password?message=If+an+account+matches,+reset+instructions+are+on+the+way.",
          303,
        );
      },
    );

    app.post("/auth/reset-password", async (c) => {
      const user = await who(c);
      if (!user) return c.redirect("/sign-in?error=reset", 303);
      if (!recovering(c, user.authUserId)) {
        return c.redirect("/account?tab=security&error=reset", 303);
      }
      const body = await form(c);
      const password = String(body.password || "");
      const next = safeNext(body.next);
      if (password.length < 12) {
        return c.redirect(
          `/reset-password?error=password&next=${encodeURIComponent(next)}`,
          303,
        );
      }
      if (password !== String(body.passwordConfirm || "")) {
        return c.redirect(
          `/reset-password?error=mismatch&next=${encodeURIComponent(next)}`,
          303,
        );
      }
      if (!await o.accountAuth!.reset(c, password)) {
        return c.redirect("/sign-in?error=reset", 303);
      }
      deleteCookie(c, RECOVERY_COOKIE, { path: "/" });
      await revokeWordPressImports(user.id);
      return c.redirect(
        `${next}${next.includes("?") ? "&" : "?"}message=Password+updated.`,
        303,
      );
    });

    app.post("/auth/logout", async (c) => {
      await o.accountAuth!.signOut(c);
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return c.redirect("/sign-in", 303);
    });

    app.get("/account", async (c) => {
      const [user, identity] = await Promise.all([
        who(c),
        verifiedIdentity(c),
      ]);
      if (!user || !identity) return c.redirect("/sign-in?next=%2Faccount");
      const requestedTab = c.req.query("tab");
      const tab = requestedTab === "security" || requestedTab === "plan"
        ? requestedTab
        : "profile";
      const [mine, wordpress, storage] = await Promise.all([
        visibleSites(user),
        o.auth.manualImportsForOwner(user.id),
        o.assets
          ? o.assets.usage(user.id, planEntitlements(user.plan).storageBytes)
          : { usedBytes: 0, limitBytes: planEntitlements(user.plan).storageBytes },
      ]);
      return c.html(accountSettingsPage(user, {
        providers: identity.providers || [],
        createdAt: identity.createdAt || user.createdAt,
        ownerCount: await ownedSiteCount(user, mine),
        storage,
        wordpress: wordpress.map((credential) => ({
          id: credential.id,
          installationId: credential.installationId,
          siteUrl: credential.siteUrl,
          createdAt: new Date(credential.createdAt).toISOString(),
          lastUsedAt: new Date(credential.updatedAt).toISOString(),
        })),
      }, {
        error: c.req.query("error"),
        message: c.req.query("message"),
        tab,
      }));
    });

    app.post(
      "/account/profile",
      bodyLimit({
        maxSize: 16 * 1024,
        onError: (c) => c.text("Request too large", 413),
      }),
      async (c) => {
        const [user, identity] = await Promise.all([
          who(c),
          verifiedIdentity(c),
        ]);
        if (!user || !identity) return c.redirect("/sign-in?next=%2Faccount");
        const body = await form(c);
        const name = String(body.name || "").trim().slice(0, 120);
        const email = normalEmail(String(body.email || ""));
        if (!name || !validEmail(email)) {
          return c.redirect("/account?tab=profile&error=profile", 303);
        }
        if (!accountChangeLimit.take(`${requestSource(c)}|profile`)) {
          return c.redirect("/account?tab=profile&error=password_rate", 303);
        }
        const updated = await o.auth.updateProfile(user.id, { name });
        if (!updated) {
          return c.redirect("/account?tab=profile&error=account", 303);
        }
        if (email === identity.email) {
          return c.redirect(
            "/account?tab=profile&message=Profile+updated.",
            303,
          );
        }
        const conflict = await o.auth.userByEmail(email);
        if (conflict && conflict.id !== user.id) {
          return c.redirect("/account?tab=profile&error=email_conflict", 303);
        }
        const origin = o.editorOrigin || new URL(c.req.url).origin;
        const accepted = await o.accountAuth!.updateEmail(c, {
          email,
          redirectTo: `${origin}/auth/confirm?next=%2Faccount`,
        });
        return accepted
          ? c.redirect(
            "/account?tab=profile&message=Profile+updated.+Confirm+the+new+email+address+to+finish+the+change.",
            303,
          )
          : c.redirect("/account?tab=profile&error=email_update", 303);
      },
    );

    app.post("/account/wordpress/:credentialId/revoke", async (c) => {
      const user = await who(c);
      if (!user) return c.redirect("/sign-in?next=%2Faccount", 303);
      const revoked = await o.auth.revokeManualImportForOwner(
        c.req.param("credentialId"),
        user.id,
      );
      return c.redirect(
        revoked
          ? "/account?tab=security&message=WordPress+site+disconnected."
          : "/account?tab=security&error=wordpress_missing",
        303,
      );
    });

    app.post(
      "/account/password",
      bodyLimit({
        maxSize: 16 * 1024,
        onError: (c) => c.text("Request too large", 413),
      }),
      async (c) => {
        const identity = await verifiedIdentity(c);
        if (!identity) return c.redirect("/sign-in?next=%2Faccount");
        if (!accountChangeLimit.take(`${requestSource(c)}|password`)) {
          return c.redirect("/account?tab=security&error=password_rate", 303);
        }
        const body = await form(c);
        const password = String(body.password || "");
        const currentPassword = String(body.currentPassword || "");
        if (password.length < 12) {
          return c.redirect("/account?tab=security&error=password", 303);
        }
        if (password !== String(body.passwordConfirm || "")) {
          return c.redirect("/account?tab=security&error=mismatch", 303);
        }
        const hasPassword = (identity.providers || []).includes("email");
        if (hasPassword && !currentPassword) {
          return c.redirect(
            "/account?tab=security&error=password_current",
            303,
          );
        }
        const changed = await o.accountAuth!.updatePassword(c, {
          password,
          ...(hasPassword ? { currentPassword } : {}),
        });
        if (!changed) {
          return c.redirect("/account?tab=security&error=password_current", 303);
        }
        const user = await o.auth.userByAuthId(identity.authUserId);
        const revoked = user ? await revokeWordPressImports(user.id) : 0;
        return c.redirect(
          revoked
            ? "/account?tab=security&message=Password+updated.+Connected+WordPress+sites+were+disconnected."
            : "/account?tab=security&message=Password+updated.",
          303,
        );
      },
    );
  }

  app.get("/auth/me", async (c) => {
    const user = await who(c);
    if (!user) return c.json({ user: null });
    const mine = (await visibleSites(user)).map(({ site, role }) => ({
      id: site.id,
      host: site.host,
      slug: site.slug,
      url: shareUrl(c, o, site),
      name: site.name,
      role,
    }));
    const storage = o.assets
      ? await o.assets.usage(user.id, planEntitlements(user.plan).storageBytes)
      : null;
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan || "free",
      },
      sites: mine,
      storage,
    });
  });

  /* ---------------------------------------------------------------- analytics (Phase 6) */

  /* A published page is counted only while its owner has analytics on, only for GET, and only
     through the filters in analytics.ts. Private routes (editor, previews, review snapshots)
     never come through serveHostedPublication, so they are never counted. */
  const countingFor = async (c: Context, publication: PublicationSummary, sharedHost: boolean): Promise<Counting | null> => {
    if (!o.analytics || c.req.method !== "GET") return null;
    /* A visit that is not counted gets no click counter either: signed-in Pagecraft users (whose
       beacons would not carry the cookie), privacy signals, prefetches and bots. */
    const header = (name: string) => c.req.header(name);
    if (excluded(header)) return null;
    if (!await o.analytics.enabled(publication.siteId).catch(() => false)) return null;
    const request = { header, source: requestSource(c), host: c.req.header("host") || "" };
    const own = { prefix: sharedHost ? publication.slug : undefined };
    return { view: (page) => { o.analytics!.view(publication.siteId, page, request, own); } };
  };

  /* Clicks reported by a published page's counter. Public and anonymous, so bounded: per source
     and per site, a 1 KB body, a site published here with analytics on, and a page that its
     publication has. Always 204, so it says nothing about any site. */
  const clickSource = throttle(60, 60_000, 20_000), clickSite = throttle(3000, 60_000, 5000);
  app.post("/_pc/a/:id", bodyLimit({ maxSize: 1024, onError: (c) => c.body(null, 413) }), async (c) => {
    c.header("cache-control", "no-store");
    const id = c.req.param("id");
    const done = () => c.body(null, 204);
    if (!o.analytics || !o.publications || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return done();
    if (!clickSource.take(requestSource(c)) || !clickSite.take(id)) return done();
    if (!await o.analytics.enabled(id).catch(() => false)) return done();
    const body = await c.req.text().then((text) => JSON.parse(text)).catch(() => null) as { p?: unknown; l?: unknown; t?: unknown } | null;
    if (!body || typeof body.p !== "string" || body.p.length > 300) return done();
    // Which publication the page is in: its slug on the shared host, the host anywhere else.
    let page: string;
    try { page = new URL(body.p, "https://page.invalid").pathname; } catch { return done(); }
    const shared = isEditorHost(c.req.header("host"), o);
    const [, first, ...rest] = page.split("/");
    const slug = shared ? validSlug(first || "") : null;
    const publication = shared
      ? (slug ? await o.publications.currentBySlug(slug) : null)
      : await o.publications.currentByHost((c.req.header("host") || "").split(":")[0]);
    if (!publication || publication.siteId !== id) return done();
    const file = resolvePath(shared ? "/" + rest.join("/") : page);
    if (!publication.files.some((f) => f.path === file)) return done();
    o.analytics.click(id, { label: body.l, target: body.t }, {
      header: (name: string) => c.req.header(name), source: requestSource(c), host: c.req.header("host") || "",
    });
    return done();
  });

  /* ---------------------------------------------------------------- the editor */

  app.get("/invitations", async (c) => {
    const user = await who(c);
    if (!user) return c.redirect("/sign-in?next=%2Finvitations");
    return c.html(collaborationInvitationsPage(user, await invitations.listForUser(user.id), {
      error: c.req.query("error"), message: c.req.query("message"),
    }));
  });
  app.get("/api/invitations", async (c) => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    return c.json({ invitations: await invitations.listForUser(user.id) });
  });
  for (const decision of ["accept", "decline"] as const) {
    const decide = async (c: Context, json: boolean) => {
      if (c.req.header("x-pagecraft-editor-session")) return deny(c, 403);
      const user = await who(c);
      if (!user) return json ? deny(c, 401) : c.redirect("/sign-in?next=%2Finvitations", 303);
      const result = await invitations.decide(c.req.param("id") || "", user.id, decision === "accept");
      if (result === "missing") return json ? deny(c, 404) : c.redirect("/invitations?error=invitation_missing", 303);
      return json ? c.json({ status: result }) : c.redirect(`/invitations?message=Invitation+${result}.`, 303);
    };
    app.post(`/invitations/:id/${decision}`, c => decide(c, false));
    app.post(`/api/invitations/:id/${decision}`, c => decide(c, true));
  }

  app.get("/", async (c) => {
    if (!isEditorHost(c.req.header("host"), o)) {
      const host = (c.req.header("host") || "").split(":")[0];
      if (o.publications) {
        const publication = await o.publications.currentByHost(host);
        return publication
          ? serveHostedPublication(c, o.publications, publication, "/", false, await countingFor(c, publication, false))
          : c.text(`No published site for host ${host}`, 404);
      }
      const site = await o.store.byHost(host);
      if (!site) return c.text(`No site for host ${host}`, 404);
      return serveSite(c, o, built, render, "/", site);
    }
    const user = await who(c);
    if (o.accountAuth) {
      if (!user) return c.redirect("/sign-in");
      /* Independent reads: the site list and the storage meter used to wait for each other. */
      const [visible, storage, pendingInvitations] = await Promise.all([
        visibleSites(user),
        o.assets
          ? o.assets.usage(user.id, planEntitlements(user.plan).storageBytes)
          : { usedBytes: 0, limitBytes: planEntitlements(user.plan).storageBytes },
        invitations.listForUser(user.id),
      ]);
      const mine = visible.sort((a, b) =>
        new Date(b.site.updatedAt).getTime() -
        new Date(a.site.updatedAt).getTime()
      );
      const templates = o.siteTemplates ? latestSiteTemplates(await o.siteTemplates.list().catch(error => {
        console.error('site template catalog unavailable', error);
        return [];
      })) : [];
      return c.html(dashboardPage(
        user,
        await Promise.all(mine.map(async ({ site, role }) => {
          const cached = await sitePreviews.get(site.id);
          return {
          id: site.id,
          name: site.name,
          role,
          updatedAt: site.updatedAt,
          url: shareUrl(c, o, site),
          draftPreviewUrl: `/api/sites/${encodeURIComponent(site.id)}/dashboard-preview/index.html?v=${site.version}`,
          previewVersion: previewVersion(site),
          previewUrl: cached ? previewUrl(site.id, cached.version) : undefined,
          cachedPreviewVersion: cached?.version,
          published: !!site.publishedPublicationId &&
            site.version === site.publishedVersion,
        }; })),
        await ownedSiteCount(user, mine),
        storage,
        templates,
        c.req.query("error"),
        c.req.query("message"),
        pendingInvitations.length,
      ));
    }
    if (!user) return c.html(signInPage());

    const mine = await visibleSites(user);
    if (!mine.length) return c.html(emptyPage(user.email));
    /* one site is the common case, and a picker with one row on it is a click for nothing */
    if (mine.length === 1) return c.redirect(`/edit/${mine[0].site.id}`);
    /* `where` rather than the host: a site with no domain has a placeholder one that never
       resolves, and printing `unclaimed-3f2a….invalid` under its name would be the picker lying
       about where the site is. */
    return c.html(pickerPage(
      user.email,
      mine.map((m) => ({
        id: m.site.id,
        name: m.site.name,
        role: m.role,
        where: /\.invalid$/.test(m.site.host)
          ? `/${m.site.slug}/`
          : m.site.host,
      })),
    ));
  });

  app.get("/templates/:id/:version/preview/*", async (c) => {
    if (!o.siteTemplates) return c.notFound();
    const prefix = `/templates/${encodeURIComponent(c.req.param("id"))}/${encodeURIComponent(c.req.param("version"))}/preview/`;
    let path = "";
    try {
      path = decodeURIComponent(new URL(c.req.url).pathname.slice(prefix.length)) ||
        "index.html";
    } catch {
      return c.notFound();
    }
    const file = await o.siteTemplates.preview(
      c.req.param("id"),
      c.req.param("version"),
      path,
    ).catch(() => null);
    if (!file) return c.notFound();
    c.header("content-type", file.mediaType);
    c.header("cache-control", "public, max-age=31536000, immutable");
    /* Sites created before template images were copied into each site keep absolute URLs to
       these files, so they stay served. The dashboard thumbnail inlines images with fetch(),
       which a document saved on the other environment's origin (shared pre-launch database)
       can only do with CORS. These bytes are public and immutable; the preview page itself
       stays same-origin. */
    if (!file.mediaType.startsWith("text/html")) c.header("access-control-allow-origin", "*");
    /* A template page runs its own interaction scripts, and it is served from the editor's
       origin, framed by the dashboard. `sandbox allow-scripts` gives it an opaque origin, as the
       publication preview has: the scripts run, but never with the editor's cookie or API. Its
       images and fonts still load — `'self'` matches the URL it came from, and the assets carry
       the CORS header an opaque origin needs. */
    c.header(
      "content-security-policy",
      "sandbox allow-scripts; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'none'",
    );
    return c.body(file.bytes.slice().buffer);
  });

  app.get("/sites/:id", async (c) => {
    const id = c.req.param("id");
    /* The same overlap as the editor route: read the row while access is checked, and say
       nothing about it until the check passes. The published revision only dates the last
       publish; for a signed-in caller it is read beside the membership check, not after it. */
    const loading = o.store.byId(id);
    const revisionOf = (site: Site | null) => site && site.publishedVersion > 0
      ? o.store.revision(site.id, site.publishedVersion)
      : Promise.resolve(null);
    const [access, snapshot, early] = await Promise.allSettled([
      allowedMember(c, id),
      loading,
      c.req.header("x-pagecraft-editor-session")
        ? Promise.resolve(undefined)
        : Promise.all([who(c), loading]).then(([user, site]) =>
          user ? revisionOf(site) : undefined
        ),
    ]);
    if (access.status === "rejected") throw access.reason;
    const gate = access.value;
    if (!gate.ok) {
      return gate.status === 401
        ? c.redirect(
          `/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`,
        )
        : deny(c, gate.status);
    }
    if (snapshot.status === "rejected") throw snapshot.reason;
    const site = snapshot.value;
    if (!site) return deny(c, 404);
    if (early.status === "rejected") throw early.reason;
    const publishedRevision = early.value === undefined
      ? await revisionOf(site)
      : early.value;
    return c.html(siteOverviewPage(gate.user, {
      id: site.id,
      name: site.name,
      slug: site.slug,
      role: gate.role,
      updatedAt: site.updatedAt,
      url: shareUrl(c, o, site),
      published: site.version === site.publishedVersion,
      version: site.version,
      publishedVersion: site.publishedVersion,
      publishedAt: publishedRevision?.createdAt,
      customDomain: /\.invalid$/.test(site.host) ? undefined : site.host,
    }));
  });

  app.get("/sites/:id/people", async (c) => {
    const id = c.req.param("id");
    const gate = await allowedMember(c, id);
    if (!gate.ok) {
      return gate.status === 401
        ? c.redirect(
          `/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`,
        )
        : deny(c, gate.status);
    }
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const pendingOwners = gate.role === "owner" ? await invitations.listForResource("site_owner", id) : [];
    const members = gate.role === "owner" ? await o.auth.members(id) : [{
      userId: gate.user.id,
      email: gate.user.email,
      name: gate.user.name,
      role: gate.role,
      authUserId: gate.user.authUserId,
    }];
    return c.html(sitePeoplePage(
      gate.user,
      {
        id: site.id,
        name: site.name,
        slug: site.slug,
        role: gate.role,
        updatedAt: site.updatedAt,
        url: shareUrl(c, o, site),
        published: site.version === site.publishedVersion,
        version: site.version,
        publishedVersion: site.publishedVersion,
      },
      [...members.map((member) => ({
        userId: member.userId, email: member.email, name: member.name,
        role: member.role, active: !!member.authUserId,
      })), ...pendingOwners.map(invitation => ({
        userId: invitation.recipientId, email: invitation.recipientEmail, name: invitation.recipientName,
        role: "owner" as const, active: false, awaitingAcceptance: true,
      }))],
      { error: c.req.query("error"), message: c.req.query("message") },
    ));
  });

  app.post("/sites/:id/people/invite", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const body = await c.req.parseBody().catch(() => ({})) as Record<
      string,
      string | File
    >;
    const email = normalEmail(String(body.email || ""));
    const role = String(body.role || "") as Role;
    const base = `/sites/${encodeURIComponent(id)}/people`;
    if (!validEmail(email)) {
      return c.redirect(`${base}?error=people_email`, 303);
    }
    if (!isSiteRole(role)) {
      return c.redirect(`${base}?error=people_role`, 303);
    }
    const allowedInvitation = inviteSourceLimit.take(requestSource(c)) &&
      inviteAccountLimit.take(gate.user.id) &&
      inviteSiteLimit.take(id) &&
      inviteEmailLimit.take(email) &&
      inviteCooldown.take(`${id}|${email}`);
    if (!allowedInvitation) {
      c.header("retry-after", "60");
      return c.redirect(`${base}?error=people_rate`, 303);
    }

    const genericSuccess =
      `${base}?message=Access+updated.+An+invitation+was+sent+if+needed.`;
    const origin = o.editorOrigin || new URL(c.req.url).origin;
    const next = `/sites/${id}/people`;
    if (role === "owner") {
      const recipient = await invitationRecipient(email);
      const invited = await inviteOwnership(c, id, gate.user, recipient);
      if (invited.status === "forbidden") return deny(c, 404);
      return c.redirect(`${base}?message=${invited.status === "pending" ? "Ownership+invitation+sent.+Access+starts+after+acceptance." : "This+person+already+owns+the+site."}`, 303);
    }
    const recipient = await o.auth.userByEmail(email);
    if (recipient) await invitations.removeForRecipient("site_owner", id, recipient.id);
    const provisioned = await o.auth.provisionInvitation({
      siteId: id,
      actorUserId: gate.user.id,
      email,
      role,
      redirectTo: `${origin}/auth/confirm?type=invite&next=${
        encodeURIComponent(next)
      }`,
    });
    if (provisioned.status === "last_owner") {
      return c.redirect(`${base}?error=people_last_owner`, 303);
    }
    if (provisioned.status === "forbidden") return deny(c, 404);
    /* Delivery is best-effort here. The durable outbox is also drained on an interval, so a
       transient Supabase/SMTP failure cannot roll back or strand the membership grant. */
    await o.auth.drainInvitationOutbox(`request-${crypto.randomUUID()}`, 5)
      .catch((error) => {
        console.error(
          "collaborator invitation outbox could not be drained:",
          (error as Error).message,
        );
      });
    return c.redirect(genericSuccess, 303);
  });

  app.post("/sites/:id/people/:userId/role", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const body = await c.req.parseBody().catch(() => ({})) as Record<
      string,
      string | File
    >;
    const role = String(body.role || "") as Role;
    const base = `/sites/${encodeURIComponent(id)}/people`;
    if (!isSiteRole(role)) {
      return c.redirect(`${base}?error=people_role`, 303);
    }
    if (c.req.param("userId") === gate.user.id && role !== "owner") {
      // Refused either way; only say "last owner" when it is true.
      const owners = (await o.auth.members(id)).filter((member) => member.role === "owner");
      return c.redirect(`${base}?error=${owners.some((member) => member.userId !== gate.user.id) ? "people_self_role" : "people_last_owner"}`, 303);
    }
    const target = c.req.param("userId");
    if (role === "owner") {
      const recipient = await o.auth.userById(target);
      if (!recipient || !await o.auth.membership(id, target)) return c.redirect(`${base}?error=people_missing`, 303);
      const invited = await inviteOwnership(c, id, gate.user, recipient);
      if (invited.status === "forbidden") return deny(c, 404);
      return c.redirect(`${base}?message=Ownership+invitation+sent.+Access+starts+after+acceptance.`, 303);
    }
    await invitations.removeForRecipient("site_owner", id, target);
    const changed = await o.auth.changeMemberRole(id, target, role);
    if (changed.status === "last_owner") {
      return c.redirect(`${base}?error=people_last_owner`, 303);
    }
    if (changed.status === "missing") {
      return c.redirect(`${base}?error=people_missing`, 303);
    }
    return c.redirect(`${base}?message=Role+updated.`, 303);
  });

  app.post("/sites/:id/people/:userId/invitation/cancel", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const base = `/sites/${encodeURIComponent(id)}/people`;
    const cancelled = await invitations.removeForRecipient("site_owner", id, c.req.param("userId"));
    return c.redirect(`${base}?${cancelled ? "message=Ownership+invitation+cancelled." : "error=people_missing"}`, 303);
  });

  app.post("/sites/:id/people/:userId/remove", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const base = `/sites/${encodeURIComponent(id)}/people`;
    const pendingRemoved = await invitations.removeForRecipient("site_owner", id, c.req.param("userId"));
    const removed = await o.auth.removeMember(id, c.req.param("userId"));
    if (removed.status === "last_owner") {
      return c.redirect(`${base}?error=people_last_owner`, 303);
    }
    if (removed.status === "missing" && !pendingRemoved) {
      return c.redirect(`${base}?error=people_missing`, 303);
    }
    return c.redirect(`${base}?message=Collaborator+removed.`, 303);
  });

  /* Every member can leave; an owner must leave another owner in place. */
  app.post("/sites/:id/people/leave", async (c) => {
    const id = c.req.param("id");
    // Only the person, in their own browser: an editor session cannot give up its owner's access.
    if (c.req.header("x-pagecraft-editor-session")) return deny(c, 403);
    const gate = await allowedMember(c, id);
    if (!gate.ok) return deny(c, gate.status);
    const base = `/sites/${encodeURIComponent(id)}/people`;
    const removed = await o.auth.removeMember(id, gate.user.id);
    if (removed.status === "last_owner") {
      return c.redirect(`${base}?error=people_last_owner`, 303);
    }
    if (removed.status === "missing") {
      return c.redirect(`${base}?error=people_missing`, 303);
    }
    return c.redirect("/?message=You+left+the+site.", 303);
  });

  const invitationRecipient = async (email: string) => {
    const existing = await o.auth.userByEmail(email);
    if (existing) return existing;
    try { return await o.auth.createUser(email); }
    catch (error) {
      const concurrent = await o.auth.userByEmail(email);
      if (!concurrent) throw error;
      return concurrent;
    }
  };
  const inviteOwnership = async (c: Context, siteId: string, actor: User, recipient: User) => {
    const invited = await invitations.invite({ kind: "site_owner", resourceId: siteId, recipientId: recipient.id, invitedBy: actor.id });
    if (invited.status === "pending") {
      const site = await o.store.byId(siteId);
      notifyReview(c, {
        userId: recipient.id, email: recipient.email, kind: "review_assigned",
        title: `${actor.name || actor.email} invited you to own a site`,
        body: `Accept the ownership invitation for “${site?.name || "this site"}” before gaining owner access. Declining keeps your existing access unchanged.`,
        href: "/invitations",
      }).catch(error => console.error("ownership invitation notice failed:", (error as Error).message));
    }
    return invited;
  };
  const wordpressSiteUrl = (callback: string) => {
    const url = new URL(callback);
    url.pathname = url.pathname.replace(/wp-admin\/admin-post\.php$/, "");
    url.search = ""; url.hash = "";
    return url.href;
  };
  const notifyReview = async (c: Context, input: {
    userId: string; email: string; kind: string; title: string; body: string; href: string;
  }) => {
    const origin = o.editorOrigin || new URL(c.req.url).origin;
    const href = input.href.startsWith("http") ? input.href : `${origin}${input.href}`;
    await reviews.notify({
      userId: input.userId, kind: input.kind, title: input.title, body: input.body, href,
    });
    const work = await reviews.enqueueEmail({
      to: input.email, subject: input.title, body: `${input.body}\n${href}`,
    });
    if (!o.sendNotice) return;
    try {
      await o.sendNotice(work.to, work.subject, work.body);
      await reviews.markEmailDelivered(work.id);
    } catch (error) {
      console.error(
        "review notice could not be emailed:",
        (error as Error).message,
      );
    }
  };

  liveReviewRoutes(app, {
    store: o.store, auth: o.auth, reviews: liveReviews, who, requestSource,
    origin: o.editorOrigin, secure: o.secureCookies,
    notifyInvitation: async (c, user, href, kind) => {
      await notifyReview(c, { userId: user.id, email: user.email, kind: 'review_assigned', title: 'A site was shared with you', body: `You have been invited as a ${kind === 'developer' ? 'developer' : 'reviewer'}. Sign in with this email to view the site under Shared.`, href });
    },
    preview: async (siteId, page) => {
      const site = await o.store.byId(siteId);
      if (!site) return null;
      const records = await assetsOf(siteId);
      const compiled = candidate(site.doc, records);
      const html = compiled?.files.get(page);
      if (!compiled || !html || !page.endsWith('.html')) return null;
      const resources = new Map<string, { type: string; bytes: Uint8Array }>();
      for (const [path, value] of compiled.files) resources.set(path, { type: typeOf(path), bytes: new TextEncoder().encode(value) });
      await Promise.all(records.map(async record => {
        const path = assetFile(record);
        const asset = await o.assets?.byPath(siteId, path);
        if (asset) resources.set(path, { type: asset.type, bytes: asset.bytes });
      }));
      const previewStore = { file: async (_publication: unknown, path: string) => resources.get(path)?.bytes || null } as unknown as HostedPublicationStore;
      const publication = { files: [...resources].map(([path, value]) => ({ path, mediaType: value.type })) } as unknown as Parameters<typeof publicationPreviewHtml>[1];
      const inlined = await publicationPreviewHtml(previewStore, publication, page, html);
      return { html: inlined, version: site.version, pages: [...compiled.files.keys()].filter(path => path.endsWith('.html')).map(path => ({ path, name: path === 'index.html' ? 'Home' : path.replace(/\/index\.html$|\.html$/g, '') })) };
    },
  });

  app.get("/sites/:id/reviews", async (c) => {
    const id = c.req.param("id");
    let gate = await allowedReview(c, id);
    if (!gate.ok && gate.status === 403 && c.req.query('legacy') !== '1') {
      const member = await allowedMember(c, id);
      if (member.ok && await liveReviews.invited(id, normalEmail(member.user.email))) gate = member;
    }
    if (!gate.ok) {
      return gate.status === 401
        ? c.redirect(`/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`)
        : deny(c, gate.status);
    }
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const liveInvited = await liveReviews.invited(id, normalEmail(gate.user.email));
    const liveDeveloper = await liveReviews.invited(id, normalEmail(gate.user.email), 'developer');
    const liveLinks = (await liveReviews.links(id)).filter(link => link.active && (gate.role === 'owner' || link.access === 'public' || link.access === 'private' && liveInvited || link.access === 'developer' && liveDeveloper));
    const invitations = gate.role === 'owner' ? await liveReviews.invitations(id) : [];
    // Snapshot reviews still waiting on this person, otherwise found only through Notifications.
    const assigned = gate.role === "owner" || gate.role === "reviewer"
      ? (await Promise.all((await reviews.assignmentsForReviewer(id, gate.user.id))
        .map(async (row) => (await reviews.decision(row.id)) ? null : row))).filter((row) => row !== null)
      : [];
    return c.html(siteReviewsPage(gate.user, {
      id: site.id,
      name: site.name,
      slug: site.slug,
      role: gate.role,
      updatedAt: site.updatedAt,
      url: shareUrl(c, o, site),
      published: site.version === site.publishedVersion,
      version: site.version,
      publishedVersion: site.publishedVersion,
    }, {
      links: liveLinks,
      invitations,
      assigned,
      error: c.req.query("error"),
      message: c.req.query("message"),
    }));
  });

  app.post("/sites/:id/reviews/assign", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const body = await c.req.parseBody().catch(() => ({})) as Record<string, string | File>;
    const publicationId = String(body.publicationId || "").trim();
    const reviewerUserId = String(body.reviewerUserId || "").trim();
    const base = `/sites/${encodeURIComponent(id)}/reviews`;
    if (!o.publications || !/^[0-9a-f-]{36}$/i.test(publicationId) ||
      !(await o.publications.byId(id, publicationId))) {
      return c.redirect(`${base}?error=review_snapshot`, 303);
    }
    const membership = await o.auth.membership(id, reviewerUserId);
    if (membership?.role !== "reviewer") {
      return c.redirect(`${base}?error=review_reviewer`, 303);
    }
    const assignment = await reviews.assign({
      siteId: id, publicationId, reviewerUserId, assignedBy: gate.user.id,
    });
    const [reviewer, named] = await Promise.all([
      o.auth.userById(reviewerUserId),
      o.store.byId(id),
    ]);
    if (reviewer) {
      await notifyReview(c, {
        userId: reviewer.id,
        email: reviewer.email,
        kind: "review_assigned",
        title: "A review preview was assigned to you",
        body: `${gate.user.email} assigned a private preview of ${named?.name || "this site"}.`,
        href: `${base}/${assignment.id}`,
      });
    }
    return c.redirect(`${base}?message=Preview+assigned.`, 303);
  });

  app.get("/sites/:id/reviews/:assignmentId", async (c) => {
    const id = c.req.param("id");
    const gate = await allowedReview(c, id);
    if (!gate.ok) {
      return gate.status === 401
        ? c.redirect(`/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`)
        : deny(c, gate.status);
    }
    const assignment = await reviews.assignment(id, c.req.param("assignmentId"));
    if (!assignment) return deny(c, 404);
    if (gate.role === "reviewer" && assignment.reviewerUserId !== gate.user.id) {
      return deny(c, 404);
    }
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const reviewer = await o.auth.userById(assignment.reviewerUserId);
    const comments = await Promise.all((await reviews.comments(assignment.id)).map(async (row) => {
      const author = await o.auth.userById(row.authorUserId);
      return { ...row, authorEmail: author?.email || row.authorUserId };
    }));
    const indexPath = o.publications
      ? ((await o.publications.byId(id, assignment.publicationId))?.files.find(file =>
        file.path === "index.html"
      )?.path || "index.html")
      : "index.html";
    return c.html(siteReviewDetailPage(gate.user, {
      id: site.id,
      name: site.name,
      slug: site.slug,
      role: gate.role,
      updatedAt: site.updatedAt,
      url: shareUrl(c, o, site),
      published: site.version === site.publishedVersion,
      version: site.version,
      publishedVersion: site.publishedVersion,
    }, {
      assignment,
      reviewerEmail: reviewer?.email || assignment.reviewerUserId,
      comments,
      decision: await reviews.decision(assignment.id),
      previewSrc: `/api/sites/${encodeURIComponent(id)}/publication-snapshots/${encodeURIComponent(assignment.publicationId)}/files/${indexPath}`,
      error: c.req.query("error"),
      message: c.req.query("message"),
    }));
  });

  app.post("/sites/:id/reviews/:assignmentId/comments", async (c) => {
    const id = c.req.param("id");
    const gate = await allowedReview(c, id);
    if (!gate.ok) return deny(c, gate.status);
    const assignment = await reviews.assignment(id, c.req.param("assignmentId"));
    if (!assignment) return deny(c, 404);
    if (gate.role === "reviewer" && assignment.reviewerUserId !== gate.user.id) {
      return deny(c, 404);
    }
    const body = await c.req.parseBody().catch(() => ({})) as Record<string, string | File>;
    const base = `/sites/${encodeURIComponent(id)}/reviews/${encodeURIComponent(assignment.id)}`;
    if ((await reviews.decision(assignment.id))?.status === "cancelled") {
      return c.redirect(`${base}?error=review_decision`, 303);
    }
    try {
      const comment = await reviews.addComment({
        assignmentId: assignment.id,
        authorUserId: gate.user.id,
        body: String(body.body || ""),
        pageSlug: String(body.pageSlug || ""),
        nodeId: String(body.nodeId || ""),
      });
      const owners = (await o.auth.members(id)).filter(member => member.role === "owner");
      for (const owner of owners) {
        if (owner.userId === gate.user.id) continue;
        await notifyReview(c, {
          userId: owner.userId,
          email: owner.email,
          kind: "review_comment",
          title: "New review comment",
          body: comment.body.slice(0, 180),
          href: base,
        });
      }
      return c.redirect(`${base}?message=Comment+added.`, 303);
    } catch {
      return c.redirect(`${base}?error=review_comment`, 303);
    }
  });

  app.post("/sites/:id/reviews/:assignmentId/decision", async (c) => {
    const id = c.req.param("id");
    const gate = await allowedReview(c, id);
    if (!gate.ok) return deny(c, gate.status);
    const assignment = await reviews.assignment(id, c.req.param("assignmentId"));
    if (!assignment) return deny(c, 404);
    const body = await c.req.parseBody().catch(() => ({})) as Record<string, string | File>;
    const status = String(body.status || "");
    const base = `/sites/${encodeURIComponent(id)}/reviews/${encodeURIComponent(assignment.id)}`;
    if (!isReviewDecision(status)) return c.redirect(`${base}?error=review_decision`, 303);
    if (status === "cancelled" && gate.role !== "owner") return deny(c, 403);
    if (gate.role === "reviewer" && assignment.reviewerUserId !== gate.user.id) {
      return deny(c, 404);
    }
    try {
      await reviews.decide({
        assignmentId: assignment.id,
        actorUserId: gate.user.id,
        status,
        note: String(body.note || ""),
      });
    } catch {
      return c.redirect(`${base}?error=review_decision`, 303);
    }
    const reviewer = await o.auth.userById(assignment.reviewerUserId);
    const owners = (await o.auth.members(id)).filter(member => member.role === "owner");
    const recipients = status === "cancelled"
      ? (reviewer ? [{ userId: reviewer.id, email: reviewer.email }] : [])
      : owners.filter(owner => owner.userId !== gate.user.id);
    for (const person of recipients) {
      await notifyReview(c, {
        userId: person.userId,
        email: person.email,
        kind: "review_decision",
        title: `Review ${status.replace("_", " ")}`,
        body: `${gate.user.email} recorded ${status.replace("_", " ")} on a snapshot.`,
        href: base,
      });
    }
    return c.redirect(`${base}?message=Review+updated.`, 303);
  });

  app.get("/api/notifications/mini", async (c) => {
    const user = await who(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const examples = c.req.query("examples") === "1";
    const notices = examples
      ? notificationStatusExamples()
      : await reviews.notices(user.id);
    return c.json({
      unread: notices.filter((item) => !item.readAt).length,
      listHtml: notificationsMiniMarkup(notices),
    });
  });

  app.get("/notifications", async (c) => {
    const user = await who(c);
    if (!user) {
      return c.redirect(`/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`);
    }
    const examples = c.req.query("examples") === "1";
    if (examples) {
      return c.html(notificationsPage(user, notificationStatusExamples(), { examples: true }));
    }
    const notices = await reviews.notices(user.id);
    for (const notice of notices.filter(item => !item.readAt)) {
      await reviews.markRead(user.id, notice.id);
    }
    return c.html(notificationsPage(user, notices));
  });

  submissionRoutes(app, { store: o.store, submissions: o.submissions, publications: o.publications, allowed, editorOrigin: o.editorOrigin, requestSource, analytics: o.analytics });
  /* Phase 7: assistants propose over MCP, owners review in the editor. */
  const assistantDeps: AssistantDeps = {
    store: o.store, auth: o.auth, assets: o.assets, assistants: o.assistants, reviews, editorOrigin: o.editorOrigin, allowed,
    render: (doc, assets) => candidate(doc, assets), assetHeaders: (asset) => assetHeaders(asset as Pick<Asset, "type" | "name">),
  };
  assistantRoutes(app, assistantDeps);
  assistantOAuthRoutes(app, {
    assistants: o.assistants, oauth: o.assistantOAuth, editorOrigin: o.editorOrigin, who, requestSource,
    isEditorHost: (c) => isEditorHost(c.req.header("host"), o),
    ownedSites: async (user) => (await visibleSites(user)).filter((x) => x.role === "owner").map((x) => ({ id: x.site.id, name: x.site.name })),
    page: shell,
  });
  cloudIntegrationRoutes(app, { store: o.store, integrations: o.cloudIntegrations, assets: o.assets, allowed, editorOrigin: o.editorOrigin });

  /* ---- the owner's Analytics page (Phase 6). Owners only, like Integrations and Settings. */
  const analyticsGate = async (c: Context) => {
    const id = c.req.param("id")!;
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) {
      return {
        ok: false as const,
        response: gate.status === 401
          ? c.redirect(`/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`)
          : deny(c, gate.status),
      };
    }
    const site = await o.store.byId(id);
    if (!site) return { ok: false as const, response: deny(c, 404) };
    return { ok: true as const, gate, site };
  };
  const analyticsRange = (c: Context): RangeKey => {
    const range = c.req.query("range");
    return isRange(range) ? range : "30d";
  };
  /** The report for a range, from the files and this process's latest counts. */
  const analyticsFor = async (siteId: string, range: RangeKey, doc: Doc) => {
    const recorder = o.analytics!;
    await recorder.flush();
    const tz = (await recorder.store.settings(siteId)).timeZone || "UTC";
    const span = rangeDays(range, new Date(), tz);
    const [current, previous] = await Promise.all([
      recorder.store.read(siteId, span.from, span.to, tz),
      recorder.store.read(siteId, span.previous.from, span.previous.to, tz),
    ]);
    const names = new Map(siteForms(doc).map((form) => [form.id, form.name]));
    return { current, report: analyticsReport(range, current, previous, (id) => names.get(id) || id), names };
  };

  app.get("/sites/:id/analytics", async (c) => {
    const found = await analyticsGate(c);
    if (!found.ok) return found.response;
    const { gate, site } = found;
    const publishedRevision = site.publishedVersion > 0 ? await o.store.revision(site.id, site.publishedVersion) : null;
    const overview = {
      id: site.id, name: site.name, slug: site.slug, role: gate.role, updatedAt: site.updatedAt, url: shareUrl(c, o, site),
      published: site.version === site.publishedVersion, version: site.version, publishedVersion: site.publishedVersion,
      publishedAt: publishedRevision?.createdAt, customDomain: /\.invalid$/.test(site.host) ? undefined : site.host,
    };
    if (!o.analytics) return c.html(siteAnalyticsPage(gate.user, overview, { available: false, enabled: false, report: null, timeZone: "UTC", timeZones: [] }));
    const settings = await o.analytics.store.settings(site.id);
    const { report } = await analyticsFor(site.id, analyticsRange(c), site.doc);
    return c.html(siteAnalyticsPage(gate.user, overview, {
      available: true, enabled: settings.enabled, report, timeZone: settings.timeZone || "UTC", timeZones: timeZones(),
    }, {
      error: c.req.query("error"), message: c.req.query("message"),
    }));
  });

  app.get("/sites/:id/analytics.csv", async (c) => {
    const found = await analyticsGate(c);
    if (!found.ok) return found.response;
    if (!o.analytics) return deny(c, 404);
    const range = analyticsRange(c);
    const { current, names } = await analyticsFor(found.site.id, range, found.site.doc);
    const name = found.site.slug || "site";
    return c.body(toCsv(csvRows(current), (id) => names.get(id) || id), 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}-analytics-${range}.csv"`,
      "cache-control": "no-store",
    });
  });

  for (const [action, enabled, message] of [
    ["enable", true, "Analytics is on. Visits are counted from now on."],
    ["disable", false, "Analytics is off. The numbers so far are kept until you delete them."],
  ] as const) {
    app.post(`/sites/:id/analytics/${action}`, async (c) => {
      const found = await analyticsGate(c);
      if (!found.ok) return found.response;
      if (!o.analytics) return deny(c, 404);
      // The first time it is turned on, days follow the owner's own time zone, sent by their browser.
      const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
      const current = await o.analytics.store.settings(found.site.id);
      const zone = enabled && !current.timeZone ? validTimeZone(form.timeZone) : null;
      await o.analytics.store.setEnabled(found.site.id, enabled, found.gate.user.id, zone);
      return c.redirect(`/sites/${encodeURIComponent(found.site.id)}/analytics?message=${encodeURIComponent(message)}`, 303);
    });
  }

  app.post("/sites/:id/analytics/timezone", async (c) => {
    const found = await analyticsGate(c);
    if (!found.ok) return found.response;
    if (!o.analytics) return deny(c, 404);
    const base = `/sites/${encodeURIComponent(found.site.id)}/analytics`;
    const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
    const zone = validTimeZone(form.timeZone);
    if (!zone) return c.redirect(`${base}?error=analytics_timezone`, 303);
    await o.analytics.store.setTimeZone(found.site.id, zone, found.gate.user.id);
    return c.redirect(`${base}?message=${encodeURIComponent(`Days now follow ${zone}.`)}`, 303);
  });

  app.post("/sites/:id/analytics/delete", async (c) => {
    const found = await analyticsGate(c);
    if (!found.ok) return found.response;
    if (!o.analytics) return deny(c, 404);
    const base = `/sites/${encodeURIComponent(found.site.id)}/analytics`;
    const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
    if (form.confirmed !== "yes") return c.redirect(`${base}?error=analytics_confirm`, 303);
    // Flush first, so nothing buffered in this process is written back after the delete.
    await o.analytics.flush();
    await o.analytics.store.remove(found.site.id);
    return c.redirect(`${base}?message=${encodeURIComponent("Every number for this site was deleted, and analytics is off.")}`, 303);
  });

  app.get("/sites/:id/settings", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) {
      return gate.status === 401
        ? c.redirect(
          `/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`,
        )
        : deny(c, gate.status);
    }
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const publishedRevision = site.publishedVersion > 0
      ? await o.store.revision(site.id, site.publishedVersion)
      : null;
    return c.html(siteSettingsPage(gate.user, {
      id: site.id,
      name: site.name,
      slug: site.slug,
      role: gate.role,
      updatedAt: site.updatedAt,
      url: shareUrl(c, o, site),
      published: site.version === site.publishedVersion,
      version: site.version,
      publishedVersion: site.publishedVersion,
      publishedAt: publishedRevision?.createdAt,
      customDomain: /\.invalid$/.test(site.host) ? undefined : site.host,
    }, { error: c.req.query("error"), message: c.req.query("message") }));
  });

  app.post("/sites/:id/settings/name", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const body = await c.req.parseBody().catch(() => ({})) as Record<
      string,
      string | File
    >;
    const name = String(body.name || "").trim();
    if (!name || name.length > 120) {
      return c.redirect(
        `/sites/${encodeURIComponent(id)}/settings?error=site_name`,
        303,
      );
    }
    const changed = await o.store.setName(id, name);
    if (!changed) {
      return c.redirect(
        `/sites/${encodeURIComponent(id)}/settings?error=site_settings`,
        303,
      );
    }
    return c.redirect(
      `/sites/${encodeURIComponent(id)}/settings?message=Site+name+updated.`,
      303,
    );
  });

  app.post("/sites/:id/settings/slug", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const body = await c.req.parseBody().catch(() => ({})) as Record<
      string,
      string | File
    >;
    const slug = validSlug(body.slug || "");
    if (!slug) {
      return c.redirect(
        `/sites/${encodeURIComponent(id)}/settings?error=site_slug`,
        303,
      );
    }
    const moved = await o.store.setSlug(id, slug);
    if (!moved) {
      return c.redirect(
        `/sites/${encodeURIComponent(id)}/settings?error=site_slug_taken`,
        303,
      );
    }
    await o.publications?.releaseSlug(moved.slug, id);
    await o.publications?.relocate(id, moved.slug, moved.host);
    built.delete(id);
    return c.redirect(
      `/sites/${
        encodeURIComponent(id)
      }/settings?message=Pagecraft+address+updated.`,
      303,
    );
  });

  app.post("/sites/:id/settings/delete", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const body = await c.req.parseBody().catch(() => ({})) as Record<
      string,
      string | File
    >;
    if (String(body.confirmation || "") !== site.name) {
      return c.redirect(
        `/sites/${encodeURIComponent(id)}/settings?error=site_delete_confirm`,
        303,
      );
    }
    const memberIds = (await o.auth.members(id)).map((member) => member.userId);
    /* The database delete goes first and the files follow only once it has succeeded, so a
       failed delete leaves the site, its inbox and its public address exactly as they were.
       After it nobody can manage these files, so a cleanup failure is logged, not reported as
       a failed delete. The publication tombstone goes first so public routing ends first. */
    const remove = async () => {
      if (!await o.store.delete(id)) return false;
      const cleanup: [string, () => Promise<unknown>][] = [
        ["publication", async () => o.publications?.removeSite(id)],
        ["submissions", async () => o.submissions?.removeSite(id)],
        ["preview", () => sitePreviews.remove(id)],
        ["integration", async () => o.cloudIntegrations?.connections.put(id, null)],
        ["analytics", async () => {
          // Flush first, so nothing buffered in this process is written back afterwards.
          await o.analytics?.flush();
          await o.analytics?.store.remove(id);
        }],
        ["assistant", async () => o.assistants?.removeSite(id)],
        ["schedule", async () => o.schedules?.removeSite(id)],
        ["review", () => reviews.removeSite(id)],
        ["live review", () => liveReviews.removeSite(id)],
      ];
      for (const [kind, run] of cleanup) {
        await run().catch((error) =>
          console.error(
            `deleted site ${id}: ${kind} files could not be removed:`,
            error,
          )
        );
      }
      return true;
    };
    let deleted: boolean;
    try {
      deleted = o.cloudIntegrations
        ? await o.cloudIntegrations.connections.exclusive(id, remove)
        : await remove();
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== "SITE_HAS_RELEASES") throw error;
      return c.redirect(`/sites/${encodeURIComponent(id)}/settings?error=site_has_releases`, 303);
    }
    if (!deleted) return deny(c, 404);
    /* Postgres removes memberships through the site's cascading foreign key. The in-memory
       development stores are separate objects, so mirror that cleanup after the site is gone. */
    await Promise.all(
      memberIds.map((userId) => o.auth.revoke(id, userId).catch(() => false)),
    );
    built.delete(id);
    return c.redirect("/?message=Site+deleted.", 303);
  });

  /* The editor, with the document already in the page.

     Injecting it rather than having the editor fetch it keeps `load()` synchronous, which is
     what it is in the single-file build — the editor boots from a document that is already
     there, and the only difference is where the page got it. One build serves both. */
  app.get("/edit/:id", async (c) => {
    const id = c.req.param("id");
    const [access, snapshot] = await Promise.allSettled([
      allowedMember(c, id), o.store.byId(id),
    ]);
    if (access.status === 'rejected') throw access.reason;
    const gate = access.value;
    if (!gate.ok) {
      return gate.status === 401
        ? (o.accountAuth
          ? c.redirect(
            `/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`,
          )
          : c.html(signInPage()))
        : deny(c, gate.status);
    }
    if (snapshot.status === 'rejected') throw snapshot.reason;
    const site = snapshot.value;
    if (!site) return deny(c, 404);
    if (gate.role === "reviewer") {
      return c.redirect(`/sites/${encodeURIComponent(id)}/reviews`);
    }
    if (!hostedEditor) {
      return c.text("No editor build. Run `node build.mjs` first.", 503);
    }

    // These reads have no dependencies on one another. Keep authorization fresh,
    // then overlap storage accounting and the WordPress link catalogue.
    const [storage, wordpressContent, schedules] = await Promise.all([
      (async () => {
        const mediaOwnerId = await storageOwner(id, gate.user, gate.role);
        const [usage, limitBytes] = await Promise.all([
          o.assets && mediaOwnerId ? o.assets.usage(mediaOwnerId) : { usedBytes: 0 },
          mediaOwnerId ? storageLimitForOwner(mediaOwnerId, gate.user) : FREE_STORAGE_BYTES,
        ]);
        return { usedBytes: usage.usedBytes, limitBytes };
      })(),
      wordpressContentForSite(site.id),
      // Local files beside the publication bytes; injected so opening Publish needs no request.
      o.schedules && gate.role === "owner"
        ? o.schedules.forSite(site.id).then(rows => rows.slice(0, 5)).catch(() => [])
        : Promise.resolve([]),
    ]);
    const config = {
      siteId: site.id,
      host: site.host,
      slug: site.slug,
      name: site.name,
      /* the link to send somebody, worked out once here rather than assembled in the editor:
         only the server knows whether this site has a domain of its own yet */
      url: shareUrl(c, o, site),
      version: site.version,
      publishedVersion: site.publishedVersion,
      publishedReleaseId: site.publishedReleaseId,
      publishedPublicationId: site.publishedPublicationId,
      schedulingAvailable: !!o.schedules,
      schedules,
      schemaVersion: site.doc.schemaVersion,
      connectedApiBase: "/v1",
      connectedPublishingAvailable: releaseReady(),
      role: gate.role,
      user: { id: gate.user.id, name: gate.user.name, email: gate.user.email },
      storage,
      doc: site.doc,
      wordpressContent,
    };
    return c.html(inject(hostedEditor.html, config));
  });

  /* The list is per person: a site nobody granted you is a site you do not know exists. */
  app.get("/api/sites", async (c) => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    const out = (await visibleSites(user)).map(({ site, role }) => ({
      id: site.id,
      host: site.host,
      slug: site.slug,
      url: shareUrl(c, o, site),
      name: site.name,
      version: site.version,
      publishedVersion: site.publishedVersion,
      publishedReleaseId: site.publishedReleaseId,
      publishedPublicationId: site.publishedPublicationId,
      updatedAt: site.updatedAt,
      role,
      publishState:
        site.publishedPublicationId && site.version === site.publishedVersion
          ? "published"
          : "draft_changes",
    })).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (c.req.query("previews") === "1") return c.json(await Promise.all(out.map(async site => {
      const cached = await sitePreviews.get(site.id);
      return { ...site, previewVersion: previewVersion(site),
        cachedPreviewVersion: cached?.version ?? null,
        previewUrl: cached ? previewUrl(site.id, cached.version) : null };
    })));
    return c.json(out);
  });

  app.get("/api/storage", async (c) => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    if (!o.assets) {
      return c.json({ usedBytes: 0, limitBytes: planEntitlements(user.plan).storageBytes });
    }
    return c.json(await o.assets.usage(user.id, planEntitlements(user.plan).storageBytes));
  });

  app.get("/api/sites/:id", async (c) => {
    const id = c.req.param("id");
    const [access, snapshot] = await Promise.allSettled([
      allowed(c, id, "read"), o.store.byId(id),
    ]);
    if (access.status === "rejected") throw access.reason;
    const gate = access.value;
    if (!gate.ok) return deny(c, gate.status);
    if (snapshot.status === "rejected") throw snapshot.reason;
    const site = snapshot.value;
    if (!site) return deny(c, 404);
    return c.json({
      id: site.id,
      host: site.host,
      slug: site.slug,
      url: shareUrl(c, o, site),
      name: site.name,
      version: site.version,
      role: gate.role,
      doc: site.doc,
    });
  });

  app.get("/api/sites/:id/publication", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const publication = site.publishedPublicationId && o.publications
      ? await o.publications.byId(id, site.publishedPublicationId)
      : null;
    const cached = await sitePreviews.get(id);
    return c.json({
      previewVersion: previewVersion(site),
      previewUrl: cached ? previewUrl(id, cached.version) : null,
      cachedPreviewVersion: cached?.version ?? null,
      draftVersion: site.version,
      publishedVersion: publication?.sourceVersion ?? null,
      publicationId: publication?.id ?? null,
      publishedAt: publication?.createdAt ?? null,
      publicUrl: publication ? shareUrl(c, o, site) : null,
      status: publication
        ? (publication.sourceVersion === site.version
          ? "published"
          : "draft_changes")
        : "draft",
    });
  });

  // The image URL is immutable for a saved/published version; authentication is still
  // required on every network request. Cache files are private and deployment-local.
  app.get("/api/sites/:id/dashboard-thumbnail", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    const cached = await sitePreviews.get(id);
    if (!cached || cached.version !== c.req.query("version")) {
      c.header("cache-control", "private, no-store");
      return c.notFound();
    }
    c.header("cache-control", "private, max-age=31536000, immutable");
    c.header("etag", `"${cached.etag}"`);
    c.header("vary", "Cookie");
    c.header("x-robots-tag", "noindex, nofollow");
    if (c.req.header("if-none-match") === `"${cached.etag}"`) return c.body(null, 304);
    const bytes = Buffer.from(cached.image, "base64");
    return c.body(bytes as unknown as ArrayBuffer, 200, {
      "content-type": "image/webp", "content-length": String(bytes.length),
      "x-content-type-options": "nosniff",
    });
  });

  app.post("/api/sites/:id/dashboard-thumbnail", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "write");
    if (!gate.ok) return deny(c, gate.status);
    if (Number(c.req.header("content-length") || 0) > 1500000) return c.json({ error: "preview_too_large" }, 413);
    const raw = await c.req.text();
    if (raw.length > 1500000) return c.json({ error: "preview_too_large" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return c.json({ error: "invalid_preview" }, 400); }
    const match = String(body?.snapshot || "").match(/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/);
    const site = await o.store.byId(id);
    if (!site || body?.version !== previewVersion(site)) return c.json({ error: "stale_preview" }, 409);
    if (!match) return c.json({ error: "invalid_preview" }, 400);
    const existing = await sitePreviews.get(id);
    if (existing?.version === body.version) return c.json({ url: previewUrl(id, body.version), status: "cached" });
    let bytes: Uint8Array;
    try {
      const optimized = await optimizeAsset(new Uint8Array(Buffer.from(match[1], "base64")), "image/webp");
      if (optimized.type !== "image/webp" || optimized.w !== 960 || optimized.h !== 600 || optimized.bytes.length > 1024 * 1024) {
        return c.json({ error: "invalid_preview" }, 400);
      }
      bytes = optimized.bytes;
    } catch { return c.json({ error: "invalid_preview" }, 400); }
    // Saving/publishing may have completed while the image was being decoded.
    const latest = await o.store.byId(id);
    if (!latest || body.version !== previewVersion(latest)) return c.json({ error: "stale_preview" }, 409);
    await sitePreviews.put(id, body.version, bytes);
    return c.json({ url: previewUrl(id, body.version), status: "stored" });
  });

  // A script-free saved homepage is loaded only when its thumbnail needs generating.

  app.get("/api/sites/:id/dashboard-preview/*", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    c.header("cache-control", "private, no-store");
    c.header("x-robots-tag", "noindex, nofollow");
    const prefix = `/api/sites/${encodeURIComponent(id)}/dashboard-preview/`;
    const path = decodeURIComponent(new URL(c.req.url).pathname.slice(prefix.length));
    if (path.startsWith("assets/")) {
      const asset = await o.assets?.byPath(id, path);
      if (!asset) return c.notFound();
      return c.body(asset.bytes as unknown as ArrayBuffer, 200, assetHeaders(asset));
    }
    if (path !== "index.html") return c.notFound();
    const site = await o.store.byId(id);
    if (!site) return c.notFound();
    const rendered = candidate(site.doc, await assetsOf(id), cloudReceiver(c, id));
    const html = rendered?.files.get("index.html");
    if (!html) return c.text("Preview unavailable", 422);
    c.header("content-security-policy", "sandbox allow-same-origin; default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com data:; frame-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
    return c.html(html.replace('<html', `<html data-dashboard-preview="ready" data-preview-version="${previewVersion(site)}"`).replace('</head>', '<style>html,body{overflow:hidden!important}*,*::before,*::after{animation:none!important;transition:none!important}</style></head>'));
  });

  app.get("/api/sites/:id/publication-preview/:publication", async (c) => {
    if (!o.publications) return c.notFound();
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site || site.publishedPublicationId !== c.req.param("publication")) {
      return c.notFound();
    }
    const publication = await o.publications.byId(
      id,
      c.req.param("publication"),
    );
    if (!publication) return c.notFound();
    const bytes = await o.publications.preview(publication);
    if (!bytes) return c.notFound();
    return c.body(bytes.slice().buffer, 200, {
      "content-type": "image/webp",
      "content-length": String(bytes.byteLength),
      "x-content-type-options": "nosniff",
    });
  });

  app.post("/api/sites/:id/publication-preview", async (c) => {
    if (!o.publications) {
      return c.json({ error: "hosted publication storage is unavailable" }, 503);
    }
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const body = await c.req.json().catch(() => null) as {
      publicationId?: string;
      snapshot?: string;
    } | null;
    const publicationId = String(body?.publicationId || "");
    const match = String(body?.snapshot || "").match(
      /^data:(image\/(?:webp|png));base64,([A-Za-z0-9+/]+={0,2})$/,
    );
    if (!/^[0-9a-f-]{36}$/i.test(publicationId) || !match) {
      return c.json({ error: "invalid_publication_preview" }, 400);
    }
    if (match[2].length > 2 * 1024 * 1024) {
      return c.json({ error: "publication_preview_too_large" }, 413);
    }
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    if (site.publishedPublicationId !== publicationId) {
      return c.json({ error: "stale_publication_preview" }, 409);
    }
    const publication = await o.publications.byId(id, publicationId);
    if (!publication) return c.notFound();
    try {
      const source = new Uint8Array(Buffer.from(match[2], "base64"));
      const optimized = await optimizeAsset(source, match[1]);
      if (
        !optimized.w || !optimized.h || optimized.w < 480 ||
        optimized.h < 300 || optimized.bytes.byteLength > 1024 * 1024
      ) {
        return c.json({ error: "invalid_publication_preview" }, 400);
      }
      await o.publications.putPreview(publication, optimized.bytes);
      return c.json({ status: "stored", publicationId });
    } catch {
      return c.json({ error: "invalid_publication_preview" }, 400);
    }
  });

  app.get("/api/sites/:id/publication-snapshots/:snapshot/files/*", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) {
      const member = await allowedMember(c, id);
      if (!member.ok) return deny(c, member.status);
      const assigned = await reviews.canViewSnapshot(
        id, c.req.param("snapshot"), member.user.id, member.role,
      );
      if (!assigned) return deny(c, 404);
    }
    if (!o.publications) return deny(c, 404);
    const publication = await o.publications.byId(id, c.req.param("snapshot"));
    if (!publication) return deny(c, 404);
    const prefix = `api/sites/${encodeURIComponent(id)}/publication-snapshots/${publication.id}/files`;
    const path = resolvePath(new URL(c.req.url).pathname.split("/files/")[1] || "");
    const record = publication.files.find(file => file.path === path);
    if (!record) return deny(c, 404);
    const bytes = await o.publications.file(publication, path);
    if (!bytes) return c.text("Preview unavailable", 503);
    c.header("Cache-Control", "private, no-store");
    c.header("X-Robots-Tag", "noindex, nofollow");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Type", record.mediaType);
    // Custom page code runs in an opaque sandbox, without access to editor APIs or forms.
    c.header("Content-Security-Policy", "sandbox allow-scripts; connect-src 'none'; form-action 'none'; frame-ancestors 'self'");
    if (record.mediaType.startsWith("text/html")) {
      const html = await publicationPreviewHtml(o.publications, publication, path, new TextDecoder().decode(bytes));
      return c.body(hostedHtml(html, path,
        new Map(publication.files.map(file => [file.path, ""])), prefix));
    }
    return c.body(new Uint8Array(bytes).buffer);
  });

  /* ---- Libraries (Phase 5). The owner publishes; people the owner shared with (slice 2) list,
     read and import, never publish. The document side is pure and runs in the editor; these
     routes keep versions immutable and move image bytes. See docs/phase5-libraries-design.md. */
  const LIBRARY_KINDS = new Set<LibraryItemKind>(["component", "block", "color", "textStyle", "class"]);
  /* Every library route goes through here. A library nobody shared with you is concealed exactly
     like someone else's site; a viewer reaching an owner's action is told why instead. */
  const libraryGate = async (c: Context, libraryId: string, need: "read" | "owner") => {
    if (!o.libraries) return { ok: false as const, response: c.json({ error: "libraries are unavailable" }, 503) };
    const user = await who(c);
    if (!user) return { ok: false as const, response: deny(c, 401) };
    if (!/^[0-9a-f-]{36}$/i.test(libraryId)) return { ok: false as const, response: deny(c, 404) };
    const found = await o.libraries.getFor(libraryId, user.id);
    if (!found) return { ok: false as const, response: deny(c, 404) };
    if (need === "owner" && found.access !== "owner") {
      return {
        ok: false as const,
        response: c.json({ error: "only_owner", detail: "Only the library’s owner can do that." }, 403),
      };
    }
    return { ok: true as const, user, library: found.library, access: found.access, libraries: o.libraries };
  };
  const libraryProblem = (c: Context, error: unknown) => {
    if (error instanceof LibraryError) return c.json({ error: "library_invalid", problems: error.problems }, 422);
    if (error instanceof LibraryImageError) return c.json({ error: "library_image_unavailable", detail: error.message }, 409);
    if (error instanceof AssetQuotaError) {
      return c.json({
        error: "storage_limit_reached", ...error.usage,
        detail: "The storage owner’s media allowance is full. Remove unused images and try again.",
      }, 409);
    }
    throw error;
  };
  const displayName = (user: { name?: string; email: string } | null) => (user ? user.name || user.email : "");

  app.get("/api/libraries", async (c) => {
    if (!o.libraries) return c.json({ error: "libraries are unavailable" }, 503);
    const user = await who(c);
    if (!user) return deny(c, 401);
    const list = await o.libraries.listForUser(user.id);
    // A shared library says whose it is; the owners are looked up once each, in parallel.
    const ownerIds = [...new Set(list.filter((l) => l.access === "viewer").map((l) => l.ownerId))];
    const owners = new Map(await Promise.all(ownerIds.map(async (id) => [id, displayName(await o.auth.userById(id))] as const)));
    return c.json({
      libraries: list.map((l) => (l.access === "viewer" ? { ...l, ownerName: owners.get(l.ownerId) || "" } : l)),
    });
  });

  app.post("/api/libraries", async (c) => {
    if (!o.libraries) return c.json({ error: "libraries are unavailable" }, 503);
    const user = await who(c);
    if (!user) return deny(c, 401);
    const body = await c.req.json().catch(() => null) as { name?: string } | null;
    const name = String(body?.name || "").trim();
    if (!name || name.length > LIBRARY_NAME_MAX) return c.json({ error: `a name of 1–${LIBRARY_NAME_MAX} characters is required` }, 400);
    return c.json({ library: { ...await o.libraries.create({ ownerId: user.id, name }), access: "owner" } }, 201);
  });

  app.get("/api/libraries/:id", async (c) => {
    const gate = await libraryGate(c, c.req.param("id"), "read");
    if (!gate.ok) return gate.response;
    return c.json({ library: { ...gate.library, access: gate.access }, versions: await gate.libraries.versions(gate.library.id) });
  });

  app.get("/api/libraries/:id/versions/:version", async (c) => {
    const gate = await libraryGate(c, c.req.param("id"), "read");
    if (!gate.ok) return gate.response;
    const number = Number(c.req.param("version"));
    const row = Number.isInteger(number) && number > 0 ? await gate.libraries.version(gate.library.id, number) : null;
    if (!row) return c.json({ error: "version_not_found" }, 404);
    const { content, ...summary } = row;
    return c.json({ version: summary, bundle: content });
  });

  /* Publish from a site's current saved version: the editor saves first, then publishes, so the
     library always receives exactly what the owner sees. */
  app.post("/api/libraries/:id/versions", async (c) => {
    const gate = await libraryGate(c, c.req.param("id"), "owner");
    if (!gate.ok) return gate.response;
    const body = await c.req.json().catch(() => null) as { siteId?: string; sourceVersion?: number; items?: LibraryItemRef[] } | null;
    const siteId = String(body?.siteId || "");
    const items = Array.isArray(body?.items) ? body!.items : [];
    if (!items.length || items.length > LIBRARY_ITEMS_MAX ||
      items.some((item) => !item || !LIBRARY_KINDS.has(item.kind) || typeof item.id !== "string" || !item.id || item.id.length > 120)) {
      return c.json({ error: `choose 1–${LIBRARY_ITEMS_MAX} items to publish` }, 400);
    }
    const site = await allowed(c, siteId, "admin");
    if (!site.ok) return deny(c, site.status);
    const stored = await o.store.byId(siteId);
    if (!stored) return deny(c, 404);
    if (body?.sourceVersion !== stored.version) {
      return c.json({ error: "stale_source_version", currentVersion: stored.version }, 409);
    }
    try {
      const version = await publishLibraryVersion({ libraries: gate.libraries, assets: o.assets! }, {
        library: gate.library, siteId, doc: stored.doc, items: items.map(({ kind, id }) => ({ kind, id })),
        userId: gate.user.id, schemaVersion: CORE_SCHEMA, limitBytes: await storageLimitForOwner(gate.library.ownerId, gate.user),
      });
      return c.json({ version }, 201);
    } catch (error) {
      return libraryProblem(c, error);
    }
  });

  /* Copy a library version's images into a site before the editor applies an import or an
     update; the document then names the site's own copies. Charged to the site's storage owner,
     which is how a viewer importing into their own site pays for their own copy. */
  app.post("/api/sites/:id/library-assets", async (c) => {
    const id = c.req.param("id");
    const site = await allowed(c, id, "admin");
    if (!site.ok) return deny(c, site.status);
    const body = await c.req.json().catch(() => null) as { libraryId?: string; version?: number; assets?: string[] } | null;
    const gate = await libraryGate(c, String(body?.libraryId || ""), "read");
    if (!gate.ok) return gate.response;
    const row = Number.isInteger(body?.version) ? await gate.libraries.version(gate.library.id, Number(body!.version)) : null;
    if (!row) return c.json({ error: "version_not_found" }, 404);
    const wanted = Array.isArray(body?.assets) ? body!.assets.map(String) : row.content.assets;
    // Only images this version actually uses may be copied out of the library.
    if (wanted.some((asset) => !row.content.assets.includes(asset))) return c.json({ error: "unknown_library_image" }, 400);
    const ownerId = await storageOwner(id, site.user, site.role);
    if (!ownerId) return c.json({ error: "this site has no storage owner" }, 409);
    try {
      const assets = await copyLibraryAssetsToSite({ libraries: gate.libraries, assets: o.assets! }, {
        libraryId: gate.library.id, ids: wanted, siteId: id, ownerId, limitBytes: await storageLimitForOwner(ownerId, site.user),
      });
      return c.json({ assets });
    } catch (error) {
      return libraryProblem(c, error);
    }
  });

  /* ---- Sharing (slice 2). Read-only: the people an owner shares with can list, read and import,
     and nothing they do reaches the library. An address with no account yet gets a pending
     user row; access starts only after that person signs in and accepts the invitation. */
  const libraryMembers = async (libraryId: string) => {
    const [rows, pending] = await Promise.all([
      o.libraries!.members(libraryId), invitations.listForResource("library", libraryId),
    ]);
    const users = await Promise.all(rows.map((m) => o.auth.userById(m.userId)));
    return [...rows.flatMap((m, i) => {
      const user = users[i];
      return user ? [{ userId: m.userId, email: user.email, name: user.name, pending: !!o.accountAuth && !user.authUserId, createdAt: m.createdAt }] : [];
    }), ...pending.filter(m => !rows.some(row => row.userId === m.recipientId)).map(m => ({
      userId: m.recipientId, email: m.recipientEmail, name: m.recipientName,
      pending: false, awaitingAcceptance: true, createdAt: m.createdAt,
    }))];
  };

  app.get("/api/libraries/:id/members", async (c) => {
    const gate = await libraryGate(c, c.req.param("id"), "owner");
    if (!gate.ok) return gate.response;
    return c.json({ members: await libraryMembers(gate.library.id) });
  });

  app.post("/api/libraries/:id/members", async (c) => {
    const gate = await libraryGate(c, c.req.param("id"), "owner");
    if (!gate.ok) return gate.response;
    const body = await c.req.json().catch(() => null) as { email?: string } | null;
    const email = normalEmail(body?.email || "");
    if (!validEmail(email)) return c.json({ error: "invalid_email", detail: "Enter a valid email address." }, 400);
    if (email === normalEmail(gate.user.email)) {
      return c.json({ error: "self", detail: "That’s your own address — you already own this library." }, 400);
    }
    // The same limits as site invitations, which can also email an address someone typed.
    const allowedShare = inviteSourceLimit.take(requestSource(c)) &&
      inviteAccountLimit.take(gate.user.id) &&
      inviteEmailLimit.take(email) &&
      inviteCooldown.take(`library:${gate.library.id}|${email}`);
    if (!allowedShare) {
      c.header("retry-after", "60");
      return c.json({ error: "rate_limited", detail: "Too many shares just now. Try again in a minute." }, 429);
    }
    // Independent reads, so in parallel: every gateway round trip is about half a second.
    const [current, existing] = await Promise.all([gate.libraries.members(gate.library.id), o.auth.userByEmail(email)]);
    if (current.length >= LIBRARY_MEMBERS_MAX) {
      return c.json({ error: "too_many_members", detail: `A library can be shared with up to ${LIBRARY_MEMBERS_MAX} people.` }, 409);
    }
    let user = existing;
    if (!user) {
      // Two shares to a new address at once: the loser of the unique email finds the winner's row.
      try {
        user = await o.auth.createUser(email);
      } catch (error) {
        user = await o.auth.userByEmail(email);
        if (!user) throw error;
      }
    }
    const invited = await invitations.invite({ kind: "library", resourceId: gate.library.id, recipientId: user.id, invitedBy: gate.user.id });
    if (invited.status === "forbidden") return deny(c, 404);
    if (invited.status === "limit") return c.json({ error: "too_many_members", detail: `A library can be shared with up to ${LIBRARY_MEMBERS_MAX} people.` }, 409);
    const added = invited.status === "pending";
    if (added) {
      const owner = displayName(gate.user);
      /* Not awaited: the invitation is already saved, and the owner should not wait on mail. The
         notice is queued before sending, and a failed send is logged, as for review notices. */
      notifyReview(c, {
        userId: user.id, email: user.email, kind: "library_shared",
        title: `${owner} invited you to a library`,
        body: `Accept the invitation to “${gate.library.name}” before it appears in your Libraries. You can then import and take its updates; only ${owner} publishes new versions.`,
        href: "/invitations",
      }).catch((error) => console.error("library share notice failed:", (error as Error).message));
    }
    // The new member alone; the editor adds it to the list it already shows.
    const member = {
      userId: user.id, email: user.email, name: user.name, pending: !!o.accountAuth && !user.authUserId,
      awaitingAcceptance: added,
      createdAt: invited.status === "pending" ? invited.invitation.createdAt : new Date().toISOString(),
    };
    return c.json({ added, member }, added ? 201 : 200);
  });

  /* The owner removes someone, or a viewer leaves. What they already imported stays in their
     sites as their own copies; they stop seeing the library and its updates. */
  app.delete("/api/libraries/:id/members/:userId", async (c) => {
    const gate = await libraryGate(c, c.req.param("id"), "read");
    if (!gate.ok) return gate.response;
    const target = c.req.param("userId") === "me" ? gate.user.id : c.req.param("userId");
    if (gate.access !== "owner" && target !== gate.user.id) {
      return c.json({ error: "only_owner", detail: "Only the library’s owner can do that." }, 403);
    }
    if (target === gate.library.ownerId) return c.json({ error: "owner", detail: "The owner cannot leave their own library." }, 400);
    const cancelled = await invitations.removeForRecipient("library", gate.library.id, target);
    if (!await gate.libraries.removeMember(gate.library.id, target) && !cancelled) {
      return c.json({ error: "not_member", detail: "They no longer have access." }, 404);
    }
    return c.json({ removed: true });
  });

  /* ---- Scheduled publication (Phase 4). A schedule names an exact prepared snapshot and
     publishes it later only while the snapshot's baseline is still live; see
     docs/phase4-snapshot-scheduling-design.md. Owners only, like publishing itself. */
  const SCHEDULE_MIN_LEAD_MS = 2 * 60_000;
  const SCHEDULE_MAX_LEAD_MS = 90 * 24 * 60 * 60_000;
  app.post("/api/sites/:id/publication-schedules", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.schedules || !o.publications) {
      return c.json({ error: "publication scheduling is unavailable" }, 503);
    }
    const body = await c.req.json().catch(() => null) as {
      snapshotId?: string; publishAt?: string; acknowledgeWarnings?: boolean; idempotencyKey?: string;
    } | null;
    if (!body?.snapshotId || !/^[0-9a-f-]{36}$/i.test(body.snapshotId)) {
      return c.json({ error: "a valid snapshotId is required" }, 400);
    }
    if (!body.idempotencyKey || !/^[A-Za-z0-9._:-]{8,160}$/.test(body.idempotencyKey)) {
      return c.json({ error: "a valid idempotencyKey is required" }, 400);
    }
    const at = Date.parse(String(body.publishAt || ""));
    const lead = at - Date.now();
    if (!Number.isFinite(at) || lead < SCHEDULE_MIN_LEAD_MS || lead > SCHEDULE_MAX_LEAD_MS) {
      return c.json({ error: "invalid_publish_at", minMinutes: 2, maxDays: 90 }, 400);
    }
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const snapshot = await o.publications.byId(id, body.snapshotId);
    const source = snapshot && await o.publications.source(snapshot);
    if (!snapshot || !source) return c.json({ error: "snapshot_not_found" }, 404);
    if (snapshot.slug !== site.slug || snapshot.host !== site.host.toLowerCase()) {
      return c.json({ error: "stale_snapshot" }, 409);
    }
    // A snapshot whose baseline is already superseded could only ever pause.
    if ((site.publishedPublicationId || null) !== source.baselinePublicationId) {
      return c.json({ error: "stale_baseline", currentPublicationId: site.publishedPublicationId || null }, 409);
    }
    // Nobody is present when it runs, so warnings are acknowledged now, exactly as publish asks.
    if (source.warnings?.length && !body.acknowledgeWarnings) {
      return c.json({ error: "publication_warnings", findings: source.warnings }, 409);
    }
    const result = await o.schedules.create({
      siteId: id,
      snapshotId: snapshot.id,
      baselinePublicationId: source.baselinePublicationId,
      publishAt: new Date(at).toISOString(),
      createdBy: gate.user.id,
      idempotencyKey: body.idempotencyKey,
    });
    if (result.status === "conflict") {
      return c.json({ error: "schedule_exists", schedule: result.schedule }, 409);
    }
    return c.json({ status: result.status, schedule: result.schedule }, result.status === "created" ? 201 : 200);
  });

  app.get("/api/sites/:id/publication-schedules", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.schedules) return c.json({ schedules: [] });
    return c.json({ schedules: (await o.schedules.forSite(id)).slice(0, 20) });
  });

  app.delete("/api/sites/:id/publication-schedules/:scheduleId", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.schedules) return deny(c, 404);
    const result = await o.schedules.cancel(id, c.req.param("scheduleId"));
    if (result.status === "missing") return c.json({ error: "schedule_not_found" }, 404);
    if (result.status === "busy") return c.json({ error: "schedule_running" }, 409);
    return c.json(result);
  });

  /* Cron wakes this every minute; the in-process timer (PAGECRAFT_SCHEDULE_RUNNER=1) is the
     other trigger. Running twice at once is safe. Without a configured key it does not exist. */
  app.post("/api/internal/publication-schedules/run", async (c) => {
    if (!o.schedules || !o.publications || !o.scheduleRunnerKey) return c.notFound();
    const presented = (c.req.header("authorization") || "").replace(/^Bearer\s+/i, "");
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(presented), digest(o.scheduleRunnerKey))) return c.notFound();
    const results = await runDueSchedules({
      store: o.store, publications: o.publications, schedules: o.schedules, auth: o.auth,
      reviews: o.reviews, sendNotice: o.sendNotice, editorOrigin: o.editorOrigin,
    });
    return c.json({ results });
  });

  for (const action of ["publish", "publication-snapshots"] as const) app.post(`/api/sites/:id/${action}`, async (c) => {
    const prepareSnapshot = action === "publication-snapshots";
    const id = c.req.param("id");
    if (!o.publications) {
      return c.json(
        { error: "hosted publication storage is unavailable" },
        503,
      );
    }
    const body = await c.req.json().catch(() => null) as {
      sourceVersion?: number;
      snapshotId?: string;
      acknowledgeWarnings?: boolean;
    } | null;
    const sourceVersion = body?.sourceVersion;
    if (!Number.isInteger(sourceVersion) || Number(sourceVersion) < 1) {
      return c.json({ error: "a valid sourceVersion is required" }, 400);
    }
    let publisher: User;
    let site: Site;
    let preparedRevision: SiteRevision | null | undefined;
    let preparedAssets: AssetRecord[] | undefined;
    let publishIdentity: VerifiedIdentity | undefined;
    if (o.hostedPublish && o.accountAuth) {
      const identity = await verifiedIdentity(c);
      if (!identity) return deny(c, 401);
      publishIdentity = identity;
      // Publishing must recheck the authoritative version and membership, even when the
      // draft appears unchanged. Another worker may have published or revoked access
      // since this process cached the site; that cache is only suitable for draft work.
      const prepared = await o.hostedPublish.prepare({ siteId: id, identity });
      if (prepared.status !== "ok") {
        return deny(c, prepared.status === "missing" ? 404 : 403);
      }
      publisher = prepared.user;
      site = prepared.site;
      preparedRevision = prepared.revision;
      preparedAssets = prepared.assets;
    } else {
      const gate = await allowed(c, id, "admin");
      if (!gate.ok) return deny(c, gate.status);
      const stored = await o.store.byId(id);
      if (!stored) return deny(c, 404);
      publisher = gate.user;
      site = stored;
    }
    if (sourceVersion !== site.version) {
      return c.json({
        error: "stale_source_version",
        sourceVersion,
        currentVersion: site.version,
      }, 409);
    }

    if (!prepareSnapshot && !body?.snapshotId && site.publishedPublicationId) {
      const current = await o.publications.byId(
        id,
        site.publishedPublicationId,
      );
      if (
        current?.sourceVersion === sourceVersion &&
        current.slug === site.slug && current.host === site.host.toLowerCase()
      ) {
        try {
          await o.publications.promote(current);
        } catch (error) {
          c.header("retry-after", "5");
          return c.json({
            error: "publication_pointer_unavailable",
            retryable: true,
            detail: shownError(
              error,
              "The public address could not be updated. Publish again in a moment.",
            ),
          }, 503);
        }
        return c.json({
          status: "unchanged",
          publicationId: current.id,
          sourceVersion,
          publishedAt: current.createdAt,
          publicUrl: shareUrl(c, o, site),
        });
      }
    }

    let publication: PublicationSummary;
    if (!prepareSnapshot && body?.snapshotId) {
      const snapshot = await o.publications.byId(id, body.snapshotId);
      const source = snapshot && await o.publications.source(snapshot);
      if (!snapshot || !source) return c.json({ error: "snapshot_not_found" }, 404);
      if (snapshot.sourceVersion !== sourceVersion || snapshot.slug !== site.slug || snapshot.host !== site.host.toLowerCase()) {
        return c.json({ error: "stale_snapshot", currentVersion: site.version }, 409);
      }
      if (source.warnings?.length && !body.acknowledgeWarnings) {
        return c.json({ error: "publication_warnings", findings: source.warnings }, 409);
      }
      // Promotion uses the exact materialized bytes inspected during review.
      publication = snapshot;
    } else {
    const revision = preparedRevision === undefined
      ? await o.store.revision(id, sourceVersion)
      : preparedRevision;
    if (!revision) return c.json({ error: "source_revision_not_found" }, 404);
    let document: Doc | null;
    try {
      document = adopt(structuredClone(revision.doc));
    } catch (error) {
      return c.json({
        error: "publication_validation_failed",
        detail: String((error as Error).message),
      }, 422);
    }
    if (!document) {
      return c.json({
        error: "publication_schema_unsupported",
        detail: "This document needs a newer Pagecraft server.",
      }, 422);
    }

    const metadata = preparedAssets || await assetsOf(id);
    /* A hosted site always has an address, so it gets the canonical tags and the sitemap the
       core writes only for a Site URL. The owner's own Site URL still wins; the stored document
       is not changed, only what this publication renders. */
    const addressed: Doc = document.meta.baseUrl
      ? document
      : { ...document, meta: { ...document.meta, baseUrl: publicAddress(c, site) } };
    let rendered: ReturnType<typeof render>;
    try {
      rendered = render(addressed, metadata, o.submissions ? new URL('/forms/' + encodeURIComponent(id), o.editorOrigin || c.req.url).href : '', { foundation: true });
      if (releaseStylesheetLinks(rendered.files).length) {
        rendered.files = await freezeGoogleFontStylesheets(
          rendered.files,
          o.fontFetch || fetch,
        );
      }
    } catch (error) {
      return c.json({
        error: "publication_compile_failed",
        detail: String((error as Error).message),
      }, 422);
    }
    const remainingStylesheets = releaseStylesheetLinks(rendered.files);
    if (remainingStylesheets.length) {
      return c.json({
        error: "publication_validation_failed",
        errorCodes: ["unfrozen-stylesheet"],
        stylesheets: remainingStylesheets,
      }, 422);
    }
    const errors = rendered.findings.filter((finding) =>
      finding.level === "error"
    );
    const warnings = rendered.findings.filter((finding) =>
      finding.level === "warn"
    );
    if (errors.length) {
      return c.json({
        error: "publication_validation_failed",
        findings: errors.map((finding) => ({
          code: finding.code,
          message: finding.msg,
          where: finding.where,
        })),
      }, 422);
    }
    if (!prepareSnapshot && warnings.length && body?.acknowledgeWarnings !== true) {
      return c.json({
        error: "warning_acknowledgement_required",
        findings: warnings.map((finding) => ({
          code: finding.code,
          message: finding.msg,
          where: finding.where,
        })),
      }, 409);
    }

    const assets = await assetBodiesOf(
      id,
      releaseAssetIds(document, rendered.files, metadata),
      preparedAssets,
    );
    /* Fonts and the shared foundation become files every page links, instead of ~315 KB that
       each page used to carry inline. */
    const hostedStyles = shareHostedStyles(rendered.files, rendered.foundation);
    const files = [
      ...[...hostedStyles.files].map(([path, content]) => ({
        path,
        mediaType: typeOf(path),
        bytes: new TextEncoder().encode(content),
      })),
      ...hostedStyles.extra,
      ...assets.map((asset) => ({
        path: assetFile(asset),
        mediaType: asset.type,
        bytes: asset.bytes,
      })),
    ];
    try {
      publication = await o.publications.create({
        siteId: id,
        slug: site.slug,
        host: site.host,
        sourceVersion,
        source: { document: revision.doc, baselinePublicationId: site.publishedPublicationId || null,
          warnings: warnings.map(finding => ({ code: finding.code, message: finding.msg, where: finding.where })) },
        files,
      });
    } catch (error) {
      return c.json({
        error: "publication_write_failed",
        detail: shownError(
          error,
          "The published files could not be written. Publish again in a moment.",
        ),
      }, 503);
    }
    if (prepareSnapshot) {
      const baseline = site.publishedPublicationId
        ? await o.publications.byId(id, site.publishedPublicationId) : null;
      const pinned = baseline && await o.publications.source(baseline);
      const legacy = !pinned && baseline ? await o.store.revision(id, baseline.sourceVersion) : null;
      const baselineDocument = pinned?.document || legacy?.doc;
      const before = baselineDocument ? adopt(structuredClone(baselineDocument) as Doc) : null;
      return c.json({
        comparisonAvailable: !baseline || !!before,
        changes: publicationChanges(before, document),
        snapshotId: publication.id,
        sourceVersion,
        baselinePublicationId: site.publishedPublicationId || null,
        createdAt: publication.createdAt,
        draftPages: publication.files.filter(file => file.mediaType.startsWith("text/html")).map(file => file.path),
        publishedPages: (baseline?.files || []).filter(file => file.mediaType.startsWith("text/html")).map(file => file.path),
        pages: [...new Set([...publication.files, ...(baseline?.files || [])].filter(file => file.mediaType.startsWith("text/html")).map(file => file.path))],
        warnings: warnings.map(finding => ({ code: finding.code, message: finding.msg, where: finding.where })),
      }, 201);
    }
    }
    let committed: Site | null;
    if (o.cloudMutations && publishIdentity) {
      const result = await o.cloudMutations.publishAuthorized({
        siteId: id,
        sourceVersion,
        publicationId: publication.id,
        contentHash: publication.contentHash,
        createdAt: publication.createdAt,
        identity: publishIdentity,
      });
      if (result.status !== "published") {
        if (!body?.snapshotId) await o.publications.discard(publication).catch(() => undefined);
        if (result.status === "missing") return deny(c, 404);
        if (result.status === "forbidden") return deny(c, 403);
        if (result.status !== "conflict") {
          return c.json({ error: "publication_commit_failed" }, 409);
        }
        return c.json({
          error: "stale_source_version",
          sourceVersion,
          currentVersion: result.currentVersion,
        }, 409);
      }
      committed = result.site;
    } else {
      committed = await o.store.publishHosted({
        id,
        version: sourceVersion,
        publicationId: publication.id,
        contentHash: publication.contentHash,
        createdBy: publisher.id,
        createdAt: publication.createdAt,
      });
      if (!committed) {
        if (!body?.snapshotId) await o.publications.discard(publication).catch(() => undefined);
        return c.json(
          { error: "publication_commit_failed", retryable: true },
          409,
        );
      }
    }
    const effective = committed.publishedPublicationId === publication.id
      ? publication
      : await o.publications.byId(id, committed.publishedPublicationId || "");
    if (!effective) {
      return c.json({
        error: "publication_winner_unavailable",
        retryable: true,
        detail:
          "The database selected a concurrent publication whose files are not available yet.",
      }, 503);
    }
    try {
      await o.publications.promote(effective);
    } catch (error) {
      c.header("retry-after", "5");
      return c.json({
        error: "publication_pointer_unavailable",
        retryable: true,
        publicationId: effective.id,
        detail: shownError(
          error,
          "The public address could not be updated. Publish again in a moment.",
        ),
      }, 503);
    }
    return c.json({
      status: effective.id === publication.id ? "published" : "unchanged",
      publicationId: effective.id,
      sourceVersion,
      publishedAt: effective.createdAt,
      publicUrl: shareUrl(c, o, committed),
    });
  });

  /* Creating a site is not something a client does, so it needs a signed-in person and
     grants them ownership of what they made. */
  app.post("/api/sites", async (c) => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    const htmlForm = (c.req.header("content-type") || "").includes(
      "application/x-www-form-urlencoded",
    ) ||
      (c.req.header("content-type") || "").includes("multipart/form-data");
    const body = (htmlForm
      ? await c.req.parseBody().catch(() =>
        null
      )
      : await c.req.json().catch(() => null)) as {
        host?: string;
        slug?: string;
        name?: string;
        doc?: Doc;
        templateId?: string;
        templateVersion?: string;
      } | null;
    if (!body) return c.json({ error: "a JSON body is required" }, 400);
    const create = async (progress: (value: number, message: string) => Promise<void>) => {
    /* A document is optional. It used to be required, which meant the only way to make a site
       was to already have one — so a fresh deployment's owner signed in, was told to ask whoever
       set it up, and had nowhere to go. They *are* whoever set it up. A name is enough now, and
       the server starts them where the builder's own "Start an empty site" does. */
    await progress(0, "Preparing your site…");
    const name = String(body.name || "").trim() || "Untitled site";
    const requestedSlug = String(body.slug || "").trim();
    if (requestedSlug && !validSlug(requestedSlug)) {
      return htmlForm ? c.redirect("/?error=slug", 303) : c.json({
        error: "invalid_slug",
        detail:
          "Use lowercase letters, numbers, and single hyphens. Maximum 40 characters.",
      }, 422);
    }
    const templateId = String(body.templateId || "").trim();
    const templateVersion = String(body.templateVersion || "").trim();
    let templateInstall = null;
    if (templateId) {
      if (!o.siteTemplates) {
        return c.json({ error: "site_templates_unavailable" }, 503);
      }
      await progress(0, "Preparing the template…");
      /* Template images are copied into the new site's media library, like uploads, so the
         site owns them and its pages load them from wherever the site is served. Linking to the
         editor host's package (as Cloud did) made a site created on staging and published from
         production load its images from staging. Only a server with no asset store links, and
         then origin-relatively. */
      templateInstall = await o.siteTemplates.instantiate(
        templateId,
        templateVersion || undefined,
        !o.assets && !!o.accountAuth,
      ).catch(() => null);
      if (!templateInstall) {
        return c.json({ error: "site_template_not_found" }, 422);
      }
      if (templateInstall.assets.length && !o.assets) {
        return c.json({ error: "site_templates_unavailable" }, 503);
      }
    }
    const doc0 = body.doc || templateInstall?.document || blankDoc(name);
    if (templateInstall) doc0.meta.name = name;
    /* A host is no longer required to have a site. It used to be the only way to reach one, so
       making a site meant inventing a domain first; a slug is enough, and the host is what you
       add when the site earns a domain. The placeholder is unique and never resolves, which is
       the honest value for "no domain yet". */
    const requestedHost = String(body.host || "").trim();
    const host = requestedHost
      ? validHost(requestedHost)
      : `unclaimed-${crypto.randomUUID()}.invalid`;
    if (!host) {
      return c.json({
        error: "that is not a domain",
        detail:
          "A hostname on its own — acme.com or www.acme.com. No scheme, no port, no path.",
      }, 400);
    }
    /* Stored at this build's schema, so the row starts where the save path expects it. */
    let doc: Doc | null = null;
    let malformed = false;
    try {
      doc = adopt(doc0);
    } catch {
      malformed = true;
    }
    if (malformed) {
      return c.json({
        error: "invalid document",
        detail: "The document is not a Pagecraft project.",
      }, 422);
    }
    if (!doc) {
      return c.json({
        error: "newer",
        detail:
          "This document was written by a newer version of the editor than this server runs. Reload the editor, or deploy the server.",
      }, 409);
    }
    /* Render before the first durable write. A document that cannot produce its files is not a
       site, and returning an error after inserting it leaves an unrecoverable row behind. */
    const preview = candidate(doc, templateInstall?.assets || []);
    if (!preview) {
      return c.json({
        error: "invalid document",
        detail: "The document is not a renderable Pagecraft project.",
      }, 422);
    }
    await progress(1, "Creating your site…");
    try {
      const created = o.accountAuth
        ? await o.ownedSites?.create({
          ownerId: user.id,
          host,
          slug: requestedSlug || undefined,
          name,
          doc,
        })
        : null;
      if (o.accountAuth && !created) {
        return htmlForm ? c.redirect("/?error=creation", 303) : c.json({
          error: "site_creation_unavailable",
          detail:
            "Site creation is temporarily unavailable. Your existing sites are still available.",
        }, 503);
      }
      if (created && !created.ok) {
        if (created.reason === "site_limit_reached") {
          return htmlForm
            ? c.redirect("/?error=limit", 303)
            : c.json({ error: "site_limit_reached", limit: planEntitlements(user.plan).ownedSites }, 409);
        }
        return htmlForm ? c.redirect("/?error=account", 303) : c.json({
          error: "profile_missing",
          detail:
            "Your Pagecraft profile is not ready. Sign out and sign in again, or contact support.",
        }, 409);
      }
      const site = created?.ok ? created.site : await o.store.create({
        host,
        slug: requestedSlug || undefined,
        name,
        doc,
        savedBy: user.id,
      });
      if (!o.accountAuth) await o.auth.grant(site.id, user.id, "owner");
      // A slug another site left now belongs to this one; stop redirecting it away.
      await o.publications?.releaseSlug(site.slug, site.id).catch(() => undefined);
      /* A curated package's assets are independent immutable blobs. Installing them one at a
         time multiplied gateway latency by the image count (the five-image studio template
         could leave the create dialog spinning for nearly a minute). Let every upload settle
         together, then roll back only after no write remains in flight. `allSettled` matters:
         an early `Promise.all` rejection would race cleanup against the other uploads. */
      // Each asset can itself upload four chunks concurrently. Bound the outer queue
      // so image-heavy templates do not exhaust the gateway and time out midway.
      const assetResults: PromiseSettledResult<AssetRecord>[] = [];
      const templateAssets = templateInstall?.assets || [];
      const templateAssetQuota = templateAssets.length
        ? {
          ownerId: user.id,
          limitBytes: await storageLimitForOwner(user.id, user),
        }
        : null;
      await progress(2, templateAssets.length ? `Copying images: 0 of ${templateAssets.length}` : "Preparing the builder…");
      for (let start = 0; start < templateAssets.length; start += 3) {
        const prepared = await Promise.allSettled(templateAssets.slice(start, start + 3)
          .map(async asset => {
            const sourceType = sniff(asset.bytes);
            if (!sourceType || !ALLOWED.has(sourceType)) {
              throw new Error(`template asset ${asset.id} is not a supported image`);
            }
            const output = await optimizeAsset(asset.bytes, sourceType);
            return {
              asset: {
                ...asset,
                siteId: site.id,
                name: optimizedName(asset.name, output.extension),
                type: output.type,
                bytes: output.bytes,
                w: output.w,
                h: output.h,
                contentHash: sha256(asset.bytes),
              },
              quota: {
                ownerId: templateAssetQuota!.ownerId,
                limitBytes: templateAssetQuota!.limitBytes,
                originalBytes: asset.bytes.byteLength,
                optimized: true,
              },
            };
          }));
        const batch = await Promise.allSettled(prepared.map(result =>
          result.status === "fulfilled"
            ? o.assets!.put(result.value.asset, result.value.quota)
            : Promise.reject(result.reason)
        ));
        assetResults.push(...batch);
        const copied = assetResults.filter(result => result.status === "fulfilled").length;
        await progress(2 + copied / templateAssets.length, `Copying images: ${copied} of ${templateAssets.length}`);
        if (batch.some(result => result.status === 'rejected')) break;
      }
      const installedAssetIds = assetResults.flatMap(result =>
        result.status === "fulfilled" ? [result.value.id] : []
      );
      const failedAsset = assetResults.find(result => result.status === "rejected");
      if (failedAsset?.status === "rejected") {
        for (const assetId of installedAssetIds) {
          await o.assets!.remove(site.id, assetId).catch(() => false);
        }
        await o.store.delete(site.id).catch(() => false);
        console.error("site template asset installation failed", failedAsset.reason);
        if (failedAsset.reason instanceof AssetQuotaError) {
          return c.json({
            error: "storage_limit_reached",
            usage: failedAsset.reason.usage,
          }, 409);
        }
        return c.json({
          error: "site_template_install_failed",
          detail: "The curated site could not be installed. Nothing was kept.",
        }, 500);
      }
      await progress(3, "Finishing setup…");
      const out = remember(site, preview);
      if (htmlForm) {
        return c.redirect(
          `/edit/${encodeURIComponent(site.id)}`,
          303,
        );
      }
      return c.json({
        id: site.id,
        slug: site.slug,
        version: site.version,
        /* where to send somebody, said once by the server rather than assembled by every
           caller that wants to show a link */
        url: shareUrl(c, o, site),
        files: [...out.files.keys()],
      }, 201);
    } catch (e) {
      const message = String((e as Error).message || e);
      if (/already taken|duplicate|unique/i.test(message)) {
        return htmlForm ? c.redirect("/?error=slug_taken", 303) : c.json({
          error: "slug_taken",
          detail: "That site address is already in use. Choose another.",
        }, 409);
      }
      return htmlForm ? c.redirect("/?error=creation", 303) : c.json({
        error: "site_creation_failed",
        detail: "We could not create that site. Try again.",
      }, 409);
    }
    };
    if (!htmlForm && c.req.header('accept')?.includes('application/x-ndjson')) {
      c.header('content-type', 'application/x-ndjson');
      c.header('x-accel-buffering', 'no');
      return stream(c, async output => {
        // A closed tab must not interrupt an in-flight installation or its rollback.
        const send = async (event: object) => { try { await output.write(JSON.stringify(event) + '\n'); } catch {} };
        const heartbeat = setInterval(() => { void send({ type: 'heartbeat' }); }, 10000);
        try {
          const response = await create((value, message) => send({ type: 'progress', value, message }));
          const payload = await response.json();
          await send({ type: 'result', ok: response.ok, payload });
        } catch {
          await send({ type: 'result', ok: false, payload: { error: 'creation_status_unknown', detail: 'Could not confirm creation. Check Sites before trying again.' } });
        } finally { clearInterval(heartbeat); }
      });
    }
    return create(async () => {});
  });

  /* The save. This is the endpoint that makes the whole thing worth building: it is what
     `writeNow()` in the builder used to give localStorage. */
  app.put("/api/sites/:id", async (c) => {
    const id = c.req.param("id");
    let gate: Awaited<ReturnType<typeof allowed>> | undefined;
    let fastIdentity: VerifiedIdentity | undefined;
    const accountFastPath = o.cloudMutations && o.accountAuth &&
      !c.req.header("x-pagecraft-editor-session");

    /* Preserve authentication-first behavior. Besides avoiding needless parsing work, this
       keeps unauthenticated requests from learning which payloads the save endpoint accepts. */
    if (accountFastPath) {
      const identity = await verifiedIdentity(c);
      if (!identity) return deny(c, 401);
      fastIdentity = identity;
    } else {
      gate = await allowed(c, id, "write");
      if (!gate.ok) return deny(c, gate.status);
    }

    const body = await c.req.json().catch(() => null) as {
      doc?: Doc;
      version?: number;
    } | null;
    if (
      !body || !body.doc || !Number.isInteger(body.version) || body.version! < 1
    ) {
      return c.json({ error: "doc and version are required" }, 400);
    }
    const version = body.version as number;
    let site: Site;
    let siteAssets: AssetRecord[];
    if (accountFastPath) {
      const cached = o.cloudMutations!.cachedSaveSource(id, version);
      if (cached) {
        site = cached.site;
        siteAssets = cached.assets;
      } else {
        const loaded = await Promise.all([
          allowed(c, id, "write"),
          o.store.byId(id),
          assetsOf(id),
        ]);
        gate = loaded[0];
        if (!gate.ok) return deny(c, gate.status);
        if (!loaded[1]) return deny(c, 404);
        site = loaded[1];
        siteAssets = loaded[2];
      }
    } else {
      const loaded = await Promise.all([o.store.byId(id), assetsOf(id)]);
      if (!loaded[0]) return deny(c, 404);
      site = loaded[0];
      siteAssets = loaded[1];
    }

    /* Both documents, brought to the same schema before anything compares them. The incoming
       one because that is what gets stored, and the stored one because the editor migrated it
       on load — so a legacy row plus a content account would otherwise be a save refused for a
       structural change neither of them made. A refusal here means a newer editor is talking to
       an older server, which is a deployment to finish rather than a document to store. */
    let incoming: Doc | null = null;
    let malformed = false;
    try {
      incoming = adopt(body.doc);
    } catch {
      malformed = true;
    }
    if (malformed) {
      return c.json({
        error: "invalid document",
        detail: "The document is not a Pagecraft project.",
      }, 422);
    }
    if (!incoming) {
      return c.json({
        error: "newer",
        detail:
          "This document was written by a newer version of the editor than this server runs. Reload the editor, or deploy the server.",
      }, 409);
    }
    body.doc = incoming;
    const stored = adopt(site.doc) || site.doc;

    const preview = candidate(body.doc, siteAssets, cloudReceiver(c, id));
    if (!preview) {
      return c.json({
        error: "invalid document",
        detail: "The document is not a renderable Pagecraft project.",
      }, 422);
    }

    /* A content role may save, and only content. The check is against what is stored rather
       than against what the editor thinks it loaded, so a stale client cannot smuggle a
       structural change through by sending an old skeleton. */
    /* The same comparison determines the minimum role passed to the atomic Cloud write. The
       gateway checks the current membership again, so a stale cache cannot grant authority. */
    const ids = new Set(siteAssets.map((x) => x.id));
    const cmsErrors = cmsDocumentErrors(stored, body.doc, ids);
    if (cmsErrors.length) return c.json({ error: 'invalid CMS content', detail: cmsErrors.join(' ') }, 422);
    const contentCheck = contentOnly(stored, body.doc, ids);
    if (gate?.ok && gate.role === "content" && !contentCheck.ok) {
      return c.json({
        error: "content only",
        detail:
          "This account can change text and CMS content. Layout, styling and page structure are not editable here.",
      }, 403);
    }

    const saved = fastIdentity
      ? await o.cloudMutations!.saveAuthorized({
        siteId: id,
        sourceVersion: version,
        doc: body.doc,
        identity: fastIdentity,
        requiredRole: contentCheck.ok ? "write" : "admin",
      })
      : await o.store.save(
        id,
        body.doc,
        version,
        gate?.ok ? gate.user.id : undefined,
      );
    let savedSite: Site;
    if ("status" in saved) {
      if (saved.status === "missing") return deny(c, 404);
      if (saved.status === "forbidden") return deny(c, 403);
      if (saved.status === "conflict") {
        return c.json({
          error: "stale",
          conflict: { yours: version, theirs: saved.currentVersion },
        }, 409);
      }
      savedSite = saved.site;
    } else {
      if (!saved.ok) {
        /* A stale version is not an error the editor should swallow. Someone else saved, and
         overwriting them silently is the one thing a store must never do. */
        return c.json({ error: "stale", conflict: saved.conflict }, 409);
      }
      savedSite = saved.site!;
    }

    /* Saving advances only the draft. The public cache remains keyed to the published
       revision and is invalidated only by an explicit release. */
    const out = preview;
    return c.json({
      version: savedSite.version,
      files: [...out.files.keys()],
      /* the same review the builder shows, so a save can say what it noticed */
      findings: out.findings.map((f) => ({
        level: f.level,
        code: f.code,
        msg: f.msg,
      })),
    });
  });

  /* Durable history. Every accepted save is immutable; restoring an old document goes
     through the normal optimistic save and therefore creates a new version rather than
     deleting the versions that came after it. */
  app.get("/api/sites/:id/history", async (c) => {
    const id = c.req.param("id");
    const [access, history] = await Promise.allSettled([
      allowed(c, id, "read"), o.store.history(id),
    ]);
    if (access.status === 'rejected') throw access.reason;
    const gate = access.value;
    if (!gate.ok) return deny(c, gate.status);
    if (history.status === 'rejected') throw history.reason;
    const revisions = history.value;
    const authorIds = [
      ...new Set(
        revisions.flatMap((revision) =>
          revision.savedBy ? [revision.savedBy] : []
        ),
      ),
    ];
    const authors = new Map([
      [gate.user.id, gate.user] as const,
      ...(await o.auth.usersByIds(authorIds.filter(id => id !== gate.user.id)))
        .map(user => [user.id, user] as const),
    ]);
    return c.json(revisions.map((revision) => {
      const author = revision.savedBy ? authors.get(revision.savedBy) : null;
      return {
        version: revision.version,
        createdAt: revision.createdAt,
        savedBy: revision.savedBy,
        author: author ? { name: author.name, email: author.email } : null,
      };
    }));
  });

  app.get("/api/sites/:id/history/:version", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    const version = Number(c.req.param("version"));
    if (!Number.isInteger(version) || version < 1) {
      return c.json({ error: "invalid version" }, 400);
    }
    const revision = await o.store.revision(id, version);
    if (!revision) return deny(c, 404);
    return c.json({
      version: revision.version,
      createdAt: revision.createdAt,
      doc: revision.doc,
    });
  });

  app.post("/api/sites/:id/history/:version/restore", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const version = Number(c.req.param("version"));
    const body = await c.req.json().catch(() => null) as {
      currentVersion?: number;
    } | null;
    const currentVersion = body?.currentVersion;
    if (
      !Number.isInteger(version) || version < 1 ||
      !Number.isInteger(currentVersion) || currentVersion! < 1
    ) {
      return c.json({ error: "version and currentVersion are required" }, 400);
    }
    const revision = await o.store.revision(id, version);
    if (!revision) return deny(c, 404);
    let restored: Doc | null = null;
    let malformed = false;
    try {
      restored = adopt(revision.doc);
    } catch {
      malformed = true;
    }
    if (malformed) {
      return c.json({
        error: "invalid document",
        detail: "That revision is not a Pagecraft project.",
      }, 422);
    }
    if (!restored) {
      return c.json({
        error: "newer",
        detail: "That version needs a newer Pagecraft build.",
      }, 409);
    }
    const preview = candidate(restored, await assetsOf(id), cloudReceiver(c, id));
    if (!preview) {
      return c.json({
        error: "invalid document",
        detail: "That revision is not renderable.",
      }, 422);
    }
    const result = await o.store.save(
      id,
      restored,
      currentVersion as number,
      gate.user.id,
    );
    if (!result.ok) {
      return c.json({ error: "stale", conflict: result.conflict }, 409);
    }
    const out = preview;
    return c.json({
      version: result.site!.version,
      restoredFrom: version,
      files: [...out.files.keys()],
    });
  });

  /* ------------------------------------------------------------- the domain

     Changing where a site answers. The routing already worked — a request is matched on its
     Host header — so this is the missing half: a way to say which host that is, without
     editing a database by hand.

     Owner only. A domain is not content: moving it takes the site off the address people have
     and puts it on one they do not, and every link anybody has saved stops working. */

  /* Change where a site lives under the shared host. Admin, not write: the path is the URL
     people have been given, and moving it breaks every link to it — the same argument the host
     route makes, at a smaller scale. */
  app.put("/api/sites/:id/slug", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);

    const body = await c.req.json().catch(() => null) as
      | { slug?: string }
      | null;
    const want = validSlug(body?.slug || "");
    if (!want) {
      return c.json({
        error: "that is not a usable path",
        detail:
          "Lowercase letters, digits and hyphens, up to 40 characters — and not a name " +
          "this server already uses, like api or auth.",
      }, 400);
    }
    const moved = await o.store.setSlug(id, want);
    if (!moved) {
      return c.json(
        { error: `/${want} already answers for another site` },
        409,
      );
    }
    await o.publications?.releaseSlug(moved.slug, id);
    await o.publications?.relocate(id, moved.slug, moved.host);
    return c.json({
      id: moved.id,
      slug: moved.slug,
      url: shareUrl(c, o, moved),
    });
  });

  app.put("/api/sites/:id/host", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);

    const body = await c.req.json().catch(() => null) as
      | { host?: string }
      | null;
    const host = validHost(body?.host || "");
    if (!host) {
      return c.json({
        error: "that is not a domain",
        detail:
          "A hostname on its own — acme.com or www.acme.com. No scheme, no port, no path.",
      }, 400);
    }

    const moved = await o.store.setHost(id, host);
    if (!moved) {
      return c.json(
        { error: "another site already answers on that domain" },
        409,
      );
    }
    /* The rendered files do not change, but the base URL in them might, so the cache for this
       site is dropped rather than left to serve pages that name the old address. */
    await o.publications?.relocate(id, moved.slug, moved.host);
    built.delete(id);
    return c.json({ id: moved.id, host: moved.host });
  });

  /* --------------------------------------------------------- certificates

     What a reverse proxy asks before it fetches a certificate for a domain.

     On-demand TLS means the first request for `acme.com` triggers an issuance, and a proxy
     that will do that for *any* name pointed at this box is a proxy that can be made to ask
     Let's Encrypt for thousands of certificates — which ends in a rate limit at best. So the
     proxy asks here first, and here is the only place that knows whether a domain is one of
     ours.

     Deliberately not under `/api`: it carries no session, because the proxy has none. Reaching
     it is instead restricted to the loopback interface, which is where the proxy runs. Binding
     the app to 127.0.0.1 in production would do the same job at the socket, and both together
     is the belt and the braces. */

  app.get("/internal/tls-check", async (c) => {
    const via = c.req.header("x-forwarded-for");
    /* A `X-Forwarded-For` means somebody outside reached this, because the proxy does not set
       one on its own `ask`. That is enough to refuse, and cheaper than parsing addresses. */
    if (via) return c.text("no", 403);

    const domain = validHost(c.req.query("domain") || "");
    if (!domain) return c.text("no", 400);
    const site = await o.store.byHost(domain);
    /* 200 is "yes, get a certificate for this". Anything else is "do not". */
    return site ? c.text("ok", 200) : c.text("no", 404);
  });

  /* ---------------------------------------------------------------- the people

     Membership is the authorization record. Authentication invitations only prove control of
     an email address; they never carry a site or role, and editable auth metadata is not used
     to authorize anything.

     Only an owner may do any of this: `admin` is the verb, and `roleAllows` gives it to owners
     alone. */

  app.get("/api/sites/:id/people", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const list = await o.auth.members(id);
    return c.json(
      list.map((m) => ({
        userId: m.userId,
        email: m.email,
        name: m.name,
        role: m.role,
      })),
    );
  });

  app.post("/api/sites/:id/people", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);

    const body = await c.req.json().catch(() => null) as {
      email?: string;
      role?: Role;
    } | null;
    const email = normalEmail(body?.email || "");
    if (
      body?.role !== undefined && !isSiteRole(body.role)
    ) {
      return c.json({ error: "role must be owner, content, or reviewer" }, 400);
    }
    const role: Role = isSiteRole(String(body?.role || "")) ? body!.role as Role : "content";
    if (!validEmail(email)) {
      return c.json({ error: "a valid email address is required" }, 400);
    }
    // The same limits as the People form: this grants access just as that does.
    const allowedInvitation = inviteSourceLimit.take(requestSource(c)) &&
      inviteAccountLimit.take(gate.user.id) &&
      inviteSiteLimit.take(id) &&
      inviteEmailLimit.take(email) &&
      inviteCooldown.take(`${id}|${email}`);
    if (!allowedInvitation) {
      c.header("retry-after", "60");
      return c.json({ error: "too many invitations — wait a minute and try again" }, 429);
    }

    /* An owner changing their own role is how a site ends up with nobody who can manage it. */
    const existing = await o.auth.userByEmail(email);
    if (existing && existing.id === gate.user.id && role !== "owner") {
      return c.json({
        error:
          "you would be giving up your own ownership — ask another owner to do it",
      }, 409);
    }

    const user = existing || await invitationRecipient(email);
    if (role === "owner") {
      const invited = await inviteOwnership(c, id, gate.user, user);
      if (invited.status === "forbidden") return deny(c, 404);
      return c.json({ userId: user.id, email: user.email, name: user.name, role,
        awaitingAcceptance: invited.status === "pending",
        ...(invited.status === "pending" ? { invitationId: invited.invitation.id } : {}),
      }, 201);
    }
    await invitations.removeForRecipient("site_owner", id, user.id);
    const current = await o.auth.membership(id, user.id);
    if (current) {
      const changed = await o.auth.changeMemberRole(id, user.id, role);
      if (changed.status === "last_owner") {
        return c.json(
          { error: "the last owner cannot give up ownership" },
          409,
        );
      }
      if (changed.status === "missing") {
        return c.json({ error: "they had no access to update" }, 404);
      }
      if (changed.status === "updated") {
        return c.json({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: changed.membership.role,
        }, 201);
      }
    }
    const granted = await o.auth.grant(id, user.id, role);
    return c.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: granted.role,
    }, 201);
  });

  app.delete("/api/sites/:id/people/:userId", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);

    const target = c.req.param("userId");
    const pendingRemoved = await invitations.removeForRecipient("site_owner", id, target);
    const removed = await o.auth.removeMember(id, target);
    if (removed.status === "last_owner") {
      return c.json({
        error:
          "the last owner cannot be removed — a site with no owner cannot be managed",
      }, 409);
    }
    if (removed.status === "missing" && !pendingRemoved) {
      return c.json({ error: "they had no access to remove" }, 404);
    }
    /* Their sessions stay valid and are harmless: access is checked per request against the
       membership, so a membership that is gone is access that is gone. */
    return c.json({ removed: target });
  });

  /* ---------------------------------------------------------------- the assets */

  app.get("/api/sites/:id/assets", async (c) => {
    const [access, metadata] = await Promise.allSettled([
      allowed(c, c.req.param("id"), "read"),
      o.assets ? o.assets.list(c.req.param("id")) : Promise.resolve([]),
    ]);
    if (access.status === 'rejected') throw access.reason;
    const gate = access.value;
    if (!gate.ok) return deny(c, gate.status);
    if (metadata.status === 'rejected') throw metadata.reason;
    const site = await o.store.byId(c.req.param("id"));
    const referenced = documentAssetIds(site?.doc);
    return c.json(metadata.value.filter(asset => !asset.retired || referenced.has(asset.id)).map(metaOf));
  });

  /* Uploading is a write, so a content account may do it: swapping a photograph is a content
     edit in every sense that matters. What it may not do is point an element at the new
     image — that is a prop, and `contentOnly` refuses it. Worth naming as the next thing to
     fix rather than a subtlety to enjoy. */
  app.post("/api/sites/:id/assets", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "write");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) {
      return c.json({ error: "this server stores no assets" }, 501);
    }

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "a file is required" }, 400);
    }
    if (file.size > MAX_BYTES) {
      return c.json(
        { error: `too large — the limit is ${MAX_BYTES} bytes` },
        413,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    /* Sniffed, not trusted. A caller can put anything in Content-Type, and `image/png` on
       arbitrary bytes is a way to host arbitrary content on somebody else's domain. */
    const type = sniff(bytes);
    if (!type || !ALLOWED.has(type)) {
      return c.json({ error: "that is not an image this server serves" }, 415);
    }
    const ownerId = await storageOwner(id, gate.user, gate.role);
    if (!ownerId) {
      return c.json({ error: "this site has no storage owner" }, 409);
    }
    let output: OptimizedImage;
    try {
      output = await optimizeAsset(bytes, type);
    } catch {
      return c.json({
        error: "image_optimization_failed",
        detail:
          "Pagecraft could not optimize this image. Try exporting it as PNG, JPEG, WebP, or SVG.",
      }, 422);
    }
    let saved: AssetRecord;
    try {
      saved = await o.assets.put({
        siteId: id,
        name: optimizedName(file.name || "image", output.extension),
        type: output.type,
        bytes: output.bytes,
        w: output.w,
        h: output.h,
        contentHash: sha256(bytes),
      }, {
        ownerId,
        limitBytes: await storageLimitForOwner(ownerId, gate.user),
        originalBytes: file.size,
        optimized: true,
      });
    } catch (error) {
      if (error instanceof AssetQuotaError) {
        return c.json({
          error: "storage_limit_reached",
          ...error.usage,
          detail:
            "The storage owner’s media allowance is full. Remove unused images and try again.",
        }, 409);
      }
      throw error;
    }
    /* The next public request rebuilds from the metadata list. No image bodies are fetched. */
    built.delete(id);
    return c.json(metaOf(saved), 201);
  });

  /* The editor's view of an asset, by id. The site serves the same bytes at `assets/<name>`;
     this exists because the editor holds ids and knows nothing about names. */
  app.get("/api/sites/:id/assets/:aid", async (c) => {
    const gate = await allowed(c, c.req.param("id"), "read");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.notFound();
    const a = await o.assets.get(c.req.param("id"), c.req.param("aid"));
    if (!a) return c.notFound();
    return c.body(a.bytes as unknown as ArrayBuffer, 200, {
      ...assetHeaders(a),
      "cache-control": "private, max-age=3600",
    });
  });

  app.patch('/api/sites/:id/assets/:aid', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'write');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets?.tag) return c.json({ error: 'Media metadata is not supported by this host.' }, 501);
    const input = await c.req.json().catch(() => null);
    if (!input || !Array.isArray(input.tags) || input.tags.length > 20
      || input.tags.some((tag: unknown) => typeof tag !== 'string' || tag.length > 40 || /[\x00-\x1f]/.test(tag))
      || !Number.isSafeInteger(input.version) || input.version < 0) {
      return c.json({ error: 'Use up to 20 tags of 40 characters and a valid metadata version.' }, 400);
    }
    const tags = [...new Set<string>(input.tags.map((tag: string) => tag.trim()).filter(Boolean))];
    const updated = await o.assets.tag(id, c.req.param('aid'), tags, input.version);
    if (!updated) return c.json({ error: 'This image changed or is no longer available. Reopen the library and try again.' }, 409);
    return c.json(metaOf(updated));
  });

  app.delete("/api/sites/:id/assets/:aid", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "write");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) {
      return c.json({ error: "this server stores no assets" }, 501);
    }
    const aid = c.req.param("aid");
    if (!o.assets.retire) return c.json({ error: 'Safe asset removal is unavailable on this host.' }, 501);
    const site = await o.store.byId(id);
    if (documentAssetIds(site?.doc).has(aid)) return c.json({ error: 'This image is used by the saved draft. Remove its references before removing it from the library.' }, 409);
    const removed = await o.assets.retire(id, aid);
    if (!removed) return c.json({ error: "no such asset" }, 404);
    // Retain bytes even when a concurrent save introduces a reference after this check.
    // Restored references make a retired asset visible in the editor listing again.
    built.delete(id);
    return c.json({ removed: aid });
  });

  /* -------------------------------------------------------- Manual WordPress import */

  const manualImportAccessDigest = (authorization = "") => {
    const token = authorization.match(/^Bearer\s+([^\s]+)$/i)?.[1] || "";
    return token ? hashToken(token) : "";
  };

  const manualImportCatalogReadDigest = async (
    digest: string,
  ): Promise<ManualImportCatalogRead> => {
    if (!digest) return { authorized: false };
    if (o.manualImports) return o.manualImports.catalog(digest);
    const credential = await o.auth.manualImportByAccess(digest);
    if (!credential) return { authorized: false };
    const [sites, memberships] = await Promise.all([
      o.store.list(),
      o.auth.membershipsForUser(credential.ownerId),
    ]);
    const allowedIds = new Set(
      memberships.filter((item) => item.role === "owner").map((item) =>
        item.siteId
      ),
    );
    return {
      authorized: true,
      ownerId: credential.ownerId,
      sites: sites.filter((site) => allowedIds.has(site.id)),
    };
  };

  const manualImportCatalogRead = (c: Context) =>
    manualImportCatalogReadDigest(
      manualImportAccessDigest(c.req.header("authorization")),
    );

  const manualImportProjectRead = async (
    c: Context,
    siteId: string,
  ): Promise<ManualImportProjectRead> => {
    const digest = manualImportAccessDigest(c.req.header("authorization"));
    if (!digest) return { authorized: false };
    if (o.manualImports) return o.manualImports.project(digest, siteId);
    const credential = await o.auth.manualImportByAccess(digest);
    if (!credential) return { authorized: false };
    const membership = await o.auth.membership(siteId, credential.ownerId);
    return {
      authorized: true,
      ownerId: credential.ownerId,
      site: membership?.role === "owner" ? await o.store.byId(siteId) : null,
    };
  };

  const integrationOrigin = (c: Context) =>
    (o.editorOrigin || new URL(c.req.url).origin).replace(/\/+$/, "");

  app.get("/.well-known/pagecraft-integrations", (c) =>
    c.json(integrationDiscovery(integrationOrigin(c))));

  app.get("/v1/integrations/wordpress/connection", async (c) => {
    const digest = manualImportAccessDigest(c.req.header("authorization"));
    const credential = digest
      ? await o.auth.manualImportByAccess(digest)
      : null;
    if (!credential) {
      return c.json({ error: "unauthorized", reconnect: true }, 401);
    }
    return c.json({
      connected: true,
      installationId: credential.installationId,
      scopes: ["projects:read", "packages:read"],
      accessExpiresAt: new Date(credential.accessExpiresAt).toISOString(),
    });
  });

  app.all("/mcp", async (c) => {
    if (!isEditorHost(c.req.header("host"), o)) return c.notFound();
    /* An assistant token (Phase 7) gets its own site-scoped tools. Every other credential keeps
       exactly the read-only tools it had: none of them gains a proposal. */
    const bearer = (c.req.header("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (isAssistantToken(bearer)) {
      const verified = o.assistants ? await o.assistants.authenticate(bearer) : null;
      const context = verified ? await assistantMcpContext(assistantDeps, c, verified) : null;
      if (!context) {
        return c.json({
          error: "invalid_token",
          error_description: "This assistant token is not valid. Create a new one on the site's Assistants page.",
        }, 401, { "www-authenticate": `Bearer realm="Pagecraft", error="invalid_token", resource_metadata="${resourceMetadataUrl(o.editorOrigin || new URL(c.req.url).origin)}"` });
      }
      if (Number(c.req.header("content-length") || 0) > 1_000_000) return c.json({ error: "request_too_large" }, 413);
      return assistantMcpResponse(c.req.raw, context);
    }
    const digest = manualImportAccessDigest(c.req.header("authorization"));
    const read = await manualImportCatalogReadDigest(digest);
    if (!read.authorized) {
      /* No token at all is an MCP client (claude.ai, Claude Desktop) about to sign in, which
         follows `resource_metadata` and asks for the scope named here, so that is the assistant
         scope the metadata lists. A rejected integration token keeps exactly the realm and
         scope it always had. */
      const scope = digest
        ? "projects:read packages:read"
        : ASSISTANT_SCOPES.join(" ");
      return c.json({
        error: "invalid_token",
        error_description: "Connect Pagecraft and supply a valid integration token.",
      }, 401, {
        "www-authenticate":
          `Bearer realm="Pagecraft", scope="${scope}", resource_metadata="${resourceMetadataUrl(o.editorOrigin || new URL(c.req.url).origin)}"`,
      });
    }
    return pagecraftMcpResponse(c.req.raw, read);
  });

  /* The integration namespace is the stable public contract. Keep the original import paths
     as the implementation and rollback surface for one compatibility release. */
  app.all("/v1/integrations/wordpress/*", (c) => {
    const target = new URL(c.req.url);
    target.pathname = target.pathname.replace(
      "/v1/integrations/wordpress/",
      "/v1/wordpress-import/",
    );
    return app.fetch(new Request(target, c.req.raw), c.env);
  });

  app.get("/v1/wordpress-import/authorize", async (c) => {
    if (!o.connected) {
      return c.json({ error: "manual import persistence is unavailable" }, 503);
    }
    const user = await who(c);
    if (!user) {
      return c.redirect(
        `/sign-in?next=${
          encodeURIComponent(
            new URL(c.req.url).pathname + new URL(c.req.url).search,
          )
        }`,
        302,
      );
    }
    const q = c.req.query();
    const installationId = String(q.installation_id || "");
    const redirectUri = String(q.redirect_uri || "");
    const codeChallenge = String(q.code_challenge || "");
    const state = String(q.state || "");
    if (
      !/^[A-Za-z0-9._:-]{8,160}$/.test(installationId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge) ||
      !/^[A-Za-z0-9_-]{16,256}$/.test(state) ||
      String(q.code_challenge_method || "") !== "S256"
    ) {
      return c.json({
        error: "installation, state, and PKCE S256 parameters are required",
      }, 400);
    }
    let redirect: URL;
    try {
      redirect = new URL(redirectUri);
      const localDevelopment = redirect.protocol === "http:" &&
        (redirect.hostname === "localhost" ||
          redirect.hostname === "127.0.0.1" ||
          redirect.hostname === "[::1]" ||
          redirect.hostname.endsWith(".local"));
      if (
        (redirect.protocol !== "https:" && !localDevelopment) ||
        redirect.username || redirect.password || redirect.hash ||
        // WordPress admin_url() includes the installation directory on subdirectory installs.
        // Keep the exact admin endpoint and ordinary path segments; do not admit encoded separators.
        !/^\/(?:[A-Za-z0-9._~-]+\/)*wp-admin\/admin-post\.php$/.test(redirect.pathname) ||
        redirect.searchParams.get("action") !== "pagecraft_cloud_callback" ||
        redirect.searchParams.size !== 1
      ) throw new Error();
    } catch {
      return c.json({
        error:
          "redirect_uri must be the exact HTTPS Pagecraft callback in WordPress admin",
      }, 400);
    }
    const projects = (await visibleSites(user)).filter((item) =>
      item.role === "owner"
    );
    if (!projects.length) {
      return c.json({ error: "this account owns no Pagecraft projects" }, 403);
    }
    const csrf = newToken();
    const consent: ManualImportConsent = {
      userId: user.id,
      installationId,
      redirectUri: redirect.href,
      codeChallenge,
      state,
    };
    await o.connected.putGrant({
      digest: hashToken(csrf),
      kind: "manual-import-consent",
      siteId: null,
      connectionId: null,
      payload: consent as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return c.html(shell(
      "Connect Pagecraft",
      `<section class="consent">
      <header class="consent__header">
        <div class="consent__brand"><img src="/brand/pagecraft-favicon.svg" alt=""><span>Pagecraft</span></div>
        <h1>Allow this WordPress site to import from Pagecraft?</h1>
        <p>${
        projects.length === 1
          ? "You can choose your project after approving."
          : `You can choose from ${projects.length} projects after approving.`
      }</p>
      </header>
      <div class="consent__body">
        <div class="consent__destination"><span>WordPress site</span><strong>${
        escapeHtml(wordpressSiteUrl(redirect.href))
      }</strong></div>
        <p class="consent__note">This gives the WordPress site read-only access to projects you own. Imports are manual and do not stay in sync. Pagecraft does not receive your WordPress password.</p>
        <form class="consent__actions" method="post" action="/v1/wordpress-import/authorize">
          <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
          <button class="pc-btn primary" type="submit">Approve</button>
        </form>
      </div>
    </section>`,
    ));
  });

  app.post("/v1/wordpress-import/authorize", async (c) => {
    if (!o.connected) {
      return c.json({ error: "manual import persistence is unavailable" }, 503);
    }
    const user = await who(c);
    if (!user) return c.json({ error: "sign in" }, 401);
    const body = await c.req.parseBody().catch(() => null) as
      | Record<string, unknown>
      | null;
    const grant = body?.csrf
      ? await o.connected.consumeGrant(
        hashToken(String(body.csrf)),
        "manual-import-consent",
        new Date().toISOString(),
      )
      : null;
    const consent = grant?.payload as unknown as
      | ManualImportConsent
      | undefined;
    if (!consent || consent.userId !== user.id) {
      return c.json({ error: "consent expired or already used" }, 400);
    }
    const code = newToken();
    await o.connected.putGrant({
      digest: hashToken(code),
      kind: "manual-import-code",
      siteId: null,
      connectionId: null,
      payload: consent as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    const redirect = new URL(consent.redirectUri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", consent.state);
    return c.redirect(redirect.href, 302);
  });

  app.post("/v1/wordpress-import/token", async (c) => {
    if (!o.connected) {
      return c.json({ error: "manual import persistence is unavailable" }, 503);
    }
    const body = await c.req.json().catch(() => null) as
      | Record<string, unknown>
      | null;
    const grantType = String(body?.grant_type || "");
    if (grantType === "authorization_code") {
      const code = String(body?.code || "");
      const verifier = String(body?.code_verifier || "");
      const grant = code
        ? await o.connected.consumeGrant(
          hashToken(code),
          "manual-import-code",
          new Date().toISOString(),
        )
        : null;
      const consent = grant?.payload as unknown as
        | ManualImportConsent
        | undefined;
      const challenge = base64url(
        new Uint8Array(Buffer.from(hashToken(verifier), "hex")),
      );
      if (
        !consent || consent.redirectUri !== String(body?.redirect_uri || "") ||
        challenge !== consent.codeChallenge
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      const accessToken = newToken(),
        refreshToken = newToken(),
        expiresAt = Date.now() + 15 * 60 * 1000;
      const credential = await o.auth.createManualImportCredential({
        id: crypto.randomUUID(),
        ownerId: consent.userId,
        installationId: consent.installationId,
        siteUrl: wordpressSiteUrl(consent.redirectUri),
        accessTokenDigest: hashToken(accessToken),
        accessExpiresAt: expiresAt,
        refreshTokenDigest: hashToken(refreshToken),
      });
      return c.json({
        token_type: "Bearer",
        access_token: accessToken,
        expires_in: 15 * 60,
        refresh_token: refreshToken,
        credential_id: credential.id,
        scope: "projects:read packages:read",
      });
    }
    if (grantType === "refresh_token") {
      const refreshDigest = hashToken(String(body?.refresh_token || ""));
      const accessToken = newToken(), refreshToken = newToken(), expiresAt = Date.now() + 15 * 60 * 1000;
      const exchanged = await o.auth.exchangeManualImportRefresh(
        refreshDigest, hashToken(accessToken), expiresAt, hashToken(refreshToken),
      );
      if (exchanged.status !== "rotated") return c.json({ error: "invalid_grant", reconnect: true }, 401);
      const rotated = exchanged.credential;
      return c.json({
        token_type: "Bearer",
        access_token: accessToken,
        expires_in: 15 * 60,
        /* A gateway that does not rotate yet keeps the old refresh token; the plugin keeps its
           stored one when this is absent. */
        ...(rotated.refreshTokenDigest === hashToken(refreshToken)
          ? { refresh_token: refreshToken }
          : {}),
      });
    }
    return c.json({ error: "unsupported_grant_type" }, 400);
  });

  app.get("/v1/wordpress-import/projects", async (c) => {
    const read = await manualImportCatalogRead(c);
    if (!read.authorized) {
      return c.json({ error: "unauthorized", reconnect: true }, 401);
    }
    const projects = read.sites.map((site) => ({
      id: site.id,
      name: site.name,
      pageCount: site.doc.pages.length,
      modifiedAt: site.updatedAt,
      sourceVersion: site.version,
    }));
    return c.json({ projects });
  });

  app.get("/v1/wordpress-import/catalog", async (c) => {
    const read = await manualImportCatalogRead(c);
    if (!read.authorized) {
      return c.json({ error: "unauthorized", reconnect: true }, 401);
    }
    return c.json({
      projects: read.sites.map((site) => {
        const base = shareUrl(c, o, site);
        return {
          id: site.id,
          name: site.name,
          pageCount: site.doc.pages.length,
          modifiedAt: site.updatedAt,
          sourceVersion: site.version,
          pages: site.doc.pages.map((page) => ({
            id: page.id,
            name: page.name || page.title || "Untitled page",
            slug: page.slug,
            previewUrl: new URL(
              page.slug === "index" ? "./" : `./${page.slug}`,
              base,
            ).href,
            modifiedAt: site.updatedAt,
            sourceVersion: site.version,
          })),
        };
      }),
    });
  });

  app.get("/v1/wordpress-import/projects/:projectId/package", async (c) => {
    const read = await manualImportProjectRead(
      c,
      c.req.param("projectId"),
    );
    if (!read.authorized) {
      return c.json({ error: "unauthorized", reconnect: true }, 401);
    }
    const site = read.site;
    if (!site) return c.notFound();
    try {
      const assetIds = new Set(portableAssetIds(site.doc));
      return portableDownload(
        c,
        createSitePackage({
          document: site.doc,
          assets: await assetBodiesOf(site.id, assetIds),
          provenance: {
            format: "pagecraft.provenance.v1",
            origin: "pagecraft-cloud",
            sourceId: site.id,
            sourceVersion: site.version,
            exportedBy: read.ownerId,
          },
        }),
      );
    } catch (error) {
      return c.json({
        error: shownError(error, "the package could not be built"),
      }, 422);
    }
  });

  /* Retained for one rollback release. The active WordPress UI uses the whole-project route. */
  app.get("/v1/wordpress-import/projects/:id/pages", async (c) => {
    const read = await manualImportProjectRead(c, c.req.param("id"));
    if (!read.authorized) {
      return c.json({ error: "unauthorized", reconnect: true }, 401);
    }
    const site = read.site;
    if (!site) return c.notFound();
    const base = shareUrl(c, o, site);
    return c.json({
      project: { id: site.id, name: site.name, sourceVersion: site.version },
      pages: site.doc.pages.map((page) => ({
        id: page.id,
        name: page.name || page.title || "Untitled page",
        slug: page.slug,
        previewUrl:
          new URL(page.slug === "index" ? "./" : `./${page.slug}`, base).href,
        modifiedAt: site.updatedAt,
        sourceVersion: site.version,
      })),
    });
  });

  app.get(
    "/v1/wordpress-import/projects/:id/pages/:pageId/package",
    async (c) => {
      const read = await manualImportProjectRead(c, c.req.param("id"));
      if (!read.authorized) {
        return c.json({
          error: "unauthorized",
          reconnect: true,
        }, 401);
      }
      const site = read.site;
      if (!site) return c.notFound();
      try {
        const pageId = c.req.param("pageId");
        const assetIds = new Set(portableAssetIds(site.doc, pageId));
        return portableDownload(
          c,
          createPagePackage({
            document: site.doc,
            pageId,
            assets: await assetBodiesOf(site.id, assetIds),
            provenance: {
              format: "pagecraft.provenance.v1",
              origin: "pagecraft-cloud",
              sourceId: site.id,
              sourceVersion: site.version,
              exportedBy: read.ownerId,
            },
          }),
        );
      } catch (error) {
        return c.json({
          error: shownError(error, "the package could not be built"),
        }, 422);
      }
    },
  );

  app.post("/v1/wordpress-import/revoke", async (c) => {
    const body = await c.req.json().catch(() => null) as {
      refresh_token?: string;
      credential_id?: string;
    } | null;
    const refreshDigest = hashToken(String(body?.refresh_token || ""));
    const credential = await o.auth.manualImportByRefresh(refreshDigest);
    if (!credential || credential.id !== String(body?.credential_id || "")) {
      return c.json({ revoked: true });
    }
    await o.auth.revokeManualImportCredential(credential.id, refreshDigest);
    return c.json({ revoked: true });
  });

  /* -------------------------------------------------------- Retained Connected WordPress checkpoint */

  app.get("/v1/oauth/authorize", async (c) => {
    if (!o.connected) return releaseUnavailable(c);
    const q = c.req.query();
    const user = await who(c);
    if (!user) {
      return c.redirect(
        `/sign-in?next=${
          encodeURIComponent(
            new URL(c.req.url).pathname + new URL(c.req.url).search,
          )
        }`,
        302,
      );
    }
    const exact = (camel: string, snake?: string) => {
      const a = q[camel], b = snake ? q[snake] : undefined;
      if (a && b && a !== b) {
        throw new Error(`${camel} was supplied twice with different values`);
      }
      return String(a || b || "");
    };
    let siteId = "",
      installationId = "",
      environment = "",
      profile = "",
      targetOrigin = "",
      targetPath = "",
      redirectUri = "",
      webhookUrl = "",
      codeChallenge = "",
      state = "",
      scope = "";
    try {
      siteId = exact("siteId", "site_id");
      installationId = exact("installationId", "installation_id");
      environment = exact("environment");
      profile = exact("profile");
      targetOrigin = exact("targetOrigin", "target_origin");
      targetPath = exact("targetPath", "target_path");
      redirectUri = exact("redirectUri", "redirect_uri");
      webhookUrl = exact("webhookUrl", "webhook_url");
      codeChallenge = exact("codeChallenge", "code_challenge");
      state = exact("state");
      scope = exact("scope");
      if (exact("codeChallengeMethod", "code_challenge_method") !== "S256") {
        throw new Error("PKCE S256 is required");
      }
    } catch (error) {
      return c.json({ error: String((error as Error).message) }, 400);
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
      return c.json({ error: "PKCE S256 codeChallenge is required" }, 400);
    }
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(installationId)) {
      return c.json({ error: "a stable installationId is required" }, 400);
    }
    if (environment !== "staging" && environment !== "production") {
      return c.json(
        { error: "environment must be staging or production" },
        400,
      );
    }
    if (profile !== "pagecraft-theme" && profile !== "existing-theme") {
      return c.json({
        error: "profile must be pagecraft-theme or existing-theme",
      }, 400);
    }
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(state)) {
      return c.json({ error: "OAuth state is required" }, 400);
    }
    const requiredScopes = [
      "release:read",
      "deploy:ack",
      "cms:write",
      "editor:open",
      "content:index",
    ];
    const scopes = [...new Set(scope.split(/[\s,]+/).filter(Boolean))].sort();
    if (scopes.join(" ") !== [...requiredScopes].sort().join(" ")) {
      return c.json({
        error: `scope must be exactly: ${requiredScopes.join(" ")}`,
      }, 400);
    }
    let redirect: URL, webhook: URL;
    try {
      targetOrigin = canonicalOrigin(targetOrigin);
      targetPath = canonicalTargetPath(targetPath || "/");
      redirect = new URL(redirectUri);
      if (
        redirect.origin !== targetOrigin ||
        (redirect.protocol !== "https:" && redirect.hostname !== "localhost")
      ) {
        throw new Error("redirectUri must belong to the paired HTTPS origin");
      }
      if (redirect.username || redirect.password || redirect.hash) {
        throw new Error(
          "redirectUri may not contain credentials or a fragment",
        );
      }
      webhook = new URL(webhookUrl);
      if (
        webhook.origin !== targetOrigin || webhook.username ||
        webhook.password || webhook.search || webhook.hash ||
        !webhook.pathname.endsWith("/wp-json/pagecraft/v1/releases/available")
      ) {
        throw new Error(
          "webhookUrl must be the Pagecraft REST endpoint on the paired origin",
        );
      }
    } catch (error) {
      return c.json({ error: String((error as Error).message) }, 400);
    }
    const projects = (await visibleSites(user)).filter((item) =>
      roleAllows(item.role, "admin")
    );
    if (!projects.length) {
      return c.json(
        { error: "no project can be connected by this account" },
        403,
      );
    }
    if (siteId && !projects.some((item) => item.site.id === siteId)) {
      return c.notFound();
    }
    const csrf = newToken();
    const consent: OAuthConsent = {
      userId: user.id,
      request: {
        suggestedSiteId: siteId,
        installationId,
        environment,
        profile,
        targetOrigin,
        targetPath,
        redirectUri: redirect.href,
        webhookUrl: webhook.href,
        codeChallenge,
        state,
        scopes: requiredScopes,
      },
    };
    await o.connected.putGrant({
      digest: hashToken(csrf),
      kind: "oauth-consent",
      siteId: siteId || null,
      connectionId: null,
      payload: consent as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    const options = projects.map((item) =>
      `<option value="${escapeHtml(item.site.id)}"${
        item.site.id === siteId ? " selected" : ""
      }>${escapeHtml(item.site.name)}</option>`
    ).join("");
    return c.html(
      shell(
        "Connect WordPress",
        `<h1>Connect this WordPress site?</h1>
      <p>Review the exact destination and choose the Pagecraft project. Nothing is connected until you approve.</p>
      <div class="ok"><strong>${
          escapeHtml(targetOrigin + targetPath)
        }</strong><br>
      <small>${escapeHtml(environment)} · ${escapeHtml(profile)}<br>${
          requiredScopes.map(escapeHtml).join(" · ")
        }</small></div>
      <form method="post" action="/v1/oauth/authorize">
        <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <label for="siteId">Pagecraft project</label>
        <select id="siteId" name="siteId" required>${options}</select>
        <button type="submit">Approve connection</button>
      </form>`,
      ),
    );
  });

  app.post("/v1/oauth/authorize", async (c) => {
    if (!o.connected) return releaseUnavailable(c);
    const user = await who(c);
    if (!user) return c.json({ error: "sign in" }, 401);
    const body = await c.req.parseBody().catch(() => null) as
      | Record<string, unknown>
      | null;
    const csrf = String(body?.csrf || "");
    const grant = csrf
      ? await o.connected.consumeGrant(
        hashToken(csrf),
        "oauth-consent",
        new Date().toISOString(),
      )
      : null;
    const consent = grant?.payload as unknown as OAuthConsent | undefined;
    if (!consent || consent.userId !== user.id) {
      return c.json({ error: "consent expired or already used" }, 400);
    }
    const siteId = String(body?.siteId || "");
    const membership = await o.auth.membership(siteId, user.id);
    if (!membership || !roleAllows(membership.role, "admin")) {
      return c.notFound();
    }
    const request = consent.request;
    const code = newToken(), connectionId = crypto.randomUUID();
    try {
      await o.connected.createConnection({
        id: connectionId,
        siteId,
        createdBy: user.id,
        installationId: request.installationId,
        environment: request.environment,
        profile: request.profile,
        targetOrigin: request.targetOrigin,
        targetPath: request.targetPath,
        redirectUri: request.redirectUri,
        webhookUrl: request.webhookUrl,
        scopes: request.scopes,
        status: "pending",
        codeChallenge: request.codeChallenge,
        authorizationCodeDigest: hashToken(code),
        authorizationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
          .toISOString(),
        authorizationCodeUsedAt: null,
        confirmationExpiresAt: null,
        confirmedAt: null,
        accessTokenDigest: null,
        accessTokenExpiresAt: null,
        refreshTokenDigest: null,
        desiredReleaseId: null,
        pendingReleaseId: null,
        nextSequence: 1,
        lastAcknowledgedSequence: 0,
        activeReleaseId: null,
        activeHash: null,
      });
    } catch (error) {
      /* The memory store words these for people; Postgres names the unique index instead. */
      const message = String((error as Error).message);
      const taken = !/unique|duplicate/i.test(message)
        ? ""
        : /one_environment/.test(message)
        ? `site already has a ${request.environment} connection`
        : /installation_idx/.test(message)
        ? "WordPress installation is already paired"
        : /target_idx/.test(message)
        ? "WordPress target is already paired"
        : "";
      return c.json({
        error: taken ||
          shownError(error, "the WordPress connection could not be created"),
      }, 409);
    }
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", request.state);
    return c.redirect(redirect.href, 302);
  });

  app.post("/v1/oauth/token", async (c) => {
    if (!releaseReady()) return releaseUnavailable(c);
    const contentType = c.req.header("content-type") || "";
    const body = contentType.includes("application/json")
      ? await c.req.json().catch(() => null) as Record<string, unknown> | null
      : await c.req.parseBody().catch(() => null) as
        | Record<string, unknown>
        | null;
    if (!body) return c.json({ error: "invalid_request" }, 400);
    const grantType = String(body.grant_type || body.grantType || "");
    const tokenReply = (
      connection: WordPressConnection,
      accessToken: string,
      refreshToken?: string,
    ) => {
      const here = o.editorOrigin || new URL(c.req.url).origin;
      return {
        tokenType: "Bearer",
        accessToken,
        expiresIn: 15 * 60,
        ...(refreshToken ? { refreshToken } : {}),
        connectionId: connection.id,
        siteId: connection.siteId,
        scopes: connection.scopes,
        environment: connection.environment,
        profile: connection.profile,
        editorSessionUrl: `${here}/v1/connections/${
          encodeURIComponent(connection.id)
        }/editor-sessions`,
        keysetEnvelope: o.keysetEnvelope,
      };
    };
    if (grantType === "authorization_code") {
      const code = String(body.code || "");
      const verifier = String(body.code_verifier || body.codeVerifier || "");
      const digest = hashToken(code);
      const now = new Date().toISOString();
      const pending = await o.connected!.authorizationConnection(digest, now);
      if (
        !pending ||
        pending.redirectUri !==
          String(body.redirect_uri || body.redirectUri || "")
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      const challenge = base64url(
        new Uint8Array(Buffer.from(hashToken(verifier), "hex")),
      );
      if (challenge !== pending.codeChallenge) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      const consumed = await o.connected!.useAuthorizationCode(digest, now);
      if (!consumed) return c.json({ error: "invalid_grant" }, 400);
      const accessToken = oauthCredential(
        "access",
        consumed.id,
        code,
        verifier,
      );
      const refreshToken = oauthCredential(
        "refresh",
        consumed.id,
        code,
        verifier,
      );
      const provisioned = await o.connected!.provisionConnection(consumed.id, {
        accessTokenDigest: hashToken(accessToken),
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
          .toISOString(),
        refreshTokenDigest: hashToken(refreshToken),
        confirmationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
          .toISOString(),
      });
      if (!provisioned) return c.json({ error: "invalid_grant" }, 400);
      return c.json(tokenReply(provisioned, accessToken, refreshToken));
    }
    if (grantType === "refresh_token") {
      const connection = await o.connected!.connectionByRefreshToken(
        hashToken(String(body.refresh_token || body.refreshToken || "")),
      );
      if (!connection) return c.json({ error: "invalid_grant" }, 400);
      const accessToken = newToken();
      const rotated = await o.connected!.rotateAccessToken(
        connection.id,
        hashToken(accessToken),
        new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      );
      if (!rotated) return c.json({ error: "invalid_grant" }, 400);
      return c.json(tokenReply(rotated, accessToken));
    }
    return c.json({ error: "unsupported_grant_type" }, 400);
  });

  app.post("/v1/connections/:id/confirm", async (c) => {
    if (!o.connected) {
      return c.json({ error: "connected persistence is unavailable" }, 503);
    }
    const bearer =
      (c.req.header("authorization") || "").match(/^Bearer\s+([^\s]+)$/i)
        ?.[1] || "";
    const idempotencyKey = String(c.req.header("idempotency-key") || "");
    if (!bearer) return c.json({ error: "unauthorized" }, 401);
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
      return c.json(
        { error: "a stable Idempotency-Key header is required" },
        400,
      );
    }
    const body = await c.req.json().catch(() => null) as {
      installationId?: string;
    } | null;
    if (!body?.installationId) {
      return c.json({ error: "installationId is required" }, 400);
    }
    const result = await o.connected.confirmConnection({
      id: c.req.param("id"),
      accessTokenDigest: hashToken(bearer),
      installationId: body.installationId,
      now: new Date().toISOString(),
    });
    if (!result) {
      return c.json({ error: "unauthorized or expired confirmation" }, 401);
    }
    return c.json({
      connectionId: result.connection.id,
      status: "active",
      confirmedAt: result.connection.confirmedAt,
      alreadyConfirmed: result.alreadyConfirmed,
    });
  });

  app.post("/v1/connections/:id/editor-sessions", async (c) => {
    const connection = await bearerConnection(c);
    if (
      !connection || connection.id !== c.req.param("id") ||
      !connection.scopes.includes("editor:open")
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json().catch(() => null) as {
      installationId?: string;
      pageId?: string;
      returnUrl?: string;
    } | null;
    if (!body || body.installationId !== connection.installationId) {
      return c.json(
        { error: "installationId does not match this connection" },
        403,
      );
    }
    let returnUrl: string | null = null;
    if (body.returnUrl) {
      try {
        const candidate = new URL(body.returnUrl);
        if (
          candidate.origin !== connection.targetOrigin || candidate.username ||
          candidate.password
        ) throw new Error();
        returnUrl = candidate.href;
      } catch {
        return c.json({
          error: "returnUrl must belong to the paired WordPress origin",
        }, 400);
      }
    }
    const code = newToken(),
      expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    await o.connected!.putGrant({
      digest: hashToken(code),
      kind: "editor-code",
      siteId: connection.siteId,
      connectionId: connection.id,
      payload: {
        installationId: connection.installationId,
        targetOrigin: connection.targetOrigin,
        ownerId: connection.createdBy,
        pageId: body.pageId ? String(body.pageId).slice(0, 160) : null,
        returnUrl,
      },
      expiresAt,
    });
    const here = o.editorOrigin || new URL(c.req.url).origin;
    return c.json({
      url: `${here}/v1/editor/session?code=${encodeURIComponent(code)}`,
      expiresAt,
    }, 201);
  });

  app.get("/v1/editor/session", async (c) => {
    const code = c.req.query("code") || "";
    const digest = hashToken(code);
    const grant = code && o.connected
      ? await o.connected.consumeGrant(
        digest,
        "editor-code",
        new Date().toISOString(),
      )
      : null;
    const ticket = grant
      ? {
        connectionId: grant.connectionId!,
        siteId: grant.siteId!,
        installationId: String(grant.payload.installationId || ""),
        targetOrigin: String(grant.payload.targetOrigin || ""),
        ownerId: String(grant.payload.ownerId || ""),
        pageId: grant.payload.pageId == null
          ? null
          : String(grant.payload.pageId),
        returnUrl: grant.payload.returnUrl == null
          ? null
          : String(grant.payload.returnUrl),
      }
      : null;
    if (!ticket) {
      return c.json({ error: "editor code expired or already used" }, 401);
    }
    let browserOrigin = "";
    try {
      const supplied = c.req.header("origin") || c.req.header("referer") || "";
      browserOrigin = new URL(supplied).origin;
    } catch { /* fail closed below */ }
    if (browserOrigin !== ticket.targetOrigin) {
      return c.json({ error: "editor code belongs to another origin" }, 403);
    }
    const connection = await o.connected?.connection(ticket.connectionId);
    if (
      !connection || connection.status !== "active" ||
      connection.installationId !== ticket.installationId
    ) {
      return c.json({ error: "connection is no longer active" }, 401);
    }
    const site = await o.store.byId(connection.siteId);
    if (!site || !o.editorHtml) return c.notFound();
    const editorSessionToken = newToken();
    const editorSessionExpiresAt = new Date(Date.now() + 20 * 60 * 1000)
      .toISOString();
    await o.connected!.putEditorCredential({
      digest: hashToken(editorSessionToken),
      connectionId: connection.id,
      siteId: connection.siteId,
      ownerId: ticket.ownerId,
      expiresAt: editorSessionExpiresAt,
    });
    c.header(
      "content-security-policy",
      `frame-ancestors ${connection.targetOrigin}; base-uri 'none'; object-src 'none'`,
    );
    c.header("vary", "Origin, Referer");
    c.header("cache-control", "private, no-store");
    return c.html(inject(o.editorHtml, {
      siteId: site.id,
      host: site.host,
      slug: site.slug,
      name: site.name,
      url: shareUrl(c, o, site),
      version: site.version,
      publishedVersion: site.publishedVersion,
      schemaVersion: site.doc.schemaVersion,
      role: "owner",
      doc: site.doc,
      connectionId: connection.id,
      editorSessionToken,
      editorSessionExpiresAt,
      pageId: ticket.pageId,
      returnUrl: ticket.returnUrl,
      wordpressContent: await wordpressContentForSite(site.id),
    }));
  });

  app.put("/v1/connections/:id/content-index", async (c) => {
    const connection = await bearerConnection(c);
    if (
      !connection || connection.id !== c.req.param("id") ||
      !connection.scopes.includes("content:index")
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json().catch(() => null) as {
      installationId?: string;
      generation?: number;
      items?: unknown[];
    } | null;
    if (!body || body.installationId !== connection.installationId) {
      return c.json(
        { error: "installationId does not match this connection" },
        403,
      );
    }
    if (!Number.isSafeInteger(body.generation) || Number(body.generation) < 1) {
      return c.json(
        { error: "generation must be a positive safe integer" },
        400,
      );
    }
    if (!Array.isArray(body.items) || body.items.length > 2000) {
      return c.json({
        error: "items must be an array containing at most 2000 entries",
      }, 400);
    }
    const items: WordPressContentIndexItem[] = [];
    const ids = new Set<string>();
    for (const raw of body.items) {
      if (!raw || typeof raw !== "object") {
        return c.json({ error: "every content item must be an object" }, 400);
      }
      const item = raw as Record<string, unknown>;
      const id = String(item.id || "").trim();
      const objectType = String(item.objectType || "");
      const title = String(item.title || "").trim();
      const urlText = String(item.url || "").trim();
      const modified = new Date(String(item.modifiedAt || ""));
      if (!/^[A-Za-z0-9._:-]{1,160}$/.test(id) || ids.has(id)) {
        return c.json({
          error: "content item IDs must be unique stable identifiers",
        }, 400);
      }
      if (objectType !== "page" && objectType !== "post") {
        return c.json(
          { error: "content item objectType must be page or post" },
          400,
        );
      }
      if (!title || title.length > 240 || /[\u0000-\u001f\u007f]/.test(title)) {
        return c.json({
          error: "content item titles must be 1 to 240 visible characters",
        }, 400);
      }
      let url: URL;
      try {
        url = new URL(urlText);
      } catch {
        return c.json({ error: "content item URLs must be absolute" }, 400);
      }
      const pathRoot = connection.targetPath === "/"
        ? "/"
        : connection.targetPath.replace(/\/$/, "");
      if (
        url.origin !== connection.targetOrigin || url.username ||
        url.password || url.hash || url.search ||
        (url.protocol !== "https:" && url.hostname !== "localhost") ||
        (pathRoot !== "/" && url.pathname !== pathRoot &&
          !url.pathname.startsWith(`${pathRoot}/`)) ||
        url.href.length > 2048
      ) {
        return c.json({
          error: "content item URLs must belong to the paired WordPress target",
        }, 400);
      }
      if (Number.isNaN(modified.getTime())) {
        return c.json(
          { error: "content item modifiedAt must be an ISO date" },
          400,
        );
      }
      ids.add(id);
      items.push({
        id,
        objectType,
        title,
        url: url.href,
        modifiedAt: modified.toISOString(),
      });
    }
    items.sort((a, b) =>
      utf8ByteCompare(a.objectType, b.objectType) ||
      utf8ByteCompare(a.title, b.title) || utf8ByteCompare(a.id, b.id)
    );
    const generation = Number(body.generation);
    const result = await o.connected!.replaceWordPressContentIndex({
      connectionId: connection.id,
      generation,
      bodyHash: sha256(
        new TextEncoder().encode(canonicalJson({ generation, items })),
      ),
      items,
      syncedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      if (
        result.error === "unknown-connection" ||
        result.error === "connection-inactive"
      ) {
        return c.json({ error: result.error }, 401);
      }
      return c.json({ error: result.error }, 409);
    }
    return c.json({
      generation: result.snapshot.generation,
      itemCount: result.snapshot.items.length,
      syncedAt: result.snapshot.syncedAt,
      duplicate: result.duplicate,
    }, result.duplicate ? 200 : 201);
  });

  app.get("/v1/sites/:id/wordpress-content", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    if (!await o.store.byId(id)) return deny(c, 404);
    return c.json({ targets: await wordpressContentForSite(id) });
  });

  const portableDownload = (
    c: Context,
    pkg: ReturnType<typeof createSitePackage>,
  ) =>
    c.body(
      pkg.bytes as unknown as ArrayBuffer,
      200,
      {
        "content-type": "application/zip",
        "content-length": String(pkg.bytes.byteLength),
        "content-disposition": `attachment; filename="${pkg.filename}"`,
        "x-pagecraft-content-sha256": pkg.sha256,
        "cache-control": "private, no-store",
      },
    );

  app.get("/v1/sites/:id/packages/site", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    try {
      const assetIds = new Set(portableAssetIds(site.doc));
      return portableDownload(
        c,
        createSitePackage({
          document: site.doc,
          assets: await assetBodiesOf(id, assetIds),
          provenance: {
            format: "pagecraft.provenance.v1",
            origin: "pagecraft-cloud",
            sourceId: site.id,
            sourceVersion: site.version,
            exportedBy: gate.user.id,
          },
        }),
      );
    } catch (error) {
      return c.json({
        error: shownError(error, "the package could not be built"),
      }, 422);
    }
  });

  app.get("/v1/sites/:id/packages/pages/:pageId", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    try {
      const pageId = c.req.param("pageId");
      const assetIds = new Set(portableAssetIds(site.doc, pageId));
      return portableDownload(
        c,
        createPagePackage({
          document: site.doc,
          pageId,
          assets: await assetBodiesOf(id, assetIds),
          provenance: {
            format: "pagecraft.provenance.v1",
            origin: "pagecraft-cloud",
            sourceId: site.id,
            sourceVersion: site.version,
            exportedBy: gate.user.id,
          },
        }),
      );
    } catch (error) {
      return c.json({
        error: shownError(error, "the package could not be built"),
      }, 422);
    }
  });

  app.get("/v1/sites/:id/connections", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.connected) return c.json({ connections: [] });
    return c.json({
      connections: (await o.connected.connectionsForSite(id)).map(
        publicConnection,
      ),
    });
  });

  app.get("/v1/sites/:id/releases", async (c) => {
    const id = c.req.param("id");
    const gate = await allowed(c, id, "read");
    if (!gate.ok) return deny(c, gate.status);
    if (!o.connected) return c.json({ publishedVersion: null, releases: [] });
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const [releases, connections] = await Promise.all([
      o.connected.releasesForSite(id),
      o.connected.connectionsForSite(id),
    ]);
    const out = await Promise.all(releases.map(async (release) => {
      const deployments = await o.connected!.deploymentsForRelease(release.id);
      return {
        releaseId: release.id,
        sequence: release.sequence,
        sourceVersion: release.sourceVersion,
        schemaVersion: release.schemaVersion,
        parentReleaseId: release.parentReleaseId,
        artifactHash: release.artifactHash,
        audit: release.audit,
        createdAt: release.createdAt,
        targets: connections.map((connection) => {
          const history = deployments.filter((item) =>
            item.connectionId === connection.id
          );
          return {
            connection: publicConnection(connection),
            desired: connection.desiredReleaseId === release.id,
            pending: connection.pendingReleaseId === release.id,
            active: connection.activeReleaseId === release.id,
            status: history.at(-1)?.status || null,
            detail: history.at(-1)?.detail || null,
            updatedAt: history.at(-1)?.createdAt || null,
          };
        }),
      };
    }));
    return c.json({
      draftVersion: site.version,
      publishedVersion: site.publishedVersion,
      publishedReleaseId: site.publishedReleaseId,
      releases: out,
    });
  });

  app.post("/v1/sites/:id/releases", async (c) => {
    if (!releaseReady()) return releaseUnavailable(c);
    const id = c.req.param("id");
    const gate = await allowed(c, id, "admin");
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const body = await c.req.json().catch(() => null) as {
      sourceVersion?: number;
      idempotencyKey?: string;
      acknowledgeWarnings?: boolean;
    } | null;
    const sourceVersion = body?.sourceVersion ?? site.version;
    const idempotencyKey = String(
      body?.idempotencyKey || c.req.header("idempotency-key") || "",
    );
    if (
      !Number.isInteger(sourceVersion) || sourceVersion < 1 ||
      !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)
    ) {
      return c.json({
        error: "sourceVersion and a stable idempotencyKey are required",
      }, 400);
    }
    /* If a prior worker committed the hosted pointer but lost the response before recording
       the delivery finalization, reconcile that safe ordering edge before reserving a child. */
    if (site.publishedReleaseId) {
      try {
        if (
          !await o.connected!.markReleasePublished(
            site.publishedReleaseId,
            site.updatedAt,
          )
        ) {
          return c.json({
            error:
              "the current public release has an invalid finalization state",
          }, 409);
        }
      } catch (error) {
        c.header("retry-after", "5");
        return c.json({
          error: "the current publication is still being finalized",
          retryable: true,
          detail: shownError(error, "Try this publish again in a few seconds."),
        }, 503);
      }
    }
    const revision = await o.store.revision(id, sourceVersion);
    if (!revision) return c.json({ error: "no such source revision" }, 404);
    let document: Doc | null = null;
    try {
      document = adopt(revision.doc);
    } catch (error) {
      return c.json({
        error: "invalid document",
        detail: String((error as Error).message),
      }, 422);
    }
    if (!document) {
      return c.json({
        error: "newer schema",
        detail: "This release needs a newer Pagecraft server.",
      }, 409);
    }
    const [connections, connectionHistory] = await Promise.all([
      o.connected!.connectionsForSite(id),
      o.connected!.connectionHistoryForSite(id),
    ]);
    const activeConnections = connections.filter((connection) =>
      connection.status === "active"
    );
    if (
      new Set(activeConnections.map((connection) => connection.profile)).size >
        1
    ) {
      return c.json({
        error: "incompatible WordPress setup profiles",
        detail:
          "Staging and production must both use Existing Theme or both use Pagecraft Theme.",
      }, 409);
    }
    /* The first Connected picker stored an absolute indexed permalink. Compile those
       exact legacy values through the same target-neutral contract as new editor writes,
       so an untouched staging selection cannot enter the production release. */
    const indexedWordPressTargets = await wordpressContentForSite(id);
    const migratedWordPressLinks = migrateIndexedWordPressLinks(
      document,
      connectionHistory.map((connection) => {
        const indexed = indexedWordPressTargets.find((target) =>
          target.connectionId === connection.id
        );
        return {
          targetOrigin: connection.targetOrigin,
          targetPath: connection.targetPath,
          items: indexed?.items || [],
        };
      }),
    );
    if (migratedWordPressLinks.unsafeTargetUrls.length) {
      return c.json({
        error: "Connected WordPress link preflight failed",
        errorCodes: ["wordpress-link-target-specific"],
        detail:
          "A link still points directly at a paired WordPress target but is not in its current content index. Choose a current WordPress page or post in Pagecraft, or replace it with a portable custom destination.",
        urls: migratedWordPressLinks.unsafeTargetUrls,
      }, 422);
    }
    document = migratedWordPressLinks.document;
    const stylesheetIssues = [
      ...new Set([
        ...authoredStylesheetIssues(document),
        ...authoredCssAtRuleIssues(document),
      ]),
    ].sort();
    if (stylesheetIssues.length) {
      return c.json({
        error: "release stylesheet preflight failed",
        errorCodes: stylesheetIssues,
        detail:
          "Connected releases cannot reference stylesheet bytes that are not frozen into the signed artifact.",
      }, 422);
    }
    if (
      activeConnections.some((connection) =>
        connection.profile === "existing-theme"
      )
    ) {
      const cssIssues = existingThemeCssIssues(document);
      if (cssIssues.length) {
        return c.json({
          error: "Existing Theme CSS preflight failed",
          errorCodes: cssIssues,
          detail:
            "Authored global CSS must be isolated before this release can enter an existing WordPress theme.",
        }, 422);
      }
    }
    const assetMetadata = await assetsOf(id);
    const rendered = render(document, assetMetadata);
    if (releaseStylesheetLinks(rendered.files).length) {
      try {
        rendered.files = await freezeGoogleFontStylesheets(
          rendered.files,
          o.fontFetch || fetch,
        );
      } catch (error) {
        return c.json({
          error: "release stylesheet preflight failed",
          errorCodes: ["font-freeze-failed"],
          detail: String((error as Error).message),
        }, 422);
      }
    }
    const linkedStylesheets = releaseStylesheetLinks(rendered.files);
    if (linkedStylesheets.length) {
      return c.json({
        error: "release stylesheet preflight failed",
        errorCodes: ["unfrozen-stylesheet"],
        stylesheets: linkedStylesheets,
        detail: "The renderer left a stylesheet outside the signed artifact.",
      }, 422);
    }
    const errors = rendered.findings.filter((finding) =>
      finding.level === "error"
    );
    const warnings = rendered.findings.filter((finding) =>
      finding.level === "warn"
    );
    const errorCodes = [...new Set(errors.map((finding) => finding.code))]
      .sort();
    const warningCodes = [...new Set(warnings.map((finding) => finding.code))]
      .sort();
    if (errors.length) {
      return c.json({
        error: "release validation failed",
        errorCount: errors.length,
        errorCodes,
        findings: errors.map((finding) => ({
          code: finding.code,
          message: finding.msg,
          where: finding.where,
        })),
      }, 422);
    }
    if (warnings.length && body?.acknowledgeWarnings !== true) {
      return c.json({
        error: "warning acknowledgement required",
        warningCount: warnings.length,
        warningCodes,
        findings: warnings.map((finding) => ({
          code: finding.code,
          message: finding.msg,
          where: finding.where,
        })),
      }, 409);
    }
    const production = activeConnections.find((connection) =>
      connection.environment === "production"
    );
    const staging = activeConnections.find((connection) =>
      connection.environment === "staging"
    );
    if (production && !staging) {
      return c.json({
        error: "a staging connection is required",
        detail:
          "Connected v1 promotes the identical signed release through staging before production.",
      }, 409);
    }
    const assets = await assetBodiesOf(
      id,
      releaseAssetIds(document, rendered.files, assetMetadata),
    );
    const proposedReleaseId = crypto.randomUUID();
    let builtRelease: ReturnType<typeof buildReleaseArtifact>;
    try {
      builtRelease = buildReleaseArtifact({
        releaseId: proposedReleaseId,
        siteId: id,
        sourceVersion,
        document,
        files: rendered.files,
        assets,
      });
    } catch (error) {
      return c.json({
        error: "release compilation failed",
        detail: String((error as Error).message),
      }, 422);
    }
    /* Compile before reserving a sequence so a deterministic validation failure cannot leave
       a permanent hole in the ordered target queue. An idempotent retry may recover an older
       reserved release id; rebuild only in that case because the id is itself signed content. */
    let reservation;
    try {
      reservation = await o.connected!.reserveRelease({
        siteId: id,
        idempotencyKey,
        releaseId: proposedReleaseId,
        createdBy: gate.user.id,
      });
    } catch (error) {
      const detail = String((error as Error).message);
      if (/still being finalized|retry shortly/i.test(detail)) {
        c.header("retry-after", "5");
        return c.json({
          error: "another release is still being finalized",
          retryable: true,
          detail:
            "Retry this same publish after the in-progress release finishes or its lease expires.",
        }, 409);
      }
      return c.json({
        error: "release sequence could not be reserved",
        detail: shownError(error, "Try this publish again in a moment."),
      }, 409);
    }
    const releaseId = reservation.releaseId;
    const createdAt = reservation.createdAt;
    if (releaseId !== proposedReleaseId) {
      builtRelease = buildReleaseArtifact({
        releaseId,
        siteId: id,
        sourceVersion,
        document,
        files: rendered.files,
        assets,
      });
    }
    const audit: ReleaseAudit = {
      acknowledgeWarnings: body?.acknowledgeWarnings === true,
      warningCodes,
      warningCount: warnings.length,
      errorCodes,
      errorCount: errors.length,
    };
    const manifest = manifestForRelease({
      releaseId,
      siteId: id,
      sequence: reservation.sequence,
      sourceVersion,
      schemaVersion: document.schemaVersion,
      parentReleaseId: reservation.parentReleaseId,
      createdAt,
      audit,
      built: builtRelease,
    });
    const signed = signReleaseManifest(manifest, o.releaseSigning!);
    const proposed: SiteRelease = {
      id: releaseId,
      siteId: id,
      sequence: reservation.sequence,
      sourceVersion,
      schemaVersion: document.schemaVersion,
      parentReleaseId: reservation.parentReleaseId,
      artifactHash: builtRelease.artifactHash,
      artifactBytes: builtRelease.artifactBytes.byteLength,
      artifact: builtRelease.artifactBytes,
      hostedFiles: [...rendered.files].sort(([a], [b]) => utf8ByteCompare(a, b))
        .map(([path, content]) => {
          const bytes = new TextEncoder().encode(content);
          return {
            path,
            content,
            bytes: bytes.byteLength,
            hash: sha256(bytes),
          };
        }),
      manifest: signed.manifest,
      manifestHash: sha256(fromBase64url(signed.manifest)),
      signature: signed.signature,
      keyId: signed.keyId,
      files: builtRelease.files,
      pages: builtRelease.pages,
      cms: builtRelease.cms,
      assets: builtRelease.assets,
      scripts: builtRelease.scripts,
      audit,
      idempotencyKey,
      createdBy: gate.user.id,
      createdAt,
    };
    let made: { release: SiteRelease; created: boolean };
    try {
      made = await o.connected!.createRelease(proposed);
    } catch (error) {
      return c.json({
        error: shownError(error, "the release could not be recorded"),
      }, 409);
    }
    if (
      !made.created && (made.release.sourceVersion !== sourceVersion ||
        JSON.stringify(made.release.audit) !== JSON.stringify(audit))
    ) {
      return c.json({
        error: "idempotency key was already used for a different release",
      }, 409);
    }
    /* The hosted pointer is the canonical commit and deliberately precedes both the durable
       publication marker and every target/webhook mutation. Store.publish is a monotonic CAS,
       so a delayed lower sequence is a successful no-op rather than a hosted rollback. */
    let published;
    try {
      published = await o.connected!.commitReleasePublication({
        siteId: id,
        releaseId: made.release.id,
        sourceVersion: made.release.sourceVersion,
        releaseSequence: made.release.sequence,
        publishedAt: new Date().toISOString(),
      }, () =>
        o.store.publish(
          id,
          made.release.sourceVersion,
          made.release.id,
          made.release.sequence,
        ));
    } catch (error) {
      /* The immutable artifact is left unfinalized. Release traversal and target creation
         exclude it, and a later publish gives the stale identity a terminal tombstone. */
      return c.json({
        error: "source revision could not be published",
        retryable: true,
        detail: shownError(
          error,
          "The release was built but not published. Publish again to finish.",
        ),
      }, 503);
    }
    if (!published) {
      return c.json({ error: "source revision could not be published" }, 409);
    }
    built.delete(id);
    let reconciliation: {
      status: "not-required" | "issued" | "pending";
      detail?: string;
    } = {
      status: activeConnections.some((connection) =>
          connection.environment === "staging"
        )
        ? "pending"
        : "not-required",
    };
    try {
      if (published.publishedReleaseId !== made.release.id) {
        reconciliation = {
          status: "not-required",
          detail: "A newer release already owns the public pointer.",
        };
      } else if (await stageReleaseIfIdle(made.release, activeConnections)) {
        reconciliation = { status: "issued" };
      }
    } catch (error) {
      /* The release and public pointer are already durable. Polling and an idempotent Publish
         retry reconcile target creation/queueing without turning a committed publication into
         a reported failure that invites the owner to publish different content. */
      reconciliation = {
        status: "pending",
        detail: shownError(error, "WordPress delivery will be retried."),
      };
      console.error(
        "WordPress release delivery is pending:",
        (error as Error).message,
      );
    }
    return c.json({
      releaseId: made.release.id,
      sequence: made.release.sequence,
      sourceVersion: made.release.sourceVersion,
      schemaVersion: made.release.schemaVersion,
      publishedVersion: published.publishedVersion,
      artifactHash: made.release.artifactHash,
      audit: made.release.audit,
      createdAt: made.release.createdAt,
      reconciliation,
      targets: (await o.connected!.connectionsForSite(id)).map(
        publicConnection,
      ),
    }, made.created ? 201 : 200);
  });

  app.get("/v1/connections/:id/desired-release", async (c) => {
    if (!releaseReady()) return releaseUnavailable(c);
    let connection = await bearerConnection(c);
    if (!connection || connection.id !== c.req.param("id")) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (connection.environment === "production") {
      const staging = (await o.connected!.connectionsForSite(connection.siteId))
        .find((item) =>
          item.environment === "staging" && item.status === "active"
        );
      if (staging && staging.profile !== connection.profile) {
        return c.json({
          error: "incompatible WordPress setup profiles",
          detail:
            "Staging and production must use the same Connected setup profile.",
        }, 409);
      }
    }
    /* `pendingReleaseId` is a durable promotion job. Production polling reconciles a worker
       failure that happened after staging committed live but before its target was issued. */
    if (
      connection.environment === "production" && connection.pendingReleaseId &&
      !connection.desiredReleaseId &&
      connection.activeReleaseId !== connection.pendingReleaseId
    ) {
      const pending = await o.connected!.release(connection.pendingReleaseId);
      if (!pending) {
        return c.json({ error: "pending release no longer exists" }, 409);
      }
      try {
        await issueTarget(pending, connection, true);
      } catch (error) {
        c.header("retry-after", "5");
        return c.json({
          error: "production promotion is pending",
          retryable: true,
          detail: shownError(error, "Promotion is retried on the next poll."),
        }, 503);
      }
      connection = await o.connected!.connection(connection.id) || connection;
    }
    /* A production target can be paired after staging is already live, so there may be no
       pending pointer from the original staging acknowledgement. Polling is the durable
       reconciliation path: derive only from staging's *current* active release, never from a
       historical ACK body, and never move production backward in global release order. */
    if (
      connection.environment === "production" && !connection.desiredReleaseId &&
      !connection.pendingReleaseId
    ) {
      try {
        const promotion = await currentStagingPromotion(connection.siteId);
        if (promotion) {
          if (promotion.staging.profile !== connection.profile) {
            return c.json({
              error: "incompatible WordPress setup profiles",
              detail:
                "Staging and production must use the same Connected setup profile.",
            }, 409);
          }
          const active = connection.activeReleaseId
            ? await o.connected!.release(connection.activeReleaseId)
            : null;
          if (connection.activeReleaseId && !active) {
            throw new Error(
              "the active production release order could not be verified safely",
            );
          }
          if (!active || active.sequence < promotion.release.sequence) {
            await issueTarget(promotion.release, connection, true);
            connection = await o.connected!.connection(connection.id) ||
              connection;
          }
        }
      } catch (error) {
        c.header("retry-after", "5");
        return c.json({
          error: "production promotion is pending",
          retryable: true,
          detail: shownError(error, "Promotion is retried on the next poll."),
        }, 503);
      }
    }
    let desired = await o.connected!.desiredTarget(connection.id);
    if (!desired && connection.environment === "staging") {
      const hosted = await o.store.byId(connection.siteId);
      let canonicalPublished: SiteReleaseSummary | null = null;
      if (hosted?.publishedReleaseId) {
        try {
          if (
            !await o.connected!.markReleasePublished(
              hosted.publishedReleaseId,
              hosted.updatedAt,
            )
          ) {
            throw new Error("hosted release was finalized as abandoned");
          }
          canonicalPublished = await o.connected!.release(
            hosted.publishedReleaseId,
          );
          if (!canonicalPublished) {
            throw new Error(
              "the canonical hosted release could not be loaded safely",
            );
          }
        } catch (error) {
          c.header("retry-after", "5");
          return c.json({
            error: "hosted publication finalization is pending",
            retryable: true,
            detail: shownError(error, "Finalization is retried on the next poll."),
          }, 503);
        }
      }
      const active = connection.activeReleaseId
        ? await o.connected!.release(connection.activeReleaseId)
        : null;
      try {
        if (connection.activeReleaseId && !active) {
          throw new Error(
            "the active staging release order could not be verified safely",
          );
        }
        if (!active && canonicalPublished) {
          /* A newly paired or re-paired target has no per-connection history. Its baseline is
             the canonical release currently published by Pagecraft, not the oldest retained
             release in the site's immutable history. Normal progression remains ordered once
             that baseline is acknowledged. This prevents a fresh WordPress target from
             briefly regressing a mature site through releases 1..N. */
          await issueTarget(canonicalPublished, connection, true);
        } else if (active) {
          await stageNextRelease(connection.siteId, active.sequence);
        }
      } catch (error) {
        c.header("retry-after", "5");
        return c.json({
          error: "staging delivery is pending",
          retryable: true,
          detail: shownError(error, "Delivery is retried on the next poll."),
        }, 503);
      }
      connection = await o.connected!.connection(connection.id) || connection;
      desired = await o.connected!.desiredTarget(connection.id);
    }
    if (!desired) return c.body(null, 204);
    try {
      /* Also repairs the narrow target-created/queued-event-missing failure window. */
      await issueTarget(desired.release, desired.connection, true);
      desired = await o.connected!.desiredTarget(connection.id) || desired;
    } catch (error) {
      c.header("retry-after", "5");
      return c.json({
        error: "release target is not ready",
        retryable: true,
        detail: shownError(error, "Delivery is retried on the next poll."),
      }, 503);
    }
    const etag =
      `"${desired.release.id}:${desired.target.sequence}:${desired.release.manifestHash}"`;
    if (c.req.header("if-none-match") === etag) {
      return c.body(null, 304, { etag });
    }
    const here = o.editorOrigin || new URL(c.req.url).origin;
    c.header("etag", etag);
    return c.json({
      release: {
        manifest: desired.release.manifest,
        signature: desired.release.signature,
        keyId: desired.release.keyId,
        artifact: {
          url: `${here}/v1/releases/${
            encodeURIComponent(desired.release.id)
          }/artifact`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        },
      },
      deployment: {
        envelope: desired.target.envelope,
        signature: desired.target.signature,
        keyId: desired.target.keyId,
      },
      keysetEnvelope: o.keysetEnvelope,
    });
  });

  app.delete("/v1/connections/:id", async (c) => {
    if (!o.connected) {
      return c.json({ error: "connected persistence is unavailable" }, 503);
    }
    const bearer =
      (c.req.header("authorization") || "").match(/^Bearer\s+([^\s]+)$/i)
        ?.[1] || "";
    const refresh = String(c.req.header("x-pagecraft-refresh-token") || "");
    const idempotencyKey = String(c.req.header("idempotency-key") || "");
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
      return c.json(
        { error: "a stable Idempotency-Key header is required" },
        400,
      );
    }
    if (!bearer && !refresh) return c.json({ error: "unauthorized" }, 401);
    const result = await o.connected.revokeConnection({
      id: c.req.param("id"),
      accessTokenDigest: bearer ? hashToken(bearer) : null,
      refreshTokenDigest: refresh ? hashToken(refresh) : null,
      idempotencyKey,
      now: new Date().toISOString(),
    });
    if (!result.ok) {
      return c.json(
        { error: result.error },
        result.error === "unauthorized" ? 401 : 409,
      );
    }
    return c.json({
      connectionId: result.connection.id,
      status: "revoked",
      revokedAt: result.connection.revokedAt,
      alreadyRevoked: result.alreadyRevoked,
    });
  });

  app.get("/v1/releases/:id/artifact", async (c) => {
    const connection = await bearerConnection(c);
    if (!connection || !o.connected) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const release = await o.connected.release(c.req.param("id"));
    const target = release
      ? await o.connected.target(connection.id, release.id)
      : null;
    if (!release || !target || release.siteId !== connection.siteId) {
      return c.notFound();
    }
    if (c.req.header("if-none-match") === `"${release.artifactHash}"`) {
      return c.body(null, 304, { etag: `"${release.artifactHash}"` });
    }
    return c.body(release.artifact as unknown as ArrayBuffer, 200, {
      "content-type": "application/vnd.pagecraft.wordpress-artifact+json",
      "content-length": String(release.artifactBytes),
      etag: `"${release.artifactHash}"`,
      "cache-control": "private, no-store",
    });
  });

  app.get("/v1/wordpress-distribution/stable", async (c) => {
    const origin = o.editorOrigin || new URL(c.req.url).origin;
    const distribution = o.packages?.stable(origin);
    if (!distribution) {
      return c.json(
        { error: "signed WordPress distribution is unavailable" },
        503,
      );
    }
    return c.json(distribution, 200, {
      "cache-control": "public, max-age=300, must-revalidate",
    });
  });

  app.get("/v1/wordpress-distribution/packages/:slug/:archive", async (c) => {
    const pkg = o.packages?.get(c.req.param("slug"));
    const match = c.req.param("archive").match(/^([a-f0-9]{64})\.zip$/);
    if (
      !pkg || !match || pkg.hash !== match[1] ||
      !["pagecraft-importer", "pagecraft-builder", "pagecraft-theme"].includes(
        pkg.slug,
      )
    ) {
      return c.notFound();
    }
    const etag = `"${pkg.hash}"`;
    const headers = {
      "content-type": "application/zip",
      "content-length": String(pkg.bytes.byteLength),
      "content-disposition":
        `attachment; filename="${pkg.slug}-${pkg.version}.zip"`,
      "x-pagecraft-content-sha256": pkg.hash,
      etag,
      "cache-control": "public, max-age=31536000, immutable",
    };
    if (c.req.header("if-none-match") === etag) {
      return c.body(null, 304, headers);
    }
    return c.body(pkg.bytes as unknown as ArrayBuffer, 200, headers);
  });

  app.get("/v1/packages/:slug", async (c) => {
    const connection = await bearerConnection(c);
    if (!connection || !connection.scopes.includes("release:read")) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const pkg = o.packages?.get(c.req.param("slug"));
    if (!pkg) return c.notFound();
    const token = newToken(),
      expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await o.connected!.putGrant({
      digest: hashToken(token),
      kind: "package-download",
      siteId: connection.siteId,
      connectionId: connection.id,
      payload: { slug: pkg.slug, hash: pkg.hash },
      expiresAt,
    });
    const metadata = JSON.parse(
      new TextDecoder().decode(fromBase64url(pkg.manifest)),
    ) as Record<string, unknown>;
    const here = o.editorOrigin || new URL(c.req.url).origin;
    return c.json({
      package: metadata,
      signed: {
        manifest: pkg.manifest,
        signature: pkg.signature,
        keyId: pkg.keyId,
      },
      keysetEnvelope: pkg.keysetEnvelope,
      download: {
        url: `${here}/v1/packages/${
          encodeURIComponent(pkg.slug)
        }/download?token=${encodeURIComponent(token)}`,
        expiresAt,
      },
    });
  });

  app.get("/v1/packages/:slug/download", async (c) => {
    const token = c.req.query("token") || "";
    const grant = token && o.connected
      ? await o.connected.consumeGrant(
        hashToken(token),
        "package-download",
        new Date().toISOString(),
      )
      : null;
    const pkg = o.packages?.get(c.req.param("slug"));
    if (
      !grant || !pkg || grant.payload.slug !== pkg.slug ||
      grant.payload.hash !== pkg.hash
    ) {
      return c.json(
        { error: "download authorization expired or invalid" },
        401,
      );
    }
    const connection = grant.connectionId
      ? await o.connected?.connection(grant.connectionId)
      : null;
    if (!connection || connection.status !== "active") {
      return c.json({ error: "connection is no longer active" }, 401);
    }
    return c.body(pkg.bytes as unknown as ArrayBuffer, 200, {
      "content-type": "application/zip",
      "content-length": String(pkg.bytes.byteLength),
      "content-disposition":
        `attachment; filename="${pkg.slug}-${pkg.version}.zip"`,
      "x-pagecraft-content-sha256": pkg.hash,
      "cache-control": "private, no-store",
    });
  });

  app.post("/v1/connections/:id/deployments", async (c) => {
    const connection = await bearerConnection(c);
    if (!connection || connection.id !== c.req.param("id") || !o.connected) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json().catch(() => null) as {
      releaseId?: string;
      targetSequence?: number;
      sequence?: number;
      status?: DeploymentStatus;
      activeHash?: string | null;
      error?: string;
      idempotencyKey?: string;
      detail?: {
        code?: string;
        message?: string;
        action?: string;
        stage?: string;
      };
    } | null;
    const statuses = new Set<DeploymentStatus>([
      "queued",
      "downloading",
      "staged",
      "needs_approval",
      "activating",
      "verifying",
      "live",
      "failed",
      "rolled_back",
    ]);
    const sequence = body?.targetSequence ?? body?.sequence;
    const idempotencyKey = String(
      body?.idempotencyKey || c.req.header("idempotency-key") || "",
    );
    if (
      !body?.releaseId || !Number.isInteger(sequence) || !body.status ||
      !statuses.has(body.status) ||
      !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)
    ) {
      return c.json({
        error:
          "releaseId, targetSequence, status, and idempotencyKey are required",
      }, 400);
    }
    const acknowledgement = {
      connectionId: connection.id,
      releaseId: body.releaseId,
      sequence: sequence as number,
      status: body.status,
      activeHash: body.activeHash || null,
      error: body.error ? String(body.error).slice(0, 2000) : null,
      detail: body.detail || null,
      idempotencyKey,
    };
    const result = await o.connected.recordDeployment({
      ...acknowledgement,
      bodyHash: sha256(
        new TextEncoder().encode(canonicalJson(acknowledgement)),
      ),
    });
    if (!result.ok) {
      return c.json(
        { error: result.error },
        result.error === "unknown-target" ? 404 : 409,
      );
    }
    const acknowledgedConnection = result.connection;
    if (!acknowledgedConnection || acknowledgedConnection.status !== "active") {
      return c.json({ error: "connection-inactive" }, 409);
    }
    let reconciliation: {
      status: "not-required" | "issued" | "pending";
      detail?: string;
    } = {
      status: "not-required",
    };
    try {
      if (
        acknowledgedConnection.environment === "staging" &&
        body.status === "live"
      ) {
        /* Exact ACK replay is read-only in the store, but follow-up may run again after staging
           has advanced. Promote the current active staging release, not the historical body,
           so a delayed duplicate can neither roll production back nor strand a late-paired
           production target on an older release. */
        const promotion = await currentStagingPromotion(
          acknowledgedConnection.siteId,
        );
        if (promotion) {
          const release = promotion.release;
          const production = promotion.connections.find((item) =>
            item.environment === "production" && item.status === "active"
          );
          if (production && production.profile !== promotion.staging.profile) {
            throw new Error(
              "staging and production setup profiles are incompatible",
            );
          }
          const activeProductionRelease = production?.activeReleaseId
            ? await o.connected.release(production.activeReleaseId)
            : null;
          const productionOrderUnknown = !!production?.activeReleaseId &&
            !activeProductionRelease;
          const productionIsNewer = !!activeProductionRelease &&
            activeProductionRelease.sequence >= release.sequence;
          if (
            production && !productionOrderUnknown && !productionIsNewer &&
            production.activeReleaseId !== release.id
          ) {
            if (
              !production.desiredReleaseId ||
              production.desiredReleaseId === release.id
            ) {
              await issueTarget(release, production, true);
              reconciliation = { status: "issued" };
            } else {
              reconciliation = {
                status: "pending",
                detail:
                  "Production is still completing the prior ordered release.",
              };
            }
          } else if (productionOrderUnknown) {
            reconciliation = {
              status: "pending",
              detail: "Production release order could not be verified safely.",
            };
          } else if (!production) {
            await stageNextRelease(
              acknowledgedConnection.siteId,
              release.sequence,
            );
          }
        }
      } else if (
        acknowledgedConnection.environment === "production" &&
        body.status === "live"
      ) {
        const release = await o.connected.release(body.releaseId);
        if (release) {
          await stageNextRelease(
            acknowledgedConnection.siteId,
            release.sequence,
          );
        }
      } else if ((body.status === "failed" || body.status === "rolled_back")) {
        const release = await o.connected.release(body.releaseId);
        if (release) {
          await stageNextRelease(
            acknowledgedConnection.siteId,
            release.sequence,
          );
        }
      }
    } catch (error) {
      /* The acknowledgement is already durable. Never turn a committed `live` into an
         ambiguous failure that prompts WordPress to roll back its verified local release.
         The production pending pointer / desired target is a durable reconciliation job. */
      reconciliation = {
        status: "pending",
        detail: shownError(error, "The follow-up will be retried."),
      };
      console.error(
        "WordPress deployment follow-up is pending:",
        (error as Error).message,
      );
    }
    return c.json({
      deployment: result.deployment,
      duplicate: !!result.duplicate,
      activeReleaseId: result.connection?.activeReleaseId || null,
      activeHash: result.connection?.activeHash || null,
      reconciliation,
    }, result.duplicate ? 200 : 201);
  });

  /* A production CMS image field may originate in the WordPress Media Library. The scoped
     connector uploads its exact bytes first, then writes the returned `asset:<id>` into the
     ordinary Pagecraft draft. The id is derived from the connection + idempotency key so a
     timed-out WordPress worker can retry without creating a second remote asset. */
  app.post("/v1/sites/:id/cms-assets", async (c) => {
    const connection = await bearerConnection(c);
    const id = c.req.param("id");
    if (
      !connection || connection.siteId !== id ||
      !connection.scopes.includes("cms:write")
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (connection.environment !== "production") {
      return c.json({ error: "CMS media write-back is production-only" }, 403);
    }
    if (!o.assets) {
      return c.json({ error: "this server stores no assets" }, 501);
    }
    const idempotencyKey = String(c.req.header("idempotency-key") || "");
    const filename = String(c.req.header("x-pagecraft-filename") || "");
    const claimedHash = String(c.req.header("x-pagecraft-content-sha256") || "")
      .toLowerCase();
    if (
      !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(filename) ||
      filename === "." || filename === ".." ||
      !/^[a-f0-9]{64}$/.test(claimedHash)
    ) {
      return c.json({
        error:
          "valid Idempotency-Key, X-Pagecraft-Filename, and X-Pagecraft-Content-SHA256 headers are required",
      }, 400);
    }
    const lengthHeader = String(c.req.header("content-length") || "");
    if (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) < 1) {
      return c.json(
        { error: "an exact positive Content-Length is required" },
        411,
      );
    }
    const declaredLength = Number(lengthHeader);
    if (declaredLength > MAX_BYTES) {
      return c.json(
        { error: `too large — the limit is ${MAX_BYTES} bytes` },
        413,
      );
    }
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.byteLength !== declaredLength) {
      return c.json({
        error: "Content-Length does not match the received image bytes",
      }, 400);
    }
    if (bytes.byteLength > MAX_BYTES) {
      return c.json(
        { error: `too large — the limit is ${MAX_BYTES} bytes` },
        413,
      );
    }
    const bodyHash = sha256(bytes);
    if (bodyHash !== claimedHash) {
      return c.json({ error: "image content hash does not match" }, 422);
    }
    const type = sniff(bytes);
    if (!type || !ALLOWED.has(type)) {
      return c.json({ error: "that is not an image this server serves" }, 415);
    }
    const declaredType = String(c.req.header("content-type") || "").split(
      ";",
      1,
    )[0].trim().toLowerCase();
    if (!declaredType || declaredType !== type) {
      return c.json({
        error: "the declared content type does not match the image bytes",
      }, 415);
    }
    const assetId = "wp" +
      sha256(new TextEncoder().encode(`${connection.id}\0${idempotencyKey}`))
        .slice(0, 48);
    const existing = await o.assets.get(id, assetId);
    if (existing) {
      if (existing.contentHash !== bodyHash) {
        return c.json({
          error: "the idempotency key was already used for different media",
        }, 409);
      }
      return c.json({
        ...metaOf(existing),
        assetId,
        reference: `asset:${assetId}`,
        hash: bodyHash,
        bytes: existing.bytes.byteLength,
        mime: existing.type,
        duplicate: true,
      });
    }
    let output: OptimizedImage;
    try {
      output = await optimizeAsset(bytes, type);
    } catch {
      return c.json({ error: "image optimization failed" }, 422);
    }
    let saved: AssetRecord | null;
    try {
      saved = await o.assets.putConnected(
        {
          id: assetId,
          siteId: id,
          name: optimizedName(filename, output.extension),
          type: output.type,
          bytes: output.bytes,
          w: output.w,
          h: output.h,
          contentHash: bodyHash,
        },
        connection.id,
        async () => {
          const current = await o.connected!.connection(connection.id);
          return current?.status === "active" &&
            !!current.accessTokenExpiresAt &&
            new Date(current.accessTokenExpiresAt).getTime() > Date.now();
        },
        {
          ownerId: connection.createdBy,
          limitBytes: await storageLimitForOwner(connection.createdBy),
          originalBytes: bytes.byteLength,
          optimized: true,
        },
      );
    } catch (error) {
      if (error instanceof AssetQuotaError) {
        return c.json({ error: "storage_limit_reached", ...error.usage }, 409);
      }
      throw error;
    }
    if (!saved) {
      /* A null result can be a disconnect racing this request or an exact-id binding failure.
         Re-read once so a timed-out exact retry stays successful without allowing the same
         idempotency key to overwrite different bytes. */
      const current = await o.assets.get(id, assetId);
      if (current) {
        if (current.contentHash !== bodyHash) {
          return c.json({
            error: "the idempotency key was already used for different media",
          }, 409);
        }
        return c.json({
          ...metaOf(current),
          assetId,
          reference: `asset:${assetId}`,
          hash: bodyHash,
          bytes: current.bytes.byteLength,
          mime: current.type,
          duplicate: true,
        });
      }
      const stillActive = await o.connected!.connection(connection.id);
      if (
        stillActive?.status === "active" && stillActive.accessTokenExpiresAt &&
        new Date(stillActive.accessTokenExpiresAt).getTime() > Date.now()
      ) {
        return c.json({
          error:
            "the idempotency key was already used for different media or site",
        }, 409);
      }
      return c.json({ error: "connection-inactive" }, 401);
    }
    built.delete(id);
    return c.json({
      ...metaOf(saved),
      assetId,
      reference: `asset:${assetId}`,
      hash: bodyHash,
      bytes: saved.storedBytes ?? output.bytes.byteLength,
      mime: saved.type,
      duplicate: false,
    }, 201);
  });

  app.patch("/v1/sites/:id/cms", async (c) => {
    const connection = await bearerConnection(c);
    const id = c.req.param("id");
    if (
      !connection || connection.siteId !== id ||
      !connection.scopes.includes("cms:write")
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (connection.environment !== "production") {
      return c.json({ error: "CMS write-back is production-only" }, 403);
    }
    const body = await c.req.json().catch(() => null) as {
      baseVersion?: number;
      writes?: Array<{
        collectionId?: string;
        itemId?: string;
        writeSequence?: number;
        values?: Record<string, unknown>;
        draft?: boolean;
      }>;
    } | null;
    const idempotencyKey = String(c.req.header("idempotency-key") || "");
    if (
      !body ||
      (body.baseVersion !== undefined && !Number.isInteger(body.baseVersion)) ||
      !Array.isArray(body.writes) || !body.writes.length ||
      body.writes.length > 100 ||
      !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)
    ) {
      return c.json({
        error:
          "Idempotency-Key and between 1 and 100 sequenced writes are required",
      }, 400);
    }
    const normalized: Array<{
      collectionId: string;
      itemId: string;
      writeSequence: number;
      values: Record<string, string>;
      draft?: boolean;
      bodyHash: string;
      itemKey: string;
    }> = [];
    const itemKeys = new Set<string>();
    for (const write of body.writes) {
      const collectionId = typeof write.collectionId === "string"
        ? write.collectionId
        : "";
      const itemId = typeof write.itemId === "string" ? write.itemId : "";
      const values = write.values || {};
      const itemKey = cmsItemKey(collectionId, itemId);
      if (
        !collectionId || !itemId ||
        !Number.isSafeInteger(write.writeSequence) ||
        Number(write.writeSequence) < 1 || !values ||
        typeof values !== "object" || Array.isArray(values) ||
        Object.values(values).some((value) => typeof value !== "string") ||
        (write.draft !== undefined && typeof write.draft !== "boolean") ||
        (!Object.keys(values).length && write.draft === undefined) ||
        itemKeys.has(itemKey)
      ) {
        return c.json({
          error:
            "each item needs one unique positive writeSequence and typed values or draft state",
        }, 400);
      }
      itemKeys.add(itemKey);
      const stable = {
        collectionId,
        itemId,
        writeSequence: Number(write.writeSequence),
        values: values as Record<string, string>,
        draft: write.draft ?? null,
      };
      normalized.push({
        ...stable,
        draft: write.draft,
        itemKey,
        bodyHash: sha256(new TextEncoder().encode(canonicalJson(stable))),
      });
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const site = await o.store.byId(id);
      if (!site) return c.notFound();
      const currentAssetIds = new Set(
        (await assetsOf(id)).map((asset) => asset.id),
      );
      try {
        /* Validate even an apparent replay against the current canonical schema. A connection
           must not retain authority to write a removed field merely because it has an older
           sequence receipt. The retry loop repeats this check after every save conflict. */
        for (const write of normalized) {
          assertTypedCmsWrite(
            site.doc,
            write.collectionId,
            write.itemId,
            write.values,
            currentAssetIds,
          );
        }
      } catch (error) {
        return c.json({ error: String((error as Error).message) }, 422);
      }
      const heads = await o.store.cmsWriteHeads(id, connection.id, [
        ...itemKeys,
      ]);
      const headByItem = new Map(
        heads.map((head) => [cmsItemKey(head.collectionId, head.itemId), head]),
      );
      const stale: Array<{
        collectionId: string;
        itemId: string;
        writeSequence: number;
        currentSequence: number;
      }> = [];
      const conflicts: typeof stale = [];
      const duplicates = new Set<string>();
      for (const write of normalized) {
        const head = headByItem.get(write.itemKey);
        if (!head) continue;
        if (write.writeSequence < head.writeSequence) {
          stale.push({
            collectionId: write.collectionId,
            itemId: write.itemId,
            writeSequence: write.writeSequence,
            currentSequence: head.writeSequence,
          });
        } else if (write.writeSequence === head.writeSequence) {
          if (
            write.bodyHash === head.bodyHash &&
            idempotencyKey === head.idempotencyKey
          ) {
            duplicates.add(write.itemKey);
          } else {
            conflicts.push({
              collectionId: write.collectionId,
              itemId: write.itemId,
              writeSequence: write.writeSequence,
              currentSequence: head.writeSequence,
            });
          }
        }
      }
      if (stale.length) {
        return c.json({ error: "stale-write", retryable: false, stale }, 409);
      }
      if (conflicts.length) {
        return c.json({
          error: "write-sequence-conflict",
          retryable: false,
          conflicts,
        }, 409);
      }
      const pending = normalized.filter((write) =>
        !duplicates.has(write.itemKey)
      );
      if (!pending.length) {
        return c.json({
          status: "duplicate",
          baseVersion: body.baseVersion ?? null,
          version: site.version,
          publishedVersion: site.publishedVersion,
          writes: normalized.map((write) => ({
            collectionId: write.collectionId,
            itemId: write.itemId,
            writeSequence: write.writeSequence,
          })),
        });
      }
      const document = structuredClone(site.doc);
      const overwritten: Array<{
        collectionId: string;
        itemId: string;
        writeSequence: number;
        fieldId: string;
        previous: string | boolean | null;
        next: string | boolean;
      }> = [];
      try {
        for (const write of pending) {
          const { collection, item } = assertTypedCmsWrite(
            document,
            write.collectionId,
            write.itemId,
            write.values,
            currentAssetIds,
          );
          for (const [fieldId, value] of Object.entries(write.values || {})) {
            overwritten.push({
              collectionId: collection.id,
              itemId: item.id,
              writeSequence: write.writeSequence,
              fieldId,
              previous:
                Object.prototype.hasOwnProperty.call(item.values, fieldId)
                  ? item.values[fieldId]
                  : null,
              next: value,
            });
            item.values[fieldId] = value;
          }
          if (write.draft === true || write.draft === false) {
            overwritten.push({
              collectionId: collection.id,
              itemId: item.id,
              writeSequence: write.writeSequence,
              fieldId: "$draft",
              previous: !!item.draft,
              next: write.draft,
            });
            if (write.draft) item.draft = 1;
            else delete item.draft;
          }
        }
      } catch (error) {
        return c.json({ error: String((error as Error).message) }, 422);
      }
      const saved = await o.store.saveConnectedCms(
        id,
        document,
        site.version,
        connection.createdBy,
        connection.id,
        {
          source: "wordpress-cms-write",
          connectionId: connection.id,
          installationId: connection.installationId,
          baseVersion: body.baseVersion ?? null,
          appliedToVersion: site.version,
          overwritten,
          cmsWrites: pending.map((write) => ({
            connectionId: connection.id,
            collectionId: write.collectionId,
            itemId: write.itemId,
            writeSequence: write.writeSequence,
            idempotencyKey,
            bodyHash: write.bodyHash,
            overwritten: overwritten.filter((entry) =>
              entry.collectionId === write.collectionId &&
              entry.itemId === write.itemId &&
              entry.writeSequence === write.writeSequence
            ),
          })),
        },
        async () => {
          const current = await o.connected!.connection(connection.id);
          return current?.status === "active" &&
            !!current.accessTokenExpiresAt &&
            new Date(current.accessTokenExpiresAt).getTime() > Date.now();
        },
      );
      if (saved.ok) {
        return c.json({
          status: "applied",
          baseVersion: body.baseVersion ?? null,
          version: saved.site!.version,
          publishedVersion: saved.site!.publishedVersion,
          overwrittenCount: overwritten.length,
          writes: normalized.map((write) => ({
            collectionId: write.collectionId,
            itemId: write.itemId,
            writeSequence: write.writeSequence,
          })),
        });
      }
      if (saved.guarded) return c.json({ error: "connection-inactive" }, 401);
      if (!saved.conflict) return c.notFound();
    }
    return c.json({
      error: "CMS write could not settle after concurrent saves; retry safely",
    }, 409);
  });

  /* ------------------------------------------------------------------ the sites */

  /* Everything the editor did not claim. Two ways a request can name a site, tried in the order
     that keeps each one unambiguous.

     On the editor's own host the first path segment is a slug: `/acme/about` is the About page
     of the site at `acme`. Nothing else can be, because `validSlug` refuses every prefix this
     app registers — and `app.test.ts` checks that against Hono's own route table rather than
     against a list somebody remembered to update.

     On any other host it is a custom domain, matched the way it always was. A site can have
     both; the slug is the one it gets for free. */
  app.get("*", async (c) => {
    const url = new URL(c.req.url);
    if (isEditorHost(c.req.header("host"), o)) {
      const [, first, ...rest] = url.pathname.split("/");
      const slug = first ? validSlug(first) : null;
      if (o.publications) {
        const publication = slug
          ? await o.publications.currentBySlug(slug)
          : null;
        /* A renamed site keeps its old links: the slug it left points on to where it is now,
           until another site takes that slug. */
        const moved = !publication && slug ? await o.publications.movedSlug(slug) : null;
        if (moved) {
          return c.redirect(`/${moved}/${rest.join("/")}${url.search}`, 301);
        }
        if (!publication) {
          return c.text(
            first
              ? `No published site at /${first}`
              : "No site here. Sign in to the editor to make one.",
            404,
          );
        }
        if (!rest.length && !url.pathname.endsWith("/")) {
          return c.redirect(`/${publication.slug}/${url.search}`, 308);
        }
        return serveHostedPublication(
          c,
          o.publications,
          publication,
          "/" + rest.join("/"),
          true,
          await countingFor(c, publication, true),
        );
      }
      const site = slug ? await o.store.bySlug(slug) : null;
      if (!site) {
        return c.text(
          first
            ? `No site at /${first}`
            : "No site here. Sign in to the editor to make one.",
          404,
        );
      }
      /* A site root is directory-shaped. Keep one canonical URL so analytics, caches and search
         engines do not split `/acme` and `/acme/`; retain the query exactly. */
      if (!rest.length && !url.pathname.endsWith("/")) {
        return c.redirect(`/${site.slug}/${url.search}`, 308);
      }
      /* The path within the site. A bare `/acme` is that site's index, which is why the empty
         remainder becomes `/` rather than falling through to a 404. */
      return serveSite(c, o, built, render, "/" + rest.join("/"), site);
    }
    const host = (c.req.header("host") || "").split(":")[0];
    if (o.publications) {
      const publication = await o.publications.currentByHost(host);
      return publication
        ? serveHostedPublication(
          c,
          o.publications,
          publication,
          url.pathname,
          false,
          await countingFor(c, publication, false),
        )
        : c.text(`No published site for host ${host}`, 404);
    }
    const site = await o.store.byHost(host);
    if (!site) return c.text(`No site for host ${host}`, 404);
    return serveSite(c, o, built, render, url.pathname, site);
  });

  return app;
}

/* `<` is escaped for the reason convention 9 exists: a document containing the characters
   `</script>` — in a code block, say, which this builder now has a widget for — would
   otherwise close the tag it is inside and the rest of the page would be script. */
function inject(html: string, config: unknown) {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  const tag = `<script>window.PC_SERVER=${json};<\/script>\n`;
  const at = html.indexOf("<script");
  return at < 0 ? tag + html : html.slice(0, at) + tag + html.slice(at);
}

const shell = (title: string, body: string) =>
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script>${UI_MOTION_BOOT_SCRIPT}${ACTION_FEEDBACK_BOOT_SCRIPT}<\/script>
<style>
  ${UI_FONTS_CSS}
  ${UI_TOKENS_CSS}
  ${UI_MOTION_CSS}
  :root{color-scheme:light}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--pc-canvas-surround);color:#111311;
       font:15px/1.5 "Manrope",system-ui,-apple-system,sans-serif}
  .card{background:#fff;border:1px solid var(--pc-border);border-radius:16px;padding:28px;width:min(92vw,380px);
        box-shadow:0 10px 30px -12px #1113111f}
  .card--consent{width:min(calc(100vw - 32px),620px);padding:0;overflow:hidden}
  h1{margin:0 0 4px;font-size:19px;letter-spacing:-.01em}
  p{margin:0 0 18px;color:#5f6660;font-size:var(--pc-text-body)}
  label{display:block;font-size:12px;color:#5f6660;margin-bottom:6px}
  input{width:100%;box-sizing:border-box;padding:var(--pc-control-padding);border:1px solid var(--pc-border-strong);border-radius:var(--pc-control-radius);min-height:var(--pc-control-height);
        font:inherit;font-size:var(--pc-control-font);margin-bottom:12px}
  button{width:100%;min-height:var(--pc-control-height);padding:var(--pc-control-padding);border:0;border-radius:var(--pc-control-radius);background:#b7f34a;color:#111311;
         font:inherit;font-size:var(--pc-control-font);font-weight:600;cursor:pointer}
  a{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;margin-bottom:6px;
    border:1px solid var(--pc-border);border-radius:8px;color:inherit;text-decoration:none}
  a:hover{background:var(--pc-hover-bg);border-color:#5f6660}
  small{color:#5f6660;font-size:12px}
  .ok{padding:11px 12px;border-radius:8px;background:var(--pc-surface-subtle);font-size:var(--pc-text-body)}
  .consent__header{padding:32px 36px 28px;background:var(--pc-surface-subtle);border-bottom:1px solid var(--pc-border)}
  .consent__brand{display:flex;align-items:center;gap:10px;margin-bottom:28px;font-weight:700;font-size:16px}
  .consent__brand img{width:28px;height:28px;border-radius:6px}
  .consent h1{max-width:24ch;margin-bottom:10px;font-size:28px;line-height:1.18;letter-spacing:-.025em}
  .consent__header p{max-width:58ch;margin:0;font-size:14px}
  .consent__body{padding:28px 36px 36px}
  .consent__destination{padding-bottom:20px;border-bottom:1px solid var(--pc-border)}
  .consent__destination span{display:block;color:#5f6660;font-size:12px;font-weight:600}
  .consent__destination strong{display:block;margin-top:5px;font-size:14px;line-height:1.4;overflow-wrap:anywhere}
  .consent__note{max-width:58ch;margin:18px 0 24px;font-size:13px;line-height:1.55}
  .consent__actions{margin:0}
  .consent__actions .pc-btn{height:44px;padding:var(--pc-control-padding);border:1px solid #b7f34a;border-radius:7px;
                           background:#b7f34a;color:#111311;display:inline-flex;align-items:center;justify-content:center;
                           font-size:.82rem;font-weight:600}
  .consent__actions .pc-btn:hover{background:#c5fa63;border-color:#c5fa63}

  ${"@"}media(max-width:560px){
    .card--consent{width:min(calc(100vw - 24px),620px)}
    .consent__header{padding:26px 24px 24px}
    .consent__brand{margin-bottom:22px}
    .consent h1{font-size:24px}
    .consent__body{padding:24px}
  }
  ${body.includes("<select") ? CUSTOM_SELECT_CSS : ""}
  ${UI_FOCUS_CSS}
</style></head><body><div class="card${
    body.includes('class="consent"') ? " card--consent" : ""
  }">${body}</div>${
    body.includes("<select")
      ? `<script>${CUSTOM_SELECT_BOOT_SCRIPT}<\/script>`
      : ""
  }<script>${ACCOUNT_ACTIONS_BOOT_SCRIPT}<\/script></body></html>`;

/* No framework for four screens' worth of markup. If this grows past a form and a list it
   should become part of the editor bundle rather than more strings in here. */
const signInPage = () =>
  shell(
    "Sign in — Pagecraft",
    `
  <h1>Pagecraft</h1>
  <p>Enter your email and we will send a link that signs you in.</p>
  <form id="f"><label for="e">Email</label>
    <input id="e" name="email" type="email" autocomplete="email" required>
    <button type="submit">Send me a link</button></form>
  <div id="done" class="ok" hidden>Check your email for the link.</div>
  <div id="err" class="ok" role="alert" hidden></div>
  <script>
    document.getElementById('f').addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.currentTarget;
      const button = form.querySelector('button');
      const error = document.getElementById('err');
      const email = document.getElementById('e').value;
      error.hidden = true;
      const result = await window.__pcFeedback.run({key:'sign-in',button,pending:'Sending sign-in link…',success:'Sign-in link sent. Check your email.',error:caught=>caught.message||'The link could not be sent. Try again shortly.'}, async () => {
        const response = await fetch('/auth/login', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || ('Sign-in failed (' + response.status + ')'));
        form.hidden = true;
        document.getElementById('done').hidden = false;
      });
      if (result.status === 'error') {
        error.textContent = result.message;
        error.hidden = false;
      }
    });
  <\/script>`,
  );

/* The first screen of a new deployment, and it used to be a dead end: "ask whoever set it up to
   grant you one", shown to the person who had just set it up. There was no way to make a site
   from a browser at all — `POST /api/sites` existed and nothing called it.

   So this makes one. A name is the only question, because everything else about a site is a
   decision better made once you can see it: the slug comes from the name, the design tokens come
   with the blank project, and a domain is a thing you add later if the site earns one. */
const newSiteForm = (label: string) => `
  <form id="new"><label for="n">${label}</label>
    <input id="n" name="name" type="text" placeholder="Acme Rebrand" required autocomplete="off">
    <button type="submit">Create it</button></form>
  <div id="err" class="ok" role="alert" hidden></div>
  <script>
    document.getElementById('new').addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button'), name = document.getElementById('n').value;
      const err = document.getElementById('err'); err.hidden = true;
      const result = await window.__pcFeedback.run({key:'site-create',button:btn,pending:'Creating site…',success:'Site created. Opening the builder…',error:caught=>caught.name==='TypeError'?'Connection lost. Check Sites before trying again; creation may still finish.':caught.message||'Could not create this site. Try again.'}, async () => {
        const res = await fetch('/api/sites', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.id) throw new Error(data.detail || data.error || ('Could not create this site (' + res.status + '). Try again.'));
        return data.id;
      });
      if (result.status === 'success') {
        const path = '/edit/' + encodeURIComponent(result.value);
        window.__pcFeedback.flash('Site created. Start building your draft.', path);
        location.href = path;
      } else if (result.status === 'error') {
        err.textContent = result.message; err.hidden = false;
      }
    });
  <\/script>`;

const emptyPage = (email: string) =>
  shell(
    "No sites — Pagecraft",
    `
  <h1>Make your first site</h1>
  <p>Signed in as ${
      escapeHtml(email)
    }. Nothing here yet — name something and start.</p>
  ${newSiteForm("Site name")}`,
  );

const pickerPage = (
  email: string,
  sites: { id: string; name: string; where: string; role: string }[],
) =>
  shell(
    "Your sites — Pagecraft",
    `
  <h1>Your sites</h1>
  <p>Signed in as ${escapeHtml(email)}</p>
  ${
      sites.map((s) =>
        `<a href="/edit/${encodeURIComponent(s.id)}">
    <span>${escapeHtml(s.name)}<br><small>${escapeHtml(s.where)}</small></span>
    <small>${escapeHtml(s.role)}</small></a>`
      ).join("")
    }
  ${newSiteForm("Another site")}`,
  );

const escapeHtml = (v: string) =>
  String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function isEditorHost(host: string | undefined, o: Options) {
  if (!o.editorHost) return true; // no split configured: everything is the editor
  return (host || "").split(":")[0] === o.editorHost;
}

/**
 * Serve one file of one site.
 *
 * The site is passed in rather than looked up here, because there are two ways to arrive at it
 * and only the caller knows which happened: a request to a custom domain, matched on the Host
 * header, or a request to `/<slug>/…` on the editor's own host. The second is what makes a site
 * shareable the moment it is saved — no DNS, no certificate, no waiting for a client to change
 * a record.
 *
 * `urlPath` is the path *within* the site, so the slug is already stripped when there was one.
 * That is what lets the same rendered files serve from either, and it works because the export
 * is internally relative: a page one directory down asks for `../assets/logo.png`, which
 * resolves the same whether the site sits at a domain root or under a path.
 */
/** Where a site can be linked. Its own domain once it has one, the shared host and its path
    until then — and the scheme comes from the request, so a local run says `http`. */
function shareUrl(
  c: Context,
  o: Options,
  site: Pick<Site, "host" | "slug">,
): string {
  const proto = c.req.header("x-forwarded-proto") ||
    new URL(c.req.url).protocol.replace(":", "");
  const real = !/\.invalid$/.test(site.host);
  if (real) return `${proto}://${site.host}/`;
  const here = c.req.header("host") || o.editorHost || "localhost";
  return `${proto}://${here}/${site.slug}/`;
}

/** Serve only immutable materialized bytes. This path deliberately receives neither the
 * application Store nor the asset database, so a public request cannot accidentally grow a
 * Supabase dependency later. */
async function serveHostedPublication(
  c: Context,
  publications: HostedPublicationStore,
  publication: PublicationSummary,
  urlPath: string,
  sharedHost: boolean,
  /** Present only while the site's analytics is on (Phase 6). */
  counting: Counting | null = null,
) {
  const path = resolvePath(urlPath);
  const prefix = sharedHost ? publication.slug : "";
  const records = new Map(publication.files.map((file) => [file.path, file]));
  const renderedPaths = new Map(
    publication.files.map((file) => [file.path, ""]),
  );

  if (
    /(^|\/)index(?:\.html)?$/i.test(urlPath.replace(/\/+$/, "")) &&
    records.has(path)
  ) {
    return c.redirect(
      publicPath(path, prefix) + new URL(c.req.url).search,
      308,
    );
  }
  if (/\.html$/i.test(urlPath) && records.has(path)) {
    return c.redirect(
      publicPath(path, prefix) + new URL(c.req.url).search,
      308,
    );
  }

  let status: 200 | 404 = 200;
  let record = records.get(path);
  if (!record) {
    /* The site's own 404 page is the page whose slug is `404`, exported as `404.html`. */
    record = records.get("404.html");
    if (!record) {
      return c.html(missingPage(publicPath("index.html", prefix)), 404, publishedHeaders(TYPES.html));
    }
    status = 404;
  }
  const bytes = await publications.file(publication, record.path);
  if (!bytes) return c.text("Published file unavailable", 503);
  const html = record.mediaType.startsWith("text/html");
  let body: string | Uint8Array = bytes;
  if (html) {
    try {
      body = hostedHtml(
        new TextDecoder().decode(bytes),
        record.path,
        renderedPaths,
        prefix,
      );
    } catch {
      return c.text("Published HTML unavailable", 503);
    }
    /* Added at serve time, never to the stored files: exports, previews and the immutable
       publication stay exactly what was reviewed. */
    if (counting) {
      body = withClickScript(body, publication.siteId);
      counting.view(status === 404 ? NOT_FOUND : publicPath(record.path));
    }
  }
  const etag = `"${
    sha256(typeof body === "string" ? new TextEncoder().encode(body) : body)
  }"`;
  const headers: Record<string, string> = html
    ? {
      ...publishedHeaders(record.mediaType),
      etag,
      "cache-control": "public, max-age=0, must-revalidate",
    }
    : {
      ...publicationAssetHeaders(record.mediaType, record.path),
      etag,
      /* Everything under assets/ is named for its bytes (an image's id, a stylesheet's or a
         font's hash), so a change is a new URL. sitemap.xml and robots.txt keep their names
         across publishes and are revalidated like pages. */
      "cache-control": record.path.startsWith("assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate",
    };
  if (
    c.req.header("if-none-match")?.split(",").map((value) => value.trim())
      .includes(etag)
  ) {
    return c.body(null, 304, headers);
  }
  if (typeof body === "string") return c.body(body, status, headers);
  return c.body(body as unknown as ArrayBuffer, status, {
    ...headers,
    "content-length": String(body.byteLength),
  });
}

/** What serveHostedPublication needs to count a page while analytics is on. */
interface Counting { view(page: string): void }

const publicationAssetHeaders = (
  mediaType: string,
  path: string,
): Record<string, string> =>
  mediaType === "image/svg+xml"
    ? {
      "content-type": mediaType,
      "content-security-policy":
        "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "content-disposition": `inline; filename="${
        path.split("/").at(-1)!.replace(/["\\\r\n]/g, "_")
      }"`,
      "x-content-type-options": "nosniff",
    }
    : mediaType.startsWith("font/")
    /* Published pages run in an opaque-origin sandbox, so to the browser even the site's own
       font is a cross-origin font load, and fonts load in CORS mode. */
    ? {
      "content-type": mediaType,
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
    }
    : { "content-type": mediaType, "x-content-type-options": "nosniff" };

/** What a hosted site answers for a path it does not have, when it has no 404 page of its own:
    still a page, in the site's sandbox, with a way back to its home. No external resources. */
const missingPage = (home: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;
font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d211e;background:#f8f6ef}
main{max-width:32rem;text-align:center}
h1{margin:0 0 8px;font-size:clamp(28px,6vw,40px);line-height:1.15;letter-spacing:-.02em}
p{margin:0 0 24px;color:#5f6660}
a{display:inline-block;padding:10px 18px;border-radius:8px;background:#1d211e;color:#fff;text-decoration:none}
a:focus-visible{outline:3px solid #1d211e;outline-offset:3px}
</style>
</head>
<body>
<main>
<h1>Page not found</h1>
<p>There is nothing at this address. It may have moved, or the link may be mistyped.</p>
<a href="${escapeHtml(home)}">Go to the home page</a>
</main>
</body>
</html>
`;

async function serveSite(
  c: Context,
  o: Options,
  built: Map<
    string,
    { version: number; releaseId: string | null; files: Map<string, string> }
  >,
  render: (doc: Doc, assets?: AssetRecord[]) => { files: Map<string, string> },
  urlPath: string,
  site: Site,
) {
  /* A restart empties the cache, so the first request after one renders. Cheaper than
     writing files to the volume and keeping them in step with the document. */
  const path = resolvePath(urlPath);
  const shared = isEditorHost(c.req.header("host"), o);
  const prefix = shared ? site.slug : "";

  /* Images come from the asset store rather than the rendered map: the map holds strings, and
     putting megabytes of binary in it would make every render carry them. */
  if (path.startsWith("assets/")) {
    /* Once a signed release exists, its content-addressed bytes are the public truth. A later
       draft upload or replacement cannot mutate what visitors receive before Publish. */
    if (site.publishedReleaseId && o.connected) {
      const release = await o.connected.release(site.publishedReleaseId);
      if (!release) return c.text("Published release unavailable", 503);
      let artifact: ReturnType<typeof parseReleaseArtifact>;
      try {
        if (
          release.artifact.byteLength !== release.artifactBytes ||
          sha256(release.artifact) !== release.artifactHash
        ) throw new Error("artifact integrity mismatch");
        artifact = parseReleaseArtifact(release.artifact);
      } catch {
        return c.text("Published release artifact unavailable", 503);
      }
      const frozen = artifact.assets.find((asset) => asset.filename === path);
      if (!frozen) return c.notFound();
      let bytes: Uint8Array;
      try {
        bytes = fromBase64url(frozen.content);
        if (
          bytes.byteLength !== frozen.bytes || sha256(bytes) !== frozen.hash
        ) {
          throw new Error("asset integrity mismatch");
        }
      } catch {
        return c.text("Published release asset unavailable", 503);
      }
      return c.body(bytes as unknown as ArrayBuffer, 200, {
        ...assetHeaders({ type: frozen.mime, name: frozen.filename }),
        "content-length": String(frozen.bytes),
        "cache-control": "public, max-age=31536000, immutable",
      });
    }
    const a = o.assets ? await o.assets.byPath(site.id, path) : null;
    if (a) {
      return c.body(a.bytes as unknown as ArrayBuffer, 200, {
        ...assetHeaders(a),
        /* the path is the filename, and the filename changes when the image does, so this is
         safe to cache hard — a replaced image is a different path */
        "cache-control": "public, max-age=31536000, immutable",
      });
    }
  }

  let cached = built.get(site.id);
  /* Version-aware rather than process-invalidation-only. Another Passenger worker may save the
     site; once this store lookup observes that version, this worker cannot keep serving its old
     rendered map indefinitely. */
  if (
    !cached || cached.version !== site.publishedVersion ||
    cached.releaseId !== site.publishedReleaseId
  ) {
    if (site.publishedReleaseId) {
      if (!o.connected) {
        return c.text("Published release store unavailable", 503);
      }
      const release = await o.connected.release(site.publishedReleaseId);
      if (
        !release || release.siteId !== site.id ||
        release.sourceVersion !== site.publishedVersion
      ) {
        return c.text("Published release unavailable", 503);
      }
      const files = new Map<string, string>();
      try {
        if (
          !Array.isArray(release.hostedFiles) || !release.hostedFiles.length
        ) {
          throw new Error("release has no hosted export");
        }
        for (const file of release.hostedFiles) {
          if (
            !file || typeof file.path !== "string" ||
            typeof file.content !== "string" ||
            files.has(file.path)
          ) throw new Error("invalid or duplicate hosted path");
          const bytes = new TextEncoder().encode(file.content);
          if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.hash) {
            throw new Error("hosted file integrity mismatch");
          }
          files.set(file.path, file.content);
        }
      } catch (error) {
        console.error(
          "published release could not be served:",
          String((error as Error).message || error),
        );
        return c.text("Published release export unavailable", 503);
      }
      cached = { version: site.publishedVersion, releaseId: release.id, files };
    } else {
      const revision = await o.store.revision(site.id, site.publishedVersion);
      /* Sites created before signed releases have an explicit immutable revision bootstrap.
         Once a release pointer exists, only its frozen export is accepted above. */
      if (!revision) return c.text("Published revision unavailable", 503);
      let out: { files: Map<string, string> };
      try {
        out = render(
          revision.doc,
          o.assets ? await o.assets.list(site.id) : [],
        );
      } catch (error) {
        console.error(
          "published revision could not be rendered:",
          String((error as Error).message || error),
        );
        return c.text(
          "Published revision requires a newer Pagecraft renderer",
          503,
        );
      }
      cached = {
        version: site.publishedVersion,
        releaseId: null,
        files: out.files,
      };
    }
    built.set(site.id, cached);
  }
  const files = cached.files;

  /* `/index`, `/index.html`, and nested equivalents are duplicate directory URLs. Redirect
     only when that exact rendered index exists; a user-authored non-page path remains a 404. */
  if (
    /(^|\/)index(?:\.html)?$/i.test(urlPath.replace(/\/+$/, "")) &&
    files.has(path)
  ) {
    return c.redirect(
      publicPath(path, prefix) + new URL(c.req.url).search,
      308,
    );
  }

  /* Old bookmarks still arrive, but the implementation filename must not remain visible.
     Redirect only when that exact rendered page exists, so `/made-up.html` stays a real 404
     instead of becoming a misleading redirect followed by one. */
  if (/\.html$/i.test(urlPath) && files.has(path)) {
    return c.redirect(
      publicPath(path, prefix) + new URL(c.req.url).search,
      308,
    );
  }

  const body = files.get(path);
  /* A site's own 404 page if it has one — the convention the builder already exports. */
  if (body === undefined) {
    const notFound = files.get("404.html");
    if (notFound !== undefined) {
      return c.body(
        hostedHtml(notFound, "404.html", files, prefix),
        404,
        publishedHeaders(TYPES.html),
      );
    }
    return c.html(missingPage(publicPath("index.html", prefix)), 404, publishedHeaders(TYPES.html));
  }
  const type = typeOf(path);
  let served = type.startsWith("text/html")
    ? hostedHtml(body, path, files, prefix)
    : body;
  if (type.startsWith("text/html") && o.connected) {
    const production = await o.connected.canonicalProductionConnection(site.id);
    if (production) {
      served = wordpressCanonicalHtml(
        served,
        production.targetOrigin,
        production.targetPath,
        path,
      );
    }
  }
  return c.body(
    served,
    200,
    type.startsWith("text/html")
      ? publishedHeaders(type)
      : { "content-type": type },
  );
}

/** As soon as an owner pairs a production WordPress target, Pagecraft's hosted copy becomes a
 * review/fallback surface and must not compete in search, even before the first deployment.
 * Disconnect freezes WordPress content but does not reclaim canonical ownership, so the last
 * consented production origin/path remains here until an explicit future owner-reclaim flow. */
function wordpressCanonicalHtml(
  html: string,
  origin: string,
  targetPath: string,
  file: string,
) {
  const basePath = ("/" + targetPath.replace(/^\/+|\/+$/g, "") + "/").replace(
    /^\/\/$/,
    "/",
  );
  const relative = publicPath(file).replace(/^\/+/, "");
  const canonical = new URL(basePath + relative, origin).href;
  const tags =
    `<meta name="robots" content="noindex,follow">\n<link rel="canonical" href="${
      canonical.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    }">\n`;
  return replaceHostedSeoOwnershipTags(html, tags);
}

/** A published page may intentionally run scripts, but it must not inherit the editor origin.
    CSP sandbox without `allow-same-origin` gives it an opaque origin while retaining the site
    features owners asked for. */
const publishedHeaders = (type: string): Record<string, string> => ({
  "content-type": type,
  "content-security-policy":
    "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads",
});

/** SVG remains supported. If opened directly, the response itself is sandboxed and cannot run
    script or navigate the editor; as an <img>, browsers already treat it as an image document. */
const assetHeaders = (
  asset: Pick<Asset, "type" | "name">,
): Record<string, string> =>
  asset.type === "image/svg+xml"
    ? {
      "content-type": asset.type,
      "content-security-policy":
        "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "content-disposition": `inline; filename="${
        asset.name.replace(/["\\\r\n]/g, "_")
      }"`,
      "x-content-type-options": "nosniff",
    }
    : { "content-type": asset.type, "x-content-type-options": "nosniff" };
