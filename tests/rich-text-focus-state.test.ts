// @vitest-environment jsdom
import { expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const richFocus = (selector: string) =>
  `${selector}:where(.pagecraft-wysiwyg):has(:where(a):focus-visible)`;

test('Rich text Focus follows a keyboard-focused contained link with local-over-class precedence', () => {
  C.seed();
  const text = C.N('text', { html: '<p><a href="/details">Details</a></p>' });
  const classId = C.classAdd('Rich motion', { d: {} });
  C.findClass(classId)!.st = { focus: { d: { color: '#334455' }, t: {}, m: {} } };
  C.classApply(text, classId);
  text.st = { focus: { d: { color: '#245f2f' }, t: {}, m: {} } };

  const nodeSelector = `.${C.nodeClass(text)}`;
  const classSelector = `.c-${classId}`;
  const css = C.treeCss([[text]], false);
  const classRule = `${richFocus(classSelector)}{color:#334455;}`;
  const localRule = `${richFocus(nodeSelector)}{color:#245f2f;}`;
  expect(css).toContain(classRule);
  expect(css).toContain(localRule);
  expect(css.indexOf(classRule)).toBeLessThan(css.indexOf(localRule));
  expect(css).not.toContain(`${nodeSelector}:focus-within`);
  expect(css).not.toContain(`${nodeSelector}:where(.pagecraft-wysiwyg):has(:focus)`);

  const rendered = document.createElement('div');
  rendered.innerHTML = C.renderNode(text, { edit: false });
  const wrapper = rendered.querySelector<HTMLElement>(nodeSelector)!;
  const link = wrapper.querySelector<HTMLAnchorElement>('a')!;
  const probeSelector = richFocus(nodeSelector).replace(':focus-visible', '.keyboard-focus-probe');
  link.classList.add('keyboard-focus-probe');
  expect(wrapper.matches(probeSelector)).toBe(true);

  link.classList.remove('keyboard-focus-probe');
  wrapper.classList.add('keyboard-focus-probe');
  expect(wrapper.matches(probeSelector)).toBe(false);

  const outside = document.createElement('a');
  outside.className = 'keyboard-focus-probe';
  wrapper.replaceWith(outside);
  outside.append(wrapper);
  expect(wrapper.matches(probeSelector)).toBe(false);

  const heading = document.createElement('div');
  heading.className = `${C.nodeClass(text)} pagecraft-heading`;
  heading.innerHTML = '<a class="keyboard-focus-probe" href="/details">Details</a>';
  expect(heading.matches(probeSelector)).toBe(false);
});
