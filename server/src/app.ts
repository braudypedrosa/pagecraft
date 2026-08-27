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
import { Hono, type Context } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { cmsItemKey, validHost, validSlug, type Site, type Store } from './store.ts';
import { adopt, blankDoc, hostedHtml, publicPath, renderSite, resolvePath } from './render.ts';
import { contentOnly } from './content.ts';
import { assertTypedCmsWrite } from './cms-values.ts';
import { throttle } from './mail.ts';
import {
  type AssetStore, type Asset, type AssetRecord,
  metaOf, sniff, MAX_BYTES, ALLOWED, FREE_STORAGE_BYTES, AssetQuotaError
} from './assets.ts';
import { optimizeImage, optimizedName, type OptimizedImage } from './image-optimization.ts';
import type { Doc } from '../../app/src/core/types.ts';
import { assetFile } from '../../app/src/core/index.ts';
import {
  type AuthStore, type User, type Role, roleAllows, newToken, hashToken,
  normalEmail, validEmail, LINK_TTL_MS, SESSION_TTL_MS, logLink, type LinkSender
} from './auth.ts';
import {
  type ConnectedStore, type DeploymentStatus, type ReleaseAudit, type SiteRelease, type SiteReleaseSummary,
  type WordPressConnection, type WordPressContentIndexItem
} from './release-store.ts';
import {
  base64url, buildReleaseArtifact, canonicalJson, canonicalOrigin, canonicalTargetPath,
  decodeReleaseManifest, deploymentForTarget, fromBase64url, manifestForRelease,
  authoredCssAtRuleIssues, authoredStylesheetIssues, existingThemeCssIssues,
  migrateIndexedWordPressLinks,
  parseReleaseArtifact, releaseStylesheetLinks,
  replaceHostedSeoOwnershipTags,
  sha256, signDeploymentEnvelope, signReleaseManifest, utf8ByteCompare,
  signReleaseAvailableWebhook,
  type KeysetEnvelopeV1, type ReleaseSigningKey
} from './releases.ts';
import { freezeGoogleFontStylesheets } from './font-freeze.ts';
import type { PackageRegistry } from './packages.ts';
import { createPagePackage, createSitePackage, portableAssetIds } from './portable-packages.ts';
import type { AccountAuth } from './account-auth.ts';
import type { HumanChallenge } from './turnstile.ts';
import type { OwnedSiteStore } from './accounts.ts';
import {
  dashboardPage, forgotPage, privacyPage, resetPage, signInPage as accountSignInPage,
  signUpPage, termsPage
} from './account-pages.ts';
import { CUSTOM_SELECT_BOOT_SCRIPT, CUSTOM_SELECT_CSS } from '../../shared/custom-select.js';

export const SESSION_COOKIE = 'pc_session';

/* Authorization-code exchange is retryable because the callback crosses two durable systems:
   Pagecraft and WordPress. Deriving the credentials from the high-entropy code + PKCE verifier
   returns the exact same secrets after response loss without storing plaintext credentials on
   Pagecraft. The domain and connection binding prevent either token role or another connection
   from sharing key material. */
const oauthCredential = (
  kind: 'access' | 'refresh', connectionId: string, code: string, verifier: string
) => base64url(Buffer.from(hashToken(
  ['pagecraft-oauth-code-v1', kind, connectionId, code, verifier].join('\0')
), 'hex'));

export interface Options {
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
  /** Injectable only so font freezing can be proven without a live third-party dependency. */
  fontFetch?: typeof fetch;
  /** Verified Supabase email/password accounts. Omit only for legacy rollback/tests. */
  accountAuth?: AccountAuth;
  /** Atomic site creation and owner grant, including the owned-site quota. */
  ownedSites?: OwnedSiteStore;
  /** Cloudflare Turnstile verifier for public account forms. */
  challenge?: HumanChallenge;
  turnstileSiteKey?: string;
}

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8'
};
const typeOf = (path: string) => TYPES[(path.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

export function createApp(o: Options) {
  const app = new Hono();
  const optimizeAsset = o.optimizeAsset || optimizeImage;

  /* Baseline browser hardening. Published HTML adds a sandbox below because it may contain an
     owner's intentional scripts; the editor itself must never be framed by another site. */
  app.use('*', async (c, next) => {
    await next();
    c.header('x-content-type-options', 'nosniff');
    c.header('referrer-policy', 'strict-origin-when-cross-origin');
    c.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (isEditorHost(c.req.header('host'), o) && !c.res.headers.has('content-security-policy')) {
      c.header('content-security-policy', "frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
    }
    const path = new URL(c.req.url).pathname;
    const privateRoute = /^\/(?:api|auth|edit|v1)(?:\/|$)/.test(path)
      || (path === '/' && isEditorHost(c.req.header('host'), o));
    if (privateRoute) c.header('cache-control', 'private, no-store');
    /* `secureCookies` is the production signal already passed by the entry point. Browsers
       ignore HSTS over HTTP; over HTTPS this closes the first-visit downgrade gap. Deliberately
       no includeSubDomains until every unrelated subdomain is known to be HTTPS-only. */
    if (o.secureCookies) c.header('strict-transport-security', 'max-age=31536000');
  });

  /* Auth and administration exist on the editor host only. Besides narrowing the attack
     surface, this prevents a custom site's Host header from becoming a magic-link origin. */
  const editorOnly = async (c: Context, next: () => Promise<void>) => {
    if (!isEditorHost(c.req.header('host'), o)) return c.notFound();
    await next();
  };
  app.use('/auth/*', editorOnly);
  app.use('/api/*', editorOnly);
  app.use('/v1/*', editorOnly);
  app.use('/sign-up', editorOnly);
  app.use('/sign-in', editorOnly);
  app.use('/forgot-password', editorOnly);
  app.use('/reset-password', editorOnly);
  app.use('/privacy', editorOnly);
  app.use('/terms', editorOnly);
  app.get('/brand/pagecraft-logo.svg', editorOnly, serveStatic({
    path: './brand/logo/pagecraft-logo-primary-dark.svg'
  }));
  app.get('/brand/pagecraft-favicon.svg', editorOnly, serveStatic({
    path: './brand/pagecraft-favicon.svg'
  }));
  app.use('/api/*', bodyLimit({
    maxSize: 16 * 1024 * 1024,
    onError: c => c.json({ error: 'request is too large' }, 413)
  }));
  app.use('/v1/*', bodyLimit({
    maxSize: 16 * 1024 * 1024,
    onError: c => c.json({ error: 'request is too large' }, 413)
  }));
  if (o.accountAuth) {
    app.use('*', async (c, next) => {
      const method = c.req.method.toUpperCase();
      const path = new URL(c.req.url).pathname;
      const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method)
        && (/^\/(?:auth|api)(?:\/|$)/.test(path));
      const bearer = /^Bearer\s+/i.test(c.req.header('authorization') || '')
        || !!c.req.header('x-pagecraft-editor-session');
      const origin = c.req.header('origin');
      if (mutating && !bearer && origin) {
        const expected = new URL(o.editorOrigin || c.req.url).origin;
        if (origin !== expected) return c.json({ error: 'origin_not_allowed' }, 403);
      }
      /* The old cookie is deliberately cleared throughout the cutover release. */
      if (getCookie(c, SESSION_COOKIE)) deleteCookie(c, SESSION_COOKIE, { path: '/' });
      await next();
    });
  }

  /* Rendered output, per site id, rebuilt on save. A site's files are small — the whole
     demo project is 69 KB of HTML — and rendering is about 5 ms, so holding them costs
     little and means a visitor never waits for a render. */
  const built = new Map<string, {
    version: number; releaseId: string | null; files: Map<string, string>;
  }>();
  type OAuthConsent = {
    userId: string;
    request: {
      suggestedSiteId: string;
      installationId: string;
      environment: 'staging' | 'production';
      profile: 'existing-theme' | 'pagecraft-theme';
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
  const render = (doc: Doc, assets: AssetRecord[] = []) => {
    /* Every served byte comes through here, so this is where a document written by an older
       editor is brought up to date. `adopt` returning null means a newer editor wrote it; it
       is in the table already, so render it as it stands rather than take the site down. */
    /* The renderer reads ids and names only. Keep its existing Asset input contract while the
       stores correctly keep image bodies out of metadata listings. */
    const refs: Asset[] = assets.map(asset => ({
      ...asset, bytes: new Uint8Array()
    }));
    const adopted = adopt(doc);
    if (!adopted) throw new Error('document schema is newer than this Pagecraft renderer');
    return renderSite(adopted, refs);
  };
  const assetsOf = async (id: string) => o.assets ? o.assets.list(id) : [];
  const assetBodiesOf = async (id: string, onlyIds?: ReadonlySet<string>) => {
    if (!o.assets) return [] as Asset[];
    const out: Asset[] = [];
    for (const meta of await o.assets.list(id)) {
      if (onlyIds && !onlyIds.has(meta.id)) continue;
      const asset = await o.assets.get(id, meta.id);
      if (asset) out.push(asset);
    }
    return out;
  };
  const releaseAssetIds = (doc: Doc, files: Map<string, string>, assets: AssetRecord[]) => {
    const referenced = new Set<string>();
    const rendered = [...files.values()].join('\n');
    for (const asset of assets) {
      if (rendered.includes(assetFile(asset))) referenced.add(asset.id);
    }
    for (const collection of doc.meta.collections || []) {
      const imageFields = new Set(collection.fields.filter(field => field.type === 'image').map(field => field.id));
      for (const item of collection.items) {
        for (const fieldId of imageFields) {
          const match = String(item.values[fieldId] || '').match(/^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@\d+)?$/);
          if (match) referenced.add(match[1]);
        }
      }
    }
    return referenced;
  };
  const remember = (site: Site, out: ReturnType<typeof render>) => {
    built.set(site.id, {
      version: site.publishedVersion, releaseId: site.publishedReleaseId, files: out.files
    });
    return out;
  };
  const candidate = (doc: Doc, assets: AssetRecord[]) => {
    try { return render(doc, assets); }
    catch (caught) {
      console.warn('invalid Pagecraft document rejected:', String((caught as Error).message || caught));
      return null;
    }
  };

  /* ------------------------------------------------------------------- who, and what */

  /** The person behind this request, or null. A bad cookie is the same as no cookie. */
  const who = async (c: Context): Promise<User | null> => {
    if (o.accountAuth) {
      const identity = await o.accountAuth.identity(c);
      if (!identity) return null;
      return o.auth.ensureAuthUser(identity.authUserId, identity.email, identity.name);
    }
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return null;
    return o.auth.userForSession(hashToken(token));
  };

  const visibleSites = async (user: User) => {
    const [sites, memberships] = await Promise.all([
      o.store.listMeta(), o.auth.membershipsForUser(user.id)
    ]);
    const roles = new Map(memberships.map(m => [m.siteId, m.role]));
    return sites.flatMap(site => {
      const role = roles.get(site.id);
      return role ? [{ site, role }] : [];
    });
  };

  const storageOwner = async (siteId: string, actor: User, role: Role) => {
    if (role === 'owner') return actor.id;
    const owners = (await o.auth.members(siteId))
      .filter(member => member.role === 'owner')
      .sort((a, b) => a.userId.localeCompare(b.userId));
    return owners[0]?.userId || null;
  };

  /**
   * May this person do this to this site? Every answer comes from here, so a route cannot
   * forget the membership half and check only that somebody is logged in.
   */
  const allowed = async (c: Context, siteId: string, verb: 'read' | 'write' | 'admin') => {
    const scoped = c.req.header('x-pagecraft-editor-session');
    if (scoped) {
      const credential = await o.connected?.editorCredential(hashToken(scoped), new Date().toISOString());
      if (!credential) return { ok: false as const, status: 401 as const };
      if (credential.siteId !== siteId) return { ok: false as const, status: 404 as const };
      const [user, membership] = await Promise.all([
        o.auth.userById(credential.ownerId), o.auth.membership(siteId, credential.ownerId)
      ]);
      if (!user || membership?.role !== 'owner') return { ok: false as const, status: 403 as const };
      return { ok: true as const, user, role: membership.role };
    }
    if (o.accountAuth) {
      const user = await who(c);
      if (!user) return { ok: false as const, status: 401 as const };
      const membership = await o.auth.membership(siteId, user.id);
      if (!membership) return { ok: false as const, status: 404 as const };
      if (!roleAllows(membership.role, verb)) return { ok: false as const, status: 403 as const };
      return { ok: true as const, user, role: membership.role };
    } else {
      const token = getCookie(c, SESSION_COOKIE);
      if (!token) return { ok: false as const, status: 401 as const };
      const access = await o.auth.accessForSession(hashToken(token), siteId);
      if (!access) return { ok: false as const, status: 401 as const };
      if (!access.role) return { ok: false as const, status: 404 as const }; // conceal existence
      if (!roleAllows(access.role, verb)) return { ok: false as const, status: 403 as const };
      return { ok: true as const, user: access.user, role: access.role };
    }
  };

  const deny = (c: Context, status: 401 | 403 | 404) =>
    c.json({ error: status === 401 ? 'sign in' : status === 403 ? 'not allowed' : 'no such site' }, status);

  const bearerConnection = async (c: Context) => {
    if (!o.connected) return null;
    const match = (c.req.header('authorization') || '').match(/^Bearer\s+([^\s]+)$/i);
    if (!match) return null;
    return o.connected.connectionByAccessToken(hashToken(match[1]), new Date().toISOString());
  };
  const releaseReady = () => !!(o.connected && o.releaseSigning && o.keysetEnvelope);
  const releaseUnavailable = (c: Context) => c.json({
    error: 'release signing is unavailable',
    detail: 'Connected publishing requires a release private key and an offline root-signed keyset.'
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
    updatedAt: connection.updatedAt
  });
  const wordpressContentForSite = async (siteId: string) => {
    if (!o.connected) return [];
    const [connections, snapshots] = await Promise.all([
      o.connected.connectionsForSite(siteId), o.connected.wordpressContentIndexesForSite(siteId)
    ]);
    const byId = new Map(connections.filter(item => item.status === 'active').map(item => [item.id, item]));
    return snapshots.flatMap(snapshot => {
      const connection = byId.get(snapshot.connectionId);
      return connection ? [{
        connectionId: connection.id,
        environment: connection.environment,
        profile: connection.profile,
        targetOrigin: connection.targetOrigin,
        targetPath: connection.targetPath,
        generation: snapshot.generation,
        syncedAt: snapshot.syncedAt,
        /* The index is a link catalogue, not a second WordPress editor. */
        items: snapshot.items.map(item => ({ ...item }))
      }] : [];
    }).sort((a, b) => utf8ByteCompare(a.environment, b.environment)
      || utf8ByteCompare(a.targetOrigin, b.targetOrigin));
  };
  const issueTarget = async (release: SiteReleaseSummary, connection: WordPressConnection, desired: boolean) => {
    if (!o.connected || !o.releaseSigning) throw new Error('release signing unavailable');
    const ensureQueued = async (target: { sequence: number }) => {
      const history = (await o.connected!.deploymentsForRelease(release.id))
        .filter(item => item.connectionId === connection.id && item.sequence === target.sequence);
      if (history.length) return;
      const queued = {
        connectionId: connection.id,
        releaseId: release.id,
        sequence: target.sequence,
        status: 'queued' as const,
        activeHash: null,
        error: null,
        detail: { stage: 'queued', message: 'Release is available for this target.' },
        idempotencyKey: `target:${connection.id}:${release.id}`
      };
      const bodyHash = sha256(new TextEncoder().encode(canonicalJson(queued)));
      const recorded = await o.connected!.recordDeployment({ ...queued, bodyHash });
      if (!recorded.ok) throw new Error(`could not queue release target: ${recorded.error}`);
    };
    const announce = async (target: { sequence: number; createdAt: string }) => {
      const eventId = `pcw_${sha256(new TextEncoder().encode(`${connection.id}:${release.id}`)).slice(0, 40)}`;
      const event = {
        type: 'release.available' as const,
        eventId, connectionId: connection.id, releaseId: release.id,
        sequence: target.sequence, occurredAt: target.createdAt
      };
      const signed = signReleaseAvailableWebhook(event, o.releaseSigning!);
      try {
        await o.connected!.enqueueWebhook({
          eventId, connectionId: connection.id, releaseId: release.id,
          targetSequence: target.sequence, webhookUrl: connection.webhookUrl,
          payload: signed.payload, bodyHash: signed.bodyHash,
          signature: signed.signature, keyId: signed.keyId
        });
      } catch (error) {
        /* Polling reconciles even if the announcement queue is temporarily unavailable. */
        console.error('WordPress release webhook could not be queued:', (error as Error).message);
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
      issuedAt
    });
    const signed = signDeploymentEnvelope(envelope, o.releaseSigning);
    const made = await o.connected.createTarget({
      releaseId: release.id, connectionId: connection.id, sequence: connection.nextSequence,
      envelope: signed.envelope, signature: signed.signature, keyId: signed.keyId, createdAt: issuedAt
    }, desired);
    await ensureQueued(made.target);
    await announce(made.target);
    return made.target;
  };
  const stageReleaseIfIdle = async (release: SiteReleaseSummary, connections?: WordPressConnection[]) => {
    if (!o.connected) return false;
    const targets = connections || await o.connected.connectionsForSite(release.siteId);
    const staging = targets.find(item => item.environment === 'staging' && item.status === 'active');
    const production = targets.find(item => item.environment === 'production' && item.status === 'active');
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
      const stagingHistory = (await o.connected.deploymentsForRelease(parent.id))
        .filter(item => item.connectionId === staging.id);
      const stagingLast = stagingHistory[stagingHistory.length - 1];
      if (!stagingLast || !['live', 'failed', 'rolled_back'].includes(stagingLast.status)) return false;
      if (stagingLast.status === 'live' && production) {
        const productionTarget = await o.connected.target(production.id, parent.id);
        if (!productionTarget) return false;
        const productionHistory = (await o.connected.deploymentsForRelease(parent.id))
          .filter(item => item.connectionId === production.id);
        const productionLast = productionHistory[productionHistory.length - 1];
        if (!productionLast || !['live', 'failed', 'rolled_back'].includes(productionLast.status)) return false;
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
      .filter(item => item.sequence > afterSequence)
      .sort((a, b) => a.sequence - b.sequence);
    for (const release of releases) {
      const staging = connections.find(item => item.environment === 'staging' && item.status === 'active');
      if (!staging) break;
      const existing = await o.connected.target(staging.id, release.id);
      if (existing) {
        const history = (await o.connected.deploymentsForRelease(release.id))
          .filter(item => item.connectionId === staging.id && item.sequence === existing.sequence);
        const last = history.at(-1);
        if (last && ['live', 'failed', 'rolled_back'].includes(last.status)) continue;
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
    const staging = connections.find(item => item.environment === 'staging' && item.status === 'active');
    if (!staging?.activeReleaseId) return null;
    const release = await o.connected.release(staging.activeReleaseId);
    if (!release) {
      throw new Error('the active staging release could not be loaded safely');
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
  app.get('/privacy', c => c.html(privacyPage()));
  app.get('/terms', c => c.html(termsPage()));
  if (!o.accountAuth) app.post('/auth/login', bodyLimit({
    maxSize: 8 * 1024,
    onError: c => c.json({ error: 'request is too large' }, 413)
  }), async c => {
    const body = await c.req.json().catch(() => null) as { email?: string } | null;
    const email = normalEmail(body?.email || '');
    if (!validEmail(email)) return c.json({ error: 'a valid email address is required' }, 400);

    const source = c.req.header('cf-connecting-ip')
      || (c.req.header('x-forwarded-for') || '').split(',')[0].trim()
      || 'unknown';
    if (sourceLimit.take(source) && limit.take(email) && await o.auth.userByEmail(email)) {
      const token = newToken();
      await o.auth.putLink(hashToken(token), email, Date.now() + LINK_TTL_MS);
      const origin = o.editorOrigin || new URL(c.req.url).origin;
      /* Awaited, so a mail server that is refusing is a 500 here rather than a silent
         nothing — a person staring at "check your email" is owed the truth. */
      try {
        await (o.sendLink || logLink)(email, `${origin}/auth/callback?token=${token}`);
      } catch (e) {
        console.error('the login link could not be sent:', (e as Error).message);
        return c.json({ error: 'the link could not be sent — try again shortly' }, 502);
      }
    }
    return c.json({ sent: true });
  });

  app.get('/auth/callback', async c => {
    if (o.accountAuth) return c.notFound();
    const token = c.req.query('token') || '';
    const link = token ? await o.auth.useLink(hashToken(token)) : null;
    if (!link) return c.text('That link has expired or has already been used.', 400);

    const user = await o.auth.userByEmail(link.email);
    if (!user) return c.text('That link has expired or has already been used.', 400);

    const session = newToken();
    await o.auth.putSession(hashToken(session), user.id, Date.now() + SESSION_TTL_MS);
    setCookie(c, SESSION_COOKIE, session, {
      httpOnly: true, sameSite: 'Lax', path: '/',
      secure: !!o.secureCookies, maxAge: Math.floor(SESSION_TTL_MS / 1000)
    });
    return c.redirect('/');
  });

  if (!o.accountAuth) app.post('/auth/logout', async c => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await o.auth.dropSession(hashToken(token));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  if (o.accountAuth) {
    const siteKey = o.turnstileSiteKey || '';
    const safeNext = (raw: unknown) => {
      const value = String(raw || '');
      return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
    };
    const form = async (c: Context) => {
      const type = c.req.header('content-type') || '';
      if (type.includes('application/json')) return await c.req.json().catch(() => ({})) as Record<string, unknown>;
      return await c.req.parseBody().catch(() => ({})) as Record<string, unknown>;
    };
    const source = (c: Context) => c.req.header('cf-connecting-ip')
      || (c.req.header('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const authSourceLimit = throttle(30, 15 * 60 * 1000, 5000);
    const authEmailLimit = throttle(8, 15 * 60 * 1000, 5000);
    const challengeToken = async (c: Context, body: Record<string, unknown>, action: 'signup' | 'login' | 'forgot') => {
      const token = String(body['cf-turnstile-response'] || body.turnstileToken || '');
      return o.challenge && await o.challenge.verify({ token, ip: source(c), action }) ? token : '';
    };

    app.get('/sign-up', c => c.html(signUpPage(siteKey, { error: c.req.query('error'), message: c.req.query('message') })));
    app.get('/sign-in', c => c.html(accountSignInPage(siteKey, {
      error: c.req.query('error'), message: c.req.query('message'), next: safeNext(c.req.query('next'))
    })));
    app.get('/forgot-password', c => c.html(forgotPage(siteKey, { error: c.req.query('error'), message: c.req.query('message') })));
    app.get('/reset-password', async c => {
      const user = await who(c);
      return user ? c.html(resetPage({ error: c.req.query('error') })) : c.redirect('/sign-in?error=reset');
    });

    app.post('/auth/signup', bodyLimit({ maxSize: 16 * 1024, onError: c => c.text('Request too large', 413) }), async c => {
      const body = await form(c);
      const email = normalEmail(String(body.email || ''));
      const name = String(body.name || '').trim().slice(0, 120);
      const password = String(body.password || '');
      const confirmation = String(body.passwordConfirm || '');
      if (!validEmail(email) || !name) return c.redirect('/sign-up?error=invalid', 303);
      if (password.length < 12) return c.redirect('/sign-up?error=password', 303);
      if (password !== confirmation) return c.redirect('/sign-up?error=mismatch', 303);
      if (!authSourceLimit.take(source(c)) || !authEmailLimit.take(email)) {
        return c.redirect('/sign-up?message=Check+your+email+to+finish+creating+your+account.', 303);
      }
      const captchaToken = await challengeToken(c, body, 'signup');
      if (!captchaToken) return c.redirect('/sign-up?error=challenge', 303);
      const origin = o.editorOrigin || new URL(c.req.url).origin;
      await o.accountAuth!.signUp(c, { email, password, name, redirectTo: `${origin}/auth/confirm`, captchaToken });
      return c.redirect('/sign-in?message=Check+your+email+to+confirm+your+account.', 303);
    });

    app.post('/auth/login', bodyLimit({ maxSize: 16 * 1024, onError: c => c.text('Request too large', 413) }), async c => {
      const body = await form(c);
      const email = normalEmail(String(body.email || ''));
      const password = String(body.password || '');
      const next = safeNext(body.next);
      const limited = !authSourceLimit.take(source(c)) || !authEmailLimit.take(email);
      const captchaToken = await challengeToken(c, body, 'login');
      if (!validEmail(email) || !password || limited || !captchaToken) {
        return c.redirect(`/sign-in?error=${limited ? 'auth' : 'challenge'}&next=${encodeURIComponent(next)}`, 303);
      }
      const identity = await o.accountAuth!.signIn(c, { email, password, captchaToken });
      if (!identity) return c.redirect(`/sign-in?error=auth&next=${encodeURIComponent(next)}`, 303);
      await o.auth.ensureAuthUser(identity.authUserId, identity.email, identity.name);
      return c.redirect(next, 303);
    });

    app.post('/auth/google', bodyLimit({ maxSize: 4 * 1024, onError: c => c.text('Request too large', 413) }), async c => {
      const body = await form(c);
      const next = safeNext(body.next);
      if (!authSourceLimit.take(source(c))) {
        return c.redirect(`/sign-in?error=oauth&next=${encodeURIComponent(next)}`, 303);
      }
      const origin = o.editorOrigin || new URL(c.req.url).origin;
      const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;
      const url = await o.accountAuth!.oauth(c, { provider: 'google', redirectTo });
      return url ? c.redirect(url, 303)
        : c.redirect(`/sign-in?error=oauth&next=${encodeURIComponent(next)}`, 303);
    });

    app.get('/auth/confirm', async c => {
      const type = c.req.query('type');
      const next = safeNext(c.req.query('next'));
      const identity = await o.accountAuth!.confirm(c, {
        code: c.req.query('code'), tokenHash: c.req.query('token_hash'), type
      });
      if (!identity) return c.redirect('/sign-in?error=expired', 303);
      await o.auth.ensureAuthUser(identity.authUserId, identity.email, identity.name);
      return c.redirect(type === 'recovery' ? '/reset-password' : next, 303);
    });

    app.post('/auth/forgot-password', bodyLimit({ maxSize: 16 * 1024, onError: c => c.text('Request too large', 413) }), async c => {
      const body = await form(c);
      const email = normalEmail(String(body.email || ''));
      const captchaToken = await challengeToken(c, body, 'forgot');
      const allowedRequest = validEmail(email) && authSourceLimit.take(source(c)) && authEmailLimit.take(email)
        && !!captchaToken;
      if (allowedRequest) {
        const origin = o.editorOrigin || new URL(c.req.url).origin;
        await o.accountAuth!.forgot(c, {
          email, redirectTo: `${origin}/auth/confirm?type=recovery`, captchaToken
        }).catch(() => undefined);
      }
      return c.redirect('/forgot-password?message=If+an+account+matches,+reset+instructions+are+on+the+way.', 303);
    });

    app.post('/auth/reset-password', async c => {
      const body = await form(c);
      const password = String(body.password || '');
      if (password.length < 12) return c.redirect('/reset-password?error=password', 303);
      if (password !== String(body.passwordConfirm || '')) return c.redirect('/reset-password?error=mismatch', 303);
      if (!await o.accountAuth!.reset(c, password)) return c.redirect('/sign-in?error=reset', 303);
      return c.redirect('/?message=Password+updated.', 303);
    });

    app.post('/auth/logout', async c => {
      await o.accountAuth!.signOut(c);
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      return c.redirect('/sign-in', 303);
    });
  }

  app.get('/auth/me', async c => {
    const user = await who(c);
    if (!user) return c.json({ user: null });
    const mine = (await visibleSites(user)).map(({ site, role }) => ({
      id: site.id, host: site.host, slug: site.slug,
      url: shareUrl(c, o, site), name: site.name, role
    }));
    const storage = o.assets ? await o.assets.usage(user.id, FREE_STORAGE_BYTES) : null;
    return c.json({ user: { id: user.id, email: user.email, name: user.name }, sites: mine, storage });
  });

  /* ---------------------------------------------------------------- the editor */

  app.get('/', async c => {
    if (!isEditorHost(c.req.header('host'), o)) {
      const host = (c.req.header('host') || '').split(':')[0];
      const site = await o.store.byHost(host);
      if (!site) return c.text(`No site for host ${host}`, 404);
      return serveSite(c, o, built, render, '/', site);
    }
    const user = await who(c);
    if (o.accountAuth) {
      if (!user) return c.redirect('/sign-in');
      const mine = (await visibleSites(user)).sort((a, b) =>
        new Date(b.site.updatedAt).getTime() - new Date(a.site.updatedAt).getTime());
      const storage = o.assets
        ? await o.assets.usage(user.id, FREE_STORAGE_BYTES)
        : { usedBytes: 0, limitBytes: FREE_STORAGE_BYTES };
      return c.html(dashboardPage(user, mine.map(({ site, role }) => ({
        id: site.id, name: site.name, role, updatedAt: site.updatedAt,
        url: shareUrl(c, o, site), published: site.version === site.publishedVersion
      })), mine.filter(item => item.role === 'owner').length, storage, c.req.query('error')));
    }
    if (!user) return c.html(signInPage());

    const mine = await visibleSites(user);
    if (!mine.length) return c.html(emptyPage(user.email));
    /* one site is the common case, and a picker with one row on it is a click for nothing */
    if (mine.length === 1) return c.redirect(`/edit/${mine[0].site.id}`);
    /* `where` rather than the host: a site with no domain has a placeholder one that never
       resolves, and printing `unclaimed-3f2a….invalid` under its name would be the picker lying
       about where the site is. */
    return c.html(pickerPage(user.email, mine.map(m => ({
      id: m.site.id, name: m.site.name, role: m.role,
      where: /\.invalid$/.test(m.site.host) ? `/${m.site.slug}/` : m.site.host
    }))));
  });

  /* The editor, with the document already in the page.

     Injecting it rather than having the editor fetch it keeps `load()` synchronous, which is
     what it is in the single-file build — the editor boots from a document that is already
     there, and the only difference is where the page got it. One build serves both. */
  app.get('/edit/:id', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return gate.status === 401
      ? (o.accountAuth
        ? c.redirect(`/sign-in?next=${encodeURIComponent(new URL(c.req.url).pathname)}`)
        : c.html(signInPage()))
      : deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    if (!o.editorHtml) return c.text('No editor build. Run `node build.mjs` first.', 503);

    const mediaOwnerId = await storageOwner(id, gate.user, gate.role);
    const storage = o.assets && mediaOwnerId
      ? await o.assets.usage(mediaOwnerId, FREE_STORAGE_BYTES)
      : { usedBytes: 0, limitBytes: FREE_STORAGE_BYTES };
    const config = {
      siteId: site.id, host: site.host, slug: site.slug, name: site.name,
      /* the link to send somebody, worked out once here rather than assembled in the editor:
         only the server knows whether this site has a domain of its own yet */
      url: shareUrl(c, o, site),
      version: site.version,
      publishedVersion: site.publishedVersion,
      publishedReleaseId: site.publishedReleaseId,
      schemaVersion: site.doc.schemaVersion,
      connectedApiBase: '/v1',
      connectedPublishingAvailable: releaseReady(),
      role: gate.role,
      user: { id: gate.user.id, name: gate.user.name, email: gate.user.email },
      storage,
      doc: site.doc,
      wordpressContent: await wordpressContentForSite(site.id)
    };
    return c.html(inject(o.editorHtml, config));
  });

  /* The list is per person: a site nobody granted you is a site you do not know exists. */
  app.get('/api/sites', async c => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    const out = (await visibleSites(user)).map(({ site, role }) => ({
      id: site.id, host: site.host, slug: site.slug, url: shareUrl(c, o, site), name: site.name,
      version: site.version, publishedVersion: site.publishedVersion,
      publishedReleaseId: site.publishedReleaseId,
      updatedAt: site.updatedAt, role,
      publishState: site.version === site.publishedVersion ? 'published' : 'draft_changes'
    })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return c.json(out);
  });

  app.get('/api/storage', async c => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    if (!o.assets) return c.json({ usedBytes: 0, limitBytes: FREE_STORAGE_BYTES });
    return c.json(await o.assets.usage(user.id, FREE_STORAGE_BYTES));
  });

  app.get('/api/sites/:id', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    return c.json({
      id: site.id, host: site.host, slug: site.slug, url: shareUrl(c, o, site),
      name: site.name, version: site.version, role: gate.role, doc: site.doc
    });
  });

  /* Creating a site is not something a client does, so it needs a signed-in person and
     grants them ownership of what they made. */
  app.post('/api/sites', async c => {
    const user = await who(c);
    if (!user) return deny(c, 401);
    const htmlForm = (c.req.header('content-type') || '').includes('application/x-www-form-urlencoded')
      || (c.req.header('content-type') || '').includes('multipart/form-data');
    const body = (htmlForm ? await c.req.parseBody().catch(() => null) : await c.req.json().catch(() => null)) as
      { host?: string; slug?: string; name?: string; doc?: Doc } | null;
    if (!body) return c.json({ error: 'a JSON body is required' }, 400);
    /* A document is optional. It used to be required, which meant the only way to make a site
       was to already have one — so a fresh deployment's owner signed in, was told to ask whoever
       set it up, and had nowhere to go. They *are* whoever set it up. A name is enough now, and
       the server starts them where the builder's own "Start an empty site" does. */
    const name = String(body.name || '').trim() || 'Untitled site';
    const requestedSlug = String(body.slug || '').trim();
    if (requestedSlug && !validSlug(requestedSlug)) {
      return htmlForm
        ? c.redirect('/?error=slug', 303)
        : c.json({
          error: 'invalid_slug',
          detail: 'Use lowercase letters, numbers, and single hyphens. Maximum 40 characters.'
        }, 422);
    }
    const doc0 = body.doc || blankDoc(name);
    /* A host is no longer required to have a site. It used to be the only way to reach one, so
       making a site meant inventing a domain first; a slug is enough, and the host is what you
       add when the site earns a domain. The placeholder is unique and never resolves, which is
       the honest value for "no domain yet". */
    const requestedHost = String(body.host || '').trim();
    const host = requestedHost ? validHost(requestedHost) : `unclaimed-${crypto.randomUUID()}.invalid`;
    if (!host) {
      return c.json({
        error: 'that is not a domain',
        detail: 'A hostname on its own — acme.com or www.acme.com. No scheme, no port, no path.'
      }, 400);
    }
    /* Stored at this build's schema, so the row starts where the save path expects it. */
    let doc: Doc | null = null;
    let malformed = false;
    try { doc = adopt(doc0); } catch { malformed = true; }
    if (malformed) {
      return c.json({ error: 'invalid document', detail: 'The document is not a Pagecraft project.' }, 422);
    }
    if (!doc) {
      return c.json({
        error: 'newer', detail: 'This document was written by a newer version of the editor than this server runs. Reload the editor, or deploy the server.'
      }, 409);
    }
    /* Render before the first durable write. A document that cannot produce its files is not a
       site, and returning an error after inserting it leaves an unrecoverable row behind. */
    const preview = candidate(doc, []);
    if (!preview) return c.json({ error: 'invalid document', detail: 'The document is not a renderable Pagecraft project.' }, 422);
    try {
      const created = o.accountAuth
        ? await o.ownedSites?.create({ ownerId: user.id, host, slug: requestedSlug || undefined, name, doc })
        : null;
      if (o.accountAuth && !created) {
        return htmlForm
          ? c.redirect('/?error=creation', 303)
          : c.json({
            error: 'site_creation_unavailable',
            detail: 'Site creation is temporarily unavailable. Your existing sites are still available.'
          }, 503);
      }
      if (created && !created.ok) {
        if (created.reason === 'site_limit_reached') {
          return htmlForm
            ? c.redirect('/?error=limit', 303)
            : c.json({ error: 'site_limit_reached', limit: 3 }, 409);
        }
        return htmlForm
          ? c.redirect('/?error=account', 303)
          : c.json({
            error: 'profile_missing',
            detail: 'Your Pagecraft profile is not ready. Sign out and sign in again, or contact support.'
          }, 409);
      }
      const site = created?.ok
        ? created.site
        : await o.store.create({ host, slug: requestedSlug || undefined, name, doc, savedBy: user.id });
      if (!o.accountAuth) await o.auth.grant(site.id, user.id, 'owner');
      const out = remember(site, preview);
      if (htmlForm) return c.redirect(`/edit/${encodeURIComponent(site.id)}`, 303);
      return c.json({
        id: site.id, slug: site.slug, version: site.version,
        /* where to send somebody, said once by the server rather than assembled by every
           caller that wants to show a link */
        url: shareUrl(c, o, site),
        files: [...out.files.keys()]
      }, 201);
    } catch (e) {
      const message = String((e as Error).message || e);
      if (/already taken|duplicate|unique/i.test(message)) {
        return htmlForm
          ? c.redirect('/?error=slug_taken', 303)
          : c.json({
            error: 'slug_taken',
            detail: 'That site address is already in use. Choose another.'
          }, 409);
      }
      return htmlForm
        ? c.redirect('/?error=creation', 303)
        : c.json({ error: 'site_creation_failed', detail: 'We could not create that site. Try again.' }, 409);
    }
  });

  /* The save. This is the endpoint that makes the whole thing worth building: it is what
     `writeNow()` in the builder used to give localStorage. */
  app.put('/api/sites/:id', async c => {
    const id = c.req.param('id');
    const [gate, site] = await Promise.all([allowed(c, id, 'write'), o.store.byId(id)]);
    if (!gate.ok) return deny(c, gate.status);
    if (!site) return deny(c, 404);

    const body = await c.req.json().catch(() => null) as { doc?: Doc; version?: number } | null;
    if (!body || !body.doc || !Number.isInteger(body.version) || body.version! < 1) {
      return c.json({ error: 'doc and version are required' }, 400);
    }
    const version = body.version as number;

    /* Both documents, brought to the same schema before anything compares them. The incoming
       one because that is what gets stored, and the stored one because the editor migrated it
       on load — so a legacy row plus a content account would otherwise be a save refused for a
       structural change neither of them made. A refusal here means a newer editor is talking to
       an older server, which is a deployment to finish rather than a document to store. */
    let incoming: Doc | null = null;
    let malformed = false;
    try { incoming = adopt(body.doc); } catch { malformed = true; }
    if (malformed) {
      return c.json({ error: 'invalid document', detail: 'The document is not a Pagecraft project.' }, 422);
    }
    if (!incoming) {
      return c.json({
        error: 'newer', detail: 'This document was written by a newer version of the editor than this server runs. Reload the editor, or deploy the server.'
      }, 409);
    }
    body.doc = incoming;
    const stored = adopt(site.doc) || site.doc;
    /* Needed by both the content-role allowlist and the pre-commit render; fetch it once. */
    const siteAssets = await assetsOf(id);

    /* A content role may save, and only content. The check is against what is stored rather
       than against what the editor thinks it loaded, so a stale client cannot smuggle a
       structural change through by sending an old skeleton. */
    if (gate.role === 'content') {
      /* the site's own asset ids, so an image may be swapped for another upload of theirs and
         not for a URL or for somebody else's id */
      const ids = new Set(siteAssets.map(x => x.id));
      const check = contentOnly(stored, body.doc, ids);
      if (!check.ok) {
        return c.json({
          error: 'content only',
          detail: 'This account can change text and CMS content. Layout, styling and page structure are not editable here.'
        }, 403);
      }
    }

    const preview = candidate(body.doc, siteAssets);
    if (!preview) {
      return c.json({ error: 'invalid document', detail: 'The document is not a renderable Pagecraft project.' }, 422);
    }

    const res = await o.store.save(id, body.doc, version, gate.user.id);
    if (!res.ok) {
      /* A stale version is not an error the editor should swallow. Someone else saved, and
         overwriting them silently is the one thing a store must never do. */
      return c.json({ error: 'stale', conflict: res.conflict }, 409);
    }

    /* Saving advances only the draft. The public cache remains keyed to the published
       revision and is invalidated only by an explicit release. */
    const out = preview;
    return c.json({
      version: res.site!.version,
      files: [...out.files.keys()],
      /* the same review the builder shows, so a save can say what it noticed */
      findings: out.findings.map(f => ({ level: f.level, code: f.code, msg: f.msg }))
    });
  });

  /* Durable history. Every accepted save is immutable; restoring an old document goes
     through the normal optimistic save and therefore creates a new version rather than
     deleting the versions that came after it. */
  app.get('/api/sites/:id/history', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    const revisions = await o.store.history(id);
    const authorIds = [...new Set(revisions.flatMap(revision => revision.savedBy ? [revision.savedBy] : []))];
    const authors = new Map((await o.auth.usersByIds(authorIds)).map(user => [user.id, user]));
    return c.json(revisions.map(revision => {
      const author = revision.savedBy ? authors.get(revision.savedBy) : null;
      return {
        version: revision.version, createdAt: revision.createdAt,
        savedBy: revision.savedBy,
        author: author ? { name: author.name, email: author.email } : null
      };
    }));
  });

  app.get('/api/sites/:id/history/:version', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version) || version < 1) return c.json({ error: 'invalid version' }, 400);
    const revision = await o.store.revision(id, version);
    if (!revision) return deny(c, 404);
    return c.json({ version: revision.version, createdAt: revision.createdAt, doc: revision.doc });
  });

  app.post('/api/sites/:id/history/:version/restore', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);
    const version = Number(c.req.param('version'));
    const body = await c.req.json().catch(() => null) as { currentVersion?: number } | null;
    const currentVersion = body?.currentVersion;
    if (!Number.isInteger(version) || version < 1
      || !Number.isInteger(currentVersion) || currentVersion! < 1) {
      return c.json({ error: 'version and currentVersion are required' }, 400);
    }
    const revision = await o.store.revision(id, version);
    if (!revision) return deny(c, 404);
    let restored: Doc | null = null;
    let malformed = false;
    try { restored = adopt(revision.doc); } catch { malformed = true; }
    if (malformed) return c.json({ error: 'invalid document', detail: 'That revision is not a Pagecraft project.' }, 422);
    if (!restored) return c.json({ error: 'newer', detail: 'That version needs a newer Pagecraft build.' }, 409);
    const preview = candidate(restored, await assetsOf(id));
    if (!preview) return c.json({ error: 'invalid document', detail: 'That revision is not renderable.' }, 422);
    const result = await o.store.save(id, restored, currentVersion as number, gate.user.id);
    if (!result.ok) return c.json({ error: 'stale', conflict: result.conflict }, 409);
    const out = preview;
    return c.json({ version: result.site!.version, restoredFrom: version, files: [...out.files.keys()] });
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
  app.put('/api/sites/:id/slug', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);

    const body = await c.req.json().catch(() => null) as { slug?: string } | null;
    const want = validSlug(body?.slug || '');
    if (!want) {
      return c.json({
        error: 'that is not a usable path',
        detail: 'Lowercase letters, digits and hyphens, up to 40 characters — and not a name '
          + 'this server already uses, like api or auth.'
      }, 400);
    }
    const moved = await o.store.setSlug(id, want);
    if (!moved) return c.json({ error: `/${want} already answers for another site` }, 409);
    return c.json({ id: moved.id, slug: moved.slug, url: shareUrl(c, o, moved) });
  });

  app.put('/api/sites/:id/host', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);

    const body = await c.req.json().catch(() => null) as { host?: string } | null;
    const host = validHost(body?.host || '');
    if (!host) {
      return c.json({
        error: 'that is not a domain',
        detail: 'A hostname on its own — acme.com or www.acme.com. No scheme, no port, no path.'
      }, 400);
    }

    const moved = await o.store.setHost(id, host);
    if (!moved) return c.json({ error: 'another site already answers on that domain' }, 409);
    /* The rendered files do not change, but the base URL in them might, so the cache for this
       site is dropped rather than left to serve pages that name the old address. */
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

  app.get('/internal/tls-check', async c => {
    const via = c.req.header('x-forwarded-for');
    /* A `X-Forwarded-For` means somebody outside reached this, because the proxy does not set
       one on its own `ask`. That is enough to refuse, and cheaper than parsing addresses. */
    if (via) return c.text('no', 403);

    const domain = validHost(c.req.query('domain') || '');
    if (!domain) return c.text('no', 400);
    const site = await o.store.byHost(domain);
    /* 200 is "yes, get a certificate for this". Anything else is "do not". */
    return site ? c.text('ok', 200) : c.text('no', 404);
  });

  /* ---------------------------------------------------------------- the people

     Inviting somebody is a grant, not a token. Creating an account for an address hands over
     nothing on its own — they still have to receive a magic link at that address to sign in —
     so there is no invite to expire, resend or leak, and one fewer lifecycle to get wrong.

     Only an owner may do any of this: `admin` is the verb, and `roleAllows` gives it to owners
     alone. */

  app.get('/api/sites/:id/people', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);
    const list = await o.auth.members(id);
    return c.json(list.map(m => ({ userId: m.userId, email: m.email, name: m.name, role: m.role })));
  });

  app.post('/api/sites/:id/people', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);

    const body = await c.req.json().catch(() => null) as { email?: string; role?: Role } | null;
    const email = normalEmail(body?.email || '');
    if (body?.role !== undefined && body.role !== 'owner' && body.role !== 'content') {
      return c.json({ error: 'role must be owner or content' }, 400);
    }
    const role: Role = body?.role === 'owner' ? 'owner' : 'content';
    if (!validEmail(email)) return c.json({ error: 'a valid email address is required' }, 400);

    /* An owner changing their own role is how a site ends up with nobody who can manage it. */
    const existing = await o.auth.userByEmail(email);
    if (existing && existing.id === gate.user.id && role !== 'owner') {
      return c.json({ error: 'you would be giving up your own ownership — ask another owner to do it' }, 409);
    }

    const user = existing || await o.auth.createUser(email);
    const m = await o.auth.grant(id, user.id, role);
    return c.json({ userId: user.id, email: user.email, name: user.name, role: m.role }, 201);
  });

  app.delete('/api/sites/:id/people/:userId', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);

    const target = c.req.param('userId');
    /* A site with no owner is a site nobody can manage, and there is no route back — no
       superuser, and the API is the only way in. So the last owner does not leave. */
    const owners = (await o.auth.members(id)).filter(m => m.role === 'owner');
    if (owners.length === 1 && owners[0].userId === target) {
      return c.json({ error: 'the last owner cannot be removed — a site with no owner cannot be managed' }, 409);
    }

    const gone = await o.auth.revoke(id, target);
    if (!gone) return c.json({ error: 'they had no access to remove' }, 404);
    /* Their sessions stay valid and are harmless: access is checked per request against the
       membership, so a membership that is gone is access that is gone. */
    return c.json({ removed: target });
  });

  /* ---------------------------------------------------------------- the assets */

  app.get('/api/sites/:id/assets', async c => {
    const gate = await allowed(c, c.req.param('id'), 'read');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.json([]);
    return c.json((await o.assets.list(c.req.param('id'))).map(metaOf));
  });

  /* Uploading is a write, so a content account may do it: swapping a photograph is a content
     edit in every sense that matters. What it may not do is point an element at the new
     image — that is a prop, and `contentOnly` refuses it. Worth naming as the next thing to
     fix rather than a subtlety to enjoy. */
  app.post('/api/sites/:id/assets', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'write');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.json({ error: 'this server stores no assets' }, 501);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return c.json({ error: 'a file is required' }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: `too large — the limit is ${MAX_BYTES} bytes` }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    /* Sniffed, not trusted. A caller can put anything in Content-Type, and `image/png` on
       arbitrary bytes is a way to host arbitrary content on somebody else's domain. */
    const type = sniff(bytes);
    if (!type || !ALLOWED.has(type)) return c.json({ error: 'that is not an image this server serves' }, 415);
    const ownerId = await storageOwner(id, gate.user, gate.role);
    if (!ownerId) return c.json({ error: 'this site has no storage owner' }, 409);
    let output: OptimizedImage;
    try {
      output = await optimizeAsset(bytes, type);
    } catch {
      return c.json({
        error: 'image_optimization_failed',
        detail: 'Pagecraft could not optimize this image. Try exporting it as PNG, JPEG, WebP, or SVG.'
      }, 422);
    }
    let saved: AssetRecord;
    try {
      saved = await o.assets.put({
        siteId: id, name: optimizedName(file.name || 'image', output.extension),
        type: output.type, bytes: output.bytes, w: output.w, h: output.h,
        contentHash: sha256(bytes)
      }, {
        ownerId, limitBytes: FREE_STORAGE_BYTES,
        originalBytes: file.size, optimized: true
      });
    } catch (error) {
      if (error instanceof AssetQuotaError) {
        return c.json({
          error: 'storage_limit_reached', ...error.usage,
          detail: 'Your free account has used its 100 MB media allowance. Remove unused images and try again.'
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
  app.get('/api/sites/:id/assets/:aid', async c => {
    const gate = await allowed(c, c.req.param('id'), 'read');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.notFound();
    const a = await o.assets.get(c.req.param('id'), c.req.param('aid'));
    if (!a) return c.notFound();
    return c.body(a.bytes as unknown as ArrayBuffer, 200, {
      ...assetHeaders(a), 'cache-control': 'private, max-age=3600'
    });
  });

  app.delete('/api/sites/:id/assets/:aid', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'write');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.assets) return c.json({ error: 'this server stores no assets' }, 501);
    const aid = c.req.param('aid');
    const removed = await o.assets.remove(id, aid);
    if (!removed) return c.json({ error: 'no such asset' }, 404);
    /* A referenced image deliberately becomes the same placeholder the renderer uses for any
       missing id. The editor warns before that destructive choice; the API makes it durable. */
    built.delete(id);
    return c.json({ removed: aid });
  });

  /* -------------------------------------------------------- Manual WordPress import */

  const manualImportBearer = async (c: Context) => {
    const token = (c.req.header('authorization') || '').match(/^Bearer\s+([^\s]+)$/i)?.[1] || '';
    return token ? o.auth.manualImportByAccess(hashToken(token)) : null;
  };

  app.get('/v1/wordpress-import/authorize', async c => {
    if (!o.connected) return c.json({ error: 'manual import persistence is unavailable' }, 503);
    const user = await who(c);
    if (!user) return c.redirect(`/auth?next=${encodeURIComponent(new URL(c.req.url).pathname + new URL(c.req.url).search)}`, 302);
    const q = c.req.query();
    const installationId = String(q.installation_id || '');
    const redirectUri = String(q.redirect_uri || '');
    const codeChallenge = String(q.code_challenge || '');
    const state = String(q.state || '');
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(installationId)
      || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)
      || !/^[A-Za-z0-9_-]{16,256}$/.test(state)
      || String(q.code_challenge_method || '') !== 'S256') {
      return c.json({ error: 'installation, state, and PKCE S256 parameters are required' }, 400);
    }
    let redirect: URL;
    try {
      redirect = new URL(redirectUri);
      if ((redirect.protocol !== 'https:' && redirect.hostname !== 'localhost')
        || redirect.username || redirect.password || redirect.hash) throw new Error();
    } catch {
      return c.json({ error: 'redirect_uri must be an absolute HTTPS WordPress admin URL' }, 400);
    }
    const projects = (await visibleSites(user)).filter(item => item.role === 'owner');
    if (!projects.length) return c.json({ error: 'this account owns no Pagecraft projects' }, 403);
    const csrf = newToken();
    const consent: ManualImportConsent = {
      userId: user.id, installationId, redirectUri: redirect.href, codeChallenge, state
    };
    await o.connected.putGrant({
      digest: hashToken(csrf), kind: 'manual-import-consent', siteId: null, connectionId: null,
      payload: consent as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    return c.html(shell('Connect Pagecraft', `<h1>Let this WordPress site browse your Pagecraft pages?</h1>
      <p>This grants read-only, manual import access to ${projects.length} ${projects.length === 1 ? 'project' : 'projects'} you own.</p>
      <div class="ok"><strong>Independent copies only</strong><br><small>No webhooks, polling, background updates, or WordPress password access.</small></div>
      <form method="post" action="/v1/wordpress-import/authorize">
        <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <button type="submit">Approve manual import</button>
      </form>`));
  });

  app.post('/v1/wordpress-import/authorize', async c => {
    if (!o.connected) return c.json({ error: 'manual import persistence is unavailable' }, 503);
    const user = await who(c);
    if (!user) return c.json({ error: 'sign in' }, 401);
    const body = await c.req.parseBody().catch(() => null) as Record<string, unknown> | null;
    const grant = body?.csrf
      ? await o.connected.consumeGrant(hashToken(String(body.csrf)), 'manual-import-consent', new Date().toISOString())
      : null;
    const consent = grant?.payload as unknown as ManualImportConsent | undefined;
    if (!consent || consent.userId !== user.id) return c.json({ error: 'consent expired or already used' }, 400);
    const code = newToken();
    await o.connected.putGrant({
      digest: hashToken(code), kind: 'manual-import-code', siteId: null, connectionId: null,
      payload: consent as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    const redirect = new URL(consent.redirectUri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', consent.state);
    return c.redirect(redirect.href, 302);
  });

  app.post('/v1/wordpress-import/token', async c => {
    if (!o.connected) return c.json({ error: 'manual import persistence is unavailable' }, 503);
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const grantType = String(body?.grant_type || '');
    if (grantType === 'authorization_code') {
      const code = String(body?.code || '');
      const verifier = String(body?.code_verifier || '');
      const grant = code
        ? await o.connected.consumeGrant(hashToken(code), 'manual-import-code', new Date().toISOString()) : null;
      const consent = grant?.payload as unknown as ManualImportConsent | undefined;
      const challenge = base64url(new Uint8Array(Buffer.from(hashToken(verifier), 'hex')));
      if (!consent || consent.redirectUri !== String(body?.redirect_uri || '') || challenge !== consent.codeChallenge) {
        return c.json({ error: 'invalid_grant' }, 400);
      }
      const accessToken = newToken(), refreshToken = newToken(), expiresAt = Date.now() + 15 * 60 * 1000;
      const credential = await o.auth.createManualImportCredential({
        id: crypto.randomUUID(), ownerId: consent.userId, installationId: consent.installationId,
        accessTokenDigest: hashToken(accessToken), accessExpiresAt: expiresAt,
        refreshTokenDigest: hashToken(refreshToken)
      });
      return c.json({
        token_type: 'Bearer', access_token: accessToken, expires_in: 15 * 60,
        refresh_token: refreshToken, credential_id: credential.id, scope: 'projects:read packages:read'
      });
    }
    if (grantType === 'refresh_token') {
      const refreshToken = String(body?.refresh_token || '');
      const credential = await o.auth.manualImportByRefresh(hashToken(refreshToken));
      if (!credential) return c.json({ error: 'invalid_grant', reconnect: true }, 401);
      const accessToken = newToken(), expiresAt = Date.now() + 15 * 60 * 1000;
      const rotated = await o.auth.rotateManualImportAccess(credential.id, hashToken(accessToken), expiresAt);
      if (!rotated) return c.json({ error: 'invalid_grant', reconnect: true }, 401);
      return c.json({ token_type: 'Bearer', access_token: accessToken, expires_in: 15 * 60 });
    }
    return c.json({ error: 'unsupported_grant_type' }, 400);
  });

  app.get('/v1/wordpress-import/projects', async c => {
    const credential = await manualImportBearer(c);
    if (!credential) return c.json({ error: 'unauthorized', reconnect: true }, 401);
    const memberships = (await o.auth.membershipsForUser(credential.ownerId)).filter(item => item.role === 'owner');
    const allowedIds = new Set(memberships.map(item => item.siteId));
    const projects = (await o.store.listMeta()).filter(site => allowedIds.has(site.id)).map(site => ({
      id: site.id, name: site.name, pageCount: 0, modifiedAt: site.updatedAt, sourceVersion: site.version
    }));
    for (const project of projects) {
      const site = await o.store.byId(project.id);
      project.pageCount = site?.doc.pages.length || 0;
    }
    return c.json({ projects });
  });

  const manualImportSite = async (credential: { ownerId:string }, siteId: string) => {
    const membership = await o.auth.membership(siteId, credential.ownerId);
    return membership?.role === 'owner' ? o.store.byId(siteId) : null;
  };

  app.get('/v1/wordpress-import/projects/:id/pages', async c => {
    const credential = await manualImportBearer(c);
    if (!credential) return c.json({ error: 'unauthorized', reconnect: true }, 401);
    const site = await manualImportSite(credential, c.req.param('id'));
    if (!site) return c.notFound();
    const base = shareUrl(c, o, site);
    return c.json({ project: { id: site.id, name: site.name, sourceVersion: site.version }, pages: site.doc.pages.map(page => ({
      id: page.id, name: page.name || page.title || 'Untitled page', slug: page.slug,
      previewUrl: new URL(page.slug === 'index' ? './' : `./${page.slug}`, base).href,
      modifiedAt: site.updatedAt, sourceVersion: site.version
    })) });
  });

  app.get('/v1/wordpress-import/projects/:id/pages/:pageId/package', async c => {
    const credential = await manualImportBearer(c);
    if (!credential) return c.json({ error: 'unauthorized', reconnect: true }, 401);
    const site = await manualImportSite(credential, c.req.param('id'));
    if (!site) return c.notFound();
    try {
      const pageId = c.req.param('pageId');
      const assetIds = new Set(portableAssetIds(site.doc, pageId));
      return portableDownload(c, createPagePackage({
        document: site.doc, pageId, assets: await assetBodiesOf(site.id, assetIds),
        provenance: {
          format: 'pagecraft.provenance.v1', origin: 'pagecraft-cloud', sourceId: site.id,
          sourceVersion: site.version, exportedBy: credential.ownerId
        }
      }));
    } catch (error) {
      return c.json({ error: (error as Error).message }, 422);
    }
  });

  app.post('/v1/wordpress-import/revoke', async c => {
    const body = await c.req.json().catch(() => null) as { refresh_token?:string; credential_id?:string } | null;
    const refreshDigest = hashToken(String(body?.refresh_token || ''));
    const credential = await o.auth.manualImportByRefresh(refreshDigest);
    if (!credential || credential.id !== String(body?.credential_id || '')) return c.json({ revoked: true });
    await o.auth.revokeManualImportCredential(credential.id, refreshDigest);
    return c.json({ revoked: true });
  });

  /* -------------------------------------------------------- Retained Connected WordPress checkpoint */

  app.get('/v1/oauth/authorize', async c => {
    if (!o.connected) return releaseUnavailable(c);
    const q = c.req.query();
    const user = await who(c);
    if (!user) return c.redirect(`/auth?next=${encodeURIComponent(new URL(c.req.url).pathname + new URL(c.req.url).search)}`, 302);
    const exact = (camel: string, snake?: string) => {
      const a = q[camel], b = snake ? q[snake] : undefined;
      if (a && b && a !== b) throw new Error(`${camel} was supplied twice with different values`);
      return String(a || b || '');
    };
    let siteId = '', installationId = '', environment = '', profile = '', targetOrigin = '',
      targetPath = '', redirectUri = '', webhookUrl = '', codeChallenge = '', state = '', scope = '';
    try {
      siteId = exact('siteId', 'site_id');
      installationId = exact('installationId', 'installation_id');
      environment = exact('environment');
      profile = exact('profile');
      targetOrigin = exact('targetOrigin', 'target_origin');
      targetPath = exact('targetPath', 'target_path');
      redirectUri = exact('redirectUri', 'redirect_uri');
      webhookUrl = exact('webhookUrl', 'webhook_url');
      codeChallenge = exact('codeChallenge', 'code_challenge');
      state = exact('state');
      scope = exact('scope');
      if (exact('codeChallengeMethod', 'code_challenge_method') !== 'S256') throw new Error('PKCE S256 is required');
    } catch (error) {
      return c.json({ error: String((error as Error).message) }, 400);
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
      return c.json({ error: 'PKCE S256 codeChallenge is required' }, 400);
    }
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(installationId)) {
      return c.json({ error: 'a stable installationId is required' }, 400);
    }
    if (environment !== 'staging' && environment !== 'production') {
      return c.json({ error: 'environment must be staging or production' }, 400);
    }
    if (profile !== 'pagecraft-theme' && profile !== 'existing-theme') {
      return c.json({ error: 'profile must be pagecraft-theme or existing-theme' }, 400);
    }
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(state)) {
      return c.json({ error: 'OAuth state is required' }, 400);
    }
    const requiredScopes = ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'];
    const scopes = [...new Set(scope.split(/[\s,]+/).filter(Boolean))].sort();
    if (scopes.join(' ') !== [...requiredScopes].sort().join(' ')) {
      return c.json({ error: `scope must be exactly: ${requiredScopes.join(' ')}` }, 400);
    }
    let redirect: URL, webhook: URL;
    try {
      targetOrigin = canonicalOrigin(targetOrigin);
      targetPath = canonicalTargetPath(targetPath || '/');
      redirect = new URL(redirectUri);
      if (redirect.origin !== targetOrigin || (redirect.protocol !== 'https:' && redirect.hostname !== 'localhost')) {
        throw new Error('redirectUri must belong to the paired HTTPS origin');
      }
      if (redirect.username || redirect.password || redirect.hash) throw new Error('redirectUri may not contain credentials or a fragment');
      webhook = new URL(webhookUrl);
      if (webhook.origin !== targetOrigin || webhook.username || webhook.password || webhook.search || webhook.hash
        || !webhook.pathname.endsWith('/wp-json/pagecraft/v1/releases/available')) {
        throw new Error('webhookUrl must be the Pagecraft REST endpoint on the paired origin');
      }
    } catch (error) {
      return c.json({ error: String((error as Error).message) }, 400);
    }
    const projects = (await visibleSites(user)).filter(item => roleAllows(item.role, 'admin'));
    if (!projects.length) return c.json({ error: 'no project can be connected by this account' }, 403);
    if (siteId && !projects.some(item => item.site.id === siteId)) return c.notFound();
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
        scopes: requiredScopes
      }
    };
    await o.connected.putGrant({
      digest: hashToken(csrf), kind: 'oauth-consent', siteId: siteId || null,
      connectionId: null, payload: consent as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    const options = projects.map(item => `<option value="${escapeHtml(item.site.id)}"${item.site.id === siteId ? ' selected' : ''}>${escapeHtml(item.site.name)}</option>`).join('');
    return c.html(shell('Connect WordPress', `<h1>Connect this WordPress site?</h1>
      <p>Review the exact destination and choose the Pagecraft project. Nothing is connected until you approve.</p>
      <div class="ok"><strong>${escapeHtml(targetOrigin + targetPath)}</strong><br>
      <small>${escapeHtml(environment)} · ${escapeHtml(profile)}<br>${requiredScopes.map(escapeHtml).join(' · ')}</small></div>
      <form method="post" action="/v1/oauth/authorize">
        <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <label for="siteId">Pagecraft project</label>
        <select id="siteId" name="siteId" required>${options}</select>
        <button type="submit">Approve connection</button>
      </form>`));
  });

  app.post('/v1/oauth/authorize', async c => {
    if (!o.connected) return releaseUnavailable(c);
    const user = await who(c);
    if (!user) return c.json({ error: 'sign in' }, 401);
    const body = await c.req.parseBody().catch(() => null) as Record<string, unknown> | null;
    const csrf = String(body?.csrf || '');
    const grant = csrf
      ? await o.connected.consumeGrant(hashToken(csrf), 'oauth-consent', new Date().toISOString())
      : null;
    const consent = grant?.payload as unknown as OAuthConsent | undefined;
    if (!consent || consent.userId !== user.id) {
      return c.json({ error: 'consent expired or already used' }, 400);
    }
    const siteId = String(body?.siteId || '');
    const membership = await o.auth.membership(siteId, user.id);
    if (!membership || !roleAllows(membership.role, 'admin')) return c.notFound();
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
        status: 'pending',
        codeChallenge: request.codeChallenge,
        authorizationCodeDigest: hashToken(code),
        authorizationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
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
        activeHash: null
      });
    } catch (error) {
      return c.json({ error: String((error as Error).message) }, 409);
    }
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', request.state);
    return c.redirect(redirect.href, 302);
  });

  app.post('/v1/oauth/token', async c => {
    if (!releaseReady()) return releaseUnavailable(c);
    const contentType = c.req.header('content-type') || '';
    const body = contentType.includes('application/json')
      ? await c.req.json().catch(() => null) as Record<string, unknown> | null
      : await c.req.parseBody().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'invalid_request' }, 400);
    const grantType = String(body.grant_type || body.grantType || '');
    const tokenReply = (connection: WordPressConnection, accessToken: string, refreshToken?: string) => {
      const here = o.editorOrigin || new URL(c.req.url).origin;
      return {
        tokenType: 'Bearer', accessToken, expiresIn: 15 * 60,
        ...(refreshToken ? { refreshToken } : {}),
        connectionId: connection.id, siteId: connection.siteId, scopes: connection.scopes,
        environment: connection.environment, profile: connection.profile,
        editorSessionUrl: `${here}/v1/connections/${encodeURIComponent(connection.id)}/editor-sessions`,
        keysetEnvelope: o.keysetEnvelope
      };
    };
    if (grantType === 'authorization_code') {
      const code = String(body.code || '');
      const verifier = String(body.code_verifier || body.codeVerifier || '');
      const digest = hashToken(code);
      const now = new Date().toISOString();
      const pending = await o.connected!.authorizationConnection(digest, now);
      if (!pending || pending.redirectUri !== String(body.redirect_uri || body.redirectUri || '')) {
        return c.json({ error: 'invalid_grant' }, 400);
      }
      const challenge = base64url(new Uint8Array(Buffer.from(hashToken(verifier), 'hex')));
      if (challenge !== pending.codeChallenge) return c.json({ error: 'invalid_grant' }, 400);
      const consumed = await o.connected!.useAuthorizationCode(digest, now);
      if (!consumed) return c.json({ error: 'invalid_grant' }, 400);
      const accessToken = oauthCredential('access', consumed.id, code, verifier);
      const refreshToken = oauthCredential('refresh', consumed.id, code, verifier);
      const provisioned = await o.connected!.provisionConnection(consumed.id, {
        accessTokenDigest: hashToken(accessToken),
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        refreshTokenDigest: hashToken(refreshToken),
        confirmationExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });
      if (!provisioned) return c.json({ error: 'invalid_grant' }, 400);
      return c.json(tokenReply(provisioned, accessToken, refreshToken));
    }
    if (grantType === 'refresh_token') {
      const connection = await o.connected!.connectionByRefreshToken(hashToken(String(body.refresh_token || body.refreshToken || '')));
      if (!connection) return c.json({ error: 'invalid_grant' }, 400);
      const accessToken = newToken();
      const rotated = await o.connected!.rotateAccessToken(
        connection.id, hashToken(accessToken), new Date(Date.now() + 15 * 60 * 1000).toISOString());
      if (!rotated) return c.json({ error: 'invalid_grant' }, 400);
      return c.json(tokenReply(rotated, accessToken));
    }
    return c.json({ error: 'unsupported_grant_type' }, 400);
  });

  app.post('/v1/connections/:id/confirm', async c => {
    if (!o.connected) return c.json({ error: 'connected persistence is unavailable' }, 503);
    const bearer = (c.req.header('authorization') || '').match(/^Bearer\s+([^\s]+)$/i)?.[1] || '';
    const idempotencyKey = String(c.req.header('idempotency-key') || '');
    if (!bearer) return c.json({ error: 'unauthorized' }, 401);
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
      return c.json({ error: 'a stable Idempotency-Key header is required' }, 400);
    }
    const body = await c.req.json().catch(() => null) as { installationId?: string } | null;
    if (!body?.installationId) return c.json({ error: 'installationId is required' }, 400);
    const result = await o.connected.confirmConnection({
      id: c.req.param('id'), accessTokenDigest: hashToken(bearer),
      installationId: body.installationId, now: new Date().toISOString()
    });
    if (!result) return c.json({ error: 'unauthorized or expired confirmation' }, 401);
    return c.json({
      connectionId: result.connection.id, status: 'active',
      confirmedAt: result.connection.confirmedAt, alreadyConfirmed: result.alreadyConfirmed
    });
  });

  app.post('/v1/connections/:id/editor-sessions', async c => {
    const connection = await bearerConnection(c);
    if (!connection || connection.id !== c.req.param('id') || !connection.scopes.includes('editor:open')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const body = await c.req.json().catch(() => null) as {
      installationId?: string; pageId?: string; returnUrl?: string;
    } | null;
    if (!body || body.installationId !== connection.installationId) {
      return c.json({ error: 'installationId does not match this connection' }, 403);
    }
    let returnUrl: string | null = null;
    if (body.returnUrl) {
      try {
        const candidate = new URL(body.returnUrl);
        if (candidate.origin !== connection.targetOrigin || candidate.username || candidate.password) throw new Error();
        returnUrl = candidate.href;
      } catch {
        return c.json({ error: 'returnUrl must belong to the paired WordPress origin' }, 400);
      }
    }
    const code = newToken(), expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    await o.connected!.putGrant({
      digest: hashToken(code), kind: 'editor-code', siteId: connection.siteId,
      connectionId: connection.id,
      payload: {
        installationId: connection.installationId, targetOrigin: connection.targetOrigin,
        ownerId: connection.createdBy,
        pageId: body.pageId ? String(body.pageId).slice(0, 160) : null,
        returnUrl
      },
      expiresAt
    });
    const here = o.editorOrigin || new URL(c.req.url).origin;
    return c.json({
      url: `${here}/v1/editor/session?code=${encodeURIComponent(code)}`,
      expiresAt
    }, 201);
  });

  app.get('/v1/editor/session', async c => {
    const code = c.req.query('code') || '';
    const digest = hashToken(code);
    const grant = code && o.connected
      ? await o.connected.consumeGrant(digest, 'editor-code', new Date().toISOString())
      : null;
    const ticket = grant ? {
      connectionId: grant.connectionId!, siteId: grant.siteId!,
      installationId: String(grant.payload.installationId || ''),
      targetOrigin: String(grant.payload.targetOrigin || ''),
      ownerId: String(grant.payload.ownerId || ''),
      pageId: grant.payload.pageId == null ? null : String(grant.payload.pageId),
      returnUrl: grant.payload.returnUrl == null ? null : String(grant.payload.returnUrl)
    } : null;
    if (!ticket) return c.json({ error: 'editor code expired or already used' }, 401);
    let browserOrigin = '';
    try {
      const supplied = c.req.header('origin') || c.req.header('referer') || '';
      browserOrigin = new URL(supplied).origin;
    } catch { /* fail closed below */ }
    if (browserOrigin !== ticket.targetOrigin) return c.json({ error: 'editor code belongs to another origin' }, 403);
    const connection = await o.connected?.connection(ticket.connectionId);
    if (!connection || connection.status !== 'active' || connection.installationId !== ticket.installationId) {
      return c.json({ error: 'connection is no longer active' }, 401);
    }
    const site = await o.store.byId(connection.siteId);
    if (!site || !o.editorHtml) return c.notFound();
    const editorSessionToken = newToken();
    const editorSessionExpiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    await o.connected!.putEditorCredential({
      digest: hashToken(editorSessionToken), connectionId: connection.id, siteId: connection.siteId,
      ownerId: ticket.ownerId, expiresAt: editorSessionExpiresAt
    });
    c.header('content-security-policy', `frame-ancestors ${connection.targetOrigin}; base-uri 'none'; object-src 'none'`);
    c.header('vary', 'Origin, Referer');
    c.header('cache-control', 'private, no-store');
    return c.html(inject(o.editorHtml, {
      siteId: site.id, host: site.host, slug: site.slug, name: site.name,
      url: shareUrl(c, o, site), version: site.version,
      publishedVersion: site.publishedVersion, schemaVersion: site.doc.schemaVersion,
      role: 'owner', doc: site.doc, connectionId: connection.id,
      editorSessionToken, editorSessionExpiresAt,
      pageId: ticket.pageId, returnUrl: ticket.returnUrl,
      wordpressContent: await wordpressContentForSite(site.id)
    }));
  });

  app.put('/v1/connections/:id/content-index', async c => {
    const connection = await bearerConnection(c);
    if (!connection || connection.id !== c.req.param('id') || !connection.scopes.includes('content:index')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const body = await c.req.json().catch(() => null) as {
      installationId?: string; generation?: number; items?: unknown[];
    } | null;
    if (!body || body.installationId !== connection.installationId) {
      return c.json({ error: 'installationId does not match this connection' }, 403);
    }
    if (!Number.isSafeInteger(body.generation) || Number(body.generation) < 1) {
      return c.json({ error: 'generation must be a positive safe integer' }, 400);
    }
    if (!Array.isArray(body.items) || body.items.length > 2000) {
      return c.json({ error: 'items must be an array containing at most 2000 entries' }, 400);
    }
    const items: WordPressContentIndexItem[] = [];
    const ids = new Set<string>();
    for (const raw of body.items) {
      if (!raw || typeof raw !== 'object') return c.json({ error: 'every content item must be an object' }, 400);
      const item = raw as Record<string, unknown>;
      const id = String(item.id || '').trim();
      const objectType = String(item.objectType || '');
      const title = String(item.title || '').trim();
      const urlText = String(item.url || '').trim();
      const modified = new Date(String(item.modifiedAt || ''));
      if (!/^[A-Za-z0-9._:-]{1,160}$/.test(id) || ids.has(id)) {
        return c.json({ error: 'content item IDs must be unique stable identifiers' }, 400);
      }
      if (objectType !== 'page' && objectType !== 'post') {
        return c.json({ error: 'content item objectType must be page or post' }, 400);
      }
      if (!title || title.length > 240 || /[\u0000-\u001f\u007f]/.test(title)) {
        return c.json({ error: 'content item titles must be 1 to 240 visible characters' }, 400);
      }
      let url: URL;
      try { url = new URL(urlText); } catch { return c.json({ error: 'content item URLs must be absolute' }, 400); }
      const pathRoot = connection.targetPath === '/' ? '/' : connection.targetPath.replace(/\/$/, '');
      if (url.origin !== connection.targetOrigin || url.username || url.password || url.hash || url.search
        || (url.protocol !== 'https:' && url.hostname !== 'localhost')
        || (pathRoot !== '/' && url.pathname !== pathRoot && !url.pathname.startsWith(`${pathRoot}/`))
        || url.href.length > 2048) {
        return c.json({ error: 'content item URLs must belong to the paired WordPress target' }, 400);
      }
      if (Number.isNaN(modified.getTime())) {
        return c.json({ error: 'content item modifiedAt must be an ISO date' }, 400);
      }
      ids.add(id);
      items.push({ id, objectType, title, url: url.href, modifiedAt: modified.toISOString() });
    }
    items.sort((a, b) => utf8ByteCompare(a.objectType, b.objectType)
      || utf8ByteCompare(a.title, b.title) || utf8ByteCompare(a.id, b.id));
    const generation = Number(body.generation);
    const result = await o.connected!.replaceWordPressContentIndex({
      connectionId: connection.id, generation,
      bodyHash: sha256(new TextEncoder().encode(canonicalJson({ generation, items }))),
      items, syncedAt: new Date().toISOString()
    });
    if (!result.ok) {
      if (result.error === 'unknown-connection' || result.error === 'connection-inactive') {
        return c.json({ error: result.error }, 401);
      }
      return c.json({ error: result.error }, 409);
    }
    return c.json({
      generation: result.snapshot.generation, itemCount: result.snapshot.items.length,
      syncedAt: result.snapshot.syncedAt, duplicate: result.duplicate
    }, result.duplicate ? 200 : 201);
  });

  app.get('/v1/sites/:id/wordpress-content', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    if (!await o.store.byId(id)) return deny(c, 404);
    return c.json({ targets: await wordpressContentForSite(id) });
  });

  const portableDownload = (c: Context, pkg: ReturnType<typeof createSitePackage>) => c.body(
    pkg.bytes as unknown as ArrayBuffer, 200, {
      'content-type': 'application/zip',
      'content-length': String(pkg.bytes.byteLength),
      'content-disposition': `attachment; filename="${pkg.filename}"`,
      'x-pagecraft-content-sha256': pkg.sha256,
      'cache-control': 'private, no-store'
    }
  );

  app.get('/v1/sites/:id/packages/site', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    try {
      const assetIds = new Set(portableAssetIds(site.doc));
      return portableDownload(c, createSitePackage({
        document: site.doc,
        assets: await assetBodiesOf(id, assetIds),
        provenance: {
          format: 'pagecraft.provenance.v1', origin: 'pagecraft-cloud',
          sourceId: site.id, sourceVersion: site.version, exportedBy: gate.user.id
        }
      }));
    } catch (error) {
      return c.json({ error: (error as Error).message }, 422);
    }
  });

  app.get('/v1/sites/:id/packages/pages/:pageId', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    try {
      const pageId = c.req.param('pageId');
      const assetIds = new Set(portableAssetIds(site.doc, pageId));
      return portableDownload(c, createPagePackage({
        document: site.doc,
        pageId,
        assets: await assetBodiesOf(id, assetIds),
        provenance: {
          format: 'pagecraft.provenance.v1', origin: 'pagecraft-cloud',
          sourceId: site.id, sourceVersion: site.version, exportedBy: gate.user.id
        }
      }));
    } catch (error) {
      return c.json({ error: (error as Error).message }, 422);
    }
  });

  app.get('/v1/sites/:id/connections', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.connected) return c.json({ connections: [] });
    return c.json({ connections: (await o.connected.connectionsForSite(id)).map(publicConnection) });
  });

  app.get('/v1/sites/:id/releases', async c => {
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'read');
    if (!gate.ok) return deny(c, gate.status);
    if (!o.connected) return c.json({ publishedVersion: null, releases: [] });
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const [releases, connections] = await Promise.all([
      o.connected.releasesForSite(id), o.connected.connectionsForSite(id)
    ]);
    const out = await Promise.all(releases.map(async release => {
      const deployments = await o.connected!.deploymentsForRelease(release.id);
      return {
        releaseId: release.id, sequence: release.sequence, sourceVersion: release.sourceVersion,
        schemaVersion: release.schemaVersion, parentReleaseId: release.parentReleaseId,
        artifactHash: release.artifactHash, audit: release.audit, createdAt: release.createdAt,
        targets: connections.map(connection => {
          const history = deployments.filter(item => item.connectionId === connection.id);
          return {
            connection: publicConnection(connection),
            desired: connection.desiredReleaseId === release.id,
            pending: connection.pendingReleaseId === release.id,
            active: connection.activeReleaseId === release.id,
            status: history.at(-1)?.status || null,
            detail: history.at(-1)?.detail || null,
            updatedAt: history.at(-1)?.createdAt || null
          };
        })
      };
    }));
    return c.json({
      draftVersion: site.version, publishedVersion: site.publishedVersion,
      publishedReleaseId: site.publishedReleaseId, releases: out
    });
  });

  app.post('/v1/sites/:id/releases', async c => {
    if (!releaseReady()) return releaseUnavailable(c);
    const id = c.req.param('id');
    const gate = await allowed(c, id, 'admin');
    if (!gate.ok) return deny(c, gate.status);
    const site = await o.store.byId(id);
    if (!site) return deny(c, 404);
    const body = await c.req.json().catch(() => null) as {
      sourceVersion?: number; idempotencyKey?: string; acknowledgeWarnings?: boolean;
    } | null;
    const sourceVersion = body?.sourceVersion ?? site.version;
    const idempotencyKey = String(body?.idempotencyKey || c.req.header('idempotency-key') || '');
    if (!Number.isInteger(sourceVersion) || sourceVersion < 1 || !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
      return c.json({ error: 'sourceVersion and a stable idempotencyKey are required' }, 400);
    }
    /* If a prior worker committed the hosted pointer but lost the response before recording
       the delivery finalization, reconcile that safe ordering edge before reserving a child. */
    if (site.publishedReleaseId) {
      try {
        if (!await o.connected!.markReleasePublished(site.publishedReleaseId, site.updatedAt)) {
          return c.json({ error: 'the current public release has an invalid finalization state' }, 409);
        }
      } catch (error) {
        c.header('retry-after', '5');
        return c.json({
          error: 'the current publication is still being finalized', retryable: true,
          detail: String((error as Error).message)
        }, 503);
      }
    }
    const revision = await o.store.revision(id, sourceVersion);
    if (!revision) return c.json({ error: 'no such source revision' }, 404);
    let document: Doc | null = null;
    try { document = adopt(revision.doc); } catch (error) {
      return c.json({ error: 'invalid document', detail: String((error as Error).message) }, 422);
    }
    if (!document) return c.json({ error: 'newer schema', detail: 'This release needs a newer Pagecraft server.' }, 409);
    const [connections, connectionHistory] = await Promise.all([
      o.connected!.connectionsForSite(id), o.connected!.connectionHistoryForSite(id)
    ]);
    const activeConnections = connections.filter(connection => connection.status === 'active');
    if (new Set(activeConnections.map(connection => connection.profile)).size > 1) {
      return c.json({
        error: 'incompatible WordPress setup profiles',
        detail: 'Staging and production must both use Existing Theme or both use Pagecraft Theme.'
      }, 409);
    }
    /* The first Connected picker stored an absolute indexed permalink. Compile those
       exact legacy values through the same target-neutral contract as new editor writes,
       so an untouched staging selection cannot enter the production release. */
    const indexedWordPressTargets = await wordpressContentForSite(id);
    const migratedWordPressLinks = migrateIndexedWordPressLinks(document, connectionHistory.map(connection => {
      const indexed = indexedWordPressTargets.find(target => target.connectionId === connection.id);
      return {
        targetOrigin: connection.targetOrigin,
        targetPath: connection.targetPath,
        items: indexed?.items || []
      };
    }));
    if (migratedWordPressLinks.unsafeTargetUrls.length) return c.json({
      error: 'Connected WordPress link preflight failed',
      errorCodes: ['wordpress-link-target-specific'],
      detail: 'A link still points directly at a paired WordPress target but is not in its current content index. Choose a current WordPress page or post in Pagecraft, or replace it with a portable custom destination.',
      urls: migratedWordPressLinks.unsafeTargetUrls
    }, 422);
    document = migratedWordPressLinks.document;
    const stylesheetIssues = [...new Set([
      ...authoredStylesheetIssues(document), ...authoredCssAtRuleIssues(document)
    ])].sort();
    if (stylesheetIssues.length) return c.json({
      error: 'release stylesheet preflight failed',
      errorCodes: stylesheetIssues,
      detail: 'Connected releases cannot reference stylesheet bytes that are not frozen into the signed artifact.'
    }, 422);
    if (activeConnections.some(connection => connection.profile === 'existing-theme')) {
      const cssIssues = existingThemeCssIssues(document);
      if (cssIssues.length) return c.json({
        error: 'Existing Theme CSS preflight failed',
        errorCodes: cssIssues,
        detail: 'Authored global CSS must be isolated before this release can enter an existing WordPress theme.'
      }, 422);
    }
    const assetMetadata = await assetsOf(id);
    const rendered = render(document, assetMetadata);
    if (releaseStylesheetLinks(rendered.files).length) {
      try {
        rendered.files = await freezeGoogleFontStylesheets(rendered.files, o.fontFetch || fetch);
      } catch (error) {
        return c.json({
          error: 'release stylesheet preflight failed',
          errorCodes: ['font-freeze-failed'],
          detail: String((error as Error).message)
        }, 422);
      }
    }
    const linkedStylesheets = releaseStylesheetLinks(rendered.files);
    if (linkedStylesheets.length) return c.json({
      error: 'release stylesheet preflight failed',
      errorCodes: ['unfrozen-stylesheet'], stylesheets: linkedStylesheets,
      detail: 'The renderer left a stylesheet outside the signed artifact.'
    }, 422);
    const errors = rendered.findings.filter(finding => finding.level === 'error');
    const warnings = rendered.findings.filter(finding => finding.level === 'warn');
    const errorCodes = [...new Set(errors.map(finding => finding.code))].sort();
    const warningCodes = [...new Set(warnings.map(finding => finding.code))].sort();
    if (errors.length) return c.json({
      error: 'release validation failed', errorCount: errors.length, errorCodes,
      findings: errors.map(finding => ({ code: finding.code, message: finding.msg, where: finding.where }))
    }, 422);
    if (warnings.length && body?.acknowledgeWarnings !== true) return c.json({
      error: 'warning acknowledgement required', warningCount: warnings.length, warningCodes,
      findings: warnings.map(finding => ({ code: finding.code, message: finding.msg, where: finding.where }))
    }, 409);
    const production = activeConnections.find(connection => connection.environment === 'production');
    const staging = activeConnections.find(connection => connection.environment === 'staging');
    if (production && !staging) return c.json({
      error: 'a staging connection is required',
      detail: 'Connected v1 promotes the identical signed release through staging before production.'
    }, 409);
    const assets = await assetBodiesOf(id, releaseAssetIds(document, rendered.files, assetMetadata));
    const proposedReleaseId = crypto.randomUUID();
    let builtRelease: ReturnType<typeof buildReleaseArtifact>;
    try {
      builtRelease = buildReleaseArtifact({
        releaseId: proposedReleaseId, siteId: id, sourceVersion, document, files: rendered.files, assets
      });
    } catch (error) {
      return c.json({ error: 'release compilation failed', detail: String((error as Error).message) }, 422);
    }
    /* Compile before reserving a sequence so a deterministic validation failure cannot leave
       a permanent hole in the ordered target queue. An idempotent retry may recover an older
       reserved release id; rebuild only in that case because the id is itself signed content. */
    let reservation;
    try {
      reservation = await o.connected!.reserveRelease({
        siteId: id, idempotencyKey, releaseId: proposedReleaseId, createdBy: gate.user.id
      });
    } catch (error) {
      const detail = String((error as Error).message);
      if (/still being finalized|retry shortly/i.test(detail)) {
        c.header('retry-after', '5');
        return c.json({
          error: 'another release is still being finalized', retryable: true,
          detail: 'Retry this same publish after the in-progress release finishes or its lease expires.'
        }, 409);
      }
      return c.json({ error: 'release sequence could not be reserved', detail }, 409);
    }
    const releaseId = reservation.releaseId;
    const createdAt = reservation.createdAt;
    if (releaseId !== proposedReleaseId) {
      builtRelease = buildReleaseArtifact({
        releaseId, siteId: id, sourceVersion, document, files: rendered.files, assets
      });
    }
    const audit: ReleaseAudit = {
      acknowledgeWarnings: body?.acknowledgeWarnings === true,
      warningCodes, warningCount: warnings.length, errorCodes, errorCount: errors.length
    };
    const manifest = manifestForRelease({
      releaseId, siteId: id, sequence: reservation.sequence, sourceVersion, schemaVersion: document.schemaVersion,
      parentReleaseId: reservation.parentReleaseId, createdAt, audit, built: builtRelease
    });
    const signed = signReleaseManifest(manifest, o.releaseSigning!);
    const proposed: SiteRelease = {
      id: releaseId, siteId: id, sequence: reservation.sequence, sourceVersion, schemaVersion: document.schemaVersion,
      parentReleaseId: reservation.parentReleaseId, artifactHash: builtRelease.artifactHash,
      artifactBytes: builtRelease.artifactBytes.byteLength, artifact: builtRelease.artifactBytes,
      hostedFiles: [...rendered.files].sort(([a], [b]) => utf8ByteCompare(a, b)).map(([path, content]) => {
        const bytes = new TextEncoder().encode(content);
        return { path, content, bytes: bytes.byteLength, hash: sha256(bytes) };
      }),
      manifest: signed.manifest, manifestHash: sha256(fromBase64url(signed.manifest)),
      signature: signed.signature, keyId: signed.keyId,
      files: builtRelease.files, pages: builtRelease.pages, cms: builtRelease.cms,
      assets: builtRelease.assets, scripts: builtRelease.scripts,
      audit, idempotencyKey, createdBy: gate.user.id, createdAt
    };
    let made: { release: SiteRelease; created: boolean };
    try { made = await o.connected!.createRelease(proposed); }
    catch (error) { return c.json({ error: String((error as Error).message) }, 409); }
    if (!made.created && (made.release.sourceVersion !== sourceVersion
      || JSON.stringify(made.release.audit) !== JSON.stringify(audit))) {
      return c.json({ error: 'idempotency key was already used for a different release' }, 409);
    }
    /* The hosted pointer is the canonical commit and deliberately precedes both the durable
       publication marker and every target/webhook mutation. Store.publish is a monotonic CAS,
       so a delayed lower sequence is a successful no-op rather than a hosted rollback. */
    let published;
    try {
      published = await o.connected!.commitReleasePublication({
        siteId: id, releaseId: made.release.id, sourceVersion: made.release.sourceVersion,
        releaseSequence: made.release.sequence, publishedAt: new Date().toISOString()
      }, () => o.store.publish(
        id, made.release.sourceVersion, made.release.id, made.release.sequence
      ));
    } catch (error) {
      /* The immutable artifact is left unfinalized. Release traversal and target creation
         exclude it, and a later publish gives the stale identity a terminal tombstone. */
      return c.json({
        error: 'source revision could not be published', retryable: true,
        detail: String((error as Error).message)
      }, 503);
    }
    if (!published) return c.json({ error: 'source revision could not be published' }, 409);
    built.delete(id);
    let reconciliation: { status: 'not-required' | 'issued' | 'pending'; detail?: string } = {
      status: activeConnections.some(connection => connection.environment === 'staging')
        ? 'pending' : 'not-required'
    };
    try {
      if (published.publishedReleaseId !== made.release.id) {
        reconciliation = {
          status: 'not-required', detail: 'A newer release already owns the public pointer.'
        };
      } else if (await stageReleaseIfIdle(made.release, activeConnections)) {
        reconciliation = { status: 'issued' };
      }
    } catch (error) {
      /* The release and public pointer are already durable. Polling and an idempotent Publish
         retry reconcile target creation/queueing without turning a committed publication into
         a reported failure that invites the owner to publish different content. */
      reconciliation = { status: 'pending', detail: String((error as Error).message) };
      console.error('WordPress release delivery is pending:', (error as Error).message);
    }
    return c.json({
      releaseId: made.release.id, sequence: made.release.sequence,
      sourceVersion: made.release.sourceVersion, schemaVersion: made.release.schemaVersion,
      publishedVersion: published.publishedVersion, artifactHash: made.release.artifactHash,
      audit: made.release.audit, createdAt: made.release.createdAt,
      reconciliation,
      targets: (await o.connected!.connectionsForSite(id)).map(publicConnection)
    }, made.created ? 201 : 200);
  });

  app.get('/v1/connections/:id/desired-release', async c => {
    if (!releaseReady()) return releaseUnavailable(c);
    let connection = await bearerConnection(c);
    if (!connection || connection.id !== c.req.param('id')) return c.json({ error: 'unauthorized' }, 401);
    if (connection.environment === 'production') {
      const staging = (await o.connected!.connectionsForSite(connection.siteId)).find(item =>
        item.environment === 'staging' && item.status === 'active');
      if (staging && staging.profile !== connection.profile) {
        return c.json({
          error: 'incompatible WordPress setup profiles',
          detail: 'Staging and production must use the same Connected setup profile.'
        }, 409);
      }
    }
    /* `pendingReleaseId` is a durable promotion job. Production polling reconciles a worker
       failure that happened after staging committed live but before its target was issued. */
    if (connection.environment === 'production' && connection.pendingReleaseId
      && !connection.desiredReleaseId && connection.activeReleaseId !== connection.pendingReleaseId) {
      const pending = await o.connected!.release(connection.pendingReleaseId);
      if (!pending) return c.json({ error: 'pending release no longer exists' }, 409);
      try {
        await issueTarget(pending, connection, true);
      } catch (error) {
        c.header('retry-after', '5');
        return c.json({
          error: 'production promotion is pending', retryable: true,
          detail: String((error as Error).message)
        }, 503);
      }
      connection = await o.connected!.connection(connection.id) || connection;
    }
    /* A production target can be paired after staging is already live, so there may be no
       pending pointer from the original staging acknowledgement. Polling is the durable
       reconciliation path: derive only from staging's *current* active release, never from a
       historical ACK body, and never move production backward in global release order. */
    if (connection.environment === 'production' && !connection.desiredReleaseId
      && !connection.pendingReleaseId) {
      try {
        const promotion = await currentStagingPromotion(connection.siteId);
        if (promotion) {
          if (promotion.staging.profile !== connection.profile) {
            return c.json({
              error: 'incompatible WordPress setup profiles',
              detail: 'Staging and production must use the same Connected setup profile.'
            }, 409);
          }
          const active = connection.activeReleaseId
            ? await o.connected!.release(connection.activeReleaseId) : null;
          if (connection.activeReleaseId && !active) {
            throw new Error('the active production release order could not be verified safely');
          }
          if (!active || active.sequence < promotion.release.sequence) {
            await issueTarget(promotion.release, connection, true);
            connection = await o.connected!.connection(connection.id) || connection;
          }
        }
      } catch (error) {
        c.header('retry-after', '5');
        return c.json({
          error: 'production promotion is pending', retryable: true,
          detail: String((error as Error).message)
        }, 503);
      }
    }
    let desired = await o.connected!.desiredTarget(connection.id);
    if (!desired && connection.environment === 'staging') {
      const hosted = await o.store.byId(connection.siteId);
      let canonicalPublished: SiteReleaseSummary | null = null;
      if (hosted?.publishedReleaseId) {
        try {
          if (!await o.connected!.markReleasePublished(hosted.publishedReleaseId, hosted.updatedAt)) {
            throw new Error('hosted release was finalized as abandoned');
          }
          canonicalPublished = await o.connected!.release(hosted.publishedReleaseId);
          if (!canonicalPublished) {
            throw new Error('the canonical hosted release could not be loaded safely');
          }
        } catch (error) {
          c.header('retry-after', '5');
          return c.json({
            error: 'hosted publication finalization is pending', retryable: true,
            detail: String((error as Error).message)
          }, 503);
        }
      }
      const active = connection.activeReleaseId
        ? await o.connected!.release(connection.activeReleaseId) : null;
      try {
        if (connection.activeReleaseId && !active) {
          throw new Error('the active staging release order could not be verified safely');
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
        c.header('retry-after', '5');
        return c.json({
          error: 'staging delivery is pending', retryable: true,
          detail: String((error as Error).message)
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
      c.header('retry-after', '5');
      return c.json({
        error: 'release target is not ready', retryable: true,
        detail: String((error as Error).message)
      }, 503);
    }
    const etag = `"${desired.release.id}:${desired.target.sequence}:${desired.release.manifestHash}"`;
    if (c.req.header('if-none-match') === etag) return c.body(null, 304, { etag });
    const here = o.editorOrigin || new URL(c.req.url).origin;
    c.header('etag', etag);
    return c.json({
      release: {
        manifest: desired.release.manifest, signature: desired.release.signature,
        keyId: desired.release.keyId,
        artifact: {
          url: `${here}/v1/releases/${encodeURIComponent(desired.release.id)}/artifact`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        }
      },
      deployment: {
        envelope: desired.target.envelope, signature: desired.target.signature, keyId: desired.target.keyId
      },
      keysetEnvelope: o.keysetEnvelope
    });
  });

  app.delete('/v1/connections/:id', async c => {
    if (!o.connected) return c.json({ error: 'connected persistence is unavailable' }, 503);
    const bearer = (c.req.header('authorization') || '').match(/^Bearer\s+([^\s]+)$/i)?.[1] || '';
    const refresh = String(c.req.header('x-pagecraft-refresh-token') || '');
    const idempotencyKey = String(c.req.header('idempotency-key') || '');
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
      return c.json({ error: 'a stable Idempotency-Key header is required' }, 400);
    }
    if (!bearer && !refresh) return c.json({ error: 'unauthorized' }, 401);
    const result = await o.connected.revokeConnection({
      id: c.req.param('id'), accessTokenDigest: bearer ? hashToken(bearer) : null,
      refreshTokenDigest: refresh ? hashToken(refresh) : null, idempotencyKey,
      now: new Date().toISOString()
    });
    if (!result.ok) {
      return c.json({ error: result.error }, result.error === 'unauthorized' ? 401 : 409);
    }
    return c.json({
      connectionId: result.connection.id, status: 'revoked',
      revokedAt: result.connection.revokedAt, alreadyRevoked: result.alreadyRevoked
    });
  });

  app.get('/v1/releases/:id/artifact', async c => {
    const connection = await bearerConnection(c);
    if (!connection || !o.connected) return c.json({ error: 'unauthorized' }, 401);
    const release = await o.connected.release(c.req.param('id'));
    const target = release ? await o.connected.target(connection.id, release.id) : null;
    if (!release || !target || release.siteId !== connection.siteId) return c.notFound();
    if (c.req.header('if-none-match') === `"${release.artifactHash}"`) {
      return c.body(null, 304, { etag: `"${release.artifactHash}"` });
    }
    return c.body(release.artifact as unknown as ArrayBuffer, 200, {
      'content-type': 'application/vnd.pagecraft.wordpress-artifact+json',
      'content-length': String(release.artifactBytes),
      etag: `"${release.artifactHash}"`,
      'cache-control': 'private, no-store'
    });
  });

  app.get('/v1/packages/:slug', async c => {
    const connection = await bearerConnection(c);
    if (!connection || !connection.scopes.includes('release:read')) return c.json({ error: 'unauthorized' }, 401);
    const pkg = o.packages?.get(c.req.param('slug'));
    if (!pkg) return c.notFound();
    const token = newToken(), expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await o.connected!.putGrant({
      digest: hashToken(token), kind: 'package-download', siteId: connection.siteId,
      connectionId: connection.id, payload: { slug: pkg.slug, hash: pkg.hash }, expiresAt
    });
    const metadata = JSON.parse(new TextDecoder().decode(fromBase64url(pkg.manifest))) as Record<string, unknown>;
    const here = o.editorOrigin || new URL(c.req.url).origin;
    return c.json({
      package: metadata,
      signed: { manifest: pkg.manifest, signature: pkg.signature, keyId: pkg.keyId },
      keysetEnvelope: pkg.keysetEnvelope,
      download: {
        url: `${here}/v1/packages/${encodeURIComponent(pkg.slug)}/download?token=${encodeURIComponent(token)}`,
        expiresAt
      }
    });
  });

  app.get('/v1/packages/:slug/download', async c => {
    const token = c.req.query('token') || '';
    const grant = token && o.connected
      ? await o.connected.consumeGrant(hashToken(token), 'package-download', new Date().toISOString())
      : null;
    const pkg = o.packages?.get(c.req.param('slug'));
    if (!grant || !pkg || grant.payload.slug !== pkg.slug || grant.payload.hash !== pkg.hash) {
      return c.json({ error: 'download authorization expired or invalid' }, 401);
    }
    const connection = grant.connectionId ? await o.connected?.connection(grant.connectionId) : null;
    if (!connection || connection.status !== 'active') return c.json({ error: 'connection is no longer active' }, 401);
    return c.body(pkg.bytes as unknown as ArrayBuffer, 200, {
      'content-type': 'application/zip',
      'content-length': String(pkg.bytes.byteLength),
      'content-disposition': `attachment; filename="${pkg.slug}-${pkg.version}.zip"`,
      'x-pagecraft-content-sha256': pkg.hash,
      'cache-control': 'private, no-store'
    });
  });

  app.post('/v1/connections/:id/deployments', async c => {
    const connection = await bearerConnection(c);
    if (!connection || connection.id !== c.req.param('id') || !o.connected) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const body = await c.req.json().catch(() => null) as {
      releaseId?: string; targetSequence?: number; sequence?: number; status?: DeploymentStatus;
      activeHash?: string | null; error?: string; idempotencyKey?: string;
      detail?: { code?: string; message?: string; action?: string; stage?: string };
    } | null;
    const statuses = new Set<DeploymentStatus>([
      'queued', 'downloading', 'staged', 'needs_approval', 'activating',
      'verifying', 'live', 'failed', 'rolled_back'
    ]);
    const sequence = body?.targetSequence ?? body?.sequence;
    const idempotencyKey = String(body?.idempotencyKey || c.req.header('idempotency-key') || '');
    if (!body?.releaseId || !Number.isInteger(sequence) || !body.status || !statuses.has(body.status)
      || !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
      return c.json({ error: 'releaseId, targetSequence, status, and idempotencyKey are required' }, 400);
    }
    const acknowledgement = {
      connectionId: connection.id, releaseId: body.releaseId, sequence: sequence as number,
      status: body.status, activeHash: body.activeHash || null,
      error: body.error ? String(body.error).slice(0, 2000) : null,
      detail: body.detail || null, idempotencyKey
    };
    const result = await o.connected.recordDeployment({
      ...acknowledgement,
      bodyHash: sha256(new TextEncoder().encode(canonicalJson(acknowledgement)))
    });
    if (!result.ok) return c.json({ error: result.error }, result.error === 'unknown-target' ? 404 : 409);
    const acknowledgedConnection = result.connection;
    if (!acknowledgedConnection || acknowledgedConnection.status !== 'active') {
      return c.json({ error: 'connection-inactive' }, 409);
    }
    let reconciliation: { status: 'not-required' | 'issued' | 'pending'; detail?: string } = {
      status: 'not-required'
    };
    try {
      if (acknowledgedConnection.environment === 'staging' && body.status === 'live') {
        /* Exact ACK replay is read-only in the store, but follow-up may run again after staging
           has advanced. Promote the current active staging release, not the historical body,
           so a delayed duplicate can neither roll production back nor strand a late-paired
           production target on an older release. */
        const promotion = await currentStagingPromotion(acknowledgedConnection.siteId);
        if (promotion) {
          const release = promotion.release;
          const production = promotion.connections.find(item =>
            item.environment === 'production' && item.status === 'active');
          if (production && production.profile !== promotion.staging.profile) {
            throw new Error('staging and production setup profiles are incompatible');
          }
          const activeProductionRelease = production?.activeReleaseId
            ? await o.connected.release(production.activeReleaseId) : null;
          const productionOrderUnknown = !!production?.activeReleaseId && !activeProductionRelease;
          const productionIsNewer = !!activeProductionRelease
            && activeProductionRelease.sequence >= release.sequence;
          if (production && !productionOrderUnknown && !productionIsNewer
            && production.activeReleaseId !== release.id) {
            if (!production.desiredReleaseId || production.desiredReleaseId === release.id) {
              await issueTarget(release, production, true);
              reconciliation = { status: 'issued' };
            } else {
              reconciliation = {
                status: 'pending', detail: 'Production is still completing the prior ordered release.'
              };
            }
          } else if (productionOrderUnknown) {
            reconciliation = {
              status: 'pending', detail: 'Production release order could not be verified safely.'
            };
          } else if (!production) {
            await stageNextRelease(acknowledgedConnection.siteId, release.sequence);
          }
        }
      } else if (acknowledgedConnection.environment === 'production' && body.status === 'live') {
        const release = await o.connected.release(body.releaseId);
        if (release) await stageNextRelease(acknowledgedConnection.siteId, release.sequence);
      } else if ((body.status === 'failed' || body.status === 'rolled_back')) {
        const release = await o.connected.release(body.releaseId);
        if (release) await stageNextRelease(acknowledgedConnection.siteId, release.sequence);
      }
    } catch (error) {
      /* The acknowledgement is already durable. Never turn a committed `live` into an
         ambiguous failure that prompts WordPress to roll back its verified local release.
         The production pending pointer / desired target is a durable reconciliation job. */
      reconciliation = { status: 'pending', detail: String((error as Error).message) };
      console.error('WordPress deployment follow-up is pending:', (error as Error).message);
    }
    return c.json({
      deployment: result.deployment, duplicate: !!result.duplicate,
      activeReleaseId: result.connection?.activeReleaseId || null,
      activeHash: result.connection?.activeHash || null,
      reconciliation
    }, result.duplicate ? 200 : 201);
  });

  /* A production CMS image field may originate in the WordPress Media Library. The scoped
     connector uploads its exact bytes first, then writes the returned `asset:<id>` into the
     ordinary Pagecraft draft. The id is derived from the connection + idempotency key so a
     timed-out WordPress worker can retry without creating a second remote asset. */
  app.post('/v1/sites/:id/cms-assets', async c => {
    const connection = await bearerConnection(c);
    const id = c.req.param('id');
    if (!connection || connection.siteId !== id || !connection.scopes.includes('cms:write')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    if (connection.environment !== 'production') {
      return c.json({ error: 'CMS media write-back is production-only' }, 403);
    }
    if (!o.assets) return c.json({ error: 'this server stores no assets' }, 501);
    const idempotencyKey = String(c.req.header('idempotency-key') || '');
    const filename = String(c.req.header('x-pagecraft-filename') || '');
    const claimedHash = String(c.req.header('x-pagecraft-content-sha256') || '').toLowerCase();
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(filename)
      || filename === '.' || filename === '..' || !/^[a-f0-9]{64}$/.test(claimedHash)) {
      return c.json({
        error: 'valid Idempotency-Key, X-Pagecraft-Filename, and X-Pagecraft-Content-SHA256 headers are required'
      }, 400);
    }
    const lengthHeader = String(c.req.header('content-length') || '');
    if (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) < 1) {
      return c.json({ error: 'an exact positive Content-Length is required' }, 411);
    }
    const declaredLength = Number(lengthHeader);
    if (declaredLength > MAX_BYTES) {
      return c.json({ error: `too large — the limit is ${MAX_BYTES} bytes` }, 413);
    }
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.byteLength !== declaredLength) {
      return c.json({ error: 'Content-Length does not match the received image bytes' }, 400);
    }
    if (bytes.byteLength > MAX_BYTES) {
      return c.json({ error: `too large — the limit is ${MAX_BYTES} bytes` }, 413);
    }
    const bodyHash = sha256(bytes);
    if (bodyHash !== claimedHash) return c.json({ error: 'image content hash does not match' }, 422);
    const type = sniff(bytes);
    if (!type || !ALLOWED.has(type)) return c.json({ error: 'that is not an image this server serves' }, 415);
    const declaredType = String(c.req.header('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (!declaredType || declaredType !== type) {
      return c.json({ error: 'the declared content type does not match the image bytes' }, 415);
    }
    const assetId = 'wp' + sha256(new TextEncoder().encode(`${connection.id}\0${idempotencyKey}`)).slice(0, 48);
    const existing = await o.assets.get(id, assetId);
    if (existing) {
      if (existing.contentHash !== bodyHash) {
        return c.json({ error: 'the idempotency key was already used for different media' }, 409);
      }
      return c.json({
        ...metaOf(existing), assetId, reference: `asset:${assetId}`, hash: bodyHash,
        bytes: existing.bytes.byteLength, mime: existing.type, duplicate: true
      });
    }
    let output: OptimizedImage;
    try { output = await optimizeAsset(bytes, type); }
    catch { return c.json({ error: 'image optimization failed' }, 422); }
    let saved: AssetRecord | null;
    try {
      saved = await o.assets.putConnected({
        id: assetId, siteId: id, name: optimizedName(filename, output.extension),
        type: output.type, bytes: output.bytes, w: output.w, h: output.h,
        contentHash: bodyHash
      }, connection.id, async () => {
        const current = await o.connected!.connection(connection.id);
        return current?.status === 'active'
          && !!current.accessTokenExpiresAt
          && new Date(current.accessTokenExpiresAt).getTime() > Date.now();
      }, {
        ownerId: connection.createdBy, limitBytes: FREE_STORAGE_BYTES,
        originalBytes: bytes.byteLength, optimized: true
      });
    } catch (error) {
      if (error instanceof AssetQuotaError) {
        return c.json({ error: 'storage_limit_reached', ...error.usage }, 409);
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
          return c.json({ error: 'the idempotency key was already used for different media' }, 409);
        }
        return c.json({
          ...metaOf(current), assetId, reference: `asset:${assetId}`, hash: bodyHash,
          bytes: current.bytes.byteLength, mime: current.type, duplicate: true
        });
      }
      const stillActive = await o.connected!.connection(connection.id);
      if (stillActive?.status === 'active' && stillActive.accessTokenExpiresAt
        && new Date(stillActive.accessTokenExpiresAt).getTime() > Date.now()) {
        return c.json({ error: 'the idempotency key was already used for different media or site' }, 409);
      }
      return c.json({ error: 'connection-inactive' }, 401);
    }
    built.delete(id);
    return c.json({
      ...metaOf(saved), assetId, reference: `asset:${assetId}`, hash: bodyHash,
      bytes: saved.storedBytes ?? output.bytes.byteLength, mime: saved.type, duplicate: false
    }, 201);
  });

  app.patch('/v1/sites/:id/cms', async c => {
    const connection = await bearerConnection(c);
    const id = c.req.param('id');
    if (!connection || connection.siteId !== id || !connection.scopes.includes('cms:write')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    if (connection.environment !== 'production') {
      return c.json({ error: 'CMS write-back is production-only' }, 403);
    }
    const body = await c.req.json().catch(() => null) as {
      baseVersion?: number;
      writes?: Array<{
        collectionId?: string; itemId?: string; writeSequence?: number;
        values?: Record<string, unknown>; draft?: boolean;
      }>;
    } | null;
    const idempotencyKey = String(c.req.header('idempotency-key') || '');
    if (!body || (body.baseVersion !== undefined && !Number.isInteger(body.baseVersion))
      || !Array.isArray(body.writes) || !body.writes.length || body.writes.length > 100
      || !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
      return c.json({
        error: 'Idempotency-Key and between 1 and 100 sequenced writes are required'
      }, 400);
    }
    const normalized: Array<{
      collectionId: string; itemId: string; writeSequence: number;
      values: Record<string, string>; draft?: boolean; bodyHash: string; itemKey: string;
    }> = [];
    const itemKeys = new Set<string>();
    for (const write of body.writes) {
      const collectionId = typeof write.collectionId === 'string' ? write.collectionId : '';
      const itemId = typeof write.itemId === 'string' ? write.itemId : '';
      const values = write.values || {};
      const itemKey = cmsItemKey(collectionId, itemId);
      if (!collectionId || !itemId || !Number.isSafeInteger(write.writeSequence)
        || Number(write.writeSequence) < 1 || !values || typeof values !== 'object' || Array.isArray(values)
        || Object.values(values).some(value => typeof value !== 'string')
        || (write.draft !== undefined && typeof write.draft !== 'boolean')
        || (!Object.keys(values).length && write.draft === undefined) || itemKeys.has(itemKey)) {
        return c.json({ error: 'each item needs one unique positive writeSequence and typed values or draft state' }, 400);
      }
      itemKeys.add(itemKey);
      const stable = {
        collectionId, itemId, writeSequence: Number(write.writeSequence),
        values: values as Record<string, string>, draft: write.draft ?? null
      };
      normalized.push({
        ...stable, draft: write.draft, itemKey,
        bodyHash: sha256(new TextEncoder().encode(canonicalJson(stable)))
      });
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const site = await o.store.byId(id);
      if (!site) return c.notFound();
      const currentAssetIds = new Set((await assetsOf(id)).map(asset => asset.id));
      try {
        /* Validate even an apparent replay against the current canonical schema. A connection
           must not retain authority to write a removed field merely because it has an older
           sequence receipt. The retry loop repeats this check after every save conflict. */
        for (const write of normalized) {
          assertTypedCmsWrite(site.doc, write.collectionId, write.itemId, write.values, currentAssetIds);
        }
      } catch (error) {
        return c.json({ error: String((error as Error).message) }, 422);
      }
      const heads = await o.store.cmsWriteHeads(id, connection.id, [...itemKeys]);
      const headByItem = new Map(heads.map(head => [cmsItemKey(head.collectionId, head.itemId), head]));
      const stale: Array<{
        collectionId: string; itemId: string; writeSequence: number; currentSequence: number;
      }> = [];
      const conflicts: typeof stale = [];
      const duplicates = new Set<string>();
      for (const write of normalized) {
        const head = headByItem.get(write.itemKey);
        if (!head) continue;
        if (write.writeSequence < head.writeSequence) {
          stale.push({
            collectionId: write.collectionId, itemId: write.itemId,
            writeSequence: write.writeSequence, currentSequence: head.writeSequence
          });
        } else if (write.writeSequence === head.writeSequence) {
          if (write.bodyHash === head.bodyHash && idempotencyKey === head.idempotencyKey) {
            duplicates.add(write.itemKey);
          } else {
            conflicts.push({
              collectionId: write.collectionId, itemId: write.itemId,
              writeSequence: write.writeSequence, currentSequence: head.writeSequence
            });
          }
        }
      }
      if (stale.length) return c.json({ error: 'stale-write', retryable: false, stale }, 409);
      if (conflicts.length) {
        return c.json({ error: 'write-sequence-conflict', retryable: false, conflicts }, 409);
      }
      const pending = normalized.filter(write => !duplicates.has(write.itemKey));
      if (!pending.length) return c.json({
        status: 'duplicate', baseVersion: body.baseVersion ?? null,
        version: site.version, publishedVersion: site.publishedVersion,
        writes: normalized.map(write => ({
          collectionId: write.collectionId, itemId: write.itemId, writeSequence: write.writeSequence
        }))
      });
      const document = structuredClone(site.doc);
      const overwritten: Array<{
        collectionId: string; itemId: string; writeSequence: number; fieldId: string;
        previous: string | boolean | null; next: string | boolean;
      }> = [];
      try {
        for (const write of pending) {
          const { collection, item } = assertTypedCmsWrite(
            document, write.collectionId, write.itemId, write.values, currentAssetIds
          );
          for (const [fieldId, value] of Object.entries(write.values || {})) {
            overwritten.push({
              collectionId: collection.id, itemId: item.id, writeSequence: write.writeSequence, fieldId,
              previous: Object.prototype.hasOwnProperty.call(item.values, fieldId) ? item.values[fieldId] : null,
              next: value
            });
            item.values[fieldId] = value;
          }
          if (write.draft === true || write.draft === false) {
            overwritten.push({
              collectionId: collection.id, itemId: item.id, writeSequence: write.writeSequence, fieldId: '$draft',
              previous: !!item.draft, next: write.draft
            });
            if (write.draft) item.draft = 1;
            else delete item.draft;
          }
        }
      } catch (error) {
        return c.json({ error: String((error as Error).message) }, 422);
      }
      const saved = await o.store.saveConnectedCms(id, document, site.version, connection.createdBy, connection.id, {
        source: 'wordpress-cms-write',
        connectionId: connection.id,
        installationId: connection.installationId,
        baseVersion: body.baseVersion ?? null,
        appliedToVersion: site.version,
        overwritten,
        cmsWrites: pending.map(write => ({
          connectionId: connection.id, collectionId: write.collectionId, itemId: write.itemId,
          writeSequence: write.writeSequence, idempotencyKey, bodyHash: write.bodyHash,
          overwritten: overwritten.filter(entry => entry.collectionId === write.collectionId
            && entry.itemId === write.itemId && entry.writeSequence === write.writeSequence)
        }))
      }, async () => {
        const current = await o.connected!.connection(connection.id);
        return current?.status === 'active'
          && !!current.accessTokenExpiresAt
          && new Date(current.accessTokenExpiresAt).getTime() > Date.now();
      });
      if (saved.ok) return c.json({
        status: 'applied',
        baseVersion: body.baseVersion ?? null,
        version: saved.site!.version,
        publishedVersion: saved.site!.publishedVersion,
        overwrittenCount: overwritten.length,
        writes: normalized.map(write => ({
          collectionId: write.collectionId, itemId: write.itemId, writeSequence: write.writeSequence
        }))
      });
      if (saved.guarded) return c.json({ error: 'connection-inactive' }, 401);
      if (!saved.conflict) return c.notFound();
    }
    return c.json({ error: 'CMS write could not settle after concurrent saves; retry safely' }, 409);
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
  app.get('*', async c => {
    const url = new URL(c.req.url);
    if (isEditorHost(c.req.header('host'), o)) {
      const [, first, ...rest] = url.pathname.split('/');
      const slug = first ? validSlug(first) : null;
      const site = slug ? await o.store.bySlug(slug) : null;
      if (!site) {
        return c.text(first
          ? `No site at /${first}`
          : 'No site here. Sign in to the editor to make one.', 404);
      }
      /* A site root is directory-shaped. Keep one canonical URL so analytics, caches and search
         engines do not split `/acme` and `/acme/`; retain the query exactly. */
      if (!rest.length && !url.pathname.endsWith('/')) {
        return c.redirect(`/${site.slug}/${url.search}`, 308);
      }
      /* The path within the site. A bare `/acme` is that site's index, which is why the empty
         remainder becomes `/` rather than falling through to a 404. */
      return serveSite(c, o, built, render, '/' + rest.join('/'), site);
    }
    const host = (c.req.header('host') || '').split(':')[0];
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
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  const tag = `<script>window.PC_SERVER=${json};<\/script>\n`;
  const at = html.indexOf('<script');
  return at < 0 ? tag + html : html.slice(0, at) + tag + html.slice(at);
}

const shell = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#ebe8dd;color:#111311;
       font:15px/1.5 "Manrope",system-ui,-apple-system,sans-serif}
  .card{background:#fff;border:1px solid #e5e1d6;border-radius:16px;padding:28px;width:min(92vw,380px);
        box-shadow:0 10px 30px -12px #1113111f}
  h1{margin:0 0 4px;font-size:19px;letter-spacing:-.01em}
  p{margin:0 0 18px;color:#5f6660;font-size:13.5px}
  label{display:block;font-size:12px;color:#5f6660;margin-bottom:6px}
  input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d4cfc0;border-radius:4px;
        font:inherit;margin-bottom:12px}
  button{width:100%;padding:10px;border:0;border-radius:8px;background:#b7f34a;color:#111311;
         font:600 14px inherit;cursor:pointer}
  a{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;margin-bottom:6px;
    border:1px solid #e5e1d6;border-radius:8px;color:inherit;text-decoration:none}
  a:hover{background:#f8f6ef;border-color:#5f6660}
  small{color:#5f6660;font-size:12px}
  .ok{padding:11px 12px;border-radius:8px;background:#f8f6ef;font-size:13.5px}
  ${body.includes('<select') ? CUSTOM_SELECT_CSS : ''}
</style></head><body><div class="card">${body}</div>${body.includes('<select') ? `<script>${CUSTOM_SELECT_BOOT_SCRIPT}<\/script>` : ''}</body></html>`;

/* No framework for four screens' worth of markup. If this grows past a form and a list it
   should become part of the editor bundle rather than more strings in here. */
const signInPage = () => shell('Sign in — Pagecraft', `
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
      error.hidden = true; button.disabled = true; button.textContent = 'Sending…';
      try {
        const response = await fetch('/auth/login', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: document.getElementById('e').value })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || ('Sign-in failed (' + response.status + ')'));
        form.hidden = true;
        document.getElementById('done').hidden = false;
      } catch (caught) {
        error.textContent = caught.message || 'The link could not be sent. Try again shortly.';
        error.hidden = false; button.disabled = false; button.textContent = 'Send me a link';
      }
    });
  <\/script>`);

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
  <div id="err" class="ok" hidden></div>
  <script>
    document.getElementById('new').addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button');
      btn.disabled = true; btn.textContent = 'Creating…';
      const res = await fetch('/api/sites', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: document.getElementById('n').value })
      });
      if (res.ok) { location.href = '/edit/' + (await res.json()).id; return; }
      /* Said out loud rather than swallowed: a failure here with a spinner that never stops is
         the worst version of this screen. */
      const err = document.getElementById('err');
      err.textContent = ((await res.json().catch(() => ({}))).error) || ('Failed: ' + res.status);
      err.hidden = false;
      btn.disabled = false; btn.textContent = 'Create it';
    });
  <\/script>`;

const emptyPage = (email: string) => shell('No sites — Pagecraft', `
  <h1>Make your first site</h1>
  <p>Signed in as ${escapeHtml(email)}. Nothing here yet — name something and start.</p>
  ${newSiteForm('Site name')}`);

const pickerPage = (email: string, sites: { id: string; name: string; where: string; role: string }[]) =>
  shell('Your sites — Pagecraft', `
  <h1>Your sites</h1>
  <p>Signed in as ${escapeHtml(email)}</p>
  ${sites.map(s => `<a href="/edit/${encodeURIComponent(s.id)}">
    <span>${escapeHtml(s.name)}<br><small>${escapeHtml(s.where)}</small></span>
    <small>${escapeHtml(s.role)}</small></a>`).join('')}
  ${newSiteForm('Another site')}`);

const escapeHtml = (v: string) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function isEditorHost(host: string | undefined, o: Options) {
  if (!o.editorHost) return true;                       // no split configured: everything is the editor
  return (host || '').split(':')[0] === o.editorHost;
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
function shareUrl(c: Context, o: Options, site: Pick<Site, 'host' | 'slug'>): string {
  const proto = c.req.header('x-forwarded-proto') || new URL(c.req.url).protocol.replace(':', '');
  const real = !/\.invalid$/.test(site.host);
  if (real) return `${proto}://${site.host}/`;
  const here = c.req.header('host') || o.editorHost || 'localhost';
  return `${proto}://${here}/${site.slug}/`;
}

async function serveSite(
  c: Context,
  o: Options,
  built: Map<string, { version: number; releaseId: string | null; files: Map<string, string> }>,
  render: (doc: Doc, assets?: AssetRecord[]) => { files: Map<string, string> },
  urlPath: string,
  site: Site
) {
  /* A restart empties the cache, so the first request after one renders. Cheaper than
     writing files to the volume and keeping them in step with the document. */
  const path = resolvePath(urlPath);
  const shared = isEditorHost(c.req.header('host'), o);
  const prefix = shared ? site.slug : '';

  /* Images come from the asset store rather than the rendered map: the map holds strings, and
     putting megabytes of binary in it would make every render carry them. */
  if (path.startsWith('assets/')) {
    /* Once a signed release exists, its content-addressed bytes are the public truth. A later
       draft upload or replacement cannot mutate what visitors receive before Publish. */
    if (site.publishedReleaseId && o.connected) {
      const release = await o.connected.release(site.publishedReleaseId);
      if (!release) return c.text('Published release unavailable', 503);
      let artifact: ReturnType<typeof parseReleaseArtifact>;
      try {
        if (release.artifact.byteLength !== release.artifactBytes
          || sha256(release.artifact) !== release.artifactHash) throw new Error('artifact integrity mismatch');
        artifact = parseReleaseArtifact(release.artifact);
      }
      catch { return c.text('Published release artifact unavailable', 503); }
      const frozen = artifact.assets.find(asset => asset.filename === path);
      if (!frozen) return c.notFound();
      let bytes: Uint8Array;
      try {
        bytes = fromBase64url(frozen.content);
        if (bytes.byteLength !== frozen.bytes || sha256(bytes) !== frozen.hash) {
          throw new Error('asset integrity mismatch');
        }
      } catch { return c.text('Published release asset unavailable', 503); }
      return c.body(bytes as unknown as ArrayBuffer, 200, {
        ...assetHeaders({ type: frozen.mime, name: frozen.filename }),
        'content-length': String(frozen.bytes),
        'cache-control': 'public, max-age=31536000, immutable'
      });
    }
    const a = o.assets ? await o.assets.byPath(site.id, path) : null;
    if (a) return c.body(a.bytes as unknown as ArrayBuffer, 200, {
      ...assetHeaders(a),
      /* the path is the filename, and the filename changes when the image does, so this is
         safe to cache hard — a replaced image is a different path */
      'cache-control': 'public, max-age=31536000, immutable'
    });
  }

  let cached = built.get(site.id);
  /* Version-aware rather than process-invalidation-only. Another Passenger worker may save the
     site; once this store lookup observes that version, this worker cannot keep serving its old
     rendered map indefinitely. */
  if (!cached || cached.version !== site.publishedVersion
    || cached.releaseId !== site.publishedReleaseId) {
    if (site.publishedReleaseId) {
      if (!o.connected) return c.text('Published release store unavailable', 503);
      const release = await o.connected.release(site.publishedReleaseId);
      if (!release || release.siteId !== site.id || release.sourceVersion !== site.publishedVersion) {
        return c.text('Published release unavailable', 503);
      }
      const files = new Map<string, string>();
      try {
        if (!Array.isArray(release.hostedFiles) || !release.hostedFiles.length) {
          throw new Error('release has no hosted export');
        }
        for (const file of release.hostedFiles) {
          if (!file || typeof file.path !== 'string' || typeof file.content !== 'string'
            || files.has(file.path)) throw new Error('invalid or duplicate hosted path');
          const bytes = new TextEncoder().encode(file.content);
          if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.hash) {
            throw new Error('hosted file integrity mismatch');
          }
          files.set(file.path, file.content);
        }
      } catch (error) {
        console.error('published release could not be served:', String((error as Error).message || error));
        return c.text('Published release export unavailable', 503);
      }
      cached = { version: site.publishedVersion, releaseId: release.id, files };
    } else {
      const revision = await o.store.revision(site.id, site.publishedVersion);
      /* Sites created before signed releases have an explicit immutable revision bootstrap.
         Once a release pointer exists, only its frozen export is accepted above. */
      if (!revision) return c.text('Published revision unavailable', 503);
      let out: { files: Map<string, string> };
      try { out = render(revision.doc, o.assets ? await o.assets.list(site.id) : []); }
      catch (error) {
        console.error('published revision could not be rendered:', String((error as Error).message || error));
        return c.text('Published revision requires a newer Pagecraft renderer', 503);
      }
      cached = { version: site.publishedVersion, releaseId: null, files: out.files };
    }
    built.set(site.id, cached);
  }
  const files = cached.files;

  /* `/index`, `/index.html`, and nested equivalents are duplicate directory URLs. Redirect
     only when that exact rendered index exists; a user-authored non-page path remains a 404. */
  if (/(^|\/)index(?:\.html)?$/i.test(urlPath.replace(/\/+$/, '')) && files.has(path)) {
    return c.redirect(publicPath(path, prefix) + new URL(c.req.url).search, 308);
  }

  /* Old bookmarks still arrive, but the implementation filename must not remain visible.
     Redirect only when that exact rendered page exists, so `/made-up.html` stays a real 404
     instead of becoming a misleading redirect followed by one. */
  if (/\.html$/i.test(urlPath) && files.has(path)) {
    return c.redirect(publicPath(path, prefix) + new URL(c.req.url).search, 308);
  }

  const body = files.get(path);
  /* A site's own 404 page if it has one — the convention the builder already exports. */
  if (body === undefined) {
    const notFound = files.get('404.html');
    if (notFound !== undefined) {
      return c.body(hostedHtml(notFound, '404.html', files, prefix), 404, publishedHeaders(TYPES.html));
    }
    return c.text(`Not found: /${path}`, 404);
  }
  const type = typeOf(path);
  let served = type.startsWith('text/html') ? hostedHtml(body, path, files, prefix) : body;
  if (type.startsWith('text/html') && o.connected) {
    const production = await o.connected.canonicalProductionConnection(site.id);
    if (production) served = wordpressCanonicalHtml(served, production.targetOrigin, production.targetPath, path);
  }
  return c.body(served, 200, type.startsWith('text/html') ? publishedHeaders(type) : { 'content-type': type });
}

/** As soon as an owner pairs a production WordPress target, Pagecraft's hosted copy becomes a
 * review/fallback surface and must not compete in search, even before the first deployment.
 * Disconnect freezes WordPress content but does not reclaim canonical ownership, so the last
 * consented production origin/path remains here until an explicit future owner-reclaim flow. */
function wordpressCanonicalHtml(html: string, origin: string, targetPath: string, file: string) {
  const basePath = ('/' + targetPath.replace(/^\/+|\/+$/g, '') + '/').replace(/^\/\/$/, '/');
  const relative = publicPath(file).replace(/^\/+/, '');
  const canonical = new URL(basePath + relative, origin).href;
  const tags = `<meta name="robots" content="noindex,follow">\n<link rel="canonical" href="${canonical.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">\n`;
  return replaceHostedSeoOwnershipTags(html, tags);
}

/** A published page may intentionally run scripts, but it must not inherit the editor origin.
    CSP sandbox without `allow-same-origin` gives it an opaque origin while retaining the site
    features owners asked for. */
const publishedHeaders = (type: string): Record<string, string> => ({
  'content-type': type,
  'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads'
});

/** SVG remains supported. If opened directly, the response itself is sandboxed and cannot run
    script or navigate the editor; as an <img>, browsers already treat it as an image document. */
const assetHeaders = (asset: Pick<Asset, 'type' | 'name'>): Record<string, string> =>
  asset.type === 'image/svg+xml'
  ? {
      'content-type': asset.type,
      'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      'content-disposition': `inline; filename="${asset.name.replace(/["\\\r\n]/g, '_')}"`,
      'x-content-type-options': 'nosniff'
    }
  : { 'content-type': asset.type, 'x-content-type-options': 'nosniff' };
