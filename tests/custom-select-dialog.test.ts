// @vitest-environment jsdom
import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { installCustomSelects } from '../shared/custom-select.js';

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
const showPopoverDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
const hidePopoverDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidePopover');
const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
const restoreProperty = (target: object, key: PropertyKey, descriptor?: PropertyDescriptor) => {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
};

afterEach(async () => {
  // Drain deferred picker focus before removing the browser API mocks.
  await new Promise(resolve => requestAnimationFrame(resolve));
  restoreProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
  restoreProperty(HTMLElement.prototype, 'showPopover', showPopoverDescriptor);
  restoreProperty(HTMLElement.prototype, 'hidePopover', hidePopoverDescriptor);
  restoreProperty(window, 'innerWidth', innerWidthDescriptor);
});

const frame = (top: number, left = 80, width = 240, height = 37) => ({
  top, bottom: top + height, left, right: left + width, width, height,
} as DOMRect);

test('modal custom select stays in the dialog top layer and closes before its parent', async () => {
  HTMLElement.prototype.scrollIntoView = () => {};
  const openPopovers = new WeakSet<HTMLElement>();
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value(this: HTMLElement) { openPopovers.add(this); } });
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value(this: HTMLElement) { openPopovers.delete(this); } });
  document.head.insertAdjacentHTML('beforeend', '<style>[popover]{inset:0;margin:auto}</style>');
  document.body.innerHTML = `
    <select id="page-select" aria-label="Page"><option>Home</option><option>About</option></select>
    <div role="dialog" id="overlay"><select id="overlay-select" aria-label="Overlay"><option>One</option><option>Two</option></select></div>
    <dialog open id="share-dialog">
      <label for="dialog-name">Name</label><input id="dialog-name">
      <label for="access">Share with</label>
      <select id="access"><option value="private">Invited reviewers</option><option value="public">Anyone with the link</option></select>
      <button id="dialog-action" type="button">Keep editing</button>
    </dialog>`;

  installCustomSelects();
  const dialog = document.querySelector<HTMLDialogElement>('#share-dialog')!;
  const select = document.querySelector<HTMLSelectElement>('#access')!;
  const trigger = select.nextElementSibling as HTMLButtonElement;
  const documentTrigger = document.querySelector<HTMLSelectElement>('#page-select')!.nextElementSibling as HTMLButtonElement;
  const overlayTrigger = document.querySelector<HTMLSelectElement>('#overlay-select')!.nextElementSibling as HTMLButtonElement;

  trigger.getBoundingClientRect = () => frame(120);
  trigger.click();
  const menu = dialog.querySelector<HTMLElement>('.pc-custom-select-popover')!;
  a.ok(menu, 'modal owns the menu so both render in the same top layer');
  a.equal(menu.hidden, false);
  a.equal(menu.getAttribute('popover'), 'manual');
  a.equal(openPopovers.has(menu), true, 'supported browsers promote the menu above dialog overflow and transforms');
  a.equal(getComputedStyle(menu).inset, 'auto', 'component CSS resets the native popover inset');
  a.equal(getComputedStyle(menu).margin, '0px', 'component CSS resets native auto margins');
  a.equal(menu.querySelectorAll('[role="option"]').length, 2);
  await new Promise(resolve => requestAnimationFrame(resolve));
  a.equal(document.activeElement, menu.querySelector('[aria-selected="true"]'));

  const forwardTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  menu.dispatchEvent(forwardTab);
  a.equal(forwardTab.defaultPrevented, true);
  a.equal(menu.hidden, true);
  a.equal(document.activeElement, document.querySelector('#dialog-action'), 'Tab moves to the next dialog control');

  trigger.click();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const backwardTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  menu.dispatchEvent(backwardTab);
  a.equal(backwardTab.defaultPrevented, true);
  a.equal(menu.hidden, true);
  a.equal(document.activeElement, document.querySelector('#dialog-name'), 'Shift+Tab moves to the previous dialog control');

  trigger.click();
  await new Promise(resolve => requestAnimationFrame(resolve));
  menu.querySelectorAll<HTMLButtonElement>('[role="option"]')[1].click();
  a.equal(select.value, 'public', 'an option in the modal menu updates the native select');
  a.equal(menu.hidden, true);
  a.equal(document.activeElement, trigger);

  trigger.click();
  await new Promise(resolve => requestAnimationFrame(resolve));

  const initialTop = menu.style.top;
  trigger.getBoundingClientRect = () => frame(180);
  window.dispatchEvent(new Event('resize'));
  a.notEqual(menu.style.top, initialTop, 'resize repositions the modal menu');
  trigger.getBoundingClientRect = () => frame(240);
  window.dispatchEvent(new Event('scroll'));
  a.notEqual(menu.style.top, initialTop, 'scroll repositions the modal menu');

  menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  a.equal(menu.hidden, true);
  a.equal(openPopovers.has(menu), false);
  a.equal(trigger.getAttribute('aria-expanded'), 'false');
  a.equal(document.activeElement, trigger, 'Escape returns focus to the trigger');
  a.equal(dialog.open, true, 'Escape closes the picker before the dialog');
  let parentEscapes = 0;
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') parentEscapes++; });
  const closedEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  trigger.dispatchEvent(closedEscape);
  a.equal(closedEscape.defaultPrevented, false, 'Escape on a closed picker remains available to its parent dialog');
  a.equal(parentEscapes, 1, 'second Escape reaches parent dialog handling');

  trigger.click();
  document.querySelector('#dialog-action')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  a.equal(menu.hidden, true, 'outside pointer closes the picker');
  a.equal(dialog.open, true, 'outside pointer does not close the parent dialog');

  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  trigger.click();
  a.equal(menu.parentElement, dialog, 'browsers without Popover API keep the fallback inside the modal');
  a.equal(menu.hasAttribute('popover'), false);
  a.equal(menu.dataset.mobile, 'true');
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('close'));
  a.equal(menu.hidden, true, 'parent close cleans up its open picker');
  a.equal(trigger.getAttribute('aria-expanded'), 'false');

  documentTrigger.click();
  a.equal(documentTrigger.getAttribute('aria-expanded'), 'true');
  a.equal(document.querySelector('.pc-custom-select-popover:not([hidden])')?.parentElement, document.body, 'document select keeps the body portal');
  a.equal(document.querySelector('.pc-custom-select-popover:not([hidden])')?.hasAttribute('popover'), false);
  const documentTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  documentTrigger.dispatchEvent(documentTab);
  a.equal(documentTab.defaultPrevented, false, 'document select keeps native Tab navigation');

  overlayTrigger.click();
  a.equal(document.querySelector('.pc-custom-select-popover:not([hidden])')?.parentElement, document.body, 'custom overlay keeps the body portal');
  const overlayTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  overlayTrigger.dispatchEvent(overlayTab);
  a.equal(overlayTab.defaultPrevented, false, 'custom overlay keeps native Tab navigation');
});
