// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Add } from '../app/src/ui/Add';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); C.state.meta.components = []; });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });
const draw = () => { C.state.ui.atab = 'components'; act(() => r.draw(() => <Add />, 'add')); };
const rows = () => r.$$('.brow');
const subtitle = (row: HTMLElement) => row.querySelector('small')?.textContent;

test('same-name managed layouts show their source alongside real usage and keep row actions', () => {
  const nav = C.N('nav', { aria: 'Main', items: [{ id: 'work', label: 'Work', href: '/work' }] });
  C.state.header = [nav];
  const follow = C.ensureMobileMenuComponent(nav, 'follow');
  const custom = C.ensureMobileMenuComponent(nav, 'custom');
  expect(follow.name).toBe(custom.name);
  C.instanceInsert(custom.id, null, 0);
  const before = C.clone(C.doc());
  draw();
  expect(rows().map(row => row.querySelector('b')?.textContent)).toEqual([follow.name, custom.name]);
  expect(rows().map(subtitle)).toEqual([
    'Follow navigation · 1 mobile menu',
    'Custom content · 1 instance · 1 mobile menu'
  ]);
  for (const row of rows()) {
    expect(row.querySelectorAll('button')).toHaveLength(3);
    expect(row.querySelector('[title="Edit this component"]')).toBeTruthy();
    expect(row.querySelector('[aria-label="Rename this component"]')).toBeTruthy();
    expect(row.querySelector('[title="Delete this component"]')).toBeTruthy();
  }
  act(() => r.click(rows()[0].querySelector('[title="Edit this component"]')));
  expect(r.arg('editComponent')).toEqual([follow.id]);
  expect(C.doc()).toEqual(before);
});

test('legacy managed layouts label as Custom and retain property counts; ordinary cards stay unchanged', () => {
  const nav = C.N('nav');
  const legacy = C.ensureMobileMenuComponent(nav, 'custom');
  delete legacy.mobileMenuSource;
  legacy.props = [{ k: 'label', label: 'Label', t: 'text', def: '' }];
  const ordinary = C.insert('heading', null, 0)!;
  C.componentFromNode(ordinary.id, 'Ordinary card');
  draw();
  expect(rows().map(subtitle)).toEqual([
    'Custom content · 0 instances · 1 property',
    '1 instance · no properties yet'
  ]);
});
