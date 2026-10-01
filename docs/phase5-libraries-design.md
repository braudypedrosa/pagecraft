# Phase 5 — libraries (design)

Status: design agreed 2026-09-26. Slice 1a (pure document logic) is in progress; nothing is shipped.

Roadmap contract: *recipients import, owners modify; upgrades never silently change other sites.
Keep local overrides and require resolution of definition conflicts.*

## Decisions (2026-09-26)

| Question | Decision |
| --- | --- |
| Contents | Components (props, variants, slots), saved blocks, and design tokens: colours, text styles, classes. No CMS schemas yet. |
| Sharing | Personal first: an owner's libraries work across the owner's own sites. Read-only sharing with invited people is slice 2. |
| Images | Copied into the library when a version is published, and copied into the receiving site on import. A version never depends on its source site. |
| Conflicts | Per item: keep mine or take theirs, with a preview. Instance content (text, chosen variant, slot content) is always kept. |

## Model

- **Library.** Account-owned, with a name.
- **Version.** An immutable, numbered bundle (`pagecraft.library.v1`). It holds the chosen items plus
  their dependency closure: nested components, classes, text styles and colours referenced as
  `var(--c-…)`, and images (`asset:` tokens). Every item carries a content hash of its normalised
  form. Node ids are stripped, because they are local CSS class names (`nodeClass`) and are always
  regenerated on import.
- **Link.** Imported items stay locally owned and editable. The site records where each came from
  in an additive, optional `meta.libraryLinks`. There is no SCHEMA bump; unknown `meta` keys
  survive older builds, per the `Collection.views` precedent:
  `{libraryId, version, kind, sourceId, localId, sourceHash, localHash}`.
  - `sourceHash` is the item's hash in that library version.
  - `localHash` is the hash of the site's copy right after import. A later difference means the
    site changed it.

## Import (always explicit, per item)

1. Pick items from a library version. Their dependencies come with them.
2. Ids are kept when free. When a site already has the id for something else, the import renames
   (`card` → `card-2`) and remaps every reference in the imported items. Built-in token ids
   (`text`, `bg`, `brand`, …) are matched by id and never duplicated.
3. Images are copied server-side into the site as ordinary site assets, deduplicated by sha256. They
   count toward the site owner's storage. The document plan then rewrites `asset:` tokens through
   the returned id map.
4. Applied as one `edit()`, so it is one document version and one Undo.

## Upgrade (never automatic)

For each linked item, compare the new version with the link:

| Upstream (library) | Local (site) | Plan |
| --- | --- | --- |
| unchanged | any | nothing |
| changed | unchanged | take theirs |
| changed | changed | **conflict**: keep mine or take theirs (required) |
| removed | any | keep the local copy and unlink it; never delete site content |

- New dependencies of updated items are imported. Items new to the library are offered, not added.
- Taking theirs on a component replaces the definition (fresh node ids) and keeps every instance's
  `vals`, `variant`, host styling and slot children.
- The plan warns before apply when:
  - a chosen variant disappears (instances fall back to default)
  - a property disappears (its values are dropped)
  - a slot disappears (its children would be lost)
- The update is previewed, then applied atomically as one Undo. Links move to the new version.
  Nothing happens to any other site.

## Storage (slice 1b)

- **Tables.** Additive migration in the shared database, with RLS on and client grants revoked:
  - `libraries (id, owner_id, name, …)`
  - `library_versions (library_id, version, content jsonb, content_hash, created_by, created_at)`
    with the primary key `(library_id, version)`, insert-only
  - `library_assets (library_id, sha256, mime, bytes, storage_key)`, deduplicated across versions
- **Bytes.** Library image bytes go in the existing storage bucket under `libraries/<id>/`, and count
  toward the owner's allowance.
- **Gateway.** New additive operations. Deploy the function before the app.
- **Environments.** Libraries are account data, so like sites they are shared by staging and
  production.

## API and UI (slices 1b–1c)

- **API.**
  - `/api/libraries`: list and create.
  - `/api/libraries/:id/versions`: publish from a site's saved revision (owner of both).
  - `/api/libraries/:id/versions/:v`: read a bundle.
  - `/api/sites/:id/library-assets`: copy a version's images into a site and return the id map.
- **Editor** (`app/src/ui/Libraries.tsx`, shipped in 1c).
  - Components and Blocks rows: an "Add to library…" button, and a "From Brand kit · v3" line on
    linked items.
  - Add panel: a **Libraries** tab, shown only in the hosted editor to the site's owner. It has
    four views inside the panel, with no modal over the canvas:
    - **List:** your libraries, their latest version, "Update available" or "In this site".
    - **Library:** the latest version's chosen items, ticked to import, with "In this site · v2"
      or "Published from this site" on items that are already here.
    - **Publish:** this site's components, blocks and non-foundation styles. Items from the latest
      version are pre-ticked when it came from this site. The extraction runs in the editor first,
      so a CMS-bound or broken item is explained before anything is sent. The draft is flushed,
      then published against the acknowledged version; a 409 from an autosave in between is
      retried once.
    - **Update:** `previewLibraryUpdate` lists each change. Each conflict needs "Keep mine" or
      "Use the library's" before Apply. Warnings about removed variants, properties or slots
      show for whatever would be written.
  - Import and update copy only the images the plan needs (`importAssetsNeeded`,
    `previewLibraryUpdate().assets`), reload the site's images, then recompute the plan from the
    document as it is at that moment. They apply the new `meta` in one `edit()`, so each is one
    Undo step and autosaves like any other change.
- **Fingerprinted files.** The Add panel (`Add.tsx`, `Libraries.tsx`) is not fingerprinted.
  `builder.html` is, so the bridge entries and the panel's CSS went through the Chrome gallery
  capture.

## Slices

1. **1a:** pure document logic, fully tested. Bundle extraction with dependency closure and hashes,
   the import plan, and the upgrade plan with conflicts.
2. **1b:** storage, gateway operations, API and image copying.
3. **1c:** editor UI and acceptance on staging (shipped 2026-10-01).
4. **2:** read-only sharing: invite, list and import only. Only owners publish.
