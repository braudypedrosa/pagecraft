// @vitest-environment jsdom
/* The Libraries tab in the Add panel (Phase 5, slice 1c).

   The adapter is an in-memory fake that publishes with the real extraction, so these cases are
   about the panel: what it offers, what it sends, and that an import or an update lands as one
   Undo step with the links the next update needs. The planning itself is covered in
   libraries.test.ts and the routes in server/tests/libraries.test.ts. */
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { extractLibraryBundle, type LibraryBundle, type LibraryItemRef } from '../app/src/core/libraries';
import type { ComponentDef, Doc, Node } from '../app/src/core/types';
import type { WebLibrary, WebLibraryAdapter, WebLibraryMember, WebLibraryVersionSummary } from '../app/src/host/types';
import { HostRequestError } from '../app/src/host/transport';
import { Add } from '../app/src/ui/Add';
import { rig, type Rig } from './ui.setup';

const SITE = 'site-recipient';
const AUTHOR = 'site-author';
const node = (id: string, type: string, extra: Partial<Node> = {}): Node => ({
  id, type, props: {}, css: {}, hide: {}, cls: [], adv: {}, children: [], ...extra,
} as unknown as Node);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const card = (title: string): ComponentDef => ({
  id: 'card', name: 'Card', props: [],
  node: node('c1', 'box', {
    css: { d: { background: 'url(asset:aauthorimage1)', color: 'var(--c-accent)' } } as never,
    children: [node('c2', 'heading', { props: { text: title } as never })],
  }),
});
/** A site other than the one open, holding `components`, to publish from. */
function authorDoc(components: ComponentDef[]): Doc {
  const doc = clone(C.doc());
  doc.meta.tokens!.colors.push({ id: 'accent', name: 'Accent', value: '#c05621' });
  doc.meta.components = components;
  return doc;
}

function fakeLibraries() {
  const libraries: WebLibrary[] = [];
  const members = new Map<string, WebLibraryMember[]>();
  const left: string[] = [];
  const versions = new Map<string, { version: WebLibraryVersionSummary; bundle: LibraryBundle }[]>();
  const sent = { publish: [] as { id: string; sourceVersion: number; items: LibraryItemRef[] }[], copied: [] as string[][], versionReads: 0 };
  let failNextPublish: Error | null = null;
  const add = (id: string, bundle: LibraryBundle, sourceSiteId: string) => {
    const rows = versions.get(id) || [];
    const version = { version: rows.length + 1, itemCount: bundle.chosen.length, sourceSiteId, createdAt: '2026-10-01T00:00:00Z' };
    versions.set(id, [...rows, { version, bundle: clone(bundle) }]);
    libraries.find(l => l.id === id)!.latestVersion = version.version;
    return version;
  };
  const adapter: WebLibraryAdapter = {
    async list() { return clone(libraries); },
    async create(name) {
      const library = { id: `lib-${libraries.length + 1}`, name, latestVersion: 0, createdAt: '', updatedAt: '' };
      libraries.push(library);
      return clone(library);
    },
    async get(id) {
      return { library: clone(libraries.find(l => l.id === id)!), versions: (versions.get(id) || []).map(v => v.version).reverse() };
    },
    async version(id, version) { sent.versionReads++; return clone(versions.get(id)!.find(v => v.version.version === version)!); },
    async publish(id, input) {
      sent.publish.push({ id, ...clone(input) });
      if (failNextPublish) { const error = failNextPublish; failNextPublish = null; throw error; }
      return add(id, extractLibraryBundle(C.doc(), input.items, C.SCHEMA), SITE);
    },
    async copyAssets(input) {
      sent.copied.push(input.assets);
      return Object.fromEntries(input.assets.map(id => [id, 'asite' + id.slice(1)]));
    },
    async members(id) { return clone(members.get(id) || []); },
    async share(id, email) {
      const rows = members.get(id) || [];
      const address = email.trim().toLowerCase();
      if (rows.some(m => m.email === address)) return { added: false, members: clone(rows) };
      const row = { userId: `u-${rows.length + 1}`, email: address, name: '', pending: address.startsWith('new'), createdAt: '' };
      members.set(id, [...rows, row]);
      return { added: true, members: clone(members.get(id)!) };
    },
    async unshare(id, userId) {
      members.set(id, (members.get(id) || []).filter(m => m.userId !== userId));
      return clone(members.get(id)!);
    },
    async leave(id) {
      left.push(id);
      libraries.splice(libraries.findIndex(l => l.id === id), 1);
    },
  };
  /** A library someone else owns, shared with this account. */
  const sharedWithMe = (name: string, ownerName: string) => {
    const library: WebLibrary = { id: `lib-${libraries.length + 1}`, name, latestVersion: 0, createdAt: '', updatedAt: '', access: 'viewer', ownerName };
    libraries.push(library);
    return library;
  };
  /** Publish from another site straight into the store, the way a second editor would. */
  const publishFrom = (id: string, doc: Doc, items: LibraryItemRef[]) => add(id, extractLibraryBundle(doc, items, C.SCHEMA), AUTHOR);
  return { adapter, sent, publishFrom, sharedWithMe, left, failPublishOnce: (error: Error) => { failNextPublish = error; } };
}

let r: Rig;
let fake: ReturnType<typeof fakeLibraries>;
let draftVersion: number;
beforeEach(() => {
  fake = fakeLibraries();
  draftVersion = 7;
  r = rig({ libraries: fake.adapter, siteDraft: () => ({ siteId: SITE, version: draftVersion }) });
  C.state.meta.components = [];
  C.state.meta.blocks = [];
  C.state.meta.libraryLinks = [];
  C.hist.u.length = 0;
});
afterEach(() => {
  render(null, r.host);
  r.host.remove();
});

/* A few rounds, because a load that resolves after one act() schedules the next render and
   effect outside it. */
const settle = async () => {
  for (let round = 0; round < 4; round++) {
    await act(async () => { for (let i = 0; i < 4; i++) await new Promise(res => setTimeout(res, 0)); });
  }
};
const click = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => { r.click(el!); });
  await settle();
};
const button = (text: string | RegExp) => r.$$('button').find(b => typeof text === 'string'
  ? b.textContent?.trim() === text : text.test(b.textContent || ''));
const tick = async (name: string) => {
  const row = r.$$('label.lib-item').find(l => l.querySelector('b')?.textContent === name);
  expect(row, `a row named ${name}`).toBeTruthy();
  const box = row!.querySelector('input') as HTMLInputElement;
  await act(async () => {
    box.checked = !box.checked;
    box.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
};
const toasts = () => r.calls.filter(c => c[0] === 'toast').map(c => String(c[1]));
/* Inside act(), so the panel's loading effects run now rather than after a frame. */
const draw = async (tab: string) => {
  C.state.ui.atab = tab;
  await act(async () => { r.draw(() => <Add />, 'add'); });
  await settle();
};
const openTab = () => draw('libraries');
async function openLibrary(name: string) {
  await openTab();
  await click(r.$$('button.lib-row').find(b => b.querySelector('b')?.textContent === name));
}

test('the tab exists only where libraries do', async () => {
  const plain = rig();
  C.state.ui.atab = 'libraries';
  plain.draw(() => <Add />, 'add');
  const labels = plain.$$('.addSwitcher button').map(b => b.textContent?.trim());
  expect(labels).toEqual(['Elements', 'Templates', 'Components', 'Blocks']);
  expect(plain.$('.addSwitcher button[aria-selected="true"]')?.textContent?.trim()).toBe('Elements');
  render(null, plain.host);
  plain.host.remove();

  r = rig({ libraries: fake.adapter, siteDraft: () => ({ siteId: SITE, version: draftVersion }) });
  await openTab();
  expect(r.$$('.addSwitcher button').map(b => b.textContent?.trim())).toContain('Libraries');
  expect(r.$('.hint')?.textContent).toMatch(/No libraries yet/);
});

test('importing copies the images first and lands as one undo step with links', async () => {
  const lib = await fake.adapter.create('Brand kit');
  fake.publishFrom(lib.id, authorDoc([card('From the library')]), [{ kind: 'component', id: 'card' }]);
  await openLibrary('Brand kit');
  expect(r.$('.lib-head b')?.textContent).toBe('Brand kit');
  await tick('Card');
  await click(button('Import 1 item'));

  expect(fake.sent.copied).toEqual([['aauthorimage1']]);
  expect(r.calls.some(c => c[0] === 'assetsReload')).toBe(true);
  const imported = C.findComponent('card')!;
  expect(JSON.stringify(imported.node)).toContain('asset:asiteauthorimage1');
  expect(C.colors().some(c => c.id === 'accent')).toBe(true);
  expect(C.state.meta.libraryLinks!.map(l => `${l.kind}:${l.localId}@${l.version}`).sort())
    .toEqual(['color:accent@1', 'component:card@1']);
  expect(C.hist.u.length).toBe(1);
  expect(toasts().at(-1)).toMatch(/Imported 2 items from Brand kit/);
  // The row now says it is here, and is no longer offered.
  const row = r.$$('label.lib-item').find(l => l.querySelector('b')?.textContent === 'Card')!;
  expect(row.querySelector('small')?.textContent).toBe('In this site · v1');
  expect((row.querySelector('input') as HTMLInputElement).disabled).toBe(true);

  C.undo();
  expect(C.findComponent('card')).toBeFalsy();
  expect(C.state.meta.libraryLinks || []).toEqual([]);
});

test('an import that meets a different item of the same id renames it', async () => {
  C.state.meta.components = [{ ...card('Mine'), node: node('m1', 'text') }];
  const lib = await fake.adapter.create('Brand kit');
  fake.publishFrom(lib.id, authorDoc([card('Theirs')]), [{ kind: 'component', id: 'card' }]);
  await openLibrary('Brand kit');
  await tick('Card');
  await click(button('Import 1 item'));
  expect(C.components().map(c => c.id)).toEqual(['card', 'card-2']);
  expect(toasts().at(-1)).toMatch(/1 was renamed to avoid a clash/);
});

test('“Add to library…” on a component picks a library, then publishes the saved draft', async () => {
  C.state.meta.components = [card('Hello')];
  C.state.meta.tokens!.colors.push({ id: 'accent', name: 'Accent', value: '#c05621' });
  await fake.adapter.create('Brand kit');
  await draw('components');
  await click(r.$('.brow [title="Add to library…"]'));
  expect(C.state.ui.atab).toBe('libraries');
  expect(r.$('.lib-banner')?.textContent).toMatch(/Choose a library for Card/);
  await click(r.$$('button.lib-row')[0]);

  const box = r.$$('label.lib-item').find(l => l.querySelector('b')?.textContent === 'Card')!.querySelector('input') as HTMLInputElement;
  expect(box.checked).toBe(true);
  expect(r.$('.lib-note:last-of-type')?.textContent).toMatch(/plus 1 thing they use/);
  await click(button('Publish version 1'));

  const flushedAt = r.names().indexOf('flushDraft');
  expect(flushedAt).toBeGreaterThanOrEqual(0);
  expect(fake.sent.publish).toEqual([{ id: 'lib-1', sourceVersion: 7, items: [{ kind: 'component', id: 'card' }] }]);
  expect(toasts().at(-1)).toBe('Published version 1 of Brand kit');
  // Back on the library, which now shows what this site published.
  expect(r.$('.lib-head small')?.textContent).toBe('Version 1 · 1 item');
  expect(r.$$('label.lib-item small').map(s => s.textContent)).toEqual(['Published from this site']);
  expect(button(/^Import|Choose items to import/)).toBeUndefined();
  expect(r.$$('.lib-note').map(n => n.textContent)).toContain('Everything in this version is already in this site.');
});

test('publishing retries once when an autosave moved the draft on', async () => {
  C.state.meta.components = [card('Hello')];
  C.state.meta.tokens!.colors.push({ id: 'accent', name: 'Accent', value: '#c05621' });
  await fake.adapter.create('Brand kit');
  fake.failPublishOnce(new HostRequestError('stale_source_version', 409, { error: 'stale_source_version' }));
  await openLibrary('Brand kit');
  await click(button('Publish a new version…'));
  await tick('Card');
  draftVersion = 8;
  await click(button('Publish version 1'));
  expect(r.names().filter(n => n === 'flushDraft').length).toBe(2);
  expect(fake.sent.publish.map(p => p.sourceVersion)).toEqual([8, 8]);
  expect(toasts().at(-1)).toBe('Published version 1 of Brand kit');
});

test('an item bound to the CMS is explained before anything is sent', async () => {
  C.state.meta.components = [{ ...card('Hello'), node: node('c1', 'list', { src: 'workshops' }) }];
  await fake.adapter.create('Brand kit');
  await openLibrary('Brand kit');
  await click(button('Publish a new version…'));
  await tick('Card');
  expect(r.$('.lib-problem')?.textContent).toMatch(/CMS collection workshops/);
  expect((button('Publish version 1') as HTMLButtonElement).disabled).toBe(true);
  expect(fake.sent.publish).toEqual([]);
});

test('an update asks about each conflict, then applies as one undo step', async () => {
  const lib = await fake.adapter.create('Brand kit');
  fake.publishFrom(lib.id, authorDoc([card('Version one')]), [{ kind: 'component', id: 'card' }]);
  await openLibrary('Brand kit');
  await tick('Card');
  await click(button('Import 1 item'));
  // This site changes its copy; the library changes its own.
  C.findComponent('card')!.node.children[0].props.text = 'Changed here';
  fake.publishFrom(lib.id, authorDoc([card('Version two')]), [{ kind: 'component', id: 'card' }]);

  await click(r.$('.lib-back'));
  expect(r.$$('button.lib-row small')[0].textContent).toMatch(/Version 2 · Update available/);
  await click(r.$$('button.lib-row')[0]);
  expect(r.$('.lib-banner')?.textContent).toMatch(/Version 2 is available\. This site has version 1/);
  await click(button('Review update'));

  expect(r.$('.lib-change small')?.textContent).toBe('Component · Changed here and in the library');
  const apply = () => r.$$('button').find(b => /Choose for|Apply update/.test(b.textContent || '')) as HTMLButtonElement;
  expect(apply().textContent).toBe('Choose for 1 conflict');
  expect(apply().disabled).toBe(true);
  const theirs = r.$$('.lib-res label').find(l => /library’s/.test(l.textContent || ''))!.querySelector('input')!;
  await act(async () => { theirs.checked = true; theirs.dispatchEvent(new window.Event('change', { bubbles: true })); });
  expect(apply().textContent).toBe('Apply update');
  C.hist.u.length = 0;
  await click(apply());

  expect((C.findComponent('card')!.node.children[0].props as { text: string }).text).toBe('Version two');
  expect(C.state.meta.libraryLinks!.find(l => l.kind === 'component')!.version).toBe(2);
  expect(C.hist.u.length).toBe(1);
  expect(toasts().at(-1)).toBe('Updated to version 2 of Brand kit');
  expect(r.$('.lib-banner')).toBeNull();
  C.undo();
  expect((C.findComponent('card')!.node.children[0].props as { text: string }).text).toBe('Changed here');
});

test('components imported from a library say where they came from', async () => {
  const lib = await fake.adapter.create('Brand kit');
  fake.publishFrom(lib.id, authorDoc([card('From the library')]), [{ kind: 'component', id: 'card' }]);
  await openLibrary('Brand kit');
  await tick('Card');
  await click(button('Import 1 item'));
  await draw('components');
  expect(r.$('.brow .lib-from')?.textContent).toBe('From Brand kit · v1');
});

test('a published version is read once, however often its views open', async () => {
  C.state.meta.components = [card('Hello')];
  C.state.meta.tokens!.colors.push({ id: 'accent', name: 'Accent', value: '#c05621' });
  const lib = await fake.adapter.create('Brand kit');
  fake.publishFrom(lib.id, authorDoc([card('From the library')]), [{ kind: 'component', id: 'card' }]);
  await openLibrary('Brand kit');
  expect(fake.sent.versionReads).toBe(1);
  await click(button('Publish a new version…'));
  await click(r.$('.lib-back'));
  expect(r.$('.lib-head small')?.textContent).toBe('Version 1 · 1 item');
  expect(fake.sent.versionReads).toBe(1);
});

test('the owner shares by email and can stop sharing', async () => {
  await fake.adapter.create('Brand kit');
  await openLibrary('Brand kit');
  await click(button('Share…'));
  expect(r.$('.lib-head small')?.textContent).toBe('Share');
  expect(r.$$('.lib-note').map(n => n.textContent)).toContain('Not shared with anyone yet.');

  const field = r.$('.lib-share input') as HTMLInputElement;
  await act(async () => { r.type(field, 'newcomer@example.test'); });
  await act(async () => { r.$('.lib-share')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
  expect(toasts().at(-1)).toBe('Shared with newcomer@example.test');
  expect(r.$$('.lib-member').map(m => m.textContent)).toEqual(['newcomer@example.testNo Pagecraft account yet']);
  expect((r.$('.lib-share input') as HTMLInputElement).value).toBe('');

  await click(r.$('.lib-member .bx'));
  expect(r.arg('askConfirm')![0]).toBe('Stop sharing?');
  expect(r.$$('.lib-member')).toEqual([]);
  expect(toasts().at(-1)).toBe('Stopped sharing with newcomer@example.test');
});

test('a library shared with you imports and updates, but never publishes or shares', async () => {
  const shared = fake.sharedWithMe('Agency kit', 'Riley');
  fake.publishFrom(shared.id, authorDoc([card('From the agency')]), [{ kind: 'component', id: 'card' }]);
  await openTab();
  expect(r.$$('button.lib-row small')[0].textContent).toBe('Version 1 · Shared by Riley');
  await click(r.$$('button.lib-row')[0]);
  expect(button('Publish a new version…')).toBeUndefined();
  expect(button('Share…')).toBeUndefined();
  expect(r.$$('.lib-note').some(n => /Shared with you by Riley/.test(n.textContent || ''))).toBe(true);

  await tick('Card');
  await click(button('Import 1 item'));
  expect(C.findComponent('card')).toBeTruthy();
  expect(toasts().at(-1)).toMatch(/Imported 2 items from Agency kit/);

  await click(button('Leave this library'));
  expect(r.arg('askConfirm')![0]).toBe('Leave this library?');
  expect(fake.left).toEqual([shared.id]);
  expect(toasts().at(-1)).toBe('You left Agency kit');
  expect(r.$$('button.lib-row')).toEqual([]);
  // The copy stays this site's own.
  expect(C.findComponent('card')).toBeTruthy();
});

test('“Add to library…” offers only libraries you own', async () => {
  C.state.meta.components = [card('Hello')];
  await fake.adapter.create('Mine');
  fake.sharedWithMe('Theirs', 'Riley');
  await draw('components');
  await click(r.$('.brow [title="Add to library…"]'));
  expect(r.$$('button.lib-row b').map(b => b.textContent)).toEqual(['Mine']);
});
