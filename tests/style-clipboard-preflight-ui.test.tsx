// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

const builder = readFileSync('builder.html', 'utf8');
let r: Rig | undefined;
afterEach(() => { if (r) { act(() => r!.draw(null)); r.host.remove(); r = undefined; } });
function fixture() {
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = []; C.ensureTokens().classes = [];
  C.hist.u.length = 0; C.hist.r.length = 0;
  const source = C.insert('heading', null, 0)!, one = C.insert('button', null, 1)!, two = C.insert('button', null, 2)!;
  const low = C.classAdd('Low'), high = C.classAdd('High');
  C.findClass(low)!.st = { focus: { d: { color: 'red' }, t: {}, m: {} } };
  C.findClass(high)!.st = { hover: { d: { color: 'blue' }, t: {}, m: {} } };
  C.classApply(source, low); C.classApply(source, high); C.copyStyles(source.id);
  C.classRemove(source, low); C.classDelete(low);
  C.edit(() => { one.css.d['margin-top'] = '12px'; }); C.undo();
  C.selSet([one.id, two.id]);
  return { one, two };
}
const snapshot = () => C.clone({ document: C.doc(), undo: C.hist.u, redo: C.hist.r });
const error = 'Copied styles use a deleted class. Copy the source styles again.';

test('actual context Paste preflight preserves document and both history stacks', () => {
  const { one, two } = fixture(), before = snapshot(), toast = vi.fn();
  const start = builder.indexOf("    case 'stpaste': {");
  const end = builder.indexOf("    case 'hide':", start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const execute = new Function('styleClip', 'stylePasteCheck', 'edit', 'pasteStylesMany', 'list', 'toast',
    'switch ("stpaste") {' + builder.slice(start, end) + '}');
  execute(C.styleClip, C.stylePasteCheck, C.edit, C.pasteStylesMany, [one.id, two.id], toast);
  expect(toast).toHaveBeenCalledWith(error); expect(snapshot()).toEqual(before);
});

test('actual keyboard Paste preflight preserves document and Redo before edit', () => {
  fixture(); const before = snapshot(), toast = vi.fn();
  const start = builder.indexOf("  if (meta && e.shiftKey && k === 'v') {");
  const end = builder.indexOf('  const oneDeep =', start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const execute = new Function('styleClip', 'stylePasteCheck', 'selIds', 'edit', 'pasteStylesMany', 'toast', 'e',
    'const meta = true, k = "v";\n' + builder.slice(start, end));
  const event = { shiftKey: true, preventDefault: vi.fn() };
  execute(C.styleClip, C.stylePasteCheck, C.selIds, C.edit, C.pasteStylesMany, toast, event);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(error); expect(snapshot()).toEqual(before);
});

test('real Inspector Paste bar rejects before creating a checkpoint or clearing Redo', () => {
  r = rig(); fixture(); const before = snapshot();
  r.draw(() => <Inspector />, 'right');
  const paste = r.$$('button').find(b => b.textContent?.trim() === 'Paste to 2');
  expect(paste).toBeTruthy(); act(() => paste!.click());
  expect(r.calls.some(c => c[0] === 'toast' && c[1] === error)).toBe(true);
  expect(snapshot()).toEqual(before);
});
