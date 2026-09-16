# Phase 4 CSV import

The first half of Phase 4's CSV scope: a validated mapping and create/update
preview, applied atomically as one document version and one Undo. Bulk
draft/include actions, saved views and snapshot scheduling remain unstarted.

## Import contract

A picked file opens a mapping step that guesses each column from its header
against field names and ids, never assigning one target twice. Reserved targets
are the entry ID, the URL slug and the draft flag; every other column maps to a
field or is skipped.

A mapped ID column matching an existing entry updates it. An unmatched ID
creates, because a CSV from another system carries its own identifiers and is a
legitimate source of new entries. Two rows claiming the same existing entry is
an error rather than last-write-wins, so the outcome never depends on row order.
Blank rows are skipped instead of creating empty entries.

Nothing is applied unless the whole file is applicable. `planImport` builds the
finished collection first and validates it as a whole, so a slug collision
between two rows of the same file appears in the preview rather than at save
time, and both conflicting lines are named rather than the planner picking one.
`plan.collections` is null whenever anything is wrong, so a caller cannot
half-apply a bad file.

Applying is a single `cmsCommit`, and `edit()` pushes one history snapshot per
call, so an import of any size is one document version and one Undo.

## Placement

`app/src/core/cms-import.ts` imports only types and the shared entry validator
and takes `uid`/`slugify` as options, staying as portable as
`cms-validation.ts` beside it and testable without booting an editor. The
workspace owns the file picking, mapping controls, preview and commit.

Imported entries land in the site draft. Publishing remains separate.

## Validation

- `tests/cms-import.test.ts` covers the parser (quoted commas and newlines,
  escaped quotes, CRLF, BOM, empty cells, trailing newline), mapping
  suggestions, create/update routing, blank-row skipping, intra-file and
  existing-entry slug collisions, duplicate ID rows, an explicit slug column,
  the draft column including an empty cell meaning "leave alone", refused
  mappings and files, and that planning mutates nothing until commit.
- `tests/cms-import-ui.test.tsx` covers the mapping step, a clean import as one
  undo step, ID-matched update in place, an invalid row blocking the import and
  naming its line, unmapping the last field column, and cancelling.
- Local acceptance against `tools/qa-ui.mjs` on the real editor: four columns
  auto-mapped; a quoted value containing a comma parsed intact; an invalid
  option blocked the import with `Line 4 — Broken row · Workshop category`;
  a clean file took the collection 27 → 29 with the draft notice; one Undo
  restored 27.
- Gallery baselines recaptured and compared 24/24 with no changed pixels.
  Private evidence: `qa-evidence/cms-import-2026-09-17/`.
- Staging app commit: `83e5556`, verified through `/__deployment`.
  Authenticated staging acceptance of the import flow is still outstanding.

## Rollback

Redeploy the previous staging Node release to hide the Import CSV control. The
module adds no schema, no route and no stored field, and imported entries are
ordinary entries, so nothing needs unwinding. Production promotion is separate.
