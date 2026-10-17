# Independent responsive visibility

Source/build validation complete; native staging and WordPress acceptance pending. Full customer QA remains incomplete.

Native evidence showed Hide on Desktop also hid Tablet and Mobile with both switches off. The compiler now emits hidden/ghost rules in independent Desktop >=1025px, Tablet 768–1024px and Mobile <=767px bands. Normal responsive styles continue to inherit. Visible bands emit no display resets, preserving widget, class and component layout semantics.

Two isolated exports from 5da0daa plus four approved files built successfully and produced 11 byte-identical stable outputs. Original main working 11 remain exact. Built-in browser gallery: 30/30 behaviors; all 24 PNGs and decoded pixels exactly match the already reviewed baseline. Both canonical baseline gates passed without baseline changes.

Initial full suite failed one WordPress golden-vector assertion because the compiler intentionally changed visibility CSS. Root reviewed the canonical fixture update: ten changed leaves, three route CSS/source hashes plus manifest/envelope hashes and signatures. No content/schema/route/form/CMS changes. Canonical updater and persisted fixture check passed. Final full suite: 205 files passed, 2 skipped; 2330 tests passed, 5 skipped.

Evidence: visibility-build.json; gallery/visibility-final/capture.json; tests-visibility-final-reviewed-20261017.log; native/staging-6cfa-accordion-visibility-before.json. Pending: rendered breakpoint matrix and matching local WordPress package acceptance. Production unchanged.
