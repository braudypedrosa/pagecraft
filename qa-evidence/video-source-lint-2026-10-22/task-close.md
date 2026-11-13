# Task close: Video source Site checks

- Date and timezone: 2026-10-22, Asia/Manila
- Client / project: Braudy / Pagecraft
- Task reference: fix 95, native Video source Site checks gap
- Status: awaiting native review
- Authorized scope: Core lint, focused tests, generated outputs, and local evidence
- Environment: isolated local worktree
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/video-lint-5d80a75`, base `5d80a7513aa2c4ed8d7acb39414f9a969fc187cb`

## Work performed

- Added resolved-context Video lint to the existing render-context media traversal.
- Replaced `inset:0` in both Video fallback styles with WordPress-safe physical edges while preserving every other inline value.
- Invalid sources emit one actionable error. Empty sources emit a separate warning. Valid resolved values clear both findings.
- Moved the existing eager YouTube/Vimeo warning into the same resolved-context traversal.
- Covered page, global, collection-bound, component property, and CMS-overridden sources.
- Files or artifacts: `app/src/core/index.ts`, `tests/video-source-lint.test.ts`, and this evidence folder.
- Delivery state: local generated candidate only. No commit, push, deployment, browser, Main, WordPress, Builder, or Inspector changes.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Focused RED | New Video lint contract | Expected fail, 4 failed and 1 passed | `logs/red.log` |
| Focused GREEN | New Video lint contract | Pass, 5/5 | `logs/green-focused-final.log` |
| Related regressions | Video, Image audit, targeting, Core rendering | Pass, 762/762 | `logs/related.log` |
| Typecheck | Repository TypeScript | Pass | `logs/typecheck.log` |
| WordPress golden | Shared golden vector | Pass, fixture unchanged | `logs/wordpress-golden-check.log` |
| Full suite | Repository | Pass, 2706 passed and 5 skipped | `logs/full-suite.log` |
| Ordered builds | Builder then editor, repeated twice | Pass, all four exits 0 | `logs/build-pair-1.log`, `logs/build-pair-2.log` |
| WordPress fallback RED/GREEN | Empty and invalid Video placeholder HTML | Expected fail, then pass with 39/39 combined Video tests | `logs/wp-placeholder-red.log`, `logs/wp-placeholder-green.log` |
| Final full suite | Repository after fallback change | First run had one unrelated server timeout; isolated test passed; retry passed 2707 with 5 skipped | `logs/full-suite-final.log`, `logs/submissions-timeout-isolation.log`, `logs/full-suite-final-retry.log` |
| Final ordered builds | Builder then editor, repeated twice after fallback change | Pass, all four exits 0 | `logs/build-pair-final-1.log`, `logs/build-pair-final-2.log` |
| Generated parity | 10 required files | Byte-identical, all exist | `generated-build-final-1.sha256`, `generated-build-final-2.sha256` |
| Final freeze | Source, test, golden, and 10 generated files | 13 hashes recorded | `final-freeze.sha256` |

- Remaining limitations: Root owns native Site checks selection and recovery acceptance. Video focus ownership and unmuted file-video `playsinline` remain separate issues.

## Time evidence

- Tracked or explicitly confirmed total: unknown
- Estimated time: not recorded
- Excluded time: unrelated concurrent work
- Billing state: not prepared

## Next action and handoff

- Outstanding work: Integrate the candidate, then verify the Site checks row selects the actual Video node and clears after correction.
- Owner / dependency: root agent and native builder harness
- Restart point: `qa-evidence/video-source-lint-2026-10-22/verification.json`
- Client context: no durable context change

## Client-facing summary

Site checks now report invalid and empty resolved Video sources across normal, global, collection, and component contexts. The local test and build candidate is complete, with final native acceptance still pending.
