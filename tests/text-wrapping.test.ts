import { expect, it } from 'vitest';
import * as C from '../app/src/core/index';

it.each([true, false])('wraps long ordinary text in the %s CSS path', editing => {
  const css = C.baseCss(editing);
  expect(css).toMatch(/\.pagecraft-heading\{[^}]*overflow-wrap:break-word/);
  expect(css).toContain('.pagecraft-wysiwyg,.pagecraft-quote{overflow-wrap:break-word}');
});

it('keeps deliberate horizontal scrolling for code and tables', () => {
  const css = C.baseCss(false);
  expect(css).toContain('.pagecraft-code pre{');
  expect(css).toMatch(/\.pagecraft-code pre\{[^}]*overflow-x:auto/);
  expect(css).toMatch(/\.pagecraft-table-wrap\{width:100%;overflow-x:auto\}/);
  const codeRule = css.match(/\.pagecraft-code pre\{[^}]+\}/)?.[0] || '';
  const tableRule = css.match(/\.pagecraft-table-wrap\{[^}]+\}/)?.[0] || '';
  expect(codeRule).not.toContain('overflow-wrap:break-word');
  expect(tableRule).not.toContain('overflow-wrap:break-word');
});
