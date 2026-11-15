// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { selectionToolbarPosition } from '../app/src/ui/canvas-placement';

/* The rich-text toolbar is placed like the selection bar: above the text being edited when
   that is clear, otherwise the nearest spot that covers neither it nor its neighbours. */
const source = readFileSync('builder.html', 'utf8');
const placeRT = source.slice(source.indexOf('function placeRT() {'), source.indexOf('/* `createLink` runs against'));

type R = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const rect = (left: number, top: number, width: number, height: number): R =>
  ({ left, top, right: left + width, bottom: top + height, width, height });

function place(edited: R, siblings: R[], zoom = 1) {
  const rt = document.createElement('div');
  Object.defineProperty(rt, 'offsetWidth', { value: 340 });
  Object.defineProperty(rt, 'offsetHeight', { value: 34 });
  const el = { getBoundingClientRect: () => edited, closest: () => ({ dataset: { id: 'me' } }) };
  const list = [{ id: 'me' }, ...siblings.map((_, i) => ({ id: 's' + i }))];
  const scope = {
    $: () => rt,
    editing: { on: true, kind: 'rich', el },
    frameRect: () => ({ left: 0, top: 0 }),
    toScreen: (v: number, off: number) => v * zoom + off,
    zoomK: zoom,
    locate: () => ({ node: list[0], list }),
    selectedCanvasElement: (id: string) => id === 'me' ? null : { getBoundingClientRect: () => siblings[+id.slice(1)] },
    cwin: { innerWidth: 1200, innerHeight: 800 },
    PC_UI: { selectionToolbarPosition },
    window: { innerWidth: 1200, innerHeight: 800 },
  };
  new Function(...Object.keys(scope), placeRT + '\nplaceRT();')(...Object.values(scope));
  return { top: parseFloat(rt.style.top), left: parseFloat(rt.style.left) };
}
const overlaps = (a: { top: number; left: number }, b: R) =>
  a.left < b.right && a.left + 340 > b.left && a.top < b.bottom && a.top + 34 > b.top;

test('sits above the text when nothing is there', () => {
  const edited = rect(100, 300, 400, 40);
  const at = place(edited, []);
  expect(at.top + 34).toBeLessThanOrEqual(edited.top);
});

test('does not cover the headline right above the paragraph being edited', () => {
  const headline = rect(100, 200, 400, 90);
  const paragraph = rect(100, 300, 400, 40);
  const at = place(paragraph, [headline]);
  expect(overlaps(at, headline)).toBe(false);
  expect(overlaps(at, paragraph)).toBe(false);
});
