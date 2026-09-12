# Cloud UI standards

Pagecraft uses white and cool neutral surfaces, Ink and Craft Green. Shared colors, typography and geometry live in `shared/ui-tokens.js`; the account shell and generated editor both consume it. It does not enter published user-page CSS.

## Required component contracts

New screens must reuse the production workspace, field, action, table, menu,
dialog and feedback components. Choose the semantic density below; do not add
screen-specific sizes to make one screenshot fit. Intentional exceptions must
state the user need, owning component and affected states in the change report.
Gallery-only styling must never repair a production control.

Every changed component must be checked within its real consuming screens, with
long labels/content, empty results, loading, disabled/read-only values, recoverable
errors, keyboard interaction and retained unsaved input. Add representative gallery
fixtures where coverage is missing. Passing source hashes or sample screenshots
alone does not prove an application screen works. See `docs/real-screen-baselines.md`.

| Role | Minimum height | Typography |
| --- | --- | --- |
| Dashboard, account, site management and full CMS forms | 44px | 12px / 1.4 |
| Authentication form fields and actions | 44px | Existing 16px / 1.4 |
| Collaborator row controls | 32px | 12px / 1.4 |
| Builder inspector and dialog controls | 37px | Existing 12px / 1.4 |
| Dense builder rows / tiny actions | 32px | Existing builder scale |

All text inputs, textareas, enhanced selects, standard text buttons and menu options use shared `--pc-control-padding`: **6px vertically / 8px horizontally**. Existing minimum-height densities and icon-only controls keep their geometry. Native select fallbacks and search fields reserve additional space for their inset arrow or search icon. Compact toolbar pickers have a 30px inner height within the 32px toolbar control so the padding cannot compress their text.

Use identical geometry for an action rendered as a link or button. Read-only copy values and their actions share the 44px height; the row owns its gap and top spacing, never the nested button. Long values truncate within a shrinkable column. Section actions use a 16px gap, form fields use 16px between groups and 8px between label and control. Site-management sections use 32px vertical padding. Preserve intentionally different navigation, icon, badge and multiline-control sizes.

The CMS preview picker is a 32px toolbar group with 30px internal controls, matching the adjacent toolbar badges. Its label identifies the preview collection, and the toolbar wraps when both editor panels reduce the available width. Escape closes its menu without invoking the canvas selection shortcut.

The custom-select trigger follows its host density. Collaborator row selects remain 32px; CMS controls use 44px. Keyboard focus on fields preserves their existing surface; action controls retain their shared focus treatment. Disabled builder buttons retain their geometry and use the shared dim state.

## Acceptance scope

The builder supports desktop and tablet editing when the browser viewport is at least 768px wide. This is independent of the canvas preview breakpoint: Mobile preview remains available in a supported editing window. Below 768px, a larger-screen message locks the existing editor, menus, dialogs and editing shortcuts without unmounting them or interrupting saves. Widening restores the same session and unsaved form values. Cloud's Back to sites uses the existing draft-flushing host navigation; WordPress uses its supplied pages/exit destination. A downloaded standalone file has no Sites destination. Dashboard and published sites remain usable on phone widths.

Verify at 390, 767, 768, 1024 and desktop viewport widths, including 1024 x 790 dropdown placement. These are browser viewport tests, not physical-device certification. Use identifiable, explicitly authorized QA fixtures for mutating staging journeys; staging and production currently share site records.

Verify the actual computed boxes and keyboard interactions, including dropdown opening/Escape, account tabs, copy feedback, create-dialog focus and disabled actions. Confirm the deployed commit through `/__deployment` before reporting staging availability.

## Workspace consistency — September 11, 2026

Pages is the visual reference for full management screens. `shared/workspace-styles.js` owns their surface, heading scale, gutters, header actions and list rhythm. Explicit `pc-workspace-head` / `pc-workspace-body` classes connect Preact and server markup to that contract. The compatibility selectors keep existing navigation and dialog behavior intact.

- White work surface; light gray supporting regions (`--pc-surface-subtle: #fafbfc`, `--pc-surface-muted: #f3f5f6`) and canvas surround (`#f3f5f6`). Shared control surfaces, including Alignment, layout controls, pickers and supporting account regions, use these same light grays. Hover uses a very light green `--pc-hover-bg` (`#f4faef`). Borders use cool gray tokens. Picker options and secondary navigation use the shared pale green `--pc-selection-bg` (`#eef7e5`), with dark green text and accessible muted labels. This applies to Navigator, CMS collections, project/account settings, media/template/content pickers and integration choices. Their selection stays green on hover; existing borders, checkmarks and weight preserve additional selection cues. Table rows, including the current page in Pages, retain their normal surface and text colors at rest; green row backgrounds appear only on hover. Main rail navigation, primary actions and status/toggle indicators retain their stronger colors.
- 22px workspace title, 18px section title, 16px dialog title, 12px body, 11px table headers/metadata.
- Headers: 24px vertical / 32px horizontal; body: 28px / 32px. Gutters become 20px below 1050px.
- Header actions use the builder's 37px controls. Full forms remain 44px; row actions are 32px. Schema rows and compact editor panels retain their existing density.
- Table headers use white, a bottom rule and medium-weight labels. Rows use shared 4px vertical / 8px horizontal cell padding, with 6px / 8px headers. Nested links add no padding; 24px text-link targets and 32px actions keep rows compact. Multiline content grows naturally. Column headings align with the leading cell content edge, including the icon when present. Pages, CMS entry lists, Submissions, Integrations and member lists consume the shared density tokens; inline CMS cells keep their existing compact control layout. Hover feedback stays light green.
- Submissions applies Status changes immediately, without a separate Filter button. A committed selection uses the existing inbox navigation, preserves the selected form and date order, resets pagination to page 1, and updates the export link with the resulting filter. Background refresh remains silent and request failures retain the recoverable error feedback.
- `shared/ui-fonts.js` is the font manifest for both hosts. The builder embeds its files for offline use; Cloud loads those exact files from allowlisted `/brand/fonts/` routes. Cloud's declaration previously fell back to the system font because it had no font faces.

### Screen inventory

| Screen family | Review / alignment |
| --- | --- |
| Pages manager and page settings/SEO | Visual reference; shared header/body classes and field radius. Dense SEO inspector retained. |
| CMS collection list, schema, entry form | Shared header, secondary heading scale, collection navigation, row spacing and icon actions. Existing save feedback retained. |
| Submissions overview, entries, empty/filter states, details/delete dialogs | Removed nested centered insets; white full-width shell, real brand fonts, shared headings/buttons/table rows; header wraps and tables scroll on narrow screens. |
| Sites dashboard and create/delete dialogs | Shared shell/type; create action belongs in the header; existing site thumbnails and creation steps retained. |
| Site overview, People, site settings, Integrations | Shared shell/gutters/headers; readable form widths; Integrations table uses the same table styling. |
| Account profile, security, plan/billing | Shared shell/type/navigation; form width capped; persistent footer remains outside tab panels. |
| Project settings: General, Typography, Colors, Style classes, Custom code, Advanced | Full workspace heading and section hierarchy; collection/settings navigation width aligned. Shared field controls retained. |
| Add: Elements, Templates, Components, Blocks; Navigator; Content/Style/Advanced inspectors | Reviewed existing shared builder primitives; intentionally compact while editing the canvas. No wholesale visual replacement. |
| Media, History, Review, Publish/export, confirmation prompts | Reviewed shared modal primitives; server detail/create/delete/integration dialogs aligned with their title scale and shape. |
| Sign in/up, password recovery/reset, legacy sign-in/setup and connection consent | Same local brand fonts and control geometry. Authentication remains a focused branded entry flow, not a management workspace. |
| Privacy and Terms | Same loaded product fonts; reading layout retained. |

Validation combines the rendered desktop workspace journeys, tablet/narrow iframe fixtures, and source review of shared screen families. Local fixture storage provides success/failed submissions, empty lists and CMS entries without editing the shared staging/production database. Integration-provider operations, publication and destructive live actions are outside this visual verification.

## Shared typography roles

`shared/ui-tokens.js` owns the size scale and complete font roles. `shared/ui-typography.js` applies those roles in both the portable editor and Cloud shell. The builder's older `--fs-*` names are aliases, not a separate scale. Use these classes for new UI; compatibility selectors map existing field, caption and table families to the same rules.

| Primitive | Role | Font / size / weight / line height |
| --- | --- | --- |
| `pc-input-text` | Inputs and native/enhanced selects | Manrope / 12px / 400 / 1.4 |
| `pc-control-text` | Standard action/control text | Manrope / 12px / 500 / 1.4 |
| `pc-toolbar-context` | Compact context row and its buttons, pills and selects | Manrope / 11px / 500 / 1.4 |
| `pc-field-label` | Field names, including schema and filter labels | DM Sans / 11px / 500 / 1.5 |
| `pc-description` | Help beneath a field or explanatory sublabel | DM Sans / 11px / 400 / 1.55 |
| `pc-caption` | Secondary item metadata and short captions | DM Sans / 11px / 400 / 1.45 |
| `pc-table-label` | Column headers | DM Sans / 11px / 600 / 1.4 |

Panel/dialog/section/workspace headings use shared 15/16/18/22px tokens. Descriptive paragraphs in workspace headers keep the 12px body role. Authentication controls retain their 16px input size; their labels and help use the shared field roles.

The context toolbar owns its 32px outer controls and 30px nested picker controls. Page selection, Settings & SEO, component Done, CMS preview and device context use this one rule, with no element-ID font overrides. Controls inside labels retain the body font rather than inheriting the label font. Geometry, color, overflow and interactive states remain with the owning component.

The compact scale uses 12px for body/control text and 11px for labels, help and captions. Weights, line heights and control geometry retain their existing role distinctions. Canvas editing placeholders share the same size constants; user-authored page typography is unchanged.

The builder header gives its project/page title the available space rather than a fixed width cap. At constrained widths, the text items ellipsize within that space, the secondary page name yields first, and the full project/page name remains available on hover. Existing tablet action priorities and Publish visibility remain unchanged.

Only the embedded font faces are copied into the canvas. App typography, tokens and workspace rules have their own style element and do not enter the page being edited or published.


### Saved dashboard previews

Sites cards use private, versioned 960 × 600 WebP thumbnails. The cache key is the saved document version plus the published publication ID; visiting, filtering, sorting, or resizing Sites does not regenerate a matching image. A changed version keeps the previous image visible while inert saved-homepage HTML produces its replacement, with at most two capture jobs active. No page iframe is mounted, and image/font assets are fetched only once for capture. Focus/visibility and a single batched 30-second metadata check discover saves made in another tab or session.

Thumbnail files live under the environment's publication root in `.dashboard-previews`, with one atomic record per site, capped at 1 MB of image data. They survive application deployments, are shared across authorized viewers, and are deleted with the site. GETs require site access and use private immutable browser caching with an ETag and `Vary: Cookie`. Uploads require write access, validate decoded dimensions/type, and reject a saved/published version that changed during capture or decoding. No document/database migration, public-site request, headless browser service, or background worker is involved.

An absent/failed cache never prevents editing. A first visit or a new saved/published version generates the image on demand; failed generation retains any previous thumbnail and offers Retry. Inaccessible external image/font resources may prevent capture and remain retryable rather than saving incomplete artwork. Preview freshness failures are distinguished from successful refreshes. Published pages and the builder canvas keep their own responsive rendering.

### Shared interaction contracts

`shared/ui-focus.js` owns border-free application focus feedback. Text inputs, textareas, native selects and editable content keep their resting background and text color on focus, including readonly fields. Enhanced select triggers also keep their normal surface when open; keyboard focus underlines their label. No field focus rings, outline strokes or input glows are added. Buttons, links and navigation use soft focus backgrounds with matching semantic colors. Native checkboxes/radios/sliders retain their shape and use brightness feedback without a label background.

Selects nested inside toolbar pills (page switcher, CMS preview, canvas zoom) stay transparent in hover, focus and open states so the pill owns the surface. Shared dropdown panels use an opaque white surface and soft shadow with no border. Their triggers retain the resting field border on hover and never pass hover or focus borders to the panel. Published page styles are separate.

Menus use `pc-menu`, `pc-menu-item` and `pc-menu-divider`: 7px popup radius,
4px item radius, 6px popup inset, 34px minimum item height and the shared control
text role. Links and buttons use the same geometry. Destructive actions change
semantic color only. Context-menu shortcuts retain their trailing alignment.
Select option lists inherit the computed trigger typography, including compact
toolbar and authentication densities, rather than the document body size. Popovers use the shared opaque `--pc-popup-bg` surface; transparent or tinted triggers never supply the popup background.

`Field` supplies stable native input IDs, visible-label associations and help
relationships. Composite leaves declare `data-field-part` (value, unit, side,
page or anchor). Action badges remain independently named buttons. Explicit
field actions use `pc-field-actions` for the shared 8px gap. Native application
checkboxes and radios retain browser semantics and use Craft Green.

Workspace exits schedule `restoreCanvasLayout()` after revealing the stage.
Hidden-stage measurements cannot replace the last usable canvas dimensions.
No-op scope changes do not enter document history. Escape from a color popover
returns focus to its swatch; outside-pointer dismissal preserves the destination.

Submissions revalidate silently in the background, including deferred replacement while details are open. Routine refreshes reserve no status area and show no completion message. Explicit Refresh and navigation actions keep their button processing state. Failed refreshes retain the last loaded list and reveal a recoverable inline alert; a successful retry removes the alert and its spacing.

## Form and dialog ownership

Single-line controls consume their container’s density: 44px full forms, 37px editor fields, 36px CMS schema, and 32px inline editor/repeater/typography rows. Native inputs, enhanced selects and unit composites in the same group must have equal height, with the shared 6px / 8px padding and 7px control radius. Multiline fields grow independently. Standard field labels have an 8px gap to their control and field groups have a 16px gap.

`shared/dialog-styles.js` owns `pc-dialog`, `pc-dialog-head`, `pc-dialog-title`, `pc-dialog-body`, `pc-dialog-foot`, and `pc-dialog-close`. All builder prompts and Cloud creation, integration, submission and deletion dialogs consume this contract: 24px content inset, 16px vertical header/footer inset, 8px action gap, 32px corner close, 16px outer radius and one flat scrim. Empty footers occupy no space. Full Project settings remains a workspace with workspace gutters. Dialog actions retain the host’s existing form density.

At 768–1024px, CMS schema Name and Type share the upper row and Required shares the lower row with move/delete actions. Option/reference details span the available width. Resizing does not remount the form.

Closing unchanged Project settings is quiet and makes no save request. Pending name/document edits still settle before Close completes, and failures remain recoverable. Keyboard & tips describes the current host’s saving and available shortcuts; Cloud drafts, WordPress saving and standalone browser storage are different contracts.

## Interface motion

Pagecraft editor and Cloud chrome share restrained motion through `shared/ui-motion.js`. Quick control feedback uses 120ms, standard entrances 180ms, dialog entrances 200ms and exits 120ms. Movement stays within 4–8px; dialogs also begin near 98% scale. Published-site output does not load this interface controller.

Dialogs, menus, popovers, custom selects, colour pickers, notices, workspaces and disclosures must use the shared enter/exit lifecycle. Exiting surfaces remain mounted until completion, cannot intercept pointer input, and restore focus after closing where the interaction owns an opener. Rapid reopening cancels the stale exit. `prefers-reduced-motion: reduce` completes the state change immediately without spatial movement.

Canvas selection geometry, resize handles, drag-and-drop geometry, typing, live inspector values, scrolling and individual table-row updates remain immediate. Workspace transitions use opacity and small vertical movement only; they must not animate widths or change canvas measurements.

## Internal component reference

The authenticated staging [component gallery](https://staging.itspagecraft.com/internal/components) demonstrates the actual Cloud and builder style cascades and shared interaction behavior. Its 24 desktop/tablet PNG baselines and source-review gate are part of `npm test`. See [component-gallery.md](component-gallery.md) for capture states, comparison commands, review requirements and coverage limits.
