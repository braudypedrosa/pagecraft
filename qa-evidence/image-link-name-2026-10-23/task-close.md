# Linked decorative Image accessible name

## Result

A linked decorative Image keeps `alt=""`. When its explicit Link label is blank and it has a nonblank visible caption, the link now references that caption with `aria-labelledby`. An explicit Link label remains authoritative through `aria-label`. With neither value, the link remains unnamed and Site Checks keeps the existing `image-link-no-label` error.

The exact 3b75640 Inspector schema already contains Link label. A full Inspector regression confirms it appears after both supported authoring orders: Decorative then URL, and URL then Decorative. No UI source changed.

## Scope

- `app/src/core/index.ts`
- `tests/image-link-accessibility.test.tsx`
- Ten build-derived artifacts listed in `generated-current.sha256`

No Main, WordPress, browser state, runtime installation or database changed.

## Verification

- RED: 3 expected failures across 5 tests for missing caption reference, lint rejection and bound-caption output.
- Focused plus Core GREEN: 664/664.
- Full suite with two workers: 271 files passed, 2 skipped; 2784 tests passed, 5 skipped; exit 0.
- Two ordered `npm run build` then `npm run build:editor-package` pairs passed.
- All ten generated files exist. Pair one, pair two and post-suite hashes match exactly.
- TypeScript, build-order guard and `git diff --check` passed.
- Official WordPress golden remained unchanged and passed in the full suite.

## Native review helper

- URL: `http://127.0.0.1:4950/index.html`
- Candidate root: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/image-link-name-3b75640`
- Owned PID: `67897`
- Command: `python3 -m http.server 4950 --bind 127.0.0.1`
- Log: `static-server-4950.log`

PID cwd, listener ownership and HTTP 200 were verified. Root owns native import and will signal cleanup.

## Remaining gate

Root owns native editor and WordPress public acceptance and integration. A caption can describe the image rather than the destination, so the explicit Link label remains the preferred author control and overrides the caption fallback.
