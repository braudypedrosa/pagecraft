// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { L } from '../app/src/ui/ctx';
import { CmsWorkspace } from '../app/src/ui/CmsWorkspace';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => {
  r = rig();
  C.state.meta.collections = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;
});
afterEach(() => {
  window.__pcFeedback?.destroy();
  render(null, r.host);
  r.host.remove();
  vi.restoreAllMocks();
});

const click = async (element: Element) => {
  await act(async () => { r.click(element); });
};

test('saving field deletion resets Collection List sort and filter in the same undoable change', async () => {
  const collection = C.collectionAdd('Journal');
  const category = C.fieldAdd(collection.id, 'Category', 'text')!;
  const rank = C.fieldAdd(collection.id, 'Rank', 'number')!;
  const list = C.insert('list', null, 0)!;
  list.src = collection.id;
  list.props.sort = rank.id;
  list.props.where = category.id;
  list.props.op = 'has';
  list.props.val = 'News';
  C.hist.u.length = 0;

  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  r.draw(<CmsWorkspace collectionId={collection.id} close={() => {}} />);
  await click(r.$$('button').find(button => button.textContent === 'Edit collection')!);
  await click(r.$(`[aria-label="Delete field ${category.name}"]`)!);
  expect(String(confirm.mock.calls[0]?.[1])).toContain('Collection List filter will reset to show every item');
  await click(r.$(`[aria-label="Delete field ${rank.name}"]`)!);
  await act(async () => {
    r.$('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await vi.waitFor(() => expect(C.findCollection(collection.id)?.fields.map(field => field.id))
    .toEqual(['title']));
  expect(list.props.sort).toBe('');
  expect(list.props.where).toBe('');
  expect(list.props.op).toBe('is');
  expect(list.props.val).toBeUndefined();
  expect(C.hist.u).toHaveLength(1);

  C.undo();
  const restored = C.findCollection(collection.id)!;
  expect(restored.fields.map(field => field.id)).toEqual(['title', category.id, rank.id]);
  const restoredList = C.locateAny(list.id)!.node;
  expect(restoredList.props.sort).toBe(rank.id);
  expect(restoredList.props.where).toBe(category.id);
  expect(restoredList.props.op).toBe('has');
  expect(restoredList.props.val).toBe('News');

  C.redo();
  const redoneList = C.locateAny(list.id)!.node;
  expect(redoneList.props.sort).toBe('');
  expect(redoneList.props.where).toBe('');
});

test('field deletion warning ignores a same-id binding owned by another collection', async () => {
  const journal = C.collectionAdd('Journal');
  const journalCategory = C.fieldAdd(journal.id, 'Category', 'text')!;
  const journalList = C.N('list', {}, {}, [C.N('heading', { text: 'Journal category' })]);
  journalList.src = journal.id;
  C.bindSet(journalList.children[0], 'text', C.bindField(journalCategory.id));

  const modules = C.collectionAdd('QA Modules');
  const moduleCategory = C.fieldAdd(modules.id, 'Category', 'image')!;
  expect(moduleCategory.id).toBe(journalCategory.id);
  const moduleList = C.N('list', {}, {}, [C.N('image', { src: '', alt: 'Module image' })]);
  moduleList.src = modules.id;
  C.bindSet(moduleList.children[0], 'src', C.bindField(moduleCategory.id));
  C.state.pages[0].tree = [journalList, moduleList];

  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  r.draw(<CmsWorkspace collectionId={journal.id} close={() => {}} />);
  await click(r.$$('button').find(button => button.textContent === 'Edit collection')!);
  await click(r.$(`[aria-label="Delete field ${journalCategory.name}"]`)!);

  const warning = String(confirm.mock.calls[0]?.[1]);
  expect(warning).toContain('Journal category');
  expect(warning).not.toContain('Module image');
  await act(async () => {
    r.$('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await vi.waitFor(() => expect(C.findCollection(journal.id)?.fields.map(field => field.id))
    .toEqual(['title']));
  expect(C.bindGet(moduleList.children[0], 'src')).toEqual(C.bindField(moduleCategory.id));
});

test('the persisted document clone is reconciled without mutating the live draft', () => {
  const collection = C.collectionAdd('Journal');
  const category = C.fieldAdd(collection.id, 'Category', 'text')!;
  const list = C.insert('list', null, 0)!;
  list.src = collection.id;
  list.props.where = category.id;
  list.props.op = 'has';
  list.props.val = 'News';

  const saved = C.clone(C.doc());
  const nextCollections = C.clone(C.collections());
  nextCollections[0].fields = nextCollections[0].fields.filter(field => field.id !== category.id);
  C.collectionsReplace(saved, nextCollections);

  const savedList = (() => {
    let found: any = null;
    C.eachNode(saved.pages[0].tree, node => { if (node.id === list.id) found = node; });
    return found!;
  })();
  expect(savedList.props.where).toBe('');
  expect(savedList.props.op).toBe('is');
  expect(savedList.props.val).toBeUndefined();
  expect(list.props.where).toBe(category.id);
});
