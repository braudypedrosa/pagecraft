import { test, beforeEach } from 'vitest';
import a from 'node:assert/strict';
import * as C from '../app/src/core/index';

beforeEach(() => { C.seed(); C.state.ui = C.initUi(); C.blankProject('Component CMS QA'); C.state.meta.collections = []; C.state.meta.components = []; C.hist.u.length = 0; C.hist.r.length = 0; });

function fixture() {
  const col = C.collectionAdd('Cabins')!;
  const title = C.titleField(col)!;
  const image = C.fieldAdd(col.id, 'Photo', 'image')!;
  const link = C.fieldAdd(col.id, 'Destination', 'link')!;
  const rich = C.fieldAdd(col.id, 'Description', 'rich')!;
  const yes = C.fieldAdd(col.id, 'Featured', 'bool')!;
  const one = C.itemAdd(col.id)!;
  const two = C.itemAdd(col.id)!;
  [one, two].forEach((item, i) => {
    C.itemSet(col.id, item.id, title.id, ['Pine cabin', 'Lake cabin'][i]);
    C.itemSet(col.id, item.id, image.id, `https://example.com/cabin-${i}.webp`);
    C.itemSet(col.id, item.id, link.id, `https://example.com/stay-${i}`);
    C.itemSet(col.id, item.id, rich.id, `<p>Cabin description ${i}</p>`);
    C.itemSet(col.id, item.id, yes.id, i ? '' : '1');
  });
  const box = C.N('box', {}, {}, [C.N('heading'), C.N('image'), C.N('button'), C.N('text')]);
  const list = C.N('list', {}, {}, [box]); C.srcSet(list, col.id);
  C.state.pages[0].tree = [C.N('section', {}, {}, [list])];
  const cid = C.componentFromNode(box.id, 'CMS card')!;
  const def = C.findComponent(cid)!;
  const keys = [
    C.propAdd(cid, 'Name', 'text', 'Default cabin')!,
    C.propAdd(cid, 'Photo', 'img', '')!,
    C.propAdd(cid, 'Destination', 'link', '')!,
    C.propAdd(cid, 'Description', 'rich', '')!
  ];
  const fields = [title, image, link, rich];
  keys.forEach((k, i) => {
    C.bindSet(def.node.children[i], ['text', 'src', 'link', 'html'][i], { src: 'prop', path: k });
    C.bindSet(box, C.VAL + k, C.bindField(fields[i].id));
  });
  return { col, title, image, link, rich, yes, one, two, box, list, cid, def, keys };
}

test('a reused CMS component renders each item and keeps static placements independent', () => {
  const { box, cid, keys, list, def } = fixture();
  C.instSet(box, keys[0], 'Saved fallback');
  const plain = C.N('box'); plain.use = cid; C.instSet(plain, keys[0], 'Static cabin');
  C.state.pages[0].tree.push(plain);
  for (const html of [C.buildPage(C.state.pages[0]), C.renderNode(list, { edit: true })]) {
    a.match(html, /Pine cabin/); a.match(html, /Lake cabin/);
    a.match(html, /cabin-0.webp/); a.match(html, /cabin-1.webp/);
    a.match(html, /href="https:\/\/example.com\/stay-0"/);
    a.match(html, /href="https:\/\/example.com\/stay-1"/);
    a.match(html, /<p>Cabin description 0<\/p>/);
    a.match(html, /<p>Cabin description 1<\/p>/);
    a.doesNotMatch(html, /Saved fallback/);
  }
  a.match(C.buildPage(C.state.pages[0]), /Static cabin/);
  a.equal(def.node.children[0].bind!.text.src, 'prop', 'mapping never rewrites the shared definition');
});

test('component CMS mappings survive save/reopen, duplication and undo with fallback values intact', () => {
  const { box, cid, keys, col, one, title } = fixture();
  C.instSet(box, keys[0], 'Saved fallback');
  const saved = JSON.parse(JSON.stringify(C.doc()));
  C.restore(C.migrate(saved)!);
  const instance = C.locate(box.id)!.node;
  a.equal(C.propVal(instance, C.VAL + keys[0]), 'Pine cabin');
  C.dupNode(instance.id); const duplicate = C.locate(C.state.ui.sel!)!.node;
  a.equal(C.boundField(duplicate, C.VAL + keys[0]), title.id);
  C.edit(() => C.bindSet(instance, C.VAL + keys[0], null));
  a.equal(C.propVal(instance, C.VAL + keys[0]), 'Saved fallback');
  C.undo();
  a.equal(C.propVal(C.locate(box.id)!.node, C.VAL + keys[0]), 'Pine cabin');
  a.equal(C.instValue(C.locate(box.id)!.node, C.findComponent(cid), keys[0], col, one), 'Pine cabin');
});

test('empty, missing and referenced CMS fields resolve without leaking variant values', () => {
  const { box, def, keys, col, one, title } = fixture();
  C.instSet(box, keys[0], 'Variant fallback');
  C.variantFromInstance(box, 'Named variant');
  a.equal(C.boundField(box, C.VAL + keys[0]), title.id, 'saving a variant preserves the connection');
  C.itemSet(col.id, one.id, title.id, '');
  a.equal(C.instValue(box, def, keys[0], col, one), '');
  C.bindSet(box, C.VAL + keys[0], C.bindField('missing'));
  a.equal(C.instValue(box, def, keys[0], col, one), '');
  const owners = C.collectionAdd('Owners')!;
  const ownerTitle = C.titleField(owners)!;
  const owner = C.itemAdd(owners.id)!; C.itemSet(owners.id, owner.id, ownerTitle.id, 'River & Forest');
  const ref = C.fieldAdd(col.id, 'Owner', 'ref')!; ref.ref = owners.id;
  C.itemSet(col.id, one.id, ref.id, owner.id);
  C.bindSet(box, C.VAL + keys[0], C.bindField(`${ref.id}.${ownerTitle.id}`));
  a.equal(C.instValue(box, def, keys[0], col, one), 'River & Forest');
  C.bindSet(box, C.VAL + keys[0], null);
  a.equal(C.instValue(box, def, keys[0], col, one), 'Variant fallback');
});

test('CMS-bound component properties work on detail pages and in visibility conditions', () => {
  const { box, def, keys, col, one, two, yes } = fixture();
  const flag = C.propAdd(def.id, 'Featured', 'bool', '1')!;
  C.bindSet(box, C.VAL + flag, C.bindField(yes.id));
  C.condSet(def.node.children[0], { bind: { src: 'prop', path: flag }, op: 'set' });
  const pg = C.state.pages[0]; pg.collection = col.id; pg.tree = [box];
  a.match(C.buildPage(pg, { col, item: one }), /Pine cabin/);
  a.doesNotMatch(C.buildPage(pg, { col, item: two }), /Lake cabin/);
  a.match(C.buildPage(pg, { col, item: two }), /Cabin description 1/);
  C.propDelete(def.id, keys[0]);
  a.equal(C.boundField(box, C.VAL + keys[0]), '', 'removed properties leave no dangling instance mapping');
});

test('the whole-card mapping sheet includes exposed fields and filters incompatible types', () => {
  const { list, box, keys, image, col } = fixture();
  const slots = C.bindSlots(list.id);
  a.ok(slots.some(s => s.nodeId === box.id && s.key === C.VAL + keys[0]));
  a.deepEqual(slots.find(s => s.key === C.VAL + keys[1]).fieldTypes, ['image']);
  C.bindSet(box, C.VAL + keys[1], null);
  const wrong = { ...image, type: 'text' };
  a.equal(Object.values(C.guessBindings(C.bindSlots(box.id), { ...col, fields: [wrong] } as any)).includes(image.id), false);
});
