# Empty Default labels — candidate evidence

- Date and timezone: 2026-10-21, Asia/Manila
- Project: Braudy / Pagecraft
- Status: native review accepted; candidate ready for guarded integration
- Base: `e383c592412655fcac4aeefd5675f4bd00c3d70e`
- Checkout: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/empty-default-options`

## Work performed

- Added a real empty `Default` option to Button Weight, Box Distribute, Box Wrap, Background Size, and Background Repeat.
- Kept existing authored choices and all renderer behavior unchanged.
- Strengthened the salvaged regression to select Default directly and prove declaration omission from saved and compiled state, plus Tablet inheritance from Desktop.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Red regression | 5/5 fail before Core change | `red-regression.log` |
| Focused tests | 693/693 pass | `focused-tests.log` |
| TypeScript | pass | `typecheck.log` |
| Full suite | 224 files pass, 2 skipped; 2,485 tests pass, 5 skipped | `full-suite.log` |
| Build determinism | 11/11 required artifacts match across two builds and after suite | `generated-hashes-*.sha256` |
| Dependency audits | 0 vulnerabilities | `npm-audit*.json` |
| Shared UI baseline gate | pass, 24 images / 28 sources | `ui-baseline-gate.log` |
| Impeccable detector | one pre-existing unrelated Core `<img onerror>` warning | `impeccable-detector.json` |
| Diff check | pass | `diff-check.log` |
| Built-in-browser acceptance | pass for initial Default labels, Desktop-to-Tablet inheritance/reset, reload and compiled background omission | Main `native/local-default-labels-acceptance.json` |
| QA harness | reviewed at `http://localhost:4953/`, then stopped and port confirmed closed | session `11515`, PID `21518` |

## Handoff

Native review is accepted. Root owns guarded Main integration, CI, deployment, and WordPress packaging. This takeover worker wrote only the isolated checkout. Root had already restored an earlier worker’s incorrect Main edits. No commit, push, deployment, database, or external account change was made here.
