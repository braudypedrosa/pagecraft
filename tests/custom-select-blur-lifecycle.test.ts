// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { installCustomSelects } from '../shared/custom-select.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

beforeEach(() => { HTMLElement.prototype.scrollIntoView = () => {}; });

afterEach(async () => {
  await frame();
  document.body.replaceChildren();
  await settle();
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

test.each(['retained', 'replaced'] as const)('one pointer click opens a select %s during neighboring input blur', async replacement => {
  document.body.innerHTML = `<input aria-label="Label" value="Explore"><div id="variant-field">
    <select id="variant" aria-label="Variant"><option value="default">Default</option><option value="subtle">Subtle</option></select>
  </div>`;
  installCustomSelects();
  await settle();
  const input = document.querySelector('input')!;
  const originalSelect = document.querySelector('select')!;
  const originalTrigger = originalSelect.nextElementSibling as HTMLButtonElement;
  const originalMenu = document.querySelector<HTMLElement>('.pc-custom-select-popover')!;
  let commits = 0;
  input.addEventListener('blur', () => {
    commits++;
    // A field repaint owns native controls but can remove the enhancer's injected sibling.
    if (replacement === 'replaced') originalSelect.replaceWith(originalSelect.cloneNode(true));
    originalTrigger.remove();
  }, { once: true });
  input.focus();
  input.value = 'Explore café menu';
  originalTrigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  originalTrigger.focus(); // Native pointer focus commits the neighboring text input first.
  await settle();

  expect(commits).toBe(1);
  expect(originalTrigger.isConnected, 'the in-progress gesture still targets the same visible trigger').toBe(true);
  expect(document.querySelectorAll('.pc-custom-select-trigger')).toHaveLength(1);
  expect(document.querySelectorAll('.pc-custom-select-popover')).toHaveLength(1);
  expect(document.querySelector('.pc-custom-select-popover')).toBe(originalMenu);
  originalTrigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
  originalTrigger.click();
  await frame();
  expect(originalTrigger.getAttribute('aria-expanded')).toBe('true');
  expect(originalMenu.hidden).toBe(false);
  expect(document.activeElement?.textContent).toBe('Default');

  const select = document.querySelector('select')!;
  let inputs = 0, changes = 0;
  select.addEventListener('input', () => inputs++);
  select.addEventListener('change', () => changes++);
  originalMenu.querySelector<HTMLButtonElement>('[data-value="default"]')!.click();
  expect([inputs, changes]).toEqual([0, 0]);
  expect(document.activeElement).toBe(originalTrigger);
  originalTrigger.click();
  await frame();
  originalMenu.scrollTop = 47;
  originalMenu.dispatchEvent(new Event('scroll'));
  expect(originalMenu.scrollTop).toBe(47);
  originalMenu.querySelector<HTMLButtonElement>('[data-value="subtle"]')!.click();
  expect(select.value).toBe('subtle');
  expect([inputs, changes]).toEqual([1, 1]);
  originalTrigger.click();
  await frame();
  originalMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(originalMenu.hidden).toBe(true);
  expect(document.activeElement).toBe(originalTrigger);
  expect(select.value).toBe('subtle');
});

test.each(['different id', 'different owner'])('a repaint with a %s cannot reopen an obsolete menu', async replacement => {
  document.body.innerHTML = '<div id="field"><select id="variant" aria-label="Variant"><option>Default</option></select></div>';
  installCustomSelects();
  await settle();
  const oldTrigger = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger')!;
  oldTrigger.click();
  const oldMenu = document.querySelector<HTMLElement>('.pc-custom-select-popover')!;
  const field = document.getElementById('field')!;
  if (replacement === 'different id') field.innerHTML = '<select id="another-setting" aria-label="Other setting"><option>One</option></select>';
  else field.outerHTML = '<div><select id="variant" aria-label="Variant"><option>One</option></select></div>';
  await settle();
  expect(oldTrigger.isConnected).toBe(false);
  expect(oldMenu.isConnected).toBe(false);
  oldTrigger.click();
  expect(document.querySelector('.pc-custom-select-popover:not([hidden])')).toBeNull();
  expect(document.querySelector('.pc-custom-select-trigger')!.getAttribute('aria-expanded')).toBe('false');
});

test.each([
  ['available', false, false, true],
  ['disabled', true, false, false],
  ['removed', false, true, false],
] as const)('an open popup resolves an %s option from a rebound native select', async (_state, disabled, removed, accepted) => {
  document.body.innerHTML = '<div><select id="variant" aria-label="Variant"><option value="default">Default</option><option value="subtle">Subtle</option></select></div>';
  installCustomSelects();
  await settle();
  const original = document.querySelector('select')!;
  const trigger = original.nextElementSibling as HTMLButtonElement;
  trigger.click();
  await frame();
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover:not([hidden])')!;
  const staleButton = menu.querySelector<HTMLButtonElement>('[data-value="subtle"]')!;

  const replacement = original.cloneNode(true) as HTMLSelectElement;
  const subtle = replacement.querySelector<HTMLOptionElement>('option[value="subtle"]')!;
  if (disabled) subtle.disabled = true;
  if (removed) subtle.remove();
  original.replaceWith(replacement);
  await settle();

  let inputs = 0, changes = 0;
  replacement.addEventListener('input', () => inputs++);
  replacement.addEventListener('change', () => changes++);
  staleButton.click();

  expect(replacement.value).toBe(accepted ? 'subtle' : 'default');
  expect([inputs, changes]).toEqual(accepted ? [1, 1] : [0, 0]);
  expect(menu.hidden).toBe(accepted);
  expect(trigger.getAttribute('aria-expanded')).toBe(accepted ? 'false' : 'true');
});

test('choosing a value restores focus after its change handler replaces the same native field', async () => {
  document.body.innerHTML = '<div><select id="variant" aria-label="Variant"><option>Default</option><option>Subtle</option></select></div>';
  installCustomSelects();
  await settle();
  const select = document.querySelector('select')!;
  const trigger = select.nextElementSibling as HTMLButtonElement;
  select.addEventListener('change', () => {
    const replacement = select.cloneNode(true) as HTMLSelectElement;
    replacement.value = select.value;
    select.replaceWith(replacement);
    trigger.remove();
  }, { once: true });
  trigger.click();
  await frame();
  document.querySelector<HTMLButtonElement>('.pc-custom-select-option[data-value="Subtle"]')!.click();
  await settle();
  expect(document.querySelector('select')!.value).toBe('Subtle');
  expect(document.querySelector('.pc-custom-select-trigger')).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(trigger);
});
