# Cove compatibility fixes — 2026-09-09

Local fixes completed; not deployed to production or promoted in the catalog.

Editor source alignment: restored existing production inspector components (border, spacing shorthand, asset identifiers, responsive position), publication thumbnail capture and its save call. Corrected build root detection for an app element carrying inert/aria-busy attributes; the old exact-string search placed body tags after the script. Added native form grid/column/button alignment and slider control position support. Rebuilt index and versioned-package artifacts. Generated output diff now preserves existing production behavior apart from intended controls and nonfunctional source path/CSS placement differences.

Validation: build, TypeScript, editor package build, 615 core/save-recovery tests, 3 loader tests and 1 generated-shell regression passed.

Template checkout: /Users/braudypedorsa/Projects/pagecraft-premade-sites. Cove logo and favicon retain original SVG source artwork; package now uses transparent PNG renders to import through standard WordPress media permissions. Package SHA256 f1aa8bb109f01a7bb12b53f389d20c91caeba39d956b167a371b4a11fdcf6f9b. Build/check passed. No catalog promotion.

WordPress checkout: /Users/braudypedorsa/Projects/pagecraft-wordpress. NativeMenu now chooses an unused display label when another project owns the default name, retaining key-based ownership/idempotency. Regression test passes. FallbackCompiler explicitly allows rendered ARIA attributes because WordPress KSES does not preserve aria-* as a wildcard; executable markup still rejected in real WordPress validation. Same narrow fixes applied to LocalWP QA with backups, plus rebuilt editor/runtime installed there.

LocalWP proof: first successful import created 8 pages and homepage 133. Subsequent imports updated all 8 with zero duplicates. Real PageEditor load/save/load roundtrip persisted a temporary heading then restored original. Frontend loads logo and content. Updated runtime exposes 4 review dots; built-in browser selected dot 4, enabling Previous and disabling Next. Initial import revealed and led to fixing menu collision; initial roundtrip test had an invalid compiled wrapper, corrected to the actual main wrapper contract. Browser WordPress admin session was logged out; no authenticated inspector browser test claimed. WP-CLI used existing pagecraftqa identity. Backups at /tmp/cove-localwp-backup including SQL before this run.

Remaining: production editor/package release and template promotion need acceptance of this candidate; five intentionally disconnected forms/PMS/search placeholders remain and publication validation is not bypassed. No live booking or inquiry delivery claimed. Existing unrelated work in all checkouts retained.

## Cloud deployment — 2026-09-09

User authorized deployment. Deployed index.html plus app/src/core/index.ts and types.ts after verifying all three production baseline hashes and staged candidate hashes. Backup: /home/itspbuku/pagecraft-backups/cove-20260909/before.tgz. CloudLinux restart succeeded. Main site and builder sign-in returned HTTPS 200 with valid certificates. Authenticated production editor loaded the Braudy document with Draft ready after navigation initially timed out. No project edits or publication triggered. DNS-only remains enabled.

This deploys Cloud editor/native renderer support only. WordPress plugin distribution and Cove catalog promotion are not deployed. The workflow status requires current package Cloud/WordPress host QA and rendered review; no fabricated pass record was created. User deployment authorization is established for this candidate.

## Continued release QA

WordPress customization tooling required updates for the new attributed app root, logo anchor, and preloader boot. tools/wordpress-editor.mjs now inserts styles at the stable font marker, supports old/new topbars, and inserts settings-only handling before readiness without replacing the startup error handler. Verified customization on both pinned 0.2.14 and new candidate. Customized output installed in LocalWP QA.

Desktop rendered review found wpautop wrapping the native search button in a paragraph (18px baseline error). Managed page template now suspends only wpautop around compiled the_content(), restoring the original filter priority in finally; ordinary pages retain formatting. Added tests/managed-content-formatting.php and passed its managed/ordinary/filter-restoration checks. Browser measured all four search controls at bottom 684.3125 after the fix (before: button 18px high). Changes are in WordPress source and LocalWP QA only.

Browser login is required for remaining WordPress inspector acceptance. Opened built-in tab at http://pagecraft-wordpress-qa.local/wp-admin/ and requested login to existing pagecraftqa account. No password supplied or reset. No QA pass record/catalog promotion/plugin production release claimed in this continued pass.

## September 9 form inspector follow-up
- Fixed four controls incorrectly flowing into a three-column field row; required/half-width toggles now use an explicit full-width options row with readable labels.
- Added missing Date field type to inspector; existing date fields previously displayed an empty option despite rendering date inputs.
- Built/typechecked shared editor and passed generated-shell regression check. Installed customized WordPress asset on QA and visually verified at 1450px.
- Deployed compiled shared editor to Cloud after baseline and candidate SHA verification; restart succeeded. Current index SHA: 7168523f829a935cec31f383305561f424447fb94013f0961623628626150b8e. Rollback: /home/itspbuku/pagecraft-backups/cove-20260909/before-form-inspector.html.
- Imported reviews are native slider cove-review-slider-90 with four children. Public local browser verified four dots; fourth dot scrollLeft=3072, previous arrow then scrollLeft=2048 with third dot active. Editing mode does not run carousel runtime, so controls are hidden there.
- Adjacent unresolved issue: imported global palette/typography use default Pagecraft styling (green/black rather than Cove blue); not fixed by this inspector change. Full template release QA remains incomplete.

## Editable sliders and decorative overlays
- Shared canvas now runs the existing carousel runtime during editing, with other exported interaction scripts still limited to Preview.
- Pointer selection does not intercept carousel controls; repaint restores carousel scroll offsets before initializing controls, keeping the active review while its text changes.
- Empty absolutely positioned boxes with a painted background omit the empty-content hint; their normal selection hooks remain. Normal empty boxes retain drop hints.
- LocalWP browser: clicked third of four review dots, selected its quote, edited/restored text; active slide remained third at scrollLeft=2048 and original content saved successfully. Screenshot visually confirmed inspector + active quote + bottom controls. Hero overlay no longer contains drop hint.
- Core suite: 615 passing. Typecheck and builds passed.
- Cloud deployed index.html SHA 4e69d120107926f5f07beb363e11fbcedd6d9b8d73a18d7760aca066d85b4c2d and core index.ts SHA a3627afdbab7f33f09f61363ea856098dd32a0e2314f0312ddb664db3f647805 after baseline/candidate checks; restart succeeded. Rollback before-editable-sliders.tgz in existing cove-20260909 backup directory.
