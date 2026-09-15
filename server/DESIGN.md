# Pagecraft review workspace

The review belongs to Pagecraft Cloud. Use `PRODUCT.md`, `shared/ui-tokens.js`,
`shared/ui-fonts.js`, and the existing Cloud header as the branding authority.
The customer site inside the sandboxed iframe has its own design.

## Visual foundations

- Ink (`#111311`) header, original Pagecraft logo, Craft Green (`#b7f34a`) primary actions.
- Manrope for interface controls and headings; DM Sans for supporting text and conversations.
- White working panels, cool gray canvas surround, shared border and selection tokens.
- Shared 7px control radius; 36px controls and compact 30px toolbar segments.
- 4/8/12/16/24px spacing rhythm. Flat conversation surfaces with shared selection colors in the navigator and no active left border.
- Existing Pagecraft 16px line icons; matching local comment/share glyphs.

## Structure

The ink header identifies the site, role and sharing action, with icon-only device controls.
The toolbar contains Browse/Comment and Element/Section targeting. A 224px comments panel
contains one page dropdown, defaulting to the first page, and a flat numbered comment list
for the selected page, device and status. There are no page rows or section groups. Selecting a pin opens a 336px conversation
inspector on the right; closing it returns that space to the canvas. At narrower desktop
widths these panels use 200px and 300px. Open, Resolved and All filters remain in the navigator.
The inspector includes context breadcrumbs, chronological replies, and a Craft Green done action.
Existing owner/content members can open the page in the editor; matching exported model IDs
also select the element. Review-only developer access does not grant editor rights.

Sharing opens in a native dialog, with keyboard focus containment and Escape dismissal.
It does not consume canvas height. Transient notifications do not leave a blank layout row.
The desktop workspace fills available height using flex/grid. At 800px and below,
toolbar controls wrap and comments follow the 60dvh preview. Selecting a pin reveals
and focuses its thread. Device preview widths remain 1440, 768 and 390px.

## Annotation

Comment mode outlines the hovered element or semantic section. Clicking locks a pending
anchor, shows its type in the composer, and places a preview pin. Saving selects the new
thread. Thread selection outlines its anchor; Browse restores site navigation. Existing
builder IDs are preserved; inner elements receive deterministic preview-only IDs.

## Implementation and review state

`live-review-page.ts` renders the shell, entry and hub. `live-review-styles.ts` holds the
chrome styles. `live-review-client.ts` controls conversations, sizing and the iframe bridge.
The September 15 overhaul is a local review candidate; it supersedes the earlier standalone
review appearance. Visual acceptance is separate from automated functional checks.

## Shared styling contract

Reviews imports the canonical `brand/pagecraft-tokens.css` (excluding its remote-font
import), `UI_TOKENS_CSS`, `UI_FONTS_CSS`, `WORKSPACE_CSS`, `UI_TYPOGRAPHY_CSS`,
`UI_FOCUS_CSS`, `UI_MOTION_CSS`, and the shared custom-select styles/installer.
Use `pc-dialog`, `pc-dialog-head`, `pc-dialog-title`, `pc-dialog-body`, and
`pc-dialog-close` for sharing. Page and target pickers use Pagecraft's enhanced select,
including its mobile menu and keyboard behavior. Review-only layout rules should not
redefine those components. Pins receive resolved shared palette values from the parent;
those variables are scoped to review overlays, never the customer document root.

Thread identities use initial avatars with timestamps below the author. Expanded replies
are chronological list items with their own identity and message. The page picker and
Comments title omit decorative icons. Mark done uses the Craft Green primary action.

## Shared header ownership

`server/src/cloud-header.ts` owns the Cloud header renderer, brand markup, typography,
geometry, and responsive rules. Dashboard/site management, the review workspace, and
review hub consume it. Review tools occupy trusted content slots; do not add local
brand, title, separator, or header sizing overrides in review styles.
The gallery source contract includes this module. Desktop header, brand, and title
measurements must match between site management and Reviews.

Builder is the visual authority for header identity and device controls.
`shared/builder-header.js` owns the 16px/24px, weight-600 wordmark; 8px logo gap;
compact shaded device group; 17px device SVGs; and state styling. `build.mjs` and
Cloud header rendering consume the same source. Keep review-specific device
selection behavior separate from these shared visual definitions.
