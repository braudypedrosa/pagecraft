import { beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('builder.html', 'utf8');
const start = source.indexOf('let elementClipboardCut = false;');
const end = source.indexOf('\n/* ---- one dispatcher for every element verb', start);
if (start < 0 || end < 0) throw new Error('element clipboard helpers are missing from builder.html');
const helperSource = source.slice(start, end);

const clone = value => JSON.parse(JSON.stringify(value));
const eachNode = (list, fn, parent = null) => list.forEach((node, index) => {
  fn(node, parent, index);
  eachNode(node.children || [], fn, node);
});
const find = (id, list, parent = null) => {
  for (let index = 0; index < list.length; index++) {
    const node = list[index];
    if (node.id === id) return { node, list, parent, i: index };
    const child = find(id, node.children || [], node);
    if (child) return child;
  }
  return null;
};

let h;
beforeEach(() => {
  const target = { id: 'target', type: 'column', children: [] };
  const secondTarget = { id: 'second-target', type: 'column', children: [] };
  const form = { id: 'form-original', type: 'form', children: [] };
  const page = [target, form];
  const secondPage = [secondTarget];
  const pages = [page, secondPage];
  const header = [];
  const footer = [];
  const definitions = [];
  const state = { ui: { mode: 'page' }, page: 0 };
  const clip = { node: null };
  let serial = 0;

  const currentTree = () => state.ui.mode === 'component' ? [definitions[0].node] : pages[state.page];
  const locate = id => find(id, currentTree());
  const locateAny = id => find(id, header) || find(id, footer)
    || pages.map(nodes => find(id, nodes)).find(Boolean) || null;
  const copyNode = vi.fn(id => {
    const hit = locate(id);
    if (!hit) return false;
    clip.node = clone(hit.node);
    return true;
  });
  const delNode = vi.fn(id => {
    const hit = locate(id);
    if (hit) hit.list.splice(hit.i, 1);
  });
  const dropTree = vi.fn((node, intoId) => {
    const into = locate(intoId);
    if (!into) return null;
    into.node.children.push(node);
    return node;
  });
  const pasteNode = vi.fn(intoId => {
    if (!clip.node) return null;
    const node = clone(clip.node);
    eachNode([node], item => { item.id = `copy-${++serial}`; });
    return dropTree(node, intoId);
  });
  const factory = new Function('copyNode', 'state', 'locate', 'canStructure', 'edit', 'delNode',
    'clip', 'eachNode', 'locateAny', 'components', 'dropTree', 'clone', 'pasteNode',
    `${helperSource}\nreturn { copyElement, cutElement, clipboardIdsInUse, pasteElement };`);
  const helpers = factory(copyNode, state, locate, () => true, fn => fn(), delNode,
    clip, eachNode, locateAny, () => definitions, dropTree, clone, pasteNode);
  h = { ...helpers, state, clip, page, secondPage, pages, header, footer, definitions,
    target, secondTarget, form,
    copyNode, delNode, dropTree, pasteNode };
});

test('cut and paste moves a Form without changing its submission identity', () => {
  expect(h.cutElement(h.form.id)).toBe(true);
  expect(h.page.some(node => node.id === h.form.id)).toBe(false);

  const moved = h.pasteElement(h.target.id);
  expect(moved.id).toBe('form-original');
  expect(h.target.children[0].id).toBe('form-original');
  expect(h.dropTree).toHaveBeenCalledTimes(1);
  expect(h.pasteNode).not.toHaveBeenCalled();
});

test('cut keeps identity when a Form moves to another page', () => {
  expect(h.cutElement(h.form.id)).toBe(true);
  h.state.page = 1;
  const moved = h.pasteElement(h.secondTarget.id);
  expect(moved.id).toBe('form-original');
  expect(h.secondTarget.children[0].id).toBe('form-original');
});

test('copy and repeated paste still generate fresh ids', () => {
  expect(h.copyElement(h.form.id)).toBe(true);
  const copied = h.pasteElement(h.target.id);
  expect(copied.id).not.toBe(h.form.id);

  expect(h.cutElement(h.form.id)).toBe(true);
  const moved = h.pasteElement(h.target.id);
  const repeated = h.pasteElement(h.target.id);
  expect(moved.id).toBe('form-original');
  expect(repeated.id).not.toBe('form-original');
});

test('an Undo or descendant-id conflict turns the pending move into a safe copy', () => {
  const group = { id: 'group-original', type: 'box', children: [h.form] };
  h.page.splice(h.page.indexOf(h.form), 1, group);
  expect(h.cutElement(group.id)).toBe(true);

  h.header.push({ id: 'shared-root', type: 'section', children: [
    { id: 'form-original', type: 'form', children: [] }
  ] });
  expect(h.clipboardIdsInUse()).toBe(true);
  const pasted = h.pasteElement(h.target.id);
  expect(pasted.id).not.toBe('group-original');
  expect(pasted.children[0].id).not.toBe('form-original');
  expect(h.pasteNode).toHaveBeenCalledTimes(1);
});

test('component definitions participate in descendant identity conflict checks', () => {
  expect(h.cutElement(h.form.id)).toBe(true);
  h.definitions.push({ id: 'component-one', node: {
    id: 'component-root', type: 'section', children: [
      { id: 'form-original', type: 'form', children: [] }
    ]
  } });
  expect(h.clipboardIdsInUse()).toBe(true);
  expect(h.pasteElement(h.target.id).id).not.toBe('form-original');
});

test('a component definition root cannot be cut or mark the clipboard as a move', () => {
  h.definitions.push({ id: 'component-one', node: {
    id: 'component-root', type: 'section', children: []
  } });
  h.state.ui.mode = 'component';
  expect(h.cutElement('component-root')).toBe(false);
  expect(h.copyNode).not.toHaveBeenCalled();
  expect(h.delNode).not.toHaveBeenCalled();
  expect(h.clip.node).toBe(null);
});
