/* The founder console is a separate process. It does not boot the editor, create
   profiles or schemas, drain queues, publish sites, or send customer messages. */
import { serve } from '@hono/node-server';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SupabaseAccountAuth } from './account-auth.ts';
import { createFounderReportsApp } from './founder-reports.ts';
import { FileOwnerCostStore } from './owner-billing.ts';
import { FileFounderCrmStore } from './founder-crm-store.ts';
import type { CrmPlatformSnapshot } from './founder-crm-types.ts';
import { reportsConfigKeys, reportsRuntimeConfig } from './reports-config.ts';
import { PagecraftGateway, GatewayStore } from './store-gateway.ts';

const env = { ...process.env };
const configPath = env.PAGECRAFT_REPORTS_CONFIG;
if (configPath) {
  const stat = lstatSync(configPath);
  if (!stat.isFile() || (stat.mode & 0o077) || stat.size > 32 * 1024) {
    throw new Error('Reports runtime configuration must be a small owner-only file');
  }
  const saved = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!saved || Array.isArray(saved) || typeof saved !== 'object' ||
    Object.entries(saved).some(([key, value]) => !reportsConfigKeys.includes(key as typeof reportsConfigKeys[number]) || typeof value !== 'string')) {
    throw new Error('Reports runtime configuration is invalid');
  }
  Object.assign(env, saved);
}
const config = reportsRuntimeConfig(env);
const accountAuth = new SupabaseAccountAuth({
  url: config.supabaseUrl, publishableKey: config.publishableKey,
  secureCookies: config.secure, cookieName: 'pc_reports_auth',
});
const store = config.gatewayUrl && config.gatewayKey
  ? new GatewayStore(new PagecraftGateway(config.gatewayUrl, config.gatewayKey, fetch, config.gatewayRegion))
  : undefined;
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const crmGateway = config.reportsDataGatewayUrl && config.gatewayKey
  ? new PagecraftGateway(config.reportsDataGatewayUrl, config.gatewayKey, fetch, config.gatewayRegion) : undefined;
const app = createFounderReportsApp({
  brandRoot: join(repo, 'brand'),
  host: config.host, origin: config.origin, appOrigin: config.appOrigin,
  dataEnvironment: config.dataEnvironment, challengeSiteKey: config.challengeSiteKey,
  accountAuth,
  crm: {
    contacts: new FileFounderCrmStore(config.contactsPath),
    platform: crmGateway ? { snapshot: () => crmGateway.call<CrmPlatformSnapshot>('founder.snapshot') } : undefined,
  },
  billing: {
    ownerAuthUserIds: config.ownerAuthUserIds,
    costs: new FileOwnerCostStore(config.costsPath),
    platform: store ? { siteCount: async () => (await store.listMeta()).length } : undefined,
    paddle: config.paddle,
  },
});
const deploymentPath = join(repo, 'deployment.json');
const deployment = existsSync(deploymentPath) ? JSON.parse(readFileSync(deploymentPath, 'utf8')) : null;
serve({
  port: Number(env.PORT || 8788), hostname: env.BIND_HOST || '0.0.0.0',
  fetch: (request, ...args) => {
    if (new URL(request.url).pathname === '/__deployment' &&
      request.headers.get('host')?.toLowerCase() === config.host.toLowerCase() && request.method === 'GET') {
      return Response.json(deployment || { commit: null, branch: null }, {
        headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' },
      });
    }
    return app.fetch(request, ...args);
  },
}, () => console.log('Private founder reports listening'));
