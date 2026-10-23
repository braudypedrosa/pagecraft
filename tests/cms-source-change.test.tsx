// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import type { Collection, Field, FieldType, Node as PcNode } from '../app/src/core/types';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { changeContentSource, sourceChangeBlocked } from '../app/src/ui/inspector/cms-source-change';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function field(collection: Collection, id: string, name: string, type: FieldType): Field {
  const made = C.fieldAdd(collection.id, name, type)!;
  made.id = id;
  return made;
}

function firstField(collection: Collection, id: string, name: string, type: FieldType): Field {
  const made = collection.fields[0];
  Object.assign(made, { id, name, type });
  return made;
}

function put(root: PcNode) {
  C.state.pages[0].tree = [root];
  C.state.ui.stab = 'advanced';
  C.selSet([root.id]);
}

test('the inspector remaps only semantic fields and one undo restores the exact source document', () => {
  const shared = C.collectionAdd('Shared spaces')!;
  const oldTitle = firstField(shared, 'field_1', 'Title', 'text');
  const oldPhoto = field(shared, 'field_2', 'Photo', 'image');
  const oldAlt = field(shared, 'field_3', 'Alt text', 'text');
  const scalar = C.collectionAdd('Scalar matrix')!;
  const newTitle = firstField(scalar, 'scalar_title', 'Title', 'text');
  field(scalar, oldPhoto.id, 'Score', 'number');
  field(scalar, oldAlt.id, 'Day', 'date');

  const heading = C.N('heading', { text: 'Saved heading' });
  const image = C.N('image', { src: 'asset:saved-photo', alt: 'Saved alt' });
  const root = C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [heading, image])])]);
  C.srcSet(root, shared.id);
  C.bindSet(heading, 'text', C.bindField(oldTitle.id));
  C.bindSet(image, 'src', C.bindField(oldPhoto.id));
  C.bindSet(image, 'alt', C.bindField(oldAlt.id));
  put(root);
  const before = JSON.stringify(C.doc());

  r.draw(() => <Inspector />, 'right');
  const select = r.$('select[aria-label="Content source collection"]')!;
  r.pick(select, scalar.id);

  assert.equal(root.src, scalar.id);
  assert.equal(C.boundField(heading, 'text'), newTitle.id, 'same semantic text remaps even when its id changes');
  assert.equal(C.boundField(image, 'src'), '', 'a reused image id cannot become a number binding');
  assert.equal(C.boundField(image, 'alt'), '', 'a reused text id cannot become a date binding');
  assert.equal(image.props.src, 'asset:saved-photo', 'disconnecting reveals the authored image fallback');
  assert.equal(image.props.alt, 'Saved alt', 'disconnecting preserves the authored alt fallback');
  assert.match(String(r.arg('toast')?.[0]), /Content source: Scalar matrix.*2 incompatible connections or settings cleared/);
  assert.equal(C.hist.u.length, 1, 'source and binding changes share one history checkpoint');

  C.undo();
  assert.equal(JSON.stringify(C.doc()), before, 'one Undo restores the exact document');
});

test('list source changes remap direct settings and clear stale option and reference comparisons', () => {
  const oldPeople = C.collectionAdd('Old people')!;
  const newPeople = C.collectionAdd('New people')!;
  const old = C.collectionAdd('Old catalogue')!;
  const oldRank = field(old, 'old_rank', 'Rank', 'number');
  const oldCategory = field(old, 'old_category', 'Category', 'option'); oldCategory.opts = 'Guide,News';
  const oldOwner = field(old, 'old_owner', 'Owner', 'ref'); oldOwner.ref = oldPeople.id;
  const next = C.collectionAdd('New catalogue')!;
  const newRank = field(next, 'new_rank', 'Rank', 'number');
  const newCategory = field(next, 'new_category', 'Category', 'option'); newCategory.opts = 'Guide,Case study';
  const newOwner = field(next, 'new_owner', 'Owner', 'ref'); newOwner.ref = newPeople.id;

  const optionChild = C.N('heading');
  C.condSet(optionChild, { bind: C.bindField(oldCategory.id)!, op: 'eq', value: 'News' });
  const refChild = C.N('text');
  C.condSet(refChild, { bind: C.bindField(oldOwner.id)!, op: 'eq', value: 'old-person-id' });
  const list = C.N('list', { sort: oldRank.id, where: oldCategory.id, op: 'is', val: 'News' }, {}, [optionChild, refChild]);
  C.srcSet(list, old.id);
  put(list);

  const source = C.DEF.list.controls.content.find(control => control.t === 'source')!;
  r.draw(<Ctl n={list} c={source} />);
  r.pick(r.$('select.ctl')!, next.id);

  assert.equal(list.props.sort, newRank.id, 'a unique same-name and same-type sort remaps');
  assert.equal(list.props.where, '', 'an option filter whose saved choice disappeared resets');
  assert.equal(list.props.op, 'is');
  assert.equal(list.props.val, undefined);
  assert.equal(optionChild.showIf, undefined, 'an option condition whose choice disappeared clears');
  assert.equal(refChild.showIf, undefined, 'a reference comparison cannot keep an item id from another target collection');
  assert.match(String(r.arg('toast')?.[0]), /3 incompatible connections or settings cleared/);

  const refList = C.N('list', { where: oldOwner.id, op: 'is', val: 'old-person-id' });
  C.srcSet(refList, old.id);
  C.state.pages[0].tree = [refList];
  const result = changeContentSource(refList, next.id);
  assert.equal(refList.props.where, '', 'a direct reference filter cannot retain a foreign item id');
  assert.equal(result.cleared, 1);

  const presenceList = C.N('list', { where: oldOwner.id, op: 'set', val: 'old-person-id' });
  C.srcSet(presenceList, old.id);
  C.state.pages[0].tree = [presenceList];
  const presenceResult = changeContentSource(presenceList, next.id);
  assert.equal(presenceList.props.where, newOwner.id, 'a reference presence test still has the same meaning');
  assert.equal(presenceList.props.op, 'set');
  assert.equal(presenceList.props.val, undefined, 'its dormant foreign item id is removed');
  assert.equal(presenceResult.cleared, 1);
  assert.equal(newCategory.id, 'new_category');
  assert.equal(newOwner.id, 'new_owner');
});

test('one-hop paths remap while independently sourced nested trees and property bindings stay exact', () => {
  const oldAuthors = C.collectionAdd('Old authors')!;
  const oldAuthorTitle = firstField(oldAuthors, 'old_author_title', 'Title', 'text');
  const newAuthors = C.collectionAdd('New authors')!;
  const newAuthorTitle = firstField(newAuthors, 'new_author_title', 'Title', 'text');
  const old = C.collectionAdd('Old articles')!;
  const oldAuthor = field(old, 'old_author', 'Author', 'ref'); oldAuthor.ref = oldAuthors.id;
  const next = C.collectionAdd('New articles')!;
  const newAuthor = field(next, 'new_author', 'Author', 'ref'); newAuthor.ref = newAuthors.id;
  const nestedCollection = C.collectionAdd('Nested')!;
  const nestedTitle = field(nestedCollection, 'nested_title', 'Title', 'text');

  const linked = C.N('heading');
  C.bindSet(linked, 'text', C.bindField(`${oldAuthor.id}.${oldAuthorTitle.id}`));
  const propBound = C.N('heading');
  C.bindSet(propBound, 'text', { src: 'prop', path: 'card-title' });
  const nestedHeading = C.N('heading');
  C.bindSet(nestedHeading, 'text', C.bindField(nestedTitle.id));
  const nested = C.N('list', { sort: nestedTitle.id, where: nestedTitle.id, op: 'is', val: 'Nested value' }, {}, [nestedHeading]);
  C.srcSet(nested, nestedCollection.id);
  const root = C.N('section', {}, {}, [linked, propBound, nested]);
  C.srcSet(root, old.id);
  put(root);
  const nestedBefore = JSON.stringify(nested);

  const result = changeContentSource(root, next.id);
  assert.equal(C.boundField(linked, 'text'), `${newAuthor.id}.${newAuthorTitle.id}`);
  assert.deepEqual(C.bindGet(propBound, 'text'), { src: 'prop', path: 'card-title' });
  assert.equal(JSON.stringify(nested), nestedBefore, 'a nested node with its own valid source is outside the changed scope');
  assert.equal(result.cleared, 0);
});

test('ambiguous matches and unproven disconnected bindings clear without creating a no-op history entry', () => {
  const old = C.collectionAdd('Original')!;
  const oldTitle = firstField(old, 'old_title', 'Title', 'text');
  const ambiguous = C.collectionAdd('Ambiguous')!;
  firstField(ambiguous, 'title_default', 'Title', 'text');
  field(ambiguous, 'title_a', 'Title', 'text');
  field(ambiguous, 'title_b', 'Title', 'text');
  const heading = C.N('heading', { text: 'Fallback' });
  const root = C.N('section', {}, {}, [heading]);
  C.srcSet(root, old.id);
  C.bindSet(heading, 'text', C.bindField(oldTitle.id));
  put(root);

  const changed = changeContentSource(root, ambiguous.id);
  assert.equal(C.boundField(heading, 'text'), '', 'duplicate semantic candidates are never guessed');
  assert.equal(changed.cleared, 1);
  const depth = C.hist.u.length;
  assert.deepEqual(changeContentSource(root, ambiguous.id), { changed: false, cleared: 0, remapped: 0 });
  assert.equal(C.hist.u.length, depth, 'selecting the current source does not add history');

  C.undo();
  const restored = C.locate(heading.id)!.node;
  const restoredRoot = C.locate(root.id)!.node;
  C.condSet(restored, { bind: C.bindField(oldTitle.id)!, op: 'set' });
  changeContentSource(restoredRoot, '');
  assert.equal(C.boundField(restored, 'text'), oldTitle.id, 'None preserves the disconnected recovery binding');
  assert.equal(restored.showIf?.bind.path, oldTitle.id, 'None preserves the disconnected recovery condition');
  changeContentSource(restoredRoot, ambiguous.id);
  assert.equal(C.boundField(restored, 'text'), '', 'a source chosen from None clears references whose origin is unproven');
  assert.equal(restored.showIf, undefined, 'the unproven disconnected condition clears with the new source');
});

test('semantic names preserve only case and whitespace variants, not meaningful symbols', () => {
  const old = C.collectionAdd('Original labels')!;
  const oldTitle = firstField(old, 'old_title', '  FEATURED   CAFÉ  ', 'text');
  const oldPrice = field(old, 'shared_price_id', 'Price ($)', 'number');
  const next = C.collectionAdd('New labels')!;
  const newTitle = firstField(next, 'new_title', 'featured café', 'text');
  field(next, oldPrice.id, 'Price (€)', 'number');
  const title = C.N('heading');
  const price = C.N('heading');
  C.bindSet(title, 'text', C.bindField(oldTitle.id));
  C.bindSet(price, 'text', C.bindField(oldPrice.id));
  const root = C.N('section', {}, {}, [title, price]);
  C.srcSet(root, old.id);
  put(root);

  const result = changeContentSource(root, next.id);
  assert.equal(C.boundField(title, 'text'), newTitle.id, 'NFC, case and collapsed whitespace describe the same label');
  assert.equal(C.boundField(price, 'text'), '', 'currency symbols remain meaningful and prevent a false match');
  assert.equal(result.cleared, 1);
});

test('an incompatible inherited component field blocks the whole source change before history', () => {
  const old = C.collectionAdd('Gallery')!;
  const oldPhoto = firstField(old, 'shared_field', 'Photo', 'image');
  const next = C.collectionAdd('Scores')!;
  firstField(next, oldPhoto.id, 'Score', 'number');
  const image = C.N('image', { src: 'asset:fallback' });
  C.bindSet(image, 'src', C.bindField(oldPhoto.id));
  const card = C.N('box', {}, {}, [image]);
  const badgeImage = C.N('image'); C.bindSet(badgeImage, 'src', C.bindField(oldPhoto.id));
  const badge = C.N('box', {}, {}, [badgeImage]);
  const root = C.N('section', {}, {}, [card, badge]);
  C.srcSet(root, old.id); put(root);
  const componentId = C.componentFromNode(card.id, 'Card')!;
  C.componentFromNode(badge.id, 'Badge');
  const definitionBefore = JSON.stringify(C.findComponent(componentId));
  const documentBefore = JSON.stringify(C.doc());
  const historyBefore = C.hist.u.length;
  const blocked = changeContentSource(root, next.id);
  assert.deepEqual(blocked.blocked, { component: 'Card', additional: 1 });
  assert.equal(sourceChangeBlocked(blocked), 'Content source unchanged · “Card” needs its CMS fields connected through component properties first.');

  r.draw(() => <Inspector />, 'right');
  const select = r.$('select[aria-label="Content source collection"]') as HTMLSelectElement;
  r.pick(select, next.id);

  assert.equal(select.value, old.id, 'the controlled selector immediately returns to the persisted source');
  assert.equal(JSON.stringify(C.doc()), documentBefore, 'a blocked selection changes no document bytes');
  assert.equal(JSON.stringify(C.findComponent(componentId)), definitionBefore, 'the shared definition stays exact');
  assert.equal(C.hist.u.length, historyBefore, 'a blocked selection creates no Undo entry');
  assert.match(String(r.arg('toast')?.[0]),
    /Content source unchanged · “Card” needs its CMS fields connected through component properties first\./);
});

test('the Collection List selector restores its displayed value after a blocked source change', () => {
  const old = C.collectionAdd('Old list')!;
  const oldPhoto = firstField(old, 'shared_field', 'Photo', 'image');
  const next = C.collectionAdd('Next list')!;
  firstField(next, oldPhoto.id, 'Score', 'number');
  const image = C.N('image'); C.bindSet(image, 'src', C.bindField(oldPhoto.id));
  const card = C.N('box', {}, {}, [image]);
  const list = C.N('list', {}, {}, [card]); C.srcSet(list, old.id); put(list);
  C.componentFromNode(card.id, 'List card');
  const source = C.DEF.list.controls.content.find(control => control.t === 'source')!;
  const before = JSON.stringify(C.doc());
  const depth = C.hist.u.length;

  r.draw(<Ctl n={list} c={source} />);
  const select = r.$('select.ctl') as HTMLSelectElement;
  r.pick(select, next.id);

  assert.equal(select.value, old.id);
  assert.equal(JSON.stringify(C.doc()), before);
  assert.equal(C.hist.u.length, depth);
  assert.match(String(r.arg('toast')?.[0]), /Content source unchanged · “List card”/);
});

test('a shared component condition blocks when its saved comparison is invalid in the next source', () => {
  const old = C.collectionAdd('Old categories')!;
  const oldCategory = firstField(old, 'category', 'Category', 'option'); oldCategory.opts = 'Guide,News';
  const next = C.collectionAdd('New categories')!;
  const nextCategory = firstField(next, oldCategory.id, 'Category', 'option'); nextCategory.opts = 'Guide,Case study';
  const heading = C.N('heading');
  C.condSet(heading, { bind: C.bindField(oldCategory.id)!, op: 'eq', value: 'News' });
  const card = C.N('box', {}, {}, [heading]);
  const root = C.N('section', {}, {}, [card]); C.srcSet(root, old.id); put(root);
  const componentId = C.componentFromNode(card.id, 'Conditional card')!;
  const before = JSON.stringify(C.doc());
  const depth = C.hist.u.length;

  const result = changeContentSource(root, next.id);
  assert.deepEqual(result.blocked, { component: 'Conditional card', additional: 0 });
  assert.equal(JSON.stringify(C.doc()), before);
  assert.equal(C.hist.u.length, depth);
  assert.equal(C.findComponent(componentId)!.node.children[0].showIf?.value, 'News');
});

test('compatible same-path component fields proceed while independently sourced definitions stay untouched', () => {
  const old = C.collectionAdd('Old articles')!;
  const oldTitle = firstField(old, 'title', 'Title', 'text');
  const next = C.collectionAdd('New articles')!;
  firstField(next, oldTitle.id, ' title ', 'text');
  const own = C.collectionAdd('Card catalogue')!;
  const ownPhoto = firstField(own, 'photo', 'Photo', 'image');

  const inheritedHeading = C.N('heading');
  C.bindSet(inheritedHeading, 'text', C.bindField(oldTitle.id));
  C.condSet(inheritedHeading, { bind: C.bindField(oldTitle.id)!, op: 'set' });
  const inheritedCard = C.N('box', {}, {}, [inheritedHeading]);
  const ownImage = C.N('image');
  C.bindSet(ownImage, 'src', C.bindField(ownPhoto.id));
  const ownCard = C.N('box', {}, {}, [ownImage]);
  C.srcSet(ownCard, own.id);
  const root = C.N('section', {}, {}, [inheritedCard, ownCard]);
  C.srcSet(root, old.id); put(root);
  const inheritedId = C.componentFromNode(inheritedCard.id, 'Article card')!;
  const ownId = C.componentFromNode(ownCard.id, 'Photo card')!;
  const definitionsBefore = JSON.stringify(C.state.meta.components);

  const result = changeContentSource(root, next.id);
  assert.equal(result.changed, true, 'the same semantic field at the same path needs no definition rewrite');
  assert.equal(result.blocked, undefined);
  assert.equal(root.src, next.id);
  assert.equal(JSON.stringify(C.state.meta.components), definitionsBefore,
    'compatible and independently sourced definitions remain byte exact');
  assert.equal(C.findComponent(inheritedId)!.node.src, undefined);
  assert.equal(C.findComponent(ownId)!.node.src, own.id);
});

test('component property mappings remap on the instance without editing its shared definition', () => {
  const old = C.collectionAdd('Old stories')!;
  const oldTitle = firstField(old, 'old_title', 'Title', 'text');
  const next = C.collectionAdd('New stories')!;
  const nextTitle = firstField(next, 'new_title', 'Title', 'text');
  const heading = C.N('heading');
  const card = C.N('box', {}, {}, [heading]);
  const root = C.N('section', {}, {}, [card]);
  C.srcSet(root, old.id); put(root);
  const componentId = C.componentFromNode(card.id, 'Property card')!;
  const definition = C.findComponent(componentId)!;
  const property = C.propAdd(componentId, 'Title', 'text', 'Fallback')!;
  C.bindSet(definition.node.children[0], 'text', { src: 'prop', path: property });
  C.bindSet(card, C.VAL + property, C.bindField(oldTitle.id));
  const definitionBefore = JSON.stringify(definition);

  const result = changeContentSource(root, next.id);
  assert.equal(result.changed, true);
  assert.equal(C.boundField(card, C.VAL + property), nextTitle.id,
    'the page-local property mapping follows its semantic field');
  assert.equal(JSON.stringify(C.findComponent(componentId)), definitionBefore,
    'property-bound component internals do not need a shared-definition edit');
});

test('component cycles terminate and a true None source keeps direct bindings as recovery data', () => {
  const old = C.collectionAdd('Original cycle source')!;
  const oldTitle = firstField(old, 'title', 'Title', 'text');
  const next = C.collectionAdd('Next cycle source')!;
  firstField(next, oldTitle.id, 'Title', 'text');
  const bound = C.N('heading'); C.bindSet(bound, 'text', C.bindField(oldTitle.id));
  const aToB = C.N('box'); aToB.use = 'component-b';
  const bToA = C.N('box'); bToA.use = 'component-a';
  C.state.meta.components = [
    { id: 'component-a', name: 'Cycle A', node: C.N('box', {}, {}, [bound, aToB]), props: [] },
    { id: 'component-b', name: 'Cycle B', node: C.N('box', {}, {}, [bToA]), props: [] }
  ];
  const instance = C.N('box'); instance.use = 'component-a';
  const root = C.N('section', {}, {}, [instance]); C.srcSet(root, old.id); put(root);
  const definitionsBefore = JSON.stringify(C.state.meta.components);
  assert.equal(changeContentSource(root, next.id).changed, true, 'cycle protection still permits a safe same-path change');
  assert.equal(JSON.stringify(C.state.meta.components), definitionsBefore);

  const depth = C.hist.u.length;
  assert.equal(changeContentSource(root, '').changed, true, 'clearing to a true None is a reversible disconnect');
  assert.equal(root.src, undefined);
  assert.equal(C.findComponent('component-a')!.node.children[0].bind!.text.path, oldTitle.id,
    'the direct definition binding remains available for Undo recovery');
  assert.equal(C.hist.u.length, depth + 1);
  const reselectDepth = C.hist.u.length;
  const reselect = changeContentSource(root, next.id);
  assert.deepEqual(reselect.blocked, { component: 'Cycle A', additional: 0, disconnected: true },
    'without a before source, a stored definition path is not guessed from a reused id');
  assert.equal(root.src, undefined);
  assert.equal(C.hist.u.length, reselectDepth, 'blocked reselection is atomic');
});

test('a selected component instance uses and safely returns to its definition source', () => {
  const original = C.collectionAdd('Definition source')!;
  const originalTitle = firstField(original, 'title', 'Title', 'text');
  const replacement = C.collectionAdd('Placement source')!;
  firstField(replacement, originalTitle.id, 'Title', 'text');
  const heading = C.N('heading'); C.bindSet(heading, 'text', C.bindField(originalTitle.id));
  const card = C.N('box', {}, {}, [heading]); C.srcSet(card, original.id);
  put(card);
  const componentId = C.componentFromNode(card.id, 'Sourced card')!;
  const definitionBefore = JSON.stringify(C.findComponent(componentId));

  assert.equal(card.src, undefined, 'the placement initially inherits the definition source');
  assert.equal(changeContentSource(card, replacement.id).changed, true,
    'the inherited definition source is the before schema for an instance override');
  assert.equal(card.src, replacement.id);
  assert.equal(changeContentSource(card, '').changed, true,
    'None removes the override and resolves back to the definition source');
  assert.equal(card.src, undefined);
  assert.equal(JSON.stringify(C.findComponent(componentId)), definitionBefore);
});

test('adding or removing a redundant instance override preserves same-effective list settings', () => {
  const collection = C.collectionAdd('Definition list source')!;
  const rank = firstField(collection, 'rank_a', 'Rank', 'number');
  field(collection, 'rank_b', 'Rank', 'number');
  const list = C.N('list', { sort: rank.id, where: rank.id, op: 'is', val: '7' });
  C.srcSet(list, collection.id); put(list);
  const componentId = C.componentFromNode(list.id, 'Sourced list')!;
  const definitionBefore = JSON.stringify(C.findComponent(componentId));
  const settingsBefore = JSON.stringify(list.props);

  assert.equal(list.use, componentId);
  assert.equal(C.findComponent(componentId)!.node.src, collection.id);
  const explicit = changeContentSource(list, collection.id);
  assert.equal(explicit.changed, true,
    'an explicit override may be added even though its effective source is inherited');
  assert.deepEqual(explicit, { changed: true, cleared: 0, remapped: 0 });
  assert.equal(JSON.stringify(list.props), settingsBefore,
    'ambiguous labels cannot clear settings when the effective schema did not change');
  assert.equal(changeContentSource(list, '').changed, true);
  assert.equal(JSON.stringify(list.props), settingsBefore);
  assert.equal(JSON.stringify(C.findComponent(componentId)), definitionBefore);
});


test('reselecting a disconnected inherited component source explains safe recovery without mutating history', () => {
  const collection = C.collectionAdd('Photo collection')!;
  const photo = firstField(collection, 'photo', 'Photo', 'image');
  const image = C.N('image', { src: 'asset:fallback' });
  C.bindSet(image, 'src', C.bindField(photo.id));
  const card = C.N('box', {}, {}, [image]);
  const root = C.N('section', {}, {}, [card]);
  C.srcSet(root, collection.id); put(root);
  const cid = C.componentFromNode(card.id, 'Photo card')!;
  const definitionBefore = JSON.stringify(C.findComponent(cid));
  const connectedBefore = JSON.stringify(C.doc());
  const depth = C.hist.u.length;
  assert.equal(changeContentSource(root, '').changed, true);
  assert.equal(root.src, undefined);
  assert.equal(C.hist.u.length, depth + 1, 'disconnect is one reversible edit');
  assert.equal(JSON.stringify(C.findComponent(cid)), definitionBefore);
  const disconnectedBefore = JSON.stringify(C.doc()), disconnectedDepth = C.hist.u.length;
  const blocked = changeContentSource(root, collection.id);
  assert.deepEqual(blocked, { changed: false, cleared: 0, remapped: 0,
    blocked: { component: 'Photo card', additional: 0, disconnected: true } });
  assert.equal(JSON.stringify(C.doc()), disconnectedBefore, 'blocked reselect preserves all document bytes');
  assert.equal(C.hist.u.length, disconnectedDepth, 'blocked reselect makes no checkpoint');
  assert.equal(JSON.stringify(C.findComponent(cid)), definitionBefore);

  r.draw(() => <Inspector />, 'right');
  const select = r.$('select[aria-label="Content source collection"]') as HTMLSelectElement;
  r.pick(select, collection.id);
  assert.equal(select.value, '');
  const message = String(r.arg('toast')?.[0]);
  assert.match(message, /Use Undo or version history to restore the previous source/);
  assert.match(message, /CMS fields.*Photo card.*component properties/);
  assert.equal(message, sourceChangeBlocked(blocked));
  assert.equal(JSON.stringify(C.doc()), disconnectedBefore);
  assert.equal(C.hist.u.length, disconnectedDepth);

  const invalid = changeContentSource(root, 'missing-untrusted-collection');
  assert.deepEqual(invalid, { changed: false, cleared: 0, remapped: 0 });
  assert.equal(sourceChangeBlocked(invalid), '', 'an invalid request does not invent a blocked recovery reason');
  C.undo();
  assert.equal(JSON.stringify(C.doc()), connectedBefore, 'Undo can recover the exact connected document');
});
