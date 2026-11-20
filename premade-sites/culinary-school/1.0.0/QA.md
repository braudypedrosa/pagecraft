# Sorrel & Stone (`culinary-school@1.0.0`) — QA & Verification Record

- **Template ID**: `culinary-school@1.0.0`
- **Sample Identity**: Sorrel & Stone (Culinary, Pastry, Sourdough & Botanical Fermentation School)
- **Package File**: `draft/site.pagecraft-site.zip`
- **Package SHA-256**: `619c8c5b62445a58fdf6b3ef6918c92b39681390a1d2cb9a8fe4d8543c551689`
- **Schema / Renderer**: Schema `17` · `pagecraft-core-17` · `pagecraft-renderer-4`
- **Custom CSS Policy**: `native-only` (0 custom CSS blocks, 0 head HTML injections)
- **Pages**: 5 (`index.html`, `workshops.html`, `calendar.html`, `about.html`, `contact.html`) — 29 native sections total
- **Managed Assets**: 26 (18 scene-specific WebP photographs + 8 original vector SVG brand/icon assets)

## Verification Summary

| Check | Result | Details |
| --- | --- | --- |
| Authoring Contract (`assertTemplateDocument`) | **PASS** | All node IDs unique, all `d`/`t`/`m` responsive blocks valid, 0 custom CSS, 26/26 assets configured and referenced |
| Portable Package Validation (`validatePortablePackage`) | **PASS** | `site.pagecraft-site.zip` (7,724,485 bytes) validates cleanly with current importer |
| Static Render & Contrast Audit (`renderSite`) | **PASS** | 0 unexpected errors, **0 warnings**, 0 contrast warnings, 0 missing-dimension warnings, 1 expected `form-no-action` setup finding on `contact.html#inquiry` |
| Link & Anchor Integrity | **PASS** | 124 internal & external link occurrences checked across all 5 compiled pages; 0 broken links, 0 missing `#anchor` targets (`#sourdough`, `#pastry`, `#fermentation`, `#seasonal`, `#faq`, `#inquiry`) |
| Pagecraft Cloud Fresh Install & Edit Flow | **PASS** | Verified via `cloud-compatibility-check.mjs`: fresh install via `POST /api/sites`, global color/typography token edits, responsive inspector edit, shared component preservation, versioned save (`v2`), reopen, restore (`v3`), and second-install asset ID isolation (26/26 distinct IDs, 0 overlap) |
