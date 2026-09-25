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
const picks = () => r.$$('.cms-entry-pick') as HTMLInputElement[];
const check = async (el: HTMLInputElement, on = true) => {
  await act(async () => {
    el.checked = on;
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
};
const bar = () => r.$('.cms-bulk')?.textContent || '';

/* Three entries: two included on the next publish, one already held back. */
function start() {
  const col = C.collectionAdd('Cabins');
  const made = ['Forest cabin', 'Lake cabin', 'Ridge cabin'].map((title) => {
    const item = C.itemAdd(col.id)!;
    C.itemSet(col.id, item.id, 'title', title);
    C.itemSetSlug(col.id, item.id, C.slugify(title));
    return item;
  });
  C.itemDraft(col.id, made[2].id, true);
  r.draw(<CmsWorkspace collectionId={col.id} close={() => {}} />);
  return { col, made };
}

test('holding a selection back is one undo step for every entry it changes', async () => {
  const { col, made } = start();
  await check(picks()[0]);
  await check(picks()[1]);
  expect(bar()).toContain('2 selected');

  const undo = C.hist.u.length;
  await click('Hold back as draft');

  const items = C.collections()[0].items;
  expect(items.find((i) => i.id === made[0].id)!.draft).toBe(1);
  expect(items.find((i) => i.id === made[1].id)!.draft).toBe(1);
  expect(C.hist.u.length).toBe(undo + 1);

  await act(async () => {
    C.undo();
  });
  const restored = C.findCollection(col.id)!.items;
  expect(restored.find((i) => i.id === made[0].id)!.draft).toBeUndefined();
  expect(restored.find((i) => i.id === made[1].id)!.draft).toBeUndefined();
});

test('including a selection clears the draft flag and the selection', async () => {
  const { made } = start();
  await check(picks()[2]);
  await click('Include on next publish');

  expect(C.collections()[0].items.find((i) => i.id === made[2].id)!.draft).toBeUndefined();
  await vi.waitFor(() => expect(r.$('.cms-bulk')?.textContent).toContain('Select all 3'));
});

test('a selection already in the wanted state writes nothing', async () => {
  start();
  await check(picks()[2]);
  const undo = C.hist.u.length;
  await click('Hold back as draft');

  // A no-op selection must not create a document version.
  expect(C.hist.u.length).toBe(undo);
  await vi.waitFor(() =>
    expect(r.$('.cms-notice')?.textContent).toContain('already held back'),
  );
});

test('a mixed selection changes only the entries that need it', async () => {
  const { made } = start();
  await check(picks()[1]);
  await check(picks()[2]);
  const undo = C.hist.u.length;
  await click('Hold back as draft');

  const items = C.collections()[0].items;
  expect(items.find((i) => i.id === made[1].id)!.draft).toBe(1);
  expect(items.find((i) => i.id === made[2].id)!.draft).toBe(1);
  // Two entries changed, still a single step.
  expect(C.hist.u.length).toBe(undo + 1);
});

test('two ticks inside one paint both survive', async () => {
  start();
  /* No act() between the events on purpose: both handlers run against the same
     render, which is what a fast double click does. */
  await act(async () => {
    for (const box of picks().slice(0, 2)) {
      box.checked = true;
      box.dispatchEvent(new window.Event('change', { bubbles: true }));
    }
  });
  expect(bar()).toContain('2 selected');
});

test('select all covers the filtered rows, not the whole collection', async () => {
  start();
  await act(() => r.type(r.$('input[type="search"]')!, 'lake'));
  expect(picks()).toHaveLength(1);

  await check(r.$('.cms-bulk input[type="checkbox"]') as HTMLInputElement);
  expect(bar()).toContain('1 selected');

  await act(() => r.type(r.$('input[type="search"]')!, ''));
  expect(bar()).toContain('1 selected');
  expect(picks().filter((p) => p.checked)).toHaveLength(1);
});

test('clearing the selection hides the actions without touching entries', async () => {
  const { col } = start();
  await check(picks()[0]);
  const undo = C.hist.u.length;
  await click('Clear selection');

  expect(bar()).toContain('Select all 3');
  expect(button('Hold back as draft')).toBeUndefined();
  expect(C.hist.u.length).toBe(undo);
  expect(C.findCollection(col.id)!.items.filter((i) => i.draft)).toHaveLength(1);
});
