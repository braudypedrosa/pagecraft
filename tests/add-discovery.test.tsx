// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Add, recordElementUse } from '../app/src/ui/Add';
import { L, repaint } from '../app/src/ui/ctx';
import { rig, type Rig } from './ui.setup';

let r: Rig;

const labels = () => r.$$('.pitem span').map(item => item.textContent);
const commonLabels = () => r.$$('.pc-add-group:not(details) .pitem span').map(item => item.textContent);
const search = () => r.$('#add-element-search') as HTMLInputElement;
const type = (value: string) => act(() => r.type(search(), value));

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  r = rig();
  r.draw(() => <Add />, 'add');
});

afterEach(() => {
  act(() => r.draw(null));
  r.host.remove();
  vi.unstubAllGlobals();
});

describe('Add element discovery', () => {
  test('omits empty history and exposes every element in its category', () => {
    expect(commonLabels()).toEqual([]);
    expect(r.$('.addContext')).toBeNull();
    expect(r.$$('details.pc-add-group').map(group => group.querySelector('summary')?.textContent)).toEqual([
      'Layout9', 'Content9', 'Interactive7', 'Spacing2'
    ]);
    expect(r.$$('details.pc-add-group').every(group => group.hasAttribute('open'))).toBe(false);
    expect(r.$('.pc-add-guide')?.textContent).toBe('Browse starter sections');

    act(() => r.click(r.$$('.pc-add-guide button')[0]));
    expect(r.$('.addSwitcher button[aria-selected="true"]')?.textContent?.trim()).toBe('Templates');
  });

  test('shows the six most recent successful element types without removing category entries', () => {
    act(() => ['heading', 'text', 'button', 'image', 'columns', 'nav', 'spacer', 'heading'].forEach(recordElementUse));
    expect(commonLabels()).toEqual(['Heading', 'Spacer', 'Nav menu', 'Columns', 'Image', 'Button']);
    expect(r.$$('.pc-add-group:not(details) .plabel')[0]?.textContent).toBe('Recently used');
    expect(r.$$('details .pitem span').map(item => item.textContent)).toContain('Heading');
    act(() => repaint('add'));
    expect(commonLabels()).toHaveLength(6);
  });

  test('search uses aliases and exposes matches from collapsed groups without duplicates', () => {
    type('layout');
    expect(labels()).toEqual([
      'Section', 'Columns', 'Row', 'Flex', 'Grid', 'Box', 'Link block', 'Slider', 'Collection'
    ]);
    expect(new Set(labels()).size).toBe(labels().length);
    expect(r.$('details.pc-add-group')).toBeNull();

    type('paragraph');
    expect(labels()).toEqual(['Rich text']);
    type('photo');
    expect(labels()).toEqual(['Image']);
  });

  test('search respects provider limits and offers a useful empty state', () => {
    act(() => r.draw(null));
    r.host.remove();
    r = rig({ dynamicContentProvider: 'wordpress' });
    r.draw(() => <Add />, 'add');

    type('collection');
    expect(labels()).toEqual([]);
    expect(r.$('.pc-add-empty')?.textContent).toMatch(/No elements found.*clear the search/i);
    act(() => r.click(r.$('.pc-add-empty button')));
    expect(search().value).toBe('');
    expect(labels()).toContain('Heading');
  });

  test('query survives a normal panel repaint and Escape clears without reaching outer shortcuts', () => {
    type('photo');
    act(() => repaint('add'));
    expect(search().value).toBe('photo');
    expect(labels()).toEqual(['Image']);

    let escapedOutside = false;
    r.host.addEventListener('keydown', event => { if (event.key === 'Escape') { escapedOutside = true; } });
    act(() => {
      search().dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true
      }));
    });
    expect(escapedOutside).toBe(false);
    expect(search().value).toBe('');
    expect(labels()).toContain('Heading');
  });

  test('matching tiles retain the existing click and drag insertion paths', () => {
    type('photo');
    const image = r.$('.pitem')!;
    image.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    expect(r.arg('startDrag')?.[1]).toMatchObject({ kind: 'new', type: 'image' });

    r.click(image);
    expect(r.arg('appendSmart')).toEqual(['image']);
    expect(r.names().filter(name => name === 'appendSmart')).toHaveLength(1);
  });

  test('template clicks canonically select the inserted section', () => {
    C.state.ui.atab = 'templates';
    act(() => repaint('add'));

    act(() => r.click(r.$$('.pvcard').find(card => /Split hero/.test(card.textContent || ''))!));

    const selected = r.arg('select');
    expect(selected).toHaveLength(1);
    expect(C.locate(selected![0])?.node.type).toBe('section');
  });

  test.each([
    ['block', () => {
      const source = C.insert('heading', null, 0)!;
      const id = C.blockSave(source.id, 'Reusable heading')!;
      C.state.pages[0].tree = [];
      C.selSet([]);
      return { id, tab: 'blocks' as const, expectedUse: undefined };
    }],
    ['component', () => {
      const source = C.insert('heading', null, 0)!;
      const id = C.componentFromNode(source.id, 'Reusable heading')!;
      C.state.pages[0].tree = [];
      C.selSet([]);
      return { id, tab: 'components' as const, expectedUse: id };
    }]
  ])('%s clicks canonically select the inserted reusable item', (_kind, setup) => {
    const item = setup();
    C.state.ui.atab = item.tab;
    act(() => repaint('add'));

    act(() => r.click(r.$('.brow')));

    const selected = r.arg('select');
    expect(selected).toHaveLength(1);
    const node = C.locate(selected![0])?.node;
    expect(node).toBeTruthy();
    expect(node?.use).toBe(item.expectedUse);
  });

  test('consumed template drags and failed reusable inserts do not select', () => {
    C.state.ui.atab = 'templates';
    act(() => repaint('add'));
    const before = C.state.pages[0].tree.length;
    L.consumeDragMoved = () => true;
    act(() => r.click(r.$$('.pvcard').find(card => /Split hero/.test(card.textContent || ''))!));
    expect(C.state.pages[0].tree).toHaveLength(before);
    expect(r.arg('select')).toBeNull();

    const source = C.insert('heading', null, 0)!;
    C.blockSave(source.id, 'Cannot place here');
    C.state.pages[0].tree = [];
    C.selSet([]);
    C.state.ui.mode = 'component';
    C.state.ui.atab = 'blocks';
    L.consumeDragMoved = () => false;
    act(() => repaint('add'));
    act(() => r.click(r.$('.brow')));

    expect(r.arg('select')).toBeNull();
    expect(r.arg('toast')).toEqual(['That block does not fit there']);
  });
});
