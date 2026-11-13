# Candidate88 final receipt

## Frozen verification

- Prior baseline-gate run is preserved in verification.json. Final `npm test` passed — 250 files passed, 2 skipped; 2,620 tests passed, 5 skipped.
- Typecheck: `npx tsc --noEmit` passed.
- Audit: `npm audit --audit-level=moderate` passed with 0 vulnerabilities.
- Diff check: `git diff --check -- app/src/ui/inspector/Inspector.tsx tests/inspector-motion-validation.test.tsx` passed.
- Source manifest: `source-tests-assets.sha256` has 25 entries; all recorded hashes match current files, including the complete 11 generated artifacts.
- UI baseline is separate. Pre-review HEAD manifest hash: `7353c03d7c755083feedeb1e4de5b0b28c1d52b33c68add954e4824fb14b2c7b`. Current reviewed baseline hash: `584512e291385edd8f24f274913827c92c65d4ae9f36ce1a3796179313d08292`. The earlier receipt was corrected after a temporary reset to the frozen candidate87 manifest; the current `ui-baselines check` result is authoritative. Baseline check passed: 24 images and 30 source files.

## Native acceptance receipt

Root-owned native verification accepted the Motion cases in `native/`: invalid duration is local and reloads blank; invalid duration/delay/easing retain the last valid public attributes; character typing accepts `1200ms`, `-0.2s`, and `steps(2, jump-none)`; modern `calc()`/`linear()` values reload and compute correctly; zero/clear reload safely; Undo/Redo/Clear work; same-kind clone draft isolation passes; final mobile validation was reviewed. Native error count was 0. Gallery review recorded 30 interaction checks, 24 captures, and 30 source fingerprints; all 24 captures passed review.

CDP cleanup receipt: CPU throttling reset response `{}` at rate 1, viewport emulation cleared, media emulation cleared, and the owned session was closed.

The served asset check remains at `http://localhost:4991/edit/s1`, PID 11811, with all 7 prepared hosted assets byte/hash equal. Stop that process after final review.
