import { beforeEach, expect, test, vi } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;
  vi.restoreAllMocks();
});

test('edit infers add, remove, and move actions without changing snapshot arrays', () => {
  let heading!: ReturnType<typeof C.N>;
  C.edit(() => { heading = C.insert('heading', null, 0)!; });
  expect(C.historyLabel('undo')).toBe('Add heading');
  expect(C.hist.u[0]).toHaveProperty('pages');
  expect(Object.keys(C.hist.u[0])).toEqual(expect.arrayContaining(['schemaVersion', 'meta', 'header', 'footer', 'pages']));

  C.edit(() => C.delNode(heading.id));
  expect(C.historyLabel('undo')).toBe('Remove heading');

  const first = C.N('column', {}, {}, [C.N('heading')]);
  const second = C.N('column');
  C.state.pages[0].tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [first, second])])];
  C.hist.u.length = 0;
  C.edit(() => C.moveNode(first.children[0].id, second, 0));
  expect(C.historyLabel('undo')).toBe('Move heading');
});

test('CSS and content inference names fields but never includes saved values', () => {
  const heading = C.insert('heading', null, 0)!;
  C.hist.u.length = 0;
  C.edit(() => { heading.css.d['font-size'] = '73px'; });
  expect(C.historyLabel('undo')).toBe('Change heading size');
  expect(C.historyLabel('undo')).not.toContain('73px');

  C.edit(() => { heading.props.text = 'Private launch headline'; });
  expect(C.historyLabel('undo')).toBe('Change heading text');
  expect(C.historyLabel('undo')).not.toContain('Private launch headline');
});

test('explicit labels survive undo and redo and produce useful notes', () => {
  const note = vi.spyOn(C.HOOKS, 'note');
  C.edit(() => { C.state.meta.name = 'Private project'; }, 'Apply approved project settings');
  expect(C.historyLabel('undo')).toBe('Apply approved project settings');
  C.undo();
  expect(note).toHaveBeenLastCalledWith('Undo: Apply approved project settings');
  expect(C.historyLabel('redo')).toBe('Apply approved project settings');
  C.redo();
  expect(note).toHaveBeenLastCalledWith('Redo: Apply approved project settings');
  expect(C.historyLabel('undo')).toBe('Apply approved project settings');
});

test('checkpoint labels a later transaction and clears redo like edit', () => {
  const heading = C.insert('heading', null, 0)!;
  C.hist.u.length = 0;
  C.checkpoint('Resize heading');
  heading.css.m['font-size'] = '24px';
  expect(C.historyLabel('undo')).toBe('Resize heading');
  C.undo();
  expect(C.locate(heading.id)!.node.css.m['font-size']).toBeUndefined();

  expect(C.hist.r.length).toBe(1);
  C.checkpoint();
  expect(C.hist.r.length).toBe(0);
});

test('manual snapshot pushes infer pending mutations and fallback safely', () => {
  const heading = C.insert('heading', null, 0)!;
  C.hist.u.length = 0;
  C.hist.u.push(C.clone(C.doc()));
  heading.css.t['padding-top'] = '18px';
  expect(C.historyLabel('undo')).toBe('Change heading spacing');

  C.hist.u.length = 0;
  C.hist.u.push(C.clone(C.doc()));
  expect(C.historyLabel('undo')).toBe('Edit page');
  expect(C.historyLabel('redo')).toBe('Redo');
});

test('page and project changes receive generic labels without exposing names', () => {
  C.edit(() => { C.page().name = 'Confidential launch'; });
  expect(C.historyLabel('undo')).toBe('Rename page');
  expect(C.historyLabel('undo')).not.toContain('Confidential launch');

  C.edit(() => { C.state.meta.name = 'Private client'; });
  expect(C.historyLabel('undo')).toBe('Rename project');
  expect(C.historyLabel('undo')).not.toContain('Private client');
});

test('history still caps undo at 80 and new edits clear redo', () => {
  for (let i = 0; i < 85; i++) C.edit(() => { C.state.meta.size = `${i}px`; });
  expect(C.hist.u).toHaveLength(80);
  C.undo();
  expect(C.hist.r).toHaveLength(1);
  C.edit(() => { C.state.meta.lang = 'mi'; });
  expect(C.hist.r).toHaveLength(0);
});
