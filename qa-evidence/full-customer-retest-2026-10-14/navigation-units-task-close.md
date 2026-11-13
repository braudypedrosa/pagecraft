# Task close — Navigation and Unit control integration

Internal evidence record.

- Date and timezone: 2026-10-17, Asia/Manila
- Parent commit: `75ed8acb11bb3297d4889f3edade56d6af31807e`
- Status: final clean-archive verification complete; native, packaging, commit, and deployment remain root-owned
- Archives: `/tmp/pagecraft-nav-units-one-75ed`, `/tmp/pagecraft-nav-units-two-75ed`
- Frozen source/test overlays: eight files recorded in `navigation-units-build.json`

## Result

Both independent clean archives contain byte-identical copies of the approved eight files. Each archive installed from the lockfile, built the editor package and demo, passed TypeScript, passed the focused compiler/UnitCtl/Collection/box/Gallery/shared-combination set, and produced deterministic generated outputs. The signed WordPress candidate stayed byte-identical to the approved `6188d0fd…` fixture.

The provisional full suite correctly preserved two pre-gate failures. The new Collection Wrap condition initially exposed the old 33-declaration matrix, and the Inspector source fingerprint required reviewed gallery baselines. Root supplied an eighth coverage-only overlay that tests Slider-off/Grid-on and 34/34 conditional declarations; it passes in both archives. Root then ran the built-in gallery: 30/30 behaviors and 24/24 pixel comparisons passed with zero changed pixels, and root viewed four full-size representative captures before recording and copying the 25 reviewed baseline files to main and both archives.

After those gates, archive ONE's final full suite passed 215 files and 2,399 tests, with 2 files and 5 tests skipped. Archive TWO independently passed the two baseline checks. Main, archive ONE, and archive TWO remain exact for all eight overlays and all 25 reviewed baseline files; the 11 generated candidate outputs are deterministic between archives; the protected main 11 remain unchanged.

## Verification

| Check | Result |
|---|---|
| Independent `npm ci --ignore-scripts` | Both pass; existing three high-severity advisories unchanged |
| Editor-package and demo builds | Both pass |
| TypeScript | Both pass |
| Focused integration | Both pass: 6 files, 22 tests |
| Conditional-control matrix | Both pass: 5 tests; 34/34 declarations |
| WordPress golden candidate | Both pass; exact `6188d0fd6628667b54b0e1495f55195e31e3c2cf405f0aadabace69f9353a8b4` |
| Generated determinism | 11/11 outputs exact between archives |
| Reviewed gallery | 30/30 behaviors; 24/24 pixel exact, zero changed pixels; 25 baseline files exact across main and both archives |
| Independent archive TWO baseline check | Pass: 2 tests, 24 images, 28 source files |
| Final full suite, archive ONE | Pass: 215 files / 2 skipped; 2,399 tests / 5 skipped |
| Eight overlays | Main/archive ONE/archive TWO byte-exact |
| Protected main generated guard | 11/11 exact before and after every archive operation |

## Boundaries

This worker ran every npm, build, and test command from a resolved archive path outside the main checkout. Root owned the built-in-browser capture and visual review. No main build/test command, protected generated write, WordPress action, main golden write, commit, push, package, install, staging, or production action occurred.
