// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { QaCtl } from '../app/src/ui/inspector/Lists';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function fixture() {
  const tabs = C.N('tabs');
  C.state.pages[0].tree = [tabs];
  const control = C.DEF.tabs.controls.content.find(value => value.t === 'qa')!;
  const draw = () => act(() => r.draw(<QaCtl n={tabs} c={control} />));
  draw();
  return { tabs, draw };
}

test('converts legacy text and edits linked native panels without losing content', () => {
  const { tabs, draw } = fixture();
  const original = (tabs.props.items as Array<{ label: string; panel: string }>).map(row => ({ ...row }));
  expect(r.$('textarea')).toBeNull(); // legacy rows start collapsed
  act(() => r.click([...r.$$('button')].find(el => el.textContent?.includes('Use editable panels')) || null));
  draw();
  expect(C.hasRichTabPanels(tabs)).toBe(true);
  const rows = tabs.props.items as Array<{ label: string; panelId: string }>;
  expect(rows.map(row => row.label)).toEqual(original.map(row => row.label));
  expect(tabs.children.map(panel => panel.children[0]?.props.text)).toEqual(original.map(row => row.panel));
  expect(r.$$('button').filter(el => el.textContent?.trim() === 'Edit panel')).toHaveLength(3);
  const firstId = rows[0].panelId;
  act(() => r.click(r.$('button[aria-label="Move tab 1 down"]'))); draw();
  expect((tabs.props.items as typeof rows)[1].panelId).toBe(firstId);
  expect(tabs.children[1].id).toBe(firstId);
  act(() => r.click(r.$('button[aria-label="Duplicate tab 2"]'))); draw();
  expect(tabs.children).toHaveLength(4);
  expect(new Set((tabs.props.items as typeof rows).map(row => row.panelId)).size).toBe(4);
  act(() => r.click(r.$('button[aria-label="Remove tab 3"]'))); draw();
  expect(tabs.children).toHaveLength(3);
  expect(C.tabPanelProblem(tabs)).toBeNull();
  act(() => r.click([...r.$$('button')].find(el => el.textContent?.includes('Add tab')) || null)); draw();
  expect(tabs.children).toHaveLength(4);
  expect(C.tabPanelProblem(tabs)).toBeNull();
});

test('Edit panel selects the requested Box and repaints before revealing it', () => {
  const { tabs, draw } = fixture();
  C.enableTabPanels(tabs); draw();
  C.state.ui.multi = ['not-the-panel'] as never;
  const panelId = (tabs.props.items as Array<{ panelId: string }>)[1].panelId;
  const actions = r.$$('button').filter(el => el.textContent?.trim() === 'Edit panel');
  act(() => r.click(actions[1]));
  expect(C.state.ui.sel).toBe(panelId);
  expect(C.selIds()).toEqual([panelId]);
  expect(r.names().indexOf('paint')).toBeLessThan(r.names().indexOf('select'));
  expect(r.arg('select')).toEqual([panelId, { scroll: true }]);
});

test('content-only mode offers no structural tab changes', () => {
  act(() => r.draw(null)); r.host.remove(); r = rig({ canStructure: false });
  const { tabs, draw } = fixture();
  expect([...r.$$('button')].some(el => el.textContent?.includes('Use editable panels'))).toBe(false);
  C.enableTabPanels(tabs); draw();
  expect(r.$('button[aria-label="Remove tab 1"]')?.hasAttribute('disabled')).toBe(true);
  expect([...r.$$('button')].some(el => el.textContent?.trim() === 'Add tab')).toBe(false);
});

test('the final editable panel cannot be removed from the inspector', () => {
  const { tabs, draw } = fixture();
  C.enableTabPanels(tabs);
  while ((tabs.props.items as unknown[]).length > 1) C.tabRemove(tabs, 0);
  draw();
  expect(r.$('button[aria-label="Remove tab 1"]')?.hasAttribute('disabled')).toBe(true);
  expect(tabs.children).toHaveLength(1);
});
