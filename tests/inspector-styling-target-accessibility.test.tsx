// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function target(label: string) {
  return r.$$('.tg').find(button => button.textContent?.trim() === label) || null;
}

test('styling target buttons expose and update their pressed state', () => {
  const text = C.insert('text', null, 0)!;
  const classId = C.classAdd('QA rich motion');
  C.classApply(text, classId);
  C.selSet([text.id]);
  C.state.ui.stab = 'style';
  r.draw(() => <Inspector />, 'right');

  expect(target('This element')?.getAttribute('aria-pressed')).toBe('true');
  expect(target('.' + classId)?.getAttribute('aria-pressed')).toBe('false');

  r.click(target('.' + classId));
  expect(C.state.ui.target).toBe(classId);
  expect(target('This element')?.getAttribute('aria-pressed')).toBe('false');
  expect(target('.' + classId)?.getAttribute('aria-pressed')).toBe('true');

  r.click(target('This element'));
  expect(C.state.ui.target).toBe('');
  expect(target('This element')?.getAttribute('aria-pressed')).toBe('true');
  expect(target('.' + classId)?.getAttribute('aria-pressed')).toBe('false');
});
