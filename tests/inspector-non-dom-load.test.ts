// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test('Core-only editor loaders may provide window and document without browser event APIs', async () => {
  vi.stubGlobal('document', {});
  vi.stubGlobal('window', {});
  const controls = await import('../app/src/ui/inspector/ctl');
  expect(typeof controls.writer).toBe('function');
});
