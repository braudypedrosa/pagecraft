import { createHash } from 'node:crypto';
import { test } from 'vitest';
import a from 'node:assert/strict';
import { blankDoc } from '../src/render.ts';
import { buildReleaseArtifact, parseReleaseArtifact } from '../src/releases.ts';
import { GatewayAssetStore, GatewayConnectedStore, PagecraftGateway } from '../src/store-gateway.ts';
import type { SiteRelease } from '../src/release-store.ts';
import {
  assembleGatewayBlob, GATEWAY_CONTROL_BODY_MAX, gatewayControlRequestBytes,
  splitGatewayBlob
} from '../src/gateway-blobs.ts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const image = (bytes: number, marker: number) => {
  const body = new Uint8Array(bytes);
  body.fill(marker);
  body.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return body;
};

const largeFixture = () => {
  const document = blankDoc('Large gateway fixture');
  const home = document.pages[0];
  Object.assign(home, { id: 'page-home', slug: 'index', name: 'Home', title: 'Large release' });
  const files = new Map([['index.html', '<!doctype html><html><head><title>Large release</title></head>'
    + '<body><main><img src="assets/hero-assetlarge.png"><img src="assets/card-assetcard.png">'
    + '<img src="assets/logo-assetlogo.png"></main></body></html>']]);
  const large = image(10 * 1024 * 1024, 0x71);
  const card = image(64 * 1024, 0x32);
  const logo = image(24 * 1024, 0x18);
  const built = buildReleaseArtifact({
    releaseId: 'release-large-1', siteId: 'site-large', sourceVersion: 1, document, files,
    assets: [
      { id: 'asset-large', siteId: 'site-large', name: 'Hero.png', type: 'image/png', w: 2400, h: 1600, bytes: large },
      { id: 'asset-card', siteId: 'site-large', name: 'Card.png', type: 'image/png', w: 800, h: 600, bytes: card },
      { id: 'asset-logo', siteId: 'site-large', name: 'Logo.png', type: 'image/png', w: 320, h: 100, bytes: logo }
    ]
  });
  return { built, large };
};

test('a legal 10 MiB release crosses the old control limit but round-trips through bounded content-addressed chunks', () => {
  const { built, large } = largeFixture();

  const oldRequestBytes = gatewayControlRequestBytes('release.create', {
    release: { id: 'release-large-1', artifact: Buffer.from(built.artifactBytes).toString('base64') }
  });
  a.ok(oldRequestBytes > GATEWAY_CONTROL_BODY_MAX,
    `legacy nested base64 request should exceed 16 MiB, got ${oldRequestBytes}`);
  const directAssetRequestBytes = gatewayControlRequestBytes('asset.put', {
    id: 'asset-large', siteId: 'site-large', name: 'Hero.png', type: 'image/png',
    w: 2400, h: 1600, bytes: Buffer.from(large).toString('base64')
  });
  a.ok(directAssetRequestBytes > 10 * 1024 * 1024,
    'the legacy single-base64 asset request is too large for a bounded control path');

  const split = splitGatewayBlob(built.artifactBytes);
  a.equal(split.descriptor.hash, built.artifactHash);
  a.ok(split.chunks.length > 20, 'the binary is split into independently bounded requests');
  for (const chunk of split.chunks) {
    const requestBytes = gatewayControlRequestBytes('release.blob.putChunk', {
      blob: split.descriptor, chunk
    });
    a.ok(requestBytes < 1024 * 1024,
      `chunk request remains comfortably below the 16 MiB gateway limit: ${requestBytes}`);
    const responseBytes = Buffer.byteLength(JSON.stringify({ data: chunk }), 'utf8');
    a.ok(responseBytes < 1024 * 1024,
      `chunk response remains comfortably below the 16 MiB gateway limit: ${responseBytes}`);
  }

  const desiredControl = {
    connection: { id: 'connection-large', desired_release_id: 'release-large-1' },
    release: {
      id: 'release-large-1', artifact_hash: split.descriptor.hash,
      artifact_bytes: split.descriptor.bytes, artifact_blob: split.descriptor
    },
    target: { release_id: 'release-large-1', connection_id: 'connection-large', sequence: 1 }
  };
  a.ok(Buffer.byteLength(JSON.stringify({ data: desiredControl }), 'utf8') < 64 * 1024,
    'desired-release remains metadata-only rather than echoing the artifact');

  const pulled = assembleGatewayBlob(split.descriptor, [...split.chunks].reverse());
  a.equal(sha256(pulled), built.artifactHash);
  a.deepEqual(pulled, built.artifactBytes, 'WordPress receives the exact canonical artifact bytes');
  const parsed = parseReleaseArtifact(pulled);
  const largeAsset = parsed.assets.find(asset => asset.assetId === 'asset-large');
  a.ok(largeAsset);
  const pulledLarge = new Uint8Array(Buffer.from(largeAsset.content, 'base64url'));
  a.equal(pulledLarge.byteLength, 10 * 1024 * 1024);
  a.equal(sha256(pulledLarge), sha256(large), 'the legal maximum asset survives the chunk transport');
  a.deepEqual(Object.fromEntries(parsed.assets.map(asset => [asset.assetId, asset.bytes])), {
    'asset-card': 64 * 1024, 'asset-large': 10 * 1024 * 1024, 'asset-logo': 24 * 1024
  });
});

test('gateway asset store uploads a deterministic 10 MiB image through idempotent sub-1 MiB requests', async () => {
  const large = image(10 * 1024 * 1024, 0x63);
  for (let index = 8; index < large.length; index++) large[index] = (index * 29 + 7) & 0xff;
  const expected = splitGatewayBlob(large);
  const uploaded = new Map<number, (typeof expected.chunks)[number]>();
  const requestSizes: number[] = [];
  let finalizeCalls = 0;
  const request = async (_input: string | URL | Request, init?: RequestInit) => {
    const serialized = String(init?.body || '');
    requestSizes.push(Buffer.byteLength(serialized, 'utf8'));
    const call = JSON.parse(serialized) as { op: string; args: Record<string, any> };
    if (call.op === 'asset.blob.putChunk') {
      a.deepEqual(call.args.blob, expected.descriptor);
      const prior = uploaded.get(call.args.chunk.index);
      if (prior) a.deepEqual(prior, call.args.chunk, 'a retried content-addressed chunk is identical');
      uploaded.set(call.args.chunk.index, call.args.chunk);
      return Response.json({ data: { hash: call.args.blob.hash, index: call.args.chunk.index, stored: true } });
    }
    if (call.op === 'asset.putBlob') {
      finalizeCalls++;
      a.deepEqual(call.args.asset, {
        id: 'asset-upload-large', siteId: 'site-large', name: 'Hero.png', type: 'image/png',
        w: 2400, h: 1600, blob: expected.descriptor
      });
      a.deepEqual(assembleGatewayBlob(call.args.asset.blob, uploaded.values()), large,
        'the Edge finalizer receives every exact byte');
      return Response.json({ data: {
        id: call.args.asset.id, site_id: call.args.asset.siteId, name: call.args.asset.name,
        type: call.args.asset.type, w: call.args.asset.w, h: call.args.asset.h
      } });
    }
    throw new Error(`unexpected gateway operation ${call.op}`);
  };
  const store = new GatewayAssetStore(new PagecraftGateway(
    'https://gateway.invalid', 'private-key', request as typeof fetch
  ));
  const input = {
    id: 'asset-upload-large', siteId: 'site-large', name: 'Hero.png', type: 'image/png',
    w: 2400, h: 1600, bytes: large
  };
  const first = await store.put(input);
  const retry = await store.put(input);
  a.deepEqual(retry, first, 'an exact retry returns the same asset metadata');
  a.equal(finalizeCalls, 2);
  a.equal(uploaded.size, expected.descriptor.chunkCount);
  a.ok(Math.max(...requestSizes) < 1024 * 1024,
    `largest gateway request is ${Math.max(...requestSizes)} bytes`);

  const callsBeforeOversize = requestSizes.length;
  await a.rejects(() => store.put({ ...input, bytes: new Uint8Array(10 * 1024 * 1024 + 1) }),
    /10485760-byte limit/);
  a.equal(requestSizes.length, callsBeforeOversize,
    'an oversized asset is rejected before any gateway traffic');
});

test('gateway connected store uploads, lists, targets, and pulls a large release without a giant control response', async () => {
  const { built } = largeFixture();
  const split = splitGatewayBlob(built.artifactBytes);
  const now = '2026-08-26T00:00:00.000Z';
  const release: SiteRelease = {
    id: 'release-large-1', siteId: 'site-large', sequence: 1, sourceVersion: 1,
    schemaVersion: 13, parentReleaseId: null, artifactHash: built.artifactHash,
    artifactBytes: built.artifactBytes.byteLength, artifact: built.artifactBytes,
    hostedFiles: [{ path: 'index.html', content: '<main>Large</main>', bytes: 18, hash: 'a'.repeat(64) }],
    manifest: 'manifest', manifestHash: 'b'.repeat(64), signature: 'signature', keyId: 'key',
    files: built.files, pages: built.pages, cms: built.cms, assets: built.assets, scripts: built.scripts,
    audit: { acknowledgeWarnings: true, warningCodes: [], warningCount: 0, errorCodes: [], errorCount: 0 },
    idempotencyKey: 'large-key', createdBy: 'owner', createdAt: now
  };
  const summaryWire = {
    id: release.id, site_id: release.siteId, sequence: release.sequence,
    source_version: release.sourceVersion, schema_version: release.schemaVersion,
    parent_release_id: release.parentReleaseId, artifact_hash: release.artifactHash,
    artifact_bytes: release.artifactBytes, artifact_blob: split.descriptor,
    manifest: release.manifest, manifest_hash: release.manifestHash, signature: release.signature,
    key_id: release.keyId, files: release.files, pages: release.pages, cms: release.cms,
    assets: release.assets, scripts: release.scripts, audit: release.audit,
    idempotency_key: release.idempotencyKey, created_by: release.createdBy, created_at: release.createdAt
  };
  const fullWire = { ...summaryWire, hosted_files: release.hostedFiles };
  const connectionWire = {
    id: 'connection-large', site_id: release.siteId, created_by: 'owner', installation_id: 'install-large',
    environment: 'staging', profile: 'existing-theme', target_origin: 'https://wp.example', target_path: '/',
    redirect_uri: 'https://wp.example/wp-admin/admin.php?page=pagecraft',
    webhook_url: 'https://wp.example/wp-json/pagecraft/v1/releases/available', scopes: ['release:read'],
    status: 'active', code_challenge: 'x'.repeat(43), authorization_code_digest: 'c'.repeat(64),
    authorization_code_expires_at: now, authorization_code_used_at: now,
    access_token_digest: 'd'.repeat(64), access_token_expires_at: now,
    refresh_token_digest: 'e'.repeat(64), desired_release_id: release.id, pending_release_id: null,
    next_sequence: 2, last_acknowledged_sequence: 0, active_release_id: null, active_hash: null,
    created_at: now, updated_at: now
  };
  const targetWire = {
    release_id: release.id, connection_id: connectionWire.id, sequence: 1,
    envelope: 'envelope', signature: 'signature', key_id: 'key', created_at: now
  };
  const uploaded = new Map<number, (typeof split.chunks)[number]>();
  const operations: string[] = [];
  const requestSizes: number[] = [];
  const request = async (_input: string | URL | Request, init?: RequestInit) => {
    const serialized = String(init?.body || '');
    requestSizes.push(Buffer.byteLength(serialized, 'utf8'));
    const call = JSON.parse(serialized) as { op: string; args: Record<string, any> };
    operations.push(call.op);
    if (call.op === 'release.blob.putChunk') {
      uploaded.set(call.args.chunk.index, call.args.chunk);
      return Response.json({ data: { stored: true } });
    }
    if (call.op === 'release.create') {
      a.equal('artifact' in call.args.release, false, 'create metadata does not nest the artifact');
      a.deepEqual(call.args.release.artifactBlob, split.descriptor);
      return Response.json({ data: { row: fullWire, created: true } });
    }
    if (call.op === 'release.byId') return Response.json({ data: fullWire });
    if (call.op === 'release.artifactChunk') {
      return Response.json({ data: uploaded.get(Number(call.args.index)) || null });
    }
    if (call.op === 'release.forSite') return Response.json({ data: [summaryWire] });
    if (call.op === 'target.desired') {
      return Response.json({ data: { connection: connectionWire, release: summaryWire, target: targetWire } });
    }
    throw new Error(`unexpected gateway operation ${call.op}`);
  };
  const store = new GatewayConnectedStore(new PagecraftGateway(
    'https://gateway.invalid', 'private-key', request as typeof fetch
  ));

  const made = await store.createRelease(release);
  a.deepEqual(made.release.artifact, built.artifactBytes);
  a.equal(uploaded.size, split.descriptor.chunkCount);
  a.deepEqual(assembleGatewayBlob(split.descriptor, uploaded.values()), built.artifactBytes,
    'the Edge upload receives every exact canonical chunk');
  const pulled = await store.release(release.id);
  a.deepEqual(pulled?.artifact, built.artifactBytes, 'full release reads reconstruct exact WordPress bytes');

  const readsBeforeMetadata = operations.filter(op => op === 'release.artifactChunk').length;
  const listed = await store.releasesForSite(release.siteId);
  const desired = await store.desiredTarget(connectionWire.id);
  a.equal('artifact' in listed[0], false);
  a.equal('hostedFiles' in listed[0], false);
  a.equal('artifact' in desired!.release, false);
  a.equal('hostedFiles' in desired!.release, false);
  a.equal(operations.filter(op => op === 'release.artifactChunk').length, readsBeforeMetadata,
    'release lists and desired-target polling never fetch a binary artifact');
  a.ok(Math.max(...requestSizes) < 1024 * 1024,
    'every real gateway client request remains under 1 MiB');
});

test('gateway blob assembly rejects missing, duplicated, corrupt, and descriptor-mismatched chunks', () => {
  const split = splitGatewayBlob(image(1024 * 1024 + 7, 0x44));
  a.throws(() => assembleGatewayBlob(split.descriptor, split.chunks.slice(1)), /incomplete/);
  a.throws(() => assembleGatewayBlob(split.descriptor, [split.chunks[0], split.chunks[0], split.chunks[2]]), /duplicate/);
  const corrupt = structuredClone(split.chunks);
  corrupt[1].content = corrupt[1].content.slice(0, -4) + 'AAAA';
  a.throws(() => assembleGatewayBlob(split.descriptor, corrupt), /integrity/);
  a.throws(() => assembleGatewayBlob({ ...split.descriptor, bytes: split.descriptor.bytes - 1 }, split.chunks),
    /dimensions|wrong length/);
});
