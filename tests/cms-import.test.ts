import { test, beforeEach } from 'vitest';
import a from 'node:assert/strict';
import * as C from '../app/src/core/index';
import {
  IMPORT_DRAFT, IMPORT_ID, IMPORT_SKIP, IMPORT_SLUG,
  blankRow, parseCsv, planImport, suggestMapping,
} from '../app/src/core/cms-import';

let seq = 0;
const opts = { uid: () => 'imported-' + ++seq, slugify: C.slugify };

beforeEach(() => {
  seq = 0;
  C.seed(); C.state.ui = C.initUi(); C.blankProject('CMS import QA');
  C.state.meta.collections = []; C.state.meta.components = [];
  C.hist.u.length = 0; C.hist.r.length = 0;
});

/* A collection with one of every shape the mapping step has to cope with. */
function fixture() {
  const col = C.collectionAdd('Projects')!;
  const title = C.titleField(col)!;
  const summary = C.fieldAdd(col.id, 'Summary', 'text')!;
  const year = C.fieldAdd(col.id, 'Year', 'number')!;
  const live = C.fieldAdd(col.id, 'Featured', 'bool')!;
  const one = C.itemAdd(col.id)!;
  C.itemSet(col.id, one.id, title.id, 'Harbour house');
  C.itemSetSlug(col.id, one.id, 'harbour-house');
  return { col: C.findCollection(col.id)!, title, summary, year, live, one };
}

const plan = (col: string, table: string[][], mapping: string[]) =>
  planImport(C.doc(), col, table, mapping, new Set<string>(), opts);

/* ---- parser ---------------------------------------------------------- */

test('parses quoted commas, newlines, escaped quotes, CRLF and a BOM', () => {
  const rows = parseCsv('﻿Title,Note\r\n"Hello, world","He said ""hi"""\r\n"Two\nlines",plain\r\n');
  a.deepEqual(rows, [
    ['Title', 'Note'],
    ['Hello, world', 'He said "hi"'],
    ['Two\nlines', 'plain'],
  ]);
});

test('keeps empty cells and does not invent a row for a trailing newline', () => {
  a.deepEqual(parseCsv('a,,b\n'), [['a', '', 'b']]);
  a.equal(parseCsv('a,b\nc,d').length, 2);
});

test('blankRow recognises an all-empty row', () => {
  a.equal(blankRow(['', '  ', '']), true);
  a.equal(blankRow(['', 'x']), false);
});

/* ---- mapping --------------------------------------------------------- */

test('suggests columns by field name and id, and never maps one target twice', () => {
  const { col, title, summary } = fixture();
  const guess = suggestMapping(['Entry ID', 'Title', 'summary', 'Title', 'Nothing'], col);
  a.equal(guess[0], IMPORT_ID);
  a.equal(guess[1], title.id);
  a.equal(guess[2], summary.id);
  a.equal(guess[3], IMPORT_SKIP, 'the second Title column has nothing left to claim');
  a.equal(guess[4], IMPORT_SKIP);
});

/* ---- planning -------------------------------------------------------- */

test('an unmatched ID creates and a matching ID updates', () => {
  const { col, title, one } = fixture();
  const result = plan(col.id, [
    ['id', 'title'],
    [one.id, 'Harbour house rebuilt'],
    ['from-another-system', 'Ridge studio'],
  ], [IMPORT_ID, title.id]);

  a.equal(result.problem, '');
  a.equal(result.updates, 1);
  a.equal(result.creates, 1);
  a.equal(result.invalid, 0);
  a.equal(result.rows[0].action, 'update');
  a.equal(result.rows[0].id, one.id);
  a.equal(result.rows[1].action, 'create');
  a.equal(result.rows[1].slug, 'ridge-studio', 'a new row takes its slug from the title');
  a.ok(result.collections, 'a clean plan is applicable');
});

test('blank rows are skipped rather than creating empty entries', () => {
  const { col, title } = fixture();
  const result = plan(col.id, [['title'], ['Ridge studio'], ['   '], ['']], [title.id]);
  a.equal(result.rows.length, 1);
  a.equal(result.creates, 1);
});

test('one invalid row blocks the entire import', () => {
  const { col, title, year } = fixture();
  const result = plan(col.id, [
    ['title', 'year'],
    ['Ridge studio', '1998'],
    ['Cliff house', 'not-a-number'],
  ], [title.id, year.id]);

  a.equal(result.invalid, 1);
  a.equal(result.creates, 1, 'the good row is still counted, so the preview can explain itself');
  a.equal(result.collections, null, 'nothing may be applied');
  a.ok(result.rows[1].errors[year.id]);
  a.equal(result.rows[0].errors[year.id], undefined);
});

test('a slug collision between two imported rows flags both of them', () => {
  const { col, title } = fixture();
  const result = plan(col.id, [
    ['title'],
    ['Ridge studio'],
    ['Ridge Studio'],
  ], [title.id]);
  /* Both lines are named, because either one is the one worth changing and the
     preview should not pick for the author. */
  a.equal(result.invalid, 2);
  a.equal(result.collections, null);
  a.ok(result.rows[0].errors._slug);
  a.ok(result.rows[1].errors._slug);
});

test('a row colliding with an existing entry slug is caught', () => {
  const { col, title } = fixture();
  const result = plan(col.id, [['title'], ['Harbour house']], [title.id]);
  a.equal(result.invalid, 1);
  a.ok(result.rows[0].errors._slug);
});

test('two rows updating the same entry is an error, not last-write-wins', () => {
  const { col, title, one } = fixture();
  const result = plan(col.id, [
    ['id', 'title'],
    [one.id, 'First'],
    [one.id, 'Second'],
  ], [IMPORT_ID, title.id]);
  a.equal(result.invalid, 1);
  a.ok(result.rows[1].errors[IMPORT_ID]);
  a.equal(result.collections, null);
});

test('a mapped slug column wins over the derived slug and locks it', () => {
  const { col, title } = fixture();
  const result = plan(col.id, [
    ['title', 'slug'],
    ['Ridge studio', 'The Ridge'],
  ], [title.id, IMPORT_SLUG]);
  a.equal(result.rows[0].slug, 'the-ridge');
  a.equal(result.collections![0].items.find((i) => i.slug === 'the-ridge')!.slugLocked, 1);
});

test('a draft column holds entries back, and an empty cell leaves the flag alone', () => {
  const { col, title, one } = fixture();
  C.itemDraft(col.id, one.id, true);
  const result = plan(C.findCollection(col.id)!.id, [
    ['id', 'title', 'draft'],
    [one.id, 'Harbour house', ''],
    ['', 'Ridge studio', 'yes'],
    ['', 'Cliff house', 'no'],
  ], [IMPORT_ID, title.id, IMPORT_DRAFT]);

  const items = result.collections!.find((c) => c.id === col.id)!.items;
  a.equal(items.find((i) => i.id === one.id)!.draft, 1, 'an empty cell is not an instruction');
  a.equal(items.find((i) => i.slug === 'ridge-studio')!.draft, 1);
  a.equal(items.find((i) => i.slug === 'cliff-house')!.draft, undefined);
});

test('a mapping with no field columns is refused', () => {
  const { col } = fixture();
  const result = plan(col.id, [['id'], ['x']], [IMPORT_ID]);
  a.match(result.problem, /at least one column/);
  a.equal(result.collections, null);
});

test('a file with only a header is refused', () => {
  const { col, title } = fixture();
  a.match(plan(col.id, [['title']], [title.id]).problem, /no data rows/);
});

test('a mapping pointing at a deleted field is refused', () => {
  const { col, title, summary } = fixture();
  C.fieldDelete(col.id, summary.id);
  const result = plan(col.id, [['title', 'summary'], ['Ridge studio', 'x']], [title.id, summary.id]);
  a.match(result.problem, /no longer exists/);
  a.equal(result.collections, null);
});

/* ---- applying -------------------------------------------------------- */

test('applying a plan is one history step for every row it touches', () => {
  const { col, title, one } = fixture();
  const result = plan(col.id, [
    ['id', 'title'],
    [one.id, 'Harbour house rebuilt'],
    ['', 'Ridge studio'],
    ['', 'Cliff house'],
  ], [IMPORT_ID, title.id]);

  const before = C.hist.u.length;
  C.edit(() => { C.state.meta.collections = result.collections!; });
  a.equal(C.hist.u.length, before + 1, 'three changed entries, one undo step');

  const after = C.findCollection(col.id)!;
  a.equal(after.items.length, 3);
  a.equal(after.items.find((i) => i.id === one.id)!.values[title.id], 'Harbour house rebuilt');

  C.undo();
  const restored = C.findCollection(col.id)!;
  a.equal(restored.items.length, 1, 'one Undo returns the whole import');
  a.equal(restored.items[0].values[title.id], 'Harbour house');
});

test('planning touches nothing until the caller commits', () => {
  const { col, title } = fixture();
  plan(col.id, [['title'], ['Ridge studio']], [title.id]);
  a.equal(C.findCollection(col.id)!.items.length, 1, 'the live document is untouched by a preview');
});
