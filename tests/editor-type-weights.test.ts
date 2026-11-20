/* K3: editor chrome type keeps one weight per role — 400 text, 500 labels and controls,
   600 headings and column heads — on the five size tokens. No 9 px capitals, no 700s. */
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const html = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const firstClose = html.indexOf('</style>');
const chrome = html.slice(0, html.indexOf('</style>', firstClose + 1) + 8);
const rules = [...chrome.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
const workspace = readFileSync(new URL('../shared/workspace-styles.js', import.meta.url), 'utf8');

test('editor chrome sets no bold (700) weights and no text below the 13 px token', () => {
  const bold = rules.filter(r => /font-weight:\s*(700|800|bold)|font:\s*(700|800)\b/.test(r.body)).map(r => r.sel);
  expect(bold).toEqual([]);
  const tiny = rules.filter(r => /font-size:\s*(\d|1[0-2])(\.\d+)?px/.test(r.body)).map(r => r.sel);
  expect(tiny).toEqual([]);
});

test('13 px labels are 500, not 600', () => {
  const small = rules.filter(r => /font-size:var\(--fs-[12]\)|font:\s*\d+ var\(--fs-[12]\)/.test(r.body));
  expect(small.length).toBeGreaterThan(20);
  expect(small.filter(r => /font-weight:\s*600|font:\s*600/.test(r.body)).map(r => r.sel)).toEqual([]);
});

test('editor workspace and dialog titles are 600', () => {
  expect(chrome).toContain('#modalBox.workspace #mTitle{font-size:22px;line-height:1.3;font-weight:600}');
  expect(chrome).toMatch(/\.pw-head h1\{[^}]*font-size:var\(--pc-workspace-title\)[^}]*font-weight:600/);
  expect(chrome).toMatch(/\.docname b\{font-weight:600\}/);
  expect(workspace).toContain(':is(.pages-workspace,.cms-workspace) .pc-workspace-head h1{font-weight:600}');
  expect(workspace).toContain('.project-settings #mTitle{font-size:var(--pc-workspace-title);line-height:1.3;font-weight:600}');
});

test('the rail groups are dividers without text', () => {
  expect(html).toContain('<span class="railGroup" aria-hidden="true"></span>');
  expect(html).toContain('<span class="railGroup manage" aria-hidden="true"></span>');
});
