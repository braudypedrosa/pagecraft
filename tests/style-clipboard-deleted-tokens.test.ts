import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => {
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  C.ensureTokens().classes = []; C.hist.u.length = 0; C.hist.r.length = 0;
});
const heading = () => C.insert('heading', null, C.tree().length)!;
/* The staging fixture: a token colour and 40px saved as a text style, plus a token hover. */
const fixture = () => {
  const source = heading(), a = heading(), b = C.insert('image', null, C.tree().length)!;
  const red = C.colorAdd('QA paste red', '#c0392b');
  source.css.d.color = C.cvar(red);
  source.css.d['font-size'] = '40px';
  source.css.m['font-size'] = '30px';
  const lead = C.tsCreateFrom(source, 'QA paste lead');
  source.st = { hover: { d: { color: C.cvar(red) }, t: {}, m: {} } } as any;
  source.adv.css = '&:focus-visible{outline:2px solid var(--c-' + red + ')}';
  return { source, a, b, red, lead };
};
const html = () => C.buildPage(C.state.pages[0]);

test('a text style and colour deleted after Copy still paste the look the source keeps', () => {
  const { source, a, b, red, lead } = fixture();
  C.copyStyles(source.id);
  C.styleDelete(lead); C.colorDelete(red);
  expect(source.css.d.color).toBe('#c0392b');

  expect(C.stylePasteCheck().ok).toBe(true);
  expect(C.pasteStylesMany([a.id, b.id])).toBe(2);
  expect(a.props.ts).toBe('');
  expect(a.css.d['font-size']).toBe('40px');
  expect(a.css.m['font-size']).toBe('30px');
  expect(a.css.d.color).toBe('#c0392b');
  expect(a.st?.hover?.d.color).toBe('#c0392b');
  expect(a.adv.css).toBe('&:focus-visible{outline:2px solid #c0392b}');
  /* typography the source would not have shown stays off a target with no text style */
  expect(b.css.d['font-size']).toBeUndefined();
  expect(b.st?.hover?.d.color).toBe('#c0392b');
  const out = html();
  expect(out).not.toMatch(/--c-qa-paste-red|ts-qa-paste-lead/);
  /* a style later made under the same name does not quietly take the target over */
  C.styleAdd('QA paste lead');
  expect(a.props.ts).toBe('');
});

test('only the deleted one is resolved; live text styles and colours stay linked', () => {
  const { source, a, red, lead } = fixture();
  C.copyStyles(source.id);
  C.colorDelete(red);
  expect(C.pasteStyles(a.id)).toBe(true);
  expect(a.props.ts).toBe(lead);
  expect(a.css.d['font-size']).toBeUndefined();
  expect(C.findStyle(lead)!.css.d.color).toBe('#c0392b');
  expect(a.st?.hover?.d.color).toBe('#c0392b');

  const c = heading(), blue = C.colorAdd('QA paste blue', '#2244aa');
  c.css.d.color = C.cvar(blue); c.css.d['font-size'] = '22px';
  const t2 = C.tsCreateFrom(c, 'QA paste body');
  C.copyStyles(c.id);
  C.styleDelete(t2);
  const d = heading();
  expect(C.pasteStyles(d.id)).toBe(true);
  expect(d.props.ts).toBe('');
  expect(d.css.d.color).toBe(C.cvar(blue));
  expect(d.css.d['font-size']).toBe('22px');
});

test('the target\'s pasted local typography still wins over the baked style', () => {
  const source = heading(), target = heading();
  source.css.d['font-size'] = '40px'; source.css.d['font-weight'] = '700';
  const lead = C.tsCreateFrom(source, 'Lead');
  source.css.d['font-weight'] = '300';
  C.copyStyles(source.id); C.styleDelete(lead);
  expect(C.pasteStyles(target.id)).toBe(true);
  expect(target.css.d['font-size']).toBe('40px');
  expect(target.css.d['font-weight']).toBe('300');
});

test('one Undo restores every target after a resolved paste, and Redo repeats it', () => {
  const { source, a, red, lead } = fixture();
  const before = C.clone(a);
  C.copyStyles(source.id);
  C.edit(() => C.styleDelete(lead)); C.edit(() => C.colorDelete(red));
  C.edit(() => { C.pasteStylesMany([a.id]); });
  const pasted = C.clone(C.locate(a.id)!.node);
  C.undo();
  const back = C.locate(a.id)!.node;
  expect(back.css).toEqual(before.css); expect(back.props.ts).toBe(before.props.ts);
  C.redo();
  expect(C.locate(a.id)!.node).toEqual(pasted);
});
