import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  CRM_SOURCES,
  CRM_STAGES,
  type CrmContact,
  type CrmContactInput,
  type CrmContactStore,
  type CrmSource,
  type CrmStage,
} from './founder-crm-types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_ROWS = 2_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type CrmStoreErrorCode = 'invalid' | 'conflict' | 'duplicate' | 'unavailable';

export class CrmStoreError extends Error {
  readonly code: CrmStoreErrorCode;

  constructor(code: CrmStoreErrorCode, message: string) {
    super(message);
    this.name = 'CrmStoreError';
    this.code = code;
  }
}

const invalid = (message: string): never => { throw new CrmStoreError('invalid', message); };

const validDate = (value: string) => {
  const match = DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const bounded = (value: unknown, field: string, max: number, required = false) => {
  if (typeof value !== 'string') return invalid(`${field} is invalid`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) return invalid(`${field} is invalid`);
  return clean;
};

export function validateCrmContactInput(input: CrmContactInput): CrmContactInput {
  const id = input.id === undefined ? undefined : bounded(input.id, 'id', 36, true);
  if (id !== undefined && !UUID.test(id)) invalid('id is invalid');
  const accountId = input.accountId === null ? null : bounded(input.accountId, 'accountId', 36, true);
  if (accountId !== null && !UUID.test(accountId)) invalid('accountId is invalid');
  const email = bounded(input.email, 'email', 254, true).toLowerCase();
  if (!EMAIL.test(email)) invalid('email is invalid');
  const stage = input.stage as CrmStage;
  const source = input.source as CrmSource;
  if (!(CRM_STAGES as readonly string[]).includes(stage)) invalid('stage is invalid');
  if (!(CRM_SOURCES as readonly string[]).includes(source)) invalid('source is invalid');
  const followUpOn = input.followUpOn === null ? null : bounded(input.followUpOn, 'followUpOn', 10, true);
  if (followUpOn !== null && !validDate(followUpOn)) invalid('followUpOn is invalid');
  if (typeof input.isTest !== 'boolean') invalid('isTest is invalid');
  if (input.expectedRevision !== undefined &&
      (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1)) {
    invalid('expectedRevision is invalid');
  }
  return {
    ...(id === undefined ? {} : { id }),
    accountId,
    name: bounded(input.name, 'name', 120, accountId === null),
    email,
    company: bounded(input.company, 'company', 160),
    stage,
    source,
    notes: bounded(input.notes, 'notes', 5_000),
    followUpOn,
    isTest: input.isTest,
    ...(input.expectedRevision === undefined ? {} : { expectedRevision: input.expectedRevision }),
  };
}

const readContact = (raw: unknown): CrmContact => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid('stored CRM data is invalid');
  const row = raw as Record<string, unknown>;
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) invalid('stored CRM data is invalid');
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : '';
  const updatedAt = typeof row.updatedAt === 'string' ? row.updatedAt : '';
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) {
    invalid('stored CRM data is invalid');
  }
  const valid = validateCrmContactInput({
    id: row.id as string,
    accountId: row.accountId as string | null,
    name: row.name as string,
    email: row.email as string,
    company: row.company as string,
    stage: row.stage as CrmStage,
    source: row.source as CrmSource,
    notes: row.notes as string,
    followUpOn: row.followUpOn as string | null,
    isTest: row.isTest as boolean,
  });
  return { ...valid, id: valid.id!, createdAt, updatedAt, revision };
};

async function readContacts(filename: string): Promise<CrmContact[]> {
  let info;
  try { info = await lstat(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new CrmStoreError('unavailable', 'CRM data is unavailable');
  }
  const processUid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
      (processUid !== null && info.uid !== processUid)) {
    throw new CrmStoreError('invalid', 'stored CRM file is not private');
  }
  if (info.size > MAX_FILE_BYTES) throw new CrmStoreError('invalid', 'stored CRM data is too large');
  try {
    const parsed = JSON.parse(await readFile(filename, 'utf8')) as unknown;
    if (!Array.isArray(parsed) || parsed.length > MAX_ROWS) {
      throw new CrmStoreError('invalid', 'stored CRM data is invalid');
    }
    return parsed.map(readContact);
  } catch (error) {
    if (error instanceof CrmStoreError) throw error;
    throw new CrmStoreError('invalid', 'stored CRM data is invalid');
  }
}

const storeQueues = new Map<string, Promise<unknown>>();

export class FileFounderCrmStore implements CrmContactStore {
  private readonly filename: string;

  constructor(filename: string) { this.filename = filename; }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const previous = storeQueues.get(this.filename) || Promise.resolve();
    const next = previous.then(work, work);
    storeQueues.set(this.filename, next.catch(() => undefined));
    return next;
  }

  private async save(rows: CrmContact[]) {
    if (rows.length > MAX_ROWS) invalid('CRM contact limit reached');
    const wire = JSON.stringify(rows, null, 2) + '\n';
    if (Buffer.byteLength(wire, 'utf8') > MAX_FILE_BYTES) invalid('CRM data is too large');
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 });
    const temporary = `${this.filename}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(wire, 'utf8');
      await handle.sync();
      await handle.close();
      await rename(temporary, this.filename);
      await chmod(this.filename, 0o600);
    } catch {
      await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw new CrmStoreError('unavailable', 'CRM data could not be saved');
    }
  }

  async list() {
    return this.serialize(() => readContacts(this.filename));
  }

  async put(input: CrmContactInput) {
    const valid = validateCrmContactInput(input);
    return this.serialize(async () => {
      const rows = await readContacts(this.filename);
      const index = valid.id ? rows.findIndex(row => row.id === valid.id) : -1;
      if (valid.id && index < 0) throw new CrmStoreError('conflict', 'CRM contact no longer exists');
      const current = index >= 0 ? rows[index] : null;
      if (current && valid.expectedRevision !== current.revision) {
        throw new CrmStoreError('conflict', 'CRM contact changed; reload and try again');
      }
      if (current && valid.accountId !== current.accountId) {
        const firstLink = current.accountId === null && valid.accountId !== null;
        if (!firstLink || valid.email !== current.email) {
          throw new CrmStoreError('conflict', firstLink
            ? 'CRM account email does not match contact email'
            : 'CRM account link cannot be changed');
        }
      }
      if (!current && valid.expectedRevision !== undefined) {
        throw new CrmStoreError('conflict', 'CRM contact no longer exists');
      }
      const duplicate = rows.some((row, rowIndex) => rowIndex !== index && (
        row.email.toLowerCase() === valid.email ||
        (valid.accountId !== null && row.accountId === valid.accountId)
      ));
      if (duplicate) throw new CrmStoreError('duplicate', 'CRM contact already exists');
      const now = new Date().toISOString();
      const { expectedRevision: _expectedRevision, ...fields } = valid;
      const row: CrmContact = current
        ? { ...current, ...fields, id: current.id, createdAt: current.createdAt, updatedAt: now, revision: current.revision + 1 }
        : { ...fields, id: fields.id || randomUUID(), createdAt: now, updatedAt: now, revision: 1 };
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      await this.save(rows);
      return row;
    });
  }
}
