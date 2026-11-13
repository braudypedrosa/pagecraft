# Native progress overlay — release88 and Button

As of Main HEAD `33ed365303df0f7723de9e6c7c236f3865300145`, the following bounded evidence is accepted:

| Area | Accepted evidence | Limits |
|---|---|---|
| Motion release88 | Cloud + WordPress post-deploy task-close: invalid/valid timing values, reload at D/T/M, public attributes/computed output, history restore, cleanup | Motion slice only; broader QA remains open |
| Button B01 | Shared/direct typography and surface scope, cancel/confirm, unrelated Body negative control | No instance/WP/responsive/link acceptance in B01 |
| Button B02 | Shared responsive values at Desktop/Tablet/Mobile, no overflow | Representative values only |
| Button B03 | Local responsive clear/reset for recorded fields | Other local controls remain unverified |
| Button B04 | Detach/shared Update with Undo/Redo and D/T/M save/reload | Does not cover all history/selection paths |
| Button B05 | Four variants × four icons in Mobile editor DOM | No all-device/state matrix claim |

The release88 slice is accepted; this overlay does not claim full customer QA completion. Remaining Button gaps are listed in `continuation-coverage.md`.

## Button B06–B12 and List finding

B06–B13 add bounded evidence for alignment, long-label wrapping, link metadata plus an authored internal anchor, Column position, keyboard focus, two-instance component typography, and settled actual pointer hover. B13 used ordinary CDP mouse movement, recorded `hover:true`/`focus:false`, no console errors, and the authored settled `#445566` background. B06 editor Right overflow is selection-HUD-only and disappears in public Preview. Generated IDs target existing elements but lack picker labels; authored IDs work. Other responsive/variant/host pointer combinations remain open.

Button evidence remains representative. Full Button controls, states, links, conditions, Motion, and cross-feature coverage remain open.

A new current88 List NoWrap finding is recorded at `qa-evidence/list-nowrap-2026-10-22/before-native.json` and `before-mobile.png`: Desktop/Tablet page overflow is visible under NoWrap and Mobile page scroll exceeds the client width. This is an open finding pending the isolated worker fix, not accepted coverage.
