# Release 84 — accepted staging and WordPress preview

Date: 2026-10-22, Asia/Manila. Status: this bounded release accepted; full customer QA remains partial.

Cloud development/staging: `0a8c0c19944c3f68898ea49e70b44825fead23f3`. CI 39641734707 and deploy 39641734532 passed. Root verified the exact native deployment marker. Field-specific binding names, duplicate-row names, keyboard selection and reload passed. Fresh Collection cards rendered with desktop/tablet/mobile basis 280px/280px/100%, without page overflow. Native screenshots were viewed. History 1071 restored the original 20 editable IDs and removed the test Lists. The pre-existing missing CMS-image alt check remains.

WordPress development: `3604eb74b0bc6dd6e042ecd2fc1e4c7b2657f8fb`, preview `0.2.17-preview.20261022.84`. Root independently checked CI 39646072783 for the exact commit: PHP 8.1/8.2/8.3 passed. The native read-only editor retained all 11 editable IDs at Desktop, Tablet and Mobile and after reload; Save stayed disabled. Gallery inspector rendered. Collection List is intentionally absent from this provider palette, so the WordPress claim is source/package parity, not native Collection workflow acceptance.

Root independently compared all 133 SQL tables: 132 exact; all posts, metadata and 324 revisions exact. Only `_elementor_pro_free_trial_data` changed a timestamp; its row identity, shape and autoload stayed exact. No rows were added or deleted. Final SQL SHA256: `e05e7054ba5d984d6361a46460c107ebf47a8548cbdaeefeb433df184596af16`. Builder 55, Theme 19, Importer 16 and 104 historical package files remained exact.

Preview83 evidence correction: Core source did change two control descriptors to lengthList; public runtime and golden output remained unchanged. Preview84 evidence names the actual app/src/core/index.ts path and hashes rather than asserting Core source was unchanged.

Completed verification tabs closed. Fixtures retained for broader QA. No production promotion, database purge, valid external form submission or external messages. No CPU/network throttling used; owned gallery emulation cleanup has explicit receipts. Time/billing: not tracked or submitted.

Evidence: wordpress84-native.json, wordpress84-editor.png, wordpress84-root-independent-final-guard.json, wordpress84-ci.json, and staging native files in this folder.
