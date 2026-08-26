# Pagecraft portable packages v1

Pagecraft portable packages are deterministic, offline handoff archives. Import creates an
independent copy; a package is not a synchronization channel. The executable TypeScript
contract is in `app/src/package/types.ts`, with creation and strict validation in
`server/src/portable-packages.ts`.

## Formats

| Archive | Manifest format | Contents |
| --- | --- | --- |
| `.pagecraft-site.zip` | `pagecraft.site-package.v1` | One complete project, including global elements and every page |
| `.pagecraft-page.zip` | `pagecraft.page-package.v1` | One selected page plus the globals and design dependencies needed to edit and render it |

Both are ordinary ZIP files with deterministic UTF-8 path order, store-only compression, and
fixed timestamps. `manifest.json` is canonical JSON. Every other file is listed in the
manifest with its role, media type, byte count, and SHA-256 digest. `contentHash` is the
SHA-256 of the canonical file list. The SHA-256 of the finished ZIP is returned separately.

## Layout

```text
manifest.json
source/document.json
source/provenance.json
source/dependencies.json
compiled/*.html
compiled/robots.txt
compiled/sitemap.xml          when the project has a base URL
styles/*.css
previews/*.html
assets/*                      referenced assets only
```

`source/document.json` is the canonical editable Pagecraft document. `compiled/` is the exact
renderer output, `styles/` records the CSS emitted for each route, and `previews/` contains an
offline HTML preview for each route. The editable document remains authoritative after import;
compiled files are integrity evidence and safe frontend fallback material.

## Dependencies

The dependency record freezes:

- global header and footer node counts and hashes;
- the complete design-token hash;
- referenced font families;
- navigation items, targets, custom classes, owning node, and region;
- component and saved-block IDs;
- referenced asset IDs; and
- explicit CMS handling counts.

A page package retains the source project's header, footer, tokens, fonts, components, and
saved blocks. Importers can therefore resolve dependencies without contacting Pagecraft Cloud.
A later WordPress import may choose not to apply globals automatically, but it must not pretend
they were absent.

## CMS boundary

V1 does not flatten CMS values. Export rejects a document containing a collection, collection
list, detail template, field binding, or field-backed visibility condition. The error requires
the author to flatten the content explicitly first. Import independently recomputes the CMS
inventory from the migrated document, so changing the dependency record cannot hide CMS data.

## Producers

Pagecraft Cloud exposes authenticated downloads at:

- `GET /v1/sites/{siteId}/packages/site`
- `GET /v1/sites/{siteId}/packages/pages/{pageId}`

The shared creator also accepts `wordpress-local` provenance. The WordPress Builder exporter
must read the canonical document owned by the native page, supply its stable WordPress source
ID and revision/version, and emit the same page-package contract. No Pagecraft credential is
required for a local export, and exporting does not update Pagecraft Cloud.

## Import safety and limits

Import validates ZIP metadata before expansion and rejects encrypted entries, data descriptors,
ZIP64, multiple disks, archive comments, trailing data, symlinks, duplicate or case-colliding
paths, absolute paths, backslashes, traversal segments, invalid UTF-8, unsupported compression,
unlisted files, media-type/role mismatches, and any digest mismatch.

V1 limits are:

- 300 MiB archive;
- 5,000 files;
- 240 UTF-8 bytes per path;
- 100 MiB per expanded file;
- 500 MiB total expanded data;
- 2 MiB manifest; and
- 50 MiB canonical document.

An older supported document is migrated through the shared Pagecraft migration chain before
its dependencies are validated. A newer schema or renderer fails closed and requires an
upgrade.
