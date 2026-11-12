// @vitest-environment jsdom
import { beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import * as C from '../app/src/core/index';
import type { Binding, CondOp, FieldType } from '../app/src/core/types';

beforeEach(() => {
  C.blankProject('Workshop condition checks');
  C.state.ui = C.initUi();
  C.state.meta.collections = [];
  C.state.meta.components = [];
});

function fieldFixture(type: FieldType = 'bool') {
  const col = C.collectionAdd('Workshops')!;
  const field = C.fieldAdd(col.id, 'Featured', type)!;
  const item = C.itemAdd(col.id)!;
  const node = C.N('heading', { text: 'Workshop details' });
  const result = (raw: string, op: CondOp, value = '') => {
    C.itemSet(col.id, item.id, field.id, raw);
    C.condSet(node, { bind: C.bindField(field.id)!, op, value });
    return C.showsNode(node, col, item);
  };
  return { col, field, item, node, result };
}

const yes = ['1', 'true', 'yes', ' TRUE ', ' Yes '];
const no = ['0', 'false', 'no', ' FALSE ', ' No '];

test('typed boolean equality and inequality recognize every accepted alias on both sides', () => {
  const { result } = fieldFixture();
  for (const actual of [...yes, ...no]) {
    for (const expected of [...yes, ...no]) {
      const equal = yes.includes(actual) === yes.includes(expected);
      assert.equal(result(actual, 'eq', expected), equal, `${actual} is ${expected}`);
      assert.equal(result(actual, 'ne', expected), !equal, `${actual} is not ${expected}`);
    }
  }
});

test('boolean No aliases have a value and remain distinct from an empty field', () => {
  const { result } = fieldFixture();
  for (const raw of no) {
    assert.equal(result(raw, 'set'), true, raw);
    assert.equal(result(raw, 'empty'), false, raw);
    assert.equal(result(raw, 'eq', ''), false, raw);
    assert.equal(result(raw, 'ne', ''), true, raw);
  }
  for (const raw of ['', ' \n ']) {
    assert.equal(result(raw, 'set'), false);
    assert.equal(result(raw, 'empty'), true);
    assert.equal(result(raw, 'eq', ''), true);
    assert.equal(result(raw, 'ne', ''), false);
    assert.equal(result(raw, 'eq', '0'), false);
    assert.equal(result(raw, 'ne', '0'), true);
  }
});

test('unrecognized boolean values keep exact comparisons rather than becoming No', () => {
  const { result } = fieldFixture();
  for (const raw of ['maybe', '2', 'off', 'falsehood']) {
    assert.equal(result(raw, 'set'), true);
    for (const value of [...yes, ...no, '']) {
      assert.equal(result(raw, 'eq', value), false, `${raw} is ${value}`);
      assert.equal(result(raw, 'ne', value), true, `${raw} is not ${value}`);
    }
    assert.equal(result(raw, 'eq', raw), true);
    if (raw !== raw.toUpperCase()) {
      assert.equal(result(raw, 'eq', raw.toUpperCase()), false, 'existing literal case sensitivity');
    }
  }
  assert.equal(result('false', 'eq', 'maybe'), false);
  assert.equal(result('false', 'ne', 'maybe'), true);
});

test('Text comparisons remain literal and numeric zero remains present', () => {
  const text = fieldFixture('text');
  assert.equal(text.result('false', 'eq', '0'), false);
  assert.equal(text.result('false', 'ne', '0'), true);
  assert.equal(text.result('TRUE', 'eq', 'true'), false);
  assert.equal(text.result('false', 'eq', 'false'), true);
  const number = fieldFixture('number');
  assert.equal(number.result('0', 'set'), true);
  assert.equal(number.result('0', 'empty'), false);
  assert.equal(number.result('0', 'eq', 'false'), false);
});

test('referenced booleans use the terminal field kind and missing or draft targets stay empty', () => {
  const { col, field, item, node } = fieldFixture();
  C.itemSet(col.id, item.id, field.id, 'false');
  const listings = C.collectionAdd('Listings')!;
  const ref = C.fieldAdd(listings.id, 'Workshop', 'ref')!;
  ref.ref = col.id;
  const listing = C.itemAdd(listings.id)!;
  C.itemSet(listings.id, listing.id, ref.id, item.id);
  const binding = C.bindField(`${ref.id}.${field.id}`)!;
  C.condSet(node, { bind: binding, op: 'eq', value: '0' });
  assert.equal(C.showsNode(node, listings, listing), true);
  C.itemDraft(col.id, item.id, true);
  assert.equal(C.showsNode(node, listings, listing), false, 'draft reference is not No');
  C.condSet(node, { bind: binding, op: 'empty' });
  assert.equal(C.showsNode(node, listings, listing), true);
  C.itemSet(listings.id, listing.id, ref.id, 'missing');
  assert.equal(C.showsNode(node, listings, listing), true);
});

function componentFixture() {
  const root = C.N('box', {}, {}, [
    C.N('heading', { text: 'Workshop details' }),
    C.N('image', { src: 'https://example.invalid/workshop.webp', decorative: 1 })
  ]);
  C.state.pages[0].tree = [root];
  const cid = C.componentFromNode(root.id, 'Workshop card')!;
  const def = C.findComponent(cid)!;
  const toggle = C.DEF.image.controls.content.find(control => control.k === 'decorative')!;
  const property = C.propFromControl(cid, def.node.children[1].id, toggle)!;
  const instance = C.locate(root.id)!.node;
  const witness = def.node.children[0];
  return { def, property, instance, witness };
}

test('boolean component defaults, variants, local values and intentional empty remain distinct', () => {
  const { def, property, instance, witness } = componentFixture();
  C.condSet(witness, { bind: { src: 'prop', path: property }, op: 'eq', value: '0' });
  const result = () => C.showsNode(witness, null, null, instance, def);
  assert.equal(result(), false, 'default Yes');
  C.instSet(instance, property, 'false');
  C.variantFromInstance(instance, 'Quiet workshop');
  delete instance.vals;
  assert.equal(result(), true, 'variant No alias');
  C.instSet(instance, property, 'yes');
  assert.equal(result(), false, 'local Yes alias');
  C.instSet(instance, property, '');
  assert.equal(result(), false, 'intentional empty is not No');
  C.condSet(witness, { bind: { src: 'prop', path: property }, op: 'empty' });
  assert.equal(result(), true);
  C.instSet(instance, property, undefined);
  assert.equal(result(), false, 'reset resumes nonempty variant');
});

test('CMS-bound component conditions use the terminal kind and never rewrite raw values', () => {
  const { def, property, instance, witness } = componentFixture();
  const { col, field, item } = fieldFixture();
  C.itemSet(col.id, item.id, field.id, 'false');
  C.bindSet(instance, C.VAL + property, C.bindField(field.id));
  const condition = { bind: { src: 'prop' as const, path: property }, op: 'eq' as const, value: '0' };
  C.condSet(witness, condition);
  const before = JSON.stringify(C.doc());
  assert.equal(C.condValue(condition, col, item, instance, def), 'false');
  assert.equal(C.showsNode(witness, col, item, instance, def), true);
  assert.equal(JSON.stringify(C.doc()), before, 'evaluation does not normalize stored data');

  const text = C.fieldAdd(col.id, 'Literal', 'text')!;
  C.itemSet(col.id, item.id, text.id, 'false');
  C.bindSet(instance, C.VAL + property, C.bindField(text.id));
  assert.equal(C.showsNode(witness, col, item, instance, def), false, 'Text overrides bool property kind');
  const label = C.propAdd(def.id, 'Label', 'text', 'false')!;
  C.bindSet(instance, C.VAL + label, C.bindField(field.id));
  C.condSet(witness, { ...condition, bind: { src: 'prop', path: label } });
  assert.equal(C.showsNode(witness, col, item, instance, def), true, 'bool overrides Text property kind');
});

test('direct and component conditions share repeated public/editor membership after save and reopen', () => {
  const { def, property, instance, witness } = componentFixture();
  const { col, field, item: first } = fieldFixture();
  const title = C.titleField(col)!;
  const entries = [
    ['Pine workshop', 'true'], ['Lake workshop', 'false'], ['Meadow workshop', 'no'],
    ['Hill workshop', 'yes'], ['Valley workshop', '0'], ['Ridge workshop', 'FALSE']
  ];
  for (const [index, [name, featured]] of [...entries, ['Hidden workshop', 'false']].entries()) {
    const item = index === 0 ? first : C.itemAdd(col.id)!;
    C.itemSet(col.id, item.id, title.id, name);
    C.itemSet(col.id, item.id, field.id, featured);
    if (name === 'Hidden workshop') C.itemDraft(col.id, item.id, true);
  }
  C.bindSet(witness, 'text', C.bindField(title.id));
  C.bindSet(instance, C.VAL + property, C.bindField(field.id));
  const direct = C.N('heading');
  C.bindSet(direct, 'text', C.bindField(title.id));
  const directList = C.N('list', {}, {}, [direct]);
  const componentList = C.N('list', {}, {}, [instance]);
  C.srcSet(directList, col.id);
  C.srcSet(componentList, col.id);
  C.state.pages[0].tree = [directList, componentList];

  for (const op of ['eq', 'ne'] as const) {
    const expected = entries.filter(([, value]) => (op === 'eq') === no.map(v => v.trim().toLowerCase()).includes(value.toLowerCase()))
      .map(([name]) => name);
    const currentDirect = C.locate(direct.id)!.node;
    const currentWitness = C.findComponent(def.id)!.node.children[0];
    for (const [node, bind] of [[currentDirect, C.bindField(field.id)!], [currentWitness, { src: 'prop', path: property }]] as [typeof direct, Binding][]) {
      C.condSet(node, { bind, op, value: '0' });
    }
    const saved = JSON.stringify(C.doc());
    C.restore(C.migrate(JSON.parse(saved))!);
    for (const list of C.tree()) {
      const publicDom = new DOMParser().parseFromString(C.renderNode(list, { edit: false }), 'text/html');
      assert.deepEqual([...publicDom.querySelectorAll('h2')].map(node => node.textContent), expected);
      const editorDom = new DOMParser().parseFromString(C.renderNode(list, { edit: true }), 'text/html');
      assert.equal(editorDom.querySelectorAll('h2').length, entries.length, 'all published entries stay editable');
      assert.deepEqual([...editorDom.querySelectorAll('h2:not(.s-cond-off)')].map(node => node.textContent), expected);
    }
    assert.equal(JSON.stringify(C.doc()), saved, 'rendering and reopen preserve imported alias strings');
  }
});
