import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));

function harness() {
  const dom = new JSDOM('<div id="editable" contenteditable></div>', { runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window;
  const host = w.document.querySelector('#editable');
  Object.assign(w, { editing: { on: true, el: host }, cwin: w, cdoc: w.document });
  const start = source.indexOf('function normalizeRichListStructure() {');
  const end = source.indexOf("\n$('#rt').addEventListener('mousedown'", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  w.eval(source.slice(start, end));
  return { w, host };
}

function malformedBlock(w, listTag, text, id) {
  const block = w.document.createElement('p');
  block.id = id;
  const list = w.document.createElement(listTag);
  const item = w.document.createElement('li');
  item.innerHTML = `<strong>${text.split(' ')[0]}</strong> ${text.split(' ').slice(1).join(' ')}`;
  list.appendChild(item);
  block.appendChild(list);
  return { block, list, item };
}

test.each(['ul', 'ol'])('normalizes a selected malformed %s without losing text, inline marks, nested lists or range', listTag => {
  const { w, host } = harness();
  const selected = malformedBlock(w, listTag, 'Community workshop guide', 'selected');
  selected.block.prepend(w.document.createTextNode('Before '));
  selected.block.append(w.document.createTextNode(' After'));
  const nested = w.document.createElement(listTag === 'ul' ? 'ol' : 'ul');
  nested.innerHTML = '<li>Nested <em>detail</em></li>';
  selected.item.appendChild(nested);
  const untouched = malformedBlock(w, listTag, 'Unselected block', 'untouched');
  host.append(selected.block, untouched.block);

  const range = w.document.createRange();
  range.selectNodeContents(selected.item);
  w.getSelection().addRange(range);
  const selectedText = w.getSelection().toString();

  expect(w.normalizeRichListStructure()).toBe(true);
  expect([...host.children].map(node => node.nodeName)).toEqual(['P', listTag.toUpperCase(), 'P', 'P']);
  expect(host.children[0].textContent).toBe('Before ');
  expect(host.children[1].querySelector('strong')?.textContent).toBe('Community');
  expect(host.children[1].querySelector(`${listTag} ${listTag === 'ul' ? 'ol' : 'ul'} em`)?.textContent).toBe('detail');
  expect(host.children[2].textContent).toBe(' After');
  expect(untouched.block.parentElement).toBe(host);
  expect(untouched.block.firstElementChild).toBe(untouched.list);
  expect(w.getSelection().toString()).toBe(selectedText);
  const anchorElement = w.getSelection().anchorNode.nodeType === 1
    ? w.getSelection().anchorNode : w.getSelection().anchorNode.parentElement;
  expect(anchorElement.closest('li').isSameNode(selected.item)).toBe(true);
});

test('leaves ordinary paragraphs and already-valid sibling lists unchanged', () => {
  const { w, host } = harness();
  host.innerHTML = '<p>Community <strong>workshop</strong> guide</p><ul><li>Existing list</li></ul>';
  const paragraph = host.firstElementChild;
  const range = w.document.createRange();
  range.selectNodeContents(paragraph);
  w.getSelection().addRange(range);
  const before = host.innerHTML;

  expect(w.normalizeRichListStructure()).toBe(false);
  expect(host.innerHTML).toBe(before);
  expect(host.firstElementChild).toBe(paragraph);
  expect(w.getSelection().toString()).toBe('Community workshop guide');
});

test('toolbar list commands normalize before the existing single sync', () => {
  const dom = new JSDOM('<div id="rt"><button data-c="insertUnorderedList">List</button></div><div id="editable" contenteditable></div>', { runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window;
  const host = w.document.querySelector('#editable');
  const malformed = malformedBlock(w, 'ul', 'Community workshop guide', 'selected');
  host.appendChild(malformed.block);
  const range = w.document.createRange();
  range.selectNodeContents(malformed.item);
  w.getSelection().addRange(range);
  const syncEdit = vi.fn();
  w.document.execCommand = vi.fn(() => true);
  Object.assign(w, {
    editing: { on: true, el: host }, cwin: w, cdoc: w.document, syncEdit,
    formatRichBlock: vi.fn(), linkPrompt: vi.fn(), $: selector => w.document.querySelector(selector),
  });
  const start = source.indexOf('function normalizeRichListStructure() {');
  const end = source.indexOf('\n\n/* Where a widget', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  w.eval(source.slice(start, end));

  w.document.querySelector('button').dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true }));

  expect(w.document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, null);
  expect(host.innerHTML).toBe('<ul><li><strong>Community</strong> workshop guide</li></ul>');
  expect(syncEdit).toHaveBeenCalledTimes(1);
});
