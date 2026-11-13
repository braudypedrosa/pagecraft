import type { VerifiedIdentity } from './account-auth.ts';
import {
  loadOwnerBilling,
  ownerBillingAccess,
  type OwnerBillingOptions,
  type OwnerTransactionSummary,
} from './owner-billing.ts';
import {
  CRM_SOURCES,
  CRM_STAGES,
  type CrmAccount,
  type CrmContact,
  type CrmContactStore,
  type CrmCustomer,
  type CrmMoneySeries,
  type CrmPlatformSnapshot,
  type CrmPlatformSource,
  type CrmRange,
  type CrmSeriesPoint,
  type FounderCrmData,
  type FounderCrmQuery,
} from './founder-crm-types.ts';

export interface LoadFounderCrmOptions {
  billing: OwnerBillingOptions;
  platform?: CrmPlatformSource;
  contacts?: CrmContactStore;
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const RANGE_DAYS: Record<CrmRange, 30 | 90 | 365> = { '30d': 30, '90d': 90, '12m': 365 };

const validTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const bucketStart = (date: Date, range: CrmRange) => {
  const year = date.getUTCFullYear(), month = date.getUTCMonth(), day = date.getUTCDate();
  if (range === '12m') return new Date(Date.UTC(year, month, 1));
  if (range === '90d') {
    const start = new Date(Date.UTC(year, month, day));
    const mondayOffset = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - mondayOffset);
    return start;
  }
  return new Date(Date.UTC(year, month, day));
};

const nextBucket = (date: Date, range: CrmRange) => {
  const next = new Date(date);
  if (range === '12m') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + (range === '90d' ? 7 : 1));
  return next;
};

const bucketKey = (date: Date, range: CrmRange) => bucketStart(date, range).toISOString().slice(0, 10);

function countSeries(values: (string | null)[], start: Date, end: Date, range: CrmRange): CrmSeriesPoint[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const time = validTime(value);
    if (time === null || time < start.getTime() || time > end.getTime()) continue;
    const key = bucketKey(new Date(time), range);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const points: CrmSeriesPoint[] = [];
  for (let cursor = bucketStart(start, range); cursor.getTime() <= end.getTime(); cursor = nextBucket(cursor, range)) {
    const date = cursor.toISOString().slice(0, 10);
    points.push({ date, value: counts.get(date) || 0 });
  }
  return points;
}

const normalizedEmail = (value: string) => value.trim().toLowerCase();

function linkedContact(account: CrmAccount, byAccount: Map<string, CrmContact>, byEmail: Map<string, CrmContact>) {
  return byAccount.get(account.id) || byEmail.get(normalizedEmail(account.email)) || null;
}

function customerFromAccount(account: CrmAccount, contact: CrmContact | null): CrmCustomer {
  return {
    id: account.id,
    accountId: account.id,
    contactId: contact?.id || null,
    name: account.name,
    email: account.email,
    company: contact?.company || '',
    plan: account.plan,
    ownedSites: account.ownedSites,
    publishedSites: account.publishedSites,
    mediaBytes: account.mediaBytes,
    joinedAt: account.createdAt,
    lastEditedAt: account.lastEditedAt,
    stage: contact?.stage || 'customer',
    source: contact?.source || 'unknown',
    notes: contact?.notes || '',
    followUpOn: contact?.followUpOn || null,
    isTest: contact?.isTest || false,
    revision: contact?.revision || null,
  };
}

function customerFromContact(contact: CrmContact): CrmCustomer {
  return {
    id: contact.id,
    accountId: contact.accountId,
    contactId: contact.id,
    name: contact.name,
    email: contact.email,
    company: contact.company,
    plan: null,
    ownedSites: null,
    publishedSites: null,
    mediaBytes: null,
    joinedAt: contact.createdAt,
    lastEditedAt: null,
    stage: contact.stage,
    source: contact.source,
    notes: contact.notes,
    followUpOn: contact.followUpOn,
    isTest: contact.isTest,
    revision: contact.revision,
  };
}

function mergeCustomers(snapshot: CrmPlatformSnapshot | null, contacts: CrmContact[], includeTests: boolean) {
  const allByAccount = new Map(contacts.flatMap(contact => contact.accountId ? [[contact.accountId, contact] as const] : []));
  const allByEmail = new Map(contacts.map(contact => [normalizedEmail(contact.email), contact] as const));
  const visibleContacts = contacts.filter(contact => includeTests || !contact.isTest);
  const byAccount = new Map(visibleContacts.flatMap(contact => contact.accountId ? [[contact.accountId, contact] as const] : []));
  const byEmail = new Map(visibleContacts.map(contact => [normalizedEmail(contact.email), contact] as const));
  const used = new Set<string>();
  const accounts = (snapshot?.accounts || []).filter(account => {
    if (includeTests) return true;
    const contact = linkedContact(account, allByAccount, allByEmail);
    return !contact?.isTest;
  });
  const customers = accounts.map(account => {
    const contact = linkedContact(account, byAccount, byEmail);
    if (contact) used.add(contact.id);
    return customerFromAccount(account, contact);
  });
  for (const contact of visibleContacts) if (!used.has(contact.id)) customers.push(customerFromContact(contact));
  customers.sort((left, right) => (right.lastEditedAt || right.joinedAt).localeCompare(left.lastEditedAt || left.joinedAt));
  return { accounts, visibleContacts, customers };
}

function chargeSeries(
  transactions: OwnerTransactionSummary[],
  start: Date,
  end: Date,
  range: CrmRange,
  knownCurrencies: string[],
): CrmMoneySeries[] {
  const totals = new Map<string, Map<string, bigint>>();
  const buckets: string[] = [];
  for (let cursor = bucketStart(start, range); cursor.getTime() <= end.getTime(); cursor = nextBucket(cursor, range)) {
    buckets.push(cursor.toISOString().slice(0, 10));
  }
  for (const currencyCode of knownCurrencies) {
    if (/^[A-Z]{3}$/.test(currencyCode)) {
      totals.set(currencyCode, new Map(buckets.map(date => [date, 0n])));
    }
  }
  for (const transaction of transactions) {
    if (transaction.status !== 'completed' || transaction.grossCustomerChargeMinor === null) continue;
    const time = validTime(transaction.billedAt);
    if (time === null || time < start.getTime() || time > end.getTime()) continue;
    if (!/^-?(0|[1-9]\d*)$/.test(transaction.grossCustomerChargeMinor) || !/^[A-Z]{3}$/.test(transaction.currencyCode)) continue;
    const key = bucketKey(new Date(time), range);
    const currency = totals.get(transaction.currencyCode) || new Map<string, bigint>();
    currency.set(key, (currency.get(key) || 0n) + BigInt(transaction.grossCustomerChargeMinor));
    totals.set(transaction.currencyCode, currency);
  }
  return [...totals].sort(([left], [right]) => left.localeCompare(right)).map(([currencyCode, values]) => ({
    currencyCode,
    points: [...values].sort(([left], [right]) => left.localeCompare(right)).map(([date, amount]) => ({
      date,
      amountMinor: amount.toString(),
    })),
  }));
}

export async function loadFounderCrm(
  identity: VerifiedIdentity | null,
  options: LoadFounderCrmOptions,
  query: FounderCrmQuery,
): Promise<FounderCrmData | { status: 'unauthenticated' | 'forbidden' }> {
  const access = ownerBillingAccess(identity, options.billing.ownerAuthUserIds);
  if (access !== 'allowed') return { status: access };

  const range: CrmRange = query.range === '90d' || query.range === '12m' ? query.range : '30d';
  const includeTests = query.includeTests !== false;
  const now = (options.now || options.billing.now || (() => new Date()))();
  const end = new Date(now);
  const start = new Date(end.getTime() - RANGE_DAYS[range] * DAY_MS);

  const [platformResult, contactsResult, billing] = await Promise.all([
    options.platform
      ? options.platform.snapshot().then(snapshot => ({ state: 'available' as const, snapshot })).catch(() => ({ state: 'unavailable' as const, snapshot: null }))
      : Promise.resolve({ state: 'not_connected' as const, snapshot: null }),
    options.contacts
      ? options.contacts.list().then(contacts => ({ state: 'available' as const, contacts })).catch(() => ({ state: 'unavailable' as const, contacts: [] as CrmContact[] }))
      : Promise.resolve({ state: 'not_connected' as const, contacts: [] as CrmContact[] }),
    loadOwnerBilling(identity, {
      ...options.billing,
      reportDays: RANGE_DAYS[range],
      now: () => end,
    }),
  ]);
  if (billing.status !== 'ok') return { status: billing.status };

  const { accounts, visibleContacts, customers } = mergeCustomers(platformResult.snapshot, contactsResult.contacts, includeTests);
  const visibleAccountIds = new Set(accounts.map(account => account.id));
  const visibleSites = (platformResult.snapshot?.sites || []).filter(site =>
    includeTests || site.ownerIds.length === 0 || site.ownerIds.some(ownerId => visibleAccountIds.has(ownerId))
  );
  const crmAvailable = contactsResult.state === 'available';
  const pipeline = crmAvailable ? CRM_STAGES.map(stage => ({
    stage,
    value: visibleContacts.filter(contact => contact.stage === stage).length,
  })) : [];
  const sources = crmAvailable ? CRM_SOURCES.map(source => ({
    source,
    value: visibleContacts.filter(contact => contact.source === source).length,
  })) : [];
  const planCounts = new Map<string, number>();
  for (const account of accounts) planCounts.set(account.plan, (planCounts.get(account.plan) || 0) + 1);
  const activationEligible = accounts.filter(account => account.authUserId !== null);
  const publishedAccounts = activationEligible.filter(account => account.publishedSites > 0).length;
  const platformAvailable = platformResult.state === 'available';
  const transactions = billing.billing.state === 'connected' ? billing.billing.recentTransactions : [];
  const chargeCurrencies = billing.billing.state === 'connected'
    ? [...new Set([
      ...billing.billing.completedGrossCustomerCharges.map(row => row.currencyCode),
      ...billing.billing.subscriptions.map(row => row.currencyCode),
    ])]
    : [];

  return {
    generatedAt: end.toISOString(),
    range,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    includeTests,
    platform: platformResult,
    crm: contactsResult,
    customers,
    analytics: {
      accountGrowth: platformAvailable
        ? countSeries(accounts.map(account => account.createdAt), start, end, range)
        : [],
      siteGrowth: platformAvailable
        ? countSeries(visibleSites.map(site => site.createdAt), start, end, range)
        : [],
      newAccounts: platformAvailable
        ? accounts.filter(account => {
          const time = validTime(account.createdAt);
          return time !== null && time >= start.getTime() && time <= end.getTime();
        }).length
        : null,
      activation: platformAvailable ? {
        eligibleAccounts: activationEligible.length,
        publishedAccounts,
        rate: activationEligible.length ? publishedAccounts / activationEligible.length * 100 : null,
      } : null,
      planMix: platformAvailable
        ? [...planCounts].sort(([left], [right]) => left.localeCompare(right)).map(([label, value]) => ({ label, value }))
        : [],
      pipeline,
      sources,
      followUps: customers.filter(customer => customer.contactId && customer.followUpOn &&
          customer.followUpOn <= end.toISOString().slice(0, 10) && customer.stage !== 'archived')
        .sort((left, right) => (left.followUpOn || '').localeCompare(right.followUpOn || '')),
      chargeHistory: chargeSeries(transactions, start, end, range, chargeCurrencies),
    },
    billing,
  };
}
