import { isAbsolute, join, resolve } from 'node:path';
import { parseOwnerAuthUserIds } from './owner-billing.ts';

/** Only these values may come from the protected reports runtime file. */
export const reportsConfigKeys = [
  'REPORTS_HOST', 'REPORTS_ORIGIN', 'REPORTS_APP_ORIGIN', 'REPORTS_DATA_ENVIRONMENT',
  'PAGECRAFT_REPORTS_STORAGE_ROOT', 'PAGECRAFT_OWNER_AUTH_USER_IDS',
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'TURNSTILE_SITE_KEY',
  'DATABASE_GATEWAY_URL', 'DATABASE_GATEWAY_KEY', 'DATABASE_GATEWAY_REGION',
  'REPORTS_DATA_GATEWAY_URL',
  'PADDLE_API_KEY', 'PADDLE_ENVIRONMENT',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM',
  'PAGECRAFT_REPORTS_PRODUCTION_SUPPORT_ROOT', 'PAGECRAFT_REPORTS_STAGING_SUPPORT_ROOT',
  'PAGECRAFT_REPORTS_HEALTH_ROOT', 'PAGECRAFT_REPORTS_RELEASE_ROOT',
  'PAGECRAFT_DISK_WARN_FREE_BYTES', 'PAGECRAFT_DISK_WARN_USED_PERCENT',
] as const;

export function reportsRuntimeConfig(env: Record<string, string | undefined>) {
  const host = env.REPORTS_HOST?.trim() || 'localhost';
  const secure = env.NODE_ENV === 'production';
  const origin = env.REPORTS_ORIGIN || (secure ? `https://${host}` : `http://${host}`);
  const appOrigin = env.REPORTS_APP_ORIGIN;
  const parseOrigin = (value: string) => {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || (secure && url.protocol !== 'https:')) {
      throw new Error('Reports origins must be explicit trusted origins');
    }
    return url;
  };
  if (parseOrigin(origin).host !== host || /[\s/\\?#@]/.test(host)) {
    throw new Error('REPORTS_HOST must match REPORTS_ORIGIN');
  }
  if (appOrigin) parseOrigin(appOrigin);
  const dataEnvironment = env.REPORTS_DATA_ENVIRONMENT || 'unconfigured';
  if (!['staging', 'production', 'unconfigured'].includes(dataEnvironment)) {
    throw new Error('REPORTS_DATA_ENVIRONMENT is invalid');
  }
  const ownerAuthUserIds = parseOwnerAuthUserIds(env.PAGECRAFT_OWNER_AUTH_USER_IDS);
  if (!ownerAuthUserIds.length) throw new Error('Reports requires a verified owner account allowlist');
  const supabaseUrl = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error('Reports account authentication is not configured');
  parseOrigin(supabaseUrl);
  const gatewayUrl = env.DATABASE_GATEWAY_URL;
  const gatewayKey = env.DATABASE_GATEWAY_KEY;
  if (!!gatewayUrl !== !!gatewayKey) throw new Error('Reports gateway URL and key must be configured together');
  if (gatewayUrl) {
    const url = new URL(gatewayUrl);
    if ((secure && url.protocol !== 'https:') || !['https:', 'http:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash) throw new Error('Reports gateway URL is invalid');
  }
  if (dataEnvironment !== 'unconfigured' && !gatewayUrl) throw new Error('Reports data environment requires its read gateway');
  const reportsDataGatewayUrl = env.REPORTS_DATA_GATEWAY_URL;
  if (reportsDataGatewayUrl) {
    const url = new URL(reportsDataGatewayUrl);
    if (!gatewayKey || !gatewayUrl || url.origin !== new URL(gatewayUrl).origin || (secure && url.protocol !== 'https:') || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('CRM read gateway must be a trusted configured endpoint');
    }
  }
  const storageRoot = env.PAGECRAFT_REPORTS_STORAGE_ROOT;
  if (!storageRoot || !isAbsolute(storageRoot)) throw new Error('Reports requires an absolute private storage root');
  /* System health reads the reported app's publication root (error log + disk) and the
     deployment receiver's release storage on the same hosting account. Both are optional. */
  const healthRoot = env.PAGECRAFT_REPORTS_HEALTH_ROOT?.trim() || undefined;
  const releaseRoot = env.PAGECRAFT_REPORTS_RELEASE_ROOT?.trim() || undefined;
  for (const [name, value] of [['PAGECRAFT_REPORTS_HEALTH_ROOT', healthRoot], ['PAGECRAFT_REPORTS_RELEASE_ROOT', releaseRoot]]) {
    if (value && !isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  }
  const productionSupportRoot = env.PAGECRAFT_REPORTS_PRODUCTION_SUPPORT_ROOT?.trim();
  const stagingSupportRoot = env.PAGECRAFT_REPORTS_STAGING_SUPPORT_ROOT?.trim();
  for (const root of [productionSupportRoot, stagingSupportRoot]) {
    if (root && !isAbsolute(root)) throw new Error('Support inboxes require an absolute private storage root');
  }
  if (productionSupportRoot && stagingSupportRoot && resolve(productionSupportRoot) === resolve(stagingSupportRoot)) {
    throw new Error('Staging and production support inboxes require separate roots');
  }
  const paddleEnvironment = env.PADDLE_ENVIRONMENT || 'sandbox';
  if (!['sandbox', 'live'].includes(paddleEnvironment)) throw new Error('PADDLE_ENVIRONMENT must be sandbox or live');
  return {
    host, origin: parseOrigin(origin).origin,
    appOrigin: appOrigin ? parseOrigin(appOrigin).origin : undefined,
    dataEnvironment: dataEnvironment as 'staging' | 'production' | 'unconfigured',
    secure, ownerAuthUserIds, supabaseUrl, publishableKey,
    challengeSiteKey: env.TURNSTILE_SITE_KEY,
    gatewayUrl, gatewayKey, gatewayRegion: env.DATABASE_GATEWAY_REGION,
    reportsDataGatewayUrl,
    costsPath: join(storageRoot, 'costs.json'),
    contactsPath: join(storageRoot, 'contacts.json'),
    healthRoot, releaseRoot, productionSupportRoot, stagingSupportRoot,
    paddle: env.PADDLE_API_KEY?.trim() ? {
      apiKey: env.PADDLE_API_KEY,
      environment: paddleEnvironment as 'sandbox' | 'live',
    } : undefined,
  };
}
