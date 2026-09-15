import { test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { FilePublicationReviewStore, MemoryPublicationReviewStore } from '../src/reviews.ts';
import type { Doc } from '../../app/src/core/types.ts';

const doc = (): Doc => ({
  schemaVersion: 1,
  pages: [{ id: 'home', name: 'Home', slug: 'index', html: '', css: '' } as never],
  meta: { collections: [] },
} as unknown as Doc);

const snapshotFile = {
  path: 'index.html',
  mediaType: 'text/html',
  bytes: new TextEncoder().encode('<!doctype html><title>Preview</title>'),
};

test('reviewers cannot edit, publish, inspect submissions, or open unassigned snapshots', async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const publications = new MemoryHostedPublicationStore();
  const reviews = new MemoryPublicationReviewStore();
  const mailed: { to: string; subject: string; body: string }[] = [];
  const site = await store.create({
    host: 'review.test', name: 'Review site', slug: 'review-site', doc: doc(),
  });
  const owner = await auth.createUser('owner@example.test', 'Owner');
  const reviewer = await auth.createUser('reviewer@example.test', 'Reviewer');
  const editor = await auth.createUser('editor@example.test', 'Editor');
  await auth.grant(site.id, owner.id, 'owner');
  await auth.grant(site.id, reviewer.id, 'reviewer');
  await auth.grant(site.id, editor.id, 'content');
  const snapshot = await publications.create({
    siteId: site.id,
    slug: 'review-site',
    host: 'review.test',
    sourceVersion: 1,
    files: [snapshotFile],
  });
  const app = createApp({
    store, auth, publications, reviews, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    editorHtml: '<title>Builder</title>',
    sendNotice: (to, subject, body) => { mailed.push({ to, subject, body }); },
  });
  const cookieFor = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60_000);
    return `pc_session=${token}`;
  };
  const ownerCookie = await cookieFor(owner.id);
  const reviewerCookie = await cookieFor(reviewer.id);
  const editorCookie = await cookieFor(editor.id);
  const as = (cookie: string, path: string, init: RequestInit = {}) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init,
      headers: {
        host: 'admin.test',
        cookie,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    }));

  a.equal((await as(reviewerCookie, `/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: doc(), version: 1 }),
  })).status, 403);
  a.equal((await as(reviewerCookie, `/api/sites/${site.id}/publish`, {
    method: 'POST', body: JSON.stringify({ sourceVersion: 1 }),
  })).status, 403);
  a.equal((await as(reviewerCookie, `/sites/${site.id}/submissions`)).status, 403);
  a.equal((await as(
    reviewerCookie,
    `/api/sites/${site.id}/publication-snapshots/${snapshot.id}/files/index.html`,
  )).status, 404);
  a.equal((await as(editorCookie, `/sites/${site.id}/reviews`)).status, 403);

  const assigned = await as(ownerCookie, `/sites/${site.id}/reviews/assign`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      publicationId: snapshot.id, reviewerUserId: reviewer.id,
    }),
    redirect: 'manual',
  } as RequestInit);
  a.equal(assigned.status, 303);
  a.match(String(assigned.headers.get('location')), /Preview\+assigned/);
  a.equal(mailed[0]?.to, reviewer.email);
  a.match(mailed[0]?.body || '', /http:\/\/admin\.test\/sites\//);

  a.equal((await as(
    reviewerCookie,
    `/api/sites/${site.id}/publication-snapshots/${snapshot.id}/files/index.html`,
  )).status, 200);

  const edit = await as(reviewerCookie, `/edit/${site.id}`, { redirect: 'manual' } as RequestInit);
  a.equal(edit.status, 302);
  a.match(String(edit.headers.get('location')), /\/reviews$/);

  const people = await as(reviewerCookie, `/sites/${site.id}/people`);
  a.equal(people.status, 200);
  a.match(await people.text(), /Reviewer/);

  const ownerList = await as(ownerCookie, `/sites/${site.id}/reviews`);
  a.equal(ownerList.status, 200);
  a.match(await ownerList.text(), /Create review link/);

  const list = await as(reviewerCookie, `/sites/${site.id}/reviews`);
  a.equal(list.status, 200);
  const listHtml = await list.text();
  a.match(listHtml, /pc-sub-table/);
  a.match(listHtml, /Ask the site owner to create a review link/);

  const assignment = (await reviews.assignmentsForReviewer(site.id, reviewer.id))[0];
  a.ok(assignment);
  const commented = await as(reviewerCookie, `/sites/${site.id}/reviews/${assignment.id}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      body: 'Tighten the heading on home',
      pageSlug: 'index',
      nodeId: 'hero-title',
    }),
    redirect: 'manual',
  } as RequestInit);
  a.equal(commented.status, 303);
  a.equal(mailed.some(item => item.to === owner.email && /comment/i.test(item.subject)), true);

  const decided = await as(reviewerCookie, `/sites/${site.id}/reviews/${assignment.id}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'changes_requested', note: 'See heading comment' }),
    redirect: 'manual',
  } as RequestInit);
  a.equal(decided.status, 303);
  a.equal((await reviews.decision(assignment.id))?.status, 'changes_requested');

  const cancelled = await as(ownerCookie, `/sites/${site.id}/reviews/${assignment.id}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'cancelled' }),
    redirect: 'manual',
  } as RequestInit);
  a.equal(cancelled.status, 303);
  const locked = await as(reviewerCookie, `/sites/${site.id}/reviews/${assignment.id}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'approved' }),
    redirect: 'manual',
  } as RequestInit);
  a.equal(locked.status, 303);
  a.match(String(locked.headers.get('location')), /review_decision/);
  a.equal((await reviews.decision(assignment.id))?.status, 'cancelled');

  const notices = await as(reviewerCookie, '/notifications');
  a.equal(notices.status, 200);
  const noticeHtml = await notices.text();
  a.match(noticeHtml, /review preview was assigned/i);
  a.match(noticeHtml, /class="pc-inbox-item is-new"/);
  a.match(noticeHtml, /pc-inbox-state">New</);
  a.match(noticeHtml, /pc-inbox-icon/);
  a.match(noticeHtml, /aria-label="Sites navigation"/);
  a.match(noticeHtml, /class="pc-rail"/);
  a.match(noticeHtml, /data-notify-root/);
  a.match(noticeHtml, /View all/);
  a.match(noticeHtml, /pc-menu-item" href="\/account"><svg/);
  a.match(noticeHtml, /pc-menu-item" href="\/notifications"><svg/);
  a.match(noticeHtml, /pc-menu-item" type="submit"><svg/);
  const mini = await as(reviewerCookie, '/api/notifications/mini');
  a.equal(mini.status, 200);
  const miniJson = await mini.json() as { unread: number; listHtml: string };
  a.equal(typeof miniJson.unread, 'number');
  a.match(miniJson.listHtml, /pc-notify-item/);
  const reread = await as(reviewerCookie, '/notifications');
  a.equal(reread.status, 200);
  const rereadHtml = await reread.text();
  a.match(rereadHtml, /class="pc-inbox-item is-read"/);
  a.match(rereadHtml, /pc-inbox-state">Read</);

  const examples = await as(reviewerCookie, '/notifications?examples=1');
  a.equal(examples.status, 200);
  const exampleHtml = await examples.text();
  a.match(exampleHtml, /pc-inbox-item is-new/);
  a.match(exampleHtml, /pc-inbox-item is-read/);
  a.match(exampleHtml, /pc-inbox-state">New</);
  a.match(exampleHtml, /pc-inbox-state">Read</);
  a.match(exampleHtml, /review_assigned|A review preview was assigned/i);
  a.match(exampleHtml, /New comment on an assigned preview/);
  a.match(exampleHtml, /Review decision recorded/);
});

test('file review storage survives a new process', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-reviews-'));
  try {
    const first = new FilePublicationReviewStore(root);
    const assignment = await first.assign({
      siteId: 'site-one', publicationId: '11111111-1111-4111-8111-111111111111',
      reviewerUserId: 'u-reviewer', assignedBy: 'u-owner',
    });
    await first.addComment({
      assignmentId: assignment.id, authorUserId: 'u-reviewer',
      body: 'Keep this snapshot', pageSlug: 'index',
    });
    const second = new FilePublicationReviewStore(root);
    const stored = await second.assignment(assignment.siteId, assignment.id);
    a.equal(stored?.reviewerUserId, 'u-reviewer');
    a.equal((await second.comments(assignment.id))[0]?.body, 'Keep this snapshot');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
