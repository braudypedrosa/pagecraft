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

test('Free dashboard keeps its public allowance and disables creation at three owned sites', () => {
  const html = dashboardPage(
    user(),
    [],
    3,
    { usedBytes: 2 * MB, limitBytes: 100 * MB },
  );

  a.match(html, /3 of 3 owned sites · 2 MB of 100 MB media used/);
  a.match(html, /<button class="pc-btn primary" type="button" disabled>Add new site<\/button>/);
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
  a.doesNotMatch(html, /disabled>Add new site/);
  a.doesNotMatch(html, /aria-[^>]*(?:Infinity|NaN)/);
});

test('Free account settings keep the Free plan details and finite owned-sites meter', () => {
  const html = accountSettingsPage(user(), {
    providers: ['email'],
    ownerCount: 2,
    storage: { usedBytes: 25 * MB, limitBytes: 100 * MB },
  }, { tab: 'plan' });

  a.match(html, /<span class="pc-plan-badge">Free<\/span>/);
  a.match(html, /\$0 <span>current plan<\/span>/);
  a.match(html, /2 of 3 used/);
  a.match(html, /aria-label="Owned sites used"[^>]*aria-valuemax="3"[^>]*aria-valuenow="2"/);
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

  a.match(html, /<span class="pc-plan-badge">Pro<\/span>/);
  a.match(html, /Complimentary <span>private plan<\/span>/);
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
    3,
    { usedBytes: 0, limitBytes: 100 * MB },
  );

  a.match(html, /3 of 3 owned sites/);
  a.match(html, /disabled>Add new site/);
  a.doesNotMatch(html, /Unlimited owned sites/);
});
