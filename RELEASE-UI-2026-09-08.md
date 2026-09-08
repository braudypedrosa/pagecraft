# Cloud UI release — 2026-09-08

Production-matched base: 83f5a5f. Changes: startup logo and bounded minimum display with failure recovery; save-before-dashboard navigation; temporary busy-save retry; centered site-limit content.

Only index.html and server/src/account-pages.ts are deployed. The editor bundle preserves the exact deployed compiled modules; matching shell/boot changes are recorded in builder.html. A full source rebuild is blocked by a pre-existing declared border control missing from the inspector source. No core, auth, gateway, dependencies, local settings, or template catalog changes ship in this release.

Verification: 3 loading controller tests pass; busy-save retry regression passes; production-matched local browser loader/ready/dashboard navigation passes. Account suite has 21 passing tests and 1 pre-existing old dashboard-markup expectation failure. Full build and full-suite acceptance are not claimed.

Architecture Studio and Salt House already exist in the production catalog. Cove & Key remains a draft: WordPress SVG import failed and new native controls require source/build alignment. No false QA or promotion records were created.

## Deployment outcome

Deployment attempted with action-time checks of both original hashes and backups under `/home/itspbuku/pagecraft-backups/ui-cd764e8/`. CloudLinux restart reported success. Authenticated dashboard rendered and card alignment matched, but subsequent public smoke checks intermittently returned Cloudflare 520. Both files were rolled back and original SHA-256 values verified. The previous template catalog was never changed.

Errors continued after rollback (including a Cloudflare 525). A direct HTTPS request to origin 67.223.118.197 with the production hostname and certificate verification returned 200 for `/sign-in`. This isolates evidence of a proxy/origin availability or TLS problem; it does not establish a root cause. Do not mark this release deployed. Candidate remains on this branch for a later attempt after hosting stability and source/template blockers are resolved.
