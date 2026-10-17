## Current reconciliation — 2026-10-17 Preview51 bounded state

This section is authoritative for the current record. Older checkpoints remain preserved below as explicitly superseded historical evidence. Main/staging exact `75ed8acb11bb3297d4889f3edade56d6af31807e`; CI `39013646681` green and deployment endpoint exact. Production remains `cc026`. `overallPass=false`, `fullCustomerRetestComplete=false`, and all fifteen broad areas remain open.

| Surface | Current status | Evidence and remaining boundary |
|---|---|---|
| Gallery motion | **Bounded native acceptance** | `native/staging-c336-gallery-motion-acceptance.json` accepts five timing/Once cases and all 26 offered entry presets, including the explicit 1ms finite smoke; zero-area origins use normal scroll; reduced-motion Desktop/Tablet/Mobile remains visible with no overflow; reset to None and fresh reload restore exact structure. Legacy selected Fadeout is retained; new choices do not offer Fadeout. Full Gallery motion breadth remains open. |
| Gallery spacing | **Bounded native acceptance; broader verification open** | `native/staging-23939-gallery-spacing-acceptance.json` records rem/em/% spacing, negative margins, reset, and fresh persistence. Negative Padding `-1%` is accepted by the UI but renders as `0px`; the Controls fix and three focused tests have meaningful red/green clean-archive evidence and remain pending full/native integration verification. |
| Gallery Focus state | **Bounded native acceptance** | The earlier c336 parent-state mismatch is superseded in bounded scope by `native/staging-75ed-focus-spacing-acceptance.json`: ten keyboard/pointer/class-cascade D/T/M cases pass, with lightbox-off preservation, re-enable, and original IDs restored fresh. Broader Focus applicability remains open. |
| Focus / spacing fix | **Bounded native acceptance** | `native/staging-75ed-focus-spacing-acceptance.json` passes six negative-padding D/T/M cases across four units, valid negative Margin, Undo/Redo, and ten Focus keyboard/pointer/class-cascade D/T/M cases; lightbox-off preservation, re-enable, and original IDs restore fresh. |
| Cloud motion persistence | **Bounded native acceptance** | `native/staging-c336-gallery-motion-persistence.json` restores None/Transition fresh and retains the hover Transition record; broader motion/module coverage remains open. |
| Semantic Add / builder | **Bounded native acceptance** | `native/staging-23939-semantic-add-acceptance.json` accepts six click/drag/Redo cases with atomic originals restored. |
| Semantic Add / WordPress | **Bounded native acceptance** | `native/wordpress-preview49-semantic-add-acceptance.json` accepts five host-supported click/drag/Redo cases; Save is disabled and original IDs are exact. |
| Gallery common Style | **Bounded native acceptance** | `native/staging-23939-gallery-common-style-acceptance.json` records 12 finite cases, combined Style persistence/reset through fresh reload, and exact original full structure restoration. Broader Gallery Style/Advanced/background/border/motion/visibility breadth remains open. |
| Gallery background / border | **Bounded native acceptance** | `native/staging-23939-gallery-background-acceptance.json` records 10 finite cases with exact asset identity, reset, and D/T/M restoration; `native/staging-23939-gallery-border-edges-acceptance.json` records four exact edge persistence/reset cases. Broader Gallery breadth remains open. |
| Video | **Bounded native acceptance** | `native/staging-09-video-acceptance.json` records 11 cases, three persisted D/T/M style matrices, and restored responsive behavior; `native/staging-1c-focus-refresh-acceptance.json` records two native focus cases. Broader Video/module coverage remains open. |
| Slider | **Bounded partial acceptance** | Six D/T/M Home/End cases remain accepted; wrong Undo Add-column remains a P2 boundary with atomic Undo/Redo passing. |
| Navigator | **Bounded native acceptance** | `native/staging-c670-navigator-acceptance.json` accepts physical fresh label click plus Hide/Undo with harness limits recorded. |
| WordPress animation sanitization | **Bounded fix accepted** | Preview50 exposed KSES stripping; Preview51 closes that bounded defect across save/editor/fresh/public D/T/M and reduced-motion attributes. Broader WordPress animation coverage remains open. |
| WordPress Preview51 | **Bounded native acceptance; strict guard exact** | Source `75ed`, package `1b8f23d...`, evidence `23934e10dee5c6f10e119504fa1c24e22b0942b0`, CI `39015364932` green. Seven motion cases plus Padding and Focus D/M pass; protected15, legacy14, and broad guard hashes are exact; Theme unchanged. |
| WordPress Preview51 acceptance | **Bounded native acceptance; strict guard exact** | Source `75ed`, package `1b8f23d...`, evidence `23934e10dee5c6f10e119504fa1c24e22b0942b0`, CI `39015364932` green. Seven motion cases plus Padding and Focus D/M pass; KSES fix is accepted across save/editor/fresh/public D/T/M and reduced-motion attributes. Protected15, legacy14, and broad guard hashes are exact; Theme unchanged. |
| Navigation PHP definitions | **Concrete bounded finding; fix pending** | Root reviewed stale PHP component definitions with an uncommitted two-file fix. Broader Navigation remains unaccepted. Custom generated mobile-menu snapshot divergence is under design ownership review and is not generalized into a collapse defect. |
| RichText alignment/link | **Bounded native acceptance** | `native/staging-75ed-richtext-alignment-link-acceptance.json` passes 12 finite D/T/M alignment choices, three persisted alignment matrices, toolbar link add/remove/query and entity escaping, three custom link-colour save/reload/preview cases, and exact fresh restoration. Broader Advanced/common Style/shared-text coverage remains open. |
| WordPress runtime | **Bounded accepted resolution** | Theme runtime resolution remains accepted for the recorded bounded cases and protected mobile navigation. Existing Gutenberg blank iframe remains a host limitation. |
| Overall status | **Open** | Full QA remains false; fifteen broad areas remain open. |

## Historical evidence — superseded point-in-time records

Everything from the next historical heading onward is retained point-in-time evidence. Its “current”, “authoritative”, “pending”, and status wording applies only to the named checkpoint and does not override this current reconciliation.
## Historical queue checkpoints — superseded point-in-time evidence

Everything from the next historical heading onward is retained evidence from older checkpoints and is not the canonical current queue.

## Historical queue checkpoints — superseded point-in-time evidence

Everything from the next historical heading onward is retained evidence from older checkpoints and is not the canonical current queue.

## Historical queue checkpoints — superseded point-in-time evidence

Everything from the next historical heading onward is retained evidence from older checkpoints and is not the canonical current queue.

## Historical queue checkpoints — superseded point-in-time evidence

Everything from the next historical heading onward is retained evidence from older checkpoints and is not the canonical current queue.

## Historical queue checkpoints — superseded point-in-time evidence

Everything from the next historical heading onward is retained evidence from older checkpoints and is not the canonical current queue.

## Historical checkpoints — superseded point-in-time evidence

Everything from the next historical heading onward is retained evidence from older checkpoints. Its status wording applies only to the named checkpoint and does not override this current reconciliation.

## Historical queue checkpoints — superseded point-in-time evidence

Everything from the next historical heading onward is retained evidence from older checkpoints and is not the canonical current queue.

## Historical 6cfa snapshot — superseded by the 2026-10-17 b4 reconciliation

Everything from this heading through the end of the file is retained point-in-time evidence from older checkpoints. It is not the canonical current queue; use the b4 current reconciliation above. Older “current”, “latest”, and “highest-priority” wording is historical to the named checkpoint.

Snapshot: main and staging are exact `6cfa3b9347a31ae3c9d1e96972a86b0a4c1a5d21`; CI `38975915873` and deploy `38975915820` are green. Production remains `cc026d65d275f16374eb356d0331cebb93430c85`. Preview42 passes 6/6 bounded native cases ([report](native/wordpress-preview42-native-acceptance.json)); its public run retains two Electron sandbox/preload host errors and is not a clean-console result. The final WordPress record is `37e22717a799c71bc7f0c7f9fc288f0bd998e3e8` with green CI `38980064207`. Preview41 was never installed and is superseded. Overall pass and full-customer completion remain false.

The post-436 renamed-page destination defect is fixed and accepted in Preview36: 16 canonical pages, view-only clean, blocked GET error/Retry recovery, explicit empty/Home/current-page behavior, save/reload/public follow, ordinary Save legacy-self-link repair, protected 10 exact, coherent revisions, and final v18 canonical URL+HTML ([native](native/wordpress-preview36-native-page-links.json), [route guard](wordpress-contract/preview36-native-436-route-repair-readonly.json), [picker](wordpress-contract/preview36-native-436-page-picker-final-readonly.json)).

Newly accepted bounded journeys include the b10 review-label fix, owner review actions, Code/Table finite matrices, staging RichText/inline fixes, Preview40 mobile/library behavior, CMS scalar authoring, and controlled Preview40 External HTTPS POST/GET echo receipts. The GET test restored the exact saved POST action/method afterward; provider/email fulfillment remains unproven. The reviewed [zero/false capture](native/staging-cms-zero-false-readable.jpg) is readable. The 14 protected fixtures remain exact after separate disposable post 479 save/reload/publish; post 479 is outside protected14 ([guard](wordpress-contract/preview40-post-479-protected14-readonly.json)). Ordinary Gutenberg blank iframe remains an unproven compatibility limitation with no Pagecraft cause confirmed.

c411 closed the original source-binding collision and repeated-selection defect in bounded native scope. On 6cfa, the two narrower follow-ups also pass: the exact source-change Undo sequence reconciles the selected visible copy and inspector context, and 21/21 typed-filter cases pass across Boolean, Number, Date, Options, and Reference controls ([Undo](native/staging-6cfa-source-undo-context-fixed.json), [typed filters](native/staging-6cfa-typed-filter-acceptance.json)). Only `SIL` and final Boolean `No` were individually reloaded; do not extend persistence to all 21 cases. The 414px canvas has a 399px client width and no horizontal overflow ([desktop](native/staging-6cfa-boolean-no-readable.jpg), [mobile](native/staging-6cfa-boolean-no-mobile-readable.jpg)).

The earlier 22/24 scalar matrix remains historical evidence of the pre-fix defect; the current typed matrix is 21/21. The 26-entry/seven-field CMS fixture remains bounded authoring evidence, not exhaustive readback or public acceptance ([authoring](native/staging-cms-scalar-matrix.json)). Public Collection routes and remaining Style/Advanced/layout combinations stay open.

One operational finding is open. During the typed-filter run the editor reported a lost host connection. The draft stayed in the tab, a valid 260,852-byte JSON backup was downloaded with mode `0600`, Try saving again succeeded, and `SIL` survived reload ([report](native/staging-6cfa-save-interruption.json)). Source tracing shows this warning is raised by the save failure/readback path, not an editor heartbeat. The cause remains unconfirmed; a separate read-only observation of three PUT 200 responses does not prove what happened to the failed request.

Two native UX defects are also open. The no-alt Site checks finding names Courtyard but **Show me** selects Community Garden ([before](native/staging-6cfa-site-check-item-target-before.json)). Accordion content/runtime passes 17/17, yet after a question edit and blur the visible edit-row and context label retain the old question ([matrix](native/staging-6cfa-accordion-content-matrix.json), [before](native/staging-6cfa-accordion-label-before.json)). Ten Accordion module Style checks are before-reload observations only; persistence and common Advanced remain untested. Both fixes are local, uncommitted candidates with no staging acceptance.

### Historical e300 snapshot (superseded)


Snapshot: main `e300251a0c4c1740579982c48fa93295dc455308` is pushed with CI/deploy pending; staging remains exact `d99b445cd9895ce7446220148b1a9ad89175af8b`, and production remains `cc026d65d275f16374eb356d0331cebb93430c85`. Preview34 WordPress `9c8c0f6ff8cd52ae3aa72ad7420bd57b08d8ad5d` is installed on Local QA with green CI and exact d99; Preview35 awaits the final main result and WordPress CI. The e300 source passes 2,275 tests with 5 skipped, 30/30 gallery behavior checks, and 24/24 exact baseline comparisons. Overall pass and full-customer completion remain false.

### Latest accepted bounded evidence

| Surface | Accepted evidence | Remaining boundary |
|---|---|---|
| Main/staging | e300 pushed; CI/deploy pending. d99 CI `38934875036` and deploy `38934875058` remain green with exact staging readback | Production remains cc026; broader hosted/public health and promotion remain open. |
| Preview34 package | WP commit `9c8c0f6`; CI `38935158254` green; installed Local QA; protected state unchanged | Preview35 awaits final e300 main and WP CI. No release or production claim. |
| Compact toolbar | Cloud 390 live-link/History/focus/bounds pass; WordPress 600/390 History/Checks/Help, settled focus, clean Save, and no overflow pass | The e300 explicit focus bridge is defensive and not yet deployed or included in Preview34. The old compact aggregate false flag is retained as an early animation read; [settled evidence](native/wordpress-preview34-help-focus-before.json) records `bugConfirmed:false`. |
| WordPress restores | Page 420 passes native reload plus 14/14 DB checks; draft global 430 passes native reload plus 22/22 checks; legacy global 141 shows a warning and zero Restore buttons | Broader WordPress publication/recovery journeys remain open. |
| Final source gallery | 30/30 behavior and 24/24 byte/pixel exact to reviewed baseline; manifest verifies 24 images / 28 source files | Source and manifest are committed in e300; CI/deploy remain pending. |
| Button class deletion | Staging delete/Undo/Redo/save/reload/preview preserves 42px padding, 3px border, `#224466`, and white text | Imported shorthand collision is automated-only; broader shared-style surfaces remain open. |
| Cloud Collection query/condition | Five-item composed query, Photo empty/nonempty, pagination, conditional Image, reload, and original restoration pass; reviewed visual proof shows five cards/one Image and restoration shows two cards/two Images | Larger datasets, other field types, and Cloud/public breadth remain open. WordPress dynamic fields are separate. |
| Form/review | Recorded Cloud/local native Form recovery and owner-review acceptance retained | WordPress supports External HTTPS only (`managedForms=false`); external delivery and staging/release scope remain open. |
| Dependency audit | One dev-only Braces advisory chain; production-only audit 0 | Monitor upstream or perform reviewed narrow remediation; do not call fixed. |

### Historical e300 classification

The previous Preview31 History visibility defect and duplicate-v13 restore risk are fixed in the accepted d99/Preview34 scopes. The initial Preview34 Help-focus concern was not a confirmed defect: it sampled focus before the close animation settled. The e300 source keeps explicit recovery to the visible More tools button as defensive regression hardening; it passes Escape, Close dialog, and Got it, but is not yet deployed.

### Newly accepted bounded direct-control evidence

These rows supersede the older baseline-module queue for the named controls only. They do not imply blanket module passes, shared-style coverage, structural-operation coverage, or full customer acceptance.

| Module | Direct native coverage | Evidence and remaining boundary |
|---|---|---|
| Section | Content width, Min height, HTML tag | [roundtrip](native/staging-section-controls-roundtrip.json); two widths, seven tags, native min-height, reload readback. |
| Row | Gap, Vertical align, Distribution, Wrap, Columns | [roundtrip](native/staging-row-controls-roundtrip.json); all five alignment options, five distribution options, both wrap modes, columns 1–6, reload readback. |
| Column | Width/share, Min basis, Vertical align, Horizontal align, Gap | [roundtrip](native/staging-column-controls-roundtrip.json); direct values and reload readback. |
| Heading | Content five controls; Advanced Position, Top, Max width | [roundtrip](native/staging-heading-controls-roundtrip.json); nine styles, eight tags, three alignments, five links, Position choices, Top `12px`, Max width `300px`, reload readback. |
| Image | All eight Content and six Style controls | [roundtrip](native/staging-image-controls-roundtrip.json); lazy preview `loading="lazy"`, eager `null`, phone link commit correct. The fixed linked decorative Image now has an explicit label and the native site-check finding is gone ([fixed](native/staging-decorative-image-link-fixed.json)). |
| Box | Gap plus existing direct Box controls | [Gap roundtrip](native/staging-box-gap-roundtrip.json); `27px` survives reload. |

The bounded structural ledger for these six modules is now zero remaining/zero partial, with no overall percentage. Divider is separately accepted in the scoped report; broader classes below remain queued.

Source contracts, unit tests, DOM-only reports, and the historical 250-case source inventory do not promote a module to native feature pass. Retention, restoration, support, no-op, and error rows remain separate from primary test actions. `Code-1` stopping at app restart during input is an incomplete run, not a product failure. `Form` alignment/field layout/grid rows are retained as open where the actor could not safely run them; the manual grid report proves the rendered two-column result and restoration only.

## Historical highest-priority remaining native actions — superseded by the 532 current queue

Run native editor actions with edit → save → reload/reopen → rendered proof. Enumerate finite options; for free values use documented representative values plus boundary/reset. Keep Cloud, WordPress, runtime, and public evidence distinct.

| Priority | Module / surface | Remaining scope | Accepted boundary retained |
|---|---|---|---|
| P0 | Text / RichText | Remaining responsive override/reset and broader style/customer journey | RichText marks/blocks/link and a representative roundtrip are accepted; complete breakpoint/reset/inheritance breadth remains. |
| P0 | Cloud List / Collection | Fix and stage-accept structured Site checks item targeting; then continue larger datasets, Style/Advanced/layout, save/reopen breadth, and public Cloud journeys | 6cfa accepts the source-Undo follow-up and 21/21 typed-filter controls. The current no-alt **Show me** path selects Community Garden although the finding names Courtyard. Only `SIL` and final Boolean `No` have individual reload proof. |
| P0 | Navigation authoring | WordPress sync/public route and remaining responsive/style matrix | Nested item, href/target/rel, reorder, add/remove, fullscreen and collapse reload are accepted. |
| P1 | Typography breadth beyond Size | Weight, line height, letter spacing, family, transform, shared styles, and wider public journeys | Five-module Desktop/Tablet/Mobile Size matrix passes save/reload/reset/restoration. |
| P1 | Cloud save recovery | Instrument a recurrence to distinguish PUT failure, readback failure/mismatch, and online/offline transitions; continue hosted/public health | Recovery branches remain evidenced. The 6cfa interruption preserved the draft, produced a valid private backup, retried successfully, and survived reload, but its cause is unconfirmed and is not an editor-heartbeat failure. |
| P0 | WordPress External HTTPS form | Provider/email fulfillment and failure handling beyond the controlled echo receiver; managed mode is unavailable by contract | Preview40 native POST and GET both reached controlled HTTP 200 echo receipts, and the exact POST action/method was restored after GET ([POST](native/wordpress-preview40-external-https-form.json), [GET](native/wordpress-preview40-external-get-form.json)). |
| P2 | Historical WP29 backup path | Stale-design-conflict backup receipt only, if still required | Preview30 package/view-only and exact-5ad CMS import backup remain accepted. |
| P1 | Quote / Spacer / Link block | Remaining responsive/style, boundary, keyboard/focus and public-route cases | Scoped native reports exist for each named module. |
| P1 | Structural editing | Nesting, keyboard shortcut paste, and deeper breadth | Multiselect labels/atomic Undo, component-property delete Undo/reload, context-menu copy/paste, and cut/paste are accepted. |
| P1 | Form completion | Provider/email fulfillment, external failure handling, and broader published combinations | Full editor controls, published validation/receipt, Cloud/local request-ID recovery, and bounded WordPress Preview40 External HTTPS POST/GET echo receipts are accepted separately. |
| P1 | Baseline modules | Stage-accept the Accordion row/context-label refresh; then complete remaining direct Content/Style controls outside the accepted six-module matrix and Divider | Accordion content/runtime passes 17/17, but its edited question labels remain stale. Ten module Style checks are pre-reload only; persistence and common Advanced remain untested. |
| P2 | Shared styles | Imported shorthand collision, automatic compound hover+focus preservation, tokens, site CSS/fonts, global regions, spacing/background/border/effects/advanced | Button class deletion retains authored longhands through Undo/Redo/save/reload/preview on d99; shared-class and unsafe compound-deletion guards remain accepted. |
| P2 | CMS/WordPress | Broader import/export, reusable components, WP publication/recovery and frontend routes | Partial-reference import, page/global coherent restore, and legacy warning paths are accepted only in their recorded scopes. |
| P2 | Operational finalization | Investigate the save interruption if it recurs; assess the retained Preview42 Electron-host errors; then recheck hosted public health, cache, console/network, and production promotion | 6cfa CI/deploy are green and staging is exact. Preview42 passes 6/6 bounded native cases, with no clean-console claim. Preview41 was never installed; production remains cc026. |

## Evidence boundaries and reporting

- Report primary actions by module/tab/control/action/option; dedupe repeated actor rows mechanically.
- Report restoration/support/no-op/error separately from primary passes. A restoration proves recovery, not feature coverage.
- Keep `all-options`, representative setting, full roundtrip, runtime, and WordPress labels distinct. A runtime report does not prove inspector persistence; a Cloud staging report does not prove WordPress.
- Historical e300 gallery evidence remains **30/30** on behavior and **24/24 exact** against its reviewed baseline ([behavior](gallery/focus-final-behavior-checks.json), [comparison](gallery/focus-final/exact-comparison.json)). Current deployment status is the 6cfa checkpoint above; no overall percentage follows.
- Preview 16 original combined typography is accepted only as a scoped exact-43a WordPress roundtrip/public result. Its retired managed-mode save attempt is preserved as evidence of an unsupported capability; WordPress declares `managedForms=false`, and Preview25 External HTTPS saved markup is the correct capability proof.
- Live-review owner actions and Cloud/local managed Form request-ID recovery are accepted only for the recorded native journeys. WordPress page/global restore, compact-toolbar, and External HTTPS capability evidence are similarly bounded. Do not promote them into an overall Form, review, WordPress, staging, or release pass. Keep customer/staging, deployment, billing/account, provider, external-delivery, and public-endpoint status in their own lanes.

## Historical 9c checkpoint and remaining gates — 2026-10-16

- Main `9c263a62f9b77d27a28ebe2ab8b4ee6890b5146c` is pushed/deployed with exact `__deployment`; CI `38820308112` and deploy `38820307896` passed. WP29 exact source is installed/pinned from `c956c6dc906083e07af419a2d65432cf2541a494` with CI `38820762846` passed. Native WP29 CAS/concurrency is accepted with backup receipt unverified; native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance. Production remains unchanged at `cc026d65`.
- Clean verification is **2,238 passed / 5 skipped across 196 files / 2 skipped**; typecheck, build, and demo pass. No aggregate percentage is derived.
- Cloud save recovery now has native evidence for simulated HTTP 502, identical 409, real-writer conflict, and unavailable-readback recovery; the simulated 409 plus GET503 blocked overwrite and recovered the exact saved caption ([report](native/staging-unavailable-readback.json)). Final hosted/public health remains open after successful deploy `38820307896`.
- The linked decorative Image label fix is native-verified in staging; the prior site-check finding is gone after reload ([fixed](native/staging-decorative-image-link-fixed.json)).
- Shared-class roundtrip, RichText, Quote, Spacer, Collection, Navigation authoring, Link block, block lifecycle, exact-ea9 multiselect labels/atomic Undo, and component-property variants/delete Undo with ea9 reload now have scoped native evidence. Keyboard shortcut paste, broader responsive, WordPress-sync, and customer-flow coverage remain open.
- Published staging form validation and receipt are native-verified: empty required and invalid email rejected, valid thanks reached, inbox entry and CSV message matched. The f8 path also completes the actual OS CSV download with exact-message matching; the earlier top-tab timeout is historical and its cause is unproven.
- WordPress Preview23 media/Details remain accepted. Preview25 endpoint-only markup and mobile menu Escape/focus/route are accepted with no submission. WP27/28 remain historical scoped evidence; WP29 exact source is installed/pinned, with native CAS/concurrency accepted and backup receipt unverified; native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance.
- Shared-style fixes have scoped native evidence for hover/focus extraction and class-delete blue/Undo/Redo behavior; the 6a unsafe compound-state deletion guard blocks unsupported mutation ([fixes](native/staging-shared-style-fixes.json), [guard](native/staging-compound-class-delete-guard.json)). Automatic hover+focus preservation, final reload, and Button specificity/shorthand remain open. Exact-ea9 multiselect labels/atomic Undo and component properties variants/delete Undo with ea9 reload are accepted; keyboard shortcut paste and deeper structural breadth remain open ([multiselect](native/staging-multiselect-history-fixed.json), [properties](native/staging-component-properties-variants.json), [limit](native/staging-keyboard-paste-control-limit.json)).
- Library Keep mine/Theirs conflict handling, explicit Undo/Redo, and reload readback pass ([final](native/staging-library-anchor-fixed.json), [reload](native/staging-library-anchor-reload-fixed.jpg)).
- Motion and Divider are accepted as scoped native evidence from the `722af3b` reports ([motion](native/staging-motion-all-options.json), [Divider](native/staging-divider-fixed.json)); no new 6e native acceptance is inferred, and the old Divider failure remains preserved as historical evidence.
- The f8 native CSV export now has actual OS download completion and exact-message proof ([CSV](native/staging-native-csv-after-f8a5d05.json)); the old top-tab timeout is historical and its original cause is unproven.
- WP Preview23 media/Details remain accepted. Preview25 endpoint-only saved markup and mobile menu Escape/focus/route are accepted with no submission. WP27/28 remain historical scoped evidence. WP29 CAS/concurrency is accepted with backup receipt unverified; exact-ea9 first-click, multiselect, collection, component, and Cloud palette lifecycle/full-reload evidence remain accepted. Native CMS partial import was still open at that checkpoint and is now superseded by exact-5ad scoped acceptance.
- The shared-style report shows native hover/focus extraction and class-delete blue/Undo/Redo behavior; the 6a unsafe compound-state deletion guard is accepted, while automatic hover+focus preservation, reload, and Button specificity/shorthand remain open. Library Keep mine/Theirs conflict handling, explicit Undo/Redo, and reload readback are accepted. These remain scoped evidence, not closure of the broader source-integration lane.
- At that historical checkpoint, the first-click gallery was **24/24 image comparisons and 30/30 behavior** ([review](gallery/first-click-final/review.json)); changed pixels were 2 in `builder-actions-1440.png` and 1 in `builder-tables-768.png`, with no reviewed layout regression. The prior 22/24 form-integrity review remains historical.
- The prior form-integrity gallery remains historical at **22/24 image comparisons and 30/30 behavior checks**; the following first-click gallery was then **24/24 and 30/30**. The b117 stable repeat and right-surface-focus diagnosis remain historical. Current capture status is the final instrumented 0/24 A/B result recorded above.
- Full QA remains incomplete. Remaining gates include List/collection breadth, responsive typography, native CMS partial import, backup file receipt verification, keyboard shortcut paste/nesting, Form full-page POST fault proof, remaining WordPress/public delivery, Cloud/device inspection breadth, public routes/console/network health, account/session lifecycle, billing, and external-provider checks.

