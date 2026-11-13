# Collection List No wrap — bounded plan

Initial read-only investigation at Cloud source `33ed365`, 22 October 2026. The continuation checkpoint below records later implementation and native findings; the original diagnosis remains historical.

## Evidence and stored-value contract

The [native83 No-wrap reload record](../list-native-2026-10-22/l02-nowrap-reload.json) reports 18 items and computed `flex-wrap:nowrap` on all three devices. Desktop: width/scrollWidth1200/1200, no page overflow; Tablet786/792, no page overflow; Mobile374/395, **pageOverflow:true**. This is an unresolved failure, not a pass. The [fixture record](../list-native-2026-10-22/authored-card-basis-setup.json) says the existing template Column was manually given Desktop Min basis280px; it is not proof of the later factory-default change. [Coverage](../list-native-2026-10-22/coverage.json) pins the historical checkout to candidate83, `padding-list-controls-8996966`, and the original fixture to localhost4976.

There is **no `p.wrap` control**. [List Content](../../app/src/core/index.ts:539) stores Layout in `n.props.collectionLayout`, but Wrap is a responsive CSS control, `c:'flex-wrap'`, writing `n.css.d/t/m['flex-wrap']`. Factory List has Desktop `wrap`; inherited values follow the existing breakpoint cascade. The native record's `wrap` key is computed-style readback after reload, **not a raw document snapshot**. It proves persisted rendered No wrap, but does not establish which raw breakpoint bucket was authored. Capture that bucket through the actual Inspector/reload flow before implementing; do not invent a `props.wrap` migration.

## Diagnosis

The current “Grid” List is a flex row: base `.pagecraft-row,.pagecraft-list` uses `display:flex;flex-wrap:wrap;width:100%`. The selected per-node `flex-wrap` is reinforced in [bucket](../../app/src/core/index.ts:7720), so No wrap is honored. Ordinary Grid rendering has no local scroll containment or keyboard-scroll semantics. Columns have `min-width:0;flex-shrink:1`; with 18 cards they can shrink far below their nominal basis, leaving text/content overflow. The 21px Mobile excess is not evidence that 18 useful card widths are reachable.

Slider is a separate, already working path: it forces nowrap, `overflow-x:auto`, nonshrinking card bases and named/focusable scroll-track markup. [Native Slider](../list-native-2026-10-22/l02-slider-reload.json) reports no page overflow and local scroll widths (Mobile7072/client374). It must remain unchanged. [List basis tests](../../tests/list-default-card-basis.test.ts) assert seed280px/Mobile100% and Slider sizing; [Grid/Slider switching test](../../tests/collection-slider-controls.test.tsx) preserves responsive Wrap settings. Neither measures Grid No-wrap card reachability or page overflow in a browser.

## Recommended policy for root approval

Treat Grid No wrap as **one locally scrollable row**, not clipped or silently wrapped cards. Keep every card reachable by touch, trackpad and keyboard, without widening the page. Preserve existing bases, gap, sorting, bindings, pagination and explicit authored overflow/sizing. This is a justified usability defect, although fresh current-build reproduction is required before claiming the historical failure still occurs.

Smallest proposed implementation surface: Core List-only generated CSS plus its ordinary Grid root markup, with focused regressions. No shared Row/Column/Box rules, global body overflow clamp, Slider rewrite or stored-document migration.

- Apply low-priority containment/`overflow-x:auto` fallback only while the effective Grid Wrap is nowrap. Constrain the List's available width/minimum so a nested flex/grid parent cannot expand the page. An explicit authored overflow shorthand or axis value (node, class, breakpoint, state or custom CSS) must win; hidden/clip remains intentional and visible remains an explicit opt-out.
- Keep nowrap cards at useful existing basis widths: fallback nonshrinking items rather than forcing all 18 into one viewport. Preserve explicit authored child flex/shrink/width/min/max overrides. Do not import Slider percentages or snapping. This is an intentional layout-policy change; adding overflow alone may contain the page while leaving unreadably collapsed cards.
- Responsive Wrap must remove the fallback scrolling/nonshrinking policy at that breakpoint and narrower inherited scopes. Resolve CSS inheritance/class specificity correctly; do not emit a single global “nowrap” class from the currently selected device. Avoid `!important` that defeats author overflow choices.
- Provide a named, keyboard-focusable local scroll region for potentially overflowing nowrap output, including text-only cards. Preserve descendant Tab navigation and vertical page scrolling. Keep scrollbars or another existing affordance; no new carousel controls. Verify the extra focus-stop policy when Desktop wraps but Mobile does not.

## Acceptance before closing

1. Native current-build reproduction: manually author/bind18 cards, confirm actual raw wrap bucket and computed styles after save/reload; record page width, List client/scroll widths, each card width and first/last item identities.
2. At Desktop/Tablet/Mobile, inspect first/middle/last cards via local scroll, touch and keyboard; page itself must not scroll horizontally. Test long words/links, nested Column/Box and keyboard focus visibility. No global clipping workaround.
3. Exercise Desktop nowrap→Tablet wrap→Mobile nowrap, clear overrides, and Grid→Slider→Grid. Preserve the current Slider runtime and responsive settings. Compare editor, Preview, compiled/standalone and WordPress output.
4. Explicit overflow visible/hidden/clip/auto and x/y overrides, reusable classes, authored card shrink/basis, empty/one/many items, pagination and RTL must be tested. In RTL, avoid assuming positive `scrollLeft` reaches the end. Ensure menus/shadows/focus rings are not newly clipped vertically by the horizontal scroller.

Root decides this policy and native scope. Existing evidence is partial; no implementation or production-readiness claim.

## Continuation checkpoint — rejected candidates retained

Root reproduced current88 Mobile collapsed cards through native authoring, then rejected two local candidates rather than deploying them. The first fixed card widths but exposed heading ink overflow and Preview keyboard interception. The combined candidate fixes Preview keyboard ownership and passes Mobile geometry, actual first/middle/last arrow-key reachability, horizontal wheel input, RTL arrow input, Grid–Slider–Grid switching, responsive clear inheritance, and representative authored padding/overflow/max-width overrides. Saved/reloaded Desktop No-wrap nevertheless has clientHeight207/scrollHeight209 with 38px headings: its 4px fallback padding is insufficient. This is a confirmed remaining candidate defect, not accepted coverage.

The isolated follow-up raises only the low-priority No-wrap inset to8px while preserving authored padding and wrapped/Slider output. Fresh native Desktop and Mobile geometry, reviewed gallery capture, final full suite, guarded Main integration, Cloud staging acceptance and WordPress pin/acceptance remain required. No List or Preview fix has been deployed at this checkpoint.

Existing Button B01–B13 evidence is bounded local coverage. Physical touch devices, alternate engines, arbitrary type/shadow sizes, every reusable class/instance combination, and broader customer QA remain open.
