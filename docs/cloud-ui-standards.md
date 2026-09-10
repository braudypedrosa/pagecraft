# Cloud UI geometry

Pagecraft uses white and cool neutral surfaces, Ink and Craft Green. Shared colors and geometry lives in `shared/ui-tokens.js`; the account shell and generated editor both consume it. It does not enter published user-page CSS.

| Role | Minimum height | Typography |
| --- | --- | --- |
| Dashboard, account, site management and full CMS forms | 44px | 13.5px / 1.4 |
| Authentication form fields and actions | 44px | Existing 16px / 1.4 |
| Collaborator row controls | 36px | 13.5px / 1.4 |
| Builder inspector and dialog controls | 37px | Existing 13.5px / 1.4 |
| Dense builder rows / tiny actions | 32px | Existing builder scale |

Use identical geometry for an action rendered as a link or button. Read-only copy values and their actions share the 44px height; the row owns its gap and top spacing, never the nested button. Long values truncate within a shrinkable column. Section actions use a 16px gap, form fields use 16px between groups and 8px between label and control. Site-management sections use 32px vertical padding. Preserve intentionally different navigation, icon, badge and multiline-control sizes.

The CMS preview picker is a 32px toolbar group with 26px internal controls, matching the adjacent toolbar badges. Its label identifies the preview collection, and the toolbar wraps when both editor panels reduce the available width. Escape closes its menu without invoking the canvas selection shortcut.

The custom-select trigger follows its host density. Collaborator row selects remain 36px; CMS controls use 44px. Account focus outlines use Ink on light surfaces and Craft Green on the dark navigation. Disabled builder buttons retain their geometry and use the shared dim state.

## Acceptance scope

Desktop and tablet only, per the user's clarification. Existing narrow layouts remain available but mobile acceptance is not part of this task. Use local identifiable fixtures for long names, pending collaborators, registration/reset forms and editable CMS states. Do not change shared staging/production records, permissions or credentials to validate layout.

Verify the actual computed boxes and keyboard interactions, including dropdown opening/Escape, account tabs, copy feedback, create-dialog focus and disabled actions. Confirm the deployed commit through `/__deployment` before reporting staging availability.

## Workspace consistency — September 11, 2026

Pages is the visual reference for full management screens. `shared/workspace-styles.js` owns their surface, heading scale, gutters, header actions and list rhythm. Explicit `pc-workspace-head` / `pc-workspace-body` classes connect Preact and server markup to that contract. The compatibility selectors keep existing navigation and dialog behavior intact.

- White work surface; cool neutral supporting regions (`#f5f7f8`, `#edf0f2`) and canvas surround (`#e9edf0`). Hover uses a very light green `--pc-hover-bg` (`#f4faef`). Borders use cool gray tokens. Selected rows, picker options and secondary navigation use the shared pale green `--pc-selection-bg` (`#eef7e5`), with dark green text and accessible muted labels. This applies to Pages, Navigator, CMS collections, project/account settings, media/template/content pickers and integration choices. Selection stays green on hover; existing borders, checkmarks and weight preserve additional selection cues. Main rail navigation, primary actions and status/toggle indicators retain their stronger colors.
- 22px workspace title, 18px section title, 16px dialog title, 13.5px body, 12.5px table headers/metadata.
- Headers: 24px vertical / 32px horizontal; body: 28px / 32px. Gutters become 20px below 1050px.
- Header actions use the builder's 37px controls. Full forms remain 44px; row icon actions are 36px. Schema rows and compact editor panels retain their existing density.
- Table headers use white, a bottom rule and medium-weight labels. Rows use 16px / 12px padding, centered controls and light green hover feedback.
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
