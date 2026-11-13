// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import type { Collection, Field, FieldType, Node as PcNode } from '../app/src/core/types';
import { install } from '../app/src/ui/ctx';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, stubLegacy, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function field(collection: Collection, id: string, name: string, type: FieldType): Field {
  const made = C.fieldAdd(collection.id, name, type)!;
  made.id = id;
  return made;
}

function listFor(collection: Collection, selected: Field, value = ''): PcNode {
  const list = C.N('list', { where: selected.id, op: 'is', val: value });
  C.srcSet(list, collection.id);
  C.state.pages[0].tree = [list];
  C.selSet([list.id]);
  return list;
}

const valueControl = () => C.DEF.list.controls.content.find(control => control.k === 'val')!;

function installHistory() {
  let transaction = '';
  const legacy = stubLegacy(r.calls);
  install(C, {
    ...legacy,
    tx(key: string) {
      r.calls.push(['tx', key]);
      if (transaction === key) return;
      transaction = key;
      C.checkpoint();
    },
    endTx() {
      r.calls.push(['endTx']);
      transaction = '';
    }
  });
}

test('boolean filter control is canonical, view-only, and one Undo restores the exact document', () => {
  const collection = C.collectionAdd('Flags')!;
  const enabled = field(collection, 'enabled', 'Enabled', 'bool');
  const list = listFor(collection, enabled, 'false');
  const before = JSON.stringify(C.doc());
  installHistory();

  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  const select = r.$('select.ctl') as HTMLSelectElement;
  assert.deepEqual([...select.options].map(option => [option.value, option.textContent]), [
    ['', 'Choose'], ['1', 'Yes'], ['0', 'No']
  ]);
  assert.equal(select.value, '0', 'recognized legacy aliases read as their canonical choice');
  assert.equal(JSON.stringify(C.doc()), before, 'rendering does not normalize or write the document');
  assert.equal(C.hist.u.length, 0, 'view-only rendering creates no history');

  act(() => r.pick(select, '1'));
  assert.equal(list.props.val, '1');
  assert.equal(C.hist.u.length, 1, 'one selection creates one checkpoint');
  assert.equal(r.names().filter(name => name === 'tx').length, 1);
  assert.equal(r.names().filter(name => name === 'endTx').length, 1);

  C.undo();
  assert.equal(JSON.stringify(C.doc()), before, 'one Undo restores the exact pre-selection document');
});

test('an unknown legacy boolean filter remains visible without being rewritten', () => {
  const collection = C.collectionAdd('Legacy flags')!;
  const enabled = field(collection, 'enabled', 'Enabled', 'bool');
  const list = listFor(collection, enabled, 'maybe');
  const before = JSON.stringify(C.doc());

  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  const select = r.$('select.ctl') as HTMLSelectElement;
  assert.equal(select.value, 'maybe');
  assert.equal([...select.options].find(option => option.value === 'maybe')?.textContent, 'Saved value: maybe');
  assert.equal(JSON.stringify(C.doc()), before);
  assert.equal(C.hist.u.length, 0);
});

test('option and reference controls keep configured, draft, and unavailable choices truthful', () => {
  const people = C.collectionAdd('People')!;
  const personTitle = people.fields[0];
  const ada = C.itemAdd(people.id)!;
  C.itemSet(people.id, ada.id, personTitle.id, 'Ada');
  const grace = C.itemAdd(people.id)!;
  C.itemSet(people.id, grace.id, personTitle.id, 'Grace');
  C.itemDraft(people.id, grace.id, true);

  const articles = C.collectionAdd('Articles')!;
  const category = field(articles, 'category', 'Category', 'option');
  category.opts = 'Guide, News, Guide';
  const author = field(articles, 'author', 'Author', 'ref');
  author.ref = people.id;
  const list = listFor(articles, category, 'Archived');

  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  let select = r.$('select.ctl') as HTMLSelectElement;
  assert.deepEqual([...select.options].map(option => option.textContent), [
    'Choose', 'Unavailable: Archived', 'Guide', 'News'
  ]);
  assert.equal(select.value, 'Archived');

  list.props.where = author.id;
  list.props.val = 'missing-person';
  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  select = r.$('select.ctl') as HTMLSelectElement;
  assert.deepEqual([...select.options].map(option => option.textContent), [
    'Choose', 'Unavailable: missing-person', 'Ada', 'Grace (draft)'
  ]);
  assert.equal(select.value, 'missing-person');
});

test('filter control resolves a component definition source unless the instance sets its own', () => {
  const definitionSource = C.collectionAdd('Definition flags')!;
  const definitionField = field(definitionSource, 'shared-filter', 'Enabled', 'bool');
  const explicitSource = C.collectionAdd('Instance scores')!;
  field(explicitSource, definitionField.id, 'Score', 'number');
  const list = listFor(definitionSource, definitionField, '0');
  const componentId = C.componentFromNode(list.id, 'Filtered list')!;
  assert.equal(list.use, componentId);
  assert.equal(list.src, undefined);

  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  assert.equal((r.$('select.ctl') as HTMLSelectElement).value, '0', 'definition source supplies the field type');

  C.srcSet(list, explicitSource.id);
  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  const input = r.$('input.ctl') as HTMLInputElement;
  assert.equal(input.type, 'number', 'instance source overrides the definition source');
  assert.equal(input.step, 'any');
  assert.equal(input.value, '0');
});

test('number, date, text, and bound filter controls use their native and inert shapes', () => {
  const collection = C.collectionAdd('Typed values')!;
  const number = field(collection, 'score', 'Score', 'number');
  const date = field(collection, 'day', 'Day', 'date');
  const text = field(collection, 'label', 'Label', 'text');
  const list = listFor(collection, number, '0');

  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  let input = r.$('input.ctl') as HTMLInputElement;
  assert.equal(input.type, 'number');
  assert.equal(input.step, 'any');
  assert.equal(input.value, '0');

  list.props.where = date.id;
  list.props.val = '2026-10-17';
  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  input = r.$('input.ctl') as HTMLInputElement;
  assert.equal(input.type, 'date');
  assert.equal(input.value, '2026-10-17');

  list.props.where = text.id;
  list.props.val = 'Journal';
  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  input = r.$('input.ctl') as HTMLInputElement;
  assert.equal(input.type, 'text');
  assert.equal(input.placeholder, 'e.g. Journal');

  C.bindSet(list, 'val', C.bindField(text.id));
  const before = JSON.stringify(C.doc());
  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  input = r.$('input.ctl') as HTMLInputElement;
  assert.equal(input.disabled, true);
  assert.equal(JSON.stringify(C.doc()), before);
});

test('switching every field type to contains keeps a free-text filter value', () => {
  const referenced = C.collectionAdd('Referenced')!;
  const collection = C.collectionAdd('Search values')!;
  const option = field(collection, 'kind', 'Kind', 'option'); option.opts = 'SILVER,Gold';
  const date = field(collection, 'day', 'Day', 'date');
  const boolean = field(collection, 'enabled', 'Enabled', 'bool');
  const number = field(collection, 'score', 'Score', 'number');
  const reference = field(collection, 'owner', 'Owner', 'ref'); reference.ref = referenced.id;
  const cases: Array<[Field, string]> = [
    [option, 'SIL'], [date, '2026'], [boolean, 'als'], [number, '.'], [reference, 'person']
  ];
  const opControl = C.DEF.list.controls.content.find(control => control.k === 'op')!;

  for (const [selected, fragment] of cases) {
    const list = listFor(collection, selected, fragment);
    r.draw(() => <Ctl n={list} c={opControl} />, 'right');
    act(() => r.pick(r.$('select.ctl')!, 'has'));
    assert.equal(list.props.op, 'has');
    assert.equal(list.props.val, fragment, `${selected.type} keeps its authored fragment`);

    r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
    const input = r.$('input.ctl') as HTMLInputElement;
    assert.equal(input.type, 'text', `${selected.type} contains uses free text`);
    assert.equal(input.value, fragment);
    assert.equal(input.placeholder, 'Text to find');
  }
});

test.each([
  ['number' as const, 'Gold', '12.5'],
  ['date' as const, 'someday', '2026-10-17']
])('invalid saved %s remains visible until one valid correction', (type, invalid, valid) => {
  const collection = C.collectionAdd('Legacy values')!;
  const selected = field(collection, type, type === 'number' ? 'Score' : 'Day', type);
  const list = listFor(collection, selected, invalid);
  const before = JSON.stringify(C.doc());
  installHistory();

  r.draw(() => <Ctl n={list} c={valueControl()} />, 'right');
  let input = r.$('input.ctl') as HTMLInputElement;
  assert.equal(input.type, 'text', 'malformed native value uses corrective text mode');
  assert.equal(input.value, invalid, 'saved value remains visible');
  assert.equal(JSON.stringify(C.doc()), before, 'render does not repair the model');
  assert.equal(C.hist.u.length, 0, 'render creates no history');

  act(() => r.type(input, valid));
  assert.equal(list.props.val, valid);
  assert.equal(C.hist.u.length, 1, 'correction opens one undo checkpoint');
  assert.equal((r.$('input.ctl') as HTMLInputElement).type, 'text', 'focus stays in corrective mode while typing');

  act(() => { input.dispatchEvent(new window.FocusEvent('blur', { bubbles: true })); });
  input = r.$('input.ctl') as HTMLInputElement;
  assert.equal(input.type, type, 'blur commits and restores the native input');
  assert.equal(input.value, valid);
  assert.equal(r.names().filter(name => name === 'tx').length, 1);
  assert.equal(r.names().filter(name => name === 'endTx').length, 1);

  C.undo();
  assert.equal(JSON.stringify(C.doc()), before, 'one Undo restores the exact malformed legacy value');
});

test('boolean aliases match only recognized truth values while blank and unknown stay distinct', () => {
  const collection = C.collectionAdd('Flags')!;
  const enabled = field(collection, 'enabled', 'Enabled', 'bool');
  const item = C.itemAdd(collection.id)!;
  const match = (raw: string, wanted: string, op = 'is') => {
    C.itemSet(collection.id, item.id, enabled.id, raw);
    return C.matches(collection, item, enabled.id, op, wanted);
  };

  for (const raw of ['1', 'true', 'TRUE', 'yes', 'YES']) {
    for (const wanted of ['1', 'true', 'yes']) assert.equal(match(raw, wanted), true, `${raw} matches ${wanted}`);
    assert.equal(match(raw, 'no'), false);
  }
  for (const raw of ['0', 'false', 'FALSE', 'no', 'NO']) {
    for (const wanted of ['0', 'false', 'no']) assert.equal(match(raw, wanted), true, `${raw} matches ${wanted}`);
    assert.equal(match(raw, 'yes'), false);
  }
  assert.equal(match('', 'no'), false, 'blank is not No');
  assert.equal(match('unknown', 'no'), false, 'unknown is not coerced to No');
  assert.equal(match('unknown', 'unknown'), true, 'the same legacy value remains filterable');
  assert.equal(match('false', 'als', 'has'), true, 'legacy contains semantics remain textual');
  assert.equal(match('false', 'no', 'not'), false, 'not uses the same normalized aliases');
});

test('numeric zero, blank values, and typed dates keep existing filter semantics', () => {
  const collection = C.collectionAdd('Values')!;
  const score = field(collection, 'score', 'Score', 'number');
  const day = field(collection, 'day', 'Day', 'date');
  const item = C.itemAdd(collection.id)!;

  C.itemSet(collection.id, item.id, score.id, '0');
  assert.equal(C.matches(collection, item, score.id, 'is', '0'), true);
  C.itemSet(collection.id, item.id, score.id, '');
  assert.equal(C.matches(collection, item, score.id, 'is', '0'), false);
  assert.equal(C.matches(collection, item, score.id, 'is', ''), true, 'blank filter value remains inactive');

  C.itemSet(collection.id, item.id, day.id, '2026-10-17');
  assert.equal(C.matches(collection, item, day.id, 'is', '2026-10-17'), true);
  assert.equal(C.matches(collection, item, day.id, 'is', '2026-10-18'), false);
});
