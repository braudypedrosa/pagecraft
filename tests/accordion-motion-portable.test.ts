import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import * as Core from '../app/src/core/index.ts';
import { blankDoc, renderSite } from '../server/src/render.ts';
import { buildReleaseArtifact, manifestForRelease } from '../server/src/releases.ts';
import type { Asset } from '../server/src/assets.ts';
import { createSitePackage, createPagePackage, validatePortablePackage } from '../server/src/portable-packages.ts';
import { supportsPortableRendererContract } from '../app/src/package/renderer-version.ts';

const provenance = { format: 'pagecraft.provenance.v1' as const, origin: 'pagecraft-cloud' as const,
  sourceId: 'portable-check', sourceVersion: 1, exportedBy: 'owner' };
const current = () => { const doc = blankDoc('Portable check'); doc.schemaVersion = 17; return doc; };

test('new documents require renderer 4 only when a rendered accordion is present', () => {
  const doc = current();
  let result = createSitePackage({ document: doc, provenance });
  expect([result.manifest.schemaVersion, result.manifest.rendererRevision]).toEqual([14, 'pagecraft-renderer-2']);
  const tabs = Core.N('tabs');
  const panel = Core.N('box');
  tabs.children = [panel]; tabs.props.items = [{ label: 'Overview', panelId: panel.id }];
  doc.pages[0].tree = [tabs];
  expect(createSitePackage({ document: doc, provenance }).manifest.rendererRevision).toBe('pagecraft-renderer-3');
  doc.pages[0].tree = [Core.N('accordion')];
  result = createSitePackage({ document: doc, provenance });
  expect([result.manifest.schemaVersion, result.manifest.rendererRevision]).toEqual([17, 'pagecraft-renderer-4']);
  const html = new TextDecoder().decode(validatePortablePackage(result.bytes).files.get('compiled/index.html')!);
  expect(html).toContain('data-pc-accordion-motion');
  const page = createPagePackage({ document: doc, provenance, pageId: doc.pages[0].id });
  expect([page.manifest.schemaVersion, page.manifest.rendererRevision]).toEqual([17, 'pagecraft-renderer-4']);
});

test('accordion in a reachable component selects renderer 4; unused definitions do not', () => {
  const doc = current();
  doc.meta.components = [{ id: 'faq', name: 'Questions', node: Core.N('accordion'), props: [] }];
  expect(createSitePackage({ document: doc, provenance }).manifest.schemaVersion).toBe(14);
  const instance = Core.N('box'); instance.use = 'faq'; doc.pages[0].tree = [instance];
  expect(createSitePackage({ document: doc, provenance }).manifest.schemaVersion).toBe(17);
});

test('legacy source contracts stay fixed and incompatible reader identities fail closed', () => {
  for (const schema of [14, 15, 16]) {
    const doc = current(); doc.schemaVersion = schema; doc.pages[0].tree = [Core.N('accordion')];
    const result = createSitePackage({ document: doc, provenance });
    const legacyOutput = schema === 16 ? 14 : schema;
    expect(result.manifest.schemaVersion).toBe(legacyOutput);
    expect(result.manifest.rendererRevision).toBe(legacyOutput === 14 ? 'pagecraft-renderer-2' : 'pagecraft-renderer-3');
  }
  expect(supportsPortableRendererContract('pagecraft-core-17', 'pagecraft-renderer-4', 17, 16)).toBe(false);
  expect(supportsPortableRendererContract('pagecraft-core-17', 'pagecraft-renderer-3', 17, 17)).toBe(false);
  expect(supportsPortableRendererContract('pagecraft-core-15', 'pagecraft-renderer-4', 15, 17)).toBe(false);
});

test('frozen r37 schema 15 package rebuilds byte-for-byte', () => {
  const bytes = new Uint8Array(readFileSync(new URL('../evidence/dental-depth-2026-11-14/Package/dental-clinic-a2-0.1.0-r37.pagecraft-site.zip', import.meta.url)));
  const original = validatePortablePackage(bytes);
  const document = JSON.parse(new TextDecoder().decode(original.files.get(original.manifest.documentPath)!));
  const assets: Asset[] = original.manifest.files.filter(file => file.role === 'asset').map(file => ({
    id: file.asset!.id, siteId: original.provenance.sourceId, name: file.asset!.name, type: file.mediaType,
    w: file.asset!.width, h: file.asset!.height, bytes: new Uint8Array(original.files.get(file.path)!)
  }));
  const rebuilt = createSitePackage({ document, assets, provenance: original.provenance });
  expect(rebuilt.sha256).toBe('0231380dc63eafbb555351c599896369033525f27b1885ca2ab4ae284be36b74');
  expect(rebuilt.bytes).toEqual(bytes);
});


test('connected release selects schema 17 for default accordion motion and rejects an unreviewed future schema', () => {
  const doc = current(); doc.pages[0].tree = [Core.N('accordion')];
  doc.meta.font = ''; doc.meta.headFont = '';
  for (const style of doc.meta.tokens?.text || []) {
    for (const breakpoint of ['d', 't', 'm'] as const) delete style.css[breakpoint]['font-family'];
  }
  const files = renderSite(doc).files;
  const built = buildReleaseArtifact({ releaseId: 'release-review', siteId: 'portable-check', sourceVersion: 1, document: doc, files });
  expect(built.artifact.schemaVersion).toBe(17);
  expect(built.artifact.rendererVersion).toBe('pagecraft-core-17');
  expect(built.artifact.routes[0].runtime).toContain('data-pc-accordion-motion');
  const input = { releaseId: 'release-review', siteId: 'portable-check', sequence: 1, sourceVersion: 1,
    schemaVersion: 17, parentReleaseId: null, createdAt: '2026-11-14T00:00:00.000Z',
    audit: { acknowledgeWarnings: false, warningCodes: [], warningCount: 0, errorCodes: [], errorCount: 0 }, built };
  const manifest = manifestForRelease(input);
  expect(manifest.schemaVersion).toBe(17);
  expect(manifest.requirements.plugin).toBe('>=0.2.2');
  const legacy = current(); legacy.schemaVersion = 14; legacy.meta.font = ''; legacy.meta.headFont = '';
  for (const style of legacy.meta.tokens?.text || []) {
    for (const breakpoint of ['d', 't', 'm'] as const) delete style.css[breakpoint]['font-family'];
  }
  const legacyBuilt = buildReleaseArtifact({ releaseId: 'legacy-review', siteId: 'portable-check', sourceVersion: 1, document: legacy, files: renderSite(legacy).files });
  expect(manifestForRelease({ ...input, releaseId: 'legacy-review', schemaVersion: 14, built: legacyBuilt }).requirements.plugin).toBe('>=0.1.0');
  expect(() => manifestForRelease({ ...input, schemaVersion: 18 })).toThrow(/reviewed schema-17/);
  expect(() => manifestForRelease({ ...input, schemaVersion: 15 })).toThrow(/unsupported renderer contract/);
});
