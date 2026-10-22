# Task close: Video Focus ownership

- Date and timezone: 2026-10-22, Asia/Manila
- Client / project: Braudy / Pagecraft
- Task reference: fix 96, Video authored Focus ownership
- Status: awaiting native review
- Authorized scope: Core Video focus-state CSS and facade focus transfer, focused tests, generated outputs, golden fixture, and local evidence
- Environment: isolated local worktree
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/video-focus-bfe25c5`, base `bfe25c52d103d456a4fb4d7804ce89eb014f42e1`

## Work performed

- Added a zero-specificity Video focus bridge from the styled wrapper to its focus-visible facade button, native video, or iframe.
- Emitted the bridge for local and reusable class Focus declarations at desktop, tablet, and mobile breakpoints.
- Preserved generic reusable Focus, Video Hover, pointer-only resting behavior, and local-over-class order.
- When a keyboard-visible facade button is replaced, the runtime marks and focuses the iframe. Authored Focus remains active while that marked iframe has focus-within. The iframe blur event clears the marker before later pointer re-entry, and parent-visible pointerdown also clears it. Direct pointer activation remains unmarked.
- Updated the official WordPress golden for the generated facade runtime. Three routes changed, plus deterministic release and deployment signatures. The `/` route stayed unchanged.
- Files or artifacts: `app/src/core/index.ts`, `tests/video-focus-state.test.ts`, `server/tests/fixtures/wordpress-artifact-v1.json`, generated outputs, and this evidence folder.
- Delivery state: local generated candidate only. No commit, push, deployment, browser, Main, WordPress, Builder UI, or Inspector changes.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Focused RED/GREEN | Video selectors and facade keyboard/pointer replacement | Expected selector, focus-retention, focus-within, and iframe-blur cleanup failures, then pass 5/5 | `logs/red.log`, `logs/focus-retention-red.log`, `logs/focus-within-marker-red.log`, `logs/iframe-blur-marker-red.log`, `logs/iframe-blur-marker-green.log` |
| Related regressions | Video, Gallery, Nav, Richtext, cascade, Core, boot | Pass, 751/751 | `logs/related-final.log` |
| Typecheck | Repository TypeScript | Pass | `logs/typecheck-iframe-blur.log` |
| WordPress golden | Shared golden vector | Updated officially, then pass 1 with 29 skipped | `logs/wordpress-golden-iframe-blur-update.log`, `logs/wordpress-golden-iframe-blur-verify.log`, `golden-delta.json` |
| Full suite | Repository | Pass, 2712 tests with 5 skipped | `logs/full-suite-iframe-blur.log` |
| Ordered builds | Builder then editor, repeated twice | Pass, all four exits 0 | `logs/build-pair-iframe-blur-1.log`, `logs/build-pair-iframe-blur-2.log` |
| Generated parity | 10 required files | Byte-identical, all exist | `generated-build-iframe-blur-1.sha256`, `generated-build-iframe-blur-2.sha256` |
| Design detector | Changed targets | One pre-existing unrelated Core warning | `design-detector.json` |

- Remaining limitations: Root owns native iframe blur, pointer re-entry, and editor canvas acceptance. Video `playsinline` remains separate.

## Time evidence

- Tracked or explicitly confirmed total: unknown
- Estimated time: not recorded
- Excluded time: unrelated concurrent work
- Billing state: not prepared

## Next action and handoff

- Outstanding work: Reload the final generated build and verify keyboard-opened Focus stays 40px, then focus a sibling and pointer-reenter the iframe to confirm the marker is gone and radius remains Resting.
- Owner / dependency: root agent and native builder harness
- Restart point: `qa-evidence/video-focus-2026-10-22/verification.json`
- Client context: no durable context change

## Client-facing summary

Authored Video Focus styling now follows the component's real keyboard surfaces and stays active when keyboard activation replaces the facade with an iframe. The local candidate is verified and awaits native acceptance.
