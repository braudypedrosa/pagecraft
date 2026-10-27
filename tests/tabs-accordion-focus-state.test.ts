// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

type Widget = 'tabs' | 'accordion';
type Breakpoint = 'd' | 't' | 'm';

const rootClass = (type: Widget) => `pagecraft-${type}`;
const focusPath = (type: Widget) => type === 'tabs'
  ? '>:where(.pagecraft-tablist)>:where(.pagecraft-tab):focus-visible'
  : '>:where(.pagecraft-accordion-item)>:where(.pagecraft-accordion-q):focus-visible';
const focusSelector = (type: Widget, selector: string) =>
  `${selector}:where(.${rootClass(type)}):has(${focusPath(type)})`;

const mediaBlocks = (css: string) => {
  const tabletAt = css.indexOf(C.MQ.t);
  const mobileAt = css.indexOf(C.MQ.m);
  return {
    d: css.slice(0, tabletAt < 0 ? (mobileAt < 0 ? undefined : mobileAt) : tabletAt),
    t: tabletAt < 0 ? '' : css.slice(tabletAt, mobileAt < 0 ? undefined : mobileAt),
    m: mobileAt < 0 ? '' : css.slice(mobileAt),
  };
};

const responsiveRules = (css: string, breakpoint: Breakpoint, selectors: string[]) => {
  const blocks = mediaBlocks(css);
  const active = [blocks.d, ...(breakpoint === 'd' ? [] : [blocks.t]), ...(breakpoint === 'm' ? [blocks.m] : [])];
  return active.flatMap(block => [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)])
    .filter(([, selector]) => selectors.some(candidate => selector.trim().startsWith(candidate)))
    .map(([, selector, body]) => `${selector.trim()}{${body}}`).join('');
};

const colours = {
  classBase: { d: '#101011', t: '#101012', m: '#101013' },
  classFocus: { d: '#202021', t: '#202022', m: '#202023' },
  localFocus: { d: '#303031', t: '#303032', m: '#303033' },
} as const;

function fixture(type: Widget) {
  const node = C.N(type);
  const peer = C.N(type);
  const classId = C.classAdd(`${type} shared state`, {
    d: { 'background-color': colours.classBase.d },
    t: { 'background-color': colours.classBase.t },
    m: { 'background-color': colours.classBase.m },
  });
  const shared = C.findClass(classId)!;
  shared.st = { focus: { d: {}, t: {}, m: {} } };
  node.st = { focus: { d: {}, t: {}, m: {} } };
  for (const breakpoint of ['d', 't', 'm'] as const) {
    shared.st.focus![breakpoint]['background-color'] = colours.classFocus[breakpoint];
    node.st.focus![breakpoint]['background-color'] = colours.localFocus[breakpoint];
  }
  C.classApply(node, classId);
  C.classApply(peer, classId);
  return { node, peer, classId };
}

beforeEach(() => C.seed());

describe.each(['tabs', 'accordion'] as const)('%s wrapper Focus state', type => {
  test('class and local Focus rules follow the keyboard child at every breakpoint', () => {
    const { node, classId } = fixture(type);
    const classSelector = `.c-${classId}`;
    const nodeSelector = `.${C.nodeClass(node)}`;
    const css = C.treeCss([[node]], false);
    const blocks = mediaBlocks(css);

    for (const breakpoint of ['d', 't', 'm'] as const) {
      const classRule = `${focusSelector(type, classSelector)}{background-color:${colours.classFocus[breakpoint]};}`;
      const localRule = `${focusSelector(type, nodeSelector)}{background-color:${colours.localFocus[breakpoint]};}`;
      expect(blocks[breakpoint]).toContain(classRule);
      expect(blocks[breakpoint]).toContain(localRule);
      expect(blocks[breakpoint].indexOf(classRule)).toBeLessThan(blocks[breakpoint].indexOf(localRule));
    }

    expect(css).toContain(`${classSelector}:focus-visible{background-color:${colours.classFocus.d};}`);
    expect(css).not.toContain(`${nodeSelector}:focus-visible{background-color:${colours.localFocus.d};}`);
    expect(css).not.toContain(`${focusSelector(type, nodeSelector).replace(':focus-visible)', ':focus)')}{`);
    expect(css).not.toContain(`${nodeSelector}:focus-within`);
  });

  test('keyboard focus styles only its owning wrapper and leaves a sibling at its base style', () => {
    const { node, peer, classId } = fixture(type);
    const selectors = [`.c-${classId}`, `.${C.nodeClass(node)}`, `.${C.nodeClass(peer)}`];
    const source = C.treeCss([[node, peer]], false)
      .replaceAll(`:has(${focusPath(type)})`, '.focus-probe');
    const markup = C.renderNode(node, { edit: false }) + C.renderNode(peer, { edit: false });

    for (const breakpoint of ['d', 't', 'm'] as const) {
      const style = document.createElement('style');
      const host = document.createElement('div');
      style.textContent = responsiveRules(source, breakpoint, selectors);
      host.innerHTML = markup;
      document.head.append(style);
      document.body.append(host);
      const target = host.querySelector<HTMLElement>(`.${C.nodeClass(node)}`)!;
      const sibling = host.querySelector<HTMLElement>(`.${C.nodeClass(peer)}`)!;
      target.classList.add('focus-probe');
      expect(getComputedStyle(target).backgroundColor)
        .toBe(`rgb(${parseInt(colours.localFocus[breakpoint].slice(1, 3), 16)}, ${parseInt(colours.localFocus[breakpoint].slice(3, 5), 16)}, ${parseInt(colours.localFocus[breakpoint].slice(5), 16)})`);
      expect(getComputedStyle(sibling).backgroundColor)
        .toBe(`rgb(${parseInt(colours.classBase[breakpoint].slice(1, 3), 16)}, ${parseInt(colours.classBase[breakpoint].slice(3, 5), 16)}, ${parseInt(colours.classBase[breakpoint].slice(5), 16)})`);
      host.remove();
      style.remove();
    }
  });
});
