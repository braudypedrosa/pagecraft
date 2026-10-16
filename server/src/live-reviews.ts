/** Live feedback is separate from immutable publication approvals. One conversation per
 * site, with independently revocable links and page/device-scoped pins.
 *
 * Several processes serve one root, so nothing is kept in memory: every link, pin, reply,
 * invitation and guest is its own record, read on each call (see record-files.ts). Links are
 * filed under a digest of their token and guests under theirs, so per-request checks are single
 * reads, and a revocation is seen by every process at once. Replies are records of their own,
 * so two people replying to one pin both land. The first call splits the older `reviews.json`. */
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { FileRecords, MemoryRecords, migrateStateFile, type Records } from './record-files.ts';
export type ReviewDevice = 'desktop' | 'tablet' | 'mobile';
export type LiveLink = { id: string; siteId: string; token: string; access: 'public' | 'private' | 'developer'; active: boolean; createdAt: string };
export type ReviewPerson = { id: string; name: string };
export type LivePin = { id: string; siteId: string; page: string; device: ReviewDevice; x: number; y: number; nodeId: string; nodeX: number; nodeY: number; author: ReviewPerson; body: string; createdAt: string; done: boolean; number?: number; resolvedBy?: ReviewPerson; removedAt?: string; removedBy?: ReviewPerson; replies: { id: string; author: ReviewPerson; body: string; createdAt: string }[] };
type InviteKind = 'private' | 'developer';
type Invite = { siteId: string; email: string; kind: InviteKind };
type Guest = { digest: string; siteId: string; name: string; expires: number };
type StoredPin = Omit<LivePin, 'replies' | 'removedAt' | 'removedBy'>;
type StoredReply = LivePin['replies'][number] & { pinId: string };
type PinRemoval = { pinId: string; siteId: string; removedAt: string; removedBy: ReviewPerson };
type PinNumber = { pinId: string; siteId: string; number: number };
/** The single file earlier versions kept. */
type Data = { links: LiveLink[]; pins: LivePin[]; invites: Invite[]; guests: Guest[] };
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const secret = () => randomBytes(32).toString('hex');
const stamp = () => new Date().toISOString();
const ID = /^[0-9a-f-]{36}$/i;
const KINDS: InviteKind[] = ['private', 'developer'];
const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
const validPinNumber = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
const byPinOrder = (a: StoredPin, b: StoredPin) => {
  const left = validPinNumber(a.number), right = validPinNumber(b.number);
  if (left === null && right === null) return byCreated(a, b);
  if (left === null) return -1;
  if (right === null) return 1;
  return left - right;
};
const linkPath = (token: string) => `links/${digest(token)}.json`;
const pinPath = (siteId: string, id: string) => `pins/${digest(siteId)}/${id}.json`;
const repliesDir = (siteId: string) => `replies/${digest(siteId)}`;
const removalsDir = (siteId: string) => `pin-removals/${digest(siteId)}`;
const removalPath = (siteId: string, id: string) => `${removalsDir(siteId)}/${id}.json`;
const numbersDir = (siteId: string) => `pin-numbers/${digest(siteId)}`;
const numberPath = (siteId: string, number: number) => `${numbersDir(siteId)}/${number}.json`;
const invitesDir = (siteId: string) => `invites/${digest(siteId)}`;
const invitePath = (siteId: string, email: string, kind: InviteKind) => `${invitesDir(siteId)}/${digest(email + '\n' + kind)}.json`;
const guestPath = (tokenDigest: string) => `guests/${tokenDigest}.json`;
const withReplies = (pin: StoredPin, replies: StoredReply[], removal?: PinRemoval | null): LivePin => ({
  ...pin, ...(removal ? { removedAt: removal.removedAt, removedBy: removal.removedBy } : {}),
  replies: replies.filter(r => r.pinId === pin.id).sort(byCreated).map(({ pinId: _pinId, ...reply }) => reply),
});
export class LiveReviewStore {
  private records: Records;
  private legacy?: string;
  private ready?: Promise<void>;
  /** `file` is the old single-file location; records live beside it. Without one, in memory. */
  constructor(file?: string) {
    this.records = file ? new FileRecords(dirname(file)) : new MemoryRecords();
    this.legacy = file;
  }
  private async store() {
    this.ready ??= (this.legacy ? migrateStateFile<Data>(this.legacy, data => this.split(data)) : Promise.resolve())
      .catch(error => { this.ready = undefined; throw error; });
    await this.ready;
    return this.records;
  }
  private async split(data: Data) {
    const r = this.records;
    // Revoking is one-way, so an old copy's revocation also applies to a record that exists.
    for (const link of data.links || []) if (!(await r.create(linkPath(link.token), link)) && !link.active) await r.write(linkPath(link.token), link);
    const siteNumbers = new Map<string, number>();
    for (const row of data.pins || []) {
      const { replies, removedAt, removedBy, ...pin } = row;
      if (!ID.test(pin.id)) continue;
      await r.create(pinPath(pin.siteId, pin.id), pin);
      const fallback = (siteNumbers.get(pin.siteId) || 0) + 1;
      const number = validPinNumber(pin.number) || fallback;
      siteNumbers.set(pin.siteId, Math.max(fallback, number));
      await r.create(numberPath(pin.siteId, number), { pinId: pin.id, siteId: pin.siteId, number });
      if (removedAt && removedBy) await r.create(removalPath(pin.siteId, pin.id), { pinId: pin.id, siteId: pin.siteId, removedAt, removedBy });
      for (const reply of replies || []) if (ID.test(reply.id)) await r.create(`${repliesDir(pin.siteId)}/${reply.id}.json`, { ...reply, pinId: pin.id });
    }
    for (const invite of data.invites || []) await r.create(invitePath(invite.siteId, invite.email, invite.kind), invite);
    for (const guest of data.guests || []) if (/^[a-f0-9]{64}$/.test(guest.digest) && guest.expires > Date.now()) await r.create(guestPath(guest.digest), guest);
  }
  private async pin(siteId: string, id: string) {
    const pin = ID.test(id) ? await (await this.store()).read<StoredPin>(pinPath(siteId, id)) : null;
    if (!pin || pin.siteId !== siteId) throw new Error('missing_pin');
    return pin;
  }
  private async removal(siteId: string, id: string, records?: Records) {
    const row = ID.test(id) ? await (records || await this.store()).read<PinRemoval>(removalPath(siteId, id)) : null;
    return row?.siteId === siteId && row.pinId === id ? row : null;
  }
  private async reservePinNumber(siteId: string, pinId: string) {
    const records = await this.store();
    const [pins, reservations] = await Promise.all([
      records.list<StoredPin>(`pins/${digest(siteId)}`), records.list<PinNumber>(numbersDir(siteId)),
    ]);
    const pinMaximum = pins.reduce((maximum, pin) => Math.max(maximum, validPinNumber(pin.number) || 0), pins.length);
    let number = reservations.reduce((maximum, row) => Math.max(maximum, validPinNumber(row.number) || 0), pinMaximum) + 1;
    while (!await records.create(numberPath(siteId, number), { pinId, siteId, number })) number++;
    return number;
  }
  async links(siteId: string) { return (await (await this.store()).list<LiveLink>('links')).filter(l => l.siteId === siteId).sort(byCreated); }
  async link(token: string) {
    const row = await (await this.store()).read<LiveLink>(linkPath(token));
    return row && row.token === token && row.active ? row : null;
  }
  async createLink(siteId: string, access: LiveLink['access']) {
    const row: LiveLink = { id: randomUUID(), siteId, access, token: secret(), active: true, createdAt: stamp() };
    await (await this.store()).write(linkPath(row.token), row); return row;
  }
  async revoke(siteId: string, id: string) {
    const records = await this.store(), row = (await this.links(siteId)).find(l => l.id === id);
    if (row) await records.write(linkPath(row.token), { ...row, active: false });
  }
  async invite(siteId: string, email: string, kind: InviteKind) { await (await this.store()).create(invitePath(siteId, email, kind), { siteId, email, kind }); }
  async invited(siteId: string, email: string, kind?: InviteKind) {
    const records = await this.store();
    for (const k of kind ? [kind] : KINDS) if (await records.read(invitePath(siteId, email, k))) return true;
    return false;
  }
  async invitations(siteId: string) { return (await (await this.store()).list<Invite>(invitesDir(siteId))).sort((a, b) => a.email.localeCompare(b.email) || a.kind.localeCompare(b.kind)); }
  async removeInvite(siteId: string, email: string) { const records = await this.store(); await Promise.all(KINDS.map(kind => records.remove(invitePath(siteId, email, kind)))); }
  async guest(siteId: string, token: string) {
    const g = await (await this.store()).read<Guest>(guestPath(digest(token)));
    return g && g.siteId === siteId && g.expires > Date.now() ? { id: 'guest:' + g.digest, name: g.name } : null;
  }
  async addGuest(siteId: string, name: string) {
    const records = await this.store(), token = secret();
    for (const g of await records.list<Guest>('guests')) if (g.expires <= Date.now()) await records.remove(guestPath(g.digest));
    await records.write(guestPath(digest(token)), { siteId, digest: digest(token), name, expires: Date.now() + 30 * 86400000 }); return token;
  }
  async pins(siteId: string) {
    const records = await this.store();
    const [pins, replies, removals] = await Promise.all([
      records.list<StoredPin>(`pins/${digest(siteId)}`), records.list<StoredReply>(repliesDir(siteId)), records.list<PinRemoval>(removalsDir(siteId)),
    ]);
    const removed = new Map(removals.filter(row => row.siteId === siteId).map(row => [row.pinId, row]));
    return pins.sort(byPinOrder).map(pin => withReplies(pin, replies, removed.get(pin.id)));
  }
  async addPin(input: Omit<LivePin, 'id' | 'createdAt' | 'done' | 'number' | 'removedAt' | 'removedBy' | 'replies'>) {
    const id = randomUUID(), number = await this.reservePinNumber(input.siteId, id);
    const pin: StoredPin = { ...input, id, number, createdAt: stamp(), done: false };
    await (await this.store()).write(pinPath(pin.siteId, pin.id), pin); return withReplies(pin, []);
  }
  async reply(siteId: string, id: string, author: ReviewPerson, body: string) {
    const pin = await this.pin(siteId, id), records = await this.store();
    if (await this.removal(siteId, id, records)) throw new Error('removed_pin');
    const reply: StoredReply = { pinId: pin.id, id: randomUUID(), author, body, createdAt: stamp() };
    await records.write(`${repliesDir(siteId)}/${reply.id}.json`, reply);
    return withReplies(pin, await records.list<StoredReply>(repliesDir(siteId)), await this.removal(siteId, id, records));
  }
  async resolve(siteId: string, id: string, author: ReviewPerson, done: boolean) {
    const pin = await this.pin(siteId, id), records = await this.store();
    if (await this.removal(siteId, id, records)) throw new Error('removed_pin');
    const next: StoredPin = { ...pin, done, resolvedBy: done ? author : undefined };
    await records.write(pinPath(siteId, pin.id), next);
    return withReplies(next, await records.list<StoredReply>(repliesDir(siteId)), await this.removal(siteId, id, records));
  }
  async setRemoved(siteId: string, id: string, author: ReviewPerson, removed: boolean) {
    const pin = await this.pin(siteId, id), records = await this.store();
    let removal = await this.removal(siteId, id, records);
    if (removed && !removal) {
      const next: PinRemoval = { pinId: pin.id, siteId, removedAt: stamp(), removedBy: author };
      await records.create(removalPath(siteId, pin.id), next);
      removal = await this.removal(siteId, id, records);
    } else if (!removed && removal) {
      await records.remove(removalPath(siteId, pin.id)); removal = null;
    }
    return withReplies(pin, await records.list<StoredReply>(repliesDir(siteId)), removal);
  }
  /** A deleted site's links, pins, replies, invitations and guests. */
  async removeSite(siteId: string) {
    const records = await this.store();
    const [links, guests, pins, replies, removals, numbers, invites] = await Promise.all([
      records.list<LiveLink>('links'), records.list<Guest>('guests'), records.list<StoredPin>(`pins/${digest(siteId)}`),
      records.list<StoredReply>(repliesDir(siteId)), records.list<PinRemoval>(removalsDir(siteId)), records.list<PinNumber>(numbersDir(siteId)), records.list<Invite>(invitesDir(siteId)),
    ]);
    await Promise.all([
      ...links.filter(l => l.siteId === siteId).map(l => records.remove(linkPath(l.token))),
      ...guests.filter(g => g.siteId === siteId).map(g => records.remove(guestPath(g.digest))),
      ...pins.map(pin => records.remove(pinPath(siteId, pin.id))),
      ...replies.map(reply => records.remove(`${repliesDir(siteId)}/${reply.id}.json`)),
      ...removals.map(row => records.remove(removalPath(siteId, row.pinId))),
      ...numbers.map(row => records.remove(numberPath(siteId, row.number))),
      ...invites.map(i => records.remove(invitePath(siteId, i.email, i.kind))),
    ]);
  }
}
