// @vitest-environment jsdom
import { test } from 'vitest';
import a from 'node:assert/strict';
import { installCustomSelects } from '../shared/custom-select.js';

test('custom select mirrors native values, events, keyboard focus, and dynamic controls', async () => {
  HTMLElement.prototype.scrollIntoView = () => {};
  document.body.innerHTML = `<label for="sort">Sort sites</label><select id="sort">
    <option value="updated">Last edited</option><option value="name">Name</option>
  </select>`;
  const select = document.querySelector('select')!;
  let changes = 0;
  select.addEventListener('change', () => { changes++; });

  installCustomSelects();
  const trigger = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger')!;
  a.ok(trigger);
  a.equal(trigger.textContent?.trim(), 'Last edited');
  a.equal(trigger.getAttribute('aria-label'), 'Sort sites');
  a.equal(select.getAttribute('aria-hidden'), 'true');

  trigger.click();
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover')!;
  a.equal(menu.hidden, false);
  a.equal(trigger.getAttribute('aria-expanded'), 'true');
  await new Promise(resolve => setTimeout(resolve, 30));
  const name = [...menu.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    .find(option => option.textContent?.includes('Name'))!;
  a.equal(name.isConnected, true);
  name.click();
  a.equal(select.value, 'name');
  a.equal(changes, 1);
  a.equal(trigger.textContent?.trim(), 'Name');
  a.equal(menu.hidden, true);

  // Closing a menu must not also invoke the builder's Escape-to-select-parent shortcut.
  let escapedToEditor = 0;
  const editorShortcut = (event: KeyboardEvent) => { if (event.key === 'Escape') escapedToEditor++; };
  document.addEventListener('keydown', editorShortcut);
  trigger.click();
  await new Promise(resolve => setTimeout(resolve, 30));
  menu.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  a.equal(menu.hidden, true);
  a.equal(document.activeElement, trigger);
  a.equal(escapedToEditor, 0);
  a.equal(select.value, 'name', 'Escape does not change the previewed entry');
  document.removeEventListener('keydown', editorShortcut);

  const dynamic = document.createElement('select');
  dynamic.setAttribute('aria-label', 'Unit');
  dynamic.innerHTML = '<option>px</option><option>%</option>';
  document.body.append(dynamic);
  await new Promise(resolve => setTimeout(resolve, 30));
  const dynamicTrigger = dynamic.nextElementSibling as HTMLButtonElement;
  a.ok(dynamicTrigger.classList.contains('pc-custom-select-trigger'));
  dynamicTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  a.equal(dynamicTrigger.getAttribute('aria-expanded'), 'true');
});
