# Task close — Rich Text condition values

Internal evidence record.

- Date and timezone: 2026-10-21, Asia/Manila.
- Project: Pagecraft customer acceptance retest.
- Status: Combined local candidate accepted by root native/gallery review and final automated checks. Integration and release remain pending.
- Authorized scope: Fix confirmed builder defects and retest without waiting for additional approval.
- Environment: Isolated local candidate and fictional in-memory diagnostic server. No production or database changes.
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/rich-condition-text-d2c2444`, detached at `d2c244492b100450fdadd5ee66d39ffabc0da919`.

## Work performed

Rich Text conditions now test sanitized, decoded visible text. `has a value` and `is empty` distinguish blank markup from actual words. Equality accepts the visible words while retaining existing exact raw-HTML comparisons; inequality is the exact complement. Plain Text values retain their literal markup and entities. A component property's terminal bound CMS field type takes precedence over the property kind. No author data, schema, sanitizer behavior or rendered content markup was rewritten.

The already locked `entities` 4.5.0 decoder is now a direct dependency. The package-exported decoder-only subpath avoids the unused encoder table. No install was performed, no new transitive package was introduced, and existing locked package entries remain byte-equivalent as parsed JSON. The full BSD-2-Clause notice is retained in the standalone editor, Core and compiler worker. Exported site runtime and compiler client do not contain the decoder.

Files changed: `app/src/core/index.ts`, `app/src/core/safe-html.ts`, `tests/rich-condition-values.test.ts`, `package.json`, `package-lock.json`, `NOTICE`, `vendor/entities/LICENSE`, `build.mjs` and `packages/editor/build.mjs`, plus generated artifacts and this bounded evidence folder. Delivery remains local only.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Corrected regression before implementation | Nine tests failed and two passed, demonstrating the rich semantics gap | `logs/focused-red-corrected.log` |
| Focused comparison, component and artifact tests | Three files, 20 tests passed | `logs/focused-licensed-final.log` |
| Rich-only complete test command | 233 files and 2,518 tests passed; two files and five tests skipped; TypeScript and direct package build-order checks passed | `logs/full-final-marker-max-workers-2.log` |
| Deterministic final build | All 11 artifacts matched across two builds | `generated-final-marker-build-1.sha256`, `generated-final-marker-build-2.sha256` |
| Demo | One component, six instances, four collection items and zero findings | `logs/demo.log` |
| Dependency audit | Zero vulnerabilities at every severity | `logs/audit.json` |
| Existing UI baseline gate | 24 images and 28 source fingerprints passed | `logs/ui-baselines.log` |
| Source and generated artifact freeze | Every recorded hash remained unchanged after the final suite | `source-and-generated-final.sha256` |
| Diff whitespace | Passed | `git diff --check` |
| Rich-only final native browser acceptance | Root accepted all four operators, real reload and actual Mobile414 without overflow | `native/local-final-acceptance.json` |

The first license-banner placement preceded the existing startup marker. Nineteen host-mode tests then booted without their injected configuration and failed. The notice was moved after the original header and strict-mode directive, preserving the startup marker. The final full suite passed after that correction. This test-injection failure is recorded rather than presented as a separately reproduced hosted product defect.

The complete entity decoder adds 128,300 raw bytes and 49,744 gzip bytes to the standalone editor compared with the base commit. Core adds 64,763 raw bytes and 25,339 gzip bytes. The final compiler worker is self-contained. See `bundle-size-delta-final-marker.json`.

Earlier logs and native checks are historical or explicitly interim. The initial regression log contains a corrected test-call API mistake; the corrected red log is authoritative. Root also rejected an initial native fill-only comparison probe because the value did not persist. Its later typed-and-blurred equality, inequality and blank-markup probes are the accepted failure evidence.

## Time evidence

Total duration is unknown. Billing was not prepared. No work duration is inferred from timestamps.

## Next action and handoff

Root owns integration, deployment and WordPress parity. The Rich-only PID95438/session29108 harness is historical and was replaced with root authorization. The current combined fictional server runs at `http://localhost:4964/edit/s1`, PID12812/session93905. No browser actions were performed by this worker.

Exclude Demo drift, temporary `tools/.qa-ui-4964.mjs`, and untracked compiler JavaScript outputs from direct Main integration. Preserve the main checkout's unrelated working bytes. No commit, push, Main, WordPress or database change was performed by this worker.

A separate future usability gap remains: an empty Rich Text element whose condition is off can have zero canvas height and cannot be selected by clicking it; root used Components/Edit. That issue is outside this condition-value fix. Overall production QA remains incomplete.

## Combined modal-notification integration

Root copied the reviewed `shared/action-feedback.js`, updated `tests/action-feedback.test.ts`, new `tests/modal-notification-layout.test.ts`, and bounded modal-toast evidence into this candidate. This worker made no source edits in that combined phase. The shared feedback change lets notifications yield space to dialog choices. Root owns the actual browser geometry and visual acceptance.

Combined focused checks passed five files and 48 tests. TypeScript, two deterministic builds of all 11 artifacts, the zero-finding demo and zero-vulnerability audit passed. The complete pre-gallery run passed 2,520 tests with five skipped; its sole failure is the expected UI-baseline source fingerprint gate for `shared/action-feedback.js`. There were no behavioral failures. All source and generated hashes remained frozen after the full run. Pure Core `dist/core.cjs` remains byte-identical to the Rich-only final build.

See `combined-verification.json`, `source-and-generated-combined.sha256`, `generated-combined-build-1.sha256`, `generated-combined-build-2.sha256`, and `logs/combined-full-pre-gallery-max-workers-2.log`. The Rich-only native proof remains accurately labeled as preceding the extra UI patch. A fresh fictional combined harness runs on port4964, PID12812/session93905. The final acceptance below supersedes the earlier pending-review status.

## Final reviewed combined acceptance

After root recorded the fresh built-in-browser gallery, the final complete command passed 234 test files and 2,521 tests; two files and five tests were skipped. TypeScript and the direct package build-order regression passed in that command. The run took 100.27 seconds with two workers. Every combined source and generated artifact hash remained unchanged afterward. See `logs/combined-full-final-reviewed-max-workers-2.log` and `source-and-generated-combined-final.sha256`.

Root's native geometry evidence shows the live dialog notice region below the footer at actual 1280×720 and 768×480 viewports. The dialog action receives pointer hit testing. The constrained notice region scrolls, and the dialog body retains its scroll behavior. Fresh gallery behavior checks pass 30/30; all 24 captures are byte- and pixel-identical to the reviewed baseline. The baseline gate passes for 24 images and 28 source files.

An initial gallery Retry refresh click did not clear the error; a later direct click did. Its cause remains unconfirmed. Three fresh native probes gated on gallery readiness cleared the error. The initial failure and follow-up probes are preserved in `../modal-toast-2026-10-21/gallery/behavior-initial-attempt.json` and `refresh-recovery-probes.json`; no product change is inferred from that intermittent result. The earlier 19 startup-marker test failures and their corrected notice placement remain documented above.

The combined candidate is ready for root integration. No Main, WordPress, browser, database, commit or push changes were performed by this worker. Overall customer QA and production readiness remain outside this bounded completion.
