// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { installEditorViewport, MIN_EDITOR_WIDTH } from '../app/src/ui/editor-viewport';

test('767/768 boundary locks all editor surfaces without replacing values or open dialogs', async () => {
  document.body.innerHTML = '<main id="app"><input value="Unsaved CMS name"></main><div id="modal"><button>Cancel</button></div>';
  const input = document.querySelector('input')!;
  input.focus(); input.setSelectionRange(3, 7);
  const resize = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  };
  resize(1024);
  const guard = installEditorViewport('/sites', () => {
    document.querySelector<HTMLElement>('#app')!.inert = guard.blocked || !document.querySelector<HTMLElement>('#modal')!.hidden;
  });
  await Promise.resolve();
  expect(MIN_EDITOR_WIDTH).toBe(768);
  resize(767);
  expect(guard.blocked).toBe(true);
  expect(document.querySelector<HTMLElement>('#modal')!.inert).toBe(true);
  expect(document.querySelector('a')!.getAttribute('href')).toBe('/sites');
  expect(document.activeElement?.id).toBe('editorWidthGate');
  let shortcuts = 0;
  const shortcut = () => shortcuts++;
  document.addEventListener('keydown', shortcut);
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'z', ctrlKey: true }));
  expect(shortcuts).toBe(0);
  const arriving = document.createElement('div'); document.body.append(arriving);
  await Promise.resolve(); expect(arriving.inert).toBe(true);
  resize(390); expect(guard.blocked).toBe(true);
  resize(768);
  expect(guard.blocked).toBe(false);
  expect(document.querySelector('input')).toBe(input);
  expect(input.value).toBe('Unsaved CMS name');
  expect(input.selectionStart).toBe(3);
  expect(document.querySelector<HTMLElement>('#modal')!.hidden).toBe(false);
  expect(document.querySelector<HTMLElement>('#modal')!.inert).toBe(false);
  expect(document.querySelector<HTMLElement>('#app')!.inert).toBe(true);
  document.removeEventListener('keydown', shortcut);
  guard.destroy(); document.body.innerHTML = '';
});
