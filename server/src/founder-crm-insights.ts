import type { FounderCrmData } from './founder-crm-types.ts';

/** Creation comparisons use retained inventory, not traffic or historical conversion. */
export function founderCrmInsights(data: FounderCrmData) {
  const start = Date.parse(data.periodStart), end = Date.parse(data.periodEnd);
  const validPeriod = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const previousStart = start - (end - start + 1);
  const visibleIds = new Set(data.customers.flatMap(row => row.accountId ? [row.accountId] : []));
  const available = data.platform.state === 'available' && data.platform.snapshot !== null;
  const accounts = data.platform.snapshot?.accounts.filter(row => data.includeTests || visibleIds.has(row.id)) || [];
  const sites = data.platform.snapshot?.sites.filter(row => data.includeTests || row.ownerIds.length === 0 || row.ownerIds.some(id => visibleIds.has(id))) || [];
  const count = (values: (string | null)[], previous = false) => available && validPeriod
    ? values.filter(value => {
      const time = value ? Date.parse(value) : NaN;
      return previous ? time >= previousStart && time < start : time >= start && time <= end;
    }).length : null;
  return {
    newAccounts: count(accounts.map(row => row.createdAt)),
    previousAccounts: count(accounts.map(row => row.createdAt), true),
    newSites: count(sites.map(row => row.createdAt)),
    previousSites: count(sites.map(row => row.createdAt), true),
    unpublishedAccounts: available ? accounts.filter(row => row.publishedSites === 0).length : null,
    followUpsDue: data.crm.state === 'available' ? data.analytics.followUps.length : null,
  };
}
