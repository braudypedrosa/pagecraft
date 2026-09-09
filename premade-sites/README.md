# Pagecraft curated site authoring

Curated sites are native, versioned Pagecraft documents. Layout, typography, responsive values,
media and shared styles belong in discoverable builder controls. Native-only is the default;
custom CSS exceptions are an explicit migration list, not an implementation shortcut.

## Commands

```sh
npm run template -- scaffold architecture-studio 1.0.0 --name="Architecture Studio" --sample-name="Common Ground" --categories="Architecture,Design"
npm run template -- build architecture-studio 1.0.0
npm run template -- check architecture-studio 1.0.0
npm run template -- status architecture-studio 1.0.0
npm run template -- promote architecture-studio 1.0.0
```

`scaffold` refuses to overwrite a version and creates source, config, asset directory and
`workflow.json`. Supply reproducible document/node IDs in the source factory. `build` writes
`draft/site.pagecraft-site.zip`, `draft/manifest.json`, and `draft/preview/`. Previews are extracted
from the package's own renderer output. Builds do not modify the catalog and refuse released
versions. Never use the legacy generator to rebuild released artifacts.

`check` recompiles and compares the document, assets, manifest, package and draft preview. It is
read-only. Historical releases remain checkable without workflow records. `status` reports
unbuilt/stale, revision, ready or released and the remaining release findings.

`promote` accepts one exact id/version. It requires current checks, both host QA records, an
independent rendered review, and explicit user approval. Evidence file paths are relative to the
version directory and their SHA-256 hashes must match. Accepted QA must match the package hash
and the host/editor revisions in `targets`. Package or target changes require renewed evidence.
Promotion writes root-level release artifacts and appends to the catalog without changing existing
entries. Existing released versions cannot be overwritten. Promotion is local, not deployment.
A lock serializes promotions. Ordinary failures roll back newly created release files. If a process
is forcibly terminated, inspect `.promotion-lock`, root artifacts and catalog before recovery;
do not blindly remove a lock belonging to an active process.

## Creation flow

1. Record audience, action, sitemap, content, image roles/provenance, and native capability limits.
2. Render three structurally different directions, each with a hero, body section and mobile view.
3. Ask the user to select a direction. Record the exact decision with its conversation provenance.
4. Build the representative page with the hardest component; verify editing in Cloud and WordPress.
5. Build the remaining pages. Test actual navigation, media, controls and form outcomes.
6. Run a separate rendered review against intentional-web-design and recent screenshots. Recompose
   failures instead of adding decoration. Capture responsive evidence for every page.
7. Present the finished site and customization guide. Record explicit final approval of this package,
   then promote locally. Never treat plan approval or agent judgments as design acceptance.

Continue independent tooling and QA while a checkpoint is pending. Do not choose a direction on
the user's behalf. The record is an auditable ledger, not an identity/authentication system; its
checks cannot prove a screenshot was inspected or that a human actually approved the work.

## Acceptance record

The versioned schema and enumerated check names live in `lib/workflow.ts`. Keep QA and acceptance
fields null/empty until work is actually performed. `qa` holds each host's exact revision, editor
version, package checksum, editing exercises, page/viewport coverage, breakpoint notes, timestamp
and evidence paths/hashes. `visualReview` is the independent agent review, and `approval` and
`selection.decision` are user decisions with an exact quote and conversation reference.

Verify global colors/fonts, replacement images, longer titles, duplicate/reorder/delete, shared
versus instance styling, responsive inspector controls, save/reopen, and publishing. Stress-test
doubled headings, uneven descriptions, 1/3/7 items and missing optional imagery. Verify every page
at 390, 768, 1024 and 1440px and around fragile breakpoints. Apply the skill's typography, semantics,
container, imagery, interaction, keyboard, console and anti-generic criteria. Keep explicit findings
with page, node, viewport and correction. Missing host access is incomplete QA, never a pass.

Keep screenshot decisions and provenance in `review-library/`. Do not infer user preferences from
agent assessments. Do not use a numeric originality score to certify visual quality.
