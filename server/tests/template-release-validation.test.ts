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
  PORTABLE_RENDERER_REVISION, portableRendererVersionForSchema, supportsPortableRendererContract,
} from '../../app/src/package/renderer-version.ts';
import type { PortablePackageManifestV1 } from '../../app/src/package/types.ts';
import { blankDoc } from '../src/render.ts';
import { canonicalJson } from '../src/releases.ts';
import { createPortableZip, extractPortableZip } from '../src/portable-zip.ts';
import { createSitePackage, validatePortablePackage } from '../src/portable-packages.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const json = (value: unknown) => encoder.encode(canonicalJson(value));

test('portable renderer revision is independent, legacy-compatible, and fails unknown revisions closed', () => {
  const rendererVersion = portableRendererVersionForSchema(Core.SCHEMA);
  a.equal(supportsPortableRendererContract(rendererVersion, PORTABLE_RENDERER_REVISION, Core.SCHEMA, Core.SCHEMA), true);
  a.equal(supportsPortableRendererContract(rendererVersion, undefined, Core.SCHEMA, Core.SCHEMA), true);
  a.equal(supportsPortableRendererContract(rendererVersion, 'pagecraft-renderer-2', Core.SCHEMA, Core.SCHEMA), false);
  a.equal(supportsPortableRendererContract('pagecraft-renderer-1', undefined, Core.SCHEMA, Core.SCHEMA), false);
  a.equal(supportsPortableRendererContract(`pagecraft-core-${Core.SCHEMA - 1}`, undefined, Core.SCHEMA, Core.SCHEMA), false);

  const built = createSitePackage({
    document: blankDoc('Renderer contract'),
    provenance: {
      format: 'pagecraft.provenance.v1', origin: 'pagecraft-cloud', sourceId: 'renderer-contract', sourceVersion: 1,
    },
  });
  a.equal(built.manifest.rendererVersion, rendererVersion);
  a.equal(built.manifest.rendererRevision, PORTABLE_RENDERER_REVISION);
  const files = extractPortableZip(built.bytes);
  const manifest = JSON.parse(decoder.decode(files.get('manifest.json')!)) as PortablePackageManifestV1;
  manifest.rendererRevision = 'pagecraft-renderer-2';
  files.set('manifest.json', json(manifest));
  const unsupported = createPortableZip([...files].map(([path, bytes]) => ({ path, bytes })));
  a.throws(() => validatePortablePackage(unsupported), /unsupported renderer pagecraft-core-13 \/ pagecraft-renderer-2/);
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
    packageManifest.rendererVersion = `pagecraft-core-${packageManifest.schemaVersion}`;
    delete packageManifest.rendererRevision;
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

    document.meta.name = 'Changed after release';
    await writeFile(resolve(directory, 'source.ts'), `export function buildTemplateDocument() { return ${JSON.stringify(document)}; }`);
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
