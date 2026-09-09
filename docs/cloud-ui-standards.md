# Cloud UI geometry

Preserve Pagecraft's Paper, Ink and Craft Green visual identity. Shared geometry lives in `shared/ui-tokens.js`; the account shell and generated editor both consume it. It does not enter published user-page CSS.

| Role | Minimum height | Typography |
| --- | --- | --- |
| Dashboard, account, site management and full CMS forms | 44px | 13.5px / 1.4 |
| Authentication form fields and actions | 44px | Existing 16px / 1.4 |
| Collaborator row controls | 36px | 13.5px / 1.4 |
| Builder inspector and dialog controls | 37px | Existing 13.5px / 1.4 |
| Dense builder rows / tiny actions | 32px | Existing builder scale |

Use identical geometry for an action rendered as a link or button. Read-only copy values and their actions share the 44px height; the row owns its gap and top spacing, never the nested button. Long values truncate within a shrinkable column. Section actions use a 16px gap, form fields use 16px between groups and 8px between label and control. Site-management sections use 32px vertical padding. Preserve intentionally different navigation, icon, badge and multiline-control sizes.

The CMS preview picker is a 32px toolbar group with 26px internal controls, matching the adjacent toolbar badges. Its label identifies the preview collection, and the toolbar wraps when both editor panels reduce the available width. Escape closes its menu without invoking the canvas selection shortcut.

The custom-select trigger follows its host density. Collaborator row selects remain 36px; CMS controls use 44px. Account focus outlines use Ink on Paper and Craft Green on the dark navigation. Disabled builder buttons retain their geometry and use the shared dim state.

## Acceptance scope

Desktop and tablet only, per the user's clarification. Existing narrow layouts remain available but mobile acceptance is not part of this task. Use local identifiable fixtures for long names, pending collaborators, registration/reset forms and editable CMS states. Do not change shared staging/production records, permissions or credentials to validate layout.

Verify the actual computed boxes and keyboard interactions, including dropdown opening/Escape, account tabs, copy feedback, create-dialog focus and disabled actions. Confirm the deployed commit through `/__deployment` before reporting staging availability.
