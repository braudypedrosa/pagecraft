# Linked decorative Image accessible name, ID-family revision

## Result

The caption fallback remains unchanged: a linked decorative Image keeps `alt=""`, uses an explicit Link label through `aria-label`, or falls back to its nonblank visible caption through `aria-labelledby`. With neither value, Site Checks keeps the existing error.

The public ID allocator now reserves `<image-root>-caption` as part of the widget family only when that caption fallback is actually emitted. A shared predicate drives both reservation and rendering. Nested component copies therefore move to stable placement IDs when a later authored anchor owns the legacy caption ID. Images with an explicit Link label do not reserve or emit an unused caption ID.

## Scope

- `app/src/core/index.ts`
- `tests/image-link-accessibility.test.tsx`
- Ten build-derived artifacts listed in `generated-id-family-current.sha256`

No Main, WordPress, PHP, database, browser or server process changed.

## Verification

- ID-family RED: 1 expected failure among 7 focused tests, 22 unique IDs from 23 emitted.
- Focused GREEN: 685/685 across Image link accessibility, public component IDs and Core.
- TypeScript: exit 0.
- Two ordered `npm run build` then `npm run build:editor-package` pairs: all four exits 0.
- Generated ten: every file exists; pair one, pair two and post-suite hashes match exactly.
- Full suite with two workers: 271 files passed, 2 skipped; 2785 tests passed, 5 skipped; exit 0.
- Build-order guard and `git diff --check`: pass.
- Official WordPress golden remained unchanged and passed in the full suite.

## Remaining gate

The earlier root native caption, explicit-label and reload proof predates this ID-allocation revision. Root owns final native recheck and integration. Root-owned server session 35166 on port 4950 was not touched.
