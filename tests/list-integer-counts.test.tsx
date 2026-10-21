// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Node as PcNode } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function fixture() {
  const col = C.collectionAdd('Count records')!;
  const title = C.titleField(col)!;
  for (let i = 1; i <= 18; i++) {
    const item = C.itemAdd(col.id)!;
    C.itemSet(col.id, item.id, title.id, `Record ${i}`);
  }
  const list = C.insert('list', null, 0)!;
  C.srcSet(list, col.id);
  const heading = C.N('heading');
  C.bindSet(heading, 'text', C.bindField(title.id));
  list.children[0].children.push(heading);
  C.selSet([list.id]);
  return { list, col, page: C.state.pages[0] };
}
function field(list: PcNode, key: 'per' | 'limit') {
  const control = C.DEF.list.controls.content.find(c => c.k === key)!;
  act(() => r.draw(<Ctl n={list} c={control} />));
  return r.$('input[data-field-part="value"]') as HTMLInputElement;
}
function enter(list: PcNode, key: 'per' | 'limit', value: string) {
  const input = field(list, key);
  act(() => { r.type(input, value); input.dispatchEvent(new Event('blur', { bubbles: true })); });
  return input;
}
function reload(list: PcNode) {
  const snapshot = C.clone(C.doc());
  act(() => r.draw(null));
  C.blankProject('Reload');
  C.restore(snapshot);
  return C.locate(list.id)!.node;
}
function compiledTitles(html: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return [...parsed.querySelectorAll('.pagecraft-list .pagecraft-heading')].map(el => el.textContent);
}

for (const key of ['per', 'limit'] as const) test(`List ${key} rounds through the real control and persists an integer after reload`, () => {
  let { list } = fixture();
  const input = enter(list, key, '2.5');
  assert.equal(input.value, '3');
  assert.equal(list.props[key], '3');
  assert.equal(input.step, '1');
  assert.equal(input.min, '0');
  assert.equal(input.validity.valid, true);
  list = reload(list);
  assert.equal(field(list, key).value, '3');
  assert.equal(list.props[key], '3');
});

test('both List count controls preserve whole/zero/empty values and clamp negatives without fractional writes', () => {
  const { list } = fixture();
  for (const key of ['per', 'limit'] as const) {
    for (const [value, expected] of [['2.49', '2'], ['-2.5', '0'], ['0', '0'], ['4', '4'], ['', '']]) {
      const input = enter(list, key, value);
      assert.equal(input.value, expected);
      assert.equal(list.props[key], expected);
      assert.equal(input.validity.valid, true);
    }
  }
});

test('rounded per-page value agrees with compiled page/card counts while preserving a hidden limit', () => {
  let { list } = fixture();
  list.props.limit = '4';
  enter(list, 'per', '2.5');
  list = reload(list);
  const page = C.state.pages[0], col = C.findCollection(list.src!)!;
  assert.equal(list.props.per, '3');
  assert.equal(list.props.limit, '4');
  assert.equal(C.listItems(list, col).length, 18);
  assert.equal(C.listPageCount(list, col), 6);
  const targets = C.exportTargets().filter(target => target.pg.id === page.id);
  assert.equal(targets.length, 6);
  const titles = targets.flatMap(target => {
    const titles = compiledTitles(C.buildPage(target.pg, target));
    assert.equal(titles.length, 3);
    return titles;
  });
  assert.equal(new Set(titles).size, 18);
});

test('rounded limit agrees with compiled output and zero or clearing restores every item', () => {
  let { list } = fixture();
  enter(list, 'limit', '2.5');
  list = reload(list);
  assert.equal(compiledTitles(C.buildPage(C.state.pages[0])).length, 3);
  for (const value of ['0', '']) {
    enter(list, 'limit', value);
    assert.equal(compiledTitles(C.buildPage(C.state.pages[0])).length, 18);
  }
});

test('legacy saved fractions keep their existing parseInt rendering until the author edits a control', () => {
  let { list } = fixture();
  list.props.per = '2.5'; list.props.limit = '2.5';
  list = reload(list);
  const before = JSON.stringify(C.doc()), col = C.findCollection(list.src!)!;
  assert.equal(field(list, 'per').value, '2.5');
  assert.equal(C.listPageCount(list, col), 9);
  assert.equal(compiledTitles(C.buildPage(C.state.pages[0], { pageNo: 1 })).length, 2);
  assert.equal(JSON.stringify(C.doc()), before);
  list.props.per = '';
  assert.equal(C.listItems(list, col).length, 2);
  assert.equal(compiledTitles(C.buildPage(C.state.pages[0])).length, 2);
  assert.equal(list.props.limit, '2.5');
});
