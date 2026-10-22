// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function condition(value: string, op: 'eq' | 'ne' = 'eq') {
  const collection = C.collectionAdd('Flags')!;
  const field = C.fieldAdd(collection.id, 'Enabled', 'bool')!;
  const node = C.insert('heading', null, 0)!;
  C.srcSet(node, collection.id);
  node.showIf = { bind: { src: 'field', path: field.id }, op, value };
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.draw(<Inspector />, 'right');
  return { node, field };
}

function valueSelect() {
  return r.$('select[aria-label="Value to compare"]') as HTMLSelectElement;
}

test.each(['1', '0', ''])('boolean comparison offers %s and writes the stored value', value => {
  const { node } = condition('');
  const select = valueSelect();
  assert.deepEqual([...select.options].map(option => [option.value, option.textContent]), [
    ['', 'Empty value'], ['1', 'Yes'], ['0', 'No']
  ]);

  act(() => r.pick(select, value));
  assert.equal(select.value, value);
  assert.equal(node.showIf?.value, value);
  assert.equal(node.showIf?.op, 'eq');
});

test('boolean comparisons support is not without changing the value control', () => {
  const { node } = condition('1', 'ne');
  assert.equal((r.$('select[aria-label="Condition"]') as HTMLSelectElement).value, 'ne');
  assert.equal(valueSelect().value, '1');
  assert.equal(node.showIf?.value, '1');
});

test('saved unsupported boolean values use an explicit custom option without mutation', () => {
  const { node } = condition('maybe');
  const before = JSON.stringify(C.doc());
  const select = valueSelect();
  assert.equal(select.value, 'maybe');
  assert.equal([...select.options].at(-1)?.textContent, 'Custom value (maybe)');
  assert.equal(JSON.stringify(C.doc()), before);

  act(() => r.pick(select, '1'));
  assert.equal(node.showIf?.value, '1');
});

test('non-boolean field comparisons retain their text input', () => {
  const collection = C.collectionAdd('Articles')!;
  const field = C.fieldAdd(collection.id, 'Title', 'text')!;
  const node = C.insert('heading', null, 0)!;
  C.srcSet(node, collection.id);
  node.showIf = { bind: { src: 'field', path: field.id }, op: 'eq', value: 'Draft' };
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';
  r.draw(<Inspector />, 'right');
  const input = r.$('input[aria-label="Value to compare"]') as HTMLInputElement;
  assert.ok(input);
  assert.equal(input.value, 'Draft');
  act(() => {
    input.value = 'Published';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(node.showIf?.value, 'Published');
});

test.each(['set', 'empty'] as const)('operator %s has no comparison control', op => {
  condition('', 'eq');
  const operator = r.$('select[aria-label="Condition"]') as HTMLSelectElement;
  act(() => r.pick(operator, op));
  r.draw(<Inspector />, 'right');
  assert.equal(r.$('[aria-label="Value to compare"]'), null);
});
