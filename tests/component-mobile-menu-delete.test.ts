import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const nav = (id: string, props: Record<string, unknown> = {}) => {
  const node = C.N('nav', {
    aria: id, items: [{ id: id + '-link', label: id + ' link', href: '/' + id }], ...props
  });
  node.id = id;
  return node;
};

beforeEach(() => {
  C.blankProject('Delete mobile layout');
  C.state.header = [];
  C.state.footer = [];
  C.state.pages[0].tree = [];
  C.state.meta.components = [];
  C.state.meta.blocks = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;
});

test('deleting a mobile layout clears every stored owner and atomically falls active Custom back to Follow', () => {
  const customOwner = nav('source');
  const deleted = C.ensureMobileMenuComponent(customOwner, 'custom');
  deleted.node.children[0].children[0].children.push(C.N('heading', { text: 'Deleted custom content' }));
  const followOwner = nav('follow-source');
  const keptFollow = C.ensureMobileMenuComponent(followOwner, 'follow');
  const otherOwner = nav('other-source');
  const keptCustom = C.ensureMobileMenuComponent(otherOwner, 'custom');

  const header = nav('header', {
    mobileMenuComponent: deleted.id, mobileMenuFollowComponent: keptFollow.id
  });
  const footer = nav('footer', {
    mobileMenuMode: 'follow', mobileMenuComponent: deleted.id, mobileMenuFollowComponent: keptFollow.id
  });
  const pageCustom = nav('page-custom', {
    mobileMenuMode: 'custom', mobileMenuComponent: deleted.id
  });
  const pageKept = nav('page-kept', {
    mobileMenuMode: 'custom', mobileMenuComponent: keptCustom.id, mobileMenuFollowComponent: deleted.id
  });
  const definitionNav = nav('definition-owner', {
    mobileMenuMode: 'custom', mobileMenuComponent: deleted.id
  });
  const blockNav = nav('block-owner', {
    mobileMenuMode: 'custom', mobileMenuComponent: deleted.id
  });
  const ordinary = C.instanceInsert(deleted.id, null, 0)!;
  C.state.header = [header];
  C.state.footer = [footer];
  C.state.pages[0].tree.push(pageCustom, pageKept);
  C.components().push({
    id: 'owner-definition', name: 'Owner definition', node: C.N('section', {}, {}, [definitionNav]), props: []
  });
  C.state.meta.blocks = [{ id: 'owner-block', name: 'Owner block', node: C.N('section', {}, {}, [blockNav]) }];

  const before = C.clone(C.doc());
  let flattened = -1;
  C.edit(() => { flattened = C.componentDelete(deleted.id); });
  const after = C.clone(C.doc());

  expect(flattened).toBe(1);
  expect(ordinary.use).toBeUndefined();
  expect(C.renderNode(ordinary, { edit: false })).toContain('Deleted custom content');
  expect(C.findComponent(deleted.id)).toBeNull();
  for (const owner of [header, pageCustom, definitionNav, blockNav]) {
    expect(owner.props.mobileMenuComponent).toBeUndefined();
    expect(C.mobileMenuMode(owner)).toBe('follow');
  }
  expect(header.props.mobileMenuFollowComponent).toBe(keptFollow.id);
  expect(C.mobileMenuDefinition(header)?.id).toBe(keptFollow.id);
  expect(footer.props.mobileMenuComponent).toBeUndefined();
  expect(footer.props.mobileMenuFollowComponent).toBe(keptFollow.id);
  expect(C.mobileMenuMode(footer)).toBe('follow');
  expect(pageKept.props.mobileMenuFollowComponent).toBeUndefined();
  expect(pageKept.props.mobileMenuComponent).toBe(keptCustom.id);
  expect(C.mobileMenuMode(pageKept)).toBe('custom');
  expect(C.mobileMenuDefinition(pageKept)?.id).toBe(keptCustom.id);
  expect(C.renderNode(pageCustom, { edit: false })).toContain('page-custom link');
  expect(C.renderNode(pageCustom, { edit: false })).not.toContain('Deleted custom content');
  expect(C.findComponent(keptFollow.id)).not.toBeNull();
  expect(C.findComponent(keptCustom.id)).not.toBeNull();
  expect(C.hist.u).toHaveLength(1);

  C.undo();
  expect(C.doc()).toEqual(before);
  C.redo();
  expect(C.doc()).toEqual(after);
});

test('deleting a Follow layout clears only its matching reference and keeps active Custom content', () => {
  const followOwner = nav('follow-source');
  const deleted = C.ensureMobileMenuComponent(followOwner, 'follow');
  const customOwner = nav('custom-source');
  const keptCustom = C.ensureMobileMenuComponent(customOwner, 'custom');
  keptCustom.node.children[0].children[0].children.push(C.N('heading', { text: 'Kept custom content' }));
  const owner = nav('owner', {
    mobileMenuMode: 'custom', mobileMenuComponent: keptCustom.id, mobileMenuFollowComponent: deleted.id
  });
  C.state.pages[0].tree = [owner];

  expect(C.componentDelete(deleted.id)).toBe(0);
  expect(owner.props.mobileMenuFollowComponent).toBeUndefined();
  expect(owner.props.mobileMenuComponent).toBe(keptCustom.id);
  expect(C.mobileMenuMode(owner)).toBe('custom');
  expect(C.renderNode(owner, { edit: false })).toContain('Kept custom content');
});
