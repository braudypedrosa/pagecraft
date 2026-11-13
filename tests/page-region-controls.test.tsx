// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Pages } from '../app/src/ui/Pages';
import { Add } from '../app/src/ui/Add';
import { bindingImpact } from '../app/src/ui/CmsWorkspace';
import { L } from '../app/src/ui/ctx';
import { installCustomSelects } from '../shared/custom-select.js';
import { rig, type Rig } from './ui.setup';
let r: Rig | undefined;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const draw = () => act(() => r!.draw(() => <Pages />, 'pages'));
function setup(canStructure = true) {
  r = rig({ canStructure });
  C.state.header = [C.N('heading', { text: 'Workshop shared header' })];
  C.state.footer = [C.N('heading', { text: 'Workshop shared footer' })];
  installCustomSelects(); draw();
}
const select = (kind = 'header') => r!.$('#page-region-' + kind) as HTMLSelectElement;
const pick = async (mode: string, kind = 'header') => { await act(async () => { r!.pick(select(kind), mode); await settle(); }); };
const trigger = () => select().nextElementSibling as HTMLButtonElement;
afterEach(async () => {
  if (r) { act(() => r!.draw(null)); r.host.remove(); r = undefined; }
  await settle(); vi.restoreAllMocks(); document.body.replaceChildren();
});

test('native page settings customize and edit the page region, hide the footer, and Undo preserves ownership', async () => {
  setup();
  expect(select().value).toBe('shared');
  await pick('custom');
  expect(C.pageRegionMode(C.page(), 'header')).toBe('custom');
  expect(trigger().textContent).toContain('Customize for this page');
  expect(C.hist.u).toHaveLength(1);
  const edit = r!.$$('button').find(e => e.textContent === 'Edit page header')!;
  act(() => r!.click(edit));
  expect(C.tree()).toBe(C.page().header);
  expect(r!.arg('setMode')).toEqual(['header']);
  await pick('hidden', 'footer');
  expect(C.page().footer).toBeNull();
  expect(C.state.ui.mode).toBe('page');
  expect(C.hist.u).toHaveLength(2);
  C.undo(); draw();
  expect(C.page().footer).toBeUndefined();
  expect(C.pageRegionMode(C.page(), 'header')).toBe('custom');
});

test('cancelled destructive switches preserve the custom tree, select label and Undo depth', async () => {
  setup(); await pick('custom');
  const before = C.clone(C.doc()), depth = C.hist.u.length;
  vi.spyOn(L, 'askConfirm').mockResolvedValue(false);
  await pick('shared');
  expect(C.doc()).toEqual(before);
  expect(C.hist.u).toHaveLength(depth);
  expect(select().value).toBe('custom');
  expect(trigger().textContent).toContain('Customize for this page');
  await pick('hidden');
  expect(C.doc()).toEqual(before);
  expect(select().value).toBe('custom');
});

test('confirmed inheritance reset is one edit and Undo restores exact custom node identities', async () => {
  setup(); await pick('custom');
  const before = C.clone(C.doc());
  const depth = C.hist.u.length;
  await pick('shared');
  expect(C.page().header).toBeUndefined();
  expect(C.hist.u).toHaveLength(depth + 1);
  expect(r!.arg('askConfirm')![0]).toBe('Use the shared header?');
  C.undo(); draw(); expect(C.doc()).toEqual(before);
  C.redo(); draw(); expect(C.page().header).toBeUndefined();
});

test('an empty custom header remains editable and content accounts cannot change region ownership', async () => {
  setup(); C.state.header = []; draw();
  await pick('custom');
  expect(C.page().header).toEqual([]);
  expect(select().value).toBe('custom');
  expect(r!.$$('button').map(e => e.textContent)).toContain('Edit page header');
  act(() => r!.draw(null)); r!.host.remove();
  setup(false);
  expect(r!.$('#page-region-header')).toBeNull();
  expect(r!.$('#page-region-footer')).toBeNull();
});


test('header starter templates replace only the current custom region and can revive a hidden region with one Undo', async () => {
  setup();
  C.page().header = [];
  C.state.ui.atab = 'templates';
  act(() => r!.draw(() => <Add />, 'add'));
  const card = () => r!.$$('.pvcard').find(e => e.textContent?.includes('Logo and links'))!;
  await act(async () => { r!.click(card()); await settle(); });
  expect(C.page().header).toHaveLength(1);
  expect(C.page().header![0].props.tag).toBe('header');
  expect(C.state.header[0].props.text).toBe('Workshop shared header');
  expect(r!.calls.some(call => call[0] === 'toast' && String(call[1]).includes('now editing the page header'))).toBe(true);

  C.page().header = null; C.state.ui.mode = 'page'; C.hist.u.length = 0; draw();
  act(() => r!.draw(() => <Add />, 'add'));
  await act(async () => { r!.click(card()); await settle(); });
  expect(C.pageRegionMode(C.page(), 'header')).toBe('custom');
  expect(C.page().header).toHaveLength(1);
  expect(C.hist.u).toHaveLength(1);
  C.undo();
  expect(C.page().header).toBeNull();
  expect(C.state.ui.mode).toBe('page');
});


test('CMS field removal impact includes bindings in owned header/footer trees', () => {
  setup();
  const col = C.collectionAdd('Workshop Cabins');
  const field = C.fieldAdd(col.id, 'Workshop title', 'text');
  const node = C.N('heading', { text: 'Workshop region binding' });
  node.src = col.id; node.bind = { text: { src: 'field', path: field.id } };
  C.page().header = [node];
  expect(bindingImpact(col.id, field.id)).toContain(C.page().name + ' / Workshop region binding');
  C.page().header = null;
  expect(bindingImpact(col.id, field.id)).not.toContain('Workshop region binding');
});
