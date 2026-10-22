import { describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const css = C.baseCss(false);

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
    ['resting', '.pagecraft-lightbox-btn'],
    ['hover', '.pagecraft-lightbox-btn:hover'],
  ])('%s control stays legible over the brightest and darkest image pixels', (_state, selector) => {
    const rule = declarations(selector);
    const background = rgba(rule.match(/background:([^;]+)/)![1]);
    const white = [255, 255, 255];

    for (const imagePixel of [0, 255]) {
      expect(contrast(white, composite(background, imagePixel))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('controls preserve their touch target and use a two-tone keyboard focus indicator', () => {
    const control = declarations('.pagecraft-lightbox-btn');
    expect(control).toContain('width:46px');
    expect(control).toContain('height:46px');

    const focus = declarations('.pagecraft-lightbox-btn:focus-visible');
    expect(focus).toMatch(/outline:\d+px solid #fff/);
    const outerRing = rgba(focus.match(/box-shadow:[^;]*?(rgba\([^)]+\))/)![1]);
    expect(contrast([255, 255, 255], [0, 0, 0])).toBeGreaterThanOrEqual(3);
    expect(contrast([255, 255, 255], composite(outerRing, 255))).toBeGreaterThanOrEqual(3);
  });
});
