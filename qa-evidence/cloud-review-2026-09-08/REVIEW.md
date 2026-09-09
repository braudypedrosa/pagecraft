# Pagecraft Cloud code review — 2026-09-08

Verdict: the live service is available, but the review found two reproducible defects. Do not treat the passing checkout suite as proof that every production flow works.

No application fixes, deployment, account changes, project saves, or publishes were performed. Only review evidence was added to this workspace. Existing work was preserved.

## Findings

### P1 — Cached unchanged publishes can roll the public site back

Deployed source: `deployed-source/app.ts:2056-2063,2087-2097`; cache implementation: `deployed-source/store-gateway.ts:236,1737-1757`.

The publish handler accepts an owner/site snapshot from a process-local cache retained for four hours. Its source-version comparison then compares the request with that cached snapshot. If the cached version already has a publication, the handler promotes it and returns `unchanged` without calling the authoritative preparation or publish operation.

Trigger: worker A caches published version 2; another worker publishes version 3; a stale version-2 request reaches A. A promotes the old publication even though version 3 was public. The public file pointer and database publication state can now disagree. This also bypasses the normal current-membership check for this branch.

Reproduced locally with the actual GatewayHostedPublishPreparer/GatewayStore cache implementation and FileHostedPublicationStore, a synthetic gateway response, and disposable publication files: public version 3 became version 2; HTTP 200 `unchanged`; zero database checks during that publish request. No live site was used in this test. This demonstrates the multi-worker stale-cache condition; it does not establish that an actual customer has encountered it.

Recommendation: validate current authorization, source version, and winning publication against the database before the unchanged early return. Make promotion reject a superseded publication under concurrent requests rather than blindly replacing the routing pointer.

### P1 — Current password is not passed using the Supabase API field

Deployed source: `deployed-source/account-auth.ts:151-155`.

`updatePassword` passes `{ password, currentPassword }` into `auth.updateUser`. The installed Supabase SDK's UserAttributes type and current documentation use `current_password`. Its implementation forwards the attributes unchanged, so there is no automatic camel-case conversion.

Consequences depend on Supabase configuration: if current-password verification is required, valid changes can be rejected because the expected field is missing; otherwise, the supplied current password is not the verification input that the form claims to check. The exact live auth configuration was not read and no real password change was attempted.

Reproduced by capturing the real adapter's SDK call in isolation: `current_password` was absent and `currentPassword` was present. Existing account tests use a fake AccountAuth and therefore do not cover this adapter mapping.

Recommendation: send `current_password`, add an adapter-level regression test for the outgoing payload, and validate incorrect/current-password behavior with a disposable email/password account. Review the ordinary-session versus recovery-session policy for `/auth/reset-password` at the same time; it calls `updateUser({password})` separately.

Reference: https://supabase.com/docs/guides/auth/passwords#verifying-the-current-password

## Verification

- Clean older Cloud checkout `/Users/braudypedorsa/Projects/pagecraft-cloud-api`, commit `66df224`: build, TypeScript, and test suite passed; 1,080 tests passed and 4 PostgreSQL integration tests skipped.
- Downloaded production runtime source into `/tmp/pagecraft-cloud-review-20260908/candidate`, preserving the local repositories. TypeScript passed using the local installed dependencies.
- Focused tests against that snapshot: 203 passed across 11 files, including auth, access control, assets, content, public serving/publications, gateway transport, packages, connected flows, and the two finding reproductions. Re-ran the two reproductions after strengthening the cache test to use the actual gateway cache and filesystem publication implementations: both confirmed.
- A broader run against the main repository's tests produced nine failures. They are not nine confirmed Cloud defects: missing packaged editor artifact (1), older account markup expectations (2), shared-editor border/control expectations (4), WordPress-only busy-save recovery absent from the deployed editor (1), and a release golden-vector mismatch (1). The isolated snapshot intentionally retained deployed code and did not rebuild its editor or regenerate golden fixtures. These require source/test alignment before a complete production-equivalent suite can be considered green.
- All eight observable live smoke checks passed: host response, editor-host routing, sign-in HTML, unknown-site 404, unauthenticated API 401, outside certificate-gate rejection, HSTS, and HTTP-to-HTTPS redirect. The smoke suite explicitly skips authenticated cookie-attribute verification.
- Built-in browser: existing authenticated dashboard loaded with three owned sites and quota state; existing project editor loaded its populated canvas; account Security page loaded. No edit/save/publish/password action was taken.
- Existing public `/braudy/` returned HTTP 200.
- The deployed application hash matches the documented September 6 callback fix. Earlier deletion/address lifecycle fixes are present; they were not reported as new defects.

## Source/deployment limits

Production differs from both the older Cloud checkout and the current main working tree. The source snapshots beside this report preserve the actual reviewed files. The reviewed deployed `app.ts` SHA-256 is `7f37a6aa3ccfed6cb6ebb25b37522d4d64f0e34f6d9926fc183e2847b7946f62`; `account-auth.ts` is `ca5248b1e3106ada55fa6351f0fceafd59c48e36248649f073c8b4cc8e241d67`.

Not verified end to end in production: fresh sign-up/confirmation/email delivery, password change/reset, save conflict across real sessions, creating/publishing/deleting a disposable site, WordPress consent/import, database migrations/RLS, backup restore, or multi-process failover. Local tests cover portions of these; they are not substitutes for live acceptance.

The temporary candidate can rerun the reproduction with `./node_modules/.bin/vitest run server/tests/review-findings.test.ts`. The tests intentionally pass when the existing defect is observed; they are review reproductions, not fixed-behavior regression tests.
