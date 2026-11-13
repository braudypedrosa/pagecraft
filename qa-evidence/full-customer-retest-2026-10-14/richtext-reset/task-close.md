# Task close — RichText responsive reset select readback

- Date and timezone: 2026-10-17, Asia/Manila
- Project: Pagecraft
- Status: isolated candidate built and ready for root native review
- Authorized scope: `Controls.tsx`, focused test, clean builds/tests, deterministic outputs, and loopback static preview; no Main writes, commit, push, deployment, Supabase, or WordPress operations
- Working sources: `/private/tmp/pagecraft-richtext-reset-d4-v1` and `/private/tmp/pagecraft-richtext-reset-d4-v2`, base `d4b3dc89cdc5d06f020fcae8a6f4c2df6079fc2b`

## Work performed

- Keyed Unit and Box unit selects by editing scope and resolved unit.
- Keyed preset Font select by editing scope and selected option.
- Left shared custom-select implementation unchanged. Existing replacement/rebind logic now refreshes the visible trigger.
- Added focused regressions matching Mobile override reset to inherited Tablet values, Box reset, known Font preset reset, and empty-unit scope behavior.
- Built two independent archives and compared all 11 expected generated outputs.
- Delivery state: isolated built candidate only.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Old source regression | 2 meaningful failures, 1 pass | `red-final.log` |
| Focused controls/custom-select suite | 43/43 pass across 8 files | `green-focused-final.log` |
| Full suite | 218 files passed, 2 skipped; 2426 tests passed, 5 skipped | `full-suite.log` |
| TypeScript | pass | `typecheck.log` |
| Editor package builds | both pass | `one-editor-build.log`, second archive `two-editor-build.log` |
| Demo builds | both pass | `one-demo-build.log`, second archive `two-demo-build.log` |
| Generated outputs | 11/11 byte exact across archives | `generated-determinism.json` |
| Candidate source | exactly 2 reviewed files, byte exact across archives | `source-freeze-final.json` |
| Main protected generated files | 11/11 byte exact after all builds | `main-protected11-after-builds.json` |

- Confirmed impact: visible enhanced label was stale. Hidden native select and emitted CSS already used inherited unit. Tests do not claim incorrect CSS persistence.
- Remaining limitations: root-owned native candidate verification and Main integration remain pending.

## Next action and handoff

- Root reviews static candidate on loopback, then copies two source files and approved generated outputs into Main.
- Root owns browser proof, QA documents, commit, deployment, and staging retest.
