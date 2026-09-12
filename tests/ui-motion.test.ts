// @vitest-environment jsdom
import { afterEach, test, expect, vi } from 'vitest';
import { installUiMotion } from '../shared/ui-motion.js';

afterEach(() => { window.__pcMotion?.destroy(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

test('motion keeps a surface mounted through its exit and supports rapid reopening', async () => {
  const finishes: Array<() => void> = [];
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: vi.fn(() => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    finishes.push(finish);
    return { finished, cancel: vi.fn() };
  }) });
  const element = document.createElement('div'); element.hidden = true; document.body.append(element);
  const motion = installUiMotion()!;
  motion.enter(element, { kind: 'popover' });
  expect(element.hidden).toBe(false);
  finishes.shift()!(); await Promise.resolve();

  const leaving = motion.exit(element, { kind: 'popover' });
  expect(element.hidden).toBe(false);
  expect(element.hasAttribute('data-pc-motion-closing')).toBe(true);
  motion.enter(element, { kind: 'popover' });
  finishes.shift()!(); await leaving;
  expect(element.hidden).toBe(false);
  expect(element.hasAttribute('data-pc-motion-closing')).toBe(false);
});

test('reduced motion completes state changes immediately', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
  const element = document.createElement('div'); document.body.append(element);
  const motion = installUiMotion()!;
  await motion.exit(element, { kind: 'panel' });
  expect(element.hidden).toBe(true);
  await motion.enter(element, { kind: 'panel' });
  expect(element.hidden).toBe(false);
});
