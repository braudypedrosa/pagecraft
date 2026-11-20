import { PASSWORD_TOGGLE_CSS, PASSWORD_TOGGLE_SCRIPT } from './password-toggle.ts';
import { UI_FONTS_CSS } from '../../shared/ui-fonts.js';
import { UI_TOKENS_CSS } from '../../shared/ui-tokens.js';
import { CUSTOM_SELECT_CSS, CUSTOM_SELECT_BOOT_SCRIPT } from '../../shared/custom-select.js';
import { CLOUD_HEADER_CSS, cloudHeader } from './cloud-header.ts';
import type { User } from './auth.ts';
import type {
  CrmContactInput, CrmCustomer, CrmMoneySeries, CrmSection, FounderCrmData,
  CrmSupportInbox, FounderCrmPageInput,
} from './founder-crm-types.ts';
import { CRM_SOURCES, CRM_STAGES } from './founder-crm-types.ts';
import { formatOwnerMoney } from './owner-billing-page.ts';
import { founderCrmInsights } from './founder-crm-insights.ts';
import type { CrmChartSpec } from './founder-crm-client/charts.ts';

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const enc = (value: unknown) => encodeURIComponent(String(value ?? ''));
const label = (value: string) => value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const integer = (value: string) => /^-?(0|[1-9]\d*)$/.test(value);

const compactMoneyAxis = (amountMinor: string, currencyCode: string) => {
  if (!integer(amountMinor)) return 'Unavailable';
  let digits = 2;
  try { digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2; } catch { /* default */ }
  const amount = BigInt(amountMinor), negative = amount < 0n, absolute = negative ? -amount : amount;
  const major = absolute / (10n ** BigInt(digits));
  const majorText = major.toString();
  if (majorText.length <= 6) return formatOwnerMoney(amountMinor, currencyCode);
  const leading = `${majorText[0]}${majorText.slice(1, 3).replace(/0+$/, '') ? `.${majorText.slice(1, 3).replace(/0+$/, '')}` : ''}`;
  return `${currencyCode} ${negative ? '-' : ''}${leading}e${majorText.length - 1}`;
};

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
});
const date = (value: string | null, withTime = false) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '<span class="muted">Not supplied</span>';
  const formatted = (withTime ? dateTimeFormatter : dateFormatter).format(new Date(value));
  return `<time datetime="${esc(value)}">${esc(formatted)}${withTime ? ' UTC' : ''}</time>`;
};

const number = (value: number | null) => value === null || !Number.isFinite(value)
  ? 'Unavailable' : Math.max(0, Math.trunc(value)).toLocaleString('en');

const rangeBasis = (range: FounderCrmData['range']) => range === '30d'
  ? 'Past 30 days; daily UTC buckets may include partial boundary days' : range === '90d'
    ? 'Past 90 days; weekly UTC buckets may include partial boundary weeks'
    : 'Past year (365 days); monthly UTC buckets may include partial boundary months';

const environment = (value: FounderCrmPageInput['dataEnvironment']) => value === 'production'
  ? ['production', 'Production data'] : value === 'staging'
    ? ['staging', 'Staging data'] : ['unconfigured', 'Data source unconfigured'];

const query = (data: FounderCrmData, currencyCode?: string) =>
  `range=${enc(data.range)}&amp;tests=${data.includeTests ? 'include' : 'exclude'}${currencyCode ? `&amp;currency=${enc(currencyCode)}` : ''}`;

const path = (section: CrmSection, data: FounderCrmData, currencyCode?: string, extra = '') =>
  `/${section}?${query(data, currencyCode)}${extra.replace(/^&/, '&amp;')}`;

const mutationPath = (base: string, data: FounderCrmData, currencyCode: string) =>
  `${base}?${query(data, currencyCode)}`;

const moneyFor = <T extends { currencyCode: string; amountMinor: string }>(rows: T[], currency: string) =>
  rows.find(row => row.currencyCode === currency)?.amountMinor ?? null;

const recurringFor = (
  rows: { currencyCode: string; monthlyEstimateMinor: string; annualizedEstimateMinor: string }[],
  currency: string,
) => rows.find(row => row.currencyCode === currency) ?? null;

const currencies = (data: FounderCrmData) => {
  const found = new Set<string>();
  if (data.billing.billing.state === 'connected') {
    const billing = data.billing.billing;
    for (const row of [...billing.activeRecurringEstimate, ...billing.atRiskRecurringEstimate,
      ...billing.completedGrossCustomerCharges, ...billing.completedTax,
      ...billing.completedPayoutEarnings, ...billing.completedPayoutFees,
      ...billing.approvedAdjustments]) found.add(row.currencyCode);
    for (const series of data.analytics.chargeHistory) found.add(series.currencyCode);
  }
  if (data.billing.costs.state === 'available') {
    for (const row of data.billing.costs.rows) found.add(row.currencyCode);
  }
  return [...found].sort();
};

const selectedCurrency = (data: FounderCrmData, requested?: string) => {
  const available = currencies(data);
  return requested && available.includes(requested) ? requested : available[0] || 'USD';
};

const status = (state: 'available' | 'unavailable' | 'not_connected') => state === 'available'
  ? '<span class="status ok">Available</span>' : state === 'unavailable'
    ? '<span class="status warn">Unavailable</span>' : '<span class="status quiet">Not connected</span>';

const notice = (input: FounderCrmPageInput) => {
  if (input.error) return `<p class="notice error" role="alert" tabindex="-1" data-feedback>${esc(input.error)}</p>`;
  return input.message
    ? `<p class="notice success" role="status" tabindex="-1" data-feedback>${esc(input.message)}</p>` : '';
};

type NumberPoint = { date: string; value: number; display?: string };
interface ChartAxisLabels { min?: string; max?: string }

const chartSpec = (spec: CrmChartSpec) => `<script type="application/json" data-chart-spec>${JSON.stringify(spec).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')}</script>`;
const tableHead = (columns: [string, string, string?, boolean?][]) => columns.map(([id, title, kind = 'text', hidden = false]) => `<th data-column="${esc(id)}" data-kind="${esc(kind)}"${hidden ? ' data-default-hidden' : ''}${id === 'actions' ? ' data-export="false" data-sortable="false"' : ''}>${esc(title)}</th>`).join('');
const customerColumns = (identity: string) => tableHead([
  ['name', identity], ['company', 'Company'], ['plan', 'Plan'], ['stage', 'Stage'],
  ['source', 'Source'], ['sites', 'Sites', 'number'], ['followUp', 'Follow-up', 'date'],
  ['published', 'Published sites', 'number'], ['joined', 'Joined', 'date', true],
  ['lastEdited', 'Last site edit', 'date', true], ['media', 'Media bytes', 'number', true],
]);

const chartDate = (value: string) => {
  if (!Number.isFinite(Date.parse(value))) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(value));
};

const lineChart = (
  id: string, heading: string, points: NumberPoint[], empty: string, axis: ChartAxisLabels = {}, spec?: CrmChartSpec,
) => {
  const safe = points.filter(point => Number.isFinite(point.value));
  if (!safe.length) return `<div class="chart-empty"><strong>${esc(heading)}</strong><p>${esc(empty)}</p></div>`;
  const width = 720, height = 190, left = 8, right = 8, top = 8, bottom = 8;
  const values = safe.map(point => point.value);
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const span = max - min;
  const plotBottom = height - bottom;
  const x = (index: number) => safe.length === 1 ? width / 2
    : left + index * ((width - left - right) / (safe.length - 1));
  const y = (value: number) => span === 0 ? plotBottom
    : top + (max - value) / span * (height - top - bottom);
  const zeroLine = y(0);
  const pathData = safe.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`).join(' ');
  const area = `${pathData} L${x(safe.length - 1).toFixed(2)} ${zeroLine.toFixed(2)} L${x(0).toFixed(2)} ${zeroLine.toFixed(2)} Z`;
  const dots = safe.map((point, index) => {
    const accessible = `${point.date}: ${point.display ?? number(point.value)}`;
    return `<g class="chart-point" tabindex="0" role="img" aria-label="${esc(accessible)}"><title>${esc(accessible)}</title><circle class="chart-hit" cx="${x(index).toFixed(2)}" cy="${y(point.value).toFixed(2)}" r="26"/><circle class="chart-dot" cx="${x(index).toFixed(2)}" cy="${y(point.value).toFixed(2)}" r="5"/></g>`;
  }).join('');
  const rows = safe.map((point, index) => `<tr><td>${date(point.date)}</td><td data-value="${esc(spec?.points[index]?.value ?? point.value)}"${spec?.currencyCode ? ` data-currency="${esc(spec.currencyCode)}"` : ''}>${esc(point.display ?? number(point.value))}</td></tr>`).join('');
  const minLabel = axis.min ?? number(min), maxLabel = axis.max ?? number(max);
  const firstDate = chartDate(safe[0].date), lastDate = chartDate(safe[safe.length - 1].date);
  const dateLabels = safe.length === 1
    ? `<span></span><span>${esc(firstDate)}</span><span></span>`
    : `<span>${esc(firstDate)}</span><span></span><span>${esc(lastDate)}</span>`;
  return `<figure class="chart" aria-labelledby="${id}-title" data-crm-chart><figcaption><strong id="${id}-title">${esc(heading)}</strong><span>${esc(safe.length === 1 ? '1 point' : `${safe.length} points`)}</span></figcaption>${chartSpec(spec || { kind: 'line', title: heading, unit: 'count', points: safe.map(point => ({ label: point.date, value: point.value })) })}<div class="chart-library-host" hidden></div><div class="chart-fallback"><div class="chart-plot"><div class="chart-y-axis" aria-hidden="true"><span>${esc(maxLabel)}</span><span>${esc(minLabel)}</span></div><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(`${heading}. Values range from ${minLabel} to ${maxLabel}.`)}"><line x1="${left}" y1="${zeroLine.toFixed(2)}" x2="${width - right}" y2="${zeroLine.toFixed(2)}" class="axis"/><line x1="${left}" y1="${top}" x2="${width - right}" y2="${top}" class="guide"/><path d="${area}" class="area"/><path d="${pathData}" class="line"/>${dots}</svg></div><div class="chart-x-axis" aria-hidden="true">${dateLabels}</div></div><details class="chart-data"><summary>View chart data</summary><div class="table-wrap"><table data-crm-table="${id}-data" aria-label="${esc(heading)} data"><thead><tr>${tableHead([['date', 'Date', 'date'], ['value', 'Value', spec?.unit === 'money' ? 'money' : 'number']])}</tr></thead><tbody>${rows}</tbody></table></div></details></figure>`;
};

const moneyChart = (series: CrmMoneySeries | undefined, currency: string) => {
  if (!series?.points.length) return lineChart('charges-chart', 'Collected customer charges', [],
    'No collected-charge series is available for this currency and period.');
  const amounts = series.points.map(point => integer(point.amountMinor) ? BigInt(point.amountMinor) : null);
  const valid = amounts.filter((amount): amount is bigint => amount !== null);
  if (!valid.length) return lineChart('charges-chart', 'Collected customer charges', [], 'Charge values are unavailable.');
  const lowest = valid.reduce((a, b) => a < b ? a : b), highest = valid.reduce((a, b) => a > b ? a : b);
  const min = lowest < 0n ? lowest : 0n, max = highest > 0n ? highest : 0n;
  const span = max - min;
  const points = series.points.flatMap((point, index) => {
    const amount = amounts[index];
    if (amount === null) return [];
    const scaled = span === 0n ? 0 : Number(((amount - min) * 1_000_000n) / span) / 1_000_000;
    return [{ date: point.date, value: scaled, display: formatOwnerMoney(point.amountMinor, currency) }];
  });
  return lineChart('charges-chart', `Collected customer charges · ${currency}`, points,
    'No collected-charge series is available for this currency and period.', {
      min: compactMoneyAxis(min.toString(), currency), max: compactMoneyAxis(max.toString(), currency),
    }, { kind: 'line', title: `Collected customer charges · ${currency}`, unit: 'money', currencyCode: currency, points: series.points.filter(point => integer(point.amountMinor)).map(point => ({ label: point.date, value: point.amountMinor })) });
};

const barList = (title: string, rows: { label: string; value: number }[], empty: string) => {
  const max = Math.max(1, ...rows.map(row => Math.max(0, row.value)));
  return `<section class="mini" aria-label="${esc(title)}"><figure data-crm-chart><figcaption><h3>${esc(title)}</h3></figcaption>${rows.length
    ? `${chartSpec({kind:title === 'Plan mix' ? 'donut' : 'bar',title,unit:'count',points:rows})}<div class="chart-library-host" hidden></div><div class="chart-fallback"><ol class="bars">${rows.map(row => `<li><span>${esc(row.label)}</span><i aria-hidden="true"><b style="--value:${Math.round(Math.max(0, row.value) / max * 100)}%"></b></i><strong>${number(row.value)}</strong></li>`).join('')}</ol></div><details class="chart-data"><summary>View chart data</summary><div class="table-wrap"><table data-crm-table="${esc(title.toLowerCase().replaceAll(' ', '-'))}-data" aria-label="${esc(title)} data"><thead><tr>${tableHead([['label','Category'],['value','Records','number']])}</tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.label)}</td><td data-value="${esc(row.value)}">${number(row.value)}</td></tr>`).join('')}</tbody></table></div></details>`
    : `<p class="empty-copy">${esc(empty)}</p>`}</figure></section>`;
};

const topStats = (data: FounderCrmData, currency: string) => {
  const recurring = data.billing.billing.state === 'connected'
    ? recurringFor(data.billing.billing.activeRecurringEstimate, currency) : null;
  const activated = data.analytics.activation?.publishedAccounts ?? null;
  const visibleAccountIds = new Set(data.customers.flatMap(customer => customer.accountId ? [customer.accountId] : []));
  const visibleAccounts = data.platform.state === 'available' && data.platform.snapshot
    ? data.platform.snapshot.accounts.filter(account => data.includeTests || visibleAccountIds.has(account.id)).length : null;
  const visibleSites = data.platform.state === 'available' && data.platform.snapshot
    ? data.platform.snapshot.sites.filter(site => data.includeTests || site.ownerIds.length === 0 ||
      site.ownerIds.some(ownerId => visibleAccountIds.has(ownerId))).length : null;
  const partial = data.platform.snapshot?.coverage === 'partial';
  const scope = data.includeTests ? 'including test records' : 'excluding test records';
  return `<dl class="top-stats"><div><dt>${partial ? 'Retrieved accounts' : 'Accounts in view'}</dt><dd>${number(visibleAccounts)}</dd><small>${esc(`Pagecraft profiles ${scope}${partial ? ' · partial feed' : ''}`)}</small></div><div><dt>${partial ? 'Retrieved sites' : 'Sites in view'}</dt><dd>${number(visibleSites)}</dd><small>${esc(`Owned site records ${scope}${partial ? ' · partial feed' : ''}`)}</small></div><div><dt>Activated accounts</dt><dd>${number(activated)}</dd><small>Accounts in view with a published site</small></div><div><dt>Current recurring estimate</dt><dd>${recurring ? esc(formatOwnerMoney(recurring.monthlyEstimateMinor, currency)) : 'Unavailable'}</dd><small>Monthly catalog-price estimate · ${esc(currency)}</small></div></dl>`;
};

const decisionStrip = (data: FounderCrmData, currency: string) => {
  const insights = founderCrmInsights(data);
  return `<section class="hq-insight-strip" aria-label="Business actions and period comparison"><p><strong>${number(insights.newAccounts)} new profiles</strong><span class="comparison">Previous period: ${number(insights.previousAccounts)} · retained profiles</span></p><p><strong>${number(insights.newSites)} new sites</strong><span class="comparison">Previous period: ${number(insights.previousSites)}</span></p>${insights.followUpsDue === null ? '<p>Follow-ups unavailable</p>' : `<a href="${path('customers',data,currency,'&view=due')}">${number(insights.followUpsDue)} follow-ups due</a>`}${insights.unpublishedAccounts === null ? '<p>Publication status unavailable</p>' : `<a href="${path('customers',data,currency,'&view=unpublished')}">${number(insights.unpublishedAccounts)} accounts without a published site</a>`}</section>`;
};

const overview = (data: FounderCrmData, currency: string) => {
  const billingConnected = data.billing.billing.state === 'connected';
  const missingChargeMessage = data.billing.billing.state === 'unavailable'
    ? 'Paddle is temporarily unavailable. No revenue trend is shown.'
    : 'Paddle is not connected. No revenue trend is shown.';
  const chargeSeries = billingConnected
    ? data.analytics.chargeHistory.find(series => series.currencyCode === currency) : undefined;
  const due = data.analytics.followUps.slice(0, 5);
  const dueRows = due.map(customer => `<li><div><strong>${esc(customer.name || customer.email || 'Unnamed contact')}</strong><span>${esc(customer.company || label(customer.stage))}</span></div>${customer.followUpOn ? date(customer.followUpOn) : '<span>No date</span>'}</li>`).join('');
  const coverage = data.platform.snapshot?.coverage === 'partial'
    ? '<p class="notice warning" role="status"><strong>Partial Pagecraft coverage.</strong> Account and site figures describe the records retrieved for this snapshot, not a complete business total.</p>' : '';
  const crmGap = data.crm.state === 'not_connected' ? 'CRM storage is not connected.' : 'CRM storage is unavailable.';
  const pipelineSummary = data.crm.state === 'available'
    ? barList('Pipeline', data.analytics.pipeline.map(row => ({ label: label(row.stage), value: row.value })), 'No CRM stages are available.')
    : `<section class="mini"><h3>Pipeline</h3><p class="empty-copy">${crmGap} Stage counts are withheld.</p></section>`;
  const followUps = data.crm.state === 'available'
    ? `${dueRows ? `<ul>${dueRows}</ul>` : '<p class="empty-copy">No follow-ups are due.</p>'}`
    : `<p class="empty-copy">${crmGap} Follow-up status cannot be determined.</p>`;
  return `<div class="screen overview-screen">${coverage}${topStats(data, currency)}${decisionStrip(data,currency)}<div class="chart-grid">${lineChart('account-chart', 'Account creation trend', data.analytics.accountGrowth, 'No account-creation history is available for this period.')}${billingConnected ? moneyChart(chargeSeries, currency) : `<div class="chart-empty"><strong>Collected customer charges</strong><p>${esc(missingChargeMessage)}</p></div>`}</div><div class="overview-lower">${barList('Plan mix', data.analytics.planMix, 'No plan distribution is available.')}${pipelineSummary}<section class="mini followups"><div class="mini-head"><h3>Follow-ups due</h3>${data.crm.state === 'available' ? `<a href="${path('pipeline', data, currency)}">Open pipeline</a>` : ''}</div>${followUps}</section><section class="mini source-summary"><h3>Source status</h3><dl><div><dt>Pagecraft</dt><dd>${status(data.platform.state)}</dd></div><div><dt>Paddle</dt><dd>${status(data.billing.billing.state === 'connected' ? 'available' : data.billing.billing.state)}</dd></div><div><dt>CRM storage</dt><dd>${status(data.crm.state)}</dd></div></dl></section></div></div>`;
};

const customerHref = (customer: CrmCustomer, data: FounderCrmData, currency: string, section: 'customers' | 'pipeline') =>
  path(section, data, currency, customer.accountId
    ? `&editAccount=${enc(customer.accountId)}` : `&editContact=${enc(customer.contactId || customer.id)}`);

const customerPlanKey = (customer: CrmCustomer) => customer.plan || (customer.accountId ? 'unavailable' : 'manual');

const customerRows = (customers: CrmCustomer[], data: FounderCrmData, currency: string, section: 'customers' | 'pipeline') => customers.map(customer => {
  const searchable = [customer.name, customer.email, customer.company, customer.plan, customer.stage, customer.source].join(' ').toLowerCase();
  return `<tr data-customer-row data-owned-sites="${customer.ownedSites === null ? '' : customer.ownedSites}" data-published-sites="${customer.publishedSites === null ? '' : customer.publishedSites}" data-search="${esc(searchable)}" data-plan="${esc(customerPlanKey(customer))}" data-stage="${esc(customer.stage)}"><td><a class="row-link" href="${customerHref(customer, data, currency, section)}">${esc(customer.name || 'Unnamed contact')}</a><span>${esc(customer.email || 'No email')}</span></td><td>${customer.company ? esc(customer.company) : '<span class="muted">—</span>'}</td><td>${customer.plan ? `<span class="tag">${esc(label(customer.plan))}</span>` : `<span class="tag quiet">${customer.accountId ? 'Plan unavailable' : 'Manual lead'}</span>`}</td><td><span class="stage ${esc(customer.stage)}">${esc(label(customer.stage))}</span></td><td>${esc(label(customer.source))}</td><td>${customer.ownedSites === null ? '<span class="muted">—</span>' : number(customer.ownedSites)}</td><td>${customer.followUpOn ? date(customer.followUpOn) : '<span class="muted">None</span>'}</td><td data-value="${customer.publishedSites ?? ''}">${number(customer.publishedSites)}</td><td>${date(customer.joinedAt)}</td><td>${date(customer.lastEditedAt)}</td><td data-value="${customer.mediaBytes ?? ''}">${number(customer.mediaBytes)}</td></tr>`;
}).join('');

const options = (values: readonly string[], selected: string) => values
  .map(value => `<option value="${esc(value)}"${selected === value ? ' selected' : ''}>${esc(label(value))}</option>`).join('');

const PLAN_CHOICES = ['launch', 'studio', 'pro'] as const;

/* Give or remove a plan for a linked Pagecraft account. Free is never granted: it is what an
   account falls back to when no grant or subscription is active. */
const planPanel = (data: FounderCrmData, input: FounderCrmPageInput, currency: string, accountId: string) => {
  if (input.planStatus === undefined || !accountId) return '';
  const hidden = `<input type="hidden" name="accountId" value="${esc(accountId)}"><input type="hidden" name="range" value="${esc(data.range)}"><input type="hidden" name="tests" value="${data.includeTests ? 'include' : 'exclude'}"><input type="hidden" name="currency" value="${esc(currency)}"><input type="hidden" name="returnSection" value="${input.section === 'pipeline' ? 'pipeline' : 'customers'}">`;
  if (input.planStatus === null) return '<section class="plan-panel" aria-labelledby="plan-title"><h3 id="plan-title">Plan</h3><p class="muted">The plan service is unavailable. Try again shortly.</p></section>';
  const status = input.planStatus;
  const now = Date.now();
  const active = status.grants.filter(grant => !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > now));
  const source = status.source === 'subscription' ? 'paid subscription' : status.source === 'grant' ? 'given plan' : 'default';
  const grantRows = active.map(grant => `<li><div><strong>${esc(label(grant.plan))}</strong><small>${esc(grant.reason)} · ${grant.expiresAt ? `until ${date(grant.expiresAt)}` : 'no end date'}</small></div><form method="post" action="/crm/plans" data-pending-form>${hidden}<input type="hidden" name="action" value="revoke"><input type="hidden" name="grantId" value="${esc(grant.id)}"><button class="button danger compact" type="submit" data-submit-label>Remove</button></form></li>`).join('');
  return `<section class="plan-panel" aria-labelledby="plan-title"><h3 id="plan-title">Plan</h3><p><strong>${esc(label(status.plan))}</strong> <span class="muted">(${esc(source)})</span></p>${grantRows ? `<ul class="plan-grants">${grantRows}</ul>` : ''}<form class="detail-form" method="post" action="/crm/plans" data-pending-form>${hidden}<input type="hidden" name="action" value="grant"><div class="two-fields"><div class="field"><label for="plan-level">Give plan</label><select id="plan-level" name="plan">${PLAN_CHOICES.map(plan => `<option value="${plan}">${esc(label(plan))}</option>`).join('')}</select></div><div class="field"><label for="plan-until">Until (optional)</label><input id="plan-until" name="expiresOn" type="date"></div></div><div class="field"><label for="plan-reason">Reason</label><input id="plan-reason" name="reason" maxlength="200" required placeholder="Partner, support, beta…"></div><p class="form-note">A paid subscription at the same or a higher level always takes priority.</p><div class="form-actions"><button class="button secondary" type="submit" data-submit-label>Give plan</button></div></form></section>`;
};

const contactPanel = (data: FounderCrmData, input: FounderCrmPageInput, currency: string) => {
  const found = input.editContactId
    ? data.customers.find(row => row.contactId === input.editContactId || row.id === input.editContactId)
    : input.editAccountId ? data.customers.find(row => row.accountId === input.editAccountId) : undefined;
  if (!found && input.draftContact === undefined && (input.editAccountId || input.editContactId)) {
    return '<aside class="detail-panel"><div class="detail-head"><div><h2>Record not found</h2></div></div><p>The selected record may have changed. Return to the customer list and try again.</p></aside>';
  }
  if (!found && input.draftContact === undefined) return '';
  const draft = input.draftContact || {};
  const value = <K extends keyof CrmContactInput>(key: K): CrmContactInput[K] | undefined =>
    Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : found?.[key as keyof CrmCustomer] as CrmContactInput[K] | undefined;
  const linked = Boolean(value('accountId') || found?.accountId);
  const accountId = String(value('accountId') || found?.accountId || '');
  const id = String(value('id') || found?.contactId || '');
  const revision = value('expectedRevision') ?? found?.revision ?? '';
  const name = String(value('name') ?? found?.name ?? '');
  const email = String(value('email') ?? found?.email ?? '');
  const company = String(value('company') ?? found?.company ?? '');
  const stage = String(value('stage') ?? found?.stage ?? 'lead');
  const source = String(value('source') ?? found?.source ?? 'unknown');
  const notes = String(value('notes') ?? found?.notes ?? '');
  const followUpOn = String(value('followUpOn') ?? found?.followUpOn ?? '');
  const isTest = Boolean(value('isTest') ?? found?.isTest ?? false);
  return `<aside class="detail-panel" aria-labelledby="contact-detail-title"><div class="detail-head"><div><span class="eyebrow">${found ? 'Customer detail' : 'New lead'}</span><h2 id="contact-detail-title">${esc(found ? (found.name || found.email || 'Unnamed contact') : 'Add a lead')}</h2></div><a class="icon-close" href="${path(input.section === 'pipeline' ? 'pipeline' : 'customers', data, currency)}" aria-label="Close detail panel">×</a></div><form class="detail-form" method="post" action="/crm/contacts" data-pending-form>${id ? `<input type="hidden" name="id" value="${esc(id)}">` : ''}${revision !== '' && revision !== null ? `<input type="hidden" name="expectedRevision" value="${esc(revision)}">` : ''}${accountId ? `<input type="hidden" name="accountId" value="${esc(accountId)}">` : ''}<input type="hidden" name="range" value="${esc(data.range)}"><input type="hidden" name="tests" value="${data.includeTests ? 'include' : 'exclude'}"><input type="hidden" name="currency" value="${esc(currency)}"><input type="hidden" name="returnSection" value="${input.section === 'pipeline' ? 'pipeline' : 'customers'}">${linked ? `<div class="linked-identity"><span>Pagecraft account</span><strong>${esc(name || 'Unnamed account')}</strong><small>${esc(email || 'No email')}</small><input type="hidden" name="name" value="${esc(name)}"><input type="hidden" name="email" value="${esc(email)}"></div>` : `<div class="field"><label for="contact-name">Name</label><input id="contact-name" name="name" maxlength="120" value="${esc(name)}" required></div><div class="field"><label for="contact-email">Email</label><input id="contact-email" name="email" type="email" maxlength="254" autocomplete="email" value="${esc(email)}" required></div>`}<div class="field"><label for="contact-company">Company</label><input id="contact-company" name="company" maxlength="160" value="${esc(company)}"></div><div class="two-fields"><div class="field"><label for="contact-stage">Stage</label><select id="contact-stage" name="stage">${options(CRM_STAGES, stage)}</select></div><div class="field"><label for="contact-source">Source</label><select id="contact-source" name="source">${options(CRM_SOURCES, source)}</select></div></div><div class="field"><label for="contact-followup">Follow up on</label><input id="contact-followup" name="followUpOn" type="date" value="${esc(followUpOn ? followUpOn.slice(0, 10) : '')}"></div><div class="field"><label for="contact-notes">Notes</label><textarea id="contact-notes" name="notes" maxlength="4000" rows="7">${esc(notes)}</textarea></div><label class="check"><input type="checkbox" name="isTest" value="true"${isTest ? ' checked' : ''}><span>Test or internal record</span></label><p class="form-note">Archive a record by changing its stage to Archived.</p><div class="form-actions"><a class="button secondary" href="${path(input.section === 'pipeline' ? 'pipeline' : 'customers', data, currency)}">Cancel</a><button class="button primary" type="submit" data-submit-label>${found ? 'Save changes' : 'Add lead'}</button></div></form>${planPanel(data, input, currency, accountId)}</aside>`;
};

const filters = (data: FounderCrmData, kind: 'customers' | 'pipeline') => {
  const plans = [...new Set(data.customers.map(customerPlanKey))].sort();
  return `<div class="table-tools"><label class="search"><span>Search</span><input type="search" placeholder="Name, email, company…" data-table-search></label>${kind === 'customers' ? `<label><span>Plan</span><select data-table-plan><option value="">All plans</option>${plans.map(plan => `<option value="${esc(plan)}">${esc(plan === 'manual' ? 'Manual leads' : plan === 'unavailable' ? 'Unavailable plans' : label(plan))}</option>`).join('')}</select></label>` : ''}<label><span>Stage</span><select data-table-stage><option value="">All stages</option>${options(CRM_STAGES, '')}</select></label><span class="filter-count" data-filter-count>${number(data.customers.length)} records</span></div>`;
};

const customers = (data: FounderCrmData, input: FounderCrmPageInput, currency: string) => `<div class="screen split-screen"><section class="list-pane" aria-labelledby="customers-title"><div class="section-heading"><div><h2 id="customers-title">Customers &amp; leads</h2><p>Pagecraft accounts and manually tracked opportunities in one view.</p></div><a class="button primary" href="${path('customers', data, currency, '&new=1')}">Add lead</a></div>${filters(data, 'customers')}<div class="table-wrap customer-table"><table data-crm-table="customers" aria-label="Customers and leads"><thead><tr>${customerColumns('Customer')}</tr></thead><tbody data-filter-body>${customerRows(data.customers, data, currency, 'customers') || '<tr class="empty-row"><td colspan="11"><strong>No customer records</strong><span>Imported accounts and manual leads will appear here.</span></td></tr>'}</tbody></table></div><p class="filter-empty" data-filter-empty hidden>No records match these filters.</p></section>${contactPanel(data, input, currency)}</div>`;

const pipeline = (data: FounderCrmData, input: FounderCrmPageInput, currency: string) => {
  if (data.crm.state !== 'available') {
    const heading = data.crm.state === 'not_connected' ? 'CRM storage is not connected' : 'CRM storage is unavailable';
    const copy = data.crm.state === 'not_connected'
      ? 'Pipeline stages, follow-ups, and manual leads cannot be shown until CRM storage is configured.'
      : 'Pipeline stages and counts are withheld because CRM records could not be read safely.';
    return `<div class="screen"><div class="section-heading"><div><h2>Opportunities &amp; follow-ups</h2><p>Track actual CRM stages and scheduled follow-ups.</p></div></div><div class="state-block error"><strong>${heading}</strong><p>${copy}</p></div></div>`;
  }
  const rows = data.customers;
  const stageLinks = CRM_STAGES.map(stage => `<a href="#pipeline-list" data-stage-jump="${esc(stage)}"><strong>${number(data.analytics.pipeline.find(row => row.stage === stage)?.value ?? 0)}</strong><span>${esc(label(stage))}</span></a>`).join('');
  return `<div class="screen split-screen"><section class="list-pane" aria-labelledby="pipeline-title"><div class="section-heading"><div><h2 id="pipeline-title">Opportunities &amp; follow-ups</h2><p>Track actual CRM stages. Plan status does not determine whether an account is paying.</p></div><a class="button primary" href="${path('pipeline', data, currency, '&new=1')}">Add lead</a></div><div class="stage-strip">${stageLinks}</div>${filters({ ...data, customers: rows }, 'pipeline')}<div class="table-wrap customer-table" id="pipeline-list"><table data-crm-table="pipeline" aria-label="Opportunities and follow-ups"><thead><tr>${customerColumns('Contact')}</tr></thead><tbody data-filter-body>${customerRows(rows, data, currency, 'pipeline') || '<tr class="empty-row"><td colspan="11"><strong>No pipeline records</strong><span>Add a lead to begin tracking opportunities.</span></td></tr>'}</tbody></table></div><p class="filter-empty" data-filter-empty hidden>No pipeline records match these filters.</p></section>${contactPanel(data, input, currency)}</div>`;
};

const moneyMetric = (title: string, amount: string | null, currency: string, note: string) => `<div><dt>${esc(title)}</dt><dd>${amount === null ? 'Unavailable' : esc(formatOwnerMoney(amount, currency))}</dd><small>${esc(note)}</small></div>`;

const billingState = (data: FounderCrmData) => {
  if (data.billing.billing.state === 'not_connected') return '<div class="state-block"><strong>Paddle is not connected</strong><p>Subscription, transaction, tax, payout, fee, and adjustment data is unavailable.</p></div>';
  if (data.billing.billing.state === 'unavailable') return '<div class="state-block error"><strong>Paddle is temporarily unavailable</strong><p>Financial totals are withheld because the provider response could not be verified.</p></div>';
  return '';
};

const revenue = (data: FounderCrmData, currency: string) => {
  const billing = data.billing.billing;
  if (billing.state !== 'connected') return `<div class="screen"><div class="section-heading"><div><h2>Subscriptions &amp; payments</h2><p>Provider-backed figures stay separate by currency.</p></div></div>${billingState(data)}</div>`;
  const recurring = recurringFor(billing.activeRecurringEstimate, currency);
  const risk = recurringFor(billing.atRiskRecurringEstimate, currency);
  const coverage = billing.coverage === 'partial' ? `<p class="notice warning" role="status"><strong>Partial provider coverage.</strong> ${esc(billing.coverageNote || 'Some records could not be retrieved.')}</p>` : '';
  const subscriptionRows = billing.subscriptions.filter(row => row.currencyCode === currency).map(row => `<tr><td><code>${esc(row.id)}</code></td><td><span class="stage ${row.status === 'past_due' ? 'archived' : 'customer'}">${esc(label(row.status))}</span></td><td>${esc(`${row.billingFrequency} ${row.billingInterval}${row.billingFrequency === 1 ? '' : 's'}`)}</td><td>${date(row.nextBilledAt)}</td><td>${row.scheduledChange ? esc(label(row.scheduledChange)) : '<span class="muted">None</span>'}</td></tr>`).join('');
  const transactionRows = billing.recentTransactions.filter(row => row.currencyCode === currency).map(row => `<tr><td><strong>${esc(row.invoiceNumber || 'No invoice')}</strong><code>${esc(row.id)}</code></td><td>${date(row.billedAt)}</td><td>${esc(label(row.status))}</td><td data-value="${esc(row.grossCustomerChargeMinor ?? '')}" data-currency="${esc(row.currencyCode)}">${row.grossCustomerChargeMinor === null ? '<span class="muted">Not supplied</span>' : esc(formatOwnerMoney(row.grossCustomerChargeMinor, row.currencyCode))}</td><td data-value="${esc(row.taxMinor ?? '')}" data-currency="${esc(row.currencyCode)}">${row.taxMinor === null ? '<span class="muted">Not supplied</span>' : esc(formatOwnerMoney(row.taxMinor, row.currencyCode))}</td><td data-value="${esc(row.payoutEarningsMinor ?? '')}" data-currency="${esc(row.payoutCurrencyCode || row.currencyCode)}">${row.payoutEarningsMinor === null ? '<span class="muted">Not supplied</span>' : esc(formatOwnerMoney(row.payoutEarningsMinor, row.payoutCurrencyCode || row.currencyCode))}</td><td data-value="${esc(row.payoutFeeMinor ?? '')}" data-currency="${esc(row.payoutCurrencyCode || row.currencyCode)}">${row.payoutFeeMinor === null ? '<span class="muted">Not supplied</span>' : esc(formatOwnerMoney(row.payoutFeeMinor, row.payoutCurrencyCode || row.currencyCode))}</td><td data-value="${esc(row.approvedAdjustmentsMinor ?? '')}" data-currency="${esc(row.currencyCode)}">${row.approvedAdjustmentsMinor === null ? '<span class="muted">Not supplied</span>' : esc(formatOwnerMoney(row.approvedAdjustmentsMinor, row.currencyCode))}</td></tr>`).join('');
  return `<div class="screen"><div class="section-heading"><div><span class="eyebrow">Revenue · ${esc(currency)}</span><h2>Subscriptions &amp; payments</h2><p>Catalog estimates and completed provider transactions for the selected currency.</p></div><span class="status ${billing.environment === 'sandbox' ? 'warn' : 'ok'}">${billing.environment === 'sandbox' ? 'Sandbox billing' : 'Live billing'}</span></div>${coverage}<dl class="money-stats">${moneyMetric('Current recurring estimate', recurring?.monthlyEstimateMinor ?? null, currency, 'Monthly catalog-price estimate')}${moneyMetric('At-risk recurring estimate', risk?.monthlyEstimateMinor ?? null, currency, 'Past-due monthly estimate')}${moneyMetric('Collected charges', moneyFor(billing.completedGrossCustomerCharges, currency), currency, 'Completed in provider period')}${moneyMetric('Tax', moneyFor(billing.completedTax, currency), currency, 'Completed transaction tax')}${moneyMetric('Payout earnings', moneyFor(billing.completedPayoutEarnings, currency), currency, 'Provider payout currency only')}${moneyMetric('Payout fees', moneyFor(billing.completedPayoutFees, currency), currency, 'Provider payout currency only')}${moneyMetric('Adjustments', moneyFor(billing.approvedAdjustments, currency), currency, 'Approved refunds and adjustments')}</dl>${moneyChart(data.analytics.chargeHistory.find(series=>series.currencyCode===currency),currency)}<section class="data-section"><div class="data-head"><h3>Subscriptions</h3><p>${esc(billing.recurringEstimateNote)}</p></div><div class="table-wrap"><table data-crm-table="subscriptions" aria-label="Subscriptions"><thead><tr>${tableHead([['subscription','Subscription'],['status','Status'],['cycle','Cycle'],['nextBilled','Next billed','date'],['scheduled','Scheduled change']])}</tr></thead><tbody>${subscriptionRows || '<tr class="empty-row"><td colspan="5"><strong>No subscriptions in this currency</strong></td></tr>'}</tbody></table></div></section><section class="data-section"><div class="data-head"><h3>Transactions</h3><p>${esc(billing.financialDataNote)}</p></div><div class="table-wrap wide"><table data-crm-table="transactions" aria-label="Transactions"><thead><tr>${tableHead([['receipt','Receipt'],['billed','Billed','date'],['status','Status'],['gross','Gross','money'],['tax','Tax','money'],['payout','Payout','money'],['fee','Fee','money'],['adjustments','Adjustments','money']])}</tr></thead><tbody>${transactionRows || '<tr class="empty-row"><td colspan="8"><strong>No transactions in this currency</strong></td></tr>'}</tbody></table></div></section></div>`;
};

const majorAmount = (amountMinor: string, currencyCode: string) => {
  if (!integer(amountMinor)) return '';
  const amount = BigInt(amountMinor), negative = amount < 0n, absolute = negative ? -amount : amount;
  let digits = 2;
  try { digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2; } catch { /* default */ }
  const scale = 10n ** BigInt(digits);
  return `${negative ? '-' : ''}${absolute / scale}${digits ? `.${(absolute % scale).toString().padStart(digits, '0')}` : ''}`;
};

const costs = (data: FounderCrmData, input: FounderCrmPageInput, currency: string) => {
  const costInput = input.costInput || {};
  const costErrors: Record<string, string> = {
    invalid: 'Check the budget fields and try again.',
    input_invalid: 'Check the budget fields and try again.',
    label_invalid: 'Enter a label between 1 and 120 characters.',
    category_invalid: 'Choose a valid cost category.',
    amount_invalid: 'Enter a positive amount or zero using the currency’s decimal places.',
    currency_invalid: 'Choose a supported currency.',
    id_invalid: 'That budget row could not be found. Refresh and try again.',
    cost_row_limit: 'The monthly budget has reached its row limit.',
    unavailable: 'Budget storage is unavailable. No change was saved.',
    not_found: 'That budget row no longer exists.',
  };
  const costMessages: Record<string, string> = {
    saved: 'Monthly budget saved.', updated: 'Monthly budget updated.', removed: 'Monthly budget removed.',
  };
  const feedback = costInput.error
    ? `<p class="notice error" role="alert" tabindex="-1" data-feedback>${esc(costErrors[costInput.error] || 'The budget change could not be completed. Try again.')}</p>`
    : costInput.message ? `<p class="notice success" role="status" tabindex="-1" data-feedback>${esc(costMessages[costInput.message] || 'Budget change completed.')}</p>` : '';
  const rows = data.billing.costs.state === 'available' ? data.billing.costs.rows : [];
  const edit = costInput.editCostId ? rows.find(row => row.id === costInput.editCostId) : undefined;
  const draft = costInput.draftCost;
  const staleEdit = Boolean(costInput.editCostId && !edit && !draft);
  const id = draft?.id || edit?.id || '';
  const value = { label: draft?.label ?? edit?.label ?? '', category: draft?.category ?? edit?.category ?? 'hosting', amount: draft?.amount ?? (edit ? majorAmount(edit.amountMinor, edit.currencyCode) : ''), currencyCode: draft?.currencyCode ?? edit?.currencyCode ?? currency };
  const total = data.billing.costs.state === 'available' ? moneyFor(data.billing.costs.totals, currency) : null;
  const rowHtml = rows.filter(row => row.currencyCode === currency).map(row => `<tr><td><strong>${esc(row.label)}</strong></td><td>${esc(label(row.category))}</td><td data-value="${esc(row.amountMinor)}" data-currency="${esc(row.currencyCode)}">${esc(formatOwnerMoney(row.amountMinor, row.currencyCode))}</td><td>${date(row.updatedAt)}</td><td>${costInput.costsEnabled === false ? '<span class="muted">Read only</span>' : `<div class="row-actions"><a class="button secondary compact" href="${path('costs', data, currency, `&edit=${enc(row.id)}`)}">Edit</a><form method="post" action="${mutationPath(`/owner/billing/costs/${enc(row.id)}/remove`, data, currency)}" data-pending-form><input type="hidden" name="range" value="${esc(data.range)}"><input type="hidden" name="tests" value="${data.includeTests ? 'include' : 'exclude'}"><input type="hidden" name="currency" value="${esc(currency)}"><button class="button danger compact" type="submit" data-submit-label>Remove</button></form></div>`}</td></tr>`).join('');
  const categories = ['hosting', 'database', 'email', 'marketing', 'other'];
  const currencyOptions = [...new Set([...currencies(data), 'USD', 'PHP', 'EUR', 'GBP', 'AUD', 'NZD'])].sort();
  const form = data.billing.costs.state !== 'available' ? '<div class="state-block error"><strong>Budget storage is unavailable</strong><p>Existing rows and edits are withheld until storage can be read safely.</p></div>' : costInput.costsEnabled === false ? '<div class="state-block"><strong>Budget editing is disabled</strong><p>Stored planning figures remain available for review in this environment.</p></div>' : staleEdit ? `<div class="state-block error"><strong>Budget row not found</strong><p>The selected row may have been removed. Return to the current budget list.</p><a class="button secondary" href="${path('costs', data, currency)}">Return to budgets</a></div>` : `<form class="cost-form" method="post" action="${mutationPath('/owner/billing/costs', data, currency)}" data-pending-form>${id ? `<input type="hidden" name="id" value="${esc(id)}">` : ''}<input type="hidden" name="range" value="${esc(data.range)}"><input type="hidden" name="tests" value="${data.includeTests ? 'include' : 'exclude'}"><div class="field"><label for="cost-label">Cost label</label><input id="cost-label" name="label" maxlength="120" value="${esc(value.label)}" required></div><div class="field"><label for="cost-category">Category</label><select id="cost-category" name="category">${options(categories, value.category)}</select></div><div class="field"><label for="cost-amount">Monthly budget</label><input id="cost-amount" name="amount" inputmode="decimal" value="${esc(value.amount)}" required></div><div class="field"><label for="cost-currency">Currency</label><select id="cost-currency" name="currencyCode">${currencyOptions.map(code => `<option value="${esc(code)}"${value.currencyCode === code ? ' selected' : ''}>${esc(code)}</option>`).join('')}</select></div><div class="cost-actions">${id ? `<a class="button secondary" href="${path('costs', data, currency)}">Cancel</a>` : ''}<button class="button primary" type="submit" data-submit-label>${id ? 'Update budget' : 'Add budget'}</button></div></form>`;
  return `<div class="screen"><div class="section-heading"><div><span class="eyebrow">Operating plan · ${esc(currency)}</span><h2>Monthly cost budget</h2><p>Private planning figures. They are not imported actual expenses or used to calculate profit.</p></div><div class="headline-total"><span>Selected-currency total</span><strong>${total === null ? 'Unavailable' : esc(formatOwnerMoney(total, currency))}</strong></div></div>${feedback}${form}<section class="data-section"><div class="data-head"><h3>Budget lines</h3><p>Currency totals stay separate.</p></div><div class="table-wrap"><table data-crm-table="budgets" aria-label="Monthly cost budgets"><thead><tr>${tableHead([['cost','Cost'],['category','Category'],['budget','Monthly budget','money'],['updated','Updated','date'],['actions','Actions']])}</tr></thead><tbody>${rowHtml || '<tr class="empty-row"><td colspan="5"><strong>No budget rows in this currency</strong><span>Add a known recurring cost above.</span></td></tr>'}</tbody></table></div></section></div>`;
};

const reports = (data: FounderCrmData, currency: string) => {
  const activation = data.analytics.activation;
  const partial = data.platform.snapshot?.coverage === 'partial';
  const rows = [
    ['All account profiles (unfiltered)', number(data.platform.snapshot?.accountTotal ?? null), 'Inventory total; derived metrics use retrieved profiles'],
    ...(partial ? [['Retrieved profiles', number(data.platform.snapshot?.accounts.length ?? null), 'Profiles retrieved for derived metrics; partial feed']] : []),
    ['New accounts', number(data.analytics.newAccounts), rangeBasis(data.range)],
    ['Activated accounts', number(activation?.publishedAccounts ?? null), 'Accounts with a published site in current snapshot'],
    ['Activation rate', activation?.rate === null || activation?.rate === undefined || !Number.isFinite(activation.rate) ? 'Unavailable' : `${activation.rate.toFixed(1)}%`, 'Current snapshot, not period conversion'],
    ['Open pipeline', number(data.customers.filter(row => !['customer', 'archived'].includes(row.stage)).length), 'CRM stage count'],
    ['Follow-ups due', number(data.analytics.followUps.length), 'CRM follow-up dates'],
  ];
  const exports = [['Customers', 'customers'], ['Pipeline', 'pipeline'], ['Payments', 'payments'], ['Budgets', 'budgets'], ['Metrics', 'metrics']];
  const sourceReport = data.crm.state === 'available'
    ? barList('Manual source distribution', data.analytics.sources.filter(row => row.value > 0)
      .map(row => ({ label: label(row.source), value: row.value })), 'No manual source attribution is recorded.')
    : `<section class="mini"><h3>Manual source distribution</h3><p class="empty-copy">CRM storage is ${esc(label(data.crm.state))}. Manual source attribution is unavailable.</p></section>`;
  const siteEmpty = data.platform.state === 'available'
    ? 'No site-creation history is available for this period.'
    : `Pagecraft data is ${label(data.platform.state)}. No site trend is shown.`;
  return `<div class="screen"><div class="section-heading"><div><h2>Operating metrics &amp; exports</h2><p>Definitions are shown with every figure so snapshot and period measures stay distinct.</p></div></div><div class="report-charts">${lineChart('site-chart', 'Site creation trend', data.analytics.siteGrowth, siteEmpty)}${sourceReport}</div><div class="report-layout"><section class="data-section report-table"><div class="data-head"><h3>Metric definitions</h3><p>Generated ${date(data.generatedAt, true)}</p></div><div class="table-wrap"><table data-crm-table="metrics" aria-label="Metric definitions"><thead><tr>${tableHead([['metric','Metric'],['value','Value'],['basis','Basis']])}</tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row[0])}</strong></td><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join('')}</tbody></table></div></section><section class="exports"><h3>Download retrieved records</h3><p>Exports retain the selected period, test-record setting, and currency. Payment exports contain the provider records retrieved for this report.</p><ul>${exports.map(([name, file]) => `<li><a href="/exports/${file}.csv?${query(data, currency)}"><span>${esc(name)}</span><small>.csv</small></a></li>`).join('')}</ul></section></div></div>`;
};

const sources = (data: FounderCrmData) => {
  const billing = data.billing.billing;
  const profileCoverage = data.platform.snapshot
    ? data.platform.snapshot.coverage === 'partial'
      ? `${number(data.platform.snapshot.accounts.length)} of ${number(data.platform.snapshot.accountTotal)} profiles retrieved · partial snapshot coverage`
      : `${number(data.platform.snapshot.accountTotal)} total profiles · complete snapshot coverage`
    : 'Account and site inventory unavailable';
  const rows = [
    ['Pagecraft', data.platform.state, profileCoverage],
    ['Paddle', billing.state === 'connected' ? 'available' : billing.state, billing.state === 'connected' ? `${label(billing.environment)} environment · ${billing.coverage} retrieved coverage` : 'Subscriptions and transactions unavailable'],
    ['CRM storage', data.crm.state, data.crm.state === 'available' ? `${number(data.crm.contacts.length)} manually maintained records` : 'Manual leads and CRM metadata unavailable'],
    ['Acquisition sources', data.analytics.sources.length ? 'available' : 'not_connected', data.analytics.sources.length ? 'Manual CRM source attribution only' : 'No acquisition source records'],
  ] as const;
  return `<div class="screen"><div class="section-heading"><div><h2>Data coverage</h2><p>Availability and scope for every system used by Pagecraft HQ.</p></div></div><section class="source-ledger">${rows.map(row => `<article><div><h3>${esc(row[0])}</h3><p>${esc(row[2])}</p></div>${status(row[1])}</article>`).join('')}</section><section class="connection-gaps"><span class="eyebrow">Not measured</span><h3>Growth analytics need additional sources</h3><p>Traffic, customer acquisition cost, churn, and retention are not connected. Pagecraft profile creation timestamps describe account creation; they do not measure acquisition sessions or period conversion. Site edit timestamps are operational activity, not daily active users.</p></section></div>`;
};

const healthBytes = (value: number | undefined) => value === undefined ? '—'
  : value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(1)} GB` : `${Math.round(value / 1024 ** 2)} MB`;

const systemHealth = (snapshot: FounderCrmPageInput['systemHealth']) => {
  const heading = '<div class="section-heading"><div><h2>System health</h2><p>Recent server errors, disk space and deployed commits. Error records hold no cookies, tokens, request bodies or personal data.</p></div></div>';
  if (!snapshot) return `<div class="screen">${heading}<p class="notice warning"><strong>System health is not configured.</strong> Set PAGECRAFT_REPORTS_HEALTH_ROOT to the app publication root (and optionally PAGECRAFT_REPORTS_RELEASE_ROOT) in the reports runtime file.</p></div>`;
  const warnings = snapshot.warnings.length
    ? `<section class="source-warnings" aria-label="System warnings">${snapshot.warnings.map(text => `<p class="notice warning" data-health-warning>${esc(text)}</p>`).join('')}</section>`
    : '<p class="notice success" data-health-ok>No disk, error-rate or deployment warnings.</p>';
  const deployments = snapshot.deployments.map(row => `<article><div><h3>${esc(row.label)}</h3><p>${row.state === 'available' ? `<span class="health-mono" data-health-commit>${esc((row.commit || 'unknown').slice(0, 12))}</span> · ${esc(row.branch || 'unknown branch')}` : 'Deployment record unavailable'}</p></div>${status(row.state)}</article>`).join('');
  const disks = snapshot.disk.map(row => `<article${row.warning ? ' data-health-disk-warning' : ''}><div><h3>${esc(row.label)}</h3><p>${row.state === 'available'
    ? `${esc(healthBytes(row.freeBytes))} free of ${esc(healthBytes(row.totalBytes))} · ${esc(String(row.usedPercent))}% used${row.measuredBytes !== undefined ? ` · holds ${esc(healthBytes(row.measuredBytes))}${row.measuredPartial ? ' (partial count)' : ''}${row.budgetBytes ? ` of ${esc(healthBytes(row.budgetBytes))} budget` : ''}` : ''}`
    : 'Could not be read'}</p></div>${row.warning ? '<span class="status warn">Warning</span>' : '<span class="status ok">OK</span>'}</article>`).join('');
  const errorRows = snapshot.errors.recent.map(row => `<tr><td>${date(row.at, true)}</td><td>${esc(label(row.kind))}</td><td>${esc([row.method, row.route].filter(Boolean).join(' ') || '—')}</td><td>${esc(row.status ?? '—')}</td><td><span class="health-mono">${esc(row.requestId || '—')}</span></td><td>${esc(row.name)}: ${esc(row.message)}</td></tr>`).join('');
  const errors = snapshot.errors.state === 'unavailable'
    ? '<p class="notice warning">Server error records could not be read.</p>'
    : `<p class="dataset-line">${number(snapshot.errors.last24h)} in the last 24 hours · ${number(snapshot.errors.last14d)} kept (14 days, newest 500)</p><div class="table-wrap"><table aria-label="Recent server errors" data-health-errors><thead><tr><th>Time (UTC)</th><th>Kind</th><th>Route</th><th>Status</th><th>Request ID</th><th>Message</th></tr></thead><tbody>${errorRows || '<tr class="empty-row"><td colspan="6"><strong>No server errors recorded</strong><span>Unhandled request errors and crashes appear here.</span></td></tr>'}</tbody></table></div>`;
  return `<div class="screen">${heading}${warnings}<p class="dataset-line">Checked ${date(snapshot.generatedAt, true)}</p><h3 class="health-title">Deployed commits</h3><section class="source-ledger">${deployments}</section><h3 class="health-title">Disk space</h3><section class="source-ledger">${disks || '<article><div><h3>No disk targets configured</h3></div></article>'}</section><h3 class="health-title">Recent server errors</h3>${errors}</div>`;
};

const navItems: [CrmSection, string][] = [
  ['overview', 'Overview'], ['customers', 'Customers'], ['pipeline', 'Pipeline'], ['support', 'Support'],
  ['revenue', 'Revenue'], ['costs', 'Costs'], ['reports', 'Reports'], ['sources', 'Sources'],
  ['health', 'System health'],
];

const icon = (section: CrmSection) => ({
  overview: '<path d="M3 11h5V3H3v8zm9 6h5V9h-5v8zM3 17h5v-2H3v2zm9-12h5V3h-5v2z"/>',
  customers: '<path d="M10 10a3 3 0 100-6 3 3 0 000 6zm-6 7a6 6 0 0112 0M15 6a2 2 0 012 2c0 1.1-.9 2-2 2m2 2c1.6.6 2.7 1.8 3 3.5"/>',
  pipeline: '<path d="M4 4h12M4 10h8M4 16h4M16 9v7m-3-3l3 3 3-3"/>',
  revenue: '<path d="M4 4v12h13M7 13l3-4 3 2 4-6"/>',
  costs: '<path d="M4 6h12v10H4zM7 6V4h6v2M7 10h6"/>',
  reports: '<path d="M5 3h8l3 3v11H5zM13 3v4h4M8 11h5M8 14h5"/>',
  sources: '<path d="M6 6a4 4 0 018 0c0 2-2 3-4 4s-4 2-4 4 1.8 3 4 3 4-1 4-3"/>',
  // Lucide message-square (Iconify), scaled to the common CRM rail viewport.
  support: '<path transform="scale(.8333)" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  health: '<path d="M2 10h4l2-5 4 10 2-5h4"/>',
}[section]);

/** Authenticated reports reuse Pagecraft's header; all navigation stays on the private reports host. */
function founderChrome(user: User, active: CrmSection, href: (section: CrmSection) => string) {
  const name = user.name || user.email || 'Founder';
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const account = `<details class="hq-account"><summary aria-label="Account menu for ${esc(name)}"><span class="hq-user-name">${esc(name)}</span><span class="pc-header-avatar" aria-hidden="true">${esc(initials)}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="hq-account-menu"><strong>${esc(name)}</strong><small>${esc(user.email)}</small><form method="post" action="/auth/logout"><button type="submit">Sign out</button></form></div></details>`;
  const current = navItems.find(([section]) => section === active)![1];
  const header = cloudHeader(current, account)
    .replace('href="/" aria-label="Pagecraft sites"', () => `href="${href('overview')}" aria-label="Pagecraft HQ overview"`);
  const nav = navItems.map(([section, text]) => `<a href="${href(section)}" title="${esc(text)}"${active === section ? ' aria-current="page"' : ''}><svg viewBox="0 0 20 20" aria-hidden="true">${icon(section)}</svg><span>${esc(text)}</span></a>`).join('');
  return header + `<aside class="rail"><nav aria-label="Founder CRM">${nav}</nav></aside>`;
}

const shell = (title: string, body: string, challengeSiteKey?: string, context?: { range: string; tests: string; currency: string; environment: string; day: string } | 'support') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} — Pagecraft HQ</title><link rel="icon" href="/brand/pagecraft-favicon.svg">${challengeSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}<style>${UI_FONTS_CSS}${UI_TOKENS_CSS}${CLOUD_HEADER_CSS}${styles}${body.includes('type="password"') ? PASSWORD_TOGGLE_CSS : ''}</style>${body.includes('<select') ? `<style id="pc-custom-select-styles">${CUSTOM_SELECT_CSS}</style>` : ''}${context ? '<link rel="stylesheet" href="/assets/founder-crm.css"><script src="/assets/founder-crm.js" defer></script>' : ''}</head><body${context && context !== 'support' ? ` data-report-range="${esc(context.range)}" data-report-tests="${esc(context.tests)}" data-report-currency="${esc(context.currency)}" data-report-environment="${esc(context.environment)}" data-report-day="${esc(context.day)}"` : ''}>${body}${clientScript}${body.includes('<select') ? `<script>${CUSTOM_SELECT_BOOT_SCRIPT}</script>` : ''}${body.includes('type="password"') ? `<script>${PASSWORD_TOGGLE_SCRIPT}</script>` : ''}</body></html>`;

const supportPath = (environment: CrmSupportInbox['environment'], ticketId?: string) =>
  '/support?environment=' + enc(environment) + (ticketId ? '&amp;ticket=' + enc(ticketId) : '');

function supportSources(support?: CrmSupportInbox) {
  const current = support?.environment || 'production';
  const links = (['production', 'staging'] as const).map(source => {
    const selected = source === current;
    const name = selected && support?.sourceLabel ? support.sourceLabel : label(source) + ' support';
    return `<a href="${supportPath(source)}"${selected ? ' aria-current="page"' : ''}>${esc(name)}</a>`;
  }).join('');
  return `<nav class="support-sources" aria-label="Support environments">${links}</nav>`;
}

function supportInbox(support: CrmSupportInbox | undefined) {
  if (!support || support.state !== 'available') {
    const reason = support?.state === 'unavailable'
      ? 'The support inbox is temporarily unavailable. Refresh to try again.'
      : 'The support inbox is not connected.';
    return `<p class="notice warning" role="status">${reason}</p>`;
  }
  if (!support.tickets.length) return '<p class="empty-copy">No support tickets yet.</p>';
  const rows = support.tickets.map(ticket => {
    const state = ticket.latestMessageRole === 'customer' ? '<span class="status warn">Needs reply</span>'
      : ticket.latestMessageRole === 'support' ? '<span class="status ok">Replied</span>' : '';
    return `<li><a href="${supportPath(support.environment, ticket.id)}"${support.selected?.id === ticket.id ? ' aria-current="page"' : ''}><span class="support-ticket-label"><strong>${esc(ticket.subject)}</strong>${ticket.accountEmail ? `<small>${esc(ticket.accountEmail)}</small>` : ''}</span><span class="support-ticket-meta">${state}${date(ticket.updatedAt, true)}</span></a></li>`;
  }).join('');
  return `<ul class="support-tickets" aria-label="Support tickets">${rows}</ul>`;
}

function supportListRegion(support: CrmSupportInbox | undefined) {
  return `<section class="list-pane" aria-label="Inbox" data-support-inbox data-support-refresh="${supportPath(support?.environment || 'production', support?.selected?.id)}">${supportInbox(support)}</section>`;
}

function supportThreadRegion(ticket: NonNullable<CrmSupportInbox['selected']>) {
  const messages = ticket.messages.map(message => {
    const author = message.role === 'support'
      ? '<strong class="support-staff-author">Pagecraft Support <span>Admin</span></strong>'
      : '<strong>Customer</strong>';
    return `<li><div>${author}${date(message.createdAt, true)}</div><p>${esc(message.body)}</p></li>`;
  }).join('');
  return `<ol class="support-messages" aria-label="Conversation" data-support-thread>${messages}</ol>`;
}

export function founderSupportUpdates(support: CrmSupportInbox): string {
  return supportListRegion(support) + (support.state === 'available' && support.selected ? supportThreadRegion(support.selected) : '');
}

function supportDetail(support: CrmSupportInbox | undefined) {
  const ticket = support?.selected;
  if (!support || support.state !== 'available' || !ticket) {
    // A read outage following a failed submit can also make the thread unavailable.
    return support?.draftBody ? `<div class="field"><label for="unsent-reply">Unsent reply</label><textarea id="unsent-reply" readonly>${esc(support.draftBody)}</textarea></div>` : '';
  }
  return `<section class="detail-panel support-detail" aria-labelledby="support-subject">
  <header class="detail-head"><div><a href="${supportPath(support.environment)}">All tickets</a><h2 id="support-subject">${esc(ticket.subject)}</h2>${ticket.accountEmail ? `<p class="muted">${esc(ticket.accountEmail)}</p>` : ''}</div></header>
  ${supportThreadRegion(ticket)}
  <form class="detail-form" method="post" action="/support/${enc(ticket.id)}/replies?environment=${enc(support.environment)}" data-pending-form>
    <input type="hidden" name="requestId" value="${esc(support.requestId)}">
    <div class="field"><label for="support-reply">Your reply</label><textarea id="support-reply" name="body" rows="4" maxlength="8000" required>${esc(support.draftBody || '')}</textarea></div>
    <div class="form-actions"><button class="button primary" type="submit" data-submit-label>Send reply</button></div>
  </form></section>`;
}

/** The support source is independent of billing, analytics and reporting periods. */
export function founderCrmSupportPage(user: User, input: FounderCrmPageInput): string {
  const support = input.support;
  return shell('Support', `<main class="hq-shell support-shell">${founderChrome(user, 'support', section => '/' + section)}
    <section class="workspace"><header class="toolbar support-toolbar"><div><h1>Support inbox</h1><p>Read and reply to customer tickets.</p></div>${supportSources(support)}</header>
    ${notice(input)}<div class="screen support-screen${support?.state === 'available' && support.selected ? ' has-ticket' : ''}">${supportListRegion(support)}${supportDetail(support)}</div></section>
  </main>`, undefined, 'support');
}

export function founderCrmPage(user: User, data: FounderCrmData, input: FounderCrmPageInput): string {
  if (input.section === 'support') return founderCrmSupportPage(user, input);
  const currency = selectedCurrency(data, input.currencyCode);
  const [environmentKey, environmentLabel] = environment(input.dataEnvironment);
  const previewLabel = input.previewLabel;
  const previewBanner = previewLabel
    ? `<div class="preview-banner" role="status"><strong>Local sample data</strong><span>${esc(previewLabel)} · This preview does not contain live business records.</span></div>` : '';
  const page = input.section === 'overview' ? overview(data, currency)
    : input.section === 'customers' ? customers(data, input, currency)
      : input.section === 'pipeline' ? pipeline(data, input, currency)
        : input.section === 'revenue' ? revenue(data, currency)
          : input.section === 'costs' ? costs(data, input, currency)
            : input.section === 'reports' ? reports(data, currency)
              : input.section === 'health' ? systemHealth(input.systemHealth) : sources(data);
  const currencyChoices = currencies(data);
  const coverageFlag = (data.platform.snapshot?.coverage === 'partial'
    ? '<span class="coverage-flag">Partial Pagecraft coverage</span>' : '') +
    (data.billing.billing.state === 'connected' && data.billing.billing.coverage === 'partial'
      ? '<span class="coverage-flag">Partial Paddle coverage</span>' : '');
  const sourceWarnings = [
    data.platform.state === 'available' ? '' : `<p class="notice warning"><strong>Pagecraft source ${esc(label(data.platform.state).toLowerCase())}.</strong> The customer directory contains saved CRM contacts only; account, site, and plan values are withheld.</p>`,
    data.crm.state === 'available' ? '' : `<p class="notice warning"><strong>CRM storage ${esc(label(data.crm.state).toLowerCase())}.</strong> Saved notes, stages, sources, and follow-up dates cannot be read. Stage and source labels may fall back to incomplete defaults.</p>`,
  ].filter(Boolean).join('');
  const sourceWarningRegion = sourceWarnings
    ? `<section class="source-warnings" aria-label="Data source warnings">${sourceWarnings}</section>` : '';
  const rangeOptions = [['30d', '30 days'], ['90d', '90 days'], ['12m', 'Past year (365 days)']].map(([value, text]) => `<option value="${value}"${data.range === value ? ' selected' : ''}>${text}</option>`).join('');
  const periodWindow = `<span class="period-window">Period ${date(data.periodStart)}–${date(data.periodEnd)} UTC</span>`;
  return shell('Founder CRM', `<main class="hq-shell">${founderChrome(user, input.section, section => section === 'support' ? '/support' : path(section, data, currency))}<section class="workspace"><header class="toolbar"><div><h1>${esc(input.section === 'overview' ? 'Business overview' : navItems.find(([section]) => section === input.section)?.[1] || 'Pagecraft HQ')}</h1>${input.section === 'overview' ? '<p>Review account activity, published sites, and revenue.</p>' : ''}</div><div class="toolbar-actions"><span class="environment" data-environment="${esc(environmentKey)}">${esc(environmentLabel)}</span><form class="toolbar-form" method="get" action="/${esc(input.section)}"><label><span>Period</span><select name="range" onchange="this.form.requestSubmit()">${rangeOptions}</select></label><label><span>Records</span><select name="tests" onchange="this.form.requestSubmit()"><option value="exclude"${data.includeTests ? '' : ' selected'}>Exclude tests</option><option value="include"${data.includeTests ? ' selected' : ''}>Include tests</option></select></label><input type="hidden" name="currency" value="${esc(currency)}"></form>${currencyChoices.length ? `<form class="toolbar-form currency" method="get" action="/${esc(input.section)}"><label><span>Currency</span><select name="currency" onchange="this.form.requestSubmit()">${currencyChoices.map(code => `<option value="${esc(code)}"${currency === code ? ' selected' : ''}>${esc(code)}</option>`).join('')}</select></label><input type="hidden" name="range" value="${esc(data.range)}"><input type="hidden" name="tests" value="${data.includeTests ? 'include' : 'exclude'}"></form>` : ''}</div></header><div class="dataset-line"><span>Current dataset</span><strong>${esc(environmentLabel)}</strong>${coverageFlag}${periodWindow}<span>Refreshed ${date(data.generatedAt, true)}</span></div>${previewBanner}${sourceWarningRegion}${notice(input)}${page}</section></main>`, undefined, {range:data.range,tests:data.includeTests ? 'include' : 'exclude',currency,environment:environmentKey,day:data.generatedAt.slice(0,10)});
}

export function founderCrmSignInPage(input: {
  error?: string;
  dataEnvironment: FounderCrmPageInput['dataEnvironment'];
  challengeSiteKey?: string;
  previewLabel?: string;
}): string {
  const [key, text] = environment(input.dataEnvironment);
  const error = input.error === 'challenge'
    ? 'Complete the security check and try again.' : input.error
      ? 'We could not sign you in with those details.' : '';
  const preview = input.previewLabel
    ? `<div class="preview-banner signin-preview" role="status"><strong>Local sample data</strong><span>${esc(input.previewLabel)} · This preview does not contain live business records.</span></div>` : '';
  return shell('Sign in', `<main class="signin"><div class="signin-layout"><img class="signin-wordmark" src="/brand/pagecraft-logo.svg" width="190" height="42" alt="Pagecraft"><section class="signin-panel" aria-labelledby="signin-heading"><span class="environment" data-environment="${esc(key)}">${esc(text)}</span>${preview}<div><h1 id="signin-heading">Sign in</h1><p>Use your founder account to access the Founder CRM.</p></div>${error ? `<p class="notice error" role="alert">${esc(error)}</p>` : ''}<form method="post" action="/auth/sign-in" data-pending-form><div class="field"><label for="founder-email">Email</label><input id="founder-email" name="email" type="email" autocomplete="email" maxlength="254" required autofocus></div><div class="field"><label for="founder-password">Password</label><input id="founder-password" name="password" type="password" autocomplete="current-password" required></div>${input.challengeSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(input.challengeSiteKey)}" data-action="founder_sign_in"></div>` : ''}<button class="button primary" type="submit" data-submit-label>Sign in</button></form></section></div></main>`, input.challengeSiteKey);
}

const styles = `
:root{color-scheme:light;--ink:#111311;--muted:#4b504b;--line:var(--pc-border);--line-strong:var(--pc-border-strong);--paper:#fff;--white:#fff;--rail:#111311;--rail-muted:#aeb5ad;--green:#b7f34a;--green-dark:#315f15;--green-soft:var(--pc-selection-bg);--red:#8f312b;--amber:#89550f;--pc-field:#fff;font-family:var(--pc-font-body);font-synthesis:none}
*{box-sizing:border-box}html,body{margin:0;min-width:0;min-height:100%;background:var(--paper);color:var(--ink)}body{font:var(--pc-type-input)}
button,input,select,textarea{font:inherit}a{color:inherit}button,a,select,input,textarea{outline-offset:3px}:focus-visible{outline:2px solid #497d22}
.hq-shell{display:grid;grid-template-columns:var(--pc-rail-width) minmax(0,1fr);grid-template-rows:52px minmax(0,1fr);height:100dvh;min-height:0}
.hq-shell>.pc-topbar{grid-column:1/-1}
.hq-account{position:relative;color:var(--pc-rail-text-2);font:var(--pc-type-toolbar)}
.hq-account summary{display:flex;align-items:center;gap:8px;min-height:42px;padding-inline:6px;list-style:none;cursor:pointer}
.hq-account summary::-webkit-details-marker{display:none}.hq-account summary:hover{color:var(--pc-rail-text)}
.hq-user-name{max-width:18ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hq-account-menu{position:absolute;z-index:50;right:0;top:calc(100% + 2px);min-width:210px;padding:10px;border:1px solid var(--line);border-radius:var(--pc-control-radius);background:#fff;color:var(--ink);box-shadow:0 6px 20px #11131114}
.hq-account-menu strong,.hq-account-menu small{display:block;overflow-wrap:anywhere;padding-inline:6px}.hq-account-menu small{margin:3px 0 8px;color:var(--muted)}
.hq-account-menu form{margin:0;border-top:1px solid var(--line);padding-top:5px}.hq-account-menu button{width:100%;padding:8px 6px;text-align:left;background:transparent;border:0;border-radius:4px;cursor:pointer}.hq-account-menu button:hover{background:var(--pc-hover-bg)}
.rail{min-height:0;overflow:auto;scrollbar-width:thin;background:var(--rail);color:var(--rail-muted)}
.rail nav{display:grid;gap:4px;padding-bottom:8px}
.rail nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:56px;padding:5px 2px;color:inherit;text-decoration:none;text-align:center;font:500 var(--pc-text-label)/1.25 var(--pc-font-label)}
.rail nav a svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
.rail nav a:hover{background:#272c28;color:#fff}.rail nav a:focus-visible{outline-offset:-3px;outline-color:var(--green)}.rail nav a[aria-current=page]{background:var(--green);color:var(--ink)}
.workspace{--workspace-x:32px;min-width:0;min-height:0;overflow:auto;padding:0 var(--workspace-x) 40px}
.toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px 24px;min-height:94px;padding:22px var(--workspace-x);margin-inline:calc(-1 * var(--workspace-x));border-bottom:1px solid var(--line)}
.toolbar p{margin:6px 0 0;color:var(--muted);font-size:14px}.toolbar h1{margin:0;font:700 var(--pc-text-workspace)/1.3 var(--pc-font-body);letter-spacing:-.025em}
.eyebrow{display:block;color:var(--muted);font:var(--pc-type-description);font-weight:600}.toolbar-actions{display:flex;align-items:flex-end;gap:10px}.toolbar-form{display:flex;gap:8px}.toolbar-form label,.table-tools label{display:grid;gap:4px;color:var(--muted);font-size:14px;font-weight:600}.toolbar-form select,.table-tools select,.table-tools input{height:40px;padding:0 30px 0 11px;border:1px solid var(--line-strong);border-radius:var(--pc-control-radius);background:var(--white);color:var(--ink);font-size:14px}.environment,.status,.tag,.stage{display:inline-flex;align-items:center;width:max-content;border-radius:999px;white-space:nowrap}.environment{height:40px;padding:0 12px;border:1px solid var(--line-strong);background:var(--white);font-size:var(--pc-text-label);font-weight:600}.environment:before,.status:before{content:"";width:7px;height:7px;margin-right:7px;border-radius:50%;background:#788078}.environment[data-environment=production]:before,.status.ok:before{background:#65a823}.environment[data-environment=staging]:before,.status.warn:before{background:#d18a27}.dataset-line{display:flex;align-items:center;gap:7px;min-height:42px;border-bottom:1px solid var(--line);color:var(--muted);font-size:var(--pc-text-label)}.dataset-line strong{color:var(--ink)}.dataset-line span:last-child{margin-left:auto}.screen{padding:28px 0}.top-stats,.money-stats{display:grid;margin:0;border:1px solid var(--line);border-radius:var(--pc-radius-card);overflow:hidden}.top-stats{grid-template-columns:repeat(4,minmax(0,1fr))}.top-stats>div,.money-stats>div{padding:20px 22px}.top-stats>div+div,.money-stats>div+div{border-left:1px solid var(--line)}.top-stats dt,.money-stats dt{color:var(--muted);font-size:13px;font-weight:600}.top-stats dd,.money-stats dd{margin:7px 0 3px;font:700 25px/1.15 "Manrope",sans-serif;letter-spacing:-.035em}.top-stats small,.money-stats small{color:var(--muted);font-size:var(--pc-text-label)}.chart-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:34px;padding:34px 0;border-bottom:1px solid var(--line)}.chart{min-width:0;margin:0}.chart figcaption{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.chart figcaption strong{font:650 15px "Manrope",sans-serif}.chart figcaption span{color:var(--muted);font-size:var(--pc-text-label)}.chart svg{display:block;width:100%;height:auto;max-height:250px;overflow:visible}.chart .axis,.chart .guide{stroke:var(--line)}.chart .guide{stroke-dasharray:3 5}.chart .line{fill:none;stroke:#5c9a26;stroke-width:2}.chart .area{fill:#dff1c8;opacity:.65}.chart .axis-label{fill:var(--muted);font:var(--pc-text-label) "DM Sans",sans-serif}.chart .axis-value{font-size:13px;font-weight:600}.chart-point{outline:none}.chart-point .chart-hit{fill:transparent;stroke:none}.chart-point .chart-dot{fill:var(--paper);stroke:#4f8e1f;stroke-width:2}.chart-point:focus .chart-dot{stroke:#172617;stroke-width:4}.chart-data{margin-top:8px;color:var(--muted);font-size:13px}.chart-data summary{min-height:40px;display:flex;align-items:center;cursor:pointer}.chart-empty{min-height:260px;display:grid;place-content:center;gap:6px;border-block:1px solid var(--line);text-align:center}.chart-empty p{max-width:42ch;margin:0;color:var(--muted);font-size:14px}.overview-lower{display:grid;grid-template-columns:1fr 1fr 1.2fr 1fr;gap:0;border-bottom:1px solid var(--line)}.mini{min-width:0;padding:26px 20px 26px 0}.mini+.mini{padding-left:20px;border-left:1px solid var(--line)}.mini h3,.data-head h3,.exports h3,.connection-gaps h3{margin:0;font:650 14px "Manrope",sans-serif}.bars{display:grid;gap:12px;margin:18px 0 0;padding:0;list-style:none}.bars li{display:grid;grid-template-columns:74px minmax(25px,1fr) 30px;align-items:center;gap:7px;font-size:var(--pc-text-label)}.bars li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bars i{height:6px;background:#e3e8df;border-radius:4px;overflow:hidden}.bars b{display:block;width:var(--value);height:100%;background:#79b839}.bars strong{text-align:right}.mini-head{display:flex;justify-content:space-between;align-items:center}.mini-head a{color:var(--green-dark);font-size:var(--pc-text-label);font-weight:600}.followups ul{margin:12px 0 0;padding:0;list-style:none}.followups li{display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-top:1px solid var(--line);font-size:var(--pc-text-label)}.followups li div{display:grid;min-width:0}.followups li span,.followups time{color:var(--muted)}.source-summary dl{margin:12px 0 0}.source-summary dl>div{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:var(--pc-text-label)}.status{padding:4px 8px;background:#eef1ec;color:#59615b;font-size:var(--pc-text-label);font-weight:650}.status.ok{background:var(--green-soft);color:var(--green-dark)}.status.warn{background:#fff1dc;color:#75480b}.status.quiet:before{background:#909791}.empty-copy{color:var(--muted);font-size:14px}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;margin-bottom:22px}.section-heading h2{margin:4px 0 0;font:700 19px/1.35 var(--pc-font-body);letter-spacing:-.035em}.section-heading p{max-width:68ch;margin:6px 0 0;color:var(--muted);font-size:14px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border:1px solid var(--line-strong);border-radius:var(--pc-control-radius);background:var(--white);color:var(--ink);font-size:14px;font-weight:650;text-decoration:none;cursor:pointer}.button.primary{border-color:var(--green);background:var(--green);color:var(--ink)}.button.primary:hover{background:#c5fa63;border-color:#c5fa63}.button.secondary:hover{background:var(--pc-hover-bg)}.button.danger{color:var(--red)}.button.compact{min-height:40px;padding:0 10px;font-size:13px}.split-screen{display:grid;grid-template-columns:minmax(0,1fr);gap:28px}.split-screen:has(.detail-panel){grid-template-columns:minmax(0,1fr) 340px}.list-pane{min-width:0}.table-tools{display:flex;align-items:flex-end;gap:9px;margin-bottom:14px}.table-tools .search{min-width:220px;flex:1}.table-tools input{width:100%;padding-right:10px}.filter-count{margin-left:auto;padding-bottom:10px;color:var(--muted);font-size:var(--pc-text-label)}.table-wrap{max-width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:var(--pc-control-radius);background:var(--white)}table{width:100%;border-collapse:collapse;font-size:14px}th{height:40px;padding:0 13px;background:var(--pc-surface-subtle);color:var(--muted);font:var(--pc-type-table-label);text-align:left;white-space:nowrap}td{min-height:45px;padding:11px 13px;border-top:1px solid var(--line);vertical-align:middle}tbody tr:first-child td{border-top:0}tbody tr{transition:background .12s ease}tbody tr:hover{background:var(--pc-hover-bg)}.customer-table table{min-width:900px}.customer-table td:first-child{display:grid;gap:1px}.customer-table td:first-child span{color:var(--muted);font-size:var(--pc-text-label)}.row-link{display:inline-flex;align-items:center;min-height:40px;font-weight:650;text-underline-offset:2px}.tag,.stage{padding:4px 7px;background:#ecefea;color:#4d554f;font-size:var(--pc-text-label);font-weight:650}.tag.quiet{font-weight:500}.stage.lead{background:#edf0ed}.stage.contacted{background:#e6eff4;color:#31596d}.stage.qualified{background:#fff1d5;color:#795410}.stage.customer{background:var(--green-soft);color:var(--green-dark)}.stage.archived{background:#f5e5e2;color:#83423b}.muted{color:var(--muted)}.empty-row td{height:120px;text-align:center}.empty-row strong,.empty-row span{display:block}.empty-row span{margin-top:4px;color:var(--muted)}.filter-empty{padding:30px;text-align:center;color:var(--muted)}.detail-panel{align-self:start;min-width:0;padding:20px;border:1px solid var(--line);border-radius:var(--pc-radius-card);background:var(--white)}.detail-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}.detail-head h2{margin:3px 0 0;font:700 18px "Manrope",sans-serif}.icon-close{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;color:var(--muted);font-size:24px;text-decoration:none}.icon-close:hover{background:#f0f2ed}.detail-form,.signin-panel form{display:grid;gap:14px}.field{display:grid;gap:5px}.field label,.check{font-size:14px;font-weight:600}.field :is(input,select,textarea),.cost-form :is(input,select){width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--line-strong);border-radius:var(--pc-control-radius);background:var(--white);color:var(--ink)}.field textarea{resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.check{display:flex;align-items:center;gap:8px;min-height:40px}.check input{width:18px;height:18px}.linked-identity{display:grid;gap:2px;padding:13px;background:var(--pc-surface-subtle)}.plan-panel{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}.plan-panel h3{margin:0 0 8px;font-size:16px}.plan-grants{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:8px}.plan-grants li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.plan-grants li div{display:grid;gap:2px}.plan-grants small{color:var(--muted);font-size:13px}.linked-identity span,.linked-identity small,.form-note{color:var(--muted);font-size:var(--pc-text-label)}.form-note{margin:0}.form-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:6px}.stage-strip{display:grid;grid-template-columns:repeat(5,1fr);margin-bottom:18px;border-block:1px solid var(--line)}.stage-strip a{display:grid;gap:2px;min-height:58px;padding:15px;text-decoration:none}.stage-strip a+a{border-left:1px solid var(--line)}.stage-strip strong{font:700 19px "Manrope",sans-serif}.stage-strip span{color:var(--muted);font-size:var(--pc-text-label)}.money-stats{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:28px}.money-stats>div:nth-child(5){border-left:0;border-top:1px solid var(--line)}.money-stats>div:nth-child(n+5){border-top:1px solid var(--line)}.money-stats dd{font-size:18px}.notice{margin:16px 0 0;padding:12px 14px;background:#eff7e7;font-size:14px}.notice.error{border-left-color:var(--red);background:#fff0ee;color:#7d2f29}.notice.warning{border-left-color:#bf7920;background:#fff5e6;color:#69430f}.state-block{padding:30px;border-block:1px solid var(--line);background:var(--pc-surface-subtle)}.state-block p{max-width:65ch;margin:5px 0 0;color:var(--muted)}.state-block.error{border-color:#e1b8b3;background:#fff8f7}.data-section{margin-top:28px}.data-head{display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin-bottom:12px}.data-head p{max-width:70ch;margin:0;color:var(--muted);font-size:var(--pc-text-label)}.wide table{min-width:1120px}code{display:block;max-width:180px;overflow:hidden;color:var(--muted);font-size:var(--pc-text-label);text-overflow:ellipsis;white-space:nowrap}.headline-total{text-align:right}.headline-total span{display:block;color:var(--muted);font-size:var(--pc-text-label)}.headline-total strong{font:700 22px "Manrope",sans-serif}.cost-form{display:grid;grid-template-columns:1.3fr .8fr .8fr .6fr auto;align-items:end;gap:10px;padding:18px 0;border-block:1px solid var(--line)}.cost-form label{font-size:14px}.cost-actions,.row-actions{display:flex;gap:7px}.row-actions form{margin:0}.report-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,.6fr);gap:34px}.report-layout .data-section{margin:0}.exports{padding-left:28px;border-left:1px solid var(--line)}.exports>p{color:var(--muted);font-size:14px}.exports ul{margin:18px 0 0;padding:0;border-top:1px solid var(--line);list-style:none}.exports li{border-bottom:1px solid var(--line)}.exports a{display:flex;justify-content:space-between;min-height:48px;align-items:center;text-decoration:none}.exports a:hover span{text-decoration:underline}.exports small{color:var(--muted)}.source-ledger{border-top:1px solid var(--line)}
.health-title{margin:28px 0 10px;font:650 15px "Manrope",sans-serif}
[data-health-errors] td{vertical-align:top;font-size:13px}.health-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--pc-text-label);overflow-wrap:anywhere}[data-health-errors] td:last-child{min-width:260px;overflow-wrap:anywhere}.source-ledger article{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:82px;border-bottom:1px solid var(--line)}.source-ledger h3{margin:0;font:650 14px "Manrope",sans-serif}.source-ledger p{margin:3px 0 0;color:var(--muted);font-size:14px}.connection-gaps{max-width:760px;margin-top:38px;padding:25px 0;border-block:1px solid var(--line)}.connection-gaps h3{margin-top:5px;font-size:18px}.connection-gaps p{margin:8px 0 0;color:var(--muted);font-size:14px}.signin{display:grid;place-items:center;min-height:100svh;padding:32px 16px;background:#080a08;color:#f5f7f8;color-scheme:dark}
.signin-layout{width:min(100%,430px)}.signin-wordmark{display:block;width:190px;height:auto;margin:0 auto 24px}
.signin-panel{padding:clamp(20px,5vw,34px);border:1px solid #363b36;border-radius:var(--pc-radius-card);background:#121512}
.signin-panel h1{margin:16px 0 6px;font:700 clamp(24px,4vw,28px)/1.25 var(--pc-font-body);letter-spacing:-.035em}.signin-panel p{margin:0 0 22px;color:#b5bcb5}
.signin-panel .environment{min-height:28px;height:auto;padding:3px 9px;color:#dce2dc;background:#1e231e;border-color:#3a413a}.signin-panel .field label{color:#edf0ed}
.signin-panel .field input{color:#fff;border-color:#3f473f;background:#0c100c}.signin-panel .button{width:100%;margin-top:4px}.signin-panel .notice{padding:10px 12px;margin:0 0 16px}.signin-panel .notice.error{color:#ffb9b4;background:#3b2120;border-color:#77413e}
.signin-panel .cf-turnstile{min-width:0;max-width:100%}.signin-panel .cf-turnstile iframe{max-width:100%}
small,.eyebrow{font-size:var(--pc-text-label)}.environment,.dataset-line,.top-stats small,.money-stats small{font-size:13px}.chart figcaption span,.chart-data,.bars li,.mini-head a,.followups li,.source-summary dl>div,.status,.filter-count,.customer-table td:first-child span,.tag,.stage,.linked-identity span,.linked-identity small,.form-note,.stage-strip span,.data-head p,.headline-total span,.exports small{font-size:13px}.bars li{font-size:14px}.button{white-space:nowrap;flex-shrink:0}.button.compact{min-height:40px;font-size:13px}th{height:42px;font-size:13px}code{font-size:var(--pc-text-label)}.dataset-line{flex-wrap:wrap;padding:8px 0}.dataset-line .period-window{white-space:nowrap}.dataset-line>span:last-child{white-space:nowrap}.coverage-flag{padding:3px 8px;border-radius:999px;background:#fff0d8;color:#7a4a0b;font-weight:650}.preview-banner{display:flex;align-items:center;gap:10px;min-height:46px;margin-top:14px;padding:10px 13px;border:1px solid #d18a27;background:#fff5e5;color:#65400d;font-size:14px}.preview-banner strong{white-space:nowrap}.signin-preview{margin:0 0 24px}.notice.success{border-left-color:#548f24;background:#eff7e7;color:#315f15}.source-warnings .notice+ .notice{margin-top:8px}.chart-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-plot{display:grid;grid-template-columns:78px minmax(0,1fr);align-items:stretch}.chart-plot svg{width:100%;height:190px;max-height:none}.chart-y-axis{height:190px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;padding-right:10px;color:var(--muted);font-size:13px;font-weight:600;white-space:nowrap}.chart-x-axis{display:grid;grid-template-columns:repeat(3,1fr);margin:7px 0 0 78px;color:var(--muted);font-size:13px}.chart-x-axis span:nth-child(2){text-align:center}.chart-x-axis span:last-child{text-align:right}.report-charts{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:34px;margin-bottom:34px;padding-bottom:34px;border-bottom:1px solid var(--line)}.report-charts .mini{padding:0}.report-charts .mini+.mini{padding-left:0;border-left:0}
@media(max-width:1050px){.hq-shell{grid-template-columns:var(--pc-rail-width) minmax(0,1fr)}.workspace{--workspace-x:20px}.toolbar{align-items:flex-start;padding-block:18px}.toolbar-actions{flex-wrap:wrap}.chart-grid,.report-charts{grid-template-columns:1fr}.overview-lower{grid-template-columns:1fr 1fr}.mini:nth-child(3){padding-left:0;border-left:0;border-top:1px solid var(--line)}.mini:nth-child(4){border-top:1px solid var(--line)}.money-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.money-stats>div:nth-child(4){border-left:0;border-top:1px solid var(--line)}.money-stats>div:nth-child(5){border-left:1px solid var(--line)}.money-stats>div:nth-child(7){border-left:0}.cost-form{grid-template-columns:1fr 1fr}.cost-actions{grid-column:1/-1}.split-screen:has(.detail-panel){grid-template-columns:minmax(0,1fr) 310px}.report-layout{grid-template-columns:1fr}.exports{padding:24px 0 0;border-top:1px solid var(--line);border-left:0}}
@media(max-width:850px){.top-stats{grid-template-columns:1fr 1fr}.top-stats>div:nth-child(3){border-left:0;border-top:1px solid var(--line)}.top-stats>div:nth-child(4){border-top:1px solid var(--line)}.chart-grid{grid-template-columns:1fr}.split-screen:has(.detail-panel){grid-template-columns:1fr}.detail-panel{position:relative;top:0;grid-row:1;max-height:none}.stage-strip{grid-template-columns:repeat(5,minmax(90px,1fr));overflow-x:auto}.toolbar-actions{align-items:flex-end}.table-tools{display:grid;grid-template-columns:1fr 1fr}.table-tools .search{grid-column:1/-1;min-width:0}.filter-count{margin:0;padding:8px 0}.preview-banner{align-items:flex-start;flex-direction:column}}
.support-sources{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border:1px solid var(--line);border-radius:var(--pc-control-radius);background:var(--white)}
.support-sources a{padding:7px 12px;border-radius:4px;color:var(--muted);text-decoration:none;font-size:13px;font-weight:650}.support-sources a:hover{background:var(--pc-hover-bg);color:var(--ink)}.support-sources a[aria-current]{background:var(--pc-selection-bg);color:var(--pc-selection-text)}
.support-screen{display:grid;align-items:start;gap:24px}
.support-screen.has-ticket{grid-template-columns:minmax(220px,1fr) minmax(0,2fr)}
.support-tickets,.support-messages{list-style:none;margin:0;padding:0}
.support-tickets{border:1px solid var(--line);border-radius:var(--pc-control-radius);overflow:hidden}
.support-tickets li+li,.support-messages li+li{border-top:1px solid var(--line)}
.support-tickets a{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 12px;text-decoration:none;color:var(--ink)}
.support-tickets a:hover{background:var(--pc-hover-bg)}.support-tickets a[aria-current]{background:var(--pc-selection-bg)}
.support-ticket-label,.support-ticket-meta{display:grid;gap:5px;min-width:0}
.support-ticket-label{overflow-wrap:anywhere}.support-ticket-label strong{font-weight:650}
.support-ticket-label small,.support-ticket-meta time,.support-messages time{font-size:13px;color:var(--muted)}
.support-ticket-meta{justify-items:end;text-align:right;flex-shrink:0}
.has-ticket .support-tickets a{display:grid;gap:7px}.has-ticket .support-ticket-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;text-align:left}
.support-detail{min-width:0;max-height:none;position:static;overflow:visible}.support-detail .detail-head{margin-bottom:0}
.support-detail h2,.support-detail .detail-head p{overflow-wrap:anywhere}
.support-messages li{padding:16px 0}.support-messages li>div{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}
.support-staff-author{display:inline-flex;align-items:center;gap:6px;color:var(--green-dark)}
.support-staff-author span{padding:2px 7px;border-radius:999px;background:var(--pc-selection-bg);font-size:var(--pc-text-label);line-height:1.4}
.support-messages p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;max-width:76ch}
.support-detail textarea{width:100%;min-height:90px;resize:vertical}
@media(max-width:850px){.support-screen.has-ticket{display:block}.support-screen.has-ticket>.list-pane{display:none}.support-detail{padding:16px}.support-tickets a{align-items:start}}
@media(max-width:650px){
  .hq-shell{grid-template-columns:56px minmax(0,1fr)}.workspace{--workspace-x:14px}
  .rail nav a{min-height:52px}.rail nav span,.hq-user-name{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  .toolbar{gap:12px}.toolbar-actions{width:100%;align-items:flex-start}.toolbar-form{flex-wrap:wrap;max-width:100%}.toolbar-form label{min-width:0;max-width:100%}
  .toolbar-form .pc-custom-select-trigger{max-width:100%;min-width:0}.section-heading,.data-head{flex-wrap:wrap;gap:10px}
  .top-stats>div,.money-stats>div{min-width:0;padding:12px 8px;overflow-wrap:anywhere}.money-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .table-tools{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.table-tools .search{min-width:0}.overview-lower{grid-template-columns:minmax(0,1fr)}.mini,.mini+.mini{padding:18px 0;border-left:0;border-top:1px solid var(--line)}.chart-plot{grid-template-columns:52px minmax(0,1fr)}
  .cost-form{grid-template-columns:minmax(0,1fr)}.two-fields{grid-template-columns:minmax(0,1fr)}.detail-form input,.detail-form textarea,.cost-form input{min-width:0}.support-sources a{min-height:40px;display:inline-flex;align-items:center;padding-inline:8px}
}
@media(max-width:550px){.support-tickets a{display:grid;gap:7px}.support-ticket-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;text-align:left}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important}}
`;

const clientScript = `<script>(()=>{const feedback=document.querySelector('[data-feedback]');if(feedback)feedback.focus();document.querySelectorAll('[data-pending-form]').forEach(form=>form.addEventListener('submit',event=>{if(form.dataset.submitting==='true'){event.preventDefault();return;}form.dataset.submitting='true';form.setAttribute('aria-busy','true');const button=form.querySelector('[data-submit-label]');if(button){button.dataset.original=button.textContent||'';setTimeout(()=>{if(form.dataset.submitting==='true')button.textContent='Working…';},0);}}));window.addEventListener('pageshow',event=>{if(!event.persisted)return;document.querySelectorAll('[data-pending-form]').forEach(form=>{delete form.dataset.submitting;form.removeAttribute('aria-busy');const button=form.querySelector('[data-submit-label]');if(button&&button.dataset.original)button.textContent=button.dataset.original;});});})();</script>`;
