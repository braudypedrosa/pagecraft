import { beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import * as Core from '../app/src/core/index';
import { createWebHostAdapter } from '../app/src/host/web';

beforeEach(() => Core.seed());

test('template drafts use their own document, asset, and revision routes', async () => {
  const document = structuredClone(Core.doc());
  const calls: { path: string; method: string; body?: BodyInit | null }[] = [];
  let revision = 3;
  const root = '/api/template-drafts/dental/1.0.0';
  const fetcher = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input), 'https://example.test').pathname;
    const method = init.method || 'GET';
    calls.push({ path, method, body: init.body });
    const body = path === root && method === 'GET' ? { doc: document, version: 3 }
      : path === root && method === 'PUT' ? { version: 5 }
      : path === `${root}/assets` && method === 'GET' ? [{ id: 'image one', name: 'room.jpg' }]
      : path === `${root}/assets` && method === 'POST' ? { id: 'new', name: 'new.jpg', previousRevision: 3, revision: 4 }
      : path === `${root}/history` ? [{ version: 2 }]
      : path === `${root}/history/2/restore` ? { doc: document, version: 5 }
      : null;
    if (body === null) throw new Error(`Unexpected request: ${method} ${path}`);
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  };
  const host = createWebHostAdapter({ siteId: 'template-dental', apiRoot: root, templateDraft: true, role: 'owner', fetch: fetcher, getDraftRevision: () => revision, onDraftRevision: (next, previous) => { assert.equal(revision, previous); revision = next; } });
  assert.equal((await host.documents.load()).version, 3);
  assert.equal((await host.assets.list())[0].url, `${root}/assets/image%20one`);
  assert.equal((await host.assets.upload(new Blob(['image']), 'new.jpg')).url, `${root}/assets/new`);
  assert.equal(revision, 4);
  assert.equal((await host.documents.save({ document, version: revision })).version, 5);
  assert.equal((await host.revisions.list())[0].version, 2);
  assert.equal((await host.revisions.restore(2, 4)).version, 5);
  assert.deepEqual(calls.map(({ path, method }) => `${method} ${path}`), [
    `GET ${root}`, `GET ${root}/assets`, `POST ${root}/assets`, `PUT ${root}`,
    `GET ${root}/history`, `POST ${root}/history/2/restore`
  ]);
  assert.equal((calls[2].body as FormData).get('revision'), '3');
  assert.equal(JSON.parse(String(calls[3].body)).version, 4);
  assert.equal(host.assets.tag, undefined);
  await assert.rejects(host.assets.remove('new'), /retained/);
  for (const feature of ['sites', 'account', 'billing', 'sharing', 'hostedPublishing', 'cloudPageManager', 'publishing', 'dynamicContent'] as const) assert.equal(host.features[feature], false);
  for (const feature of ['pages', 'media', 'menus', 'revisions', 'globals', 'preview'] as const) assert.equal(host.features[feature], 'pagecraft');
  for (const capability of ['edit_document', 'edit_structure', 'upload_media', 'manage_pages', 'manage_menus', 'manage_settings', 'restore_revisions'] as const) assert.equal(host.authentication.can(capability), true);
  assert.equal(host.authentication.can('publish'), false);
});

test('ordinary sites retain their default routes and publishing features', async () => {
  const calls: string[] = [];
  const host = createWebHostAdapter({ siteId: 'site one', role: 'owner', fetch: async input => {
    calls.push(String(input));
    return new Response(JSON.stringify({ doc: Core.doc(), version: 1 }), { headers: { 'content-type': 'application/json' } });
  }});
  await host.documents.load();
  assert.equal(calls[0], '/api/sites/site%20one');
  assert.equal(host.features.cloudPageManager, true);
  assert.equal(host.features.publishing, 'pagecraft');
  assert.equal(host.authentication.can('publish'), true);
});


test('an unconfirmed upload never advances the draft revision', async () => {
  let revision = 7;
  const host = createWebHostAdapter({
    siteId: 'template-dental', apiRoot: '/api/template-drafts/dental/1.0.0', templateDraft: true, role: 'owner',
    getDraftRevision: () => revision, onDraftRevision: next => { revision = next; },
    fetch: async () => new Response(JSON.stringify({ id: 'new', previousRevision: 6, revision: 8 }), { headers: { 'content-type': 'application/json' } })
  });
  await assert.rejects(host.assets.upload(new Blob(['image']), 'new.jpg'), /could not be confirmed/);
  assert.equal(revision, 7);
});
