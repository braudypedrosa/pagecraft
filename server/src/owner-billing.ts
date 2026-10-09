import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { VerifiedIdentity } from './account-auth.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY = /^[A-Z]{3}$/;
const PADDLE_ORIGINS = {
  sandbox: 'https://sandbox-api.paddle.com',
  live: 'https://api.paddle.com',
} as const;
const PADDLE_SUBSCRIPTION_PAGE_SIZE = 200;
const PADDLE_TRANSACTION_PAGE_SIZE = 30;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_PAGES = 20;
const MAX_PADDLE_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_COST_ROWS = 100;
const MAX_COST_FILE_BYTES = 64 * 1024;
const MAX_COST_MINOR = 999_999_999_999n;
const COST_CATEGORIES = ['hosting', 'database', 'email', 'marketing', 'other'] as const;

export type PaddleEnvironment = keyof typeof PADDLE_ORIGINS;
export type OwnerCostCategory = typeof COST_CATEGORIES[number];

export interface OwnerMoney {
  currencyCode: string;
  amountMinor: string;
}

export interface OwnerRecurringEstimate {
  currencyCode: string;
  monthlyEstimateMinor: string;
  annualizedEstimateMinor: string;
}

export interface OwnerSubscriptionSummary {
  id: string;
  customerId: string;
  status: 'active' | 'past_due';
  currencyCode: string;
  billingInterval: 'month' | 'year';
  billingFrequency: number;
  nextBilledAt: string | null;
  scheduledChange: 'cancel' | 'pause' | 'resume' | null;
  itemCount: number;
}

export interface OwnerTransactionSummary {
  id: string;
  customerId: string | null;
  subscriptionId: string | null;
  invoiceNumber: string | null;
  status: string;
  currencyCode: string;
  billedAt: string | null;
  grossCustomerChargeMinor: string | null;
  taxMinor: string | null;
  payoutCurrencyCode: string | null;
  payoutEarningsMinor: string | null;
  payoutFeeMinor: string | null;
  approvedAdjustmentsMinor: string | null;
}

export interface OwnerCostBudgetInput {
  id?: string;
  label: string;
  category: OwnerCostCategory;
  amountMinor: string;
  currencyCode: string;
}

export interface OwnerCostBudget extends Required<OwnerCostBudgetInput> {
  createdAt: string;
  updatedAt: string;
}

export interface OwnerCostStore {
  list(): Promise<OwnerCostBudget[]>;
  put(input: OwnerCostBudgetInput): Promise<OwnerCostBudget>;
  remove(id: string): Promise<boolean>;
}

export interface OwnerPlatformMetricsSource {
  siteCount?(): Promise<number | null>;
  accountCount?(): Promise<number | null>;
}

export interface OwnerBillingOptions {
  ownerAuthUserIds: readonly string[];
  reportDays?: 30 | 90 | 365;
  paddle?: {
    apiKey: string;
    environment?: PaddleEnvironment;
    timeoutMs?: number;
    overallTimeoutMs?: number;
    maxPages?: number;
  };
  platform?: OwnerPlatformMetricsSource;
  costs?: OwnerCostStore;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
}

export type OwnerBillingLoadResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | {
    status: 'ok';
    generatedAt: string;
    platform: { siteCount: number | null; accountCount: number | null };
    costs:
      | { state: 'available'; basis: 'monthly_budget'; rows: OwnerCostBudget[]; totals: OwnerMoney[] }
      | { state: 'unavailable'; basis: 'monthly_budget' };
    billing:
      | { state: 'not_connected'; environment: null }
      | { state: 'unavailable'; environment: PaddleEnvironment; reason: 'provider_unavailable' | 'provider_response_invalid' }
      | {
        state: 'connected';
        environment: PaddleEnvironment;
        coverage: 'complete' | 'partial';
        coverageNote: string | null;
        period: {
          kind: 'last_30_days_utc' | 'selected_days_utc';
          startsAt: string;
          endsAt: string;
        };
        activeRecurringEstimate: OwnerRecurringEstimate[];
        atRiskRecurringEstimate: OwnerRecurringEstimate[];
        recurringEstimateNote: string;
        completedGrossCustomerCharges: OwnerMoney[];
        completedTax: OwnerMoney[];
        completedPayoutEarnings: OwnerMoney[];
        completedPayoutFees: OwnerMoney[];
        approvedAdjustments: OwnerMoney[];
        financialDataNote: string;
        subscriptions: OwnerSubscriptionSummary[];
        recentTransactions: OwnerTransactionSummary[];
      };
  };

export type OwnerCostMutationResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'invalid'; reason: string }
  | { status: 'unavailable' }
  | { status: 'ok'; row?: OwnerCostBudget; removed?: boolean };

export function parseOwnerAuthUserIds(raw: string | undefined): readonly string[] {
  if (!raw?.trim()) return [];
  const ids = raw.split(',').map(value => value.trim()).filter(Boolean);
  if (!ids.length || ids.some(id => !UUID.test(id))) return [];
  return [...new Set(ids)];
}

export function ownerBillingAccess(
  identity: VerifiedIdentity | null,
  allowlist: readonly string[],
): 'unauthenticated' | 'forbidden' | 'allowed' {
  if (!identity) return 'unauthenticated';
  if (!allowlist.length || allowlist.some(id => !UUID.test(id))) return 'forbidden';
  return allowlist.includes(identity.authUserId) ? 'allowed' : 'forbidden';
}

const integer = (value: unknown): bigint | null => {
  if (typeof value !== 'string' || !/^-?(0|[1-9]\d*)$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
};

const currency = (value: unknown): string | null =>
  typeof value === 'string' && CURRENCY.test(value) ? value : null;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const textValue = (value: unknown): string | null => typeof value === 'string' ? value : null;

const addMoney = (totals: Map<string, bigint>, code: string, amount: bigint) =>
  totals.set(code, (totals.get(code) || 0n) + amount);

const moneyRows = (totals: Map<string, bigint>): OwnerMoney[] =>
  [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, amount]) => ({
    currencyCode, amountMinor: amount.toString(),
  }));

const roundDivide = (numerator: bigint, denominator: bigint) => {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
};

interface RecurringFraction { numerator: bigint; denominator: bigint }

const addFraction = (
  totals: Map<string, RecurringFraction>,
  code: string,
  numerator: bigint,
  denominator: bigint,
) => {
  const current = totals.get(code);
  if (!current) return void totals.set(code, { numerator, denominator });
  const shared = greatestCommonDivisor(current.denominator, denominator);
  const combinedDenominator = current.denominator / shared * denominator;
  const combinedNumerator = current.numerator * (denominator / shared) +
    numerator * (current.denominator / shared);
  const reduction = greatestCommonDivisor(combinedNumerator, combinedDenominator);
  totals.set(code, {
    numerator: combinedNumerator / reduction,
    denominator: combinedDenominator / reduction,
  });
};

const recurringRows = (totals: Map<string, RecurringFraction>): OwnerRecurringEstimate[] =>
  [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, amount]) => ({
    currencyCode,
    monthlyEstimateMinor: roundDivide(amount.numerator, amount.denominator).toString(),
    annualizedEstimateMinor: roundDivide(amount.numerator * 12n, amount.denominator).toString(),
  }));

const greatestCommonDivisor = (a: bigint, b: bigint): bigint => {
  while (b) [a, b] = [b, a % b];
  return a;
};

class PaddleResponseError extends Error {
  kind: 'provider_unavailable' | 'provider_response_invalid';
  constructor(kind: 'provider_unavailable' | 'provider_response_invalid') {
    super(kind);
    this.kind = kind;
  }
}

interface PaddleListResult { rows: unknown[]; complete: boolean }

async function withAbort<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new PaddleResponseError('provider_unavailable');
  let rejectAbort!: (error: PaddleResponseError) => void;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(new PaddleResponseError('provider_unavailable'));
  signal.addEventListener('abort', onAbort, { once: true });
  try { return await Promise.race([pending, aborted]); }
  finally { signal.removeEventListener('abort', onAbort); }
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_PADDLE_PAGE_BYTES) {
    throw new PaddleResponseError('provider_response_invalid');
  }
  if (!response.body) throw new PaddleResponseError('provider_response_invalid');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await withAbort(reader.read(), signal);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_PADDLE_PAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new PaddleResponseError('provider_response_invalid');
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof PaddleResponseError) throw error;
    throw new PaddleResponseError('provider_response_invalid');
  }
}

async function paddleList(
  path: string,
  pageSize: number,
  options: NonNullable<OwnerBillingOptions['paddle']>,
  fetcher: typeof globalThis.fetch,
  overallSignal: AbortSignal,
): Promise<PaddleListResult> {
  const environment = options.environment || 'sandbox';
  const origin = PADDLE_ORIGINS[environment];
  let next = new URL(path, origin);
  const timeoutMs = Math.max(100, Math.min(30_000, options.timeoutMs || DEFAULT_TIMEOUT_MS));
  const maxPages = Math.max(1, Math.min(100, options.maxPages || DEFAULT_MAX_PAGES));
  const seen = new Set<string>();
  const rows: unknown[] = [];
  for (let page = 0; page < maxPages; page++) {
    if (next.protocol !== 'https:' || next.origin !== origin || seen.has(next.href)) {
      throw new PaddleResponseError('provider_response_invalid');
    }
    seen.add(next.href);
    const requestSignal = AbortSignal.any([overallSignal, AbortSignal.timeout(timeoutMs)]);
    let response: Response;
    try {
      response = await withAbort(fetcher(next, {
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'paddle-version': '1',
          accept: 'application/json',
          'skip-count': 'true',
        },
        redirect: 'error',
        signal: requestSignal,
      }), requestSignal);
    } catch {
      throw new PaddleResponseError('provider_unavailable');
    }
    if (!response.ok) throw new PaddleResponseError('provider_unavailable');
    const body = await boundedJson(response, requestSignal);
    const envelope = record(body);
    if (!envelope || !Array.isArray(envelope.data)) {
      throw new PaddleResponseError('provider_response_invalid');
    }
    if (envelope.data.length > pageSize || rows.length + envelope.data.length > maxPages * pageSize) {
      throw new PaddleResponseError('provider_response_invalid');
    }
    rows.push(...envelope.data);
    const pagination = record(record(envelope.meta)?.pagination);
    const nextWire = textValue(pagination?.next);
    const hasMore = pagination?.has_more;
    if (typeof hasMore !== 'boolean' || !nextWire) return { rows, complete: false };
    let candidate: URL;
    try { candidate = new URL(nextWire, origin); } catch { return { rows, complete: false }; }
    if (candidate.protocol !== 'https:' || candidate.origin !== origin) return { rows, complete: false };
    if (!hasMore) return { rows, complete: true };
    next = candidate;
  }
  return { rows, complete: false };
}

const safeMetric = async (source: (() => Promise<number | null>) | undefined) => {
  if (!source) return null;
  try {
    const value = await source();
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch { return null; }
};

function subscriptionMetrics(rows: unknown[]) {
  const active = new Map<string, RecurringFraction>();
  const atRisk = new Map<string, RecurringFraction>();
  const subscriptions: OwnerSubscriptionSummary[] = [];
  let invalid = 0;
  for (const raw of rows) {
    const row = record(raw);
    const status = row?.status === 'active' || row?.status === 'past_due' ? row.status : null;
    if (!row || !status) { invalid++; continue; }
    const subscriptionCurrency = currency(row.currency_code);
    const cycle = record(row.billing_cycle);
    const interval = cycle?.interval === 'month' || cycle?.interval === 'year' ? cycle.interval : null;
    const frequency = Number(cycle?.frequency);
    const id = textValue(row.id), customerId = textValue(row.customer_id);
    if (!id || !customerId || !subscriptionCurrency || !interval || !Number.isSafeInteger(frequency) || frequency < 1 || !Array.isArray(row.items)) {
      invalid++;
      continue;
    }
    let itemCount = 0;
    for (const rawItem of array(row.items)) {
      const item = record(rawItem), price = record(item?.price), unitPrice = record(price?.unit_price);
      const itemCycle = record(price?.billing_cycle);
      const itemInterval = itemCycle?.interval === 'month' || itemCycle?.interval === 'year'
        ? itemCycle.interval : null;
      const itemFrequency = Number(itemCycle?.frequency);
      const amount = integer(unitPrice?.amount), code = currency(unitPrice?.currency_code);
      const quantity = Number(item?.quantity);
      if (item?.status !== 'active' || item?.recurring !== true || !itemInterval || amount === null || amount < 0n || !code ||
          !Number.isSafeInteger(itemFrequency) || itemFrequency < 1 ||
          !Number.isSafeInteger(quantity) || quantity < 1) {
        invalid++;
        continue;
      }
      const denominator = BigInt(itemFrequency) * (itemInterval === 'year' ? 12n : 1n);
      addFraction(status === 'active' ? active : atRisk, code, amount * BigInt(quantity), denominator);
      itemCount++;
    }
    const scheduled = record(row.scheduled_change)?.action;
    subscriptions.push({
      id, customerId, status, currencyCode: subscriptionCurrency,
      billingInterval: interval, billingFrequency: frequency,
      nextBilledAt: textValue(row.next_billed_at),
      scheduledChange: scheduled === 'cancel' || scheduled === 'pause' || scheduled === 'resume' ? scheduled : null,
      itemCount,
    });
  }
  return { active: recurringRows(active), atRisk: recurringRows(atRisk), subscriptions, invalid };
}

function transactionMetrics(rows: unknown[]) {
  const gross = new Map<string, bigint>(), tax = new Map<string, bigint>();
  const earnings = new Map<string, bigint>(), fees = new Map<string, bigint>();
  const adjustments = new Map<string, bigint>();
  const recent: OwnerTransactionSummary[] = [];
  let invalid = 0;
  for (const raw of rows) {
    const row = record(raw);
    const id = textValue(row?.id), status = textValue(row?.status), code = currency(row?.currency_code);
    if (!row || !id || !status || !code) { invalid++; continue; }
    const details = record(row.details), totals = record(details?.totals);
    const grossAmount = integer(totals?.total), taxAmount = integer(totals?.tax);
    const payout = record(details?.adjusted_payout_totals) || record(details?.payout_totals);
    const payoutCode = currency(payout?.currency_code);
    const payoutEarnings = integer(payout?.earnings), payoutFee = integer(payout?.fee);
    if (status === 'completed' && (grossAmount === null || grossAmount < 0n || taxAmount === null || taxAmount < 0n)) {
      invalid++;
      continue;
    }
    if (payout && (!payoutCode || payoutEarnings === null || payoutFee === null)) invalid++;
    let approved = 0n, hasApproved = false;
    for (const rawAdjustment of array(row.adjustments)) {
      const adjustment = record(rawAdjustment), adjustmentTotals = record(adjustment?.totals);
      const adjustmentCode = currency(adjustment?.currency_code);
      const adjustmentAmount = integer(adjustmentTotals?.total);
      if (!adjustment) { invalid++; continue; }
      if (adjustment.status !== 'approved') continue;
      if (!adjustmentCode || adjustmentAmount === null) { invalid++; continue; }
      addMoney(adjustments, adjustmentCode, adjustmentAmount);
      if (adjustmentCode === code) { approved += adjustmentAmount; hasApproved = true; }
    }
    if (status === 'completed') {
      if (grossAmount !== null) addMoney(gross, code, grossAmount);
      if (taxAmount !== null) addMoney(tax, code, taxAmount);
      if (payoutCode && payoutEarnings !== null) addMoney(earnings, payoutCode, payoutEarnings);
      if (payoutCode && payoutFee !== null) addMoney(fees, payoutCode, payoutFee);
    }
    recent.push({
      id, status, currencyCode: code,
      customerId: textValue(row.customer_id), subscriptionId: textValue(row.subscription_id),
      invoiceNumber: textValue(row.invoice_number), billedAt: textValue(row.billed_at),
      grossCustomerChargeMinor: grossAmount?.toString() ?? null,
      taxMinor: taxAmount?.toString() ?? null,
      payoutCurrencyCode: payoutCode,
      payoutEarningsMinor: payoutEarnings?.toString() ?? null,
      payoutFeeMinor: payoutFee?.toString() ?? null,
      approvedAdjustmentsMinor: hasApproved ? approved.toString() : null,
    });
  }
  recent.sort((a, b) => (b.billedAt || '').localeCompare(a.billedAt || ''));
  return {
    gross: moneyRows(gross), tax: moneyRows(tax), earnings: moneyRows(earnings),
    fees: moneyRows(fees), adjustments: moneyRows(adjustments), recent, invalid,
  };
}

async function paddleDashboard(
  options: NonNullable<OwnerBillingOptions['paddle']>,
  fetcher: typeof globalThis.fetch,
  now: Date,
  reportDays: 30 | 90 | 365,
): Promise<Extract<Extract<OwnerBillingLoadResult, { status: 'ok' }>['billing'], { state: 'connected' | 'unavailable' }>> {
  const environment = options.environment || 'sandbox';
  const endsAt = now.toISOString();
  const startsAt = new Date(now.getTime() - reportDays * 24 * 60 * 60 * 1000).toISOString();
  const overallTimeoutMs = Math.max(100, Math.min(30_000, options.overallTimeoutMs || 15_000));
  const overallSignal = AbortSignal.timeout(overallTimeoutMs);
  try {
    const [subscriptions, transactions] = await Promise.all([
      paddleList(`/subscriptions?per_page=${PADDLE_SUBSCRIPTION_PAGE_SIZE}&status=active,past_due`, PADDLE_SUBSCRIPTION_PAGE_SIZE, options, fetcher, overallSignal),
      paddleList(`/transactions?per_page=${PADDLE_TRANSACTION_PAGE_SIZE}&billed_at%5BGTE%5D=${encodeURIComponent(startsAt)}&billed_at%5BLTE%5D=${encodeURIComponent(endsAt)}&include=adjustments`, PADDLE_TRANSACTION_PAGE_SIZE, options, fetcher, overallSignal),
    ]);
    const recurring = subscriptionMetrics(subscriptions.rows);
    const transaction = transactionMetrics(transactions.rows);
    const invalidRecords = recurring.invalid + transaction.invalid;
    const complete = subscriptions.complete && transactions.complete && invalidRecords === 0;
    const coverageReasons = [
      !subscriptions.complete || !transactions.complete
        ? 'Provider pagination was incomplete or invalid; totals cover only retrieved records.' : '',
      invalidRecords
        ? `${invalidRecords} malformed or unsupported provider record${invalidRecords === 1 ? '' : 's'} omitted; totals are partial.` : '',
    ].filter(Boolean);
    return {
      state: 'connected', environment, coverage: complete ? 'complete' : 'partial',
      coverageNote: complete ? null : coverageReasons.join(' '),
      period: {
        kind: reportDays === 30 ? 'last_30_days_utc' : 'selected_days_utc',
        startsAt,
        endsAt,
      },
      activeRecurringEstimate: recurring.active,
      atRiskRecurringEstimate: recurring.atRisk,
      recurringEstimateNote: 'Monthly and annualized catalog-price estimates before discounts. Price tax mode may include or exclude tax. Past-due amounts are shown separately as at risk.',
      completedGrossCustomerCharges: transaction.gross,
      completedTax: transaction.tax,
      completedPayoutEarnings: transaction.earnings,
      completedPayoutFees: transaction.fees,
      approvedAdjustments: transaction.adjustments,
      financialDataNote: 'Gross charge and tax use transaction currency. Payout earnings and fees use payout currency and remain null until Paddle supplies payout totals. Approved adjustments include only provider-returned approved records; null means none were returned, not that refunds are impossible.',
      subscriptions: recurring.subscriptions,
      recentTransactions: transaction.recent,
    };
  } catch (error) {
    return {
      state: 'unavailable', environment,
      reason: error instanceof PaddleResponseError ? error.kind : 'provider_unavailable',
    };
  }
}

export async function loadOwnerBilling(
  identity: VerifiedIdentity | null,
  options: OwnerBillingOptions,
): Promise<OwnerBillingLoadResult> {
  const access = ownerBillingAccess(identity, options.ownerAuthUserIds);
  if (access !== 'allowed') return { status: access };
  const now = (options.now || (() => new Date()))();
  const reportDays = options.reportDays === 90 || options.reportDays === 365
    ? options.reportDays
    : 30;
  const [siteCount, accountCount, costResult] = await Promise.all([
    safeMetric(options.platform?.siteCount?.bind(options.platform)),
    safeMetric(options.platform?.accountCount?.bind(options.platform)),
    options.costs
      ? options.costs.list().then(rows => ({ state: 'available' as const, rows })).catch(() => ({ state: 'unavailable' as const }))
      : Promise.resolve({ state: 'available' as const, rows: [] as OwnerCostBudget[] }),
  ]);
  let costs: Extract<OwnerBillingLoadResult, { status: 'ok' }>['costs'];
  if (costResult.state === 'unavailable') {
    costs = { state: 'unavailable', basis: 'monthly_budget' };
  } else {
    const costTotals = new Map<string, bigint>();
    for (const row of costResult.rows) addMoney(costTotals, row.currencyCode, BigInt(row.amountMinor));
    costs = { state: 'available', basis: 'monthly_budget', rows: costResult.rows, totals: moneyRows(costTotals) };
  }
  const paddle = options.paddle?.apiKey.trim()
    ? await paddleDashboard(options.paddle, options.fetch || globalThis.fetch, now, reportDays)
    : { state: 'not_connected' as const, environment: null };
  return {
    status: 'ok', generatedAt: now.toISOString(),
    platform: { siteCount, accountCount },
    costs,
    billing: paddle,
  };
}

export const validateOwnerCostBudget = (input: OwnerCostBudgetInput): Omit<OwnerCostBudgetInput, 'id'> & { id?: string } => {
  const label = String(input.label || '').trim();
  if (!label || label.length > 120) throw new Error('label_invalid');
  if (!(COST_CATEGORIES as readonly string[]).includes(input.category)) throw new Error('category_invalid');
  if (!/^(0|[1-9]\d*)$/.test(input.amountMinor) || BigInt(input.amountMinor) > MAX_COST_MINOR) {
    throw new Error('amount_invalid');
  }
  if (!CURRENCY.test(input.currencyCode)) throw new Error('currency_invalid');
  if (input.id !== undefined && !UUID.test(input.id)) throw new Error('id_invalid');
  return { id: input.id, label, category: input.category, amountMinor: input.amountMinor, currencyCode: input.currencyCode };
};

const PUBLIC_COST_ERRORS = new Set([
  'label_invalid', 'category_invalid', 'amount_invalid', 'currency_invalid', 'id_invalid',
  'cost_row_limit', 'not_found',
]);
const publicCostError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  return PUBLIC_COST_ERRORS.has(message) ? message : '';
};

export async function putOwnerCostBudget(
  identity: VerifiedIdentity | null,
  allowlist: readonly string[],
  store: OwnerCostStore,
  input: OwnerCostBudgetInput,
): Promise<OwnerCostMutationResult> {
  const access = ownerBillingAccess(identity, allowlist);
  if (access !== 'allowed') return { status: access };
  let valid: ReturnType<typeof validateOwnerCostBudget>;
  try { valid = validateOwnerCostBudget(input); }
  catch (error) { return { status: 'invalid', reason: publicCostError(error) || 'input_invalid' }; }
  try { return { status: 'ok', row: await store.put(valid) }; }
  catch (error) {
    const reason = publicCostError(error);
    return reason ? { status: 'invalid', reason } : { status: 'unavailable' };
  }
}

export async function removeOwnerCostBudget(
  identity: VerifiedIdentity | null,
  allowlist: readonly string[],
  store: OwnerCostStore,
  id: string,
): Promise<OwnerCostMutationResult> {
  const access = ownerBillingAccess(identity, allowlist);
  if (access !== 'allowed') return { status: access };
  if (!UUID.test(id)) return { status: 'invalid', reason: 'id_invalid' };
  try { return { status: 'ok', removed: await store.remove(id) }; }
  catch { return { status: 'unavailable' }; }
}

async function readCosts(path: string): Promise<OwnerCostBudget[]> {
  let info;
  try { info = await stat(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  if (info.size > MAX_COST_FILE_BYTES) throw new Error('cost_file_too_large');
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length > MAX_COST_ROWS) throw new Error('cost_file_invalid');
  return parsed.map(raw => {
    const row = record(raw);
    const valid = validateOwnerCostBudget({
      id: String(row?.id || ''), label: String(row?.label || ''),
      category: row?.category as OwnerCostCategory,
      amountMinor: String(row?.amountMinor ?? ''), currencyCode: String(row?.currencyCode || ''),
    });
    const createdAt = textValue(row?.createdAt), updatedAt = textValue(row?.updatedAt);
    if (!valid.id || !createdAt || !updatedAt || !Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) {
      throw new Error('cost_file_invalid');
    }
    return { ...valid, id: valid.id, createdAt, updatedAt };
  });
}

const costQueues = new Map<string, Promise<unknown>>();

export class FileOwnerCostStore implements OwnerCostStore {
  private path: string;
  constructor(path: string) { this.path = path; }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const previous = costQueues.get(this.path) || Promise.resolve();
    const next = previous.then(work, work);
    costQueues.set(this.path, next.catch(() => undefined));
    return next;
  }

  private async write(rows: OwnerCostBudget[]) {
    if (rows.length > MAX_COST_ROWS) throw new Error('cost_row_limit');
    const wire = JSON.stringify(rows, null, 2) + '\n';
    if (Buffer.byteLength(wire) > MAX_COST_FILE_BYTES) throw new Error('cost_file_too_large');
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(wire, 'utf8');
      await handle.sync();
      await handle.close();
      await rename(temporary, this.path);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async list() { return this.serialize(() => readCosts(this.path)); }

  async put(input: OwnerCostBudgetInput) {
    const valid = validateOwnerCostBudget(input);
    return this.serialize(async () => {
      const rows = await readCosts(this.path);
      const now = new Date().toISOString();
      const index = valid.id ? rows.findIndex(row => row.id === valid.id) : -1;
      if (valid.id && index < 0) throw new Error('not_found');
      const row: OwnerCostBudget = index >= 0
        ? { ...rows[index], ...valid, id: rows[index].id, updatedAt: now }
        : { ...valid, id: valid.id || randomUUID(), createdAt: now, updatedAt: now };
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      await this.write(rows);
      return row;
    });
  }

  async remove(id: string) {
    if (!UUID.test(id)) throw new Error('id_invalid');
    return this.serialize(async () => {
      const rows = await readCosts(this.path);
      const next = rows.filter(row => row.id !== id);
      if (next.length === rows.length) return false;
      await this.write(next);
      return true;
    });
  }
}
