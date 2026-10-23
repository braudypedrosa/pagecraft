# Animation state release 110

## Scope

- Candidate: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/animation-state-release-fbb5f50`
- Base: `fbb5f50e352039898fad6214d8d2623a8ee57c12`
- Source changes: `app/src/core/anim.ts`, `tests/animation-runtime.test.ts`
- Browser, Main, WordPress, database, commit and push work were excluded.

## Verification

- Focused animation tests: 15 passed across 3 files.
- TypeScript typecheck: passed.
- Ordered build pair 1: builder 0, editor package 0.
- Ordered build pair 2: builder 0, editor package 0.
- Generated artifact parity: all 10 required files exist and both build pairs match exactly.
- Full chain `npm test -- --maxWorkers=4`: exit 1. Build-order and typecheck passed. Vitest: 268 files total, 264 passed, 2 failed, 2 skipped; 2760 tests total, 2753 passed, 2 failed, 5 skipped.
- Failure 1: `tests/core.test.ts` expects the old `.pc-fade-in{` selector. The intended source now gates initial state with `:where(:not(.bp-is-done-animating))`.
- Failure 2: `server/tests/releases.test.ts` detects the intentional Core CSS and derived WordPress golden signature changes. Golden was left unchanged for root review.
- Post-suite freeze: source hashes unchanged; all 10 generated outputs still match build pair 2.

## Frozen source hashes

- `app/src/core/anim.ts`: `0bdf30f2e548ae68f5546d8362a5d07e65d5ece3c66fe8d871b9b5e15998297f`
- `tests/animation-runtime.test.ts`: `5db32514bcc65800ba41ef4b9e9cf77f45064d2b65b86b51ed5989a67964194c`

## Review server

- URL: `http://127.0.0.1:4946/index.html`
- PID: `86794`
- Exec session: `48459`
- Command: `python3 -m http.server 4946 --bind 127.0.0.1`
- Candidate root only. No browser was launched.

## Remaining verification

- Root owns the native once/repeat, reduced-motion, keyboard Focus and Hover completion checks, shared gallery gates, golden review and integration.
- Manual trigger once behavior and reduced-motion class cleanup remain pre-existing questions and were not expanded without native contract proof.

## Contract resolution

- Preserved the first full-suite failure log.
- Strengthened `tests/core.test.ts` to verify the completed-state gate, the legacy Fade out selector, and the absence of a Fade out release gate.
- Regenerated the official WordPress fixture only through `PAGECRAFT_UPDATE_WORDPRESS_GOLDEN=1`.
- Semantic fixture review is recorded in `wordpress-golden-semantic-diff.md`.
- Focused Core and release contracts: 688 passed.
- Final full chain: exit 0; 266 files passed and 2 skipped; 2755 tests passed and 5 skipped.
- Generated10 remain byte-equivalent to ordered build pair 2.
