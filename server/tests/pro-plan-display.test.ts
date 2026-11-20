import a from 'node:assert/strict';
import { test } from 'vitest';
import type { User } from '../src/auth.ts';
import { accountSettingsPage, dashboardPage } from '../src/account-pages.ts';

const MB = 1024 * 1024;
const GB = 1024 * MB;

const user = (plan?: string): User => ({
  id: 'user-1',
  email: 'builder@example.test',
  name: 'Builder',
  ...(plan ? { plan } : {}),
} as unknown as User);

test('Free dashboard keeps its public allowance and disables creation at one owned site', () => {
  const html = dashboardPage(
    user(),
    [],
    1,
    { usedBytes: 2 * MB, limitBytes: 100 * MB },
  );

  a.match(html, /1 of 1 owned sites · 2 MB of 100 MB media used/);
  a.match(html, /The Free plan includes 1 site in total, including drafts\. Your existing sites stay available/);
  a.match(html, /<button class="pc-btn primary" type="button" disabled aria-describedby="site-limit" title="You.ve used the 1 site on the Free plan\.">Add new site<\/button>/);
  a.match(html, /<h2>Site limit reached<\/h2>/);
  a.doesNotMatch(html, />Pro</);
  a.doesNotMatch(html, /Unlimited owned sites/);
});

test('Pro dashboard shows unlimited owned sites and never disables creation by site count', () => {
  const html = dashboardPage(
    user('pro'),
    [],
    42,
    { usedBytes: 1.5 * GB, limitBytes: 5 * GB },
  );

  a.match(html, /Unlimited owned sites · 42 used · 1\.5 GB of 5 GB media used/);
  a.match(html, /<button class="pc-btn primary" type="button" data-create-open>Add new site<\/button>/);
  a.match(html, /<p>Unlimited owned sites<\/p>/);
  a.doesNotMatch(html, /Site limit reached/);
  a.doesNotMatch(html, /disabled aria-describedby="site-limit"[^>]*>Add new site/);
  a.doesNotMatch(html, /aria-[^>]*(?:Infinity|NaN)/);
});

test('Free account settings keep the Free plan details and finite owned-sites meter', () => {
  const html = accountSettingsPage(user(), {
    providers: ['email'],
    ownerCount: 0,
    storage: { usedBytes: 25 * MB, limitBytes: 100 * MB },
  }, { tab: 'plan' });

  a.match(html, /<h3 class="pc-plan-name">Current Plan: Free<\/h3>/);
  a.match(html, /0 of 1 used/);
  a.match(html, /aria-label="Owned sites used"[^>]*aria-valuemax="1"[^>]*aria-valuenow="0"/);
  a.match(html, /<li>1 owned site, drafts included<\/li>/);
  a.doesNotMatch(html, /Up to 3 owned sites/);
  a.match(html, /25 MB of 100 MB/);
  a.match(html, /Paid plans are not available yet/);
  a.doesNotMatch(html, />Pro<\/span>/);
});

test('Pro account settings show private complimentary allowances without an unlimited meter', () => {
  const html = accountSettingsPage(user('pro'), {
    providers: ['email'],
    ownerCount: 42,
    storage: { usedBytes: 1.5 * GB, limitBytes: 5 * GB },
  }, { tab: 'plan' });

  a.match(html, /<h3 class="pc-plan-name">Current Plan: Pro<\/h3>/);
  a.match(html, /42 used · Unlimited/);
  a.match(html, /Unlimited owned sites/);
  a.match(html, /5 GB optimized media storage/);
  a.match(html, /This private complimentary plan is assigned to your account/);
  a.match(html, /aria-label="Media storage used"[^>]*aria-valuemax="5368709120"/);
  a.doesNotMatch(html, /aria-label="Owned sites used"/);
  a.doesNotMatch(html, /aria-[^>]*(?:Infinity|NaN)/);
  a.doesNotMatch(html, /(?:Upgrade|Buy Pro|Choose Pro)/i);
});

test('unknown account plans fall back to the public Free display', () => {
  const html = dashboardPage(
    user('unknown'),
    [],
    1,
    { usedBytes: 0, limitBytes: 100 * MB },
  );

  a.match(html, /1 of 1 owned sites/);
  a.match(html, /disabled aria-describedby="site-limit"[^>]*>Add new site/);
  a.doesNotMatch(html, /Unlimited owned sites/);
});

test('Free accounts that already own more than one site keep them and see the limit, not an error', () => {
  const html = dashboardPage(
    user(),
    [],
    3,
    { usedBytes: 0, limitBytes: 100 * MB },
  );
  a.match(html, /3 of 1 owned sites/);
  a.match(html, /disabled aria-describedby="site-limit"[^>]*>Add new site/);
  a.match(html, /<h2>Site limit reached<\/h2>/);
  a.match(html, /Your existing sites stay available to edit and publish/);
  a.doesNotMatch(html, /-\d+ sites? remaining/);
  const settings = accountSettingsPage(user(), {
    providers: ['email'],
    ownerCount: 3,
    storage: { usedBytes: 0, limitBytes: 100 * MB },
  }, { tab: 'plan' });
  a.match(settings, /3 of 1 used/);
  a.match(settings, /aria-valuemax="1" aria-valuenow="1" aria-valuetext="3 of 1 owned sites used"><span style="width:100%">/);
});

test('Account settings link to the plans page only when paid plans can be bought', () => {
  const data = { providers: ['email'], ownerCount: 1, storage: { usedBytes: 0, limitBytes: 100 * MB } };
  const off = accountSettingsPage(user(), data, { tab: 'plan' });
  a.doesNotMatch(off, /href="\/account\/plans"/);
  const on = accountSettingsPage(user(), { ...data, paidPlans: true }, { tab: 'plan' });
  a.match(on, /<a class="pc-btn primary" href="\/account\/plans">Upgrade plan<\/a>/);
  a.doesNotMatch(on, /Paid plans are not available yet/);
});

test('Paid account settings show the paid plan allowances, not the Free copy', () => {
  const html = accountSettingsPage(user('launch'), {
    providers: ['email'], ownerCount: 2, storage: { usedBytes: 200 * MB, limitBytes: 1 * GB }, paidPlans: true,
  }, { tab: 'plan' });
  a.match(html, /<h3 class="pc-plan-name">Current Plan: Launch<\/h3>/);
  a.match(html, /<li>Up to 5 owned sites, drafts included<\/li>/);
  a.match(html, /<li>1 GB optimized media storage<\/li>/);
  a.doesNotMatch(html, /\$0 <span>|100 MB optimized/);
  a.match(html, /href="\/account\/plans">Manage plan<\/a>/);
});

test('account billing opens the cancellation review and offers renewal once cancellation is scheduled', () => {
  const data = { providers: ['email'], ownerCount: 1, storage: { usedBytes: 0, limitBytes: GB }, paidPlans: true };
  const period = { currentPeriodEnd: '2026-12-19T22:28:42Z' };
  const panel = (scheduledChange: 'cancel' | null) => accountSettingsPage(user('launch'), {
    ...data, subscription: { ...period, scheduledChange },
  }, { tab: 'plan' }).split('id="settings-panel-plan"')[1].split('</section>')[0];
  a.match(panel(null), /action="\/account\/plans\/review"[^>]*><input type="hidden" name="action" value="cancel"><button[^>]*>Cancel plan</);
  const scheduled = panel('cancel');
  a.match(scheduled, /Auto-renew is off\.[\s\S]*December 19, 2026<\/time>\.[\s\S]*published sites stay online/);
  a.match(scheduled, /name="action" value="renew"><button[^>]*>Turn on auto-renew</);
  a.doesNotMatch(scheduled, />Cancel plan</);
  a.doesNotMatch(accountSettingsPage(user('launch'), data), />Cancel plan</);
});
