import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Records } from './record-files.ts';
import type { User } from './auth.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();

export type SupportNotice = {
  accountEmail: string; ticketId: string; subject: string; body: string; replyToken: string; messageId: string;
};
export type SupportNotify = (notice: SupportNotice) => Promise<void>;
type Ticket = { id: string; owner: string; subject: string; replyToken: string };
type CustomerInput = { requestId: string; body: string; subject?: string };
type Message = { id: string; role: 'customer' | 'support'; body: string; createdAt: string };
type StoredMessage = Message & { trackUnread?: true };
type UnreadReply = { ticketId: string; messageId: string };
type Activity = { id: string; subject: string; updatedAt: string; latestMessageRole?: Message['role'] };
type Attempt = { sequence: number; started: number; failed?: boolean };

export class SupportError extends Error {
  readonly status: 400 | 404 | 409 | 503;
  constructor(status: SupportError['status'], message: string) { super(message); this.status = status; }
}

export class SupportTicketStore {
  private records: Records;
  constructor(records: Records) { this.records = records; }

  async list(userId: string) {
    const owner = digest(userId);
    const [activity, unread] = await Promise.all([
      this.records.list<Activity>(`accounts/${owner}/activity`), this.unreadReplies(owner),
    ]);
    const unreadTickets = new Set(unread.map(row => row.ticketId));
    const newest = new Map<string, Activity>();
    for (const row of activity) {
      const previous = newest.get(row.id);
      if (!previous || previous.updatedAt < row.updatedAt) newest.set(row.id, row);
      else if (previous.updatedAt === row.updatedAt && previous.latestMessageRole !== row.latestMessageRole) {
        // The thread's message-id tiebreaker determines which author comes last in the same millisecond.
        newest.set(row.id, { ...row, latestMessageRole: undefined });
      }
    }
    const ordered = [...newest.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return Promise.all(ordered.map(async row => ({
      ...row,
      ...(unreadTickets.has(row.id) ? { unread: true } : {}),
      // Older activity records only contain the timestamp, but their messages already contain the author.
      latestMessageRole: row.latestMessageRole ?? (await this.thread(await this.owned(userId, row.id), unread)).messages.at(-1)?.role ?? null
    })));
  }

  private async owned(userId: string, id: string) {
    const ticket = uuid.test(id) ? await this.records.read<Ticket>(`tickets/${id}.json`) : null;
    if (!ticket || ticket.owner !== digest(userId)) throw new SupportError(404, 'Ticket not found.');
    return ticket;
  }

  async get(userId: string, id: string) {
    return this.thread(await this.owned(userId, id));
  }

  private async thread(ticket: Ticket, knownUnread?: UnreadReply[]) {
    const [stored, unread] = await Promise.all([
      this.records.list<StoredMessage>(`threads/${ticket.id}`), knownUnread ?? this.unreadReplies(ticket.owner),
    ]);
    const unseen = new Set(unread.filter(row => row.ticketId === ticket.id).map(row => row.messageId));
    const messages = stored.map(({ id, role, body, createdAt }) => ({
      id, role, body, createdAt, ...(unseen.has(id) ? { unread: true } : {}),
    }));
    messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return { id: ticket.id, subject: ticket.subject, updatedAt: messages.at(-1)?.createdAt || '', messages };
  }

  // Only outstanding replies live in this index. The receipt wins even if an inbound worker
  // died between recreating an index entry on retry and observing a simultaneous acknowledgement.
  private async unreadReplies(owner: string) {
    const rows = await this.records.list<UnreadReply>(`accounts/${owner}/unread`);
    const active = await Promise.all(rows.map(async row =>
      await this.records.read(`read/${row.ticketId}/${row.messageId}.json`) ? null : row));
    return active.filter(row => row !== null);
  }

  async unreadCount(userId: string) {
    const unread = await this.unreadReplies(digest(userId));
    return new Set(unread.map(row => row.ticketId)).size;
  }

  async markRead(userId: string, ticketId: string, ids: unknown) {
    const ticket = await this.owned(userId, ticketId);
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 ||
        !ids.every(id => typeof id === 'string' && uuid.test(id))) {
      throw new SupportError(400, 'Supply between one and 100 reply IDs.');
    }
    await Promise.all([...new Set<string>(ids)].map(async id => {
      const messageId = id.toLowerCase();
      const path = `accounts/${ticket.owner}/unread/${ticket.id}-${messageId}.json`;
      if (!await this.records.read(path)) return;
      await this.records.create(`read/${ticket.id}/${messageId}.json`, true);
      await this.records.remove(path);
    }));
    return this.unreadCount(userId);
  }

  private async registerUnread(ticket: Ticket, messageId: string) {
    const receipt = `read/${ticket.id}/${messageId}.json`;
    if (await this.records.read(receipt)) return;
    const path = `accounts/${ticket.owner}/unread/${ticket.id}-${messageId}.json`;
    await this.records.create(path, { ticketId: ticket.id, messageId } satisfies UnreadReply);
    if (await this.records.read(receipt)) await this.records.remove(path);
  }

  private async index(ticket: Ticket, message: Message) {
    const summary: Activity = { id: ticket.id, subject: ticket.subject, updatedAt: message.createdAt, latestMessageRole: message.role };
    // Immutable activity records keep simultaneous inbound and customer replies from
    // overwriting a newer timestamp, without rewriting the full conversation.
    await this.records.create(`accounts/${ticket.owner}/activity/${ticket.id}-${message.id}.json`, summary);
  }

  async send(user: Pick<User, 'id' | 'email'>, ticketId: string | undefined, input: CustomerInput, notify: SupportNotify) {
    if (!input || typeof input.requestId !== 'string' || !uuid.test(input.requestId) ||
        typeof input.body !== 'string' || !input.body.trim() || input.body.trim().length > 8000 ||
        (input.subject !== undefined && (typeof input.subject !== 'string' || input.subject.length > 160))) {
      throw new SupportError(400, 'Enter a message of up to 8,000 characters and a subject of up to 160 characters.');
    }
    const body = input.body.trim();
    const requestId = input.requestId.toLowerCase();
    const owner = digest(user.id);
    let ticket: Ticket;
    if (ticketId !== undefined) {
      ticket = await this.owned(user.id, ticketId);
    } else {
      const subject = (input.subject?.trim() || body.split('\n')[0]).replace(/[\r\n\t]+/g, ' ').slice(0, 160);
      const reservation = `accounts/${owner}/requests/${requestId}.json`;
      const candidate: Ticket = { id: randomUUID(), owner, subject, replyToken: randomBytes(16).toString('hex') };
      // A retry in another process uses the same server-assigned ticket and reply address.
      ticket = await this.records.create(reservation, candidate) ? candidate : (await this.records.read<Ticket>(reservation))!;
      if (ticket.subject !== subject) throw new SupportError(409, 'This send request already has a different subject.');
      await this.records.create(`tickets/${ticket.id}.json`, ticket);
      await this.records.create(`reply-tokens/${ticket.replyToken}.json`, ticket.id);
    }

    const pending = `outgoing/${ticket.id}/${requestId}`;
    const draft: Message = { id: randomUUID(), role: 'customer', body, createdAt: now() };
    const message = await this.records.create(pending + '.json', draft) ? draft : (await this.records.read<Message>(pending + '.json'))!;
    if (message.body !== body) throw new SupportError(409, 'This send request already has a different message.');
    const visiblePath = `threads/${ticket.id}/${message.id}.json`;
    if (!await this.records.read<Message>(visiblePath)) {
      await this.deliver(ticket, user.email, message, pending, visiblePath, notify);
    }
    await this.index(ticket, message);
    return this.thread(ticket);
  }

  private async deliver(ticket: Ticket, accountEmail: string, message: Message, pending: string, visiblePath: string, notify: SupportNotify) {
    const attempts = await this.records.list<Attempt>(pending);
    const last = attempts.sort((a, b) => b.sequence - a.sequence)[0];
    const busy = () => new SupportError(409, 'This message is still sending. Try again shortly.');
    // A process that dies during SMTP cannot hold the request forever. Claims have
    // individual immutable names, so a late failure cannot release a newer attempt.
    if (last && !last.failed && Date.now() - last.started < 10 * 60_000) throw busy();
    const attempt = { sequence: (last?.sequence || 0) + 1, started: Date.now() };
    const path = `${pending}/${attempt.sequence}.json`;
    if (!await this.records.create(path, attempt)) throw busy();
    if (await this.records.read<Message>(visiblePath)) return;
    try {
      await notify({ accountEmail, ticketId: ticket.id, subject: ticket.subject, body: message.body,
        replyToken: ticket.replyToken, messageId: message.id });
    } catch {
      await this.records.write(path, { ...attempt, failed: true });
      throw new SupportError(503, 'Email delivery could not be confirmed. Please retry your message.');
    }
    await this.records.create(visiblePath, message);
  }

  /** Called only by the authenticated inbound mail handler. An inbound provider retry
      must not append the same reply twice, even when delivered to different workers. */
  async appendReply(replyToken: string, inboundId: string, rawBody: string): Promise<boolean> {
    if (!/^[0-9a-f]{32}$/.test(replyToken)) return false;
    const id = await this.records.read<string>(`reply-tokens/${replyToken}.json`);
    if (!id) return false;
    const ticket = await this.records.read<Ticket>(`tickets/${id}.json`);
    if (!ticket || ticket.replyToken !== replyToken) return false;
    const body = rawBody.trim();
    if (!inboundId || inboundId.length > 1024 || !body || body.length > 8000) throw new SupportError(400, 'Invalid reply.');
    const path = `threads/${id}/reply-${digest(inboundId)}.json`;
    const candidate: StoredMessage = { id: randomUUID(), role: 'support', body, createdAt: now(), trackUnread: true };
    const message = await this.records.create(path, candidate) ? candidate : (await this.records.read<StoredMessage>(path))!;
    if (message.trackUnread) await this.registerUnread(ticket, message.id);
    await this.index(ticket, message);
    return true;
  }
}
