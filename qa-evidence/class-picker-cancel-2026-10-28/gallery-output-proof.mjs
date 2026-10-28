import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { componentGalleryPage, GALLERY_SECTIONS } from '../../server/src/component-gallery.ts';
import { sourceHashes, names } from '../../tools/ui-gallery-contract.mjs';
const base = 'db252030f97755eb1a517114fdc4645a1e265ded';
const sha = value => createHash('sha256').update(value).digest('hex');
const current = await readFile('index.html', 'utf8');
const committed = file => execFileSync('git', ['show', `${base}:${file}`], {maxBuffer:30*1024*1024});
const prior = committed('index.html').toString();
for (const file of ['server/src/component-gallery.ts','server/src/account-pages.ts','shared/ui-fonts.js','shared/custom-select.js','shared/action-feedback.js','shared/ui-motion.js']) {
  assert.equal(sha(await readFile(file)), sha(committed(file)), `${file} exact base`);
}
const outputs = [];
for (const host of ['cloud','builder']) for (const section of GALLERY_SECTIONS) {
  const actual = componentGalleryPage(current, host, section), expected = componentGalleryPage(prior, host, section);
  assert.equal(actual, expected, `${host}/${section} full HTML byte equality`);
  outputs.push({host, section, bytes:Buffer.byteLength(actual), candidateSha256:sha(actual), baseSha256:sha(expected), byteExact:true});
}
const manifestPath = 'public/internal-ui-baselines/manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const oldManifest = committed(manifestPath);
const actualSources = await sourceHashes();
const changed = Object.keys(actualSources).filter(file => manifest.sources[file] !== actualSources[file]);
assert.deepEqual(changed, ['app/src/ui/inspector/Inspector.tsx']);
for (const name of names) assert.equal(sha(await readFile(`public/internal-ui-baselines/${name}`)), manifest.images[name].sha256);
const before = manifest.sources[changed[0]];
manifest.sources[changed[0]] = actualSources[changed[0]];
const receipt = {base, root:process.cwd(), method:'Root source-entry-only review. The gallery does not mount StylingTarget. All twelve actual gallery HTML outputs are byte-identical, proving unchanged markup, CSS and scripts at both captured widths. Actual class-picker cancellation requires separate native acceptance.', outputs, changedSource:changed[0], before, after:actualSources[changed[0]], all24PngBytesExact:true, imageEntriesAndProvenanceUnchanged:true, captureTimestampUnchanged:true, behaviorChecksUnchanged:true, freshGalleryCaptureClaimed:false, originalManifestSha256:sha(oldManifest)};
await writeFile('qa-evidence/class-picker-cancel-2026-10-28/gallery-output-proof.json', JSON.stringify(receipt,null,2)+'\n');
await writeFile(manifestPath, JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({outputs:outputs.length, allByteExact:true, all24PngBytesExact:true, sourceEntryReviewed:changed[0], freshCapture:false}));
