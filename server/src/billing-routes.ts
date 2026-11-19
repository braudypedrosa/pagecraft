import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { accountCheckoutPage, accountPlansPage } from './account-plans-page.ts';
import type { User } from './auth.ts';
import { throttle } from './mail.ts';
import {
  checkoutReady, createCheckoutTransaction, parsePaddleEvent, verifyPaddleSignature,
  PaddleCheckoutError, type BillingInterval, type BillingLedger, type PaddleBillingConfig,
} from './paddle-billing.ts';
import type { AccountPlanStatus } from './plan-grants.ts';
import { isPlanExemptAccount, type PaidPlan } from './plans.ts';
import { GatewayError } from './store-gateway.ts';

export interface BillingRouteOptions {
  config: PaddleBillingConfig;
  ledger: BillingLedger;
  plans: { status(userId: string): Promise<AccountPlanStatus> };
  editorOrigin: string;
  fetcher?: typeof fetch;
  /** Where refused or failed webhook events are reported; never the payload. */
  report?: (message: string) => void;
}

const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused']);
const MESSAGES: Record<string, string> = {
  checkout_complete: 'Thanks. Your plan updates as soon as Paddle confirms the payment, usually within a minute.',
  checkout_closed: 'Checkout was closed. Nothing was charged.',
};

export function billingRoutes(app: Hono, o: BillingRouteOptions, who: (c: Context) => Promise<User | null>) {
  const checkouts = throttle(10, 15 * 60 * 1000, 5000);
  const report = o.report ?? ((message: string) => console.error(message));
  const checkoutPage = `${new URL(o.editorOrigin).origin}/account/plans/checkout`;

  app.post('/billing/paddle/webhook', bodyLimit({ maxSize: 256 * 1024, onError: c => c.text('Too large', 413) }), async c => {
    if (!o.config.webhookSecret) return c.notFound();
    const raw = await c.req.text();
    if (!verifyPaddleSignature(raw, c.req.header('paddle-signature'), o.config.webhookSecret)) {
      return c.json({ error: 'invalid_signature' }, 401);
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return c.json({ error: 'invalid_json' }, 400); }
    const parsed = parsePaddleEvent(payload, o.config);
    if (parsed.kind === 'ignored') return c.json({ ok: true, ignored: parsed.reason });
    try {
      const result = await o.ledger.applySubscription(parsed.event);
      if (result.outcome === 'refused') report(`Paddle ${parsed.event.eventType} ${parsed.event.eventId} refused: ${result.reason}`);
      return c.json({ ok: true, outcome: result.outcome });
    } catch (error) {
      // A malformed event is answered 400 so it shows in Paddle's log; anything else is retried.
      const status = error instanceof GatewayError && error.status === 400 ? 400 : 503;
      report(`Paddle ${parsed.event.eventType} ${parsed.event.eventId} failed: ${(error as Error).message}`);
      return c.json({ error: status === 400 ? 'invalid_event' : 'unavailable' }, status);
    }
  });

  const offers = () => {
    const plans = [...new Set(o.config.prices.map(price => price.plan))];
    return plans.map(plan => ({ plan, intervals: o.config.prices.filter(price => price.plan === plan) }));
  };

  const plansPage = (user: User, status: AccountPlanStatus | null, notice?: { error?: string; message?: string }) => {
    const live = status?.subscriptions.filter(row => row.environment === o.config.environment && LIVE_STATUSES.has(row.status)) ?? [];
    const ready = checkoutReady(o.config);
    return accountPlansPage({
      current: status?.plan ?? user.plan ?? 'free',
      unrestricted: isPlanExemptAccount(user.id),
      offers: ready && !live.length ? offers().map(offer => ({ plan: offer.plan, intervals: offer.intervals.map(price => price.interval) })) : [],
      checkoutReady: ready,
      subscriptions: live,
      supportEmail: 'hello@braudyp.dev',
      notice,
    });
  };

  app.get('/account/plans', async c => {
    const user = await who(c);
    if (!user) return c.redirect('/sign-in?next=%2Faccount%2Fplans');
    const status = await o.plans.status(user.id).catch(() => null);
    return c.html(plansPage(user, status, { message: MESSAGES[c.req.query('message') || ''] }));
  });

  app.post('/account/plans/checkout', bodyLimit({ maxSize: 4 * 1024, onError: c => c.text('Too large', 413) }), async c => {
    const user = await who(c);
    if (!user) return c.redirect('/sign-in?next=%2Faccount%2Fplans', 303);
    if (isPlanExemptAccount(user.id)) return c.redirect('/account/plans', 303);
    if (!checkoutReady(o.config)) return c.text('Paid plans are not available yet.', 404);
    if (!checkouts.take(user.id)) return c.text('Too many checkout attempts. Try again in a few minutes.', 429, { 'retry-after': '900' });
    const body = await c.req.parseBody();
    const plan = String(body.plan ?? '') as PaidPlan;
    const interval = String(body.interval ?? '') as BillingInterval;
    const price = o.config.prices.find(row => row.plan === plan && row.interval === interval);
    const fail = async (error: string, statusCode: 409 | 422 | 503) =>
      c.html(plansPage(user, await o.plans.status(user.id).catch(() => null), { error }), statusCode);
    if (!price) return fail('Choose one of the listed plans.', 422);
    let status: AccountPlanStatus;
    try { status = await o.plans.status(user.id); } catch { return fail('Billing is unavailable right now. Nothing was charged.', 503); }
    // One subscription per account; plan changes go through support until upgrades ship.
    if (status.subscriptions.some(row => row.environment === o.config.environment && LIVE_STATUSES.has(row.status))) {
      return fail('This account already has a subscription. Write to hello@braudyp.dev to change it.', 409);
    }
    try {
      const checkout = await createCheckoutTransaction(o.config, { priceId: price.priceId, userId: user.id, checkoutUrl: checkoutPage }, o.fetcher);
      return c.redirect(checkout.checkoutUrl, 303);
    } catch (error) {
      report(`Paddle checkout for ${plan} failed: ${error instanceof PaddleCheckoutError ? error.message : 'unexpected error'}`);
      return fail('Checkout could not start. Nothing was charged. Try again shortly.', 503);
    }
  });

  /* Paddle.js opens the transaction named by `_ptxn` in an overlay on this page. */
  app.get('/account/plans/checkout', async c => {
    const user = await who(c);
    if (!user) return c.redirect('/sign-in?next=%2Faccount%2Fplans');
    if (isPlanExemptAccount(user.id)) return c.redirect('/account/plans');
    const transaction = c.req.query('_ptxn') || '';
    if (!checkoutReady(o.config) || !/^txn_[a-z0-9]{10,40}$/.test(transaction)) return c.redirect('/account/plans');
    c.header('cache-control', 'private, no-store');
    return c.html(accountCheckoutPage({ token: o.config.clientToken!, sandbox: o.config.environment === 'sandbox' }));
  });
}
