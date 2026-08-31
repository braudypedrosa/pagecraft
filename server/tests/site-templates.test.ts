import { test } from 'vitest';
import a from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { FileSiteTemplateStore, latestSiteTemplates } from '../src/site-templates.ts';
import { validatePortablePackage } from '../src/portable-packages.ts';
import { renderSite } from '../src/render.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'premade-sites');

test('curated site catalog exposes the immutable four-page studio package', async () => {
  const store = new FileSiteTemplateStore(root);
  const templates = await store.list();
  a.deepEqual(templates.map(template => template.version), ['1.0.0', '1.0.1', '2.0.0']);
  const [template] = latestSiteTemplates(templates);
  a.equal(template.id, 'independent-studio');
  a.equal(template.version, '2.0.0');
  a.deepEqual(template.pages.map(page => page.slug), ['index', 'about', 'services', 'contact']);
  const bytes = new Uint8Array(await readFile(resolve(root, template.id, template.version, template.packageFile)));
  const validated = validatePortablePackage(bytes);
  a.equal(validated.sha256, template.packageSha256);
  a.equal(validated.manifest.kind, 'site');
  a.equal(validated.dependencies.assets.length, 5);
});

test('each site installation receives independent asset identities and remains renderable', async () => {
  const store = new FileSiteTemplateStore(root);
  const first = await store.instantiate('independent-studio');
  const second = await store.instantiate('independent-studio', '2.0.0');
  a.ok(first && second);
  a.equal(first.template.version, '2.0.0');
  a.equal(first.document.pages.length, 4);
  a.equal(first.assets.length, 5);
  a.notDeepEqual(first.assets.map(asset => asset.id), second.assets.map(asset => asset.id));
  a.equal(JSON.stringify(first.document).includes('asset:northline-'), false);
  for (const asset of first.assets) a.match(JSON.stringify(first.document), new RegExp(`asset:${asset.id}`));
  const rendered = renderSite(first.document, first.assets);
  a.deepEqual([...rendered.files.keys()].filter(path => path.endsWith('.html')).sort(), ['about.html', 'contact.html', 'index.html', 'services.html']);
  for (const html of [...rendered.files.values()].filter(value => value.includes('<!doctype html>'))) {
    a.doesNotMatch(html, /pagecraft-placeholder/);
  }
});

test('template preview serves package HTML and its packaged media only', async () => {
  const store = new FileSiteTemplateStore(root);
  const page = await store.preview('independent-studio', '2.0.0', 'index.html');
  a.ok(page);
  a.equal(page.mediaType, 'text/html; charset=utf-8');
  a.match(new TextDecoder().decode(page.bytes), /<!doctype html>/i);
  const template = latestSiteTemplates(await store.list())[0];
  const installed = await store.instantiate(template.id, template.version);
  a.ok(installed);
  const original = validatePortablePackage(new Uint8Array(await readFile(resolve(root, template.id, template.version, template.packageFile))));
  const assetPath = original.manifest.files.find(file => file.role === 'asset')!.path;
  const asset = await store.preview(template.id, template.version, assetPath);
  a.ok(asset);
  a.equal(asset.mediaType, 'image/webp');
  a.ok(asset.bytes.byteLength > 20_000);
  a.equal(await store.preview(template.id, template.version, '../../catalog.json'), null);
  a.ok(await store.preview('independent-studio', '1.0.1', 'index.html'));
  a.ok(await store.preview('independent-studio', '1.0.0', 'index.html'));
});
