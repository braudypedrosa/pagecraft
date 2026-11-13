// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import * as C from '../app/src/core/index';

const videoFocus = (selector: string) =>
  `${selector}:where(.pagecraft-video):has(:where(.pagecraft-video-play,video,iframe):focus-visible,` +
  `:where(iframe[data-pagecraft-keyboard-focus]):focus-within)`;

test('Video node Focus follows each native keyboard surface at every breakpoint', () => {
  const video = C.N('video', {
    src: 'https://youtube.com/watch?v=aqz-KE-bpKQ', facade: 1, autoplay: 0,
  });
  video.st = {
    hover: { d: { opacity: '.8' }, t: {}, m: {} },
    focus: {
      d: { 'border-radius': '40px' },
      t: { 'border-color': '#abcdef' },
      m: { outline: '4px solid #112233' },
    },
  };

  const selector = `.${C.nodeClass(video)}`;
  const css = C.treeCss([[video]], false);
  expect(css).toContain(`${videoFocus(selector)}{border-radius:40px;}`);
  expect(css).toContain(`${videoFocus(selector)}{border-color:#abcdef;}`);
  expect(css).toContain(`${videoFocus(selector)}{outline:4px solid #112233;}`);
  expect(css).toContain(`${selector}:hover{opacity:.8;}`);
  expect(css).not.toContain(`${selector}:focus-visible{border-radius:40px;}`);
  expect(css).not.toContain(`${selector}:focus-within`);
  expect(css).not.toContain(`${selector}:where(.pagecraft-video):has(:focus)`);
});

test('reusable Video Focus keeps its generic path and local-over-class order', () => {
  C.seed();
  const video = C.N('video', { src: '/media/demo.mp4' });
  const classId = C.classAdd('Video keyboard surface', { d: {} });
  C.findClass(classId)!.st = { focus: {
    d: { 'border-radius': '24px' },
    t: { 'border-color': '#abcdef' },
    m: { outline: '3px solid #123456' },
  } };
  C.classApply(video, classId);
  video.st = { focus: {
    d: { 'border-radius': '40px' },
    t: { 'border-color': '#fedcba' },
    m: { outline: '5px solid #654321' },
  } };

  const classSelector = `.c-${classId}`;
  const nodeSelector = `.${C.nodeClass(video)}`;
  const css = C.treeCss([[video]], false);
  const classRule = `${videoFocus(classSelector)}{border-radius:24px;}`;
  const nodeRule = `${videoFocus(nodeSelector)}{border-radius:40px;}`;
  expect(css).toContain(`${classSelector}:focus-visible{border-radius:24px;}`);
  expect(css).toContain(classRule);
  expect(css).toContain(`${videoFocus(classSelector)}{border-color:#abcdef;}`);
  expect(css).toContain(`${videoFocus(classSelector)}{outline:3px solid #123456;}`);
  expect(css).toContain(nodeRule);
  expect(css).toContain(`${videoFocus(nodeSelector)}{border-color:#fedcba;}`);
  expect(css).toContain(`${videoFocus(nodeSelector)}{outline:5px solid #654321;}`);
  expect(css.indexOf(classRule)).toBeLessThan(css.indexOf(nodeRule));
});

test('Video keyboard bridge covers facade, native file and iframe descendants', () => {
  const cases = [
    { props: { src: 'https://youtube.com/watch?v=aqz-KE-bpKQ', facade: 1 }, surface: '.pagecraft-video-play' },
    { props: { src: '/media/demo.mp4', controls: 1 }, surface: 'video' },
    { props: { src: 'https://player.example.com/embed/42' }, surface: 'iframe' },
  ];

  for (const { props, surface } of cases) {
    const video = C.N('video', props);
    const host = document.createElement('div');
    host.innerHTML = C.renderNode(video, { edit: false });
    const wrapper = host.querySelector<HTMLElement>(`.${C.nodeClass(video)}`)!;
    const control = wrapper.querySelector<HTMLElement>(surface)!;
    const probe = videoFocus(`.${C.nodeClass(video)}`)
      .replace(':focus-visible', '.keyboard-focus-probe');
    control.classList.add('keyboard-focus-probe');
    expect(wrapper.matches(probe)).toBe(true);
    control.classList.remove('keyboard-focus-probe');
    wrapper.classList.add('keyboard-focus-probe');
    expect(wrapper.matches(probe)).toBe(false);
  }
});

test('facade replacement transfers only keyboard-visible focus to the iframe', () => {
  const runtime = C.FACADE_JS
    .replace(/^<script>\n/, '')
    .replace(/\n<\\?\/script>\n?$/, '');

  for (const keyboardVisible of [true, false]) {
    const video = C.N('video', {
      src: 'https://youtube.com/watch?v=aqz-KE-bpKQ', facade: 1, autoplay: 0,
    });
    document.body.innerHTML = C.renderNode(video, { edit: false });
    const button = document.querySelector<HTMLButtonElement>('.pagecraft-video-play')!;
    const nativeMatches = button.matches.bind(button);
    const matches = vi.spyOn(button, 'matches').mockImplementation(((selector: string) =>
      selector === ':focus-visible' ? keyboardVisible : nativeMatches(selector)) as typeof button.matches);
    const focus = vi.spyOn(HTMLIFrameElement.prototype, 'focus').mockImplementation(() => {});

    Function('document', runtime)(document);
    button.click();

    const iframe = document.querySelector<HTMLIFrameElement>('[data-facade] iframe');
    expect(iframe).not.toBeNull();
    expect(focus).toHaveBeenCalledTimes(keyboardVisible ? 1 : 0);
    if (keyboardVisible) {
      expect(focus.mock.instances[0]).toBe(iframe);
      expect(iframe?.getAttribute('data-pagecraft-keyboard-focus')).toBe('');
      iframe?.dispatchEvent(new Event('blur'));
      expect(iframe?.hasAttribute('data-pagecraft-keyboard-focus')).toBe(false);
      iframe?.setAttribute('data-pagecraft-keyboard-focus', '');
      iframe?.dispatchEvent(new Event('pointerdown'));
      expect(iframe?.hasAttribute('data-pagecraft-keyboard-focus')).toBe(false);
    } else {
      expect(iframe?.hasAttribute('data-pagecraft-keyboard-focus')).toBe(false);
    }
    focus.mockRestore();
    matches.mockRestore();
  }
});

test('keyboard iframe marker requires live focus-within and becomes inert after blur', () => {
  const video = C.N('video', { src: 'https://youtube.com/watch?v=aqz-KE-bpKQ', facade: 1 });
  document.body.innerHTML = `${C.renderNode(video, { edit: false })}<button class="after">After</button>`;
  const wrapper = document.querySelector<HTMLElement>(`.${C.nodeClass(video)}`)!;
  const facade = wrapper.querySelector('.pagecraft-video-play')!;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('data-pagecraft-keyboard-focus', '');
  facade.replaceWith(iframe);

  const probe = videoFocus(`.${C.nodeClass(video)}`)
    .replace(':focus-visible', '.keyboard-visible-probe')
    .replace(':focus-within', '.keyboard-within-probe');
  iframe.classList.add('keyboard-within-probe');
  expect(wrapper.matches(probe)).toBe(true);

  iframe.classList.remove('keyboard-within-probe');
  expect(wrapper.matches(probe)).toBe(false);
  expect(iframe.getAttribute('data-pagecraft-keyboard-focus')).toBe('');
});
