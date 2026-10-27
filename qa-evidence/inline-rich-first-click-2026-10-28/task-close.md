# Inline Rich edit first-click correction

28 October 2026, Asia/Manila. Pagecraft customer retest, non-production only. Partial delivery until host acceptance.

Changed inline Rich text stayed active after Tab. A pointerdown on the inspector ended the edit and repainted the control before its click, so the first dropdown action was lost. The correction preserves that action and reconciles inspector status after the control closes or focus leaves. Ordinary button reconciliation runs after Preact action propagation.

Source: builder.html, tests/component-rich-editing.test.tsx, tests/customer-editor-regressions.test.mjs. The last test change only updates its real-source extraction marker for the new exitEdit options parameter. No renderer/schema/business-document change.

Verification: native WordPress preview135 reproduced changed edit + Tab + first click closed, second click open. The same native path in the isolated corrected editor opens on first click; Escape reconciles status and a first-click native reset restores shared Rich text. See local-native-proof.json and local-first-click-open.png. Thirty shared gallery behaviors passed in the built-in browser. All24 candidate screenshots pass the existing comparison threshold; reviewed changed Cloud field capture has no layout change. Viewport/media overrides restored. Final full suite:2922 passed,5 skipped (289 files passed,2 skipped). Demo build and diff checks pass. Host delivery recorded separately after completion.

WordPress draft939 is independently saved at version2; variants, field and whole-breakpoint resets, history, keyboard independence and D1280/T768/M414 responsive output pass. Earlier protected pages and prior392uploads remain exact. See the Main component-variants-responsive-2026-10-28 evidence directory.

No production work. Full QA, broader coverage and production readiness remain open. Tracked time unknown; no billing submission.
