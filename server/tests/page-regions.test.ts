import { test, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import * as Core from '../../app/src/core/index.ts';
import { blankDoc, renderSite } from '../src/render.ts';
import { contentOnly, formRoutingChanged } from '../src/content.ts';
import { publicationChanges } from '../src/publication-changes.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { publicationPreviewHtml } from '../src/publication-preview.ts';
import { siteForms } from '../src/submissions.ts';
import { validateTemplateDraftDocument } from '../src/template-draft-validation.ts';
import { createPagePackage, createSitePackage, selectPortablePageDocument, validatePortablePackage } from '../src/portable-packages.ts';
import { supportsPortableRendererContract } from '../../app/src/package/renderer-version.ts';
import { createPortableZip, extractPortableZip } from '../src/portable-zip.ts';
import {
  authoredCssAtRuleIssues, authoredStylesheetIssues, buildReleaseArtifact, canonicalJson,
  existingThemeCssIssues, manifestForRelease, migrateIndexedWordPressLinks, sha256
} from '../src/releases.ts';
import type { Asset } from '../src/assets.ts';
import type { Doc } from '../../app/src/core/types.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { FileAssistantStore } from '../src/assistants.ts';
import { MemoryPublicationReviewStore } from '../src/reviews.ts';

const encoder = new TextEncoder();
const json = (value: unknown) => encoder.encode(canonicalJson(value));
const provenance = { format: 'pagecraft.provenance.v1' as const, origin: 'pagecraft-cloud' as const,
  sourceId: 'workshop-regions', sourceVersion: 1 };
const asset = (id: string): Asset => ({ id, siteId: 'workshop-regions', name: id + '.png',
  type: 'image/png', w: 1, h: 1, bytes: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]) });
const image = (id: string) => Core.N('image', { src: 'asset:' + id, alt: 'Workshop ' + id });
const fixture = () => {
  const doc = blankDoc('Workshop regions');
  doc.header = [Core.N('heading', { text: 'Shared workshop header' }), image('shared-photo')];
  doc.footer = [Core.N('text', { html: '<p>Shared workshop footer</p>' })];
  doc.pages[0].tree = [Core.N('heading', { text: 'Workshop home' })];
  doc.pages.push({ ...structuredClone(doc.pages[0]), id: 'workshop-special', name: 'Workshop special', slug: 'special',
    tree: [Core.N('heading', { text: 'Workshop special body' })],
    header: [Core.N('heading', { text: 'Custom workshop header' }), image('custom-photo')], footer: null });
  return doc;
};

test('Cloud rendering and frozen publication previews use each effective region and owned image', async () => {
  const doc = fixture();
  const original = structuredClone(doc);
  const assets = [asset('shared-photo'), asset('custom-photo')];
  const files = renderSite(doc, assets).files;
  expect(files.get('index.html')).toContain('Shared workshop header');
  expect(files.get('special.html')).toContain('Custom workshop header');
  expect(files.get('special.html')).not.toContain('Shared workshop header');
  expect(files.get('special.html')).not.toContain('Shared workshop footer');
  expect(files.get('special.html')).toContain(Core.assetFile(assets[1]));
  expect(files.get('special.html')).not.toContain(Core.assetFile(assets[0]));
  const store = new MemoryHostedPublicationStore();
  const publication = await store.create({ siteId: 'workshop-regions', slug: 'workshop-regions', host: 'workshop.test', sourceVersion: 1,
    files: [...[...files].map(([path, text]) => ({ path, mediaType: 'text/html', bytes: encoder.encode(text) })),
      ...assets.map(a => ({ path: Core.assetFile(a), mediaType: a.type, bytes: a.bytes }))] });
  const preview = await publicationPreviewHtml(store, publication, 'special.html', files.get('special.html')!);
  expect(preview).toContain('Custom workshop header');
  expect(preview).toContain('src="data:image/png;base64,');
  expect(doc).toEqual(original);
});

test('content accounts may edit custom-region words and owned media, but not routing, structure, foreign assets or unsafe HTML', () => {
  const before = fixture();
  before.pages[1].header!.push(Core.N('text', { html: '<p>Workshop details</p>' }));
  const owned = new Set(['shared-photo', 'custom-photo', 'replacement-photo']);
  const edit = (fn: (doc: Doc) => void) => { const after = structuredClone(before); fn(after); return contentOnly(before, after, owned); };
  expect(edit(d => { d.pages[1].header![0].props.text = 'Updated workshop header'; }).ok).toBe(true);
  expect(edit(d => { d.pages[1].header![1].props.src = 'asset:replacement-photo'; }).ok).toBe(true);
  expect(edit(d => { d.pages[1].header![1].props.src = 'asset:foreign-photo'; }).ok).toBe(false);
  expect(edit(d => { d.pages[1].header![2].props.html = '<p><a href="/details">Safe details</a></p>'; }).ok).toBe(true);
  expect(edit(d => { d.pages[1].header![2].props.html = '<img src=x onerror="alert(1)">'; }).ok).toBe(false);
  expect(edit(d => { d.pages[1].header = null; }).ok).toBe(false);
  expect(edit(d => { delete d.pages[1].header; }).ok).toBe(false);
  expect(edit(d => { d.pages[1].footer = []; }).ok).toBe(false);
  const form = Core.N('form', { action: 'https://workshop.test/receive', method: 'POST' });
  before.pages[1].header!.push(form);
  const after = structuredClone(before);
  after.pages[1].header!.at(-1)!.props.action = 'https://different.test/receive';
  expect(formRoutingChanged(before, after)).toBe(true);
});

test('publication review attributes custom edits to one page and shared edits only to inheriting pages', () => {
  const before = fixture();
  const custom = structuredClone(before);
  custom.pages[1].header![0].props.text = 'Changed custom header';
  const changes = publicationChanges(before, custom);
  expect(changes.filter(c => c.group === 'Pages')).toMatchObject([{ label: 'Workshop special', pages: [{ id: 'workshop-special' }] }]);
  expect(changes.some(c => c.group === 'Global regions')).toBe(false);
  const shared = structuredClone(before);
  shared.header[0].props.text = 'Changed shared header';
  shared.footer[0].props.html = '<p>Changed shared footer</p>';
  const global = publicationChanges(before, shared).filter(c => c.group === 'Global regions');
  expect(global).toHaveLength(2);
  expect(global.every(c => c.pages.length === 1 && c.pages[0].id === before.pages[0].id)).toBe(true);
});

test('portable page packages materialize selected effective regions without source mutation or duplicate stored ids', () => {
  const doc = fixture();
  const original = structuredClone(doc);
  const built = createPagePackage({ document: doc, pageId: 'workshop-special', assets: [asset('custom-photo')], provenance });
  const exported = validatePortablePackage(built.bytes);
  const transported = JSON.parse(new TextDecoder().decode(exported.files.get('source/document.json')));
  expect(built.manifest.schemaVersion).toBe(14);
  expect(built.manifest.rendererVersion).toBe('pagecraft-core-14');
  expect(supportsPortableRendererContract(built.manifest.rendererVersion, built.manifest.rendererRevision,
    built.manifest.schemaVersion, 14)).toBe(true);
  expect(transported.schemaVersion).toBe(14);
  expect(transported.v).toBe(14);
  expect(transported.pages[0]).not.toHaveProperty('header');
  expect(transported.pages[0]).not.toHaveProperty('footer');
  expect(exported.document.pages).toHaveLength(1);
  expect(exported.document.pages[0]).not.toHaveProperty('header');
  expect(exported.document.pages[0]).not.toHaveProperty('footer');
  expect(exported.document.header).toEqual(doc.pages[1].header);
  expect(exported.document.footer).toEqual([]);
  expect(exported.dependencies.assets).toEqual(['custom-photo']);
  expect(new TextDecoder().decode(exported.files.get('compiled/special.html'))).toContain('Custom workshop header');
  expect(doc).toEqual(original);
  doc.pages[1].header = [];
  const empty = validatePortablePackage(createPagePackage({ document: doc, pageId: 'workshop-special', provenance }).bytes);
  expect(empty.document.header).toEqual([]);
  const shared = validatePortablePackage(createPagePackage({ document: original, pageId: original.pages[0].id,
    assets: [asset('shared-photo')], provenance }).bytes);
  expect(shared.document.header).toEqual(original.header);
  expect(() => selectPortablePageDocument({ ...doc, schemaVersion: 18 }, 'workshop-special'))
    .toThrow(/requires a reviewed schema-14, schema-15, schema-16 or schema-17/);
  expect(() => createPagePackage({ document: { ...doc, schemaVersion: Core.SCHEMA + 1 }, pageId: 'workshop-special', provenance }))
    .toThrow(/Upgrade Pagecraft|newer/);
});

test('portable site and Connected WordPress v1 fail closed for every explicit region mode', () => {
  for (const override of [null, [], [Core.N('heading', { text: 'Page header' })]]) {
    const doc = blankDoc('Workshop boundary'); doc.pages[0].header = override;
    expect(() => createSitePackage({ document: doc, provenance })).toThrow(/Portable package v1 cannot carry per-page/);
    expect(() => buildReleaseArtifact({ releaseId: 'workshop-release', siteId: 'workshop-regions', sourceVersion: 1,
      document: doc, files: renderSite(doc).files })).toThrow(/Connected WordPress release v1 does not support per-page/);
  }
});

test('inherited-only schema-16 sites retain the schema-14 portable and Connected v1 contracts without changing source', () => {
  const doc = blankDoc('Workshop shared-site handoff');
  doc.schemaVersion = 16;
  doc.header = [Core.N('heading', { text: 'Workshop shared header' })];
  doc.pages[0].tree = [Core.N('heading', { text: 'Workshop shared body' })];
  doc.meta.font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  doc.meta.headFont = '';
  for (const style of doc.meta.tokens?.text || []) {
    for (const breakpoint of ['d', 't', 'm'] as const) delete style.css[breakpoint]['font-family'];
  }
  const before = structuredClone(doc);
  const built = createSitePackage({ document: doc, provenance });
  const validated = validatePortablePackage(built.bytes);
  const transported = JSON.parse(new TextDecoder().decode(validated.files.get('source/document.json')));
  expect(built.manifest.schemaVersion).toBe(14);
  expect(built.manifest.rendererVersion).toBe('pagecraft-core-14');
  expect(supportsPortableRendererContract(built.manifest.rendererVersion, built.manifest.rendererRevision,
    built.manifest.schemaVersion, 14)).toBe(true);
  expect(transported.schemaVersion).toBe(14);
  expect(transported.v).toBe(14);
  expect(transported.pages[0]).not.toHaveProperty('header');
  expect(transported.pages[0]).not.toHaveProperty('footer');
  expect(new TextDecoder().decode(validated.files.get('compiled/index.html'))).toContain('Workshop shared header');
  const files = renderSite(doc).files;
  const release = buildReleaseArtifact({ releaseId: 'workshop-shared-release', siteId: 'workshop-shared',
    sourceVersion: 1, document: doc, files });
  expect(release.artifact.schemaVersion).toBe(14);
  expect(release.artifact.rendererVersion).toBe('pagecraft-core-14');
  expect(release.artifact.shared.headerHtml).toContain('Workshop shared header');
  const manifestInput = { releaseId: 'workshop-shared-release', siteId: 'workshop-shared', sequence: 1,
    sourceVersion: 1, schemaVersion: 16, parentReleaseId: null, createdAt: '2026-11-13T00:00:00.000Z',
    audit: { acknowledgeWarnings: false, warningCodes: [], warningCount: 0, errorCodes: [], errorCount: 0 }, built: release };
  const manifest = manifestForRelease(manifestInput);
  expect(manifest.schemaVersion).toBe(14);
  expect(manifest.rendererVersion).toBe('pagecraft-core-14');
  expect(manifest.artifactHash).toBe(release.artifactHash);
  const native = structuredClone(doc);
  const tabs = Core.N('tabs'); Core.enableTabPanels(tabs); native.pages[0].tree = [tabs];
  const nativeRelease = buildReleaseArtifact({ releaseId: manifestInput.releaseId, siteId: manifestInput.siteId,
    sourceVersion: 1, document: native, files: renderSite(native).files });
  expect(nativeRelease.artifact.schemaVersion).toBe(15);
  expect(nativeRelease.artifact.rendererVersion).toBe('pagecraft-core-15');
  const nativeManifest = manifestForRelease({ ...manifestInput, built: nativeRelease });
  expect(nativeManifest.schemaVersion).toBe(15);
  expect(nativeManifest.rendererVersion).toBe('pagecraft-core-15');
  expect(doc).toEqual(before);
  const future = { ...doc, schemaVersion: 18 };
  expect(() => createSitePackage({ document: future, provenance })).toThrow(/Upgrade Pagecraft|newer/);
  expect(() => buildReleaseArtifact({ releaseId: 'workshop-future', siteId: 'workshop-shared', sourceVersion: 1,
    document: future, files })).toThrow(/requires a reviewed schema-17 or earlier/);
  expect(() => manifestForRelease({ ...manifestInput, schemaVersion: 18 })).toThrow(/requires a reviewed schema-17 or earlier/);
});

test('portable import refuses a correctly rehashed legacy document carrying newer page-region fields', () => {
  const doc = blankDoc('Workshop import boundary');
  const files = extractPortableZip(createSitePackage({ document: doc, provenance }).bytes);
  const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  const document = JSON.parse(new TextDecoder().decode(files.get('source/document.json')));
  document.pages[0].footer = null;
  const bytes = json(document); files.set('source/document.json', bytes);
  const row = manifest.files.find((file: { path: string }) => file.path === 'source/document.json');
  row.bytes = bytes.byteLength; row.sha256 = sha256(bytes);
  manifest.contentHash = sha256(json(manifest.files)); files.set('manifest.json', json(manifest));
  const archive = createPortableZip([...files].map(([path, content]) => ({ path, bytes: content })));
  expect(() => validatePortablePackage(archive)).toThrow(/Page footer overrides require document schema 16/);
});

test('portable page CMS rejection also inspects a custom shell', () => {
  const doc = blankDoc('Workshop CMS boundary');
  const heading = Core.N('heading', { text: 'Workshop title' });
  heading.bind = { text: { src: 'field', path: 'title' } };
  doc.pages[0].header = [heading];
  expect(() => createPagePackage({ document: doc, pageId: doc.pages[0].id, provenance }))
    .toThrow(/rejects Pagecraft CMS bindings/);
});

test('curated template validation walks custom regions for IDs, safe content and asset ownership', () => {
  const doc = blankDoc('Workshop template');
  doc.pages[0].header = [Core.N('heading', { text: 'Workshop header' })]; doc.pages[0].footer = null;
  expect(validateTemplateDraftDocument(doc)).toEqual(doc);
  const unsafe = structuredClone(doc); unsafe.pages[0].header![0].props.text = '<script>alert(1)</script>';
  expect(() => validateTemplateDraftDocument(unsafe)).toThrow(/unsafe content/);
  const foreign = structuredClone(doc); foreign.pages[0].footer = [image('foreign-photo')];
  expect(() => validateTemplateDraftDocument(foreign)).toThrow(/unknown asset/);
  const duplicate = structuredClone(doc); duplicate.pages[0].tree = structuredClone(duplicate.pages[0].header!);
  expect(() => validateTemplateDraftDocument(duplicate)).toThrow(/duplicate or invalid node id/);
});

test('publication security and native-link migration inspect page-owned header/footer markup', () => {
  const doc = blankDoc('Workshop authored shell');
  doc.pages[0].header = [Core.N('embed', { html: '<link rel="stylesheet" href="https://workshop.test/theme.css"><style>@import "https://workshop.test/font.css"; body {color:red}</style>' })];
  expect(authoredStylesheetIssues(doc)).toEqual(['unsafe-external-stylesheet']);
  expect(authoredCssAtRuleIssues(doc)).toEqual(['unsafe-global-at-rule']);
  expect(existingThemeCssIssues(doc)).toContain('unsafe-global-selector');
  doc.pages[0].footer = [Core.N('button', { link: 'https://staging.workshop.test/preview/contact/' })];
  const migrated = migrateIndexedWordPressLinks(doc, [{ targetOrigin: 'https://staging.workshop.test', targetPath: '/preview',
    items: [{ objectType: 'page', url: 'https://staging.workshop.test/preview/contact/' }] }]);
  expect(migrated.migrated).toBe(1);
  expect(Core.parseWordPressContentReference(String(migrated.document.pages[0].footer![0].props.link)))
    .toEqual({ objectType: 'page', path: '/contact/' });
});

test('submission discovery includes custom forms and excludes shared forms hidden on every page', () => {
  const doc = blankDoc('Workshop forms');
  const shared = Core.N('form', { aria: 'Shared workshop form' });
  const custom = Core.N('form', { aria: 'Custom workshop form' });
  doc.header = [shared]; doc.pages[0].header = [custom]; doc.pages[0].footer = null;
  expect(siteForms(doc)).toMatchObject([{ id: custom.id, name: 'Custom workshop form', pages: ['Home header'] }]);
  doc.pages[0].header = null;
  expect(siteForms(doc)).toEqual([]);
  delete doc.pages[0].header;
  expect(siteForms(doc)).toMatchObject([{ id: shared.id, name: 'Shared workshop form', pages: ['Header'] }]);
});

test('MCP discovers custom regions, files scoped proposals, and previews shared changes on an inheriting page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workshop-region-protocol-'));
  const client = new Client({ name: 'Workshop protocol check', version: '1.0.0' });
  try {
    const doc = fixture();
    doc.pages[0].header = [Core.N('heading', { text: 'Home custom header' })];
    delete doc.pages[1].header;
    const store = new MemoryStore(), auth = new MemoryAuthStore();
    const proposals = new FileAssistantStore(root);
    const site = await store.create({ host: 'workshop.test', name: 'Workshop regions', slug: 'workshop-regions', doc });
    const owner = await auth.createUser('workshop-owner@example.test', 'Workshop owner');
    await auth.grant(site.id, owner.id, 'owner');
    const session = newToken(); await auth.putSession(hashToken(session), owner.id, Date.now() + 60000);
    const { token } = await proposals.createToken(site.id, 'Workshop integration', owner.id);
    const app = createApp({ store, auth, assistants: proposals, reviews: new MemoryPublicationReviewStore(),
      editorHost: 'editor.test', editorOrigin: 'https://editor.test', editorHtml: '<title>Workshop editor</title>' });
    await client.connect(new StreamableHTTPClientTransport(new URL('https://editor.test/mcp'), {
      authProvider: { token: async () => token }, fetch: async (input, init) => {
        const headers = new Headers(init?.headers); headers.set('host', 'editor.test');
        return app.fetch(new Request(input, { ...init, headers }));
      }
    }));
    const outline = (await client.callTool({ name: 'pagecraft_site', arguments: {} })).structuredContent as any;
    const region = 'page-header:' + doc.pages[0].id;
    expect(outline.regions).toEqual(['header', 'footer', region]);
    const page = (await client.callTool({ name: 'pagecraft_get_page', arguments: { pageId: region } })).structuredContent as any;
    expect(page.name).toBe('Home header');
    expect(page.elements[0].text).toEqual({ text: 'Home custom header' });
    const custom = (await client.callTool({ name: 'pagecraft_propose_changes', arguments: {
      baseVersion: site.version, title: 'Update workshop home header', changes: [{ type: 'text', nodeId: doc.pages[0].header![0].id, value: 'Reviewed custom header' }]
    } })).structuredContent as any;
    expect((await proposals.proposal(site.id, custom.proposal.id))!.regions).toEqual([region]);
    const shared = (await client.callTool({ name: 'pagecraft_propose_changes', arguments: {
      baseVersion: site.version, title: 'Update shared workshop header', changes: [{ type: 'text', nodeId: doc.header[0].id, value: 'Reviewed shared header' }]
    } })).structuredContent as any;
    const list = await (await app.request(`https://editor.test/api/sites/${site.id}/proposals`, {
      headers: { host: 'editor.test', cookie: 'pc_session=' + session }
    })).json() as any;
    expect(list.proposals.find((p: any) => p.id === custom.proposal.id).previews)
      .toEqual([{ region, label: 'Home header', path: 'index.html' }]);
    expect(list.proposals.find((p: any) => p.id === shared.proposal.id).previews)
      .toEqual([{ region: 'header', label: 'Header', path: 'special.html' }]);
    const preview = await (await app.request(`https://editor.test/api/sites/${site.id}/proposals/${custom.proposal.id}/preview/index.html`, {
      headers: { host: 'editor.test', cookie: 'pc_session=' + session }
    })).text();
    expect(preview).toContain('Reviewed custom header');
    expect(preview).not.toContain('Shared workshop header');
    expect((await store.byId(site.id))!.doc).toEqual(doc);
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
});
