# Shared builder accordion — 11 October 2026

## Outcome
The Add panel categories now use the inspector's accordion header style: 43px header, 11px/14px padding, shared chevron, typography, border and focus treatment. Counts remain aligned at the trailing edge. Both Add and inspector use `Disclosure.tsx`; collapsed bodies remain mounted and inert. Categories toggle independently. Inspector group preferences retain their existing per-widget keys.

The internal Builder Actions gallery includes collapsed Layout with count and expanded Motion examples, using the production styles and accessible state contract.

## Verification
- Focused checks: 103 passed.
- Full build/typecheck/test suite: 1,968 passed, 5 skipped.
- Demo build passed.
- Built-in browser: Enter/Space, independent categories, matching 43px header geometry, collapsed inert state, desktop and 768px tablet drawer checked. No horizontal overflow.
- Gallery checklist: 30/30 passed in built-in browser, both hosts.
- 24 visual baselines captured and reviewed: 22 unchanged; the two Builder Actions images changed to include the new specimen. Both reviewed at 1440px and 768px.
- Impeccable detector: no new component findings. Existing builder height/padding transitions and boot progress loop flagged; retained incumbent behavior for this scoped consistency change.

## Delivery
Staging deployment and acceptance pending. Production has not been promoted. No site content, database records, account entitlements or released templates changed.

## Review
- Staging builder: https://staging.itspagecraft.com/edit/ef0523d5-c3f8-4df8-b73e-11d31e17eb76
- Components: https://staging.itspagecraft.com/internal/components?host=builder&section=actions
- Evidence: this directory, including local-tablet.png and gallery/.
