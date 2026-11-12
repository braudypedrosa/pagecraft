# Task close: Dental pilot and hosted template authoring

- Date/timezone: 12 November 2026, Asia/Manila.
- Project: Pagecraft. Source: managed pagecraft-template-authoring worktree.
- State: Dental native development ready for complete-site review; catalog promotion and production pending explicit approval.
- Authorized scope: private hosted native template authoring, approved A2/L2/all-image Dental pilot, package verification. One template at a time.

## Completed

Operator-only hosted MCP extension was pushed and deployed to staging at `0e66d154865bfe2769e4282c220a5e0c1260d608`, verified by `/__deployment`. Private environment-separated drafts, eight tools, native builder saves, validation, immutable revision previews, asset upload, export, revision conflicts, grant revocation and killed-owner recovery are implemented. Existing customer assistant/import credentials retain their scope. Per-draft storage cap is 512 MiB; no global storage cap. Interrupted recovery fails closed.

Built Linden Dental A2 through actual hosted MCP using exact approved imagery/logo. Six pages, revision 19, package hash `05faa8a606ae9e383ffa10083d5484b96856529c06a6128dfbff7030db66f456`. JSON-source export/import parity was fixed for explicit asset dimensions, preserving legacy TypeScript package hashes. Native Cloud and isolated WordPress draft import/edit/save/reopen/reimport checks passed with the limits below. A WordPress draft navigation hydration bug was fixed and pushed separately at `2cfa51af283ff970fb42a33577a18fbcc29a6008`; CI passed for PHP 8.1/8.2/8.3.

## Verification

- Latest complete Pagecraft suite: 317 test files passed, 2 skipped; 3,117 tests passed, 5 skipped. `final-integrated-tests.log`.
- Focused JSON source suite: 3/3; typecheck passed. All 20 existing catalog package hashes match, released catalog/source unchanged.
- Integrated browser gallery: 30 behavior checks passed, 24/24 screenshots unchanged. Reviewed source fingerprint updated before staging deployment.
- Six pages at 390/768/1024/1440: no horizontal overflow, expected fonts/images, one H1. Mobile menu/keyboard/form state and browser health checked. Full-page capture compositor limitation documented; readable exact-state proof retained.
- Cloud: fresh unpublished `Linden Dental Package QA`, native Media plus project-JSON import, heading save/reopen, six-page preview, reimport with stable twelve media. No generic whole-site ZIP/picker import UI was available for an unpublished package.
- WordPress: isolated localhost 4397, exact ZIP native-import bridge, six draft pages and twelve media, heading save/reopen, six frontend draft previews, idempotent exact reimport. No existing site or database was reused.

## Evidence and review

Before: `dental/Before/home-top-1440x720.png`, `home-top-390x720.png`. After: `dental/After/home-top-1440x720.png`, `index-top-390x720.png`, `contact-lower-390x720.png`. Baseline is initial native revision14, not an earlier customer site.

Review: https://staging.itspagecraft.com/owner/template-drafts/dental-clinic-a2/0.1.0/preview/19/index.html

See `dental/review.md`, `dental/package/compatibility.json`, `dental/package/export.json` and Cloud/WordPress receipts. Protected access stays outside the repository. No credentials in evidence.

## Limits and handoff

Await Braudy's complete-site and package approval. Dental remains outside the catalog; production unchanged. Forms are unconfigured, no submissions or transactions performed. Customer-picker/released-plugin/published-output checks remain final release gates after approval. The remaining 23 designs have not been built. Preserve exact approved brand masters and existing unpublished draft identities.

No reliable aggregate task duration was tracked. No billing prepared or submitted. No task-system status or Basecamp comments changed. Temporary responsive overrides are reset; no CPU throttling was used.
