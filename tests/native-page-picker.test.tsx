// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://wordpress.example.test/wp-admin/admin.php?page=pagecraft" }
import { test, beforeEach, afterEach } from 'vitest';
import a from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const linkControl = (n: ReturnType<typeof C.insert> extends infer T ? Exclude<T, null> : never) =>
  <Ctl n={n} c={{ t: 'link', k: 'link', label: 'Link' }} />;

const settle = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
});

test('the native WordPress page picker replaces a legacy project link only after an explicit choice', async () => {
  r.host.remove();
  const origin = window.location.origin;
  const source = {
    currentPageId: '436',
    list: async () => [
      { id: '436', title: 'QA Complete Page Lifecycle', slug: 'qa-complete-page-lifecycle-2026-10-17',
        status: 'publish' as const, url: `${origin}/qa-complete-page-lifecycle-2026-10-17/` },
      { id: '437', title: 'Draft destination', slug: 'draft-destination', status: 'draft' as const,
        url: `${origin}/draft-destination/` },
      { id: '438', title: 'Trashed destination', slug: 'trash', status: 'trash' as const,
        url: `${origin}/trash/` },
      { id: '439', title: 'Other site', slug: 'other', status: 'publish' as const,
        url: 'https://outside.example.test/other/' },
      { id: '440', title: '', slug: 'unreadable', status: 'publish' as const,
        url: `${origin}/unreadable/` }
    ]
  };
  r = rig({ nativePageSource: source });
  const n = C.insert('button', null, 0)!;
  n.props.link = 'untitled-page.html';
  C.selSet([n.id]);
  const draw = () => linkControl(n);
  act(() => r.draw(draw, 'right'));

  a.equal((r.$('[data-field-part="type"]') as HTMLSelectElement).value, 'page');
  a.match(r.$('[data-field-part="type"]')!.textContent || '', /A WordPress page/);
  a.match(r.$('.native-page-picker')!.textContent || '', /Saved project link · \/untitled-page/);
  a.equal(r.$('[data-field-part="wordpress-page"]')!.getAttribute('aria-busy'), 'true');
  a.equal(n.props.link, 'untitled-page.html', 'opening and loading leave the legacy destination intact');
  a.equal(r.names().includes('save'), false, 'viewing the picker does not dirty or save the document');

  await settle();
  const picker = r.$('[data-field-part="wordpress-page"]') as HTMLSelectElement;
  a.deepEqual([...picker.options].map(option => option.textContent), [
    'Saved project link · /untitled-page',
    'QA Complete Page Lifecycle · Current page',
    'Draft destination · Draft'
  ], 'only readable same-origin non-trashed WordPress pages are offered');

  const currentUrl = `${origin}/qa-complete-page-lifecycle-2026-10-17/`;
  act(() => r.pick(picker, currentUrl));
  a.equal(n.props.link, currentUrl, 'the explicit native choice stores the real public permalink');
  a.equal(r.names().filter(name => name === 'save').length, 1);

  C.state.ui.lmode = null;
  act(() => r.draw(draw, 'right'));
  await settle();
  a.equal((r.$('[data-field-part="type"]') as HTMLSelectElement).value, 'page',
    'the saved public permalink is recognised as a WordPress page after redraw');
  a.equal((r.$('[data-field-part="wordpress-page"]') as HTMLSelectElement).value, currentUrl);
});

test('native page loading failure preserves the saved URL and retry recovers the choices', async () => {
  r.host.remove();
  const origin = window.location.origin;
  let attempts = 0;
  const source = {
    currentPageId: '436',
    list: async () => {
      attempts++;
      if (attempts === 1) throw new Error('temporary WordPress REST failure');
      return [{ id: '436', title: 'Current WordPress page', slug: 'current', status: 'publish' as const,
        url: `${origin}/current/` }];
    }
  };
  r = rig({ nativePageSource: source });
  const n = C.insert('button', null, 0)!;
  n.props.link = 'https://manual.example.test/kept';
  C.selSet([n.id]);
  const draw = () => linkControl(n);
  act(() => r.draw(draw, 'right'));
  await settle();

  await act(async () => { r.pick(r.$('[data-field-part="type"]')!, 'page'); await Promise.resolve(); });
  a.equal(n.props.link, 'https://manual.example.test/kept', 'choosing the catalogue does not clear the saved URL');
  a.match(r.$('[role="alert"]')!.textContent || '', /Could not load WordPress pages/);
  a.match(r.$('.native-page-picker')!.textContent || '', /Saved URL · https:\/\/manual\.example\.test\/kept/);
  a.doesNotMatch(r.$('.native-page-picker')!.textContent || '', /Saved project link/,
    'the pending page mode does not reclassify a stored external URL');
  a.equal(r.names().includes('save'), false);

  act(() => r.click(r.$('[role="alert"] button')));
  await settle();
  a.equal(attempts, 2);
  a.equal(r.$('[role="alert"]'), null);
  a.match(r.$('.native-page-picker')!.textContent || '', /Current WordPress page · Current page/);
  a.equal(n.props.link, 'https://manual.example.test/kept', 'retry also leaves the saved URL untouched');
});

test('opening the native catalogue from No link does not invent a saved project link', async () => {
  r.host.remove();
  const origin = window.location.origin;
  r = rig({ nativePageSource: {
    currentPageId: '436',
    list: async () => [
      { id: '1', title: 'Home', slug: 'home', status: 'publish' as const, url: `${origin}/` },
      { id: '436', title: 'Current WordPress page', slug: 'current',
        status: 'publish' as const, url: `${origin}/current/` }
    ]
  } });
  const n = C.insert('button', null, 0)!;
  C.selSet([n.id]);
  const draw = () => linkControl(n);
  act(() => r.draw(draw, 'right'));
  await settle();

  act(() => r.pick(r.$('[data-field-part="type"]')!, 'page'));
  a.equal(n.props.link || '', '', 'opening the catalogue from No link does not write a destination');
  a.equal(r.names().includes('save'), false);
  a.doesNotMatch(r.$('.native-page-picker')!.textContent || '', /Saved project link|Saved URL/);
  a.equal((r.$('[data-field-part="wordpress-page"]') as HTMLSelectElement).value, '');

  act(() => r.pick(r.$('[data-field-part="wordpress-page"]')!, `${origin}/`));
  a.equal(n.props.link, `${origin}/`, 'the root Home page is stored only after an explicit choice');
  a.equal(r.names().filter(name => name === 'save').length, 1);
});

test('malformed successful page responses recover without changing the saved permalink', async () => {
  r.host.remove();
  const origin = window.location.origin;
  const currentUrl = `${origin}/current/`;
  let attempts = 0;
  r = rig({ nativePageSource: {
    currentPageId: '436',
    list: async (): Promise<any> => {
      attempts++;
      if (attempts === 1) return { pages: [] };
      return [null, 42, { id: '', title: 'Missing id', status: 'publish', url: `${origin}/bad/` },
        { id: '436', title: 'Current WordPress page', slug: 'current', status: 'publish', url: currentUrl }];
    }
  } });
  const n = C.insert('button', null, 0)!;
  n.props.link = currentUrl;
  C.selSet([n.id]);
  const draw = () => linkControl(n);
  act(() => r.draw(draw, 'right'));
  await settle();

  act(() => r.pick(r.$('[data-field-part="type"]')!, 'page'));
  a.match(r.$('[role="alert"]')!.textContent || '', /Could not load WordPress pages/,
    'a non-array 200 response becomes a recoverable error');
  a.equal(n.props.link, currentUrl);
  a.equal(r.names().includes('save'), false);

  act(() => r.click(r.$('[role="alert"] button')));
  await settle();
  const picker = r.$('[data-field-part="wordpress-page"]') as HTMLSelectElement;
  a.deepEqual([...picker.options].map(option => option.textContent), ['Current WordPress page · Current page'],
    'malformed rows are skipped while a valid retry row remains available');
  a.equal(picker.value, currentUrl);
  a.equal(n.props.link, currentUrl, 'successful retry recognition does not rewrite the saved permalink');
  a.equal(r.names().includes('save'), false);
});
