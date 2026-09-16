/* CSV import for a CMS collection.

   Kept dependency-light on purpose, exactly like `cms-validation.ts` next to it: only
   types and the shared entry validator. `uid` and `slugify` arrive as options rather
   than through `core/index.ts`, so this module stays testable without booting an
   editor and stays available to the server if a future slice needs it.

   The contract this implements is the roadmap's: a mapped ID column matches existing
   entries and updates them, unmatched rows create entries, and an invalid import
   makes no changes at all. `plan.collections` is null whenever anything is wrong, so
   a caller cannot half-apply a bad file. */
import type { Collection, Doc, Item } from './types.ts';
import { cmsBoolean, validateCmsEntry } from './cms-validation.ts';

/** Reserved column targets. Anything else in a mapping is a field id. */
export const IMPORT_SKIP = '';
export const IMPORT_ID = '_id';
export const IMPORT_SLUG = '_slug';
export const IMPORT_DRAFT = '_draft';
const RESERVED = [IMPORT_ID, IMPORT_SLUG, IMPORT_DRAFT];

/** RFC 4180 with the tolerances real exports need: a BOM, CRLF or LF, quoted commas
    and newlines, and `""` for a literal quote. A bare quote mid-value stays literal
    rather than throwing, because rejecting the whole file over one stray character
    helps nobody. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const source = String(text ?? '').replace(/^﻿/, '');
  const endField = () => { row.push(value); value = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch !== '"') { value += ch; continue; }
      if (source[i + 1] === '"') { value += '"'; i++; continue; }
      quoted = false;
      continue;
    }
    if (ch === '"' && value === '') { quoted = true; continue; }
    if (ch === ',') { endField(); continue; }
    if (ch === '\r') { if (source[i + 1] === '\n') i++; endRow(); continue; }
    if (ch === '\n') { endRow(); continue; }
    value += ch;
  }
  if (value !== '' || row.length) endRow();
  return rows;
}

/** A row of nothing but empty cells. Trailing blank lines are normal in exported
    files and must not read as a request to create an empty entry. */
export const blankRow = (row: string[]) => row.every((cell) => !cell.trim());

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Best-effort column → target guess, by header text against field names and ids.
    Only ever a starting point; the mapping step is the user's to correct. */
export function suggestMapping(headers: string[], col: Collection): string[] {
  const taken = new Set<string>();
  const take = (target: string) => { taken.add(target); return target; };
  return headers.map((header) => {
    const key = norm(header);
    if (!key) return IMPORT_SKIP;
    for (const reserved of RESERVED) {
      const label = reserved.slice(1);
      if (!taken.has(reserved) && (key === label || key === 'entry' + label)) return take(reserved);
    }
    const field = col.fields.find(
      (f) => !taken.has(f.id) && (norm(f.name) === key || norm(f.id) === key),
    );
    return field ? take(field.id) : IMPORT_SKIP;
  });
}

export interface ImportOptions {
  uid: () => string;
  slugify: (s: unknown) => string;
}

export interface ImportRow {
  /** 1-based line in the source file, so a reported problem is findable there. */
  line: number;
  action: 'create' | 'update';
  id: string;
  title: string;
  slug: string;
  /** field id (or reserved key) → message. Empty when the row is good. */
  errors: Record<string, string>;
}

export interface ImportPlan {
  rows: ImportRow[];
  creates: number;
  updates: number;
  invalid: number;
  /** The collections to hand to one `cmsCommit`, or null when nothing may be applied. */
  collections: Collection[] | null;
  /** A problem with the file or mapping itself, rather than with a row. */
  problem: string;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Build the whole result up front and validate it as a finished collection, which is
    what makes slug collisions *between imported rows* visible in the preview instead
    of at save time. `table` is the parsed file including its header row. */
export function planImport(
  doc: Doc,
  collectionId: string,
  table: string[][],
  mapping: string[],
  assets: ReadonlySet<string>,
  opts: ImportOptions,
): ImportPlan {
  const plan: ImportPlan = {
    rows: [], creates: 0, updates: 0, invalid: 0, collections: null, problem: '',
  };
  const collections = clone(doc.meta.collections || []);
  const col = collections.find((c) => c.id === collectionId);
  if (!col) { plan.problem = 'That collection no longer exists.'; return plan; }

  const body = table.slice(1).map((row, i) => ({ row, line: i + 2 })).filter((r) => !blankRow(r.row));
  if (!body.length) { plan.problem = 'This file has no data rows.'; return plan; }

  const columns = mapping
    .map((target, index) => ({ target, index }))
    .filter((c) => c.target !== IMPORT_SKIP);
  if (!columns.some((c) => c.target !== IMPORT_ID)) {
    plan.problem = 'Map at least one column to a field before importing.';
    return plan;
  }
  const unknown = columns.find(
    (c) => !RESERVED.includes(c.target) && !col.fields.some((f) => f.id === c.target),
  );
  if (unknown) { plan.problem = 'A mapped column points at a field that no longer exists.'; return plan; }

  const titleField = col.fields.find((f) => f.type === 'text') || null;
  const byId = new Map(col.items.map((item) => [item.id, item]));
  /* Two rows claiming the same existing entry would make the outcome depend on row
     order, so the second one is an error rather than a silent last-write-wins. */
  const claimed = new Set<string>();
  const staged: { line: number; item: Item; action: 'create' | 'update'; duplicate: boolean }[] = [];

  for (const { row, line } of body) {
    const cell = (target: string) => {
      const at = columns.find((c) => c.target === target);
      return at ? (row[at.index] ?? '').trim() : undefined;
    };
    const rawId = cell(IMPORT_ID) || '';
    const existing = rawId ? byId.get(rawId) : undefined;
    const duplicate = !!existing && claimed.has(rawId);
    if (existing) claimed.add(rawId);

    /* An unmatched ID column creates rather than fails: the roadmap treats a CSV from
       elsewhere, with its own identifiers, as a legitimate source of new entries. */
    const item: Item = existing ? clone(existing) : { id: opts.uid(), slug: '', values: {} };
    const action: 'create' | 'update' = existing ? 'update' : 'create';

    for (const { target, index } of columns) {
      if (RESERVED.includes(target)) continue;
      item.values[target] = (row[index] ?? '').trim();
    }
    const draft = cell(IMPORT_DRAFT);
    if (draft !== undefined && draft !== '') {
      if (cmsBoolean(draft)) item.draft = 1;
      else delete item.draft;
    }
    const slug = cell(IMPORT_SLUG);
    if (slug) { item.slug = opts.slugify(slug); item.slugLocked = 1; }
    else if (!item.slug)
      item.slug = opts.slugify(titleField ? item.values[titleField.id] || '' : '');

    staged.push({ line, item, action, duplicate });
    const at = col.items.findIndex((i) => i.id === item.id);
    if (at < 0) col.items.push(item);
    else col.items[at] = item;
  }

  const finished = { ...doc, meta: { ...doc.meta, collections } } as Doc;
  for (const entry of staged) {
    const errors = validateCmsEntry(finished, col, entry.item, assets);
    if (entry.duplicate) errors[IMPORT_ID] = 'Another row already updates this entry.';
    plan.rows.push({
      line: entry.line,
      action: entry.action,
      id: entry.item.id,
      title: String((titleField && entry.item.values[titleField.id]) || '').trim() || 'Untitled',
      slug: entry.item.slug,
      errors,
    });
    if (Object.keys(errors).length) plan.invalid++;
    else if (entry.action === 'create') plan.creates++;
    else plan.updates++;
  }
  if (!plan.invalid) plan.collections = collections;
  return plan;
}
