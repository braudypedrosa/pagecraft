// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { ItemsCtl } from '../app/src/ui/inspector/Lists';
import type { NavItem } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const itemsControl = () => C.DEF.nav.controls.content.find(control => control.t === 'items')!;
const nav = (items: NavItem[]) => C.N('nav', { items });

function targetPage() {
  const target = C.pageDup(0)!;
  target.name = 'QA menu target';
  C.pageSlugSet(1, 'qa-menu-target');
  const anchor = C.N('section');
  anchor.adv.htmlId = 'qa-menu-anchor';
  target.tree = [anchor];
  C.state.cur = 0;
  return target;
}

describe('Pagecraft navigation page provenance', () => {
  test('page and anchor choices persist page identity and survive project JSON round trips', () => {
    const target = targetPage();
    const node = nav([{ id: 'work', label: 'Work', href: 'manual.html#part' }]);
    C.state.pages[0].tree = [node];
    const draw = () => r.draw(<ItemsCtl n={node} c={itemsControl()} />);
    draw();

    act(() => r.pick(r.$('select[aria-label^="Destination for"]')!, 'page'));
    draw();
    act(() => r.pick(r.$('select[aria-label^="Destination page for"]')!, target.id));
    draw();
    act(() => r.pick(r.$('select[aria-label^="Destination section/anchor for"]')!, 'qa-menu-anchor'));

    const item = (node.props.items as NavItem[])[0];
    expect(item).toMatchObject({
      href: 'qa-menu-target.html#qa-menu-anchor',
      pageId: target.id
    });
    expect(item.objectType).toBeUndefined();
    expect(item.objectId).toBeUndefined();

    const copy = C.pageDup(0)!;
    expect(((copy.tree[0].props.items as NavItem[])[0]).pageId).toBe(target.id);
    const saved = JSON.stringify(C.doc());
    C.restore(JSON.parse(saved));
    expect(((C.state.pages[0].tree[0].props.items as NavItem[])[0] as NavItem).pageId).toBe(target.id);
  });

  test('deleting a known target stamps legacy navigation rows and Undo and Redo stay atomic', () => {
    const target = targetPage();
    const legacy = (): NavItem => ({ label: 'Work', href: 'qa-menu-target.html#qa-menu-anchor' });
    const pageNav = nav([legacy(), { label: 'Manual', href: 'manual.html#part' },
      { label: 'Asset', href: 'assets/guide.html' },
      { label: 'Other', href: 'index.html', pageId: C.state.pages[0].id },
      { label: 'Native', href: 'qa-menu-target.html', objectType: 'page', objectId: '42' }]);
    const headerNav = nav([legacy()]);
    const footerNav = nav([legacy()]);
    const componentNav = nav([legacy()]);
    const blockNav = nav([legacy()]);
    C.state.pages[0].tree = [pageNav];
    C.state.header = [headerNav];
    C.state.footer = [footerNav];
    C.doc().meta.components = [{ id: 'menu-definition', name: 'Menu definition', node: componentNav, props: [] }];
    C.doc().meta.blocks = [{ id: 'menu-block', name: 'Menu block', node: blockNav }];

    const rows = () => [pageNav, headerNav, footerNav, componentNav, blockNav]
      .map(node => (node.props.items as NavItem[])[0]);
    C.edit(() => { C.pageDelete(1); }, 'Delete page');

    expect(rows().map(item => item.pageId)).toEqual(Array(5).fill(target.id));
    const controls = pageNav.props.items as NavItem[];
    expect(controls[0].href).toBe('qa-menu-target.html#qa-menu-anchor');
    expect(controls[1].pageId).toBeUndefined();
    expect(controls[2].pageId).toBeUndefined();
    expect(controls[3].pageId).toBe(C.state.pages[0].id);
    expect(controls[4]).toMatchObject({ objectType: 'page', objectId: '42' });
    expect(controls[4].pageId).toBeUndefined();

    C.undo();
    expect(C.state.pages.some(page => page.id === target.id)).toBe(true);
    expect(((C.state.pages[0].tree[0].props.items as NavItem[])[0]).pageId).toBeUndefined();
    C.redo();
    expect(C.state.pages.some(page => page.id === target.id)).toBe(false);
    expect(((C.state.pages[0].tree[0].props.items as NavItem[])[0]).pageId).toBe(target.id);
  });

  test('a page rename keeps stable provenance and deletion retains the latest href and anchor', () => {
    const target = targetPage();
    const node = nav([{
      label: 'Work', href: 'qa-menu-target.html#qa-menu-anchor', pageId: target.id
    }]);
    C.state.pages[0].tree = [node];

    expect(C.pageSlugSet(1, 'renamed-menu-target')).toBeGreaterThan(0);
    const item = (node.props.items as NavItem[])[0];
    expect(item).toMatchObject({
      pageId: target.id,
      href: 'renamed-menu-target.html#qa-menu-anchor'
    });

    C.edit(() => { C.pageDelete(1); }, 'Delete renamed page');
    expect(item).toMatchObject({
      pageId: target.id,
      href: 'renamed-menu-target.html#qa-menu-anchor'
    });
  });

  test('a deleted Pagecraft target stays a missing page until a live page is chosen', () => {
    const target = targetPage();
    const node = nav([{ id: 'work', label: 'Work', href: 'qa-menu-target.html#qa-menu-anchor' }]);
    C.state.pages[0].tree = [node];
    C.pageDelete(1);

    const draw = () => r.draw(<ItemsCtl n={node} c={itemsControl()} />);
    draw();
    const destination = r.$('select[aria-label^="Destination for"]') as HTMLSelectElement;
    const picker = r.$('select[aria-label^="Destination page for"]') as HTMLSelectElement;
    const missing = [...picker.options].find(option => option.value === target.id)!;
    expect(destination.value).toBe('page');
    expect(r.$('.navitem-main small')?.textContent).toBe('Page · Missing page');
    expect(missing.selected).toBe(true);
    expect(missing.disabled).toBe(true);
    expect(missing.textContent).toContain('Missing page · qa-menu-target.html#qa-menu-anchor');
    expect((r.$('select[aria-label^="Destination section/anchor for"]') as HTMLSelectElement).value)
      .toBe('qa-menu-anchor');
    expect((node.props.items as NavItem[])[0].href).toBe('qa-menu-target.html#qa-menu-anchor');

    act(() => r.pick(picker, C.state.pages[0].id));
    expect((node.props.items as NavItem[])[0]).toMatchObject({
      href: 'index.html', pageId: C.state.pages[0].id
    });
  });

  test('missing relative HTML without provenance remains a custom URL', () => {
    const node = nav([{ label: 'Manual', href: 'manual.html#part' }]);
    C.state.pages[0].tree = [node];
    r.draw(<ItemsCtl n={node} c={itemsControl()} />);

    expect((r.$('select[aria-label^="Destination for"]') as HTMLSelectElement).value).toBe('custom');
    expect((r.$('input[aria-label^="Custom URL or section for"]') as HTMLInputElement).value)
      .toBe('manual.html#part');
  });
});
