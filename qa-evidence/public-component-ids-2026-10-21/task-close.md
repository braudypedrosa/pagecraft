# Task close — public nested component IDs

- Date: 2026-10-21, Asia/Manila.
- Project: Pagecraft customer QA.
- Exact base: `c084430dedeeda019f662afe13b640eea07963ac`.
- State: isolated candidate accepted by root native and reviewed gallery; final suite passed. Root integration pending.

## Policy and changes

The first emitted generated nested ID remains the canonical legacy anchor. Later generated collisions gain their stable enclosing placement path, avoiding reserved authored/non-nested IDs. Authored IDs, literal links, CSS classes and backend form IDs are unchanged. Authored duplicate IDs remain explicit author data and a known limitation.

The allocator reserves exact emitted widget families (nav menu/custom content, form fields/status, tab/panel pairs) together, so later authored anchors also protect relationship targets. Five additional RED failures confirmed the derived-ID gap before this fix. Managed nav links and active forms do not reserve absent suffixes.

A transient local allocation context serves each public render. The same renderer first reserves emitted fixed/authored IDs, then performs allocation in a second pure traversal. False conditions return before descendants and allocation; lazy DOM-ID/attribute resolution prevents empty omitted widgets from claiming anchors. Full-page header/body/footer and Preview regions share one context. Direct renderNode/renderList calls get fresh deterministic sessions. No allocator is global or stored in a document.

Source: `app/src/core/index.ts`, `app/src/core/types.ts`, `builder.html`. New tests: `tests/public-component-ids.test.ts`. Prior nested compatibility test now explicitly allows only intended generated ID changes, preserving all other markup and the first canonical ID names. The historical public fixture JSON is unchanged.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Compatibility scan | 136 local source/config/fixture files, 20 archives / 80 JSON entries; zero affected generated-anchor links | `compatibility-scan.json` |
| RED | four expected identity failures, one policy test pass | `logs/red.log` |
| Focused | 5 files / 50 tests pass | `logs/focused.log` |
| Full npm test before gallery | build-order/typecheck pass; 2,554 tests pass / 5 skip; sole expected builder gallery gate | `logs/full-pre-gallery.log` |
| Final full npm test | build-order/typecheck pass; 237 files / 2,555 tests pass, 2 files / 5 tests skipped | `logs/full-final.log` |
| Reviewed gallery | 30 behaviors pass; 24 captures / zero changed pixels; baseline24images/28sources pass | `gallery/`, `logs/baseline-final.log` |
| Final builds | 11 artifacts identical twice | `generated-build-1.sha256`, `generated-build-2.sha256` |
| Audit | zero vulnerabilities at every severity | `logs/audit.json` |
| Demo | zero findings | `logs/demo.log` |
| Diff check | pass | `logs/diff-check.log` |

Tests cover canonical/direct/authored identity, later explicit reservations and path fallback, omitted outer/empty widgets, first hidden collection item, three depths, nested/filled slots, repeated collections, exact-once nav/tab/form references, separate accordion groups, full-page/Preview batching, standalone compiler parity, CSS/data preservation and fresh render sessions.

## Handoff

Root accepted the builder-created nested repeated form, tabs, accordion and managed mobile-nav flow. The second form label focused its own field and values stayed independent; no form submission was performed. Second tabs Details click and ArrowRight selected Pricing while the first stayed on Overview; computed display/height established visibility. Accordion exclusive groups stayed independent. Mobile414 second nav opened its own uniquely targeted content and Escape closed it. Reload retained 50 unique IDs and all 20 references resolved exactly once. See `native/native-acceptance.json` and readable screenshots. Nav identity and expanded-state checks pass, but all three nav screenshots are insufficient as successful open-panel visual proof. Root subsequently confirmed an 80px menu clipped near the viewport bottom; see `native/mobile-menu-clipping-followup.json` and `native/repeated-mobile-nav-contact-readable.png`. Mobile-menu visual layout remains a separate open failure.

Fresh root gallery: 30 behaviors pass, 24 captures with zero changed pixels, reviewed baseline recorded by root. Final full suite passes. Automated gallery/slider relationships do not establish native interaction coverage for those widgets. Frozen source/test/assets hashes verified unchanged; final baseline receipt is `final-receipt.json`.

Separate open follow-up: selecting a slotless component and adding Tabs stores an invisible child. Native symptom is recorded in `native/hidden-add-tabs-followup.json` and PNG; independent pure Core reproduction confirms the slotless insertion diagnosis. This is outside the accepted public-ID fix.

Trusted mock remains `http://localhost:4970/edit/s1`, PID43878/session61415, preserved for root. No hidden test state injected.

No frozen79 source/assets, Main, browser, WordPress, baseline, commit or push changes. Exclude Demo drift, ignored compiler JS and temporary harness according to existing integration policy. Wider customer QA remains open. Time/billing: unknown; not prepared.
