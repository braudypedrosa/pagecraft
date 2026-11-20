import { test } from 'vitest';
import a from 'node:assert/strict';
import {
  dashboardPage, notificationsPage, siteOverviewPage, siteSettingsPage, sitePeoplePage, siteReviewsPage,
  siteIntegrationsPage, siteSubmissionsPage, siteAnalyticsPage,
} from '../src/account-pages.ts';
import { cloudHeader } from '../src/cloud-header.ts';

/* D5 + S8 (option A): rails hold places. Owned/Shared filter the site list from the toolbar, and only
   for someone with shared sites; a site's pages put "Sites / site name" in the top bar instead of a
   ninth rail item. */
const user = { id: 'u1', email: 'owner@example.invalid', name: 'Owner' } as never;
const storage = { usedBytes: 0, limitBytes: 100 * 1024 * 1024 };
const card = (id: string, role: string) => ({ id, name: `Site ${id}`, url: `https://example.invalid/${id}/`, role, updatedAt: '2026-11-20T08:00:00.000Z', published: false, live: false }) as never;
const rail = (html: string) => html.slice(html.indexOf('<nav class="pc-rail'), html.indexOf('</nav>', html.indexOf('<nav class="pc-rail')) + 6);
const railLabels = (html: string) => [...rail(html).matchAll(/<span>([^<]+)<\/span><\/a>/g)].map(m => m[1]);

test('D5: a solo owner sees one Sites rail item and no Owned/Shared filter', () => {
  const html = dashboardPage(user, [card('a', 'owner'), card('b', 'owner')], 2, storage);
  a.deepEqual(railLabels(html), ['Sites']);
  a.match(rail(html), /<a href="\/" aria-current="page">/);
  a.doesNotMatch(html, /data-site-view=/);
  a.doesNotMatch(html, /pc-view-filter" role/);
});

test('D5: with a shared site the filter sits in the toolbar, after search and sort', () => {
  const html = dashboardPage(user, [card('a', 'owner'), card('b', 'editor')], 1, storage);
  a.deepEqual(railLabels(html), ['Sites'], 'still not in the rail');
  const toolbar = html.slice(html.indexOf('<div class="pc-toolbar">'), html.indexOf('<div class="pc-toolbar">') + 2000);
  a.match(toolbar, /data-site-sort>.*<\/select><\/label><div class="pc-view-filter" role="group" aria-label="Show sites"><button type="button" data-site-view="sites" aria-pressed="true">All<\/button><button type="button" data-site-view="owned" aria-pressed="false">Owned by you<\/button><button type="button" data-site-view="shared" aria-pressed="false">Shared with you<\/button><\/div><\/div>/s);
});

test('D5: the toolbar filter narrows the list in the page', async () => {
  const { JSDOM } = await import('jsdom' as string) as { JSDOM: new (html: string, options?: object) => any };
  const html = dashboardPage(user, [card('a', 'owner'), card('b', 'editor'), card('c', 'reviewer')], 1, storage);
  const { window } = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const doc = window.document;
  const shown = () => [...doc.querySelectorAll('[data-site-card]')].filter((c: any) => !c.hidden).map((c: any) => c.dataset.role);
  const pick = (view: string) => (doc.querySelector(`[data-site-view="${view}"]`) as any).click();
  a.deepEqual(shown().sort(), ['editor', 'owner', 'reviewer']);
  pick('owned'); a.deepEqual(shown(), ['owner']);
  a.equal(doc.querySelector('[data-site-view="owned"]').getAttribute('aria-pressed'), 'true');
  pick('shared'); a.deepEqual(shown().sort(), ['editor', 'reviewer']);
  pick('sites'); a.equal(shown().length, 3);
  window.close();
});

test('D5: account pages share the places-only rail', () => {
  const html = notificationsPage(user, []);
  a.deepEqual(railLabels(html), ['Sites']);
});

test('S8: site pages have eight rail items and Sites / site name in the top bar', () => {
  const site = (role = 'owner') => ({ id: 's1', name: 'Header <QA>', slug: 'header-qa', url: 'https://example.invalid/header-qa/', role, version: 2, publishedVersion: 0, live: false, updatedAt: '2026-11-20T08:00:00.000Z', createdAt: '2026-11-19T08:00:00.000Z' }) as never;
  const pages = {
    overview: siteOverviewPage(user, site()),
    settings: siteSettingsPage(user, site()),
    analytics: siteAnalyticsPage(user, site(), { available: false, enabled: false, timeZone: 'UTC' } as never),
    people: sitePeoplePage(user, site(), []),
    reviews: siteReviewsPage(user, site(), { links: [] }),
    integrations: siteIntegrationsPage(user, site(), { enabled: true, connected: false, selected: [] }),
    submissions: siteSubmissionsPage(user, site(), 'owner' as never, [], [], '', '', 1),
  };
  for (const [name, html] of Object.entries(pages)) {
    a.doesNotMatch(rail(html), /<span>Sites<\/span>/, `${name}: Sites is not a rail item`);
    a.match(html, /<nav class="pc-docname pc-crumbs" aria-label="Breadcrumb"><a class="pc-crumb" href="\/">Sites<\/a><span class="pc-crumbsep" aria-hidden="true">\/<\/span><span aria-current="page">Header &lt;QA&gt;<\/span><\/nav>/, `${name}: breadcrumb, escaped`);
  }
  a.deepEqual(railLabels(pages.overview), ['Overview', 'People', 'Reviews', 'Submissions', 'Analytics', 'Assistants', 'Integrations', 'Settings']);
});

test('pages outside a site keep a plain title', () => {
  a.match(cloudHeader('Sites', ''), /<span class="pc-docname">Sites<\/span>/);
  a.doesNotMatch(dashboardPage(user, [], 0, storage), /aria-label="Breadcrumb"/);
});
