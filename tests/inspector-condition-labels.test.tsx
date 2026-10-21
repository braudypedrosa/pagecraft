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

test('Visibility condition controls expose their visible labels to assistive technology', () => {
  const collection = C.collectionAdd('Articles');
  const field = C.fieldAdd(collection.id, 'Status', 'text')!;
  const node = C.insert('heading', null, 0)!;
  C.srcSet(node, collection.id);
  node.showIf = { bind: { src: 'field', path: field.id }, op: 'eq', value: 'published' };
  C.selSet([node.id]);
  C.state.ui.stab = 'advanced';

  r.draw(<Inspector />, 'right');
  const source = r.$$('select').find(select =>
    [...(select as HTMLSelectElement).options].some(option => option.value === `field:${field.id}`));
  assert.ok(source);
  assert.equal(source.getAttribute('aria-label'), 'Show only if');

  const operator = r.$$('select').find(select => select !== source &&
    [...(select as HTMLSelectElement).options].some(option => option.value === 'eq'));
  assert.ok(operator);
  assert.equal(operator.getAttribute('aria-label'), 'Condition');

  const value = r.$('input[placeholder="Value to compare"]');
  assert.ok(value);
  assert.equal(value.getAttribute('aria-label'), 'Value to compare');
});
