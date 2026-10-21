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

function componentFixture() {
  const root = C.insert('heading', null, 0)!;
  const componentId = C.componentFromNode(root.id, 'Conditional heading')!;
  const definition = C.findComponent(componentId)!;
  const property = C.propAdd(componentId, 'Visible', 'text', 'yes')!;
  definition.node.showIf = { bind: { src: 'prop', path: property }, op: 'set', value: '' };
  const instance = C.locate(root.id)!.node;
  instance.showIf = { bind: { src: 'field', path: 'legacy-missing-field' }, op: 'eq', value: 'yes' };
  C.selSet([instance.id]);
  C.state.ui.stab = 'advanced';
  return { componentId, definition, instance, property };
}

test('an instance routes its source-owned condition action to the definition root without changing document data', () => {
  const { componentId, definition, instance } = componentFixture();
  const before = JSON.stringify(C.doc());
  const legacy = JSON.stringify(instance.showIf);

  r.draw(<Inspector />, 'right');
  assert.equal(r.$('.component-condition-owner')?.textContent?.trim(), 'Edit component condition');
  assert.equal(r.$('.component-condition-owner')?.getAttribute('title'),
    'This condition belongs to the component definition');
  assert.doesNotMatch(r.host.textContent || '', /Show only if|Choose an option/);
  assert.equal(r.$('.component-condition-owner')?.previousElementSibling?.textContent, 'Condition');

  act(() => r.click(r.$('.component-condition-owner')));
  assert.equal(r.arg('editComponent')?.[0], componentId);
  assert.equal(r.arg('select')?.[0], definition.node.id);
  assert.deepEqual(r.arg('select')?.[1], { scroll: false });
  assert.equal(C.state.ui.stab, 'advanced');
  assert.equal(C.state.ui.mode, 'component');
  assert.equal(C.state.ui.cedit, componentId);
  assert.equal(JSON.stringify(C.doc()), before);
  assert.equal(JSON.stringify(instance.showIf), legacy);
});

test('an instance with no source condition hides its inert clone while retaining breakpoint visibility controls', () => {
  const { definition, instance } = componentFixture();
  delete definition.node.showIf;
  const legacy = JSON.stringify(instance.showIf);

  r.draw(<Inspector />);
  assert.equal(r.$('.component-condition-owner'), null);
  assert.doesNotMatch(r.host.textContent || '', /Show only if|Choose an option/);
  assert.equal(r.$$('button[role="switch"]').length, 3);
  assert.equal(JSON.stringify(instance.showIf), legacy);
});

test('the definition keeps property conditions and an ordinary CMS node keeps field conditions', () => {
  const { componentId, definition, property } = componentFixture();
  C.componentOpen(componentId);
  C.selSet([definition.node.id]);
  C.state.ui.stab = 'advanced';
  r.draw(<Inspector />);

  const propertySource = r.$$('select').find(select =>
    [...(select as HTMLSelectElement).options].some(option => option.value === `prop:${property}`)) as HTMLSelectElement;
  assert.ok(propertySource);
  assert.equal(propertySource.value, `prop:${property}`);
  assert.equal(r.$('.component-condition-owner'), null);

  C.componentClose();
  const collection = C.collectionAdd('Articles');
  const field = C.fieldAdd(collection.id, 'Status', 'text')!;
  const ordinary = C.insert('heading', null, 0)!;
  C.srcSet(ordinary, collection.id);
  C.selSet([ordinary.id]);
  C.state.ui.stab = 'advanced';
  r.draw(<Inspector />);

  const fieldSource = r.$$('select').find(select =>
    [...(select as HTMLSelectElement).options].some(option => option.value === `field:${field.id}`)) as HTMLSelectElement;
  assert.ok(fieldSource);
  assert.equal(fieldSource.value, '');
  assert.match(r.host.textContent || '', /Show only if/);
});
