import { test } from 'vitest';
import a from 'node:assert/strict';
import {
  siteOverviewPage, siteSettingsPage, siteAnalyticsPage, sitePeoplePage, siteReviewsPage,
  siteIntegrationsPage, siteSubmissionsPage,
} from '../src/account-pages.ts';

/* S1: every site page has one header — title, one line, the page's action and Edit site on the
   right — and no back link; the site rail is the navigation. Reviewers cannot edit. */
const user = { id: 'u1', email: 'owner@example.invalid', name: 'Owner' } as never;
const site = (role = 'owner') => ({ id: 's1', name: 'Header QA', slug: 'header-qa', url: 'https://example.invalid/header-qa/', role, version: 2, publishedVersion: 0, live: false, updatedAt: '2026-11-20T08:00:00.000Z', createdAt: '2026-11-19T08:00:00.000Z' }) as never;
const header = (html: string) => {
  const start = html.indexOf('<header class="pc-'), at = html.indexOf('pc-workspace-head', start);
  a.ok(start >= 0 && at > start, 'a site page header');
  return html.slice(start, html.indexOf('</header>', at) + 9);
};
const editSite = /<a class="pc-btn" href="\/edit\/s1">Edit site<\/a>/;

const pages = (role: string) => ({
  overview: siteOverviewPage(user, site(role)),
  settings: siteSettingsPage(user, site(role)),
  analytics: siteAnalyticsPage(user, site(role), { available: false, enabled: false, timeZone: 'UTC' } as never),
  people: sitePeoplePage(user, site(role), []),
  reviews: siteReviewsPage(user, site(role), { links: [] }),
  integrations: siteIntegrationsPage(user, site(role), { enabled: true, connected: false, selected: [] }),
  submissions: siteSubmissionsPage(user, site(role), role as never, [], [], '', '', 1),
});

test('no site page carries a back link to the overview or the site list', () => {
  for (const [name, html] of Object.entries(pages('owner'))) {
    const head = header(html);
    a.doesNotMatch(head, /pc-manage-back/, `${name} has no back link`);
    a.doesNotMatch(head, /Back to builder/, `${name} says Edit site, not Back to builder`);
  }
});

test('every site page offers Edit site in its header to someone who can edit', () => {
  for (const [name, html] of Object.entries(pages('owner'))) {
    if (name === 'overview') { a.match(header(html), /<a class="pc-btn primary" href="\/edit\/s1">Edit site<\/a>/); continue; }
    a.match(header(html), editSite, `${name} header has Edit site`);
  }
});

test('a reviewer gets no Edit site on the pages they can open', () => {
  const reviewer = pages('reviewer');
  for (const name of ['people', 'reviews', 'submissions'] as const) a.doesNotMatch(header(reviewer[name]), editSite, name);
});

test('the page action stays beside Edit site', () => {
  const owner = pages('owner');
  a.match(header(owner.reviews), /Create review link<\/button><a class="pc-btn" href="\/edit\/s1">Edit site/);
  a.match(header(owner.integrations), /Add integration<\/button><a class="pc-btn" href="\/edit\/s1">Edit site/);
});

test('the Submissions view inside the editor keeps Back to builder', () => {
  const embedded = siteSubmissionsPage(user, site(), 'owner' as never, [], [], '', '', 1, true);
  a.match(header(embedded), /pagecraft:close-submissions[^>]*>Back to builder<\/button>/);
});

test('S7: settings save buttons start secondary and wake up only when their field changes', async () => {
  const { JSDOM } = await import('jsdom' as string) as { JSDOM: new (html: string, options?: object) => any };
  const html = siteSettingsPage(user, site());
  a.match(html, /<button class="pc-btn" type="submit" data-dirty-submit>Save name<\/button>/);
  a.match(html, /<button class="pc-btn" type="submit" data-dirty-submit>Update address<\/button>/);
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const { document, Event } = dom.window;
  const save = [...document.querySelectorAll('[data-dirty-submit]')] as HTMLButtonElement[];
  a.deepEqual(save.map(b => b.disabled), [true, true], 'nothing to save yet');
  const name = document.querySelector('#site-settings-name') as HTMLInputElement;
  name.value = 'Header QA renamed'; name.dispatchEvent(new Event('input'));
  a.equal(save[0].disabled, false); a.ok(save[0].classList.contains('primary'));
  a.equal(save[1].disabled, true, 'the other section stays asleep');
  name.value = 'Header QA'; name.dispatchEvent(new Event('input'));
  a.equal(save[0].disabled, true, 'back to the saved value');
});
