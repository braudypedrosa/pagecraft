# Custom select stale option lifecycle

Base: `7a996d83a131ba0151404d98a3febb234b8bac17`

## Change

Popup option activation resolves the option value against the currently bound native select. This preserves the existing connected, disabled and ownership validation after an open popup survives a same-field select replacement.

## Evidence

- RED: `red.log`, available replacement stayed `default` and popup stayed open.
- GREEN focused lifecycle: 8 tests passed.
- Related custom select and unit controls: 6 files, 36 tests passed.
- Typecheck passed.
- Full suite: 2736 passed, 5 skipped, 1 expected review gate failed. `ui-baselines` requires built-in browser review because `shared/custom-select.js` changed. The reviewed manifest was not updated.
- Impeccable detector returned no findings.
- Two ordered `build.mjs` then `packages/editor/build.mjs` pairs passed. All 10 generated artifacts exist and their SHA-256 manifests match exactly.

## Remaining gate

Root owns the built-in browser gallery review and native acceptance. No browser verification was run in this candidate.
