# Page-owned headers and footers

The Cloud editor's Page settings offers an independent Header and Footer choice:

- **Use shared** follows the site's shared region.
- **Customize for this page** copies the current effective region, assigns fresh document node IDs and preserves authored link anchors. Later shared edits do not replace the copy.
- **Hide on this page** publishes no region. A custom region can be removed only after confirmation. Undo restores its exact content and IDs until the editor is reloaded.

The Edit button opens the current shared or page-owned region through the existing canvas and Navigator. An empty custom region remains editable. Hidden regions are omitted from the canvas and Navigator; choose Customize to create one. Header/footer starter templates operate on the current page's chosen region, including reviving a hidden region as an owned copy.

## Persistence

Schema 16 adds optional `Page.header` and `Page.footer` fields:

| Stored value | Meaning |
| --- | --- |
| Missing | Inherit the shared document region |
| `null` | Hidden on this page |
| `Node[]`, including `[]` | Page-owned editable region |

Schema-14 and schema-15 documents migrate by changing version markers only. No override fields are invented. Released schema-14 template archives remain unchanged. The schema gate prevents an older editor from silently ignoring visible owned content.

The core exports `pageTrees(page)` for stored-tree walks, `pageRegion(page, kind)` for effective rendering against the current compiler state, `pageRegionMode` and the mutation-only `pageRegionSet`. The UI wraps mutations in one `edit()` transaction. Ordinary node content/style edits use the same active-tree APIs as shared regions. Public compilation resolves the supplied page, not the currently selected page, and passes detail-page CMS context into its effective regions.

Custom trees participate in migration, page duplication, class/token/component usage, library conflict scans, media references, text search, form inspection, lint and history labels. Public styles and motion include only the page's effective regions. WordPress stylesheet splitting retains actual shared region styles globally and writes owned region styles in the page stylesheet.

MCP/proposal outlines identify stored page-owned regions as `page-header:<page-id>` and `page-footer:<page-id>`. Hidden/inherited regions do not create extra editable copies.

## WordPress boundary

The current connected WordPress v1 release format assumes one shared header/footer for the whole site. A whole-site or connected release containing page overrides must refuse explicitly, until that separate contract is upgraded. A single-page portable export can flatten its selected page's effective regions into that package's shared trees, remove all page override fields, validate the result and convert schema 16 to schema 14 for the existing reader when it contains no native tab panels. Native editable tab panels retain schema 15 and renderer revision 3, and require a reader with that capability. The Cloud source remains unchanged. No installed WordPress runtime is upgraded by adding this Cloud feature.

## Verification ownership

Focused core and UI tests cover inheritance, custom and hidden state, empty copies, scoped output/styles/motion/CMS, fresh node identities with preserved anchors, native confirmations, template placement, atomic Undo/Redo, save/adoption and role visibility. The integration owner separately builds, deploys and verifies the actual staging controls and published pages.
