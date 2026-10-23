# Canvas right-click multi-selection

- Date:2026-10-24, Asia/Manila.
- Status:source and deterministic builds verified; gallery source-fingerprint review and native acceptance pending.
- Base:cfa3ca348ea7a0b15e2327cdefa7a348a4c7d2ad.
- Scope:builder.html pointer selection plus focused canvas-context-selection.test.mjs. No Core, schema, golden, PHP or SVG changes.

## Change and tests

A secondary pointer press on a selected member leaves the existing selection intact for contextmenu. Secondary presses on unselected members select singly, ignoring add modifiers. Ordinary primary Shift/Ctrl/Meta add/toggle selection remains unchanged.

- Corrected-harness RED:2 failed,2 passed. Initial harness-only assignment to readonly window.document is retained separately.
- Focused:18 passed across four files, covering actual select/bindCanvas/openCtx handlers, real Core selection and rendered multi-action menu, unselected right-click, primary modifiers, HUD keyboard, repeated CMS selection and divider hit routing. No paste or action executed.
- Typecheck and whitespace checks pass.
- Exact command order:node build.mjs, node packages/editor/build.mjs, node build.mjs, node packages/editor/build.mjs.
- Both generated10 pairs match. Only index.html and packages/editor/dist/editor.html change versus committed source seal; other8 including Core71e, runtime76a0, compiler2, contract, templates and fixture ZIPs are exact. The full suite leaves those hashes exact.
- Full ordinary command:npm test -- --maxWorkers=2. Result:2813 passed,5 skipped,1 failed;274 files passed,2 skipped,1 failed. The sole failure is the expected builder.html fingerprint in tests/ui-baselines.test.mjs. No baseline refresh performed; do not call full suite green.
- Six builder style blocks and all non-script markup remain exact. Gallery manifest,24 PNG bytes/full provenance, Core source7b68/anim8646, schema and golden53724 unchanged. No new capture claimed.
- Main11 working artifact bytes and index exact. No Main/canonical/browser/DB/install/commit/push actions.

## Handoff

Root must review the gallery source gate and perform native right-click acceptance before integration. Source2 and scoped evidence are reviewable. Stage generated8 index-only, preserve Main11 working bytes, exclude untracked compiler2. The hash manifest explicitly records the unresolved gate. Full builder QA remains open.


## Root gallery acceptance and integration

Root executed30 native gallery behavior checks and captured24 actual candidate states in the built-in browser. All24 comparisons have0 changed pixels. All12 actual gallery HTML outputs match the previous build. Representative Actions768 and Dialogs1440 PNGs were visually reviewed. Only the reviewed builder source fingerprint changed in the baseline manifest; all24 historical PNGs and their provenance remain exact. After review, ordinary full suite passes2814 tests with5 existing skips across275 files and2 skipped files. Candidate artifacts remain deterministic. Browser47 emulation/media and CPU1 reset responses are saved; tab47 is closed and owned gallery server stopped.

Root copied source2, reviewed manifest and this evidence scope only. Generated8 staged index-only, preserving Main11 working bytes. Staging native canvas acceptance and WordPress115 synchronization remain pending. Full QA remains open.
