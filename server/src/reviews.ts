/* Assigned private previews, anchored comments, review decisions, and notices.

   Phase 2 already freezes publication snapshots. This store records who may inspect a
   snapshot, what they said, and whether they asked for changes, approved, or cancelled.
   Approval belongs to that immutable snapshot, not to a later draft. */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

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
}

const now = () => new Date().toISOString();
const clean = (value: unknown, max = 4000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

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
    const row: ReviewDecision = {
      id: randomUUID(),
      assignmentId: assignment.id,
      status: input.status,
      actorUserId: input.actorUserId,
      note: clean(input.note, 1000),
      createdAt: now(),
    };
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
    const row: ReviewEmailWork = {
      id: randomUUID(),
      to: clean(input.to, 254),
      subject: clean(input.subject, 180),
      body: clean(input.body, 4000),
      createdAt: now(),
      deliveredAt: null,
    };
    this.emailRows.push(row);
    return { ...row };
  }

  async markEmailDelivered(id: string) {
    const row = this.emailRows.find(item => item.id === id);
    if (!row || row.deliveredAt) return false;
    row.deliveredAt = now();
    return true;
  }

  exportState(): FileReviewState {
    return {
      assignments: [...this.assignmentRows.values()].map(row => ({ ...row })),
      comments: [...this.commentRows.values()].flat().map(row => ({ ...row })),
      decisions: [...this.decisionRows.values()].map(row => ({ ...row })),
      notices: [...this.noticeRows.values()].flat().map(row => ({ ...row })),
      emails: this.emailRows.map(row => ({ ...row })),
    };
  }

  importState(state: FileReviewState) {
    this.assignmentRows = new Map((state.assignments || []).map(row => [row.id, { ...row }]));
    this.commentRows = new Map();
    for (const row of state.comments || []) {
      const list = this.commentRows.get(row.assignmentId) || [];
      list.push({ ...row });
      this.commentRows.set(row.assignmentId, list);
    }
    this.decisionRows = new Map((state.decisions || []).map(row => [row.assignmentId, { ...row }]));
    this.noticeRows = new Map();
    for (const row of state.notices || []) {
      const list = this.noticeRows.get(row.userId) || [];
      list.push({ ...row });
      this.noticeRows.set(row.userId, list);
    }
    this.emailRows = (state.emails || []).map(row => ({ ...row }));
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
}

export interface FileReviewState {
  assignments: ReviewAssignment[];
  comments: ReviewComment[];
  decisions: ReviewDecision[];
  notices: ReviewNotice[];
  emails: ReviewEmailWork[];
}

/** Durable reviews beside publication bytes so staging workers can stay disabled. */
export class FilePublicationReviewStore implements PublicationReviewStore {
  private readonly path: string;
  private memory = new MemoryPublicationReviewStore();
  private loaded = false;

  constructor(root: string) {
    if (!root || !resolve(root).startsWith('/')) {
      throw new Error('review storage root must be an absolute path');
    }
    this.path = join(resolve(root), 'reviews', 'state.json');
  }

  private async hydrate() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(await readFile(this.path, 'utf8')) as FileReviewState;
      this.memory.importState(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private async persist() {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(this.memory.exportState(), null, 2)}\n`);
    await rename(temporary, this.path);
  }

  private async run<T>(work: () => Promise<T>) {
    await this.hydrate();
    const result = await work();
    await this.persist();
    return result;
  }

  assign(input: Parameters<PublicationReviewStore['assign']>[0]) {
    return this.run(() => this.memory.assign(input));
  }
  async assignment(siteId: string, assignmentId: string) {
    await this.hydrate();
    return this.memory.assignment(siteId, assignmentId);
  }
  async assignmentFor(siteId: string, publicationId: string, reviewerUserId: string) {
    await this.hydrate();
    return this.memory.assignmentFor(siteId, publicationId, reviewerUserId);
  }
  async assignmentsForSite(siteId: string) {
    await this.hydrate();
    return this.memory.assignmentsForSite(siteId);
  }
  async assignmentsForReviewer(siteId: string, reviewerUserId: string) {
    await this.hydrate();
    return this.memory.assignmentsForReviewer(siteId, reviewerUserId);
  }
  async canViewSnapshot(siteId: string, publicationId: string, userId: string, role: string) {
    await this.hydrate();
    return this.memory.canViewSnapshot(siteId, publicationId, userId, role);
  }
  addComment(input: Parameters<PublicationReviewStore['addComment']>[0]) {
    return this.run(() => this.memory.addComment(input));
  }
  async comments(assignmentId: string) {
    await this.hydrate();
    return this.memory.comments(assignmentId);
  }
  decide(input: Parameters<PublicationReviewStore['decide']>[0]) {
    return this.run(() => this.memory.decide(input));
  }
  async decision(assignmentId: string) {
    await this.hydrate();
    return this.memory.decision(assignmentId);
  }
  notify(input: Parameters<PublicationReviewStore['notify']>[0]) {
    return this.run(() => this.memory.notify(input));
  }
  async notices(userId: string) {
    await this.hydrate();
    return this.memory.notices(userId);
  }
  markRead(userId: string, noticeId: string) {
    return this.run(() => this.memory.markRead(userId, noticeId));
  }
  enqueueEmail(input: Parameters<PublicationReviewStore['enqueueEmail']>[0]) {
    return this.run(() => this.memory.enqueueEmail(input));
  }
  markEmailDelivered(id: string) {
    return this.run(() => this.memory.markEmailDelivered(id));
  }
  drainEmail(limit?: number) {
    return this.run(() => this.memory.drainEmail(limit));
  }
}

export function isReviewDecision(value: string): value is ReviewDecisionStatus {
  return (REVIEW_DECISIONS as readonly string[]).includes(value);
}
