# History metadata recovery checkpoint

Cloud staging runtime acceptance: `b2c94c6d7417604a7faf7e7a97600c5dbb3293a2`. CI 39031378941 and deploy 39031378985 passed. Production app remains `cc026d65d275f16374eb356d0331cebb93430c85`. The shared database gateway changed from version 26 to 27; six deployed files were read back exactly, with only the history metadata SELECT changed. Authentication, settings, schema and revision rows were not changed by deployment.

The failing history path loaded all complete documents and context for a 773-revision site, causing a confirmed 321 MB memory failure / Edge 546. The retry CPU log returned 200 and is not conclusive proof of the second UI 500 cause. History now reads metadata; a selected revision still returns its complete immutable document.

Verification: 123 focused tests; 2,423 passed / 5 skipped full suite; TypeScript and Deno checks passed. Whole-file Deno formatting drift was retained rather than reformatted. One worker accidentally ran a focused Main test (one passed, 39 skipped); this invoked no build and protected generated 11 remained exact. Corrected red tests ran in an isolated archive.

Native after: four cases pass. A temporary attribution saved as version 780, fresh reload retained it, native Restore 779 created 781, and original Quote/CSS/IDs returned exactly. The list contains every versions 1..781; all 779 baseline versions remain. Zero CPU/memory resource errors were observed in the bounded post-deploy log window. Initial browser-control waits hit a 3-second selector deadline while the list was loading; subsequent native completion was verified. No latency target is asserted.

Evidence: `../native/staging-b2-history-acceptance.json`, `../native/staging-b2-history-final.jpg`, `shared-gateway-deployment.json`. Root viewed final proof. This accepts the named recovery defect only. Full customer QA remains open across the fifteen named broader areas.
