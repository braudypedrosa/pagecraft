# Cove & Key compatibility verification

## Result

Partial acceptance: native editing works in the disposable local Cloud host using the updated local editor. Production Cloud acceptance is not established. Actual LocalWP whole-site import fails on SVG logo media upload. Publication is blocked by the five intentionally unconfigured forms. No endpoint was fabricated or publication guard bypassed.

## Exact final artifact

Package SHA256: 6c345b12a52727176e38cc9f55956479fbb5af6df5c97ce740e5a881fa7b9fc8
Editor index.html SHA256: 4e980df22040973359512cf0c4f71d9ae1449ed98a91b638a5ad027c9ac82426
Git base: 0f7134b9560ae1cc53d34a88d25cf26ca608c944 plus uncommitted candidate changes.
Host: http://localhost:4900/edit/s1. Fixture identity and in-memory storage; no production authentication/database test. Earlier extended component tests used localhost:4899/edit/s1 before the default form min-width correction; final artifact was reimported separately.

## Passed

- Final package build/check and native source validation.
- Browser: choose premade template, create site, import all8pages and7assets.
- Browser: edit headline, change page, reload, return to home and verify saved text.
- Native Form inspector: Grid layout, Four desktop columns, One mobile column, Bottom button alignment. Desktop column change and restore verified.
- Native Slider inspector: Controls position can change from Centered below to Beside slides and back.
- Extended earlier import: edit property instance name, replace property image from imported library, duplicate/delete component, reload and verify one surviving edited instance.
- Final Cloud preview: fourth review reachable; desktop/mobile screenshots captured.
- Actual WordPress PHP PortablePagePackage parser accepts final ZIP, enumerates all8pages, provides compiled HTML/CSS for each, and preserves controlsPosition and --f-columns. This does not invoke WordPress or prove live import/runtime editing.

## Failures / pending gates

- Actual editor publish gate:5problems, all missing form endpoints (hero search +3property forms +Contact). Search is a placeholder, not a working availability engine.
-71advisories: image intrinsic dimensions, one heading-order jump, and contrast reports. Photo-overlay contrast reports require rendered evaluation because sibling overlays are not understood by the static checker; do not treat all warnings as false positives.
- Full suite:1112passed,1failed,4skipped. Remaining failure is accounts.test.ts expecting coastal-rentals to be the preselected first catalog entry. Catalog was already modified outside this task; account implementation/test unchanged here.
- LocalWP real import FAILED on pagecraft-wordpress-qa.local using the configured pagecraftqa account through WP-CLI. Builder 0.2.0 rejects logo.svg via wp_upload_bits: “Sorry, you are not allowed to upload this file type.” The importer recorded a successful rollback; original linked fixture restored, page counts unchanged (1 published, 3 drafts), homepage remains 0. Edit/save/frontend tests cannot proceed until the import succeeds. No plugin or credential changes were made. Database and Builder backup: /tmp/cove-localwp-backup. Evidence: localwp-import-result.json.
- Public Cloud version pin and deployed WordPress editor do not yet include candidate native control changes. No release/deployment attempted.

## Corrections made during verification

Restored the existing12rem half-field wrapping minimum, updated exhaustive responsive-control acceptance count for3new inspector rows, and regenerated the signed WordPress golden artifact fixture for intentional renderer CSS changes. Core and release suites:644tests pass. These changes require normal review before a shared editor release.

## Evidence

See wordpress-parser.json, final-publish-gate.txt, final-cloud-preview-desktop.png, final-cloud-preview-mobile.png, core-and-release-tests.log and full-test.log in this directory.

## Local remediation — 2026-09-09

The historical SVG/import failure above is resolved locally. Package uses transparent PNG renders of the existing SVG logo/symbol; original vector sources retained. New package SHA256: f1aa8bb109f01a7bb12b53f389d20c91caeba39d956b167a371b4a11fdcf6f9b.

LocalWP import created all 8 pages; repeat imports updated 8 and created 0. Additional menu-name collision fixed in NativeMenu with a passing ownership/idempotency regression. Explicit ARIA allowlist fixes labels stripped by KSES. Rebuilt editor and runtime installed on QA; four review dots work in browser. Native PageEditor load/save/load persisted a temporary heading and restored original through WP-CLI. Authenticated browser inspector proof remains pending (browser logged out).

Production-matched source now rebuilds without removing existing inspector/preview-capture behavior, with template form/slider controls included. Build/typecheck/package build and 619 focused checks pass. Full details: /tmp/pagecraft-cove-fixes/COVE-COMPATIBILITY-FIXES.md. No production deployment/catalog promotion in this remediation; form endpoints/PMS remain intentionally unconfigured.
