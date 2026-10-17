## Current reconciliation — 2026-10-17 bounded state

This section is authoritative for the current record. Everything after the explicit Historical evidence heading is retained point-in-time material and does not override this section. Main/staging exact `b2c94c6d7417604a7faf7e7a97600c5dbb3293a2`; CI `39031378941` and deploy `39031378985` green. Production app remains `cc026`; the shared database gateway is now version 27 with only its history-list SELECT changed. `overallPass=false`, `fullCustomerRetestComplete=false`, and all fifteen broad areas remain open.

| Surface | Current status | Evidence and remaining boundary |
|---|---|---|
| Navigation / Follow / managed controls | **Bounded native acceptance; broader Navigation open** | `native/staging-029-nav-acceptance.json` passes 9 cases/restores fresh: Follow component Preview with four links, keyboard Focus D/T/M, managed Menu background hidden, Mobile common background (`#ddeeff` on Mobile; transparent D/T), ordinary Focus Desktop and collapsed Tablet/Mobile toggle, legacy Custom Header, and exact IDs. Pointer was tested and does not activate Focus. The native frontend Preview dialog is intentional; no WP inline component-runtime Preview claim. |
| WordPress Preview54 | **Bounded native acceptance; final guard exact** | `native/wordpress-preview54-nav-acceptance.json` passes 9 restored cases with actual Save/frontend Preview, Follow mode Save disabled on fresh editor, parent Focus D/T/M, managed-mobile distinction, pointer nonactivation, Escape, and component Edit links D/T/M. Evidence `369710ccab76ffb6cd14dc4c415e78d35e5ef880`, CI `39027314318` all PHP green; final guard base `1a6b9ddfafc947209bc1c50273b1d8c72c04e451285621f0bd3e899783d04713` exact. |
| WP54 guard scope | **Restored bounded state** | Original 11 IDs, Gallery 2/12, document 11→13, revisions 509–512, protected15/legacy14, menus/options/routes/Builder/Theme/Router exact. Raw broad guard changes are limited to the accepted fixture/post-count/revision-meta scope; do not call every broad metadata field unchanged. |
| Gallery Focus / spacing | **Bounded native acceptance** | `native/staging-75ed-focus-spacing-acceptance.json` passes six negative-padding D/T/M cases across four units, valid negative Margin, Undo/Redo, and ten Focus keyboard/pointer/class-cascade D/T/M cases with lightbox-off preservation, re-enable, and IDs restored fresh. |
| Gallery motion | **Bounded native acceptance** | Native 26 presets/five timing cases and Cloud None/Transition restoration are accepted in their named reports; broader motion/module coverage remains open. |
| Integer controls | **Bounded native acceptance** | `native/local-integer-v2-acceptance.json` passes 24 local cases, including scientific `2e0` normalization and length readback plus fresh saved D/T/M matrices. `native/staging-24ec-integer-acceptance.json` separately passes 10 real-image cases and exact Undo 13 / fresh CSS and IDs restoration. Integer verification: 2,421 passed / 5 skipped, 30 behavior checks, 24 zero-pixel images. The v1 scientific failure is historical before-fix evidence, not a current release hold. |
| WP55 | **Bounded native acceptance; final guard exact** | `native/wordpress-preview55-integer-acceptance.json` passes saved Editor D/T/M and actual frontend 1440/834/390 with Save disabled; Restore Version 13→document 15, 11 IDs and CSS exact. Evidence `bbde657e2170ed804c57c00215577d444749b855`, CI `39031896755` all PHP green; new revisions are only 513/514, 25 preexisting revisions are exact, protected15/legacy14 are exact, and final broad baseline `56d956df0ae435a527f6b628230b515504e30237fb1d3aa6efe17aa330532298` is accepted; raw broad differences are limited to fixture487 revision/post/meta/count fields. |
| History recovery | **Bounded native acceptance** | `native/staging-b2-history-acceptance.json` plus `native/staging-b2-history-final.jpg` passes actual Save attribution → Version 780 → Restore 779 → 781, with full CSS/IDs/Quote exact, final history rows 1..781, and zero post-deploy resource errors. The earlier UI500/773 memory/Edge symptom is fixed; retry CPU evidence was inconclusive. |
| Quote content/alignment | **Bounded native acceptance** | `native/staging-029-quote-content-alignment.json` records nine D/T/M runtime cases with fresh restoration. The initial text-align expectation was classified as a harness issue because the Content block uses `align-self`. |
| WP53 Follow | **Final bounded acceptance** | `native/wordpress-preview53-follow-acceptance.json` final/restored scope is complete: authoritative 11 editable data-ids, revisions 503–508, document 8→11, protected15/legacy14, canonical restored content exact; package evidence `7ba16caac48e810d8c12bf40947a437e99a1ad83`, CI `39023315271`, final guard `04c4755ca6daae5313608a20b8734fe7767b526d40b0d6893983ae887b1a272e` exact. |
| WP52 | **Final bounded acceptance** | Numeric acceptance and final guards are complete with authoritative 11 editable data-ids, revisions 501/502, protected15/legacy14 unchanged, and broad baseline `92ba2a482c8a144ef6591e6aee5c8b86da3a8247a922e274897fa9a73390a0cc` exact. |
| RichText | **Bounded native acceptance** | `native/staging-75ed-richtext-alignment-link-acceptance.json` passes 12 finite D/T/M alignments, three persisted matrices, toolbar link/query/entity behavior, three custom link-colour matrices, and exact restoration. Broader Advanced/common Style/shared-text coverage remains open. |
| Collection / List | **Bounded native acceptance** | `native/staging-75ed-collection-layout-acceptance.json` records 13 content/layout cases, three saved 5% Slider Home/End D/T/M cases, and exact fresh restoration; c73 filter acceptance is separately scoped. Broader List Style/Advanced/public/larger-dataset coverage remains open. |
| Unit / Wrap | **Bounded native acceptance** | `native/staging-c73-unit-wrap-acceptance.json` passes 18 cases with saved Gap 0/Columns 1 fresh reload, negative Top/Z-index and Button letter-spacing D/T/M retention, initial restoration, and exact IDs. |
| Follow combined candidate | **Local proof only** | `native/local-nav-combined-acceptance.json` and the four-source local candidate prove the named local cases; shipped/staging status is represented by the 029 native report above. Do not promote local candidate test counts into a separate staging claim. |
| Overall status | **Open** | Full QA remains false; all fifteen broad areas remain open. |

## Historical evidence — superseded point-in-time records

The remainder is retained historical evidence. Its checkpoint wording does not override the current reconciliation above.

## Historical findings — superseded checkpoints

The findings below are preserved point-in-time reports. Their statuses and wording apply to the checkpoint named in each heading, not to the current reconciliation above.

## Historical 6cfa snapshot — superseded by the 2026-10-17 532 reconciliation

This section records superseded 6cfa findings; historical findings and before-fix records remain preserved. `overallPass=false` and `fullCustomerRetestComplete=false`.

- **Current source/deployment:** main and staging are exact `6cfa3b9347a31ae3c9d1e96972a86b0a4c1a5d21`; CI `38975915873` and deploy `38975915820` are green. Production remains unchanged at `cc026d65d275f16374eb356d0331cebb93430c85`.
- **WordPress boundary:** Preview42 passes 6/6 named native cases: clean saved reopen, 414px editor rendering, correct native Preview, 390px public menu/Escape focus, Visit navigation, and retained External HTTPS POST markup ([report](native/wordpress-preview42-native-acceptance.json)). Its public page logged two Electron sandbox/preload host errors; this is explicitly not clean-console proof. The final WordPress record is `37e22717a799c71bc7f0c7f9fc288f0bd998e3e8` with green CI `38980064207`. Preview41 was never installed. Preview40 controlled POST/GET receipts remain historical bounded delivery evidence; provider/email fulfillment remains unproven.
- **Page destinations fixed/accepted:** post 436 now passes 16 canonical pages, clean view-only state, blocked GET error/Retry recovery, explicit empty/Home/current-page behavior, save/reload/public follow, and ordinary Save repair of a raw legacy self-link. Protected 10 exact, revisions coherent, final v18 stores canonical URL+HTML ([native](native/wordpress-preview36-native-page-links.json), [route guard](wordpress-contract/preview36-native-436-route-repair-readonly.json), [picker](wordpress-contract/preview36-native-436-page-picker-final-readonly.json)).
- **New native acceptance:** staging review-label, RichText-label, and inline edit/view-only fixes pass ([review](native/staging-b10-review-label-fixed.json), [RichText](native/staging-782-rich-text-label-fixed.json), [inline](native/staging-782-inline-edit-view-only.json)). Owner review passes Resolve/Reopen/Remove/Restore/reply/reload with stable pin 1 desktop / 2 mobile; private QA link is revoked, URL unavailable, zero links/invites, while guest/member denials remain unproven ([actions](native/staging-782-review-owner-actions.json)). Code/Table finite matrices pass ([Code](native/staging-code-language-matrix.json), [Table](native/staging-table-finite-content-matrix.json)).
- **Dynamic fields:** native live dynamic fields pass post 370 title/content/distinct excerpt, exact Include 370 template 470 wins, desktop/mobile no-overflow, pause fallback/reactivate/restoration/final paused; global 462 remains draft/inactive ([report](native/wordpress-preview37-live-dynamic-fields.json)). Ordinary Gutenberg blank iframe remains an unproven compatibility limitation, with no Pagecraft cause confirmed. An earlier 13-guard probe documented one post-370 edit-lock heartbeat mismatch and normalized only that row; the later Preview40 protected14 guard after separate post 479 activity is strict-exact with no exceptions.
- **New bounded acceptance:** draft global 462 Single Page Title/Post Content save/reload and preview samples pass. Live activation was not run because the ordinary WordPress block-editor canvas was blank after reload; cause is unproven and not attributed to Pagecraft.
- **CMS scalar authoring:** 26 entries and seven current fields support bounded authoring/query checks. Representative readbacks, zero/false persistence, invalid-type and blank-title blocking, pagination, and populated-type locks pass ([report](native/staging-cms-scalar-matrix.json), [reviewed capture](native/staging-cms-zero-false-readable.jpg)). This is not 26 full field-by-field readbacks or public Collection acceptance.
- **c411 Collection fixes:** five repeated-selection cases pass across Community Garden/Courtyard, parent HUD/Escape, and mobile repaint. Source changes no longer bind Image source/alt to incompatible scalar fields; one Undo restores the original source and six controls. The inherited shared-component guard blocks unsafe changes without document/history mutation ([selection](native/staging-c411-collection-selection-fixed.json), [source swap](native/staging-c411-collection-source-swap.json), [guard](native/staging-c411-component-source-guard.json)).
- **Collection follow-ups accepted on 6cfa:** the prior source-Undo context mismatch now passes the exact Courtyard → Scalar fallback → Undo sequence with the selected visible copy, Collection identity, Image inspector, and exhausted Undo state aligned ([report](native/staging-6cfa-source-undo-context-fixed.json)). Typed filters pass 21/21 across Boolean aliases/Undo/Redo, Number zero and invalid correction, Date leap-day/invalid/contains behavior, Option legacy/configured/substring behavior, and Reference labels/runtime ([report](native/staging-6cfa-typed-filter-acceptance.json)).
- **Persistence and responsive boundary:** only the `SIL` Option contains state and final Boolean `No` state were individually reloaded. The remaining cases are native control/runtime acceptance. Mobile uses a 414px canvas with 399px client width after the native scrollbar and has no horizontal overflow ([desktop](native/staging-6cfa-boolean-no-readable.jpg), [mobile](native/staging-6cfa-boolean-no-mobile-readable.jpg)). Public Cloud Collection routes and remaining Style/Advanced/layout combinations remain open.
- **Open Site checks target defect:** the first no-alt finding correctly names Courtyard, but **Show me** selects Community Garden and opens that item’s Image inspector ([before](native/staging-6cfa-site-check-item-target-before.json), [capture](native/staging-6cfa-site-check-item-target-before.jpg)). The structured-target fix is a local, uncommitted candidate; it has no staging acceptance.
- **Open Accordion label defect:** 17/17 finite content/runtime cases pass, but editing the first question and blurring updates the input and canvas while the visible edit-row label remains “What do I get?” and the input context label remains “Question for What do I get?, item 1” ([matrix](native/staging-6cfa-accordion-content-matrix.json), [before](native/staging-6cfa-accordion-label-before.json), [capture](native/staging-6cfa-accordion-label-before.jpg)). Ten module Style checks were observed before reload only; Style persistence and common Advanced remain untested. The label fix is a local, uncommitted candidate with no staging acceptance.
- **Operational save interruption:** during the typed-filter run, the editor reported that its host connection was lost. The draft remained in the tab; a 260,852-byte valid JSON backup with `0600` permissions was captured; Try saving again reached Draft saved; and `SIL` persisted after reload ([report](native/staging-6cfa-save-interruption.json)). The warning is produced by the save failure/readback path, not an editor heartbeat. Its trigger is unconfirmed. A separate read-only observation of three PUT 200 responses cannot be attributed to the failed request and does not establish the cause.
- **Verification/boundary:** the 14 protected Preview40 fixtures remain exact after separate post 479 activity ([guard](wordpress-contract/preview40-post-479-protected14-readonly.json)); Preview42 has bounded 6/6 native acceptance with its Electron-host errors retained. Fifteen broad areas remain open; `overallPass=false` and `fullCustomerRetestComplete=false`. No overall percentage, full-product pass, or production-readiness claim follows.

Snapshot: 2026-10-17 Asia/Manila. This is a bounded evidence reconciliation, not an exhaustive defect list or a full-product acceptance result.

## Historical e300 findings — 2026-10-17

This section supersedes later “current” wording where it conflicts; historical defect and interruption evidence remains preserved.

- **Deployment boundary:** main `e300251a0c4c1740579982c48fa93295dc455308` is pushed with CI/deploy pending. Staging still reports exact d99, whose CI `38934875036` and deploy `38934875058` passed. Production remains unchanged at cc026.
- **Preview34 package and responsive scope:** WordPress commit `9c8c0f6ff8cd52ae3aa72ad7420bd57b08d8ad5d` passed CI `38935158254`, is installed on Local QA, and pins exact d99. Cloud compact-toolbar access is accepted at 390px. Preview34 WordPress exposes History, Checks, and Help at 600/390px, returns settled focus, preserves clean Save, and avoids 390px overflow ([pin](wordpress-contract/preview34-pin.json), [Cloud report](native/staging-compact-toolbar-deployed.json), [WordPress report](native/wordpress-preview34-compact-toolbar.json)).
- **Help focus classification:** the initial `mClose` reading occurred before the exit animation settled. The settled Preview34 record has `settledModalHidden:true`, visible `moreToolsBtn` focus, and `bugConfirmed:false` ([settled record](native/wordpress-preview34-help-focus-before.json)). The e300 source change is defensive regression hardening; it passes Escape, Close dialog, and Got it but is not yet deployed or included in Preview34 ([local result](native/local-help-focus-fixed.json)).
- **Revision coherence accepted in the tested scopes:** disposable page 420 passes 14/14 database checks and fresh reload; disposable draft global 430 passes 22/22 checks, stays unpublished, and retains conditions; legacy global 141 exposes the safe-unavailable warning with zero Restore buttons. Protected state and prior revisions remain preserved ([page guard](wordpress-contract/preview34-native-restore-verification.json), [global guard](wordpress-contract/preview34-native-global430-restore-verification.json), [legacy warning](native/wordpress-preview34-legacy-global141-history.json)).
- **Capture-layer result:** the e300 source passes 30/30 behavior checks and 24/24 byte- and pixel-exact comparisons to the reviewed baseline. The manifest is the only baseline record changed and verifies 24 images against 28 source files ([behavior](gallery/focus-final-behavior-checks.json), [comparison](gallery/focus-final/exact-comparison.json)).
- **Button retention result:** deleting the applied class, Undo, Redo, save, reload, preview, and final deployed reload preserve authored padding, border, background, and text colour. Imported shorthand collision remains automated-only, so broader shared-style acceptance stays open ([report](native/staging-button-class-deletion-roundtrip-final.json)).
- **Collection result:** composed sort/filter/pagination, Photo nonempty/empty filtering, conditional Image output, reload, and original-fixture restoration pass on the five-item staging Cloud collection. The reviewed preview shows all five cards and exactly one visible conditional Image; the restoration again shows the original first two cards, two Images, and no disabled condition ([query](native/staging-collection-composed-query.json), [empty filter](native/staging-collection-photo-empty.json), [conditional record](native/staging-collection-conditional-image.json), [visual proof](native/staging-collection-conditional-preview-visible.jpg), [restoration](native/staging-collection-original-restored.json)). Larger datasets, other field types, and Cloud/public breadth remain open. WordPress dynamic fields are a separate surface; Collection is not a WordPress Add choice.
- **Retained local acceptance:** managed Form request-ID recovery and live-review owner actions remain accepted in their recorded Cloud/local scopes. WordPress has `managedForms=false` and exposes External HTTPS only; Preview25 proves saved markup without submission. These records do not close external delivery or staging/release acceptance.
- **Dependency audit:** three reported highs reduce to one dev-only Braces advisory chain; production-only audit is zero. No compatible patched Braces version is available, so this is monitored rather than described as fixed ([audit](dependency-audit-b2c3731.json)).
- **Generated-state preservation:** a main-checkout test command rebuilt six protected generated files. Commit work paused, all six were recovered, and all 11 protected files matched their pre-incident SHA256 values after staging and after e300 commit. No source, working-state, or customer-data loss occurred ([incident](generated-preservation-incident/incident.json), [recovery sources](generated-preservation-incident/recovered-five.json), [11/11 verification](generated-working-preservation-focus-2026-10-17.json)).
- **Overall boundary:** `overallPass=false` and `fullCustomerRetestComplete=false`; hosted/public health, broader modules and shared styles, WordPress dynamic fields and External HTTPS delivery, account/session, billing, providers, and other external delivery remain open.

## NAT-004 — Managed Form request-ID recovery after a controlled 503

**Status:** fixed in the source line and natively verified in the recorded local Cloud receiver; external delivery remains open. This is not a WordPress managed-form journey because WordPress declares `managedForms=false`.

**Pre-fix environment:** loopback-only real managed receiver and file store at `localhost:4918`. The site, Form, and publication were created through the native builder UI; submissions used the rendered public Form. The f77 runtime was unmodified for this probe.

**Pre-fix observed behavior:**

- Before-store 503: no entry is initially persisted. Back preserves the entered fields and re-enables Send, but reconstructs a different `_pc_request`. Retry succeeds and moves the store from `0` to `1`.
- After-store 503: the first request is already persisted, moving the store to `2`. Back preserves fields and re-enables Send, but again reconstructs a different `_pc_request`. Retry is accepted as a new submission and moves the store to `3`.
- The native inbox contains two distinct **Native After Failure** rows and the earlier **Native Before Failure** row.

The existing source-contract dedup behavior applies when the same request ID is retried. It does not protect this path because the public runtime/history reconstruction creates a new ID before each retry. Passing source-contract tests therefore do not contradict the native failure and cannot close it.

- [Pre-fix native report](native/form-fault-recovery-before-fix.json)
- [Before-store error](native/form-fault-before-error.png)
- [Before-store recovered](native/form-fault-before-recovered.png)
- [After-store error](native/form-fault-after-error.png)
- [Duplicate inbox before fix](native/form-fault-after-duplicate-inbox-before-fix.png)

**Fixed result:** browser Back/history reconstruction now preserves the original request ID while retaining all field values and re-enabling Send. The before-store native retry finishes with one entry (`0 → 1`). The after-store native retry is deduplicated (`2 → 2`) and adds no duplicate row; the inbox contains the two valid before/after submissions with the recorded details. The final integrated after-store check also keeps one entry (`1 → 1`) and presents “We could not confirm your submission. Please try again shortly.”

- [Fixed before/after report](native/form-fault-recovery-fixed.json)
- [Final integrated report](native/form-fault-final-integrated.json)
- [Final one-entry inbox](native/form-fault-final-one-entry.jpg)

The fix preserves the browser-generated request ID so the existing backend same-ID deduplication contract can operate. It does not claim external provider delivery or a complete Form customer journey.

## NAT-003 — WordPress Version history loads but remains hidden under library focus

**Status:** fixed on d99 and natively accepted in Preview34, including compact 600px and 390px toolbar access.

**Trigger:** Reload exact-b117 WordPress Preview31 at 1280×720 with no selection and the Add panel active, then open Version history.

**Expected:** The right auxiliary panel becomes visible and presents the revision-scope disclosure and available versions.

**Actual before the fix:** History content loaded and `hidden` was false, but `body.library-focus` remained active. Its rule kept `.rightAux` at `display:none` and zero width, so the disclosure and revisions could not be seen.

- [Before-fix native report](native/wordpress-preview31-history-hidden-before.json)
- [Before-fix screenshot](native/wordpress-preview31-history-hidden-before.png)

**Current result:** Cloud staging exposes the compact More tools flow at 390px with contained bounds, History, live-link copy, and focus return. Preview34 WordPress exposes History, Checks, and Help at 600/390px; panel closure returns focus, the canvas-focus roundtrip keeps Save clean, and the 390px viewport has no horizontal overflow. Post 378 lists unique versions 14 through 1.

The compact artifact’s `passed:false` is retained because its first Help-focus read sampled `mClose` during the closing animation. The separate settled Preview34 record shows the modal hidden and focus on visible `moreToolsBtn`; it explicitly records `bugConfirmed:false`. The e300 focus bridge is defensive hardening and passes all three Help exits. It is not yet deployed and is not used to retroactively relabel Preview34.

- [Cloud compact-toolbar report](native/staging-compact-toolbar-deployed.json)
- [WordPress compact-toolbar evidence](native/wordpress-preview34-compact-toolbar.json)
- [Settled Preview34 Help focus](native/wordpress-preview34-help-focus-before.json)
- [Local defensive hardening](native/local-help-focus-fixed.json)
- [Preview34 pin](wordpress-contract/preview34-pin.json)

Revision restore is separately accepted for disposable page 420 and draft global 430, while legacy global 141 correctly remains unavailable to restore.

- [Page restore database guard](wordpress-contract/preview34-native-restore-verification.json)
- [Page fresh reload](native/wordpress-preview34-native-restore.json)
- [Global restore database guard](wordpress-contract/preview34-native-global430-restore-verification.json)
- [Global fresh reload](native/wordpress-preview34-native-global430-restore.json)
- [Legacy global warning](native/wordpress-preview34-legacy-global141-history.json)

Historical superseding checkpoint: main `6e68b41428bc4c471b4c45e6717eca4b5df2be3d` was pushed. WordPress Preview 25 was installed at `0734b96eee395cf85677220bebf35c35ed5b3f1e` with CI `38797640634` green; immediate Preview and simulated 503 recovery passed, while Retry left Save enabled/dirty. The later 9c263a6 checkpoint and WP29 native lane, themselves historical, are recorded below. This is scoped evidence only; no full-product acceptance result is claimed.

## NAT-001 — New Button lacks the expected brand semantic fallback

**Status:** fixed in the reviewed working tree; local evidence is retained, but commit/deployment
and fresh staging/WordPress acceptance remain pending.

**Trigger:** In the final café fixture, add a new Button with its default settings, then inspect it
in the editor, preview, and controlled published page.

**Expected:** A newly inserted primary Button inherits the design system’s brand semantic styling,
including its brand background and readable foreground.

**Actual:** The new Button has an empty `brand` value, transparent background, and ink-coloured text.
The same missing semantic survives preview and publication.

**Evidence:**

- [Editor values](native/cafe-new-button-before.json)
- [Editor screenshot](native/cafe-new-button-before.png)
- [Preview screenshot](native/cafe-new-button-preview-before.png)
- [Published values](native/cafe-new-button-published-before.json)
- [Published screenshot](native/cafe-new-button-published-before.png)

**Acceptance boundary:** Rebuild from the parent’s final brand-fallback source commit, add a fresh
Button, and verify editor, preview, saved reload, and published computed colours. Existing Button
control round trips remain valid scoped evidence; they do not close this default-semantic defect.

**Current result:** the missing `brand` semantic aliases the existing `accent` without changing
saved template tokens. A fresh Button uses the existing `paper` foreground on the dark café
accent (4.64:1); transparent variants inherit surrounding text. New Form submit buttons use the
same readable pair. The initial foreground patch still lost to a stronger inherited-color rule;
native computed-color checks caught that error before deployment. The corrected rules use equal
zero specificity so explicit authored typography continues to win.

- [Final native Button values and all variants](native/button-compatibility-final.json)
- [New Form fields and submit colors](native/form-default-compatibility-after.json)
- [Intermediate foreground failure, superseded](native/button-compatibility-after.json)

## NAT-002 — Button variant defaults override an explicit border

**Status:** fixed in the reviewed working tree; local evidence is retained, but commit/deployment
and fresh staging/WordPress acceptance remain pending.

Set a new Button to Outline, then set Border width to `0`. Before the fix the inspector retained
`0` while the rendered border remained `1px`. A selective specificity bridge now lets authored
border, background, radius, and padding declarations win while preserving untouched variant
defaults. Shared classes and responsive declarations use the same contract. Factory defaults are
side-effect-free; rendering does not create throwaway Button nodes.

- [Before: inspector 0, computed 1px](native/button-outline-border-before.json)
- [After save/reopen: inspector 0, computed 0px](native/button-compatibility-final.json)
- [Inspector evidence](native/button-border-final.png)

**Known model limit:** an explicit desktop value exactly equal to the stored factory default is
indistinguishable from untouched factory state. This fix does not claim to solve provenance.

## Export preparation consistency

**Status:** source fixed; deferred orchestration tests pass; native WordPress preview 14 output
refresh and audit pass. Broader staged/public export acceptance remains pending.

Single/all-page export previously read the live image mode after asynchronous work. Each export
now captures mode and targets, checks the document snapshot during preparation, and prepares all
referenced page/asset bytes before downloading. A draft changed during preparation stops with
retry guidance. Completed prepared bytes remain a consistent snapshot during the download phase.

## Interrupted-session Accordion activation

**Status:** not reproduced in a fresh native session; no product patch.

The earlier browser session failed to activate native summaries in Preview while the same
published document worked. After the app/browser restart, fresh Preview passed Enter, Space,
multiple-open and single-open behavior without any builder source change. The source harness
also preserved the native default action. The earlier trace is not accepted as a confirmed
Pagecraft defect.

- [Fresh native keyboard states](native/accordion-fresh-preview-keyboard.json)
- [Published keyboard states](native/accordion-published-keyboard.json)

## Browser-control limitation — cross-origin form navigation

**Status:** blocked external; not classified as a Pagecraft product defect.

The exported `localhost:4901` form emitted the correct POST to the controlled `localhost:4900`
receiver, but the built-in-browser inspector stopped the document request with
`net::ERR_BLOCKED_BY_CLIENT` and `blockedReason: inspector` before the receiver saw it. The final
same-origin version-10 publication submitted successfully, reached the thank-you page, restored the
button after Back, and stored the exact fictional QA entry. No API/direct POST was used to bypass
the browser policy.

- [Cross-origin network evidence](native/exported-form-network.json)
- [Same-origin network evidence](native/published-form-network.json)
- [Thank-you page](native/published-form-thank-you.png)
- [Inbox](native/published-form-inbox.png)
- [Inbox detail](native/published-form-inbox-detail.png)

## Harness false positive — selected Accordion render height

**Status:** classified and excluded; zero native persistence passes counted.

`accordion-1.json` and `accordion-2.json` show the changed inspector values after save/reload, but
the generic actor compared incompatible edit-render states. In selected edit mode, the core renderer
intentionally forces every Accordion answer open so it can be read and styled. Mutation rerender,
fresh reload before selection, and Navigator reselection can therefore produce heights of roughly
`313.984px`, `180.812px`, or `225.203px` without losing the stored `open` or `single` values.

- [Accordion run 1](native/accordion-1.json)
- [Accordion run 2](native/accordion-2.json)
- [Intentional forced-panel source](../../app/src/core/index.ts#L8128)

Exact computed height is excluded only for selected edit-mode Accordion/Tabs, and UI-only `--z` or
`--zfit` values are excluded across modules. Actual declared property output remains strict; for
example, Max width still compares the resulting width. Manual preview acceptance remains pending
for All closed, First, All, single-open behavior, and reload.

## Native input interruption

**Status:** unresolved browser-control boundary; not a confirmed Pagecraft defect.

After successful WordPress update and mobile-menu checks, activation stopped taking effect in local builder Navigator/pickers and staging Add new site. Fresh tabs, rebinds, and a CUA-session reset did not restore activation. Read-only DOM/screenshots remained available. No failed activation is counted as native acceptance. See [diagnostic](native/browser-input-stall.json). Manual comparison is pending.

## Latest continuation — staging and dependency checkpoint

**Snapshot:** 2026-10-15, after native input recovered. Current Cloud HEAD is `26f600d`; the
button contrast fix is `3fd05be`; staging site `c11494e8-3ae5-4be0-b707-e937278a710a` is the
**Full Customer Retest 2026-10-15** site with seven pages, including QA Modules. The CommonGround
3/3 guide is complete ([guide](native/staging-template-guide-complete.jpg)). This remains scoped
evidence and not a full-product acceptance result.

### Scoped native module results

- Code copy preview, plain/conditional code, Table semantic/conditional-color readback, Breadcrumb
  link/current-item semantics, all Icon choices, Embed aspect options, Tabs keyboard Home/End, and
  Form GET action/query save/reopen have direct evidence ([Code](native/staging-code-copy-preview.json),
  [Table](native/staging-table-semantic-readback.json), [Breadcrumb](native/staging-breadcrumb-combined-reopen.json),
  [Icon](native/staging-icon-all-choices.json), [Embed](native/staging-embed-aspect-options.json),
  [Tabs](native/staging-tabs-preview-keyboard.json), [Form](native/staging-form-get-query-reopen.json)).
- Four Button variants save/reopen and the fresh Form submit render against the dark brand with readable
  colors ([Button variants](native/staging-dark-brand-button-variants.json), [Form](native/staging-dark-brand-form-fixed.json)).
  The earlier dark-brand contrast was `1.76:1`; the corrected staging evidence is retained. The fresh
  Form result is `7.73:1`.
- Slider arrows/dots move the track and update enabled states ([runtime](native/staging-slider-preview-runtime.json)).
  The last sample is mid smooth-scroll, so Home/End and exact destination landing remain pending. Tabs
  Home/End is accepted from its separate keyboard record.

### Recovery and operational boundaries

- Manual Add new site now opens and native input recovered. The prior input-stall finding remains a
  historical browser-control failure; it is not erased and stopped probes are not promoted to passes.
- Preview 15 is installed from main `3fd05be` and package CI passed ([pin](wordpress-contract/preview15-pin.json));
  fresh native WordPress default-button/Form checks remain pending.
- Generated artifacts were restored to exact pre-task hashes for `index.html` and `dist/core.cjs`
  ([recovery](generated-recovery-20261015.json)). This documents recovery without implying source or
  customer-data loss.
- Production remains unchanged. The production-only dependency audit is clean; the full audit retains
  three dev-tool entries from one unpatched Braces chain. The Nodemailer test uses an in-memory transport,
  so there is no real SMTP delivery proof ([audit](dependency-audit-20261015.md)).

Table conditional-color and Slider blank-default worker patches are uncommitted and their native
after-fix behavior is pending. CI readback, exhaustive module/control coverage, staging public-route
and console/network health, account/billing, external provider, SMTP/email delivery, and all remaining
customer journeys remain open.

## Latest 43a / preview 16 checkpoint — newly discovered save and capability boundaries

### Cloud lost-response save conflict

**Status:** newly discovered in the current Cloud path; a working-tree recovery fix is reviewed
locally but is not committed or deployed.

When a Cloud save request may have committed after its response was lost, the editor cannot infer
success from the version alone. The safe result is a readback comparison against the attempted
document and version; if readback is unavailable or differs, the editor must preserve the draft,
offer backup/reload, and avoid overwriting the host. The earlier generic connection-loss surface
(`staging-host-connection-save-error.json`) says the page was not saved and would therefore be
misleading for this lost-response case. Keep this as a pending native/staging retest until the
43a working-tree fix is deployed.

- [Save recovery scope](save-recovery-build-path.json)
- [Earlier host-loss surface](native/staging-host-connection-save-error.json)

### Historical WordPress managed-mode capability mismatch

**Status:** historical unsupported-choice evidence; current capability is explicitly External HTTPS
with `managedForms=false`.

Preview 16 proves the original combined typography regression on the exact 43a source and readable
fresh default Button/Form output. Its retired managed-mode save failure is preserved because the
active WordPress plugin has no receiver/token-resolution path. Current evidence correctly exposes
External HTTPS only; Preview25 proves saved endpoint markup without a submission. Managed mode is
therefore not a remaining WordPress customer journey.

- [Preview 16 defaults and managed-save result](native/wordpress-preview16-new-defaults.json)
- [Preview 16 combined typography reopen](native/wordpress-preview16-button-combined-reopen.json)
- [Managed-form capability audit](wordpress-contract/managed-form-gap.md)
- [Preview25 External HTTPS markup](native/wordpress-preview25-external-form.json)

### False dirty warning after view-only WordPress interaction

**Status:** fixed and scoped native retest accepted.

View-only responsive/device inspection should not mark a document dirty or present a save warning.
The current staging readback covers Content, Style, and Advanced across Desktop, Tablet, and
Mobile. Undo and Redo remain disabled in all nine states, so the named Cloud view-only dirty-state
gate is closed. This does not establish broader responsive or account/session coverage.

- [View-only dirty-state evidence](native/wordpress-view-only-dirty.json)
- [Current nine-state readback](native/staging-view-only-clean.json)

### Historical b117 gallery baseline boundary

The earlier b117 hardened repeat recorded **30/30 behavior checks in both runs, 24/24 comparator passes, and 24/24 exact decoded A/B pixels**, with equal recorded environment, capture-code, recipe, UI-source, and PNG color metadata. That evidence and its recorded baseline remain preserved ([comparison](gallery/repeat-final-comparison.json), [review](gallery/repeat-final-a/visual-review.md)). It is historical and is superseded for current capture status by the b4 canonical block at the top.

## Late native direct-control checkpoint — 2026-10-15

The new Section, Row, Column, Heading, Image, and Box Gap reports are accepted as direct native evidence within their named scope. They enumerate the relevant Content, Style, and Advanced controls, then save/reopen or render the resulting values. The mechanical bounded ledger therefore has zero remaining and zero partial rows for these six modules ([ledger](native/structural-control-remaining.json)). This does not convert those scoped controls into blanket module passes or an overall percentage.

- **Section:** two content-width modes, min-height, all seven semantic tags, and reload readback are recorded ([report](native/staging-section-controls-roundtrip.json)).
- **Row:** gap, five vertical-alignment options, five distribution options, both wrap modes, columns 1–6, and reload readback are recorded ([report](native/staging-row-controls-roundtrip.json)).
- **Column:** share, min-basis, vertical/horizontal alignment, gap, and reload readback are recorded ([report](native/staging-column-controls-roundtrip.json)).
- **Heading:** text, nine text styles, eight tags, three alignments, five link modes, Position choices, direct Top `12px`, and Max width `300px` are recorded ([report](native/staging-heading-controls-roundtrip.json)).
- **Image:** all eight Content and six Style controls are directly tested. Lazy preview records `lazy` and eager `null` loading; phone link persistence is correct. A linked decorative image is confirmed to have no accessible link name; the explicit link-label/lint fix in `13831c8` is pending native verification ([report](native/staging-image-controls-roundtrip.json)).
- **Box:** the fresh Gap roundtrip records `27px` before and after reload ([report](native/staging-box-gap-roundtrip.json)); existing direct Box controls remain separately evidenced.

The v40/v41 conflict recovery report shows the host document and saved backup are identical and no edit was lost. The original cause is not established because the original request trace was not captured; `13831c8` tests and native retest remain pending ([recovery](native/staging-header-conflict-recovery.json)).

The latest isolated test result in that historical checkpoint was **2,191 passed / 5 skipped across 192 files / 2 skipped**. The prior form-integrity gallery was **30/30 behavior and 22/24 image comparisons**; two blank artifact frames were retained and recovered, and the wrong-base helper harness attempt was discarded as a harness error rather than a product failure. Main `13831c8` and Preview20 are historical; current source/deployment is recorded below.

Full QA remains incomplete. Broad component classes, shared styles, structural editing, undo/redo, repeaters, form submission, WordPress/public publication, deployment, public endpoint health, account, billing, and external-provider gates remain open.

## Historical native and deployment checkpoint — 2026-10-16 (superseded by current bc2e72ad)

This section supersedes the earlier pending statements where new native evidence now exists.

- **Staging/deployment:** Main `13831c8` is staging-verified. CI `38764290851` and deploy `38764291091` are green. Production remains unchanged at `cc026d65`.
- **Cloud save recovery:** Simulated HTTP 502, identical 409, and unavailable-readback branches committed/read back exact content; a distinct real-writer document was correctly blocked with the “Somebody else saved this page” dialog, no save, and Download my copy/Reload theirs choices ([unavailable](native/staging-unavailable-readback.json), [502](native/staging-http502-save-recovery.json), [409](native/staging-identical409-save-recovery.json), [reload](native/staging-save-recovery-after-reload.json), [writer conflict](native/staging-real-writer-conflict.json)). The original transport cause is unconfirmed; final deployed health remains open.
- **Decorative linked Image:** The `13831c8` fix is native-verified. The explicit Link label persisted through reload and the prior site-check finding is gone ([fixed](native/staging-decorative-image-link-fixed.json)).
- **Shared and remaining native modules:** Shared-class create/override/remove/undo/redo/reload, RichText marks/blocks/link, Quote, Spacer units/reset, Collection sorting/filtering, Navigation authoring, and Link block now have scoped native evidence ([shared class](native/staging-shared-class-roundtrip.json), [RichText](native/staging-rich-text-roundtrip.json), [Quote](native/staging-quote-roundtrip.json), [Spacer](native/staging-spacer-units.json), [Collection](native/staging-collection-controls.json), [Navigation](native/staging-nav-authoring-roundtrip.json), [Link block](native/staging-link-block-roundtrip.json)). These do not close broader responsive, public-route, keyboard/focus, or customer-flow coverage.
- **Published form:** The staging published route [QA Header Patterns](https://staging.itspagecraft.com/qa-header-patterns-2026-10-15/) rejected empty required and invalid email, reached valid thanks, and produced one matching inbox and CSV receipt ([receipt](native/staging-published-form-receipt.json), [CSV](native/staging-native-csv-after-f8a5d05.json)). The actual OS download and exact message are now confirmed; the earlier top-tab timeout is historical and its cause remains unproven.
- **WordPress preview 20:** Package `0.2.17-preview.20261015.20` remains historical scoped Image/Spacer evidence. Preview 22 is also historical and is superseded by current Preview 23 for media safety.
- **Test and visual boundaries:** Isolated verification in that historical checkpoint was **2,191 passed / 5 skipped across 192 files / 2 skipped**. The prior form-integrity gallery was **30/30 behavior and 22/24 image comparisons**; two blank artifact frames were preserved/recovered, and the wrong-base helper attempt was discarded as a harness error. Visual status at that checkpoint was the first-click gallery at 24/24 and 30/30.

Full QA remains incomplete. Remaining gates include List/collection breadth, responsive typography reset/inheritance, managed forms, Cloud/device dirty-state verification, media usage/safety, structural editing/undo/redo/repeaters, broader form submission, public routes/console/network health, account, billing, and external-provider checks.

## Historical 9c source and native checkpoint — 2026-10-16

This section supersedes earlier source and native status where newer evidence exists.

- **Source/deployment:** Main `9c263a62f9b77d27a28ebe2ab8b4ee6890b5146c` is pushed and deployed with exact `__deployment` verification. CI `38820308112` and deploy `38820307896` passed. WP29 exact source is installed from `c956c6dc906083e07af419a2d65432cf2541a494` with CI `38820762846` passed ([pin](wordpress-contract/preview29-pin.json)); native CAS/concurrency is accepted with backup receipt unverified, and native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance. Production remains `cc026d65`.
- **Full suite:** Clean verification is **2,238 passed / 5 skipped across 196 files / 2 skipped**; typecheck, build, and demo checks pass. No overall percentage is derived.
- **Motion:** All 27 named animation choices plus four transition presets, custom timing, replay, None, reduced-motion, inspector persistence and reload are accepted in the `722af3b` report ([report](native/staging-motion-all-options.json), [persisted](native/staging-motion-persisted.jpg), [reduced](native/staging-motion-reduced.jpg)). The evidence is scoped to the tested Heading/shared transition surface; no new 6e native acceptance is inferred.
- **Divider:** Visible 1px reset, explicit 0, mobile 4px override and clear inheritance, desktop unchanged, colour reset, and save/reload are accepted in the `722af3b` report ([report](native/staging-divider-fixed.json), [mobile](native/staging-divider-mobile-fixed.jpg)). The earlier failure remains preserved separately; no new 6e native acceptance is inferred.
- **CSV export:** The f8 path completes an actual OS download with exact-message matching ([report](native/staging-native-csv-after-f8a5d05.json)). The old top-tab timeout is historical; the original cause is unproven.
- **WordPress Preview 23/25/27/28/29:** Preview23 media/Details remain accepted. Preview25 External endpoint-only saved markup and mobile menu Escape/focus/route are accepted with no submission. WP27 resource guards/retry/view-only/router reports remain scoped historical acceptance; WP28 recovery/palette evidence is accepted as historical. WP29 exact source is installed and pinned; native CAS/concurrency is accepted with backup receipt unverified, while native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance ([pin](wordpress-contract/preview29-pin.json), [CAS](native/wordpress-preview29-design-concurrency.json)).
- **WP/CAS status:** WP27 resource guards and view-only/router reports remain historical scoped evidence. WP29 native CAS/concurrency blocks the stale shared-settings write, shows the truthful partial-save notification with backup/reload choices, preserves the winning colour while omitting the stale text style after reload, and cleans temporary resources; the backup notification was observed but no actual file receipt was verified ([report](native/wordpress-preview29-design-concurrency.json)). The exact-ea9 Cloud palette lifecycle now has full reload/rendered CSS proof with deleted resources absent ([palette](native/staging-settings-palette-fixed.json)). Native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance.
- **Shared style and structure:** The 6a unsafe compound-state deletion guard blocks unsupported mutation ([guard](native/staging-compound-class-delete-guard.json)). Block lifecycle/reload, exact-ea9 multiselect duplicate/delete labels and atomic Undo, and component-property variants/delete Undo with ea9 reload are accepted ([lifecycle](native/staging-block-lifecycle.json), [multiselect](native/staging-multiselect-history-fixed.json), [properties](native/staging-component-properties-variants.json)); keyboard shortcut paste remains unverified because the built-in clipboard had no data, while context-menu copy/paste is accepted ([limit](native/staging-keyboard-paste-control-limit.json), [structural](native/staging-reusable-component-structural.json)). Automatic hover+focus preservation, final shared-style reload, Button specificity/shorthand, and deeper structural breadth remain open.
- **Library anchor:** Keep mine and Theirs now pass with the local anchor retained, Use Theirs at 2px, Undo at 1px, explicit Undo/Redo, and reload readback ([final](native/staging-library-anchor-fixed.json), [reload](native/staging-library-anchor-reload-fixed.jpg)).
- **Exact-ea9 native fixes:** First component override click/dropdown geometry and reset readability, live palette add/rename/value/delete plus same-dialog CSS, truthful collection empty copy/filter restore, explicit multiselect history labels/atomic Undo, and component-property reload are accepted ([first click](native/staging-first-click-fixed.json), [palette](native/staging-settings-palette-fixed.json), [collection](native/staging-collection-filter-empty-fixed.json), [multiselect](native/staging-multiselect-history-fixed.json), [properties](native/staging-component-properties-variants.json)). Cloud palette full reload/rendered CSS is accepted; WP29 native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance.
- **Gallery:** At that historical checkpoint, the first-click gallery was **24/24 image comparisons and 30/30 behavior checks** ([review](gallery/first-click-final/review.json)). Only 2 pixels in `builder-actions-1440.png` and 1 in `builder-tables-768.png` changed; no layout regression was reviewed. The prior 22/24 form-integrity comparison remains historical.

Full QA remains incomplete. Broader module/control coverage, responsive typography, keyboard shortcut paste, nesting, native CMS partial import, Form full-page POST fault proof, remaining WordPress/public delivery, Cloud/device inspection breadth, public routes/console/network health, account/session lifecycle, billing, and external-provider checks remain open.


## Historical source and native update — superseded by current 9c263a6 — 2026-10-16

- Main `ea9a0345b580c8a44454f99e7613343e745cec24` is pushed; CI `38810696752` and deploy `38810696709` completed successfully. Full verification is **2,235 passed / 5 skipped across 195 files / 2 skipped**; build/demo pass.
- Native Form fixes from `d5a4061d` pass in [staging-form-integrity-fixed.json](native/staging-form-integrity-fixed.json): canonical/unique field names, contrast cleanup, responsive grid/field controls, and desktop/tablet/mobile reload readback. Full-page POST failure recovery was not run because browser Document interception is unavailable; no POST or product-failure claim exists ([limit](native/staging-form-network-failure-limit.json)).
- WP27 exact-6e resource guards, unused-resource deletion, combined retry, view-only, and router recovery are accepted as scoped historical evidence ([pin](wordpress-contract/preview27-pin.json); [guards](native/wordpress-preview27-resource-guards.json); [retry](native/wordpress-preview27-combined-retry.json); [view-only](native/wordpress-preview27-view-only-clean.json); [router](native/wordpress-preview27-router-recovery.json)). Preview25 External endpoint-only saved markup and mobile menu Escape/focus/route are accepted with no submission ([form](native/wordpress-preview25-external-form.json), [menu](native/wordpress-preview25-mobile-menu.json)). WP28 recovery/palette evidence is accepted as historical. WP29 exact source is installed and pinned; native CAS/concurrency is accepted with backup receipt unverified, while native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance ([pin](wordpress-contract/preview29-pin.json), [CAS](native/wordpress-preview29-design-concurrency.json)).
- Unavailable-readback recovery, account Pro readback, block lifecycle/reload, exact-ea9 multiselect labels/atomic Undo, component-property variants/delete Undo with ea9 reload, first-click/dropdown geometry, live palette lifecycle, and collection empty/filter restore are accepted ([unavailable](native/staging-unavailable-readback.json), [account](native/staging-account-pro.json), [lifecycle](native/staging-block-lifecycle.json), [multiselect](native/staging-multiselect-history-fixed.json), [properties](native/staging-component-properties-variants.json), [first click](native/staging-first-click-fixed.json), [palette](native/staging-settings-palette-fixed.json), [collection](native/staging-collection-filter-empty-fixed.json)). Cloud palette full reload is accepted; WP29 native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance. At that historical checkpoint, the gallery was **30/30 behavior and 24/24 image comparisons** ([review](gallery/first-click-final/review.json)); full QA remains incomplete.
