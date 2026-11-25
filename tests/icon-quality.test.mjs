import { beforeEach, expect, test } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import * as C from '../app/src/core/index.ts';
import { PUBLISHED_GLYPHS, svg } from '../app/src/core/icons.ts';
import { install } from '../app/src/ui/ctx.ts';
import { blankDoc } from '../server/src/render.ts';

const PX = 10;
/** Painted bounds of some 24-grid markup, in grid units. */
async function bounds(body) {
  const size = 24 * PX;
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body.replaceAll('currentColor', '#000')}</svg>`;
  const { data, info } = await sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = size, top = size, right = -1, bottom = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (data[(y * size + x) * info.channels + 3] < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left: left / PX, top: top / PX, right: (right + 1) / PX, bottom: (bottom + 1) / PX,
    x: (left + right + 1) / 2 / PX, y: (top + bottom + 1) / 2 / PX };
}

beforeEach(() => {
  install(C, { dynamicContentProvider: () => 'pagecraft' });
  C.restore(blankDoc('Icons'), false);
});

test('every editor icon is centred and stays inside the visible grid', async () => {
  const problems = [];
  for (const [name, body] of Object.entries(C.IC)) {
    const b = await bounds(body);
    if (Math.abs(b.x - 12) > 0.4 || Math.abs(b.y - 12) > 0.4) problems.push(`${name} is off by ${(b.x - 12).toFixed(2)}, ${(b.y - 12).toFixed(2)}`);
    if (Math.min(b.left, b.top) < 1 || Math.max(b.right, b.bottom) > 23) problems.push(`${name} is clipped`);
  }
  expect(problems).toEqual([]);
}, 30_000);

/* A centred frame hides off-centre artwork: the Code icon sat a full unit left inside its box. */
test('artwork inside a full frame is centred across the frame', async () => {
  const problems = [];
  // Left-aligned on purpose: a picture's sun and hill, and form values that start at the left.
  const directional = new Set(['form', 'progress']);
  let checked = 0;
  for (const [name, body] of Object.entries(C.IC)) {
    if (directional.has(name)) continue;
    const frame = body.match(/^<rect x="3" y="[^"]+" width="18"[^>]*\/>/);
    const inside = frame && body.slice(frame[0].length);
    if (!inside) continue;
    checked++;
    const b = await bounds(inside);
    if (Math.abs(b.x - 12) > 0.4) problems.push(`${name} artwork is off by ${(b.x - 12).toFixed(2)}`);
  }
  expect(checked).toBeGreaterThan(8);
  expect(problems).toEqual([]);
}, 30_000);

test('the set shares one grid, weight and line finish', () => {
  for (const size of [12, 15]) expect(svg('copy', size)).toContain('stroke-width="2"');
  for (const size of [16, 20]) expect(svg('copy', size)).toContain('stroke-width="1.75"');
  expect(svg('copy', 20)).toContain(`viewBox="${C.IC_VIEW}"`);
  expect(svg('copy', 20)).toContain('stroke-linecap="round" stroke-linejoin="round"');
  for (const [name, body] of Object.entries(C.IC)) {
    expect(body, name).not.toMatch(/stroke-width|stroke-line/);
    expect(body, name).toMatch(/^<(path|rect|circle|ellipse|g)/);
  }
});

/* An unknown name draws an empty square and no error: the Add search box had one. */
test('every icon the editor names exists', async () => {
  const root = new URL('../', import.meta.url);
  const ui = (await readdir(new URL('app/src/ui', root), { recursive: true })).filter(file => file.endsWith('.tsx')).map(file => 'app/src/ui/' + file);
  const used = new Map();
  for (const file of ['builder.html', 'app/src/core/index.ts', ...ui]) {
    const source = await readFile(new URL(file, root), 'utf8');
    const patterns = [/\bsvg\('([A-Za-z]+)'/g, /<Icon\b[^>]*?\bname="([A-Za-z]+)"/g];
    for (const pattern of patterns) for (const match of source.matchAll(pattern)) used.set(match[1], file);
  }
  for (const [type, def] of Object.entries(C.DEF)) used.set(def.icon, 'DEF.' + type);
  for (const key of Object.keys(C.BASE)) used.set(C.iconOf(key), 'Add.' + key);
  expect(used.size).toBeGreaterThan(50);
  expect([...used].filter(([name]) => !C.IC[name])).toEqual([]);
});

test('no two entries in the Add panel share an icon', () => {
  const owners = {};
  const entries = [...Object.entries(C.DEF).filter(([type]) => !['column', 'box'].includes(type)), ...Object.entries(C.BASE)];
  for (const [key] of entries) (owners[C.iconOf(key)] ||= []).push(key);
  expect(Object.values(owners).filter(keys => keys.length > 1)).toEqual([]);
});

test('icons on published sites keep their original bytes', () => {
  expect(PUBLISHED_GLYPHS).toEqual({
    arrow: '<path d="M6 3.5L10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round"/>',
    check: '<path d="M3 8.5l3.2 3.2L13 5" stroke-linecap="round" stroke-linejoin="round"/>',
    plus: '<path d="M8 3v10M3 8h10" stroke-linecap="round"/>',
    caret: '<path d="M3.5 5.5L8 10l4.5-4.5" stroke-linecap="round" stroke-linejoin="round"/>'
  });
  for (const icon of ['arrow', 'check', 'plus']) {
    expect(C.renderNode(C.N('button', { icon }), { edit: false }))
      .toContain(`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${PUBLISHED_GLYPHS[icon]}</svg>`);
  }
  const slider = C.N('slider', { arrows: 1 }, {}, [C.N('column'), C.N('column')]);
  expect(C.renderNode(slider, { edit: false }))
    .toContain(`<svg class="" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">${PUBLISHED_GLYPHS.caret}</svg>`);
});
