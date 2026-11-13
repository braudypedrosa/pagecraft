// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { L } from '../app/src/ui/ctx';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

/* The ask dialog resolves only after its exit animation. Anything clicked in that
   window used to decide what "Save this colour as a new token" saved and linked. */
let r: Rig;
const colour: Control = { t: 'color', c: 'color', label: 'Colour', r: 1 };

beforeEach(() => { r = rig(); });
afterEach(() => { vi.restoreAllMocks(); act(() => r.draw(null)); r.host.remove(); });

function pendingName() {
  let answer!: (v: string | null) => void;
  vi.spyOn(L, 'askText').mockImplementation(() => new Promise(res => { answer = res; }));
  return (v: string | null) => answer(v);
}
function heading() {
  const n = C.insert('heading', null, C.tree().length)!;
  n.css.d.color = '#2f6f4f';
  n.st = { hover: { d: { color: '#c0392b' }, t: {}, m: {} } } as any;
  return n;
}

test('a Hover click while the dialog closes does not change what the token saves or links', async () => {
  const n = heading();
  C.selSet([n.id]);
  const answer = pendingName();
  r.draw(<Ctl n={n} c={colour} />);
  act(() => r.click(r.$('button.tok.add')));

  /* the clicks a person makes before the dialog has finished leaving */
  C.state.ui.st = 'hover';
  C.state.ui.dev = 'tablet';
  await act(async () => { answer('Forest'); });

  const tok = C.colors().find(c => c.name === 'Forest')!;
  expect(tok.value).toBe('#2f6f4f');
  expect(n.css.d.color).toBe(C.cvar(tok.id));
  expect(n.st!.hover!.d.color).toBe('#c0392b');
  expect(n.css.t.color).toBeUndefined();
  /* the view the person moved to stays where they put it */
  expect(C.state.ui.st).toBe('hover');
  expect(C.state.ui.dev).toBe('tablet');
});

test('selecting another element meanwhile does not fan the link out to it', async () => {
  const n = heading(), other = heading();
  C.selSet([n.id]);
  const answer = pendingName();
  r.draw(<Ctl n={n} c={colour} />);
  act(() => r.click(r.$('button.tok.add')));

  C.selSet([n.id, other.id]);
  await act(async () => { answer('Forest'); });
  const tok = C.colors().find(c => c.name === 'Forest')!;
  expect(n.css.d.color).toBe(C.cvar(tok.id));
  expect(other.css.d.color).toBe('#2f6f4f');
  expect(C.selIds()).toEqual([n.id, other.id]);

  C.undo();
  expect(C.findColor(tok.id)).toBeNull();
  expect(C.locate(n.id)!.node.css.d.color).toBe('#2f6f4f');
});

test('cancelling, or deleting the element first, creates nothing', async () => {
  const n = heading();
  C.selSet([n.id]);
  let answer = pendingName();
  r.draw(<Ctl n={n} c={colour} />);
  const before = C.colors().length;
  act(() => r.click(r.$('button.tok.add')));
  await act(async () => { answer(null); });
  expect(C.colors().length).toBe(before);

  answer = pendingName();
  act(() => r.click(r.$('button.tok.add')));
  C.delNode(n.id);
  await act(async () => { answer('Forest'); });
  expect(C.colors().length).toBe(before);
});
