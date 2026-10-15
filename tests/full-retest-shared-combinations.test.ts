import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Node as PcNode } from '../app/src/core/types';

const jsonRoundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const mediaBlocks = (css: string) => {
  const tabletAt = css.indexOf(C.MQ.t);
  const mobileAt = css.indexOf(C.MQ.m);
  return {
    base: css.slice(0, tabletAt < 0 ? (mobileAt < 0 ? undefined : mobileAt) : tabletAt),
    tablet: tabletAt < 0 ? '' : css.slice(tabletAt, mobileAt < 0 ? undefined : mobileAt),
    mobile: mobileAt < 0 ? '' : css.slice(mobileAt),
  };
};

const ruleBody = (css: string, selector: string) => {
  const start = css.indexOf(`${selector}{`);
  return start < 0 ? '' : css.slice(start + selector.length + 1, css.indexOf('}', start));
};

const button = (text: string, css: PcNode['css']) => {
  const node = C.N('button', { text, ts: 'btn', variant: 'outline' });
  node.css = css;
  return node;
};

beforeEach(() => {
  C.blankProject('Shared combinations retest');
  C.state.ui = C.initUi();
  C.state.meta.components = [];
  C.ensureTokens().classes = [];
});

test('button typography update crosses page and component boundaries while class, local, responsive and state precedence survives save/load', () => {
  const source = button('Edit source', {
    d: {
      'font-size': '19px', 'font-weight': '600', color: C.cvar('paper'),
      'background-color': '#7a2f24', 'border-radius': '14px', 'padding-left': '22px',
    },
    t: { 'letter-spacing': '.03em', 'padding-left': '18px' },
    m: { 'line-height': '1.25', 'padding-left': '14px' },
  });
  const peer = button('Linked page button', {
    d: { 'background-color': '#244f3d', 'border-radius': '9px', 'padding-left': '25px' },
    t: { 'padding-left': '20px' },
    m: { 'border-radius': '5px' },
  });
  const componentButton = button('Linked component button', {
    d: { 'background-color': '#22345c', 'border-radius': '18px', 'padding-left': '27px' },
    t: { 'padding-left': '21px' },
    m: { 'border-radius': '7px' },
  });

  const classId = C.classAdd('Campaign action');
  C.classApply(peer, classId);
  C.classApply(componentButton, classId);
  C.state.ui.target = classId;
  const editClass = (dev: 'desktop' | 'tablet' | 'mobile', state: '' | 'hover' | 'focus', values: Record<string, string>) => {
    C.state.ui.dev = dev;
    C.state.ui.st = state;
    for (const [property, value] of Object.entries(values)) C.setCss(C.tgtObj(peer), property, value, true);
  };
  editClass('desktop', '', {
    'background-color': '#171b1a', 'border-width': '2px', 'border-color': '#f0d8a8',
  });
  editClass('tablet', '', { 'padding-left': '16px', 'padding-right': '16px' });
  editClass('mobile', '', { 'border-radius': '3px' });
  editClass('desktop', 'hover', { transform: 'translateY(-2px)', opacity: '.92' });
  editClass('tablet', 'hover', { transform: 'translateY(-1px)' });
  editClass('mobile', 'hover', { opacity: '.84' });
  editClass('desktop', 'focus', { 'outline-width': '3px', 'outline-color': '#f0d8a8' });
  peer.st = { hover: { d: { transform: 'translateY(-4px)' }, t: {}, m: {} } };

  const definitionRoot = C.N('box', { layout: 'flex' }, {}, [componentButton]);
  C.state.meta.components!.push({ id: 'action-card', name: 'Action card', node: definitionRoot, props: [] });
  const instance = C.N('box', { layout: 'flex' });
  instance.use = 'action-card';
  C.state.pages[0].tree = [C.N('section', {}, {}, [C.cols(1, [[source, peer, instance]])])];

  const before = C.treeCss([C.state.pages[0].tree], false);
  expect(before).toMatch(/\.ts-btn\{[^}]*font-size:15px/);
  expect(C.tsUsage('btn')).toBe(3);
  expect(C.tsUpdateFrom(source)).toBe(true);

  expect(C.findStyle('btn')!.css).toMatchObject({
    d: { 'font-size': '19px', 'font-weight': '600', color: C.cvar('paper') },
    t: { 'letter-spacing': '.03em' },
    m: { 'line-height': '1.25' },
  });
  expect(source.css).toEqual({
    d: { 'background-color': '#7a2f24', 'border-radius': '14px', 'padding-left': '22px' },
    t: { 'padding-left': '18px' },
    m: { 'padding-left': '14px' },
  });
  expect(peer.css.d).toMatchObject({
    'background-color': '#244f3d', 'border-radius': '9px', 'padding-left': '25px',
  });
  expect(componentButton.css.d).toMatchObject({
    'background-color': '#22345c', 'border-radius': '18px', 'padding-left': '27px',
  });

  const saved = jsonRoundTrip(C.migrate(jsonRoundTrip(C.doc()))!);
  C.blankProject('Discarded working state');
  C.restore(saved);
  expect(jsonRoundTrip(C.doc())).toEqual(saved);

  const restoredSource = C.locateAny(source.id)!.node;
  const restoredPeer = C.locateAny(peer.id)!.node;
  const restoredDefinitionButton = C.findComponent('action-card')!.node.children[0];
  const restoredInstance = C.locateAny(instance.id)!.node;
  const css = C.treeCss([C.state.pages[0].tree], false);
  const blocks = mediaBlocks(css);

  expect(blocks.base).toMatch(/\.ts-btn\{[^}]*font-size:19px[^}]*font-weight:600[^}]*color:var\(--c-paper\)/);
  expect(blocks.tablet).toMatch(/\.ts-btn\{[^}]*letter-spacing:\.03em/);
  expect(blocks.mobile).toMatch(/\.ts-btn\{[^}]*line-height:1\.25/);
  const desktopClassButton = ruleBody(blocks.base, `.c-${classId}.pagecraft-button`);
  expect(desktopClassButton).toContain('background-color:#171b1a');
  expect(desktopClassButton).toContain('border-width:2px');
  expect(desktopClassButton).toContain('border-color:#f0d8a8');
  expect(ruleBody(blocks.tablet, `.c-${classId}.pagecraft-button`)).toMatch(/padding-left:16px;.*padding-right:16px/);
  expect(ruleBody(blocks.mobile, `.c-${classId}.pagecraft-button`)).toContain('border-radius:3px');
  expect(blocks.base).toContain(`.c-${classId}:hover{transform:translateY(-2px);opacity:.92;}`);
  expect(blocks.tablet).toContain(`.c-${classId}:hover{transform:translateY(-1px);}`);
  expect(blocks.mobile).toContain(`.c-${classId}:hover{opacity:.84;}`);
  expect(blocks.base).toContain(`.c-${classId}:focus-visible{outline-width:3px;outline-color:#f0d8a8;}`);

  const peerClassRule = blocks.base.indexOf(`.c-${classId}.pagecraft-button{`);
  const peerElementRule = blocks.base.indexOf(`.${C.nodeClass(restoredPeer)}.pagecraft-button{`);
  const peerClassHover = blocks.base.indexOf(`.c-${classId}:hover{`);
  const peerElementHover = blocks.base.indexOf(`.${C.nodeClass(restoredPeer)}:hover{`);
  expect(peerClassRule).toBeGreaterThan(-1);
  expect(peerElementRule).toBeGreaterThan(peerClassRule);
  expect(peerClassHover).toBeGreaterThan(-1);
  expect(peerElementHover).toBeGreaterThan(peerClassHover);
  expect(blocks.base.slice(peerElementRule, blocks.base.indexOf('}', peerElementRule))).toContain('background-color:#244f3d');
  expect(blocks.base.slice(peerElementHover, blocks.base.indexOf('}', peerElementHover))).toContain('transform:translateY(-4px)');

  for (const node of [restoredSource, restoredPeer, restoredDefinitionButton]) {
    expect(C.renderNode(node, { edit: false })).toContain('ts-btn');
  }
  const componentHtml = C.renderNode(restoredInstance, { edit: false });
  expect(componentHtml).toContain('Linked component button');
  expect(componentHtml).toContain('ts-btn');
  expect(componentHtml).toContain(`c-${classId}`);
  expect(restoredDefinitionButton.css.d['background-color']).toBe('#22345c');
});
