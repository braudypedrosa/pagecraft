// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://wordpress.example.test/wp-admin/admin.php?page=pagecraft" }
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { ItemsCtl } from '../app/src/ui/inspector/Lists';
import type { NavItem } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const control = () => C.DEF.nav.controls.content.find(item => item.t === 'items')!;
const rows = (node: ReturnType<typeof C.N>) => node.props.items as NavItem[];

test('Nav uses the native WordPress page provider without rewriting Pagecraft peers', async () => {
  r.host.remove();
  const origin = window.location.origin;
  let release!: (value: any[]) => void;
  const pending = new Promise<any[]>(resolve => { release = resolve; });
  r = rig({ nativePageSource: { currentPageId: '855', list: () => pending } });
  const node = C.N('nav', { items: [
    { id: 'primary', label: 'Current', href: 'index.html', pageId: C.page().id },
    { id: 'peer', label: 'Manual', href: 'https://example.test/kept', objectType: 'custom' }
  ] });
  C.state.pages[0].tree = [node];
  const draw = () => <ItemsCtl n={node} c={control()} />;
  act(() => r.draw(draw));

  const destination = r.$('select[aria-label^="Destination for"]') as HTMLSelectElement;
  expect([...destination.options].map(option => option.textContent)).toContain('A WordPress page');
  act(() => r.pick(destination, 'native'));
  expect(rows(node)[0]).toMatchObject({ href: 'index.html', pageId: C.page().id });
  expect(r.$('[data-field-part="wordpress-page"]')?.getAttribute('aria-busy')).toBe('true');

  release([{ id: '855', title: 'QA Mixed Menus', slug: 'qa-mixed', status: 'publish',
    url: `${origin}/qa-mixed/` }, { id: '42', title: 'About', slug: 'about', status: 'draft',
    url: `${origin}/about/` }]);
  await settle();
  act(() => r.pick(r.$('[data-field-part="wordpress-page"]')!, `${origin}/about/`));
  expect(rows(node)[0]).toMatchObject({ href: `${origin}/about/`, objectType: 'page', objectId: '42' });
  expect(rows(node)[0].pageId).toBeUndefined();
  expect(rows(node)[0].anchor).toBeUndefined();
  expect(rows(node)[1]).toMatchObject({ href: 'https://example.test/kept', objectType: 'custom' });

  C.undo();
  expect(rows(C.state.pages[0].tree[0])[0]).toMatchObject({ href: 'index.html', pageId: C.page().id });
  C.redo();
  expect(rows(C.state.pages[0].tree[0])[0]).toMatchObject({ objectType: 'page', objectId: '42' });
});

test('hydrated native identity survives missing and failed catalogues without exposing a reserved scheme', async () => {
  r.host.remove();
  let attempts = 0;
  r = rig({ nativePageSource: { currentPageId: '855', list: async () => {
    attempts++;
    if (attempts === 1) throw new Error('temporary failure');
    return [];
  } } });
  const reference = C.buildWordPressContentReference('page', '/about/');
  const node = C.N('nav', { items: [{ id: 'about', label: 'About', href: reference,
    objectType: 'page', objectId: '42', anchor: 'team' }] });
  C.state.pages[0].tree = [node];
  const draw = () => <ItemsCtl n={node} c={control()} />;
  act(() => r.draw(draw));
  await settle();

  expect((r.$('select[aria-label^="Destination for"]') as HTMLSelectElement).value).toBe('native');
  expect(r.$('.navitem-main small')?.textContent).toContain('WordPress · Page · /about/');
  expect(r.host.textContent).not.toContain('pagecraft:wordpress-content:');
  expect(r.$('[role="alert"]')?.textContent).toContain('Could not load WordPress pages');
  expect(rows(node)[0]).toMatchObject({ href: reference, objectType: 'page', objectId: '42', anchor: 'team' });

  act(() => r.click(r.$('[role="alert"] button')!));
  await settle();
  expect(attempts).toBe(2);
  expect(r.$('[role="alert"]')).toBeNull();
  expect(r.$('.native-page-picker')?.textContent).toContain('No readable WordPress pages are available');
  expect(rows(node)[0].href).toBe(reference);
});

test('a legacy neutral page reference reconstructs from the native provider without exposing its scheme', async () => {
  r.host.remove();
  const origin = window.location.origin;
  const reference = C.buildWordPressContentReference('page', '/about/');
  r = rig({ nativePageSource: { currentPageId: '855', list: async () => [
    { id: '42', title: 'About', slug: 'about', status: 'publish', url: `${origin}/about/` }
  ] } });
  const node = C.N('nav', { items: [{ id: 'about', label: 'About', href: reference }] });
  C.state.pages[0].tree = [node];
  const draw = () => <ItemsCtl n={node} c={control()} />;
  act(() => r.draw(draw));
  await settle();

  expect((r.$('select[aria-label^="Destination for"]') as HTMLSelectElement).value).toBe('native');
  expect((r.$('[data-field-part="wordpress-page"]') as HTMLSelectElement).value).toBe(`${origin}/about/`);
  expect(r.$('.navitem-main small')?.textContent).toBe('WordPress · Page · About');
  expect(r.host.textContent).not.toContain('pagecraft:wordpress-content:');
  expect(rows(node)[0]).toEqual({ id: 'about', label: 'About', href: reference });
});

test('legacy matching prefers an exact path after an earlier nested suffix', async () => {
  r.host.remove();
  const origin = window.location.origin;
  const reference = C.buildWordPressContentReference('page', '/menu/');
  r = rig({ nativePageSource: { currentPageId: '855', list: async () => [
    { id: '41', title: 'Nested menu', slug: 'nested-menu', status: 'publish', url: `${origin}/parent/menu/` },
    { id: '42', title: 'Exact menu', slug: 'menu', status: 'publish', url: `${origin}/menu/` }
  ] } });
  const node = C.N('nav', { items: [{ id: 'menu', label: 'Menu', href: reference }] });
  C.state.pages[0].tree = [node];
  act(() => r.draw(() => <ItemsCtl n={node} c={control()} />));
  await settle();

  expect((r.$('[data-field-part="wordpress-page"]') as HTMLSelectElement).value).toBe(`${origin}/menu/`);
  expect(r.$('.navitem-main small')?.textContent).toBe('WordPress · Page · Exact menu');
  expect(rows(node)[0]).toEqual({ id: 'menu', label: 'Menu', href: reference });
});

test('ambiguous suffix matches retain the saved reference without inventing native identity', async () => {
  r.host.remove();
  const origin = window.location.origin;
  const reference = C.buildWordPressContentReference('page', '/menu/');
  r = rig({ nativePageSource: { currentPageId: '855', list: async () => [
    { id: '41', title: 'Parent menu', slug: 'parent-menu', status: 'publish', url: `${origin}/parent/menu/` },
    { id: '42', title: 'Other menu', slug: 'other-menu', status: 'publish', url: `${origin}/other/menu/` }
  ] } });
  const node = C.N('nav', { items: [{ id: 'menu', label: 'Menu', href: reference }] });
  C.state.pages[0].tree = [node];
  act(() => r.draw(() => <ItemsCtl n={node} c={control()} />));
  await settle();

  const picker = r.$('[data-field-part="wordpress-page"]') as HTMLSelectElement;
  expect(picker.value).toBe('__saved');
  expect(picker.selectedOptions[0].textContent).toBe('Saved WordPress page · /menu/');
  expect(r.host.textContent).not.toContain('pagecraft:wordpress-content:');
  expect(rows(node)[0]).toEqual({ id: 'menu', label: 'Menu', href: reference });
  expect(rows(node)[0].objectType).toBeUndefined();
  expect(rows(node)[0].objectId).toBeUndefined();
});

test('indexed posts retain neutral provenance and Custom URL clears every stale identity', async () => {
  r.host.remove();
  const origin = window.location.origin;
  const postReference = C.buildWordPressContentReference('post', '/journal/news/');
  r = rig({
    nativePageSource: { currentPageId: '855', list: async () => [] },
    wordpressContent: [{ connectionId: 'local', environment: 'production', profile: 'theme',
      targetOrigin: origin, targetPath: '/', items: [
        { id: '77', objectType: 'post', title: 'News', url: `${origin}/journal/news/`, modifiedAt: '' }
      ] }]
  });
  const node = C.N('nav', { items: [{ id: 'news', label: 'News', href: 'index.html', pageId: C.page().id }] });
  C.state.pages[0].tree = [node];
  const draw = () => <ItemsCtl n={node} c={control()} />;
  act(() => r.draw(draw));
  await settle();

  act(() => r.pick(r.$('select[aria-label^="Destination for"]')!, 'wordpress'));
  expect(rows(node)[0]).toMatchObject({ href: postReference, objectType: 'post', objectId: '77' });
  expect(rows(node)[0].pageId).toBeUndefined();
  act(() => r.draw(draw));
  expect((r.$('select[aria-label^="Destination for"]') as HTMLSelectElement).value).toBe('wordpress');

  act(() => r.pick(r.$('select[aria-label^="Destination for"]')!, 'custom'));
  expect(rows(node)[0].href).toBe('');
  expect(rows(node)[0].pageId).toBeUndefined();
  expect(rows(node)[0].objectType).toBeUndefined();
  expect(rows(node)[0].objectId).toBeUndefined();
  expect(rows(node)[0].anchor).toBeUndefined();
});
