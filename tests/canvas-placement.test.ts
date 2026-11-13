import { expect, test } from 'vitest';
import { selectionToolbarPosition, selectionToolbarTop } from '../app/src/ui/canvas-placement';

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

test('toolbar uses the nearest clear viewport position instead of covering a preceding sibling', () => {
  const selected = { left: 60, top: 137, right: 404, bottom: 186 };
  const source = { left: 60, top: 72, right: 282, bottom: 121 };
  const position = selectionToolbarPosition(
    selected,
    { width: 344, height: 40 },
    { width: 414, height: 900 },
    [source],
  );

  expect(position).toEqual({ left: 60, top: 32 });
});

test('toolbar avoids both adjacent siblings rather than moving the overlap below selection', () => {
  const selected = { left: 60, top: 137, right: 404, bottom: 186 };
  const siblings = [
    { left: 60, top: 72, right: 282, bottom: 121 },
    { left: 60, top: 186, right: 404, bottom: 250 },
  ];
  const position = selectionToolbarPosition(
    selected,
    { width: 344, height: 40 },
    { width: 414, height: 260 },
    siblings,
  );

  expect(position.top).toBe(32);
  expect(position.top + 40).toBeLessThanOrEqual(siblings[0].top);
});

test('tall selections retain an on-screen toolbar when no outside edge is visible', () => {
  expect(selectionToolbarPosition(
    { left: 20, top: -200, right: 390, bottom: 1200 },
    { width: 300, height: 40 },
    { width: 414, height: 600 },
    [],
  )).toEqual({ left: 20, top: 0 });
});
