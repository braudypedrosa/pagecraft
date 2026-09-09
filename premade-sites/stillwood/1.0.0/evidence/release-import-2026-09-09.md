# Stillwood release import verification — 2026-09-09

Package SHA256: 53afccfbeb4a772ebe2c4e2c7e3aa15f96d07168e69c6f6fbe2812162bccfad3
Catalog status: NOT promoted or deployed.

## Authorization and package
User approved backing up and replacing Cloud New Site From Template and retaining explicitly disabled demo forms ("for pending: 1. Yes, 2. Yes"). Original Cloud site document, history, five asset records and bytes were backed up before replacement under /home/itspbuku/pagecraft-backups/stillwood-replacement-20260909. Other Cloud sites were not changed.

Production media storage rejected image/png. Converted all 15 configured assets to WebP (sharp quality 88); original PNGs retained. Native source layout unchanged. Build/check passed for this package. Previous PNG-package evidence is historical and is not represented as current full acceptance.

## Production Cloud
Target: https://build.itspagecraft.com/edit/b30f6f0f-b837-4944-a9c9-f959aed339a9
Editor SHA256: 4e69d120107926f5f07beb363e11fbcedd6d9b8d73a18d7760aca066d85b4c2d
Used deployed FileSiteTemplateStore.instantiate, GatewayAssetStore and GatewayStore with a private staged package. This is native importer testing, not the public catalog-picker flow. Nine pages and 15 WebP assets imported. Original five assets retained for recovery. An initial script save used an invalid audit actor and failed its foreign key; corrected by using the supported save call without an invented actor.

In the actual production editor: navigated to testimonial slide 3, edited it, saved and reopened; changed global background and base type size; replaced imagery via media library; entered a long hero heading; duplicated, reordered and deleted it; opened mobile responsive inspector; changed the cabin instance name. Reload confirmed edited quote, heading and instance value persisted. Restored the clean package afterward; restarted application to clear cached document state and reloaded. Final snapshot confirmed original "A little more being." heading.

Publish dialog reports five unconfigured-form errors. Forms remain explicitly disabled as authorized. No booking, availability or message delivery claimed. The owned Cloud site has not been published.

## WordPress
Target: http://127.0.0.1:4931/ (isolated QA, table prefix stillwoodreleasewebp_).
WP 7.1; plugin headers report 0.2.0. Tested editor SHA256: 4ebccb40ecb5ef37ffdc0d3e3cf6805b59cd11e450744497e105a61ac2eeb144.
WholeProjectImporter fresh job 5: nine created pages, 15 media assets, one menu, homepage 21. Reimports 40 and 61: zero created, nine updated, stable media/menu counts. Job 61 restored clean template after stress edits. Existing Cove installation and earlier QA tables preserved.

Actual UI checks: global background and base typography saved and verified in frontend; media-library image replacement; long hero heading; duplicate/reorder/delete; mobile inspector; cabin component instance name; save and frontend readback. Native mobile menu opened with Enter and closed with Escape; FAQ opened; error log empty. Earlier PNG-package testimonial editing and Edit Page submenu tests are separately recorded in release-attempt.md.

Image replacement exposed a WordPress save bug: unresolved asset: IDs in compiled HTML were sanitized to invalid relative URLs. Fixed writeServer to resolve HTML media URLs through assetsToBlob before submitting, matching saved CSS handling. Actual QA save then produced the full uploaded-media URL. Fix applied to candidate shell, durable plugin asset and QA asset. WordPress build adapter now also resolves this seam for the pinned editor input. No plugin update released.

## Bounded responsive checks
72 DOM checks: nine pages at 390, 768, 1024 and 1440 pixels on the native package preview and WordPress frontend. No overflow, exactly one H1, no completed broken images, minimum sampled paragraph/link/button text >=12px. A pending image was not counted as a loaded image; these checks are not a complete image/network audit. Loaded desktop cabin-list screenshot reviewed: logo/nav alignment, hierarchy and three image crops present.

These are basic DOM checks, NOT the complete per-page visual, keyboard, crop and composition acceptance matrix. No unperformed checks entered as passes.

## Remaining release blockers
- Full package-bound rendered review and per-page visual/input matrix still incomplete.
- Historical approved design iterations have not been mapped to the workflow's three-direction/selection records; no fabricated candidates entered.
- WordPress normal pinned-editor rebuild differs from the tested QA artifact and durable plugin artifact. Pin/build reconciliation and regression verification required before releasing that editor fix.
- Catalog promotion and public catalog-picker import verification not performed.
