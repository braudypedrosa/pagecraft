# Manual form field name uniqueness

## Result

A field name changed through Form > Advanced now keeps its authored value when its resolved submission key is unique. If it collides, the changed field receives the first free `-2` suffix, matching the existing Duplicate action. A blur repair uses the existing repaint/save path before closing the same undo transaction, so an earlier typing autosave cannot leave the raw duplicate persisted. Focus-only blur and unique names do not add a repair save. Existing documents are not scanned or rewritten.

## Scope

- `app/src/ui/inspector/Lists.tsx`
- `tests/form-field-name-uniqueness.test.tsx`

Core, generated assets, baselines, Main, WordPress and runtimes were not changed.

## Verification

- Persistence RED: 1 expected failure among 5 tests because blur did not repaint the repaired key.
- Persistence GREEN: 17/17 across the form regression, list label lifecycle and inspector blur/click regression.
- TypeScript: `tsc --noEmit` passed.
- `git diff --check` passed.

The tests use real Inspector controls for typing, blur, keyboard Tab focus transfer, the first Style click, type changes, reordering and one undo. The persistence regression captures the save payload after typing, captures the repaired payload after blur, restores it and checks unique submission keys.

## Remaining gate

Root owns native Cloud and WordPress acceptance, integration, full-suite and generated build review.
