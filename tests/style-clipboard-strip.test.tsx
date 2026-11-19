// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig | undefined;
afterEach(() => { if (r) { act(() => r!.draw(null)); r.host.remove(); r = undefined; } C.styleClipClear(); });
function fixture() {
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = []; C.ensureTokens().classes = [];
  C.hist.u.length = 0; C.hist.r.length = 0;
  const source = C.insert('heading', null, 0)!, one = C.insert('heading', null, 1)!, two = C.insert('heading', null, 2)!;
  source.css.d['font-size'] = '40px';
  return { source, one, two };
}
const strip = () => r!.host.querySelector('.stclip');
const button = (text: string) => r!.$$('.stclip button').find(b => b.textContent?.trim() === text);

test('the Paste strip goes away after a paste and comes back with the next copy', () => {
  r = rig(); const { source, one, two } = fixture();
  C.copyStyles(source.id); C.selSet([one.id]);
  r.draw(() => <Inspector />, 'right');
  expect(strip()).toBeTruthy();
  act(() => button('Paste')!.click());
  expect(C.locate(one.id)!.node.css.d['font-size']).toBe('40px');
  act(() => { C.selSet([two.id]); r!.draw(() => <Inspector />, 'right'); });
  expect(strip()).toBeNull();
  // The look is still held: the menu and ⌘⇧V path (pasteStylesMany) still paste it.
  expect(C.styleClip.css).toBeTruthy();
  C.edit(() => { C.pasteStylesMany([two.id]); }, 'Paste styles');
  expect(C.locate(two.id)!.node.css.d['font-size']).toBe('40px');
  C.copyStyles(two.id);
  act(() => r!.draw(() => <Inspector />, 'right'));
  expect(strip()).toBeTruthy();
});

test('closing the strip hides it without forgetting the copied look', () => {
  r = rig(); const { source, one } = fixture();
  C.copyStyles(source.id); C.selSet([one.id]);
  r.draw(() => <Inspector />, 'right');
  const close = r.$$('.stclip button').find(b => b.getAttribute('aria-label') === 'Hide the Paste strip');
  expect(close).toBeTruthy();
  act(() => close!.click());
  expect(strip()).toBeNull();
  expect(C.styleClip.css).toBeTruthy();
});

test('a paste that is refused leaves the strip in place', () => {
  r = rig(); const { source, one } = fixture();
  const gone = C.classAdd('Gone'); C.classApply(source, gone);
  C.copyStyles(source.id); C.classRemove(source, gone); C.classDelete(gone);
  C.selSet([one.id]);
  r.draw(() => <Inspector />, 'right');
  act(() => button('Paste')!.click());
  expect(strip()).toBeTruthy();
});
