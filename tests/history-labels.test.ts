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

test('collection deletion outranks atomic list, page, and reference cleanup', () => {
  const removed = C.collectionAdd('Articles');
  const summary = C.fieldAdd(removed.id, 'Summary', 'text')!;
  const article = C.itemAdd(removed.id)!;
  const related = C.collectionAdd('Authors');
  const favourite = C.fieldAdd(related.id, 'Favourite article', 'ref')!;
  favourite.ref = removed.id;
  const author = C.itemAdd(related.id)!;
  C.itemSet(related.id, author.id, favourite.id, article.id);
  const list = C.insert('list', null, 0)!;
  list.src = removed.id; list.props.sort = summary.id; list.props.where = summary.id;
  const detail = C.clone(C.page()); detail.id = 'article-detail'; detail.collection = removed.id; detail.bindTitle = 'title'; detail.bindDesc = summary.id; C.state.pages.push(detail);
  C.hist.u.length = 0;

  C.edit(() => C.collectionDelete(removed.id));
  expect(C.historyLabel('undo')).toBe('Delete collection');
  C.undo();
  expect(C.historyLabel('redo')).toBe('Delete collection');
});

test('collection schema and content changes outrank their binding cleanup', () => {
  const collection = C.collectionAdd('Journal');
  const category = C.fieldAdd(collection.id, 'Category', 'text')!;
  const item = C.itemAdd(collection.id)!;
  C.itemSet(collection.id, item.id, category.id, 'Update');
  const list = C.insert('list', null, 0)!; list.src = collection.id; list.props.sort = category.id;
  C.hist.u.length = 0;

  C.edit(() => C.fieldDelete(collection.id, category.id));
  expect(C.historyLabel('undo')).toBe('Delete collection field');
  C.edit(() => C.itemSet(collection.id, item.id, 'title', 'Changed privately'));
  expect(C.historyLabel('undo')).toBe('Change collection content');
  expect(C.historyLabel('undo')).not.toContain('Changed privately');
});

test('saving a real block outranks duplicate definition node ids and keeps its name private', () => {
  const button = C.insert('button', null, 0)!;
  button.props.text = 'Private proposal action';
  C.hist.u.length = 0;

  C.edit(() => C.blockSave(button.id, 'Private proposal block'));
  expect(C.historyLabel('undo')).toBe('Save block');
  expect(C.historyLabel('undo')).not.toContain('Private proposal');
  C.undo();
  expect(C.historyLabel('redo')).toBe('Save block');
});

test('creating a real component outranks its new definition leaves and instance rewrite', () => {
  const section = C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [C.N('button', { text: 'Private component action' })])])]);
  C.state.pages[0].tree = [section];
  C.hist.u.length = 0;

  C.edit(() => C.componentFromNode(section.id, 'Private proposal component'));
  expect(C.historyLabel('undo')).toBe('Create component');
  expect(C.historyLabel('undo')).not.toContain('Private proposal');
  C.undo();
  expect(C.historyLabel('redo')).toBe('Create component');
});

test('reusable asset deletion and rename keep structural labels ahead of tree changes', () => {
  const heading = C.insert('heading', null, 0)!;
  const blockId = C.blockSave(heading.id, 'Private block')!;
  const componentId = C.componentFromNode(heading.id, 'Private component')!;
  C.hist.u.length = 0;
  C.edit(() => C.blockDelete(blockId));
  expect(C.historyLabel('undo')).toBe('Delete block');
  C.edit(() => C.componentDelete(componentId));
  expect(C.historyLabel('undo')).toBe('Delete component');

  const replacementId = C.componentFromNode(heading.id, 'Original private name')!;
  C.hist.u.length = 0;
  C.edit(() => C.componentRename(replacementId, 'Renamed private component'));
  expect(C.historyLabel('undo')).toBe('Rename component');
  expect(C.historyLabel('undo')).not.toContain('private');
});

test('history still caps undo at 80 and new edits clear redo', () => {
  for (let i = 0; i < 85; i++) C.edit(() => { C.state.meta.size = `${i}px`; });
  expect(C.hist.u).toHaveLength(80);
  C.undo();
  expect(C.hist.r).toHaveLength(1);
  C.edit(() => { C.state.meta.lang = 'mi'; });
  expect(C.hist.r).toHaveLength(0);
});


test('Button variant intent names the chosen control instead of internal surface markers', () => {
  const button = C.insert('button', null, 0)!;
  button.css.d['background-color'] = '#b55637';
  button.css.d['border-width'] = '0';
  C.hist.u.length = 0;
  C.edit(() => C.applyC(button, { k: 'variant' }, 'outline'));
  expect(button.css.d['--pc-button-variant-owns-border-width']).toBe('1');
  expect(C.historyLabel('undo')).toBe('Change button variant');
  C.undo();
  expect(C.historyLabel('redo')).toBe('Change button variant');
  C.redo();
  expect(C.historyLabel('undo')).toBe('Change button variant');

  C.edit(() => C.setCss(C.locate(button.id)!.node, 'width', '240px'));
  expect(C.historyLabel('undo')).toBe('Change button size');
});
