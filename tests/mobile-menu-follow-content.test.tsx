// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { MobileMenuBuilder } from '../app/src/ui/inspector/MobileMenuBuilder';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const links = [
  { id: 'work', label: 'Work', href: '/work' },
  { id: 'about', label: 'About', href: '/about' },
];

function mobileContent(nav: ReturnType<typeof C.N>) {
  const dom = new JSDOM(`<body>${C.renderNode(nav, { edit: false })}</body>`, { url: 'https://example.test/' });
  return dom.window.document.querySelector('[data-nav-content]') as HTMLElement;
}

test('a new built menu follows the current parent links and keeps one non-landmark link list', () => {
  const nav = C.N('nav', { aria: 'Primary', items: links });
  C.state.header.push(nav);
  const definition = C.ensureMobileMenuComponent(nav, 'follow');

  expect(C.mobileMenuMode(nav)).toBe('follow');
  expect(nav.props.mobileMenuFollowComponent).toBe(definition.id);
  expect(C.mobileMenuDefinition(nav)).toBe(definition);
  expect(C.contentControls(C.mobileMenuLinksNode(definition)!)).toEqual([]);

  nav.props.items = [
    { id: 'contact', label: 'Contact', href: '/contact' },
    { id: 'work', label: 'Our work', href: '/projects' },
    { id: 'case', parentId: 'work', label: 'Case study', href: '/projects/case-study' },
  ];
  const content = mobileContent(nav);
  expect([...content.querySelectorAll('a')].map(link => [link.textContent, link.getAttribute('href')])).toEqual([
    ['Contact', '/contact'], ['Our work', '/projects'], ['Case study', '/projects/case-study'],
  ]);
  expect(content.querySelectorAll('ul.pagecraft-managed-mobile-links')).toHaveLength(1);
  expect(content.querySelectorAll('nav,[data-nav],[data-nav-t]')).toHaveLength(0);
  expect(content.querySelector('li .sub-menu a')?.textContent).toBe('Case study');
  const managed = C.mobileMenuLinksNode(definition)!;
  managed.css.d.color = '#345678';
  const css = C.treeCss([[nav]], false);
  expect(css).toContain(`${C.selOf(managed)}.pagecraft-mobile-nav-links`);
  expect(css).toContain('flex-direction:column');
  expect(css).toContain('color:#345678');

  nav.props.items = [{ id: 'new', label: 'New only', href: '/new' }];
  expect([...mobileContent(nav).querySelectorAll('a')].map(link => link.textContent)).toEqual(['New only']);
});

test('legacy custom menus stay custom and keep their authored tree byte for byte', () => {
  const widget = C.N('heading', { text: 'Legacy heading' }, { d: { color: '#123456' }, t: {}, m: {} });
  widget.id = 'legacy-authored-id';
  const root = C.N('section', { tag: 'div' }, {}, [widget]);
  const definition = { id: 'legacy-mobile', name: 'Legacy mobile', mobileMenu: true, node: root, props: [] };
  C.state.meta.components = [definition];
  const nav = C.N('nav', { items: links, mobileMenuComponent: definition.id });
  const before = JSON.stringify(definition);

  expect(C.mobileMenuMode(nav)).toBe('custom');
  expect(C.mobileMenuDefinition(nav)).toBe(definition);
  expect(C.renderNode(nav, { edit: false })).toContain('Legacy heading');
  expect(JSON.stringify(definition)).toBe(before);

  const compatibilityNav = C.N('nav', { items: links });
  const compatibilityLayout = C.ensureMobileMenuComponent(compatibilityNav);
  expect(compatibilityLayout.mobileMenuSource).toBe('custom');
  expect(compatibilityNav.props.mobileMenuComponent).toBe(compatibilityLayout.id);
});

test('mode switches are atomic and keep independent follow and custom layouts through save and reload', () => {
  const nav = C.N('nav', { aria: 'Primary', items: links });
  C.state.header.push(nav);
  r.draw(() => <MobileMenuBuilder n={nav} />, 'right');

  act(() => r.click(r.$('button.btn')));
  const followId = String(nav.props.mobileMenuFollowComponent);
  const follow = C.findComponent(followId)!;
  follow.node.children.push(C.N('heading', { text: 'Follow extra' }));
  const followBefore = JSON.stringify(follow);
  C.componentClose();
  C.hist.u.length = 0;
  C.hist.r.length = 0;
  r.draw(() => <MobileMenuBuilder n={nav} />, 'right');

  act(() => r.pick(r.$('select[data-mobile-menu-mode]')!, 'custom'));
  const customId = String(nav.props.mobileMenuComponent);
  const custom = C.findComponent(customId)!;
  custom.node.id = 'custom-root-id';
  custom.node.css.d['background-color'] = '#abcdef';
  custom.node.children.push(C.N('heading', { text: 'Custom widget' }));
  const customBefore = JSON.stringify(custom);
  expect(C.hist.u).toHaveLength(1);

  C.undo();
  expect(C.mobileMenuMode(C.state.header[0])).toBe('follow');
  expect(C.findComponent(customId)).toBeNull();
  expect(JSON.stringify(C.findComponent(followId))).toBe(followBefore);
  C.redo();
  expect(C.mobileMenuMode(C.state.header[0])).toBe('custom');
  expect(JSON.stringify(C.findComponent(customId))).toBe(customBefore);

  const restoredCustomBefore = JSON.stringify(C.findComponent(customId));
  const liveNav = C.state.header[0];
  C.setMobileMenuMode(liveNav, 'follow');
  C.setMobileMenuMode(liveNav, 'custom');
  expect(JSON.stringify(C.findComponent(customId))).toBe(restoredCustomBefore);

  const saved = C.clone(C.doc());
  C.blankProject('Other');
  C.restore(saved);
  expect(C.state.header[0].props.mobileMenuFollowComponent).toBe(followId);
  expect(C.state.header[0].props.mobileMenuComponent).toBe(customId);
  expect(JSON.stringify(C.findComponent(customId))).toBe(restoredCustomBefore);
});

test('managed links are read only and the compact action returns to their reusable Nav owner', () => {
  const nav = C.N('nav', { aria: 'Primary', items: links });
  nav.id = 'component-owned-nav';
  const ownerRoot = C.N('section', {}, {}, [nav]);
  C.state.meta.components = [{ id: 'header-component', name: 'Header component', node: ownerRoot, props: [] }];
  const follow = C.ensureMobileMenuComponent(nav, 'follow');
  const managed = C.mobileMenuLinksNode(follow)!;
  expect(C.prepareMobileMenuEdit(nav, follow.id)).toBe(true);
  C.componentOpen(follow.id);
  expect(C.renderNode(managed, { edit: true })).toContain('Work');
  expect(C.renderNode(managed, { edit: true })).toContain('About');
  C.selSet([managed.id]);

  r.draw(() => <Inspector />, 'right');
  expect(r.host.textContent).toContain('Edit navigation links');
  expect(r.host.textContent).not.toContain('Menu links');
  expect(r.host.textContent).not.toContain('Collapse at');
  expect(r.host.textContent).not.toContain('Mobile menu');
  expect(r.$('button[title="Edit the links on the parent navigation"]')).not.toBeNull();

  act(() => r.click(r.$('button[title="Edit the links on the parent navigation"]')));
  expect(r.calls).toContainEqual(['editComponent', 'header-component']);
  expect(r.calls).toContainEqual(['select', nav.id, { scroll: false }]);
});

test('a shared Follow layout previews and returns to the exact parent that opened it', () => {
  const first = C.N('nav', { aria: 'First', items: [{ id: 'first', label: 'First link', href: '/first' }] });
  first.id = 'first-parent-nav';
  C.state.header = [first];
  const follow = C.ensureMobileMenuComponent(first, 'follow');
  first.props.mobileMenuMode = 'follow';
  const second = C.N('nav', {
    aria: 'Second', mobileMenuMode: 'follow', mobileMenuFollowComponent: follow.id,
    items: [{ id: 'second', label: 'Second link', href: '/second' }],
  });
  second.id = 'second-parent-nav';
  C.state.footer = [second];
  const managed = C.mobileMenuLinksNode(follow)!;

  r.draw(() => <MobileMenuBuilder n={second} />, 'right');
  act(() => r.click(r.$('button.btn')));
  expect(C.renderNode(managed, { edit: true })).toContain('Second link');
  expect(C.renderNode(managed, { edit: true })).not.toContain('First link');
  C.selSet([managed.id]);
  r.draw(() => <Inspector />, 'right');
  act(() => r.click(r.$('button[title="Edit the links on the parent navigation"]')));
  expect(r.calls).toContainEqual(['setMode', 'footer']);
  expect(r.calls).toContainEqual(['select', second.id, { scroll: false }]);

  r.draw(() => <MobileMenuBuilder n={first} />, 'right');
  act(() => r.click(r.$('button.btn')));
  expect(C.renderNode(managed, { edit: true })).toContain('First link');
  expect(C.renderNode(managed, { edit: true })).not.toContain('Second link');

  // A direct component open has no parent handoff and must drop the prior owner.
  C.componentOpen(follow.id);
  expect(C.renderNode(managed, { edit: true })).not.toContain('First link');
  expect(C.renderNode(managed, { edit: true })).not.toContain('Second link');

  C.componentClose();
  r.draw(() => <MobileMenuBuilder n={second} />, 'right');
  act(() => r.click(r.$('button.btn')));
  C.state.footer = [];
  expect(C.renderNode(managed, { edit: true })).not.toContain('First link');
  expect(C.renderNode(managed, { edit: true })).not.toContain('Second link');
  C.selSet([managed.id]);
  r.draw(() => <Inspector />, 'right');
  const action = r.$('button[title="Edit the links on the parent navigation"]') as HTMLButtonElement;
  expect(action.disabled).toBe(true);
  const callsBefore = r.calls.length;
  act(() => r.click(action));
  expect(r.calls).toHaveLength(callsBefore);
});

test('restoring a document clears an active mobile-menu owner context', () => {
  const nav = C.N('nav', { items: [{ id: 'one', label: 'Owner link', href: '/owner' }] });
  C.state.header = [nav];
  const follow = C.ensureMobileMenuComponent(nav, 'follow');
  nav.props.mobileMenuMode = 'follow';
  expect(C.prepareMobileMenuEdit(nav, follow.id)).toBe(true);
  C.componentOpen(follow.id);
  expect(C.state.ui.mobileMenuOwner?.nodeId).toBe(nav.id);
  const snapshot = C.clone(C.doc());
  C.restore(snapshot);
  expect(C.state.ui.mobileMenuOwner).toBeNull();
  expect(C.state.ui.mobileMenuOwnerPending).toBeNull();
  const managed = C.mobileMenuLinksNode(C.findComponent(follow.id))!;
  expect(C.renderNode(managed, { edit: true })).not.toContain('Owner link');
});

test('style undo and redo keep the exact valid Follow owner active', () => {
  const nav = C.N('nav', { items: [{ id: 'one', label: 'Owner link', href: '/owner' }] });
  nav.id = 'history-owner-nav';
  C.state.header = [nav];
  const follow = C.ensureMobileMenuComponent(nav, 'follow');
  nav.props.mobileMenuMode = 'follow';
  expect(C.prepareMobileMenuEdit(nav, follow.id)).toBe(true);
  C.componentOpen(follow.id);
  const managedId = C.mobileMenuLinksNode(follow)!.id;
  C.selSet([managedId]);
  C.hist.u.length = 0;
  C.hist.r.length = 0;
  const originalColor = C.locate(managedId)!.node.css.d.color;

  C.edit(() => { C.locate(managedId)!.node.css.d.color = '#123456'; });
  expect(C.locate(managedId)!.node.css.d.color).toBe('#123456');

  C.undo();
  expect(C.locate(managedId)!.node.css.d.color).toBe(originalColor);
  expect(C.renderNode(C.locate(managedId)!.node, { edit: true })).toContain('Owner link');
  r.draw(() => <Inspector />, 'right');
  expect((r.$('button[title="Edit the links on the parent navigation"]') as HTMLButtonElement).disabled).toBe(false);

  C.redo();
  expect(C.locate(managedId)!.node.css.d.color).toBe('#123456');
  expect(C.renderNode(C.locate(managedId)!.node, { edit: true })).toContain('Owner link');
  r.draw(() => <Inspector />, 'right');
  expect((r.$('button[title="Edit the links on the parent navigation"]') as HTMLButtonElement).disabled).toBe(false);
});

test('history restore drops an exact owner whose menu reference changed', () => {
  const nav = C.N('nav', { items: [{ id: 'one', label: 'Original owner link', href: '/owner' }] });
  C.state.header = [nav];
  const follow = C.ensureMobileMenuComponent(nav, 'follow');
  const replacement = C.ensureMobileMenuComponent(nav, 'custom');
  nav.props.mobileMenuMode = 'follow';
  expect(C.prepareMobileMenuEdit(nav, follow.id)).toBe(true);
  C.componentOpen(follow.id);
  const managedId = C.mobileMenuLinksNode(follow)!.id;
  C.selSet([managedId]);
  C.hist.u.length = 0;
  C.hist.r.length = 0;

  C.edit(() => { nav.props.mobileMenuFollowComponent = replacement.id; });
  C.edit(() => { C.state.meta.name = 'Changed after invalid owner snapshot'; });
  C.undo();

  expect(C.state.ui.mobileMenuOwner).toBeNull();
  expect(C.renderNode(C.locate(managedId)!.node, { edit: true })).not.toContain('Original owner link');
  r.draw(() => <Inspector />, 'right');
  expect((r.$('button[title="Edit the links on the parent navigation"]') as HTMLButtonElement).disabled).toBe(true);
});
