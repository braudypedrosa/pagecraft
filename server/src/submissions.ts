/** Cloud inbox data is private and separate from public site files. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rename, rm, link, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Doc, FormField, Node } from '../../app/src/core/types.ts';
import { slugify } from '../../app/src/core/index.ts';

export type SubmissionStatus = 'new' | 'read' | 'archived';
export interface SiteForm { id: string; name: string; pages: string[]; fields: FormField[] }
export interface Submission {
  id: string; formId: string; formName: string; createdAt: string; status: SubmissionStatus;
  values: { label: string; value: string }[];
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
export class FileSubmissionStore {
  private root: string;
  constructor(root: string) { this.root = root; }
  private dir(site: string) { return join(this.root, createHash('sha256').update(site).digest('hex')); }
  async list(site: string): Promise<Submission[]> {
    const dir = this.dir(site);
    const files = await readdir(dir).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
    const entries: Submission[] = [];
    for (const file of files.filter(f => /^[a-f0-9-]+\.json$/.test(f))) entries.push(JSON.parse(await readFile(join(dir, file), 'utf8')));
    return entries.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async add(site: string, entry: Submission) {
    if (!/^[a-f0-9-]{36}$/.test(entry.id)) throw new Error('Invalid entry ID.');
    const dir = this.dir(site); await mkdir(dir, { recursive: true, mode: 0o700 });
    if ((await readdir(dir)).length >= 10000) throw new Error('Inbox is full.');
    // Exclusive creation makes a repeated request ID idempotent.
    const temp = join(dir, randomUUID() + '.tmp');
    await writeFile(temp, JSON.stringify(entry), { flag: 'wx', mode: 0o600 });
    try { await link(temp, join(dir, entry.id + '.json')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    finally { await unlink(temp); }
  }
  async status(site: string, id: string, status: SubmissionStatus) {
    if (!/^[a-f0-9-]{36}$/.test(id)) return false;
    const path = join(this.dir(site), id + '.json');
    let entry: Submission;
    try { entry = JSON.parse(await readFile(path, 'utf8')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
    entry.status = status;
    const temp = path + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify(entry), { mode: 0o600 }); await rename(temp, path); return true;
  }
  async removeSite(site: string) { await rm(this.dir(site), { recursive: true, force: true }); }
}
