/* Assistant tokens and proposals (Phase 7). See docs/phase7-assistant-proposals-design.md.

   A token belongs to one site and can do one thing beyond reading it: file a proposal. It cannot
   publish, upload, change settings or people, or touch code, and the site's owner applies every
   proposal by hand in the editor. Tokens are shown once and stored as SHA-256 digests.

   Files under the environment's publication root, like reviews and submissions: a token made on
   staging is a staging token. One file per token and per proposal, so no two writers share a
   file. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProposalChange } from '../../app/src/core/index.ts';

export interface AssistantToken {
  id: string;
  siteId: string;
  name: string;
  /** the first characters, so the owner can tell tokens apart */
  hint: string;
  digest: string;
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
  /** set when the token came from an assistant app signing in (OAuth), not from the page */
  clientId?: string;
}
export type AssistantTokenView = Omit<AssistantToken, 'digest'> & { lastUsedAt: string | null };

/** `applying` is held by the editor between claiming a proposal and saying it was applied. */
export type ProposalStatus = 'pending' | 'applying' | 'applied' | 'declined';
export interface Proposal {
  id: string;
  siteId: string;
  /** the draft version the assistant read; it must match when the proposal is filed */
  baseVersion: number;
  title: string;
  summary: string;
  changes: ProposalChange[];
  /** the pages (or header/footer) the changes touch */
  regions: string[];
  createdAt: string;
  tokenId: string;
  tokenName: string;
  status: ProposalStatus;
  decidedAt: string | null;
  decidedBy: string | null;
  /** the draft version the applied changes were saved as */
  appliedVersion: number | null;
  /** when, and by whom, the editor claimed it to apply */
  claimedAt?: string | null;
  claimedBy?: string | null;
}

export const ASSISTANT_LIMITS = { tokens: 10, pending: 25, keepDays: 90, nameMax: 60 };
/** A claim this old was abandoned — the tab closed while applying — and can be taken again. */
export const CLAIM_TTL = 10 * 60_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s: string) => { try { return Buffer.from(s, 'base64url').toString('utf8'); } catch { return ''; } };
const TOKEN = /^pca\.([A-Za-z0-9_-]{1,200})\.([a-f0-9]{16})\.([A-Za-z0-9_-]{43})$/;
const ID = /^[a-f0-9]{16}$/;

async function json<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
}
async function writeAtomic(file: string, data: unknown) {
  const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temp, typeof data === 'string' ? data : JSON.stringify(data), { mode: 0o600 });
  await rename(temp, file);
}
async function listJson<T>(dir: string): Promise<T[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const out: T[] = [];
  for (const name of names.filter(n => /^[a-f0-9]{16}\.json$/.test(n))) {
    const row = await json<T>(join(dir, name)).catch(() => null);
    if (row) out.push(row);
  }
  return out;
}

/** Is this an assistant token at all? The /mcp route uses it to pick which credential to check. */
export const isAssistantToken = (raw: string) => /^pca\./.test(raw);

export class FileAssistantStore {
  readonly root: string;
  private lastTouch = new Map<string, number>();
  constructor(root: string) { this.root = root; }
  dir(site: string) { return join(this.root, sha256(site)); }

  /** A new token for one site. The plain token is returned once and never stored. An app that
      signs in again replaces the token it had for this site rather than adding another. */
  async createToken(siteId: string, name: string, userId: string, options: { clientId?: string } = {}) {
    if (options.clientId) {
      for (const t of await this.tokens(siteId)) {
        if (!t.revokedAt && t.clientId === options.clientId && t.createdBy === userId) await this.revokeToken(siteId, t.id);
      }
    }
    const active = (await this.tokens(siteId)).filter(t => !t.revokedAt);
    if (active.length >= ASSISTANT_LIMITS.tokens) throw new AssistantLimitError(`A site can have up to ${ASSISTANT_LIMITS.tokens} active assistant tokens. Revoke one first.`);
    const id = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const token = `pca.${b64(siteId)}.${id}.${secret}`;
    const record: AssistantToken = {
      id, siteId, name: name.trim().slice(0, ASSISTANT_LIMITS.nameMax) || 'Assistant', hint: token.slice(0, 12),
      digest: sha256(token), createdAt: new Date().toISOString(), createdBy: userId, revokedAt: null,
      ...(options.clientId ? { clientId: options.clientId } : {}),
    };
    const dir = join(this.dir(siteId), 'tokens');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeAtomic(join(dir, `${id}.json`), record);
    return { token, view: { ...withoutDigest(record), lastUsedAt: null } };
  }

  async tokens(siteId: string): Promise<AssistantTokenView[]> {
    const dir = join(this.dir(siteId), 'tokens');
    const rows = await listJson<AssistantToken>(dir);
    const views = await Promise.all(rows.map(async row => ({
      ...withoutDigest(row),
      lastUsedAt: (await readFile(join(dir, `${row.id}.used`), 'utf8').catch(() => '')).trim() || null,
    })));
    return views.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  async revokeToken(siteId: string, tokenId: string) {
    if (!ID.test(tokenId)) return false;
    const file = join(this.dir(siteId), 'tokens', `${tokenId}.json`);
    const row = await json<AssistantToken>(file);
    if (!row || row.revokedAt) return false;
    await writeAtomic(file, { ...row, revokedAt: new Date().toISOString() });
    return true;
  }

  /** The site and token behind a bearer token, or null. Constant-time on the digest. */
  async authenticate(raw: string): Promise<{ siteId: string; tokenId: string; name: string } | null> {
    const m = TOKEN.exec(raw.trim());
    if (!m) return null;
    const siteId = unb64(m[1]);
    if (!siteId) return null;
    const row = await json<AssistantToken>(join(this.dir(siteId), 'tokens', `${m[2]}.json`)).catch(() => null);
    if (!row || row.revokedAt || row.siteId !== siteId) return null;
    const a = Buffer.from(row.digest, 'hex'), b = Buffer.from(sha256(raw.trim()), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    await this.touch(siteId, row.id);
    return { siteId, tokenId: row.id, name: row.name };
  }

  /** "Last used", written at most every five minutes per process. */
  private async touch(siteId: string, tokenId: string) {
    const key = `${siteId}|${tokenId}`;
    if (Date.now() - (this.lastTouch.get(key) || 0) < 5 * 60_000) return;
    this.lastTouch.set(key, Date.now());
    await writeAtomic(join(this.dir(siteId), 'tokens', `${tokenId}.used`), new Date().toISOString()).catch(() => undefined);
  }

  async addProposal(input: Omit<Proposal, 'id' | 'createdAt' | 'status' | 'decidedAt' | 'decidedBy' | 'appliedVersion'>) {
    const pending = (await this.proposals(input.siteId)).filter(p => p.status === 'pending');
    if (pending.length >= ASSISTANT_LIMITS.pending) {
      throw new AssistantLimitError(`${pending.length} proposals are already waiting for review. The owner needs to apply or decline some first.`);
    }
    const proposal: Proposal = {
      ...input, id: randomBytes(8).toString('hex'), createdAt: new Date().toISOString(),
      status: 'pending', decidedAt: null, decidedBy: null, appliedVersion: null,
    };
    const dir = join(this.dir(input.siteId), 'proposals');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeAtomic(join(dir, `${proposal.id}.json`), proposal);
    return proposal;
  }

  /** Newest first. Decided proposals older than 90 days are left out. */
  async proposals(siteId: string): Promise<Proposal[]> {
    const cutoff = new Date(Date.now() - ASSISTANT_LIMITS.keepDays * 86_400_000).toISOString();
    return (await listJson<Proposal>(join(this.dir(siteId), 'proposals')))
      .filter(p => p.status === 'pending' || p.status === 'applying' || (p.decidedAt || p.createdAt) >= cutoff)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  async proposal(siteId: string, id: string) {
    if (!ID.test(id)) return null;
    const row = await json<Proposal>(join(this.dir(siteId), 'proposals', `${id}.json`));
    return row && row.siteId === siteId ? row : null;
  }

  /** Pending → applying, once. The editor claims a proposal before it applies anything, so a
      second tab or a second click gets a refusal instead of applying the same changes twice. The
      claim is an exclusive file, which holds across processes; one older than `CLAIM_TTL` was
      abandoned and can be taken again. Null when there is no such proposal. */
  async claim(siteId: string, id: string, by: string): Promise<{ ok: boolean; proposal: Proposal } | null> {
    const row = await this.proposal(siteId, id);
    if (!row) return null;
    if (row.status !== 'pending' && row.status !== 'applying') return { ok: false, proposal: row };
    const dir = join(this.dir(siteId), 'proposals');
    if (!(await this.lock(join(dir, `${id}.claim`)))) return { ok: false, proposal: row };
    const next: Proposal = { ...row, status: 'applying', claimedAt: new Date().toISOString(), claimedBy: by };
    await writeAtomic(join(dir, `${id}.json`), next);
    return { ok: true, proposal: next };
  }
  private async lock(file: string) {
    const take = () => writeFile(file, String(Date.now()), { flag: 'wx', mode: 0o600 }).then(() => true, (e: NodeJS.ErrnoException) => {
      if (e.code === 'EEXIST') return false;
      throw e;
    });
    if (await take()) return true;
    const at = Number((await readFile(file, 'utf8').catch(() => '')).trim()) || 0;
    if (Date.now() - at <= CLAIM_TTL) return false;
    // Abandoned. Whoever moves it aside first is the one who may take it.
    const aside = `${file}.${randomBytes(6).toString('hex')}.stale`;
    try { await rename(file, aside); } catch { return false; }
    await rm(aside, { force: true });
    return take();
  }

  /** Pending or applying → applied or declined, once. */
  async decide(siteId: string, id: string, input: { status: 'applied' | 'declined'; by: string; version?: number }) {
    const row = await this.proposal(siteId, id);
    if (!row || (row.status !== 'pending' && row.status !== 'applying')) return null;
    const next: Proposal = {
      ...row, status: input.status, decidedAt: new Date().toISOString(), decidedBy: input.by,
      appliedVersion: input.status === 'applied' && Number.isInteger(input.version) ? input.version! : null,
    };
    const dir = join(this.dir(siteId), 'proposals');
    await writeAtomic(join(dir, `${id}.json`), next);
    await rm(join(dir, `${id}.claim`), { force: true });
    return next;
  }

  /** A deleted site's tokens and proposals, gone. */
  async removeSite(siteId: string) {
    await rm(this.dir(siteId), { recursive: true, force: true });
  }
}

const withoutDigest = ({ digest: _digest, ...rest }: AssistantToken) => rest;

/* ---- OAuth for assistant apps (claude.ai, Claude Desktop, and other MCP clients) ----
   Public clients only: they register themselves, prove the code with PKCE, and receive the same
   kind of per-site token as the Assistants page makes. Consents and codes are single use and
   expire in ten minutes. Files under `oauth/`, alongside the per-site directories. */

export interface OAuthClient {
  id: string; name: string; redirectUris: string[]; createdAt: string;
  /** when a sign-in with it last started, at most daily */
  usedAt?: string;
}
export interface OAuthConsent { userId: string; clientId: string; redirectUri: string; challenge: string; state: string; resource: string }
export interface OAuthCode extends OAuthConsent { siteId: string }

const OAUTH_TTL = 10 * 60_000;
const CLIENT_IDLE = 30 * 86_400_000;

export class FileOAuthStore {
  readonly root: string;
  private sweptAt = 0;
  constructor(root: string) { this.root = root; }
  private file(kind: 'clients' | 'consents' | 'codes', key: string) { return join(this.root, 'oauth', kind, `${key}.json`); }

  /** Clear out what nobody can use any more: consents and codes past their ten minutes, whether
      taken or not, and registered apps with no live token that have started no sign-in for 30
      days. Registration is open to anyone, so without this the folders only grow. */
  async sweep(now = Date.now()) {
    this.sweptAt = now;
    for (const kind of ['consents', 'codes'] as const) {
      const dir = join(this.root, 'oauth', kind);
      // Each file is written once, so its time is when it was issued.
      for (const name of await readdir(dir).catch(() => [] as string[])) {
        const info = await stat(join(dir, name)).catch(() => null);
        if (info && now - info.mtimeMs > OAUTH_TTL) await rm(join(dir, name), { force: true });
      }
    }
    const dir = join(this.root, 'oauth', 'clients');
    const names = await readdir(dir).catch(() => [] as string[]);
    if (!names.length) return;
    const withToken = await this.clientsWithTokens();
    for (const name of names) {
      const m = /^(pcc_[a-f0-9]{24})\.json$/.exec(name);
      if (!m || withToken.has(m[1])) continue;
      const client = await json<OAuthClient>(join(dir, name)).catch(() => null);
      if (client && now - Date.parse(client.usedAt || client.createdAt) > CLIENT_IDLE) await rm(join(dir, name), { force: true });
    }
  }
  /** Lazily, at most hourly per process; a failed sweep never fails the request. */
  private async sweepHourly() {
    if (Date.now() - this.sweptAt < 3_600_000) return;
    await this.sweep().catch(error => console.error('assistant sign-in files could not be swept:', (error as Error).message));
  }
  /** Apps holding an unrevoked token for any site. Tokens live in the per-site folders beside
      `oauth/`: FileAssistantStore and this store share a root. */
  private async clientsWithTokens() {
    const ids = new Set<string>();
    for (const site of await readdir(this.root).catch(() => [] as string[])) {
      if (!/^[a-f0-9]{64}$/.test(site)) continue;
      for (const token of await listJson<AssistantToken>(join(this.root, site, 'tokens'))) {
        if (token.clientId && !token.revokedAt) ids.add(token.clientId);
      }
    }
    return ids;
  }

  async registerClient(input: { name: string; redirectUris: string[] }) {
    await this.sweepHourly();
    const client: OAuthClient = { id: `pcc_${randomBytes(12).toString('hex')}`, name: input.name, redirectUris: input.redirectUris, createdAt: new Date().toISOString() };
    await mkdir(join(this.root, 'oauth', 'clients'), { recursive: true, mode: 0o700 });
    await writeAtomic(this.file('clients', client.id), client);
    return client;
  }
  async client(id: string) {
    if (!/^pcc_[a-f0-9]{24}$/.test(id)) return null;
    return json<OAuthClient>(this.file('clients', id)).catch(() => null);
  }

  /** Store a one-time secret's payload under its digest; returns the secret. */
  private async put(kind: 'consents' | 'codes', payload: object) {
    const secret = randomBytes(32).toString('base64url');
    await mkdir(join(this.root, 'oauth', kind), { recursive: true, mode: 0o700 });
    await writeAtomic(this.file(kind, sha256(secret)), { ...payload, expiresAt: Date.now() + OAUTH_TTL });
    return secret;
  }
  /** Take a one-time secret's payload. Renaming first makes it single use across processes. */
  private async take<T>(kind: 'consents' | 'codes', secret: string): Promise<T | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
    const file = this.file(kind, sha256(secret)), claimed = `${file}.${randomBytes(6).toString('hex')}.taken`;
    try { await rename(file, claimed); } catch { return null; }
    const row = await json<T & { expiresAt: number }>(claimed).catch(() => null);
    await rm(claimed, { force: true });
    return row && row.expiresAt > Date.now() ? row : null;
  }
  /** The owner reached the approval page: the app is in use, so the sweep keeps it. */
  async createConsent(consent: OAuthConsent) {
    const client = await this.client(consent.clientId);
    if (client && Date.now() - Date.parse(client.usedAt || client.createdAt) > 86_400_000) {
      await writeAtomic(this.file('clients', client.id), { ...client, usedAt: new Date().toISOString() });
    }
    await this.sweepHourly();
    return this.put('consents', consent);
  }
  takeConsent(secret: string) { return this.take<OAuthConsent>('consents', secret); }
  createCode(code: OAuthCode) { return this.put('codes', code); }
  takeCode(secret: string) { return this.take<OAuthCode>('codes', secret); }
}

export class AssistantLimitError extends Error {}
