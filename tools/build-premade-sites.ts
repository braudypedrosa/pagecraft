import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dimensions, sniff, type Asset } from '../server/src/assets.ts';
import { createSitePackage } from '../server/src/portable-packages.ts';
import { buildIndependentStudioDocument } from '../premade-sites/independent-studio/2.0.4/source.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = resolve(root, 'premade-sites');
const templateId = 'independent-studio';
const version = '2.0.4';
const directory = resolve(templateRoot, templateId, version);
const assetDirectory = resolve(templateRoot, templateId, '2.0.0', 'assets');
const assetSpecs = [
  ['northline-system-hero', 'hero-studio-system.webp'],
  ['northline-identity-artifacts', 'identity-artifacts.webp'],
  ['northline-digital-prototype', 'digital-prototype.webp'],
  ['northline-editorial-production', 'editorial-production.webp'],
  ['northline-closing-studio', 'closing-studio.webp']
] as const;

const assets: Asset[] = [];
for (const [id, name] of assetSpecs) {
  const bytes = new Uint8Array(await readFile(resolve(assetDirectory, name)));
  const type = sniff(bytes);
  if (type !== 'image/webp') throw new Error(`${name} is not a WebP image`);
  const { w, h } = dimensions(bytes, type);
  assets.push({ id, siteId: `template:${templateId}:${version}`, name, type, w, h, bytes });
}

const document = buildIndependentStudioDocument();
const built = createSitePackage({
  document,
  assets,
  provenance: {
    format: 'pagecraft.provenance.v1',
    origin: 'pagecraft-cloud',
    sourceId: `template:${templateId}:${version}`,
    sourceVersion: 1,
    exportedBy: 'Pagecraft curated templates'
  }
});

const manifest = {
  format: 'pagecraft.site-template.v1',
  id: templateId,
  version,
  name: 'Independent Studio',
  sampleName: 'Northline Studio',
  description: 'A high-contrast four-page studio system for independent creative practices.',
  categories: ['Studio', 'Services', 'Creative'],
  pages: document.pages.map(page => ({ id: page.id, name: page.name, slug: page.slug })),
  packageFile: 'site.pagecraft-site.zip',
  packageSha256: built.sha256,
  previewPage: 'index.html',
  assetCount: assets.length,
  assetBytes: assets.reduce((sum, asset) => sum + asset.bytes.byteLength, 0)
};

await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, manifest.packageFile), built.bytes);
await writeFile(resolve(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const catalogTemplates: Array<typeof manifest> = [];
for (const idEntry of await readdir(templateRoot, { withFileTypes: true })) {
  if (!idEntry.isDirectory()) continue;
  const idDirectory = resolve(templateRoot, idEntry.name);
  for (const versionEntry of await readdir(idDirectory, { withFileTypes: true })) {
    if (!versionEntry.isDirectory() || !/^\d+\.\d+\.\d+$/.test(versionEntry.name)) continue;
    try {
      catalogTemplates.push(JSON.parse(await readFile(
        resolve(idDirectory, versionEntry.name, 'manifest.json'),
        'utf8'
      )));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
catalogTemplates.sort((a, b) => String(a.id).localeCompare(String(b.id))
  || String(a.version).localeCompare(String(b.version), undefined, { numeric: true }));
await writeFile(resolve(templateRoot, 'catalog.json'), `${JSON.stringify({
  format: 'pagecraft.site-template-catalog.v1',
  templates: catalogTemplates
}, null, 2)}\n`);
console.log(`${manifest.id}@${manifest.version} ${built.sha256} ${built.bytes.byteLength} bytes`);
