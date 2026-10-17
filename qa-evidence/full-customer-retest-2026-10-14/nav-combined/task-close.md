# Combined Navigation candidate verification

- Two fresh `d84e79da7444500283b549cdb457b2a635063cf1` archives contain exactly the six approved source and regression overlays.
- Both passed clean install, editor and demo builds, TypeScript, 46 Navigation-focused tests, all 37 built-editor boot tests, and the unchanged WordPress golden.
- Root local native acceptance passed all seven combined cases: Follow component Preview retains three links and keyboard Focus at desktop/tablet/mobile; managed common background stays transparent at desktop/tablet and paints `#ddeeff` on mobile; parent panel `#b7f34a` remains independent. Carried frozen-core evidence also covers ordinary Navigation D/T/M keyboard focus, pointer exclusion, managed page focus, and a real Custom form Send-button focus without submission. This is isolated local evidence, not staging acceptance.
- Root gallery review passed 30/30 behavior checks and 24/24 comparisons. Root viewed Builder Actions 768, Cloud Dialogs 1440, and the actual fixed mobile component. The initial Cloud-only adapter run lacked `tab.type` and `tab.clickAt` for two checks; the corrected 30-check rerun passed, confirming no product defect.
- Root recorded the reviewed 25-file baseline set in export ONE; it and all 28 capture-proof files were copied byte-exact to export TWO. TWO independently verifies 24 images and 28 source fingerprints.
- Export ONE final full suite is green: 217 files passed, 2 skipped; 2,414 tests passed, 5 skipped. The earlier expected `builder.html` baseline failure remains preserved as diagnostic evidence.
- All six sources remain frozen, all 11 generated outputs are deterministic across exports, main's protected 11 remain exact, and the WordPress golden remains `6188d0fd6628667b54b0e1495f55195e31e3c2cf405f0aadabace69f9353a8b4`.
- Pending: root staging acceptance and integration/package/commit/push. Gallery session `48052` remains live until root confirms its browser tab is closed.
