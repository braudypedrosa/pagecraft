import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { assetFile } from '../app/src/core/index.ts';
import { assertTemplateDocument, validateTemplateSourceConfig } from '../premade-sites/lib/authoring.ts';
import { dimensions, sniff } from '../server/src/assets.ts';
import { createSitePackage, validatePortablePackage } from '../server/src/portable-packages.ts';
import { canonicalJson } from '../server/src/releases.ts';
import { renderSite } from '../server/src/render.ts';
import { FileSiteTemplateStore, latestSiteTemplates } from '../server/src/site-templates.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = resolve(root, 'premade-sites');
const defaultOutput = resolve(root, 'qa-evidence/template-library-2026-10-08/package-audit.json');
const encoder = new TextEncoder();
const argumentsList = process.argv.slice(2);
const usage = 'Usage: node tools/audit-template-library.mjs [--id <id> --version <version>] [--out <path>] [--allow-form-no-action <id@version:slug:nodeId>]';
if (argumentsList.includes('--help') || argumentsList.includes('-h')) {
  console.log(usage);
  process.exit(0);
}
// Reject misspelled or incomplete options before the default audit file can be written.
const supportedOptions = new Set(['--id', '--version', '--out', '--allow-form-no-action']);
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  const name = argument.split('=', 1)[0];
  if (!supportedOptions.has(name)) throw new Error(`Unknown option: ${argument}. ${usage}`);
  const value = argument.includes('=') ? argument.slice(argument.indexOf('=') + 1) : argumentsList[++index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}. ${usage}`);
}
const argumentValues = name => argumentsList.flatMap((value, index) => {
  if (value === `--${name}` && argumentsList[index + 1]) return [argumentsList[index + 1]];
  if (value.startsWith(`--${name}=`)) return [value.slice(name.length + 3)];
  return [];
});
const argumentValue = name => argumentValues(name).at(-1);
const requestedId = argumentValue('id');
const requestedVersion = argumentValue('version');
const exists = path => stat(path).then(() => true, () => false);

if (requestedVersion && !requestedId) throw new Error('--version requires --id');
if (requestedId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedId)) throw new Error('--id must be a lowercase hyphenated segment');
if (requestedVersion && !/^\d+\.\d+\.\d+$/.test(requestedVersion)) throw new Error('--version must use semver x.y.z');

const configuredFormPrerequisites = new Set([
  'architecture-studio@1.0.0:contact:cg-inquiry-form-33',
  'coastal-rentals@1.0.4:contact:marea-node-0425',
  'salt-house@1.0.0:plan-your-stay:salt-stay-inquiry-209',
  'stillwood@1.0.0:index:stillwood-stay-form-51',
  'stillwood@1.0.0:the-a-frame:stillwood-stay-form-238',
  'stillwood@1.0.0:waterline:stillwood-stay-form-273',
  'stillwood@1.0.0:meadow-house:stillwood-stay-form-308',
  'stillwood@1.0.0:contact:stillwood-stay-form-438',
]);
for (const value of argumentValues('allow-form-no-action')) {
  const full = value.includes('@') ? value
    : requestedId && requestedVersion ? `${requestedId}@${requestedVersion}:${value}` : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*@\d+\.\d+\.\d+:[a-z0-9]+(?:-[a-z0-9]+)*:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(full)) {
    throw new Error('--allow-form-no-action must identify one exact id@version:slug:nodeId (or slug:nodeId with exact --id and --version)');
  }
  configuredFormPrerequisites.add(full);
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonDigest = value => digest(encoder.encode(canonicalJson(value)));
const inside = (parent, child) => child === parent || child.startsWith(parent + sep);
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const isPlaceholderHostname = hostname => {
  const value = hostname.toLowerCase().replace(/\.$/, '');
  return ['example.com', 'example.net', 'example.org'].some(
    domain => value === domain || value.endsWith(`.${domain}`),
  ) || ['example', 'invalid', 'test'].some(
    suffix => value === suffix || value.endsWith(`.${suffix}`),
  );
};
const isPlaceholderTarget = href => {
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return isPlaceholderHostname(url.hostname);
    }
    if (url.protocol === 'mailto:') {
      const address = decodeURIComponent(url.pathname).split(',')[0]?.trim() || '';
      const separator = address.lastIndexOf('@');
      return separator >= 0 && isPlaceholderHostname(address.slice(separator + 1));
    }
  } catch {}
  return false;
};

const valueDiff = (archived, current) => {
  const keys = new Set([...Object.keys(archived || {}), ...Object.keys(current || {})]);
  return [...keys].sort().flatMap(key => same(archived?.[key], current?.[key]) ? [] : [{
    field: key,
    archived: archived?.[key] ?? null,
    current: current?.[key] ?? null,
  }]);
};

const packageManifestDiff = (archived, current) => {
  const archivedFiles = new Map(archived.files.map(file => [file.path, file]));
  const currentFiles = new Map(current.files.map(file => [file.path, file]));
  const paths = new Set([...archivedFiles.keys(), ...currentFiles.keys()]);
  return {
    topLevel: valueDiff(
      Object.fromEntries(Object.entries(archived).filter(([key]) => key !== 'files')),
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'files')),
    ),
    files: [...paths].sort().flatMap(path => {
      const before = archivedFiles.get(path);
      const after = currentFiles.get(path);
      if (!before) return [{ path, status: 'added', fields: [] }];
      if (!after) return [{ path, status: 'removed', fields: [] }];
      const fields = valueDiff(before, after);
      return fields.length ? [{ path, status: 'changed', fields }] : [];
    }),
  };
};

const textLineDelta = (archivedBytes, currentBytes) => {
  const count = bytes => {
    const lines = new Map();
    for (const line of new TextDecoder().decode(bytes).split('\n')) lines.set(line, (lines.get(line) || 0) + 1);
    return lines;
  };
  const archived = count(archivedBytes);
  const current = count(currentBytes);
  const changed = (left, right) => [...left].sort(([a], [b]) => a.localeCompare(b)).flatMap(([line, total]) => {
    const difference = total - (right.get(line) || 0);
    return difference > 0 ? [{ line, occurrences: difference }] : [];
  });
  return { removed: changed(archived, current), added: changed(current, archived) };
};

const templateManifest = (config, document, assets, packageSha256) => ({
  format: 'pagecraft.site-template.v1',
  id: config.id,
  version: config.version,
  name: config.name,
  sampleName: config.sampleName,
  description: config.description,
  categories: config.categories,
  pages: document.pages.map(page => ({ id: page.id, name: page.name, slug: page.slug })),
  packageFile: 'site.pagecraft-site.zip',
  packageSha256,
  previewPage: config.previewPage,
  assetCount: assets.length,
  assetBytes: assets.reduce((total, asset) => total + asset.bytes.byteLength, 0),
});

const sourceOutput = async directory => {
  const config = validateTemplateSourceConfig(JSON.parse(await readFile(resolve(directory, 'template.config.json'), 'utf8')));
  const sourcePath = resolve(directory, config.source);
  if (!inside(directory, sourcePath)) throw new Error(`${config.id} source escaped its release directory`);
  const source = await import(`${pathToFileURL(sourcePath).href}?audit=${Date.now()}`);
  const factory = source[config.sourceExport];
  if (typeof factory !== 'function') throw new Error(`${config.source} does not export ${config.sourceExport}()`);
  const document = await factory();
  assertTemplateDocument(document, config);
  const assets = [];
  for (const spec of config.assets) {
    const path = resolve(directory, spec.file);
    if (!inside(resolve(templateRoot, config.id), path)) throw new Error(`${spec.id} escaped template ${config.id}`);
    const bytes = new Uint8Array(await readFile(path));
    const type = sniff(bytes);
    if (!type?.startsWith('image/')) throw new Error(`${spec.file} is not a supported image`);
    const { w, h } = dimensions(bytes, type);
    assets.push({ id: spec.id, siteId: `template:${config.id}:${config.version}`, name: path.split(sep).at(-1), type, w, h, bytes });
  }
  const provenance = {
    format: 'pagecraft.provenance.v1',
    origin: 'pagecraft-cloud',
    sourceId: `template:${config.id}:${config.version}`,
    sourceVersion: 1,
    exportedBy: 'Pagecraft curated templates',
  };
  const built = createSitePackage({ document, assets, provenance });
  const validated = validatePortablePackage(built.bytes);
  const manifest = templateManifest(config, validated.document, assets, built.sha256);
  return { config, assets, provenance, built, validated, manifest };
};

const auditRender = (templateId, templateVersion, rendered, assets) => {
  const html = [...rendered.files].filter(([path]) => path.endsWith('.html'));
  const documents = new Map(html.map(([path, source]) => [path, new JSDOM(source).window.document]));
  const pagePaths = new Set(documents.keys());
  const expectedAssets = new Set(assets.map(asset => assetFile(asset)));
  const referencedAssets = new Set();
  const linkErrors = [];
  const externalLinks = new Set();
  let checkedLinks = 0;

  for (const [path, source] of html) {
    for (const match of source.matchAll(/assets\/[A-Za-z0-9._/-]+/g)) referencedAssets.add(match[0]);
    const document = documents.get(path);
    for (const anchor of document.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href')?.trim() || '';
      checkedLinks++;
      if (!href) {
        linkErrors.push({ page: path, href, problem: 'empty link target' });
        continue;
      }
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        if (!anchor.closest('head') && !/^https:\/\/fonts\.(googleapis|gstatic)\.com/i.test(href)) externalLinks.add(href);
        continue;
      }
      if (/^(javascript:|data:)/i.test(href)) {
        linkErrors.push({ page: path, href, problem: 'unsafe link scheme' });
        continue;
      }
      const url = new URL(href, `https://audit.invalid/${path}`);
      let target = decodeURIComponent(url.pathname.replace(/^\//, ''));
      if (!target) target = 'index.html';
      if (target.endsWith('/')) target += 'index.html';
      if (expectedAssets.has(target)) {
        referencedAssets.add(target);
        continue;
      }
      if (!pagePaths.has(target)) {
        linkErrors.push({ page: path, href, problem: `missing rendered page ${target}` });
        continue;
      }
      if (url.hash) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (!documents.get(target)?.getElementById(id)) linkErrors.push({ page: path, href, problem: `missing anchor ${id}` });
      }
    }
  }

  const missingAssets = [...referencedAssets].filter(path => !expectedAssets.has(path)).sort();
  const unreferencedAssets = [...expectedAssets].filter(path => !referencedAssets.has(path)).sort();
  const configuredIntegrationFindings = rendered.findings.filter(finding => finding.code === 'form-no-action'
    && configuredFormPrerequisites.has(`${templateId}@${templateVersion}:${finding.where?.slug || ''}:${finding.nodeId || ''}`));
  const configuredIntegrationSet = new Set(configuredIntegrationFindings);
  const errors = rendered.findings.filter(finding => finding.level === 'error'
    && !configuredIntegrationSet.has(finding));
  const warnings = rendered.findings.filter(finding => finding.level !== 'error');
  return {
    pages: html.length,
    rendererFindings: rendered.findings,
    errors,
    warnings,
    configuredIntegrationFindings,
    checkedLinks,
    linkErrors,
    referencedImagePaths: referencedAssets.size,
    expectedImagePaths: expectedAssets.size,
    missingImagePaths: missingAssets,
    unreferencedImagePaths: unreferencedAssets,
    externalOrConfiguredTargets: [...externalLinks].sort().map(href => ({
      href,
      placeholder: isPlaceholderTarget(href),
    })),
  };
};

const audit = async () => {
  const catalog = JSON.parse(await readFile(resolve(templateRoot, 'catalog.json'), 'utf8')).templates;
  const selected = requestedId && requestedVersion
    ? [{ id: requestedId, version: requestedVersion }]
    : latestSiteTemplates(requestedId ? catalog.filter(record => record.id === requestedId) : catalog)
      .map(record => ({ id: record.id, version: record.version }));
  if (!selected.length) throw new Error('no matching template releases found');
  const store = new FileSiteTemplateStore(templateRoot);
  const results = [];

  for (const selection of selected) {
    const directory = resolve(templateRoot, selection.id, selection.version);
    const current = await sourceOutput(directory);
    if (current.config.id !== selection.id || current.config.version !== selection.version) {
      throw new Error(`${selection.id}@${selection.version} source config does not match its directory`);
    }
    const record = catalog.find(item => item.id === selection.id && item.version === selection.version) || null;
    const draftDirectory = resolve(directory, 'draft');
    const hasDraft = await exists(resolve(draftDirectory, 'manifest.json'))
      && await exists(resolve(draftDirectory, 'site.pagecraft-site.zip'));
    const artifactState = record ? 'released' : hasDraft ? 'draft' : 'source-candidate';
    const artifactDirectory = record ? directory : hasDraft ? draftDirectory : null;
    const archivedManifest = artifactDirectory
      ? JSON.parse(await readFile(resolve(artifactDirectory, 'manifest.json'), 'utf8'))
      : current.manifest;
    const archiveBytes = artifactDirectory
      ? new Uint8Array(await readFile(resolve(artifactDirectory, 'site.pagecraft-site.zip')))
      : current.built.bytes;
    const archiveHash = digest(archiveBytes);
    let archived;
    let archiveValidationError = null;
    try { archived = validatePortablePackage(archiveBytes); }
    catch (error) { archiveValidationError = error instanceof Error ? error.message : String(error); }
    if (archived) assertTemplateDocument(archived.document, current.config);
    const installed = record ? await store.instantiate(record.id, record.version) : null;
    if (record && !installed) throw new Error(`${record.id}@${record.version} could not be instantiated`);
    const rendered = renderSite(installed?.document || current.validated.document, installed?.assets || current.assets);

    const archivedAssetFiles = new Map((archived?.manifest.files || [])
      .filter(file => file.role === 'asset').map(file => [file.asset.id, file]));
    const sourceAssetParity = current.assets.map(asset => {
      const file = archivedAssetFiles.get(asset.id);
      const metadataEqual = !!file && file.mediaType === asset.type
        && file.asset.name === asset.name && file.asset.width === asset.w && file.asset.height === asset.h;
      return {
        id: asset.id,
        sourceSha256: digest(asset.bytes),
        archivedSha256: file?.sha256 || null,
        bytes: asset.bytes.byteLength,
        metadataEqual,
        equal: metadataEqual && file.sha256 === digest(asset.bytes) && file.bytes === asset.bytes.byteLength,
      };
    });
    const internalDiff = archived ? packageManifestDiff(archived.manifest, current.validated.manifest) : null;
    const outerDiff = valueDiff(archivedManifest, current.manifest);
    const sourceDocumentSha256 = jsonDigest(current.validated.document);
    const archivedDocumentSha256 = archived ? jsonDigest(archived.document) : null;
    const expectedArchivedManifest = archived ? templateManifest(
      current.config,
      archived.document,
      archived.manifest.files.filter(file => file.role === 'asset').map(file => ({
        bytes: archived.files.get(file.path),
      })),
      archiveHash,
    ) : null;
    const sourceParity = {
      nativeDocumentEqual: archivedDocumentSha256 === sourceDocumentSha256,
      archivedDocumentSha256,
      sourceDocumentSha256,
      provenanceEqual: !!archived && same(archived.provenance, current.provenance),
      assetsEqual: sourceAssetParity.every(asset => asset.equal)
        && sourceAssetParity.length === archivedAssetFiles.size,
      assets: sourceAssetParity,
    };
    const manifestMatchesArchiveAndConfig = !!expectedArchivedManifest
      && same(archivedManifest, expectedArchivedManifest);
    const catalogMatchesManifest = record ? same(record, archivedManifest) : null;
    const archiveIntegrityValid = !archiveValidationError && manifestMatchesArchiveAndConfig
      && (!record || catalogMatchesManifest)
      && sourceParity.nativeDocumentEqual && sourceParity.provenanceEqual && sourceParity.assetsEqual;
    const rebuildReproducible = outerDiff.length === 0 && current.built.sha256 === archiveHash;

    results.push({
      id: selection.id,
      version: selection.version,
      artifactState,
      pages: current.validated.document.pages.length,
      catalog: {
        packageSha256: record?.packageSha256 || null,
        equalsArchivedManifest: catalogMatchesManifest,
      },
      archive: {
        packageSha256: archiveHash,
        hashMatchesCatalog: record ? archiveHash === record.packageSha256 : null,
        hashMatchesArchivedManifest: archiveHash === archivedManifest.packageSha256,
        validatesWithCurrentImporter: !archiveValidationError,
        validationError: archiveValidationError,
        rendererVersion: archived?.manifest.rendererVersion || null,
        rendererRevision: archived?.manifest.rendererRevision || null,
        manifestMatchesArchiveAndConfig,
        integrityValid: archiveIntegrityValid,
      },
      sourceParity,
      currentCompiler: {
        packageSha256: current.built.sha256,
        rendererVersion: current.validated.manifest.rendererVersion,
        rendererRevision: current.validated.manifest.rendererRevision,
        equalsArchivedPackage: current.built.sha256 === archiveHash,
        outerManifestDifferences: outerDiff,
        packageManifestDifferences: internalDiff,
        globalCssLineDifferences: archived ? textLineDelta(
          archived.files.get('styles/global.css'),
          current.validated.files.get('styles/global.css'),
        ) : null,
      },
      checkCommand: {
        passes: artifactState === 'released' ? archiveIntegrityValid : archiveIntegrityValid && rebuildReproducible,
        firstFailure: !archiveIntegrityValid ? 'archive integrity or source parity failed'
          : artifactState !== 'released' && !rebuildReproducible ? 'draft is stale' : null,
        rebuildReproducible,
      },
      render: auditRender(selection.id, selection.version, rendered, installed?.assets || current.assets),
    });
  }

  return {
    format: 'pagecraft.template-library-audit.v1',
    generatedAt: new Date().toISOString(),
    scope: requestedId && requestedVersion
      ? `Exact ${requestedId}@${requestedVersion} ${results[0].artifactState} artifact; source and archived files were read only.`
      : requestedId
        ? `Latest catalog release for ${requestedId}; archived files were read only.`
        : 'Latest catalog release for each template ID; archived files were read only.',
    summary: {
      templates: results.length,
      pages: results.reduce((total, item) => total + item.render.pages, 0),
      archivedHashesValid: results.filter(item => item.archive.hashMatchesArchivedManifest
        && item.archive.hashMatchesCatalog !== false).length,
      archivedPackagesValid: results.filter(item => item.archive.validatesWithCurrentImporter).length,
      nativeSourcesEqual: results.filter(item => item.sourceParity.nativeDocumentEqual).length,
      sourceAssetsEqual: results.filter(item => item.sourceParity.assetsEqual).length,
      currentCheckPasses: results.filter(item => item.checkCommand.passes).length,
      renderErrors: results.reduce((total, item) => total + item.render.errors.length
        + item.render.linkErrors.length + item.render.missingImagePaths.length, 0),
      rendererWarnings: results.reduce((total, item) => total + item.render.warnings.length, 0),
      configuredIntegrationFindings: results.reduce(
        (total, item) => total + item.render.configuredIntegrationFindings.length, 0,
      ),
    },
    interpretation: 'Released archive integrity is independent from current rebuild reproducibility. Integrity requires importer validation, archive/config/manifest agreement, catalog agreement for releases, and source document/assets/provenance parity. Drafts remain valid only when they reproduce the current build exactly.',
    risks: [
      'A released archive can remain valid while a newer renderer produces different generated HTML or CSS. Rebuild differences are recorded and must not overwrite immutable releases.',
      'The schema-compatible pagecraft-core renderer tag remains stable for existing WordPress readers. New packages add an independent renderer revision, and updated readers reject unknown revisions.',
      'Configured form prerequisites are exempted only by exact template version, page slug and node ID. Unexpected missing actions remain errors.',
    ],
    limitations: 'This is a static archive, reconstruction, render, image-reference and link-target audit. It does not replace real browser, Cloud or WordPress import/edit/save/reopen/publication checks.',
    templates: results,
  };
};

const output = argumentValue('out') ? resolve(process.cwd(), argumentValue('out')) : defaultOutput;
const report = await audit();
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, ...report.summary }));
