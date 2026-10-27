// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

type Widget = 'form' | 'code';
type Breakpoint = 'd' | 't' | 'm';

const focusPath = (type: Widget) => type === 'form'
  ? '>:where(.pagecraft-field)>:where(input,textarea,select):focus-visible,'
    + '>:where(.pagecraft-field)>:where(.pc-select)>:where(.pc-select-button):focus-visible,'
    + '>:where(.pagecraft-field)>:where(.pc-date)>:where(.pc-date-control)>:where(.pc-date-input,.pc-date-trigger):focus-visible,'
    + '>:where(.pagecraft-form-button):focus-visible'
  : '>:where(.pagecraft-code-head)>:where(.pagecraft-code-copy):focus-visible';
const focusSelector = (type: Widget, selector: string) =>
  `${selector}:where(.pagecraft-${type}):has(${focusPath(type)})`;
const rgb = (hex: string) =>
  `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5), 16)})`;

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
  classBase: { d: '#111112', t: '#111113', m: '#111114' },
  classFocus: { d: '#212122', t: '#212123', m: '#212124' },
  localFocus: { d: '#313132', t: '#313133', m: '#313134' },
} as const;

function node(type: Widget) {
  if (type === 'code') return C.N('code', { body: 'const answer = 42;', title: 'Example', copy: 1 });
  return C.N('form', { fields: [
    { type: 'text', label: 'Name', name: 'name' },
    { type: 'select', label: 'Plan', name: 'plan', opts: 'One,Two' },
    { type: 'date', label: 'Date', name: 'date' },
  ] });
}

function fixture(type: Widget) {
  const target = node(type);
  const peer = node(type);
  const classId = C.classAdd(`${type} shared state`, {
    d: { 'background-color': colours.classBase.d },
    t: { 'background-color': colours.classBase.t },
    m: { 'background-color': colours.classBase.m },
  });
  const shared = C.findClass(classId)!;
  shared.st = { focus: { d: {}, t: {}, m: {} } };
  target.st = { focus: { d: {}, t: {}, m: {} } };
  for (const breakpoint of ['d', 't', 'm'] as const) {
    shared.st.focus![breakpoint]['background-color'] = colours.classFocus[breakpoint];
    target.st.focus![breakpoint]['background-color'] = colours.localFocus[breakpoint];
  }
  C.classApply(target, classId);
  C.classApply(peer, classId);
  return { target, peer, classId };
}

beforeEach(() => C.seed());

describe.each(['form', 'code'] as const)('%s wrapper Focus state', type => {
  test('class and local Focus rules follow only owned controls at every breakpoint', () => {
    const { target, classId } = fixture(type);
    const classSelector = `.c-${classId}`;
    const nodeSelector = `.${C.nodeClass(target)}`;
    const css = C.treeCss([[target]], false);
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
    expect(css).not.toContain(`${nodeSelector}:focus-within`);
    const html = C.renderNode(target, { edit: false });
    if (type === 'form') {
      expect(html).toContain('class="pagecraft-field"');
      expect(html).toContain('class="pagecraft-form-button"');
    } else {
      expect(html).toContain('class="pagecraft-code-head"');
      expect(html).toContain('class="pagecraft-code-copy"');
    }
  });

  test('one focused owner receives local state without styling its sibling', () => {
    const { target, peer, classId } = fixture(type);
    const selectors = [`.c-${classId}`, `.${C.nodeClass(target)}`, `.${C.nodeClass(peer)}`];
    const source = C.treeCss([[target, peer]], false).replaceAll(`:has(${focusPath(type)})`, '.focus-probe');
    const markup = C.renderNode(target, { edit: false }) + C.renderNode(peer, { edit: false });

    for (const breakpoint of ['d', 't', 'm'] as const) {
      const style = document.createElement('style');
      const host = document.createElement('div');
      style.textContent = responsiveRules(source, breakpoint, selectors);
      host.innerHTML = markup;
      document.head.append(style);
      document.body.append(host);
      const focused = host.querySelector<HTMLElement>(`.${C.nodeClass(target)}`)!;
      const sibling = host.querySelector<HTMLElement>(`.${C.nodeClass(peer)}`)!;
      focused.classList.add('focus-probe');
      expect(getComputedStyle(focused).backgroundColor).toBe(rgb(colours.localFocus[breakpoint]));
      expect(getComputedStyle(sibling).backgroundColor).toBe(rgb(colours.classBase[breakpoint]));
      host.remove();
      style.remove();
    }
  });
});
