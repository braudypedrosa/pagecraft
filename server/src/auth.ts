/* Who is asking, and what they are allowed to do.

   Magic links, because the people using this are me and a handful of clients: no passwords
   to store, reset or leak, and nothing to remember on their side. The whole flow is four
   moves — ask for a link, follow it, hold a session cookie, drop it.

   ## What is hashed and why

   Neither the link token nor the session token is stored. Only their SHA-256 digests are.
   A stolen database therefore does not hand anyone a working login or a live session, which
   is the entire point of storing a hash instead of a secret. The token exists in exactly two
   places: the email, and the cookie.

   ## What fails closed

   Every path that cannot answer "yes, this person, on this site, in this role" denies. A
   token that is expired, already used, or unknown is the same answer as no token at all.

   Roles answer whether you may save; `content.ts` answers whether what you sent is content.
   Both, in that order, or a client could rewrite the layout of a site they were given a
   text-editing account for. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type Role = 'owner' | 'content';

export interface User { id: string; email: string; name: string }
export interface Session { token: string; userId: string; expiresAt: number }
export interface Membership { siteId: string; userId: string; role: Role }

/** Fifteen minutes. Long enough to find the email, short enough that a leaked one is stale. */
export const LINK_TTL_MS = 15 * 60 * 1000;
/** Thirty days. A client who edits monthly should not be locked out for being slow. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 32 bytes of urandom, base64url. Guessing is not a threat model at this width. */
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Compare two digests without leaking where they first differ. */
export function sameDigest(a: string, b: string) {
  const x = Buffer.from(a, 'utf8'), y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** An address is normalised before anything is keyed on it, or one person becomes two. */
export const normalEmail = (e: string) => String(e || '').trim().toLowerCase();

export interface AuthStore {
  userByEmail(email: string): Promise<User | null>;
  userById(id: string): Promise<User | null>;
  createUser(email: string, name?: string): Promise<User>;

  /** Store the digest, never the token. */
  putLink(digest: string, email: string, expiresAt: number): Promise<void>;
  /** Consume it: returns the email once, then never again. */
  useLink(digest: string): Promise<{ email: string } | null>;

  putSession(digest: string, userId: string, expiresAt: number): Promise<void>;
  sessionByDigest(digest: string): Promise<Session | null>;
  dropSession(digest: string): Promise<void>;

  membership(siteId: string, userId: string): Promise<Membership | null>;
  grant(siteId: string, userId: string, role: Role): Promise<Membership>;
}

/**
 * What a role may do. One place, so a new verb cannot quietly default to allowed.
 *
 * `content` may write, and `content.ts` decides what the write is allowed to contain. The
 * split matters: this function answers "may you save at all", and the skeleton comparison
 * answers "is this a content change". A role check alone would let a client rewrite the
 * layout; a diff check alone would let a stranger try.
 */
export function roleAllows(role: Role, verb: 'read' | 'write' | 'admin'): boolean {
  if (role === 'owner') return true;
  if (role === 'content') return verb === 'read' || verb === 'write';
  return false;
}

export class MemoryAuthStore implements AuthStore {
  private users = new Map<string, User>();
  private links = new Map<string, { email: string; expiresAt: number }>();
  private sessions = new Map<string, Session>();
  private members = new Map<string, Membership>();
  private seq = 0;

  async userByEmail(email: string) {
    for (const u of this.users.values()) if (u.email === normalEmail(email)) return { ...u };
    return null;
  }
  async userById(id: string) {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }
  async createUser(email: string, name = '') {
    const u: User = { id: 'u' + ++this.seq, email: normalEmail(email), name };
    this.users.set(u.id, u);
    return { ...u };
  }

  async putLink(digest: string, email: string, expiresAt: number) {
    this.links.set(digest, { email: normalEmail(email), expiresAt });
  }
  async useLink(digest: string) {
    const l = this.links.get(digest);
    if (!l) return null;
    /* deleted whether or not it was still valid — a token is spent by being presented,
       so an expired one cannot be retried until the clock suits */
    this.links.delete(digest);
    if (l.expiresAt <= Date.now()) return null;
    return { email: l.email };
  }

  async putSession(digest: string, userId: string, expiresAt: number) {
    this.sessions.set(digest, { token: digest, userId, expiresAt });
  }
  async sessionByDigest(digest: string) {
    const s = this.sessions.get(digest);
    if (!s) return null;
    if (s.expiresAt <= Date.now()) { this.sessions.delete(digest); return null; }
    return { ...s };
  }
  async dropSession(digest: string) { this.sessions.delete(digest); }

  async membership(siteId: string, userId: string) {
    const m = this.members.get(siteId + '|' + userId);
    return m ? { ...m } : null;
  }
  async grant(siteId: string, userId: string, role: Role) {
    const m: Membership = { siteId, userId, role };
    this.members.set(siteId + '|' + userId, m);
    return { ...m };
  }
}

/** How a link is delivered. In development it is logged; nothing here sends mail itself. */
export type LinkSender = (to: string, url: string) => Promise<void> | void;

export const logLink: LinkSender = (to, url) => {
  console.log(`\n  login link for ${to}\n  ${url}\n`);
};
