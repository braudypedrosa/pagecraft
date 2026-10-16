# Compact modal focus hardening

More tools delegates to toolbar actions that can be hidden at compact widths. Modal launches now explicitly return focus to the visible More tools trigger. Help exit paths cover Escape, close, and Got it; desktop handling is unchanged.

The initial native WordPress check sampled focus during the closing animation. A settled repeat returned More tools correctly, so this is defensive focus handling and regression coverage, not a confirmed native failure. The regression simulates a hidden source button receiving focus before its handler opens the dialog; it fails before the change and passes after it.

## Verification

- Focused usability suite: 22 passed; TypeScript passed.
- Native local final build at 390px: all three Help exits return More tools after the modal becomes hidden.
- Two independent builds: all 12 stable source/output targets byte-identical. Demo differences were generated node IDs only.
- Gallery: 30 native behavior checks passed; 24 fresh captures match the previous reviewed images exactly in bytes and decoded pixels. Source provenance was refreshed through the official recorder; 24-image/28-source validation passes.
- Final full suite: 2,275 passed / 5 skipped across 198 passing files / 2 skipped files. Staging deployment remains pending for this follow-up commit.

## Additional native acceptance

Cloud combined sort/filter/pagination, mixed empty/nonempty photo filtering, and repeated-image conditional visibility survived reload. Original collection settings were restored.

WordPress Preview 34 page and inactive global revision restores matched selected document, HTML, and compiled hashes. Earlier drafts remain recoverable; all existing revisions remain stored. Protected posts 274–279, 318, and 378, their 105 revisions and 2,316 metadata rows, site design, and stylesheet remained byte-identical. Legacy global 141 shows a truthful warning and offers no unverified restore target.

This record does not establish complete customer QA or production readiness. Production was not changed.
