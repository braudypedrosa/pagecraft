import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as core from '../app/src/core/index';

/* A fresh site made from a curated template should open with a clean Site check (C1 in the
   18 Nov readiness audit). This lints the current release of every template the way Cloud
   does, with the Submissions endpoint set, and allows only the findings listed here. Each
   listed finding is fixed in the template itself, which needs a new reviewed release; remove
   its line when that release is promoted. Anything not listed fails, so no template gains a
   new suggestion unnoticed. */
const KNOWN: Record<string, string[]> = {
  // Instances of “Cabin portrait” carry no recorded size for their chosen photo.
  stillwood: ['no-dimensions', 'no-dimensions', 'no-dimensions', 'no-dimensions'],
  // Instances of “Holiday home” carry no recorded size for their chosen photo.
  'salt-house': ['no-dimensions', 'no-dimensions', 'no-dimensions'],
  // Instance of “Project record” carries no recorded size for its chosen photo.
  'architecture-studio': ['no-dimensions'],
  // Muted text on sand is 4.48:1; the Stays hero image is lazy; Stays skips from H1 to H3.
  'coastal-rentals': ['contrast', 'contrast', 'contrast', 'heading-skip', 'hero-image-lazy'],
  // Small red text on paper is 3.40:1. Fixing it changes the brand red: a design decision.
  'independent-studio': ['contrast'],
  'dental-clinic-a2': [],
};

/* The next draft of each template with known findings. Each must open clean, so promoting it
   lets its KNOWN line above go. Stillwood 1.0.1 keeps one deliberate reminder: its home page
   availability search is a GET form with no destination until the owner adds a booking
   provider, and the draft says so beside the form. */
const DRAFTS: Record<string, string[]> = {
  'stillwood/1.0.1': ['form-no-action'],
  'salt-house/1.0.1': [],
  'architecture-studio/1.0.1': [],
  'coastal-rentals/1.0.5': [],
};

const catalog = JSON.parse(readFileSync('premade-sites/catalog.json', 'utf8')).templates as { id: string; version: string }[];
const released = new Map<string, string>();
for (const entry of catalog) released.set(entry.id, entry.version);

test('every released template is listed, so a new template starts with a clean Site check', () => {
  expect([...released.keys()].sort()).toEqual(Object.keys(KNOWN).sort());
});

async function cloudFindings(dir: string) {
  const config = JSON.parse(readFileSync(`${dir}/template.config.json`, 'utf8'));
  const source = config.sourceKind === 'document-json-v1'
    ? JSON.parse(readFileSync(`${dir}/${config.source}`, 'utf8'))
    : await (await import(pathToFileURL(`${process.cwd()}/${dir}/${config.source}`).href))[config.sourceExport]();
  const before = core.cloudFormEndpoint;
  core.setCloudFormEndpoint('https://cloud.example/forms/site');
  try {
    core.restore(source.doc || source.document || source);
    return core.lintGroups(core.lint());
  } finally {
    core.setCloudFormEndpoint(before);
  }
}

for (const [spec, expected] of Object.entries(DRAFTS)) {
  test(`draft ${spec} opens in Cloud clean apart from deliberate reminders`, async () => {
    const groups = await cloudFindings(`premade-sites/${spec}`);
    expect(groups.filter(group => group[0].level === 'error').map(group => group[0].msg)).toEqual([]);
    expect(groups.map(group => group[0].code).sort()).toEqual([...expected].sort());
  }, 60_000);
}

for (const [id, version] of released) {
  test(`${id} ${version} opens in Cloud with only its known Site check findings`, async () => {
    const groups = await cloudFindings(`premade-sites/${id}/${version}`);
    expect(groups.filter(group => group[0].level === 'error').map(group => group[0].msg)).toEqual([]);
    expect(groups.map(group => group[0].code).sort()).toEqual([...KNOWN[id]].sort());
  }, 60_000);
}
