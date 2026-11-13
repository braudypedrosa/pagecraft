import { beforeEach, describe, expect, test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';
import type { Node as PcNode } from '../app/src/core/types';

const rows = (n: PcNode) => n.props.items as Array<{ label: string; panel?: string; panelId?: string }>;
function fixture() {
  const tabs = C.N('tabs', { items: [
    { label: 'Preventive', panel: 'Routine care and advice.' },
    { label: 'Planning', panel: 'Discuss your options.' },
  ] });
  const box = C.N('box', {}, {}, [tabs]);
  C.state.pages[0].tree = [C.N('section', {}, {}, [box])];
  return { tabs, box };
}
function integrity(tabs: PcNode) {
  expect(C.tabPanelProblem(tabs)).toBeNull();
  expect(rows(tabs).map(row => row.panelId)).toEqual(tabs.children.map(panel => panel.id));
  expect(new Set(tabs.children.map(panel => panel.id)).size).toBe(tabs.children.length);
}
const scriptBody = (s: string) => s.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');

beforeEach(() => { C.seed(); C.state.ui = C.initUi(); });

describe('editable tab panels', () => {
  test('converts existing text into native paragraphs without changing content', () => {
    const { tabs } = fixture();
    expect(C.enableTabPanels(tabs)).toBe(true);
    integrity(tabs);
    expect(tabs.children.map(panel => panel.children[0].props)).toMatchObject([
      { text: 'Routine care and advice.', level: 'p' },
      { text: 'Discuss your options.', level: 'p' },
    ]);
    expect(rows(tabs).every(row => row.panel === undefined)).toBe(true);
  });

  test('renders linked native content, styles and assets', () => {
    const { tabs } = fixture(); C.enableTabPanels(tabs);
    tabs.children[0].children.push(
      C.N('heading', { text: 'Care options', level: 'h2' }, { d: { color: '#076a9f' } }),
      C.N('image', { src: 'asset:care-photo', alt: 'Care room' }),
      C.N('button', { text: 'Read more', link: 'contact.html' }),
    );
    const html = C.renderNode(tabs, { edit: false });
    expect(html).toContain('Care options'); expect(html).toContain('Care room');
    expect(html).toContain('Read more'); expect(html).toContain('asset:care-photo');
    expect(C.treeCss([C.state.pages[0].tree], false)).toContain('#076a9f');
    expect(C.assetPaths(html, id => ({ id, name: 'room.jpg' }))).toContain('assets/room-carephoto.jpg');
  });

  test('reorder, duplicate, delete and copy preserve panel relationships', () => {
    const { tabs, box } = fixture(); C.enableTabPanels(tabs);
    const first = tabs.children[0].id;
    expect(C.tabMove(tabs, 0, 1)).toBe(true); integrity(tabs);
    expect(tabs.children[1].id).toBe(first);
    const duplicated = C.tabDuplicate(tabs, 1); expect(duplicated).toBeTruthy(); integrity(tabs);
    expect(C.tabRemove(tabs, 2)).toBe(true); integrity(tabs);
    expect(C.dupMany([tabs.children[0].id])).toBe(1); integrity(tabs);
    expect(C.delMany([tabs.children[1].id])).toBe(1); integrity(tabs);
    const clone = C.reid(C.clone(tabs)); integrity(clone);
    expect(clone.children.map(n => n.id)).not.toEqual(tabs.children.map(n => n.id));
    expect(C.copyNode(tabs.id)).toBe(true);
    const pasted = C.pasteNode(box.id)!; integrity(pasted);
    expect(pasted.children.map(n => n.id)).not.toEqual(tabs.children.map(n => n.id));
    expect(C.delMany([pasted.id])).toBe(1); integrity(tabs);
  });

  test('protects direct panel ownership and selects the descendant panel in the editor', () => {
    const { tabs, box } = fixture(); C.enableTabPanels(tabs);
    const panel = tabs.children[1]; const child = panel.children[0];
    C.moveNode(panel.id, box, 0); integrity(tabs);
    const added = C.insert('box', tabs, 0); expect(added).toBeTruthy(); integrity(tabs);
    expect(tabs.children[0].children.some(n => n.id === added!.id)).toBe(true);
    C.selSet([child.id]);
    const dom = new JSDOM(C.renderNode(tabs, { edit: true }));
    const buttons = dom.window.document.querySelectorAll('[role=tab]');
    expect(buttons[1].getAttribute('aria-selected')).toBe('true');
    expect(C.tabSelectionPath(child.id)).toContain(panel.id);
  });

  test('requires schema 15 and rejects missing, duplicate and mixed references', () => {
    const { tabs } = fixture(); C.enableTabPanels(tabs);
    const document = () => ({ v: 15, pages: [{ tree: [C.clone(tabs)] }] });
    expect(() => C.migrate({ ...document(), v: 14 })).toThrow(/schema 15/);
    expect(C.migrate(document())).toBeTruthy();
    for (const change of [
      (n: PcNode) => { rows(n)[0].panelId = 'missing'; },
      (n: PcNode) => { rows(n)[1].panelId = rows(n)[0].panelId; },
      (n: PcNode) => { rows(n)[0].panel = 'old text'; },
    ]) {
      const doc = document(); change(doc.pages[0].tree[0]);
      expect(() => C.migrate(doc)).toThrow();
    }
  });

  test('root tab components retain panels through instances and document reopening', () => {
    const { tabs, box } = fixture(); C.enableTabPanels(tabs);
    const componentId = C.componentFromNode(tabs.id, 'Care topics')!;
    const definition = C.findComponent(componentId)!;
    integrity(definition.node);
    expect(definition.node.children[0].children[0].props.text).toBe('Routine care and advice.');
    expect(tabs.children).toEqual([]); expect(rows(tabs)).toEqual([]);
    const second = C.instanceInsert(componentId, box, 1)!;
    expect(second.children).toEqual([]); expect(rows(second)).toEqual([]);
    const saved = JSON.parse(JSON.stringify(C.doc()));
    const reopened = C.migrate(saved);
    expect(reopened).toBeTruthy(); C.restore(reopened);
    expect(C.componentOpen(componentId)).toBe(true);
    integrity(C.findComponent(componentId)!.node);
    C.componentClose();
    const html = C.buildPage(C.state.pages[0]);
    expect(html.match(/Routine care and advice\./g)).toHaveLength(2);
    expect(html.match(/Discuss your options\./g)).toHaveLength(2);
  });

  test('a component containing tabs retains nested panel references when copied', () => {
    const { tabs, box } = fixture(); C.enableTabPanels(tabs);
    const componentId = C.componentFromNode(box.id, 'Care section')!;
    const component = C.findComponent(componentId)!;
    const nested = component.node.children[0]; integrity(nested);
    expect(nested.children[0].id).not.toBe(tabs.children[0].id);
    expect(C.dupMany([box.id])).toBe(1);
    const reopened = C.migrate(JSON.parse(JSON.stringify(C.doc())));
    expect(reopened).toBeTruthy(); C.restore(reopened);
    integrity(C.findComponent(componentId)!.node.children[0]);
    expect(C.buildPage(C.state.pages[0]).match(/Routine care and advice\./g)).toHaveLength(2);
  });

  test('public tabs support pointer and keyboard without affecting nested tabs; content exists without script', () => {
    const { tabs } = fixture(); C.enableTabPanels(tabs);
    const nested = C.N('tabs', { items: [{ label: 'Details', panel: 'First detail' }, { label: 'More', panel: 'Second detail' }] });
    C.enableTabPanels(nested); tabs.children[0].children.push(nested);
    const html = C.renderNode(tabs, { edit: false });
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const { document, KeyboardEvent } = dom.window;
    expect(document.body.textContent).toContain('Routine care and advice.');
    expect(document.body.textContent).toContain('Discuss your options.');
    expect(document.querySelector('[data-tabs-ready]')).toBeNull();
    dom.window.eval(scriptBody(C.TABS_JS));
    const outer = document.querySelector('[data-tabs]')!;
    const inner = outer.querySelector('[data-tabs]')!;
    const outerButtons = Array.from(outer.children[0].querySelectorAll('[role=tab]')) as HTMLButtonElement[];
    const innerButtons = Array.from(inner.children[0].querySelectorAll('[role=tab]')) as HTMLButtonElement[];
    innerButtons[1].click(); expect(innerButtons[1].getAttribute('aria-selected')).toBe('true');
    expect(outerButtons[0].getAttribute('aria-selected')).toBe('true');
    outerButtons[1].click(); expect(outerButtons[1].getAttribute('aria-selected')).toBe('true');
    outerButtons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(outerButtons[0].getAttribute('aria-selected')).toBe('true');
    outerButtons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(outerButtons[1].getAttribute('aria-selected')).toBe('true');
    outerButtons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(outerButtons[0].getAttribute('aria-selected')).toBe('true');
    outerButtons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(outerButtons[1].getAttribute('aria-selected')).toBe('true');
    expect(innerButtons[1].getAttribute('aria-selected')).toBe('true');
    dom.window.close();
  });
});
