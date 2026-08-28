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

    const moved = await writer.create({ ...input(), slug: 'site-moved', host: 'site-moved.test' });
    await writer.promote(moved);
    assert.equal(await reader.currentBySlug('site-one'), null);
    assert.equal(await reader.currentByHost('site-one.test'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
