import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, lstat, link, open } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface TemplateAuthorGrant {
  id: string;
  name: string;
  ownerId: string;
  environment: string;
  audience: string;
  digest: string;
  createdAt: string;
  revokedAt: string | null;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const TOKEN = /^pct\.([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/;
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));

/** Grant revocation and authorised operations share a cross-process lock. */
export class TemplateAuthorGrants {
  readonly root: string;
  readonly environment: string;
  readonly audience: string;
  readonly operatorIds: readonly string[];
  constructor(root: string, environment: string, audience: string, operatorIds: ReadonlyArray<string>) {
    this.root = resolve(root); this.environment = environment; this.audience = audience; this.operatorIds = operatorIds;
  }

  private async locked<T>(run: () => Promise<T>): Promise<T> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    if ((await lstat(this.root)).isSymbolicLink()) throw new Error('Grant root must not be a symbolic link');
    const lock = join(this.root, '.lock');
    const deadline = Date.now() + 30_000;
    while (true) {
      const temporary = join(this.root, `.lock-${randomBytes(16).toString('hex')}`);
      await writeFile(temporary, JSON.stringify({ pid: process.pid }), { mode: 0o600, flag: 'wx' });
      try {
        await link(temporary, lock);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try {
          const raw = await readFile(lock, 'utf8');
          const owner = JSON.parse(raw) as { pid: number };
          try { process.kill(owner.pid, 0); } catch (dead) {
            if ((dead as NodeJS.ErrnoException).code === 'ESRCH') {
              const recovery = join(this.root, '.recovery');
              try {
                await mkdir(recovery, { mode: 0o700 });
                try { if (await readFile(lock, 'utf8').catch(() => '') === raw) await rm(lock, { force: true }); }
                finally { await rm(recovery, { recursive: true }); }
              } catch (blocked) { if ((blocked as NodeJS.ErrnoException).code !== 'EEXIST') throw blocked; }
            }
          }
        } catch { /* An uninitialised or unreadable lock fails closed. */ }
        if (Date.now() >= deadline) throw new Error('Template authorisation is busy. Retry the request.');
        await delay(20);
      } finally { await rm(temporary, { force: true }); }
    }
    try { return await run(); } finally { await rm(lock, { force: true }); }
  }

  private path(id: string) {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid grant id');
    return join(this.root, `${id}.json`);
  }
  private async load(id: string): Promise<TemplateAuthorGrant | null> {
    const path = this.path(id);
    try {
      if ((await lstat(path)).isSymbolicLink()) throw new Error('Invalid grant file');
      return JSON.parse(await readFile(path, 'utf8')) as TemplateAuthorGrant;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  private async put(row: TemplateAuthorGrant) {
    const path = this.path(row.id), temp = `${path}.${randomBytes(8).toString('hex')}.tmp`;
    const file = await open(temp, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(row)); await file.sync(); } finally { await file.close(); }
    await rename(temp, path);
    const directory = await open(this.root, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  }

  async create(ownerId: string, name: string) {
    if (!this.operatorIds.includes(ownerId)) throw new Error('Template operator access required');
    return this.locked(async () => {
      const id = randomBytes(16).toString('hex');
      const token = `pct.${id}.${randomBytes(32).toString('base64url')}`;
      const row: TemplateAuthorGrant = { id, ownerId, name: name.trim().slice(0, 80) || 'Template author',
        environment: this.environment, audience: this.audience, digest: digest(token),
        createdAt: new Date().toISOString(), revokedAt: null };
      await this.put(row);
      return { token, grant: this.view(row) };
    });
  }

  async revoke(id: string, ownerId: string) {
    return this.locked(async () => {
      const row = await this.load(id);
      if (!row || row.ownerId !== ownerId || !this.operatorIds.includes(ownerId)) return false;
      await this.put({ ...row, revokedAt: new Date().toISOString() });
      return true;
    });
  }

  async withGrant<T>(token: string, run: (grant: Omit<TemplateAuthorGrant, 'digest'>) => Promise<T>): Promise<T | null> {
    const match = TOKEN.exec(token);
    if (!match) return null;
    return this.locked(async () => {
      const row = await this.load(match[1]);
      if (!row || row.revokedAt || row.environment !== this.environment || row.audience !== this.audience
        || !this.operatorIds.includes(row.ownerId) || !/^[a-f0-9]{64}$/.test(row.digest)
        || !timingSafeEqual(Buffer.from(row.digest, 'hex'), Buffer.from(digest(token), 'hex'))) return null;
      return run(this.view(row));
    });
  }

  private view({ digest: _digest, ...row }: TemplateAuthorGrant) { return row; }
}
