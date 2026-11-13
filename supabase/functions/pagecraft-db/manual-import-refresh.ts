import type postgres from "npm:postgres@3.4.7";

type GatewaySql = ReturnType<typeof postgres>;

export interface ManualImportRefreshArgs {
  presentedDigest: string;
  nextAccessDigest: string;
  nextAccessExpiresAt: string;
  nextRefreshDigest: string;
}

export type ManualImportRefreshResult =
  | { status: "rotated"; credential: Record<string, unknown> }
  | { status: "reused" | "invalid" };

/**
 * Spend one manual-import refresh token inside one database transaction.
 *
 * Re-pair locks the credential before clearing its spent-token history. This operation keeps
 * that same credential-then-history lock order. A reuse lookup may see history before waiting
 * for a concurrent re-pair, so it re-reads that history after the credential lock is acquired.
 */
export async function exchangeManualImportRefresh(
  sql: GatewaySql,
  args: ManualImportRefreshArgs,
): Promise<ManualImportRefreshResult> {
  return await sql.begin(async (transaction) => {
    const current = await transaction`
      select * from wordpress_import_credentials
      where refresh_token_digest = ${args.presentedDigest}
        and status = 'active'
        and updated_at > now() - interval '90 days'
      for update
    `;
    const credential = current[0] as Record<string, unknown> | undefined;
    if (credential) {
      await transaction`
        delete from wordpress_import_used_refresh_tokens
        where credential_id = ${String(credential.id)} and expires_at <= now()
      `;
      await transaction`
        insert into wordpress_import_used_refresh_tokens (digest, credential_id, expires_at)
        values (${args.presentedDigest}, ${String(credential.id)}, now() + interval '90 days')
      `;
      const rotated = await transaction`
        update wordpress_import_credentials
        set access_token_digest = ${args.nextAccessDigest},
          access_expires_at = ${args.nextAccessExpiresAt},
          refresh_token_digest = ${args.nextRefreshDigest}, updated_at = now()
        where id = ${String(credential.id)} and status = 'active'
          and refresh_token_digest = ${args.presentedDigest}
        returning *
      `;
      if (!rotated[0]) {
        throw new Error("manual import refresh changed while locked");
      }
      return {
        status: "rotated" as const,
        credential: rotated[0] as Record<string, unknown>,
      };
    }

    const reused = await transaction`
      select credential.* from wordpress_import_used_refresh_tokens used
      join wordpress_import_credentials credential on credential.id = used.credential_id
      where used.digest = ${args.presentedDigest} and used.expires_at > now()
        and credential.status = 'active'
      for update of credential
    `;
    const reusedCredential = reused[0] as Record<string, unknown> | undefined;
    if (!reusedCredential) return { status: "invalid" as const };

    const stillUsed = await transaction`
      select digest from wordpress_import_used_refresh_tokens
      where digest = ${args.presentedDigest}
        and credential_id = ${String(reusedCredential.id)}
        and expires_at > now()
    `;
    if (!stillUsed[0]) return { status: "invalid" as const };

    const revoked = await transaction`
      update wordpress_import_credentials
      set status = 'revoked', revoked_at = coalesce(revoked_at, now()), updated_at = now()
      where id = ${String(reusedCredential.id)} and status = 'active'
      returning id
    `;
    return revoked[0]
      ? { status: "reused" as const }
      : { status: "invalid" as const };
  });
}
