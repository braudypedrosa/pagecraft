# 26-slide controls integration contract

Candidate: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/slider-many-dots`

Destination: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`

Base commit: `95106068e3a5614f17b6d014f3b2b869a8fb594a`

This is a declarative review checklist only. It contains no integration script. Root owns the guarded integration procedure.

## Source payload

Only these candidate source, test, fixture, and evidence files belong to this change:

- `app/src/core/index.ts`
- `tests/slider-keyboard-runtime.test.ts`
- `tests/collection-public-large-dataset.test.ts`
- `server/tests/fixtures/wordpress-artifact-v1.json`
- `qa-evidence/slider-many-dots-2026-10-20/wordpress-golden-diagnostic.json`
- `qa-evidence/slider-many-dots-2026-10-20/verification.json`
- `qa-evidence/slider-many-dots-2026-10-20/integration-checklist.md`

The three pre-existing tracked source inputs in Main were reviewed at these exact pre-integration hashes:

- `app/src/core/index.ts`: `d30b7c781064c8873a3c8984c433ee8abb62a64aaec65af9b48cb7555c68ccdf`
- `tests/slider-keyboard-runtime.test.ts`: `e87032a70df441a6c236d3e37642f3fabdee8506652bc3c7012cbc38a435ead1`
- `server/tests/fixtures/wordpress-artifact-v1.json`: `64390a1a2ba0f226b276b376684cfc583823183a3940457b3a100a50a4483031`

## Preserve Main generated working files

Do not write, replace, remove, or regenerate any of these 11 Main working-tree files during integration:

- `dist/core.cjs`
- `dist/demo/index.html`
- `index.html`
- `packages/editor/dist/editor.html`
- `packages/editor/dist/runtime.js`
- `packages/editor/dist/compiler-worker.js`
- `packages/editor/dist/compiler.js`
- `packages/editor/dist/contract.json`
- `packages/editor/dist/templates.json`
- `packages/editor/dist/fixtures/page.pagecraft-page.zip`
- `packages/editor/dist/fixtures/site.pagecraft-site.zip`

Do not run builds or tests in Main. Candidate verification already ran in the isolated checkout.

## Correct generated index-only set

Root’s guarded index-only procedure may stage exactly these nine generated paths without changing their Main working-tree bytes:

- `dist/core.cjs`
- `dist/demo/index.html`
- `index.html`
- `packages/editor/dist/editor.html`
- `packages/editor/dist/runtime.js`
- `packages/editor/dist/contract.json`
- `packages/editor/dist/templates.json`
- `packages/editor/dist/fixtures/page.pagecraft-page.zip`
- `packages/editor/dist/fixtures/site.pagecraft-site.zip`

`packages/editor/dist/compiler-worker.js` and `packages/editor/dist/compiler.js` are excluded from the generated index-only set and must remain untouched and unstaged.

## Review checks

- Confirm Main remains at base commit `95106068e3a5614f17b6d014f3b2b869a8fb594a` before integration.
- Confirm the reviewed source hashes above still match before applying the source payload.
- Confirm all 11 generated Main working-tree hashes are unchanged after index-only staging.
- Confirm the staged source diff contains only the two slider CSS declarations, the 26-slide runtime regression, the approved 26-item collection publication regression, the reviewed 12-leaf golden update, and this evidence.
- Confirm the generated index contains the correct nine paths and excludes both compiler files.
- Do not commit, push, build, test, or deploy from this checklist.
