# Nav page destination provenance

## Outcome

Nav items now retain explicit Pagecraft page provenance. Deleting a known internal page keeps the authored href and anchor, marks the destination as missing, and lets the author recover by choosing another live page. Legacy rows are stamped only when their exact portable href resolves to the page being deleted. WordPress native objects, manual relative URLs, assets, and unrelated rows remain unchanged.

## Changed files

- `app/src/core/index.ts`
- `app/src/core/types.ts`
- `app/src/ui/inspector/Lists.tsx`
- `tests/nav-page-destination-provenance.test.tsx`
- `public/internal-ui-baselines/manifest.json` (approved `Lists.tsx` source fingerprint only)

## Verification

- RED: 3 failed, 1 passed before implementation.
- Focused final: 5 files, 744 tests passed.
- TypeScript: passed.
- Full final: 278 files passed, 2 skipped. 2,830 tests passed, 5 skipped.
- First full run preserved: 2,828 tests passed, 5 skipped; expected gallery fingerprint failure plus one unrelated analytics SIGTERM timing failure. The isolated analytics rerun passed 16 of 16.
- Gallery: all 12 generated HTML variants were byte-exact against `b45d98f`; root fresh capture matched all 24 reference PNGs with zero changed pixels. The 30 accepted behavior checks were reused from the byte-exact gallery output.
- Two final ordered `build` then `build:editor-package` pairs passed. All 10 generated artifacts exist and match byte-for-byte across both pairs.
- Runtime `76a0a68d...`, WordPress golden `53724e47...`, and editor contract `99e40f58...` remain unchanged.
- `git diff --check`: passed.

## Remaining gate

Root owns Main integration, deployment, and native Cloud and WordPress acceptance. No Main files, browser state, database, commit, push, or install were changed by this candidate.
