# Cloud CMS acceptance — 9 September 2026

## Review

- Editor: https://staging.itspagecraft.com/edit/a7ef8c3e-4ecf-4af5-a3e7-2fd615b29058
- Publication: https://staging.itspagecraft.com/stillwood-cms-qa/
- Generated detail: https://staging.itspagecraft.com/stillwood-cms-qa/cabins/the-a-frame

A dedicated QA account owns this pilot; the existing Braudy account has access. No account limits, existing sites or released Stillwood packages were changed. Production promotion remains separate. The database remains shared by prior agreement.

## Implementation

Typed Preact CMS workspace with collection navigation, search/status filtering, 25-entry pagination, explicit entry saves, cancellation, local form state, validation, failure recovery, unsaved-change protection, schema settings and deletion confirmations. All existing field types, media selection and rich-text formatting are supported. Entries begin as drafts; inclusion controls the next site publication.

Browser and server share validation. Content-role users can manage entries but cannot alter schemas/layout or publish. Saves use document versions and undo history. Existing slugs remain stable. Collection cards support native grids/sliders; binding choices are type-filtered and detail templates have an entry selector with draft labels.

The isolated pilot contains three Cabins, three Stay types, their reference relationship, collection placements and a detail template. Existing Stillwood assets/content were reused. Only the pilot's unconnected demonstration forms were replaced with navigation buttons for the CMS publication check.

## Automated verification

`npm test`: 46 files passed, 2 skipped; **1,144 tests passed, 5 skipped**. This includes TypeScript checking. Deployment Python checks: 5 passed. Demo generation passed.

Coverage includes shared validation, field types, false booleans, missing references/assets, unsafe rich text, explicit save/failure/cancel, 200-entry pagination, content-role restrictions, stale-version conflicts, publication privacy, draft exclusion, deletion after republish, rendering and package regressions. HTTP lifecycle tests exercise actual application routes with isolated in-memory stores; these are not claims that every case was manually replayed against the shared staging database.

## Browser and staging evidence

- Fresh Stillwood import into a separate QA site succeeded after bounding concurrent media installation to three assets. The initial failed install rolled back.
- Saved an amenities edit through the workspace. The server acknowledgement appeared; reload retained the content and updated the repeated card without changing its URL.
- Published source version 4 through the normal dialog with three recorded non-blocking template suggestions.
- Public detail rendered the image, reference label, rich description, guests and bedrooms. The collection slider's Next control enabled Previous after navigation.
- Saved a private draft marker; an unauthenticated public request retained the previous value and excluded the marker. Restored the field afterward.
- Inspected desktop, 768px and 390px CMS layouts using the built-in browser. The local-only iframe harness supplies actual CSS viewports without changing production frame policy. The background editor is inert while CMS is open; entry focus moves into the form.

## WordPress and portability

Native Cloud document round-trip retains CMS data and layout settings. Portable package v1 still explicitly rejects editable Pagecraft CMS; this release does not silently flatten or discard bindings.

On isolated WordPress at port 4931, imported an additional released Stillwood page as draft 78, titled `CMS compatibility QA — Stillwood import`. It was confirmed Pagecraft-managed and loaded its hero and native slider controls in the builder. Existing pages and front-page settings were preserved.

A checksummed package fixture declaring CMS content was rejected by the installed PHP validator with `Pagecraft CMS content must be flattened explicitly before WordPress import.` This is an explicit unsupported-feature result, not an editable CMS ZIP round-trip or a new WordPress CMS authoring workflow.

## Commits and deployment

- `f3f2bf1`: authoring, validation, layouts and permissions; staging verified.
- `a1e5ca7`: pilot, HTTP lifecycle tests and bounded media installation; staging verified.
- `f013b83`: generated detail URLs recognized by publication review, with draft-route regression coverage; staging `/__deployment` verified before the publication test.

Scheduling, approvals, bulk editing, revision comparison, galleries/multiple references and a headless API remain deferred.

## Cloud refinement

Cloud is the active CMS development target; WordPress CMS work is paused at the user's request. The workspace distinguishes new entries, displays unsaved changes after edits, supports Command/Control+S, associates validation messages with inputs and focuses the first invalid field. Rich text is explicitly read-only during persistence, including its paste and formatting paths. Collection navigation clears stale notices and filters.
