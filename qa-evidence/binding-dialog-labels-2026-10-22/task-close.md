# Binding dialog names and new List card defaults — candidate84

Exact base: `f70e9ad7f309a1dd33323907664009bfaa99b082`. State: root native and reviewed gallery accepted; final full suite passes. Root integration/release remains separate.

## Final changes

Binding selects have explicit escaped names composed from their element, type and content slot. Only duplicate descriptions add a row index. Visible copy, binding values and row mapping are unchanged. Root accepted actual enhanced names, four unique duplicate-row names, keyboard selection and values surviving all-three-device reload. Builder source is unchanged from that native proof; a fresh single-heading two-name case was also observed.

A newly palette-created empty List now seeds its repeatable Column with a 280px Desktop basis and 100% Mobile basis; Tablet inherits Desktop. This fixes the roughly 44px-wide cards seen with 18 bound items. Generic Columns, generic N(list), imported/authored Lists and existing Slider sizing policy are unchanged.

## Native and gallery acceptance

Root verified 18 bound heading cards after reload: Desktop at 1,200px gives 282px cards and 4 per row, Tablet at 775px gives 375.5px and 2, Mobile at 363px gives 100% and 1. None overflow the page. Limits 1, 2 and 4 each have separate saved JSON for all three devices after reload. The existing Min basis control accepts Desktop 320 and Tablet 200; clearing Tablet restores inherited 320, and Desktop was restored 280. Slider remains one slide wide, scrolls internally and does not overflow the page across all three breakpoints.

The original small-count aggregate timed out and was lost; it is explicitly rejected. Only the separately written count proofs are credited. The initial incomplete focused invocation used the wrong List test filename and is also excluded; the corrected three-file run includes all new tests.

Root viewed binding before/after and final Desktop/Mobile grid screenshots. Gallery: 30 behaviors pass, 24 captures have zero changed pixels. Root recorded the reviewed29-source baseline, and CPU1/viewport/media cleanup is recorded for tab 41.

## Final checks

Full npm test with maxWorkers=2 passes build-order/typecheck, 244 files and 2,591 tests; 2 files and 5 tests skip. No current failures. Focused combined coverage passes 30 tests across 3 files; related Core/render-safety coverage passes 668 across 2. All 11 artifacts are identical across two combined builds. Audit 0, demo 0 findings and final diff check pass. Golden/public snapshots and packaged runtime remain byte-identical to base; Core contains only the intended palette seed change. No output fixture updates.

All 22 current frozen source/test/assets entries remain unchanged after the full suite. Reviewed baseline is frozen separately. See `final-receipt.json`, `reviewed-baseline.sha256` and verification logs. The earlier binding-only manifest remains historical.

Trusted fixture remains `http://localhost:4978/edit/s1`, PID 49913/session 17780, preserved for root. Only 4978 restarted; 4976 and other native cases stayed preserved. This build owner made no source/browser/Main/WordPress/baseline recording/commit/push changes. Exclude Demo drift, temporary harness and ignored compiler JS under existing policy. No form submission. Broader QA remains open; no overall production-readiness claim.
