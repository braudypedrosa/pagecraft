# Task close — nested component editor ownership

- Date: 2026-10-21, Asia/Manila.
- Project: Pagecraft customer QA.
- Exact base: `37820488905becc37e9870ca5d9c93fe370015ab`.
- State: isolated editor-only candidate native accepted; ready for root integration as79. Public duplicate IDs remain a separate fix.

## Contract and changes

Nested `n.use` previously replaced the rendering instance and exposed an unreachable definition-owned node as an editor selection target. The exact expansion block is identical in 0e808e5 and 3782048, so this predates the empty Rich hit-area fix (`preexisting-contract.json`).

Transient `RenderOpts.editorPath` now carries editor placement ownership, without changing actual nested instance/property/variant/CMS resolution. Definition-owned nested roots omit selection hooks; editor DOM IDs include enclosing placement paths. Opening an outer definition exposes its immediate placements. Page-owned filled slots reset the editor path; nested definition-owned filled slots retain it. Missing/cycle placeholders respect the same ownership. The path is render-only and never persisted.

Source: `app/src/core/index.ts`, `app/src/core/types.ts`. Tests/fixtures: `tests/nested-component-owner.test.ts`, `tests/fixtures/nested-component-ownership.ts`, `tests/fixtures/nested-component-public.json`.

## Verification

| Check | Result | Evidence |
|---|---|---|
| RED proof | five expected pre-fix failures, two tests pass | `logs/red.log` |
| Focused | 5 files / 23 tests pass | `logs/focused.log` |
| Full suite | 236 files / 2,535 tests pass; 2 files / 5 tests skip | `logs/full-max-workers-2.log` |
| Typecheck | pass | `logs/typecheck.log` |
| Deterministic final builds | all 11 artifacts identical | `generated-build-1.sha256`, `generated-build-2.sha256` |
| Audit | zero vulnerabilities at every severity | `logs/audit.json` |
| Demo | 1 component / 6 instances / 4 items / zero findings | `logs/demo.log` |
| Baseline gate | 24 images / 28 sources pass | `logs/baseline-check.log` |
| Public compatibility | byte-identical normal nested / slots / missing / cycles | public snapshot fixture and test |

All eight source/test/asset manifest entries remained unchanged after final builds. Tests cover three-depth nesting, duplicate outer instances, selection after componentOpen, both slot ownership permutations, missing/cycle fallbacks, variants, nested CMS bindings and document immutability.

## Handoff and limits

Root accepted the full native customer sequence: create Rich/property override, wrap in Column component, click nested Rich to select outer placement, use Library Edit outer definition and edit immediate Rich child/property, duplicate outer with unique editor IDs, select the correct last owner at Mobile414, then reload with two copies and values preserved. Root viewed desktop/mobile screenshots in `native/`.

Double-click did not open source; the accepted sequence used Library Edit. Slot/CMS/variant permutations are automated-only. Preview natively confirms unresolved public ID `pagecraft-wysiwyg-r488o743` appears twice; see `native/native-acceptance.json` and `native/public-nested-duplicates.png`.

Trusted mock is running at `http://localhost:4968/edit/s1`, PID56840/session92450; preserve until root is done. Current4966 assets remain untouched.

Public nested-ID collisions were already present in the frozen baseline: 16 reference IDs include six repeated names. They are intentionally unchanged by the editor-only fix and require a separate follow-up. Native Nav/mobile-menu interactions under new editor IDs remain broader QA. Do not claim full production readiness.

No Main, browser, shared feedback, WordPress, baseline, commit or push action. Exclude Demo drift, ignored compiler outputs and temporary harness from integration according to existing policy. Time/billing: unknown; not prepared.
