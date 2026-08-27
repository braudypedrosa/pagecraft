import { randomUUID } from 'node:crypto';
import { test } from 'vitest';
import a from 'node:assert/strict';
import { Pool, type PoolClient } from 'pg';
import { blankDoc } from '../src/render.ts';
import { PgAuthStore, PgConnectedStore, PgStore, type Queryable } from '../src/store-pg.ts';
import { PgOwnedSiteStore } from '../src/accounts.ts';
import type {
  ReleaseReservation, SiteRelease, WordPressConnection
} from '../src/release-store.ts';

const databaseUrl = process.env.PAGECRAFT_TEST_DATABASE_URL;
const postgresTest = databaseUrl ? test : test.skip;

postgresTest('real PostgreSQL cannot exceed the three-owned-site quota under concurrent creation', async () => {
  const firstPool = new Pool({ connectionString: databaseUrl, max: 2 });
  const secondPool = new Pool({ connectionString: databaseUrl, max: 2 });
  const firstDb = firstPool as unknown as Queryable;
  const secondDb = secondPool as unknown as Queryable;
  const sites = new PgStore(firstDb), auth = new PgAuthStore(firstDb);
  try {
    await sites.init();
    await auth.init();
    const owner = await auth.ensureAuthUser(randomUUID(), `${randomUUID()}@integration.test`, 'Owner');
    const writers = [new PgOwnedSiteStore(firstDb), new PgOwnedSiteStore(secondDb)];
    const results = await Promise.all(Array.from({ length: 4 }, (_, index) =>
      writers[index % 2].create({
        ownerId: owner.id, host: `${randomUUID()}.integration.test`,
        name: `Concurrent site ${index + 1}`, doc: blankDoc(`Concurrent site ${index + 1}`)
      })));
    a.equal(results.filter(result => result.ok).length, 3);
    a.deepEqual(results.filter(result => !result.ok), [{ ok: false, reason: 'site_limit_reached' }]);
    a.equal((await auth.membershipsForUser(owner.id)).filter(item => item.role === 'owner').length, 3);
  } finally {
    await Promise.all([firstPool.end(), secondPool.end()]);
  }
});

function immutableRelease(reservation: ReleaseReservation, sourceVersion: number): SiteRelease {
  return {
    id: reservation.releaseId, siteId: reservation.siteId, sequence: reservation.sequence,
    sourceVersion, schemaVersion: 13, parentReleaseId: reservation.parentReleaseId,
    artifactHash: String(reservation.sequence).repeat(64).slice(0, 64), artifactBytes: 1,
    artifact: new Uint8Array([reservation.sequence]), hostedFiles: [],
    manifest: `manifest-${reservation.releaseId}`, manifestHash: 'a'.repeat(64),
    signature: `signature-${reservation.releaseId}`, keyId: 'integration-key',
    files: [], pages: [], cms: { collections: [] }, assets: [], scripts: [],
    audit: { acknowledgeWarnings: true, warningCodes: [], warningCount: 0, errorCodes: [], errorCount: 0 },
    idempotencyKey: reservation.idempotencyKey, createdBy: reservation.createdBy,
    createdAt: reservation.createdAt
  };
}

const commit = (store: PgConnectedStore, release: SiteRelease) => store.commitReleasePublication({
  siteId: release.siteId, releaseId: release.id, sourceVersion: release.sourceVersion,
  releaseSequence: release.sequence, publishedAt: release.createdAt
}, async () => null);

function connection(siteId: string, ownerId: string, id: string): Omit<WordPressConnection,
  'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'> {
  const origin = `https://${id}.integration.test`;
  return {
    id, siteId, createdBy: ownerId, installationId: `installation-${id}`,
    environment: 'staging', profile: 'existing-theme', targetOrigin: origin, targetPath: '/',
    redirectUri: `${origin}/wp-admin/admin.php?page=pagecraft`,
    webhookUrl: `${origin}/wp-json/pagecraft/v1/releases/available`,
    scopes: ['release:read', 'deploy:ack'], status: 'active', codeChallenge: 'x'.repeat(43),
    authorizationCodeDigest: randomUUID().replaceAll('-', '').padEnd(64, '0'),
    authorizationCodeExpiresAt: '2030-01-01T00:00:00.000Z',
    authorizationCodeUsedAt: '2026-08-26T00:00:00.000Z',
    confirmationExpiresAt: null, confirmedAt: '2026-08-26T00:00:01.000Z',
    accessTokenDigest: randomUUID().replaceAll('-', '').padEnd(64, '0'),
    accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
    refreshTokenDigest: randomUUID().replaceAll('-', '').padEnd(64, '0'),
    desiredReleaseId: null, pendingReleaseId: null, nextSequence: 1,
    lastAcknowledgedSequence: 0, activeReleaseId: null, activeHash: null
  };
}

postgresTest('real PostgreSQL serializes reservation writers and safely reclaims only the childless slot', async () => {
  const firstPool = new Pool({ connectionString: databaseUrl, max: 1 });
  const secondPool = new Pool({ connectionString: databaseUrl, max: 1 });
  const firstDb = firstPool as unknown as Queryable;
  const secondDb = secondPool as unknown as Queryable;
  const sites = new PgStore(firstDb), auth = new PgAuthStore(firstDb);
  const first = new PgConnectedStore(firstDb), second = new PgConnectedStore(secondDb);
  try {
    await sites.init();
    await auth.init();
    await first.init();
    const site = await sites.create({
      host: `${randomUUID()}.integration.test`, name: 'Concurrent', doc: blankDoc('Concurrent')
    });
    const owner = await auth.createUser(`${randomUUID()}@integration.test`, 'Owner');
    await auth.grant(site.id, owner.id, 'owner');

    const sameKeySite = await sites.create({
      host: `${randomUUID()}.integration.test`, name: 'Idempotent race', doc: blankDoc('Idempotent race')
    });
    await auth.grant(sameKeySite.id, owner.id, 'owner');
    const sameKey = 'same-idempotency-key';
    const sameKeyRaced = await Promise.all([
      first.reserveRelease({
        siteId: sameKeySite.id, idempotencyKey: sameKey,
        releaseId: randomUUID(), createdBy: owner.id
      }),
      second.reserveRelease({
        siteId: sameKeySite.id, idempotencyKey: sameKey,
        releaseId: randomUUID(), createdBy: owner.id
      })
    ]);
    a.equal(sameKeyRaced[0].sequence, 1);
    a.deepEqual(sameKeyRaced[1], sameKeyRaced[0],
      'concurrent retries of one publish return the original durable identity');
    const sameKeyState = await firstDb.query<{
      reservation_count: string; next_sequence: number;
    }>(
      `select count(r.*)::text as reservation_count, max(c.next_sequence) as next_sequence
       from site_release_reservations r
       join site_release_counters c on c.site_id = r.site_id
       where r.site_id = $1`,
      [sameKeySite.id]
    );
    a.deepEqual(sameKeyState.rows[0], { reservation_count: '1', next_sequence: 2 },
      'the counter advances exactly once for an idempotent race');
    const sameKeyRelease = immutableRelease(sameKeyRaced[0], 1);
    await first.createRelease(sameKeyRelease);
    a.ok(await commit(first, sameKeyRelease));
    const afterSameKey = await second.reserveRelease({
      siteId: sameKeySite.id, idempotencyKey: 'after-same-key',
      releaseId: randomUUID(), createdBy: owner.id
    });
    a.equal(afterSameKey.sequence, 2, 'the next distinct publish has no sequence gap');
    a.equal(afterSameKey.parentReleaseId, sameKeyRaced[0].releaseId);

    const candidates = [
      { siteId: site.id, idempotencyKey: 'concurrent-release-a', releaseId: randomUUID(), createdBy: owner.id },
      { siteId: site.id, idempotencyKey: 'concurrent-release-b', releaseId: randomUUID(), createdBy: owner.id }
    ];
    const raced = await Promise.allSettled([
      first.reserveRelease(candidates[0]), second.reserveRelease(candidates[1])
    ]);
    const fulfilled = raced.filter((item): item is PromiseFulfilledResult<ReleaseReservation> =>
      item.status === 'fulfilled');
    const rejected = raced.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
    a.equal(fulfilled.length, 1);
    a.equal(rejected.length, 1);
    a.match(String(rejected[0].reason), /still being finalized/);
    const winner = fulfilled[0].value;
    const winningIndex = candidates.findIndex(item => item.idempotencyKey === winner.idempotencyKey);
    const winningRelease = immutableRelease(winner, 1);
    await first.createRelease(winningRelease);
    a.ok(await commit(first, winningRelease));
    const loser = await second.reserveRelease(candidates[winningIndex === 0 ? 1 : 0]);
    a.equal(loser.sequence, 2);
    a.equal(loser.parentReleaseId, winner.releaseId);
    await a.rejects(() => first.reserveRelease({
      siteId: site.id, idempotencyKey: 'concurrent-release-c', releaseId: randomUUID(), createdBy: owner.id
    }), /still being finalized/);

    const crashSite = await sites.create({
      host: `${randomUUID()}.integration.test`, name: 'Crash recovery', doc: blankDoc('Crash recovery')
    });
    await auth.grant(crashSite.id, owner.id, 'owner');
    const abandoned = await first.reserveRelease({
      siteId: crashSite.id, idempotencyKey: 'worker-a-crashed', releaseId: randomUUID(), createdBy: owner.id
    });
    await a.rejects(() => second.reserveRelease({
      siteId: crashSite.id, idempotencyKey: 'publisher-b-blocked', releaseId: randomUUID(), createdBy: owner.id
    }), /still being finalized/);
    await firstDb.query(
      "update site_release_reservations set created_at = now() - interval '6 minutes' where release_id = $1",
      [abandoned.releaseId]
    );
    const corrected = await second.reserveRelease({
      siteId: crashSite.id, idempotencyKey: 'publisher-c-final', releaseId: randomUUID(), createdBy: owner.id
    });
    a.equal(corrected.releaseId, abandoned.releaseId);
    a.equal(corrected.sequence, 1);
    const correctedRelease = immutableRelease(corrected, 1);
    await second.createRelease(correctedRelease);
    a.ok(await commit(second, correctedRelease));
    const next = await first.reserveRelease({
      siteId: crashSite.id, idempotencyKey: 'after-c-final', releaseId: randomUUID(), createdBy: owner.id
    });
    a.equal(next.sequence, 2);
    a.equal(next.parentReleaseId, corrected.releaseId);
    const rows = await firstDb.query<{ sequence: number; parent_release_id: string | null }>(
      'select sequence, parent_release_id from site_release_reservations where site_id = $1 order by sequence',
      [crashSite.id]
    );
    a.deepEqual(rows.rows, [
      { sequence: 1, parent_release_id: null },
      { sequence: 2, parent_release_id: corrected.releaseId }
    ]);

    const orphanSite = await sites.create({
      host: `${randomUUID()}.integration.test`, name: 'Orphan finalization', doc: blankDoc('Orphan')
    });
    await auth.grant(orphanSite.id, owner.id, 'owner');
    const orphanReservation = await first.reserveRelease({
      siteId: orphanSite.id, idempotencyKey: 'built-pointer-failure',
      releaseId: randomUUID(), createdBy: owner.id
    });
    const orphan = immutableRelease(orphanReservation, 1);
    await first.createRelease(orphan);
    await firstDb.query(
      "update site_release_reservations set created_at = now() - interval '6 minutes' where release_id = $1",
      [orphan.id]
    );
    const replacement = await second.reserveRelease({
      siteId: orphanSite.id, idempotencyKey: 'replacement-publication',
      releaseId: randomUUID(), createdBy: owner.id
    });
    a.equal(replacement.sequence, 2);
    a.equal(replacement.parentReleaseId, null);
    const tombstone = await firstDb.query<{ status: string }>(
      'select status from site_release_publications where release_id = $1', [orphan.id]
    );
    a.equal(tombstone.rows[0]?.status, 'aborted');
  } finally {
    await Promise.all([firstPool.end(), secondPool.end()]);
  }
});

postgresTest('real PostgreSQL rejects an ACK that was waiting when revocation committed', async () => {
  const firstPool = new Pool({ connectionString: databaseUrl, max: 2 });
  const secondPool = new Pool({ connectionString: databaseUrl, max: 1 });
  const firstDb = firstPool as unknown as Queryable;
  const secondDb = secondPool as unknown as Queryable;
  const sites = new PgStore(firstDb), auth = new PgAuthStore(firstDb);
  const first = new PgConnectedStore(firstDb), second = new PgConnectedStore(secondDb);
  let lock: PoolClient | null = null;
  try {
    await sites.init(); await auth.init(); await first.init();
    const site = await sites.create({
      host: `${randomUUID()}.integration.test`, name: 'ACK race', doc: blankDoc('ACK race')
    });
    const owner = await auth.createUser(`${randomUUID()}@integration.test`, 'Owner');
    await auth.grant(site.id, owner.id, 'owner');
    const connectionId = `connection-${randomUUID()}`;
    await first.createConnection(connection(site.id, owner.id, connectionId));
    const reservation = await first.reserveRelease({
      siteId: site.id, idempotencyKey: 'ack-race-release', releaseId: randomUUID(), createdBy: owner.id
    });
    const release = immutableRelease(reservation, 1);
    await first.createRelease(release);
    a.ok(await commit(first, release));
    await first.createTarget({
      connectionId, releaseId: release.id, sequence: 1, envelope: 'envelope',
      signature: 'signature', keyId: 'key', createdAt: new Date().toISOString()
    }, true);
    const queued = {
      connectionId, releaseId: release.id, sequence: 1, status: 'queued' as const,
      activeHash: null, error: null, detail: { stage: 'queued' },
      idempotencyKey: 'ack-race-queued', bodyHash: '1'.repeat(64)
    };
    a.equal((await first.recordDeployment(queued)).ok, true);

    const secondPid = Number((await secondDb.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0].pid);
    const lockingClient = await firstPool.connect();
    lock = lockingClient;
    await lockingClient.query('begin');
    await lockingClient.query('select id from wordpress_connections where id = $1 for update', [connectionId]);
    await lockingClient.query(
      `update wordpress_connections set status = 'revoked', revoked_at = now(),
       desired_release_id = null, pending_release_id = null where id = $1`, [connectionId]
    );
    const pending = second.recordDeployment({
      ...queued, status: 'downloading', idempotencyKey: 'ack-race-downloading', bodyHash: '2'.repeat(64)
    });
    let waitingOnLock = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const activity = await lockingClient.query<{ wait_event_type: string | null }>(
        'select wait_event_type from pg_stat_activity where pid = $1', [secondPid]
      );
      if (activity.rows[0]?.wait_event_type === 'Lock') { waitingOnLock = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    a.equal(waitingOnLock, true, 'the ACK reached and waited on the same connection-row lock');
    await lockingClient.query('commit');
    lockingClient.release(); lock = null;
    a.deepEqual(await pending, { ok: false, error: 'connection-inactive' });
    a.deepEqual(await first.recordDeployment(queued), { ok: false, error: 'connection-inactive' },
      'revocation also rejects an exact pre-revocation acknowledgement replay');
  } finally {
    if (lock) {
      await lock.query('rollback').catch(() => undefined);
      lock.release();
    }
    await Promise.all([firstPool.end(), secondPool.end()]);
  }
});

postgresTest('real PostgreSQL atomically orders hosted publication ahead of stale-lease reclamation', async () => {
  const controlPool = new Pool({ connectionString: databaseUrl, max: 1 });
  const publishPool = new Pool({ connectionString: databaseUrl, max: 1 });
  const reservePool = new Pool({ connectionString: databaseUrl, max: 1 });
  const controlDb = controlPool as unknown as Queryable;
  const publishDb = publishPool as unknown as Queryable;
  const reserveDb = reservePool as unknown as Queryable;
  const sites = new PgStore(controlDb), auth = new PgAuthStore(controlDb);
  const setup = new PgConnectedStore(controlDb);
  const publisher = new PgConnectedStore(publishDb), reserver = new PgConnectedStore(reserveDb);
  let lock: PoolClient | null = null;
  try {
    await sites.init(); await auth.init(); await setup.init();
    const site = await sites.create({
      host: `${randomUUID()}.integration.test`, name: 'Publication race', doc: blankDoc('Publication race')
    });
    const owner = await auth.createUser(`${randomUUID()}@integration.test`, 'Owner');
    await auth.grant(site.id, owner.id, 'owner');
    const reservation = await setup.reserveRelease({
      siteId: site.id, idempotencyKey: 'publication-race-a', releaseId: randomUUID(), createdBy: owner.id
    });
    const release = immutableRelease(reservation, 1);
    await setup.createRelease(release);
    await controlDb.query(
      "update site_release_reservations set created_at = now() - interval '6 minutes' where release_id = $1",
      [release.id]
    );
    const publishPid = Number((await publishDb.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0].pid);
    const reservePid = Number((await reserveDb.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0].pid);
    const lockingClient = await controlPool.connect();
    lock = lockingClient;
    await lockingClient.query('begin');
    await lockingClient.query('select id from sites where id = $1 for update', [site.id]);

    const publishing = commit(publisher, release);
    const waitForLock = async (pid: number) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const activity = await lockingClient.query<{ wait_event_type: string | null }>(
          'select wait_event_type from pg_stat_activity where pid = $1', [pid]
        );
        if (activity.rows[0]?.wait_event_type === 'Lock') return true;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return false;
    };
    a.equal(await waitForLock(publishPid), true);
    const reserving = reserver.reserveRelease({
      siteId: site.id, idempotencyKey: 'publication-race-b',
      releaseId: randomUUID(), createdBy: owner.id
    });
    a.equal(await waitForLock(reservePid), true);
    await lockingClient.query('commit');
    lockingClient.release(); lock = null;

    const [published, child] = await Promise.all([publishing, reserving]);
    a.equal(published?.publishedReleaseId, release.id);
    a.equal(child.sequence, 2);
    a.equal(child.parentReleaseId, release.id,
      'the reserver observes the atomic marker and never tombstones the committed parent');
    const finalization = await controlDb.query<{ status: string }>(
      'select status from site_release_publications where release_id = $1', [release.id]
    );
    a.equal(finalization.rows[0]?.status, 'published');
  } finally {
    if (lock) {
      await lock.query('rollback').catch(() => undefined);
      lock.release();
    }
    await Promise.all([controlPool.end(), publishPool.end(), reservePool.end()]);
  }
});
