# Task close — metadata-only site revision history

- Date and timezone: 2026-10-17, Asia/Manila
- Client / project: Pagecraft
- Task reference: staging version-history 500 investigation and approved metadata-only implementation
- Status: awaiting root review and coordinated gateway rollout
- Authorized scope: Store history contract and Memory/Pg/Gateway metadata conversion, Supabase `site.history` metadata SELECT, and focused regressions; no Main writes, database changes, schema changes, deployment, browser work, UI, pagination, or authorization changes
- Environment: isolated local archive only
- Working source: `/private/tmp/pagecraft-history-investigation-24ec`, base `24ec349dcec8182218a03c960f951c15ca83a77f`

## Work performed

- Changed revision history listing to return only site ID, version, saver, and creation time across MemoryStore, PgStore, GatewayStore, and the Supabase gateway operation.
- Preserved full document and context reads through `revision(id, version)` / `site.revision`.
- Added regressions for large gateway history responses, Memory/Pg/Gateway list-versus-detail behavior, API field absence, and the account entitlement caller.
- Files and review artifact: eight source/test files listed in `source-hashes.json`; `history-metadata.patch` SHA-256 `49dc351c03b2559183625894fecee3e72bc4bbfbee885e1a7dcc3cf01a460fac`.
- Delivery state: isolated candidate only; no commit, push, deployment, database write, or schema change.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Red contract tests | unchanged 24ec source with new tests | pass as regression proof: 3 failures / 116 passes, plus MemoryStore 1 intended failure | `red.log`, `red-memory-corrected.log` |
| Focused final | gateway, GatewayStore, PgStore, app/MemoryStore, account entitlements | pass: 123/123 | `green-focused-final.log` |
| TypeScript | full project | pass | `typecheck.log` |
| Deno type check | `pagecraft-db/index.ts` | pass | `deno-check.log` |
| Full suite | isolated candidate | pass: 217 files, 2 skipped; 2423 tests, 5 skipped | `full-suite-final.log` |
| Patch apply | exact 24ec base | pass | `history-metadata.patch` |
| Archive scope | source tree excluding evidence/dependencies | pass: exactly eight intended files differ | `history-metadata-build.json` |
| Main generated guard | protected original 11 | pass: 11/11 byte exact | `main-protected11-final.json` |
| Deno formatting | committed whole gateway file | diagnostic fail from pre-existing unrelated formatting drift; changed SQL hunk was not broadly reformatted | `deno-fmt.log` |

- Execution note: one focused Vitest command was accidentally launched from Main while preparing the added MemoryStore red case. It passed one test with 39 skipped and did not invoke a build. The corrected regression ran from the clean archive and failed on the intended assertion. Main protected outputs remain 11/11 exact.
- Remaining limitations: no staging/browser after-state proof yet; metadata remains unpaginated by approved scope; shared `pagecraft-db-v3` rollout must be coordinated because staging and production use the same function.

## Time evidence

- Tracked or explicitly confirmed total: unknown
- Estimated time: not prepared
- Billing state: not prepared

## Next action and handoff

- Outstanding work: root source review, integration, coordinated shared-gateway rollout, and staging retest of the 773-revision site.
- Owner / dependency: root owns integration and deployment sequencing.
- Restart point: `/private/tmp/pagecraft-history-investigation-24ec/qa-evidence/history-metadata/history-metadata.patch`.
- Client context: no durable client-context change.

## Client-facing summary

The isolated fix prevents the history list from loading every saved document while preserving full one-version restore reads. All focused checks, type checks, and the full test suite pass; staging rollout and visual confirmation remain pending.
