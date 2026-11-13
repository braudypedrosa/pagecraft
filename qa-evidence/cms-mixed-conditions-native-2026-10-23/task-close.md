# CMS mixed conditions and pagination, native QA slice107

## Outcome

Cloud development commit `9595855d62bc83302c19d608a16b402c450a0117` fixes stale Collection List preview pagination after result-shaping control or source changes. CMS entry and schema forms now show Done when pristine or saved, and Cancel while dirty. Production was not promoted. Full customer QA remains open.

The native reproduction visited page3 of a five-entry list, then filtered Category to exclude Accessibility. Before the fix, preview clamped to page2 and showed only Epsilon. After deployment, the same real builder flow starts at page1 and shows Beta and Delta. Clearing a filter from page2 likewise returns to page1 with Alpha and Beta.

## Verification

- Native Option, Number and empty-Date filters return the expected named entries in editor and preview.
- Conditions on Rich text inside a Box inside each repeated Column handle true, false, blank and populated fields correctly. Nonmatching editor content stays selectable; preview omits it. Comparison value1 survives reload. All21 repeated element IDs are unique.
- Both CMS forms pass pristine Done, dirty Cancel and asynchronous Saved plus Done behavior in the isolated builder and deployed staging.
- Shared-component behavior:30 passes. Visual gallery:24 states pass, with all24 repeat PNGs byte-identical to approved images.
- Final root suite:2740 passed,5 skipped. Initial unconstrained run had three PGlite timeouts; the complete two-worker rerun passed. Both logs are retained.
- Cloud test run39860379408 and deployment39860379385 succeeded. The built-in browser verified the exact deployment marker.
- WordPress preview102 is built from the same Cloud source, with deterministic packages, preserved historical archives, unchanged public runtime and PHP sources. Root WP7.1.3 checks and WordPress CI39864323014 pass.
- Installed WordPress native Save and editor/public reload persist Gallery gap25px. Native History restore43 returns it to desktop24px and mobile8px. Images load and there is no document overflow. Final preservation guard passes29 checks: Version45,418 revisions, original eight nodes and preview98 compiled artifacts exact. Two actual new revisions belong only to the authorized test page.

## Restoration and environment

Cloud native History1238 restoration was followed by a new native project JSON export. It matches the original backup byte-for-byte: SHA256 `0826a13f998d879b0fe66028f1b2e9fd7f5855e3cdf91c47c8bdd5fe98acd9b7`, all9 pages,4 collections, components, global content and metadata. Raw project backups remain private.

Local WordPress services were stopped, then started through the existing Local site controls without resetting data. A routine expiry required renewing the same QA account's two-hour session. The fresh baseline accounts for that one session change. The first plugin installation attempt stopped before replacement on cache-only SQL drift. Its complete evidence was preserved, the exact reviewed cache changes were included in a new private baseline, and the second installation kept SQL bytes identical. No database rollback was performed.

Temporary local test tabs64 and65 were closed, and both agent-owned local servers stopped. Viewport, media and CPU settings were explicitly reset. Active staging and WordPress review tabs are retained for ongoing QA.

## Limits and next work

This is a bounded slice, not a full production acceptance. CMS authoring is Cloud-only; the WordPress package has shared source parity but does not expose the Cloud CMS workspace. Arbitrary schema combinations, references, deleted providers, CMS-entry-driven pagination, dynamic component/library workflows, remaining state/motion combinations and other open inventory cases still require named evidence.
