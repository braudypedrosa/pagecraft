## Latest integration checkpoint — 2026-10-20, form controls and Preview fixes

The reviewed isolated candidate is integrated for staging release; deployment/native Cloud and WordPress acceptance are pending. Local native23 cases pass: calendar/typed ISO/impossible-date recovery/month-focus/Escape, select End/typeahead/long values, responsive clipping-safe popups including authored Overflow Hidden, fresh authoring and compiled publication-preview behavior. No valid external submission occurred; reset/FormData/minmax/unavailable dates remain automated-only. Preview runtime/CSS omissions, ISO separator filtering and lost month-navigation focus were found by native testing and corrected before release.

Local long submit label and nested Embed Preview sizing fixes pass their named reports. Full suite2442passed/5skipped/0failed, demo0findings, audits0, two package builds byte-identical across11outputs. Gallery30behaviorchecks and24captures pass with zero pixel changes; root reviewed all24. Signed WordPress golden changed only the approved72byte Form button wrapping rule and derived hashes/signatures. Detailed proof: `qa-evidence/public-form-controls-2026-10-20/` and `native/local-form-controls-native-acceptance.json`.

Cloud staging remains4875652 until the new deployment marker is verified. WordPress remainsPreview57; new package/runtime acceptance pending. Full customer QA remains false; fourteen broad areas remain open. Production readiness is not claimed.

## Continuation checkpoint: native Form/Embed candidate held

- Cloud staging still exact4875652; Preview57 final protected-state guard is accepted with the six explicitly recorded wp_options cache/update row changes.
- Additional Cloud Form23 layout/alignment/responsive style cases accepted; baseline Version882 restored and exact CSS/41IDs verified again after fresh reload. See native/staging-form-style-responsive-acceptance.json and staging-form-style-preview-mobile.jpg.
- Candidate isolated checkout: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/public-form-controls`. Root owns native tab6 and integration; worker public_form_controls owns runtime/generated/build source. No Main build commands or generated working-file replacement.
- Native candidate fixed/accepted in bounded scope: long submit labels wrap without horizontal overflow; Embed Preview fixed-width nested frame fits D/T/M16:9 with both edges visible; custom Date/select now have Preview scripts/styles; dropdown body portal/theme/keyboard and long selected text work; calendar body portal caps to available height and empty required date blocks.
- Native rejections retained: initial Preview runtime omission; subsequent Preview CSS omission; valid→impossible typed date restored prior value; final invalid-draft fix still strips ISO hyphens for real keyboard input and month-navigation click loses focus to body. Last two fixes are in progress. No valid external submission performed.
- Latest progress records: native/local-form-controls-candidate-progress.json, local-form-controls-pre-final-regressions.json, local-embed-preview-candidate-progress.json. These are local candidates, not staging or WordPress acceptance.
- Source full suite before latest date correction had2441pass/5skip and only explicit gallery review gate. Golden foundation72byte submit-button CSS drift was reviewed; isolated signed fixture updated and verified exact12leaf changes. Final full suite must follow last source change plus root gallery review.
- Full customer retest remains incomplete, fourteen broad areas remain open. Production readiness is not claimed.

## Current checkpoint — 2026-10-20

Responsive select reset fix `08b9820890082c86b6a222a71fffd8f7c55c2971` is accepted on Cloud staging in `native/staging-08-reset-acceptance.json`: 14 named author/save/reload/reset/keyboard/Preview cases, original Version818 restored as827, exact CSS and41 node IDs. WordPress Preview56 has10 named author/fresh/reset/inheritance readbacks, with original document17 restored and exact CSS/11IDs; strict post-native database guard passed: protected15/legacy14/options/menus/routes exact; only fixture487 and five new revisions changed; restored original content as document20. Its author-time computed reads can precede rendering; fresh saved reads are authoritative. WordPress frontend Preview and keyboard focus are not claimed for this batch.

Spacing unit label clipping is separately confirmed and fixed in two scoped builder CSS rules. Four units fit at58px in the isolated built candidate (`native/local-spacing-unit-acceptance.json`); staging deployment/acceptance and WordPress Preview57 remain pending. Full QA remains incomplete; fourteen broad areas stay open. Current bounded tests do not establish production readiness.

Evidence: native/staging-08-reset-acceptance.json, native/wordpress-preview56-reset-acceptance.json, native/local-spacing-unit-acceptance.json. Local candidate29 focused tests and app/editor builds passed. Source change only builder.html, two CSS rules; shared select logic untouched. Main protected generated working11 preserved by index-only integration. No production application promotion. Shared backend history metadata fix remains the earlier version27.

Gallery source-review gate initially failed in f2 CI. Root completed30 native behavior checks and reviewed24 captures with zero changed pixels; only reviewed manifest metadata/fingerprint updated, PNGs unchanged. Clean full suite2426pass/5skip and demo passed. RichText Advanced17 finite cases passed and original CSS/IDs restored; visibility and published output remain open.

## Verified continuation — 2026-10-20, staging4875652

Spacing labels: Cloud CI39392009402 and deploy39392009486 green, deployment marker exact487565221af6854b4502f278ccedc88c6b6081a6. Native actual Mobile inspector passes four58px labels without clipping; fixture restored exactly (`native/staging-487-spacing-unit-acceptance.json`). Local gallery30/30 interactions and24/24 screenshots with zero changed pixels; full clean suite2426pass/5skip. Initial f2 CI source-review gate failure and initial behavior-harness API failures remain in evidence. WordPress Preview57 package is built from code-identicalf2; guarded Local install/native acceptance remains pending.

RichText Advanced:17 named cases pass including five Position choices, three Overflow choices, combined identity/classes/CustomCSS/transform and responsive Top/Z-index/MaxWidth/Opacity author/fresh/Preview matrices. Editor preserves internal node IDs; Preview has authored HTML id. Original CSS/41IDs restored. Fixed/sticky scroll behavior and published output unclaimed. Visibility:all8 combinations×3devices and3fresh saved all-hidden Preview checks pass; original CSS/41IDs restored. Shared-style, wider cross-module and public coverage remain open; fourteen broad areas remain open, fullCustomerRetestComplete=false.


Latest native proof: Breadcrumb18 cases cover both modes×four separator glyphs, escaped label, fresh saved mode, responsive size/gap/colours and Preview; original CSS/41IDs restored. Initial wrapper-font probe is retained separately and corrected to measure actual link labels/ol gap; no product defect. WP57 four label choices fit58px; no page save, fresh original CSS/11IDs/SaveDisabled confirmed. Strict final WP database guard pending.
