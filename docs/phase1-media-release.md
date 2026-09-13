# Phase 1 media management release

The shared media browser now supports filename/tag search, name/date/size sorting,
used/unused filtering, usage details, flat tags, multi-select tagging, protected
bulk deletion, and reviewed Replace everywhere. Library insertion and field
selection retain their existing separate actions inside the same wide modal.

## Replacement contract

Cloud advertises `HostAssetAdapter.retainsHistory`. Only that capability enables
Replace everywhere. A replacement uploads new bytes, previews managed references,
and saves the reviewed document against its current server version before adopting
it as one Undo step. A changed local draft or rejected server version leaves the
local document and Undo untouched. Cancelled or failed replacements leave the new
asset available as unused media. Existing publications are unchanged until publish.

Managed references include pages, global regions, component definitions and
variants, saved blocks, CMS images, structured backgrounds, favicon and social
images. Opaque custom code and external URLs remain outside managed replacement.
Removed Cloud assets keep their bytes for retained revisions/publications and
continue counting toward storage.

## Bulk actions and recovery

Selection survives search/filter changes. Keyboard focus stays on the chosen card.
Bulk tags add to existing tags and use each asset's metadata version. A partial
failure preserves successful updates and reports the failure; reopen the library
before retrying stale metadata. Bulk deletion refuses the entire selection if any
asset is referenced, then opens its details. Failed removals remain selected for
retry. Successful removals refresh counts and unused-image controls.

## Validation record

- Focused tests cover version conflicts, changed preview sources, one-step Undo,
  unsupported hosts, selection across search, protected bulk deletion and retry.
- Local Cloud-backed acceptance exercised failed upload recovery, two-file upload,
  bulk tags, tag search, replacement preview/apply, one-step Undo/Redo and reload.
- All 24 shared gallery captures match the reviewed baseline. Private evidence:
  `qa-evidence/phase1-completion-2026-09-13/`.
- Final staging acceptance must confirm the deployed commit, actual image loading,
  768/1024/1440 layouts, the 767 editor boundary, and the same management workflow.
  The local storage emulator returns internal container URLs after reload, so its
  image painting is not treated as staging image-loading evidence.

## Compatibility, migration and rollback

No new migration is introduced by this release. The previously delivered
`20260912080103_media_metadata.sql` and `20260912091906_media_retention.sql` remain
required. Existing documents and assets stay readable. The new host capability is
optional; WordPress does not advertise it, so it does not expose replacement.
Shared-editor changes require the separate WordPress compatibility/release handoff;
this release does not publish a WordPress package.

Rollback by redeploying the previous staging release. Keep the additive metadata
and retention migrations; do not delete replacement bytes during rollback. Saved
replacement documents are ordinary compatible documents and may be restored
through history. Production promotion is a separate approval.
