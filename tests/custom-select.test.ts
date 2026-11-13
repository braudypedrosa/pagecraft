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
  let inputs = 0, changes = 0;
  select.addEventListener('input', () => { inputs++; });
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
  a.equal(inputs, 1);
  a.equal(changes, 1);
  a.equal(trigger.textContent?.trim(), 'Name');
  a.equal(menu.hidden, true);

  trigger.click();
  await new Promise(resolve => setTimeout(resolve, 30));
  [...menu.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    .find(option => option.textContent?.includes('Name'))!.click();
  a.equal(select.value, 'name');
  a.equal(inputs, 1, 'choosing the selected option does not emit a native input event');
  a.equal(changes, 1, 'choosing the selected option does not emit a native change event');
  a.equal(menu.hidden, true, 'the same-value choice still closes the popup');
  a.equal(document.activeElement, trigger, 'the same-value choice returns focus to the trigger');

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

test('conditional controls cannot separate native selects from their visible triggers', async () => {
  document.body.innerHTML = `
    <div id="url-field"><select id="link-type" aria-label="Link type">
      <option value="url">A URL</option><option value="page" selected>A page in this project</option>
    </select></div>
    <div id="page-field"><select id="target-type" aria-label="Target type">
      <option value="url">A URL</option><option value="page" selected>A page in this project</option>
    </select></div>`;
  installCustomSelects();
  await new Promise(resolve => setTimeout(resolve, 30));
  const link = document.querySelector<HTMLSelectElement>('#link-type')!;
  const linkTrigger = link.nextElementSibling as HTMLButtonElement;
  const url = document.createElement('input');
  url.id = 'link-url';
  url.value = 'https://example.test/';
  link.parentElement!.insertBefore(url, linkTrigger);
  await new Promise(resolve => setTimeout(resolve, 30));
  a.equal(link.nextElementSibling, linkTrigger, 'a conditional text field stays after the Link type trigger');
  a.equal(linkTrigger.nextElementSibling, url);
  a.equal(link.value, 'page');
  a.match(linkTrigger.textContent || '', /A page in this project/);

  const target = document.querySelector<HTMLSelectElement>('#target-type')!;
  const targetTrigger = target.nextElementSibling as HTMLButtonElement;
  const page = document.createElement('select');
  page.id = 'link-page';
  page.setAttribute('aria-label', 'Link page');
  page.innerHTML = '<option value="home">Home</option><option value="about" selected>About</option>';
  const anchor = document.createElement('input');
  anchor.id = 'link-anchor';
  target.parentElement!.insertBefore(page, targetTrigger);
  target.parentElement!.insertBefore(anchor, targetTrigger);
  await new Promise(resolve => setTimeout(resolve, 30));
  const pageTrigger = page.nextElementSibling as HTMLButtonElement;
  a.equal(target.nextElementSibling, targetTrigger, 'conditional page controls stay after the Target type trigger');
  a.equal(targetTrigger.nextElementSibling, page);
  a.equal(page.nextElementSibling, pageTrigger);
  a.equal(pageTrigger.nextElementSibling, anchor);
  a.equal(target.value, 'page');
  a.equal(page.value, 'about');
  a.match(pageTrigger.textContent || '', /About/);
  a.equal(document.querySelectorAll('.pc-custom-select-trigger').length, 3, 'one visible trigger remains per native select');
  a.equal(document.querySelectorAll('.pc-custom-select-popover').length, 3, 'no orphan popup is created');
});

test('command-modified printable keys stay available to app shortcuts without opening the menu', async () => {
  HTMLElement.prototype.scrollIntoView = () => {};
  document.body.innerHTML = `<label for="style">Text style</label><select id="style">
    <option value="body">Body</option><option value="section">Section title</option>
  </select>`;
  installCustomSelects();
  await new Promise(resolve => setTimeout(resolve, 30));
  const trigger = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger')!;
  let saves = 0;
  const save = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') saves++;
  };
  document.addEventListener('keydown', save);

  trigger.focus();
  for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
    const event = new KeyboardEvent('keydown', { key: 's', ...modifier, bubbles: true, cancelable: true });
    trigger.dispatchEvent(event);
    a.equal(trigger.getAttribute('aria-expanded'), 'false');
    a.equal(document.activeElement, trigger);
    a.equal(event.defaultPrevented, false, 'the owning app can handle its shortcut');
  }
  a.equal(saves, 2, 'Command/Ctrl+S still reaches the draft-save shortcut');

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }));
  a.equal(trigger.getAttribute('aria-expanded'), 'true', 'Alt+Arrow keeps native combobox opening semantics');
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  a.equal(trigger.getAttribute('aria-expanded'), 'true', 'Space still opens the menu');
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }));
  await new Promise(resolve => requestAnimationFrame(resolve));
  a.equal(trigger.getAttribute('aria-expanded'), 'true', 'unmodified printable keys still type ahead');
  a.match(document.activeElement?.textContent || '', /Section title/);
  document.removeEventListener('keydown', save);
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

test('menu scrolling stays under pointer control while external scroll and keyboard positioning remain active', async () => {
  HTMLElement.prototype.scrollIntoView = () => {};
  document.body.innerHTML = `<div id="scroll-host"><select aria-label="Font family">${Array.from({ length: 40 }, (_, index) =>
    `<option value="font-${index}">${index === 0 ? 'Inherit' : `Font ${index}`}</option>`).join('')}</select></div>`;
  installCustomSelects();
  await new Promise(resolve => setTimeout(resolve, 30));
  const trigger = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger')!;
  let triggerTop = 100;
  trigger.getBoundingClientRect = () => ({ top: triggerTop, bottom: triggerTop + 37, left: 20, right: 220, width: 200, height: 37 } as DOMRect);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  trigger.click();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover:not([hidden])')!;
  const active = menu.querySelector<HTMLButtonElement>('[aria-selected="true"]')!;
  Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 2122 });
  Object.defineProperty(menu, 'offsetHeight', { configurable: true, value: 360 });
  Object.defineProperty(menu, 'clientHeight', { configurable: true, value: 360 });
  Object.defineProperty(menu, 'scrollTop', { configurable: true, writable: true, value: 40 });
  menu.getBoundingClientRect = () => ({ top: 100, bottom: 460, left: 20, right: 220, width: 200, height: 360 } as DOMRect);
  active.getBoundingClientRect = () => ({ top: 20, bottom: 54, left: 20, right: 220, width: 200, height: 34 } as DOMRect);

  menu.dispatchEvent(new Event('scroll'));
  a.equal(menu.scrollTop, 40, 'wheel scrolling the menu does not snap back to its active option');

  active.getBoundingClientRect = () => ({ top: 120, bottom: 154, left: 20, right: 220, width: 200, height: 34 } as DOMRect);
  triggerTop = 200;
  document.querySelector('#scroll-host')!.dispatchEvent(new Event('scroll'));
  a.equal(menu.style.top, '243px', 'scrolling an ancestor still repositions the floating menu');

  const last = menu.querySelectorAll<HTMLButtonElement>('[role="option"]')[39];
  let revealed = 0;
  last.scrollIntoView = () => { revealed++; };
  active.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  a.equal(document.activeElement, last);
  a.equal(revealed, 1, 'keyboard navigation still reveals the newly active option');
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

test('visible combobox carries native validation state and error descriptions as they change', async () => {
  document.body.innerHTML = '<p id="currency-help">Choose a supported currency.</p><select aria-label="Currency" required aria-invalid="true" aria-describedby="currency-help" aria-errormessage="currency-help"><option value="">Choose currency</option><option value="USD">USD</option></select>';
  await new Promise(resolve => setTimeout(resolve, 30));
  const select = document.querySelector('select')!;
  const trigger = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger')!;
  a.equal(trigger.getAttribute('aria-required'), 'true');
  a.equal(trigger.getAttribute('aria-invalid'), 'true');
  a.equal(trigger.getAttribute('aria-describedby'), 'currency-help');
  a.equal(trigger.getAttribute('aria-errormessage'), 'currency-help');

  select.removeAttribute('aria-invalid');
  select.removeAttribute('aria-errormessage');
  select.setAttribute('aria-describedby', 'new-help');
  select.required = false;
  await new Promise(resolve => setTimeout(resolve, 30));
  a.equal(trigger.getAttribute('aria-invalid'), null);
  a.equal(trigger.getAttribute('aria-errormessage'), null);
  a.equal(trigger.getAttribute('aria-describedby'), 'new-help');
  a.equal(trigger.getAttribute('aria-required'), null);
});
