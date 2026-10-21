# Task close — empty Rich canvas selection

- Date: 2026-10-21, Asia/Manila.
- Project: Pagecraft customer QA.
- Exact base: `0e808e5b2e5ea2dc90f2fae590ff44876358a78b`.
- State: isolated local candidate native accepted by root; automated checks complete; integration pending.

## Changes

Semantically empty Rich Text gets an editor-only class. A CSS pseudo-element supplies a 24px hit area to auto-height content, including empty component placements and definition roots. There is no new DOM child, stored content, wrapper or ID. Inline-edit serialization remains clean. Populated content and public markup/CSS are unchanged.

No root dimensions or overflow are overridden. Nonzero authored fixed heights/clipping keep control. Explicit authored zero height combined with hidden overflow remains clipped and is not repaired by overriding the design.

Source: `app/src/core/index.ts` (4-line diff). Regression: `tests/empty-rich-hit-area.test.ts` (6 cases). Generated assets are isolated diagnostic build outputs. See `source-tests-assets.sha256`.

## Verification

| Check | Result | Evidence |
|---|---|---|
| RED proof | 5 expected pre-patch failures | `logs/red.log` |
| Focused | 3 files / 19 tests pass | `logs/focused.log` |
| Full suite | 235 files / 2,527 tests pass; 2 files / 5 tests skip | `logs/full-max-workers-2.log` |
| Typecheck | pass | `logs/typecheck.log` |
| Editor package build | pass | `logs/build-package.log` |
| Diff check | pass | `logs/diff-check.log` |
| Final deterministic builds | all 11 artifacts identical; prior recorded hashes unchanged | `generated-build-1.sha256`, `generated-build-2.sha256` |
| Dependency audit | zero vulnerabilities at every severity | `logs/audit.json` |
| Demo | 1 component / 6 instances / 4 items / zero findings | `logs/demo.log` |
| Baseline gate | 24 images / 28 sources pass; no new gallery needed for Core-only change | `logs/baseline-check.log` |

Tests cover ordinary empty Rich, instance/source ownership, false/true conditions, public empty/hidden output, duplicated IDs, nested ownership and preservation of authored dimensional CSS. Fresh checkout initially lacked ignored compiler-worker.js; the package build resolved its artifact test precondition. Final focused run passes. Full suite ran before an added test-only ownership assertion; the final focused rerun covers that exact final test file. Core/assets were unchanged.

## Handoff

Root accepted actual native ordinary empty Rich selection, component placement/source-root selection, false-condition 24px hit geometry, true-condition/Mobile 414px selection, public false omission/true empty output without helper, and inline typing plus real reload without helper serialization. See `native/native-acceptance.json` and its desktop/mobile PNGs. Root viewed the screenshots. Nested/global ownership and fixed dimensions remain automated-only; explicit zero-height plus hidden overflow remains clipped.

All five original source/test/asset hashes were verified unchanged after the two final builds. Root owns integration and release. The fictional harness remains running at `http://localhost:4966/edit/s1` (PID40458, exec session3510); do not stop it until root closes its use. No browser, shared feedback, Main, WordPress, baseline, commit or push changes were made. Wider QA remains open.

Time/billing: unknown; not prepared.
