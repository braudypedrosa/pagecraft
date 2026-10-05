/** Cloud inbox data is private and separate from public site files. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rm, link, unlink, stat, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { Doc, FormField, Node } from '../../app/src/core/types.ts';
import { slugify } from '../../app/src/core/index.ts';

export type SubmissionStatus = 'new' | 'read' | 'archived' | 'success' | 'failed';
export interface SiteForm { id: string; name: string; pages: string[]; fields: FormField[] }
export interface Submission {
  id: string; formId: string; formName: string; createdAt: string; status: SubmissionStatus;
  error?: string;
  values: { label: string; value: string }[];
}
export const submissionOutcome = (entry: Submission) => entry.status === 'failed' ? 'failed' : 'success';
export function sortSubmissions(entries: Submission[], order = 'desc') {
  const direction = order === 'asc' ? 1 : -1;
  return [...entries].sort((a,b) => direction * (a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
}
export function submissionsCsv(entries: Submission[], labels = [...new Set(entries.flatMap(e => e.values.map(v => v.label)))], header = true) {
  const cell = (value: string) => '"' + (/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"';
  return (header ? '\uFEFF' : '') + [...(header ? [['Entry ID','Date','Status','Error',...labels]] : []), ...entries.map(e => [e.id,e.createdAt,submissionOutcome(e),e.error || '',...labels.map(label => e.values.filter(v=>v.label===label).map(v=>v.value).join('\n'))])].map(row=>row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export function siteForms(doc: Doc): SiteForm[] {
  const forms = new Map<string, SiteForm>();
  const visit = (nodes: Node[], page: string, stack = new Set<string>()) => {
    for (const node of nodes || []) {
      if (node.use) {
        const def = doc.meta.components?.find(c => c.id === node.use);
        if (def && !stack.has(def.id)) visit([{ ...def.node, id: node.id }], page, new Set([...stack, def.id]));
      } else if (node.type === 'form') {
        const id = node.id.replace(/[^A-Za-z0-9_-]/g, '');
        const prior = forms.get(id);
        if (prior) { if (!prior.pages.includes(page)) prior.pages.push(page); }
        else forms.set(id, { id, name: String(node.props.aria || 'Form'), pages: [page], fields: Array.isArray(node.props.fields) ? node.props.fields : [] });
      }
      visit(node.children, page, stack);
    }
  };
  visit(doc.header, 'Header'); visit(doc.footer, 'Footer');
  for (const page of doc.pages) visit(page.tree, page.name);
  return [...forms.values()];
}
export function submissionValues(form: SiteForm, body: URLSearchParams) {
  return form.fields.map((field, i) => {
    const name = field.name || slugify(field.label) || 'field-' + (i + 1);
    const all = body.getAll(name);
    if (all.length > 1) throw new Error('Check ' + (field.label || name) + '.');
    const value = (all[0] || '').trim();
    if (field.required && !value) throw new Error((field.label || name) + ' is required.');
    if (value.length > 8000) throw new Error((field.label || name) + ' is too long.');
    if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid email address.');
    if (value && field.type === 'number' && !Number.isFinite(Number(value))) throw new Error('Enter a valid number.');
    if (value && field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error('Enter a valid date.');
    if (value && field.type === 'select' && !String(field.opts || '').split(',').map(s => s.trim()).includes(value)) throw new Error('Choose an available option.');
    if (value && field.type === 'checkbox' && value !== 'on') throw new Error('Check the selected option.');
    return { label: field.label || name, value };
  });
}
/* Successful entries count toward the inbox limit. Failed attempts are anonymous and free to send,
   so they live in their own `failed/` folder, capped separately, and never take a real entry's place. */
const ENTRY_LIMIT = 10000, FAILED_LIMIT = 200;
const isEntryFile = (f: string) => /^[a-f0-9-]+\.json$/.test(f);
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';
export class FileSubmissionStore {
  private root: string;
  constructor(root: string) { this.root = root; }
  private dir(site: string) { return join(this.root, createHash('sha256').update(site).digest('hex')); }
  private failedDir(site: string) { return join(this.dir(site), 'failed'); }
  private summaries = new Map<string, { stamp: string; rows: Submission[] }>();
  /** Sites whose older failed entries, stored beside successful ones, were already moved out. */
  private sorted = new Set<string>();
  /** Every entry file, successful first, then failed. */
  private async files(site: string) {
    const names = (dir: string) => readdir(dir).then(all => all.filter(isEntryFile).map(f => join(dir, f)), e => { if (missing(e)) return [] as string[]; throw e; });
    return [...await names(this.dir(site)), ...await names(this.failedDir(site))];
  }
  /** One entry's full body. Failed entries recorded before `failed/` existed are still beside the others. */
  private async read(site: string, entry: Pick<Submission, 'id' | 'status'>): Promise<Submission> {
    const paths = [join(this.dir(site), entry.id + '.json'), join(this.failedDir(site), entry.id + '.json')];
    if (entry.status === 'failed') paths.reverse();
    try { return JSON.parse(await readFile(paths[0], 'utf8')); }
    catch (e) { if (!missing(e)) throw e; return JSON.parse(await readFile(paths[1], 'utf8')); }
  }
  /** Keep only metadata in memory; page reads load at most 25 entry bodies. */
  async overview(site: string): Promise<Submission[]> {
    const dir = this.dir(site);
    const info = await stat(dir).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (!info) { this.summaries.delete(site); return []; }
    const failed = await stat(this.failedDir(site)).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    const stamp = `${info.mtimeMs}:${info.ctimeMs}:${failed?.mtimeMs}:${failed?.ctimeMs}`;
    const cached = this.summaries.get(site);
    if (cached?.stamp === stamp) return cached.rows;
    const files = await this.files(site);
    const rows: Submission[] = [];
    for (let i = 0; i < files.length; i += 32) {
      rows.push(...await Promise.all(files.slice(i, i + 32).map(async file => {
        const entry: Submission = JSON.parse(await readFile(file, 'utf8'));
        return { ...entry, values: [] };
      })));
    }
    rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    if (this.summaries.size >= 100) this.summaries.delete(this.summaries.keys().next().value!);
    this.summaries.set(site, { stamp, rows });
    return rows;
  }
  async page(site: string, metadata: Submission[], form: string, status: string, requested: number, order = 'desc') {
    const filtered = sortSubmissions(metadata.filter(e => e.formId === form && (!status || submissionOutcome(e) === status)), order);
    const page = Math.max(1, Math.min(Math.max(1, Math.ceil(filtered.length / 25)), Math.floor(requested) || 1));
    const items = await Promise.all(filtered.slice((page-1)*25, page*25).map(e => this.read(site, e)));
    return { items, page };
  }
  async list(site: string): Promise<Submission[]> {
    const entries: Submission[] = [];
    for (const file of await this.files(site)) entries.push(JSON.parse(await readFile(file, 'utf8')));
    return entries.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async add(site: string, entry: Submission) {
    if (!/^[a-f0-9-]{36}$/.test(entry.id)) throw new Error('Invalid entry ID.');
    const failed = entry.status === 'failed';
    const dir = failed ? this.failedDir(site) : this.dir(site); await mkdir(dir, { recursive: true, mode: 0o700 });
    if (!failed && await this.stored(site) >= ENTRY_LIMIT) throw new Error('Inbox is full.');
    // Exclusive creation makes a repeated request ID idempotent.
    const temp = join(dir, randomUUID() + '.tmp');
    await writeFile(temp, JSON.stringify(entry), { flag: 'wx', mode: 0o600 });
    /* True when this call stored it; false for a repeated request ID, so a retried submission is
       stored once and counted once. */
    let created: boolean;
    try { await link(temp, join(dir, entry.id + '.json')); created = true; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; created = false; }
    finally { await unlink(temp); }
    if (failed) await this.pruneFailed(site);
    return created;
  }
  /** How many successful entries count toward the limit. The first time an inbox looks full,
      failed entries stored beside them before `failed/` existed are moved there. */
  private async stored(site: string) {
    const dir = this.dir(site);
    const names = (await readdir(dir)).filter(isEntryFile);
    if (names.length < ENTRY_LIMIT || this.sorted.has(site)) return names.length;
    let moved = 0;
    await mkdir(this.failedDir(site), { recursive: true, mode: 0o700 });
    for (let i = 0; i < names.length; i += 32) {
      await Promise.all(names.slice(i, i + 32).map(async name => {
        const entry: Submission = JSON.parse(await readFile(join(dir, name), 'utf8'));
        if (entry.status !== 'failed') return;
        await rename(join(dir, name), join(this.failedDir(site), name)).then(() => { moved++; }, e => { if (!missing(e)) throw e; });
      }));
    }
    this.sorted.add(site);
    if (moved) await this.pruneFailed(site);
    return names.length - moved;
  }
  /** Keep the most recent failed entries; the oldest go first. */
  private async pruneFailed(site: string) {
    const dir = this.failedDir(site);
    const names = (await readdir(dir)).filter(isEntryFile);
    if (names.length <= FAILED_LIMIT) return;
    const rows = await Promise.all(names.map(async name => {
      const entry: Partial<Submission> = JSON.parse(await readFile(join(dir, name), 'utf8').catch(() => '{}'));
      return { name, createdAt: entry.createdAt || '' };
    }));
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
    for (const row of rows.slice(0, rows.length - FAILED_LIMIT)) await unlink(join(dir, row.name)).catch(e => { if (!missing(e)) throw e; });
  }
  async remove(site: string, id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) return false;
    for (const dir of [this.dir(site), this.failedDir(site)]) {
      try { await unlink(join(dir, id + '.json')); this.summaries.delete(site); return true; }
      catch (e) { if (!missing(e)) throw e; }
    }
    return false;
  }
  async removeSite(site: string) { await rm(this.dir(site), { recursive: true, force: true }); }
}
