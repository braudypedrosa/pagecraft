# Combined component insertion and mobile menu placement — candidate81

Exact base `ca2a2cf6338e4e824ea8a817b70b092ee089fb12`. State: root native and reviewed gallery accepted; final suite passes. Root integration pending. Source/tests/assets are frozen in the18-file `source-tests-assets.sha256` manifest.

Slotless component placements no longer accept hidden children: insertion redirects to a visible valid destination through Core and builder drop-target paths. Explicit component slots preserve insertion. The independent insertion worker owns that implementation and its tests; this worker preserved those changes.

Body dropdown menus now choose the larger available region when they cannot fit below their actual toggle. Normal header menus retain header anchoring. Opened popovers are measured while hidden, with chosen-space max-height, fresh-open scroll reset and resize/window-scroll repositioning. Fullscreen and existing keyboard/reparent/focus restoration behavior remain unchanged. This worker edited only NAV_JS/one CSS rule and placement tests.

## Checks

- Focused combined selection: 5 files /72 tests pass; typecheck pass.
- First full suite: 2,572 pass,5 skip; gallery gate plus stale WordPress golden output. Both failures retained in `logs/full-pre-gallery.log`.
- Root approved only golden fixture regeneration. Exact24-field review proves only the approved CSS/NAV runtime and derived hashes/occurrence markers/signatures changed; route content and all non-route entities/schema remain identical. Release-focused30/30 pass.
- Full after golden: 238 files /2,573 tests pass; 2 files /5 tests skipped. Sole expected builder gallery gate. Build-order/typecheck pass.
- Correct-order build pairs produce identical11 artifacts. Audit0 vulnerabilities, demo0 findings, diff check pass.
- Final full suite after reviewed baseline: 239 files /2,574 tests pass; 2 files /5 tests skipped. Build-order/typecheck pass.
- Root gallery: 30 behaviors pass,24 captures/zero changed pixels; reviewed baseline check24images/28sources passes.
- Historical public snapshot is unchanged.

## Root handoff

Fresh trusted fixture `http://localhost:4972/edit/s1`, PID74645/session73979, HTTP200. Port-only adaptation of the trusted4970 harness, fictional default data, no hidden state injection.4970 remains untouched with its native follow-up fixture.

Root accepted the actual builder sequence: selected slotless Section component→Add Tabs creates a visible adjacent section and fresh controls; Undo0Tabs/Redo1 and reload1. Follow-built body menu at414×668 now uses a321.56px panel above the trigger, with all three links visible and receiving actual point hits. Escape focus/overflow restoration, reopen Tab Work/scroll0 and Desktop-close passed. Header dropdown starts exactly below the225.98px header. Fullscreen fills414×668 and Close works. In the428px canvas, Contact keyboard focus scrolls into view within a202.02px panel (scrollHeight322,scrollTop60). See native JSON and readable screenshots.

The initial compact test pressed Tab from Contact, which correctly closed through focus-out; root rejected that attempt and repeated About→Tab→Contact successfully. No form submission was performed. Other library/pattern/paste/drag insertion routes and actual transformed-header layout remain automated/mocked coverage only.

Root gallery recovery provenance is retained: the first request used the origin instead of the full gallery route and timed out; kernel recovery explicitly reset CPU1/viewport/media. A missing adapter.clickAt caused14/15 Cloud checks in a second rejected attempt; corrected adapter then produced fresh Cloud15/15 and Builder15/15. These are harness failures, not product bugs. Final24 captures have zero changed pixels; root recorded --reviewed baseline, and final full suite passes.

All18 frozen source/test/assets entries remain unchanged. Final baseline/hash receipt is `final-receipt.json`. Dynamic content growth after open is not newly observed until resize/window scroll; very large headers may leave limited available space. Broader customer QA remains open; no overall production-ready claim.

All evidence paths and approved generated golden semantic diff are in `verification.json`. NAV/CSS intentionally change packaged runtime.js and portable ZIP fixtures; include those reviewed generated artifacts. Exclude Demo drift, temporary harness and ignored compiler JS under existing integration policy. No Main/WordPress/browser/baseline/commit/push work by this worker.
