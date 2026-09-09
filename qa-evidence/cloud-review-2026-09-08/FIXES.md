# Review fixes deployed — 2026-09-08

Both reviewed defects were fixed and deployed to https://build.itspagecraft.com/.

- Publish preparation now always checks authoritative storage for current membership and source version, including unchanged-publish recovery. A stale process-local cache cannot bypass that check. This adds one authoritative preparation request on the former cached publish path; draft-save caching remains available.
- Password changes send Supabase's `current_password` field. First-password behavior and propagation of provider errors are preserved.

## Source

Branch: `bp/cloud-review-fixes-20260908` in the Cloud repository.
Fix commit: `83f5a5fde277b3d0deedc3f9368783359458e0e1`.
Isolated worktree: `/tmp/pagecraft-cloud-fixes-20260908`.

The branch first records the reviewed deployed runtime because production differs from the older checkout. The deployment uploads only `server/src/app.ts` and `server/src/account-auth.ts`. The same narrow fixes and regression tests were also applied to the main Pagecraft working tree, preserving all existing changes.

## Verification

- Before: six of seven new assertions failed against the unmodified deployed source.
- After: all seven new regression tests passed; 117 tests passed across the focused publishing, auth, gateway, application, and connected-flow suites.
- Six additional relevant account-flow tests passed; 16 unrelated account tests were excluded by an explicit name filter. Total: 123 relevant passing tests.
- TypeScript passed in both the production-matched worktree and main Pagecraft checkout; diff whitespace checks passed.
- Regression coverage: stale cached publication, revoked membership, missing site, valid unchanged pointer recovery, current-password field mapping, provider error propagation, and first-password input.
- Remote Node 24 syntax checks passed before file replacement.
- Original live hashes were checked before backup and replacement. CloudLinux restart returned `result: success`.
- Post-deploy local and remote SHA-256 values match:
  - app.ts: `41d7d267fcf9762f23f2ca818365d6c6629f8465c9c1cef0684cd9ab510391c8`
  - account-auth.ts: `bd0374402a8dc601629e373043eb219dbb70315318d58135c7667a5020f0268f`
- All eight live read-only smoke checks passed after deployment.
- Existing authenticated dashboard loaded in the built-in browser; existing `/braudy/` publication returned HTTP 200.

No customer password was changed or project republished for verification. Password provider behavior and the stale-cache scenario were tested using isolated fixtures; a real password change and concurrent multi-worker production publish were not exercised. The broader source/test mismatches documented in REVIEW.md remain outside these two fixes. This change removes the identified cached authorization/version path; it does not introduce global serialization of independent concurrent publication requests.

## Rollback

Original files: `/home/itspbuku/pagecraft-backups/cloud-review-83f5a5f/before/`.
Candidate files: `/home/itspbuku/pagecraft-backups/cloud-review-83f5a5f/candidate/`.

Restore only `app.ts` and `account-auth.ts` from the before directory to `/home/itspbuku/pagecraft-app/server/src/`, restart the same CloudLinux Node application, and rerun `node tools/smoke.mjs https://build.itspagecraft.com`.
