/** Keep the action bar outside a visible short selection. Tall containers retain a
 * reachable bar while scrolling because neither edge may be in view. */
export function selectionToolbarTop(rect: { top: number; bottom: number }, height: number, viewport: number): number {
  if (rect.top >= height) return rect.top - height;
  if (rect.bottom >= 0 && rect.bottom + height <= viewport) return rect.bottom;
  return Math.min(Math.max(0, rect.top - height), Math.max(0, viewport - height));
}

type Rect = { left: number; top: number; right: number; bottom: number };
type Size = { width: number; height: number };

const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max));
const intersects = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Prefer the established above/below placement, then use the closest measured clear
 * position when that would cover another selectable item. */
export function selectionToolbarPosition(
  rect: Rect,
  toolbar: Size,
  viewport: Size,
  blockers: Rect[] = [],
): { left: number; top: number } {
  const width = Math.min(toolbar.width, viewport.width);
  const height = Math.min(toolbar.height, viewport.height);
  const maxX = viewport.width - width;
  const maxY = viewport.height - height;
  const preferred = {
    left: clamp(rect.left, maxX),
    top: selectionToolbarTop(rect, height, viewport.height),
  };
  const xs = new Set([
    preferred.left,
    clamp(rect.right - width, maxX),
    clamp(rect.left - width, maxX),
    clamp(rect.right, maxX),
    0,
    maxX,
  ]);
  const ys = new Set([
    preferred.top,
    clamp(rect.top - height, maxY),
    clamp(rect.bottom, maxY),
    0,
    maxY,
  ]);
  blockers.forEach(blocker => {
    ys.add(clamp(blocker.top - height, maxY));
    ys.add(clamp(blocker.bottom, maxY));
  });

  const selectionHasOutsideEdge = rect.top >= height
    || (rect.bottom >= 0 && rect.bottom + height <= viewport.height);
  const candidates = Array.from(ys).flatMap(top => Array.from(xs).map(left => ({ left, top })))
    .sort((a, b) => {
      const distance = (point: { left: number; top: number }) =>
        Math.abs(point.top - preferred.top) + Math.abs(point.left - preferred.left);
      return distance(a) - distance(b);
    });
  const clear = candidates.find(candidate => {
    const bounds = {
      left: candidate.left, top: candidate.top,
      right: candidate.left + width, bottom: candidate.top + height,
    };
    if (selectionHasOutsideEdge && intersects(bounds, rect)) return false;
    return blockers.every(blocker => !intersects(bounds, blocker));
  });
  return clear || preferred;
}
