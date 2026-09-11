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

  trigger.style.font = '500 12.5px Manrope';
  trigger.click();
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover')!;
  a.equal(menu.hidden, false);
  a.equal(menu.style.fontSize, '12.5px');
  a.match(menu.style.fontFamily, /Manrope/);
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

test('menus fit below, above or in the larger scrollable space and clamp to the viewport', async () => {
  document.body.innerHTML = '<select aria-label="Geometry"><option>A</option><option disabled>B</option><option>C</option></select>';
  await new Promise(resolve => setTimeout(resolve, 30));
  const trigger = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger')!;
  const select = document.querySelector('select')!;
  trigger.click();
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover:not([hidden])')!;
  let top = 100, height = 790;
  trigger.getBoundingClientRect = () => ({ top, bottom:top+37, left:990, width:200, right:1190, height:37 } as DOMRect);
  Object.defineProperty(menu,'scrollHeight',{configurable:true,value:358});
  Object.defineProperty(menu,'offsetHeight',{configurable:true,value:360});
  Object.defineProperty(menu,'clientHeight',{configurable:true,value:358});
  Object.defineProperty(window,'innerWidth',{configurable:true,value:1024});
  Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>height});
  const place = () => window.dispatchEvent(new Event('resize'));
  place(); a.equal(menu.style.top,'143px'); a.equal(menu.style.left,'816px'); a.equal(menu.style.maxHeight,'360px');
  top=620; place(); a.equal(menu.style.top,'254px');
  top=100; height=300; place(); a.equal(menu.style.maxHeight,'149px'); a.equal(menu.style.top,'143px');
  top=220; window.dispatchEvent(new Event('scroll')); a.equal(menu.style.maxHeight,'206px'); a.equal(menu.style.top,'8px');
  top=500; place(); a.equal(menu.style.maxHeight,'284px'); a.equal(menu.style.top,'8px');
  await new Promise(resolve=>setTimeout(resolve,30));
  const options = menu.querySelectorAll<HTMLButtonElement>('button');
  a.equal(options[1].disabled,true);
  options[0].focus();
  options[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
  a.equal(document.activeElement,options[2]); a.equal(options[2].dataset.active,'true');
  let inputs=0,changes=0;select.addEventListener('input',()=>inputs++);select.addEventListener('change',()=>changes++);
  options[2].click(); a.equal(select.value,'C');a.equal(inputs,1);a.equal(changes,1);
  trigger.click();
  Object.defineProperty(window,'innerWidth',{configurable:true,value:390}); place();
  a.equal(menu.dataset.mobile,'true'); a.equal(menu.style.maxHeight,'');
  trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
});


test('floating options stay opaque when toolbar triggers are transparent or tinted', async () => {
  document.body.innerHTML = '<select aria-label="Current page"><option>Home</option><option>Plan your stay</option></select>';
  await new Promise(resolve => setTimeout(resolve, 30));
  const trigger = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger')!;
  for (const background of ['transparent', 'rgba(244, 250, 239, 0.4)', 'rgb(238, 247, 229)']) {
    trigger.style.backgroundColor = background;
    trigger.click();
    const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover:not([hidden])')!;
    a.equal(menu.style.getPropertyValue('--pc-cs-bg'), '#fff', 'the popup uses its own opaque surface, not trigger paint');
    a.equal(trigger.style.backgroundColor, background === 'transparent' ? 'transparent' : background);
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    a.equal(menu.hidden, true);
    a.equal(document.activeElement, trigger);
  }
});
