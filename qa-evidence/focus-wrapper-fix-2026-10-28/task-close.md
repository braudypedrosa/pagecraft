# Keyboard Focus styling on interactive wrappers

28 October 2026, Asia/Manila. Non-production Pagecraft customer retest. Delivery and host acceptance are recorded after deployment.

Native customer authoring confirmed that Focus styles on Tabs, Accordion, Form and Code wrappers did not activate when their tab buttons, summaries, fields or Copy button received visible keyboard focus. Hover was a positive control. The correction follows only each module's owned controls, preserves keyboard focus semantics and existing class/local specificity, and prevents focus in nested content from styling an unrelated ancestor.

Changed source: app/src/core/index.ts and two focused test files. Generated standalone index.html is included. No schema, authored-document or editor-chrome change. Shared gallery fingerprints remain valid because their sources are unchanged; actual affected public widgets are verified natively instead.

Focused related tests passed 693 cases. The first full run had two server-test timeouts; all35 tests in those files passed in isolation. A complete rerun with two workers and unchanged timeouts passed2930 tests with5 skipped. Demo and diff checks passed. No timeout threshold or product behavior was weakened.

Native isolated verification imported the actual four-module backup through the builder UI. All four colors activate on visible focus at Desktop/Tablet/Mobile, clear on blur, preserve a sibling's resting background, and distinguish Tabs pointer Hover from keyboard Focus. Standalone Form required a harmless invalid test destination to enable its fields; nothing was submitted. The local HTTP WordPress Code Copy button is intentionally hidden without the Clipboard API, so its native public focus case is blocked in that environment rather than counted as passed.

Root owns staging acceptance, matching WordPress137 package delivery and saved native verification. Full QA and production readiness remain open. No production work. Time unknown; no billing submission.
