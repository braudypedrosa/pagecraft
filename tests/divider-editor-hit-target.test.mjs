import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));

function resolver() {
  const start = source.indexOf('function canvasPointerHit(');
  const end = source.indexOf('\n\nfunction activateHudButton(', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return new Function(`${source.slice(start, end)}; return canvasPointerHit;`)();
}

function fixture() {
  const dom = new JSDOM(`<div data-id="column" data-t="column">
    <button data-id="button" data-t="button">Action</button>
    <hr data-id="divider" data-t="divider" class="pagecraft-divider">
  </div>`);
  windows.push(dom);
  const document = dom.window.document;
  const column = document.querySelector('[data-id="column"]');
  const button = document.querySelector('[data-id="button"]');
  const divider = document.querySelector('[data-id="divider"]');
  divider.getBoundingClientRect = () => ({ left: 100, right: 1300, top: 92, bottom: 93, width: 1200, height: 1 });
  return { column, button, divider };
}

test('a structural ancestor resolves to its nearby one-pixel divider', () => {
  const { column, divider } = fixture();
  const hit = resolver();
  expect(hit({ target: column, clientX: 660, clientY: 100 })).toBe(divider);
  expect(hit({ target: column, clientX: 660, clientY: 80 })).toBe(divider);
  expect(hit({ target: column, clientX: 660, clientY: 79 })).toBe(column);
  expect(hit({ target: column, clientX: 99, clientY: 92 })).toBe(column);
});

test('real child elements keep their clicks even beside a divider', () => {
  const { button } = fixture();
  expect(resolver()({ target: button, clientX: 660, clientY: 92 })).toBe(button);
});

test('the divider keeps its native markup and public geometry', () => {
  const divider = C.N('divider');
  const editing = C.renderNode(divider, { edit: true });
  const published = C.renderNode(divider, { edit: false });
  const publicRule = C.baseCss(false).match(/:where\(\.pagecraft-divider\)\{[^}]*\}/)?.[0] || '';

  expect(editing).toMatch(/^<hr\b/);
  expect(editing).toContain('data-t="divider"');
  expect(published).toMatch(/^<hr\b/);
  expect(published).not.toContain('data-t="divider"');
  expect(publicRule).toBe(':where(.pagecraft-divider){width:100%;border:0 solid transparent;border-top:1px solid var(--c-line);margin:20px 0;align-self:stretch}');
  expect(C.baseCss(false)).not.toContain('[data-t=divider].pagecraft-divider::before');
});
