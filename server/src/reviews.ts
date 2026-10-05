/* Assigned private previews, anchored comments, review decisions, and notices.

   Phase 2 already freezes publication snapshots. This store records who may inspect a
   snapshot, what they said, and whether they asked for changes, approved, or cancelled.
   Approval belongs to that immutable snapshot, not to a later draft. */
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { FileRecords, migrateStateFile } from './record-files.ts';

export const REVIEW_DECISIONS = ['changes_requested', 'approved', 'cancelled'] as const;
export type ReviewDecisionStatus = typeof REVIEW_DECISIONS[number];

export interface ReviewAssignment {
  id: string;
  siteId: string;
  publicationId: string;
  reviewerUserId: string;
  assignedBy: string;
  createdAt: string;
}

export interface ReviewComment {
  id: string;
  assignmentId: string;
  siteId: string;
  publicationId: string;
  authorUserId: string;
  body: string;
  pageSlug: string;
  nodeId: string;
  createdAt: string;
}

export interface ReviewDecision {
  id: string;
  assignmentId: string;
  status: ReviewDecisionStatus;
  actorUserId: string;
  note: string;
  createdAt: string;
}

export interface ReviewNotice {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
}

export interface ReviewEmailWork {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
}

export interface PublicationReviewStore {
  assign(input: {
    siteId: string; publicationId: string; reviewerUserId: string; assignedBy: string;
  }): Promise<ReviewAssignment>;
  assignment(siteId: string, assignmentId: string): Promise<ReviewAssignment | null>;
  assignmentFor(siteId: string, publicationId: string, reviewerUserId: string): Promise<ReviewAssignment | null>;
  assignmentsForSite(siteId: string): Promise<ReviewAssignment[]>;
  assignmentsForReviewer(siteId: string, reviewerUserId: string): Promise<ReviewAssignment[]>;
  canViewSnapshot(siteId: string, publicationId: string, userId: string, role: string): Promise<boolean>;
  addComment(input: {
    assignmentId: string; authorUserId: string; body: string; pageSlug?: string; nodeId?: string;
  }): Promise<ReviewComment>;
  comments(assignmentId: string): Promise<ReviewComment[]>;
  decide(input: {
    assignmentId: string; actorUserId: string; status: ReviewDecisionStatus; note?: string;
  }): Promise<ReviewDecision>;
  decision(assignmentId: string): Promise<ReviewDecision | null>;
  notify(input: Omit<ReviewNotice, 'id' | 'createdAt' | 'readAt'>): Promise<ReviewNotice>;
  notices(userId: string): Promise<ReviewNotice[]>;
  markRead(userId: string, noticeId: string): Promise<boolean>;
  enqueueEmail(input: { to: string; subject: string; body: string }): Promise<ReviewEmailWork>;
  markEmailDelivered(id: string): Promise<boolean>;
  drainEmail(limit?: number): Promise<{ processed: number; pending: number }>;
  /** A deleted site's assignments, comments and decisions. Notices stay in their inboxes. */
  removeSite(siteId: string): Promise<void>;
}

const now = () => new Date().toISOString();
const clean = (value: unknown, max = 4000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

/* Row builders shared by both stores, so they clean and limit input the same way. */
function newComment(assignment: ReviewAssignment, input: Parameters<PublicationReviewStore['addComment']>[0]) {
  const body = clean(input.body, 4000);
  if (!body) throw new Error('comment_required');
  const row: ReviewComment = {
    id: randomUUID(),
    assignmentId: assignment.id,
    siteId: assignment.siteId,
    publicationId: assignment.publicationId,
    authorUserId: input.authorUserId,
    body,
    pageSlug: clean(input.pageSlug, 180),
    nodeId: clean(input.nodeId, 180),
    createdAt: now(),
  };
  return row;
}

function newDecision(assignment: ReviewAssignment, input: Parameters<PublicationReviewStore['decide']>[0]) {
  const row: ReviewDecision = {
    id: randomUUID(),
    assignmentId: assignment.id,
    status: input.status,
    actorUserId: input.actorUserId,
    note: clean(input.note, 1000),
    createdAt: now(),
  };
  return row;
}

function newEmail(input: Parameters<PublicationReviewStore['enqueueEmail']>[0]) {
  const row: ReviewEmailWork = {
    id: randomUUID(),
    to: clean(input.to, 254),
    subject: clean(input.subject, 180),
    body: clean(input.body, 4000),
    createdAt: now(),
    deliveredAt: null,
  };
  return row;
}

export class MemoryPublicationReviewStore implements PublicationReviewStore {
  private assignmentRows = new Map<string, ReviewAssignment>();
  private commentRows = new Map<string, ReviewComment[]>();
  private decisionRows = new Map<string, ReviewDecision>();
  private noticeRows = new Map<string, ReviewNotice[]>();
  private emailRows: ReviewEmailWork[] = [];

  async assign(input: {
    siteId: string; publicationId: string; reviewerUserId: string; assignedBy: string;
  }) {
    const existing = await this.assignmentFor(input.siteId, input.publicationId, input.reviewerUserId);
    if (existing) return existing;
    const row: ReviewAssignment = {
      id: randomUUID(),
      siteId: input.siteId,
      publicationId: input.publicationId,
      reviewerUserId: input.reviewerUserId,
      assignedBy: input.assignedBy,
      createdAt: now(),
    };
    this.assignmentRows.set(row.id, row);
    return { ...row };
  }

  async assignment(siteId: string, assignmentId: string) {
    const row = this.assignmentRows.get(assignmentId);
    return row?.siteId === siteId ? { ...row } : null;
  }

  async assignmentFor(siteId: string, publicationId: string, reviewerUserId: string) {
    for (const row of this.assignmentRows.values()) {
      if (row.siteId === siteId && row.publicationId === publicationId &&
        row.reviewerUserId === reviewerUserId) return { ...row };
    }
    return null;
  }

  async assignmentsForSite(siteId: string) {
    return [...this.assignmentRows.values()].filter(row => row.siteId === siteId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(row => ({ ...row }));
  }

  async assignmentsForReviewer(siteId: string, reviewerUserId: string) {
    return (await this.assignmentsForSite(siteId)).filter(row => row.reviewerUserId === reviewerUserId);
  }

  async canViewSnapshot(siteId: string, publicationId: string, userId: string, role: string) {
    if (role === 'owner') return true;
    return !!(await this.assignmentFor(siteId, publicationId, userId));
  }

  async addComment(input: {
    assignmentId: string; authorUserId: string; body: string; pageSlug?: string; nodeId?: string;
  }) {
    const assignment = this.assignmentRows.get(input.assignmentId);
    if (!assignment) throw new Error('missing_assignment');
    const row = newComment(assignment, input);
    const list = this.commentRows.get(assignment.id) || [];
    list.push(row);
    this.commentRows.set(assignment.id, list);
    return { ...row };
  }

  async comments(assignmentId: string) {
    return (this.commentRows.get(assignmentId) || []).map(row => ({ ...row }));
  }

  async decide(input: {
    assignmentId: string; actorUserId: string; status: ReviewDecisionStatus; note?: string;
  }) {
    if (!REVIEW_DECISIONS.includes(input.status)) throw new Error('invalid_decision');
    const assignment = this.assignmentRows.get(input.assignmentId);
    if (!assignment) throw new Error('missing_assignment');
    const existing = this.decisionRows.get(assignment.id);
    if (existing?.status === 'cancelled') throw new Error('review_cancelled');
    const row = newDecision(assignment, input);
    this.decisionRows.set(assignment.id, row);
    return { ...row };
  }

  async decision(assignmentId: string) {
    const row = this.decisionRows.get(assignmentId);
    return row ? { ...row } : null;
  }

  async notify(input: Omit<ReviewNotice, 'id' | 'createdAt' | 'readAt'>) {
    const row: ReviewNotice = { ...input, id: randomUUID(), createdAt: now(), readAt: null };
    const list = this.noticeRows.get(input.userId) || [];
    list.unshift(row);
    this.noticeRows.set(input.userId, list);
    return { ...row };
  }

  async notices(userId: string) {
    return (this.noticeRows.get(userId) || []).map(row => ({ ...row }));
  }

  async markRead(userId: string, noticeId: string) {
    const list = this.noticeRows.get(userId) || [];
    const row = list.find(item => item.id === noticeId);
    if (!row) return false;
    row.readAt = now();
    return true;
  }

  async enqueueEmail(input: { to: string; subject: string; body: string }) {
    const row = newEmail(input);
    this.emailRows.push(row);
    return { ...row };
  }

  async markEmailDelivered(id: string) {
    const row = this.emailRows.find(item => item.id === id);
    if (!row || row.deliveredAt) return false;
    row.deliveredAt = now();
    return true;
  }

  async drainEmail(limit = 10) {
    let processed = 0;
    for (const row of this.emailRows) {
      if (row.deliveredAt || processed >= limit) continue;
      row.deliveredAt = now();
      processed += 1;
    }
    return { processed, pending: this.emailRows.filter(row => !row.deliveredAt).length };
  }

  async removeSite(siteId: string) {
    for (const row of [...this.assignmentRows.values()]) {
      if (row.siteId !== siteId) continue;
      this.assignmentRows.delete(row.id);
      this.commentRows.delete(row.id);
      this.decisionRows.delete(row.id);
    }
  }
}

/** The single state file earlier versions kept at `reviews/state.json`. */
export interface FileReviewState {
  assignments: ReviewAssignment[];
  comments: ReviewComment[];
  decisions: ReviewDecision[];
  notices: ReviewNotice[];
  emails: ReviewEmailWork[];
}

const ID = /^[0-9a-f-]{36}$/i;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const oldestFirst = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

/* A reviewer has one assignment per snapshot. Deriving the id from that pair makes two
   processes assigning at once write the same file, so the second finds the first. */
function derivedAssignmentId(siteId: string, publicationId: string, reviewerUserId: string) {
  const hex = digest(JSON.stringify([siteId, publicationId, reviewerUserId]));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Durable reviews beside publication bytes so staging workers can stay disabled.

    Several processes serve one root, so nothing is kept in memory. Each assignment, comment,
    decision, notice and email is its own file under `reviews/`, read from disk on every call.
    Decisions are kept as a history rather than one overwritten row, so a cancellation that races
    another decision still wins. The first call splits an older `reviews/state.json`. */
export class FilePublicationReviewStore implements PublicationReviewStore {
  private readonly files: FileRecords;
  private ready?: Promise<void>;

  constructor(root: string) {
    if (!root || !resolve(root).startsWith('/')) {
      throw new Error('review storage root must be an absolute path');
    }
    this.files = new FileRecords(join(resolve(root), 'reviews'));
  }

  private async records() {
    this.ready ??= migrateStateFile<FileReviewState>(join(this.files.root, 'state.json'), state => this.split(state))
      .catch(error => {
        this.ready = undefined;
        throw error;
      });
    await this.ready;
    return this.files;
  }
  private async split(state: FileReviewState) {
    const valid = <T extends { id: string }>(rows: T[] | undefined) => (rows || []).filter(row => ID.test(row.id));
    for (const row of valid(state.assignments)) await this.files.create(`assignments/${row.id}.json`, row);
    for (const row of valid(state.comments)) {
      if (ID.test(row.assignmentId)) await this.files.create(`comments/${row.assignmentId}/${row.id}.json`, row);
    }
    for (const row of valid(state.decisions)) {
      if (ID.test(row.assignmentId)) await this.files.create(`decisions/${row.assignmentId}/${row.id}.json`, row);
    }
    for (const row of valid(state.notices)) await this.files.create(`notices/${digest(row.userId)}/${row.id}.json`, row);
    for (const row of valid(state.emails)) await this.files.create(`emails/${row.id}.json`, row);
  }
  private async readAssignment(id: string) {
    return ID.test(id) ? (await this.records()).read<ReviewAssignment>(`assignments/${id}.json`) : null;
  }

  async assign(input: Parameters<PublicationReviewStore['assign']>[0]) {
    const existing = await this.assignmentFor(input.siteId, input.publicationId, input.reviewerUserId);
    if (existing) return existing;
    const row: ReviewAssignment = {
      id: derivedAssignmentId(input.siteId, input.publicationId, input.reviewerUserId),
      siteId: input.siteId,
      publicationId: input.publicationId,
      reviewerUserId: input.reviewerUserId,
      assignedBy: input.assignedBy,
      createdAt: now(),
    };
    if (await (await this.records()).create(`assignments/${row.id}.json`, row)) return row;
    return (await this.readAssignment(row.id)) || row;
  }
  async assignment(siteId: string, assignmentId: string) {
    const row = await this.readAssignment(assignmentId);
    return row?.siteId === siteId ? row : null;
  }
  async assignmentFor(siteId: string, publicationId: string, reviewerUserId: string) {
    const derived = await this.readAssignment(derivedAssignmentId(siteId, publicationId, reviewerUserId));
    if (derived) return derived;
    // Assignments made before ids were derived have random ids.
    return (await this.assignmentsForSite(siteId)).find(row =>
      row.publicationId === publicationId && row.reviewerUserId === reviewerUserId) || null;
  }
  async assignmentsForSite(siteId: string) {
    return (await (await this.records()).list<ReviewAssignment>('assignments'))
      .filter(row => row.siteId === siteId).sort(newestFirst);
  }
  async assignmentsForReviewer(siteId: string, reviewerUserId: string) {
    return (await this.assignmentsForSite(siteId)).filter(row => row.reviewerUserId === reviewerUserId);
  }
  async canViewSnapshot(siteId: string, publicationId: string, userId: string, role: string) {
    if (role === 'owner') return true;
    return !!(await this.assignmentFor(siteId, publicationId, userId));
  }
  async addComment(input: Parameters<PublicationReviewStore['addComment']>[0]) {
    const assignment = await this.readAssignment(input.assignmentId);
    if (!assignment) throw new Error('missing_assignment');
    const row = newComment(assignment, input);
    await (await this.records()).write(`comments/${assignment.id}/${row.id}.json`, row);
    return row;
  }
  async comments(assignmentId: string) {
    if (!ID.test(assignmentId)) return [];
    return (await (await this.records()).list<ReviewComment>(`comments/${assignmentId}`)).sort(oldestFirst);
  }
  async decide(input: Parameters<PublicationReviewStore['decide']>[0]) {
    if (!REVIEW_DECISIONS.includes(input.status)) throw new Error('invalid_decision');
    const assignment = await this.readAssignment(input.assignmentId);
    if (!assignment) throw new Error('missing_assignment');
    if ((await this.decision(assignment.id))?.status === 'cancelled') throw new Error('review_cancelled');
    const row = newDecision(assignment, input);
    await (await this.records()).write(`decisions/${assignment.id}/${row.id}.json`, row);
    return row;
  }
  /** The latest decision, except that a cancellation is final. */
  async decision(assignmentId: string) {
    if (!ID.test(assignmentId)) return null;
    const rows = (await (await this.records()).list<ReviewDecision>(`decisions/${assignmentId}`)).sort(oldestFirst);
    return rows.find(row => row.status === 'cancelled') || rows.at(-1) || null;
  }
  async notify(input: Parameters<PublicationReviewStore['notify']>[0]) {
    const row: ReviewNotice = { ...input, id: randomUUID(), createdAt: now(), readAt: null };
    await (await this.records()).write(`notices/${digest(input.userId)}/${row.id}.json`, row);
    return row;
  }
  async notices(userId: string) {
    return (await (await this.records()).list<ReviewNotice>(`notices/${digest(userId)}`)).sort(newestFirst);
  }
  async markRead(userId: string, noticeId: string) {
    if (!ID.test(noticeId)) return false;
    const files = await this.records(), path = `notices/${digest(userId)}/${noticeId}.json`;
    const row = await files.read<ReviewNotice>(path);
    if (!row) return false;
    await files.write(path, { ...row, readAt: now() });
    return true;
  }
  async enqueueEmail(input: Parameters<PublicationReviewStore['enqueueEmail']>[0]) {
    const row = newEmail(input);
    await (await this.records()).write(`emails/${row.id}.json`, row);
    return row;
  }
  async markEmailDelivered(id: string) {
    if (!ID.test(id)) return false;
    const files = await this.records(), path = `emails/${id}.json`;
    const row = await files.read<ReviewEmailWork>(path);
    if (!row || row.deliveredAt) return false;
    await files.write(path, { ...row, deliveredAt: now() });
    return true;
  }
  async drainEmail(limit = 10) {
    const files = await this.records();
    const rows = (await files.list<ReviewEmailWork>('emails')).sort(oldestFirst);
    let processed = 0;
    for (const row of rows) {
      if (row.deliveredAt || processed >= limit) continue;
      row.deliveredAt = now();
      await files.write(`emails/${row.id}.json`, row);
      processed += 1;
    }
    return { processed, pending: rows.filter(row => !row.deliveredAt).length };
  }
  async removeSite(siteId: string) {
    const records = await this.records();
    for (const row of await this.assignmentsForSite(siteId)) {
      const [comments, decisions] = await Promise.all([
        records.list<ReviewComment>(`comments/${row.id}`), records.list<ReviewDecision>(`decisions/${row.id}`),
      ]);
      await Promise.all([
        ...comments.map(comment => records.remove(`comments/${row.id}/${comment.id}.json`)),
        ...decisions.map(decision => records.remove(`decisions/${row.id}/${decision.id}.json`)),
      ]);
      await records.remove(`assignments/${row.id}.json`);
    }
  }
}

export function isReviewDecision(value: string): value is ReviewDecisionStatus {
  return (REVIEW_DECISIONS as readonly string[]).includes(value);
}
