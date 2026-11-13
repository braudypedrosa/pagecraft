import { test } from 'vitest';
import a from 'node:assert/strict';
import { reportsConfigKeys, reportsRuntimeConfig } from '../src/reports-config.ts';
const env = {
  NODE_ENV: 'production', REPORTS_HOST: 'reports.itspagecraft.com',
  REPORTS_ORIGIN: 'https://reports.itspagecraft.com', REPORTS_APP_ORIGIN: 'https://staging.itspagecraft.com',
  REPORTS_DATA_ENVIRONMENT: 'staging', PAGECRAFT_REPORTS_STORAGE_ROOT: '/private/reports',
  PAGECRAFT_OWNER_AUTH_USER_IDS: '123e4567-e89b-42d3-a456-426614174000',
  SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  DATABASE_GATEWAY_URL: 'https://auth.example.test/functions/v1/pagecraft-db', DATABASE_GATEWAY_KEY: 'private-test-key',
};
test('reports runtime is explicitly staged, separate and sandbox by default', () => {
  const config = reportsRuntimeConfig(env);
  a.equal(config.dataEnvironment, 'staging');
  a.equal(config.origin, 'https://reports.itspagecraft.com');
  a.equal(config.appOrigin, 'https://staging.itspagecraft.com');
  a.equal(config.secure, true);
  a.equal(config.costsPath, '/private/reports/costs.json');
  a.equal(config.contactsPath, '/private/reports/contacts.json');
  a.equal(config.reportsDataGatewayUrl, undefined);
  a.equal(reportsRuntimeConfig({...env, REPORTS_DATA_GATEWAY_URL:'https://auth.example.test/functions/v1/pagecraft-reports'}).reportsDataGatewayUrl, 'https://auth.example.test/functions/v1/pagecraft-reports');
  a.equal(config.paddle, undefined);
  a.equal(reportsRuntimeConfig({...env, PADDLE_API_KEY:'private-test-only'}).paddle?.environment, 'sandbox');
  a.ok(!reportsConfigKeys.includes('NODE_OPTIONS' as never));
  a.ok(!reportsConfigKeys.includes('PORT' as never));
});
test('reports runtime fails closed for mistaken domains, owners, data or insecure endpoints', () => {
  for (const patch of [
    {PAGECRAFT_OWNER_AUTH_USER_IDS:''}, {PAGECRAFT_OWNER_AUTH_USER_IDS:'Braudy Pedrosa'},
    {REPORTS_ORIGIN:'https://other.example.test'}, {REPORTS_APP_ORIGIN:'javascript:alert(1)'},
    {REPORTS_ORIGIN:'http://reports.itspagecraft.com'}, {SUPABASE_URL:'https://user:pass@auth.test'},
    {DATABASE_GATEWAY_KEY:''}, {DATABASE_GATEWAY_URL:'http://auth.example.test/read'},
    {REPORTS_DATA_ENVIRONMENT:'demo'}, {PAGECRAFT_REPORTS_STORAGE_ROOT:'public'},
    {PADDLE_ENVIRONMENT:'test'},
    {REPORTS_DATA_GATEWAY_URL:'https://elsewhere.test/read'},
    {REPORTS_DATA_GATEWAY_URL:'http://auth.example.test/read'},
    {REPORTS_DATA_GATEWAY_URL:'https://auth.example.test/read?key=secret'},
    {REPORTS_DATA_GATEWAY_URL:'https://person:password@auth.example.test/read'},
    {REPORTS_DATA_GATEWAY_URL:'https://auth.example.test/read', DATABASE_GATEWAY_KEY:''},
  ]) a.throws(() => reportsRuntimeConfig({...env,...patch}));
});
