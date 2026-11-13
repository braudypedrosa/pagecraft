import { test, expect } from 'vitest';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { blankDoc, renderSite } from '../src/render.ts';
import { PGlite } from '@electric-sql/pglite';
import { PgStore, PgAuthStore, type Queryable } from '../src/store-pg.ts';
import type { AccountAuth } from '../src/account-auth.ts';
import * as C from '../../app/src/core/index.ts';

/* Publishing freezes renderer-selected Google fonts. This lifecycle test exercises CMS
   snapshots, not Google's availability, so keep its release bytes deterministic and offline.
   A live fetch made a later publish intermittently fail with publication_compile_failed in CI. */
const fontCss = `/* latin */
@font-face{font-family:'DM Sans';font-style:normal;font-weight:400;font-display:swap;
src:url(https://fonts.gstatic.com/s/dmsans/v1/cms-lifecycle.woff2) format('woff2');unicode-range:U+0000-00FF}`;
const fontFetch = (async (input: string | URL | Request) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'fonts.googleapis.com') {
    return new Response(fontCss, { headers: { 'content-type': 'text/css' } });
  }
  if (url.href === 'https://fonts.gstatic.com/s/dmsans/v1/cms-lifecycle.woff2') {
    return new Response(new TextEncoder().encode('wOF2-cms-lifecycle'), {
      headers: { 'content-type': 'font/woff2' },
    });
  }
  return new Response('missing', { status: 404 });
}) as typeof fetch;

test('CMS HTTP lifecycle protects drafts, versions, ownership and published snapshots', async () => {
  const store = new MemoryStore(),
    auth = new MemoryAuthStore(),
    publications = new MemoryHostedPublicationStore();
  const ownerIdentity = {
      authUserId: 'cms-owner',
      email: 'owner@example.test',
      name: 'Owner',
    },
    editorIdentity = {
      authUserId: 'cms-editor',
      email: 'editor@example.test',
      name: 'Editor',
    };
  let identity = ownerIdentity;
  const owner = await auth.ensureAuthUser(
      ownerIdentity.authUserId,
      ownerIdentity.email,
    ),
    editor = await auth.ensureAuthUser(
      editorIdentity.authUserId,
      editorIdentity.email,
    );
  const accountAuth: AccountAuth = {
    identity: async () => identity,
    oauth: async () => null,
    signUp: async () => 'confirmation_required',
    signIn: async () => identity,
    confirm: async () => identity,
    forgot: async () => {},
    reset: async () => false,
    updateEmail: async () => false,
    updatePassword: async () => false,
    signOut: async () => {},
  };
  const doc = blankDoc('CMS lifecycle');
  doc.meta.font = 'Arial';
  doc.meta.headFont = 'Arial';
  doc.meta.collections = [
    {
      id: 'cabins',
      name: 'Cabins',
      slug: 'cabins',
      detail: '',
      fields: [{ id: 'title', name: 'Title', type: 'text', required: 1 }],
      items: [
        {
          id: 'a',
          slug: 'cabin-a',
          values: { title: 'Published title' },
          slugLocked: 1,
        },
      ],
    },
  ];
  const list = C.N('list');
  list.src = 'cabins';
  const title = C.N('heading');
  title.bind = { text: { src: 'field', path: 'title' } };
  list.children = [title];
  doc.pages[0].tree = [list];
  doc.pages.push({
    id: 'detail',
    name: 'Detail',
    slug: 'detail',
    collection: 'cabins',
    title: '',
    desc: '',
    tree: [C.reid(structuredClone(title))],
  });
  const site = await store.create({
    name: 'CMS QA',
    slug: 'cms-qa',
    host: 'cms.test',
    doc,
    savedBy: owner.id,
  });
  await auth.grant(site.id, owner.id, 'owner');
  await auth.grant(site.id, editor.id, 'content');
  const app = createApp({
    store,
    auth,
    accountAuth,
    publications,
    editorHost: 'builder.test',
    editorOrigin: 'https://builder.test',
    editorHtml: '<title>CMS QA</title>',
    fontFetch,
  });
  const req = (path: string, body?: unknown, method = body ? 'POST' : 'GET') =>
    app.request('https://builder.test' + path, {
      method,
      headers: {
        host: 'builder.test',
        origin: 'https://builder.test',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const publish = () =>
    req(`/api/sites/${site.id}/publish`, {
      sourceVersion: version,
      acknowledgeWarnings: true,
    });
  let version = site.version;
  expect((await publish()).status).toBe(200);
  identity = editorIdentity;
  const changed = structuredClone(doc);
  changed.meta.collections![0].items[0].values.title = 'Draft edit';
  changed.meta.collections![0].items.push({
    id: 'b',
    slug: 'cabin-b',
    draft: 1,
    values: { title: 'Private cabin' },
  });
  let response = await req(
    `/api/sites/${site.id}`,
    { doc: changed, version },
    'PUT',
  );
  expect(response.status).toBe(200);
  version = (await response.json()).version;
  expect(await (await req('/cms-qa/')).text()).toContain('Published title');
  expect(await (await req('/cms-qa/')).text()).not.toContain('Private cabin');
  expect(
    (
      await req(
        `/api/sites/${site.id}`,
        { doc: changed, version: site.version },
        'PUT',
      )
    ).status,
  ).toBe(409);
  const unsafe = structuredClone(changed);
  unsafe.pages[0].name = 'Unauthorized structure';
  expect(
    (await req(`/api/sites/${site.id}`, { doc: unsafe, version }, 'PUT'))
      .status,
  ).toBe(403);
  expect((await publish()).status).toBe(403);
  identity = ownerIdentity;
  const republished = await publish();
  expect(republished.status, await republished.clone().text()).toBe(200);
  expect(await (await req('/cms-qa/')).text()).toContain('Draft edit');
  expect((await req('/cms-qa/cabins/cabin-b')).status).toBe(404);
  identity = editorIdentity;
  changed.meta.collections![0].items =
    changed.meta.collections![0].items.filter((i) => i.id !== 'a');
  response = await req(
    `/api/sites/${site.id}`,
    { doc: changed, version },
    'PUT',
  );
  expect(response.status).toBe(200);
  version = (await response.json()).version;
  expect((await req('/cms-qa/cabins/cabin-a')).status).toBe(200);
  identity = ownerIdentity;
  expect((await publish()).status).toBe(200);
  expect((await req('/cms-qa/cabins/cabin-a')).status).toBe(404);
});

test('a JSONB round-trip permits referenced Author deletion and its undo without rewriting cabins', async () => {
  const db = await PGlite.create();
  try {
    const store = new PgStore(db as unknown as Queryable);
    const auth = new PgAuthStore(db as unknown as Queryable);
    await store.init();
    await auth.init();
    const identity = { authUserId: 'workshop-owner', email: 'owner@example.test', name: 'Owner' };
    const owner = await auth.ensureAuthUser(identity.authUserId, identity.email);
    const accountAuth: AccountAuth = {
      identity: async () => identity, oauth: async () => null,
      signUp: async () => 'confirmation_required', signIn: async () => identity,
      confirm: async () => identity, forgot: async () => {}, reset: async () => false,
      updateEmail: async () => false, updatePassword: async () => false, signOut: async () => {},
    };
    const doc = blankDoc('Workshop cabins');
    doc.meta.font = doc.meta.headFont = 'Arial';
    doc.meta.collections = [
      {
        id: 'authors', name: 'Authors', slug: 'authors', detail: '',
        fields: [{ id: 'title', name: 'Title', type: 'text', required: 1 }],
        items: [
          { id: 'sam', slug: 'sam-reed', values: { title: 'Sam Reed' } },
          { id: 'jordan', slug: 'jordan-lee', values: { title: 'Jordan Lee' } },
        ],
      },
      {
        id: 'cabins', name: 'Cabins', slug: 'cabins', detail: '',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: 1 },
          { id: 'field-4', name: 'Guests', type: 'number' },
          { id: 'field-8', name: 'Author', type: 'ref', ref: 'authors' },
        ],
        items: [
          { id: 'pine', slug: 'pine-cabin', values: { title: 'Pine cabin', 'field-4': '2', 'field-8': 'sam' } },
          { id: 'lake', slug: 'lake-cabin', values: { title: 'Lake cabin', 'field-4': '4', 'field-8': 'jordan' } },
        ],
      },
    ];
    const list = C.N('list');
    list.src = 'cabins';
    const heading = C.N('heading');
    heading.bind = { text: { src: 'field', path: 'field-8.title' } };
    list.children = [heading];
    doc.pages[0].tree = [list];
    const site = await store.create({ name: doc.meta.name, host: 'workshop.test', doc, savedBy: owner.id });
    await auth.grant(site.id, owner.id, 'owner');
    const app = createApp({
      store, auth, accountAuth, editorHost: 'builder.test', editorOrigin: 'https://builder.test',
      editorHtml: '<title>Workshop</title>',
    });
    let version = site.version;
    const save = async (document: typeof doc) => {
      const response = await app.request(`https://builder.test/api/sites/${site.id}`, {
        method: 'PUT',
        headers: { host: 'builder.test', origin: 'https://builder.test', 'content-type': 'application/json' },
        body: JSON.stringify({ doc: document, version }),
      });
      if (response.status === 200) version = (await response.clone().json()).version;
      return response;
    };
    const client = structuredClone((await store.byId(site.id))!.doc);
    // Native entry fields are assigned in interaction order, not schema order.
    client.meta.collections![1].items.push({
      id: 'brook', slug: 'brook-cabin', draft: 1,
      values: { title: 'Brook cabin', 'field-8': 'sam', 'field-4': '0' }, slugLocked: 1,
    });
    expect((await save(client)).status).toBe(200);
    const stored = (await store.byId(site.id))!.doc;
    const brook = client.meta.collections![1].items[2];
    expect(stored.meta.collections![1].items[2]).toEqual(brook);
    expect(Object.keys(brook.values)).toEqual(['title', 'field-8', 'field-4']);
    expect(Object.keys(stored.meta.collections![1].items[2].values)).toEqual(['title', 'field-4', 'field-8']);
    expect(JSON.stringify(stored.meta.collections![1].items[2])).not.toBe(JSON.stringify(brook));

    const deleted = structuredClone(client);
    deleted.meta.collections![0].items.shift();
    const removed = await save(deleted);
    expect(removed.status, await removed.clone().text()).toBe(200);
    const afterDelete = (await store.byId(site.id))!.doc;
    expect(afterDelete.meta.collections).toEqual(deleted.meta.collections);
    expect(afterDelete.meta.collections![1].items).toEqual(client.meta.collections![1].items);
    const html = renderSite(afterDelete).files.get('index.html')!;
    expect(html).not.toContain('Sam Reed');
    expect(html).toContain('Jordan Lee');

    // The editor's Undo sends the pre-delete document with the acknowledged version.
    expect((await save(client)).status).toBe(200);
    const restored = (await store.byId(site.id))!.doc;
    expect(restored.meta.collections).toEqual(client.meta.collections);
    expect(renderSite(restored).files.get('index.html')).toContain('Sam Reed');
    const invalid = structuredClone(client);
    invalid.meta.collections![1].items[2].values['field-8'] = 'missing';
    expect((await save(invalid)).status).toBe(422);
    expect((await store.byId(site.id))!.version).toBe(version);
    expect((await store.byId(site.id))!.doc.meta.collections).toEqual(client.meta.collections);
  } finally {
    await db.close();
  }
});
