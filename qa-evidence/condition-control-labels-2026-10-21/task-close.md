# Condition labels and all Site checks recovery routes — candidate82

Exact base: `609528eb25b65d42c7cb41ebfe4d7017cecd9f5a`. State: root native and reviewed gallery accepted; final full suite passes. Root integration remains separate.

## Final changes

Inspector adds explicit accessible names for Show only if, Condition and Value to compare. ReviewList exits Preview through the Legacy bridge before either structured-target or legacy nodeId navigation. ctx declares the bridge, builder wires the guarded toggle, and the test harness supplies it. The actual showReviewTarget and legacy publication fallback guards remain. Core, CSS, visible copy and component-owned condition behavior are unchanged.

## Rejected attempts preserved

The publication-only patch missed the real Site checks route. The structured-only correction still missed legacy ReviewList nodeId findings. Both were real remaining product failures despite green focused tests. Their native JSON and PNG files remain rejected: `native/rejected-site-check-handler.*` and `native/rejected-structured-only-recovery.*`. Earlier green logs remain historical. The final rendered ReviewList regression and actual native Icon finding flow cover the missed legacy path.

## Accepted evidence

Root verified the exact legacy Icon sequence: Preview → Site checks → Show me exits Preview, selects the correct editable Icon, and preserves its link. Repairing its accessible label clears the problem. Mobile and editor-mode repeats pass. Enhanced condition controls expose the three exact semantic names, support native interactions, and matching output survives reload at Desktop, Tablet and Mobile. See the native JSON and readable screenshots. No form submission was performed.

Root gallery: 30 behaviors pass, 24 captures have zero changed pixels. Root recorded the reviewed baseline; the baseline check passes 24 images and 28 source files. Cleanup is recorded in `gallery/root-cleanup.json`.

Final npm test with maxWorkers2: build-order and typecheck pass; 241 files and 2,578 tests pass, with 2 files and 5 tests skipped. Focused coverage: 5 files and 17 tests pass. All 11 generated artifacts are identical across two final builds; audit reports zero vulnerabilities, demo zero findings, and final diff check passes. Golden/public output references and packaged runtime are byte-identical to base.

All 25 original source/test/assets manifest entries remain unchanged. The reviewed baseline is frozen separately in `reviewed-baseline.sha256`; final hashes and check receipts are in `final-receipt.json`.

Trusted fixture remains `http://localhost:4974/edit/s1`, PID4852/session65587, preserved for root. Only4974 was restarted;4972 stayed preserved. Fictional in-memory data, no hidden injection. This build owner made no source edits, browser actions, Main/WordPress changes, baseline recording, commits or pushes. Exclude Demo drift, temporary harness and ignored compiler JS under existing policy. Broader customer QA remains open; this is no overall production-readiness claim.
