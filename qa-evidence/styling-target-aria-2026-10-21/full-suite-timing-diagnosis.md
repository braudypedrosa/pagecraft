# Full-suite timing diagnosis

## Exact failures

The final default-concurrency `npm test` run completed in 89.83 seconds with 2,482 passing and 19 skipped tests. It had two timing failures in addition to the separately expected Inspector source-fingerprint gate:

1. `server/tests/gateway-db.test.ts` timed out in its `beforeAll` hook at the Vitest default 10,000 ms hook limit. The file reported 14 skipped tests and 18,309 ms elapsed. The timed hook creates a PGlite database, creates roles and storage tables, runs every sorted Supabase SQL migration, seeds gateway configuration, then dynamically imports and initializes the Deno gateway handler.
2. `server/tests/store-pg.test.ts` timed out in `owned-site creation commits the site, revision and membership together and enforces its quota` at the configured 15,000 ms test limit. The individual test reported 15,675 ms and the file reported 88,982 ms. Its first operation calls `fresh()`, which creates a new PGlite instance and initializes site, auth, and asset schemas before running the ownership transaction assertions.

The complete output is in `logs/full-final.log`.

## Configuration and contention evidence

- `vitest.config.ts` configures `testTimeout: 15_000` and Node as the default environment. It does not configure `hookTimeout`, `maxWorkers`, a serial sequence, or `fileParallelism`.
- Vitest 4.1.11 reports the default pool as `forks`, file parallelism enabled, and a 10,000 ms default hook limit in the observed error.
- The machine exposes 14 logical processors, so the 231-file suite can run many independent file workers while PGlite-backed suites initialize WebAssembly databases and schemas.
- At least six server test files call `PGlite.create()`. `store-pg.test.ts` creates a fresh database per test across a 34-test file; `gateway-db.test.ts` also applies the full migration directory during setup.
- Immediately after the combined failure, the two exact files passed together without code, configuration, timeout, or threshold changes: 48/48 tests in 16.00 seconds wall time. This is recorded in `logs/server-timeout-retry.log`.
- The failed `store-pg` case exceeded its limit by only 675 ms. The failure moved from a test assertion to elapsed-time enforcement, and the same behavior passed when competing suite work was removed.

These observations support CPU/memory/WASM-startup contention as the likely cause. They do not prove the scheduler or a specific competing worker was responsible because the failing run did not capture per-worker resource telemetry. There is no evidence here of a deterministic product or SQL-contract failure.

## Final rerun plan after gallery review

1. Wait until gallery capture, baseline recording, builds, and other test jobs are complete. Keep the candidate source and generated files frozen.
2. Run the unchanged `npm test` once with its normal configuration and capture the complete output as the final-suite log. Do not raise timeouts, reduce assertions, or change worker settings for the release result.
3. If either PGlite timing failure recurs, preserve the failed log, then run only `server/tests/gateway-db.test.ts` and `server/tests/store-pg.test.ts` once with the same test limits. Report the default full-suite failure and focused result separately; do not substitute the focused pass for a clean full suite.
4. Run the baseline check against the root-reviewed manifest. No rebuild is needed merely to rerun the tests unless the reviewed manifest or source changes.

## Generated-byte guard

This diagnosis changed only this Markdown evidence note. No build or generator was run, and no source, test, baseline, or generated artifact was edited.

## Bounded-worker diagnostic

After the reviewed gallery, the complete unchanged suite was run once as `npm test -- --maxWorkers=2`. It passed: 229 test files passed, 2 skipped; 2,498 tests passed, 5 skipped; 206.94 seconds total. The diagnostic changed only Vitest's command-line worker cap. It did not change source, configuration, assertions, or timeouts.

This materially strengthens the contention diagnosis: the same complete suite that timed out under default file parallelism passed under two workers. It does not replace the reported default-concurrency result, which remains 2,497 passed, 5 skipped, and one submissions stress-test timeout.
