import { beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import * as C from '../app/src/core/index';

const color = (id: string) => C.state.meta.tokens!.colors.find(token => token.id === id)!;

function fresh() {
  C.blankProject('Header contrast');
  C.state.meta.tokens = C.defaultTokens();
  C.state.ui = C.initUi();
  C.state.ui.mode = 'header';
  C.state.header = [];
  C.state.footer = [];
  C.state.pages[0].title = 'Header contrast';
  C.state.pages[0].desc = 'Header contrast test page.';
}

function insertHeaderAction() {
  const tokensBefore = JSON.stringify(C.state.meta.tokens);
  const header = C.patternInsert('header-cta', null, 0)!;
  let action: ReturnType<typeof C.N> | null = null;
  C.eachNode([header], node => { if (node.type === 'button' && node.props.text === 'Get started') action = node; });
  assert.ok(action);
  assert.equal(JSON.stringify(C.state.meta.tokens), tokensBefore, 'building a preset does not rewrite the saved palette');
  return action;
}

function assertPublishedContrast(action: ReturnType<typeof C.N>, expectedForeground: string) {
  const background = action.css.d['background-color'];
  const foreground = action.css.d.color;
  assert.equal(background, C.cvar('brand'));
  assert.equal(foreground, expectedForeground);
  assert.ok(C.contrast(foreground, background)! >= 4.5, 'small action text meets WCAG AA');
  assert.equal(action.props.text, 'Get started');
  assert.equal(action.props.link, '', 'the starter action keeps its existing destination default');

  const html = C.buildPage(C.page());
  assert.ok(html.includes(`background-color:${C.cvar('brand')};color:${expectedForeground}`),
    'the selected palette references reach the published CSS');
  assert.equal(C.lint().some(finding => finding.code === 'contrast' && finding.nodeId === action.id), false,
    'publication review accepts the resulting action contrast');
}

beforeEach(fresh);

test('header action keeps the default semantic brand and ink pairing when it passes', () => {
  const action = insertHeaderAction();
  assertPublishedContrast(action, C.cvar('ink'));
});

test('header action chooses a light palette token on a dark brand, then a safe literal fallback', () => {
  color('brand').value = '#6d342a';
  color('ink').value = '#462822';
  color('surface').value = '#e9e0d3';
  color('bg').value = '#f8f5ef';
  const themed = insertHeaderAction();
  assertPublishedContrast(themed, C.cvar('surface'));

  fresh();
  color('brand').value = '#24140f';
  color('ink').value = '#160d0a';
  C.state.meta.tokens!.colors = C.state.meta.tokens!.colors.filter(token => !['surface', 'bg'].includes(token.id));
  const fallback = insertHeaderAction();
  assertPublishedContrast(fallback, '#ffffff');
});
