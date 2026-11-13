import { beforeEach, describe, expect, test, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

function runSliderRuntime(
  markup: string,
  reducedMotion = false,
  beforeRuntime?: (dom: JSDOM) => void,
) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, { runScripts: 'outside-only' });
  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: reducedMotion }),
  });
  beforeRuntime?.(dom);
  const source = C.SLIDE_JS.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
  dom.window.eval(source);
  return dom;
}

function sizeTrack(track: HTMLElement, scrollWidth = 1_000, clientWidth = 300) {
  Object.defineProperties(track, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
  });
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    track.scrollLeft = Number(options.left || 0);
  });
  track.scrollTo = scrollTo as unknown as typeof track.scrollTo;
  return scrollTo;
}

describe('Slider keyboard runtime', () => {
  beforeEach(() => {
    C.seed();
    C.blankProject('Slider keyboard runtime');
  });

  test('Home/End on an enabled slider track seek its bounds', () => {
    const slider = C.N('slider', { arrows: 1 });
    C.state.pages[0].tree = [slider];
    const page = C.buildPage(C.state.pages[0]);

    expect(page).toContain(C.SLIDE_JS);

    const dom = runSliderRuntime(C.renderNode(slider, { edit: false }));
    const track = dom.window.document.querySelector<HTMLElement>('[data-slides]')!;
    const scrollTo = sizeTrack(track);
    track.focus();

    track.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 700, behavior: 'smooth' });
    expect(track.scrollLeft).toBe(700);

    track.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
    expect(track.scrollLeft).toBe(0);
  });

  test('Home/End from an interactive descendant keep the descendant keyboard behavior', () => {
    const slider = C.N('slider', { arrows: 1 });
    const dom = runSliderRuntime(C.renderNode(slider, { edit: false }));
    const track = dom.window.document.querySelector<HTMLElement>('[data-slides]')!;
    const scrollTo = sizeTrack(track);
    const button = dom.window.document.createElement('button');
    track.appendChild(button);
    button.focus();

    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(event);

    expect(scrollTo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test('Home/End use instant scrolling when reduced motion is requested', () => {
    const slider = C.N('slider', { arrows: 1 });
    const dom = runSliderRuntime(C.renderNode(slider, { edit: false }), true);
    const track = dom.window.document.querySelector<HTMLElement>('[data-slides]')!;
    const scrollTo = sizeTrack(track);
    track.focus();

    track.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(scrollTo).toHaveBeenCalledWith({ left: 700, behavior: 'auto' });
  });

  test('runtime from an enabled slider enhances every slider track on the page', () => {
    const enabled = C.N('slider', { arrows: 1 });
    const arrowsOff = C.N('slider', { arrows: 0 });
    const dom = runSliderRuntime(
      C.renderNode(enabled, { edit: false }) + C.renderNode(arrowsOff, { edit: false }),
    );
    const tracks = dom.window.document.querySelectorAll<HTMLElement>('[data-slides]');
    const arrowsOffTrack = tracks[1];
    const scrollTo = sizeTrack(arrowsOffTrack);
    arrowsOffTrack.focus();

    arrowsOffTrack.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(scrollTo).toHaveBeenCalledWith({ left: 700, behavior: 'smooth' });
  });

  test('a nested arrows-off track does not capture its outer slider controls or dots', () => {
    const inner = C.N('slider', { arrows: 0 }, {}, [C.N('column'), C.N('column')]);
    const outer = C.N('slider', { arrows: 1 }, {}, [
      C.N('column', {}, {}, [inner]),
      C.N('column'),
      C.N('column'),
    ]);
    let outerScrollBy = vi.fn();
    let innerScrollBy = vi.fn();
    const dom = runSliderRuntime(C.renderNode(outer, { edit: false }), false, runtimeDom => {
      const tracks = runtimeDom.window.document.querySelectorAll<HTMLElement>('[data-slides]');
      const outerTrack = tracks[0];
      const innerTrack = tracks[1];
      Object.defineProperties(outerTrack, {
        scrollWidth: { configurable: true, value: 900 },
        clientWidth: { configurable: true, value: 300 },
        offsetLeft: { configurable: true, value: 0 },
      });
      Array.from(outerTrack.children).forEach((slide, index) => {
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 300 });
      });
      Object.defineProperties(innerTrack, {
        scrollWidth: { configurable: true, value: 400 },
        clientWidth: { configurable: true, value: 200 },
        offsetLeft: { configurable: true, value: 0 },
      });
      Array.from(innerTrack.children).forEach((slide, index) => {
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 200 });
      });
      outerScrollBy = vi.fn();
      innerScrollBy = vi.fn();
      outerTrack.scrollBy = outerScrollBy;
      innerTrack.scrollBy = innerScrollBy;
    });

    const next = dom.window.document.querySelector<HTMLButtonElement>('[data-slide-n]')!;
    const dots = dom.window.document.querySelector('[data-slide-dots]')!;
    next.click();

    expect(outerScrollBy).toHaveBeenCalledOnce();
    expect(innerScrollBy).not.toHaveBeenCalled();
    expect(dots.children).toHaveLength(3);
  });

  test('26-slide bottom controls stay bounded while every position remains reachable', () => {
    const slider = C.N('slider', { arrows: 1, controlsPosition: 'bottom' }, {},
      Array.from({ length: 26 }, () => C.N('column')),
    );
    const dom = runSliderRuntime(C.renderNode(slider, { edit: false }), false, runtimeDom => {
      const track = runtimeDom.window.document.querySelector<HTMLElement>('[data-slides]')!;
      Object.defineProperties(track, {
        scrollWidth: { configurable: true, value: 7_800 },
        clientWidth: { configurable: true, value: 300 },
        offsetLeft: { configurable: true, value: 0 },
      });
      Array.from(track.children).forEach((slide, index) => {
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 300 });
      });
      track.scrollTo = vi.fn((options: ScrollToOptions) => {
        track.scrollLeft = Number(options.left || 0);
      }) as unknown as typeof track.scrollTo;
      track.scrollBy = vi.fn();
    });

    const track = dom.window.document.querySelector<HTMLElement>('[data-slides]')!;
    const dots = Array.from(
      dom.window.document.querySelectorAll('.pagecraft-slider-dot'),
    ) as HTMLButtonElement[];
    expect(dots).toHaveLength(26);
    expect(dots.at(-1)?.getAttribute('aria-label')).toBe('Go to carousel position 26 of 26');
    dots.at(-1)?.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }));
    expect(track.scrollTo).toHaveBeenLastCalledWith({ left: 7_500, behavior: 'smooth' });

    track.focus();
    track.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(track.scrollTo).toHaveBeenLastCalledWith({ left: 7_500, behavior: 'smooth' });

    const css = C.baseCss(false);
    const boxRule = css.match(/\.pagecraft-slider-box\{[^}]*\}/)?.[0] || '';
    const dotsRule = css.match(/\.controls-bottom>\.pagecraft-slider-dots\{[^}]*\}/)?.[0] || '';
    expect(boxRule).toContain('min-width:0');
    expect(boxRule).toContain('max-width:100%');
    expect(dotsRule).toContain('min-width:0');
    expect(dotsRule).toContain('flex-wrap:wrap');
    expect(css).toContain('@media(max-width:767px){.pagecraft-slider-dots{margin-top:10px}.pagecraft-slider-dot{width:44px;height:44px}}');
  });

  test('a standalone arrows-off slider keeps its no-JavaScript export', () => {
    const slider = C.N('slider', { arrows: 0 });
    C.state.pages[0].tree = [slider];

    expect(C.buildPage(C.state.pages[0])).not.toContain(C.SLIDE_JS);
  });
});
