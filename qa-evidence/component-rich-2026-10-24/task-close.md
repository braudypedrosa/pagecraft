# Component rich property editing

- Date: 2026-10-24, Asia/Manila.
- Status: locally verified, awaiting root native acceptance and integration.
- Base: Cloud 0e24996e4d58f72dfcf9316b0e7c1f185485f166.
- Scope: Controls forwards the rich property key; typed legacy signature accepts it; RTE resolves a bound definition leaf inside the selected instance and retains the actual edit node while checkpointing/writing the instance. SVG unchanged.

## Verification

- Corrected-harness RED: two nested rich cases fail, ordinary/CMS case passes. Initial harness-only selector, contentEditable reflection and API shape errors are retained separately.
- Focused: 33 passed across four files. Typecheck exit 0.
- Final full npm test with two workers: 2803 passed, 5 existing skips; 274 files passed, 2 skipped. Includes official build-order check and typecheck.
- Two ordered builder then editor package pairs produce identical ten generated asset hashes. Final suite leaves them exact.
- Actual DOM regression mounts Inspector and clicks RichCtl, executes source RTE entry/input/exit, placeRT and linkPrompt. Tests view-only entry/exit, instance isolation, shared property leaves, variants/reset, one undo checkpoint, actual document restore, CMS inertness, ordinary editing, keyboard, sanitized output and imported punctuation IDs. Layout/persistence transport and browser execCommand are explicit unit harness stubs. These do not claim native browser acceptance.
- First full run failed only the gallery source fingerprint gate. Root approved exactly builder.html and Controls.tsx fingerprint updates based on independent unchanged static markup/style review. Other 28 sources, all 24 PNG bytes/dimensions, 30 behavior records and full capture provenance remain exact. No fresh gallery capture claimed.
- Core, runtime, schema and golden unchanged. Main protected 11 working artifacts and Git index unchanged.

## Handoff

Root owns native rich/toolbar acceptance, canonical integration, commit/deployment and later WordPress parity. No Main writes, database, browser, shared runtime, commit or push actions occurred. This is a bounded repair, not completion of full builder QA.
