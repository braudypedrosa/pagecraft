# Customer remediation and release evidence

- Date: 2026-10-10, Asia/Manila
- Project: Pagecraft
- Status: confirmed-defect repair delivered to development; production acceptance remains partial.
- Scope: customer-style builder testing and autonomous fixes, using disposable test content. The test account remains Pro. No shared database was cleared.
- Source: /Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft, development
- Candidate: 8ac73d88e49392ebf0e3bf8c06ecd98e84c2bb68
- Staging review: https://staging.itspagecraft.com/edit/ef0523d5-c3f8-4df8-b73e-11d31e17eb76
- Original Fieldwork site preserved. No production code promotion.

## Repairs

The original audit's F01–F16 received implementations and targeted regression coverage: captioned/linked image sizing; empty-value unit selection; rich-text link insertion; button variants; responsive text-style inheritance; Form Grid; legacy nav parents; custom-menu link metadata; fullscreen menu focus/modal behavior; Box nowrap; slider inherited-label refresh; border edge ordering; row-heading contrast; breadcrumb metadata; animation timing; and animation clearing.

Additional repairs cover invalid colour feedback, opacity bounds, gradient picker handling, duplicate style controls, initial custom-menu insertion, CMS confirmation/discard flows, current-page restoration, and form identity during cut/move.

Continued customer testing added usable Collection insertion (an empty editable card and correct Add target), explicit/default-compatible Collection settings, and deliberate conflict recovery. Reload theirs now cancels pending stale writes and bypasses the unsaved guard only for that explicit recovery action.

Core repair commits: ca4fc42, 0078903, d50ee1c, 88bd550, 8ac73d8. Released premade-template versions and hashes remain unchanged.

## Verification

| Check | Environment | Result | Evidence |
| --- | --- | --- | --- |
| Build, TypeScript and automated suite | Local final candidate | 1,964 passed; 5 skipped | tests-release.log |
| Demo build and diff check | Local final candidate | Passed | demo-release.log |
| Gallery interaction checklist | Built-in browser, Cloud and Builder | 30/30 passed | gallery-behavior-checks.json |
| Final gallery rendering | Built-in browser, 1440px and 768px | 24/24 matched reviewed baselines | gallery-recovery/capture.json, gallery-recovery/diffs/results.json |
| Repaired modules and responsive behavior | Staging | 19 recorded focused checks, including editor/preview and selected reload paths | browser-checks.json |
| Collection insertion/defaults | Staging | Grid, CMS order, Every item and default Test=is displayed; Add Heading goes into initial card | staging-collection-defaults.png |
| CMS nine field types, save, discard/cancel, URL changes, bulk status, delete/Undo, schema delete/Undo | Isolated local fixture | Passed tested paths | local-workflows.json, cms-all-field-types.png |
| CMS CSV import | Isolated local fixture | Two fictional rows imported, field mapping preserved | local-cms-import-success.png |
| Publication preview, publish, public form and inbox | Isolated local fixture | Passed; submitted values reached inbox | local-publication-success.png, local-submission-inbox.png |
| Form move identity | Isolated local fixture | Cut/paste kept qa-ui-contact | local-form-move.json |
| Version restoration | Isolated local fixture | Restore created version 19 from 17; version 18 retained | local-history-restored.png, local-collection-checks.json |
| Collection binding, pagination and contains filter | Isolated local fixture | Card/title binding; 3 per page; next page changes; drafts excluded; contains 2. yields 2 and 12 | local-collection-checks.json, local-collection-filter.png |
| Two-tab stale save and recovery | Isolated local fixture, final candidate | Stale save blocked; Reload theirs loads winning heading without overwrite | local-save-recovery.json, local-conflict-recovered.png |
| Pro account | Staging | Confirmed Pro in account UI | staging-pro-account.png |

Browser actions used the built-in browser and normal customer controls. Read-only DOM/computed measurements supplemented screenshots. The local fixture authenticates one fictional owner and resets on restart; it cannot prove production persistence, role separation, or external delivery.

## Remaining release limits

This is not an exhaustive every-setting or production-ready claim. The historical 326-row coverage ledger and original audit are retained unchanged; the records here supersede repaired findings only where current evidence exists.

Still needed before broad production: separate staging/production databases; environment-appropriate auth/role/invitation checks; external billing, email and WordPress integrations; external video playback; export/import round-trip (the built-in download event timed out, so file delivery is unverified); stale publication/offline recovery; remaining combinations of reusable styles/components/libraries, routing, scheduling and module settings; nontechnical-user usability validation. Five automated checks remain skipped. Unit tests do not replace those journeys.

The current shared Supabase arrangement is documented in AGENTS.md. Clearing that shared database would not create an isolated test environment, so it was not used as a QA shortcut. No external invitations, charges or WordPress publication occurred.

## Time and handoff

Time total unknown; no billing entry prepared or submitted. Final staging deployment and fresh screenshot evidence are recorded separately in deployment.json and staging-final-checks.json. Restart with the coverage ledger in ../customer-acceptance-2026-10-10/coverage-status.json. QA content is identifiable and disposable; preserve Fieldwork and unrelated working-tree files.
