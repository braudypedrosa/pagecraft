import {beforeEach, expect, test} from 'vitest';
import * as C from '../../app/src/core/index';
import {contentOnly} from '../src/content';

beforeEach(() => { C.seed(); C.blankProject('Image content role'); C.state.meta.components = []; });
function fixture() {
  const image = C.insert('image', null, 0)!;
  image.props = {...image.props, src: 'asset:portrait', w: '400', h: '800'};
  const cid = C.componentFromNode(image.id, 'Photo')!;
  const def = C.findComponent(cid)!;
  const key = C.propFromControl(cid, def.node.id, {t: 'img', k: 'src', label: 'Photo'})!;
  return {instance: C.locate(image.id)!.node, key};
}
const assets = new Set(['portrait', 'wide']);
test('content role may replace an owned image with safe exact-source intrinsic metadata', () => {
  const {instance, key} = fixture();
  const before = structuredClone(C.doc());
  C.instSet(instance, key, 'asset:wide');
  C.instImageSizeSet(instance, key, {w: 1200, h: 300});
  expect(contentOnly(before, structuredClone(C.doc()), assets).ok).toBe(true);
});
for (const metadata of [
  {src: 'asset:other', w: 1200, h: 300}, {src: 'asset:wide', w: 0, h: 300},
  {src: 'asset:wide', w: 1.5, h: 300}, {src: 'asset:wide', w: 1200, h: -1},
  {src: 'asset:wide', w: 1200, h: 300, css: 'anything'},
]) test(`content role rejects unsafe or unrelated image metadata ${JSON.stringify(metadata)}`, () => {
  const {instance, key} = fixture();
  const before = structuredClone(C.doc());
  C.instSet(instance, key, 'asset:wide');
  instance.vals![C.imageSizeKey(key)] = JSON.stringify(metadata);
  expect(contentOnly(before, structuredClone(C.doc()), assets).ok).toBe(false);
});
test('a metadata-looking key for an undeclared property remains structural', () => {
  const {instance, key} = fixture();
  const before = structuredClone(C.doc());
  C.instSet(instance, key, 'asset:wide');
  instance.vals![C.imageSizeKey('undeclared')] = JSON.stringify({src: 'asset:wide', w: 1200, h: 300});
  expect(contentOnly(before, structuredClone(C.doc()), assets).ok).toBe(false);
});
