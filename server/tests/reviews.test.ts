import { test } from 'vitest';
import a from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { FilePublicationReviewStore, MemoryPublicationReviewStore, type FileReviewState } from '../src/reviews.ts';
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

const publicationId = '11111111-1111-4111-8111-111111111111';
const otherPublicationId = '22222222-2222-4222-8222-222222222222';
const assignInput = (publication = publicationId) => ({
  siteId: 'site-one', publicationId: publication, reviewerUserId: 'u-reviewer', assignedBy: 'u-owner',
});
const noticeInput = (title: string) => ({ userId: 'u-reviewer', kind: 'review_comment', title, body: '', href: '/r' });

test('file reviews from two processes on one root are seen by both and overwrite nothing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-reviews-'));
  try {
    const one = new FilePublicationReviewStore(root), two = new FilePublicationReviewStore(root);
    // The second process has read before the first one writes.
    a.equal(await two.canViewSnapshot('site-one', publicationId, 'u-reviewer', 'reviewer'), false);
    const assignment = await one.assign(assignInput());
    a.equal(await two.canViewSnapshot('site-one', publicationId, 'u-reviewer', 'reviewer'), true,
      'a new assignment is visible to the other process at once');

    await Promise.all([
      one.addComment({ assignmentId: assignment.id, authorUserId: 'u-reviewer', body: 'From one' }),
      two.addComment({ assignmentId: assignment.id, authorUserId: 'u-owner', body: 'From two' }),
      one.notify(noticeInput('First')),
      two.notify(noticeInput('Second')),
      two.decide({ assignmentId: assignment.id, actorUserId: 'u-reviewer', status: 'approved' }),
    ]);
    const third = new FilePublicationReviewStore(root);
    a.deepEqual((await third.comments(assignment.id)).map(row => row.body).sort(), ['From one', 'From two']);
    a.equal((await third.decision(assignment.id))?.status, 'approved');
    const notices = await third.notices('u-reviewer');
    a.deepEqual(notices.map(row => row.title).sort(), ['First', 'Second']);
    a.equal(await one.markRead('u-reviewer', notices[0].id), true);
    a.ok((await two.notices('u-reviewer')).find(row => row.id === notices[0].id)?.readAt);

    // The same reviewer and snapshot assigned from both processes at once is one assignment.
    const [x, y] = await Promise.all([one.assign(assignInput(otherPublicationId)), two.assign(assignInput(otherPublicationId))]);
    a.equal(x.id, y.id);
    a.equal((await third.assignmentsForSite('site-one')).length, 2);

    // A cancellation racing another decision is final.
    await Promise.all([
      one.decide({ assignmentId: assignment.id, actorUserId: 'u-owner', status: 'cancelled' }),
      two.decide({ assignmentId: assignment.id, actorUserId: 'u-reviewer', status: 'changes_requested' }),
    ]);
    a.equal((await third.decision(assignment.id))?.status, 'cancelled');
    await a.rejects(one.decide({ assignmentId: assignment.id, actorUserId: 'u-reviewer', status: 'approved' }), /review_cancelled/);

    const email = await one.enqueueEmail({ to: 'reviewer@example.test', subject: 'Hello', body: 'Body' });
    a.equal(await two.markEmailDelivered(email.id), true);
    a.equal(await one.markEmailDelivered(email.id), false, 'delivered once');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the old review state file is split into records on first use, also by two processes at once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-reviews-'));
  const dir = join(root, 'reviews'), legacy = join(dir, 'state.json');
  try {
    const assignment = { id: randomUUID(), ...assignInput(), createdAt: '2026-09-01T00:00:00.000Z' };
    const notice = (title: string, createdAt: string) => ({
      ...noticeInput(title), id: randomUUID(), createdAt, readAt: null,
    });
    const state: FileReviewState = {
      assignments: [assignment],
      comments: [{
        id: randomUUID(), assignmentId: assignment.id, siteId: 'site-one', publicationId,
        authorUserId: 'u-reviewer', body: 'Old comment', pageSlug: 'index', nodeId: '', createdAt: '2026-09-01T00:01:00.000Z',
      }],
      decisions: [{
        id: randomUUID(), assignmentId: assignment.id, status: 'changes_requested', actorUserId: 'u-reviewer',
        note: '', createdAt: '2026-09-01T00:02:00.000Z',
      }],
      notices: [notice('Newer', '2026-09-01T00:04:00.000Z'), notice('Older', '2026-09-01T00:03:00.000Z')],
      emails: [{ id: randomUUID(), to: 'r@example.test', subject: 'S', body: 'B', createdAt: '2026-09-01T00:05:00.000Z', deliveredAt: null }],
    };
    await mkdir(dir, { recursive: true });
    await writeFile(legacy, JSON.stringify(state));

    const one = new FilePublicationReviewStore(root), two = new FilePublicationReviewStore(root);
    const [found, comments] = await Promise.all([one.assignment('site-one', assignment.id), two.comments(assignment.id)]);
    a.deepEqual(found, assignment);
    a.deepEqual(comments, state.comments);
    a.equal((await two.decision(assignment.id))?.status, 'changes_requested');
    a.deepEqual((await one.notices('u-reviewer')).map(row => row.title), ['Newer', 'Older']);
    a.equal(await two.canViewSnapshot('site-one', publicationId, 'u-reviewer', 'reviewer'), true);
    a.deepEqual(await two.drainEmail(), { processed: 1, pending: 0 });
    await a.rejects(stat(legacy), /ENOENT/);
    a.deepEqual(JSON.parse(await readFile(`${legacy}.migrated`, 'utf8')), state, 'the old file is kept as a backup');

    // A process still on the old code writes the file again during a deploy, with a notice of its
    // own. The next start adds that notice and keeps what the records already say.
    a.equal(await one.markRead('u-reviewer', state.notices[0].id), true);
    await writeFile(legacy, JSON.stringify({ ...state, notices: [...state.notices, notice('From the old process', '2026-09-01T00:06:00.000Z')] }));
    const next = new FilePublicationReviewStore(root);
    const notices = await next.notices('u-reviewer');
    a.deepEqual(notices.map(row => row.title), ['From the old process', 'Newer', 'Older']);
    a.ok(notices[1].readAt, 'the record, not the old copy, decides');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
