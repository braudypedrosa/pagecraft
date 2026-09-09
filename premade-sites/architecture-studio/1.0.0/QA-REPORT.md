# Common Ground — implementation checkpoint

Status: **C / Index selected; representative-page QA incomplete**. No release promotion or production deployment.

## Implemented and verified

- Draft package and previews are isolated from the released catalog.
- `check`, `status` and promotion gate behavior are exercised by automated tests.
- Workflow records enforce package/host/editor-bound acceptance, evidence file hashes,
  both-host editing checks, page/viewport coverage, independent review and explicit user decisions.
- Native-only checks include reusable component/block definitions and reject head HTML escape hatches.
- The CLI is included in the main TypeScript check.
- Full suite: 1,096 passed, four skipped across 36 files (35 passed, one skipped).
- Focused authoring/workflow/catalog tests cover missing/tampered previews, evidence changes,
  stale package/host records, incomplete coverage, latest QA record precedence, rollback,
  immutable releases and preservation of historical catalog entries.
- All six existing released templates passed the read-only package check; their files and catalog
  have no git diff.

## Direction evidence

Package SHA-256: `14bf64011d1d21e9d6307481a6b1c9ac5c4b26787409a4c9283bf006e957034b`.

Three native Pagecraft direction studies are in the package: Gallery, Journal, and Index.
Each has an opening and meaningful project/body section. `review.html` compares actual rendered
screenshots and links to the interactive previews. Fictional architectural imagery was generated
for this task; generation provenance is in `workflow.json`. Original files are retained in assets.

Captured all three at 390, 768, 1024 and 1440px. The browser probes found loaded images, no horizontal
overflow and a 14px minimum text size. Inspected complete desktop/mobile captures visually.
Headline wrapping and inherited image radii were corrected during that review. Native mobile menu
opens, closes on Escape with focus retained on the toggle, and navigates to the Projects anchor.
The console snapshot contained no warnings/errors. These are packaged-preview checks, not Cloud
installation or WordPress acceptance.

Current reference screenshots of Marea 1.0.4 and Northline 2.0.9 are included. Marea uses a scenic
text overlay and subsequent peer inventory; Gallery keeps copy outside images and uses project
chapters. Northline uses a left split opening, repeated service cards and evidence/process rows;
Journal changes the opening and narrative rhythm, while Index retains a familiar left anchor for
actual project navigation. The Northline reference has scroll reveal content and is not a complete
visual QA of that release. These comparisons are agent judgments, not user preferences.

## Representative-page evidence

Current corrected draft SHA-256: `16a3406799e4658fadc7d5504bb3627981345df316612b280e4b479d3be2a41a`.

Cloud editing observations used the earlier package `00b703f24234b60da815c412af06035cfa763cdb62e8d6433190ec2b0853404e`.
Installed through the isolated Cloud dashboard; edited a component heading to twice its length;
duplicated a project record, changed its title and image independently, reordered it and deleted it.
Reopened the editor and confirmed the original heading persisted. Changed shared heading typography
to system serif and set separate desktop/tablet/mobile spacing values through the inspector.
These are partial exercises, not host acceptance. The disposable Cloud fixture does not test Supabase authentication.

Cloud baseline: `0f7134b9560ae1cc53d34a88d25cf26ca608c944`; editor package 0.2.15;
served editor HTML SHA-256 `48412d9eaf225192f1fd25a079f380310169a08e6bd1045b261208d68f50007a`.
The new local harness is uncommitted. WordPress baseline inspected only: `83114212952d80b7cd59359018fb2edfaca40bb3`;
its unrelated dirty working tree has not been altered or accepted as compatible.

Publishing correctly blocked the unconfigured form. Fixed incorrect native button variables and
raised form typography to 18px, yielding at least 14px for visible text at 390/768/1024/1440.
Current packaged-preview probes show loaded images and no horizontal overflow at those widths.
Mobile Escape closes the menu and retains focus; the project inquiry anchor works.
Captured console snapshot contained no warnings/errors. Screenshots named representative-* are
viewport captures, not complete-page visual acceptance. Full-page stitching was unreliable and
those captures were replaced.

WP-CLI returned “Error establishing a database connection.” Account authorization remains pending.
A loopback HTTPS test receiver was attempted using the existing Local certificate; the built-in
browser returned ERR_CERT_AUTHORITY_INVALID. No bypass, form submission or receipt occurred.
A trusted local HTTPS receiver is required to test the same supported external form in both hosts.

## Required next steps

1. Direction selection is recorded with the exact user reply “C”; this is not final visual approval.
2. Finish representative-page verification in both hosts, including the corrected form styling.
   Original direction studies remain in direction-studies.ts and direction-studies/preview.
3. Complete Home, Projects, Project Detail, About, Services and Contact after that exercise.
4. Perform content stress tests, all page/viewport checks, fragile breakpoint checks, and actual form
   delivery/error tests in both hosts. Record exact tested host and editor revisions.
5. Complete the independent rendered review and final user checkpoint. Promote only with current
   evidence and package-bound approval. No host acceptance or user approval has been fabricated.

## Skill publication

Canonical intentional-web-design main commit: `316d8cfc72f0ee93447579466b460ec4228b328f`.
Push verified against origin/main. Codex and Claude installed skill trees match the committed
canonical tree. Structural validation passes. Codex quick validation passes. No architecture layout
history has been added for unselected direction proposals.

## WordPress representative exercise — 2026-09-07

User authorized a disposable QA administrator. Created an isolated socket-only MySQL database,
separate WordPress 7.1 core and private account, and copied the clean committed WordPress
plugins/theme at 83114212952d80b7cd59359018fb2edfaca40bb3. Existing LocalWP database and dirty
Cloud/WordPress repositories remain untouched. The test site is http://127.0.0.1:4892.

Imported via the production WholeProjectImporter service through WP-CLI, not the Cloud OAuth UI.
Imported page 8, images, shared header/footer and native menu. Editor opens using its existing
admin route; the normal Edit with Pagecraft entry point incorrectly opens the start chooser.

Initial browser editing lost instance titles on save/reopen: empty vals objects were returned as
arrays. Added explicit initial content values in the template source and reimported. This
preserves doubled titles, independent duplicate content, image replacement and order through
save/reopen. Deleted the disposable duplicate successfully. The workaround does not resolve
reset-to-defaults or other empty object maps.

Changed shared Ink to #293d58 and heading font to system serif through Site Settings; the
published frontend reflects both. Set instance padding-top through the inspector to 12px mobile,
18px tablet, 24px desktop; Save reported success but stored all three CSS maps as empty arrays.
The read-only audit found 54 affected CSS maps in the actual editor JSON response. Acceptance
therefore remains incomplete. This is not a successful responsive-inspector test.

Published locally via WP-CLI to inspect output. Headings and images persisted. At 390px the
mobile menu opened, but its accessible label and control association were stripped. The disabled
inquiry form correctly states that it is not configured; no form delivery has been claimed.
The local HTTPS certificate remains untrusted by the built-in browser.

Current package: `5a43baa972fed388d38e10f90c6bd59978ddeb2228e868a4e37dd0f22cc997c5`. These observations are partial compatibility findings, not
release acceptance. Host details and editor hash are in evidence/tested-hosts.json. Do not
reuse the earlier preview screenshots as verification of this changed package.

## Latest checkpoint: six-page draft and local WordPress fixes — 2026-09-07

Current package: `642eccdc1fa435f5f92de35972c0d9049b85b714881ea05182da9f6df1a8cda5`.
All six requested pages exist, with shared native navigation/footer, project-record components,
plain demonstration narratives, and the original sourced/generated assets. No catalog promotion.

The WordPress serialization, ARIA, and edit-entry changes are implemented in the isolated host
checkout. `evidence/wordpress-host-patch.json` records exact files and test scope. The representative
map audit dropped from 54 findings to zero. Save/reopen and reset-to-defaults regressions were
verified in the built-in browser. `npm test` passed for the host; premade typecheck and current
package check passed. Original dirty host checkouts remain untouched.

The six-page package preview was probed at 390, 768, 1024, and 1440: no horizontal overflow,
all referenced images loaded, and all visible text computed to at least 14px. Desktop/mobile
screenshots were inspected for all six pages. Evidence: six-page-responsive-probes.json and
six-page-*.png. Contact captures are viewport-only because full-page capture produced a distorted
image despite correct DOM geometry; those invalid captures were replaced, not counted as QA.
A full separate visual acceptance pass and intermediate-width screenshot review remain pending.

WordPress imported the current six-page package (job 64), updating six pages. Posts 8 and 54–58
are published only in the isolated loopback test site. The four-width frontend probes show correct
page headings and no overflow or sub-14px content text. Home image probes initially ran while
responsive srcset images were loading; desktop recheck showed both full-size images loaded.
Do not treat the transient unloaded entries as a final media pass or an asset failure.

Cloud installed the preceding six-page package `8ed9ecc5bdb68f3c779765b3032901237f7979cae427ce6ab0f0475ad84107db`.
Its publish review correctly blocked the unconfigured Contact form and identified a leftover
component fallback anchor. That anchor is corrected in the current package. The Cloud fixture
must be restarted and the current package installed before acceptance. Imported media metadata
still displays 1 KB for multi-megabyte assets; this remains a separate host metadata finding.

Pending gates: trusted local HTTPS form delivery and failure testing; current-package Cloud
installation/editing/publishing; complete 1/3/7-item and missing-image stress exercises in both
hosts; fragile-breakpoint and keyboard/console/navigation coverage for the expanded site;
independent screenshot comparison; final user review. No QA or final approval record was invented.
The original C decision approves the direction only.

### Subsequent content-resilience fix

Current draft is now `ea99c939e95566106e3cb9c9318c25065b2cbe1005180a04dfc6979161b89454`.
The only subsequent template change adds a native `showIf` condition to the project image, so an
empty image override omits the image instead of exporting a large placeholder. Four new tests in
`tests/architecture-template.test.ts` prove omission and independent 1/3/7-record export with long
headings and uneven descriptions. This is renderer regression coverage, not a substitute for
repeating the interactive host matrix. Earlier screenshot evidence remains bound to package 642e.

Cloud was refreshed and installed package 642e through the real template UI. Its publish review
reported only the missing Contact receiver (the stale-anchor warnings are gone). The current Cloud
fixture contains editing-test changes: one long-titled original record remains after duplicating
seven, assigning independent titles, moving the seventh to the top, and deleting back through three
to one. `current-cloud-*.txt` records those exercises. The later optional-image condition has not yet
been imported into Cloud. WordPress has received the newest package through the same importer.
Full acceptance remains incomplete and previous observations must not be promoted as current QA.

## HTTPS and form receiving verification — 7 September 2026

The local certificate now passes macOS verification and opens in the built-in browser without a certificate error. For package `ea99c939e95566106e3cb9c9318c25065b2cbe1005180a04dfc6979161b89454`, the native Contact form endpoint was configured through each host inspector in the isolated QA installs. WordPress saved the page; Cloud autosaved and published draft version 2 locally. Empty required fields were blocked in both frontends. Valid test submissions from both hosts reached the HTTPS receiver and were stored; the receiver truthfully states that no email was sent. See `evidence/form-delivery.json` and both `*-form-receipt.txt` files. The reusable package retains its unconfigured form. This is a partial form exercise, not complete host acceptance. Rejection/failure paths, remaining compatibility exercises and final visual approval remain pending.

## Current QA pass — 7 September 2026, continued

Package remains `ea99c939e95566106e3cb9c9318c25065b2cbe1005180a04dfc6979161b89454`. Both hosts completed the native seven/three/one duplication, reorder, delete and reopening exercises. Native image replacement and responsive padding controls were exercised; WordPress reopened 24/18/12 values and Cloud tablet/mobile snapshots record the saved overrides. Shared font/color changes were tested on locally published Home and About in both hosts.

WordPress exposed an additional real stylesheet ownership defect. Local patch v2 separates page rules from shared foundations, stores the current Site Settings stylesheet independently, and orders it after older global snapshots. The browser confirmed Georgia and #293d58 on both Home/About after the fix. The intended Arial/body font and original ink were restored. Old-editor saved pages require one resave. Exact modified files are in `evidence/wordpress-host-patch-v2.json`; prior host evidence remains historical. The host test suite passed including a new stylesheet-order regression.

Both receivers rejected whitespace input and actual storage failures without false success. The storage fault was reversed and the two original receipts remain intact. Keyboard Enter/Escape menus and the Projects-to-detail-to-Contact journey worked in both hosts; console error lists were empty for these journeys.

96 measured viewport checks span six pages, both hosts and widths 390/767/768/899/900/1023/1024/1440, with no overflow or sub-14px findings. One WordPress responsive image was sampled during loading; further definitive media/revision verification remains. Some initial screenshots contained capture artifacts and were removed; `capture-method.json` explains the rejected captures. Full Cloud desktop/mobile review captures now use native viewport sizing. These are agent observations, not user approval.

Remaining acceptance work: finish final patched-host page/image verification, rendered long/uneven-content stress at required widths, complete independent comparison and final visual review. QA acceptance records remain empty rather than promoting incomplete coverage.


## Current package verification — native component fields

Current draft SHA-256: `3758e6d470cb6caa07a3fde9bcb3f7b99f458c9e329054581e941499fd90d255`. Earlier evidence remains historical and is not automatically accepted for this checksum.

- `evidence/current-host-matrix.json`: 48 checks covering all six pages at 390, 768, 1024 and 1440px in both isolated hosts. No unintended horizontal overflow or text below 14px; document images loaded. This is geometric evidence, not a substitute for composition review.
- `evidence/native-fields-stress.json` and reopen records: exposed plain-text category/description fields persist independently. One, three and seven project instances tolerate long headings and uneven descriptions at desktop, tablet and mobile sizes.
- `evidence/current-form-delivery.json`: current package native forms successfully posted to the trusted HTTPS receiver on both disposable sites. Receipts are stored locally; no email is sent. Packaged form delivery remains unconfigured.
- `evidence/wordpress-host-patch-v3.json`: exact isolated host files and baseline. Current Site Settings CSS contains design values only, avoiding structural resets; page saves use native split output. Full WordPress tests passed, including the new design-CSS isolation test.
- Current package document/asset/manifest/package check passed.

Some initial `current-*` full-page screenshots omitted unpainted off-screen images despite loaded DOM image data. Prefer `painted-cloud-*` captures, taken after scrolling each page. These were visually inspected at 390 and 1440px for all six Cloud pages. Project imagery, captions and column collapse remain intentional; About and Services use readable narrative groupings rather than invented team cards or badges. Intermediate-width and WordPress visual review, and remaining current-checksum editing evidence, still need completion before recording full acceptance.

The selected Index composition differs from the inspected Northline creative ledger and Marea full-bleed inventory: a project directory opens into framed architectural scenes, long project rows and a light colophon. Familiar navigation is retained deliberately. This is an agent assessment, not user approval or an originality score.


## Acceptance evidence recorded

The remaining current-checksum native editing, keyboard, console, breakpoint and rendered checks are now recorded in workflow.json, with file checksums. See RENDERED-REVIEW.md for the final agent assessment and exact host limitations. This supersedes the earlier pending-work paragraphs above. User final visual approval remains pending; no promotion or production deployment has occurred. Current targeted tests: 12 passed; TypeScript check passed; isolated WordPress full test suite passed.

## Final media restoration correction

The last restore check found Home publishing `src="6"` after a native library selection. WordPress v4 resolves library asset IDs before fallback HTML sanitization. Native replacement/save/reopen and restoration/save/reopen now publish loaded URLs; Arial, original ink and overflow checks also pass. The full WordPress regression suite passed. Exact v4 patch: `cd5576751b62fcb45b0eeea3948af92467fc92c8b0a9579b06d5a8d2562e4f77`. Historical failure remains in `current-restored-sites.json`; corrected evidence is `current-wordpress-media-save-fix.json`. The package remains unchanged. Prior full browser matrices are v3, supplemented by targeted v4 verification.

Canonical intentional-web-design update published at `b283acdb8851c53fbcd95183ae402b923b84f71b`, remote revision verified, installed Codex and Claude copies synchronized and validated. User feedback is direction C selection only; final visual approval remains pending.

## Local release approval and verification

User replied `yes` to the final review/local promotion checkpoint. Approval was bound to package `3758e6d470cb6caa07a3fde9bcb3f7b99f458c9e329054581e941499fd90d255` and snapshotted in `release-review.json`. Local promotion succeeded; status is `released` with no findings, and package/document/assets/manifest checks pass. All pre-existing catalog entries and released files remain unchanged. Release ZIP is byte-identical to the reviewed draft. No production deployment was performed. Earlier pending-approval statements are historical.
