// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useLayoutEffect } from 'preact/hooks';
import * as C from '../app/src/core/index';
import { CmsWorkspace } from '../app/src/ui/CmsWorkspace';
import { installCustomSelects, refreshCustomSelects } from '../shared/custom-select.js';
import { rig, type Rig } from './ui.setup';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const triggerOf = (select: HTMLSelectElement) => select.nextElementSibling as HTMLButtonElement;
let r: Rig | undefined;
const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

beforeEach(() => { HTMLElement.prototype.scrollIntoView = () => {}; });
afterEach(async () => {
  window.__pcFeedback?.destroy();
  if (r) render(null, r.host);
  r = undefined;
  document.body.replaceChildren();
  await settle();
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  vi.restoreAllMocks();
});

test('restoring a CMS saved view updates the enhanced Status without native filter events', async () => {
  r = rig();
  C.state.meta.collections = [];
  const col = C.collectionAdd('Cabins');
  col.views = [{ id: 'lake-drafts', name: 'Lake drafts', search: 'lake', status: 'draft' }];
  r.draw(<CmsWorkspace collectionId={col.id} close={() => {}} />);
  installCustomSelects();
  await settle();
  const [status, view] = [...r.host.querySelectorAll('select')];
  const nativeEvents: string[] = [];
  status.addEventListener('input', e => nativeEvents.push(e.type));
  status.addEventListener('change', e => nativeEvents.push(e.type));
  const statusTrigger = triggerOf(status);
  expect(statusTrigger.textContent).toBe('All entries');

  await act(async () => {
    triggerOf(view).click();
    document.querySelector<HTMLButtonElement>('.pc-custom-select-option[data-value="lake-drafts"]')!.click();
  });
  await settle();

  expect(status.value).toBe('draft');
  expect(statusTrigger.textContent).toBe('Drafts');
  expect(r.host.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('lake');
  expect(view.value).toBe('lake-drafts');
  expect(triggerOf(view).textContent).toBe('Lake drafts');
  expect(nativeEvents).toEqual([]);
});

test('post-commit refresh mirrors controlled properties idempotently without committing native events', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const Fields = ({ value, disabled = false }: { value: string; disabled?: boolean }) => {
    useLayoutEffect(() => { refreshCustomSelects(); });
    return <>
      <select aria-label="Status" value={value} disabled={disabled}>
        <option value="all">All entries</option><option value="draft">Drafts</option>
      </select>
      <select aria-label="Sort" value="title"><option value="title">Title</option><option value="date">Date</option></select>
    </>;
  };
  act(() => render(<Fields value="all" />, host));
  installCustomSelects();
  await settle();
  const [status, sort] = [...host.querySelectorAll('select')];
  const triggers = [triggerOf(status), triggerOf(sort)];
  const menus = [...document.querySelectorAll('.pc-custom-select-popover')];
  const nativeEvents: string[] = [];
  for (const select of [status, sort]) {
    select.addEventListener('input', e => nativeEvents.push(e.type));
    select.addEventListener('change', e => nativeEvents.push(e.type));
  }

  act(() => render(<Fields value="draft" disabled />, host));
  expect(triggers[0].textContent).toBe('Drafts');
  expect(triggers[0].disabled).toBe(true);
  expect(triggers[1].textContent).toBe('Title');
  // These property writes have no observable DOM mutation. Hosts explicitly refresh after commit.
  for (const [change, value, label] of [
    [() => { status.value = 'all'; }, 'all', 'All entries'],
    [() => { status.selectedIndex = 1; }, 'draft', 'Drafts'],
    [() => { status.options[0].selected = true; }, 'all', 'All entries'],
  ] as const) {
    change();
    refreshCustomSelects();
    refreshCustomSelects();
    expect(status.value).toBe(value);
    expect(triggers[0].textContent).toBe(label);
  }
  act(() => render(<Fields value="draft" />, host));
  expect(triggers[0].disabled).toBe(false);
  expect(nativeEvents).toEqual([]);
  expect([...host.querySelectorAll('.pc-custom-select-trigger')]).toEqual(triggers);
  expect([...document.querySelectorAll('.pc-custom-select-popover')]).toEqual(menus);
  act(() => render(null, host));
});

test.each(['text replacement', 'character data', 'label', 'value', 'default selection'] as const)(
  'native option %s mutations update an open enhancement', async mutation => {
    document.body.innerHTML = '<select aria-label="Cabin"><option value="forest">Forest cabin</option><option value="lake">Lake cabin</option></select>';
    installCustomSelects();
    await settle();
    const select = document.querySelector('select')!;
    const trigger = triggerOf(select);
    trigger.click();
    const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover')!;
    const [forest, lake] = [...select.options];
    if (mutation === 'text replacement') forest.textContent = 'Forest retreat';
    if (mutation === 'character data') forest.firstChild!.nodeValue = 'Forest retreat';
    if (mutation === 'label') forest.label = 'Forest retreat';
    if (mutation === 'value') forest.value = 'pine';
    if (mutation === 'default selection') lake.defaultSelected = true;
    await settle();

    const label = mutation === 'default selection' ? 'Lake cabin'
      : mutation === 'value' ? 'Forest cabin' : 'Forest retreat';
    expect(trigger.textContent).toBe(label);
    const selected = menu.querySelector<HTMLButtonElement>('[aria-selected="true"]')!;
    expect(selected.textContent).toBe(label);
    expect(selected.dataset.value).toBe(select.value);
    if (mutation === 'value') expect(select.value).toBe('pine');
  },
);

test('optgroup availability and labels stay current while its menu is open', async () => {
  document.body.innerHTML = '<select aria-label="Cabin"><option>Choose cabin</option><optgroup label="Woodland"><option value="forest">Forest cabin</option></optgroup></select>';
  installCustomSelects();
  await settle();
  const select = document.querySelector('select')!;
  triggerOf(select).click();
  const group = select.querySelector('optgroup')!;
  group.disabled = true;
  await settle();
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover')!;
  expect(menu.querySelector<HTMLButtonElement>('[data-value="forest"]')!.disabled).toBe(true);
  group.disabled = false;
  group.label = 'Lakeside';
  await settle();
  expect(menu.querySelector<HTMLButtonElement>('[data-value="forest"]')!.disabled).toBe(false);
  expect(menu.querySelector('.pc-custom-select-group')!.textContent).toBe('Lakeside');
});

test('form reset mirrors native defaults after its default action and respects cancellation', async () => {
  document.body.innerHTML = '<form><select aria-label="Cabin"><option value="forest" selected>Forest cabin</option><option value="lake">Lake cabin</option></select></form>';
  installCustomSelects();
  await settle();
  const form = document.querySelector('form')!;
  const select = form.querySelector('select')!;
  const trigger = triggerOf(select);
  const nativeEvents: string[] = [];
  select.addEventListener('input', e => nativeEvents.push(e.type));
  select.addEventListener('change', e => nativeEvents.push(e.type));
  select.value = 'lake';
  refreshCustomSelects();
  expect(trigger.textContent).toBe('Lake cabin');
  form.reset();
  await settle();
  expect(select.value).toBe('forest');
  expect(trigger.textContent).toBe('Forest cabin');

  select.value = 'lake';
  refreshCustomSelects();
  form.addEventListener('reset', event => event.preventDefault(), { once: true });
  form.reset();
  await settle();
  expect(select.value).toBe('lake');
  expect(trigger.textContent).toBe('Lake cabin');
  expect(nativeEvents).toEqual([]);
});
