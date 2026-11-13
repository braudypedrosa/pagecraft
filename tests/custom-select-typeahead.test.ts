import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { installCustomSelects } from '../shared/custom-select.js';

const windows: JSDOM[] = [];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  windows.splice(0).forEach(dom => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    dom.window.close();
  });
  vi.clearAllTimers();
  vi.useRealTimers();
});

function fixture(options = '<option>H1</option><option selected>H2</option><option>H3</option>') {
  const dom = new JSDOM(`<!doctype html><label for="heading">HTML tag</label><select id="heading">${options}</select>`, {
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  windows.push(dom);
  const w = dom.window;
  const doc: Document = w.document;
  const frames: FrameRequestCallback[] = [];
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.requestAnimationFrame = (callback: FrameRequestCallback) => frames.push(callback);
  w.setTimeout = setTimeout;
  w.clearTimeout = clearTimeout;
  w.eval(`(${installCustomSelects.toString()})('');`);
  const select = doc.querySelector<HTMLSelectElement>('select')!;
  const trigger = doc.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  const menu = doc.querySelector<HTMLElement>('[role="listbox"]')!;
  const inputs = vi.fn(), changes = vi.fn();
  select.addEventListener('input', inputs);
  select.addEventListener('change', changes);
  const paint = () => frames.splice(0).forEach(callback => callback(0));
  const active = () => (doc.activeElement as HTMLElement)?.dataset.value;
  const press = (key: string, target: Element = doc.activeElement!, modifiers: KeyboardEventInit = {}) => {
    const event = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
    target.dispatchEvent(event);
    return event;
  };
  return { doc, select, trigger, menu, inputs, changes, paint, active, press };
}

test('typeahead continues from the trigger into the focused option without committing', () => {
  const f = fixture();
  f.trigger.focus();
  f.press('h');
  f.paint();
  expect(f.active()).toBe('H1');
  expect(f.trigger.getAttribute('aria-expanded')).toBe('true');
  expect(f.doc.activeElement?.parentElement).toBe(f.menu);

  f.press('3');
  expect(f.active()).toBe('H3');
  expect(f.select.value).toBe('H2');
  expect(f.inputs).not.toHaveBeenCalled();
  expect(f.changes).not.toHaveBeenCalled();

  (f.doc.activeElement as HTMLButtonElement).click();
  expect(f.select.value).toBe('H3');
  expect(f.inputs).toHaveBeenCalledTimes(1);
  expect(f.changes).toHaveBeenCalledTimes(1);
  expect(f.menu.hidden).toBe(true);
  expect(f.doc.activeElement).toBe(f.trigger);
});

test('an already-open menu accepts a case-insensitive prefix from its options', () => {
  const f = fixture();
  f.trigger.click();
  f.paint();
  expect(f.active()).toBe('H2');
  f.press('H', undefined, { shiftKey: true });
  expect(f.active()).toBe('H1');
  f.press('3');
  expect(f.active()).toBe('H3');
  expect(f.menu.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  expect(f.select.value).toBe('H2');
});

test('typeahead skips disabled options and groups and preserves focus for an unmatched prefix', () => {
  const f = fixture(`<option selected>Body</option><option disabled>H1</option>
    <optgroup label="Unavailable" disabled><option>H2</option></optgroup><option>H3</option>`);
  f.trigger.click();
  f.paint();
  f.press('h');
  expect(f.active()).toBe('H3');
  f.press('2');
  expect(f.active()).toBe('H3');
  expect(f.select.value).toBe('Body');
  expect(f.inputs).not.toHaveBeenCalled();
  expect(f.changes).not.toHaveBeenCalled();
});

test('the prefix persists for 649 ms and resets after 650 ms', () => {
  const f = fixture('<option selected>Body</option><option>H1</option><option>H3</option><option>Section</option>');
  f.trigger.click();
  f.paint();
  f.press('h');
  vi.advanceTimersByTime(649);
  f.press('3');
  expect(f.active()).toBe('H3');
  vi.advanceTimersByTime(650);
  f.press('s');
  expect(f.active()).toBe('Section');
  expect(f.select.value).toBe('Body');
});

test('modified printable keys stay available to shortcuts on the trigger and open options', () => {
  const f = fixture();
  f.trigger.focus();
  for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
    expect(f.press('h', f.trigger, modifier).defaultPrevented).toBe(false);
    expect(f.menu.hidden).toBe(true);
  }
  f.trigger.click();
  f.paint();
  for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
    expect(f.press('h', undefined, modifier).defaultPrevented).toBe(false);
    expect(f.active()).toBe('H2');
  }
  f.press('h');
  expect(f.active()).toBe('H1');
  f.press('3');
  expect(f.active()).toBe('H3');
});

test('menu navigation and Escape retain their existing selection contract after typeahead', () => {
  const f = fixture('<option>H1</option><option selected>H2</option><option disabled>H3</option><option>H4</option>');
  f.trigger.focus();
  expect(f.press(' ').defaultPrevented).toBe(true);
  f.paint();
  expect(f.active()).toBe('H2');
  f.press('h');
  expect(f.active()).toBe('H1');
  for (const [key, value] of [['End', 'H4'], ['ArrowDown', 'H1'], ['ArrowUp', 'H4'], ['Home', 'H1'], ['ArrowDown', 'H2']]) {
    expect(f.press(key).defaultPrevented).toBe(true);
    expect(f.active()).toBe(value);
  }
  // Option buttons keep native Enter/Space activation rather than a second custom commit handler.
  expect(f.press('Enter').defaultPrevented).toBe(false);
  expect(f.press(' ').defaultPrevented).toBe(false);
  expect(f.inputs).not.toHaveBeenCalled();
  expect(f.press('Escape').defaultPrevented).toBe(true);
  expect(f.menu.hidden).toBe(true);
  expect(f.doc.activeElement).toBe(f.trigger);
  expect(f.select.value).toBe('H2');
  expect(f.changes).not.toHaveBeenCalled();

  expect(f.press('Enter').defaultPrevented).toBe(true);
  f.paint();
  expect(f.active()).toBe('H2');
  expect(f.menu.hidden).toBe(false);
});
