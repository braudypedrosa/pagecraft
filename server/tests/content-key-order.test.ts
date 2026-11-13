import { expect, test } from 'vitest';
import * as Core from '../../app/src/core/index.ts';
import { contentOnly } from '../src/content.ts';
import { adopt, blankDoc } from '../src/render.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { createApp } from '../src/app.ts';

/** Database JSON objects may arrive in another key order; arrays retain authored order. */
const reorder = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(reorder) as T;
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).reverse().map(([key, child]) => [key, reorder(child)])
  ) as T;
  return value;
};
const fixture = () => {
  const doc = blankDoc('Workshop content permissions');
  doc.pages[0].tree = [Core.N('heading', { text: 'Workshop first heading' }), Core.N('heading', { text: 'Workshop second heading' }),
    Core.N('text', { html: '<p>Workshop details</p>' }), Core.N('image', { src: 'asset:workshop-photo' })];
  doc.pages[0].header = [Core.N('heading', { text: 'Workshop custom header' })];
  return doc;
};

test('content edits survive nested JSON object key reordering and schema adoption', () => {
  const before = reorder(fixture()); before.schemaVersion = 14;
  delete before.pages[0].header; // a real schema-14 row cannot declare schema-16 regions
  const after = reorder(before); after.schemaVersion = Core.SCHEMA;
  after.pages[0].tree[0].props.text = 'Workshop saved heading';
  const stored = adopt(before)!, incoming = adopt(after)!;
  expect(Object.keys(stored)).not.toEqual(Object.keys(incoming));
  expect(contentOnly(stored, incoming).ok).toBe(true);
  expect(contentOnly(incoming, stored).ok).toBe(true);
});

test('key-order independence retains strict structure, array order and unknown-field refusal', () => {
  const before = fixture();
  const mutations = [
    (doc: typeof before) => { doc.pages[0].tree.reverse(); },
    (doc: typeof before) => { doc.pages[0].tree.pop(); },
    (doc: typeof before) => { doc.pages[0].tree[0].css.d.color = 'red'; },
    (doc: typeof before) => { (doc.pages[0].tree[0].props as Record<string, unknown>).unknownSetting = 'changed'; },
    (doc: typeof before) => { doc.pages[0].header = null; }
  ];
  for (const mutate of mutations) {
    const after = reorder(before); mutate(after);
    expect(contentOnly(before, after).ok).toBe(false);
  }
});

test('reordered content still passes rich-text and owned-image safety checks', () => {
  const before = fixture();
  const owned = new Set(['workshop-photo', 'workshop-replacement']);
  const safe = reorder(before); safe.pages[0].tree[3].props.src = 'asset:workshop-replacement';
  expect(contentOnly(before, safe, owned).ok).toBe(true);
  const foreign = reorder(before); foreign.pages[0].tree[3].props.src = 'asset:foreign-photo';
  expect(contentOnly(before, foreign, owned).ok).toBe(false);
  const unsafe = reorder(before); unsafe.pages[0].tree[2].props.html = '<img src=x onerror="alert(1)">';
  expect(contentOnly(before, unsafe, owned).ok).toBe(false);
});

test('the content-role save API accepts a word edit against a reordered schema-14 row and still rejects styling', async () => {
  const document = reorder(fixture()); document.schemaVersion = 14;
  delete document.pages[0].header;
  const store = new MemoryStore(), auth = new MemoryAuthStore();
  const site = await store.create({ host: 'workshop-content.test', name: 'Workshop content permissions', doc: document });
  const user = await auth.createUser('workshop-content@example.test', 'Workshop content editor');
  await auth.grant(site.id, user.id, 'content');
  const session = newToken(); await auth.putSession(hashToken(session), user.id, Date.now() + 60000);
  const app = createApp({ store, auth, editorHost: 'editor.test', editorOrigin: 'https://editor.test' });
  const write = (doc: typeof document, version: number) => app.request(`https://editor.test/api/sites/${site.id}`, {
    method: 'PUT', headers: { host: 'editor.test', cookie: 'pc_session=' + session, 'content-type': 'application/json' },
    body: JSON.stringify({ doc, version })
  });
  const edited = adopt(reorder(document))!;
  edited.pages[0].tree[0].props.text = 'Workshop role receipt saved';
  const saved = await write(edited, site.version);
  expect(saved.status).toBe(200);
  const current = (await store.byId(site.id))!;
  expect(current.doc.pages[0].tree[0].props.text).toBe('Workshop role receipt saved');
  const styled = reorder(current.doc); styled.pages[0].tree[0].css.d.color = 'red';
  expect((await write(styled, current.version)).status).toBe(403);
  expect((await store.byId(site.id))!.version).toBe(current.version);
});
