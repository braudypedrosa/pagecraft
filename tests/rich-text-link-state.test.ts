// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const richLink = (selector: string) => `${selector}:where(.pagecraft-wysiwyg) a`;
const richHoverLink = (selector: string) => `${selector}:where(.pagecraft-wysiwyg):hover a`;
const richFocusLink = (selector: string) =>
  `${selector}:where(.pagecraft-wysiwyg):has(:where(a):focus-visible) a`;

function mediaBody(css: string, marker: string) {
  const start = css.lastIndexOf(marker + '{');
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = start + marker.length; index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}' && --depth === 0) return css.slice(start + marker.length + 1, index);
  }
  throw new Error(`Unclosed ${marker} block`);
}

const value = (name: string, breakpoint: 'd' | 't' | 'm') =>
  `#${({
    classBase: { d: '110001', t: '110002', m: '110003' },
    classHover: { d: '120001', t: '120002', m: '120003' },
    classFocus: { d: '130001', t: '130002', m: '130003' },
    localBase: { d: '210001', t: '210002', m: '210003' },
    localHover: { d: '220001', t: '220002', m: '220003' },
    localFocus: { d: '230001', t: '230002', m: '230003' },
  } as Record<string, Record<'d' | 't' | 'm', string>>)[name][breakpoint]}`;

function fixture() {
  const text = C.N('text', { html: '<p><a href="/details">Details</a></p>' });
  const classId = C.classAdd('Rich links', { d: {} });
  const shared = C.findClass(classId)!;
  shared.css = { d: {}, t: {}, m: {} };
  shared.st = { hover: { d: {}, t: {}, m: {} }, focus: { d: {}, t: {}, m: {} } };
  text.st = { hover: { d: {}, t: {}, m: {} }, focus: { d: {}, t: {}, m: {} } };
  for (const breakpoint of ['d', 't', 'm'] as const) {
    shared.css[breakpoint]['--link'] = value('classBase', breakpoint);
    shared.st.hover![breakpoint]['--link'] = value('classHover', breakpoint);
    shared.st.focus![breakpoint]['--link'] = value('classFocus', breakpoint);
    text.css[breakpoint]['--link'] = value('localBase', breakpoint);
    text.st.hover![breakpoint]['--link'] = value('localHover', breakpoint);
    text.st.focus![breakpoint]['--link'] = value('localFocus', breakpoint);
  }
  C.classApply(text, classId);
  C.state.pages[0].tree = [text];
  return { text, classId };
}

function computedLinkColour(text: ReturnType<typeof C.N>, state: '' | 'hover' | 'focus') {
  const host = document.createElement('div');
  const style = document.createElement('style');
  style.textContent = C.treeCss([[text]], false)
    .replaceAll(':has(:where(a):focus-visible)', '.focus-probe')
    .replaceAll(':hover', '.hover-probe');
  host.innerHTML = C.renderNode(text, { edit: false });
  document.head.append(style);
  document.body.append(host);
  const wrapper = host.querySelector<HTMLElement>(`.${C.nodeClass(text)}`)!;
  if (state) wrapper.classList.add(`${state}-probe`);
  const colour = getComputedStyle(wrapper.querySelector('a')!).color;
  host.remove();
  style.remove();
  return colour;
}

beforeEach(() => C.seed());

describe('Rich Text link colour states', () => {
  test('public and WordPress CSS carry class and local base, hover and keyboard-focus link colours at every breakpoint', () => {
    const { text, classId } = fixture();
    const classSelector = `.c-${classId}`;
    const nodeSelector = `.${C.nodeClass(text)}`;
    const publicCss = C.treeCss([[text]], false);
    const wordpress = C.wordpressStyles(C.state.pages[0]);

    for (const breakpoint of ['d', 't', 'm'] as const) {
      const classRules = [
        `${richLink(classSelector)}{color:${value('classBase', breakpoint)};}`,
        `${richHoverLink(classSelector)}{color:${value('classHover', breakpoint)};}`,
        `${richFocusLink(classSelector)}{color:${value('classFocus', breakpoint)};}`,
      ];
      const localRules = [
        `${richLink(nodeSelector)}{color:${value('localBase', breakpoint)};}`,
        `${richHoverLink(nodeSelector)}{color:${value('localHover', breakpoint)};}`,
        `${richFocusLink(nodeSelector)}{color:${value('localFocus', breakpoint)};}`,
      ];
      for (let index = 0; index < classRules.length; index++) {
        expect(publicCss).toContain(classRules[index]);
        expect(publicCss).toContain(localRules[index]);
        expect(publicCss.indexOf(classRules[index])).toBeLessThan(publicCss.indexOf(localRules[index]));
        expect(wordpress.global).toContain(classRules[index]);
        expect(wordpress.page).toContain(localRules[index]);
      }
    }

    delete text.st!.focus!.d['--link'];
    const cleared = C.treeCss([[text]], false);
    expect(cleared).toContain(`${richFocusLink(classSelector)}{color:${value('classFocus', 'd')};}`);
    expect(cleared).not.toContain(`${richFocusLink(nodeSelector)}{color:${value('localFocus', 'd')};}`);
    expect(cleared).toContain(`${richHoverLink(nodeSelector)}{color:${value('localHover', 'd')};}`);
  });

  test('link rules stay Rich Text scoped and leave an unstyled anchor and non-Rich nodes alone', () => {
    const heading = C.N('heading', { text: 'Heading', link: '/details' }, { d: { '--link': '#334455' }, t: {}, m: {} });
    heading.st = { focus: { d: { '--link': '#445566' }, t: {}, m: {} } };
    const classId = C.classAdd('Mixed links', { d: { '--link': '#556677' } });
    C.findClass(classId)!.st = { hover: { d: { '--link': '#667788' }, t: {}, m: {} } };
    C.classApply(heading, classId);
    const headingSelector = `.${C.nodeClass(heading)}`;
    const css = C.treeCss([[heading]], false);

    expect(css).toContain(`${richLink(`.c-${classId}`)}{color:#556677;}`);
    expect(css).not.toContain(`${headingSelector} a{color:`);
    expect(css).not.toContain(`${headingSelector}:focus-visible a{color:`);
    expect(css).not.toContain(`.c-${classId}:hover a{color:`);
    expect(C.baseCss(false)).toContain('.pagecraft-wysiwyg a{text-decoration:underline;text-underline-offset:2px}');
    expect(C.baseCss(false)).not.toContain('.pagecraft-wysiwyg a{color:');

    const plain = C.N('text', { html: '<p><a href="/details">Details</a></p>' });
    expect(C.treeCss([[plain]], false)).not.toContain(`${richLink(`.${C.nodeClass(plain)}`)}{color:`);
  });

  test('an inherited local link state keeps priority over responsive class values until it is cleared', () => {
    const { text, classId } = fixture();
    const classSelector = `.c-${classId}`;
    const nodeSelector = `.${C.nodeClass(text)}`;
    for (const breakpoint of ['t', 'm'] as const) {
      delete text.css[breakpoint]['--link'];
      delete text.st!.hover![breakpoint]['--link'];
      delete text.st!.focus![breakpoint]['--link'];
    }

    const css = C.treeCss([[text]], false);
    for (const [breakpoint, marker] of [['t', C.MQ.t], ['m', C.MQ.m]] as const) {
      const block = mediaBody(css, marker);
      const classRules = [
        `${richLink(classSelector)}{color:${value('classBase', breakpoint)};}`,
        `${richHoverLink(classSelector)}{color:${value('classHover', breakpoint)};}`,
        `${richFocusLink(classSelector)}{color:${value('classFocus', breakpoint)};}`,
      ];
      const localRules = [
        `${richLink(nodeSelector)}{color:${value('localBase', 'd')};}`,
        `${richHoverLink(nodeSelector)}{color:${value('localHover', 'd')};}`,
        `${richFocusLink(nodeSelector)}{color:${value('localFocus', 'd')};}`,
      ];
      for (let index = 0; index < classRules.length; index++) {
        expect(block).toContain(classRules[index]);
        expect(block).toContain(localRules[index]);
        expect(block.indexOf(classRules[index])).toBeLessThan(block.indexOf(localRules[index]));
      }
    }

    delete text.css.d['--link'];
    delete text.st!.hover!.d['--link'];
    delete text.st!.focus!.d['--link'];
    const clearedTablet = mediaBody(C.treeCss([[text]], false), C.MQ.t);
    expect(clearedTablet).toContain(`${richFocusLink(classSelector)}{color:${value('classFocus', 't')};}`);
    expect(clearedTablet).not.toContain(`${richFocusLink(nodeSelector)}{color:${value('localFocus', 'd')};}`);
  });

  test('the rendered anchor consumes separate base, pointer-hover and keyboard-focus colours', () => {
    const { text } = fixture();
    expect(computedLinkColour(text, '')).toBe('rgb(33, 0, 1)');
    expect(computedLinkColour(text, 'hover')).toBe('rgb(34, 0, 1)');
    expect(computedLinkColour(text, 'focus')).toBe('rgb(35, 0, 1)');

    delete text.st!.focus!.d['--link'];
    expect(computedLinkColour(text, 'focus')).toBe('rgb(19, 0, 1)');
    expect(computedLinkColour(text, 'hover')).toBe('rgb(34, 0, 1)');
  });
});
