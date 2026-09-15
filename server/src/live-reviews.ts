/** Live feedback is separate from immutable publication approvals. One conversation per
 * site, with independently revocable links and page/device-scoped pins. */
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
export type ReviewDevice = 'desktop' | 'tablet' | 'mobile';
export type LiveLink = { id: string; siteId: string; token: string; access: 'public' | 'private' | 'developer'; active: boolean; createdAt: string };
export type ReviewPerson = { id: string; name: string };
export type LivePin = { id: string; siteId: string; page: string; device: ReviewDevice; x: number; y: number; nodeId: string; nodeX: number; nodeY: number; author: ReviewPerson; body: string; createdAt: string; done: boolean; resolvedBy?: ReviewPerson; replies: { id: string; author: ReviewPerson; body: string; createdAt: string }[] };
type Data = { links: LiveLink[]; pins: LivePin[]; invites: { siteId: string; email: string; kind: 'private' | 'developer' }[]; guests: { digest: string; siteId: string; name: string; expires: number }[] };
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const secret = () => randomBytes(32).toString('hex');
const stamp = () => new Date().toISOString();
const copy = <T>(x: T): T => structuredClone(x);
export class LiveReviewStore {
  private data: Data = { links: [], pins: [], invites: [], guests: [] };
  private ready = false;
  private queue: Promise<unknown> = Promise.resolve();
  private file?: string;
  constructor(file?: string) { this.file = file; }
  private transact<T>(fn: (data: Data) => T, write = false): Promise<T> {
    const run = this.queue.then(async () => {
      if (!this.ready) {
        if (this.file) { try { this.data = JSON.parse(await readFile(this.file, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
        this.ready = true;
      }
      const next = write ? copy(this.data) : this.data;
      const result = fn(next);
      if (write && this.file) {
        await mkdir(dirname(this.file), { recursive: true });
        const tmp = this.file + '.' + randomUUID() + '.tmp';
        await writeFile(tmp, JSON.stringify(next), { mode: 0o600 });
        await rename(tmp, this.file);
      }
      if (write) this.data = next;
      return copy(result);
    });
    this.queue = run.catch(() => {});
    return run;
  }
  links(siteId: string) { return this.transact(d => d.links.filter(l => l.siteId === siteId)); }
  link(token: string) { return this.transact(d => d.links.find(l => l.token === token && l.active) || null); }
  createLink(siteId: string, access: LiveLink['access']) { return this.transact(d => {
    const row: LiveLink = { id: randomUUID(), siteId, access, token: secret(), active: true, createdAt: stamp() };
    d.links.push(row); return row;
  }, true); }
  revoke(siteId: string, id: string) { return this.transact(d => { const row = d.links.find(l => l.siteId === siteId && l.id === id); if (row) row.active = false; }, true); }
  invite(siteId: string, email: string, kind: 'private' | 'developer') { return this.transact(d => {
    if (!d.invites.some(i => i.siteId === siteId && i.email === email && i.kind === kind)) d.invites.push({ siteId, email, kind });
  }, true); }
  invited(siteId: string, email: string, kind?: 'private' | 'developer') { return this.transact(d => d.invites.some(i => i.siteId === siteId && i.email === email && (!kind || i.kind === kind))); }
  invitations(siteId: string) { return this.transact(d => d.invites.filter(i => i.siteId === siteId)); }
  removeInvite(siteId: string, email: string) { return this.transact(d => { d.invites = d.invites.filter(i => i.siteId !== siteId || i.email !== email); }, true); }
  guest(siteId: string, token: string) { return this.transact(d => { const g = d.guests.find(g => g.siteId === siteId && g.digest === digest(token) && g.expires > Date.now()); return g ? { id: 'guest:' + g.digest, name: g.name } : null; }); }
  addGuest(siteId: string, name: string) { return this.transact(d => {
    const token = secret(); d.guests = d.guests.filter(g => g.expires > Date.now());
    d.guests.push({ siteId, digest: digest(token), name, expires: Date.now() + 30 * 86400000 }); return token;
  }, true); }
  pins(siteId: string) { return this.transact(d => d.pins.filter(p => p.siteId === siteId)); }
  addPin(input: Omit<LivePin, 'id' | 'createdAt' | 'done' | 'replies'>) { return this.transact(d => {
    const pin: LivePin = { ...input, id: randomUUID(), createdAt: stamp(), done: false, replies: [] }; d.pins.push(pin); return pin;
  }, true); }
  reply(siteId: string, id: string, author: ReviewPerson, body: string) { return this.transact(d => {
    const pin = d.pins.find(p => p.siteId === siteId && p.id === id); if (!pin) throw new Error('missing_pin');
    pin.replies.push({ id: randomUUID(), author, body, createdAt: stamp() }); return pin;
  }, true); }
  resolve(siteId: string, id: string, author: ReviewPerson, done: boolean) { return this.transact(d => {
    const pin = d.pins.find(p => p.siteId === siteId && p.id === id); if (!pin) throw new Error('missing_pin');
    pin.done = done; pin.resolvedBy = done ? author : undefined; return pin;
  }, true); }
}
