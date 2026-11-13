import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AccountAuth, VerifiedIdentity } from './account-auth.ts';
import type { User } from './auth.ts';
import { ownerBillingPage } from './account-pages.ts';
import { throttle } from './mail.ts';
import {
  loadOwnerBilling, ownerBillingAccess, putOwnerCostBudget, removeOwnerCostBudget,
  type OwnerBillingOptions, type OwnerCostBudgetInput, type OwnerCostStore,
} from './owner-billing.ts';

export interface OwnerBillingPageInput {
  error?: string;
  message?: string;
  editCostId?: string;
  costsEnabled?: boolean;
  draftCost?: { id: string; label: string; category: string; amount: string; currencyCode: string };
}

export type OwnerBillingPageRenderer = (
  user: User,
  data: Extract<Awaited<ReturnType<typeof loadOwnerBilling>>, { status: 'ok' }>,
  input: OwnerBillingPageInput,
  context?: Context,
) => string | Promise<string>;

export interface OwnerBillingRouteOptions {
  billing?: OwnerBillingOptions;
  identity(c: Context): ReturnType<AccountAuth['identity']>;
  who(c: Context): Promise<User | null>;
  editorOrigin?: string;
  requestSource(c: Context): string;
  renderPage?: OwnerBillingPageRenderer;
  /** Trusted application route for budget responses and successful writes. */
  pagePath?: string;
}

/** Budget inputs are major currency units; storage and provider arithmetic use integers. */
export function ownerBudgetMinorUnits(amount: string, currencyCode: string): string | null {
  if (!Intl.supportedValuesOf('currency').includes(currencyCode)) return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match || match[1].length > 12) return null;
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode })
    .resolvedOptions().maximumFractionDigits ?? 2;
  const fraction = match[2] || '';
  if (fraction.length > digits) return null;
  const minor = BigInt(match[1]) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, '0') || '0');
  return minor <= 999_999_999_999n ? minor.toString() : null;
}

export function ownerBillingRoutes(app: Hono, o: OwnerBillingRouteOptions) {
  const billing: OwnerBillingOptions = o.billing || { ownerAuthUserIds: [] };
  const reads = throttle(30, 60_000, 100);
  const changes = throttle(30, 60_000, 100);

  for (const path of ['/owner/*', '/api/owner/*']) {
    app.use(path, async (c, next) => {
      c.header('cache-control', 'private, no-store');
      c.header('x-robots-tag', 'noindex, nofollow');
      await next();
    });
  }

  const gate = async (c: Context, api = false): Promise<{ response: Response } | { identity: VerifiedIdentity }> => {
    let identity: VerifiedIdentity | null;
    try {
      identity = await o.identity(c);
    } catch {
      return { response: api
        ? c.json({ error: 'authentication_unavailable' }, 503)
        : c.text('Sign-in verification is unavailable. Try again.', 503) };
    }
    const access = ownerBillingAccess(identity, billing.ownerAuthUserIds);
    if (access === 'allowed') return { identity: identity! };
    if (access === 'unauthenticated') return {
      response: api
        ? c.json({ error: 'authentication_required' }, 401)
        : c.redirect('/sign-in?next=%2Fowner%2Fbilling', 303),
    };
    return { response: api
      ? c.json({ error: 'owner_access_required' }, 403)
      : c.text('This area is restricted to the Pagecraft owner.', 403) };
  };

  const render = async (
    c: Context, identity: VerifiedIdentity, input: OwnerBillingPageInput = {},
    status: 200 | 422 | 503 = 200,
  ) => {
    try {
      const [user, data] = await Promise.all([o.who(c), loadOwnerBilling(identity, billing)]);
      if (!user || data.status !== 'ok') return c.text('Billing data is unavailable. Try again.', 503);
      const pageInput = {
        ...input,
        editCostId: c.req.query('edit'),
        costsEnabled: !!billing.costs,
      };
      const page = o.renderPage ? await o.renderPage(user, data, pageInput, c) : ownerBillingPage(user, data, pageInput);
      return c.html(page, status);
    } catch {
      return c.text('Billing data is unavailable. Try again.', 503);
    }
  };

  app.get('/owner/billing', async c => {
    const granted = await gate(c);
    if ('response' in granted) return granted.response;
    if (!reads.take(granted.identity.authUserId)) {
      c.header('retry-after', '60');
      return c.text('Too many refreshes. Try again in a minute.', 429);
    }
    const message = c.req.query('message');
    return render(c, granted.identity, {
      message: message === 'saved' || message === 'removed' ? message : undefined,
    });
  });

  app.get('/api/owner/billing', async c => {
    const granted = await gate(c, true);
    if ('response' in granted) return granted.response;
    if (!reads.take(granted.identity.authUserId)) {
      c.header('retry-after', '60');
      return c.json({ error: 'rate_limited' }, 429);
    }
    try {
      return c.json(await loadOwnerBilling(granted.identity, billing));
    } catch {
      return c.json({ error: 'billing_unavailable' }, 503);
    }
  });

  /** Always enforce browser origin here, including requests carrying unrelated editor tokens. */
  const mutation = async (c: Context): Promise<{ response: Response } | { identity: VerifiedIdentity; costs: OwnerCostStore }> => {
    const granted = await gate(c);
    if ('response' in granted) return granted;
    const expected = new URL(o.editorOrigin || c.req.url).origin;
    let origin = c.req.header('origin') || '';
    if (!origin) try { origin = new URL(c.req.header('referer') || '').origin; } catch { /* Fail closed. */ }
    if (origin !== expected) return { response: c.json({ error: 'origin_not_allowed' }, 403) };
    if (!changes.take(`${granted.identity.authUserId}|${o.requestSource(c)}`)) {
      c.header('retry-after', '60');
      return { response: c.text('Too many budget changes. Try again in a minute.', 429) };
    }
    if (!billing.costs) return { response: c.text('Budget storage is unavailable. Try again later.', 503) };
    return { identity: granted.identity, costs: billing.costs };
  };
  const smallBody = bodyLimit({ maxSize: 8 * 1024, onError: c => c.text('Request too large.', 413) });

  app.post('/owner/billing/costs', smallBody, async c => {
    const granted = await mutation(c);
    if ('response' in granted) return granted.response;
    if (!c.req.header('content-type')?.startsWith('application/x-www-form-urlencoded')) {
      return c.text('Submit a budget using the form.', 415);
    }
    const body = await c.req.parseBody();
    const field = (key: string) => typeof body[key] === 'string' ? body[key] as string : '';
    const draftCost = {
      id: field('id'), label: field('label'), category: field('category'),
      amount: field('amount'), currencyCode: field('currencyCode').trim().toUpperCase(),
    };
    const amountMinor = ownerBudgetMinorUnits(draftCost.amount, draftCost.currencyCode);
    if (amountMinor === null) return render(c, granted.identity, {
      error: Intl.supportedValuesOf('currency').includes(draftCost.currencyCode) ? 'amount_invalid' : 'currency_invalid', draftCost,
    }, 422);
    const input: OwnerCostBudgetInput = {
      ...(draftCost.id ? { id: draftCost.id } : {}), label: draftCost.label,
      category: draftCost.category as OwnerCostBudgetInput['category'], amountMinor,
      currencyCode: draftCost.currencyCode,
    };
    const result = await putOwnerCostBudget(granted.identity, billing.ownerAuthUserIds, granted.costs, input);
    if (result.status === 'invalid') {
      return render(c, granted.identity, { error: result.reason, draftCost }, 422);
    }
    if (result.status !== 'ok') {
      return render(c, granted.identity, { error: 'unavailable', draftCost }, 503);
    }
    return c.redirect(budgetLocation(c, o.pagePath || '/owner/billing', 'saved'), 303);
  });

  app.post('/owner/billing/costs/:id/remove', smallBody, async c => {
    const granted = await mutation(c);
    if ('response' in granted) return granted.response;
    const result = await removeOwnerCostBudget(granted.identity, billing.ownerAuthUserIds, granted.costs, c.req.param('id'));
    if (result.status !== 'ok') {
      return render(c, granted.identity, { error: result.status === 'invalid' ? result.reason : 'unavailable' }, result.status === 'invalid' ? 422 : 503);
    }
    if (!result.removed) return render(c, granted.identity, { error: 'not_found' }, 422);
    return c.redirect(budgetLocation(c, o.pagePath || '/owner/billing', 'removed'), 303);
  });
}

function budgetLocation(c: Context, path: string, message: 'saved' | 'removed') {
  const query = new URLSearchParams({ message });
  const range = c.req.query('range');
  if (range === '30d' || range === '90d' || range === '12m') query.set('range', range);
  const tests = c.req.query('tests');
  if (tests === 'include' || tests === 'exclude') query.set('tests', tests);
  const code = c.req.query('currency');
  if (code && Intl.supportedValuesOf('currency').includes(code)) query.set('currency', code);
  return path + '?' + query + (path === '/owner/billing' ? '#costs' : '');
}
