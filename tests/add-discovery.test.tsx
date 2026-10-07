// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import { Add } from '../app/src/ui/Add';
import { repaint } from '../app/src/ui/ctx';
import { rig, type Rig } from './ui.setup';

let r: Rig;

const labels = () => r.$$('.pitem span').map(item => item.textContent);
const commonLabels = () => r.$$('.pc-add-group:not(details) .pitem span').map(item => item.textContent);
const search = () => r.$('#add-element-search') as HTMLInputElement;
const type = (value: string) => act(() => r.type(search(), value));

beforeEach(() => {
  r = rig();
  r.draw(() => <Add />, 'add');
});

afterEach(() => {
  act(() => r.draw(null));
  r.host.remove();
});

describe('Add element discovery', () => {
  test('starts with a compact Common set and keeps every other group in accessible disclosure', () => {
    expect(commonLabels()).toEqual(['Heading', 'Rich text', 'Image', 'Button', 'Columns']);
    expect(r.$$('details.pc-add-group').map(group => group.querySelector('summary')?.textContent)).toEqual([
      'Layout8', 'Content6', 'Interactive6', 'Spacing2'
    ]);
    expect(r.$$('details.pc-add-group').every(group => group.hasAttribute('open'))).toBe(false);
    expect(r.$('.pc-add-guide')?.textContent).toMatch(/Add text, images, or buttons.*layout for you.*ready-made section/i);

    act(() => r.click(r.$$('.pc-add-guide button')[0]));
    expect(r.$('.addSwitcher button[aria-selected="true"]')?.textContent?.trim()).toBe('Templates');
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
});
