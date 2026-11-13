// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Control, Node as PcNode } from '../app/src/core/types';

beforeEach(() => {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
  C.state.meta.collections = [];
});

const control = (key: string) =>
  C.DEF.list.controls.content.find((candidate) => candidate.k === key)!;

function fixture() {
  const collection = C.collectionAdd('CMS order');
  const category = C.fieldAdd(collection.id, 'Category', 'text')!;
  for (const [title, value] of [
    ['Alpha', 'Accessibility'],
    ['Beta', 'Design'],
    ['Gamma', 'Accessibility'],
    ['Delta', 'Community'],
    ['Epsilon', 'Design'],
  ]) {
    const item = C.itemAdd(collection.id)!;
    C.itemSet(collection.id, item.id, 'title', title);
    C.itemSet(collection.id, item.id, category.id, value);
  }
  const heading = C.N('heading', { text: 'Item' });
  C.bindSet(heading, 'text', C.bindField('title'));
  const list = C.N('list', { per: '2' }, {}, [C.N('column', {}, {}, [heading])]);
  list.src = collection.id;
  C.state.pages[0].tree = [list];
  return { list, category };
}

const renderedHeadings = (list: PcNode) => {
  const html = C.buildPage(C.state.pages[0], { pageNo: C.state.ui.pno });
  const document = new DOMParser().parseFromString(html, 'text/html');
  return [...document.querySelectorAll(`#${C.domIdOf(list)} .pagecraft-heading`)].map(
    (heading) => heading.textContent,
  );
};

test('changing a list filter returns Preview to the first valid result page', () => {
  const { list, category } = fixture();
  C.state.ui.pno = 3;
  expect(renderedHeadings(list)).toEqual(['Epsilon']);

  C.applyC(list, control('where'), category.id);
  C.applyC(list, control('op'), 'not');
  C.applyC(list, control('val'), 'Accessibility');

  expect(C.state.ui.pno).toBe(1);
  expect(renderedHeadings(list)).toEqual(['Beta', 'Delta']);
});

test('only changed list inputs that affect result pages reset the preview page', () => {
  const { list } = fixture();
  const cases: Array<[string, string]> = [
    ['sort', 'title'],
    ['dir', 'desc'],
    ['where', 'title'],
    ['op', 'not'],
    ['val', 'Alpha'],
    ['per', '3'],
    ['limit', '4'],
  ];
  for (const [key, value] of cases) {
    C.state.ui.pno = 3;
    C.applyC(list, control(key), value);
    expect(C.state.ui.pno, key).toBe(1);
  }

  C.state.ui.pno = 3;
  C.applyC(list, control('per'), list.props.per);
  expect(C.state.ui.pno).toBe(3);

  C.applyC(list, control('collectionLayout'), 'slider');
  expect(C.state.ui.pno).toBe(3);

  const gap = C.DEF.list.controls.content.find((candidate) => candidate.c === 'gap')!;
  C.applyC(list, gap, '32px');
  expect(C.state.ui.pno).toBe(3);

  const next = C.collectionAdd('Next source');
  C.state.ui.pno = 3;
  C.srcSet(list, next.id);
  expect(C.state.ui.pno).toBe(1);
  C.state.ui.pno = 3;
  C.srcSet(list, next.id);
  expect(C.state.ui.pno).toBe(3);

  const heading = C.N('heading', { text: 'Before' });
  C.applyC(heading, { k: 'text' } as Control, 'After');
  expect(C.state.ui.pno).toBe(3);
});

test('schema cleanup resets only when it changes the active paginator query or source', () => {
  const { list, category } = fixture();
  list.props.where = category.id;
  list.props.op = 'not';
  list.props.val = 'Accessibility';

  const unrelated = C.collectionAdd('Unrelated');
  const unrelatedField = C.fieldAdd(unrelated.id, 'Category', 'text')!;
  C.state.ui.pno = 2;
  const prepared = C.clone(C.doc());
  const preparedCollections = C.clone(C.collections());
  const preparedSource = preparedCollections.find((col) => col.id === list.src)!;
  preparedSource.fields = preparedSource.fields.filter((field) => field.id !== category.id);
  C.collectionsReplace(prepared, preparedCollections);
  expect(C.state.ui.pno).toBe(2);

  const noOp = C.clone(C.collections());
  C.collectionsReplace(C.doc(), noOp);
  expect(C.state.ui.pno).toBe(2);

  const withoutUnrelatedField = C.clone(C.collections());
  const unrelatedCopy = withoutUnrelatedField.find((col) => col.id === unrelated.id)!;
  unrelatedCopy.fields = unrelatedCopy.fields.filter((field) => field.id !== unrelatedField.id);
  C.collectionsReplace(C.doc(), withoutUnrelatedField);
  expect(C.state.ui.pno).toBe(2);

  const withoutFilterField = C.clone(C.collections());
  const sourceCopy = withoutFilterField.find((col) => col.id === list.src)!;
  sourceCopy.fields = sourceCopy.fields.filter((field) => field.id !== category.id);
  C.collectionsReplace(C.doc(), withoutFilterField);
  expect(list.props.where).toBe('');
  expect(C.state.ui.pno).toBe(1);

  C.state.ui.pno = 3;
  const withoutSource = C.clone(C.collections()).filter((col) => col.id !== list.src);
  C.collectionsReplace(C.doc(), withoutSource);
  expect(list.src).toBeUndefined();
  expect(C.state.ui.pno).toBe(1);
});
