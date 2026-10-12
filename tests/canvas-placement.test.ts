import { expect, test } from 'vitest';
import { selectionToolbarTop } from '../app/src/ui/canvas-placement';

test.each([1, .75, .4])('short top-edge selection remains uncovered at zoom %s', zoom => {
  const height = 28 / zoom;
  const rect = { top: 0, bottom: 70 };
  const top = selectionToolbarTop(rect, height, 600);
  expect(top).toBeGreaterThanOrEqual(rect.bottom);
  expect(top + height).toBeLessThanOrEqual(600);
});

test('normal selections retain the toolbar immediately above them', () => {
  expect(selectionToolbarTop({ top: 200, bottom: 280 }, 40, 600)).toBe(160);
});

test('tall selected containers keep reachable controls while scrolled', () => {
  expect(selectionToolbarTop({ top: -200, bottom: 1200 }, 40, 600)).toBe(0);
});
