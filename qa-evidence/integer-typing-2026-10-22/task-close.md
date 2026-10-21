# Task close — Numeric typing, inspector transitions and sanitizer, candidate86

Date: 2026-10-22, Asia/Manila. Isolated checkout: `integer-typing-218f115`. Exact base: `218f11545451cbac7ad1d8ed9e08245258b57a25`.

Status: root source, native and gallery reviews accepted; final combined checks pass. Ready for integration, uncommitted and undeployed. Broader production-readiness QA remains open.

## Changes

Integer UnitCtl fields avoid assigning an already-equal number value during input. This preserves the browser's intermediate decimal editing buffer while retaining actual fractional rounding, bounds and nonnegative rules. Five regressions cover the explicit native draft-boundary model, ordinary digits, clamping, negative CSS values, zero/clear and noninteger lengths. Actual browser typing is a separate native acceptance gate.

The inspector mount prevents synchronous render reentry while structural unmount blur callbacks commit a focused control. A focused Gallery Columns to repeated List Heading selection previously raised a Preact removeChild error and left the breadcrumb stale. The narrow try/finally guard has an exact Content/Columns regression. The gallery contract now fingerprints the mount source as well as Controls, with a regression that checks the actual source SHA; 30 sources require review.

Root and server workspace dependency pins and lock update sanitize-html to 2.18.1. A 2,000 discarded-iframe fallback regression reproduced a stack overflow before the patch; the patch passes that case and preserves ordinary iframe discard output. Dependencies are unique to candidate86; accepted85 dependencies were not modified.

## Accepted verification

| Check | Final result | Evidence |
|---|---|---|
| Full suite | 248 files, 2,606 tests passed; 2 files/5 tests skipped; exit 0 | `logs/full-final.log` |
| Determinism | 11 artifacts byte-identical across two correct-order builds; all four commands exit 0 | `final-generated-build-{1,2}.sha256` |
| Typecheck/audit/diff | All exit 0; zero audit vulnerabilities | final logs |
| Native typing | Per/limit and Gallery Columns sequential 2.5 becomes 3; ordinary 12, negatives, zero/clear, noninteger gap 2.5 and negative Z-index retained | `native/*.json` |
| Native lifecycle | Focused Columns and edited Columns to repeated Heading select correctly with one inspector, correct breadcrumb and zero errors on Desktop/Tablet/Mobile | `native/selection-final-{focused-field,edited-field}.json` |
| Saved final build | Gallery Fields 3 and List per3 survive reload on all three breakpoints; 3 items, 6 pages, no overflow or console errors | `native/final-build-persistence.json` |
| Gallery | Root accepted 30 behaviors and 24 captures with zero changed pixels | `gallery/` |
| Reviewed baseline | Root recorded reviewed baseline; 24 images/30 sources pass | `logs/baseline-final.log` |

Root viewed the final Mobile selection screenshot; worker independently inspected it. Tab50 CPU rate1, viewport and media cleanup succeeded and were confirmed by root. Root closed obsolete tab48 and stopped its owned4982 server after preserving before/cache evidence. Final tab49 and4984/PID90183 remain preserved.

The 28-entry source/test/reference/artifact manifest has no drift after final builds. The reviewed baseline is frozen separately with its prior HEAD receipt retained. Core source, builder, public snapshots, WordPress golden, compiler and runtime contracts remain unchanged. The core bundle differs from accepted85 only in four esbuild import-path comments caused by unique dependencies; `core-bundle-comment-delta.json` records this. Final cached served UI is byte-exact with current index-derived builder asset f05bdab1e2f12e13bee15f61bec06b4ec84568f84b1e9399d59bf2d3e3b44f34.

## Historical failures and limitations

The initial typing-only audit reported the newly published sanitizer advisory; root separately authorized and reviewed the patch. Initial new-test callback return type errors were corrected, and an early mistaken typecheck report was corrected to root. Historical pre-review suites failed only the expected reviewed-source gate. The first post-lifecycle native attempt was rejected because4982 cached old editorHtml at server startup; rebuilding files did not change its served UI. Fresh4984 was created without state injection and its served asset was checked against prepareHostedEditor output before final acceptance. Historical receipts remain under `typing-only/`, native rejected-attempt files and the cache proof.

No Core/compiler numeric policy change or legacy-data migration. No form submission acceptance implied. No Main, WordPress, browser, baseline recording, commit, push or deployment actions by this worker. Root owns integration/release. Exclude Demo drift and temporary harnesses from integration under existing policy. Work time unknown; billing not prepared.

Review fixture: http://localhost:4984/edit/s1. Final evidence: `verification.json`, `final-receipt.json`, `native/selection-final-mobile.png`.
