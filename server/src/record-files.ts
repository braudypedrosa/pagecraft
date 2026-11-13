/* One JSON file per record, for stores that more than one process writes.

   LiteSpeed may run several Node processes over the same files, and a deploy briefly runs a
   candidate beside the live one. A store that reads one state file once and writes all of it
   back loses whatever another process wrote in between, and never sees it either. Here each
   record is its own file: written whole under a temporary name and renamed into place, read from
   disk on every call, and listed by reading its directory. Paths are relative to the root. */
import { randomUUID } from 'node:crypto';
import { link, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface Records {
  read<T>(path: string): Promise<T | null>;
  /** Replace the record at `path`. */
  write(path: string, row: unknown): Promise<void>;
  /** Write only when nothing is at `path` yet. False when something is. */
  create(path: string, row: unknown): Promise<boolean>;
  /** The records directly inside `dir`. Files are unordered; memory keeps insertion order. */
  list<T>(dir: string): Promise<T[]>;
  remove(path: string): Promise<void>;
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

export class FileRecords implements Records {
  readonly root: string;
  constructor(root: string) {
    this.root = root;
  }

  async read<T>(path: string) {
    try {
      return JSON.parse(await readFile(join(this.root, path), 'utf8')) as T;
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }
  private async staged(path: string, row: unknown) {
    const file = join(this.root, path), temporary = `${file}.${randomUUID()}.tmp`;
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(temporary, JSON.stringify(row), { mode: 0o600 });
    return { file, temporary };
  }
  async write(path: string, row: unknown) {
    const { file, temporary } = await this.staged(path, row);
    await rename(temporary, file);
  }
  /* A hard link appears complete or not at all, and refuses a name that is taken. */
  async create(path: string, row: unknown) {
    const { file, temporary } = await this.staged(path, row);
    try {
      await link(temporary, file);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    } finally {
      await rm(temporary, { force: true });
    }
  }
  async list<T>(dir: string) {
    let names: string[];
    try {
      names = await readdir(join(this.root, dir));
    } catch (error) {
      if (missing(error)) return [];
      throw error;
    }
    const rows: (T | null)[] = await Promise.all(names.filter(name => name.endsWith('.json'))
      .map(name => this.read<T>(join(dir, name)).catch(() => null)));
    return rows.filter((row): row is T => row !== null);
  }
  async remove(path: string) {
    await rm(join(this.root, path), { force: true });
  }
}

/** The same contract without a disk, for tests and local runs. */
export class MemoryRecords implements Records {
  private rows = new Map<string, string>();
  async read<T>(path: string) {
    const raw = this.rows.get(path);
    return raw === undefined ? null : JSON.parse(raw) as T;
  }
  async write(path: string, row: unknown) {
    this.rows.set(path, JSON.stringify(row));
  }
  async create(path: string, row: unknown) {
    if (this.rows.has(path)) return false;
    this.rows.set(path, JSON.stringify(row));
    return true;
  }
  async list<T>(dir: string) {
    const prefix = `${dir}/`;
    return [...this.rows].filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([, raw]) => JSON.parse(raw) as T);
  }
  async remove(path: string) {
    this.rows.delete(path);
  }
}

/** Split an old whole-state file into records, then keep it as `<file>.migrated`.

    Safe when several processes start at once. Records are only created, never replaced, so one
    that exists already (written by another process, perhaps changed since) wins over the old
    copy. Only a file that was split is set aside: if a process still running the old code
    rewrites it meanwhile, the newer copy is split too. Anything it writes after the rename lands
    in a new state file, which the next process start splits. */
export async function migrateStateFile<T>(file: string, split: (state: T) => Promise<void>) {
  for (let pass = 0; pass < 5; pass++) {
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch (error) {
      if (missing(error)) return;
      throw error;
    }
    await split(JSON.parse(raw) as T);
    if ((await readFile(file, 'utf8').catch(() => null)) !== raw) continue;
    try {
      await rename(file, `${file}.migrated`);
    } catch (error) {
      if (!missing(error)) throw error;
    }
    return;
  }
}
