import { test } from 'vitest';
import a from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { hashToken } from '../src/auth.ts';
import { blankDoc } from '../src/render.ts';
import { canonicalJson, sha256 } from '../src/releases.ts';
import {
  PgAssetStore, PgAuthStore, PgConnectedStore, PgStore, type Queryable
} from '../src/store-pg.ts';
import type { DeploymentStatus, SiteRelease, WordPressConnection } from '../src/release-store.ts';

const digest = (value: unknown) => sha256(new TextEncoder().encode(canonicalJson(value)));

async function rig() {
  const db = await PGlite.create();
  const query = db as unknown as Queryable;
  const sites = new PgStore(query), auth = new PgAuthStore(query), assets = new PgAssetStore(query);
  const connected = new PgConnectedStore(query);
  await sites.init(); await auth.init(); await assets.init(); await connected.init();
  const site = await sites.create({ host: 'connected.test', name: 'Connected', doc: blankDoc('Connected') });
  const owner = await auth.createUser('owner@connected.test', 'Owner');
  await auth.grant(site.id, owner.id, 'owner');
  return { db, sites, auth, assets, connected, site, owner };
}

const connection = (siteId: string, ownerId: string): Omit<WordPressConnection,
  'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'> => ({
  id: 'staging', siteId, createdBy: ownerId, installationId: 'install-staging',
  environment: 'staging', profile: 'existing-theme', targetOrigin: 'https://staging.example',
  targetPath: '/', redirectUri: 'https://staging.example/wp-admin/admin.php?page=pagecraft',
  webhookUrl: 'https://staging.example/wp-json/pagecraft/v1/releases/available',
  scopes: ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'], status: 'active',
  codeChallenge: 'x'.repeat(43), authorizationCodeDigest: hashToken('authorization'),
  authorizationCodeExpiresAt: '2030-01-01T00:00:00.000Z',
  authorizationCodeUsedAt: '2026-08-26T00:00:00.000Z',
  confirmationExpiresAt: null, confirmedAt: '2026-08-26T00:00:01.000Z',
  accessTokenDigest: hashToken('access'), accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
  refreshTokenDigest: hashToken('refresh'), desiredReleaseId: null, pendingReleaseId: null,
  nextSequence: 1, lastAcknowledgedSequence: 0, activeReleaseId: null, activeHash: null
});
const productionConnection = (siteId: string, ownerId: string):
  Omit<WordPressConnection, 'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'> => ({
  ...connection(siteId, ownerId), id: 'production', installationId: 'install-production',
  environment: 'production', targetOrigin: 'https://production.example',
  redirectUri: 'https://production.example/wp-admin/admin.php?page=pagecraft',
  webhookUrl: 'https://production.example/wp-json/pagecraft/v1/releases/available',
  authorizationCodeDigest: hashToken('authorization-production'),
  accessTokenDigest: hashToken('access-production'), refreshTokenDigest: hashToken('refresh-production')
});

async function makeRelease(connected: PgConnectedStore, siteId: string, ownerId: string,
  key: string, hash: string, published = true): Promise<SiteRelease> {
  const reserved = await connected.reserveRelease({
    siteId, idempotencyKey: key, releaseId: `release-${key}`, createdBy: ownerId
  });
  const item: SiteRelease = {
    id: reserved.releaseId, siteId, sequence: reserved.sequence, sourceVersion: 1,
    schemaVersion: 13, parentReleaseId: reserved.parentReleaseId, artifactHash: hash,
    artifactBytes: 1, artifact: new Uint8Array([reserved.sequence]), hostedFiles: [],
    manifest: `manifest-${key}`,
    manifestHash: digest(`manifest-${key}`), signature: `signature-${key}`, keyId: 'key',
    files: [], pages: [], cms: { collections: [] }, assets: [], scripts: [],
    audit: { acknowledgeWarnings: true, warningCodes: [], warningCount: 0, errorCodes: [], errorCount: 0 },
    idempotencyKey: key, createdBy: ownerId, createdAt: reserved.createdAt
  };
  const created = (await connected.createRelease(item)).release;
  if (published) a.ok(await connected.commitReleasePublication({
    siteId: created.siteId, releaseId: created.id, sourceVersion: created.sourceVersion,
    releaseSequence: created.sequence, publishedAt: created.createdAt
  }, async () => null));
  return created;
}

async function record(connected: PgConnectedStore, item: SiteRelease, status: DeploymentStatus,
  key: string, activeHash: string | null = null, connectionId = 'staging',
  targetSequence = item.sequence) {
  const value = {
    connectionId, releaseId: item.id, sequence: targetSequence, status, activeHash,
    error: status === 'failed' ? 'injected' : null, detail: { stage: status }, idempotencyKey: key
  };
  return connected.recordDeployment({ ...value, bodyHash: digest(value) });
}

test('Postgres persists and atomically consumes one-time grants and editor credentials', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  await connected.putGrant({
    digest: hashToken('grant'), kind: 'oauth-consent', siteId: site.id, connectionId: null,
    payload: { ownerId: owner.id }, expiresAt: '2030-01-01T00:00:00.000Z'
  });
  a.equal((await connected.consumeGrant(
    hashToken('grant'), 'oauth-consent', '2026-08-26T00:00:00.000Z'))?.payload.ownerId, owner.id);
  a.equal(await connected.consumeGrant(
    hashToken('grant'), 'oauth-consent', '2026-08-26T00:00:01.000Z'), null);
  await connected.putEditorCredential({
    digest: hashToken('editor'), connectionId: 'staging', siteId: site.id,
    ownerId: owner.id, expiresAt: '2030-01-01T00:00:00.000Z'
  });
  a.equal((await connected.editorCredential(
    hashToken('editor'), '2026-08-26T00:00:00.000Z'))?.ownerId, owner.id);
});

test('Postgres content index replacement is monotonic, idempotent, and target scoped', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  const first = {
    connectionId: 'staging', generation: 7, bodyHash: digest(['native-page']),
    items: [{
      id: 'wp:page:14', objectType: 'page' as const, title: 'Native page',
      url: 'https://staging.example/native/', modifiedAt: '2026-08-26T01:00:00.000Z'
    }], syncedAt: '2026-08-26T02:00:00.000Z'
  };
  const made = await connected.replaceWordPressContentIndex(first);
  a.equal(made.ok && made.duplicate, false);
  const duplicate = await connected.replaceWordPressContentIndex(first);
  a.equal(duplicate.ok && duplicate.duplicate, true);
  a.deepEqual(await connected.replaceWordPressContentIndex({
    ...first, bodyHash: digest(['generation-conflict'])
  }), { ok: false, error: 'generation-conflict' });
  a.deepEqual(await connected.replaceWordPressContentIndex({
    ...first, generation: 6
  }), { ok: false, error: 'stale-generation' });
  const removed = await connected.replaceWordPressContentIndex({
    ...first, generation: 8, bodyHash: digest([]), items: [], syncedAt: '2026-08-26T03:00:00.000Z'
  });
  a.equal(removed.ok, true);
  a.deepEqual((await connected.wordpressContentIndexesForSite(site.id))[0].items, []);
});

test('Postgres atomically retires expired pending pairing bindings before replacement', async () => {
  const { connected, site, owner } = await rig();
  const abandoned = {
    ...connection(site.id, owner.id), id: 'abandoned-pairing', status: 'pending' as const,
    authorizationCodeUsedAt: null, authorizationCodeExpiresAt: '2020-01-01T00:00:00.000Z',
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await connected.createConnection(abandoned);
  const replacement = {
    ...connection(site.id, owner.id), id: 'replacement-pairing', status: 'pending' as const,
    authorizationCodeDigest: hashToken('replacement-authorization'),
    authorizationCodeUsedAt: null, accessTokenDigest: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await connected.createConnection(replacement);
  a.equal((await connected.connection('abandoned-pairing'))?.status, 'revoked');
  a.equal((await connected.connection('abandoned-pairing'))?.revocationIdempotencyKey,
    'expired-pairing-abandoned-pairing');
  a.deepEqual((await connected.connectionsForSite(site.id)).map(item => item.id),
    ['replacement-pairing']);
  a.deepEqual((await connected.connectionHistoryForSite(site.id)).map(item => item.id), [
    'abandoned-pairing', 'replacement-pairing'
  ], 'revoked target scopes remain queryable for release portability checks');
});

test('Postgres provisions, recovers, confirms, and retires expired two-phase pairings', async () => {
  const firstRig = await rig();
  const pending = {
    ...connection(firstRig.site.id, firstRig.owner.id), id: 'two-phase', status: 'pending' as const,
    authorizationCodeExpiresAt: '2026-08-26T12:10:00.000Z', authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await firstRig.connected.createConnection(pending);
  await firstRig.connected.useAuthorizationCode(
    pending.authorizationCodeDigest, '2026-08-26T12:01:00.000Z');
  await firstRig.connected.provisionConnection(pending.id, {
    accessTokenDigest: hashToken('two-phase-access'),
    accessTokenExpiresAt: '2026-08-26T12:30:00.000Z',
    refreshTokenDigest: hashToken('two-phase-refresh'),
    confirmationExpiresAt: '2026-08-26T12:31:00.000Z'
  });
  a.equal((await firstRig.connected.authorizationConnection(
    pending.authorizationCodeDigest, '2026-08-26T12:12:00.000Z'))?.status, 'provisioned');
  a.equal(await firstRig.connected.connectionByAccessToken(
    hashToken('two-phase-access'), '2026-08-26T12:12:00.000Z'), null);
  const confirmed = await firstRig.connected.confirmConnection({
    id: pending.id, accessTokenDigest: hashToken('two-phase-access'),
    installationId: pending.installationId, now: '2026-08-26T12:12:00.000Z'
  });
  a.equal(confirmed?.connection.status, 'active');
  a.equal(confirmed?.alreadyConfirmed, false);
  a.equal((await firstRig.connected.confirmConnection({
    id: pending.id, accessTokenDigest: hashToken('two-phase-access'),
    installationId: pending.installationId, now: '2026-08-26T12:13:00.000Z'
  }))?.alreadyConfirmed, true);

  const secondRig = await rig();
  const abandoned = {
    ...connection(secondRig.site.id, secondRig.owner.id), id: 'expired-provisioned',
    status: 'pending' as const, authorizationCodeDigest: hashToken('expired-provisioned-code'),
    authorizationCodeExpiresAt: '2020-01-01T00:10:00.000Z', authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await secondRig.connected.createConnection(abandoned);
  await secondRig.connected.useAuthorizationCode(
    abandoned.authorizationCodeDigest, '2020-01-01T00:01:00.000Z');
  await secondRig.connected.provisionConnection(abandoned.id, {
    accessTokenDigest: hashToken('expired-provisioned-access'),
    accessTokenExpiresAt: '2020-01-01T00:16:00.000Z',
    refreshTokenDigest: hashToken('expired-provisioned-refresh'),
    confirmationExpiresAt: '2020-01-01T00:31:00.000Z'
  });
  await secondRig.connected.createConnection({
    ...abandoned, id: 'replacement-provisioned', status: 'pending',
    authorizationCodeDigest: hashToken('replacement-provisioned-code'),
    authorizationCodeExpiresAt: '2030-01-01T00:00:00.000Z', authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  });
  a.equal((await secondRig.connected.connection(abandoned.id))?.status, 'revoked');
  a.equal((await secondRig.connected.connection('replacement-provisioned'))?.status, 'pending');
  const cleanup = await secondRig.connected.revokeConnection({
    id: abandoned.id, accessTokenDigest: hashToken('expired-provisioned-access'),
    idempotencyKey: 'wp-revoke-expired-provisioned', now: '2026-08-26T12:32:00.000Z'
  });
  a.equal(cleanup.ok, true);
  if (cleanup.ok) a.equal(cleanup.alreadyRevoked, true);
});

test('Postgres connection revocation is scoped and exact retries remain confirmable', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection({
    ...connection(site.id, owner.id), desiredReleaseId: 'desired-release', pendingReleaseId: 'pending-release',
    activeReleaseId: 'frozen-release', activeHash: 'f'.repeat(64)
  });
  await connected.putEditorCredential({
    digest: hashToken('revoked-editor'), connectionId: 'staging', siteId: site.id,
    ownerId: owner.id, expiresAt: '2040-01-01T00:00:00.000Z'
  });
  const input = {
    id: 'staging', accessTokenDigest: hashToken('access'),
    idempotencyKey: 'disconnect-postgres', now: '2026-08-26T01:00:00.000Z'
  };
  const revoked = await connected.revokeConnection(input);
  a.equal(revoked.ok, true);
  if (!revoked.ok) return;
  a.equal(revoked.alreadyRevoked, false);
  a.equal(revoked.connection.status, 'revoked');
  a.equal(revoked.connection.desiredReleaseId, null);
  a.equal(revoked.connection.pendingReleaseId, null);
  a.equal(revoked.connection.activeReleaseId, 'frozen-release');
  a.equal(await connected.connectionByAccessToken(hashToken('access'), input.now), null);
  a.equal(await connected.connectionByRefreshToken(hashToken('refresh')), null);
  a.equal(await connected.editorCredential(
    hashToken('revoked-editor'), '2026-08-26T01:00:01.000Z'), null,
  'revocation atomically invalidates embedded editor authority');
  const retry = await connected.revokeConnection({ ...input, now: '2040-08-26T01:01:00.000Z' });
  a.equal(retry.ok && retry.alreadyRevoked, true);
  a.deepEqual(await connected.revokeConnection({
    ...input, idempotencyKey: 'disconnect-conflict', now: '2026-08-26T01:02:00.000Z'
  }), { ok: false, error: 'idempotency-conflict' });
  a.deepEqual(await connected.revokeConnection({
    ...input, accessTokenDigest: hashToken('wrong'), now: '2026-08-26T01:02:00.000Z'
  }), { ok: false, error: 'unauthorized' });

  await connected.createConnection(productionConnection(site.id, owner.id));
  await connected.rotateAccessToken(
    'production', hashToken('unseen-rotated-access'), '2030-01-01T00:15:00.000Z'
  );
  const interrupted = {
    id: 'production', accessTokenDigest: hashToken('access-production'),
    refreshTokenDigest: hashToken('refresh-production'),
    idempotencyKey: 'disconnect-after-rotation', now: '2026-08-26T01:03:00.000Z'
  };
  const fallback = await connected.revokeConnection(interrupted);
  a.equal(fallback.ok && !fallback.alreadyRevoked, true);
  const fallbackRetry = await connected.revokeConnection({
    ...interrupted, now: '2040-08-26T01:03:00.000Z'
  });
  a.equal(fallbackRetry.ok && fallbackRetry.alreadyRevoked, true);
});

test('Postgres init upgrades legacy active connections before enforcing confirmation state', async () => {
  const db = await PGlite.create();
  const query = db as unknown as Queryable;
  const sites = new PgStore(query), auth = new PgAuthStore(query);
  await sites.init(); await auth.init();
  const site = await sites.create({ host: 'legacy-connected.test', name: 'Legacy', doc: blankDoc('Legacy') });
  const owner = await auth.createUser('legacy-owner@connected.test', 'Legacy owner');
  await auth.grant(site.id, owner.id, 'owner');
  await db.exec(`
    create table wordpress_connections (
      id text primary key,
      site_id text not null references sites (id) on delete cascade,
      created_by text not null references users (id) on delete restrict,
      installation_id text not null,
      environment text not null check (environment in ('staging', 'production')),
      profile text not null check (profile in ('existing-theme', 'pagecraft-theme')),
      target_origin text not null,
      target_path text not null,
      redirect_uri text not null,
      webhook_url text not null,
      scopes jsonb not null default '[]'::jsonb,
      status text not null check (status in ('pending', 'active', 'revoked')),
      code_challenge text not null,
      authorization_code_digest text not null unique,
      authorization_code_expires_at timestamptz not null,
      authorization_code_used_at timestamptz,
      access_token_digest text unique,
      access_token_expires_at timestamptz,
      refresh_token_digest text unique,
      desired_release_id text,
      pending_release_id text,
      next_sequence integer not null default 1 check (next_sequence > 0),
      last_acknowledged_sequence integer not null default 0 check (last_acknowledged_sequence >= 0),
      active_release_id text,
      active_hash text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await db.query(`insert into wordpress_connections (
    id, site_id, created_by, installation_id, environment, profile, target_origin, target_path,
    redirect_uri, webhook_url, scopes, status, code_challenge, authorization_code_digest,
    authorization_code_expires_at, authorization_code_used_at, access_token_digest,
    access_token_expires_at, refresh_token_digest
  ) values ($1,$2,$3,$4,'production','existing-theme','https://legacy.example','/',
    'https://legacy.example/wp-admin/admin.php?page=pagecraft',
    'https://legacy.example/wp-json/pagecraft/v1/releases/available','[]'::jsonb,'active',$5,$6,
    '2030-01-01T00:00:00Z','2026-08-26T00:00:00Z',$7,'2030-01-01T00:00:00Z',$8)`, [
    'legacy-production', site.id, owner.id, 'legacy-installation', 'x'.repeat(43),
    hashToken('legacy-code'), hashToken('legacy-access'), hashToken('legacy-refresh')
  ]);
  const connected = new PgConnectedStore(query);
  await connected.init();
  const canonical = await connected.canonicalProductionConnection(site.id);
  a.equal(canonical?.id, 'legacy-production');
  a.ok(canonical?.confirmedAt, 'legacy active rows are backfilled before canonical ownership queries');
  await connected.createConnection({
    ...connection(site.id, owner.id), id: 'new-staging', status: 'pending',
    authorizationCodeDigest: hashToken('new-staging-code'), authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  });
  await connected.useAuthorizationCode(hashToken('new-staging-code'), '2026-08-26T00:01:00.000Z');
  a.equal((await connected.provisionConnection('new-staging', {
    accessTokenDigest: hashToken('new-staging-access'),
    accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
    refreshTokenDigest: hashToken('new-staging-refresh'),
    confirmationExpiresAt: '2030-01-01T00:30:00.000Z'
  }))?.status, 'provisioned');
});

test('Postgres bounds out-of-order refresh responses to one short previous-access slot', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  const now = Date.now();
  await connected.rotateAccessToken('staging', hashToken('refresh-response-a'),
    new Date(now + 15 * 60 * 1000).toISOString());
  await connected.rotateAccessToken('staging', hashToken('refresh-response-b'),
    new Date(now + 15 * 60 * 1000 + 1).toISOString());
  a.equal((await connected.connectionByAccessToken(
    hashToken('refresh-response-a'), new Date(now + 60_000).toISOString()))?.id, 'staging');
  a.equal(await connected.connectionByAccessToken(
    hashToken('access'), new Date(now + 60_000).toISOString()), null);
  a.equal(await connected.connectionByAccessToken(
    hashToken('refresh-response-a'), new Date(now + 2 * 60 * 1000 + 10_000).toISOString()), null);
  a.equal((await connected.connectionByAccessToken(
    hashToken('refresh-response-b'), new Date(now + 2 * 60 * 1000 + 10_000).toISOString()))?.id, 'staging');
});

test('Postgres guards CMS revisions and media finalization with the active connection row', async () => {
  const { sites, assets, connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  const changed = structuredClone(site.doc);
  changed.pages[0].title = 'Connected draft';
  const context = { cmsWrites: [{
    connectionId: 'staging', collectionId: 'posts', itemId: 'one', writeSequence: 1,
    idempotencyKey: 'postgres-cms-write', bodyHash: '1'.repeat(64)
  }] };
  const saved = await sites.saveConnectedCms(
    site.id, changed, 1, owner.id, 'staging', context
  );
  a.equal(saved.ok, true);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  a.equal((await assets.putConnected({
    id: 'wp-asset-one', siteId: site.id, name: 'one.png', type: 'image/png', w: 1, h: 1, bytes
  }, 'staging'))?.id, 'wp-asset-one');
  a.equal(await assets.putConnected({
    id: 'wp-asset-one', siteId: site.id, name: 'changed.png', type: 'image/png', w: 1, h: 1, bytes
  }, 'staging'), null, 'an idempotent media id cannot be rebound');

  a.equal((await connected.revokeConnection({
    id: 'staging', accessTokenDigest: hashToken('access'),
    idempotencyKey: 'disconnect-write-guards', now: '2026-08-26T01:00:00.000Z'
  })).ok, true);
  const blockedDoc = structuredClone(changed);
  blockedDoc.pages[0].title = 'Must not persist';
  const blocked = await sites.saveConnectedCms(
    site.id, blockedDoc, 2, owner.id, 'staging', context
  );
  a.equal(blocked.ok, false);
  a.equal(blocked.guarded, true);
  a.equal((await sites.byId(site.id))?.version, 2);
  a.equal(await assets.putConnected({
    id: 'wp-asset-two', siteId: site.id, name: 'two.png', type: 'image/png', w: 1, h: 1, bytes
  }, 'staging'), null);
  a.equal(await assets.get(site.id, 'wp-asset-two'), null);
});

test('Postgres retains the last production canonical target after synchronization is revoked', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(productionConnection(site.id, owner.id));
  a.equal((await connected.canonicalProductionConnection(site.id))?.targetOrigin,
    'https://production.example');
  a.equal((await connected.revokeConnection({
    id: 'production', accessTokenDigest: hashToken('access-production'),
    idempotencyKey: 'disconnect-production', now: '2026-08-26T01:00:00.000Z'
  })).ok, true);
  a.equal((await connected.connectionsForSite(site.id)).length, 0);
  const canonical = await connected.canonicalProductionConnection(site.id);
  a.equal(canonical?.status, 'revoked');
  a.equal(canonical?.targetOrigin, 'https://production.example');
});

test('Postgres reclaims an expired unbuilt release lease with the original identity', async () => {
  const { db, connected, site, owner } = await rig();
  const abandoned = await connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'abandoned-worker', releaseId: 'release-slot-one', createdBy: owner.id
  });
  await a.rejects(() => connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'blocked-child', releaseId: 'release-child', createdBy: owner.id
  }), /still being finalized/);
  await db.query("update site_release_reservations set created_at = now() - interval '6 minutes' where release_id = $1", [
    abandoned.releaseId
  ]);
  const reclaimed = await connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'corrected-publish', releaseId: 'new-proposal', createdBy: owner.id
  });
  a.equal(reclaimed.releaseId, abandoned.releaseId);
  a.equal(reclaimed.sequence, abandoned.sequence);
  a.equal(reclaimed.idempotencyKey, 'corrected-publish');
  const corrected = await makeRelease(connected, site.id, owner.id, 'corrected-publish', '1'.repeat(64));
  const child = await connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'child-after-correction', releaseId: 'release-child', createdBy: owner.id
  });
  a.equal(child.sequence, 2);
  a.equal(child.parentReleaseId, corrected.id);
});

test('Postgres tombstones a stale built release and excludes it from publishable parent traversal', async () => {
  const { db, connected, site, owner } = await rig();
  const orphan = await makeRelease(
    connected, site.id, owner.id, 'orphaned-pointer', '1'.repeat(64), false
  );
  a.deepEqual(await connected.releasesForSite(site.id), []);
  await db.query(
    "update site_release_reservations set created_at = now() - interval '6 minutes' where release_id = $1",
    [orphan.id]
  );
  const later = await connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'later-publish', releaseId: 'release-later', createdBy: owner.id
  });
  a.equal(later.sequence, orphan.sequence + 1);
  a.equal(later.parentReleaseId, null);
  const finalization = await db.query<{ status: string }>(
    'select status from site_release_publications where release_id = $1', [orphan.id]
  );
  a.equal(finalization.rows[0]?.status, 'aborted');
  a.equal(await connected.markReleasePublished(orphan.id, new Date().toISOString()), false,
    'an abandoned release cannot later become deployable');
});

test('Postgres reserves ordered release identities and serializes deployment acknowledgements', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  const firstReservation = await connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'one-key', releaseId: 'release-one-key', createdBy: owner.id
  });
  await a.rejects(() => connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'two-key', releaseId: 'release-two-key', createdBy: owner.id
  }), /still being finalized/);
  const first: SiteRelease = {
    id: firstReservation.releaseId, siteId: site.id, sequence: firstReservation.sequence,
    sourceVersion: 1, schemaVersion: 13, parentReleaseId: firstReservation.parentReleaseId,
    artifactHash: '1'.repeat(64), artifactBytes: 1, artifact: new Uint8Array([1]),
    hostedFiles: [],
    manifest: 'manifest', manifestHash: digest('manifest'), signature: 'signature', keyId: 'key',
    files: [], pages: [], cms: { collections: [] }, assets: [], scripts: [],
    audit: { acknowledgeWarnings: true, warningCodes: [], warningCount: 0, errorCodes: [], errorCount: 0 },
    idempotencyKey: firstReservation.idempotencyKey, createdBy: owner.id, createdAt: firstReservation.createdAt
  };
  await connected.createRelease(first);
  a.ok(await connected.commitReleasePublication({
    siteId: first.siteId, releaseId: first.id, sourceVersion: first.sourceVersion,
    releaseSequence: first.sequence, publishedAt: first.createdAt
  }, async () => null));
  const secondReservation = await connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'two-key', releaseId: 'release-two-key', createdBy: owner.id
  });
  a.equal(secondReservation.sequence, 2);
  a.equal(secondReservation.parentReleaseId, first.id);
  await connected.createTarget({
    connectionId: 'staging', releaseId: first.id, sequence: 1, envelope: 'envelope',
    signature: 'signature', keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  const listed = (await connected.releasesForSite(site.id))[0];
  const desired = await connected.desiredTarget('staging');
  a.equal('artifact' in listed, false);
  a.equal('hostedFiles' in listed, false);
  a.equal('artifact' in desired!.release, false);
  a.equal('hostedFiles' in desired!.release, false,
    'history and desired-target reads do not materialize immutable release bodies');
  a.equal((await record(connected, first, 'queued', 'queue')).ok, true);
  const [downloading, conflicting] = await Promise.all([
    record(connected, first, 'downloading', 'download-a'),
    record(connected, first, 'downloading', 'download-b')
  ]);
  a.equal([downloading, conflicting].filter(item => item.ok).length, 1,
    'the connection lock allows only the transition valid at its serialization point');
  a.equal([downloading, conflicting].some(item => item.error === 'status-conflict'), true);
});

test('Postgres rejects an unknown rollback hash without clearing the desired target', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  const first = await makeRelease(connected, site.id, owner.id, 'first-key', '1'.repeat(64));
  await connected.createTarget({
    connectionId: 'staging', releaseId: first.id, sequence: 1, envelope: 'one',
    signature: 'one', keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await record(connected, first, status, `first-${status}`)).ok, true);
  }
  a.equal((await record(connected, first, 'rolled_back', 'first-unknown-rollback', '9'.repeat(64))).error,
    'wrong-hash');
  a.equal((await connected.connection('staging'))?.desiredReleaseId, first.id);
  a.equal((await record(connected, first, 'failed', 'first-failed')).ok, true);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, null);
  const second = await makeRelease(connected, site.id, owner.id, 'second-key', '2'.repeat(64));
  await connected.createTarget({
    connectionId: 'staging', releaseId: second.id, sequence: 2, envelope: 'two',
    signature: 'two', keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, second.id);
});

test('Postgres terminal ACKs preserve a newer desired target and revoked connections reject new transitions', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  const first = await makeRelease(connected, site.id, owner.id, 'stale-terminal-one', '1'.repeat(64));
  const second = await makeRelease(connected, site.id, owner.id, 'stale-terminal-two', '2'.repeat(64));
  await connected.createTarget({
    connectionId: 'staging', releaseId: first.id, sequence: 1, envelope: 'one',
    signature: 'one', keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  await record(connected, first, 'queued', 'stale-one-queued');
  await connected.createTarget({
    connectionId: 'staging', releaseId: second.id, sequence: 2, envelope: 'two',
    signature: 'two', keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  await record(connected, first, 'downloading', 'stale-one-downloading');
  a.equal((await record(connected, first, 'failed', 'stale-one-failed')).ok, true);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, second.id);
  a.equal((await connected.desiredTarget('staging'))?.release.id, second.id,
    'a stale terminal event cannot detach the newer pullable target');

  const revoked = await connected.revokeConnection({
    id: 'staging', accessTokenDigest: hashToken('access'),
    idempotencyKey: 'disconnect-before-ack', now: '2026-08-26T01:00:00.000Z'
  });
  a.equal(revoked.ok, true);
  const rejected = await record(connected, second, 'queued', 'second-queued-after-revoke');
  a.deepEqual(rejected, { ok: false, error: 'connection-inactive' });
  const exactDuplicate = await record(connected, first, 'failed', 'stale-one-failed');
  a.deepEqual(exactDuplicate, { ok: false, error: 'connection-inactive' },
    'Disconnect rejects even an exact pre-revocation ACK replay');
});

test('Postgres atomically persists production promotion intent with a staging live ACK', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  await connected.createConnection(productionConnection(site.id, owner.id));
  const release = await makeRelease(connected, site.id, owner.id, 'promotion-key', '3'.repeat(64));
  await connected.createTarget({
    connectionId: 'staging', releaseId: release.id, sequence: 1, envelope: 'staging-envelope',
    signature: 'staging-signature', keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await record(connected, release, status, `promotion-${status}`)).ok, true);
  }
  a.equal((await connected.connection('production'))?.pendingReleaseId, null);
  const live = await record(connected, release, 'live', 'promotion-live', release.artifactHash);
  a.equal(live.ok, true);
  a.equal(live.connection?.activeReleaseId, release.id);
  a.equal((await connected.connection('production'))?.pendingReleaseId, release.id,
    'the promotion job commits in the same statement as staging live');
});

test('Postgres refuses to promote or target a release behind the active global release', async () => {
  const { connected, site, owner } = await rig();
  await connected.createConnection(connection(site.id, owner.id));
  await connected.createConnection(productionConnection(site.id, owner.id));
  const older = await makeRelease(connected, site.id, owner.id, 'global-floor-one', '1'.repeat(64));
  const newer = await makeRelease(connected, site.id, owner.id, 'global-floor-two', '2'.repeat(64));
  await connected.createTarget({
    connectionId: 'production', releaseId: newer.id, sequence: 1,
    envelope: 'production-newer-envelope', signature: 'production-newer-signature',
    keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await record(
      connected, newer, status, `production-newer-${status}`, null, 'production', 1
    )).ok, true);
  }
  a.equal((await record(
    connected, newer, 'live', 'production-newer-live', newer.artifactHash, 'production', 1
  )).ok, true);
  await connected.createTarget({
    connectionId: 'staging', releaseId: older.id, sequence: 1,
    envelope: 'staging-older-envelope', signature: 'staging-older-signature',
    keyId: 'key', createdAt: new Date().toISOString()
  }, true);
  for (const status of ['queued', 'downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await record(connected, older, status, `staging-older-${status}`)).ok, true);
  }
  a.equal((await record(
    connected, older, 'live', 'staging-older-live', older.artifactHash
  )).ok, true);
  a.equal((await connected.connection('production'))?.pendingReleaseId, null);
  await a.rejects(() => connected.createTarget({
    connectionId: 'production', releaseId: older.id, sequence: 2,
    envelope: 'historical-envelope', signature: 'historical-signature',
    keyId: 'key', createdAt: new Date().toISOString()
  }, true), /not eligible/);
});

test('Postgres publish CAS rejects a delayed lower release sequence', async () => {
  const { sites, connected, site, owner } = await rig();
  const older = await makeRelease(connected, site.id, owner.id, 'older-pointer', '1'.repeat(64));
  const newer = await makeRelease(connected, site.id, owner.id, 'newer-pointer', '2'.repeat(64));
  a.equal((await sites.publish(site.id, 1, newer.id, newer.sequence))?.publishedReleaseId, newer.id);
  const delayed = await sites.publish(site.id, 1, older.id, older.sequence);
  a.equal(delayed?.publishedReleaseId, newer.id);
  a.equal((await sites.byId(site.id))?.publishedReleaseId, newer.id);
});
