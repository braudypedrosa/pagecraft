import { beforeEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const cafeColors = (accent = '#b55637') => [
  { id: 'bg', name: 'bg', value: '#f7f1e5' },
  { id: 'paper', name: 'paper', value: '#fffaf0' },
  { id: 'ink', name: 'ink', value: '#1d3026' },
  { id: 'text', name: 'text', value: '#34463b' },
  { id: 'accent', name: 'accent', value: accent },
  { id: 'surface', name: 'surface', value: '#e8e0cf' },
  { id: 'olive', name: 'olive', value: '#31513f' },
  { id: 'muted', name: 'muted', value: '#5c645c' },
  { id: 'line', name: 'line', value: '#c9c2b2' },
];

function palette(colors = cafeColors()) {
  C.blankProject('Semantic token compatibility');
  C.state.meta.tokens = C.defaultTokens();
  C.state.meta.tokens.colors = colors;
  C.state.pages[0].title = 'Semantic token compatibility';
  C.state.pages[0].desc = 'New modules remain usable with an imported semantic palette.';
  C.state.pages[0].tree = [];
}

function onPage(node: ReturnType<typeof C.N>) {
  const section = C.N('section', {}, { d: { color: C.cvar('ink') } }, [C.cols(1, [[node]])]);
  C.state.pages[0].tree = [section];
  return node;
}

beforeEach(() => palette());

describe('missing brand semantic compatibility', () => {
  test('aliases brand to accent in generated CSS and colour resolution without changing saved tokens', () => {
    const before = JSON.stringify(C.state.meta.tokens);

    expect(C.resolveColor(C.cvar('brand'))).toBe('#b55637');
    expect(C.resolveColor(C.cvar('missing'))).toBe('');
    expect(C.tokenVars()).toContain('--c-accent:#b55637');
    expect(C.tokenVars()).toContain('--c-brand:var(--c-accent)');
    C.baseCss(false);

    expect(JSON.stringify(C.state.meta.tokens)).toBe(before);
    expect(C.state.meta.tokens!.colors.some(color => color.id === 'brand')).toBe(false);
  });

  test('new solid buttons choose an AA palette foreground while transparent variants inherit', () => {
    const before = JSON.stringify(C.state.meta.tokens);
    const button = onPage(C.N('button', { text: 'Get started', link: '/visit' }));

    expect(button.css.d['background-color']).toBe(C.cvar('brand'));
    expect(button.css.d.color).toBeUndefined();
    expect(button.css.d['--pc-solid-fg']).toBe(C.cvar('paper'));
    expect(C.contrast(C.cvar('paper'), C.cvar('brand'))).toBeGreaterThanOrEqual(4.5);
    expect(C.effectiveAt(button.id, 'color')).toBe(C.cvar('paper'));
    expect(C.lint().some(finding => finding.code === 'contrast' && finding.nodeId === button.id)).toBe(false);

    for (const variant of ['outline', 'ghost', 'link']) {
      button.props.variant = variant;
      expect(C.effectiveAt(button.id, 'color')).toBe(C.cvar('ink'));
    }

    const css = C.baseCss(false);
    expect(css).toContain('max-width:100%;color:inherit}');
    expect(css).toContain(':where(.pagecraft-button[data-variant=solid]){color:var(--pc-solid-fg,inherit)}');
    expect(JSON.stringify(C.state.meta.tokens)).toBe(before);
  });

  test('authored button colours still outrank the low-specificity semantic default', () => {
    const button = onPage(C.N('button', { text: 'Authored', link: '/visit' }, {
      d: { color: '#ffeedd', 'background-color': '#332211' }, t: {}, m: {},
    }));
    const css = C.treeCss([[C.state.pages[0].tree[0]]], false);

    expect(button.css.d['--pc-solid-fg']).toBe(C.cvar('paper'));
    expect(C.effectiveAt(button.id, 'color')).toBe('#ffeedd');
    expect(css).toContain(`.${C.nodeClass(button)}{`);
    expect(css).toContain('color:#ffeedd');
  });

  test('light accents keep ink and new forms share the readable action pairing', () => {
    palette(cafeColors('#f4c95d'));
    const lightButton = onPage(C.N('button'));
    const lightForm = C.N('form');
    expect(lightButton.css.d['--pc-solid-fg']).toBe(C.cvar('ink'));
    expect(C.effectiveAt(lightButton.id, 'color')).toBe(C.cvar('ink'));
    for (const variant of ['outline', 'ghost', 'link']) {
      lightButton.props.variant = variant;
      expect(C.effectiveAt(lightButton.id, 'color')).toBe(C.cvar('ink'));
    }
    expect(lightForm.css.d['--f-btn-bg']).toBe(C.cvar('brand'));
    expect(lightForm.css.d['--f-btn-fg']).toBe(C.cvar('ink'));

    palette();
    const darkForm = C.N('form');
    expect(darkForm.css.d['--f-btn-bg']).toBe(C.cvar('brand'));
    expect(darkForm.css.d['--f-btn-fg']).toBe(C.cvar('paper'));
  });

  test('projects with a real dark brand derive AA action defaults while transparent variants inherit', () => {
    palette([
      { id: 'text', name: 'Text', value: '#3f4943' },
      { id: 'bg', name: 'Background', value: '#f3f0e9' },
      { id: 'brand', name: 'Brand', value: '#6c472f' },
      { id: 'ink', name: 'Ink', value: '#242c27' },
      { id: 'paper', name: 'Paper', value: '#faf9f6' },
      { id: 'surface', name: 'Surface', value: '#ffffff' },
    ]);
    const before = JSON.stringify(C.state.meta.tokens);
    const button = onPage(C.N('button'));
    const form = C.N('form');

    expect(button.css.d.color).toBeUndefined();
    expect(button.css.d['--pc-solid-fg']).toBe(C.cvar('paper'));
    expect(C.effectiveAt(button.id, 'color')).toBe(C.cvar('paper'));
    expect(C.contrast(button.css.d['--pc-solid-fg'], button.css.d['background-color'])).toBeGreaterThanOrEqual(4.5);
    for (const variant of ['outline', 'ghost', 'link']) {
      button.props.variant = variant;
      expect(C.effectiveAt(button.id, 'color')).toBe(C.cvar('ink'));
    }
    expect(form.css.d['--f-btn-fg']).toBe(C.cvar('paper'));
    expect(C.contrast(form.css.d['--f-btn-fg'], form.css.d['--f-btn-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(C.tokenVars()).not.toContain('--c-brand:var(--c-accent)');
    expect(JSON.stringify(C.state.meta.tokens)).toBe(before);
  });
});
