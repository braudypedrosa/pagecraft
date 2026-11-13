# CMS schema cleanup 108

Base: `9595855d62bc83302c19d608a16b402c450a0117`

## Change

- Reset Preview to page 1 only when live collection schema cleanup removes the active paginator source, sort field, or filter field.
- Scope deleted-field binding warnings to the collection inherited by each page node, so equal field IDs in another collection are not reported.
- Preserve unrelated bindings. Persisted document clone preparation does not mutate Preview state.

## Verification

- RED: `red.log`, 2 expected failures across 6 tests.
- GREEN: `green.log`, 6 passed.
- Related: `related.log`, 14 passed.
- TypeScript: `typecheck.log`, exit 0.
- `git diff --check`, exit 0.

Native proof is root-owned. Source evidence: `qa-evidence/cms-schema-cleanup-native-2026-10-23` in Main.

## Held

Full suite, generated builds, browser acceptance, commit, push, and integration were not run per task boundary.

## Combined Boolean build and review server

Root merged `Inspector.tsx` and `tests/show-if-boolean-value.test.tsx` into this candidate. Source hashes remained exact during two ordered builder then editor-package builds. Both pairs exited 0; all ten generated files exist and build hash lists match byte-for-byte.

- Static candidate: `http://127.0.0.1:4944/index.html`, PID 66452, exec session 45565, log `static-4944.log`.
- Component gallery: `http://127.0.0.1:4945/internal/components`, PID 66519, exec session 80565, log `gallery-4945.log`.
- Gallery health confirms this candidate root in `gallery-server-health.json`.

Full suite remains root-owned after UI baseline capture.
