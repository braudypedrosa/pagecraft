import type {
  ReleaseAssetV1, ReleaseFileV1, ReleaseManifestV1, ReleasePageV1, ReleaseScriptV1
} from './releases.ts';

export type ConnectionEnvironment = 'staging' | 'production';
export type ConnectionStatus = 'pending' | 'provisioned' | 'active' | 'revoked';
export type DeploymentStatus =
  | 'queued' | 'downloading' | 'staged' | 'needs_approval'
  | 'activating' | 'verifying' | 'live' | 'failed' | 'rolled_back';

export interface WordPressConnection {
  id: string;
  siteId: string;
  /** Pagecraft owner who explicitly approved this target. */
  createdBy: string;
  installationId: string;
  environment: ConnectionEnvironment;
  profile: 'existing-theme' | 'pagecraft-theme';
  targetOrigin: string;
  targetPath: string;
  redirectUri: string;
  /** Fixed at consent time; releases cannot redirect notifications elsewhere. */
  webhookUrl: string;
  scopes: string[];
  status: ConnectionStatus;
  codeChallenge: string;
  authorizationCodeDigest: string;
  authorizationCodeExpiresAt: string;
  authorizationCodeUsedAt: string | null;
  /** A provisioned credential must be confirmed by WordPress before this deadline. */
  confirmationExpiresAt: string | null;
  /** Set only after WordPress has durably stored the credential and confirmed the binding. */
  confirmedAt: string | null;
  accessTokenDigest: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenDigest: string | null;
  desiredReleaseId: string | null;
  pendingReleaseId: string | null;
  nextSequence: number;
  lastAcknowledgedSequence: number;
  activeReleaseId: string | null;
  activeHash: string | null;
  revokedAt: string | null;
  revocationIdempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionRevocationResult =
  | { ok: true; connection: WordPressConnection; alreadyRevoked: boolean }
  | { ok: false; error: 'unauthorized' | 'idempotency-conflict' };

export interface ReleaseAudit {
  acknowledgeWarnings: boolean;
  warningCodes: string[];
  warningCount: number;
  errorCodes: string[];
  errorCount: number;
}

export interface SiteRelease {
  id: string;
  siteId: string;
  sequence: number;
  sourceVersion: number;
  schemaVersion: number;
  parentReleaseId: string | null;
  artifactHash: string;
  artifactBytes: number;
  artifact: Uint8Array;
  /** Full static export frozen for Pagecraft-hosted review. It is server-side only and is
      never delivered to or interpreted by the WordPress connector. */
  hostedFiles: Array<{ path: string; content: string; bytes: number; hash: string }>;
  manifest: string;
  manifestHash: string;
  signature: string;
  keyId: string;
  files: ReleaseFileV1[];
  pages: ReleasePageV1[];
  cms: ReleaseManifestV1['cms'];
  assets: ReleaseAssetV1[];
  scripts: ReleaseScriptV1[];
  audit: ReleaseAudit;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
}

/** Metadata used by release history and target polling. Large immutable bodies are loaded only
    by `release(id)`, never by list/desired control-plane reads. */
export type SiteReleaseSummary = Omit<SiteRelease, 'artifact' | 'hostedFiles'>;

export const summarizeRelease = (release: SiteRelease): SiteReleaseSummary => {
  const { artifact: _artifact, hostedFiles: _hostedFiles, ...summary } = release;
  return structuredClone(summary);
};

export interface ReleaseReservation {
  siteId: string;
  idempotencyKey: string;
  releaseId: string;
  sequence: number;
  parentReleaseId: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

export interface ReleaseTarget {
  releaseId: string;
  connectionId: string;
  sequence: number;
  envelope: string;
  signature: string;
  keyId: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  connectionId: string;
  releaseId: string;
  sequence: number;
  status: DeploymentStatus;
  activeHash: string | null;
  error: string | null;
  detail: { code?: string; message?: string; action?: string; stage?: string } | null;
  idempotencyKey: string;
  /** SHA-256 of the exact normalized acknowledgement body. */
  bodyHash: string;
  createdAt: string;
}

export interface DeploymentResult {
  ok: boolean;
  deployment?: Deployment;
  connection?: WordPressConnection;
  duplicate?: boolean;
  error?: 'unknown-target' | 'connection-inactive' | 'wrong-sequence' | 'replay'
    | 'wrong-hash' | 'status-conflict' | 'idempotency-conflict';
}

export interface WebhookOutboxEvent {
  eventId: string;
  connectionId: string;
  releaseId: string;
  targetSequence: number;
  webhookUrl: string;
  payload: string;
  bodyHash: string;
  signature: string;
  keyId: string;
  attempts: number;
  nextAttemptAt: string;
  lockedAt: string | null;
  lockedBy: string | null;
  deliveredAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export type ConnectedGrantKind = 'oauth-consent' | 'editor-code' | 'package-download';
export interface ConnectedGrant {
  digest: string;
  kind: ConnectedGrantKind;
  siteId: string | null;
  connectionId: string | null;
  payload: Record<string, unknown>;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface ConnectedEditorCredential {
  digest: string;
  connectionId: string;
  siteId: string;
  ownerId: string;
  expiresAt: string;
  createdAt: string;
}

/** A native WordPress object exposed only as a link destination in Pagecraft. The connector
 * owns these records and Pagecraft deliberately stores no editable post body or field data. */
export interface WordPressContentIndexItem {
  id: string;
  objectType: 'page' | 'post';
  title: string;
  url: string;
  modifiedAt: string;
}

/** One complete, monotonically versioned snapshot for a paired WordPress installation.
 * Replacing the whole bounded snapshot gives deletions deterministic reconciliation semantics. */
export interface WordPressContentIndexSnapshot {
  connectionId: string;
  generation: number;
  bodyHash: string;
  items: WordPressContentIndexItem[];
  syncedAt: string;
}

export type WordPressContentIndexResult =
  | { ok: true; snapshot: WordPressContentIndexSnapshot; duplicate: boolean }
  | { ok: false; error: 'unknown-connection' | 'connection-inactive' | 'stale-generation' | 'generation-conflict' };

export interface HostedReleaseCommit {
  publishedVersion: number;
  publishedReleaseId: string | null;
}

export interface ConnectedStore {
  createConnection(input: Omit<WordPressConnection,
    'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'>): Promise<WordPressConnection>;
  connection(id: string): Promise<WordPressConnection | null>;
  connectionsForSite(siteId: string): Promise<WordPressConnection[]>;
  /** Includes revoked pairings so an old target-specific editor value can never be mistaken
      for a portable external URL after a WordPress installation is replaced. */
  connectionHistoryForSite(siteId: string): Promise<WordPressConnection[]>;
  canonicalProductionConnection(siteId: string): Promise<WordPressConnection | null>;
  authorizationConnection(digest: string, now: string): Promise<WordPressConnection | null>;
  useAuthorizationCode(digest: string, now: string): Promise<WordPressConnection | null>;
  provisionConnection(id: string, input: {
    accessTokenDigest: string; accessTokenExpiresAt: string; refreshTokenDigest: string;
    confirmationExpiresAt: string;
  }): Promise<WordPressConnection | null>;
  confirmConnection(input: {
    id: string; accessTokenDigest: string; installationId: string; now: string;
  }): Promise<{ connection: WordPressConnection; alreadyConfirmed: boolean } | null>;
  connectionByAccessToken(digest: string, now: string): Promise<WordPressConnection | null>;
  connectionByRefreshToken(digest: string): Promise<WordPressConnection | null>;
  rotateAccessToken(id: string, digest: string, expiresAt: string): Promise<WordPressConnection | null>;
  revokeConnection(input: {
    id: string; accessTokenDigest?: string | null; refreshTokenDigest?: string | null;
    idempotencyKey: string; now: string;
  }): Promise<ConnectionRevocationResult>;
  setPendingRelease(id: string, releaseId: string | null): Promise<WordPressConnection | null>;
  putGrant(input: Omit<ConnectedGrant, 'usedAt' | 'createdAt'>): Promise<ConnectedGrant>;
  consumeGrant(digest: string, kind: ConnectedGrantKind, now: string): Promise<ConnectedGrant | null>;
  putEditorCredential(input: Omit<ConnectedEditorCredential, 'createdAt'>): Promise<ConnectedEditorCredential>;
  editorCredential(digest: string, now: string): Promise<ConnectedEditorCredential | null>;
  replaceWordPressContentIndex(input: WordPressContentIndexSnapshot): Promise<WordPressContentIndexResult>;
  wordpressContentIndexesForSite(siteId: string): Promise<WordPressContentIndexSnapshot[]>;

  reserveRelease(input: Omit<ReleaseReservation,
    'sequence' | 'parentReleaseId' | 'createdAt' | 'completedAt'>): Promise<ReleaseReservation>;
  createRelease(release: SiteRelease): Promise<{ release: SiteRelease; created: boolean }>;
  /** Atomically coordinate the hosted pointer and deployable publication marker. Database
      implementations perform both writes in one transaction; Memory uses the supplied CAS. */
  commitReleasePublication(input: {
    siteId: string; releaseId: string; sourceVersion: number; releaseSequence: number; publishedAt: string;
  }, publishHosted: () => Promise<HostedReleaseCommit | null>): Promise<HostedReleaseCommit | null>;
  /** Finalize the release after the canonical hosted pointer has committed. Targets and
      ordered release listings exclude every release until this marker exists. */
  markReleasePublished(releaseId: string, publishedAt: string): Promise<boolean>;
  release(id: string): Promise<SiteRelease | null>;
  releasesForSite(siteId: string): Promise<SiteReleaseSummary[]>;
  createTarget(target: ReleaseTarget, desired: boolean): Promise<{ target: ReleaseTarget; created: boolean }>;
  target(connectionId: string, releaseId: string): Promise<ReleaseTarget | null>;
  desiredTarget(connectionId: string): Promise<{
    connection: WordPressConnection; release: SiteReleaseSummary; target: ReleaseTarget;
  } | null>;
  deploymentsForRelease(releaseId: string): Promise<Deployment[]>;
  recordDeployment(input: Omit<Deployment, 'id' | 'createdAt'>): Promise<DeploymentResult>;
  enqueueWebhook(input: Omit<WebhookOutboxEvent,
    'attempts' | 'nextAttemptAt' | 'lockedAt' | 'lockedBy' | 'deliveredAt' | 'lastError' | 'createdAt'>): Promise<WebhookOutboxEvent>;
  claimWebhooks(worker: string, limit: number): Promise<WebhookOutboxEvent[]>;
  settleWebhook(eventId: string, delivered: boolean, nextAttemptAt: string, error?: string): Promise<void>;
}

const NEXT_DEPLOYMENT: Record<DeploymentStatus, ReadonlySet<DeploymentStatus>> = {
  queued: new Set(['downloading', 'failed']),
  downloading: new Set(['staged', 'failed']),
  staged: new Set(['needs_approval', 'activating', 'failed']),
  needs_approval: new Set(['activating', 'failed']),
  activating: new Set(['verifying', 'failed', 'rolled_back']),
  verifying: new Set(['live', 'failed', 'rolled_back']),
  live: new Set(['rolled_back']),
  failed: new Set(['rolled_back']),
  rolled_back: new Set()
};

export const validDeploymentTransition = (from: DeploymentStatus | null, to: DeploymentStatus) =>
  from === null ? to === 'queued' : NEXT_DEPLOYMENT[from].has(to);

/** A reservation is a short worker lease, not an immortal gap in the release chain. A site
 * may have only one unbuilt reservation, so reclaiming its stable id and sequence after expiry
 * is safe: no later release can have been allocated or signed as its child. */
export const RELEASE_RESERVATION_LEASE_MS = 5 * 60 * 1000;

export class MemoryConnectedStore implements ConnectedStore {
  private connections = new Map<string, WordPressConnection>();
  private releases = new Map<string, SiteRelease>();
  private releaseFinalizations = new Map<string, { status: 'published' | 'aborted'; finalizedAt: string }>();
  private reservations = new Map<string, ReleaseReservation>();
  private targets = new Map<string, ReleaseTarget>();
  private deployments: Deployment[] = [];
  private webhooks = new Map<string, WebhookOutboxEvent>();
  private grants = new Map<string, ConnectedGrant>();
  private editorCredentials = new Map<string, ConnectedEditorCredential>();
  private wordpressContentIndexes = new Map<string, WordPressContentIndexSnapshot>();
  private publicationCommits = new Set<string>();
  private previousAccessTokens = new Map<string, { digest: string; expiresAt: string }>();
  private clock: () => number;

  constructor(clock: () => number = Date.now) { this.clock = clock; }

  async createConnection(input: Omit<WordPressConnection,
    'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'>) {
    if (this.connections.has(input.id)) throw new Error('connection already exists');
    const now = new Date(this.clock()).toISOString();
    /* An abandoned OAuth consent must not reserve an installation, environment, or target
       forever. Once its authorization code has expired it has no remaining authority, so
       retire it before applying the live-binding uniqueness rules to a new consent. Keep the
       row as an audit record instead of deleting it. */
    for (const connection of this.connections.values()) {
      const pairingDeadline = connection.status === 'provisioned'
        ? connection.confirmationExpiresAt : connection.authorizationCodeExpiresAt;
      if (!['pending', 'provisioned'].includes(connection.status)
        || !pairingDeadline || new Date(pairingDeadline).getTime() > this.clock()) continue;
      connection.status = 'revoked';
      connection.revokedAt = now;
      connection.revocationIdempotencyKey = `expired-pairing-${connection.id}`;
      connection.desiredReleaseId = null;
      connection.pendingReleaseId = null;
      connection.updatedAt = now;
    }
    for (const connection of this.connections.values()) {
      if (connection.status === 'revoked') continue;
      if (connection.siteId === input.siteId && connection.environment === input.environment) {
        throw new Error(`site already has a ${input.environment} connection`);
      }
      if (connection.installationId === input.installationId) {
        throw new Error('WordPress installation is already paired');
      }
      if (connection.targetOrigin === input.targetOrigin && connection.targetPath === input.targetPath) {
        throw new Error('WordPress target is already paired');
      }
    }
    const connection: WordPressConnection = {
      ...structuredClone(input), revokedAt: null, revocationIdempotencyKey: null,
      createdAt: now, updatedAt: now
    };
    this.connections.set(connection.id, connection);
    return this.copyConnection(connection);
  }

  async connection(id: string) {
    const connection = this.connections.get(id);
    return connection ? this.copyConnection(connection) : null;
  }

  async connectionsForSite(siteId: string) {
    return [...this.connections.values()]
      .filter(connection => connection.siteId === siteId && connection.status !== 'revoked')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(connection => this.copyConnection(connection));
  }

  async connectionHistoryForSite(siteId: string) {
    return [...this.connections.values()]
      .filter(connection => connection.siteId === siteId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(connection => this.copyConnection(connection));
  }

  async canonicalProductionConnection(siteId: string) {
    const connection = [...this.connections.values()]
      .filter(candidate => candidate.siteId === siteId && candidate.environment === 'production'
        && !!candidate.confirmedAt)
      .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')
        || b.createdAt.localeCompare(a.createdAt))[0];
    return connection ? this.copyConnection(connection) : null;
  }

  async authorizationConnection(digest: string, now: string) {
    const connection = [...this.connections.values()].find(candidate =>
      candidate.authorizationCodeDigest === digest
      && ((candidate.status === 'pending'
        && new Date(candidate.authorizationCodeExpiresAt).getTime() > new Date(now).getTime())
        || (candidate.status === 'provisioned' && !!candidate.confirmationExpiresAt
          && new Date(candidate.confirmationExpiresAt).getTime() > new Date(now).getTime())));
    return connection ? this.copyConnection(connection) : null;
  }

  async useAuthorizationCode(digest: string, now: string) {
    const connection = [...this.connections.values()].find(candidate =>
      candidate.authorizationCodeDigest === digest
      && ((candidate.status === 'pending'
        && new Date(candidate.authorizationCodeExpiresAt).getTime() > new Date(now).getTime())
        || (candidate.status === 'provisioned' && !!candidate.confirmationExpiresAt
          && new Date(candidate.confirmationExpiresAt).getTime() > new Date(now).getTime())));
    if (!connection) return null;
    connection.authorizationCodeUsedAt ||= now;
    connection.updatedAt = now;
    return this.copyConnection(connection);
  }

  async provisionConnection(id: string, input: {
    accessTokenDigest: string; accessTokenExpiresAt: string; refreshTokenDigest: string;
    confirmationExpiresAt: string;
  }) {
    const connection = this.connections.get(id);
    if (!connection || !['pending', 'provisioned'].includes(connection.status)
      || !connection.authorizationCodeUsedAt) return null;
    const confirmationExpiresAt = connection.confirmationExpiresAt || input.confirmationExpiresAt;
    Object.assign(connection, input, {
      status: 'provisioned' as const, confirmationExpiresAt, updatedAt: new Date().toISOString()
    });
    this.previousAccessTokens.delete(id);
    return this.copyConnection(connection);
  }

  async confirmConnection(input: {
    id: string; accessTokenDigest: string; installationId: string; now: string;
  }) {
    const connection = this.connections.get(input.id);
    if (!connection || connection.installationId !== input.installationId
      || connection.accessTokenDigest !== input.accessTokenDigest) return null;
    if (connection.status === 'active') {
      return { connection: this.copyConnection(connection), alreadyConfirmed: true };
    }
    if (connection.status !== 'provisioned' || !connection.confirmationExpiresAt
      || new Date(connection.confirmationExpiresAt).getTime() <= new Date(input.now).getTime()
      || !connection.accessTokenExpiresAt
      || new Date(connection.accessTokenExpiresAt).getTime() <= new Date(input.now).getTime()) return null;
    connection.status = 'active';
    connection.confirmedAt = input.now;
    connection.updatedAt = input.now;
    return { connection: this.copyConnection(connection), alreadyConfirmed: false };
  }

  async connectionByAccessToken(digest: string, now: string) {
    const at = new Date(now).getTime();
    const connection = [...this.connections.values()].find(candidate => {
      if (candidate.status !== 'active') return false;
      if (candidate.accessTokenDigest === digest && candidate.accessTokenExpiresAt
        && new Date(candidate.accessTokenExpiresAt).getTime() > at) return true;
      const previous = this.previousAccessTokens.get(candidate.id);
      return previous?.digest === digest && new Date(previous.expiresAt).getTime() > at;
    });
    return connection ? this.copyConnection(connection) : null;
  }

  async connectionByRefreshToken(digest: string) {
    const connection = [...this.connections.values()].find(candidate =>
      ['provisioned', 'active'].includes(candidate.status) && candidate.refreshTokenDigest === digest);
    return connection ? this.copyConnection(connection) : null;
  }

  async rotateAccessToken(id: string, digest: string, expiresAt: string) {
    const connection = this.connections.get(id);
    if (!connection || (connection.status !== 'active'
      && (connection.status !== 'provisioned' || !connection.confirmationExpiresAt
        || new Date(connection.confirmationExpiresAt).getTime() <= this.clock()))) return null;
    if (connection.accessTokenDigest && connection.accessTokenExpiresAt) {
      this.previousAccessTokens.set(id, {
        digest: connection.accessTokenDigest,
        expiresAt: new Date(Math.min(
          new Date(connection.accessTokenExpiresAt).getTime(), this.clock() + 2 * 60 * 1000
        )).toISOString()
      });
    } else this.previousAccessTokens.delete(id);
    connection.accessTokenDigest = digest;
    connection.accessTokenExpiresAt = expiresAt;
    connection.updatedAt = new Date().toISOString();
    return this.copyConnection(connection);
  }

  async revokeConnection(input: {
    id: string; accessTokenDigest?: string | null; refreshTokenDigest?: string | null;
    idempotencyKey: string; now: string;
  }): Promise<ConnectionRevocationResult> {
    const connection = this.connections.get(input.id);
    const currentAccessMatches = !!input.accessTokenDigest
      && connection?.accessTokenDigest === input.accessTokenDigest;
    const previous = connection ? this.previousAccessTokens.get(connection.id) : null;
    const previousAccessMatches = !!input.accessTokenDigest && previous?.digest === input.accessTokenDigest;
    const accessMatches = currentAccessMatches || previousAccessMatches;
    const accessExpiresAt = currentAccessMatches ? connection?.accessTokenExpiresAt : previous?.expiresAt;
    const refreshMatches = !!input.refreshTokenDigest
      && connection?.refreshTokenDigest === input.refreshTokenDigest;
    if (!connection || connection.status === 'pending' || (!accessMatches && !refreshMatches)) {
      return { ok: false, error: 'unauthorized' };
    }
    if (connection.status === 'revoked') {
      if (connection.revocationIdempotencyKey !== input.idempotencyKey
        && !connection.revocationIdempotencyKey?.startsWith('expired-pairing-')) {
        return { ok: false, error: 'idempotency-conflict' };
      }
      return { ok: true, connection: this.copyConnection(connection), alreadyRevoked: true };
    }
    if (!refreshMatches && (!accessMatches || !accessExpiresAt
      || new Date(accessExpiresAt).getTime() <= new Date(input.now).getTime())) {
      return { ok: false, error: 'unauthorized' };
    }
    connection.status = 'revoked';
    if (previousAccessMatches && input.accessTokenDigest) connection.accessTokenDigest = input.accessTokenDigest;
    connection.revokedAt = input.now;
    connection.revocationIdempotencyKey = input.idempotencyKey;
    /* Retain credential digests only as proof for an exact response-loss retry. The revoked
       status excludes this row from every access/refresh lookup and token rotation path. */
    connection.desiredReleaseId = null;
    connection.pendingReleaseId = null;
    connection.updatedAt = input.now;
    this.previousAccessTokens.delete(connection.id);
    for (const [digest, credential] of this.editorCredentials) {
      if (credential.connectionId === connection.id) this.editorCredentials.delete(digest);
    }
    return { ok: true, connection: this.copyConnection(connection), alreadyRevoked: false };
  }

  async setPendingRelease(id: string, releaseId: string | null) {
    const connection = this.connections.get(id);
    if (!connection || connection.status !== 'active') return null;
    connection.pendingReleaseId = releaseId;
    connection.updatedAt = new Date().toISOString();
    return this.copyConnection(connection);
  }

  async putGrant(input: Omit<ConnectedGrant, 'usedAt' | 'createdAt'>) {
    if (this.grants.has(input.digest)) throw new Error('grant digest already exists');
    const grant: ConnectedGrant = {
      ...structuredClone(input), usedAt: null, createdAt: new Date().toISOString()
    };
    this.grants.set(grant.digest, grant);
    return structuredClone(grant);
  }

  async consumeGrant(digest: string, kind: ConnectedGrantKind, now: string) {
    const grant = this.grants.get(digest);
    if (!grant || grant.kind !== kind || grant.usedAt
      || new Date(grant.expiresAt).getTime() <= new Date(now).getTime()) return null;
    grant.usedAt = new Date(now).toISOString();
    return structuredClone(grant);
  }

  async putEditorCredential(input: Omit<ConnectedEditorCredential, 'createdAt'>) {
    if (this.editorCredentials.has(input.digest)) throw new Error('editor credential digest already exists');
    const credential = { ...structuredClone(input), createdAt: new Date().toISOString() };
    this.editorCredentials.set(credential.digest, credential);
    return structuredClone(credential);
  }

  async editorCredential(digest: string, now: string) {
    const credential = this.editorCredentials.get(digest);
    const connection = credential ? this.connections.get(credential.connectionId) : null;
    if (!credential || !connection || connection.status !== 'active'
      || new Date(credential.expiresAt).getTime() <= new Date(now).getTime()) return null;
    return structuredClone(credential);
  }

  async replaceWordPressContentIndex(input: WordPressContentIndexSnapshot): Promise<WordPressContentIndexResult> {
    const connection = this.connections.get(input.connectionId);
    if (!connection) return { ok: false, error: 'unknown-connection' };
    if (connection.status !== 'active') return { ok: false, error: 'connection-inactive' };
    const current = this.wordpressContentIndexes.get(input.connectionId);
    if (current && input.generation < current.generation) {
      return { ok: false, error: 'stale-generation' };
    }
    if (current && input.generation === current.generation) {
      if (input.bodyHash !== current.bodyHash) return { ok: false, error: 'generation-conflict' };
      return { ok: true, snapshot: structuredClone(current), duplicate: true };
    }
    const snapshot = structuredClone(input);
    this.wordpressContentIndexes.set(input.connectionId, snapshot);
    return { ok: true, snapshot: structuredClone(snapshot), duplicate: false };
  }

  async wordpressContentIndexesForSite(siteId: string) {
    return [...this.connections.values()]
      .filter(connection => connection.siteId === siteId && connection.status === 'active')
      .map(connection => this.wordpressContentIndexes.get(connection.id))
      .filter((snapshot): snapshot is WordPressContentIndexSnapshot => !!snapshot)
      .sort((a, b) => a.connectionId.localeCompare(b.connectionId))
      .map(snapshot => structuredClone(snapshot));
  }

  async reserveRelease(input: Omit<ReleaseReservation,
    'sequence' | 'parentReleaseId' | 'createdAt' | 'completedAt'>) {
    if (this.publicationCommits.has(input.siteId)) {
      throw new Error('another release is still being finalized; retry shortly');
    }
    const key = `${input.siteId}:${input.idempotencyKey}`;
    const existing = this.reservations.get(key);
    if (existing) {
      if (this.releaseFinalizations.get(existing.releaseId)?.status === 'aborted') {
        throw new Error('idempotency key belongs to an abandoned release; use a new key');
      }
      return structuredClone(existing);
    }
    const siteReservations = [...this.reservations.values()].filter(item => item.siteId === input.siteId);
    const releases = [...this.releases.values()].filter(item => item.siteId === input.siteId);
    const now = this.clock();
    const unbuilt = siteReservations.filter(item => !this.releaseFinalizations.has(item.releaseId))
      .sort((a, b) => b.sequence - a.sequence)[0];
    if (unbuilt) {
      if (new Date(unbuilt.createdAt).getTime() > now - RELEASE_RESERVATION_LEASE_MS) {
        throw new Error('another release is still being finalized; retry shortly');
      }
      if (!this.releases.has(unbuilt.releaseId)) {
        this.reservations.delete(`${unbuilt.siteId}:${unbuilt.idempotencyKey}`);
        const reclaimed: ReleaseReservation = {
          ...unbuilt, idempotencyKey: input.idempotencyKey, createdBy: input.createdBy,
          createdAt: new Date(now).toISOString()
        };
        this.reservations.set(key, reclaimed);
        return structuredClone(reclaimed);
      }
      /* A built release cannot be reassigned to different source content. Finalize the stale
         identity as an immutable tombstone and allocate the later publish a new sequence. */
      this.releaseFinalizations.set(unbuilt.releaseId, {
        status: 'aborted', finalizedAt: new Date(now).toISOString()
      });
    }
    const sequence = Math.max(0, ...siteReservations.map(item => item.sequence), ...releases.map(item => item.sequence)) + 1;
    const parent = releases.filter(item => this.releaseFinalizations.get(item.id)?.status === 'published')
      .sort((a, b) => b.sequence - a.sequence)[0] || null;
    const reservation: ReleaseReservation = {
      ...structuredClone(input), sequence, parentReleaseId: parent?.id || null,
      createdAt: new Date(now).toISOString(), completedAt: null
    };
    this.reservations.set(key, reservation);
    return structuredClone(reservation);
  }

  async createRelease(release: SiteRelease) {
    const sameKey = [...this.releases.values()].find(candidate =>
      candidate.siteId === release.siteId && candidate.idempotencyKey === release.idempotencyKey);
    if (sameKey) return { release: this.copyRelease(sameKey), created: false };
    const reservation = this.reservations.get(`${release.siteId}:${release.idempotencyKey}`);
    if (!reservation || reservation.releaseId !== release.id || reservation.sequence !== release.sequence
      || reservation.parentReleaseId !== release.parentReleaseId || reservation.createdBy !== release.createdBy) {
      throw new Error('release does not match its durable sequence reservation');
    }
    if (this.releases.has(release.id)) throw new Error('release already exists');
    const copy = this.copyRelease(release);
    this.releases.set(copy.id, copy);
    reservation.completedAt = new Date(this.clock()).toISOString();
    return { release: this.copyRelease(copy), created: true };
  }

  async release(id: string) {
    const release = this.releases.get(id);
    return release ? this.copyRelease(release) : null;
  }

  async commitReleasePublication(input: {
    siteId: string; releaseId: string; sourceVersion: number; releaseSequence: number; publishedAt: string;
  }, publishHosted: () => Promise<HostedReleaseCommit | null>) {
    const release = this.releases.get(input.releaseId);
    if (!release || release.siteId !== input.siteId || release.sourceVersion !== input.sourceVersion
      || release.sequence !== input.releaseSequence
      || this.releaseFinalizations.get(input.releaseId)?.status === 'aborted') return null;
    if (this.publicationCommits.has(input.siteId)) {
      throw new Error('another release is still being finalized; retry shortly');
    }
    this.publicationCommits.add(input.siteId);
    try {
      const published = await publishHosted();
      if (!published) return null;
      /* A delayed publisher can lose the hosted-pointer CAS to a newer release. Return the
         current pointer to the caller, but never turn that older immutable build into a
         deployable release merely because its callback completed later. */
      if (published.publishedReleaseId !== input.releaseId) return published;
      const finalized = this.releaseFinalizations.get(input.releaseId);
      if (finalized?.status === 'aborted') return null;
      if (!finalized) this.releaseFinalizations.set(input.releaseId, {
        status: 'published', finalizedAt: input.publishedAt
      });
      return published;
    } finally {
      this.publicationCommits.delete(input.siteId);
    }
  }

  async markReleasePublished(releaseId: string, publishedAt: string) {
    if (!this.releases.has(releaseId)) return false;
    const finalized = this.releaseFinalizations.get(releaseId);
    if (finalized) return finalized.status === 'published';
    this.releaseFinalizations.set(releaseId, { status: 'published', finalizedAt: publishedAt });
    return true;
  }

  async releasesForSite(siteId: string) {
    return [...this.releases.values()]
      .filter(release => release.siteId === siteId
        && this.releaseFinalizations.get(release.id)?.status === 'published')
      .sort((a, b) => b.sequence - a.sequence)
      .map(summarizeRelease);
  }

  async createTarget(target: ReleaseTarget, desired: boolean) {
    const key = this.targetKey(target.connectionId, target.releaseId);
    const existing = this.targets.get(key);
    const connection = this.connections.get(target.connectionId);
    const release = this.releases.get(target.releaseId);
    if (existing) {
      if (!connection || !release || connection.status !== 'active'
        || this.releaseFinalizations.get(release.id)?.status !== 'published') {
        throw new Error('release target does not belong to an active connection');
      }
      if (desired) {
        const active = connection.activeReleaseId ? this.releases.get(connection.activeReleaseId) : null;
        if (active && active.sequence >= release.sequence) {
          return { target: structuredClone(existing), created: false };
        }
        if (existing.sequence <= connection.lastAcknowledgedSequence
          || connection.activeReleaseId === target.releaseId) {
          return { target: structuredClone(existing), created: false };
        }
        if (connection.desiredReleaseId && connection.desiredReleaseId !== target.releaseId) {
          throw new Error('another release is already desired for this connection');
        }
        connection.desiredReleaseId = target.releaseId;
        if (connection.pendingReleaseId === target.releaseId) connection.pendingReleaseId = null;
        connection.updatedAt = new Date().toISOString();
      }
      return { target: structuredClone(existing), created: false };
    }
    if (!connection || !release || this.releaseFinalizations.get(release.id)?.status !== 'published'
      || connection.siteId !== release.siteId || connection.status !== 'active') {
      throw new Error('release target does not belong to an active connection');
    }
    const active = connection.activeReleaseId ? this.releases.get(connection.activeReleaseId) : null;
    if (active && active.sequence >= release.sequence) {
      throw new Error('release target is not newer than the active release');
    }
    if (target.sequence !== connection.nextSequence) throw new Error('release target sequence is not next');
    const copy = structuredClone(target);
    this.targets.set(key, copy);
    connection.nextSequence += 1;
    if (desired) {
      connection.desiredReleaseId = target.releaseId;
      if (connection.pendingReleaseId === target.releaseId) connection.pendingReleaseId = null;
    }
    connection.updatedAt = new Date().toISOString();
    return { target: structuredClone(copy), created: true };
  }

  async target(connectionId: string, releaseId: string) {
    const target = this.targets.get(this.targetKey(connectionId, releaseId));
    return target ? structuredClone(target) : null;
  }

  async desiredTarget(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'active' || !connection.desiredReleaseId) return null;
    const release = this.releases.get(connection.desiredReleaseId);
    const target = this.targets.get(this.targetKey(connectionId, connection.desiredReleaseId));
    if (!release || !target) return null;
    return {
      connection: this.copyConnection(connection),
      release: summarizeRelease(release),
      target: structuredClone(target)
    };
  }

  async deploymentsForRelease(releaseId: string) {
    return this.deployments.filter(item => item.releaseId === releaseId).map(item => structuredClone(item));
  }

  async recordDeployment(input: Omit<Deployment, 'id' | 'createdAt'>): Promise<DeploymentResult> {
    const connection = this.connections.get(input.connectionId);
    if (!connection) return { ok: false, error: 'unknown-target' };
    if (connection.status !== 'active') return { ok: false, error: 'connection-inactive' };
    const duplicate = this.deployments.find(item =>
      item.connectionId === input.connectionId && item.idempotencyKey === input.idempotencyKey);
    if (duplicate && duplicate.bodyHash !== input.bodyHash) {
      return { ok: false, error: 'idempotency-conflict' };
    }
    if (duplicate) return {
      ok: true, duplicate: true, deployment: structuredClone(duplicate),
      connection: this.copyConnection(connection)
    };
    const release = this.releases.get(input.releaseId);
    const target = this.targets.get(this.targetKey(input.connectionId, input.releaseId));
    if (!connection || !release || !target || connection.siteId !== release.siteId) return { ok: false, error: 'unknown-target' };
    if (input.sequence !== target.sequence) return { ok: false, error: 'wrong-sequence' };
    if (input.sequence < connection.lastAcknowledgedSequence) return { ok: false, error: 'replay' };
    if (input.status === 'live' && input.activeHash !== release.artifactHash) {
      return { ok: false, error: 'wrong-hash' };
    }
    const rollbackRelease = input.status === 'rolled_back' && input.activeHash
      ? [...this.releases.values()].find(candidate => candidate.siteId === connection.siteId
        && candidate.artifactHash === input.activeHash
        && this.releaseFinalizations.get(candidate.id)?.status === 'published') : null;
    if (input.status === 'rolled_back' && !rollbackRelease) {
      return { ok: false, error: 'wrong-hash' };
    }
    const history = this.deployments.filter(item => item.connectionId === input.connectionId
      && item.releaseId === input.releaseId && item.sequence === input.sequence);
    const prior = history.at(-1);
    if (!validDeploymentTransition(prior?.status || null, input.status)) return { ok: false, error: 'status-conflict' };
    const deployment: Deployment = {
      ...structuredClone(input), id: crypto.randomUUID(), createdAt: new Date().toISOString()
    };
    this.deployments.push(deployment);
    if (input.status === 'live') {
      connection.lastAcknowledgedSequence = input.sequence;
      connection.activeReleaseId = input.releaseId;
      connection.activeHash = input.activeHash;
      if (connection.desiredReleaseId === input.releaseId) connection.desiredReleaseId = null;
      if (connection.pendingReleaseId === input.releaseId) connection.pendingReleaseId = null;
      connection.updatedAt = deployment.createdAt;
      if (connection.environment === 'staging') {
        const production = [...this.connections.values()].find(candidate =>
          candidate.siteId === connection.siteId && candidate.environment === 'production'
          && candidate.status === 'active');
        const active = production?.activeReleaseId
          ? this.releases.get(production.activeReleaseId) : null;
        const pending = production?.pendingReleaseId
          ? this.releases.get(production.pendingReleaseId) : null;
        if (production && production.activeReleaseId !== input.releaseId
          && (!active || active.sequence < release.sequence)
          && (!pending || pending.sequence <= release.sequence)) {
          production.pendingReleaseId = input.releaseId;
          production.updatedAt = deployment.createdAt;
        }
      }
    }
    if (input.status === 'rolled_back' && rollbackRelease) {
      connection.activeReleaseId = rollbackRelease.id;
      connection.activeHash = rollbackRelease.artifactHash;
      connection.updatedAt = deployment.createdAt;
    }
    if (input.status === 'failed' || input.status === 'rolled_back') {
      if (connection.desiredReleaseId === input.releaseId) connection.desiredReleaseId = null;
      if (connection.pendingReleaseId === input.releaseId) connection.pendingReleaseId = null;
      connection.updatedAt = deployment.createdAt;
    }
    /* Failure is an observation and does not erase the last known-good active pointer. */
    return {
      ok: true, deployment: structuredClone(deployment), connection: this.copyConnection(connection)
    };
  }

  async enqueueWebhook(input: Omit<WebhookOutboxEvent,
    'attempts' | 'nextAttemptAt' | 'lockedAt' | 'lockedBy' | 'deliveredAt' | 'lastError' | 'createdAt'>) {
    const sameTarget = [...this.webhooks.values()].find(item =>
      item.connectionId === input.connectionId && item.releaseId === input.releaseId);
    if (sameTarget) {
      if (sameTarget.bodyHash !== input.bodyHash) throw new Error('webhook idempotency conflict');
      return structuredClone(sameTarget);
    }
    const now = new Date().toISOString();
    const event: WebhookOutboxEvent = {
      ...structuredClone(input), attempts: 0, nextAttemptAt: now,
      lockedAt: null, lockedBy: null, deliveredAt: null, lastError: null, createdAt: now
    };
    this.webhooks.set(event.eventId, event);
    return structuredClone(event);
  }

  async claimWebhooks(worker: string, limit: number) {
    const now = Date.now();
    return [...this.webhooks.values()]
      .filter(item => !item.deliveredAt && new Date(item.nextAttemptAt).getTime() <= now
        && (!item.lockedAt || new Date(item.lockedAt).getTime() < now - 5 * 60 * 1000))
      .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))
      .slice(0, Math.max(1, Math.min(limit, 100)))
      .map(item => {
        item.lockedAt = new Date(now).toISOString(); item.lockedBy = worker; item.attempts += 1;
        return structuredClone(item);
      });
  }

  async settleWebhook(eventId: string, delivered: boolean, nextAttemptAt: string, error?: string) {
    const event = this.webhooks.get(eventId);
    if (!event) return;
    event.lockedAt = null; event.lockedBy = null;
    event.lastError = error ? error.slice(0, 2000) : null;
    event.nextAttemptAt = nextAttemptAt;
    if (delivered) event.deliveredAt = new Date().toISOString();
  }

  private targetKey(connectionId: string, releaseId: string) { return `${connectionId}:${releaseId}`; }
  private copyConnection(connection: WordPressConnection) { return structuredClone(connection); }
  private copyRelease(release: SiteRelease): SiteRelease {
    return { ...structuredClone(release), artifact: new Uint8Array(release.artifact) };
  }
}
