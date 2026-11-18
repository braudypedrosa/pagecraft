import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';

const builder = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const source = builder.match(/^const startingDevice = .*;$/m)?.[0];

/* The decision, evaluated against a window whose `(max-width: 1024px)` query answers `narrow`. */
function startingDevice(narrow, { matchMedia = true } = {}) {
  const queries = [];
  const window = matchMedia ? { matchMedia: query => { queries.push(query); return { matches: narrow && query === '(max-width: 1024px)' }; } } : {};
  const fn = new Function('window', `${source}; return startingDevice;`)(window);
  return { fn, queries };
}

test('the starting-device rule exists', () => {
  expect(source).toBeTruthy();
});

test('on a tablet-sized window the editor starts on the Tablet canvas', () => {
  const { fn, queries } = startingDevice(true);
  expect(fn('desktop')).toBe('tablet');
  expect(queries).toEqual(['(max-width: 1024px)']);
});

test('on a desktop window the editor still starts on the Desktop canvas', () => {
  expect(startingDevice(false).fn('desktop')).toBe('desktop');
  expect(startingDevice(false, { matchMedia: false }).fn('desktop')).toBe('desktop');
});

test('a device someone already chose is never replaced', () => {
  expect(startingDevice(true).fn('mobile')).toBe('mobile');
  expect(startingDevice(true).fn('tablet')).toBe('tablet');
});

test('boot applies the rule once, before the first setDev, and nowhere on resize', () => {
  expect(builder).toMatch(/renderPalette\(\);\n  state\.ui\.dev = startingDevice\(state\.ui\.dev\);\n  setDev\(state\.ui\.dev\);/);
  expect(builder.match(/startingDevice\(/g)).toHaveLength(1);
});
