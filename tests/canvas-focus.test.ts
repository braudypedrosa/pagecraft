// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
import { installCanvasFocus } from '../app/src/ui/canvas-focus';

test('canvas focus is reversible and opening a tool restores panels without a document write', async () => {
  document.body.innerHTML = '<button id="canvasFocusBtn"></button><nav id="leftRail"><button data-t="add"><span>Add</span></button></nav><input id="field">';
  const layout = vi.fn();
  installCanvasFocus(layout);
  const toggle = document.getElementById('canvasFocusBtn')!;
  toggle.click();
  expect(document.body.classList.contains('canvas-focus')).toBe(true);
  expect(toggle.getAttribute('aria-label')).toBe('Show side panels');
  document.querySelector<HTMLButtonElement>('[data-t]')!.click();
  expect(document.body.classList.contains('canvas-focus')).toBe(false);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key:'\\', ctrlKey:true, shiftKey:true, bubbles:true}));
  expect(document.body.classList.contains('canvas-focus')).toBe(true);
  document.getElementById('field')!.dispatchEvent(new KeyboardEvent('keydown', {key:'\\', ctrlKey:true, shiftKey:true, bubbles:true}));
  expect(document.body.classList.contains('canvas-focus')).toBe(true);
  toggle.click();
  expect(document.body.classList.contains('canvas-focus')).toBe(false);
  document.body.replaceChildren();
});
