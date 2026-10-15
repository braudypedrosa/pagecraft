import { beforeEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };

type PaletteColor = { id: string; name: string; value: string };

function palette(colors: PaletteColor[]) {
  C.blankProject('Button brand contrast');
  C.state.meta.tokens = C.defaultTokens();
  C.state.meta.tokens.colors = colors;
  C.state.pages[0].tree = [];
}

const named = (entries: Array<[string, string]>) =>
  entries.map(([id, value]) => ({ id, name: id, value }));

function buttonRules(foreground: string) {
  const css = C.baseCss(false);
  expect(css).toContain(':where(.pagecraft-button){max-width:100%;color:inherit}');
  expect(css).toContain(':where(.pagecraft-button[data-variant=solid]){color:var(--pc-solid-fg,inherit)}');
  return css.replace('var(--pc-solid-fg,inherit)', foreground);
}

function computedButtonColor(button: ReturnType<typeof C.N>, inherited = '#31443a', extraCss = '') {
  const foreground = C.resolveColor(button.css.d['--pc-solid-fg']);
  const dom = new JSDOM(
    `<style>${buttonRules(foreground)}${extraCss}</style><div style="color:${inherited}">${C.renderNode(button, { edit: false })}</div>`,
    { pretendToBeVisual: true },
  );
  const color = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-button')!).color;
  dom.window.close();
  return color;
}

function computedSubmitColor(form: ReturnType<typeof C.N>) {
  const foreground = C.resolveColor(form.css.d['--f-btn-fg']);
  const rule = C.baseCss(false).match(/\.pagecraft-form-button\{[\s\S]*?\}/)?.[0] || '';
  expect(rule).toContain('color:var(--f-btn-fg,#fff)');
  const dom = new JSDOM(
    `<style>${rule.replace('var(--f-btn-fg,#fff)', foreground)}</style>${C.renderNode(form, { edit: false })}`,
    { pretendToBeVisual: true },
  );
  const color = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-form-button')!).color;
  dom.window.close();
  return color;
}

beforeEach(() => palette(named([
  ['text', '#111311'], ['bg', '#f8f6ef'], ['brand', '#b7f34a'], ['ink', '#111311'],
  ['muted', '#5f6660'], ['line', '#e5e1d6'], ['surface', '#ffffff'],
])));

test('bright default brand keeps the named ink foreground and transparent variants inherit', () => {
  const before = JSON.stringify(C.state.meta.tokens!.colors);
  const button = C.N('button', { text: 'Default action' });

  expect(button.css.d.color).toBeUndefined();
  expect(button.css.d['--pc-solid-fg']).toBe(C.cvar('ink'));
  expect(C.contrast(button.css.d['--pc-solid-fg'], button.css.d['background-color'])).toBeGreaterThanOrEqual(4.5);
  expect(computedButtonColor(button)).toBe('rgb(17, 19, 17)');

  for (const variant of ['outline', 'ghost', 'link']) {
    button.props.variant = variant;
    expect(computedButtonColor(button)).toBe('rgb(49, 68, 58)');
  }
  expect(JSON.stringify(C.state.meta.tokens!.colors)).toBe(before);
});

test('an explicit dark brand chooses Paper for fresh solid Buttons while authored text still wins', () => {
  palette(named([
    ['text', '#3f4943'], ['bg', '#f3f0e9'], ['brand', '#6c472f'], ['ink', '#242c27'],
    ['paper', '#faf9f6'], ['surface', '#ffffff'], ['muted', '#667069'], ['line', '#d9d2c6'],
  ]));
  const button = C.N('button', { text: 'Common Ground action' });
  const form = C.N('form', { action: 'https://forms.example.test/submit' });
  C.state.pages[0].tree = [button];

  expect(button.css.d['--pc-solid-fg']).toBe(C.cvar('paper'));
  expect(form.css.d['--f-btn-fg']).toBe(C.cvar('paper'));
  expect(C.contrast(button.css.d['--pc-solid-fg'], button.css.d['background-color'])).toBeGreaterThanOrEqual(4.5);
  expect(C.contrast(form.css.d['--f-btn-fg'], form.css.d['--f-btn-bg'])).toBeGreaterThanOrEqual(4.5);
  expect(computedButtonColor(button)).toBe('rgb(250, 249, 246)');
  expect(computedSubmitColor(form)).toBe('rgb(250, 249, 246)');

  button.css.d.color = '#ffe6a8';
  const generated = C.treeCss([C.state.pages[0].tree], false);
  const ownRule = generated.match(new RegExp(`\\.${C.nodeClass(button)}\\{[^}]*color:#ffe6a8;[^}]*\\}`))?.[0] || '';
  expect(ownRule).not.toBe('');
  expect(computedButtonColor(button, '#31443a', ownRule)).toBe('rgb(255, 230, 168)');
});

test('a missing brand resolves through accent and still selects an AA named foreground', () => {
  palette(named([
    ['text', '#34463b'], ['bg', '#f7f1e5'], ['accent', '#b55637'], ['ink', '#1d3026'],
    ['paper', '#fffaf0'], ['surface', '#e8e0cf'], ['muted', '#5c645c'], ['line', '#c9c2b2'],
  ]));
  const button = C.N('button', { text: 'Cafe action' });

  expect(C.resolveColor(C.cvar('brand'))).toBe('#b55637');
  expect(button.css.d['--pc-solid-fg']).toBe(C.cvar('paper'));
  expect(C.contrast(button.css.d['--pc-solid-fg'], button.css.d['background-color'])).toBeGreaterThanOrEqual(4.5);
  expect(computedButtonColor(button)).toBe('rgb(255, 250, 240)');
});

test('a palette with no suitable named foreground falls back deterministically and Forms use the same pairing', () => {
  palette(named([
    ['text', '#3d3d3d'], ['bg', '#444444'], ['brand', '#333333'], ['ink', '#3a3a3a'],
    ['paper', '#404040'], ['surface', '#454545'], ['muted', '#414141'], ['line', '#4a4a4a'],
  ]));
  const button = C.N('button', { text: 'Fallback action' });
  const form = C.N('form', { action: 'https://forms.example.test/submit' });

  expect(button.css.d['--pc-solid-fg']).toBe('#ffffff');
  expect(form.css.d['--f-btn-fg']).toBe('#ffffff');
  expect(C.contrast(button.css.d['--pc-solid-fg'], button.css.d['background-color'])).toBeGreaterThanOrEqual(4.5);
  expect(C.contrast(form.css.d['--f-btn-fg'], form.css.d['--f-btn-bg'])).toBeGreaterThanOrEqual(4.5);
  expect(computedButtonColor(button)).toBe('rgb(255, 255, 255)');
  expect(computedSubmitColor(form)).toBe('rgb(255, 255, 255)');
});
