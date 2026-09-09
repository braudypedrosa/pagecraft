import { test, expect } from 'vitest';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { blankDoc } from '../src/render.ts';
import type { AccountAuth } from '../src/account-auth.ts';
import * as C from '../../app/src/core/index.ts';

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
  expect((await publish()).status).toBe(200);
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
