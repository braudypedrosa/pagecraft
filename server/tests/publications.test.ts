import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import {
  FileHostedPublicationStore, MemoryHostedPublicationStore, safePublicationPath
} from '../src/publications.ts';

const input = () => ({
  siteId: 'site-one', slug: 'site-one', host: 'site-one.test', sourceVersion: 2,
  files: [
    { path: 'index.html', mediaType: 'text/html; charset=utf-8', bytes: new TextEncoder().encode('<h1>Hello</h1>') },
    { path: 'assets/logo.png', mediaType: 'image/png', bytes: Uint8Array.of(1, 2, 3) }
  ]
});

for (const backend of ['memory', 'file'] as const) {
  test(`${backend}: address changes preserve immutable files and deletion survives restart`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'pagecraft-lifecycle-'));
    try {
      const store = backend === 'file' ? new FileHostedPublicationStore(root) : new MemoryHostedPublicationStore();
      const publication = await store.create(input());
      await store.promote(publication);
      await store.relocate(publication.siteId, 'new-address', 'new.test');
      const reader = backend === 'file' ? new FileHostedPublicationStore(root) : store;
      assert.equal(await reader.currentBySlug('site-one'), null);
      assert.equal(await reader.currentByHost('site-one.test'), null);
      const moved = await reader.currentBySlug('new-address');
      assert.equal(moved?.slug, 'new-address');
      assert.equal(moved?.host, 'new.test');
      assert.equal(moved?.id, publication.id);
      assert.equal((await reader.byId(publication.siteId, publication.id))?.slug, 'site-one', 'manifest is not rewritten');
      assert.deepEqual(await reader.file(moved!, 'assets/logo.png'), Uint8Array.of(1, 2, 3));
      await store.removeSite(publication.siteId);
      await store.removeSite(publication.siteId); // retry-safe
      assert.equal(await reader.currentBySlug('new-address'), null);
      assert.equal(await reader.currentByHost('new.test'), null);
      await assert.rejects(() => reader.promote(publication), /deleted/);
      assert.ok(await reader.byId(publication.siteId, publication.id), 'private release bytes are retained');
      const replacement = await reader.create({ ...input(), siteId: 'replacement' });
      await reader.promote(replacement);
      await store.removeSite(publication.siteId);
      assert.equal((await reader.currentBySlug('site-one'))?.siteId, 'replacement');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('publication paths reject traversal and ambiguous segments', () => {
  assert.equal(safePublicationPath('../secret'), null);
  assert.equal(safePublicationPath('assets//logo.png'), null);
  assert.equal(safePublicationPath('assets\\logo.png'), null);
  assert.equal(safePublicationPath('/assets/logo.png'), 'assets/logo.png');
});

test('memory publications remain private until atomically promoted', async () => {
  const store = new MemoryHostedPublicationStore();
  const publication = await store.create(input());
  assert.equal(await store.currentBySlug('site-one'), null);
  await store.promote(publication);
  assert.equal((await store.currentBySlug('site-one'))?.id, publication.id);
  assert.deepEqual(await store.file(publication, 'assets/logo.png'), Uint8Array.of(1, 2, 3));
  assert.equal(await store.preview(publication), null);
  await store.putPreview(publication, Uint8Array.of(8, 9, 10));
  assert.deepEqual(await store.preview(publication), Uint8Array.of(8, 9, 10));

  const moved = await store.create({ ...input(), slug: 'site-moved', host: 'site-moved.test' });
  await store.promote(moved);
  assert.equal(await store.currentBySlug('site-one'), null);
  assert.equal(await store.currentByHost('site-one.test'), null);
  assert.equal((await store.currentBySlug('site-moved'))?.id, moved.id);
});

test('file publications survive a new store process and never escape their root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-publications-'));
  try {
    const writer = new FileHostedPublicationStore(root);
    const publication = await writer.create(input());
    await writer.promote(publication);
    const reader = new FileHostedPublicationStore(root);
    const current = await reader.currentByHost('site-one.test');
    assert.equal(current?.id, publication.id);
    const bytes = await reader.file(current!, 'index.html');
    assert.ok(bytes);
    assert.equal(new TextDecoder().decode(bytes), '<h1>Hello</h1>');
    assert.equal(await reader.file(current!, '../../manifest.json'), null);
    assert.equal(await reader.preview(current!), null);
    await writer.putPreview(publication, Uint8Array.of(4, 5, 6));
    assert.deepEqual(await reader.preview(current!), Uint8Array.of(4, 5, 6));

    const moved = await writer.create({ ...input(), slug: 'site-moved', host: 'site-moved.test' });
    await writer.promote(moved);
    assert.equal(await reader.currentBySlug('site-one'), null);
    assert.equal(await reader.currentByHost('site-one.test'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
