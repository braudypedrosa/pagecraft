// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

/* Typing a value at a breakpoint flips the field from Inherited to Override while you type,
   not only after focus leaves. Clearing it flips it back. */
let r: Rig;
beforeEach(() => { r = rig(); C.state.ui.st = ''; });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); C.state.ui.dev = 'desktop'; });

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

test('the responsive badge turns to Override as soon as a mobile value is typed', async () => {
  const image = C.N('image');
  C.state.pages[0].tree = [image];
  C.selSet([image.id]);
  const height = C.DEF.image.controls.style.find(c => c.c === 'height')!;
  C.state.ui.dev = 'mobile';
  act(() => r.draw(() => <Ctl n={image} c={height} />, 'right'));
  const input = () => r.$('input[type=number], input.ctl') as HTMLInputElement;
  expect(r.$('.rsp.ovr')).toBeNull();

  const field = input();
  act(() => { field.focus(); r.type(field, '300'); });
  await act(frame);
  expect(image.css.m.height).toBe('300px');
  expect(r.$('.rsp.ovr')).not.toBeNull();
  expect(input()).toBe(field);

  act(() => { r.type(input(), ''); });
  await act(frame);
  expect(image.css.m.height).toBeUndefined();
  expect(r.$('.rsp.ovr')).toBeNull();
});
