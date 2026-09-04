import { test } from 'vitest';
import a from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
// jsdom ships no declarations in this workspace; the DOM surface below is platform-typed.
// @ts-expect-error TS7016
import { JSDOM } from 'jsdom';
import { FileSiteTemplateStore, latestSiteTemplates } from '../src/site-templates.ts';
import { validatePortablePackage } from '../src/portable-packages.ts';
import { sha256 } from '../src/releases.ts';
import { renderSite } from '../src/render.ts';
import {
  PREMADE_DESIGN_CONTRACT_V1,
} from '../../premade-sites/lib/v1/design-contract.ts';
import {
  PREMADE_DESIGN_CONTRACT_V2,
  validatePremadeDesignContractV2,
} from '../../premade-sites/lib/v2/design-contract.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'premade-sites');

test('curated site catalog exposes the immutable four-page studio package', async () => {
  const store = new FileSiteTemplateStore(root);
  const templates = await store.list();
  a.deepEqual(templates.map(template => template.version), ['1.0.0', '1.0.1', '2.0.0', '2.0.1', '2.0.2', '2.0.3', '2.0.4', '2.0.5', '2.0.6', '2.0.7', '2.0.8']);
  const [template] = latestSiteTemplates(templates);
  a.equal(template.id, 'independent-studio');
  a.equal(template.version, '2.0.8');
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
  const second = await store.instantiate('independent-studio', '2.0.8');
  a.ok(first && second);
  a.equal(first.template.version, '2.0.8');
  a.equal(first.document.pages.length, 4);
  a.equal(first.assets.length, 5);
  a.ok(first.assets.every(asset => asset.contentHash === sha256(asset.bytes)),
    'every template image carries the stored-byte hash required by cloud persistence');
  a.ok(first.assets.every(asset => /^a[a-f0-9]{12}$/.test(asset.id)),
    'template images use the editor-native asset id format');
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
  const page = await store.preview('independent-studio', '2.0.8', 'index.html');
  a.ok(page);
  a.equal(page.mediaType, 'text/html; charset=utf-8');
  const previewHtml = new TextDecoder().decode(page.bytes);
  a.match(previewHtml, /<!doctype html>/i);
  a.match(previewHtml, /scrollbar-width:none/);
  a.match(previewHtml, /Direction is made in the open\./);
  a.match(previewHtml, /nl-loop-editorial/);
  a.match(previewHtml, /font-size:clamp\(44px,5vw,64px\)/);
  a.match(previewHtml, /nl-disciplines-intro/);
  a.doesNotMatch(previewHtml, /Three connected disciplines/);
  a.match(previewHtml, /border-radius:12px/);
  a.doesNotMatch(previewHtml, /class="[^"]*\bnl-loop-card\b/);
  a.match(previewHtml, new RegExp(PREMADE_DESIGN_CONTRACT_V1.cardShell));
  a.match(previewHtml, new RegExp(PREMADE_DESIGN_CONTRACT_V2.dividerList));

  const dom = new JSDOM(previewHtml, { pretendToBeVisual: true });
  const dividerGroup = dom.window.document.querySelector(`.${PREMADE_DESIGN_CONTRACT_V2.dividerList}`);
  const dividerItems = [...dom.window.document.querySelectorAll(`.${PREMADE_DESIGN_CONTRACT_V2.dividerItem}`)];
  const card = dom.window.document.querySelector(`.${PREMADE_DESIGN_CONTRACT_V1.cardShell}`);
  const cardMedia = dom.window.document.querySelector(`.${PREMADE_DESIGN_CONTRACT_V1.cardMedia}`);
  a.ok(dividerGroup && card && cardMedia);
  a.equal(dividerItems.length, 3);
  a.equal(dom.window.getComputedStyle(dividerGroup).borderTopWidth, '0px');
  a.equal(dom.window.getComputedStyle(dividerGroup).borderBottomWidth, '0px');
  a.equal(dom.window.getComputedStyle(dividerItems[0]).borderTopWidth, '0px');
  a.equal(dom.window.getComputedStyle(dividerItems[1]).borderTopWidth, '1px');
  a.equal(dom.window.getComputedStyle(dividerItems[2]).borderTopWidth, '1px');
  a.equal(dom.window.getComputedStyle(card).borderTopWidth, '1px');
  a.equal(dom.window.getComputedStyle(cardMedia).borderTopWidth, '0px');
  a.equal(dom.window.document.querySelectorAll(`.${PREMADE_DESIGN_CONTRACT_V1.sectionIntro}`).length, 1);

  const template = latestSiteTemplates(await store.list())[0];
  const installed = await store.instantiate(template.id, template.version);
  a.ok(installed);
  a.deepEqual(validatePremadeDesignContractV2(installed.document), []);
  a.equal(JSON.stringify(installed.document).match(/pc-section-intro-v1/g)?.length, 4);
  const original = validatePortablePackage(new Uint8Array(await readFile(resolve(root, template.id, template.version, template.packageFile))));
  const assetPath = original.manifest.files.find(file => file.role === 'asset')!.path;
  const asset = await store.preview(template.id, template.version, assetPath);
  a.ok(asset);
  a.equal(asset.mediaType, 'image/webp');
  a.ok(asset.bytes.byteLength > 20_000);
  a.equal(await store.preview(template.id, template.version, '../../catalog.json'), null);
  a.ok(await store.preview('independent-studio', '2.0.7', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.6', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.5', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.4', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.3', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.2', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.1', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.0', 'index.html'));
  a.ok(await store.preview('independent-studio', '1.0.1', 'index.html'));
  a.ok(await store.preview('independent-studio', '1.0.0', 'index.html'));
});
