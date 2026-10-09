import type {
  OwnerBillingLoadResult,
  OwnerCostBudget,
  OwnerMoney,
  OwnerRecurringEstimate,
} from './owner-billing.ts';

type OwnerBillingData = Extract<OwnerBillingLoadResult, { status: 'ok' }>;

export interface OwnerBillingBodyOptions {
  error?: string;
  message?: string;
  editCostId?: string;
  costsEnabled?: boolean;
  draftCost?: {
    id: string;
    label: string;
    category: string;
    amount: string;
    currencyCode: string;
  };
}

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const integer = (value: string): bigint | null => {
  if (!/^-?(0|[1-9]\d*)$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
};

const currencyDigits = (currencyCode: string) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode })
      .resolvedOptions().maximumFractionDigits ?? 2;
  } catch { return 2; }
};

/** Formats integer minor units without ever passing their value through Number. */
export const formatOwnerMoney = (amountMinor: string, currencyCode: string) => {
  const amount = integer(amountMinor);
  if (amount === null) return 'Unavailable';
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const digits = currencyDigits(currencyCode);
  const scale = 10n ** BigInt(digits);
  const major = absolute / scale;
  const fraction = digits ? (absolute % scale).toString().padStart(digits, '0') : '';
  try {
    const format = new Intl.NumberFormat('en', {
      style: 'currency', currency: currencyCode, currencyDisplay: 'code',
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    });
    const integerParts = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
      .formatToParts(major).filter(part => part.type === 'integer' || part.type === 'group');
    const parts = format.formatToParts(negative ? -1 : 1);
    let placedInteger = false;
    return parts.flatMap(part => {
      if (part.type === 'integer' || part.type === 'group') {
        if (placedInteger) return [];
        placedInteger = true;
        return integerParts.map(value => value.value);
      }
      if (part.type === 'fraction') return [fraction];
      return [part.value];
    }).join('');
  } catch {
    const decimal = `${negative ? '-' : ''}${major}${digits ? `.${fraction}` : ''}`;
    return `${currencyCode} ${decimal}`;
  }
};

const majorAmount = (amountMinor: string, currencyCode: string) => {
  const amount = integer(amountMinor);
  if (amount === null) return '';
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const digits = currencyDigits(currencyCode);
  const scale = 10n ** BigInt(digits);
  return `${negative ? '-' : ''}${absolute / scale}${digits ? `.${(absolute % scale).toString().padStart(digits, '0')}` : ''}`;
};

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const time = (iso: string | null, withTime = false) => {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '<span class="pc-owner-muted">Not supplied</span>';
  const label = (withTime ? dateTimeFormat : dateFormat).format(new Date(iso));
  return `<time datetime="${esc(iso)}">${esc(label)}${withTime ? ' UTC' : ''}</time>`;
};

const moneyList = (rows: OwnerMoney[], empty: string) => rows.length
  ? `<ul class="pc-owner-money-list">${rows.map(row => `<li><strong>${esc(formatOwnerMoney(row.amountMinor, row.currencyCode))}</strong></li>`).join('')}</ul>`
  : `<span class="pc-owner-muted">${esc(empty)}</span>`;

const recurringList = (rows: OwnerRecurringEstimate[], kind: 'monthly' | 'annual') => rows.length
  ? `<ul class="pc-owner-money-list">${rows.map(row => `<li><strong>${esc(formatOwnerMoney(kind === 'monthly' ? row.monthlyEstimateMinor : row.annualizedEstimateMinor, row.currencyCode))}</strong></li>`).join('')}</ul>`
  : '<span class="pc-owner-muted">None in the retrieved records</span>';

const categories = ['hosting', 'database', 'email', 'marketing', 'other'] as const;
const commonCurrencies = ['USD', 'PHP', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY', 'BHD'] as const;
const categoryLabel = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);

const knownErrors: Record<string, { message: string; field?: string }> = {
  invalid: { message: 'Check the budget fields and try again.' },
  input_invalid: { message: 'Check the budget fields and try again.' },
  label_invalid: { message: 'Enter a label between 1 and 120 characters.', field: 'cost-label' },
  category_invalid: { message: 'Choose a valid cost category.', field: 'cost-category' },
  amount_invalid: { message: 'Enter a positive amount or zero using the currency’s decimal places. Very large amounts are not supported.', field: 'cost-amount' },
  currency_invalid: { message: 'Choose a supported currency.', field: 'cost-currency' },
  id_invalid: { message: 'That budget row could not be found. Refresh and try again.' },
  cost_row_limit: { message: 'The monthly budget has reached its row limit. Remove an old row before adding another.' },
  unavailable: { message: 'Budget storage is unavailable. No change was saved.' },
  not_found: { message: 'That budget row no longer exists.' },
};
const knownMessages: Record<string, string> = {
  saved: 'Monthly budget saved.',
  updated: 'Monthly budget updated.',
  removed: 'Monthly budget removed.',
};

const feedback = (options: OwnerBillingBodyOptions) => {
  const error = options.error ? (knownErrors[options.error] || { message: 'The budget change could not be completed. Try again.' }) : null;
  const message = options.message ? (knownMessages[options.message] || 'Budget change completed.') : '';
  if (error) return `<p class="notice error pc-owner-notice" role="alert" tabindex="-1" data-owner-feedback${error.field ? ` data-error-field="${error.field}"` : ''}>${esc(error.message)}</p>`;
  return message ? `<p class="notice pc-owner-notice success" role="status" tabindex="-1" data-owner-feedback>${esc(message)}</p>` : '';
};

const statusBadge = (data: OwnerBillingData) => {
  const billing = data.billing;
  if (billing.state === 'connected') {
    return billing.environment === 'sandbox'
      ? '<span class="pc-owner-badge sandbox">Sandbox · test data</span>'
      : '<span class="pc-owner-badge connected">Live connection</span>';
  }
  if (billing.state === 'unavailable') return '<span class="pc-owner-badge warning">Paddle unavailable</span>';
  return '<span class="pc-owner-badge neutral">Paddle not connected</span>';
};

const overview = (data: OwnerBillingData) => {
  const billing = data.billing;
  const account = data.platform.accountCount === null
    ? '<strong>Unavailable</strong><small>The account metric is not configured or could not be read.</small>'
    : `<strong>${data.platform.accountCount.toLocaleString('en')}</strong><small>Known Pagecraft accounts</small>`;
  const sites = data.platform.siteCount === null
    ? '<strong>Unavailable</strong><small>The site metric could not be read.</small>'
    : `<strong>${data.platform.siteCount.toLocaleString('en')}</strong><small>All site records, including QA sites</small>`;
  const provider = billing.state === 'connected'
    ? `<strong>${billing.environment === 'sandbox' ? 'Sandbox' : 'Live'}</strong><small>${billing.coverage === 'complete' ? 'Complete retrieved coverage' : 'Partial retrieved coverage'}</small>`
    : billing.state === 'unavailable'
      ? '<strong>Unavailable</strong><small>Paddle could not be read. Billing totals are withheld.</small>'
      : '<strong>Not connected</strong><small>No provider revenue or paid transaction total is available.</small>';
  return `<section class="pc-owner-section" id="overview" aria-labelledby="overview-title"><div class="pc-owner-section-head"><div><h2 id="overview-title">Overview</h2><p>Platform inventory and the current billing data source.</p></div><span class="pc-owner-asof">As of ${time(data.generatedAt, true)}</span></div><dl class="pc-owner-metrics"><div><dt>Sites</dt><dd>${sites}</dd></div><div><dt>Accounts</dt><dd>${account}</dd></div><div><dt>Paddle</dt><dd>${provider}</dd></div></dl></section>`;
};

const billingUnavailable = (data: OwnerBillingData) => {
  if (data.billing.state === 'connected') return '';
  if (data.billing.state === 'not_connected') {
    return '<div class="pc-owner-state"><h3>Paddle is not connected</h3><p>Subscription, transaction, revenue, payout, tax, fee, and refund data cannot be shown until the private server connection is configured.</p></div>';
  }
  return `<div class="pc-owner-state error"><h3>Paddle data is temporarily unavailable</h3><p>${data.billing.reason === 'provider_response_invalid' ? 'The provider returned data Pagecraft could not safely use.' : 'The provider could not be reached.'} Existing totals are hidden to avoid showing stale or false zero values.</p><a class="pc-btn" href="/owner/billing">Retry</a></div>`;
};

const subscriptions = (data: OwnerBillingData) => {
  const billing = data.billing;
  if (billing.state !== 'connected') return `<section class="pc-owner-section" id="subscriptions" aria-labelledby="subscriptions-title"><div class="pc-owner-section-head"><div><h2 id="subscriptions-title">Subscriptions</h2><p>Active and past-due recurring estimates.</p></div></div>${billingUnavailable(data)}</section>`;
  const rows = billing.subscriptions.map(row => `<tr><td><code>${esc(row.id)}</code></td><td><span class="pc-owner-status ${row.status === 'past_due' ? 'risk' : ''}">${esc(row.status === 'past_due' ? 'Past due' : 'Active')}</span></td><td>${esc(`${row.billingFrequency} ${row.billingInterval}${row.billingFrequency === 1 ? '' : 's'}`)}</td><td>${time(row.nextBilledAt)}</td><td>${row.scheduledChange ? esc(categoryLabel(row.scheduledChange)) : '<span class="pc-owner-muted">None</span>'}</td></tr>`).join('');
  return `<section class="pc-owner-section" id="subscriptions" aria-labelledby="subscriptions-title"><div class="pc-owner-section-head"><div><h2 id="subscriptions-title">Subscriptions</h2><p>Catalog-price estimates; past-due value stays separate from active value.</p></div></div><div class="pc-owner-summary-grid"><div><span>Active monthly estimate</span>${recurringList(billing.activeRecurringEstimate, 'monthly')}</div><div><span>Active annualized estimate</span>${recurringList(billing.activeRecurringEstimate, 'annual')}</div><div><span>Past-due monthly estimate</span>${recurringList(billing.atRiskRecurringEstimate, 'monthly')}</div></div><p class="pc-owner-note">${esc(billing.recurringEstimateNote)}</p><div class="pc-sub-table-wrap"><table class="pc-sub-table" aria-label="Current Paddle subscriptions"><thead><tr><th>Subscription ID</th><th>Status</th><th>Cycle</th><th>Next billing</th><th>Scheduled change</th></tr></thead><tbody>${rows || '<tr><td colspan="5"><div class="pc-list-empty"><strong>No current subscriptions</strong><p>No active or past-due subscriptions were returned.</p></div></td></tr>'}</tbody></table></div></section>`;
};

const payments = (data: OwnerBillingData) => {
  const billing = data.billing;
  if (billing.state !== 'connected') return `<section class="pc-owner-section" id="payments" aria-labelledby="payments-title"><div class="pc-owner-section-head"><div><h2 id="payments-title">Payments</h2><p>Completed customer charges and provider payout details.</p></div></div>${billingUnavailable(data)}</section>`;
  const completed = billing.recentTransactions.filter(row => row.status === 'completed');
  const rows = completed.map(row => {
    const payoutCode = row.payoutCurrencyCode || row.currencyCode;
    return `<tr><td><strong>${row.invoiceNumber ? esc(row.invoiceNumber) : 'No invoice'}</strong><code>${esc(row.id)}</code></td><td>${time(row.billedAt)}</td><td>${row.grossCustomerChargeMinor === null ? '<span class="pc-owner-muted">Not supplied</span>' : esc(formatOwnerMoney(row.grossCustomerChargeMinor, row.currencyCode))}</td><td>${row.taxMinor === null ? '<span class="pc-owner-muted">Not supplied</span>' : esc(formatOwnerMoney(row.taxMinor, row.currencyCode))}</td><td>${row.payoutEarningsMinor === null ? '<span class="pc-owner-muted">Pending provider data</span>' : esc(formatOwnerMoney(row.payoutEarningsMinor, payoutCode))}</td><td>${row.payoutFeeMinor === null ? '<span class="pc-owner-muted">Pending provider data</span>' : esc(formatOwnerMoney(row.payoutFeeMinor, payoutCode))}</td><td>${row.approvedAdjustmentsMinor === null ? '<span class="pc-owner-muted">None returned</span>' : esc(formatOwnerMoney(row.approvedAdjustmentsMinor, row.currencyCode))}</td></tr>`;
  }).join('');
  const partial = billing.coverage === 'partial'
    ? `<div class="pc-owner-warning" role="status"><strong>Partial provider data</strong><p>${esc(billing.coverageNote || 'Some provider records could not be included.')}</p></div>` : '';
  return `<section class="pc-owner-section" id="payments" aria-labelledby="payments-title"><div class="pc-owner-section-head"><div><h2 id="payments-title">Payments</h2><p>Completed transactions from ${time(billing.period.startsAt)} to ${time(billing.period.endsAt)}.</p></div></div>${partial}<div class="pc-owner-summary-grid payments"><div><span>Gross customer charges</span>${moneyList(billing.completedGrossCustomerCharges, 'No completed charges')}</div><div><span>Payout earnings</span>${moneyList(billing.completedPayoutEarnings, 'No payout totals supplied')}</div><div><span>Payout fees</span>${moneyList(billing.completedPayoutFees, 'No payout fees supplied')}</div><div><span>Tax</span>${moneyList(billing.completedTax, 'No completed tax')}</div><div><span>Approved refunds / adjustments</span>${moneyList(billing.approvedAdjustments, 'None returned')}</div></div><p class="pc-owner-note">${esc(billing.financialDataNote)}</p><div class="pc-sub-table-wrap"><table class="pc-sub-table pc-owner-payments" aria-label="Recent completed Paddle transactions"><thead><tr><th>Receipt</th><th>Billed</th><th>Gross</th><th>Tax</th><th>Payout</th><th>Fee</th><th>Refunds / adjustments</th></tr></thead><tbody>${rows || '<tr><td colspan="7"><div class="pc-list-empty"><strong>No completed transactions</strong><p>No completed receipts were returned for this period.</p></div></td></tr>'}</tbody></table></div></section>`;
};

const disconnectedBilling = (data: OwnerBillingData) => `<section class="pc-owner-section" id="billing-data" aria-labelledby="billing-data-title"><div class="pc-owner-section-head"><div><h2 id="billing-data-title">Subscriptions &amp; payments</h2><p>Provider subscription, charge, tax, fee, payout, and refund data.</p></div></div>${billingUnavailable(data)}</section>`;

const gettingStarted = `<section class="pc-owner-section pc-owner-start" id="start" aria-labelledby="start-title"><div class="pc-owner-section-head"><div><h2 id="start-title">Getting started</h2><p>Set up and test Paddle before any live payment is accepted.</p></div></div><ol><li><span>1</span><div><h3>Create both Paddle accounts</h3><p>Create your <a href="https://login.paddle.com" target="_blank" rel="noopener">live account</a> and a separate <a href="https://sandbox-login.paddle.com" target="_blank" rel="noopener">sandbox account</a>.</p></div></li><li><span>2</span><div><h3>Prepare the product for review</h3><p>Set up products and pricing, confirm terms, privacy, and refund policies, then submit production checkout domains for approval.</p></div></li><li><span>3</span><div><h3>Test the complete sandbox flow</h3><p>Connect the sandbox securely, test checkout and verified webhooks, then enable live billing only after those checks pass.</p></div></li></ol><p class="pc-owner-note">This dashboard reports billing data. Checkout and paid-plan activation still need to be implemented.</p></section>`;

const costForm = (
  edit: OwnerCostBudget | undefined,
  enabled: boolean,
  options: Pick<OwnerBillingBodyOptions, 'error' | 'editCostId' | 'draftCost'>,
) => {
  if (!enabled) return '<div class="pc-owner-state"><h3>Budget editing is disabled</h3><p>The monthly budget can be reviewed here, but changes are disabled in this environment.</p></div>';
  if (options.editCostId && !edit && !options.draftCost) {
    return '<div class="pc-owner-state error"><h3>Budget row not found</h3><p>This row may have been removed or the edit link may be stale.</p><a class="pc-btn" href="/owner/billing#costs">Return to budgets</a></div>';
  }
  const field = options.error ? knownErrors[options.error]?.field : undefined;
  const draft = options.draftCost;
  const id = draft ? draft.id : edit?.id || '';
  const label = draft ? draft.label : edit?.label || '';
  const category = draft ? draft.category : edit?.category || 'hosting';
  const currency = draft ? draft.currencyCode : edit?.currencyCode || 'USD';
  const amount = draft ? draft.amount : edit ? majorAmount(edit.amountMinor, edit.currencyCode) : '';
  const editing = Boolean(id || edit);
  const invalid = (id: string) => field === id ? ` aria-invalid="true" aria-describedby="cost-form-feedback${id === 'cost-amount' ? ' cost-amount-help' : ''}"` : id === 'cost-amount' ? ' aria-describedby="cost-amount-help"' : '';
  const categoryOptions = `${categories.includes(category as typeof categories[number]) ? '' : '<option value="" selected>Choose category</option>'}${categories.map(value => `<option value="${value}"${category === value ? ' selected' : ''}>${categoryLabel(value)}</option>`).join('')}`;
  const validCurrency = Intl.supportedValuesOf('currency').includes(currency);
  const currencyOptions = `${validCurrency && !commonCurrencies.includes(currency as typeof commonCurrencies[number]) ? `<option value="${esc(currency)}" selected>${esc(currency)}</option>` : ''}${validCurrency ? '' : '<option value="" selected>Choose currency</option>'}${commonCurrencies.map(value => `<option value="${value}"${currency === value ? ' selected' : ''}>${value}</option>`).join('')}`;
  const digits = validCurrency ? currencyDigits(currency) : 2;
  const amountPattern = digits === 0 ? '[0-9]+' : `[0-9]+([.][0-9]{1,${digits}})?`;
  const amountHelp = validCurrency ? `${currency} ${digits === 0 ? 'uses whole amounts' : `allows up to ${digits} decimal place${digits === 1 ? '' : 's'}`}.` : 'Choose a currency to confirm the allowed decimal places.';
  return `<form class="pc-owner-cost-form" method="post" action="/owner/billing/costs" data-owner-cost-form>${id ? `<input type="hidden" name="id" value="${esc(id)}">` : ''}<div class="pc-owner-fields"><div class="pc-site-setting-field"><label for="cost-label">Label</label><input id="cost-label" name="label" maxlength="120" required value="${esc(label)}"${invalid('cost-label')}></div><div class="pc-site-setting-field"><label for="cost-category">Category</label><select id="cost-category" name="category" required${invalid('cost-category')}>${categoryOptions}</select></div><div class="pc-site-setting-field"><label for="cost-amount">Monthly budget</label><input id="cost-amount" name="amount" inputmode="decimal" autocomplete="off" required pattern="${amountPattern}" placeholder="${digits ? `0.${'0'.repeat(digits)}` : '0'}" value="${esc(amount)}"${invalid('cost-amount')}><small id="cost-amount-help" data-currency-help>${esc(amountHelp)}</small></div><div class="pc-site-setting-field"><label for="cost-currency">Currency</label><select id="cost-currency" name="currencyCode" required${invalid('cost-currency')}>${currencyOptions}</select></div></div><div class="pc-owner-form-foot"><p id="cost-form-feedback" class="pc-action-status" role="status" aria-live="polite">Budgets are planning figures, not actual expenses.</p><div class="pc-field-actions flush">${editing ? '<a class="pc-btn" href="/owner/billing#costs">Cancel</a>' : ''}<button class="pc-btn primary" type="submit">${editing ? 'Update budget' : 'Add budget'}</button></div></div></form>`;
};

const costs = (data: OwnerBillingData, options: OwnerBillingBodyOptions) => {
  const enabled = options.costsEnabled !== false;
  if (data.costs.state === 'unavailable') return `<section class="pc-owner-section" id="costs" aria-labelledby="costs-title"><div class="pc-owner-section-head"><div><h2 id="costs-title">Monthly cost budget</h2><p>Planning figures by currency. These are not actual expenses.</p></div></div>${feedback(options)}<div class="pc-owner-state error"><h3>Budget data is unavailable</h3><p>Stored budget rows could not be read. No total or editable form is shown.</p><a class="pc-btn" href="/owner/billing#costs">Retry</a></div></section>`;
  const edit = options.editCostId ? data.costs.rows.find(row => row.id === options.editCostId) : undefined;
  const rows = data.costs.rows.map(row => `<tr><td><strong>${esc(row.label)}</strong></td><td>${esc(categoryLabel(row.category))}</td><td>${esc(formatOwnerMoney(row.amountMinor, row.currencyCode))}</td><td>${time(row.updatedAt)}</td><td>${enabled ? `<div class="pc-owner-row-actions"><a class="pc-btn" href="/owner/billing?edit=${encodeURIComponent(row.id)}#costs" aria-label="Edit ${esc(row.label)} budget">Edit</a><form method="post" action="/owner/billing/costs/${encodeURIComponent(row.id)}/remove" data-owner-remove><button class="pc-btn danger" type="submit" aria-label="Remove ${esc(row.label)} budget">Remove</button></form></div>` : '<span class="pc-owner-muted">Read only</span>'}</td></tr>`).join('');
  return `<section class="pc-owner-section" id="costs" aria-labelledby="costs-title"><div class="pc-owner-section-head"><div><h2 id="costs-title">Monthly cost budget</h2><p>Planning figures by currency. They are not actual expenses and are not used to calculate profit.</p></div><div class="pc-owner-totals"><span>Monthly budget total</span>${moneyList(data.costs.totals, 'No budget rows')}</div></div>${feedback(options)}${costForm(edit, enabled, options)}<div class="pc-sub-table-wrap"><table class="pc-sub-table" aria-label="Monthly cost budget"><thead><tr><th>Cost</th><th>Category</th><th>Monthly budget</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="5"><div class="pc-list-empty"><strong>No monthly budgets</strong><p>Add planned recurring costs when they are known.</p></div></td></tr>'}</tbody></table></div></section>`;
};

const styles = `<style>
.pc-owner-billing{width:100%;max-width:1320px;margin:0 auto}.pc-owner-billing>.pc-workspace-body{padding:0 var(--pc-workspace-x) 40px}.dashboard-app .pc-owner-billing .pc-workspace-head{align-items:flex-end;margin:0}.pc-owner-heading-line{display:flex;align-items:center;flex-wrap:wrap;gap:12px}.pc-owner-nav{display:flex;align-items:center;gap:4px;padding:5px;border:1px solid var(--pc-line);border-radius:8px;background:var(--pc-field)}.pc-owner-nav a{padding:7px 10px;border-radius:5px;color:var(--pc-text-2);font:var(--pc-type-control);text-decoration:none}.pc-owner-nav a:hover,.pc-owner-nav a:focus-visible{background:var(--pc-hover-bg);color:var(--pc-text)}.pc-owner-badge{display:inline-flex;align-items:center;gap:7px;width:max-content;padding:5px 9px;border:1px solid var(--pc-line);border-radius:999px;font:var(--pc-type-label);white-space:nowrap}.pc-owner-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:#767d77}.pc-owner-badge.connected:before{background:#73b82b}.pc-owner-badge.sandbox{border-color:#b98534;background:#fff8e8;color:#6c4714}.pc-owner-badge.sandbox:before,.pc-owner-badge.warning:before{background:#c57d1b}.pc-owner-section{padding:32px 0;border-bottom:1px solid var(--pc-line);scroll-margin-top:76px}.pc-owner-section:last-child{border-bottom:0}.pc-owner-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;margin-bottom:22px}.pc-owner-section-head h2{margin:0;font-size:var(--pc-section-title)}.pc-owner-section-head p{margin:5px 0 0;max-width:72ch;font:var(--pc-type-description)}.pc-owner-asof{color:var(--pc-text-2);font:var(--pc-type-description);white-space:nowrap}.pc-owner-metrics,.pc-owner-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0;border-top:1px solid var(--pc-line);border-bottom:1px solid var(--pc-line)}.pc-owner-metrics>div,.pc-owner-summary-grid>div{min-width:0;padding:18px 20px}.pc-owner-metrics>div+div,.pc-owner-summary-grid>div+div{border-left:1px solid var(--pc-line)}.pc-owner-metrics dt,.pc-owner-summary-grid>div>span,.pc-owner-totals>span{display:block;color:var(--pc-text-2);font:var(--pc-type-label)}.pc-owner-metrics dd{display:grid;gap:4px;margin:7px 0 0}.pc-owner-metrics strong{font-size:1.2rem;letter-spacing:-.02em}.pc-owner-metrics small{color:var(--pc-text-2);font:var(--pc-type-description)}.pc-owner-summary-grid.payments{grid-template-columns:repeat(5,minmax(0,1fr))}.pc-owner-summary-grid .pc-owner-money-list{margin-top:8px}.pc-owner-money-list{display:grid;gap:3px;margin:0;padding:0;list-style:none}.pc-owner-money-list strong{font-size:.9rem;font-weight:650;white-space:nowrap}.pc-owner-note{margin:14px 0 20px;max-width:100ch;font:var(--pc-type-description)}.pc-owner-state{padding:20px;border:1px solid var(--pc-line);border-radius:8px;background:var(--pc-surface-subtle)}.pc-owner-state.error{border-color:#d6aaa5;background:#fff7f5}.pc-owner-state h3{margin:0;font-size:.9rem}.pc-owner-state p{margin:5px 0 0;max-width:78ch;font:var(--pc-type-description)}.pc-owner-state .pc-btn{margin-top:14px}.pc-owner-warning,.pc-owner-notice{margin:0 0 20px;padding:13px 15px;border-left:3px solid #bd791e;background:#fff8e8}.pc-owner-warning strong{font-size:.8rem}.pc-owner-warning p{margin:3px 0 0;font:var(--pc-type-description)}.pc-owner-notice.success{border-left-color:#5d9224;background:#f5f9ed}.pc-owner-notice.error{border-left-color:var(--pc-danger);background:#fff3f1;color:#7c2721}.pc-owner-muted{color:var(--pc-text-2);font:var(--pc-type-description)}.pc-owner-billing code{display:block;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.7rem;color:var(--pc-text-2)}.pc-owner-status{display:inline-flex;padding:3px 7px;border-radius:999px;background:#eef7dd;color:#365a16;font:var(--pc-type-label);white-space:nowrap}.pc-owner-status.risk{background:#fff0ed;color:#8a342c}.pc-owner-billing .pc-sub-table-wrap{overflow-x:auto}.pc-owner-billing .pc-owner-notice{margin:0 0 20px;padding:13px 15px}.pc-owner-payments{min-width:960px}.pc-owner-start ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0;padding:0;border-top:1px solid var(--pc-line);border-bottom:1px solid var(--pc-line);list-style:none}.pc-owner-start li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:12px;padding:18px 20px}.pc-owner-start li+li{border-left:1px solid var(--pc-line)}.pc-owner-start li>span{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:var(--pc-green);font:var(--pc-type-label);font-weight:700}.pc-owner-start h3{margin:2px 0 4px;font-size:.85rem}.pc-owner-start li p{margin:0;font:var(--pc-type-description)}.pc-owner-start a{text-underline-offset:2px}.pc-owner-cost-form{display:grid;gap:18px;margin:0 0 24px;padding:20px;border:1px solid var(--pc-line);border-radius:8px;background:var(--pc-surface-subtle)}.pc-owner-fields{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(150px,.7fr) minmax(160px,.75fr) minmax(120px,.5fr);gap:var(--pc-field-gap)}.pc-owner-cost-form .pc-site-setting-field{display:grid;align-content:start;gap:var(--pc-field-label-gap);color:var(--pc-text-2);font:var(--pc-type-label)}.pc-owner-cost-form :is(input,select){width:100%;min-height:var(--pc-control-height);padding:var(--pc-control-padding);border:1px solid var(--pc-line-2);border-radius:var(--pc-control-radius);background:var(--pc-field);color:var(--pc-text);font:var(--pc-type-input)}.pc-owner-cost-form [aria-invalid=true]{border-color:var(--pc-danger);box-shadow:0 0 0 1px var(--pc-danger)}.pc-owner-form-foot{display:flex;align-items:center;justify-content:space-between;gap:20px}.pc-owner-form-foot .pc-action-status{margin:0;color:var(--pc-text-2)}.pc-owner-totals{text-align:right}.pc-owner-totals .pc-owner-money-list{margin-top:4px}.pc-owner-row-actions{display:flex;align-items:center;gap:var(--pc-action-gap)}.pc-owner-row-actions form{margin:0}.pc-owner-row-actions .pc-btn{height:var(--pc-control-row);min-height:var(--pc-control-row);white-space:nowrap}@media(max-width:1050px){.pc-owner-summary-grid.payments{grid-template-columns:repeat(3,minmax(0,1fr))}.pc-owner-summary-grid.payments>div:nth-child(4){border-left:0;border-top:1px solid var(--pc-line)}.pc-owner-summary-grid.payments>div:nth-child(5){border-top:1px solid var(--pc-line)}.pc-owner-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:840px){.dashboard-app .pc-owner-billing .pc-workspace-head{align-items:flex-start}.pc-owner-nav{width:100%;overflow-x:auto}.pc-owner-metrics,.pc-owner-summary-grid{grid-template-columns:1fr}.pc-owner-summary-grid.payments{grid-template-columns:repeat(2,minmax(0,1fr))}.pc-owner-metrics>div+div,.pc-owner-summary-grid>div+div{border-left:0;border-top:1px solid var(--pc-line)}.pc-owner-summary-grid.payments>div:nth-child(2n){border-left:1px solid var(--pc-line)}.pc-owner-start ol{grid-template-columns:1fr}.pc-owner-start li+li{border-left:0;border-top:1px solid var(--pc-line)}.pc-owner-section-head{flex-wrap:wrap}.pc-owner-form-foot{align-items:flex-start;flex-direction:column}.pc-owner-totals{text-align:left}}
</style>`;

const script = `<script>(()=>{const feedback=document.querySelector('[data-owner-feedback]');if(feedback){feedback.focus();const field=feedback.dataset.errorField&&document.getElementById(feedback.dataset.errorField);if(field)field.focus();}document.querySelectorAll('[data-owner-cost-form]').forEach(form=>{const amount=form.querySelector('#cost-amount'),currency=form.querySelector('#cost-currency'),help=form.querySelector('[data-currency-help]');const precision=()=>{if(!amount||!currency||!help||!currency.value)return;let digits=2;try{digits=new Intl.NumberFormat(undefined,{style:'currency',currency:currency.value}).resolvedOptions().maximumFractionDigits??2;}catch{}amount.pattern=digits===0?'[0-9]+':'[0-9]+([.][0-9]{1,'+digits+'})?';amount.placeholder=digits?'0.'+'0'.repeat(digits):'0';help.textContent=currency.value+' '+(digits===0?'uses whole amounts.':'allows up to '+digits+' decimal place'+(digits===1?'':'s')+'.');};currency?.addEventListener('change',precision);form.addEventListener('invalid',event=>{const output=form.querySelector('#cost-form-feedback');if(output)output.textContent=event.target.validationMessage;},{capture:true});form.addEventListener('input',event=>{event.target.removeAttribute('aria-invalid');const output=form.querySelector('#cost-form-feedback');if(output)output.textContent='Budgets are planning figures, not actual expenses.';});});})();</script>`;

export function ownerBillingBody(
  data: OwnerBillingData,
  options: OwnerBillingBodyOptions = {},
): string {
  const connected = data.billing.state === 'connected';
  const showStart = data.billing.state === 'not_connected';
  const navigation = connected
    ? '<a href="#overview">Overview</a><a href="#subscriptions">Subscriptions</a><a href="#payments">Payments</a><a href="#costs">Costs</a>'
    : `<a href="#overview">Overview</a><a href="#costs">Costs</a>${showStart ? '<a href="#start">Start</a>' : ''}`;
  const billing = connected ? `${subscriptions(data)}${payments(data)}` : disconnectedBilling(data);
  return `${styles}<section class="pc-owner-billing" aria-labelledby="owner-billing-title"><header class="pc-workspace-head"><div><div class="pc-owner-heading-line"><h1 id="owner-billing-title">Owner billing</h1>${statusBadge(data)}</div><p>Private operational view of Pagecraft subscriptions, completed payments, and monthly cost budgets.</p></div><nav class="pc-owner-nav" aria-label="Billing sections">${navigation}</nav></header><div class="pc-workspace-body">${overview(data)}${billing}${costs(data, options)}${showStart ? gettingStarted : ''}</div></section>${script}`;
}
