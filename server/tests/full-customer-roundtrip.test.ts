import { beforeEach, test } from 'vitest';
import { strict as assert } from 'node:assert';
import * as Core from '../../app/src/core/index';
import type { Doc } from '../../app/src/core/types';
import { createApp } from '../src/app';
import { MemoryStore } from '../src/store';
import { MemoryAuthStore } from '../src/auth';
import { blankDoc, renderSite } from '../src/render';

const clone = <T,>(value: T): T => structuredClone(value);

function customerDocument(): Doc {
  const doc = blankDoc('Cloud round trip');
  Core.restore(doc);
  Core.state.ui = Core.initUi();
  Core.state.meta.components = [];
  Core.state.meta.collections = [];

  const interactive = Core.classAdd('Cloud interactive', {
    d: { color: '#123456' }, t: { color: '#234567' }, m: { color: '#345678' },
  });
  Core.findClass(interactive)!.st = {
    hover: { d: { color: '#456789' }, t: { color: '#56789a' }, m: { color: '#6789ab' } },
    focus: { d: { 'outline-width': '2px' }, t: { 'outline-width': '3px' }, m: { 'outline-width': '4px' } },
  };
  const display = Core.styleAdd('Cloud display');
  Core.findStyle(display)!.css = {
    d: { 'font-size': '44px' }, t: { 'font-size': '36px' }, m: { 'font-size': '29px' },
  };

  const authors = Core.collectionAdd('Cloud authors');
  const author = Core.itemAdd(authors.id)!;
  Core.itemSet(authors.id, author.id, Core.titleField(authors)!.id, 'Cloud author');
  const posts = Core.collectionAdd('Cloud posts');
  const body = Core.fieldAdd(posts.id, 'Body', 'rich')!;
  const published = Core.fieldAdd(posts.id, 'Published', 'date')!;
  const score = Core.fieldAdd(posts.id, 'Score', 'number')!;
  const kind = Core.fieldAdd(posts.id, 'Kind', 'option')!;
  kind.opts = 'Guide,News';
  const featured = Core.fieldAdd(posts.id, 'Featured', 'bool')!;
  const link = Core.fieldAdd(posts.id, 'Link', 'link')!;
  const ref = Core.fieldAdd(posts.id, 'Author', 'ref')!;
  ref.ref = authors.id;
  const post = Core.itemAdd(posts.id)!;
  const title = Core.titleField(posts)!;
  for (const [field, value] of [
    [title, 'Cloud saved title'], [body, '<p>Cloud saved body.</p>'],
    [published, '2026-10-14'], [score, '9.5'], [kind, 'Guide'],
    [featured, '1'], [link, '/about'], [ref, author.id],
  ] as const) Core.itemSet(posts.id, post.id, field.id, value);

  const componentId = 'cloud-card';
  const componentRoot = Core.N('box', { layout: 'grid' }, {}, [
    Core.N('heading', { text: 'Default cloud title' }),
    Core.N('text', { html: '<p>Default cloud body.</p>' }),
  ]);
  Core.bindSet(componentRoot.children[0], 'text', { src: 'prop', path: 'title' });
  Core.bindSet(componentRoot.children[1], 'html', { src: 'prop', path: 'body' });
  Core.state.meta.components!.push({
    id: componentId,
    name: 'Cloud card',
    node: componentRoot,
    props: [
      { k: 'title', label: 'Title', t: 'text', def: 'Default cloud title' },
      { k: 'body', label: 'Body', t: 'rich', def: '<p>Default cloud body.</p>' },
    ],
    variants: [{ id: 'featured', name: 'Featured', values: { title: 'Featured cloud title' } }],
  });
  const instance = Core.N('box', { layout: 'grid' });
  instance.use = componentId;
  instance.variant = 'featured';
  instance.vals = { title: 'Saved component title', body: '<p>Saved component body.</p>' };

  const cmsTitle = Core.N('heading', { text: 'CMS fallback' });
  Core.bindSet(cmsTitle, 'text', Core.bindField(title.id));
  const cmsBody = Core.N('text', { html: '<p>CMS fallback.</p>' });
  Core.bindSet(cmsBody, 'html', Core.bindField(body.id));
  const list = Core.N('list', { collectionLayout: 'grid', where: featured.id, op: 'is', val: '1' }, {}, [
    Core.N('column', {}, {}, [cmsTitle, cmsBody]),
  ]);
  Core.srcSet(list, posts.id);

  const heading = Core.N('heading', { text: 'Cloud roundtrip heading', level: 'h1', ts: display });
  heading.cls = [interactive];
  heading.css = { d: { 'margin-top': '20px' }, t: { 'margin-top': '16px' }, m: { 'margin-top': '12px' } };
  heading.st = {
    hover: { d: { transform: 'translateY(-2px)' }, t: { opacity: '.9' }, m: { opacity: '.8' } },
    focus: { d: { 'outline-color': '#111111' }, t: { 'outline-color': '#222222' }, m: { 'outline-color': '#333333' } },
  };
  const nav = Core.N('nav', {
    aria: 'Cloud navigation', mobileMenu: 'fullscreen',
    items: [{ id: 'home', label: 'Home', href: 'index.html' }, { id: 'about', label: 'About', href: 'about.html' }],
  });
  Core.ensureMobileMenuComponent(nav);
  Core.state.header = [Core.N('section', { tag: 'header' }, {}, [Core.cols(1, [[nav]])])];
  Core.state.footer = [Core.N('section', { tag: 'footer' }, {}, [Core.cols(1, [[Core.N('text', { html: '<p>Cloud footer.</p>' })]])])];
  Core.state.pages[0].title = 'Cloud contract';
  Core.state.pages[0].desc = 'Cloud save, load and render contract.';
  Core.state.pages[0].tree = [Core.N('section', {}, {}, [Core.cols(1, [[heading, instance, list]])])];
  Core.state.pages.push({
    id: 'about', name: 'About', slug: 'about', title: 'About cloud', desc: 'About cloud page',
    tree: [Core.N('section', {}, {}, [Core.cols(1, [[Core.N('heading', { text: 'About cloud' })]])])],
  });
  return clone(Core.doc());
}

async function rig() {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let loginUrl = '';
  const app = createApp({
    store, auth, editorHtml: '<title>Builder</title>', editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_email, url) => { loginUrl = url; },
  });
  const initial = customerDocument();
  const site = await store.create({ host: 'roundtrip.test', slug: 'roundtrip', name: 'Roundtrip', doc: initial });
  const user = await auth.createUser('roundtrip@example.test', 'Roundtrip owner');
  await auth.grant(site.id, user.id, 'owner');
  const request = (path: string, init: RequestInit = {}, cookie = '') => app.request(new Request(`http://admin.test${path}`, {
    ...init,
    headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers || {}) },
  }));
  await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: user.email }) });
  const token = new URL(loginUrl).searchParams.get('token')!;
  const callback = await request(`/auth/callback?token=${token}`);
  const cookie = (callback.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^pc_session=/);
  return { store, site, initial, request: (path: string, init: RequestInit = {}) => request(path, init, cookie) };
}

beforeEach(() => {
  Core.setCloudFormEndpoint('');
});

test('cloud save, load, preview and durable history preserve the full document contract', async () => {
  const { store, site, initial, request } = await rig();
  const changed = clone(initial);
  changed.pages[0].title = 'Cloud saved roundtrip';
  const instance = changed.pages[0].tree[0].children[0].children[0].children[1];
  instance.vals!.title = 'Cloud resaved component title';
  const posts = changed.meta.collections!.find(collection => collection.name === 'Cloud posts')!;
  posts.items[0].values[posts.fields[0].id] = 'Cloud resaved CMS title';

  const save = await request(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: changed, version: site.version }),
  });
  assert.equal(save.status, 200, await save.clone().text());
  const saveBody = await save.json() as { version: number; files: string[]; findings: unknown[] };
  assert.equal(saveBody.version, 2);
  assert.ok(saveBody.files.includes('index.html'));
  assert.ok(Array.isArray(saveBody.findings));

  const loaded = await request(`/api/sites/${site.id}`);
  assert.equal(loaded.status, 200);
  const loadedBody = await loaded.json() as { version: number; doc: Doc };
  assert.equal(loadedBody.version, 2);
  assert.deepEqual(loadedBody.doc, changed);
  assert.equal('v' in loadedBody.doc, false, 'current documents do not acquire the legacy version marker');

  const rendered = renderSite(loadedBody.doc);
  const home = rendered.files.get('index.html')!;
  assert.match(home, /Cloud resaved component title/);
  assert.match(home, /Cloud resaved CMS title/);
  assert.match(home, /data-mobile-menu="fullscreen"/);
  assert.match(home, /PAGECRAFT_SHARED_HEADER_START/);
  assert.match(home, /PAGECRAFT_SHARED_FOOTER_START/);
  assert.ok(rendered.files.has('about.html'));

  const preview = await request(`/api/sites/${site.id}/dashboard-preview/index.html`);
  assert.equal(preview.status, 200);
  const previewHtml = await preview.text();
  assert.match(previewHtml, /Cloud resaved component title/);
  assert.match(previewHtml, /Cloud resaved CMS title/);

  const history = await request(`/api/sites/${site.id}/history`);
  assert.equal(history.status, 200);
  assert.deepEqual((await history.json() as { version: number }[]).map(entry => entry.version), [2, 1]);
  const restored = await request(`/api/sites/${site.id}/history/1/restore`, {
    method: 'POST', body: JSON.stringify({ currentVersion: 2 }),
  });
  assert.equal(restored.status, 200, await restored.clone().text());
  assert.equal((await restored.json() as { version: number }).version, 3);
  assert.deepEqual((await store.byId(site.id))!.doc, initial);
});

test('save errors refuse stale, newer and unrenderable documents without changing stored state', async () => {
  const { store, site, initial, request } = await rig();
  const first = clone(initial);
  first.pages[0].title = 'Accepted change';
  assert.equal((await request(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: first, version: 1 }),
  })).status, 200);

  const stale = await request(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: initial, version: 1 }),
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json() as { error: string }).error, 'stale');

  const newer = clone(first) as Doc & { v?: number };
  newer.schemaVersion = Core.SCHEMA + 1;
  const future = await request(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: newer, version: 2 }),
  });
  assert.equal(future.status, 409);
  assert.equal((await future.json() as { error: string }).error, 'newer');

  const malformed = clone(first);
  malformed.pages = [{}] as Doc['pages'];
  const invalid = await request(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: malformed, version: 2 }),
  });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json() as { error: string }).error, 'invalid document');

  const stored = (await store.byId(site.id))!;
  assert.equal(stored.version, 2);
  assert.deepEqual(stored.doc, first);
});
