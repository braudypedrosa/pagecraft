import { test } from 'vitest';
import a from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { MemoryPublicationReviewStore } from '../src/reviews.ts';
import type { Doc } from '../../app/src/core/types.ts';

const fixture = async ({ snapshot = true, reviewer = true, publicationStore = true } = {}) => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const publications = new MemoryHostedPublicationStore();
  const reviews = new MemoryPublicationReviewStore();
  const notices: string[] = [];
  const site = await store.create({
    host: 'workshop.test', name: 'Workshop review', slug: 'workshop-review',
    doc: { schemaVersion: 1, pages: [{ id: 'home', name: 'Home', slug: 'index', html: '', css: '' }], meta: { collections: [] } } as unknown as Doc,
  });
  const owner = await auth.createUser('owner@example.test', 'Workshop owner');
  const visitor = await auth.createUser('reviewer@example.test', 'Workshop reviewer');
  const content = await auth.createUser('content@example.test', 'Workshop editor');
  await auth.grant(site.id, owner.id, 'owner');
  if (reviewer) await auth.grant(site.id, visitor.id, 'reviewer');
  await auth.grant(site.id, content.id, 'content');
  const prepare = (siteId = site.id, sourceVersion = 3) => publications.create({
    siteId, slug: 'workshop-review', host: 'workshop.test', sourceVersion,
    files: [{ path: 'index.html', mediaType: 'text/html', bytes: new TextEncoder().encode('<!doctype html><title>Workshop</title>') }],
  });
  const prepared = snapshot ? await prepare() : null;
  const app = createApp({
    store, auth, publications: publicationStore ? publications : undefined, reviews,
    editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>',
    sendNotice: (to) => { notices.push(to); },
  });
  const cookie = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookie(owner.id);
  const reviewerCookie = await cookie(visitor.id);
  const contentCookie = await cookie(content.id);
  const path = `/sites/${site.id}/reviews`;
  const request = (session = ownerCookie, route = path, body?: URLSearchParams) => app.request(new Request(`http://admin.test${route}`, {
    method: body ? 'POST' : 'GET',
    headers: { host: 'admin.test', cookie: session, ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    ...(body ? { body } : {}),
  }));
  const page = async () => {
    const response = await request();
    a.equal(response.status, 200);
    return new JSDOM(await response.text(), { url: `http://admin.test${path}` });
  };
  return { site, auth, publications, reviews, notices, visitor, content, prepared, prepare, request, page, path, reviewerCookie, contentCookie };
};

test('owner assigns the exact selected snapshot to an existing reviewer through the rendered form', async () => {
  const f = await fixture();
  const later = await f.prepare(f.site.id, 8);
  const foreign = await f.prepare(randomUUID(), 99);
  const dom = await f.page();
  try {
    const document = dom.window.document;
    const dialog = document.querySelector('#assign-snapshot-dialog')!;
    const form = dialog.querySelector('form')!;
    const snapshots = form.querySelector<HTMLSelectElement>('[name="publicationId"]')!;
    const reviewers = form.querySelector<HTMLSelectElement>('[name="reviewerUserId"]')!;
    a.ok(document.querySelector('[data-open-dialog="assign-snapshot-dialog"]'));
    a.equal(form.method, 'post');
    a.equal(form.action, `http://admin.test${f.path}/assign`);
    a.equal(dialog.getAttribute('aria-labelledby'), 'assign-snapshot-title');
    a.deepEqual(new Set([...snapshots.options].map(option => option.value).filter(Boolean)), new Set([f.prepared!.id, later.id]));
    a.ok(!snapshots.innerHTML.includes(foreign.id));
    a.match(snapshots.textContent || '', /Version 3/);
    a.match(snapshots.textContent || '', /Version 8/);
    a.deepEqual([...reviewers.options].map(option => option.value).filter(Boolean), [f.visitor.id]);
    a.ok(!reviewers.innerHTML.includes(f.content.id));
    a.equal(form.querySelector('[type="email"]'), null, 'snapshot assignment cannot invite a new identity');
    a.equal(document.querySelector('#assign-review-dialog form')?.getAttribute('action'), `${f.path}/live/invite`, 'live access stays a separate action');
    a.equal(form.checkValidity(), false);
    snapshots.value = later.id;
    reviewers.value = f.visitor.id;
    a.equal(form.checkValidity(), true);
    const fields = new URLSearchParams(Array.from(new dom.window.FormData(form) as unknown as Iterable<[string, string]>));
    const response = await f.request(undefined, `${f.path}/assign`, fields);
    a.equal(response.status, 303);
    a.match(response.headers.get('location') || '', /Preview\+assigned/);
    const assignments = await f.reviews.assignmentsForSite(f.site.id);
    a.equal(assignments.length, 1);
    a.equal(assignments[0].publicationId, later.id);
    a.equal(assignments[0].reviewerUserId, f.visitor.id);
    a.deepEqual(f.notices, [f.visitor.email]);
  } finally { dom.window.close(); }
});

for (const missing of ['reviewer', 'snapshot', 'publication-store'] as const) {
  test(`snapshot assignment explains and disables its missing ${missing} prerequisite`, async () => {
    const f = await fixture({ reviewer: missing !== 'reviewer', snapshot: missing !== 'snapshot', publicationStore: missing !== 'publication-store' });
    const dom = await f.page();
    try {
      const dialog = dom.window.document.querySelector('#assign-snapshot-dialog')!;
      a.equal(dialog.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled, true);
      if (missing === 'reviewer') {
        a.equal(dialog.querySelector<HTMLSelectElement>('[name="reviewerUserId"]')?.disabled, true);
        a.match(dialog.textContent || '', /No reviewers have access yet/);
        a.equal(dialog.querySelector('a')?.getAttribute('href'), `/sites/${f.site.id}/people`);
      } else {
        a.equal(dialog.querySelector<HTMLSelectElement>('[name="publicationId"]')?.disabled, true);
        a.match(dialog.textContent || '', /Create a review preview from Publish/);
      }
      a.equal((await f.reviews.assignmentsForSite(f.site.id)).length, 0);
      a.equal(f.notices.length, 0);
    } finally { dom.window.close(); }
  });
}

test('reviewer and content roles cannot obtain or submit the owner snapshot-assignment form', async () => {
  const f = await fixture();
  const reviewer = await f.request(f.reviewerCookie);
  a.equal(reviewer.status, 200);
  const reviewerHtml = await reviewer.text();
  a.doesNotMatch(reviewerHtml, /id="assign-snapshot-dialog"|data-open-dialog="assign-snapshot-dialog"|id="snapshot-reviewer"/);
  a.equal((await f.request(f.contentCookie)).status, 403);
  for (const session of [f.reviewerCookie, f.contentCookie]) {
    const response = await f.request(session, `${f.path}/assign`, new URLSearchParams({ publicationId: f.prepared!.id, reviewerUserId: f.visitor.id }));
    a.equal(response.status, 403);
  }
  a.equal((await f.reviews.assignmentsForSite(f.site.id)).length, 0);
  a.equal(f.notices.length, 0);
});

test('stale reviewer role and missing or foreign snapshot selections are refused without assignments', async () => {
  const f = await fixture();
  const foreign = await f.prepare(randomUUID());
  const dom = await f.page();
  try {
    const form = dom.window.document.querySelector<HTMLFormElement>('#assign-snapshot-dialog form')!;
    form.querySelector<HTMLSelectElement>('[name="publicationId"]')!.value = f.prepared!.id;
    form.querySelector<HTMLSelectElement>('[name="reviewerUserId"]')!.value = f.visitor.id;
    const stale = new URLSearchParams(Array.from(new dom.window.FormData(form) as unknown as Iterable<[string, string]>));
    await f.auth.changeMemberRole(f.site.id, f.visitor.id, 'content');
    const changedRole = await f.request(undefined, `${f.path}/assign`, stale);
    a.equal(changedRole.status, 303);
    a.match(changedRole.headers.get('location') || '', /review_reviewer/);
    await f.auth.changeMemberRole(f.site.id, f.visitor.id, 'reviewer');
    for (const reviewerUserId of ['', randomUUID(), f.content.id]) {
      const response = await f.request(undefined, `${f.path}/assign`, new URLSearchParams({ publicationId: f.prepared!.id, reviewerUserId }));
      a.equal(response.status, 303);
      a.match(response.headers.get('location') || '', /review_reviewer/);
    }
    for (const publicationId of ['', randomUUID(), foreign.id]) {
      const response = await f.request(undefined, `${f.path}/assign`, new URLSearchParams({ publicationId, reviewerUserId: f.visitor.id }));
      a.equal(response.status, 303);
      a.match(response.headers.get('location') || '', /review_snapshot/);
    }
    await f.publications.discard(f.prepared!);
    const removed = await f.request(undefined, `${f.path}/assign`, stale);
    a.equal(removed.status, 303);
    a.match(removed.headers.get('location') || '', /review_snapshot/);
    a.equal((await f.reviews.assignmentsForSite(f.site.id)).length, 0);
    a.equal(f.notices.length, 0);
  } finally { dom.window.close(); }
});
