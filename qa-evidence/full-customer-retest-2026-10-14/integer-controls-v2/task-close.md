# Integer controls v2 verification

- Two clean exports from `02979a836aff95253ee01cecb6dc92b37b2abe6e` contain exactly the five reviewed v2 overlays.
- Both clean installs, editor/demo builds, TypeScript checks, 31 focused tests, and unchanged WordPress golden passed.
- Root built-in-browser gallery review passed 30/30 behavior checks and 24/24 screenshots with zero changed pixels; root visually reviewed Builder fields at 1440px and 768px. The initial wrong-base harness failure is retained and classified as a dashboard route error, not a product failure.
- All 25 reviewed baseline files are byte-exact across exports. Export TWO independently reports 24 images and 28 source files verified.
- Final export ONE suite: 217 files passed, 2 skipped; 2421 tests passed, 5 skipped.
- All 11 generated outputs remain deterministic; the five reviewed sources and main protected 11 remain exact.
- Root local native v2 acceptance passed 24 cases: scientific/fractional/minimum count handling, responsive inheritance, Z-index formats, position and fractional-length preservation, Undo/Redo, scientific-length remount, and fresh responsive reload. Evidence is `qa-evidence/full-customer-retest-2026-10-14/native/local-integer-v2-acceptance.json` with `local-integer-v2-mobile.jpg`. The fixture Gallery was empty; staging acceptance with real Gallery images remains pending.
- No main build/test, source integration, commit, package, staging, or WordPress action occurred here. Integration and staging remain with root.
