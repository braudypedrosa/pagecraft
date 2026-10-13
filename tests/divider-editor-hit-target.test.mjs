import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import * as C from '../app/src/core/index';

const source = readFileSync('builder.html', 'utf8');

test('the canvas adds a divider hit target only while editing', () => {
  const start = source.indexOf('const DIVIDER_EDITOR_HIT_CSS =');
  const end = source.indexOf('\n\nfunction paintCss()', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const canvasCss = new Function('treeCss', 'assetsToBlob',
    `${source.slice(start, end)}; return canvasCss;`)(
      (_sets, editing) => editing ? 'edit-css' : 'public-css',
      value => value
    );

  const editCss = canvasCss([], true);
  expect(editCss).toContain('edit-css');
  expect(editCss).toMatch(/\[data-t=divider\]\.pagecraft-divider::before\{/);
  expect(editCss).toMatch(/position:absolute/);
  expect(editCss).toMatch(/inset:-12px 0/);
  expect(canvasCss([], false)).toBe('public-css');
});

test('the divider keeps its native markup and public geometry', () => {
  const divider = C.N('divider');
  const editing = C.renderNode(divider, { edit: true });
  const published = C.renderNode(divider, { edit: false });
  const publicRule = C.baseCss(false).match(/\.pagecraft-divider\{[^}]*\}/)?.[0] || '';

  expect(editing).toMatch(/^<hr\b/);
  expect(editing).toContain('data-t="divider"');
  expect(published).toMatch(/^<hr\b/);
  expect(published).not.toContain('data-t="divider"');
  expect(publicRule).toBe('.pagecraft-divider{width:100%;border:0 solid transparent;align-self:stretch}');
  expect(C.baseCss(false)).not.toContain('[data-t=divider].pagecraft-divider::before');
});
