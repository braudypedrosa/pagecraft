import { beforeEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const scriptBody = (source: string) => source.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');

function formNode(fields: Array<Record<string, unknown>>) {
  const form = C.N('form', { action: 'https://provider.test/submit', fields });
  C.state.pages[0].tree = [form];
  return form;
}

function domFor(markup: string) {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${markup}</body></html>`, {
    runScripts: 'outside-only', url: 'https://site.test/', pretendToBeVisual: true,
  });
  const win = dom.window as unknown as Window & typeof globalThis & Record<string, unknown>;
  win.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia;
  win.requestAnimationFrame = callback => win.setTimeout(() => callback(Date.now()), 0);
  win.cancelAnimationFrame = handle => win.clearTimeout(handle);
  win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  win.PointerEvent = win.MouseEvent as unknown as typeof PointerEvent;
  win.CSS ||= {} as any;
  win.CSS.escape ||= value => String(value).replace(/[^\w-]/g, '\\$&');
  win.HTMLElement.prototype.scrollIntoView ||= function () {};
  return dom;
}

function globalListenerAudit(dom: ReturnType<typeof domFor>) {
  const win = dom.window as any;
  const proto = win.EventTarget.prototype;
  const nativeAdd = proto.addEventListener;
  const nativeRemove = proto.removeEventListener;
  const records: Array<{ target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; capture: boolean; active: boolean }> = [];
  const capture = (options: boolean | AddEventListenerOptions | undefined) =>
    typeof options === 'boolean' ? options : !!options?.capture;
  proto.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
    if (!records.some(record => record.active && record.target === this && record.type === type
      && record.listener === listener && record.capture === capture(options))) {
      records.push({ target: this, type, listener, capture: capture(options), active: true });
    }
    return nativeAdd.call(this, type, listener, options);
  };
  proto.removeEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
    const record = records.find(candidate => candidate.active && candidate.target === this && candidate.type === type
      && candidate.listener === listener && candidate.capture === capture(options));
    if (record) record.active = false;
    return nativeRemove.call(this, type, listener, options);
  };
  return {
    activeGlobals: () => records.filter(record => record.active
      && (record.target === win || record.target === win.document)),
    restore: () => {
      proto.addEventListener = nativeAdd;
      proto.removeEventListener = nativeRemove;
    },
  };
}

beforeEach(() => {
  C.seed();
  C.blankProject('Public form controls');
});

describe('public form control rendering', () => {
  test('runs the matching control payloads only in Preview and disposes portaled popups', () => {
    const builder = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
    const runtime = builder.slice(builder.indexOf('function runPreviewRuntime'), builder.indexOf('let canvasReadyCleanup'));
    expect(runtime).toContain('[/data-pagecraft-select/.test(html), PUBLIC_SELECT_JS]');
    expect(runtime).toContain('[/data-pagecraft-date/.test(html), PUBLIC_DATE_JS]');
    expect(runtime).toContain("if (!used || (editing && source !== SLIDE_JS && source !== NAV_JS)) return;");
    expect(runtime).toContain("$$('[data-pagecraft-select-popover]', cdoc).forEach(el => el.remove());");
    expect(runtime).toContain("$$('[data-pagecraft-date-popover]', cdoc).forEach(el => el.remove());");
    expect(runtime).toContain('cwin.__pagecraftRegisterPreviewDispose = cleanup =>');
    expect(runtime).toContain('runtimeDisposers.forEach(dispose =>');
    expect(runtime.indexOf('runtimeDisposers.forEach(dispose =>')).toBeLessThan(runtime.indexOf('listeners.forEach(([target'));
    expect(runtime).toContain('delete cwin.__pagecraftRegisterPreviewDispose');
  });

  test('ships only the control runtime used by the page', () => {
    formNode([{ type: 'text', label: 'Name', name: 'name' }]);
    const plain = C.buildPage(C.state.pages[0]);
    expect(plain).not.toContain('data-pagecraft-controls');
    expect(plain).not.toContain(C.PUBLIC_SELECT_JS);
    expect(plain).not.toContain(C.PUBLIC_DATE_JS);

    formNode([{ type: 'select', label: 'Plan', name: 'plan', opts: 'Small, Large' }]);
    const select = C.buildPage(C.state.pages[0]);
    expect(select).toContain('data-pagecraft-controls');
    expect(select).toContain('data-pagecraft-select');
    expect(select).toContain(C.PUBLIC_SELECT_JS);
    expect(select).not.toContain(C.PUBLIC_DATE_JS);
    expect(select).toContain(C.PUBLIC_SELECT_CSS);
    expect(select).not.toContain(C.PUBLIC_DATE_CSS);

    formNode([{ type: 'date', label: 'Visit', name: 'visit' }]);
    const date = C.buildPage(C.state.pages[0]);
    expect(date).toMatch(/type="date" data-pagecraft-date/);
    expect(date).toContain(C.PUBLIC_DATE_JS);
    expect(date).not.toContain(C.PUBLIC_SELECT_JS);
    expect(date).toContain(C.PUBLIC_DATE_CSS);
    expect(date).not.toContain(C.PUBLIC_SELECT_CSS);
  });

  test('adds matching control styles to Preview CSS while editor controls stay native', () => {
    const form = formNode([
      { type: 'select', label: 'Plan', name: 'plan', opts: 'Small, Large' },
      { type: 'date', label: 'Visit', name: 'visit' },
    ]);
    const previewCss = C.publicFormControlCssFor([[form]], false);
    expect(previewCss).toContain(C.PUBLIC_SELECT_CSS);
    expect(previewCss).toContain(C.PUBLIC_DATE_CSS);

    const editingCss = C.publicFormControlCssFor([[form]], true);
    expect(editingCss).not.toContain(C.PUBLIC_SELECT_CSS);
    expect(editingCss).not.toContain(C.PUBLIC_DATE_CSS);
  });

  test('keeps editor date fields inert while public source retains native date semantics', () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit', required: 1 }]);
    expect(C.renderNode(form, { edit: true })).toMatch(/type="date" data-pagecraft-date readonly required/);
    expect(C.renderNode(form, { edit: false })).toMatch(/type="date" data-pagecraft-date required/);
  });

  test('places matching control styles in the WordPress page or shared stylesheet', () => {
    formNode([{ type: 'select', label: 'Plan', name: 'plan', opts: 'Small, Large' }]);
    let styles = C.wordpressStyles(C.state.pages[0]);
    expect(styles.page).toContain('.pc-select-button');
    expect(styles.page).not.toContain('.pc-date-content');

    const date = C.N('form', {
      action: 'https://provider.test/submit', fields: [{ type: 'date', label: 'Visit', name: 'visit' }],
    });
    C.state.header = [date];
    styles = C.wordpressStyles(C.state.pages[0]);
    expect(styles.global).toContain('.pc-date-content');
    expect(styles.page).toContain('.pc-select-button');
  });

  test('includes WordPress control styles for nested component definitions in page and global regions', () => {
    const date = C.N('form', {
      action: 'https://provider.test/submit', fields: [{ type: 'date', label: 'Visit', name: 'visit' }],
    });
    const wrapper = C.N('box', {}, {}, [date]);
    C.state.pages[0].tree = [wrapper];
    expect(C.componentFromNode(date.id, 'Date form')).toBeTruthy();
    expect(C.componentFromNode(wrapper.id, 'Nested form')).toBeTruthy();

    let styles = C.wordpressStyles(C.state.pages[0]);
    expect(styles.page).toContain('.pc-date-content');

    C.state.header = [C.clone(C.state.pages[0].tree[0])];
    C.state.pages[0].tree = [];
    styles = C.wordpressStyles(C.state.pages[0]);
    expect(styles.global).toContain('.pc-date-content');
    expect(styles.page).not.toContain('.pc-date-content');
  });
});

describe('public custom select', () => {
  test('leaves no document or window listeners when Preview disposes it after use', () => {
    const form = formNode([{ type: 'select', label: 'Plan', name: 'plan', opts: 'Small, Large' }]);
    const dom = domFor(C.renderNode(form, { edit: false }));
    const audit = globalListenerAudit(dom);
    const win = dom.window as any;
    const proto = win.EventTarget.prototype;
    const add = proto.addEventListener;
    const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = [];
    proto.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      listeners.push([this, type, listener, options]);
      return add.call(this, type, listener, options);
    };
    try {
      dom.window.eval(scriptBody(C.PUBLIC_SELECT_JS));
    } finally {
      proto.addEventListener = add;
    }

    dom.window.document.querySelector<HTMLButtonElement>('.pc-select-button')!.click();
    listeners.forEach(([target, type, listener, options]) => target.removeEventListener(type, listener, options));
    dom.window.document.querySelectorAll('[data-pagecraft-select-popover]').forEach((node: Element) => node.remove());

    expect(audit.activeGlobals()).toHaveLength(0);
    expect(dom.window.document.querySelector('[data-pagecraft-select-popover]')).toBeNull();
    audit.restore();
  });

  test('supports keyboard selection, native FormData, and form reset', async () => {
    const form = formNode([{ type: 'select', label: 'Plan', name: 'plan', opts: 'Small, Large, Enterprise' }]);
    const dom = domFor(C.renderNode(form, { edit: false }));
    dom.window.eval(scriptBody(C.PUBLIC_SELECT_JS));
    const native = dom.window.document.querySelector<HTMLSelectElement>('select[name="plan"]')!;
    const button = dom.window.document.querySelector<HTMLButtonElement>('.pc-select-button')!;

    expect(button.getAttribute('role')).toBe('combobox');
    expect(native.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('aria-labelledby')).toContain('-label');
    expect(button.hasAttribute('aria-invalid')).toBe(false);
    expect(button.querySelector('.pc-select-icon svg')).not.toBeNull();
    expect(button.querySelector('.pc-select-value')?.textContent).toBe('Small');
    expect(button.textContent).toBe('Small');
    button.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    button.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    button.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(native.value).toBe('Large');
    expect(button.textContent).toBe('Large');
    expect(new dom.window.FormData(native.form!).get('plan')).toBe('Large');

    native.form!.reset();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(native.value).toBe('Small');
    expect(button.textContent).toBe('Small');
  });

  test('moves native required errors to the visible combobox', () => {
    const dom = domFor('<form class="pagecraft-form" data-pagecraft-controls><select name="plan" data-pagecraft-select required><option value="">Choose</option><option>Large</option></select></form>');
    dom.window.eval(scriptBody(C.PUBLIC_SELECT_JS));
    const native = dom.window.document.querySelector<HTMLSelectElement>('select')!;
    const button = dom.window.document.querySelector<HTMLButtonElement>('.pc-select-button')!;
    expect(button.hasAttribute('aria-invalid')).toBe(false);
    native.dispatchEvent(new dom.window.Event('invalid', { cancelable: true }));
    expect(button.getAttribute('aria-invalid')).toBe('true');
    expect(dom.window.document.activeElement).toBe(button);
  });

  test('portals and clamps the popup outside overflow-clipped page content', () => {
    const dom = domFor('<div style="overflow:hidden;max-height:20px"><form class="pagecraft-form" data-pagecraft-controls><select name="plan" data-pagecraft-select><option>Small</option><option>Large</option></select></form></div>');
    Object.defineProperties(dom.window, {
      innerWidth: { configurable: true, value: 320 },
      innerHeight: { configurable: true, value: 240 },
    });
    dom.window.eval(scriptBody(C.PUBLIC_SELECT_JS));
    const button = dom.window.document.querySelector<HTMLButtonElement>('.pc-select-button')!;
    const list = dom.window.document.querySelector<HTMLElement>('.pc-select-list')!;
    button.getBoundingClientRect = () => ({
      x: 270, y: 205, left: 270, top: 205, right: 330, bottom: 235,
      width: 60, height: 30, toJSON() {},
    });
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 100 });

    button.click();

    expect(list.parentElement).toBe(dom.window.document.body);
    expect(list.style.position).toBe('fixed');
    expect(list.style.left).toBe('248px');
    expect(list.style.top).toBe('99px');
    expect(list.style.width).toBe('60px');
  });
});

describe('public Zag date picker', () => {
  test('stops its Preview machine and can enhance a fresh Preview after disposal', async () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit' }]);
    const markup = C.renderNode(form, { edit: false });
    const dom = domFor(markup);
    const win = dom.window as any;
    const disposers: Array<() => void> = [];
    win.__pagecraftRegisterPreviewDispose = (dispose: () => void) => disposers.push(dispose);
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    delete win.__pagecraftRegisterPreviewDispose;
    expect(disposers).toHaveLength(1);

    const trigger = dom.window.document.querySelector<HTMLButtonElement>('.pc-date-trigger')!;
    trigger.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    const day = (Array.from(dom.window.document.querySelectorAll('.pc-date-day:not([data-outside-range])')) as HTMLButtonElement[])
      .find(item => item.getAttribute('aria-disabled') !== 'true')!;
    day.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(dom.window.document.querySelector('[data-live-announcer][role="alert"]')).not.toBeNull();

    const audit = globalListenerAudit(dom);
    trigger.click();
    await new Promise(resolve => dom.window.setTimeout(resolve, 20));
    expect(audit.activeGlobals().length).toBeGreaterThan(0);

    disposers[0]();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(audit.activeGlobals()).toHaveLength(0);
    expect(dom.window.document.querySelector('[data-live-announcer]')).toBeNull();
    expect(dom.window.document.querySelector('[data-pagecraft-date-popover]')).toBeNull();
    audit.restore();

    dom.window.document.body.innerHTML = markup;
    const freshDisposers: Array<() => void> = [];
    win.__pagecraftRegisterPreviewDispose = (dispose: () => void) => freshDisposers.push(dispose);
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    delete win.__pagecraftRegisterPreviewDispose;
    expect(freshDisposers).toHaveLength(1);
    const freshTrigger = dom.window.document.querySelector<HTMLButtonElement>('.pc-date-trigger')!;
    freshTrigger.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(dom.window.document.querySelector<HTMLElement>('.pc-date-content')!.hidden).toBe(false);
    freshDisposers[0]();
  });

  test('portals the calendar outside clipped content and constrains it to Zag available height', () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit' }]);
    const dom = domFor(`<div style="overflow:hidden;max-height:20px">${C.renderNode(form, { edit: false })}</div>`);
    const source = dom.window.document.querySelector<HTMLInputElement>('input[name="visit"]')!;
    source.form!.style.setProperty('--f-bg', '#fefefe');
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    const positioner = dom.window.document.querySelector<HTMLElement>('[data-pagecraft-date-popover]')!;

    expect(positioner.parentElement).toBe(dom.window.document.body);
    expect(positioner.style.getPropertyValue('--f-bg')).toBe('#fefefe');
    expect(C.PUBLIC_DATE_CSS).toContain('max-height:min(20rem,var(--available-height');
    expect(C.PUBLIC_DATE_CSS).toContain('overflow:auto');
  });

  test('keeps month navigation focused after rerendering the calendar', async () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit' }]);
    const dom = domFor(C.renderNode(form, { edit: false }));
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    dom.window.document.querySelector<HTMLButtonElement>('.pc-date-trigger')!.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    const next = dom.window.document.querySelector<HTMLButtonElement>('[data-part="next-trigger"]')!;
    next.focus();
    next.click();
    next.blur();
    await new Promise(resolve => dom.window.setTimeout(resolve, 20));

    const focused = dom.window.document.activeElement as HTMLElement;
    expect(focused.isConnected).toBe(true);
    expect(dom.window.document.querySelector('.pc-date-content')?.contains(focused)).toBe(true);
    expect(['next-trigger', 'table-cell-trigger']).toContain(focused.dataset.part);
  });

  test('supports arrow-key navigation and restores focus on Escape', async () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit' }]);
    const dom = domFor(C.renderNode(form, { edit: false }));
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    const trigger = dom.window.document.querySelector<HTMLButtonElement>('.pc-date-trigger')!;
    trigger.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    const content = dom.window.document.querySelector<HTMLDivElement>('.pc-date-content')!;
    const navigation = Array.from(content.querySelectorAll('.pc-date-nav')) as HTMLButtonElement[];
    expect(content.querySelector('select')).toBeNull();
    expect(content.querySelector('.pc-date-month')?.textContent?.trim()).toBeTruthy();
    expect(navigation).toHaveLength(2);
    expect(navigation.every(button => button.type === 'button' && !!button.getAttribute('aria-label'))).toBe(true);
    const first = dom.window.document.activeElement as HTMLButtonElement;
    const firstValue = first.dataset.value;
    first.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    await new Promise(resolve => dom.window.setTimeout(resolve));
    const moved = dom.window.document.activeElement as HTMLButtonElement;
    expect(moved.dataset.value).not.toBe(firstValue);
    moved.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    }));
    await new Promise(resolve => dom.window.setTimeout(resolve, 20));
    expect(content.hidden).toBe(true);
    expect(dom.window.document.activeElement).toBe(trigger);
  });

  test('selects an ISO date into the named form owner and resets to its default', async () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit', required: 1 }]);
    const dom = domFor(C.renderNode(form, { edit: false }));
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    const input = dom.window.document.querySelector<HTMLInputElement>('input[name="visit"]')!;
    const trigger = dom.window.document.querySelector<HTMLButtonElement>('.pc-date-trigger')!;

    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('text');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    trigger.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    const day = (Array.from(dom.window.document.querySelectorAll('.pc-date-day:not([data-outside-range])')) as HTMLButtonElement[])
      .find(item => item.getAttribute('aria-disabled') !== 'true')!;
    day.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new dom.window.FormData(input.form!).get('visit')).toBe(input.value);
    expect(input.checkValidity()).toBe(true);

    input.form!.reset();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(input.value).toBe('');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.checkValidity()).toBe(false);
  });

  test('preserves invalid typed text after a valid selection until the user corrects it', async () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit', required: 1 }]);
    const dom = domFor(C.renderNode(form, { edit: false }));
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    const input = dom.window.document.querySelector<HTMLInputElement>('input[name="visit"]')!;
    dom.window.document.querySelector<HTMLButtonElement>('.pc-date-trigger')!.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    const day = (Array.from(dom.window.document.querySelectorAll('.pc-date-day:not([data-outside-range])')) as HTMLButtonElement[])
      .find(item => item.getAttribute('aria-disabled') !== 'true')!;
    day.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    input.value = '2026-02-30';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: false }));
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(input.value).toBe('2026-02-30');
    expect(input.checkValidity()).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    input.form!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    expect(input.value).toBe('2026-02-30');
    expect(input.checkValidity()).toBe(false);

    input.focus();
    input.value = '';
    input.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    for (const character of '2026-11-15') {
      const beforeInput = new dom.window.InputEvent('beforeinput', {
        bubbles: true, cancelable: true, data: character, inputType: 'insertText',
      });
      expect(input.dispatchEvent(beforeInput)).toBe(true);
      input.value += character;
      input.dispatchEvent(new dom.window.InputEvent('input', {
        bubbles: true, data: character, inputType: 'insertText',
      }));
      await Promise.resolve();
      expect(input.value.endsWith(character), `typed ${character}, value ${input.value}`).toBe(true);
    }
    expect(input.value).toBe('2026-11-15');
    input.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: false }));
    await new Promise(resolve => dom.window.setTimeout(resolve));
    expect(input.value).toBe('2026-11-15');
    expect(input.checkValidity()).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(new dom.window.FormData(input.form!).get('visit')).toBe('2026-11-15');
  });

  test('honors existing min, max, and unavailable-date attributes', async () => {
    const form = formNode([{ type: 'date', label: 'Visit', name: 'visit' }]);
    const dom = domFor(C.renderNode(form, { edit: false }));
    const source = dom.window.document.querySelector<HTMLInputElement>('input[name="visit"]')!;
    source.value = '2026-10-20';
    source.defaultValue = '2026-10-20';
    source.min = '2026-10-10';
    source.max = '2026-10-31';
    source.dataset.pagecraftUnavailableDates = '2026-10-21';
    dom.window.eval(scriptBody(C.PUBLIC_DATE_JS));
    dom.window.document.querySelector<HTMLButtonElement>('.pc-date-trigger')!.click();
    await new Promise(resolve => dom.window.setTimeout(resolve));
    const unavailable = (Array.from(dom.window.document.querySelectorAll('.pc-date-day')) as HTMLButtonElement[])
      .find(day => day.textContent === '21' && !day.hasAttribute('data-outside-range'))!;
    expect(unavailable.getAttribute('aria-disabled')).toBe('true');
    expect(unavailable.hasAttribute('data-unavailable')).toBe(true);

    const input = dom.window.document.querySelector<HTMLInputElement>('input[name="visit"]')!;
    input.value = '2026-10-21';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toContain('unavailable');
    input.value = '2026-10-22';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(input.checkValidity()).toBe(true);
  });
});
