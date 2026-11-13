// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { L } from '../app/src/ui/ctx';
import { mount } from '../app/src/ui/index';
import { stubLegacy } from './ui.setup';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const pendingFrames = new Set<number>();
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  expect(pendingFrames.size).toBe(0);
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  const request = requestAnimationFrame, cancel = cancelAnimationFrame;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
    const id = request(time => { pendingFrames.delete(id); callback(time); });
    pendingFrames.add(id);
    return id;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { pendingFrames.delete(id); cancel(id); });
});

afterEach(async () => {
  document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger[aria-expanded="true"]')?.click();
  const inspector = document.getElementById('right');
  if (inspector) act(() => render(null, inspector));
  document.body.replaceChildren();
  try {
    // Drain the picker focus and Preact after-paint callbacks before restoring browser APIs.
    await frame();
    await settle();
    expect(pendingFrames.size).toBe(0);
  } finally {
    for (const id of pendingFrames) cancelAnimationFrame(id);
    pendingFrames.clear();
    vi.restoreAllMocks();
    if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
});

test('cancelling New class resets the enhanced picker label and allows another attempt', async () => {
  document.body.innerHTML = '<div id="app"><div class="main"><aside id="right"></aside></div></div>';
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  const button = C.insert('button', null, 0)!;
  const shared = C.classAdd('Existing shared class');
  C.classApply(button, shared);
  C.selSet([button.id]);
  C.state.ui.stab = 'style';
  const ui = mount(C, stubLegacy([]));
  act(() => ui.renderRight());
  await settle();

  const select = document.querySelector<HTMLSelectElement>('select option[value="__new"]')?.parentElement as HTMLSelectElement;
  const trigger = select.nextElementSibling as HTMLButtonElement;
  expect(trigger.querySelector('span')?.textContent).toBe('Add a class…');
  const before = C.clone({ document: C.doc(), undo: C.hist.u, redo: C.hist.r });
  const askText = vi.spyOn(L, 'askText')
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('Retry class');

  await act(async () => {
    trigger.click();
    await frame();
    expect(document.activeElement?.matches('.pc-custom-select-option')).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    document.querySelector<HTMLButtonElement>('.pc-custom-select-option[data-value="__new"]')!.click();
    await settle();
  });
  expect(select.value).toBe('');
  expect(trigger.querySelector('span')?.textContent).toBe('Add a class…');
  expect(C.clone({ document: C.doc(), undo: C.hist.u, redo: C.hist.r })).toEqual(before);

  await act(async () => {
    trigger.click();
    await frame();
    expect(document.activeElement?.matches('.pc-custom-select-option')).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    document.querySelector<HTMLButtonElement>('.pc-custom-select-option[data-value="__new"]')!.click();
    await settle();
  });
  expect(askText).toHaveBeenCalledTimes(2);
  expect(C.classes().some(c => c.name === 'Retry class')).toBe(true);
  ui.renderRight();
});
