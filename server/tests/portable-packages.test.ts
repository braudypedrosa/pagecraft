import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import type { Doc } from '../../app/src/core/types.ts';
import {
  PORTABLE_PACKAGE_LIMITS_V1, type PortablePackageManifestV1
} from '../../app/src/package/types.ts';
import type { Asset } from '../src/assets.ts';
import { blankDoc } from '../src/render.ts';
import { canonicalJson, sha256 } from '../src/releases.ts';
import { createPortableZip, extractPortableZip } from '../src/portable-zip.ts';
import {
  createPagePackage, createSitePackage, validatePortablePackage
} from '../src/portable-packages.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const json = (value: unknown) => encoder.encode(canonicalJson(value));

const fixture = () => {
  const doc = blankDoc('Portable Studio');
  const nav = Core.makeFor('nav');
  nav.props.items = [
    { label: 'Home', href: 'index.html', cls: 'primary current', target: '' },
    { label: 'Docs', href: 'https://example.test/docs', cls: 'external', target: '_blank' }
  ];
  doc.header = [nav];
  const image = Core.makeFor('image');
  image.props.src = 'asset:hero-image';
  image.props.alt = 'Portable package fixture';
  doc.pages[0].tree = [image];
  const second = structuredClone(doc.pages[0]);
  second.id = 'about-page';
  second.name = 'About';
  second.slug = 'about';
  second.title = 'About Portable Studio';
  doc.pages.push(second);
  const asset: Asset = {
    id: 'hero-image', siteId: 'portable-site', name: 'Hero Image.png', type: 'image/png',
    w: 1, h: 1,
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  };
  return { doc, asset, nav, image };
};

const provenance = {
  format: 'pagecraft.provenance.v1' as const,
  origin: 'pagecraft-cloud' as const,
  sourceId: 'portable-site', sourceVersion: 7, exportedBy: 'owner-1'
};

const replaceEntries = (archive: Uint8Array, change: (files: Map<string, Uint8Array>) => void) => {
  const files = extractPortableZip(archive);
  change(files);
  return createPortableZip([...files].map(([path, bytes]) => ({ path, bytes })));
};

const rewriteManifest = (
  archive: Uint8Array,
  change: (manifest: PortablePackageManifestV1, files: Map<string, Uint8Array>) => void
) => replaceEntries(archive, files => {
  const manifest = JSON.parse(decoder.decode(files.get('manifest.json')!)) as PortablePackageManifestV1;
  change(manifest, files);
  files.set('manifest.json', json(manifest));
});

test('identical site inputs produce byte-identical deterministic packages and hashes', () => {
  const { doc, asset } = fixture();
  const first = createSitePackage({ document: doc, assets: [asset], provenance });
  const second = createSitePackage({ document: structuredClone(doc), assets: [structuredClone(asset)], provenance });
  a.deepEqual(first.bytes, second.bytes);
  a.equal(first.sha256, second.sha256);
  a.deepEqual(first.manifest, second.manifest);
  a.equal(first.filename, 'portable-studio.pagecraft-site.zip');
  a.equal(first.manifest.contentHash, sha256(json(first.manifest.files)));
});

test('site and page packages retain source, globals, menus, styles, previews, and assets', () => {
  const { doc, asset, nav, image } = fixture();
  const site = validatePortablePackage(createSitePackage({ document: doc, assets: [asset], provenance }).bytes);
  a.equal(site.manifest.kind, 'site');
  a.equal(site.document.pages.length, 2);
  a.ok(site.files.has('source/document.json'));
  a.ok(site.files.has('source/provenance.json'));
  a.ok(site.files.has('source/dependencies.json'));
  a.ok(site.files.has('compiled/index.html'));
  a.ok(site.files.has('compiled/about.html'));
  a.ok(site.files.has('styles/global.css'));
  a.ok(site.files.has('styles/pages/index.css'));
  a.ok(site.files.has('styles/pages/about.css'));
  const globalCss = decoder.decode(site.files.get('styles/global.css'));
  const pageCss = decoder.decode(site.files.get('styles/pages/index.css'));
  a.match(globalCss, /:root\{/);
  a.match(globalCss, new RegExp(`\\.${Core.nodeClass(nav)}\\b`));
  a.doesNotMatch(globalCss, new RegExp(`\\.${Core.nodeClass(image)}\\b`));
  a.match(pageCss, new RegExp(`\\.${Core.nodeClass(image)}\\b`));
  a.doesNotMatch(pageCss, /:root\{/);
  a.ok(site.files.has('previews/index.html'));
  a.ok([...site.files.keys()].some(path => /^assets\/hero-image-/.test(path)));
  const packagedAsset = site.manifest.files.find(file => file.role === 'asset')!;
  a.deepEqual(packagedAsset.asset, { id: 'hero-image', name: 'Hero Image.png', width: 1, height: 1 });
  a.equal(site.dependencies.globals.headerNodes, 1);
  a.equal(site.dependencies.menus[0].items[1].target, '_blank');
  a.deepEqual(site.dependencies.menus[0].items[0].classes, ['current', 'primary']);
  a.deepEqual(site.dependencies.assets, ['hero-image']);

  const pageBuild = createPagePackage({
    document: doc, pageId: 'about-page', assets: [asset],
    provenance: { ...provenance, origin: 'wordpress-local', sourceId: 'wp-post-42' }
  });
  const page = validatePortablePackage(pageBuild.bytes);
  a.equal(pageBuild.filename, 'portable-studio-about.pagecraft-page.zip');
  a.equal(page.manifest.kind, 'page');
  a.equal(page.manifest.entryPageId, 'about-page');
  a.equal(page.document.pages.length, 1);
  a.equal(page.document.pages[0].slug, 'about');
  a.equal(page.document.header.length, 1);
  a.equal(page.provenance.origin, 'wordpress-local');
  a.equal(page.files.has('compiled/index.html'), false);
  a.equal(page.files.has('compiled/about.html'), true);
});

test('tampered and incomplete packages fail closed', () => {
  const { doc, asset } = fixture();
  const built = createSitePackage({ document: doc, assets: [asset], provenance });
  const tampered = replaceEntries(built.bytes, files => files.set('compiled/index.html', encoder.encode('changed')));
  a.throws(() => validatePortablePackage(tampered), /failed integrity verification/);

  const incomplete = replaceEntries(built.bytes, files => files.delete('source/dependencies.json'));
  a.throws(() => validatePortablePackage(incomplete), /unlisted or missing files/);
});

test('path traversal and unsupported package formats fail before import', () => {
  const harmless = createPortableZip([{ path: 'safe.txt', bytes: encoder.encode('safe') }]);
  const malicious = new Uint8Array(harmless);
  const before = encoder.encode('safe.txt');
  const after = encoder.encode('../x.txt');
  let replacements = 0;
  for (let at = 0; at <= malicious.byteLength - before.byteLength; at++) {
    if (before.every((value, index) => malicious[at + index] === value)) {
      malicious.set(after, at);
      replacements++;
    }
  }
  a.equal(replacements, 2, 'both local and central names are rewritten');
  a.throws(() => validatePortablePackage(malicious), /path traversal/);

  const { doc, asset } = fixture();
  const built = createSitePackage({ document: doc, assets: [asset], provenance });
  const unsupported = rewriteManifest(built.bytes, manifest => {
    (manifest as { format: string }).format = 'pagecraft.site-package.v99';
  });
  a.throws(() => validatePortablePackage(unsupported), /unsupported portable package format/);
});

test('unsupported file types and newer schemas fail closed', () => {
  const { doc, asset } = fixture();
  const built = createSitePackage({ document: doc, assets: [asset], provenance });
  const wrongType = rewriteManifest(built.bytes, manifest => {
    manifest.files.find(file => file.role === 'asset')!.mediaType = 'text/html';
    manifest.contentHash = sha256(json(manifest.files));
  });
  a.throws(() => validatePortablePackage(wrongType), /file record is invalid/);

  const wrongIdentity = rewriteManifest(built.bytes, manifest => {
    manifest.files.find(file => file.role === 'asset')!.asset!.id = 'another-asset';
    manifest.contentHash = sha256(json(manifest.files));
  });
  a.throws(() => validatePortablePackage(wrongIdentity), /file record is invalid/);

  const newer = rewriteManifest(built.bytes, (manifest, files) => {
    const document = JSON.parse(decoder.decode(files.get(manifest.documentPath)!)) as Doc & { v?: number };
    document.schemaVersion = Core.SCHEMA + 1;
    document.v = Core.SCHEMA + 1;
    const bytes = json(document);
    files.set(manifest.documentPath, bytes);
    const record = manifest.files.find(file => file.path === manifest.documentPath)!;
    record.bytes = bytes.byteLength;
    record.sha256 = sha256(bytes);
    manifest.schemaVersion = Core.SCHEMA + 1;
    manifest.rendererVersion = `pagecraft-core-${Core.SCHEMA + 1}`;
    manifest.contentHash = sha256(json(manifest.files));
  });
  a.throws(() => validatePortablePackage(newer), /unsupported renderer/);
});

test('an older supported document schema migrates before dependency validation', () => {
  const { doc, asset } = fixture();
  const built = createSitePackage({ document: doc, assets: [asset], provenance });
  const legacy = rewriteManifest(built.bytes, (manifest, files) => {
    const document = JSON.parse(decoder.decode(files.get(manifest.documentPath)!)) as Doc & { v?: number };
    document.schemaVersion = 12;
    document.v = 12;
    const bytes = json(document);
    files.set(manifest.documentPath, bytes);
    const record = manifest.files.find(file => file.path === manifest.documentPath)!;
    record.bytes = bytes.byteLength;
    record.sha256 = sha256(bytes);
    manifest.schemaVersion = 12;
    manifest.rendererVersion = 'pagecraft-core-12';
    manifest.contentHash = sha256(json(manifest.files));
  });
  const adopted = validatePortablePackage(legacy);
  a.equal(adopted.document.schemaVersion, Core.SCHEMA);
  a.equal((adopted.document as Doc & { v?: number }).v, Core.SCHEMA);
});

test('CMS dependencies and missing referenced assets are rejected explicitly', () => {
  const { doc, asset } = fixture();
  const cms = structuredClone(doc);
  cms.meta.collections = [{
    id: 'posts', name: 'Posts', slug: 'posts', detail: '', fields: [], items: []
  }];
  a.throws(
    () => createSitePackage({ document: cms, assets: [asset], provenance }),
    /rejects Pagecraft CMS bindings.*never silently removed/
  );
  a.throws(
    () => createSitePackage({ document: doc, assets: [], provenance }),
    /missing referenced asset hero-image/
  );
});

test('portable ZIP creation enforces the bounded file-count contract', () => {
  const tooMany = Array.from({ length: PORTABLE_PACKAGE_LIMITS_V1.files + 1 }, (_, index) => ({
    path: `files/${index}.txt`, bytes: new Uint8Array()
  }));
  a.throws(() => createPortableZip(tooMany), /exceeds 5000 files/);
});
