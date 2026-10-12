/** Keep the action bar outside a visible short selection. Tall containers retain a
 * reachable bar while scrolling because neither edge may be in view. */
export function selectionToolbarTop(rect: { top: number; bottom: number }, height: number, viewport: number): number {
  if (rect.top >= height) return rect.top - height;
  if (rect.bottom >= 0 && rect.bottom + height <= viewport) return rect.bottom;
  return Math.min(Math.max(0, rect.top - height), Math.max(0, viewport - height));
}
