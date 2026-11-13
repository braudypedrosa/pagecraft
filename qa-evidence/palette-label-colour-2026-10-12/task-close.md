# Add panel label colour — 12 October 2026

“Recently used” used the lighter tertiary text token while “Find an element” used the secondary text token. Add group labels now share the search label's colour rule, so both resolve to rgb(75, 80, 75). Existing typography and spacing are preserved.

Validation: built-in-browser desktop and 768px tablet checks confirmed matching colours and no horizontal overflow. Gallery interaction checklist: 30/30 passed; all 24 screenshots match existing baselines. Full suite: 1,968 passed, 5 skipped; build, typecheck and demo build passed. No additional tests were introduced for this one-line visual correction. Detector reported only the existing builder motion patterns.

Staging deployment acceptance pending. Site content and account data were not changed.

Review: https://staging.itspagecraft.com/edit/ef0523d5-c3f8-4df8-b73e-11d31e17eb76
