import { afterEach, beforeEach, expect, test } from 'vitest';
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const windows = [];
const runtimeErrors = [];
beforeEach(() => C.blankProject('Mobile menu tests'));
afterEach(() => {
  for (const dom of windows.splice(0)) dom.window.close();
  expect(runtimeErrors.splice(0), 'menu interactions must not throw').toEqual([]);
});
const items = [{ id: 'gardens', label: 'Gardens', href: '#gardens' }, { id: 'courtyard', parentId: 'gardens', label: 'Courtyard', href: '#courtyard' }];
function menu(props = {}) {
  return C.renderNode(C.N('nav', { aria: 'Primary', items, ...props }), { edit: false });
}
function runtime(props = {}) {
  const dom = new JSDOM(`<html style="overflow:clip"><body><header>${menu(props)}</header></body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  windows.push(dom);
  const w = dom.window, d = w.document;
  w.addEventListener('error', event => { runtimeErrors.push(event.message); event.preventDefault(); });
  // Native dialog modality/focus trapping is browser-verified. This shim exposes
  // the standard open/close lifecycle so the nav cleanup can be exercised here.
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button')?.focus(); };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  w.HTMLElement.prototype.showPopover = function () { this.dataset.testOpen = 'true'; };
  w.HTMLElement.prototype.hidePopover = function () { delete this.dataset.testOpen; };
  d.querySelector('header').getBoundingClientRect = () => ({ bottom: 72 });
  w.eval(C.NAV_JS.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, ''));
  const nav = d.querySelector('[data-nav]'), toggle = nav.querySelector('[data-nav-t]'), list = nav.querySelector('[data-nav-l]');
  return { w, d, nav, toggle, list, dialog: () => nav.querySelector('.pagecraft-mobile-menu') };
}

for (const [label, props, expected] of [
  ['default', {}, 'dropdown'], ['legacy missing property', { mobileMenu: undefined }, 'dropdown'],
  ['explicit dropdown', { mobileMenu: 'dropdown' }, 'dropdown'], ['fullscreen', { mobileMenu: 'fullscreen' }, 'fullscreen'],
  ['unrecognized value', { mobileMenu: 'unknown' }, 'dropdown']
]) {
  test(`${label} menu renders and opens with the intended mobile layout`, () => {
    const { nav, toggle, list, dialog, d } = runtime(props);
    expect(nav.dataset.mobileMenu).toBe(expected);
    toggle.click();
    expect(dialog().dataset.layout).toBe(expected);
    expect(dialog().open || dialog().dataset.testOpen === 'true').toBe(true);
    expect(dialog().getAttribute('aria-label')).toBe('Primary menu');
    expect(dialog().contains(list)).toBe(true);
    expect(list.querySelector('.sub-menu a').textContent).toBe('Courtyard');
    expect(dialog().style.getPropertyValue('--nav-top')).toBe('72px');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(d.documentElement.style.overflow).toBe('hidden');
  });
}

for (const action of ['close button', 'native Escape/cancel', 'native close', 'toggle', 'navigation link']) {
  test(`${action} restores original navigation and document scrolling`, () => {
    const { w, d, nav, toggle, list, dialog } = runtime({ mobileMenu: 'fullscreen' });
    const originalItems = [...list.querySelectorAll('a')];
    toggle.click();
    if (action === 'close button') dialog().querySelector('button').click();
    if (action === 'native Escape/cancel') {
      const cancel = new w.Event('cancel', { cancelable: true });
      dialog().dispatchEvent(cancel);
      expect(cancel.defaultPrevented).toBe(true);
    }
    if (action === 'native close') dialog().close();
    if (action === 'toggle') toggle.click();
    if (action === 'navigation link') list.querySelector('a').click();
    expect(dialog()).toBeNull();
    expect(list.parentElement).toBe(nav);
    expect([...list.querySelectorAll('a')]).toEqual(originalItems);
    expect(nav.classList.contains('is-open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(d.documentElement.style.overflow).toBe('clip');
    if (action !== 'navigation link') expect(d.activeElement).toBe(toggle);
    toggle.click();
    expect(dialog().contains(list)).toBe(true);
    dialog().querySelector('button').click();
    expect(d.documentElement.style.overflow).toBe('clip');
  });
}

test('resizing across the collapse breakpoint closes the dialog and desktop cannot reopen it', () => {
  const { w, d, nav, toggle, list, dialog } = runtime();
  toggle.click();
  toggle.style.display = 'none';
  w.dispatchEvent(new w.Event('resize'));
  expect(dialog()).toBeNull();
  expect(list.parentElement).toBe(nav);
  expect(d.documentElement.style.overflow).toBe('clip');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  toggle.click();
  expect(dialog()).toBeNull();
  toggle.style.display = 'flex';
  toggle.click();
  expect(dialog().open || dialog().dataset.testOpen === 'true').toBe(true);
});

test('dropdown navigation closes without a bubbling-click exception and can reopen', () => {
  const { toggle, list, dialog } = runtime();
  toggle.click();
  list.querySelector('a').click();
  expect(dialog()).toBeNull();
  toggle.click();
  expect(dialog().contains(list)).toBe(true);
  toggle.click();
  expect(dialog()).toBeNull();
});

test('fullscreen background click closes while a click inside the panel stays open', () => {
  const { w, toggle, dialog } = runtime({ mobileMenu: 'fullscreen' });
  toggle.click();
  dialog().getBoundingClientRect = () => ({ left: 0, right: 414, top: 0, bottom: 896 });
  dialog().dispatchEvent(new w.MouseEvent('click', { bubbles: true, clientX: 20, clientY: 100 }));
  expect(dialog()).not.toBeNull();
  dialog().dispatchEvent(new w.MouseEvent('click', { bubbles: true, clientX: 500, clientY: 100 }));
  expect(dialog()).toBeNull();
});


test('building a menu creates one persisted reusable component seeded from the navigation links', () => {
  const nav = C.N('nav', { aria: 'Primary', items });
  C.state.header.push(nav);
  const definition = C.ensureMobileMenuComponent(nav);
  expect(definition.mobileMenu).toBe(true);
  expect(nav.props.mobileMenuComponent).toBe(definition.id);
  expect(C.ensureMobileMenuComponent(nav)).toBe(definition);
  expect(C.mobileMenuComponents()).toEqual([definition]);
  const buttons = [];
  C.eachNode([definition.node], node => { if (node.type === 'button') buttons.push(node.props); });
  expect(buttons.map(({ text, link }) => [text, link])).toEqual(items.map(({ label, href }) => [label, href]));
  const snapshot = JSON.parse(JSON.stringify(C.doc()));
  C.blankProject('Different project');
  C.restore(snapshot);
  expect(C.findComponent(definition.id)?.mobileMenu).toBe(true);
  expect(C.state.header[0].props.mobileMenuComponent).toBe(definition.id);
});

test('shared mobile component edits and styles reach every rendered navigation using it', () => {
  const first = C.N('nav', { items });
  const definition = C.ensureMobileMenuComponent(first);
  const second = C.N('nav', { items, mobileMenuComponent: definition.id });
  const heading = C.N('heading', { text: 'Explore our gardens' }, { d: { color: '#123456' }, t: {}, m: {} });
  definition.node.children[0].children[0].children.push(heading);
  for (const nav of [first, second]) {
    const html = C.renderNode(nav, { edit: false });
    expect(html).toContain('data-nav-content hidden');
    expect(html).toContain('Explore our gardens');
  }
  const css = C.treeCss([[first, second]], false);
  expect(css).toContain(C.selOf(heading));
  expect(css).toContain('color:#123456');
  heading.props.text = 'A new shared title';
  for (const nav of [first, second]) expect(C.renderNode(nav, { edit: false })).toContain('A new shared title');
});

test('missing layout references fall back to normal mobile navigation links', () => {
  const { nav, list, toggle, dialog } = runtime({ mobileMenuComponent: 'deleted-menu' });
  expect(nav.querySelector('[data-nav-content]')).toBeNull();
  toggle.click();
  expect(dialog().contains(list)).toBe(true);
  expect(dialog().textContent).toContain('Gardens');
});

test('recursive menu component references terminate in HTML and stylesheet output', () => {
  const nav = C.N('nav', { items });
  const definition = C.ensureMobileMenuComponent(nav);
  definition.node.children.push(C.N('nav', { items, mobileMenuComponent: definition.id }));
  expect(() => C.renderNode(nav, { edit: false })).not.toThrow();
  expect(C.renderNode(nav, { edit: true })).toContain('contains itself');
  expect(() => C.treeCss([[nav]], false)).not.toThrow();
});

test('custom panel opens in the dialog and returns hidden to its original place after close', () => {
  const source = C.N('nav', { items });
  const definition = C.ensureMobileMenuComponent(source);
  const { nav, list, toggle, dialog, d } = runtime({ mobileMenuComponent: definition.id });
  const content = nav.querySelector('[data-nav-content]');
  const children = [...content.children];
  expect(content.hidden).toBe(true);
  toggle.click();
  expect(dialog().contains(content)).toBe(true);
  expect(content.hidden).toBe(false);
  expect(list.parentElement).toBe(nav);
  content.querySelector('a').click();
  expect(dialog()).toBeNull();
  expect(content.parentElement).toBe(nav);
  expect(content.hidden).toBe(true);
  expect([...content.children]).toEqual(children);
  expect(d.documentElement.style.overflow).toBe('clip');
  toggle.click();
  toggle.click();
  expect(content.hidden).toBe(true);
  expect(content.parentElement).toBe(nav);
});

test('legacy navigation inspector reads the same default as the renderer', () => {
  const n = C.N('nav');
  delete n.props.mobileMenu;
  expect(C.propVal(n, 'mobileMenu')).toBe('dropdown');
  n.props.mobileMenu = 'fullscreen';
  expect(C.propVal(n, 'mobileMenu')).toBe('fullscreen');
});

for (const action of ['header toggle', 'Escape', 'outside click', 'focus leaves navigation']) {
  test(`dropdown uses only the header close control and closes on ${action}`, () => {
    const { w, d, toggle, dialog, list } = runtime();
    toggle.focus(); toggle.click();
    expect(dialog().tagName).toBe('DIV');
    expect(dialog().getAttribute('popover')).toBe('manual');
    expect(dialog().querySelector('.pagecraft-mobile-menu-head')).toBeNull();
    expect(dialog().querySelector('.pagecraft-mobile-menu-close')).toBeNull();
    expect(d.activeElement).toBe(toggle);
    expect(d.querySelector('header').inert).not.toBe(true);
    if (action === 'header toggle') toggle.click();
    if (action === 'Escape') d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (action === 'outside click') d.body.click();
    if (action === 'focus leaves navigation') { const input = d.createElement('input'); d.body.append(input); input.focus(); }
    expect(dialog()).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(list.parentElement.hasAttribute('data-nav')).toBe(true);
    expect(d.documentElement.style.overflow).toBe('clip');
  });
}

test('menu background can override mobile without changing desktop or tablet', () => {
  const node = C.N('nav');
  const control = C.DEF.nav.controls.style.find(c => c.c === '--nav-panel');
  const base = node.css.d['--nav-panel'];
  C.state.ui.dev = 'mobile';
  C.setCss(node, control.c, '#123456', !!control.r);
  expect(node.css.m['--nav-panel']).toBe('#123456');
  expect(node.css.d['--nav-panel']).toBe(base);
  expect(node.css.t['--nav-panel']).toBeUndefined();
});
