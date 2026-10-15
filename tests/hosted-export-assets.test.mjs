import { beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as C from '../app/src/core/index';

const source = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`builder export helper is missing: ${startMarker}`);
  return source.slice(start, end);
}

function exportActionHarness(doc) {
  const helperSource = sourceBetween('const EXPORT_DRAFT_CHANGED', '/* Fetch the faces once per export run');
  return new Function('doc', `${helperSource}; return {captureExportAction, prepareExportPages};`)(doc);
}

class DataFileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(bytes => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(bytes).toString('base64')}`;
      this.onload?.();
    }, error => {
      this.error = error;
      this.onerror?.();
    });
  }
}

function assetHarness({ hosted = true, download = vi.fn(), createImageBitmap = vi.fn(), document = { createElement: vi.fn() } } = {}) {
  const AS = { mem: new Map() };
  const factory = new Function(
    'A_RE', 'AS', 'SRV', 'HOST', 'PH', 'FileReader', 'assetFile', 'createImageBitmap', 'document',
    `${sourceBetween('const blobToData =', '/* ---- zip')}
     return {assetsToData, materializeAsset, materializeAssetsFor, exportAssetFiles};`
  );
  const helpers = factory(
    /asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@(\d+))?/g,
    AS,
    hosted ? { siteId: 'hosted-export' } : null,
    { assets: { download } },
    'data:image/svg+xml,placeholder',
    DataFileReader,
    asset => `assets/${asset.id}.${asset.type === 'image/svg+xml' ? 'svg' : 'bin'}`,
    createImageBitmap,
    document,
  );
  return { AS, download, ...helpers };
}

beforeEach(() => vi.restoreAllMocks());

test('an export action keeps its initial mode and target while asynchronous page preparation runs', async () => {
  let draft = { title: 'Initial' };
  const { captureExportAction, prepareExportPages } = exportActionHarness(() => draft);
  const mode = { value: 'files' };
  const original = { path: 'home.html', pg: { id: 'home' } };
  const action = captureExportAction(mode.value, [original]);
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const render = vi.fn(async (target, exportMode) => {
    await waiting;
    return `${exportMode}:${target.path}`;
  });

  const prepared = prepareExportPages(action, render);
  mode.value = 'inline';
  original.path = 'changed.html';
  release();

  await expect(prepared).resolves.toEqual([{
    target: expect.objectContaining({ path: 'home.html' }),
    data: 'files:home.html',
  }]);
  expect(render).toHaveBeenCalledWith(expect.objectContaining({ path: 'home.html' }), 'files');
});

test('an export action rejects a draft changed during preparation before any download starts', async () => {
  let draft = { title: 'Initial' };
  const { captureExportAction, prepareExportPages } = exportActionHarness(() => draft);
  const action = captureExportAction('inline', [{ path: 'home.html', pg: { id: 'home' } }]);
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const download = vi.fn();
  const run = async () => {
    const pages = await prepareExportPages(action, async () => {
      await waiting;
      return '<html>initial</html>';
    });
    for (const page of pages) await download(page.target.path, page.data);
  };

  const exporting = run();
  draft = { title: 'Edited while exporting' };
  release();

  await expect(exporting).rejects.toThrow(/site changed.*Close Export.*No files were downloaded/i);
  expect(download).not.toHaveBeenCalled();
});

test('content export and same-site import use the exact builder asset path in both directions', () => {
  const helperSource = sourceBetween('const assetPath =', '/* A variant is named');
  const AS = { mem: new Map([
    ['a53e0e21cc7a4', {
      id: 'a53e0e21cc7a4', name: 'Library table.webp', type: 'image/webp',
    }],
  ]) };
  const assetFile = asset => `assets/table-${asset.id}.webp`;
  const helpers = new Function('AS', 'assetFile', `${helperSource}; return {assetPath, contentImageResolver};`)(AS, assetFile);

  C.blankProject('CMS image export import');
  C.state.meta.collections = [];
  const collection = C.collectionAdd('Products');
  const photo = C.fieldAdd(collection.id, 'Photo', 'image');
  const item = C.itemAdd(collection.id);
  C.itemSet(collection.id, item.id, photo.id, 'asset:a53e0e21cc7a4');
  const exported = JSON.parse(C.contentJson(helpers.assetPath));

  expect(exported.collections[0].items[0].values[photo.id])
    .toBe('assets/table-a53e0e21cc7a4.webp');
  C.itemSet(collection.id, item.id, photo.id, '');
  C.contentImport(exported, { resolveImage: helpers.contentImageResolver() });
  expect(item.values[photo.id]).toBe('asset:a53e0e21cc7a4');

  const resolve = helpers.contentImageResolver();
  expect(resolve('assets/table-a53e0e21cc7a4.webp')).toBe('asset:a53e0e21cc7a4');
  expect(resolve('assets/other-a53e0e21cc7a4.webp')).toBe('assets/other-a53e0e21cc7a4.webp');
  expect(resolve('https://example.test/table.webp')).toBe('https://example.test/table.webp');
  expect(resolve('asset:a53e0e21cc7a4')).toBe('asset:a53e0e21cc7a4');
  expect(source).toContain('contentImport(JSON.parse(rd.result), {resolveImage})');
});

test('hosted inline export downloads only referenced bytes and embeds them', async () => {
  const download = vi.fn(async id => new Blob([`bytes:${id}`], { type: 'image/svg+xml' }));
  const h = assetHarness({ download });
  h.AS.mem.set('used', { id: 'used', name: 'used.svg', type: 'image/svg+xml', url: '/assets/used' });
  h.AS.mem.set('constructor', { id: 'constructor', name: 'reserved.svg', type: 'image/svg+xml', url: '/assets/reserved' });
  h.AS.mem.set('orphan', { id: 'orphan', name: 'orphan.svg', type: 'image/svg+xml', url: '/assets/orphan' });

  const html = await h.assetsToData('<img src="asset:used"><img src="asset:constructor"><div style="background:url(asset:used)"></div>');

  expect(download.mock.calls.map(([id]) => id).sort()).toEqual(['constructor', 'used']);
  expect(html).toContain('data:image/svg+xml;base64,Ynl0ZXM6dXNlZA==');
  expect(html).toContain('data:image/svg+xml;base64,Ynl0ZXM6Y29uc3RydWN0b3I=');
  expect(html).not.toContain('placeholder');
  expect(h.AS.mem.get('used').blob).toBeInstanceOf(Blob);
  expect(h.AS.mem.get('orphan').blob).toBeUndefined();
});

test('hosted file export returns every referenced original once and leaves unused library assets untouched', async () => {
  const download = vi.fn(async id => new Blob([id], { type: 'image/svg+xml' }));
  const h = assetHarness({ download });
  h.AS.mem.set('logo', { id: 'logo', name: 'logo.svg', type: 'image/svg+xml' });
  h.AS.mem.set('photo', { id: 'photo', name: 'photo.svg', type: 'image/svg+xml' });
  h.AS.mem.set('unused', { id: 'unused', name: 'unused.svg', type: 'image/svg+xml' });

  const files = await h.exportAssetFiles('asset:logo asset:photo asset:logo');

  expect(download.mock.calls.map(([id]) => id).sort()).toEqual(['logo', 'photo']);
  expect(files.map(file => file.path).sort()).toEqual(['assets/logo.svg', 'assets/photo.svg']);
  expect(files.every(file => file.data instanceof Blob)).toBe(true);
  expect(h.AS.mem.get('unused').blob).toBeUndefined();
});

test('hosted responsive export converts WebP bytes to the promised JPEG without upscaling', async () => {
  const download = vi.fn(async () => new Blob(['original-webp'], { type: 'image/webp' }));
  const bitmap = { width: 640, height: 480, close: vi.fn() };
  const context = { drawImage: vi.fn(), imageSmoothingQuality: '' };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback, type) => callback(new Blob(['jpeg-640x480'], { type }))),
  };
  const h = assetHarness({
    download,
    createImageBitmap: vi.fn(async () => bitmap),
    document: { createElement: vi.fn(() => canvas) },
  });
  h.AS.mem.set('photo', { id: 'photo', name: 'photo.webp', type: 'image/webp' });

  const files = await h.exportAssetFiles('<img src="asset:photo@1024">');

  expect(download).toHaveBeenCalledOnce();
  expect(files.map(file => file.path)).toEqual(['assets/photo.bin', 'assets/photo-1024.jpg']);
  expect(files[1].type).toBe('image/jpeg');
  expect(files[1].data.type).toBe('image/jpeg');
  await expect(files[1].data.text()).resolves.toBe('jpeg-640x480');
  expect(canvas).toMatchObject({ width: 640, height: 480 });
  expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 480);
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82);
  expect(bitmap.close).toHaveBeenCalledOnce();
});

test('a responsive export retries host bytes after its first download failure', async () => {
  const download = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(new Blob(['original'], { type: 'image/png' }));
  const bitmap = { width: 100, height: 75, close: vi.fn() };
  const canvas = {
    getContext: vi.fn(() => ({ drawImage: vi.fn(), imageSmoothingQuality: '' })),
    toBlob: vi.fn((callback, type) => callback(new Blob(['variant'], { type }))),
  };
  const h = assetHarness({
    download,
    createImageBitmap: vi.fn(async () => bitmap),
    document: { createElement: vi.fn(() => canvas) },
  });
  h.AS.mem.set('photo', { id: 'photo', name: 'photo.png', type: 'image/png' });

  await expect(h.exportAssetFiles('asset:photo@320')).rejects.toThrow(/Check your connection and try again/);
  await expect(h.exportAssetFiles('asset:photo@320')).resolves.toHaveLength(2);

  expect(download).toHaveBeenCalledTimes(2);
  expect(bitmap.close).toHaveBeenCalledOnce();
});

test('responsive encoding failure rejects the export and clears the cache for retry', async () => {
  const download = vi.fn(async () => new Blob(['original'], { type: 'image/webp' }));
  const bitmap = { width: 640, height: 480, close: vi.fn() };
  let canEncode = false;
  const canvas = {
    getContext: vi.fn(() => ({ drawImage: vi.fn(), imageSmoothingQuality: '' })),
    toBlob: vi.fn((callback, type) => callback(canEncode ? new Blob(['jpeg'], { type }) : null)),
  };
  const h = assetHarness({
    download,
    createImageBitmap: vi.fn(async () => bitmap),
    document: { createElement: vi.fn(() => canvas) },
  });
  h.AS.mem.set('photo', { id: 'photo', name: 'photo.webp', type: 'image/webp' });

  await expect(h.exportAssetFiles('asset:photo@320')).rejects.toThrow(/could not be encoded.*Try again or replace it/);
  canEncode = true;
  const files = await h.exportAssetFiles('asset:photo@320');

  expect(download).toHaveBeenCalledOnce();
  expect(canvas.toBlob).toHaveBeenCalledTimes(2);
  expect(files[1]).toMatchObject({ path: 'assets/photo-320.jpg', type: 'image/jpeg' });
  expect(files[1].data.type).toBe('image/jpeg');
});

test('responsive decode failure rejects instead of omitting a promised srcset file', async () => {
  const download = vi.fn(async () => new Blob(['corrupt'], { type: 'image/webp' }));
  const h = assetHarness({
    download,
    createImageBitmap: vi.fn(async () => { throw new Error('decode failed'); }),
  });
  h.AS.mem.set('corrupt', { id: 'corrupt', name: 'corrupt.webp', type: 'image/webp' });

  await expect(h.exportAssetFiles('asset:corrupt@320')).rejects.toThrow(
    /corrupt\.webp.*could not be decoded.*Replace it or try again/,
  );
  expect(download).toHaveBeenCalledOnce();
});

test('hosted byte failure stops export with retry guidance and a later retry can succeed', async () => {
  const download = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(new Blob(['retry-ok'], { type: 'image/svg+xml' }));
  const h = assetHarness({ download });
  h.AS.mem.set('hero', { id: 'hero', name: 'hero.svg', type: 'image/svg+xml' });

  await expect(h.assetsToData('<img src="asset:hero">')).rejects.toThrow(/hero\.svg.*Check your connection and try again/);
  const html = await h.assetsToData('<img src="asset:hero">');

  expect(download).toHaveBeenCalledTimes(2);
  expect(html).toContain('data:image/svg+xml;base64,cmV0cnktb2s=');
});

test('standalone export preserves placeholder fallback when a local record has no blob', async () => {
  const download = vi.fn();
  const h = assetHarness({ hosted: false, download });
  h.AS.mem.set('local-missing', { id: 'local-missing', name: 'local.svg', type: 'image/svg+xml' });

  await expect(h.assetsToData('<img src="asset:local-missing">')).resolves.toContain('data:image/svg+xml,placeholder');
  expect(download).not.toHaveBeenCalled();
});

test('server asset loading retains downloaded bytes and metadata for a failed download retry', async () => {
  const loadSource = sourceBetween('async function assetsLoadServer()', 'async function assetAdd(file)');
  const factory = new Function('AS', 'HOST', 'SRV', 'URL', `${loadSource}; return assetsLoadServer;`);
  const AS = { mem: new Map() };
  const blob = new Blob(['ready'], { type: 'image/png' });
  const HOST = { assets: {
    list: vi.fn(async () => [
      { id: 'ready', name: 'ready.png', mimeType: 'image/png', url: '/ready.png' },
      { id: 'retry', name: 'retry.png', mimeType: 'image/png', url: '/retry.png' },
    ]),
    download: vi.fn(async id => {
      if (id === 'retry') throw new Error('temporary');
      return blob;
    }),
  } };
  const assetsLoadServer = factory(AS, HOST, { editorSessionToken: 'token' }, { createObjectURL: vi.fn(() => 'blob:ready') });

  await assetsLoadServer();

  expect(AS.mem.get('ready')).toMatchObject({ blob, url: 'blob:ready' });
  expect(AS.mem.get('retry')).toMatchObject({ id: 'retry', url: '/retry.png' });
  expect(AS.mem.get('retry').blob).toBeUndefined();
});

test('actual page and site export orchestration materializes token sources before rewriting', async () => {
  const exportPageSource = sourceBetween('async function exportPage(', '/* Hand over each asset');
  const materializeAssetsFor = vi.fn(async () => []);
  const factory = new Function(
    'state', 'selfHostedFonts', 'buildPage', 'withVariants', 'materializeAssetsFor', 'assetsToPaths', 'assetsToData',
    `${exportPageSource}; return exportPage;`
  );
  const exportPage = factory(
    { meta: { selfHostFonts: 0 } },
    vi.fn(),
    vi.fn(() => '<img src="asset:hero">'),
    (ctx, mode) => ({ ...ctx, variants: mode === 'files' }),
    materializeAssetsFor,
    vi.fn(() => '<img src="assets/hero.png">'),
    vi.fn(async () => '<img src="data:image/png;base64,aGVybw==">'),
  );

  await expect(exportPage({ id: 'home' }, 'files')).resolves.toContain('assets/hero.png');
  expect(materializeAssetsFor).toHaveBeenCalledWith('<img src="asset:hero">');
  expect(source).toContain("if (collections().length) every += contentJson();");
  expect(source).toContain('for (const file of await action.wait(() => exportAssetFiles(every)))');
  expect(source).not.toMatch(/for \(const a of AS\.mem\.values\(\)\)[\s\S]{0,180}download\(assetFile\(a\)/);
});
