# Code and Table padding controls — candidate83

Exact base: `89969665dd1ffff974820ec493dddcf30d33e3b6`. State: root final native and reviewed gallery accepted; final full suite passes. Root integration/release remains separate.

## Final changes

Code and Table padding controls display and preserve one-to-four CSS lengths rather than presenting multi-value defaults through a blank scalar input. Invalid, negative and overlong drafts stay unsaved; unitless zero remains allowed. Ordinary partial typing stays quiet. Blur or Enter shows an error linked to the input, and valid correction clears it. Blur forwards the actual event to existing writer completion logic. Table uses the same existing full-row Field layout as Code so the label and shorthand input remain readable.

The internal key is lengthList, compatible with the unchanged build scanner. Root added only Controls.tsx to gallery fingerprints and one bounded assertion so future changes require fresh visual review. Source files: Core definitions/types, Inspector Controls, and the gallery source contract. Tests: Inspector length-list behavior and gallery coverage.

## Accepted evidence

Root accepted Desktop/Tablet/Mobile defaults against actual field and computed padding, keyboard multi-value edits/reload, quiet invalid typing, linked error on commit, valid correction, blur-to-adjacent-unit-picker recovery, unsaved-invalid reload, mixed rem/%/px values, zero and responsive edit/reset/reload paths. Controls.tsx stayed unchanged through the final layout-only metadata follow-up. Root then accepted fresh Desktop/Mobile full-row Table screenshots and critical Code/Table roundtrips on final assets.

The final Table screenshot and JSON show explicitly authored10px12px matching input/computed padding; ordinary Text size remains numeric. This does not claim that clearing authored CSS fills the fallback into the field. See `native/final-layout-code-acceptance.json`, `native/final-layout-table-acceptance.json`, `native/final-table-padding-desktop.json` and the final Desktop/Mobile PNGs. No form submission was performed.

Root refreshed the gallery after the final layout build: 30 behaviors pass, 24 captures have zero changed pixels. The reviewed baseline check passes 24 images and 29 source files, including Controls. CPU1/viewport/media cleanup is recorded for tab36 in `gallery-final/cleanup.json`.

## Final checks

- Full npm test, maxWorkers2: build-order/typecheck pass; 242 files and 2,586 tests pass; 2 files and 5 tests skipped. No current failures.
- Final layout Inspector tests: 7 pass; broader length-list/UnitCtl validation selection: 22 pass.
- All 11 artifacts are byte-identical across two final layout builds. Final audit has zero vulnerabilities; demo has zero findings; final diff check passes.
- Golden WordPress fixture, historical public snapshot and packaged runtime are byte-identical to base. No output fixture updates.
- All 21 current frozen source/test/assets hashes still match after the final suite. Reviewed baseline is frozen separately; see `final-receipt.json` and `reviewed-baseline.sha256`.

## Historical failures and limits

Initial build rejected a hyphenated registry key; root reviewed its internal rename without changing the scanner. The early green full suite lacked Controls fingerprint coverage and remains historical. Premature validation was rejected natively and corrected; its JSON/PNG and pre-validation manifest remain historical. Pre-layout functional manifest is also retained. These are distinct from final accepted evidence.

Trusted fixture remains `http://localhost:4976/edit/s1`, PID26265/session4856, preserved for root. Only4976 was restarted;4972/4974 native fixtures stayed untouched. This build owner made no source/browser/Main/WordPress/baseline recording/commit/push changes. Exclude Demo drift, temporary harness and ignored compiler JS under existing policy. Broader customer QA remains open; no overall production-readiness claim.
