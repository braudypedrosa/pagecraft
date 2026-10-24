// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { L } from '../app/src/ui/ctx';
import { rig, type Rig } from './ui.setup';

let r: Rig | undefined;
afterEach(() => {
  if (r) { act(() => r!.draw(null)); r.host.remove(); r = undefined; }
  vi.restoreAllMocks();
});
function fixture(wordpress = true, peer = false, eligible = true) {
  const catalogue = vi.fn(async () => []);
  r = rig(wordpress ? { nativePageSource: { currentPageId: '274', list: catalogue } } : {});
  C.state.meta.blocks = []; C.state.meta.components = [];
  const source = C.insert('button', null, 0)!; C.tsApply(source, 'btn');
  if (eligible) source.css.d['font-size'] = '21px';
  if (peer) { const other = C.insert('button', null, 1)!; C.tsApply(other, 'btn'); }
  const control = C.DEF.button.controls.content.find(c => c.t === 'tstyle')!;
  const draw = () => r!.draw(() => <Ctl n={source} c={control} />, 'right');
  draw();
  return { source, catalogue, draw, update: () => r!.$('.pc-text-style-actions button') as HTMLButtonElement };
}

test('WordPress confirms a one-local-use typography update as sitewide', async () => {
  const { update, catalogue } = fixture();
  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  await act(async () => update().click());
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0]).toBe('Update typography across this site?');
  expect(confirm.mock.calls[0][1]).toContain('wherever it is used on this WordPress site');
  expect(catalogue).not.toHaveBeenCalled();
});

test('WordPress omits the document-local use count from its update action and confirmation', async () => {
  const { update } = fixture(true, true);
  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  expect(update().textContent).toBe('Update typography');
  await act(async () => update().click());
  expect(confirm.mock.calls[0][1]).not.toMatch(/\d+ uses/);
});

test('WordPress Cancel preserves the mixed draft and both history stacks even with one local use', async () => {
  const { source, update } = fixture();
  source.css.d['background-color'] = '#e8d9be'; source.props.variant = 'outline'; source.props.link = '#own-link';
  C.edit(() => { source.css.d['padding-left'] = '33px'; }); C.undo();
  const fresh = C.locate(source.id)!.node;
  const control = C.DEF.button.controls.content.find(c => c.t === 'tstyle')!;
  r!.draw(() => <Ctl n={fresh} c={control} />, 'right');
  const before = C.clone({ document: C.doc(), undo: C.hist.u, redo: C.hist.r });
  vi.spyOn(L, 'askConfirm').mockResolvedValue(false);
  await act(async () => update().click());
  expect(C.clone({ document: C.doc(), undo: C.hist.u, redo: C.hist.r })).toEqual(before);
  expect(r!.names()).not.toContain('toast');
});

test('WordPress confirmation escapes the style name and keeps one ownership note', async () => {
  const { update, draw } = fixture();
  C.findStyle('btn')!.name = '<Button & label>'; draw();
  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(false);
  await act(async () => update().click());
  const [title, body, options] = confirm.mock.calls[0];
  expect(title).toBe('Update typography across this site?');
  expect(body).toContain('<b>&lt;Button &amp; label&gt;</b>');
  expect(body).not.toContain('<Button & label>');
  expect(body.match(/Spacing, backgrounds and borders stay local/g)).toHaveLength(1);
  expect(body).toContain('other elements keep their overrides');
  expect(options).toMatchObject({ ok: 'Update typography', danger: false });
});

test('confirmed WordPress update stays one undoable typography edit and preserves local appearance', async () => {
  const { source, update } = fixture();
  source.css.d['background-color'] = '#e8d9be'; source.css.d['padding-left'] = '33px';
  source.props.variant = 'outline'; source.props.link = '#own-link';
  const before = C.clone(C.doc());
  vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  await act(async () => update().click());
  const after = C.clone(C.doc());
  expect(C.findStyle('btn')!.css.d['font-size']).toBe('21px');
  expect(source.css.d['font-size']).toBeUndefined();
  expect(source.css.d['background-color']).toBe('#e8d9be');
  expect(source.css.d['padding-left']).toBe('33px');
  expect(source.props.variant).toBe('outline'); expect(source.props.link).toBe('#own-link');
  expect(C.historyLabel('undo')).toBe('Update typography');
  expect(C.hist.u).toHaveLength(1);
  C.undo(); expect(C.doc()).toEqual(before);
  C.redo(); expect(C.doc()).toEqual(after);
  // Redo restores new node objects; the control's fresh native owner is read on remount.
  const restored = C.locate(source.id)!.node;
  const control = C.DEF.button.controls.content.find(c => c.t === 'tstyle')!;
  r!.draw(() => <Ctl n={restored} c={control} />, 'right');
  expect(update().disabled).toBe(true);
});

test('disabled WordPress update never confirms or changes history', async () => {
  const { update } = fixture(true, false, false);
  const before = C.clone({ document: C.doc(), undo: C.hist.u, redo: C.hist.r });
  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  expect(update().disabled).toBe(true); await act(async () => update().click());
  expect(confirm).not.toHaveBeenCalled();
  expect(C.clone({ document: C.doc(), undo: C.hist.u, redo: C.hist.r })).toEqual(before);
});

test('Cloud keeps its two-use label and existing confirmation copy', async () => {
  const { update } = fixture(false, true);
  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(false);
  expect(update().textContent).toBe('Update typography · 2 uses');
  await act(async () => update().click());
  expect(confirm.mock.calls[0][0]).toBe('Update typography everywhere?');
  expect(confirm.mock.calls[0][1]).toContain('(2 uses)');
  expect(confirm.mock.calls[0][1]).not.toContain('WordPress site');
});

test('Cloud retains its one-use update behavior without confirmation', async () => {
  const { update } = fixture(false);
  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  await act(async () => update().click());
  expect(confirm).not.toHaveBeenCalled();
  expect(C.findStyle('btn')!.css.d['font-size']).toBe('21px');
});
