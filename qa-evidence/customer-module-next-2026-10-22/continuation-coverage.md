# Continuation coverage checkpoint — Button and release88 Motion

Evidence was read at Main HEAD `33ed365303df0f7723de9e6c7c236f3865300145`. This is a bounded overlay for continuation planning. It does not promote the full customer QA catalog to complete.

## Release88 Motion acceptance

Main `qa-evidence/motion-validation-2026-10-22/post-deploy/task-close.md` records bounded Cloud development and WordPress preview acceptance for Motion Duration, Delay, and Easing. Covered evidence includes invalid Duration staying local with linked blur/Enter error, valid `.75s`/`1200ms`, negative delay, `steps(2,end)`, reload at Desktop/Tablet/Mobile, exact public attributes/computed duration, no captured errors, history restore, and WordPress save/reload/frontend output. CPU, viewport, and media cleanup receipts succeeded. The same receipt explicitly says broader QA remains open and no publication or production promotion occurred.

## Button native B01–B05

Source evidence: candidate88 `qa-evidence/button-native-2026-10-22/`.

- **B01 — mixed shared typography and surface scope:** Four buttons (Solid, Outline, Text link, Ghost) were used. Shared typography confirmation updated the source and peer while the explicit 26px peer override and unrelated Body-style negative control stayed scoped. Cancel left peers unchanged. This is bounded shared/direct-style proof; component-instance, WordPress, responsive, detach, and link acceptance were outside B01.
- **B02 — responsive shared values:** Desktop, Tablet, and Mobile reads after save/reload covered shared color/weight plus responsive sizes and no overflow for the four buttons. Mobile uses the named mobile color. This is representative responsive proof, not every Button control or state.
- **B03 — local clear/reset:** Clearing local overrides returned named Button responsive Tablet 18px/Mobile 16px and Mobile color `#663344`, while shared style values remained. The case is limited to the recorded local fields.
- **B04 — detach and history:** Detach Undo/Redo and shared-update Undo/Redo were exercised with save/reload at all three breakpoints. Detached peer retained its own 22/18/16px and weight 700; the shared source changed to weight 500; the explicit 26px override stayed 26px and followed shared weight. Unrelated Body style remained independent.
- **B05 — variant/icon matrix:** Solid, Outline, Ghost, and Text link × None, Arrow, Check, and Plus were checked in editor DOM on Mobile. Variant data attributes, SVG counts, visible text, radius, and retained authored surface were recorded. It does not cover all responsive/state combinations.

## Remaining Button gaps

Keep these unverified until exact native evidence exists: full direct Content/Style control inventory and arbitrary values; Desktop/Tablet variant-icon rendering; component-library instance behavior; link destination/target/rel and unsafe URL handling; keyboard/focus/hover states; Motion/Visibility/conditions; attributes/classes/custom CSS; per-control responsive clear/reset beyond B03; frontend/public and WordPress deployment parity; empty/long-label and overflow boundaries; and cross-feature combinations outside B01–B04.

Release88 Motion and these Button cases are accepted bounded slices. Full customer QA, every builder module/setting, and all cross-feature flows remain open.

## Button B06–B12 additions

- **B06 — alignment:** Editor alignment 12 cases (Left, Centre, Right, Fill × Desktop/Tablet/Mobile) recorded DOM flex alignment. Tablet/Mobile Right showed editor selection-HUD overflow; public Preview removed that HUD effect. Desktop/Tablet Fill and Mobile Right were saved; public Mobile Right retained `flex-end`. This is a confirmed public result with the editor-only overflow caveat.
- **B07 — long label:** A long Mobile Fill label wrapped to a 70.375px button with normal white-space and no public overflow. Taller neighbouring content and alternate positioning remain open.
- **B08/B09 — links and anchors:** Email, telephone, and external-new-tab metadata were inspected without activating external destinations. B09 supersedes the earlier internal-link-pending state: an Advanced-authored form ID `qa-contact-anchor` was selected from the native anchor menu and activated in public Preview. Generated default IDs still target existing elements but are not exposed as picker labels, an open UX issue; authored HTML IDs work.
- **B10 — Column position:** With a native Column `min-height:700px`, Default and In the normal flow left a 451.75px bottom gap; Push to column bottom moved the Button to a zero bottom gap with `margin-top:451.75px`. Temporary CSS was removed after capture.
- **B11 — keyboard focus:** Mobile focus colours survived reload; ArrowRight focused the Preview anchor with a visible 3px outline and no navigation. Hover colour was authored/reloaded but actual pointer hover remains open.
- **B12 — component typography:** A native Column component with two instances preserved shared Mobile size 19px, explicit 26px overrides, detached peer 16px, unrelated Body 15px, and local surfaces across Desktop/Tablet/Mobile reloads. This confirms the recorded two-instance component path only.

## New confirmed List finding

Candidate88 `qa-evidence/list-nowrap-2026-10-22/before-native.json` and `before-mobile.png` record a current List NoWrap issue before the isolated worker fix: Desktop/Tablet cards retain `flex: 100 1 280px` but page width exceeds the viewport (`1269/1200` and `823/775`); Mobile uses `flex: 100 1 100%`, `nowrap`, and page scroll 405 versus client 363. Treat this as an active bounded finding, not an accepted pass. The worker is implementing the isolated remediation; later proof must distinguish the new default/card policy from authored layouts.

- **B13 — actual pointer hover:** Built-in-browser CDP ordinary `mouseMoved` over the visible Button produced `hover:true`, `focus:false`, no console errors, and settled background `rgb(68, 85, 102)` (`#445566`) with the authored colour. The initial `rgb(69,85,102)` read was the documented 180ms transition near its endpoint; the settled read passed. Pointer moved out after capture. Other responsive/variant/host combinations remain open.
