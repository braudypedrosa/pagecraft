// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { L } from '../app/src/ui/ctx';
import { rig, type Rig } from './ui.setup';

let r!: Rig;
afterEach(() => { act(() => r.draw(null)); r.host.remove(); vi.restoreAllMocks(); });

function fixture(wordpress: boolean) {
  r = rig(wordpress
    ? { nativePageSource: { currentPageId: '274', list: vi.fn(async () => []) } }
    : {});
  C.state.meta.blocks = []; C.state.meta.components = [];
  const source = C.insert('button', null, 0)!;
  const peer = C.insert('button', null, 1)!;
  const shared = C.classAdd('QA shared button');
  const available = C.classAdd('QA available button');
  C.classApply(source, shared); C.classApply(peer, shared);
  C.classApply(peer, available);
  C.selSet([source.id]);
  C.state.ui.stab = 'style';
  r.draw(() => <Inspector />, 'right');
  return { source, shared, available };
}

test('WordPress class scope copy is sitewide while shared targeting remains class-based', async () => {
  const { source, shared, available } = fixture(true);
  const classButton = r.$$('.tg').find(el => el.textContent?.trim() === '.' + shared)!;
  expect(classButton.title).toBe('Style every element using this class across this WordPress site');
  expect(classButton.parentElement?.querySelector('small')?.textContent).toBe('Across site');

  const option = r.$(`select option[value="${available}"]`)!;
  expect(option.textContent).toBe('.' + available + ' · Across site');

  r.click(classButton);
  expect(C.state.ui.target).toBe(shared);
  expect(C.tgtObj(source).id).toBe(shared);

  const askText = vi.spyOn(L, 'askText').mockResolvedValue(null);
  await act(async () => r.pick(r.$('select')!, '__new'));
  expect(askText.mock.calls[0][2]).toBe('Button');
  expect(askText.mock.calls[0][3]).toMatchObject({
    note: 'Restyling it reaches every element using it on this WordPress site.'
  });
});

test('Cloud class scope keeps document-local use counts', () => {
  const { shared, available } = fixture(false);
  const classButton = r.$$('.tg').find(el => el.textContent?.trim() === '.' + shared)!;
  expect(classButton.title).toBe('Style all 2 elements using this class');
  expect(classButton.parentElement?.querySelector('small')?.textContent).toBe('2 uses');
  expect(r.$(`select option[value="${available}"]`)?.textContent).toBe('.' + available + ' · 1 use');
});
