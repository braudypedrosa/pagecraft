/** @vitest-environment jsdom */
import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {act} from 'preact/test-utils';
import * as C from '../app/src/core/index';
import {Ctl} from '../app/src/ui/inspector/Controls';
import {L} from '../app/src/ui/ctx';
import {rig, type Rig} from './ui.setup';

let r: Rig;
beforeEach(() => {
  r = rig({asset: id => ({id, name: id + '.png', url: 'blob:' + id, size: 20,
    w: id === 'unknown' ? 0 : id === 'portrait' ? 400 : 1200,
    h: id === 'unknown' ? 0 : id === 'portrait' ? 800 : 300})});
  C.seed(); C.blankProject('Component Image metadata'); C.state.meta.components = [];
});
afterEach(() => { r.host.remove(); window.__pcFeedback?.destroy(); vi.restoreAllMocks(); });

function fixture(nested = false) {
  const image = C.insert('image', null, 0)!;
  image.props = {...image.props, src: 'asset:portrait', w: '400', h: '800', alt: 'Keep image alt'};
  image.css.d.width = '72%'; image.css.d.height = 'auto';
  let root = image;
  if (nested) {
    const found = C.locate(image.id)!;
    const box = C.N('box', {}, {}, [image]);
    found.list[found.i] = box; root = box;
  }
  const cid = C.componentFromNode(root.id, 'Image card')!;
  const definition = C.findComponent(cid)!;
  const bound = nested ? definition.node.children[0] : definition.node;
  const key = C.propFromControl(cid, bound.id, {t: 'img', k: 'src', label: 'Image source'})!;
  const first = C.locate(root.id)!.node;
  const second = C.instanceInsert(cid, C.locate(first.id)!.parent, C.locate(first.id)!.i + 1)!;
  C.selSet([second.id]);
  return {first, second, definition, key, bound};
}
const attrs = (n: any) => {
  const img = new DOMParser().parseFromString(C.renderNode(n, {edit: false}), 'text/html').querySelector('img')!;
  return {src: img.getAttribute('src'), w: img.getAttribute('width'), h: img.getAttribute('height')};
};
async function choose(n: any, id: string) {
  L.mediaPicker = vi.fn(async () => id);
  r.draw(<Ctl n={n} c={C.instControls(n)[0]} />);
  await act(async () => r.click(r.$$('button').find(b => b.textContent?.includes('Library'))!));
}

for (const nested of [false, true]) test(`known replacement owns intrinsic metadata without changing ${nested ? 'nested' : 'root'} definition or peer`, async () => {
  const {first, second, definition} = fixture(nested);
  const defBefore = JSON.stringify(definition), peerBefore = JSON.stringify(first), cssBefore = JSON.stringify(second.css);
  C.hist.u.length = 0; C.hist.r.length = 0;
  const before = JSON.stringify(C.doc());
  await choose(second, 'wide');
  expect(attrs(second)).toEqual({src: 'asset:wide', w: '1200', h: '300'});
  expect(JSON.stringify(definition)).toBe(defBefore);
  expect(JSON.stringify(first)).toBe(peerBefore);
  expect(JSON.stringify(second.css)).toBe(cssBefore);
  expect(attrs(first)).toMatchObject({w: '400', h: '800'});
  expect(C.hist.u).toHaveLength(1);
  const after = JSON.stringify(C.doc());
  C.undo(); expect(JSON.stringify(C.doc())).toBe(before);
  C.redo(); expect(JSON.stringify(C.doc())).toBe(after);
  expect(attrs(C.locate(second.id)!.node)).toMatchObject({w: '1200', h: '300'});
});

test('unknown dimensions and direct source changes never borrow a prior image ratio', async () => {
  const {second, key} = fixture();
  await choose(second, 'wide');
  await choose(second, 'unknown');
  expect(attrs(second)).toEqual({src: 'asset:unknown', w: null, h: null});
  await choose(second, 'wide');
  C.instSet(second, key, 'asset:another');
  expect(attrs(second)).toEqual({src: 'asset:another', w: null, h: null});
  C.instSet(second, key, '');
  expect(attrs(second)).toMatchObject({w: '800', h: '500'}); // Empty source uses the normal placeholder.
});

test('default reset and variant capture/reset keep metadata with its source', async () => {
  const {second, key, definition} = fixture();
  await choose(second, 'wide');
  const vid = C.variantFromInstance(second, 'Wide')!;
  expect(attrs(second)).toMatchObject({w: '1200', h: '300'});
  expect(second.vals).toBeUndefined();
  C.variantSet(second, null);
  expect(attrs(second)).toMatchObject({src: 'asset:portrait', w: '400', h: '800'});
  C.variantSet(second, vid);
  await choose(second, 'unknown');
  expect(attrs(second)).toMatchObject({src: 'asset:unknown', w: null, h: null});
  C.instSet(second, key, undefined);
  expect(attrs(second)).toMatchObject({src: 'asset:wide', w: '1200', h: '300'});
  expect(second.vals).toBeUndefined();
  C.variantDelete(definition.id, vid);
  expect(attrs(second)).toMatchObject({src: 'asset:wide', w: '1200', h: '300'});
});

test('CMS source overrides cannot reuse cached local metadata and retain valid original defaults', async () => {
  const {second, key} = fixture();
  await choose(second, 'wide');
  const col = C.collectionAdd('Image sources');
  col.fields = [{id: 'photo', name: 'Photo', type: 'image'}];
  const item = {id: 'one', slug: 'one', values: {photo: 'asset:wide'}};
  col.items = [item];
  C.bindSet(second, C.VAL + key, {src: 'field', path: 'photo'});
  const render = () => {
    const img = new DOMParser().parseFromString(C.renderNode(second, {edit: false, col, item}), 'text/html').querySelector('img')!;
    return {src: img.getAttribute('src'), w: img.getAttribute('width'), h: img.getAttribute('height')};
  };
  expect(render()).toEqual({src: 'asset:wide', w: null, h: null});
  item.values.photo = 'asset:portrait';
  expect(render()).toEqual({src: 'asset:portrait', w: '400', h: '800'});
  C.bindSet(second, C.VAL + key, null);
  expect(attrs(second)).toMatchObject({src: 'asset:wide', w: '1200', h: '300'});
});

test('invalid and mismatched metadata is ignored, property removal drops paired data', async () => {
  const {second, key, definition} = fixture();
  await choose(second, 'wide');
  for (const raw of ['broken', JSON.stringify({src: 'asset:other', w: 1200, h: 300}),
    JSON.stringify({src: 'asset:wide', w: -1, h: 300}),
    JSON.stringify({src: 'asset:wide', w: 1200, h: 300, extra: 'not metadata'})]) {
    second.vals![C.imageSizeKey(key)] = raw;
    expect(attrs(second)).toMatchObject({src: 'asset:wide', w: null, h: null});
  }
  await choose(second, 'wide');
  C.variantFromInstance(second, 'Wide');
  C.propDelete(definition.id, key);
  expect(second.vals).toBeUndefined();
  expect(Object.keys(definition.variants![0].values)).toEqual([]);
});

test('materializing an Image component retains the resolved source and dimensions', async () => {
  const {second, definition} = fixture(true);
  await choose(second, 'wide');
  C.componentDelete(definition.id);
  expect(attrs(C.locate(second.id)!.node)).toMatchObject({src: 'asset:wide', w: '1200', h: '300'});
});
