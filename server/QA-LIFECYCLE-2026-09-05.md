# Hosted lifecycle acceptance — 2026-09-05

Status: local real-service acceptance passed. Cloud production fixes deployed with user approval
on 2026-09-05; public post-deployment checks passed. WordPress release remains separate.

## Environment and evidence

- Candidate: working-tree fixes based on `332abed`.
- A disposable PostgreSQL 17 container, bound only to loopback, supplied the database.
- Real Node HTTP listeners used `PgStore`, `PgAuthStore`, and `FileHostedPublicationStore`.
- `server/tests/hosted-lifecycle.integration.test.ts` passed against that database.
- The test is opt-in via `PAGECRAFT_TEST_DATABASE_URL`; use a disposable database only.
- TypeScript checks passed.
- The combined Cloud/shared-editor suite, with real PostgreSQL integration enabled, passed
  all 1,081 tests across 34 files (no skips).

## Proven sequence

1. Create a fixture and sign in via the real magic-link HTTP routes.
2. Publish through the HTTP API; the public URL returns 200.
3. Change its slug: old path returns 404, new path returns 200, and the bare path redirects to the new canonical path.
4. Change its custom host: old host returns 404 and new host returns 200.
5. Recreate the HTTP application and its store instances; published routing remains available.
6. Republish the unchanged document at the new address; the old address remains unavailable.
7. Delete through the authenticated settings route; the database row disappears.
8. Recreate the application again; both the deleted slug and custom host return 404.

The first harness run used fetch for a custom Host override, which did not reach the server as
intended. The test now uses Node HTTP requests for custom-domain checks. The corrected test
passed. No product change was needed for that harness issue.

## Limits

This validates actual HTTP, PostgreSQL, and filesystem behavior locally. It does not validate
the production Supabase authenticated lifecycle end to end. Production deployment and public
health were checked separately below; no existing customer site was moved or deleted to test it.

## Cloud production deployment — 2026-09-05

- Target: `https://build.itspagecraft.com`, application `/home/itspbuku/pagecraft-app`.
- Live source was newer than this reviewed checkout. The two reviewed changes were applied
  to exact downloaded live files, preserving integrations, the template picker, and saved previews.
  This was a narrow two-file deployment, not a bulk sync of this checkout.
- Candidate workspace: `/tmp/pagecraft-review-deploy.JHEQNM/candidate`.
- The exact-live candidate passed TypeScript and 32 tests across the app, publication store,
  and real HTTP/PostgreSQL/filesystem lifecycle suites. The temporary PostgreSQL container
  was stopped and removed after testing.
- Private rollback copies: `/home/itspbuku/pagecraft-backups/review-fixes-20260905-2316/`.
- Original live hashes were checked before backup and again before replacement. Both new files
  passed Node 24.19.0 syntax checks before atomic per-file replacement.
- CloudLinux restart returned `result: success`. Deployed SHA-256 values matched the candidate:
  - `server/src/app.ts`: `620300f7c705feaac9bbff91909409edb28cba418b0e6f8260f08d865860b4c3`
  - `server/src/publications.ts`: `4f880e62c7327c6a2206ab9632fbf1fe9b65b147541b5d775ecdde3442a62d55`
- All eight observable public smoke checks passed after restart: host response, editor-host
  routing, sign-in, unknown-site 404, unauthenticated API 401, certificate gate 403, HSTS,
  and HTTP-to-HTTPS redirect. The authenticated Secure-cookie check remains explicitly skipped.
- Existing `/braudy/`, Marea 1.0.4 preview root, and its `stays.html` returned HTTP 200.
- No database migration, dependency update, template release, or WordPress release was performed.

Rollback, if needed: restore only `app.ts` and `publications.ts` from the private backup to
`server/src/`, restart the CloudLinux Node application, and rerun public smoke checks.
