import { test } from 'vitest';
import a from 'node:assert/strict';
import { publishAssetReader } from '../src/publish-assets.ts';
import type { Asset, AssetRecord } from '../src/assets.ts';

const meta = (id: string, contentHash?: string): AssetRecord =>
  ({ id, siteId: 's1', name: `${id}.webp`, type: 'image/webp', w: 10, h: 10, ...(contentHash ? { contentHash } : {}) });
const body = (id: string, contentHash?: string, size = 10): Asset =>
  ({ ...meta(id, contentHash), bytes: new Uint8Array(size).fill(id.charCodeAt(0)) });

function fakeStore(current: Map<string, Asset>, delay = 5) {
  let active = 0, peak = 0;
  const reads: string[] = [];
  const get = async (_siteId: string, id: string) => {
    reads.push(id); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, delay));
    active--;
    return current.get(id) || null;
  };
  return { get, reads, peak: () => peak };
}

test('images are read a few at a time and returned in the requested order', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const store = fakeStore(new Map(ids.map(id => [id, body(id, `h-${id}`)])));
  const read = publishAssetReader(store.get, { concurrency: 4 });
  const out = await read('s1', ids.map(id => meta(id, `h-${id}`)));
  a.deepEqual(out.map(asset => asset.id), ids);
  a.equal(store.peak(), 4, 'reads overlap, but never more than the limit');
});

test('a second snapshot reuses images by content hash, and a changed image is read again', async () => {
  const current = new Map([['a', body('a', 'h1')], ['b', body('b', 'hb')]]);
  const store = fakeStore(current);
  const read = publishAssetReader(store.get);
  await read('s1', [meta('a', 'h1'), meta('b', 'hb')]);
  await read('s1', [meta('a', 'h1'), meta('b', 'hb')]);
  a.deepEqual(store.reads, ['a', 'b'], 'nothing is read twice while the hashes match');

  current.set('a', body('a', 'h2'));
  const out = await read('s1', [meta('a', 'h2'), meta('b', 'hb')]);
  a.deepEqual(store.reads, ['a', 'b', 'a'], 're-uploaded bytes under the same id are read again');
  a.equal(out[0].contentHash, 'h2');
  await read('s2', [meta('a', 'h2')]);
  a.deepEqual(store.reads.slice(-1), ['a'], 'another site never shares an entry');
});

test('images without a hash, or whose bytes do not match it, are never kept', async () => {
  const current = new Map([['a', body('a')], ['b', body('b', 'stale')]]);
  const store = fakeStore(current);
  const read = publishAssetReader(store.get);
  await read('s1', [meta('a'), meta('b', 'fresh')]);
  await read('s1', [meta('a'), meta('b', 'fresh')]);
  a.deepEqual(store.reads, ['a', 'b', 'a', 'b']);
});

test('the cache stays within its byte budget, dropping the least recently used image', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const store = fakeStore(new Map(ids.map(id => [id, body(id, `h-${id}`, 100)])), 0);
  // 800 bytes holds eight 100-byte images (each within the one-eighth per-image limit).
  const read = publishAssetReader(store.get, { concurrency: 1, cacheBytes: 800 });
  await read('s1', ids.slice(0, 8).map(id => meta(id, `h-${id}`)));
  await read('s1', [meta('a', 'h-a')]);
  a.equal(store.reads.length, 8, 'a is kept, and reading it makes it the most recent');
  await read('s1', [meta('i', 'h-i')]);
  a.equal(store.reads.length, 9, 'a ninth image pushes out the least recently used, b');
  await read('s1', [meta('a', 'h-a'), meta('i', 'h-i')]);
  a.equal(store.reads.length, 9);
  await read('s1', [meta('b', 'h-b')]);
  a.equal(store.reads.length, 10, 'b was dropped to stay within the budget');

  const large = fakeStore(new Map([['x', body('x', 'h-x', 200)]]), 0);
  const small = publishAssetReader(large.get, { cacheBytes: 800 });
  await small('s1', [meta('x', 'h-x')]);
  await small('s1', [meta('x', 'h-x')]);
  a.equal(large.reads.length, 2, 'an image over an eighth of the budget is never kept');
});
