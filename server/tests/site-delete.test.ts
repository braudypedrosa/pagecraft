/* Deleting a site from its settings page: the database delete decides, and only then do the
   environment's per-site files go — inbox, preview, publication pointer, integration, analytics,
   assistant tokens, schedules, review records and live-review links. A failed delete must leave
   every one of them where it was; a failed cleanup after a successful delete is only logged. */
import { afterEach, test, vi } from 'vitest';
import a from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { FileSubmissionStore } from '../src/submissions.ts';
import { FileSitePreviewStore } from '../src/site-previews.ts';
import { FileCloudConnectionStore, UplistingClient } from '../src/cloud-uplisting.ts';
import { AnalyticsRecorder, FileAnalyticsStore } from '../src/analytics.ts';
import { FileAssistantStore } from '../src/assistants.ts';
import { FilePublicationScheduleStore } from '../src/schedules.ts';
import { FilePublicationReviewStore } from '../src/reviews.ts';
import { LiveReviewStore } from '../src/live-reviews.ts';
import { blankDoc } from '../src/render.ts';

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function rig() {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-site-delete-'));
  roots.push(root);
  const store = new MemoryStore(), auth = new MemoryAuthStore();
  const publications = new MemoryHostedPublicationStore();
  const files = {
    submissions: new FileSubmissionStore(join(root, '.submissions')),
    sitePreviews: new FileSitePreviewStore(join(root, '.dashboard-previews')),
    connections: new FileCloudConnectionStore(root + '-integrations'),
    analytics: new FileAnalyticsStore(join(root, '.analytics')),
    assistants: new FileAssistantStore(join(root, '.assistants')),
    schedules: new FilePublicationScheduleStore(root),
    reviews: new FilePublicationReviewStore(root),
    liveReviews: new LiveReviewStore(join(root, '.live-reviews', 'reviews.json')),
  };
  roots.push(root + '-integrations');
  let sent = '';
  const app = createApp({
    store, auth, publications, editorHtml: '<title>Builder</title>', editorHost: 'admin.test',
    editorOrigin: 'http://admin.test', sendLink: (_to, url) => { sent = url; },
    submissions: files.submissions, sitePreviews: files.sitePreviews,
    cloudIntegrations: { connections: files.connections, client: new UplistingClient() },
    analytics: new AnalyticsRecorder(files.analytics), assistants: files.assistants,
    schedules: files.schedules, reviews: files.reviews, liveReviews: files.liveReviews,
  });
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const make = async (name: string, host: string) => {
    const site = await store.create({ host, name, doc: blankDoc(name) });
    await auth.grant(site.id, owner.id, 'owner');
    await files.submissions.add(site.id, {
      id: randomUUID(), formId: 'contact', formName: 'Contact', createdAt: new Date().toISOString(),
      status: 'new', values: [{ label: 'Email', value: 'visitor@example.test' }],
    });
    await files.sitePreviews.put(site.id, 'v1', new Uint8Array([1, 2, 3]));
    await files.connections.put(site.id, { key: 'secret', collectionId: 'c1', selected: [] });
    await files.analytics.setEnabled(site.id, true, owner.id);
    await files.assistants.createToken(site.id, 'Assistant', owner.id);
    await files.schedules.create({
      siteId: site.id, snapshotId: randomUUID(), baselinePublicationId: null,
      publishAt: new Date(Date.now() + 86_400_000).toISOString(), createdBy: owner.id,
      idempotencyKey: `schedule-${site.id}`,
    });
    await files.reviews.assign({
      siteId: site.id, publicationId: randomUUID(), reviewerUserId: owner.id, assignedBy: owner.id,
    });
    await files.liveReviews.createLink(site.id, 'public');
    return site;
  };
  const doomed = await make('Doomed', 'doomed.test');
  const kept = await make('Kept', 'kept.test');

  const admin = (path: string, init: RequestInit = {}, cookie = '') => app.request(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers || {}) },
  }));
  a.equal((await admin('/auth/login', { method: 'POST', body: JSON.stringify({ email: owner.email }) })).status, 200);
  const callback = await admin(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (callback.headers.get('set-cookie') || '').split(';')[0];
  const remove = (site: { id: string; name: string }) => admin(`/sites/${site.id}/settings/delete`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ confirmation: site.name }).toString(),
  }, cookie);

  /* Fresh file-backed readers, so what is checked is what is on disk. */
  const present = async (siteId: string) => ({
    submissions: (await files.submissions.list(siteId)).length > 0,
    preview: !!(await files.sitePreviews.get(siteId)),
    integration: !!(await files.connections.get(siteId)),
    /* Deleting analytics keeps a small settings.json (off, with a reset time) so that counts
       another process still holds can't come back; anything beyond it is a leftover. */
    analytics: existsSync(files.analytics.dir(siteId))
      && (readdirSync(files.analytics.dir(siteId)).some(name => name !== 'settings.json')
        || (await files.analytics.settings(siteId)).enabled),
    assistant: existsSync(files.assistants.dir(siteId)),
    schedule: (await new FilePublicationScheduleStore(root).forSite(siteId)).length > 0,
    review: (await new FilePublicationReviewStore(root).assignmentsForSite(siteId)).length > 0,
    liveReview: (await new LiveReviewStore(join(root, '.live-reviews', 'reviews.json')).links(siteId)).length > 0,
  });
  const everything = { submissions: true, preview: true, integration: true, analytics: true, assistant: true, schedule: true, review: true, liveReview: true };
  const nothing = Object.fromEntries(Object.keys(everything).map(key => [key, false]));
  return { store, publications, files, doomed, kept, remove, present, everything, nothing };
}

test('a failed database delete leaves the site and every one of its files in place', async () => {
  const { store, publications, doomed, remove, present, everything } = await rig();
  const tombstones: string[] = [];
  const removeSite = publications.removeSite.bind(publications);
  publications.removeSite = async (siteId) => { tombstones.push(siteId); return removeSite(siteId); };
  store.delete = async () => { throw new Error('gateway unavailable'); };
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  a.equal((await remove(doomed)).status, 500);
  a.ok(await store.byId(doomed.id), 'the site is still listed');
  a.deepEqual(await present(doomed.id), everything);
  a.deepEqual(tombstones, [], 'the public address stays up for a site that was not deleted');
});

test('a successful delete then removes only that site\'s files', async () => {
  const { store, publications, doomed, kept, remove, present, everything, nothing } = await rig();
  const order: string[] = [];
  const deleteSite = store.delete.bind(store), removeSite = publications.removeSite.bind(publications);
  store.delete = async (id) => { order.push('database'); return deleteSite(id); };
  publications.removeSite = async (siteId) => { order.push(`tombstone ${siteId}`); return removeSite(siteId); };

  const response = await remove(doomed);
  a.equal(response.status, 303);
  a.equal(response.headers.get('location'), '/?message=Site+deleted.');
  a.equal(await store.byId(doomed.id), null);
  a.deepEqual(order, ['database', `tombstone ${doomed.id}`]);
  a.deepEqual(await present(doomed.id), nothing);
  a.deepEqual(await present(kept.id), everything);
});

test('a cleanup failure after the database delete is logged, not reported as a failed delete', async () => {
  const { store, publications, files, doomed, remove, present } = await rig();
  publications.removeSite = async () => { throw new Error('fixture pointer failure'); };
  files.assistants.removeSite = async () => { throw new Error('fixture assistant failure'); };
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  a.equal((await remove(doomed)).status, 303);
  a.equal(await store.byId(doomed.id), null);
  const lines = logged.mock.calls.map(args => String(args[0]));
  a.ok(lines.some(line => line.includes(doomed.id) && line.includes('publication')), lines.join('\n'));
  a.ok(lines.some(line => line.includes(doomed.id) && line.includes('assistant')), lines.join('\n'));
  const left = await present(doomed.id);
  a.equal(left.assistant, true, 'the failing store kept its files');
  a.equal(left.submissions || left.schedule || left.review || left.liveReview, false,
    'one failure does not stop the rest of the cleanup');
});
