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
  findNodes,
} from '../../premade-sites/lib/v1/design-contract.ts';
import {
  PREMADE_DESIGN_CONTRACT_V2,
  validatePremadeDesignContractV2,
} from '../../premade-sites/lib/v2/design-contract.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'premade-sites');

test('curated site catalog exposes each immutable package', async () => {
  const store = new FileSiteTemplateStore(root);
  const templates = await store.list();
  a.deepEqual(
    templates.filter(template => template.id === 'independent-studio').map(template => template.version),
    ['1.0.0', '1.0.1', '2.0.0', '2.0.1', '2.0.2', '2.0.3', '2.0.4', '2.0.5', '2.0.6', '2.0.7', '2.0.8', '2.0.9'],
  );
  const latest = latestSiteTemplates(templates);
  const template = latest.find(candidate => candidate.id === 'independent-studio');
  const coastal = latest.find(candidate => candidate.id === 'coastal-rentals');
  a.ok(template && coastal);
  a.equal(template.version, '2.0.9');
  a.deepEqual(template.pages.map(page => page.slug), ['index', 'about', 'services', 'contact']);
  const bytes = new Uint8Array(await readFile(resolve(root, template.id, template.version, template.packageFile)));
  const validated = validatePortablePackage(bytes);
  a.equal(validated.sha256, template.packageSha256);
  a.equal(validated.manifest.kind, 'site');
  a.equal(validated.dependencies.assets.length, 5);
  a.equal(coastal.version, '1.0.3');
  a.deepEqual(coastal.pages.map(page => page.slug), [
    'index', 'stays', 'stone-cove-house', 'pine-court-house', 'harbor-studio',
    'garden-casita', 'services', 'about', 'contact',
  ]);
  const coastalBytes = new Uint8Array(await readFile(resolve(root, coastal.id, coastal.version, coastal.packageFile)));
  const coastalPackage = validatePortablePackage(coastalBytes);
  a.equal(coastalPackage.sha256, coastal.packageSha256);
  a.equal(coastalPackage.dependencies.assets.length, 7);
});

test('each site installation receives independent asset identities and remains renderable', async () => {
  const store = new FileSiteTemplateStore(root);
  const first = await store.instantiate('independent-studio');
  const second = await store.instantiate('independent-studio', '2.0.9');
  a.ok(first && second);
  a.equal(first.template.version, '2.0.9');
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

test('vacation-rental template installs as an editable nine-page Pagecraft site', async () => {
  const store = new FileSiteTemplateStore(root);
  const installed = await store.instantiate('coastal-rentals', '1.0.3');
  a.ok(installed);
  a.equal(installed.document.pages.length, 9);
  a.equal(installed.assets.length, 7);
  a.equal(String(installed.document.meta.css || ''), '');
  a.ok(installed.document.pages.every(page => page.tree.length > 0));
  a.ok(installed.assets.every(asset => asset.contentHash === sha256(asset.bytes)));
  a.equal(JSON.stringify(installed.document).includes('asset:marea-'), false);
  for (const asset of installed.assets) a.match(JSON.stringify(installed.document), new RegExp(`asset:${asset.id}`));

  const nativeSticky = findNodes(
    installed.document.pages.flatMap(page => page.tree),
    node => String(node.adv?.cls || '').includes('marea-sticky-story'),
  );
  a.equal(nativeSticky.length, 4);
  for (const node of nativeSticky) {
    a.deepEqual(
      ['d', 't'].map(breakpoint => [
        node.css[breakpoint as 'd' | 't'].position,
        node.css[breakpoint as 'd' | 't'].top,
      ]),
      [['sticky', '104px'], ['static', '0px']],
    );
    a.equal(String(node.adv.css || ''), '');
  }

  const rendered = renderSite(installed.document, installed.assets);
  a.deepEqual([...rendered.files.keys()].filter(path => path.endsWith('.html')).sort(), [
    'about.html', 'contact.html', 'garden-casita.html', 'harbor-studio.html', 'index.html',
    'pine-court-house.html', 'services.html', 'stays.html', 'stone-cove-house.html',
  ]);
  for (const html of [...rendered.files.values()].filter(value => value.includes('<!doctype html>'))) {
    a.doesNotMatch(html, /asset:marea-/);
    a.doesNotMatch(html, /pagecraft-placeholder/);
  }
});

test('template preview serves package HTML and its packaged media only', async () => {
  const store = new FileSiteTemplateStore(root);
  const page = await store.preview('independent-studio', '2.0.9', 'index.html');
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
  a.doesNotMatch(previewHtml, /\bnl-sticky\b/);

  const dom = new JSDOM(previewHtml, { pretendToBeVisual: true });
  const dividerGroup = dom.window.document.querySelector(`.${PREMADE_DESIGN_CONTRACT_V2.dividerList}`);
  const dividerItems = [...dom.window.document.querySelectorAll(`.${PREMADE_DESIGN_CONTRACT_V2.dividerItem}`)];
  const card = dom.window.document.querySelector(`.${PREMADE_DESIGN_CONTRACT_V1.cardShell}`);
  const cardMedia = dom.window.document.querySelector(`.${PREMADE_DESIGN_CONTRACT_V1.cardMedia}`);
  const stickyIntro = dom.window.document.querySelector('#pagecraft-column-orthline-v2-node-0049');
  a.ok(dividerGroup && card && cardMedia && stickyIntro);
  a.equal(dividerItems.length, 3);
  a.equal(dom.window.getComputedStyle(dividerGroup).borderTopWidth, '0px');
  a.equal(dom.window.getComputedStyle(dividerGroup).borderBottomWidth, '0px');
  a.equal(dom.window.getComputedStyle(dividerItems[0]).borderTopWidth, '0px');
  a.equal(dom.window.getComputedStyle(dividerItems[1]).borderTopWidth, '1px');
  a.equal(dom.window.getComputedStyle(dividerItems[2]).borderTopWidth, '1px');
  a.equal(dom.window.getComputedStyle(card).borderTopWidth, '1px');
  a.equal(dom.window.getComputedStyle(cardMedia).borderTopWidth, '0px');
  a.equal(dom.window.document.querySelectorAll(`.${PREMADE_DESIGN_CONTRACT_V1.sectionIntro}`).length, 1);
  a.equal(dom.window.getComputedStyle(stickyIntro).position, 'sticky');
  a.equal(dom.window.getComputedStyle(stickyIntro).top, '104px');

  const template = latestSiteTemplates(await store.list()).find(candidate => candidate.id === 'independent-studio');
  a.ok(template);
  const installed = await store.instantiate(template.id, template.version);
  a.ok(installed);
  a.deepEqual(validatePremadeDesignContractV2(installed.document), []);
  const installedSticky = findNodes(
    installed.document.pages.flatMap(page => page.tree),
    node => node.id === 'northline-v2-node-0049',
  )[0];
  a.ok(installedSticky);
  a.deepEqual(
    ['d', 't', 'm'].map(breakpoint => [
      installedSticky.css[breakpoint as 'd' | 't' | 'm'].position,
      installedSticky.css[breakpoint as 'd' | 't' | 'm'].top,
    ]),
    [['sticky', '104px'], ['sticky', '104px'], ['static', '0px']],
  );
  a.equal(String(installedSticky.adv.cls || '').includes('nl-sticky'), false);
  a.equal(JSON.stringify(installed.document).match(/pc-section-intro-v1/g)?.length, 4);
  const original = validatePortablePackage(new Uint8Array(await readFile(resolve(root, template.id, template.version, template.packageFile))));
  const assetPath = original.manifest.files.find(file => file.role === 'asset')!.path;
  const asset = await store.preview(template.id, template.version, assetPath);
  a.ok(asset);
  a.equal(asset.mediaType, 'image/webp');
  a.ok(asset.bytes.byteLength > 20_000);
  a.equal(await store.preview(template.id, template.version, '../../catalog.json'), null);
  a.ok(await store.preview('independent-studio', '2.0.7', 'index.html'));
  a.ok(await store.preview('independent-studio', '2.0.8', 'index.html'));
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
