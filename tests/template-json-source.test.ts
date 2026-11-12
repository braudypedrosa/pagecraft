import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as Core from '../app/src/core/index.ts';
import { createSitePackage } from '../server/src/portable-packages.ts';
import { canonicalJson } from '../server/src/releases.ts';
import {
  assertTemplateDocument,
  TEMPLATE_SOURCE_FORMAT,
  validateTemplateSourceConfig,
} from '../premade-sites/lib/authoring.ts';
import type { Doc } from '../app/src/core/types.ts';

const root = resolve(import.meta.dirname, '..');
const createdTemplateDirs: string[] = [];
afterEach(async () => {
  await Promise.all(createdTemplateDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

const shared = {
  format: TEMPLATE_SOURCE_FORMAT,
  id: 'workshop-site',
  version: '1.0.0',
  name: 'Workshop Site',
  sampleName: 'Workshop',
  description: 'A neutral workshop example site.',
  categories: ['Workshop'],
  previewPage: 'index.html',
  assets: [],
  customCssPolicy: 'native-only',
};

describe('declarative template sources', () => {
  it('keeps legacy TypeScript factory configs valid', () => {
    const config = validateTemplateSourceConfig({
      ...shared,
      source: 'source.ts',
      sourceExport: 'buildTemplateDocument',
    });
    expect(config.sourceKind).toBeUndefined();
    expect(config.sourceExport).toBe('buildTemplateDocument');
  });

  it('validates the explicit JSON source mode and rejects executable fields', () => {
    const config = validateTemplateSourceConfig({
      ...shared,
      sourceKind: 'document-json-v1',
      source: 'document.json',
    });
    expect(config.sourceKind).toBe('document-json-v1');
    expect(() => validateTemplateSourceConfig({
      ...shared,
      sourceKind: 'document-json-v1',
      source: 'document.json',
      sourceExport: 'buildTemplateDocument',
    })).toThrow('does not support sourceExport');
    expect(() => validateTemplateSourceConfig({
      ...shared,
      sourceKind: 'document-json-v1',
      source: '../source.ts',
    })).toThrow('source must be document.json');
    expect(() => assertTemplateDocument({} as Doc, config)).toThrow('document:missing-pages');
  });

  it('imports a portable package into a hash-matched JSON draft without catalog changes', async () => {
    Core.seed();
    Core.blankProject('Workshop');
    const document = JSON.parse(canonicalJson(structuredClone(Core.doc())));
    const provenance = {
      format: 'pagecraft.provenance.v1' as const,
      origin: 'pagecraft-cloud' as const,
      sourceId: 'workshop-example',
      sourceVersion: 1,
    };
    const pkg = createSitePackage({ document, provenance });
    const temp = await mkdtemp(resolve(tmpdir(), 'pagecraft-template-import-'));
    const archive = resolve(temp, 'site.zip');
    await writeFile(archive, pkg.bytes);

    const id = `template-import-check-${process.pid}`;
    const version = '1.0.0';
    const templateDir = resolve(root, 'premade-sites', id, version);
    createdTemplateDirs.push(resolve(root, 'premade-sites', id));
    const catalogBefore = await readFile(resolve(root, 'premade-sites/catalog.json'), 'utf8');
    try {
      execFileSync(process.execPath, [
        resolve(root, 'tools/premade-sites.ts'), 'import-draft', id, version,
        `--package=${archive}`,
        '--name=Workshop Site',
        '--sample-name=Workshop',
        '--description=A neutral workshop example site.',
        '--categories=Workshop',
      ], { cwd: root, stdio: 'pipe' });

      const config = JSON.parse(await readFile(resolve(templateDir, 'template.config.json'), 'utf8'));
      const source = JSON.parse(await readFile(resolve(templateDir, 'document.json'), 'utf8'));
      const draft = JSON.parse(await readFile(resolve(templateDir, 'draft/manifest.json'), 'utf8'));
      expect(config.sourceKind).toBe('document-json-v1');
      expect(config).not.toHaveProperty('sourceExport');
      expect(config.importedPackageSha256).toBe(pkg.sha256);
      expect(source.pages).toHaveLength(1);
      expect(draft.packageSha256).toBe(pkg.sha256);
      expect(await readFile(resolve(root, 'premade-sites/catalog.json'), 'utf8')).toBe(catalogBefore);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
