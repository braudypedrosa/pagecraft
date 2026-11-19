import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { accountCheckoutPage, accountPlansPage, type PlansPageInput } from './account-plans-page.ts';
import type { User } from './auth.ts';
import { throttle } from './mail.ts';
import {
  checkoutReady, createCheckoutTransaction, parsePaddleEvent, verifyPaddleSignature,
  getPaddleSubscription, previewPaddleChange, applyPaddleChange, fetchCatalogAmounts,
  PaddleCheckoutError, type BillingInterval, type BillingLedger, type PaddleBillingConfig,
} from './paddle-billing.ts';
import type { AccountPlanStatus, BillingSubscriptionSummary } from './plan-grants.ts';
import { isPlanExemptAccount, PLAN_RANK, type PaidPlan } from './plans.ts';
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
  subscription_updated: 'Paddle confirmed your change. Your billing details may take a moment to update.',
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

  const liveRows = (status: AccountPlanStatus | null) =>
    status?.subscriptions.filter(row => row.environment === o.config.environment && LIVE_STATUSES.has(row.status)) ?? [];
  const listedPrice = (row: BillingSubscriptionSummary) =>
    o.config.prices.find(price => price.priceId === row.priceId && price.plan === row.plan);
  const manageable = (row: BillingSubscriptionSummary) =>
    !!listedPrice(row) && (row.status === 'active' || row.status === 'trialing') &&
    (row.scheduledChange === null || row.scheduledChange === 'cancel');

  let catalog: { expires: number; amounts: Promise<Map<string, string>> } | undefined;
  const catalogAmounts = () => {
    if (!catalog || Date.now() >= catalog.expires) {
      catalog = { expires: Date.now() + 60_000, amounts: fetchCatalogAmounts(o.config, o.fetcher).catch(() => new Map<string, string>()) };
    }
    return catalog.amounts;
  };
  const plansPage = (user: User, status: AccountPlanStatus | null, notice?: PlansPageInput['notice'], review?: PlansPageInput['review'], amounts?: ReadonlyMap<string, string>) => {
    const live = liveRows(status);
    const ready = !!status && checkoutReady(o.config);
    const plans = [...new Set(o.config.prices.map(price => price.plan))];
    return accountPlansPage({
      user, current: status?.plan ?? user.plan ?? 'free', unrestricted: isPlanExemptAccount(user.id),
      offers: ready ? plans.map(plan => {
        const configured = o.config.prices.filter(price => price.plan === plan);
        const prices: Partial<Record<BillingInterval, string>> = {};
        for (const price of configured) {
          const amount = amounts?.get(price.priceId);
          if (amount) prices[price.interval] = amount;
        }
        return { plan, intervals: configured.map(price => price.interval), prices };
      }) : [],
      checkoutReady: ready,
      subscriptions: live.map(row => ({ ...row, interval: listedPrice(row)?.interval, manageable: ready && live.length === 1 && manageable(row) })),
      supportEmail: 'hello@braudyp.dev', notice, review,
    });
  };

  app.get('/account/plans', async c => {
    const user = await who(c);
    if (!user) return c.redirect('/sign-in?next=%2Faccount%2Fplans');
    const status = await o.plans.status(user.id).catch(() => null);
    c.header('cache-control', 'private, no-store');
    if (!status) return c.html(plansPage(user, null, { error: 'Your billing details could not be loaded. Please try again.' }), 503);
    const amounts = checkoutReady(o.config) && !isPlanExemptAccount(user.id) ? await catalogAmounts() : undefined;
    return c.html(plansPage(user, status, { message: MESSAGES[c.req.query('message') || ''] }, undefined, amounts));
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
    // Active customers switch the existing subscription from the Plans page.
    if (status.subscriptions.some(row => row.environment === o.config.environment && LIVE_STATUSES.has(row.status))) {
      return fail('This account already has a subscription. Choose a plan change on the Plans page.', 409);
    }
    if (PLAN_RANK[price.plan] <= PLAN_RANK[status.plan]) {
      return fail('Your account already includes this allowance. Choose a higher plan to upgrade.', 409);
    }
    try {
      const checkout = await createCheckoutTransaction(o.config, { priceId: price.priceId, userId: user.id, checkoutUrl: checkoutPage }, o.fetcher);
      return c.redirect(checkout.checkoutUrl, 303);
    } catch (error) {
      report(`Paddle checkout for ${plan} failed: ${error instanceof PaddleCheckoutError ? error.message : 'unexpected error'}`);
      return fail('Checkout could not start. Nothing was charged. Try again shortly.', 503);
    }
  });

  // Bind what the customer reviewed to Paddle's current version and quote. Another tab,
  // an intervening webhook, or a changed amount requires the customer to review again.
  const changesInProgress = new Set<string>();
  const reviews = throttle(40, 15 * 60 * 1000, 5000);
  app.post('/account/plans/:step{review|confirm}', bodyLimit({ maxSize: 4096, onError: c => c.text('Too large', 413) }), async c => {
    const user = await who(c);
    if (!user) return c.redirect('/sign-in?next=%2Faccount%2Fplans', 303);
    c.header('cache-control', 'private, no-store');
    if (!reviews.take(user.id)) return c.text('Too many requests. Try again in a few minutes.', 429);
    const confirming = c.req.param('step') === 'confirm';
    const fields = await c.req.parseBody();
    const parts = typeof fields.token === 'string' ? fields.token.split('.') : [];
    const [action, plan, interval] = confirming ? parts : [fields.action, fields.plan, fields.interval];
    const expiry = confirming ? Number(parts[3]) : Date.now() + 10 * 60_000;
    const status = await o.plans.status(user.id).catch(() => null);
    const fail = (message: string, code: 409 | 422 | 503) => c.html(plansPage(user, status, { error: message }), code);
    if (!status || !checkoutReady(o.config)) return fail('Your billing details are unavailable. Please try again.', 503);
    const live = liveRows(status);
    const row = live[0];
    if (live.length !== 1 || !manageable(row)) return fail('This subscription cannot be changed here. Contact support for help.', 409);
    if (confirming && (parts.length !== 5 || !/^[0-9a-f]{64}$/.test(parts[4]) || !Number.isSafeInteger(expiry) || expiry < Date.now())) {
      return fail('This review has expired. Review the change again.', 409);
    }
    if (action !== 'change' && action !== 'cancel' && action !== 'renew') return fail('Choose one of the listed changes.', 422);
    if ((action === 'renew') !== (row.scheduledChange === 'cancel')) return fail('Your renewal setting has changed. Review your subscription again.', 409);
    const price = action === 'change' ? o.config.prices.find(p => p.plan === plan && p.interval === interval) : undefined;
    if (action === 'change' && (!price || isPlanExemptAccount(user.id) || price.priceId === row.priceId)) {
      return fail('Choose a different available plan or billing interval.', 422);
    }
    if (changesInProgress.has(row.id)) return fail('A change is already in progress. Refresh your plans in a moment.', 409);
    if (confirming) changesInProgress.add(row.id);
    try {
      const remote = await getPaddleSubscription(o.config, row.id, o.fetcher);
      if (!remote.updated_at || remote.id !== row.id || remote.status !== row.status ||
          remote.items?.length !== 1 || remote.items[0].quantity !== 1 || remote.items[0].price.id !== row.priceId ||
          (remote.scheduled_change?.action ?? null) !== row.scheduledChange ||
          (remote.custom_data?.pagecraft_user_id && remote.custom_data.pagecraft_user_id !== user.id)) {
        return fail('Paddle and Pagecraft have different subscription details. Refresh your plans and try again.', 409);
      }
      const change = price
        ? { items: [{ price_id: price.priceId, quantity: 1 }], proration_billing_mode: 'prorated_immediately', on_payment_failure: 'prevent_change' }
        : action === 'cancel' ? { effective_from: 'next_billing_period' } : { scheduled_change: null };
      const preview = price ? await previewPaddleChange(o.config, row.id, change, o.fetcher)
        : { effectiveDate: remote.scheduled_change?.effective_at ?? remote.current_billing_period?.ends_at };
      if (!preview.effectiveDate || !Number.isFinite(Date.parse(preview.effectiveDate))) {
        return fail('Paddle could not confirm the billing date. Please try again.', 503);
      }
      const prefix = [action, price?.plan ?? '', price?.interval ?? '', expiry].join('.');
      const signature = createHmac('sha256', o.config.webhookSecret!)
        .update(JSON.stringify(['plan-review', o.config.environment, user.id, row.id, remote.updated_at, row.priceId,
          price?.priceId, prefix, { ...preview, effectiveDate: preview.effectiveDate.slice(0, 10) }])).digest('hex');
      if (!confirming) {
        return c.html(plansPage(user, status, undefined, { action, plan: price?.plan ?? row.plan,
          interval: price?.interval ?? listedPrice(row)?.interval, ...preview, token: prefix + '.' + signature }));
      }
      if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(parts[4], 'hex'))) {
        return fail('The subscription or quoted amount changed. Review the change again before confirming.', 409);
      }
      const updated = await applyPaddleChange(o.config, row.id, action === 'cancel', change, o.fetcher);
      const applied = price ? updated.items?.some(item => item.price.id === price.priceId)
        : action === 'cancel' ? updated.scheduled_change?.action === 'cancel' : updated.scheduled_change === null;
      if (updated.id !== row.id || !applied) throw new Error('Paddle did not confirm the requested subscription change');
      return c.redirect('/account/plans?message=subscription_updated', 303);
    } catch (error) {
      report(`Paddle subscription ${confirming ? 'confirmation' : 'review'} failed: ${error instanceof Error ? error.message : 'provider unavailable'}`);
      return fail(confirming
        ? 'Pagecraft could not confirm the change with Paddle. Refresh your plans before trying again.'
        : 'Paddle could not prepare this change. Please try again or contact support.', 503);
    } finally {
      if (confirming) changesInProgress.delete(row.id);
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
    return c.html(accountCheckoutPage({ user, token: o.config.clientToken!, sandbox: o.config.environment === 'sandbox' }));
  });
}
