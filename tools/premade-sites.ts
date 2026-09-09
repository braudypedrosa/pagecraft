import { mkdir, readFile, readdir, stat, writeFile, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { newWorkflow, promotionFindings, workflowSchema } from '../premade-sites/lib/workflow.ts';
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
  if (id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('invalid template id');
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('invalid template version');
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
    if (!type || !type.startsWith('image/')) throw new Error(`${spec.file} is not a supported image`);
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

async function build(id?: string, version?: string) {
  const directories = await releaseDirectories(id, version);
  if (!directories.length) throw new Error('no configured template releases found');
  for (const directory of directories) {
    if (await exists(resolve(directory, 'manifest.json')) || await exists(resolve(directory, PACKAGE_FILE))) {
      throw new Error(`${relative(root, directory)} is released; scaffold a new version instead`);
    }
    const output = await compile(directory);
    const draft = resolve(directory, 'draft');
    await mkdir(draft, { recursive: true });
    await writeFile(resolve(draft, PACKAGE_FILE), output.built.bytes);
    await writeFile(resolve(draft, 'manifest.json'), `${JSON.stringify(output.manifest, null, 2)}\n`);
    const packaged = validatePortablePackage(output.built.bytes);
    const preview = resolve(draft, 'preview');
    await rm(preview, { recursive: true, force: true });
    for (const file of packaged.manifest.files) {
      // Use the actual package renderer output and assets, not a second HTML implementation.
      if (!['compiled-page', 'compiled-support', 'asset'].includes(file.role)) continue;
      const path = resolve(preview, file.path.replace(/^compiled\//, ''));
      if (!inside(preview, path)) throw new Error('unsafe preview path');
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, packaged.files.get(file.path)!);
    }
    console.log(`draft ${output.config.id}@${output.config.version} ${output.built.sha256} — catalog unchanged`);
  }
}

async function checked(directory: string) {
  const output = await compile(directory);
  const released = await exists(resolve(directory, 'manifest.json'));
  const artifactDirectory = released ? directory : resolve(directory, 'draft');
  const manifest = JSON.parse(await readFile(resolve(artifactDirectory, 'manifest.json'), 'utf8'));
  const packageBytes = new Uint8Array(await readFile(resolve(artifactDirectory, PACKAGE_FILE)));
  const stored = validatePortablePackage(packageBytes);
  if (JSON.stringify(manifest) !== JSON.stringify(output.manifest)) throw new Error(`${output.config.id}@${output.config.version} manifest is stale`);
  if (stored.sha256 !== output.built.sha256) throw new Error(`${output.config.id}@${output.config.version} package is stale`);
  if (!released) for (const file of stored.manifest.files) {
    if (!['compiled-page', 'compiled-support', 'asset'].includes(file.role)) continue;
    const path = resolve(artifactDirectory, 'preview', file.path.replace(/^compiled\//, ''));
    if (!await exists(path) || digest(await readFile(path)) !== digest(stored.files.get(file.path)!)) throw new Error(`preview:${file.path}: missing or changed; rebuild draft`);
  }
  return { ...output, released, artifactDirectory };
}

async function check(id?: string, version?: string) {
  const directories = await releaseDirectories(id, version);
  if (!directories.length) throw new Error('no configured template releases found');
  for (const directory of directories) {
    const output = await checked(directory);
    console.log(`checked ${output.config.id}@${output.config.version} — native document, assets, manifest and package agree (${output.released ? 'released' : 'draft'})`);
  }
}

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function readiness(directory: string, output: Awaited<ReturnType<typeof checked>>) {
  const path = resolve(directory, 'workflow.json');
  if (!await exists(path)) return { record: null, findings: ['workflow: missing workflow.json'] };
  const record = JSON.parse(await readFile(path, 'utf8'));
  const findings = promotionFindings(record, output.built.sha256, output.document.pages.map(p => p.slug));
  const parsed = workflowSchema.safeParse(record);
  if (parsed.success) {
    const w = parsed.data;
    const refs = [...w.qa.flatMap(q => q.evidence), ...(w.visualReview?.evidence || [])];
    for (const ref of refs) {
      const evidencePath = resolve(directory, ref.path);
      if (!inside(directory, evidencePath)) { findings.push(`evidence:${ref.path}: outside template directory`); continue; }
      if (!await exists(evidencePath) || digest(await readFile(evidencePath)) !== ref.sha256) findings.push(`evidence:${ref.path}: missing or changed`);
    }
  }
  return { record, findings };
}

async function status(id?: string, version?: string) {
  for (const directory of await releaseDirectories(id, version)) {
    try {
      const output = await checked(directory);
      const review = output.released ? { findings: [] } : await readiness(directory, output);
      console.log(JSON.stringify({ id: output.config.id, version: output.config.version, packageSha256: output.built.sha256, status: output.released ? 'released' : review.findings.length ? 'revision' : 'ready', findings: review.findings }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({ directory: relative(root, directory), status: 'unbuilt-or-stale', findings: [String(error)] }, null, 2));
    }
  }
}

async function promote(id?: string, version?: string) {
  if (!id || !version) throw new Error('promote requires an exact id and version');
  const [directory] = await releaseDirectories(id, version);
  const output = await checked(directory);
  if (output.released || await exists(resolve(directory, PACKAGE_FILE))) throw new Error('released versions are immutable');
  const review = await readiness(directory, output);
  if (review.findings.length) throw new Error(`promotion blocked:\n${review.findings.join('\n')}`);
  // Exclusive lock serializes catalog read/modify/write across template promotions.
  const lock = resolve(templateRoot, '.promotion-lock');
  await mkdir(lock);
  const created: string[] = [];
  try {
    const catalogPath = resolve(templateRoot, 'catalog.json');
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    if (catalog.templates.some((t: { id: string; version: string }) => t.id === id && t.version === version)) throw new Error('catalog already contains this release');
    await writeFile(resolve(directory, PACKAGE_FILE), output.built.bytes, { flag: 'wx' });
    created.push(resolve(directory, PACKAGE_FILE));
    await writeFile(resolve(directory, 'release-review.json'), `${JSON.stringify(review.record, null, 2)}\n`, { flag: 'wx' });
    created.push(resolve(directory, 'release-review.json'));
    await writeFile(resolve(directory, 'manifest.json'), `${JSON.stringify(output.manifest, null, 2)}\n`, { flag: 'wx' });
    created.push(resolve(directory, 'manifest.json'));
    catalog.templates.push(output.manifest);
    const temporary = resolve(lock, 'catalog.json');
    await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
    await rename(temporary, catalogPath);
  } catch (error) {
    for (const path of created.reverse()) await rm(path, { force: true });
    throw error;
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
  console.log(`promoted ${id}@${version} locally — no deployment performed`);
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
  await writeFile(resolve(directory, 'workflow.json'), `${JSON.stringify(newWorkflow(), null, 2)}\n`);
  await writeFile(resolve(directory, 'source.ts'), `import type { Doc } from '../../../app/src/core/types.ts';\nimport { buildTemplateStarter } from '../../lib/authoring.ts';\n\n/** Replace the empty page with this release's intentional, native Pagecraft composition. */\nexport function buildTemplateDocument(): Doc {\n  return buildTemplateStarter(${JSON.stringify(probe.sampleName)});\n}\n`);
  console.log(`scaffolded ${relative(root, directory)}`);
  console.log(`next: author source.ts, add assets to ${CONFIG_FILE}, then run npm run template -- build ${id} ${version}`);
}

const [command = 'build', id, version] = process.argv.slice(2).filter(value => !value.startsWith('--'));
if (command === 'scaffold') await scaffold(id, version);
else if (command === 'build') await build(id, version);
else if (command === 'check') await check(id, version);
else if (command === 'status') await status(id, version);
else if (command === 'promote') await promote(id, version);
else throw new Error('usage: npm run template -- <scaffold|build|check|status|promote> [id] [version]');
