/* Assistant tokens and proposals (Phase 7). See docs/phase7-assistant-proposals-design.md.

   A token belongs to one site and can do one thing beyond reading it: file a proposal. It cannot
   publish, upload, change settings or people, or touch code, and the site's owner applies every
   proposal by hand in the editor. Tokens are shown once and stored as SHA-256 digests.

   Files under the environment's publication root, like reviews and submissions: a token made on
   staging is a staging token. One file per token and per proposal, so no two writers share a
   file. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
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
}
export type AssistantTokenView = Omit<AssistantToken, 'digest'> & { lastUsedAt: string | null };

export type ProposalStatus = 'pending' | 'applied' | 'declined';
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
}

export const ASSISTANT_LIMITS = { tokens: 10, pending: 25, keepDays: 90, nameMax: 60 };

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

  /** A new token for one site. The plain token is returned once and never stored. */
  async createToken(siteId: string, name: string, userId: string) {
    const active = (await this.tokens(siteId)).filter(t => !t.revokedAt);
    if (active.length >= ASSISTANT_LIMITS.tokens) throw new AssistantLimitError(`A site can have up to ${ASSISTANT_LIMITS.tokens} active assistant tokens. Revoke one first.`);
    const id = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const token = `pca.${b64(siteId)}.${id}.${secret}`;
    const record: AssistantToken = {
      id, siteId, name: name.trim().slice(0, ASSISTANT_LIMITS.nameMax) || 'Assistant', hint: token.slice(0, 12),
      digest: sha256(token), createdAt: new Date().toISOString(), createdBy: userId, revokedAt: null,
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
      .filter(p => p.status === 'pending' || (p.decidedAt || p.createdAt) >= cutoff)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  async proposal(siteId: string, id: string) {
    if (!ID.test(id)) return null;
    const row = await json<Proposal>(join(this.dir(siteId), 'proposals', `${id}.json`));
    return row && row.siteId === siteId ? row : null;
  }

  /** Pending → applied or declined, once. */
  async decide(siteId: string, id: string, input: { status: 'applied' | 'declined'; by: string; version?: number }) {
    const row = await this.proposal(siteId, id);
    if (!row || row.status !== 'pending') return null;
    const next: Proposal = {
      ...row, status: input.status, decidedAt: new Date().toISOString(), decidedBy: input.by,
      appliedVersion: input.status === 'applied' && Number.isInteger(input.version) ? input.version! : null,
    };
    await writeAtomic(join(this.dir(siteId), 'proposals', `${id}.json`), next);
    return next;
  }
}

const withoutDigest = ({ digest: _digest, ...rest }: AssistantToken) => rest;

export class AssistantLimitError extends Error {}
