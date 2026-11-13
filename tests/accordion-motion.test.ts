import { beforeEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index.ts';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, options: object) => { window: Window & typeof globalThis & { eval(source: string): unknown; close(): void } } };

beforeEach(() => C.blankProject('Accordion interaction review'));

function fixture(options: { reduced?: boolean; animate?: boolean; dispose?: boolean } = {}) {
  const markup = [
    C.N('accordion', { single: 1, open: 'first' }),
    C.N('accordion', { single: 0, open: 'none' })
  ].map(node => C.renderNode(node, { edit: false })).join('');
  const dom = new JSDOM('<style>details{border:0}</style>' + markup, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://review.example.test/' });
  const w = dom.window;
  const listeners = new Set<() => void>();
  const media = {
    matches: !!options.reduced,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
  };
  Object.defineProperty(w, 'matchMedia', { value: () => media });
  const animations: Array<{
    element: HTMLElement; from: number; to: number; progress: number; active: boolean;
    options: KeyframeAnimationOptions; onfinish: null | (() => void); oncancel: null | (() => void);
    cancel(): void; finish(): void;
  }> = [];
  if (options.animate !== false) Object.defineProperty(w.Element.prototype, 'animate', {
    configurable: true,
    value(this: HTMLElement, frames: Array<{ height: string }>, settings: KeyframeAnimationOptions) {
      const animation = {
        element: this, from: parseFloat(frames[0].height), to: parseFloat(frames[1].height),
        progress: 0, active: true, options: settings,
        onfinish: null as null | (() => void), oncancel: null as null | (() => void),
        cancel() { this.active = false; this.oncancel?.(); },
        finish() { this.active = false; this.onfinish?.(); }
      };
      animations.push(animation);
      return animation;
    }
  });
  Object.defineProperty(w.Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      const active = animations.slice().reverse().find(a => a.element === this && a.active);
      const height = active ? active.from + (active.to - active.from) * active.progress
        : this.tagName === 'SUMMARY' ? 44 : this.classList.contains('pagecraft-accordion-a') ? 100
          : this.hasAttribute('open') ? 144 : 44;
      return { x: 0, y: 0, top: 0, left: 0, bottom: height, right: 500, width: 500, height, toJSON() {} };
    }
  });
  let cleanup: undefined | (() => void);
  if (options.dispose) (w as any).__pagecraftRegisterPreviewDispose = (fn: () => void) => { cleanup = fn; };
  const run = () => w.eval(C.ACCORDION_JS.replace(/^<script>\n/, '').replace(/<\/script>\s*$/, ''));
  const roots = Array.from(w.document.querySelectorAll('.pagecraft-accordion'));
  const rows = roots.map(root => Array.from(root.querySelectorAll('details')) as HTMLDetailsElement[]);
  const click = (group: number, row: number) => rows[group][row].querySelector('summary')!.click();
  run();
  return { dom, w, roots, rows, animations, media, listeners, run, click, cleanup: () => cleanup?.() };
}

test('default opening and closing animate intrinsic height and release temporary styles', () => {
  const f = fixture();
  f.click(1, 0);
  expect(f.rows[1][0].open).toBe(true);
  expect(f.rows[1][0].querySelector('.pagecraft-accordion-a')!.hasAttribute('inert')).toBe(false);
  expect(f.animations[0]).toMatchObject({ from: 44, to: 144, options: { duration: 220 } });
  f.animations[0].finish();
  expect(f.rows[1][0].style.height).toBe('');
  f.click(1, 0);
  expect(f.rows[1][0].open).toBe(true);
  expect(f.animations[1]).toMatchObject({ from: 144, to: 44, options: { duration: 180 } });
  expect(f.rows[1][0].querySelector('.pagecraft-accordion-a')!.hasAttribute('inert')).toBe(true);
  f.animations[1].finish();
  expect(f.rows[1][0].open).toBe(false);
  expect(f.rows[1][0].style.overflow).toBe('');
  expect(f.rows[1][0].querySelector('.pagecraft-accordion-a')!.hasAttribute('inert')).toBe(false);
  f.dom.window.close();
});

test('native open updates synchronize click state and preserve single-mode exclusivity', () => {
  const f = fixture();
  f.rows[0][1].open = true;
  f.rows[0][1].dispatchEvent(new f.w.Event('toggle'));
  f.animations.forEach(a => a.finish());
  expect(f.rows[0].map(row => row.open)).toEqual([false, true, false]);
  f.click(0, 1);
  f.animations.forEach(a => a.finish());
  expect(f.rows[0][1].open).toBe(false);
  f.click(1, 0);
  f.rows[1][0].open = false;
  f.rows[1][0].dispatchEvent(new f.w.Event('toggle'));
  expect(f.rows[1][0].style.height).toBe('');
  expect(f.rows[1][0].open).toBe(false);
  f.dom.window.close();
});

test('rapid reversal starts at the visible height and ignores the cancelled completion', () => {
  const f = fixture();
  f.click(1, 0);
  const opening = f.animations[0]; opening.progress = .4;
  f.click(1, 0);
  expect(opening.active).toBe(false);
  expect(f.animations[1]).toMatchObject({ from: 84, to: 44 });
  f.animations[1].progress = .5;
  f.click(1, 0);
  expect(f.animations[2]).toMatchObject({ from: 64, to: 144 });
  opening.finish();
  expect(f.rows[1][0].style.height).toBe('144px');
  f.animations[2].finish();
  expect(f.rows[1][0].open).toBe(true);
  expect(f.rows[1][0].style.height).toBe('');
  f.dom.window.close();
});

test('single mode animates both siblings without affecting independent or multiple-open groups', () => {
  const f = fixture();
  expect(f.rows[0][0].hasAttribute('name')).toBe(false);
  f.click(0, 1);
  expect(f.animations).toHaveLength(2);
  f.animations.forEach(a => a.finish());
  expect(f.rows[0].map(row => row.open)).toEqual([false, true, false]);
  f.click(1, 0); f.click(1, 1);
  f.animations.forEach(a => a.finish());
  expect(f.rows[1].map(row => row.open)).toEqual([true, true, false]);
  expect(f.rows[0][1].open).toBe(true);
  f.dom.window.close();
});

test('reduced motion is immediate and settles any in-flight transition when preference changes', () => {
  const reduced = fixture({ reduced: true });
  reduced.click(0, 1);
  expect(reduced.animations).toHaveLength(0);
  expect(reduced.rows[0].map(row => row.open)).toEqual([false, true, false]);
  reduced.dom.window.close();
  const f = fixture(); f.click(1, 0);
  f.media.matches = true; f.listeners.forEach(fn => fn());
  expect(f.animations[0].active).toBe(false);
  expect(f.rows[1][0].open).toBe(true);
  expect(f.rows[1][0].style.height).toBe('');
  f.dom.window.close();
});

test('resize and preview disposal leave natural sizes, original names and no duplicate handlers', () => {
  const f = fixture({ dispose: true });
  f.run(); f.click(0, 1);
  expect(f.animations).toHaveLength(2);
  f.w.dispatchEvent(new f.w.Event('resize'));
  expect(f.animations.every(a => !a.active)).toBe(true);
  f.cleanup();
  expect(f.roots[0].hasAttribute('data-pc-accordion-motion')).toBe(false);
  expect(f.rows[0].every(row => row.hasAttribute('name'))).toBe(true);
  expect(f.listeners.size).toBe(0);
  f.run(); f.click(0, 2);
  expect(f.animations).toHaveLength(4);
  f.dom.window.close();
});

test('unsupported animation leaves native details and exclusive names intact', () => {
  const f = fixture({ animate: false });
  expect(f.roots[0].hasAttribute('data-pc-accordion-motion')).toBe(false);
  expect(f.rows[0].every(row => row.hasAttribute('name'))).toBe(true);
  f.click(1, 0);
  expect(f.rows[1][0].open).toBe(true);
  f.dom.window.close();
});

test('only current motion-capable exports include the enhancement and unenhanced markup remains native', () => {
  C.tree().push(C.N('accordion', { single: 1 }));
  expect(C.buildPage(C.page(), { schemaVersion: 17 })).toContain('data-pc-accordion-motion');
  for (const schemaVersion of [14, 15, 16]) {
    const html = C.buildPage(C.page(), { schemaVersion });
    expect(html).not.toContain('data-pc-accordion-motion');
    expect(html).toContain('<details class="pagecraft-accordion-item" name=');
    expect(html).toContain('<summary class="pagecraft-accordion-q">');
  }
});
