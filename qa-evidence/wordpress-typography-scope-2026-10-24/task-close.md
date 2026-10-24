# WordPress typography update scope

Date: 24 October 2026, Asia/Manila. Product source fixed and locally verified. Native post-install acceptance pending.

A typography update in the original cafe Home editor reported eight local uses but also updated a distinct saved Story-page Button. The count understated sitewide scope. A one-local-use document could also skip confirmation while changing a sitewide text style.

WordPress now omits the document-local count and always asks whether to update typography across the site. Cloud behavior and counts are preserved. The existing native-page provider identifies host scope; no backend count fetch, Core change or new host seam is added.

Three regression checks failed before repair. Focused UI suites passed26 tests. Full bounded suite passed2858 with5skipped. A default-parallel run retained the known fixed700ms save-test timing failure, with2857passes/5skips. No assertions were weakened. Two ordered build/editor pairs match all10 generated files, matching the first build. Only editor HTML changes; Core, runtime, schema13, compiler and golden remain frozen. Only the approved Controls source fingerprint changed. Impeccable detector found no findings.

The original saved mixed Button flow is independently being audited in the sibling mixed-button-wordpress120-native evidence. Its native authored values and global design have been restored before changing the installed runtime. Full customer QA and production readiness remain open. No production deployment. Time and billing: unknown, not submitted.
