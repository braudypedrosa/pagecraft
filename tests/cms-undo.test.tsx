// @vitest-environment jsdom
/* Undo and Redo while the CMS workspace is open.

   The workspace stops every key from reaching the hidden canvas, and used to close itself on
   any top-bar click, so Cmd+Z did nothing and the Undo button took you back to the builder.
   Both now step the document's history from inside the workspace and show the result. */
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { CmsWorkspace } from '../app/src/ui/CmsWorkspace';
import { rig, type Rig } from './ui.setup';

let r: Rig;
let topbar: HTMLElement;
beforeEach(() => {
  r = rig();
  C.state.meta.collections = [];
  C.hist.u.length = 0; C.hist.r.length = 0;
  topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML = '<button id="undoBtn">Undo</button><button id="redoBtn">Redo</button><button id="other">Preview</button>';
  document.body.appendChild(topbar);
  topbar.querySelector('#undoBtn')!.addEventListener('click', () => C.undo());
  topbar.querySelector('#redoBtn')!.addEventListener('click', () => C.redo());
});
afterEach(() => {
  window.__pcFeedback?.destroy();
  render(null, r.host);
  r.host.remove();
  topbar.remove();
  vi.restoreAllMocks();
});

const button = (text: string) => r.$$('button').find((b) => b.textContent === text);
const click = async (el: Element) => { await act(async () => { r.click(el); }); };
const picks = () => r.$$('.cms-entry-pick') as HTMLInputElement[];
const check = async (el: HTMLInputElement) => {
  await act(async () => {
    el.checked = true;
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
};
const key = async (target: Element, k: string, extra: KeyboardEventInit = {}) => {
  await act(async () => {
    target.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, metaKey: true, bubbles: true, ...extra }));
  });
};
const drafts = (colId: string) => C.findCollection(colId)!.items.filter((i) => i.draft).length;
const shownDrafts = () => r.$$('.cms-entry-row > span').filter((status) => status.textContent?.trim() === 'Draft').length;

let closed = 0;
function start() {
  closed = 0;
  const col = C.collectionAdd('Cabins');
  ['Forest cabin', 'Lake cabin', 'Ridge cabin'].forEach((title) => {
    const item = C.itemAdd(col.id)!;
    C.itemSet(col.id, item.id, 'title', title);
    C.itemSetSlug(col.id, item.id, C.slugify(title));
  });
  C.hist.u.length = 0;
  r.draw(<CmsWorkspace collectionId={col.id} close={() => { closed++; }} />);
  return col;
}
async function holdBackTwo(colId: string) {
  await check(picks()[0]);
  await check(picks()[1]);
  await click(button('Hold back as draft')!);
  await new Promise(res => setTimeout(res, 300));
  await vi.waitFor(() => expect(drafts(colId)).toBe(2));
  await vi.waitFor(() => expect(shownDrafts()).toBe(2));
}

test('Cmd+Z in the workspace undoes the last change and the list shows it', async () => {
  const col = start();
  await holdBackTwo(col.id);
  const root = r.$('.cms-workspace')!;
  await key(root, 'z');
  expect(drafts(col.id)).toBe(0);
  await vi.waitFor(() => expect(shownDrafts()).toBe(0));
  // Redo, both spellings.
  await key(root, 'z', { shiftKey: true });
  expect(drafts(col.id)).toBe(2);
  await key(root, 'z');
  await key(root, 'y', { metaKey: false, ctrlKey: true });
  expect(drafts(col.id)).toBe(2);
  await vi.waitFor(() => expect(shownDrafts()).toBe(2));
  expect(closed).toBe(0);
});

test('Cmd+Z inside a text field is left to the field', async () => {
  const col = start();
  await holdBackTwo(col.id);
  await key(r.$('input[type="search"]')!, 'z');
  expect(drafts(col.id)).toBe(2);
});

test('the top-bar Undo works from the workspace instead of closing it', async () => {
  const col = start();
  await holdBackTwo(col.id);
  await click(topbar.querySelector('#undoBtn')!);
  expect(closed).toBe(0);
  expect(drafts(col.id)).toBe(0);
  // The real app repaints through the CMS painter; the test redraws the same way.
  r.draw(<CmsWorkspace collectionId={col.id} close={() => { closed++; }} />);
  await vi.waitFor(() => expect(shownDrafts()).toBe(0));
  // Any other top-bar button still leaves the workspace, as before.
  await click(topbar.querySelector('#other')!);
  expect(closed).toBe(1);
});

test('an unsaved entry is never undone underneath you', async () => {
  const col = start();
  await holdBackTwo(col.id);
  await click(button('New entry')!);
  const title = r.$('form input') as HTMLInputElement;
  await act(async () => { r.type(title, 'Half-typed cabin'); });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await key(r.$('.cms-workspace')!, 'z');
  expect(confirm).toHaveBeenCalled();
  expect(drafts(col.id)).toBe(2);
  expect((r.$('form input') as HTMLInputElement).value).toBe('Half-typed cabin');
  // Choosing to discard closes the form and then undoes.
  confirm.mockReturnValue(true);
  await key(r.$('.cms-workspace')!, 'z');
  expect(drafts(col.id)).toBe(0);
  await vi.waitFor(() => expect(r.$('form input')).toBeNull());
});

test('undoing the open collection away moves to another one, or closes', async () => {
  const keep = C.collectionAdd('Keep');
  const col = C.collectionAdd('Temporary');
  r.draw(<CmsWorkspace collectionId={col.id} close={() => { closed++; }} />);
  closed = 0;
  await act(async () => { C.state.meta.collections = C.state.meta.collections!.filter((c) => c.id !== col.id); });
  r.draw(<CmsWorkspace collectionId={col.id} close={() => { closed++; }} />);
  await vi.waitFor(() => expect(r.$('.cms-title')?.textContent).toContain('Keep'));
  expect(closed).toBe(0);

  await act(async () => { C.state.meta.collections = []; });
  r.draw(<CmsWorkspace collectionId={keep.id} close={() => { closed++; }} />);
  await vi.waitFor(() => expect(closed).toBe(1));
});
