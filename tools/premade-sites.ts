import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import type { Doc } from '../app/src/core/types.ts';
import {
  assertTemplateDocument,
  TEMPLATE_SOURCE_FORMAT,
  validateTemplateSourceConfig,
  type TemplateSourceConfig,
} from '../premade-sites/lib/authoring.ts';
import { dimensions, sniff, type Asset } from '../server/src/assets.ts';
import { createSitePackage, validatePortablePackage } from '../server/src/portable-packages.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = resolve(root, 'premade-sites');
const CONFIG_FILE = 'template.config.json';
const PACKAGE_FILE = 'site.pagecraft-site.zip';

const inside = (parent: string, child: string) => child === parent || child.startsWith(parent + sep);
const titleFromId = (id: string) => id.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');

async function exists(path: string) {
  return stat(path).then(() => true, () => false);
}

async function readConfig(directory: string): Promise<TemplateSourceConfig> {
  const config = validateTemplateSourceConfig(JSON.parse(await readFile(resolve(directory, CONFIG_FILE), 'utf8')));
  if (resolve(templateRoot, config.id, config.version) !== directory) {
    throw new Error(`config id/version does not match ${relative(templateRoot, directory)}`);
  }
  return config;
}

async function releaseDirectories(id?: string, version?: string) {
  if (id && version) return [resolve(templateRoot, id, version)];
  const directories: string[] = [];
  for (const idEntry of await readdir(templateRoot, { withFileTypes: true })) {
    if (!idEntry.isDirectory() || (id && idEntry.name !== id)) continue;
    const idDirectory = resolve(templateRoot, idEntry.name);
    for (const versionEntry of await readdir(idDirectory, { withFileTypes: true })) {
      if (!versionEntry.isDirectory() || !/^\d+\.\d+\.\d+$/.test(versionEntry.name)) continue;
      const directory = resolve(idDirectory, versionEntry.name);
      if (await exists(resolve(directory, CONFIG_FILE))) directories.push(directory);
    }
  }
  return directories.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function compile(directory: string) {
  const config = await readConfig(directory);
  const sourcePath = resolve(directory, config.source);
  if (!inside(directory, sourcePath)) throw new Error('template source escaped its release directory');
  const module = await import(`${pathToFileURL(sourcePath).href}?build=${Date.now()}`) as Record<string, unknown>;
  const factory = module[config.sourceExport];
  if (typeof factory !== 'function') throw new Error(`${config.source} does not export ${config.sourceExport}()`);
  const document = await (factory as () => Doc | Promise<Doc>)();
  assertTemplateDocument(document, config);

  const assets: Asset[] = [];
  for (const spec of config.assets) {
    const path = resolve(directory, spec.file);
    if (!inside(resolve(templateRoot, config.id), path)) {
      throw new Error(`asset ${spec.id} escaped template ${config.id}`);
    }
    const bytes = new Uint8Array(await readFile(path));
    const type = sniff(bytes);
    if (!type.startsWith('image/')) throw new Error(`${spec.file} is not a supported image`);
    const { w, h } = dimensions(bytes, type);
    assets.push({ id: spec.id, siteId: `template:${config.id}:${config.version}`, name: path.split(sep).at(-1)!, type, w, h, bytes });
  }

  const built = createSitePackage({
    document,
    assets,
    provenance: {
      format: 'pagecraft.provenance.v1',
      origin: 'pagecraft-cloud',
      sourceId: `template:${config.id}:${config.version}`,
      sourceVersion: 1,
      exportedBy: 'Pagecraft curated templates',
    },
  });
  const manifest = {
    format: 'pagecraft.site-template.v1' as const,
    id: config.id,
    version: config.version,
    name: config.name,
    sampleName: config.sampleName,
    description: config.description,
    categories: config.categories,
    pages: document.pages.map(page => ({ id: page.id, name: page.name, slug: page.slug })),
    packageFile: PACKAGE_FILE,
    packageSha256: built.sha256,
    previewPage: config.previewPage,
    assetCount: assets.length,
    assetBytes: assets.reduce((sum, asset) => sum + asset.bytes.byteLength, 0),
  };
  return { config, document, assets, built, manifest };
}

async function rebuildCatalog() {
  const templates: unknown[] = [];
  for (const idEntry of await readdir(templateRoot, { withFileTypes: true })) {
    if (!idEntry.isDirectory()) continue;
    const idDirectory = resolve(templateRoot, idEntry.name);
    for (const versionEntry of await readdir(idDirectory, { withFileTypes: true })) {
      if (!versionEntry.isDirectory() || !/^\d+\.\d+\.\d+$/.test(versionEntry.name)) continue;
      const manifestPath = resolve(idDirectory, versionEntry.name, 'manifest.json');
      if (await exists(manifestPath)) templates.push(JSON.parse(await readFile(manifestPath, 'utf8')));
    }
  }
  templates.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))
    || String(a.version).localeCompare(String(b.version), undefined, { numeric: true }));
  await writeFile(resolve(templateRoot, 'catalog.json'), `${JSON.stringify({
    format: 'pagecraft.site-template-catalog.v1', templates,
  }, null, 2)}\n`);
}

async function build(id?: string, version?: string) {
  const directories = await releaseDirectories(id, version);
  if (!directories.length) throw new Error('no configured template releases found');
  for (const directory of directories) {
    const output = await compile(directory);
    await writeFile(resolve(directory, PACKAGE_FILE), output.built.bytes);
    await writeFile(resolve(directory, 'manifest.json'), `${JSON.stringify(output.manifest, null, 2)}\n`);
    console.log(`built ${output.config.id}@${output.config.version} ${output.built.sha256} ${output.built.bytes.byteLength} bytes`);
  }
  await rebuildCatalog();
}

async function check(id?: string, version?: string) {
  const directories = await releaseDirectories(id, version);
  if (!directories.length) throw new Error('no configured template releases found');
  for (const directory of directories) {
    const output = await compile(directory);
    const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    const packageBytes = new Uint8Array(await readFile(resolve(directory, PACKAGE_FILE)));
    const stored = validatePortablePackage(packageBytes);
    if (JSON.stringify(manifest) !== JSON.stringify(output.manifest)) throw new Error(`${output.config.id}@${output.config.version} manifest is stale; run build`);
    if (stored.sha256 !== output.built.sha256) throw new Error(`${output.config.id}@${output.config.version} package is stale; run build`);
    console.log(`checked ${output.config.id}@${output.config.version} — native document, assets, manifest and package agree`);
  }
}

const option = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
};

async function scaffold(id: string | undefined, version: string | undefined) {
  if (!id || !version) throw new Error('usage: npm run template -- scaffold <id> <version> [--name=Name]');
  const directory = resolve(templateRoot, id, version);
  const probe = validateTemplateSourceConfig({
    format: TEMPLATE_SOURCE_FORMAT,
    id,
    version,
    name: option('name') || titleFromId(id),
    sampleName: option('sample-name') || titleFromId(id),
    description: option('description') || `A Pagecraft-curated ${titleFromId(id)} site.`,
    categories: (option('categories') || 'General').split(',').map(value => value.trim()).filter(Boolean),
    source: 'source.ts',
    sourceExport: 'buildTemplateDocument',
    previewPage: 'index.html',
    assets: [],
    customCssPolicy: 'native-only',
  });
  if (await exists(directory)) throw new Error(`${relative(root, directory)} already exists; nothing was overwritten`);
  await mkdir(resolve(directory, 'assets'), { recursive: true });
  await writeFile(resolve(directory, CONFIG_FILE), `${JSON.stringify(probe, null, 2)}\n`);
  await writeFile(resolve(directory, 'source.ts'), `import type { Doc } from '../../../app/src/core/types.ts';\nimport { buildTemplateStarter } from '../../lib/authoring.ts';\n\n/** Replace the empty page with this release's intentional, native Pagecraft composition. */\nexport function buildTemplateDocument(): Doc {\n  return buildTemplateStarter(${JSON.stringify(probe.sampleName)});\n}\n`);
  console.log(`scaffolded ${relative(root, directory)}`);
  console.log(`next: author source.ts, add assets to ${CONFIG_FILE}, then run npm run template -- build ${id} ${version}`);
}

const [command = 'build', id, version] = process.argv.slice(2).filter(value => !value.startsWith('--'));
if (command === 'scaffold') await scaffold(id, version);
else if (command === 'build') await build(id, version);
else if (command === 'check') await check(id, version);
else throw new Error('usage: npm run template -- <scaffold|build|check> [id] [version]');
