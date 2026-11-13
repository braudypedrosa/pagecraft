# Task close — Gallery Focus state

Internal evidence record.

- Date and timezone: 2026-10-17, Asia/Manila
- Client / project: Braudy / Pagecraft
- Parent commit: `c336793cb0d9c3f41400204ea7f9ee017dd2999d`
- Status: Source-review ready; focused clean-archive red/green complete
- Authorized scope: `app/src/core/index.ts`, `app/src/ui/inspector/Inspector.tsx`, and `tests/gallery-focus-state.test.tsx`
- Delivery state: Local source only; combined full build/suite, golden and baseline review, native verification, commit, push, and deployment remain root-owned

## Work performed

- Routed Gallery node Focus styling through its keyboard-focused lightbox frame with `:has(.pagecraft-gallery-frame:focus-visible)`.
- Added the equivalent Gallery-only companion selector for reusable class Focus declarations while preserving the generic class `:focus-visible` rule. Zero-specificity `:where()` guards keep the companion at specificity 0,2, so a later per-node Hover or Focus rule still wins as before.
- Kept the Gallery root out of the tab order and avoided `:focus-within`, so pointer activation does not trigger the authored keyboard state.
- Removed Focus from the Inspector when lightbox links are unavailable. If Focus was current, only the UI state returns to Resting; authored node and class Focus styling remains stored for re-enabling.
- Added focused coverage for node, reusable class, responsive selectors, Inspector capability, authored-style preservation, and non-Gallery behavior.

## Verification

| Check | Scope | Result | Evidence |
|---|---|---|---|
| Final focused red | Parent plus exact final test | Expected 3/3 failures | `tests-gallery-focus-red-c336-20261017.log` |
| Final focused green | Parent plus exact three overlays | 3/3 passed | `tests-gallery-focus-green-c336-20261017.log` |
| Scoped diff check | Three owned files | Pass | `gallery-focus-build.json` |
| Main protected generated guard | Existing main working outputs | 11/11 exact | `gallery-focus-build.json` |

The final regression also asserts that the reusable Gallery Focus companion is emitted before a later per-node Hover rule using the same property. Root owns the native simultaneous keyboard-focus and pointer-hover proof.

The first red invocation stopped before collection because the archive lacked dependencies. Its log is preserved. During that setup, `npm ci --ignore-scripts` was mistakenly run in main and refreshed only `node_modules`; no main source, package metadata, build output, or protected generated file changed.

## Remaining work

- Root source review, then combined clean exports with the two spacing overlays and these three Focus overlays.
- Root full suite, determinism, golden and baseline review, and native keyboard-versus-pointer checks at desktop, tablet, and mobile widths.

## Client-facing summary

Gallery Focus styling now follows keyboard focus on an image link without adding a tab stop or reacting to pointer focus. The Inspector offers Focus only when the Gallery lightbox provides focusable links, while retaining authored styling for later re-enabling. Focused clean-archive tests pass; broader release verification remains pending.
