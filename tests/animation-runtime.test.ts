// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { ANIM_CSS, ANIM_JS, ANIM_NAMES } from '../app/src/core/anim';

const windows: Window[] = [];
afterEach(() => { for (const window of windows.splice(0)) window.close(); });

async function runtime(name: string, attrs: Record<string, string> = {}, beforeCss = '', motion: { reduced?: boolean; legacy?: boolean } = {}) {
  const attributes = Object.entries(attrs).map(([key, value]) => ` ${key}="${value}"`).join('');
  const dom = new JSDOM(`<style>${beforeCss}</style><style>${ANIM_CSS}</style><div class="bp-animate pc-${name}"${attributes}></div>`, {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/'
  });
  windows.push(dom.window as unknown as Window);
  await new Promise<void>(resolve => dom.window.addEventListener('load', () => resolve(), { once: true }));

  const instances: FakeIntersectionObserver[] = [];
  class FakeIntersectionObserver {
    observed = new Set<Element>();
    unobserved: Element[] = [];
    constructor(private callback: IntersectionObserverCallback) { instances.push(this); }
    observe(element: Element) { this.observed.add(element); }
    unobserve(element: Element) { this.observed.delete(element); this.unobserved.push(element); }
    enter(element: Element) {
      this.callback([{ target: element, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    leave(element: Element) {
      this.callback([{ target: element, isIntersecting: false } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const media = { matches: !!motion.reduced,
    ...(motion.legacy
      ? { addListener: (listener: (event: { matches: boolean }) => void) => listeners.add(listener) }
      : { addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener) }) };
  const setReduced = (matches: boolean) => {
    if (media.matches === matches) return;
    media.matches = matches; listeners.forEach(listener => listener({ matches }));
  };
  Object.assign(dom.window, { IntersectionObserver: FakeIntersectionObserver, matchMedia: () => media });
  dom.window.eval(ANIM_JS);
  const element = dom.window.document.querySelector('div') as HTMLDivElement;
  const observer = instances[0];
  expect(observer).toBeTruthy();
  expect(observer.observed.has(element)).toBe(true);
  return { dom, element, observer, setReduced };
}

function dispatchAnimationEnd(dom: JSDOM, target: Element, animationName: string) {
  const event = new dom.window.Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  target.dispatchEvent(event);
}

describe('exported animation runtime timing overrides', () => {
  test('delay-only Bounce keeps its 1s preset duration and honours Once', async () => {
    const { dom, element, observer } = await runtime('bounce', {
      'bp-delay': '0.2s', 'bp-animation-once': 'true'
    });
    observer.enter(element);

    expect(dom.window.getComputedStyle(element).animation).toContain('bpBounce 1s ease-in-out');
    expect(element.style.animation).toBe('');
    expect(element.style.animationDuration).toBe('');
    expect(element.style.animationDelay).toBe('0.2s');
    expect(element.style.animationTimingFunction).toBe('');
    expect(observer.unobserved).toEqual([element]);
  });

  test('easing-only Spin keeps its 0.8s preset duration', async () => {
    const { dom, element, observer } = await runtime('spin', { 'bp-easing': 'linear' });
    observer.enter(element);

    expect(dom.window.getComputedStyle(element).animation).toContain('bpSpin .8s ease-in-out');
    expect(element.style.animation).toBe('');
    expect(element.style.animationDuration).toBe('');
    expect(element.style.animationDelay).toBe('');
    expect(element.style.animationTimingFunction).toBe('linear');
  });

  test('duration-only keeps the preset easing and delay', async () => {
    const { dom, element, observer } = await runtime('rotate-in', { 'bp-duration': '1.4s' });
    observer.enter(element);

    expect(dom.window.getComputedStyle(element).animation).toContain('bpRotateIn .8s ease-in-out');
    expect(element.style.animation).toBe('');
    expect(element.style.animationDuration).toBe('1.4s');
    expect(element.style.animationDelay).toBe('');
    expect(element.style.animationTimingFunction).toBe('');
  });

  test('a full timing override applies each supplied value without replacing the preset name', async () => {
    const { element, observer } = await runtime('fade-up', {
      'bp-duration': '1.2s', 'bp-delay': '0.3s', 'bp-easing': 'ease-out'
    });
    observer.enter(element);

    expect(element.style.animation).toBe('');
    expect(element.style.animationDuration).toBe('1.2s');
    expect(element.style.animationDelay).toBe('0.3s');
    expect(element.style.animationTimingFunction).toBe('ease-out');
  });

  test('empty timing attributes use the complete CSS preset unchanged', async () => {
    const { dom, element, observer } = await runtime('bounce', {
      'bp-duration': '', 'bp-delay': '', 'bp-easing': ''
    });
    observer.enter(element);

    expect(dom.window.getComputedStyle(element).animation).toContain('bpBounce 1s ease-in-out');
    expect(element.getAttribute('style')).toBeNull();
  });

  test('leaving clears timing overrides and re-entry applies them again', async () => {
    const { element, observer } = await runtime('bounce', {
      'bp-duration': '1.3s', 'bp-delay': '0.2s', 'bp-easing': 'linear'
    });
    observer.enter(element);
    expect(element.classList.contains('bp-is-animating')).toBe(true);

    observer.leave(element);
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(element.style.animationDuration).toBe('');
    expect(element.style.animationDelay).toBe('');
    expect(element.style.animationTimingFunction).toBe('');

    observer.enter(element);
    expect(element.classList.contains('bp-is-animating')).toBe(true);
    expect(element.style.animationDuration).toBe('1.3s');
    expect(element.style.animationDelay).toBe('0.2s');
    expect(element.style.animationTimingFunction).toBe('linear');
  });
});

describe('exported animation runtime completion', () => {
  test('all 26 entrance presets release authored opacity and transform', async () => {
    for (const name of ANIM_NAMES.filter(name => name !== 'fade-out')) {
      const { dom, element, observer } = await runtime(
        name,
        {},
        '.authored-state{opacity:.5;transform:translateX(8px)}'
      );
      element.classList.add('authored-state');
      observer.enter(element);
      const animationName = dom.window.getComputedStyle(element).animation.split(/\s+/)[0];

      dispatchAnimationEnd(dom, element, animationName);

      expect(element.classList.contains('bp-is-animating'), name).toBe(false);
      expect(element.classList.contains('bp-is-done-animating'), name).toBe(true);
      expect(dom.window.getComputedStyle(element).opacity, name).toBe('0.5');
      expect(dom.window.getComputedStyle(element).transform, name).toBe('translateX(8px)');
    }
  });

  test('ignores child and unrelated completion events until its own preset ends', async () => {
    const { dom, element, observer } = await runtime('fade-up');
    const child = dom.window.document.createElement('span');
    element.append(child);
    observer.enter(element);

    dispatchAnimationEnd(dom, child, 'childAnimation');
    dispatchAnimationEnd(dom, element, 'unrelatedAnimation');
    expect(element.classList.contains('bp-is-animating')).toBe(true);
    expect(element.classList.contains('bp-is-done-animating')).toBe(false);

    dispatchAnimationEnd(dom, element, 'bpFadeUp');
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);
  });

  test('does not treat an authored transition as entrance completion', async () => {
    const { dom, element, observer } = await runtime('fade-up');
    observer.enter(element);

    element.dispatchEvent(new dom.window.Event('transitionend', { bubbles: true }));
    expect(element.classList.contains('bp-is-animating')).toBe(true);
    expect(element.classList.contains('bp-is-done-animating')).toBe(false);

    dispatchAnimationEnd(dom, element, 'bpFadeUp');
    expect(element.classList.contains('bp-is-animating')).toBe(false);
  });

  test('legacy fade-out keeps its forwards-filled hidden state', async () => {
    const { dom, element, observer } = await runtime('fade-out');
    observer.enter(element);

    dispatchAnimationEnd(dom, element, 'bpFadeOut');

    expect(element.classList.contains('bp-is-animating')).toBe(true);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);
  });

  test('repeat mode re-arms after leaving and releases authored state again', async () => {
    const { dom, element, observer } = await runtime('fade-up');
    observer.enter(element);
    dispatchAnimationEnd(dom, element, 'bpFadeUp');
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);

    observer.leave(element);
    observer.enter(element);
    expect(element.classList.contains('bp-is-animating')).toBe(true);
    expect(element.classList.contains('bp-is-done-animating')).toBe(false);

    dispatchAnimationEnd(dom, element, 'bpFadeUp');
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);
  });
});


describe('reduced-motion animation lifecycle', () => {
  test('reduced initial entry settles without animation or a completion listener and does not replay on restore', async () => {
    const { dom, element, observer, setReduced } = await runtime('fade-up', {},
      '.authored-state{opacity:.5;transform:translateX(8px)}', { reduced: true });
    element.classList.add('authored-state');
    const add = vi.spyOn(element, 'addEventListener');
    observer.enter(element);
    expect(element.classList.contains('bp-is-visible')).toBe(true);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(add.mock.calls.filter(([type]) => type === 'animationend')).toHaveLength(0);
    setReduced(false);
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(dom.window.getComputedStyle(element).opacity).toBe('0.5');
    expect(dom.window.getComputedStyle(element).transform).toBe('translateX(8px)');
  });

  test('Once reduced entry stays settled while repeat re-arms only after leaving', async () => {
    const once = await runtime('fade-up', { 'bp-animation-once': 'true' }, '', { reduced: true });
    once.observer.enter(once.element);
    expect(once.observer.unobserved).toEqual([once.element]);
    once.setReduced(false);
    expect(once.element.classList.contains('bp-is-animating')).toBe(false);
    const repeat = await runtime('fade-up', {}, '', { reduced: true });
    repeat.observer.enter(repeat.element); repeat.setReduced(false);
    expect(repeat.element.classList.contains('bp-is-animating')).toBe(false);
    repeat.observer.leave(repeat.element); repeat.observer.enter(repeat.element);
    expect(repeat.element.classList.contains('bp-is-animating')).toBe(true);
    dispatchAnimationEnd(repeat.dom, repeat.element, 'bpFadeUp');
    expect(repeat.element.classList.contains('bp-is-animating')).toBe(false);
  });

  test('a media change cancels the owned end handler and timing, ignoring late completion after preference restore', async () => {
    const { dom, element, observer, setReduced } = await runtime('fade-up', {
      'bp-duration': '2s', 'bp-delay': '1s'
    });
    const add = vi.spyOn(element, 'addEventListener'), remove = vi.spyOn(element, 'removeEventListener');
    observer.enter(element);
    const handler = add.mock.calls.find(([type]) => type === 'animationend')![1];
    expect(element.classList.contains('bp-is-animating')).toBe(true);
    setReduced(true);
    expect(remove).toHaveBeenCalledWith('animationend', handler);
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);
    expect(element.style.animationDuration).toBe(''); expect(element.style.animationDelay).toBe('');
    setReduced(false);
    const settled = element.className;
    dispatchAnimationEnd(dom, element, 'bpFadeUp');
    expect(element.className).toBe(settled);
  });

  test('manual and dynamic entry obey reduced motion without arming deferred animations', async () => {
    const { dom, element, observer, setReduced } = await runtime('fade-up', {}, '', { reduced: true });
    expect(dom.window.bpAnimate.trigger(element)).toBe(true);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    const dynamic = dom.window.document.createElement('div'); dynamic.className = 'bp-animate pc-fade-up';
    dynamic.getBoundingClientRect = () => ({ top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10 });
    dom.window.document.body.append(dynamic); dom.window.bpAnimate.observe(dynamic);
    await new Promise(resolve => dom.window.setTimeout(resolve, 80));
    expect(observer.observed.has(dynamic)).toBe(true);
    expect(dynamic.classList.contains('bp-is-done-animating')).toBe(true);
    expect(dynamic.classList.contains('bp-is-animating')).toBe(false);
    setReduced(false);
    expect(dynamic.classList.contains('bp-is-animating')).toBe(false);
    expect(element.classList.contains('bp-is-animating')).toBe(false);
  });

  test('legacy media listeners settle completed Fade out when reduction is requested', async () => {
    const { dom, element, observer, setReduced } = await runtime('fade-out', {}, '', { legacy: true });
    observer.enter(element); dispatchAnimationEnd(dom, element, 'bpFadeOut');
    expect(element.classList.contains('bp-is-animating')).toBe(true);
    setReduced(true);
    expect(element.classList.contains('bp-is-animating')).toBe(false);
    expect(element.classList.contains('bp-is-done-animating')).toBe(true);
    setReduced(false); expect(element.classList.contains('bp-is-animating')).toBe(false);
  });
});


test('reduction settles connected active elements and detached elements remain safe on explicit re-entry', async () => {
  const { dom, element, observer, setReduced } = await runtime('fade-up');
  observer.enter(element);
  element.classList.remove('bp-is-visible');
  const detached = dom.window.document.createElement('div'); detached.className = 'bp-animate pc-fade-up';
  dom.window.document.body.append(detached);
  const add = vi.spyOn(detached, 'addEventListener'), remove = vi.spyOn(detached, 'removeEventListener');
  dom.window.bpAnimate.trigger(detached);
  const handler = add.mock.calls.find((args: unknown[]) => args[0] === 'animationend')![1];
  detached.remove();
  expect(() => setReduced(true)).not.toThrow();
  expect(element.classList.contains('bp-is-animating')).toBe(false);
  expect(element.classList.contains('bp-is-done-animating')).toBe(true);
  // Detached nodes need no document-wide ownership. An explicit later trigger still
  // removes its own old handler and settles against the current preference.
  dom.window.document.body.append(detached);
  dom.window.bpAnimate.trigger(detached);
  expect(remove).toHaveBeenCalledWith('animationend', handler);
  expect(detached.classList.contains('bp-is-animating')).toBe(false);
  expect(detached.classList.contains('bp-is-done-animating')).toBe(true);
  setReduced(false);
  expect(detached.classList.contains('bp-is-animating')).toBe(false);
});
