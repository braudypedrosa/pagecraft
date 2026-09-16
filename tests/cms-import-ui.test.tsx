// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
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
const summary = () => r.$('.cms-import-summary')?.textContent || '';

function start(extra?: () => void) {
  const col = C.collectionAdd('Cabins');
  extra?.();
  r.draw(<CmsWorkspace collectionId={col.id} close={() => {}} />);
  return col;
}

/* The real control is a file input, so the test drives the same event the browser
   sends rather than calling the handler directly. */
const pick = async (text: string, name = 'cabins.csv') => {
  await click('Import CSV');
  const input = r.$('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    value: [new File([text], name, { type: 'text/csv' })],
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await vi.waitFor(() => expect(r.$('.cms-import-map')).toBeTruthy());
};

test('a picked file opens the mapping step with columns matched by header', async () => {
  start();
  await pick('Title,Slug\r\nForest cabin,forest\r\nLake cabin,lake\r\n');

  const selects = r.$$('.cms-import-map select') as HTMLSelectElement[];
  expect(selects).toHaveLength(2);
  expect(selects[0].value).toBe('title');
  expect(selects[1].value).toBe('_slug');
  expect(r.$('.cms-notice')?.textContent).toContain('cabins.csv');
  expect(summary()).toContain('2 to create');
  expect(summary()).toContain('0 to update');
});

test('importing applies every row as one undo step and leaves nothing pending', async () => {
  const col = start();
  await pick('Title\r\nForest cabin\r\nLake cabin\r\n');
  expect(col.items).toHaveLength(0);

  const undo = C.hist.u.length;
  await click('Import 2 entries');

  const saved = C.collections()[0].items;
  expect(saved).toHaveLength(2);
  expect(saved.map((i) => i.slug)).toEqual(['forest-cabin', 'lake-cabin']);
  expect(C.hist.u.length).toBe(undo + 1);
  /* The commit resolves through the shared action-feedback runner, so the return to
     the list is a later paint than the document write. */
  await vi.waitFor(() => expect(r.$('.cms-import-map')).toBeNull());

  await act(async () => {
    C.undo();
  });
  expect(C.collections()[0].items).toHaveLength(0);
});

test('a matching entry ID updates in place instead of creating a second entry', async () => {
  const col = start();
  const existing = C.itemAdd(col.id)!;
  C.itemSet(col.id, existing.id, 'title', 'Forest cabin');
  C.itemSetSlug(col.id, existing.id, 'forest-cabin');

  await pick(`Entry ID,Title\r\n${existing.id},Forest cabin renamed\r\n,Lake cabin\r\n`);
  expect(summary()).toContain('1 to create');
  expect(summary()).toContain('1 to update');

  await click('Import 2 entries');
  const saved = C.collections()[0].items;
  expect(saved).toHaveLength(2);
  expect(saved.find((i) => i.id === existing.id)!.values.title).toBe('Forest cabin renamed');
});

test('an invalid row blocks the import and names the line', async () => {
  const col = start(() => {});
  C.fieldAdd(col.id, 'Year', 'number');
  await pick('Title,Year\r\nForest cabin,1998\r\nLake cabin,not-a-year\r\n');

  expect(summary()).toContain('1 to fix first');
  const alert = r.$('[role="alert"]')!;
  expect(alert.textContent).toContain('Line 3');
  expect(alert.textContent).toContain('Year');
  expect(button('Import 1 entry')).toBeTruthy();
  expect((button('Import 1 entry') as HTMLButtonElement).disabled).toBe(true);

  await click('Import 1 entry');
  expect(C.collections()[0].items).toHaveLength(0);
});

test('unmapping the last field column refuses the import outright', async () => {
  start();
  await pick('Title\r\nForest cabin\r\n');
  await act(async () => {
    r.pick(r.$('.cms-import-map select')!, '');
  });
  expect(summary()).toContain('Map at least one column');
  expect((button('Import 0 entries') as HTMLButtonElement).disabled).toBe(true);
});

test('cancelling returns to the list without touching the document', async () => {
  const col = start();
  await pick('Title\r\nForest cabin\r\n');
  const undo = C.hist.u.length;
  await click('Cancel');

  expect(r.$('.cms-import-map')).toBeNull();
  expect(col.items).toHaveLength(0);
  expect(C.hist.u.length).toBe(undo);
  expect(button('Import CSV')).toBeTruthy();
});
