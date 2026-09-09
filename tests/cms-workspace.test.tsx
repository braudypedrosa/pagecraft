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
  render(null, r.host);
  r.host.remove();
  vi.restoreAllMocks();
});
const button = (text: string) =>
  r.$$('button').find((b) => b.textContent === text)!;
const click = async (text: string) => {
  await act(async () => {
    r.click(button(text));
  });
};
const start = () => {
  const col = C.collectionAdd('Cabins');
  r.draw(<CmsWorkspace collectionId={col.id} close={() => {}} />);
  return col;
};
test('entry edits stay local; successful save is one undo step and remains a draft', async () => {
  const col = start();
  await click('New entry');
  await act(() => r.type(r.$('#cms-value-title')!, 'Forest cabin'));
  expect(col.items).toHaveLength(0);
  const undo = C.hist.u.length;
  await act(async () => {
    r.$('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  const saved = C.collections()[0].items[0];
  expect(saved.values.title).toBe('Forest cabin');
  expect(saved.draft).toBe(1);
  expect(saved.slug).toBe('forest-cabin');
  expect(C.hist.u.length).toBe(undo + 1);
  await act(() => r.type(r.$('#cms-value-title')!, 'New name'));
  await act(async () => {
    r.$('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  expect(C.collections()[0].items[0].slug).toBe('forest-cabin');
});
test('failed persistence retains the form and does not mutate the document', async () => {
  const col = start();
  L.cmsCommit = async () => {
    throw new Error('Connection lost');
  };
  await click('New entry');
  await act(() => r.type(r.$('#cms-value-title')!, 'Keep this'));
  await act(async () => {
    r.$('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  expect(col.items).toHaveLength(0);
  expect((r.$('#cms-value-title') as HTMLInputElement).value).toBe('Keep this');
  expect(r.$('[role="alert"]')?.textContent).toContain('Connection lost');
});
test('200 entries paginate and search without mounting all entries', async () => {
  const col = C.collectionAdd('Cabins');
  for (let n = 0; n < 200; n++)
    col.items.push({
      id: 'i' + n,
      slug: 'cabin-' + n,
      values: { title: 'Cabin ' + n },
    });
  r.draw(<CmsWorkspace collectionId={col.id} close={() => {}} />);
  expect(r.$$('.cms-entry-row')).toHaveLength(25);
  await click('Next');
  expect(r.$('.cms-entry-open')?.textContent).toContain('Cabin 25');
  await act(() => r.type(r.$('input[type="search"]')!, 'Cabin 199'));
  expect(r.$$('.cms-entry-row')).toHaveLength(1);
});
test('content role sees entry management, not schema or design actions', () => {
  L.canStructure = () => false;
  start();
  expect(button('New entry')).toBeTruthy();
  expect(button('Settings')).toBeUndefined();
  expect(button('Add collection grid')).toBeUndefined();
});
test('cancel warns and does not add an entry', async () => {
  const col = start();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await click('New entry');
  await act(() => r.type(r.$('#cms-value-title')!, 'Unsaved'));
  await click('Cancel');
  expect(window.confirm).toHaveBeenCalled();
  expect(col.items).toHaveLength(0);
});
