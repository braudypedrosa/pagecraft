import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => {
  C.blankProject('Workshop navigation checks');
  C.state.ui = C.initUi();
});

function fixture() {
  const first = C.N('heading', { text: 'Workshop one' });
  const second = C.N('heading', { text: 'Workshop two' });
  const column = C.N('column', {}, {}, [first, second]);
  const row = C.N('row', {}, {}, [column]);
  const section = C.N('section', {}, {}, [row]);
  const nextHeading = C.N('heading', { text: 'Next workshop' });
  const next = C.N('section', {}, {}, [nextHeading]);
  C.state.pages[0].tree = [section, next];
  return { first, second, column, row, section, nextHeading, next };
}

test('Up and Down skip the descendants of a collapsed Column in both directions', () => {
  const f = fixture();
  C.state.ui.collapsed[f.column.id] = true;

  expect(C.step(f.column.id, 1)).toBe(f.next.id);
  expect(C.step(f.next.id, -1)).toBe(f.column.id);
  expect(C.step(f.row.id, 1)).toBe(f.column.id);
  expect(C.step(f.column.id, -1)).toBe(f.row.id);
});

test('collapsed ancestors hide the whole subtree and expanded order remains available', () => {
  const f = fixture();
  C.state.ui.collapsed[f.section.id] = true;
  C.state.ui.collapsed[f.column.id] = true;
  expect(C.step(f.section.id, 1)).toBe(f.next.id);
  expect(C.step(f.next.id, -1)).toBe(f.section.id);

  delete C.state.ui.collapsed[f.section.id];
  expect(C.step(f.section.id, 1)).toBe(f.row.id);
  expect(C.step(f.column.id, 1)).toBe(f.next.id);
  delete C.state.ui.collapsed[f.column.id];
  expect(C.step(f.column.id, 1)).toBe(f.first.id);
  expect(C.step(f.second.id, 1)).toBe(f.next.id);
});

test('visible traversal preserves start, end, empty and missing-selection behavior', () => {
  const f = fixture();
  C.state.ui.collapsed[f.next.id] = true;
  expect(C.step(null, 1)).toBe(f.section.id);
  expect(C.step(null, -1)).toBe(f.section.id);
  expect(C.step('missing-entry', 1)).toBe(f.section.id);
  expect(C.step(f.section.id, -1)).toBe(f.section.id);
  expect(C.step(f.next.id, 1)).toBe(f.next.id);
  C.state.pages[0].tree = [];
  expect(C.step(null, 1)).toBeNull();
  expect(C.step('missing-entry', -1)).toBeNull();
});

test('visible traversal leaves the document, collapsed state and depth helpers unchanged', () => {
  const f = fixture();
  C.state.ui.collapsed[f.column.id] = true;
  const documentBefore = JSON.stringify(C.doc());
  const collapsedBefore = { ...C.state.ui.collapsed };
  const allIds = [f.section, f.row, f.column, f.first, f.second, f.next, f.nextHeading].map(n => n.id);

  expect(C.step(f.column.id, 1)).toBe(f.next.id);
  expect(C.step(f.next.id, -1)).toBe(f.column.id);
  expect(C.flatten(C.tree()).map(n => n.id)).toEqual(allIds);
  expect(C.parentOf(f.first.id)).toBe(f.column.id);
  expect(C.firstChildOf(f.column.id)).toBe(f.first.id);
  expect(JSON.stringify(C.doc())).toBe(documentBefore);
  expect(C.state.ui.collapsed).toEqual(collapsedBefore);
});
