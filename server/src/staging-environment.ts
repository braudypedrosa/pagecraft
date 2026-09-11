/** Fail before opening a database connection when staging auth/data are miswired. */
const STAGING_HOST = 'staging.itspagecraft.com';
const SHARED_PROJECT = 'pwgwvicrdbjiecjxiyvl';
type Environment = Record<string, string | undefined>;

function endpoint(value: string | undefined, path: RegExp): URL {
  let url: URL;
  try { url = new URL(value || ''); } catch { throw new Error('Staging requires valid Supabase endpoints'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !path.test(url.pathname.replace(/\/$/, ''))) {
    throw new Error('Staging requires canonical HTTPS Supabase endpoints');
  }
  return url;
}

export function validateStagingEnvironment(env: Environment): 'other' | 'shared-transition' | 'isolated' {
  if (env.EDITOR_HOST !== STAGING_HOST) return 'other';
  const auth = endpoint(env.SUPABASE_URL, /^$/);
  const gateway = endpoint(env.DATABASE_GATEWAY_URL, /^\/functions\/v1\/pagecraft-db(?:-v[1-9][0-9]*)?$/);
  if (auth.hostname !== gateway.hostname) throw new Error('Staging authentication and data must use the same Supabase project');
  if (env.DATABASE_URL) throw new Error('Staging must use its explicit Supabase gateway, without a second database URL');
  if (env.EDITOR_ORIGIN !== `https://${STAGING_HOST}`) throw new Error('Staging editor origin must match its own host');
  if (env.PAGECRAFT_PUBLICATION_ROOT !== '/home/itspbuku/pagecraft-staging-publications') throw new Error('Staging must use its own publication directory');
  const shared = auth.hostname === `${SHARED_PROJECT}.supabase.co`;
  if (env.PAGECRAFT_ALLOW_SHARED_DATABASE === '1') {
    if (!shared || env.PAGECRAFT_STAGING_PROJECT_REF) throw new Error('Remove the shared-database exception before an isolated staging cutover');
    if (env.PAGECRAFT_BACKGROUND_WORKERS !== '0') throw new Error('Shared staging must not run background workers');
    return 'shared-transition';
  }
  const expected = env.PAGECRAFT_STAGING_PROJECT_REF;
  if (!expected || !/^[a-z0-9]{20}$/.test(expected) || expected === SHARED_PROJECT || shared) {
    throw new Error('Isolated staging requires its own explicitly pinned Supabase project');
  }
  if (auth.hostname !== `${expected}.supabase.co`) throw new Error('Staging endpoints do not match the pinned Supabase project');
  return 'isolated';
}
