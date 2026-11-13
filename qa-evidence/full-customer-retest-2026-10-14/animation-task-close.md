# Task close — Animation timing and entrance choices

Internal evidence record.

- Date and timezone: 2026-10-17, Asia/Manila
- Client / project: Braudy / Pagecraft
- Task reference: Animation timing preservation and entrance-option review in this Codex task
- Status: complete locally; ready for root commit and release integration
- Authorized scope: Six reviewed animation source/test overlays, two isolated builds, focused and full tests, reviewed UI baselines, and reviewed WordPress golden
- Environment: Local clean archives only; main checkout source overlays were not built or tested
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, parent `23939c587921a3d709053017b061122ef951df11`

## Work performed

- Preserved preset timing by applying only supplied animation timing longhands; generated `app/src/core/anim.ts` from the vendored source.
- Excluded Fade out from new entrance choices while retaining a labelled existing value, and clarified that an omitted duration uses the preset default.
- Added runtime and inspector regressions, including old-source red evidence.
- Built `/tmp/pagecraft-animation-one-23939` and `/tmp/pagecraft-animation-two-23939` independently with the exact six overlays.
- Files or artifacts: `qa-evidence/full-customer-retest-2026-10-14/animation-build.json`, `qa-evidence/full-customer-retest-2026-10-14/animation-golden-candidate-diff.json`
- Delivery state: Local only; root recorded the reviewed baseline and golden in main. This agent did not commit, push, deploy, build main, or test main.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Runtime regression red | Untouched `23939` source plus final test | fail as expected, 6/6 | `tests-animation-partial-timing-red-final-20261017.log` |
| Entrance-choice regression red | Untouched `23939` source plus final test | fail as expected, 3/3 | `tests-animation-entrance-options-red-20261017.log` |
| Focused regression | Both isolated exports | pass, 22/22 each | `animation-one-focused-final.log`; `animation-two-focused-final.log` |
| Editor-package and demo builds | Both isolated exports | pass | `animation-{one,two}-{package,demo}-build.log` |
| Provisional full suite | Export ONE | expected review hold: 2385 pass, 2 fail, 5 skip | `tests-animation-provisional-full-one-final-20261017.log` |
| Final full suite | Export ONE | pass: 211 files, 2387 tests; 2 files and 5 tests skipped | `tests-animation-final-20261017.log` |
| WordPress candidate determinism | Both isolated exports | pass; candidates byte exact | `animation-golden-candidate-diff.json` |
| WordPress golden review | Root review plus main and both exports | pass; 19 derived leaves, 3 normalized runtime payloads, fixture SHA `6188d0fd...` exact | `animation-golden-candidate-diff.json` |
| UI gallery and baseline review | Root built-in gallery | pass; 30/30 behaviors, 24/24 images with zero changed pixels; four full captures manually viewed | `gallery/animation-final` |
| Independent baseline check | Export TWO | pass; 24 images, 28 source files | `animation-two-baseline-check.log` |
| Generated output determinism | 11 isolated outputs | pass, 11/11 | `animation-build.json` |
| Main protected output guard | Existing main working outputs | pass, 11/11 exact | `animation-build.json` |

- Remaining limitations: No commit, push, deployment, or WordPress/native acceptance was performed by this agent. Root owns those release steps.

## Time evidence

| Work item | Duration | Basis | Reference |
|---|---|---|---|
| Implementation and isolated verification | unknown | no authorized timer | this task |

- Tracked or explicitly confirmed total: unknown
- Estimated time: not prepared
- Excluded time: other agents and root browser review
- Billing state: not prepared

## Next action and handoff

- Outstanding work: Root commit, packaging/deployment, and native WordPress acceptance as applicable
- Owner / dependency: Root agent
- Restart point: `/tmp/pagecraft-animation-one-23939`, `/tmp/pagecraft-animation-two-23939`, and `animation-build.json`
- Client context: no durable client-context change

## Client-facing summary

Pagecraft’s entrance animations now preserve each preset’s timing when only one timing field is changed, and new elements no longer offer the exit-only Fade out choice. Both isolated builds, focused tests, the final full suite, visual baselines, and the reviewed WordPress fixture pass.
