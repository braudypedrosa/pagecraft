import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie } from 'hono/cookie';
import { UI_FONT_FACES } from '../../shared/ui-fonts.js';
import type { AccountAuth, VerifiedIdentity } from './account-auth.ts';
import { founderCrmPage, founderCrmSignInPage } from './founder-crm-page.ts';
import { founderCrmQuery, founderCrmRoutes } from './founder-crm-routes.ts';
import { loadFounderCrm } from './founder-crm-data.ts';
import type { CrmContactStore, CrmPlatformSource } from './founder-crm-types.ts';
import { normalEmail, validEmail, type User } from './auth.ts';
import { throttle } from './mail.ts';
import { ownerBillingAccess, type OwnerBillingOptions } from './owner-billing.ts';
import { ownerBillingRoutes } from './owner-billing-routes.ts';

export type FounderReportsDataEnvironment = 'staging' | 'production' | 'unconfigured';

export interface FounderReportsAppOptions {
  host: string;
  origin: string;
  accountAuth: AccountAuth;
  billing: OwnerBillingOptions;
  crm?: { platform?: CrmPlatformSource; contacts?: CrmContactStore };
  previewLabel?: string;
  appOrigin?: string;
  dataEnvironment: FounderReportsDataEnvironment;
  challengeSiteKey?: string;
  /** Absolute Pagecraft brand directory. Only the explicit assets below are served. */
  brandRoot?: string;
  /** Built, self-hosted CRM JavaScript/CSS; never a user-selected directory. */
  assetRoot?: string;
}

const signInError = (o: FounderReportsAppOptions, error?: string) => founderCrmSignInPage({
  error, dataEnvironment: o.dataEnvironment,
  challengeSiteKey: o.challengeSiteKey,
  previewLabel: o.previewLabel,
});

const userFromIdentity = (identity: VerifiedIdentity): User => ({
  id: identity.authUserId,
  authUserId: identity.authUserId,
  email: identity.email,
  name: identity.name,
  createdAt: identity.createdAt,
});

const callerAddress = (c: Context) => {
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress || 'unknown';
};

const requestOrigin = (c: Context) => {
  const supplied = c.req.header('origin');
  if (supplied) return supplied;
  try { return new URL(c.req.header('referer') || '').origin; } catch { return ''; }
};

const strictOrigin = (value: string, label: string) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash) throw new Error(`${label} must be an HTTP origin`);
  return url;
};

const contentType = (name: string) => name.endsWith('.svg')
  ? 'image/svg+xml; charset=utf-8'
  : 'font/ttf';

export function createFounderReportsApp(o: FounderReportsAppOptions) {
  const origin = strictOrigin(o.origin, 'Founder reports origin');
  const host = o.host.trim().toLowerCase();
  if (!host || /[\s/\\?#@]/.test(host) || origin.host.toLowerCase() !== host) {
    throw new Error('Founder reports host must match its origin');
  }
  if (o.appOrigin) strictOrigin(o.appOrigin, 'Pagecraft app origin');
  if (o.brandRoot && !isAbsolute(o.brandRoot)) {
    throw new Error('Founder reports brand root must be absolute');
  }
  if (o.assetRoot && !isAbsolute(o.assetRoot)) {
    throw new Error('Founder reports asset root must be absolute');
  }

  const app = new Hono();
  const identityCache = new WeakMap<Request, Promise<VerifiedIdentity | null>>();
  const identity = (c: Context) => {
    let pending = identityCache.get(c.req.raw);
    if (!pending) {
      pending = o.accountAuth.identity(c);
      identityCache.set(c.req.raw, pending);
    }
    return pending;
  };
  const loginSources = throttle(30, 15 * 60_000, 5000);
  const loginAccounts = throttle(8, 15 * 60_000, 5000);
  const clearReportSession = (c: Context) => {
    // Discard any session set by signIn before its immutable user id was authorized.
    c.res.headers.delete('set-cookie');
    const names = new Set(['pc_reports_auth', ...Object.keys(getCookie(c))
      .filter(name => /^pc_reports_auth(?:\.\d+)?$/.test(name))]);
    for (const name of names) deleteCookie(c, name, {
      path: '/', httpOnly: true, sameSite: 'Lax', secure: origin.protocol === 'https:',
    });
  };

  // Apply privacy headers even to rejects and unknown paths.
  app.use('*', async (c, next) => {
    await next();
    c.header('cache-control', 'private, no-store');
    c.header('pragma', 'no-cache');
    c.header('x-robots-tag', 'noindex, nofollow');
    c.header('x-content-type-options', 'nosniff');
    c.header('referrer-policy', 'no-referrer');
    c.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    c.header('content-security-policy', "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (origin.protocol === 'https:') c.header('strict-transport-security', 'max-age=31536000');
  });

  app.use('*', async (c, next) => {
    if (c.req.header('host')?.toLowerCase() !== host) return c.notFound();
    await next();
  });

  // Every write is a browser action. Authorization headers never bypass same-origin checks.
  app.use('*', async (c, next) => {
    const path = new URL(c.req.url).pathname;
    const browserWrite = path === '/auth/sign-in' || path === '/auth/logout' ||
      path === '/crm/contacts' || path === '/owner/billing/costs' || /^\/owner\/billing\/costs\/[^/]+\/remove$/.test(path);
    if (c.req.method === 'POST' && browserWrite && requestOrigin(c) !== origin.origin) {
      return c.json({ error: 'origin_not_allowed' }, 403);
    }
    await next();
  });

  const assetFiles = new Map<string, string>([
    ['/brand/pagecraft-logo.svg', 'logo/pagecraft-logo-primary-dark.svg'],
    ['/brand/pagecraft-favicon.svg', 'pagecraft-favicon.svg'],
    ...UI_FONT_FACES.map(({ file }) => [`/brand/fonts/${file}`, `fonts/${file}`] as [string, string]),
  ]);
  for (const [path, file] of assetFiles) {
    app.on(['GET', 'HEAD'], path, async c => {
      if (!o.brandRoot) return c.notFound();
      try {
        const bytes = await readFile(join(o.brandRoot, file));
        return new Response(c.req.method === 'HEAD' ? null : bytes, {
          headers: { 'content-type': contentType(file), 'content-length': String(bytes.byteLength) },
        });
      } catch {
        return c.notFound();
      }
    });
  }

  for (const [file, type] of [
    ['founder-crm.js', 'text/javascript; charset=utf-8'],
    ['founder-crm.css', 'text/css; charset=utf-8'],
  ]) {
    app.on(['GET', 'HEAD'], `/assets/${file}`, async c => {
      if (!o.assetRoot) return c.notFound();
      try {
        const bytes = await readFile(join(o.assetRoot, file));
        return new Response(c.req.method === 'HEAD' ? null : bytes, {
          headers: { 'content-type': type, 'content-length': String(bytes.byteLength) },
        });
      } catch { return c.notFound(); }
    });
  }

  app.get('/', c => c.redirect('/overview', 303));
  app.get('/owner/billing', c => c.redirect('/overview', 303));

  app.get('/sign-in', async c => {
    try {
      const current = await identity(c);
      const access = ownerBillingAccess(current, o.billing.ownerAuthUserIds);
      if (access === 'allowed') return c.redirect('/overview', 303);
      if (current) {
        try { await o.accountAuth.signOut(c); } catch { /* Clear browser state below. */ }
        clearReportSession(c);
        return c.html(signInError(o, 'auth'), 403);
      }
      return c.html(signInError(o));
    } catch {
      return c.html(signInError(o, 'auth'), 503);
    }
  });

  app.post('/auth/sign-in', bodyLimit({
    maxSize: 16 * 1024,
    onError: c => c.text('Request too large.', 413),
  }), async c => {
    if (!c.req.header('content-type')?.startsWith('application/x-www-form-urlencoded')) {
      return c.text('Submit sign-in details using the form.', 415);
    }
    const body = await c.req.parseBody();
    const email = normalEmail(typeof body.email === 'string' ? body.email : '');
    const password = typeof body.password === 'string' ? body.password : '';
    const captchaToken = typeof body['cf-turnstile-response'] === 'string'
      ? body['cf-turnstile-response'] : '';
    if (!validEmail(email) || !password || (o.challengeSiteKey && !captchaToken)) {
      return c.html(signInError(o, o.challengeSiteKey && !captchaToken ? 'challenge' : 'auth'), 422);
    }
    if (!loginSources.take(callerAddress(c)) || loginAccounts.limited(email)) {
      c.header('retry-after', '900');
      return c.html(signInError(o, 'auth'), 429);
    }
    let verified: VerifiedIdentity | 'challenge' | null;
    try {
      verified = await o.accountAuth.signIn(c, { email, password, captchaToken });
    } catch {
      clearReportSession(c);
      return c.html(signInError(o, 'auth'), 503);
    }
    if (verified === 'challenge') return c.html(signInError(o, 'challenge'), 422);
    if (!verified) {
      loginAccounts.take(email);
      return c.html(signInError(o, 'auth'), 401);
    }
    if (ownerBillingAccess(verified, o.billing.ownerAuthUserIds) !== 'allowed') {
      try { await o.accountAuth.signOut(c); } catch { /* Clear browser state below. */ }
      clearReportSession(c);
      return c.html(signInError(o, 'auth'), 403);
    }
    return c.redirect('/overview', 303);
  });

  app.post('/auth/logout', bodyLimit({
    maxSize: 1024,
    onError: c => c.text('Request too large.', 413),
  }), async c => {
    try { await o.accountAuth.signOut(c); } catch { /* Clear browser state below. */ }
    clearReportSession(c);
    return c.redirect('/sign-in', 303);
  });

  const who = async (c: Context) => {
    const current = await identity(c);
    return current && ownerBillingAccess(current, o.billing.ownerAuthUserIds) === 'allowed'
      ? userFromIdentity(current) : null;
  };
  founderCrmRoutes(app, {
    billing: o.billing, platform: o.crm?.platform, contacts: o.crm?.contacts,
    identity, origin: origin.origin, dataEnvironment: o.dataEnvironment,
    previewLabel: o.previewLabel,
  });

  ownerBillingRoutes(app, {
    billing: o.billing,
    editorOrigin: origin.origin,
    identity,
    who,
    requestSource: callerAddress,
    pagePath: '/costs',
    renderPage: async (user, billing, input, c) => {
      const current = c ? await identity(c) : null;
      const data = await loadFounderCrm(current, { billing: o.billing, platform: o.crm?.platform, contacts: o.crm?.contacts }, c ? founderCrmQuery(c) : { range: '30d', includeTests: true });
      if ('status' in data) throw new Error('CRM unavailable');
      // Reuse the already loaded budget result when rendering a validation failure.
      return founderCrmPage(user, { ...data, billing }, {
        section: 'costs', dataEnvironment: o.dataEnvironment, costInput: input,
        previewLabel: o.previewLabel,
        currencyCode: c?.req.query('currency'),
      });
    },
  });

  return app;
}
