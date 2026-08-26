import { test } from 'vitest';
import a from 'node:assert/strict';
import { canonicalJson, sha256 } from '../src/releases.ts';
import {
  MemoryConnectedStore, RELEASE_RESERVATION_LEASE_MS,
  type DeploymentStatus, type SiteRelease, type WordPressConnection
} from '../src/release-store.ts';

const digest = (value: unknown) => sha256(new TextEncoder().encode(canonicalJson(value)));
const connectionInput = (id: string, environment: 'staging' | 'production' = 'staging'):
  Omit<WordPressConnection, 'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'> => ({
  id, siteId: 'site-1', createdBy: 'owner-1', installationId: `install-${id}`,
  environment, profile: 'existing-theme', targetOrigin: `https://${id}.example`, targetPath: '/',
  redirectUri: `https://${id}.example/wp-admin/admin.php?page=pagecraft`,
  webhookUrl: `https://${id}.example/wp-json/pagecraft/v1/releases/available`,
  scopes: ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'], status: 'active',
  codeChallenge: 'x'.repeat(43), authorizationCodeDigest: digest(`code:${id}`),
  authorizationCodeExpiresAt: '2030-01-01T00:00:00.000Z',
  authorizationCodeUsedAt: '2026-08-26T00:00:00.000Z',
  confirmationExpiresAt: null, confirmedAt: '2026-08-26T00:00:01.000Z',
  accessTokenDigest: digest(`access:${id}`), accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
  refreshTokenDigest: digest(`refresh:${id}`), desiredReleaseId: null, pendingReleaseId: null,
  nextSequence: 1, lastAcknowledgedSequence: 0, activeReleaseId: null, activeHash: null
});

async function release(store: MemoryConnectedStore, key: string, hash: string,
  published = true): Promise<SiteRelease> {
  const reservation = await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: key, releaseId: `release-${key}`, createdBy: 'owner-1'
  });
  const made: SiteRelease = {
    id: reservation.releaseId, siteId: reservation.siteId, sequence: reservation.sequence,
    sourceVersion: reservation.sequence, schemaVersion: 13, parentReleaseId: reservation.parentReleaseId,
    artifactHash: hash, artifactBytes: 2, artifact: new Uint8Array([1, reservation.sequence]),
    hostedFiles: [],
    manifest: `manifest-${key}`, manifestHash: digest(`manifest-${key}`), signature: `signature-${key}`,
    keyId: 'release-key', files: [], pages: [], cms: { collections: [] }, assets: [], scripts: [],
    audit: { acknowledgeWarnings: true, warningCodes: [], warningCount: 0, errorCodes: [], errorCount: 0 },
    idempotencyKey: key, createdBy: reservation.createdBy, createdAt: reservation.createdAt
  };
  const created = (await store.createRelease(made)).release;
  if (published) a.deepEqual(await store.commitReleasePublication({
    siteId: created.siteId, releaseId: created.id, sourceVersion: created.sourceVersion,
    releaseSequence: created.sequence, publishedAt: created.createdAt
  }, async () => ({ publishedVersion: created.sourceVersion, publishedReleaseId: created.id })), {
    publishedVersion: created.sourceVersion, publishedReleaseId: created.id
  });
  return created;
}

async function target(store: MemoryConnectedStore, connectionId: string, item: SiteRelease, sequence: number) {
  return (await store.createTarget({
    connectionId, releaseId: item.id, sequence, envelope: `envelope-${item.id}`,
    signature: `signature-${item.id}`, keyId: 'release-key', createdAt: new Date().toISOString()
  }, true)).target;
}

async function ack(store: MemoryConnectedStore, connectionId: string, item: SiteRelease,
  sequence: number, status: DeploymentStatus, key: string, activeHash: string | null = null) {
  const body = {
    connectionId, releaseId: item.id, sequence, status, activeHash,
    error: status === 'failed' ? 'injected failure' : null, detail: { stage: status },
    idempotencyKey: key
  };
  return store.recordDeployment({ ...body, bodyHash: digest(body) });
}

test('pairing uniqueness and one-time grants are durable store invariants', async () => {
  const store = new MemoryConnectedStore();
  await store.createConnection(connectionInput('staging'));
  await a.rejects(() => store.createConnection({ ...connectionInput('second'), environment: 'staging' }),
    /already has a staging connection/);
  await store.createConnection(connectionInput('production', 'production'));
  await a.rejects(() => store.createConnection({
    ...connectionInput('clone', 'production'), installationId: 'install-staging'
  }), /already paired|already has a production/);

  const expiresAt = '2030-01-01T00:00:00.000Z';
  await store.putGrant({
    digest: digest('grant'), kind: 'editor-code', siteId: 'site-1', connectionId: 'staging',
    payload: { installationId: 'install-staging' }, expiresAt
  });
  a.ok(await store.consumeGrant(digest('grant'), 'editor-code', '2026-08-26T00:00:00.000Z'));
  a.equal(await store.consumeGrant(digest('grant'), 'editor-code', '2026-08-26T00:00:01.000Z'), null,
    'a second worker cannot redeem the same digest');
  await store.putEditorCredential({
    digest: digest('session'), connectionId: 'staging', siteId: 'site-1',
    ownerId: 'owner-1', expiresAt
  });
  a.equal((await store.editorCredential(digest('session'), '2026-08-26T00:00:00.000Z'))?.siteId, 'site-1');
});

test('memory WordPress content snapshots replace atomically and fence stale generations', async () => {
  const store = new MemoryConnectedStore();
  await store.createConnection(connectionInput('staging'));
  const first = {
    connectionId: 'staging', generation: 1, bodyHash: digest(['about']),
    items: [{
      id: 'wp:page:2', objectType: 'page' as const, title: 'About',
      url: 'https://staging.example/about/', modifiedAt: '2026-08-26T01:00:00.000Z'
    }], syncedAt: '2026-08-26T02:00:00.000Z'
  };
  a.deepEqual(await store.replaceWordPressContentIndex(first), {
    ok: true, snapshot: first, duplicate: false
  });
  a.equal((await store.replaceWordPressContentIndex(first)).ok, true);
  a.deepEqual(await store.replaceWordPressContentIndex({
    ...first, bodyHash: digest(['different'])
  }), { ok: false, error: 'generation-conflict' });
  const empty = { ...first, generation: 2, bodyHash: digest([]), items: [] };
  a.equal((await store.replaceWordPressContentIndex(empty)).ok, true);
  a.deepEqual((await store.wordpressContentIndexesForSite('site-1'))[0].items, []);
  a.deepEqual(await store.replaceWordPressContentIndex(first), {
    ok: false, error: 'stale-generation'
  });
  await store.revokeConnection({
    id: 'staging', accessTokenDigest: digest('access:staging'),
    idempotencyKey: 'disconnect-content-index', now: '2026-08-26T03:00:00.000Z'
  });
  a.deepEqual(await store.wordpressContentIndexesForSite('site-1'), [],
    'revoked target catalogues are no longer offered to editors');
  a.deepEqual((await store.connectionHistoryForSite('site-1')).map(item => item.id), ['staging'],
    'the revoked target scope remains available to publication preflight');
});

test('expired pending pairing is retired so the same WordPress target can pair again', async () => {
  const now = Date.parse('2026-08-26T12:00:00.000Z');
  const store = new MemoryConnectedStore(() => now);
  const abandoned = {
    ...connectionInput('abandoned'), status: 'pending' as const,
    authorizationCodeUsedAt: null, authorizationCodeExpiresAt: '2026-08-26T11:59:59.000Z',
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await store.createConnection(abandoned);
  const replacement = {
    ...connectionInput('replacement'), status: 'pending' as const,
    installationId: abandoned.installationId, targetOrigin: abandoned.targetOrigin,
    targetPath: abandoned.targetPath, authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await store.createConnection(replacement);
  a.equal((await store.connection('abandoned'))?.status, 'revoked');
  a.equal((await store.connection('abandoned'))?.revocationIdempotencyKey,
    'expired-pairing-abandoned');
  a.equal((await store.connection('replacement'))?.status, 'pending');
  a.deepEqual((await store.connectionsForSite('site-1')).map(item => item.id), ['replacement']);
  a.deepEqual((await store.connectionHistoryForSite('site-1')).map(item => item.id), [
    'abandoned', 'replacement'
  ]);
});

test('provisioned OAuth credentials remain recoverable after code expiry and require confirmation', async () => {
  let clock = Date.parse('2026-08-26T12:00:00.000Z');
  const store = new MemoryConnectedStore(() => clock);
  const pending = {
    ...connectionInput('two-phase'), status: 'pending' as const,
    authorizationCodeExpiresAt: '2026-08-26T12:10:00.000Z', authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await store.createConnection(pending);
  a.ok(await store.useAuthorizationCode(pending.authorizationCodeDigest, '2026-08-26T12:01:00.000Z'));
  const provisioned = await store.provisionConnection(pending.id, {
    accessTokenDigest: digest('two-phase-access'),
    accessTokenExpiresAt: '2026-08-26T12:30:00.000Z',
    refreshTokenDigest: digest('two-phase-refresh'),
    confirmationExpiresAt: '2026-08-26T12:31:00.000Z'
  });
  a.equal(provisioned?.status, 'provisioned');
  clock = Date.parse('2026-08-26T12:12:00.000Z');
  a.equal((await store.authorizationConnection(
    pending.authorizationCodeDigest, new Date(clock).toISOString()))?.status, 'provisioned',
  'the used code remains recoverable inside the separate confirmation window');
  a.equal(await store.connectionByAccessToken(digest('two-phase-access'), new Date(clock).toISOString()), null,
    'provisioned credentials cannot authenticate active APIs');
  a.equal(await store.confirmConnection({
    id: pending.id, accessTokenDigest: digest('two-phase-access'), installationId: 'wrong',
    now: new Date(clock).toISOString()
  }), null);
  const confirmed = await store.confirmConnection({
    id: pending.id, accessTokenDigest: digest('two-phase-access'),
    installationId: pending.installationId, now: new Date(clock).toISOString()
  });
  a.equal(confirmed?.connection.status, 'active');
  a.equal(confirmed?.alreadyConfirmed, false);
  a.equal((await store.confirmConnection({
    id: pending.id, accessTokenDigest: digest('two-phase-access'),
    installationId: pending.installationId, now: new Date(clock).toISOString()
  }))?.alreadyConfirmed, true);
});

test('expired unconfirmed credentials are retired so owner consent can pair the target again', async () => {
  let clock = Date.parse('2026-08-26T12:00:00.000Z');
  const store = new MemoryConnectedStore(() => clock);
  const pending = {
    ...connectionInput('unconfirmed'), status: 'pending' as const,
    authorizationCodeExpiresAt: '2026-08-26T12:10:00.000Z', authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await store.createConnection(pending);
  await store.useAuthorizationCode(pending.authorizationCodeDigest, '2026-08-26T12:01:00.000Z');
  await store.provisionConnection(pending.id, {
    accessTokenDigest: digest('lost-access'), accessTokenExpiresAt: '2026-08-26T12:16:00.000Z',
    refreshTokenDigest: digest('lost-refresh'), confirmationExpiresAt: '2026-08-26T12:31:00.000Z'
  });
  clock = Date.parse('2026-08-26T12:32:00.000Z');
  const replacement = {
    ...pending, id: 'replacement-unconfirmed', authorizationCodeDigest: digest('replacement-code'),
    authorizationCodeUsedAt: null, confirmationExpiresAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null,
    authorizationCodeExpiresAt: '2026-08-26T12:42:00.000Z'
  };
  await store.createConnection(replacement);
  a.equal((await store.connection(pending.id))?.status, 'revoked');
  a.equal((await store.connection(pending.id))?.revocationIdempotencyKey,
    `expired-pairing-${pending.id}`);
  a.equal((await store.connection(replacement.id))?.status, 'pending');
  const cleanup = await store.revokeConnection({
    id: pending.id, accessTokenDigest: digest('lost-access'),
    idempotencyKey: 'wp-revoke-original-installation', now: new Date(clock).toISOString()
  });
  a.equal(cleanup.ok, true);
  if (cleanup.ok) a.equal(cleanup.alreadyRevoked, true,
    'an auto-expired provisioned binding accepts authenticated local cleanup');
});

test('Disconnect invalidates editor sessions, permits only the exact expired retry, and retains canonical ownership', async () => {
  const store = new MemoryConnectedStore();
  await store.createConnection(connectionInput('production', 'production'));
  await store.putEditorCredential({
    digest: digest('editor-after-disconnect'), connectionId: 'production', siteId: 'site-1',
    ownerId: 'owner-1', expiresAt: '2040-01-01T00:00:00.000Z'
  });
  const input = {
    id: 'production', accessTokenDigest: digest('access:production'),
    idempotencyKey: 'disconnect-memory', now: '2026-08-26T00:00:00.000Z'
  };
  const revoked = await store.revokeConnection(input);
  a.equal(revoked.ok && !revoked.alreadyRevoked, true);
  a.equal(await store.editorCredential(
    digest('editor-after-disconnect'), '2026-08-26T00:00:01.000Z'), null);
  const expiredRetry = await store.revokeConnection({ ...input, now: '2040-01-01T00:00:01.000Z' });
  a.equal(expiredRetry.ok && expiredRetry.alreadyRevoked, true);
  a.deepEqual(await store.revokeConnection({
    ...input, idempotencyKey: 'disconnect-different', now: '2040-01-01T00:00:01.000Z'
  }), { ok: false, error: 'idempotency-conflict' });
  a.deepEqual(await store.revokeConnection({
    ...input, accessTokenDigest: digest('wrong-token'), now: '2040-01-01T00:00:01.000Z'
  }), { ok: false, error: 'unauthorized' });
  a.equal((await store.canonicalProductionConnection('site-1'))?.targetOrigin,
    'https://production.example');
});

test('Disconnect survives a committed access rotation whose response never reached the connector', async () => {
  const store = new MemoryConnectedStore();
  await store.createConnection(connectionInput('staging'));
  await store.rotateAccessToken('staging', digest('rotated-access'), '2030-01-01T00:15:00.000Z');
  const input = {
    id: 'staging', accessTokenDigest: digest('access:staging'),
    refreshTokenDigest: digest('refresh:staging'), idempotencyKey: 'disconnect-after-rotation',
    now: '2026-08-26T00:00:00.000Z'
  };
  const revoked = await store.revokeConnection(input);
  a.equal(revoked.ok && !revoked.alreadyRevoked, true,
    'the retained scoped refresh proves authority after the access response was lost');
  const retry = await store.revokeConnection({ ...input, now: '2040-08-26T00:00:00.000Z' });
  a.equal(retry.ok && retry.alreadyRevoked, true,
    'a lost DELETE response remains exactly confirmable with the same refresh and key');
  a.deepEqual(await store.revokeConnection({
    ...input, accessTokenDigest: digest('wrong-access'), refreshTokenDigest: digest('wrong-refresh'),
    now: '2040-08-26T00:00:00.000Z'
  }), { ok: false, error: 'unauthorized' });
});

test('overlapping refresh responses retain only one bounded previous access token', async () => {
  let now = Date.parse('2026-08-26T00:00:00.000Z');
  const store = new MemoryConnectedStore(() => now);
  await store.createConnection(connectionInput('staging'));
  await store.rotateAccessToken('staging', digest('refresh-response-a'), '2026-08-26T00:15:00.000Z');
  await store.rotateAccessToken('staging', digest('refresh-response-b'), '2026-08-26T00:15:01.000Z');
  a.equal((await store.connectionByAccessToken(
    digest('refresh-response-a'), '2026-08-26T00:01:00.000Z'))?.id, 'staging',
  'the response persisted out of order remains usable during convergence');
  a.equal(await store.connectionByAccessToken(
    digest('access:staging'), '2026-08-26T00:01:00.000Z'), null,
  'the bounded slot never grows into a token history');
  now += 2 * 60 * 1000 + 1;
  a.equal(await store.connectionByAccessToken(
    digest('refresh-response-a'), new Date(now).toISOString()), null);
  a.equal((await store.connectionByAccessToken(
    digest('refresh-response-b'), new Date(now).toISOString()))?.id, 'staging');
});

test('release reservations serialize sequence and preserve reserved parent order', async () => {
  const store = new MemoryConnectedStore();
  const one = await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'publish-one', releaseId: 'r1', createdBy: 'u1'
  });
  await a.rejects(() => store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'publish-two', releaseId: 'r2', createdBy: 'u1'
  }), /still being finalized/);
  a.deepEqual(await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: one.idempotencyKey,
    releaseId: 'different-is-ignored', createdBy: 'u1'
  }), one, 'idempotent retries recover the original signed identity');
  await release(store, 'publish-one', '1'.repeat(64));
  const two = await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'publish-two', releaseId: 'r2', createdBy: 'u1'
  });
  a.equal(two.sequence, 2);
  a.equal(two.parentReleaseId, one.releaseId);
});

test('an unbuilt reservation blocks children and its only slot is safely reclaimed after expiry', async () => {
  let now = Date.parse('2026-08-26T00:00:00.000Z');
  const store = new MemoryConnectedStore(() => now);
  const abandoned = await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'abandoned-worker', releaseId: 'release-slot-one', createdBy: 'u1'
  });
  await a.rejects(() => store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'child', releaseId: 'release-child', createdBy: 'u1'
  }), /still being finalized/);
  now += RELEASE_RESERVATION_LEASE_MS + 1;
  const reclaimed = await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'corrected-publish', releaseId: 'discarded-proposal', createdBy: 'u1'
  });
  a.equal(reclaimed.releaseId, abandoned.releaseId);
  a.equal(reclaimed.sequence, abandoned.sequence);
  a.equal(reclaimed.idempotencyKey, 'corrected-publish');
  const corrected = await release(store, 'corrected-publish', '1'.repeat(64));
  a.equal(corrected.id, abandoned.releaseId);
  const child = await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'child', releaseId: 'release-child', createdBy: 'u1'
  });
  a.equal(child.sequence, 2);
  a.equal(child.parentReleaseId, corrected.id,
    'a child is allocated only after the reclaimed content release is immutable');
});

test('a stale built-but-unpublished release becomes a tombstone instead of being reused as later content', async () => {
  let now = Date.parse('2026-08-26T00:00:00.000Z');
  const store = new MemoryConnectedStore(() => now);
  const orphan = await release(store, 'orphaned-pointer', '1'.repeat(64), false);
  a.deepEqual(await store.releasesForSite('site-1'), [],
    'building immutable bytes is not a publication commit');
  await a.rejects(() => store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'later-content', releaseId: 'later-release', createdBy: 'u1'
  }), /still being finalized/);
  now += RELEASE_RESERVATION_LEASE_MS + 1;
  const later = await store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'later-content', releaseId: 'later-release', createdBy: 'u1'
  });
  a.equal(later.releaseId, 'later-release');
  a.equal(later.sequence, orphan.sequence + 1);
  a.equal(later.parentReleaseId, null, 'an abandoned artifact is never a signed parent');
  await a.rejects(() => store.reserveRelease({
    siteId: 'site-1', idempotencyKey: 'orphaned-pointer', releaseId: 'ignored', createdBy: 'u1'
  }), /abandoned release/);
});

test('a hosted commit in flight wins serialization against stale-lease reclamation', async () => {
  let now = Date.parse('2026-08-26T00:00:00.000Z');
  let unblock!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  const store = new MemoryConnectedStore(() => now);
  const item = await release(store, 'commit-race', '1'.repeat(64), false);
  now += RELEASE_RESERVATION_LEASE_MS + 1;
  const committing = store.commitReleasePublication({
    siteId: item.siteId, releaseId: item.id, sourceVersion: item.sourceVersion,
    releaseSequence: item.sequence, publishedAt: new Date(now).toISOString()
  }, async () => {
    reached(); await held;
    return { publishedVersion: item.sourceVersion, publishedReleaseId: item.id };
  });
  await waiting;
  await a.rejects(() => store.reserveRelease({
    siteId: item.siteId, idempotencyKey: 'racing-reserve', releaseId: 'racing-release', createdBy: 'u1'
  }), /still being finalized/);
  unblock();
  a.ok(await committing);
  const child = await store.reserveRelease({
    siteId: item.siteId, idempotencyKey: 'racing-reserve', releaseId: 'racing-release', createdBy: 'u1'
  });
  a.equal(child.parentReleaseId, item.id);
});

test('an older staging live event cannot promote behind a newer production release', async () => {
  const store = new MemoryConnectedStore();
  await store.createConnection(connectionInput('staging'));
  await store.createConnection(connectionInput('production', 'production'));
  const older = await release(store, 'promotion-floor-one', '1'.repeat(64));
  const newer = await release(store, 'promotion-floor-two', '2'.repeat(64));
  await target(store, 'production', newer, 1);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await ack(store, 'production', newer, 1, status, `production-newer-${status}`)).ok, true);
  }
  a.equal((await ack(
    store, 'production', newer, 1, 'live', 'production-newer-live', newer.artifactHash
  )).ok, true);

  await target(store, 'staging', older, 1);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await ack(store, 'staging', older, 1, status, `staging-older-${status}`)).ok, true);
  }
  a.equal((await ack(
    store, 'staging', older, 1, 'live', 'staging-older-live', older.artifactHash
  )).ok, true);
  a.equal((await store.connection('production'))?.pendingReleaseId, null,
    'global release order prevents an old staging replay from scheduling a rollback');
  await a.rejects(() => store.createTarget({
    connectionId: 'production', releaseId: older.id, sequence: 2,
    envelope: 'historical-envelope', signature: 'historical-signature',
    keyId: 'release-key', createdAt: new Date().toISOString()
  }, true), /not newer than the active release/);
});

test('deployment state, hashes, idempotency, rollback, and failure recovery fail closed', async () => {
  const store = new MemoryConnectedStore();
  await store.createConnection(connectionInput('staging'));
  const hash1 = '1'.repeat(64), hash2 = '2'.repeat(64);
  const first = await release(store, 'publish-one', hash1);
  await target(store, 'staging', first, 1);

  const queued = await ack(store, 'staging', first, 1, 'queued', 'queue-one');
  a.equal(queued.ok, true);
  const duplicate = await ack(store, 'staging', first, 1, 'queued', 'queue-one');
  a.equal(duplicate.duplicate, true);
  const changedBody = await store.recordDeployment({
    connectionId: 'staging', releaseId: first.id, sequence: 1, status: 'queued',
    activeHash: null, error: null, detail: { stage: 'queued', message: 'changed' },
    idempotencyKey: 'queue-one', bodyHash: 'f'.repeat(64)
  });
  a.deepEqual(changedBody, { ok: false, error: 'idempotency-conflict' });
  a.equal((await ack(store, 'staging', first, 1, 'live', 'skip', hash1)).error, 'status-conflict');
  a.equal((await ack(store, 'staging', first, 1, 'downloading', 'download')).ok, true);
  a.equal((await ack(store, 'staging', first, 1, 'staged', 'stage')).ok, true);
  a.equal((await ack(store, 'staging', first, 1, 'activating', 'activate')).ok, true);
  a.equal((await ack(store, 'staging', first, 1, 'verifying', 'verify')).ok, true);
  a.equal((await ack(store, 'staging', first, 1, 'live', 'bad-live', hash2)).error, 'wrong-hash');
  a.equal((await ack(store, 'staging', first, 1, 'live', 'live', hash1)).ok, true);

  const second = await release(store, 'publish-two', hash2);
  await target(store, 'staging', second, 2);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await ack(store, 'staging', second, 2, status, `second-${status}`)).ok, true);
  }
  a.equal((await ack(store, 'staging', second, 2, 'live', 'second-live', hash2)).ok, true);
  a.equal((await ack(store, 'staging', second, 2, 'rolled_back', 'unknown-rollback', '9'.repeat(64))).error,
    'wrong-hash');
  a.equal((await store.connection('staging'))?.activeReleaseId, second.id,
    'an unknown rollback hash cannot change the active pointer');
  a.equal((await ack(store, 'staging', second, 2, 'rolled_back', 'second-rollback', hash1)).ok, true);
  a.equal((await store.connection('staging'))?.activeReleaseId, first.id);

  const third = await release(store, 'publish-three', '3'.repeat(64));
  await target(store, 'staging', third, 3);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    await ack(store, 'staging', third, 3, status, `third-${status}`);
  }
  a.equal((await ack(store, 'staging', third, 3, 'rolled_back', 'third-unknown-rollback', '8'.repeat(64))).error,
    'wrong-hash');
  a.equal((await store.connection('staging'))?.desiredReleaseId, third.id,
    'a rejected terminal acknowledgement cannot release the desired target');
  a.equal((await ack(store, 'staging', third, 3, 'failed', 'third-failed')).ok, true);
  a.equal((await store.connection('staging'))?.desiredReleaseId, null,
    'a terminal failure releases the target queue');
  const fourth = await release(store, 'publish-four', '4'.repeat(64));
  await target(store, 'staging', fourth, 4);
  a.equal((await store.connection('staging'))?.desiredReleaseId, fourth.id,
    'the next release can be staged after failure');
});

test('stale terminal ACKs preserve a newer desired release and revoked targets reject new transitions', async () => {
  const store = new MemoryConnectedStore();
  await store.createConnection(connectionInput('staging'));
  const first = await release(store, 'stale-terminal-one', '1'.repeat(64));
  const second = await release(store, 'stale-terminal-two', '2'.repeat(64));
  await target(store, 'staging', first, 1);
  await ack(store, 'staging', first, 1, 'queued', 'one-queued');
  await target(store, 'staging', second, 2);
  await ack(store, 'staging', first, 1, 'downloading', 'one-downloading');
  a.equal((await ack(store, 'staging', first, 1, 'failed', 'one-failed')).ok, true);
  a.equal((await store.connection('staging'))?.desiredReleaseId, second.id);
  a.equal((await store.desiredTarget('staging'))?.release.id, second.id);

  a.equal((await store.revokeConnection({
    id: 'staging', accessTokenDigest: digest('access:staging'),
    idempotencyKey: 'disconnect-staging', now: '2026-08-26T00:00:00.000Z'
  })).ok, true);
  a.deepEqual(await ack(store, 'staging', second, 2, 'queued', 'two-after-revoke'), {
    ok: false, error: 'connection-inactive'
  });
  const duplicate = await ack(store, 'staging', first, 1, 'failed', 'one-failed');
  a.deepEqual(duplicate, { ok: false, error: 'connection-inactive' },
    'Disconnect rejects even an exact historical acknowledgement replay');
});
