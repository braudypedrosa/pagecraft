import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => {
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  C.ensureTokens().classes = []; C.hist.u.length = 0; C.hist.r.length = 0;
});
const button = () => C.insert('button', null, C.tree().length)!;
const fixture = () => {
  const source = button(), target = button();
  C.classAdd('Copied look', { d: { 'background-color': '#242c27', 'border-radius': '18px', padding: '20px 32px' }, t: {}, m: { padding: '12px' } });
  const cls = C.findClass('copied-look')!;
  cls.st = { hover: { d: { 'border-radius': '24px' }, t: {}, m: {} }, focus: { d: { outline: '2px solid red' }, t: {}, m: {} } };
  C.classApply(source, cls.id); source.css.d['margin-top'] = '7px';
  return { source, target, cls };
};

test('a copied class deleted before Paste retains its appearance without resurrecting it', () => {
  const { source, target } = fixture();
  C.copyStyles(source.id); expect(C.classDelete('copied-look')).toBe(true);
  expect(C.pasteStyles(target.id)).toBe(true);
  expect(target.cls).toEqual([]); expect(C.findClass('copied-look')).toBeFalsy();
  expect(target.css.d['background-color']).toBe('#242c27');
  expect(target.css.d['border-radius']).toBe('18px');
  expect(target.css.d['padding-left']).toBe('32px');
  expect(target.css.m['padding-left']).toBe('12px');
  expect(target.st?.hover?.d['border-radius']).toBe('24px');
  expect(target.st?.focus?.d.outline).toBe('2px solid red');
  expect(target.css.d['margin-top']).toBe('7px');
});

test('fallback uses the copy-time source even when its live source changes or disappears', () => {
  const { source, target } = fixture();
  C.copyStyles(source.id); source.css.d['margin-top'] = '99px';
  C.classDelete('copied-look'); C.delNode(source.id);
  expect(C.pasteStyles(target.id)).toBe(true);
  expect(target.css.d['background-color']).toBe('#242c27');
  expect(target.css.d['margin-top']).toBe('7px');
});

test('live copied classes retain later values and precedence when no definition is missing', () => {
  const { source, target, cls } = fixture();
  C.copyStyles(source.id); cls.css.d['border-radius'] = '42px';
  const before = C.clone(source.css);
  expect(C.pasteStyles(target.id)).toBe(true);
  expect(target.css).toEqual(before); expect(target.cls).toEqual([cls.id]);
  expect(C.findClass(cls.id)?.css.d['border-radius']).toBe('42px');
});

test('missing lower class does not bake over edited or reordered surviving classes', () => {
  const { source, target, cls } = fixture();
  delete cls.st;
  const survivor = C.classAdd('Survivor', { d: { 'padding-left': '41px', 'border-radius': '29px' }, t: {}, m: {} });
  C.classApply(source, survivor); C.copyStyles(source.id);
  C.findClass(survivor)!.css.d['padding-left'] = '55px';
  expect(C.classDelete('copied-look')).toBe(true);
  const live = C.clone(C.findClass(survivor));
  expect(C.pasteStyles(target.id)).toBe(true);
  expect(target.cls).toEqual([survivor]);
  expect(target.css.d['padding-left']).toBe('26px'); // untouched factory default remains omitted by the Button bridge
  expect(target.css.d['border-radius']).toBe('8px'); // untouched Button factory value, omitted by bridge
  expect(C.findClass(survivor)).toEqual(live);
  expect(target.css.d['background-color']).toBe('#242c27');
});

test('a source local override and responsive fallbacks beat missing class values', () => {
  const { source, target, cls } = fixture();
  source.css.d['border-radius'] = '31px'; source.css.t['padding-right'] = '50px';
  source.st = { hover: { d: { 'border-radius': '37px' }, t: {}, m: {} } };
  cls.css.t = { padding: '16px 24px' };
  C.copyStyles(source.id); C.classDelete(cls.id); C.pasteStyles(target.id);
  expect(target.css.d['border-radius']).toBe('31px');
  expect(target.css.t['padding-right']).toBe('50px');
  expect(target.css.t['padding-left']).toBe('24px');
  expect(target.css.m['padding-left']).toBe('12px');
  expect(target.st?.hover?.d['border-radius']).toBe('37px');
});

test('multiple missing classes use captured precedence after deletion through document replacement', () => {
  const { source, target, cls } = fixture();
  delete cls.st;
  const later = C.classAdd('Later', { d: { 'border-radius': '22px', color: 'red' }, t: {}, m: {} });
  C.classApply(source, later); C.copyStyles(source.id);
  C.state.meta.tokens!.classes = [];
  expect(C.pasteStylesMany([target.id, 'missing-target'])).toBe(1);
  expect(target.cls).toEqual([]); expect(target.css.d['border-radius']).toBe('22px');
  expect(target.css.d['background-color']).toBe('#242c27');
  expect(C.classes()).toEqual([]);
});

test('copying a container does not capture unrelated descendants for fallback localization', () => {
  const { source, target, cls } = fixture();
  const box = C.insert('box', null, C.tree().length)!;
  C.classApply(box, cls.id); box.children = [C.clone(source)];
  C.copyStyles(box.id); C.state.meta.tokens!.classes = [];
  expect(C.pasteStyles(target.id)).toBe(true);
  expect(target.css.d['background-color']).toBe('#242c27');
});

test('Paste after Undo of class deletion takes the restored live reference branch', () => {
  const { source, target } = fixture();
  C.copyStyles(source.id); C.edit(() => { C.classDelete('copied-look'); }, 'Delete class');
  C.undo();
  expect(C.pasteStyles(target.id)).toBe(true);
  const restoredTarget = C.locate(target.id)!.node;
  expect(restoredTarget.cls).toEqual(['copied-look']);
  expect(restoredTarget.css).toEqual(C.styleClip.css);
});

test('multi-target Paste is one checkpoint and Undo restores the post-deletion state', () => {
  const { source, target } = fixture(), second = button();
  target.adv.css = '& { word-spacing: .07em; }';
  target.adv.cls = 'target-owned'; target.adv.htmlId = 'target-id'; target.props.link = '#own-link';
  source.adv.css = '& { letter-spacing: .03em; }';
  C.copyNode(source.id); const otherClipboard = C.clone(C.clip.node);
  C.copyStyles(source.id); C.edit(() => { C.classDelete('copied-look'); });
  const before = C.clone(C.doc());
  expect(C.stylePasteCheck().ok).toBe(true);
  C.edit(() => { C.pasteStylesMany([target.id, second.id]); });
  const after = C.clone(C.doc());
  expect(target.adv).toEqual({ cls: 'target-owned', htmlId: 'target-id', css: '& { letter-spacing: .03em; }' });
  expect(target.props.link).toBe('#own-link'); expect(C.clip.node).toEqual(otherClipboard);
  C.undo(); expect(C.doc()).toEqual(before); expect(C.findClass('copied-look')).toBeFalsy();
  C.redo(); expect(C.doc()).toEqual(after);
});

function unrepresentable() {
  const source = C.insert('heading', null, 0)!, one = button(), two = button();
  const low = C.classAdd('Low'), high = C.classAdd('High');
  C.findClass(low)!.st = { focus: { d: { color: 'red' }, t: {}, m: {} } };
  C.findClass(high)!.st = { hover: { d: { color: 'blue' }, t: {}, m: {} } };
  C.classApply(source, low); C.classApply(source, high); C.copyStyles(source.id);
  // A class deletion with no current users must not be vetoed by a stale clipboard.
  C.classRemove(source, low); expect(C.classDelete(low)).toBe(true);
  return { one, two, source };
}

test('unrepresentable fallback rejects the whole target set without mutation or delete veto', () => {
  const { one, two } = unrepresentable();
  const before = C.clone(C.doc());
  expect(C.stylePasteCheck()).toEqual({ ok: false, reason: 'Copied styles use a deleted class. Copy the source styles again.' });
  expect(C.pasteStylesMany([one.id, two.id])).toBe(0);
  expect(C.pasteStyles(one.id)).toBe(false);
  expect(C.doc()).toEqual(before);
});

test('ambiguous surviving anchor reordering refuses missing-class fallback safely', () => {
  const source = button(), target = button();
  for (const name of ['First', 'Middle', 'Last']) { const id = C.classAdd(name); C.classApply(source, id); }
  C.copyStyles(source.id); C.classRemove(source, 'middle'); C.classDelete('middle');
  C.classMove('last', -1);
  const before = C.clone(C.doc());
  expect(C.stylePasteCheck().ok).toBe(false); expect(C.pasteStyles(target.id)).toBe(false);
  expect(C.doc()).toEqual(before);
});

test('survivors reordered on the same side retain current precedence without freezing them', () => {
  const { source, target, cls } = fixture(); delete cls.st;
  const first = C.classAdd('First survivor', { d: { color: 'red' }, t: {}, m: {} });
  const second = C.classAdd('Second survivor', { d: { color: 'blue' }, t: {}, m: {} });
  C.classApply(source, first); C.classApply(source, second); C.copyStyles(source.id);
  C.classMove(second, -1); C.findClass(first)!.css.d.color = 'green';
  expect(C.classDelete(cls.id)).toBe(true);
  const live = C.clone(C.classes());
  expect(C.pasteStyles(target.id)).toBe(true);
  expect(target.cls).toEqual([first, second]); expect(target.css.d.color).toBeUndefined();
  expect(target.css.d['background-color']).toBe('#242c27'); expect(C.classes()).toEqual(live);
});

test('deleted class values equal to Button factory defaults retain authored bridge ownership', () => {
  const source = button(), target = button();
  const id = C.classAdd('Factory look', { d: { 'border-radius': '8px', 'padding-left': '26px' }, t: {}, m: {} });
  C.classApply(source, id); C.copyStyles(source.id); C.classDelete(id); C.pasteStyles(target.id);
  expect(target.css.d['--pc-authored-button-border-radius']).toBe('1');
  expect(target.css.d['--pc-authored-button-padding-left']).toBe('1');
  const css = C.treeCss([[target]], false);
  expect(css).toContain('border-radius:8px;'); expect(css).toContain('padding-left:26px;');
});
