# Phase 2 publication comparison and recovery

Owners prepare a saved, immutable review from Publish, inspect grouped changes and
paired page previews, then publish the reviewed version. Preparation does not change
the public site. New draft changes require a new review. Hosts without the optional
review capability retain their existing release flow.

## Snapshot and permission contract

Snapshots retain their source document in a private, checksum-verified source.json
beside the manifest, outside the served files directory. Materialized image, font
and page bytes remain frozen with the snapshot. Preview routes require site admin
permission, reject unknown files and prevent indexing/caching. Scripts run in an
opaque sandbox; forms and network writes are disabled. Managed resources are
embedded from retained snapshot bytes so image loading does not require cookies
inside an opaque frame. External URLs/custom integrations remain external and may
not work in the restricted comparison. Use the page selector to inspect routes.

Publication uses those materialized bytes rather than compiling the current draft.
Source version and owner permissions are checked again at commit. Memory and direct
Postgres stores now reject saves that raced publication; the existing Cloud
transaction already holds the site version lock. History restoration remains the
existing version-checked operation that creates a new draft, without publication.

## Comparison boundaries

Changes are grouped as pages, CMS, shared components/blocks, global regions, styles
and assets. Shared changes conservatively list every page as potentially affected;
this is impact coverage, not an exact rendered dependency analysis. Added/removed
pages display an absence message on the corresponding side. Older publications use
a retained revision when no pinned source exists; otherwise structured differences
are unavailable and the paired immutable page previews remain usable.

## Validation

- TypeScript and complete suite: 1,333 tests passed; 5 existing environment-dependent
  tests skipped. Demo build passed with no findings; 27 deployment tests passed.
- Tests cover private source retention/reload/integrity, immutable bytes, access
  rejection, stale versions, exact snapshot publication, history restore leaving
  publication unchanged, comparison groups and sandbox resource embedding.
- Built-in browser: paired preview image loading and compact layouts at 768, 1024
  and 1440px, plus the 767px boundary. Independent visual disposition: ship after
  the broken-image issue was fixed and replacement captures reviewed.
- All 24 shared gallery captures match the reviewed baseline. Both gallery hosts
  passed select Escape/value preservation and dialog Escape/focus restoration.
- Local QA draft restored and saved after the exercise. Private evidence lives in
  qa-evidence/phase2-publication-2026-09-13/. Staging acceptance is pending.

## Migration, compatibility and rollback

No database migration or document schema change is required. Existing publication
manifests without sourceHash remain readable. Retain new private source.json files
and snapshot assets across release rollback; do not remove them during code cleanup.
Rollback to the preceding staging release (71793fd) restores the prior Publish UI.
It does not revert a publication or draft; use the normal draft/history workflow.
Shared-editor changes require a separate WordPress compatibility handoff. No
WordPress release or production promotion is included.
