# Mobile menu placement — focused implementation handoff

The body dropdown now opens above its toggle when it cannot fit below and more room exists above. Actual header bounds still anchor normal header menus. The runtime measures after opening the manual popover while temporarily hidden, sets viewport top/max-height, resets fresh-open scroll, and recomputes on resize/window scroll. Fullscreen behavior and existing close/reparent/focus restoration remain unchanged. CSS only changes dropdown max-height to accept the runtime's chosen available height.

Owned source: NAV_JS and one mobile-menu CSS rule in `app/src/core/index.ts`. New test: `tests/mobile-menu-placement.test.mjs`. Existing insertion changes in the shared candidate are preserved.

RED: 8 failures and2 passes. Focused: 5 files/72 tests pass. Typecheck passes. Logs and hashes in `verification.json`. Tests exercise the exported runtime against mocked rectangles/open-state-dependent measurement, including near-bottom body, normal/transformed header, short/long content, compact viewport, resize/scroll, custom/follow content restoration, reopen and fullscreen lifecycle. Mocks do not prove rendered geometry.

No build yet: root source review is required first. Root owns final combined build/tests/native/gallery. Native acceptance must show actual readable links and pointer hits with header/body/custom/fullscreen/mobile variants. Dynamic custom content growth after open does not newly trigger placement until resize/window scroll. No source outside NAV_JS/the one CSS rule, no builder changes, no Main/WordPress/browser/baseline/commit/push actions by this worker.
