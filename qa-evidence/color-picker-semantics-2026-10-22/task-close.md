# Task close — Colour picker semantics and focus, candidate87

Date: 2026-10-22, Asia/Manila. Exact base: `2aedc6d5f50cd3bc3dd47d33d4b6b0d8ef0eaa49`.

Status: root source, native and gallery reviews accepted. Final combined checks pass; ready for integration, uncommitted and undeployed. Broader customer QA remains open.

## Changes

The existing picker root declares a dialog role and accessible name “Colour picker”, matching the opening swatch's aria-haspopup promise. It remains nonmodal, without a focus trap or visual redesign.

Initial focus now runs only when the picker opens, separately from event-listener/motion cleanup. Previously, an inspector commit replaced the close callback, reran the shared effect and focused the departing saturation slider. Outside clicks into Padding top/right could close the picker but leave BODY focused. The fix preserves the clicked destination while retaining Escape restoration and keyboard edits. Source changes are limited to ColorPop.tsx; Controls and the mount code are untouched.

Three actual-control semantic regressions failed before the role/name change. Six real mounted-inspector gradient tests failed before the focus change (Padding top/right on Desktop/Tablet/Mobile, asynchronous exit and browser default-focus ordering). All nine now pass; combined focused UI tests pass 81 cases.

## Final evidence

| Check | Result | Evidence |
|---|---|---|
| Full suite | Exit0; 249 files, 2,615 tests pass; 2 files/5 tests skipped | `logs/full-final.log` |
| Builds | 11 artifacts identical across two correct-order builds | `outside-generated-build-{1,2}.sha256` |
| Audit/typecheck/diff | Exit0; zero audit vulnerabilities | outside/final logs |
| Native outside focus | 6/6 pass across three breakpoints; one named gradient dialog closes and clicked Padding destination stays focused | `native/final-outside-focus.json` |
| Native Escape | 3/3 restore actual swatch focus | `native/final-escape.json` |
| Native keyboard/persistence | Hue ArrowRight changes #3366cc to #3361cc; saved reload retains #3361cc | `native/final-keyboard-reload.json` |
| Gallery | 30 behaviors pass; 24 captures have zero changed pixels | `gallery/` |
| Reviewed baseline | Root recorded reviewed baseline; 24 images/30 source files pass | `logs/baseline-final.log` |

Root observed zero console errors and viewed the actual final Mobile picker screenshot; worker inspected the same image. Root explicitly reset gallery tab56 CPU rate to1, cleared viewport and media emulation, received successful empty responses and then closed56. No throttling was enabled during this cycle. Cleanup responses are retained. Root closed old tab54 and verified command/cwd before stopping4986/PID98219; no old listener remains. The 22-entry source/test/reference/artifact manifest has zero drift after the final suite. The reviewed baseline is frozen separately with the previous HEAD receipt retained. Core, Controls, UI mount, builder, WordPress golden, public snapshot and runtime contracts remain unchanged. Four core-bundle source-path comment differences from the dependency symlink are explicitly recorded; all other core-bundle lines are identical.

Fresh4988 started only after final builds. The final served builder asset8177d43f9f75a582bfbfc576a455bc560c1378e88cfc05f1b4f7eb88229d8dda matches the index-derived asset exactly and remains unchanged after the final suite. Final tab55/PID2770/session97895 is preserved for review: http://localhost:4988/edit/s1. Earlier semantics-only receipts and native outside-focus failures remain historical evidence, not final accepted behavior.

No Main, browser, WordPress, baseline recording, commit, push or deployment actions by this worker. Root owns integration/release. Exclude temporary harnesses and Demo drift under existing policy. No full production-readiness claim. Work time unknown; billing not prepared.
