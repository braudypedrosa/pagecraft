/* A narrow HTTPS transport for hosts that cannot open PostgreSQL's TCP ports.

   The Supabase function on the other end does not accept SQL. It accepts the finite set of
   operations below, checks a private gateway key, and performs each operation through the
   project's server-side Data API client. Keeping the Store interfaces unchanged means the
   editor, auth, rendering, and asset routes do not know or care which transport is in use. */
import type { Doc } from '../../app/src/core/types.ts';
import {
  AssetQuotaError, FREE_STORAGE_BYTES, MAX_BYTES,
  type Asset, type AssetQuota, type AssetRecord, type AssetStore
} from './assets.ts';
import {
  normalEmail, type AuthStore, type ManualImportCredential, type Membership, type Role, type Session, type User
} from './auth.ts';
import {
  validSlug, slugFrom, type CmsWriteHead, type SaveResult, type Site, type SiteRevision, type Store
} from './store.ts';
import {
  type ConnectedEditorCredential, type ConnectedGrant, type ConnectedGrantKind,
  type ConnectedStore, type ConnectionRevocationResult, type Deployment, type DeploymentResult, type ReleaseReservation,
  type ReleaseTarget, type SiteRelease, type SiteReleaseSummary,
  type WebhookOutboxEvent, type WordPressConnection, type WordPressContentIndexResult,
  type WordPressContentIndexSnapshot
} from './release-store.ts';
import {
  assembleGatewayBlob, GATEWAY_CONTROL_BODY_MAX, splitGatewayBlob, validateGatewayBlobDescriptor,
  type GatewayBlobChunkV1, type GatewayBlobDescriptorV1
} from './gateway-blobs.ts';

interface GatewayReply<T> { data: T }
interface GatewayFailure { error?: string; code?: string }

export class GatewayError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
  }
}

export class PagecraftGateway {
  private url: string;
  private key: string;
  private request: typeof fetch;

  constructor(url: string, key: string, request: typeof fetch = fetch) {
    this.url = url.replace(/\/+$/, '');
    this.key = key;
    this.request = request;
  }

  async call<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    const serialized = JSON.stringify({ op, args });
    if (Buffer.byteLength(serialized, 'utf8') > GATEWAY_CONTROL_BODY_MAX) {
      throw new GatewayError('gateway request is too large', 'REQUEST_TOO_LARGE');
    }
    const response = await this.request(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-pagecraft-gateway-key': this.key
      },
      body: serialized,
      signal: AbortSignal.timeout(30_000)
    });
    const parsed = await response.json().catch(() => null) as unknown;
    const body = parsed && typeof parsed === 'object'
      ? parsed as GatewayReply<T> & GatewayFailure
      : {} as GatewayReply<T> & GatewayFailure;
    if (!response.ok) {
      throw new GatewayError(body.error || `gateway answered ${response.status}`, body.code);
    }
    if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
      throw new GatewayError('gateway returned an invalid response', 'INVALID_RESPONSE');
    }
    return body.data;
  }
}

interface SiteRow {
  id: string; host: string; slug: string; name: string; doc: Doc;
  version: number; published_version: number; published_release_id: string | null;
  updated_at: string;
}

type SiteMetaRow = Omit<SiteRow, 'doc'>;

const toSite = (row: SiteRow): Site => ({
  id: row.id, host: row.host, slug: row.slug, name: row.name, doc: row.doc,
  version: row.version, publishedVersion: row.published_version,
  publishedReleaseId: row.published_release_id,
  updatedAt: new Date(row.updated_at).toISOString()
});

interface RevisionRow {
  site_id: string; version: number; doc: Doc; saved_by: string | null;
  context: Record<string, unknown> | null; created_at: string;
}
const toRevision = (row: RevisionRow): SiteRevision => ({
  siteId: row.site_id, version: row.version, doc: row.doc, savedBy: row.saved_by,
  context: row.context,
  createdAt: new Date(row.created_at).toISOString()
});

export class GatewayStore implements Store {
  private gateway: PagecraftGateway;
  private cached = new Map<string, { until: number; site: Site | null }>();
  private cacheMs = 30_000;
  constructor(gateway: PagecraftGateway) { this.gateway = gateway; }

  private readCache(key: string): Site | null | undefined {
    const hit = this.cached.get(key);
    if (!hit || hit.until <= Date.now()) { this.cached.delete(key); return undefined; }
    return hit.site ? structuredClone(hit.site) : null;
  }
  private remember(site: Site | null) {
    const until = Date.now() + this.cacheMs;
    if (!site) return;
    const copy = structuredClone(site);
    this.cached.set(`host:${site.host}`, { until, site: copy });
    this.cached.set(`slug:${site.slug}`, { until, site: copy });
  }
  private clearCache() { this.cached.clear(); }

  async byHost(host: string) {
    const hit = this.readCache(`host:${host}`);
    if (hit !== undefined) return hit;
    const row = await this.gateway.call<SiteRow | null>('site.byHost', { host });
    const site = row ? toSite(row) : null;
    this.remember(site);
    return site;
  }
  async bySlug(slug: string) {
    const hit = this.readCache(`slug:${slug}`);
    if (hit !== undefined) return hit;
    const row = await this.gateway.call<SiteRow | null>('site.bySlug', { slug });
    const site = row ? toSite(row) : null;
    this.remember(site);
    return site;
  }
  async byId(id: string) {
    const row = await this.gateway.call<SiteRow | null>('site.byId', { id });
    const site = row ? toSite(row) : null;
    return site;
  }
  async list() {
    return (await this.gateway.call<SiteRow[]>('site.list')).map(toSite);
  }
  async listMeta() {
    return (await this.gateway.call<SiteMetaRow[]>('site.listMeta')).map(row => ({
      id: row.id, host: row.host, slug: row.slug, name: row.name, version: row.version,
      publishedVersion: row.published_version, publishedReleaseId: row.published_release_id,
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  }
  async create(input: { host: string; slug?: string; name: string; doc: Doc; savedBy?: string }) {
    const id = crypto.randomUUID();
    const wanted = input.slug ? validSlug(input.slug) : null;
    if (input.slug && !wanted) throw new Error(`not a usable path: ${input.slug}`);
    const taken = (await this.listMeta()).map(site => site.slug);
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = wanted || slugFrom(input.name || input.host, taken);
      try {
        const row = await this.gateway.call<SiteRow>('site.create', {
          id, host: input.host, slug, name: input.name, doc: input.doc, savedBy: input.savedBy
        });
        const site = toSite(row);
        this.clearCache();
        this.remember(site);
        return site;
      } catch (error) {
        const message = String((error as Error).message);
        if (wanted || !/slug/i.test(message) || !/unique|duplicate/i.test(message)) throw error;
        taken.push(slug);
      }
    }
    throw new Error('could not find a free path for this site');
  }
  async setSlug(id: string, slug: string) {
    const wanted = validSlug(slug);
    if (!wanted) return null;
    try {
      const row = await this.gateway.call<SiteRow | null>('site.setSlug', { id, slug: wanted });
      const site = row ? toSite(row) : null;
      this.clearCache();
      this.remember(site);
      return site;
    } catch (error) {
      if (/unique|duplicate/i.test(String((error as Error).message))) return null;
      throw error;
    }
  }
  async setHost(id: string, host: string) {
    try {
      const row = await this.gateway.call<SiteRow | null>('site.setHost', { id, host });
      const site = row ? toSite(row) : null;
      this.clearCache();
      this.remember(site);
      return site;
    } catch (error) {
      if (/unique|duplicate/i.test(String((error as Error).message))) return null;
      throw error;
    }
  }
  async save(id: string, doc: Doc, version: number, savedBy?: string, context?: Record<string, unknown>): Promise<SaveResult> {
    const row = await this.gateway.call<SiteRow | null>('site.save', { id, doc, version, savedBy, context });
    if (row) {
      const site = toSite(row);
      this.clearCache();
      this.remember(site);
      return { ok: true, site };
    }
    this.clearCache();
    const current = await this.byId(id);
    if (!current) return { ok: false };
    return { ok: false, conflict: { yours: version, theirs: current.version } };
  }
  async saveConnectedCms(
    id: string, doc: Doc, version: number, savedBy: string, connectionId: string,
    context: Record<string, unknown>, _active?: () => Promise<boolean>
  ): Promise<SaveResult> {
    const result = await this.gateway.call<{ row: SiteRow | null; guarded: boolean }>('site.saveConnectedCms', {
      id, doc, version, savedBy, connectionId, context
    });
    if (result.row) {
      const site = toSite(result.row);
      this.clearCache();
      this.remember(site);
      return { ok: true, site };
    }
    this.clearCache();
    const current = await this.byId(id);
    if (!current) return { ok: false };
    if (current.version !== version) {
      return { ok: false, conflict: { yours: version, theirs: current.version } };
    }
    return { ok: false, guarded: true };
  }
  async history(id: string) {
    return (await this.gateway.call<RevisionRow[]>('site.history', { id })).map(toRevision);
  }
  async revision(id: string, version: number) {
    const row = await this.gateway.call<RevisionRow | null>('site.revision', { id, version });
    return row ? toRevision(row) : null;
  }
  async cmsWriteHeads(id: string, connectionId: string, itemKeys: string[]) {
    return this.gateway.call<CmsWriteHead[]>('site.cmsWriteHeads', { id, connectionId, itemKeys });
  }
  async publish(id: string, version: number, releaseId: string, releaseSequence: number) {
    const row = await this.gateway.call<SiteRow | null>('site.publish', {
      id, version, releaseId, releaseSequence
    });
    const site = row ? toSite(row) : null;
    this.clearCache();
    this.remember(site);
    return site;
  }
}

interface ConnectionWire {
  id: string; site_id: string; created_by: string; installation_id: string;
  environment: WordPressConnection['environment']; profile: WordPressConnection['profile'];
  target_origin: string; target_path: string; redirect_uri: string; webhook_url: string;
  scopes: string[]; status: WordPressConnection['status']; code_challenge: string;
  authorization_code_digest: string; authorization_code_expires_at: string;
  authorization_code_used_at: string | null; confirmation_expires_at: string | null;
  confirmed_at: string | null; access_token_digest: string | null;
  access_token_expires_at: string | null; refresh_token_digest: string | null;
  desired_release_id: string | null; pending_release_id: string | null;
  next_sequence: number; last_acknowledged_sequence: number; active_release_id: string | null;
  active_hash: string | null; revoked_at: string | null; revocation_idempotency_key: string | null;
  created_at: string; updated_at: string;
}
const toConnection = (row: ConnectionWire): WordPressConnection => ({
  id: row.id, siteId: row.site_id, createdBy: row.created_by, installationId: row.installation_id,
  environment: row.environment, profile: row.profile, targetOrigin: row.target_origin,
  targetPath: row.target_path, redirectUri: row.redirect_uri, webhookUrl: row.webhook_url,
  scopes: row.scopes, status: row.status, codeChallenge: row.code_challenge,
  authorizationCodeDigest: row.authorization_code_digest,
  authorizationCodeExpiresAt: new Date(row.authorization_code_expires_at).toISOString(),
  authorizationCodeUsedAt: row.authorization_code_used_at ? new Date(row.authorization_code_used_at).toISOString() : null,
  confirmationExpiresAt: row.confirmation_expires_at
    ? new Date(row.confirmation_expires_at).toISOString() : null,
  confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
  accessTokenDigest: row.access_token_digest,
  accessTokenExpiresAt: row.access_token_expires_at ? new Date(row.access_token_expires_at).toISOString() : null,
  refreshTokenDigest: row.refresh_token_digest, desiredReleaseId: row.desired_release_id,
  pendingReleaseId: row.pending_release_id, nextSequence: row.next_sequence,
  lastAcknowledgedSequence: row.last_acknowledged_sequence, activeReleaseId: row.active_release_id,
  activeHash: row.active_hash,
  revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
  revocationIdempotencyKey: row.revocation_idempotency_key,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

interface ReleaseSummaryWire extends Omit<SiteReleaseSummary,
  'siteId' | 'sourceVersion' | 'schemaVersion' | 'parentReleaseId'
  | 'artifactHash' | 'artifactBytes' | 'manifestHash' | 'keyId' | 'idempotencyKey'
  | 'createdBy' | 'createdAt'> {
  site_id: string; source_version: number; schema_version: number; parent_release_id: string | null;
  artifact_hash: string; artifact_bytes: number; artifact_blob: GatewayBlobDescriptorV1;
  manifest_hash: string; key_id: string;
  idempotency_key: string; created_by: string; created_at: string;
}
interface ReleaseWire extends ReleaseSummaryWire { hosted_files: SiteRelease['hostedFiles'] }

const checkedBlob = (row: ReleaseSummaryWire) => {
  validateGatewayBlobDescriptor(row.artifact_blob);
  if (row.artifact_blob.hash !== row.artifact_hash || row.artifact_blob.bytes !== row.artifact_bytes) {
    throw new GatewayError('gateway release blob metadata does not match the release', 'INVALID_RESPONSE');
  }
  return row.artifact_blob;
};
const toReleaseSummary = (row: ReleaseSummaryWire): SiteReleaseSummary => {
  checkedBlob(row);
  return {
    id: row.id, siteId: row.site_id, sequence: row.sequence, sourceVersion: row.source_version,
    schemaVersion: row.schema_version, parentReleaseId: row.parent_release_id,
    artifactHash: row.artifact_hash, artifactBytes: row.artifact_bytes,
    manifest: row.manifest, manifestHash: row.manifest_hash, signature: row.signature, keyId: row.key_id,
    files: row.files, pages: row.pages, cms: row.cms, assets: row.assets, scripts: row.scripts,
    audit: row.audit, idempotencyKey: row.idempotency_key, createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString()
  };
};
const toRelease = (row: ReleaseWire, artifact: Uint8Array): SiteRelease => ({
  id: row.id, siteId: row.site_id, sequence: row.sequence, sourceVersion: row.source_version,
  schemaVersion: row.schema_version, parentReleaseId: row.parent_release_id,
  artifactHash: row.artifact_hash, artifactBytes: row.artifact_bytes,
  artifact: new Uint8Array(artifact), hostedFiles: row.hosted_files,
  manifest: row.manifest,
  manifestHash: row.manifest_hash, signature: row.signature, keyId: row.key_id,
  files: row.files, pages: row.pages, cms: row.cms, assets: row.assets, scripts: row.scripts,
  audit: row.audit, idempotencyKey: row.idempotency_key, createdBy: row.created_by,
  createdAt: new Date(row.created_at).toISOString()
});

interface ReleaseReservationWire {
  site_id: string; idempotency_key: string; release_id: string; sequence: number;
  parent_release_id: string | null; created_by: string; created_at: string; completed_at: string | null;
}
const toReleaseReservation = (row: ReleaseReservationWire): ReleaseReservation => ({
  siteId: row.site_id, idempotencyKey: row.idempotency_key, releaseId: row.release_id,
  sequence: row.sequence, parentReleaseId: row.parent_release_id, createdBy: row.created_by,
  createdAt: new Date(row.created_at).toISOString(),
  completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
});

interface TargetWire {
  release_id: string; connection_id: string; sequence: number; envelope: string;
  signature: string; key_id: string; created_at: string;
}
const toTarget = (row: TargetWire): ReleaseTarget => ({
  releaseId: row.release_id, connectionId: row.connection_id, sequence: row.sequence,
  envelope: row.envelope, signature: row.signature, keyId: row.key_id,
  createdAt: new Date(row.created_at).toISOString()
});

interface DeploymentWire {
  id: string; connection_id: string; release_id: string; sequence: number;
  status: Deployment['status']; active_hash: string | null; error: string | null;
  detail: Deployment['detail']; idempotency_key: string; body_hash: string; created_at: string;
}
const toDeployment = (row: DeploymentWire): Deployment => ({
  id: row.id, connectionId: row.connection_id, releaseId: row.release_id,
  sequence: row.sequence, status: row.status, activeHash: row.active_hash, error: row.error,
  detail: row.detail, idempotencyKey: row.idempotency_key, bodyHash: row.body_hash,
  createdAt: new Date(row.created_at).toISOString()
});
interface WebhookWire {
  event_id: string; connection_id: string; release_id: string; target_sequence: number;
  webhook_url: string; payload: Record<string, unknown> | string; body_hash: string;
  signature: string; key_id: string; attempts: number; next_attempt_at: string;
  locked_at: string | null; locked_by: string | null; delivered_at: string | null;
  last_error: string | null; created_at: string;
}
const toWebhook = (row: WebhookWire): WebhookOutboxEvent => ({
  eventId: row.event_id, connectionId: row.connection_id, releaseId: row.release_id,
  targetSequence: row.target_sequence, webhookUrl: row.webhook_url,
  payload: typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload),
  bodyHash: row.body_hash, signature: row.signature, keyId: row.key_id,
  attempts: row.attempts, nextAttemptAt: new Date(row.next_attempt_at).toISOString(),
  lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null, lockedBy: row.locked_by,
  deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
  lastError: row.last_error, createdAt: new Date(row.created_at).toISOString()
});

interface GrantWire {
  digest: string; kind: ConnectedGrantKind; site_id: string | null; connection_id: string | null;
  payload: Record<string, unknown>; expires_at: string; used_at: string | null; created_at: string;
}
const toGrant = (row: GrantWire): ConnectedGrant => ({
  digest: row.digest, kind: row.kind, siteId: row.site_id, connectionId: row.connection_id,
  payload: row.payload, expiresAt: new Date(row.expires_at).toISOString(),
  usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString()
});
interface EditorCredentialWire {
  digest: string; connection_id: string; site_id: string; owner_id: string;
  expires_at: string; created_at: string;
}
const toEditorCredential = (row: EditorCredentialWire): ConnectedEditorCredential => ({
  digest: row.digest, connectionId: row.connection_id, siteId: row.site_id, ownerId: row.owner_id,
  expiresAt: new Date(row.expires_at).toISOString(), createdAt: new Date(row.created_at).toISOString()
});

interface WordPressContentIndexWire {
  connection_id: string; generation: number | string; body_hash: string;
  items: WordPressContentIndexSnapshot['items']; synced_at: string;
}
const toWordPressContentIndex = (row: WordPressContentIndexWire): WordPressContentIndexSnapshot => ({
  connectionId: row.connection_id, generation: Number(row.generation), bodyHash: row.body_hash,
  items: row.items, syncedAt: new Date(row.synced_at).toISOString()
});

/** Connected WordPress store over the same fixed-operation HTTPS gateway as sites/assets/auth. */
export class GatewayConnectedStore implements ConnectedStore {
  private gateway: PagecraftGateway;
  constructor(gateway: PagecraftGateway) { this.gateway = gateway; }

  private async artifactFor(row: ReleaseSummaryWire) {
    const descriptor = checkedBlob(row);
    const chunks: GatewayBlobChunkV1[] = [];
    /* Four bounded reads at a time avoids an N-request latency chain without turning one
       WordPress pull into an unbounded Edge Function burst. */
    for (let start = 0; start < descriptor.chunkCount; start += 4) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(4, descriptor.chunkCount - start) }, async (_, offset) => {
          const chunk = await this.gateway.call<GatewayBlobChunkV1 | null>('release.artifactChunk', {
            id: row.id, index: start + offset
          });
          if (!chunk) throw new GatewayError('release artifact chunk is unavailable', 'INVALID_RESPONSE');
          return chunk;
        })
      );
      chunks.push(...batch);
    }
    return assembleGatewayBlob(descriptor, chunks);
  }
  async createConnection(input: Omit<WordPressConnection,
    'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'>) {
    return toConnection(await this.gateway.call<ConnectionWire>('connection.create', { input }));
  }
  async connection(id: string) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.byId', { id });
    return row ? toConnection(row) : null;
  }
  async connectionsForSite(siteId: string) {
    return (await this.gateway.call<ConnectionWire[]>('connection.forSite', { siteId })).map(toConnection);
  }
  async connectionHistoryForSite(siteId: string) {
    return (await this.gateway.call<ConnectionWire[]>('connection.historyForSite', { siteId })).map(toConnection);
  }
  async canonicalProductionConnection(siteId: string) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.canonicalProduction', { siteId });
    return row ? toConnection(row) : null;
  }
  async authorizationConnection(digest: string, now: string) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.authorization', { digest, now });
    return row ? toConnection(row) : null;
  }
  async useAuthorizationCode(digest: string, now: string) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.useCode', { digest, now });
    return row ? toConnection(row) : null;
  }
  async provisionConnection(id: string, input: {
    accessTokenDigest: string; accessTokenExpiresAt: string; refreshTokenDigest: string;
    confirmationExpiresAt: string;
  }) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.provision', { id, ...input });
    return row ? toConnection(row) : null;
  }
  async confirmConnection(input: {
    id: string; accessTokenDigest: string; installationId: string; now: string;
  }) {
    const result = await this.gateway.call<{
      connection: ConnectionWire; alreadyConfirmed: boolean;
    } | null>('connection.confirm', input);
    return result
      ? { connection: toConnection(result.connection), alreadyConfirmed: result.alreadyConfirmed }
      : null;
  }
  async connectionByAccessToken(digest: string, now: string) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.byAccess', { digest, now });
    return row ? toConnection(row) : null;
  }
  async connectionByRefreshToken(digest: string) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.byRefresh', { digest });
    return row ? toConnection(row) : null;
  }
  async rotateAccessToken(id: string, digest: string, expiresAt: string) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.rotateAccess', { id, digest, expiresAt });
    return row ? toConnection(row) : null;
  }
  async revokeConnection(input: {
    id: string; accessTokenDigest?: string | null; refreshTokenDigest?: string | null;
    idempotencyKey: string; now: string;
  }): Promise<ConnectionRevocationResult> {
    const result = await this.gateway.call<
      | { ok: true; connection: ConnectionWire; alreadyRevoked: boolean }
      | { ok: false; error: 'unauthorized' | 'idempotency-conflict' }
    >('connection.revoke', input);
    return result.ok
      ? { ok: true, connection: toConnection(result.connection), alreadyRevoked: result.alreadyRevoked }
      : result;
  }
  async setPendingRelease(id: string, releaseId: string | null) {
    const row = await this.gateway.call<ConnectionWire | null>('connection.setPending', { id, releaseId });
    return row ? toConnection(row) : null;
  }
  async putGrant(input: Omit<ConnectedGrant, 'usedAt' | 'createdAt'>) {
    return toGrant(await this.gateway.call<GrantWire>('grant.put', { input }));
  }
  async consumeGrant(digest: string, kind: ConnectedGrantKind, now: string) {
    const row = await this.gateway.call<GrantWire | null>('grant.consume', { digest, kind, now });
    return row ? toGrant(row) : null;
  }
  async putEditorCredential(input: Omit<ConnectedEditorCredential, 'createdAt'>) {
    return toEditorCredential(await this.gateway.call<EditorCredentialWire>('editorCredential.put', { input }));
  }
  async editorCredential(digest: string, now: string) {
    const row = await this.gateway.call<EditorCredentialWire | null>('editorCredential.get', { digest, now });
    return row ? toEditorCredential(row) : null;
  }
  async replaceWordPressContentIndex(input: WordPressContentIndexSnapshot): Promise<WordPressContentIndexResult> {
    const result = await this.gateway.call<
      | { ok: true; snapshot: WordPressContentIndexWire; duplicate: boolean }
      | { ok: false; error: 'unknown-connection' | 'connection-inactive' | 'stale-generation' | 'generation-conflict' }
    >('contentIndex.replace', { input });
    return result.ok
      ? { ok: true, snapshot: toWordPressContentIndex(result.snapshot), duplicate: result.duplicate }
      : result;
  }
  async wordpressContentIndexesForSite(siteId: string) {
    return (await this.gateway.call<WordPressContentIndexWire[]>('contentIndex.forSite', { siteId }))
      .map(toWordPressContentIndex);
  }
  async reserveRelease(input: Omit<ReleaseReservation,
    'sequence' | 'parentReleaseId' | 'createdAt' | 'completedAt'>) {
    return toReleaseReservation(await this.gateway.call<ReleaseReservationWire>('release.reserve', { input }));
  }
  async createRelease(release: SiteRelease) {
    const split = splitGatewayBlob(release.artifact);
    if (split.descriptor.hash !== release.artifactHash || split.descriptor.bytes !== release.artifactBytes) {
      throw new Error('release artifact does not match its declared hash and size');
    }
    for (let start = 0; start < split.chunks.length; start += 4) {
      await Promise.all(split.chunks.slice(start, start + 4).map(chunk =>
        this.gateway.call('release.blob.putChunk', { blob: split.descriptor, chunk })));
    }
    const { artifact: _artifact, ...metadata } = release;
    const result = await this.gateway.call<{ row: ReleaseWire; created: boolean }>('release.create', {
      release: { ...metadata, artifactBlob: split.descriptor }
    });
    const stored = checkedBlob(result.row);
    if (stored.hash !== split.descriptor.hash || stored.bytes !== split.descriptor.bytes) {
      throw new GatewayError(
        'idempotency key already belongs to a different release artifact', 'IDEMPOTENCY_CONFLICT'
      );
    }
    return { release: toRelease(result.row, release.artifact), created: result.created };
  }
  async release(id: string) {
    const row = await this.gateway.call<ReleaseWire | null>('release.byId', { id });
    return row ? toRelease(row, await this.artifactFor(row)) : null;
  }
  async commitReleasePublication(input: {
    siteId: string; releaseId: string; sourceVersion: number; releaseSequence: number; publishedAt: string;
  }, _publishHosted: () => Promise<{ publishedVersion: number; publishedReleaseId: string | null } | null>) {
    return this.gateway.call<{
      publishedVersion: number; publishedReleaseId: string | null;
    } | null>('release.commitPublication', input);
  }
  async markReleasePublished(releaseId: string, publishedAt: string) {
    return this.gateway.call<boolean>('release.markPublished', { releaseId, publishedAt });
  }
  async releasesForSite(siteId: string) {
    return (await this.gateway.call<ReleaseSummaryWire[]>('release.forSite', { siteId })).map(toReleaseSummary);
  }
  async createTarget(target: ReleaseTarget, desired: boolean) {
    const result = await this.gateway.call<{ row: TargetWire; created: boolean }>('target.create', { target, desired });
    return { target: toTarget(result.row), created: result.created };
  }
  async target(connectionId: string, releaseId: string) {
    const row = await this.gateway.call<TargetWire | null>('target.byRelease', { connectionId, releaseId });
    return row ? toTarget(row) : null;
  }
  async desiredTarget(connectionId: string) {
    const result = await this.gateway.call<{
      connection: ConnectionWire; release: ReleaseSummaryWire; target: TargetWire;
    } | null>('target.desired', { connectionId });
    return result ? {
      connection: toConnection(result.connection),
      release: toReleaseSummary(result.release), target: toTarget(result.target)
    } : null;
  }
  async deploymentsForRelease(releaseId: string) {
    return (await this.gateway.call<DeploymentWire[]>('deployment.forRelease', { releaseId })).map(toDeployment);
  }
  async recordDeployment(input: Omit<Deployment, 'id' | 'createdAt'>): Promise<DeploymentResult> {
    const result = await this.gateway.call<{
      ok: boolean; duplicate?: boolean; error?: DeploymentResult['error'];
      deployment?: DeploymentWire; connection?: ConnectionWire;
    }>('deployment.record', { input });
    return {
      ...result,
      deployment: result.deployment ? toDeployment(result.deployment) : undefined,
      connection: result.connection ? toConnection(result.connection) : undefined
    };
  }
  async enqueueWebhook(input: Omit<WebhookOutboxEvent,
    'attempts' | 'nextAttemptAt' | 'lockedAt' | 'lockedBy' | 'deliveredAt' | 'lastError' | 'createdAt'>) {
    return toWebhook(await this.gateway.call<WebhookWire>('webhook.enqueue', { input }));
  }
  async claimWebhooks(worker: string, limit: number) {
    return (await this.gateway.call<WebhookWire[]>('webhook.claim', { worker, limit })).map(toWebhook);
  }
  async settleWebhook(eventId: string, delivered: boolean, nextAttemptAt: string, error?: string) {
    await this.gateway.call<boolean>('webhook.settle', { eventId, delivered, nextAttemptAt, error });
  }
}

interface AssetMetaWire {
  id: string; site_id: string; name: string; type: string; w: number; h: number;
  owner_id?: string | null; stored_bytes?: number | string | null;
  original_bytes?: number | string | null; content_hash?: string | null; optimized?: boolean;
}
interface AssetWire extends AssetMetaWire {
  bytes: string;
}

const toAssetRecord = (row: AssetMetaWire): AssetRecord => ({
  id: row.id, siteId: row.site_id, name: row.name, type: row.type, w: row.w, h: row.h,
  ownerId: row.owner_id || undefined,
  storedBytes: row.stored_bytes == null ? undefined : Number(row.stored_bytes),
  originalBytes: row.original_bytes == null ? undefined : Number(row.original_bytes),
  contentHash: row.content_hash || undefined,
  optimized: row.optimized
});

const toAsset = (row: AssetWire): Asset => ({
  id: row.id, siteId: row.site_id, name: row.name, type: row.type,
  w: row.w, h: row.h, bytes: new Uint8Array(Buffer.from(row.bytes, 'base64')),
  ownerId: row.owner_id || undefined,
  storedBytes: row.stored_bytes == null ? undefined : Number(row.stored_bytes),
  originalBytes: row.original_bytes == null ? undefined : Number(row.original_bytes),
  contentHash: row.content_hash || undefined,
  optimized: row.optimized
});

export class GatewayAssetStore implements AssetStore {
  private gateway: PagecraftGateway;
  constructor(gateway: PagecraftGateway) { this.gateway = gateway; }

  async list(siteId: string) {
    return (await this.gateway.call<AssetMetaWire[]>('asset.list', { siteId })).map(toAssetRecord);
  }
  async get(siteId: string, id: string) {
    const row = await this.gateway.call<AssetWire | null>('asset.get', { siteId, id });
    return row ? toAsset(row) : null;
  }
  async byPath(siteId: string, path: string) {
    const row = await this.gateway.call<AssetWire | null>('asset.byPath', { siteId, path });
    return row ? toAsset(row) : null;
  }
  async put(asset: Omit<Asset, 'id'> & { id?: string }, quota?: AssetQuota) {
    if (asset.bytes.byteLength > MAX_BYTES) {
      throw new RangeError(`asset exceeds the ${MAX_BYTES}-byte limit`);
    }
    const id = asset.id || 'a' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const split = splitGatewayBlob(asset.bytes);
    for (let start = 0; start < split.chunks.length; start += 4) {
      await Promise.all(split.chunks.slice(start, start + 4).map(chunk =>
        this.gateway.call('asset.blob.putChunk', { blob: split.descriptor, chunk })));
    }
    try {
      const row = await this.gateway.call<AssetMetaWire>('asset.putBlob', {
        asset: {
          id, siteId: asset.siteId, name: asset.name, type: asset.type,
          w: asset.w, h: asset.h, blob: split.descriptor,
          ownerId: quota?.ownerId, limitBytes: quota?.limitBytes,
          originalBytes: quota?.originalBytes, optimized: quota?.optimized,
          contentHash: asset.contentHash
        }
      });
      return toAssetRecord(row);
    } catch (error) {
      if (error instanceof GatewayError && error.code === 'STORAGE_LIMIT' && quota) {
        throw new AssetQuotaError(await this.usage(quota.ownerId, quota.limitBytes));
      }
      throw error;
    }
  }
  async putConnected(
    asset: Omit<Asset, 'id'> & { id: string }, connectionId: string,
    _active?: () => Promise<boolean>, quota?: AssetQuota
  ) {
    if (asset.bytes.byteLength > MAX_BYTES) {
      throw new RangeError(`asset exceeds the ${MAX_BYTES}-byte limit`);
    }
    const split = splitGatewayBlob(asset.bytes);
    for (let start = 0; start < split.chunks.length; start += 4) {
      await Promise.all(split.chunks.slice(start, start + 4).map(chunk =>
        this.gateway.call('asset.blob.putChunk', { blob: split.descriptor, chunk })));
    }
    try {
      const row = await this.gateway.call<AssetMetaWire | null>('asset.putBlobConnected', {
        connectionId,
        asset: {
          id: asset.id, siteId: asset.siteId, name: asset.name, type: asset.type,
          w: asset.w, h: asset.h, blob: split.descriptor,
          ownerId: quota?.ownerId, limitBytes: quota?.limitBytes,
          originalBytes: quota?.originalBytes, optimized: quota?.optimized,
          contentHash: asset.contentHash
        }
      });
      return row ? toAssetRecord(row) : null;
    } catch (error) {
      if (error instanceof GatewayError && error.code === 'STORAGE_LIMIT' && quota) {
        throw new AssetQuotaError(await this.usage(quota.ownerId, quota.limitBytes));
      }
      throw error;
    }
  }
  async remove(siteId: string, id: string) {
    return this.gateway.call<boolean>('asset.remove', { siteId, id });
  }
  async usage(ownerId: string, limitBytes = FREE_STORAGE_BYTES) {
    const usedBytes = await this.gateway.call<number>('asset.usage', { ownerId });
    return { usedBytes: Number(usedBytes || 0), limitBytes };
  }
}

interface UserWire { id: string; email: string; name: string; auth_user_id?: string | null }
interface SessionWire { digest: string; user_id: string; expires_at: string }
interface MembershipWire { site_id: string; user_id: string; role: Role; email?: string; name?: string }
interface AccessWire extends UserWire { role: Role | null }
interface ManualImportWire {
  id:string; owner_id:string; installation_id:string; access_token_digest:string;
  access_expires_at:string; refresh_token_digest:string; status:'active'|'revoked';
  created_at:string; updated_at:string; revoked_at:string|null;
}
const toManualImport = (row: ManualImportWire): ManualImportCredential => ({
  id: row.id, ownerId: row.owner_id, installationId: row.installation_id,
  accessTokenDigest: row.access_token_digest, accessExpiresAt: new Date(row.access_expires_at).getTime(),
  refreshTokenDigest: row.refresh_token_digest, status: row.status,
  createdAt: new Date(row.created_at).getTime(), updatedAt: new Date(row.updated_at).getTime(),
  revokedAt: row.revoked_at ? new Date(row.revoked_at).getTime() : null
});

const toMembership = (row: MembershipWire): Membership => ({
  siteId: row.site_id, userId: row.user_id, role: row.role
});
const toUser = (row: UserWire): User => ({
  id: row.id, email: row.email, name: row.name, authUserId: row.auth_user_id ?? null
});

export class GatewayAuthStore implements AuthStore {
  private gateway: PagecraftGateway;
  constructor(gateway: PagecraftGateway) { this.gateway = gateway; }

  userByEmail(email: string) {
    return this.gateway.call<UserWire | null>('auth.userByEmail', { email: normalEmail(email) })
      .then(row => row ? toUser(row) : null);
  }
  userById(id: string) {
    return this.gateway.call<UserWire | null>('auth.userById', { id }).then(row => row ? toUser(row) : null);
  }
  userByAuthId(authUserId: string) {
    return this.gateway.call<UserWire | null>('auth.userByAuthId', { authUserId })
      .then(row => row ? toUser(row) : null);
  }
  ensureAuthUser(authUserId: string, email: string, name = '') {
    return this.gateway.call<UserWire>('auth.ensureAuthUser', {
      id: crypto.randomUUID(), authUserId, email: normalEmail(email), name: name.trim()
    }).then(toUser);
  }
  usersByIds(ids: string[]) {
    return ids.length
      ? this.gateway.call<UserWire[]>('auth.usersByIds', { ids: [...new Set(ids)] }).then(rows => rows.map(toUser))
      : Promise.resolve([]);
  }
  createUser(email: string, name = '') {
    return this.gateway.call<UserWire>('auth.createUser', {
      id: crypto.randomUUID(), email: normalEmail(email), name
    }).then(toUser);
  }
  async putLink(digest: string, email: string, expiresAt: number) {
    await this.gateway.call('auth.putLink', {
      digest, email: normalEmail(email), expiresAt: new Date(expiresAt).toISOString()
    });
  }
  async useLink(digest: string) {
    const row = await this.gateway.call<{ email: string; expires_at: string } | null>('auth.useLink', { digest });
    if (!row) return null;
    return new Date(row.expires_at).getTime() > Date.now() ? { email: row.email } : null;
  }
  async putSession(digest: string, userId: string, expiresAt: number) {
    await this.gateway.call('auth.putSession', {
      digest, userId, expiresAt: new Date(expiresAt).toISOString()
    });
  }
  async sessionByDigest(digest: string) {
    const row = await this.gateway.call<SessionWire | null>('auth.sessionByDigest', { digest });
    if (!row) return null;
    const expiresAt = new Date(row.expires_at).getTime();
    if (expiresAt <= Date.now()) {
      await this.dropSession(digest);
      return null;
    }
    const session: Session = { token: row.digest, userId: row.user_id, expiresAt };
    return session;
  }
  userForSession(digest: string) {
    return this.gateway.call<UserWire | null>('auth.userForSession', { digest })
      .then(row => row ? toUser(row) : null);
  }
  async accessForSession(digest: string, siteId: string) {
    const row = await this.gateway.call<AccessWire | null>('auth.accessForSession', { digest, siteId });
    if (!row) return null;
    return { user: toUser(row), role: row.role };
  }
  async dropSession(digest: string) { await this.gateway.call('auth.dropSession', { digest }); }
  async membership(siteId: string, userId: string) {
    const row = await this.gateway.call<MembershipWire | null>('auth.membership', { siteId, userId });
    return row ? toMembership(row) : null;
  }
  async membershipsForUser(userId: string) {
    return (await this.gateway.call<MembershipWire[]>('auth.membershipsForUser', { userId })).map(toMembership);
  }
  async grant(siteId: string, userId: string, role: Role) {
    return toMembership(await this.gateway.call<MembershipWire>('auth.grant', { siteId, userId, role }));
  }
  async members(siteId: string) {
    return (await this.gateway.call<MembershipWire[]>('auth.members', { siteId })).map(row => ({
      ...toMembership(row), email: row.email || '', name: row.name || ''
    }));
  }
  revoke(siteId: string, userId: string) {
    return this.gateway.call<boolean>('auth.revoke', { siteId, userId });
  }
  async createManualImportCredential(input: Omit<ManualImportCredential,
    'status' | 'createdAt' | 'updatedAt' | 'revokedAt'>) {
    return toManualImport(await this.gateway.call<ManualImportWire>('auth.manualImport.create', { input }));
  }
  async manualImportByAccess(digest: string) {
    const row = await this.gateway.call<ManualImportWire|null>('auth.manualImport.byAccess', { digest });
    return row ? toManualImport(row) : null;
  }
  async manualImportByRefresh(digest: string) {
    const row = await this.gateway.call<ManualImportWire|null>('auth.manualImport.byRefresh', { digest });
    return row ? toManualImport(row) : null;
  }
  async rotateManualImportAccess(id: string, digest: string, expiresAt: number) {
    const row = await this.gateway.call<ManualImportWire|null>('auth.manualImport.rotate', {
      id, digest, expiresAt: new Date(expiresAt).toISOString()
    });
    return row ? toManualImport(row) : null;
  }
  revokeManualImportCredential(id: string, refreshDigest: string) {
    return this.gateway.call<boolean>('auth.manualImport.revoke', { id, refreshDigest });
  }
}
