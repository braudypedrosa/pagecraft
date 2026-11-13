import { test } from 'vitest';
import a from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFile, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import * as Core from '../../app/src/core/index.ts';
import {
  portableRendererRevisionForSchema, portableRendererVersionForSchema, supportsPortableRendererContract,
} from '../../app/src/package/renderer-version.ts';
import type { PortablePackageManifestV1 } from '../../app/src/package/types.ts';
import { blankDoc } from '../src/render.ts';
import { canonicalJson } from '../src/releases.ts';
import { createPortableZip, extractPortableZip } from '../src/portable-zip.ts';
import { createPagePackage, createSitePackage, validatePortablePackage } from '../src/portable-packages.ts';
import { validateNativeTabRelations } from '../src/template-draft-validation.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const json = (value: unknown) => encoder.encode(canonicalJson(value));

test('portable renderer revision is independent, legacy-compatible, and fails unknown revisions closed', () => {
  const rendererVersion = portableRendererVersionForSchema(Core.SCHEMA);
  const currentRevision = portableRendererRevisionForSchema(Core.SCHEMA);
  a.equal(supportsPortableRendererContract(rendererVersion, currentRevision, Core.SCHEMA, Core.SCHEMA), true);
  a.equal(supportsPortableRendererContract(rendererVersion, 'pagecraft-renderer-1', Core.SCHEMA, Core.SCHEMA), Core.SCHEMA < 15);
  a.equal(supportsPortableRendererContract(rendererVersion, undefined, Core.SCHEMA, Core.SCHEMA), Core.SCHEMA < 15);
  a.equal(supportsPortableRendererContract(rendererVersion, 'pagecraft-renderer-2', Core.SCHEMA, Core.SCHEMA), Core.SCHEMA < 15);
  a.equal(supportsPortableRendererContract(rendererVersion, 'pagecraft-renderer-5', Core.SCHEMA, Core.SCHEMA), false);
  a.equal(supportsPortableRendererContract('pagecraft-core-14', 'pagecraft-renderer-2', 14, Core.SCHEMA), true);
  a.equal(supportsPortableRendererContract('pagecraft-core-14', undefined, 14, Core.SCHEMA), true);
  a.equal(supportsPortableRendererContract('pagecraft-core-15', 'pagecraft-renderer-2', 15, Core.SCHEMA), false);
  a.equal(supportsPortableRendererContract('pagecraft-core-15', 'pagecraft-renderer-3', 15, 15), true);
  a.equal(supportsPortableRendererContract('pagecraft-core-15', 'pagecraft-renderer-3', 15, 14), false);
  a.equal(supportsPortableRendererContract('pagecraft-core-16', 'pagecraft-renderer-3', 16, Core.SCHEMA), true);
  a.equal(supportsPortableRendererContract('pagecraft-core-16', 'pagecraft-renderer-4', 16, Core.SCHEMA), false);
  a.equal(supportsPortableRendererContract('pagecraft-core-17', 'pagecraft-renderer-4', 17, Core.SCHEMA), true);
  a.equal(supportsPortableRendererContract('pagecraft-core-17', 'pagecraft-renderer-3', 17, Core.SCHEMA), false);
  a.equal(supportsPortableRendererContract('pagecraft-core-17', 'pagecraft-renderer-4', 17, 16), false);
  a.equal(supportsPortableRendererContract('pagecraft-renderer-1', undefined, Core.SCHEMA, Core.SCHEMA), false);
  a.equal(supportsPortableRendererContract(`pagecraft-core-${Core.SCHEMA - 1}`, undefined, Core.SCHEMA, Core.SCHEMA), false);

  const built = createSitePackage({
    document: blankDoc('Renderer contract'),
    provenance: {
      format: 'pagecraft.provenance.v1', origin: 'pagecraft-cloud', sourceId: 'renderer-contract', sourceVersion: 1,
    },
  });
  // An inherited-only site uses the reviewed schema-14 transport understood by installed
  // WordPress readers. The current editor adopts that portable document back to its schema.
  const transportSchema = 14;
  const transportRenderer = portableRendererVersionForSchema(transportSchema);
  a.equal(built.manifest.schemaVersion, transportSchema);
  a.equal(built.manifest.rendererVersion, transportRenderer);
  a.equal(built.manifest.rendererRevision, portableRendererRevisionForSchema(transportSchema));
  a.equal(supportsPortableRendererContract(transportRenderer, built.manifest.rendererRevision, transportSchema, 14), true);
  a.equal(validatePortablePackage(built.bytes).document.schemaVersion, Core.SCHEMA);
  const files = extractPortableZip(built.bytes);
  const transported = JSON.parse(decoder.decode(files.get('source/document.json')!));
  a.equal(transported.schemaVersion, transportSchema);
  a.ok(transported.pages.every((page: Record<string, unknown>) => !('header' in page) && !('footer' in page)));
  const manifest = JSON.parse(decoder.decode(files.get('manifest.json')!)) as PortablePackageManifestV1;
  manifest.rendererRevision = 'pagecraft-renderer-4';
  files.set('manifest.json', json(manifest));
  const unsupported = createPortableZip([...files].map(([path, bytes]) => ({ path, bytes })));
  a.throws(() => validatePortablePackage(unsupported),
    new RegExp(`unsupported renderer ${transportRenderer} / pagecraft-renderer-4`));
});

test('schema-16 handoffs retain editable tabs at schema 15 and flatten only page-region ownership', () => {
  const doc = blankDoc('Workshop tab handoff');
  const tabs = Core.N('tabs'); Core.enableTabPanels(tabs);
  tabs.children[0].children = [Core.N('heading', { text: 'Workshop panel details' })];
  doc.pages[0].tree = [tabs];
  const provenance = { format: 'pagecraft.provenance.v1' as const, origin: 'pagecraft-cloud' as const,
    sourceId: 'workshop-tabs', sourceVersion: 1 };
  const site = createSitePackage({ document: doc, provenance });
  a.equal(site.manifest.schemaVersion, 15);
  a.equal(site.manifest.rendererRevision, 'pagecraft-renderer-3');
  a.equal(supportsPortableRendererContract(site.manifest.rendererVersion, site.manifest.rendererRevision, 15, 14), false);
  a.equal(supportsPortableRendererContract(site.manifest.rendererVersion, site.manifest.rendererRevision, 15, 15), true);
  const source = validatePortablePackage(site.bytes).document;
  a.equal(source.pages[0].tree[0].children[0].children[0].props.text, 'Workshop panel details');
  doc.pages[0].header = [tabs]; doc.pages[0].tree = []; doc.pages[0].footer = null;
  a.throws(() => createSitePackage({ document: doc, provenance }), /cannot carry per-page/);
  const before = structuredClone(doc);
  const page = createPagePackage({ document: doc, pageId: doc.pages[0].id, provenance });
  a.equal(page.manifest.schemaVersion, 15);
  a.equal(page.manifest.rendererRevision, 'pagecraft-renderer-3');
  const imported = validatePortablePackage(page.bytes);
  const raw = JSON.parse(decoder.decode(imported.files.get('source/document.json')!));
  a.equal(raw.schemaVersion, 15);
  a.equal('header' in raw.pages[0], false);
  a.equal('footer' in raw.pages[0], false);
  a.equal(raw.header[0].children[0].children[0].props.text, 'Workshop panel details');
  a.match(decoder.decode(imported.files.get('compiled/index.html')!), /Workshop panel details/);
  a.deepEqual(doc, before);
});

test('native-tab relation validation also checks custom header and footer trees', () => {
  for (const kind of ['header', 'footer'] as const) {
    const doc = blankDoc('Workshop region tab validation');
    doc.pages[0].tree = [];
    doc.pages[0][kind] = [Core.N('tabs')]; Core.enableTabPanels(doc.pages[0][kind][0]);
    validateNativeTabRelations(doc);
    const malformed = structuredClone(doc);
    const tabs = malformed.pages[0][kind]![0];
    const items = tabs.props.items as Array<{ panelId?: string }>;
    items[1].panelId = items[0].panelId;
    a.throws(() => validateNativeTabRelations(malformed), /unique panel references/);
    a.throws(() => createPagePackage({ document: malformed, pageId: malformed.pages[0].id,
      provenance: { format: 'pagecraft.provenance.v1', origin: 'pagecraft-cloud', sourceId: 'workshop-regions', sourceVersion: 1 } }), /unique panel references/);
  }
});

test('released checks preserve immutable legacy archives while drafts stay reproducible', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const temp = await mkdtemp(resolve(tmpdir(), 'pagecraft-release-check-'));
  const run = (...args: string[]) => execFileSync(
    process.execPath,
    [resolve(temp, 'tools/premade-sites.ts'), ...args],
    { cwd: temp, encoding: 'utf8', stdio: 'pipe' },
  );
  try {
    await mkdir(resolve(temp, 'tools'));
    await mkdir(resolve(temp, 'premade-sites'));
    await copyFile(resolve(root, 'tools/premade-sites.ts'), resolve(temp, 'tools/premade-sites.ts'));
    await copyFile(resolve(root, 'tools/audit-template-library.mjs'), resolve(temp, 'tools/audit-template-library.mjs'));
    await writeFile(resolve(temp, 'package.json'), '{"type":"module"}');
    for (const directory of ['app', 'server', 'node_modules']) {
      await symlink(resolve(root, directory), resolve(temp, directory));
    }
    await symlink(resolve(root, 'premade-sites/lib'), resolve(temp, 'premade-sites/lib'));
    await writeFile(resolve(temp, 'premade-sites/catalog.json'), JSON.stringify({
      format: 'pagecraft.site-template-catalog.v1', templates: [],
    }) + '\n');

    run('scaffold', 'fixture', '1.0.0');
    const directory = resolve(temp, 'premade-sites/fixture/1.0.0');
    const document = blankDoc('Archive Fixture');
    await writeFile(resolve(directory, 'source.ts'), `export function buildTemplateDocument() { return ${JSON.stringify(document)}; }`);
    run('build', 'fixture', '1.0.0');

    const draftAuditPath = resolve(temp, 'draft-audit.json');
    execFileSync(process.execPath, [
      resolve(temp, 'tools/audit-template-library.mjs'),
      '--id', 'fixture', '--version', '1.0.0', '--out', draftAuditPath,
    ], { cwd: temp, encoding: 'utf8', stdio: 'pipe' });
    const draftAudit = JSON.parse(await readFile(draftAuditPath, 'utf8'));
    a.equal(draftAudit.templates[0].artifactState, 'draft');
    a.equal(draftAudit.templates[0].checkCommand.passes, true);
    a.equal(draftAudit.templates[0].checkCommand.rebuildReproducible, true);

    const draft = resolve(directory, 'draft');
    const packagePath = resolve(draft, 'site.pagecraft-site.zip');
    const files = extractPortableZip(new Uint8Array(await readFile(packagePath)));
    const packageManifest = JSON.parse(decoder.decode(files.get('manifest.json')!)) as PortablePackageManifestV1;
    const sourcePath = packageManifest.documentPath;
    const oldDocument = JSON.parse(decoder.decode(files.get(sourcePath)!));
    oldDocument.schemaVersion = 14;
    oldDocument.v = 14;
    await writeFile(resolve(directory, 'source.ts'), `export function buildTemplateDocument() { return ${JSON.stringify(oldDocument)}; }`);
    const oldDocumentBytes = json(oldDocument);
    files.set(sourcePath, oldDocumentBytes);
    const documentEntry = packageManifest.files.find(file => file.path === sourcePath)!;
    documentEntry.bytes = oldDocumentBytes.byteLength;
    documentEntry.sha256 = createHash('sha256').update(oldDocumentBytes).digest('hex');
    packageManifest.schemaVersion = 14;
    packageManifest.rendererVersion = 'pagecraft-core-14';
    packageManifest.rendererRevision = 'pagecraft-renderer-2';
    packageManifest.contentHash = createHash('sha256').update(json(packageManifest.files)).digest('hex');
    files.set('manifest.json', json(packageManifest));
    const legacyBytes = createPortableZip([...files].map(([path, bytes]) => ({ path, bytes })));
    const packageSha256 = createHash('sha256').update(legacyBytes).digest('hex');
    const outerManifest = JSON.parse(await readFile(resolve(draft, 'manifest.json'), 'utf8'));
    outerManifest.packageSha256 = packageSha256;
    await writeFile(packagePath, legacyBytes);
    await writeFile(resolve(draft, 'manifest.json'), JSON.stringify(outerManifest, null, 2) + '\n');
    await rename(packagePath, resolve(directory, 'site.pagecraft-site.zip'));
    await rename(resolve(draft, 'manifest.json'), resolve(directory, 'manifest.json'));
    await writeFile(resolve(temp, 'premade-sites/catalog.json'), JSON.stringify({
      format: 'pagecraft.site-template-catalog.v1', templates: [outerManifest],
    }) + '\n');

    a.match(run('check', 'fixture', '1.0.0'), /released archive integrity and source parity valid; current rebuild differs/);
    a.throws(() => run('check', 'fixture', '1.0.0', '--require-reproducible'), /archive is valid but current rebuild differs/);

    oldDocument.meta.name = 'Changed after release';
    await writeFile(resolve(directory, 'source.ts'), `export function buildTemplateDocument() { return ${JSON.stringify(oldDocument)}; }`);
    a.throws(() => run('check', 'fixture', '1.0.0'), /archived native document differs from source/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}, 30000);

test('template audit accepts exact source candidates and only exact form prerequisites', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const temp = await mkdtemp(resolve(tmpdir(), 'pagecraft-template-audit-'));
  const output = resolve(temp, 'audit.json');
  try {
    execFileSync(process.execPath, [
      resolve(root, 'tools/audit-template-library.mjs'),
      '--id', 'architecture-studio',
      '--version', '1.1.0',
      '--allow-form-no-action', 'contact:cg2-inquiry-form-121',
      '--out', output,
    ], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    const report = JSON.parse(await readFile(output, 'utf8'));
    a.equal(report.templates.length, 1);
    a.equal(report.templates[0].artifactState, 'source-candidate');
    a.equal(report.templates[0].checkCommand.passes, true);
    a.equal(report.templates[0].render.configuredIntegrationFindings.length, 1);
    a.equal(report.summary.renderErrors, 0);

    a.throws(() => execFileSync(process.execPath, [
      resolve(root, 'tools/audit-template-library.mjs'),
      '--id', 'architecture-studio',
      '--version', '1.1.0',
      '--allow-form-no-action', 'contact:*',
      '--out', output,
    ], { cwd: root, encoding: 'utf8', stdio: 'pipe' }), /must identify one exact/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}, 30000);
