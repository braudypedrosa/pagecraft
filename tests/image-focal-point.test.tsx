// @vitest-environment jsdom
/* I10: a focal point for cropped images. The control shows the whole photo with a dot to drag;
   the point is stored in object-position, per breakpoint, and lands on the <img> even when a
   caption or link wraps it. */
import { test, beforeEach, afterEach, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { parseFocal, formatFocal, keptBox } from '../app/src/ui/inspector/FocalPoint';
import { act } from 'preact/test-utils';
import { rig, type Rig } from './ui.setup';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };
let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const focal = () => C.DEF.image.controls.style.find(c => c.t === 'focal')!;
const key = (el: Element, k: string, shiftKey = false) => act(() => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
});

test('parses object-position words and percentages, falling back to the centre', () => {
  expect(parseFocal('')).toEqual({ x: 50, y: 50 });
  expect(parseFocal('74% 62%')).toEqual({ x: 74, y: 62 });
  expect(parseFocal('right center')).toEqual({ x: 100, y: 50 });
  expect(parseFocal('top right')).toEqual({ x: 100, y: 0 });
  expect(parseFocal('bottom')).toEqual({ x: 50, y: 100 });
  expect(parseFocal('120% -5%')).toEqual({ x: 100, y: 0 });
  expect(parseFocal('10px 20px')).toEqual({ x: 50, y: 50 });
  expect(formatFocal({ x: 73.6, y: 62.2 })).toBe('74% 62%');
});

test('the kept box is the part of the photo a Cover frame shows', () => {
  // 1536 x 1024 photo in a 380 x 440 frame: scaled to 660 px wide, so 57.6% of the width shows.
  const box = keptBox('cover', { w: 1536, h: 1024 }, { w: 380, h: 440 }, { x: 74, y: 62 })!;
  expect(box.width).toBeCloseTo(380 / 660, 3);
  expect(box.height).toBe(1);
  expect(box.left).toBeCloseTo((1 - 380 / 660) * .74, 3);
  expect(box.top).toBe(0);
  // None shows the photo at its own size.
  expect(keptBox('none', { w: 1000, h: 500 }, { w: 500, h: 500 }, { x: 0, y: 0 })).toEqual({ left: 0, top: 0, width: .5, height: 1 });
  expect(keptBox('cover', { w: 0, h: 0 }, { w: 1, h: 1 }, { x: 50, y: 50 })).toBeNull();
});

test('the focal point sits under Fit and shows only for fits that crop', () => {
  const style = C.DEF.image.controls.style;
  const at = style.findIndex(c => c.t === 'focal');
  expect(style[at - 1].c).toBe('object-fit');
  expect(style[at]).toMatchObject({ c: 'object-position', label: 'Focal point', r: 1 });
  const image = C.N('image');
  for (const [fit, shows] of [['cover', true], ['none', true], ['contain', false], ['fill', false], ['', false]] as const) {
    image.css.d['object-fit'] = fit;
    if (!fit) delete image.css.d['object-fit'];
    expect(!!style[at].when!(image), fit || 'unset').toBe(shows);
  }
});

test('arrow keys move the point, stay inside the photo, and never reach the editor shortcuts', () => {
  const image = C.N('image', { src: 'photo.jpg', alt: 'View' });
  r.draw(<Ctl n={image} c={focal()} />);
  const dot = r.$('.pc-focal-dot')!;
  expect(dot.getAttribute('role')).toBe('slider');
  expect(dot.getAttribute('tabindex')).toBe('0');
  expect(dot.getAttribute('aria-valuetext')).toBe('50% across, 50% down');
  let leaked = 0;
  const spy = () => { leaked++; };
  document.addEventListener('keydown', spy);
  try {
    key(dot, 'ArrowRight'); key(dot, 'ArrowRight'); key(dot, 'ArrowUp', true);
    expect(C.cssVal(image, 'object-position', true).v).toBe('52% 40%');
    key(r.$('.pc-focal-dot')!, 'End');
    expect(C.cssVal(image, 'object-position', true).v).toBe('100% 40%');
    key(r.$('.pc-focal-dot')!, 'ArrowRight');
    expect(C.cssVal(image, 'object-position', true).v).toBe('100% 40%');
    key(r.$('.pc-focal-dot')!, 'Tab');
  } finally { document.removeEventListener('keydown', spy); }
  expect(leaked).toBe(1); // only Tab bubbles on
  expect(r.$('.pc-focal-value')!.textContent).toBe('100% · 40%');
});

test('Reset returns the point to the centre', () => {
  const image = C.N('image', { src: 'photo.jpg', alt: 'View' }, { d: { 'object-fit': 'cover', 'object-position': '20% 80%' }, t: {}, m: {} });
  r.draw(<Ctl n={image} c={focal()} />);
  expect(r.$('.pc-focal-value')!.textContent).toBe('20% · 80%');
  const reset = [...r.$$('.pc-focal-row button')].find(b => b.textContent === 'Reset')!;
  r.click(reset);
  expect(image.css.d['object-position'] ?? '').toBe('');
});

test('the point is stored per breakpoint', () => {
  const image = C.N('image', { src: 'photo.jpg', alt: 'View' }, { d: { 'object-fit': 'cover', 'object-position': '74% 62%' }, t: {}, m: {} });
  C.state.ui.dev = 'mobile';
  try {
    r.draw(<Ctl n={image} c={focal()} />);
    expect(r.$('.pc-focal-value')!.textContent).toBe('74% · 62%'); // inherited from desktop
    key(r.$('.pc-focal-dot')!, 'ArrowLeft', true);
    expect(image.css.m['object-position']).toBe('64% 62%');
    expect(image.css.d['object-position']).toBe('74% 62%');
  } finally { C.state.ui.dev = 'desktop'; }
});

test.each([
  ['plain', {}],
  ['captioned', { caption: 'Breakfast' }],
  ['linked', { link: 'https://example.com' }],
])('a %s image puts object-position on the img at every breakpoint', (_label, props) => {
  const image = C.N('image', { src: 'photo.jpg', alt: 'View', ...props }, {
    d: { width: '380px', height: '440px', 'object-fit': 'cover', 'object-position': '74% 62%' }, t: {}, m: { 'object-position': '30% 50%' },
  });
  const css = C.treeCss([[image]], false);
  const cls = C.nodeClass(image);
  const wrapped = !!(props as any).caption || !!(props as any).link;
  const imgRule = wrapped ? new RegExp(`\\.${cls} \\.pagecraft-image\\{([^}]*)}`, 'g') : new RegExp(`\\.${cls}\\{([^}]*)}`, 'g');
  const rules = [...css.matchAll(imgRule)].map(m => m[1]);
  expect(rules.some(r => r.includes('object-position:74% 62%'))).toBe(true);
  expect(rules.some(r => r.includes('object-position:30% 50%'))).toBe(true);
  if (wrapped) {
    const root = [...css.matchAll(new RegExp(`\\.${cls}\\{([^}]*)}`, 'g'))].map(m => m[1]).join(';');
    expect(root).not.toContain('object-position:74%');
  }
  const dom = new JSDOM(C.renderNode(image, { edit: false }));
  expect(dom.window.document.querySelector('img.pagecraft-image')).toBeTruthy();
  dom.window.close();
});

test('live renders route the point to the img; legacy package renders keep their frozen CSS', () => {
  C.blankProject('Focal routing');
  const image = C.N('image', { src: 'photo.jpg', alt: 'View', caption: 'Breakfast' }, {
    d: { height: '440px', 'object-fit': 'cover', 'object-position': '74% 62%' }, t: {}, m: {},
  });
  C.page().tree = [image];
  const imgRule = new RegExp(`\\.${C.nodeClass(image)} \\.pagecraft-image\\{[^}]*object-position:74% 62%`);
  expect(C.buildPage(C.page(), { schemaVersion: 17 })).toMatch(imgRule);
  expect(C.buildPage(C.page())).toMatch(imgRule);
  const legacy = C.buildPage(C.page(), { schemaVersion: 15 });
  expect(legacy).not.toMatch(imgRule);
  expect(legacy).toContain('object-position:74% 62%'); // still on the figure, as frozen packages have it
  // the legacy list does not leak into the next render
  expect(C.buildPage(C.page(), { schemaVersion: 17 })).toMatch(imgRule);
});
