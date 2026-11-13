# Task close — Inspector fixture animation teardown

- Date and timezone: 2026-10-22, Asia/Manila
- Project: Pagecraft customer QA continuation
- Status: Test-only lifecycle fix verified locally; root review pending
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/responsive-typography-67c6838`
- Owned source: `tests/inspector-first-click-after-blur.test.tsx`; evidence only otherwise
- Delivery: Local only; no commit, push, browser action, WordPress change, dependency install, runtime edit, or rebuild

## Cause and fix

The original full suite passed 2,668 assertions but failed with an unhandled `ReferenceError: cancelAnimationFrame is not defined` from Preact hooks. Its `afterNextFrame` scheduler starts an animation frame and a 35ms fallback timer. This fixture unmounted its inspector and waited only one zero-delay timeout; jsdom could then remove the animation globals while the callback remained scheduled.

The fixture now transparently tracks its requested and cancelled animation frames. After unmounting it waits for a real animation frame and the following timeout turn, asserts that no frame remains, then restores the frame spies and `scrollIntoView`. A following fixture also asserts that no frame survived. Nothing suppresses errors or discards pending callbacks. No shared helper was needed.

## Evidence and checks

| Check | Result | Evidence |
|---|---|---|
| Original full-suite failure | Preserved; 2,668 assertions passed but one unhandled error means failure | `logs/full-suite.log` |
| Bounded cleanup regression before the barrier | Exit 1; the new assertion finds one pending frame after the old zero-delay cleanup | `logs/inspector-lifecycle-red.log`, matching `.exit` |
| Focused fixture after fix | Five fresh runs, two tests each, all exit 0 | `logs/inspector-lifecycle-focused-results.json` |
| Full combined suite after fix | One run; exit 0, 256 files / 2,668 tests passed, two files / five tests skipped, no unhandled errors | `logs/inspector-lifecycle-full-suite.log`, matching `.exit` |
| Typecheck | Exit 0 | `logs/inspector-lifecycle-typecheck.log`, matching `.exit` |
| Frozen runtime/source/test/golden preservation | Existing 13 files unchanged; extended 14-file manifest passes | `freeze-14-with-lifecycle.sha256`, `logs/inspector-lifecycle-freeze-check.log` |
| Scoped diff check | Exit 0 | `logs/inspector-lifecycle-diff-check.log` |

The full command was direct `npx vitest run`; it did not rebuild the root's frozen native acceptance assets. Existing skipped tests and experimental Node localStorage warnings remain. This bounded lifecycle repair does not establish exhaustive lifecycle coverage for every UI fixture or production readiness.

## Handoff and time

Root should review the test diff, retain the original failure and bounded red evidence, and include this fixture and evidence in the next accepted combined release. The production-source freeze remains unchanged. Measured full Vitest execution was 36.24 seconds; total work time is unknown. No billing entry prepared or submitted.
