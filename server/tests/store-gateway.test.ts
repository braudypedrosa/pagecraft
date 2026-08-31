/* The HTTPS gateway is the production persistence path. These tests hold the wire contract
   without contacting Supabase: operation names, metadata-only listings, binary reads, and the
   bulk auth/site calls that keep one page request from becoming an N+1 sequence. */
import { test } from "vitest";
import a from "node:assert/strict";
import {
  GatewayAssetStore,
  GatewayAuthStore,
  GatewayConnectedStore,
  GatewayHostedPublishPreparer,
  GatewayStore,
  PagecraftGateway,
} from "../src/store-gateway.ts";
import { cmsItemKey } from "../src/store.ts";
import type { Doc } from "../../app/src/core/types.ts";

type Call = { op: string; args: Record<string, unknown> };

const fakeGateway = (answer: (call: Call) => unknown) => {
  const calls: Call[] = [];
  const request = async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const call = JSON.parse(String(init?.body || "{}")) as Call;
    calls.push(call);
    return Response.json({ data: answer(call) });
  };
  return {
    calls,
    gateway: new PagecraftGateway(
      "https://gateway.invalid/",
      "test-key",
      request as typeof fetch,
    ),
  };
};

const siteRow = {
  id: "s1",
  host: "acme.test",
  slug: "acme",
  name: "Acme",
  doc: { meta: {}, header: [], footer: [], pages: [] } as unknown as Doc,
  version: 3,
  published_version: 2,
  published_release_id: "release-two",
  published_publication_id: null,
  updated_at: "2026-08-26T00:00:00.000Z",
};

test("gateway asset listing is metadata-only while id/path reads carry only one body", async () => {
  const bytes = Buffer.from([1, 2, 250]).toString("base64");
  const meta = {
    id: "a1",
    site_id: "s1",
    name: "Photo.png",
    type: "image/png",
    w: 10,
    h: 20,
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "asset.list") return [meta];
    if (call.op === "asset.get" || call.op === "asset.byPath") {
      return { ...meta, bytes };
    }
    if (call.op === "asset.blob.putChunk") return { stored: true };
    if (call.op === "asset.putBlob") return meta;
    if (call.op === "asset.remove") return true;
    throw new Error(`unexpected ${call.op}`);
  });
  const assets = new GatewayAssetStore(gateway);

  const listed = await assets.list("s1");
  a.equal("bytes" in listed[0], false);
  a.deepEqual([...(await assets.get("s1", "a1"))!.bytes], [1, 2, 250]);
  a.deepEqual([...(await assets.byPath("s1", "assets/photo-a1.png"))!.bytes], [
    1,
    2,
    250,
  ]);
  const put = await assets.put({
    siteId: "s1",
    name: "Photo.png",
    type: "image/png",
    w: 10,
    h: 20,
    bytes: new Uint8Array([1, 2, 250]),
  });
  a.equal(
    "bytes" in put,
    false,
    "upload responses do not echo the image through the gateway",
  );
  a.equal(await assets.remove("s1", "a1"), true);
  a.deepEqual(calls.map((call) => call.op), [
    "asset.list",
    "asset.get",
    "asset.byPath",
    "asset.blob.putChunk",
    "asset.putBlob",
    "asset.remove",
  ]);
  a.equal(
    (calls[4].args.asset as Record<string, unknown>).name,
    "Photo.png",
    "the human-readable name remains intact",
  );
});

test("gateway connected asset finalization carries its connection guard", async () => {
  const meta = {
    id: "wp-a1",
    site_id: "s1",
    name: "Photo.png",
    type: "image/png",
    w: 10,
    h: 20,
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "asset.blob.putChunk") return { stored: true };
    if (call.op === "asset.putBlobConnected") return meta;
    throw new Error(`unexpected ${call.op}`);
  });
  const assets = new GatewayAssetStore(gateway);
  const saved = await assets.putConnected({
    id: "wp-a1",
    siteId: "s1",
    name: "Photo.png",
    type: "image/png",
    w: 10,
    h: 20,
    bytes: new Uint8Array([1, 2, 250]),
  }, "connection-production");
  a.equal(saved?.id, "wp-a1");
  a.deepEqual(calls.map((call) => call.op), [
    "asset.blob.putChunk",
    "asset.putBlobConnected",
  ]);
  a.equal(calls[1].args.connectionId, "connection-production");
  a.equal((calls[1].args.asset as Record<string, unknown>).id, "wp-a1");
});

test("gateway manual-import credentials never expose plaintext token material to persistence", async () => {
  const row = {
    id: "manual-one",
    owner_id: "u1",
    installation_id: "wp-one",
    access_token_digest: "a".repeat(64),
    access_expires_at: "2026-08-27T01:00:00.000Z",
    refresh_token_digest: "r".repeat(64),
    status: "active",
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    revoked_at: null,
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "auth.manualImport.create") return row;
    if (
      call.op === "auth.manualImport.byAccess" ||
      call.op === "auth.manualImport.byRefresh"
    ) return row;
    if (call.op === "auth.manualImport.rotate") {
      return { ...row, access_token_digest: call.args.digest };
    }
    if (call.op === "auth.manualImport.revoke") return true;
    throw new Error(`unexpected ${call.op}`);
  });
  const auth = new GatewayAuthStore(gateway);
  await auth.createManualImportCredential({
    id: row.id,
    ownerId: row.owner_id,
    installationId: row.installation_id,
    accessTokenDigest: row.access_token_digest,
    accessExpiresAt: new Date(row.access_expires_at).getTime(),
    refreshTokenDigest: row.refresh_token_digest,
  });
  a.equal(
    (await auth.manualImportByAccess(row.access_token_digest))?.ownerId,
    "u1",
  );
  a.equal(
    (await auth.manualImportByRefresh(row.refresh_token_digest))
      ?.installationId,
    "wp-one",
  );
  await auth.rotateManualImportAccess(
    row.id,
    "b".repeat(64),
    Date.now() + 60_000,
  );
  a.equal(
    await auth.revokeManualImportCredential(row.id, row.refresh_token_digest),
    true,
  );
  a.deepEqual(calls.map((call) => call.op), [
    "auth.manualImport.create",
    "auth.manualImport.byAccess",
    "auth.manualImport.byRefresh",
    "auth.manualImport.rotate",
    "auth.manualImport.revoke",
  ]);
  a.equal(
    (calls[0].args.input as Record<string, unknown>).accessExpiresAt,
    row.access_expires_at,
    "gateway timestamps cross the HTTPS boundary as ISO-8601 strings",
  );
  a.equal(JSON.stringify(calls).includes("access-secret"), false);
});

test("gateway site metadata excludes documents and hot public lookups are boundedly cached", async () => {
  let slugReads = 0;
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "site.listMeta") {
      const { doc: _doc, ...meta } = siteRow;
      return [meta];
    }
    if (call.op === "site.bySlug") {
      slugReads++;
      return siteRow;
    }
    throw new Error(`unexpected ${call.op}`);
  });
  const sites = new GatewayStore(gateway);
  const list = await sites.listMeta();
  a.equal("doc" in list[0], false);
  a.equal((await sites.bySlug("acme"))!.version, 3);
  a.equal((await sites.bySlug("acme"))!.version, 3);
  a.equal(
    slugReads,
    1,
    "a hot public path does not call a multi-second gateway twice",
  );
  a.deepEqual(calls.map((call) => call.op), ["site.listMeta", "site.bySlug"]);
});

test("gateway site settings use fixed rename and deletion operations", async () => {
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "site.setName") return { ...siteRow, name: call.args.name };
    if (call.op === "site.delete") return true;
    throw new Error(`unexpected ${call.op}`);
  });
  const sites = new GatewayStore(gateway);
  a.equal(
    (await sites.setName("s1", "Renamed studio"))?.name,
    "Renamed studio",
  );
  a.equal(await sites.delete("s1"), true);
  a.deepEqual(calls, [
    { op: "site.setName", args: { id: "s1", name: "Renamed studio" } },
    { op: "site.delete", args: { id: "s1" } },
  ]);
});

test("gateway promotes hosted publications through one fixed operation", async () => {
  const input = {
    id: "s1",
    version: 3,
    publicationId: "9f680e13-b841-43dc-9b47-a4d2a8215b13",
    contentHash: "a".repeat(64),
    createdBy: "owner-1",
    createdAt: "2026-08-28T12:00:00.000Z",
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "site.publishHosted") {
      return {
        ...siteRow,
        published_version: input.version,
        published_publication_id: input.publicationId,
      };
    }
    throw new Error(`unexpected ${call.op}`);
  });
  const sites = new GatewayStore(gateway);
  const published = await sites.publishHosted(input);
  a.equal(published?.publishedPublicationId, input.publicationId);
  a.deepEqual(calls, [{ op: "site.publishHosted", args: input }]);
});

test("gateway prepares hosted publishing through one authenticated bulk operation", async () => {
  const user = {
    id: "owner-1",
    email: "owner@example.test",
    name: "Owner",
    auth_user_id: "auth-owner",
    plan: "free",
    created_at: "2026-08-31T00:00:00.000Z",
  };
  const revision = {
    site_id: "s1",
    version: 3,
    doc: siteRow.doc,
    saved_by: user.id,
    context: null,
    created_at: "2026-08-31T00:00:00.000Z",
  };
  const asset = {
    id: "a1",
    site_id: "s1",
    name: "Photo.png",
    type: "image/png",
    w: 10,
    h: 20,
    stored_bytes: 3,
    original_bytes: 3,
    content_hash: "a".repeat(64),
    optimized: true,
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "site.prepareHostedPublish") {
      return {
        status: "ok",
        user,
        role: "owner",
        site: siteRow,
        revision,
        assets: [asset],
      };
    }
    throw new Error(`unexpected ${call.op}`);
  });
  const prepared = await new GatewayHostedPublishPreparer(gateway).prepare({
    siteId: "s1",
    identity: {
      authUserId: user.auth_user_id,
      email: user.email,
      name: user.name,
    },
  });
  a.equal(prepared.status, "ok");
  if (prepared.status !== "ok") return;
  a.equal(prepared.user.id, user.id);
  a.equal(prepared.site.version, 3);
  a.equal(prepared.revision?.version, 3);
  a.equal(prepared.assets[0].id, asset.id);
  a.deepEqual(calls.map((call) => call.op), ["site.prepareHostedPublish"]);
  a.deepEqual(calls[0].args, {
    id: "s1",
    newUserId: calls[0].args.newUserId,
    authUserId: user.auth_user_id,
    email: user.email,
    name: user.name,
  });
  a.match(String(calls[0].args.newUserId), /^[0-9a-f-]{36}$/i);
});

test("gateway Cloud mutations reuse cached source and keep save/publish authorization atomic", async () => {
  const user = {
    id: "owner-1",
    email: "owner@example.test",
    name: "Owner",
    auth_user_id: "auth-owner",
    plan: "free",
    created_at: "2026-08-31T00:00:00.000Z",
  };
  const savedRow = {
    ...siteRow,
    version: 4,
    updated_at: "2026-08-31T01:00:00.000Z",
  };
  const publishedRow = {
    ...savedRow,
    published_version: 4,
    published_publication_id: "publication-1",
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "site.byId") return siteRow;
    if (call.op === "asset.list") return [];
    if (call.op === "site.saveAuthorized") {
      return { status: "saved", user, role: "owner", site: savedRow };
    }
    if (call.op === "site.publishHostedAuthorized") {
      return { status: "published", user, site: publishedRow };
    }
    throw new Error(`unexpected ${call.op}`);
  });
  const sites = new GatewayStore(gateway);
  const assets = new GatewayAssetStore(gateway);
  const cloud = new GatewayHostedPublishPreparer(gateway, sites, assets);
  await Promise.all([sites.byId("s1"), assets.list("s1")]);
  a.equal(cloud.cachedSaveSource("s1", 3)?.site.version, 3);

  const identity = {
    authUserId: "auth-owner",
    email: user.email,
    name: user.name,
  };
  const saved = await cloud.saveAuthorized({
    siteId: "s1",
    sourceVersion: 3,
    doc: siteRow.doc,
    identity,
    requiredRole: "admin",
  });
  a.equal(saved.status, "saved");
  a.equal(
    cloud.cachedPublishSource({ siteId: "s1", sourceVersion: 4, identity })
      ?.site.version,
    4,
  );

  const published = await cloud.publishAuthorized({
    siteId: "s1",
    sourceVersion: 4,
    publicationId: "publication-1",
    contentHash: "a".repeat(64),
    createdAt: "2026-08-31T01:00:00.000Z",
    identity,
  });
  a.equal(published.status, "published");
  a.deepEqual(calls.map((call) => call.op), [
    "site.byId",
    "asset.list",
    "site.saveAuthorized",
    "site.publishHostedAuthorized",
  ]);
  a.equal(calls[2].args.requiredRole, "admin");
  a.equal(calls[3].args.authUserId, "auth-owner");
});

test("gateway publish carries the release sequence required by the database CAS", async () => {
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "site.publish") return siteRow;
    throw new Error(`unexpected ${call.op}`);
  });
  const sites = new GatewayStore(gateway);
  a.equal(
    (await sites.publish("s1", 2, "release-two", 2))?.publishedReleaseId,
    "release-two",
  );
  a.deepEqual(calls[0], {
    op: "site.publish",
    args: {
      id: "s1",
      version: 2,
      releaseId: "release-two",
      releaseSequence: 2,
    },
  });
});

test("gateway CMS write heads preserve the per-connection sequence ledger contract", async () => {
  const head = {
    connectionId: "production",
    collectionId: "posts",
    itemId: "one",
    writeSequence: 9,
    idempotencyKey: "cms-write-0009",
    bodyHash: "9".repeat(64),
    version: 12,
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "site.cmsWriteHeads") return [head];
    throw new Error(`unexpected ${call.op}`);
  });
  const sites = new GatewayStore(gateway);
  a.deepEqual(
    await sites.cmsWriteHeads("s1", "production", [cmsItemKey("posts", "one")]),
    [head],
  );
  a.deepEqual(calls[0], {
    op: "site.cmsWriteHeads",
    args: {
      id: "s1",
      connectionId: "production",
      itemKeys: [cmsItemKey("posts", "one")],
    },
  });
});

test("gateway connection revocation preserves the scoped idempotent result contract", async () => {
  const row = {
    id: "connection-1",
    site_id: "s1",
    created_by: "u1",
    installation_id: "install-1",
    environment: "production",
    profile: "existing-theme",
    target_origin: "https://wp.test",
    target_path: "/",
    redirect_uri: "https://wp.test/wp-admin/admin.php?page=pagecraft",
    webhook_url: "https://wp.test/wp-json/pagecraft/v1/releases/available",
    scopes: ["release:read"],
    status: "revoked",
    code_challenge: "x".repeat(43),
    authorization_code_digest: "code",
    authorization_code_expires_at: "2030-01-01T00:00:00.000Z",
    authorization_code_used_at: null,
    confirmation_expires_at: null,
    confirmed_at: "2026-08-26T00:00:00.000Z",
    access_token_digest: "access",
    access_token_expires_at: "2030-01-01T00:00:00.000Z",
    refresh_token_digest: null,
    desired_release_id: null,
    pending_release_id: null,
    next_sequence: 1,
    last_acknowledged_sequence: 0,
    active_release_id: "frozen-release",
    active_hash: "f".repeat(64),
    revoked_at: "2026-08-26T00:00:00.000Z",
    revocation_idempotency_key: "disconnect-key",
    created_at: "2026-08-26T00:00:00.000Z",
    updated_at: "2026-08-26T00:00:00.000Z",
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "connection.revoke") {
      return { ok: true, connection: row, alreadyRevoked: true };
    }
    throw new Error(`unexpected ${call.op}`);
  });
  const connected = new GatewayConnectedStore(gateway);
  const result = await connected.revokeConnection({
    id: "connection-1",
    accessTokenDigest: "access",
    refreshTokenDigest: "refresh",
    idempotencyKey: "disconnect-key",
    now: "2026-08-26T00:01:00.000Z",
  });
  a.equal(result.ok && result.alreadyRevoked, true);
  if (result.ok) a.equal(result.connection.activeReleaseId, "frozen-release");
  a.deepEqual(calls[0], {
    op: "connection.revoke",
    args: {
      id: "connection-1",
      accessTokenDigest: "access",
      refreshTokenDigest: "refresh",
      idempotencyKey: "disconnect-key",
      now: "2026-08-26T00:01:00.000Z",
    },
  });
});

test("gateway reads the persisted production canonical independently of active connection listings", async () => {
  const row = {
    id: "production-old",
    site_id: "s1",
    created_by: "u1",
    installation_id: "install-1",
    environment: "production",
    profile: "existing-theme",
    target_origin: "https://canonical.wp.test",
    target_path: "/site/",
    redirect_uri: "https://canonical.wp.test/wp-admin/",
    webhook_url:
      "https://canonical.wp.test/wp-json/pagecraft/v1/releases/available",
    scopes: [],
    status: "revoked",
    code_challenge: "x".repeat(43),
    authorization_code_digest: "code",
    authorization_code_expires_at: "2030-01-01T00:00:00.000Z",
    authorization_code_used_at: null,
    confirmation_expires_at: null,
    confirmed_at: "2026-08-26T00:00:00.000Z",
    access_token_digest: "access",
    access_token_expires_at: "2030-01-01T00:00:00.000Z",
    refresh_token_digest: null,
    desired_release_id: null,
    pending_release_id: null,
    next_sequence: 1,
    last_acknowledged_sequence: 0,
    active_release_id: null,
    active_hash: null,
    revoked_at: "2026-08-26T00:00:00.000Z",
    revocation_idempotency_key: "disconnect",
    created_at: "2026-08-26T00:00:00.000Z",
    updated_at: "2026-08-26T00:00:00.000Z",
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "connection.canonicalProduction") return row;
    if (call.op === "connection.historyForSite") return [row];
    throw new Error(`unexpected ${call.op}`);
  });
  const connected = new GatewayConnectedStore(gateway);
  const canonical = await connected.canonicalProductionConnection("s1");
  a.equal(canonical?.status, "revoked");
  a.equal(canonical?.targetOrigin, "https://canonical.wp.test");
  a.deepEqual(
    (await connected.connectionHistoryForSite("s1")).map((item) => item.id),
    ["production-old"],
    "release safety can retain a revoked target scope without exposing it as active",
  );
  a.deepEqual(calls, [{
    op: "connection.canonicalProduction",
    args: { siteId: "s1" },
  }, {
    op: "connection.historyForSite",
    args: { siteId: "s1" },
  }]);
});

test("gateway preserves the two-phase provision and confirmation contract", async () => {
  const base = {
    id: "connection-two-phase",
    site_id: "s1",
    created_by: "u1",
    installation_id: "install-two-phase",
    environment: "staging",
    profile: "existing-theme",
    target_origin: "https://staging.wp.test",
    target_path: "/",
    redirect_uri: "https://staging.wp.test/wp-admin/",
    webhook_url:
      "https://staging.wp.test/wp-json/pagecraft/v1/releases/available",
    scopes: [],
    status: "provisioned",
    code_challenge: "x".repeat(43),
    authorization_code_digest: "code",
    authorization_code_expires_at: "2026-08-26T00:10:00.000Z",
    authorization_code_used_at: "2026-08-26T00:01:00.000Z",
    confirmation_expires_at: "2026-08-26T00:31:00.000Z",
    confirmed_at: null,
    access_token_digest: "access",
    access_token_expires_at: "2026-08-26T00:30:00.000Z",
    refresh_token_digest: "refresh",
    desired_release_id: null,
    pending_release_id: null,
    next_sequence: 1,
    last_acknowledged_sequence: 0,
    active_release_id: null,
    active_hash: null,
    revoked_at: null,
    revocation_idempotency_key: null,
    created_at: "2026-08-26T00:00:00.000Z",
    updated_at: "2026-08-26T00:01:00.000Z",
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "connection.provision") return base;
    if (call.op === "connection.confirm") {
      return {
        connection: {
          ...base,
          status: "active",
          confirmed_at: "2026-08-26T00:02:00.000Z",
        },
        alreadyConfirmed: false,
      };
    }
    throw new Error(`unexpected ${call.op}`);
  });
  const connected = new GatewayConnectedStore(gateway);
  a.equal(
    (await connected.provisionConnection(base.id, {
      accessTokenDigest: "access",
      accessTokenExpiresAt: "2026-08-26T00:30:00.000Z",
      refreshTokenDigest: "refresh",
      confirmationExpiresAt: "2026-08-26T00:31:00.000Z",
    }))?.status,
    "provisioned",
  );
  const confirmed = await connected.confirmConnection({
    id: base.id,
    accessTokenDigest: "access",
    installationId: base.installation_id,
    now: "2026-08-26T00:02:00.000Z",
  });
  a.equal(confirmed?.connection.status, "active");
  a.equal(confirmed?.connection.confirmedAt, "2026-08-26T00:02:00.000Z");
  a.deepEqual(calls.map((call) => call.op), [
    "connection.provision",
    "connection.confirm",
  ]);
});

test("gateway preserves the atomic native WordPress content snapshot contract", async () => {
  const snapshot = {
    connectionId: "connection-1",
    generation: 3,
    bodyHash: "a".repeat(64),
    items: [{
      id: "wp:page:2",
      objectType: "page" as const,
      title: "About",
      url: "https://wp.test/about/",
      modifiedAt: "2026-08-26T01:00:00.000Z",
    }],
    syncedAt: "2026-08-26T02:00:00.000Z",
  };
  const wire = {
    connection_id: snapshot.connectionId,
    generation: snapshot.generation,
    body_hash: snapshot.bodyHash,
    items: snapshot.items,
    synced_at: snapshot.syncedAt,
  };
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "contentIndex.replace") {
      return { ok: true, snapshot: wire, duplicate: false };
    }
    if (call.op === "contentIndex.forSite") return [wire];
    throw new Error(`unexpected ${call.op}`);
  });
  const connected = new GatewayConnectedStore(gateway);
  a.deepEqual(await connected.replaceWordPressContentIndex(snapshot), {
    ok: true,
    snapshot,
    duplicate: false,
  });
  a.deepEqual(await connected.wordpressContentIndexesForSite("s1"), [snapshot]);
  a.deepEqual(calls, [
    { op: "contentIndex.replace", args: { input: snapshot } },
    { op: "contentIndex.forSite", args: { siteId: "s1" } },
  ]);
});

test("gateway records the hosted publication finalization before release delivery traversal", async () => {
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "release.commitPublication") {
      return { publishedVersion: 4, publishedReleaseId: "release-1" };
    }
    if (call.op === "release.markPublished") return true;
    throw new Error(`unexpected ${call.op}`);
  });
  const connected = new GatewayConnectedStore(gateway);
  a.deepEqual(
    await connected.commitReleasePublication({
      siteId: "s1",
      releaseId: "release-1",
      sourceVersion: 4,
      releaseSequence: 2,
      publishedAt: "2026-08-26T00:00:00.000Z",
    }, async () => {
      throw new Error("the gateway must coordinate this remotely");
    }),
    {
      publishedVersion: 4,
      publishedReleaseId: "release-1",
    },
  );
  a.equal(
    await connected.markReleasePublished(
      "release-1",
      "2026-08-26T00:00:00.000Z",
    ),
    true,
  );
  a.deepEqual(calls, [{
    op: "release.commitPublication",
    args: {
      siteId: "s1",
      releaseId: "release-1",
      sourceVersion: 4,
      releaseSequence: 2,
      publishedAt: "2026-08-26T00:00:00.000Z",
    },
  }, {
    op: "release.markPublished",
    args: {
      releaseId: "release-1",
      publishedAt: "2026-08-26T00:00:00.000Z",
    },
  }]);
});

test("gateway preserves the Edge wrong-hash rollback verdict without local mutation", async () => {
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "deployment.record") {
      return { ok: false, error: "wrong-hash" };
    }
    throw new Error(`unexpected ${call.op}`);
  });
  const connected = new GatewayConnectedStore(gateway);
  const input = {
    connectionId: "production",
    releaseId: "release-new",
    sequence: 3,
    status: "rolled_back" as const,
    activeHash: "9".repeat(64),
    error: null,
    detail: { stage: "rolled_back" },
    idempotencyKey: "unknown-rollback",
    bodyHash: "8".repeat(64),
  };
  const result = await connected.recordDeployment(input);
  a.equal(result.ok, false);
  if (!result.ok) a.equal(result.error, "wrong-hash");
  a.deepEqual(calls[0], { op: "deployment.record", args: { input } });
});

test("gateway auth resolves a session and all memberships with one operation each", async () => {
  const { gateway, calls } = fakeGateway((call) => {
    if (call.op === "auth.usersByIds") {
      return [{ id: "u1", email: "me@acme.test", name: "Me" }];
    }
    if (call.op === "auth.userForSession") {
      return { id: "u1", email: "me@acme.test", name: "Me" };
    }
    if (call.op === "auth.accessForSession") {
      return { id: "u1", email: "me@acme.test", name: "Me", role: "owner" };
    }
    if (call.op === "auth.membershipsForUser") {
      return [{ site_id: "s1", user_id: "u1", role: "owner" }];
    }
    if (call.op === "auth.updateProfile") {
      return {
        id: "u1",
        email: "me@acme.test",
        name: "Updated",
        plan: "free",
        created_at: "2026-08-28T00:00:00.000Z",
      };
    }
    if (call.op === "auth.changeMemberRole") {
      return {
        status: "updated",
        membership: { site_id: "s1", user_id: "u2", role: "owner" },
      };
    }
    if (call.op === "auth.removeMember") return { status: "removed" };
    if (call.op === "auth.provisionInvitation") {
      return {
        status: "granted",
        queued: true,
        user: { id: "u2", email: "invitee@acme.test", name: "" },
        membership: { site_id: "s1", user_id: "u2", role: "content" },
      };
    }
    if (call.op === "auth.drainInvitationOutbox") {
      return { processed: 1, delivered: 1, pending: 0 };
    }
    if (call.op === "auth.inviteEmail") return "sent";
    throw new Error(`unexpected ${call.op}`);
  });
  const auth = new GatewayAuthStore(gateway);
  a.deepEqual((await auth.usersByIds(["u1", "u1"])).map((user) => user.id), [
    "u1",
  ]);
  a.equal((await auth.userForSession("digest"))!.id, "u1");
  a.equal((await auth.accessForSession("digest", "s1"))!.role, "owner");
  a.deepEqual(await auth.membershipsForUser("u1"), [{
    siteId: "s1",
    userId: "u1",
    role: "owner",
  }]);
  const updated = await auth.updateProfile("u1", { name: "Updated" });
  a.equal(updated?.name, "Updated");
  a.equal(updated?.plan, "free");
  const changed = await auth.changeMemberRole("s1", "u2", "owner");
  a.equal(changed.status, "updated");
  a.equal((await auth.removeMember("s1", "u2")).status, "removed");
  const provisioned = await auth.provisionInvitation({
    siteId: "s1",
    actorUserId: "u1",
    email: "INVITEE@acme.test",
    role: "content",
    redirectTo: "https://build.itspagecraft.com/auth/confirm?type=invite",
  });
  a.equal(provisioned.status, "granted");
  if (provisioned.status === "granted") {
    a.equal(provisioned.user.email, "invitee@acme.test");
    a.equal(provisioned.membership.role, "content");
    a.equal(provisioned.queued, true);
  }
  a.deepEqual(await auth.drainInvitationOutbox("worker", 5), {
    processed: 1,
    delivered: 1,
    pending: 0,
  });
  a.equal(
    await auth.inviteEmail(
      "invitee@acme.test",
      "https://build.itspagecraft.com/auth/confirm?type=invite",
    ),
    "sent",
  );
  a.deepEqual(calls.map((call) => call.op), [
    "auth.usersByIds",
    "auth.userForSession",
    "auth.accessForSession",
    "auth.membershipsForUser",
    "auth.updateProfile",
    "auth.changeMemberRole",
    "auth.removeMember",
    "auth.provisionInvitation",
    "auth.drainInvitationOutbox",
    "auth.inviteEmail",
  ]);
});

test("a malformed successful gateway response fails closed", async () => {
  const request = async () => Response.json({ ok: true });
  const gateway = new PagecraftGateway(
    "https://gateway.invalid",
    "test-key",
    request as typeof fetch,
  );
  await a.rejects(() => gateway.call("auth.putLink"), /invalid response/);
});

test("gateway client refuses an oversized JSON control request before network I/O", async () => {
  let requested = false;
  const request = async () => {
    requested = true;
    return Response.json({ data: true });
  };
  const gateway = new PagecraftGateway(
    "https://gateway.invalid",
    "test-key",
    request as typeof fetch,
  );
  await a.rejects(
    () => gateway.call("oversized", { value: "x".repeat(16 * 1024 * 1024) }),
    /too large/,
  );
  a.equal(requested, false);
});
