import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PagecraftGateway } from './store-gateway.ts';
import { isPaidPlan, type PaidPlan, type PlanSource, type AccountPlan } from './plans.ts';

/* Customer billing through Paddle: server-created checkout transactions and the signed
   subscription webhook. Prices map to plans only through server configuration, the account comes
   only from custom data this server set on the transaction, and the gateway applies each event
   once, in order, in one transaction. */

export type PaddleEnvironment = 'sandbox' | 'live';
export type BillingInterval = 'monthly' | 'yearly';

const API_ORIGINS: Record<PaddleEnvironment, string> = {
  sandbox: 'https://sandbox-api.paddle.com',
  live: 'https://api.paddle.com',
};
const PRICE_ID = /^pri_[a-z0-9]{10,40}$/;
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface PaddlePrice { priceId: string; plan: PaidPlan; interval: BillingInterval }

export interface PaddleBillingConfig {
  environment: PaddleEnvironment;
  /** Server-only. Creates checkout transactions. */
  apiKey?: string;
  /** Server-only. Verifies webhook signatures. */
  webhookSecret?: string;
  /** Public by design: Paddle.js uses it in the browser to open checkout. */
  clientToken?: string;
  prices: PaddlePrice[];
}

/** `PADDLE_PRICES` is `plan:interval=pri_…` pairs, comma separated, e.g. `launch:monthly=pri_01…`. */
export function parsePaddlePrices(value: string | undefined): PaddlePrice[] {
  if (!value?.trim()) return [];
  const prices: PaddlePrice[] = [];
  for (const entry of value.split(',').map(part => part.trim()).filter(Boolean)) {
    const match = /^([a-z]+):(monthly|yearly)=(\S+)$/.exec(entry);
    if (!match || !isPaidPlan(match[1]) || !PRICE_ID.test(match[3])) {
      throw new Error('PADDLE_PRICES must list plan:interval=pri_… pairs for launch, studio or pro');
    }
    if (prices.some(price => price.priceId === match[3] || (price.plan === match[1] && price.interval === match[2]))) {
      throw new Error('PADDLE_PRICES repeats a price or a plan interval');
    }
    prices.push({ plan: match[1] as PaidPlan, interval: match[2] as BillingInterval, priceId: match[3] });
  }
  return prices;
}

/** Undefined when billing is not configured at all, which keeps every billing route off. */
export function paddleBillingConfig(env: Record<string, string | undefined>): PaddleBillingConfig | undefined {
  const apiKey = env.PADDLE_API_KEY?.trim() || undefined;
  const webhookSecret = env.PADDLE_WEBHOOK_SECRET?.trim() || undefined;
  const clientToken = env.PADDLE_CLIENT_TOKEN?.trim() || undefined;
  const prices = parsePaddlePrices(env.PADDLE_PRICES);
  if (!apiKey && !webhookSecret && !clientToken && !prices.length) return undefined;
  const environment = env.PADDLE_ENVIRONMENT || 'sandbox';
  if (environment !== 'sandbox' && environment !== 'live') throw new Error('PADDLE_ENVIRONMENT must be sandbox or live');
  if (clientToken && !/^(test|live)_[A-Za-z0-9]{10,80}$/.test(clientToken)) throw new Error('PADDLE_CLIENT_TOKEN is invalid');
  if (clientToken && clientToken.startsWith('test_') !== (environment === 'sandbox')) {
    throw new Error('PADDLE_CLIENT_TOKEN does not match PADDLE_ENVIRONMENT');
  }
  return { environment, apiKey, webhookSecret, clientToken, prices };
}

export const checkoutReady = (config?: PaddleBillingConfig) =>
  !!config?.apiKey && !!config.clientToken && !!config.webhookSecret && config.prices.length > 0;

/* `Paddle-Signature: ts=<unix seconds>;h1=<hex hmac>`. The signed text is `<ts>:<raw body>`.
   More than one h1 can appear while a secret is being rotated; any match is enough. */
export function verifyPaddleSignature(rawBody: string, header: string | undefined, secret: string, now = Date.now()) {
  if (!header || header.length > 1024) return false;
  let ts = '';
  const signatures: string[] = [];
  for (const part of header.split(';')) {
    const [key, value] = part.split('=', 2).map(item => item?.trim() ?? '');
    if (key === 'ts') ts = value;
    else if (key === 'h1' && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (!/^\d{1,12}$/.test(ts) || !signatures.length) return false;
  if (Math.abs(now - Number(ts) * 1000) > SIGNATURE_TOLERANCE_MS) return false;
  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest();
  return signatures.some(signature => timingSafeEqual(Buffer.from(signature, 'hex'), expected));
}

const SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused', 'canceled']);

export interface SubscriptionEventInput {
  environment: PaddleEnvironment;
  eventId: string;
  eventType: string;
  occurredAt: string;
  subscriptionId: string;
  customerId: string;
  userId: string | null;
  priceId: string;
  plan: PaidPlan;
  status: string;
  currentPeriodEnd: string | null;
  scheduledChange: string | null;
}

export type ParsedPaddleEvent =
  | { kind: 'subscription'; event: SubscriptionEventInput }
  | { kind: 'ignored'; reason: string };

/** Reads only the fields Pagecraft needs from a verified notification. */
export function parsePaddleEvent(payload: unknown, config: PaddleBillingConfig): ParsedPaddleEvent {
  const body = payload as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return { kind: 'ignored', reason: 'not an event' };
  const eventType = typeof body.event_type === 'string' ? body.event_type : '';
  if (!eventType.startsWith('subscription.')) return { kind: 'ignored', reason: 'not a subscription event' };
  const data = body.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return { kind: 'ignored', reason: 'missing subscription' };
  const items = Array.isArray(data.items) ? data.items as Record<string, unknown>[] : [];
  const priceIds = items.map(item => (item?.price as Record<string, unknown> | undefined)?.id).filter(id => typeof id === 'string') as string[];
  const known = config.prices.filter(price => priceIds.includes(price.priceId));
  if (known.length !== 1) return { kind: 'ignored', reason: known.length ? 'more than one Pagecraft price' : 'no Pagecraft price' };
  const status = typeof data.status === 'string' ? data.status : '';
  if (!SUBSCRIPTION_STATUSES.has(status)) return { kind: 'ignored', reason: 'unknown status' };
  const custom = data.custom_data as Record<string, unknown> | null;
  const userId = typeof custom?.pagecraft_user_id === 'string' ? custom.pagecraft_user_id : null;
  const period = data.current_billing_period as Record<string, unknown> | null;
  const scheduled = data.scheduled_change as Record<string, unknown> | null;
  return {
    kind: 'subscription',
    event: {
      environment: config.environment,
      eventId: String(body.event_id ?? ''),
      eventType,
      occurredAt: String(body.occurred_at ?? ''),
      subscriptionId: String(data.id ?? ''),
      customerId: String(data.customer_id ?? ''),
      userId,
      priceId: known[0].priceId,
      plan: known[0].plan,
      status,
      currentPeriodEnd: typeof period?.ends_at === 'string' ? period.ends_at : null,
      scheduledChange: typeof scheduled?.action === 'string' ? scheduled.action : null,
    },
  };
}

export type ApplyOutcome =
  | { outcome: 'applied'; userId: string; plan: { plan: AccountPlan; source: PlanSource; changed: boolean } }
  | { outcome: 'duplicate' | 'stale' }
  | { outcome: 'refused'; reason: string };

export interface BillingLedger {
  applySubscription(event: SubscriptionEventInput): Promise<ApplyOutcome>;
  recomputeStale(): Promise<{ checked: number; changed: number }>;
}

export class GatewayBillingLedger implements BillingLedger {
  private gateway: PagecraftGateway;
  constructor(gateway: PagecraftGateway) { this.gateway = gateway; }
  applySubscription(event: SubscriptionEventInput) {
    return this.gateway.call<ApplyOutcome>('billing.applySubscription', { ...event });
  }
  recomputeStale() {
    return this.gateway.call<{ checked: number; changed: number }>('plan.recomputeStale');
  }
}

export class PaddleCheckoutError extends Error {}

/** Creates a checkout transaction whose custom data names the signed-in account. */
export async function createCheckoutTransaction(
  config: PaddleBillingConfig,
  input: { priceId: string; userId: string; checkoutUrl: string },
  fetcher: typeof fetch = fetch,
): Promise<{ transactionId: string; checkoutUrl: string }> {
  if (!config.apiKey) throw new PaddleCheckoutError('Checkout is not configured');
  let response: Response;
  try {
    response = await fetcher(`${API_ORIGINS[config.environment]}/transactions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ price_id: input.priceId, quantity: 1 }],
        custom_data: { pagecraft_user_id: input.userId },
        // Sandbox uses the default payment link configured in Paddle.
        checkout: config.environment === 'sandbox' ? undefined : { url: input.checkoutUrl },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaddleCheckoutError('Paddle could not be reached');
  }
  if (!response.ok) throw new PaddleCheckoutError(`Paddle refused the checkout (${response.status})`);
  const body = await response.json().catch(() => null) as { data?: { id?: unknown; checkout?: { url?: unknown } } } | null;
  const transactionId = body?.data?.id, checkoutUrl = body?.data?.checkout?.url;
  if (typeof transactionId !== 'string' || !/^txn_[a-z0-9]{10,40}$/.test(transactionId) || typeof checkoutUrl !== 'string') {
    throw new PaddleCheckoutError('Paddle returned an unexpected checkout');
  }
  const url = new URL(checkoutUrl);
  const expected = new URL(input.checkoutUrl);
  // Only follow a checkout link back to this app's own checkout page.
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.searchParams.get('_ptxn') !== transactionId) {
    throw new PaddleCheckoutError('Paddle returned an unexpected checkout');
  }
  return { transactionId, checkoutUrl: url.toString() };
}
