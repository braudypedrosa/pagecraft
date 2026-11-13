import { beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import * as C from '../app/src/core/index';

beforeEach(() => C.blankProject('List default card basis'));

test('palette Lists seed a 280px desktop card basis and full-width mobile cards', () => {
  const list = C.insert('list', null, 0)!;
  const card = list.children[0];
  assert.equal(card.type, 'column');
  assert.equal(card.css.d['flex-basis'], '280px');
  assert.equal(card.css.t['flex-basis'], undefined, 'Tablet inherits the desktop basis');
  assert.equal(card.css.m['flex-basis'], '100%');
});

test('the List seed does not change generic Columns or authored List children', () => {
  const column = C.N('column');
  assert.equal(column.css.d['flex-basis'], undefined);
  assert.equal(column.css.m['flex-basis'], '100%');

  const authored = C.N('list', {}, {}, [C.N('column', {}, { d: { 'flex-basis': '42%' }, m: {} })]);
  assert.equal(authored.children[0].css.d['flex-basis'], '42%');
  assert.equal(authored.children[0].css.m['flex-basis'], '100%');
});

test('Slider keeps its existing child sizing policy over the seeded card basis', () => {
  const list = C.insert('list', null, 0)!;
  list.props.collectionLayout = 'slider';
  const css = C.treeCss([[list]], false);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /flex:0 0 calc\(50% - 12px\)/);
});
