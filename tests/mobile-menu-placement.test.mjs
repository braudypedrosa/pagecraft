import { afterEach, beforeEach, expect, test } from 'vitest';
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const windows = [];
beforeEach(() => C.blankProject('Dropdown placement'));
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });
function runtime({ header = false, top = 544, bottom = 588, height = 668, natural = 230, props = {}, transformed = false } = {}) {
 const nav = C.N('nav', { items: [{ label: 'Work', href: '#work' }, { label: 'About', href: '#about' }, { label: 'Contact', href: '#contact' }], ...props });
 if (props.mobileMenuMode) C.ensureMobileMenuComponent(nav, props.mobileMenuMode);
 const tag = header ? 'header' : 'section';
 const dom = new JSDOM(`<html style="overflow:clip"><body><${tag}${transformed ? ' style="transform:translateY(20px)"' : ''}>${C.renderNode(nav, { edit: false })}</${tag}></body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
 windows.push(dom);
 const w = dom.window, d = w.document, toggle = d.querySelector('[data-nav-t]'), owner = d.querySelector('[data-nav]');
 const geometry = { top, bottom, height, natural };
 Object.defineProperty(w, 'innerHeight', { get: () => geometry.height });
 toggle.getBoundingClientRect = () => ({ top: geometry.top, bottom: geometry.bottom });
 d.querySelector(tag).getBoundingClientRect = () => header ? { top: 0, bottom: geometry.bottom } : { top: -900, bottom: 1600 };
 Object.defineProperty(w.HTMLElement.prototype, 'scrollHeight', { get() { return this.classList.contains('pagecraft-mobile-menu') && this.dataset.testOpen ? geometry.natural : 0; } });
 w.HTMLElement.prototype.showPopover = function () { this.dataset.testOpen = 'true'; };
 w.HTMLElement.prototype.hidePopover = function () { delete this.dataset.testOpen; };
 w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
 w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
 w.eval(C.NAV_JS.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, ''));
 const panel = () => owner.querySelector('.pagecraft-mobile-menu');
 const bounds = () => ({ top: Number.parseFloat(panel().style.getPropertyValue('--nav-top')), maxHeight: Number.parseFloat(panel().style.getPropertyValue('--nav-height')) });
 return { w, d, toggle, owner, geometry, panel, bounds };
}

test('body menu near the bottom opens above its trigger instead of an 80px ancestor-anchored strip', () => {
 const r = runtime(); r.toggle.click();
 expect(r.bounds()).toEqual({ top: 314, maxHeight: 544 });
 expect(r.bounds().top + 230).toBe(544);
 expect(r.panel().textContent).toContain('WorkAboutContact');
});

test('normal and transformed headers keep below-header placement using actual viewport bounds', () => {
 for (const transformed of [false, true]) {
  const r = runtime({ header: true, top: 28, bottom: 72, transformed }); r.toggle.click();
  expect(r.bounds()).toEqual({ top: 72, maxHeight: 596 });
 }
});

test('short content stays below when it fits even if more space exists above', () => {
 const r = runtime({ top: 360, bottom: 404, natural: 200 }); r.toggle.click();
 expect(r.bounds()).toEqual({ top: 404, maxHeight: 264 });
});

test('short viewport and long content use the larger scrollable side', () => {
 const r = runtime({ top: 180, bottom: 224, height: 280, natural: 900 }); r.toggle.click();
 expect(r.bounds()).toEqual({ top: 0, maxHeight: 180 });
 expect(r.panel().querySelectorAll('a')).toHaveLength(3);
});

test('long header content stays below and is bounded by the available viewport', () => {
 const r = runtime({ header: true, top: 28, bottom: 72, natural: 1800 }); r.toggle.click();
 expect(r.bounds()).toEqual({ top: 72, maxHeight: 596 });
});

test('resize recomputes placement and window scroll follows the actual trigger', () => {
 const r = runtime(); r.toggle.click();
 r.geometry.top = 40; r.geometry.bottom = 84;
 r.w.dispatchEvent(new r.w.Event('resize'));
 expect(r.bounds()).toEqual({ top: 84, maxHeight: 584 });
 r.geometry.top = 520; r.geometry.bottom = 564;
 r.w.dispatchEvent(new r.w.Event('scroll'));
 expect(r.bounds()).toEqual({ top: 290, maxHeight: 520 });
 r.toggle.style.display = 'none';r.w.dispatchEvent(new r.w.Event('resize'));
 expect(r.panel()).toBeNull();expect(r.d.documentElement.style.overflow).toBe('clip');
});

for (const mode of ['custom', 'follow']) test(`${mode} built menu uses the same placement and restores its content on close`, () => {
 const r = runtime({ props: { mobileMenuMode: mode } }), content = r.owner.querySelector('[data-nav-content]');
 r.toggle.click();expect(r.bounds()).toEqual({ top: 314, maxHeight: 544 });expect(content.hidden).toBe(false);
 r.d.dispatchEvent(new r.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
 expect(r.panel()).toBeNull();expect(content.parentElement).toBe(r.owner);expect(content.hidden).toBe(true);
 expect(r.d.activeElement).toBe(r.toggle);expect(r.d.documentElement.style.overflow).toBe('clip');
});

test('reopening resets panel scroll while keyboard scrolling remains possible during one open', () => {
 const r = runtime();r.toggle.click();r.panel().scrollTop = 174;
 r.toggle.click();r.toggle.click();expect(r.panel().scrollTop).toBe(0);
 r.panel().scrollTop = 80;expect(r.panel().scrollTop).toBe(80);
});

test('fullscreen preserves modal lifecycle and is not constrained by dropdown geometry', () => {
 const r = runtime({ props: { mobileMenu: 'fullscreen' } });r.toggle.click();
 expect(r.panel().open).toBe(true);expect(r.panel().style.getPropertyValue('--nav-height')).toBe('');
 expect(r.panel().querySelector('.pagecraft-mobile-menu-close')).not.toBeNull();
 r.panel().querySelector('button').click();expect(r.panel()).toBeNull();
 expect(r.d.documentElement.style.overflow).toBe('clip');expect(r.d.activeElement).toBe(r.toggle);
});
