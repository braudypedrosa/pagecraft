# Review target and inspector label fixes

Status: source/build verification complete; staging and WordPress native acceptance pending. Full customer QA remains incomplete.

Site checks and publication feedback now carry a structured page/scope/node/CMS-item path. Show me selects the affected repeated item, computes its current pagination, and rejects stale targets rather than selecting a different copy. Legacy findings retain their previous behavior. Accordion, Tabs, navigation and form row labels refresh after a committed label edit without interrupting typing or adding history steps.

Validation: two isolated exports of 6cfa3b plus the exact 15-file overlay built successfully; all 11 stable outputs match across exports. Original main working 11 generated files remain byte-exact. Built-in browser gallery: 30/30 behaviors, 24/24 visual comparisons. 23 PNGs are byte and RGBA exact; cloud-fields-1440 differs by 38 caret pixels. Root reviewed all four contact sheets and the differing capture. Canonical reviewed baselines recorded without threshold or fixture changes. Full isolated suite: 204 files passed, 2 skipped; 2325 tests passed, 5 skipped.

Evidence: review-target-build.json; gallery/review-target-final/capture.json; tests-review-target-final-20261017.log. Native before evidence: native/staging-6cfa-site-check-item-target-before.json and native/staging-6cfa-accordion-label-before.json.

New independent open finding: Hide on Desktop also hides Tablet and Mobile while their switches are off. Native before evidence: native/staging-6cfa-accordion-visibility-before.json. This visibility fix is not part of the current candidate. Save interruption recovery passed, but the original host-connection failure cause remains open. Production is unchanged.
