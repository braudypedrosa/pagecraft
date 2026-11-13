// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { Cms } from '../app/src/ui/Cms';
import { L } from '../app/src/ui/ctx';
import { rig, type Rig } from './ui.setup';

let r: Rig;

beforeEach(() => {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.meta.collections = [];
  C.state.meta.blocks = [];
  C.state.pages[0].tree = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;
  r = rig();
});

afterEach(() => {
  window.__pcFeedback?.destroy();
  render(null, r.host);
  r.host.remove();
  vi.restoreAllMocks();
});

test('deleting a collection disconnects every source in the same undoable CMS change', async () => {
  const removed = C.collectionAdd('Articles');
  const summary = C.fieldAdd(removed.id, 'Summary', 'text')!;
  const article = C.itemAdd(removed.id)!;
  C.itemSet(removed.id, article.id, 'title', 'First article');

  const related = C.collectionAdd('Authors');
  const favourite = C.fieldAdd(related.id, 'Favourite article', 'ref')!;
  favourite.ref = removed.id;
  const author = C.itemAdd(related.id)!;
  C.itemSet(related.id, author.id, favourite.id, article.id);

  const list = C.insert('list', null, 0)!;
  list.src = removed.id;
  list.props.sort = summary.id;
  list.props.where = 'title';
  list.props.op = 'has';
  list.props.val = 'First';

  const headerList = C.N('list', {});
  const footerList = C.N('list', {});
  const componentList = C.N('list', {});
  const blockList = C.N('list', {});
  for (const stored of [headerList, footerList, componentList, blockList]) stored.src = removed.id;
  C.state.header.push(headerList);
  C.state.footer.push(footerList);
  C.state.meta.components = [{ id: 'article-feed', name: 'Article feed', node: componentList, props: [] }];
  C.state.meta.blocks.push({ id: 'article-block', name: 'Article block', node: blockList });

  const detail = C.clone(C.state.pages[0]);
  detail.id = 'article-detail';
  detail.name = 'Article detail';
  detail.slug = 'article';
  detail.collection = removed.id;
  detail.bindTitle = 'title';
  detail.bindDesc = summary.id;
  C.state.pages.push(detail);
  C.hist.u.length = 0;

  const confirm = vi.spyOn(L, 'askConfirm').mockResolvedValue(true);
  r.draw(<Cms />);
  await act(async () => {
    r.click(r.$('[title="Delete this collection"]')!);
  });

  await vi.waitFor(() => expect(C.findCollection(removed.id)).toBeNull());
  expect(confirm).toHaveBeenCalledOnce();
  expect(list.src).toBeUndefined();
  expect(list.props.sort).toBe('');
  expect(list.props.where).toBe('');
  expect(list.props.op).toBe('is');
  expect(list.props.val).toBeUndefined();
  expect(headerList.src).toBeUndefined();
  expect(footerList.src).toBeUndefined();
  expect(componentList.src).toBeUndefined();
  expect(blockList.src).toBeUndefined();
  expect(detail.collection).toBeUndefined();
  expect(detail.bindTitle).toBeUndefined();
  expect(detail.bindDesc).toBeUndefined();
  expect(favourite.ref).toBeUndefined();
  expect(author.values[favourite.id]).toBeUndefined();
  expect(String(confirm.mock.calls[0]?.[1])).toContain('Collection Lists and detail pages');
  expect(C.hist.u).toHaveLength(1);

  C.undo();
  expect(C.findCollection(removed.id)).not.toBeNull();
  expect(C.locateAny(list.id)?.node.src).toBe(removed.id);
  expect(C.state.header[0].src).toBe(removed.id);
  expect(C.state.footer[0].src).toBe(removed.id);
  expect(C.state.meta.components?.[0].node.src).toBe(removed.id);
  expect(C.state.meta.blocks[0].node.src).toBe(removed.id);
  const restoredDetail = C.state.pages.find(page => page.id === detail.id)!;
  expect(restoredDetail.collection).toBe(removed.id);
  expect(restoredDetail.bindTitle).toBe('title');
  expect(restoredDetail.bindDesc).toBe(summary.id);
  const restoredRelated = C.findCollection(related.id)!;
  const restoredFavourite = restoredRelated.fields.find(field => field.id === favourite.id)!;
  expect(restoredFavourite.ref).toBe(removed.id);
  expect(restoredRelated.items[0].values[favourite.id]).toBe(article.id);
});

test('replacing retained collections leaves valid list, detail, SEO and reference values untouched', () => {
  const retained = C.collectionAdd('Articles');
  const summary = C.fieldAdd(retained.id, 'Summary', 'text')!;
  const article = C.itemAdd(retained.id)!;
  const related = C.collectionAdd('Authors');
  const favourite = C.fieldAdd(related.id, 'Favourite article', 'ref')!;
  favourite.ref = retained.id;
  const author = C.itemAdd(related.id)!;
  C.itemSet(related.id, author.id, favourite.id, article.id);

  const list = C.insert('list', null, 0)!;
  list.src = retained.id;
  list.props.sort = summary.id;
  list.props.where = 'title';
  list.props.op = 'has';
  list.props.val = 'First';
  const detail = C.state.pages[0];
  detail.collection = retained.id;
  detail.bindTitle = 'title';
  detail.bindDesc = summary.id;

  C.collectionsReplace(C.doc(), C.clone(C.collections()));

  expect(list.src).toBe(retained.id);
  expect(list.props).toMatchObject({ sort: summary.id, where: 'title', op: 'has', val: 'First' });
  expect(detail.collection).toBe(retained.id);
  expect(detail.bindTitle).toBe('title');
  expect(detail.bindDesc).toBe(summary.id);
  const keptRelated = C.findCollection(related.id)!;
  const keptFavourite = keptRelated.fields.find(field => field.id === favourite.id)!;
  expect(keptFavourite.ref).toBe(retained.id);
  expect(keptRelated.items[0].values[favourite.id]).toBe(article.id);
});
