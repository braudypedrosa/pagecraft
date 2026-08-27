import "jsr:@supabase/functions-js@2.111.0/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  assembleStoredGatewayBlob,
  GATEWAY_ASSET_BLOB_MAX_BYTES,
  GATEWAY_BLOB_FORMAT,
  type GatewayBlobDescriptorV1,
  hexSha256,
  type StoredGatewayBlobChunkV1,
  validateAssetBlobDescriptor,
  validateBlobChunk,
  validateBlobDescriptor,
} from "./blob-protocol.ts";

/* Namecheap blocks outbound PostgreSQL ports. This function is the deliberately narrow bridge:
   HTTPS in, a fixed operation set, parameterized SQL out. It never accepts SQL from its caller. */
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  max: 3,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
});
const storage = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
).storage;
const ASSET_BUCKET = "pagecraft-assets";
const FREE_STORAGE_BYTES = 100 * 1024 * 1024;
const assetStoragePath = (ownerId: string, siteId: string, id: string, hash: string, type: string) =>
  `${ownerId}/${siteId}/${id}-${hash.slice(0, 16)}.${type === "image/svg+xml" ? "svg" : "webp"}`;

const MAX_BODY = 16 * 1024 * 1024;
const json = (data: unknown, status = 200) =>
  Response.json({ data }, { status });
const failure = (error: string, status: number, code?: string) =>
  Response.json({ error, code }, { status });

const one = <T>(rows: T[]): T | null => rows[0] || null;
const text = (value: unknown) => String(value ?? "");
const integer = (value: unknown) => Number(value);
type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
const jsonValue = (value: unknown) => value as JsonValue;

async function sha256(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) {
    different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return different === 0;
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(value: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < value.length; i += chunk) {
    binary += String.fromCharCode(...value.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function assetWire(row: Record<string, unknown>) {
  let bytes = row.bytes;
  if (!(bytes instanceof Uint8Array) && row.storage_path) {
    const result = await storage.from(ASSET_BUCKET).download(text(row.storage_path));
    if (result.error || !result.data) throw new Error("stored asset could not be read");
    bytes = new Uint8Array(await result.data.arrayBuffer());
  }
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("database returned an asset in an unknown binary format");
  }
  return { ...row, bytes: toBase64(bytes) };
}

function releaseWire(row: Record<string, unknown>) {
  const { artifact: _artifact, ...metadata } = row;
  const bytes = integer(row.artifact_bytes);
  const chunkBytes = 512 * 1024;
  return {
    ...metadata,
    artifact_blob: {
      format: GATEWAY_BLOB_FORMAT,
      hash: text(row.artifact_hash),
      bytes,
      chunkBytes,
      chunkCount: Math.ceil(bytes / chunkBytes),
    } satisfies GatewayBlobDescriptorV1,
  };
}

function releaseSummaryWire(row: Record<string, unknown>) {
  const summary = { ...releaseWire(row) } as Record<string, unknown>;
  delete summary.hosted_files;
  return summary;
}

const DEPLOYMENT_NEXT: Record<string, string[]> = {
  queued: ["downloading", "failed"],
  downloading: ["staged", "failed"],
  staged: ["needs_approval", "activating", "failed"],
  needs_approval: ["activating", "failed"],
  activating: ["verifying", "failed", "rolled_back"],
  verifying: ["live", "failed", "rolled_back"],
  live: ["rolled_back"],
  failed: ["rolled_back"],
  rolled_back: [],
};

const legacyAssetPath = (row: { id?: unknown; name?: unknown }) =>
  "assets/" +
  String(row.name || row.id || "").replace(/[^\w.-]+/g, "-").toLowerCase();

const immutableAssetName = (name: unknown, id: unknown) => {
  const cleaned =
    String(name || "image").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "")
      .toLowerCase() || "image";
  const dot = cleaned.lastIndexOf(".");
  const hasExtension = dot > 0 && dot < cleaned.length - 1;
  const extension = hasExtension ? cleaned.slice(dot).slice(0, 17) : "";
  const rawStem = hasExtension ? cleaned.slice(0, dot) : cleaned;
  const suffix = String(id || "").replace(/[^a-z0-9]+/gi, "").toLowerCase() ||
    "asset";
  const stem = rawStem.endsWith(`-${suffix}`)
    ? rawStem
    : `${rawStem.slice(0, 180)}-${suffix}`;
  return stem + extension;
};

const immutableAssetPath = (row: { id?: unknown; name?: unknown }) =>
  legacyAssetPath({ id: row.id, name: immutableAssetName(row.name, row.id) });

async function authorised(request: Request) {
  const supplied = request.headers.get("x-pagecraft-gateway-key") || "";
  if (!supplied) return false;
  const rows = await sql<{ secret_hash: string }[]>`
    select secret_hash from gateway_config where id = 'primary'
  `;
  return !!rows[0] && sameHex(await sha256(supplied), rows[0].secret_hash);
}

async function dispatch(op: string, args: Record<string, unknown>) {
  switch (op) {
    case "site.list":
      return await sql`select * from sites order by name`;
    case "site.listMeta":
      return await sql`
        select id, host, slug, name, version, published_version,
               published_release_id, updated_at from sites order by name
      `;
    case "site.byHost":
      return one(
        await sql`select * from sites where host = ${text(args.host)} limit 1`,
      );
    case "site.bySlug":
      return one(
        await sql`select * from sites where slug = ${text(args.slug)} limit 1`,
      );
    case "site.byId":
      return one(
        await sql`select * from sites where id = ${text(args.id)} limit 1`,
      );
    case "site.create":
      return await sql.begin(async (transaction) =>
        one(
          await transaction`
        with made as (
          insert into sites (id, host, slug, name, doc)
          values (${text(args.id)}, ${text(args.host)}, ${text(args.slug)}, ${
            text(args.name)
          }, ${transaction.json(jsonValue(args.doc))})
          returning *
        ), recorded as (
          insert into site_revisions (site_id, version, doc, saved_by, created_at)
          select id, version, doc, ${
            text(args.savedBy) || null
          }, updated_at from made
        )
        select * from made
      `,
        )
      );
    case "account.createOwnedSite":
      return await sql.begin(async (transaction) => {
        const ownerId = text(args.ownerId);
        const owner =
          await transaction`select id from users where id = ${ownerId} for update`;
        if (!owner[0]) return { status: "missing" };
        const owned = await transaction<{ count: number }[]>`
          select count(*)::integer as count from site_users
          where user_id = ${ownerId} and role = 'owner'
        `;
        if (integer(owned[0]?.count) >= 3) {
          return { status: "limit" };
        }
        const made = one(
          await transaction`
          insert into sites (id, host, slug, name, doc)
          values (${text(args.id)}, ${text(args.host)}, ${text(args.slug)}, ${
            text(args.name)
          },
            ${transaction.json(jsonValue(args.doc))})
          returning *
        `,
        );
        await transaction`
          insert into site_users (site_id, user_id, role)
          values (${text(args.id)}, ${ownerId}, 'owner')
        `;
        await transaction`
          insert into site_revisions (site_id, version, doc, saved_by, created_at)
          select id, version, doc, ${ownerId}, updated_at from sites where id = ${
          text(args.id)
        }
        `;
        return { status: "created", site: made };
      });
    case "site.setSlug":
      return one(
        await sql`
        update sites set slug = ${text(args.slug)}, updated_at = now()
        where id = ${text(args.id)} returning *
      `,
      );
    case "site.setHost":
      return one(
        await sql`
        update sites set host = ${text(args.host)}, updated_at = now()
        where id = ${text(args.id)} returning *
      `,
      );
    case "site.save":
      return await sql.begin(async (transaction) =>
        one(
          await transaction`
        with changed as (
          update sites set doc = ${
            transaction.json(jsonValue(args.doc))
          }, version = version + 1, updated_at = now()
          where id = ${text(args.id)} and version = ${
            integer(args.version)
          } returning *
        ), recorded as (
          insert into site_revisions (site_id, version, doc, saved_by, context, created_at)
          select id, version, doc, ${text(args.savedBy) || null}, ${
            args.context == null
              ? null
              : transaction.json(jsonValue(args.context))
          }, updated_at from changed
        )
        select * from changed
      `,
        )
      );
    case "site.saveConnectedCms": {
      const connectionId = text(args.connectionId);
      if (!connectionId) throw new Error("connectionId is required");
      const row = await sql.begin(async (transaction) =>
        one(
          await transaction`
          with guard as materialized (
            select id from wordpress_connections
            where id = ${connectionId} and site_id = ${text(args.id)}
              and status = 'active' and access_token_expires_at > now()
            for update
          ), changed as (
            update sites set doc = ${transaction.json(jsonValue(args.doc))},
              version = version + 1, updated_at = now()
            from guard where sites.id = ${text(args.id)}
              and sites.version = ${integer(args.version)}
            returning sites.*
          ), recorded as (
            insert into site_revisions (site_id, version, doc, saved_by, context, created_at)
            select id, version, doc, ${text(args.savedBy) || null},
              ${
            transaction.json(jsonValue(args.context))
          }, updated_at from changed
          ) select * from changed
        `,
        )
      );
      return { row, guarded: row === null };
    }
    case "site.history":
      return await sql`
        select site_id, version, doc, saved_by, context, created_at
        from site_revisions where site_id = ${
        text(args.id)
      } order by version desc
      `;
    case "site.revision":
      return one(
        await sql`
        select site_id, version, doc, saved_by, context, created_at
        from site_revisions
        where site_id = ${text(args.id)} and version = ${
          integer(args.version)
        } limit 1
      `,
      );
    case "site.cmsWriteHeads": {
      const keys = jsonValue(args.itemKeys);
      if (
        !Array.isArray(keys) || !keys.every((key) => typeof key === "string")
      ) {
        throw new Error("itemKeys must be strings");
      }
      if (!keys.length) return [];
      const rows = await sql<Record<string, unknown>[]>`
        select distinct on (entry->>'collectionId', entry->>'itemId')
          entry->>'connectionId' as connection_id, entry->>'collectionId' as collection_id,
          entry->>'itemId' as item_id, (entry->>'writeSequence')::bigint as write_sequence,
          entry->>'idempotencyKey' as idempotency_key, entry->>'bodyHash' as body_hash,
          revision.version
        from site_revisions revision
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(revision.context->'cmsWrites') = 'array'
            then revision.context->'cmsWrites' else '[]'::jsonb end
        ) entry
        where revision.site_id = ${text(args.id)}
          and entry->>'connectionId' = ${text(args.connectionId)}
          and concat(length(entry->>'collectionId'), ':', entry->>'collectionId', entry->>'itemId') in (
            select jsonb_array_elements_text(${sql.json(keys)}::jsonb)
          )
          and (entry->>'writeSequence') ~ '^[1-9][0-9]*$'
        order by entry->>'collectionId', entry->>'itemId',
          (entry->>'writeSequence')::bigint desc, revision.version desc
      `;
      return rows.map((row) => ({
        connectionId: row.connection_id,
        collectionId: row.collection_id,
        itemId: row.item_id,
        writeSequence: Number(row.write_sequence),
        idempotencyKey: row.idempotency_key,
        bodyHash: row.body_hash,
        version: Number(row.version),
      }));
    }
    case "site.publish":
      return one(
        await sql`
        with valid as materialized (
          select 1 from site_revisions
          where site_id = ${text(args.id)} and version = ${
          integer(args.version)
        }
        ), changed as (
          update sites set published_version = ${integer(args.version)},
            published_release_id = ${text(args.releaseId)},
            published_release_sequence = ${
          integer(args.releaseSequence)
        }, updated_at = now()
          where id = ${text(args.id)} and exists (select 1 from valid)
            and (published_release_sequence < ${integer(args.releaseSequence)}
              or (published_release_sequence = ${integer(args.releaseSequence)}
                and (published_release_id is null or published_release_id = ${
          text(args.releaseId)
        })))
          returning *
        ) select * from changed union all
          select s.* from sites s where s.id = ${
          text(args.id)
        } and exists (select 1 from valid)
            and not exists (select 1 from changed) limit 1
      `,
      );

    case "connection.create": {
      const i = jsonValue(args.input) as Record<string, JsonValue>;
      return one(
        await sql`
        with expired as (
          update wordpress_connections set status = 'revoked', revoked_at = now(),
            revocation_idempotency_key = 'expired-pairing-' || id,
            desired_release_id = null, pending_release_id = null, updated_at = now()
          where (status = 'pending' and authorization_code_expires_at <= now())
            or (status = 'provisioned' and confirmation_expires_at <= now())
          returning id
        ), expired_fence as materialized (select count(*) from expired)
        insert into wordpress_connections (
          id, site_id, created_by, installation_id, environment, profile,
          target_origin, target_path, redirect_uri, webhook_url, scopes, status,
          code_challenge, authorization_code_digest, authorization_code_expires_at,
          authorization_code_used_at, confirmation_expires_at, confirmed_at,
          access_token_digest, access_token_expires_at, refresh_token_digest,
          desired_release_id, pending_release_id, next_sequence,
          last_acknowledged_sequence, active_release_id, active_hash
        ) select
          ${text(i.id)}, ${text(i.siteId)}, ${text(i.createdBy)}, ${
          text(i.installationId)
        },
          ${text(i.environment)}, ${text(i.profile)}, ${
          text(i.targetOrigin)
        }, ${text(i.targetPath)},
          ${text(i.redirectUri)}, ${text(i.webhookUrl)}, ${
          sql.json(jsonValue(i.scopes))
        }, ${text(i.status)},
          ${text(i.codeChallenge)}, ${text(i.authorizationCodeDigest)}, ${
          text(i.authorizationCodeExpiresAt)
        },
          ${
          i.authorizationCodeUsedAt == null
            ? null
            : text(i.authorizationCodeUsedAt)
        },
          ${
          i.confirmationExpiresAt == null ? null : text(i.confirmationExpiresAt)
        },
          ${i.confirmedAt == null ? null : text(i.confirmedAt)},
          ${i.accessTokenDigest == null ? null : text(i.accessTokenDigest)},
          ${
          i.accessTokenExpiresAt == null ? null : text(i.accessTokenExpiresAt)
        },
          ${i.refreshTokenDigest == null ? null : text(i.refreshTokenDigest)},
          ${i.desiredReleaseId == null ? null : text(i.desiredReleaseId)},
          ${i.pendingReleaseId == null ? null : text(i.pendingReleaseId)}, ${
          integer(i.nextSequence)
        },
          ${integer(i.lastAcknowledgedSequence)},
          ${i.activeReleaseId == null ? null : text(i.activeReleaseId)},
          ${i.activeHash == null ? null : text(i.activeHash)}
        from expired_fence returning *
      `,
      );
    }
    case "connection.byId":
      return one(
        await sql`select * from wordpress_connections where id = ${
          text(args.id)
        } limit 1`,
      );
    case "connection.forSite":
      return await sql`
        select * from wordpress_connections
        where site_id = ${
        text(args.siteId)
      } and status <> 'revoked' order by created_at
      `;
    case "connection.historyForSite":
      return await sql`
        select * from wordpress_connections
        where site_id = ${text(args.siteId)} order by created_at
      `;
    case "connection.canonicalProduction":
      return one(
        await sql`
        select * from wordpress_connections
        where site_id = ${text(args.siteId)} and environment = 'production'
          and confirmed_at is not null
        order by (status = 'active') desc, created_at desc limit 1
      `,
      );
    case "connection.authorization":
      return one(
        await sql`
        select * from wordpress_connections
        where authorization_code_digest = ${
          text(args.digest)
        } and ((status = 'pending' and authorization_code_expires_at > ${
          text(args.now)
        })
          or (status = 'provisioned' and confirmation_expires_at > ${
          text(args.now)
        }))
        limit 1
      `,
      );
    case "connection.useCode":
      return one(
        await sql`
        update wordpress_connections set authorization_code_used_at = coalesce(
          authorization_code_used_at, ${text(args.now)}
        ),
          updated_at = ${text(args.now)}
        where authorization_code_digest = ${
          text(args.digest)
        } and ((status = 'pending' and authorization_code_expires_at > ${
          text(args.now)
        })
          or (status = 'provisioned' and confirmation_expires_at > ${
          text(args.now)
        }))
        returning *
      `,
      );
    case "connection.provision":
      return one(
        await sql`
        update wordpress_connections set status = 'provisioned',
          access_token_digest = ${text(args.accessTokenDigest)},
          access_token_expires_at = ${text(args.accessTokenExpiresAt)},
          previous_access_token_digest = null,
          previous_access_token_expires_at = null,
          refresh_token_digest = ${
          text(args.refreshTokenDigest)
        }, confirmation_expires_at = coalesce(confirmation_expires_at, ${
          text(args.confirmationExpiresAt)
        }), updated_at = now()
        where id = ${text(args.id)} and status in ('pending', 'provisioned')
          and authorization_code_used_at is not null returning *
      `,
      );
    case "connection.confirm":
      return one(
        await sql`
        with locked as materialized (
          select * from wordpress_connections where id = ${
          text(args.id)
        } for update
        ), changed as (
          update wordpress_connections set status = 'active', confirmed_at = ${
          text(args.now)
        },
            updated_at = ${text(args.now)}
          where id = ${text(args.id)} and status = 'provisioned'
            and installation_id = ${text(args.installationId)}
            and access_token_digest = ${text(args.accessTokenDigest)}
            and access_token_expires_at > ${text(args.now)}
            and confirmation_expires_at > ${text(args.now)} returning *
        ) select coalesce(
            (select row_to_json(c)::jsonb from changed c),
            (select row_to_json(c)::jsonb from locked c where status = 'active'
              and installation_id = ${text(args.installationId)}
              and access_token_digest = ${text(args.accessTokenDigest)})
          ) as connection,
          coalesce((select status = 'active' from locked), false) as "alreadyConfirmed"
      `,
      );
    case "connection.byAccess":
      return one(
        await sql`
        select * from wordpress_connections where status = 'active' and (
          (access_token_digest = ${
          text(args.digest)
        } and access_token_expires_at > ${text(args.now)}) or
          (previous_access_token_digest = ${text(args.digest)}
            and previous_access_token_expires_at > ${text(args.now)})
        ) limit 1
      `,
      );
    case "connection.byRefresh":
      return one(
        await sql`
        select * from wordpress_connections where refresh_token_digest = ${
          text(args.digest)
        }
          and status in ('provisioned', 'active') limit 1
      `,
      );
    case "connection.rotateAccess":
      return one(
        await sql`
        update wordpress_connections set
          previous_access_token_digest = case
            when access_token_digest is not null and access_token_expires_at is not null
              then access_token_digest else null end,
          previous_access_token_expires_at = case
            when access_token_digest is not null and access_token_expires_at is not null
              then least(access_token_expires_at, now() + interval '2 minutes') else null end,
          access_token_digest = ${text(args.digest)},
          access_token_expires_at = ${text(args.expiresAt)}, updated_at = now()
        where id = ${text(args.id)} and (status = 'active'
          or (status = 'provisioned' and confirmation_expires_at > now())) returning *
      `,
      );
    case "connection.revoke":
      return await sql.begin(async (transaction) => {
        const connection = one(
          await transaction<Record<string, unknown>[]>`
          select * from wordpress_connections where id = ${text(args.id)}
            for update
        `,
        );
        if (!connection || connection.status === "pending") {
          return { ok: false, error: "unauthorized" };
        }
        const currentAccessMatches =
          typeof args.accessTokenDigest === "string" &&
          connection.access_token_digest === args.accessTokenDigest;
        const previousAccessMatches =
          typeof args.accessTokenDigest === "string" &&
          connection.previous_access_token_digest === args.accessTokenDigest;
        const accessMatches = currentAccessMatches || previousAccessMatches;
        const refreshMatches = typeof args.refreshTokenDigest === "string" &&
          connection.refresh_token_digest === args.refreshTokenDigest;
        if (!accessMatches && !refreshMatches) {
          return { ok: false, error: "unauthorized" };
        }
        if (connection.status === "revoked") {
          if (
            connection.revocation_idempotency_key !== args.idempotencyKey &&
            !String(connection.revocation_idempotency_key || "").startsWith(
              "expired-pairing-",
            )
          ) {
            return { ok: false, error: "idempotency-conflict" };
          }
          return { ok: true, connection, alreadyRevoked: true };
        }
        const matchedAccessExpiry = previousAccessMatches
          ? connection.previous_access_token_expires_at
          : connection.access_token_expires_at;
        if (
          !refreshMatches &&
          (!accessMatches || !matchedAccessExpiry ||
            new Date(String(matchedAccessExpiry)).getTime() <=
              new Date(text(args.now)).getTime())
        ) {
          return { ok: false, error: "unauthorized" };
        }
        const retainedAccessDigest = previousAccessMatches
          ? text(args.accessTokenDigest)
          : text(connection.access_token_digest);
        const revoked = one(
          await transaction<Record<string, unknown>[]>`
          update wordpress_connections set status = 'revoked', revoked_at = ${
            text(args.now)
          },
            revocation_idempotency_key = ${text(args.idempotencyKey)},
            access_token_digest = ${retainedAccessDigest},
            previous_access_token_digest = null, previous_access_token_expires_at = null,
            desired_release_id = null, pending_release_id = null, updated_at = ${
            text(args.now)
          }
          where id = ${
            text(args.id)
          } and status in ('provisioned', 'active') returning *
        `,
        );
        if (revoked) {
          await transaction`
            delete from connected_editor_sessions where connection_id = ${
            text(args.id)
          }
          `;
        }
        return revoked
          ? { ok: true, connection: revoked, alreadyRevoked: false }
          : { ok: false, error: "unauthorized" };
      });
    case "connection.setPending":
      return one(
        await sql`
        update wordpress_connections set
          pending_release_id = ${
          args.releaseId == null ? null : text(args.releaseId)
        }, updated_at = now()
        where id = ${text(args.id)} and status = 'active' returning *
      `,
      );

    case "grant.put": {
      const i = jsonValue(args.input) as Record<string, JsonValue>;
      return one(
        await sql`
        insert into connected_one_time_grants (
          digest, kind, site_id, connection_id, payload, expires_at
        ) values (
          ${text(i.digest)}, ${text(i.kind)}, ${
          i.siteId == null ? null : text(i.siteId)
        },
          ${i.connectionId == null ? null : text(i.connectionId)},
          ${sql.json(jsonValue(i.payload))}, ${text(i.expiresAt)}
        ) returning *
      `,
      );
    }
    case "grant.consume":
      return one(
        await sql`
        update connected_one_time_grants set used_at = ${text(args.now)}
        where digest = ${text(args.digest)} and kind = ${text(args.kind)}
          and used_at is null and expires_at > ${text(args.now)} returning *
      `,
      );
    case "editorCredential.put": {
      const i = jsonValue(args.input) as Record<string, JsonValue>;
      return one(
        await sql`
        insert into connected_editor_sessions (
          digest, connection_id, site_id, owner_id, expires_at
        ) values (
          ${text(i.digest)}, ${text(i.connectionId)}, ${text(i.siteId)},
          ${text(i.ownerId)}, ${text(i.expiresAt)}
        ) returning *
      `,
      );
    }
    case "editorCredential.get":
      return one(
        await sql`
        select session.* from connected_editor_sessions session
        join wordpress_connections connection on connection.id = session.connection_id
        where session.digest = ${text(args.digest)} and session.expires_at > ${
          text(args.now)
        } and connection.status = 'active' limit 1
      `,
      );

    case "contentIndex.replace": {
      const i = jsonValue(args.input) as Record<string, JsonValue>;
      return await sql.begin(async (transaction) => {
        const connection = one(
          await transaction<Record<string, unknown>[]>`
          select status from wordpress_connections where id = ${
            text(i.connectionId)
          }
            for update
        `,
        );
        if (!connection) return { ok: false, error: "unknown-connection" };
        if (connection.status !== "active") {
          return { ok: false, error: "connection-inactive" };
        }
        const current = one(
          await transaction<Record<string, unknown>[]>`
          select * from wordpress_content_indexes
          where connection_id = ${text(i.connectionId)} for update
        `,
        );
        const generation = integer(i.generation);
        if (current && generation < integer(current.generation)) {
          return { ok: false, error: "stale-generation" };
        }
        if (current && generation === integer(current.generation)) {
          if (text(i.bodyHash) !== text(current.body_hash)) {
            return { ok: false, error: "generation-conflict" };
          }
          return { ok: true, snapshot: current, duplicate: true };
        }
        const snapshot = one(
          await transaction<Record<string, unknown>[]>`
          insert into wordpress_content_indexes (
            connection_id, generation, body_hash, items, synced_at
          ) values (
            ${text(i.connectionId)}, ${generation}, ${text(i.bodyHash)},
            ${transaction.json(jsonValue(i.items))}, ${text(i.syncedAt)}
          ) on conflict (connection_id) do update set
            generation = excluded.generation, body_hash = excluded.body_hash,
            items = excluded.items, synced_at = excluded.synced_at
          returning *
        `,
        );
        return { ok: true, snapshot, duplicate: false };
      });
    }
    case "contentIndex.forSite":
      return await sql`
        select idx.* from wordpress_content_indexes idx
        join wordpress_connections connection on connection.id = idx.connection_id
        where connection.site_id = ${
        text(args.siteId)
      } and connection.status = 'active'
        order by connection.environment, idx.connection_id
      `;

    case "release.reserve": {
      const i = jsonValue(args.input) as Record<string, JsonValue>;
      return await sql.begin(async (transaction) => {
        const site = one(
          await transaction<Record<string, unknown>[]>`
          select id, published_release_id from sites where id = ${
            text(i.siteId)
          } for update
        `,
        );
        if (!site) throw new Error("site does not exist");
        const existing = one(
          await transaction<Record<string, unknown>[]>`
          select r.*, p.status as publication_status from site_release_reservations r
          left join site_release_publications p on p.release_id = r.release_id
          where r.site_id = ${text(i.siteId)} and r.idempotency_key = ${
            text(i.idempotencyKey)
          } limit 1
        `,
        );
        if (existing) {
          if (existing.publication_status === "aborted") {
            throw new Error(
              "idempotency key belongs to an abandoned release; use a new key",
            );
          }
          return existing;
        }
        const unbuilt = one(
          await transaction<Record<string, unknown>[]>`
          select r.* from site_release_reservations r
          left join site_release_publications p on p.release_id = r.release_id
          where r.site_id = ${text(i.siteId)} and p.release_id is null
          order by r.sequence desc limit 1 for update of r
        `,
        );
        if (unbuilt) {
          if (
            new Date(String(unbuilt.created_at)).getTime() >
              Date.now() - 5 * 60 * 1000
          ) {
            throw new Error(
              "another release is still being finalized; retry shortly",
            );
          }
          const built = one(
            await transaction<Record<string, unknown>[]>`
            select id from site_releases where id = ${
              text(unbuilt.release_id)
            } limit 1
          `,
          );
          if (!built) {
            return one(
              await transaction`
              update site_release_reservations set idempotency_key = ${
                text(i.idempotencyKey)
              },
                created_by = ${
                text(i.createdBy)
              }, created_at = now(), completed_at = null
              where site_id = ${text(i.siteId)} and release_id = ${
                text(unbuilt.release_id)
              } returning *
            `,
            );
          }
          await transaction`
            insert into site_release_publications (release_id, site_id, status, finalized_at)
            values (${text(unbuilt.release_id)}, ${text(i.siteId)}, ${
            site.published_release_id === unbuilt.release_id
              ? "published"
              : "aborted"
          }, now())
            on conflict (release_id) do nothing
          `;
        }
        const counter = one(
          await transaction<Record<string, unknown>[]>`
          insert into site_release_counters (site_id, next_sequence)
          values (${text(i.siteId)}, 2)
          on conflict (site_id) do update
          set next_sequence = site_release_counters.next_sequence + 1
          returning next_sequence - 1 as sequence
        `,
        );
        const parent = one(
          await transaction<Record<string, unknown>[]>`
          select r.id as release_id from site_releases r
          join site_release_publications p on p.release_id = r.id and p.status = 'published'
          where r.site_id = ${text(i.siteId)} order by r.sequence desc limit 1
        `,
        );
        return one(
          await transaction`
          insert into site_release_reservations (
            site_id, idempotency_key, release_id, sequence, parent_release_id, created_by
          ) values (
            ${text(i.siteId)}, ${text(i.idempotencyKey)}, ${text(i.releaseId)},
            ${integer(counter?.sequence)}, ${
            parent?.release_id == null ? null : text(parent.release_id)
          }, ${text(i.createdBy)}
          ) returning *
        `,
        );
      });
    }
    case "asset.blob.putChunk":
    case "release.blob.putChunk": {
      const validated = await validateBlobChunk(args.blob, args.chunk);
      const blob = validated.descriptor;
      const chunk = validated.chunk;
      return await sql.begin(async (transaction) => {
        await transaction`
          delete from gateway_blob_uploads
          where created_at < now() - interval '24 hours'
        `;
        await transaction`
          insert into gateway_blob_uploads (hash, bytes, chunk_bytes, chunk_count)
          values (${blob.hash}, ${blob.bytes}, ${blob.chunkBytes}, ${blob.chunkCount})
          on conflict (hash) do nothing
        `;
        const upload = one(
          await transaction<Record<string, unknown>[]>`
          select * from gateway_blob_uploads where hash = ${blob.hash} for share
        `,
        );
        if (
          !upload || Number(upload.bytes) !== blob.bytes ||
          Number(upload.chunk_bytes) !== blob.chunkBytes ||
          Number(upload.chunk_count) !== blob.chunkCount
        ) {
          throw new Error(
            "gateway blob descriptor conflicts with an existing upload",
          );
        }
        await transaction`
          insert into gateway_blob_chunks (blob_hash, chunk_index, bytes, chunk_hash, content)
          values (${blob.hash}, ${chunk.index}, ${chunk.bytes}, ${chunk.hash}, ${validated.content})
          on conflict (blob_hash, chunk_index) do nothing
        `;
        const stored = one(
          await transaction<Record<string, unknown>[]>`
          select chunk_index, bytes, chunk_hash from gateway_blob_chunks
          where blob_hash = ${blob.hash} and chunk_index = ${chunk.index} limit 1
        `,
        );
        if (
          !stored || Number(stored.bytes) !== chunk.bytes ||
          stored.chunk_hash !== chunk.hash
        ) {
          throw new Error(
            "gateway blob chunk conflicts with an existing upload",
          );
        }
        return { hash: blob.hash, index: chunk.index, stored: true };
      });
    }
    case "release.create": {
      const r = jsonValue(args.release) as Record<string, JsonValue>;
      const artifactBlob = validateBlobDescriptor(r.artifactBlob);
      if (
        artifactBlob.hash !== r.artifactHash ||
        artifactBlob.bytes !== integer(r.artifactBytes)
      ) {
        throw new Error(
          "release artifact blob does not match its declared hash and size",
        );
      }
      return await sql.begin(async (transaction) => {
        const prior = one(
          await transaction<Record<string, unknown>[]>`
          select id, site_id, sequence, source_version, schema_version, parent_release_id,
            artifact_hash, artifact_bytes, hosted_files, manifest, manifest_hash, signature, key_id,
            files, pages, cms, assets, scripts, audit, idempotency_key, created_by, created_at
          from site_releases where site_id = ${text(r.siteId)}
            and idempotency_key = ${text(r.idempotencyKey)} limit 1
        `,
        );
        if (prior) {
          await transaction`delete from gateway_blob_uploads where hash = ${artifactBlob.hash}`;
          return { row: releaseWire(prior), created: false };
        }
        const reservation = one(
          await transaction<Record<string, unknown>[]>`
          select * from site_release_reservations
          where site_id = ${text(r.siteId)} and idempotency_key = ${
            text(r.idempotencyKey)
          }
          for update
        `,
        );
        if (
          !reservation || reservation.release_id !== r.id ||
          Number(reservation.sequence) !== integer(r.sequence) ||
          (reservation.parent_release_id || null) !==
            (r.parentReleaseId || null) ||
          reservation.created_by !== r.createdBy ||
          reservation.completed_at != null
        ) {
          throw new Error(
            "release does not match its durable sequence reservation",
          );
        }
        const upload = one(
          await transaction<Record<string, unknown>[]>`
          select * from gateway_blob_uploads where hash = ${artifactBlob.hash} for update
        `,
        );
        if (
          !upload || Number(upload.bytes) !== artifactBlob.bytes ||
          Number(upload.chunk_bytes) !== artifactBlob.chunkBytes ||
          Number(upload.chunk_count) !== artifactBlob.chunkCount
        ) {
          throw new Error("release artifact upload is missing or incomplete");
        }
        const storedRows = await transaction<Record<string, unknown>[]>`
          select chunk_index, bytes, chunk_hash, content from gateway_blob_chunks
          where blob_hash = ${artifactBlob.hash} order by chunk_index
        `;
        const storedChunks: StoredGatewayBlobChunkV1[] = storedRows.map(
          (stored) => {
            if (!(stored.content instanceof Uint8Array)) {
              throw new Error(
                "database returned a gateway blob chunk in an unknown binary format",
              );
            }
            return {
              index: Number(stored.chunk_index),
              bytes: Number(stored.bytes),
              hash: String(stored.chunk_hash),
              content: stored.content,
            };
          },
        );
        const artifact = await assembleStoredGatewayBlob(
          artifactBlob,
          storedChunks,
        );
        const inserted = await transaction<Record<string, unknown>[]>`
          insert into site_releases (
            id, site_id, sequence, source_version, schema_version, parent_release_id,
            artifact_hash, artifact_bytes, artifact, hosted_files, manifest, manifest_hash, signature, key_id,
            files, pages, cms, assets, scripts, audit, idempotency_key, created_by, created_at
          ) values (
            ${text(r.id)}, ${text(r.siteId)}, ${integer(r.sequence)}, ${
          integer(r.sourceVersion)
        },
            ${integer(r.schemaVersion)}, ${
          r.parentReleaseId == null ? null : text(r.parentReleaseId)
        },
            ${text(r.artifactHash)}, ${integer(r.artifactBytes)}, ${artifact},
            ${transaction.json(jsonValue(r.hostedFiles))},
            ${text(r.manifest)}, ${text(r.manifestHash)}, ${
          text(r.signature)
        }, ${text(r.keyId)},
            ${transaction.json(jsonValue(r.files))}, ${
          transaction.json(jsonValue(r.pages))
        },
            ${transaction.json(jsonValue(r.cms))}, ${
          transaction.json(jsonValue(r.assets))
        },
            ${transaction.json(jsonValue(r.scripts))}, ${
          transaction.json(jsonValue(r.audit))
        },
            ${text(r.idempotencyKey)}, ${text(r.createdBy)}, ${
          text(r.createdAt)
        }
          ) on conflict (site_id, idempotency_key) do nothing returning
            id, site_id, sequence, source_version, schema_version, parent_release_id,
            artifact_hash, artifact_bytes, hosted_files, manifest, manifest_hash, signature, key_id,
            files, pages, cms, assets, scripts, audit, idempotency_key, created_by, created_at
        `;
        const row = inserted[0] ||
          one(
            await transaction<Record<string, unknown>[]>`
          select id, site_id, sequence, source_version, schema_version, parent_release_id,
            artifact_hash, artifact_bytes, hosted_files, manifest, manifest_hash, signature, key_id,
            files, pages, cms, assets, scripts, audit, idempotency_key, created_by, created_at
          from site_releases where site_id = ${text(r.siteId)}
            and idempotency_key = ${text(r.idempotencyKey)} limit 1
        `,
          );
        if (!row) throw new Error("release id or sequence already exists");
        if (inserted[0]) {
          const assets = Array.isArray(r.assets)
            ? r.assets as Array<Record<string, JsonValue>>
            : [];
          for (const asset of assets) {
            await transaction`
              insert into release_assets (release_id, asset_id, path, mime, bytes, hash, width, height)
              values (${text(r.id)}, ${text(asset.id)}, ${text(asset.path)}, ${
              text(asset.mime)
            },
                ${integer(asset.bytes)}, ${text(asset.hash)}, ${
              integer(asset.width)
            }, ${integer(asset.height)})
            `;
          }
        }
        await transaction`
          update site_release_reservations set completed_at = now()
          where site_id = ${text(r.siteId)} and idempotency_key = ${
          text(r.idempotencyKey)
        }
            and release_id = ${text(r.id)}
        `;
        await transaction`delete from gateway_blob_uploads where hash = ${artifactBlob.hash}`;
        return { row: releaseWire(row), created: !!inserted[0] };
      });
    }
    case "release.byId": {
      const row = one(
        await sql<Record<string, unknown>[]>`
        select id, site_id, sequence, source_version, schema_version, parent_release_id,
          artifact_hash, artifact_bytes, hosted_files, manifest, manifest_hash, signature, key_id,
          files, pages, cms, assets, scripts, audit, idempotency_key, created_by, created_at
        from site_releases where id = ${text(args.id)} limit 1
      `,
      );
      return row ? releaseWire(row) : null;
    }
    case "release.commitPublication": {
      return await sql.begin(async (transaction) => {
        const site = one(
          await transaction<Record<string, unknown>[]>`
          select * from sites where id = ${text(args.siteId)} for update
        `,
        );
        if (!site) return null;
        const release = one(
          await transaction<Record<string, unknown>[]>`
          select release.* from site_releases release
          join site_revisions revision on revision.site_id = release.site_id
            and revision.version = release.source_version
          left join site_release_publications publication on publication.release_id = release.id
          where release.id = ${text(args.releaseId)} and release.site_id = ${
            text(args.siteId)
          }
            and release.source_version = ${integer(args.sourceVersion)}
            and release.sequence = ${integer(args.releaseSequence)}
            and publication.status is distinct from 'aborted' limit 1
        `,
        );
        if (!release) return null;
        const changed = one(
          await transaction<Record<string, unknown>[]>`
          update sites set published_version = ${integer(args.sourceVersion)},
            published_release_id = ${text(args.releaseId)},
            published_release_sequence = ${integer(args.releaseSequence)},
            updated_at = ${text(args.publishedAt)}
          where id = ${text(args.siteId)}
            and (published_release_sequence < ${integer(args.releaseSequence)}
              or (published_release_sequence = ${integer(args.releaseSequence)}
                and (published_release_id is null or published_release_id = ${
            text(args.releaseId)
          }))) returning published_version, published_release_id
        `,
        );
        if (changed) {
          await transaction`
            insert into site_release_publications (release_id, site_id, status, finalized_at)
            values (${text(args.releaseId)}, ${
            text(args.siteId)
          }, 'published', ${text(args.publishedAt)})
            on conflict (release_id) do nothing
          `;
        }
        const updated = one(
          await transaction<Record<string, unknown>[]>`
          select published_version, published_release_id from sites where id = ${
            text(args.siteId)
          }
        `,
        );
        return updated
          ? {
            publishedVersion: Number(updated.published_version),
            publishedReleaseId: updated.published_release_id,
          }
          : null;
      });
    }
    case "release.markPublished": {
      const row = one(
        await sql<Record<string, unknown>[]>`
        with release as materialized (
          select id, site_id from site_releases where id = ${
          text(args.releaseId)
        }
        ), made as (
          insert into site_release_publications (release_id, site_id, status, finalized_at)
          select id, site_id, 'published', ${
          text(args.publishedAt)
        } from release
          on conflict (release_id) do nothing returning status
        ) select status from made union all
          select status from site_release_publications where release_id = ${
          text(args.releaseId)
        }
            and not exists (select 1 from made) limit 1
      `,
      );
      return row?.status === "published";
    }
    case "release.artifactChunk": {
      const index = integer(args.index);
      if (!Number.isSafeInteger(index) || index < 0) {
        throw Object.assign(new Error("invalid release artifact chunk index"), {
          status: 400,
        });
      }
      const metadata = one(
        await sql<Record<string, unknown>[]>`
        select artifact_hash, artifact_bytes from site_releases where id = ${
          text(args.id)
        } limit 1
      `,
      );
      if (!metadata) return null;
      const chunkBytes = 512 * 1024;
      const totalBytes = Number(metadata.artifact_bytes);
      const chunkCount = Math.ceil(totalBytes / chunkBytes);
      if (index >= chunkCount) return null;
      const offset = index * chunkBytes;
      const row = one(
        await sql<Record<string, unknown>[]>`
        select substring(artifact from ${
          offset + 1
        } for ${chunkBytes}) as content
        from site_releases where id = ${text(args.id)} limit 1
      `,
      );
      if (!row || !(row.content instanceof Uint8Array)) {
        throw new Error(
          "database returned a release artifact chunk in an unknown binary format",
        );
      }
      return {
        index,
        offset,
        bytes: row.content.byteLength,
        hash: await hexSha256(row.content),
        content: toBase64(row.content),
      };
    }
    case "release.forSite":
      return (await sql<Record<string, unknown>[]>`
        select r.id, r.site_id, r.sequence, r.source_version, r.schema_version, r.parent_release_id,
          r.artifact_hash, r.artifact_bytes, r.manifest, r.manifest_hash, r.signature, r.key_id,
          r.files, r.pages, r.cms, r.assets, r.scripts, r.audit, r.idempotency_key, r.created_by, r.created_at
        from site_releases r join site_release_publications publication
          on publication.release_id = r.id and publication.status = 'published'
        where r.site_id = ${text(args.siteId)} order by r.sequence desc
      `).map(releaseSummaryWire);

    case "target.create": {
      const t = jsonValue(args.target) as Record<string, JsonValue>;
      return await sql.begin(async (transaction) => {
        const existing = one(
          await transaction<Record<string, unknown>[]>`
          select * from release_targets where connection_id = ${
            text(t.connectionId)
          }
            and release_id = ${text(t.releaseId)} limit 1
        `,
        );
        if (existing) {
          const attached = one(
            await transaction`
            update wordpress_connections set
              desired_release_id = case when ${Boolean(args.desired)} then ${
              text(t.releaseId)
            } else desired_release_id end,
              pending_release_id = case
                when ${Boolean(args.desired)} and pending_release_id = ${
              text(t.releaseId)
            } then null
                else pending_release_id end,
              updated_at = case when ${
              Boolean(args.desired)
            } then now() else updated_at end
            where id = ${text(t.connectionId)} and status = 'active'
              and exists (select 1 from site_release_publications
                where release_id = ${
              text(t.releaseId)
            } and status = 'published')
              and (not ${Boolean(args.desired)} or (${
              integer(t.sequence)
            } > last_acknowledged_sequence
                and active_release_id is distinct from ${text(t.releaseId)}))
              and (not ${Boolean(args.desired)} or desired_release_id is null
                or desired_release_id = ${text(t.releaseId)})
              and (not ${
              Boolean(args.desired)
            } or active_release_id is null or exists (
                select 1 from site_releases candidate join site_releases active
                  on active.id = wordpress_connections.active_release_id
                where candidate.id = ${text(t.releaseId)}
                  and active.sequence < candidate.sequence
              )) returning id
          `,
          );
          if (!attached) {
            const current = one(
              await transaction<Record<string, unknown>[]>`
              select * from wordpress_connections where id = ${
                text(t.connectionId)
              } limit 1
            `,
            );
            if (
              current?.status === "active" && Boolean(args.desired) &&
              (integer(t.sequence) <=
                  Number(current.last_acknowledged_sequence) ||
                current.active_release_id === t.releaseId)
            ) return { row: existing, created: false };
            throw new Error(
              "another release is already desired or the connection is inactive",
            );
          }
          return { row: existing, created: false };
        }
        const rows = await transaction<Record<string, unknown>[]>`
          with eligible as (
            select c.id from wordpress_connections c
            join site_releases r on r.site_id = c.site_id
            left join site_releases active on active.id = c.active_release_id
            join site_release_publications publication
              on publication.release_id = r.id and publication.status = 'published'
            where c.id = ${text(t.connectionId)} and r.id = ${text(t.releaseId)}
              and c.status = 'active' and c.next_sequence = ${
          integer(t.sequence)
        }
              and (c.active_release_id is null
                or (active.id is not null and active.sequence < r.sequence))
            for update of c
          ), inserted as (
            insert into release_targets (release_id, connection_id, sequence, envelope, signature, key_id, created_at)
            select ${text(t.releaseId)}, id, ${integer(t.sequence)}, ${
          text(t.envelope)
        },
              ${text(t.signature)}, ${text(t.keyId)}, ${
          text(t.createdAt)
        } from eligible returning *
          ), advanced as (
            update wordpress_connections c set next_sequence = next_sequence + 1,
              desired_release_id = case when ${Boolean(args.desired)} then ${
          text(t.releaseId)
        } else desired_release_id end,
              pending_release_id = case when ${
          Boolean(args.desired)
        } and pending_release_id = ${
          text(t.releaseId)
        } then null else pending_release_id end,
              updated_at = now()
            where c.id = ${
          text(t.connectionId)
        } and exists (select 1 from inserted) returning c.id
          ) select i.* from inserted i, advanced a
        `;
        if (!rows[0]) {
          const raced = one(
            await transaction<Record<string, unknown>[]>`
            select * from release_targets where connection_id = ${
              text(t.connectionId)
            }
              and release_id = ${text(t.releaseId)} limit 1
          `,
          );
          if (raced) {
            const attached = one(
              await transaction`
              update wordpress_connections set
                desired_release_id = case when ${Boolean(args.desired)} then ${
                text(t.releaseId)
              } else desired_release_id end,
                pending_release_id = case
                  when ${Boolean(args.desired)} and pending_release_id = ${
                text(t.releaseId)
              } then null
                  else pending_release_id end,
                updated_at = case when ${
                Boolean(args.desired)
              } then now() else updated_at end
              where id = ${text(t.connectionId)} and status = 'active'
                and exists (select 1 from site_release_publications
                  where release_id = ${
                text(t.releaseId)
              } and status = 'published')
                and (not ${Boolean(args.desired)} or (${
                integer(t.sequence)
              } > last_acknowledged_sequence
                  and active_release_id is distinct from ${text(t.releaseId)}))
                and (not ${Boolean(args.desired)} or desired_release_id is null
                  or desired_release_id = ${text(t.releaseId)})
                and (not ${
                Boolean(args.desired)
              } or active_release_id is null or exists (
                  select 1 from site_releases candidate join site_releases active
                    on active.id = wordpress_connections.active_release_id
                  where candidate.id = ${text(t.releaseId)}
                    and active.sequence < candidate.sequence
                )) returning id
            `,
            );
            if (!attached) {
              const current = one(
                await transaction<Record<string, unknown>[]>`
                select * from wordpress_connections where id = ${
                  text(t.connectionId)
                } limit 1
              `,
              );
              if (
                current?.status === "active" && Boolean(args.desired) &&
                (integer(t.sequence) <=
                    Number(current.last_acknowledged_sequence) ||
                  current.active_release_id === t.releaseId)
              ) return { row: raced, created: false };
              throw new Error(
                "another release is already desired or the connection is inactive",
              );
            }
            return { row: raced, created: false };
          }
          throw new Error(
            "release target is not eligible or sequence is not next",
          );
        }
        return { row: rows[0], created: true };
      });
    }
    case "target.byRelease":
      return one(
        await sql`
        select * from release_targets where connection_id = ${
          text(args.connectionId)
        }
          and release_id = ${text(args.releaseId)} limit 1
      `,
      );
    case "target.desired": {
      const connection = one(
        await sql<Record<string, unknown>[]>`
        select * from wordpress_connections where id = ${
          text(args.connectionId)
        }
          and status = 'active' and desired_release_id is not null limit 1
      `,
      );
      if (!connection) return null;
      const release = one(
        await sql<Record<string, unknown>[]>`
        select r.id, r.site_id, r.sequence, r.source_version, r.schema_version, r.parent_release_id,
          r.artifact_hash, r.artifact_bytes, r.manifest, r.manifest_hash, r.signature, r.key_id,
          r.files, r.pages, r.cms, r.assets, r.scripts, r.audit, r.idempotency_key, r.created_by, r.created_at
        from site_releases r join site_release_publications publication
          on publication.release_id = r.id and publication.status = 'published'
        where r.id = ${text(connection.desired_release_id)} limit 1
      `,
      );
      const target = release && one(
        await sql<Record<string, unknown>[]>`
        select * from release_targets where connection_id = ${
          text(args.connectionId)
        }
          and release_id = ${text(connection.desired_release_id)} limit 1
      `,
      );
      return release && target
        ? { connection, release: releaseSummaryWire(release), target }
        : null;
    }

    case "deployment.forRelease":
      return await sql`
        select * from deployments where release_id = ${
        text(args.releaseId)
      } order by created_at
      `;
    case "deployment.record": {
      const i = jsonValue(args.input) as Record<string, JsonValue>;
      return await sql.begin(async (transaction) => {
        const connection = one(
          await transaction<Record<string, unknown>[]>`
          select * from wordpress_connections where id = ${
            text(i.connectionId)
          } for update
        `,
        );
        const release = one(
          await transaction<Record<string, unknown>[]>`
          select * from site_releases where id = ${text(i.releaseId)} limit 1
        `,
        );
        const target = one(
          await transaction<Record<string, unknown>[]>`
          select * from release_targets where connection_id = ${
            text(i.connectionId)
          }
            and release_id = ${text(i.releaseId)} limit 1
        `,
        );
        if (
          !connection || !release || !target ||
          connection.site_id !== release.site_id
        ) {
          return { ok: false, error: "unknown-target" };
        }
        if (connection.status !== "active") {
          return { ok: false, error: "connection-inactive" };
        }
        const duplicate = one(
          await transaction<Record<string, unknown>[]>`
          select * from deployments where connection_id = ${
            text(i.connectionId)
          }
            and idempotency_key = ${text(i.idempotencyKey)} limit 1
        `,
        );
        if (duplicate) {
          if (duplicate.body_hash !== i.bodyHash) {
            return { ok: false, error: "idempotency-conflict" };
          }
          return {
            ok: true,
            duplicate: true,
            deployment: duplicate,
            connection,
          };
        }
        if (integer(i.sequence) !== Number(target.sequence)) {
          return { ok: false, error: "wrong-sequence" };
        }
        if (
          integer(i.sequence) < Number(connection.last_acknowledged_sequence)
        ) return { ok: false, error: "replay" };
        if (i.status === "live" && i.activeHash !== release.artifact_hash) {
          return { ok: false, error: "wrong-hash" };
        }
        const rollbackRelease =
          i.status === "rolled_back" && i.activeHash != null
            ? one(
              await transaction<Record<string, unknown>[]>`
              select r.id, r.artifact_hash from site_releases r
              join site_release_publications publication
                on publication.release_id = r.id and publication.status = 'published'
              where r.site_id = ${text(connection.site_id)}
                and r.artifact_hash = ${text(i.activeHash)} limit 1
            `,
            )
            : null;
        if (i.status === "rolled_back" && !rollbackRelease) {
          return { ok: false, error: "wrong-hash" };
        }
        const prior = one(
          await transaction<Record<string, unknown>[]>`
          select * from deployments where connection_id = ${
            text(i.connectionId)
          }
            and release_id = ${text(i.releaseId)} and sequence = ${
            integer(i.sequence)
          }
          order by created_at desc limit 1
        `,
        );
        const status = text(i.status);
        if (
          (!prior && status !== "queued") ||
          (prior && !DEPLOYMENT_NEXT[text(prior.status)]?.includes(status))
        ) {
          return { ok: false, error: "status-conflict" };
        }
        const deployment = one(
          await transaction<Record<string, unknown>[]>`
          insert into deployments (
            id, connection_id, release_id, sequence, status, active_hash, error, detail,
            idempotency_key, body_hash, created_at
          ) values (
            ${crypto.randomUUID()}, ${text(i.connectionId)}, ${
            text(i.releaseId)
          }, ${integer(i.sequence)},
            ${status}, ${i.activeHash == null ? null : text(i.activeHash)},
            ${i.error == null ? null : text(i.error)},
            ${i.detail == null ? null : transaction.json(jsonValue(i.detail))},
            ${text(i.idempotencyKey)}, ${text(i.bodyHash)}, now()
          ) returning *
        `,
        );
        if (status === "live") {
          await transaction`
            update wordpress_connections set last_acknowledged_sequence = ${
            integer(i.sequence)
          },
              active_release_id = ${text(i.releaseId)}, active_hash = ${
            text(i.activeHash)
          },
              desired_release_id = case when desired_release_id = ${
            text(i.releaseId)
          } then null else desired_release_id end,
              pending_release_id = case when pending_release_id = ${
            text(i.releaseId)
          } then null else pending_release_id end,
              updated_at = now() where id = ${
            text(i.connectionId)
          } and status = 'active'
          `;
          if (connection.environment === "staging") {
            await transaction`
              update wordpress_connections set pending_release_id = ${
              text(i.releaseId)
            }, updated_at = now()
              where site_id = ${
              text(connection.site_id)
            } and environment = 'production'
                and status = 'active' and active_release_id is distinct from ${
              text(i.releaseId)
            }
                and (active_release_id is null
                  or (select sequence from site_releases where id = active_release_id)
                    < (select sequence from site_releases where id = ${
              text(i.releaseId)
            }))
                and (pending_release_id is null or pending_release_id = ${
              text(i.releaseId)
            }
                  or (select sequence from site_releases where id = pending_release_id)
                    <= (select sequence from site_releases where id = ${
              text(i.releaseId)
            }))
            `;
          }
        } else if (status === "rolled_back" && rollbackRelease) {
          await transaction`
            update wordpress_connections c set active_release_id = ${
            text(rollbackRelease.id)
          },
              active_hash = ${text(rollbackRelease.artifact_hash)},
              desired_release_id = case when c.desired_release_id = ${
            text(i.releaseId)
          } then null else c.desired_release_id end,
              pending_release_id = case when c.pending_release_id = ${
            text(i.releaseId)
          } then null else c.pending_release_id end, updated_at = now()
            where c.id = ${text(i.connectionId)} and c.status = 'active'
          `;
        } else if (status === "failed" || status === "rolled_back") {
          await transaction`
            update wordpress_connections set pending_release_id = case when pending_release_id = ${
            text(i.releaseId)
          } then null else pending_release_id end,
              desired_release_id = case when desired_release_id = ${
            text(i.releaseId)
          } then null else desired_release_id end,
              updated_at = now() where id = ${
            text(i.connectionId)
          } and status = 'active'
          `;
        }
        const updated = one(
          await transaction`
          select * from wordpress_connections where id = ${
            text(i.connectionId)
          } limit 1
        `,
        );
        return { ok: true, deployment, connection: updated };
      });
    }

    case "webhook.enqueue": {
      const i = jsonValue(args.input) as Record<string, JsonValue>;
      const rows = await sql<Record<string, unknown>[]>`
        insert into wordpress_webhook_outbox (
          event_id, connection_id, release_id, target_sequence, webhook_url, payload,
          body_hash, signature, key_id
        ) values (
          ${text(i.eventId)}, ${text(i.connectionId)}, ${text(i.releaseId)}, ${
        integer(i.targetSequence)
      },
          ${text(i.webhookUrl)}, ${
        sql.json(JSON.parse(text(i.payload)) as JsonValue)
      },
          ${text(i.bodyHash)}, ${text(i.signature)}, ${text(i.keyId)}
        ) on conflict (connection_id, release_id) do nothing returning *
      `;
      const row = rows[0] || one(
        await sql<Record<string, unknown>[]>`
        select * from wordpress_webhook_outbox where connection_id = ${
          text(i.connectionId)
        }
          and release_id = ${text(i.releaseId)} limit 1
      `,
      );
      if (!row || row.body_hash !== i.bodyHash) {
        throw new Error("webhook idempotency conflict");
      }
      return row;
    }
    case "webhook.claim":
      return await sql`
        with claim as (
          select event_id from wordpress_webhook_outbox
          where delivered_at is null and next_attempt_at <= now()
            and (locked_at is null or locked_at < now() - interval '5 minutes')
          order by next_attempt_at, created_at for update skip locked
          limit ${Math.max(1, Math.min(integer(args.limit), 100))}
        ) update wordpress_webhook_outbox o
        set locked_at = now(), locked_by = ${
        text(args.worker)
      }, attempts = attempts + 1
        from claim where o.event_id = claim.event_id returning o.*
      `;
    case "webhook.settle":
      await sql`
        update wordpress_webhook_outbox set locked_at = null, locked_by = null,
          delivered_at = case when ${
        Boolean(args.delivered)
      } then now() else delivered_at end,
          next_attempt_at = ${text(args.nextAttemptAt)},
          last_error = ${
        args.error == null ? null : text(args.error).slice(0, 2000)
      }
        where event_id = ${text(args.eventId)}
      `;
      return true;

    case "asset.list":
      return await sql`
        select id, site_id, name, type, w, h, owner_id, storage_path,
          stored_bytes, original_bytes, content_hash, optimized
        from assets where site_id = ${text(args.siteId)} order by name
      `;
    case "asset.get": {
      const row = one(
        await sql`
        select * from assets where site_id = ${text(args.siteId)} and id = ${
          text(args.id)
        } limit 1
      `,
      );
      return row ? await assetWire(row) : null;
    }
    case "asset.byPath": {
      const rows = await sql<{ id: string; name: string }[]>`
        select id, name from assets where site_id = ${
        text(args.siteId)
      } order by name
      `;
      const path = text(args.path);
      const found = rows.find((row) =>
        immutableAssetPath(row) === path || legacyAssetPath(row) === path
      );
      if (!found) return null;
      const row = one(
        await sql`
        select * from assets where site_id = ${
          text(args.siteId)
        } and id = ${found.id} limit 1
      `,
      );
      return row ? await assetWire(row) : null;
    }
    case "asset.put": {
      const row = one(
        await sql`
        insert into assets (id, site_id, name, type, w, h, bytes)
        values (
          ${text(args.id)}, ${text(args.siteId)}, ${text(args.name)}, ${
          text(args.type)
        },
          ${integer(args.w)}, ${integer(args.h)}, ${
          fromBase64(text(args.bytes))
        }
        )
        on conflict (id) do update set
          name = excluded.name, type = excluded.type,
          w = excluded.w, h = excluded.h, bytes = excluded.bytes
        returning id, site_id, name, type, w, h
      `,
      );
      return row;
    }
    case "asset.putBlob":
    case "asset.putBlobConnected": {
      const connected = op === "asset.putBlobConnected";
      const connectionId = connected ? text(args.connectionId) : "";
      if (
        !args.asset || typeof args.asset !== "object" ||
        Array.isArray(args.asset)
      ) {
        throw Object.assign(new Error("invalid asset blob metadata"), {
          status: 400,
          code: "INVALID_ASSET_BLOB",
        });
      }
      const input = jsonValue(args.asset) as Record<string, JsonValue>;
      const blob = validateAssetBlobDescriptor(input.blob);
      const id = text(input.id);
      const siteId = text(input.siteId);
      const name = text(input.name);
      const type = text(input.type);
      const w = integer(input.w);
      const h = integer(input.h);
      const requestedOwnerId = text(input.ownerId);
      const limitBytes = Number(input.limitBytes || FREE_STORAGE_BYTES);
      const originalBytes = Number(input.originalBytes || blob.bytes);
      const contentHash = text(input.contentHash);
      const optimized = Boolean(input.optimized);
      if (
        !id || !siteId || !name || !type || (connected && !connectionId) ||
        !Number.isSafeInteger(limitBytes) || limitBytes < 1 ||
        !Number.isSafeInteger(originalBytes) || originalBytes < 0 ||
        !/^[a-f0-9]{64}$/i.test(contentHash) ||
        !Number.isSafeInteger(w) || w < 0 ||
        !Number.isSafeInteger(h) || h < 0 ||
        blob.bytes > GATEWAY_ASSET_BLOB_MAX_BYTES
      ) {
        throw Object.assign(new Error("invalid asset blob metadata"), {
          status: 400,
          code: "INVALID_ASSET_BLOB",
        });
      }
      let uploadedPath = "";
      let replacedPath = "";
      try {
        const saved = await sql.begin(async (transaction) => {
        /* Connection revocation takes the same row lock. This makes finalization linearizable:
           a request may upload disposable chunks before revocation, but it cannot create or
           replace a durable asset after Disconnect has committed. */
        let connectionOwnerId = "";
        if (connected) {
          const guard = one(
            await transaction<Record<string, unknown>[]>`
            select id, created_by from wordpress_connections
            where id = ${connectionId} and site_id = ${siteId}
              and status = 'active' and access_token_expires_at > now()
            for update
          `,
          );
          if (!guard) return null;
          connectionOwnerId = text(guard.created_by);
        }
        const ownerId = connected
          ? connectionOwnerId
          : requestedOwnerId || text(one(await transaction<Record<string, unknown>[]>`
              select user_id from site_users where site_id = ${siteId} and role = 'owner'
              order by user_id limit 1
            `)?.user_id);
        if (!ownerId) {
          throw Object.assign(new Error("site storage owner does not exist"), {
            status: 409, code: "STORAGE_OWNER_MISSING",
          });
        }
        const owner = one(await transaction<Record<string, unknown>[]>`
          select id from users where id = ${ownerId} for update
        `);
        if (!owner) {
          throw Object.assign(new Error("site storage owner does not exist"), {
            status: 409, code: "STORAGE_OWNER_MISSING",
          });
        }
        const prior = one(
          await transaction<Record<string, unknown>[]>`
          select id, site_id, owner_id, name, type, w, h, bytes, storage_path,
            stored_bytes, original_bytes, content_hash, optimized
          from assets where id = ${id} limit 1 for update
        `,
        );
        if (prior && prior.site_id !== siteId) {
          throw Object.assign(
            new Error("asset id already belongs to another site"),
            { status: 409, code: "ASSET_ID_CONFLICT" },
          );
        }
        if (prior) {
          const exactRetry = prior.name === name && prior.type === type &&
            Number(prior.w) === w && Number(prior.h) === h &&
            Number(prior.stored_bytes || (prior.bytes instanceof Uint8Array ? prior.bytes.byteLength : 0)) === blob.bytes &&
            (text(prior.content_hash) === contentHash ||
              (!prior.content_hash && prior.bytes instanceof Uint8Array && await hexSha256(prior.bytes) === blob.hash));
          if (exactRetry) {
            return {
              id: prior.id,
              site_id: prior.site_id,
              name: prior.name,
              type: prior.type,
              w: Number(prior.w),
              h: Number(prior.h),
              owner_id: prior.owner_id || ownerId,
              storage_path: prior.storage_path || null,
              stored_bytes: Number(prior.stored_bytes || blob.bytes),
              original_bytes: Number(prior.original_bytes || originalBytes),
              content_hash: prior.content_hash || contentHash,
              optimized: Boolean(prior.optimized),
            };
          }
          if (connected) return null;
        }
        const upload = one(
          await transaction<Record<string, unknown>[]>`
          select * from gateway_blob_uploads where hash = ${blob.hash} for share
        `,
        );
        if (
          !upload || Number(upload.bytes) !== blob.bytes ||
          Number(upload.chunk_bytes) !== blob.chunkBytes ||
          Number(upload.chunk_count) !== blob.chunkCount
        ) {
          throw Object.assign(
            new Error("asset blob upload is missing or incomplete"),
            { status: 409, code: "ASSET_BLOB_UNAVAILABLE" },
          );
        }
        const storedRows = await transaction<Record<string, unknown>[]>`
          select chunk_index, bytes, chunk_hash, content from gateway_blob_chunks
          where blob_hash = ${blob.hash} order by chunk_index
        `;
        const storedChunks: StoredGatewayBlobChunkV1[] = storedRows.map(
          (stored) => {
            if (!(stored.content instanceof Uint8Array)) {
              throw new Error(
                "database returned a gateway blob chunk in an unknown binary format",
              );
            }
            return {
              index: Number(stored.chunk_index),
              bytes: Number(stored.bytes),
              hash: String(stored.chunk_hash),
              content: stored.content,
            };
          },
        );
        const bytes = await assembleStoredGatewayBlob(blob, storedChunks);
        const usedRow = one(await transaction<Record<string, unknown>[]>`
          select coalesce(sum(stored_bytes), 0)::text as used
          from assets where owner_id = ${ownerId}
        `);
        const usedBytes = Number(usedRow?.used || 0);
        const replacingBytes = prior && text(prior.owner_id) === ownerId
          ? Number(prior.stored_bytes || (prior.bytes instanceof Uint8Array ? prior.bytes.byteLength : 0))
          : 0;
        if (usedBytes - replacingBytes + bytes.byteLength > limitBytes) {
          throw Object.assign(new Error("free account media storage limit reached"), {
            status: 409, code: "STORAGE_LIMIT",
          });
        }
        uploadedPath = assetStoragePath(ownerId, siteId, id, blob.hash, type);
        replacedPath = prior?.storage_path && text(prior.storage_path) !== uploadedPath
          ? text(prior.storage_path)
          : "";
        const stored = await storage.from(ASSET_BUCKET).upload(uploadedPath, bytes, {
          contentType: type,
          cacheControl: "31536000",
          upsert: false,
        });
        if (stored.error && stored.error.message !== "The resource already exists") {
          throw new Error(`stored asset could not be written: ${stored.error.message}`);
        }
        const row = connected
          ? one(
            await transaction<Record<string, unknown>[]>`
              insert into assets (id, site_id, owner_id, name, type, w, h, bytes,
                storage_path, stored_bytes, original_bytes, content_hash, optimized)
              values (${id}, ${siteId}, ${ownerId}, ${name}, ${type}, ${w}, ${h}, null,
                ${uploadedPath}, ${bytes.byteLength}, ${originalBytes}, ${contentHash}, ${optimized})
              on conflict (id) do update set id = assets.id
              where assets.site_id = excluded.site_id
                and assets.name = excluded.name and assets.type = excluded.type
                and assets.w = excluded.w and assets.h = excluded.h
                and assets.content_hash = excluded.content_hash
              returning id, site_id, name, type, w, h, owner_id, storage_path,
                stored_bytes, original_bytes, content_hash, optimized
            `,
          )
          : one(
            await transaction<Record<string, unknown>[]>`
              insert into assets (id, site_id, owner_id, name, type, w, h, bytes,
                storage_path, stored_bytes, original_bytes, content_hash, optimized)
              values (${id}, ${siteId}, ${ownerId}, ${name}, ${type}, ${w}, ${h}, null,
                ${uploadedPath}, ${bytes.byteLength}, ${originalBytes}, ${contentHash}, ${optimized})
              on conflict (id) do update set
                name = excluded.name, type = excluded.type,
                w = excluded.w, h = excluded.h, bytes = null,
                owner_id = excluded.owner_id, storage_path = excluded.storage_path,
                stored_bytes = excluded.stored_bytes, original_bytes = excluded.original_bytes,
                content_hash = excluded.content_hash, optimized = excluded.optimized
              where assets.site_id = excluded.site_id
              returning id, site_id, name, type, w, h, owner_id, storage_path,
                stored_bytes, original_bytes, content_hash, optimized
            `,
          );
        if (!row) {
          if (connected) return null;
          throw Object.assign(
            new Error("asset id already belongs to another site"),
            { status: 409, code: "ASSET_ID_CONFLICT" },
          );
        }
        /* Keep content-addressed chunks briefly so concurrent equal uploads and exact retries
           remain safe. The existing 24-hour TTL cleanup on chunk ingress removes completed or
           abandoned staging rows without touching durable assets. */
        return row;
        });
        if (replacedPath) {
          const removed = await storage.from(ASSET_BUCKET).remove([replacedPath]);
          if (removed.error) console.error("could not remove replaced asset", removed.error);
        }
        return saved;
      } catch (error) {
        if (uploadedPath) await storage.from(ASSET_BUCKET).remove([uploadedPath]).catch(() => undefined);
        throw error;
      }
    }
    case "asset.usage": {
      const row = one(await sql`
        select coalesce(sum(stored_bytes), 0)::text as used
        from assets where owner_id = ${text(args.ownerId)}
      `);
      return Number(row?.used || 0);
    }
    case "asset.remove": {
      const row = one(await sql<Record<string, unknown>[]>`
        delete from assets where site_id = ${text(args.siteId)} and id = ${text(args.id)}
        returning id, storage_path
      `);
      if (!row) return false;
      if (row.storage_path) {
        const result = await storage.from(ASSET_BUCKET).remove([text(row.storage_path)]);
        if (result.error) console.error("could not remove stored asset", result.error);
      }
      return true;
    }

    case "auth.userByEmail":
      return one(
        await sql`select id, email, name, auth_user_id from users where email = ${
          text(args.email)
        } limit 1`,
      );
    case "auth.userById":
      return one(
        await sql`select id, email, name, auth_user_id from users where id = ${
          text(args.id)
        } limit 1`,
      );
    case "auth.userByAuthId":
      return one(
        await sql`select id, email, name, auth_user_id from users where auth_user_id = ${
          text(args.authUserId)
        } limit 1`,
      );
    case "auth.ensureAuthUser": {
      const rows = await sql`
        insert into users (id, email, name, auth_user_id)
        values (${text(args.id)}, ${text(args.email)}, ${text(args.name)}, ${
        text(args.authUserId)
      })
        on conflict (email) do update set
          auth_user_id = excluded.auth_user_id,
          name = coalesce(nullif(excluded.name, ''), users.name)
        where users.auth_user_id is null or users.auth_user_id = excluded.auth_user_id
        returning id, email, name, auth_user_id
      `;
      if (!rows[0]) {
        throw Object.assign(
          new Error("that email is already linked to another identity"),
          { status: 409, code: "AUTH_IDENTITY_CONFLICT" },
        );
      }
      return rows[0];
    }
    case "auth.usersByIds": {
      const ids = Array.isArray(args.ids)
        ? [...new Set(args.ids.map(text).filter(Boolean))].slice(0, 500)
        : [];
      return ids.length
        ? await sql`select id, email, name, auth_user_id from users where id in ${
          sql(ids)
        }`
        : [];
    }
    case "auth.createUser":
      return one(
        await sql`
        insert into users (id, email, name) values (${text(args.id)}, ${
          text(args.email)
        }, ${text(args.name)})
        on conflict (email) do update
          set name = coalesce(nullif(excluded.name, ''), users.name)
        returning id, email, name, auth_user_id
      `,
      );
    case "auth.putLink":
      await sql`
        insert into login_links (digest, email, expires_at)
        values (${text(args.digest)}, ${text(args.email)}, ${
        text(args.expiresAt)
      })
        on conflict (digest) do update
          set email = excluded.email, expires_at = excluded.expires_at
      `;
      return true;
    case "auth.useLink":
      return one(
        await sql`
        delete from login_links where digest = ${
          text(args.digest)
        } returning email, expires_at
      `,
      );
    case "auth.putSession":
      await sql`
        insert into sessions (digest, user_id, expires_at)
        values (${text(args.digest)}, ${text(args.userId)}, ${
        text(args.expiresAt)
      })
      `;
      return true;
    case "auth.sessionByDigest":
      return one(
        await sql`select * from sessions where digest = ${
          text(args.digest)
        } limit 1`,
      );
    case "auth.userForSession": {
      const digest = text(args.digest);
      const user = one(
        await sql`
        select u.id, u.email, u.name, u.auth_user_id
        from sessions s join users u on u.id = s.user_id
        where s.digest = ${digest} and s.expires_at > now()
        limit 1
      `,
      );
      if (!user) {
        await sql`delete from sessions where digest = ${digest} and expires_at <= now()`;
      }
      return user;
    }
    case "auth.accessForSession": {
      const digest = text(args.digest);
      const access = one(
        await sql`
        select u.id, u.email, u.name, u.auth_user_id, m.role
        from sessions s
        join users u on u.id = s.user_id
        left join site_users m
          on m.user_id = u.id and m.site_id = ${text(args.siteId)}
        where s.digest = ${digest} and s.expires_at > now()
        limit 1
      `,
      );
      if (!access) {
        await sql`delete from sessions where digest = ${digest} and expires_at <= now()`;
      }
      return access;
    }
    case "auth.dropSession":
      await sql`delete from sessions where digest = ${text(args.digest)}`;
      return true;
    case "auth.membership":
      return one(
        await sql`
        select * from site_users where site_id = ${
          text(args.siteId)
        } and user_id = ${text(args.userId)} limit 1
      `,
      );
    case "auth.membershipsForUser":
      return await sql`
        select site_id, user_id, role from site_users where user_id = ${
        text(args.userId)
      }
      `;
    case "auth.grant":
      return one(
        await sql`
        insert into site_users (site_id, user_id, role)
        values (${text(args.siteId)}, ${text(args.userId)}, ${text(args.role)})
        on conflict (site_id, user_id) do update set role = excluded.role
        returning *
      `,
      );
    case "auth.members":
      return await sql`
        select m.site_id, m.user_id, m.role, u.email, u.name
        from site_users m join users u on u.id = m.user_id
        where m.site_id = ${text(args.siteId)} order by u.email
      `;
    case "auth.revoke":
      return (await sql`
        delete from site_users where site_id = ${
        text(args.siteId)
      } and user_id = ${text(args.userId)}
        returning user_id
      `).length > 0;
    case "auth.manualImport.create": {
      const input = (args.input && typeof args.input === "object" &&
          !Array.isArray(args.input))
        ? args.input as Record<string, unknown>
        : {};
      return one(
        await sql`
        insert into wordpress_import_credentials (
          id, owner_id, installation_id, access_token_digest, access_expires_at, refresh_token_digest
        ) values (${text(input.id)}, ${text(input.ownerId)}, ${
          text(input.installationId)
        },
          ${text(input.accessTokenDigest)}, ${text(input.accessExpiresAt)}, ${
          text(input.refreshTokenDigest)
        })
        on conflict (owner_id, installation_id) do update set
          access_token_digest = excluded.access_token_digest,
          access_expires_at = excluded.access_expires_at,
          refresh_token_digest = excluded.refresh_token_digest,
          status = 'active', revoked_at = null, updated_at = now()
        returning *
      `,
      );
    }
    case "auth.manualImport.byAccess":
      return one(
        await sql`
        select * from wordpress_import_credentials
        where access_token_digest = ${
          text(args.digest)
        } and status = 'active' and access_expires_at > now()
        limit 1
      `,
      );
    case "auth.manualImport.byRefresh":
      return one(
        await sql`
        select * from wordpress_import_credentials
        where refresh_token_digest = ${
          text(args.digest)
        } and status = 'active' limit 1
      `,
      );
    case "auth.manualImport.rotate":
      return one(
        await sql`
        update wordpress_import_credentials
        set access_token_digest = ${text(args.digest)}, access_expires_at = ${
          text(args.expiresAt)
        }, updated_at = now()
        where id = ${text(args.id)} and status = 'active' returning *
      `,
      );
    case "auth.manualImport.revoke":
      return (await sql`
        update wordpress_import_credentials
        set status = 'revoked', revoked_at = coalesce(revoked_at, now()), updated_at = now()
        where id = ${text(args.id)} and refresh_token_digest = ${
        text(args.refreshDigest)
      } returning id
      `).length > 0;
    default:
      throw Object.assign(new Error("unknown gateway operation"), {
        status: 400,
        code: "UNKNOWN_OPERATION",
      });
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return failure("method not allowed", 405, "METHOD_NOT_ALLOWED");
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) {
    return failure("request is too large", 413, "REQUEST_TOO_LARGE");
  }

  try {
    if (!(await authorised(request))) {
      return failure("unauthorized", 401, "UNAUTHORIZED");
    }
    const body = await request.json() as { op?: unknown; args?: unknown };
    if (
      typeof body.op !== "string" || !body.args ||
      typeof body.args !== "object" || Array.isArray(body.args)
    ) {
      return failure("invalid gateway request", 400, "INVALID_REQUEST");
    }
    return json(await dispatch(body.op, body.args as Record<string, unknown>));
  } catch (caught) {
    const error = caught as Error & {
      code?: string;
      status?: number;
      detail?: string;
    };
    console.error(error);
    return failure(
      [error.message, error.detail].filter(Boolean).join(" — ") ||
        "gateway failure",
      error.status || (error.code === "23505" ? 409 : 500),
      error.code,
    );
  }
});
