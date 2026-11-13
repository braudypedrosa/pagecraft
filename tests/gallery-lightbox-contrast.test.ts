import { describe, expect, test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const css = C.baseCss(false);
const lightboxControl = '.pagecraft-lightbox .pagecraft-lightbox-btn';
const lightboxStructure = '.pagecraft-lightbox-btn';

function declarations(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`));
  expect(match, `${selector} should have an emitted CSS rule`).not.toBeNull();
  return match![1];
}

function rgba(value: string): [number, number, number, number] {
  const match = value.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  expect(match, `${value} should be an rgba colour`).not.toBeNull();
  return [Number(match![1]), Number(match![2]), Number(match![3]), Number(match![4])];
}

function composite([red, green, blue, alpha]: [number, number, number, number], base: number) {
  return [red, green, blue].map(channel => channel * alpha + base * (1 - alpha));
}

function luminance(rgb: number[]): number {
  const linear = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: number[], second: number[]): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Gallery lightbox control contrast', () => {
  test.each([
    ['resting', lightboxControl],
    ['hover', `${lightboxControl}:hover`],
  ])('%s control stays legible over the brightest and darkest image pixels', (_state, selector) => {
    const rule = declarations(selector);
    const background = rgba(rule.match(/background:([^;]+)/)![1]);
    const white = [255, 255, 255];

    for (const imagePixel of [0, 255]) {
      expect(contrast(white, composite(background, imagePixel))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('controls preserve their touch target and use a two-tone keyboard focus indicator', () => {
    const control = declarations(lightboxStructure);
    expect(control).toContain('width:46px');
    expect(control).toContain('height:46px');

    const focus = declarations(`${lightboxControl}:focus-visible`);
    expect(focus).toMatch(/outline:\d+px solid #fff/);
    const outerRing = rgba(focus.match(/box-shadow:[^;]*?(rgba\([^)]+\))/)![1]);
    expect(contrast([255, 255, 255], [0, 0, 0])).toBeGreaterThanOrEqual(3);
    expect(contrast([255, 255, 255], composite(outerRing, 255))).toBeGreaterThanOrEqual(3);
  });

  test('scoped controls outrank later historical control rules in every interactive state', () => {
    type Candidate = { selector: string; value: string; order: number };
    const specificity = (selector: string) => [
      (selector.match(/#[\w-]+/g) || []).length,
      (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length,
      0,
    ];
    const winner = (rules: Candidate[]) => rules.reduce((best, rule) => {
      const next = specificity(rule.selector);
      const prior = specificity(best.selector);
      for (let index = 0; index < next.length; index++) {
        if (next[index] !== prior[index]) return next[index] > prior[index] ? rule : best;
      }
      return rule.order > best.order ? rule : best;
    });
    const root = '.pagecraft-root ';
    const scoped = root + lightboxControl;
    const legacy = root + '.pagecraft-lightbox-btn';

    expect(winner([
      { selector: scoped, value: 'current resting', order: 0 },
      { selector: legacy, value: 'historical resting', order: 1 },
    ]).value).toBe('current resting');
    expect(winner([
      { selector: scoped, value: 'current resting', order: 0 },
      { selector: `${scoped}:hover`, value: 'current hover', order: 1 },
      { selector: legacy, value: 'historical resting', order: 2 },
      { selector: `${legacy}:hover`, value: 'historical hover', order: 3 },
    ]).value).toBe('current hover');
    expect(winner([
      { selector: scoped, value: 'current resting', order: 0 },
      { selector: `${scoped}:focus-visible`, value: 'current keyboard focus', order: 1 },
      { selector: legacy, value: 'historical resting', order: 2 },
      { selector: `${legacy}:focus-visible`, value: 'historical keyboard focus', order: 3 },
    ]).value).toBe('current keyboard focus');
  });

  test('historical CSS appended later cannot move Close or reveal a hidden control', () => {
    const historicalCss = `
.pagecraft-lightbox-btn{
  position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;
  display:grid;place-items:center;border:0;border-radius:50%;cursor:pointer;
  background:rgba(255,255,255,.14);color:#fff;font:400 22px/1 system-ui,sans-serif;
}
.pagecraft-lightbox-btn:hover{background:rgba(255,255,255,.26);color:#fff}
.pagecraft-lightbox-close{position:absolute;top:14px;right:14px;transform:none}
.pagecraft-lightbox-btn[hidden]{display:none}
.pagecraft-lightbox-btn:focus-visible{outline:3px solid currentColor;outline-offset:3px}`;
    const dom = new JSDOM(`<style>${css}${historicalCss}</style>
      <dialog class="pagecraft-lightbox">
        <button class="pagecraft-lightbox-btn pagecraft-lightbox-close">Close</button>
        <button class="pagecraft-lightbox-btn pagecraft-lightbox-prev" hidden>Previous</button>
      </dialog>`);
    const close = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-lightbox-close')!);
    const previous = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-lightbox-prev')!);

    expect(close.top).toBe('14px');
    expect(close.right).toBe('14px');
    expect(close.transform).toBe('none');
    expect(close.width).toBe('46px');
    expect(close.height).toBe('46px');
    expect(close.backgroundColor).toBe('rgba(10, 12, 10, 0.72)');
    expect(previous.display).toBe('none');
  });
});
