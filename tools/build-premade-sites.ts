import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dimensions, sniff, type Asset } from '../server/src/assets.ts';
import { createSitePackage } from '../server/src/portable-packages.ts';
import { buildIndependentStudioDocument } from '../premade-sites/independent-studio/1.0.0/source.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = resolve(root, 'premade-sites');
const directory = resolve(templateRoot, 'independent-studio', '1.0.0');
const assetSpecs = [
  ['northline-hero', 'hero.webp'],
  ['northline-about', 'about.webp'],
  ['northline-services', 'services.webp'],
  ['northline-contact', 'contact.webp']
] as const;

const assets: Asset[] = [];
for (const [id, name] of assetSpecs) {
  const bytes = new Uint8Array(await readFile(resolve(directory, 'assets', name)));
  const type = sniff(bytes);
  if (type !== 'image/webp') throw new Error(`${name} is not a WebP image`);
  const { w, h } = dimensions(bytes, type);
  assets.push({ id, siteId: 'template:independent-studio:1.0.0', name, type, w, h, bytes });
}

const document = buildIndependentStudioDocument();
const built = createSitePackage({
  document,
  assets,
  provenance: {
    format: 'pagecraft.provenance.v1',
    origin: 'pagecraft-cloud',
    sourceId: 'template:independent-studio:1.0.0',
    sourceVersion: 1,
    exportedBy: 'Pagecraft curated templates'
  }
});

const manifest = {
  format: 'pagecraft.site-template.v1',
  id: 'independent-studio',
  version: '1.0.0',
  name: 'Independent Studio',
  sampleName: 'Northline Studio',
  description: 'An editorial four-page site for independent studios and thoughtful service businesses.',
  categories: ['Studio', 'Services', 'Editorial'],
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
await writeFile(resolve(templateRoot, 'catalog.json'), `${JSON.stringify({
  format: 'pagecraft.site-template-catalog.v1',
  templates: [manifest]
}, null, 2)}\n`);
console.log(`${manifest.id}@${manifest.version} ${built.sha256} ${built.bytes.byteLength} bytes`);

