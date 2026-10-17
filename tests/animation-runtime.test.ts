// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { ANIM_CSS, ANIM_JS } from '../app/src/core/anim';

const windows: Window[] = [];
afterEach(() => { for (const window of windows.splice(0)) window.close(); });

async function runtime(name: string, attrs: Record<string, string> = {}) {
  const attributes = Object.entries(attrs).map(([key, value]) => ` ${key}="${value}"`).join('');
  const dom = new JSDOM(`<style>${ANIM_CSS}</style><div class="bp-animate pc-${name}"${attributes}></div>`, {
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
  Object.assign(dom.window, { IntersectionObserver: FakeIntersectionObserver });
  dom.window.eval(ANIM_JS);
  const element = dom.window.document.querySelector('div') as HTMLDivElement;
  const observer = instances[0];
  expect(observer).toBeTruthy();
  expect(observer.observed.has(element)).toBe(true);
  return { dom, element, observer };
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
