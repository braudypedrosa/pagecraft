# Customer remediation — 2026-10-10

Implementation ready for staging. Test account verified Pro in the staging account UI. No shared database cleared.

Fixed the 16 audit findings plus invalid-colour feedback, opacity bounds, gradient picker state, duplicate controls, component-root insertion, CMS native confirmations, current-page persistence and cut/move form identity.

Local checks: 1957 tests passed, 5 skipped; TypeScript passed. Built-in browser: 30 shared gallery behavior checks passed; 24 screenshots captured. 22 matched prior baselines; reviewed two Builder menu popover differences (lower edge/padding, labels remain visible). CMS cancel retains draft, confirmed navigation opens preview, rich-text keyboard link with pointer-edited URL persists after reload. Golden WordPress artifact regenerated for intentional renderer output changes; released template versions/hashes unchanged.

Pending: exact staging SHA verification, fresh repaired module browser checks, remaining end-to-end workflows from customer-acceptance coverage ledger. Do not claim production-ready or exhaustive acceptance yet.
