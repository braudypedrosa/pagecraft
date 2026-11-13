# Independent test audit

Date: 12 November 2026 (Asia/Manila)

## Run

- Command: `npm test` in the template-authoring worktree.
- Exit code: 1.
- Build-order probe passed and regenerated the editor package; `tsc --noEmit` passed.
- Vitest: 5 failed files/suites, 4 failed tests, 3,078 passed, 20 skipped (316 files, 3,102 tests), 181.07 seconds.
- The run overlapped a parent `npm run build` and concurrent edits to server-owned implementation/tests. Treat it as failure inventory, not final integrated verification. A clean rerun is required after shared work settles.

## Failures and required follow-up

1. `tests/ui-baselines.test.mjs`: source fingerprint check says `builder.html` changed. Current hash is `daff032ba5b1f7b9a4dab0d41e7da088460073f0da5f9ee618df7a7d7a51aea3`; manifest hash is `5c0068b5f72ae972591a3d91688c022de5165751d2541a446d29ab5d2c8cd918`. Follow `docs/component-gallery.md`: rebuild current editor, capture the complete gallery through the built-in browser, run behavior checks, compare all 24 captures, visually inspect, then record only after review. No baseline was recorded in this audit.
2. `server/tests/template-authoring.test.ts:119`: expected HTTP 422 for unsupported schema version, got 500. `validateTemplateDraftDocument` raises a plain `Error` from `server/src/template-draft-validation.ts:8,18`; route save at `server/src/template-authoring-routes.ts:144` has no route-level mapping for that validation error. Preserve a typed validation error and map it to client 422. The same test also checks missing draft 404 and invalid image bytes 422 after this assertion.
3. `server/tests/template-draft-store.test.ts:66`: “enforces a per-draft budget without advancing the revision” unexpectedly resolved with revision 2. The test sets the budget to revision-1 file size + 100 bytes; `server/src/template-draft-store.ts:102-113` sums existing revision and candidate bytes. This conflicts with the observed pass path and needs isolated reproduction after current store edits settle.
4. `server/tests/submissions.test.ts:247`: synthetic legacy inbox test exceeded its 30-second timeout. It creates 10,000 files, then performs 250 failed-entry writes and pruning operations. Rerun standalone to separate resource contention from a genuine scan/pruning regression; inspect `FileSubmissionStore.add/stored/pruneFailed` in `server/src/submissions.ts:118-176` if reproducible.
5. `server/tests/gateway-db.test.ts:117`: `beforeAll` exceeded Vitest's 10-second hook timeout while creating PGlite and applying migrations; 15 suite cases were skipped. Rerun standalone; if still slow, make the test's hook timeout reflect measured migration runtime rather than skipping coverage.

## Limits

No test fixtures or production source were changed. No UI baseline was refreshed. The initial run overlapped a build and concurrent server edits; see the bounded isolated rerun below for updated classifications.

## Bounded isolated rerun

After the server worker completed, ran only the four affected files with `npx vitest run --maxWorkers=1 --no-file-parallelism ...` (one worker). An initial attempt used unsupported Vitest flag `--minWorkers` and did not run tests.

- Result: 3 files passed, 1 failed; 38 tests passed, 1 failed; exit code 1; 60.88 seconds.
- `server/tests/template-authoring.test.ts`: passed. The schema-version HTTP mapping failure no longer reproduces after the server worker changes.
- `server/tests/template-draft-store.test.ts`: passed. The storage budget failure no longer reproduces.
- `server/tests/gateway-db.test.ts`: passed, including migrations; the 10-second setup timeout no longer reproduces without broad suite load.
- `server/tests/submissions.test.ts`: the combined focused run timed out at line 247, but a direct Node reproduction completed fixture creation in 0.93s, migration/first add in 0.42s, and the 250 capped failed writes in 1.08s. After another isolated test run, `npx vitest run --maxWorkers=1 --no-file-parallelism server/tests/submissions.test.ts -t 'failed attempts never fill the inbox'` passed (1 test, 5.40s test time, 6.54s total). The source is identical to base, and evidence points to transient test-runner contention rather than an established production regression. No timeout or production changes were made.

This focused rerun did not replace the full suite after integration or include gallery browser review. Temporary timing markers were added to the owned test during diagnosis and removed before completion; a second isolated passing rerun was run after removing them.

## Final integrated verification

After the sources were frozen and gallery behavior/capture review plus 24-image comparison were completed and recorded by the main agent:

- `npm test`: exit 0. Build-order probe passed, `tsc --noEmit` passed, gallery baseline check passed, and Vitest passed 314 files with 2 skipped; 3,097 tests passed, 5 skipped. Duration 116.48s.
- `node tools/demo-site.mjs`: exit 0. Generated `dist/demo/index.html` (66 KB), one component, six instances, four collection items, zero findings.
- `python3 -m unittest discover -s tools/deploy -p 'test_*.py'`: exit 0, 45 tests passed in 1.479s.

This final integrated run supersedes the initial failure inventory for current source. No source or test changes were made during this audit, and no baseline was recorded by this agent.

## Rebased Wave 3 verification

After rebasing onto remote development commit `64009f2` and rebuilding generated editor artifacts, ran `npm test` again while the main agent was capturing the current gallery.

- Build-order probe passed and generated editor bundle refreshed. `tsc --noEmit` passed.
- Vitest exit code 1 solely because `tests/ui-baselines.test.mjs` detects the expected `builder.html` fingerprint change and requests review. All other tests passed: 316 files passed, 2 skipped, 1 failed; 3,116 tests passed, 5 skipped, 1 failed. Duration 102.12s.
- The gallery comparison against the newly captured revision and reviewed baseline record/check are still required before a green full `npm test`. This audit did not alter or record baselines.
