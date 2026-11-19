import a from 'node:assert/strict';
import { test } from 'vitest';
import { accountSettingsPage, dashboardPage } from '../src/account-pages.ts';
import type { User } from '../src/auth.ts';

const owner: User = {
  id: '328a15d0-0837-4881-8b47-38d316c03f95',
  email: 'river@example.test',
  name: 'River',
  plan: 'free',
};
const storage = { usedBytes: 25 * 1024 ** 2, limitBytes: Number.MAX_SAFE_INTEGER };

test('the exempt account can open site creation and sees actual media usage with no ceiling', () => {
  const html = dashboardPage(owner, [], 13, storage);
  a.match(html, /Unrestricted · 13 owned sites · 25 MB media used/);
  a.match(html, /data-create-open>Add new site/);
  a.match(html, /<dialog class="pc-create-modal/);
  a.doesNotMatch(html, /Site limit reached|Ask for more sites|25 MB of /);
});

test('the exempt account has unlimited site and media rows regardless of its stored plan', () => {
  for (const plan of ['free', 'launch', 'studio', 'pro'] as const) {
    const html = accountSettingsPage({ ...owner, plan }, { providers: [], ownerCount: 13, storage, billingDetailsAvailable: true }, { tab: 'plan' });
    const panel = html.split('id="settings-panel-plan"')[1].split('</section>')[0];
    a.match(panel, /<span class="pc-plan-badge">Unrestricted<\/span>/);
    a.match(panel, /13 used · Unlimited/);
    a.match(panel, /25 MB used · Unlimited/);
    a.match(panel, /href="\/account\/plans">Billing details/);
    a.doesNotMatch(panel, /meter|Ask for more sites|upgrade|choose plan|current plan|25 MB of /i);
  }
  const disabled = accountSettingsPage(owner, { providers: [], ownerCount: 0, storage });
  a.doesNotMatch(disabled, /href="\/account\/plans"/);
});
