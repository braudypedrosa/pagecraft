# Status checkpoint — 20 October 2026

Full customer retesting is incomplete. The current queue tracks fifteen broad areas, with fourteen open and the controlled Local WordPress provider journey complete in its stated scope.

## Fresh read-only verification

- Cloud HEAD is `d4b3dc89cdc5d06f020fcae8a6f4c2df6079fc2b`; the staging deployment marker matches it.
- Production app marker remains `cc026d65d275f16374eb356d0331cebb93430c85`. This does not imply that the separately recorded shared gateway deployment was reverted.
- WordPress repository HEAD is `0bf42bf9ae45f480d9619b306de9142023d5f05c`, the controlled Forms evidence checkpoint. Preview55 is the last verified installed package; no fresh installed-runtime claim was made today.
- The responsive select-label fix is still uncommitted in `app/src/ui/inspector/Controls.tsx`, with its new test in `tests/inspector-responsive-select-readback.test.tsx`. It has not reached staging or WordPress.

## Preserved evidence

The 17 October candidate passed 2,426 tests with five skips, four native local regression cases, and eleven deterministic generated-output comparisons. The controlled Forms journey passed eight cases, with three provider requests and exactly two isolated captured emails. Original fixtures were restored and the temporary provider/mail harness removed.

The earlier temporary candidate directory `/private/tmp/pagecraft-richtext-reset-d4-v1` no longer exists. Recreate clean build archives from the verified base and overlay only the two reviewed source files. Do not run builds or tests in the dirty Main checkout, overwrite protected generated working files, or stage unrelated work.

## Current blocker and next steps

The built-in computer-use inventory returned no connected browsers; opening `iab` returned `Browser is not available: iab`. A Codex browser-panel open was queued, which does not establish a working automation connection. No other browser was used.

Once the built-in browser reconnects: verify source and protected-output hashes; recreate clean builds; commit and push the scoped dropdown fix and required generated outputs; verify staging CI, deployment marker, native responsive reset, keyboard focus, persistence and restoration; then package and test WordPress Preview56. Continue the remaining customer coverage afterward. No production promotion is authorized by this checkpoint.
