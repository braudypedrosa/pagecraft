// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
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
});
afterEach(() => {
  window.__pcFeedback?.destroy();
  render(null, r.host);
  r.host.remove();
  vi.restoreAllMocks();
});

const button = (text: string) => r.$$('button').find((b) => b.textContent === text);
const click = async (text: string) => {
  await act(async () => {
    r.click(button(text)!);
  });
};
const search = () => r.$('input[type="search"]') as HTMLInputElement;
const picker = () => r.$$('select').find((s) => s.previousSibling?.textContent === 'View') as HTMLSelectElement;
const statusSelect = () => r.$$('select')[0] as HTMLSelectElement;

/* Saving commits through the shared action-feedback runner, so the document write
   and the repaint land after the click resolves. */
const savedViews = (col: { id: string }) => C.findCollection(col.id)?.views || [];
const saveViewAs = async (col: { id: string }, name: string) => {
  const before = savedViews(col).length;
  L.askText = async () => name;
  await click('Save this view');
  await vi.waitFor(() => expect(savedViews(col)).toHaveLength(before + 1));
};

function start() {
  const col = C.collectionAdd('Cabins');
  for (const title of ['Forest cabin', 'Lake cabin']) {
    const item = C.itemAdd(col.id)!;
    C.itemSet(col.id, item.id, 'title', title);
    C.itemSetSlug(col.id, item.id, C.slugify(title));
  }
  r.draw(<CmsWorkspace collectionId={col.id} close={() => {}} />);
  return col;
}

test('a saved view stores the search and status, not the entries', async () => {
  const col = start();
  await act(() => r.type(search(), 'lake'));
  await act(() => r.pick(statusSelect(), 'draft'));
  await saveViewAs(col, 'Drafts to finish');

  const saved = C.findCollection(col.id)!.views!;
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ name: 'Drafts to finish', search: 'lake', status: 'draft' });
  expect(Object.keys(saved[0])).not.toContain('items');
});

test('choosing a saved view restores its search and status', async () => {
  const col = start();
  await act(() => r.type(search(), 'lake'));
  await act(() => r.pick(statusSelect(), 'draft'));
  await saveViewAs(col, 'Lake drafts');

  await act(() => r.pick(picker(), ''));
  expect(search().value).toBe('');
  expect(statusSelect().value).toBe('all');

  const id = C.findCollection(col.id)!.views![0].id;
  await act(() => r.pick(picker(), id));
  expect(search().value).toBe('lake');
  expect(statusSelect().value).toBe('draft');
});

test('editing the search drops back to the unsaved default', async () => {
  const col = start();
  await act(() => r.type(search(), 'lake'));
  await saveViewAs(col, 'Lake');
  await vi.waitFor(() =>
    expect(picker().value).toBe(C.findCollection(col.id)!.views![0].id),
  );

  await act(() => r.type(search(), 'forest'));
  expect(picker().value).toBe('');
  expect(button('Delete view')).toBeUndefined();
});

test('deleting a view leaves the entries alone', async () => {
  const col = start();
  L.askConfirm = async () => true;
  await act(() => r.type(search(), 'lake'));
  await saveViewAs(col, 'Lake');
  await vi.waitFor(() => expect(button('Delete view')).toBeTruthy());
  await click('Delete view');
  await vi.waitFor(() => expect(savedViews(col)).toHaveLength(0));

  expect(C.findCollection(col.id)!.items).toHaveLength(2);
  // Deleting the view you are looking through returns you to the full list.
  await vi.waitFor(() => expect(search().value).toBe(''));
});

test('undoing a saved view drops the picker back to the default', async () => {
  const col = start();
  await act(() => r.type(search(), 'lake'));
  await saveViewAs(col, 'Lake');
  await vi.waitFor(() => expect(button('Delete view')).toBeTruthy());

  await act(async () => {
    C.undo();
    // The next paint, however it arrives; the workspace keeps its own state.
    r.draw(<CmsWorkspace collectionId={col.id} close={() => {}} />);
  });
  expect(savedViews(col)).toHaveLength(0);
  // The applied view no longer exists, so nothing may offer to delete it.
  expect(button('Delete view')).toBeUndefined();
  expect(picker().value).toBe('');
});

test('a cancelled name saves nothing', async () => {
  const col = start();
  L.askText = async () => '';
  const undo = C.hist.u.length;
  await click('Save this view');
  expect(C.findCollection(col.id)!.views).toBeUndefined();
  expect(C.hist.u.length).toBe(undo);
});

/* The whole reason views live in the document without a SCHEMA bump: a build that
   predates them must still open the document and carry them through a save. That
   build is this core minus any knowledge of `views`, so round-tripping an opaque
   key through migrate and an ordinary edit is the thing to pin. */
test('a build that does not know about views carries them through a save', () => {
  const col = C.collectionAdd('Cabins');
  C.itemAdd(col.id);
  (C.findCollection(col.id) as any).views = [{ id: 'v1', name: 'Kept', search: 'lake', status: 'draft' }];

  const written = JSON.parse(JSON.stringify({ ...C.doc(), schemaVersion: C.SCHEMA }));
  const reopened = C.migrate(written);
  expect(reopened).not.toBeNull();

  C.state.meta = reopened!.meta;
  C.edit(() => {
    const target = C.findCollection(col.id)!;
    target.items = [...target.items, { id: 'later', slug: 'later', values: {} }];
  });

  const resaved = JSON.parse(JSON.stringify(C.doc()));
  expect(resaved.meta.collections[0].views).toEqual([
    { id: 'v1', name: 'Kept', search: 'lake', status: 'draft' },
  ]);
});
