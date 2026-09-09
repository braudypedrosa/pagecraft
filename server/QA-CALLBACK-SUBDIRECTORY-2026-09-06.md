# WordPress subdirectory callback fix — 2026-09-06

Status: narrow Cloud fix deployed; fresh hosted authorization navigation verified.
Account consent and import remain pending. This is not a WordPress package release.

## Cause and change

WordPress correctly generated `/wordpress-qa/wp-admin/admin-post.php?action=pagecraft_cloud_callback`.
Cloud required the pathname to equal `/wp-admin/admin-post.php`, rejecting subdirectory installs.
The validation now accepts ordinary installation-directory segments before that exact endpoint.
HTTPS requirements (including the existing local-development exception), no URL credentials or
fragment, the exact action, and PKCE remain enforced. The query must contain exactly one parameter;
encoded path separators and extra endpoint suffixes are rejected.

## Verification

- Regression first: root callbacks passed; single and nested subdirectory callbacks failed 400 vs 200.
- After fix: 44 connected-app tests and TypeScript passed in the working checkout.
- Exact-live candidate: 70 connected-app/app tests and TypeScript passed.
- Full manual import test runs cover local root, HTTPS root, HTTPS subdirectory and nested
  subdirectory callbacks, including consent, callback path/state preservation, token exchange,
  owner-scoped project/package reads, refresh and revocation. All are synthetic tests.
- Existing rejection coverage expanded for extra query parameters, duplicate action, wrong
  action/endpoint, public HTTP, credentials, fragments and encoded separators.
- After deployment: all eight observable public smoke checks passed; the smoke tool's
  authenticated Secure-cookie check was explicitly skipped.
- Built-in browser: reloaded the user's rejected URL and saw the approval screen. Then started
  a fresh Connect Pagecraft account flow from the hosted QA Cloud Import screen; it reached
  consent with no JSON error or client block. Stopped before Approve; no access grant was created.
- Screenshot inspected: sibling WordPress repository
  `qa-evidence/hosted-20260906/cloud-consent-subdirectory-fixed.png`.

## Deployment and rollback

Only `/home/itspbuku/pagecraft-app/server/src/app.ts` changed. The live file was newer than this
checkout, so the patch was applied to its exact matching candidate, not a bulk checkout upload.

- Original SHA-256: `620300f7c705feaac9bbff91909409edb28cba418b0e6f8260f08d865860b4c3`.
- Deployed SHA-256: `7f37a6aa3ccfed6cb6ebb25b37522d4d64f0e34f6d9926fc183e2847b7946f62`.
- Candidate and deployment script: `/tmp/pagecraft-callback-fix.CEecBo/`.
- Private rollback file: `/home/itspbuku/pagecraft-backups/callback-subdirectory-20260906/app.ts`.
- Original and staged hashes checked before replacement; Node 24 syntax check passed;
  atomic replacement and CloudLinux restart succeeded; final remote hash matched.

Rollback, if required: restore only that backup app.ts to server/src/app.ts, restart the same
CloudLinux application, and rerun the public smoke checks. No database, dependencies, WordPress
files, template versions, release trust roots or user projects changed.

Next: obtain action-time approval for read-only Cloud project access by the hosted QA WordPress
installation, then continue import acceptance. Start a fresh connection if its ten-minute
WordPress state has expired. No credentials or authorization codes are recorded here.
