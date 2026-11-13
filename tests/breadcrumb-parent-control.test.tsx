// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { ItemsCtl } from '../app/src/ui/inspector/Lists';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function breadcrumb() {
  const n = C.insert('crumbs', null, 0)!;
  n.props.mode = 'manual';
  n.props.items = [
    { id: 'home', label: 'Workshop home', href: 'index.html' },
    { id: 'work', label: 'Workshop', href: '/workshop/', parentId: 'home', cls: 'work-link', rel: 'nofollow' },
    { id: 'current', label: 'Current workshop', href: '/workshop/current/', parentId: 'work' }
  ];
  const c = C.DEF.crumbs.controls.content.find(control => control.t === 'items')!;
  return { n, c };
}

test('manual Breadcrumb items do not offer an ineffective Parent item control', () => {
  const { n, c } = breadcrumb();
  const before = JSON.stringify(n.props.items);
  r.draw(<ItemsCtl n={n} c={c} />);

  expect(r.$('select[aria-label^="Parent item for"]')).toBeNull();
  expect(r.$$('label').map(label => label.textContent)).not.toContain('Parent item');
  act(() => r.click(r.$$('.navitem-main')[1]));
  expect(r.$('select[aria-label^="Parent item for"]')).toBeNull();
  expect(JSON.stringify(n.props.items)).toBe(before);
});

test('editing a manual Breadcrumb keeps legacy parent data and the ordered trail intact', () => {
  const { n, c } = breadcrumb();
  const expected = structuredClone(n.props.items) as Array<Record<string, any>>;
  r.draw(<ItemsCtl n={n} c={c} />);
  act(() => r.click(r.$$('.navitem-main')[1]));
  const label = r.$('input[aria-label="Navigation label for Workshop, item 2"]')!;
  act(() => r.type(label, 'Workshop details'));
  expected[1].label = 'Workshop details';

  expect(n.props.items).toEqual(expected);
  const output = document.createElement('div');
  output.innerHTML = C.renderNode(n, { edit: false });
  expect([...output.querySelectorAll('ol > li')].map(item => item.textContent))
    .toEqual(['Workshop home', 'Workshop details', 'Current workshop']);
  expect(output.querySelectorAll('ol ol')).toHaveLength(0);
  expect(output.querySelector('li.work-link > a')?.getAttribute('rel')).toBe('nofollow');
  expect(output.querySelector('li:last-child > span')?.getAttribute('aria-current')).toBe('page');
});

test('Nav menu items retain their editable Parent choice and nested output', () => {
  const n = C.insert('nav', null, 0)!;
  n.props.items = [
    { id: 'work', label: 'Workshop', href: '/workshop/' },
    { id: 'details', label: 'Details', href: '/workshop/details/' }
  ];
  const c = C.DEF.nav.controls.content.find(control => control.t === 'items')!;
  r.draw(<ItemsCtl n={n} c={c} />);
  act(() => r.click(r.$$('.navitem-main')[1]));
  const parent = r.$('select[aria-label="Parent item for Details, item 2"]')!;
  expect(parent).not.toBeNull();
  act(() => r.pick(parent, 'work'));

  expect((n.props.items as Array<Record<string, any>>)[1].parentId).toBe('work');
  const output = document.createElement('div');
  output.innerHTML = C.renderNode(n, { edit: false });
  expect(output.querySelector('li.menu-item-has-children > a')?.textContent).toBe('Workshop');
  expect(output.querySelector('li.menu-item-has-children > ul.sub-menu > li > a')?.textContent).toBe('Details');
});
