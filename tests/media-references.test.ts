import { expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import { mediaReferences, replaceMediaReferences } from '../app/src/core/media-references';

function fixture() {
  C.seed(); C.blankProject('Media references');
  const doc = structuredClone(C.doc());
  const image = C.N('image', { src: 'asset:old@320' });
  image.css.d['background-image'] = 'url("asset:old")';
  doc.pages[0].tree = [image, C.N('image', { src: 'asset:old-other' }), C.N('code', { html: '<img src="asset:old">' })];
  doc.pages[0].ogImage = 'asset:old';
  doc.header = [C.N('image', { src: 'asset:old' })];
  doc.footer = [C.N('image', { src: 'asset:old' })];
  doc.meta.favicon = 'asset:old';
  doc.meta.ogImage = 'asset:old';
  doc.meta.headHtml = '<script>const image = "asset:old"</script>';
  doc.meta.blocks = [{ id: 'block', name: 'Block', node: C.N('image', { src: 'asset:old' }) }];
  doc.meta.components = [{ id: 'component', name: 'Component', node: C.N('image', { src: 'asset:old' }), props: [{ k: 'photo', t: 'img', label: 'Photo', def: 'asset:old' }], variants: [{ id: 'variant', name: 'Variant', values: { photo: 'asset:old' } }] }];
  const instance = C.N('image'); instance.use = 'component'; instance.vals = { photo: 'asset:old' }; doc.pages[0].tree.push(instance);
  doc.meta.collections = [{ id: 'cms', name: 'CMS', slug: 'cms', detail: '', fields: [{ id: 'photo', name: 'Photo', type: 'image' }], items: [{ id: 'item', slug: 'item', values: { photo: 'asset:old' } }] }];
  return doc;
}

test('managed usage spans document owners and replacement preserves source and variants', () => {
  const doc = fixture(); const baseline = structuredClone(doc);
  const refs = mediaReferences(doc).filter(ref => ref.assetId === 'old');
  expect(refs).toHaveLength(13);
  expect(new Set(refs.map(ref => ref.scope))).toEqual(new Set(['page', 'header', 'footer', 'site', 'block', 'component', 'cms']));
  const next = replaceMediaReferences(doc, 'old', 'new');
  expect(doc).toEqual(baseline);
  expect(mediaReferences(next).filter(ref => ref.assetId === 'old')).toHaveLength(0);
  expect(mediaReferences(next).filter(ref => ref.assetId === 'new')).toHaveLength(13);
  expect(next.pages[0].tree[0].props).toMatchObject({ src: 'asset:new@320' });
  expect(next.pages[0].tree[1].props).toMatchObject({ src: 'asset:old-other' });
  expect(next.pages[0].tree[2].props).toMatchObject({ html: '<img src="asset:old">' });
  expect(next.meta.headHtml).toEqual(doc.meta.headHtml);
});

test('rejects malformed replacement identifiers before changing the document', () => {
  expect(() => replaceMediaReferences(fixture(), 'old', 'new/path')).toThrow('Invalid asset ID');
});

test('nested saved content, gallery and interactive backgrounds have writable addresses', () => {
  const doc = fixture();
  const gallery = C.N('gallery', { items: [{ src: 'asset:old' }, { src: 'asset:old@640' }] });
  gallery.st = { hover: { d: {}, t: { 'background-image': 'url(asset:old), url(asset:old)' }, m: {} } };
  doc.meta.blocks[0].node = C.N('box', {}, {}, [gallery]);
  const before = mediaReferences(doc).filter(ref => ref.assetId === 'old').length;
  const next = replaceMediaReferences(doc, 'old', 'next');
  expect(mediaReferences(next).filter(ref => ref.assetId === 'next')).toHaveLength(before);
  expect(next.meta.blocks[0].node.children[0].st?.hover?.t['background-image']).toBe('url(asset:next), url(asset:next)');
});

test('large reference inventories preserve every location', () => {
  const doc = fixture();
  doc.pages[0].tree = Array.from({ length: 5000 }, () => C.N('image', { src: 'asset:large' }));
  expect(mediaReferences(doc).filter(ref => ref.assetId === 'large')).toHaveLength(5000);
});
