import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { installCustomSelects } from '../shared/custom-select.js';

const source = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const start = source.indexOf('function bindModal(rootId)');
const end = source.indexOf('\nfunction findModal()', start);
const bindModal = new Function(`return ${source.slice(start, end)}`)();

let dom;
let previousGlobals;
afterEach(() => {
  dom?.window.close();
  dom = undefined;
  if (previousGlobals) {
    for (const [key, descriptor] of previousGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    previousGlobals = undefined;
  }
});

function harness(slots) {
  dom = new JSDOM('<!doctype html><html><body><h1 id="mTitle"></h1><div id="mBody"></div></body></html>', {
    url: 'http://localhost/'
  });
  const { window } = dom;
  const { document } = window;
  const globals = {
    window, document, HTMLElement: window.HTMLElement, HTMLSelectElement: window.HTMLSelectElement,
    MutationObserver: window.MutationObserver, requestAnimationFrame: callback => setTimeout(callback, 0),
    getComputedStyle: window.getComputedStyle, Event: window.Event
  };
  const selected = {};
  const applied = [];
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const $ = selector => document.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  Object.assign(globals, {
    editing: { on: false }, exitEdit() {},
    bindScope: () => ({ col: { name: 'Community workshops', fields: [] } }),
    fieldPaths: () => [
      { path: 'title', label: 'Title', type: 'text' },
      { path: 'link-url', label: 'Link URL', type: 'link' }
    ],
    bindSlots: () => slots,
    guessBindings: rows => Object.fromEntries(rows.map(row => [`${row.nodeId}|${row.key}`, selected[`${row.nodeId}|${row.key}`] || ''])),
    esc, $, $$,
    openModal: (title, body, footer) => {
      $('#mTitle').textContent = title;
      $('#mBody').innerHTML = body;
      $('#mBody').insertAdjacentHTML('afterend', `<div id="modalFooter">${footer || ''}</div>`);
    },
    applyBindings: map => applied.push({ ...map }),
    edit: callback => callback(), closeModal() {}, render() {}, toast() {}, DEF: {
      heading: { label: 'Heading' }, button: { label: 'Button' }
    }
  });
  previousGlobals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  bindModal('root');
  return { window, document, applied };
}

test('a single binding row keeps its descriptive name without an artificial index', () => {
  const { document } = harness([
    { nodeId: 'h1', type: 'heading', key: 'text', ctl: 'text', element: 'Card', label: 'Title', current: '', fieldTypes: ['text'] }
  ]);
  const select = document.querySelector('#bsBody select');
  assert.equal(select?.getAttribute('aria-label'), 'Card · Heading · Title');
});

test('binding rows expose unique escaped names and custom-select names', async () => {
  const slots = [
    { nodeId: 'h1', type: 'heading', key: 'text', ctl: 'text', element: 'Heading', label: 'Title', current: '', fieldTypes: ['text'] },
    { nodeId: 'h2', type: 'heading', key: 'text', ctl: 'text', element: 'Heading', label: 'Title', current: '', fieldTypes: ['text'] },
    { nodeId: 'b1', type: 'button', key: 'link', ctl: 'link', element: 'Card <x>', label: 'URL & "safe"', current: '', fieldTypes: ['link'] }
  ];
  const { document, applied } = harness(slots);
  const selects = [...document.querySelectorAll('#bsBody select')];
  assert.equal(selects.length, 3);
  const names = selects.map(select => select.getAttribute('aria-label'));
  assert.deepEqual(names, [
    'Heading · Heading · Title · 1',
    'Heading · Heading · Title · 2',
    'Card <x> · Button · URL & "safe"'
  ]);
  assert.equal(new Set(names).size, names.length);
  assert.equal(document.querySelector('#mTitle').textContent, 'Bind to Community workshops');
  assert.match(document.querySelector('#mBody').textContent, /Card <x>/);
  assert.equal(document.querySelectorAll('.pc-custom-select-trigger').length, 0);

  installCustomSelects();
  await new Promise(resolve => setTimeout(resolve, 0));
  const triggers = [...document.querySelectorAll('.pc-custom-select-trigger')];
  assert.equal(triggers.length, 3);
  assert.deepEqual(triggers.map(trigger => trigger.getAttribute('aria-label')), names);

  triggers[2].click();
  const option = [...document.querySelectorAll('.pc-custom-select-option')]
    .find(button => button.dataset.value === 'link-url');
  assert.ok(option, 'the enhanced link picker should expose the original option');
  option.click();
  assert.equal(selects[2].value, 'link-url');
  document.querySelector('#bsOk').click();
  assert.equal(applied.length, 1);
  assert.equal(applied[0]['b1|link'], 'link-url');
});
