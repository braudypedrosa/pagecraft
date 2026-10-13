// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Add } from '../app/src/ui/Add';
import { L, repaint } from '../app/src/ui/ctx';
import {
  placementIndex, placementOptions, starterNavItems
} from '../app/src/ui/section-insertion';
import { rig, type Rig } from './ui.setup';

let r: Rig;

const templates = () => {
  C.state.ui.atab = 'templates';
  act(() => repaint('add'));
};
const card = (name: RegExp) => r.$$('.pvcard').find(item => name.test(item.textContent || ''))!;
const settleClick = async (element: Element) => {
  await act(async () => {
    r.click(element);
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  r = rig();
  r.draw(() => <Add />, 'add');
});

afterEach(() => {
  act(() => r.draw(null));
  r.host.remove();
});

test('placement resolves a nested selection to its top-level section', () => {
  const first = C.patternInsert('hero-split', null, 0)!;
  C.patternInsert('features-3', null, 1);
  const nested = first.children[0].children[0].children[0];

  expect(placementOptions(C.page().tree, nested.id)).toEqual([
    ['before', 'Before selected section'],
    ['after', 'After selected section'],
    ['end', 'At end of page']
  ]);
  expect(placementIndex(C.page().tree, nested.id, 'before')).toBe(0);
  expect(placementIndex(C.page().tree, nested.id, 'after')).toBe(1);
  expect(placementIndex(C.page().tree, null, 'end')).toBe(2);
});

test('page pattern placement is chosen before one write and cancel writes nothing', async () => {
  const first = C.patternInsert('hero-split', null, 0)!;
  C.patternInsert('features-3', null, 1);
  C.state.ui.sel = first.children[0].children[0].id;
  C.hist.u.length = 0;
  templates();
  L.askPick = async (title, options) => {
    expect(title).toBe('Place section');
    expect(options.map(option => option[0])).toEqual(['before', 'after', 'end']);
    return 'after';
  };

  await settleClick(card(/Contact section/));
  expect(C.page().tree.map(node => node.props.tag || node.type)).toEqual(['section', 'section', 'section']);
  expect(r.arg('select')).toEqual([C.page().tree[1].id]);
  expect(C.hist.u).toHaveLength(1);

  const before = JSON.stringify(C.doc());
  const undo = C.hist.u.length;
  const mode = C.state.ui.mode;
  const currentPage = C.state.cur;
  L.askPick = async () => null;
  await settleClick(card(/Three features/));
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(C.hist.u).toHaveLength(undo);
  expect(C.state.ui.mode).toBe(mode);
  expect(C.state.cur).toBe(currentPage);
});

test('an async page switch cancels placement instead of writing to either page', async () => {
  const otherIndex = C.state.pages.length;
  C.state.pages.push({ ...structuredClone(C.page()), id: 'other-page', name: 'Other', slug: 'other', tree: [] });
  C.state.pages[0].tree = [C.patternInsert('hero-split', null, 0)!];
  C.state.ui.sel = C.state.pages[0].tree[0].id;
  expect(C.state.pages[otherIndex].tree).toHaveLength(0);
  C.hist.u.length = 0;
  templates();
  L.askPick = async () => {
    C.state.cur = otherIndex;
    return 'end';
  };

  await settleClick(card(/Three features/));
  expect(C.state.pages[0].tree).toHaveLength(1);
  expect(C.state.pages[otherIndex].tree).toHaveLength(0);
  expect(C.hist.u).toHaveLength(0);
  expect(r.arg('toast')).toEqual(['The page changed. Choose the section again.']);
});

test('header replacement maps real pages, configures its action, and Undo restores current header', async () => {
  C.state.ui.mode = 'header';
  const original = C.patternInsert('header-bar', null, 0)!;
  C.state.pages.push({ ...structuredClone(C.page()), id: 'about-page', name: 'About', slug: 'about', tree: [] });
  C.state.ui.mode = 'page';
  C.hist.u.length = 0;
  templates();

  const picks = ['replace', 'about.html'];
  L.askPick = async (title, options) => {
    if (title === 'Add or replace header') {
      expect(options.map(option => option[1])).toEqual([
        'Add another header — keep current header',
        'Replace current header — Undo restores it',
        'Edit existing header — no changes'
      ]);
    }
    if (title === 'Action destination') {
      expect(options).toContainEqual(['', 'No link — choose a destination later']);
      expect(options).toContainEqual(['about.html', 'About']);
    }
    return picks.shift()!;
  };
  L.askText = async (title, label) => {
    expect([title, label]).toEqual(['Set up header action', 'Action label']);
    return 'Book a call';
  };

  await settleClick(card(/Links and a button/));
  expect(C.state.header).toHaveLength(1);
  expect(C.state.header[0].id).not.toBe(original.id);
  expect(C.hist.u).toHaveLength(1);
  let nav: any = null;
  let action: any = null;
  C.eachNode(C.state.header, node => {
    if (node.type === 'nav') nav = node;
    if (node.type === 'button') action = node;
  });
  expect(nav.props.items).toEqual(C.state.pages.map(page => ({
    label: page.name, href: `${page.slug}.html`
  })));
  expect(action.props).toMatchObject({ text: 'Book a call', link: 'about.html' });

  C.undo();
  expect(C.state.header).toHaveLength(1);
  expect(C.state.header[0].id).toBe(original.id);
});

test('editing an existing region and cancelling action setup make no document write', async () => {
  C.state.ui.mode = 'header';
  const original = C.patternInsert('header-bar', null, 0)!;
  C.state.ui.mode = 'page';
  C.hist.u.length = 0;
  templates();
  L.askPick = async () => 'edit';

  await settleClick(card(/Dark bar/));
  expect(C.state.header[0].id).toBe(original.id);
  expect(C.hist.u).toHaveLength(0);
  expect(r.arg('select')).toEqual([original.id]);

  C.state.ui.mode = 'page';
  templates();
  const before = JSON.stringify(C.doc());
  L.askPick = async () => 'add';
  L.askText = async () => null;
  await settleClick(card(/Links and a button/));
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(C.hist.u).toHaveLength(0);
});

test('a global selection appends a page pattern directly and preserves global scope', async () => {
  C.state.ui.mode = 'header';
  const header = C.patternInsert('header-bar', null, 0)!;
  C.state.ui.sel = header.id;
  const beforePage = C.page().tree.length;
  templates();
  let prompted = false;
  L.askPick = async () => { prompted = true; return 'end'; };

  await settleClick(card(/Three features/));
  expect(prompted).toBe(false);
  expect(C.page().tree).toHaveLength(beforePage + 1);
  expect(C.state.header).toHaveLength(1);
  expect(C.state.ui.mode).toBe('header');
  expect(C.state.ui.sel).toBe(header.id);
  expect(C.hist.u).toHaveLength(1);
});

test('Undo during a region choice cancels stale replacement and keeps restored content', async () => {
  C.state.ui.mode = 'header';
  const restored = C.patternInsert('header-bar', null, 0)!;
  C.edit(() => {
    C.state.header.length = 0;
    C.patternInsert('header-ink', null, 0);
  });
  C.state.ui.mode = 'page';
  templates();
  L.askPick = async () => {
    C.undo();
    return 'replace';
  };

  await settleClick(card(/Centred wordmark/));
  expect(C.state.header).toHaveLength(1);
  expect(C.state.header[0].id).toBe(restored.id);
  expect(r.arg('toast')).toEqual(['The header changed. Choose the template again.']);
});

test('cancelling detached header setup leaves document, UI, and Undo unchanged', async () => {
  templates();
  const before = JSON.stringify({ document: C.doc(), ui: C.state.ui, undo: C.hist.u, redo: C.hist.r });
  L.askText = async () => null;

  await settleClick(card(/Links and a button/));
  expect(JSON.stringify({ document: C.doc(), ui: C.state.ui, undo: C.hist.u, redo: C.hist.r })).toBe(before);
});

test('valid authored navigation is reused; legacy all-home placeholders map project pages', () => {
  C.state.pages.push({ ...structuredClone(C.page()), id: 'work-page', name: 'Work', slug: 'work', tree: [] });
  const authored = C.N('nav', { items: [
    { label: 'Our gardens', href: 'work.html' },
    { label: 'Contact us', href: '/contact/' },
    { label: 'Journal', href: 'https://example.test/journal/' }
  ] });
  expect(starterNavItems([authored], C.state.pages)).toEqual([
    { label: 'Our gardens', href: 'work.html' },
    { label: 'Contact us', href: '/contact/' },
    { label: 'Journal', href: 'https://example.test/journal/' }
  ]);

  const placeholder = C.N('nav');
  expect(starterNavItems([placeholder], C.state.pages)).toEqual(C.state.pages.map(page => ({
    label: page.name, href: `${page.slug}.html`
  })));
});
