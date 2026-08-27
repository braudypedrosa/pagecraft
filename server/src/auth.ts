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
export type AccountPlan = 'free';

export interface User {
  id: string;
  email: string;
  name: string;
  authUserId?: string | null;
  plan?: AccountPlan;
  createdAt?: string;
}
export interface Session { token: string; userId: string; expiresAt: number }
export interface Membership { siteId: string; userId: string; role: Role }
export interface SessionAccess { user: User; role: Role | null }
export interface ManualImportCredential {
  id: string;
  ownerId: string;
  installationId: string;
  accessTokenDigest: string;
  accessExpiresAt: number;
  refreshTokenDigest: string;
  status: 'active' | 'revoked';
  createdAt: number;
  updatedAt: number;
  revokedAt: number | null;
}

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
export const validEmail = (raw: string) => {
  const email = normalEmail(raw);
  return email.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,189}$/.test(email);
};

export interface AuthStore {
  userByEmail(email: string): Promise<User | null>;
  userById(id: string): Promise<User | null>;
  /** A verified Supabase identity mapped to Pagecraft's profile and memberships. */
  userByAuthId(authUserId: string): Promise<User | null>;
  /** Link a verified identity to an invited profile, or create its fresh profile. */
  ensureAuthUser(authUserId: string, email: string, name?: string): Promise<User>;
  /** Update only editable profile fields. Identity and plan are never caller-controlled. */
  updateProfile(userId: string, input: { name: string }): Promise<User | null>;
  /** Resolve several revision authors without one store round trip per history row. */
  usersByIds(ids: string[]): Promise<User[]>;
  createUser(email: string, name?: string): Promise<User>;

  /** Store the digest, never the token. */
  putLink(digest: string, email: string, expiresAt: number): Promise<void>;
  /** Consume it: returns the email once, then never again. */
  useLink(digest: string): Promise<{ email: string } | null>;

  putSession(digest: string, userId: string, expiresAt: number): Promise<void>;
  sessionByDigest(digest: string): Promise<Session | null>;
  /** Resolve a live session and its user in one store round trip. */
  userForSession(digest: string): Promise<User | null>;
  /** Resolve identity and one site's membership together; null means the session is invalid. */
  accessForSession(digest: string, siteId: string): Promise<SessionAccess | null>;
  dropSession(digest: string): Promise<void>;

  membership(siteId: string, userId: string): Promise<Membership | null>;
  membershipsForUser(userId: string): Promise<Membership[]>;
  grant(siteId: string, userId: string, role: Role): Promise<Membership>;
  /** Everyone with a role on this site, with the addresses an owner needs to read. */
  members(siteId: string): Promise<(Membership & { email: string; name: string })[]>;
  revoke(siteId: string, userId: string): Promise<boolean>;

  createManualImportCredential(input: Omit<ManualImportCredential,
    'status' | 'createdAt' | 'updatedAt' | 'revokedAt'>): Promise<ManualImportCredential>;
  manualImportByAccess(digest: string): Promise<ManualImportCredential | null>;
  manualImportByRefresh(digest: string): Promise<ManualImportCredential | null>;
  rotateManualImportAccess(id: string, digest: string, expiresAt: number): Promise<ManualImportCredential | null>;
  revokeManualImportCredential(id: string, refreshDigest: string): Promise<boolean>;
}

/** The auth half of the schema, beside the site half in `store-pg.ts`. */
export const AUTH_SCHEMA = `
create table if not exists users (
  id          text primary key,
  email       text not null unique,
  name        text not null default '',
  created_at  timestamptz not null default now()
);
alter table users add column if not exists auth_user_id text;
alter table users add column if not exists plan text not null default 'free';
create unique index if not exists users_auth_user_id_key on users (auth_user_id)
  where auth_user_id is not null;

create table if not exists login_links (
  digest      text primary key,
  email       text not null,
  expires_at  timestamptz not null
);

create table if not exists sessions (
  digest      text primary key,
  user_id     text not null references users (id) on delete cascade,
  expires_at  timestamptz not null
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists site_users (
  site_id     text not null references sites (id) on delete cascade,
  user_id     text not null references users (id) on delete cascade,
  role        text not null check (role in ('owner', 'content')),
  primary key (site_id, user_id)
);

create table if not exists wordpress_import_credentials (
  id text primary key,
  owner_id text not null references users (id) on delete cascade,
  installation_id text not null,
  access_token_digest text not null unique,
  access_expires_at timestamptz not null,
  refresh_token_digest text not null unique,
  status text not null check (status in ('active', 'revoked')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (owner_id, installation_id)
);
create index if not exists wordpress_import_credentials_owner_idx
  on wordpress_import_credentials (owner_id, status);
`;

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
  private memberships = new Map<string, Membership>();
  private manualImports = new Map<string, ManualImportCredential>();
  private seq = 0;

  async userByEmail(email: string) {
    for (const u of this.users.values()) if (u.email === normalEmail(email)) return { ...u };
    return null;
  }
  async userById(id: string) {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }
  async userByAuthId(authUserId: string) {
    for (const user of this.users.values()) {
      if (user.authUserId === authUserId) return { ...user };
    }
    return null;
  }
  async ensureAuthUser(authUserId: string, email: string, name = '') {
    const existingIdentity = await this.userByAuthId(authUserId);
    if (existingIdentity) {
      const stored = this.users.get(existingIdentity.id)!;
      stored.email = normalEmail(email);
      if (!stored.name && name.trim()) stored.name = name.trim();
      return { ...stored };
    }
    const normalized = normalEmail(email);
    const existingEmail = await this.userByEmail(normalized);
    if (existingEmail) {
      if (existingEmail.authUserId && existingEmail.authUserId !== authUserId) {
        throw new Error('that email is already linked to another identity');
      }
      const stored = this.users.get(existingEmail.id)!;
      stored.authUserId = authUserId;
      if (name.trim()) stored.name = name.trim();
      return { ...stored };
    }
    const user: User = {
      id: 'u' + ++this.seq, email: normalized, name: name.trim(), authUserId,
      plan: 'free', createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return { ...user };
  }
  async usersByIds(ids: string[]) {
    return [...new Set(ids)].flatMap(id => {
      const user = this.users.get(id);
      return user ? [{ ...user }] : [];
    });
  }
  async updateProfile(userId: string, input: { name: string }) {
    const stored = this.users.get(userId);
    if (!stored) return null;
    stored.name = input.name.trim();
    return { ...stored };
  }
  async createUser(email: string, name = '') {
    const existing = await this.userByEmail(email);
    if (existing) {
      const stored = this.users.get(existing.id)!;
      if (name.trim()) stored.name = name.trim();
      return { ...stored };
    }
    const u: User = {
      id: 'u' + ++this.seq, email: normalEmail(email), name, authUserId: null,
      plan: 'free', createdAt: new Date().toISOString()
    };
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
  async userForSession(digest: string) {
    const session = await this.sessionByDigest(digest);
    return session ? this.userById(session.userId) : null;
  }
  async accessForSession(digest: string, siteId: string) {
    const user = await this.userForSession(digest);
    if (!user) return null;
    const membership = await this.membership(siteId, user.id);
    return { user, role: membership?.role || null };
  }
  async dropSession(digest: string) { this.sessions.delete(digest); }

  async membership(siteId: string, userId: string) {
    const m = this.memberships.get(siteId + '|' + userId);
    return m ? { ...m } : null;
  }
  async membershipsForUser(userId: string) {
    const out: Membership[] = [];
    for (const m of this.memberships.values()) if (m.userId === userId) out.push({ ...m });
    return out;
  }
  async grant(siteId: string, userId: string, role: Role) {
    const m: Membership = { siteId, userId, role };
    this.memberships.set(siteId + '|' + userId, m);
    return { ...m };
  }
  async members(siteId: string) {
    const out = [];
    for (const m of this.memberships.values()) {
      if (m.siteId !== siteId) continue;
      const u = this.users.get(m.userId);
      out.push({ ...m, email: u ? u.email : '', name: u ? u.name : '' });
    }
    return out.sort((x, y) => x.email.localeCompare(y.email));
  }
  async revoke(siteId: string, userId: string) {
    return this.memberships.delete(siteId + '|' + userId);
  }
  async createManualImportCredential(input: Omit<ManualImportCredential,
    'status' | 'createdAt' | 'updatedAt' | 'revokedAt'>) {
    const now = Date.now();
    for (const item of this.manualImports.values()) {
      if (item.ownerId === input.ownerId && item.installationId === input.installationId) {
        item.status = 'revoked'; item.revokedAt = item.updatedAt = now;
      }
    }
    const credential: ManualImportCredential = {
      ...input, status: 'active', createdAt: now, updatedAt: now, revokedAt: null
    };
    this.manualImports.set(input.id, credential);
    return { ...credential };
  }
  async manualImportByAccess(digest: string) {
    const item = [...this.manualImports.values()].find(candidate =>
      candidate.status === 'active' && candidate.accessTokenDigest === digest && candidate.accessExpiresAt > Date.now());
    return item ? { ...item } : null;
  }
  async manualImportByRefresh(digest: string) {
    const item = [...this.manualImports.values()].find(candidate =>
      candidate.status === 'active' && candidate.refreshTokenDigest === digest);
    return item ? { ...item } : null;
  }
  async rotateManualImportAccess(id: string, digest: string, expiresAt: number) {
    const item = this.manualImports.get(id);
    if (!item || item.status !== 'active') return null;
    item.accessTokenDigest = digest;
    item.accessExpiresAt = expiresAt;
    item.updatedAt = Date.now();
    return { ...item };
  }
  async revokeManualImportCredential(id: string, refreshDigest: string) {
    const item = this.manualImports.get(id);
    if (!item || item.refreshTokenDigest !== refreshDigest) return false;
    if (item.status === 'revoked') return true;
    item.status = 'revoked';
    item.revokedAt = item.updatedAt = Date.now();
    return true;
  }
}

/** How a link is delivered. In development it is logged; nothing here sends mail itself. */
export type LinkSender = (to: string, url: string) => Promise<void> | void;

export const logLink: LinkSender = (to, url) => {
  console.log(`\n  login link for ${to}\n  ${url}\n`);
};
