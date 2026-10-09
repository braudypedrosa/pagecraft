export interface SqlTag {
  <T = Record<string, unknown>[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

interface FounderReportingArgs {
  accountLimit?: unknown;
  siteLimit?: unknown;
}

interface AccountRow {
  id: unknown;
  auth_user_id: unknown;
  name: unknown;
  email: unknown;
  plan: unknown;
  created_at: unknown;
  owned_sites: unknown;
  published_sites: unknown;
  media_bytes: unknown;
  last_edited_at: unknown;
}

interface SiteRow {
  id: unknown;
  owner_ids: unknown;
  name: unknown;
  slug: unknown;
  published: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

const limit = (value: unknown, fallback: number, maximum: number) => {
  const parsed = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.trunc(parsed)));
};

const safeInteger = (value: unknown, field: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`invalid ${field}`);
  return parsed;
};

const iso = (value: unknown, nullable = false): string | null => {
  if (nullable && value == null) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error('invalid reporting timestamp');
  return parsed.toISOString();
};

const string = (value: unknown) => typeof value === 'string' ? value : String(value ?? '');

export async function founderSnapshot(sql: SqlTag, args: FounderReportingArgs = {}) {
  const accountLimit = limit(args.accountLimit, 1_000, 1_000);
  const siteLimit = limit(args.siteLimit, 5_000, 5_000);
  const [accountCountRows, siteCountRows, accountRows, siteRows] = await Promise.all([
    sql<{ count: unknown }[]>`select count(*)::bigint as count from users`,
    sql<{ count: unknown }[]>`select count(*)::bigint as count from sites`,
    sql<AccountRow[]>`
      select u.id, u.auth_user_id, u.name, u.email, u.plan, u.created_at,
        coalesce(site_stats.owned_sites, 0)::integer as owned_sites,
        coalesce(site_stats.published_sites, 0)::integer as published_sites,
        coalesce(asset_stats.asset_media_bytes, 0) + coalesce(library_stats.library_media_bytes, 0) as media_bytes,
        site_stats.last_edited_at
      from users u
      left join lateral (
        select count(*)::integer as owned_sites,
          count(*) filter (where s.published_release_id is not null or s.published_publication_id is not null)::integer as published_sites,
          max(s.updated_at) as last_edited_at
        from site_users su join sites s on s.id = su.site_id
        where su.user_id = u.id and su.role = 'owner'
      ) site_stats on true
      left join lateral (
        select coalesce(sum(a.stored_bytes), 0) as asset_media_bytes
        from assets a where a.owner_id = u.id
      ) asset_stats on true
      left join lateral (
        select coalesce(sum(la.stored_bytes), 0) as library_media_bytes
        from libraries l join library_assets la on la.library_id = l.id
        where l.owner_id = u.id
      ) library_stats on true
      order by u.created_at desc, u.id
      limit ${accountLimit}
    `,
    sql<SiteRow[]>`
      select s.id, s.name, s.slug,
        (s.published_release_id is not null or s.published_publication_id is not null) as published,
        (select min(sr.created_at) from site_revisions sr where sr.site_id = s.id) as created_at,
        s.updated_at,
        coalesce((
          select array_agg(su.user_id order by su.user_id)
          from site_users su where su.site_id = s.id and su.role = 'owner'
        ), array[]::text[]) as owner_ids
      from sites s
      order by s.updated_at desc, s.id
      limit ${siteLimit}
    `,
  ]);

  const accountTotal = safeInteger(accountCountRows[0]?.count, 'account total');
  const siteTotal = safeInteger(siteCountRows[0]?.count, 'site total');
  const accounts = accountRows.map(row => ({
    id: string(row.id),
    authUserId: row.auth_user_id == null ? null : string(row.auth_user_id),
    name: string(row.name),
    email: string(row.email),
    plan: string(row.plan),
    createdAt: iso(row.created_at)!,
    ownedSites: safeInteger(row.owned_sites, 'owned site count'),
    publishedSites: safeInteger(row.published_sites, 'published site count'),
    mediaBytes: safeInteger(row.media_bytes, 'media bytes'),
    lastEditedAt: iso(row.last_edited_at, true),
  }));
  const sites = siteRows.map(row => ({
    id: string(row.id),
    ownerIds: Array.isArray(row.owner_ids) ? row.owner_ids.map(string) : [],
    name: string(row.name),
    slug: string(row.slug),
    published: row.published === true,
    createdAt: iso(row.created_at, true),
    updatedAt: iso(row.updated_at)!,
  }));
  return {
    accounts,
    sites,
    accountTotal,
    siteTotal,
    coverage: accountTotal > accounts.length || siteTotal > sites.length ? 'partial' as const : 'complete' as const,
  };
}

const sha256 = async (value: string) => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const sameHex = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index++) different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return different === 0;
};

const reply = (body: unknown, status: number) => Response.json(body, {
  status,
  headers: { 'cache-control': 'private, no-store' },
});

const withTimeout = async <T>(pending: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('reporting timeout')), timeoutMs);
  });
  try { return await Promise.race([pending, timeout]); }
  finally { if (timer) clearTimeout(timer); }
};

export function createFounderReportsHandler(sql: SqlTag, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const keyTtlMs = 60_000;
  const keyRetryMs = 10_000;
  let key = { hash: '', loadedAt: -Infinity };
  let keyTriedAt = -Infinity;
  let keyLoad: Promise<void> | null = null;
  const configuredKeyHash = async (mismatch: boolean) => {
    const now = Date.now();
    if (!keyLoad && now - keyTriedAt >= keyRetryMs && (mismatch || now - key.loadedAt >= keyTtlMs)) {
      keyTriedAt = now;
      keyLoad = withTimeout(
        sql<{ secret_hash: unknown }[]>`select secret_hash from gateway_config where id = 'primary'`,
        timeoutMs,
      ).then(rows => { key = { hash: string(rows[0]?.secret_hash), loadedAt: Date.now() }; })
        .finally(() => { keyLoad = null; });
    }
    if (keyLoad) await keyLoad;
    return key.hash;
  };
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply({ error: 'method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
    const declared = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return reply({ error: 'request is too large', code: 'REQUEST_TOO_LARGE' }, 413);
    }
    try {
      const supplied = request.headers.get('x-pagecraft-gateway-key') || '';
      if (!supplied) return reply({ error: 'unauthorized', code: 'UNAUTHORIZED' }, 401);
      const suppliedHash = await sha256(supplied);
      if (!sameHex(suppliedHash, await configuredKeyHash(false)) &&
          !sameHex(suppliedHash, await configuredKeyHash(true))) {
        return reply({ error: 'unauthorized', code: 'UNAUTHORIZED' }, 401);
      }
      const raw = await withTimeout(request.text(), timeoutMs);
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
        return reply({ error: 'request is too large', code: 'REQUEST_TOO_LARGE' }, 413);
      }
      let body: unknown;
      try { body = JSON.parse(raw); }
      catch { return reply({ error: 'invalid request', code: 'INVALID_REQUEST' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply({ error: 'invalid request', code: 'INVALID_REQUEST' }, 400);
      }
      const input = body as { op?: unknown; args?: unknown };
      if (input.op !== 'founder.snapshot' || !input.args || typeof input.args !== 'object' || Array.isArray(input.args)) {
        return reply({ error: 'unknown operation', code: 'UNKNOWN_OPERATION' }, 400);
      }
      const data = await withTimeout(founderSnapshot(sql, input.args as FounderReportingArgs), timeoutMs);
      return reply({ data }, 200);
    } catch {
      return reply({ error: 'reporting gateway unavailable', code: 'GATEWAY_UNAVAILABLE' }, 503);
    }
  };
}
