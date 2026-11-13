# Task close — Preview runtime cleanup and new-module inspector routing

Internal evidence record.

- Date and timezone: 2026-10-20, Asia/Manila
- Client / project: Braudy / Pagecraft
- Task reference: Codex customer QA continuation; Preview teardown defect and Embed insertion follow-up
- Status: awaiting review
- Authorized scope: local implementation in a new isolated checkout at exact Cloud source commit 409f698; builder Preview disposer, date runtime teardown, narrow palette insertion tab fix, focused tests, required builds and verification
- Environment: local fictional fixture server at http://localhost:4944/
- Working source: /Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/preview-date-cleanup; detached base 409f6989a47c2b6b95a515b2df61e0f650ce4432

## Work performed

- Added one compiler-owned Preview disposer registrar. Date controls unsubscribe, stop their Zag machine, remove direct listeners and portal state before generic Preview cleanup.
- Palette insertion now opens the new module's Content inspector. Ordinary selection remains on the selected Style or Advanced tab.
- Added focused regressions for date teardown and re-entry, select teardown, and Embed insertion routing.
- Files and hashes are recorded in verification.json in this directory.
- Delivery state: local only; uncommitted, unpushed, undeployed.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Before/after leak probe | JSDOM Preview teardown, open date picker | pass | before.json and after.json; runtime globals 6 to 0, live announcers 1 to 0 |
| Focused tests | date/select runtime and insertion routing | pass | focused-tests.log; 19/19 |
| TypeScript | repository | pass | typecheck.log |
| Full suite | repository | expected review gate only | full-suite.log; 2,444 pass, 5 skip; sole failure is reviewed-gallery source gate for builder.html |
| Deterministic package build | 11 generated outputs, two sequential builds | pass | editor-build-one.sha256 and editor-build-two.sha256 are identical |
| Demo build | generated demo | pass | demo.log; 0 findings |
| Dependency audit | all and production dependencies | pass | npm-audit.json and npm-audit-production.json; 0 vulnerabilities |
| Native built-in browser | local QA server | pending root review | http://localhost:4944/ |

- Remaining limitations: root owns native browser acceptance, gallery review/manifest, integration into Main, WordPress handoff, commit and deployment.

## Time evidence

- Tracked or explicitly confirmed total: unknown
- Estimated time: not prepared
- Excluded time: unrelated parallel QA and waiting
- Billing state: not prepared

## Next action and handoff

- Outstanding work: native open/exit/re-enter acceptance and Embed Advanced-to-Content acceptance, then reviewed gallery update and integration.
- Owner / dependency: root agent.
- Restart point: http://localhost:4944/; server session 67994; verification.json.
- Client context: no durable client-context change.

## Client-facing summary

Preview exit now fully stops the date picker runtime and removes its hidden announcer and deferred global listeners; a fresh Preview can initialize again. Newly inserted Embed modules open directly on Content while ordinary selection keeps the chosen inspector tab.

## Root integration acceptance

Root reviewed source, all 24 gallery captures and eight native cleanup/insertion cases. Final suite: 2,445 passed, five skipped. No pixel changes. Native shared-button mixed typography and appearance changes passed at desktop/tablet/mobile, including four page/component users, undo, reload and Preview. Fixture restored from version 897; all 41 IDs and compiled CSS match. Broader QA remains open.
