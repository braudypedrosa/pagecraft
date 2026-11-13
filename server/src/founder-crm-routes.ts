import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { VerifiedIdentity } from './account-auth.ts';
import type { User } from './auth.ts';
import { loadFounderCrm } from './founder-crm-data.ts';
import { founderCrmPage } from './founder-crm-page.ts';
import { CrmStoreError } from './founder-crm-store.ts';
import type {
  CrmContactInput, CrmContactStore, CrmPlatformSource, CrmRange, CrmSection,
  FounderCrmData, FounderCrmPageInput, FounderCrmQuery,
} from './founder-crm-types.ts';
import { throttle } from './mail.ts';
import { ownerBillingAccess, type OwnerBillingOptions } from './owner-billing.ts';

export interface FounderCrmRouteOptions {
  billing: OwnerBillingOptions;
  platform?: CrmPlatformSource;
  contacts?: CrmContactStore;
  identity(c: Context): Promise<VerifiedIdentity | null>;
  origin: string;
  dataEnvironment: FounderCrmPageInput['dataEnvironment'];
  previewLabel?: string;
}

const sections: CrmSection[] = ['overview', 'customers', 'pipeline', 'revenue', 'costs', 'reports', 'sources'];
export function founderCrmQuery(c: Context): FounderCrmQuery {
  const range = c.req.query('range');
  return { range: range === '90d' || range === '12m' ? range : '30d', includeTests: c.req.query('tests') !== 'exclude' };
}
const currency = (value: string | undefined) => value && Intl.supportedValuesOf('currency').includes(value) ? value : undefined;
const formField = (body: Record<string, unknown>, key: string) => typeof body[key] === 'string' ? body[key] as string : '';
const identityUser = (identity: VerifiedIdentity): User => ({ id: identity.authUserId, authUserId: identity.authUserId, email: identity.email, name: identity.name });

/** Spreadsheet exports treat user-controlled text as text, including formula prefixes. */
export function founderCrmCsv(rows: (string | number | boolean | null)[][]) {
  const cell = (value: string | number | boolean | null) => {
    let text = value === null ? '' : String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

const exportRows = (kind: string, data: FounderCrmData, selectedCurrency?: string): (string | number | boolean | null)[][] | null => {
  if (kind === 'customers') return [
    ['Record ID', 'Account ID', 'Name', 'Email', 'Company', 'Plan assignment', 'Owned sites', 'Published sites', 'Media bytes', 'Profile created at', 'Last site edit at', 'CRM stage', 'Source', 'Follow-up date', 'Marked test', 'Notes'],
    ...data.customers.map(row => [row.id, row.accountId, row.name, row.email, row.company, row.plan, row.ownedSites, row.publishedSites, row.mediaBytes, row.joinedAt, row.lastEditedAt, row.stage, row.source, row.followUpOn, row.isTest, row.notes]),
  ];
  if (kind === 'pipeline') return [
    ['Contact ID', 'Name', 'Email', 'Company', 'Stage', 'Source', 'Follow-up date', 'Marked test', 'Updated at'],
    ...data.crm.contacts.filter(row => data.includeTests || !row.isTest).map(row => [row.id, row.name, row.email, row.company, row.stage, row.source, row.followUpOn, row.isTest, row.updatedAt]),
  ];
  if (kind === 'payments') {
    if (data.billing.billing.state !== 'connected') return null;
    return [
      ['Transaction ID', 'Provider customer ID', 'Subscription ID', 'Invoice', 'Status', 'Billed at', 'Charge currency', 'Gross charge minor units', 'Tax minor units', 'Payout currency', 'Payout earnings minor units', 'Payout fee minor units', 'Approved adjustments minor units'],
      ...data.billing.billing.recentTransactions.filter(row => !selectedCurrency || row.currencyCode === selectedCurrency).map(row => [row.id, row.customerId, row.subscriptionId, row.invoiceNumber, row.status, row.billedAt, row.currencyCode, row.grossCustomerChargeMinor, row.taxMinor, row.payoutCurrencyCode, row.payoutEarningsMinor, row.payoutFeeMinor, row.approvedAdjustmentsMinor]),
    ];
  }
  if (kind === 'budgets') {
    if (data.billing.costs.state !== 'available') return null;
    return [
      ['Budget ID', 'Label', 'Category', 'Currency', 'Monthly budget minor units', 'Created at', 'Updated at', 'Basis'],
      ...data.billing.costs.rows.filter(row => !selectedCurrency || row.currencyCode === selectedCurrency).map(row => [row.id, row.label, row.category, row.currencyCode, row.amountMinor, row.createdAt, row.updatedAt, 'monthly_budget']),
    ];
  }
  if (kind === 'metrics') return [
    ['Metric', 'Value', 'Unit', 'Period start UTC', 'Period end UTC', 'Basis'],
    ['All account profiles (unfiltered)', data.platform.snapshot?.accountTotal ?? null, 'accounts', data.periodStart, data.periodEnd, 'platform_inventory_total_unfiltered'],
    ['All sites (unfiltered)', data.platform.snapshot?.siteTotal ?? null, 'sites', data.periodStart, data.periodEnd, 'platform_inventory_total_unfiltered'],
    ['New account profiles', data.analytics.newAccounts, 'accounts', data.periodStart, data.periodEnd, 'profile_created_at'],
    ['Activation', data.analytics.activation?.rate ?? null, 'percent', data.periodStart, data.periodEnd, 'current_verified_accounts_with_owned_published_site'],
    ...data.analytics.accountGrowth.map(point => ['Account profile creations', point.value, 'accounts', point.date, point.date, 'profile_created_at']),
    ...data.analytics.chargeHistory.filter(series => !selectedCurrency || series.currencyCode === selectedCurrency).flatMap(series => series.points.map(point => ['Completed gross customer charges', point.amountMinor, series.currencyCode + ' minor units', point.date, point.date, 'provider_transactions'])),
  ];
  return null;
};

export function founderCrmRoutes(app: Hono, o: FounderCrmRouteOptions) {
  const reads = throttle(60, 60_000, 100);
  const writes = throttle(30, 60_000, 100);
  const gate = async (c: Context, api = false): Promise<{ identity: VerifiedIdentity } | { response: Response }> => {
    let current: VerifiedIdentity | null;
    try { current = await o.identity(c); } catch { return { response: c.text('Sign-in verification is unavailable. Try again.', 503) }; }
    const access = ownerBillingAccess(current, o.billing.ownerAuthUserIds);
    if (access === 'allowed') return { identity: current! };
    if (access === 'unauthenticated') return { response: api ? c.json({ error: 'authentication_required' }, 401) : c.redirect('/sign-in', 303) };
    return { response: api ? c.json({ error: 'founder_access_required' }, 403) : c.text('This workspace is restricted to the founder.', 403) };
  };
  const load = (current: VerifiedIdentity, query: FounderCrmQuery) => loadFounderCrm(current, {
    billing: o.billing, platform: o.platform, contacts: o.contacts,
  }, query);
  const input = (c: Context, section: CrmSection): FounderCrmPageInput => ({
    section, dataEnvironment: o.dataEnvironment, currencyCode: currency(c.req.query('currency')),
    previewLabel: o.previewLabel,
    editContactId: c.req.query('editContact'), editAccountId: c.req.query('editAccount'),
    ...(c.req.query('new') === '1' ? { draftContact: {} } : {}),
    message: c.req.query('message') === 'contact_saved' ? 'Contact saved.' : undefined,
    costInput: {
      costsEnabled: !!o.billing.costs, editCostId: c.req.query('edit'),
      message: ['saved', 'removed'].includes(c.req.query('message') || '') ? c.req.query('message') : undefined,
    },
  });
  const render = async (c: Context, current: VerifiedIdentity, section: CrmSection, extra: Partial<FounderCrmPageInput> = {}, status: 200 | 422 | 409 | 503 = 200, query = founderCrmQuery(c)) => {
    const data = await load(current, query);
    if ('status' in data) return c.text('CRM data is unavailable. Try again.', 503);
    return c.html(founderCrmPage(identityUser(current), data, { ...input(c, section), ...extra }), status);
  };

  for (const section of sections) app.get('/' + section, async c => {
    const granted = await gate(c);
    if ('response' in granted) return granted.response;
    if (!reads.take(granted.identity.authUserId)) return c.text('Too many refreshes. Try again in a minute.', 429, { 'retry-after': '60' });
    try { return await render(c, granted.identity, section); } catch { return c.text('CRM data is unavailable. Try again.', 503); }
  });
  app.get('/api/crm/summary', async c => {
    const granted = await gate(c, true);
    if ('response' in granted) return granted.response;
    if (!reads.take(granted.identity.authUserId)) return c.json({ error: 'rate_limited' }, 429, { 'retry-after': '60' });
    try { return c.json(await load(granted.identity, founderCrmQuery(c))); } catch { return c.json({ error: 'crm_unavailable' }, 503); }
  });
  app.get('/exports/:name', async c => {
    const kind = c.req.param('name').replace(/\.csv$/, '');
    if (!['customers', 'pipeline', 'payments', 'budgets', 'metrics'].includes(kind) || c.req.param('name') !== kind + '.csv') return c.notFound();
    const granted = await gate(c, true);
    if ('response' in granted) return granted.response;
    if (!reads.take(granted.identity.authUserId)) return c.text('Too many exports. Try again in a minute.', 429, { 'retry-after': '60' });
    try {
      const data = await load(granted.identity, founderCrmQuery(c));
      if ('status' in data) return c.text('Report unavailable.', 503);
      if ((kind === 'customers' || kind === 'metrics') && data.platform.state !== 'available') return c.text('The account data source is unavailable. Retry after it reconnects.', 503);
      if (kind === 'pipeline' && data.crm.state !== 'available') return c.text('CRM storage is unavailable. Try again.', 503);
      const selectedCurrency = currency(c.req.query('currency'));
      const rows = exportRows(kind, data, selectedCurrency);
      if (!rows) return c.text('This report requires its data source to be connected.', 503);
      return c.body(founderCrmCsv(rows), 200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="pagecraft-hq-${kind}-${data.range}.csv"`,
        'x-report-period-start': data.periodStart, 'x-report-period-end': data.periodEnd,
        'x-report-test-records': data.includeTests ? 'included' : 'excluded',
        'x-report-currency': selectedCurrency || 'all',
        'x-report-coverage': (['customers', 'metrics'].includes(kind) && (data.platform.snapshot?.coverage === 'partial' || data.crm.state !== 'available')) || (['payments', 'metrics'].includes(kind) && data.billing.billing.state === 'connected' && data.billing.billing.coverage === 'partial') ? 'partial' : 'complete',
      });
    } catch { return c.text('Report unavailable. Try again.', 503); }
  });

  app.post('/crm/contacts', bodyLimit({ maxSize: 16 * 1024, onError: c => c.text('Request too large.', 413) }), async c => {
    const granted = await gate(c);
    if ('response' in granted) return granted.response;
    let source = c.req.header('origin') || '';
    if (!source) try { source = new URL(c.req.header('referer') || '').origin; } catch { /* Fail closed. */ }
    if (source !== o.origin) return c.json({ error: 'origin_not_allowed' }, 403);
    if (!writes.take(granted.identity.authUserId)) return c.text('Too many changes. Try again in a minute.', 429, { 'retry-after': '60' });
    if (!o.contacts) return c.text('CRM storage is unavailable. Try again later.', 503);
    if (!c.req.header('content-type')?.startsWith('application/x-www-form-urlencoded')) return c.text('Submit contact details using the form.', 415);
    const body = await c.req.parseBody();
    const field = (key: string) => formField(body, key);
    const section: CrmSection = field('returnSection') === 'pipeline' ? 'pipeline' : 'customers';
    const range: CrmRange = field('range') === '90d' || field('range') === '12m' ? field('range') as CrmRange : '30d';
    const query: FounderCrmQuery = { range, includeTests: field('tests') !== 'exclude' };
    const draft: CrmContactInput = {
      ...(field('id') ? { id: field('id') } : {}),
      ...(field('expectedRevision') ? { expectedRevision: Number(field('expectedRevision')) } : {}),
      accountId: field('accountId') || null, name: field('name'), email: field('email'), company: field('company'),
      stage: field('stage') as CrmContactInput['stage'], source: field('source') as CrmContactInput['source'], notes: field('notes'),
      followUpOn: field('followUpOn') || null, isTest: field('isTest') === 'on' || field('isTest') === 'true',
    };
    try {
      // Linked account identity is read-only: annotations cannot rewrite a customer profile.
      if (draft.accountId) {
        const current = await load(granted.identity, { range, includeTests: true });
        if ('status' in current || current.platform.state !== 'available') throw new CrmStoreError('unavailable', 'The account data source is unavailable. Your details were not saved.');
        const account = current.platform.snapshot?.accounts.find(row => row.id === draft.accountId);
        if (!account) throw new CrmStoreError('invalid', 'That account is unavailable. Reload the customer list.');
        draft.name = account.name;
        draft.email = account.email;
      }
      await o.contacts.put(draft);
      const params = new URLSearchParams({ range, tests: query.includeTests ? 'include' : 'exclude', message: 'contact_saved' });
      const code = currency(field('currency'));
      if (code) params.set('currency', code);
      return c.redirect('/' + section + '?' + params, 303);
    } catch (error) {
      const known = error instanceof CrmStoreError;
      const status = known && error.code === 'conflict' ? 409 : known && (error.code === 'invalid' || error.code === 'duplicate') ? 422 : 503;
      const message = known ? error.message : 'Contact storage is unavailable. Your details were not saved.';
      try { return await render(c, granted.identity, section, { draftContact: draft, error: message, currencyCode: currency(field('currency')) }, status, query); }
      catch { return c.text(message, status); }
    }
  });
}
