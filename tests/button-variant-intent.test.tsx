// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Control, Node as PcNode } from '../app/src/core/types';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };
const marker = (property: string) => `--pc-button-variant-owns-${property}`;
const authoredMarker = (property: string) => `--pc-authored-button-${property}`;
const variantControl = C.DEF.button.controls.content.find(control => control.k === 'variant') as Control;

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function cafeButton() {
  const button = C.insert('button', null, C.tree().length)!;
  button.props.text = 'See today’s menu';
  button.props.variant = 'solid';
  button.css = {
    d: {
      padding: '14px 22px', 'min-height': '48px', 'border-radius': '6px',
      'border-width': '0', 'border-color': '#1d3026', 'background-color': '#b55637',
      color: '#fffaf0', 'align-self': 'start'
    },
    t: { 'background-color': '#a34f31' },
    m: { 'border-top-width': '4px', 'padding-left': '18px' }
  };
  button.st = { hover: { d: { 'background-color': '#8f4329' }, t: {}, m: {} } };
  return button;
}

function styleOf(button: PcNode) {
  const dom = new JSDOM(`<style>${C.treeCss([[button]], false)}</style>${C.renderNode(button, { edit: false })}`,
    { pretendToBeVisual: true });
  const style = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-button')!);
  return { style, close: () => dom.window.close() };
}

function buttonBridge(button: PcNode, breakpoint: 'd' | 't' | 'm') {
  const css = C.bucket(button, breakpoint, false);
  const selector = `.${C.nodeClass(button)}.pagecraft-button{`;
  const start = css.indexOf(selector);
  return start < 0 ? '' : css.slice(start + selector.length, css.indexOf('}', start));
}

const mediaBlocks = (css: string) => {
  const tabletAt = css.indexOf(C.MQ.t);
  const mobileAt = css.indexOf(C.MQ.m);
  return {
    base: css.slice(0, tabletAt < 0 ? (mobileAt < 0 ? undefined : mobileAt) : tabletAt),
    tablet: tabletAt < 0 ? '' : css.slice(tabletAt, mobileAt < 0 ? undefined : mobileAt),
    mobile: mobileAt < 0 ? '' : css.slice(mobileAt),
  };
};

const responsiveRules = (css: string, breakpoint: 'd' | 't' | 'm', selectors: string[]) => {
  const blocks = mediaBlocks(css);
  const active = [blocks.base, ...(breakpoint === 'd' ? [] : [blocks.tablet]),
    ...(breakpoint === 'm' ? [blocks.mobile] : [])];
  return active.flatMap(block => [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)])
    .filter(([, selector]) => selectors.some(candidate => selector.trim().startsWith(candidate)))
    .map(([, selector, body]) => `${selector.trim()}{${body}}`).join('');
};

const responsiveStyleOf = (button: PcNode, breakpoint: 'd' | 't' | 'm') => {
  const css = responsiveRules(C.treeCss([[button]], false), breakpoint,
    ['.pagecraft-button', `.${C.nodeClass(button)}`]);
  const dom = new JSDOM(`<style>${css}</style>${C.renderNode(button, { edit: false })}`,
    { pretendToBeVisual: true });
  const style = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-button')!);
  return { style, close: () => dom.window.close() };
};

const intentMarkers = (button: PcNode) => (['d', 't', 'm'] as const)
  .flatMap(b => Object.keys(button.css[b]).filter(property => property.startsWith('--pc-button-variant-owns-')));

describe('Button Variant intent', () => {
  test('the real Variant select changes a café-styled Button and Solid restores every stored style', () => {
    const button = cafeButton();
    const stored = C.clone(button.css);
    C.selSet([button.id]);
    r.draw(() => <Ctl n={button} c={variantControl} />, 'right');

    act(() => r.pick(r.$('select')!, 'outline'));
    expect(button.props.variant).toBe('outline');
    expect(button.css.d).toMatchObject({
      'background-color': '#b55637', 'border-width': '0', 'border-color': '#1d3026',
      padding: '14px 22px', 'border-radius': '6px',
      [marker('background-color')]: '1', [marker('border-width')]: '1', [marker('border-color')]: '1'
    });
    expect(button.css.d).not.toHaveProperty(marker('padding'));
    expect(button.css.d).not.toHaveProperty(marker('border-radius'));
    const outline = styleOf(button);
    expect(outline.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(outline.style.borderTopWidth).toBe('1px');
    expect(outline.style.paddingTop).toBe('14px');
    expect(outline.style.borderRadius).toBe('6px');
    outline.close();

    act(() => r.pick(r.$('select')!, 'ghost'));
    expect(button.css.d[marker('background-color')]).toBe('1');
    expect(button.css.d[marker('border-color')]).toBe('1');
    expect(button.css.d).not.toHaveProperty(marker('border-width'));
    expect(button.css.d).not.toHaveProperty(marker('padding'));
    const ghost = styleOf(button);
    expect(ghost.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(ghost.style.borderTopColor).toBe('rgba(0, 0, 0, 0)');
    expect(ghost.style.paddingTop).toBe('14px');
    expect(ghost.style.borderRadius).toBe('6px');
    ghost.close();

    act(() => r.pick(r.$('select')!, 'link'));
    const link = styleOf(button);
    expect(link.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(link.style.borderTopWidth).toBe('0px');
    expect(link.style.paddingTop).toBe('0px');
    expect(link.style.borderRadius).toBe('0px');
    link.close();

    act(() => r.pick(r.$('select')!, 'solid'));
    expect(button.props.variant).toBe('solid');
    expect(intentMarkers(button)).toEqual([]);
    expect(button.css).toEqual(stored);
    const solid = styleOf(button);
    expect(solid.style.backgroundColor).toBe('rgb(181, 86, 55)');
    expect(solid.style.borderTopWidth).toBe('0px');
    expect(solid.style.paddingTop).toBe('14px');
    expect(solid.style.borderRadius).toBe('6px');
    solid.close();
    expect(r.names()).toContain('save');
  });

  test('responsive intent suppresses only properties owned by the chosen variant and Style takes one back', () => {
    const button = cafeButton();
    C.applyC(button, { k: 'variant' }, 'outline');

    expect(buttonBridge(button, 'd')).not.toMatch(/background-color|border-width|border-color/);
    expect(buttonBridge(button, 'd')).toContain('padding:14px 22px');
    expect(buttonBridge(button, 'd')).toContain('border-radius:6px');
    expect(buttonBridge(button, 't')).not.toContain('background-color:#a34f31');
    expect(buttonBridge(button, 'm')).not.toContain('border-top-width:4px');
    expect(buttonBridge(button, 'm')).toContain('padding-left:18px');
    expect(C.bucket(button, 'd', false)).toContain(':hover{background-color:#8f4329;}');

    C.state.ui.dev = 'tablet'; C.state.ui.st = '';
    C.applyC(button, { c: 'background-color', r: 1 }, '#abcdef');
    expect(button.css.t).not.toHaveProperty(marker('background-color'));
    expect(button.css.d[marker('background-color')]).toBe('1');
    expect(buttonBridge(button, 't')).toContain('background-color:#abcdef');

    C.applyC(button, { k: 'variant' }, 'link');
    expect(button.css.m[marker('padding-left')]).toBe('1');
    C.state.ui.dev = 'mobile';
    C.setCss(button, 'padding-left', '21px', true);
    expect(button.css.m).not.toHaveProperty(marker('padding-left'));
    expect(buttonBridge(button, 'm')).toContain('padding-left:21px');
    expect(button.css.d[marker('padding')]).toBe('1');
  });

  test('a later Style write equal to the factory default still overrides the chosen Variant', () => {
    const button = cafeButton();
    C.applyC(button, { k: 'variant' }, 'outline');
    C.state.ui.dev = 'desktop'; C.state.ui.st = '';
    C.applyC(button, { c: 'background-color', r: 1 }, 'var(--c-brand)');

    expect(button.css.d).not.toHaveProperty(marker('background-color'));
    expect(button.css.d[authoredMarker('background-color')]).toBe('1');
    expect(buttonBridge(button, 'd')).toContain('background-color:var(--c-brand)');
    const authored = styleOf(button);
    expect(authored.style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    authored.close();

    C.applyC(button, { c: 'background-color', r: 1 }, '');
    expect(button.css.d).not.toHaveProperty(authoredMarker('background-color'));
    expect(buttonBridge(button, 'd')).not.toContain('background-color');
    const cleared = styleOf(button);
    expect(cleared.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    cleared.close();
  });

  test('multi-select, Undo, Redo and serialization retain intent without emitting marker CSS', () => {
    const first = cafeButton(), second = cafeButton();
    second.css.d['background-color'] = '#31513f';
    C.selSet([first.id, second.id]);
    const before = C.clone(C.doc());

    C.edit(() => C.applyC(first, { k: 'variant' }, 'outline'), 'Change Button variants');
    const after = C.clone(C.doc());
    for (const id of [first.id, second.id]) {
      const node = C.locate(id)!.node;
      expect(node.props.variant).toBe('outline');
      expect(node.css.d[marker('background-color')]).toBe('1');
    }
    C.undo(); expect(C.doc()).toEqual(before);
    C.redo(); expect(C.doc()).toEqual(after);

    C.restore(JSON.parse(JSON.stringify(after)));
    const restored = C.locate(first.id)!.node;
    const css = C.treeCss([C.tree()], false);
    expect(restored.css.d[marker('background-color')]).toBe('1');
    expect(css).not.toContain('--pc-button-variant-owns-');

    C.copyStyles(restored.id);
    expect(JSON.stringify(C.styleClip.css)).not.toContain('--pc-button-variant-owns-');
    const target = C.insert('button', null, C.tree().length)!;
    expect(C.pasteStyles(target.id)).toBe(true);
    expect(JSON.stringify(target.css)).not.toContain('--pc-button-variant-owns-');
  });

  test('Copy styles materializes the visible variant surface without changing the source round trip', () => {
    const source = cafeButton();
    C.applyC(source, { k: 'variant' }, 'outline');
    const stored = C.clone(source.css);
    const before = styleOf(source);
    const beforeMobile = responsiveStyleOf(source, 'm');
    const expected = {
      backgroundColor: before.style.backgroundColor,
      backgroundImage: before.style.backgroundImage,
      borderTopWidth: before.style.borderTopWidth,
      borderTopStyle: before.style.borderTopStyle,
      borderTopColor: before.style.borderTopColor,
      paddingTop: before.style.paddingTop,
      borderRadius: before.style.borderRadius,
    };
    const expectedMobile = {
      borderTopWidth: beforeMobile.style.borderTopWidth,
      paddingLeft: beforeMobile.style.paddingLeft,
    };
    before.close();
    beforeMobile.close();

    expect(C.copyStyles(source.id)).toBe(true);
    expect(C.styleClip.css!.d).toMatchObject({
      'background-color': 'transparent',
      'border-top-width': '1px', 'border-right-width': '1px',
      'border-bottom-width': '1px', 'border-left-width': '1px',
      'border-top-color': 'currentColor',
    });
    expect(JSON.stringify(C.styleClip.css)).not.toContain('--pc-button-variant-owns-');
    expect(C.styleClip.css!.m['border-top-width']).toBe('1px');
    expect(source.css).toEqual(stored);

    const target = C.insert('button', null, C.tree().length)!;
    expect(target.props.variant).toBe('solid');
    expect(C.pasteStyles(target.id)).toBe(true);
    const after = styleOf(target);
    expect({
      backgroundColor: after.style.backgroundColor,
      backgroundImage: after.style.backgroundImage,
      borderTopWidth: after.style.borderTopWidth,
      borderTopStyle: after.style.borderTopStyle,
      borderTopColor: after.style.borderTopColor,
      paddingTop: after.style.paddingTop,
      borderRadius: after.style.borderRadius,
    }).toEqual(expected);
    after.close();
    const afterMobile = responsiveStyleOf(target, 'm');
    expect({
      borderTopWidth: afterMobile.style.borderTopWidth,
      paddingLeft: afterMobile.style.paddingLeft,
    }).toEqual(expectedMobile);
    afterMobile.close();
    expect(source.css).toEqual(stored);
    expect(source.css.d['background-color']).toBe('#b55637');
    expect(source.css.d[marker('background-color')]).toBe('1');
  });

  test('Copy styles preserves later desktop and tablet backgrounds beside remaining border intent', () => {
    const source = cafeButton();
    source.css.t['border-left-width'] = '6px';
    C.applyC(source, { k: 'variant' }, 'outline');
    C.state.ui.dev = 'desktop'; C.state.ui.st = '';
    C.applyC(source, { c: 'background-color', r: 1 }, '#203040');
    C.state.ui.dev = 'tablet';
    C.applyC(source, { c: 'background-color', r: 1 }, '#abcdef');

    expect(source.css.d).not.toHaveProperty(marker('background-color'));
    expect(source.css.d[marker('border-width')]).toBe('1');
    expect(source.css.t).not.toHaveProperty(marker('background-color'));
    expect(source.css.t[marker('border-left-width')]).toBe('1');
    const beforeDesktop = responsiveStyleOf(source, 'd');
    const beforeTablet = responsiveStyleOf(source, 't');
    const expectedDesktop = [beforeDesktop.style.backgroundColor, beforeDesktop.style.borderLeftWidth];
    const expectedTablet = [beforeTablet.style.backgroundColor, beforeTablet.style.borderLeftWidth];
    beforeDesktop.close(); beforeTablet.close();

    expect(C.copyStyles(source.id)).toBe(true);
    expect(C.styleClip.css!.d['background-color']).toBe('#203040');
    expect(C.styleClip.css!.t['background-color']).toBe('#abcdef');
    const target = C.insert('button', null, C.tree().length)!;
    expect(C.pasteStyles(target.id)).toBe(true);
    const afterDesktop = responsiveStyleOf(target, 'd');
    const afterTablet = responsiveStyleOf(target, 't');
    expect([afterDesktop.style.backgroundColor, afterDesktop.style.borderLeftWidth]).toEqual(expectedDesktop);
    expect([afterTablet.style.backgroundColor, afterTablet.style.borderLeftWidth]).toEqual(expectedTablet);
    afterDesktop.close(); afterTablet.close();
  });

  test('a tablet Style edit remains authoritative on mobile when a mobile class collides', () => {
    const button = cafeButton();
    const classId = C.classAdd('Mobile action', {
      d: {}, t: {}, m: { 'background-color': '#31513f' },
    });
    C.classApply(button, classId);
    C.applyC(button, { k: 'variant' }, 'outline');

    C.state.ui.dev = 'tablet'; C.state.ui.st = '';
    C.applyC(button, { c: 'background-color', r: 1 }, '#abcdef');
    expect(button.css.d[marker('background-color')]).toBe('1');
    expect(button.css.t).not.toHaveProperty(marker('background-color'));

    const css = C.treeCss([[button]], false);
    const selectors = ['.pagecraft-button', `.c-${classId}`, `.${C.nodeClass(button)}`];
    const mobileCss = responsiveRules(css, 'm', selectors);
    const dom = new JSDOM(`<style>${mobileCss}</style>${C.renderNode(button, { edit: false })}`,
      { pretendToBeVisual: true });
    const style = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-button')!);
    expect(style.backgroundColor).toBe('rgb(171, 205, 239)');
    dom.window.close();
  });

  test.each(['10px / 20px', '8px/4px'])('tablet shorthands supply mobile class collisions with radius %s', (radius) => {
    const button = cafeButton();
    delete button.css.m['padding-left'];
    const classId = C.classAdd('Mobile shorthand collision', {
      d: {}, t: {}, m: {
        'background-color': '#31513f', 'border-left-width': '9px',
        'border-left-color': '#ffffff', 'padding-left': '2px', 'padding-top': '2px',
        'border-radius': '3px'
      },
    });
    C.classApply(button, classId);
    C.applyC(button, { k: 'variant' }, 'link');
    expect(button.css.d[marker('background-color')]).toBe('1');
    expect(button.css.d[marker('border-width')]).toBe('1');
    expect(button.css.d[marker('padding')]).toBe('1');

    C.state.ui.dev = 'tablet'; C.state.ui.st = '';
    C.applyC(button, { c: 'background', r: 1 }, '#abcdef');
    C.applyC(button, { c: 'border-width', r: 1 }, '3px 5px');
    C.applyC(button, { c: 'border-color', r: 1 }, 'rgb(10, 20, 30) rgba(40, 50, 60, .5)');
    C.applyC(button, { c: 'padding', r: 1 }, 'calc(10px + 2px) 11px');
    C.applyC(button, { c: 'border-radius', r: 1 }, radius);
    const css = C.treeCss([[button]], false);
    const selectors = ['.pagecraft-button', `.c-${classId}`, `.${C.nodeClass(button)}`];
    const mobileCss = responsiveRules(css, 'm', selectors);
    expect(mobileCss).toContain(`.${C.nodeClass(button)}.pagecraft-button{border-left-width:5px;border-left-color:rgba(40, 50, 60, .5);background:#abcdef;padding-left:11px;padding-top:calc(10px + 2px);border-radius:${radius};}`);
    const dom = new JSDOM(`<style>${mobileCss}</style>${C.renderNode(button, { edit: false })}`,
      { pretendToBeVisual: true });
    const style = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-button')!);
    expect(style.backgroundColor).toBe('rgb(171, 205, 239)');
    expect(style.borderLeftWidth).toBe('5px');
    expect(style.borderLeftColor).toBe('rgba(40, 50, 60, 0.5)');
    expect(style.paddingLeft).toBe('11px');
    expect(style.paddingTop).toBe('12px');
    dom.window.close();
  });

  test('a chosen transparent variant suppresses a stored background shorthand and Solid restores it', () => {
    const button = cafeButton();
    button.css.d.background = 'url("https://example.test/button.png") #b55637';
    C.applyC(button, { k: 'variant' }, 'outline');

    expect(button.css.d.background).toBe('url("https://example.test/button.png") #b55637');
    expect(button.css.d[marker('background')]).toBe('1');
    expect(buttonBridge(button, 'd')).not.toContain('background:');
    const outline = styleOf(button);
    expect(outline.style.backgroundImage).toBe('none');
    expect(outline.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    outline.close();

    C.applyC(button, { k: 'variant' }, 'solid');
    expect(intentMarkers(button)).toEqual([]);
    const solid = styleOf(button);
    expect(solid.style.backgroundImage).toBe('url("https://example.test/button.png")');
    expect(solid.style.backgroundColor).toBe('rgb(181, 86, 55)');
    solid.close();

    const imported = cafeButton();
    imported.props.variant = 'outline';
    imported.css.d.background = 'url("https://example.test/imported.png") #b55637';
    const existing = styleOf(imported);
    expect(existing.style.backgroundImage).toBe('url("https://example.test/imported.png")');
    expect(existing.style.backgroundColor).toBe('rgb(181, 86, 55)');
    existing.close();

    const restyled = cafeButton();
    restyled.css.d.background = 'url("https://example.test/old.png") #b55637';
    C.applyC(restyled, { k: 'variant' }, 'outline');
    C.state.ui.dev = 'desktop'; C.state.ui.st = '';
    C.applyC(restyled, { c: 'background', r: 1 }, 'url("https://example.test/new.png") #31513f');
    expect(restyled.css.d).not.toHaveProperty(marker('background'));
    const authored = styleOf(restyled);
    expect(authored.style.backgroundImage).toBe('url("https://example.test/new.png")');
    expect(authored.style.backgroundColor).toBe('rgb(49, 81, 63)');
    authored.close();
  });

  test('an already-Outline Button with authored styling keeps the existing override contract', () => {
    const button = cafeButton();
    button.props.variant = 'outline';
    expect(intentMarkers(button)).toEqual([]);
    const rendered = styleOf(button);
    expect(rendered.style.backgroundColor).toBe('rgb(181, 86, 55)');
    expect(rendered.style.borderTopWidth).toBe('0px');
    rendered.close();
  });

  test('creating a class keeps hidden Solid values local and preserves both variant appearances', () => {
    const button = cafeButton();
    C.applyC(button, { k: 'variant' }, 'outline');
    const classId = C.classFrom(button, 'Cafe action');
    const shared = C.findClass(classId)!;

    expect(shared.css.d).not.toHaveProperty('background-color');
    expect(JSON.stringify(shared.css)).not.toContain('--pc-button-variant-owns-');
    expect(button.css.d['background-color']).toBe('#b55637');
    expect(button.css.d[marker('background-color')]).toBe('1');
    const outline = styleOf(button);
    expect(outline.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(outline.style.borderTopWidth).toBe('1px');
    outline.close();

    C.applyC(button, { k: 'variant' }, 'solid');
    const solid = styleOf(button);
    expect(solid.style.backgroundColor).toBe('rgb(181, 86, 55)');
    expect(solid.style.borderTopWidth).toBe('0px');
    solid.close();
  });

  test('a shared class remains authoritative and deleting it preserves its rendered surface', () => {
    const button = cafeButton();
    const classId = C.classAdd('Shared action', {
      d: { 'background-color': '#203040', 'border-width': '7px', 'border-style': 'dashed', 'border-color': '#506070' },
      t: {}, m: {}
    });
    C.classApply(button, classId);
    C.applyC(button, { k: 'variant' }, 'outline');
    const shared = styleOf(button);
    expect(shared.style.backgroundColor).toBe('rgb(32, 48, 64)');
    expect(shared.style.borderTopWidth).toBe('7px');
    expect(shared.style.borderTopStyle).toBe('dashed');
    shared.close();

    expect(C.classDelete(classId)).toBe(true);
    expect(button.css.d).not.toHaveProperty(marker('background-color'));
    const localized = styleOf(button);
    expect(localized.style.backgroundColor).toBe('rgb(32, 48, 64)');
    expect(localized.style.borderTopWidth).toBe('7px');
    expect(localized.style.borderTopStyle).toBe('dashed');
    localized.close();
  });
});
