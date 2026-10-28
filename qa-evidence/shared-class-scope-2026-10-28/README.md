# Shared class scope wording

WordPress class labels now say “Across site” because the class is sitewide while the previous numeric badge counted only nodes in the current document. The tooltip and new-class note name the WordPress scope. Cloud keeps numeric counts. No styling, schema, or runtime behavior changes.

Validation: build passed; full Vitest suite passed 2,932 tests with 5 skipped. Focused tests cover host-specific badge, tooltip, available classes, dialog note, and class targeting. The compiled standalone editor was exercised through native import and inspector selection; its Cloud count remained 3 uses (see screenshot).

Gallery review is source-entry-only, not a fresh visual baseline. All 12 actual gallery outputs are byte-identical to the base commit, and all 24 existing PNGs and capture provenance remain unchanged. Only the Inspector source fingerprint changed. Actual WordPress rendering must be accepted after the matching local package is installed.
