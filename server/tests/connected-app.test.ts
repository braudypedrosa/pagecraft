import { createPrivateKey } from 'node:crypto';
import { test, vi } from 'vitest';
import a from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken } from '../src/auth.ts';
import { MemoryAssetStore } from '../src/assets.ts';
import {
  MemoryConnectedStore, type DeploymentStatus, type SiteRelease, type WordPressConnection
} from '../src/release-store.ts';
import { blankDoc } from '../src/render.ts';
import {
  base64url, buildKeysetEnvelope, decodeReleaseManifest, parseReleaseArtifact, sha256
} from '../src/releases.ts';
import { assetFile, N } from '../../app/src/core/index.ts';
import { validatePortablePackage } from '../src/portable-packages.ts';

const privateKey = (value: string) => createPrivateKey({
  key: Buffer.from(value, 'base64url'), format: 'der', type: 'pkcs8'
});
const releasePrivate = privateKey('MC4CAQAwBQYDK2VwBCIEIMNTuWc8LwcyLbbFextWs2zgG5yUj6Rjte9kaVImnQTd');
const rootPrivate = privateKey('MC4CAQAwBQYDK2VwBCIEIAfeCT4-i2gK-kDDZNAmzFNt1KRreItHOq14dLd-vV26');
const releaseSigning = { keyId: 'pagecraft-release-test-v1', privateKey: releasePrivate };
const keysetEnvelope = buildKeysetEnvelope({
  rootKeyId: 'pagecraft-root-v1', rootPrivateKey: rootPrivate,
  generatedAt: '2026-08-26T00:00:00.000Z', expiresAt: '2036-08-26T00:00:00.000Z',
  releaseKeys: [{
    key: releaseSigning, notBefore: '2026-08-26T00:00:00.000Z', notAfter: '2030-08-26T00:00:00.000Z'
  }]
}).envelope;

/* Most workflow tests exercise release ordering rather than the unsupported-font boundary.
   Keep those fixtures on local system fonts; the dedicated Google Fonts test below proves
   that a remote renderer-generated stylesheet fails before reservation. */
function localFontDoc(name: string) {
  const document = blankDoc(name);
  document.meta.font = "system-ui,-apple-system,'Segoe UI',sans-serif";
  document.meta.headFont = '';
  const scrub = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(scrub); return; }
    const object = value as Record<string, unknown>;
    delete object['font-family'];
    Object.values(object).forEach(scrub);
  };
  scrub(document.meta.tokens);
  scrub(document.header); scrub(document.footer); scrub(document.pages);
  return document;
}

async function rig(
  connected: MemoryConnectedStore = new MemoryConnectedStore(),
  store: MemoryStore = new MemoryStore(),
  assets: MemoryAssetStore = new MemoryAssetStore(),
  fontFetch?: typeof fetch
) {
  const auth = new MemoryAuthStore();
  const site = await store.create({ host: 'site.test', name: 'Site', doc: localFontDoc('Site') });
  const owner = await auth.createUser('owner@site.test', 'Owner');
  await auth.grant(site.id, owner.id, 'owner');
  const session = 'owner-session';
  await auth.putSession(hashToken(session), owner.id, Date.now() + 60_000);
  const options = {
    store, auth, assets, connected,
    editorHtml: '<html><head><title>Editor</title></head><body></body></html>',
    editorHost: 'admin.test', editorOrigin: 'http://admin.test', releaseSigning, keysetEnvelope,
    ...(fontFetch ? { fontFetch } : {})
  };
  const first = createApp(options), second = createApp(options);
  const request = (app: typeof first, path: string, init: RequestInit = {}) => app.request(new Request(
    `http://admin.test${path}`,
    { ...init, headers: { host: 'admin.test', ...(init.headers || {}) } }
  ));
  const admin = (app: typeof first, path: string, init: RequestInit = {}) => request(app, path, {
    ...init, headers: {
      cookie: `pc_session=${session}`, 'content-type': 'application/json', ...(init.headers || {})
    }
  });
  return { store, auth, assets, connected, site, owner, first, second, request, admin };
}

const connection = (siteId: string, ownerId: string, environment: 'staging' | 'production', token: string):
  Omit<WordPressConnection, 'createdAt' | 'updatedAt' | 'revokedAt' | 'revocationIdempotencyKey'> => ({
  id: environment, siteId, createdBy: ownerId, installationId: `installation-${environment}`,
  environment, profile: 'existing-theme', targetOrigin: `https://${environment}.wp.test`,
  targetPath: '/', redirectUri: `https://${environment}.wp.test/wp-admin/admin.php?page=pagecraft`,
  webhookUrl: `https://${environment}.wp.test/wp-json/pagecraft/v1/releases/available`,
  scopes: ['release:read', 'deploy:ack', 'cms:write', 'editor:open', 'content:index'], status: 'active',
  codeChallenge: 'x'.repeat(43), authorizationCodeDigest: hashToken(`code-${environment}`),
  authorizationCodeExpiresAt: '2030-01-01T00:00:00.000Z',
  authorizationCodeUsedAt: '2026-08-26T00:00:00.000Z', confirmationExpiresAt: null,
  confirmedAt: '2026-08-26T00:00:01.000Z', accessTokenDigest: hashToken(token),
  accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
  refreshTokenDigest: hashToken(`refresh-${environment}`), desiredReleaseId: null,
  pendingReleaseId: null, nextSequence: 1, lastAcknowledgedSequence: 0,
  activeReleaseId: null, activeHash: null
});

test('manual WordPress import is PKCE-authorized, owner-scoped, revocable and action-only', async () => {
  const { site, first, second, admin, request } = await rig();
  const verifier = 'm'.repeat(64);
  const challenge = base64url(Buffer.from(hashToken(verifier), 'hex'));
  const callback = 'http://pagecraft-wordpress-qa.local/wp-admin/admin-post.php?action=pagecraft_cloud_callback';
  const query = new URLSearchParams({
    installation_id: 'wordpress-manual-import-1', redirect_uri: callback,
    code_challenge: challenge, code_challenge_method: 'S256', state: 'manual-import-state-0001'
  });
  for (const redirectUri of [
    'https://wordpress.test/wp-admin/admin-post.php?action=pagecraft_cloud_callback&next=https://evil.test',
    'https://wordpress.test/wp-admin/admin.php?page=pagecraft',
    'http://wordpress.test/wp-admin/admin-post.php?action=pagecraft_cloud_callback',
  ]) {
    const rejected = new URLSearchParams(query);
    rejected.set('redirect_uri', redirectUri);
    a.equal((await admin(first, `/v1/wordpress-import/authorize?${rejected}`)).status, 400);
  }
  const anonymous = await request(first, `/v1/wordpress-import/authorize?${query}`);
  a.equal(anonymous.status, 302);
  a.match(anonymous.headers.get('location') || '', /^\/sign-in\?next=/);
  const consent = await admin(first, `/v1/wordpress-import/authorize?${query}`);
  a.equal(consent.status, 200);
  a.match(await consent.clone().text(), /read-only access to projects you own/);
  a.match(await consent.clone().text(), /Imports are manual and do not stay in sync/);
  a.match(await consent.clone().text(), /Pagecraft does not receive your WordPress password/);
  a.match(await consent.clone().text(), />Approve<\/button>/);
  a.match(await consent.clone().text(), /pagecraft-wordpress-qa\.local/);
  const csrf = (await consent.text()).match(/name="csrf" value="([^"]+)"/)?.[1];
  a.ok(csrf);
  const approved = await admin(second, '/v1/wordpress-import/authorize', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrf: csrf! })
  });
  a.equal(approved.status, 302);
  const code = new URL(approved.headers.get('location')!).searchParams.get('code')!;
  const tokenResponse = await request(first, '/v1/wordpress-import/token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: callback })
  });
  a.equal(tokenResponse.status, 200, await tokenResponse.clone().text());
  const tokens = await tokenResponse.json() as {
    access_token:string; refresh_token:string; credential_id:string;
  };
  const bearer = { authorization: `Bearer ${tokens.access_token}` };
  const projectsResponse = await request(second, '/v1/wordpress-import/projects', { headers: bearer });
  a.equal(projectsResponse.status, 200);
  const projects = await projectsResponse.json() as { projects:Array<{id:string;pageCount:number}> };
  a.deepEqual(projects.projects.map(item => item.id), [site.id]);
  a.ok(projects.projects[0].pageCount > 0);
  const catalogResponse = await request(second, '/v1/wordpress-import/catalog', { headers: bearer });
  a.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json() as {
    projects:Array<{id:string;sourceVersion:number;pages:Array<{id:string;sourceVersion:number}>}>
  };
  a.deepEqual(catalog.projects.map(item => item.id), [site.id]);
  a.equal(catalog.projects[0].sourceVersion, site.version);
  a.ok(catalog.projects[0].pages.length > 0);
  a.equal(catalog.projects[0].pages[0].sourceVersion, site.version);
  const projectPackageResponse = await request(second,
    `/v1/wordpress-import/projects/${site.id}/package`, { headers: bearer });
  a.equal(projectPackageResponse.status, 200, await projectPackageResponse.clone().text());
  const projectPackage = validatePortablePackage(new Uint8Array(await projectPackageResponse.arrayBuffer()));
  a.equal(projectPackage.manifest.kind, 'site');
  a.equal(projectPackage.provenance.sourceId, site.id);
  a.equal(projectPackage.provenance.sourceVersion, site.version);
  const pagesResponse = await request(first, `/v1/wordpress-import/projects/${site.id}/pages`, { headers: bearer });
  a.equal(pagesResponse.status, 200);
  const pages = await pagesResponse.json() as { pages:Array<{id:string;previewUrl:string}> };
  a.ok(pages.pages.length > 0);
  a.match(pages.pages[0].previewUrl, /^http:\/\//);
  const packageResponse = await request(first,
    `/v1/wordpress-import/projects/${site.id}/pages/${pages.pages[0].id}/package`, { headers: bearer });
  a.equal(packageResponse.status, 200, await packageResponse.clone().text());
  a.equal(validatePortablePackage(new Uint8Array(await packageResponse.arrayBuffer())).manifest.kind, 'page');

  const refreshed = await request(second, '/v1/wordpress-import/token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
  });
  a.equal(refreshed.status, 200);
  const revoked = await request(first, '/v1/wordpress-import/revoke', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential_id: tokens.credential_id, refresh_token: tokens.refresh_token })
  });
  a.equal(revoked.status, 200);
  const afterRevoke = await request(second, '/v1/wordpress-import/token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
  });
  a.equal(afterRevoke.status, 401);
});

test('OAuth consent and one-time editor SSO work across app workers and reject replay/demotion', async () => {
  const { connected, site, owner, first, second, admin, request, auth } = await rig();
  const verifier = 'v'.repeat(64);
  const challenge = base64url(Buffer.from(hashToken(verifier), 'hex'));
  const query = new URLSearchParams({
    siteId: site.id, installationId: 'wordpress-install-123', environment: 'staging',
    profile: 'existing-theme', targetOrigin: 'https://staging.wp.test', targetPath: '/',
    redirectUri: 'https://staging.wp.test/wp-admin/admin.php?page=pagecraft',
    webhookUrl: 'https://staging.wp.test/wp-json/pagecraft/v1/releases/available',
    codeChallenge: challenge, codeChallengeMethod: 'S256', state: 'state-state-state-1',
    scope: 'release:read deploy:ack cms:write editor:open content:index'
  });
  const consentPage = await admin(first, `/v1/oauth/authorize?${query}`);
  a.equal(consentPage.status, 200);
  const csrf = (await consentPage.text()).match(/name="csrf" value="([^"]+)"/)?.[1];
  a.ok(csrf);
  const approved = await admin(second, '/v1/oauth/authorize', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrf: csrf!, siteId: site.id })
  });
  a.equal(approved.status, 302);
  const code = new URL(approved.headers.get('location')!).searchParams.get('code')!;
  const replayConsent = await admin(first, '/v1/oauth/authorize', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrf: csrf!, siteId: site.id })
  });
  a.equal(replayConsent.status, 400);

  const token = await request(first, '/v1/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grantType: 'authorization_code', code, codeVerifier: verifier,
      redirectUri: 'https://staging.wp.test/wp-admin/admin.php?page=pagecraft'
    })
  });
  a.equal(token.status, 200);
  const tokens = await token.json() as {
    accessToken: string; refreshToken: string; connectionId: string; siteId: string;
  };
  const recoveredToken = await request(second, '/v1/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grantType: 'authorization_code', code, codeVerifier: verifier,
      redirectUri: 'https://staging.wp.test/wp-admin/admin.php?page=pagecraft'
    })
  });
  a.equal(recoveredToken.status, 200, await recoveredToken.clone().text());
  const recovered = await recoveredToken.json() as {
    accessToken: string; refreshToken: string; connectionId: string; siteId: string;
  };
  a.deepEqual(recovered, tokens,
    'the same authorization code and PKCE proof recover the exact credential body after response loss');
  const beforeConfirm = await request(first, `/v1/connections/${tokens.connectionId}/editor-sessions`, {
    method: 'POST', headers: {
      authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json'
    }, body: JSON.stringify({ installationId: 'wordpress-install-123' })
  });
  a.equal(beforeConfirm.status, 401, 'provisioned credentials cannot use active connection APIs');
  const confirm = () => request(second, `/v1/connections/${tokens.connectionId}/confirm`, {
    method: 'POST', headers: {
      authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json',
      'idempotency-key': `confirm-${tokens.connectionId}`
    }, body: JSON.stringify({ installationId: 'wordpress-install-123' })
  });
  const confirmed = await confirm();
  a.equal(confirmed.status, 200, await confirmed.clone().text());
  a.deepEqual(await confirmed.json(), {
    connectionId: tokens.connectionId, status: 'active',
    confirmedAt: (await connected.connection(tokens.connectionId))?.confirmedAt,
    alreadyConfirmed: false
  });
  const confirmedAgain = await confirm();
  a.equal(confirmedAgain.status, 200);
  a.equal((await confirmedAgain.json() as { alreadyConfirmed: boolean }).alreadyConfirmed, true,
    'a lost confirmation response is safe to replay');
  const mint = await request(first, `/v1/connections/${tokens.connectionId}/editor-sessions`, {
    method: 'POST', headers: {
      authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json'
    }, body: JSON.stringify({ installationId: 'wordpress-install-123' })
  });
  a.equal(mint.status, 201);
  const url = new URL((await mint.json() as { url: string }).url);
  const redeem = await request(second, url.pathname + url.search, {
    headers: { referer: 'https://staging.wp.test/wp-admin/admin.php?page=pagecraft' }
  });
  a.equal(redeem.status, 200);
  const html = await redeem.text();
  const raw = html.match(/window\.PC_SERVER=([^<]+)<\/script>/)?.[1]?.replace(/;\s*$/, '');
  a.ok(raw);
  const config = JSON.parse(raw!.replace(/\\u003c/g, '<')) as { editorSessionToken: string };
  a.equal((await request(first, url.pathname + url.search, {
    headers: { referer: 'https://staging.wp.test/wp-admin/' }
  })).status, 401, 'the browser code is single-use across workers');
  const scoped = await request(first, `/api/sites/${site.id}`, {
    headers: { 'x-pagecraft-editor-session': config.editorSessionToken }
  });
  a.equal(scoped.status, 200);
  await auth.grant(site.id, owner.id, 'content');
  a.equal((await request(second, `/api/sites/${site.id}`, {
    headers: { 'x-pagecraft-editor-session': config.editorSessionToken }
  })).status, 403, 'demotion immediately removes embedded admin authority');
  a.equal((await connected.connectionsForSite(site.id)).length, 1);
});

test('authorization-code exchange recovers after consumption commits before activation', async () => {
  class ProvisionFailsOnce extends MemoryConnectedStore {
    private failed = false;
    async provisionConnection(...args: Parameters<MemoryConnectedStore['provisionConnection']>) {
      if (!this.failed) {
        this.failed = true;
        return null;
      }
      return super.provisionConnection(...args);
    }
  }
  const connected = new ProvisionFailsOnce();
  const { site, owner, first, second, request } = await rig(connected);
  const code = 'recoverable-authorization-code';
  const verifier = 'r'.repeat(64);
  await connected.createConnection({
    ...connection(site.id, owner.id, 'staging', 'unused-access'),
    status: 'pending', authorizationCodeDigest: hashToken(code),
    codeChallenge: base64url(Buffer.from(hashToken(verifier), 'hex')),
    authorizationCodeExpiresAt: '2030-01-01T00:00:00.000Z', authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  });
  const exchange = (app: typeof first) => request(app, '/v1/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      grantType: 'authorization_code', code, codeVerifier: verifier,
      redirectUri: 'https://staging.wp.test/wp-admin/admin.php?page=pagecraft'
    })
  });
  const interrupted = await exchange(first);
  a.equal(interrupted.status, 400,
    'the injected failure occurs after the one-time-use marker but before credential activation');
  const recovered = await exchange(second);
  a.equal(recovered.status, 200, await recovered.clone().text());
  const repeated = await exchange(first);
  a.equal(repeated.status, 200, await repeated.clone().text());
  a.deepEqual(await repeated.json(), await recovered.json(),
    'every bounded recovery exchange returns the same deterministic credentials');
});

test('provisioned authorization response recovers byte-for-byte after code expiry then confirms', async () => {
  vi.useFakeTimers();
  try {
    const started = Date.parse('2026-08-26T02:00:00.000Z');
    vi.setSystemTime(started);
    const connected = new MemoryConnectedStore(() => Date.now());
    const { site, owner, first, second, request } = await rig(connected);
    const code = 'response-loss-near-code-expiry';
    const verifier = 'q'.repeat(64);
    const pending = {
      ...connection(site.id, owner.id, 'staging', 'unused-response-loss-token'),
      status: 'pending' as const, authorizationCodeDigest: hashToken(code),
      codeChallenge: base64url(Buffer.from(hashToken(verifier), 'hex')),
      authorizationCodeExpiresAt: new Date(started + 10 * 60 * 1000).toISOString(),
      authorizationCodeUsedAt: null, confirmationExpiresAt: null, confirmedAt: null,
      accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
    };
    await connected.createConnection(pending);
    const exchange = (app: typeof first) => request(app, '/v1/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        grantType: 'authorization_code', code, codeVerifier: verifier,
        redirectUri: pending.redirectUri
      })
    });
    vi.setSystemTime(started + (9 * 60 + 59) * 1000);
    const firstReply = await exchange(first);
    a.equal(firstReply.status, 200, await firstReply.clone().text());
    const firstBody = await firstReply.json() as { accessToken: string; connectionId: string };
    a.equal((await connected.connection(pending.id))?.status, 'provisioned');
    a.equal((await request(first, `/v1/connections/${pending.id}/desired-release`, {
      headers: { authorization: `Bearer ${firstBody.accessToken}` }
    })).status, 401);

    vi.setSystemTime(started + (10 * 60 + 1) * 1000);
    const recoveredReply = await exchange(second);
    a.equal(recoveredReply.status, 200, await recoveredReply.clone().text());
    const recoveredBody = await recoveredReply.json() as typeof firstBody;
    a.deepEqual(recoveredBody, firstBody,
      'the separate confirmation window preserves deterministic response-loss recovery');
    const confirmed = await request(second, `/v1/connections/${pending.id}/confirm`, {
      method: 'POST', headers: {
        authorization: `Bearer ${recoveredBody.accessToken}`, 'content-type': 'application/json',
        'idempotency-key': 'confirm-near-code-expiry'
      }, body: JSON.stringify({ installationId: pending.installationId })
    });
    a.equal(confirmed.status, 200, await confirmed.clone().text());
    a.equal((await connected.connection(pending.id))?.status, 'active');
  } finally {
    vi.useRealTimers();
  }
});

test('an unrecovered provisioned reservation expires and no longer blocks owner re-pairing', async () => {
  vi.useFakeTimers();
  try {
    const started = Date.parse('2026-08-26T03:00:00.000Z');
    vi.setSystemTime(started);
    const connected = new MemoryConnectedStore(() => Date.now());
    const { site, owner, first, request } = await rig(connected);
    const code = 'unrecovered-provisioned-code';
    const verifier = 'u'.repeat(64);
    const pending = {
      ...connection(site.id, owner.id, 'staging', 'unused-unrecovered-token'),
      status: 'pending' as const, authorizationCodeDigest: hashToken(code),
      codeChallenge: base64url(Buffer.from(hashToken(verifier), 'hex')),
      authorizationCodeExpiresAt: new Date(started + 10 * 60 * 1000).toISOString(),
      authorizationCodeUsedAt: null, confirmationExpiresAt: null, confirmedAt: null,
      accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
    };
    await connected.createConnection(pending);
    const exchange = () => request(first, '/v1/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        grantType: 'authorization_code', code, codeVerifier: verifier, redirectUri: pending.redirectUri
      })
    });
    vi.setSystemTime(started + 60_000);
    a.equal((await exchange()).status, 200);
    vi.setSystemTime(started + 32 * 60_000);
    a.equal((await exchange()).status, 400);
    await connected.createConnection({
      ...pending, id: 'replacement-after-confirmation-expiry',
      authorizationCodeDigest: hashToken('replacement-after-confirmation-expiry'),
      authorizationCodeExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      authorizationCodeUsedAt: null, confirmationExpiresAt: null,
      accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
    });
    a.equal((await connected.connection(pending.id))?.status, 'revoked');
    a.equal((await connected.connection('replacement-after-confirmation-expiry'))?.status, 'pending');
  } finally {
    vi.useRealTimers();
  }
});

test('out-of-order refresh responses have one bounded server-side access grace slot', async () => {
  const { connected, site, owner, first, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'initial-access'));
  const refresh = async () => {
    const response = await request(first, '/v1/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grantType: 'refresh_token', refreshToken: 'refresh-staging' })
    });
    a.equal(response.status, 200, await response.clone().text());
    return (await response.json() as { accessToken: string }).accessToken;
  };
  const responseA = await refresh();
  const responseB = await refresh();
  a.notEqual(responseA, responseB);
  const desired = (token: string) => request(first, '/v1/connections/staging/desired-release', {
    headers: { authorization: `Bearer ${token}` }
  });
  a.equal((await desired(responseA)).status, 204,
    'the first response remains valid when the second rotation commits before it is persisted');
  const responseC = await refresh();
  a.equal((await desired(responseA)).status, 401, 'a third rotation evicts the oldest response');
  a.equal((await desired(responseB)).status, 204);
  a.equal((await desired(responseC)).status, 204);
});

test('native WordPress content index is target-scoped, monotonic, replace-only, and injected read-only', async () => {
  const { connected, site, owner, first, request, admin } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'content-index-token'));
  const put = (body: Record<string, unknown>, token = 'content-index-token') => request(
    first, '/v1/connections/staging/content-index', {
      method: 'PUT', headers: {
        authorization: `Bearer ${token}`, 'content-type': 'application/json'
      }, body: JSON.stringify(body)
    }
  );
  const items = [{
    id: 'wp:post:9', objectType: 'post', title: 'Journal entry',
    url: 'https://staging.wp.test/journal/entry/', modifiedAt: '2026-08-26T02:00:00Z'
  }, {
    id: 'wp:page:2', objectType: 'page', title: 'About',
    url: 'https://staging.wp.test/about/', modifiedAt: '2026-08-26T01:00:00Z'
  }];
  const firstWrite = await put({ installationId: 'installation-staging', generation: 1, items });
  a.equal(firstWrite.status, 201, await firstWrite.clone().text());
  a.deepEqual(await firstWrite.json(), {
    generation: 1, itemCount: 2,
    syncedAt: (await connected.wordpressContentIndexesForSite(site.id))[0].syncedAt,
    duplicate: false
  });
  const replay = await put({
    installationId: 'installation-staging', generation: 1, items: [...items].reverse()
  });
  a.equal(replay.status, 200, await replay.clone().text());
  a.equal((await replay.json() as { duplicate: boolean }).duplicate, true,
    'canonical sorting makes an exact response-loss retry idempotent');
  a.equal((await put({
    installationId: 'installation-staging', generation: 1,
    items: [{ ...items[0], title: 'Changed under the same generation' }]
  })).status, 409, 'one generation cannot be reused for different content');
  a.equal((await put({
    installationId: 'wrong-installation', generation: 2, items: []
  })).status, 403);
  a.equal((await put({
    installationId: 'installation-staging', generation: 2,
    items: [{ ...items[0], url: 'https://another-site.test/stolen/' }]
  })).status, 400, 'a target cannot inject links from another origin');
  a.equal((await put({
    installationId: 'installation-staging', generation: 2,
    items: [{ ...items[0], url: 'https://staging.wp.test/journal/entry/?preview=1' }]
  })).status, 400, 'query-bearing native destinations cannot silently lose their query');

  const deleted = await put({
    installationId: 'installation-staging', generation: 2, items: [items[1]]
  });
  a.equal(deleted.status, 201, await deleted.clone().text());
  const index = await admin(first, `/v1/sites/${site.id}/wordpress-content`);
  a.equal(index.status, 200);
  const targets = (await index.json() as { targets: Array<{ items: typeof items }> }).targets;
  a.equal(targets.length, 1);
  a.deepEqual(targets[0].items.map(item => item.id), ['wp:page:2'],
    'a full snapshot replacement reconciles deleted native posts');

  const editor = await admin(first, `/edit/${site.id}`);
  const html = await editor.text();
  const raw = html.match(/window\.PC_SERVER=([^<]+)<\/script>/)?.[1]?.replace(/;\s*$/, '');
  a.ok(raw);
  const config = JSON.parse(raw!.replace(/\\u003c/g, '<')) as {
    wordpressContent: Array<{ environment: string; targetOrigin: string; items: typeof items }>;
  };
  a.equal(config.wordpressContent[0].environment, 'staging');
  a.equal(config.wordpressContent[0].targetOrigin, 'https://staging.wp.test');
  a.deepEqual(config.wordpressContent[0].items.map(item => item.id), ['wp:page:2']);
  a.equal((await admin(first, `/v1/sites/${site.id}/wordpress-content`, {
    method: 'POST', body: JSON.stringify({ title: 'Pagecraft must not edit native WordPress' })
  })).status, 404, 'the native catalogue exposes no Pagecraft-to-WordPress edit operation');
});

test('Publish rejects a legacy target URL after its native WordPress item leaves the current index', async () => {
  const { connected, store, site, owner, first, request, admin } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'removed-link-token'));
  const replaceIndex = (generation: number, items: Array<Record<string, unknown>>) => request(
    first, '/v1/connections/staging/content-index', {
      method: 'PUT', headers: {
        authorization: 'Bearer removed-link-token', 'content-type': 'application/json'
      }, body: JSON.stringify({
        installationId: 'installation-staging', generation, items
      })
    }
  );
  const removedUrl = 'https://staging.wp.test/about/';
  const indexed = await replaceIndex(1, [{
    id: 'wp:page:2', objectType: 'page', title: 'About', url: removedUrl,
    modifiedAt: '2026-08-26T01:00:00Z'
  }]);
  a.equal(indexed.status, 201, await indexed.clone().text());

  const draft = structuredClone(site.doc);
  const button = N('button', { text: 'About', link: removedUrl });
  draft.pages[0].tree = [button];
  a.equal((await store.save(site.id, draft, 1, owner.id)).ok, true);
  const removed = await replaceIndex(2, []);
  a.equal(removed.status, 201, await removed.clone().text());

  const publish = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'removed-native-link', acknowledgeWarnings: true
    })
  });
  const payload = await publish.json() as {
    error: string; errorCodes: string[]; urls: string[];
  };
  a.equal(publish.status, 422);
  a.equal(payload.error, 'Connected WordPress link preflight failed');
  a.deepEqual(payload.errorCodes, ['wordpress-link-target-specific']);
  a.deepEqual(payload.urls, [removedUrl]);
  a.equal((await connected.releasesForSite(site.id)).length, 0,
    'the failed link preflight consumes no release sequence');
  a.equal((await connected.connection('staging'))?.desiredReleaseId, null);
  a.equal((await store.byId(site.id))?.publishedReleaseId, null);
});

test('Publish rejects a legacy target URL after its original WordPress connection is replaced', async () => {
  const { connected, store, site, owner, first, request, admin } = await rig();
  await connected.createConnection({
    ...connection(site.id, owner.id, 'staging', 'old-link-token'),
    id: 'old-staging', installationId: 'installation-old-staging',
    targetOrigin: 'https://old-stage.wp.test',
    redirectUri: 'https://old-stage.wp.test/wp-admin/admin.php?page=pagecraft',
    webhookUrl: 'https://old-stage.wp.test/wp-json/pagecraft/v1/releases/available'
  });
  const oldUrl = 'https://old-stage.wp.test/about/';
  const indexed = await request(first, '/v1/connections/old-staging/content-index', {
    method: 'PUT', headers: {
      authorization: 'Bearer old-link-token', 'content-type': 'application/json'
    }, body: JSON.stringify({
      installationId: 'installation-old-staging', generation: 1,
      items: [{
        id: 'wp:page:2', objectType: 'page', title: 'About', url: oldUrl,
        modifiedAt: '2026-08-26T01:00:00Z'
      }]
    })
  });
  a.equal(indexed.status, 201, await indexed.clone().text());
  const draft = structuredClone(site.doc);
  draft.pages[0].tree = [N('button', { text: 'About', link: oldUrl })];
  a.equal((await store.save(site.id, draft, 1, owner.id)).ok, true);

  const revoked = await connected.revokeConnection({
    id: 'old-staging', accessTokenDigest: hashToken('old-link-token'),
    idempotencyKey: 'replace-old-staging', now: '2026-08-26T03:00:00.000Z'
  });
  a.equal(revoked.ok, true);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'new-staging-token'));
  await connected.createConnection(connection(site.id, owner.id, 'production', 'production-token'));

  const publish = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'replaced-native-link', acknowledgeWarnings: true
    })
  });
  const payload = await publish.json() as { errorCodes: string[]; urls: string[] };
  a.equal(publish.status, 422);
  a.deepEqual(payload.errorCodes, ['wordpress-link-target-specific']);
  a.deepEqual(payload.urls, [oldUrl]);
  a.equal((await connected.releasesForSite(site.id)).length, 0);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, null);
  a.equal((await connected.connection('production'))?.desiredReleaseId, null);
});

test('Publish migrates a legacy manual Breadcrumb WordPress URL without staging-host leakage', async () => {
  const { connected, store, site, owner, first, request, admin } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'breadcrumb-link-token'));
  const stagingUrl = 'https://staging.wp.test/about/';
  const indexed = await request(first, '/v1/connections/staging/content-index', {
    method: 'PUT', headers: {
      authorization: 'Bearer breadcrumb-link-token', 'content-type': 'application/json'
    }, body: JSON.stringify({
      installationId: 'installation-staging', generation: 1,
      items: [{
        id: 'wp:page:2', objectType: 'page', title: 'About', url: stagingUrl,
        modifiedAt: '2026-08-26T01:00:00Z'
      }]
    })
  });
  a.equal(indexed.status, 201, await indexed.clone().text());
  const draft = structuredClone(site.doc);
  const crumbs = N('crumbs', {
    mode: 'manual', items: [{ label: 'About', href: stagingUrl }, { label: 'Current', href: '' }]
  });
  draft.pages[0].tree = [crumbs];
  a.equal((await store.save(site.id, draft, 1, owner.id)).ok, true);

  const publish = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'breadcrumb-native-link', acknowledgeWarnings: true
    })
  });
  const text = await publish.text();
  a.equal(publish.status, 201, text);
  const releaseId = (JSON.parse(text) as { releaseId: string }).releaseId;
  const release = await connected.release(releaseId);
  a.ok(release);
  const artifact = parseReleaseArtifact(release!.artifact);
  const serialized = JSON.stringify(artifact);
  a.equal(serialized.includes('staging.wp.test'), false);
  const manifest = decodeReleaseManifest(release!.manifest);
  a.ok(manifest.placeholders.some(placeholder => placeholder.kind === 'wordpress-content'
    && placeholder.objectType === 'page' && placeholder.path === '/about/'));
});

test('native WordPress content ordering is UTF-8 deterministic and response-loss retries are idempotent', async () => {
  const { connected, site, owner, first, second, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'content-index-order-token'));
  const put = (app: typeof first, items: Array<Record<string, unknown>>) => request(
    app, '/v1/connections/staging/content-index', {
      method: 'PUT', headers: {
        authorization: 'Bearer content-index-order-token', 'content-type': 'application/json'
      }, body: JSON.stringify({
        installationId: 'installation-staging', generation: 1, items
      })
    }
  );
  const items = [{
    id: 'wp:page:zulu', objectType: 'page', title: 'Zulu',
    url: 'https://staging.wp.test/zulu/', modifiedAt: '2026-08-26T01:00:00Z'
  }, {
    id: 'wp:page:eclair', objectType: 'page', title: 'Éclair',
    url: 'https://staging.wp.test/eclair/', modifiedAt: '2026-08-26T01:00:00Z'
  }, {
    id: 'wp:page:angstrom', objectType: 'page', title: 'Ångström',
    url: 'https://staging.wp.test/angstrom/', modifiedAt: '2026-08-26T01:00:00Z'
  }, {
    id: 'wp:page:alpha', objectType: 'page', title: 'Alpha',
    url: 'https://staging.wp.test/alpha/', modifiedAt: '2026-08-26T01:00:00Z'
  }];

  const created = await put(first, items);
  a.equal(created.status, 201, await created.clone().text());
  const beforeRetry = (await connected.wordpressContentIndexesForSite(site.id))[0];
  a.deepEqual(beforeRetry.items.map(item => item.title), ['Alpha', 'Zulu', 'Ångström', 'Éclair'],
    'canonical ordering follows fixed UTF-8 bytes rather than host locale collation');

  /* A connector may lose the first response and retry another Pagecraft worker with its
     original item order. Canonicalization must recover the stored snapshot, not conflict. */
  const recovered = await put(second, [...items].reverse());
  a.equal(recovered.status, 200, await recovered.clone().text());
  a.deepEqual(await recovered.json(), {
    generation: 1, itemCount: 4, syncedAt: beforeRetry.syncedAt, duplicate: true
  });
  a.deepEqual((await connected.wordpressContentIndexesForSite(site.id))[0], beforeRetry,
    'an exact response-loss replay preserves the original immutable snapshot');
});

test('Disconnect immediately invalidates an already redeemed scoped editor session', async () => {
  const { connected, site, owner, first, second, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'editor-disconnect-token'));
  const minted = await request(first, '/v1/connections/staging/editor-sessions', {
    method: 'POST', headers: {
      authorization: 'Bearer editor-disconnect-token', 'content-type': 'application/json'
    }, body: JSON.stringify({ installationId: 'installation-staging' })
  });
  a.equal(minted.status, 201, await minted.clone().text());
  const url = new URL((await minted.json() as { url: string }).url);
  const redeemed = await request(second, url.pathname + url.search, {
    headers: { referer: 'https://staging.wp.test/wp-admin/' }
  });
  a.equal(redeemed.status, 200);
  const raw = (await redeemed.text()).match(/window\.PC_SERVER=([^<]+)<\/script>/)?.[1]
    ?.replace(/;\s*$/, '');
  a.ok(raw);
  const session = JSON.parse(raw!.replace(/\\u003c/g, '<')) as { editorSessionToken: string };
  const scoped = () => request(first, `/api/sites/${site.id}`, {
    headers: { 'x-pagecraft-editor-session': session.editorSessionToken }
  });
  a.equal((await scoped()).status, 200);
  const disconnected = await request(first, '/v1/connections/staging', {
    method: 'DELETE', headers: {
      authorization: 'Bearer editor-disconnect-token', 'idempotency-key': 'disconnect-editor-session'
    }
  });
  a.equal(disconnected.status, 200, await disconnected.text());
  a.equal((await scoped()).status, 401,
    'a redeemed browser credential is still bound to an active server-side connection');
});

test('unconfirmed production consent never claims canonical ownership of the hosted preview', async () => {
  const { connected, site, owner, first } = await rig();
  const pending = {
    ...connection(site.id, owner.id, 'production', 'unconfirmed-token'),
    status: 'pending' as const, authorizationCodeUsedAt: null,
    confirmationExpiresAt: null, confirmedAt: null,
    accessTokenDigest: null, accessTokenExpiresAt: null, refreshTokenDigest: null
  };
  await connected.createConnection(pending);
  await connected.useAuthorizationCode(pending.authorizationCodeDigest, '2026-08-26T00:00:00.000Z');
  await connected.provisionConnection(pending.id, {
    accessTokenDigest: hashToken('unconfirmed-token'),
    accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
    refreshTokenDigest: hashToken('unconfirmed-refresh'),
    confirmationExpiresAt: '2030-01-01T00:30:00.000Z'
  });
  const response = await first.request(new Request('http://site.test/', { headers: { host: 'site.test' } }));
  a.equal(response.status, 200);
  const html = await response.text();
  a.doesNotMatch(html, /<meta name="robots" content="noindex,follow">/);
  a.doesNotMatch(html, /<link rel="canonical" href="https:\/\/production\.wp\.test\//);
});

test('confirmed production pairing makes the Pagecraft-hosted copy noindex and canonical', async () => {
  const { connected, store, site, owner, first, request } = await rig();
  const draft = structuredClone(site.doc);
  draft.meta.headHtml = [
    '<link href=/old rel=canon&#x69;cal>',
    '<meta content=index,follow name=robots>',
    '<script>window.inertHostedSeo = "</head><link rel=canonical href=/script><meta name=robots>";</script>'
  ].join('\n');
  const saved = await store.save(site.id, draft, site.version, owner.id);
  a.equal(saved.ok, true);
  a.ok(saved.site);
  a.ok(await store.publish(site.id, saved.site!.version, '', 1));
  await connected.createConnection({
    ...connection(site.id, owner.id, 'production', 'production-token'),
    targetOrigin: 'https://www.customer.test', targetPath: '/managed-site/'
  });
  const response = await first.request(new Request('http://site.test/', { headers: { host: 'site.test' } }));
  a.equal(response.status, 200);
  const html = await response.text();
  a.match(html, /<meta name="robots" content="noindex,follow">/);
  a.match(html, /<link rel="canonical" href="https:\/\/www\.customer\.test\/managed-site\/">/);
  a.equal((html.match(/<meta name="robots" content="noindex,follow">/g) || []).length, 1);
  a.equal((html.match(/<link rel="canonical" href="https:\/\/www\.customer\.test\/managed-site\/">/g) || []).length, 1);
  a.match(html,
    /window\.inertHostedSeo = "<\/head><link rel=canonical href=\/script><meta name=robots>";/,
    'raw-text content remains byte-semantically inert');
  a.doesNotMatch(html, /href=\/old|content=index,follow/,
    'unquoted, reordered, entity-encoded ownership tags are removed');
  a.equal((await connected.connection('production'))?.activeReleaseId, null,
    'duplicate indexing is suppressed before the first WordPress activation');
  const disconnected = await request(first, '/v1/connections/production', {
    method: 'DELETE', headers: {
      authorization: 'Bearer production-token', 'idempotency-key': 'disconnect-canonical'
    }
  });
  a.equal(disconnected.status, 200, await disconnected.text());
  const frozen = await first.request(new Request('http://site.test/', { headers: { host: 'site.test' } }));
  a.equal(frozen.status, 200);
  const frozenHtml = await frozen.text();
  a.match(frozenHtml, /<meta name="robots" content="noindex,follow">/);
  a.match(frozenHtml, /<link rel="canonical" href="https:\/\/www\.customer\.test\/managed-site\/">/,
    'Disconnect freezes sync but cannot silently reclaim Pagecraft canonical ownership');
});

test('Disconnect is scoped, persistent, and idempotent without deleting the frozen active release', async () => {
  const { connected, site, owner, first, request } = await rig();
  await connected.createConnection({
    ...connection(site.id, owner.id, 'staging', 'disconnect-token'),
    desiredReleaseId: 'desired-release', pendingReleaseId: 'pending-release',
    activeReleaseId: 'frozen-release', activeHash: 'f'.repeat(64)
  });
  const endpoint = '/v1/connections/staging';
  a.equal((await request(first, endpoint, {
    method: 'DELETE', headers: { authorization: 'Bearer disconnect-token' }
  })).status, 400);
  a.equal((await request(first, endpoint, {
    method: 'DELETE', headers: {
      authorization: 'Bearer wrong-token', 'idempotency-key': 'disconnect-001'
    }
  })).status, 401);
  const revoked = await request(first, endpoint, {
    method: 'DELETE', headers: {
      authorization: 'Bearer disconnect-token', 'idempotency-key': 'disconnect-001'
    }
  });
  const revokedBody = await revoked.json() as {
    connectionId: string; status: string; revokedAt: string; alreadyRevoked: boolean;
  };
  a.equal(revoked.status, 200);
  a.deepEqual({
    connectionId: revokedBody.connectionId, status: revokedBody.status,
    alreadyRevoked: revokedBody.alreadyRevoked
  }, { connectionId: 'staging', status: 'revoked', alreadyRevoked: false });
  a.ok(revokedBody.revokedAt);
  const stored = await connected.connection('staging');
  a.equal(stored?.status, 'revoked');
  a.equal(stored?.desiredReleaseId, null);
  a.equal(stored?.pendingReleaseId, null);
  a.equal(stored?.activeReleaseId, 'frozen-release', 'disconnect preserves immutable installed content');
  a.equal(await connected.connectionByAccessToken(hashToken('disconnect-token'), new Date().toISOString()), null);
  a.equal(await connected.connectionByRefreshToken(hashToken('refresh-staging')), null);

  const retry = await request(first, endpoint, {
    method: 'DELETE', headers: {
      authorization: 'Bearer disconnect-token', 'idempotency-key': 'disconnect-001'
    }
  });
  a.equal(retry.status, 200);
  a.equal((await retry.json() as { alreadyRevoked: boolean }).alreadyRevoked, true);
  a.equal((await request(first, endpoint, {
    method: 'DELETE', headers: {
      authorization: 'Bearer disconnect-token', 'idempotency-key': 'disconnect-002'
    }
  })).status, 409);

  await connected.createConnection({
    ...connection(site.id, owner.id, 'staging', 'expired-token'), id: 'expired',
    installationId: 'installation-expired', targetOrigin: 'https://expired.wp.test',
    redirectUri: 'https://expired.wp.test/wp-admin/admin.php?page=pagecraft',
    webhookUrl: 'https://expired.wp.test/wp-json/pagecraft/v1/releases/available',
    authorizationCodeDigest: hashToken('code-expired'), refreshTokenDigest: hashToken('refresh-expired'),
    accessTokenExpiresAt: '2020-01-01T00:00:00.000Z'
  });
  a.equal((await request(first, '/v1/connections/expired', {
    method: 'DELETE', headers: {
      authorization: 'Bearer expired-token', 'idempotency-key': 'disconnect-expired'
    }
  })).status, 401, 'an expired credential cannot revoke or confirm a connection');

  await connected.createConnection(connection(site.id, owner.id, 'production', 'stale-access'));
  await connected.rotateAccessToken(
    'production', hashToken('rotated-access-never-persisted'), '2030-01-01T00:15:00.000Z'
  );
  const interruptedHeaders = {
    authorization: 'Bearer stale-access',
    'x-pagecraft-refresh-token': 'refresh-production',
    'idempotency-key': 'disconnect-after-rotation'
  };
  const fallback = await request(first, '/v1/connections/production', {
    method: 'DELETE', headers: interruptedHeaders
  });
  a.equal(fallback.status, 200, await fallback.clone().text());
  a.equal((await fallback.json() as { alreadyRevoked: boolean }).alreadyRevoked, false);
  const lostResponseRetry = await request(first, '/v1/connections/production', {
    method: 'DELETE', headers: interruptedHeaders
  });
  a.equal(lostResponseRetry.status, 200, await lostResponseRetry.clone().text());
  a.equal((await lostResponseRetry.json() as { alreadyRevoked: boolean }).alreadyRevoked, true);
});

test('rapid releases traverse staging then production in order and recover after failure', async () => {
  const { connected, site, owner, first, admin, request, store } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  await connected.createConnection(connection(site.id, owner.id, 'production', 'production-token'));
  const publish = async (key: string) => {
    const response = await admin(first, `/v1/sites/${site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 1, idempotencyKey: key, acknowledgeWarnings: true
      })
    });
    const text = await response.text();
    a.ok(response.status === 200 || response.status === 201, text);
    return JSON.parse(text) as { releaseId: string; sequence: number; artifactHash: string };
  };
  const one = await publish('publish-one');
  const two = await publish('publish-two');
  a.equal((await connected.connection('staging'))?.desiredReleaseId, one.releaseId);
  a.equal(await connected.target('staging', two.releaseId), null, 'the second release waits');
  a.equal((await connected.connection('production'))?.desiredReleaseId, null,
    'production receives no envelope before staging is live');

  const ack = async (environment: 'staging' | 'production', releaseId: string, sequence: number,
    status: DeploymentStatus, hash: string | null = null) => request(first,
    `/v1/connections/${environment}/deployments`, {
      method: 'POST', headers: {
        authorization: `Bearer ${environment}-token`, 'content-type': 'application/json'
      }, body: JSON.stringify({
        releaseId, targetSequence: sequence, status, activeHash: hash,
        idempotencyKey: `${releaseId}-${environment}-${status}`
      })
    });
  for (const status of ['downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await ack('staging', one.releaseId, 1, status)).status, 201);
  }
  a.equal((await ack('staging', one.releaseId, 1, 'live', one.artifactHash)).status, 201);
  a.equal((await connected.connection('production'))?.desiredReleaseId, one.releaseId);
  a.equal(await connected.target('staging', two.releaseId), null,
    'staging does not get ahead while production is installing');
  for (const status of ['downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await ack('production', one.releaseId, 1, status)).status, 201);
  }
  a.equal((await ack('production', one.releaseId, 1, 'live', one.artifactHash)).status, 201);
  const hostedPreview = await first.request(new Request('http://site.test/', {
    headers: { host: 'site.test' }
  }));
  a.equal(hostedPreview.status, 200);
  const hostedHtml = await hostedPreview.text();
  a.match(hostedHtml, /<meta name="robots" content="noindex,follow">/);
  a.match(hostedHtml, /<link rel="canonical" href="https:\/\/production\.wp\.test\/">/);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, two.releaseId);

  const three = await publish('publish-three');
  a.equal(await connected.target('staging', three.releaseId), null);
  a.equal((await ack('staging', two.releaseId, 2, 'downloading')).status, 201);
  a.equal((await ack('staging', two.releaseId, 2, 'failed')).status, 201);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, three.releaseId,
    'failure frees the queue for the next signed release');

  const before = await store.byId(site.id);
  const stagingBeforeReplay = await connected.connection('staging');
  const deploymentCountBeforeReplay = (await connected.deploymentsForRelease(one.releaseId)).length;
  await publish('publish-one');
  const after = await store.byId(site.id);
  a.equal(after?.publishedReleaseId, before?.publishedReleaseId,
    'retrying an older idempotent release cannot move the hosted pointer backward');
  const stagingAfterReplay = await connected.connection('staging');
  a.equal(stagingAfterReplay?.desiredReleaseId, three.releaseId);
  a.equal(stagingAfterReplay?.nextSequence, stagingBeforeReplay?.nextSequence,
    'historical Publish replay cannot re-arm an old target');
  a.equal((await connected.deploymentsForRelease(one.releaseId)).length, deploymentCountBeforeReplay);
});

test('an exact old staging-live replay cannot schedule a production rollback behind its active release', async () => {
  const { connected, site, owner, first, admin, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  const publish = async (key: string) => {
    const response = await admin(first, `/v1/sites/${site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 1, idempotencyKey: key, acknowledgeWarnings: true
      })
    });
    const text = await response.text();
    a.ok(response.status === 200 || response.status === 201, text);
    return JSON.parse(text) as { releaseId: string; sequence: number; artifactHash: string };
  };
  const ack = (environment: 'staging' | 'production', release: {
    releaseId: string; artifactHash: string;
  }, targetSequence: number, status: DeploymentStatus, idempotencyKey: string) => request(first,
    `/v1/connections/${environment}/deployments`, {
      method: 'POST', headers: {
        authorization: `Bearer ${environment}-token`, 'content-type': 'application/json'
      }, body: JSON.stringify({
        releaseId: release.releaseId, targetSequence, status,
        activeHash: status === 'live' ? release.artifactHash : null, idempotencyKey
      })
    });
  const install = async (environment: 'staging' | 'production', release: {
    releaseId: string; artifactHash: string;
  }, targetSequence: number, prefix: string) => {
    for (const status of ['downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
      const response = await ack(environment, release, targetSequence, status, `${prefix}-${status}`);
      a.equal(response.status, 201, await response.text());
    }
    const response = await ack(environment, release, targetSequence, 'live', `${prefix}-live`);
    a.equal(response.status, 201, await response.text());
  };

  const older = await publish('staging-replay-older');
  await install('staging', older, 1, 'staging-older');
  const newer = await publish('staging-replay-newer');
  await install('staging', newer, 2, 'staging-newer');
  await connected.createConnection(connection(site.id, owner.id, 'production', 'production-token'));
  await connected.createTarget({
    connectionId: 'production', releaseId: newer.releaseId, sequence: 1,
    envelope: 'production-newer-envelope', signature: 'production-newer-signature',
    keyId: 'pagecraft-release-test-v1', createdAt: new Date().toISOString()
  }, true);
  a.equal((await connected.recordDeployment({
    connectionId: 'production', releaseId: newer.releaseId, sequence: 1, status: 'queued',
    activeHash: null, error: null, detail: { stage: 'queued' },
    idempotencyKey: 'production-newer-queued', bodyHash: 'production-newer-queued-body'
  })).ok, true);
  await install('production', newer, 1, 'production-newer');
  const before = await connected.connection('production');
  a.equal(before?.activeReleaseId, newer.releaseId);
  a.equal(await connected.target('production', older.releaseId), null,
    'production joined after the historical release and has no old target');

  const replay = await ack('staging', older, 1, 'live', 'staging-older-live');
  const replayText = await replay.text();
  a.equal(replay.status, 200, replayText);
  a.equal((JSON.parse(replayText) as { duplicate: boolean }).duplicate, true);
  const after = await connected.connection('production');
  a.equal(after?.activeReleaseId, newer.releaseId);
  a.equal(after?.desiredReleaseId, null);
  a.equal(after?.pendingReleaseId, null);
  a.equal(after?.nextSequence, before?.nextSequence);
  a.equal(await connected.target('production', older.releaseId), null,
    'the replay creates no higher target sequence for older content');
});

test('late-paired production polling recovers failed promotion from the current staging release', async () => {
  class LateProductionIssueFailsOnce extends MemoryConnectedStore {
    armed = false;
    private failed = false;
    async createTarget(...args: Parameters<MemoryConnectedStore['createTarget']>) {
      const targetConnection = await this.connection(args[0].connectionId);
      if (this.armed && !this.failed && targetConnection?.environment === 'production') {
        this.failed = true;
        throw new Error('injected late production issuance failure');
      }
      return super.createTarget(...args);
    }
  }
  const connected = new LateProductionIssueFailsOnce();
  const { site, owner, first, admin, request } = await rig(connected);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  const publish = async (key: string) => {
    const response = await admin(first, `/v1/sites/${site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 1, idempotencyKey: key, acknowledgeWarnings: true
      })
    });
    const text = await response.text();
    a.ok(response.status === 200 || response.status === 201, text);
    return JSON.parse(text) as { releaseId: string; artifactHash: string };
  };
  const ack = async (release: { releaseId: string; artifactHash: string }, sequence: number,
    status: DeploymentStatus, key: string) => {
    const response = await request(first, '/v1/connections/staging/deployments', {
      method: 'POST', headers: {
        authorization: 'Bearer staging-token', 'content-type': 'application/json'
      }, body: JSON.stringify({
        releaseId: release.releaseId, targetSequence: sequence, status,
        activeHash: status === 'live' ? release.artifactHash : null,
        idempotencyKey: key
      })
    });
    return response;
  };
  const install = async (release: { releaseId: string; artifactHash: string },
    sequence: number, prefix: string) => {
    for (const status of ['downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
      const response = await ack(release, sequence, status, `${prefix}-${status}`);
      a.equal(response.status, 201, await response.text());
    }
    const live = await ack(release, sequence, 'live', `${prefix}-live`);
    a.equal(live.status, 201, await live.text());
  };

  const older = await publish('late-production-older');
  await install(older, 1, 'late-staging-older');
  const newer = await publish('late-production-newer');
  await install(newer, 2, 'late-staging-newer');
  a.equal((await connected.connection('staging'))?.activeReleaseId, newer.releaseId);

  await connected.createConnection(connection(site.id, owner.id, 'production', 'production-token'));
  connected.armed = true;
  const staleReplay = await ack(older, 1, 'live', 'late-staging-older-live');
  const replayText = await staleReplay.text();
  a.equal(staleReplay.status, 200, replayText);
  const replayBody = JSON.parse(replayText) as {
    duplicate: boolean; reconciliation: { status: string };
  };
  a.equal(replayBody.duplicate, true);
  a.equal(replayBody.reconciliation.status, 'pending');
  a.equal(await connected.target('production', older.releaseId), null,
    'a historical ACK never creates an old production target');
  a.equal(await connected.target('production', newer.releaseId), null,
    'the injected failure occurs before a target exists');
  a.equal((await connected.connection('production'))?.pendingReleaseId, null,
    'late pairing has no original staging-live promotion pointer');

  const pull = await request(first, '/v1/connections/production/desired-release', {
    headers: { authorization: 'Bearer production-token' }
  });
  a.equal(pull.status, 200, await pull.text());
  const etag = pull.headers.get('etag');
  a.ok(etag);
  a.equal((await connected.desiredTarget('production'))?.release.id, newer.releaseId,
    'polling derives and issues the current active staging release after response loss');
  a.equal(await connected.target('production', older.releaseId), null);
  const unchanged = await request(first, '/v1/connections/production/desired-release', {
    headers: { authorization: 'Bearer production-token', 'if-none-match': etag! }
  });
  a.equal(unchanged.status, 304,
    'reconciliation completes before conditional polling returns not-modified');
  a.deepEqual((await connected.deploymentsForRelease(newer.releaseId))
    .filter(item => item.connectionId === 'production').map(item => item.status), ['queued'],
  'a 304 retry cannot duplicate the durable queued transition');
});

test('production polling fails closed when late-paired setup profiles differ', async () => {
  const { connected, site, owner, first, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  await connected.createConnection({
    ...connection(site.id, owner.id, 'production', 'production-token'),
    profile: 'pagecraft-theme'
  });
  const response = await request(first, '/v1/connections/production/desired-release', {
    headers: { authorization: 'Bearer production-token' }
  });
  a.equal(response.status, 409);
  a.match((await response.json() as { error: string }).error, /incompatible WordPress setup profiles/);
});

test('fresh staging pairing bootstraps the canonical published release without replaying history', async () => {
  const { connected, site, owner, first, admin, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'old-staging-token'));

  const releases: Array<{ releaseId: string }> = [];
  for (const suffix of ['one', 'two', 'current']) {
    const response = await admin(first, `/v1/sites/${site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 1,
        idempotencyKey: `staging-bootstrap-${suffix}`,
        acknowledgeWarnings: true
      })
    });
    const text = await response.text();
    a.ok(response.status === 200 || response.status === 201, text);
    releases.push(JSON.parse(text) as { releaseId: string });
  }
  a.equal((await connected.desiredTarget('staging'))?.release.id, releases[0].releaseId,
    'the original staging connection remains on its ordered first target');

  const revoked = await connected.revokeConnection({
    id: 'staging', accessTokenDigest: hashToken('old-staging-token'),
    idempotencyKey: 'staging-bootstrap-disconnect', now: '2026-08-26T12:00:00.000Z'
  });
  a.equal(revoked.ok, true);
  await connected.createConnection({
    ...connection(site.id, owner.id, 'staging', 'replacement-staging-token'),
    id: 'replacement-staging', installationId: 'installation-replacement-staging',
    targetOrigin: 'https://replacement-staging.wp.test',
    redirectUri: 'https://replacement-staging.wp.test/wp-admin/admin.php?page=pagecraft',
    webhookUrl: 'https://replacement-staging.wp.test/wp-json/pagecraft/v1/releases/available'
  });

  const pull = await request(first, '/v1/connections/replacement-staging/desired-release', {
    headers: { authorization: 'Bearer replacement-staging-token' }
  });
  const body = await pull.text();
  a.equal(pull.status, 200, body);
  const desired = await connected.desiredTarget('replacement-staging');
  a.equal(desired?.release.id, releases[2].releaseId,
    'a connection with no target history starts from Pagecraft\'s current published release');
  a.equal(desired?.target.sequence, 1);
  a.equal(await connected.target('replacement-staging', releases[0].releaseId), null);
  a.equal(await connected.target('replacement-staging', releases[1].releaseId), null,
    'historical releases are retained but never issued as a fresh target baseline');
  a.deepEqual((await connected.deploymentsForRelease(releases[2].releaseId))
    .filter(item => item.connectionId === 'replacement-staging').map(item => item.status), ['queued']);

  const etag = pull.headers.get('etag');
  a.ok(etag);
  const unchanged = await request(first, '/v1/connections/replacement-staging/desired-release', {
    headers: { authorization: 'Bearer replacement-staging-token', 'if-none-match': etag! }
  });
  a.equal(unchanged.status, 304);
  a.deepEqual((await connected.deploymentsForRelease(releases[2].releaseId))
    .filter(item => item.connectionId === 'replacement-staging').map(item => item.status), ['queued'],
  'conditional reconciliation cannot duplicate the canonical bootstrap target');
});

test('both WordPress profiles block authored external stylesheets before publication', async () => {
  const attempt = async (profile: 'existing-theme' | 'pagecraft-theme') => {
    const context = await rig();
    await context.connected.createConnection({
      ...connection(context.site.id, context.owner.id, 'staging', `${profile}-stylesheet-token`),
      profile
    });
    const document = structuredClone(context.site.doc);
    document.meta.headHtml = '<link href="https://cdn.example/global.css" rel="stylesheet">';
    a.equal((await context.store.save(
      context.site.id, document, 1, context.owner.id
    )).ok, true);
    const response = await context.admin(context.first, `/v1/sites/${context.site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 2, idempotencyKey: `${profile}-stylesheet`, acknowledgeWarnings: true
      })
    });
    return { response, text: await response.text() };
  };

  const existing = await attempt('existing-theme');
  a.equal(existing.response.status, 422, existing.text);
  a.deepEqual((JSON.parse(existing.text) as { errorCodes: string[] }).errorCodes,
    ['unsafe-external-stylesheet']);
  const pagecraft = await attempt('pagecraft-theme');
  a.equal(pagecraft.response.status, 422, pagecraft.text);
  a.deepEqual((JSON.parse(pagecraft.text) as { errorCodes: string[] }).errorCodes,
    ['unsafe-external-stylesheet']);
});

test('Pagecraft Theme blocks literal and escaped CSS imports before reserving a release', async () => {
  for (const [name, css] of [
    ['literal', '@import url(https://cdn.example/global.css); body{margin:0}'],
    ['hex', '@\\69mport url(https://cdn.example/global.css); body{margin:0}'],
    ['long-hex', '@\\000069mport url(https://cdn.example/global.css); body{margin:0}'],
    ['comment', '@im/**/port url(https://cdn.example/global.css); body{margin:0}']
  ]) {
    const context = await rig();
    await context.connected.createConnection({
      ...connection(context.site.id, context.owner.id, 'staging', `pagecraft-import-${name}`),
      profile: 'pagecraft-theme'
    });
    const document = structuredClone(context.site.doc);
    document.meta.css = css;
    a.equal((await context.store.save(context.site.id, document, 1, context.owner.id)).ok, true);
    const response = await context.admin(context.first, `/v1/sites/${context.site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 2, idempotencyKey: `pagecraft-css-import-${name}`, acknowledgeWarnings: true
      })
    });
    const text = await response.text();
    a.equal(response.status, 422, `${name}: ${text}`);
    a.deepEqual((JSON.parse(text) as { errorCodes: string[] }).errorCodes, ['unsafe-global-at-rule']);
    a.equal((await context.connected.releasesForSite(context.site.id)).length, 0);
  }
});

test('entity-obfuscated stylesheet rel fails before reserving a release', async () => {
  const context = await rig();
  await context.connected.createConnection({
    ...connection(context.site.id, context.owner.id, 'staging', 'entity-stylesheet-token'),
    profile: 'pagecraft-theme'
  });
  const document = structuredClone(context.site.doc);
  document.meta.headHtml = '<link rel="style&#x73;heet" href="https://evil.example/x.css">';
  a.equal((await context.store.save(context.site.id, document, 1, context.owner.id)).ok, true);
  const response = await context.admin(context.first, `/v1/sites/${context.site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'entity-stylesheet-publish', acknowledgeWarnings: true
    })
  });
  const text = await response.text();
  a.equal(response.status, 422, text);
  a.deepEqual((JSON.parse(text) as { errorCodes: string[] }).errorCodes,
    ['unsafe-external-stylesheet']);
  a.equal((await context.connected.releasesForSite(context.site.id)).length, 0);
});

test('generated Google Fonts are frozen once into the signed shared artifact', async () => {
  const fontBytes = Buffer.from('wOF2deterministic-test-font');
  const fontCss = `/* latin */\n@font-face{font-family:'Inter';font-style:normal;font-weight:400;`
    + `font-display:swap;src:url('https://fonts.gstatic.com/s/inter/v1/inter.woff2') format('woff2');`
    + 'unicode-range:U+0000-00FF}';
  let cssRequests = 0, fontRequests = 0;
  const fontFetch = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'fonts.googleapis.com') {
      cssRequests++;
      return new Response(fontCss, { headers: { 'content-type': 'text/css' } });
    }
    if (url.href === 'https://fonts.gstatic.com/s/inter/v1/inter.woff2') {
      fontRequests++;
      return new Response(fontBytes, { headers: { 'content-type': 'font/woff2' } });
    }
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
  const context = await rig(new MemoryConnectedStore(), new MemoryStore(), new MemoryAssetStore(), fontFetch);
  await context.connected.createConnection({
    ...connection(context.site.id, context.owner.id, 'staging', 'google-font-token'),
    profile: 'pagecraft-theme'
  });
  const document = structuredClone(context.site.doc);
  document.meta.font = "'Inter',system-ui,sans-serif";
  a.equal((await context.store.save(
    context.site.id, document, 1, context.owner.id
  )).ok, true);
  const response = await context.admin(context.first, `/v1/sites/${context.site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'unfrozen-google-font', acknowledgeWarnings: true
    })
  });
  const text = await response.text();
  a.equal(response.status, 201, text);
  const payload = JSON.parse(text) as { releaseId: string };
  const release = await context.connected.release(payload.releaseId);
  a.ok(release);
  const artifact = parseReleaseArtifact(release.artifact);
  a.equal(cssRequests, 1);
  a.equal(fontRequests, 1);
  a.match(artifact.shared.css, /data:font\/woff2;pagecraft-sha256=[a-f0-9]{64};base64,/);
  a.equal(artifact.routes.some(route => route.css.includes('data:font/woff2')), false,
    'the font payload is not repeated in each route');
  a.equal(release.hostedFiles.some(file => /fonts\.(?:googleapis|gstatic)\.com/.test(file.content)), false);
});

test('a font freeze limit failure consumes no release reservation', async () => {
  const fontFetch = (async () => new Response('too large', {
    headers: { 'content-type': 'text/css', 'content-length': String(512 * 1024 + 1) }
  })) as typeof fetch;
  const context = await rig(new MemoryConnectedStore(), new MemoryStore(), new MemoryAssetStore(), fontFetch);
  await context.connected.createConnection({
    ...connection(context.site.id, context.owner.id, 'staging', 'oversize-font-token'),
    profile: 'pagecraft-theme'
  });
  const document = structuredClone(context.site.doc);
  document.meta.font = "'Inter',system-ui,sans-serif";
  a.equal((await context.store.save(context.site.id, document, 1, context.owner.id)).ok, true);
  const response = await context.admin(context.first, `/v1/sites/${context.site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'oversize-google-font', acknowledgeWarnings: true
    })
  });
  const text = await response.text();
  a.equal(response.status, 422, text);
  a.deepEqual((JSON.parse(text) as { errorCodes: string[] }).errorCodes, ['font-freeze-failed']);
  a.equal((await context.connected.releasesForSite(context.site.id)).length, 0);
});

test('a committed Publish survives a target queue failure and pull retries repair delivery', async () => {
  class QueueWriteFailsOnce extends MemoryConnectedStore {
    private injected = false;
    async recordDeployment(input: Parameters<MemoryConnectedStore['recordDeployment']>[0]) {
      if (!this.injected && input.status === 'queued') {
        this.injected = true;
        throw new Error('injected queue event write failure');
      }
      return super.recordDeployment(input);
    }
  }
  const connected = new QueueWriteFailsOnce();
  const { site, owner, first, admin, request, store } = await rig(connected);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  const publish = () => admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 1, idempotencyKey: 'repair-missing-queue', acknowledgeWarnings: true
    })
  });

  const interrupted = await publish();
  const interruptedText = await interrupted.text();
  a.equal(interrupted.status, 201, interruptedText);
  a.equal((JSON.parse(interruptedText) as { reconciliation: { status: string } })
    .reconciliation.status, 'pending');
  const [release] = await connected.releasesForSite(site.id);
  a.ok(release);
  a.ok(await connected.target('staging', release.id), 'the injected failure happens after target creation');
  a.equal((await connected.deploymentsForRelease(release.id)).length, 0);
  a.equal((await store.byId(site.id))?.publishedReleaseId, release.id,
    'a delivery failure cannot turn a committed hosted publication into a failed Publish');

  const desired = await request(first, '/v1/connections/staging/desired-release', {
    headers: { authorization: 'Bearer staging-token' }
  });
  a.equal(desired.status, 200, await desired.text());
  const history = await connected.deploymentsForRelease(release.id);
  a.deepEqual(history.map(item => item.status), ['queued'],
    'Sync Now repairs the missing immutable queue event without another Publish');
  const repaired = await publish();
  a.equal(repaired.status, 200, await repaired.text());
  a.equal((await store.byId(site.id))?.publishedReleaseId, release.id);
  const downloading = await request(first, '/v1/connections/staging/deployments', {
    method: 'POST', headers: {
      authorization: 'Bearer staging-token', 'content-type': 'application/json'
    }, body: JSON.stringify({
      releaseId: release.id, targetSequence: 1, status: 'downloading',
      idempotencyKey: 'repair-downloading'
    })
  });
  a.equal(downloading.status, 201, await downloading.text());
});

test('an acknowledgement resolved before Disconnect cannot commit after revocation wins the race', async () => {
  let armed = false, unblock!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  class DelayedBearerStore extends MemoryConnectedStore {
    async connectionByAccessToken(digest: string, now: string) {
      const resolved = await super.connectionByAccessToken(digest, now);
      if (armed && resolved?.id === 'staging') {
        armed = false;
        reached();
        await held;
      }
      return resolved;
    }
  }
  const connected = new DelayedBearerStore();
  const { site, owner, first, admin, request } = await rig(connected);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'ack-race-token'));
  const published = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 1, idempotencyKey: 'ack-race-release', acknowledgeWarnings: true
    })
  });
  const publishedText = await published.text();
  a.equal(published.status, 201, publishedText);
  const release = JSON.parse(publishedText) as { releaseId: string };

  armed = true;
  const acknowledgement = request(first, '/v1/connections/staging/deployments', {
    method: 'POST', headers: {
      authorization: 'Bearer ack-race-token', 'content-type': 'application/json'
    }, body: JSON.stringify({
      releaseId: release.releaseId, targetSequence: 1, status: 'downloading',
      idempotencyKey: 'ack-race-downloading'
    })
  });
  await waiting;
  const revoked = await request(first, '/v1/connections/staging', {
    method: 'DELETE', headers: {
      authorization: 'Bearer ack-race-token', 'idempotency-key': 'ack-race-disconnect'
    }
  });
  a.equal(revoked.status, 200, await revoked.text());
  unblock();
  const rejected = await acknowledgement;
  a.equal(rejected.status, 409);
  a.deepEqual(await rejected.json(), { error: 'connection-inactive' });
  a.deepEqual((await connected.deploymentsForRelease(release.releaseId)).map(item => item.status), ['queued']);
});

test('staging live remains committed while failed production issuance reconciles through polling and duplicate ACK', async () => {
  class ProductionIssueFailsOnce extends MemoryConnectedStore {
    private injected = false;
    async createTarget(...args: Parameters<MemoryConnectedStore['createTarget']>) {
      const targetConnection = await this.connection(args[0].connectionId);
      if (!this.injected && targetConnection?.environment === 'production') {
        this.injected = true;
        throw new Error('injected production target issuance failure');
      }
      return super.createTarget(...args);
    }
  }
  const connected = new ProductionIssueFailsOnce();
  const { site, owner, first, admin, request } = await rig(connected);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  await connected.createConnection(connection(site.id, owner.id, 'production', 'production-token'));
  const published = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 1, idempotencyKey: 'durable-promotion', acknowledgeWarnings: true
    })
  });
  const publishedText = await published.text();
  a.equal(published.status, 201, publishedText);
  const release = JSON.parse(publishedText) as {
    releaseId: string; artifactHash: string;
  };
  const ackBody = (status: DeploymentStatus, activeHash: string | null = null) => ({
    releaseId: release.releaseId, targetSequence: 1, status, activeHash,
    idempotencyKey: `durable-staging-${status}`
  });
  const ack = (status: DeploymentStatus, activeHash: string | null = null) => request(first,
    '/v1/connections/staging/deployments', {
      method: 'POST', headers: {
        authorization: 'Bearer staging-token', 'content-type': 'application/json'
      }, body: JSON.stringify(ackBody(status, activeHash))
    });
  for (const status of ['downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await ack(status)).status, 201);
  }
  const live = await ack('live', release.artifactHash);
  const liveText = await live.text();
  a.equal(live.status, 201, liveText);
  a.equal((JSON.parse(liveText) as { reconciliation: { status: string } }).reconciliation.status, 'pending');
  a.equal((await connected.connection('staging'))?.activeReleaseId, release.releaseId,
    'the verified staging release stays active after promotion issuance fails');
  a.equal((await connected.connection('production'))?.pendingReleaseId, release.releaseId,
    'the live ACK atomically leaves a durable production reconciliation job');
  a.equal(await connected.target('production', release.releaseId), null);

  const desired = await request(first, '/v1/connections/production/desired-release', {
    headers: { authorization: 'Bearer production-token' }
  });
  a.equal(desired.status, 200, await desired.text());
  a.equal((await connected.connection('production'))?.desiredReleaseId, release.releaseId);
  a.equal((await connected.deploymentsForRelease(release.releaseId))
    .filter(item => item.connectionId === 'production')[0]?.status, 'queued');

  const duplicate = await ack('live', release.artifactHash);
  a.equal(duplicate.status, 200, await duplicate.text());
  a.equal((await connected.connection('staging'))?.activeReleaseId, release.releaseId);
});

test('an unbuilt release serializes a concurrent publisher until its immutable parent exists', async () => {
  let unblock!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  class DelayedConnectedStore extends MemoryConnectedStore {
    async createRelease(release: SiteRelease) {
      if (release.sequence === 1) { reached(); await held; }
      return super.createRelease(release);
    }
  }
  const connected = new DelayedConnectedStore();
  const { site, owner, first: app, admin, request } = await rig(connected);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  const publish = async (key: string) => {
    const response = await admin(app, `/v1/sites/${site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 1, idempotencyKey: key, acknowledgeWarnings: true
      })
    });
    const text = await response.text();
    a.ok(response.status === 200 || response.status === 201, text);
    return JSON.parse(text) as { releaseId: string; sequence: number; artifactHash: string };
  };
  const firstPending = publish('ordered-one');
  await waiting;
  const blocked = await admin(app, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 1, idempotencyKey: 'ordered-two', acknowledgeWarnings: true
    })
  });
  a.equal(blocked.status, 409);
  a.equal((await blocked.json() as { retryable?: boolean }).retryable, true);
  a.equal((await connected.releasesForSite(site.id)).length, 0,
    'no child is allocated or signed while its parent reservation is unbuilt');
  unblock();
  const one = await firstPending;
  a.equal(one.sequence, 1);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, one.releaseId);
  const second = await publish('ordered-two');
  a.equal(second.sequence, 2);
  a.equal(await connected.target('staging', second.releaseId), null,
    'sequence two waits in the deployment queue while sequence one is active');
  const releases = (await connected.releasesForSite(site.id)).sort((a, b) => a.sequence - b.sequence);
  a.equal(releases[1].parentReleaseId, releases[0].id);

  const ack = async (status: DeploymentStatus, hash: string | null = null) => request(app,
    '/v1/connections/staging/deployments', {
      method: 'POST', headers: {
        authorization: 'Bearer staging-token', 'content-type': 'application/json'
      }, body: JSON.stringify({
        releaseId: one.releaseId, targetSequence: 1, status, activeHash: hash,
        idempotencyKey: `ordered-one-${status}`
      })
    });
  for (const status of ['downloading', 'staged', 'activating', 'verifying'] as DeploymentStatus[]) {
    a.equal((await ack(status)).status, 201);
  }
  a.equal((await ack('live', one.artifactHash)).status, 201);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, second.releaseId,
    'sequence two is issued only after sequence one is live');
});

test('the publication boundary serializes a newer publisher until the older pointer commits', async () => {
  let unblock!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  class DelayedPublishStore extends MemoryStore {
    async publish(id: string, version: number, releaseId: string, releaseSequence: number) {
      if (releaseSequence === 1) { reached(); await held; }
      return super.publish(id, version, releaseId, releaseSequence);
    }
  }
  const store = new DelayedPublishStore();
  const { connected, site, first, admin } = await rig(new MemoryConnectedStore(), store);
  const attempt = (key: string) => admin(first, `/v1/sites/${site.id}/releases`, {
      method: 'POST', body: JSON.stringify({
        sourceVersion: 1, idempotencyKey: key, acknowledgeWarnings: true
      })
    });
  const publish = async (key: string) => {
    const response = await attempt(key);
    const text = await response.text();
    a.ok(response.status === 200 || response.status === 201, text);
    return JSON.parse(text) as { releaseId: string; sequence: number };
  };

  const olderPending = publish('delayed-pointer-one');
  await waiting;
  const blocked = await attempt('delayed-pointer-two');
  a.equal(blocked.status, 409);
  a.equal((await blocked.json() as { retryable?: boolean }).retryable, true,
    'no child can be allocated while the prior hosted commit is unresolved');
  unblock();
  const older = await olderPending;
  a.equal(older.sequence, 1);
  const newer = await publish('delayed-pointer-two');
  a.equal(newer.sequence, 2);
  const finalSite = await store.byId(site.id);
  a.equal(finalSite?.publishedReleaseId, newer.releaseId);
  a.equal((await connected.releasesForSite(site.id))[0].id, newer.releaseId);
});

test('a failed hosted-pointer commit leaves no pullable release and a later publish tombstones the orphan', async () => {
  let now = Date.parse('2026-08-26T00:00:00.000Z');
  class PointerFailsOnce extends MemoryStore {
    private injected = false;
    async publish(id: string, version: number, releaseId: string, releaseSequence: number) {
      if (!this.injected) {
        this.injected = true;
        throw new Error('injected hosted pointer failure');
      }
      return super.publish(id, version, releaseId, releaseSequence);
    }
  }
  const connected = new MemoryConnectedStore(() => now);
  const store = new PointerFailsOnce();
  const { site, owner, first, admin, request } = await rig(connected, store);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  const attempt = (key: string) => admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 1, idempotencyKey: key, acknowledgeWarnings: true
    })
  });

  const failed = await attempt('pointer-failure-one');
  a.equal(failed.status, 503, await failed.text());
  a.equal((await store.byId(site.id))?.publishedReleaseId, null);
  a.equal((await connected.releasesForSite(site.id)).length, 0,
    'the immutable orphan is excluded from committed release traversal');
  a.equal((await connected.connection('staging'))?.desiredReleaseId, null);
  a.equal((await request(first, '/v1/connections/staging/desired-release', {
    headers: { authorization: 'Bearer staging-token' }
  })).status, 204, 'the orphan is never pullable');

  const blocked = await attempt('pointer-recovery-two');
  a.equal(blocked.status, 409);
  now += 5 * 60 * 1000 + 1;
  const recovered = await attempt('pointer-recovery-two');
  const recoveredText = await recovered.text();
  a.equal(recovered.status, 201, recoveredText);
  const release = JSON.parse(recoveredText) as { releaseId: string; sequence: number };
  a.equal(release.sequence, 2, 'the built orphan keeps its immutable sequence as a tombstone');
  a.equal((await store.byId(site.id))?.publishedReleaseId, release.releaseId);
  a.deepEqual((await connected.releasesForSite(site.id)).map(item => item.id), [release.releaseId]);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, release.releaseId);
});

test('a rejected compiler preflight leaves no release-sequence gap for the corrected publish', async () => {
  const { connected, store, site, owner, first, admin } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  const unsafe = structuredClone(site.doc);
  unsafe.pages[0].tree.push(N('embed', { html: '<a href=javascript:alert(1)>Unsafe</a>' }));
  a.equal((await store.save(site.id, unsafe, 1, owner.id)).ok, true);
  const rejected = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'unsafe-publish', acknowledgeWarnings: true
    })
  });
  a.equal(rejected.status, 422);
  a.match((await rejected.json() as { detail: string }).detail, /unsafe inline executable markup/);

  const corrected = structuredClone(unsafe);
  corrected.pages[0].tree = [];
  a.equal((await store.save(site.id, corrected, 2, owner.id)).ok, true);
  const response = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 3, idempotencyKey: 'corrected-publish', acknowledgeWarnings: true
    })
  });
  const text = await response.text();
  a.equal(response.status, 201, text);
  const release = JSON.parse(text) as { releaseId: string; sequence: number };
  a.equal(release.sequence, 1);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, release.releaseId,
    'the corrected release can enter staging without database repair');
});

test('an abandoned reservation cannot let an older concurrent publish overtake the corrected final release', async () => {
  let now = Date.parse('2026-08-26T00:00:00.000Z');
  const connected = new MemoryConnectedStore(() => now);
  const { store, site, owner, first, admin, request } = await rig(connected);
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-token'));
  const abandoned = await connected.reserveRelease({
    siteId: site.id, idempotencyKey: 'worker-a-crashed',
    releaseId: 'abandoned-release-identity', createdBy: owner.id
  });

  const older = structuredClone(site.doc);
  older.pages[0].tree.push(N('heading', { text: 'Older concurrent content B' }));
  a.equal((await store.save(site.id, older, 1, owner.id)).ok, true);
  const blocked = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'publisher-b-blocked', acknowledgeWarnings: true
    })
  });
  a.equal(blocked.status, 409);
  a.equal((await blocked.json() as { retryable?: boolean }).retryable, true);
  a.equal((await connected.releasesForSite(site.id)).length, 0,
    'publisher B cannot allocate a child of the crashed reservation');

  now += 5 * 60 * 1000 + 1;
  const corrected = structuredClone(older);
  corrected.pages[0].tree[0].props.text = 'Corrected final content C';
  a.equal((await store.save(site.id, corrected, 2, owner.id)).ok, true);
  const response = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 3, idempotencyKey: 'publisher-c-final', acknowledgeWarnings: true
    })
  });
  const responseText = await response.text();
  a.equal(response.status, 201, responseText);
  const finalRelease = JSON.parse(responseText) as {
    releaseId: string; sequence: number; artifactHash: string;
  };
  a.equal(finalRelease.releaseId, abandoned.releaseId, 'C safely reuses the only unbuilt identity');
  a.equal(finalRelease.sequence, 1);
  a.equal((await store.byId(site.id))?.publishedReleaseId, finalRelease.releaseId);
  a.equal((await connected.connection('staging'))?.desiredReleaseId, finalRelease.releaseId);

  const hosted = await first.request(new Request('http://site.test/', { headers: { host: 'site.test' } }));
  a.equal(hosted.status, 200);
  const html = await hosted.text();
  a.match(html, /Corrected final content C/);
  a.doesNotMatch(html, /Older concurrent content B/);

  for (const status of ['downloading', 'staged', 'activating', 'verifying', 'live'] as DeploymentStatus[]) {
    const ack = await request(first, '/v1/connections/staging/deployments', {
      method: 'POST', headers: {
        authorization: 'Bearer staging-token', 'content-type': 'application/json'
      }, body: JSON.stringify({
        releaseId: finalRelease.releaseId, targetSequence: 1, status,
        activeHash: status === 'live' ? finalRelease.artifactHash : null,
        idempotencyKey: `publisher-c-${status}`
      })
    });
    a.equal(ack.status, 201, await ack.text());
  }
  a.equal((await connected.connection('staging'))?.activeReleaseId, finalRelease.releaseId,
    'the WordPress target and Pagecraft public pointer converge on C');
});

test('public hosting is frozen to the release and rollback creates a newer release from older content', async () => {
  const { store, assets, connected, site, owner, first, second, admin } = await rig();
  const oldBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const oldAsset = await assets.put({
    id: 'aold', siteId: site.id, name: 'published.png', type: 'image/png', w: 1, h: 1, bytes: oldBytes
  });
  const activeSvg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
  );
  const svgAsset = await assets.put({
    id: 'asvg', siteId: site.id, name: 'published.svg', type: 'image/svg+xml',
    w: 10, h: 10, bytes: activeSvg
  });
  const publishedDoc = structuredClone(site.doc);
  publishedDoc.pages[0].tree.push(
    N('heading', { text: 'Published version two' }),
    N('image', { src: `asset:${oldAsset.id}`, alt: 'Published frozen image' }),
    N('image', { src: `asset:${svgAsset.id}`, alt: 'Published frozen SVG' })
  );
  const saved = await store.save(site.id, publishedDoc, 1, owner.id);
  a.equal(saved.ok, true);
  const releaseResponse = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 2, idempotencyKey: 'freeze-version-two', acknowledgeWarnings: true
    })
  });
  const releaseText = await releaseResponse.text();
  a.equal(releaseResponse.status, 201, releaseText);
  const released = JSON.parse(releaseText) as { releaseId: string };
  const frozen = await connected.release(released.releaseId);
  a.ok(frozen?.hostedFiles.some(file => file.path === 'index.html'));

  await assets.remove(site.id, oldAsset.id);
  const draftAsset = await assets.put({
    id: 'adraft', siteId: site.id, name: 'draft.png', type: 'image/png', w: 1, h: 1,
    bytes: new Uint8Array([137, 80, 78, 71, 0, 0, 0, 0])
  });
  const draftDoc = structuredClone(publishedDoc);
  draftDoc.pages[0].tree[0].props.text = 'Unpublished draft version three';
  draftDoc.pages[0].tree[1].props.src = `asset:${draftAsset.id}`;
  a.equal((await store.save(site.id, draftDoc, 2, owner.id)).ok, true);

  const publicRequest = (path: string) => second.request(new Request(`http://site.test${path}`, {
    headers: { host: 'site.test' }
  }));
  const home = await publicRequest('/');
  a.equal(home.status, 200);
  const html = await home.text();
  a.match(html, /Published version two/);
  a.doesNotMatch(html, /Unpublished draft version three/);
  const oldPath = assetFile(oldAsset);
  const oldResponse = await publicRequest('/' + oldPath);
  a.equal(oldResponse.status, 200, 'deleted draft storage cannot remove a published release asset');
  a.deepEqual(new Uint8Array(await oldResponse.arrayBuffer()), oldBytes);
  const sharedSvg = await second.request(new Request(
    `http://admin.test/${site.slug}/${assetFile(svgAsset)}`, { headers: { host: 'admin.test' } }
  ));
  a.equal(sharedSvg.status, 200);
  a.match(sharedSvg.headers.get('content-security-policy') || '', /^sandbox;/,
    'a frozen SVG is sandboxed even on the cookie-bearing editor origin');
  a.match(sharedSvg.headers.get('content-security-policy') || '', /default-src 'none'/);
  a.equal(sharedSvg.headers.get('x-content-type-options'), 'nosniff');
  a.equal((await publicRequest('/' + assetFile(draftAsset))).status, 404,
    'an upload made after Publish is not exposed by the active release');

  const rollbackResponse = await admin(first, `/v1/sites/${site.id}/releases`, {
    method: 'POST', body: JSON.stringify({
      sourceVersion: 1, idempotencyKey: 'rollback-to-version-one', acknowledgeWarnings: true
    })
  });
  const rollbackText = await rollbackResponse.text();
  a.equal(rollbackResponse.status, 201, rollbackText);
  const afterRollback = await store.byId(site.id);
  a.equal(afterRollback?.publishedVersion, 1);
  const rolledBackHome = await publicRequest('/');
  a.equal(rolledBackHome.status, 200);
  a.doesNotMatch(await rolledBackHome.text(), /Published version two/);
});

test('production CMS media upload is exact, scoped, idempotent, and usable only in the private draft', async () => {
  const { connected, store, assets, site, owner, first, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'production', 'cms-media-token'));
  await connected.createConnection(connection(site.id, owner.id, 'staging', 'staging-media-token'));
  const png = new Uint8Array(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  ));
  const upload = (token: string, key: string, bytes: Uint8Array, claimedHash = sha256(bytes)) => request(first,
    `/v1/sites/${site.id}/cms-assets`, {
      method: 'POST', headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'image/png',
        'content-length': String(bytes.byteLength),
        'idempotency-key': key,
        'x-pagecraft-filename': 'wordpress-photo.png',
        'x-pagecraft-content-sha256': claimedHash
      }, body: bytes as unknown as BodyInit
    });

  const created = await upload('cms-media-token', 'cms-media-upload-0001', png);
  const createdText = await created.text();
  a.equal(created.status, 201, createdText);
  const media = JSON.parse(createdText) as {
    assetId: string; reference: string; hash: string; bytes: number; mime: string; duplicate: boolean;
  };
  a.equal(media.reference, `asset:${media.assetId}`);
  a.equal(media.hash, sha256(png));
  const stored = await assets.get(site.id, media.assetId);
  a.ok(stored);
  a.equal(media.bytes, stored.bytes.byteLength);
  a.equal(media.mime, 'image/webp');
  a.equal(media.duplicate, false);
  a.equal(stored.type, 'image/webp');
  a.equal(stored.contentHash, sha256(png), 'source identity is metadata; source bytes are discarded');
  a.notDeepEqual(stored.bytes, png);

  const replay = await upload('cms-media-token', 'cms-media-upload-0001', png);
  a.equal(replay.status, 200, await replay.clone().text());
  a.equal((await replay.json() as { duplicate: boolean }).duplicate, true);
  const changed = png.slice();
  changed[changed.length - 1] ^= 1;
  a.equal((await upload('cms-media-token', 'cms-media-upload-0001', changed)).status, 409,
    'one idempotency key cannot be rebound to different media');
  a.equal((await upload('cms-media-token', 'cms-media-upload-0002', png, '0'.repeat(64))).status, 422,
    'WordPress must prove the exact bytes it intended to upload');
  a.equal((await upload('staging-media-token', 'cms-media-upload-0003', png)).status, 403,
    'staging cannot write CMS media');

  const withCollection = structuredClone(site.doc);
  withCollection.meta.collections = [{
    id: 'posts', name: 'Posts', slug: 'posts', detail: '',
    fields: [{ id: 'photo', name: 'Photo', type: 'image' }],
    items: [{ id: 'item-1', slug: 'one', values: { photo: '' } }]
  }];
  a.equal((await store.save(site.id, withCollection, 1, owner.id)).ok, true);
  const write = await request(first, `/v1/sites/${site.id}/cms`, {
    method: 'PATCH', headers: {
      authorization: 'Bearer cms-media-token', 'content-type': 'application/json',
      'idempotency-key': 'cms-media-write-0001'
    }, body: JSON.stringify({
      baseVersion: 2,
      writes: [{
        collectionId: 'posts', itemId: 'item-1', writeSequence: 1,
        values: { photo: media.reference }
      }]
    })
  });
  a.equal(write.status, 200, await write.clone().text());
  const drafted = await store.byId(site.id);
  a.equal(drafted?.doc.meta.collections?.[0].items[0].values.photo, media.reference);
  a.equal(drafted?.publishedVersion, 1, 'uploaded media is not linked from public content before Publish');
});

test('disconnect racing CMS media finalization leaves no durable asset', async () => {
  let unblock!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  class DelayedAssetStore extends MemoryAssetStore {
    async putConnected(...args: Parameters<MemoryAssetStore['putConnected']>) {
      reached();
      await held;
      return super.putConnected(...args);
    }
  }
  const assets = new DelayedAssetStore();
  const { connected, site, owner, first, request } = await rig(
    new MemoryConnectedStore(), new MemoryStore(), assets
  );
  await connected.createConnection(connection(site.id, owner.id, 'production', 'cms-media-race-token'));
  const png = new Uint8Array(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  ));
  const pending = request(first, `/v1/sites/${site.id}/cms-assets`, {
    method: 'POST', headers: {
      authorization: 'Bearer cms-media-race-token', 'content-type': 'image/png',
      'content-length': String(png.byteLength), 'idempotency-key': 'cms-media-race-0001',
      'x-pagecraft-filename': 'race.png', 'x-pagecraft-content-sha256': sha256(png)
    }, body: png as unknown as BodyInit
  });
  await waiting;
  const disconnected = await request(first, '/v1/connections/production', {
    method: 'DELETE', headers: {
      authorization: 'Bearer cms-media-race-token', 'idempotency-key': 'disconnect-media-race'
    }
  });
  a.equal(disconnected.status, 200, await disconnected.clone().text());
  unblock();
  const response = await pending;
  a.equal(response.status, 401, await response.clone().text());
  a.equal((await assets.list(site.id)).length, 0, 'revocation wins before durable asset finalization');
});

test('CMS write-back enforces the current typed schema, required fields, and site-owned media', async () => {
  const { connected, store, assets, site, owner, first, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'production', 'cms-types-token'));
  await assets.put({
    id: 'localimage', siteId: site.id, name: 'local.png', type: 'image/png', w: 1, h: 1,
    bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  });
  await assets.put({
    id: 'foreignimage', siteId: 'another-site', name: 'foreign.png', type: 'image/png', w: 1, h: 1,
    bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  });
  const typed = structuredClone(site.doc);
  typed.meta.collections = [
    {
      id: 'authors', name: 'Authors', slug: 'authors', detail: '',
      fields: [{ id: 'name', name: 'Name', type: 'text', required: 1 }],
      items: [{ id: 'author1', slug: 'one', values: { name: 'Ada' } }]
    },
    {
      id: 'posts', name: 'Posts', slug: 'posts', detail: '',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: 1 },
        { id: 'body', name: 'Body', type: 'rich' },
        { id: 'photo', name: 'Photo', type: 'image' },
        { id: 'url', name: 'URL', type: 'link' },
        { id: 'price', name: 'Price', type: 'number' },
        { id: 'start', name: 'Start', type: 'date' },
        { id: 'status', name: 'Status', type: 'option', opts: 'Draft, Published' },
        { id: 'featured', name: 'Featured', type: 'bool', required: 1 },
        { id: 'author', name: 'Author', type: 'ref', ref: 'authors' }
      ],
      items: [{
        id: 'post1', slug: 'one', values: {
          title: 'Initial', body: '<p>Safe</p>', photo: 'asset:localimage', url: '/initial',
          price: '10.5', start: '2026-08-26', status: 'Draft', featured: '1', author: 'author1'
        }
      }]
    }
  ];
  a.equal((await store.save(site.id, typed, 1, owner.id)).ok, true);
  const write = (key: string, values: Record<string, string>, writeSequence = 1) => request(first,
    `/v1/sites/${site.id}/cms`, {
      method: 'PATCH', headers: {
        authorization: 'Bearer cms-types-token', 'content-type': 'application/json',
        'idempotency-key': key
      }, body: JSON.stringify({
        baseVersion: 2,
        writes: [{ collectionId: 'posts', itemId: 'post1', writeSequence, values }]
      })
    });

  for (const [key, values] of [
    ['cms-type-required', { title: '' }],
    ['cms-type-rich', { body: '<p onclick="alert(1)">Unsafe</p>' }],
    ['cms-type-image', { photo: 'asset:foreignimage' }],
    ['cms-type-link', { url: 'javascript:alert(1)' }],
    ['cms-type-number', { price: '0x10' }],
    ['cms-type-date', { start: 'August 26' }],
    ['cms-type-option', { status: 'Archived' }],
    ['cms-type-bool', { featured: 'maybe' }],
    ['cms-type-ref', { author: 'missing-author' }],
    ['cms-type-control', { title: 'Bad\u0000title' }]
  ] as Array<[string, Record<string, string>]>) {
    const response = await write(key, values);
    a.equal(response.status, 422, `${key}: ${await response.clone().text()}`);
  }

  const accepted = await write('cms-type-valid', {
    title: 'Updated', body: '<p>Still safe</p>', photo: 'asset:localimage', url: 'https://example.com/post',
    price: '-12.75e2', start: '2026-08-27', status: 'Published', featured: 'yes', author: 'author1'
  });
  a.equal(accepted.status, 200, await accepted.clone().text());
  const saved = await store.byId(site.id);
  a.equal(saved?.doc.meta.collections?.[1].items[0].values.status, 'Published');
  a.equal(saved?.publishedVersion, 1, 'typed CMS values remain private until explicit Publish');
});

test('CMS write-back applies monotonic item sequences and treats exact replay as a duplicate', async () => {
  const { connected, store, site, owner, first, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'production', 'cms-token'));
  const withCollection = structuredClone(site.doc);
  withCollection.meta.collections = [{
    id: 'posts', name: 'Posts', slug: 'posts', detail: '',
    fields: [{ id: 'title', name: 'Title', type: 'text' }],
    items: [{ id: 'item-1', slug: 'one', values: { title: 'Initial title' } }]
  }];
  a.equal((await store.save(site.id, withCollection, 1, owner.id)).ok, true);

  const write = (key: string, writeSequence: number, title: string) => request(first,
    `/v1/sites/${site.id}/cms`, {
      method: 'PATCH', headers: {
        authorization: 'Bearer cms-token', 'content-type': 'application/json',
        'idempotency-key': key
      }, body: JSON.stringify({
        baseVersion: 2,
        writes: [{
          collectionId: 'posts', itemId: 'item-1', writeSequence, values: { title }
        }]
      })
    });

  const applied = await write('cms-write-0002', 2, 'Newest WordPress title');
  a.equal(applied.status, 200, await applied.clone().text());
  const appliedBody = await applied.json() as { status: string; version: number };
  a.deepEqual(appliedBody, { ...appliedBody, status: 'applied', version: 3 });

  const duplicate = await write('cms-write-0002', 2, 'Newest WordPress title');
  a.equal(duplicate.status, 200, await duplicate.clone().text());
  a.equal((await duplicate.json() as { status: string; version: number }).status, 'duplicate');
  a.equal((await store.byId(site.id))?.version, 3, 'an exact replay creates no revision');

  const stale = await write('cms-write-0001', 1, 'Late older title');
  a.equal(stale.status, 409);
  a.deepEqual(await stale.json(), {
    error: 'stale-write', retryable: false,
    stale: [{ collectionId: 'posts', itemId: 'item-1', writeSequence: 1, currentSequence: 2 }]
  });

  const conflict = await write('cms-write-0002-conflict', 2, 'Changed same sequence');
  a.equal(conflict.status, 409);
  a.deepEqual(await conflict.json(), {
    error: 'write-sequence-conflict', retryable: false,
    conflicts: [{ collectionId: 'posts', itemId: 'item-1', writeSequence: 2, currentSequence: 2 }]
  });
  const final = await store.byId(site.id);
  a.equal(final?.doc.meta.collections?.[0].items[0].values.title, 'Newest WordPress title');
  a.equal(final?.publishedVersion, 1, 'CMS writes update only the private draft pointer');
  const audit = await store.revision(site.id, 3);
  const writes = audit?.context?.cmsWrites as Array<Record<string, unknown>>;
  a.equal(writes[0].writeSequence, 2);
  a.equal(writes[0].idempotencyKey, 'cms-write-0002');
  a.ok(Array.isArray(writes[0].overwritten));
});

test('CMS sequence heads use an unambiguous collection and item identity', async () => {
  const { connected, store, site, owner, first, request } = await rig();
  await connected.createConnection(connection(site.id, owner.id, 'production', 'cms-key-token'));
  const withCollidingLegacyKeys = structuredClone(site.doc);
  withCollidingLegacyKeys.meta.collections = [
    {
      id: 'a:b', name: 'First', slug: 'first', detail: '',
      fields: [{ id: 'title', name: 'Title', type: 'text' }],
      items: [{ id: 'c', slug: 'one', values: { title: 'First initial' } }]
    },
    {
      id: 'a', name: 'Second', slug: 'second', detail: '',
      fields: [{ id: 'title', name: 'Title', type: 'text' }],
      items: [{ id: 'b:c', slug: 'two', values: { title: 'Second initial' } }]
    }
  ];
  a.equal((await store.save(site.id, withCollidingLegacyKeys, 1, owner.id)).ok, true);
  const write = (key: string, collectionId: string, itemId: string, title: string) => request(first,
    `/v1/sites/${site.id}/cms`, {
      method: 'PATCH', headers: {
        authorization: 'Bearer cms-key-token', 'content-type': 'application/json',
        'idempotency-key': key
      }, body: JSON.stringify({
        writes: [{ collectionId, itemId, writeSequence: 1, values: { title } }]
      })
    });
  const firstWrite = await write('cms-key-first', 'a:b', 'c', 'First updated');
  a.equal(firstWrite.status, 200, await firstWrite.clone().text());
  const secondWrite = await write('cms-key-second', 'a', 'b:c', 'Second updated');
  a.equal(secondWrite.status, 200, await secondWrite.clone().text());
  const final = await store.byId(site.id);
  a.equal(final?.doc.meta.collections?.[0].items[0].values.title, 'First updated');
  a.equal(final?.doc.meta.collections?.[1].items[0].values.title, 'Second updated');
});

test('a delayed older CMS write cannot overwrite a newer in-flight WordPress save', async () => {
  let unblock!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  class DelayedCmsStore extends MemoryStore {
    async saveConnectedCms(...args: Parameters<MemoryStore['saveConnectedCms']>) {
      const context = args[5];
      const writes = context?.cmsWrites as Array<{ writeSequence?: number }> | undefined;
      if (writes?.[0]?.writeSequence === 1) { reached(); await held; }
      return super.saveConnectedCms(...args);
    }
  }
  const store = new DelayedCmsStore();
  const { connected, site, owner, first, second, request } = await rig(new MemoryConnectedStore(), store);
  await connected.createConnection(connection(site.id, owner.id, 'production', 'cms-race-token'));
  const withCollection = structuredClone(site.doc);
  withCollection.meta.collections = [{
    id: 'posts', name: 'Posts', slug: 'posts', detail: '',
    fields: [{ id: 'title', name: 'Title', type: 'text' }],
    items: [{ id: 'item-1', slug: 'one', values: { title: 'Initial title' } }]
  }];
  a.equal((await store.save(site.id, withCollection, 1, owner.id)).ok, true);

  const write = (app: typeof first, key: string, writeSequence: number, title: string) => request(app,
    `/v1/sites/${site.id}/cms`, {
      method: 'PATCH', headers: {
        authorization: 'Bearer cms-race-token', 'content-type': 'application/json',
        'idempotency-key': key
      }, body: JSON.stringify({
        writes: [{
          collectionId: 'posts', itemId: 'item-1', writeSequence, values: { title }
        }]
      })
    });

  const olderPending = write(first, 'cms-race-0001', 1, 'Older request A');
  await waiting;
  const newer = await write(second, 'cms-race-0002', 2, 'Newer request B');
  a.equal(newer.status, 200, await newer.clone().text());
  a.equal((await newer.json() as { status: string }).status, 'applied');
  unblock();
  const older = await olderPending;
  a.equal(older.status, 409);
  a.equal((await older.json() as { error: string }).error, 'stale-write');
  const final = await store.byId(site.id);
  a.equal(final?.doc.meta.collections?.[0].items[0].values.title, 'Newer request B');
  a.equal(final?.version, 3, 'the losing request does not create a revision');
});

test('disconnect racing a CMS write creates no draft revision', async () => {
  let unblock!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const waiting = new Promise<void>(resolve => { reached = resolve; });
  class DelayedCmsStore extends MemoryStore {
    async saveConnectedCms(...args: Parameters<MemoryStore['saveConnectedCms']>) {
      reached();
      await held;
      return super.saveConnectedCms(...args);
    }
  }
  const store = new DelayedCmsStore();
  const { connected, site, owner, first, request } = await rig(new MemoryConnectedStore(), store);
  await connected.createConnection(connection(site.id, owner.id, 'production', 'cms-disconnect-race-token'));
  const document = structuredClone(site.doc);
  document.meta.collections = [{
    id: 'posts', name: 'Posts', slug: 'posts', detail: '',
    fields: [{ id: 'title', name: 'Title', type: 'text' }],
    items: [{ id: 'item-1', slug: 'one', values: { title: 'Initial title' } }]
  }];
  a.equal((await store.save(site.id, document, 1, owner.id)).ok, true);
  const pending = request(first, `/v1/sites/${site.id}/cms`, {
    method: 'PATCH', headers: {
      authorization: 'Bearer cms-disconnect-race-token', 'content-type': 'application/json',
      'idempotency-key': 'cms-disconnect-race-write'
    }, body: JSON.stringify({
      writes: [{ collectionId: 'posts', itemId: 'item-1', writeSequence: 1,
        values: { title: 'Must not persist' } }]
    })
  });
  await waiting;
  const disconnected = await request(first, '/v1/connections/production', {
    method: 'DELETE', headers: {
      authorization: 'Bearer cms-disconnect-race-token', 'idempotency-key': 'disconnect-cms-race'
    }
  });
  a.equal(disconnected.status, 200, await disconnected.clone().text());
  unblock();
  const response = await pending;
  a.equal(response.status, 401, await response.clone().text());
  const final = await store.byId(site.id);
  a.equal(final?.version, 2);
  a.equal(final?.doc.meta.collections?.[0].items[0].values.title, 'Initial title');
});
