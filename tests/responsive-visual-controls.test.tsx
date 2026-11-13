import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Control, Node as PcNode } from '../app/src/core/types';

beforeEach(() => {
  C.state.ui = C.initUi();
  C.state.ui.st = '';
  C.state.ui.target = '';
});

function moduleControl(type: string, property: string): Control {
  const controls = [...C.DEF[type].controls.content, ...C.DEF[type].controls.style];
  const control = controls.find(candidate => candidate.c === property);
  assert.ok(control, `${type} has a ${property} control`);
  return control;
}

function commonControl(property: string): Control {
  const control = C.COMMON_STYLE.flatMap(group => group.items)
    .find(candidate => candidate.c === property);
  assert.ok(control, `common styles have a ${property} control`);
  return control;
}

function expectResponsiveWrite(
  node: PcNode,
  control: Control,
  desktop: string,
  tablet: string,
  mobile: string,
) {
  assert.ok(control.c);
  node.css = { d: { [control.c]: desktop }, t: { [control.c]: tablet }, m: {} };
  C.state.ui.dev = 'mobile';

  assert.deepEqual(C.cssVal(node, control.c, !!control.r), { v: tablet, own: false },
    `${control.label} inherits its Tablet value on Mobile`);
  C.applyOne(node, control, mobile);
  assert.equal(node.css.d[control.c], desktop, `${control.label} preserves Desktop`);
  assert.equal(node.css.t[control.c], tablet, `${control.label} preserves Tablet`);
  assert.equal(node.css.m[control.c], mobile, `${control.label} writes Mobile`);

  C.applyOne(node, control, '');
  assert.equal(control.c in node.css.m, false, `${control.label} reset removes only Mobile`);
  assert.deepEqual(C.cssVal(node, control.c, !!control.r), { v: tablet, own: false },
    `${control.label} reset restores Tablet inheritance`);
}

test('every declared visual CSS control writes through the responsive style model', () => {
  const declarations: Array<{ owner: string; control: Control }> = [];
  for (const [type, definition] of Object.entries(C.DEF)) {
    for (const control of [...definition.controls.content, ...definition.controls.style]) {
      if (control.c) declarations.push({ owner: type, control });
    }
  }
  for (const group of C.COMMON_STYLE) {
    for (const control of group.items) if (control.c) declarations.push({ owner: group.g, control });
  }

  const global = declarations
    .filter(({ control }) => control.r !== 1)
    .map(({ owner, control }) => `${owner}:${control.c}`);
  assert.deepEqual(global, [], 'CSS-backed visual controls must not silently write Desktop from Tablet or Mobile');
});

test('Mobile visual edits preserve Desktop and Tablet values, then reset to inheritance', () => {
  const section = C.N('section');
  expectResponsiveWrite(section, commonControl('background-color'), '#f8f4ea', '#dcefd4', '#2f6f4e');
  expectResponsiveWrite(section, commonControl('background-image'),
    'url(desktop.jpg)', 'url(tablet.jpg)', 'url(mobile.jpg)');

  const form = C.N('form');
  expectResponsiveWrite(form, moduleControl('form', '--f-btn-bg'), '#111111', '#334433', '#66aa55');

  const richText = C.N('text');
  expectResponsiveWrite(richText, moduleControl('text', 'font-family'),
    "'DM Sans',sans-serif", "'Manrope',sans-serif", "'Georgia',serif");
});
