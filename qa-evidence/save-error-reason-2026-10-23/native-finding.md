# Changed invalid drafts can hide the next save error

Status: confirmed in local WordPress preview108. Repair and native acceptance are in progress. Full customer QA remains open.

## Reproduction

Environment: Pagecraft WordPress QA, authorized `pagecraftqa` administrator, page616. Shared editor source `de06424b28d74d035809156c604adeb008e069af`, WordPress source `f77bc63c7f413729d7d581c2fb27dbf3d3e0f3ca`.

1. Add an Embed through the native element library. Enter an iframe containing `srcdoc`, then save.
2. WordPress correctly rejects executable markup. The builder opens a detailed recovery dialog and retains the draft.
3. Close the dialog. Change the Embed through its HTML control to an iframe using an absolute HTTP URL. Save again.
4. WordPress correctly returns HTTP400 with `Pagecraft iframe embeds must use an absolute HTTPS URL.` The builder shows only `NOT SAVED` and a generic failure toast. The new correction is absent from the detailed dialog.
5. Change the source to an absolute HTTPS URL. Saving succeeds. Reloading and opening the native WordPress preview confirms the corrected iframe was persisted.

Expected: a changed rejected draft explains its current failure. Repeated saves of an unchanged invalid draft may remain deduplicated.

Impact: a nontechnical author following the first correction can encounter a different validation failure without being told what to change next. This is a save-recovery usability defect. The WordPress validation boundaries behaved correctly and must remain intact.

## Evidence and restoration

- Native controls and saved output: [control matrix](../button-nav-embed-native-next-2026-10-23/wordpress108-progress.json).
- First detailed rejection: [screenshot](../button-nav-embed-native-next-2026-10-23/wordpress108-save-rejection.png).
- WordPress preservation: [33-check guard](../button-nav-embed-native-next-2026-10-23/wordpress108-guard-task-close.md).
- Cloud restoration used native History1312 and native project backup export, matching the original SHA256 `0826a13f998d879b0fe66028f1b2e9fd7f5855e3cdf91c47c8bdd5fe98acd9b7`.
- WordPress restoration used native History72. Current page76 and478 total revisions contain the original eight nodes and98 compiled artifacts. The three test modules are absent from the public preview.

## Root cause and intended repair

`warnSaveFailed` remembers the first dialog through `saveWarned`. Closing it and editing the document did not clear that flag. A later failure could therefore update internal error state without reopening the detailed recovery dialog.

The candidate changes only the shared editor's dirty-save transition: a real mutation following a failed save re-arms the warning. Its regression exercises the real Embed inspector, fresh compiled output, two distinct rejected drafts, unchanged retry deduplication and a subsequent successful HTTPS save. No PHP validation, host seam, runtime or security policy change is intended.
