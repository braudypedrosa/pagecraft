/* Paste styles onto a different kind of element. Between two of one kind a paste is a copy;
   onto another kind it is laid over what is there, so the target keeps the settings the
   source kind does not have. Found on staging: a Button pasted onto a hero photo dropped
   its position and fit, onto a Form its column layout, onto an Icon its size. */
import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const css = (d: Record<string, string>, t: Record<string, string> = {}, m: Record<string, string> = {}) => ({ d, t, m });

let source: ReturnType<typeof C.N>;
beforeEach(() => {
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  C.ensureTokens().classes = [];
  C.hist.u.length = 0; C.hist.r.length = 0;
  source = C.insert('button', null, 0)!;
  source.css = css(
    { 'background-color': '#eee9dc', 'padding-left': '26px', 'border-radius': '0' },
    { 'padding-left': '40px' }, { 'padding-left': '12px' });
  source.st = { hover: css({ 'background-color': '#fff' }), focus: css({ outline: '3px solid #f0a' }) } as any;
});

test('a different kind of element keeps the settings the copy does not carry', () => {
  const image = C.insert('image', null, 1)!, form = C.insert('form', null, 2)!, icon = C.insert('icon', null, 3)!;
  image.css = css({ position: 'absolute', inset: '0', 'object-fit': 'cover', 'border-radius': '12px' }, {}, { height: '100%' });
  form.css = css({ '--f-columns': 'repeat(4,minmax(0,1fr))', '--f-gap': '16px' }, { '--f-columns': 'repeat(2,minmax(0,1fr))' }, { '--f-columns': '1fr' });
  icon.css = css({ '--icon-size': '28px', 'background-color': 'transparent' });
  icon.st = { hover: css({ color: 'red' }) } as any;

  C.copyStyles(source.id);
  C.edit(() => { expect(C.pasteStylesMany([image.id, form.id, icon.id])).toBe(3); }, 'Paste styles');

  /* its own settings survive at every breakpoint */
  expect(image.css.d).toMatchObject({ position: 'absolute', inset: '0', 'object-fit': 'cover' });
  expect(image.css.m.height).toBe('100%');
  expect(form.css.d['--f-columns']).toBe('repeat(4,minmax(0,1fr))');
  expect(form.css.t['--f-columns']).toBe('repeat(2,minmax(0,1fr))');
  expect(form.css.m['--f-columns']).toBe('1fr');
  expect(icon.css.d['--icon-size']).toBe('28px');

  /* and everything copied arrives, winning where both set the same thing */
  for (const n of [image, form, icon]) {
    expect(n.css.d).toMatchObject({ 'background-color': '#eee9dc', 'padding-left': '26px', 'border-radius': '0' });
    expect(n.css.t['padding-left']).toBe('40px');
    expect(n.css.m['padding-left']).toBe('12px');
    expect(n.st!.hover!.d['background-color']).toBe('#fff');
    expect(n.st!.focus!.d.outline).toBe('3px solid #f0a');
  }
  /* a state the target already had is added to, not dropped */
  expect(icon.st!.hover!.d.color).toBe('red');
  /* the copy is never changed by what it was pasted onto */
  expect(source.css.d.position).toBeUndefined();
});

test('the same kind of element is still an exact copy', () => {
  const twin = C.insert('button', null, 1)!;
  twin.css = css({ 'min-height': '80px', 'border-radius': '99px' }, { 'min-height': '60px' });
  twin.st = { active: css({ opacity: '.5' }) } as any;

  C.copyStyles(source.id);
  C.edit(() => { C.pasteStylesMany([twin.id]); }, 'Paste styles');

  expect(twin.css).toEqual(source.css);
  expect(twin.st).toEqual(source.st);
});

test('a mixed selection is one step: Undo restores every target exactly', () => {
  const twin = C.insert('button', null, 1)!, image = C.insert('image', null, 2)!;
  twin.css = css({ 'min-height': '80px' });
  image.css = css({ position: 'absolute', 'object-fit': 'cover' });
  const before = JSON.stringify([twin, image]);

  C.copyStyles(source.id);
  C.edit(() => { C.pasteStylesMany([twin.id, image.id]); }, 'Paste styles');
  expect(twin.css.d['min-height']).toBeUndefined();
  expect(image.css.d.position).toBe('absolute');
  expect(C.historyLabel('undo')).toBe('Paste styles');

  C.undo();
  expect(JSON.stringify([C.locate(twin.id)!.node, C.locate(image.id)!.node])).toBe(before);
  C.redo();
  expect(C.locate(image.id)!.node.css.d).toMatchObject({ position: 'absolute', 'padding-left': '26px' });
});
