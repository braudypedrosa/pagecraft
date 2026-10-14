import { test, expect } from 'vitest';
import * as C from '../app/src/core/index';
import type { Node as PcNode } from '../app/src/core/types';
import { buildTemplateDocument } from '../premade-sites/neighborhood-cafe/1.0.0/source';

const LABELS = ['How Morning Field began', 'Read the full sample menu'];

function morningFieldLinks() {
  buildTemplateDocument();
  const found = new Map<string, PcNode>();
  const linked: PcNode[] = [];
  for (const tree of [C.state.header, C.state.footer, ...C.state.pages.map(page => page.tree)]) C.eachNode(tree, node => {
    const label = String(node.props.text || '');
    if (LABELS.includes(label)) found.set(label, node);
    if (node.type === 'button' && node.props.ts === 'btn') linked.push(node);
  });
  return {
    story: found.get(LABELS[0])!,
    menu: found.get(LABELS[1])!,
    linked
  };
}

function nonTypographyCss(node: PcNode) {
  return Object.fromEntries((['d', 't', 'm'] as const).map(bp => [bp,
    Object.fromEntries(Object.entries(node.css[bp]).filter(([key]) => !C.TYPO_KEYS.includes(key)))
  ]));
}

test('Morning Field padding and Button variant alone cannot update a text style', () => {
  const { story, menu } = morningFieldLinks();
  expect(C.tsUpdateFrom(menu)).toBe(true); // normalize the template's explicit local text colour

  menu.css.d['padding-top'] = '0';
  menu.css.d['padding-bottom'] = '0';
  menu.props.variant = 'link';
  const before = JSON.stringify(C.doc());

  expect(C.tsCanUpdateFrom(menu)).toBe(false);
  expect(C.tsUpdateFrom(menu)).toBe(false);
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(story.css.d['padding-top']).toBe('10px');
  expect(story.props.variant).toBe('outline');
});

test('a local typography override enables update and reaches every linked Morning Field button', () => {
  const { menu, linked } = morningFieldLinks();
  expect(C.tsUpdateFrom(menu)).toBe(true); // remove the source template's local colour override
  expect(linked.length).toBeGreaterThan(1);
  const propsBefore = structuredClone(linked.map(node => node.props));
  const lookBefore = structuredClone(linked.map(nonTypographyCss));

  menu.css.d['font-size'] = '17px';
  menu.css.t['font-weight'] = '500';
  expect(C.tsCanUpdateFrom(menu)).toBe(true);
  expect(C.tsUpdateFrom(menu)).toBe(true);

  expect(C.findStyle('btn')?.css.d['font-size']).toBe('17px');
  expect(C.findStyle('btn')?.css.t['font-weight']).toBe('500');
  expect(menu.css.d['font-size']).toBeUndefined();
  expect(menu.css.t['font-weight']).toBeUndefined();
  for (const node of linked) {
    expect(node.css.d['font-size']).toBeUndefined();
    expect(C.renderNode(node, { edit: false })).toContain('ts-btn');
  }
  expect(C.treeCss([C.state.pages[0].tree], false)).toMatch(/\.ts-btn\{[^}]*font-size:17px/);
  expect(linked.map(node => node.props)).toEqual(propsBefore);
  expect(linked.map(nonTypographyCss)).toEqual(lookBefore);
});

test('an unlinked element cannot update a text style', () => {
  const { menu } = morningFieldLinks();
  menu.props.ts = '';
  menu.css.d['font-size'] = '18px';
  const before = JSON.stringify(C.doc());

  expect(C.tsCanUpdateFrom(menu)).toBe(false);
  expect(C.tsUpdateFrom(menu)).toBe(false);
  expect(JSON.stringify(C.doc())).toBe(before);
});

test('an explicit local value equal to the shared typography remains a valid update', () => {
  const { menu } = morningFieldLinks();
  expect(C.tsUpdateFrom(menu)).toBe(true); // normalize the template's explicit local text colour
  const shared = C.findStyle('btn')!.css.d['font-size'];
  menu.css.d['font-size'] = shared;

  expect(C.tsCanUpdateFrom(menu)).toBe(true);
  expect(C.tsUpdateFrom(menu)).toBe(true);
  expect(menu.css.d['font-size']).toBeUndefined();
  expect(C.tsCanUpdateFrom(menu)).toBe(false);
});
